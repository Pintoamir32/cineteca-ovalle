import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { collections, heroSlides, locations, records, site, timelineEvents } from '../data';
import { countByCollection, countByLocation } from '../repository';
import { moveListItem, removeListItem, saveCollection, saveListItem, saveLocation, saveTimelineEvent, setData, useStoreVersion } from '../store';
import { EditorShell, PageHead, PanelBlock, useAdminNav } from './AdminApp';
import { Choice, ColorSwatches, Editable, EditableImage, RecordPicker, palette, useUi } from './fields';

const pad=n=>String(n).padStart(2,'0');
const slugify=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

// Borrador de un elemento de lista (índice numérico o "nuevo")
function useItemDraft(list,blank){
  const {index}=useParams(), isNew=index==='nuevo', i=isNew?-1:Number(index), existing=list[i];
  const [draft,setDraft]=useState(()=>existing?{...existing}:blank());
  const [dirty,setDirty]=useState(false);
  const set=patch=>{setDraft(d=>({...d,...patch}));setDirty(true)};
  return {isNew,i,existing,draft,set,dirty,setDirty,reset:()=>{setDraft({...existing});setDirty(false)}};
}

// Guardar / eliminar / descartar comunes a todos los editores de lista
function useItemActions({base,item,label,save,remove,removeText,stayAfterSave=true}){
  const navigate=useNavigate(), {setDirty}=useAdminNav(), {toast,confirm}=useUi();
  return {
    onSave:async()=>{
      const err=save.validate?.();
      if(err)return toast(err,'error');
      try{await save.run()}catch{return toast('No se pudo guardar. Revisa el espacio disponible del navegador.','error')}
      item.setDirty(false);setDirty(false);
      toast(item.isNew?`${label} creada y publicada.`:'Cambios guardados y publicados.');
      if(item.isNew||!stayAfterSave)navigate(base);
    },
    onDelete:async()=>{
      if(!await confirm({title:`¿Eliminar ${label.toLowerCase()}?`,text:removeText,ok:'Eliminar',danger:true}))return;
      await remove();setDirty(false);toast(`${label} eliminada.`);navigate(base);
    },
    onDiscard:async()=>{if(await confirm({title:'¿Descartar los cambios?',ok:'Descartar'}))item.reset()}
  };
}

const keyed=Component=>function Keyed(){const {index}=useParams();return <Component key={index}/>};
const NotFound=({back})=>{const {go}=useAdminNav();return <div className="cms-page"><p className="cms-empty">Este elemento no existe. <button type="button" className="cms-btn" onClick={()=>go(back)}>Volver</button></p></div>};

/* ================= Portada ================= */

