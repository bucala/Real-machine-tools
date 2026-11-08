import { useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
import './workAreaWindow.css';
function LiveWorkArea({apiRef}){
  const canvas=useRef(null),[error,setError]=useState('');
  useEffect(()=>{let feed,raf,last=-Infinity,frames=0,closed=false;
    try{if(!apiRef.current.mountWorkArea)throw new Error(L('Pohľad ešte nie je pripravený.','View is not ready yet.'));feed=apiRef.current.mountWorkArea(canvas.current);
      const loop=t=>{if(closed)return;raf=requestAnimationFrame(loop);if(t-last<1000/30)return;last=t;try{feed.render();canvas.current.dataset.frames=String(++frames);}catch(e){cancelAnimationFrame(raf);setError(e.message);}};loop(performance.now());
    }catch(e){setError(e.message);}
    return()=>{closed=true;cancelAnimationFrame(raf);feed?.dispose();};
  },[]);
  return error?<p role="alert">{error}</p>:<canvas ref={canvas} className="live-work-area" width="800" height="500" aria-label={L('Živý uzamknutý pohľad na pracovný priestor','Live locked view of working area')}/>;
}
export function WorkAreaButton({apiRef}){
  const anchor=useRef(null),[open,setOpen]=useState(false),[split,setSplit]=useState(false),[host,setHost]=useState(null);
  useEffect(()=>{if(!split)return;const root=anchor.current.closest('.hmi-fullscreen,.brake-hmi,.deep-hmi');if(!root)return;
    const target=document.createElement('section');target.className='work-area-split-pane';target.setAttribute('aria-label',L('Pracovný priestor','Working area'));root.appendChild(target);root.classList.add('work-split');setHost(target);
    return()=>{root.classList.remove('work-split');target.remove();};
  },[split]);
  return <span className="work-area-actions" ref={anchor}><button type="button" className="scene-btn work-area-open" onClick={()=>{setSplit(false);setOpen(true);}} aria-label={L('Pracovný priestor','Working area')} title={L('Pracovný priestor','Working area')}><span aria-hidden="true">▣</span><span className="work-area-label">{L('Priestor','Area')}</span></button><button type="button" className="scene-btn work-area-split" aria-pressed={split} onClick={()=>{setOpen(false);setHost(null);setSplit(v=>!v);}} aria-label="Split-screen" title="Split-screen"><span aria-hidden="true">◫</span><span className="work-area-label">Split</span></button>
    {open&&<WorkAreaWindow apiRef={apiRef} onClose={()=>setOpen(false)}/>}
    {split&&host&&createPortal(<><button className="work-area-close" onClick={()=>setSplit(false)} aria-label={L('Zavrieť split-screen','Close split screen')} title={L('Zavrieť','Close')}>×</button><div className="work-area-live-frame"><LiveWorkArea apiRef={apiRef}/></div></>,host)}
  </span>;
}
function WorkAreaWindow({apiRef,onClose}){
  const dialog=useRef(null);
  useEffect(()=>{const previous=document.activeElement,d=dialog.current;d.showModal();return()=>{d.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  return createPortal(<dialog ref={dialog} className="work-area-dialog" aria-label={L('Pracovný priestor','Working area')} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onKeyDown={e=>e.stopPropagation()}><button className="work-area-close" autoFocus onClick={onClose} aria-label={L('Späť do HMI','Back to HMI')} title={L('Zavrieť','Close')}>×</button><div className="work-area-live-frame"><LiveWorkArea apiRef={apiRef}/></div></dialog>,document.body);
}
