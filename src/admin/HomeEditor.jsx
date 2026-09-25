import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, ImagePlus, Layers, Maximize2, Minimize2, Plus, RotateCcw, Star, Trash2, X } from 'lucide-react';
import { heroSlides, homeContent, records, site } from '../data';
import { HOME_SECTIONS, HomeEditContext, rich } from '../home';
import { getPath } from '../site-text';
import { originalHome, setData, useStoreVersion } from '../store';
import { EditorShell, PanelBlock, useAdminNav } from './AdminApp';
import { Choice, Editable, ImagePicker, RecordPicker, thumb, useUi } from './fields';
import { SiteFrame } from './SiteFrame';
import { slideFromRecord, slideLinkOptions } from './meta';

// Copia el objeto solo a lo largo de la ruta modificada
function setPath(obj,path,value){
  const [k,...rest]=path.split('.');
  const copy=Array.isArray(obj)?[...obj]:{...obj};
  copy[k]=rest.length?setPath(obj[k],rest.join('.'),value):value;
  return copy;
}
const ORIGINAL=originalHome();
const BLANK_SLIDE={eyebrow:'NUEVA SECCIÓN',title:'Escribe aquí\nel título',em:'destacado.',desc:'',image:'',alt:'',link:'/archivo'};
const isMultiline=(path,value)=>/\n/.test(String(getPath(ORIGINAL,path)??value??''))||/(Title|Text|desc|title|text)$/.test(path);

function HomeImageButton({label,className,value,fallback,onChange,aspect}){
  const [open,setOpen]=useState(false);
  return <>
    <button type="button" className={`home-edit-img ${className||''}`} onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(true)}}><ImagePlus/> {label}</button>
    {open&&<ImagePicker value={value||fallback} aspect={aspect} onPick={onChange} onRemove={fallback&&value?()=>onChange(''):undefined} onClose={()=>setOpen(false)}/>}
  </>;
}

