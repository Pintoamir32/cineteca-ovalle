import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clapperboard, Film, Send, UserRound } from 'lucide-react';
import './submit.css';

/* «Inscribe tu obra»: realizadoras y realizadores envían su película para que la Cineteca la conozca.
   Llega al gestor, sección «Inscripciones» (ver server/index.js, /api/submissions). */

const EMPTY={name:'',phone:'',email:'',title:'',synopsis:'',link:'',year:'',duration:'',genre:'',format:'',direction:'',production:'',place:'',credits:'',consent:false,website:''};
const GENRES=['Ficción','Documental','Animación','Experimental','Videoclip','Otro'];
const DRAFT_KEY='cdo-inscripcion';

export function SubmitPage(){
  // Lo escrito se guarda en este navegador mientras no se envía: si se cierra la pestaña, no se pierde
  const [form,setForm]=useState(()=>{try{return {...EMPTY,...JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}'),consent:false,website:''}}catch{return EMPTY}});
  const [state,setState]=useState('idle'), [error,setError]=useState(''), topRef=useRef(null);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
  useEffect(()=>{if(state!=='sent'){try{const {consent,website,...keep}=form;localStorage.setItem(DRAFT_KEY,JSON.stringify(keep))}catch{/* sin almacenamiento */}}},[form,state]);// eslint-disable-line no-unused-vars

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

  const field=(k,label,{type='text',required=false,placeholder='',hint,max,autoComplete,inputMode}={})=><label className="submit-field">
    <span>{label}{required?<b aria-hidden="true"> *</b>:<small> · opcional</small>}</span>
    <input type={type} value={form[k]} onChange={set(k)} required={required} placeholder={placeholder} maxLength={max} autoComplete={autoComplete} inputMode={inputMode}/>
    {hint&&<em>{hint}</em>}
  </label>;

  return <main className="submit-page" ref={topRef}>
    <section className="discovery-hero submit-hero">
      <span>CONVOCATORIA ABIERTA</span>
      <h1>Inscribe tu obra</h1>
      <p>¿Hiciste una película en la región? Cuéntanos de ella: la revisaremos para sumarla al archivo, a una función o a una colección de la Cineteca.</p>
    </section>

    <section className="submit-body" data-reveal>
      {state==='sent'?<div className="submit-done" role="status">
        <CheckCircle2/>
        <h2>¡Recibimos tu inscripción!</h2>
        <p>Gracias por compartir «{form.title}». El equipo de la Cineteca la revisará y te escribirá a <strong>{form.email}</strong>.</p>
        <div><button type="button" onClick={again}>Inscribir otra obra</button><Link to="/archivo">Explorar el archivo <ArrowRight/></Link></div>
      </div>
      :<form className="submit-form" onSubmit={submit} noValidate={false}>
        <fieldset>
          <legend><UserRound/> Tus datos</legend>
          <div className="submit-grid">
            {field('name','Nombre',{required:true,autoComplete:'name',max:120})}
            {field('phone','Número de teléfono',{type:'tel',required:true,placeholder:'+56 9 1234 5678',autoComplete:'tel',max:40})}
            {field('email','Correo',{type:'email',required:true,placeholder:'nombre@correo.cl',autoComplete:'email',max:160})}
          </div>
        </fieldset>

        <fieldset>
          <legend><Film/> La obra</legend>
          {field('title','Nombre de la película',{required:true,max:200})}
          <label className="submit-field">
            <span>Sinopsis<b aria-hidden="true"> *</b></span>
            <textarea value={form.synopsis} onChange={set('synopsis')} required rows={6} maxLength={4000} placeholder="¿De qué trata? Unas líneas bastan."/>
            <em>{form.synopsis.length}/4000</em>
          </label>
          {field('link','Enlace para verla o complementar',{type:'url',placeholder:'https://vimeo.com/… · YouTube · Google Drive',hint:'Si es privada, incluye la contraseña en «Otros créditos o comentarios».',max:500})}
        </fieldset>

        <fieldset>
          <legend><Clapperboard/> Ficha técnica <small>· opcional</small></legend>
          <div className="submit-grid">
            {field('year','Año',{placeholder:'2024',inputMode:'numeric',max:20})}
            {field('duration','Duración',{placeholder:'12 min',max:40})}
            <label className="submit-field">
              <span>Género<small> · opcional</small></span>
              <select value={form.genre} onChange={set('genre')}><option value="">Elegir…</option>{GENRES.map(g=><option key={g}>{g}</option>)}</select>
            </label>
            {field('format','Formato',{placeholder:'Digital 4K, 16 mm, VHS…',max:120})}
            {field('direction','Dirección',{max:200})}
            {field('production','Producción',{max:200})}
            {field('place','Lugar de rodaje',{placeholder:'Comuna o localidad',max:200})}
          </div>
          <label className="submit-field">
            <span>Otros créditos o comentarios<small> · opcional</small></span>
            <textarea value={form.credits} onChange={set('credits')} rows={4} maxLength={2000} placeholder={'Guion: …\nFotografía: …\nMontaje: …'}/>
          </label>
        </fieldset>

        {/* Campo trampa para robots: oculto para las personas */}
        <label className="submit-trap" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')}/></label>

        <label className="submit-consent">
          <input type="checkbox" checked={form.consent} onChange={set('consent')} required/>
          <span>Acepto que la Cineteca de Ovalle guarde estos datos y me contacte por esta inscripción.</span>
        </label>
        {error&&<p className="submit-error" role="alert">{error}</p>}
        <button type="submit" className="submit-send" disabled={state==='sending'}><Send/> {state==='sending'?'Enviando…':'Enviar inscripción'}</button>
        <p className="submit-note">Los campos con <b>*</b> son obligatorios. Lo que escribes se guarda en este navegador hasta que lo envíes.</p>
      </form>}
    </section>
  </main>;
}
