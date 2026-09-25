import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, FileText, Film, Headphones, ImagePlus, Images, Link2, Pencil, Plus, Search, SlidersHorizontal, Trash2, Type, Upload, X } from 'lucide-react';
import { collections, heroSlides, recordExtras, records, theme, timelineEvents } from '../data';
import { ImageEditor } from './ImageEditor';
import { inkOn, isHex, tagStyle } from '../color';

// Colores de etiqueta: vienen del tema elegido en «Colores»
export const palette=()=>theme.palette;

/* ---------- Archivos ---------- */

export function readFile(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    r.readAsDataURL(file);
  });
}

// Miniatura liviana para las fotos de Unsplash (las subidas ya vienen optimizadas)
export const thumb=(src,w=360)=>typeof src==='string'&&src.includes('images.unsplash.com')?src.replace(/([?&])w=\d+/,`$1w=${w}`):src;
export const isUploaded=src=>typeof src==='string'&&src.startsWith('data:');
export const fileSize=src=>isUploaded(src)?Math.round(src.length*.75):0;
export const formatBytes=n=>n>1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;

/* ---------- Avisos y confirmaciones ---------- */

const UiContext=createContext(null);
export const useUi=()=>useContext(UiContext);

export function UiProvider({children}){
  const [toasts,setToasts]=useState([]), [dialog,setDialog]=useState(null);
  const toast=useCallback((text,kind='ok')=>{
    const id=Math.random();
    setToasts(t=>[...t,{id,text,kind}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3600);
  },[]);
  const confirm=useCallback(opts=>new Promise(resolve=>setDialog({...opts,resolve})),[]);
  const close=v=>{dialog.resolve(v);setDialog(null)};
  const ui=useMemo(()=>({toast,confirm}),[toast,confirm]);
  return <UiContext.Provider value={ui}>
    {children}
    <div className="cms-toasts" aria-live="polite">{toasts.map(t=><div key={t.id} className={`cms-toast is-${t.kind}`}>{t.kind==='ok'?<Check/>:<X/>}{t.text}</div>)}</div>
    {dialog&&<Modal onClose={()=>close(false)} className="cms-confirm">
      <h3>{dialog.title}</h3>
      {dialog.text&&<p>{dialog.text}</p>}
      <div className="cms-modal-actions">
        <button type="button" className="cms-btn" onClick={()=>close(false)}>{dialog.cancel||'Cancelar'}</button>
        <button type="button" className={`cms-btn ${dialog.danger?'is-danger':'is-primary'}`} onClick={()=>close(true)} autoFocus>{dialog.ok||'Aceptar'}</button>
      </div>
    </Modal>}
  </UiContext.Provider>;
}

export function Modal({children,onClose,className='',title}){
  useEffect(()=>{
    const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();onClose()}};
    document.addEventListener('keydown',onKey,true);
    return()=>document.removeEventListener('keydown',onKey,true);
  },[onClose]);
  // En el body: así no hereda escalas ni recortes de la vista previa
  return createPortal(<div className="cms-modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className={`cms-modal ${className}`} role="dialog" aria-modal="true">
      {title&&<header className="cms-modal-head"><h3>{title}</h3><button type="button" className="cms-icon-btn" onClick={onClose} aria-label="Cerrar"><X/></button></header>}
      {children}
    </div>
  </div>,document.body);
}

/* ---------- Texto editable con un clic ---------- */

