'use strict';
/* TokDir — Direcciones postales en castellano y valenciano.
   - partir(via): separa tipo de vía y núcleo del nombre, normalizado (sin tildes, sin artículos,
     valenciano -> castellano), para que "Carrer Major", "C/ Mayor" y "CALLE MAYOR" den la misma clave.
   - parseNumero / parseDireccion: número de portal, extensión (12-B), piso/puerta, s/n, CP.
   - agrupar(lista): agrupa las variantes de una misma vía dentro de un CSV (erratas, títulos omitidos,
     nombre abreviado) de forma conservadora: si hay duda entre dos calles, NO agrupa.
   - detectar(texto): localiza direcciones en texto libre. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TokDir = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const sinT = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const escRe = c => c.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const lista = s => s.split(',').map(x => x.trim()).filter(Boolean);

  // ---------- tipos de vía (forma normalizada -> tipo canónico) ----------
  const TIPOS = {};
  const T = (canon, s) => lista(s).forEach(x => { TIPOS[x] = canon; });
  T('CALLE', 'c,cl,cll,clle,cale,calle,carrer,carre,cr');
  T('AVENIDA', 'av,avd,avda,avenida,avinguda,avgda,avg,avnda');
  T('PLAZA', 'pl,pza,plz,plza,plaza,placa,pca');
  T('PASEO', 'ps,pso,pg,paseo,passeig,pseo');
  T('CAMINO', 'cno,cm,cmno,camino,cami');
  T('CARRETERA', 'ctra,crta,carretera');
  T('TRAVESIA', 'trav,tr,travesia,travessia,travessera');
  T('RONDA', 'rda,ronda');
  T('GLORIETA', 'gta,glorieta');
  T('ROTONDA', 'rotonda');
  T('PASAJE', 'pje,psje,pasaje,passatge,ptge,pasadizo');
  T('PARTIDA', 'pda,ptda,partida');
  T('URBANIZACION', 'urb,urbanizacion,urbanitzacio,urbanizacio');
  T('DISEMINADO', 'diseminado,diseminados,disem');
  T('POLIGONO', 'pol,polig,poligono,poligon');
  T('BARRIO', 'bo,barrio,barri,bda,barriada');
  T('SENDA', 'senda,sda,sendera');
  T('CALLEJON', 'callejon,cjon,carrero,atzucac');
  T('CUESTA', 'cuesta,costera,pujada,baixada,bajada');
  T('BULEVAR', 'blvr,bulevar,boulevard');
  T('RAMBLA', 'rambla,rbla');
  T('GRUPO', 'grupo,grup');
  T('ALAMEDA', 'alameda,albereda');
  T('MUELLE', 'muelle,moll');
  T('PARQUE', 'parque,parc');
  T('JARDIN', 'jardin,jardi,jardines,jardins');
  T('PARAJE', 'paraje,paratge');
  T('AUTOVIA', 'autovia,autopista');
  T('VEREDA', 'vereda,assagador,canada');
  T('PLAZUELA', 'plazoleta,plazuela,placeta');
  T('COLONIA', 'colonia');
  T('CARRIL', 'carril');
  // nombres largos de tipo que se aceptan con una errata ("Avnida", "Carretrea")
  const TIPOS_LARGOS = lista('carrer,avenida,avinguda,carretera,travesia,partida,urbanizacion,diseminado,poligono,passeig,glorieta');

  // ---------- títulos, nombres de pila y equivalencias valenciano -> castellano ----------
  const TITULOS = new Set(lista('actriz,actor,padre,madre,hermano,hermanos,hermana,san,santa,santo,santos,maestro,maestra,medico,medica,doctor,doctora,escritor,escritora,musico,profesor,profesora,pintor,pintora,poeta,poetisa,escultor,escultora,literato,cardenal,obispo,arzobispo,rey,reina,principe,princesa,infanta,infante,conde,condesa,marques,marquesa,duque,duquesa,baron,general,capitan,coronel,teniente,comandante,almirante,alcalde,alcaldesa,arquitecto,ingeniero,pirotecnico,periodista,cantante,compositor,compositora,abogado,juez,sor,beato,beata,papa,presidente,cronista,secretario,mosen,don,dona,senor,senora,fray,ministro,concejal,notario,farmaceutico,catedratico,tenor,soprano,guitarrista,ciclista,torero,aviador,sargento'));
  const NOMBRES = new Set(lista('antonio,jose,juan,francisco,vicente,manuel,miguel,pedro,luis,carlos,jaime,jorge,enrique,martin,ramon,rafael,salvador,joaquin,andres,pablo,tomas,roque,bernardo,cristobal,domingo,esteban,jeronimo,lorenzo,lucas,mateo,nicolas,pascual,sebastian,isidro,ignacio,felipe,gabriel,bartolome,blas,agustin,eduardo,fernando,gonzalo,guillermo,joaquin,leonardo,ricardo,roberto,valentin,javier,alfonso,fernando,federico,maria,ana,carmen,isabel,teresa,rosa,dolores,amparo,josefa,pilar,juana,francisca,vicenta,mercedes,concepcion,catalina,margarita,ines,luisa,julia,elena,lucia,clara,marta,victoria,asuncion,angeles,remedios,consuelo,empar'));
  const PALABRAS = {
    actriu: 'actriz', pare: 'padre', mare: 'madre', germa: 'hermano', germans: 'hermanos', germana: 'hermana',
    sant: 'san', st: 'san', sants: 'santos', sta: 'santa', sto: 'santo', verge: 'virgen',
    mestre: 'maestro', mestra: 'maestra', mtro: 'maestro', mtra: 'maestra', metge: 'medico', metgessa: 'medica',
    escriptor: 'escritor', escriptora: 'escritora', music: 'musico', professor: 'profesor', professora: 'profesora',
    prof: 'profesor', bisbe: 'obispo', arquebisbe: 'arzobispo', rei: 'rey', princep: 'principe', comte: 'conde',
    comtessa: 'condesa', duc: 'duque', baro: 'baron', secretari: 'secretario', mossen: 'mosen',
    dr: 'doctor', dra: 'doctora', pdre: 'padre', ntra: 'nuestra', ntro: 'nuestro', nostra: 'nuestra', nostre: 'nuestro',
    sra: 'senora', senyora: 'senora', sr: 'senor', senyor: 'senor', fco: 'francisco', gral: 'general',
    creu: 'cruz', font: 'fuente', fonts: 'fuentes', pont: 'puente', riu: 'rio', sequia: 'acequia', major: 'mayor',
    nou: 'nuevo', nova: 'nuevo', nueva: 'nuevo', vell: 'viejo', vella: 'viejo', vieja: 'viejo',
    alt: 'alto', alta: 'alto', baix: 'bajo', baixa: 'bajo', baja: 'bajo', ample: 'ancho', ampla: 'ancho', ancha: 'ancho',
    llarg: 'largo', llarga: 'largo', larga: 'largo', hort: 'huerto', horts: 'huertos', horta: 'huerta',
    brac: 'brazo', esglesia: 'iglesia', estacio: 'estacion', mercat: 'mercado', port: 'puerto', pou: 'pozo',
    forn: 'horno', moli: 'molino', molins: 'molinos', raco: 'rincon', lluna: 'luna', estrela: 'estrella', estel: 'estrella',
    cel: 'cielo', muntanya: 'montana', nord: 'norte', sud: 'sur', oest: 'oeste', ponent: 'poniente', llevant: 'levante',
    ciutat: 'ciudad', poble: 'pueblo', regne: 'reino', corts: 'cortes', furs: 'fueros', germanies: 'germanias',
    constitucio: 'constitucion', llibertat: 'libertad', pau: 'paz', esperanca: 'esperanza', assumpcio: 'asuncion',
    concepcio: 'concepcion', encarnacio: 'encarnacion', purissima: 'purisima', remei: 'remedios', consol: 'consuelo',
    pietat: 'piedad', angels: 'angeles', desemparats: 'desamparados', dolors: 'dolores', merce: 'mercedes',
    rosari: 'rosario', carme: 'carmen', vall: 'valle', camp: 'campo',
    valencianes: 'valencianas', valencians: 'valencianos', catalanes: 'catalanas',
    germanes: 'hermanas', santes: 'santas', velles: 'viejas', noves: 'nuevas', altes: 'altas', baixes: 'bajas',
    antoni: 'antonio', josep: 'jose', josepa: 'josefa', vicent: 'vicente', joan: 'juan', joana: 'juana', miquel: 'miguel',
    jaume: 'jaime', pere: 'pedro', francesc: 'francisco', francesca: 'francisca', lluis: 'luis', lluisa: 'luisa',
    jordi: 'jorge', enric: 'enrique', marti: 'martin', roc: 'roque', andreu: 'andres', bernat: 'bernardo',
    cristofol: 'cristobal', domenec: 'domingo', esteve: 'esteban', jeroni: 'jeronimo', llorenc: 'lorenzo', lluc: 'lucas',
    mateu: 'mateo', nicolau: 'nicolas', pasqual: 'pascual', sebastia: 'sebastian', caterina: 'catalina', anna: 'ana',
    agnes: 'ines', margarida: 'margarita', elisabet: 'isabel', empar: 'amparo', isidre: 'isidro', ignasi: 'ignacio',
    felip: 'felipe', rafel: 'rafael', bartomeu: 'bartolome', blai: 'blas', agusti: 'agustin', carles: 'carlos',
    eduard: 'eduardo', ferran: 'fernando', goncal: 'gonzalo', guillem: 'guillermo', joaquim: 'joaquin', manel: 'manuel',
    marc: 'marcos', ricard: 'ricardo', robert: 'roberto', valenti: 'valentin', xavier: 'javier',
    alacant: 'alicante', castello: 'castellon', xativa: 'jativa', sagunt: 'sagunto', lliria: 'liria', alzira: 'alcira',
    elx: 'elche', ontinyent: 'onteniente', xabia: 'javea', oriola: 'orihuela', alcoi: 'alcoy', burjassot: 'burjasot',
    quart: 'cuart', torrent: 'torrente', alboraia: 'alboraya', foios: 'foyos', montcada: 'moncada', almassora: 'almazora',
    vinaros: 'vinaroz', benicassim: 'benicasim', segorb: 'segorbe', xixona: 'jijona', monover: 'monovar', petrer: 'petrel',
    calp: 'calpe', pucol: 'puzol', almassera: 'almacera', vilamarxant: 'villamarchante', benaguasil: 'benaguacil'
  };
  const STOP = new Set(lista('de,del,la,las,los,el,els,les,dels,d,l,i,y,en,na,n,a,al,lo,e'));
  const MESES = { enero: 'enero', gener: 'enero', febrero: 'febrero', febrer: 'febrero', marzo: 'marzo', marc: 'marzo', abril: 'abril', abrl: 'abril',
    mayo: 'mayo', maig: 'mayo', junio: 'junio', juny: 'junio', julio: 'julio', juliol: 'julio', agosto: 'agosto', agost: 'agosto',
    septiembre: 'septiembre', setiembre: 'septiembre', setembre: 'septiembre', octubre: 'octubre', noviembre: 'noviembre',
    novembre: 'noviembre', diciembre: 'diciembre', desembre: 'diciembre' };
  const NUM_TXT = { un: 1, uno: 1, una: 1, u: 1, dos: 2, tres: 3, cuatro: 4, quatre: 4, cinco: 5, cinc: 5, seis: 6, sis: 6, siete: 7, set: 7,
    ocho: 8, vuit: 8, nueve: 9, nou: 9, diez: 10, deu: 10, once: 11, onze: 11, doce: 12, dotze: 12, trece: 13, tretze: 13,
    catorce: 14, catorze: 14, quince: 15, quinze: 15, dieciseis: 16, setze: 16, diecisiete: 17, disset: 17, dieciocho: 18,
    divuit: 18, diecinueve: 19, dinou: 19, veinte: 20, vint: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
    veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, trenta: 30 };
  const RX_MES = new RegExp('\\b((?:vint|trenta) i (?:u|un|dos|tres|quatre|cinc|sis|set|vuit|nou)|' + Object.keys(NUM_TXT).join('|') +
    '|\\d{1,2}) (?:de |d )?(' + Object.keys(MESES).join('|') + ')\\b', 'g');
  const VINT = { u: 1, un: 1, dos: 2, tres: 3, quatre: 4, cinc: 5, sis: 6, set: 7, vuit: 8, nou: 9 };

  // ---------- distancia de edición (con transposición), con corte ----------
  function osa(a, b, max) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > max) return max + 1;
    let p2 = null, p1 = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const c = [i]; let best = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(p1[j] + 1, c[j - 1] + 1, p1[j - 1] + cost);
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        c[j] = v; if (v < best) best = v;
      }
      if (best > max) return max + 1;
      p2 = p1; p1 = c;
    }
    return p1[n];
  }

  // ---------- normalización de una vía ----------
  const CACHE = new Map();
  function partir(via) {
    const raw = String(via == null ? '' : via);
    if (CACHE.has(raw)) return CACHE.get(raw);
    let s = raw.replace(/[·•]/g, '');
    s = s.replace(/\(\s*(?:el|la|los|las|les|els|lo|l['’´]?|de(?:\s+la|\s+los|\s+las|\s+les)?|del|dels)\s*\)/gi, ' ');
    // "JESUS PLA GANDIA, BISBE" / "SOL, DEL": título o artículo al final -> al principio
    const fin = /^(.*\S)\s*,\s*([^,\d]{1,30})$/.exec(s);
    let cola = [];
    if (fin) {
      const cw = sinT(fin[2]).split(/[^a-z]+/).filter(Boolean);
      if (cw.length && cw.every(w => STOP.has(w) || TITULOS.has(PALABRAS[w] || w))) { cola = cw; s = fin[1]; }
    }
    // artículos con apóstrofo (d'Albaida, l'Eliana, "L,ARC") antes de normalizar
    s = s.replace(/(^|[\s(,.\/])[dlDL]\s*['’´`]\s*(?=\p{L})/gu, '$1 ').replace(/(^|[\s(])[dlDL],(?=\p{L})/gu, '$1 ');
    s = sinT(s).replace(/[º°ª]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    let w = s.split(' ').filter(Boolean);
    // tipo de vía (se repite: "Diseminados Diseminado P083", "C/ Calle Mayor", "Polígono Industrial")
    let tipo = '';
    while (w.length > 1) {
      let t = TIPOS[w[0]];
      if (!t && w[0].length >= 6) { const k = TIPOS_LARGOS.find(x => osa(w[0], x, 1) <= 1); if (k) t = TIPOS[k]; }
      if (!t || (tipo && t !== tipo)) break;
      tipo = t; w.shift();
      if (tipo === 'POLIGONO' && w.length > 1 && /^(industrial|ind|industria)$/.test(w[0])) w.shift();
    }
    if (cola.length) w = cola.concat(w);
    let j = w.join(' ');
    j = j.replace(/\bmare de deu\b/g, 'virgen').replace(/\bnostra senyora\b/g, 'nuestra senora').replace(/\bntra sra\b/g, 'nuestra senora')
         .replace(/\bvila real\b/g, 'villarreal').replace(/\bvila joiosa\b/g, 'villajoyosa');
    j = j.replace(RX_MES, (_, n, mes) => {
      let v = /^\d+$/.test(n) ? +n : NUM_TXT[n];
      const vm = /^(vint|trenta) i (\w+)$/.exec(n); if (vm) v = (vm[1] === 'vint' ? 20 : 30) + VINT[vm[2]];
      return v + ' ' + MESES[mes];
    });
    w = j.split(' ').filter(Boolean);
    const out = [];
    for (let i = 0; i < w.length; i++) {
      let x = w[i];
      if (x === 's' && !out.length && i + 1 < w.length && /^[a-z]{2,}$/.test(w[i + 1])) x = 'san';
      if (STOP.has(x)) { if (x.length === 1 && i > 0 && /^\d+$/.test(w[i - 1])) out.push(x); continue; }
      out.push(PALABRAS[x] || x);
    }
    const nucleo = out.join(' ');
    const r = { tipo, nucleo, sinTit: sinTitulos(nucleo), nums: out.filter((x, i) => /\d/.test(x) || (x.length === 1 && i > 0 && /^\d+$/.test(out[i - 1]))).join(' ') };
    if (CACHE.size > 50000) CACHE.clear();
    CACHE.set(raw, r);
    return r;
  }
  function sinTitulos(nucleo) {
    const t = nucleo.split(' ');
    while (t.length > 1 && TITULOS.has(t[0])) t.shift();
    while (t.length > 1 && TITULOS.has(t[t.length - 1])) t.pop();
    return t.join(' ');
  }

  // ---------- número de portal ----------
  function restoKey(s) {
    return sinT(s).replace(/\b(piso|planta|pis|puerta|porta|pta|pt|escalera|escala|esc|bloque|bloc|blq|bl)\b/g, ' ').replace(/[^a-z0-9]+/g, '');
  }
  function parseNumero(txt) {
    const s = String(txt == null ? '' : txt).trim();
    const low = sinT(s).replace(/[º°]/g, 'º');
    if (!s || /^(s\s*\/\s*n|s\.?\s*n\.?|sin\s+n(umero|º)?\.?|sn|-+|\.+)$/.test(low)) return { sn: true, key: 'SN', raw: s };
    const t = low.replace(/^(n\s*º|nº|no\.|n\.|num\.?|numero)\s*/, '');
    const m = /^(\d{1,5})\s*(?:[-\/]\s*)?(bis|ter|[a-z](?![a-z]))?/.exec(t);
    if (!m) return { key: 'T:' + restoKey(s), raw: s };
    const n = String(+m[1]), ext = (m[2] || '').toUpperCase(), rk = restoKey(t.slice(m[0].length));
    return { n, ext, resto: rk, key: n + ext + (rk ? '/' + rk : ''), raw: s };
  }

  // ---------- dirección completa en una sola cadena ----------
  const RX_NUM_EN_VIA = /(?:\s+|^)((?:[nN]\s?[º°oO]\.?\s*|[nN][úuÚU][mM](?:[eE][rR][oO])?\.?\s*)?(?:\d{1,5}(?:\s?-\s?[A-Za-z]|[A-Za-z]|\s[A-Z])?(?![\p{L}\d])|[sS]\s?\/\s?[nN](?![\p{L}])))/gu;
  function parseDireccion(raw) {
    let s = String(raw == null ? '' : raw).trim(), cp = '', muni = '';
    const mcp = /(?:^|[\s,;(])(?:[cC]\.?\s?[pP]\.?\s*:?\s*)?(\d{5})(?!\d)\s*\)?\s*(.*)$/u.exec(s);
    if (mcp && mcp.index > 0) { cp = mcp[1]; muni = mcp[2].replace(/^[\s,;.\-–()]+|[\s,;.()]+$/g, ''); s = s.slice(0, mcp.index); }
    s = s.replace(/[\s,;.]+$/, '');
    const coma = s.search(/[,;]/);
    let via = coma >= 0 ? s.slice(0, coma) : s, resto = coma >= 0 ? s.slice(coma + 1).trim() : '', numTxt = '';
    for (const m of via.matchAll(RX_NUM_EN_VIA)) {
      const antes = via.slice(0, m.index);
      const pa = partir(antes);
      if (pa.nucleo && !TIPOS[pa.nucleo]) { numTxt = via.slice(m.index).trim(); via = antes; break; }
    }
    if (!numTxt && resto && /^(?:[nN]\s?[º°oO]\.?\s*|[nN][úuÚU][mM](?:[eE][rR][oO])?\.?\s*)?(?:\d{1,5}|[sS]\s?\/\s?[nN])/.test(resto)) { numTxt = resto; resto = ''; }
    const num = numTxt ? parseNumero(numTxt + (resto ? ' ' + resto : '')) : parseNumero('');
    return { via: via.trim(), numero: numTxt, num, resto, restoKey: numTxt ? '' : restoKey(resto), cp, muni };
  }

  function clavePortal(viaId, num, extraResto, cp) {
    return 'D:' + viaId + '#' + (num && num.key ? num.key : 'SN') + (extraResto ? '/' + extraResto : '') + (cp ? '@' + cp : '');
  }

  // ---------- agrupación de variantes de una misma vía (dentro de un CSV) ----------
  function parecido(g, o) {
    // solo si UNA de las dos no lleva título ("Empar Ferrer" = "Actriu Empar Ferrer"); "Padre Andrés" ≠ "Sant Andreu"
    if (g.sinTit.length >= 4 && g.sinTit === o.sinTit && (g.nucleo === g.sinTit || o.nucleo === o.sinTit)) return 'título u oficio omitido';
    const gw = g.nucleo.split(' ').filter(w => w.length >= 3 && !/\d/.test(w));
    if (gw.length && gw.join('').length >= 6) {
      const ow = o.nucleo.split(' ');
      if (gw.every(w => ow.includes(w))) {
        const extra = ow.filter(w => !g.nucleo.split(' ').includes(w));
        if (extra.length && extra.every(w => TITULOS.has(w) || NOMBRES.has(w) || STOP.has(w))) return 'nombre abreviado';
      }
    }
    const L = Math.max(g.nucleo.length, o.nucleo.length);
    if (L >= 6) {
      const max = L >= 12 ? 2 : 1;
      if (osa(g.nucleo, o.nucleo, max) <= max) return 'errata';
    }
    return null;
  }
  /* items: [{raw, count}] -> { porRaw: Map(raw -> grupo), grupos: [grupo] }
     grupo = { id, tipo, nucleo, rep, variantes: Map(raw -> nº), motivos: Map(raw -> motivo), total } */
  function agrupar(items, opts) {
    opts = opts || {};
    const noMerge = opts.noMerge || new Set(), fuzzy = opts.fuzzy !== false;
    const cnt = new Map();
    for (const it of items) {
      const r = String(it && typeof it === 'object' ? it.raw : it).trim(); if (!r) continue;
      cnt.set(r, (cnt.get(r) || 0) + ((it && it.count) || 1));
    }
    const porNucleo = new Map(), grupos = new Map();
    const nuevo = (id, tipo, nucleo, fijo) => ({ id, tipo, nucleo, sinTit: sinTitulos(nucleo), nums: partir(nucleo).nums,
      variantes: new Map(), motivos: new Map(), total: 0, fijo: !!fijo });
    for (const [raw, c] of cnt) {
      const p = partir(raw);
      const nuc = p.nucleo || sinT(raw).replace(/[^a-z0-9]+/g, ' ').trim();
      if (!nuc) continue;
      if (noMerge.has(raw)) { const id = 'X|' + raw; const g = nuevo(id, p.tipo, nuc, true); g.variantes.set(raw, c); g.total = c; g.nums = p.nums; grupos.set(id, g); continue; }
      if (!porNucleo.has(nuc)) porNucleo.set(nuc, new Map());
      const m = porNucleo.get(nuc), t = p.tipo || '';
      if (!m.has(t)) m.set(t, []);
      m.get(t).push({ raw, c, p });
    }
    for (const [nuc, m] of porNucleo) {
      const expl = [...m.keys()].filter(Boolean).map(t => [t, m.get(t).reduce((s, x) => s + x.c, 0)]).sort((a, b) => b[1] - a[1]);
      const principal = expl.length ? expl[0][0] : '';
      for (const [t, arr] of m) {
        const tt = t || principal, id = tt + '|' + nuc;
        if (!grupos.has(id)) { const g = nuevo(id, tt, nuc); g.nums = arr[0].p.nums; grupos.set(id, g); }
        const g = grupos.get(id);
        for (const x of arr) { g.variantes.set(x.raw, x.c); g.total += x.c; if (!t && principal) g.motivos.set(x.raw, 'sin tipo de vía'); }
      }
    }
    if (fuzzy) {
      const orden = [...grupos.values()].sort((a, b) => a.total - b.total);
      const vivos = new Set(orden);
      for (const g of orden) {
        if (g.fijo || !vivos.has(g)) continue;
        const cands = [];
        for (const o of vivos) {
          if (o === g || o.fijo || o.nums !== g.nums) continue;
          if (g.tipo && o.tipo && g.tipo !== o.tipo) continue;
          if (Math.abs(o.nucleo.length - g.nucleo.length) > 2 && o.sinTit !== g.sinTit && !o.nucleo.includes(g.nucleo.split(' ')[0])) continue;
          const r = parecido(g, o);
          if (r) { cands.push([o, r]); if (cands.length > 1) break; }
        }
        if (cands.length !== 1) continue;                 // si hay duda entre dos calles, no se agrupa
        const [o, motivo] = cands[0];
        const [dst, src] = o.total >= g.total ? [o, g] : [g, o];   // la variante rara se une a la frecuente
        for (const [raw, c] of src.variantes) { dst.variantes.set(raw, c); dst.motivos.set(raw, src.motivos.get(raw) || motivo); }
        dst.total += src.total; vivos.delete(src); grupos.delete(src.id);
      }
    }
    const porRaw = new Map();
    for (const g of grupos.values()) {
      let rep = null, max = -1;
      for (const [raw, c] of g.variantes) if (!g.motivos.has(raw) && c > max) { rep = raw; max = c; }
      if (rep === null) for (const [raw, c] of g.variantes) if (c > max) { rep = raw; max = c; }
      g.rep = rep;
      for (const raw of g.variantes.keys()) porRaw.set(raw, g);
    }
    return { porRaw, grupos: [...grupos.values()] };
  }
  // vía escrita en un texto -> grupo del CSV (si lo hay)
  function buscar(agr, viaRaw) {
    if (!agr) return null;
    const v = String(viaRaw || '').trim();
    if (agr.porRaw.has(v)) return agr.porRaw.get(v);
    const p = partir(v); if (!p.nucleo) return null;
    const mismos = agr.grupos.filter(g => g.nucleo === p.nucleo && (!p.tipo || !g.tipo || g.tipo === p.tipo));
    if (mismos.length === 1) return mismos[0];
    const tit = agr.grupos.filter(g => g.sinTit === p.sinTit && p.sinTit.length >= 4 && (g.nucleo === g.sinTit || p.nucleo === p.sinTit) && (!p.tipo || g.tipo === p.tipo));
    return tit.length === 1 ? tit[0] : null;
  }
  // dirección detectada en texto -> {key, cat}, enlazada con el CSV cuando es la misma vía
  function claveDetectada(d, agr, modo) {
    const g = buscar(agr, d.via);
    const p = partir(d.via);
    const id = g ? g.id : (p.tipo || '') + '|' + (p.nucleo || sinT(d.via));
    const sinNum = (!d.num || d.num.sn) && !d.restoKey && !d.cp;
    if (modo === 'via' && sinNum) return { key: 'V:' + id, cat: 'VIA' };
    return { key: clavePortal(id, d.num, d.restoKey, d.cp), cat: 'DOMICILIO' };
  }

  // ---------- detección en texto libre ----------
  const VOC = { a: 'aáàäâ', e: 'eéèëê', i: 'iíìïî', o: 'oóòöô', u: 'uúùüû', c: 'cç', n: 'nñ' };
  const ci = w => [...w].map(ch => {
    if (ch === ' ') return '\s+';
    const b = sinT(ch);
    if (VOC[b]) return '[' + VOC[b] + VOC[b].toUpperCase() + ']';
    if (ch.toLowerCase() !== ch.toUpperCase()) return '[' + ch.toLowerCase() + ch.toUpperCase() + ']';
    return escRe(ch);
  }).join('');
  const LARGOS_EXPL = lista('calle,carrer,avenida,avinguda,plaza,plaça,paseo,passeig,camino,camí,carretera,travesía,travessera,travessia,ronda,glorieta,pasaje,passatge,partida,urbanización,urbanització,diseminados,diseminado,polígono industrial,polígono,polígon industrial,polígon,senda,rotonda');
  const ABREV_OPC = lista('avda,avd,avgda,pza,plza,ctra,crta,cno,cmno,trav,rda,pje,ptge,pda,ptda,urb,pol,gta,cl,cll');
  const ABREV_LIT = ['[cC]\\s?\\.?\\s?\\/', '[aA][vV]\\.', '[pP][lL]\\.', '[pP][gG]\\.', '[pP][sS][oO]?\\.', '[pP]\\.?\\s?º', '[bB]º', '[pP][çcÇC]\\.'];
  const LARGOS_AMB = lista('barrio,barri,parque,parc,jardín,jardí,grupo,colonia,cuesta,costera,pujada,baixada,bajada,rambla,alameda,albereda,muelle,moll,paraje,paratge,vereda,plazoleta,placeta,plazuela,carril,callejón,carreró,bulevar,autovía');
  const byLen = a => a.slice().sort((x, y) => y.length - x.length);
  const TX_EXPL = byLen(LARGOS_EXPL).map(w => ci(w).replace(/\\ /g, '\\s+')).concat(ABREV_OPC.map(w => ci(w) + '\\.?'), ABREV_LIT).join('|');
  const TX_ALL = byLen(LARGOS_AMB).map(ci).join('|') + '|' + TX_EXPL;
  const TX_LARGO_NEG = byLen(LARGOS_EXPL.concat(LARGOS_AMB)).map(ci).join('|');
  const SEPT = '(?:\\s+|(?<=[\\/.º])\\s*)';
  const CONN = '(?:' + lista('dels,del,de,las,los,les,la,el,els,en,na,i,y').map(ci).join('|') + ')';
  const WCAP = "(?:[dDlL]['’´]\\s?)?\\p{Lu}[\\p{L}\\p{M}'’·\\-]*";
  const ABBR = '\\p{Lu}\\p{Ll}{0,3}\\.(?=\\s*\\p{L})';
  const NUMCALLE = "\\d{1,2}\\s+(?:[dD][eE]\\s+|[dD]['’´]\\s?)\\p{L}+|\\d{1,4}(?:\\s?[A-Z](?![\\p{L}]))?(?=\\s*(?:,|[nN]\\s?[º°]))";
  const NOMBRE = '(?:' + ABBR + '\\s*|' + WCAP + '|' + NUMCALLE + ')(?:(?:\\s+(?:' + CONN + '\\s+){0,2}|(?<=\\.))(?!(?:' + TX_LARGO_NEG + ')(?![\\p{L}]))(?:' + ABBR + '|' + WCAP + ')){0,6}';
  const NUM = "(?:\\s*,\\s*|\\s+)(?:(?:[nN]\\s?[º°oO]\\.?|[nN][úuÚU][mM](?:[eE][rR][oO])?\\.?)\\s*)?(?:\\d{1,4}(?:\\s?-\\s?[A-Za-z]|[A-Za-z]|\\s[A-Z])?(?![\\p{L}\\d])|[sS]\\s?\\/\\s?[nN](?![\\p{L}]))";
  const KM = '(?:\\s*,?\\s*(?:[kK][mM]|[pP]\\.?\\s?[kK])\\.?\\s*\\d{1,3}(?:[.,]\\d{1,3})?)';
  const PISO = '(?:\\s*,?\\s*(?:(?:' + lista('piso,planta,pis,escalera,escala,esc,bloque,bloc,blq,puerta,porta,pta,pt').map(ci).join('|') +
    ')\\.?\\s*[\\dA-Za-z]{1,3}(?![\\p{L}\\d])|\\d{1,2}\\s?[º°ª](?:\\s?-?\\s?(?:\\d{1,2}\\s?[ºª°]?|[A-Za-z])(?![\\p{L}\\d]))?|(?:' +
    lista('bajo,baix,ático,entresuelo,entlo').map(ci).join('|') + ')\\.?(?![\\p{L}])))';
  const CPM = '(?:\\s*,?\\s*(?:[cC]\\.?\\s?[pP]\\.?\\s*:?\\s*)?\\d{5}(?!\\d)(?:\\s+' + WCAP + '(?:\\s+(?:' + CONN + '\\s+)?' + WCAP + '){0,2})?)';
  const COLA = '(?:' + KM + ')?(?:' + PISO + '){0,3}(?:' + CPM + ')?';
  const LOWW = "(?:[dDlL]['’´]\\s?)?\\p{L}[\\p{L}\\p{M}'’·\\-]*\\.?";
  const RX_CAP = new RegExp('(?<![\\p{L}\\d])(?:' + TX_ALL + ')' + SEPT + '(?:' + CONN + '\\s+){0,2}' + NOMBRE + '(?:' + NUM + ')?' + COLA, 'gu');
  const RX_LOW = new RegExp('(?<![\\p{L}\\d])(?:' + TX_EXPL + ')' + SEPT + '(?:' + CONN + '\\s+){0,2}(?!' + CONN + '\\s)' + LOWW + '(?:\\s+' + LOWW + '){0,5}?' + NUM + COLA, 'gu');
  const RX_REV = new RegExp('(?<![\\p{L}])(?:' + ci('número') + '|[nN]\\s?[º°])\\s*(\\d{1,4}(?:\\s?[A-Z])?)\\s+(?:' + ci('de') + '\\s+)?(?:' + ci('la') + "\\s+|[lL]['’])?((?:" + TX_EXPL + ')' + SEPT + '(?:' + CONN + '\\s+){0,2}' + NOMBRE + ')', 'gu');

  function detectar(text) {
    const c = [], MUN = (typeof self !== 'undefined' ? self : globalThis).TokMunicipios;
    /* «Camino Viejo 9, Moncada (Valencia)»: si tras la coma viene un municipio del listado, forma parte de la dirección */
    const extender = e => {
      if (!MUN) return e;
      for (let k = 0; k < 2; k++) {
        const m = /^\s*,\s*/.exec(text.slice(e)); if (!m) break;
        const n = MUN.alInicio(text.slice(e + m[0].length)); if (!n) break;
        e += m[0].length + n;
        const pr = /^\s*\([^)]{2,30}\)/.exec(text.slice(e)); if (pr) e += pr[0].length;
      }
      return e;
    };
    const push = (s, e, extra) => {
      let t = text.slice(s, e);
      const tr = /[\s,;.:\-–]+$/.exec(t); if (tr) { t = t.slice(0, tr.index); e = s + t.length; }
      if (!extra) { e = extender(e); t = text.slice(s, e); }
      if (t.length >= 6 && /\p{L}{2}/u.test(t)) c.push(Object.assign({ start: s, end: e, text: t }, extra || {}));
    };
    for (const m of text.matchAll(RX_CAP)) push(m.index, m.index + m[0].length);
    for (const m of text.matchAll(RX_LOW)) push(m.index, m.index + m[0].length);
    for (const m of text.matchAll(RX_REV)) push(m.index, m.index + m[0].length, { rev: { num: m[1], via: m[2] } });
    c.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const occ = new Uint8Array(text.length + 1), out = [];
    for (const d of c) {
      let libre = true; for (let i = d.start; i < d.end; i++) if (occ[i]) { libre = false; break; }
      if (!libre) continue;
      for (let i = d.start; i < d.end; i++) occ[i] = 1;
      if (d.rev) { d.via = d.rev.via; d.numero = d.rev.num; d.num = parseNumero(d.rev.num); d.restoKey = ''; d.cp = ''; }
      else Object.assign(d, parseDireccion(d.text));
      if (partir(d.via).nucleo) out.push(d);
    }
    return out.sort((a, b) => a.start - b.start);
  }

  return { sinT, partir, sinTitulos, parseNumero, parseDireccion, clavePortal, agrupar, buscar, claveDetectada, detectar, osa,
    TIPOS, TITULOS, PALABRAS };
});
