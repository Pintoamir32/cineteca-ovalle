import { useEffect, useRef } from 'react';
import { useUi } from './fields';

/* Copia de seguridad de lo que se está editando y aún no se guarda.
   Mientras hay cambios sin guardar, el borrador se copia en este navegador. Si la página se cierra,
   se recarga o se cae antes de pulsar «Guardar», al volver a abrir el mismo editor se ofrece recuperarlo.
   Al guardar o descartar, la copia se borra. */
const PREFIX='cdo-borrador:';
const read=key=>{try{return JSON.parse(localStorage.getItem(PREFIX+key)||'null')}catch{return null}};
const remove=key=>{try{localStorage.removeItem(PREFIX+key)}catch{/* sin almacenamiento */}};
const write=(key,draft)=>{
  try{localStorage.setItem(PREFIX+key,JSON.stringify({at:Date.now(),draft}))}
  catch{/* sin espacio (p. ej., imágenes muy pesadas) o sin almacenamiento: queda solo en pantalla */}
};

// key: identifica el editor (p. ej., la dirección); restore(draft): vuelve a poner el borrador en pantalla.
// Devuelve clear(), para borrar la copia al guardar.
export function useLocalDraft(key,draft,dirty,restore){
  const {confirm}=useUi();
  const ready=useRef(false), wasDirty=useRef(false), restoreRef=useRef(restore);
  restoreRef.current=restore;
  // Al abrir: si quedó un borrador sin guardar de este mismo editor, se ofrece recuperarlo
  useEffect(()=>{
    const saved=read(key);
    if(!saved?.draft){ready.current=true;return}
    const when=new Date(saved.at).toLocaleString('es-CL',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
    confirm({title:'Hay cambios sin guardar',text:`La última vez que editaste aquí (${when}) quedaron cambios sin guardar. ¿Quieres recuperarlos? Después revisa y pulsa «Guardar».`,ok:'Recuperar cambios',cancel:'Descartarlos'})
      .then(ok=>{if(ok)restoreRef.current(saved.draft);else remove(key)})
      .finally(()=>{ready.current=true});
  },[key]);// eslint-disable-line react-hooks/exhaustive-deps
  // Mientras hay cambios, se copian (con una pequeña espera para no escribir en cada tecla)
  useEffect(()=>{
    if(!ready.current)return;
    if(dirty){wasDirty.current=true;const t=setTimeout(()=>write(key,draft),400);return()=>clearTimeout(t)}
    // Se guardó o se descartó: la copia ya no hace falta
    if(wasDirty.current){wasDirty.current=false;remove(key)}
  },[key,draft,dirty]);
  // Al cerrar o recargar la página, se copia al instante lo último escrito
  useEffect(()=>{
    const flush=()=>{if(ready.current&&dirty)write(key,draft)};
    window.addEventListener('pagehide',flush);return()=>window.removeEventListener('pagehide',flush);
  },[key,draft,dirty]);
  // Se llama al guardar: el editor puede cerrarse enseguida sin pasar por «sin cambios»
  return ()=>{wasDirty.current=false;remove(key)};
}
