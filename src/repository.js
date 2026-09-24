import { records, recordExtras } from './data';

// `records` se sincroniza con lo guardado desde el gestor (ver store.js)
export function getAllRecords(){
  return records;
}
export function countByType(type){
  return getAllRecords().filter(r=>r.type===type).length;
}
export function countByCollection(title){
  return getAllRecords().filter(r=>r.collection===title).length;
}
// Un registro puede tener una sola `location` o varias `locations`
export function getLocations(id){
  const extra=recordExtras[id];
  return extra?.locations||[extra?.location||'Ovalle'];
}
// Filmografía: películas donde la persona aparece en dirección o créditos
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
export function getFilmography(person){
  const name=norm(person.title), linked=recordExtras[person.id]?.relations||[];
  return getAllRecords().filter(r=>r.type==='Película').map(film=>{
    const roles=new Set();
    if(film.subtitle&&name.startsWith(norm(film.subtitle)))roles.add('Dirección');
    for(const [role,who] of recordExtras[film.id]?.credits||[])if(who&&name.startsWith(norm(who)))roles.add(role);
    if(!roles.size&&linked.includes(film.id))roles.add('Vinculación');
    return {film,roles:[...roles]};
  }).filter(e=>e.roles.length).sort((a,b)=>String(a.film.year).localeCompare(String(b.film.year)));
}
// Inverso de la filmografía: personas vinculadas a una película
export function getFilmPeople(film){
  const linked=recordExtras[film.id]?.relations||[];
  return getAllRecords().filter(r=>r.type==='Persona').map(person=>{
    const roles=(getFilmography(person).find(e=>e.film.id===film.id)?.roles||[]).map(r=>r==='Vinculación'?'Mencionada':r);
    return {person,roles:roles.length?roles:linked.includes(person.id)?['Mencionada']:[]};
  }).filter(e=>e.roles.length);
}
// Personas mencionadas en cualquier registro (prensa, entrevistas, artículos)
export function getRecordPeople(record){
  if(record.type==='Película')return getFilmPeople(record);
  const linked=recordExtras[record.id]?.relations||[];
  const names=[record.subtitle,...(recordExtras[record.id]?.credits||[]).map(c=>c[1])].map(norm).filter(Boolean);
  return getAllRecords().filter(r=>r.type==='Persona'&&r.id!==record.id).map(person=>{
    const pn=norm(person.title);
    const roles=(recordExtras[record.id]?.credits||[]).filter(([,who])=>who&&pn.startsWith(norm(who))).map(([role])=>role);
    if(!roles.length&&names.some(n=>pn.startsWith(n)))roles.push('Autoría');
    if(!roles.length&&linked.includes(person.id))roles.push('Mencionada');
    return {person,roles:[...new Set(roles)]};
  }).filter(e=>e.roles.length);
}
export function countByLocation(name){
  return getAllRecords().filter(r=>getLocations(r.id).includes(name)).length;
}
