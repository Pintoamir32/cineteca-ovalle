import { collections } from './data';
import { getAllRecords } from './repository';

const staticPages = [
  { title:'Inicio', group:'Página', path:'/' },
  { title:'Archivo abierto', group:'Página', path:'/archivo' },
  { title:'Películas', group:'Página', path:'/peliculas' },
  { title:'Personas', group:'Página', path:'/personas' },
  { title:'Prensa', group:'Página', path:'/prensa' },
  { title:'Entrevistas', group:'Página', path:'/entrevistas' },
  { title:'Artículos', group:'Página', path:'/articulos' },
  { title:'Colecciones', group:'Página', path:'/colecciones' },
  { title:'Línea de tiempo', group:'Página', path:'/linea-de-tiempo' },
  { title:'Mapa territorial', group:'Página', path:'/mapa' },
  { title:'La Cineteca', group:'Página', path:'/nosotros' },
  { title:'Equipo', group:'Página', path:'/admin' }
];

export function buildSearchIndex(){
  const pages = staticPages.map(p=>({ ...p, key:`page-${p.path}` }));
  const recordItems = getAllRecords().map(r=>({ title:r.title, subtitle:`${r.type} · ${r.year}`, group:r.type, path:`/ficha/${r.id}`, key:`record-${r.id}` }));
  const collectionItems = collections.map(c=>({ title:c.title, subtitle:'Colección', group:'Colección', path:`/archivo?collection=${encodeURIComponent(c.title)}`, key:`collection-${c.slug}` }));
  return [...pages, ...recordItems, ...collectionItems];
}

export function matchIndex(term, index, limit=7){
  const q = term.trim().toLowerCase();
  if(!q) return [];
  return index.filter(item=>item.title.toLowerCase().includes(q) || item.group.toLowerCase().includes(q) || (item.subtitle||'').toLowerCase().includes(q)).slice(0, limit);
}
