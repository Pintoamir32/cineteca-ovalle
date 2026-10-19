import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bold, Italic, RemoveFormatting, Underline } from 'lucide-react';
import { formatRange, insertAt, normalizeRuns, rangeFormat, runStyleCss, runsOf, runsText } from '../rich-text';

/* Cuadro para escribir un texto de la ficha con formato por letra, como en Word: se seleccionan letras y
   se ponen en negrita, cursiva, subrayado o de otro tamaño (en puntos). El texto se dibuja a mano dentro de un
   contentEditable (un <span> por tramo) y después de cada cambio se vuelve a leer para saber qué quedó escrito. */
const WORD_SIZES=[8,9,10,10.5,11,12,14,16,18,20,22,24,26,28,36,48,72];
const ptLabel=pt=>pt==null?'':String(Math.round(pt*2)/2).replace('.',',');
const MARK_BUTTONS=[['b',Bold,'Negrita','Ctrl+B'],['i',Italic,'Cursiva','Ctrl+I'],['u',Underline,'Subrayado','Ctrl+U']];

// Dibuja los tramos dentro del cuadro
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

export function RichEditBox({value,runs,onChange,multiline=false,basePx=16,label,placeholder,onDone,onCancel}){
  const boxRef=useRef(null), editRef=useRef(null), model=useRef(runsOf(runs,value)), saved=useRef([0,0]);
  const [state,setState]=useState({sel:[0,0],fmt:{s:1}});
  const basePt=basePx*.75;
  const emit=list=>{model.current=list;onChange(runsText(list),normalizeRuns(list))};
  const refresh=()=>{const s=selectionIn(editRef.current);if(s)saved.current=s;const [a,b]=saved.current;setState({sel:[a,b],fmt:rangeFormat(model.current,a,b)})};
  // Vuelve a dibujar después de un cambio de formato y deja elegidas las mismas letras
  const repaint=(list,sel=saved.current)=>{emit(list);paint(editRef.current,list);editRef.current.focus();select(editRef.current,sel);saved.current=sel;setState({sel,fmt:rangeFormat(list,...sel)})};

  useLayoutEffect(()=>{paint(editRef.current,model.current);editRef.current.focus();const n=runsText(model.current).length;select(editRef.current,[0,n]);saved.current=[0,n];refresh()},[]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const doc=editRef.current.ownerDocument, on=()=>{if(selectionIn(editRef.current))refresh()};
    doc.addEventListener('selectionchange',on);return()=>doc.removeEventListener('selectionchange',on);
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
  const insert=text=>{const s=selectionIn(editRef.current)||saved.current, pos=s[0]+text.length;repaint(insertAt(model.current,s[0],s[1],text),[pos,pos])};

  const pt=fmt.s==null?null:basePt*fmt.s, cur=pt==null?null:Math.round(pt*2)/2;
  const [ptText,setPtText]=useState('');
  useEffect(()=>setPtText(ptLabel(pt)),[pt]);
  const commitPt=()=>{const p=parseFloat(String(ptText).replace(',','.'));if(Number.isFinite(p)&&p>0&&p!==cur)setPt(p);else setPtText(ptLabel(pt))};
  const bigger=cur==null?null:WORD_SIZES.find(s=>s>cur), smaller=cur==null?null:[...WORD_SIZES].reverse().find(s=>s<cur);
  const keep=e=>e.preventDefault();

  return <div ref={boxRef} className="cms-rich" onBlur={e=>{if(!boxRef.current.contains(e.relatedTarget))onDone()}}>
    <div className="cms-rich-tools" role="toolbar" aria-label="Formato de las letras elegidas">
      {MARK_BUTTONS.map(([k,Icon,name,keys])=><button key={k} type="button" className={fmt[k]&&!empty?'is-on':''} aria-pressed={!!fmt[k]&&!empty} disabled={empty} onMouseDown={keep} onClick={()=>toggle(k)} title={`${name} (${keys})`} aria-label={name}><Icon/></button>)}
      <span className="cms-rich-sep"/>
      <button type="button" disabled={empty||(cur!=null&&cur<=1)} onMouseDown={keep} onClick={()=>setPt(smaller??Math.max(1,(cur??basePt)-1))} title="Achicar" aria-label="Achicar">A−</button>
      <label className="cms-rich-size" title="Tamaño en puntos">
        <input type="text" inputMode="decimal" list="cms-rich-sizes" value={empty?'':ptText} placeholder={empty?'':'—'} disabled={empty} aria-label="Tamaño en puntos"
          onChange={e=>setPtText(e.target.value)} onBlur={commitPt} onFocus={e=>e.target.select()}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commitPt()}if(e.key==='Escape'){e.stopPropagation();setPtText(ptLabel(pt));editRef.current.focus();select(editRef.current,saved.current)}}}/>
        <span>pt</span>
      </label>
      <datalist id="cms-rich-sizes">{WORD_SIZES.map(s=><option key={s} value={ptLabel(s)}/>)}</datalist>
      <button type="button" disabled={empty||(cur!=null&&cur>=400)} onMouseDown={keep} onClick={()=>setPt(bigger??Math.min(400,(cur??basePt)+1))} title="Agrandar" aria-label="Agrandar">A+</button>
      <span className="cms-rich-sep"/>
      <button type="button" disabled={empty} onMouseDown={keep} onClick={clear} title="Quitar el formato de las letras elegidas" aria-label="Quitar formato"><RemoveFormatting/></button>
    </div>
    <div ref={editRef} className="cms-rich-text" contentEditable suppressContentEditableWarning role="textbox" aria-multiline={multiline} aria-label={label||placeholder} data-placeholder={placeholder}
      onInput={onInput}
      onPaste={e=>{e.preventDefault();const t=e.clipboardData.getData('text/plain');insert(multiline?t.replace(/\r/g,''):t.replace(/[\r\n]+/g,' '))}}
      onDrop={e=>e.preventDefault()}
      onKeyDown={e=>{
        const mod=e.ctrlKey||e.metaKey, k=e.key.toLowerCase();
        if(mod&&['b','i','u'].includes(k)){e.preventDefault();toggle(k);return}
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onCancel();return}
        if(e.key==='Enter'){e.preventDefault();if(multiline&&!mod)insert('\n');else onDone()}
      }}/>
    <small>{empty?'Selecciona letras para cambiar su formato':'Formato para las letras elegidas'} · {multiline?'Enter: salto de línea · Ctrl+Enter o clic fuera: listo':'Enter o clic fuera: listo'} · Esc: deshacer</small>
  </div>;
}
