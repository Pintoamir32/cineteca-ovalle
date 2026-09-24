import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, BookOpen, ChevronLeft, ChevronRight, CirclePlay, FileText, Film, Grid2X2, Layers, MapPin, Mic2, Search, Settings2, Sparkles, UserRound } from 'lucide-react';
import { Counter, RecordCard, SearchResults } from './components';
import { collections, locations, records, sections, site } from './data';
import { countByType, getAllRecords } from './repository';
import { buildSearchIndex, matchIndex } from './search-index';
import { SearchSelect } from './SearchSelect';
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
  const slides=c.slides, featuredId=edit?c.featuredId:site.featuredId;
  const show=id=>edit||!c.hidden?.includes(id);
  const sectionClass=id=>edit&&c.hidden?.includes(id)?' is-hidden-section':'';
  // En el gestor cada sección muestra su nombre al pasar el mouse
  const tag=id=>edit?{'data-edit':HOME_SECTIONS.find(([k])=>k===id)?.[1]}:{};
  // Numeración de secciones según las que están visibles
  const numbers={};let n=0;for(const id of ['portal','discovery','spotlight','latest'])if(!c.hidden?.includes(id))numbers[id]=String(++n).padStart(2,'0');

  const [term,setTerm]=useState(''),[advanced,setAdvanced]=useState(false),[showResults,setShowResults]=useState(false); const nav=useNavigate(); const searchRef=useRef(null);
  const [advType,setAdvType]=useState(''),[advYear,setAdvYear]=useState(''),[advCollection,setAdvCollection]=useState('');
  // En el gestor la diapositiva visible la controla el panel lateral
  const [ownSlide,setOwnSlide]=useState(0),[paused,setPaused]=useState(false);
  const slide=edit?edit.slide:ownSlide, setSlide=edit?edit.setSlide:setOwnSlide;
  const current=slides[Math.min(slide,slides.length-1)]||slides[0];
  useEffect(()=>{
    if(edit||paused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=setInterval(()=>setSlide(s=>(s+1)%slides.length),5000);
    return ()=>clearInterval(timer);
  },[paused,edit,slides.length]);
  const prevSlide=()=>setSlide(s=>(s-1+slides.length)%slides.length);
  const nextSlide=()=>setSlide(s=>(s+1)%slides.length);
  const index=useMemo(()=>buildSearchIndex(),[]);
  const results=useMemo(()=>matchIndex(term,index),[term,index]);
  const decadeOf=r=>{const m=/\d{4}/.exec(r.year);return m?Math.floor(Number(m[0])/10)*10:null};
  const allRecords=useMemo(()=>getAllRecords(),[]);
  const firstYear=useMemo(()=>Math.min(...allRecords.filter(r=>r.type==='Película').map(r=>Number((/\d{4}/.exec(r.year)||[])[0])).filter(Boolean)),[allRecords]);
  const decadeOptions=useMemo(()=>[...new Set(allRecords.map(decadeOf).filter(d=>d!==null))].sort((a,b)=>a-b),[allRecords]);
  const collectionOptions=useMemo(()=>[...new Set(allRecords.map(r=>r.collection))].sort((a,b)=>a.localeCompare(b,'es')),[allRecords]);
  const submit=e=>{e.preventDefault();const p=new URLSearchParams();if(term)p.set('q',term);if(advType)p.set('type',advType);if(advYear)p.set('year',advYear);if(advCollection)p.set('collection',advCollection);nav(`/archivo?${p.toString()}`);setTerm('');setShowResults(false)};
  const goTo=path=>{nav(path);setTerm('');setShowResults(false)};
  useEffect(()=>{const onClick=e=>{if(searchRef.current&&!searchRef.current.contains(e.target))setShowResults(false)};document.addEventListener('mousedown',onClick);return()=>document.removeEventListener('mousedown',onClick)},[]);
  const years=Number.isFinite(firstYear)?Math.floor((new Date().getFullYear()-firstYear)/10)*10:0;
  const latest=(c.latestIds?.length?c.latestIds.map(id=>allRecords.find(r=>r.id===id)).filter(Boolean):records.slice(0,4));
  const s=i=>`slides.${Math.min(slide,slides.length-1)}.${i}`;

  return <main className="home-page">
    <section className="hero-new" data-edit={edit?'Portada':undefined} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
      <div className="hero-photo" key={`photo-${slide}`}><img src={current.image} alt={current.alt} loading="eager" decoding="async"/><div className="photo-shade"/></div>
      {edit&&edit.image(s('image'),{label:`Cambiar foto · diapositiva ${slide+1}`,className:'home-edit-hero-img',aspect:null})}
      <div className="hero-edition">{t('heroEdition')}</div>
      <div className="hero-title" key={`title-${slide}`}>
        <div className="eyebrow"><span>●</span> {t(s('eyebrow'))}</div>
        <h1>{t(s('title'))}<br/>{edit?t(s('em'),{as:'em'}):<em>{current.em}</em>}</h1>
        <p>{t(s('desc'))}</p>
      </div>
      <div className="hero-index">
        <button type="button" className="hero-index-btn" onClick={prevSlide} aria-label="Diapositiva anterior"><ChevronLeft/></button>
        <b>{String(slide+1).padStart(2,'0')}</b><span/>{String(slides.length).padStart(2,'0')}
        <button type="button" className="hero-index-btn" onClick={nextSlide} aria-label="Siguiente diapositiva"><ChevronRight/></button>
      </div>
      <div className="hero-bottom-right">
        <Link className="hero-cta" to={current.link}>{t('heroCta')} <ArrowRight/></Link>
        <div className="hero-dots">{slides.map((x,i)=><button type="button" key={i} className={i===slide?'active':''} onClick={()=>setSlide(i)} aria-label={`Ir a la diapositiva ${i+1}`}/>)}</div>
      </div>
    </section>

    {show('search')&&<section className={`search-stage${sectionClass('search')}`} data-reveal {...tag('search')}><div className="search-intro"><span>{t('searchKicker')}</span><p>{t('searchTitle')}</p></div><div className="searchbox-wrap" ref={searchRef}><form className="searchbox" onSubmit={submit}><Search/><input value={term} onChange={e=>{setTerm(e.target.value);setShowResults(true)}} onFocus={()=>term&&setShowResults(true)} placeholder={c.searchPlaceholder}/><button><ArrowRight/></button></form>{showResults&&term&&<SearchResults results={results} onPick={goTo} className="home-results"/>}</div><button className="advanced-trigger" onClick={()=>setAdvanced(!advanced)}><Settings2/> {t('searchAdvanced')}</button>{advanced&&<div className="advanced-box"><SearchSelect label="Tipo de registro" value={advType} onChange={setAdvType} options={[{value:'',label:'Cualquier tipo'},...sections.map(x=>({value:x.type,label:x.type}))]}/><SearchSelect label="Década" value={advYear} onChange={setAdvYear} options={[{value:'',label:'Cualquier fecha'},...decadeOptions.map(d=>({value:String(d),label:`Década de ${d}`}))]}/><SearchSelect label="Colección" value={advCollection} onChange={setAdvCollection} options={[{value:'',label:'Cualquier colección'},...collectionOptions.map(x=>({value:x,label:x}))]}/></div>}</section>}

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

    {show('latest')&&<section className={`home-latest${sectionClass('latest')}`} data-reveal {...tag('latest')}><div className="section-label"><span>{numbers.latest}</span> {t('latestLabel')}</div><div className="home-latest-head"><h2>{t('latestTitle')}</h2><Link to="/archivo">{t('latestLink')} <ArrowRight/></Link></div><div className="record-grid">{latest.map((r,i)=><RecordCard item={r} index={i} key={r.id}/>)}</div></section>}

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
  return <section className={`spotlight${extraClass}`} data-reveal {...tag}><div className="spotlight-copy"><div className="section-label light"><span>{number}</span> {t('spotlightLabel')}</div><span className="spot-kicker">{kicker}</span><h2>{words.slice(0,cut).join(' ')}{words.length>1&&<><br/><i>{words.slice(cut).join(' ')}</i></>}</h2><p>{item.description}</p><dl><div><dt>{item.type==='Película'?'Dirección':'Autoría'}</dt><dd>{item.subtitle}</dd></div><div><dt>Colección</dt><dd>{item.collection}</dd></div></dl><Link to={`/ficha/${item.id}`}>{t('spotlightCta')} <ArrowRight/></Link></div><div className="spotlight-image"><img src={image} alt={item.title} loading="lazy" decoding="async"/>{edit&&edit.image('spotlightImage',{label:c.spotlightImage?'Cambiar imagen':'Usar otra imagen',fallback:item.image,className:'home-edit-spot-img'})}<div className="film-code">CDO · {String(item.id).padStart(4,'0')}</div><span className="restore-tag"><Sparkles/> {t('spotlightTag')}</span><Link className="spot-play" to={`/ficha/${item.id}`}><CirclePlay/></Link></div></section>;
}
