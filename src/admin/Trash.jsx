import React, { useEffect, useState } from 'react';
import { ArchiveRestore, CalendarRange, Database, FileText, Film, Inbox, Layers, MapPin, Mic2, BookOpen, Image as ImageIcon, Trash2, UserRound, Users } from 'lucide-react';
import { getTrash, restoreFromTrash, saveError, useStoreVersion } from '../store';
import { PageHead } from './AdminApp';
import { useUi } from './fields';

/* Papelera: todo lo eliminado desde el gestor sigue en la base de datos y desde aquí se recupera.
   Las fichas, colecciones, hitos y comunas vienen del contenido; las cuentas y las inscripciones, del servidor. */

async function call(url,options){
  const res=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options?.headers}});
  const body=await res.json().catch(()=>({}));
  if(res.status===401)window.dispatchEvent(new CustomEvent('cms-unauthorized'));
  if(!res.ok)throw new Error(body.error||'No se pudo conectar con el servidor.');
  return body;
}

const RECORD_ICONS={Película:Film,Persona:UserRound,Prensa:FileText,Entrevista:Mic2,Artículo:BookOpen};
const GROUPS=[['todo','Todo'],['records','Fichas'],['lists','Colecciones, hitos y comunas'],['users','Cuentas'],['submissions','Inscripciones'],['bulk','Contenido completo']];
const when=iso=>iso?new Date(iso).toLocaleString('es-CL',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';

// Cada elemento de la papelera con lo necesario para mostrarlo y recuperarlo
function describe(t){
  const it=t.item||{};
  if(t.kind==='records')return {group:'records',icon:RECORD_ICONS[it.type]||Film,title:it.title||'Ficha sin título',sub:[it.type,it.year,it.draft&&'borrador'].filter(Boolean).join(' · ')};
  if(t.kind==='collections')return {group:'lists',icon:Layers,title:it.title||'Colección sin nombre',sub:'Colección'};
  if(t.kind==='timelineEvents')return {group:'lists',icon:CalendarRange,title:it.title||'Hito sin título',sub:['Hito de la línea de tiempo',it.year].filter(Boolean).join(' · ')};
  if(t.kind==='locations')return {group:'lists',icon:MapPin,title:it.name||'Comuna sin nombre',sub:'Comuna del mapa'};
  if(t.kind==='heroSlides')return {group:'lists',icon:ImageIcon,title:it.title||'Diapositiva',sub:'Diapositiva del inicio'};
  if(t.kind==='todo')return {group:'bulk',icon:Database,title:`Todo el contenido (${(it.records||[]).length} fichas)`,sub:`Guardado al ${t.reason||'reemplazar el contenido'}`};
  return {group:'lists',icon:Trash2,title:'Elemento',sub:t.kind};
}

export function TrashPage(){
  useStoreVersion();
  const {toast,confirm}=useUi();
  const [users,setUsers]=useState(null), [subs,setSubs]=useState(null), [filter,setFilter]=useState('todo'), [busy,setBusy]=useState(null), [error,setError]=useState('');
  const loadServer=()=>Promise.all([
    call('/api/users/deleted').then(r=>setUsers(r.users||[])),
    call('/api/submissions/deleted').then(r=>setSubs(r.submissions||[]))
  ]).catch(err=>setError(err.message));
  useEffect(()=>{loadServer()},[]);

  const items=[
    ...getTrash().map(t=>({key:`c-${t.id}`,at:t.deletedAt,...describe(t),
      confirmText:t.kind==='todo'?'Todo el contenido actual (fichas, colecciones, hitos, comunas, portada y colores) se reemplazará por este. El contenido actual no se pierde: queda en la papelera.':null,
      restore:()=>restoreFromTrash(t.id),done:t.kind==='records'?`«${t.item?.title||'La ficha'}» volvió al archivo.`:'Recuperado.'})),
    ...(users||[]).map(u=>({key:`u-${u.id}`,at:u.deletedAt,group:'users',icon:Users,title:u.name,sub:`Cuenta · usuario «${u.user}»`,
      restore:async()=>{await call(`/api/users/${u.id}/restore`,{method:'POST',body:'{}'});await loadServer()},done:`${u.name} puede volver a entrar con su misma contraseña.`})),
    ...(subs||[]).map(s=>({key:`s-${s.id}`,at:s.createdAt,group:'submissions',icon:Inbox,title:s.title||'Inscripción',sub:`Inscripción de ${s.name||'—'}`,
      restore:async()=>{await call(`/api/submissions/${s.id}`,{method:'PUT',body:JSON.stringify({status:'revisada'})});await loadServer()},done:'La inscripción volvió a Inscripciones, como revisada.'}))
  ].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const counts=Object.fromEntries(GROUPS.map(([k])=>[k,k==='todo'?items.length:items.filter(i=>i.group===k).length]));
  const shown=filter==='todo'?items:items.filter(i=>i.group===filter);

  const recover=async item=>{
    if(item.confirmText&&!await confirm({title:'¿Recuperar todo este contenido?',text:item.confirmText,ok:'Recuperar'}))return;
    setBusy(item.key);
    try{await item.restore();toast(item.done)}
    catch(err){toast(err.status?saveError(err):err.message,'error')}
    finally{setBusy(null)}
  };

  return <div className="cms-page">
    <PageHead eyebrow="SISTEMA" title="Papelera" desc="Lo que se elimina en el gestor no se borra: desaparece del sitio y queda guardado aquí. Puedes recuperarlo cuando quieras."/>
    <div className="cms-toolbar">
      <div className="cms-segment is-small cms-trash-filter">{GROUPS.filter(([k])=>k==='todo'||counts[k]).map(([k,l])=><button key={k} type="button" className={filter===k?'active':''} onClick={()=>setFilter(k)}>{l} · {counts[k]}</button>)}</div>
    </div>
    {error&&<p className="login-error">{error}</p>}
    {!shown.length&&<p className="cms-empty"><Trash2/> {users&&subs?'La papelera está vacía.':'Cargando…'}</p>}
    {shown.length>0&&<ul className="cms-trash">
      {shown.map(item=>{const Icon=item.icon;return <li key={item.key}>
        <span className="cms-trash-icon"><Icon/></span>
        <span className="cms-trash-text"><strong>{item.title}</strong><small>{item.sub}{item.at&&` · ${item.group==='submissions'?'enviada':'eliminada'} el ${when(item.at)}`}</small></span>
        <button type="button" className="cms-btn" disabled={busy!=null} onClick={()=>recover(item)}><ArchiveRestore/> {busy===item.key?'Recuperando…':'Recuperar'}</button>
      </li>})}
    </ul>}
  </div>;
}
