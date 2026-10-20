import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, Layers, RemoveFormatting, Underline } from 'lucide-react';
import { formatRange, insertAt, normalizeRuns, rangeFormat, runStyleCss, runsOf, runsText } from '../rich-text';

/* Texto de la ficha que se escribe directo sobre la vista previa, con formato por letra como en Word: se
   seleccionan letras y se ponen en negrita, cursiva, subrayado o de otro tamaño (en puntos); la alineación
   (izquierda, centro, derecha o justificado) vale para todo el texto. La barra flota encima del texto.
   El texto se dibuja a mano dentro de un contentEditable (un <span> por tramo) y después de cada cambio se
   vuelve a leer para saber qué quedó escrito. */
const WORD_SIZES=[8,9,10,10.5,11,12,14,16,18,20,22,24,26,28,36,48,72];
const ptLabel=pt=>pt==null?'':String(Math.round(pt*2)/2).replace('.',',');
const MARK_BUTTONS=[['b',Bold,'Negrita','Ctrl+B'],['i',Italic,'Cursiva','Ctrl+I'],['u',Underline,'Subrayado','Ctrl+U']];
const ALIGN_BUTTONS=[['left',AlignLeft,'Alinear a la izquierda'],['center',AlignCenter,'Centrar'],['right',AlignRight,'Alinear a la derecha'],['justify',AlignJustify,'Justificar']];

// Dibuja los tramos dentro del texto
function paint(el,runs){
  el.textContent='';
  for(const r of runs){
    const span=el.ownerDocument.createElement('span');
    span.dataset.run='';
    ['b','i','u'].forEach(k=>{if(r[k])span.dataset[k]=''});
    if(r.s&&r.s!==1)span.dataset.s=String(r.s);
    Object.assign(span.style,runStyleCss(r));
    span.textContent=r.t;
    el.appendChild(span);
  }
}

// Lee lo escrito: cada letra con el formato del tramo en el que quedó. Los saltos que agregue el navegador (<br>, <div>) pasan a \n
function read(el){
  const runs=[];
  const fmt=node=>{const s=node.parentElement?.closest('[data-run]');if(!s||!el.contains(s))return {};const d=s.dataset;return {b:'b' in d,i:'i' in d,u:'u' in d,s:d.s?Number(d.s):1}};
  const walk=(node,first)=>{
    for(const n of node.childNodes){
      if(n.nodeType===3)runs.push({...fmt(n),t:n.nodeValue});
      else if(n.nodeName==='BR'){if(n!==el.lastChild)runs.push({...fmt(n),t:'\n'})}
      else{if(/^(DIV|P)$/.test(n.nodeName)&&(runs.length||!first))runs.push({t:'\n'});walk(n,false)}
    }
  };
  walk(el,true);
  return runs;
}
const messy=el=>!!el.querySelector('br,div,p')||[...el.childNodes].some(n=>n.nodeType===3);

// Posición (en letras) de un punto de la selección, y al revés
function offsetOf(el,node,offset){
  const r=el.ownerDocument.createRange();r.setStart(el,0);r.setEnd(node,offset);return r.toString().length;
}
function selectionIn(el){
  const sel=el.ownerDocument.getSelection();
  if(!sel?.rangeCount)return null;
  const r=sel.getRangeAt(0);
  if(!el.contains(r.startContainer)||!el.contains(r.endContainer))return null;
  return [offsetOf(el,r.startContainer,r.startOffset),offsetOf(el,r.endContainer,r.endOffset)];
}
function select(el,[start,end]){
  const doc=el.ownerDocument, walker=doc.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  const point=pos=>{let n,left=pos,last=null;while((n=walker.nextNode())){last=n;if(left<=n.nodeValue.length)return [n,left];left-=n.nodeValue.length}return last?[last,last.nodeValue.length]:[el,0]};
  const a=point(start);walker.currentNode=el;const b=point(end);
  const r=doc.createRange();r.setStart(...a);r.setEnd(...b);
  const sel=doc.getSelection();sel.removeAllRanges();sel.addRange(r);
}

