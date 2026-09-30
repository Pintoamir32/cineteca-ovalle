import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Eye, ImagePlus, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { collections, locations, records, timelineEvents } from '../data';
import { countByCollection, countByLocation } from '../repository';
import { removeListItem, saveCollection, saveError, saveLocation, saveTimelineEvent, useStoreVersion } from '../store';
import { tagStyle } from '../color';
import { EditorShell, PageHead, PanelBlock, useAdminNav } from './AdminApp';
import { Choice, ColorSwatches, Editable, ImagePicker, Modal, palette, useAskRemove, useUi } from './fields';
import { LocationPicker } from './LocationPicker';
import { SiteFrame } from './SiteFrame';
import { EditContext } from '../edit-context';
import { TimelinePage } from '../pages';
import { Paged } from '../components';

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

// Guardar / eliminar / descartar comunes a los editores de página completa (comunas)
// male: concuerda los avisos ("Hito creado" / "Colección creada")
function useItemActions({base,item,label,save,remove,removeText,stayAfterSave=true,male=false}){
  const o=male?'o':'a';
  const navigate=useNavigate(), {setDirty}=useAdminNav(), {toast,confirm}=useUi();
  return {
    onSave:async()=>{
      const err=save.validate?.();
      if(err)return toast(err,'error');
      let result;
      try{result=await save.run()}catch(err){return toast(saveError(err),'error')}
      item.setDirty(false);setDirty(false);
      toast(item.isNew?`${label} cread${o} y publicad${o}.`:'Cambios guardados y publicados.');
      if(save.next)navigate(save.next(result),{replace:true});
      else if(item.isNew||!stayAfterSave)navigate(base);
    },
    onDelete:async()=>{
      if(!await confirm({title:`¿Eliminar ${label.toLowerCase()}?`,text:removeText,ok:'Eliminar',danger:true}))return;
      try{await remove()}catch(err){return toast(saveError(err),'error')}
      setDirty(false);toast(`${label} eliminad${o}.`);navigate(base);
    },
    onDiscard:async()=>{if(await confirm({title:'¿Descartar los cambios?',ok:'Descartar'}))item.reset()},
    deleteLabel:`Eliminar ${label.toLowerCase()}`
  };
}

const keyed=Component=>function Keyed(){const {index}=useParams();return <Component key={index}/>};
const NotFound=({back})=>{const {go}=useAdminNav();return <div className="cms-page"><p className="cms-empty">Este elemento no existe. <button type="button" className="cms-btn" onClick={()=>go(back)}>Volver</button></p></div>};
const yearOf=e=>Number((/\d{4}/.exec(e.year)||[])[0])||0;

/* ---------- Formularios en ventana (colecciones y línea de tiempo) ---------- */