export function HomeEditor(){
  useStoreVersion();
  const {go,setDirty:setNavDirty}=useAdminNav(), {toast,confirm}=useUi();
  const load=()=>({...structuredClone(homeContent),slides:structuredClone(heroSlides),featuredId:site.featuredId});
  const [draft,setDraft]=useState(load), [dirty,setDirty]=useState(false), [picker,setPicker]=useState(null);
  const [slide,setSlide]=useState(0), [real,setReal]=useState(false), [openSec,setOpenSec]=useState('hero');
  const frameApi=useRef(null);
  const set=(path,value)=>{setDraft(d=>setPath(d,path,value));setDirty(true)};

  const edit={
    content:draft, slide:Math.min(slide,draft.slides.length-1), setSlide,
    text:(path,{as='span',vars,em}={})=>{
      const value=getPath(draft,path);
      return <Editable key={path} as={as} value={value} onChange={v=>set(path,v)} multiline={isMultiline(path,value)}
        render={v=>rich(v,{vars,em})} placeholder="Escribe aquí…" label="Texto"/>;
    },
    image:(path,{label,className,fallback,aspect})=><HomeImageButton key={path} label={label} className={className} value={getPath(draft,path)} fallback={fallback} aspect={aspect} onChange={v=>set(path,v)}/>
  };

  const save=async()=>{
    const {slides,featuredId,...content}=draft;
    const bad=slides.findIndex(x=>!x.image||!String(x.title||'').trim());
    if(bad>=0){setSlide(bad);reveal('.hero-new');return toast(`La diapositiva ${bad+1} necesita ${slides[bad].image?'un título':'una foto'} antes de guardar.`,'error')}
    try{await setData({homeContent:content,heroSlides:slides,site:{...site,featuredId}})}catch{return toast('No se pudo guardar.','error')}
    setDirty(false);setNavDirty(false);toast('Inicio actualizado y publicado.');
  };
  const discard=async()=>{if(await confirm({title:'¿Descartar los cambios?',text:'El inicio volverá a su última versión guardada.',ok:'Descartar'})){setDraft(load());setDirty(false)}};
  const restore=async()=>{if(await confirm({title:'¿Volver a los textos originales?',text:'Se reemplazan los textos, secciones y fichas elegidas del inicio y del pie de página por los originales. Las diapositivas no cambian. Podrás revisarlo antes de guardar.',ok:'Restablecer textos'})){setDraft(d=>({...originalHome(),slides:d.slides,featuredId:d.featuredId}));setDirty(true)}};

  // Lleva la vista previa hasta una sección
  const reveal=selector=>frameApi.current?.reveal(selector);

  const hidden=draft.hidden||[];
  const toggle=id=>set('hidden',hidden.includes(id)?hidden.filter(x=>x!==id):[...hidden,id]);
  const featured=records.find(r=>r.id===draft.featuredId);
  const latestIds=draft.latestIds||[];
  const latest=latestIds.map(id=>records.find(r=>r.id===id)).filter(Boolean);
  const moveLatest=(i,d)=>{const l=[...latestIds];[l[i],l[i+d]]=[l[i+d],l[i]];set('latestIds',l)};
  const current=edit.slide, cs=draft.slides[current];

  // Diapositivas: se agregan, ordenan y quitan en el borrador, y se publican con «Guardar»
  const selectSlide=i=>{setSlide(i);reveal('.hero-new')};
  const addSlide=s=>{set('slides',[...draft.slides,s]);selectSlide(draft.slides.length)};
  const moveSlide=d=>{const l=[...draft.slides],to=current+d;[l[current],l[to]]=[l[to],l[current]];set('slides',l);setSlide(to)};
  const removeSlide=async()=>{
    if(draft.slides.length<=1)return toast('El carrusel necesita al menos una diapositiva.','error');
    if(!await confirm({title:'¿Quitar esta diapositiva?',text:`“${cs.title.replace(/\n/g,' ')}” dejará de mostrarse al guardar.`,ok:'Quitar',danger:true}))return;
    set('slides',draft.slides.filter((_,i)=>i!==current));setSlide(Math.max(0,current-1));
  };
  const linked=records.find(r=>r.id===cs.recordId);
  const help=text=><p className="cms-help">{text}</p>;

  // El panel sigue el orden de la página: cada sección con su ojo (mostrar u ocultar) y sus opciones
  const sections=[
    {id:'hero',label:'Portada · carrusel',selector:'.hero-new',body:<>
      <div className="cms-slide-picker">{draft.slides.map((x,i)=><button key={i} type="button" className={i===current?'active':''} onClick={()=>selectSlide(i)} title={`${x.title.replace(/\n/g,' ')} ${x.em}`}>
        {x.image?<img src={thumb(x.image,200)} alt=""/>:<span className="cms-thumb-empty"/>}<b>{String(i+1).padStart(2,'0')}</b>
      </button>)}</div>
      <div className="cms-inline-actions">
        <button type="button" className="cms-btn" onClick={()=>addSlide(BLANK_SLIDE)}><Plus/> Nueva</button>
        <button type="button" className="cms-btn" onClick={()=>setPicker('newSlide')}><Layers/> Desde una ficha</button>
      </div>
      <div className="cms-subblock">
        <div className="cms-subblock-head"><strong>Diapositiva {current+1}</strong>
          <span>
            <button type="button" className="cms-icon-btn" disabled={current===0} onClick={()=>moveSlide(-1)} aria-label="Mover antes" title="Mover antes"><ArrowUp/></button>
            <button type="button" className="cms-icon-btn" disabled={current===draft.slides.length-1} onClick={()=>moveSlide(1)} aria-label="Mover después" title="Mover después"><ArrowDown/></button>
            <button type="button" className="cms-icon-btn is-danger-text" onClick={removeSlide} aria-label="Quitar diapositiva" title="Quitar diapositiva"><Trash2/></button>
          </span>
        </div>
        <label className="cms-panel-label">Qué muestra</label>
        {linked?<div className="cms-pick-card"><img src={thumb(linked.image,160)} alt=""/><span><strong>{linked.title}</strong><small>Ficha · {linked.type} · {linked.year}</small></span></div>:help('Textos e imagen propios.')}
        <button type="button" className="cms-btn is-block" onClick={()=>setPicker('slide')}><Layers/> {linked?'Mostrar otra ficha':'Mostrar una ficha del archivo'}</button>
        {linked&&<button type="button" className="cms-btn is-ghost is-block" onClick={()=>set(`slides.${current}`,slideFromRecord(linked))}><RotateCcw/> Volver a los datos de la ficha</button>}
        <label className="cms-panel-label">El botón «{draft.heroCta||'Explorar'}» lleva a</label>
        <Choice value={cs.link} options={slideLinkOptions()} onChange={v=>set(`slides.${current}.link`,v)}/>
        <label className="cms-panel-label">Descripción de la foto</label>
        <Editable className="cms-panel-edit" value={cs.alt} onChange={v=>set(`slides.${current}.alt`,v)} placeholder="Para lectores de pantalla" label="Descripción de la foto"/>
      </div>
    </>},
    {id:'search',body:<>
      <label className="cms-panel-label">Texto de ayuda dentro de la caja</label>
      <Editable className="cms-panel-edit" value={draft.searchPlaceholder} onChange={v=>set('searchPlaceholder',v)} label="Texto del buscador"/>
    </>},
    {id:'stats',body:help('Los números se calculan solos. Los textos se editan con clic en la vista previa.')},
    {id:'discovery',body:help('Títulos y textos editables con clic en la vista previa.')},
    {id:'portal',body:help('Títulos y textos editables con clic en la vista previa.')},
    {id:'spotlight',body:<>
      {featured&&<div className="cms-pick-card"><img src={thumb(draft.spotlightImage||featured.image,160)} alt=""/><span><strong>{featured.title}</strong><small>{featured.type} · {featured.year}</small></span></div>}
      <button type="button" className="cms-btn is-block" onClick={()=>setPicker('featured')}><Star/> Elegir otra ficha</button>
      {draft.spotlightImage&&<button type="button" className="cms-btn is-ghost is-block" onClick={()=>set('spotlightImage','')}><RotateCcw/> Usar la imagen de la ficha</button>}
    </>},
    {id:'latest',body:<>
      <div className="cms-segment is-small cms-seg-block">
        <button type="button" className={!latestIds.length?'active':''} onClick={()=>set('latestIds',[])}>Automático</button>
        <button type="button" className={latestIds.length?'active':''} onClick={()=>!latestIds.length&&set('latestIds',records.slice(0,4).map(r=>r.id))}>Elegir fichas</button>
      </div>
      {!latestIds.length?help('Muestra las primeras 4 fichas del archivo.'):<>
        <ul className="cms-mini-list cms-latest">{latest.map((r,i)=><li key={r.id}>
          <img src={thumb(r.image,120)} alt=""/><span>{r.title}<small>{r.type}</small></span>
          <button type="button" className="cms-icon-btn" disabled={i===0} onClick={()=>moveLatest(i,-1)} aria-label="Subir"><ArrowUp/></button>
          <button type="button" className="cms-icon-btn" disabled={i===latest.length-1} onClick={()=>moveLatest(i,1)} aria-label="Bajar"><ArrowDown/></button>
          <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>set('latestIds',latestIds.filter(x=>x!==r.id))} aria-label="Quitar"><X/></button>
        </li>)}</ul>
        {latestIds.length<8&&<button type="button" className="cms-btn is-block" onClick={()=>setPicker('latest')}><Plus/> Añadir ficha</button>}
      </>}
    </>},
    {id:'manifesto',body:help('La frase y la firma se editan con clic en la vista previa.')},
    {id:'footer',label:'Pie de página · todas las páginas',selector:'footer',body:<>
      {help('Sus textos se editan con clic en la vista previa. Aquí van los datos de contacto.')}
      <label className="cms-panel-label">Correo de contacto</label>
      <Editable className="cms-panel-edit" type="email" value={draft.footerEmail} onChange={v=>set('footerEmail',v)} placeholder="correo@dominio.cl" label="Correo de contacto"/>
      <label className="cms-panel-label">Enlace de Instagram</label>
      <Editable className="cms-panel-edit" value={draft.footerInstagram} onChange={v=>set('footerInstagram',v)} placeholder="https://instagram.com/…" label="Enlace de Instagram"/>
    </>}
  ].map(s=>{const label=s.label||HOME_SECTIONS.find(([k])=>k===s.id)[1];return {...s,label,selector:s.selector||`[data-edit="${label}"]`,canHide:!s.selector}});

  const panel=<>
    <PanelBlock title="Cómo escribir">
      <ul className="cms-tips">
        <li>Clic en un texto de la vista previa para cambiarlo</li>
        <li>Enter → salto de línea · clic fuera para terminar</li>
        <li>Entre asteriscos → <em>cursiva destacada</em>: <code>*palabra*</code></li>
      </ul>
    </PanelBlock>
    <div className="cms-hsecs">{sections.map(s=>{const off=s.canHide&&hidden.includes(s.id), isOpen=openSec===s.id;return <section key={s.id} className={`cms-hsec${isOpen?' is-open':''}${off?' is-off':''}`}>
      <div className="cms-hsec-head">
        <button type="button" className="cms-hsec-toggle" onClick={()=>{setOpenSec(isOpen?null:s.id);if(!isOpen)reveal(s.selector)}} aria-expanded={isOpen}><ChevronDown/><span>{s.label}</span>{off&&<small>Oculta</small>}</button>
        {s.canHide&&<button type="button" className="cms-toggle-eye" onClick={()=>toggle(s.id)} aria-pressed={!off} title={off?'Mostrar en el sitio':'Ocultar en el sitio'}>{off?<EyeOff/>:<Eye/>}</button>}
      </div>
      {isOpen&&<div className="cms-hsec-body">{s.body}</div>}
    </section>})}</div>
    <div className="cms-panel-block cms-danger-zone">
      <div className="cms-panel-title"><span>Zona de peligro</span></div>
      <button type="button" className="cms-btn is-block is-danger-outline" onClick={restore}><RotateCcw/> Volver a los textos originales</button>
    </div>
  </>;

  return <EditorShell crumb="Página de inicio" title="Inicio y carrusel" dirty={dirty} onBack={()=>go('/admin')} onSave={save} onDiscard={discard} viewHref="/" panel={panel}
    hint="Es la página real: clic en cualquier texto para reescribirlo, o en los botones negros sobre las fotos para cambiarlas.">
    <div className="cms-frame-tools">
      <div className="cms-segment is-small">
        <button type="button" className={!real?'active':''} onClick={()=>setReal(false)}><Minimize2/> Ajustar al ancho</button>
        <button type="button" className={real?'active':''} onClick={()=>setReal(true)}><Maximize2/> Tamaño real</button>
      </div>
      <span>Diapositiva {current+1} de {draft.slides.length}</span>
    </div>
    <HomeEditContext.Provider value={edit}>
      <SiteFrame className="is-home" apiRef={frameApi} real={real}/>
    </HomeEditContext.Provider>
    {picker==='featured'&&<RecordPicker title="Elegir pieza destacada" action="Elegir" exclude={[draft.featuredId]} onPick={r=>set('featuredId',r.id)} onClose={()=>setPicker(null)}/>}
    {picker==='newSlide'&&<RecordPicker title="Añadir una ficha al carrusel" action="Añadir" exclude={draft.slides.map(x=>x.recordId).filter(Boolean)} onPick={r=>addSlide(slideFromRecord(r))} onClose={()=>setPicker(null)}/>}
    {picker==='slide'&&<RecordPicker title={`Mostrar una ficha en la diapositiva ${current+1}`} action="Usar" exclude={draft.slides.map(x=>x.recordId).filter(Boolean)} onPick={r=>set(`slides.${current}`,slideFromRecord(r))} onClose={()=>setPicker(null)}/>}
    {picker==='latest'&&<RecordPicker title="Añadir a «Recién catalogado»" action="Añadir" exclude={latestIds} onPick={r=>set('latestIds',[...latestIds,r.id])} onClose={()=>setPicker(null)}/>}
  </EditorShell>;
}
