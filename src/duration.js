/* Duración de las películas: se escribe como se quiera («10», «90 minutos», «1:30», «1 h 30») y se
   guarda siempre igual («10 min», «1 hora», «1 h 30 min»). De los minutos sale el metraje. */

// Minutos de un texto de duración; 0 si no se reconoce
export function durationMinutes(text){
  const s=String(text||'').toLowerCase().replace(',','.').trim();
  if(!s)return 0;
  const clock=/^(\d+):(\d{1,2})$/.exec(s);
  if(clock)return Number(clock[1])*60+Number(clock[2]);
  // «1 h 30», «1h30»: los minutos después de la hora no llevan unidad
  const hm=/^(\d+)\s*h[a-z]*\s*(\d+)$/.exec(s);
  if(hm)return Number(hm[1])*60+Number(hm[2]);
  const h=/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hora|horas)\b/.exec(s), m=/(\d+)\s*(?:m|min|mins|minuto|minutos)\b/.exec(s);
  if(h||m)return Math.round((h?Number(h[1])*60:0)+(m?Number(m[1]):0));
  return /^\d+$/.test(s)?Number(s):0;
}

// Texto con el formato del archivo; si no se reconoce, queda tal cual
export function formatDuration(text){
  const total=durationMinutes(text);
  if(!total)return String(text||'').trim();
  if(total<60)return `${total} min`;
  const h=Math.floor(total/60), m=total%60;
  return m?`${h} h ${m} min`:`${h} ${h===1?'hora':'horas'}`;
}

// Categorías de metraje según los minutos
export const METRAJES=[
  {label:'Cortometraje',hint:'menos de 30 min',test:m=>m<30},
  {label:'Mediometraje',hint:'30 a 59 min',test:m=>m>=30&&m<60},
  {label:'Largometraje',hint:'60 min o más',test:m=>m>=60}
];
export const metrajeOfDuration=text=>{const m=durationMinutes(text);return m?METRAJES.find(x=>x.test(m))?.label:undefined};

// Contenido completo con todas las duraciones en el formato del archivo (películas y cargos «Duración»).
// Devuelve el mismo objeto si no había nada que cambiar.
export function normalizeDurations(data){
  if(!data||!Array.isArray(data.records))return data;
  let changed=false;
  const fix=v=>{if(typeof v!=='string')return v;const n=formatDuration(v);if(n!==v)changed=true;return n};
  const records=data.records.map(r=>{
    if(r?.type!=='Película'||!r.format)return r;
    const parts=String(r.format).split(' · ');
    if(parts.length<2)return r;
    parts[1]=fix(parts[1]);
    return {...r,format:parts.join(' · ')};
  });
  const recordExtras=Object.fromEntries(Object.entries(data.recordExtras||{}).map(([id,e])=>[id,Array.isArray(e?.credits)?{...e,credits:e.credits.map(c=>Array.isArray(c)&&c[0]==='Duración'?[c[0],fix(c[1])]:c)}:e]));
  return changed?{...data,records,...(data.recordExtras?{recordExtras}:{})}:data;
}
