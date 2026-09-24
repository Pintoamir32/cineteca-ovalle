import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FlipHorizontal2, RotateCcw, RotateCw, Undo2, X } from 'lucide-react';
import { Modal } from './fields';

const MAX=1800;
export const ASPECTS=[['Libre',null],['Original','orig'],['1:1',1],['4:3',4/3],['16:9',16/9],['3:4',3/4],['2:3',2/3]];
const ADJUST=[['b','Brillo',0,200],['c','Contraste',0,200],['s','Saturación',0,200],['g','Blanco y negro',0,100]];
const fresh=aspect=>({rot:0,flip:false,crop:{x:0,y:0,w:1,h:1},aspect,b:100,c:100,s:100,g:0,pending:aspect!=null});
const untouched=st=>!st.rot&&!st.flip&&st.crop.x===0&&st.crop.y===0&&st.crop.w===1&&st.crop.h===1&&st.b===100&&st.c===100&&st.s===100&&st.g===0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const filterOf=st=>`brightness(${st.b}%) contrast(${st.c}%) saturate(${st.s}%) grayscale(${st.g}%)`;
const dims=(img,rot)=>rot%180?[img.naturalHeight,img.naturalWidth]:[img.naturalWidth,img.naturalHeight];

// Primero con CORS (para poder exportar); si el sitio de origen no lo permite, solo se puede mostrar
function loadImage(src){
  const attempt=cors=>new Promise((resolve,reject)=>{
    const img=new Image();
    if(cors)img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);img.onerror=reject;img.src=src;
  });
  if(/^(data|blob):/.test(src))return attempt(false).catch(()=>{throw new Error('No se pudo leer la imagen.')});
  return attempt(true).catch(()=>attempt(false).then(img=>{img.tainted=true;return img})).catch(()=>{throw new Error('No se pudo cargar la imagen desde ese enlace.')});
}

// Proporción de recorte expresada en coordenadas normalizadas (ancho/alto dentro de 0..1)
function normRatio(aspect,img,rot){
  if(aspect==null)return null;
  const [rw,rh]=dims(img,rot), a=aspect==='orig'?rw/rh:aspect;
  return a*rh/rw;
}
function centeredCrop(ratio){
  if(!ratio)return {x:0,y:0,w:1,h:1};
  let w=1,h=1/ratio;
  if(h>1){h=1;w=ratio}
  return {x:(1-w)/2,y:(1-h)/2,w,h};
}

function adjustCrop(c,mode,dx,dy,ratio){
  const MIN=.05;
  if(mode==='move')return {...c,x:clamp(c.x+dx,0,1-c.w),y:clamp(c.y+dy,0,1-c.h)};
  let l=c.x,t=c.y,r=c.x+c.w,b=c.y+c.h;
  if(mode.includes('w'))l=clamp(l+dx,0,r-MIN);
  if(mode.includes('e'))r=clamp(r+dx,l+MIN,1);
  if(mode.includes('n'))t=clamp(t+dy,0,b-MIN);
  if(mode.includes('s'))b=clamp(b+dy,t+MIN,1);
  if(ratio){
    let w=r-l,h=w/ratio;
    const fit=()=>{if(mode.includes('w'))l=r-w;else r=l+w};
    if(mode.includes('n')){t=b-h;if(t<0){t=0;h=b;w=h*ratio;fit()}}
    else{b=t+h;if(b>1){b=1;h=b-t;w=h*ratio;fit()}}
  }
  return {x:l,y:t,w:r-l,h:b-t};
}

export function renderImage(img,st,type='image/jpeg'){
  const [rw,rh]=dims(img,st.rot), cw=st.crop.w*rw, ch=st.crop.h*rh, k=Math.min(1,MAX/Math.max(cw,ch));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(cw*k));canvas.height=Math.max(1,Math.round(ch*k));
  const ctx=canvas.getContext('2d');
  ctx.filter=filterOf(st);
  ctx.translate(-st.crop.x*rw*k,-st.crop.y*rh*k);
  ctx.translate(rw*k/2,rh*k/2);
  ctx.scale(st.flip?-1:1,1);
  ctx.rotate(st.rot*Math.PI/180);
  const w=img.naturalWidth*k,h=img.naturalHeight*k;
  ctx.drawImage(img,-w/2,-h/2,w,h);
  return canvas.toDataURL(type,.85);
}

