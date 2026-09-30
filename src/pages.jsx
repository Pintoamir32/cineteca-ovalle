import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, CalendarDays, CirclePlay, Clapperboard, Clock, Film, Grid2X2, List, MapPin, Search, Settings2, Table2, X } from 'lucide-react';
import { Counter, Paged, Pager, RecordCard, RecordRow, usePaged } from './components';
import { collections, locations, recordExtras, sections, timelineEvents } from './data';
import { countByCollection, countByLocation, countByType, getAllRecords, getFilmPeople, getFilmography, getLocations, getRecordPeople, placesOf, findRecordByParam, recordPath, recordSlug } from './repository';
import { useEdit } from './edit-context';
import { useSiteText } from './site-text';
import { SearchSelect } from './SearchSelect';
import { BackLink, DocumentView, MediaViewer } from './record-views';
import { tagStyle } from './color';
import { filmPeopleNames, filtersFor, matches, optionsOf, valueLabel } from './filters';


const PAGE_SIZE=8, COLLECTIONS_PER_PAGE=8, TIMELINE_PER_PAGE=10, FILMOGRAPHY_PER_PAGE=10;

const pageInfo={
  archivo:{title:'Archivo abierto',eyebrow:'TODOS LOS REGISTROS',desc:'Busca de forma transversal en películas, personas, prensa, entrevistas y artículos.',image:'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=88'},
  peliculas:{title:'Películas',eyebrow:'OBRAS AUDIOVISUALES',desc:'Ficción, documental y registros de la memoria audiovisual del Valle del Limarí.',image:'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1600&q=88'},
  personas:{title:'Personas',eyebrow:'VOCES Y OFICIOS',desc:'Directoras, actores, técnicos y gestores que han construido el cine regional.',image:'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1600&q=88'},
  prensa:{title:'Archivo de prensa',eyebrow:'DOCUMENTOS HISTÓRICOS',desc:'Recortes, programas y materiales que registran la vida cinematográfica de Ovalle.',image:'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1600&q=88'},
  entrevistas:{title:'Entrevistas',eyebrow:'MEMORIA ORAL',desc:'Relatos en texto, audio y video de quienes vivieron y construyeron esta historia.',image:'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1600&q=88'},
  articulos:{title:'Artículos y crítica',eyebrow:'IDEAS EN CIRCULACIÓN',desc:'Investigaciones, ensayos y miradas contemporáneas sobre el patrimonio audiovisual.',image:'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1600&q=88'}
};

const formatParts=r=>(r.format||'').split(' · ');
// Minúsculas y sin tildes, para buscar "munoz" y encontrar "Muñoz"
const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const searchText=r=>fold([r.title,r.subtitle,r.year,r.format,r.collection,r.description,...(recordExtras[r.id]?.credits||[]).map(c=>c[1]),...filmPeopleNames(r)].join(' '));
// Filtros exactos que llegan desde los enlaces de la ficha (año y duración exactos)
const LINK_FACETS=[
  {key:'anio',label:'Año',get:r=>r.year},
  {key:'duracion',label:'Duración',get:r=>formatParts(r)[1]}
];
const FACET_KEY={Dirección:'director',Año:'anio',Género:'genero',Duración:'duracion',Soporte:'soporte'};

/* Vista de tabla: columnas según la sección, ordenables desde el encabezado */
const yearNum=r=>Number((/\d{4}/.exec(r.year)||[])[0])||0;
const minutes=r=>Number((/(\d+)\s*min/.exec(formatParts(r)[1]||'')||[])[1])||0;
const SUBTITLE={peliculas:'Dirección',personas:'Roles',prensa:'Medio de origen',entrevistas:'Entrevistado(a)',articulos:'Autor(a)'};
function tableColumns(kind){
  const cols=[{key:'title',label:'Título',get:r=>r.title}];
  if(kind==='archivo')cols.push({key:'type',label:'Tipo',get:r=>r.type});
  cols.push({key:'subtitle',label:SUBTITLE[kind]||'Autoría',get:r=>r.subtitle});
  cols.push({key:'year',label:{personas:'Años',prensa:'Fecha',entrevistas:'Fecha',articulos:'Fecha'}[kind]||'Año',get:r=>r.year,sort:yearNum,num:true});
  if(kind==='peliculas')cols.push({key:'genre',label:'Género',get:r=>formatParts(r)[0]},{key:'duration',label:'Duración',get:r=>formatParts(r)[1],sort:minutes,num:true});
  else if(!['personas','prensa','articulos'].includes(kind))cols.push({key:'format',label:'Formato',get:r=>formatParts(r)[0]});
  if(!['prensa','entrevistas','articulos'].includes(kind))cols.push({key:'collection',label:'Colección',get:r=>r.collection});
  return cols;
}

