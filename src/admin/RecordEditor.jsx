import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, Circle, Eye, EyeOff, FileText, Film, ImagePlus, Images, MapPin, Mic2, Plus, Star, UserRound, X } from 'lucide-react';
import { RecordCard, RecordRow } from '../components';
import { collections, locations, records, site } from '../data';
import { EditContext } from '../edit-context';
import { RecordDetail } from '../pages';
import { deleteRecord, nextId, saveError, saveRecord, setData, useStoreVersion } from '../store';
import { EditorShell, PanelBlock, useAdminNav } from './AdminApp';
import { Choice, ColorSwatches, Editable, EditableImage, ImagePicker, MEDIA_TYPES, MediaPicker, RecordPicker, thumb, useUi } from './fields';
import { SiteFrame } from './SiteFrame';
import { HomeEditContext } from '../site-text';
import { useSharedTexts } from './shared-text';
import { TYPE_META, TYPES, code, extraOf, missingFields, typeBySlug, typeColor } from './meta';

const TYPE_ICONS={Película:Film,Persona:UserRound,Prensa:FileText,Entrevista:Mic2,Artículo:BookOpen};

function blankDraft(type){
  const meta=TYPE_META[type];
  return {
    // Todo vacío: cada campo muestra en gris cómo completarlo
    record:{id:nextId(),type,slug:meta.slug,title:'',subtitle:'',year:'',format:'',collection:'',color:typeColor(type),image:'',description:''},
    extra:{credits:meta.credits.map(k=>[k,'']),relations:[],locations:[],mediaType:meta.media,media:'',gallery:[]}
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
  // Destacar en el inicio también espera a «Guardar», como todo lo demás
  const isFeatured=()=>!isNew&&site.featuredId===Number(id);
  const [featured,setFeatured]=useState(isFeatured);

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

  const wasPublished=!!existing&&!existing.draft;
  const save=async()=>{
    if(!r.title.trim())return toast('Escribe un título antes de guardar.','error');
    if(!r.image)return toast('Añade una imagen principal antes de guardar.','error');
    const {draft:isDraft,...rest}=r;
    const record={...rest,...(isDraft&&{draft:true}),title:r.title.trim(),format:parts.map(p=>p.trim()).filter(Boolean).join(' · ')};
    const {location,...extra}={...e,credits:e.credits.filter(([k,v])=>k.trim()&&v.trim()),gallery:e.gallery.filter(Boolean)};// eslint-disable-line no-unused-vars
    try{
      await saveRecord(record,extra);
      await shared.save();
      if(featured&&site.featuredId!==record.id)await setData({site:{...site,featuredId:record.id}});
    }catch(err){return toast(saveError(err),'error')}
    setDirty(false);setNavDirty(false);
    toast(record.draft?(isNew?'Borrador guardado. No se verá en el sitio hasta que lo publiques.':wasPublished?'Guardada como borrador: ya no se ve en el sitio.':'Cambios guardados. La ficha sigue como borrador.')
      :isNew?`“${record.title}” ya está publicada en el sitio.`:!wasPublished?'Ficha publicada: ya se ve en el sitio.':'Cambios guardados y publicados.');
    if(isNew||record.slug!==slug)navigate(`/admin/registros/${record.slug}/${record.id}`,{replace:true});
    else setDraft({record:{...records.find(x=>x.id===record.id)},extra:structuredClone(extraOf(record.id))});
  };
  const remove=async()=>{
    if(!await confirm({title:`¿Eliminar “${r.title}”?`,text:'La ficha dejará de aparecer en el sitio y se quitará de los relacionados de otras fichas. Esta acción no se puede deshacer.',ok:'Eliminar ficha',danger:true}))return;
    await deleteRecord(r.id);setNavDirty(false);toast('Ficha eliminada.');navigate(`/admin/registros/${slug}`);
  };
  const discard=async()=>{
    if(await confirm({title:'¿Descartar los cambios?',text:'La ficha volverá a su última versión guardada.',ok:'Descartar'})){setDraft(load());setFeatured(isFeatured());shared.reset();setDirty(false)}
  };
  // Publicar, despublicar y destacar se eligen aquí y se aplican al guardar, junto con el resto
  const published=!r.draft;
  const setPublished=next=>setR({draft:next?undefined:true});
  const pickFeatured=on=>{setFeatured(on);setDirty(true)};

  const miss=missingFields(r,e);
  const collectionOptions=[...new Set([...collections.map(c=>c.title),...records.map(x=>x.collection)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const edit=useRecordEdit({r,e,meta,parts,setR,setE,setPart});
  const shared=useSharedTexts(()=>setDirty(true));
  // Después de todos los hooks: si la ficha se elimina mientras está abierta, React no pierde la cuenta
  if(!isNew&&!existing)return <div className="cms-page"><p className="cms-empty">Esta ficha no existe o fue eliminada. <button type="button" className="cms-btn" onClick={()=>go(`/admin/registros/${slug}`)}>Volver al listado</button></p></div>;
  const REQUIRED=['Imagen','Título'];
  const checklist=['Imagen','Título',meta.subtitle,'Año','Descripción','Colección',...(['video','audio'].includes(e.mediaType)?['Archivo digital']:[])];
  // Panel en cuatro grupos, de lo que más se mira a lo que menos se cambia
  const panel=<>
    <PanelBlock title="Visibilidad en el sitio">
      <div className="cms-segment is-small cms-seg-block">
        <button type="button" className={published?'active':''} onClick={()=>setPublished(true)}><Eye/> Publicada</button>
        <button type="button" className={!published?'active':''} onClick={()=>setPublished(false)}><EyeOff/> Borrador</button>
      </div>
      <p className="cms-help">{isNew?(published?'Se verá en el sitio al guardar.':'Se guardará sin mostrarse en el sitio.')
        :published===wasPublished?(published?'Se ve en el sitio.':'No se ve en el sitio, solo aquí.')
        :published?'Se publicará al guardar.':'Dejará de verse en el sitio al guardar.'}</p>
    </PanelBlock>
    <PanelBlock title="Estado de la ficha" aside={<b className={miss.length?'cms-count-warn':'cms-count-ok'}>{miss.length?`${miss.length} pendiente${miss.length>1?'s':''}`:'Completa'}</b>}>
      <ul className="cms-checklist">{checklist.map(k=><li key={k} className={miss.includes(k)?'':'done'}>{miss.includes(k)?<Circle/>:<Check/>}{k}{REQUIRED.includes(k)&&miss.includes(k)&&<small>obligatorio para guardar</small>}{k==='Descripción'&&miss.includes(k)&&<small>mín. 40 caracteres</small>}</li>)}</ul>
    </PanelBlock>
    <PanelBlock title="Clasificación">
      <label className="cms-panel-label">Colección</label>
      <Choice value={r.collection} options={collectionOptions} onChange={collection=>setR({collection})} placeholder="Elegir colección…" allowNew newLabel="Nueva colección"/>
      <label className="cms-panel-label">Color de etiqueta</label>
      <ColorSwatches value={r.color} onChange={color=>setR({color})}/>
      <label className="cms-panel-label">Tipo de ficha</label>
      <div className="cms-type-pick">{TYPES.map(t=>{const Icon=TYPE_ICONS[t];return <button key={t} type="button" className={r.type===t?'active':''} onClick={()=>changeType(t)}><Icon/>{t}</button>})}</div>
    </PanelBlock>
    <RecordPanelBlocks r={r} e={e} meta={meta} setE={setE} openPicker={edit.open}/>
    <PanelBlock title="Portada del sitio">
      {!featured?<button type="button" className="cms-btn is-block" onClick={()=>pickFeatured(true)}><Star/> Destacar en el inicio</button>
        :isFeatured()?<p className="cms-featured is-on"><Star/> Es la pieza destacada del inicio</p>
        :<><p className="cms-featured is-on"><Star/> Será la pieza destacada al guardar</p><button type="button" className="cms-btn is-ghost is-block" onClick={()=>pickFeatured(false)}><X/> No destacar</button></>}
      {featured&&!published&&<p className="cms-help">Es un borrador: no aparecerá en el inicio hasta publicarla.</p>}
    </PanelBlock>
  </>;

  return <EditorShell crumb={`${meta.label} · ${isNew?'Nueva ficha':code(r.id)}`} title={r.title} isNew={isNew} dirty={dirty}
    onBack={()=>go(`/admin/registros/${slug}`)} onSave={save} onDiscard={discard} onDelete={remove} deleteLabel="Eliminar esta ficha" viewHref={wasPublished?`/ficha/${r.id}`:undefined}
    saveLabel={isNew&&!published?'Guardar borrador':undefined} note={!isNew&&!wasPublished?'Borrador · no se ve en el sitio':undefined}
    panel={panel}
    hint="Es la ficha real del sitio: clic en cualquier texto para reescribirlo. Las listas (créditos, galería, relacionados y territorios) se manejan en el panel de la derecha.">
    <div className="cms-frame-tools">
      <div className="cms-segment is-small cms-mode">{[['ficha','Ficha completa'],['tarjeta','Tarjeta y lista']].map(([k,l])=><button key={k} type="button" className={mode===k?'active':''} onClick={()=>setMode(k)}>{l}</button>)}</div>
    </div>
    {mode==='ficha'?<HomeEditContext.Provider value={shared.context}><EditContext.Provider value={edit.context}>
      <SiteFrame className="is-record" path={`/${r.slug}`}>
        <RecordDetail item={{...r,image:r.image||BLANK}} extra={e}/>
      </SiteFrame>
    </EditContext.Provider></HomeEditContext.Provider>:<CardPreview r={r} setR={setR}/>}
    {edit.modals}
  </EditorShell>;
}

const BLANK='data:image/gif;base64,R0lGODlhAQABAAAAACw=';

// «el título», «la dirección», «los roles», «las obras vinculadas»: según la primera palabra
function withArticle(label){
  const text=label.toLowerCase(), w=text.split(' ')[0];
  const art=w.endsWith('as')?'las':w.endsWith('s')?'los':/(a|ión|dad)$/.test(w)?'la':'el';
  return `${art} ${text}`;
}

/* ---------- Vista previa: la ficha pública real, editable ---------- */

// Conecta los campos de la ficha pública (ver edit-context) con el borrador del gestor
function useRecordEdit({r,e,meta,parts,setR,setE,setPart}){
  const [picker,setPicker]=useState(null);
  const credits=e.credits||[], gallery=e.gallery||[], places=e.locations||[];
  const setCredit=(i,j,v)=>setE({credits:credits.map((c,k)=>k===i?(j===0?[v,c[1]]:[c[0],v]):c)});
  // Clave del campo en la página pública → valor, cómo cambiarlo, cómo se llama y un ejemplo
  const field=key=>{
    const [name,i]=key.split('.'), n=Number(i);
    if(name==='format')return [parts[n]??'',v=>setPart(n,v),meta.format[n]||'Formato',meta.formatHint?.[n]];
    if(name==='credits')return [credits[n]?.[1]??'',v=>setCredit(n,1,v),credits[n]?.[0]||'Dato'];
    if(name==='creditKey')return [credits[n]?.[0]??'',v=>setCredit(n,0,v),'Nombre del dato'];
    const labels={title:r.type==='Persona'?'Nombre':'Título',subtitle:meta.subtitle,year:meta.year,description:'Descripción'};
    return [r[name]??'',v=>setR({[name]:v}),labels[name]||name,name==='year'?(r.type==='Persona'?'1931—2010':'1972'):undefined];
  };
  const cfg=MEDIA_TYPES.find(m=>m.value===e.mediaType)||MEDIA_TYPES[3], MediaIcon=cfg.icon;
  const needsFile=['video','audio','document'].includes(e.mediaType);
  const slotBtn=(key,onClick,Icon,label)=><button key={key} type="button" className={`cms-slot-btn is-${key}`} onClick={ev=>{ev.preventDefault();ev.stopPropagation();onClick()}}><Icon/> {label}</button>;
  const slots={
    image:()=>slotBtn('image',()=>setPicker('image'),ImagePlus,r.image?'Cambiar imagen principal':'Añadir imagen principal'),
    media:()=>slotBtn('media',()=>setPicker('media'),MediaIcon,`${cfg.label} · ${needsFile?(e.media?'cambiar archivo':'subir archivo'):'cambiar tipo'}`)
  };
  const context={
    text:(key,{multiline=false}={})=>{
      // La indicación siempre dice qué escribir (la página solo aporta la clave del campo)
      const [value,onChange,label,example]=field(key);
      return <Editable key={key} value={value} onChange={onChange} multiline={multiline} wrap={key==='title'} placeholder={`Escribe ${withArticle(label)}${example?` (ej. ${example})`:''}`} label={label}/>;
    },
    slot:name=>slots[name]?.()
  };
  const modals=<>
    {picker==='image'&&<ImagePicker value={r.image} onPick={image=>setR({image})} onClose={()=>setPicker(null)} title="Imagen principal"/>}
    {picker==='media'&&<MediaPicker mediaType={e.mediaType} media={e.media} onChange={(mediaType,media)=>setE({mediaType,media})} onClose={()=>setPicker(null)}/>}
    {picker==='relation'&&<RecordPicker exclude={[r.id,...(e.relations||[])]} onPick={x=>setE({relations:[...(e.relations||[]),x.id]})} onClose={()=>setPicker(null)}/>}
    {picker?.gallery!==undefined&&<ImagePicker title={picker.gallery<0?'Añadir a la galería':'Imagen de la galería'} value={gallery[picker.gallery]} multiple={picker.gallery<0}
      onPickMany={srcs=>setE({gallery:[...gallery,...srcs]})}
      onPick={src=>setE({gallery:gallery.map((g,i)=>i===picker.gallery?src:g)})}
      onRemove={picker.gallery>=0?()=>setE({gallery:gallery.filter((_,i)=>i!==picker.gallery)}):undefined}
      onClose={()=>setPicker(null)}/>}
  </>;
  return {context,modals,open:setPicker};
}

// Contenido y conexiones de la ficha: aquí se agregan, ordenan y quitan todas sus listas
function RecordPanelBlocks({r,e,meta,setE,openPicker}){
  const credits=e.credits||[], gallery=e.gallery||[], places=e.locations||[];
  const related=(e.relations||[]).map(id=>records.find(x=>x.id===id)).filter(Boolean);
  const suggestions=meta.credits.filter(k=>!credits.some(([c])=>c===k));
  const moveGallery=(i,d)=>{const g=[...gallery];[g[i],g[i+d]]=[g[i+d],g[i]];setE({gallery:g})};
  const free=locations.map(l=>l.name).filter(n=>!places.includes(n));
  const media=MEDIA_TYPES.find(m=>m.value===e.mediaType)||MEDIA_TYPES[3], MediaIcon=media.icon;
  const needsFile=['video','audio','document'].includes(e.mediaType);
  return <>
    <PanelBlock title="Contenido">
      <label className="cms-panel-label">Créditos y datos</label>
      {credits.length>0&&<ul className="cms-mini-list">{credits.map(([k,v],i)=><li key={i}>
        <span>{v||<em>Sin completar</em>}<small>{k||'Sin nombre'}</small></span>
        <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({credits:credits.filter((_,j)=>j!==i)})} aria-label={`Quitar ${k||'dato'}`}><X/></button>
      </li>)}</ul>}
      <div className="cms-suggest">
        {suggestions.map(k=><button key={k} type="button" onClick={()=>setE({credits:[...credits,[k,'']]})}><Plus/>{k}</button>)}
        <button type="button" onClick={()=>setE({credits:[...credits,['','']]})}><Plus/>Otro dato</button>
      </div>
      <p className="cms-help">El nombre y el valor de cada dato se escriben con clic en la vista previa.</p>
      <label className="cms-panel-label">Archivo digital</label>
      <button type="button" className="cms-btn is-block" onClick={()=>openPicker('media')}><MediaIcon/> {media.label}{needsFile?(e.media?' · cambiar archivo':' · subir archivo'):' · cambiar tipo'}</button>
      <label className="cms-panel-label">Galería · {gallery.length}</label>
      {gallery.length>0&&<div className="cms-gallery-mini">{gallery.map((src,i)=><div key={i}>
        <button type="button" className="cms-gallery-thumb" onClick={()=>openPicker({gallery:i})} title="Editar o cambiar"><img src={thumb(src,160)} alt={`Imagen ${i+1}`}/></button>
        <span>
          <button type="button" disabled={i===0} onClick={()=>moveGallery(i,-1)} aria-label="Mover antes"><ArrowLeft/></button>
          <button type="button" disabled={i===gallery.length-1} onClick={()=>moveGallery(i,1)} aria-label="Mover después"><ArrowRight/></button>
          <button type="button" onClick={()=>setE({gallery:gallery.filter((_,j)=>j!==i)})} aria-label="Quitar"><X/></button>
        </span>
      </div>)}</div>}
      <button type="button" className="cms-btn is-block" onClick={()=>openPicker({gallery:-1})}><Images/> Añadir imágenes</button>
      {r.type==='Persona'&&<><label className="cms-panel-label">Filmografía</label><p className="cms-help">Se arma sola: aparecen las películas cuyo director o créditos coinciden con el nombre de esta persona, o que están en «Relacionados».</p></>}
    </PanelBlock>
    <PanelBlock title="Conexiones">
      <label className="cms-panel-label">Relacionados · {related.length}</label>
      {related.length>0&&<ul className="cms-mini-list">{related.map(x=><li key={x.id}>
        <img src={thumb(x.image,120)} alt=""/><span>{x.title}<small>{x.type}</small></span>
        <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({relations:e.relations.filter(id=>id!==x.id)})} aria-label={`Quitar ${x.title}`}><X/></button>
      </li>)}</ul>}
      <button type="button" className="cms-btn is-block" onClick={()=>openPicker('relation')}><Plus/> Vincular otra ficha</button>
      <label className="cms-panel-label">{r.type==='Película'?'Locaciones':'Territorios'} · {places.length}</label>
      {places.length>0&&<div className="pv-chips">{places.map(l=><span key={l} className="pv-chip"><MapPin/>{l}<button type="button" onClick={()=>setE({locations:places.filter(x=>x!==l)})} aria-label={`Quitar ${l}`}><X/></button></span>)}</div>}
      {free.length>0&&<Choice value="" placeholder="+ Añadir comuna" options={free} onChange={n=>setE({locations:[...places,n]})}/>}
    </PanelBlock>
  </>;
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
