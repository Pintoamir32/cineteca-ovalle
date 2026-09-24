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
