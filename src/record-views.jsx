import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, CirclePlay, Download, FileText, Headphones, MapPin, Maximize2, X } from 'lucide-react';
import { sections } from './data';
import { placesOf } from './repository';
import { useEdit } from './edit-context';
import { tagStyle } from './color';
import './record-views.css';

const ARCHIVE_NOTE='Este registro forma parte de un proceso continuo de investigación, preservación y acceso comunitario al patrimonio audiovisual de la Provincia del Limarí.';
const code=item=>`FICHA CDO—${String(item.id).padStart(4,'0')}`;

// Botón volver compartido: muestra el nombre real de la sección
export function BackLink({item}){
  const label=sections.find(s=>s.slug===item.slug)?.label||'Archivo';
  return <Link className="back-link" to={`/${item.slug||'archivo'}`}><span className="back-link-icon"><ArrowLeft/></span><span>Volver a <b>{label}</b></span></Link>;
}

export function MediaViewer({item,extra}){
  if(extra?.mediaType==='video')return <div className="media-viewer"><video controls poster={item.image} preload="none">{extra.media&&<source src={extra.media} type="video/mp4"/>}</video><span>VERSIÓN DE CONSULTA · ARCHIVO CDO</span></div>;
  if(extra?.mediaType==='audio')return <div className="media-viewer audio-viewer"><img src={item.image} alt="" loading="lazy" decoding="async"/><div><Headphones/><h3>Escuchar entrevista</h3><audio controls preload="none" src={extra.media||undefined}/></div></div>;
  if(extra?.mediaType==='document')return <div className="media-viewer document-viewer"><FileText/><span>DOCUMENTO DIGITALIZADO</span><h3>{item.title}</h3><p>Vista previa del documento · {item.format}</p>{extra.media?<a className="doc-download" href={extra.media} download={`${item.title}.pdf`} target="_blank" rel="noreferrer"><Download/> Descargar PDF</a>:<button disabled><Download/> Descargar PDF</button>}</div>;
  return <div className="media-viewer"><img src={item.image} alt={item.title} loading="lazy" decoding="async"/><span>IMAGEN DIGITALIZADA · ARCHIVO CDO</span></div>;
}

/* ---------- Piezas compartidas ---------- */

// [etiqueta, valor, ancho, campo editable]: en el gestor los campos editables se muestran aunque estén vacíos
function Facts({rows}){
  const {edit,f}=useEdit();
  return <dl className="ficha-film-facts">{rows.filter(([,v,,key])=>v||(edit&&key)).map(([k,v,wide,key])=><div key={k} className={wide?'wide':undefined}><dt>{k}</dt><dd>{key?f(key,v,{placeholder:k}):v}</dd></div>)}</dl>;
}

function PeopleCards({people,title='Personas mencionadas',number}){
  return <section className="doc-people">
    <div className="ficha-filmography-head"><div className="ficha-section-label">{number&&<span>{number}</span>} {title.toUpperCase()}</div><span>{String(people.length).padStart(2,'0')} {people.length===1?'PERSONA':'PERSONAS'}</span></div>
    {people.length?<div className="ficha-people-grid">{people.map(({person,roles})=><Link key={person.id} to={`/ficha/${person.id}`} className="ficha-person-card">
      <img src={person.image} alt="" loading="lazy" decoding="async"/>
      <div><h3>{person.title}</h3><small>{person.subtitle}</small><div className="ficha-filmography-roles">{roles.map(r=><span key={r}>{r}</span>)}</div></div>
      <ArrowRight/>
    </Link>)}</div>:<p className="ficha-filmography-empty">Aún no hay personas vinculadas a este registro.</p>}
  </section>;
}

// Relacionados como índice de diario: miniatura en papel, titular con serifa
function RelatedList({related}){
  if(!related.length)return null;
  return <section className="doc-related">
    <header><h3>Ver también</h3><span>{String(related.length).padStart(2,'0')} registros</span></header>
    <ol>{related.map((r,i)=><li key={r.id}><Link to={`/ficha/${r.id}`}>
      <span className="doc-related-num">{String(i+1).padStart(2,'0')}</span>
      <span className="doc-related-thumb"><img src={r.image} alt="" loading="lazy" decoding="async"/></span>
      <span className="doc-related-text"><small>{r.type} · {r.year}</small><strong>{r.title}</strong><em>{r.subtitle}</em></span>
      <ArrowRight className="doc-related-arrow"/>
    </Link></li>)}</ol>
  </section>;
}

