(function () {
'use strict';
/* Pestaña «CSV por columnas»: carga, elección de columnas, tokenización, revisión, exportación y destokenización. */
const E = TokEngine, C = TokCSV, U = TokUI, $ = id => document.getElementById(id);
const status = m => { $('status').textContent = m; };
let cmap = E.createMap(), tabla = null, roles = [], res = null, nombre = 'csv', aiRaw = null, restCsv = null, dirty = false;

/* ---------- pestañas ---------- */
function tab(t) {
  document.body.dataset.tab = t;
  $('vTxt').style.display = t === 'csv' ? 'none' : '';
  $('vCsv').style.display = t === 'csv' ? '' : 'none';
  $('tabTxt').classList.toggle('on', t !== 'csv');
  $('tabCsv').classList.toggle('on', t === 'csv');
  if (t === 'csv') { fillTpl(); status(tabla ? `CSV «${nombre}» cargado (${tabla.rows.length} filas).` : 'Modo tabla: arrastra un CSV o un Excel al recuadro de la izquierda.'); }
}
$('tabTxt').onclick = () => tab('txt');
$('tabCsv').onclick = () => tab('csv');

/* ---------- carga ---------- */
function decode(buf) {
  const u = new Uint8Array(buf);
  if (u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF) return new TextDecoder('utf-8').decode(u.slice(3));
  if (u[0] === 0xFF && u[1] === 0xFE) return new TextDecoder('utf-16le').decode(u);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u); } catch (_) { return new TextDecoder('windows-1252').decode(u); }
}
let libro = null;   // hojas del Excel (o tablas del Word) cargado, para poder cambiar de hoja
async function abrir(f) {
  tab('csv');
  const L = window.TokLector;
  try {
    if (L && (L.esTabla(f.name) || L.esDocumento(f.name))) {
      status(`Leyendo «${f.name}»…`);
      const r = await L.leer(f);
      const hojas = (r.tipo === 'tabla' ? r.hojas : (r.tablas || []).map((filas, i) => ({ nombre: 'Tabla ' + (i + 1), filas })))
        .map(h => Object.assign({}, h, { tb: L.aTabla(h.filas) })).filter(h => h.tb.header.length && h.tb.rows.length);
      if (!hojas.length) {
        const queTiene = r.tipo === 'texto' && String(r.texto || '').trim();
        if (queTiene && confirm(`«${f.name}» no contiene ninguna tabla que se pueda tratar por columnas.\n\n¿Abrirlo en la pestaña «Texto»?`)) { tab('txt'); window.TokTexto.ingest([f]); }
        else if (!queTiene) alert(`«${f.name}» no contiene datos que se puedan leer.` + (r.aviso ? '\n\n' + r.aviso : ''));
        status('No se ha cargado ninguna tabla.');
        return;
      }
      libro = { archivo: f.name, formato: r.formato, hojas };
      const sel = $('cHoja');
      sel.innerHTML = hojas.map((h, i) => `<option value="${i}">${U.esc(h.nombre)} · ${h.tb.rows.length} filas${h.oculta ? ' (oculta)' : ''}</option>`).join('');
      let ini = 0;   // la hoja visible con más filas (la de datos, no la de resumen)
      hojas.forEach((h, i) => { if (!h.oculta && (hojas[ini].oculta || h.tb.rows.length > hojas[ini].tb.rows.length)) ini = i; });
      sel.value = String(ini); $('cHojaBox').style.display = hojas.length > 1 ? '' : 'none';
      cargarHoja(ini);
      return;
    }
    libro = null; $('cHojaBox').style.display = 'none';
    const tb0 = C.parse(decode(await f.arrayBuffer())), filas = [tb0.header, ...tb0.rows];
    const tb = L ? Object.assign(L.aTabla(filas), { sep: tb0.sep }) : tb0;   // detecta una fila de título encima de la cabecera
    const sep = { ';': 'punto y coma', ',': 'coma', '\t': 'tabulador', '|': 'barra vertical' }[tb0.sep] || tb0.sep;
    cargar(tb, f.name, 'separador: ' + sep, filas);
  } catch (e) { console.error(e); alert(`No se pudo leer «${f.name}»: ` + e.message); status('No se pudo leer el archivo.'); }
}
function cargarHoja(i) {
  const h = libro.hojas[i];
  $('cHoja').value = String(i);
  cargar(h.tb, libro.archivo, `${libro.formato}` + (libro.hojas.length > 1 || h.nombre !== 'Hoja1' ? ` · «${h.nombre}»` : ''), h.filas);
}
let fuente = null;   // filas tal cual vienen del archivo, para poder cambiar la fila de títulos
function cargar(tb, archivo, detalle, filas) {
  if (!tb.header.length || !tb.rows.length) { alert('El archivo está vacío o no tiene filas de datos.'); return; }
  fuente = { archivo, detalle, filas: filas || [tb.header, ...tb.rows] };
  ponerTabla(tb);
  abrirColumnas();
}
function ponerTabla(tb) {
  tabla = tb; nombre = fuente.archivo.replace(/\.[^.]+$/, ''); roles = C.detectarRoles(tb.header, tb.rows); res = null;
  cmap = E.createMap();
  $('cInfo').textContent = `Cargado: ${fuente.archivo} · ${tb.rows.length} filas · ${tb.header.length} columnas · ${fuente.detalle}`;
  renderCols(); renderPrev(); renderChips(); renderRev();
  status(`Tabla cargada: ${tb.rows.length} filas. Indica qué contiene cada columna y pulsa «Aplicar y tokenizar».`);
}
$('cHoja').onchange = () => { if (libro) cargarHoja(+$('cHoja').value); };

