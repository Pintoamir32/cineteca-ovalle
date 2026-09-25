import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, CalendarDays, CirclePlay, Clapperboard, Clock, Film, Grid2X2, List, MapPin, Search, Settings2, Table2, X } from 'lucide-react';
import { Counter, RecordCard, RecordRow } from './components';
import { collections, locations, recordExtras, sections, timelineEvents } from './data';
import { countByCollection, countByLocation, countByType, getAllRecords, getFilmPeople, getFilmography, getLocations, getRecordPeople, placesOf, findRecordByParam, recordPath, recordSlug } from './repository';
import { useEdit } from './edit-context';
import { SearchSelect } from './SearchSelect';
import { BackLink, DocumentView, MediaViewer } from './record-views';
import { tagStyle } from './color';


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

const formatParts=r=>(r.format||'').split(' · ');
// Rangos de duración: minutos → categoría de metraje
const METRAJES=[
  {label:'Cortometraje',hint:'menos de 30 min',test:m=>m<30},
  {label:'Mediometraje',hint:'30 a 59 min',test:m=>m>=30&&m<60},
  {label:'Largometraje',hint:'60 min o más',test:m=>m>=60}
];
const metrajeOf=r=>{const m=Number((/(\d+)\s*min/.exec(formatParts(r)[1]||'')||[])[1]);return m?METRAJES.find(x=>x.test(m))?.label:undefined};
// Minúsculas y sin tildes, para buscar "munoz" y encontrar "Muñoz"
const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
// Personas vinculadas a una película (para filtrar y buscar)
const filmPeopleNames=r=>r.type==='Película'?getFilmPeople(r).map(e=>e.person.title):[];
const searchText=r=>fold([r.title,r.subtitle,r.year,r.collection,r.description,...(recordExtras[r.id]?.credits||[]).map(c=>c[1]),...filmPeopleNames(r)].join(' '));
// Filtros exactos enlazados desde la ficha de película
const FACETS=[
  {key:'director',label:'Dirección',get:r=>r.subtitle},
  {key:'anio',label:'Año',get:r=>r.year},
  {key:'genero',label:'Género',get:r=>formatParts(r)[0]},
  {key:'metraje',label:'Duración',get:metrajeOf},
  {key:'duracion',label:'Duración',get:r=>formatParts(r)[1]},
  {key:'soporte',label:'Soporte',get:r=>formatParts(r)[2]},
  {key:'locacion',label:'Locación',get:r=>getLocations(r.id)},
  {key:'persona',label:'Persona',get:r=>filmPeopleNames(r)}
];
const FACET_KEY={Dirección:'director',Año:'anio',Género:'genero',Duración:'duracion',Soporte:'soporte'};

/* Vista de tabla: columnas según la sección, ordenables desde el encabezado */
const yearNum=r=>Number((/\d{4}/.exec(r.year)||[])[0])||0;
const minutes=r=>Number((/(\d+)\s*min/.exec(formatParts(r)[1]||'')||[])[1])||0;
const SUBTITLE={peliculas:'Dirección',personas:'Roles',prensa:'Medio',entrevistas:'Persona entrevistada',articulos:'Autoría'};
function tableColumns(kind){
  const cols=[{key:'title',label:'Título',get:r=>r.title}];
  if(kind==='archivo')cols.push({key:'type',label:'Tipo',get:r=>r.type});
  cols.push({key:'subtitle',label:SUBTITLE[kind]||'Autoría',get:r=>r.subtitle});
  cols.push({key:'year',label:kind==='personas'?'Años':'Año',get:r=>r.year,sort:yearNum,num:true});
  if(kind==='peliculas')cols.push({key:'genre',label:'Género',get:r=>formatParts(r)[0]},{key:'duration',label:'Duración',get:r=>formatParts(r)[1],sort:minutes,num:true});
  else if(kind!=='personas')cols.push({key:'format',label:'Formato',get:r=>formatParts(r)[0]});
  cols.push({key:'collection',label:'Colección',get:r=>r.collection});
  return cols;
}

