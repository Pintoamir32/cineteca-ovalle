import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowUpRight, BookOpen, CalendarRange, Check, CircleCheck, Database, Download, ExternalLink, FileText, Film, Home, Images, Layers, LayoutDashboard, MapPin, Menu, Mic2, Palette, Plus, RotateCcw, Save, Search, Trash2, Upload, UserRound, X } from 'lucide-react';
import { Brand } from '../components';
import { collections, heroSlides, locations, recordExtras, records, timelineEvents } from '../data';
import { exportData, getLastSaved, importData, resetData, storageEstimate, useStoreVersion } from '../store';
import { UiProvider, formatBytes, thumb, useUi } from './fields';
import { TYPE_META, TYPES, code, extraOf, missingFields, typeBySlug, typeColor } from './meta';
import { RecordEditor } from './RecordEditor';
import { CollectionEditor, CollectionList, HomeManager, LocationEditor, LocationList, SlideEditor, TimelineEditor, TimelineList } from './SiteEditors';
import { HomeEditor } from './HomeEditor';
import { ThemeEditor } from './ThemeEditor';
import './admin.css';

const TYPE_ICONS={Película:Film,Persona:UserRound,Prensa:FileText,Entrevista:Mic2,Artículo:BookOpen};

/* ---------- Navegación con aviso de cambios sin guardar ---------- */

const NavContext=createContext(null);
export const useAdminNav=()=>useContext(NavContext);

export default function AdminApp(){
  return <UiProvider><AdminShell/></UiProvider>;
}

function AdminShell(){
  useStoreVersion();
  const navigate=useNavigate(), location=useLocation(), {confirm}=useUi();
  const dirty=useRef(false), [menu,setMenu]=useState(false);
  const go=async to=>{
    if(dirty.current&&!await confirm({title:'¿Salir sin guardar?',text:'Tienes cambios sin guardar. Si sales ahora se perderán.',ok:'Salir sin guardar',danger:true}))return;
    dirty.current=false;setMenu(false);navigate(to);
  };
  const nav=useMemo(()=>({go,setDirty:v=>{dirty.current=v}}),[]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const onUnload=e=>{if(dirty.current){e.preventDefault();e.returnValue=''}};
    window.addEventListener('beforeunload',onUnload);return()=>window.removeEventListener('beforeunload',onUnload);
  },[]);
  useEffect(()=>{document.title='Gestión · Cineteca de Ovalle'},[]);
  const path=location.pathname.replace(/^\/admin\/?/,'');
  const item=(to,Icon,label,count)=>{
    const active=to===''?path==='':path===to||path.startsWith(`${to}/`);
    return <button key={to} type="button" className={active?'active':''} onClick={()=>go(`/admin/${to}`)}><Icon/><span>{label}</span>{count!==undefined&&<b>{count}</b>}</button>;
  };
  return <NavContext.Provider value={nav}>
    <div className="cms">
      <aside className={`cms-side ${menu?'is-open':''}`}>
        <div className="cms-side-top"><Brand/><button type="button" className="cms-icon-btn cms-menu-btn" onClick={()=>setMenu(!menu)} aria-label="Menú">{menu?<X/>:<Menu/>}</button></div>
        <nav>
          {item('',LayoutDashboard,'Resumen')}
          <small>ARCHIVO</small>
          {TYPES.map(t=>item(`registros/${TYPE_META[t].slug}`,TYPE_ICONS[t],TYPE_META[t].label,records.filter(r=>r.type===t).length))}
          <small>SITIO</small>
          {item('inicio',Home,'Inicio')}
          {item('portada',Images,'Diapositivas',heroSlides.length)}
          {item('colecciones',Layers,'Colecciones',collections.length)}
          {item('linea-de-tiempo',CalendarRange,'Línea de tiempo',timelineEvents.length)}
          {item('comunas',MapPin,'Comunas y mapa',locations.length)}
          {item('colores',Palette,'Colores')}
          <small>DATOS</small>
          {item('respaldo',Database,'Respaldo')}
        </nav>
        <a className="cms-side-site" href="/" target="_blank" rel="noreferrer"><ExternalLink/> Ver sitio público</a>
      </aside>
      <main className="cms-main">
        <Routes>
          <Route index element={<Dashboard/>}/>
          <Route path="registros/:slug" element={<RecordList/>}/>
          <Route path="registros/:slug/:id" element={<RecordEditor/>}/>
          <Route path="inicio" element={<HomeEditor/>}/>
          <Route path="colores" element={<ThemeEditor/>}/>
          <Route path="portada" element={<HomeManager/>}/>
          <Route path="portada/:index" element={<SlideEditor/>}/>
          <Route path="colecciones" element={<CollectionList/>}/>
          <Route path="colecciones/:index" element={<CollectionEditor/>}/>
          <Route path="linea-de-tiempo" element={<TimelineList/>}/>
          <Route path="linea-de-tiempo/:index" element={<TimelineEditor/>}/>
          <Route path="comunas" element={<LocationList/>}/>
          <Route path="comunas/:index" element={<LocationEditor/>}/>
          <Route path="respaldo" element={<Backup/>}/>
          <Route path="*" element={<Dashboard/>}/>
        </Routes>
      </main>
    </div>
  </NavContext.Provider>;
}

