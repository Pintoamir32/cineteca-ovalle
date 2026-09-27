import React, { useRef, useState } from 'react';
import { homeContent } from '../data';
import { getPath, rich } from '../site-text';
import { setData } from '../store';
import { Editable } from './fields';

// Nombre que ve quien edita: deja claro que el texto es común y dónde más cambia
const LABELS={
  fichaLeadTitle:'Común a todas las fichas · título de la descripción',
  fichaArchiveNote:'Común a todas las fichas · nota del archivo',
  collectionsKicker:'Página de colecciones · antetítulo',collectionsTitle:'Página de colecciones · título',collectionsIntro:'Página de colecciones · introducción',
  timelineKicker:'Línea de tiempo · antetítulo',timelineTitle:'Línea de tiempo · título',timelineIntro:'Línea de tiempo · introducción'
};
const labelOf=path=>LABELS[path]||(path.startsWith('footer')?'Pie de página · común a todo el sitio':'Texto común del sitio');
const MULTILINE=/(Intro|Note|footerTitle)$/;
// Copia el objeto solo a lo largo de la ruta modificada («footerLinks.0»)
function setPath(obj,path,value){
  const [k,...rest]=path.split('.');
  const copy=Array.isArray(obj)?[...obj]:{...obj};
  copy[k]=rest.length?setPath(obj[k],rest.join('.'),value):value;
  return copy;
}

/* Textos comunes del sitio (los de la portada y el pie, más los de fichas, colecciones y línea de tiempo)
   editables dentro de otros editores. Se guardan con el mismo «Guardar», y solo los que cambiaron,
   para no pisar lo que otra pantalla haya guardado. */
export function useSharedTexts(onChange){
  const [texts,setTexts]=useState(()=>structuredClone(homeContent));
  const changed=useRef(new Set());
  const context={
    content:texts,
    text:(path,{as='span',vars,em}={})=><Editable key={path} as={as} value={getPath(texts,path)} multiline={MULTILINE.test(path)} wrap
      onChange={v=>{setTexts(t=>setPath(t,path,v));changed.current.add(path.split('.')[0]);onChange()}}
      render={v=>rich(v,{vars,em})} placeholder="Escribe aquí…" label={labelOf(path)}/>
  };
  return {
    context,
    save:()=>{
      if(!changed.current.size)return null;
      const patch=Object.fromEntries([...changed.current].map(k=>[k,texts[k]]));
      changed.current.clear();
      return setData({homeContent:{...homeContent,...patch}});
    },
    reset:()=>{changed.current.clear();setTexts(structuredClone(homeContent))}
  };
}
