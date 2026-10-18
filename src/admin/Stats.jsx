import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { records } from '../data';
import { Paged } from '../components';
import { PageHead, useAdminNav } from './AdminApp';
import { thumb } from './fields';
import { TYPE_META, TYPES, typeColor } from './meta';

/* Estadísticas: qué se ve en el sitio público. Los contadores los suma el servidor por día
   (ver /api/stats en server/index.js); aquí se agrupan según el período elegido. */

async function loadStats(days){
  const res=await fetch(`/api/stats?days=${days}`,{credentials:'same-origin'});
  const body=await res.json().catch(()=>({}));
  if(res.status===401)window.dispatchEvent(new CustomEvent('cms-unauthorized'));
  if(!res.ok)throw new Error(body.error||'No se pudo conectar con el servidor.');
  return body;
}

const PERIODS=[[1,'Hoy'],[7,'7 días'],[30,'30 días'],[365,'12 meses'],[0,'Todo']];
const PAGES={'/':'Inicio','/archivo':'Archivo completo','/peliculas':'Películas','/personas':'Personas','/prensa':'Prensa','/entrevistas':'Entrevistas',
  '/articulos':'Artículos','/nosotros':'Sobre la Cineteca','/colecciones':'Colecciones','/linea-de-tiempo':'Línea de tiempo','/mapa':'Mapa',
  '/inscribe-tu-obra':'Inscribe tu obra','/aviso-legal':'Aviso legal'};
