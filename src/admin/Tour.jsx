import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

/* ==========================================================
   Tutorial guiado: resalta cada parte de la pantalla y explica qué hace.
   Se abre solo la primera vez que se entra a cada pantalla y se puede
   repetir con el botón «Tutorial».
   ========================================================== */

// Qué tutorial corresponde a cada ruta del gestor
export function tourViewOf(path){
  const [a,b,c]=path.split('/').filter(Boolean);
  if(!a)return 'dashboard';
  if(a==='registros')return c?'record':'list';
  if(a==='colecciones')return b?'coleccion':'colecciones';
  if(a==='linea-de-tiempo')return b?'hito':'linea';
  if(a==='comunas')return b?'comuna':'comunas';
  return {inicio:'inicio',colores:'colores',respaldo:'respaldo'}[a]||'dashboard';
}

// Pantallas ya vistas por cada cuenta: cada persona ve el tutorial en su primer inicio de sesión
const seenKey=uid=>`cms-tutorial-visto:${uid}`;
const readSeen=uid=>{try{return JSON.parse(localStorage.getItem(seenKey(uid))||'[]')}catch{return []}};
export const tourSeen=(view,uid)=>readSeen(uid).includes(view);
export function markTourSeen(view,uid){
  try{const seen=readSeen(uid);if(!seen.includes(view))localStorage.setItem(seenKey(uid),JSON.stringify([...seen,view]))}catch{/* sin almacenamiento: se volverá a mostrar */}
}

// Pasos comunes a todos los editores
const SAVE={target:'.cms-editor-actions .cms-btn.is-primary',title:'Guardar',text:'Los cambios no se publican hasta que presionas Guardar (o Ctrl + S). Arriba verás «Cambios sin guardar» mientras tengas algo pendiente; con «Descartar» vuelves a la última versión guardada.'};
const PREVIEW={target:'.cms-site-frame',title:'La página real',text:'Esta es la página tal como se ve en el sitio. Haz clic en cualquier texto para reescribirlo ahí mismo: Enter hace un salto de línea y un clic afuera termina. Los botones negros sobre las fotos sirven para cambiarlas.'};
const DANGER={target:'.cms-danger-zone',title:'Zona de peligro',text:'Lo que no se puede deshacer, como eliminar, está siempre al final y separado del resto. Siempre te pedirá confirmación.'};
const BACK={target:'.cms-editor-bar .cms-icon-btn',title:'Volver',text:'Con la flecha vuelves al listado. Si tienes cambios sin guardar, te avisará antes de salir.'};