export function ArchivePage({kind='archivo'}){
  const [params,setParams]=useSearchParams(), [showFilters,setShowFilters]=useState(false); const info=pageInfo[kind], section=sections.find(s=>s.slug===kind); const q=params.get('q')||'';
  const year=params.get('year')||'', collection=params.get('collection')||'', recordType=params.get('type')||'';
  const activeFacets=FACETS.map(f=>({...f,value:params.get(f.key)||''})).filter(f=>f.value), facetSig=activeFacets.map(f=>`${f.key}=${f.value}`).join('&');
  const reverseOrder=['personas','prensa','entrevistas','articulos'].includes(kind);
  const compactCards=reverseOrder;
  const decadeOf=r=>{const m=/\d{4}/.exec(r.year);return m?Math.floor(Number(m[0])/10)*10:null};
  const scoped=useMemo(()=>getAllRecords().filter(r=>!section||r.type===section.type),[section]);
  const decadeOptions=useMemo(()=>[...new Set(scoped.map(decadeOf).filter(d=>d!==null))].sort((a,b)=>a-b),[scoped]);
  const collectionOptions=useMemo(()=>[...new Set(scoped.map(r=>r.collection))].sort((a,b)=>a.localeCompare(b,'es')),[scoped]);
  const directorOptions=useMemo(()=>[...new Set(scoped.map(r=>r.subtitle).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[scoped]);
  const personOptions=useMemo(()=>kind==='peliculas'?[...new Set(scoped.flatMap(filmPeopleNames))].sort((a,b)=>a.localeCompare(b,'es')):[],[scoped,kind]);
  const genreOptions=useMemo(()=>[...new Set(scoped.map(r=>formatParts(r)[0]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[scoped]);
  const list=useMemo(()=>{const filtered=getAllRecords().filter(r=>(!section||r.type===section.type)&&(!recordType||r.type===recordType)&&(!year||decadeOf(r)===Number(year))&&(!collection||r.collection===collection)&&activeFacets.every(f=>{const v=f.get(r);return Array.isArray(v)?v.includes(f.value):v===f.value})&&searchText(r).includes(fold(q)));return reverseOrder?filtered.reverse():filtered},[q,section,year,collection,recordType,facetSig,reverseOrder]);
  const view=['list','table'].includes(params.get('view'))?params.get('view'):'grid';
  const columns=useMemo(()=>tableColumns(kind),[kind]);
  const sortKey=params.get('orden')||'', sortDir=params.get('dir')==='desc'?'desc':'asc';
  const sorted=useMemo(()=>{
    const col=columns.find(c=>c.key===sortKey);if(!col)return list;
    const val=col.sort||col.get, factor=sortDir==='desc'?-1:1;
    return [...list].sort((a,b)=>{const x=val(a),y=val(b);return factor*(col.num||col.sort?(x-y):String(x||'').localeCompare(String(y||''),'es',{sensitivity:'base'}))});
  },[list,columns,sortKey,sortDir]);
  // Primer clic: ascendente; segundo: descendente
  const sortBy=key=>{const next=new URLSearchParams(params);const dir=sortKey===key&&sortDir==='asc'?'desc':'asc';next.set('orden',key);next.set('dir',dir);next.delete('page');setParams(next)};
  const perPage=view==='table'?20:PAGE_SIZE;
  const totalPages=Math.max(1,Math.ceil(list.length/perPage));
  const page=Math.min(totalPages,Math.max(1,Number(params.get('page'))||1));
  const pagedList=useMemo(()=>sorted.slice((page-1)*perPage,page*perPage),[sorted,page,perPage]);
  const navigate=useNavigate();
  const goToPage=n=>{const next=new URLSearchParams(params);n>1?next.set('page',n):next.delete('page');setParams(next);window.scrollTo({top:0,left:0,behavior:'instant'})};
  const update=e=>{const v=e.target.value,next=new URLSearchParams(params);v?next.set('q',v):next.delete('q');next.delete('page');setParams(next)};
  const setFilter=(key,value)=>{const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);next.delete('page');setParams(next)};
  const setView=v=>{const next=new URLSearchParams(params);v==='grid'?next.delete('view'):next.set('view',v);setParams(next)};
  const headerCount=section?countByType(section.type):getAllRecords().length;
  return <main className="catalog-page"><section className="page-hero"><img src={info.image} alt=""/><div className="page-hero-shade"/><div><span>{info.eyebrow}</span><h1>{info.title}</h1><p>{info.desc}</p></div><b><Counter value={headerCount} pad={3}/><small>REGISTROS</small></b></section>
    <section className="catalog-content" data-reveal><div className="catalog-tools"><div className="catalog-search"><Search/><input value={q} onChange={update} placeholder={kind==='peliculas'?'Buscar por título, director o persona…':`Buscar en ${info.title.toLowerCase()}…`}/>{q&&<button onClick={()=>setParams({})}><X/></button>}</div><button className="filter-toggle" onClick={()=>setShowFilters(!showFilters)}><Settings2/> Filtros</button></div>
    {showFilters&&<div className={`filter-panel${kind==='peliculas'?' filter-panel-wide':section?' filter-panel-two':''}`}>{!section&&<SearchSelect label="Tipo de registro" value={recordType} onChange={v=>setFilter('type',v)} options={[{value:'',label:'Todos'},...sections.map(s=>({value:s.type,label:s.type}))]}/>}<SearchSelect label="Año" value={year} onChange={v=>setFilter('year',v)} options={[{value:'',label:'Todos los años'},...decadeOptions.map(d=>({value:String(d),label:`Década de ${d}`}))]}/>{kind==='peliculas'&&<><SearchSelect label="Género" value={params.get('genero')||''} onChange={v=>setFilter('genero',v)} options={[{value:'',label:'Todos los géneros'},...genreOptions.map(g=>({value:g,label:`${g} (${scoped.filter(r=>formatParts(r)[0]===g).length})`}))]}/><SearchSelect label="Duración" value={params.get('metraje')||''} onChange={v=>setFilter('metraje',v)} options={[{value:'',label:'Cualquier duración'},...METRAJES.map(m=>({value:m.label,label:`${m.label} · ${m.hint} (${scoped.filter(r=>metrajeOf(r)===m.label).length})`}))]}/></>}{kind==='peliculas'&&<><SearchSelect label="Dirección" value={params.get('director')||''} onChange={v=>setFilter('director',v)} options={[{value:'',label:'Todas las direcciones'},...directorOptions.map(d=>({value:d,label:d}))]}/><SearchSelect label="Persona" value={params.get('persona')||''} onChange={v=>setFilter('persona',v)} options={[{value:'',label:'Cualquier persona'},...personOptions.map(n=>({value:n,label:`${n} (${scoped.filter(r=>filmPeopleNames(r).includes(n)).length})`}))]}/></>}<SearchSelect label="Colección" value={collection} onChange={v=>setFilter('collection',v)} options={[{value:'',label:'Todas las colecciones'},...collectionOptions.map(c=>({value:c,label:c}))]}/></div>}
    <div className="catalog-heading"><p><b>{list.length}</b> resultados {q&&<>para “{q}”</>}{activeFacets.map(f=><button key={f.key} className="catalog-chip" onClick={()=>setFilter(f.key,'')}>{f.label}: {f.value} <X/></button>)}</p><div className="view-toggle"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="Vista de cuadrícula"><Grid2X2/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="Vista de lista"><List/></button><button className={view==='table'?'active':''} onClick={()=>setView('table')} aria-label="Vista de tabla" title="Tabla ordenable"><Table2/></button></div></div>
    {view==='grid'
      ?<div className={`record-grid${compactCards?' record-grid-compact':''}${kind==='peliculas'?' record-grid-poster':''}`}>{pagedList.map((r,i)=><RecordCard item={r} index={i} key={r.id}/>)}</div>
      :view==='list'?<div className="record-list">{pagedList.map((r,i)=><RecordRow item={r} index={i} key={r.id}/>)}</div>
      :<div className="record-table-wrap"><table className="record-table">
        <thead><tr><th className="is-thumb" aria-label="Imagen"/>{columns.map(c=>{const on=sortKey===c.key;return <th key={c.key} aria-sort={on?(sortDir==='asc'?'ascending':'descending'):'none'} className={c.num?'is-num':undefined}>
          <button type="button" onClick={()=>sortBy(c.key)} title={`Ordenar por ${c.label.toLowerCase()}`}>{c.label}{on?(sortDir==='asc'?<ArrowUp/>:<ArrowDown/>):<ArrowUpDown className="is-idle"/>}</button>
        </th>})}</tr></thead>
        <tbody>{pagedList.map(r=><tr key={r.id} onClick={()=>navigate(recordPath(r))}>
          <td className="is-thumb"><img src={r.image} alt="" loading="lazy" decoding="async"/></td>
          {columns.map((c,i)=><td key={c.key} className={c.num?'is-num':undefined}>{i===0?<Link to={recordPath(r)} onClick={e=>e.stopPropagation()}>{c.get(r)}</Link>:c.key==='type'?<span className="record-table-tag" style={tagStyle(r.color)}>{c.get(r)}</span>:(c.get(r)||'—')}</td>)}
        </tr>)}</tbody>
      </table></div>}
    {!list.length&&<div className="no-results"><Search/><h3>No encontramos coincidencias.</h3><p>Prueba con otro término de búsqueda.</p><button onClick={()=>setParams({})}>Limpiar búsqueda</button></div>}
    {totalPages>1&&<nav className="pagination"><button disabled={page===1} onClick={()=>goToPage(page-1)}><ArrowLeft/> Anterior</button><div className="pagination-pages">{pageNumbers(page,totalPages).map((n,i)=>n==='…'?<span key={`e${i}`}>…</span>:<button key={n} className={n===page?'active':''} onClick={()=>goToPage(n)}>{n}</button>)}</div><button disabled={page===totalPages} onClick={()=>goToPage(page+1)}>Siguiente <ArrowRight/></button></nav>}</section>
  </main>
}

export function DetailPage(){const {id}=useParams();const item=getAllRecords().find(r=>r.id===Number(id));if(!item)return <Navigate to="/archivo"/>;const related=getAllRecords().filter(r=>r.id!==item.id).slice(0,3);return <main className="detail-page"><BackLink item={item}/><section className="detail-hero"><div className="detail-image"><img src={item.image} alt=""/><span style={tagStyle(item.color)}>{item.type}</span></div><div className="detail-copy"><span>FICHA CDO—{String(item.id).padStart(4,'0')}</span><h1>{item.title}</h1><p>{item.description}</p><dl><div><dt>Fecha</dt><dd>{item.year}</dd></div><div><dt>Autoría</dt><dd>{item.subtitle}</dd></div><div><dt>Formato</dt><dd>{item.format}</dd></div><div><dt>Colección</dt><dd>{item.collection}</dd></div></dl><button><CirclePlay/> Consultar archivo digital</button></div></section><section className="related-page"><div className="section-label"><span>+</span> RECURSOS RELACIONADOS</div><div className="record-grid">{related.map((r,i)=><RecordCard item={r} index={i} key={r.id}/>)}</div></section></main>}

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


const DEFAULT_EXTRA={credits:[['Estado','Catalogado'],['Origen','Archivo CDO']],relations:[],location:'Ovalle',mediaType:'image'};

export function RichDetailPage(){
  // La dirección lleva el nombre (/ficha/canto-a-la-tierra); los enlaces antiguos por número también sirven
  const {id}=useParams(), found=findRecordByParam(id), item=found&&getAllRecords().includes(found)?found:null;
  if(!item)return <Navigate to="/archivo" replace/>;
  if(id!==recordSlug(item))return <Navigate to={recordPath(item)} replace/>;
  return <RecordDetail key={item.id} item={item} extra={recordExtras[item.id]||DEFAULT_EXTRA}/>;
}

// Ficha pública de un registro. El gestor la usa también como vista previa editable (ver edit-context)
export function RecordDetail({item,extra}){
  const {edit,f,slot}=useEdit();
  const related=(extra.relations||[]).map(rid=>getAllRecords().find(r=>r.id===rid)).filter(Boolean);
  if(['Prensa','Entrevista','Artículo'].includes(item.type))return <DocumentView item={item} extra={extra} related={related} people={getRecordPeople(item,extra)}/>;
  const isFilm=item.type==='Película', isPerson=item.type==='Persona', placeList=placesOf(extra);
  const filmography=isPerson?getFilmography(item,extra):[];
  const people=isPerson?[]:getRecordPeople(item,extra);
  const credits=extra.credits||[], gallery=extra.gallery||[];
  const [genre,duration,medium]=(item.format||'').split(' · ');
  // En el gestor se muestran los tres datos aunque estén vacíos, para poder completarlos
  const parts=[['Género',genre,'format.0'],['Duración',duration,'format.1'],['Soporte',medium,'format.2']];
  const filmFormat=edit&&isFilm?parts:duration?parts.filter(([,v])=>v):[['Formato',item.format,'format.0']];
  // Películas y personas comparten sidebar, con sus propios datos y llamada a la acción
  const view={
    Película:{facts:[['Dirección',item.subtitle,true,'subtitle'],['Año',item.year,false,'year'],...filmFormat.map(([k,v,key])=>[k,v,false,key]),['Colección',item.collection,true]],label:'Ficha técnica',cta:['#media',CirclePlay,'Ver película'],places:'Locación'},
    Persona:{facts:[['Roles',item.subtitle,true,'subtitle'],['Vida',item.year,false,'year'],['Obras',item.format,false,'format.0'],['Colección',item.collection,true]],label:'Ficha biográfica',cta:['#filmografia',Film,'Ver filmografía'],places:'Territorio'},
  }[item.type]||{facts:[['Autoría',item.subtitle,true],['Fecha',item.year],['Formato',item.format],['Colección',item.collection,true]],label:'Ficha',cta:['#media',CirclePlay,'Consultar archivo digital'],places:'Territorio'};
  const [ctaHref,CtaIcon,ctaText]=view.cta;
  const initials=(item.subtitle||'').split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('');
  return <main className={`ficha-page${isFilm?' ficha-film':' ficha-person'}`}>
    {!isFilm&&<section className="ficha-hero">
      <img src={item.image} alt="" loading="lazy" decoding="async"/>
      <div className="ficha-hero-shade"/>
      {slot('image')}
      <BackLink item={item}/>
      <div className="ficha-hero-content">
        <span className="ficha-tag" style={tagStyle(item.color)}>{item.type}</span>
        <span className="ficha-code">FICHA CDO—{String(item.id).padStart(4,'0')}</span>
        <h1>{f('title',item.title)}</h1>
        <p>{f('description',item.description,{multiline:true})}</p>
      </div>
    </section>}
    <section className="ficha-body" data-reveal>
      <article className="ficha-main">
        {isFilm&&<header className="ficha-film-head">
          <div className="ficha-film-top"><BackLink item={item}/><span className="ficha-code">FICHA CDO—{String(item.id).padStart(4,'0')}</span></div>
          <span className="ficha-tag" style={tagStyle(item.color)}>{item.type}</span>
          <h1>{f('title',item.title)}</h1>
          <div className="ficha-film-byline">
            <Link className="ficha-film-director" to={`/peliculas?director=${encodeURIComponent(item.subtitle)}`} title={`Ver todas las películas de ${item.subtitle}`}><span aria-hidden="true">{initials}</span><div><small>Dirigida por</small><strong>{f('subtitle',item.subtitle)}</strong></div><ArrowRight className="ficha-film-director-arrow" aria-hidden="true"/></Link>
            <ul className="ficha-film-specs">{[['Año',item.year,'year'],...filmFormat].map(([k,v,field])=>{const Icon={Año:CalendarDays,Género:Clapperboard,Duración:Clock,Soporte:Film}[k]||Film;const key=FACET_KEY[k];const text=f(field,v,{placeholder:k});return <li key={k}>{key?<Link to={`/peliculas?${key}=${encodeURIComponent(v)}`} title={`Ver películas · ${k}: ${v}`}><Icon aria-hidden="true"/><span className="sr-only">{k}: </span>{text}</Link>:<span><Icon aria-hidden="true"/>{text}</span>}</li>})}</ul>
          </div>
        </header>}
        <div className="ficha-section-label"><span>01</span> DESCRIPCIÓN</div>
        <h2>Una pieza, múltiples lecturas.</h2>
        <p>{f('description',item.description,{multiline:true})} Este registro forma parte de un proceso continuo de investigación, preservación y acceso comunitario al patrimonio audiovisual de la Provincia del Limarí.</p>
        <div className="ficha-credits">{credits.map(([k,v],i)=><div key={`${k}-${i}`} className="stagger-item" style={{transitionDelay:`${i*60}ms`}}><small>{f(`creditKey.${i}`,k,{placeholder:'Dato'})}</small><strong>{f(`credits.${i}`,v,{placeholder:'Completar…'})}</strong></div>)}{slot('credits')}</div>
        {isPerson?<div className="ficha-media ficha-filmography" id="filmografia">
          <div className="ficha-filmography-head"><div className="ficha-section-label"><span>02</span> FILMOGRAFÍA</div><span>{String(filmography.length).padStart(2,'0')} {filmography.length===1?'PELÍCULA':'PELÍCULAS'}</span></div>
          {filmography.length?<ol className="ficha-filmography-list">{filmography.map(({film,roles})=>{const [fGenre,fDuration]=(film.format||'').split(' · ');return <li key={film.id}>
            <img src={film.image} alt="" loading="lazy" decoding="async"/>
            <div className="ficha-filmography-info">
              <small>{film.year}{fGenre&&` · ${fGenre}`}{fDuration&&` · ${fDuration}`}</small>
              <h3>{film.title}</h3>
              <div className="ficha-filmography-roles">{roles.map(r=><span key={r}>{r}</span>)}</div>
            </div>
            <Link className="ficha-filmography-btn" to={recordPath(film)}>Ver ficha <ArrowRight/></Link>
          </li>})}</ol>:<p className="ficha-filmography-empty">Aún no hay películas vinculadas a esta persona en el archivo.</p>}
        </div>:<div className="ficha-media" id="media">
          <div className="ficha-section-label"><span>02</span> ARCHIVO DIGITAL</div>
          <MediaViewer item={item} extra={extra}/>
          {slot('media')}
        </div>}
        {isFilm&&<div className="ficha-people" id="personas">
          <div className="ficha-filmography-head"><div className="ficha-section-label"><span>03</span> PERSONAS MENCIONADAS</div><span>{String(people.length).padStart(2,'0')} {people.length===1?'PERSONA':'PERSONAS'}</span></div>
          {people.length?<div className="ficha-people-grid">{people.map(({person,roles})=><Link key={person.id} to={recordPath(person)} className="ficha-person-card">
            <img src={person.image} alt="" loading="lazy" decoding="async"/>
            <div><h3>{person.title}</h3><small>{person.subtitle}</small><div className="ficha-filmography-roles">{roles.map(r=><span key={r}>{r}</span>)}</div></div>
            <ArrowRight/>
          </Link>)}</div>:<p className="ficha-filmography-empty">Aún no hay personas vinculadas a esta película en el archivo.</p>}
        </div>}
        {gallery.length>0&&<div className="ficha-gallery">
          <div className="ficha-section-label"><span>{isFilm?'04':'03'}</span> GALERÍA</div>
          <div className="ficha-gallery-grid">{gallery.map((src,i)=><img src={src} alt={`Material asociado ${i+1}`} key={`${i}-${src.slice(-24)}`} loading="lazy" decoding="async"/>)}</div>
          {slot('gallery')}
        </div>}
      </article>
      <aside className="ficha-aside ficha-film-aside">
        {isFilm&&<figure className="ficha-poster"><img src={item.image} alt={`Imagen de ${item.title}`} decoding="async"/>{slot('image')}<figcaption><span>{item.collection}</span><span>{item.year}</span></figcaption></figure>}
        <a className="ficha-cta" href={ctaHref}><CtaIcon/> {ctaText}</a>
        {related.length>0&&<><div className="ficha-aside-label">Relacionados</div><div className="ficha-film-related">{related.map(r=><Link to={recordPath(r)} key={r.id}><img src={r.image} alt="" loading="lazy" decoding="async"/><div><small>{r.type}</small><strong>{r.title}</strong></div><ArrowRight/></Link>)}</div>{slot('relations')}</>}
        <div className="ficha-aside-label">{view.label}</div>
        <dl className="ficha-film-facts">{view.facts.map(([k,v,wide,key])=><div key={k} className={wide?'wide':undefined}><dt>{k}</dt><dd>{key?f(key,v,{placeholder:k}):v}</dd></div>)}</dl>
        <div className="ficha-aside-label">{placeList.length>1?`${isFilm?'Locaciones':'Territorios'} · ${placeList.length}`:view.places}</div>
        <ul className="ficha-film-locations">{placeList.map(l=><li key={l}><Link to={`/${item.slug}?locacion=${encodeURIComponent(l)}`} title={`Ver ${item.slug} vinculadas a ${l}`}><MapPin/><strong>{l}</strong><ArrowRight/></Link></li>)}</ul>
        {slot('places')}
        <Link className="ficha-film-maplink" to="/mapa">Ver en el mapa <ArrowRight/></Link>
      </aside>
    </section>
  </main>
}

// En el gestor (ver edit-context): `items` es la lista con el borrador y `index` el elemento en edición
export function CollectionsPage(){
  const {edit,f,slot}=useEdit();
  const list=edit?.items||collections, on=i=>edit?.index===i;
  const v=(i,key,value,opts)=>on(i)?f(key,value,opts):value;
  return <main className="discovery-page"><section className="discovery-hero"><img src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>RECORRIDOS CURATORIALES</span><h1>Colecciones</h1><p>Entradas temáticas para descubrir conexiones inesperadas dentro del archivo.</p></section><section className="collections-grid" data-reveal>{list.map((c,i)=><Link to={`/archivo?collection=${encodeURIComponent(c.title)}`} className={`collection-card stagger-item${on(i)?' is-editing':''}`} style={{transitionDelay:`${i*80}ms`}} key={c.slug||i} onClick={edit&&!on(i)?ev=>{ev.preventDefault();edit.pick?.(i)}:undefined}><img src={c.image} alt="" loading="lazy" decoding="async"/><div className="collection-shade"/>{on(i)&&slot('image')}<span>{String(i+1).padStart(2,'0')} · {v(i,'years',c.years,{placeholder:'1968—1990'})}</span><h2>{v(i,'title',c.title)}</h2><p>{v(i,'description',c.description,{multiline:true})}</p><b style={tagStyle(c.color)}>{on(i)&&edit.count!=null?edit.count:countByCollection(c.title)} registros <ArrowRight/></b></Link>)}</section></main>;
}

export function TimelinePage(){
  const {edit,f,slot}=useEdit();
  const list=edit?.items||timelineEvents;
  const [picked,setActive]=useState(list[0]);
  const active=edit?list[edit.index]:picked, isActive=(e,i)=>edit?i===edit.index:active.year===e.year;
  return <main className="timeline-page">
    <section className="discovery-hero"><img src="https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>HISTORIA AUDIOVISUAL</span><h1>Línea de tiempo</h1><p>Ochenta años de imágenes, encuentros y memoria en movimiento.</p></section>
    <section className="timeline-layout" data-reveal>
      <div className="timeline-spine">
        {list.map((e,i)=><button key={`${e.year}-${i}`} className={`timeline-entry${isActive(e,i)?' active':''} stagger-item`} style={{transitionDelay:`${(i%8)*50}ms`}} onClick={()=>edit?(i!==edit.index&&edit.pick?.(i)):setActive(e)}>
          <span className="timeline-entry-year">{e.year}</span>
          <span className="timeline-entry-line"><span className="timeline-entry-dot"/></span>
          <span className="timeline-entry-body"><small>{e.type}</small><strong>{e.title}</strong></span>
        </button>)}
      </div>
      <aside className="timeline-detail">
        {active.image?<img src={active.image} alt="" loading="lazy" decoding="async"/>:<div className="timeline-detail-noimg"/>}
        {slot('image')}
        <div className="timeline-detail-copy">
          <span>{active.type} · {f('year',active.year,{placeholder:'1970'})}</span>
          <h2>{f('title',active.title)}</h2>
          <p>{f('text',active.text,{multiline:true})}</p>
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
  return <main className="map-page"><section className="discovery-hero"><img src="https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>GEOGRAFÍA DEL ARCHIVO</span><h1>Mapa del Limarí</h1><p>Explora las obras, personas y documentos según su vínculo con el territorio.</p></section><section className="map-explorer" data-reveal><div className="archive-map real-map"><iframe key={selected.id} title={`Mapa de ${selected.name}`} src={mapUrl} loading="lazy"/><div className="map-caption"><MapPin/> Mapa geográfico · OpenStreetMap</div></div><aside><span>LOCALIDAD SELECCIONADA</span><h2>{selected.name}</h2><div className="map-location-list">{locations.map(l=><button key={l.id} className={selected.id===l.id?'active':''} onClick={()=>setSelected(l)}><MapPin/>{l.name}<b>{countByLocation(l.name)}</b></button>)}</div><strong>{countByLocation(selected.name)}</strong><small>REGISTROS VINCULADOS</small><Link to={`/archivo?locacion=${encodeURIComponent(selected.name)}`}>Explorar registros <ArrowRight/></Link></aside></section></main>
}
