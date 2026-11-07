import { useEffect,useRef } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
export function BystronicHmi({apiRef,onClose}){
  const dialog=useRef(null),canvas=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement,d=dialog.current;d.showModal();let raf,last=0;
    const paint=()=>{const source=apiRef.current.getHmiCanvas?.();if(source)canvas.current.getContext('2d').drawImage(source,0,0,1200,700);};
    paint();const draw=t=>{raf=requestAnimationFrame(draw);if(t-last<100)return;last=t;paint();};raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);d.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return createPortal(<dialog ref={dialog} className="brake-hmi" aria-label="Bystronic Xpert Pro 320 HMI" onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>e.stopPropagation()}>
    <header><strong>Bystronic · Xpert Pro 320</strong><button className="btn" autoFocus onClick={onClose}>{L('Späť k stroju','Back to machine')} · Esc</button></header>
    <canvas ref={canvas} width="1200" height="700" aria-label={L('Živý displej ohýbania','Live bending display')}/>
    <div className="brake-hmi-actions">{[['start',L('Spustiť ohyb','Start bend')],['hold',L('Pozastaviť','Pause')],['retract',L('Zdvihnúť baran','Retract ram')],['emergency',L('Núdzový STOP','Emergency STOP')]].map(([id,text])=><button className={`btn ${id==='start'?'brake-start':''}`} key={id} onClick={()=>apiRef.current.hmiAction(id)}>{text}</button>)}</div>
  </dialog>,document.body);
}
// One live canvas for the 3D monitor and fullscreen; a training interface, not
// an emulation of the manufacturer's proprietary ByVision software.
export function drawBrakeHmi(g,w,h,{S,c,setup}){
  g.fillStyle='#e6eaed';g.fillRect(0,0,w,h);g.fillStyle='#252c33';g.fillRect(0,0,w,50);
  g.fillStyle='#f64b32';g.fillRect(0,0,155,50);g.fillStyle='#fff';g.font='bold 25px Arial';g.fillText('Bystronic',19,34);g.font='20px Arial';g.fillText('Xpert Pro 320 / 4300',185,33);g.fillText('BENDING',1005,33);
  for(let i=0;i<5;i++){g.fillStyle=i===2?'#fff':'#d3d9df';g.fillRect(12+i*181,63,172,43);g.fillStyle=i===2?'#e8442f':'#43515e';g.font='19px Arial';g.fillText([L('Diel','Part'),L('Nástroje','Tools'),L('Ohýbanie','Bending'),L('Stroj','Machine'),L('Diagnostika','Diagnostics')][i],30+i*181,91);}
  g.fillStyle='#fafbfc';g.fillRect(16,122,785,444);g.strokeStyle='#e1e6ea';g.lineWidth=1;
  for(let i=0;i<11;i++){g.beginPath();g.moveTo(38,230+i*30);g.lineTo(777,230+i*30);g.stroke();}
  g.fillStyle='#667885';g.font='18px Arial';g.fillText(`${c.material.toUpperCase()}   ${c.length} × ${c.depth} × ${c.thickness} mm`,40,158);
  // Isometric preview of the actual included angle.
  const beta=S.beta,spread=140*Math.cos(beta),rise=140*Math.sin(beta),p=[[155,409],[525,360],[525+spread,360-rise],[155+spread,409-rise],[155,409],[155-spread*.62,409-rise-65],[525-spread*.62,360-rise-65],[525,360]];
  g.fillStyle='#a8bac9';g.strokeStyle='#405b70';g.lineWidth=2;g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.stroke();
  g.strokeStyle='#f34b32';g.lineWidth=4;g.beginPath();g.moveTo(155,409);g.lineTo(525,360);g.stroke();
  g.fillStyle='#30475b';g.font='bold 29px Arial';g.fillText(`${(180-S.beta*360/Math.PI).toFixed(1)}°`,590,480);g.font='17px Arial';g.fillText(`V ${c.v}   ·   X ${c.flange} mm`,40,536);
  g.fillStyle='#fff';g.fillRect(817,122,367,444);g.fillStyle='#324554';g.font='bold 22px Arial';g.fillText(L('Pracovné hodnoty','Working values'),838,159);
  const values=[['Y1 / Y2',`${S.y.toFixed(2)} mm`],['X',`${c.flange.toFixed(1)} mm`],['R',`${c.r.toFixed(1)} mm`],[L('Sila','Force'),`${S.force.toFixed(0)} kN`],[L('Cieľový uhol','Target angle'),`${c.angle}°`],[L('Odhad sily','Estimated force'),`${setup?.force.toFixed(0)||'—'} / 3200 kN`]];
  values.forEach(([k,v],i)=>{g.fillStyle=i%2?'#f1f4f6':'#e8eef2';g.fillRect(832,176+i*60,338,54);g.fillStyle='#536575';g.font='16px Arial';g.fillText(k,844,196+i*60);g.fillStyle='#1f3446';g.font='bold 23px monospace';g.fillText(v,844,220+i*60);});
  const status=c.estop?L('Núdzový STOP je aktívny.','Emergency STOP is active.'):S.alarm||`${S.phase.toUpperCase()}  ·  ${S.t.toFixed(1)} s`;
  g.fillStyle=c.estop||S.alarm?'#a92c3b':S.run?'#297753':'#425365';g.fillRect(16,581,1168,49);g.fillStyle='#fff';g.font='18px Arial';g.fillText(status.slice(0,110),34,612);
  g.fillStyle='#f44d34';g.fillRect(16,646,211,40);g.fillStyle='#fff';g.font='bold 19px Arial';g.fillText(L('OHYB 01','BEND 01'),45,673);g.fillStyle='#425365';g.font='17px Arial';g.fillText('Xpert Pro 320   ·   3 200 kN   ·   4 300 mm',250,673);
}