// Ventana con los campos del elemento; se abre sobre su lista según la dirección (…/nuevo, …/3)
// busy: mientras hay otra ventana encima (imagen, confirmación), Esc y el fondo no la cierran
function ItemModal({item,title,base,label,male=false,validate,save,remove,removeText,extra,children}){
  const o=male?'o':'a';
  const navigate=useNavigate(), {setDirty}=useAdminNav(), {toast,confirm}=useUi();
  const busy=useRef(false), [saving,setSaving]=useState(false);
  useEffect(()=>{setDirty(item.dirty)},[item.dirty,setDirty]);
  useEffect(()=>()=>setDirty(false),[setDirty]);
  const ask=async opts=>{busy.current=true;try{return await confirm(opts)}finally{setTimeout(()=>{busy.current=false})}};
  const close=async()=>{
    if(busy.current)return;
    if(item.dirty&&!await ask({title:'¿Cerrar sin guardar?',text:'Los cambios de esta ventana se perderán.',ok:'Cerrar sin guardar',danger:true}))return;
    setDirty(false);navigate(base);
  };
  const onSave=async e=>{
    e.preventDefault();
    const err=validate();
    if(err)return toast(err,'error');
    setSaving(true);
    try{await save()}catch(err){setSaving(false);return toast(saveError(err),'error')}
    setDirty(false);toast(item.isNew?`${label} cread${o} y publicad${o}.`:'Cambios guardados y publicados.');navigate(base);
  };
  const onDelete=async()=>{
    if(!await ask({title:`¿Eliminar ${label.toLowerCase()}?`,text:removeText,ok:'Eliminar',danger:true}))return;
    try{await remove()}catch(err){return toast(saveError(err),'error')}
    setDirty(false);toast(`${label} eliminad${o}.`);navigate(base);
  };
  return <Modal onClose={close} title={title} className="cms-item-modal">
    <form onSubmit={onSave} className="cms-item-form">
      {children({busy})}
      <div className="cms-modal-actions">
        <div className="cms-item-left">{!item.isNew&&<button type="button" className="cms-btn is-danger-outline" onClick={onDelete}><Trash2/> Eliminar</button>}{extra?.({busy})}</div>
        <button type="button" className="cms-btn" onClick={close}>Cancelar</button>
        <button type="submit" className="cms-btn is-primary" disabled={saving||(!item.dirty&&!item.isNew)}>{item.isNew?<><Plus/> Crear</>:'Guardar'}</button>
      </div>
    </form>
  </Modal>;
}

const Field=({label,hint,children})=><label className="cms-field cms-item-field"><span>{label}</span>{children}{hint}</label>;

// Imagen del elemento: miniatura con cambiar / quitar; el selector se abre encima de la ventana
function ImageField({label,value,onChange,aspect,optional=false,busy}){
  const [picking,setPicking]=useState(false), confirmAsk=useAskRemove();
  // Mientras la confirmación está abierta, Esc no cierra la ventana del hito
  const ask=(what,fn,text)=>async()=>{busy.current=true;try{await confirmAsk(what,fn,text)()}finally{setTimeout(()=>{busy.current=false})}};
  const open=v=>{busy.current=v;setPicking(v)};
  return <div className="cms-field cms-item-field"><span>{label}</span>
    <div className="cms-item-image">
      {value?<img src={value} alt="" style={{aspectRatio:aspect}}/>:<div className="cms-item-noimg" style={{aspectRatio:aspect}}><ImagePlus/></div>}
      <div>
        <button type="button" className="cms-btn" onClick={()=>open(true)}><ImagePlus/> {value?'Cambiar imagen':'Añadir imagen'}</button>
        {value&&optional&&<button type="button" className="cms-btn is-ghost" onClick={ask('la imagen',()=>onChange(''),'Se aplica al guardar el hito.')}><X/> Quitar</button>}
        {!value&&optional&&<p className="cms-help">Opcional: sin imagen se muestra un fondo liso.</p>}
      </div>
    </div>
    {picking&&<ImagePicker value={value} aspect={aspect} onPick={onChange} onRemove={value&&optional?()=>onChange(''):undefined} onClose={()=>open(false)} title={label}/>}
  </div>;
}

/* ================= Colecciones ================= */

export function CollectionList(){
  useStoreVersion();
  const {go}=useAdminNav(), {index}=useParams();
  return <div className="cms-page">
    <PageHead eyebrow="ORGANIZAR EL ARCHIVO" title="Colecciones" desc="Recorridos temáticos. Cada ficha pertenece a una colección.">
      <button type="button" className="cms-btn is-primary" onClick={()=>go('/admin/colecciones/nuevo')}><Plus/> Nueva colección</button>
    </PageHead>
    <Paged items={collections.map((c,i)=>({c,i}))} perPage={24}>{page=><div className="cms-collections">{page.map(({c,i})=><button type="button" key={c.slug||i} className="cms-collection" onClick={()=>go(`/admin/colecciones/${i}`)}>
      <img src={c.image} alt=""/><div className="cms-collection-shade"/>
      <span>{pad(i+1)}</span><h3>{c.title}</h3><b style={tagStyle(c.color)}>{countByCollection(c.title)} fichas</b>
    </button>)}</div>}</Paged>
    {index!==undefined&&<CollectionModal key={index}/>}
  </div>;
}

