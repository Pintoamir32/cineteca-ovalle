import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, BookOpen, CirclePlay, FileText, Film, Grid2X2, Layers, MapPin, Mic2, Search, Settings2, UserRound } from 'lucide-react';
import { tagStyle } from './color';
import { Counter, SearchResults } from './components';
import { collections, locations, sections, site } from './data';
import { countByType, getAllRecords, newestRecords, recordPath } from './repository';
import { buildSearchIndex, matchIndex } from './search-index';
import { SearchSelect } from './SearchSelect';
import { filtersFor, optionsOf } from './filters';
import { useSiteText } from './site-text';

export { HomeEditContext, rich } from './site-text';

export const HOME_SECTIONS=[
  ['search','Buscador'],['stats','El archivo en cifras'],['portal','Cinco puertas'],['discovery','Otras formas de explorar'],
  ['spotlight','Pieza destacada'],['latest','Recién catalogado'],['manifesto','Manifiesto']
];

const STAT_LINKS=[
  {to:'/peliculas',icon:Film,count:()=>countByType('Película')},
  {to:'/personas',icon:UserRound,count:()=>countByType('Persona')},
  {to:'/prensa',icon:FileText,count:()=>countByType('Prensa')},
  {to:'/entrevistas',icon:Mic2,count:()=>countByType('Entrevista')},
  {to:'/articulos',icon:BookOpen,count:()=>countByType('Artículo')},
  {to:'/colecciones',icon:Layers,count:()=>collections.length},
  {to:'/mapa',icon:MapPin,count:()=>locations.length},
  {to:'/archivo',icon:Grid2X2,count:()=>getAllRecords().length,total:true}
];
const TILE_LINKS=[['/colecciones',ArrowDownRight],['/linea-de-tiempo',ArrowDownRight],['/mapa',MapPin],['/nosotros',ArrowDownRight]];