// multiline: admite saltos de línea · wrap: ajusta el texto largo pero Enter confirma
// render: cómo mostrar el valor cuando no se está editando (p. ej. con cursivas)
export function Editable({value,onChange,placeholder='Escribe aquí…',multiline=false,wrap=false,as:Tag='span',className='',type='text',label,render}){
  const [editing,setEditing]=useState(false);
  const original=useRef(value), fieldRef=useRef(null);
  const start=()=>{original.current=value;setEditing(true)};
  const finish=()=>setEditing(false);
  const cancel=()=>{onChange(original.current);setEditing(false)};
  const area=multiline||wrap;
  const grow=el=>{if(el&&area){el.style.height='auto';el.style.height=`${el.scrollHeight}px`}};
  useEffect(()=>{if(editing){const el=fieldRef.current;el?.focus();el?.select?.();grow(el)}},[editing]);
  if(editing){
    const props={ref:fieldRef,value:value??'',className:'cms-edit-field',placeholder,'aria-label':label||placeholder,onBlur:finish,onClick:e=>{e.preventDefault();e.stopPropagation()},
      onChange:e=>{onChange(multiline?e.target.value:e.target.value.replace(/\n/g,' '));grow(e.target)},
      onKeyDown:e=>{if(e.key==='Escape'){e.stopPropagation();cancel()}if(e.key==='Enter'&&(!multiline||e.ctrlKey||e.metaKey)){e.preventDefault();finish()}}};
    return <Tag className={`cms-editable is-editing ${className}`}>{area?<textarea rows={1} {...props}/>:<input type={type} step="any" {...props}/>}</Tag>;
  }
  const empty=value===undefined||value===null||String(value).trim()==='';
  return <Tag className={`cms-editable ${empty?'is-empty':''} ${className}`} role="button" tabIndex={0} title={label?`Editar ${label.toLowerCase()}`:'Clic para editar'}
    onClick={e=>{e.preventDefault();e.stopPropagation();start()}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();start()}}}>
    {empty?placeholder:render?render(value):multiline?String(value).split('\n').map((l,i,a)=><React.Fragment key={i}>{l}{i<a.length-1&&<br/>}</React.Fragment>):value}
    <Pencil className="cms-edit-hint" aria-hidden="true"/>
  </Tag>;
}

/* ---------- Imágenes ---------- */

function libraryImages(){
  const all=[...records.map(r=>r.image),...Object.values(recordExtras).flatMap(e=>e.gallery||[]),...collections.map(c=>c.image),...timelineEvents.map(e=>e.image),...heroSlides.map(s=>s.image)];
  return [...new Set(all.filter(Boolean))];
}

const DIRECT=['image/gif','image/svg+xml'];
const toSource=f=>({src:URL.createObjectURL(f),name:f.name,type:f.type==='image/png'?'image/webp':'image/jpeg'});
const revoke=list=>list?.forEach(s=>s.src.startsWith('blob:')&&URL.revokeObjectURL(s.src));

