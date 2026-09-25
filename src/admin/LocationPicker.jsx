import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';

const round=n=>Math.round(n*1e5)/1e5;
const pin=L.divIcon({className:'cms-map-pin',html:'<span></span>',iconSize:[30,40],iconAnchor:[15,38]});

// Buscador de lugares de OpenStreetMap (Nominatim). Se consulta al enviar, no por cada tecla,
// para respetar su política de uso.
async function geocode(q,signal){
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=cl&accept-language=es&q=${encodeURIComponent(q)}`;
  const res=await fetch(url,{signal,headers:{Accept:'application/json'}});
  if(!res.ok)throw new Error('search');
  return (await res.json()).map(r=>({name:r.name||r.display_name.split(',')[0],place:r.display_name,lat:Number(r.lat),lon:Number(r.lon)}));
}

/* Mapa para ubicar una comuna: busca el lugar, haz clic en el mapa o arrastra el marcador */
export function LocationPicker({lat,lon,valid,name,onPick}){
  const boxRef=useRef(null), mapRef=useRef(null), markerRef=useRef(null), pickRef=useRef(onPick);
  pickRef.current=onPick;
  const [query,setQuery]=useState(name||''), [results,setResults]=useState(null), [state,setState]=useState('idle');
  const abortRef=useRef(null);

  useEffect(()=>{
    const map=L.map(boxRef.current,{zoomControl:true,attributionControl:true}).setView(valid?[lat,lon]:[-30.6011,-71.199],valid?11:9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    const marker=L.marker(valid?[lat,lon]:[-30.6011,-71.199],{icon:pin,draggable:true,keyboard:false}).addTo(map);
    marker.on('dragend',()=>{const p=marker.getLatLng();pickRef.current({lat:round(p.lat),lon:round(p.lng)})});
    map.on('click',e=>{marker.setLatLng(e.latlng);pickRef.current({lat:round(e.latlng.lat),lon:round(e.latlng.lng)})});
    mapRef.current=map;markerRef.current=marker;
    // El contenedor puede cambiar de tamaño (panel lateral, ventana): Leaflet necesita saberlo
    const ro=new ResizeObserver(()=>map.invalidateSize());ro.observe(boxRef.current);
    return()=>{ro.disconnect();map.remove();abortRef.current?.abort()};
  },[]);

  // Coordenadas escritas a mano o elegidas en la búsqueda: el marcador las sigue
  useEffect(()=>{
    const map=mapRef.current, marker=markerRef.current;if(!map||!valid)return;
    const cur=marker.getLatLng();
    if(Math.abs(cur.lat-lat)<1e-7&&Math.abs(cur.lng-lon)<1e-7)return;
    marker.setLatLng([lat,lon]);
    if(!map.getBounds().pad(-.1).contains([lat,lon]))map.panTo([lat,lon]);
  },[lat,lon,valid]);

  const search=async e=>{
    e.preventDefault();
    const q=query.trim();if(!q)return;
    abortRef.current?.abort();const ctrl=new AbortController();abortRef.current=ctrl;
    setState('loading');
    try{const list=await geocode(q,ctrl.signal);setResults(list);setState(list.length?'idle':'empty')}
    catch(err){if(err.name!=='AbortError'){setResults(null);setState('error')}}
  };
  const choose=r=>{
    setResults(null);setState('idle');
    mapRef.current.setView([r.lat,r.lon],12);
    onPick({lat:round(r.lat),lon:round(r.lon)},r);
  };
  const center=()=>valid&&mapRef.current.setView([lat,lon],Math.max(mapRef.current.getZoom(),12));

  return <div className="cms-locpicker">
    <form className="cms-locpicker-search" onSubmit={search} role="search">
      <Search aria-hidden="true"/>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar un lugar: Punitaqui, Sotaquí, Plaza de Ovalle…" aria-label="Buscar un lugar"/>
      {query&&<button type="button" className="cms-icon-btn is-small" onClick={()=>{setQuery('');setResults(null);setState('idle')}} aria-label="Borrar búsqueda"><X/></button>}
      <button type="submit" className="cms-btn is-primary" disabled={state==='loading'}>{state==='loading'?'Buscando…':'Buscar'}</button>
    </form>
    {(results?.length>0||state==='empty'||state==='error')&&<div className="cms-locpicker-results">
      {state==='empty'&&<p>No se encontró ese lugar en Chile. Prueba con otro nombre o marca el punto en el mapa.</p>}
      {state==='error'&&<p>No se pudo buscar ahora. Revisa la conexión o marca el punto directamente en el mapa.</p>}
      {results?.map((r,i)=><button type="button" key={i} onClick={()=>choose(r)}><MapPin/><span><strong>{r.name}</strong><small>{r.place}</small></span></button>)}
    </div>}
    <div className="cms-locpicker-map">
      <div ref={boxRef} className="cms-locpicker-canvas"/>
      <button type="button" className="cms-locpicker-center" onClick={center} disabled={!valid} title="Centrar en el marcador"><LocateFixed/></button>
    </div>
    <p className="cms-help">Haz clic en el mapa o arrastra el marcador para fijar la posición exacta.</p>
  </div>;
}