export function HomeManager(){
  useStoreVersion();
  const {go}=useAdminNav(), {toast,confirm}=useUi(), [picking,setPicking]=useState(false);
  const featured=records.find(r=>r.id===site.featuredId);
  const remove=async i=>{
    if(heroSlides.length<=1)return toast('La portada necesita al menos una diapositiva.','error');
    if(await confirm({title:'¿Eliminar esta diapositiva?',text:`“${heroSlides[i].title.replace(/\n/g,' ')} ${heroSlides[i].em}” dejará de mostrarse en la portada.`,ok:'Eliminar',danger:true})){await removeListItem('heroSlides',i);toast('Diapositiva eliminada.')}
  };
  return <div className="cms-page">
    <PageHead eyebrow="SITIO" title="Diapositivas" desc="Rotan en la parte superior de la página de inicio, en este orden. Los demás textos del inicio se editan en «Inicio»."><button type="button" className="cms-btn" onClick={()=>go('/admin/inicio')}><Pencil/> Editar el inicio completo</button></PageHead>
    <section className="cms-section">
      <div className="cms-section-head"><h2>Diapositivas · {heroSlides.length}</h2><button type="button" className="cms-btn is-primary" onClick={()=>go('/admin/portada/nuevo')}><Plus/> Nueva diapositiva</button></div>
      <div className="cms-slides">{heroSlides.map((s,i)=><article key={i} className="cms-slide-card">
        <button type="button" className="cms-slide-thumb" onClick={()=>go(`/admin/portada/${i}`)}>
          <img src={s.image} alt=""/><span className="cms-slide-num">{pad(i+1)}</span>
          <div><small>{s.eyebrow}</small><strong>{s.title.replace(/\n/g,' ')} <em>{s.em}</em></strong></div>
          <span className="cms-slide-edit"><Pencil/> Editar</span>
        </button>
        <div className="cms-slide-tools">
          <button type="button" className="cms-icon-btn" disabled={i===0} onClick={()=>moveListItem('heroSlides',i,-1)} aria-label="Subir"><ArrowUp/></button>
          <button type="button" className="cms-icon-btn" disabled={i===heroSlides.length-1} onClick={()=>moveListItem('heroSlides',i,1)} aria-label="Bajar"><ArrowDown/></button>
          <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>remove(i)} aria-label="Eliminar"><Trash2/></button>
        </div>
      </article>)}</div>
    </section>
    <section className="cms-section">
      <div className="cms-section-head"><h2>Pieza destacada</h2><button type="button" className="cms-btn" onClick={()=>setPicking(true)}><Star/> Cambiar pieza</button></div>
      {featured?<div className="cms-featured-card">
        <img src={featured.image} alt=""/>
        <div><small>{featured.type} · {featured.year}</small><h3>{featured.title}</h3><p>{featured.description}</p>
          <button type="button" className="cms-btn" onClick={()=>go(`/admin/registros/${featured.slug}/${featured.id}`)}><Pencil/> Editar ficha</button></div>
      </div>:<p className="cms-empty">No hay pieza destacada: se mostrará la primera ficha del archivo.</p>}
    </section>
    {picking&&<RecordPicker title="Elegir pieza destacada" action="Elegir" exclude={[site.featuredId]} onPick={r=>setData({site:{...site,featuredId:r.id}}).then(()=>toast(`“${r.title}” ahora es la pieza destacada.`))} onClose={()=>setPicking(false)}/>}
  </div>;
}

const LINKS=[['/archivo','Archivo completo'],['/peliculas','Películas'],['/personas','Personas'],['/prensa','Prensa'],['/entrevistas','Entrevistas'],['/articulos','Artículos'],['/colecciones','Colecciones'],['/linea-de-tiempo','Línea de tiempo'],['/mapa','Mapa'],['/nosotros','Sobre la Cineteca']];

export const SlideEditor=keyed(function SlideEditor(){
  useStoreVersion();
  const item=useItemDraft(heroSlides,()=>({eyebrow:'NUEVA SECCIÓN',title:'Escribe aquí\nel título',em:'destacado.',desc:'',image:'',alt:'',link:'/archivo'}));
  const {draft:s,set}=item;
  const actions=useItemActions({base:'/admin/portada',item,label:'Diapositiva',
    save:{validate:()=>!s.image?'Añade una imagen antes de guardar.':!s.title.trim()?'Escribe un título.':null,run:()=>saveListItem('heroSlides',item.i,s)},
    remove:()=>removeListItem('heroSlides',item.i),removeText:'Dejará de mostrarse en la portada.'});
  const {go}=useAdminNav();
  if(!item.isNew&&!item.existing)return <NotFound back="/admin/portada"/>;
  const links=LINKS.map(([value,label])=>({value,label:`${label} · ${value}`}));
  return <EditorShell crumb={`Diapositivas · ${item.isNew?'Nueva':`Diapositiva ${pad(item.i+1)}`}`} title={`${s.title.replace(/\n/g,' ')} ${s.em}`} isNew={item.isNew} dirty={item.dirty}
    onBack={()=>go('/admin/portada')} viewHref="/" {...actions} onDelete={heroSlides.length>1?actions.onDelete:undefined}
    panel={<>
      <PanelBlock title="El botón «Explorar» lleva a"><Choice value={s.link} options={links} onChange={link=>set({link})}/></PanelBlock>
      <PanelBlock title="Descripción de la imagen"><p className="cms-help">Para personas que usan lectores de pantalla.</p><Editable className="cms-panel-edit" value={s.alt} onChange={alt=>set({alt})} placeholder="Ej.: Rodaje en el valle" label="Descripción de la imagen"/></PanelBlock>
      <PanelBlock title="Consejo"><p className="cms-help">Cada salto de línea del título se respeta en la portada. El remate en cursiva se muestra en color lima.</p></PanelBlock>
    </>}>
    <div className="pv-slide">
      <EditableImage className="pv-slide-photo" src={s.image} onChange={image=>set({image})} alt={s.alt} label="Cambiar fotografía"/>
      <div className="pv-slide-shade"/>
      <div className="pv-slide-copy">
        <div className="pv-eyebrow"><i>●</i><Editable value={s.eyebrow} onChange={eyebrow=>set({eyebrow:eyebrow.toUpperCase()})} placeholder="ANTETÍTULO" label="Antetítulo"/></div>
        <h1><Editable multiline value={s.title} onChange={title=>set({title})} placeholder="Título" label="Título"/><Editable as="em" value={s.em} onChange={em=>set({em})} placeholder="remate." label="Remate en cursiva"/></h1>
        <Editable as="p" multiline value={s.desc} onChange={desc=>set({desc})} placeholder="Una frase breve que acompaña al título." label="Bajada"/>
        <span className="pv-slide-cta">Explorar <ArrowRight/></span>
      </div>
    </div>
  </EditorShell>;
});

