import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Accessibility, BookOpen, Contrast, Link2, MousePointerClick, Pause, Play, RotateCcw, Square, Text, Type, X, Zap } from 'lucide-react';
import './accessibility.css';

/* Botón de accesibilidad del sitio público: tamaño del texto, fuente legible, espaciado,
   enlaces subrayados, sin animaciones, contraste y un lector en voz alta (del navegador).
   Las preferencias se guardan en este navegador y solo se aplican al sitio, no al gestor. */

const SIZES=[1,1.15,1.3,1.5];
const RATES=[['Lenta',.8],['Normal',1],['Rápida',1.25]];
const DEFAULTS={size:0,font:false,spacing:false,links:false,motion:false,contrast:'',readClick:false,rate:1};
const KEY='cineteca-a11y';
const load=()=>{try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return DEFAULTS}};
const store=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch{/* sin almacenamiento: solo dura esta visita */}};
const CLASSES=['a11y-zoom','a11y-font','a11y-spacing','a11y-links','a11y-motion','a11y-contrast','a11y-gray','a11y-readclick'];

function apply(s){
  const root=document.documentElement;
  root.style.setProperty('--a11y-zoom',SIZES[s.size]||1);
  const on={'a11y-zoom':s.size>0,'a11y-font':s.font,'a11y-spacing':s.spacing,'a11y-links':s.links,'a11y-motion':s.motion,
    'a11y-contrast':s.contrast==='high','a11y-gray':s.contrast==='gray','a11y-readclick':s.readClick};
  for(const c of CLASSES)root.classList.toggle(c,!!on[c]);
  // La fuente legible se descarga solo cuando alguien la activa
  if(s.font&&!document.getElementById('a11y-font')){
    const l=Object.assign(document.createElement('link'),{id:'a11y-font',rel:'stylesheet',href:'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap'});
    document.head.appendChild(l);
  }
}

/* ---------- Lector en voz alta ---------- */
const synth=typeof window!=='undefined'&&'speechSynthesis' in window?window.speechSynthesis:null;
const spanishVoice=()=>{const v=synth?.getVoices()||[];return v.find(x=>/^es[-_]CL/i.test(x.lang))||v.find(x=>/^es[-_](419|US|MX|AR)/i.test(x.lang))||v.find(x=>/^es/i.test(x.lang))||null};
// Trozos cortos: algunos navegadores cortan las frases muy largas
const chunks=text=>(text.replace(/\s+/g,' ').match(/[^.!?¿¡;:]+[.!?;:]*|[.!?;:]+/g)||[]).reduce((out,part)=>{
  const last=out[out.length-1];
  if(last&&last.length+part.length<220)out[out.length-1]=last+part;else out.push(part);
  return out;
},[]).map(s=>s.trim()).filter(Boolean);
// Texto de la página, sin menús ni botones del lector
function pageText(){
  const main=document.querySelector('.site .route-view');
  if(!main)return '';
  const copy=main.cloneNode(true);
  copy.querySelectorAll('script,style,svg,iframe,[aria-hidden="true"],.a11y-skip').forEach(n=>n.remove());
  return copy.innerText||copy.textContent||'';
}