/* ---------- ventana para elegir las columnas sobre el propio archivo ---------- */
const COLOR_ROL = r => r === 'skip' ? '#ffffff' : /^(via|numero|direccion)$/.test(r) ? '#dcfce7' : r === 'delito' ? '#fee2e2' :
  r === 'articulo' ? '#fce7f3' : r === 'texto' ? '#fef9c3' : r === 'coord' ? '#ffedd5' : r === 'valor:DOMICILIO' ? '#d9f99d' : '#dbeafe';
const LETRA = j => { let s = ''; for (j++; j; j = Math.floor((j - 1) / 26)) s = String.fromCharCode(65 + (j - 1) % 26) + s; return s; };
function faltan() {
  const f = [];
  if (!roles.some(r => r !== 'skip')) f.push('indica qué contiene al menos una columna');
  if (roles.includes('numero') && !roles.includes('via')) f.push('hay columna de número de portal pero ninguna con el nombre de la vía');
  return f;
}
function abrirColumnas() {
  if (!tabla) { alert('CARGA UNA TABLA\n\nArrastra primero un CSV o un Excel al recuadro de la izquierda.'); return; }
  let fondo = $('modalCols');
  if (!fondo) { fondo = document.createElement('div'); fondo.id = 'modalCols'; document.body.appendChild(fondo); }
  fondo.style.display = 'flex';
  const cerrar = () => { fondo.style.display = 'none'; fondo.innerHTML = ''; document.removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', tecla);
  const opts = j => C.ROLES.map(([k, l]) => `<option value="${k}"${roles[j] === k ? ' selected' : ''}>${U.esc(l)}</option>`).join('');
  function pintar() {
    const H = tabla.header, nc = H.length, MAXF = 12;
    let th1 = '', th2 = '';
    for (let j = 0; j < nc; j++) {
      const bg = COLOR_ROL(roles[j]);
      th1 += `<th style="background:${bg}"><select data-j="${j}" class="${roles[j] !== 'skip' ? 'asig' : ''}">${opts(j)}</select></th>`;
      th2 += `<th style="background:${bg}" title="${U.esc(H[j])}">${LETRA(j)} · ${U.esc(H[j] || '(sin título)')}${C.esCoordenada(H[j]) ? ' ⚠' : ''}</th>`;
    }
    const cuerpo = tabla.rows.slice(0, MAXF).map(R => '<tr>' + H.map((_, j) => {
      const v = String(R[j] == null ? '' : R[j]);
      return `<td style="${roles[j] !== 'skip' ? 'background:' + COLOR_ROL(roles[j]) : 'color:#9aa3ad'}" title="${U.esc(v)}">${U.esc(v.slice(0, 80))}</td>`;
    }).join('') + '</tr>').join('');
    // así quedará: las primeras filas tokenizadas con lo elegido (sin tocar el diccionario real)
    let prev = '';
    const falta = faltan();
    if (!falta.length) {
      try {
        const m = E.createMap(), r = C.tokenizar({ header: H, rows: tabla.rows.slice(0, 5), sep: tabla.sep }, roles, opciones(), m);
        const porTok = new Map(m.entries.map(e => [e.token, e]));
        const usadas = H.map((_, j) => j).filter(j => roles[j] !== 'skip');
        prev = '<table><thead><tr>' + usadas.map(j => `<th>${U.esc(H[j])}</th>`).join('') + '</tr></thead><tbody>' +
          r.rows.map(row => '<tr>' + usadas.map(j => `<td>${celda(String(row[j] == null ? '' : row[j]).slice(0, 120), porTok)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
      } catch (e) { prev = '<span class="mal">No se ha podido generar la vista previa: ' + U.esc(e.message) + '</span>'; }
    }
    const hojas = libro && libro.hojas.length > 1 ? libro.hojas : null;
    fondo.innerHTML = `<div class="mcaja">
      <div class="mcab"><b>Columnas de «${U.esc(fuente.archivo)}»</b>
        <span class="mopc">
          ${hojas ? `<label>Hoja <select id="mHoja">${hojas.map((h, i) => `<option value="${i}"${String(i) === $('cHoja').value ? ' selected' : ''}>${U.esc(h.nombre)}</option>`).join('')}</select></label>` : ''}
          <label title="Fila del archivo donde están los nombres de las columnas">Fila de títulos <input id="mFila" type="number" min="1" max="${Math.min(fuente.filas.length - 1, 30)}" value="${(tabla.hi || 0) + 1}"></label>
          <span class="mut">Elige en el desplegable de cada columna qué contiene · ${tabla.rows.length} filas</span>
        </span></div>
      <div class="mtabla"><table><thead><tr>${th1}</tr><tr class="tit">${th2}</tr></thead><tbody>${cuerpo}</tbody></table></div>
      <div class="mprev"><b>Así quedará</b> <span class="mut">(primeras filas, solo las columnas que se tokenizan)</span>${prev || ''}</div>
      <div class="mpie"><span class="${falta.length ? 'mal' : 'bien'}">${falta.length ? 'Falta: ' + falta.join('; ') : '✔ Listo'}</span>
        <span><button class="b" id="mCancelar">Cancelar</button> <button class="b f" id="mAplicar"${falta.length ? ' disabled' : ''}>🛡️ Aplicar y tokenizar</button></span></div>
    </div>`;
    fondo.querySelectorAll('select[data-j]').forEach(s => { s.onchange = () => { roles[+s.dataset.j] = s.value; renderCols(); pintar(); }; });
    $('mFila').onchange = () => {
      const f = Math.max(0, Math.min(fuente.filas.length - 2, (+$('mFila').value || 1) - 1));
      const tb = window.TokLector ? Object.assign(window.TokLector.aTabla(fuente.filas, f), { sep: tabla.sep }) : tabla;
      if (tb.header.length && tb.rows.length) { ponerTabla(tb); pintar(); }
    };
    if ($('mHoja')) $('mHoja').onchange = () => { cerrar(); cargarHoja(+$('mHoja').value); };
    $('mCancelar').onclick = cerrar;
    $('mAplicar').onclick = () => { if (faltan().length) return; cerrar(); tokenizar(); };
  }
  pintar();
}
$('cColsBtn').onclick = abrirColumnas;
function renderCols() {
  const tb = $('cCols'); tb.innerHTML = '';
  tabla.header.forEach((h, i) => {
    const tr = document.createElement('tr');
    const ej = [...new Set(tabla.rows.slice(0, 300).map(r => String(r[i] || '').trim()).filter(Boolean))].slice(0, 3);
    const td1 = document.createElement('td');
    td1.innerHTML = '<b>' + U.esc(h || '(sin nombre)') + '</b><span class="ej" title="' + U.esc(ej.join('\n')) + '">' + U.esc(ej.join(' · ') || '(vacía)') + '</span>';
    if (C.esCoordenada(h)) { tr.className = 'aviso'; td1.innerHTML += '<small>⚠ Las coordenadas sitúan el lugar exacto: valora redondearlas.</small>'; }
    const td2 = document.createElement('td'), sel = document.createElement('select');
    for (const [k, l] of C.ROLES) { const o = document.createElement('option'); o.value = k; o.textContent = l; if (k === roles[i]) o.selected = true; sel.appendChild(o); }
    sel.onchange = () => { roles[i] = sel.value; };
    td2.appendChild(sel);
    tr.append(td1, td2); tb.appendChild(tr);
  });
}
$('cDrop').onclick = () => $('cFile').click();
$('cFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) abrir(f); };

/* ---------- tokenización ---------- */
const opciones = () => ({ modo: $('cModo').value, fuzzy: $('cFuzzy').checked, delitosTexto: $('cDelTxt').checked });
const pendientes = () => (res ? res.revisar.filter(x => x.motivo !== 'sin tipo de vía').length : 0);
function ejecutar() {
  res = C.tokenizar(tabla, roles, opciones(), cmap);
  renderPrev(); renderChips(); renderRev();
  redetokC();
}
function tokenizar() {
  if (!tabla) { alert('CARGA UNA TABLA\n\nArrastra primero un CSV o un Excel al recuadro de la izquierda.'); return; }
  if (!roles.some(r => r !== 'skip')) { alert('NINGUNA COLUMNA SELECCIONADA\n\nIndica qué contiene al menos una columna.'); return; }
  if (roles.includes('numero') && !roles.includes('via')) { alert('Has marcado una columna de número de portal pero ninguna con el nombre de la vía.'); return; }
  status('Tokenizando el CSV…'); $('cRun').disabled = true;
  setTimeout(() => {
    try {
      ejecutar();
      const rv = pendientes();
      status(`CSV tokenizado en ${(res.ms / 1000).toFixed(1)} s: ${res.stats.celdas} sustituciones` +
        (res.variantes ? ` · ${res.variantes} formas de escribir las vías agrupadas en ${res.vias} vías` : '') +
        (rv ? ` · ${rv} agrupaciones por parecido para revisar` : '') + '.');
    } catch (e) { console.error(e); status('Error al tokenizar: ' + e.message); }
    finally { $('cRun').disabled = false; }
  }, 30);
}
$('cRun').onclick = tokenizar;
$('cReset').onclick = () => {
  if ((tabla || cmap.entries.length) && !confirm('¿Empezar de nuevo? Se borran la tabla cargada y sus tokens: después ya no se podrán destokenizar las respuestas de la IA sobre ella.')) return;
  cmap = E.createMap(); tabla = null; res = null; roles = []; aiRaw = null; libro = null; $('cHojaBox').style.display = 'none';
  $('cCols').innerHTML = '<tr><td colspan="2" class="ph">Carga un CSV para ver sus columnas.</td></tr>';
  $('cInfo').textContent = 'Se detectan solos el separador y lo que contiene cada columna';
  $('cAi').innerHTML = ''; renderPrev(); renderChips(); renderRev(); redetokC();
  status('Modo CSV reiniciado: diccionario en blanco.');
};

/* ---------- vista previa ---------- */
const RXT = /(\[\[[A-Z_]+_\d+\]\])/;
function celda(v, porTok) {
  return String(v).split(RXT).map((p, k) => {
    if (!(k % 2)) return U.esc(p);
    const e = porTok.get(p);
    return `<span class="tok" title="${U.esc(e ? e.originalValue + ' (' + e.category + ')' : '')}">${p}</span>`;
  }).join('');
}
function renderPrev() {
  const box = $('cPrev');
  if (!res) { box.innerHTML = '<div class="ph" style="padding:10px">' + (tabla ? 'Pulsa «Tokenizar CSV» para ver aquí la tabla tokenizada.' : 'La tabla tokenizada aparecerá aquí.') + '</div>'; return; }
  const porTok = new Map(cmap.entries.map(e => [e.token, e])), MAX = 300;
  let h = '<table><thead><tr>' + res.header.map(x => `<th>${U.esc(x)}</th>`).join('') + '</tr></thead><tbody>';
  for (const row of res.rows.slice(0, MAX)) h += '<tr>' + row.map(c => `<td>${celda(c, porTok)}</td>`).join('') + '</tr>';
  h += '</tbody></table>';
  if (res.rows.length > MAX) h += `<div class="mut" style="padding:6px">Vista previa de las primeras ${MAX} de ${res.rows.length} filas. La exportación incluye todas.</div>`;
  box.innerHTML = h;
}
function renderChips() {
  const c = $('cChips'); c.innerHTML = '';
  const add = (cls, t) => { const s = document.createElement('span'); s.className = cls; s.textContent = t; c.appendChild(s); };
  if (!res) { add('c-ok', '🔒 0 celdas protegidas'); return; }
  const n = cats => cmap.entries.filter(e => cats.includes(e.category) && e.isEnabled && e.usos).length;
  add('c-ok', `🔒 ${res.stats.celdas} sustituciones`);
  if (n(['DOMICILIO', 'VIA'])) add('c-ok', `📍 ${n(['DOMICILIO', 'VIA'])} direcciones`);
  if (n(['DELITO'])) add('c-ok', `⚖️ ${n(['DELITO'])} delitos`);
  const otros = cmap.entries.filter(e => e.isEnabled && e.usos && !['DOMICILIO', 'VIA', 'DELITO', 'ART_CP'].includes(e.category)).length;
  if (otros) add('c-ok', `👤 ${otros} otros datos`);
  if (res.stats.coords) add('c-ok', `🌐 ${res.stats.coords} coordenadas redondeadas`);
  if (pendientes()) { add('c-warn', `⚠️ ${pendientes()} agrupaciones por revisar`); const s = c.lastChild; s.style.cursor = 'pointer'; s.title = 'Abrir el mapa de equivalencias en «Agrupaciones de vías»'; s.onclick = () => abrirMapa('rev'); }
}

/* ---------- tokenizar texto seleccionado en la tabla tokenizada ---------- */
const BORDE = /^[\s,.;:()"'\[\]{}“”«»—–\-¿?¡!]+|[\s,.;:()"'\[\]{}“”«»—–\-¿?¡!]+$/g;
function seleccion() {
  const sel = getSelection(); if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
  const rg = sel.getRangeAt(0), box = $('cPrev');
  if (!box.contains(rg.commonAncestorContainer)) return null;
  const el = n => (n.nodeType === 3 ? n.parentElement : n);
  if (el(rg.startContainer).closest('th') || el(rg.endContainer).closest('th')) return { cabecera: true };
  const a = el(rg.startContainer).closest('.tok'), b = el(rg.endContainer).closest('.tok');
  if (a && a === b) { const e = cmap.entries.find(x => x.token === a.textContent); return e ? { entry: e } : null; }
  const crudo = sel.toString();
  if (/[\t\n]/.test(crudo.trim())) return { varias: true };
  const t = crudo.replace(/\s+/g, ' ').replace(BORDE, '');
  if (!t) return { invalid: true };
  if (/\[\[[A-Z_]+_\d+\]\]/.test(t)) return { conToken: true };
  return { text: t };
}
function avisoSel(info) {
  if (!info) { alert('SELECCIONE UN TEXTO\n\nSeleccione con el ratón, dentro de una celda de la tabla tokenizada (panel central), el nombre o dato que falta por tokenizar y vuelva a pulsar este botón.\n\nSe tokenizará en todas las celdas en las que aparezca.'); return true; }
  if (info.cabecera) { alert('SELECCIONE TEXTO DE LAS CELDAS\n\nLos nombres de las columnas no se tokenizan.'); return true; }
  if (info.varias) { alert('SELECCIONE DENTRO DE UNA SOLA CELDA\n\nLa selección abarca varias celdas.'); return true; }
  if (info.conToken) { alert('LA SELECCIÓN INCLUYE UN TOKEN\n\nSeleccione solo el texto sin tokenizar, o solo el token (para corregir su tipología o revertirlo).'); return true; }
  if (info.invalid) { alert('SELECCIONE UN TEXTO VÁLIDO\n\nLa selección contiene solo signos de puntuación o espacios.'); return true; }
  return false;
}
function reaplicar(msg) {
  if (!tabla) return;
  status('Aplicando el cambio a todas las celdas…');
  setTimeout(() => { try { ejecutar(); status(msg); } catch (e) { console.error(e); status('Error al tokenizar: ' + e.message); } }, 20);
}
const OPS_CSV = {
  textoRevertir: '↩ Revertir a texto original en todas las celdas (desactivar token)',
  revertir: e => { e.isEnabled = false; cmap.ignored.add(E.normKey(e.originalValue)); reaplicar(`Token ${e.token} revertido: «${e.originalValue}» vuelve a verse tal cual en todas las celdas.`); },
  cambiar: (e, c) => { const m = E.cambiarCategoria(cmap, e, c); reaplicar(m); },
  aprender: (t, c) => {
    cmap.ignored.delete(E.normKey(t));
    const e = E.registerOrReuse(cmap, t, c, 'Selección manual (CSV)');
    e.manual = true; e.isEnabled = true;
    reaplicar(`«${t}» tokenizado como ${e.token} en todas las celdas en las que aparece.`);
  }
};
$('cSel').addEventListener('click', () => {
  if (!res) { alert('SIN CSV TOKENIZADO\n\nCarga un archivo y pulsa «Tokenizar CSV»; después selecciona en la tabla el texto que falte por tokenizar.'); return; }
  const info = seleccion(); if (avisoSel(info)) return;
  window.TokMenu.sobre($('cSel'), info, OPS_CSV);
});
$('cPrev').addEventListener('contextmenu', e => {
  const info = seleccion();
  if (info && (info.text || info.entry)) { e.preventDefault(); window.TokMenu.abrir(e.clientX, e.clientY, info, OPS_CSV); return; }
  const t = e.target.closest('.tok'); if (!t) return;
  const en = cmap.entries.find(x => x.token === t.textContent);
  if (en) { e.preventDefault(); window.TokMenu.abrir(e.clientX, e.clientY, { entry: en }, OPS_CSV); }
});

/* ---------- revisar agrupaciones ---------- */
function renderRev() {
  const body = $('revBody'); body.innerHTML = '';
  const lista = res ? res.revisar.filter(x => $('revSinTipo').checked || x.motivo !== 'sin tipo de vía') : [];
  $('cmTabRev').textContent = `🔎 Agrupaciones de vías (${lista.length})`;
  for (const raw of cmap.noMerge) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><b>${U.esc(raw)}</b></td><td></td><td class="mut">— separada por ti —</td><td class="mut">vía propia</td>`;
    const td = document.createElement('td'), b = document.createElement('button'); b.className = 'b sm'; b.textContent = '↩ Volver a unir';
    b.onclick = () => { cmap.noMerge.delete(raw); ejecutar(); renderRev(); status(`«${raw}» vuelve a agruparse por parecido.`); };
    td.appendChild(b); tr.appendChild(td); body.appendChild(tr);
  }
  if (!lista.length && !cmap.noMerge.size) { body.innerHTML = '<tr><td colspan="5" class="ph">No hay variantes agrupadas por parecido.</td></tr>'; return; }
  for (const x of lista) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><b>${U.esc(x.raw)}</b></td><td>${x.n}</td><td>${U.esc(x.rep)}</td><td class="mut">${U.esc(x.motivo)}</td>`;
    const td = document.createElement('td'), b = document.createElement('button'); b.className = 'b sm r'; b.textContent = '✂ Separar';
    b.onclick = () => { cmap.noMerge.add(x.raw); ejecutar(); renderRev(); status(`«${x.raw}» se trata ahora como una vía distinta, con su propio token.`); };
    td.appendChild(b); tr.appendChild(td); body.appendChild(tr);
  }
}
$('revSinTipo').onchange = renderRev;

/* ---------- mapa de equivalencias ---------- */
(() => { const s = $('cmCat'); s.innerHTML = '<option value="">Todas las categorías</option>'; for (const [k, l] of E.CATS) { const o = document.createElement('option'); o.value = k; o.textContent = l; s.appendChild(o); } })();
function variantes(e) {
  const g = e.grupo && cmap.agr ? cmap.agr.grupos.find(x => x.id === e.grupo) : null;
  return g ? [...g.variantes.keys()] : e.aliases;
}
function renderCMap() {
  const q = E.qt($('cmQ').value.trim()), cat = $('cmCat').value, body = $('cmBody'), MAX = 400; body.innerHTML = '';
  const lista = cmap.entries.filter(e => (!cat || e.category === cat) && (!q || E.qt(e.token + ' ' + e.originalValue + ' ' + e.aliases.join(' ')).includes(q)));
  $('cmTotal').textContent = `${cmap.entries.length} tokens`;
  for (const e of lista.slice(0, MAX)) {
    const tr = document.createElement('tr');
    const c1 = document.createElement('td'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = e.isEnabled;
    cb.onchange = () => { e.isEnabled = cb.checked; dirty = true; }; c1.appendChild(cb);
    const c2 = document.createElement('td'); c2.className = 'mono'; c2.textContent = e.token;
    const c3 = document.createElement('td'), inp = document.createElement('input'); inp.type = 'text'; inp.value = e.originalValue;
    inp.onchange = () => { const v = inp.value.trim(); if (!v) { inp.value = e.originalValue; return; } e.originalValue = v; if (e.parts) e.parts = null; dirty = true; };
    c3.appendChild(inp);
    const c4 = document.createElement('td'); c4.textContent = e.category;
    const c5 = document.createElement('td'); c5.textContent = e.usos || 0;
    const c6 = document.createElement('td'), v = variantes(e); c6.className = 'mut';
    c6.textContent = v.length ? `${v.length} variante${v.length > 1 ? 's' : ''}` : '—'; c6.title = v.join('\n');
    tr.append(c1, c2, c3, c4, c5, c6); body.appendChild(tr);
  }
  $('cmMore').textContent = lista.length > MAX ? `Mostrando ${MAX} de ${lista.length}. Usa el buscador o el filtro de categoría para ver el resto.` : (lista.length ? '' : 'Sin resultados.');
}
function verPagina(p) {
  const rev = p === 'rev';
  $('cmPagTok').style.display = rev ? 'none' : ''; $('cmPagRev').style.display = rev ? '' : 'none';
  $('cmFiltros').style.visibility = rev ? 'hidden' : '';
  $('cmTabTok').classList.toggle('f', !rev); $('cmTabRev').classList.toggle('f', rev);
}
function abrirMapa(p) { renderCMap(); renderRev(); verPagina(p); $('dCMap').showModal(); }
$('cMapBtn').onclick = () => abrirMapa('tok');
$('cmTabTok').onclick = () => verPagina('tok');
$('cmTabRev').onclick = () => verPagina('rev');
$('cmQ').addEventListener('input', renderCMap); $('cmCat').onchange = renderCMap;
$('cmClose').onclick = () => { $('dCMap').close(); if (dirty && tabla && res) { dirty = false; ejecutar(); status('Cambios del mapa aplicados al CSV.'); } else if (dirty) { dirty = false; redetokC(); } };

/* ---------- prompt, copiar y exportar ---------- */
const plantillas = () => (window.TokPlantillas && window.TokPlantillas().length ? window.TokPlantillas() : E.PLANTILLAS);
function fillTpl() {
  const sel = $('cTpl'), prev = sel.value; sel.innerHTML = '';
  for (const t of plantillas()) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.title; sel.appendChild(o); }
  sel.value = prev && [...sel.options].some(o => o.value === prev) ? prev : ([...sel.options].some(o => o.value === 'ESTADISTICA_PERIODO') ? 'ESTADISTICA_PERIODO' : sel.options[0] && sel.options[0].value);
}
const curTpl = () => plantillas().find(t => t.id === $('cTpl').value) || E.PLANTILLAS[0];
const csvTok = () => C.serialize(res.header, res.rows, res.sep);
const need = () => { if (!res) { alert('SIN CSV TOKENIZADO\n\nCarga un CSV y pulsa «Tokenizar CSV».'); return false; } return true; };
$('cCopyAll').onclick = async () => { if (!need()) return; const t = E.buildPrompt(curTpl(), '```csv\n' + csvTok() + '\n```'); status((await U.copyText(t)) ? `✅ Copiado: prompt «${curTpl().title}» + CSV tokenizado (${res.rows.length} filas).` : 'No se pudo copiar.'); };
$('cCopy').onclick = async () => { if (!need()) return; status((await U.copyText(csvTok())) ? '✅ CSV tokenizado copiado al portapapeles.' : 'No se pudo copiar.'); };
$('cCopyPrompt').onclick = async () => { status((await U.copyText(E.buildPrompt(curTpl(), '').trim())) ? `✅ Copiado el prompt «${curTpl().title}».` : 'No se pudo copiar.'); };
$('cExpCsv').onclick = () => { if (!need()) return; U.download(`${nombre}_tokenizado_${U.stamp()}.csv`, U.csvBlob(csvTok())); status('CSV tokenizado guardado (no contiene datos reales).'); };
$('cExpTxt').onclick = () => { if (!need()) return; U.download(`${nombre}_tokenizado_${U.stamp()}.txt`, U.txtBlob(csvTok())); status('CSV tokenizado guardado como .txt (no contiene datos reales).'); };
$('cExpXlsx').onclick = () => { if (!need()) return; U.download(`${nombre}_tokenizado_${U.stamp()}.xlsx`, U.xlsxDeTabla(res.header, res.rows, 'Tokenizado')); status('Tabla tokenizada guardada como Excel (.xlsx); no contiene datos reales.'); };
$('cExpDocx').onclick = () => {
  if (!need()) return;
  status('Generando el .docx…');
  setTimeout(() => {
    const h = '<table><thead><tr>' + res.header.map(x => `<th>${U.esc(x)}</th>`).join('') + '</tr></thead><tbody>' + res.rows.map(r => '<tr>' + r.map(c => `<td>${U.esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    U.download(`${nombre}_tokenizado_${U.stamp()}.docx`, U.docxDeHtml(U.htmlEl(h)));
    status('CSV tokenizado guardado como tabla de Word (.docx).');
  }, 30);
};

/* ---------- destokenización ---------- */
function redetokC() {
  const src = $('cAi'), out = $('cRestOut'); restCsv = null;
  if (!src.textContent.trim()) {
    out.innerHTML = '<span class="ph">El resultado destokenizado aparecerá aquí. Si pegas o arrastras el CSV tokenizado, se recompone la tabla original (vía y número en sus columnas).</span>';
    $('cUnresN').style.display = 'none'; return;
  }
  let rc, uc;
  const d = C.destokenizar(aiRaw != null ? aiRaw : U.domToText(src), cmap);
  if (d.csv) {
    restCsv = d; rc = d.restaurados; uc = d.noReconocidos; const MAX = 300;
    let h = '<table><thead><tr>' + d.header.map(x => `<th>${U.esc(x)}</th>`).join('') + '</tr></thead><tbody>' +
      d.filas.slice(0, MAX).map(r => '<tr>' + r.map(c => `<td>${U.esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    if (d.filas.length > MAX) h += `<p class="mut">Vista previa de ${MAX} de ${d.filas.length} filas. «⬇ .csv» descarga todas.</p>`;
    out.innerHTML = h;
  } else { const r = U.destokenizarDom(src, out, cmap, E); rc = r.rc; uc = r.uc; }
  $('cUnresN').textContent = `❌ ${uc} No reconocidos`; $('cUnresN').style.display = uc ? '' : 'none';
  status(restCsv ? `CSV destokenizado: ${restCsv.filas.length} filas recompuestas (${rc} datos restaurados).` : `Destokenización: ${rc} datos restaurados${uc ? `, ${uc} tokens no reconocidos` : ''} (formato conservado).`);
}
const trasPegar = () => { redetokC(); if ($('cRestOut').textContent.trim() && !$('cRestOut').querySelector('.ph')) U.verResultado($('cAi')); };
U.enlazarPegado($('cAi'), raw => { aiRaw = raw; trasPegar(); });
$('cAi').addEventListener('input', () => { aiRaw = null; redetokC(); });
$('cRestOut').addEventListener('focus', () => { const p = $('cRestOut').querySelector('.ph'); if (p) p.remove(); });
$('cPasteAi').onclick = async () => { const d = await U.readClipRich(); if (d.html || d.text) { $('cAi').innerHTML = ''; U.pegarEn($('cAi'), d); aiRaw = d.text || null; trasPegar(); } };
$('cClearAi').onclick = () => { $('cAi').innerHTML = ''; aiRaw = null; redetokC(); U.verEntrada($('cAi')); };
const needR = () => { if (!$('cRestOut').textContent.trim() || $('cRestOut').querySelector('.ph')) { alert('SIN TEXTO DESTOKENIZADO\n\nPega primero la respuesta de la IA o el CSV tokenizado.'); return false; } return true; };
$('cCopyRest').onclick = async () => { if (!needR()) return; const ok = restCsv ? await U.copyText(restCsv.texto) : await U.copyRich($('cRestOut')); status(ok ? '✅ Resultado copiado.' : 'No se pudo copiar.'); };
$('cRestCsv').onclick = () => {
  if (!needR()) return;
  let t = restCsv ? restCsv.texto : null;
  if (!t) { const plano = U.domToText($('cRestOut')), tb = C.parse(plano); t = tb.header.length > 1 ? C.serialize(tb.header, tb.rows, tb.sep) : U.textoACsv(plano, C.serialize); }
  U.download(`${nombre}_destokenizado_${U.stamp()}.csv`, U.csvBlob(t)); status('Resultado guardado como .csv. CONTIENE LOS DATOS REALES.');
};
$('cRestXlsx').onclick = () => {
  if (!needR()) return;
  let h, r;
  if (restCsv) { h = restCsv.header; r = restCsv.filas; }
  else { const tb = C.parse(U.textoACsv(U.domToText($('cRestOut')), C.serialize), ';'); h = tb.header; r = tb.rows; }
  U.download(`${nombre}_destokenizado_${U.stamp()}.xlsx`, U.xlsxDeTabla(h, r, 'Destokenizado')); status('Resultado guardado como Excel (.xlsx). CONTIENE LOS DATOS REALES.');
};
$('cRestTxt').onclick = () => { if (!needR()) return; U.download(`${nombre}_destokenizado_${U.stamp()}.txt`, U.txtBlob(restCsv ? restCsv.texto : U.domToText($('cRestOut')))); status('Resultado guardado como .txt (formato conservado).'); };
$('cRestDocx').onclick = () => {
  if (!needR()) return;
  let el = $('cRestOut');
  if (restCsv) el = U.htmlEl('<table><thead><tr>' + restCsv.header.map(x => `<th>${U.esc(x)}</th>`).join('') + '</tr></thead><tbody>' + restCsv.filas.map(r => '<tr>' + r.map(c => `<td>${U.esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
  U.download(`${nombre}_destokenizado_${U.stamp()}.docx`, U.docxDeHtml(el)); status('Resultado guardado como .docx con su formato.');
};

/* ---------- arrastrar archivos en la pestaña CSV ---------- */
document.addEventListener('dragover', e => { if (document.body.dataset.tab === 'csv' && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); $('cDrop').classList.add('over'); } });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) $('cDrop').classList.remove('over'); });
document.addEventListener('drop', async e => {
  if (document.body.dataset.tab !== 'csv' || !e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault(); $('cDrop').classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (e.target.closest && e.target.closest('#cAi,#cRestOut')) {
    const L = window.TokLector;
    let t;
    try {
      if (L && (L.esTabla(f.name) || L.esDocumento(f.name))) {
        const r = await L.leer(f);
        if (r.tipo === 'tabla') { const h = r.hojas.map(x => L.aTabla(x.filas)).find(x => x.header.length); t = h ? C.serialize(h.header, h.rows, (cmap.csvSchema && cmap.csvSchema.sep) || ';') : ''; }
        else t = r.texto || '';
      } else t = decode(await f.arrayBuffer());
    } catch (err) { alert(`No se pudo leer «${f.name}»: ` + err.message); return; }
    aiRaw = t;
    $('cAi').innerHTML = `<p>📄 <b>${U.esc(f.name)}</b> · ${t.split(/\r?\n/).filter(Boolean).length} líneas</p>`;
    trasPegar(); return;
  }
  abrir(f);
});

window.TokCsvUI = { abrir, get map() { return cmap; }, get res() { return res; } };
tab('txt'); fillTpl(); renderPrev(); redetokC();
})();