/* ================= Colecciones ================= */

export function CollectionList(){
  useStoreVersion();
  const {go}=useAdminNav();
  return <div className="cms-page">
    <PageHead eyebrow="SITIO" title="Colecciones" desc="Recorridos temáticos. Cada ficha pertenece a una colección."><button type="button" className="cms-btn is-primary" onClick={()=>go('/admin/colecciones/nuevo')}><Plus/> Nueva colección</button></PageHead>
    <div className="cms-collections">{collections.map((c,i)=><button type="button" key={c.slug||i} className="cms-collection" onClick={()=>go(`/admin/colecciones/${i}`)}>
      <img src={c.image} alt=""/><div className="cms-collection-shade"/>
      <span>{pad(i+1)} · {c.years}</span><h3>{c.title}</h3><b style={{background:c.color}}>{countByCollection(c.title)} registros</b>
    </button>)}</div>
  </div>;
}

export const CollectionEditor=keyed(function CollectionEditor(){
  useStoreVersion();
  const item=useItemDraft(collections,()=>({slug:'',title:'',years:'',description:'',image:'',color:palette()[collections.length%palette().length]}));
  const {draft:c,set}=item, {go}=useAdminNav();
  const count=item.existing?countByCollection(item.existing.title):0;
  const actions=useItemActions({base:'/admin/colecciones',item,label:'Colección',
    save:{validate:()=>!c.title.trim()?'Escribe un nombre para la colección.':!c.image?'Añade una imagen de portada.':collections.some((x,j)=>j!==item.i&&x.title===c.title.trim())?'Ya existe una colección con ese nombre.':null,
      run:()=>saveCollection(item.i,{...c,title:c.title.trim(),slug:slugify(c.title)})},
    remove:()=>removeListItem('collections',item.i),removeText:count?`Tiene ${count} registros. Las fichas conservarán el nombre de la colección, pero esta dejará de aparecer en la página de colecciones.`:'Dejará de aparecer en la página de colecciones.'});
  if(!item.isNew&&!item.existing)return <NotFound back="/admin/colecciones"/>;
  const members=item.existing?records.filter(r=>r.collection===item.existing.title):[];
  return <EditorShell crumb={`Colecciones · ${item.isNew?'Nueva':pad(item.i+1)}`} title={c.title} isNew={item.isNew} dirty={item.dirty}
    onBack={()=>go('/admin/colecciones')} viewHref="/colecciones" {...actions}
    panel={<>
      <PanelBlock title="Color"><ColorSwatches value={c.color} onChange={color=>set({color})}/></PanelBlock>
      {item.existing&&item.existing.title!==c.title&&<PanelBlock title="Cambio de nombre"><p className="cms-help">Al guardar, las {count} fichas de esta colección se actualizarán con el nuevo nombre.</p></PanelBlock>}
      <PanelBlock title={`Registros · ${members.length}`}>
        {members.length?<ul className="cms-mini-list">{members.slice(0,12).map(r=><li key={r.id}><button type="button" onClick={()=>go(`/admin/registros/${r.slug}/${r.id}`)}><img src={r.image} alt=""/><span>{r.title}<small>{r.type}</small></span></button></li>)}</ul>:<p className="cms-help">Asigna fichas a esta colección desde el editor de cada ficha.</p>}
        {members.length>12&&<p className="cms-help">y {members.length-12} más…</p>}
      </PanelBlock>
    </>}>
    <div className="pv-collection-wrap">
      <EditableImage className="pv-collection" src={c.image} onChange={image=>set({image})} label="Cambiar portada" aspect={3/4}>
        <div className="pv-collection-shade"/>
        <div className="pv-collection-copy">
          <span>{pad(item.isNew?collections.length+1:item.i+1)} · <Editable value={c.years} onChange={years=>set({years})} placeholder="1968—1990" label="Período"/></span>
          <Editable as="h2" wrap value={c.title} onChange={title=>set({title})} placeholder="Nombre de la colección" label="Nombre"/>
          <Editable as="p" multiline value={c.description} onChange={description=>set({description})} placeholder="De qué trata este recorrido…" label="Descripción"/>
          <b style={{background:c.color}}>{count} registros <ArrowRight/></b>
        </div>
      </EditableImage>
    </div>
  </EditorShell>;
});