/* ---------- Piezas compartidas ---------- */

export function PageHead({eyebrow,title,children,desc}){
  return <header className="cms-head"><div><span>{eyebrow}</span><h1>{title}</h1>{desc&&<p>{desc}</p>}</div><div className="cms-head-actions">{children}</div></header>;
}

const savedLabel=()=>{
  const d=getLastSaved();
  return d?`Guardado ${new Date(d).toLocaleString('es-CL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`:'Sin cambios guardados todavía';
};

// Barra superior y distribución de todos los editores
export function EditorShell({crumb,title,isNew,dirty,onBack,onSave,onDiscard,onDelete,viewHref,panel,children,hint='Haz clic sobre cualquier texto o imagen de la vista previa para cambiarlo.'}){
  const {setDirty}=useAdminNav();
  const saveRef=useRef(onSave);saveRef.current=onSave;
  useEffect(()=>{setDirty(dirty)},[dirty,setDirty]);
  useEffect(()=>()=>setDirty(false),[setDirty]);
  useEffect(()=>{
    const onKey=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveRef.current()}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);
  return <div className="cms-editor">
    <div className="cms-editor-bar">
      <button type="button" className="cms-icon-btn" onClick={onBack} aria-label="Volver"><ArrowLeft/></button>
      <div className="cms-editor-title"><small>{crumb}</small><strong>{title||'Sin título'}</strong></div>
      <span className={`cms-status ${isNew?'is-new':dirty?'is-dirty':''}`}>{isNew?'Nuevo · sin publicar':dirty?'Cambios sin guardar':'Guardado'}</span>
      <div className="cms-editor-actions">
        {viewHref&&!isNew&&<a className="cms-btn is-ghost" href={viewHref} target="_blank" rel="noreferrer"><ArrowUpRight/> <span>Ver en el sitio</span></a>}
        {onDelete&&!isNew&&<button type="button" className="cms-btn is-ghost is-danger-text" onClick={onDelete}><Trash2/> <span>Eliminar</span></button>}
        {dirty&&!isNew&&<button type="button" className="cms-btn is-ghost" onClick={onDiscard}><RotateCcw/> <span>Descartar</span></button>}
        <button type="button" className="cms-btn is-primary" onClick={onSave} disabled={!dirty&&!isNew} title="Ctrl + S"><Save/> {isNew?'Publicar':'Guardar'}</button>
      </div>
    </div>
    <div className="cms-editor-body">
      <section className="cms-canvas">
        <p className="cms-canvas-hint"><span>VISTA PREVIA</span>{hint}</p>
        {children}
      </section>
      {panel&&<aside className="cms-panel">{panel}</aside>}
    </div>
  </div>;
}

export function PanelBlock({title,children,aside}){
  return <div className="cms-panel-block"><div className="cms-panel-title"><span>{title}</span>{aside}</div>{children}</div>;
}

/* ---------- Resumen ---------- */

