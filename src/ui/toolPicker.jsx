import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
import { defaultTools } from '../machines/cnc/tooling';
import { loadCabinet } from '../machines/cnc/toolLibrary';
import { CncToolPreview } from './cncToolPreview';
import './toolPicker.css';

const DRAG_TYPE = 'application/x-rmt-cabinet-tool';
function readTools() {
  try { return {tools:loadCabinet(localStorage,defaultTools())}; }
  catch(e) { return {tools:[],error:L('Skrinku sa nepodarilo načítať. Skontroluj ju cez Spravovať skrinku.','Could not load the cabinet. Check it in Manage cabinet.')+` ${e.message}`}; }
}

export function ToolPicker({tools,capacity,canApply,onInstall,onClose,initialPocket=1,initialToolId,backLabel}) {
  const [cabinet]=useState(readTools),[query,setQuery]=useState('');
  const [pocket,setPocket]=useState(initialPocket),[selected,setSelected]=useState(()=>{
    const installed=tools.find(t=>t.t===initialPocket);
    return initialToolId||cabinet.tools.find(t=>t.id===installed?.libraryId)?.id||cabinet.tools.find(t=>t.t===initialPocket)?.id||cabinet.tools[0]?.id||'';
  });
  const [notice,setNotice]=useState(''),[error,setError]=useState(cabinet.error||''),[dragging,setDragging]=useState(false),[over,setOver]=useState(null);
  const rootRef=useRef(null),closeRef=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow,host=document.querySelector('.hermle-app'),inert=host?.inert;
    if(host)host.inert=true;document.body.style.overflow='hidden';closeRef.current.focus({preventScroll:true});
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose();return;}
      if(e.key==='Tab'){
        const nodes=[...rootRef.current.querySelectorAll('button,input')].filter(n=>!n.disabled&&n.getClientRects().length),first=nodes[0],last=nodes.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key,true);
    return()=>{document.removeEventListener('keydown',key,true);document.body.style.overflow=overflow;if(host)host.inert=inert;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  const tool=cabinet.tools.find(t=>t.id===selected),installed=tools.find(t=>t.t===pocket);
  const visibleTools=cabinet.tools.filter(t=>`${t.name} ${t.d} T${t.t}`.toLowerCase().includes(query.toLowerCase()));
  const choose=id=>{setSelected(id);setNotice('');setError('');};
  const choosePocket=t=>{setPocket(t);setNotice('');setError('');};
  const drop=(e,t)=>{
    if(!canApply||!e.dataTransfer.types.includes(DRAG_TYPE))return;
    e.preventDefault();setOver(null);setDragging(false);
    const id=e.dataTransfer.getData(DRAG_TYPE);
    if(!cabinet.tools.some(tool=>tool.id===id))return;
    choose(id);setPocket(t);
  };
  const install=()=>{
    setError('');setNotice('');
    if(!canApply||!tool)return;
    try { onInstall(tool,pocket);setNotice(L(`Nástroj osadený na T${pocket}.`,`Tool installed at T${pocket}.`)); }
    catch(e) { setError(e.message); }
  };
  return createPortal(<div className="tool-picker-backdrop" onKeyDown={e=>e.stopPropagation()}>
    <section className="tool-picker" role="dialog" aria-modal="true" aria-labelledby="tool-picker-title" ref={rootRef}>
      <header><div><h2 id="tool-picker-title">{L('Vybrať nástroj zo skrinky','Choose a tool from cabinet')}</h2><p>{L('Vyber nástroj a miesto T kliknutím, alebo nástroj potiahni na miesto v zásobníku.','Select a tool and a T pocket, or drag the tool onto a magazine pocket.')}</p></div><button ref={closeRef} type="button" className="btn" onClick={onClose}>{backLabel||L('Späť k stroju','Back to machine')} · Esc</button></header>
      <div className="tool-picker-body">
        <section className="tool-picker-cabinet" aria-label={L('Uložené nástroje','Saved tools')}>
          <input className="sel" type="search" aria-label={L('Hľadať nástroj','Search tools')} placeholder={L('Hľadať názov alebo priemer…','Search name or diameter…')} value={query} onChange={e=>setQuery(e.target.value)}/>
          <div className="tool-picker-cards">{visibleTools.map(t=><button type="button" key={t.id} className={`tool-picker-card ${selected===t.id?'selected':''}`} aria-pressed={selected===t.id} aria-label={`${t.name} · Ø${t.d} · L${t.l} mm`} draggable={canApply}
            onClick={()=>choose(t.id)} onDragStart={e=>{e.dataTransfer.setData(DRAG_TYPE,t.id);e.dataTransfer.effectAllowed='copy';choose(t.id);setDragging(true);}} onDragEnd={()=>{setDragging(false);setOver(null);}}>
            <CncToolPreview tool={t} fit/><span><strong>{t.name}</strong><small>Ø{t.d} · R{t.cr} · L{t.l} mm</small></span>
          </button>)}</div>
          {cabinet.tools.length>0&&!visibleTools.length&&<p>{L('Žiadny nástroj nevyhovuje hľadaniu.','No tools match your search.')}</p>}
          {!cabinet.tools.length&&<p>{L('Skrinka je prázdna. Nástroje pridaj cez Spravovať skrinku v paneli stroja.','The cabinet is empty. Add tools in Manage cabinet in the machine panel.')}</p>}
        </section>
        <section className={`tool-picker-magazine ${dragging?'dragging':''}`} aria-label={L('Miesta zásobníka','Magazine pockets')}>
          <h3>{L('Zásobník','Magazine')} · {capacity} {L('miest','pockets')}</h3>
          <div className="tool-picker-pockets">{Array.from({length:capacity},(_,i)=>i+1).map(t=>{
            const current=tools.find(tool=>tool.t===t);
            return <button key={t} type="button" aria-label={`T${t} · ${current?.name||L('voľné','empty')}`} aria-pressed={pocket===t} title={current?.name||L('Voľné miesto','Empty pocket')} className={`${pocket===t?'selected':''} ${current?'occupied':''} ${over===t?'drop-over':''}`} onClick={()=>choosePocket(t)}
              onDragOver={e=>{if(canApply&&e.dataTransfer.types.includes(DRAG_TYPE)){e.preventDefault();e.dataTransfer.dropEffect='copy';setOver(t);}}} onDragLeave={()=>setOver(null)} onDrop={e=>drop(e,t)}>T{t}<i aria-hidden="true"/></button>;
          })}</div>
          <p className="tool-picker-current"><b>T{pocket}</b><span>{installed?.name||L('Voľné miesto','Empty pocket')}</span></p>
          <p className="muted">{L('Bodka označuje osadené miesto. Presunutie pripraví výber; osadenie potvrď tlačidlom dole.','A dot marks an occupied pocket. Dropping stages the selection; install it with the button below.')}</p>
        </section>
      </div>
      <footer>
        <div><strong>{tool?`${tool.name} → T${pocket}`:L('Vyber uložený nástroj','Select a saved tool')}</strong><p>{L('Osadenie nahradí vybrané T a obnoví simuláciu od polotovaru.','Installation replaces the selected T and resets simulation to the blank.')}</p>
          {!canApply&&<p className="tool-picker-warning">{L('Pred osadením zastav stroj a ukonči prehliadku obrobku.','Stop the machine and finish workpiece inspection before installing.')}</p>}
          {error&&<p className="tool-picker-error" role="alert">{error}</p>}{notice&&<p className="tool-picker-notice" role="status">{notice}</p>}
        </div><button type="button" className="btn tool-picker-install" disabled={!canApply||!tool} onClick={install}>{L(`Osadiť na T${pocket}`,`Install at T${pocket}`)}</button>
      </footer>
    </section>
  </div>,document.body);
}
