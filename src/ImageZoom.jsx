import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* Clic en cualquier imagen del sitio → se ve completa, sin recortar.
   No actúa sobre imágenes que son enlaces o botones (tarjetas, galerías con su propio visor),
   ni sobre el logo o íconos pequeños. Si hay una capa encima de la foto (sombreado de las
   portadas), se busca la imagen que está debajo del clic. */
const SKIP='a,button,input,textarea,select,label,video,audio,iframe,.topbar,footer,[data-no-zoom]';

// Las fotos de Unsplash se piden en tamaño grande y sin recorte para verlas completas
const fullSize=src=>typeof src==='string'&&src.includes('images.unsplash.com')
  ?src.replace(/([?&])w=\d+/,'$1w=2400').replace(/([?&])h=\d+&?/,'$1').replace(/([?&])fit=crop&?/,'$1')
  :src;

function imageAt(e){
  const t=e.target;
  if(!(t instanceof Element)||t.closest(SKIP))return null;
  // Sobre un texto no se abre nada (para poder seleccionarlo)
  if(t.tagName!=='IMG'&&t.textContent.trim())return null;
  const img=t.tagName==='IMG'?t:document.elementsFromPoint(e.clientX,e.clientY).find(el=>el.tagName==='IMG');
  if(!img||img.closest(SKIP))return null;
  const r=img.getBoundingClientRect();
  if(r.width<120||r.height<80)return null;
  const src=img.currentSrc||img.src;
  if(!src||src.startsWith('data:image/gif'))return null;
  return {src:fullSize(src),preview:src,alt:img.alt||''};
}

export function ImageZoom(){
  const [shown,setShown]=useState(null);
  useEffect(()=>{
    const onClick=e=>{if(e.defaultPrevented||e.button!==0)return;const hit=imageAt(e);if(hit){e.preventDefault();setShown(hit)}};
    document.addEventListener('click',onClick);
    return()=>document.removeEventListener('click',onClick);
  },[]);
  useEffect(()=>{
    if(!shown)return;
    const onKey=e=>{if(e.key==='Escape')setShown(null)};
    document.addEventListener('keydown',onKey);document.body.classList.add('zoom-open');
    return()=>{document.removeEventListener('keydown',onKey);document.body.classList.remove('zoom-open')};
  },[shown]);
  if(!shown)return null;
  return createPortal(<div className="image-zoom" role="dialog" aria-modal="true" aria-label={shown.alt||'Imagen ampliada'} onClick={()=>setShown(null)}>
    {/* Mientras carga la versión grande se muestra la que ya estaba en pantalla */}
    <img src={shown.src} alt={shown.alt} onError={e=>{if(e.currentTarget.src!==shown.preview)e.currentTarget.src=shown.preview}} onClick={e=>e.stopPropagation()}
      style={{backgroundImage:`url("${shown.preview}")`}}/>
    {shown.alt&&<p onClick={e=>e.stopPropagation()}>{shown.alt}</p>}
    <button type="button" className="image-zoom-close" aria-label="Cerrar" onClick={()=>setShown(null)} autoFocus><X/></button>
  </div>,document.body);
}