function Dashboard(){
  const {go}=useAdminNav();
  const [storage,setStorage]=useState(null);
  useEffect(()=>{storageEstimate().then(setStorage)},[]);
  const pending=records.map(r=>({r,miss:missingFields(r)})).filter(x=>x.miss.length);
  const recent=[...records].filter(r=>r.updatedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6);
  const media=Object.values(recordExtras).filter(e=>e.media).length;
  const max=Math.max(...TYPES.map(t=>records.filter(r=>r.type===t).length));
  const today=new Date().toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return <div className="cms-page">
    <PageHead eyebrow={today.toUpperCase()} title="Gestión del archivo" desc="Todo lo que se publica en el sitio se edita desde aquí.">
      <NewRecordMenu/>
    </PageHead>
    <div className="cms-kpis">
      <article><span>Registros</span><strong>{records.length}</strong><small>en {TYPES.length} secciones</small></article>
      <article className={pending.length?'is-warn':'is-ok'}><span>Por completar</span><strong>{pending.length}</strong><small>{pending.length?'fichas con datos faltantes':'todo al día'}</small></article>
      <article><span>Archivos digitales</span><strong>{media}</strong><small>videos, audios y documentos</small></article>
      <article><span>Espacio usado</span><strong>{storage?formatBytes(storage.usage||0):'—'}</strong><small>{savedLabel()}</small></article>
    </div>
    <div className="cms-dash-grid">
      <section className="cms-card">
        <div className="cms-card-head"><h2>Secciones del archivo</h2></div>
        <div className="cms-type-bars">{TYPES.map(t=>{const Icon=TYPE_ICONS[t], n=records.filter(r=>r.type===t).length;return <button type="button" key={t} onClick={()=>go(`/admin/registros/${TYPE_META[t].slug}`)}>
          <Icon/><span>{TYPE_META[t].label}</span><i><em style={{width:`${n/max*100}%`,background:typeColor(t)}}/></i><b>{n}</b>
        </button>})}</div>
        <div className="cms-quick">
          <button type="button" onClick={()=>go('/admin/inicio')}><Home/> Inicio</button>
          <button type="button" onClick={()=>go('/admin/colores')}><Palette/> Colores</button>
          <button type="button" onClick={()=>go('/admin/portada')}><Images/> Diapositivas</button>
          <button type="button" onClick={()=>go('/admin/colecciones')}><Layers/> Colecciones</button>
          <button type="button" onClick={()=>go('/admin/linea-de-tiempo')}><CalendarRange/> Línea de tiempo</button>
          <button type="button" onClick={()=>go('/admin/comunas')}><MapPin/> Comunas</button>
        </div>
      </section>
      <section className="cms-card">
        <div className="cms-card-head"><h2>Por completar</h2><span>{pending.length}</span></div>
        {pending.length?<ul className="cms-rows">{pending.slice(0,7).map(({r,miss})=><li key={r.id}><button type="button" onClick={()=>go(`/admin/registros/${r.slug}/${r.id}`)}>
          {r.image?<img src={thumb(r.image,120)} alt=""/>:<span className="cms-thumb-empty"/>}
          <span><strong>{r.title||'Sin título'}</strong><small>Falta: {miss.join(', ')}</small></span><AlertCircle className="cms-warn-icon"/>
        </button></li>)}</ul>:<p className="cms-empty"><CircleCheck/> Todas las fichas tienen sus datos principales.</p>}
      </section>
      <section className="cms-card">
        <div className="cms-card-head"><h2>Editado recientemente</h2></div>
        {recent.length?<ul className="cms-rows">{recent.map(r=><li key={r.id}><button type="button" onClick={()=>go(`/admin/registros/${r.slug}/${r.id}`)}>
          <img src={thumb(r.image,120)} alt=""/><span><strong>{r.title}</strong><small>{r.type} · {new Date(r.updatedAt).toLocaleString('es-CL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></span><ArrowUpRight/>
        </button></li>)}</ul>:<p className="cms-empty">Aún no has editado fichas. Elige una sección para comenzar.</p>}
      </section>
    </div>
  </div>;
}

function NewRecordMenu({type}){
  const {go}=useAdminNav(), [open,setOpen]=useState(false), ref=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const onDown=e=>{if(!ref.current?.contains(e.target))setOpen(false)};
    document.addEventListener('mousedown',onDown);return()=>document.removeEventListener('mousedown',onDown);
  },[open]);
  if(type)return <button type="button" className="cms-btn is-primary" onClick={()=>go(`/admin/registros/${TYPE_META[type].slug}/nuevo`)}><Plus/> {TYPE_META[type].newLabel}</button>;
  return <div className="cms-new" ref={ref}>
    <button type="button" className="cms-btn is-primary" onClick={()=>setOpen(!open)}><Plus/> Nuevo registro</button>
    {open&&<div className="cms-new-menu">{TYPES.map(t=>{const Icon=TYPE_ICONS[t];return <button key={t} type="button" onClick={()=>go(`/admin/registros/${TYPE_META[t].slug}/nuevo`)}><Icon/>{t}</button>})}</div>}
  </div>;
}

/* ---------- Listado de registros ---------- */

