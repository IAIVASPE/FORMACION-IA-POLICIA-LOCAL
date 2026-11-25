'use strict';
/* TokUI — utilidades de interfaz compartidas: pegado con formato, Markdown -> HTML,
   destokenización dentro del HTML (conserva párrafos, sangrías, listas, tablas, negritas),
   exportación a .txt / .docx / .csv. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function download(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); };
  const txtBlob = t => new Blob(['﻿' + String(t).replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' });
  const csvBlob = t => new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' });

  async function copyText(text) {
    try { if (navigator.clipboard && window.isSecureContext !== false) { await navigator.clipboard.writeText(text); return true; } } catch (_) {}
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} ta.remove(); return ok;
  }
  // copia con formato (para pegar en Word conservando párrafos, listas, negritas…)
  async function copyRich(el) {
    const c = limpio(el), html = c.innerHTML, text = domToText(el);
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
        return true;
      }
    } catch (_) {}
    return copyText(text);
  }
  async function readClipRich() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        let text = '';
        for (const it of items) if (it.types.includes('text/plain')) text = await (await it.getType('text/plain')).text();
        for (const it of items) if (it.types.includes('text/html')) return { html: await (await it.getType('text/html')).text(), text };
        if (text) return { text };
      }
    } catch (_) {}
    try { return { text: await navigator.clipboard.readText() }; }
    catch (_) { return { text: prompt('Tu navegador no permite leer el portapapeles automáticamente.\nPega aquí el texto (Ctrl+V):') || '' }; }
  }

  // ---------- HTML pegado: se conserva la estructura y se quita todo lo demás ----------
  const KEEP = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'STRIKE', 'CODE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'HR', 'SUB', 'SUP']);
  const DROP = /^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|NOSCRIPT|IFRAME|OBJECT|EMBED|SVG|CANVAS|BUTTON|INPUT|TEXTAREA|SELECT|IMG|VIDEO|AUDIO|TEMPLATE|FORM)$/;
  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const out = document.createElement('div');
    (function clean(node, parent, pre) {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) { parent.appendChild(document.createTextNode(ch.nodeValue)); continue; }
        if (ch.nodeType !== 1 || DROP.test(ch.tagName)) continue;
        const tag = ch.tagName, st = ch.getAttribute('style') || '';
        let target = parent;
        const normal = /font-weight\s*:\s*(normal|[1-4]00)\b/i.test(st);
        if (KEEP.has(tag) && !((tag === 'B' || tag === 'STRONG') && normal)) {
          const el = document.createElement(tag);
          const keep = [];
          for (const prop of ['margin-left', 'padding-left', 'text-indent', 'text-align']) {
            const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i').exec(st);
            if (m && !/^0(px|pt|cm|em)?$/.test(m[1].trim())) keep.push(prop + ':' + m[1].trim());
          }
          if (keep.length) el.setAttribute('style', keep.join(';'));
          if ((tag === 'TD' || tag === 'TH') && ch.getAttribute('colspan')) el.setAttribute('colspan', ch.getAttribute('colspan'));
          if (tag === 'OL' && ch.getAttribute('start')) el.setAttribute('start', ch.getAttribute('start'));
          parent.appendChild(el); target = el;
        }
        const wrap = t => { const w = document.createElement(t); target.appendChild(w); target = w; };
        if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(st) && !/^(B|STRONG|H\d|TH)$/.test(tag)) wrap('b');
        if (/font-style\s*:\s*italic/i.test(st) && !/^(I|EM)$/.test(tag)) wrap('i');
        if (/text-decoration[^;]*underline/i.test(st) && tag !== 'U') wrap('u');
        clean(ch, target, pre || tag === 'PRE');
      }
    })(doc.body, out, false);
    return out.innerHTML;
  }

  // ---------- Markdown / texto plano -> HTML (saltos de línea, sangrías, listas, tablas…) ----------
  function inlineMd(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*(?![\s*])([^*\n]+?)\*(?![\w*])/g, '$1<i>$2</i>');
  }
  function lead(s) {
    const m = /^[ \t ]+/.exec(s); if (!m) return inlineMd(s);
    return m[0].replace(/\t/g, '    ').replace(/[  ]/g, '&nbsp;') + inlineMd(s.slice(m[0].length));
  }
  const isTbl = l => /^\s*\|.*\|\s*$/.test(l);
  const isSep = l => /^\s*\|?[\s:|\-]+\|?\s*$/.test(l || '') && /-/.test(l || '');
  const LIST = /^(\s*)([-*+•·]|\d{1,3}[.)])\s+(.*)$/;
  const HEAD = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  function mdToHtml(text) {
    const L = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    let h = '', i = 0;
    while (i < L.length) {
      const l = L[i];
      if (!l.trim()) { i++; continue; }
      let m;
      if (/^\s*```/.test(l)) { const b = []; i++; while (i < L.length && !/^\s*```/.test(L[i])) b.push(L[i++]); i++; h += '<pre>' + esc(b.join('\n')) + '</pre>'; continue; }
      if ((m = HEAD.exec(l))) { h += `<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`; i++; continue; }
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) { h += '<hr>'; i++; continue; }
      if (isTbl(l) && isSep(L[i + 1])) {
        const rows = []; while (i < L.length && isTbl(L[i])) rows.push(L[i++]);
        const cells = r => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
        h += '<table><thead><tr>' + cells(rows[0]).map(c => `<th>${inlineMd(c)}</th>`).join('') + '</tr></thead><tbody>' +
          rows.slice(2).map(r => '<tr>' + cells(r).map(c => `<td>${inlineMd(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
        continue;
      }
      if (LIST.test(l)) {
        const stack = [];
        while (i < L.length && (LIST.test(L[i]) || (stack.length && L[i].trim() && /^\s{2,}/.test(L[i])))) {
          const lm = LIST.exec(L[i]);
          if (!lm) { h += '<br>' + inlineMd(L[i].trim()); i++; continue; }
          const ind = lm[1].replace(/\t/g, '    ').length, type = /\d/.test(lm[2]) ? 'ol' : 'ul';
          const start = type === 'ol' && +lm[2].match(/\d+/)[0] !== 1 ? ` start="${+lm[2].match(/\d+/)[0]}"` : '';
          while (stack.length > 1 && ind < stack[stack.length - 1].indent) h += `</li></${stack.pop().type}>`;
          const top = stack[stack.length - 1];
          if (!top || ind > top.indent) { h += `<${type}${start}>`; stack.push({ type, indent: ind }); }
          else { h += '</li>'; if (top.type !== type) { h += `</${stack.pop().type}><${type}${start}>`; stack.push({ type, indent: ind }); } }
          h += '<li>' + inlineMd(lm[3]); i++;
        }
        while (stack.length) h += `</li></${stack.pop().type}>`;
        continue;
      }
      if (/^\s*>/.test(l)) { const b = []; while (i < L.length && /^\s*>/.test(L[i])) b.push(L[i++].replace(/^\s*>\s?/, '')); h += '<blockquote>' + mdToHtml(b.join('\n')) + '</blockquote>'; continue; }
      const b = [];
      while (i < L.length && L[i].trim() && !/^\s*```/.test(L[i]) && !HEAD.test(L[i]) && !(isTbl(L[i]) && isSep(L[i + 1])) && !LIST.test(L[i]) && !/^\s*>/.test(L[i])) b.push(L[i++]);
      if (!b.length) b.push(L[i++]);
      h += '<p>' + b.map(lead).join('<br>') + '</p>';
    }
    return h;
  }
  const htmlEl = html => { const d = document.createElement('div'); d.innerHTML = html; return d; };

  // pegado en un recuadro editable: se conserva el formato (HTML) o se interpreta el texto/Markdown
  function insertarHtml(el, html) {
    const sel = getSelection();
    const frag = document.createRange().createContextualFragment(html);
    if (sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const r = sel.getRangeAt(0); r.deleteContents();
      const last = frag.lastChild; r.insertNode(frag);
      if (last) { const r2 = document.createRange(); r2.setStartAfter(last); r2.collapse(true); sel.removeAllRanges(); sel.addRange(r2); }
    } else el.appendChild(frag);
  }
  function pegarEn(el, data) {
    const html = data.html ? sanitizeHtml(data.html) : mdToHtml(data.text || '');
    insertarHtml(el, html);
  }
  function enlazarPegado(el, despues) {
    el.addEventListener('paste', e => {
      const cd = e.clipboardData; if (!cd) return;
      e.preventDefault();
      const vacio = !el.textContent.trim();
      const text = cd.getData('text/plain'), html = cd.getData('text/html');
      pegarEn(el, { html, text });
      despues(vacio ? text : null);
    });
  }

  // ---------- destokenización dentro del HTML ----------
  function destokenizarDom(src, out, map, E) {
    out.innerHTML = src.innerHTML;
    let rc = 0, uc = 0;
    const w = document.createTreeWalker(out, NodeFilter.SHOW_TEXT), nodos = [];
    while (w.nextNode()) if (/\[/.test(w.currentNode.nodeValue)) nodos.push(w.currentNode);
    for (const n of nodos) {
      const d = E.detokenize(n.nodeValue, map);
      if (!d.restoredCount && !d.unresolvedCount) continue;
      rc += d.restoredCount; uc += d.unresolvedCount;
      const f = document.createDocumentFragment();
      for (const g of d.diffSegments) {
        if (g.kind === 'PlainText') { f.appendChild(document.createTextNode(g.text)); continue; }
        const s = document.createElement('span'); s.className = g.kind === 'RestoredValue' ? 'rest' : 'unres';
        s.textContent = g.text; s.title = g.tooltip; f.appendChild(s);
      }
      n.parentNode.replaceChild(f, n);
    }
    return { rc, uc };
  }
  // copia sin las marcas de color (para copiar/exportar el documento final)
  function limpio(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('span.rest,span.unres,span.tok,span.cand').forEach(s => s.replaceWith(document.createTextNode(s.textContent)));
    c.querySelectorAll('.ph').forEach(s => s.remove());
    return c;
  }

  // ---------- HTML -> texto plano (conserva saltos, sangrías, viñetas y tablas) ----------
  const toPx = v => {
    const m = /^(-?[\d.]+)\s*(px|pt|em|rem|cm|mm|in)?$/.exec(String(v || '').trim()); if (!m) return 0;
    const n = +m[1]; return { pt: n * 4 / 3, em: n * 16, rem: n * 16, cm: n * 37.8, mm: n * 3.78, in: n * 96 }[m[2]] || n;
  };
  const sangria = el => el.style ? toPx(el.style.marginLeft) + toPx(el.style.paddingLeft) : 0;
  function domToText(el) {
    const c = limpio(el);
    // <li><p>…</p></li>: los párrafos de dentro de una viñeta se aplanan para que el texto quede en la línea de la viñeta
    c.querySelectorAll('li > p, li > div').forEach(p => {
      if ([...p.children].some(x => /^(UL|OL|TABLE|P|DIV|BLOCKQUOTE|PRE)$/.test(x.tagName))) return;
      const frag = document.createDocumentFragment(); [...p.childNodes].forEach(x => frag.appendChild(x));
      let sig = p.nextSibling; while (sig && sig.nodeType !== 1 && !String(sig.nodeValue || '').trim()) sig = sig.nextSibling;
      if (sig && !(sig.nodeType === 1 && /^(UL|OL)$/.test(sig.tagName))) frag.appendChild(document.createElement('br'));
      p.replaceWith(frag);
    });
    c.querySelectorAll('li').forEach(li => {
      const ol = li.parentElement && li.parentElement.tagName === 'OL';
      const n = ol ? (+(li.parentElement.getAttribute('start') || 1)) + [...li.parentElement.children].filter(x => x.tagName === 'LI').indexOf(li) : 0;
      let depth = 0; for (let p = li.parentElement; p && p !== c; p = p.parentElement) if (p.tagName === 'UL' || p.tagName === 'OL') depth++;
      li.insertBefore(document.createTextNode(' '.repeat((depth - 1) * 4) + (ol ? n + '. ' : '• ')), li.firstChild);
    });
    c.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,blockquote').forEach(b => {
      let px = sangria(b); if (b.tagName === 'BLOCKQUOTE') px += 32;
      const ti = b.style ? toPx(b.style.textIndent) : 0;
      const n = Math.max(0, Math.round((px + Math.max(0, ti)) / 8));
      if (n) b.insertBefore(document.createTextNode(' '.repeat(n)), b.firstChild);
    });
    c.querySelectorAll('ul,ol').forEach(x => { x.style.paddingLeft = '0'; x.style.listStyle = 'none'; });
    c.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;white-space:normal';
    document.body.appendChild(c);
    const t = c.innerText;
    c.remove();
    return t.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '');
  }

  // ---------- HTML -> .docx (sin librerías) ----------
  const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function runs(text, st) {
    const rpr = '<w:rPr>' + (st.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '') + (st.b ? '<w:b/>' : '') + (st.i ? '<w:i/>' : '') +
      (st.s ? '<w:strike/>' : '') + (st.sz ? `<w:sz w:val="${st.sz}"/><w:szCs w:val="${st.sz}"/>` : '') + (st.u ? '<w:u w:val="single"/>' : '') +
      (st.sup ? '<w:vertAlign w:val="superscript"/>' : st.sub ? '<w:vertAlign w:val="subscript"/>' : '') + '</w:rPr>';
    let o = '';
    for (const p of String(text).split(/(\n|\t)/)) {
      if (p === '\n') o += `<w:r>${rpr}<w:br/></w:r>`;
      else if (p === '\t') o += `<w:r>${rpr}<w:tab/></w:r>`;
      else if (p) o += `<w:r>${rpr}<w:t xml:space="preserve">${xe(p)}</w:t></w:r>`;
    }
    return o;
  }
  const INLINE_ST = { B: { b: 1 }, STRONG: { b: 1 }, I: { i: 1 }, EM: { i: 1 }, U: { u: 1 }, S: { s: 1 }, DEL: { s: 1 }, STRIKE: { s: 1 }, CODE: { code: 1 }, SUP: { sup: 1 }, SUB: { sub: 1 }, TH: { b: 1 } };
  const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'DL', 'DT', 'DD', 'FIGURE', 'THEAD', 'TBODY', 'TR']);
  const HSZ = { H1: 32, H2: 28, H3: 26, H4: 24, H5: 22, H6: 22 };
  function inline(node, st, pre) {
    let o = '';
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) {
        let t = ch.nodeValue;
        if (!pre) t = t.replace(/[ \t\r\n]+/g, ' ');
        o += runs(t.replace(/ /g, ' '), st);
      } else if (ch.nodeType === 1) {
        if (ch.tagName === 'BR') o += runs('\n', st);
        else if (!BLOCKS.has(ch.tagName)) o += inline(ch, Object.assign({}, st, INLINE_ST[ch.tagName] || {}), pre || ch.tagName === 'PRE');
      }
    }
    return o;
  }
  function ppr(ind, jc, keep) {
    let s = '<w:pPr>' + (keep ? '<w:keepNext/>' : '') + '<w:spacing w:after="120"/>';
    if (ind && (ind.left || ind.hanging || ind.first)) s += `<w:ind w:left="${Math.max(0, Math.round(ind.left || 0))}"${ind.hanging ? ` w:hanging="${ind.hanging}"` : ''}${ind.first ? ` w:firstLine="${Math.round(ind.first)}"` : ''}/>`;
    return s + (jc || '') + '</w:pPr>';
  }
  function bloques(node, ctx, out) {
    let buf = [];
    const flush = () => {
      if (!buf.length) return;
      const tmp = document.createElement('span'); buf.forEach(n => tmp.appendChild(n.cloneNode(true)));
      const r = inline(tmp, ctx.st || {}, ctx.pre);
      if (r.replace(/<[^>]+>/g, '').trim() || /<w:br\/>/.test(r)) out.push(`<w:p>${ppr({ left: ctx.left })}${r}</w:p>`);
      buf = [];
    };
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3 || (ch.nodeType === 1 && !BLOCKS.has(ch.tagName))) { buf.push(ch); continue; }
      if (ch.nodeType !== 1) continue;
      flush();
      const tag = ch.tagName, left = (ctx.left || 0) + sangria(ch) * 15;
      const ti = ch.style ? toPx(ch.style.textIndent) * 15 : 0;
      const jc = ch.style && /^(center|right|justify)$/.test(ch.style.textAlign) ? `<w:jc w:val="${ch.style.textAlign === 'justify' ? 'both' : ch.style.textAlign}"/>` : '';
      if (HSZ[tag]) { out.push(`<w:p>${ppr({ left }, jc, true)}${inline(ch, { b: 1, sz: HSZ[tag] })}</w:p>`); continue; }
      if (tag === 'HR') { out.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>'); continue; }
      if (tag === 'PRE') { out.push(`<w:p>${ppr({ left })}${inline(ch, { code: 1 }, true)}</w:p>`); continue; }
      if (tag === 'UL' || tag === 'OL') {
        let n = +(ch.getAttribute('start') || 1); const nivel = (ctx.nivel || 0) + 1;
        for (const li of ch.children) {
          if (li.tagName !== 'LI') { bloques(li, ctx, out); continue; }
          const marca = tag === 'OL' ? (n++) + '.' : '•';
          const sub = [], inl = document.createElement('span');
          for (const x of [...li.childNodes]) { if (x.nodeType === 1 && BLOCKS.has(x.tagName)) sub.push(x); else if (!sub.length) inl.appendChild(x.cloneNode(true)); else sub.push(x); }
          // <li><p>texto</p></li> (así lo devuelven muchas IA): el primer párrafo va en la misma línea que la viñeta
          if (!inl.textContent.trim() && sub[0] && sub[0].nodeType === 1 && /^(P|DIV)$/.test(sub[0].tagName) && ![...sub[0].children].some(x => BLOCKS.has(x.tagName))) {
            inl.innerHTML = ''; for (const x of [...sub.shift().childNodes]) inl.appendChild(x.cloneNode(true));
          }
          const l2 = (ctx.left || 0) + 360 * nivel;
          out.push(`<w:p>${ppr({ left: l2, hanging: 300 })}${runs(marca + '\t', {})}${inline(inl, {})}</w:p>`);
          for (const s of sub) { const w = document.createElement('div'); w.appendChild(s.cloneNode(true)); bloques(w, /^(UL|OL)$/.test(s.tagName) ? { left: ctx.left || 0, nivel } : { left: l2 }, out); }
        }
        continue;
      }
      if (tag === 'TABLE') {
        const filas = [...ch.querySelectorAll('tr')].filter(tr => tr.closest('table') === ch);
        if (!filas.length) continue;
        const ncol = Math.max(...filas.map(tr => [...tr.children].reduce((s, td) => s + (+td.getAttribute('colspan') || 1), 0)));
        const w = Math.floor(9000 / Math.max(1, ncol));
        const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join('');
        let t = `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${bd}</w:tblBorders></w:tblPr><w:tblGrid>${('<w:gridCol w:w="' + w + '"/>').repeat(ncol)}</w:tblGrid>`;
        for (const tr of filas) {
          t += '<w:tr>';
          for (const td of tr.children) {
            const span = +td.getAttribute('colspan') || 1, cel = [];
            bloques(td, { st: td.tagName === 'TH' ? { b: 1 } : {} }, cel);
            t += `<w:tc><w:tcPr><w:tcW w:w="${w * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}</w:tcPr>${cel.join('') || '<w:p/>'}</w:tc>`;
          }
          t += '</w:tr>';
        }
        out.push(t + '</w:tbl><w:p/>'); continue;
      }
      if (tag === 'BLOCKQUOTE') { bloques(ch, { left: left + 567, nivel: ctx.nivel }, out); continue; }
      if (tag === 'TR' || tag === 'THEAD' || tag === 'TBODY') { bloques(ch, ctx, out); continue; }
      // P, DIV, LI suelto, etc.
      if ([...ch.children].some(x => BLOCKS.has(x.tagName))) { bloques(ch, Object.assign({}, ctx, { left }), out); continue; }
      const r = inline(ch, ctx.st || {}, ctx.pre);
      out.push(`<w:p>${ppr({ left, first: ti > 0 ? ti : 0, hanging: ti < 0 ? Math.round(-ti) : 0 }, jc)}${r}</w:p>`);
    }
    flush();
  }
  const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files, type) {
    const enc = new TextEncoder(), chunks = [], cd = []; let off = 0;
    const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
      chunks.push(lh, name, data); cd.push({ name, crc, len: data.length, off }); off += lh.length + name.length + data.length;
    }
    const ini = off;
    for (const c of cd) {
      const h = new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c.crc), ...u32(c.len), ...u32(c.len), ...u16(c.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.off)]);
      chunks.push(h, c.name); off += h.length + c.name.length;
    }
    chunks.push(new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(cd.length), ...u16(cd.length), ...u32(off - ini), ...u32(ini), ...u16(0)]));
    return new Blob(chunks, { type });
  }
  function docxDeHtml(el) {
    const out = []; bloques(limpio(el), {}, out);
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'word/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>` },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${out.join('') || '<w:p/>'}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>` }
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  const docxDeTexto = md => docxDeHtml(htmlEl(mdToHtml(md)));

  // ---------- texto tokenizado -> .csv (tablas Markdown como tabla; si no, una línea por fila) ----------
  function textoACsv(md, serialize) {
    const L = String(md || '').replace(/\r\n?/g, '\n').split('\n'), filas = [];
    let hayTabla = false;
    for (let i = 0; i < L.length; i++) {
      if (isTbl(L[i]) && isSep(L[i + 1])) {
        hayTabla = true; if (filas.length) filas.push([]);
        const cells = r => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
        filas.push(cells(L[i])); i += 2;
        while (i < L.length && isTbl(L[i])) filas.push(cells(L[i++]));
        i--;
      }
    }
    if (hayTabla) return serialize(filas[0], filas.slice(1), ';');
    return serialize(['texto'], L.filter(l => l.trim()).map(l => [l]), ';');
  }

  // ---------- menús desplegables (botón ^ y Exportar) ----------
  let menuAbierto = null;
  function cerrarMenu() { if (menuAbierto) { menuAbierto.classList.remove('open'); menuAbierto = null; } }
  function colocarMenu(m, btn) {
    const r = (btn.closest('.split') || btn).getBoundingClientRect();
    m.style.minWidth = Math.max(r.width, 210) + 'px';
    m.classList.add('open');
    const hh = m.offsetHeight, w = m.offsetWidth;
    let top = r.top - hh - 4; if (top < 4) top = Math.min(r.bottom + 4, innerHeight - hh - 4);
    m.style.top = Math.max(4, top) + 'px'; m.style.left = Math.max(4, Math.min(r.right - w, innerWidth - w - 4)) + 'px';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-menu]');
    if (b) { const m = document.getElementById(b.dataset.menu), mismo = menuAbierto === m; cerrarMenu(); if (m && !mismo) { colocarMenu(m, b); menuAbierto = m; } return; }
    if (menuAbierto && (!menuAbierto.contains(e.target) || e.target.closest('button'))) cerrarMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenu(); });
  window.addEventListener('resize', cerrarMenu);
  document.addEventListener('scroll', e => { if (menuAbierto && !menuAbierto.contains(e.target)) cerrarMenu(); }, true);

  // ---------- paneles redimensionables (ancho de columnas y alto IA / resultado) ----------
  function arrastre(g, cursor, inicio, mover, fin) {
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); g.setPointerCapture(e.pointerId); g.classList.add('drag'); document.body.classList.add(cursor);
      const st = inicio(e);
      const mv = ev => mover(ev, st);
      const up = () => { g.classList.remove('drag'); document.body.classList.remove(cursor); g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); fin(st); };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    });
  }
  const guardarPref = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const leerPref = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  function paneles() {
    document.querySelectorAll('main').forEach(main => {
      const key = 'tokia_cols_' + main.id, pan = [...main.children].filter(x => x.classList.contains('panel'));
      const poner = ws => main.style.setProperty('--cols', ws.map(w => `minmax(0,${Math.max(1, Math.round(w))}fr)`).join(' 8px '));
      const s = leerPref(key); if (Array.isArray(s) && s.length === pan.length) poner(s);
      [...main.children].filter(x => x.classList.contains('gut')).forEach((g, i) => {
        arrastre(g, 'arrastrando', e => {
          const ws = pan.map(p => p.getBoundingClientRect().width);
          return { ws, x0: e.clientX, cur: ws };
        }, (ev, st) => {
          const MIN = 220, a = st.ws[i], b = st.ws[i + 1];
          const d = Math.max(MIN - a, Math.min(b - MIN, ev.clientX - st.x0));
          st.cur = st.ws.slice(); st.cur[i] = a + d; st.cur[i + 1] = b - d; poner(st.cur);
        }, st => guardarPref(key, st.cur.map(Math.round)));
        g.addEventListener('dblclick', () => { main.style.removeProperty('--cols'); guardarPref(key, null); });
      });
    });
    document.querySelectorAll('.hgut').forEach(g => {
      const top = document.getElementById(g.dataset.top); if (!top) return;
      const key = 'tokia_h_' + g.dataset.top, ini = top.style.height;
      const h0 = leerPref(key); if (h0) top.style.height = h0 + 'px';
      arrastre(g, 'arrastrando-v', e => ({ y0: e.clientY, h: top.getBoundingClientRect().height, max: g.closest('.panel').getBoundingClientRect().height - 230, cur: null }),
        (ev, st) => { st.cur = Math.max(60, Math.min(Math.max(60, st.max), st.h + ev.clientY - st.y0)); top.style.height = st.cur + 'px'; },
        st => { if (st.cur) guardarPref(key, Math.round(st.cur)); });
      g.addEventListener('dblclick', () => { top.style.height = ini; guardarPref(key, null); });
    });
  }
  paneles();

  // ---------- cajones plegables del panel derecho ----------
  /* arriba «ai» (respuesta de la IA), abajo «rest» (resultado); al inicio solo está abierto «ai» */
  function plegar(panel, k, cerrar) {
    const cj = panel && panel.querySelector(`.cajon[data-k="${k}"]`); if (!cj) return;
    cj.classList.toggle('abierto', cerrar === undefined ? !cj.classList.contains('abierto') : !cerrar);
  }
  document.querySelectorAll('.cajon .cab').forEach(c => c.addEventListener('click', () => { const cj = c.closest('.cajon'); plegar(cj.closest('.panel'), cj.dataset.k); }));
  /* tras pegar la respuesta y destokenizarla: se pliega la entrada y se muestra entero el resultado */
  const verResultado = el => { const p = el && el.closest('.panel'); plegar(p, 'ai', true); plegar(p, 'rest', false); };
  const verEntrada = el => { const p = el && el.closest('.panel'); plegar(p, 'ai', false); plegar(p, 'rest', true); };

  // ---------- tabla -> .xlsx (una hoja, cabecera en negrita e inmovilizada) ----------
  function xlsxDeTabla(header, rows, hoja) {
    const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const letra = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
    const esNum = v => /^-?(0|[1-9]\d{0,14})(,\d{1,10})?$/.test(v);   // enteros y decimales con coma (no «10.30», que puede ser una hora)
    const fila = (r, n, neg) => `<row r="${n}">` + r.map((v, c) => {
      v = v == null ? '' : String(v); if (v === '') return '';
      const ref = letra(c) + n;
      if (!neg && esNum(v)) return `<c r="${ref}"><v>${v.replace(',', '.')}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${neg ? ' s="1"' : ''}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join('') + '</row>';
    const nombre = xe(String(hoja || 'Datos').replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Datos');
    const ancho = header.map((h, c) => Math.min(60, Math.max(8, String(h || '').length + 2, ...rows.slice(0, 200).map(r => String(r[c] == null ? '' : r[c]).length + 1))));
    const MAIN = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const hojaXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${MAIN}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<cols>${ancho.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
      `<sheetData>${[fila(header, 1, true), ...rows.map((r, i) => fila(r, i + 2, false))].join('')}</sheetData></worksheet>`;
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${MAIN} xmlns:r="${REL}"><sheets><sheet name="${nombre}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${MAIN}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
      { name: 'xl/worksheets/sheet1.xml', data: hojaXml }
    ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  window.TokUI = { esc, download, stamp, txtBlob, csvBlob, copyText, copyRich, readClipRich, sanitizeHtml, mdToHtml, htmlEl, pegarEn,
    enlazarPegado, destokenizarDom, limpio, domToText, docxDeHtml, docxDeTexto, textoACsv, xlsxDeTabla, plegar, verResultado, verEntrada };
})();