export const TOURS={
  dashboard:[
    {title:'Bienvenida al gestor',text:'Desde aquí se edita todo lo que se publica en el sitio de la Cineteca. Este recorrido corto te muestra dónde está cada cosa. Puedes saltarlo cuando quieras y volver a verlo con el botón «Tutorial».'},
    {target:'.cms-side-nav',title:'El menú',text:'Las secciones están agrupadas: el Archivo (películas, personas, prensa, entrevistas y artículos), cómo se organiza (colecciones, línea de tiempo, comunas), la página de inicio, los colores y el respaldo. El número al lado indica cuántos elementos hay.'},
    {target:'.cms-new',title:'Crear una ficha',text:'Con «Nueva ficha» eliges qué tipo de ficha crear. También puedes crearla desde cada sección.'},
    {target:'.cms-kpis',title:'El archivo en cifras',text:'Cuántas fichas hay, cuántas están incompletas y cuántos archivos digitales (videos, audios y documentos) tiene el archivo.'},
    {target:'.cms-dash-grid',title:'Qué hay que hacer',text:'«Por completar» lista las fichas a las que les falta algo (imagen, descripción, archivo…). Haz clic en una para completarla. «Editado recientemente» te lleva de vuelta a lo último que tocaste.'},
    {target:'.cms-type-cards',title:'Secciones del archivo',text:'Entra a una sección para ver sus fichas, o usa «+ Nueva» para crear una directamente.'},
    {target:'.cms-side-foot',title:'Tu cuenta, el sitio y el tutorial',text:'«Ver sitio público» abre el sitio en otra pestaña. «Tutorial» vuelve a mostrar la guía de la pantalla en la que estés. Con tu nombre abres «Mi cuenta» (cambiar contraseña o crear cuentas para otras personas) y con «Cerrar sesión» sales del gestor.'}
  ],
  list:[
    {target:'.cms-head',title:'Una sección del archivo',text:'Aquí están todas las fichas de esta sección. Haz clic en cualquiera para editarla.'},
    {target:'.cms-head-actions',title:'Crear una ficha',text:'Este botón abre una ficha nueva en blanco de esta sección.'},
    {target:'.cms-toolbar',title:'Buscar, ordenar y filtrar',text:'Busca por título, autoría, año o colección. Ordena por las más recientes, alfabéticamente o por año. «Por completar» muestra solo las fichas incompletas y «Borradores» las que no se ven en el sitio.'},
    {target:'.cms-tile-wrap',title:'Cada ficha',text:'La tarjeta muestra el tipo, el código y el año. Si le falta algo aparece un aviso amarillo («1 pendiente»): pasa el mouse por encima para ver qué es.'},
    {target:'.cms-tile-pub',title:'Publicar y despublicar',text:'«Despublicar» oculta la ficha del sitio sin borrarla: queda como borrador (en gris) y la puedes seguir editando. «Publicar» la vuelve a mostrar. El cambio es inmediato.'}
  ],
  record:[
    {target:'.cms-editor-bar',title:'Editor de ficha',text:'Arriba ves la sección y el código de la ficha, su estado («Guardado», «Cambios sin guardar» o «Borrador») y los botones para ver la ficha en el sitio y guardar.'},
    {target:'.cms-mode',title:'Dos vistas',text:'«Ficha completa» muestra la página de la ficha tal como se ve en el sitio. «Tarjeta y lista» muestra cómo aparece en los listados y el buscador.'},
    {...PREVIEW,text:'Esta es la ficha real del sitio. Haz clic en el título, la descripción, el año o cualquier dato para reescribirlo ahí mismo. Con los botones negros cambias la imagen principal y el archivo digital (video, audio o documento).'},
    {target:'[data-tour="Visibilidad en el sitio"]',title:'Visibilidad',text:'Indica si la ficha se ve en el sitio. «Despublicar» la deja como borrador: desaparece del sitio pero sigue aquí. En una ficha nueva eliges si se publica al guardar o queda como borrador.'},
    {target:'[data-tour="Estado de la ficha"]',title:'Qué le falta',text:'La lista marca lo que ya está completo y lo que falta para que la ficha quede bien presentada en el sitio.'},
    {target:'[data-tour="Clasificación"]',title:'Clasificación',text:'La colección a la que pertenece, el color de su etiqueta (puedes elegir cualquier color con el círculo de colores o escribiendo el código) y el tipo de ficha.'},
    {target:'[data-tour="Contenido"]',title:'Contenido',text:'Agrega créditos y datos (fotografía, montaje…) con los botones «+»; su valor se escribe con clic en la vista previa. Aquí también cambias el archivo digital y armas la galería: agrega, ordena con las flechas o quita imágenes.'},
    {target:'[data-tour="Conexiones"]',title:'Conexiones',text:'Vincula otras fichas relacionadas (aparecen en «Relacionados») y los territorios o locaciones, que conectan la ficha con el mapa.'},
    {target:'[data-tour="Portada del sitio"]',title:'Destacar en el inicio',text:'Convierte esta ficha en la «Pieza destacada» de la página de inicio.'},
    DANGER,SAVE
  ],
  inicio:[
    {title:'La página de inicio',text:'Aquí editas la portada del sitio: el carrusel de arriba y cada sección de la página, con la página real a la vista.'},
    {target:'.cms-frame-tools',title:'Tamaño de la vista',text:'«Ajustar al ancho» achica la página para verla completa; «Tamaño real» la muestra a su tamaño para editar textos con más comodidad.'},
    PREVIEW,
    {target:'[data-tour="Cómo escribir"]',title:'Cómo escribir',text:'Recordatorios rápidos: clic en un texto para cambiarlo y asteriscos alrededor de una palabra para destacarla en cursiva.'},
    {target:'.cms-hsec',title:'Portada y carrusel',text:'Elige la diapositiva que quieres editar con las miniaturas. Crea una nueva en blanco o «Desde una ficha» (toma su imagen y textos). Con las flechas cambias su orden, con el basurero la quitas, y abajo eliges a dónde lleva su botón.'},
    {target:'.cms-hsecs',title:'Secciones en el orden de la página',text:'Cada sección aparece en el mismo orden que en la página. Haz clic en su nombre para abrir sus opciones y llevar la vista hasta ella.'},
    {target:'.cms-hsecs .cms-toggle-eye',title:'Mostrar u ocultar secciones',text:'El ojo muestra u oculta la sección en el sitio. Las ocultas aparecen tachadas aquí y en la vista previa.'},
    {...DANGER,text:'«Volver a los textos originales» reemplaza los textos del inicio por los de fábrica. Podrás revisar el resultado antes de guardar.'},
    SAVE
  ],
  colecciones:[
    {target:'.cms-head',title:'Colecciones',text:'Las colecciones agrupan fichas por tema. Cada ficha pertenece a una colección, que se elige desde el editor de la ficha.'},
    {target:'.cms-head-actions',title:'Nueva colección',text:'Crea una colección nueva con su nombre, período, descripción, portada y color.'},
    {target:'.cms-collections',title:'Editar una colección',text:'Haz clic en una tarjeta para editarla. La etiqueta de abajo indica cuántas fichas tiene.'}
  ],
  coleccion:[
    BACK,
    {...PREVIEW,text:'Es la página real de colecciones. La que estás editando está marcada: haz clic en su período, nombre o descripción para cambiarlos, y usa «Cambiar portada» para la imagen. Haz clic en otra colección para pasar a editarla.'},
    {target:'[data-tour="Color"]',title:'Color',text:'El color de la etiqueta de la colección. Puedes usar los colores del sitio o elegir cualquier otro.'},
    {target:'[data-tour="Fichas de la colección"]',title:'Sus fichas',text:'Las fichas que pertenecen a esta colección. Haz clic en una para abrirla. Si cambias el nombre de la colección, todas se actualizan al guardar.'},
    DANGER,SAVE
  ],
  linea:[
    {target:'.cms-head',title:'Línea de tiempo',text:'Los hitos de la historia audiovisual. Se ordenan solos por año.'},
    {target:'.cms-head-actions',title:'Nuevo hito',text:'Crea un hito con su año, título, texto y (si quieres) una imagen.'},
    {target:'.cms-timeline',title:'Editar un hito',text:'Haz clic en un hito para editarlo.'}
  ],
  hito:[
    BACK,
    {...PREVIEW,text:'Es la página real de la línea de tiempo con este hito seleccionado. Haz clic en el año, el título o el texto para cambiarlos, y usa el botón de imagen para agregar o cambiar la foto (es opcional). Haz clic en otro hito de la izquierda para pasar a editarlo.'},
    {target:'[data-tour="Categoría"]',title:'Categoría',text:'El tipo de hito (Exhibición, Película, Memoria…). Puedes escribir una categoría nueva.'},
    DANGER,{...SAVE,text:'Al guardar, el hito se ubica según su año y te quedas en él. Con Ctrl + S también se guarda.'}
  ],
  comunas:[
    {target:'.cms-head',title:'Comunas y mapa',text:'Los lugares que aparecen en el mapa del sitio. Las fichas se vinculan a ellos desde «Conexiones».'},
    {target:'.cms-head-actions',title:'Nueva comuna',text:'Agrega un lugar nuevo al mapa: lo buscas por nombre o lo marcas con un clic.'},
    {target:'.cms-locations',title:'Editar una comuna',text:'Cada tarjeta muestra cuántas fichas están vinculadas y sus coordenadas. Haz clic para editarla.'}
  ],
  comuna:[
    BACK,
    {target:'.cms-locpicker-search',title:'Buscar el lugar',text:'Escribe el nombre (por ejemplo «Punitaqui» o «Plaza de Ovalle») y presiona Buscar. Al elegir un resultado, el mapa se mueve y la posición se completa sola.'},
    {target:'.cms-locpicker-map',title:'Marcar en el mapa',text:'También puedes hacer clic en el mapa o arrastrar el marcador para fijar el punto exacto. El botón de la esquina vuelve a centrar el mapa en el marcador.'},
    {target:'.pv-map aside',title:'Nombre',text:'Haz clic en el nombre para cambiarlo. Si la comuna ya tiene fichas vinculadas, se actualizarán con el nombre nuevo al guardar.'},
    {target:'[data-tour="Coordenadas"]',title:'Coordenadas',text:'Latitud y longitud se completan solas, pero también puedes escribirlas.'},
    DANGER,SAVE
  ],
  colores:[
    {...PREVIEW,title:'Vista previa de colores',text:'Aquí ves el sitio con los colores que estás probando. No cambia nada hasta que guardes.'},
    {target:'[data-tour="Combinaciones"]',title:'Combinaciones',text:'Paletas listas para usar. «Volver a los colores originales» restaura los de fábrica.'},
    {target:'[data-tour="Colores principales"]',title:'Colores principales',text:'Ajusta cada color: haz clic en el círculo para elegirlo o escribe su código (por ejemplo #d9ff43).'},
    {target:'[data-tour="Etiquetas de fichas y colecciones"]',title:'Colores de etiquetas',text:'Los colores que se ofrecen para las etiquetas. Si cambias uno, las fichas y colecciones que lo usaban se actualizan.'},
    {target:'[data-tour="Legibilidad"]',title:'¿Se lee bien?',text:'Revisa automáticamente si los textos se leen bien sobre cada fondo. Si aparece un aviso, elige un color más claro u oscuro.'},
    SAVE
  ],
  respaldo:[
    {target:'.cms-head',title:'Respaldo',text:'Todo lo que editas se guarda en este navegador. Descarga un respaldo con frecuencia para no perder trabajo o para pasarlo a otro computador.'},
    {target:'.cms-backup > :first-child',title:'Exportar',text:'Descarga un archivo con todas las fichas, imágenes, colecciones, línea de tiempo, comunas y la portada. Guárdalo en un lugar seguro.'},
    {target:'.cms-backup > :nth-child(2)',title:'Importar',text:'Carga un respaldo descargado antes. Reemplaza todo el contenido actual por el del archivo, así que conviene exportar primero.'},
    {target:'.cms-danger-section',title:'Restablecer',text:'Vuelve al contenido original del sitio y borra todos los cambios. Úsalo solo si quieres empezar de cero.'}
  ]
};

