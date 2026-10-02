import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CirclePlay, Download, FileText, Headphones, Maximize2, X } from 'lucide-react';
import { sections } from './data';
import { getInterviewees, interviewFormat, joinNames, recordPath } from './repository';
import { useEdit } from './edit-context';
import { tagStyle } from './color';
import { videoSource } from './video-links';
import './record-views.css';

const code=item=>`FICHA CDO—${String(item.id).padStart(4,'0')}`;

// Botón volver compartido: muestra el nombre real de la sección
export function BackLink({item}){
  const label=sections.find(s=>s.slug===item.slug)?.label||'Archivo';
  return <Link className="back-link" to={`/${item.slug||'archivo'}`}><span className="back-link-icon"><ArrowLeft/></span><span>Volver a <b>{label}</b></span></Link>;
}

// Película o video: reproductor incrustado (YouTube, Vimeo, Drive…), archivo de video, o enlace para abrirlo
export function VideoPlayer({url,poster,title='Película'}){
  const v=videoSource(url);
  if(v?.kind==='iframe')return <div className="media-embed"><iframe src={v.src} title={title} loading="lazy" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>;
  if(v?.kind==='link')return <div className="media-embed media-external">{poster&&<img src={poster} alt="" loading="lazy" decoding="async"/>}<a href={v.src} target="_blank" rel="noreferrer"><CirclePlay/> Ver en {v.provider}</a></div>;
  return <video controls poster={poster} preload="none" src={v?.src||undefined}/>;
}

export function MediaViewer({item,extra}){
  if(extra?.mediaType==='video')return <div className="media-viewer"><VideoPlayer url={extra.media} poster={item.image} title={item.title}/></div>;
  if(extra?.mediaType==='audio')return <div className="media-viewer audio-viewer"><img src={item.image} alt="" loading="lazy" decoding="async"/><div><Headphones/><h3>Escuchar entrevista</h3><audio controls preload="none" src={extra.media||undefined}/></div></div>;
  if(extra?.mediaType==='document')return <div className="media-viewer document-viewer"><FileText/><h3>{item.title}</h3><p>Vista previa del documento · {item.format}</p>{extra.media?<a className="doc-download" href={extra.media} download={`${item.title}.pdf`} target="_blank" rel="noreferrer"><Download/> Descargar PDF</a>:<button disabled><Download/> Descargar PDF</button>}</div>;
  return <div className="media-viewer"><img src={item.image} alt={item.title} loading="lazy" decoding="async"/></div>;
}

// Documento de prensa en pantalla: los de Google Drive por su vista previa; el resto, con el visor del navegador
function pdfSource(url){
  const drive=/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/.exec(url);
  return drive?{src:`https://drive.google.com/file/d/${drive[1]}/preview`,frame:true}:{src:url,frame:false};
}

export function PdfViewer({url,title}){
  const {src,frame}=pdfSource(url);
  const fallback=<a className="doc-ghost-btn" href={url} target="_blank" rel="noreferrer"><FileText/> Abrir documento</a>;
  return <div className="press-pdf-frame">
    {frame?<iframe src={src} title={title} loading="lazy" allow="autoplay"/>
      :<object data={`${src}#view=FitH`} type="application/pdf" aria-label={title}><div className="press-pdf-fallback"><FileText/><p>Este navegador no puede mostrar el documento aquí.</p>{fallback}</div></object>}
  </div>;
}

/* ---------- Piezas compartidas ---------- */