function Places({item,places,slot}){
  return <><div className="ficha-aside-label">{places.length>1?`Territorios · ${places.length}`:'Territorio'}</div>
    <ul className="ficha-film-locations">{places.map(l=><li key={l}><Link to={`/${item.slug}?locacion=${encodeURIComponent(l)}`}><MapPin/><strong>{l}</strong><ArrowRight/></Link></li>)}</ul>
    {slot('places')}
    <Link className="ficha-film-maplink" to="/mapa">Ver en el mapa <ArrowRight/></Link></>;
}

/* ---------- Prensa, entrevistas y artículos: una misma vista de documento ---------- */

// Qué muestra cada tipo dentro del diseño de documento
function docConfig(item,extra){
  const [kind,extent]=(item.format||'').split(' · ');
  const credit=k=>extra.credits?.find(([key])=>key===k)?.[1];
  const others=skip=>(extra.credits||[]).filter(([k])=>!skip.includes(k));
  const isVideo=/video/i.test(kind);
  if(item.type==='Entrevista')return {
    source:`Entrevista a ${item.subtitle}`,
    meta:[item.year,kind,extent],
    caption:'Registro de memoria oral · Archivo CDO',
    cta:[isVideo?CirclePlay:Headphones,isVideo?'Ver entrevista':'Escuchar entrevista','#media'],
    facts:[['Persona entrevistada',item.subtitle,true,'subtitle'],['Año',item.year,false,'year'],['Formato',kind,false,'format.0'],['Duración',extent,false,'format.1'],...others(['Duración']),['Colección',item.collection,true]],
    factsLabel:'Ficha de la entrevista',textLabel:'RESUMEN DE LA ENTREVISTA',player:true
  };
  if(item.type==='Artículo')return {
    source:credit('Edición')||credit('Revista')||item.collection,
    meta:[item.year,kind,extent],
    caption:`Imagen: Archivo CDO · ${item.collection}`,
    cta:[BookOpen,'Leer artículo','#texto'],
    facts:[['Autoría',item.subtitle,true,'subtitle'],['Año',item.year,false,'year'],['Tipo',kind,false,'format.0'],['Lectura',extent,false,'format.1'],...others(['Extensión']),['Colección',item.collection,true]],
    factsLabel:'Ficha del artículo',textLabel:'TEXTO'
  };
  return {
    source:item.subtitle,
    meta:[credit('Fecha')||item.year,credit('Sección')&&`Sección ${credit('Sección')}`,item.format],
    caption:'Recorte digitalizado · Archivo CDO',
    cta:[Maximize2,'Ver documento completo',null],
    facts:[['Medio',item.subtitle,true,'subtitle'],['Fecha',credit('Fecha')||item.year,false,credit('Fecha')?undefined:'year'],['Tipo',kind,false,'format.0'],['Extensión',credit('Páginas')?`${credit('Páginas')} páginas`:extent,false,credit('Páginas')?undefined:'format.1'],['Sección',credit('Sección')],['Fondo',credit('Fondo')],['Colección',item.collection,true]],
    factsLabel:'Ficha del documento',textLabel:'TRANSCRIPCIÓN',download:true
  };
}

