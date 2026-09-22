import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, Menu, Search, X } from 'lucide-react';
import { buildSearchIndex, matchIndex } from './search-index';
import { useRevealScan } from './reveal';

export function Brand(){return <Link className="brand" to="/"><span className="brand-symbol"><i/><i/><i/><i/></span><span><b>Cineteca</b><small>Ovalle</small></span></Link>}

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
  const [menu,setMenu]=useState(false), [term,setTerm]=useState(''), [showResults,setShowResults]=useState(false);
  const nav=useNavigate(), location=useLocation(), searchRef=useRef(null);
  const index=useMemo(()=>buildSearchIndex(),[location.pathname]);
  const results=useMemo(()=>matchIndex(term,index),[term,index]);
  const inner=location.pathname!=='/';
  const moreActive=['/colecciones','/linea-de-tiempo','/mapa','/nosotros'].includes(location.pathname);
  const submit=e=>{e.preventDefault();nav(`/archivo?q=${encodeURIComponent(term)}`);setTerm('');setShowResults(false);setMenu(false)};
  const goTo=path=>{nav(path);setTerm('');setShowResults(false);setMenu(false)};
  useEffect(()=>{const onClick=e=>{if(searchRef.current&&!searchRef.current.contains(e.target))setShowResults(false)};document.addEventListener('mousedown',onClick);return()=>document.removeEventListener('mousedown',onClick)},[]);
  useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'})},[location.pathname]);
  useRevealScan(location.pathname);
  return <div className="site"><ScrollProgress/><header className={`topbar ${inner?'innerbar':''}`}><Brand/><nav className={menu?'open':''}><NavLink to="/" end onClick={()=>setMenu(false)}>Inicio</NavLink><NavLink to="/archivo" onClick={()=>setMenu(false)}>Archivo</NavLink><NavLink to="/peliculas" onClick={()=>setMenu(false)}>Películas</NavLink><NavLink to="/personas" onClick={()=>setMenu(false)}>Personas</NavLink><NavLink to="/prensa" onClick={()=>setMenu(false)}>Prensa</NavLink><NavLink to="/entrevistas" onClick={()=>setMenu(false)}>Entrevistas</NavLink><NavLink to="/articulos" onClick={()=>setMenu(false)}>Artículos</NavLink><div className="more-nav"><button className={moreActive?'active':''} type="button" aria-haspopup="true">Más</button><div className="more-menu-panel"><NavLink to="/colecciones" onClick={()=>setMenu(false)}>Colecciones</NavLink><NavLink to="/linea-de-tiempo" onClick={()=>setMenu(false)}>Línea de tiempo</NavLink><NavLink to="/mapa" onClick={()=>setMenu(false)}>Mapa territorial</NavLink><NavLink to="/nosotros" onClick={()=>setMenu(false)}>La Cineteca</NavLink></div></div></nav><div className="top-actions"><div className="nav-search-wrap" ref={searchRef}><form className="nav-search" onSubmit={submit}><input value={term} onChange={e=>{setTerm(e.target.value);setShowResults(true)}} onFocus={()=>term&&setShowResults(true)} placeholder="Buscar"/><button aria-label="Buscar"><Search/></button></form>{showResults&&term&&<SearchResults results={results} onPick={goTo}/>}</div><button className="menu-toggle" onClick={()=>setMenu(!menu)} aria-label={menu?'Cerrar menú':'Abrir menú'}>{menu?<X/>:<Menu/>}</button></div></header><div className="route-view" key={location.pathname}><Outlet/></div><Footer/></div>
}

export function Footer(){return <footer><div className="footer-main"><Brand/><h2>El archivo<br/>sigue <i>creciendo.</i></h2><div className="footer-links"><div><small>EXPLORAR</small><Link to="/colecciones">Colecciones</Link><Link to="/linea-de-tiempo">Línea de tiempo</Link><Link to="/mapa">Mapa del archivo</Link></div><div><small>CONECTAR</small><a href="#instagram">Instagram</a><a href="mailto:archivo@cinetecadeovalle.cl">Contacto</a><Link to="/nosotros">Visítanos</Link></div></div></div><div className="footer-line"><span>© 2026 CINETECA DE OVALLE</span><span>OVALLE · COQUIMBO · CHILE</span><Link to="/">INICIO ↑</Link></div></footer>}

export const RecordCard = memo(function RecordCard({item,index=0}){return <Link className={`record-card card-${index%4} stagger-item`} style={{transitionDelay:`${(index%8)*60}ms`}} to={`/ficha/${item.id}`}><div className="record-photo"><img src={item.image} alt="" loading="lazy" decoding="async"/><span style={{background:item.color}}>{item.type}</span><i><ArrowDownRight/></i></div><div className="record-data"><span>{item.year} · {item.collection}</span><h3>{item.title}</h3><p>{item.subtitle}</p></div></Link>})

export const RecordRow = memo(function RecordRow({item,index=0}){return <Link className="record-row stagger-item" style={{transitionDelay:`${(index%8)*40}ms`}} to={`/ficha/${item.id}`}><div className="record-row-thumb"><img src={item.image} alt="" loading="lazy" decoding="async"/></div><div className="record-row-body"><span className="record-row-tag" style={{background:item.color}}>{item.type}</span><h3>{item.title}</h3><p>{item.subtitle}</p></div><div className="record-row-meta"><span>{item.year}</span><small>{item.collection}</small></div><ArrowRight/></Link>})