export function ArchivePage({kind='archivo'}){
  const [params,setParams]=useSearchParams(), [showFilters,setShowFilters]=useState(false); const info=pageInfo[kind], section=sections.find(s=>s.slug===kind); const q=params.get('q')||'';
  const recordType=section?'':params.get('type')||'';
  const reverseOrder=['personas','prensa','entrevistas','articulos'].includes(kind);
  const compactCards=reverseOrder;
  // Filtros propios de la sección (o del tipo elegido en el archivo completo)
  const defs=useMemo(()=>filtersFor(section?.type||recordType),[section,recordType]);
  const scoped=useMemo(()=>getAllRecords().filter(r=>(!section||r.type===section.type)&&(!recordType||r.type===recordType)),[section,recordType]);
  const active=[...defs,...LINK_FACETS].map(f=>({...f,value:params.get(f.key)||''})).filter(f=>f.value);
  const activeSig=active.map(f=>`${f.key}=${f.value}`).join('&');
  const list=useMemo(()=>{const filtered=scoped.filter(r=>active.every(f=>matches(r,f,f.value))&&searchText(r).includes(fold(q)));return reverseOrder?filtered.reverse():filtered},[q,scoped,activeSig,reverseOrder]);// eslint-disable-line react-hooks/exhaustive-deps
  // Todos los filtros de la sección se muestran siempre; los que aún no tienen datos quedan desactivados
  const panelFilters=useMemo(()=>defs.map(f=>({...f,options:optionsOf(f,scoped)})),[defs,scoped]);
  const chips=[...(recordType?[{key:'type',label:'Tipo',text:recordType}]:[]),...active.map(f=>({key:f.key,label:f.label,text:valueLabel(f,f.value)}))];
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
  // Al cambiar de tipo en el archivo completo se quitan los filtros que eran de otro tipo
  const setType=value=>{const next=new URLSearchParams();for(const k of ['q','view','orden','dir'])params.get(k)&&next.set(k,params.get(k));value&&next.set('type',value);setParams(next)};
  const clearFilters=()=>{const next=new URLSearchParams();for(const k of ['q','view','orden','dir'])params.get(k)&&next.set(k,params.get(k));setParams(next)};
  const setView=v=>{const next=new URLSearchParams(params);v==='grid'?next.delete('view'):next.set('view',v);setParams(next)};
  const headerCount=section?countByType(section.type):getAllRecords().length;
  return <main className="catalog-page"><section className="page-hero"><img src={info.image} alt=""/><div className="page-hero-shade"/><div><span>{info.eyebrow}</span><h1>{info.title}</h1><p>{info.desc}</p></div><b><Counter value={headerCount} pad={3}/><small>REGISTROS</small></b></section>
    <section className="catalog-content" data-reveal><div className="catalog-tools"><div className="catalog-search"><Search/><input value={q} onChange={update} placeholder={kind==='peliculas'?'Buscar por título, director o persona…':`Buscar en ${info.title.toLowerCase()}…`}/>{q&&<button onClick={()=>setParams({})}><X/></button>}</div><button className="filter-toggle" onClick={()=>setShowFilters(!showFilters)} aria-expanded={showFilters}><Settings2/> Filtros{chips.length>0&&<b className="filter-count">{chips.length}</b>}</button></div>
    {showFilters&&<div className="filter-panel filter-panel-wide">{!section&&<SearchSelect label="Tipo de registro" value={recordType} onChange={setType} options={[{value:'',label:'Todos los tipos'},...sections.map(x=>({value:x.type,label:`${x.type} (${countByType(x.type)})`}))]}/>}{panelFilters.map(f=><SearchSelect key={f.key} label={f.label} value={params.get(f.key)||''} onChange={v=>setFilter(f.key,v)} disabled={!f.options.length} options={[{value:'',label:f.options.length?'Todos':'Sin datos todavía'},...f.options]}/>)}</div>}
    <div className="catalog-heading"><p><b>{list.length}</b> resultados {q&&<>para “{q}”</>}{chips.map(f=><button key={f.key} className="catalog-chip" onClick={()=>f.key==='type'?setType(''):setFilter(f.key,'')}>{f.label}: {f.text} <X/></button>)}{chips.length>1&&<button className="catalog-chip is-clear" onClick={clearFilters}>Quitar filtros</button>}</p><div className="view-toggle"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="Vista de cuadrícula"><Grid2X2/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="Vista de lista"><List/></button><button className={view==='table'?'active':''} onClick={()=>setView('table')} aria-label="Vista de tabla" title="Tabla ordenable"><Table2/></button></div></div>
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
    <Pager page={page} total={totalPages} onChange={goToPage}/></section>
  </main>
}

