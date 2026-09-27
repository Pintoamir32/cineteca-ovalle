import { useEffect } from 'react';

let observer = null;
function getObserver(){
  if(observer) return observer;
  observer = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0, rootMargin: '0px 0px -60px 0px' });
  return observer;
}

export function useRevealScan(dep){
  useEffect(()=>{
    const nodes = document.querySelectorAll('[data-reveal]:not(.is-visible)');
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      nodes.forEach(n=>n.classList.add('is-visible'));
      return;
    }
    const io = getObserver();
    nodes.forEach(n=>io.observe(n));
  }, [dep]);
}