function CollectionModal(){
  const item=useItemDraft(collections,()=>({slug:'',title:'',description:'',image:'',color:palette()[collections.length%palette().length]}));
  const {draft:c,set}=item, {go}=useAdminNav();
  const count=item.existing?countByCollection(item.existing.title):0;
  const members=item.existing?records.filter(r=>r.collection===item.existing.title):[];
  if(!item.isNew&&!item.existing)return <Modal onClose={()=>go('/admin/colecciones')} title="Colección no encontrada"><p className="cms-help">Esta colección ya no existe.</p></Modal>;
  return <ItemModal item={item} base="/admin/colecciones" label="Colección" title={item.isNew?'Nueva colección':'Editar colección'}
    validate={()=>!c.title.trim()?'Escribe un nombre para la colección.':!c.image?'Añade una imagen de portada.':collections.some((x,j)=>j!==item.i&&x.title===c.title.trim())?'Ya existe una colección con ese nombre.':null}
    save={()=>saveCollection(item.i,{...c,title:c.title.trim(),slug:slugify(c.title)})}
    remove={()=>removeListItem('collections',item.i)}
    removeText={count?`Tiene ${count} registros. Las fichas conservarán el nombre de la colección, pero esta dejará de aparecer en la página de colecciones.`:'Dejará de aparecer en la página de colecciones.'}>
    {({busy})=><>
      <Field label="Nombre" hint={item.existing&&item.existing.title!==c.title&&count>0&&<small className="cms-help">Al guardar, las {count} fichas de esta colección se actualizarán con el nuevo nombre.</small>}>
        <input value={c.title} onChange={e=>set({title:e.target.value})} placeholder="Ej. Cine club de Ovalle" autoFocus={item.isNew}/></Field>
      <Field label="Descripción"><textarea rows={4} value={c.description} onChange={e=>set({description:e.target.value})} placeholder="De qué trata este recorrido"/></Field>
      <ImageField label="Portada" value={c.image} onChange={image=>set({image})} aspect={3/4} busy={busy}/>
      <div className="cms-field cms-item-field"><span>Color de la etiqueta</span><ColorSwatches value={c.color} onChange={color=>set({color})}/></div>
      {item.existing&&<div className="cms-field cms-item-field"><span>Fichas de la colección · {members.length}</span>
        {members.length?<p className="cms-help is-text">{members.slice(0,8).map(r=>r.title).join(' · ')}{members.length>8&&` y ${members.length-8} más`}</p>
          :<p className="cms-help">Asigna fichas a esta colección desde el editor de cada ficha.</p>}</div>}
    </>}
  </ItemModal>;
}

/* ================= Línea de tiempo ================= */

const decadeOf=e=>{const y=yearOf(e);return y?`${Math.floor(y/10)*10}s`:'Sin año'};