export function DocumentView({item,extra,related,people}){
  const {f,slot}=useEdit();
  const cfg=docConfig(item,extra);
  // Galería: imagen principal, material propio del registro e imágenes de sus relacionados
  const gallery=useMemo(()=>[
    {src:item.image,caption:cfg.caption,kind:'Imagen principal'},
    ...(extra.gallery||[]).map((src,i)=>({src,caption:`Material asociado ${i+1}`,kind:'Material asociado'})),
    ...related.map(r=>({src:r.image,caption:r.title,kind:`Ver también · ${r.type}`,to:`/ficha/${r.id}`}))
  ],[item,extra,related,cfg.caption]);
  const [zoom,setZoom]=useState(null);
  const open=zoom!==null, shown=open?gallery[zoom]:null;
  const step=d=>setZoom(z=>(z+d+gallery.length)%gallery.length);
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==='Escape')setZoom(null);if(e.key==='ArrowRight')step(1);if(e.key==='ArrowLeft')step(-1)};
    document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,gallery.length]);
  const [CtaIcon,ctaText,ctaHref]=cfg.cta;
  return <main className={`ficha-page doc-page doc-press doc-${item.slug}`}>
    <section className="doc-shell" data-reveal>
      <div className="ficha-film-top"><BackLink item={item}/><span className="ficha-code">{code(item)}</span></div>
      <header className="press-masthead">
        <h2>La Cineteca de Ovalle</h2>
        <div>{[cfg.source,...cfg.meta].filter(Boolean).map(m=><span key={m}>{m}</span>)}</div>
      </header>
      <div className="press-layout">
        <div className="press-side">
          <figure className="press-clipping">
            <button type="button" onClick={()=>setZoom(0)} aria-label="Ampliar imagen">
              <img src={item.image} alt={item.title} decoding="async"/>
              <span className="press-zoom"><Maximize2/> Ampliar</span>
            </button>
            {slot('image')}
            <figcaption>{cfg.caption}</figcaption>
          </figure>
          {cfg.player&&<div className="press-player" id="media"><MediaViewer item={item} extra={extra}/>{slot('media')}</div>}
        </div>
        <article className="press-article">
          <span className="ficha-tag" style={tagStyle(item.color)}>{item.type}</span>
          <h1>{f('title',item.title)}</h1>
          <p className="press-dek">{f('description',item.description,{multiline:true})}</p>
          <div className="press-actions">
            {ctaHref?<a className="ficha-cta" href={ctaHref}><CtaIcon/> {ctaText}</a>:<button type="button" className="ficha-cta" onClick={()=>setZoom(0)}><CtaIcon/> {ctaText}</button>}
            {cfg.download&&(extra.media?<a className="doc-ghost-btn" href={extra.media} download={`${item.title}.pdf`} target="_blank" rel="noreferrer"><Download/> Descargar PDF</a>:<button type="button" className="doc-ghost-btn" disabled><Download/> Descargar PDF</button>)}
            {!cfg.player&&slot('media')}
          </div>
          <div className="ficha-aside-label">{cfg.factsLabel}</div>
          <Facts rows={cfg.facts}/>
          <div className="ficha-section-label" id="texto"><span>01</span> {cfg.textLabel}</div>
          <div className="press-transcript"><p>{f('description',item.description,{multiline:true})}</p><p>{ARCHIVE_NOTE}</p></div>
        </article>
      </div>
    </section>
    <section className="doc-gallery" data-reveal>
      <div className="ficha-filmography-head"><div className="ficha-section-label"><span>02</span> GALERÍA</div><span>{String(gallery.length).padStart(2,'0')} IMÁGENES</span></div>
      {slot('gallery')}
      <div className="doc-gallery-grid">{gallery.map((g,i)=><figure key={g.src+i} className={i===0?'is-main':undefined}>
        <button type="button" onClick={()=>setZoom(i)} aria-label={`Ampliar: ${g.caption}`}><img src={g.src} alt={g.caption} loading="lazy" decoding="async"/><span className="press-zoom"><Maximize2/> Ampliar</span></button>
        <figcaption><small>{String(i+1).padStart(2,'0')} · {g.kind}</small>{g.to?<Link to={g.to}>{g.caption}</Link>:<span>{g.caption}</span>}</figcaption>
      </figure>)}</div>
    </section>
    <section className="doc-footer" data-reveal>
      <div className="doc-footer-main"><PeopleCards people={people} number="03"/></div>
      <aside className="doc-footer-side"><RelatedList related={related}/>{slot('relations')}<Places item={item} places={placesOf(extra)} slot={slot}/></aside>
    </section>
    {open&&<div className="press-lightbox" role="dialog" aria-modal="true" aria-label={shown.caption} onClick={()=>setZoom(null)}>
      <figure onClick={e=>e.stopPropagation()}>
        <img src={shown.src} alt={shown.caption}/>
        <figcaption><span>{zoom+1} / {gallery.length}</span><strong>{shown.caption}</strong>{shown.to&&<Link to={shown.to} onClick={()=>setZoom(null)}>Ver ficha <ArrowRight/></Link>}</figcaption>
      </figure>
      <button type="button" className="press-lightbox-close" aria-label="Cerrar" onClick={()=>setZoom(null)}><X/></button>
      {gallery.length>1&&<>
        <button type="button" className="press-lightbox-nav is-prev" aria-label="Imagen anterior" onClick={e=>{e.stopPropagation();step(-1)}}><ChevronLeft/></button>
        <button type="button" className="press-lightbox-nav is-next" aria-label="Imagen siguiente" onClick={e=>{e.stopPropagation();step(1)}}><ChevronRight/></button>
      </>}
    </div>}
  </main>;
}
