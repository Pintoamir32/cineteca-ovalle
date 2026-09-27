import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Circle, Eye, EyeOff, FileText, ImagePlus, Images, MapPin, Plus, Star, Trash2, X } from 'lucide-react';
import { RecordCard, RecordRow } from '../components';
import { collections, locations, records, site } from '../data';
import { EditContext } from '../edit-context';
import { RecordDetail } from '../pages';
import { getFilmography, getInterviewee, INTERVIEW_FORMATS, interviewFormat } from '../repository';
import { deleteRecord, nextId, saveError, saveRecord, setData, useStoreVersion } from '../store';
import { EditorShell, PanelBlock, useAdminNav } from './AdminApp';
import { aspectNear, Choice, ColorSwatches, Editable, EditableChoice, EditableImage, ImagePicker, MEDIA_TYPES, MediaPicker, RecordPicker, thumb, useUi } from './fields';
import { SiteFrame } from './SiteFrame';
import { HomeEditContext } from '../site-text';
import { useSharedTexts } from './shared-text';
import { TYPE_META, code, extraOf, missingFields, typeBySlug, typeColor } from './meta';


function blankDraft(type){
  const meta=TYPE_META[type];
  return {
    // Todo vacío: cada campo muestra en gris cómo completarlo
    record:{id:nextId(),type,slug:meta.slug,title:'',subtitle:'',year:'',format:'',collection:'',color:typeColor(type),image:'',description:''},
    extra:{credits:[],relations:[],locations:[],mediaType:meta.media,media:'',gallery:[]}
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
  const load=()=>asInterview(existing?{record:{...existing},extra:structuredClone(extraOf(existing.id))}:blankDraft(typeBySlug(slug)||'Película'));
  const [draft,setDraft]=useState(load), [dirty,setDirty]=useState(false), [mode,setMode]=useState('ficha');
  // Destacar en el inicio también espera a «Guardar», como todo lo demás
  const isFeatured=()=>!isNew&&site.featuredId===Number(id);
  const [featured,setFeatured]=useState(isFeatured);

  const {record:r,extra:e}=draft, meta=TYPE_META[r.type], isPerson=r.type==='Persona', isPress=r.type==='Prensa', isInterview=r.type==='Entrevista';
  const setR=patch=>{setDraft(d=>({...d,record:{...d.record,...patch}}));setDirty(true)};
  const setE=patch=>{setDraft(d=>({...d,extra:{...d.extra,...patch}}));setDirty(true)};
  const parts=meta.format.map((_,i)=>(r.format||'').split(' · ')[i]||'');
  const setPart=(i,v)=>{const next=[...parts];next[i]=v;setR({format:next.join(' · ')})};

  const wasPublished=!!existing&&!existing.draft;
  const save=async()=>{
    // Entrevista: la persona se vincula a su ficha o se escribe a mano; de ella sale el título y, si no se
    // sube una imagen, la fotografía (solo cuando está vinculada)
    const person=isInterview?records.find(x=>x.id===e.interviewee&&x.type==='Persona'):null;
    const name=person?.title||r.subtitle.trim();
    if(isInterview&&!name)return toast('Elige o escribe a la persona entrevistada antes de guardar.','error');
    const base=isInterview?{...r,subtitle:name,title:`Entrevista a ${name}`,image:r.image||person?.image||''}:r;
    if(!base.title.trim())return toast('Escribe un título antes de guardar.','error');
    if(!base.image)return toast('Añade una imagen principal antes de guardar.','error');
    const {draft:isDraft,...rest}=base;
    let record={...rest,...(isDraft&&{draft:true}),title:base.title.trim(),format:parts.map(p=>p.trim()).filter(Boolean).join(' · ')};
    let {location,...extra}={...e,credits:e.credits.filter(([k,v])=>k.trim()&&v.trim()),gallery:e.gallery.filter(Boolean)};// eslint-disable-line no-unused-vars,prefer-const
    // Persona: solo nombre, biografía, rol(es), fotografía y obras (películas vinculadas); lo demás no se guarda
    if(isPerson){
      record={...record,year:'',format:'',collection:''};
      extra={...extra,credits:[],gallery:[],locations:[],media:'',mediaType:'image',relations:(extra.relations||[]).filter(id=>records.some(x=>x.id===id&&x.type==='Película')),
        works:(extra.works||[]).map(w=>({title:String(w.title||'').trim(),year:String(w.year||'').trim()})).filter(w=>w.title)};
    }
    // Prensa: título/fuente, fecha, medio, documento digitalizado (imagen y PDF opcional), galería y vínculos a películas y personas
    if(isPress){
      record={...record,format:'',collection:'',description:''};
      extra={...extra,credits:[],locations:[],mediaType:'document',relations:(extra.relations||[]).filter(id=>records.some(x=>x.id===id&&['Película','Persona'].includes(x.type)))};
    }
    // Entrevista: entrevistado(a), fecha, formato, texto (opcional), archivo adjunto (audio o video), imagen y galería
    if(isInterview){
      record={...record,format:interviewFormat(extra),collection:''};
      extra={...extra,credits:[],locations:[],relations:[],media:extra.mediaType==='text'?'':extra.media,interviewee:person?.id||null};
    }
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
  // Solo colecciones ya creadas en la sección Colecciones
  const collectionOptions=collections.map(c=>c.title).filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'));
  const edit=useRecordEdit({r,e,meta,parts,setR,setE,setPart});
  const shared=useSharedTexts(()=>setDirty(true));
  // Después de todos los hooks: si la ficha se elimina mientras está abierta, React no pierde la cuenta
  if(!isNew&&!existing)return <div className="cms-page"><p className="cms-empty">Esta ficha no existe o fue eliminada. <button type="button" className="cms-btn" onClick={()=>go(`/admin/registros/${slug}`)}>Volver al listado</button></p></div>;
  const REQUIRED=['Imagen','Título','Entrevistado(a)'];
  const checklist=meta.only||['Imagen','Título',meta.subtitle,'Año','Descripción','Colección',...(['video','audio'].includes(e.mediaType)?['Archivo digital']:[])];
  // Cómo se llama cada punto de la lista en una ficha de persona
  const checkName=k=>isPerson?({Imagen:'Fotografía',Título:'Nombre',Descripción:'Biografía'}[k]||k)
    :isPress?({Imagen:'Documento digitalizado',Título:'Título / fuente',Año:'Fecha'}[k]||k)
    :isInterview?({Año:'Fecha',Contenido:e.mediaType==='text'?'Contenido':'Archivo adjunto'}[k]||k):r.type==='Película'&&k==='Descripción'?'Sinopsis':k;
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
      <ul className="cms-checklist">{checklist.map(k=><li key={k} className={miss.includes(k)?'':'done'}>{miss.includes(k)?<Circle/>:<Check/>}{checkName(k)}{REQUIRED.includes(k)&&miss.includes(k)&&<small>obligatorio para guardar</small>}{k==='Descripción'&&miss.includes(k)&&<small>mín. 40 caracteres</small>}</li>)}</ul>
    </PanelBlock>
    {isPerson?<PersonWorks r={r} e={e} setE={setE} openPicker={edit.open}/>:isPress?<PressPanel r={r} e={e} setR={setR} setE={setE} openPicker={edit.open}/>
      :isInterview?<InterviewPanel r={r} e={e} setR={setR} setE={setE} openPicker={edit.open}/>:<>
    <PanelBlock title="Clasificación">
      <label className="cms-panel-label">Colección</label>
      {collectionOptions.length?<Choice value={r.collection} options={collectionOptions} onChange={collection=>setR({collection})} placeholder="Elegir colección…"/>
        :<p className="cms-help">Aún no hay colecciones. Créalas en la sección Colecciones.</p>}
      <label className="cms-panel-label">Color de etiqueta</label>
      <ColorSwatches value={r.color} onChange={color=>setR({color})}/>
    </PanelBlock>
    <RecordPanelBlocks r={r} e={e} meta={meta} setE={setE} openPicker={edit.open}/>
    </>}
    {!isPerson&&!isInterview&&<PanelBlock title="Portada del sitio">
      {!featured?<button type="button" className="cms-btn is-block" onClick={()=>pickFeatured(true)}><Star/> Destacar en el inicio</button>
        :isFeatured()?<p className="cms-featured is-on"><Star/> Es la pieza destacada del inicio</p>
        :<><p className="cms-featured is-on"><Star/> Será la pieza destacada al guardar</p><button type="button" className="cms-btn is-ghost is-block" onClick={()=>pickFeatured(false)}><X/> No destacar</button></>}
      {featured&&!published&&<p className="cms-help">Es un borrador: no aparecerá en el inicio hasta publicarla.</p>}
    </PanelBlock>}
  </>;

  return <EditorShell crumb={`${meta.label} · ${isNew?'Nueva ficha':code(r.id)}`} title={r.title} isNew={isNew} dirty={dirty}
    onBack={()=>go(`/admin/registros/${slug}`)} onSave={save} onDiscard={discard} onDelete={remove} deleteLabel="Eliminar esta ficha" viewHref={wasPublished?`/ficha/${r.id}`:undefined}
    saveLabel={isNew&&!published?'Guardar borrador':undefined} note={!isNew&&!wasPublished?'Borrador · no se ve en el sitio':undefined}
    panel={panel}
    hint="Es la ficha real del sitio: clic en cualquier texto para reescribirlo. Las listas (cargos, galería, relacionados y territorios) se manejan en el panel de la derecha.">
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

// Entrevista: toma de la persona entrevistada el nombre, el título y la imagen (también en las antiguas,
// que solo tenían el nombre escrito); el formato es texto, audio o video
function asInterview(d){
  if(d.record.type!=='Entrevista')return d;
  const extra={...d.extra,mediaType:INTERVIEW_FORMATS.some(([v])=>v===d.extra.mediaType)?d.extra.mediaType:'video'};
  const p=getInterviewee(d.record,extra,records);
  return p?{record:{...d.record,subtitle:p.title,title:`Entrevista a ${p.title}`,image:d.record.image||p.image},extra:{...extra,interviewee:p.id}}:{...d,extra};
}

// «el título», «la dirección», «los roles», «las obras vinculadas»: según la primera palabra
function withArticle(label){
  const text=label.toLowerCase(), w=text.split(' ')[0];
  const art=/(sis|a|ión|dad)$/.test(w)?'la':w.endsWith('as')?'las':w.endsWith('s')?'los':'el';
  return `${art} ${text}`;
}

/* ---------- Vista previa: la ficha pública real, editable ---------- */

// Conecta los campos de la ficha pública (ver edit-context) con el borrador del gestor
function useRecordEdit({r,e,meta,parts,setR,setE,setPart}){
  const [picker,setPicker]=useState(null), [pickAspect,setPickAspect]=useState(null);
  const credits=e.credits||[], gallery=e.gallery||[], places=e.locations||[];
  const setCredit=(i,j,v)=>setE({credits:credits.map((c,k)=>k===i?(j===0?[v,c[1]]:[c[0],v]):c)});
  // Clave del campo en la página pública → valor, cómo cambiarlo, cómo se llama y un ejemplo
  const field=key=>{
    const [name,i]=key.split('.'), n=Number(i);
    if(name==='format')return [parts[n]??'',v=>setPart(n,v),meta.format[n]||'Formato',meta.formatHint?.[n]];
    // Cargos: el nombre del cargo y quién lo ocupó (el 5.º valor es la indicación completa)
    if(name==='credits')return [credits[n]?.[1]??'',v=>setCredit(n,1,v),credits[n]?.[0]||'Nombre',undefined,'Escribe el nombre (ej. María Cortés)'];
    if(name==='creditKey')return [credits[n]?.[0]??'',v=>setCredit(n,0,v),'Cargo',undefined,'Escribe el cargo (ej. Fotografía)'];
    const labels={title:{Persona:'Nombre',Prensa:'Título / fuente'}[r.type]||'Título',subtitle:meta.subtitle,year:meta.year,description:{Persona:'Biografía',Película:'Sinopsis',Entrevista:'Contenido'}[r.type]||'Descripción',collection:'Colección'};
    return [r[name]??'',v=>setR({[name]:v}),labels[name]||name,name==='year'?({Persona:'1931—2010',Prensa:'14 de marzo de 1971'}[r.type]||'1972'):undefined];
  };
  const cfg=MEDIA_TYPES.find(m=>m.value===e.mediaType)||MEDIA_TYPES[3], MediaIcon=cfg.icon;
  const needsFile=['video','audio','document'].includes(e.mediaType);
  const slotBtn=(key,onClick,Icon,label)=><button key={key} type="button" className={`cms-slot-btn is-${key}`} onClick={ev=>{ev.preventDefault();ev.stopPropagation();onClick(ev)}}><Icon/> {label}</button>;
  const slots={
    // El recorte parte con la forma del lugar donde está la imagen (póster, portada…)
    image:()=>slotBtn('image',ev=>{setPickAspect(aspectNear(ev.currentTarget));setPicker('image')},ImagePlus,r.image?'Cambiar imagen principal':'Añadir imagen principal'),
    // Galería: añadir varias imágenes a la vez, también desde la vista previa
    gallery:()=>slotBtn('gallery',()=>setPicker({gallery:-1}),Images,'Añadir imágenes a la galería'),
    media:()=>needsFile&&slotBtn('media',()=>setPicker('media'),MediaIcon,`${cfg.label} · ${e.mediaType==='video'?(r.type==='Entrevista'?(e.media?'cambiar video':'agregar video'):e.media?'cambiar película':'agregar enlace de la película'):needsFile?(e.media?'cambiar archivo':'subir archivo'):'cambiar tipo'}`)
  };
  // Campos que se eligen de una lista con buscador (y aceptan un valor nuevo): la dirección y la
  // persona entrevistada salen de las personas del archivo; formato y colección, de lo ya usado
  const sameType=records.filter(x=>x.type===r.type&&x.id!==r.id);
  const choices=key=>{
    const [name,i]=key.split('.');
    if(name==='subtitle'&&['Película','Entrevista'].includes(r.type))return [...records.filter(x=>x.type==='Persona').map(x=>x.title),...sameType.map(x=>x.subtitle)];
    if(name==='subtitle'&&r.type==='Prensa')return sameType.map(x=>x.subtitle);
    if(name==='format')return sameType.map(x=>(x.format||'').split(' · ')[Number(i)]);
    if(name==='collection')return [...collections.map(c=>c.title),...records.map(x=>x.collection)];
    return null;
  };
  const context={
    text:(key,{multiline=false}={})=>{
      // La indicación siempre dice qué escribir (la página solo aporta la clave del campo)
      const [value,onChange,label,example,hint]=field(key), options=choices(key);
      if(hint)return <Editable key={key} value={value} onChange={onChange} placeholder={hint} label={label}/>;
      if(options)return <EditableChoice key={key} value={value} onChange={onChange} options={options} label={label} placeholder={`Elige ${withArticle(label)}${example?` (ej. ${example})`:''}`}/>;
      return <Editable key={key} value={value} onChange={onChange} multiline={multiline} wrap={key==='title'} placeholder={`Escribe ${withArticle(label)}${example?` (ej. ${example})`:''}`} label={label}/>;
    },
    slot:name=>slots[name]?.()
  };
  const modals=<>
    {picker==='image'&&<ImagePicker value={r.image} aspect={pickAspect} onPick={image=>setR({image})} onRemove={r.image?()=>setR({image:''}):undefined} onClose={()=>setPicker(null)} title="Imagen principal"/>}
    {picker==='media'&&<MediaPicker mediaType={e.mediaType} media={e.media} onChange={(mediaType,media)=>setE({mediaType,media})} onClose={()=>setPicker(null)}/>}
    {picker==='work'&&<RecordPicker title="Vincular una película" types={['Película']} exclude={e.relations||[]} onPick={x=>setE({relations:[...(e.relations||[]),x.id]})} onClose={()=>setPicker(null)}/>}
    {picker==='interviewee'&&<RecordPicker title="Elegir persona entrevistada" types={['Persona']} action="Elegir" exclude={e.interviewee?[e.interviewee]:[]}
      onPick={x=>{setE({interviewee:x.id});setR({subtitle:x.title,title:`Entrevista a ${x.title}`,...(!r.image&&{image:x.image})})}} onClose={()=>setPicker(null)}/>}
    {picker==='link'&&<RecordPicker title="Vincular película o persona" types={['Película','Persona']} exclude={[r.id,...(e.relations||[])]} onPick={x=>setE({relations:[...(e.relations||[]),x.id]})} onClose={()=>setPicker(null)}/>}
    {picker==='relation'&&<RecordPicker exclude={[r.id,...(e.relations||[])]} onPick={x=>setE({relations:[...(e.relations||[]),x.id]})} onClose={()=>setPicker(null)}/>}
    {picker?.gallery!==undefined&&<ImagePicker title={picker.gallery<0?'Añadir a la galería':'Imagen de la galería'} value={gallery[picker.gallery]} multiple={picker.gallery<0}
      onPickMany={srcs=>setE({gallery:[...gallery,...srcs]})}
      onPick={src=>setE({gallery:gallery.map((g,i)=>i===picker.gallery?src:g)})}
      onRemove={picker.gallery>=0?()=>setE({gallery:gallery.filter((_,i)=>i!==picker.gallery)}):undefined}
      onClose={()=>setPicker(null)}/>}
  </>;
  return {context,modals,open:setPicker};
}

// Filmografía de una persona: las películas donde figura en dirección o en un cargo con su nombre
// aparecen solas; otras se vinculan a mano (y solo esas se pueden quitar aquí)
function PersonWorks({r,e,setE,openPicker}){
  const works=getFilmography(r,e), written=e.works||[];
  const setWork=(i,patch)=>setE({works:written.map((w,j)=>j===i?{...w,...patch}:w)});
  // Al escribir una nueva, el cursor queda en su título
  const listRef=useRef(null), focusNew=useRef(false);
  useEffect(()=>{if(focusNew.current){focusNew.current=false;[...(listRef.current?.querySelectorAll('input[data-title]')||[])].pop()?.focus()}},[written.length]);
  return <PanelBlock title={`Filmografía · ${works.length+written.filter(w=>w.title?.trim()).length}`}>
    <label className="cms-panel-label">Del archivo · con enlace a su ficha</label>
    {works.length>0?<ul className="cms-mini-list">{works.map(({film,roles})=>{const manual=(e.relations||[]).includes(film.id)&&roles.join()==='Participación';return <li key={film.id}>
      <img src={thumb(film.image,120)} alt=""/><span>{film.title}<small>{film.year}</small></span>
      {manual&&<button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({relations:e.relations.filter(id=>id!==film.id)})} aria-label={`Quitar ${film.title}`} title="Quitar de su filmografía"><X/></button>}
    </li>})}</ul>:<p className="cms-help">Ninguna todavía.</p>}
    <button type="button" className="cms-btn is-block" onClick={()=>openPicker('work')}><Plus/> Vincular película del archivo</button>
    <label className="cms-panel-label">Escritas a mano · sin enlace</label>
    {written.length>0&&<ul className="cms-cargos cms-written" ref={listRef}>{written.map((w,i)=><li key={i}>
      <input data-title value={w.title||''} onChange={ev=>setWork(i,{title:ev.target.value})} placeholder="Título" aria-label={`Título de la película ${i+1}`}/>
      <input value={w.year||''} onChange={ev=>setWork(i,{year:ev.target.value})} placeholder="Año" inputMode="numeric" aria-label="Año"/>
      <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({works:written.filter((_,j)=>j!==i)})} aria-label="Quitar" title="Quitar"><X/></button>
    </li>)}</ul>}
    <button type="button" className="cms-btn is-block" onClick={()=>{focusNew.current=true;setE({works:[...written,{title:'',year:''}]})}}><Plus/> Escribir película</button>
    <p className="cms-help is-text">Las del archivo aparecen solas cuando figura con este mismo nombre en «Dirigida por» o en un cargo, o al vincularlas. Las escritas a mano se muestran sin enlace, para películas que no tienen ficha.</p>
  </PanelBlock>;
}

// Prensa: el documento digitalizado (imagen principal y PDF opcional) y sus vínculos a películas y personas
function PressPanel({r,e,setR,setE,openPicker}){
  const linked=(e.relations||[]).map(id=>records.find(x=>x.id===id)).filter(x=>x&&['Película','Persona'].includes(x.type));
  return <>
    <PanelBlock title="Documento digitalizado">
      <label className="cms-panel-label">Imagen</label>
      <div className="cms-file-row"><button type="button" className="cms-btn is-block" onClick={()=>openPicker('image')}><ImagePlus/> {r.image?'Cambiar imagen':'Subir imagen'}</button>
        {r.image&&<button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setR({image:''})} aria-label="Quitar imagen" title="Quitar imagen"><Trash2/></button>}</div>
      <label className="cms-panel-label">PDF · opcional</label>
      <div className="cms-file-row"><button type="button" className="cms-btn is-block" onClick={()=>openPicker('media')}><FileText/> {e.media?'Cambiar PDF':'Subir PDF'}</button>
        {e.media&&<button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({media:''})} aria-label="Quitar PDF" title="Quitar PDF"><Trash2/></button>}</div>
      <p className="cms-help">La imagen se muestra en el sitio y en los listados; el PDF, si lo hay, se puede abrir y descargar.</p>
      <GalleryEditor e={e} setE={setE} openPicker={openPicker}/>
    </PanelBlock>
    <PanelBlock title={`Películas y personas · ${linked.length}`}>
      {linked.length>0?<ul className="cms-mini-list">{linked.map(x=><li key={x.id}>
        <img src={thumb(x.image,120)} alt=""/><span>{x.title}<small>{x.type}</small></span>
        <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({relations:e.relations.filter(id=>id!==x.id)})} aria-label={`Quitar ${x.title}`} title="Quitar vínculo"><X/></button>
      </li>)}</ul>:<p className="cms-help">Ninguna todavía.</p>}
      <button type="button" className="cms-btn is-block" onClick={()=>openPicker('link')}><Plus/> Vincular película o persona</button>
    </PanelBlock>
  </>;
}

