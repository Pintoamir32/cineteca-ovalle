import React, { createContext, useContext } from 'react';
import { heroSlides, homeContent } from './data';

/* El gestor envuelve el sitio con este contexto para volver editable cada texto e imagen.
   Fuera del gestor vale null y todo se muestra tal cual. */
export const HomeEditContext=createContext(null);

export const getPath=(obj,path)=>path.split('.').reduce((o,k)=>o?.[k],obj);

// Texto enriquecido mínimo: saltos de línea, *cursiva* y variables {así}
export function rich(text,{em:Em='em',vars}={}){
  let s=String(text??'');
  for(const [k,v] of Object.entries(vars||{}))s=s.split(`{${k}}`).join(v);
  return s.split('\n').map((line,i)=><React.Fragment key={i}>{i>0&&<br/>}
    {line.split(/(\*[^*]+\*)/).map((seg,j)=>/^\*[^*]+\*$/.test(seg)?<Em key={j}>{seg.slice(1,-1)}</Em>:seg)}
  </React.Fragment>);
}

// Textos del sitio: `t(ruta)` devuelve el texto listo, o un campo editable dentro del gestor
export function useSiteText(){
  const edit=useContext(HomeEditContext);
  const content=edit?edit.content:{...homeContent,slides:heroSlides};
  const t=(path,opts={})=>edit?edit.text(path,opts):rich(getPath(content,path),opts);
  return {edit,content,t};
}

/* Portadas de las páginas (archivo, secciones, colecciones, línea de tiempo, mapa, inscripción, aviso legal).
   Se editan desde el gestor en «Portadas de páginas». Colecciones y línea de tiempo guardan sus textos
   donde ya estaban; de la portada solo es nueva su foto. */
export const HERO_PAGES=[
  ['archivo','Archivo completo','/archivo'],['peliculas','Películas','/peliculas'],['personas','Personas','/personas'],
  ['prensa','Prensa','/prensa'],['entrevistas','Entrevistas','/entrevistas'],['articulos','Artículos','/articulos'],
  ['colecciones','Colecciones','/colecciones'],['linea','Línea de tiempo','/linea-de-tiempo'],['mapa','Mapa territorial','/mapa'],
  ['inscribir','Inscribe tu obra','/inscribe-tu-obra'],['legal','Aviso legal','/aviso-legal']
];
const OLD_KEYS={colecciones:'collections',linea:'timeline'};
export const heroPaths=key=>OLD_KEYS[key]
  ?{kicker:`${OLD_KEYS[key]}Kicker`,title:`${OLD_KEYS[key]}Title`,text:`${OLD_KEYS[key]}Intro`,image:`heroes.${key}.image`}
  :{kicker:`heroes.${key}.kicker`,title:`heroes.${key}.title`,text:`heroes.${key}.text`,image:`heroes.${key}.image`};

// Textos e imagen de la portada de una página; en el gestor, editables con clic y con botón para la foto
export function useHero(key,{em}={}){
  const {edit,content,t}=useSiteText(), p=heroPaths(key);
  return {
    kicker:t(p.kicker),title:t(p.title,{em}),text:t(p.text),
    plainTitle:String(getPath(content,p.title)??'').replace(/\*/g,'').replace(/\n/g,' '),
    image:getPath(content,p.image),
    imageButton:edit?.image?edit.image(p.image,{label:'Cambiar foto de portada',className:'page-hero-edit-img'}):null
  };
}
