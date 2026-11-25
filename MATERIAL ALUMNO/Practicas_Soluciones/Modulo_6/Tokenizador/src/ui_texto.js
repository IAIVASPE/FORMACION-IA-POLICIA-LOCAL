(function(){
'use strict';
const E=TokEngine, $=id=>document.getElementById(id);
let map=E.createMap(), result=null, analyzed='', timer=null, restoredText='';
const CAT_LABEL=Object.fromEntries(E.CATS);

/* ---------- utilidades ---------- */
function status(m){$('status').textContent=m;}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
async function copy(text){
  try{ if(navigator.clipboard&&window.isSecureContext!==false){await navigator.clipboard.writeText(text);return true;} }catch(_){}
  const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();
  let ok=false;try{ok=document.execCommand('copy');}catch(_){}ta.remove();return ok;
}
async function readClip(){
  try{return await navigator.clipboard.readText();}catch(_){return prompt('Tu navegador no permite leer el portapapeles automáticamente.\nPega aquí el texto (Ctrl+V):')||'';}
}
function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'_'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());};

/* ---------- plantillas ---------- */
let templates=[];
function loadTemplates(){
  /* plantillas guardadas por el usuario + las predeterminadas nuevas que aún no ha visto (las que borró no vuelven) */
  let vistas=[];try{vistas=JSON.parse(localStorage.getItem('tokia_prompts_vistas')||'[]')||[];}catch(_){}
  try{const s=localStorage.getItem('tokia_prompts'); if(s){const a=JSON.parse(s); if(Array.isArray(a)&&a.length){templates=a;
    for(const p of E.PLANTILLAS)if(!vistas.includes(p.id)&&!templates.some(x=>x.id===p.id))templates.push({...p});}}}catch(_){}
  if(!templates.length)templates=E.PLANTILLAS.map(t=>({...t}));
  try{localStorage.setItem('tokia_prompts_vistas',JSON.stringify(E.PLANTILLAS.map(p=>p.id)));}catch(_){}
}
window.TokPlantillas=()=>templates;
function saveTemplates(){try{localStorage.setItem('tokia_prompts',JSON.stringify(templates));}catch(_){}}
/* predeterminadas = las plantillas fijadas por el usuario (la primera vez, las que tenía en ese momento) */
function predeterminadas(){
  try{const a=JSON.parse(localStorage.getItem('tokia_prompts_pred')||'null');if(Array.isArray(a)&&a.length)return a.map(t=>({...t}));}catch(_){}
  return E.PLANTILLAS.map(t=>({...t}));
}
function fijarPred(){try{localStorage.setItem('tokia_prompts_pred',JSON.stringify(templates));}catch(_){}}
function fillTplSelect(keepId){
  const sel=$('tpl');sel.innerHTML='';
  templates.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.title;sel.appendChild(o);});
  if(keepId&&templates.some(t=>t.id===keepId))sel.value=keepId;
}
const curTpl=()=>templates.find(t=>t.id===$('tpl').value)||templates[0];

/* ---------- tokenización en vivo ---------- */
function run(){
  const input=$('in').value;
  if(!input.trim()){map=E.createMap();result=null;analyzed='';renderTok(true);updateChips();status('Texto de entrada vacío. Tokens reseteados y mapa de equivalencias en blanco.');redetok();return;}
  try{
    analyzed=$('optJoin').checked?E.normalizeMd(input):input.replace(/\r\n?/g,'\n');
    result=E.tokenize(analyzed,map);
    renderTok(false);updateChips();
    status(`Tokenización completada: ${result.activeEntries.length} tokens activos · ${result.totalReplacements} apariciones blindadas.`);
    redetok();
  }catch(e){status('Error en motor de tokenización: '+e.message);console.error(e);}
}
function schedule(){clearTimeout(timer);timer=setTimeout(run,150);}
function updateChips(){
  $('cOk').textContent=`🔒 ${result?result.totalReplacements:0} Protegidos (Clic para revertir)`;
  $('cWarn').textContent=`⚠️ ${result?result.suspiciousCandidates.length:0} Dudosos (Clic para tokenizar)`;
}

