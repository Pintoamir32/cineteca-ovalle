import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CirclePlay, Download, FileText, Film, Grid2X2, Headphones, List, MapPin, Pause, Play, Plus, Search, Settings2, Sparkles, UserRound, X } from 'lucide-react';
import { Brand, Counter, RecordCard, RecordRow, SearchResults } from './components';
import { collections, locations, recordExtras, records, sections, timelineEvents } from './data';
import { addRecord, countByCollection, countByLocation, countByType, getAllRecords } from './repository';
import { buildSearchIndex, matchIndex } from './search-index';

const heroSlides=[
  {eyebrow:'CINE · TERRITORIO · MEMORIA',title:<>Un archivo<br/>que vuelve a<br/><em>mirarnos.</em></>,desc:'La memoria audiovisual de Ovalle, abierta para todas y todos.',image:'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1900&q=90',alt:'Rodaje cinematográfico',link:'/archivo'},
  {eyebrow:'OBRAS AUDIOVISUALES',title:<>Películas que<br/>cuentan el<br/><em>territorio.</em></>,desc:'Ficción y documental de casi ocho décadas de cine regional.',image:'https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=1900&q=90',alt:'Paisaje del Valle del Limarí',link:'/peliculas'},
  {eyebrow:'VOCES Y OFICIOS',title:<>Las personas<br/>detrás de<br/><em>cada imagen.</em></>,desc:'Directoras, actores, técnicos y gestores del cine del Limarí.',image:'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1900&q=90',alt:'Retrato',link:'/personas'},
  {eyebrow:'RECORRIDOS CURATORIALES',title:<>Historias<br/>reunidas por<br/><em>temas.</em></>,desc:'Explora colecciones temáticas dentro del archivo.',image:'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1900&q=90',alt:'Colecciones del archivo',link:'/colecciones'}
];