// Posición de la barra en la pantalla del gestor: encima del texto (o debajo si no cabe), aunque esté dentro del iframe achicado
function useToolbarPlace(editRef,barRef){
  const [pos,setPos]=useState(null);
  useLayoutEffect(()=>{
    const place=()=>{
      const el=editRef.current;if(!el)return;
      const frame=el.ownerDocument.defaultView.frameElement, fr=frame?frame.getBoundingClientRect():{left:0,top:0}, scale=frame?.offsetWidth?fr.width/frame.offsetWidth:1;
      const r=el.getBoundingClientRect(), h=barRef.current?.offsetHeight||44, w=barRef.current?.offsetWidth||420;
      const top=fr.top+r.top*scale, bottom=fr.top+r.bottom*scale, left=fr.left+r.left*scale;
      setPos({left:Math.max(8,Math.min(left,window.innerWidth-w-8)),top:top-h-8>=8?top-h-8:Math.min(bottom+8,window.innerHeight-h-8)});
    };
    place();
    const views=[window,editRef.current?.ownerDocument.defaultView].filter((v,i,a)=>v&&a.indexOf(v)===i);
    views.forEach(v=>{v.addEventListener('scroll',place,true);v.addEventListener('resize',place)});
    const ro=new ResizeObserver(place);if(editRef.current)ro.observe(editRef.current);
    return()=>{views.forEach(v=>{v.removeEventListener('scroll',place,true);v.removeEventListener('resize',place)});ro.disconnect()};
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  return pos;
}

export function RichInline({value,runs,onChange,align,defaultAlign='left',onAlign,multiline=false,basePx=16,label,placeholder,onDone,onCancel,onGroup,groupLabel}){
  const editRef=useRef(null), barRef=useRef(null), model=useRef(runsOf(runs,value)), saved=useRef([0,0]);
  const [state,setState]=useState({sel:[0,0],fmt:{s:1}});
  const pos=useToolbarPlace(editRef,barRef);
  const basePt=basePx*.75;
  const emit=list=>{model.current=list;onChange(runsText(list),normalizeRuns(list))};
  const refresh=()=>{const s=selectionIn(editRef.current);if(s)saved.current=s;const [a,b]=saved.current;setState({sel:[a,b],fmt:rangeFormat(model.current,a,b)})};
  // Vuelve a dibujar después de un cambio de formato y deja elegidas las mismas letras
  const repaint=(list,sel=saved.current)=>{emit(list);paint(editRef.current,list);editRef.current.focus();select(editRef.current,sel);saved.current=sel;setState({sel,fmt:rangeFormat(list,...sel)})};

  // Al empezar, el cursor queda al final del texto
  useLayoutEffect(()=>{paint(editRef.current,model.current);editRef.current.focus();const n=runsText(model.current).length;select(editRef.current,[n,n]);saved.current=[n,n];refresh()},[]);// eslint-disable-line react-hooks/exhaustive-deps
  const done=useRef(onDone);done.current=onDone;
  useEffect(()=>{
    const doc=editRef.current.ownerDocument, on=()=>{if(selectionIn(editRef.current))refresh()};
    // Un clic fuera del texto y de la barra termina la edición (el texto y la barra pueden estar en documentos distintos)
    const outside=e=>{if(!editRef.current?.contains(e.target)&&!barRef.current?.contains(e.target))done.current()};
    const docs=[doc,document].filter((d,i,a)=>a.indexOf(d)===i);
    doc.addEventListener('selectionchange',on);docs.forEach(d=>d.addEventListener('pointerdown',outside,true));
    return()=>{doc.removeEventListener('selectionchange',on);docs.forEach(d=>d.removeEventListener('pointerdown',outside,true))};
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  const onInput=()=>{
    const el=editRef.current, list=read(el);
    if(messy(el)){const s=selectionIn(el);paint(el,list);if(s)select(el,s)}
    emit(list);refresh();
  };
  const [a,b]=state.sel, empty=a===b, fmt=state.fmt;
  const toggle=k=>{if(empty)return;const [x,y]=saved.current;repaint(formatRange(model.current,x,y,{[k]:!rangeFormat(model.current,x,y)[k]}))};
  const setPt=pt=>{const [x,y]=saved.current;if(x===y)return;const s=Math.round(Math.min(400,Math.max(1,pt))/basePt*1000)/1000;repaint(formatRange(model.current,x,y,{s:Math.abs(s-1)<.005?1:s}))};
  const clear=()=>{const [x,y]=saved.current;if(x===y)return;repaint(formatRange(model.current,x,y,{b:0,i:0,u:0,s:1}))};
  const insert=text=>{const s=selectionIn(editRef.current)||saved.current, p=s[0]+text.length;repaint(insertAt(model.current,s[0],s[1],text),[p,p])};
  const back=()=>{editRef.current.focus();select(editRef.current,saved.current)};

  const pt=fmt.s==null?null:basePt*fmt.s, cur=pt==null?null:Math.round(pt*2)/2;
  const [ptText,setPtText]=useState('');
  useEffect(()=>setPtText(ptLabel(pt)),[pt]);
  const commitPt=()=>{const p=parseFloat(String(ptText).replace(',','.'));if(Number.isFinite(p)&&p>0&&p!==cur)setPt(p);else setPtText(ptLabel(pt))};
  const bigger=cur==null?null:WORD_SIZES.find(s=>s>cur), smaller=cur==null?null:[...WORD_SIZES].reverse().find(s=>s<cur);
  const keep=e=>e.preventDefault();
  const current=align||defaultAlign;

  return <>
    <span ref={editRef} className="cms-rich-inline" contentEditable suppressContentEditableWarning role="textbox" aria-multiline={multiline} aria-label={label||placeholder} data-placeholder={placeholder}
      style={align?{textAlign:align}:undefined}
      onClick={e=>{e.preventDefault();e.stopPropagation()}}
      onInput={onInput}
      onPaste={e=>{e.preventDefault();const t=e.clipboardData.getData('text/plain');insert(multiline?t.replace(/\r/g,''):t.replace(/[\r\n]+/g,' '))}}
      onDrop={e=>e.preventDefault()}
      onKeyDown={e=>{
        const mod=e.ctrlKey||e.metaKey, k=e.key.toLowerCase();
        if(mod&&['b','i','u'].includes(k)){e.preventDefault();toggle(k);return}
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onCancel();return}
        if(e.key==='Enter'){e.preventDefault();if(multiline&&!mod)insert('\n');else onDone()}
      }}/>
    {createPortal(<div ref={barRef} className="cms-rich-bar" style={pos||{visibility:'hidden'}} role="toolbar" aria-label={`Formato · ${label||'Texto'}`}>
      {MARK_BUTTONS.map(([k,Icon,name,keys])=><button key={k} type="button" className={fmt[k]&&!empty?'is-on':''} aria-pressed={!!fmt[k]&&!empty} disabled={empty} onMouseDown={keep} onClick={()=>toggle(k)} title={`${name} (${keys}) · selecciona letras primero`} aria-label={name}><Icon/></button>)}
      <span className="cms-rich-sep"/>
      <button type="button" disabled={empty||(cur!=null&&cur<=1)} onMouseDown={keep} onClick={()=>setPt(smaller??Math.max(1,(cur??basePt)-1))} title="Achicar las letras elegidas" aria-label="Achicar">A−</button>
      <label className="cms-rich-size" title="Tamaño en puntos de las letras elegidas">
        <input type="text" inputMode="decimal" list="cms-rich-sizes" value={empty?'':ptText} placeholder={empty?'':'—'} disabled={empty} aria-label="Tamaño en puntos"
          onChange={e=>setPtText(e.target.value)} onBlur={commitPt} onFocus={e=>e.target.select()}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commitPt();back()}if(e.key==='Escape'){e.stopPropagation();setPtText(ptLabel(pt));back()}}}/>
        <span>pt</span>
      </label>
      <datalist id="cms-rich-sizes">{WORD_SIZES.map(s=><option key={s} value={ptLabel(s)}/>)}</datalist>
      <button type="button" disabled={empty||(cur!=null&&cur>=400)} onMouseDown={keep} onClick={()=>setPt(bigger??Math.min(400,(cur??basePt)+1))} title="Agrandar las letras elegidas" aria-label="Agrandar">A+</button>
      {onAlign&&<><span className="cms-rich-sep"/>
        {ALIGN_BUTTONS.map(([k,Icon,name])=><button key={k} type="button" className={current===k?'is-on':''} aria-pressed={current===k} onMouseDown={keep} onClick={()=>{onAlign(k===defaultAlign?undefined:k);back()}} title={name} aria-label={name}><Icon/></button>)}</>}
      <span className="cms-rich-sep"/>
      <button type="button" disabled={empty} onMouseDown={keep} onClick={clear} title="Quitar el formato de las letras elegidas" aria-label="Quitar formato"><RemoveFormatting/></button>
      {onGroup&&<><span className="cms-rich-sep"/>
        <button type="button" className="cms-rich-group" onMouseDown={keep} onClick={onGroup} title={`Cambiar el formato de todos los textos de «${groupLabel}» juntos`}><Layers/> Todos</button></>}
    </div>,document.body)}
  </>;
}

