'use strict';
/* TokDelitos — Catálogo de delitos (Código Penal) en castellano y valenciano.
   - identificar(valor): valor de una celda -> entrada del catálogo (o null).
   - detectar(texto): menciones de delitos en texto libre (la forma más larga gana:
     "robo con fuerza en las cosas en casa habitada" antes que "robo con fuerza" y que "robo"). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TokDelitos = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const sinT = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const norm = s => sinT(s).replace(/l[·.]l/g, 'll').replace(/[^a-z0-9]+/g, ' ').trim();

  // [id, denominación, artículo CP, sinónimos castellano | valenciano separados por "|"]
  const CATALOGO = [
    ['HOMICIDIO', 'Homicidio', '138', 'homicidio|homicidio imprudente|homicidi|homicidi imprudent'],
    ['ASESINATO', 'Asesinato', '139', 'asesinato|assassinat'],
    ['LESIONES', 'Lesiones', '147', 'lesiones|lesiones leves|delito leve de lesiones|maltrato de obra|lesions|lesions lleus|maltracte d\'obra'],
    ['RINA', 'Riña tumultuaria', '154', 'riña tumultuaria|baralla tumultuària'],
    ['MALTRATO_FAMILIAR', 'Maltrato en el ámbito familiar', '153 / 173.2', 'malos tratos|maltrato habitual|maltrato en el ámbito familiar|violencia doméstica|maltractament|maltractaments|maltractament habitual|violència domèstica'],
    ['VIOLENCIA_GENERO', 'Violencia de género', '153.1', 'violencia de género|violencia sobre la mujer|violència de gènere|violència masclista'],
    ['DETENCION_ILEGAL', 'Detención ilegal', '163', 'detención ilegal|detenció il·legal'],
    ['SECUESTRO', 'Secuestro', '164', 'secuestro|segrest'],
    ['TRATA', 'Trata de seres humanos', '177 bis', 'trata de seres humanos|trata de personas|tràfic d\'éssers humans|tràfic de persones'],
    ['AMENAZAS', 'Amenazas', '169', 'amenazas|amenaza|amenazas leves|amenazas graves|amenaces|amenaça'],
    ['COACCIONES', 'Coacciones', '172', 'coacciones|coacción|coaccions|coacció'],
    ['ACOSO', 'Acoso (stalking)', '172 ter', 'acoso|acecho|stalking|ciberacoso|assetjament|ciberassetjament'],
    ['TRATO_DEGRADANTE', 'Trato degradante', '173.1', 'trato degradante|tracte degradant'],
    ['AGRESION_SEXUAL', 'Agresión sexual', '178', 'agresión sexual|agresiones sexuales|agressió sexual|agressions sexuals'],
    ['VIOLACION', 'Violación', '179', 'violación|violació'],
    ['ABUSO_SEXUAL', 'Abuso sexual', '181', 'abuso sexual|abusos sexuales|abús sexual|abusos sexuals'],
    ['GROOMING', 'Embaucamiento de menores (grooming)', '183 ter', 'child grooming|grooming|embaucamiento de menores'],
    ['ACOSO_SEXUAL', 'Acoso sexual', '184', 'acoso sexual|assetjament sexual'],
    ['EXHIBICIONISMO', 'Exhibicionismo', '185', 'exhibicionismo|exhibicionisme'],
    ['PROSTITUCION', 'Prostitución / explotación sexual', '187', 'prostitución|explotación sexual|proxenetismo|prostitució|explotació sexual'],
    ['PORNOGRAFIA_INFANTIL', 'Pornografía infantil / corrupción de menores', '189', 'pornografía infantil|corrupción de menores|pornografia infantil|corrupció de menors'],
    ['OMISION_SOCORRO', 'Omisión del deber de socorro', '195', 'omisión del deber de socorro|omissió del deure de socors'],
    ['REVELACION_SECRETOS', 'Descubrimiento y revelación de secretos', '197', 'descubrimiento y revelación de secretos|revelación de secretos|descobriment i revelació de secrets'],
    ['ALLANAMIENTO', 'Allanamiento de morada', '202', 'allanamiento de morada|allanamiento|allanament de morada|violació de domicili'],
    ['CALUMNIAS', 'Calumnias', '205', 'calumnias|calumnia|calúmnies|calúmnia'],
    ['INJURIAS', 'Injurias', '208', 'injurias|injuria|injúries|injúria'],
    ['SUSTRACCION_MENORES', 'Sustracción de menores', '225 bis', 'sustracción de menores|sostracció de menors'],
    ['IMPAGO_PENSIONES', 'Impago de pensiones / abandono de familia', '227', 'impago de pensiones|abandono de familia|impagament de pensions|abandonament de família'],
    ['ABANDONO_MENORES', 'Abandono de menores', '229', 'abandono de menores|abandonament de menors'],
    ['HURTO', 'Hurto', '234', 'hurto|hurtos|hurto leve|delito leve de hurto|furt|furts|furt lleu'],
    ['ROBO_FUERZA_CASA', 'Robo con fuerza en las cosas en casa habitada', '241', 'robo con fuerza en las cosas en casa habitada|robo con fuerza en casa habitada|robo en casa habitada|robo en vivienda|robatori amb força en les coses en casa habitada|robatori amb força en casa habitada|robatori en casa habitada|robatori en habitatge'],
    ['ROBO_FUERZA_ESTABLECIMIENTO', 'Robo con fuerza en las cosas en establecimiento abierto al público', '241', 'robo con fuerza en las cosas en establecimiento abierto al público|robo con fuerza en establecimiento abierto al público|robo con fuerza en establecimiento|robo en establecimiento|robatori amb força en les coses en establiment obert al públic|robatori amb força en establiment|robatori en establiment'],
    ['ROBO_FUERZA_VEHICULO', 'Robo con fuerza en las cosas (interior de vehículo)', '237-238', 'robo con fuerza en las cosas (interior de vehículo)|robo con fuerza en las cosas en interior de vehículo|robo con fuerza en interior de vehículo|robo en interior de vehículo|robo interior de vehículo|robo interior vehículo|robatori amb força en les coses (interior de vehicle)|robatori a l\'interior de vehicle|robatori en interior de vehicle'],
    ['ROBO_FUERZA', 'Robo con fuerza en las cosas', '237-238', 'robo con fuerza en las cosas|robo con fuerza|robatori amb força en les coses|robatori amb força'],
    ['ROBO_VIOLENCIA', 'Robo con violencia o intimidación en las personas', '242', 'robo con violencia o intimidación en las personas|robo con violencia o intimidación|robo con violencia|robo con intimidación|robo por el método del tirón|robo por el procedimiento del tirón|atraco|robatori amb violència o intimidació en les persones|robatori amb violència o intimidació|robatori amb violència|robatori amb intimidació|atracament'],
    ['ROBO', 'Robo', '237', 'robo|robos|robatori|robatoris'],
    ['EXTORSION', 'Extorsión', '243', 'extorsión|chantaje|extorsió|xantatge'],
    ['ROBO_USO_VEHICULO', 'Hurto o robo de uso de vehículo a motor', '244', 'hurto o robo de uso de vehículo a motor|robo o hurto de uso de vehículo a motor|robo de uso de vehículo a motor|hurto de uso de vehículo a motor|robo de uso de vehículo|hurto de uso de vehículo|robo de uso|hurto de uso|sustracción de vehículo|furt o robatori d\'ús de vehicle a motor|robatori d\'ús de vehicle|furt d\'ús de vehicle|sostracció de vehicle'],
    ['USURPACION', 'Usurpación de inmueble', '245', 'usurpación de inmueble|usurpación|ocupación ilegal de inmueble|ocupación ilegal|okupación|usurpació|ocupació il·legal'],
    ['ESTAFA', 'Estafa', '248', 'estafa|estafas|estafa informática|fraude informático|phishing|smishing|vishing|timo|estafes|estafa informàtica|frau informàtic'],
    ['DEFRAUDACION_FLUIDO', 'Defraudación de fluido eléctrico', '255', 'defraudación de fluido eléctrico|enganche ilegal|defraudació de fluid elèctric'],
    ['USO_TARJETAS', 'Uso fraudulento de tarjetas', '399 bis', 'uso fraudulento de tarjeta|uso fraudulento de tarjetas|uso de tarjeta ajena|carding|ús fraudulent de targetes|ús fraudulent de targeta'],
    ['APROPIACION_INDEBIDA', 'Apropiación indebida', '253', 'apropiación indebida|apropiació indeguda'],
    ['ALZAMIENTO_BIENES', 'Alzamiento de bienes / insolvencia punible', '257', 'alzamiento de bienes|insolvencia punible|alçament de béns'],
    ['DANOS_INFORMATICOS', 'Daños informáticos', '264', 'daños informáticos|sabotaje informático|danys informàtics'],
    ['DANOS', 'Daños', '263', 'daños|daño|delito leve de daños|deslucimiento de bienes|danys|dany'],
    ['RECEPTACION', 'Receptación', '298', 'receptación|receptació'],
    ['BLANQUEO', 'Blanqueo de capitales', '301', 'blanqueo de capitales|lavado de dinero|blanqueig de capitals'],
    ['DELITO_FISCAL', 'Delito contra la Hacienda Pública', '305', 'delito fiscal|fraude fiscal|contra la hacienda pública|delicte fiscal|frau fiscal'],
    ['TRABAJADORES', 'Delito contra los derechos de los trabajadores', '311', 'contra los derechos de los trabajadores|contra els drets dels treballadors'],
    ['EXTRANJEROS', 'Delito contra los derechos de los ciudadanos extranjeros', '318 bis', 'contra los derechos de los ciudadanos extranjeros|favorecimiento de la inmigración ilegal|inmigración ilegal|immigració il·legal'],
    ['ORDENACION_TERRITORIO', 'Delito contra la ordenación del territorio', '319', 'contra la ordenación del territorio|delito urbanístico|contra l\'ordenació del territori'],
    ['MEDIO_AMBIENTE', 'Delito contra el medio ambiente', '325', 'contra el medio ambiente|delito ecológico|contra el medi ambient'],
    ['MALTRATO_ANIMAL', 'Maltrato animal', '337', 'maltrato animal|maltrato de animales|abandono de animales|maltractament animal|maltractament d\'animals|abandonament d\'animals'],
    ['ESTRAGOS', 'Estragos', '346', 'estragos|estralls'],
    ['INCENDIO', 'Incendio', '351', 'incendio forestal|incendio|incendi forestal|incendi'],
    ['SALUD_PUBLICA', 'Contra la salud pública (tráfico de drogas)', '368', 'contra la salud pública (tráfico de drogas)|contra la salud pública|tráfico de drogas|tráfico de estupefacientes|narcotráfico|venta de droga|venta de drogas|menudeo|contra la salut pública|tràfic de drogues|tràfic d\'estupefaents'],
    ['SEGURIDAD_VIAL', 'Delito contra la seguridad vial', '379-385', 'contra la seguridad vial|contra la seguretat viària'],
    ['ALCOHOLEMIA', 'Conducción bajo la influencia del alcohol o drogas', '379.2', 'conducción bajo la influencia de bebidas alcohólicas|conducción bajo la influencia del alcohol|conducción bajo los efectos del alcohol|conducción bajo la influencia de drogas|conducción etílica|alcoholemia positiva|conducció sota els efectes de l\'alcohol|conducció sota la influència de begudes alcohòliques'],
    ['EXCESO_VELOCIDAD', 'Exceso de velocidad', '379.1', 'exceso de velocidad|velocidad excesiva|excés de velocitat'],
    ['CONDUCCION_TEMERARIA', 'Conducción temeraria', '380', 'conducción temeraria|conducción con manifiesto desprecio por la vida|conducció temerària'],
    ['NEGATIVA_PRUEBAS', 'Negativa a someterse a las pruebas de alcohol o drogas', '383', 'negativa a someterse a las pruebas|negativa a la prueba de alcoholemia|negativa a realizar las pruebas|negativa a sotmetre\'s a les proves'],
    ['SIN_PERMISO', 'Conducción sin permiso', '384', 'conducción sin permiso|conducir sin permiso|conducción sin carné|conducción sin licencia|pérdida de vigencia del permiso|conducció sense permís'],
    ['FALSIFICACION_MONEDA', 'Falsificación de moneda', '386', 'falsificación de moneda|moneda falsa|billetes falsos|falsificació de moneda'],
    ['FALSEDAD_DOCUMENTAL', 'Falsedad documental', '390-392', 'falsificación de documento|falsificación documental|falsedad documental|falsificación|falsedat documental|falsificació de document|falsificació'],
    ['SUPLANTACION', 'Usurpación de estado civil / suplantación de identidad', '401', 'usurpación de estado civil|usurpación de identidad|suplantación de identidad|suplantació d\'identitat'],
    ['INTRUSISMO', 'Intrusismo', '403', 'intrusismo|intrusisme'],
    ['PREVARICACION', 'Prevaricación', '404', 'prevaricación|prevaricació'],
    ['COHECHO', 'Cohecho', '419', 'cohecho|soborno|suborn'],
    ['MALVERSACION', 'Malversación', '432', 'malversación|malversació'],
    ['DENUNCIA_FALSA', 'Acusación o denuncia falsa / simulación de delito', '456-457', 'denuncia falsa|acusación falsa|simulación de delito|denúncia falsa|simulació de delicte'],
    ['FALSO_TESTIMONIO', 'Falso testimonio', '458', 'falso testimonio|fals testimoni'],
    ['QUEBRANTAMIENTO', 'Quebrantamiento de condena o medida cautelar', '468', 'quebrantamiento de condena|quebrantamiento de medida cautelar|quebrantamiento de orden de alejamiento|quebrantamiento|trencament de condemna|trencament de mesura cautelar'],
    ['ODIO', 'Delito de odio', '510', 'delito de odio|incitación al odio|delicte d\'odi|incitació a l\'odi'],
    ['ATENTADO', 'Atentado contra la autoridad', '550', 'atentado contra la autoridad|atentado contra agentes de la autoridad|atentado|atemptat contra l\'autoritat|atemptat'],
    ['RESISTENCIA_DESOBEDIENCIA', 'Resistencia y desobediencia', '556', 'resistencia y desobediencia|resistencia a agentes de la autoridad|desobediencia grave|desobediencia|resistencia|resistència i desobediència|desobediència|resistència'],
    ['DESORDENES', 'Desórdenes públicos', '557', 'desórdenes públicos|alteración del orden público|desordres públics'],
    ['ARMAS', 'Tenencia ilícita de armas', '564', 'tenencia ilícita de armas|tenencia de armas prohibidas|tinença il·lícita d\'armes'],
    ['ORGANIZACION_CRIMINAL', 'Organización o grupo criminal', '570 bis', 'pertenencia a organización criminal|organización criminal|grupo criminal|organització criminal|grup criminal'],
    ['TERRORISMO', 'Terrorismo', '573', 'enaltecimiento del terrorismo|terrorismo|terrorisme'],
    ['CONTRABANDO', 'Contrabando', 'LO 12/1995', 'contrabando|contraban']
  ];

  const ENTRADAS = CATALOGO.map(([id, nombre, art, s]) => ({ id, nombre, art, sinonimos: [nombre.toLowerCase(), ...s.split('|')] }));
  const POR_NORMA = new Map();
  for (const e of ENTRADAS) for (const s of e.sinonimos) { const k = norm(s); if (k && !POR_NORMA.has(k)) POR_NORMA.set(k, e); }

  const PREFIJOS = /^(presunto |presunta )?(delito |delicte |falta )?(leve |lleu |grave |greu )?(de |d |por |contra )?/;
  function identificar(valor) {
    const k = norm(valor);
    if (!k) return null;
    if (POR_NORMA.has(k)) return POR_NORMA.get(k);
    const sin = k.replace(PREFIJOS, '').replace(/ (leve|lleu|grave|greu|en grado de tentativa|tentativa|intentado)$/, '');
    return sin !== k && POR_NORMA.has(sin) ? POR_NORMA.get(sin) : null;
  }

  // ---------- patrón para texto libre ----------
  const VOC = { a: 'aáàä', e: 'eéèë', i: 'iíìï', o: 'oóòö', u: 'uúùü', c: 'cç', n: 'nñ' };
  const escRe = c => c.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  function patron(s) {
    const palabras = s.replace(/[()]/g, ' ').trim().split(/\s+/);
    return palabras.map(w => {
      let p = '';
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        if (ch === 'l' && w[i + 1] === '·' && w[i + 2] === 'l') { p += 'l(?:[·.]?l)?'; i += 2; continue; }
        if (ch === "'") { p += "['’´]?\\s?"; continue; }
        const b = sinT(ch);
        p += VOC[b] ? '[' + VOC[b] + ']' : escRe(ch);
      }
      return p;
    }).join('[\\s(),.\\-\\/]+') + (s.includes('(') ? '\\)?' : '');
  }
  const TODOS = [];
  for (const e of ENTRADAS) for (const s of e.sinonimos) TODOS.push([s, e]);
  TODOS.sort((a, b) => b[0].length - a[0].length);
  const RX = new RegExp('(?<![\\p{L}\\d])(?:' + TODOS.map(([s]) => patron(s)).join('|') + ')(?![\\p{L}\\d])', 'giu');

  function detectar(texto) {
    const out = [];
    for (const m of String(texto || '').matchAll(RX)) {
      const e = identificar(m[0]) || POR_NORMA.get(norm(m[0]));
      if (e) out.push({ start: m.index, end: m.index + m[0].length, text: m[0], entrada: e });
    }
    return out;
  }

  // "art. 234 CP", "artículos 237 y 238 del Código Penal"
  const RX_ART = /(?<![\p{L}])(?:art(?:[íi]culo)?s?\.?)\s*(\d{1,3}(?:\s*(?:bis|ter|quater))?(?:\.\d{1,2})?(?:\s*(?:y|e|i|,|-|a)\s*\d{1,3}(?:\.\d{1,2})?)*)\s*(?:,\s*)?(?:(?:del|de\s+la|de\s+l['’]|de)\s+)?(?:C\.?\s?P\.?(?![\p{L}])|C[óo]digo\s+Penal|Codi\s+Penal)/giu;
  function detectarArticulos(texto) {
    return [...String(texto || '').matchAll(RX_ART)].map(m => ({ start: m.index, end: m.index + m[0].length, text: m[0], art: m[1].replace(/\s+/g, ' ').trim() }));
  }

  return { CATALOGO: ENTRADAS, identificar, detectar, detectarArticulos, norm };
});
