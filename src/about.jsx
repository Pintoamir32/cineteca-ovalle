import React from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowRight, ArrowUpRight, BookOpen, CalendarRange, FileText, Film, GraduationCap, Instagram, Layers, Mail, MapPin, Microscope, Mic2, Package, PenLine, Phone, Search, Share2, UserRound } from 'lucide-react';
import { Counter } from './components';
import { collections, locations, timelineEvents } from './data';
import { countByCollection, countByType, getAllRecords } from './repository';
import { useSiteText } from './site-text';
import { tagStyle } from './color';
import './about.css';

// Los textos viven en homeContent.about y se editan desde el gestor (Sitio → Sobre la Cineteca)
const PILLAR_ICONS=[Archive,Microscope,Share2,GraduationCap];
const HELP=[[Package,'Quiero aportar materiales al archivo'],[PenLine,'Corrección o dato para una ficha'],[Search,'Investigación con el archivo de la Cineteca']];

// Secciones que se pueden ocultar (la portada siempre se muestra); el nombre es el que ve el gestor
export const ABOUT_SECTIONS=[['intro','La Cineteca'],['pillars','Qué hacemos'],['numbers','El archivo hoy'],['history','Nuestra historia'],
  ['collections','Colecciones'],['help','Colabora'],['contact','Contacto'],['cta','Invitación final']];

const COUNTS=[
  {to:'/peliculas',icon:Film,label:'Películas',count:()=>countByType('Película')},
  {to:'/personas',icon:UserRound,label:'Personas',count:()=>countByType('Persona')},
  {to:'/prensa',icon:FileText,label:'Documentos de prensa',count:()=>countByType('Prensa')},
  {to:'/entrevistas',icon:Mic2,label:'Entrevistas',count:()=>countByType('Entrevista')},
  {to:'/articulos',icon:BookOpen,label:'Artículos',count:()=>countByType('Artículo')},
  {to:'/colecciones',icon:Layers,label:'Colecciones',count:()=>collections.length},
  {to:'/linea-de-tiempo',icon:CalendarRange,label:'Hitos',count:()=>timelineEvents.length},
  {to:'/mapa',icon:MapPin,label:'Comunas en el mapa',count:()=>locations.length}
];

const yearNum=e=>Number((/\d{4}/.exec(e.year)||[])[0])||0;