/* ---------- render panel 2 ---------- */
function renderTok(reset){
  const out=$('tokOut'), st=out.scrollTop;
  out.innerHTML='';
  if(!result||!result.segments.length){const s=document.createElement('span');s.className='ph';s.textContent='El texto tokenizado aparecerá aquí automáticamente al escribir texto o soltar un documento en el Panel 1...';out.appendChild(s);return;}
  const frag=document.createDocumentFragment();
  for(const g of result.segments){
    if(g.kind==='PlainText'){frag.appendChild(document.createTextNode(g.text));continue;}
    const s=document.createElement('span');
    s.dataset.start=g.start;
    if(g.kind==='ConfirmedToken'){
      s.className='tok';s.textContent=g.token;s.dataset.token=g.token;s.dataset.orig=g.orig;
      s.title=g.tooltip+'\n\n👉 Clic izquierdo para revertir a texto original\n👉 Clic derecho o botón «Tokenizar» para corregir tipología';
    }else{
      s.className='cand';s.textContent=g.text;s.dataset.orig=g.text;s.dataset.term=g.term;s.dataset.cand='1';
      s.title=g.tooltip;
    }
    frag.appendChild(s);
  }
  out.appendChild(frag);
  out.scrollTop=reset?0:st;
}

/* ---------- menú contextual de tipologías ---------- */
const ctx=$('ctx');
function hideCtx(){ctx.style.display='none';ctx.innerHTML='';}
document.addEventListener('mousedown',e=>{if(!ctx.contains(e.target))hideCtx();});
window.addEventListener('scroll',e=>{if(e.target!==ctx&&!ctx.contains(e.target))hideCtx();},true);
function addItem(label,fn,cls){const d=document.createElement('div');d.textContent=label;if(cls)d.className=cls;if(fn)d.onclick=()=>{hideCtx();fn();};ctx.appendChild(d);}
/* acciones del menú: por defecto, sobre el texto de esta pestaña; la pestaña CSV pasa las suyas */
const OPS_TXT={
  revertir:e=>{status(E.revertir(map,e.token));run();},
  ignorar:t=>{status(E.ignorar(map,t));run();},
  cambiar:(e,c)=>{status(E.cambiarCategoria(map,e,c));run();},
  aprender:(t,c)=>learnTerm(t,c,'Selección Manual')
};
function showMenu(x,y,{entry,text},ops){
  ops=ops||OPS_TXT;
  ctx.innerHTML='';
  if(entry){
    addItem(`Corregir tipología: "${entry.originalValue}" (${entry.token})`,null,'h');
    addItem(`Tipología actual: ${entry.category}`,null,'d');
    ctx.appendChild(document.createElement('hr'));
    addItem(ops.textoRevertir||'↩ Revertir a texto original (desactivar token)',()=>ops.revertir(entry));
  }else{
    addItem(`Tokenizar: "${text.length>40?text.slice(0,40)+'…':text}"`,null,'h');
    if(ops.ignorar)addItem(`🚫 Ignorar (no es dato sensible)`,()=>ops.ignorar(text));
  }
  ctx.appendChild(document.createElement('hr'));
  for(const [cat,label] of E.CATS){
    const cur=entry&&entry.category===cat;
    addItem(label+(cur?' (Actual)':''),cur?null:()=>{
      if(entry)ops.cambiar(entry,cat);
      else ops.aprender(text,cat);
    },cur?'d':'');
  }
  ctx.style.display='block';
  const w=ctx.offsetWidth,h=ctx.offsetHeight;
  ctx.style.left=Math.max(4,Math.min(x,innerWidth-w-8))+'px';
  ctx.style.top=Math.max(4,Math.min(y,innerHeight-h-8))+'px';
}
function menuSobre(btn,info,ops){   // menú encima del botón «Tokenizar texto seleccionado»
  const r=btn.getBoundingClientRect();
  showMenu(r.left,r.top-8-Math.min(ctx.scrollHeight,380),info,ops);
  ctx.style.top=Math.max(4,r.top-ctx.offsetHeight-6)+'px';
}
window.TokMenu={abrir:showMenu,sobre:menuSobre};

