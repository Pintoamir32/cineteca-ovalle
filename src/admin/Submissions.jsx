import React, { useEffect, useState } from 'react';
import { Archive, Check, ChevronDown, Clapperboard, ExternalLink, Film, Mail, Phone, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { Paged } from '../components';
import { PageHead, useAdminNav } from './AdminApp';
import { useUi } from './fields';

/* Inscripciones: las obras enviadas desde «Inscribe tu obra» en el sitio.
   Se revisan, se archivan o se convierten en una ficha de película (en borrador). */

async function call(url,options){
  const res=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options?.headers}});
  const body=await res.json().catch(()=>({}));
  if(res.status===401)window.dispatchEvent(new CustomEvent('cms-unauthorized'));
  if(!res.ok)throw new Error(body.error||'No se pudo conectar con el servidor.');
  return body;
}
export const listSubmissions=()=>call('/api/submissions').then(r=>r.submissions||[]);
const setStatus=(id,status)=>call(`/api/submissions/${id}`,{method:'PUT',body:JSON.stringify({status})});
const removeSubmission=id=>call(`/api/submissions/${id}`,{method:'DELETE'});
// Aviso para el menú lateral (cantidad de inscripciones nuevas)
const announce=list=>window.dispatchEvent(new CustomEvent('cms-submissions',{detail:list.filter(s=>s.status==='nueva').length}));

