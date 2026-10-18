import { records, recordExtras } from './data';

// `records` se sincroniza con lo guardado desde el gestor (ver store.js).
// Las fichas en borrador (despublicadas) solo existen en el gestor: el sitio nunca las ve.
export const isPublished=r=>!!r&&!r.draft;
export function getAllRecords(){
  return records.filter(isPublished);
}
export function countByType(type){
  return getAllRecords().filter(r=>r.type===type).length;
}
export function countByCollection(title){
  return getAllRecords().filter(r=>r.collection===title).length;
}
// Un registro puede tener una sola `location` o varias `locations`
export const placesOf=extra=>extra?.locations||[extra?.location||'Ovalle'];
export function getLocations(id){
  return placesOf(recordExtras[id]);
}
// Personas entrevistadas: una lista de {id} (vinculadas a su ficha) o {name} (escritas a mano). Las
// entrevistas antiguas tenían una sola: la vinculada (`interviewee`) o la que tiene ese nombre
export function getInterviewees(record,extra=recordExtras[record.id],pool=getAllRecords()){
  const people=pool.filter(r=>r.type==='Persona');
  if(Array.isArray(extra?.interviewees))return extra.interviewees.map(x=>{
    const person=x.id!=null?people.find(p=>p.id===x.id):null;
    return person?{person,name:person.title}:{person:null,name:String(x.name||'').trim()};
  }).filter(x=>x.name);
  const person=people.find(p=>p.id===extra?.interviewee)||people.find(p=>norm(p.title)===norm(record.subtitle));
  return person?[{person,name:person.title}]:record.subtitle?.trim()?[{person:null,name:record.subtitle.trim()}]:[];
}
// «Ana», «Ana y Luis», «Ana, Luis y Rosa»
export const joinNames=names=>names.length<2?names[0]||'':`${names.slice(0,-1).join(', ')} y ${names[names.length-1]}`;
export const INTERVIEW_FORMATS=[['text','Texto'],['audio','Audio'],['video','Video']];
export const interviewFormat=extra=>(INTERVIEW_FORMATS.find(([v])=>v===extra?.mediaType)||[])[1]||'';
// Filmografía: películas donde la persona aparece en dirección o créditos
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
// ¿El nombre de una persona (normalizado) corresponde a lo escrito en una dirección o un cargo? Basta el
// comienzo del nombre, hasta el fin de una palabra («Mateo Yuras» → «Mateo Yuras (1941-2008)»). Si nombra
// a varias personas («Ana Pérez, Luis Soto»), vale cada una que tenga nombre y apellido
const startsName=(name,who)=>!!who&&name.startsWith(who)&&!/[a-z0-9]/.test(name[who.length]||'');
const isNamed=(name,who)=>{const w=norm(who);return startsName(name,w)||w.split(/\s*,\s*|\s+y\s+/).some(p=>p!==w&&p.includes(' ')&&startsName(name,p))};
// Ficha de la persona nombrada (para los enlaces de «Dirigida por» y de los cargos)
export function findPerson(who){
  const people=getAllRecords().filter(r=>r.type==='Persona'), w=norm(who);
  return w?people.find(p=>norm(p.title)===w)||people.find(p=>isNamed(norm(p.title),who))||null:null;
}
// Roles de una persona en una película, según su dirección y sus créditos
function filmRoles(name,film,credits=recordExtras[film.id]?.credits){
  const roles=new Set();
  if(film.subtitle&&isNamed(name,film.subtitle))roles.add('Dirección');
  for(const [role,who] of credits||[])if(who&&isNamed(name,who))roles.add(role);
  return roles;
}
// `extra` permite calcular con un borrador sin guardar (vista previa del gestor)
export function getFilmography(person,extra=recordExtras[person.id]){
  const name=norm(person.title), linked=extra?.relations||[];
  return getAllRecords().filter(r=>r.type==='Película').map(film=>{
    const roles=filmRoles(name,film);
    if(!roles.size&&linked.includes(film.id))roles.add('Participación');
    return {film,roles:[...roles]};
  }).filter(e=>e.roles.length).sort((a,b)=>String(a.film.year).localeCompare(String(b.film.year)));
}
// Inverso de la filmografía: personas vinculadas a una película
export function getFilmPeople(film,extra=recordExtras[film.id]){
  const linked=extra?.relations||[];
  return getAllRecords().filter(r=>r.type==='Persona').map(person=>{
    const roles=[...filmRoles(norm(person.title),film,extra?.credits)];
    const theirs=recordExtras[person.id]?.relations||[];
    return {person,roles:roles.length?roles:linked.includes(person.id)||theirs.includes(film.id)?['Mencionada']:[]};
  }).filter(e=>e.roles.length);
}
// Personas mencionadas en cualquier registro (prensa, entrevistas, artículos)
export function getRecordPeople(record,extra=recordExtras[record.id]){
  if(record.type==='Película')return getFilmPeople(record,extra);
  const linked=extra?.relations||[];
  // Entrevista: cada persona entrevistada con ficha
  if(record.type==='Entrevista')return getInterviewees(record,extra).filter(x=>x.person).map(({person})=>({person,roles:['Entrevistado(a)']}));
  const names=[record.subtitle,...(extra?.credits||[]).map(c=>c[1])].filter(Boolean);
  return getAllRecords().filter(r=>r.type==='Persona'&&r.id!==record.id).map(person=>{
    const pn=norm(person.title);
    const roles=(extra?.credits||[]).filter(([,who])=>who&&isNamed(pn,who)).map(([role])=>role);
    if(!roles.length&&names.some(n=>isNamed(pn,n)))roles.push('Autoría');
    if(!roles.length&&linked.includes(person.id))roles.push('Mencionada');
    return {person,roles:[...new Set(roles)]};
  }).filter(e=>e.roles.length);
}
export function countByLocation(name){
  return getAllRecords().filter(r=>getLocations(r.id).includes(name)).length;
}