export function Home(){
  const [term,setTerm]=useState(''),[advanced,setAdvanced]=useState(false),[showResults,setShowResults]=useState(false); const nav=useNavigate(); const searchRef=useRef(null);
  const [advType,setAdvType]=useState(''),[advYear,setAdvYear]=useState(''),[advCollection,setAdvCollection]=useState('');
  const [slide,setSlide]=useState(0),[paused,setPaused]=useState(false);
  useEffect(()=>{
    if(paused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const t=setInterval(()=>setSlide(s=>(s+1)%heroSlides.length),5000);
    return ()=>clearInterval(t);
  },[paused]);
  const prevSlide=()=>setSlide(s=>(s-1+heroSlides.length)%heroSlides.length);
  const nextSlide=()=>setSlide(s=>(s+1)%heroSlides.length);
  const index=useMemo(()=>buildSearchIndex(),[]);
  const results=useMemo(()=>matchIndex(term,index),[term,index]);
  const decadeOf=r=>{const m=/\d{4}/.exec(r.year);return m?Math.floor(Number(m[0])/10)*10:null};
  const allRecords=useMemo(()=>getAllRecords(),[]);
  const decadeOptions=useMemo(()=>[...new Set(allRecords.map(decadeOf).filter(d=>d!==null))].sort((a,b)=>a-b),[allRecords]);
  const collectionOptions=useMemo(()=>[...new Set(allRecords.map(r=>r.collection))].sort((a,b)=>a.localeCompare(b,'es')),[allRecords]);
  const submit=e=>{e.preventDefault();const p=new URLSearchParams();if(term)p.set('q',term);if(advType)p.set('type',advType);if(advYear)p.set('year',advYear);if(advCollection)p.set('collection',advCollection);nav(`/archivo?${p.toString()}`);setTerm('');setShowResults(false)};
  const goTo=path=>{nav(path);setTerm('');setShowResults(false)};
  useEffect(()=>{const onClick=e=>{if(searchRef.current&&!searchRef.current.contains(e.target))setShowResults(false)};document.addEventListener('mousedown',onClick);return()=>document.removeEventListener('mousedown',onClick)},[]);
  return <main className="home-page">
    <section className="hero-new" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
      <div className="hero-photo" key={`photo-${slide}`}><img src={heroSlides[slide].image} alt={heroSlides[slide].alt} loading="eager" decoding="async"/><div className="photo-shade"/></div>
      <div className="hero-edition">ARCHIVO DIGITAL<br/>EDICIÓN 2026</div>
      <div className="hero-title" key={`title-${slide}`}>
        <div className="eyebrow"><span>●</span> {heroSlides[slide].eyebrow}</div>
        <h1>{heroSlides[slide].title}</h1>
        <p>{heroSlides[slide].desc}</p>
      </div>
      <div className="hero-index">
        <button type="button" className="hero-index-btn" onClick={prevSlide} aria-label="Diapositiva anterior"><ChevronLeft/></button>
        <b>{String(slide+1).padStart(2,'0')}</b><span/>{String(heroSlides.length).padStart(2,'0')}
        <button type="button" className="hero-index-btn" onClick={nextSlide} aria-label="Siguiente diapositiva"><ChevronRight/></button>
      </div>
      <div className="hero-bottom-right">
        <Link className="hero-cta" to={heroSlides[slide].link}>Explorar <ArrowRight/></Link>
        <div className="hero-dots">{heroSlides.map((s,i)=><button type="button" key={i} className={i===slide?'active':''} onClick={()=>setSlide(i)} aria-label={`Ir a la diapositiva ${i+1}`}/>)}</div>
      </div>
    </section>
    <section className="search-stage" data-reveal><div className="search-intro"><span>ENCUENTRA ALGO</span><p>Más de mil historias esperan<br/>ser encontradas.</p></div><div className="searchbox-wrap" ref={searchRef}><form className="searchbox" onSubmit={submit}><Search/><input value={term} onChange={e=>{setTerm(e.target.value);setShowResults(true)}} onFocus={()=>term&&setShowResults(true)} placeholder="Título, persona, año, tema…"/><button><ArrowRight/></button></form>{showResults&&term&&<SearchResults results={results} onPick={goTo} className="home-results"/>}</div><button className="advanced-trigger" onClick={()=>setAdvanced(!advanced)}><Settings2/> Búsqueda avanzada</button>{advanced&&<div className="advanced-box"><label>Tipo de registro<select value={advType} onChange={e=>setAdvType(e.target.value)}><option value="">Cualquier tipo</option>{sections.map(s=><option key={s.type} value={s.type}>{s.type}</option>)}</select></label><label>Década<select value={advYear} onChange={e=>setAdvYear(e.target.value)}><option value="">Cualquier fecha</option>{decadeOptions.map(d=><option key={d} value={d}>Década de {d}</option>)}</select></label><label>Colección<select value={advCollection} onChange={e=>setAdvCollection(e.target.value)}><option value="">Cualquier colección</option>{collectionOptions.map(c=><option key={c} value={c}>{c}</option>)}</select></label></div>}</section>
    <section className="portal" data-reveal><div className="section-label"><span>01</span> ENTRAR AL ARCHIVO</div><div className="portal-head"><h2>Cinco puertas.<br/><em>Infinitas conexiones.</em></h2><p>Cada área vive ahora en su propia página, con filtros y contenidos específicos para encontrar lo que buscas más rápido.</p></div><div className="portal-list">{sections.map(({label,slug,type,icon:Icon},i)=><Link key={slug} to={`/${slug}`} className="stagger-item" style={{transitionDelay:`${i*60}ms`}}><span className="portal-num">0{i+1}</span><Icon/><strong>{label}</strong><small>{String(countByType(type)).padStart(3,'0')} registros</small><ArrowDownRight className="portal-arrow"/></Link>)}</div></section>
    <section className="home-discovery" data-reveal><div className="home-discovery-head"><div className="section-label"><span>02</span> OTRAS FORMAS DE EXPLORAR</div><h2>El archivo desde<br/>otras perspectivas.</h2></div><div className="discovery-tiles"><Link to="/colecciones" className="stagger-item" style={{transitionDelay:'0ms'}}><span>01</span><div><small>RECORRIDOS TEMÁTICOS</small><h3>Colecciones</h3><p>Historias reunidas por temas, épocas y comunidades.</p></div><ArrowDownRight/></Link><Link to="/linea-de-tiempo" className="stagger-item" style={{transitionDelay:'60ms'}}><span>02</span><div><small>HISTORIA AUDIOVISUAL</small><h3>Línea de tiempo</h3><p>Recorre los hitos cinematográficos del territorio.</p></div><ArrowDownRight/></Link><Link to="/mapa" className="stagger-item" style={{transitionDelay:'120ms'}}><span>03</span><div><small>GEOGRAFÍA DEL ARCHIVO</small><h3>Mapa territorial</h3><p>Descubre registros conectados con cada localidad.</p></div><MapPin/></Link><Link to="/nosotros" className="stagger-item" style={{transitionDelay:'180ms'}}><span>04</span><div><small>MEMORIA INSTITUCIONAL</small><h3>La Cineteca</h3><p>Conoce nuestra historia, misión y trabajo patrimonial.</p></div><ArrowDownRight/></Link></div></section>
    <section className="spotlight" data-reveal><div className="spotlight-copy"><div className="section-label light"><span>02</span> PIEZA DESTACADA</div><span className="spot-kicker">DOCUMENTAL · 1972 · 16 MM</span><h2>Canto a<br/><i>la tierra</i></h2><p>{records[0].description}</p><dl><div><dt>Dirección</dt><dd>Sergio Trabucco</dd></div><div><dt>Colección</dt><dd>Memoria rural</dd></div></dl><Link to="/ficha/1">Abrir ficha <ArrowRight/></Link></div><div className="spotlight-image"><img src={records[0].image} alt="Paisaje del Limarí" loading="lazy" decoding="async"/><div className="film-code">CDO · F016 · 0048</div><span className="restore-tag"><Sparkles/> Digitalización 4K</span><Link className="spot-play" to="/ficha/1"><CirclePlay/></Link></div></section>
    <section className="home-latest" data-reveal><div className="section-label"><span>03</span> HALLAZGOS RECIENTES</div><div className="home-latest-head"><h2>Recién catalogado</h2><Link to="/archivo">Ver todo el archivo <ArrowRight/></Link></div><div className="record-grid">{records.slice(0,4).map((r,i)=><RecordCard item={r} index={i} key={r.id}/>)}</div></section>
    <section className="manifesto" data-reveal><div className="manifesto-mark">“</div><p>Preservar una imagen es devolverle<br/>al territorio una parte de su <em>memoria.</em></p><div><span>CINETECA DE OVALLE</span><small>DESDE 1968 · REGIÓN DE COQUIMBO</small></div></section>
  </main>
}

const PAGE_SIZE=8;
function pageNumbers(current,total){
  const out=[];
  for(let i=1;i<=total;i++){
    if(i===1||i===total||(i>=current-1&&i<=current+1))out.push(i);
    else if(out[out.length-1]!=='…')out.push('…');
  }
  return out;
}

const pageInfo={
  archivo:{title:'Archivo abierto',eyebrow:'TODOS LOS REGISTROS',desc:'Busca de forma transversal en películas, personas, prensa, entrevistas y artículos.',image:'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=88'},
  peliculas:{title:'Películas',eyebrow:'OBRAS AUDIOVISUALES',desc:'Ficción, documental y registros de la memoria audiovisual del Valle del Limarí.',image:'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1600&q=88'},
  personas:{title:'Personas',eyebrow:'VOCES Y OFICIOS',desc:'Directoras, actores, técnicos y gestores que han construido el cine regional.',image:'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1600&q=88'},
  prensa:{title:'Archivo de prensa',eyebrow:'DOCUMENTOS HISTÓRICOS',desc:'Recortes, programas y materiales que registran la vida cinematográfica de Ovalle.',image:'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1600&q=88'},
  entrevistas:{title:'Entrevistas',eyebrow:'MEMORIA ORAL',desc:'Relatos en texto, audio y video de quienes vivieron y construyeron esta historia.',image:'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1600&q=88'},
  articulos:{title:'Artículos y crítica',eyebrow:'IDEAS EN CIRCULACIÓN',desc:'Investigaciones, ensayos y miradas contemporáneas sobre el patrimonio audiovisual.',image:'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1600&q=88'}
};

export function ArchivePage({kind='archivo'}){
  const [params,setParams]=useSearchParams(), [showFilters,setShowFilters]=useState(false); const info=pageInfo[kind], section=sections.find(s=>s.slug===kind); const q=params.get('q')||'';
  const year=params.get('year')||'', collection=params.get('collection')||'', recordType=params.get('type')||'';
  const reverseOrder=['personas','prensa','entrevistas','articulos'].includes(kind);
  const compactCards=reverseOrder;
  const decadeOf=r=>{const m=/\d{4}/.exec(r.year);return m?Math.floor(Number(m[0])/10)*10:null};
  const scoped=useMemo(()=>getAllRecords().filter(r=>!section||r.type===section.type),[section]);
  const decadeOptions=useMemo(()=>[...new Set(scoped.map(decadeOf).filter(d=>d!==null))].sort((a,b)=>a-b),[scoped]);
  const collectionOptions=useMemo(()=>[...new Set(scoped.map(r=>r.collection))].sort((a,b)=>a.localeCompare(b,'es')),[scoped]);
  const list=useMemo(()=>{const filtered=getAllRecords().filter(r=>(!section||r.type===section.type)&&(!recordType||r.type===recordType)&&(!year||decadeOf(r)===Number(year))&&(!collection||r.collection===collection)&&`${r.title} ${r.subtitle} ${r.year} ${r.collection} ${r.description}`.toLowerCase().includes(q.toLowerCase()));return reverseOrder?filtered.reverse():filtered},[q,section,year,collection,recordType,reverseOrder]);
  const totalPages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
  const page=Math.min(totalPages,Math.max(1,Number(params.get('page'))||1));
  const pagedList=useMemo(()=>list.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),[list,page]);
  const goToPage=n=>{const next=new URLSearchParams(params);n>1?next.set('page',n):next.delete('page');setParams(next);window.scrollTo({top:0,left:0,behavior:'instant'})};
  const update=e=>{const v=e.target.value,next=new URLSearchParams(params);v?next.set('q',v):next.delete('q');next.delete('page');setParams(next)};
  const setFilter=(key,value)=>{const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);next.delete('page');setParams(next)};
  const view=params.get('view')==='list'?'list':'grid';
  const setView=v=>{const next=new URLSearchParams(params);v==='grid'?next.delete('view'):next.set('view',v);setParams(next)};
  const headerCount=section?countByType(section.type):getAllRecords().length;
  return <main className="catalog-page"><section className="page-hero"><img src={info.image} alt=""/><div className="page-hero-shade"/><div><span>{info.eyebrow}</span><h1>{info.title}</h1><p>{info.desc}</p></div><b><Counter value={headerCount} pad={3}/><small>REGISTROS</small></b></section>
    <section className="catalog-content" data-reveal><div className="catalog-tools"><div className="catalog-search"><Search/><input value={q} onChange={update} placeholder={`Buscar en ${info.title.toLowerCase()}…`}/>{q&&<button onClick={()=>setParams({})}><X/></button>}</div><button className="filter-toggle" onClick={()=>setShowFilters(!showFilters)}><Settings2/> Filtros</button></div>
    {showFilters&&<div className="filter-panel"><label>Tipo de registro<select value={recordType} onChange={e=>setFilter('type',e.target.value)} disabled={!!section}><option value="">Todos</option>{sections.map(s=><option key={s.type}>{s.type}</option>)}</select></label><label>Año<select value={year} onChange={e=>setFilter('year',e.target.value)}><option value="">Todos los años</option>{decadeOptions.map(d=><option key={d} value={d}>Década de {d}</option>)}</select></label><label>Colección<select value={collection} onChange={e=>setFilter('collection',e.target.value)}><option value="">Todas las colecciones</option>{collectionOptions.map(c=><option key={c} value={c}>{c}</option>)}</select></label></div>}
    <div className="catalog-heading"><p><b>{list.length}</b> resultados {q&&<>para “{q}”</>}</p><div className="view-toggle"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="Vista de cuadrícula"><Grid2X2/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="Vista de lista"><List/></button></div></div>
    {view==='grid'
      ?<div className={`record-grid${compactCards?' record-grid-compact':''}`}>{pagedList.map((r,i)=><RecordCard item={r} index={i} key={r.id}/>)}</div>
      :<div className="record-list">{pagedList.map((r,i)=><RecordRow item={r} index={i} key={r.id}/>)}</div>}
    {!list.length&&<div className="no-results"><Search/><h3>No encontramos coincidencias.</h3><p>Prueba con otro término de búsqueda.</p><button onClick={()=>setParams({})}>Limpiar búsqueda</button></div>}
    {totalPages>1&&<nav className="pagination"><button disabled={page===1} onClick={()=>goToPage(page-1)}><ArrowLeft/> Anterior</button><div className="pagination-pages">{pageNumbers(page,totalPages).map((n,i)=>n==='…'?<span key={`e${i}`}>…</span>:<button key={n} className={n===page?'active':''} onClick={()=>goToPage(n)}>{n}</button>)}</div><button disabled={page===totalPages} onClick={()=>goToPage(page+1)}>Siguiente <ArrowRight/></button></nav>}</section>
  </main>
}