const STATUS={nueva:'Nueva',revisada:'Revisada',archivada:'Archivada'};
const TECH=[['year','Año'],['duration','Duración'],['genre','Género'],['format','Formato'],['direction','Dirección'],['production','Producción'],['place','Lugar de rodaje']];
const dateOf=iso=>new Date(iso).toLocaleString('es-CL',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

// La ficha nueva de película parte con los datos de la inscripción (ver blankDraft en RecordEditor)
export const PREFILL_KEY='cdo-prefill';
function toFilmDraft(s){
  const credits=[...(s.production?[['Producción',s.production]]:[]),
    ...String(s.credits||'').split('\n').map(l=>l.split(/:\s*/)).filter(p=>p.length>1&&p[0].trim()&&p.slice(1).join(':').trim()).map(p=>[p[0].trim(),p.slice(1).join(':').trim()])];
  return {record:{title:s.title,subtitle:s.direction||'',year:s.year||'',format:[s.genre,s.duration,s.format].map(x=>x||'').join(' · ').replace(/( · )+$/,''),description:s.synopsis||'',draft:true},
    extra:{credits,media:s.link||'',mediaType:'video'}};
}

export function SubmissionsPage(){
  const {go}=useAdminNav(), {toast,confirm}=useUi();
  const [list,setList]=useState(null), [error,setError]=useState(''), [filter,setFilter]=useState('nueva'), [q,setQ]=useState(''), [open,setOpen]=useState(null);
  const load=()=>listSubmissions().then(l=>{setList(l);announce(l)}).catch(err=>setError(err.message));
  useEffect(()=>{load()},[]);

  const change=async(s,status,msg)=>{
    try{await setStatus(s.id,status)}catch(err){return toast(err.message,'error')}
    const next=list.map(x=>x.id===s.id?{...x,status}:x);setList(next);announce(next);toast(msg);
  };
  const remove=async s=>{
    if(!await confirm({title:`¿Eliminar la inscripción de «${s.title}»?`,text:'Se borran los datos de contacto y de la obra. Esta acción no se puede deshacer.',ok:'Eliminar',danger:true}))return;
    try{await removeSubmission(s.id)}catch(err){return toast(err.message,'error')}
    const next=list.filter(x=>x.id!==s.id);setList(next);announce(next);toast('Inscripción eliminada.');
  };
  const createFilm=async s=>{
    try{sessionStorage.setItem(PREFILL_KEY,JSON.stringify(toFilmDraft(s)))}catch{/* sin almacenamiento */}
    if(s.status==='nueva'){await setStatus(s.id,'revisada').catch(()=>{});announce(list.map(x=>x.id===s.id?{...x,status:'revisada'}:x))}
    go('/admin/registros/peliculas/nuevo');
  };

  const fold=v=>String(v||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const all=list||[], counts=Object.fromEntries(Object.keys(STATUS).map(k=>[k,all.filter(s=>s.status===k).length]));
  const shown=all.filter(s=>(filter==='todas'||s.status===filter)&&fold(`${s.title} ${s.name} ${s.email} ${s.direction}`).includes(fold(q)));

  return <div className="cms-page">
    <PageHead eyebrow="RECEPCIÓN" title="Inscripciones" desc="Obras enviadas desde «Inscribe tu obra» en el sitio. Revísalas, archívalas o conviértelas en una ficha de película."/>
    {error&&<p className="login-error">{error}</p>}
    {list&&<>
      <div className="cms-toolbar">
        <label className="cms-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por obra, nombre o correo…"/>{q&&<button type="button" onClick={()=>setQ('')} aria-label="Limpiar"><X/></button>}</label>
        <div className="cms-segment is-small">{[...Object.entries(STATUS).map(([k,l])=>[k,`${l}s`]),['todas','Todas']].map(([k,l])=><button key={k} type="button" className={filter===k?'active':''} onClick={()=>{setFilter(k);setOpen(null)}}>{l}{k!=='todas'&&` · ${counts[k]}`}</button>)}</div>
      </div>
      {shown.length?<Paged items={shown} perPage={12}>{page=><ul className="cms-subs">{page.map(s=>{const isOpen=open===s.id;return <li key={s.id} className={`cms-sub is-${s.status}${isOpen?' is-open':''}`}>
        <button type="button" className="cms-sub-head" onClick={()=>setOpen(isOpen?null:s.id)} aria-expanded={isOpen}>
          <Film/><span><strong>{s.title}</strong><small>{s.name} · {dateOf(s.createdAt)}</small></span>
          <em className={`cms-sub-status is-${s.status}`}>{STATUS[s.status]}</em><ChevronDown className="cms-sub-chev"/>
        </button>
        {isOpen&&<div className="cms-sub-body">
          <div className="cms-sub-contact">
            <a href={`mailto:${s.email}?subject=${encodeURIComponent(`Inscripción de «${s.title}» · Cineteca de Ovalle`)}`}><Mail/> {s.email}</a>
            <a href={`tel:${String(s.phone).replace(/[^\d+]/g,'')}`}><Phone/> {s.phone}</a>
            {s.link&&<a href={s.link} target="_blank" rel="noreferrer noopener"><ExternalLink/> Ver la obra</a>}
          </div>
          <h4>Sinopsis</h4><p className="cms-sub-text">{s.synopsis}</p>
          {TECH.some(([k])=>s[k])&&<><h4>Ficha técnica</h4><dl className="cms-sub-tech">{TECH.filter(([k])=>s[k]).map(([k,l])=><div key={k}><dt>{l}</dt><dd>{s[k]}</dd></div>)}</dl></>}
          {s.credits&&<><h4>Otros créditos o comentarios</h4><p className="cms-sub-text">{s.credits}</p></>}
          <div className="cms-sub-actions">
            <button type="button" className="cms-btn is-primary" onClick={()=>createFilm(s)}><Clapperboard/> Crear ficha de película</button>
            {s.status!=='revisada'&&<button type="button" className="cms-btn" onClick={()=>change(s,'revisada','Marcada como revisada.')}><Check/> Marcar revisada</button>}
            {s.status!=='archivada'&&<button type="button" className="cms-btn" onClick={()=>change(s,'archivada','Inscripción archivada.')}><Archive/> Archivar</button>}
            {s.status!=='nueva'&&<button type="button" className="cms-btn is-ghost" onClick={()=>change(s,'nueva','Vuelve a estar como nueva.')}><RotateCcw/> Marcar como nueva</button>}
            <button type="button" className="cms-btn is-danger-text" onClick={()=>remove(s)}><Trash2/> Eliminar</button>
          </div>
        </div>}
      </li>})}</ul>}</Paged>
      :<p className="cms-empty">{q?'No hay inscripciones que coincidan.':filter==='nueva'?'No hay inscripciones nuevas. Aparecerán aquí cuando alguien use «Inscribe tu obra» en el sitio.':'No hay inscripciones en esta lista.'}</p>}
    </>}
  </div>;
}