/* ---------- aprendizaje interactivo ---------- */
function ask(kind,nombre,cands){
  if(kind==='contiene'){
    for(let i=0;i<cands.length;i++){
      if(confirm(`«${nombre}» contiene a varias personas ya tokenizadas.\n¿Es «${cands[i].originalValue}» (${cands[i].token}) el nombre completo?\n\nAceptar = sí · Cancelar = probar con la siguiente`))return i;
    }
    return -1;
  }
  const c=cands[0];
  return confirm(`«${nombre}» aparece dentro del nombre de una persona ya tokenizada:\n«${c.originalValue}» (${c.token}).\n\n¿Es la misma persona?\nAceptar = sí (mismo token) · Cancelar = es otra persona (token nuevo)`)?0:-1;
}
function learnTerm(term,cat,origin){
  const r=E.learn(map,term,cat||'PERSONA',origin||'Aprendizaje Interactivo',ask);
  run(); if(r&&r.msg)status(r.msg);
}

/* ---------- interacción panel 2 ---------- */
$('tokOut').addEventListener('click',e=>{
  const t=e.target.closest('span[data-start]'); if(!t)return;
  const sel=getSelection(); if(sel&&!sel.isCollapsed&&sel.toString().length>1)return;
  if(t.dataset.token){status(E.revertir(map,t.dataset.token));run();}
  else if(t.dataset.cand){e.stopPropagation();showMenu(e.clientX,e.clientY,{text:t.dataset.term||t.dataset.orig});}
});
$('tokOut').addEventListener('contextmenu',e=>{
  const t=e.target.closest('span[data-start]');
  const sel=getSelection();
  if(sel&&!sel.isCollapsed&&sel.toString().trim().length>=2){
    const r=selectionInfo(); if(r){e.preventDefault();showMenu(e.clientX,e.clientY,r);return;}
  }
  if(!t)return;
  e.preventDefault();
  if(t.dataset.token){const en=map.entries.find(x=>x.token===t.dataset.token);if(en)showMenu(e.clientX,e.clientY,{entry:en});}
  else showMenu(e.clientX,e.clientY,{text:t.dataset.term||t.dataset.orig});
});
const BORDER=/^[\s\t\r\n,.;:()"'\[\]{}“”«»—–\-¿?¡!]+|[\s\t\r\n,.;:()"'\[\]{}“”«»—–\-¿?¡!]+$/g;
function nodeText(n){
  if(n.nodeType===3)return n.nodeValue;
  if(n.dataset&&n.dataset.orig!==undefined)return n.dataset.orig;
  return [...n.childNodes].map(nodeText).join('');
}
function selectionInfo(){
  const sel=getSelection(); if(!sel||!sel.rangeCount||sel.isCollapsed)return null;
  const rg=sel.getRangeAt(0), out=$('tokOut');
  if(!out.contains(rg.commonAncestorContainer))return null;
  const a=(rg.startContainer.nodeType===3?rg.startContainer.parentElement:rg.startContainer).closest&&(rg.startContainer.nodeType===3?rg.startContainer.parentElement:rg.startContainer).closest('.tok');
  const b=(rg.endContainer.nodeType===3?rg.endContainer.parentElement:rg.endContainer).closest&&(rg.endContainer.nodeType===3?rg.endContainer.parentElement:rg.endContainer).closest('.tok');
  if(a&&a===b){const en=map.entries.find(x=>x.token===a.dataset.token);if(en)return{entry:en};}
  const txt=nodeText(rg.cloneContents()).replace(/\s+/g,' ').replace(BORDER,'');
  if(!txt)return{invalid:true};
  return{text:txt};
}
$('bSel').addEventListener('click',()=>{
  let info=selectionInfo();
  if(!info){ // mirar el textarea del panel 1
    const ta=$('in'); const s=ta.value.substring(ta.selectionStart,ta.selectionEnd).replace(/\s+/g,' ').replace(BORDER,'');
    if(s)info={text:s};
  }
  if(!info){alert('SELECCIONE UN TEXTO\n\nSeleccione primero con el ratón cualquier término, nombre o dato en el panel de texto tokenizado (panel central) y vuelva a pulsar «Tokenizar selección».');return;}
  if(info.invalid){alert('SELECCIONE UN TEXTO VÁLIDO\n\nLa selección contiene solo signos de puntuación o espacios.');return;}
  menuSobre($('bSel'),info);
});

/* ---------- entrada ---------- */
$('in').addEventListener('input',schedule);
$('optJoin').addEventListener('change',run);
$('bClearIn').onclick=()=>{$('in').value='';$('ai').innerHTML='';map=E.createMap();run();redetok();status('Panel limpiado. Se han reseteado todos los tokens y el mapa de equivalencias está en blanco.');};
$('bPasteIn').onclick=async()=>{const t=await readClip();if(t){$('in').value=t;run();}};
$('bSample').onclick=()=>{
  $('in').value=
`DILIGENCIAS POLICIALES nº 1234/2026

En Valencia, a 5 de noviembre de 2026, comparece D. Juan Carlos Pérez García, con DNI 12345678Z, nacido el 14/03/1985, vecino de Moncada, con domicilio en Calle Mayor 12, 3º B, 46113 Moncada. Facilita el teléfono 612 34 56 78 y el correo jcperez@example.com.

Manifiesta que el día 2 de noviembre realizó una transferencia desde su cuenta IBAN ES91 2100 0418 4502 0005 1332 a la cuenta de Dña. María López Sánchez, y que le cargaron además en la tarjeta 4111 1111 1111 1111. El Sr. Pérez añade que el vehículo, matrícula 1234 BCD, estaba aparcado cerca y que el perfil @juanperez85 recibió amenazas desde la IP 192.168.1.10. Fue atendido por el agente Ramírez.`;
  run();
};

/* ---------- archivos ---------- */
function htmlToText(h){
  return h.replace(/<(script|style)[\s\S]*?<\/\1>/gi,'').replace(/<h1[^>]*>/gi,'\n# ').replace(/<h2[^>]*>/gi,'\n## ').replace(/<h3[^>]*>/gi,'\n### ')
   .replace(/<li[^>]*>/gi,'\n- ').replace(/<(br|\/p|\/div|\/tr|\/h\d)[^>]*>/gi,'\n').replace(/<\/t[dh]>/gi,' | ').replace(/<\/?(b|strong)>/gi,'**')
   .replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/[ \t]+/g,' ');
}
function decode(buf){
  const u=new Uint8Array(buf);
  if(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF)return new TextDecoder('utf-8').decode(u.slice(3));
  if(u[0]===0xFF&&u[1]===0xFE)return new TextDecoder('utf-16le').decode(u);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(u);}catch(_){return new TextDecoder('windows-1252').decode(u);}
}
async function ingest(files){
  const LT=window.TokLector;
  if(files.length===1&&window.TokCsvUI&&(/\.(csv|tsv)$/i.test(files[0].name)||(LT&&LT.esTabla(files[0].name)))&&confirm(`«${files[0].name}» es una tabla.\n\n¿Abrirla en la pestaña «CSV por columnas»? Allí se tokenizan las direcciones y los delitos columna a columna.\n\nAceptar = sí · Cancelar = tratarla como texto aquí`)){window.TokCsvUI.abrir(files[0]);return;}
  const parts=[], names=[], avisos=[];
  for(const f of files){
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(LT&&(LT.esDocumento(f.name)||LT.esTabla(f.name))){
      status(`Leyendo «${f.name}»…`);
      try{
        const r=await LT.leer(f);
        let t=r.tipo==='tabla'
          ?r.hojas.filter(h=>h.filas.some(x=>x.some(Boolean))).map(h=>(r.hojas.length>1?`## ${h.nombre}\n\n`:'')+LT.tablaMd(h.filas)).join('\n\n')
          :r.texto;
        if(r.aviso)avisos.push(`«${f.name}»: ${r.aviso}`);
        if(!String(t||'').trim()){parts.push(`[«${f.name}» no contiene texto que se pueda leer]`);continue;}
        parts.push(files.length>1?`## ${f.name}\n\n${t}`:t);names.push(f.name+(r.paginas?` (${r.paginas} pág.)`:''));
      }catch(e){console.error(e);parts.push(`[No se pudo leer "${f.name}": ${e.message}]`);}
      continue;
    }
    if(!['txt','md','csv','tsv','log','json','xml','html','htm','eml'].includes(ext)){parts.push(`[No se pudo leer "${f.name}": formato no admitido (usa Word, PDF, Excel o texto; o copia y pega el texto)]`);continue;}
    try{
      let t=decode(await f.arrayBuffer());
      if(ext==='html'||ext==='htm')t=htmlToText(t);
      if(ext==='eml'){const i=t.search(/\r?\n\r?\n/);const h=t.slice(0,i<0?0:i),b=i<0?t:t.slice(i);
        const g=n=>{const m=new RegExp('^'+n+':\\s*(.+)$','mi').exec(h);return m?m[1].trim():'';};
        t=`**De:** ${g('From')}\n**Para:** ${g('To')}\n**Fecha:** ${g('Date')}\n**Asunto:** ${g('Subject')}\n\n${b.trim()}`;}
      if(ext==='csv'){const l=t.split(/\r?\n/).filter(Boolean);const sep=((l[0]||'').match(/;/g)||[]).length>=((l[0]||'').match(/,/g)||[]).length?';':',';
        const cols=(l[0]||'').split(sep).length;if(cols<=50&&l.length){t=l.map((r,i)=>'| '+r.split(sep).map(c=>c.replace(/\|/g,'\\|').trim()).join(' | ')+' |'+(i===0?'\n|'+' --- |'.repeat(cols):'')).join('\n');}}
      parts.push(files.length>1?`## ${f.name}\n\n${t}`:t);names.push(f.name);
    }catch(e){parts.push(`[No se pudo leer "${f.name}": ${e.message}]`);}
  }
  if(!parts.length)return;
  const joined=parts.join('\n\n---\n\n'), cur=$('in').value.trim();
  $('in').value=cur?cur+'\n\n---\n\n'+joined:joined;
  $('dropInfo').textContent=names.length?('Cargado: '+names.join(', ')):'o pega el texto abajo';
  run(); status(`${names.length} archivo(s) leídos en local y tokenizados (${result?result.totalReplacements:0} sustituciones).`);
  if(avisos.length)alert('AVISO\n\n'+avisos.join('\n\n'));
}
window.TokTexto={ingest};
const drop=$('drop');
drop.onclick=()=>$('file').click();
$('file').onchange=e=>{ingest([...e.target.files]);e.target.value='';};
['dragenter','dragover'].forEach(n=>document.addEventListener(n,e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){e.preventDefault();drop.classList.add('over');}}));
['dragleave','drop'].forEach(n=>document.addEventListener(n,e=>{if(n==='dragleave'&&e.relatedTarget)return;drop.classList.remove('over');}));
document.addEventListener('drop',e=>{if(document.body.dataset.tab==='csv')return;if(e.dataTransfer&&e.dataTransfer.files.length){e.preventDefault();ingest([...e.dataTransfer.files]);}});