export function DetailPage(){const {id}=useParams();const item=getAllRecords().find(r=>r.id===Number(id));if(!item)return <Navigate to="/archivo"/>;const related=getAllRecords().filter(r=>r.id!==item.id).slice(0,3);return <main className="detail-page"><BackLink item={item}/><section className="detail-hero"><div className="detail-image"><img src={item.image} alt=""/><span style={tagStyle(item.color)}>{item.type}</span></div><div className="detail-copy"><span>FICHA CDO—{String(item.id).padStart(4,'0')}</span><h1>{item.title}</h1><p>{item.description}</p><dl><div><dt>Fecha</dt><dd>{item.year}</dd></div><div><dt>Autoría</dt><dd>{item.subtitle}</dd></div><div><dt>Formato</dt><dd>{item.format}</dd></div><div><dt>Colección</dt><dd>{item.collection}</dd></div></dl><button><CirclePlay/> Consultar archivo digital</button></div></section><section className="related-page"><div className="section-label"><span>+</span> RECURSOS RELACIONADOS</div><div className="record-grid">{related.map((r,i)=><RecordCard item={r} index={i} key={r.id}/>)}</div></section></main>}



const DEFAULT_EXTRA={credits:[['Estado','Catalogado'],['Origen','Archivo CDO']],relations:[],location:'Ovalle',mediaType:'image'};

export function RichDetailPage(){
  // La dirección lleva el nombre (/ficha/canto-a-la-tierra); los enlaces antiguos por número también sirven
  const {id}=useParams(), found=findRecordByParam(id), item=found&&getAllRecords().includes(found)?found:null;
  if(!item)return <Navigate to="/archivo" replace/>;
  if(id!==recordSlug(item))return <Navigate to={recordPath(item)} replace/>;
  return <RecordDetail key={item.id} item={item} extra={recordExtras[item.id]||DEFAULT_EXTRA}/>;
}

// Ficha pública de un registro. El gestor la usa también como vista previa editable (ver edit-context)
// Nombre de un cargo: lleva a la ficha de esa persona si está en el archivo; si no, lo busca en el archivo
function CreditName({name}){
  const person=getAllRecords().find(r=>r.type==='Persona'&&r.title.trim().toLowerCase()===name.trim().toLowerCase());
  return <Link className="ficha-credit-link" to={person?recordPath(person):`/archivo?q=${encodeURIComponent(name)}`} title={person?`Ver la ficha de ${name}`:`Buscar ${name} en el archivo`}>{name}</Link>
}