export function DetailPage(){const {id}=useParams();const item=records.find(r=>r.id===Number(id));if(!item)return <Navigate to="/archivo"/>;const related=records.filter(r=>r.id!==item.id).slice(0,3);return <main className="detail-page"><Link className="back-link" to={`/${item.slug}`}><ArrowLeft/> Volver a {item.slug}</Link><section className="detail-hero"><div className="detail-image"><img src={item.image} alt=""/><span style={{background:item.color}}>{item.type}</span></div><div className="detail-copy"><span>FICHA CDO—{String(item.id).padStart(4,'0')}</span><h1>{item.title}</h1><p>{item.description}</p><dl><div><dt>Fecha</dt><dd>{item.year}</dd></div><div><dt>Autoría</dt><dd>{item.subtitle}</dd></div><div><dt>Formato</dt><dd>{item.format}</dd></div><div><dt>Colección</dt><dd>{item.collection}</dd></div></dl><button><CirclePlay/> Consultar archivo digital</button></div></section><section className="related-page"><div className="section-label"><span>+</span> RECURSOS RELACIONADOS</div><div className="record-grid">{related.map((r,i)=><RecordCard item={r} index={i} key={r.id}/>)}</div></section></main>}

export function AboutPage(){
  return <main className="about-page">
    <section className="about-hero"><img src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>NUESTRA HISTORIA</span><h1>Una memoria<br/>en <i>movimiento.</i></h1><p>La Cineteca de Ovalle preserva, investiga y comparte el patrimonio audiovisual de la Provincia del Limarí.</p></section>
    <section className="about-body" data-reveal>
      <div className="about-intro">
        <div className="ficha-section-label"><span>01</span> LA CINETECA</div>
        <h2>Las imágenes también construyen territorio.</h2>
        <p>Desde las primeras funciones comunitarias hasta los procesos actuales de digitalización, este archivo reúne las huellas de una cultura cinematográfica profundamente vinculada con su gente.</p>
        <p>Nuestra misión es conservar esas imágenes y devolverlas a la comunidad como una memoria abierta, accesible y viva.</p>
      </div>
      <div className="about-stats">
        <div><strong><Counter value={1968}/></strong><span>Año de fundación</span></div>
        <div><strong><Counter value={`${getAllRecords().length}+`}/></strong><span>Registros catalogados</span></div>
        <div><strong><Counter value={locations.length}/></strong><span>Comunas del Limarí</span></div>
      </div>
    </section>
    <section className="about-milestones" data-reveal>
      <div className="ficha-relacionados-head"><div className="ficha-section-label"><span>02</span> HITOS</div></div>
      <div className="about-milestones-list">
        <article className="stagger-item" style={{transitionDelay:'0ms'}}><b>1968</b><h3>Primeras funciones</h3><p>Comienza una experiencia de exhibición y formación cinematográfica en Ovalle.</p></article>
        <article className="stagger-item" style={{transitionDelay:'80ms'}}><b>1977</b><h3>Archivo ciudadano</h3><p>La comunidad conserva afiches, programas y registros de una década fundamental.</p></article>
        <article className="stagger-item" style={{transitionDelay:'160ms'}}><b>2026</b><h3>Cineteca digital</h3><p>El patrimonio vuelve a circular mediante una plataforma abierta y conectada.</p></article>
      </div>
    </section>
    <section className="about-cta" data-reveal><h2>Ven a conocer<br/><em>el archivo.</em></h2><div><Link to="/archivo">Explorar el archivo <ArrowRight/></Link><Link to="/mapa">Ver el mapa territorial <ArrowRight/></Link></div></section>
  </main>
}