/* ---------- copias ---------- */
function tokenizedText(){return result?result.tokenizedMarkdown:'';}
async function doCopy(kind){
  const tx=tokenizedText(); const tpl=curTpl();
  if(kind!=='prompt'&&!tx){alert('SIN CONTENIDO\n\nNo hay texto tokenizado que copiar.');return;}
  let text,msg;
  if(kind==='all'){text=E.buildPrompt(tpl,tx);msg=`✅ Copiado al portapapeles: Prompt '${tpl.title}' + Texto tokenizado.`;}
  else if(kind==='txt'){text=tx;msg='✅ Copiado al portapapeles: texto tokenizado.';}
  else{text=E.buildPrompt(tpl,'').trim();msg=`✅ Copiado al portapapeles: Prompt '${tpl.title}'.`;}
  status((await copy(text))?msg:'No se pudo copiar al portapapeles.');
}
function needTok(){const t=tokenizedText();if(!t){alert('SIN CONTENIDO\n\nNo hay texto tokenizado que exportar.');return null;}return t;}
$('bExpTxt').onclick=()=>{const t=needTok();if(t==null)return;TokUI.download(`Texto_tokenizado_${stamp()}.txt`,TokUI.txtBlob(t));status('Texto tokenizado guardado como .txt (no contiene datos reales).');};
$('bExpDocx').onclick=()=>{const t=needTok();if(t==null)return;TokUI.download(`Texto_tokenizado_${stamp()}.docx`,TokUI.docxDeTexto(t));status('Texto tokenizado guardado como .docx (no contiene datos reales).');};
$('bExpCsv').onclick=()=>{const t=needTok();if(t==null)return;TokUI.download(`Texto_tokenizado_${stamp()}.csv`,TokUI.csvBlob(TokUI.textoACsv(t,TokCSV.serialize)));status('Texto tokenizado guardado como .csv (las tablas se exportan como tabla; el resto, una línea por fila).');};
$('bExpXlsx').onclick=()=>{const t=needTok();if(t==null)return;const tb=TokCSV.parse(TokUI.textoACsv(t,TokCSV.serialize),';');TokUI.download(`Texto_tokenizado_${stamp()}.xlsx`,TokUI.xlsxDeTabla(tb.header,tb.rows,'Texto tokenizado'));status('Texto tokenizado guardado como Excel (.xlsx): las tablas, como tabla; el resto, una línea por fila.');};
$('bCopyAll').onclick=()=>doCopy('all');$('bCopyTxt').onclick=()=>doCopy('txt');$('bCopyPrompt').onclick=()=>doCopy('prompt');

