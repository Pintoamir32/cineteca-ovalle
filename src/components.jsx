import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, Menu, Search, X } from 'lucide-react';
import { buildSearchIndex, matchIndex } from './search-index';
import { useRevealScan } from './reveal';
import { useSiteText } from './site-text';
import { tagStyle } from './color';
import { recordPath } from './repository';
import { LogoMark } from './Logo';

export function Brand(){return <Link className="brand" to="/" aria-label="Cineteca de Ovalle — inicio"><LogoMark/></Link>}

export function ScrollProgress(){
  const barRef=useRef(null);
  useEffect(()=>{
    const onScroll=()=>{
      const h=document.documentElement;
      const scrollable=h.scrollHeight-h.clientHeight;
      const pct=scrollable>0?(h.scrollTop/scrollable)*100:0;
      if(barRef.current)barRef.current.style.width=`${pct}%`;
    };
    onScroll();
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll);
    return ()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll)};
  },[]);
  return <div className="scroll-progress"><div ref={barRef}/></div>;
}

export function Counter({value,duration=1200,pad=0}){
  const format=n=>String(n).padStart(pad,'0');
  const ref=useRef(null), [display,setDisplay]=useState(typeof value==='number'?format(value):String(value));
  useEffect(()=>{
    const match=/^(\d+)(.*)$/.exec(String(value));
    if(!match||window.matchMedia('(prefers-reduced-motion: reduce)').matches){setDisplay(typeof value==='number'?format(value):String(value));return}
    const target=Number(match[1]), suffix=match[2]||'';
    let started=false, raf=null;
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting&&!started){
          started=true;
          const start=performance.now();
          const tick=now=>{
            const p=Math.min(1,(now-start)/duration);
            const eased=1-Math.pow(1-p,3);
            setDisplay(format(Math.round(target*eased))+suffix);
            if(p<1)raf=requestAnimationFrame(tick);
          };
          raf=requestAnimationFrame(tick);
          io.disconnect();
        }
      });
    },{threshold:.4});
    if(ref.current)io.observe(ref.current);
    return ()=>{io.disconnect();if(raf)cancelAnimationFrame(raf)};
  },[value,duration,pad]);
  return <span className="stat-counter" ref={ref}>{display}</span>;
}

export function SearchResults({results,onPick,className=''}){
  return <div className={`nav-search-results ${className}`}>{results.length?results.map(r=><button type="button" key={r.key} onMouseDown={()=>onPick(r.path)}><span>{r.title}</span><small>{r.group}</small></button>):<div className="no-match">Sin coincidencias directas — presiona Enter para buscar en todo el archivo.</div>}</div>
}

export function Layout(){
  const location=useLocation();
  useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'})},[location.pathname]);
  useRevealScan(location.pathname);
  return <div className="site"><ScrollProgress/><Topbar/><div className="route-view" key={location.pathname}><Outlet/></div><Footer/></div>
}

const NAV=[['/','Inicio'],['/archivo','Archivo'],['/peliculas','Películas'],['/personas','Personas'],['/prensa','Prensa'],['/entrevistas','Entrevistas'],['/articulos','Artículos']];
const MORE=[['/colecciones','Colecciones'],['/linea-de-tiempo','Línea de tiempo'],['/mapa','Mapa territorial'],['/nosotros','Sobre la Cineteca']];

