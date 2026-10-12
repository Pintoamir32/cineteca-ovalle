import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, ImagePlus, Images, Mail, Send, X } from 'lucide-react';
import { useSiteText } from './site-text';
import './submit.css';
import { formatDuration } from './duration';
import { useHero } from './site-text';

/* «Inscribe tu obra»: realizadoras y realizadores envían su película para que la Cineteca la conozca.
   Llega al gestor, sección «Inscripciones» (ver server/index.js, /api/submissions). */

const EMPTY={name:'',phone:'',email:'',title:'',synopsis:'',link:'',year:'',duration:'',genre:'',format:'',direction:'',production:'',place:'',credits:'',poster:'',images:[],consent:false,website:''};
// Obligatorios: datos de contacto, la obra, y toda la ficha técnica (salvo comentarios)
const REQUIRED=['name','phone','email','title','synopsis','genre','year','duration','direction','production','format','place'];
const MAX_IMAGES=6;

// Las imágenes se achican en el navegador antes de enviarlas (lado mayor 1600 px, JPEG)
function shrinkImage(file,max=1600){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement('canvas');
      c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);
      const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.85));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No pudimos leer esa imagen. Prueba con un JPG o PNG.'))};
    img.src=url;
  });
}
const GENRES=['Ficción','Documental','Animación','Experimental','Videoclip','Otro'];
const DRAFT_KEY='cdo-inscripcion';
const STEPS=[
  ['Completa el formulario','Tus datos, la película, su ficha técnica y, si quieres, imágenes.'],
  ['La revisamos','El equipo de la Cineteca la ve y evalúa dónde puede sumarse.'],
  ['Te contactamos','Te escribimos para conversar sobre archivo, funciones o colecciones.']
];