/* ---------- panel 3 ---------- */
let rendering=false;
function redetok(){
  const src=$('ai'), out=$('restOut'); rendering=true;
  if(!src.textContent.trim()){out.innerHTML='';const s=document.createElement('span');s.className='ph';s.textContent='Pega la respuesta de la IA en la parte superior para ver y editar el documento final destokenizado (se conserva el formato)...';out.appendChild(s);
    restoredText='';$('cUnres').style.display='none';rendering=false;return;}
  const d=TokUI.destokenizarDom(src,out,map,E);
  restoredText=out.textContent;
  $('cUnres').textContent=`❌ ${d.uc} No reconocidos`;$('cUnres').style.display=d.uc?'':'none';
  status(d.uc?`Destokenización completada: ${d.rc} restaurados, ${d.uc} tokens no reconocidos.`:`Destokenización completada con éxito: ${d.rc} datos reales restaurados (formato conservado).`);
  rendering=false;
}
const trasPegar=()=>{redetok();if(restoredText.trim())TokUI.verResultado($('ai'));};
TokUI.enlazarPegado($('ai'),trasPegar);
$('ai').addEventListener('input',redetok);
$('restOut').addEventListener('focus',()=>{const p=$('restOut').querySelector('.ph');if(p)p.remove();});
$('bPasteAi').onclick=async()=>{const d=await TokUI.readClipRich();if(d.html||d.text){$('ai').innerHTML='';TokUI.pegarEn($('ai'),d);trasPegar();}};
$('bClearAi').onclick=()=>{$('ai').innerHTML='';redetok();TokUI.verEntrada($('ai'));};
function needRest(){if(!$('restOut').textContent.trim()||$('restOut').querySelector('.ph')){alert('SIN TEXTO DESTOKENIZADO\n\nPega primero la respuesta de la IA en el panel superior derecho.');return false;}return true;}
$('bCopyRest').onclick=async()=>{if(!needRest())return;status((await TokUI.copyRich($('restOut')))?'✅ Texto destokenizado copiado con su formato (puedes pegarlo en Word).':'No se pudo copiar.');};
$('bTxt').onclick=()=>{if(!needRest())return;TokUI.download(`Informe_IA_${stamp()}.txt`,TokUI.txtBlob(TokUI.domToText($('restOut'))));status('Guardado como .txt conservando saltos de línea, párrafos y sangrías (revisa tu carpeta de descargas).');};
$('bDocx').onclick=()=>{if(!needRest())return;TokUI.download(`Informe_IA_${stamp()}.docx`,TokUI.docxDeHtml($('restOut')));status('Documento guardado como .docx con el formato original (revisa tu carpeta de descargas).');};

