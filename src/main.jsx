import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components';
import { ArchivePage, CollectionsPage, MapPage, RichDetailPage, TimelinePage } from './pages';
import { AboutPage } from './about';
import { Home } from './home';
import { LegalPage } from './legal';
import { SubmitPage } from './submit';
import './styles.css';
import './responsive.css';
import './map.css';
import './navigation.css';
import './home-discovery.css';
import './animations.css';
import './ficha.css';
import './logo.css';
import { hydrate } from './store';

// Tras publicar una versión nueva, los archivos compilados anteriores dejan de existir y una página abierta
// desde antes ya no puede cargar sus partes. Se recarga una vez para tomar la versión nueva; si el gestor
// tiene cambios sin guardar, en vez de recargar muestra su aviso (ver AdminApp) para no perderlos.
const reloadForNewVersion=()=>{
  if(window.__cmsDirty){window.dispatchEvent(new CustomEvent('cms-new-version'));return}
  let last=0;try{last=Number(sessionStorage.getItem('cdo-reload'))||0}catch{/* sin almacenamiento */}
  if(Date.now()-last<30e3)return;// ya se intentó hace poco: no entrar en un ciclo de recargas
  try{sessionStorage.setItem('cdo-reload',String(Date.now()))}catch{/* sin almacenamiento */}
  window.location.reload();
};
window.addEventListener('vite:preloadError',e=>{e.preventDefault();reloadForNewVersion()});

// El gestor se carga aparte para no sumar peso al sitio público
const AdminApp=lazy(()=>import('./admin/AdminApp').catch(()=>{reloadForNewVersion();return {default:StaleVersion}}));
function StaleVersion(){
  return <p style={{maxWidth:520,margin:'20vh auto',padding:'0 16px',font:'16px/1.6 Manrope, sans-serif',textAlign:'center'}}>
    Se publicó una versión nueva del gestor. <button type="button" onClick={()=>window.location.reload()} style={{font:'inherit',fontWeight:700,textDecoration:'underline',border:0,background:'none',cursor:'pointer'}}>Recarga la página</button> para continuar.
  </p>;
}

hydrate().finally(()=>createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
  <Route element={<Layout/>}>
    <Route path="/" element={<Home/>}/><Route path="/archivo" element={<ArchivePage/>}/>
    <Route path="/peliculas" element={<ArchivePage kind="peliculas"/>}/><Route path="/personas" element={<ArchivePage kind="personas"/>}/>
    <Route path="/prensa" element={<ArchivePage kind="prensa"/>}/><Route path="/entrevistas" element={<ArchivePage kind="entrevistas"/>}/>
    <Route path="/articulos" element={<ArchivePage kind="articulos"/>}/><Route path="/nosotros" element={<AboutPage/>}/>
    <Route path="/colecciones" element={<CollectionsPage/>}/><Route path="/linea-de-tiempo" element={<TimelinePage/>}/><Route path="/mapa" element={<MapPage/>}/>
    <Route path="/ficha/:id" element={<RichDetailPage/>}/><Route path="/aviso-legal" element={<LegalPage/>}/><Route path="/inscribe-tu-obra" element={<SubmitPage/>}/><Route path="*" element={<NavigateHome/>}/>
  </Route>
  <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp/></Suspense>}/>
</Routes></BrowserRouter>));

function NavigateHome(){return <Home/>}