export function AdminPage(){const [notice,setNotice]=useState('');return <div className="admin-page"><header><Brand/><div><span>GESTIÓN DEL ARCHIVO</span><Link to="/"><X/> Salir</Link></div></header><main className="admin-content"><aside><button className="active"><Grid2X2/> Resumen</button><button><Film/> Registros</button><button><UserRound/> Personas</button><button><FileText/> Colecciones</button></aside><section><div className="admin-title"><div><span>18 SEPTIEMBRE 2026</span><h2>Hola, Andrea.</h2><p>Esto es lo que ocurre hoy en el archivo.</p></div><button onClick={()=>setNotice('Formulario de catalogación preparado para un nuevo registro.')}><Plus/> Nuevo registro</button></div>{notice&&<div className="notice">{notice}<button onClick={()=>setNotice('')}><X/></button></div>}<div className="admin-kpis"><article><span>REGISTROS</span><strong>1.075</strong><small>+24 este mes</small></article><article><span>POR REVISAR</span><strong>18</strong><small>Metadatos incompletos</small></article><article><span>DIGITALIZADO</span><strong>78%</strong><small>842 archivos</small></article></div><div className="admin-table"><div className="table-title"><h3>Actividad reciente</h3><button>Ver catálogo <ArrowRight/></button></div>{records.slice(0,6).map(r=><div className="table-item" key={r.id}><img src={r.image} alt=""/><strong>{r.title}</strong><span>{r.type}</span><span className="published">● Publicado</span><small>Hoy</small><button onClick={()=>setNotice(`Editando “${r.title}”.`)}>Editar</button></div>)}</div></section></main></div>}

