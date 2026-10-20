import { createContext, useContext } from 'react';
import { richOr } from './rich-text';

/* Las páginas del sitio se usan también como vista previa en el gestor. Dentro del gestor, este
   contexto vuelve editables sus textos y agrega los botones para cambiar imágenes y archivos.
   Fuera del gestor vale null y la página se muestra tal cual.
   - text(clave, opciones): campo editable con clic
   - slot(nombre): controles propios del gestor en ese punto de la página */
export const EditContext=createContext(null);

// Con extra (fichas), fuera del gestor cada texto se muestra con su formato por letra (extra.rich, ver rich-text)
export function useEdit(extra){
  const edit=useContext(EditContext);
  return {
    edit,
    f:(key,value,opts)=>edit?edit.text(key,opts):richOr(extra?.rich?.[key],value,{align:extra?.textAlign?.[key]}),
    slot:name=>edit?.slot?.(name)??null
  };
}

/* Formato de cada texto o grupo de textos de una ficha: los textos de una misma lista (todos los títulos de la
   filmografía, todos los cargos…) comparten clave, así que su formato cambia para todos juntos.
   - extra.fontScale: {clave: escala del tamaño}
   - extra.fontStyle: {clave: 'b' | 'i' | 'u' combinados, ej. 'bi'}
   - extra.fontAlign: {clave: 'left' | 'center' | 'right' | 'justify'}
   z(clave, nombre) va en cada texto: le aplica su formato y lo marca para el gestor, donde un clic sobre un texto que
   no se escribe ahí mismo (títulos de listas, etiquetas, botones…) abre la barra de formato de su grupo (root va en
   el contenedor de la ficha). */
// Tamaño original (en px, sin la escala) del primer texto visible dentro del elemento: con él el gestor
// muestra la medida en puntos, como Word. La escala (zoom) no cambia el tamaño calculado.
export function baseSize(el){
  const walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.textContent.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
  const node=walker.nextNode(), view=el.ownerDocument.defaultView;
  return parseFloat(view.getComputedStyle(node?.parentElement||el).fontSize)||16;
}

// Negrita, cursiva y subrayado van como atributos data-fs-* para que la hoja de estilos los aplique también a los textos de adentro
export const FONT_STYLES=[['b','Negrita'],['i','Cursiva'],['u','Subrayado']];
// Lo que se escribe ahí mismo (o los controles del gestor) no abre la barra del grupo
const OWN_CLICK='.cms-editable,.cms-slot-btn,.cms-body-add,.cms-body-tools,.cms-body-imgbox,.cms-body-remove,input,textarea,select,[contenteditable]';
export function useFz(extra){
  const fz=useContext(EditContext)?.fz;
  const scales=extra?.fontScale||{}, styles=extra?.fontStyle||{}, aligns=extra?.fontAlign||{};
  const z=(key,label,style)=>{
    const s=scales[key], fs=styles[key]||'', al=aligns[key];
    const marks=Object.fromEntries(FONT_STYLES.filter(([k])=>fs.includes(k)).map(([k])=>[`data-fs-${k}`,'']));
    const own=s&&s!==1||al?{...style,...(s&&s!==1&&{zoom:s}),...(al&&{textAlign:al})}:style;
    return {'data-fz':key,'data-fz-label':label,...marks,...(fz?.selected===key?{'data-fz-on':''}:{}),style:own};
  };
  const root=fz?{'data-fz-mode':'',onClickCapture:e=>{
    if(e.target.closest(OWN_CLICK))return;
    const el=e.target.closest('[data-fz]');if(!el)return;
    e.preventDefault();e.stopPropagation();
    fz.pick(el.dataset.fz,el.dataset.fzLabel,baseSize(el),el);
  }}:{};
  return {z,root};
}