const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0};
const PAD=8, GAP=14;

export function Tour({steps,onClose}){
  const [i,setI]=useState(0), [rect,setRect]=useState(null), [pos,setPos]=useState(null);
  const cardRef=useRef(null);
  const step=steps[i], last=i===steps.length-1;

  // Lleva el elemento a la vista y lo sigue mientras la pantalla se mueve
  useEffect(()=>{
    let el=step.target?document.querySelector(step.target):null;
    if(!visible(el))el=null;
    el?.scrollIntoView({block:'center',behavior:'smooth'});
    let frame, prev='';
    const track=()=>{
      const r=el?.getBoundingClientRect(), key=r?`${r.top|0},${r.left|0},${r.width|0},${r.height|0}`:'none';
      if(key!==prev){prev=key;setRect(r?{top:r.top,left:r.left,width:r.width,height:r.height}:null)}
      frame=requestAnimationFrame(track);
    };
    track();
    return()=>cancelAnimationFrame(frame);
  },[step]);

  // Ubica la tarjeta junto al elemento (abajo, arriba o al costado), sin salirse de la pantalla
  useLayoutEffect(()=>{
    const card=cardRef.current;if(!card)return;
    const W=window.innerWidth, H=window.innerHeight, cw=card.offsetWidth, ch=card.offsetHeight;
    if(!rect){setPos({top:Math.max(16,(H-ch)/2),left:Math.max(16,(W-cw)/2)});return}
    const t=rect.top-PAD, b=rect.top+rect.height+PAD, l=rect.left-PAD, r=rect.left+rect.width+PAD;
    let top, left;
    if(H-b>=ch+GAP){top=b+GAP;left=rect.left}
    else if(t>=ch+GAP){top=t-GAP-ch;left=rect.left}
    else if(W-r>=cw+GAP){left=r+GAP;top=rect.top}
    else if(l>=cw+GAP){left=l-GAP-cw;top=rect.top}
    else{top=H-ch-16;left=(W-cw)/2}
    setPos({top:Math.min(Math.max(16,top),H-ch-16),left:Math.min(Math.max(16,left),W-cw-16)});
  },[rect,i]);

  const next=()=>last?onClose(true):setI(i+1);
  const prev=()=>i>0&&setI(i-1);
  useEffect(()=>{
    const onKey=e=>{
      if(e.key==='Escape'){e.stopPropagation();onClose(false)}
      if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();next()}
      if(e.key==='ArrowLeft'){e.preventDefault();prev()}
    };
    document.addEventListener('keydown',onKey,true);return()=>document.removeEventListener('keydown',onKey,true);
  });
  useEffect(()=>{cardRef.current?.focus()},[i]);

  return createPortal(<div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    {rect?<div className="tour-hole" style={{top:rect.top-PAD,left:rect.left-PAD,width:rect.width+PAD*2,height:rect.height+PAD*2}}/>:<div className="tour-dim"/>}
    <div className="tour-card" ref={cardRef} tabIndex={-1} style={pos?{top:pos.top,left:pos.left}:{visibility:'hidden'}}>
      <div className="tour-card-top"><span>Paso {i+1} de {steps.length}</span><button type="button" onClick={()=>onClose(false)} aria-label="Cerrar tutorial"><X/></button></div>
      <h3 id="tour-title">{step.title}</h3>
      <p>{step.text}</p>
      <div className="tour-dots" aria-hidden="true">{steps.map((_,k)=><i key={k} className={k===i?'on':k<i?'done':''}/>)}</div>
      <div className="tour-actions">
        <button type="button" className="tour-skip" onClick={()=>onClose(false)}>{last?'Cerrar':'Saltar tutorial'}</button>
        <span>
          {i>0&&<button type="button" className="tour-btn" onClick={prev}><ArrowLeft/> Atrás</button>}
          <button type="button" className="tour-btn is-primary" onClick={next}>{last?<><Check/> Entendido</>:<>Siguiente <ArrowRight/></>}</button>
        </span>
      </div>
    </div>
  </div>,document.body);
}
