import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Mail, Send } from 'lucide-react';
import { useSiteText } from './site-text';
import './submit.css';

/* «Inscribe tu obra»: realizadoras y realizadores envían su película para que la Cineteca la conozca.
   Llega al gestor, sección «Inscripciones» (ver server/index.js, /api/submissions). */

const EMPTY={name:'',phone:'',email:'',title:'',synopsis:'',link:'',year:'',duration:'',genre:'',format:'',direction:'',production:'',place:'',credits:'',consent:false,website:''};
const REQUIRED=['name','phone','email','title','synopsis'];
const GENRES=['Ficción','Documental','Animación','Experimental','Videoclip','Otro'];
const DRAFT_KEY='cdo-inscripcion';
const STEPS=[
  ['Completa el formulario','Tus datos, la película y, si quieres, su ficha técnica.'],
  ['La revisamos','El equipo de la Cineteca la ve y evalúa dónde puede sumarse.'],
  ['Te contactamos','Te escribimos para conversar sobre archivo, funciones o colecciones.']
];

export function SubmitPage(){
  const email=useSiteText().content.footerEmail;
  // Lo escrito se guarda en este navegador mientras no se envía: si se cierra la pestaña, no se pierde
  const [form,setForm]=useState(()=>{try{return {...EMPTY,...JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}'),consent:false,website:''}}catch{return EMPTY}});
  const [state,setState]=useState('idle'), [error,setError]=useState(''), topRef=useRef(null);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
  useEffect(()=>{if(state!=='sent'){try{const {consent,website,...keep}=form;localStorage.setItem(DRAFT_KEY,JSON.stringify(keep))}catch{/* sin almacenamiento */}}},[form,state]);// eslint-disable-line no-unused-vars

  const done=REQUIRED.filter(k=>String(form[k]).trim()).length;
  const submit=async e=>{
    e.preventDefault();setError('');setState('sending');
    try{
      const res=await fetch('/api/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(body.error||'No pudimos enviar la inscripción. Inténtalo de nuevo en unos minutos.');
      try{localStorage.removeItem(DRAFT_KEY)}catch{/* sin almacenamiento */}
      setState('sent');topRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){setError(err.message==='Failed to fetch'?'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo; lo que escribiste sigue aquí.':err.message);setState('idle')}
  };
  const again=()=>{setForm(EMPTY);setState('idle')};

  // Campo con su etiqueta arriba (en mono) y la línea inferior como único borde
  const field=(k,label,{type='text',required=false,placeholder='',hint,max,autoComplete,inputMode,wide=false}={})=><label className={`sb-field${wide?' is-wide':''}`}>
    <span className="sb-label">{label}{required&&<b aria-hidden="true">*</b>}</span>
    <input type={type} value={form[k]} onChange={set(k)} required={required} placeholder={placeholder} maxLength={max} autoComplete={autoComplete} inputMode={inputMode}/>
    {hint&&<em className="sb-hint">{hint}</em>}
  </label>;
  const area=(k,label,{required=false,rows=5,max,placeholder,counter=false}={})=><label className="sb-field is-wide">
    <span className="sb-label">{label}{required&&<b aria-hidden="true">*</b>}{counter&&<small>{form[k].length}/{max}</small>}</span>
    <textarea value={form[k]} onChange={set(k)} required={required} rows={rows} maxLength={max} placeholder={placeholder}/>
  </label>;
  const section=(n,title,note,children)=><section className="sb-section">
    <header><span className="sb-num">{n}</span><h2>{title}</h2>{note&&<small>{note}</small>}</header>
    <div className="sb-grid">{children}</div>
  </section>;

  return <main className="submit-page" ref={topRef}>
    <section className="sb-hero">
      <span className="sb-kicker">CONVOCATORIA ABIERTA · PERMANENTE</span>
      <h1>Inscribe<br/><em>tu obra.</em></h1>
      <p>¿Hiciste una película en la región? Cuéntanos de ella: la revisaremos para sumarla al archivo, a una función o a una colección de la Cineteca.</p>
    </section>

    {state==='sent'?<section className="sb-done" role="status">
      <CheckCircle2/>
      <span className="sb-kicker">INSCRIPCIÓN RECIBIDA</span>
      <h2>¡Gracias por compartir<br/><em>«{form.title}»!</em></h2>
      <p>El equipo de la Cineteca la revisará y te escribirá a <strong>{form.email}</strong>.</p>
      <div><button type="button" onClick={again}>Inscribir otra obra</button><Link to="/archivo">Explorar el archivo <ArrowRight/></Link></div>
    </section>

    :<div className="sb-layout">
      <aside className="sb-aside">
        <div className="sb-aside-inner">
          <span className="sb-kicker">CÓMO FUNCIONA</span>
          <ol className="sb-steps">{STEPS.map(([t,d],i)=><li key={t}><b>{String(i+1).padStart(2,'0')}</b><div><strong>{t}</strong><p>{d}</p></div></li>)}</ol>
          <div className="sb-progress" aria-live="polite">
            <div className="sb-progress-head"><span>Obligatorios</span><b>{done}/{REQUIRED.length}</b></div>
            <div className="sb-progress-bar"><i style={{width:`${done/REQUIRED.length*100}%`}}/></div>
            <p>{done===REQUIRED.length?<><Check/> Listo para enviar</>:'Completa los campos con *'}</p>
          </div>
          {email&&<a className="sb-contact" href={`mailto:${email}`}><Mail/> ¿Dudas? {email}</a>}
        </div>
      </aside>

      <form className="sb-form" onSubmit={submit}>
        {section('01','Tus datos',null,<>
          {field('name','Nombre',{required:true,autoComplete:'name',max:120,wide:true,placeholder:'Tu nombre completo'})}
          {field('phone','Teléfono',{type:'tel',required:true,placeholder:'+56 9 1234 5678',autoComplete:'tel',max:40})}
          {field('email','Correo',{type:'email',required:true,placeholder:'nombre@correo.cl',autoComplete:'email',max:160})}
        </>)}

        {section('02','La obra',null,<>
          {field('title','Nombre de la película',{required:true,max:200,wide:true,placeholder:'Título de la obra'})}
          {area('synopsis','Sinopsis',{required:true,rows:5,max:4000,placeholder:'¿De qué trata? Unas líneas bastan.',counter:true})}
          {field('link','Enlace para verla o complementar',{type:'url',placeholder:'https://vimeo.com/…',hint:'Vimeo, YouTube o Google Drive. Si es privada, deja la contraseña en los comentarios.',max:500,wide:true})}
        </>)}

        {section('03','Ficha técnica','Opcional · mientras más completa, mejor',<>
          <div className="sb-field is-wide" role="group" aria-labelledby="sb-genre">
            <span className="sb-label" id="sb-genre">Género</span>
            <div className="sb-chips">{GENRES.map(g=><button type="button" key={g} className={form.genre===g?'is-on':''} aria-pressed={form.genre===g} onClick={()=>setForm(f=>({...f,genre:f.genre===g?'':g}))}>{g}</button>)}</div>
          </div>
          {field('year','Año',{placeholder:'2024',inputMode:'numeric',max:20})}
          {field('duration','Duración',{placeholder:'12 min',max:40})}
          {field('direction','Dirección',{max:200,placeholder:'Quién la dirigió'})}
          {field('production','Producción',{max:200,placeholder:'Productora o colectivo'})}
          {field('format','Formato',{placeholder:'Digital 4K, 16 mm, VHS…',max:120})}
          {field('place','Lugar de rodaje',{placeholder:'Comuna o localidad',max:200})}
          {area('credits','Otros créditos o comentarios',{rows:4,max:2000,placeholder:'Guion: …\nFotografía: …\nMontaje: …'})}
        </>)}

        {/* Campo trampa para robots: oculto para las personas */}
        <label className="sb-trap" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')}/></label>

        <div className="sb-send">
          <label className="sb-consent">
            <input type="checkbox" checked={form.consent} onChange={set('consent')} required/>
            <span className="sb-check" aria-hidden="true"><Check/></span>
            <span>Acepto que la Cineteca de Ovalle guarde estos datos y me contacte por esta inscripción.</span>
          </label>
          {error&&<p className="sb-error" role="alert">{error}</p>}
          <button type="submit" disabled={state==='sending'}>{state==='sending'?'Enviando…':<>Enviar inscripción <Send/></>}</button>
          <p className="sb-note">Lo que escribes se guarda en este navegador hasta que lo envíes.</p>
        </div>
      </form>
    </div>}
  </main>;
}