// Cuerpo de entrevistas y artículos: bloques de texto e imagen, en el orden en que se escriben.
// Las imágenes a la izquierda o derecha quedan rodeadas por el texto que sigue; al centro o a lo ancho lo cortan.
// extra.body = [{type:'text',text} | {type:'image',src,align,caption}]. Las fichas anteriores (solo texto, o
// texto con extra.bodyImages ubicadas por párrafo) se convierten a bloques al mostrarlas.
export const BODY_IMAGE_ALIGNS=[['left','Izquierda'],['right','Derecha'],['center','Centro'],['full','Ancho completo']];
export function bodyBlocks(text,extra={}){
  if(Array.isArray(extra.body))return extra.body;
  const images=(extra.bodyImages||[]).filter(img=>img?.src), lines=String(text||'').split('\n');
  const total=lines.filter(l=>l.trim()).length;
  const at=n=>images.filter(img=>Math.min(Math.max(Number(img.after)||0,0),total)===n).map(({src,align,caption})=>({type:'image',src,align,caption}));
  const out=[...at(0)];
  let chunk=[], count=0;
  const flush=()=>{const t=chunk.join('\n').replace(/^\n+|\n+$/g,'');if(t)out.push({type:'text',text:t});chunk=[]};
  for(const line of lines){
    chunk.push(line);
    if(!line.trim())continue;
    const here=at(++count);
    if(here.length&&count<total){flush();out.push(...here)}
  }
  flush();
  if(total>0)out.push(...at(total));
  return out;
}
// El texto completo (sin imágenes), para listados, buscador y descripciones
export const bodyPlainText=blocks=>blocks.filter(b=>b.type==='text'&&b.text?.trim()).map(b=>b.text.trim()).join('\n');
// Tamaño de la imagen (% del ancho del texto); a lo ancho no se ajusta. Sin valor, el tamaño por defecto de cada lado.
export const BODY_IMAGE_SIZE={left:[44,20,70],right:[44,20,70],center:[70,30,100]};// [por defecto, mínimo, máximo]
// Al cambiar de lado, el tamaño se ajusta al rango del nuevo lado
export const bodyImageStyle=b=>{const r=BODY_IMAGE_SIZE[b.align||'right'];return b.size&&r?{'--w':`${Math.min(r[2],Math.max(r[1],b.size))}%`}:undefined};
export function BodyImage({block}){
  return <figure className={`body-img is-${block.align||'right'}`} style={bodyImageStyle(block)}>
    <img src={block.src} alt={block.caption||''} loading="lazy" decoding="async"/>
    {block.caption&&<figcaption>{block.caption}</figcaption>}
  </figure>;
}
export function BodyText({blocks}){
  return <>{blocks.map((b,i)=>b.type==='image'?(b.src&&<BodyImage key={i} block={b}/>):(b.text?.trim()&&<div key={i} className="body-chunk">{b.text}</div>))}<span className="body-clear"/></>;
}

// [etiqueta, valor, ancho, campo editable]: en el gestor los campos editables se muestran aunque estén vacíos
function Facts({rows}){
  const {edit,f}=useEdit();
  return <dl className="ficha-film-facts">{rows.filter(([,v,,key])=>v||(edit&&key)).map(([k,v,wide,key])=><div key={k} className={wide?'wide':undefined}><dt>{k}</dt><dd>{key?f(key,v,{placeholder:k}):v}</dd></div>)}</dl>;
}

// Relacionados como índice de diario: miniatura en papel, titular con serifa
function RelatedList({related,title='Ver también'}){
  if(!related.length)return null;
  return <section className="doc-related">
    <header><h3>{title}</h3><span>{String(related.length).padStart(2,'0')} registros</span></header>
    <ol>{related.map((r,i)=><li key={r.id}><Link to={recordPath(r)}>
      <span className="doc-related-num">{String(i+1).padStart(2,'0')}</span>
      <span className="doc-related-thumb"><img src={r.image} alt="" loading="lazy" decoding="async"/></span>
      <span className="doc-related-text"><small>{r.type} · {r.year}</small><strong>{r.title}</strong><em>{r.subtitle}</em></span>
      <ArrowRight className="doc-related-arrow"/>
    </Link></li>)}</ol>
  </section>;
}


/* ---------- Prensa, entrevistas y artículos: una misma vista de documento ---------- */

// Qué muestra cada tipo dentro del diseño de documento
function docConfig(item,extra){
  // Entrevista: entrevistados(as) (con enlace a su ficha), fecha, formato y contenido o archivo adjunto
  if(item.type==='Entrevista'){
    const who=getInterviewees(item,extra), name=joinNames(who.map(x=>x.name)), format=interviewFormat(extra);
    const links=who.map(({person,name:n},i)=><React.Fragment key={i}>{i>0&&(i===who.length-1?' y ':', ')}{person?<Link to={recordPath(person)}>{n}</Link>:n}</React.Fragment>);
    return {
      interview:true,name,title:name?`Entrevista a ${name}`:item.title,image:item.image||who.find(x=>x.person?.image)?.person.image,
      facts:[[who.length>1?'Entrevistados(as)':'Entrevistado(a)',who.length?links:'',true],['Fecha',item.year,false,'year'],['Formato',format]],
      factsLabel:'Ficha de la entrevista',textLabel:'CONTENIDO',player:extra.mediaType!=='text'
    };
  }
  // Artículo: título, autor(a), fecha de publicación, películas referenciadas, cuerpo del artículo e imagen principal
  if(item.type==='Artículo')return {
    article:true,
    facts:[['Autor(a)',item.subtitle,true,'subtitle'],['Fecha de publicación',item.year,true,'year']],
    factsLabel:'Ficha del artículo'
  };
  // Prensa: título/fuente, fecha, medio de origen, documento digitalizado y vínculos a películas y personas
  return {
    facts:[['Medio de origen',item.subtitle,true,'subtitle'],['Fecha',item.year,true,'year']],
    factsLabel:'Ficha del documento',press:true
  };
}

