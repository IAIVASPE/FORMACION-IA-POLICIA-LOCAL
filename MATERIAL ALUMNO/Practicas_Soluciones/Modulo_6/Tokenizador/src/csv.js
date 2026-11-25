'use strict';
/* TokCSV — CSV: lectura/escritura, detección del contenido de cada columna, tokenización por columnas
   (direcciones, delitos, artículos, datos personales y texto libre) y destokenización. */
(function (root, factory) {
  root.TokCSV = factory(root.TokEngine, root.TokDir, root.TokDelitos);
})(typeof self !== 'undefined' ? self : this, function (E, D, L) {

  // ---------- lectura / escritura ----------
  function detectarSeparador(text) {
    const linea = text.split(/\r?\n/).find(l => l.trim()) || '';
    let best = ',', n = -1;
    for (const sep of [';', ',', '\t', '|']) {
      let c = 0, q = false;
      for (const ch of linea) { if (ch === '"') q = !q; else if (!q && ch === sep) c++; }
      if (c > n) { n = c; best = sep; }
    }
    return best;
  }
  function parse(text, sep) {
    text = String(text || '').replace(/^﻿/, '');
    sep = sep || detectarSeparador(text);
    const rows = []; let row = [], f = '', q = false, i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
        f += ch; i++; continue;
      }
      if (ch === '"' && f.trim() === '') { q = true; f = ''; i++; continue; }
      if (ch === sep) { row.push(f); f = ''; i++; continue; }
      if (ch === '\r' || ch === '\n') { row.push(f); f = ''; rows.push(row); row = []; if (ch === '\r' && text[i + 1] === '\n') i++; i++; continue; }
      f += ch; i++;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    const filas = rows.filter(r => r.some(c => c.trim() !== ''));
    const header = (filas.shift() || []).map(h => h.trim());
    for (const r of filas) while (r.length < header.length) r.push('');
    return { header, rows: filas, sep };
  }
  function serialize(header, rows, sep) {
    sep = sep || ',';
    const esc = v => { v = v == null ? '' : String(v); return (v.includes(sep) || /["\r\n]/.test(v) || /^\s|\s$/.test(v)) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [header, ...rows].map(r => r.map(esc).join(sep)).join('\r\n');
  }

  // ---------- qué contiene cada columna ----------
  const ROLES = [
    ['skip', 'No tocar'],
    ['via', '📍 Dirección: nombre de la vía'],
    ['numero', '📍 Dirección: número / portal'],
    ['direccion', '📍 Dirección completa (vía, nº, piso…)'],
    ['delito', '⚖️ Delito / tipo de hecho'],
    ['articulo', '⚖️ Artículo del Código Penal'],
    ['texto', '🔎 Texto libre (detección automática)'],
    ['coord', '🌐 Coordenada: redondear (≈100 m)'],
    ...E.CATS.filter(([k]) => !['DOMICILIO', 'VIA', 'DELITO', 'ART_CP'].includes(k)).map(([k, l]) => ['valor:' + k, '🔒 ' + l]),
    ['valor:DOMICILIO', '🔒 Domicilio / CP']
  ];
  const hnorm = h => D.sinT(h).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const esCoordenada = h => /(^|_)(lat|latitud|latitude|lon|lng|long|longitud|longitude|coord|coordenadas?|utm_?x|utm_?y|x_utm|y_utm)($|_)/.test(hnorm(h));

  function detectarRoles(header, rows) {
    const roles = header.map((h, i) => {
      const k = hnorm(h);
      const m = rows.slice(0, 400).map(r => String(r[i] || '').trim()).filter(Boolean).slice(0, 80);
      const share = f => (m.length ? m.filter(f).length / m.length : 0);
      if (esCoordenada(h)) return 'skip';
      if (/(nacimiento|fecha_nac|f_nac)/.test(k)) return 'valor:FECHA_NAC';
      if (/^(id|codigo|cod|ref|referencia|n_?registro|registro|dia|dia_semana|mes|ano|anyo|year|turno|semana)(_|$)/.test(k) || /(fecha|hora|franja)/.test(k)) return 'skip';
      if (/(^|_)(via|calle|carrer|nombre_via|nom_via|via_publica|vial|street)($|_)/.test(k)) return 'via';
      if (/(^|_)(numero|num|n|no|portal|numero_portal|num_portal|numero_via|num_via)($|_)/.test(k)) return 'numero';
      if (/(direcc|domicil|adre[cs]|ubicac|lugar|lloc|emplazam|localizac|address|sitio)/.test(k))
        return share(v => /\d/.test(v)) > 0.3 ? 'direccion' : 'via';
      if (/(delito|delicte|tipo_hecho|tipologia|tipo_delito|infracc|calificac|tipo_penal|tipus)/.test(k)) return 'delito';
      if (/^(tipo|hecho|fet)$/.test(k) && share(v => L.identificar(v)) >= 0.3) return 'delito';
      if (/(articulo|^art($|_)|art_cp|precepto|article)/.test(k)) return 'articulo';
      if (/(observ|descrip|relato|narra|resumen|notas?$|comentar|texto|detalle|^hechos$|exposic|manifest|declarac|modus)/.test(k)) return 'texto';
      if (/(dni|nie|nif|documento|pasaporte|doc_id)/.test(k)) return 'valor:DOC_ID';
      if (/(telefono|tlf|tfno|movil|phone|telf)/.test(k)) return 'valor:TELEFONO';
      if (/(email|e_mail|correo|mail)/.test(k)) return 'valor:EMAIL';
      if (/(matricula|placa)/.test(k)) return 'valor:MATRICULA';
      if (/(nombre|apellido|denunciante|victima|perjudicad|autor|detenid|investigad|persona|filiacion|titular|testigo|cognom|^nom$)/.test(k)) return 'valor:PERSONA';
      if (/(municipio|localidad|poblacion|ciudad|municipi|poble|termino)/.test(k)) return 'valor:LOCALIDAD';
      if (/(^cp$|codigo_postal|cod_postal|postal|^c_p$)/.test(k)) return 'valor:DOMICILIO';
      if (/(iban|cuenta|ccc)/.test(k)) return 'valor:CUENTA_BANCARIA';
      if (/(diligencia|atestado|expediente)/.test(k)) return 'valor:DILIGENCIAS';
      if (!m.length) return 'skip';
      if (share(v => L.identificar(v)) >= 0.6) return 'delito';
      if (share(v => D.partir(v).tipo) >= 0.6) return share(v => D.parseDireccion(v).numero) >= 0.5 ? 'direccion' : 'via';
      const avg = m.reduce((s, v) => s + v.length, 0) / m.length;
      if (avg >= 30 && share(v => /\s/.test(v)) > 0.6) return 'texto';
      return 'skip';
    });
    if (!roles.includes('via')) roles.forEach((r, i) => { if (r === 'numero') roles[i] = 'skip'; });
    return roles;
  }

  // ---------- tokenización ----------
  function quitar(map, e) {
    const i = map.entries.indexOf(e); if (i >= 0) map.entries.splice(i, 1);
    e._dead = true;
    (e.keys || []).forEach(k => { if (map.keyIndex.get(k) === e) map.keyIndex.delete(k); });
  }
  /* opts: { modo: 'portal' | 'via', fuzzy: bool, delitosTexto: bool } */
  function tokenizar(tabla, roles, opts, map) {
    opts = opts || {};
    const t0 = Date.now();
    const modo = opts.modo === 'via' ? 'via' : 'portal';
    const { header, rows } = tabla;
    const cols = r => roles.map((x, i) => (x === r ? i : -1)).filter(i => i >= 0);
    const viaCols = cols('via'), dirCols = cols('direccion'), numCol = cols('numero').length ? cols('numero')[0] : -1;
    const pd = new Map(), parseDir = v => { if (!pd.has(v)) pd.set(v, D.parseDireccion(v)); return pd.get(v); };

    // 1. vías que aparecen en el CSV -> grupos (variantes de la misma vía)
    const items = new Map(), suma = v => { if (v) items.set(v, (items.get(v) || 0) + 1); };
    for (const r of rows) {
      for (const c of viaCols) suma(String(r[c] || '').trim());
      for (const c of dirCols) { const v = String(r[c] || '').trim(); if (v) suma(parseDir(v).via); }
    }
    const agr = D.agrupar([...items].map(([raw, count]) => ({ raw, count })), { fuzzy: opts.fuzzy !== false, noMerge: map.noMerge });
    map.agr = agr; map.modoDir = modo; map.detectarDelitos = opts.delitosTexto !== false;
    map.csvSchema = { header: header.slice(), viaCol: viaCols.length ? viaCols[0] : -1, numCol, modo, sep: tabla.sep };

    const usos = new Map(), stats = { celdas: 0, porCat: {}, coords: 0, textoSust: 0, filas: rows.length };
    const uso = e => { usos.set(e, (usos.get(e) || 0) + 1); return e; };
    /* si la clave ya tiene token se reutiliza tal cual (respetando si el usuario lo desactivó o le cambió la tipología) */
    const obtener = (key, cat, valor, origen, extra) => {
      const ex = map.keyIndex.get(key);
      if (ex && !ex._dead) { if (extra && extra.length) { extra.forEach(a => E.addAlias(ex, a)); E.indexar(map, ex); } return uso(ex); }
      return uso(E.registerOrReuse(map, valor, cat, origen, extra || [], key, { soloClave: true }));
    };
    const contar = e => { stats.celdas++; stats.porCat[e.category] = (stats.porCat[e.category] || 0) + 1; };
    const viaEntry = g => { const e = obtener('V:' + g.id, 'VIA', g.rep, 'CSV · vía'); e.grupo = g.id; return e; };
    const portalEntry = (g, num, numRaw, extra, cp, valorCelda) => {
      const key = D.clavePortal(g.id, num, extra, cp);
      const ex = map.keyIndex.get(key);
      if (ex && !ex._dead) return uso(ex);
      const nr = String(numRaw || '').trim();
      const e = obtener(key, 'DOMICILIO', valorCelda || (g.rep + (num.sn || !nr ? '' : ', ' + nr)), 'CSV · dirección (vía + número)');
      e.grupo = g.id;
      if (!valorCelda) e.parts = { via: g.rep, numero: num.sn ? nr : nr };
      return e;
    };

    // 2. celda a celda
    const out = rows.map(r => r.slice()), textos = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri], o = out[ri];
      for (let c = 0; c < roles.length; c++) {
        const role = roles[c], raw = r[c] == null ? '' : String(r[c]), v = raw.trim();
        if (!v || role === 'skip' || role === 'numero') continue;
        let e = null;
        if (role === 'via') {
          const g = agr.porRaw.get(v); if (!g) continue;
          if (modo === 'via') e = viaEntry(g);
          else {
            const numRaw = numCol >= 0 && c === viaCols[0] ? String(r[numCol] || '') : '';
            e = portalEntry(g, D.parseNumero(numRaw), numRaw, '', '');
            if (e.isEnabled && numCol >= 0 && c === viaCols[0]) o[numCol] = '';
          }
        } else if (role === 'direccion') {
          const p = parseDir(v), g = p.via ? agr.porRaw.get(p.via) : null;
          if (!g) e = obtener('DT:' + D.sinT(v).replace(/[^a-z0-9]+/g, ' ').trim(), 'DOMICILIO', v, 'CSV · dirección');
          else if (modo === 'via') {
            e = viaEntry(g);
            if (e.isEnabled) { const pos = raw.indexOf(p.via); o[c] = pos >= 0 ? raw.slice(0, pos) + e.token + raw.slice(pos + p.via.length) : e.token; contar(e); }
            continue;
          } else e = portalEntry(g, p.num, p.numero, p.restoKey, p.cp, v);
        } else if (role === 'delito') {
          const ent = L.identificar(v);
          e = obtener(ent ? 'DEL:' + ent.id : 'DELT:' + L.norm(v), 'DELITO', v,
            ent ? `CSV · delito (${ent.nombre}, art. ${ent.art} CP)` : 'CSV · delito (fuera del catálogo)', [v]);
        } else if (role === 'articulo') {
          e = obtener('ART:' + v.replace(/\s+/g, '').toLowerCase(), 'ART_CP', v, 'CSV · artículo CP');
          e.soloCelda = true;
        } else if (role === 'coord') {
          const n = parseFloat(v.replace(',', '.'));
          if (!isNaN(n)) { o[c] = v.includes(',') && !v.includes('.') ? n.toFixed(3).replace('.', ',') : n.toFixed(3); stats.coords++; }
          continue;
        } else if (role === 'texto') { textos.push([ri, c, raw]); continue; }
        else if (role.startsWith('valor:')) {
          const cat = role.slice(6);
          e = obtener(cat + ':' + (E.COMPACT.has(cat) ? E.compactKey(cat, v) : E.normKey(v)), cat, v, `CSV · columna «${header[c]}»`);
          if (v.length < 3 || /^\d{1,4}$/.test(v)) e.soloCelda = true;
        }
        if (e && e.isEnabled) { o[c] = e.token; contar(e); }
      }
    }
    // variantes de cada vía como alias: así también se reconocen dentro del texto libre
    for (const g of agr.grupos) {
      const e = map.keyIndex.get('V:' + g.id);
      if (e && !e._dead) { for (const raw of g.variantes.keys()) E.addAlias(e, raw); E.indexar(map, e); }
    }

    // 3. texto libre: primero se detecta en todas las celdas y después se sustituye
    if (textos.length) {
      const vistos = new Set();
      for (const [, , raw] of textos) if (!vistos.has(raw)) { vistos.add(raw); E.analizar(raw, map); }
      E.consolidar(map);
      const matcher = E.buildMatcher(map), porToken = new Map(map.entries.map(e => [e.token, e]));
      const memo = new Map();   // muchas celdas repiten el mismo texto ("Sin observaciones")
      for (const [ri, c, raw] of textos) {
        let res = memo.get(raw);
        if (!res) { res = E.capa4(raw, map, { matcher, noCand: true }); memo.set(raw, res); }
        out[ri][c] = res.tokenizedMarkdown;
        stats.textoSust += res.totalReplacements;
        for (const sg of res.segments) if (sg.kind === 'ConfirmedToken') { const e = porToken.get(sg.token); if (e) { uso(e); contar(e); } }
      }
    }
    // 3b. términos marcados a mano en la tabla tokenizada: se buscan en todas las celdas (salvo coordenadas y texto libre, ya hecho)
    const manuales = map.entries.filter(e => e.manual && e.isEnabled && !e._dead);
    if (manuales.length) {
      const matcher = E.buildMatcher({ entries: manuales, ignored: map.ignored }), porToken = new Map(manuales.map(e => [e.token, e])), memo = new Map();
      const RXT = /(\[\[[A-Z_]+_\d+\]\])/;
      const aplicar = v => {
        let r = memo.get(v);
        if (r === undefined) {
          let n = 0; const usados = [];
          const t = v.split(RXT).map((p, k) => {
            if (k % 2 || !p.trim()) return p;
            const x = E.capa4(p, map, { matcher, noCand: true });
            n += x.totalReplacements;
            for (const sg of x.segments) if (sg.kind === 'ConfirmedToken') usados.push(sg.token);
            return x.tokenizedMarkdown;
          }).join('');
          r = n ? { t, usados } : null; memo.set(v, r);
        }
        return r;
      };
      for (let ri = 0; ri < out.length; ri++) for (let c = 0; c < roles.length; c++) {
        if (roles[c] === 'coord' || roles[c] === 'texto') continue;
        const v = out[ri][c]; if (!v || !String(v).trim()) continue;
        const r = aplicar(String(v)); if (!r) continue;
        out[ri][c] = r.t;
        for (const tk of r.usados) { const e = porToken.get(tk); if (e) { uso(e); contar(e); } }
      }
    }
    // 4. se retiran del diccionario las entradas de una pasada anterior que ya no se usan
    for (const e of [...map.entries]) if (/^CSV/.test(e.origin) && !usos.has(e) && !e.importado) quitar(map, e);
    for (const e of map.entries) e.usos = usos.get(e) || 0;

    const revisar = [];
    for (const g of agr.grupos) for (const [raw, motivo] of g.motivos) revisar.push({ raw, rep: g.rep, motivo, n: g.variantes.get(raw), grupo: g.id });
    revisar.sort((a, b) => (a.motivo === 'sin tipo de vía') - (b.motivo === 'sin tipo de vía') || a.rep.localeCompare(b.rep));
    return { header, rows: out, sep: tabla.sep, stats, revisar, agr, ms: Date.now() - t0,
      vias: agr.grupos.length, variantes: items.size };
  }

  // ---------- destokenización (texto o CSV devuelto por la IA) ----------
  const RX_TOKEN = /^\s*\[\[\s*([A-Za-z_]+?)[\s_\-]*(\d+)\s*\]\]\s*$/;
  function entradaDeToken(map, t) {
    const m = RX_TOKEN.exec(t || ''); if (!m) return null;
    const tk = `[[${m[1].toUpperCase()}_${String(+m[2]).padStart(2, '0')}]]`;
    return map.entries.find(e => e.token === tk) || null;
  }
  function destokenizar(texto, map) {
    const sch = map.csvSchema;
    let tabla = null;
    const limpioTxt = String(texto || '').replace(/^\s*```[a-z]*[ \t]*\r?\n/i, '').replace(/\r?\n```\s*$/, '');
    const coincide = t => t && t.header.length === sch.header.length && t.header.every((h, i) => h === sch.header[i]);
    if (sch) for (const sp of [sch.sep, detectarSeparador(limpioTxt)]) { try { const t = parse(limpioTxt, sp); if (coincide(t)) { tabla = t; break; } } catch (_) {} }
    const esCsv = !!tabla;
    if (!esCsv) {
      const d = E.detokenize(texto, map);
      return { csv: false, texto: d.restoredText, segs: d.diffSegments, restaurados: d.restoredCount, noReconocidos: d.unresolvedCount };
    }
    let rc = 0, uc = 0;
    const filas = tabla.rows.map(r => {
      const o = r.slice(); let saltar = -1;
      if (sch.viaCol >= 0 && sch.numCol >= 0) {
        const e = entradaDeToken(map, r[sch.viaCol]);
        if (e && e.parts && !String(r[sch.numCol] || '').trim()) { o[sch.viaCol] = e.parts.via; o[sch.numCol] = e.parts.numero; rc++; saltar = sch.viaCol; }
      }
      for (let c = 0; c < o.length; c++) {
        if (c === saltar || !/\[\[/.test(o[c])) continue;
        const d = E.detokenize(o[c], map); o[c] = d.restoredText; rc += d.restoredCount; uc += d.unresolvedCount;
      }
      return o;
    });
    return { csv: true, texto: serialize(tabla.header, filas, sch.sep), header: tabla.header, filas, restaurados: rc, noReconocidos: uc };
  }

  return { parse, serialize, detectarSeparador, ROLES, detectarRoles, esCoordenada, tokenizar, destokenizar, entradaDeToken };
});
