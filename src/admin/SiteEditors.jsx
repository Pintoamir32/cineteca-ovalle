import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, MapPin, Pencil, Plus } from 'lucide-react';
import { collections, locations, records, timelineEvents } from '../data';
import { EditContext } from '../edit-context';
import { CollectionsPage, TimelinePage } from '../pages';
import { countByCollection, countByLocation } from '../repository';
import { removeListItem, saveCollection, saveLocation, saveTimelineEvent, useStoreVersion } from '../store';
import { tagStyle } from '../color';
import { EditorShell, PageHead, PanelBlock, useAdminNav } from './AdminApp';
import { Choice, ColorSwatches, Editable, ImagePicker, palette, useUi } from './fields';
import { SiteFrame } from './SiteFrame';
import { LocationPicker } from './LocationPicker';

const pad=n=>String(n).padStart(2,'0');
const slugify=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

// Borrador de un elemento de lista (índice numérico o "nuevo")
// startDirty: un elemento nuevo que ya viene completado queda listo para publicar
function useItemDraft(list,blank,startDirty=false){
  const {index}=useParams(), isNew=index==='nuevo', i=isNew?-1:Number(index), existing=list[i];
  const [draft,setDraft]=useState(()=>existing?{...existing}:blank());
  const [dirty,setDirty]=useState(isNew&&startDirty);
  const set=patch=>{setDraft(d=>({...d,...patch}));setDirty(true)};
  return {isNew,i,existing,draft,set,dirty,setDirty,reset:()=>{setDraft({...existing});setDirty(false)}};
}

// Guardar / eliminar / descartar comunes a todos los editores de lista
// male: concuerda los avisos ("Hito creado" / "Colección creada")
function useItemActions({base,item,label,save,remove,removeText,stayAfterSave=true,male=false}){
  const o=male?'o':'a';
  const navigate=useNavigate(), {setDirty}=useAdminNav(), {toast,confirm}=useUi();
  return {
    onSave:async()=>{
      const err=save.validate?.();
      if(err)return toast(err,'error');
      let result;
      try{result=await save.run()}catch{return toast('No se pudo guardar. Revisa el espacio disponible del navegador.','error')}
      item.setDirty(false);setDirty(false);
      toast(item.isNew?`${label} cread${o} y publicad${o}.`:'Cambios guardados y publicados.');
      if(save.next)navigate(save.next(result),{replace:true});
      else if(item.isNew||!stayAfterSave)navigate(base);
    },
    onDelete:async()=>{
      if(!await confirm({title:`¿Eliminar ${label.toLowerCase()}?`,text:removeText,ok:'Eliminar',danger:true}))return;
      await remove();setDirty(false);toast(`${label} eliminad${o}.`);navigate(base);
    },
    onDiscard:async()=>{if(await confirm({title:'¿Descartar los cambios?',ok:'Descartar'}))item.reset()},
    deleteLabel:`Eliminar ${label.toLowerCase()}`
  };
}

const keyed=Component=>function Keyed(){const {index}=useParams();return <Component key={index}/>};
const NotFound=({back})=>{const {go}=useAdminNav();return <div className="cms-page"><p className="cms-empty">Este elemento no existe. <button type="button" className="cms-btn" onClick={()=>go(back)}>Volver</button></p></div>};

// Páginas de listas (colecciones, línea de tiempo): textos del elemento en edición y botón de imagen
function useListEdit({draft,set,fields,items,index,count,imageLabel,aspect,pick}){
  const [picking,setPicking]=useState(false);
  const context={
    items,index,count,pick,
    text:(key,{multiline=false,placeholder}={})=><Editable key={key} value={draft[key]} onChange={v=>set({[key]:v})} multiline={multiline} wrap={!multiline}
      placeholder={placeholder||fields[key]} label={fields[key]||key}/>,
    slot:name=>name==='image'?<button key="image" type="button" className="cms-slot-btn is-image" onClick={e=>{e.preventDefault();e.stopPropagation();setPicking(true)}}><ImagePlus/> {draft.image?imageLabel:'Añadir imagen'}</button>:null
  };
  const modals=picking&&<ImagePicker value={draft.image} aspect={aspect} onPick={image=>set({image})} onClose={()=>setPicking(false)} title={imageLabel}/>;
  return {context,modals};
}
const yearOf=e=>Number((/\d{4}/.exec(e.year)||[])[0])||0;
// La lista con el borrador en su lugar (o al final si es nuevo)
const withDraft=(list,item)=>item.isNew?[...list,item.draft]:list.map((x,j)=>j===item.i?item.draft:x);