// previewPath: en la vista previa del gestor, qué página se simula como activa
export function Topbar({previewPath}){
  const [menu,setMenu]=useState(false), [term,setTerm]=useState(''), [showResults,setShowResults]=useState(false);
  const nav=useNavigate(), location=useLocation(), searchRef=useRef(null);
  const path=previewPath||location.pathname;
  const index=useMemo(()=>buildSearchIndex(),[path]);
  const results=useMemo(()=>matchIndex(term,index),[term,index]);
  const inner=path!=='/';
  const moreActive=MORE.some(([to])=>to===path);
  const submit=e=>{e.preventDefault();nav(`/archivo?q=${encodeURIComponent(term)}`);setTerm('');setShowResults(false);setMenu(false)};
  const goTo=to=>{nav(to);setTerm('');setShowResults(false);setMenu(false)};
  useEffect(()=>{const onClick=e=>{if(searchRef.current&&!searchRef.current.contains(e.target))setShowResults(false)};document.addEventListener('mousedown',onClick);return()=>document.removeEventListener('mousedown',onClick)},[]);
  const link=([to,label])=><NavLink key={to} to={to} end={to==='/'} className={({isActive})=>(previewPath?to===previewPath:isActive)?'active':''} onClick={()=>setMenu(false)}>{label}</NavLink>;
  return <header className={`topbar ${inner?'innerbar':''}`}><Brand/><nav className={menu?'open':''}>{NAV.map(link)}<div className="more-nav"><button className={moreActive?'active':''} type="button" aria-haspopup="true">Más</button><div className="more-menu-panel">{MORE.map(link)}</div></div></nav><div className="top-actions"><div className="nav-search-wrap" ref={searchRef}><form className="nav-search" onSubmit={submit}><input value={term} onChange={e=>{setTerm(e.target.value);setShowResults(true)}} onFocus={()=>term&&setShowResults(true)} placeholder="Buscar en el archivo…"/><button aria-label="Buscar"><Search/></button></form>{showResults&&term&&<SearchResults results={results} onPick={goTo}/>}</div><button className="menu-toggle" onClick={()=>setMenu(!menu)} aria-label={menu?'Cerrar menú':'Abrir menú'}>{menu?<X/>:<Menu/>}</button></div></header>;
}

// Los textos del pie se editan desde «Inicio» en el gestor
export function Footer(){
  const {content:c,t}=useSiteText();
  const l=i=>t(`footerLinks.${i}`);
  return <footer><div className="footer-main"><Brand/><h2>{t('footerTitle',{em:'i'})}</h2><div className="footer-links"><div><small>{t('footerExplore')}</small><Link to="/colecciones">{l(0)}</Link><Link to="/linea-de-tiempo">{l(1)}</Link><Link to="/mapa">{l(2)}</Link></div><div><small>{t('footerConnect')}</small><a href={c.footerInstagram||'#instagram'} target={c.footerInstagram?.startsWith('http')?'_blank':undefined} rel="noreferrer">{l(3)}</a><a href={`mailto:${c.footerEmail}`}>{l(4)}</a><Link to="/nosotros">{l(5)}</Link></div></div></div><div className="footer-line"><span>{t('footerCopy')}</span><span>{t('footerPlace')}</span><Link to="/">{t('footerTop')}</Link></div></footer>;
}

export const RecordCard = memo(function RecordCard({item,index=0}){return <Link className={`record-card card-${index%4} stagger-item`} style={{transitionDelay:`${(index%8)*60}ms`}} to={recordPath(item)}><div className="record-photo"><img src={item.image} alt="" loading="lazy" decoding="async"/><span style={tagStyle(item.color)}>{item.type}</span><i><ArrowDownRight/></i></div><div className="record-data"><span>{item.year} · {item.collection}</span><h3>{item.title}</h3><p>{item.subtitle}</p></div></Link>})

export const RecordRow = memo(function RecordRow({item,index=0}){return <Link className="record-row stagger-item" style={{transitionDelay:`${(index%8)*40}ms`}} to={recordPath(item)}><div className="record-row-thumb"><img src={item.image} alt="" loading="lazy" decoding="async"/></div><div className="record-row-body"><span className="record-row-tag" style={tagStyle(item.color)}>{item.type}</span><h3>{item.title}</h3><p>{item.subtitle}</p></div><div className="record-row-meta"><span>{item.year}</span><small>{item.collection}</small></div><ArrowRight/></Link>})