function MediaViewer({item,extra}){
  if(extra?.mediaType==='video')return <div className="media-viewer"><video controls poster={item.image} preload="none"><source src={extra.media} type="video/mp4"/></video><span>VERSIÓN DE CONSULTA · ARCHIVO CDO</span></div>;
  if(extra?.mediaType==='audio')return <div className="media-viewer audio-viewer"><img src={item.image} alt="" loading="lazy" decoding="async"/><div><Headphones/><h3>Escuchar entrevista</h3><audio controls preload="none" src={extra.media}/></div></div>;
  if(extra?.mediaType==='document')return <div className="media-viewer document-viewer"><FileText/><span>DOCUMENTO DIGITALIZADO</span><h3>{item.title}</h3><p>Vista previa del documento · {item.format}</p><button><Download/> Descargar PDF</button></div>;
  return <div className="media-viewer"><img src={item.image} alt={item.title} loading="lazy" decoding="async"/><span>IMAGEN DIGITALIZADA · ARCHIVO CDO</span></div>;
}

export function RichDetailPage(){
  const {id}=useParams(), item=getAllRecords().find(r=>r.id===Number(id)); if(!item)return <Navigate to="/archivo"/>;
  const extra=recordExtras[item.id]||{credits:[['Estado','Catalogado'],['Origen','Archivo CDO']],relations:[],location:'Ovalle',mediaType:'image'};
  const related=(extra.relations||[]).map(rid=>getAllRecords().find(r=>r.id===rid)).filter(Boolean);
  return <main className="ficha-page">
    <section className="ficha-hero">
      <img src={item.image} alt="" loading="lazy" decoding="async"/>
      <div className="ficha-hero-shade"/>
      <Link className="back-link" to={`/${item.slug}`}><ArrowLeft/> Volver a {item.slug}</Link>
      <div className="ficha-hero-content">
        <span className="ficha-tag" style={{background:item.color}}>{item.type}</span>
        <span className="ficha-code">FICHA CDO—{String(item.id).padStart(4,'0')}</span>
        <h1>{item.title}</h1>
        <p>{item.description}</p>
      </div>
    </section>
    <section className="ficha-body" data-reveal>
      <article className="ficha-main">
        <div className="ficha-section-label"><span>01</span> DESCRIPCIÓN</div>
        <h2>Una pieza, múltiples lecturas.</h2>
        <p>{item.description} Este registro forma parte de un proceso continuo de investigación, preservación y acceso comunitario al patrimonio audiovisual de la Provincia del Limarí.</p>
        <div className="ficha-credits">{extra.credits.map(([k,v],i)=><div key={k} className="stagger-item" style={{transitionDelay:`${i*60}ms`}}><small>{k}</small><strong>{v}</strong></div>)}</div>
        <div className="ficha-media" id="media">
          <div className="ficha-section-label"><span>02</span> ARCHIVO DIGITAL</div>
          <MediaViewer item={item} extra={extra}/>
        </div>
        {extra.gallery?.length>0&&<div className="ficha-gallery">
          <div className="ficha-section-label"><span>03</span> GALERÍA</div>
          <div className="ficha-gallery-grid">{extra.gallery.map((src,i)=><img src={src} alt={`Material asociado ${i+1}`} key={src} loading="lazy" decoding="async"/>)}</div>
        </div>}
      </article>
      <aside className="ficha-aside">
        <dl className="ficha-facts"><div><dt>Fecha</dt><dd>{item.year}</dd></div><div><dt>Autoría</dt><dd>{item.subtitle}</dd></div><div><dt>Formato</dt><dd>{item.format}</dd></div><div><dt>Colección</dt><dd>{item.collection}</dd></div></dl>
        <a className="ficha-cta" href="#media"><CirclePlay/> Consultar archivo digital</a>
        <div className="ficha-location"><span><MapPin/> UBICACIÓN ASOCIADA</span><strong>{extra.location}</strong><Link to="/mapa">Ver en el mapa <ArrowRight/></Link></div>
        {related.length>0&&<div className="ficha-related-chips"><span>REGISTROS RELACIONADOS</span>{related.map(r=><Link to={`/ficha/${r.id}`} key={r.id}><div><small>{r.type}</small><strong>{r.title}</strong></div><ArrowRight/></Link>)}</div>}
      </aside>
    </section>
    {related.length>0&&<section className="ficha-relacionados" data-reveal>
      <div className="ficha-relacionados-head"><div className="ficha-section-label"><span>+</span> RECURSOS RELACIONADOS</div><span className="ficha-relacionados-count">{String(related.length).padStart(2,'0')} REGISTROS</span></div>
      <div className="record-grid record-grid-compact">{related.map((r,i)=><RecordCard item={r} index={i} key={r.id}/>)}</div>
    </section>}
  </main>
}