export function AboutPage(){
  const {content:c,t,edit}=useSiteText();
  const a=c.about||{};
  const email=c.footerEmail, instagram=c.footerInstagram;
  const handle=instagram?`@${instagram.replace(/\/+$/,'').split('/').pop()}`:'';
  const mail=subject=>`mailto:${email}?subject=${encodeURIComponent(subject)}`;
  // Historia: los hitos reales de la línea de tiempo (los cuatro primeros por año)
  const history=[...timelineEvents].sort((x,y)=>yearNum(x)-yearNum(y)).slice(0,4);
  const featured=collections.slice(0,3);
  const total=getAllRecords().length;

  // Secciones ocultas: en el sitio no aparecen; en el gestor se ven atenuadas. La numeración salta las ocultas.
  const hidden=a.hidden||[];
  const show=id=>(edit||!hidden.includes(id))&&(id!=='collections'||featured.length>0);
  const numbers={};let n=0;for(const [id] of ABOUT_SECTIONS)if(!hidden.includes(id)&&id!=='cta'&&(id!=='collections'||featured.length))numbers[id]=String(++n).padStart(2,'0');
  const attrs=(id,className,extra={})=>({className:`${className}${edit&&hidden.includes(id)?' is-hidden-section':''}`,'data-reveal':true,...(edit&&{'data-edit':ABOUT_SECTIONS.find(([k])=>k===id)[1]}),...extra});
  const num=id=><span>{numbers[id]||'—'}</span>;
  const anchors=[['pillars','que-hacemos','Qué hacemos'],['history','historia','Historia'],['help','colabora','Colabora'],['contact','contacto','Contacto']].filter(([id])=>!hidden.includes(id));

  return <main className="about2">
    <section className="about2-hero" data-edit={edit?'Portada':undefined}>
      <img src={a.heroImage} alt="" decoding="async"/>
      {edit&&edit.image('about.heroImage',{label:'Cambiar foto de portada',className:'about2-edit-img'})}
      <div className="about2-hero-shade"/>
      <div className="about2-hero-copy">
        <span className="about2-kicker">{t('about.heroKicker')}</span>
        <h1>{t('about.heroTitle',{em:'i'})}</h1>
        <p>{t('about.heroText')}</p>
        {anchors.length>0&&<nav className="about2-anchors" aria-label="En esta página">
          {anchors.map(([,href,label])=><a key={href} href={`#${href}`}>{label}</a>)}
        </nav>}
      </div>
    </section>

    {show('intro')&&<section {...attrs('intro','about2-intro')}>
      <div className="about2-label">{num('intro')} {t('about.introLabel')}</div>
      <div className="about2-intro-grid">
        <h2>{t('about.introTitle')}</h2>
        <div><p>{t('about.introText1')}</p>{(edit||a.introText2?.trim())&&<p>{t('about.introText2')}</p>}</div>
      </div>
      {(edit||a.quote?.trim())&&<blockquote className="about2-quote">{t('about.quote')}</blockquote>}
    </section>}

    {show('pillars')&&<section {...attrs('pillars','about2-pillars',{id:'que-hacemos'})}>
      <div className="about2-label">{num('pillars')} {t('about.pillarsLabel')}</div>
      <div className="about2-pillars-grid">{(a.pillars||[]).map((p,i)=>{const Icon=PILLAR_ICONS[i%PILLAR_ICONS.length];return <article key={i} className="stagger-item" style={{transitionDelay:`${i*70}ms`}}>
        <Icon/><b>{String(i+1).padStart(2,'0')}</b><h3>{t(`about.pillars.${i}.title`)}</h3><p>{t(`about.pillars.${i}.text`)}</p>
      </article>})}</div>
    </section>}

    {show('numbers')&&<section {...attrs('numbers','about2-numbers')}>
      <div className="about2-numbers-head">
        <div className="about2-label is-light">{num('numbers')} {t('about.numbersLabel')}</div>
        <h2><Counter value={total}/> {t('about.numbersTitle')}</h2>
        <p>{t('about.numbersText')}</p>
      </div>
      <div className="about2-numbers-grid">{COUNTS.map(({to,icon:Icon,label,count},i)=><Link key={to} to={to} className="stagger-item" style={{transitionDelay:`${i*50}ms`}}>
        <Icon/><strong><Counter value={count()} pad={2}/></strong><span>{label}</span><ArrowUpRight className="about2-go"/>
      </Link>)}</div>
    </section>}

    {show('history')&&<section {...attrs('history','about2-history',{id:'historia'})}>
      <div className="about2-section-head">
        <div><div className="about2-label">{num('history')} {t('about.historyLabel')}</div><h2>{t('about.historyTitle')}</h2></div>
        <Link to="/linea-de-tiempo" className="about2-link">{t('about.historyLink')} <ArrowRight/></Link>
      </div>
      {history.length?<ol className="about2-history-list">{history.map((e,i)=><li key={`${e.year}-${i}`} className="stagger-item" style={{transitionDelay:`${i*80}ms`}}>
        <b>{e.year}</b><span className="about2-dot"/><div><small>{e.type}</small><h3>{e.title}</h3>{e.text&&<p>{e.text}</p>}</div>
      </li>)}</ol>:<p className="about2-empty">{t('about.historyEmpty')}</p>}
    </section>}

    {show('collections')&&<section {...attrs('collections','about2-collections')}>
      <div className="about2-section-head">
        <div><div className="about2-label">{num('collections')} {t('about.collectionsLabel')}</div><h2>{t('about.collectionsTitle')}</h2></div>
        <Link to="/colecciones" className="about2-link">{t('about.collectionsLink')} <ArrowRight/></Link>
      </div>
      <div className="about2-collections-grid">{featured.map((col,i)=><Link key={col.slug||i} to={`/archivo?collection=${encodeURIComponent(col.title)}`} className="stagger-item" style={{transitionDelay:`${i*70}ms`}}>
        {col.image?<img src={col.image} alt="" loading="lazy" decoding="async"/>:<span className="about2-noimg"/>}
        <div><b style={tagStyle(col.color)}>{countByCollection(col.title)} fichas</b><h3>{col.title}</h3>{col.description&&<p>{col.description}</p>}</div>
      </Link>)}</div>
    </section>}

    {show('help')&&<section {...attrs('help','about2-help',{id:'colabora'})}>
      <div className="about2-label">{num('help')} {t('about.helpLabel')}</div>
      <h2>{t('about.helpTitle')}</h2>
      <div className="about2-help-grid">{(a.help||[]).map((h,i)=>{const [Icon,subject]=HELP[i%HELP.length];return <a key={i} href={mail(subject)}>
        <Icon/><h3>{t(`about.help.${i}.title`)}</h3><p>{t(`about.help.${i}.text`)}</p><span>{t(`about.help.${i}.cta`)} <ArrowRight/></span>
      </a>})}</div>
    </section>}

    {show('contact')&&<section {...attrs('contact','about2-contact',{id:'contacto'})}>
      <div>
        <div className="about2-label is-light">{num('contact')} {t('about.contactLabel')}</div>
        <h2>{t('about.contactTitle')}</h2>
        <p>{t('about.contactText')}</p>
      </div>
      <ul>
        {email&&<li><Mail/><div><small>{t('about.contactEmailLabel')}</small><a href={`mailto:${email}`}>{email}</a></div></li>}
        {instagram&&<li><Instagram/><div><small>{t('about.contactInstagramLabel')}</small><a href={instagram} target="_blank" rel="noreferrer">{handle}</a></div></li>}
        {(edit||a.contactPhone?.trim())&&<li><Phone/><div><small>{t('about.contactPhoneLabel')}</small>{edit?t('about.contactPhone'):<a href={`tel:${a.contactPhone.replace(/[^\d+]/g,'')}`}>{a.contactPhone}</a>}</div></li>}
        {(edit||a.contactPlace?.trim())&&<li><MapPin/><div><small>{t('about.contactPlaceLabel')}</small><span>{t('about.contactPlace')}</span></div></li>}
      </ul>
    </section>}

    {show('cta')&&<section {...attrs('cta','about2-cta')}>
      <h2>{t('about.ctaTitle')}</h2>
      <div><Link to="/archivo">{t('about.ctaExplore')} <ArrowRight/></Link><Link to="/mapa">{t('about.ctaMap')} <ArrowRight/></Link></div>
    </section>}
  </main>;
}