// Toda imagen pasa por el editor antes de guardarse. Con `multiple` se pueden cargar varias de una vez.
export function ImagePicker({value,onPick,onPickMany,multiple=false,onClose,title,onRemove,aspect=null}){
  const [tab,setTab]=useState('upload'), [urls,setUrls]=useState(isUploaded(value)||multiple?'':value||''), [error,setError]=useState(''), [over,setOver]=useState(false);
  const [editing,setEditing]=useState(null), [selected,setSelected]=useState([]);
  const inputRef=useRef(null), direct=useRef([]);
  const library=useMemo(libraryImages,[]);
  const deliver=list=>{if(!list.length)return;multiple?onPickMany(list):onPick(list[0]);onClose()};
  const edit=(sources,passThrough=[])=>{direct.current=passThrough;setError('');setEditing(sources)};
  const openFiles=async fileList=>{
    const files=[...(fileList||[])].filter(f=>f.type.startsWith('image/'));
    if(!files.length)return setError('Elige archivos de imagen (JPG, PNG, WEBP…).');
    const chosen=multiple?files:files.slice(0,1);
    const passThrough=await Promise.all(chosen.filter(f=>DIRECT.includes(f.type)).map(readFile));
    const editable=chosen.filter(f=>!DIRECT.includes(f.type));
    editable.length?edit(editable.map(toSource),passThrough):deliver(passThrough);
  };
  const urlList=urls.split(/\s+/).map(u=>u.trim()).filter(u=>/^(https?:|data:)/.test(u));
  useEffect(()=>{
    const onPaste=e=>{if(editing)return;const files=[...(e.clipboardData?.files||[])];if(files.some(f=>f.type.startsWith('image/'))){e.preventDefault();openFiles(files)}};
    window.addEventListener('paste',onPaste);return()=>window.removeEventListener('paste',onPaste);
  });
  if(editing)return <ImageEditor sources={editing} aspect={aspect}
    onClose={()=>{revoke(editing);setEditing(null)}}
    onDone={out=>{revoke(editing);deliver([...out,...direct.current])}}/>;
  return <Modal onClose={onClose} title={title||(multiple?'Añadir imágenes':'Elegir imagen')} className="cms-picker">
    {value&&!multiple&&<div className="cms-current">
      <img src={thumb(value,200)} alt=""/>
      <span><strong>Imagen actual</strong><small>Puedes recortarla, girarla o ajustar su luz sin reemplazarla.</small></span>
      <button type="button" className="cms-btn" onClick={()=>edit([{src:value}])}><SlidersHorizontal/> Editar</button>
      {onRemove&&<button type="button" className="cms-icon-btn is-danger-text" onClick={()=>{onRemove();onClose()}} aria-label="Quitar imagen" title="Quitar imagen"><Trash2/></button>}
    </div>}
    <div className="cms-tabs" role="tablist">
      {[['upload',Upload,'Subir desde el equipo'],['url',Link2,multiple?'Pegar enlaces':'Pegar enlace'],['library',ImagePlus,`Biblioteca · ${library.length}`]].map(([k,Icon,l])=><button key={k} type="button" role="tab" aria-selected={tab===k} className={tab===k?'active':''} onClick={()=>{setTab(k);setError('')}}><Icon/>{l}</button>)}
    </div>
    {tab==='upload'&&<div className={`cms-drop ${over?'is-over':''}`} onClick={()=>inputRef.current.click()} onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);openFiles(e.dataTransfer.files)}}>
      {multiple?<Images/>:<Upload/>}
      <strong>{multiple?'Arrastra una o varias imágenes aquí':'Arrastra una imagen aquí'}</strong>
      <span>o haz clic para {multiple?'elegirlas':'buscarla'} en tu equipo · también puedes pegar con Ctrl+V</span>
      <small>JPG, PNG, WEBP · después podrás recortar, girar y ajustar{multiple?' cada una':''}</small>
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} hidden onChange={e=>{openFiles(e.target.files);e.target.value=''}}/>
    </div>}
    {tab==='url'&&<div className="cms-url">
      <label className="cms-field"><span>{multiple?'Direcciones de las imágenes · una por línea':'Dirección de la imagen'}</span>
        {multiple?<textarea autoFocus rows={4} value={urls} onChange={e=>setUrls(e.target.value)} placeholder={'https://…\nhttps://…'}/>:<input autoFocus value={urls} onChange={e=>setUrls(e.target.value)} placeholder="https://…" onKeyDown={e=>{if(e.key==='Enter'&&urlList.length)edit(urlList.map(src=>({src})))}}/>}
      </label>
      <div className={`cms-url-preview ${urlList.length>1?'is-many':''}`}>{urlList.length?urlList.slice(0,8).map(u=><img key={u} src={u} alt="Vista previa" onError={e=>e.currentTarget.classList.add('is-broken')}/>):<span>La vista previa aparecerá aquí</span>}</div>
      <div className="cms-modal-actions">
        <button type="button" className="cms-btn" disabled={!urlList.length} onClick={()=>deliver(urlList)}>Usar sin editar</button>
        <button type="button" className="cms-btn is-primary" disabled={!urlList.length} onClick={()=>edit(urlList.map(src=>({src})))}><SlidersHorizontal/> Editar y usar{urlList.length>1?` (${urlList.length})`:''}</button>
      </div>
    </div>}
    {tab==='library'&&<>
      {multiple&&<p className="cms-help">Marca las imágenes que quieras añadir.</p>}
      <div className="cms-library">{library.map(src=>{const on=multiple?selected.includes(src):src===value;return <button type="button" key={src.slice(0,200)} className={on?'is-current':''}
        onClick={()=>multiple?setSelected(s=>on?s.filter(x=>x!==src):[...s,src]):edit([{src}])}><img src={thumb(src,240)} alt="" loading="lazy"/>{on&&<Check/>}</button>})}</div>
      {multiple&&<div className="cms-modal-actions">
        <button type="button" className="cms-btn" disabled={!selected.length} onClick={()=>deliver(selected)}>Añadir sin editar</button>
        <button type="button" className="cms-btn is-primary" disabled={!selected.length} onClick={()=>edit(selected.map(src=>({src})))}><SlidersHorizontal/> Editar y añadir{selected.length?` (${selected.length})`:''}</button>
      </div>}
    </>}
    {error&&<p className="cms-error">{error}</p>}
  </Modal>;
}