export function CollectionsPage(){return <main className="discovery-page"><section className="discovery-hero"><img src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>RECORRIDOS CURATORIALES</span><h1>Colecciones</h1><p>Entradas temáticas para descubrir conexiones inesperadas dentro del archivo.</p></section><section className="collections-grid" data-reveal>{collections.map((c,i)=><Link to={`/archivo?collection=${encodeURIComponent(c.title)}`} className="collection-card stagger-item" style={{transitionDelay:`${i*80}ms`}} key={c.slug}><img src={c.image} alt="" loading="lazy" decoding="async"/><div className="collection-shade"/><span>0{i+1} · {c.years}</span><h2>{c.title}</h2><p>{c.description}</p><b style={{background:c.color}}>{countByCollection(c.title)} registros <ArrowRight/></b></Link>)}</section></main>}

export function TimelinePage(){
  const [active,setActive]=useState(timelineEvents[0]);
  return <main className="timeline-page">
    <section className="discovery-hero"><img src="https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>HISTORIA AUDIOVISUAL</span><h1>Línea de tiempo</h1><p>Ochenta años de imágenes, encuentros y memoria en movimiento.</p></section>
    <section className="timeline-layout" data-reveal>
      <div className="timeline-spine">
        {timelineEvents.map((e,i)=><button key={e.year} className={`timeline-entry${active.year===e.year?' active':''} stagger-item`} style={{transitionDelay:`${(i%8)*50}ms`}} onClick={()=>setActive(e)}>
          <span className="timeline-entry-year">{e.year}</span>
          <span className="timeline-entry-line"><span className="timeline-entry-dot"/></span>
          <span className="timeline-entry-body"><small>{e.type}</small><strong>{e.title}</strong></span>
        </button>)}
      </div>
      <aside className="timeline-detail">
        <img src={active.image} alt="" loading="lazy" decoding="async"/>
        <div className="timeline-detail-copy">
          <span>{active.type} · {active.year}</span>
          <h2>{active.title}</h2>
          <p>{active.text}</p>
          <Link to="/archivo">Explorar registros <ArrowRight/></Link>
        </div>
      </aside>
    </section>
  </main>
}

