import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components';
import { AboutPage, ArchivePage, CollectionsPage, MapPage, RichDetailPage, TimelinePage } from './pages';
import { Home } from './home';
import './styles.css';
import './responsive.css';
import './map.css';
import './navigation.css';
import './home-discovery.css';
import './animations.css';
import './ficha.css';
import { hydrate } from './store';

// El gestor se carga aparte para no sumar peso al sitio público
const AdminApp=lazy(()=>import('./admin/AdminApp'));

hydrate().finally(()=>createRoot(document.getElementById('root')).render(<BrowserRouter><Routes>
  <Route element={<Layout/>}>
    <Route path="/" element={<Home/>}/><Route path="/archivo" element={<ArchivePage/>}/>
    <Route path="/peliculas" element={<ArchivePage kind="peliculas"/>}/><Route path="/personas" element={<ArchivePage kind="personas"/>}/>
    <Route path="/prensa" element={<ArchivePage kind="prensa"/>}/><Route path="/entrevistas" element={<ArchivePage kind="entrevistas"/>}/>
    <Route path="/articulos" element={<ArchivePage kind="articulos"/>}/><Route path="/nosotros" element={<AboutPage/>}/>
    <Route path="/colecciones" element={<CollectionsPage/>}/><Route path="/linea-de-tiempo" element={<TimelinePage/>}/><Route path="/mapa" element={<MapPage/>}/>
    <Route path="/ficha/:id" element={<RichDetailPage/>}/><Route path="*" element={<NavigateHome/>}/>
  </Route>
  <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp/></Suspense>}/>
</Routes></BrowserRouter>));

function NavigateHome(){return <Home/>}