/* ---------- generador .docx (sin librerías) ---------- */
const xe=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const wr=(t,b,sz)=>`<w:r><w:rPr>${b?'<w:b/>':''}${sz?`<w:sz w:val="${sz}"/>`:''}</w:rPr><w:t xml:space="preserve">${xe(t)}</w:t></w:r>`;
function runsMd(t,forceB,sz){return t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(p=>/^\*\*[^*]+\*\*$/.test(p)?wr(p.slice(2,-2),true,sz):wr(p,forceB,sz)).join('');}
function mdToDocBody(md){
  const L=md.replace(/\r\n?/g,'\n').split('\n'); let o='',i=0;
  const para=(inner,ind)=>`<w:p><w:pPr><w:spacing w:after="120"/>${ind?`<w:ind w:left="${ind}" w:hanging="220"/>`:''}</w:pPr>${inner}</w:p>`;
  while(i<L.length){
    const l=L[i];
    if(/^\s*\|/.test(l)){
      const rows=[];while(i<L.length&&/^\s*\|/.test(L[i])){rows.push(L[i]);i++;}
      const data=rows.filter(r=>!/^\s*\|[\s:|\-]+\|?\s*$/.test(r)).map(r=>r.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
      const n=Math.max(...data.map(r=>r.length)),w=Math.floor(9000/n);
      const bd=['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join('');
      o+=`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${bd}</w:tblBorders></w:tblPr><w:tblGrid>${'<w:gridCol w:w="'+w+'"/>'.repeat(n)}</w:tblGrid>`+
        data.map((r,ri)=>'<w:tr>'+Array.from({length:n},(_,ci)=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr><w:p>${runsMd(r[ci]||'',ri===0)}</w:p></w:tc>`).join('')+'</w:tr>').join('')+'</w:tbl><w:p/>';
      continue;
    }
    i++;
    if(!l.trim()){o+='<w:p/>';continue;}
    let m;
    if((m=/^###\s+(.*)/.exec(l)))o+=para(runsMd(m[1],true,24));
    else if((m=/^##\s+(.*)/.exec(l)))o+=para(runsMd(m[1],true,26));
    else if((m=/^#\s+(.*)/.exec(l)))o+=para(runsMd(m[1],true,30));
    else if((m=/^\s*[-*]\s+(.*)/.exec(l)))o+=para(wr('• ')+runsMd(m[1],false,22),360);
    else o+=para(runsMd(l,false,22));
  }
  return o;
}
function crcTable(){const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;}
const CRC=crcTable();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;};
function zip(files){
  const enc=new TextEncoder(),chunks=[],cd=[];let off=0;
  const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  for(const f of files){
    const name=enc.encode(f.name),data=enc.encode(f.data),crc=crc32(data);
    const lh=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
    chunks.push(lh,name,data);
    cd.push({name,crc,len:data.length,off});
    off+=lh.length+name.length+data.length;
  }
  const cdStart=off;
  for(const c of cd){
    const h=new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c.crc),...u32(c.len),...u32(c.len),...u16(c.name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(c.off)]);
    chunks.push(h,c.name);off+=h.length+c.name.length;
  }
  const end=new Uint8Array([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(cd.length),...u16(cd.length),...u32(off-cdStart),...u32(cdStart),...u16(0)]);
  chunks.push(end);
  return new Blob(chunks,{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function makeDocx(md){
  const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  return zip([
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:'word/_rels/document.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'word/styles.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`},
    {name:'word/document.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${mdToDocBody(md)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`}
  ]);
}
window.__makeDocx=makeDocx;

/* ---------- mapa de equivalencias ---------- */
function openMap(){
  if(!$('in').value.trim()&&!tokenizedText()){map=E.createMap();}
  renderMap();$('dMap').showModal();
}
function renderMap(){
  const body=$('mapBody');body.innerHTML='';
  $('mapTotal').textContent=`Total: ${map.entries.length} tokens`;
  for(const e of map.entries){
    const tr=document.createElement('tr');
    const c1=document.createElement('td'),cb=document.createElement('input');cb.type='checkbox';cb.checked=e.isEnabled;cb.onchange=()=>{e.isEnabled=cb.checked;if(!cb.checked)map.ignored.add(E.normKey(e.originalValue));else map.ignored.delete(E.normKey(e.originalValue));run();};c1.appendChild(cb);
    const c2=document.createElement('td');c2.className='mono';c2.textContent=e.token;
    const c3=document.createElement('td'),inp=document.createElement('input');inp.type='text';inp.value=e.originalValue;inp.title=e.aliases.length?'Alias: '+e.aliases.join(', '):'Sin alias adicionales';
    inp.onchange=()=>{const v=inp.value.trim();if(v){e.originalValue=v;run();}else inp.value=e.originalValue;};c3.appendChild(inp);
    const c4=document.createElement('td'),sel=document.createElement('select');
    for(const [k,l] of E.CATS){const o=document.createElement('option');o.value=k;o.textContent=l;if(k===e.category)o.selected=true;sel.appendChild(o);}
    sel.onchange=()=>{status(E.cambiarCategoria(map,e,sel.value));run();renderMap();};c4.appendChild(sel);
    const c5=document.createElement('td');c5.style.cssText='color:#64748B;font-size:12px';c5.textContent=e.origin;
    const c6=document.createElement('td'),del=document.createElement('button');del.className='b sm r';del.textContent='🗑';del.onclick=()=>{status(E.eliminar(map,e));run();renderMap();};c6.appendChild(del);
    tr.append(c1,c2,c3,c4,c5,c6);body.appendChild(tr);
  }
}
$('bMap').onclick=openMap;$('mapClose').onclick=()=>$('dMap').close();
(()=>{const s=$('mapCat');for(const [k,l] of E.CATS){const o=document.createElement('option');o.value=k;o.textContent=l;s.appendChild(o);}})();
const addManual=()=>{const v=$('mapVal').value.trim();if(!v)return;learnTerm(v,$('mapCat').value,'Manual Usuario');$('mapVal').value='';renderMap();};
$('mapAdd').onclick=addManual;$('mapVal').addEventListener('keydown',e=>{if(e.key==='Enter')addManual();});

/* ---------- gestor de plantillas ---------- */
let selId=null;
function renderPList(){
  const ul=$('pList');ul.innerHTML='';
  templates.forEach(t=>{const li=document.createElement('li');li.textContent=t.title;if(t.id===selId)li.className='sel';li.onclick=()=>{selId=t.id;fillEditor();renderPList();};ul.appendChild(li);});
}
function fillEditor(){const t=templates.find(x=>x.id===selId);$('pTitle').value=t?t.title:'';$('pDesc').value=t?t.description||'':'';$('pText').value=t?t.prompt:'';}
$('bPrompts').onclick=()=>{selId=curTpl()?curTpl().id:null;renderPList();fillEditor();$('dPrompts').showModal();};
$('pNew').onclick=()=>{const t={id:'USR_'+Date.now(),title:'Nuevo prompt',description:'',prompt:''};templates.push(t);selId=t.id;renderPList();fillEditor();};
$('pSave').onclick=()=>{const t=templates.find(x=>x.id===selId);if(!t)return;t.title=$('pTitle').value.trim()||'Sin título';t.description=$('pDesc').value;t.prompt=$('pText').value;saveTemplates();renderPList();};
$('pDel').onclick=()=>{if(!selId||!confirm('¿Eliminar esta plantilla?'))return;templates=templates.filter(x=>x.id!==selId);if(!templates.length)templates=E.PLANTILLAS.map(t=>({...t}));selId=templates[0].id;saveTemplates();renderPList();fillEditor();};
$('pFijar').onclick=()=>{if(!confirm('¿Fijar las plantillas actuales como predeterminadas?\n\n«Restablecer predeterminadas» volverá a dejarlas tal como están ahora.'))return;fijarPred();status('📌 Plantillas actuales fijadas como predeterminadas.');};
$('pReset').onclick=()=>{if(!confirm('¿Restablecer las plantillas predeterminadas? Se perderán los cambios hechos desde que se fijaron.'))return;templates=predeterminadas();saveTemplates();selId=templates[0].id;renderPList();fillEditor();};
$('pClose').onclick=()=>{const keep=selId;$('dPrompts').close();fillTplSelect(keep);};
$('bHelp').onclick=()=>$('dHelp').showModal();$('hClose').onclick=()=>$('dHelp').close();

/* ---------- arranque ---------- */
loadTemplates();try{if(!localStorage.getItem('tokia_prompts_pred'))fijarPred();}catch(_){}fillTplSelect();renderTok(true);redetok();window.__started=true;
window.__tok={get map(){return map;},run};
})();