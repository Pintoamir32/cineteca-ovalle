import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowUpRight, BookOpen, CalendarRange, Check, CircleCheck, CircleHelp, Database, LogOut, UserPlus, Download, ExternalLink, Eye, EyeOff, FileText, Film, Home, Layers, LayoutDashboard, MapPin, Menu, Mic2, Palette, Plus, RotateCcw, Save, Search, Trash2, Upload, UserRound, X } from 'lucide-react';
import { collections, heroSlides, locations, recordExtras, records, timelineEvents } from '../data';
import { exportData, getLastSaved, hydrate, importData, resetData, setRecordPublished, useStoreVersion } from '../store';
import { tagStyle } from '../color';
import { Modal, UiProvider, thumb, useUi } from './fields';
import { authStatus, changePassword, createUser, listUsers, logout as endSession } from './auth';
import { LoginScreen, PasswordField } from './Login';
import { TYPE_META, TYPES, code, extraOf, missingFields, typeBySlug, typeColor } from './meta';
import { RecordEditor } from './RecordEditor';
import { CollectionEditor, CollectionList, LocationEditor, LocationList, TimelineEditor, TimelineList } from './SiteEditors';
import { HomeEditor } from './HomeEditor';
import { TOURS, Tour, markTourSeen, tourSeen, tourViewOf } from './Tour';
import { ThemeEditor } from './ThemeEditor';
import './admin.css';

const TYPE_ICONS={Película:Film,Persona:UserRound,Prensa:FileText,Entrevista:Mic2,Artículo:BookOpen};

/* ---------- Navegación con aviso de cambios sin guardar ---------- */

const NavContext=createContext(null);
export const useAdminNav=()=>useContext(NavContext);

export default function AdminApp(){
  const [auth,setAuth]=useState({loading:true});
  const check=()=>{
    setAuth({loading:true});
    // Con sesión se vuelve a cargar el contenido: así incluye las fichas en borrador
    authStatus().then(async s=>{if(s.user)await hydrate();setAuth({hasUsers:s.hasUsers,session:s.user})})
      .catch(err=>setAuth({error:err.message}));
  };
  useEffect(check,[]);
  // Si la sesión vence mientras se edita, se vuelve a pedir el inicio de sesión
  useEffect(()=>{
    const onUnauthorized=()=>setAuth(a=>a.session?{hasUsers:true,session:null,expired:true}:a);
    window.addEventListener('cms-unauthorized',onUnauthorized);return()=>window.removeEventListener('cms-unauthorized',onUnauthorized);
  },[]);
  const onLogin=async user=>{await hydrate();setAuth({hasUsers:true,session:user})};
  const onLogout=async()=>{await endSession();await hydrate();setAuth({hasUsers:true,session:null})};
  let screen;
  if(auth.loading)screen=<div className="login"><p className="login-wait">Cargando el gestor…</p></div>;
  else if(auth.error)screen=<div className="login"><div className="login-card"><h1>Sin conexión</h1><p className="login-lead">{auth.error}</p><button type="button" className="login-submit" onClick={check}>Reintentar</button></div></div>;
  else if(auth.session)screen=<AdminShell session={auth.session} onLogout={onLogout}/>;
  else screen=<LoginScreen setup={!auth.hasUsers} expired={auth.expired} onLogin={onLogin}/>;
  return <UiProvider>{screen}</UiProvider>;
}