export function TimelineList(){
  useStoreVersion();
  const {go}=useAdminNav(), {index}=useParams(), [preview,setPreview]=useState(false);
  // De a 20 por página, agrupados por década; el índice real se conserva para abrir el editor
  const groupsOf=items=>{const groups=[];items.forEach(({e,i})=>{const d=decadeOf(e), last=groups[groups.length-1];last&&last.decade===d?last.items.push({e,i}):groups.push({decade:d,items:[{e,i}]})});return groups};
  const add=year=>go(`/admin/linea-de-tiempo/nuevo${year?`?anio=${year}`:''}`);
  return <div className="cms-page">
    <PageHead eyebrow="ORGANIZAR EL ARCHIVO" title="Línea de tiempo" desc={`${timelineEvents.length} hitos de la historia audiovisual. Se ordenan solos por año.`}>
      <button type="button" className="cms-btn" onClick={()=>setPreview(true)} disabled={!timelineEvents.length}><Eye/> Vista previa</button>
      <button type="button" className="cms-btn is-primary" onClick={()=>add()}><Plus/> Nuevo hito</button>
    </PageHead>
    {timelineEvents.length?<Paged items={timelineEvents.map((e,i)=>({e,i}))} perPage={20}>{page=>groupsOf(page).map(g=><section key={g.decade} className="cms-timeline-group">
      <header><h2>{g.decade==='Sin año'?g.decade:`Década de ${g.decade.slice(0,-1)}`}</h2><small>{g.items.length} {g.items.length===1?'hito':'hitos'}</small>
        {g.decade!=='Sin año'&&<button type="button" className="cms-btn is-ghost is-small" onClick={()=>add(g.decade.slice(0,-1))}><Plus/> Agregar aquí</button>}</header>
      <ol className="cms-timeline">{g.items.map(({e,i})=><li key={`${e.year}-${i}`}><button type="button" onClick={()=>go(`/admin/linea-de-tiempo/${i}`)}>
        <b>{e.year}</b><i/>{e.image?<img src={e.image} alt=""/>:<span className="cms-timeline-noimg"><ImagePlus/></span>}<span><small>{e.type}</small><strong>{e.title||'Sin título'}</strong><em>{e.text||'Sin descripción'}</em></span><Pencil/>
      </button></li>)}</ol>
    </section>)}</Paged>:<p className="cms-empty">Todavía no hay hitos. <button type="button" className="cms-btn is-primary" onClick={()=>add()}><Plus/> Crear el primero</button></p>}
    {index!==undefined&&<TimelineModal key={index}/>}
    {preview&&<TimelinePreview items={timelineEvents} onClose={()=>setPreview(false)}/>}
  </div>;
}

function TimelineModal(){
  const [params]=useSearchParams();
  const item=useItemDraft(timelineEvents,()=>({year:params.get('anio')||'',title:'',text:'',type:'Hito',image:''}));
  const {draft:e,set}=item, {go}=useAdminNav();
  const year=String(e.year||'').trim();
  const yearError=!year?'Escribe el año del hito.':!/^\d{4}(\s*[-–—]\s*\d{4})?$/.test(year)?'Usa un año de cuatro cifras (1972) o un período (1968—1973).':null;
  const types=[...new Set(['Hito','Exhibición','Película','Memoria','Preservación','Acceso',...timelineEvents.map(x=>x.type)])];
  // Dónde quedará según el año, igual que al guardar
  const self=item.isNew?timelineEvents.length:item.i;
  const ordered=(item.isNew?[...timelineEvents,e]:timelineEvents.map((x,j)=>j===item.i?e:x)).map((ev,i)=>({ev,i})).sort((a,b)=>yearOf(a.ev)-yearOf(b.ev));
  const pos=ordered.findIndex(x=>x.i===self), before=ordered[pos-1], after=ordered[pos+1];
  const sameYear=timelineEvents.filter((x,j)=>j!==item.i&&yearOf(x)===yearOf(e)&&yearOf(e));
  const neighbor=x=>x&&<span><b>{x.ev.year}</b> {x.ev.title}</span>;
  if(!item.isNew&&!item.existing)return <Modal onClose={()=>go('/admin/linea-de-tiempo')} title="Hito no encontrado"><p className="cms-help">Este hito ya no existe.</p></Modal>;
  return <ItemModal item={item} base="/admin/linea-de-tiempo" label="Hito" male title={item.isNew?'Nuevo hito':'Editar hito'}
    validate={()=>!e.title.trim()?'Escribe un título para el hito.':yearError}
    save={()=>saveTimelineEvent(item.i,{...e,year,title:e.title.trim(),text:(e.text||'').trim()})}
    remove={()=>removeListItem('timelineEvents',item.i)} removeText="Dejará de mostrarse en la línea de tiempo."
    extra={({busy})=><PreviewButton busy={busy} items={ordered.map(x=>x.ev)} index={pos}/>}>
    {({busy})=><>
      <div className="cms-item-row">
        <Field label="Año" hint={year&&yearError?<small className="cms-help is-error">{yearError}</small>:null}>
          <input value={e.year} onChange={ev=>set({year:ev.target.value})} inputMode="numeric" placeholder="Ej. 1972" aria-invalid={!!(year&&yearError)} autoFocus={item.isNew&&!e.year}/></Field>
        <div className="cms-field cms-item-field"><span>Categoría</span><Choice value={e.type} options={types} onChange={type=>set({type})} allowNew newLabel="Nueva categoría"/></div>
      </div>
      {!yearError&&<p className="cms-help is-text">{before&&after?<>Quedará entre {neighbor(before)} y {neighbor(after)}.</>:before?<>Quedará al final, después de {neighbor(before)}.</>:after?<>Quedará al comienzo, antes de {neighbor(after)}.</>:'Es el único hito.'}
        {sameYear.length>0&&<> También en {yearOf(e)}: {sameYear.map(x=>x.title).join(', ')}.</>}</p>}
      <Field label="Título"><input value={e.title} onChange={ev=>set({title:ev.target.value})} placeholder="Título del hito" autoFocus={item.isNew&&!!e.year}/></Field>
      <Field label="Texto"><textarea rows={4} value={e.text} onChange={ev=>set({text:ev.target.value})} placeholder="Qué ocurrió y por qué importa"/></Field>
      <ImageField label="Imagen" value={e.image} onChange={image=>set({image})} aspect={16/9} optional busy={busy}/>
    </>}
  </ItemModal>;
}

