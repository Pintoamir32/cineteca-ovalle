import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { recordPath } from './repository';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filmPin=L.divIcon({className:'film-map-pin',html:'<span></span>',iconSize:[26,34],iconAnchor:[13,32],popupAnchor:[0,-30]});
const placeDot=L.divIcon({className:'film-map-place',html:'<span></span>',iconSize:[16,16],iconAnchor:[8,8]});

/* Mapa del archivo: las comunas (puntos claros) y los lugares exactos donde se filmó cada película (pines).
   focus: comuna elegida en la lista; el mapa se acerca a ella */
export function FilmMap({places,points,focus,onPlace}){
  const boxRef=useRef(null), mapRef=useRef(null), layerRef=useRef(null), navigate=useNavigate(), placeRef=useRef(onPlace);
  placeRef.current=onPlace;

  useEffect(()=>{
    const map=L.map(boxRef.current,{scrollWheelZoom:false}).setView([-30.65,-71.05],9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    layerRef.current=L.layerGroup().addTo(map);mapRef.current=map;
    // Los enlaces de las ventanas abren la ficha sin recargar la página
    const onClick=e=>{const a=e.target.closest?.('a[data-to]');if(a){e.preventDefault();navigate(a.dataset.to)}};
    boxRef.current.addEventListener('click',onClick);
    const ro=new ResizeObserver(()=>map.invalidateSize());ro.observe(boxRef.current);
    const box=boxRef.current;
    return()=>{ro.disconnect();box.removeEventListener('click',onClick);map.remove()};
  },[navigate]);

  useEffect(()=>{
    const map=mapRef.current, layer=layerRef.current;if(!map)return;
    layer.clearLayers();
    for(const l of places)L.marker([l.lat,l.lon],{icon:placeDot,title:l.name}).on('click',()=>placeRef.current?.(l)).bindTooltip(l.name,{direction:'top',offset:[0,-6]}).addTo(layer);
    for(const pt of points){
      const r=pt.record;
      // Al pasar el mouse: carátula, título y algunos datos; al hacer clic se abre la ficha
      const [genre,duration]=String(r.format||'').split(' · ');
      const details=[r.year,genre,duration].filter(Boolean).join(' · ');
      L.marker([pt.lat,pt.lon],{icon:filmPin,title:r.title,keyboard:true}).bindTooltip(`<div class="film-map-pop">
        ${r.image?`<img src="${esc(r.image)}" alt="">`:''}
        <small>${esc(details)}</small>
        <strong>${esc(r.title)}</strong>
        ${r.subtitle?`<span>Dirección: ${esc(r.subtitle)}</span>`:''}
        <span class="film-map-place-label">${esc(pt.label?`${pt.label} · ${pt.place}`:pt.place)}</span>
        <em>Clic para ver la ficha →</em>
      </div>`,{direction:'top',offset:[0,-30],opacity:1,className:'film-map-tip'})
        .on('click',()=>navigate(recordPath(r))).addTo(layer);
    }
    const all=[...places.map(l=>[l.lat,l.lon]),...points.map(p=>[p.lat,p.lon])];
    if(all.length&&!focus)map.fitBounds(all,{padding:[40,40],maxZoom:11});
  },[places,points]);// eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{if(focus&&mapRef.current)mapRef.current.flyTo([focus.lat,focus.lon],12,{duration:.6})},[focus]);

  return <div ref={boxRef} className="film-map-canvas"/>;
}
