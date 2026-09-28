import { recordExtras } from './data';
import { getAllRecords, getFilmPeople, getFilmography, getLocations, getRecordPeople, interviewFormat } from './repository';

/* Filtros del catálogo: cada sección tiene los suyos, según los campos de sus fichas.
   Los usan las páginas de cada sección y el buscador avanzado del inicio.
   - key: nombre en la dirección (?director=…), se mantiene para no romper enlaces
   - get: valor de la ficha (texto o lista de textos)
   - label de cada opción y orden: por defecto alfabético; `option` y `order` los cambian */

const formatParts=r=>(r.format||'').split(' · ').map(s=>s.trim());
const split=s=>String(s||'').split(/\s*(?:·|,|\/| y )\s*/).map(x=>x.trim()).filter(Boolean);
export const decadeOf=r=>{const m=/\d{4}/.exec(r.year);return m?Math.floor(Number(m[0])/10)*10:null};

// Rangos de duración: minutos → categoría de metraje
export const METRAJES=[
  {label:'Cortometraje',hint:'menos de 30 min',test:m=>m<30},
  {label:'Mediometraje',hint:'30 a 59 min',test:m=>m>=30&&m<60},
  {label:'Largometraje',hint:'60 min o más',test:m=>m>=60}
];
export const metrajeOf=r=>{const m=Number((/(\d+)\s*min/.exec(formatParts(r)[1]||'')||[])[1]);return m?METRAJES.find(x=>x.test(m))?.label:undefined};

// Fichas de un tipo vinculadas a esta (películas citadas en prensa, artículos…)
const relatedTitles=(r,type)=>{const ids=recordExtras[r.id]?.relations||[];return getAllRecords().filter(x=>x.type===type&&ids.includes(x.id)).map(x=>x.title)};
export const filmPeopleNames=r=>r.type==='Película'?getFilmPeople(r).map(e=>e.person.title):[];
const peopleNames=r=>r.type==='Película'?filmPeopleNames(r):r.type==='Persona'?[]:getRecordPeople(r).map(e=>e.person.title);

// Filtros comunes
const DECADE=(label='Década')=>({key:'year',label,get:decadeOf,option:d=>`Década de ${d}`,order:(a,b)=>a-b});
const COLLECTION={key:'collection',label:'Colección',get:r=>r.collection};
const PLACE={key:'locacion',label:'Lugar',get:r=>getLocations(r.id)};

export const FILTERS={
  Película:[
    DECADE('Década'),
    {key:'genero',label:'Género',get:r=>formatParts(r)[0]},
    {key:'metraje',label:'Duración',get:metrajeOf,option:v=>`${v} · ${METRAJES.find(m=>m.label===v)?.hint}`,order:(a,b)=>METRAJES.findIndex(m=>m.label===a)-METRAJES.findIndex(m=>m.label===b)},
    {key:'soporte',label:'Soporte',get:r=>formatParts(r)[2]},
    {key:'director',label:'Dirección',get:r=>r.subtitle},
    {key:'persona',label:'Persona',get:filmPeopleNames},
    COLLECTION,PLACE
  ],
  Persona:[
    {key:'rol',label:'Rol',get:r=>split(r.subtitle)},
    {key:'pelicula',label:'Película',get:r=>getFilmography(r).map(e=>e.film.title)},
    DECADE('Década de nacimiento'),
    COLLECTION,PLACE
  ],
  Prensa:[
    {key:'medio',label:'Medio de origen',get:r=>r.subtitle},
    {key:'documento',label:'Tipo de documento',get:r=>formatParts(r)[0]},
    DECADE('Década'),
    {key:'pelicula',label:'Película',get:r=>relatedTitles(r,'Película')},
    {key:'persona',label:'Persona',get:peopleNames},
    PLACE
  ],
  Entrevista:[
    {key:'entrevistado',label:'Entrevistado(a)',get:r=>r.subtitle},
    {key:'formato',label:'Formato',get:r=>interviewFormat(recordExtras[r.id])||formatParts(r)[0]},
    DECADE('Década'),
    {key:'pelicula',label:'Película',get:r=>relatedTitles(r,'Película')},
    PLACE
  ],
  Artículo:[
    {key:'autor',label:'Autor(a)',get:r=>r.subtitle},
    {key:'texto',label:'Tipo de texto',get:r=>formatParts(r)[0]},
    DECADE('Década de publicación'),
    {key:'pelicula',label:'Película referenciada',get:r=>relatedTitles(r,'Película')},
    PLACE
  ]
};
// Todo el archivo: lo común a todos los tipos (el tipo se elige aparte)
export const ARCHIVE_FILTERS=[DECADE('Década'),COLLECTION,{key:'persona',label:'Persona',get:peopleNames},PLACE];

// Filtros que corresponden: los del tipo o, sin tipo, los comunes a todo el archivo
export const filtersFor=type=>type?FILTERS[type]||[]:ARCHIVE_FILTERS;

const asList=v=>Array.isArray(v)?v:v===undefined||v===null||v===''?[]:[v];
export const matches=(r,f,value)=>asList(f.get(r)).some(v=>String(v)===String(value));

// Opciones con su cantidad de fichas, a partir de las fichas visibles de la sección
export function optionsOf(f,records){
  const counts=new Map();
  for(const r of records)for(const v of new Set(asList(f.get(r)).map(String)))counts.set(v,(counts.get(v)||0)+1);
  const values=[...counts.keys()];
  const num=values.every(v=>/^\d+$/.test(v));
  values.sort(f.order?(a,b)=>f.order(num?Number(a):a,num?Number(b):b):(a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  return values.map(v=>({value:v,label:`${f.option?f.option(num?Number(v):v):v} (${counts.get(v)})`}));
}
// Etiqueta legible de un valor elegido (para los botones «Década: Década de 1970 ×»)
export const valueLabel=(f,v)=>f.option?f.option(/^\d+$/.test(v)?Number(v):v):v;