// Entrevista: la persona entrevistada (de las fichas de persona), el formato y el contenido o archivo
function InterviewPanel({r,e,setR,setE,openPicker}){
  const person=records.find(x=>x.id===e.interviewee&&x.type==='Persona');
  const isText=e.mediaType==='text';
  return <>
    <PanelBlock title="Entrevistado(a)">
      {person?<>
        <ul className="cms-mini-list"><li>
          <img src={thumb(person.image,120)} alt=""/><span>{person.title}<small>Con enlace a su ficha</small></span>
          <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>{setE({interviewee:null});setR({subtitle:'',title:''})}} aria-label={`Quitar ${person.title}`} title="Quitar"><X/></button>
        </li></ul>
        <button type="button" className="cms-btn is-block" onClick={()=>openPicker('interviewee')}><Plus/> Cambiar persona</button>
      </>:<>
        <label className="cms-panel-label">Del archivo · con enlace a su ficha</label>
        <button type="button" className="cms-btn is-block" onClick={()=>openPicker('interviewee')}><Plus/> Vincular persona del archivo</button>
        <label className="cms-panel-label">O escrito a mano · sin enlace</label>
        <label className="cms-field"><input value={r.subtitle||''} onChange={ev=>setR({subtitle:ev.target.value,title:ev.target.value.trim()?`Entrevista a ${ev.target.value.trim()}`:''})} placeholder="Nombre de la persona entrevistada" aria-label="Nombre de la persona entrevistada"/></label>
        <p className="cms-help">Para quien no tiene ficha de persona. Sin fotografía de la persona, sube una imagen principal.</p>
      </>}
    </PanelBlock>
    <PanelBlock title="Formato y contenido">
      <div className="cms-segment is-small cms-seg-block">{INTERVIEW_FORMATS.map(([v,l])=><button key={v} type="button" className={e.mediaType===v?'active':''} onClick={()=>setE({mediaType:v,...(v!==e.mediaType&&{media:''})})}>{l}</button>)}</div>
      {!isText&&<><label className="cms-panel-label">Archivo adjunto</label>
        <div className="cms-file-row"><button type="button" className="cms-btn is-block" onClick={()=>openPicker('media')}>{e.media?`Cambiar ${e.mediaType==='audio'?'audio':'video'}`:`Agregar ${e.mediaType==='audio'?'audio':'video'}`}</button>
          {e.media&&<button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({media:''})} aria-label="Quitar archivo" title="Quitar archivo"><Trash2/></button>}</div></>}
      <p className="cms-help">{isText?'Escribe la entrevista en la ficha, en «Contenido».':'El texto es opcional: escríbelo en la ficha, en «Contenido». Si queda vacío, no aparece en el sitio.'}</p>
    </PanelBlock>
    <PanelBlock title="Imagen y galería">
      <label className="cms-panel-label">Imagen principal</label>
      <div className="cms-file-row"><button type="button" className="cms-btn is-block" onClick={()=>openPicker('image')}><ImagePlus/> {r.image?'Cambiar imagen':'Subir imagen'}</button>
        {r.image&&<button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setR({image:''})} aria-label="Quitar imagen" title="Quitar imagen"><Trash2/></button>}</div>
      {!r.image&&person&&<p className="cms-help">Sin imagen propia se usa la fotografía de {person.title}.</p>}
      <GalleryEditor e={e} setE={setE} openPicker={openPicker}/>
    </PanelBlock>
  </>;
}