function AdminShell({session,onLogout}){
  useStoreVersion();
  const navigate=useNavigate(), location=useLocation(), {confirm}=useUi();
  const dirty=useRef(false), [menu,setMenu]=useState(false), [account,setAccount]=useState(false);
  useEffect(()=>{
    const onConflict=async()=>{
      if(await confirm({title:'Otra persona guardó cambios',text:'Mientras editabas, alguien más guardó el contenido. Para no borrar su trabajo, tu último cambio no se guardó. Recarga la página para ver la versión más reciente y vuelve a hacer tu cambio.',ok:'Recargar ahora',cancel:'Más tarde'})){dirty.current=false;location.reload()}
    };
    window.addEventListener('cms-conflict',onConflict);return()=>window.removeEventListener('cms-conflict',onConflict);
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  const logout=async()=>{
    if(dirty.current&&!await confirm({title:'¿Cerrar sesión sin guardar?',text:'Tienes cambios sin guardar. Si cierras la sesión ahora se perderán.',ok:'Cerrar sesión',danger:true}))return;
    dirty.current=false;onLogout();
  };
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
  // En pantallas angostas el menú se cierra con Esc
  useEffect(()=>{if(!menu)return;const onKey=e=>{if(e.key==='Escape')setMenu(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[menu]);
  const path=location.pathname.replace(/^\/admin\/?/,'');
  // La sección activa siempre queda a la vista dentro de la lista del menú
  useEffect(()=>{document.querySelector('.cms-side-nav [aria-current="page"]')?.scrollIntoView({block:'nearest'})},[path,menu]);
  // Tutorial: se abre solo la primera vez en cada pantalla; el botón «Tutorial» lo repite
  const view=tourViewOf(path), [tour,setTour]=useState(null);
  const openTour=v=>{
    const steps=(TOURS[v]||[]).filter(st=>!st.target||document.querySelector(st.target));
    if(steps.length)setTour({view:v,steps});
  };
  useEffect(()=>{
    setTour(null);
    if(tourSeen(view,session.id))return;
    const t=setTimeout(()=>{if(!document.querySelector('.cms-modal-layer'))openTour(view)},900);
    return()=>clearTimeout(t);
  },[view,session.id]);// eslint-disable-line react-hooks/exhaustive-deps
  const closeTour=()=>{markTourSeen(tour.view,session.id);setTour(null)};
  const helpBtn=cls=><button type="button" className={cls} onClick={()=>{setMenu(false);openTour(view)}} title="Ver el tutorial de esta pantalla"><CircleHelp/><span>Tutorial</span></button>;
  const item=(to,Icon,label,count)=>{
    const active=to===''?path==='':path===to||path.startsWith(`${to}/`);
    return <button key={to} type="button" className={active?'active':''} aria-current={active?'page':undefined} onClick={()=>go(`/admin/${to}`)}><Icon/><span>{label}</span>{count!==undefined&&<b>{count}</b>}</button>;
  };
  const group=(label,children)=><div className="cms-side-group" role="group" aria-label={label}><small>{label}</small>{children}</div>;
  return <NavContext.Provider value={nav}>
    <div className="cms">
      {/* Cabecera y pie fijos; solo la lista de secciones se desplaza */}
      <aside className={`cms-side ${menu?'is-open':''}`}>
        <div className="cms-side-top">
          <button type="button" className="cms-side-brand" onClick={()=>go('/admin')} title="Ir al resumen">
            <span className="brand-symbol"><i/><i/><i/><i/></span><span><b>Cineteca</b><small>Gestión</small></span>
          </button>
          {helpBtn('cms-side-help-top')}
          <button type="button" className="cms-icon-btn cms-menu-btn" onClick={()=>setMenu(!menu)} aria-label={menu?'Cerrar menú':'Abrir menú'} aria-expanded={menu}>{menu?<X/>:<Menu/>}</button>
        </div>
        <div className="cms-side-drawer">
        <nav className="cms-side-nav" aria-label="Secciones del gestor">
          {item('',LayoutDashboard,'Resumen')}
          {group('Archivo',TYPES.map(t=>item(`registros/${TYPE_META[t].slug}`,TYPE_ICONS[t],TYPE_META[t].label,records.filter(r=>r.type===t).length)))}
          {group('Organizar el archivo',<>
            {item('colecciones',Layers,'Colecciones',collections.length)}
            {item('linea-de-tiempo',CalendarRange,'Línea de tiempo',timelineEvents.length)}
            {item('comunas',MapPin,'Comunas y mapa',locations.length)}
          </>)}
          {group('Página de inicio',item('inicio',Home,'Inicio y carrusel',heroSlides.length))}
          {group('Apariencia',item('colores',Palette,'Colores'))}
          {group('Datos',item('respaldo',Database,'Respaldo'))}
        </nav>
        <div className="cms-side-foot">
          <div className="cms-side-actions">
            <a className="cms-side-site" href="/" target="_blank" rel="noreferrer"><ExternalLink/><span>Ver sitio público</span><ArrowUpRight/></a>
            {helpBtn('cms-side-help')}
          </div>
          <div className="cms-side-user">
            <button type="button" className="cms-side-me" onClick={()=>{setMenu(false);setAccount(true)}} title="Mi cuenta"><span className="cms-avatar">{initials(session.name)}</span><span><strong>{session.name}</strong><small>Mi cuenta</small></span></button>
            <button type="button" className="cms-side-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut/></button>
          </div>
          <p className="cms-side-saved"><Check/> {savedLabel()}</p>
        </div>
        </div>
      </aside>
      {tour&&<Tour key={tour.view} steps={tour.steps} onClose={closeTour}/>}
      {account&&<AccountDialog session={session} onClose={()=>setAccount(false)} onLogout={()=>{setAccount(false);logout()}}/>}
      {menu&&<button type="button" className="cms-side-backdrop" onClick={()=>setMenu(false)} aria-label="Cerrar menú"/>}
      <main className="cms-main">
        <Routes>
          <Route index element={<Dashboard/>}/>
          <Route path="registros/:slug" element={<RecordList/>}/>
          <Route path="registros/:slug/:id" element={<RecordEditor/>}/>
          <Route path="inicio" element={<HomeEditor/>}/>
          <Route path="colores" element={<ThemeEditor/>}/>
          {/* Las diapositivas se editan dentro del Inicio */}
          <Route path="portada/*" element={<Navigate to="/admin/inicio" replace/>}/>
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

const initials=name=>String(name||'?').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();

/* ---------- Mi cuenta: contraseña y cuentas para otras personas ---------- */

function AccountDialog({session,onClose,onLogout}){
  const {toast}=useUi(), [tab,setTab]=useState('password');
  const [cur,setCur]=useState(''), [next,setNext]=useState(''), [next2,setNext2]=useState('');
  const [name,setName]=useState(''), [user,setUser]=useState(''), [pass,setPass]=useState('');
  const [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const run=async fn=>{setError('');setBusy(true);try{await fn()}catch(err){setError(err.message)}setBusy(false)};
  const savePassword=e=>{e.preventDefault();run(async()=>{
    if(next!==next2)throw new Error('Las contraseñas nuevas no coinciden.');
    await changePassword(cur,next);setCur('');setNext('');setNext2('');toast('Contraseña cambiada. Las demás sesiones de tu cuenta se cerraron.');
  })};
  const addUser=e=>{e.preventDefault();run(async()=>{
    const u=await createUser({name,user,password:pass});setName('');setUser('');setPass('');setUsers(await listUsers());toast(`Cuenta creada para ${u.name}. Ya puede entrar con el usuario «${u.user}».`);
  })};
  const [users,setUsers]=useState([]);
  useEffect(()=>{listUsers().then(setUsers).catch(()=>{})},[]);
  return <Modal title="Mi cuenta" onClose={onClose} className="cms-account">
    <div className="cms-account-me"><span className="cms-avatar is-big">{initials(session.name)}</span><span><strong>{session.name}</strong><small>Usuario: {session.user}</small></span>
      <button type="button" className="cms-btn" onClick={onLogout}><LogOut/> Cerrar sesión</button></div>
    <div className="cms-segment is-small cms-seg-block">
      <button type="button" className={tab==='password'?'active':''} onClick={()=>{setTab('password');setError('')}}>Cambiar contraseña</button>
      <button type="button" className={tab==='users'?'active':''} onClick={()=>{setTab('users');setError('')}}>Cuentas · {users.length}</button>
    </div>
    {tab==='password'?<form className="cms-account-form" onSubmit={savePassword}>
      <PasswordField label="Contraseña actual" value={cur} onChange={setCur} autoComplete="current-password"/>
      <PasswordField label="Contraseña nueva" value={next} onChange={setNext} autoComplete="new-password" hint="Al menos 8 caracteres."/>
      <PasswordField label="Repite la contraseña nueva" value={next2} onChange={setNext2} autoComplete="new-password"/>
      {error&&<p className="login-error" role="alert">{error}</p>}
      <button type="submit" className="cms-btn is-primary" disabled={busy}>Guardar contraseña</button>
    </form>:<form className="cms-account-form" onSubmit={addUser}>
      <ul className="cms-account-users">{users.map(u=><li key={u.id}><span className="cms-avatar">{initials(u.name)}</span><span><strong>{u.name}{u.id===session.id&&' (tú)'}</strong><small>{u.user}</small></span></li>)}</ul>
      <p className="cms-help">Crea una cuenta para otra persona que edite el sitio. Podrá entrar desde cualquier computador con su usuario y contraseña, y verá su propio tutorial la primera vez.</p>
      <label className="login-field"><span>Nombre</span><input value={name} onChange={e=>setName(e.target.value)} required/></label>
      <label className="login-field"><span>Usuario</span><input value={user} onChange={e=>setUser(e.target.value)} autoCapitalize="none" spellCheck={false} required/></label>
      <PasswordField label="Contraseña inicial" value={pass} onChange={setPass} autoComplete="new-password" hint="Al menos 8 caracteres. Dásela a la persona; después puede cambiarla."/>
      {error&&<p className="login-error" role="alert">{error}</p>}
      <button type="submit" className="cms-btn is-primary" disabled={busy}><UserPlus/> Crear cuenta</button>
    </form>}
  </Modal>;
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
export function EditorShell({crumb,title,isNew,dirty,onBack,onSave,onDiscard,onDelete,deleteLabel='Eliminar',saveLabel,note,viewHref,panel,children,hint='Haz clic sobre cualquier texto o imagen de la vista previa para cambiarlo.'}){
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
      <span className={`cms-status ${isNew?'is-new':dirty?'is-dirty':''}`}>{isNew?'Nuevo · sin guardar':dirty?'Cambios sin guardar':'Guardado'}</span>
      {note&&<span className="cms-status is-draft">{note}</span>}
      <div className="cms-editor-actions">
        {viewHref&&!isNew&&<a className="cms-btn is-ghost" href={viewHref} target="_blank" rel="noreferrer"><ArrowUpRight/> <span>Ver en el sitio</span></a>}
        {dirty&&!isNew&&<button type="button" className="cms-btn is-ghost" onClick={onDiscard}><RotateCcw/> <span>Descartar</span></button>}
        <button type="button" className="cms-btn is-primary" onClick={onSave} disabled={!dirty&&!isNew} title="Ctrl + S"><Save/> {saveLabel||(isNew?'Publicar':'Guardar')}</button>
      </div>
    </div>
    <div className="cms-editor-body">
      <section className="cms-canvas">
        <p className="cms-canvas-hint"><span>VISTA PREVIA</span>{hint}</p>
        {children}
      </section>
      {(panel||onDelete)&&<aside className="cms-panel">
        {panel}
        {/* Lo irreversible, lejos de «Guardar» */}
        {onDelete&&!isNew&&<div className="cms-panel-block cms-danger-zone">
          <div className="cms-panel-title"><span>Zona de peligro</span></div>
          <button type="button" className="cms-btn is-block is-danger-outline" onClick={onDelete}><Trash2/> {deleteLabel}</button>
        </div>}
      </aside>}
    </div>
  </div>;
}

export function PanelBlock({title,children,aside}){
  return <div className="cms-panel-block" data-tour={typeof title==="string"?title.split(" · ")[0]:undefined}><div className="cms-panel-title"><span>{title}</span>{aside}</div>{children}</div>;
}

/* ---------- Resumen ---------- */

function Dashboard(){
  const {go}=useAdminNav();
  const pending=records.map(r=>({r,miss:missingFields(r)})).filter(x=>x.miss.length);
  const recent=[...records].filter(r=>r.updatedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6);
  const media=Object.values(recordExtras).filter(e=>e.media).length;
  const drafts=records.filter(r=>r.draft).length;
  const today=new Date().toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return <div className="cms-page">
    <PageHead eyebrow={today.toUpperCase()} title="Gestión del archivo" desc="Todo lo que se publica en el sitio se edita desde aquí.">
      <NewRecordMenu/>
    </PageHead>
    <div className="cms-kpis is-3">
      <article><span>Fichas</span><strong>{records.length}</strong><small>{drafts?`${drafts} en borrador (no se ven en el sitio)`:`en ${TYPES.length} secciones, todas publicadas`}</small></article>
      <article className={pending.length?'is-warn':'is-ok'}><span>Por completar</span><strong>{pending.length}</strong><small>{pending.length?'fichas con datos faltantes':'todo al día'}</small></article>
      <article><span>Archivos digitales</span><strong>{media}</strong><small>videos, audios y documentos</small></article>
    </div>
    {/* Primero, lo que hay que hacer */}
    <div className="cms-dash-grid is-2">
      <section className="cms-card">
        <div className="cms-card-head"><h2>Por completar</h2>{pending.length>0&&<span>{pending.length}</span>}</div>
        {pending.length?<ul className="cms-rows">{pending.slice(0,6).map(({r,miss})=><li key={r.id}><button type="button" onClick={()=>go(`/admin/registros/${r.slug}/${r.id}`)}>
          {r.image?<img src={thumb(r.image,120)} alt=""/>:<span className="cms-thumb-empty"/>}
          <span><strong>{r.title||'Sin título'}</strong><small>{r.type} · falta: {miss.join(', ').toLowerCase()}</small></span><AlertCircle className="cms-warn-icon"/>
        </button></li>)}</ul>:<p className="cms-empty"><CircleCheck/> Todas las fichas tienen sus datos principales.</p>}
        {pending.length>6&&<p className="cms-help">y {pending.length-6} más: usa el filtro «Por completar» en cada sección.</p>}
      </section>
      <section className="cms-card">
        <div className="cms-card-head"><h2>Editado recientemente</h2></div>
        {recent.length?<ul className="cms-rows">{recent.map(r=><li key={r.id}><button type="button" onClick={()=>go(`/admin/registros/${r.slug}/${r.id}`)}>
          <img src={thumb(r.image,120)} alt=""/><span><strong>{r.title}</strong><small>{r.type} · {new Date(r.updatedAt).toLocaleString('es-CL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></span><ArrowUpRight/>
        </button></li>)}</ul>:<p className="cms-empty">Aún no has editado fichas. Elige una sección abajo para comenzar.</p>}
      </section>
    </div>
    <section className="cms-section">
      <div className="cms-section-head"><h2>Secciones del archivo</h2></div>
      <div className="cms-type-cards">{TYPES.map(t=>{const Icon=TYPE_ICONS[t], m=TYPE_META[t], n=records.filter(r=>r.type===t).length;return <article key={t} style={{'--type-color':typeColor(t)}}>
        <button type="button" className="cms-type-open" onClick={()=>go(`/admin/registros/${m.slug}`)}><Icon/><strong>{m.label}</strong><small>{n} {n===1?'ficha':'fichas'}</small></button>
        <button type="button" className="cms-type-new" onClick={()=>go(`/admin/registros/${m.slug}/nuevo`)}><Plus/> {m.newLabel}</button>
      </article>})}</div>
    </section>
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
    <button type="button" className="cms-btn is-primary" onClick={()=>setOpen(!open)}><Plus/> Nueva ficha</button>
    {open&&<div className="cms-new-menu">{TYPES.map(t=>{const Icon=TYPE_ICONS[t];return <button key={t} type="button" onClick={()=>go(`/admin/registros/${TYPE_META[t].slug}/nuevo`)}><Icon/>{t}</button>})}</div>}
  </div>;
}

/* ---------- Listado de registros ---------- */

function RecordList(){
  const {slug}=useParams(), type=typeBySlug(slug), {go}=useAdminNav();
  const [q,setQ]=useState(''), [sort,setSort]=useState('recent'), [filter,setFilter]=useState(null), {toast}=useUi();
  if(!type)return <Dashboard/>;
  const meta=TYPE_META[type];
  const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  let list=records.filter(r=>r.type===type&&fold(`${r.title} ${r.subtitle} ${r.year} ${r.collection}`).includes(fold(q)));
  if(filter==='pending')list=list.filter(r=>missingFields(r).length);
  if(filter==='drafts')list=list.filter(r=>r.draft);
  const drafts=records.filter(r=>r.type===type&&r.draft).length;
  const togglePublished=async r=>{
    try{await setRecordPublished(r.id,!!r.draft)}catch{return toast('No se pudo cambiar la visibilidad.','error')}
    toast(r.draft?`“${r.title}” ya se ve en el sitio.`:`“${r.title}” quedó como borrador.`);
  };
  list=[...list].sort(sort==='title'?(a,b)=>a.title.localeCompare(b.title,'es'):sort==='year'?(a,b)=>String(a.year).localeCompare(String(b.year)):(a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')||b.id-a.id);
  return <div className="cms-page">
    <PageHead eyebrow="ARCHIVO" title={meta.label} desc={`${records.filter(r=>r.type===type).length} fichas. Haz clic en una para editarla.`}><NewRecordMenu type={type}/></PageHead>
    <div className="cms-toolbar">
      <label className="cms-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={`Buscar en ${meta.label.toLowerCase()}…`}/>{q&&<button type="button" onClick={()=>setQ('')} aria-label="Limpiar"><X/></button>}</label>
      <div className="cms-segment is-small">{[['recent','Recientes'],['title','A–Z'],['year','Año']].map(([k,l])=><button key={k} type="button" className={sort===k?'active':''} onClick={()=>setSort(k)}>{l}</button>)}</div>
      <button type="button" className={`cms-chip ${filter==='pending'?'active':''}`} onClick={()=>setFilter(filter==='pending'?null:'pending')}><AlertCircle/> Por completar</button>
      <button type="button" className={`cms-chip ${filter==='drafts'?'active':''}`} onClick={()=>setFilter(filter==='drafts'?null:'drafts')}><EyeOff/> Borradores{drafts>0&&` · ${drafts}`}</button>
    </div>
    <div className="cms-grid">
      {list.map(r=>{const miss=missingFields(r,extraOf(r.id));return <div key={r.id} className={`cms-tile-wrap${r.draft?' is-draft':''}`}><button type="button" className="cms-tile" onClick={()=>go(`/admin/registros/${slug}/${r.id}`)}>
        <div className="cms-tile-img">{r.image?<img src={thumb(r.image,480)} alt="" loading="lazy"/>:<span className="cms-thumb-empty"/>}<span className="cms-tag" style={tagStyle(r.color)}>{r.type}</span>{miss.length>0&&<span className="cms-tile-warn" title={`Falta: ${miss.join(', ')}`}><AlertCircle/> {miss.length} {miss.length===1?'pendiente':'pendientes'}</span>}{r.draft&&<span className="cms-tile-draft"><EyeOff/> Borrador</span>}</div>
        <div className="cms-tile-body"><small>{code(r.id)} · {r.year}</small><strong>{r.title||'Sin título'}</strong><span>{r.subtitle}</span></div>
      </button>
      <button type="button" className="cms-tile-pub" onClick={()=>togglePublished(r)} title={r.draft?'Publicar: que se vea en el sitio':'Despublicar: ocultarla del sitio'}>{r.draft?<><Eye/> Publicar</>:<><EyeOff/> Despublicar</>}</button>
      </div>})}
    </div>
    {!list.length&&<p className="cms-empty">{filter==='drafts'?'No hay fichas en borrador.':'No hay fichas que coincidan.'}</p>}
  </div>;
}

/* ---------- Respaldo ---------- */

function Backup(){
  const {toast,confirm}=useUi(), inputRef=useRef(null);
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
    <PageHead eyebrow="DATOS" title="Respaldo" desc="El contenido se guarda en el servidor del sitio y lo ven todos los visitantes. Descarga un respaldo de vez en cuando para tener una copia propia."/>
    <div className="cms-backup">
      <article className="cms-card"><Download/><h2>Exportar</h2><p>Descarga un archivo con todas las fichas, imágenes subidas, colecciones, línea de tiempo, comunas y portada.</p><button type="button" className="cms-btn is-primary" onClick={()=>{exportData();toast('Respaldo descargado.')}}><Download/> Descargar respaldo</button></article>
      <article className="cms-card"><Upload/><h2>Importar</h2><p>Carga un respaldo exportado antes. Reemplaza el contenido actual por el del archivo.</p><button type="button" className="cms-btn" onClick={()=>inputRef.current.click()}><Upload/> Elegir archivo…</button><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={e=>onImport(e.target.files[0])}/></article>
    </div>
    <p className="cms-help"><Check/> {savedLabel()}</p>
    <section className="cms-danger-section">
      <h2>Zona de peligro</h2>
      <div><p><strong>Restablecer todo.</strong> Vuelve al contenido original del sitio y borra las fichas creadas, las imágenes subidas y todos los cambios. Úsalo solo si quieres empezar de cero.</p>
      <button type="button" className="cms-btn is-danger" onClick={onReset}><RotateCcw/> Restablecer todo</button></div>
    </section>
  </div>;
}