export function Home(){
  // t(): texto de la página; en el gestor se vuelve editable con un clic
  const {edit,content:c,t}=useSiteText();
  // En el sitio no se muestran las diapositivas de fichas en borrador (en el gestor, sí)
  const visible=c.slides.filter(x=>!x.recordId||getAllRecords().some(r=>r.id===x.recordId));
  const slides=edit||!visible.length?c.slides:visible, featuredId=edit?c.featuredId:site.featuredId;
  const show=id=>edit||!c.hidden?.includes(id);
  const sectionClass=id=>edit&&c.hidden?.includes(id)?' is-hidden-section':'';
  // En el gestor cada sección muestra su nombre al pasar el mouse
  const tag=id=>edit?{'data-edit':HOME_SECTIONS.find(([k])=>k===id)?.[1]}:{};
  // Numeración de secciones visibles, en el orden en que aparecen (ver home-discovery.css)
  const numbers={};let n=0;for(const id of ['discovery','portal','spotlight','latest'])if(!c.hidden?.includes(id))numbers[id]=String(++n).padStart(2,'0');

  const [term,setTerm]=useState(''),[advanced,setAdvanced]=useState(false),[showResults,setShowResults]=useState(false); const nav=useNavigate(); const searchRef=useRef(null);
  // Búsqueda avanzada: el tipo elegido trae sus propios filtros (los mismos de su página)
  const [advType,setAdvType]=useState(''),[adv,setAdv]=useState({});
  // En el gestor la diapositiva visible la controla el panel lateral
  const [ownSlide,setOwnSlide]=useState(0),[paused,setPaused]=useState(false);
  const slide=edit?edit.slide:ownSlide, setSlide=edit?edit.setSlide:setOwnSlide;
  const current=slides[Math.min(slide,slides.length-1)]||slides[0];
  useEffect(()=>{
    if(edit||paused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=setInterval(()=>setSlide(s=>(s+1)%slides.length),4000);
    return ()=>clearInterval(timer);
  },[paused,edit,slides.length]);
  const index=useMemo(()=>buildSearchIndex(),[]);
  const results=useMemo(()=>matchIndex(term,index),[term,index]);
  const allRecords=useMemo(()=>getAllRecords(),[]);
  const firstYear=useMemo(()=>Math.min(...allRecords.filter(r=>r.type==='Película').map(r=>Number((/\d{4}/.exec(r.year)||[])[0])).filter(Boolean)),[allRecords]);
  const advFilters=useMemo(()=>{const pool=allRecords.filter(r=>!advType||r.type===advType);return filtersFor(advType).map(f=>({...f,options:optionsOf(f,pool)}))},[allRecords,advType]);
  const pickType=v=>{setAdvType(v);setAdv({})};
  // Con un tipo elegido se abre su página (con sus filtros); si no, el archivo completo
  const submit=e=>{e.preventDefault();const p=new URLSearchParams();if(term)p.set('q',term);for(const [k,v] of Object.entries(adv))if(v&&advFilters.some(f=>f.key===k))p.set(k,v);const slug=sections.find(x=>x.type===advType)?.slug;const qs=p.toString();nav(`/${slug||'archivo'}${qs?`?${qs}`:''}`);setTerm('');setShowResults(false)};
  const goTo=path=>{nav(path);setTerm('');setShowResults(false)};
  useEffect(()=>{const onClick=e=>{if(searchRef.current&&!searchRef.current.contains(e.target))setShowResults(false)};document.addEventListener('mousedown',onClick);return()=>document.removeEventListener('mousedown',onClick)},[]);
  const years=Number.isFinite(firstYear)?Math.floor((new Date().getFullYear()-firstYear)/10)*10:0;
  const latest=(c.latestIds?.length?c.latestIds.map(id=>allRecords.find(r=>r.id===id)).filter(Boolean):newestRecords());
  const s=i=>`slides.${Math.min(slide,slides.length-1)}.${i}`;

  return <main className="home-page">
    <section className="hero-new" data-edit={edit?'Portada':undefined} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
      <div className="hero-photo" key={`photo-${slide}`}><img src={current.image} alt={current.alt} loading="eager" decoding="async"/><div className="photo-shade"/></div>
      {edit&&edit.image(s('image'),{label:`Cambiar foto · diapositiva ${slide+1}`,className:'home-edit-hero-img',aspect:null})}
      <div className="hero-edition">{t('heroEdition')}</div>
      <div className="hero-title" key={`title-${slide}`}>
        <div className="eyebrow"><span>●</span> {t(s('eyebrow'))}</div>
        <h1>{t(s('title'))}{(edit||current.em)&&<><br/>{edit?t(s('em'),{as:'em'}):<em>{current.em}</em>}</>}</h1>
        <p>{t(s('desc'))}</p>
      </div>
      <div className="hero-bottom-right">
        <Link className="hero-cta" to={current.link}>{t('heroCta')} <ArrowRight/></Link>
        <div className="hero-dots">{slides.map((x,i)=><button type="button" key={i} className={i===slide?'active':''} onClick={()=>setSlide(i)} aria-label={`Ir a la diapositiva ${i+1}`}/>)}</div>
      </div>
    </section>

    {show('search')&&<section className={`search-stage${sectionClass('search')}`} data-reveal {...tag('search')}><div className="search-intro"><span>{t('searchKicker')}</span><p>{t('searchTitle')}</p></div><div className="searchbox-wrap" ref={searchRef}><form className="searchbox" onSubmit={submit}><Search/><input value={term} onChange={e=>{setTerm(e.target.value);setShowResults(true)}} onFocus={()=>term&&setShowResults(true)} placeholder={c.searchPlaceholder}/><button><ArrowRight/></button></form>{showResults&&term&&<SearchResults results={results} onPick={goTo} className="home-results"/>}</div><button className="advanced-trigger" onClick={()=>setAdvanced(!advanced)}><Settings2/> {t('searchAdvanced')}</button>{advanced&&<div className="advanced-box"><SearchSelect label="Tipo de registro" value={advType} onChange={pickType} options={[{value:'',label:'Cualquier tipo'},...sections.map(x=>({value:x.type,label:`${x.type} (${countByType(x.type)})`}))]}/>{advFilters.map(f=><SearchSelect key={f.key} label={f.label} value={adv[f.key]||''} onChange={v=>setAdv(a=>({...a,[f.key]:v}))} disabled={!f.options.length} options={[{value:'',label:f.options.length?'Todos':'Sin datos todavía'},...f.options]}/>)}<button type="button" className="advanced-go" onClick={submit}><Search/> Buscar{advType?` en ${sections.find(x=>x.type===advType)?.label.toLowerCase()}`:''}</button></div>}</section>}

    {show('stats')&&<section className={`home-stats${sectionClass('stats')}`} data-reveal {...tag('stats')}>
      <div className="home-stats-head">
        <span>{t('statsKicker')}</span>
        <h2>{t('statsTitle',{vars:{años:years}})}</h2>
        <p>{t('statsText')}</p>
      </div>
      <div className="home-stats-grid">{STAT_LINKS.map(({to,icon:Icon,count,total},i)=><Link key={to} to={to} className={`home-stat stagger-item${total?' is-total':''}`} style={{transitionDelay:`${i*60}ms`}}>
        <Icon className="home-stat-icon"/><strong><Counter value={count()} pad={2}/></strong><span>{t(`stats.${i}.label`)}</span><small>{t(`stats.${i}.hint`)}</small><ArrowRight className="home-stat-arrow"/>
      </Link>)}</div>
    </section>}

    {show('portal')&&<section className={`portal${sectionClass('portal')}`} data-reveal {...tag('portal')}><div className="section-label"><span>{numbers.portal}</span> {t('portalLabel')}</div><div className="portal-head"><h2>{t('portalTitle')}</h2><p>{t('portalText')}</p></div><div className="portal-list">{sections.map(({label,slug,type,icon:Icon},i)=><Link key={slug} to={`/${slug}`} className="stagger-item" style={{transitionDelay:`${i*60}ms`}}><span className="portal-num">0{i+1}</span><Icon/><strong>{label}</strong><small>{String(countByType(type)).padStart(3,'0')} registros</small><ArrowDownRight className="portal-arrow"/></Link>)}</div></section>}

    {show('discovery')&&<section className={`home-discovery${sectionClass('discovery')}`} data-reveal {...tag('discovery')}><div className="home-discovery-head"><div className="section-label"><span>{numbers.discovery}</span> {t('discoveryLabel')}</div><h2>{t('discoveryTitle')}</h2></div><div className="discovery-tiles">{TILE_LINKS.map(([to,Icon],i)=><Link key={to} to={to} className="stagger-item" style={{transitionDelay:`${i*60}ms`}}><span>{String(i+1).padStart(2,'0')}</span><div><small>{t(`tiles.${i}.kicker`)}</small><h3>{t(`tiles.${i}.title`)}</h3><p>{t(`tiles.${i}.text`)}</p></div><Icon/></Link>)}</div></section>}

    {show('spotlight')&&<Spotlight t={t} c={c} edit={edit} featuredId={featuredId} number={numbers.spotlight} extraClass={sectionClass('spotlight')} tag={tag('spotlight')}/>}

    {show('latest')&&<Latest t={t} items={latest} number={numbers.latest} extraClass={sectionClass('latest')} tag={tag('latest')}/>}

    {show('manifesto')&&<section className={`manifesto${sectionClass('manifesto')}`} data-reveal {...tag('manifesto')}><div className="manifesto-mark">“</div><p>{t('manifestoText')}</p><div><span>{t('manifestoSign')}</span><small>{t('manifestoSub')}</small></div></section>}
  </main>
}

// Pieza destacada: la ficha la elige el gestor; la imagen puede reemplazarse solo para el inicio
function Spotlight({t,c,edit,featuredId,number,extraClass,tag}){
  const item=getAllRecords().find(r=>r.id===featuredId)||getAllRecords()[0];
  if(!item)return null;
  const words=item.title.split(' '), cut=Math.ceil(words.length/2);
  const [genre,,support]=(item.format||'').split(' · ');
  const kicker=[genre,item.year,support].filter(Boolean).join(' · ').toUpperCase();
  const image=c.spotlightImage||item.image;
  return <section className={`spotlight${extraClass}`} data-reveal {...tag}><div className="spotlight-copy"><div className="section-label light"><span>{number}</span> {t('spotlightLabel')}</div><span className="spot-kicker">{kicker}</span><h2>{words.slice(0,cut).join(' ')}{words.length>1&&<><br/><i>{words.slice(cut).join(' ')}</i></>}</h2><p>{item.description}</p><dl><div><dt>{item.type==='Película'?'Dirección':'Autoría'}</dt><dd>{item.subtitle}</dd></div><div><dt>Colección</dt><dd>{item.collection}</dd></div></dl><Link to={recordPath(item)}>{t('spotlightCta')} <ArrowRight/></Link></div><div className="spotlight-image"><img src={image} alt={item.title} loading="lazy" decoding="async"/>{edit&&edit.image('spotlightImage',{label:c.spotlightImage?'Cambiar imagen':'Usar otra imagen',fallback:item.image,className:'home-edit-spot-img'})}<div className="film-code">CDO · {String(item.id).padStart(4,'0')}</div><Link className="spot-play" to={recordPath(item)}><CirclePlay/></Link></div></section>;
}

// Recién catalogado: índice de fichas; la fila activa cambia la imagen de la izquierda
function Latest({t,items,number,extraClass,tag}){
  const [active,setActive]=useState(0);
  const current=items[Math.min(active,items.length-1)];
  if(!current)return null;
  return <section className={`home-new${extraClass}`} data-reveal {...tag}>
    <div className="home-new-aside">
      <div className="section-label"><span>{number}</span> {t('latestLabel')}</div>
      <h2>{t('latestTitle')}</h2>
      <Link className="home-new-preview" to={recordPath(current)} tabIndex={-1} aria-hidden="true">
        {items.map((r,i)=><img key={r.id} src={r.image} alt="" loading="lazy" decoding="async" className={i===active?'is-on':''}/>)}
        <span>CDO · {String(current.id).padStart(4,'0')}</span>
      </Link>
      <Link className="home-new-all" to="/archivo">{t('latestLink')} <ArrowRight/></Link>
    </div>
    <ol className="home-new-list">{items.map((r,i)=><li key={r.id} className="stagger-item" style={{transitionDelay:`${i*60}ms`}}>
      <Link to={recordPath(r)} className={i===active?'is-active':''} onMouseEnter={()=>setActive(i)} onFocus={()=>setActive(i)}>
        <span className="home-new-num">{String(i+1).padStart(2,'0')}</span>
        <img className="home-new-thumb" src={r.image} alt="" loading="lazy" decoding="async"/>
        <div className="home-new-body"><span className="home-new-tag" style={tagStyle(r.color)}>{r.type}</span><h3>{r.title}</h3><p>{r.subtitle}</p></div>
        <div className="home-new-meta"><b>{r.year}</b><small>{r.collection}</small></div>
        <ArrowRight className="home-new-arrow"/>
      </Link>
    </li>)}</ol>
  </section>;
}