export function RecordDetail({item,extra}){
  const {t}=useSiteText();
  const {edit,f,slot}=useEdit();
  const related=(extra.relations||[]).map(rid=>getAllRecords().find(r=>r.id===rid)).filter(Boolean);
  if(['Prensa','Entrevista','Artículo'].includes(item.type))return <DocumentView item={item} extra={extra} related={related} people={getRecordPeople(item,extra)}/>;
  const isFilm=item.type==='Película', isPerson=item.type==='Persona', placeList=placesOf(extra);
  const filmography=isPerson?getFilmography(item,extra):[];
  // Filmografía: películas del archivo (con enlace) y las escritas a mano (sin enlace), por año
  const yearNum=y=>Number((/\d{4}/.exec(y||'')||[])[0])||9999;
  const works=isPerson?[...filmography.map(({film})=>({film,year:film.year})),...(extra.works||[]).map((w,i)=>({...w,i})).filter(w=>String(w.title||'').trim())].sort((a,b)=>yearNum(a.year)-yearNum(b.year)):[];
  const credits=extra.credits||[], gallery=extra.gallery||[];
  const [genre,duration,medium]=(item.format||'').split(' · ');
  // En el gestor se muestran los tres datos aunque estén vacíos, para poder completarlos
  const parts=[['Género',genre,'format.0'],['Duración',duration,'format.1'],['Soporte',medium,'format.2']];
  const filmFormat=edit&&isFilm?parts:duration?parts.filter(([,v])=>v):[['Formato',item.format,'format.0']];
  // Películas y personas comparten sidebar, con sus propios datos y llamada a la acción
  const view={
    Película:{facts:[['Dirección',item.subtitle,true,'subtitle'],['Año',item.year,false,'year'],...filmFormat.map(([k,v,key])=>[k,v,false,key]),['Colección',item.collection,true,'collection']],label:'Ficha técnica',cta:['#media',CirclePlay,'Ver película'],places:'Locación'},
    Persona:{facts:[['Roles',item.subtitle,true,'subtitle'],['Vida',item.year,false,'year'],['Obras',item.format,false,'format.0'],['Colección',item.collection,true,'collection']],label:'Ficha biográfica',cta:['#filmografia',Film,'Ver filmografía'],places:'Territorio'},
  }[item.type]||{facts:[['Autoría',item.subtitle,true],['Fecha',item.year],['Formato',item.format],['Colección',item.collection,true,'collection']],label:'Ficha',cta:['#media',CirclePlay,'Consultar archivo digital'],places:'Territorio'};
  const [ctaHref,CtaIcon,ctaText]=view.cta;
  const initials=(item.subtitle||'').split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('');
  // «Dirigida por» lleva a la ficha de esa persona si está en el archivo
  const director=isFilm&&item.subtitle?getAllRecords().find(r=>r.type==='Persona'&&r.title.trim().toLowerCase()===item.subtitle.trim().toLowerCase()):null;
  return <main className={`ficha-page${isFilm?' ficha-film':' ficha-person'}`}>
    {!isFilm&&<section className={`ficha-hero${isPerson&&['center','right'].includes(extra.heroAlign)?` is-align-${extra.heroAlign}`:''}`}>
      <img src={item.image} alt="" loading="lazy" decoding="async"/>
      <div className="ficha-hero-shade"/>
      {slot('image')}
      <BackLink item={item}/>
      {/* Persona: fotografía, nombre y rol(es); abajo, biografía y filmografía */}
      <div className="ficha-hero-content">
        <span className="ficha-tag" style={tagStyle(item.color)}>{item.type}</span>
        {!isPerson&&<span className="ficha-code">FICHA CDO—{String(item.id).padStart(4,'0')}</span>}
        <h1>{f('title',item.title)}</h1>
        {isPerson?<p className="ficha-person-roles">{f('subtitle',item.subtitle)}</p>:<p>{f('description',item.description,{multiline:true})}</p>}
      </div>
    </section>}
    {isPerson&&<section className="ficha-body ficha-person-body" data-reveal>
      <article className="ficha-main">
        <div className="ficha-section-label"><span>01</span> BIOGRAFÍA</div>
        <p className="ficha-person-bio">{f('description',item.description,{multiline:true})}</p>
        <div className="ficha-media ficha-filmography" id="filmografia">
          <div className="ficha-filmography-head"><div className="ficha-section-label"><span>02</span> FILMOGRAFÍA</div><span>{String(works.length).padStart(2,'0')} {works.length===1?'PELÍCULA':'PELÍCULAS'}</span></div>
          {works.length?<Paged items={works} perPage={FILMOGRAPHY_PER_PAGE}>{page=><ol className="ficha-filmography-list">{page.map(w=>w.film?(()=>{const film=w.film,[fGenre,fDuration]=(film.format||'').split(' · ');return <li key={`f${film.id}`}>
            <img src={film.image} alt="" loading="lazy" decoding="async"/>
            <div className="ficha-filmography-info">
              <small>{film.year}{fGenre&&` · ${fGenre}`}{fDuration&&` · ${fDuration}`}</small>
              <h3>{film.title}</h3>
            </div>
            <Link className="ficha-filmography-btn" to={recordPath(film)}>Ver ficha <ArrowRight/></Link>
          </li>})()
            // Escrita a mano: sin ficha en el archivo, por eso sin enlace
            :<li key={`w${w.i}`} className="is-written">
            <span className="ficha-filmography-noimg" aria-hidden="true"><Film/></span>
            <div className="ficha-filmography-info">{w.year&&<small>{w.year}</small>}<h3>{w.title}</h3></div>
          </li>)}</ol>}</Paged>:<p className="ficha-filmography-empty">Aún no hay películas en la filmografía de esta persona.</p>}
          {slot('works')}
        </div>
      </article>
    </section>}
    {!isPerson&&<>
    <section className="ficha-body" data-reveal>
      <article className="ficha-main">
        {isFilm&&<header className="ficha-film-head">
          <div className="ficha-film-top"><BackLink item={item}/><span className="ficha-code">FICHA CDO—{String(item.id).padStart(4,'0')}</span></div>
          <span className="ficha-tag" style={tagStyle(item.color)}>{item.type}</span>
          <h1>{f('title',item.title)}</h1>
          <div className="ficha-film-byline">
            <Link className="ficha-film-director" to={director?recordPath(director):`/peliculas?director=${encodeURIComponent(item.subtitle)}`} title={director?`Ver la ficha de ${item.subtitle}`:`Ver todas las películas de ${item.subtitle}`}><span aria-hidden="true">{initials}</span><div><small>Dirigida por</small><strong>{f('subtitle',item.subtitle)}</strong></div><ArrowRight className="ficha-film-director-arrow" aria-hidden="true"/></Link>
            <ul className="ficha-film-specs">{[['Año',item.year,'year'],...filmFormat].map(([k,v,field])=>{const Icon={Año:CalendarDays,Género:Clapperboard,Duración:Clock,Soporte:Film}[k]||Film;const key=FACET_KEY[k];const text=f(field,v,{placeholder:k});return <li key={k}>{key?<Link to={`/peliculas?${key}=${encodeURIComponent(v)}`} title={`Ver películas · ${k}: ${v}`}><Icon aria-hidden="true"/><span className="sr-only">{k}: </span>{text}</Link>:<span><Icon aria-hidden="true"/>{text}</span>}</li>})}</ul>
          </div>
        </header>}
        <div className="ficha-section-label"><span>01</span> {isFilm?'SINOPSIS':'DESCRIPCIÓN'}</div>
        {!isFilm&&<h2>{t('fichaLeadTitle')}</h2>}
        <p>{f('description',item.description,{multiline:true})}</p>
        <div className="ficha-credits">{credits.map(([k,v],i)=><div key={`${k}-${i}`} className="stagger-item" style={{transitionDelay:`${i*60}ms`}}><small>{f(`creditKey.${i}`,k,{placeholder:'Dato'})}</small><strong>{edit||!v?f(`credits.${i}`,v,{placeholder:'Completar…'}):<CreditName name={v}/>}</strong></div>)}{slot('credits')}</div>
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
        {(gallery.length>0||(edit&&!isPerson))&&<div className="ficha-gallery">
          <div className="ficha-section-label"><span>03</span> GALERÍA</div>
          <div className="ficha-gallery-grid">{gallery.map((src,i)=><img src={src} alt={`${item.title} · imagen ${i+1}`} key={`${i}-${src.slice(-24)}`} loading="lazy" decoding="async"/>)}</div>
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
    </>}
  </main>
}

// En el gestor (ver edit-context): `items` es la lista con el borrador y `index` el elemento en edición
export function CollectionsPage(){
  const {edit,f,slot}=useEdit(), {t}=useSiteText();
  const list=edit?.items||collections, on=i=>edit?.index===i;
  const v=(i,key,value,opts)=>on(i)?f(key,value,opts):value;
  // En el sitio, de a 8; en la vista previa del gestor se ven todas (se eligen desde su lista)
  const gridRef=useRef(null), paged=usePaged(list,edit?Math.max(list.length,1):COLLECTIONS_PER_PAGE), offset=(paged.page-1)*COLLECTIONS_PER_PAGE;
  return <main className="discovery-page"><section className="discovery-hero"><img src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>{t('collectionsKicker')}</span><h1>{t('collectionsTitle')}</h1><p>{t('collectionsIntro')}</p></section><section className="collections-grid" data-reveal ref={gridRef}>{paged.items.map((c,k)=>{const i=edit?k:offset+k;return <Link to={`/archivo?collection=${encodeURIComponent(c.title)}`} className={`collection-card stagger-item${on(i)?' is-editing':''}`} style={{transitionDelay:`${k*80}ms`}} key={c.slug||i} onClick={edit&&!on(i)?ev=>{ev.preventDefault();edit.pick?.(i)}:undefined}><img src={c.image} alt="" loading="lazy" decoding="async"/><div className="collection-shade"/>{on(i)&&slot('image')}<span>{String(i+1).padStart(2,'0')}</span><h2>{v(i,'title',c.title)}</h2><p>{v(i,'description',c.description,{multiline:true})}</p><b style={tagStyle(c.color)}>{on(i)&&edit.count!=null?edit.count:countByCollection(c.title)} registros <ArrowRight/></b></Link>})}</section>{paged.total>1&&<div className="page-pager"><Pager page={paged.page} total={paged.total} onChange={paged.setPage} scrollRef={gridRef}/></div>}</main>;
}

export function TimelinePage(){
  const {edit,f,slot}=useEdit(), {t}=useSiteText();
  const list=edit?.items||timelineEvents;
  // Por posición: dos hitos del mismo año no quedan marcados a la vez
  const [picked,setPicked]=useState(0);
  // Si el detalle no está a la vista (en móvil queda bajo la lista), al elegir un hito se lleva a él
  const detailRef=useRef(null);
  const pick=i=>{setPicked(i);requestAnimationFrame(()=>{const el=detailRef.current, r=el?.getBoundingClientRect();if(r&&(r.top<90||r.top>window.innerHeight*.6))el.scrollIntoView({behavior:'smooth',block:'start'})})};
  const current=edit?edit.index:Math.min(picked,list.length-1), active=list[current]||{}, isActive=(e,i)=>i===current;
  // En el sitio, de a 10 hitos; al cambiar de página se muestra el primero de esa página
  const spineRef=useRef(null), paged=usePaged(list,edit?Math.max(list.length,1):TIMELINE_PER_PAGE), offset=edit?0:(paged.page-1)*TIMELINE_PER_PAGE;
  const changePage=n=>{paged.setPage(n);setPicked((n-1)*TIMELINE_PER_PAGE)};
  return <main className="timeline-page">
    <section className="discovery-hero"><img src="https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>{t('timelineKicker')}</span><h1>{t('timelineTitle')}</h1><p>{t('timelineIntro')}</p></section>
    <section className="timeline-layout" data-reveal>
      <div className="timeline-spine" ref={spineRef}>
        {paged.items.map((e,k)=>{const i=offset+k;return <button key={`${e.year}-${i}`} className={`timeline-entry${isActive(e,i)?' active':''} stagger-item`} style={{transitionDelay:`${(k%8)*50}ms`}} onClick={()=>edit?(i!==edit.index&&edit.pick?.(i)):pick(i)}>
          <span className="timeline-entry-year">{e.year}</span>
          <span className="timeline-entry-line"><span className="timeline-entry-dot"/></span>
          <span className="timeline-entry-body"><small>{e.type}</small><strong>{e.title}</strong></span>
        </button>})}
        <Pager page={paged.page} total={paged.total} onChange={changePage} scrollRef={spineRef} className="is-compact"/>
      </div>
      <aside className="timeline-detail" ref={detailRef}>
        {active.image?<img key={active.image} src={active.image} alt={active.title||""} decoding="async"/>:<div className="timeline-detail-noimg"/>}
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

// Sin comunas cargadas, el mapa se centra en Ovalle
const MAP_DEFAULT={id:0,name:'Ovalle',lat:-30.6011,lon:-71.199};
export function MapPage(){
  const [picked,setSelected]=useState(null);
  const selected=locations.find(l=>l.id===picked?.id)||locations[0]||MAP_DEFAULT;
  const delta=selected.name==='Combarbalá'?0.25:0.18;
  const bbox=`${selected.lon-delta},${selected.lat-delta},${selected.lon+delta},${selected.lat+delta}`;
  const mapUrl=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${selected.lat}%2C${selected.lon}`;
  return <main className="map-page"><section className="discovery-hero"><img src="https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1600&q=88" alt="" loading="lazy" decoding="async"/><div className="discovery-hero-shade"/><span>GEOGRAFÍA DEL ARCHIVO</span><h1>Mapa Región de Coquimbo</h1><p>Explora las obras, personas y documentos según su vínculo con el territorio.</p></section><section className="map-explorer" data-reveal><div className="archive-map real-map"><iframe key={selected.id} title={`Mapa de ${selected.name}`} src={mapUrl} loading="lazy"/><div className="map-caption"><MapPin/> Mapa geográfico · OpenStreetMap</div></div><aside><span>LOCALIDAD SELECCIONADA</span><h2>{selected.name}</h2><div className="map-location-list">{!locations.length&&<p className="map-empty">Aún no hay lugares en el mapa.</p>}{locations.map(l=><button key={l.id} className={selected.id===l.id?'active':''} onClick={()=>setSelected(l)}><MapPin/>{l.name}<b>{countByLocation(l.name)}</b></button>)}</div><strong>{countByLocation(selected.name)}</strong><small>REGISTROS VINCULADOS</small><Link to={`/archivo?locacion=${encodeURIComponent(selected.name)}`}>Explorar registros <ArrowRight/></Link></aside></section></main>
}