export function MapPage(){
  const [selected,setSelected]=useState(locations[0]);
  const delta=selected.name==='Combarbalá'?0.25:0.18;
  const bbox=`${selected.lon-delta},${selected.lat-delta},${selected.lon+delta},${selected.lat+delta}`;
  const mapUrl=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${selected.lat}%2C${selected.lon}`;
  return <main className="map-page"><section className="discovery-hero"><img src="https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>GEOGRAFÍA DEL ARCHIVO</span><h1>Mapa del Limarí</h1><p>Explora las obras, personas y documentos según su vínculo con el territorio.</p></section><section className="map-explorer" data-reveal><div className="archive-map real-map"><iframe key={selected.id} title={`Mapa de ${selected.name}`} src={mapUrl} loading="lazy"/><div className="map-caption"><MapPin/> Mapa geográfico · OpenStreetMap</div></div><aside><span>LOCALIDAD SELECCIONADA</span><h2>{selected.name}</h2><div className="map-location-list">{locations.map(l=><button key={l.id} className={selected.id===l.id?'active':''} onClick={()=>setSelected(l)}><MapPin/>{l.name}<b>{countByLocation(l.name)}</b></button>)}</div><strong>{countByLocation(selected.name)}</strong><small>REGISTROS VINCULADOS</small><p>{selected.text}</p><Link to={`/archivo?q=${encodeURIComponent(selected.name)}`}>Explorar registros <ArrowRight/></Link></aside></section></main>
}

export function EnhancedAdminPage(){
  const [notice,setNotice]=useState(''),[formOpen,setFormOpen]=useState(false),[form,setForm]=useState({title:'',type:'Película',year:'2026',subtitle:'',collection:'',description:''}),[items,setItems]=useState(()=>getAllRecords());
  const change=e=>setForm({...form,[e.target.name]:e.target.value});
  const submit=e=>{e.preventDefault();const created=addRecord(form);setItems(getAllRecords());setFormOpen(false);setNotice(`“${created.title}” fue guardado y ya aparece en el archivo.`);setForm({title:'',type:'Película',year:'2026',subtitle:'',collection:'',description:''})};
  return <div className="admin-page"><header><Brand/><div><span>GESTIÓN DEL ARCHIVO</span><Link to="/"><X/> Salir</Link></div></header><main className="admin-content"><aside><button className="active"><Grid2X2/> Resumen</button><button><Film/> Registros</button><button><UserRound/> Personas</button><button><FileText/> Colecciones</button><div className="role-card"><small>SESIÓN ACTIVA</small><strong>Andrea M.</strong><span>Administradora</span></div></aside><section><div className="admin-title"><div><span>18 SEPTIEMBRE 2026</span><h2>Hola, Andrea.</h2><p>Esto es lo que ocurre hoy en el archivo.</p></div><button onClick={()=>setFormOpen(true)}><Plus/> Nuevo registro</button></div>{notice&&<div className="notice">{notice}<button onClick={()=>setNotice('')}><X/></button></div>}<div className="admin-kpis" data-reveal><article className="stagger-item" style={{transitionDelay:'0ms'}}><span>REGISTROS</span><strong>{items.length.toLocaleString('es-CL')}</strong><small>Catálogo activo</small></article><article className="stagger-item" style={{transitionDelay:'70ms'}}><span>POR REVISAR</span><strong>18</strong><small>Metadatos incompletos</small></article><article className="stagger-item" style={{transitionDelay:'140ms'}}><span>DIGITALIZADO</span><strong>78%</strong><small>842 archivos</small></article></div><div className="admin-table"><div className="table-title"><h3>Actividad reciente</h3><Link to="/archivo">Ver catálogo <ArrowRight/></Link></div>{items.slice(-6).reverse().map(r=><div className="table-item" key={r.id}><img src={r.image} alt="" loading="lazy" decoding="async"/><strong>{r.title}</strong><span>{r.type}</span><span className="published">● Publicado</span><small>{r.id>1000?'Ahora':'Hoy'}</small><button onClick={()=>setNotice(`La ficha “${r.title}” está lista para editar.`)}>Editar</button></div>)}</div></section></main>
  {formOpen&&<div className="form-layer"><form className="record-form" onSubmit={submit}><div><span>NUEVA FICHA</span><button type="button" onClick={()=>setFormOpen(false)}><X/></button></div><h2>Catalogar registro</h2><div className="form-grid"><label>Título<input required name="title" value={form.title} onChange={change}/></label><label>Tipo<select name="type" value={form.type} onChange={change}>{sections.map(s=><option key={s.type}>{s.type}</option>)}</select></label><label>Año<input required name="year" value={form.year} onChange={change}/></label><label>Autoría / fuente<input required name="subtitle" value={form.subtitle} onChange={change}/></label><label className="full">Colección<input name="collection" value={form.collection} onChange={change}/></label><label className="full">Descripción<textarea required name="description" value={form.description} onChange={change}/></label></div><div className="form-actions"><button type="button" onClick={()=>setFormOpen(false)}>Guardar borrador</button><button>Publicar registro <ArrowRight/></button></div></form></div>}</div>
}
