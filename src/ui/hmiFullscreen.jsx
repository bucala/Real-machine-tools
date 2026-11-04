import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
import { SoundToggle } from './common';
import { HMI_CONTROL_LAYOUT as layout, hmiKeyLayout } from '../machines/cnc/hmiPanel';

const position=({x,z})=>({left:`${(x/layout.width+.5)*100}%`,top:`${z/layout.depth*100}%`});
function Override({label,value,min,max,onChange}){
  const [draft,setDraft]=useState(String(value)),[editing,setEditing]=useState(false);
  useEffect(()=>{if(!editing)setDraft(String(value));},[value,editing]);
  const set=(raw)=>{const v=Number(raw);if(Number.isFinite(v))onChange(Math.max(min,Math.min(max,Math.round(v))));};
  return <div className="hmi-override"><span>{label}<output>{value} %</output></span><span className="hmi-dial-row">
    <i className="hmi-dial" aria-hidden="true" style={{transform:`rotate(${-130+(value-min)/(max-min)*260}deg)`}} />
    <input type="range" aria-label={label} min={min} max={max} step="1" value={value} onChange={e=>set(e.target.value)} />
    <input type="number" aria-label={`${label} (%)`} min={min} max={max} value={editing?draft:String(value)} onFocus={()=>{setDraft(String(value));setEditing(true);}} onChange={e=>{setDraft(e.target.value);const n=Number(e.target.value);if(e.target.value!==''&&n>=min&&n<=max)onChange(n);}} onBlur={()=>{if(draft!=='')set(draft);setEditing(false);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} />
  </span></div>;
}

export function HmiFullscreen({apiRef,ui,tele,model,onClose}){
  const rootRef=useRef(null),closeRef=useRef(null),canvasRef=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';closeRef.current?.focus({preventScroll:true});
    const keydown=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose();return;}
      if(e.key!=='Tab')return;
      const els=[...rootRef.current.querySelectorAll('button,input,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=els[0],last=els[els.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',keydown,true);
    let raf,last=-1;
    const draw=now=>{raf=requestAnimationFrame(draw);if(now-last<65)return;last=now;
      const source=apiRef.current.getHmiCanvas?.(),canvas=canvasRef.current;
      if(source&&canvas){if(canvas.width!==source.width)canvas.width=source.width;if(canvas.height!==source.height)canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);}
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',keydown,true);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  const names={start:L('Štart cyklu','Cycle start'),hold:L('Stop posuvu','Feed hold'),emergency:ui.estop?L('Uvoľniť núdzový STOP','Release Emergency STOP'):L('Núdzový STOP','Emergency STOP'),reset:'Reset',light:L('Pracovné osvetlenie','Work light'),single:L('Blok po bloku','Single block'),coolant:L('Chladenie','Coolant')};
  const active={emergency:ui.estop,light:ui.light,single:ui.single,coolant:!!tele.cool};
  const act=id=>apiRef.current.hmiAction?.(id);
  const override=(id,key,min,max)=><Override label={id==='feed'?L('Korekcia posuvu','Feed override'):L('Korekcia rýchloposuvu','Rapid override')} value={ui[key]} min={min} max={max} onChange={v=>apiRef.current.setHmiOverride?.(key,v)} />;
  const mainButton=id=><button type="button" className={`hmi-machine-button hmi-${id}`} aria-label={names[id]} title={names[id]} aria-pressed={id==='emergency'?ui.estop:undefined} onClick={()=>act(id)}>{id==='start'?'▶':id==='hold'?'■':'STOP'}</button>;
  const message=tele.alarm?.text||tele.msg||(ui.door?L('Dvere otvorené','Doors open'):tele.run?L('Chod programu','Program running'):L('Pripravený','Ready'));
  return createPortal(<div ref={rootRef} className="hmi-fullscreen" role="dialog" aria-modal="true" aria-labelledby="hmi-full-title" onKeyDown={e=>e.stopPropagation()}>
    <header className="hmi-full-toolbar"><strong id="hmi-full-title">HERMLE {model} <span>HEIDENHAIN · TNC 640</span></strong><span className={`hmi-full-message ${tele.alarm?'alarm':''}`} role="status">{message}</span><SoundToggle className="scene-btn" /><button ref={closeRef} type="button" className="scene-btn" onClick={onClose}>{L('Späť k stroju','Back to machine')} <kbd>Esc</kbd></button></header>
    <section className="hmi-live-display" aria-label={L('Displej HMI','HMI display')}><div className="hmi-screen-bezel"><canvas ref={canvasRef} width="640" height="460" role="img" aria-label={L('Živý displej Heidenhain – program a súradnice stroja','Live Heidenhain display – program and machine coordinates')} /></div></section>
    <section className="hmi-full-controls" aria-label={L('Ovládacie prvky HMI','HMI controls')}>
      <div className="hmi-console-deck">
        {hmiKeyLayout().map((k,i)=>{
          const style={...position(k),width:`${k.w/layout.width*100}%`,height:`${k.d/layout.depth*100}%`};
          return k.control?<button key={i} type="button" className={`hmi-key hmi-key-${k.mat}`} style={style} title={names[k.control]} aria-label={names[k.control]} aria-pressed={active[k.control]} onClick={()=>act(k.control)}>{k.label}</button>:<span key={i} className={`hmi-key hmi-key-${k.mat} hmi-key-static`} style={style} aria-hidden="true">{k.label}</span>;
        })}
        <span className="hmi-deck-brand" style={position(layout.brand)} aria-hidden="true">HERMLE</span>
        {Object.entries(layout.buttons).map(([id,p])=><div key={id} className="hmi-control-position" style={position(p)}>{mainButton(id)}</div>)}
        {Object.entries(layout.dials).map(([id,p])=><div key={id} className="hmi-override-position" style={position(p)}>{override(id,id==='feed'?'fo':'ro',id==='feed'?0:5,id==='feed'?150:100)}</div>)}
        <span className="hmi-trackball" style={position({x:2.45,z:3.95})} aria-hidden="true" />
      </div>
      <div className="hmi-compact-controls"><div className="hmi-compact-buttons">{['start','hold','emergency'].map(id=><span key={id}>{mainButton(id)}</span>)}{['reset','light','single','coolant'].map(id=><button key={id} type="button" className="hmi-key" aria-label={names[id]} aria-pressed={active[id]} onClick={()=>act(id)}>{names[id]}</button>)}</div>{override('feed','fo',0,150)}{override('rapid','ro',5,100)}</div>
    </section>
  </div>,document.body);
}
