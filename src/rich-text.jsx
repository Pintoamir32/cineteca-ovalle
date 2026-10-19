import React from 'react';

/* Formato por letra (negrita, cursiva, subrayado y tamaño) de los textos de una ficha.
   El texto se sigue guardando tal cual (listados, buscador y tarjetas no cambian); el formato va aparte
   como «tramos»: [{t:'texto', b, i, u, s}], donde s es el tamaño respecto del texto original (1,5 = 50 % más grande).
   Los tramos solo valen si, juntos, dicen exactamente el texto guardado: si el texto se cambió por otro lado,
   el formato se ignora y se muestra el texto sin formato. */
export const MARKS=['b','i','u'];
const same=(a,b)=>MARKS.every(k=>!!a[k]===!!b[k])&&(a.s||1)===(b.s||1);
const plain=r=>MARKS.every(k=>!r[k])&&(r.s||1)===1;
const clean=r=>{const out={t:r.t};MARKS.forEach(k=>{if(r[k])out[k]=1});if(r.s&&r.s!==1)out.s=r.s;return out};

export const runsText=runs=>(runs||[]).map(r=>r.t).join('');

// Junta los tramos seguidos con el mismo formato y quita los vacíos; sin ningún formato devuelve undefined
export function normalizeRuns(runs){
  const out=[];
  for(const r of runs||[]){
    if(!r.t)continue;
    const last=out[out.length-1];
    if(last&&same(last,r))last.t+=r.t;else out.push(clean(r));
  }
  return out.some(r=>!plain(r))?out:undefined;
}

export const validRuns=(runs,text)=>Array.isArray(runs)&&runs.length&&runsText(runs)===String(text??'')?runs:null;

// Corta los tramos en las posiciones start y end (en letras) y devuelve [antes, dentro, después]
function cut(runs,start,end){
  const before=[], inside=[], after=[];let pos=0;
  for(const r of runs){
    const a=pos, b=pos+r.t.length;pos=b;
    if(b<=start){before.push(r);continue}
    if(a>=end){after.push(r);continue}
    if(a<start)before.push({...r,t:r.t.slice(0,start-a)});
    inside.push({...r,t:r.t.slice(Math.max(0,start-a),Math.min(r.t.length,end-a))});
    if(b>end)after.push({...r,t:r.t.slice(end-a)});
  }
  return [before,inside,after];
}

export const runsOf=(runs,text)=>validRuns(runs,text)||[{t:String(text??'')}];
// Parte del texto (de start a end) con su formato
export const sliceRuns=(runs,start,end)=>cut(runs,start,end)[1];

// Aplica un cambio de formato a las letras entre start y end
export function formatRange(runs,start,end,patch){
  const [before,inside,after]=cut(runs,start,end);
  return [...before,...inside.map(r=>({...r,...patch})),...after];
}

// Formato que tienen todas las letras del tramo elegido (para marcar los botones)
export function rangeFormat(runs,start,end){
  const [,inside]=start===end?cut(runs,Math.max(0,start-1),start):cut(runs,start,end);
  const list=inside.filter(r=>r.t);
  if(!list.length)return {s:1};
  const out={};MARKS.forEach(k=>{out[k]=list.every(r=>r[k])});
  const sizes=[...new Set(list.map(r=>r.s||1))];out.s=sizes.length===1?sizes[0]:null;
  return out;
}

// Escribe texto en una posición: toma el formato de la letra anterior
export function insertAt(runs,start,end,text){
  const [before,,after]=cut(runs,start,end);
  const ref=before[before.length-1]||after[0]||{};
  return [...before,{...ref,t:text},...after];
}

const runStyle=r=>({...(r.b&&{fontWeight:800}),...(r.i&&{fontStyle:'italic'}),...(r.u&&{textDecoration:'underline',textUnderlineOffset:'.15em'}),...(r.s&&r.s!==1&&{fontSize:`${r.s}em`})});
export const runStyleCss=runStyle;

// Muestra los tramos; con br los saltos de línea pasan a <br/> (si no, quedan como texto)
export function renderRuns(runs,{br=false}={}){
  return runs.map((r,i)=>{
    const parts=br?r.t.split('\n').flatMap((l,j)=>j?[<br key={`b${j}`}/>,l]:[l]):r.t;
    return plain(r)?<React.Fragment key={i}>{parts}</React.Fragment>:<span key={i} className="rt" style={runStyle(r)}>{parts}</span>;
  });
}

// Texto con su formato si lo tiene y sigue siendo el mismo; si no, el texto tal cual. Con align, en su propio bloque alineado
export const richOr=(runs,text,{align,...opts}={})=>{
  const ok=validRuns(runs,text), out=ok?renderRuns(ok,opts):text;
  return align&&String(text??'').trim()?<span className="rt-align" style={{textAlign:align}}>{out}</span>:out;
};
