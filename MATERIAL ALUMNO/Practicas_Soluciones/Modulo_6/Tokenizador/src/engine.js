'use strict';
/* TokenizadorIA — motor determinista (sin IA, sin red). Portado del Anexo A del prompt original. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TokEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ---------- utilidades ----------
  const qt = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toUpperCase();
  const normKey = s => s.trim().replace(/\s+/g, ' ').toUpperCase();
  const setN = s => new Set(s.split(',').map(x => qt(x.trim())).filter(Boolean));

  const CATS = [
    ['PERSONA', 'Persona'], ['DOC_ID', 'Documento'], ['TIP', 'TIP (Identificador profesional)'],
    ['CUENTA_BANCARIA', 'Cuenta bancaria'], ['TARJETA', 'Tarjeta'], ['TELEFONO', 'Teléfono'],
    ['EMAIL', 'Email'], ['RED_SOCIAL', 'Red social / Perfil (@)'], ['DOMICILIO', 'Domicilio'], ['VIA', 'Vía (calle sin número)'], ['DELITO', 'Delito / tipología penal'], ['ART_CP', 'Artículo del Código Penal'],
    ['LOCALIDAD', 'Localidad / Provincia'], ['MATRICULA', 'Matrícula'], ['FECHA_NAC', 'Fecha de nacimiento'],
    ['URL', 'Dirección web'], ['IP', 'IP'], ['WALLET_CRIPTO', 'Wallet cripto'], ['DILIGENCIAS', 'Diligencias'],
    ['MOVIMIENTO_BANCARIO', 'Movimiento bancario'], ['ENTIDAD', 'Entidad'], ['DATO', 'Otro dato']
  ];

  // ---------- diccionarios (Anexo A.5) ----------
  const NOMBRES = setN('ANTONIO,MANUEL,JOSE,JOSÉ,FRANCISCO,DAVID,JUAN,JAVIER,JOSE ANTONIO,DANIEL,JOSE LUIS,FRANCISCO JAVIER,CARLOS,JESUS,JESÚS,ALEJANDRO,MIGUEL,JOSE MANUEL,RAFAEL,MIGUEL ANGEL,MIGUEL ÁNGEL,PABLO,PEDRO,ANGEL,ÁNGEL,SERGIO,JOSE MARIA,JOSÉ MARÍA,FERNANDO,JORGE,LUIS,ALBERTO,ALVARO,ÁLVARO,ADRIAN,ADRIÁN,DIEGO,JUAN CARLOS,RAUL,RAÚL,IVAN,IVÁN,JUAN JOSE,RUBEN,RUBÉN,ENRIQUE,OSCAR,ÓSCAR,RAMON,RAMÓN,ANDRES,ANDRÉS,VICENTE,JUAN MANUEL,SANTIAGO,JOAQUIN,JOAQUÍN,VICTOR,VÍCTOR,MARIO,EDUARDO,ROBERTO,JAIME,FRANCISCO JOSE,MARCOS,IGNACIO,HUGO,ALFONSO,JORDI,RICARDO,SALVADOR,GUILLERMO,GABRIEL,MARC,EMILIO,MOHAMED,GONZALO,MARTIN,MARTÍN,JOSE MIGUEL,TOMAS,TOMÁS,AGUSTIN,AGUSTÍN,JULIAN,JULIÁN,NICOLAS,NICOLÁS,FELIX,FÉLIX,JOAN,ISMAEL,CRISTIAN,SAMUEL,HECTOR,HÉCTOR,AITOR,JOSEP,MARIA CARMEN,MARÍA CARMEN,MARIA,MARÍA,CARMEN,ANA MARIA,ANA MARÍA,JOSEFA,MARIA PILAR,ISABEL,LAURA,MARIA DOLORES,MARIA TERESA,ANA,CRISTINA,MARTA,MARIA ANGELES,LUCIA,LUCÍA,FRANCISCA,MARIA ISABEL,MARIA JOSE,ANTONIA,DOLORES,SARA,PAULA,ELENA,MARIA LUISA,RAQUEL,ROSA MARIA,PILAR,MANUELA,CONCEPCION,CONCEPCIÓN,MARIA JESUS,MERCEDES,JULIA,BEATRIZ,NURIA,SILVIA,ALBA,IRENE,ROSARIO,JUANA,TERESA,PATRICIA,ENCARNACION,ENCARNACIÓN,MONTSERRAT,ANDREA,ROCIO,ROCÍO,MONICA,MÓNICA,ALICIA,MARIA MAR,SANDRA,SONIA,MARINA,SUSANA,ANGELA,ÁNGELA,NATALIA,YOLANDA,MARGARITA,CLAUDIA,EVA,CARLA,INMACULADA,ESTHER,NOELIA,VERONICA,VERÓNICA,NEREA,CAROLINA,SOFIA,SOFÍA,DANIELA,LORENA,ANA BELEN,MIRIAM,VICTORIA,AMPARO,CONSUELO,FATIMA,FÁTIMA,OLGA,CATALINA,LIDIA,CELIA,ALEJANDRA,AINHOA,CLARA,BELEN,BELÉN,ESTEFANIA');
  const APELL_INAMB = setN('GARCIA,GARCÍA,RODRIGUEZ,RODRÍGUEZ,GONZALEZ,GONZÁLEZ,FERNANDEZ,FERNÁNDEZ,LOPEZ,LÓPEZ,MARTINEZ,MARTÍNEZ,SANCHEZ,SÁNCHEZ,PEREZ,PÉREZ,GOMEZ,GÓMEZ,MARTIN,MARTÍN,JIMENEZ,JIMÉNEZ,RUIZ,HERNANDEZ,HERNÁNDEZ,DIAZ,DÍAZ,MORENO,MUÑOZ,ALVAREZ,ÁLVAREZ,ROMERO,ALONSO,GUTIERREZ,GUTIÉRREZ,NAVARRO,TORRES,DOMINGUEZ,DOMÍNGUEZ,VAZQUEZ,VÁZQUEZ,RAMOS,GIL,RAMIREZ,RAMÍREZ,SERRANO,MOLINA,MORALES,SUAREZ,SUÁREZ,ORTEGA,DELGADO,CASTRO,ORTIZ,MARIN,MARÍN,SANZ,NUÑEZ,NÚÑEZ,IGLESIAS,MEDINA,GARRIDO,CORTES,CORTÉS,CASTILLO,SANTOS,LOZANO,GUERRERO,MENDEZ,MÉNDEZ,CRUZ,PRIETO,FLORES,HERRERA,PEÑA,MARQUEZ,MÁRQUEZ,CABRERA,GALLEGO,CALVO,VIDAL,CAMPOS,REYES,FUENTES,CARRASCO,DIEZ,DÍEZ,CABALLERO,NIETO,AGUILAR,PASCUAL,SANTANA,HERRERO,MONTERO,LORENZO,HIDALGO,GIMENEZ,GIMÉNEZ,IBAÑEZ,IBÁÑEZ,FERRER,DURAN,DURÁN,SANTIAGO,BENITEZ,BENÍTEZ,VARGAS,MORA,VICENTE,ARIAS,CARMONA,CRESPO,ROMAN,ROMÁN,PASTOR,SOTO,SAEZ,SÁEZ,VELASCO,MOYA,SOLER,PARRA,ESTEBAN,BRAVO,GALLARDO,ROJAS,SORIANO,MERINO,RIVERA,ESPINOSA,IZQUIERDO,CAMACHO,VERA,ARROYO,CASADO,RIOS,RÍOS,REDONDO,LUQUE,GALAN,GALÁN,MONTES,REY,SIERRA,SEGURA,CARRILLO,MARCOS,MARTI,MARTÍ,BERNAL,HEREDIA,VALERO,VILA,ROBLES,CONTRERAS,EXPOSITO,EXPÓSITO,PALACIOS,MACIAS,MACÍAS,BENITO,GUERRA,VARELA,ROLDAN,ROLDÁN,PEREIRA,MATEO,MIRANDA,GUILLEN,GUILLÉN,AGUILERA,MATEOS,VILLAR,MENDOZA,APARICIO,RIVAS,SANCHIS,BELTRAN,BELTRÁN,PADILLA,CALDERON,CALDERÓN,ESCOBAR,SALAS,ACOSTA,GALVEZ,GÁLVEZ,CONDE,SALAZAR,JURADO,QUINTANA,PLAZA,GRACIA,ABAD,ARANDA,BLAZQUEZ,BLÁZQUEZ,ROCA,TRUJILLO,COSTA,SERRA,PACHECO,MIGUEL,MANZANO,CUEVAS,RUEDA,BERMUDEZ,BERMÚDEZ,TOMAS,TOMÁS,PONCE');
  const APELL_AMB = setN('BLANCO,LEON,LEÓN,ROSA,CANO,RUBIO,PARDO,VEGA,REINA,CASA,CASAS,CRUZ,CAMPO,CAMPOS,PEÑA,FLORES,TORRE,TORRES,FUENTE,FUENTES,PUENTE,PUENTES,MONTE,MONTES,RIO,RÍO,RIOS,RÍOS,SIERRA,BOSQUE,PRADO,VALLE,CUESTA,PLAZA,CALLE,IGLESIA,ABAD,REY,CONDE,DUQUE,GUERRA,PAZ,FE,AMOR,ALEGRIA,ALEGRÍA,BUENO,MALO,RICO,POBRE,ROJO,NEGRO,VERDE,DORADO,PLATA,ORO,HIERRO,ACERO,PIEDRA,ARENA,MAR,SOL,LUNA,ESTRELLA,CIELO,TIERRA,AGUA,FUEGO,VIENTO,NIEVE,PINO,ROBLE,OLIVO,NARANJO,ROMERO,LAUREL,TRIGO,CEBADA,TORO,CORDERO,LOBO,ZORRO,AGUILA,ÁGUILA,HALCON,HALCÓN,PALOMA,GAVILAN,GAVILÁN');
  const INSTITUCIONAL = setN('GUARDIA,CIVIL,POLICIA,POLICÍA,NACIONAL,LOCAL,JUZGADO,INSTRUCCION,INSTRUCCIÓN,PRIMERA,INSTANCIA,TRIBUNAL,SUPREMO,AUDIENCIA,PROVINCIAL,MINISTERIO,INTERIOR,JUSTICIA,FISCALIA,FISCALÍA,DILIGENCIAS,ATESTADO,OFICIO,DENUNCIA,ACTA,INFORME,COMANDANCIA,PUESTO,PRINCIPAL,EQUIPO,COMPAÑIA,COMPAÑÍA,UNIDAD,ORGANICA,ORGÁNICA,JUDICIAL,VALENCIA,MADRID,BARCELONA,SEVILLA,ALICANTE,CASTELLON,CASTELLÓN,ESPAÑA,BANCO,CAJA,SANTANDER,BBVA,CAIXABANK,SABADELL,BANKINTER,UNICAJA,IBERCAJA,ABANCA,BIZUM,VISA,MASTERCARD,VODAFONE,MOVISTAR,ORANGE,YOIGO,DIGI,MASMOVIL,ENERO,FEBRERO,MARZO,ABRIL,MAYO,JUNIO,JULIO,AGOSTO,SEPTIEMBRE,OCTUBRE,NOVIEMBRE,DICIEMBRE,LUNES,MARTES,MIERCOLES,MIÉRCOLES,JUEVES,VIERNES,SABADO,SÁBADO,DOMINGO,CODIGO,CÓDIGO,PENAL,ARTICULO,ARTÍCULO,LEY,ENJUICIAMIENTO,CRIMINAL,PROTECCION,PROTECCIÓN,DATOS,DELITO,ESTAFA,HURTO,ROBO,AMENAZAS,COACCIONES,LESIONES,BLANQUEO,CAPITALES,DOCUMENTO,ANEXO,PAGINA,PÁGINA,FOLIO,RESUMEN,HECHOS,ANTECEDENTES,CONCLUSIONES,SOLICITA,EXPONE,DISPONE,ACUERDA,CIUDAD,NUMERO,NÚMERO,ESTADO,DETALLES,CANTIDAD,FECHA,HORA,NOMBRE,SALIDA,LLEGADA,CONFIRMADO,TRANSACCION,TRANSACCIÓN,RESERVA,CONDUCTOR,ASIENTOS,PILA,DOCUMENT,STATUS,CANCELED,CANCELADO,EURO,EUROS,CAPITAL,PARIS,PARÍS');
  const CORTANTES = setN('CON,SIN,DNI,NIE,NIF,PASAPORTE,Y,E,O,U,EL,LA,LOS,LAS,UN,UNA,EN,A,AL,POR,PARA,QUE,QUIEN,CUAL,SU,SUS,SE,LE,LES,LO,ES,ERA,FUE,HA,HAN,NACIDO,NACIDA,VECINO,VECINA,MAYOR,MENOR,EDAD,DOMICILIADO,DOMICILIADA,DOMICILIO,HIJO,HIJA,NATURAL,TITULAR,TELEFONO,TELÉFONO,MOVIL,MÓVIL,CORREO,EMAIL,PROVISTO,PROVISTA,MANIFIESTA,DECLARA,EXPONE,DICE,INDICA,REFIERE,SEÑALA,AÑADE,COMPARECE,DENUNCIANTE,DENUNCIADO,DENUNCIADA,INVESTIGADO,INVESTIGADA,DETENIDO,DETENIDA,TESTIGO,VICTIMA,VÍCTIMA,PERJUDICADO,PERJUDICADA,AGENTE,AGENTES,SR,SRA,DON,DOÑA,DÑA,ALIAS,APODO,ESPOSO,ESPOSA,MARIDO,MUJER,PAREJA,PADRE,MADRE,HERMANO,HERMANA,AÑOS,CALLE,AVENIDA,PLAZA,NUM,NÚM,NUMERO,NÚMERO');
  const PARTICULAS = setN('DE,DEL,LA,LAS,LOS,Y,I,D.,DÑA.,DÑA,DON,DOÑA,SR.,SRA.,SR,SRA,Dª,Dª.');

  const IBAN_LEN = { AL:28,AD:24,AT:20,AZ:28,BH:22,BY:28,BE:16,BA:20,BR:29,BG:22,CR:22,HR:21,CY:28,CZ:24,DK:18,DJ:27,DO:28,EG:29,SV:28,EE:20,FO:18,FI:18,FR:27,GE:22,DE:22,GI:23,GR:27,GL:18,GT:28,VA:22,HU:28,IS:26,IQ:23,IE:22,IL:23,IT:27,JO:30,KZ:20,XK:20,KW:30,LV:21,LB:28,LY:25,LI:21,LT:20,LU:20,MT:31,MR:27,MU:30,MD:24,MC:27,MN:20,ME:22,MA:28,NL:18,NI:28,MK:19,NO:15,OM:23,PK:24,PS:29,PL:28,PT:25,QA:29,RO:24,LC:32,RU:33,SM:27,ST:25,SA:24,RS:22,SC:31,SK:24,SI:19,SO:23,ES:24,SD:18,SE:24,CH:21,TL:23,TN:24,TR:26,UA:29,AE:23,GB:22,VG:24,YE:30 };

  const STOP_SUFFIXES = [' con DNI', ' con NIE', ' con documento', ' nacido', ' nacida', ' mayor de edad', ' vecino', ' vecina', ' domiciliado', ' domiciliada', ' natural de', ' hijo de', ' hija de', ' titular', ' quien ', ' el cual', ' la cual'];

  // ---------- regex (Anexo A.1, adaptadas a JavaScript) ----------
  const R = {
    dni: /\b(?:[XYZxyz][\s\-.]?\d{7}|\d{1,2}[.\s]?\d{3}[.\s]?\d{3})[\s\-]?[A-HJ-NP-TV-Za-hj-np-tv-z]\b/g,
    cif: /\b[ABCDEFGHJNPQRSUVWabcdefghjnpqrsuvw][\s\-]?\d{7}[\s\-]?[0-9A-Ja-j]\b/g,
    pasaporte: /\b(?:pasaporte|documento\s+de\s+identidad\s+extranjero|carta\s+de\s+identidad)\s*(?:n[úu]m(?:ero|\.)?|n[º°])?\s*[:\-]?\s*([A-Z0-9]{6,12})\b/gi,
    ibanCtx: /\b(?:IBAN|C[ÓO]DIGO\s+IBAN|N[ÚU]M(?:ERO|\.)?\s*IBAN|CUENTA\s+IBAN|CTA\.?\s*IBAN)\s*[:\-]?\s*([A-Za-z]{2}\d{2}(?:[\s\-.]?[A-Za-z0-9]){11,32})\b/gi,
    iban: /\b[A-Za-z]{2}\d{2}(?:[\s\-.]?[A-Za-z0-9]){11,32}\b/g,
    swift: /\b(?:SWIFT|BIC|C[ÓO]DIGO\s+SWIFT|C[ÓO]DIGO\s+BIC|SWIFT\/BIC|BIC\/SWIFT|BANCO\s*\/\s*BIC|CLAVE\s+SWIFT|COD\.\s*SWIFT|COD\.\s*BIC)\s*[:\-]?\s*([A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}(?:[A-Za-z0-9]{3})?)\b/gi,
    ccc: /\b\d{4}[\s\-.]\d{4}[\s\-.]\d{2}[\s\-.]\d{10}\b/g,
    cccCtx: /\b(?:CUENTA(?:\s+BANCARIA|\s+CORRIENTE)?|C\/?C|CCC|CTA\.?(?:\s*CTE\.?)?|N[ÚU]M(?:ERO|\.)?\s*(?:DE\s*)?CUENTA)\s*[:\-]?\s*(\d{4}[\s\-.]\d{4}[\s\-.]\d{2}[\s\-.]\d{10}|\d{20})\b/gi,
    tarjeta: /\b(?:\d{4}[\s\-]){3}\d{1,4}\b|\b\d{16}\b/g,
    email: /\[?([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,10})\]?/g,
    url: /\b(?:https?:\/\/|www\.)[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+(?:\/[^\s<>"'\)\]]*)?/gi,
    tipEstricto: /\b[A-Za-z][\s\-]?[0-9]{5}[\s\-]?[A-Za-z]\b/g,
    tipCtx: /\b(?:TIP|T\.I\.P\.|N[ÚU]MERO\s+PROFESIONAL|N[º°]\s*PROFESIONAL|CARNET\s+PROFESIONAL|CARN[ÉE]\s+PROFESIONAL|AGENTE|GUARDIA)\s*[:\-#º°]?\s*([A-Za-z][\s\-]?[0-9]{5}[\s\-]?[A-Za-z]|[A-Za-z][\s\-]?[0-9]{5}|[0-9]{5}[\s\-]?[A-Za-z])\b/gi,
    redSocial: /(?<![\w.\-])@([A-Za-z0-9_][A-Za-z0-9_.\-]{1,29})\b/g,
    encabezado: /\bCOMANDANCIA\s+DE\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\s—\-~,;:.@\[\]\/]{25,260}?(?=(?:\r|\n|\.\s|\.\r|\.\n|$))/gi,
    puesto: /\b(?:Puesto\s+Principal|Puesto\s+Ordinario|Puesto)\s+(?:de\s+)?[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+){0,3}\b/gi,
    zona: /\bZONA\s+DE\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+(?:\s+COMANDANCIA\s+DE\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+)?\b/gi,
    compania: /\bCOMPA[ÑN][IÍ]A\s+DE\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+){0,2}\b/gi,
    comandancia: /\bCOMANDANCIA\s+DE\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+){0,2}\b/gi,
    equipo: /\bEQUIPO\s*@\s*[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+){0,2}\b/gi,
    localidad: /\b(?:LOCALIDAD|MUNICIPIO|POBLACI[ÓO]N|T[ÉE]RMINO\s+MUNICIPAL(?:\s+DE)?|CIUDAD|VECIN[OA](?:\/?[AO])?\s+DE|NATURAL\s+DE)\s*[:\-]?\s*([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+(?:\s+(?:de(?:\s+la|\s+los|\s+las)?|del|y|i)\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+|\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+){0,3})/gi,
    provincia: /\b(?:PROVINCIA(?:\s+DE)?)\s*[:\-]?\s*([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+){0,2})/gi,
    cp: /\b(?:COD(?:\.|\s+)?POSTAL|C\.?P\.?|C[ÓO]DIGO\s+POSTAL)\s*[:\-]?\s*(\d{5})\b/gi,
    cripto: /\b(?:0x[a-fA-F0-9]{40}|1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{38,59})\b/g,
    segSocial: /\b(?:NSS|NAF|SEGURIDAD\s+SOCIAL|AFILIACI[ÓO]N\s+A\s+LA\s+SEGURIDAD\s+SOCIAL|N[ÚU]MERO\s+DE\s+AFILIACI[ÓO]N)\s*[:\-]?\s*(\d{2}[\s\/\-]?\d{8}[\s\/\-]?\d{2}|\d{12})\b/gi,
    ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    telInt: /(?:(?:\+|00)[1-9]\d{0,2}|\(\+(?:[1-9]\d{0,2})\))(?:[\s.\-]?(?:\(\d{1,4}\)|\d{1,4})){2,6}\b/g,
    telNanp: /(?<![\w.\-])(?:\+?1[\s.\-]?)?(?:\([2-9]\d{2}\)[\s.\-]?[2-9]\d{2}[\s.\-]?\d{4}|[2-9]\d{2}[.\-][2-9]\d{2}[.\-]\d{4})\b/g,
    telEs: /\b[6789]\d{2}(?:[\s.\-]?\d{2}){3}\b|\b[6789]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}\b|\b[6789]\d{8}\b/g,
    telCtx: /\b(?:tel[eé]fono|tlf|tfno|tel|phone|m[oó]vil|mobile|celular|whatsapp|fax|call)\s*[:.\-]?\s*(\+?\d{1,4}(?:[\s.\-]?(?:\(\d{1,4}\)|\d{1,4})){1,5})\b/gi,
    matricula: /\b\d{4}[\s\-]?[BCDFGHJKLMNPRSTVWXYZ]{3}\b|\b[A-Z]{1,2}[\s\-]\d{4}[\s\-][A-Z]{1,2}\b/g,
    diligencias: /\b(?:diligencias(?:\s+policiales|\s+previas|\s+urgentes)?|atestado(?:\s+policial)?|procedimiento\s+abreviado|sumario|juicio\s+r[áa]pido)\s*(?:n[úu]m(?:ero|\.)?|n[º°])?\s*[:\-]?\s*([0-9]{1,7}\s*[\/\-]\s*[0-9]{2,4}(?:\s*[\/\-]\s*[A-Z0-9]{1,6})?)/gi,
    movBanc: /\b(?:concepto\s+de\s+transferencia|concepto\s+bizum|referencia\s+bancaria|mandato\s+sepa|id\.\s*operaci[óo]n)\s*[:\-]?\s*([^\r\n,;.]{4,50})/gi,
    fechaNac: /\b(?:nacid[oa](?:\/[oa])?\s+(?:en\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s,()]+?\s+)?el(?:\s+d[íi]a)?|fecha\s+de\s+nacimiento)\s*[:\-]?\s*(\d{1,2}\s*(?:[\/\-.]|de\s+)\s*(?:\d{1,2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(?:[\/\-.]|de\s+|del\s+)\s*\d{2,4})/gi,
    personaAncla: /(?:(?<=^|[\s,.;:(\[])(?:D\.|Dña\.|Dª\.|Don|Doña|Sr\.|Sra\.|Sres\.|investigad[oa](?:\/[oa])?|detenid[oa](?:\/[oa])?|denunciante|denunciad[oa](?:\/[oa])?|perjudicad[oa](?:\/[oa])?|víctima|testigo|compareciente|declarante|encausad[oa](?:\/[oa])?|imputad[oa](?:\/[oa])?|letrad[oa](?:\/[oa])?|abogad[oa](?:\/[oa])?|titular(?:\s+de\s+la\s+cuenta|\s+de\s+la\s+l[íi]nea)?|beneficiari[oa](?:\/[oa])?|remitente|ordenante|llamad[oa](?:\/[oa])?|identificad[oa](?:\/[oa])?\s+como|filiaci[óo]n\s+de|a\s+nombre\s+de)\s*[:\-]?\s*)([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+(?:\s+(?:de(?:\s+la|\s+los|\s+las)?|del|y|i)\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+|\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+){1,4})/g,
    hijoDe: /\bhij[oa](?:\/[oa])?\s+de\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+){0,2})\s+y\s+(?:de\s+)?([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+){0,2})/gi,
    domVial: /(?<=^|[\s,.;:(\[])(?:Calle|C\/|Avda\.?|Avenida|Plaza|Pza\.?|Paseo|P\.º|Camino|Cno\.?|Carretera|Ctra\.?|Urbanizaci[óo]n|Urb\.?|Pol[íi]gono|Traves[íi]a|Ronda|Glorieta|Partida|Barrio|Bulevar|Pasaje|Costanilla)\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\s,.ºª\-\/]{4,85}?(?=(?:\s+de\s+la\s+localidad|\s+en\s+el\s+t[ée]rmino|;\s|\.\s|\r|\n|$))/g,
    domFrase: /\b(?:domiciliad[oa](?:\/[oa])?\s+en|con\s+domicilio\s+(?:actual\s+)?en|residente\s+en|sito\s+en)\s*[:\-]?\s*([^\r\n;.]{6,85})/gi,
    capSeq: /(?<![\p{L}])([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+){1,3})(?![\p{L}])|(?<![\p{L}])([A-ZÁÉÍÓÚÜÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ]{2,}){1,3})(?![\p{L}])/gu,
    midCap: /(?<=[a-záéíóúüñ,;:]\s+)([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,})(?![\p{L}])/gu,
    fuzzyToken: /\[{1,2}\s*(?<tipo>[A-Za-z_]+?)[\s_\-]*(?<num>\d+)\s*\]{1,2}/gi,
    seccion: /^(DILIGENCIA\b|ATESTADO\b|ACTA\s+DE\b|INFORME\b|OFICIO\b|DENUNCIA\b|DECLARACI[ÓO]N\b|ANTECEDENTES\b|HECHOS\b|CONCLUSIONES\b|ANEXO\b|PARTE\b|RESUMEN\b)/i
  };

  // ---------- modelo / mapa ----------
  function createMap() { return { counters: {}, entries: [], ignored: new Set(), keyIndex: new Map(), usados: new Set(), noMerge: new Set() }; }
  const COMPACT = new Set(['TELEFONO', 'CUENTA_BANCARIA', 'TARJETA', 'DOC_ID', 'MATRICULA', 'TIP']);

  function compactKey(cat, v) {
    let k = v.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
    if (cat === 'TELEFONO') {
      if (k.startsWith('0034') && k.length === 13) k = k.slice(4);
      else if (k.startsWith('34') && k.length === 11) k = k.slice(2);
    }
    if (cat === 'CUENTA_BANCARIA' && k.length === 24 && k.startsWith('ES') && /^\d+$/.test(k.slice(2))) k = k.slice(4);
    return k;
  }
  function addAlias(e, a) {
    a = (a || '').trim();
    if (a.length < 3 || a.toLowerCase() === e.originalValue.toLowerCase()) return;
    if (e.aliases.some(x => x.toLowerCase() === a.toLowerCase())) return;
    e.aliases.push(a);
  }
  function nextToken(map, cat) {
    if (!map.usados) map.usados = new Set(map.entries.map(e => e.token));
    const tk = k => `[[${cat}_${String(k).padStart(2, '0')}]]`;
    let n = (map.counters[cat] || 0) + 1;
    while (map.usados.has(tk(n))) n++;
    map.counters[cat] = n; map.usados.add(tk(n));
    return tk(n);
  }
  function palabrasNombre(n) {
    return n.replace(/,/g, ' ').split(/\s+/).filter(Boolean).filter(w => !PARTICULAS.has(qt(w))).map(qt).filter(w => w.length > 1);
  }
  function generarAliasPersona(full) {
    const s = full.trim(); const al = new Set();
    const add = x => { if (x && x.trim()) al.add(x.trim()); };
    let nombre = null, ap = null;
    if (s.includes(',')) {
      const i = s.indexOf(','); ap = s.slice(0, i).trim(); nombre = s.slice(i + 1).trim();
      if (ap && nombre) add(nombre + ' ' + ap); else { ap = null; nombre = null; }
    }
    const w = s.replace(/,/g, ' ').split(/\s+/).filter(x => x.length > 1);
    if (nombre && ap) {
      const ap1 = ap.split(/\s+/)[0];
      add(nombre + ' ' + ap); add(ap + ', ' + nombre); add(ap);
      if (ap1 && ap1.length >= 3) { add(nombre + ' ' + ap1); add('Sr. ' + ap1); add('Sra. ' + ap1); add('D. ' + nombre + ' ' + ap1); add('Dña. ' + nombre + ' ' + ap1); }
      if (nombre.split(/\s+/).length > 1) add(nombre);
    } else if (w.length === 2) {
      const [n, a] = w; add(a + ', ' + n);
      if (a.length >= 3) { add(a); add('Sr. ' + a); add('Sra. ' + a); }
      add('D. ' + n + ' ' + a); add('Dña. ' + n + ' ' + a);
    } else if (w.length === 3) {
      const [n, a1, a2] = w; add(a1 + ' ' + a2 + ', ' + n); add(a1 + ' ' + a2); add(n + ' ' + a1);
      if (a1.length >= 3) { add(a1); add('Sr. ' + a1); add('Sra. ' + a1); }
      add('D. ' + n + ' ' + a1 + ' ' + a2); add('Dña. ' + n + ' ' + a1 + ' ' + a2);
    } else if (w.length >= 4) {
      const nc = w[0] + ' ' + w[1], apc = w.slice(2).join(' '), a1 = w[2];
      add(apc + ', ' + nc); add(nc); add(apc); add(w[0] + ' ' + a1);
      if (a1.length >= 3) { add(a1); add('Sr. ' + a1); add('Sra. ' + a1); }
      add('D. ' + nc + ' ' + apc); add('Dña. ' + nc + ' ' + apc);
    }
    return [...al].filter(x => x.toLowerCase() !== s.toLowerCase() && x.length >= 3)
      .sort((a, b) => b.length - a.length);
  }

  /* Índices por texto normalizado y por clave compacta: evitan recorrer todo el diccionario
     (con un CSV puede haber miles de entradas). */
  function indexar(map, e) {
    if (!map.nk) map.nk = new Map();
    if (!map.ck) map.ck = new Map();
    for (const v of [e.originalValue, ...e.aliases]) {
      const k = normKey(v);
      if (!map.nk.has(k) || map.nk.get(k)._dead) map.nk.set(k, e);
      if (COMPACT.has(e.category)) { const c = compactKey(e.category, v); if (c.length >= 6 && (!map.ck.has(c) || map.ck.get(c)._dead)) map.ck.set(c, e); }
    }
  }
  function findExisting(map, v, cat) {
    const k = normKey(v);
    const viva = e => (e && !e._dead ? e : null);
    let hit = viva(map.nk && map.nk.get(k));
    if (hit) return hit;
    if (COMPACT.has(cat) && map.ck) { const c = compactKey(cat, v); if (c.length >= 6) { hit = viva(map.ck.get(c)); if (hit) return hit; } }
    if (map.entries.length > 300) return null;   // con índices basta; el recorrido completo solo en textos pequeños
    for (const e of map.entries) {
      if (normKey(e.originalValue) === k || e.aliases.some(a => normKey(a) === k)) return e;
    }
    if (COMPACT.has(cat)) {
      const ck = compactKey(cat, v);
      if (ck.length >= 6) {
        for (const e of map.entries) {
          if (!COMPACT.has(e.category)) continue;
          const c2 = e.category;
          if (compactKey(c2, e.originalValue) === ck || e.aliases.some(a => compactKey(c2, a) === ck)) return e;
        }
      }
    }
    return null;
  }

  function indexKey(map, e, key) {
    if (!key) return e;
    if (!map.keyIndex) map.keyIndex = new Map();
    map.keyIndex.set(key, e);
    if (!e.keys) e.keys = [];
    if (!e.keys.includes(key)) e.keys.push(key);
    return e;
  }
  /* key: clave de agrupación (dirección normalizada, delito del catálogo...). Con soloClave no se
     compara el texto con el resto del diccionario (necesario para miles de celdas de un CSV). */
  function registerOrReuse(map, valor, categoria, origen, extraAliases, key, opts) {
    const clean = (valor || '').trim();
    if (!clean) throw new Error('Valor vacío');
    const cat = categoria && categoria.trim() ? categoria.trim().toUpperCase() : 'DATO';
    const porClave = key && map.keyIndex && map.keyIndex.get(key);
    const ex = (porClave && !porClave._dead ? porClave : null) || (opts && opts.soloClave ? null : findExisting(map, clean, cat));
    if (ex) {
      indexKey(map, ex, key);
      const explicitNew = /Manual|Aprendizaje|Usuario|Corrección|Corregido/i.test(origen || '');
      const explicitOld = /Manual|Aprendizaje|Usuario|Corrección|Corregido/i.test(ex.origin || '');
      if ((explicitNew || !explicitOld) && ex.category !== cat) {
        ex.category = cat; ex.token = nextToken(map, cat);
      }
      if (explicitNew) ex.origin = origen;
      ex.isEnabled = true;
      (extraAliases || []).forEach(a => addAlias(ex, a));
      indexar(map, ex);
      return ex;
    }
    const token = nextToken(map, cat);
    const e = { token, originalValue: clean, category: cat, origin: origen || 'Manual', isEnabled: true, aliases: [] };
    map.entries.push(e); indexKey(map, e, key);
    if (cat === 'PERSONA') generarAliasPersona(clean).forEach(a => addAlias(e, a));
    (extraAliases || []).forEach(a => addAlias(e, a));
    indexar(map, e);
    return e;
  }
  function reg(map, v, cat, origin, extra, key) {
    v = (v || '').trim();
    if (v.length < 3 || map.ignored.has(normKey(v))) return null;
    return registerOrReuse(map, v, cat, origin, extra, key);
  }

  // ---------- validadores ----------
  function esDniNieValido(raw) {
    let s = raw.replace(/[\s\-.]/g, '').toUpperCase();
    if (s.length !== 9) return false;
    const m = { X: '0', Y: '1', Z: '2' };
    const num = (m[s[0]] || s[0]) + s.slice(1, 8);
    if (!/^\d{8}$/.test(num)) return false;
    return 'TRWAGMYFPDXBNJZSQVHLCKE'[parseInt(num, 10) % 23] === s[8];
  }
  function mod97(str) {
    let r = 0;
    for (const ch of str) {
      const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
      for (const d of v) r = (r * 10 + (+d)) % 97;
    }
    return r === 1;
  }
  function esIbanValido(raw, permitirContextual) {
    const c = raw.replace(/[\s\-.]/g, '').toUpperCase();
    if (c.length < 15 || c.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(c)) return false;
    const exp = IBAN_LEN[c.slice(0, 2)];
    if (!exp) return false;
    if (c.length !== exp) return false;
    if (mod97(c.slice(4) + c.slice(0, 4))) return true;
    return !!permitirContextual;
  }
  function ibanTrim(raw) {
    const clean = raw.replace(/[\s\-.]/g, '').toUpperCase();
    const n = IBAN_LEN[clean.slice(0, 2)];
    if (!n) return raw;
    let cnt = 0;
    for (let i = 0; i < raw.length; i++) {
      if (/[A-Za-z0-9]/.test(raw[i])) { cnt++; if (cnt === n) return raw.slice(0, i + 1); }
    }
    return raw;
  }
  function esCccValido(raw) {
    const d = raw.replace(/[\s\-.]/g, '');
    if (!/^\d{20}$/.test(d)) return false;
    const dc = (digs, w) => { let s = 0; for (let i = 0; i < w.length; i++) s += (+digs[i]) * w[i]; let r = 11 - (s % 11); return r === 11 ? 0 : r === 10 ? 1 : r; };
    return dc(d.slice(0, 8), [4, 8, 5, 10, 9, 7, 3, 6]) === +d[8] && dc(d.slice(10), [1, 2, 4, 8, 5, 10, 9, 7, 3, 6]) === +d[9];
  }
  function esTarjetaLuhn(raw) {
    const d = raw.replace(/[\s\-]/g, '');
    if (!/^\d{13,19}$/.test(d)) return false;
    let sum = 0, alt = false;
    for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
    return sum > 0 && sum % 10 === 0;
  }
  function esSwiftValido(raw) {
    const s = raw.toUpperCase();
    if (s.length !== 8 && s.length !== 11) return false;
    if (!/^[A-Z]{4}/.test(s)) return false;
    const pais = s.slice(4, 6);
    if (!(IBAN_LEN[pais] || ['US', 'CA', 'JP', 'CN', 'AU'].includes(pais))) return false;
    if (!/^[A-Z0-9]+$/.test(s.slice(6))) return false;
    return !INSTITUCIONAL.has(qt(s));
  }
  function esTelValido(v) {
    const d = v.replace(/\D/g, '');
    if (d.length < 7 || d.length > 15) return false;
    if (/[\/:]/.test(v)) return false;
    const t = v.trim();
    if (/^(?:19|20)\d{2}[-.](?:0[1-9]|1[0-2])[-.](?:0[1-9]|[12]\d|3[01])$/.test(t)) return false;
    if (/^(?:0[1-9]|[12]\d|3[01])[-.](?:0[1-9]|1[0-2])[-.](?:19|20)\d{2}$/.test(t)) return false;
    if (/^(\d)\1+$/.test(d)) return false;
    if (['12345678', '123456789', '987654321'].includes(d)) return false;
    if (v.includes(',') && v.includes('.')) return false;
    return true;
  }

  // ---------- nombres ----------
  function limpiarNombre(s) {
    let t = s.trim().replace(/^[,.;:()\[\]"']+|[,.;:()\[\]"']+$/g, '');
    let cut = -1; const low = t.toLowerCase();
    for (const suf of STOP_SUFFIXES) { const i = low.indexOf(suf.toLowerCase()); if (i > 2 && (cut < 0 || i < cut)) cut = i; }
    if (cut > 0) t = t.slice(0, cut);
    return t.trim().replace(/^[,.;:()\[\]"']+|[,.;:()\[\]"']+$/g, '');
  }
  function esNombreValido(n) {
    if (n.length < 4) return false;
    const w = n.split(/\s+/).filter(Boolean);
    if (w.length < 1 || w.length > 6) return false;
    return !w.every(x => INSTITUCIONAL.has(qt(x)));
  }

  // ---------- Capa 1 ----------
  function regTip(map, raw, origin) {
    const v = raw.trim(); const compact = v.replace(/[\s\-]/g, '').toUpperCase();
    const ex = map.entries.find(e => e.category === 'TIP' && (normKey(e.originalValue) === normKey(v) || normKey(e.originalValue) === compact));
    if (ex) { addAlias(ex, v); addAlias(ex, compact); ex.isEnabled = true; return ex; }
    const e = reg(map, v, 'TIP', origin);
    if (e) addAlias(e, compact);
    return e;
  }
  function procTel(raw, map) {
    const v = raw.trim().replace(/[.,;:!?]+$/, '');
    if (!esTelValido(v)) return;
    const digits = v.replace(/\D/g, '');
    for (const e of map.entries) {
      if ((e.category === 'CUENTA_BANCARIA' || e.category === 'TARJETA') && e.originalValue.replace(/\D/g, '').includes(digits)) return;
    }
    reg(map, v, 'TELEFONO', 'Capa 1 (Teléfono)');
  }
  function capa1(t, map) {
    for (const m of t.matchAll(R.ibanCtx)) {
      const v = ibanTrim(m[1].trim().replace(/[.,;:]+$/, ''));
      if (esIbanValido(v, true)) reg(map, v, 'CUENTA_BANCARIA', 'Capa 1 (IBAN contextual)');
    }
    for (const m of t.matchAll(R.iban)) {
      const v = ibanTrim(m[0]);
      if (esIbanValido(v, false)) reg(map, v, 'CUENTA_BANCARIA', 'Capa 1 (IBAN)');
    }
    for (const m of t.matchAll(R.swift)) if (esSwiftValido(m[1])) reg(map, m[1], 'CUENTA_BANCARIA', 'Capa 1 (SWIFT/BIC)');
    for (const m of t.matchAll(R.ccc)) if (esCccValido(m[0])) reg(map, m[0], 'CUENTA_BANCARIA', 'Capa 1 (CCC Bancario Mód. 11)');
    for (const m of t.matchAll(R.cccCtx)) if (esCccValido(m[1]) || m[1].replace(/\D/g, '').length === 20) reg(map, m[1], 'CUENTA_BANCARIA', 'Capa 1 (CCC Contextual)');
    for (const m of t.matchAll(R.tarjeta)) if (esTarjetaLuhn(m[0])) reg(map, m[0], 'TARJETA', 'Capa 1 (Tarjeta Luhn)');
    for (const m of t.matchAll(R.dni)) reg(map, m[0], 'DOC_ID', esDniNieValido(m[0]) ? 'Capa 1 (DNI/NIE Mód. 23)' : 'Capa 1 (Formato DNI/NIE)');
    for (const m of t.matchAll(R.cif)) reg(map, m[0], 'DOC_ID', 'Capa 1 (CIF)');
    for (const m of t.matchAll(R.pasaporte)) reg(map, m[1], 'DOC_ID', 'Capa 1 (Pasaporte)');
    for (const m of t.matchAll(R.email)) {
      const pure = m[1]; const extra = m[0] !== pure ? [m[0]] : [];
      reg(map, pure, 'EMAIL', 'Capa 1 (Email)', extra);
    }
    for (const m of t.matchAll(R.url)) reg(map, m[0].replace(/[.,;)\]]+$/, ''), 'URL', 'Capa 1 (URL)');
    for (const m of t.matchAll(R.ipv4)) reg(map, m[0], 'IP', 'Capa 1 (IPv4)');
    for (const m of t.matchAll(R.telInt)) procTel(m[0], map);
    for (const m of t.matchAll(R.telNanp)) procTel(m[0], map);
    for (const m of t.matchAll(R.telEs)) procTel(m[0], map);
    for (const m of t.matchAll(R.telCtx)) procTel(m[1], map);
    for (const m of t.matchAll(R.matricula)) reg(map, m[0], 'MATRICULA', 'Capa 1 (Matrícula)');
    for (const m of t.matchAll(R.diligencias)) reg(map, m[1], 'DILIGENCIAS', 'Capa 1 (Nº Diligencias)');
    for (const m of t.matchAll(R.movBanc)) reg(map, m[1], 'MOVIMIENTO_BANCARIO', 'Capa 1 (Movimiento bancario)');
    for (const m of t.matchAll(R.tipEstricto)) { if ((m[0].match(/\d/g) || []).length === 5) regTip(map, m[0], 'Capa 1 (TIP Profesional)'); }
    for (const m of t.matchAll(R.tipCtx)) regTip(map, m[1], 'Capa 1 (Ancla TIP)');
    for (const m of t.matchAll(R.redSocial)) {
      if (INSTITUCIONAL.has(qt(m[1]))) continue;
      reg(map, '@' + m[1], 'RED_SOCIAL', 'Capa 1 (Red social)', [m[1]]);
    }
    for (const m of t.matchAll(R.cripto)) reg(map, m[0], 'WALLET_CRIPTO', 'Capa 1 (Wallet)');
    for (const m of t.matchAll(R.segSocial)) reg(map, m[1], 'DOC_ID', 'Capa 1 (Seguridad Social)');
    for (const m of t.matchAll(R.cp)) reg(map, m[1], 'DOMICILIO', 'Capa 1 (Código postal)');
  }

  // ---------- Capa 2 ----------
  function capa2(t, map) {
    for (const m of t.matchAll(R.fechaNac)) reg(map, m[1], 'FECHA_NAC', 'Capa 2 (Fecha de nacimiento)');
    for (const m of t.matchAll(R.hijoDe)) {
      for (const g of [m[1], m[2]]) { const n = limpiarNombre(g || ''); if (esNombreValido(n)) reg(map, n, 'PERSONA', 'Capa 2 (Ancla Filiación Padres)'); }
    }
    for (const m of t.matchAll(R.personaAncla)) {
      const n = limpiarNombre(m[1]); if (esNombreValido(n)) reg(map, n, 'PERSONA', 'Capa 2 (Ancla Jurídico-Policial)');
    }
    const G = typeof self !== 'undefined' ? self : globalThis, TD = G.TokDir, TL = G.TokDelitos;
    if (TD) {
      for (const d of TD.detectar(t)) {
        const k = TD.claveDetectada(d, map.agr, map.modoDir);
        reg(map, d.text, k.cat, d.rev ? 'Capa 2 (Dirección: nº de la vía)' : 'Capa 2 (Dirección vial)', [d.text], k.key);
      }
    }
    for (const rx of TD ? [R.domFrase] : [R.domVial, R.domFrase]) {
      for (const m of t.matchAll(rx)) {
        const v = recortarDomicilio(m[1] || m[0]);
        if (v.length >= 6) reg(map, v, 'DOMICILIO', 'Capa 2 (Domicilio)');
      }
    }
    if (TL && map.detectarDelitos !== false) {
      for (const d of TL.detectar(t)) reg(map, d.text, 'DELITO', `Capa 2 (Delito: ${d.entrada.nombre}, art. ${d.entrada.art} CP)`, [d.text], 'DEL:' + d.entrada.id);
      for (const a of TL.detectarArticulos(t)) reg(map, a.text, 'ART_CP', 'Capa 2 (Artículo CP)', [a.text], 'ARTX:' + a.art.replace(/\s+/g, '').toLowerCase());
    }
    for (const m of t.matchAll(R.encabezado)) { const v = m[0].trim().replace(/[.,;\-]+$/, ''); if (v.length >= 25) reg(map, v, 'ENTIDAD', 'Capa 2 (Encabezado Comandancia)'); }
    for (const rx of [R.puesto, R.zona, R.compania, R.comandancia, R.equipo]) for (const m of t.matchAll(rx)) reg(map, m[0], 'ENTIDAD', 'Capa 2 (Unidad)');
    for (const m of t.matchAll(R.localidad)) { const v = m[1].trim(); if (v.length >= 3 && !v.split(/\s+/).every(w => INSTITUCIONAL.has(qt(w)))) reg(map, v, 'LOCALIDAD', 'Capa 2 (Ancla Localidad)'); }
    for (const m of t.matchAll(R.provincia)) { const v = m[1].trim(); if (v.length >= 3) reg(map, v, 'LOCALIDAD', 'Capa 2 (Ancla Provincia)'); }
  }

  /* «con domicilio en Camino Viejo 9, ha caído al suelo…»: tras cada coma solo se sigue si lo que viene es parte de
     la dirección (piso, puerta, escalera, CP, un municipio del listado o un nombre de lugar que va solo); un verbo o
     una conjunción cortan el domicilio */
  const SIGUE_DOM = /^(?:\d|n[º°]|s\/n|bajo|bj|baix|entresuelo|entlo|[áa]tico|sobre[áa]tico|piso|pis|planta|pl\.?|pta\.?|puerta|porta|esc\.?|escalera|escala|bloque|bloc|blq|portal|izq|izquierda|esquerra|dcha|derecha|dreta|centro|local|km|kil[óo]metro|C\.?\s?P\.?|edificio|edif|urbanizaci[óo]n|urb|residencial|pol[íi]gono|partida|pda)(?![a-záéíóúñ])/i;
  const CORTA_DOM = /\s+(?:y|e|i|que|donde|cuando|aunque|pero|tras|mientras|porque|cuyo|cuya)\s+(?![A-ZÁÉÍÓÚÜÑ\d])/;
  const LUGAR_SOLO = /^\p{Lu}[\p{L}'’·\-]*(?:\s+(?:(?:de|del|la|las|los|el|els|les|i|y)\s+)?(?:[dl]['’]\s?)?\p{Lu}[\p{L}'’·\-]*){0,3}(?:\s*\([^)]{2,30}\))?$/u;
  function recortarDomicilio(v) {
    const M = (typeof self !== 'undefined' ? self : globalThis).TokMunicipios;
    const partes = String(v).split(',');
    let out = partes[0];
    for (let i = 1; i < partes.length; i++) {
      const p = partes[i].trim();
      if (!p) break;
      if (SIGUE_DOM.test(p) && !CORTA_DOM.test(' ' + p)) { out += ',' + partes[i]; continue; }
      const n = M ? M.alInicio(p) : 0;
      if (n) {   // municipio del listado (y su provincia entre paréntesis, si la lleva)
        const prov = /^\s*\([^)]{2,30}\)/.exec(p.slice(n)), fin = n + (prov ? prov[0].length : 0);
        out += ', ' + p.slice(0, fin);
        if (p.slice(fin).trim()) break; else continue;
      }
      if (LUGAR_SOLO.test(p)) { out += ',' + partes[i]; continue; }   // localidad que no está en el listado
      break;
    }
    const c = CORTA_DOM.exec(out); if (c) out = out.slice(0, c.index);
    return out.trim().replace(/[.,;:]+$/, '');
  }

  // ---------- Capa 3 ----------
  function capa3(t, map) {
    for (const m of t.matchAll(R.capSeq)) {
      const raw = (m[1] || m[2] || '').trim();
      const words = raw.split(/\s+/);
      if (raw.length < 5 || words.length < 2 || words.length > 4) continue;
      if (words.some(w => INSTITUCIONAL.has(qt(w)))) continue;
      const q = words.map(qt);
      const startsName = NOMBRES.has(q[0]) || (q.length > 1 && NOMBRES.has(q[0] + ' ' + q[1]));
      const apellidoPosterior = q.slice(1).some(w => APELL_INAMB.has(w) || APELL_AMB.has(w));
      const cond1 = startsName && apellidoPosterior;
      const cond2 = APELL_INAMB.has(q[0]) && (APELL_INAMB.has(q[1]) || APELL_AMB.has(q[1]));
      if (cond1 || cond2) reg(map, raw, 'PERSONA', 'Capa 3 (Gazetteer INE / NLP)');
    }
  }

  // ---------- Capa 3.5 ----------
  function consolidar(map) {
    const personas = map.entries.filter(e => e.category === 'PERSONA' && e.isEnabled);
    for (const p of personas) {
      if (!map.entries.includes(p)) continue;
      const pw = palabrasNombre(p.originalValue);
      if (pw.length === 0 || pw.length > 2 || /persona distinta/.test(p.origin)) continue;
      const cont = personas.filter(o => o !== p && map.entries.includes(o) && (() => {
        const ow = palabrasNombre(o.originalValue); return ow.length > pw.length && pw.every(w => ow.includes(w));
      })());
      if (cont.length === 1) {
        const c = cont[0];
        addAlias(c, p.originalValue); p.aliases.forEach(a => addAlias(c, a));
        map.entries.splice(map.entries.indexOf(p), 1); p._dead = true; indexar(map, c);
      }
    }
  }

  // ---------- Capa 4 ----------
  const ACC = { a: 'aáàä', e: 'eéèë', i: 'iíìï', o: 'oóòö', u: 'uúùü', c: 'cç' };
  const escRe = c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function accentIns(ch) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return ACC[base] && base.length === 1 ? '[' + ACC[base] + ']' : escRe(ch);
  }
  function flexPattern(term) {
    const t = term.trim();
    let p = t.split(/\s+/).map(w => [...w].map(accentIns).join('')).join('[\\s\\u00A0]+');
    if (/[\p{L}\p{N}]/u.test(t[0])) p = '(?<![\\p{L}\\p{N}_\\[\\]])' + p;
    if (/[\p{L}\p{N}]/u.test(t[t.length - 1])) p += '(?![\\p{L}\\p{N}_\\[\\]])';
    return p;
  }
  function compactPattern(cat, value) {
    const key = compactKey(cat, value);
    const SEP = '[\\s .\\-/]{0,3}';
    const body = [...key].map(escRe).join(SEP);
    let prefix = '';
    if (cat === 'TELEFONO' && key.length === 9) prefix = '(?:(?:\\+|00)\\s?34' + SEP + ')?';
    if (cat === 'CUENTA_BANCARIA' && key.length === 20 && /^\d+$/.test(key)) prefix = '(?:ES' + SEP + '\\d' + SEP + '\\d' + SEP + ')?';
    return '(?<![\\p{L}\\p{N}_\\[\\]+])' + prefix + body + '(?![\\p{L}\\p{N}_\\[\\]])';
  }
  /* Versión ligera para teléfonos, cuentas, DNI…: solo dígitos y letras ASCII, sin banderas i/u,
     porque compilar miles de patrones Unicode insensibles a mayúsculas es muy lento en CSV grandes. */
  function compactPatternFast(cat, value) {
    const key = compactKey(cat, value);
    const SEP = '[\\s.\\-/]{0,3}';
    const body = [...key].map(ch => (/[A-Z]/.test(ch) ? '[' + ch + ch.toLowerCase() + ']' : /[0-9]/.test(ch) ? ch : escRe(ch))).join(SEP);
    let prefix = '';
    if (cat === 'TELEFONO' && key.length === 9) prefix = '(?:(?:\\+|00)\\s?34' + SEP + ')?';
    if (cat === 'CUENTA_BANCARIA' && key.length === 20 && /^\d+$/.test(key)) prefix = '(?:[Ee][Ss]' + SEP + '\\d' + SEP + '\\d' + SEP + ')?';
    return '(?<![A-Za-z0-9\\u00C0-\\u024F_\\[\\]+])' + prefix + body + '(?![A-Za-z0-9\\u00C0-\\u024F_\\[\\]])';
  }
  function patternFor(entry, term) {
    if (COMPACT.has(entry.category)) {
      const k = compactKey(entry.category, term);
      if (k.length >= 6) return compactPattern(entry.category, term);
    }
    return flexPattern(term);
  }
  const isUpper = s => s === s.toUpperCase() && s !== s.toLowerCase();

  /* Lista de patrones compilados (se reutiliza para todas las celdas de un CSV). */
  function buildMatcher(map) {
    const seen = new Map();
    for (const e of map.entries) {
      if (!e.isEnabled || !e.originalValue || e.soloCelda) continue;
      const terms = [[e.originalValue, true], ...e.aliases.map(a => [a, false])];
      for (const [t, isVal] of terms) {
        const tt = t.trim();
        if (!isVal && (tt.length < 3 || map.ignored.has(normKey(tt)))) continue;
        if (!tt) continue;
        const k = normKey(tt);
        if (!seen.has(k)) seen.set(k, { term: tt, entry: e });
      }
    }
    const out = [];
    for (const { term, entry } of [...seen.values()].sort((a, b) => b.term.length - a.term.length)) {
      const compact = COMPACT.has(entry.category) && compactKey(entry.category, term).length >= 6;
      let rx; try { rx = compact && /^[A-Z0-9]+$/.test(compactKey(entry.category, term)) ? new RegExp(compactPatternFast(entry.category, term), 'g') : new RegExp(patternFor(entry, term), 'giu'); } catch (_) { continue; }
      const probe = compact ? compactKey(entry.category, term) : (qt(term).split(/[^\p{L}\p{N}]+/u).filter(Boolean).sort((x, y) => y.length - x.length)[0] || '');
      out.push({ rx, entry, compact, probe });
    }
    return out;
  }
  function capa4(text, map, opts) {
    opts = opts || {};
    const list = opts.matcher || buildMatcher(map);
    const tq = qt(text), tc = text.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
    const occ = new Uint8Array(text.length + 1);
    const free = (s, e) => { for (let i = s; i < e; i++) if (occ[i]) return false; return true; };
    const mark = (s, e, v) => { for (let i = s; i < e; i++) occ[i] = v; };
    const spans = [];
    for (const { rx, entry, compact, probe } of list) {
      if (probe && !(compact ? tc.includes(probe) : tq.includes(probe))) continue;
      for (const m of text.matchAll(rx)) {
        if (!m[0]) continue;
        const s = m.index, e = s + m[0].length;
        if (!free(s, e)) continue;
        mark(s, e, 1);
        spans.push({ start: s, end: e, kind: 'token', entry });
      }
    }
    if (!opts.noCand) {
    // apellidos sueltos tras personas
    const suffix = /[ \t ]+([\p{L}'\-]+)/uy;
    for (const sp of [...spans].filter(x => x.entry.category === 'PERSONA').sort((a, b) => a.start - b.start)) {
      const up = isUpper(text.slice(sp.start, sp.end));
      let pos = sp.end;
      for (let k = 0; k < 2; k++) {
        suffix.lastIndex = pos;
        const m = suffix.exec(text); if (!m) break;
        const w = m[1]; const ws = pos + m[0].length - w.length, we = ws + w.length;
        if (w.length < 3 || !/^\p{Lu}/u.test(w)) break;
        if (up ? !isUpper(w) : isUpper(w)) break;
        const q = qt(w);
        if (CORTANTES.has(q) || INSTITUCIONAL.has(q)) break;
        if (!free(ws, we) || map.ignored.has(normKey(w))) break;
        spans.push({ start: ws, end: we, kind: 'cand', sub: 'apellido', personStart: sp.start });
        mark(ws, we, 2); pos = we;
      }
    }
    // falsos negativos
    for (const m of text.matchAll(R.midCap)) {
      const s = m.index, e = s + m[0].length;
      if (m[1].length < 4 || !free(s, e) || map.ignored.has(normKey(m[1]))) continue;
      if (INSTITUCIONAL.has(qt(m[1]))) continue;
      spans.push({ start: s, end: e, kind: 'cand', sub: 'dudoso' });
      mark(s, e, 2);
    }
    }
    spans.sort((a, b) => a.start - b.start);
    const segments = []; let md = ''; let pos = 0; let total = 0; const susp = [];
    const plain = (a, b) => { if (b > a) { const t = text.slice(a, b); segments.push({ text: t, kind: 'PlainText', start: a, length: b - a }); md += t; } };
    for (const s of spans) {
      plain(pos, s.start);
      if (s.kind === 'token') {
        const e = s.entry; total++;
        segments.push({ text: e.token, kind: 'ConfirmedToken', token: e.token, orig: e.originalValue, category: e.category,
          tooltip: `Dato original oculto: "${e.originalValue}" (${e.category} - ${e.origin})`, start: s.start, length: s.end - s.start });
        md += e.token;
      } else {
        const x = text.slice(s.start, s.end); susp.push(x);
        const tip = s.sub === 'apellido'
          ? `Posible apellido junto a una persona ya tokenizada: "${x}". Si es parte del mismo nombre, selecciónalo junto con el token y tokenízalo: se mantendrá el mismo identificador.`
          : `Posible dato sensible no tokenizado: "${x}". Clic para elegir la tipología con la que tokenizarlo o para ignorarlo.`;
        segments.push({ text: x, kind: 'SuspiciousCandidate', category: 'PERSONA', tooltip: tip, sub: s.sub,
          term: s.sub === 'apellido' ? text.slice(s.personStart, s.end) : x, start: s.start, length: s.end - s.start });
        md += x;
      }
      pos = s.end;
    }
    plain(pos, text.length);
    return { tokenizedMarkdown: md, segments, suspiciousCandidates: susp, totalReplacements: total };
  }

  // ---------- API principal ----------
  function analizar(input, map) { if (input) { capa1(input, map); capa2(input, map); capa3(input, map); } }
  function tokenize(input, map, opts) {
    if (!input) return { tokenizedMarkdown: '', segments: [], activeEntries: [], suspiciousCandidates: [], totalReplacements: 0 };
    analizar(input, map); consolidar(map);
    const r = capa4(input, map, opts);
    r.activeEntries = map.entries.filter(e => e.isEnabled);
    return r;
  }

  function detokenize(text, map) {
    const lookup = new Map();
    for (const e of map.entries) {
      const m = /^\[\[([A-Z_]+)_(\d+)\]\]$/.exec(e.token); if (!m) continue;
      const n = parseInt(m[2], 10);
      lookup.set(m[1] + '_' + String(n).padStart(2, '0'), e); lookup.set(m[1] + '_' + n, e);
      lookup.set(e.token.replace(/[\[\]]/g, ''), e);
    }
    const segs = []; let restored = '', rc = 0, uc = 0, pos = 0;
    for (const m of text.matchAll(R.fuzzyToken)) {
      if (m.index > pos) { const t = text.slice(pos, m.index); segs.push({ text: t, kind: 'PlainText' }); restored += t; }
      const tipo = m.groups.tipo.toUpperCase().replace(/[\s\-]+/g, '_').replace(/^_+|_+$/g, '');
      const n = parseInt(m.groups.num, 10);
      const e = lookup.get(tipo + '_' + String(n).padStart(2, '0')) || lookup.get(tipo + '_' + n);
      if (e && e.originalValue) {
        segs.push({ text: e.originalValue, kind: 'RestoredValue', tooltip: `Restaurado desde ${e.token} (${e.category})` });
        restored += e.originalValue; rc++;
      } else {
        segs.push({ text: m[0], kind: 'UnresolvedToken', tooltip: `Token no encontrado en el diccionario actual: ${m[0]}` });
        restored += m[0]; uc++;
      }
      pos = m.index + m[0].length;
    }
    if (pos < text.length) { const t = text.slice(pos); segs.push({ text: t, kind: 'PlainText' }); restored += t; }
    return { restoredText: restored, diffSegments: segs, restoredCount: rc, unresolvedCount: uc };
  }

  // ---------- acciones interactivas ----------
  function registrarPersona(map, nombre, origin, ask) {
    const words = palabrasNombre(nombre); const pw = words.join(' ');
    const personas = map.entries.filter(e => e.category === 'PERSONA');
    const exact = personas.find(e => [e.originalValue, ...e.aliases].some(v => palabrasNombre(v).join(' ') === pw));
    if (exact) {
      const msg = normKey(exact.originalValue) === normKey(nombre) ? null : `"${nombre}" es el mismo dato que "${exact.originalValue}": se usa ${exact.token}`;
      return { entry: exact, msg };
    }
    const contenidas = personas.filter(e => { const ew = palabrasNombre(e.originalValue); return ew.length && ew.length < words.length && ew.every(w => words.includes(w)); });
    if (contenidas.length) {
      let e = contenidas[0];
      if (contenidas.length > 1 && ask) {
        const r = ask('contiene', nombre, contenidas);
        if (r === null) return { entry: null, msg: 'Operación cancelada.' };
        e = r >= 0 ? contenidas[r] : null;
      }
      if (e) {
        const ant = e.originalValue; e.originalValue = nombre; addAlias(e, ant);
        generarAliasPersona(nombre).forEach(a => addAlias(e, a));
        return { entry: e, msg: `Nombre completado: "${ant}" -> "${nombre}". Sigue siendo ${e.token} en todo el texto.` };
      }
    }
    const contenedoras = personas.filter(e => [e.originalValue, ...e.aliases].some(v => { const vw = palabrasNombre(v); return vw.length > words.length && words.every(w => vw.includes(w)); }));
    if (contenedoras.length) {
      const r = ask ? ask('contenido', nombre, contenedoras) : 0;
      if (r === null) return { entry: null, msg: 'Operación cancelada.' };
      if (r >= 0) { const e = contenedoras[r]; addAlias(e, nombre); return { entry: e, msg: `"${nombre}" es la misma persona que "${e.originalValue}": se usa ${e.token}.` }; }
      const e = registerOrReuse(map, nombre, 'PERSONA', `${origin} ${'(persona distinta)'}`);
      return { entry: e, msg: null };
    }
    return { entry: registerOrReuse(map, nombre, 'PERSONA', origin), msg: null };
  }
  function learn(map, term, cat, origin, ask) {
    term = (term || '').trim().replace(/\s+/g, ' ');
    if (!term) return { entry: null, msg: 'Término vacío.' };
    map.ignored.delete(normKey(term));
    let entry, msg;
    if (cat === 'PERSONA') ({ entry, msg } = registrarPersona(map, term, origin || 'Aprendizaje Interactivo', ask));
    else {
      entry = registerOrReuse(map, term, cat, origin || 'Aprendizaje Interactivo');
      if (normKey(entry.originalValue) !== normKey(term)) msg = `"${term}" es el mismo dato que "${entry.originalValue}": se usa ${entry.token}`;
    }
    if (!entry) return { entry: null, msg };
    entry.isEnabled = true;
    return { entry, msg: msg || `Aprendido y tokenizado: "${term}" -> ${entry.token}` };
  }
  function cambiarCategoria(map, entry, cat) {
    entry.category = cat; entry.origin = 'Selección Manual (Corrección)'; entry.isEnabled = true;
    entry.token = nextToken(map, cat);
    return `Tipología actualizada: "${entry.originalValue}" -> ${entry.token} (${cat})`;
  }
  function revertir(map, token) {
    const e = map.entries.find(x => x.token === token); if (!e) return null;
    e.isEnabled = false; map.ignored.add(normKey(e.originalValue));
    return `Token ${token} revertido a texto plano: "${e.originalValue}"`;
  }
  function ignorar(map, t) { map.ignored.add(normKey(t)); return `Término añadido a lista blanca (no sensible): "${t}"`; }
  function eliminar(map, entry) {
    const i = map.entries.indexOf(entry); if (i >= 0) map.entries.splice(i, 1);
    entry._dead = true;
    (entry.keys || []).forEach(k => { if (map.keyIndex && map.keyIndex.get(k) === entry) map.keyIndex.delete(k); });
    map.ignored.add(normKey(entry.originalValue));
    return `Token ${entry.token} eliminado del diccionario.`;
  }

  // ---------- Markdown ----------
  function normalizeMd(s) {
    s = s.replace(/([a-záéíóúüñA-ZÁÉÍÓÚÜÑ])-\r?\n\s*([a-záéíóúüñA-ZÁÉÍÓÚÜÑ])/g, '$1$2').replace(/\r\n?/g, '\n');
    const special = l => /^\s*(#|\||- |\* |<!--|---|\d+[.)]\s)/.test(l);
    const out = []; let cur = null;
    for (const raw of s.split('\n')) {
      const l = raw.replace(/[ \t]+$/, '');
      if (l.trim() === '') { if (cur !== null) { out.push(cur); cur = null; } out.push(''); continue; }
      if (cur === null) { cur = l; continue; }
      if (special(l) || special(cur) || R.seccion.test(l.trim()) || /[.:;]$/.test(cur)) { out.push(cur); cur = l; }
      else cur += ' ' + l.trim();
    }
    if (cur !== null) out.push(cur);
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ---------- plantillas de prompt ----------
  const REGLA_BLINDAJE = 'REGLA ESTRICTA E INQUEBRANTABLE DE FORMATO Y PRIVACIDAD (BLINDAJE DE TOKENS):\n1. El texto adjunto ha sido seudonimizado mediante tokens planos entre dobles corchetes, como por ejemplo: [[PERSONA_01]], [[DOC_ID_01]], [[CUENTA_BANCARIA_01]], [[DOMICILIO_01]], [[TELEFONO_01]], [[EMAIL_01]], [[MATRICULA_01]], [[TARJETA_01]], [[FECHA_NAC_01]], [[MOVIMIENTO_BANCARIO_01]], [[DILIGENCIAS_01]], [[DELITO_01]], [[VIA_01]], [[ART_CP_01]].\n2. DEBES MANTENER INTACTOS TODOS LOS TOKENS EXACTAMENTE COMO APARECEN (incluyendo los dobles corchetes [[ ]], el nombre de la categoría en mayúsculas, el guion bajo y los dígitos).\n3. NO traduzcas los tokens, NO inventes nombres ficticios para sustituirlos, NO alteres su numeración y NO elimines los corchetes bajo ninguna circunstancia.\n4. Utiliza cada token como si fuera el nombre propio, identificador o dato real dentro de la redacción gramatical.';

  const PLANTILLAS = [
    { id: 'ANALISIS_FINANCIERO_BANCARIO', title: '🏦 Análisis de Movimientos Bancarios y Trazabilidad', description: 'Analiza extractos, transferencias, cargos con tarjeta y flujo de capitales manteniendo cuentas y titulares tokenizados.',
      prompt: "Actúa como Analista Forense Financiero especializado en blanqueo de capitales y estafas tecnológicas.\n\nAnaliza los datos bancarios y financieros del texto tokenizado y genera:\n1. Tabla resumen de cuentas ([[CUENTA_BANCARIA_XX]]), tarjetas ([[TARJETA_XX]]) y titulares ([[PERSONA_XX]]).\n2. Flujo detallado de movimientos relevantes, importes, fechas y conceptos.\n3. Patrones detectados (fraccionamiento, cuentas puente, cargos no autorizados o beneficiarios finales)." },
    { id: 'EXTRACCION_OFICIOS', title: '📑 Propuesta de Oficios y Mandamientos', description: 'Identifica qué gestiones u oficios policiales/judiciales deben solicitarse respecto a los tokens detectados.',
      prompt: "Actúa como Especialista en Investigación Tecnológica y Policía Judicial.\n\nA partir del texto tokenizado, enumera de forma estructurada todas las diligencias de investigación, oficios o mandamientos recomendados (operadoras telefónicas para [[TELEFONO_XX]] o [[IP_XX]], entidades bancarias para [[CUENTA_BANCARIA_XX]] o [[TARJETA_XX]], titulares [[PERSONA_XX]]), indicando el objetivo concreto de cada solicitud." },
    { id: 'REDACCION_ATESTADO', title: '👮 Redacción Técnico-Policial (Estilo Atestado)', description: 'Redacta en tercera persona, tono neutro, objetivo, formal y jurídico-policial propio de diligencias y atestados.',
      prompt: "Actúa como Instructor de Policía Judicial experto en redacción técnico-policial y procesal española.\n\nRedacta una exposición de hechos o diligencia técnico-policial a partir de la información aportada cumpliendo estas pautas:\n- Estilo estrictamente formal, objetivo, neutro y en tercera persona del singular o plural (ej. 'Se hace constar que...', 'De las gestiones practicadas se desprende que...').\n- Estructura clara por párrafos numerados o apartados lógicos en formato Markdown.\n- Cita siempre a las personas, documentos, cuentas, teléfonos, matrículas y domicilios mediante sus tokens exactos (ej. [[PERSONA_01]], titular del documento [[DOC_ID_01]] y de la cuenta [[CUENTA_BANCARIA_01]])." },
    { id: 'RESUMEN_CRONOLOGICO', title: '📋 Resumen Ejecutivo y Cronológico', description: 'Extrae los hechos clave, intervinientes tokenizados, línea temporal cronológica y vínculos entre entidades.',
      prompt: "Actúa como Analista de Inteligencia e Investigación Policial y Jurídica.\n\nElabora un RESUMEN EJECUTIVO Y CRONOLÓGICO estructurado del documento adjunto que incluya:\n1. SÍNTESIS EJECUTIVA DE LOS HECHOS.\n2. RELACIÓN DE INTERVINIENTES Y ELEMENTOS IDENTIFICADOS (empleando exclusivamente sus tokens [[PERSONA_XX]], [[TELEFONO_XX]], [[CUENTA_BANCARIA_XX]], etc.).\n3. CRONOLOGÍA ORDENADA DE EVENTOS, TRANSACCIONES O ACTUACIONES (Fecha/Hora -> Hecho -> Tokens implicados).\n4. CONCLUSIONES O LÍNEAS DE INVESTIGACIÓN RELEVANTES." },
    { id: "ESTADISTICA_PERIODO", title: "📊 Estadística del periodo: informe ejecutivo", description: "Tabla de hechos del periodo (CSV): datos, análisis, conclusiones y propuesta de actuación, en orden ejecutivo.",
      prompt: "[ROL]\nActúa como analista criminal de una Jefatura de Policía Local, especializado en estadística delictiva y en informes ejecutivos para el mando.\n\n[CONTEXTO]\nTe adjunto la tabla de hechos del periodo a analizar (normalmente un CSV con fecha, hora, día de la semana, franja horaria, tipología y lugar). Las tipologías ([[DELITO_XX]]), los artículos ([[ART_CP_XX]]), las direcciones ([[DOMICILIO_XX]] o [[VIA_XX]]) y cualquier otro dato personal están seudonimizados: un mismo token es siempre la misma tipología o el mismo lugar, así que puedes contar, agrupar y comparar con ellos. Si junto a la tabla se indica el periodo o se aporta un periodo anterior de comparación, úsalos; si no, deduce el periodo de las fechas de la propia tabla.\n\n[TAREA]\nElabora un informe estadístico ejecutivo siguiendo exactamente este orden:\n1. RESUMEN EJECUTIVO (máximo 5 líneas): periodo analizado, volumen total de hechos, las 2-3 claves más relevantes y la actuación prioritaria que propones.\n2. DATOS DEL PERIODO, en tablas con recuentos y porcentajes sobre el total:\n   - Hechos por tipología ([[DELITO_XX]]), de mayor a menor.\n   - Distribución por mes (o por semana si el periodo es inferior a dos meses).\n   - Distribución por día de la semana y por franja horaria.\n   - Los 10 lugares con más hechos y la tipología predominante en cada uno.\n   - Si hay periodo de comparación: variación absoluta y porcentual de cada tipología.\n3. ANÁLISIS: patrones temporales (días y franjas de concentración), concentración espacial (qué parte del total acumulan los lugares más afectados), combinaciones relevantes tipología × franja × lugar, tendencias y anomalías. Distingue siempre el dato de su interpretación.\n4. CONCLUSIONES: numeradas, breves y apoyada cada una en una cifra de las tablas.\n5. PROPUESTA DE ACTUACIÓN: medidas concretas y priorizadas (alta, media, baja). Para cada una indica qué (patrullaje preventivo, controles, presencia en franjas críticas, coordinación con otros servicios, prevención y comunicación vecinal…), dónde (tokens de lugar), cuándo (días y franjas) y con qué indicador se medirá su eficacia en el siguiente periodo.\n6. LIMITACIONES DEL DATO: registros incompletos, duplicados o sin lugar, y la advertencia de que los datos reflejan hechos registrados, no necesariamente todos los ocurridos.\n\n[RESTRICCIONES]\n- Calcula únicamente con los datos aportados: no inventes cifras, tendencias ni periodos anteriores. Si un cálculo no es posible, dilo.\n- Comprueba que los totales de cada tabla cuadran con el número total de registros.\n- No atribuyas causas sin base en los datos: preséntalas como hipótesis a verificar.\n\n[FORMATO]\nMarkdown con un título por apartado, tablas para los datos y redacción en tercera persona.\n\n[TONO]\nTécnico, objetivo y orientado a la toma de decisiones del mando.\n\nDatos del periodo:" },
    { id: "INFORME_POLICIA_LOCAL", title: "📝 Informe o atestado de Policía Local (desde notas)", description: "Convierte notas sueltas o un relato básico de una intervención en un informe formal, con datos pendientes y preguntas para ampliarlo.",
      prompt: "[ROL]\nActúa como un agente de Policía Local experimentado en la redacción de diligencias, partes de intervención, informes y atestados.\n\n[CONTEXTO]\nTe adjunto un relato básico o unas notas sueltas de una intervención. El texto está seudonimizado: personas, documentos, domicilios, vehículos, teléfonos y demás datos sensibles aparecen como tokens entre dobles corchetes (por ejemplo, [[DOMICILIO_01]]). Trátalos como si fueran el dato real.\n\n[TAREA]\n1. Identifica el ámbito de la intervención (seguridad ciudadana, alcoholemia, accidente de tráfico, inspección de establecimiento, conflicto vecinal, delito contra el patrimonio, VioGén, animales u otras competencias locales).\n2. Ordena los hechos cronológicamente: requerimiento o detección, desarrollo de la actuación en el lugar y resultado o diligencias practicadas.\n3. Transforma el lenguaje coloquial en terminología técnico-policial rigurosa y sustituye cada dato ausente (horas, fechas, filiaciones, matrículas, direcciones, resultados) por la etiqueta [PENDIENTE: dato que falta].\n4. Recopila al final los datos pendientes y formula preguntas concretas sobre los puntos escuetos o ambiguos (visibilidad, síntomas objetivos, manifestaciones literales, testigos, cadena de custodia, medidas de seguridad) para blindar el informe ante posibles impugnaciones.\n\n[RESTRICCIONES]\n- Cero invenciones: no deduzcas ni rellenes datos, horas, síntomas o manifestaciones que no figuren en el texto.\n- Sin calificaciones jurídicas cerradas: describe los hechos que pudieran ser constitutivos de infracción penal o administrativa, sin afirmar que lo son.\n- Sin juicios de valor: sustituye expresiones subjetivas por descripciones objetivas.\n- No cites artículos de leyes u ordenanzas que no aparezcan en el texto.\n\n[FORMATO]\n**ASUNTO:** motivo de la intervención en una línea.\n**HECHOS:** relato cronológico, objetivo y en tercera persona.\n**ACTUACIONES:** gestiones realizadas por los agentes.\n**DATOS PENDIENTES DE COMPLETAR:** lista con viñetas.\n**PREGUNTAS Y SUGERENCIAS PARA AMPLIAR EL RELATO:** lista con viñetas.\n\n[TONO]\nTécnico-policial, formal, imparcial y en tercera persona.\n\nRelato de la intervención:" },
    { id: "COMPARECENCIA", title: "🗣️ Borrador de comparecencia (relato del denunciante)", description: "Ordena el relato de un ciudadano en una comparecencia cronológica con el ilícito orientativo y preguntas de aclaración.",
      prompt: "[ROL]\nActúa como instructor de diligencias de Policía Local, objetivo y aséptico, de apoyo en la toma de manifestación.\n\n[CONTEXTO]\nTe adjunto la transcripción en bruto o el relato desordenado de un ciudadano que acude a denunciar. Los datos personales están seudonimizados con tokens entre dobles corchetes (por ejemplo, [[TELEFONO_01]]); úsalos como si fueran el dato real.\n\n[TAREA]\n1. Identifica la secuencia temporal real y el posible ilícito penal, solo a título orientativo, con sus elementos típicos (engaño previo, acto de disposición, perjuicio económico, violencia, intimidación…).\n2. Redacta el borrador de la comparecencia en orden cronológico y estilo indirecto (\"Manifiesta el compareciente que...\"), eliminando detalles irrelevantes y ruido emocional, y marcando con [PENDIENTE: ...] cada dato esencial que falte (fechas exactas, importes, teléfonos, identidades, cuentas…).\n3. Redacta preguntas breves y directas para formularlas al denunciante en ese momento y cubrir las lagunas.\n4. Antes de responder, comprueba que no has inventado ni inferido ningún dato, que no presentas opiniones del ciudadano como hechos y que el ilícito figura solo como orientativo.\n\n[RESTRICCIONES]\n- Prohibido inventar datos, completar fechas por tu cuenta o suponer intenciones no expresadas.\n- Sin juicios de valor ni calificaciones jurídicas definitivas.\n- Sin saludos, introducciones ni conclusiones fuera de los tres bloques.\n\n[FORMATO]\n1. **Ilícito penal orientativo y elementos típicos:** viñetas.\n2. **Borrador de comparecencia:** texto continuo en estilo indirecto, listo para pegar en diligencias.\n3. **Preguntas rápidas para el denunciante:** viñetas, una por cada dato [PENDIENTE: ...].\n\nRelato del compareciente:" },
    { id: "DIA_DEL_JUICIO", title: "⚖️ El día del juicio: preparación de la declaración en sala", description: "Radiografía de puntos débiles del atestado y guion de preguntas de Juez, Fiscal, Acusación y Defensa con respuestas recomendadas.",
      prompt: "[ROL]\nActúa como un preparador de sala implacable que domina la técnica del interrogatorio judicial desde cuatro perspectivas: Juez, Ministerio Fiscal, Acusación Particular y Abogado Defensor. Tu objetivo es proteger la credibilidad del agente en estrados mediante rigor técnico y fáctico.\n\n[CONTEXTO]\nTe adjunto el atestado o las diligencias de una actuación en la que el agente declarará como testigo en el juicio oral. El texto ya está seudonimizado con tokens entre dobles corchetes (por ejemplo, [[DILIGENCIAS_01]]): no pidas que se anonimice y trata cada token como el dato real.\n\n[TAREA]\n1. Identifica el ámbito del procedimiento (penal, seguridad vial, ciberdelincuencia, VioGén o delito leve).\n2. Haz una radiografía de los puntos débiles que las partes intentarán explotar: lagunas fácticas u omisiones, contradicciones horarias o de secuencia, expresiones subjetivas o juicios de valor difíciles de ratificar y aspectos técnicos, procesales o de cadena de custodia impugnables.\n3. Formula las preguntas más incisivas y comprometedoras en cuatro bloques (Juez, Fiscal, Acusación y Defensa). Para cada una da la pregunta literal, una respuesta recomendada breve y técnica, lista para decir en voz alta, y el riesgo o trampa que esconde.\n4. Al terminar, ofrece seguir en modo interrogatorio continuo con repreguntas sobre las respuestas del agente.\n\n[RESTRICCIONES]\n- Cero invenciones: no inventes sentencias, artículos legales ni hechos que no figuren en el atestado. Si falta un dato clave, señálalo como riesgo en sala.\n- Cero respuestas evasivas o falsas: toda respuesta recomendada debe apoyarse en hechos objetivos, en la ratificación técnica o en el reconocimiento honesto de lo que no se presenció o no se recuerda con exactitud.\n- No reescribas el atestado: céntrate en defenderlo y explicarlo en el juicio oral.\n\n[FORMATO]\nGuion de sala:\n- **Puntos débiles del atestado** (lista breve).\n- Cuatro secciones: **Juez**, **Fiscal**, **Acusación** y **Defensa**. En cada punto:\n  **Pregunta:** \"texto literal\"\n  **Respuesta sugerida:** \"contestación técnica, breve y aséptica\"\n  **Riesgo:** dónde quiere pillar al agente quien pregunta.\n\nAtestado o diligencias:" },
    { id: "ANTECEDENTES_INSTANCIA", title: "🏛️ Antecedentes de informe desde una instancia ciudadana", description: "Resume una instancia o queja vecinal en un párrafo de \"Antecedentes del hecho\", sin ruido ni diagnósticos dados por ciertos.",
      prompt: "[ROL]\nActúa como un agente de la Policía Local experto en redacción de informes técnico-policiales.\n\n[CONTEXTO]\nEsta Jefatura ha recibido una instancia ciudadana (por ejemplo, desde el Registro General del Ayuntamiento) que denuncia una problemática vecinal o de convivencia. Necesito procesar el escrito para redactar el apartado de \"Antecedentes del hecho\" del informe policial previo a la intervención. Los datos personales y los domicilios aparecen como tokens entre dobles corchetes (por ejemplo, [[DOMICILIO_01]]); úsalos tal cual.\n\n[TAREA]\nAnaliza el texto de la instancia y redacta un resumen fundamentado siguiendo estas reglas estrictas:\n- Extrae únicamente los datos de identificación, la ubicación y los hechos de interés policial o administrativo (por ejemplo: insalubridad, plagas, tenencia de animales, ruidos en horario nocturno, cortes de suministro, indicios de riesgo de incendio, posibles situaciones de vulnerabilidad).\n- Descarta todo el ruido informativo: reproches a la Administración, anécdotas familiares o médicas de terceros, opiniones personales, rumores y amenazas de acudir a la prensa.\n- No inventes datos ni números de artículos de leyes u ordenanzas.\n- No des por confirmados diagnósticos médicos ni situaciones personales (por ejemplo, un posible síndrome de Diógenes): refléjalos siempre como indicios o manifestaciones de la parte requirente, pendientes de comprobación in situ.\n\n[FORMATO]\nUn único párrafo continuo de prosa corrida (sin títulos, sin viñetas, sin guiones y sin secciones), listo para pegar en el apartado de Antecedentes de un informe oficial.\n\n[TONO]\nTécnico-policial, objetivo, aséptico y en tercera persona, con fórmulas de atribución como \"la parte requirente manifiesta\", \"según el escrito presentado\" o \"refiere la posible existencia de...\".\n\nTexto de la instancia ciudadana:" },
    { id: 'ESTANDAR_BLINDAJE', title: '⚡ Tokenización Estándar (Solo Blindaje)', description: 'Antepone únicamente la directiva estricta de conservación de tokens [[...]] para usar con cualquier instrucción libre.',
      prompt: "INSTRUCCIÓN ESTRICTA DE FORMATO: Procesa el siguiente texto manteniendo intactos todos los tokens entre dobles corchetes (ej. [[PERSONA_01]], [[DOC_ID_01]]). No los traduzcas, no modifiques su numeración ni elimines los corchetes.\n\nAnaliza y procesa el siguiente contenido respetando íntegramente todos los marcadores de datos protegidos:" }
  ];

  function buildPrompt(tpl, tokenized) {
    tpl = tpl || PLANTILLAS[0];
    const p = (tpl.prompt || '').trim();
    if (!p) return (tokenized || '').trim();
    const sep = (p.includes('BLINDAJE DE TOKENS') || p.includes('[[PERSONA_')) ? '\n\n' : '\n\n' + REGLA_BLINDAJE + '\n\n';
    return (p + sep + (tokenized || '')).trim();
  }

  return { buildMatcher, capa4, analizar, consolidar, qt, compactKey, COMPACT, indexKey, indexar, addAlias,
    CATS, createMap, tokenize, detokenize, learn, cambiarCategoria, revertir, ignorar, eliminar, normalizeMd,
    buildPrompt, PLANTILLAS, REGLA_BLINDAJE, registerOrReuse, generarAliasPersona, nextToken,
    esDniNieValido, esIbanValido, esCccValido, esTarjetaLuhn, esTelValido, normKey };
});