export function SubmitPage(){
  const email=useSiteText().content.footerEmail;
  // Lo escrito se guarda en este navegador mientras no se envía: si se cierra la pestaña, no se pierde
  const [form,setForm]=useState(()=>{try{return {...EMPTY,...JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}'),poster:'',images:[],consent:false,website:''}}catch{return EMPTY}});
  const [state,setState]=useState('idle'), [error,setError]=useState(''), topRef=useRef(null);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
  useEffect(()=>{if(state!=='sent'){try{const {consent,website,poster,images,...keep}=form;localStorage.setItem(DRAFT_KEY,JSON.stringify(keep))}catch{/* sin almacenamiento */}}},[form,state]);// eslint-disable-line no-unused-vars

  const done=REQUIRED.filter(k=>String(form[k]).trim()).length;
  const [reading,setReading]=useState(false);
  const addImages=async(files,poster)=>{
    const list=[...(files||[])].filter(f=>f.type.startsWith('image/'));if(!list.length)return;
    setError('');setReading(true);
    try{
      if(poster){const url=await shrinkImage(list[0]);setForm(f=>({...f,poster:url}))}
      else{const room=MAX_IMAGES-form.images.length, urls=await Promise.all(list.slice(0,room).map(f=>shrinkImage(f)));setForm(f=>({...f,images:[...f.images,...urls].slice(0,MAX_IMAGES)}))}
    }catch(err){setError(err.message)}finally{setReading(false)}
  };
  const submit=async e=>{
    e.preventDefault();setError('');
    if(!form.genre)return setError('Elige el género de la obra en la ficha técnica.');
    setState('sending');
    try{
      const res=await fetch('/api/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(body.error||'No pudimos enviar la inscripción. Inténtalo de nuevo en unos minutos.');
      try{localStorage.removeItem(DRAFT_KEY)}catch{/* sin almacenamiento */}
      setState('sent');topRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){setError(err.message==='Failed to fetch'?'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo; lo que escribiste sigue aquí.':err.message);setState('idle')}
  };
  const again=()=>{setForm(EMPTY);setState('idle')};
  const removeImage=i=>setForm(f=>({...f,images:f.images.filter((_,j)=>j!==i)}));

  // Campo con su etiqueta arriba (en mono) y la línea inferior como único borde
  const field=(k,label,{type='text',required=false,placeholder='',hint,max,autoComplete,inputMode,wide=false}={})=><label className={`sb-field${wide?' is-wide':''}`}>
    <span className="sb-label">{label}{required&&<b aria-hidden="true">*</b>}</span>
    <input type={type} value={form[k]} onChange={set(k)} onBlur={k==='duration'?()=>setForm(f=>({...f,duration:formatDuration(f.duration)})):undefined} required={required} placeholder={placeholder} maxLength={max} autoComplete={autoComplete} inputMode={inputMode}/>
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

  const hero=useHero('inscribir');
  return <main className="submit-page" ref={topRef}>
    <section className="sb-hero">
      <span className="sb-kicker">{hero.kicker}</span>
      <h1>{hero.title}</h1>
      <p>{hero.text}</p>
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

        {section('03','Ficha técnica','Obligatoria · los comentarios son opcionales',<>
          <div className="sb-field is-wide" role="group" aria-labelledby="sb-genre">
            <span className="sb-label" id="sb-genre">Género<b aria-hidden="true">*</b></span>
            <div className="sb-chips">{GENRES.map(g=><button type="button" key={g} className={form.genre===g?'is-on':''} aria-pressed={form.genre===g} onClick={()=>setForm(f=>({...f,genre:f.genre===g?'':g}))}>{g}</button>)}</div>
          </div>
          {field('year','Año',{required:true,placeholder:'2024',inputMode:'numeric',max:20})}
          {field('duration','Duración',{required:true,placeholder:'12 min',max:40})}
          {field('direction','Dirección',{required:true,max:200,placeholder:'Quién la dirigió'})}
          {field('production','Producción',{required:true,max:200,placeholder:'Productora o colectivo'})}
          {field('format','Formato',{required:true,placeholder:'Digital 4K, 16 mm, VHS…',max:120})}
          {field('place','Lugar de rodaje',{required:true,placeholder:'Comuna o localidad',max:200})}
          {area('credits','Otros créditos o comentarios',{rows:4,max:2000,placeholder:'Guion: …\nFotografía: …\nMontaje: …'})}
        </>)}

        {section('04','Imágenes','Opcional · te sugerimos sumarlas',<>
          <p className="sb-suggest is-wide">Te sugerimos adjuntar el afiche y algunas imágenes de la película: ayudan al equipo a conocerla y a presentarla en el archivo.</p>
          <div className="sb-field is-wide">
            <span className="sb-label">Afiche <small>Opcional</small></span>
            {form.poster?<div className="sb-poster"><img src={form.poster} alt="Afiche adjunto"/><div><strong>Afiche listo</strong><label className="sb-file-btn">Cambiar afiche<input type="file" accept="image/*" hidden onChange={e=>{addImages(e.target.files,true);e.target.value=''}}/></label><button type="button" className="sb-file-link" onClick={()=>setForm(f=>({...f,poster:''}))}>Quitar</button></div></div>
            :<label className="sb-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addImages(e.dataTransfer.files,true)}}>
              <ImagePlus/><strong>Adjunta el afiche, si lo tienes</strong><span>Arrastra la imagen aquí o haz clic para elegirla · JPG, PNG o WEBP</span>
              <input type="file" accept="image/*" hidden onChange={e=>{addImages(e.target.files,true);e.target.value=''}}/>
            </label>}
          </div>
          <div className="sb-field is-wide">
            <span className="sb-label">Fotogramas o fotos de rodaje <small>Opcional · hasta {MAX_IMAGES}</small></span>
            {form.images.length>0&&<ul className="sb-thumbs">{form.images.map((src,i)=><li key={i}><img src={src} alt={`Imagen ${i+1}`}/><button type="button" onClick={()=>removeImage(i)} aria-label={`Quitar imagen ${i+1}`}><X/></button></li>)}</ul>}
            {form.images.length<MAX_IMAGES&&<label className="sb-drop is-small" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addImages(e.dataTransfer.files,false)}}>
              <Images/><strong>{form.images.length?'Agregar más imágenes':'Agregar imágenes'}</strong><span>Puedes elegir varias a la vez</span>
              <input type="file" accept="image/*" multiple hidden onChange={e=>{addImages(e.target.files,false);e.target.value=''}}/>
            </label>}
            {reading&&<em className="sb-hint">Preparando imágenes…</em>}
          </div>
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
          <button type="submit" disabled={state==='sending'||reading}>{state==='sending'?'Enviando…':<>Enviar inscripción <Send/></>}</button>
          <p className="sb-note">Lo que escribes se guarda en este navegador hasta que lo envíes (las imágenes no: si cierras la página, vuelve a adjuntarlas).</p>
        </div>
      </form>
    </div>}
  </main>;
}