// Vista previa de la línea de tiempo tal como se verá en el sitio (incluye el hito sin guardar)
function TimelinePreview({items,index=0,onClose}){
  const [current,setCurrent]=useState(index);
  const context={items,index:current,pick:setCurrent,text:key=>items[current]?.[key]};
  return <Modal onClose={onClose} title="Vista previa · Línea de tiempo" className="cms-preview-modal">
    <p className="cms-help">Así se verá en el sitio. Haz clic en otro hito para verlo; aquí no se edita nada.</p>
    <EditContext.Provider value={context}><SiteFrame className="is-list" path="/linea-de-tiempo"><TimelinePage/></SiteFrame></EditContext.Provider>
  </Modal>;
}

function PreviewButton({busy,items,index}){
  const [open,setOpen]=useState(false);
  const toggle=v=>{busy.current=v;setOpen(v)};
  return <><button type="button" className="cms-btn is-ghost" onClick={()=>toggle(true)}><Eye/> Vista previa</button>
    {open&&<TimelinePreview items={items} index={index} onClose={()=>toggle(false)}/>}</>;
}

/* ================= Comunas ================= */

export function LocationList(){
  useStoreVersion();
  const {go}=useAdminNav();
  return <div className="cms-page">
    <PageHead eyebrow="ORGANIZAR EL ARCHIVO" title="Comunas y mapa" desc="Lugares del mapa territorial. Las fichas se vinculan a ellos desde «Territorios»."><button type="button" className="cms-btn is-primary" onClick={()=>go('/admin/comunas/nuevo')}><Plus/> Nueva comuna</button></PageHead>
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
      run:async()=>{const at=item.isNew?locations.length:item.i;await saveLocation(item.i,{...l,name:l.name.trim(),lat,lon});return at},
      next:at=>`/admin/comunas/${at}`},
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
        <Editable as="h2" wrap value={l.name} onChange={name=>set({name})} placeholder="Escribe el nombre de la comuna" label="Nombre"/>
        <strong>{count}</strong><small>REGISTROS VINCULADOS</small>
      </aside>
    </div>
  </EditorShell>;
});
