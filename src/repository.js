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
// Filmografía: películas donde la persona aparece en dirección o créditos
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
// Roles de una persona en una película, según su dirección y sus créditos
function filmRoles(name,film,credits=recordExtras[film.id]?.credits){
  const roles=new Set();
  if(film.subtitle&&name.startsWith(norm(film.subtitle)))roles.add('Dirección');
  for(const [role,who] of credits||[])if(who&&name.startsWith(norm(who)))roles.add(role);
  return roles;
}
// `extra` permite calcular con un borrador sin guardar (vista previa del gestor)
export function getFilmography(person,extra=recordExtras[person.id]){
  const name=norm(person.title), linked=extra?.relations||[];
  return getAllRecords().filter(r=>r.type==='Película').map(film=>{
    const roles=filmRoles(name,film);
    if(!roles.size&&linked.includes(film.id))roles.add('Vinculación');
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
  const names=[record.subtitle,...(extra?.credits||[]).map(c=>c[1])].map(norm).filter(Boolean);
  return getAllRecords().filter(r=>r.type==='Persona'&&r.id!==record.id).map(person=>{
    const pn=norm(person.title);
    const roles=(extra?.credits||[]).filter(([,who])=>who&&pn.startsWith(norm(who))).map(([role])=>role);
    if(!roles.length&&names.some(n=>pn.startsWith(n)))roles.push('Autoría');
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