export function DocumentView({item,extra,related,people}){
  const {f,slot,edit}=useEdit();
  const cfg=docConfig(item,extra);
  // Imágenes que se pueden ampliar: la principal (prensa, entrevistas y artículos no llevan galería)
  const gallery=useMemo(()=>[
    {src:cfg.image||item.image,caption:'',alt:item.title,kind:'Imagen principal'},
    ...(cfg.press||cfg.interview||cfg.article?[]:related).map(r=>({src:r.image,caption:r.title,kind:`Ver también · ${r.type}`,to:recordPath(r)}))
  ],[item,extra,related,cfg.image,cfg.press,cfg.interview,cfg.article]);
  const [zoom,setZoom]=useState(null);
  const open=zoom!==null, shown=open?gallery[zoom]:null;
  const step=d=>setZoom(z=>(z+d+gallery.length)%gallery.length);
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==='Escape')setZoom(null);if(e.key==='ArrowRight')step(1);if(e.key==='ArrowLeft')step(-1)};
    document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,gallery.length]);
  const hasPdf=cfg.press&&!!extra.media;
  const [CtaIcon,ctaText,ctaHref]=cfg.cta||[];
  // Entrevista y artículo: bloques de texto e imagen; en el gestor se escriben y ordenan ahí mismo (slot «body»)
  const blocks=bodyBlocks(item.description,extra), hasBody=blocks.some(b=>b.type==='image'?b.src:b.text?.trim());
  const body=edit?slot('body'):<BodyText blocks={blocks}/>;
  // Entrevista: el reproductor va junto a la ficha (columna derecha), no bajo la foto
  const player=cfg.player&&<div className="press-player" id="media"><MediaViewer item={{...item,image:cfg.image||item.image}} extra={extra}/>{slot('media')}</div>;
  // Panel derecho, como el de las películas: la imagen principal y los campos propios de cada tipo (y en prensa, sus películas vinculadas)
  const pressFilms=cfg.press?related.filter(r=>r.type==='Película'):[];
  const aside=<aside className="ficha-aside ficha-film-aside doc-aside"><div className="doc-aside-inner">
    <figure className="press-clipping doc-aside-image">
      <button type="button" onClick={()=>setZoom(0)} aria-label="Ampliar imagen">
        <img src={cfg.image||item.image} alt={item.title} decoding="async"/>
        <span className="press-zoom"><Maximize2/> Ampliar</span>
      </button>
      {slot('image')}
    </figure>
    {cfg.press&&<><div className="ficha-aside-label">Personas vinculadas</div>
      {people.length?<div className="ficha-film-related">{people.map(({person,roles})=><Link to={recordPath(person)} key={person.id}><img src={person.image} alt="" loading="lazy" decoding="async"/><div><small>{roles.join(' · ')||person.subtitle}</small><strong>{person.title}</strong></div><ArrowRight/></Link>)}</div>
      :<p className="ficha-filmography-empty">Aún no hay personas vinculadas a este registro.</p>}</>}
    <div className="ficha-aside-label">{cfg.factsLabel}</div>
    <Facts rows={cfg.facts}/>
    {pressFilms.length>0&&<><div className="ficha-aside-label">Películas vinculadas</div><div className="ficha-film-related">{pressFilms.map(r=><Link to={recordPath(r)} key={r.id}><img src={r.image} alt="" loading="lazy" decoding="async"/><div><small>{r.type}</small><strong>{r.title}</strong></div><ArrowRight/></Link>)}</div></>}
  </div></aside>;
  return <main className={`ficha-page doc-page doc-press doc-${item.slug}`}>
    <div className="doc-grid"><div className="doc-content">
    <section className="doc-shell" data-reveal>
      <div className="ficha-film-top"><BackLink item={item}/><span className="ficha-code">{code(item)}</span></div>
      <div className="press-layout">
        <article className="press-article">
          <span className="ficha-tag" style={tagStyle(item.color)}>{item.type}</span>
          <h1>{cfg.interview?cfg.title:f('title',item.title)}</h1>
          {!cfg.press&&!cfg.interview&&!cfg.article&&<p className="press-dek">{f('description',item.description,{multiline:true})}</p>}
          {(CtaIcon||slot('media'))&&<div className="press-actions">
            {CtaIcon&&(ctaHref?<a className="ficha-cta" href={ctaHref}><CtaIcon/> {ctaText}</a>:<button type="button" className="ficha-cta" onClick={()=>setZoom(0)}><CtaIcon/> {ctaText}</button>)}
            {!cfg.player&&slot('media')}
          </div>}
          {cfg.interview&&player}
          {!cfg.press&&!cfg.interview&&!cfg.article&&<><div className="ficha-section-label" id="texto"><span>01</span> {cfg.textLabel}</div>
          <div className="press-transcript"><p>{f('description',item.description,{multiline:true})}</p></div></>}
        </article>
      </div>
    </section>
    {/* Entrevista: el contenido va en su propia sección, a lo ancho y con columna de lectura; si no hay texto, no aparece */}
    {cfg.interview&&(edit||hasBody)&&<section className="interview-text" id="texto" data-reveal>
      <div className="ficha-filmography-head"><div className="ficha-section-label"><span>01</span> CONTENIDO</div><span>ENTREVISTA{cfg.name?` A ${cfg.name.toUpperCase()}`:''}</span></div>
      <div className="interview-text-body">{body}</div>
    </section>}
    {cfg.article&&(edit||hasBody)&&<section className="interview-text" id="texto" data-reveal>
      <div className="ficha-filmography-head"><div className="ficha-section-label"><span>01</span> CUERPO DEL ARTÍCULO</div>{item.subtitle&&<span>POR {item.subtitle.toUpperCase()}</span>}</div>
      <div className="interview-text-body">{body}</div>
    </section>}
    {hasPdf&&<section className="press-pdf" id="documento" data-reveal>
      <div className="ficha-filmography-head"><div className="ficha-section-label">DOCUMENTO DIGITALIZADO</div><div className="press-pdf-links"><a href={extra.media} download={`${item.title}.pdf`} target="_blank" rel="noreferrer"><Download/> Descargar PDF</a><a href={extra.media} target="_blank" rel="noreferrer">Abrir en otra pestaña <ArrowRight/></a></div></div>
      <PdfViewer url={extra.media} title={item.title}/>
    </section>}
    {/* Artículo: las películas referenciadas, con enlace a sus fichas */}
    {cfg.article&&(edit||related.some(r=>r.type==='Película'))&&<section className="doc-footer is-single" data-reveal>
      <div className="doc-footer-main"><RelatedList related={related.filter(r=>r.type==='Película')} title="Películas referenciadas"/>
        {!related.some(r=>r.type==='Película')&&edit&&<p className="ficha-filmography-empty">Vincula las películas desde el panel de la derecha.</p>}</div>
    </section>}
    </div>{aside}</div>
    {open&&<div className="press-lightbox" role="dialog" aria-modal="true" aria-label={shown.caption||shown.alt} onClick={()=>setZoom(null)}>
      <figure onClick={e=>e.stopPropagation()}>
        <img src={shown.src} alt={shown.caption||shown.alt}/>
        <figcaption><span>{zoom+1} / {gallery.length}</span>{shown.caption&&<strong>{shown.caption}</strong>}{shown.to&&<Link to={shown.to} onClick={()=>setZoom(null)}>Ver ficha <ArrowRight/></Link>}</figcaption>
      </figure>
      <button type="button" className="press-lightbox-close" aria-label="Cerrar" onClick={()=>setZoom(null)}><X/></button>
      {gallery.length>1&&<>
        <button type="button" className="press-lightbox-nav is-prev" aria-label="Imagen anterior" onClick={e=>{e.stopPropagation();step(-1)}}><ChevronLeft/></button>
        <button type="button" className="press-lightbox-nav is-next" aria-label="Imagen siguiente" onClick={e=>{e.stopPropagation();step(1)}}><ChevronRight/></button>
      </>}
    </div>}
  </main>;
}
