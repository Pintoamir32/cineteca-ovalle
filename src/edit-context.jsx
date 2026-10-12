import { createContext, useContext } from 'react';

/* Las páginas del sitio se usan también como vista previa en el gestor. Dentro del gestor, este
   contexto vuelve editables sus textos y agrega los botones para cambiar imágenes y archivos.
   Fuera del gestor vale null y la página se muestra tal cual.
   - text(clave, opciones): campo editable con clic
   - slot(nombre): controles propios del gestor en ese punto de la página */
export const EditContext=createContext(null);

export function useEdit(){
  const edit=useContext(EditContext);
  return {
    edit,
    f:(key,value,opts)=>edit?edit.text(key,opts):value,
    slot:name=>edit?.slot?.(name)??null
  };
}

/* Tamaño de letra de cada texto de una ficha (extra.fontScale: {clave: escala}).
   z(clave, nombre) va en cada texto: le aplica su tamaño y lo marca para el modo «Tamaño de letra» del gestor,
   donde un clic sobre el texto lo elige (root va en el contenedor de la ficha). */
export function useFz(extra){
  const fz=useContext(EditContext)?.fz;
  const scales=extra?.fontScale||{};
  const z=(key,label,style)=>{
    const s=scales[key];
    return {'data-fz':key,'data-fz-label':label,...(fz?.active&&fz.selected===key?{'data-fz-on':''}:{}),style:s&&s!==1?{...style,zoom:s}:style};
  };
  const root=fz?.active?{'data-fz-mode':'',onClickCapture:e=>{
    e.preventDefault();e.stopPropagation();
    const el=e.target.closest('[data-fz]');if(el)fz.pick(el.dataset.fz,el.dataset.fzLabel);
  }}:{};
  return {z,root};
}