// Galería de la ficha: miniaturas para editar, reordenar o quitar, y botón para añadir
function GalleryEditor({e,setE,openPicker}){
  const gallery=e.gallery||[];
  const move=(i,d)=>{const g=[...gallery];[g[i],g[i+d]]=[g[i+d],g[i]];setE({gallery:g})};
  return <>
    <label className="cms-panel-label">Galería · {gallery.length}</label>
    {gallery.length>0&&<div className="cms-gallery-mini">{gallery.map((src,i)=><div key={i}>
      <button type="button" className="cms-gallery-thumb" onClick={()=>openPicker({gallery:i})} title="Editar o cambiar"><img src={thumb(src,160)} alt={`Imagen ${i+1}`}/></button>
      <span>
        <button type="button" disabled={i===0} onClick={()=>move(i,-1)} aria-label="Mover antes"><ArrowLeft/></button>
        <button type="button" disabled={i===gallery.length-1} onClick={()=>move(i,1)} aria-label="Mover después"><ArrowRight/></button>
        <button type="button" onClick={()=>setE({gallery:gallery.filter((_,j)=>j!==i)})} aria-label="Quitar"><X/></button>
      </span>
    </div>)}</div>}
    <button type="button" className="cms-btn is-block" onClick={()=>openPicker({gallery:-1})}><Images/> Añadir imágenes</button>
  </>;
}

