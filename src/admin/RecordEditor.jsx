import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, Circle, FileText, Film, Headphones, ImagePlus, Images, MapPin, Mic2, Plus, Star, Type, UserRound, X } from 'lucide-react';
import { RecordCard, RecordRow } from '../components';
import { collections, locations, records, site } from '../data';
import { getFilmography } from '../repository';
import { deleteRecord, nextId, saveRecord, setData, useStoreVersion } from '../store';
import { EditorShell, PanelBlock, useAdminNav } from './AdminApp';
import { Choice, ColorSwatches, Editable, EditableImage, ImagePicker, MEDIA_TYPES, MediaPicker, RecordPicker, useUi } from './fields';
import { TYPE_META, TYPES, code, extraOf, missingFields, typeBySlug, typeColor } from './meta';

const TYPE_ICONS={Película:Film,Persona:UserRound,Prensa:FileText,Entrevista:Mic2,Artículo:BookOpen};

function blankDraft(type){
  const meta=TYPE_META[type];
  return {
    record:{id:nextId(),type,slug:meta.slug,title:'',subtitle:'',year:String(new Date().getFullYear()),format:'',collection:'',color:typeColor(type),image:'',description:''},
    extra:{credits:meta.credits.map(k=>[k,'']),relations:[],locations:['Ovalle'],mediaType:meta.media,media:'',gallery:[]}
  };
}

// La clave reinicia el borrador al pasar de una ficha a otra
export function RecordEditor(){
  const {slug,id}=useParams();
  return <RecordEditorInner key={`${slug}/${id}`}/>;
}