/* Formato de un grupo de textos de la ficha (todos los títulos de la filmografía, todos los cargos, una etiqueta…):
   se abre con un clic sobre un texto que no se escribe ahí mismo, y cambia todos los textos del grupo juntos.
   Se guarda en extra.fontStyle, extra.fontScale y extra.fontAlign (ver useFz). */
const GROUP_MARKS=[['b',Bold,'Negrita'],['i',Italic,'Cursiva'],['u',Underline,'Subrayado']];
export function GroupFormatBar({group,e,setE,onClose}){
  const {key,label,base=16,el}=group, barRef=useRef(null), anchor=useRef(el);
  anchor.current=el?.isConnected?el:el?.ownerDocument.querySelector(`[data-fz="${CSS.escape(key)}"]`);
  const pos=useToolbarPlace(anchor,barRef);
  const styles=e.fontStyle||{}, scales=e.fontScale||{}, aligns=e.fontAlign||{};
  const marks=styles[key]||'', scale=scales[key]||1, align=aligns[key];
  const keyed=(map,v)=>{const next={...map};if(v)next[key]=v;else delete next[key];return Object.keys(next).length?next:undefined};
  const toggle=k=>setE({fontStyle:keyed(styles,MARKS_ORDER.filter(x=>x===k?!marks.includes(x):marks.includes(x)).join(''))});
  const basePt=base*.75, pt=basePt*scale, cur=Math.round(pt*2)/2;
  const setPt=p=>{const s=Math.round(Math.min(400,Math.max(1,p))/basePt*1000)/1000;setE({fontScale:keyed(scales,Math.abs(s-1)<.005?undefined:s)})};
  const [ptText,setPtText]=useState(ptLabel(pt));
  useEffect(()=>setPtText(ptLabel(pt)),[key,pt]);
  const commitPt=()=>{const p=parseFloat(String(ptText).replace(',','.'));if(Number.isFinite(p)&&p>0&&p!==cur)setPt(p);else setPtText(ptLabel(pt))};
  const bigger=WORD_SIZES.find(s=>s>cur), smaller=[...WORD_SIZES].reverse().find(s=>s<cur);
  const changed=!!(marks||scale!==1||align);
  const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const doc=el?.ownerDocument||document;
    const outside=ev=>{if(!barRef.current?.contains(ev.target)&&!ev.target.closest?.(`[data-fz="${CSS.escape(key)}"]`))close.current()};
    const esc=ev=>{if(ev.key==='Escape')close.current()};
    const docs=[doc,document].filter((d,i,a)=>a.indexOf(d)===i);
    docs.forEach(d=>{d.addEventListener('pointerdown',outside,true);d.addEventListener('keydown',esc)});
    return()=>docs.forEach(d=>{d.removeEventListener('pointerdown',outside,true);d.removeEventListener('keydown',esc)});
  },[key]);// eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(<div ref={barRef} className="cms-rich-bar is-group" style={pos||{visibility:'hidden'}} role="toolbar" aria-label={`Formato de «${label||key}»`}>
    <span className="cms-rich-name" title="Cambia todos los textos de este grupo juntos">{label||key}</span>
    {GROUP_MARKS.map(([k,Icon,name])=><button key={k} type="button" className={marks.includes(k)?'is-on':''} aria-pressed={marks.includes(k)} onClick={()=>toggle(k)} title={name} aria-label={name}><Icon/></button>)}
    <span className="cms-rich-sep"/>
    <button type="button" disabled={cur<=1} onClick={()=>setPt(smaller??Math.max(1,cur-1))} title="Achicar" aria-label="Achicar">A−</button>
    <label className="cms-rich-size" title="Tamaño en puntos">
      <input type="text" inputMode="decimal" list="cms-rich-sizes" value={ptText} aria-label="Tamaño en puntos"
        onChange={ev=>setPtText(ev.target.value)} onBlur={commitPt} onFocus={ev=>ev.target.select()}
        onKeyDown={ev=>{if(ev.key==='Enter'){ev.preventDefault();commitPt()}if(ev.key==='Escape'){ev.stopPropagation();setPtText(ptLabel(pt))}}}/>
      <span>pt</span>
    </label>
    <datalist id="cms-rich-sizes">{WORD_SIZES.map(s=><option key={s} value={ptLabel(s)}/>)}</datalist>
    <button type="button" disabled={cur>=400} onClick={()=>setPt(bigger??Math.min(400,cur+1))} title="Agrandar" aria-label="Agrandar">A+</button>
    <span className="cms-rich-sep"/>
    {ALIGN_BUTTONS.map(([k,Icon,name])=><button key={k} type="button" className={align===k?'is-on':''} aria-pressed={align===k} onClick={()=>setE({fontAlign:keyed(aligns,align===k?undefined:k)})} title={name} aria-label={name}><Icon/></button>)}
    <span className="cms-rich-sep"/>
    <button type="button" disabled={!changed} onClick={()=>setE({fontStyle:keyed(styles),fontScale:keyed(scales),fontAlign:keyed(aligns)})} title="Volver al formato original" aria-label="Quitar formato"><RemoveFormatting/></button>
  </div>,document.body);
}
const MARKS_ORDER=['b','i','u'];
