/* Estadísticas de visitas del sitio público (se ven en el gestor, «Estadísticas»).
   Se envía solo qué se vio: «ficha:12», «page:/mapa», «search:cine», etc. Nada que identifique a la persona.
   «u» marca la primera vez del día que este navegador ve eso: así se cuentan personas además de vistas. */
const SEEN_KEY='cdo-stats-seen', SESSION_KEY='cdo-stats-session';
let queue=[], timer=null;

const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`};
function firstToday(k){
  try{
    const saved=JSON.parse(localStorage.getItem(SEEN_KEY)||'{}'), day=localDay();
    const seen=saved.d===day?saved.k:[];
    if(seen.includes(k))return false;
    localStorage.setItem(SEEN_KEY,JSON.stringify({d:day,k:[...seen,k].slice(-400)}));
    return true;
  }catch{return false}// sin almacenamiento no se puede saber: cuenta como vista, no como persona
}

function send(){
  timer=null;
  if(!queue.length)return;
  const body=JSON.stringify({hits:queue.splice(0,20)});
  if(queue.length)timer=setTimeout(send,300);
  try{fetch('/api/stats/hit',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,credentials:'same-origin'}).catch(()=>{})}catch{/* sin conexión */}
}
export function track(k){
  if(typeof window==='undefined'||!k)return;
  queue.push({k:String(k).slice(0,160),u:firstToday(k)});
  if(!timer)timer=setTimeout(send,1500);
}
// Antes de cerrar la pestaña se envía lo que quede
if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{if(timer){clearTimeout(timer);send()}});

// Una vez por visita: cuenta la visita, el tipo de dispositivo y de dónde llegó
export function trackVisit(){
  try{if(sessionStorage.getItem(SESSION_KEY))return;sessionStorage.setItem(SESSION_KEY,'1')}catch{/* igual se cuenta */}
  track('visita');
  const w=Math.min(window.screen?.width||window.innerWidth,window.innerWidth);
  track(`device:${w<768?'movil':w<1100?'tablet':'computador'}`);
  let source='directo';
  try{const ref=document.referrer&&new URL(document.referrer);if(ref&&ref.host!==location.host)source=ref.hostname.replace(/^(www|m|l|lm)\./,'')}catch{/* referencia rara */}
  track(`source:${source}`);
}

// Términos de búsqueda: en minúsculas y sin espacios de más, para juntar «Cine» y «cine »
export const searchTerm=q=>String(q||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,80);