/* ---------- Direcciones legibles: /ficha/canto-a-la-tierra ----------
   Se calculan a partir del título. Si dos fichas se llaman igual se agrega el año y, si
   aun así coinciden, el número. Los enlaces antiguos (/ficha/12) siguen funcionando. */
const slugify=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'ficha';
let slugs=null;
// El almacén avisa cuando cambian las fichas (ver store.js) y la tabla se vuelve a calcular
export const invalidateSlugs=()=>{slugs=null};
function slugTable(){
  if(slugs)return slugs;
  const groups=new Map();
  for(const r of records){const base=slugify(r.title);groups.set(base,[...(groups.get(base)||[]),r])}
  const byId=new Map(), bySlug=new Map();
  for(const [base,list] of groups){
    const years=list.map(r=>(/\d{4}/.exec(r.year)||[''])[0]);
    list.forEach((r,i)=>{
      const year=years[i], yearUnique=year&&years.filter(y=>y===year).length===1;
      const slug=list.length===1?base:yearUnique?`${base}-${year}`:`${base}-${r.id}`;
      byId.set(r.id,slug);bySlug.set(slug,r);
    });
  }
  slugs={byId,bySlug};
  return slugs;
}
export const recordSlug=r=>slugTable().byId.get(r.id)||String(r.id);
export const recordPath=r=>`/ficha/${recordSlug(r)}`;
// Busca por dirección legible o por número (enlaces antiguos)
export function findRecordByParam(param){
  const p=String(param||'');
  if(/^\d+$/.test(p))return records.find(r=>r.id===Number(p))||null;
  return slugTable().bySlug.get(p.toLowerCase())||null;
}

// «Recién catalogado» automático: las últimas fichas creadas (el número más alto es la más nueva)
export const newestRecords=(n=4)=>[...getAllRecords()].sort((a,b)=>b.id-a.id).slice(0,n);

// Puntos exactos de las fichas (por ahora, las películas georreferenciadas) para el mapa del sitio
export const pointsOf=extra=>(extra?.points||[]).filter(pt=>Number.isFinite(pt?.lat)&&Number.isFinite(pt?.lon));
export function getMapPoints(){
  return getAllRecords().flatMap(r=>pointsOf(recordExtras[r.id]).map((pt,i)=>({...pt,key:`${r.id}-${i}`,record:r})));
}

// Primera frase de la descripción, sin pasar de ~140 caracteres
function lead(text=''){
  const first=String(text).split(/(?<=[.!?])\s/)[0]||'';
  return first.length<=140?first:`${first.slice(0,137).replace(/\s+\S*$/,'')}…`;
}

// Diapositiva armada con los datos de una ficha; sus textos se pueden ajustar después
export const slideFromRecord=r=>({
  eyebrow:[r.type,r.year].filter(Boolean).join(' · ').toUpperCase(),
  title:r.title,em:r.subtitle||'',desc:lead(r.description),
  image:r.image,alt:r.title,link:`/ficha/${r.id}`,recordId:r.id
});

/* Carrusel automático del inicio: fichas publicadas con imagen, al azar (distinto en cada visita),
   las más recientes o las más antiguas según su año. Las que no tienen año van al final. */
const CAROUSEL_SEED=Math.random();
const yearOf=r=>Number((/\d{4}/.exec(r.year||'')||[])[0])||null;
export function autoSlides(order,count=6){
  const pool=getAllRecords().filter(r=>r.image);
  let list;
  if(order==='azar'){const key=r=>Math.abs(Math.sin((r.id+1)*12.9898+CAROUSEL_SEED*78.233)*43758.5453)%1;list=[...pool].sort((a,b)=>key(a)-key(b))}
  else{const dir=order==='antiguas'?1:-1;list=[...pool].sort((a,b)=>{const x=yearOf(a),y=yearOf(b);if(x===y)return dir*(a.id-b.id);if(!x)return 1;if(!y)return -1;return dir*(x-y)})}
  return list.slice(0,count).map(r=>({...slideFromRecord(r),link:recordPath(r)}));
}
