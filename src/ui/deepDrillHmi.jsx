import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
export function DeepDrillHmi({apiRef,onClose}){
  const dialog=useRef(null),canvas=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement,d=dialog.current;d.showModal();let raf,last=0;
    const paint=()=>{const source=apiRef.current.getHmiCanvas?.();if(source)canvas.current.getContext('2d').drawImage(source,0,0,960,600);};
    paint();const draw=t=>{raf=requestAnimationFrame(draw);if(t-last<100)return;last=t;paint();};raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);d.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return createPortal(<dialog ref={dialog} className="deep-hmi" aria-label="ShuangliCNC Siemens Edition HMI" onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>e.stopPropagation()}>
    <header><strong>ShuangliCNC · Siemens Edition</strong><button className="btn" autoFocus onClick={onClose}>{L('Späť k stroju','Back to machine')} · Esc</button></header>
    <canvas ref={canvas} width="960" height="600" aria-label={L('Živý displej vŕtacieho cyklu','Live drilling-cycle display')}/>
    <div className="deep-hmi-controls">{[['start','▶ CYCLE START'],['hold','■ FEED HOLD'],['reset','RESET'],['emergency','EMERGENCY STOP']].map(([id,text])=><button className={`btn ${id==='start'?'deep-start':''}`} key={id} onClick={()=>apiRef.current.hmiAction(id)}>{text}</button>)}</div>
  </dialog>,document.body);
}
// Both the in-model monitor and fullscreen HMI use this same live canvas.
export function drawDeepHmi(g,w,h,{S,c}){
  g.fillStyle='#cbd6df';g.fillRect(0,0,w,h);g.fillStyle='#007f83';g.fillRect(0,0,w,50);g.fillStyle='#fff';g.font='bold 26px sans-serif';g.fillText('SIEMENS',20,34);g.font='20px sans-serif';g.fillText('SINUMERIK · ShuangliCNC · AUTO',230,33);
  g.fillStyle='#32495f';g.fillRect(0,52,w,38);g.fillStyle='#fff';g.font='18px sans-serif';g.fillText('ZJA13-2013F    /    DEEP HOLE DRILLING',20,78);
  g.fillStyle='#f4f7f9';g.fillRect(15,105,560,370);g.fillStyle='#284054';g.font='bold 19px monospace';g.fillText('OP     X       Y      DEPTH mm',30,135);
  c.rows.slice(0,10).forEach((r,i)=>{g.fillStyle=i===S.row?'#ffdf63':i%2?'#e1eaf0':'#f0f4f6';g.fillRect(24,149+i*30,540,28);g.fillStyle='#183146';g.font='19px monospace';g.fillText(`${String(i+1).padStart(2)} ${r.x.toFixed(2).padStart(8)} ${r.y.toFixed(2).padStart(8)} ${r.depth.toFixed(2).padStart(9)}`,32,170+i*30);});
  g.fillStyle='#e7eef3';g.fillRect(590,105,350,370);g.fillStyle='#183146';g.font='22px monospace';[['X',S.x],['Y',S.y],['Z',S.depth],['S',S.run?c.rpm:0],['F',S.run?c.feed:0],['bar',c.coolant?c.pressure:0]].forEach(([k,v],i)=>g.fillText(`${k.padEnd(4)} ${v.toFixed(i<3?3:0).padStart(10)}`,610,146+i*48));
  g.fillStyle=S.alarm?'#ad2739':S.run?'#177c60':'#455c6d';g.fillRect(15,488,925,49);g.fillStyle='#fff';g.font='18px sans-serif';g.fillText((S.alarm||`${S.phase.toUpperCase()}  ·  T1 Ø${c.diameter}  ·  ${Math.floor(S.t)} s`).slice(0,100),28,520);
  for(let i=0;i<6;i++){g.fillStyle=i===0?'#007f83':'#647b8f';g.fillRect(15+i*155,550,148,39);g.fillStyle='#fff';g.font='17px sans-serif';g.fillText(['Machine','Program','Tool T1','Coolant','Diagnostics','AUTO'][i],27+i*155,575);}
}