/* ================= Línea de tiempo ================= */

export function TimelineList(){
  useStoreVersion();
  const {go}=useAdminNav();
  return <div className="cms-page">
    <PageHead eyebrow="SITIO" title="Línea de tiempo" desc="Hitos de la historia audiovisual. Se ordenan solos por año."><button type="button" className="cms-btn is-primary" onClick={()=>go('/admin/linea-de-tiempo/nuevo')}><Plus/> Nuevo hito</button></PageHead>
    <ol className="cms-timeline">{timelineEvents.map((e,i)=><li key={`${e.year}-${i}`}><button type="button" onClick={()=>go(`/admin/linea-de-tiempo/${i}`)}>
      <b>{e.year}</b><i/><img src={e.image} alt=""/><span><small>{e.type}</small><strong>{e.title}</strong><em>{e.text}</em></span><Pencil/>
    </button></li>)}</ol>
  </div>;
}

export const TimelineEditor=keyed(function TimelineEditor(){
  useStoreVersion();
  const item=useItemDraft(timelineEvents,()=>({year:String(new Date().getFullYear()),title:'',text:'',type:'Hito',image:''}));
  const {draft:e,set}=item, {go}=useAdminNav();
  const actions=useItemActions({base:'/admin/linea-de-tiempo',item,label:'Hito',stayAfterSave:false,
    save:{validate:()=>!e.title.trim()?'Escribe un título para el hito.':!/\d{4}/.test(e.year)?'Indica un año de cuatro cifras.':!e.image?'Añade una imagen.':null,run:()=>saveTimelineEvent(item.i,e)},
    remove:()=>removeListItem('timelineEvents',item.i),removeText:'Dejará de mostrarse en la línea de tiempo.'});
  if(!item.isNew&&!item.existing)return <NotFound back="/admin/linea-de-tiempo"/>;
  const types=[...new Set(['Hito','Exhibición','Película','Memoria','Preservación','Acceso',...timelineEvents.map(x=>x.type)])];
  return <EditorShell crumb={`Línea de tiempo · ${item.isNew?'Nuevo hito':e.year}`} title={e.title} isNew={item.isNew} dirty={item.dirty}
    onBack={()=>go('/admin/linea-de-tiempo')} viewHref="/linea-de-tiempo" {...actions}
    panel={<PanelBlock title="Categoría"><Choice value={e.type} options={types} onChange={type=>set({type})} allowNew newLabel="Nueva categoría"/></PanelBlock>}>
    <div className="pv-timeline">
      <div className="pv-timeline-entry"><b><Editable value={e.year} onChange={year=>set({year})} placeholder="1970" label="Año"/></b><i/><span><small>{e.type}</small><strong>{e.title||'Título del hito'}</strong></span></div>
      <div className="pv-timeline-detail">
        <EditableImage className="pv-timeline-img" src={e.image} onChange={image=>set({image})} aspect={16/9}/>
        <div>
          <span>{e.type} · {e.year}</span>
          <Editable as="h2" wrap value={e.title} onChange={title=>set({title})} placeholder="Título del hito" label="Título"/>
          <Editable as="p" multiline value={e.text} onChange={text=>set({text})} placeholder="Qué ocurrió y por qué importa…" label="Texto"/>
          <span className="pv-link">Explorar registros <ArrowRight/></span>
        </div>
      </div>
    </div>
  </EditorShell>;
});

/* ================= Comunas ================= */