// Imagen de la vista previa: se puede editar la actual o reemplazarla
export function EditableImage({src,onChange,className='',label='Cambiar imagen',children,alt='',aspect=null}){
  const [open,setOpen]=useState(null);
  return <div className={`cms-image ${src?'':'is-empty'} ${className}`}>
    {src?<img src={src} alt={alt} onClick={()=>setOpen('pick')}/>:<button type="button" className="cms-image-empty" onClick={()=>setOpen('pick')}><ImagePlus/><span>Añadir imagen</span></button>}
    {children}
    {src&&<div className="cms-image-tools">
      <button type="button" className="cms-image-btn" onClick={()=>setOpen('edit')}><SlidersHorizontal/> Editar</button>
      <button type="button" className="cms-image-btn" onClick={()=>setOpen('pick')}><ImagePlus/> {label}</button>
    </div>}
    {open==='pick'&&<ImagePicker value={src} aspect={aspect} onPick={onChange} onClose={()=>setOpen(null)}/>}
    {open==='edit'&&<ImageEditor sources={[{src}]} aspect={aspect} onDone={([out])=>{onChange(out);setOpen(null)}} onClose={()=>setOpen(null)}/>}
  </div>;
}


/* ---------- Archivo digital (video, audio, documento…) ---------- */

export const MEDIA_TYPES=[
  {value:'video',label:'Video',icon:Film,accept:'video/*',hint:'MP4 o WEBM'},
  {value:'audio',label:'Audio',icon:Headphones,accept:'audio/*',hint:'MP3, M4A u OGG'},
  {value:'document',label:'Documento',icon:FileText,accept:'application/pdf',hint:'PDF'},
  {value:'image',label:'Imagen',icon:ImagePlus,accept:'image/*',hint:'Se muestra la imagen principal'},
  {value:'text',label:'Texto',icon:Type,accept:'',hint:'Se muestra la descripción como texto'}
];
const MAX_MEDIA=40*1048576;