const DEVICES={movil:'Celular',tablet:'Tablet',computador:'Computador'};
const sourceLabel=s=>s==='directo'?'Directo o enlace guardado':/google\./.test(s)?'Google':/facebook\.com|fb\.com/.test(s)?'Facebook':/instagram\.com/.test(s)?'Instagram':/(^|\.)t\.co$|twitter\.com|x\.com/.test(s)?'X (Twitter)':s;
const n=v=>Number(v||0).toLocaleString('es-CL');
const plural=(v,one,many)=>`${n(v)} ${v===1?one:many}`;
const fold=v=>String(v||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();

// Suma vistas y personas por clave, para un prefijo («ficha», «search»…)
function totals(rows,prefix){
  const m=new Map();
  for(const r of rows){
    if(prefix?!r.k.startsWith(`${prefix}:`):r.k!=='visita')continue;
    const k=prefix?r.k.slice(prefix.length+1):r.k, c=m.get(k)||{key:k,views:0,uniques:0};
    c.views+=r.views;c.uniques+=r.uniques;m.set(k,c);
  }
  return [...m.values()].sort((a,b)=>b.views-a.views);
}

// Visitas por día (o por mes, si el período es largo), con los días sin visitas en cero
function series(rows,from,today){
  const views=new Map();
  for(const r of rows)if(r.k.startsWith('page:')||r.k.startsWith('ficha:'))views.set(r.day,(views.get(r.day)||0)+r.views);
  const first=from<'2001'?[...views.keys()].sort()[0]||today:from;
  const days=[];
  for(let d=new Date(`${first}T12:00:00Z`);;d=new Date(d.getTime()+864e5)){const day=d.toISOString().slice(0,10);days.push(day);if(day>=today||days.length>4000)break}
  if(days.length<=62)return days.map(day=>({label:new Date(`${day}T12:00:00Z`).toLocaleDateString('es-CL',{day:'numeric',month:'short',timeZone:'UTC'}),value:views.get(day)||0}));
  const months=new Map();
  for(const day of days){const m=day.slice(0,7);months.set(m,(months.get(m)||0)+(views.get(day)||0))}
  return [...months].map(([m,value])=>({label:new Date(`${m}-15T12:00:00Z`).toLocaleDateString('es-CL',{month:'short',year:'2-digit',timeZone:'UTC'}),value}));
}

function Bars({items,empty,color}){
  if(!items.length)return <p className="cms-empty">{empty}</p>;
  const max=Math.max(...items.map(i=>i.value),1);
  return <ul className="cms-stat-bars">{items.map(i=><li key={i.key} title={i.hint}>
    <span>{i.label}</span>
    <i><b style={{width:`${Math.max(2,i.value/max*100)}%`,background:i.color||color}}/></i>
    <strong>{n(i.value)}</strong>
  </li>)}</ul>;
}

function Card({title,badge,help,children}){
  return <section className="cms-card cms-stat-card">
    <div className="cms-card-head"><h2>{title}</h2>{badge!==undefined&&<span className="cms-stat-badge">{badge}</span>}</div>
    {help&&<p className="cms-help">{help}</p>}
    {children}
  </section>;
}

export function StatsPage(){
  const {go}=useAdminNav();
  const [days,setDays]=useState(30), [data,setData]=useState(null), [error,setError]=useState(''), [loading,setLoading]=useState(false);
  const [q,setQ]=useState(''), [type,setType]=useState(''), [order,setOrder]=useState('mas');
  const load=()=>{setLoading(true);setError('');loadStats(days).then(setData).catch(err=>setError(err.message)).finally(()=>setLoading(false))};
  useEffect(load,[days]);// eslint-disable-line react-hooks/exhaustive-deps

  const s=useMemo(()=>{
    if(!data)return null;
    const rows=data.rows||[];
    const visit=totals(rows,null)[0]||{views:0,uniques:0};
    const fichaViews=new Map(totals(rows,'ficha').map(t=>[t.key,t]));
    const fichas=records.filter(r=>!r.draft).map(r=>({r,views:fichaViews.get(String(r.id))?.views||0,uniques:fichaViews.get(String(r.id))?.uniques||0}));
    const pages=totals(rows,'page'), searches=totals(rows,'search');
    const byType=TYPES.map(t=>({key:t,label:TYPE_META[t].label,color:typeColor(t),value:fichas.filter(f=>f.r.type===t).reduce((a,f)=>a+f.views,0)})).sort((a,b)=>b.value-a.value);
    return {
      visit, fichas, byType, searches,
      pageViews:pages.reduce((a,p)=>a+p.views,0)+fichas.reduce((a,f)=>a+f.views,0),
      pages:pages.map(p=>({key:p.key,label:PAGES[p.key]||p.key,value:p.views,hint:`${plural(p.uniques,'persona','personas')}`})),
      noResults:totals(rows,'nores'), collections:totals(rows,'coleccion'),
      devices:totals(rows,'device').map(d=>({key:d.key,label:DEVICES[d.key]||d.key,value:d.views})),
      sources:totals(rows,'source').map(d=>({key:d.key,label:sourceLabel(d.key),value:d.views})),
      series:series(rows,data.from,data.today),
      unseen:fichas.filter(f=>!f.views).length
    };
  },[data]);

  const list=useMemo(()=>{
    if(!s)return [];
    const shown=s.fichas.filter(f=>(!type||f.r.type===type)&&fold(`${f.r.title} ${f.r.subtitle}`).includes(fold(q)));
    return shown.sort((a,b)=>order==='mas'?b.views-a.views||b.uniques-a.uniques:a.views-b.views||a.uniques-b.uniques);
  },[s,q,type,order]);

  const top=s?[...s.fichas].filter(f=>f.views).sort((a,b)=>b.views-a.views).slice(0,8):[];
  const maxSeries=s?Math.max(...s.series.map(x=>x.value),1):1;
  const period=PERIODS.find(([d])=>d===days)[1].toLowerCase();
  const fichaRow=f=><li key={f.r.id}><button type="button" onClick={()=>go(`/admin/registros/${f.r.slug}/${f.r.id}`)}>
    {f.r.image?<img src={thumb(f.r.image,120)} alt=""/>:<span className="cms-thumb-empty"/>}
    <span><strong>{f.r.title||'Sin título'}</strong><small>{f.r.type}{f.r.year?` · ${f.r.year}`:''}</small></span>
    <em className={`cms-stat-count${f.views?'':' is-zero'}`}>{f.views?<><i><b>{n(f.views)}</b> {f.views===1?'vista':'vistas'}</i><small>{plural(f.uniques,'persona','personas')}</small></>:'Sin visitas'}</em>
  </button></li>;

  return <div className="cms-page cms-stats">
    <PageHead eyebrow="SITIO PÚBLICO" title="Estadísticas" desc="Qué se ve en el sitio: las fichas, secciones y búsquedas que más (y menos) interesan. No cuentan tus visitas ni las de otras cuentas del gestor.">
      <button type="button" className="cms-btn" onClick={load} disabled={loading}><RefreshCw/> Actualizar</button>
    </PageHead>
    <div className="cms-toolbar">
      <div className="cms-segment">{PERIODS.map(([d,l])=><button key={d} type="button" className={days===d?'active':''} onClick={()=>setDays(d)}>{l}</button>)}</div>
    </div>
    {error&&<p className="login-error">{error}</p>}
    {!s&&!error&&<p className="cms-help">Cargando estadísticas…</p>}
    {s&&<>
      <div className="cms-kpis">
        <article><span>Visitas</span><strong>{n(s.visit.views)}</strong><small>veces que alguien entró al sitio</small></article>
        <article><span>Personas</span><strong>{n(s.visit.uniques)}</strong><small>{days===1?'distintas hoy':'distintas por día, sumadas'}</small></article>
        <article><span>Páginas vistas</span><strong>{n(s.pageViews)}</strong><small>{s.visit.views?`${(s.pageViews/s.visit.views).toLocaleString('es-CL',{maximumFractionDigits:1})} por visita`:'secciones y fichas'}</small></article>
        <article><span>Búsquedas</span><strong>{n(s.searches.reduce((a,x)=>a+x.views,0))}</strong><small>{plural(s.searches.length,'término distinto','términos distintos')}</small></article>
      </div>

      {!s.visit.views&&!s.pageViews&&<p className="cms-empty">Todavía no hay visitas registradas en este período. Las estadísticas empiezan a contarse desde ahora: vuelve en unos días.</p>}

      <Card title={days===1?'Hoy':`Páginas vistas · ${period}`} help={s.series.length>62?'Por mes.':null}>
        <div className="cms-stat-chart" role="img" aria-label="Páginas vistas en el período">
          {s.series.map((x,i)=><div key={i} title={`${x.label}: ${plural(x.value,'página vista','páginas vistas')}`}>
            <b style={{height:`${x.value/maxSeries*100}%`}}/>
            <small>{(s.series.length<=14||i%Math.ceil(s.series.length/10)===0)?x.label:''}</small>
          </div>)}
        </div>
      </Card>

      <div className="cms-dash-grid is-2 cms-stat-grid">
        <Card title="Fichas más vistas">
          {top.length?<ul className="cms-rows cms-stat-rows">{top.map(fichaRow)}</ul>:<p className="cms-empty">Aún no se ha abierto ninguna ficha en este período.</p>}
        </Card>
        <Card title="Lo que más interesa" help="Vistas de fichas, por sección del archivo.">
          <Bars items={s.byType} empty="Sin vistas de fichas todavía."/>
        </Card>
        <Card title="Páginas más visitadas">
          <Bars items={s.pages.slice(0,10)} empty="Sin visitas todavía." color="var(--forest)"/>
        </Card>
        <Card title="Búsquedas más frecuentes" help="Lo que la gente escribe en el buscador del archivo.">
          <Bars items={s.searches.slice(0,10).map(x=>({key:x.key,label:`«${x.key}»`,value:x.views}))} empty="Nadie ha buscado nada todavía." color="#6d5bd0"/>
        </Card>
        <Card title="Búsquedas sin resultados" badge={s.noResults.length||undefined} help="Lo que se busca y el archivo aún no tiene: ideas de fichas nuevas (o de palabras que conviene agregar a las existentes).">
          <Bars items={s.noResults.slice(0,10).map(x=>({key:x.key,label:`«${x.key}»`,value:x.views}))} empty="Todas las búsquedas encontraron algo." color="var(--warn)"/>
        </Card>
        <Card title="Colecciones más exploradas">
          <Bars items={s.collections.slice(0,10).map(x=>({key:x.key,label:x.key,value:x.views}))} empty="Nadie ha abierto una colección todavía." color="var(--forest)"/>
        </Card>
        <Card title="Dispositivos" help="Desde dónde se visita el sitio.">
          <Bars items={s.devices} empty="Sin visitas todavía." color="#2563eb"/>
        </Card>
        <Card title="De dónde llegan" help="El sitio desde el que llegó cada visita.">
          <Bars items={s.sources.slice(0,10)} empty="Sin visitas todavía." color="#2563eb"/>
        </Card>
      </div>

      <section className="cms-section">
        <div className="cms-section-head"><h2>Todas las fichas</h2>{s.unseen>0&&<span className="cms-stat-badge">{plural(s.unseen,'ficha sin visitas','fichas sin visitas')}</span>}</div>
        <div className="cms-toolbar">
          <label className="cms-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar una ficha…"/>{q&&<button type="button" onClick={()=>setQ('')} aria-label="Limpiar"><X/></button>}</label>
          <div className="cms-segment is-small">{[['','Todas'],...TYPES.map(t=>[t,TYPE_META[t].label])].map(([t,l])=><button key={t} type="button" className={type===t?'active':''} onClick={()=>setType(t)}>{l}</button>)}</div>
          <div className="cms-segment is-small">{[['mas','Más vistas'],['menos','Menos vistas']].map(([k,l])=><button key={k} type="button" className={order===k?'active':''} onClick={()=>setOrder(k)}>{l}</button>)}</div>
        </div>
        {list.length?<Paged items={list}>{page=><ul className="cms-rows cms-stat-rows cms-card">{page.map(fichaRow)}</ul>}</Paged>
          :<p className="cms-empty">No hay fichas que coincidan.</p>}
      </section>
    </>}
  </div>;
}
