import React from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowRight, ArrowUpRight, BookOpen, CalendarRange, FileText, Film, GraduationCap, Instagram, Layers, Mail, MapPin, Microscope, Mic2, Package, PenLine, Search, Share2, UserRound } from 'lucide-react';
import { Counter } from './components';
import { collections, locations, timelineEvents } from './data';
import { countByCollection, countByType, getAllRecords } from './repository';
import { useSiteText } from './site-text';
import { tagStyle } from './color';
import './about.css';

const PILLARS=[
  {icon:Archive,title:'Preservar',text:'Rescatamos, limpiamos y digitalizamos películas, fotografías y documentos para que no se pierdan con el tiempo.'},
  {icon:Microscope,title:'Investigar',text:'Catalogamos cada pieza con su contexto: quién la hizo, dónde, cuándo y qué nos cuenta del territorio.'},
  {icon:Share2,title:'Compartir',text:'Abrimos el archivo a la comunidad en línea, con fichas, colecciones, un mapa y una línea de tiempo.'},
  {icon:GraduationCap,title:'Formar',text:'Impulsamos funciones, encuentros y actividades que acercan el cine y la memoria a nuevas generaciones.'}
];

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
  const {content:c}=useSiteText();
  const email=c.footerEmail, instagram=c.footerInstagram;
  const handle=instagram?`@${instagram.replace(/\/+$/,'').split('/').pop()}`:'';
  const mail=subject=>`mailto:${email}?subject=${encodeURIComponent(subject)}`;
  // Historia: los hitos reales de la línea de tiempo (los cuatro primeros por año)
  const history=[...timelineEvents].sort((a,b)=>yearNum(a)-yearNum(b)).slice(0,4);
  const featured=collections.slice(0,3);
  const total=getAllRecords().length;

  return <main className="about2">
    <section className="about2-hero">
      <img src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1800&q=85" alt="" decoding="async"/>
      <div className="about2-hero-shade"/>
      <div className="about2-hero-copy">
        <span className="about2-kicker">SOBRE LA CINETECA · DESDE 1968</span>
        <h1>Una memoria<br/>en <i>movimiento.</i></h1>
        <p>La Cineteca de Ovalle preserva, investiga y comparte el patrimonio audiovisual de la Provincia del Limarí.</p>
        <nav className="about2-anchors" aria-label="En esta página">
          <a href="#que-hacemos">Qué hacemos</a><a href="#historia">Historia</a><a href="#colabora">Colabora</a><a href="#contacto">Contacto</a>
        </nav>
      </div>
    </section>

    <section className="about2-intro" data-reveal>
      <div className="about2-label"><span>01</span> LA CINETECA</div>
      <div className="about2-intro-grid">
        <h2>Las imágenes también construyen <em>territorio.</em></h2>
        <div>
          <p>Desde las primeras funciones comunitarias hasta los procesos actuales de digitalización, este archivo reúne las huellas de una cultura cinematográfica profundamente vinculada con su gente.</p>
          <p>Nuestra misión es conservar esas imágenes y devolverlas a la comunidad como una memoria abierta, accesible y viva: un lugar donde cualquier persona pueda buscar, mirar y reconocerse.</p>
        </div>
      </div>
      <blockquote className="about2-quote">“Preservar es también volver a mirar juntos.”</blockquote>
    </section>

    <section className="about2-pillars" id="que-hacemos" data-reveal>
      <div className="about2-label"><span>02</span> QUÉ HACEMOS</div>
      <div className="about2-pillars-grid">{PILLARS.map(({icon:Icon,title,text},i)=><article key={title} className="stagger-item" style={{transitionDelay:`${i*70}ms`}}>
        <Icon/><b>{String(i+1).padStart(2,'0')}</b><h3>{title}</h3><p>{text}</p>
      </article>)}</div>
    </section>

    <section className="about2-numbers" data-reveal>
      <div className="about2-numbers-head">
        <div className="about2-label is-light"><span>03</span> EL ARCHIVO HOY</div>
        <h2><Counter value={total}/> registros abiertos a todo público</h2>
        <p>Cada número es una puerta: entra y recorre el archivo por lo que te interese.</p>
      </div>
      <div className="about2-numbers-grid">{COUNTS.map(({to,icon:Icon,label,count},i)=><Link key={to} to={to} className="stagger-item" style={{transitionDelay:`${i*50}ms`}}>
        <Icon/><strong><Counter value={count()} pad={2}/></strong><span>{label}</span><ArrowUpRight className="about2-go"/>
      </Link>)}</div>
    </section>

    <section className="about2-history" id="historia" data-reveal>
      <div className="about2-section-head">
        <div><div className="about2-label"><span>04</span> NUESTRA HISTORIA</div><h2>Hitos que nos trajeron hasta aquí</h2></div>
        <Link to="/linea-de-tiempo" className="about2-link">Ver la línea de tiempo completa <ArrowRight/></Link>
      </div>
      {history.length?<ol className="about2-history-list">{history.map((e,i)=><li key={`${e.year}-${i}`} className="stagger-item" style={{transitionDelay:`${i*80}ms`}}>
        <b>{e.year}</b><span className="about2-dot"/><div><small>{e.type}</small><h3>{e.title}</h3>{e.text&&<p>{e.text}</p>}</div>
      </li>)}</ol>:<p className="about2-empty">Pronto sumaremos los hitos de nuestra historia.</p>}
    </section>

    {featured.length>0&&<section className="about2-collections" data-reveal>
      <div className="about2-section-head">
        <div><div className="about2-label"><span>05</span> COLECCIONES</div><h2>Recorridos para empezar</h2></div>
        <Link to="/colecciones" className="about2-link">Todas las colecciones <ArrowRight/></Link>
      </div>
      <div className="about2-collections-grid">{featured.map((col,i)=><Link key={col.slug||i} to={`/archivo?collection=${encodeURIComponent(col.title)}`} className="stagger-item" style={{transitionDelay:`${i*70}ms`}}>
        {col.image?<img src={col.image} alt="" loading="lazy" decoding="async"/>:<span className="about2-noimg"/>}
        <div><b style={tagStyle(col.color)}>{countByCollection(col.title)} fichas</b><h3>{col.title}</h3>{col.description&&<p>{col.description}</p>}</div>
      </Link>)}</div>
    </section>}

    <section className="about2-help" id="colabora" data-reveal>
      <div className="about2-label"><span>06</span> COLABORA CON EL ARCHIVO</div>
      <h2>La memoria se construye <em>entre todos.</em></h2>
      <div className="about2-help-grid">
        <a href={mail('Quiero aportar materiales al archivo')}><Package/><h3>Aporta materiales</h3><p>¿Tienes películas, fotos, afiches o recortes guardados? Escríbenos: podemos digitalizarlos y sumarlos al archivo.</p><span>Escribir <ArrowRight/></span></a>
        <a href={mail('Corrección o dato para una ficha')}><PenLine/><h3>Completa una ficha</h3><p>Si reconoces a alguien, un lugar o una fecha, o encuentras un error, cuéntanos y actualizamos la ficha.</p><span>Enviar un dato <ArrowRight/></span></a>
        <a href={mail('Investigación con el archivo de la Cineteca')}><Search/><h3>Investiga con nosotros</h3><p>Estudiantes, docentes e investigadores pueden solicitar acceso a materiales y apoyo para sus proyectos.</p><span>Consultar <ArrowRight/></span></a>
      </div>
    </section>

    <section className="about2-contact" id="contacto" data-reveal>
      <div>
        <div className="about2-label is-light"><span>07</span> CONTACTO</div>
        <h2>Conversemos.</h2>
        <p>Para consultas, visitas, aportes o proyectos en conjunto, escríbenos o síguenos en redes.</p>
      </div>
      <ul>
        {email&&<li><Mail/><div><small>Correo</small><a href={`mailto:${email}`}>{email}</a></div></li>}
        {instagram&&<li><Instagram/><div><small>Instagram</small><a href={instagram} target="_blank" rel="noreferrer">{handle}</a></div></li>}
        <li><MapPin/><div><small>Dónde estamos</small><span>{c.footerPlace?c.footerPlace.replace(/\s*·\s*/g,', ').toLowerCase().replace(/(^|, )(\p{L})/gu,(m,a,b)=>a+b.toUpperCase()):'Ovalle, Coquimbo, Chile'}</span></div></li>
      </ul>
    </section>

    <section className="about2-cta" data-reveal>
      <h2>Ven a conocer<br/><em>el archivo.</em></h2>
      <div><Link to="/archivo">Explorar el archivo <ArrowRight/></Link><Link to="/mapa">Ver el mapa territorial <ArrowRight/></Link></div>
    </section>
  </main>;
}
