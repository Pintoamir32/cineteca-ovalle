import { records, recordExtras } from './data';

const KEY='cdo_custom_records';
export function getAllRecords(){
  try{return [...records,...JSON.parse(localStorage.getItem(KEY)||'[]')]}catch{return records}
}
export function countByType(type){
  return getAllRecords().filter(r=>r.type===type).length;
}
export function countByCollection(title){
  return getAllRecords().filter(r=>r.collection===title).length;
}
export function countByLocation(name){
  return getAllRecords().filter(r=>(recordExtras[r.id]?.location||'Ovalle')===name).length;
}
export function addRecord(input){
  const current=getAllRecords().filter(r=>r.id>1000);
  const typeSlug={Película:'peliculas',Persona:'personas',Prensa:'prensa',Entrevista:'entrevistas',Artículo:'articulos'};
  const record={id:Date.now(),color:'#d9ff43',image:'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1000&q=85',format:'Registro digital',collection:'Nuevos ingresos',...input,slug:typeSlug[input.type]||'archivo'};
  localStorage.setItem(KEY,JSON.stringify([...current,record]));
  return record;
}