// Contenido y conexiones de la ficha: aquí se agregan, ordenan y quitan todas sus listas
function RecordPanelBlocks({r,e,meta,setE,openPicker}){
  const credits=e.credits||[], places=e.locations||[];
  const related=(e.relations||[]).map(id=>records.find(x=>x.id===id)).filter(Boolean);
  const setCredit=(i,j,v)=>setE({credits:credits.map((c,k)=>k===i?(j===0?[v,c[1]]:[c[0],v]):c)});
  // Al agregar un cargo, el cursor queda en su primer campo
  const listRef=useRef(null), focusNew=useRef(false);
  const addCredit=()=>{focusNew.current=true;setE({credits:[...credits,['','']]})};
  useEffect(()=>{if(focusNew.current){focusNew.current=false;[...(listRef.current?.querySelectorAll('input[data-cargo]')||[])].pop()?.focus()}},[credits.length]);
  const free=locations.map(l=>l.name).filter(n=>!places.includes(n));
  const media=MEDIA_TYPES.find(m=>m.value===e.mediaType)||MEDIA_TYPES[3], MediaIcon=media.icon;
  const needsFile=['video','audio','document'].includes(e.mediaType);
  return <>
    <PanelBlock title="Contenido">
      <label className="cms-panel-label">Cargos · {credits.length}</label>
      {credits.length>0&&<ul className="cms-cargos" ref={listRef}>{credits.map(([k,v],i)=><li key={i}>
        <input data-cargo value={k} onChange={ev=>setCredit(i,0,ev.target.value)} placeholder="Cargo" aria-label={`Cargo ${i+1}`}/>
        <input value={v} onChange={ev=>setCredit(i,1,ev.target.value)} placeholder="Nombre" aria-label={`Nombre para ${k||`el cargo ${i+1}`}`}
          onKeyDown={ev=>{if(ev.key==='Enter'){ev.preventDefault();addCredit()}}}/>
        <button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({credits:credits.filter((_,j)=>j!==i)})} aria-label={`Quitar ${k||'cargo'}`} title="Quitar cargo"><X/></button>
      </li>)}</ul>}
      <button type="button" className="cms-btn is-block" onClick={addCredit}><Plus/> Añadir cargo</button>
      <p className="cms-help">{credits.length?'Ej.: Fotografía · María Cortés. Si falta el cargo o el nombre, esa fila no se guarda.':'Agrega cada cargo (fotografía, montaje…) y quién lo ocupó.'}</p>
      {needsFile&&<><label className="cms-panel-label">Archivo digital</label>
      <div className="cms-file-row"><button type="button" className="cms-btn is-block" onClick={()=>openPicker('media')}><MediaIcon/> {media.label}{e.mediaType==='video'?(e.media?' · cambiar película':' · agregar enlace'):needsFile?(e.media?' · cambiar archivo':' · subir archivo'):' · cambiar tipo'}</button>
        {e.media&&<button type="button" className="cms-icon-btn is-danger-text" onClick={()=>setE({media:''})} aria-label="Quitar archivo" title="Quitar archivo"><Trash2/></button>}</div></>}
      <GalleryEditor e={e} setE={setE} openPicker={openPicker}/>
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