function RecordList(){
  const {slug}=useParams(), type=typeBySlug(slug), {go}=useAdminNav();
  const [q,setQ]=useState(''), [sort,setSort]=useState('recent'), [onlyPending,setOnlyPending]=useState(false);
  if(!type)return <Dashboard/>;
  const meta=TYPE_META[type];
  const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  let list=records.filter(r=>r.type===type&&fold(`${r.title} ${r.subtitle} ${r.year} ${r.collection}`).includes(fold(q)));
  if(onlyPending)list=list.filter(r=>missingFields(r).length);
  list=[...list].sort(sort==='title'?(a,b)=>a.title.localeCompare(b.title,'es'):sort==='year'?(a,b)=>String(a.year).localeCompare(String(b.year)):(a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')||b.id-a.id);
  return <div className="cms-page">
    <PageHead eyebrow="ARCHIVO" title={meta.label} desc={`${records.filter(r=>r.type===type).length} registros publicados. Haz clic en una ficha para editarla.`}><NewRecordMenu type={type}/></PageHead>
    <div className="cms-toolbar">
      <label className="cms-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={`Buscar en ${meta.label.toLowerCase()}…`}/>{q&&<button type="button" onClick={()=>setQ('')} aria-label="Limpiar"><X/></button>}</label>
      <div className="cms-segment is-small">{[['recent','Recientes'],['title','A–Z'],['year','Año']].map(([k,l])=><button key={k} type="button" className={sort===k?'active':''} onClick={()=>setSort(k)}>{l}</button>)}</div>
      <button type="button" className={`cms-chip ${onlyPending?'active':''}`} onClick={()=>setOnlyPending(!onlyPending)}><AlertCircle/> Por completar</button>
    </div>
    <div className="cms-grid">
      <button type="button" className="cms-tile cms-tile-new" onClick={()=>go(`/admin/registros/${slug}/nuevo`)}><Plus/><span>Añadir {meta.one}</span></button>
      {list.map(r=>{const miss=missingFields(r,extraOf(r.id));return <button type="button" key={r.id} className="cms-tile" onClick={()=>go(`/admin/registros/${slug}/${r.id}`)}>
        <div className="cms-tile-img">{r.image?<img src={thumb(r.image,480)} alt="" loading="lazy"/>:<span className="cms-thumb-empty"/>}<span className="cms-tag" style={{background:r.color}}>{r.type}</span>{miss.length>0&&<span className="cms-tile-warn" title={`Falta: ${miss.join(', ')}`}><AlertCircle/> {miss.length}</span>}</div>
        <div className="cms-tile-body"><small>{code(r.id)} · {r.year}</small><strong>{r.title||'Sin título'}</strong><span>{r.subtitle}</span></div>
      </button>})}
    </div>
    {!list.length&&<p className="cms-empty">No hay registros que coincidan.</p>}
  </div>;
}

/* ---------- Respaldo ---------- */

function Backup(){
  const {toast,confirm}=useUi(), inputRef=useRef(null);
  const [storage,setStorage]=useState(null);
  useEffect(()=>{storageEstimate().then(setStorage)},[]);
  const onImport=async file=>{
    if(!file)return;
    if(!await confirm({title:'¿Reemplazar los datos actuales?',text:`Se cargará “${file.name}” y reemplazará todo el contenido del archivo. Te recomendamos exportar un respaldo antes.`,ok:'Importar',danger:true}))return;
    try{await importData(file);toast('Respaldo importado correctamente.')}catch(err){toast(err.message,'error')}
    inputRef.current.value='';
  };
  const onReset=async()=>{
    if(!await confirm({title:'¿Restablecer el contenido original?',text:'Se perderán todas las fichas creadas, las imágenes subidas y los cambios hechos desde el gestor.',ok:'Restablecer',danger:true}))return;
    await resetData();toast('Contenido original restablecido.');
  };
  return <div className="cms-page">
    <PageHead eyebrow="DATOS" title="Respaldo" desc="El contenido se guarda en este navegador. Exporta un respaldo con frecuencia para no perder trabajo y para moverlo a otro equipo."/>
    <div className="cms-backup">
      <article className="cms-card"><Download/><h2>Exportar</h2><p>Descarga un archivo con todas las fichas, imágenes subidas, colecciones, línea de tiempo, comunas y portada.</p><button type="button" className="cms-btn is-primary" onClick={()=>{exportData();toast('Respaldo descargado.')}}><Download/> Descargar respaldo</button></article>
      <article className="cms-card"><Upload/><h2>Importar</h2><p>Carga un respaldo exportado antes. Reemplaza el contenido actual por el del archivo.</p><button type="button" className="cms-btn" onClick={()=>inputRef.current.click()}><Upload/> Elegir archivo…</button><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={e=>onImport(e.target.files[0])}/></article>
      <article className="cms-card is-danger"><RotateCcw/><h2>Restablecer</h2><p>Vuelve al contenido original del sitio. Úsalo solo si quieres empezar de cero.</p><button type="button" className="cms-btn is-danger" onClick={onReset}><RotateCcw/> Restablecer todo</button></article>
    </div>
    <p className="cms-help"><Check/> {savedLabel()}{storage?` · Espacio usado: ${formatBytes(storage.usage||0)}`:''}</p>
  </div>;
}
