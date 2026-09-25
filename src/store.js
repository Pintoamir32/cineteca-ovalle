import { useSyncExternalStore } from 'react';
import { collections, heroSlides, homeContent, locations, recordExtras, records, site, theme, timelineEvents } from './data';

// Los arreglos de data.js son la fuente viva: el gestor los reemplaza "en el lugar"
// para que todas las páginas que ya los importan vean los cambios sin tocar sus imports.
const LIVE={records,recordExtras,collections,timelineEvents,locations,heroSlides,site,homeContent,theme};
const ORIGINAL=structuredClone(LIVE);

// Colores de toda la app: se aplican como variables CSS sobre :root
export function applyTheme(t=theme){
  const root=document.documentElement.style;
  for(const k of ['acid','forest','black','paper'])if(t[k])root.setProperty(`--${k}`,t[k]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',t.forest);
}

function apply(name,value){
  const target=LIVE[name];
  if(Array.isArray(target)){const copy=[...value];target.splice(0,target.length,...copy);return}
  const copy={...value};
  for(const k of Object.keys(target))delete target[k];
  Object.assign(target,copy);
}

let version=0, lastSaved=null, serverVersion=0;
const listeners=new Set();
const notify=()=>{version++;listeners.forEach(fn=>fn())};
export const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
export const useStoreVersion=()=>useSyncExternalStore(subscribe,()=>version);
export const getLastSaved=()=>lastSaved;

/* ---------- Servidor ----------
   El contenido vive en el servidor (base de datos en Hostinger). Todos los visitantes cargan
   la misma versión; quien inició sesión en el gestor recibe además las fichas en borrador. */

// Avisos para la interfaz: sesión vencida u otra persona guardó antes
const signal=(type,detail)=>window.dispatchEvent(new CustomEvent(type,{detail}));
async function request(url,options){
  const res=await fetch(url,{credentials:'same-origin',...options});
  const body=await res.json().catch(()=>({}));
  if(res.status===401)signal('cms-unauthorized');
  if(res.status===409)signal('cms-conflict');
  if(!res.ok)throw Object.assign(new Error(body.error||'No se pudo conectar con el servidor.'),{status:res.status});
  return body;
}

// Carga el contenido guardado. Si el servidor no responde, el sitio muestra el contenido original.
export async function hydrate(){
  try{
    const saved=await request('/api/content');
    serverVersion=saved.version||0;
    if(saved.data){
      for(const k of Object.keys(LIVE))if(saved.data[k])apply(k,k==='homeContent'?{...ORIGINAL.homeContent,...saved.data[k]}:saved.data[k]);
      lastSaved=saved.updatedAt||null;
    }
  }catch(err){console.warn('No se pudo cargar el contenido guardado',err)}
  applyTheme();
  notify();
}

// Las imágenes y archivos subidos se envían aparte y el contenido guarda solo su dirección
const uploaded=new Map();
async function upload(dataUrl){
  if(uploaded.has(dataUrl))return uploaded.get(dataUrl);
  const blob=await (await fetch(dataUrl)).blob();
  const {url}=await request('/api/media',{method:'POST',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});
  uploaded.set(dataUrl,url);
  return url;
}
async function externalize(node){
  if(typeof node==='string')return node.startsWith('data:')&&node.length>200?upload(node):node;
  if(Array.isArray(node)){for(let i=0;i<node.length;i++)node[i]=await externalize(node[i]);return node}
  if(node&&typeof node==='object'){for(const k of Object.keys(node))node[k]=await externalize(node[k]);return node}
  return node;
}

// Los guardados van en fila: cada uno parte de la versión que dejó el anterior
let queue=Promise.resolve();
function persist(){
  const run=async()=>{
    await externalize(LIVE);
    const res=await request('/api/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:LIVE,baseVersion:serverVersion})});
    serverVersion=res.version;lastSaved=res.updatedAt;
    notify();
  };
  const next=queue.then(run,run);
  queue=next.catch(()=>{});
  return next;
}

// Aplica varios cambios a la vez y los guarda
export function setData(changes){
  for(const [k,v] of Object.entries(changes))if(k in LIVE)apply(k,v);
  if(changes.theme)applyTheme();
  notify();
  return persist();
}

/* ---------- Operaciones de dominio ---------- */

export const SLUG_BY_TYPE={Película:'peliculas',Persona:'personas',Prensa:'prensa',Entrevista:'entrevistas',Artículo:'articulos'};
export const nextId=()=>Math.max(0,...records.filter(r=>r.id<1e9).map(r=>r.id))+1;

export function saveRecord(record,extra){
  const clean={...record,slug:SLUG_BY_TYPE[record.type]||'archivo',updatedAt:new Date().toISOString()};
  const exists=records.some(r=>r.id===clean.id);
  return setData({
    records:exists?records.map(r=>r.id===clean.id?clean:r):[...records,clean],
    recordExtras:{...recordExtras,[clean.id]:extra}
  });
}

// Publicar o despublicar una ficha sin tocar el resto de sus datos
export function setRecordPublished(id,published){
  return setData({records:records.map(r=>{
    if(r.id!==id)return r;
    const {draft,...rest}=r;// eslint-disable-line no-unused-vars
    return published?rest:{...rest,draft:true};
  })});
}

export function deleteRecord(id){
  const extras={};
  for(const [k,v] of Object.entries(recordExtras))if(Number(k)!==id)extras[k]={...v,relations:(v.relations||[]).filter(r=>r!==id)};
  return setData({records:records.filter(r=>r.id!==id),recordExtras:extras});
}

// Guarda un elemento de una lista; si cambia el nombre, actualiza las referencias
export function saveCollection(index,next){
  const prev=collections[index], list=[...collections];
  index<0?list.push(next):list[index]=next;
  const changes={collections:list};
  if(prev&&prev.title!==next.title)changes.records=records.map(r=>r.collection===prev.title?{...r,collection:next.title}:r);
  return setData(changes);
}

export function saveLocation(index,next){
  const prev=locations[index], list=[...locations];
  index<0?list.push(next):list[index]=next;
  const changes={locations:list};
  if(prev&&prev.name!==next.name){
    const swap=l=>l===prev.name?next.name:l, extras={};
    for(const [k,v] of Object.entries(recordExtras))extras[k]={...v,...(v.locations&&{locations:v.locations.map(swap)}),...(v.location&&{location:swap(v.location)})};
    changes.recordExtras=extras;
  }
  return setData(changes);
}

const yearKey=e=>Number((/\d{4}/.exec(e.year)||[])[0])||0;
// Se ordena por año; devuelve la posición en que quedó el hito
export async function saveTimelineEvent(index,next){
  const list=[...timelineEvents];
  index<0?list.push(next):list[index]=next;
  const sorted=list.sort((a,b)=>yearKey(a)-yearKey(b));
  await setData({timelineEvents:sorted});
  return sorted.indexOf(next);
}

export function saveListItem(name,index,next){
  const list=[...LIVE[name]];
  index<0?list.push(next):list[index]=next;
  return setData({[name]:list});
}
export const removeListItem=(name,index)=>setData({[name]:LIVE[name].filter((_,i)=>i!==index)});
export function moveListItem(name,index,dir){
  const list=[...LIVE[name]], to=index+dir;
  if(to<0||to>=list.length)return;
  [list[index],list[to]]=[list[to],list[index]];
  return setData({[name]:list});
}

/* ---------- Respaldo ---------- */

export function exportData(){
  const blob=new Blob([JSON.stringify({...LIVE,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`cineteca-respaldo-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

export async function importData(file){
  const data=JSON.parse(await file.text());
  if(!Array.isArray(data.records)||typeof data.recordExtras!=='object')throw new Error('El archivo no parece un respaldo de la Cineteca.');
  const changes={};
  for(const k of Object.keys(LIVE))if(data[k])changes[k]=data[k];
  return setData(changes);
}

export const resetData=()=>setData(structuredClone(ORIGINAL));
export const originalTheme=()=>structuredClone(ORIGINAL.theme);
export const originalHome=()=>structuredClone(ORIGINAL.homeContent);

// Guarda los colores; si cambia un color de la paleta, las fichas y colecciones que lo usaban lo siguen
export function saveTheme(next){
  const swap=new Map(theme.palette.map((c,i)=>[c.toLowerCase(),next.palette[i]]).filter(([a,b])=>b&&a!==b.toLowerCase()));
  const recolor=item=>{const to=swap.get(String(item.color).toLowerCase());return to?{...item,color:to}:item};
  return setData({theme:next,...(swap.size&&{records:records.map(recolor),collections:collections.map(recolor)})});
}

