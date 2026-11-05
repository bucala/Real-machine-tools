import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
import { Slider, SoundToggle } from './common';
export function EdmFullscreen({apiRef,ui,tele,onClose}){
  const canvas=useRef(null),root=useRef(null),close=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;close.current.focus({preventScroll:true});
    const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose();}if(e.key==='Tab'){const nodes=[...root.current.querySelectorAll('button,input')].filter(o=>!o.disabled),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    document.addEventListener('keydown',key,true);let raf,t0=0;
    const draw=t=>{raf=requestAnimationFrame(draw);if(t-t0<100)return;t0=t;const source=apiRef.current.getHmiCanvas?.();if(source)canvas.current.getContext('2d').drawImage(source,0,0,800,460);};raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return createPortal(<div className="hmi-fullscreen edm-fullscreen" ref={root} role="dialog" aria-modal="true" aria-label="OSCARMAX EX 500 HMI" onKeyDown={e=>e.stopPropagation()}>
    <header className="hmi-full-toolbar"><strong>OSCARMAX EX 500 <span>EDM</span></strong><span role="status">{tele.alarm||tele.phase}</span><SoundToggle className="scene-btn"/><button className="scene-btn" ref={close} onClick={onClose}>{L('Späť k stroju','Back to machine')} · Esc</button></header>
    <section className="hmi-live-display"><div className="hmi-screen-bezel"><canvas ref={canvas} width="800" height="460" aria-label={L('Živý displej EX 500','Live EX 500 display')}/></div></section>
    <section className="edm-full-controls"><div className="flex flex-wrap gap-3">{[['start','▶',L('Štart cyklu','Cycle start')],['hold','■',L('Stop posuvu','Feed hold')],['reset','↺','Reset'],['emergency','STOP',L('Núdzový STOP','Emergency STOP')],['coolant','≈',L('Výplach','Flushing')],['light','☀',L('Svetlo','Light')]].map(([id,icon,label])=><button className={`btn ${id==='start'?'edm-start':''}`} key={id} onClick={()=>apiRef.current.hmiAction(id)}>{icon} {label}</button>)}</div>
      <Slider id="edm-full-speed" label={L('Rýchlosť simulácie','Simulation speed')} min={1} max={80} value={ui.speed} onChange={v=>apiRef.current.setSpeed(v)} unit="×"/>
    </section>
  </div>,document.body);
}
