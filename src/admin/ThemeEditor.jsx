import React, { useState } from 'react';
import { Check, RotateCcw, TriangleAlert } from 'lucide-react';
import { theme } from '../data';
import { originalTheme, saveTheme, useStoreVersion } from '../store';
import { EditorShell, PanelBlock, useAdminNav } from './AdminApp';
import { SiteFrame } from './SiteFrame';
import { useUi } from './fields';

const MAIN=[
  ['acid','Acento','Botones, destacados y detalles vivos'],
  ['forest','Principal','Fondos oscuros, menú y secciones'],
  ['black','Tinta','Textos y fondos negros'],
  ['paper','Papel','Fondo general de las páginas']
];
const PALETTE_NAMES=['Etiqueta 1','Etiqueta 2','Etiqueta 3','Etiqueta 4','Etiqueta 5'];
const PRESETS=[
  {name:'Original',acid:'#d9ff43',forest:'#123c2f',black:'#101210',paper:'#f2f0e9',palette:['#d9ff43','#8ee6c4','#ffc3d8','#ffdc72','#b8c8ff']},
  {name:'Cobre',acid:'#ffb347',forest:'#3b1f14',black:'#1a1210',paper:'#f5efe6',palette:['#ffb347','#f4a28c','#e9d38c','#b5d6a7','#c8b6e2']},
  {name:'Océano',acid:'#6ff2e4',forest:'#0d2c4a',black:'#0b1320',paper:'#eef3f6',palette:['#6ff2e4','#9cc9ff','#ffd28a','#ffb3c7','#c3f28c']},
  {name:'Cereza',acid:'#ff8fb8',forest:'#3a0f24',black:'#160b10',paper:'#f7eff1',palette:['#ff8fb8','#ffc98a','#b8e0d2','#d6c1ff','#f7e36f']},
  {name:'Sobrio',acid:'#e9dcb5',forest:'#23282a',black:'#121416',paper:'#f3f2ee',palette:['#e9dcb5','#c9d8c5','#e7c6c0','#c7d3e3','#e3d3a5']},
  {name:'Violeta',acid:'#c6ff6b',forest:'#2b1a4a',black:'#120d1c',paper:'#f3f0f7',palette:['#c6ff6b','#b7a4ff','#ffb0d5','#ffd97a','#8ee6d6']}
];

// Contraste WCAG entre dos colores
const lum=hex=>{
  const n=parseInt(hex.slice(1),16), ch=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});
  return .2126*ch[0]+.7152*ch[1]+.0722*ch[2];
};
const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
const isHex=v=>/^#[0-9a-f]{6}$/i.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function ColorField({label,hint,value,onChange}){
  const [text,setText]=useState(value);
  const [prev,setPrev]=useState(value);
  if(prev!==value){setPrev(value);setText(value)}
  return <div className="cms-color-field">
    <label className="cms-color-swatch" style={{background:value}}><input type="color" value={value} onChange={e=>onChange(e.target.value)} aria-label={label}/></label>
    <span><strong>{label}</strong>{hint&&<small>{hint}</small>}</span>
    <input className="cms-color-hex" value={text} spellCheck={false} maxLength={7} aria-label={`${label} en hexadecimal`}
      onChange={e=>{let v=e.target.value.trim();if(!v.startsWith('#'))v=`#${v}`;setText(v);if(isHex(v))onChange(v.toLowerCase())}} onBlur={()=>setText(value)}/>
  </div>;
}

export function ThemeEditor(){
  useStoreVersion();
  const {go,setDirty:setNavDirty}=useAdminNav(), {toast,confirm}=useUi();
  const [draft,setDraft]=useState(()=>structuredClone(theme));
  const dirty=!same(draft,theme);
  const set=patch=>setDraft(d=>({...d,...patch}));
  const setPal=(i,v)=>set({palette:draft.palette.map((c,j)=>j===i?v:c)});

  const save=async()=>{
    try{await saveTheme(draft)}catch{return toast('No se pudieron guardar los colores.','error')}
    setNavDirty(false);toast('Colores aplicados en todo el sitio.');
  };
  const discard=async()=>{if(await confirm({title:'¿Descartar los colores nuevos?',ok:'Descartar'}))setDraft(structuredClone(theme))};

  const checks=[
    ['Texto sobre botones de acento',draft.black,draft.acid,4.5],
    ['Texto blanco sobre color principal',draft.forest,'#ffffff',4.5],
    ['Texto sobre el papel',draft.black,draft.paper,7],
    ['Acento sobre color principal',draft.acid,draft.forest,3]
  ].map(([label,a,b,min])=>({label,a,b,ratio:contrast(a,b),min}));
  const vars={'--acid':draft.acid,'--forest':draft.forest,'--black':draft.black,'--paper':draft.paper};

  const panel=<>
    <PanelBlock title="Combinaciones">
      <div className="cms-presets">{PRESETS.map(p=>{const {name,...colors}=p, on=same(colors,draft);return <button key={name} type="button" className={on?'active':''} onClick={()=>setDraft(structuredClone(colors))}>
        <i>{[p.forest,p.acid,p.paper,p.black].map(c=><b key={c} style={{background:c}}/>)}</i><span>{name}</span>{on&&<Check/>}
      </button>})}</div>
    </PanelBlock>
    <PanelBlock title="Colores principales">
      {MAIN.map(([k,label,hint])=><ColorField key={k} label={label} hint={hint} value={draft[k]} onChange={v=>set({[k]:v})}/>)}
    </PanelBlock>
    <PanelBlock title="Etiquetas de fichas y colecciones">
      <p className="cms-help">Al cambiar un color, las fichas y colecciones que lo usaban se actualizan.</p>
      {draft.palette.map((c,i)=><ColorField key={i} label={PALETTE_NAMES[i]} value={c} onChange={v=>setPal(i,v)}/>)}
      <div className="cms-tag-preview">{['Película','Persona','Prensa','Entrevista','Artículo'].map((t,i)=><span key={t} style={{background:draft.palette[[1,2,3,0,4][i]],color:draft.black}}>{t}</span>)}</div>
    </PanelBlock>
    <PanelBlock title="Legibilidad">
      <ul className="cms-contrast">{checks.map(c=>{const ok=c.ratio>=c.min;return <li key={c.label} className={ok?'':'is-bad'}>
        <i style={{background:c.b,color:c.a}}>Aa</i><span>{c.label}<small>{c.ratio.toFixed(1)} : 1 {ok?'· buena':`· baja, se recomienda ${c.min}:1`}</small></span>{ok?<Check/>:<TriangleAlert/>}
      </li>})}</ul>
    </PanelBlock>
    <PanelBlock title="Original">
      <button type="button" className="cms-btn is-ghost is-block" onClick={()=>setDraft(originalTheme())}><RotateCcw/> Volver a los colores originales</button>
    </PanelBlock>
  </>;

  return <EditorShell crumb="Sitio · Apariencia" title="Colores de la app" dirty={dirty} onBack={()=>go('/admin')} onSave={save} onDiscard={discard} viewHref="/" panel={panel}
    hint="Vista previa del sitio con los colores elegidos. Se aplican a todo el sitio y al gestor al guardar.">
    <div className="cms-theme-preview" style={vars}>
      <div className="cms-theme-strip">
        <span style={{background:draft.forest}}/><span style={{background:draft.acid}}/><span style={{background:draft.black}}/><span style={{background:draft.paper}}/>
        {draft.palette.map((c,i)=><span key={i} style={{background:c}} className="is-small"/>)}
      </div>
      <SiteFrame className="is-theme" vars={vars}/>
    </div>
  </EditorShell>;
}
