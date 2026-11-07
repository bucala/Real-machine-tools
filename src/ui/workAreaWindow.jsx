import { useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
import './workAreaWindow.css';
export function WorkAreaButton({apiRef}){
  const [open,setOpen]=useState(false);
  return <><button type="button" className="scene-btn work-area-open" onClick={()=>setOpen(true)}>▣ {L('Pracovný priestor','Working area')}</button>{open&&<WorkAreaWindow apiRef={apiRef} onClose={()=>setOpen(false)}/>}</>;
}
function WorkAreaWindow({apiRef,onClose}){
  const dialog=useRef(null),canvas=useRef(null);const [error,setError]=useState('');
  useEffect(()=>{const previous=document.activeElement,d=dialog.current;d.showModal();let feed,raf,last=-Infinity;
    try{if(!apiRef.current.mountWorkArea)throw new Error(L('Pohľad ešte nie je pripravený.','View is not ready yet.'));feed=apiRef.current.mountWorkArea(canvas.current);feed.render();const loop=t=>{raf=requestAnimationFrame(loop);if(t-last>=100){last=t;feed.render();}};raf=requestAnimationFrame(loop);}catch(e){feed?.dispose();setError(e.message);}
    return()=>{cancelAnimationFrame(raf);feed?.dispose();d.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return createPortal(<dialog ref={dialog} className="work-area-dialog" aria-labelledby="work-area-title" onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onKeyDown={e=>e.stopPropagation()}><header><div><strong id="work-area-title">{L('Pracovný priestor','Working area')}</strong><span>🔒 {L('Uzamknutý pohľad · naživo','Locked view · live')}</span></div><button className="scene-btn" autoFocus onClick={onClose}>{L('Späť do HMI','Back to HMI')} · Esc</button></header>{error?<p role="alert">{error}</p>:<canvas ref={canvas} width="800" height="500" aria-label={L('Živý uzamknutý pohľad na pracovný priestor','Live locked view of working area')}/>}</dialog>,document.body);
}