/* sources: [{src,name,type}] · onDone recibe las imágenes listas, en el mismo orden */
export function ImageEditor({sources,onDone,onClose,aspect=null}){
  const [items,setItems]=useState(()=>sources.map(s=>({...s,st:fresh(aspect)})));
  const [i,setI]=useState(0), [img,setImg]=useState(null), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const cache=useRef(new Map()), stageRef=useRef(null), canvasRef=useRef(null);
  const [box,setBox]=useState({w:640,h:420});
  const item=items[i], st=item.st;
  const get=src=>{if(!cache.current.has(src))cache.current.set(src,loadImage(src));return cache.current.get(src)};
  const update=patch=>setItems(list=>list.map((it,j)=>j===i?{...it,st:{...it.st,...patch}}:it));

  useEffect(()=>{
    let alive=true;setImg(null);setError('');
    get(item.src).then(im=>{
      if(!alive)return;
      setImg(im);
      if(item.st.pending)update({crop:centeredCrop(normRatio(item.st.aspect,im,0)),pending:false});
    },err=>alive&&setError(err.message));
    return()=>{alive=false};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[item.src]);

  useLayoutEffect(()=>{
    const el=stageRef.current;if(!el)return;
    const ro=new ResizeObserver(([e])=>setBox({w:e.contentRect.width,h:Math.min(460,window.innerHeight*.52)}));
    ro.observe(el);return()=>ro.disconnect();
  },[]);

  const [rw,rh]=img?dims(img,st.rot):[1,1];
  const k=Math.min(box.w/rw,box.h/rh,1), dw=Math.round(rw*k), dh=Math.round(rh*k);
  const ratio=img?normRatio(st.aspect,img,st.rot):null;

  // Vista previa: imagen completa girada; los ajustes se ven con el filtro CSS
  useEffect(()=>{
    const c=canvasRef.current;if(!c||!img)return;
    const dpr=window.devicePixelRatio||1;
    c.width=dw*dpr;c.height=dh*dpr;
    const ctx=c.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.translate(dw/2,dh/2);ctx.scale(st.flip?-1:1,1);ctx.rotate(st.rot*Math.PI/180);
    const w=img.naturalWidth*k,h=img.naturalHeight*k;
    ctx.drawImage(img,-w/2,-h/2,w,h);
  },[img,st.rot,st.flip,dw,dh,k]);

  const drag=mode=>e=>{
    e.preventDefault();e.stopPropagation();
    const start={x:e.clientX,y:e.clientY,crop:st.crop};
    const move=ev=>update({crop:adjustCrop(start.crop,mode,(ev.clientX-start.x)/dw,(ev.clientY-start.y)/dh,ratio)});
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  };
  const rotate=d=>{const rot=(st.rot+d+360)%360;update({rot,crop:centeredCrop(normRatio(st.aspect,img,rot))})};
  const setAspect=a=>update({aspect:a,crop:centeredCrop(normRatio(a,img,st.rot))});
  const reset=()=>update({...fresh(null),pending:false});
  const remove=j=>{
    if(items.length===1)return onClose();
    setItems(list=>list.filter((_,x)=>x!==j));setI(x=>Math.max(0,x>=j&&x>0?x-1:x));
  };

  const finish=async()=>{
    setBusy(true);setError('');
    try{
      const out=[];
      for(const it of items){
        const im=await get(it.src);
        const keep=im.tainted||(untouched(it.st)&&!it.src.startsWith('blob:'));
        out.push(keep?it.src:renderImage(im,it.st,it.type||'image/jpeg'));
      }
      onDone(out);
    }catch{setError('No se pudo procesar una de las imágenes.');setBusy(false)}
  };

  const outW=Math.round(Math.min(1,MAX/Math.max(st.crop.w*rw,st.crop.h*rh))*st.crop.w*rw), outH=Math.round(Math.min(1,MAX/Math.max(st.crop.w*rw,st.crop.h*rh))*st.crop.h*rh);
  const handles=ratio?['nw','ne','sw','se']:['nw','ne','sw','se','n','s','e','w'];
  const many=items.length>1;
  return <Modal onClose={onClose} title={many?`Editar imágenes · ${i+1} de ${items.length}`:'Editar imagen'} className="ie">
    <div className="ie-body">
      <div className="ie-stage" ref={stageRef}>
        {img?<div className="ie-canvas" style={{width:dw,height:dh}}>
          <canvas ref={canvasRef} style={{width:dw,height:dh,filter:filterOf(st)}}/>
          {!img.tainted&&<div className="ie-crop" style={{left:st.crop.x*dw,top:st.crop.y*dh,width:st.crop.w*dw,height:st.crop.h*dh}} onPointerDown={drag('move')}>
            <i className="ie-grid"/>
            {handles.map(h=><span key={h} className={`ie-handle is-${h}`} onPointerDown={drag(h)}/>)}
          </div>}
        </div>:<p className={error?'cms-error':'cms-help'}>{error||'Cargando imagen…'}</p>}
      </div>
      <aside className="ie-controls">
        {img?.tainted&&<p className="ie-note">El sitio de origen no permite editar esta imagen. Se usará tal cual; para editarla, descárgala y súbela desde tu equipo.</p>}
        <fieldset disabled={!img||img.tainted}>
          <div className="ie-group"><span>Recorte</span>
            <div className="ie-chips">{ASPECTS.map(([label,a])=><button key={label} type="button" className={st.aspect===a?'active':''} onClick={()=>setAspect(a)}>{label}</button>)}</div>
          </div>
          <div className="ie-group"><span>Orientación</span>
            <div className="ie-row">
              <button type="button" className="cms-icon-btn" onClick={()=>rotate(-90)} aria-label="Girar a la izquierda" title="Girar a la izquierda"><RotateCcw/></button>
              <button type="button" className="cms-icon-btn" onClick={()=>rotate(90)} aria-label="Girar a la derecha" title="Girar a la derecha"><RotateCw/></button>
              <button type="button" className={`cms-icon-btn ${st.flip?'is-on':''}`} onClick={()=>update({flip:!st.flip})} aria-label="Voltear" title="Voltear horizontalmente"><FlipHorizontal2/></button>
            </div>
          </div>
          <div className="ie-group"><span>Ajustes</span>
            {ADJUST.map(([key,label,min,max])=><label key={key} className="ie-slider"><small>{label}<b>{key==='g'?`${st[key]}%`:`${st[key]-100>0?'+':''}${st[key]-100}`}</b></small>
              <input type="range" min={min} max={max} value={st[key]} onChange={e=>update({[key]:Number(e.target.value)})} onDoubleClick={()=>update({[key]:key==='g'?0:100})}/>
            </label>)}
          </div>
          <button type="button" className="cms-btn is-ghost ie-reset" onClick={reset}><Undo2/> Deshacer cambios</button>
        </fieldset>
      </aside>
    </div>
    {many&&<div className="ie-strip">{items.map((it,j)=><div key={it.src} className={j===i?'active':''}>
      <button type="button" onClick={()=>setI(j)} aria-label={`Imagen ${j+1}`}><img src={it.src} alt=""/>{!untouched(it.st)&&<Check/>}</button>
      <button type="button" className="ie-strip-x" onClick={()=>remove(j)} aria-label="Quitar de la carga"><X/></button>
    </div>)}</div>}
    <div className="ie-foot">
      <span>{img&&!img.tainted?`Resultado: ${outW} × ${outH} px`:''}{item.name?` · ${item.name}`:''}</span>
      <div>
        <button type="button" className="cms-btn" onClick={onClose}>Cancelar</button>
        {many&&<button type="button" className="cms-icon-btn" disabled={i===0} onClick={()=>setI(i-1)} aria-label="Anterior"><ArrowLeft/></button>}
        {many&&<button type="button" className="cms-icon-btn" disabled={i===items.length-1} onClick={()=>setI(i+1)} aria-label="Siguiente"><ArrowRight/></button>}
        <button type="button" className="cms-btn is-primary" disabled={busy||!img} onClick={finish}><Check/> {busy?'Procesando…':many?`Añadir ${items.length} imágenes`:'Usar imagen'}</button>
      </div>
    </div>
  </Modal>;
}