export function MediaPicker({mediaType,media,onChange,onClose}){
  const [type,setType]=useState(mediaType||'image'), [url,setUrl]=useState(isUploaded(media)?'':media||''), [uploaded,setUploaded]=useState(isUploaded(media)?media:''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const cfg=MEDIA_TYPES.find(m=>m.value===type), needsFile=['video','audio','document'].includes(type);
  const src=uploaded||url;
  const take=async file=>{
    if(!file)return;
    if(file.size>MAX_MEDIA)return setError(`El archivo pesa ${formatBytes(file.size)}. Para archivos de más de 40 MB, súbelo a un servicio externo y pega el enlace.`);
    setBusy(true);setError('');
    try{setUploaded(await readFile(file));setUrl('')}catch{setError('No se pudo leer el archivo.')}finally{setBusy(false)}
  };
  return <Modal onClose={onClose} title="Archivo digital" className="cms-picker">
    <div className="cms-segment">{MEDIA_TYPES.map(({value,label,icon:Icon})=><button key={value} type="button" className={type===value?'active':''} onClick={()=>{setType(value);setError('')}}><Icon/>{label}</button>)}</div>
    <p className="cms-help">{cfg.hint}</p>
    {needsFile&&<>
      <label className="cms-drop is-compact"><Upload/><strong>{busy?'Leyendo archivo…':uploaded?'Archivo cargado · clic para reemplazar':'Subir archivo desde el equipo'}</strong><small>Hasta 40 MB</small><input type="file" accept={cfg.accept} hidden onChange={e=>take(e.target.files[0])}/></label>
      <label className="cms-field"><span>o pega un enlace</span><input value={url} onChange={e=>{setUrl(e.target.value);setUploaded('')}} placeholder="https://…"/></label>
      <div className="cms-media-preview">
        {!src&&<span>Sin archivo asignado</span>}
        {src&&type==='video'&&<video src={src} controls preload="metadata"/>}
        {src&&type==='audio'&&<audio src={src} controls preload="metadata"/>}
        {src&&type==='document'&&<a href={src} target="_blank" rel="noreferrer"><FileText/> Abrir documento</a>}
      </div>
    </>}
    {error&&<p className="cms-error">{error}</p>}
    <div className="cms-modal-actions">
      <button type="button" className="cms-btn" onClick={onClose}>Cancelar</button>
      <button type="button" className="cms-btn is-primary" onClick={()=>{onChange(type,needsFile?src:'');onClose()}}><Check/> Aplicar</button>
    </div>
  </Modal>;
}

/* ---------- Selectores ---------- */

export function RecordPicker({onPick,onClose,exclude=[],title='Vincular registro',types,action='Vincular'}){
  const [q,setQ]=useState(''), [type,setType]=useState('');
  const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const pool=records.filter(r=>!exclude.includes(r.id)&&(!types||types.includes(r.type)));
  const matches=pool.filter(r=>fold(`${r.title} ${r.subtitle} ${r.type} ${r.year} ${r.collection}`).includes(fold(q.trim())));
  const list=matches.filter(r=>!type||r.type===type);
  const typeList=[...new Set(pool.map(r=>r.type))];
  const pick=r=>{onPick(r);onClose()};
  return <Modal onClose={onClose} title={title} className="cms-picker cms-record-picker">
    <label className="cms-search">
      <Search/>
      <input autoFocus value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&list[0]){e.preventDefault();pick(list[0])}}} placeholder="Buscar por título, persona, año o colección…"/>
      {q&&<button type="button" onClick={()=>setQ('')} aria-label="Limpiar búsqueda"><X/></button>}
    </label>
    {typeList.length>1&&<div className="cms-type-filter">
      <button type="button" className={!type?'active':''} onClick={()=>setType('')}>Todos <b>{matches.length}</b></button>
      {typeList.map(t=>{const n=matches.filter(r=>r.type===t).length;return <button key={t} type="button" className={`${type===t?'active':''} ${n?'':'is-zero'}`} onClick={()=>setType(type===t?'':t)}>{t} <b>{n}</b></button>})}
    </div>}
    <div className="cms-record-options">
      {list.slice(0,80).map(r=><button key={r.id} type="button" onClick={()=>pick(r)}>
        <img src={thumb(r.image,120)} alt="" loading="lazy"/>
        <span><strong>{r.title}{r.draft&&<em className="cms-draft-mark">Borrador</em>}</strong><small><i style={tagStyle(r.color)}>{r.type}</i>{r.year} · {r.subtitle}</small></span>
        <em><Plus/> {action}</em>
      </button>)}
      {!list.length&&<p className="cms-empty"><Search/> Sin coincidencias{q&&<> para “{q}”</>}.</p>}
    </div>
    <p className="cms-picker-foot">{list.length>80?`Mostrando 80 de ${list.length} · afina la búsqueda para ver más`:`${list.length} ${list.length===1?'registro':'registros'}`} · Enter elige el primero</p>
  </Modal>;
}