export function LocationList(){
  useStoreVersion();
  const {go}=useAdminNav();
  return <div className="cms-page">
    <PageHead eyebrow="SITIO" title="Comunas y mapa" desc="Lugares del mapa territorial. Las fichas se vinculan a ellos desde «Territorios»."><button type="button" className="cms-btn is-primary" onClick={()=>go('/admin/comunas/nuevo')}><Plus/> Nueva comuna</button></PageHead>
    <div className="cms-locations">{locations.map((l,i)=><button type="button" key={l.id} onClick={()=>go(`/admin/comunas/${i}`)}>
      <MapPin/><strong>{l.name}</strong><b>{countByLocation(l.name)}</b><p>{l.text}</p><small>{l.lat.toFixed(3)}, {l.lon.toFixed(3)}</small>
    </button>)}</div>
  </div>;
}

export const LocationEditor=keyed(function LocationEditor(){
  useStoreVersion();
  const item=useItemDraft(locations,()=>({id:Math.max(0,...locations.map(l=>l.id))+1,name:'',lat:-30.6011,lon:-71.199,text:''}));
  const {draft:l,set}=item, {go}=useAdminNav();
  const count=item.existing?countByLocation(item.existing.name):0;
  const lat=Number(l.lat), lon=Number(l.lon), valid=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
  const actions=useItemActions({base:'/admin/comunas',item,label:'Comuna',
    save:{validate:()=>!l.name.trim()?'Escribe el nombre de la comuna.':!valid?'Revisa la latitud y longitud.':locations.some((x,j)=>j!==item.i&&x.name===l.name.trim())?'Ya existe una comuna con ese nombre.':null,
      run:()=>saveLocation(item.i,{...l,name:l.name.trim(),lat,lon})},
    remove:()=>removeListItem('locations',item.i),removeText:count?`Hay ${count} registros vinculados a este lugar. Seguirán mostrándolo en su ficha, pero ya no aparecerá en el mapa.`:'Dejará de aparecer en el mapa.'});
  if(!item.isNew&&!item.existing)return <NotFound back="/admin/comunas"/>;
  const d=.18, bbox=valid?`${lon-d},${lat-d},${lon+d},${lat+d}`:'';
  return <EditorShell crumb={`Comunas · ${item.isNew?'Nueva':l.name}`} title={l.name} isNew={item.isNew} dirty={item.dirty}
    onBack={()=>go('/admin/comunas')} viewHref="/mapa" {...actions}
    hint="Haz clic en el nombre, el texto o las coordenadas para cambiarlos. El mapa se actualiza al instante."
    panel={<>
      <PanelBlock title="Coordenadas">
        <div className="cms-coords"><label><small>Latitud</small><Editable type="number" value={String(l.lat)} onChange={v=>set({lat:v})} label="Latitud"/></label><label><small>Longitud</small><Editable type="number" value={String(l.lon)} onChange={v=>set({lon:v})} label="Longitud"/></label></div>
        <p className="cms-help">¿No las sabes? Búscalas en OpenStreetMap: clic derecho sobre el lugar → «Mostrar dirección».</p>
        <a className="cms-btn is-block" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${l.name||'Ovalle'}, Chile`)}`} target="_blank" rel="noreferrer"><ExternalLink/> Abrir OpenStreetMap</a>
      </PanelBlock>
      {item.existing&&item.existing.name!==l.name&&<PanelBlock title="Cambio de nombre"><p className="cms-help">Al guardar, las {count} fichas vinculadas se actualizarán con el nuevo nombre.</p></PanelBlock>}
    </>}>
    <div className="pv-map">
      <div className="pv-map-frame">{valid?<iframe title="Mapa" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lon}`} loading="lazy"/>:<p className="cms-empty">Coordenadas no válidas</p>}</div>
      <aside>
        <span>LOCALIDAD SELECCIONADA</span>
        <Editable as="h2" wrap value={l.name} onChange={name=>set({name})} placeholder="Nombre de la comuna" label="Nombre"/>
        <strong>{count}</strong><small>REGISTROS VINCULADOS</small>
        <Editable as="p" multiline value={l.text} onChange={text=>set({text})} placeholder="Qué relación tiene este lugar con el archivo…" label="Descripción"/>
      </aside>
    </div>
  </EditorShell>;
});