export function AccessibilityWidget(){
  const [s,setS]=useState(load), [open,setOpen]=useState(false), [reading,setReading]=useState('');// '' | 'playing' | 'paused'
  const panelRef=useRef(null), btnRef=useRef(null), location=useLocation();
  const set=patch=>setS(prev=>{const next={...prev,...patch};store(next);return next});

  // Se aplica mientras se ve el sitio público; al entrar al gestor, todo vuelve a lo normal
  useEffect(()=>{apply(s)},[s]);
  useEffect(()=>()=>{for(const c of CLASSES)document.documentElement.classList.remove(c);synth?.cancel()},[]);

  const speak=text=>{
    if(!synth)return;
    synth.cancel();
    const parts=chunks(text);
    if(!parts.length)return;
    const voice=spanishVoice();
    setReading('playing');
    parts.forEach((p,i)=>{
      const u=new SpeechSynthesisUtterance(p);
      u.lang=voice?.lang||'es-CL';if(voice)u.voice=voice;u.rate=s.rate;
      if(i===parts.length-1)u.onend=()=>setReading('');
      u.onerror=e=>{if(e.error!=='interrupted'&&e.error!=='canceled')setReading('')};
      synth.speak(u);
    });
  };
  const stop=()=>{synth?.cancel();setReading('')};
  const togglePause=()=>{if(reading==='playing'){synth.pause();setReading('paused')}else{synth.resume();setReading('playing')}};
  // Lo seleccionado o, si no hay nada, toda la página
  const readPage=()=>{const sel=String(window.getSelection?.()||'').trim();speak(sel||pageText())};

  // Al cambiar de página se deja de leer
  useEffect(()=>{stop()},[location.pathname]);// eslint-disable-line react-hooks/exhaustive-deps
  // Algunos navegadores cargan las voces después
  useEffect(()=>{synth?.getVoices()},[]);

  // Leer al hacer clic: lee el bloque de texto donde se hizo clic (los enlaces siguen funcionando)
  useEffect(()=>{
    if(!s.readClick||!synth)return;
    const onClick=e=>{
      if(e.target.closest('.a11y-widget'))return;
      const el=e.target.closest('.site h1,.site h2,.site h3,.site h4,.site p,.site li,.site dt,.site dd,.site figcaption,.site blockquote,.site a,.site button,.site label,.site td,.site th');
      const text=(el?.innerText||el?.getAttribute('aria-label')||'').trim();
      if(text)speak(text);
    };
    document.addEventListener('click',onClick,true);
    return()=>document.removeEventListener('click',onClick,true);
  },[s.readClick,s.rate]);// eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar con Escape o al hacer clic fuera
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==='Escape'){setOpen(false);btnRef.current?.focus()}};
    const onDown=e=>{if(!panelRef.current?.contains(e.target)&&!btnRef.current?.contains(e.target))setOpen(false)};
    document.addEventListener('keydown',onKey);document.addEventListener('mousedown',onDown);
    panelRef.current?.querySelector('button')?.focus();
    return()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('mousedown',onDown)};
  },[open]);

  const changed=JSON.stringify({...s,rate:1})!==JSON.stringify({...DEFAULTS});
  const toggle=(key,Icon,label,hint)=><button type="button" className={`a11y-tile${s[key]?' is-on':''}`} aria-pressed={!!s[key]} onClick={()=>set({[key]:!s[key]})}>
    <Icon aria-hidden="true"/><span>{label}<small>{hint}</small></span></button>;
  const contrast=(value,Icon,label,hint)=><button type="button" className={`a11y-tile${s.contrast===value?' is-on':''}`} aria-pressed={s.contrast===value} onClick={()=>set({contrast:s.contrast===value?'':value})}>
    <Icon aria-hidden="true"/><span>{label}<small>{hint}</small></span></button>;

  return <div className="a11y-widget">
    {open&&<div className="a11y-panel" ref={panelRef} role="dialog" aria-label="Opciones de accesibilidad">
      <header><h2>Accesibilidad</h2><button type="button" className="a11y-close" onClick={()=>{setOpen(false);btnRef.current?.focus()}} aria-label="Cerrar"><X/></button></header>

      <div className="a11y-label">Tamaño del texto</div>
      <div className="a11y-size">
        <button type="button" onClick={()=>set({size:Math.max(0,s.size-1)})} disabled={s.size===0} aria-label="Achicar texto">A−</button>
        <output aria-live="polite">{Math.round(SIZES[s.size]*100)}%</output>
        <button type="button" onClick={()=>set({size:Math.min(SIZES.length-1,s.size+1)})} disabled={s.size===SIZES.length-1} aria-label="Agrandar texto">A+</button>
      </div>

      <div className="a11y-label">Lectura</div>
      <div className="a11y-grid">
        {toggle('font',Type,'Fuente legible','Letra más clara')}
        {toggle('spacing',Text,'Más espacio','Entre letras y líneas')}
        {toggle('links',Link2,'Subrayar enlaces','Se distinguen mejor')}
        {toggle('motion',Zap,'Sin animaciones','Todo queda quieto')}
      </div>

      <div className="a11y-label">Color</div>
      <div className="a11y-grid">
        {contrast('high',Contrast,'Alto contraste','Colores más marcados')}
        {contrast('gray',BookOpen,'Escala de grises','Sin colores')}
      </div>

      {synth&&<><div className="a11y-label">Lector en voz alta</div>
        <div className="a11y-reader">
          {!reading?<button type="button" className="a11y-play" onClick={readPage}><Play aria-hidden="true"/> Leer la página</button>
            :<><button type="button" className="a11y-play" onClick={togglePause}>{reading==='playing'?<><Pause aria-hidden="true"/> Pausar</>:<><Play aria-hidden="true"/> Continuar</>}</button>
              <button type="button" className="a11y-stop" onClick={stop} aria-label="Detener lectura"><Square aria-hidden="true"/></button></>}
        </div>
        <p className="a11y-help">Si seleccionas un texto, se lee solo eso.</p>
        <div className="a11y-grid is-single">{toggle('readClick',MousePointerClick,'Leer al hacer clic','Lee el texto que toques')}</div>
        <div className="a11y-rate" role="group" aria-label="Velocidad de lectura">{RATES.map(([l,v])=><button key={v} type="button" className={s.rate===v?'is-on':''} aria-pressed={s.rate===v} onClick={()=>set({rate:v})}>{l}</button>)}</div>
      </>}

      <button type="button" className="a11y-reset" onClick={()=>{stop();set({...DEFAULTS})}} disabled={!changed&&s.rate===1}><RotateCcw aria-hidden="true"/> Restablecer todo</button>
    </div>}
    <button type="button" ref={btnRef} className={`a11y-fab${changed?' is-active':''}`} onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-label="Opciones de accesibilidad" title="Accesibilidad">
      <Accessibility aria-hidden="true"/>
    </button>
  </div>;
}

// Antes del primer render, para que la página no parpadee con el tamaño normal
if(typeof window!=='undefined'&&!window.location.pathname.startsWith('/admin'))apply(load());