// Lista desplegable con opción de escribir un valor nuevo
export function Choice({value,options,onChange,placeholder='Elegir…',allowNew=false,newLabel='Crear',renderOption}){
  const [open,setOpen]=useState(false), [q,setQ]=useState(''), ref=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const onDown=e=>{if(!ref.current?.contains(e.target))setOpen(false)};
    document.addEventListener('mousedown',onDown);return()=>document.removeEventListener('mousedown',onDown);
  },[open]);
  const opts=options.map(o=>typeof o==='string'?{value:o,label:o}:o);
  const shown=opts.filter(o=>o.label.toLowerCase().includes(q.toLowerCase()));
  const current=opts.find(o=>o.value===value);
  const pick=v=>{onChange(v);setOpen(false);setQ('')};
  return <div className={`cms-choice ${open?'is-open':''}`} ref={ref}>
    <button type="button" className="cms-choice-btn" onClick={()=>setOpen(!open)}>{current?(renderOption?renderOption(current):current.label):value||<em>{placeholder}</em>}<ChevronDown/></button>
    {open&&<div className="cms-choice-menu">
      {(opts.length>6||allowNew)&&<input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder={allowNew?'Buscar o escribir uno nuevo…':'Buscar…'} onKeyDown={e=>{if(e.key==='Enter'&&allowNew&&q.trim()){e.preventDefault();pick(q.trim())}}}/>}
      <div>{shown.map(o=><button type="button" key={o.value} className={o.value===value?'active':''} onClick={()=>pick(o.value)}>{renderOption?renderOption(o):o.label}{o.value===value&&<Check/>}</button>)}
      {allowNew&&q.trim()&&!opts.some(o=>o.label.toLowerCase()===q.trim().toLowerCase())&&<button type="button" className="cms-choice-new" onClick={()=>pick(q.trim())}><Plus/> {newLabel} “{q.trim()}”</button>}</div>
    </div>}
  </div>;
}

// Colores del tema a un clic, más un selector libre (rueda de color o código hexadecimal)
export function ColorSwatches({value,onChange}){
  const current=String(value||'').toLowerCase(), colors=palette();
  const custom=isHex(current)&&!colors.some(c=>c.toLowerCase()===current);
  const [text,setText]=useState(current), [prev,setPrev]=useState(current);
  if(prev!==current){setPrev(current);setText(current)}
  return <div className="cms-swatches">
    <div className="cms-swatches-row">
      {colors.map(c=><button key={c} type="button" style={{background:c}} className={c.toLowerCase()===current?'active':''} onClick={()=>onChange(c)} aria-label={`Color ${c}`}>{c.toLowerCase()===current&&<Check style={{color:inkOn(c)}}/>}</button>)}
      <label className={`cms-swatch-custom ${custom?'active':''}`} style={custom?{background:current}:undefined} title="Elegir cualquier color">
        <input type="color" value={isHex(current)?current:'#888888'} onChange={e=>onChange(e.target.value.toLowerCase())} aria-label="Elegir cualquier color"/>
        {custom?<Check style={{color:inkOn(current)||'#101210'}}/>:<Plus/>}
      </label>
    </div>
    <label className="cms-swatches-hex"><small>Otro color</small>
      <input value={text} spellCheck={false} maxLength={7} placeholder="#rrggbb" aria-label="Color en hexadecimal"
        onChange={e=>{let v=e.target.value.trim();if(v&&!v.startsWith('#'))v=`#${v}`;setText(v);if(isHex(v))onChange(v.toLowerCase())}} onBlur={()=>setText(current)}/>
    </label>
  </div>;
}
