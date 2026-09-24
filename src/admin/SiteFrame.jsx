import React, { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Footer, Topbar } from '../components';
import { Home } from '../home';
import { useStoreVersion } from '../store';

/* Vista previa del sitio dentro de un iframe de 1280 px: así el diseño responde a ese ancho
   (y no al de la ventana del gestor). El contenido se monta con un portal, de modo que sigue
   siendo parte de esta app y los textos se pueden editar con clic. */
export function SiteFrame({width=1280,real=false,vars,apiRef,className='',children=<Home/>}){
  const version=useStoreVersion();
  const wrapRef=useRef(null), iframeRef=useRef(null);
  const [doc,setDoc]=useState(null), [avail,setAvail]=useState(800), [height,setHeight]=useState(900);
  const scale=real?1:Math.min(1,avail/width);

  useLayoutEffect(()=>{
    const ro=new ResizeObserver(([e])=>setAvail(e.contentRect.width));
    ro.observe(wrapRef.current);return()=>ro.disconnect();
  },[]);

  // Documento del iframe: copia los estilos del gestor y los mantiene al día
  useEffect(()=>{
    const d=iframeRef.current.contentDocument;
    d.open();d.write('<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body class="cms-preview-doc"></body></html>');d.close();
    const clones=new Map();
    const sync=()=>{
      const nodes=[...document.head.querySelectorAll('style,link[rel="stylesheet"]')];
      for(const [src,clone] of clones)if(!nodes.includes(src)){clone.remove();clones.delete(src)}
      for(const n of nodes){
        const c=clones.get(n);
        if(!c){const copy=n.cloneNode(true);clones.set(n,copy);d.head.appendChild(copy)}
        else if(n.tagName==='STYLE'&&c.textContent!==n.textContent)c.textContent=n.textContent;
      }
    };
    sync();
    const mo=new MutationObserver(sync);mo.observe(document.head,{childList:true,subtree:true,characterData:true});
    // Los enlaces no navegan dentro de la vista previa
    const onClick=e=>{if(e.target.closest?.('a'))e.preventDefault()};
    // Ctrl+S dentro de la vista previa guarda, igual que fuera
    const onKey=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true}))}};
    d.addEventListener('click',onClick,true);d.addEventListener('submit',e=>e.preventDefault(),true);d.addEventListener('keydown',onKey);
    setDoc(d);
    return()=>{mo.disconnect();d.removeEventListener('click',onClick,true);d.removeEventListener('keydown',onKey)};
  },[]);

  // El alto del iframe sigue al del contenido: al montar, al cambiar el contenido y al cargar imágenes
  const siteRef=useRef(null);
  useEffect(()=>{
    const el=siteRef.current;if(!doc||!el)return;
    const measure=()=>setHeight(Math.max(Math.ceil(el.getBoundingClientRect().height),200));
    measure();
    const ro=new doc.defaultView.ResizeObserver(measure);ro.observe(el);
    const mo=new doc.defaultView.MutationObserver(measure);mo.observe(el,{childList:true,subtree:true,characterData:true});
    doc.addEventListener('load',measure,true);
    return()=>{ro.disconnect();mo.disconnect();doc.removeEventListener('load',measure,true)};
  },[doc]);

  // Colores: los del sitio, o los que se están probando
  useEffect(()=>{
    if(!doc)return;
    doc.documentElement.style.cssText=document.documentElement.style.cssText;
    for(const [k,v] of Object.entries(vars||{}))doc.documentElement.style.setProperty(k,v);
  },[doc,vars,version]);

  useImperativeHandle(apiRef,()=>({
    // Desplaza la página del gestor hasta un elemento de la vista previa
    reveal(selector){
      const el=doc?.querySelector(selector);if(!el)return;
      const bar=document.querySelector('.cms-editor-bar')?.offsetHeight||0;
      const top=iframeRef.current.getBoundingClientRect().top+window.scrollY+el.getBoundingClientRect().top*scale;
      window.scrollTo({top:top-bar-16,behavior:'smooth'});
      el.classList.add('is-located');setTimeout(()=>el.classList.remove('is-located'),1400);
    }
  }),[doc,scale]);

  return <div className={`cms-site-frame ${real?'is-real':''} ${className}`} ref={wrapRef}>
    <div className="cms-site-frame-box" style={{width:width*scale,height:height*scale}}>
      <iframe ref={iframeRef} title="Vista previa del sitio" scrolling="no" style={{width,height,transform:`scale(${scale})`}}/>
    </div>
    {doc&&createPortal(<div className="site" ref={siteRef}><Topbar previewPath="/"/>{children}<Footer/></div>,doc.body)}
  </div>;
}