/* ================= Colecciones ================= */

export function CollectionList(){
  useStoreVersion();
  const {go}=useAdminNav();
  return <div className="cms-page">
    <PageHead eyebrow="SITIO" title="Colecciones" desc="Recorridos temáticos. Cada ficha pertenece a una colección."><button type="button" className="cms-btn is-primary" onClick={()=>go('/admin/colecciones/nuevo')}><Plus/> Nueva colección</button></PageHead>
    <div className="cms-collections">{collections.map((c,i)=><button type="button" key={c.slug||i} className="cms-collection" onClick={()=>go(`/admin/colecciones/${i}`)}>
      <img src={c.image} alt=""/><div className="cms-collection-shade"/>
      <span>{pad(i+1)} · {c.years}</span><h3>{c.title}</h3><b style={tagStyle(c.color)}>{countByCollection(c.title)} fichas</b>
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
  const members=item.existing?records.filter(r=>r.collection===item.existing.title):[];
  const edit=useListEdit({draft:c,set,items:withDraft(collections,item),index:item.isNew?collections.length:item.i,count,pick:i=>i<collections.length&&go(`/admin/colecciones/${i}`),
    fields:{years:'Período',title:'Nombre de la colección',description:'De qué trata este recorrido…'},imageLabel:'Cambiar portada',aspect:3/4});
  if(!item.isNew&&!item.existing)return <NotFound back="/admin/colecciones"/>;
  return <EditorShell crumb={`Colecciones · ${item.isNew?'Nueva':pad(item.i+1)}`} title={c.title} isNew={item.isNew} dirty={item.dirty}
    onBack={()=>go('/admin/colecciones')} viewHref="/colecciones" {...actions}
    hint="Es la página real de colecciones: la colección en edición está marcada; clic en sus textos para reescribirlos."
    panel={<>
      <PanelBlock title="Color"><ColorSwatches value={c.color} onChange={color=>set({color})}/></PanelBlock>
      {item.existing&&item.existing.title!==c.title&&<PanelBlock title="Cambio de nombre"><p className="cms-help">Al guardar, las {count} fichas de esta colección se actualizarán con el nuevo nombre.</p></PanelBlock>}
      <PanelBlock title={`Fichas de la colección · ${members.length}`}>
        {members.length?<ul className="cms-mini-list">{members.slice(0,12).map(r=><li key={r.id}><button type="button" onClick={()=>go(`/admin/registros/${r.slug}/${r.id}`)}><img src={r.image} alt=""/><span>{r.title}<small>{r.type}</small></span></button></li>)}</ul>:<p className="cms-help">Asigna fichas a esta colección desde el editor de cada ficha.</p>}
        {members.length>12&&<p className="cms-help">y {members.length-12} más…</p>}
      </PanelBlock>
    </>}>
    <EditContext.Provider value={edit.context}>
      <SiteFrame className="is-list" path="/colecciones"><CollectionsPage/></SiteFrame>
    </EditContext.Provider>
    {edit.modals}
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
  const actions=useItemActions({base:'/admin/linea-de-tiempo',item,label:'Hito',male:true,
    save:{validate:()=>!e.title.trim()?'Escribe un título para el hito.':!/\d{4}/.test(e.year)?'Indica un año de cuatro cifras.':null,run:()=>saveTimelineEvent(item.i,e),next:i=>`/admin/linea-de-tiempo/${i}`},
    remove:()=>removeListItem('timelineEvents',item.i),removeText:'Dejará de mostrarse en la línea de tiempo.'});
  const types=[...new Set(['Hito','Exhibición','Película','Memoria','Preservación','Acceso',...timelineEvents.map(x=>x.type)])];
  // La vista previa muestra el hito en su lugar según el año, igual que al guardar
  const self=item.isNew?timelineEvents.length:item.i;
  const ordered=withDraft(timelineEvents,item).map((ev,i)=>({ev,i})).sort((a,b)=>yearOf(a.ev)-yearOf(b.ev));
  const edit=useListEdit({draft:e,set,items:ordered.map(x=>x.ev),index:ordered.findIndex(x=>x.i===self),pick:k=>ordered[k].i!==self&&go(`/admin/linea-de-tiempo/${ordered[k].i}`),
    fields:{year:'Año',title:'Título del hito',text:'Qué ocurrió y por qué importa…'},imageLabel:'Cambiar imagen',aspect:16/9});
  if(!item.isNew&&!item.existing)return <NotFound back="/admin/linea-de-tiempo"/>;
  return <EditorShell crumb={`Línea de tiempo · ${item.isNew?'Nuevo hito':e.year}`} title={e.title} isNew={item.isNew} dirty={item.dirty}
    onBack={()=>go('/admin/linea-de-tiempo')} viewHref="/linea-de-tiempo" {...actions}
    hint="Es la página real de la línea de tiempo con este hito seleccionado: clic en sus textos para reescribirlos. Al guardar se ordena por año."
    panel={<PanelBlock title="Categoría"><Choice value={e.type} options={types} onChange={type=>set({type})} allowNew newLabel="Nueva categoría"/></PanelBlock>}>
    <EditContext.Provider value={edit.context}>
      <SiteFrame className="is-list" path="/linea-de-tiempo"><TimelinePage/></SiteFrame>
    </EditContext.Provider>
    {edit.modals}
  </EditorShell>;
});

/* ================= Comunas ================= */

export function LocationList(){
  useStoreVersion();
  const {go}=useAdminNav();
  return <div className="cms-page">
    <PageHead eyebrow="SITIO" title="Comunas y mapa" desc="Lugares del mapa territorial. Las fichas se vinculan a ellos desde «Territorios»."><button type="button" className="cms-btn is-primary" onClick={()=>go('/admin/comunas/nuevo')}><Plus/> Nueva comuna</button></PageHead>
    <div className="cms-locations">{locations.map((l,i)=><button type="button" key={l.id} onClick={()=>go(`/admin/comunas/${i}`)}>
      <MapPin/><strong>{l.name}</strong><b>{countByLocation(l.name)}</b><small>{l.lat.toFixed(3)}, {l.lon.toFixed(3)}</small>
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
  return <EditorShell crumb={`Comunas · ${item.isNew?'Nueva':l.name}`} title={l.name} isNew={item.isNew} dirty={item.dirty}
    onBack={()=>go('/admin/comunas')} viewHref="/mapa" {...actions}
    hint="Busca el lugar o haz clic en el mapa para ubicarlo. Haz clic en el nombre para cambiarlo."
    panel={<>
      <PanelBlock title="Coordenadas">
        <div className="cms-coords"><label><small>Latitud</small><Editable type="number" value={String(l.lat)} onChange={v=>set({lat:v})} label="Latitud"/></label><label><small>Longitud</small><Editable type="number" value={String(l.lon)} onChange={v=>set({lon:v})} label="Longitud"/></label></div>
        <p className="cms-help">Se completan solas al buscar el lugar o marcarlo en el mapa. También puedes escribirlas.</p>
      </PanelBlock>
      {item.existing&&item.existing.name!==l.name&&<PanelBlock title="Cambio de nombre"><p className="cms-help">Al guardar, las {count} fichas vinculadas se actualizarán con el nuevo nombre.</p></PanelBlock>}
    </>}>
    <div className="pv-map">
      {/* Al elegir un resultado de búsqueda, una comuna nueva toma también su nombre */}
      <LocationPicker lat={lat} lon={lon} valid={valid} name={l.name}
        onPick={(pos,place)=>set({...pos,...(place&&!l.name.trim()&&{name:place.name})})}/>
      <aside>
        <span>LOCALIDAD SELECCIONADA</span>
        <Editable as="h2" wrap value={l.name} onChange={name=>set({name})} placeholder="Nombre de la comuna" label="Nombre"/>
        <strong>{count}</strong><small>REGISTROS VINCULADOS</small>
      </aside>
    </div>
  </EditorShell>;
});
