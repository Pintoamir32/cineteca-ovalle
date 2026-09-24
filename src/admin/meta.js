import { recordExtras, theme } from '../data';
import { getLocations } from '../repository';

// Cómo se llama cada campo según el tipo de registro, y con qué se rellena una ficha nueva
export const TYPE_META={
  Película:{slug:'peliculas',label:'Películas',one:'película',newLabel:'Nueva película',subtitle:'Dirección',year:'Año',format:['Género','Duración','Soporte'],formatHint:['Documental','18 min','16 mm'],media:'video',credits:['Fotografía','Montaje','Producción'],colorIndex:1},
  Persona:{slug:'personas',label:'Personas',one:'persona',newLabel:'Nueva persona',subtitle:'Roles',year:'Años de vida',format:['Obras vinculadas'],formatHint:['4 obras vinculadas'],media:'image',credits:['Rol principal','Archivo','Actividad'],colorIndex:2},
  Prensa:{slug:'prensa',label:'Prensa',one:'documento de prensa',newLabel:'Nuevo documento',subtitle:'Medio',year:'Año',format:['Tipo','Extensión'],formatHint:['Recorte','2 páginas'],media:'document',credits:['Fecha','Sección','Fondo'],colorIndex:3},
  Entrevista:{slug:'entrevistas',label:'Entrevistas',one:'entrevista',newLabel:'Nueva entrevista',subtitle:'Persona entrevistada',year:'Año',format:['Formato','Duración'],formatHint:['Audio','30 min'],media:'audio',credits:['Entrevista','Sonido','Duración'],colorIndex:0},
  Artículo:{slug:'articulos',label:'Artículos',one:'artículo',newLabel:'Nuevo artículo',subtitle:'Autoría',year:'Año',format:['Tipo','Lectura'],formatHint:['Ensayo','12 min lectura'],media:'text',credits:['Edición','Extensión','Licencia'],colorIndex:4}
};
export const TYPES=Object.keys(TYPE_META);
export const typeColor=type=>theme.palette[TYPE_META[type]?.colorIndex??0];
export const typeBySlug=slug=>TYPES.find(t=>TYPE_META[t].slug===slug);

export const extraOf=id=>{
  const e=recordExtras[id]||{};
  return {credits:[],relations:[],gallery:[],mediaType:'image',media:'',...e,locations:getLocations(id)};
};

// Lo que le falta a una ficha para estar completa
export function missingFields(record,extra=extraOf(record.id)){
  const out=[];
  if(!record.image)out.push('Imagen');
  if(!record.title?.trim())out.push('Título');
  if(!record.subtitle?.trim())out.push(TYPE_META[record.type]?.subtitle||'Autoría');
  if(!record.year?.trim())out.push('Año');
  if((record.description||'').trim().length<40)out.push('Descripción');
  if(!record.collection?.trim())out.push('Colección');
  if(['video','audio'].includes(extra.mediaType)&&!extra.media)out.push('Archivo digital');
  return out;
}

export const code=id=>`CDO—${String(id).padStart(4,'0')}`;
