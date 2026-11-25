'use strict';
/* TokLector — lectura local de documentos, sin librerías ni conexión (nada sale del equipo):
   · Excel: .xlsx .xlsm (y .ods de LibreOffice Calc; los .xls que en realidad son HTML o texto)
   · Word: .docx .docm (y .odt de LibreOffice Writer)
   · PDF con capa de texto, también los protegidos solo contra copia o impresión (se abren sin contraseña).
   Los PDF escaneados (solo imagen) no tienen texto: necesitarían OCR. */
(function (root) {

  // ---------- utilidades ----------
  const U8 = Uint8Array, utf8 = new TextDecoder('utf-8');
  const concat = (...as) => { let n = 0; for (const a of as) n += a.length; const o = new U8(n); let p = 0; for (const a of as) { o.set(a, p); p += a.length; } return o; };
  const bytes = s => { const o = new U8(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 255; return o; };
  const latin = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return s; };
  const deCodigos = a => { let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.slice(i, i + 8192)); return s; };
  const fallo = m => { const e = new Error(m); e.usuario = true; return e; };
  const ext = n => (String(n || '').split('.').pop() || '').toLowerCase();
  function decodificar(u) {
    if (u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF) return utf8.decode(u.subarray(3));
    if (u[0] === 0xFF && u[1] === 0xFE) return new TextDecoder('utf-16le').decode(u);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u); } catch (_) { return new TextDecoder('windows-1252').decode(u); }
  }

  // ---------- DEFLATE (dentro de los .xlsx/.docx y de los PDF) ----------
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const CLORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function huffman(lens) {
    let max = 0; for (let i = 0; i < lens.length; i++) if (lens[i] > max) max = lens[i];
    if (!max) return { t: null, max: 0 };
    const cnt = new Uint16Array(16), next = new Uint16Array(16);
    for (let i = 0; i < lens.length; i++) cnt[lens[i]]++;
    cnt[0] = 0;
    for (let b = 1, code = 0; b < 16; b++) { code = (code + cnt[b - 1]) << 1; next[b] = code; }
    const t = new Int32Array(1 << max).fill(-1);
    for (let i = 0; i < lens.length; i++) {
      const L = lens[i]; if (!L) continue;
      let c = next[L]++, r = 0;
      for (let k = 0; k < L; k++) { r = (r << 1) | (c & 1); c >>= 1; }
      for (let k = r; k < t.length; k += 1 << L) t[k] = (i << 4) | L;
    }
    return { t, max };
  }
  let FIJAS = null;
  function fijas() {
    if (!FIJAS) { const l = new U8(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288); FIJAS = [huffman(l), huffman(new U8(30).fill(5))]; }
    return FIJAS;
  }
  /* deflate «crudo»; si los datos vienen truncados o dañados devuelve lo que se haya podido recuperar */
  function inflar(src) {
    let pos = 0, bit = 0, nb = 0, extra = 0, out = new U8(Math.max(4096, src.length * 3)), op = 0;
    const crece = n => { if (op + n <= out.length) return; let l = out.length * 2; while (l < op + n) l *= 2; const o = new U8(l); o.set(out.subarray(0, op)); out = o; };
    const carga = n => { while (nb < n) { if (pos < src.length) bit |= src[pos] << nb; else if (++extra > 4) throw fallo('datos comprimidos incompletos'); pos++; nb += 8; } };
    const bits = n => { carga(n); const v = bit & ((1 << n) - 1); bit >>>= n; nb -= n; return v; };
    const sim = h => {
      if (!h.t) throw fallo('código no válido');
      carga(h.max); const e = h.t[bit & ((1 << h.max) - 1)]; if (e < 0) throw fallo('código no válido');
      const L = e & 15; bit >>>= L; nb -= L; return e >> 4;
    };
    try {
      for (let fin = 0; !fin;) {
        fin = bits(1); const tipo = bits(2);
        if (tipo === 0) {
          pos -= nb >> 3; bit = 0; nb = 0;
          if (pos + 4 > src.length) break;
          const len = src[pos] | (src[pos + 1] << 8); pos += 4;
          const n = Math.min(len, src.length - pos); crece(n); out.set(src.subarray(pos, pos + n), op); op += n; pos += n;
          if (n < len) break;
        } else if (tipo === 3) throw fallo('bloque no válido');
        else {
          let lt, dt;
          if (tipo === 1) [lt, dt] = fijas();
          else {
            const hl = bits(5) + 257, hd = bits(5) + 1, hc = bits(4) + 4, cl = new U8(19);
            for (let i = 0; i < hc; i++) cl[CLORD[i]] = bits(3);
            const ct = huffman(cl), lens = new U8(hl + hd);
            for (let i = 0; i < hl + hd;) {
              const s = sim(ct);
              if (s < 16) { lens[i++] = s; continue; }
              let rep, v = 0;
              if (s === 16) { if (!i) throw fallo('longitudes no válidas'); v = lens[i - 1]; rep = 3 + bits(2); }
              else rep = s === 17 ? 3 + bits(3) : 11 + bits(7);
              while (rep-- > 0 && i < hl + hd) lens[i++] = v;
            }
            lt = huffman(lens.subarray(0, hl)); dt = huffman(lens.subarray(hl));
          }
          for (;;) {
            const s = sim(lt);
            if (s < 256) { if (op >= out.length) crece(1); out[op++] = s; }
            else if (s === 256) break;
            else {
              const li = s - 257; if (li > 28) throw fallo('longitud no válida');
              const len = LBASE[li] + bits(LEXT[li]), di = sim(dt); if (di > 29) throw fallo('distancia no válida');
              const d = DBASE[di] + bits(DEXT[di]); if (d > op) throw fallo('distancia no válida');
              crece(len); for (let k = 0; k < len; k++, op++) out[op] = out[op - d];
            }
          }
        }
      }
    } catch (e) { if (!op) throw e; }
    return out.subarray(0, op);
  }
  function inflarZlib(u) {
    if (u.length > 2 && (u[0] & 15) === 8 && ((u[0] << 8) | u[1]) % 31 === 0) return inflar(u.subarray(u[1] & 32 ? 6 : 2));
    return inflar(u);
  }

  // ---------- ZIP (contenedor de .xlsx .docx .ods .odt) ----------
  function abrirZip(u) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), arch = new Map();
    let fin = -1;
    for (let i = u.length - 22; i >= 0 && i >= u.length - 65600; i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    if (fin < 0) throw fallo('el archivo no es un documento de Office válido o está dañado');
    let p = dv.getUint32(fin + 16, true);
    const n = dv.getUint16(fin + 10, true);
    for (let k = 0; k < n && p + 46 <= u.length && dv.getUint32(p, true) === 0x02014b50; k++) {
      const fl = dv.getUint16(p + 8, true), met = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true),
        ln = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const nombre = utf8.decode(u.subarray(p + 46, p + 46 + ln));
      arch.set(nombre.toLowerCase(), { nombre, fl, met, cs, off });
      p += 46 + ln + lx + lc;
    }
    const datos = nombre => {
      const f = arch.get(String(nombre).replace(/^\//, '').toLowerCase()); if (!f) return null;
      if (f.fl & 1) throw fallo('el documento está protegido con contraseña: ábrelo y guárdalo sin contraseña');
      const q = f.off; if (q + 30 > u.length || dv.getUint32(q, true) !== 0x04034b50) throw fallo('el documento está dañado');
      const ini = q + 30 + dv.getUint16(q + 26, true) + dv.getUint16(q + 28, true), d = u.subarray(ini, ini + f.cs);
      if (f.met === 0) return d;
      if (f.met === 8) return inflar(d);
      throw fallo('el documento usa una compresión no admitida');
    };
    return { datos, texto: nm => { const d = datos(nm); return d ? utf8.decode(d) : null; }, nombres: () => [...arch.values()].map(f => f.nombre) };
  }

  // ---------- XML ----------
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const desc = s => s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, k) => {
    if (k[0] !== '#') return ENT[k] !== undefined ? ENT[k] : m;
    const c = k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    try { return String.fromCodePoint(c); } catch (_) { return ''; }
  });
  const escX = s => s.indexOf('_x') < 0 ? s : s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  const sinNs = s => s.replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1');
  const atr = (s, n) => { const m = new RegExp('\\s' + n + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')').exec(' ' + s); return m ? desc(m[1] != null ? m[1] : m[2]) : null; };
  const dom = s => {
    const d = new DOMParser().parseFromString(s || '<x/>', 'application/xml');
    if (d.getElementsByTagName('parsererror').length && !d.documentElement.children.length) throw fallo('el contenido del documento está dañado');
    return d;
  };
  const hijo = (el, n) => { for (const c of el.children) if (c.localName === n) return c; return null; };
  const val = (el, n) => { const c = el && hijo(el, n); return c ? (c.getAttribute('w:val') || '') : null; };

  // ---------- tablas: de filas sueltas a cabecera + filas ----------
  /* fila de títulos: la primera bastante llena, o la indicada en «forzar» (índice entre las filas no vacías) */
  function aTabla(filas, forzar) {
    filas = (filas || []).map(f => (f || []).map(c => (c == null ? '' : String(c)).replace(/\r\n?/g, '\n').trim()));
    filas = filas.filter(f => f.some(c => c !== ''));
    if (!filas.length) return { header: [], rows: [], sep: ';', hi: 0 };
    const llenas = f => { let n = 0; for (const c of f) if (c !== '') n++; return n; };
    const max = Math.max(...filas.slice(0, 30).map(llenas));
    const hi = forzar != null ? Math.max(0, Math.min(+forzar || 0, filas.length - 1))
      : Math.max(0, filas.slice(0, 30).findIndex(f => llenas(f) >= Math.max(2, Math.ceil(max * 0.6))));
    const cuerpo = filas.slice(hi), ancho = Math.max(...cuerpo.map(f => f.length)), vivas = [];
    for (let c = 0; c < ancho; c++) if (cuerpo.some(f => (f[c] || '') !== '')) vivas.push(c);
    const header = vivas.map((c, k) => (filas[hi][c] || '').replace(/\s*\n\s*/g, ' ') || 'Columna ' + (k + 1));
    const rows = cuerpo.slice(1).map(f => vivas.map(c => f[c] || ''));
    return { header, rows, sep: ';', hi, titulo: filas.slice(0, hi).map(f => f.filter(Boolean).join(' ')).join(' · ') };
  }
  function tablaMd(filas) {
    const t = Array.isArray(filas) ? aTabla(filas) : filas;
    if (!t.header.length) return '';
    const c = v => String(v || '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' / ').trim();
    return ['| ' + t.header.map(c).join(' | ') + ' |', '|' + ' --- |'.repeat(t.header.length), ...t.rows.map(r => '| ' + t.header.map((_, i) => c(r[i])).join(' | ') + ' |')].join('\n');
  }

  // ---------- Excel (.xlsx) ----------
  const colIdx = s => { let n = 0; for (let i = 0; i < s.length; i++) n = n * 26 + s.charCodeAt(i) - 64; return n - 1; };
  const textoSi = x => { x = x.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''); let o = ''; for (const m of x.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) o += m[1] || ''; return escX(desc(o)); };
  const p2 = n => String(n).padStart(2, '0');
  function fechaExcel(v, tipo, d1904) {
    if (tipo === 'h') { const t = Math.round(v * 86400), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${p2(h)}:${p2(m)}` + (s ? ':' + p2(s) : ''); }
    const t = new Date(Math.round((v + (d1904 ? 1462 : 0) - 25569) * 86400) * 1000);
    const F = `${p2(t.getUTCDate())}/${p2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
    if (tipo === 'fh' && Math.abs(v % 1) > 1e-9) return F + ` ${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}` + (t.getUTCSeconds() ? ':' + p2(t.getUTCSeconds()) : '');
    return F;
  }
  function tipoFormato(id, fmts) {
    if ((id >= 14 && id <= 17) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) return 'f';
    if ((id >= 18 && id <= 21) || (id >= 45 && id <= 47)) return 'h';
    if (id === 22) return 'fh';
    const c = fmts[id]; if (!c) return '';
    const s = c.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[(?![hms]+\])[^\]]*\]/gi, '').replace(/general/gi, '');
    const f = /[dy]/i.test(s), h = /[hs]/i.test(s);
    if (f && h) return 'fh'; if (f) return 'f'; if (h) return 'h';
    return /m/i.test(s) && !/[0#?]/.test(s) ? 'f' : '';
  }
  const numero = (v, pct) => {
    const n = +v; if (v === '' || !isFinite(n)) return v;
    return pct ? String(+(n * 100).toPrecision(12)).replace('.', ',') + '%' : String(+n.toPrecision(15)).replace('.', ',');
  };
  const isoFecha = v => { const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(v); return m ? `${m[3]}/${m[2]}/${m[1]}` + (m[4] && (m[4] !== '00' || m[5] !== '00') ? ` ${m[4]}:${m[5]}` : '') : v; };
  const densa = filas => { const o = []; for (let i = 0; i < filas.length; i++) { const f = filas[i] || [], r = new Array(f.length); for (let j = 0; j < f.length; j++) r[j] = f[j] == null ? '' : String(f[j]); o.push(r); } return o; };
  function leerXlsx(z) {
    const wb = sinNs(z.texto('xl/workbook.xml') || '');
    if (!wb) throw fallo('no se encuentra el libro dentro del archivo de Excel');
    const rels = {};
    for (const m of (z.texto('xl/_rels/workbook.xml.rels') || '').matchAll(/<(?:\w+:)?Relationship\b([^>]*)>/g)) rels[atr(m[1], 'Id')] = atr(m[1], 'Target');
    const d1904 = /<workbookPr\b[^>]*date1904\s*=\s*["'](1|true)["']/i.test(wb);
    const ss = [], sst = z.texto('xl/sharedStrings.xml');
    if (sst) for (const m of sinNs(sst).matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) ss.push(m[1] ? textoSi(m[1]) : '');
    const st = sinNs(z.texto('xl/styles.xml') || ''), fmts = {}, xfs = [];
    for (const m of st.matchAll(/<numFmt\b([^>]*?)\/?>/g)) fmts[+atr(m[1], 'numFmtId')] = atr(m[1], 'formatCode') || '';
    const cx = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st);
    if (cx) for (const m of cx[1].matchAll(/<xf\b([^>]*?)\/?>/g)) {
      const id = +atr(m[1], 'numFmtId') || 0, code = (fmts[id] || '').replace(/"[^"]*"/g, '');
      xfs.push({ t: tipoFormato(id, fmts), pct: id === 9 || id === 10 || /%/.test(code) });
    }
    const hojas = [];
    for (const m of wb.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
      const t = rels[atr(m[1], 'r:id')]; if (!t) continue;
      const ruta = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
      hojas.push({ nombre: atr(m[1], 'name') || 'Hoja ' + (hojas.length + 1), oculta: /hidden/i.test(atr(m[1], 'state') || ''), filas: celdasXlsx(sinNs(z.texto(ruta) || ''), ss, xfs, d1904) });
    }
    return hojas;
  }
  function celdasXlsx(x, ss, xfs, d1904) {
    const filas = [], i0 = x.indexOf('<sheetData'); if (i0 < 0) return filas;
    const i1 = x.lastIndexOf('</sheetData>'), cuerpo = x.slice(i0, i1 > i0 ? i1 : x.length);
    let ra = 0;
    for (const rm of cuerpo.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rr = /\sr\s*=\s*["'](\d+)["']/.exec(' ' + rm[1]), ri = rr ? +rr[1] - 1 : ra; ra = ri + 1;
      if (!rm[2] || ri > 1048576) continue;
      const fila = []; let ca = 0;
      for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = ' ' + cm[1], ref = /\sr\s*=\s*["']([A-Z]+)/.exec(a), ci = ref ? colIdx(ref[1]) : ca; ca = ci + 1;
        const cc = cm[2]; if (!cc || ci > 16384) continue;
        const t = (/\st\s*=\s*["'](\w+)["']/.exec(a) || [])[1] || 'n';
        let v;
        if (t === 'inlineStr') { const is = /<is\b[^>]*>([\s\S]*?)<\/is>/.exec(cc); v = is ? textoSi(is[1]) : ''; }
        else {
          const vm = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cc); if (!vm) continue;
          v = desc(vm[1]);
          if (t === 's') v = ss[+v] != null ? ss[+v] : '';
          else if (t === 'b') v = v === '1' ? 'VERDADERO' : 'FALSO';
          else if (t === 'str' || t === 'e') v = escX(v);
          else if (t === 'd') v = isoFecha(v);
          else {
            const s = (/\ss\s*=\s*["'](\d+)["']/.exec(a) || [])[1], xf = s != null ? xfs[+s] : null;
            v = xf && xf.t && v !== '' && isFinite(+v) ? fechaExcel(+v, xf.t, d1904) : numero(v, xf && xf.pct);
          }
        }
        fila[ci] = v;
      }
      filas[ri] = fila;
    }
    return densa(filas);
  }

  // ---------- LibreOffice (.ods / .odt) ----------
  function textoOdf(el) {
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { s += n.nodeValue; continue; }
      if (n.nodeType !== 1) continue;
      const l = n.localName;
      if (l === 's') s += ' '.repeat(Math.min(+n.getAttribute('text:c') || 1, 200));
      else if (l === 'tab') s += '\t';
      else if (l === 'line-break') s += '\n';
      else if (l === 'note' || l === 'annotation' || l === 'annotation-end' || l === 'tracked-changes' || l === 'deletion') continue;
      else if (l === 'p' || l === 'h') s += (s ? '\n' : '') + textoOdf(n);
      else s += textoOdf(n);
    }
    return s;
  }
  function filasOdf(tb, celdaTxt) {
    const filas = []; let vacias = 0;
    const rec = el => {
      for (const tr of el.children) {
        const l = tr.localName;
        if (l === 'table-header-rows' || l === 'table-rows' || l === 'table-row-group') { rec(tr); continue; }
        if (l !== 'table-row') continue;
        const rep = Math.max(1, Math.min(+tr.getAttribute('table:number-rows-repeated') || 1, 100000));
        const fila = []; let pend = 0;
        for (const tc of tr.children) {
          if (tc.localName !== 'table-cell' && tc.localName !== 'covered-table-cell') continue;
          const n = Math.max(1, Math.min(+tc.getAttribute('table:number-columns-repeated') || 1, 16384));
          const v = celdaTxt(tc).trim();
          if (!v) { pend += n; continue; }
          for (; pend > 0; pend--) fila.push('');
          for (let k = 0; k < Math.min(n, 1000); k++) fila.push(v);
          const sp = +tc.getAttribute('table:number-columns-spanned') || 1;
          for (let k = 1; k < sp; k++) fila.push('');
        }
        if (!fila.length) { vacias += rep; continue; }
        for (let k = 0; k < Math.min(vacias, 100000); k++) filas.push([]);
        vacias = 0;
        for (let k = 0; k < Math.min(rep, 10000); k++) filas.push(fila);
      }
    };
    rec(tb);
    return filas;
  }
  function leerOds(z) {
    const d = dom(z.texto('content.xml')), hojas = [];
    for (const tb of d.getElementsByTagNameNS('*', 'table')) {
      if (tb.parentElement && tb.parentElement.closest && tb.parentElement.closest('table-cell')) continue;
      hojas.push({ nombre: tb.getAttribute('table:name') || 'Hoja ' + (hojas.length + 1), filas: filasOdf(tb, textoOdf) });
    }
    return hojas;
  }
  function leerOdt(z) {
    const d = dom(z.texto('content.xml')), out = [], tablas = [];
    const cuerpo = [...d.getElementsByTagNameNS('*', 'body')][0];
    const raiz = cuerpo && [...cuerpo.children].find(c => c.localName === 'text');
    if (!raiz) return { texto: '', tablas };
    const blanco = () => { if (out.length && out[out.length - 1] !== '') out.push(''); };
    const item = (it, nv) => {
      let primero = true;
      for (const c of it.children) {
        if (c.localName === 'p' || c.localName === 'h') { const t = textoOdf(c).trim(); if (t) { out.push('  '.repeat(nv) + (primero ? '- ' : '  ') + t); primero = false; } }
        else if (c.localName === 'list') { for (const s of c.children) if (s.localName === 'list-item' || s.localName === 'list-header') item(s, nv + 1); }
        else bloque(c, nv + 1);
      }
    };
    const bloque = (el, nv) => {
      for (const c of el.children) {
        const l = c.localName;
        if (l === 'p') out.push(textoOdf(c).replace(/\s+$/, ''));
        else if (l === 'h') { blanco(); out.push('#'.repeat(Math.min(6, Math.max(1, +c.getAttribute('text:outline-level') || 1))) + ' ' + textoOdf(c).trim()); }
        else if (l === 'list') { for (const it of c.children) if (it.localName === 'list-item' || it.localName === 'list-header') item(it, nv); }
        else if (l === 'table') {
          const filas = filasOdf(c, textoOdf), n = Math.max(0, ...filas.map(f => f.length));
          if (n < 2) { for (const f of filas) for (const x of String(f[0] || '').split('\n')) out.push(x); continue; }
          tablas.push(filas); blanco(); out.push(tablaMd(filas)); out.push('');
        }
        else if (l === 'tracked-changes' || l === 'sequence-decls' || l === 'variable-decls' || l === 'user-field-decls' || l === 'forms') continue;
        else bloque(c, nv);
      }
    };
    bloque(raiz, 0);
    return { texto: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), tablas };
  }

  // ---------- Word (.docx) ----------
  const ENVOLT = new Set(['sdt', 'sdtContent', 'customXml', 'smartTag', 'ins', 'moveTo', 'hyperlink']);
  const SALTAR = new Set(['pPr', 'rPr', 'del', 'delText', 'instrText', 'delInstrText', 'moveFrom', 'Fallback', 'fldData', 'footnoteReference',
    'endnoteReference', 'commentReference', 'annotationRef', 'sectPr', 'tblPr', 'trPr', 'tcPr', 'sdtPr', 'sdtEndPr', 'proofErr', 'bookmarkStart', 'bookmarkEnd']);
  function numeracionDocx(x) {
    const r = {}; if (!x) return r;
    const d = dom(x), abs = {};
    for (const a of d.getElementsByTagNameNS('*', 'abstractNum')) {
      const niv = [];
      for (const l of a.getElementsByTagNameNS('*', 'lvl')) niv[+l.getAttribute('w:ilvl') || 0] = { fmt: val(l, 'numFmt') || 'decimal', txt: val(l, 'lvlText'), start: val(l, 'start') != null ? +val(l, 'start') : 1 };
      abs[a.getAttribute('w:abstractNumId')] = niv;
    }
    for (const n of d.getElementsByTagNameNS('*', 'num')) {
      const base = abs[val(n, 'abstractNumId')]; if (!base) continue;
      const niv = base.map(x => x && Object.assign({}, x));
      for (const o of n.getElementsByTagNameNS('*', 'lvlOverride')) { const i = +o.getAttribute('w:ilvl') || 0, so = val(o, 'startOverride'); if (so != null && niv[i]) niv[i].start = +so; }
      r[n.getAttribute('w:numId')] = niv;
    }
    return r;
  }
  function estilosDocx(x) {
    const r = { tit: {}, num: {} }; if (!x) return r;
    for (const s of dom(x).getElementsByTagNameNS('*', 'style')) {
      const id = s.getAttribute('w:styleId'); if (!id) continue;
      const nombre = (val(s, 'name') || '').toLowerCase(), m = /^(?:heading|t[ií]tulo|encabezado)\s*(\d)$/.exec(nombre);
      const ppr = hijo(s, 'pPr'), ol = ppr && val(ppr, 'outlineLvl');
      if (m) r.tit[id] = +m[1]; else if (/^(title|t[ií]tulo)$/.test(nombre)) r.tit[id] = 1; else if (ol != null && +ol < 6) r.tit[id] = +ol + 1;
      const np = ppr && hijo(ppr, 'numPr'); if (np && val(np, 'numId')) r.num[id] = { id: val(np, 'numId'), lv: +(val(np, 'ilvl') || 0) };
    }
    return r;
  }
  const ROM = n => { let s = ''; for (const [v, l] of [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) while (n >= v) { s += l; n -= v; } return s; };
  const LET = n => { let s = ''; while (n > 0) { s = String.fromCharCode(97 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; };
  function fmtNum(n, f) {
    if (f === 'lowerLetter') return LET(n); if (f === 'upperLetter') return LET(n).toUpperCase();
    if (f === 'lowerRoman') return ROM(n); if (f === 'upperRoman') return ROM(n).toUpperCase();
    if (f === 'ordinal') return n + 'º'; if (f === 'decimalZero') return p2(n);
    return String(n);
  }
  function leerDocx(z) {
    const xml = z.texto('word/document.xml'); if (!xml) throw fallo('no se encuentra el texto dentro del documento de Word');
    const doc = dom(xml), num = numeracionDocx(z.texto('word/numbering.xml')), est = estilosDocx(z.texto('word/styles.xml'));
    const body = doc.getElementsByTagNameNS('*', 'body')[0], out = [], tablas = [], cont = {};
    if (!body) return { texto: '', tablas };
    const hijos = (el, n) => { const r = []; for (const c of el.children) { if (c.localName === n) r.push(c); else if (ENVOLT.has(c.localName)) r.push(...hijos(c, n)); } return r; };
    const textoP = (p, cajas) => {
      let s = '';
      const rec = n => {
        for (const c of n.children) {
          const l = c.localName;
          if (l === 't') s += c.textContent;
          else if (l === 'tab' || l === 'ptab') s += '\t';
          else if (l === 'br' || l === 'cr') s += '\n';
          else if (l === 'noBreakHyphen') s += '-';
          else if (l === 'sym') { const k = parseInt(c.getAttribute('w:char') || '', 16); if (k && k < 0xF000) s += String.fromCharCode(k); }
          else if (l === 'txbxContent') cajas.push(c);
          else if (!SALTAR.has(l)) rec(c);
        }
      };
      rec(p); return s;
    };
    const prefijo = p => {
      const pPr = hijo(p, 'pPr'); if (!pPr) return '';
      const sid = val(pPr, 'pStyle') || '', ol = val(pPr, 'outlineLvl');
      const niv = ol != null ? +ol + 1 : (est.tit[sid] || 0);
      if (niv > 0 && niv <= 6) return '#'.repeat(niv) + ' ';
      const np = hijo(pPr, 'numPr');
      let id = np ? val(np, 'numId') : null, lv = np ? +(val(np, 'ilvl') || 0) : 0;
      if (!np && est.num[sid]) ({ id, lv } = est.num[sid]);
      if (!id || id === '0' || !num[id]) return '';
      const def = num[id], L = def[lv] || { fmt: 'bullet' }, c = cont[id] || (cont[id] = []);
      c[lv] = (c[lv] == null ? (L.start != null ? L.start : 1) - 1 : c[lv]) + 1; c.length = lv + 1;
      const sang = '  '.repeat(lv);
      if (L.fmt === 'bullet') return sang + '- ';
      if (L.fmt === 'none') return sang;
      const t = (L.txt || '%' + (lv + 1) + '.').replace(/%(\d)/g, (m, k) => { const i = +k - 1, Li = def[i] || {}; return fmtNum(c[i] != null ? c[i] : (Li.start || 1), Li.fmt || 'decimal'); });
      return sang + t + ' ';
    };
    const filasTabla = tb => {
      const filas = [];
      for (const tr of hijos(tb, 'tr')) {
        const f = [];
        for (const tc of hijos(tr, 'tc')) {
          const partes = [];
          const celda = el => {
            for (const c of el.children) {
              const l = c.localName;
              if (l === 'p') { const cj = [], t = textoP(c, cj).trim(); if (t) partes.push(t); cj.forEach(celda); }
              else if (l === 'tbl') for (const r of filasTabla(c)) { const t = r.filter(Boolean).join(' · '); if (t) partes.push(t); }
              else if (ENVOLT.has(l)) celda(c);
            }
          };
          celda(tc); f.push(partes.join('\n'));
          const tcPr = hijo(tc, 'tcPr'), gs = tcPr && val(tcPr, 'gridSpan');
          for (let k = 1; k < (+gs || 1); k++) f.push('');
        }
        filas.push(f);
      }
      return filas;
    };
    const bloque = el => {
      for (const c of el.children) {
        const l = c.localName;
        if (l === 'p') {
          const cajas = [], t = textoP(c, cajas), pre = prefijo(c);
          if (pre.startsWith('#') && t.trim() && out.length && out[out.length - 1] !== '') out.push('');
          out.push(t.trim() ? (pre ? pre + t.trim() : t.replace(/\s+$/, '')) : '');
          cajas.forEach(bloque);
        } else if (l === 'tbl') {
          const filas = filasTabla(c), n = Math.max(0, ...filas.map(f => f.length));
          if (!filas.length) continue;
          if (n < 2) { for (const f of filas) for (const x of String(f[0] || '').split('\n')) out.push(x); continue; }
          tablas.push(filas);
          if (out.length && out[out.length - 1] !== '') out.push('');
          out.push(tablaMd(filas)); out.push('');
        } else if (ENVOLT.has(l)) bloque(c);
      }
    };
    bloque(body);
    return { texto: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), tablas };
  }

  // ---------- tablas HTML (.xls exportados por muchas aplicaciones) ----------
  function tablasHtml(t) {
    const d = new DOMParser().parseFromString(t, 'text/html'), hojas = [];
    d.querySelectorAll('table').forEach((tb, i) => {
      const filas = [];
      tb.querySelectorAll('tr').forEach(tr => {
        const f = [];
        tr.querySelectorAll('th,td').forEach(td => { f.push((td.textContent || '').replace(/\s+/g, ' ').trim()); for (let k = 1; k < (+td.getAttribute('colspan') || 1); k++) f.push(''); });
        filas.push(f);
      });
      if (filas.length) hojas.push({ nombre: 'Tabla ' + (i + 1), filas });
    });
    return hojas;
  }

  // =====================================================================
  //  PDF
  // =====================================================================
  const BL = new U8(256), DE = new U8(256), HX = new Int8Array(256).fill(-1);
  for (const c of [0, 9, 10, 12, 13, 32]) BL[c] = 1;
  for (const c of '()<>[]{}/%') DE[c.charCodeAt(0)] = 1;
  for (let i = 0; i < 10; i++) HX[48 + i] = i;
  for (let i = 0; i < 6; i++) { HX[65 + i] = 10 + i; HX[97 + i] = 10 + i; }
  const hx = c => (c === undefined ? -1 : HX[c]);
  const FIN = { fin: 1 }, AD = { ad: 1 }, CD = { cd: 1 }, AA = { aa: 1 }, CA = { ca: 1 };
  /* referencia «n g R» a otro objeto (tipo propio: un diccionario puede tener una clave /R, como el de cifrado) */
  function Ref(n, g) { this.n = n; this.g = g; }

  function Lexer(b, p) { this.b = b; this.p = p || 0; }
  Lexer.prototype.tok = function () {
    const b = this.b, n = b.length; let p = this.p;
    for (;;) { while (p < n && BL[b[p]]) p++; if (b[p] === 37) { while (p < n && b[p] !== 10 && b[p] !== 13) p++; continue; } break; }
    if (p >= n) { this.p = p; return FIN; }
    const c = b[p];
    if (c === 47) {
      p++; let s = '';
      while (p < n && !BL[b[p]] && !DE[b[p]]) {
        if (b[p] === 35 && hx(b[p + 1]) >= 0 && hx(b[p + 2]) >= 0) { s += String.fromCharCode(hx(b[p + 1]) * 16 + hx(b[p + 2])); p += 3; }
        else s += String.fromCharCode(b[p++]);
      }
      this.p = p; return { N: s };
    }
    if (c === 40) { this.p = p; return { S: this.lit() }; }
    if (c === 60) { if (b[p + 1] === 60) { this.p = p + 2; return AD; } this.p = p; return { S: this.hex() }; }
    if (c === 62) { this.p = p + (b[p + 1] === 62 ? 2 : 1); return CD; }
    if (c === 91) { this.p = p + 1; return AA; }
    if (c === 93) { this.p = p + 1; return CA; }
    if (DE[c]) { this.p = p + 1; return { K: String.fromCharCode(c) }; }
    const i0 = p; while (p < n && !BL[b[p]] && !DE[b[p]]) p++;
    this.p = p;
    let s = ''; for (let i = i0; i < p; i++) s += String.fromCharCode(b[i]);
    if ((c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46) { const v = parseFloat(s); return isNaN(v) ? 0 : v; }
    return { K: s };
  };
  Lexer.prototype.lit = function () {
    const b = this.b, n = b.length, o = []; let p = this.p + 1, d = 1;
    while (p < n) {
      let c = b[p++];
      if (c === 92) {
        c = b[p++];
        if (c === 110) o.push(10); else if (c === 114) o.push(13); else if (c === 116) o.push(9); else if (c === 98) o.push(8); else if (c === 102) o.push(12);
        else if (c === 13) { if (b[p] === 10) p++; }
        else if (c === 10) { /* continuación de línea */ }
        else if (c >= 48 && c <= 55) { let v = c - 48; if (b[p] >= 48 && b[p] <= 55) { v = v * 8 + b[p++] - 48; if (b[p] >= 48 && b[p] <= 55) v = v * 8 + b[p++] - 48; } o.push(v & 255); }
        else if (c !== undefined) o.push(c);
      } else if (c === 40) { d++; o.push(c); }
      else if (c === 41) { if (!--d) break; o.push(c); }
      else o.push(c);
    }
    this.p = p; return deCodigos(o);
  };
  Lexer.prototype.hex = function () {
    const b = this.b, n = b.length, o = []; let p = this.p + 1, h = -1;
    while (p < n && b[p] !== 62) { const v = hx(b[p++]); if (v < 0) continue; if (h < 0) h = v; else { o.push(h * 16 + v); h = -1; } }
    if (h >= 0) o.push(h * 16);
    this.p = p + 1; return deCodigos(o);
  };
  Lexer.prototype.val = function (t, refs) {
    if (t === AD) {
      const d = Object.create(null);   // sin prototipo: un PDF puede traer claves como «constructor»
      for (;;) {
        const k = this.tok(); if (k === CD || k === FIN) break;
        if (k.N === undefined) continue;
        const v = this.tok(); if (v === CD) break;
        d[k.N] = this.val(v, refs);
      }
      return d;
    }
    if (t === AA) { const a = []; for (;;) { const x = this.tok(); if (x === CA || x === FIN) break; a.push(this.val(x, refs)); } return a; }
    if (refs && typeof t === 'number' && t >= 0 && t % 1 === 0) {
      const p0 = this.p, g = this.tok();
      if (typeof g === 'number' && g % 1 === 0) { const r = this.tok(); if (r.K === 'R') return new Ref(t, g); }
      this.p = p0;
    }
    return t;
  };
  Lexer.prototype.saltarImagen = function () {   // BI <parámetros> ID <datos binarios> EI
    for (;;) { const t = this.tok(); if (t === FIN) return; if (t.K === 'ID') break; }
    const b = this.b; let p = this.p + 1;
    for (; p + 2 < b.length; p++) if (b[p] === 69 && b[p + 1] === 73 && BL[b[p - 1]] && BL[b[p + 2]]) break;
    this.p = p + 2;
  };

  // ---------- filtros de los flujos ----------
  function predictor(d, prm, R) {
    const P = +R(prm.Predictor) || 1; if (P < 2) return d;
    const cols = +R(prm.Columns) || 1, colors = +R(prm.Colors) || 1, bpc = +R(prm.BitsPerComponent) || 8;
    if (P === 2) { if (bpc !== 8) return d; const o = d.slice(), rl = cols * colors; for (let i = 0; i < o.length; i++) if (i % rl >= colors) o[i] = (o[i] + o[i - colors]) & 255; return o; }
    const bpp = Math.max(1, Math.ceil(colors * bpc / 8)), rl = Math.ceil(cols * colors * bpc / 8), filas = Math.floor(d.length / (rl + 1));
    const out = new U8(filas * rl); let prev = new U8(rl);
    for (let r = 0; r < filas; r++) {
      const t = d[r * (rl + 1)], src = d.subarray(r * (rl + 1) + 1, (r + 1) * (rl + 1)), cur = out.subarray(r * rl, (r + 1) * rl);
      for (let i = 0; i < rl; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        let v = src[i];
        if (t === 1) v += a; else if (t === 2) v += b; else if (t === 3) v += (a + b) >> 1;
        else if (t === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        cur[i] = v & 255;
      }
      prev = cur;
    }
    return out;
  }
  function lzw(d, early) {
    early = early === 0 ? 0 : 1;
    const out = []; let dict, bits = 9, buf = 0, nb = 0, prev = null, i = 0;
    const reset = () => { dict = []; for (let k = 0; k < 256; k++) dict.push([k]); dict.push(null, null); bits = 9; };
    reset();
    for (;;) {
      while (nb < bits && i < d.length) { buf = ((buf << 8) | d[i++]) & 0xFFFFFF; nb += 8; }
      if (nb < bits) break;
      const code = (buf >>> (nb - bits)) & ((1 << bits) - 1); nb -= bits;
      if (code === 256) { reset(); prev = null; continue; }
      if (code === 257) break;
      let e;
      if (code < dict.length && dict[code]) e = dict[code]; else if (prev) e = prev.concat(prev[0]); else break;
      for (const x of e) out.push(x);
      if (prev) dict.push(prev.concat(e[0]));
      prev = e;
      if (dict.length + early >= (1 << bits) && bits < 12) bits++;
    }
    return U8.from(out);
  }
  function a85(d) {
    const out = []; let t = 0, n = 0, i = 0;
    if (d[0] === 60 && d[1] === 126) i = 2;
    for (; i < d.length; i++) {
      const c = d[i]; if (BL[c]) continue; if (c === 126) break;
      if (c === 122 && n === 0) { out.push(0, 0, 0, 0); continue; }
      if (c < 33 || c > 117) continue;
      t = t * 85 + (c - 33); n++;
      if (n === 5) { out.push((t >>> 24) & 255, (t >>> 16) & 255, (t >>> 8) & 255, t & 255); t = 0; n = 0; }
    }
    if (n > 1) { for (let k = n; k < 5; k++) t = t * 85 + 84; out.push(...[(t >>> 24) & 255, (t >>> 16) & 255, (t >>> 8) & 255, t & 255].slice(0, n - 1)); }
    return U8.from(out);
  }
  function ahx(d) { const o = []; let h = -1; for (const c of d) { if (c === 62) break; const v = hx(c); if (v < 0) continue; if (h < 0) h = v; else { o.push(h * 16 + v); h = -1; } } if (h >= 0) o.push(h * 16); return U8.from(o); }
  function rle(d) { const o = []; for (let i = 0; i < d.length;) { const n = d[i++]; if (n === 128) break; if (n < 128) { for (let k = 0; k <= n && i < d.length; k++) o.push(d[i++]); } else { const v = d[i++]; for (let k = 0; k < 257 - n; k++) o.push(v); } } return U8.from(o); }

  // ---------- cifrado estándar de PDF (contraseña de apertura vacía) ----------
  const MD5K = new Int32Array(64).map((_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
  const MD5S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  function md5(m0) {
    const n = m0.length, len = ((n + 8) >> 6) * 64 + 64, m = new U8(len);
    m.set(m0); m[n] = 0x80;
    const bl = n * 8; m[len - 8] = bl & 255; m[len - 7] = (bl >>> 8) & 255; m[len - 6] = (bl >>> 16) & 255; m[len - 5] = (bl >>> 24) & 255; m[len - 4] = Math.floor(bl / 4294967296) & 255;
    let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    const M = new Int32Array(16);
    for (let off = 0; off < len; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = m[off + 4 * i] | (m[off + 4 * i + 1] << 8) | (m[off + 4 * i + 2] << 16) | (m[off + 4 * i + 3] << 24);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
        else { F = C ^ (B | ~D); g = (7 * i) & 15; }
        const s = MD5S[(i >> 4) * 4 + (i & 3)];
        F = (F + A + MD5K[i] + M[g]) | 0; A = D; D = C; C = B; B = (B + ((F << s) | (F >>> (32 - s)))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const o = new U8(16);
    [a0, b0, c0, d0].forEach((v, k) => { o[4 * k] = v & 255; o[4 * k + 1] = (v >>> 8) & 255; o[4 * k + 2] = (v >>> 16) & 255; o[4 * k + 3] = (v >>> 24) & 255; });
    return o;
  }
  function rc4(k, d) {
    const s = new U8(256); for (let i = 0; i < 256; i++) s[i] = i;
    for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + k[i % k.length]) & 255; const t = s[i]; s[i] = s[j]; s[j] = t; }
    const o = new U8(d.length);
    for (let x = 0, i = 0, j = 0; x < d.length; x++) { i = (i + 1) & 255; j = (j + s[i]) & 255; const t = s[i]; s[i] = s[j]; s[j] = t; o[x] = d[x] ^ s[(s[i] + s[j]) & 255]; }
    return o;
  }
  const SB = new U8(256), SI = new U8(256);
  const xt = a => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 255;
  (() => {
    const rot = (x, s) => ((x << s) | (x >> (8 - s))) & 255;
    let p = 1, q = 1;
    do {
      p = (p ^ (p << 1) ^ (p & 0x80 ? 0x1b : 0)) & 255;
      q = (q ^ (q << 1)) & 255; q = (q ^ (q << 2)) & 255; q = (q ^ (q << 4)) & 255; if (q & 0x80) q ^= 0x09;
      SB[p] = (q ^ rot(q, 1) ^ rot(q, 2) ^ rot(q, 3) ^ rot(q, 4) ^ 0x63) & 255;
    } while (p !== 1);
    SB[0] = 0x63; for (let i = 0; i < 256; i++) SI[SB[i]] = i;
  })();
  const gm = (a, b) => { let r = 0; while (b) { if (b & 1) r ^= a; a = xt(a); b >>= 1; } return r; };
  const M9 = new U8(256).map((_, i) => gm(i, 9)), M11 = new U8(256).map((_, i) => gm(i, 11)), M13 = new U8(256).map((_, i) => gm(i, 13)), M14 = new U8(256).map((_, i) => gm(i, 14));
  function aesClave(k) {
    const nk = k.length >> 2, nr = nk + 6, w = new U8(16 * (nr + 1)); w.set(k);
    for (let i = nk, rc = 1; i < 4 * (nr + 1); i++) {
      let a = w[4 * i - 4], b = w[4 * i - 3], c = w[4 * i - 2], d = w[4 * i - 1];
      if (i % nk === 0) { const t = a; a = SB[b] ^ rc; b = SB[c]; c = SB[d]; d = SB[t]; rc = xt(rc); }
      else if (nk > 6 && i % nk === 4) { a = SB[a]; b = SB[b]; c = SB[c]; d = SB[d]; }
      const j = 4 * (i - nk); w[4 * i] = w[j] ^ a; w[4 * i + 1] = w[j + 1] ^ b; w[4 * i + 2] = w[j + 2] ^ c; w[4 * i + 3] = w[j + 3] ^ d;
    }
    return { w, nr };
  }
  function aesDes(K, s, t) {
    const { w, nr } = K;
    for (let i = 0; i < 16; i++) s[i] ^= w[16 * nr + i];
    for (let r = nr - 1; r >= 0; r--) {
      for (let c = 0; c < 4; c++) for (let f = 0; f < 4; f++) t[f + 4 * ((c + f) & 3)] = SI[s[f + 4 * c]];
      for (let i = 0; i < 16; i++) s[i] = t[i] ^ w[16 * r + i];
      if (r > 0) for (let c = 0; c < 16; c += 4) {
        const a0 = s[c], a1 = s[c + 1], a2 = s[c + 2], a3 = s[c + 3];
        s[c] = M14[a0] ^ M11[a1] ^ M13[a2] ^ M9[a3]; s[c + 1] = M9[a0] ^ M14[a1] ^ M11[a2] ^ M13[a3];
        s[c + 2] = M13[a0] ^ M9[a1] ^ M14[a2] ^ M11[a3]; s[c + 3] = M11[a0] ^ M13[a1] ^ M9[a2] ^ M14[a3];
      }
    }
  }
  function aesCif(K, s, t) {
    const { w, nr } = K;
    for (let i = 0; i < 16; i++) s[i] ^= w[i];
    for (let r = 1; r <= nr; r++) {
      for (let c = 0; c < 4; c++) for (let f = 0; f < 4; f++) t[f + 4 * ((c - f + 4) & 3)] = SB[s[f + 4 * c]];
      if (r < nr) for (let c = 0; c < 16; c += 4) {
        const a0 = t[c], a1 = t[c + 1], a2 = t[c + 2], a3 = t[c + 3];
        t[c] = xt(a0) ^ xt(a1) ^ a1 ^ a2 ^ a3; t[c + 1] = a0 ^ xt(a1) ^ xt(a2) ^ a2 ^ a3;
        t[c + 2] = a0 ^ a1 ^ xt(a2) ^ xt(a3) ^ a3; t[c + 3] = xt(a0) ^ a0 ^ a1 ^ a2 ^ xt(a3);
      }
      for (let i = 0; i < 16; i++) s[i] = t[i] ^ w[16 * r + i];
    }
  }
  function aesCbcDes(k, iv, d, relleno) {
    const K = aesClave(k), n = d.length - (d.length % 16), o = new U8(n), s = new U8(16), t = new U8(16);
    let prev = iv;
    for (let i = 0; i < n; i += 16) { s.set(d.subarray(i, i + 16)); aesDes(K, s, t); for (let j = 0; j < 16; j++) o[i + j] = s[j] ^ prev[j]; prev = d.subarray(i, i + 16); }
    if (relleno && n) { const r = o[n - 1]; if (r >= 1 && r <= 16) return o.subarray(0, n - r); }
    return o;
  }
  function aesCbcCif(k, iv, d) {
    const K = aesClave(k), o = new U8(d.length), s = new U8(16), t = new U8(16);
    let prev = iv;
    for (let i = 0; i + 16 <= d.length; i += 16) { for (let j = 0; j < 16; j++) s[j] = d[i + j] ^ prev[j]; aesCif(K, s, t); o.set(s, i); prev = o.subarray(i, i + 16); }
    return o;
  }
  const sha = async (alg, d) => new U8(await root.crypto.subtle.digest(alg, d));
  async function hash2B(pw, salt, ud) {   // algoritmo 2.B (PDF 2.0, cifrado AES-256 revisión 6)
    let K = await sha('SHA-256', concat(pw, salt, ud));
    for (let i = 0; ; i++) {
      const b = concat(pw, K, ud), K1 = new U8(b.length * 64);
      for (let j = 0; j < 64; j++) K1.set(b, j * b.length);
      const E = aesCbcCif(K.subarray(0, 16), K.subarray(16, 32), K1);
      let m = 0; for (let j = 0; j < 16; j++) m += E[j];
      K = await sha(['SHA-256', 'SHA-384', 'SHA-512'][m % 3], E);
      if (i >= 63 && E[E.length - 1] <= i - 32) break;
    }
    return K.subarray(0, 32);
  }
  const PAD = new U8([0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08, 0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A]);
  const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const CON_CLAVE = 'el PDF está protegido con contraseña de apertura: ábrelo con la contraseña y guárdalo (o imprímelo a PDF) sin ella';

  // ---------- codificaciones y anchos de las fuentes ----------
  let _win = null, _mac = null, _std = null;
  const WIN = () => {
    if (!_win) { const d = new TextDecoder('windows-1252'); _win = []; for (let i = 0; i < 256; i++) _win[i] = i < 32 ? '' : d.decode(new U8([i])); _win[160] = ' '; _win[173] = ''; }
    return _win;
  };
  const MAC = () => {
    if (!_mac) { try { const d = new TextDecoder('macintosh'); _mac = []; for (let i = 0; i < 256; i++) _mac[i] = i < 32 ? '' : d.decode(new U8([i])); } catch (_) { _mac = WIN(); } }
    return _mac;
  };
  const STD = () => {
    if (!_std) {
      _std = []; for (let i = 0; i < 256; i++) _std[i] = i >= 32 && i < 127 ? String.fromCharCode(i) : '';
      _std[39] = '’'; _std[96] = '‘';
      const alto = { 161: '¡', 162: '¢', 163: '£', 164: '⁄', 165: '¥', 166: 'ƒ', 167: '§', 168: '¤', 169: "'", 170: '“', 171: '«', 172: '‹', 173: '›', 174: 'fi', 175: 'fl', 177: '–', 178: '†', 179: '‡', 180: '·', 182: '¶', 183: '•', 184: '‚', 185: '„', 186: '”', 187: '»', 188: '…', 189: '‰', 191: '¿', 193: '`', 194: '´', 195: 'ˆ', 196: '˜', 197: '¯', 198: '˘', 199: '˙', 200: '¨', 202: '˚', 203: '¸', 205: '˝', 206: '˛', 207: 'ˇ', 208: '—', 225: 'Æ', 227: 'ª', 232: 'Ł', 233: 'Ø', 234: 'Œ', 235: 'º', 241: 'æ', 245: 'ı', 248: 'ł', 249: 'ø', 250: 'œ', 251: 'ß' };
      for (const k in alto) _std[k] = alto[k];
    }
    return _std;
  };
  const GLIFOS = (() => {
    const g = {}, w = WIN();
    'space exclam quotedbl numbersign dollar percent ampersand quotesingle parenleft parenright asterisk plus comma hyphen period slash zero one two three four five six seven eight nine colon semicolon less equal greater question at'
      .split(' ').forEach((n, i) => { g[n] = String.fromCharCode(32 + i); });
    'bracketleft backslash bracketright asciicircum underscore grave'.split(' ').forEach((n, i) => { g[n] = String.fromCharCode(91 + i); });
    'braceleft bar braceright asciitilde'.split(' ').forEach((n, i) => { g[n] = String.fromCharCode(123 + i); });
    ('Euro - quotesinglbase florin quotedblbase ellipsis dagger daggerdbl circumflex perthousand Scaron guilsinglleft OE - Zcaron - ' +
     '- quoteleft quoteright quotedblleft quotedblright bullet endash emdash tilde trademark scaron guilsinglright oe - zcaron Ydieresis ' +
     'nbspace exclamdown cent sterling currency yen brokenbar section dieresis copyright ordfeminine guillemotleft logicalnot sfthyphen registered macron ' +
     'degree plusminus twosuperior threesuperior acute mu paragraph periodcentered cedilla onesuperior ordmasculine guillemotright onequarter onehalf threequarters questiondown ' +
     'Agrave Aacute Acircumflex Atilde Adieresis Aring AE Ccedilla Egrave Eacute Ecircumflex Edieresis Igrave Iacute Icircumflex Idieresis ' +
     'Eth Ntilde Ograve Oacute Ocircumflex Otilde Odieresis multiply Oslash Ugrave Uacute Ucircumflex Udieresis Yacute Thorn germandbls ' +
     'agrave aacute acircumflex atilde adieresis aring ae ccedilla egrave eacute ecircumflex edieresis igrave iacute icircumflex idieresis ' +
     'eth ntilde ograve oacute ocircumflex otilde odieresis divide oslash ugrave uacute ucircumflex udieresis yacute thorn ydieresis')
      .split(' ').forEach((n, i) => { if (n !== '-') g[n] = w[128 + i]; });
    Object.assign(g, { fi: 'fi', fl: 'fl', ff: 'ff', ffi: 'ffi', ffl: 'ffl', dotlessi: 'ı', minus: '−', fraction: '⁄', Lslash: 'Ł', lslash: 'ł',
      nbspace: ' ', nonbreakingspace: ' ', sfthyphen: '', softhyphen: '', middot: '·', hyphenminus: '-', breve: '˘', dotaccent: '˙', ring: '˚',
      hungarumlaut: '˝', ogonek: '˛', caron: 'ˇ', mu: 'µ', Omega: 'Ω', Delta: 'Δ', afii00208: '—', afii61664: '' });
    return g;
  })();
  function glifo(n, prev) {
    if (GLIFOS[n] !== undefined) return GLIFOS[n];
    let m;
    if ((m = /^uni([0-9A-Fa-f]{4,})$/.exec(n))) { let s = ''; for (let i = 0; i + 4 <= m[1].length; i += 4) s += String.fromCharCode(parseInt(m[1].substr(i, 4), 16)); return s; }
    if ((m = /^u([0-9A-Fa-f]{4,6})$/.exec(n))) { try { return String.fromCodePoint(parseInt(m[1], 16)); } catch (_) { return prev || ''; } }
    if (n.includes('.')) return glifo(n.split('.')[0], prev);
    if (n.includes('_')) return n.split('_').map(x => glifo(x, '')).join('');
    if (n.length === 1) return n;
    return prev !== undefined ? prev : '';
  }
  const ANCHO = s => s.split(',').map(Number);
  const HELV = ANCHO('278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584');
  const TIMES = ANCHO('250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541');
  function ancho(f, c) {
    if (f.w) { const w = f.w.get(c); if (w !== undefined) return w; if (f.dw) return f.dw; }
    if (f.std) {
      if (f.std === 600) return 600;
      const ch = (f.enc && f.enc[c]) || String.fromCharCode(c), b = ch.normalize('NFD').charCodeAt(0);
      return b >= 32 && b <= 126 ? f.std[b - 32] : 500;
    }
    return f.dw || 500;
  }
  function cmapUni(d) {   // ToUnicode: código -> texto
    const m = new Map(); if (!d) return m;
    const L = new Lexer(d, 0);
    const u16 = s => { let o = ''; for (let i = 0; i + 1 < s.length; i += 2) o += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1)); if (s.length % 2) o += s.slice(-1); return o; };
    const cod = s => { let v = 0; for (let i = 0; i < s.length; i++) v = v * 256 + s.charCodeAt(i); return v; };
    for (let guard = 0; guard < 5e6; guard++) {
      const t = L.tok(); if (t === FIN) break;
      if (t.K === 'beginbfchar') for (;;) {
        const a = L.tok(); if (a.S === undefined) break;
        const b = L.tok(); m.set(cod(a.S), b.S !== undefined ? u16(b.S) : b.N !== undefined ? glifo(b.N, '') : '');
      } else if (t.K === 'beginbfrange') for (;;) {
        const a = L.tok(); if (a.S === undefined) break;
        const b = L.tok(), c = L.val(L.tok(), false), lo = cod(a.S), hi = cod(b.S || '');
        if (Array.isArray(c)) c.forEach((x, k) => { if (x && x.S !== undefined) m.set(lo + k, u16(x.S)); });
        else if (c && c.S !== undefined) { const base = u16(c.S), ult = base.charCodeAt(base.length - 1); for (let k = 0; k <= hi - lo && k < 65536; k++) m.set(lo + k, base.slice(0, -1) + String.fromCharCode(ult + k)); }
      }
    }
    return m;
  }
  const FUENTE_DEF = { dos: false, uni: null, enc: null, w: null, dw: 0, esc: 1, std: HELV };

  // ---------- documento PDF ----------
  const I6 = [1, 0, 0, 1, 0, 0];
  const mul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3], A[4] * B[0] + A[5] * B[2] + B[4], A[4] * B[1] + A[5] * B[3] + B[5]];
  const nom = x => (x && x.N !== undefined ? x.N : '');
  function Pdf(u) { this.u = u; this.s = latin(u); this.obj = new Map(); this.orden = []; this.trailers = []; this.fuentes = new Map(); this.cifrado = null; }
  Pdf.prototype.R = function (x) { for (let k = 0; k < 32 && x instanceof Ref; k++) { const r = this.obj.get(x.n); x = r ? r.v : null; } return x; };
  Pdf.prototype.escanear = function () {
    const s = this.s, u = this.u, rx = /(\d+)[ \t\r\n\f\0]+(\d+)[ \t\r\n\f\0]+obj\b/g;
    let m;
    while ((m = rx.exec(s))) {
      const L = new Lexer(u, m.index + m[0].length);
      let v; try { v = L.val(L.tok(), true); } catch (_) { continue; }
      const rec = { num: +m[1], gen: +m[2], v };
      const p0 = L.p, t = L.tok();
      if (t.K === 'stream') {
        let p = L.p; if (u[p] === 13) p++; if (u[p] === 10) p++;
        let fin = s.indexOf('endstream', p); if (fin < 0) fin = u.length;
        rec.so = p; rec.se = fin; rx.lastIndex = Math.min(fin + 9, u.length);
        if (v && typeof v === 'object') Object.defineProperty(v, '__s', { value: rec });
      } else L.p = p0;
      this.obj.set(rec.num, rec); this.orden.push(rec);
    }
    for (let i = s.indexOf('trailer'); i >= 0; i = s.indexOf('trailer', i + 7)) {
      const L = new Lexer(u, i + 7);
      try { const t = L.val(L.tok(), true); if (t && typeof t === 'object' && (t.Root || t.Encrypt || t.ID)) this.trailers.push(t); } catch (_) { /* basura */ }
    }
    for (const r of this.orden) if (r.v && nom(r.v.Type) === 'XRef') this.trailers.push(r.v);
  };
  Pdf.prototype.ultimo = function (k) { for (let i = this.trailers.length - 1; i >= 0; i--) if (this.trailers[i][k]) return this.trailers[i][k]; return null; };
  Pdf.prototype.flujo = function (rec, guardar) {
    if (!rec || rec.so === undefined) return null;
    if (rec.cache) return rec.cache;
    const u = this.u, d = rec.v, R = x => this.R(x);
    let fin = rec.se;
    const len = R(d.Length);
    let ok = typeof len === 'number' && len >= 0 && rec.so + len <= fin;
    if (ok) for (let i = rec.so + len; i < fin; i++) if (!BL[u[i]]) { ok = false; break; }
    if (ok) fin = rec.so + len; else { if (u[fin - 1] === 10) fin--; if (u[fin - 1] === 13) fin--; }
    let data = u.subarray(rec.so, fin);
    if (this.cifrado && nom(d.Type) !== 'XRef') data = this.cifrado(data, rec.num, rec.gen);
    let fs = R(d.Filter), ps = R(d.DecodeParms || d.DP);
    fs = !fs ? [] : Array.isArray(fs) ? fs : [fs];
    ps = Array.isArray(ps) ? ps : [ps];
    for (let i = 0; i < fs.length; i++) {
      const f = nom(R(fs[i])), prm = R(ps[i]) || {};
      if (f === 'FlateDecode' || f === 'Fl') data = predictor(inflarZlib(data), prm, R);
      else if (f === 'LZWDecode' || f === 'LZW') data = predictor(lzw(data, R(prm.EarlyChange)), prm, R);
      else if (f === 'ASCII85Decode' || f === 'A85') data = a85(data);
      else if (f === 'ASCIIHexDecode' || f === 'AHx') data = ahx(data);
      else if (f === 'RunLengthDecode' || f === 'RL') data = rle(data);
      else if (f === 'Crypt') continue;
      else return null;   // imágenes (DCT, JPX, CCITT, JBIG2): no llevan texto
    }
    if (guardar) rec.cache = data;
    return data;
  };
  Pdf.prototype.objStms = function () {
    for (const r of this.orden) {
      if (!r.v || nom(r.v.Type) !== 'ObjStm') continue;
      let d; try { d = this.flujo(r); } catch (_) { continue; }
      if (!d) continue;
      const n = +this.R(r.v.N) || 0, first = +this.R(r.v.First) || 0, L = new Lexer(d, 0), pares = [];
      for (let i = 0; i < n; i++) { const a = L.tok(), b = L.tok(); if (typeof a !== 'number' || typeof b !== 'number') break; pares.push([a, b]); }
      for (const [num, off] of pares) {
        if (this.obj.has(num)) continue;
        const L2 = new Lexer(d, first + off);
        try { this.obj.set(num, { num, gen: 0, v: L2.val(L2.tok(), true), enStm: true }); } catch (_) { /* objeto dañado */ }
      }
    }
  };
  Pdf.prototype.preparar = async function () {
    const R = x => this.R(x), enc = R(this.ultimo('Encrypt'));
    if (!enc) return;
    const filtro = nom(R(enc.Filter));
    if (filtro && filtro !== 'Standard') throw fallo('el PDF está cifrado con un certificado digital: no se puede abrir sin él');
    const V = +R(enc.V) || 0, Rv = +R(enc.R) || 2, ids = R(this.ultimo('ID'));
    const id0 = bytes((ids && R(ids[0]) && R(ids[0]).S) || ''), O = bytes((R(enc.O) || {}).S || ''), Ub = bytes((R(enc.U) || {}).S || ''), P = +R(enc.P) || 0;
    let metodo = 'RC4';
    if (V >= 4) {
      const stmf = nom(R(enc.StmF)) || 'StdCF'; if (stmf === 'Identity') return;
      const cf = R((R(enc.CF) || {})[stmf]) || {}, cfm = nom(R(cf.CFM));
      metodo = cfm === 'AESV2' ? 'AES' : cfm === 'AESV3' ? 'AES256' : cfm === 'None' ? '' : 'RC4';
      if (!metodo) return;
    }
    let clave;
    if (Rv >= 5) {
      if (!(root.crypto && root.crypto.subtle)) throw fallo('este navegador no permite abrir PDF con cifrado AES-256');
      const vacio = new U8(0), H = async salt => (Rv === 5 ? sha('SHA-256', salt) : hash2B(vacio, salt, vacio));
      if (!iguales((await H(Ub.subarray(32, 40))).subarray(0, 32), Ub.subarray(0, 32))) throw fallo(CON_CLAVE);
      const ik = (await H(Ub.subarray(40, 48))).subarray(0, 32), UE = bytes((R(enc.UE) || {}).S || '');
      clave = aesCbcDes(ik, new U8(16), UE.subarray(0, 32), false);
      metodo = 'AES256';
    } else {
      const n = Rv === 2 ? 5 : Math.max(5, Math.min(16, (+R(enc.Length) || 40) / 8));
      const em = R(enc.EncryptMetadata);
      let h = md5(concat(PAD, O.subarray(0, 32), new U8([P & 255, (P >> 8) & 255, (P >> 16) & 255, (P >>> 24) & 255]), id0,
        Rv >= 4 && em && em.K === 'false' ? new U8([255, 255, 255, 255]) : new U8(0)));
      if (Rv >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
      clave = h.subarray(0, n);
      let ok;
      if (Rv === 2) ok = iguales(rc4(clave, PAD), Ub.subarray(0, 32));
      else { let x = rc4(clave, md5(concat(PAD, id0))); for (let i = 1; i <= 19; i++) x = rc4(clave.map(b => b ^ i), x); ok = iguales(x.subarray(0, 16), Ub.subarray(0, 16)); }
      if (!ok) throw fallo(CON_CLAVE);
    }
    const aes = metodo !== 'RC4';
    this.cifrado = (data, num, gen) => {
      let k = clave;
      if (metodo !== 'AES256') k = md5(concat(clave, new U8([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255]), aes ? new U8([0x73, 0x41, 0x6C, 0x54]) : new U8(0))).subarray(0, Math.min(16, clave.length + 5));
      if (!aes) return rc4(k, data);
      if (data.length < 32) return new U8(0);
      return aesCbcDes(k, data.subarray(0, 16), data.subarray(16), true);
    };
  };
  Pdf.prototype.catalogo = function () {
    let c = this.R(this.ultimo('Root'));
    if (!c || !c.Pages) for (const r of this.obj.values()) if (r.v && nom(r.v.Type) === 'Catalog') { c = r.v; break; }
    return c || {};
  };
  Pdf.prototype.paginas = function (cat) {
    const out = [], vistos = new Set();
    const rec = (nodo, res) => {
      const n = this.R(nodo); if (!n || typeof n !== 'object' || vistos.has(n) || out.length > 5000) return;
      vistos.add(n);
      const r = n.Resources !== undefined ? n.Resources : res, kids = this.R(n.Kids);
      if (Array.isArray(kids) && nom(n.Type) !== 'Page') { for (const k of kids) rec(k, r); }
      else out.push({ d: n, res: this.R(r) || {} });
    };
    if (cat.Pages) rec(cat.Pages, null);
    if (!out.length) for (const r of this.obj.values()) if (r.v && nom(r.v.Type) === 'Page') out.push({ d: r.v, res: this.R(r.v.Resources) || {} });
    return out;
  };
  Pdf.prototype.fuente = function (ref) {
    const k = ref instanceof Ref ? ref.n : ref;
    if (this.fuentes.has(k)) return this.fuentes.get(k);
    let f; try { f = this.crearFuente(this.R(ref) || {}); } catch (e) { f = FUENTE_DEF; }
    this.fuentes.set(k, f); return f;
  };
  Pdf.prototype.crearFuente = function (fd) {
    const R = x => this.R(x), sub = nom(R(fd.Subtype)), base = nom(R(fd.BaseFont)).replace(/^[A-Z]{6}\+/, '');
    const f = { dos: false, uni: null, enc: null, w: null, dw: 0, esc: 1, std: null };
    const tu = R(fd.ToUnicode);
    if (tu && tu.__s) { try { f.uni = cmapUni(this.flujo(tu.__s)); } catch (_) { f.uni = null; } }
    if (sub === 'Type0') {
      f.dos = true;
      const df = R((R(fd.DescendantFonts) || [])[0]) || {}, W = R(df.W);
      f.dw = +R(df.DW) || 1000;
      if (Array.isArray(W)) {
        f.w = new Map();
        for (let i = 0; i < W.length;) {
          const a = +R(W[i]), b = R(W[i + 1]);
          if (Array.isArray(b)) { b.forEach((x, k) => f.w.set(a + k, +R(x) || 0)); i += 2; }
          else { const c = +R(W[i + 2]) || 0; for (let k = a; k <= +b && k - a < 65536; k++) f.w.set(k, c); i += 3; }
        }
      }
      return f;
    }
    const fc = +R(fd.FirstChar) || 0, ws = R(fd.Widths), dsc = R(fd.FontDescriptor) || {};
    if (Array.isArray(ws) && ws.length) { f.w = new Map(); ws.forEach((x, k) => f.w.set(fc + k, +R(x) || 0)); }
    f.dw = +R(dsc.MissingWidth) || 0;
    if (sub === 'Type3') { const fm = R(fd.FontMatrix) || [0.001]; f.esc = (+R(fm[0]) || 0.001) * 1000; }
    if (!f.w) f.std = /courier|mono/i.test(base) ? 600 : /times|serif|roman|georgia|garamond|book|cambria/i.test(base) && !/sans/i.test(base) ? TIMES : HELV;
    const tabla = n => (n === 'MacRomanEncoding' ? MAC() : n === 'StandardEncoding' ? STD() : WIN()).slice();
    const enc = R(fd.Encoding);
    if (enc && enc.N !== undefined) f.enc = tabla(enc.N);
    else if (enc && typeof enc === 'object') {
      f.enc = tabla(nom(R(enc.BaseEncoding)) || 'WinAnsiEncoding');
      const dif = R(enc.Differences);
      if (Array.isArray(dif)) { let c = 0; for (const x of dif) { const v = R(x); if (typeof v === 'number') c = v; else if (v && v.N !== undefined) { if (c < 256) f.enc[c] = glifo(v.N, f.enc[c]); c++; } } }
    } else f.enc = WIN().slice();
    return f;
  };
  Pdf.prototype.contenido = function (pg) {
    const c = pg.d.Contents, rc = this.R(c), lista = Array.isArray(rc) ? rc : [c], partes = [];
    for (const x of lista) {
      const rec = x instanceof Ref ? this.obj.get(x.n) : null; if (!rec) continue;
      let d = null; try { d = this.flujo(rec); } catch (_) { d = null; }
      if (d) partes.push(d, new U8([10]));
    }
    return concat(...partes);
  };
  /* Recorre los operadores de una página y guarda cada trozo de texto con su posición en la página */
  Pdf.prototype.interpretar = function (datos, res, ctm0, sal, prof, est) {
    const L = new Lexer(datos, 0), op = [], pila = [], R = x => this.R(x);
    const fuentes = R(res.Font) || {}, xobj = R(res.XObject) || {};
    let ctm = ctm0, tm = I6, tlm = I6, f = null, fs = 0, tc = 0, tw = 0, th = 1, tl = 0, rise = 0;
    const mc = [];   // contenido marcado: /ActualText da el texto real de letras dibujadas como base + acento
    const show = s => {
      if (!f) f = FUENTE_DEF;
      const M = mul(tm, ctm), sy = Math.hypot(M[2], M[3]) || 1, size = Math.abs(fs) * sy * (f.esc !== 1 ? Math.abs(f.esc) : 1);
      let txt = '', adv = 0;
      const glifoTxt = (c, uno) => {
        const w = ancho(f, c);
        let u = f.uni && f.uni.has(c) ? f.uni.get(c) : (f.dos || (f.uni && f.uni.size && !w) ? '' : (f.enc ? f.enc[c] : String.fromCharCode(c)));
        if (u === undefined) u = '';
        txt += u; adv += ((w / 1000) * f.esc * fs + tc + (uno && c === 32 ? tw : 0)) * th;
      };
      if (f.dos) for (let i = 0; i + 1 < s.length; i += 2) glifoTxt((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1), false);
      else for (let i = 0; i < s.length; i++) glifoTxt(s.charCodeAt(i), true);
      for (let i = mc.length - 1; i >= 0; i--) if (mc[i] && mc[i].real != null) { txt = mc[i].dicho ? '' : mc[i].real; mc[i].dicho = true; break; }
      const x0 = M[4] + rise * M[2], y0 = M[5] + rise * M[3];
      sal.push({ t: txt, x: x0, y: y0, x1: x0 + adv * M[0], y1: y0 + adv * M[1], s: size, rot: !(M[0] > 0 && Math.abs(M[1]) < 0.1 * M[0]) });
      tm = [tm[0], tm[1], tm[2], tm[3], tm[4] + adv * tm[0], tm[5] + adv * tm[1]];
    };
    const ult = k => op[op.length - k];
    for (let guard = 0; guard < 2e7; guard++) {
      const t = L.tok(); if (t === FIN) break;
      if (t.K === undefined) { op.push(L.val(t, false)); if (op.length > 64) op.splice(0, 32); continue; }
      const k = t.K;
      switch (k) {
        case 'q': pila.push([ctm, f, fs, tc, tw, th, tl, rise]); break;
        case 'Q': if (pila.length) [ctm, f, fs, tc, tw, th, tl, rise] = pila.pop(); break;
        case 'cm': if (op.length >= 6) ctm = mul(op.slice(-6).map(v => +v || 0), ctm); break;
        case 'BT': tm = tlm = I6; break;
        case 'Tf': { const n = ult(2); f = n && n.N !== undefined && fuentes[n.N] ? this.fuente(fuentes[n.N]) : FUENTE_DEF; fs = +ult(1) || 0; break; }
        case 'Tc': tc = +ult(1) || 0; break;
        case 'Tw': tw = +ult(1) || 0; break;
        case 'Tz': th = (+ult(1) || 100) / 100; break;
        case 'TL': tl = +ult(1) || 0; break;
        case 'Ts': rise = +ult(1) || 0; break;
        case 'Td': case 'TD': { const x = +ult(2) || 0, y = +ult(1) || 0; if (k === 'TD') tl = -y; tlm = mul([1, 0, 0, 1, x, y], tlm); tm = tlm; break; }
        case 'Tm': if (op.length >= 6) { tlm = op.slice(-6).map(v => +v || 0); tm = tlm; } break;
        case 'T*': tlm = mul([1, 0, 0, 1, 0, -tl], tlm); tm = tlm; break;
        case 'Tj': { const s = ult(1); if (s && s.S !== undefined) show(s.S); break; }
        case "'": case '"': {
          if (k === '"') { tw = +ult(3) || 0; tc = +ult(2) || 0; }
          tlm = mul([1, 0, 0, 1, 0, -tl], tlm); tm = tlm;
          const s = ult(1); if (s && s.S !== undefined) show(s.S); break;
        }
        case 'TJ': {
          const a = ult(1);
          if (Array.isArray(a)) for (const x of a) {
            if (typeof x === 'number') { const tx = -x / 1000 * fs * th; tm = [tm[0], tm[1], tm[2], tm[3], tm[4] + tx * tm[0], tm[5] + tx * tm[1]]; }
            else if (x && x.S !== undefined) show(x.S);
          }
          break;
        }
        case 'Do': {
          const n = ult(1), x = n && n.N !== undefined ? R(xobj[n.N]) : null;
          if (x && nom(x.Subtype) === 'Image') est.imagenes++;
          if (x && x.__s && nom(x.Subtype) === 'Form' && prof < 8) {
            let d = null; try { d = this.flujo(x.__s, true); } catch (_) { d = null; }
            if (d) {
              const mt = R(x.Matrix), m2 = Array.isArray(mt) && mt.length === 6 ? mt.map(v => +R(v) || 0) : I6;
              this.interpretar(d, R(x.Resources) || res, mul(m2, ctm), sal, prof + 1, est);
            }
          }
          break;
        }
        case 'BI': L.saltarImagen(); break;
        case 'BMC': mc.push(null); break;
        case 'BDC': {
          let p = ult(1); if (p && p.N !== undefined) p = R((R(res.Properties) || {})[p.N]);
          const at = p && typeof p === 'object' ? R(p.ActualText) : null;
          mc.push(at && at.S !== undefined ? { real: textoPdfStr(bytes(at.S)), dicho: false } : null);
          break;
        }
        case 'EMC': mc.pop(); break;
        default: break;
      }
      op.length = 0;
    }
  };
  /* trozos -> líneas (en el orden en que se dibujan, que es el de lectura en casi todos los PDF) */
  function lineas(trozos) {
    const L = []; let c = null;
    for (const t of trozos) {
      if (!t.t) continue;
      const s = Math.max(t.s, 1);
      // negrita simulada: el mismo texto se dibuja otra vez casi en el mismo sitio (no a continuación, como «ll»)
      if (c && c.ult && t.t === c.ult.t && Math.abs(t.x - c.ult.x) < Math.min(s * 0.3, Math.abs(c.ult.x1 - c.ult.x) * 0.5) && Math.abs(t.y - c.ult.y) < s * 0.3) continue;
      const ms = c ? Math.max(c.s, s) : s;
      if (c && Math.abs(t.y - c.y) < ms * 0.5 && t.x >= c.x1 - ms * 0.8) {
        const gap = t.x - c.x1;
        if (!/\s$/.test(c.t) && !/^\s/.test(t.t)) { if (gap > ms * 1.8) c.t += '\t'; else if (gap > Math.min(c.s, s) * 0.15) c.t += ' '; }
        c.t += t.t; c.x1 = Math.max(c.x1, t.x1); c.s = Math.max(c.s, s); c.ult = t;
      } else { c = { t: t.t, x: t.x, x1: t.x1, y: t.y, s, ult: t }; L.push(c); }
    }
    for (const l of L) l.t = l.t.trim();
    return L.filter(l => l.t);
  }
  /* líneas -> párrafos: une las líneas que llegan al margen derecho y separa los párrafos por el espacio vertical */
  function parrafos(L) {
    if (!L.length) return '';
    const dys = [];
    for (let i = 1; i < L.length; i++) { const d = L[i - 1].y - L[i].y; if (d > 0 && d < L[i].s * 3) dys.push(d); }
    dys.sort((a, b) => a - b);
    const inter = dys.length ? dys[Math.floor(dys.length / 2)] : 0;
    const ders = L.map(l => l.x1).sort((a, b) => a - b), der = ders[Math.min(ders.length - 1, Math.floor(ders.length * 0.9))];
    let out = L[0].t;
    for (let i = 1; i < L.length; i++) {
      const a = L[i - 1], b = L[i], dy = a.y - b.y, s = Math.max(a.s, b.s);
      const lista = /^([-•·*–—▪►■●○◦➢✓]|\d{1,3}[.)]|[a-zA-Z][.)])\s/.test(b.t);
      // la línea «a» está llena si llega al margen o si la primera palabra de «b» no habría cabido en el hueco que queda
      const letra = (b.x1 - b.x) / Math.max(1, b.t.length), palabra = (b.t.split(/\s/)[0] || '').length + 1;
      const llena = a.x1 >= der - s * 2.5 || der - a.x1 < palabra * letra;
      const junta = dy > 0 && inter > 0 && dy < inter * 1.35 && llena && !lista && Math.abs(b.s - a.s) < s * 0.25 &&
        !a.t.includes('\t') && !b.t.includes('\t') && b.x < a.x + s * 3;
      if (junta) {
        if (/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]-$/.test(a.t)) out = /^[a-záéíóúñü]/.test(b.t) ? out.slice(0, -1) + b.t : out + b.t;
        else out += ' ' + b.t;
      } else out += (dy < 0 || (inter ? dy > inter * 1.6 : dy > s * 2) ? '\n\n' : '\n') + b.t;
    }
    return out;
  }
  function rotadas(tr) {   // texto girado (p. ej. el código seguro de verificación en el margen)
    let o = '', p = null;
    for (const t of tr) {
      if (!t.t) continue;
      if (p) { const d = Math.hypot(t.x - p.x1, t.y - p.y1), m = Math.max(p.s, t.s); o += d > m * 1.5 ? '\n' : d > m * 0.15 && !/\s$/.test(o) && !/^\s/.test(t.t) ? ' ' : ''; }
      o += t.t; p = t;
    }
    return o.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  }
  const LIGA = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };
  const limpiarPdf = t => t.replace(/[ﬀ-ﬆ]/g, c => LIGA[c] || c).replace(/\u00A0/g, ' ').replace(/[\u00AD\u200B\uFEFF]/g, '')
    .replace(/[\uF06C\uF06E\uF075\uF076\uF0A7\uF0A8\uF0B7\uF0D8\uF0FC]/g, '•').replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  function textoPdfStr(b) {
    if (b[0] === 0xFE && b[1] === 0xFF) { let s = ''; for (let i = 2; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]); return s; }
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return utf8.decode(b.subarray(3));
    return latin(b);
  }
  Pdf.prototype.campos = function (cat) {   // valores escritos en los campos de un formulario PDF
    const af = this.R(cat.AcroForm); if (!af) return '';
    const out = [], vistos = new Set();
    const txt = (v, ref) => {
      if (v && v.S !== undefined) {
        let b = bytes(v.S);
        if (this.cifrado && ref instanceof Ref) { const r = this.obj.get(ref.n); if (r && !r.enStm) b = this.cifrado(b, r.num, r.gen); }
        return textoPdfStr(b).trim();
      }
      if (v && v.N !== undefined) return v.N === 'Off' ? '' : v.N;
      if (Array.isArray(v)) return v.map(x => txt(this.R(x), ref)).filter(Boolean).join(', ');
      return '';
    };
    const rec = (ref, pref, prof) => {
      const f = this.R(ref); if (!f || typeof f !== 'object' || vistos.has(f) || prof > 20) return;
      vistos.add(f);
      const t = f.T ? txt(this.R(f.T), ref) : '', nombre = t ? (pref ? pref + '.' + t : t) : pref;
      if (f.V !== undefined && t) { const v = txt(this.R(f.V), ref); if (v) out.push(`${nombre}: ${v}`); }
      for (const k of this.R(f.Kids) || []) rec(k, nombre, prof + 1);
    };
    for (const f of this.R(af.Fields) || []) rec(f, '', 0);
    return out.length ? 'CAMPOS DEL FORMULARIO\n' + out.join('\n') : '';
  };
  async function leerPdf(u) {
    const i = latin(u.subarray(0, 1024)).indexOf('%PDF');
    if (i < 0) throw fallo('el archivo no es un PDF válido');
    const pdf = new Pdf(u);
    pdf.escanear();
    await pdf.preparar();
    pdf.objStms();
    const cat = pdf.catalogo(), pags = pdf.paginas(cat), textos = [], est = { imagenes: 0 };
    let letras = 0;
    for (let n = 0; n < pags.length; n++) {
      const pg = pags[n], sal = [];
      try { pdf.interpretar(pdf.contenido(pg), pg.res, I6, sal, 0, est); } catch (e) { console.warn('PDF: página', n + 1, e); }
      let t = parrafos(lineas(sal.filter(x => !x.rot)));
      const r = rotadas(sal.filter(x => x.rot)); if (r) t += (t ? '\n\n' : '') + r;
      t = limpiarPdf(t); letras += t.replace(/\s/g, '').length; textos.push(t);
    }
    let campos = ''; try { campos = pdf.campos(cat); } catch (_) { campos = ''; }
    // un párrafo que sigue en la página siguiente (la página acaba sin punto y la otra empieza en minúscula) se vuelve a unir
    let texto = '';
    for (const t of textos.filter(Boolean)) {
      if (!texto) texto = t;
      else if (/[A-Za-zÁÉÍÓÚÑÜáéíóúñü,]-?$/.test(texto) && /^[a-záéíóúñü]/.test(t)) texto = /[A-Za-záéíóúñü]-$/.test(texto) ? texto.slice(0, -1) + t : texto + ' ' + t;
      else texto += '\n\n' + t;
    }
    if (campos) texto += (texto ? '\n\n' : '') + campos;
    let aviso = '';
    if (letras < 25 * Math.max(1, pags.length)) aviso = est.imagenes || !letras
      ? 'El PDF parece escaneado (sus páginas son imágenes) y apenas tiene texto que leer. Para tokenizarlo haría falta pasarlo antes por un programa de OCR.'
      : 'El PDF apenas tiene texto legible: revisa el resultado.';
    return { texto, paginas: pags.length, aviso, cifrado: !!pdf.cifrado };
  }

  // ---------- API ----------
  const EXT_TABLA = ['xlsx', 'xlsm', 'xltx', 'ods', 'xls'], EXT_DOC = ['docx', 'docm', 'dotx', 'odt', 'pdf', 'doc'];
  const esTabla = n => EXT_TABLA.includes(ext(n)), esDocumento = n => EXT_DOC.includes(ext(n));
  async function leer(file) {
    const u = new U8(await file.arrayBuffer()), e = ext(file.name);
    if (!u.length) throw fallo('el archivo está vacío');
    const zip = u[0] === 0x50 && u[1] === 0x4B, ole = u[0] === 0xD0 && u[1] === 0xCF && u[2] === 0x11 && u[3] === 0xE0;
    if (e === 'pdf' || latin(u.subarray(0, 8)).startsWith('%PDF')) return Object.assign({ tipo: 'texto', formato: 'PDF', tablas: [] }, await leerPdf(u));
    if (zip) {
      const z = abrirZip(u), n = z.nombres().map(x => x.toLowerCase());
      if (n.includes('xl/workbook.xml')) return { tipo: 'tabla', formato: 'Excel', hojas: leerXlsx(z) };
      if (n.includes('word/document.xml')) return Object.assign({ tipo: 'texto', formato: 'Word' }, leerDocx(z));
      const mt = (z.texto('mimetype') || '').trim();
      if (/spreadsheet/.test(mt)) return { tipo: 'tabla', formato: 'LibreOffice Calc', hojas: leerOds(z) };
      if (/opendocument\.text/.test(mt)) return Object.assign({ tipo: 'texto', formato: 'LibreOffice Writer' }, leerOdt(z));
      throw fallo('no es un documento de Word, Excel o LibreOffice que se pueda leer');
    }
    if (ole) {
      if (e === 'xls') throw fallo('es un Excel antiguo (.xls de 1997-2003): ábrelo en Excel y guárdalo como .xlsx o .csv');
      if (e === 'doc') throw fallo('es un Word antiguo (.doc de 1997-2003): ábrelo en Word y guárdalo como .docx');
      throw fallo('el documento está protegido con contraseña: ábrelo y guárdalo sin contraseña');
    }
    const t = decodificar(u);
    if (/<table/i.test(t.slice(0, 300000))) { const h = tablasHtml(t); if (h.length) return { tipo: 'tabla', formato: 'tabla HTML', hojas: h }; }
    if (EXT_TABLA.includes(e) && root.TokCSV) { const tb = root.TokCSV.parse(t); return { tipo: 'tabla', formato: 'texto', hojas: [{ nombre: 'Hoja 1', filas: [tb.header, ...tb.rows] }] }; }
    if (e === 'doc' || e === 'docx') throw fallo('no es un documento de Word válido');
    return { tipo: 'texto', formato: 'texto', texto: t, tablas: [] };
  }

  root.TokLector = { leer, esTabla, esDocumento, aTabla, tablaMd, decodificar,
    _t: { Pdf, Lexer, inflar, inflarZlib, md5, rc4, aesCbcDes, aesCbcCif, aesClave, SB, GLIFOS, HELV, TIMES, leerPdf, abrirZip, lineas, parrafos } };
})(typeof self !== 'undefined' ? self : this);
