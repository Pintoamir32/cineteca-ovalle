import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import './search-select.css';

// Minúsculas y sin tildes: "ficcion" encuentra "Ficción"
const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();

// Reemplazo de <select> con buscador. options: [{value,label}]
export function SearchSelect({label,value,onChange,options,disabled=false,className=''}){
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
  const rootRef=useRef(null),inputRef=useRef(null),listRef=useRef(null),buttonRef=useRef(null);
  const id=useId();
  const current=options.find(o=>o.value===value)||options[0];
  const filtered=useMemo(()=>{const q=fold(query.trim());return q?options.filter(o=>fold(o.label).includes(q)):options},[options,query]);

  const close=(focusButton=true)=>{setOpen(false);setQuery('');if(focusButton)buttonRef.current?.focus()};
  const pick=o=>{onChange(o.value);close()};

  useEffect(()=>{
    if(!open)return;
    setActive(Math.max(0,filtered.findIndex(o=>o.value===value)));
    inputRef.current?.focus();
    const onDown=e=>{if(!rootRef.current?.contains(e.target))close(false)};
    document.addEventListener('mousedown',onDown);
    return()=>document.removeEventListener('mousedown',onDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open]);
  useEffect(()=>{setActive(0)},[query]);
  useEffect(()=>{listRef.current?.children[active]?.scrollIntoView({block:'nearest'})},[active,open]);

  const onKey=e=>{
    if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(filtered.length-1,a+1))}
    else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,a-1))}
    else if(e.key==='Enter'){e.preventDefault();if(filtered[active])pick(filtered[active])}
    else if(e.key==='Escape'){e.preventDefault();close()}
    else if(e.key==='Tab'){close(false)}
  };

  return <div className={`ss-field ${className}`} ref={rootRef}>
    {label&&<span className="ss-label" id={`${id}-label`}>{label}</span>}
    <button type="button" ref={buttonRef} className={`ss-trigger${open?' is-open':''}${value?' has-value':''}`} disabled={disabled}
      aria-haspopup="listbox" aria-expanded={open} aria-labelledby={label?`${id}-label ${id}-value`:undefined}
      onClick={()=>setOpen(o=>!o)} onKeyDown={e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setOpen(true)}}}>
      <span id={`${id}-value`}>{current?.label}</span><ChevronDown aria-hidden="true"/>
    </button>
    {open&&<div className="ss-pop">
      <div className="ss-search"><Search aria-hidden="true"/><input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey} placeholder="Buscar…" aria-label={`Buscar${label?` en ${label}`:''}`} aria-controls={`${id}-list`} aria-activedescendant={filtered[active]?`${id}-opt-${active}`:undefined}/></div>
      <ul className="ss-list" id={`${id}-list`} role="listbox" ref={listRef}>
        {filtered.length?filtered.map((o,i)=><li key={`${o.value}`} id={`${id}-opt-${i}`} role="option" aria-selected={o.value===value}
          className={`${i===active?'is-active':''}${o.value===value?' is-selected':''}`}
          onMouseEnter={()=>setActive(i)} onMouseDown={e=>{e.preventDefault();pick(o)}}>
          <span>{o.label}</span>{o.value===value&&<Check aria-hidden="true"/>}
        </li>):<li className="ss-empty">Sin coincidencias</li>}
      </ul>
    </div>}
  </div>;
}
