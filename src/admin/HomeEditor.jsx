import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Images, LocateFixed, Maximize2, Minimize2, Plus, RotateCcw, Star, X } from 'lucide-react';
import { heroSlides, homeContent, records, site } from '../data';
import { HOME_SECTIONS, HomeEditContext, rich } from '../home';
import { getPath } from '../site-text';
import { originalHome, setData, useStoreVersion } from '../store';
import { EditorShell, PanelBlock, useAdminNav } from './AdminApp';
import { Choice, Editable, ImagePicker, RecordPicker, thumb, useUi } from './fields';
import { SiteFrame } from './SiteFrame';

// Copia el objeto solo a lo largo de la ruta modificada
function setPath(obj,path,value){
  const [k,...rest]=path.split('.');
  const copy=Array.isArray(obj)?[...obj]:{...obj};
  copy[k]=rest.length?setPath(obj[k],rest.join('.'),value):value;
  return copy;
}
const ORIGINAL=originalHome();
const isMultiline=(path,value)=>/\n/.test(String(getPath(ORIGINAL,path)??value??''))||/(Title|Text|desc|title|text)$/.test(path);
const LINKS=[['/archivo','Archivo completo'],['/peliculas','Películas'],['/personas','Personas'],['/prensa','Prensa'],['/entrevistas','Entrevistas'],['/articulos','Artículos'],['/colecciones','Colecciones'],['/linea-de-tiempo','Línea de tiempo'],['/mapa','Mapa'],['/nosotros','Sobre la Cineteca']];

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
  const [slide,setSlide]=useState(0), [real,setReal]=useState(false);
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

  const panel=<>
    <PanelBlock title="Portada · diapositiva en edición">
      <div className="cms-slide-picker">{draft.slides.map((x,i)=><button key={i} type="button" className={i===current?'active':''} onClick={()=>{setSlide(i);reveal('.hero-new')}} title={`${x.title.replace(/\n/g,' ')} ${x.em}`}>
        <img src={thumb(x.image,200)} alt=""/><b>{String(i+1).padStart(2,'0')}</b>
      </button>)}</div>
      <label className="cms-panel-label">El botón «{draft.heroCta||'Explorar'}» lleva a</label>
      <Choice value={cs.link} options={LINKS.map(([value,label])=>({value,label:`${label} · ${value}`}))} onChange={v=>set(`slides.${current}.link`,v)}/>
      <label className="cms-panel-label">Descripción de la foto</label>
      <Editable className="cms-panel-edit" value={cs.alt} onChange={v=>set(`slides.${current}.alt`,v)} placeholder="Para lectores de pantalla" label="Descripción de la foto"/>
      <button type="button" className="cms-btn is-block cms-mt" onClick={()=>go('/admin/portada')}><Images/> Añadir, ordenar o quitar</button>
    </PanelBlock>
    <PanelBlock title="Secciones">
      <p className="cms-help">Clic en el nombre para ir a la sección; el ojo la muestra u oculta en el sitio.</p>
      <ul className="cms-toggles">{HOME_SECTIONS.map(([id,label])=>{const off=hidden.includes(id);return <li key={id} className={off?'is-off':''}>
        <button type="button" className="cms-toggle-go" onClick={()=>reveal(`[data-edit="${label}"]`)}><LocateFixed/><span>{label}</span></button>
        <button type="button" className="cms-toggle-eye" onClick={()=>toggle(id)} aria-pressed={!off} title={off?'Mostrar en el sitio':'Ocultar en el sitio'}>{off?<EyeOff/>:<Eye/>}<small>{off?'Oculta':'Visible'}</small></button>
      </li>})}</ul>
    </PanelBlock>
    <PanelBlock title="Pieza destacada">
      {featured&&<div className="cms-pick-card"><img src={thumb(draft.spotlightImage||featured.image,160)} alt=""/><span><strong>{featured.title}</strong><small>{featured.type} · {featured.year}</small></span></div>}
      <button type="button" className="cms-btn is-block" onClick={()=>setPicker('featured')}><Star/> Elegir otra ficha</button>
      {draft.spotlightImage&&<button type="button" className="cms-btn is-ghost is-block" onClick={()=>set('spotlightImage','')}><RotateCcw/> Usar la imagen de la ficha</button>}
    </PanelBlock>
    <PanelBlock title="Recién catalogado">
      <div className="cms-segment is-small cms-seg-block">
        <button type="button" className={!latestIds.length?'active':''} onClick={()=>set('latestIds',[])}>Automático</button>
        <button type="button" className={latestIds.length?'active':''} onClick={()=>!latestIds.length&&set('latestIds',records.slice(0,4).map(r=>r.id))}>Elegir fichas</button>
      </div>
      {!latestIds.length?<p className="cms-help">Muestra las primeras 4 fichas del archivo.</p>:<>
        <ul className="cms-mini-list cms-latest">{latest.map((r,i)=><li key={r.id}>
          <img src={thumb(r.image,120)} alt=""/><span>{r.title}<small>{r.type}</small></span>
          <button type="button" className="cms-icon-btn" disabled={i===0} onClick={()=>moveLatest(i,-1)} aria-label="Subir"><ArrowUp/></button>
          <button type="button" className="cms-icon-btn" disabled={i===latest.length-1} onClick={()=>moveLatest(i,1)} aria-label="Bajar"><ArrowDown/></button>
          <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>set('latestIds',latestIds.filter(x=>x!==r.id))} aria-label="Quitar"><X/></button>
        </li>)}</ul>
        {latestIds.length<8&&<button type="button" className="cms-btn is-block" onClick={()=>setPicker('latest')}><Plus/> Añadir ficha</button>}
      </>}
    </PanelBlock>
    <PanelBlock title="Buscador">
      <label className="cms-panel-label">Texto de ayuda dentro de la caja</label>
      <Editable className="cms-panel-edit" value={draft.searchPlaceholder} onChange={v=>set('searchPlaceholder',v)} label="Texto del buscador"/>
    </PanelBlock>
    <PanelBlock title="Pie de página · todas las páginas">
      <p className="cms-help">Sus textos se editan con clic en la vista previa. Aquí van los datos de contacto.</p>
      <label className="cms-panel-label">Correo de contacto</label>
      <Editable className="cms-panel-edit" type="email" value={draft.footerEmail} onChange={v=>set('footerEmail',v)} placeholder="correo@dominio.cl" label="Correo de contacto"/>
      <label className="cms-panel-label">Enlace de Instagram</label>
      <Editable className="cms-panel-edit" value={draft.footerInstagram} onChange={v=>set('footerInstagram',v)} placeholder="https://instagram.com/…" label="Enlace de Instagram"/>
      <button type="button" className="cms-btn is-ghost is-block cms-mt" onClick={()=>reveal('footer')}><LocateFixed/> Ir al pie de página</button>
    </PanelBlock>
    <PanelBlock title="Formato de los textos">
      <ul className="cms-tips">
        <li><code>*palabra*</code> → <em>cursiva destacada</em></li>
        <li>Enter → salto de línea · Ctrl+Enter o clic fuera para terminar</li>
        <li><code>{'{años}'}</code> → años de historia del archivo</li>
      </ul>
      <button type="button" className="cms-btn is-ghost is-block" onClick={restore}><RotateCcw/> Volver a los textos originales</button>
    </PanelBlock>
  </>;

  return <EditorShell crumb="Sitio · Página de inicio" title="Inicio" dirty={dirty} onBack={()=>go('/admin')} onSave={save} onDiscard={discard} viewHref="/" panel={panel}
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
    {picker==='latest'&&<RecordPicker title="Añadir a «Recién catalogado»" action="Añadir" exclude={latestIds} onPick={r=>set('latestIds',[...latestIds,r.id])} onClose={()=>setPicker(null)}/>}
  </EditorShell>;
}