function RecordEditorInner(){
  useStoreVersion();
  const {slug,id}=useParams(), navigate=useNavigate(), {go,setDirty:setNavDirty}=useAdminNav(), {toast,confirm}=useUi();
  const isNew=id==='nuevo', existing=isNew?null:records.find(r=>r.id===Number(id));
  const load=()=>existing?{record:{...existing},extra:structuredClone(extraOf(existing.id))}:blankDraft(typeBySlug(slug)||'Película');
  const [draft,setDraft]=useState(load), [dirty,setDirty]=useState(false), [mode,setMode]=useState('ficha');
  if(!isNew&&!existing)return <div className="cms-page"><p className="cms-empty">Esta ficha no existe o fue eliminada. <button type="button" className="cms-btn" onClick={()=>go(`/admin/registros/${slug}`)}>Volver al listado</button></p></div>;

  const {record:r,extra:e}=draft, meta=TYPE_META[r.type];
  const setR=patch=>{setDraft(d=>({...d,record:{...d.record,...patch}}));setDirty(true)};
  const setE=patch=>{setDraft(d=>({...d,extra:{...d.extra,...patch}}));setDirty(true)};
  const parts=meta.format.map((_,i)=>(r.format||'').split(' · ')[i]||'');
  const setPart=(i,v)=>{const next=[...parts];next[i]=v;setR({format:next.join(' · ')})};
  const changeType=type=>{
    const prev=TYPE_META[r.type], next=TYPE_META[type];
    setR({type,slug:next.slug,color:r.color===typeColor(r.type)?typeColor(type):r.color});
    if(e.mediaType===prev.media)setE({mediaType:next.media});
  };

  const save=async()=>{
    if(!r.title.trim())return toast('Escribe un título antes de guardar.','error');
    if(!r.image)return toast('Añade una imagen principal antes de guardar.','error');
    const record={...r,title:r.title.trim(),format:parts.map(p=>p.trim()).filter(Boolean).join(' · ')};
    const {location,...extra}={...e,credits:e.credits.filter(([k,v])=>k.trim()&&v.trim()),gallery:e.gallery.filter(Boolean)};// eslint-disable-line no-unused-vars
    try{await saveRecord(record,extra)}catch{return toast('No se pudo guardar. Revisa el espacio disponible del navegador.','error')}
    setDirty(false);setNavDirty(false);
    toast(isNew?`“${record.title}” ya está publicada en el sitio.`:'Cambios guardados y publicados.');
    if(isNew||record.slug!==slug)navigate(`/admin/registros/${record.slug}/${record.id}`,{replace:true});
    else setDraft({record:{...records.find(x=>x.id===record.id)},extra:structuredClone(extraOf(record.id))});
  };
  const remove=async()=>{
    if(!await confirm({title:`¿Eliminar “${r.title}”?`,text:'La ficha dejará de aparecer en el sitio y se quitará de los relacionados de otras fichas. Esta acción no se puede deshacer.',ok:'Eliminar ficha',danger:true}))return;
    await deleteRecord(r.id);setNavDirty(false);toast('Ficha eliminada.');navigate(`/admin/registros/${slug}`);
  };
  const discard=async()=>{
    if(await confirm({title:'¿Descartar los cambios?',text:'La ficha volverá a su última versión guardada.',ok:'Descartar'})){setDraft(load());setDirty(false)}
  };
  const toggleFeatured=async()=>{await setData({site:{...site,featuredId:r.id}});toast('Ahora es la pieza destacada de la portada.')};

  const miss=missingFields(r,e);
  const collectionOptions=[...new Set([...collections.map(c=>c.title),...records.map(x=>x.collection)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const panel=<>
    <PanelBlock title="Tipo de registro">
      <div className="cms-type-pick">{TYPES.map(t=>{const Icon=TYPE_ICONS[t];return <button key={t} type="button" className={r.type===t?'active':''} onClick={()=>changeType(t)}><Icon/>{t}</button>})}</div>
    </PanelBlock>
    <PanelBlock title="Colección"><Choice value={r.collection} options={collectionOptions} onChange={collection=>setR({collection})} placeholder="Elegir colección…" allowNew newLabel="Nueva colección"/></PanelBlock>
    <PanelBlock title="Color de etiqueta"><ColorSwatches value={r.color} onChange={color=>setR({color})}/></PanelBlock>
    <PanelBlock title="Estado de la ficha" aside={<b className={miss.length?'cms-count-warn':'cms-count-ok'}>{miss.length?`${miss.length} pendiente${miss.length>1?'s':''}`:'Completa'}</b>}>
      <ul className="cms-checklist">{['Imagen','Título',meta.subtitle,'Año','Descripción','Colección',...(['video','audio'].includes(e.mediaType)?['Archivo digital']:[])].map(k=><li key={k} className={miss.includes(k)?'':'done'}>{miss.includes(k)?<Circle/>:<Check/>}{k}{k==='Descripción'&&miss.includes(k)&&<small>mín. 40 caracteres</small>}</li>)}</ul>
    </PanelBlock>
    {!isNew&&<PanelBlock title="Portada">
      {site.featuredId===r.id?<p className="cms-featured is-on"><Star/> Es la pieza destacada de la portada</p>:<button type="button" className="cms-btn is-block" onClick={toggleFeatured}><Star/> Destacar en la portada</button>}
    </PanelBlock>}
  </>;

  return <EditorShell crumb={`${meta.label} · ${isNew?'Nueva ficha':code(r.id)}`} title={r.title} isNew={isNew} dirty={dirty}
    onBack={()=>go(`/admin/registros/${slug}`)} onSave={save} onDiscard={discard} onDelete={remove} viewHref={`/ficha/${r.id}`} panel={panel}>
    <div className="cms-segment is-small cms-mode">{[['ficha','Ficha completa'],['tarjeta','Tarjeta y lista']].map(([k,l])=><button key={k} type="button" className={mode===k?'active':''} onClick={()=>setMode(k)}>{l}</button>)}</div>
    {mode==='ficha'?<FichaPreview r={r} e={e} meta={meta} setR={setR} setE={setE} parts={parts} setPart={setPart}/>:<CardPreview r={r} setR={setR}/>}
  </EditorShell>;
}

/* ---------- Vista previa: ficha completa ---------- */

const Label=({n,children})=><div className="pv-label"><span>{n}</span>{children}</div>;

function FichaPreview({r,e,meta,setR,setE,parts,setPart}){
  const [picker,setPicker]=useState(null);
  const credits=e.credits||[];
  const setCredit=(i,j,v)=>setE({credits:credits.map((c,k)=>k===i?(j===0?[v,c[1]]:[c[0],v]):c)});
  const suggestions=meta.credits.filter(k=>!credits.some(([c])=>c===k));
  const related=(e.relations||[]).map(id=>records.find(x=>x.id===id)).filter(Boolean);
  const places=e.locations||[];
  const moveGallery=(i,d)=>{const g=[...e.gallery];[g[i],g[i+d]]=[g[i+d],g[i]];setE({gallery:g})};
  return <article className="pv-ficha">
    <EditableImage className="pv-hero" src={r.image} onChange={image=>setR({image})} alt={r.title} label="Cambiar imagen principal">
      <div className="pv-hero-shade"/>
      <div className="pv-hero-top"><span className="pv-tag" style={{background:r.color}}>{r.type}</span><span className="pv-code">FICHA {code(r.id)}</span></div>
      <div className="pv-hero-copy">
        <Editable as="h1" wrap value={r.title} onChange={title=>setR({title})} placeholder="Título de la ficha" label="Título"/>
        <div className="pv-byline">
          <span><small>{meta.subtitle}</small><Editable value={r.subtitle} onChange={subtitle=>setR({subtitle})} placeholder={`Escribe ${meta.subtitle.toLowerCase()}`} label={meta.subtitle}/></span>
          <span><small>{meta.year}</small><Editable value={r.year} onChange={year=>setR({year})} placeholder="1970" label={meta.year}/></span>
        </div>
      </div>
    </EditableImage>
    <div className="pv-body">
      <div className="pv-main">
        <Label n="01">Descripción</Label>
        <Editable as="p" multiline className="pv-desc" value={r.description} onChange={description=>setR({description})} placeholder="Escribe una descripción: de qué trata, por qué es importante, qué se ve o se escucha…" label="Descripción"/>
        <Label n="02">{meta.format.length>1?'Formato':'Resumen'}</Label>
        <div className="pv-facts">{meta.format.map((l,i)=><div key={l}><small>{l}</small><Editable value={parts[i]} onChange={v=>setPart(i,v)} placeholder={meta.formatHint[i]} label={l}/></div>)}</div>
        <Label n="03">Créditos y datos</Label>
        <div className="pv-credits">
          {credits.map(([k,v],i)=><div key={i} className="pv-credit">
            <Editable as="small" value={k} onChange={x=>setCredit(i,0,x)} placeholder="Rol o dato" label="Nombre del dato"/>
            <Editable as="strong" value={v} onChange={x=>setCredit(i,1,x)} placeholder="Completar…" label={k||'Valor'}/>
            <button type="button" className="pv-remove" onClick={()=>setE({credits:credits.filter((_,j)=>j!==i)})} aria-label="Quitar"><X/></button>
          </div>)}
          <button type="button" className="pv-add" onClick={()=>setE({credits:[...credits,['','']]})}><Plus/> Añadir dato</button>
        </div>
        {suggestions.length>0&&<div className="pv-suggest"><span>Sugeridos:</span>{suggestions.map(s=><button key={s} type="button" onClick={()=>setE({credits:[...credits,[s,'']]})}><Plus/>{s}</button>)}</div>}
        {r.type==='Persona'?<>
          <Label n="04">Filmografía</Label>
          <Filmography person={r}/>
        </>:<>
          <Label n="04">Archivo digital</Label>
          <MediaBlock r={r} e={e} onEdit={()=>setPicker('media')}/>
        </>}
        <Label n="05">Galería · {(e.gallery||[]).length}</Label>
        <div className="pv-gallery">
          {(e.gallery||[]).map((src,i)=><div key={i} className="pv-gallery-item">
            <button type="button" onClick={()=>setPicker({gallery:i})}><img src={src} alt={`Imagen ${i+1}`}/><span><ImagePlus/> Editar o cambiar</span></button>
            <div className="pv-gallery-tools">
              <button type="button" disabled={i===0} onClick={()=>moveGallery(i,-1)} aria-label="Mover a la izquierda"><ArrowLeft/></button>
              <button type="button" disabled={i===e.gallery.length-1} onClick={()=>moveGallery(i,1)} aria-label="Mover a la derecha"><ArrowRight/></button>
              <button type="button" onClick={()=>setE({gallery:e.gallery.filter((_,j)=>j!==i)})} aria-label="Quitar"><X/></button>
            </div>
          </div>)}
          <button type="button" className="pv-gallery-add" onClick={()=>setPicker({gallery:-1})}><Images/><span>Añadir imágenes</span><small>una o varias a la vez</small></button>
        </div>
      </div>
      <aside className="pv-aside">
        <div className="pv-aside-label">{r.type==='Película'?'Locaciones':'Territorios'}</div>
        <div className="pv-chips">
          {places.map(l=><span key={l} className="pv-chip"><MapPin/>{l}<button type="button" onClick={()=>setE({locations:places.filter(x=>x!==l)})} aria-label={`Quitar ${l}`}><X/></button></span>)}
          <Choice value="" placeholder="+ Añadir" options={locations.map(l=>l.name).filter(n=>!places.includes(n))} onChange={n=>setE({locations:[...places,n]})}/>
        </div>
        <div className="pv-aside-label">Relacionados · {related.length}</div>
        <div className="pv-related">
          {related.map(x=><div key={x.id}><img src={x.image} alt=""/><span><small>{x.type}</small><strong>{x.title}</strong></span><button type="button" onClick={()=>setE({relations:e.relations.filter(id=>id!==x.id)})} aria-label="Quitar"><X/></button></div>)}
          <button type="button" className="pv-add" onClick={()=>setPicker('relation')}><Plus/> Vincular registro</button>
        </div>
      </aside>
    </div>
    {picker==='media'&&<MediaPicker mediaType={e.mediaType} media={e.media} onChange={(mediaType,media)=>setE({mediaType,media})} onClose={()=>setPicker(null)}/>}
    {picker==='relation'&&<RecordPicker exclude={[r.id,...(e.relations||[])]} onPick={x=>setE({relations:[...(e.relations||[]),x.id]})} onClose={()=>setPicker(null)}/>}
    {picker?.gallery!==undefined&&<ImagePicker title={picker.gallery<0?'Añadir a la galería':'Imagen de la galería'} value={e.gallery[picker.gallery]} multiple={picker.gallery<0}
      onPickMany={srcs=>setE({gallery:[...e.gallery,...srcs]})}
      onPick={src=>setE({gallery:e.gallery.map((g,i)=>i===picker.gallery?src:g)})}
      onRemove={picker.gallery>=0?()=>setE({gallery:e.gallery.filter((_,i)=>i!==picker.gallery)}):undefined}
      onClose={()=>setPicker(null)}/>}
  </article>;
}

function MediaBlock({r,e,onEdit}){
  const cfg=MEDIA_TYPES.find(m=>m.value===e.mediaType)||MEDIA_TYPES[3], Icon=cfg.icon;
  const needsFile=['video','audio','document'].includes(e.mediaType);
  return <div className={`pv-media is-${e.mediaType}`}>
    {e.mediaType==='video'&&(e.media?<video src={e.media} poster={r.image} controls preload="none"/>:<div className="pv-media-empty"><Film/><span>Sin video asignado</span></div>)}
    {e.mediaType==='audio'&&<div className="pv-media-audio">{r.image&&<img src={r.image} alt=""/>}<div><Headphones/>{e.media?<audio src={e.media} controls preload="none"/>:<span>Sin audio asignado</span>}</div></div>}
    {e.mediaType==='document'&&<div className="pv-media-empty"><FileText/><span>{e.media?'Documento PDF cargado':'Sin PDF asignado · el botón de descarga no se mostrará activo'}</span></div>}
    {e.mediaType==='image'&&(r.image?<img src={r.image} alt=""/>:<div className="pv-media-empty"><ImagePlus/><span>Usa la imagen principal</span></div>)}
    {e.mediaType==='text'&&<div className="pv-media-empty"><Type/><span>Se muestra el texto de la descripción</span></div>}
    <button type="button" className="cms-image-btn" onClick={onEdit}><Icon/> {cfg.label}{needsFile?' · cambiar archivo':' · cambiar tipo'}</button>
  </div>;
}

function Filmography({person}){
  const list=person.title?getFilmography(person):[];
  return <div className="pv-filmo">
    <p className="cms-help">Se arma sola: aparecen las películas cuyo director o créditos coinciden con el nombre de esta persona, o que la tienen en “Relacionados”.</p>
    {list.length?<ol>{list.map(({film,roles})=><li key={film.id}><img src={film.image} alt=""/><span><small>{film.year}</small><strong>{film.title}</strong></span><em>{roles.join(' · ')}</em></li>)}</ol>:<p className="cms-empty">Aún no hay películas vinculadas.</p>}
  </div>;
}

/* ---------- Vista previa: tarjeta y fila, con los componentes reales del sitio ---------- */

function CardPreview({r,setR}){
  const item={...r,image:r.image||'data:image/gif;base64,R0lGODlhAQABAAAAACw=',title:r.title||'Sin título'};
  return <div className="pv-cards">
    <div className="pv-card-edit">
      <EditableImage src={r.image} onChange={image=>setR({image})} className="pv-card-img" aspect={1}/>
      <div className="pv-card-fields">
        <small>{r.year} · {r.collection||'Sin colección'}</small>
        <Editable as="h3" wrap value={r.title} onChange={title=>setR({title})} placeholder="Título" label="Título"/>
        <Editable as="p" value={r.subtitle} onChange={subtitle=>setR({subtitle})} placeholder="Autoría" label="Autoría"/>
      </div>
    </div>
    <div className="pv-real">
      <p className="cms-help">Así aparece en los listados del sitio <ArrowRight/></p>
      <div className="pv-real-card cms-real"><RecordCard item={item}/></div>
      <div className="pv-real-row cms-real"><RecordRow item={item}/></div>
    </div>
  </div>;
}
