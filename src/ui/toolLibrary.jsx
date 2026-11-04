import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
import { defaultTools } from '../machines/cnc/tooling';
import { LIBRARY_KEY, MAX_FILE_BYTES, MAX_TOOLS, decodeCsv, decodeLibrary, detectNcTools, encodeCsv, encodeLibrary, encodeToolComments, newToolId, readCabinet, shapeOf, shapeTool, validateTool } from '../machines/cnc/toolLibrary';
import { CncToolPreview } from './cncToolPreview';
import './toolLibrary.css';

const fields = () => [
  ['t', L('Predvolené číslo T', 'Preferred T number'), 1, 9999, 1],
  ['d', L('Priemer Ø (mm)', 'Diameter Ø (mm)'), .5, 80, .1],
  ['cr', L('Polomer rohu R (mm)', 'Corner radius R (mm)'), 0, 40, .1],
  ['l', L('L od čela vretena (mm)', 'L from spindle nose (mm)'), 40, 300, .1],
  ['lc', L('Rezná dĺžka (mm)', 'Flute length (mm)'), .5, 300, .1],
  ['s', L('Vyloženie S (mm)', 'Stick-out S (mm)'), 1, 275, .1],
  ['dh', L('Priemer držiaka ØH (mm)', 'Holder diameter ØH (mm)'), 20, 80, .1],
  ['z', L('Počet zubov', 'Flutes'), 1, 12, 1],
  ['tip', L('Uhol špičky (°)', 'Point angle (°)'), 30, 160, 1],
];
function download(data, filename, type) {
  const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function initialCabinet() {
  try { return {tools:readCabinet(localStorage,defaultTools())}; }
  catch(e) { return {tools:defaultTools().map(t=>({id:newToolId(),...validateTool(t)})),error:`${L('Uloženú skrinku sa nepodarilo načítať. Pracuješ s dočasnou kópiou; uloženie prepíše pôvodnú skrinku.','Saved cabinet could not be loaded. This is a temporary copy; saving replaces the original cabinet.')} ${e.message}`}; }
}
export function ToolLibrary({tools,program,capacity,canApply,onInstall,onLoadProgram,onClose,initialTab='cabinet',initialNc,initialName}) {
  const [initial]=useState(initialCabinet);
  const [cabinet,setCabinet]=useState(initial.tools),[draft,setDraft]=useState(()=>({...initial.tools[0]||defaultTools()[2]})),[tab,setTab]=useState(initialTab),[query,setQuery]=useState('');
  const [error,setError]=useState(initial.error||''),[notice,setNotice]=useState(''),[review,setReview]=useState(null),[reviewed,setReviewed]=useState(false),[ack,setAck]=useState(false);
  const [pocket,setPocket]=useState(initial.tools[0]?.t||1),[nc,setNc]=useState(initialNc??program),[ncName,setNcName]=useState(initialName||L('Aktuálny program','Current program'));
  const rootRef=useRef(null),closeRef=useRef(null),importRef=useRef(null),ncRef=useRef(null);
  const detected=useMemo(()=>detectNcTools(nc),[nc]);
  useEffect(()=>setAck(false),[tab,nc]);
  let valid=null,validation='';
  try { valid=validateTool(draft); } catch(e) { validation=e.message; }
  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow;
    const host=document.querySelector('.hermle-app'),inert=host?.inert;
    if(host)host.inert=true;
    document.body.style.overflow='hidden';closeRef.current.focus({preventScroll:true});
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose();return;}
      if(e.key==='Tab'){
        const nodes=[...rootRef.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(n=>!n.disabled&&n.getClientRects().length),first=nodes[0],last=nodes.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key,true);
    return()=>{document.removeEventListener('keydown',key,true);document.body.style.overflow=overflow;if(host)host.inert=inert;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  const message=fn=>{setError('');setNotice('');try{fn();}catch(e){setError(e.message);}};
  const persist=next=>{if(next.length>MAX_TOOLS)throw new Error(`Max. ${MAX_TOOLS}`);localStorage.setItem(LIBRARY_KEY,encodeLibrary(next));setCabinet(next);};
  const select=tool=>{setDraft({...tool});setPocket(Math.min(capacity,tool.t));setReview(null);setReviewed(false);setError('');setNotice('');};
  const store=()=>message(()=>{
    const tool={id:draft.id||newToolId(),...validateTool(draft)};
    if(review&&!reviewed)throw new Error(L('Najprv over rozmery nástroja.','Verify tool dimensions first.'));
    const next=cabinet.some(t=>t.id===tool.id)?cabinet.map(t=>t.id===tool.id?tool:t):[...cabinet,tool];
    persist(next);setDraft(tool);setReview(null);setReviewed(false);setNotice(L('Nástroj je uložený v skrinke v tomto prehliadači.','Tool saved in this browser’s cabinet.'));
  });
  const importFile=async(e,scan)=>{
    const f=e.target.files?.[0];e.target.value='';if(!f)return;
    setError('');setNotice('');
    try{
      if(f.size>MAX_FILE_BYTES)throw new Error(L('Súbor je väčší ako 2 MB.','File exceeds 2 MB.'));
      const data=await f.text();
      if(scan){setNc(data);setNcName(f.name);setTab('detect');return;}
      const incoming=/\.csv$/i.test(f.name)?decodeCsv(data):decodeLibrary(data);
      // Append imports: an existing cabinet record is never silently overwritten.
      const next=[...cabinet]; let count=0;
      for(const t of incoming){
        const same=next.find(x=>x.id===t.id);
        if(same&&JSON.stringify(validateTool(same))===JSON.stringify(validateTool(t)))continue;
        next.push({...t,id:same?newToolId():t.id});count++;
      }
      persist(next);setNotice(L(`Importovaných ${count} nástrojov do skrinky.`,`${count} tools imported into the cabinet.`));
    }catch(err){setError(err.message);}
  };
  const reviewNc=row=>{
    const base=tools.find(t=>t.t===row.t)||defaultTools()[2];
    const {shape,...metadata}=row.fields;
    let candidate={...base,...metadata,t:row.t,id:newToolId(),name:metadata.name||`T${row.t} · ${L('z NC – overiť','from NC – verify')}`};
    if(shape)candidate={...shapeTool(candidate,shape),...metadata};
    setDraft(candidate);setPocket(Math.min(capacity,row.t));setReview(row);setReviewed(false);setTab('cabinet');setError('');setNotice('');
  };
  const install=()=>message(()=>{
    if(!canApply||!ack||!valid||review)throw new Error(L('Zastav stroj, ulož overený nástroj a potvrď obnovenie polotovaru.','Stop the machine, save a verified tool and confirm the stock reset.'));
    onInstall(valid,Number(pocket));setAck(false);setNotice(L(`Nástroj osadený na T${pocket}. Simulácia začína od polotovaru.`,`Tool installed at T${pocket}. Simulation starts from the blank.`));
  });
  const busyNote=L('Počas chodu stroja alebo prehliadky obrobku je osádzanie a načítanie programu vypnuté.','Installation and program loading are disabled while running or inspecting the workpiece.');
  return createPortal(<div className="tool-library-backdrop" onKeyDown={e=>e.stopPropagation()}>
    <section className="tool-library" role="dialog" aria-modal="true" aria-labelledby="tool-library-title" ref={rootRef}>
      <header><div><p className="sec-title">CNC · HSK-A63 · mm</p><h2 id="tool-library-title">{L('Skrinka a knižnica nástrojov','Tool cabinet & library')}</h2></div><button ref={closeRef} className="btn" onClick={onClose}>{L('Späť k stroju','Back to machine')} · Esc</button></header>
      <nav aria-label={L('Časti knižnice','Library sections')}>{[['cabinet',L('Skrinka','Cabinet')],['detect',L('Detekcia z NC','Detect from NC')],['powermill','PowerMill / CAM']].map(([id,label])=><button key={id} className={`btn ${tab===id?'on':''}`} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      {error&&<p className="tool-library-error" role="alert">{error}</p>}{notice&&<p className="tool-library-notice" role="status">{notice}</p>}
      <input ref={importRef} type="file" accept=".json,.csv" hidden onChange={e=>importFile(e,false)} />
      <input ref={ncRef} type="file" accept=".nc,.tap,.cnc,.ngc,.iso,.gcode,.h,.mpf,.txt,.eia,.ptp" hidden onChange={e=>importFile(e,true)} />
      {tab==='cabinet'&&<div className="tool-library-columns">
        <aside className="tool-cabinet-list"><h3>{L('Uložené nástroje','Saved tools')} <span>{cabinet.length}/{MAX_TOOLS}</span></h3>
          <input className="sel" type="search" placeholder={L('Hľadať názov alebo T…','Search name or T…')} aria-label={L('Hľadať nástroj','Search tools')} value={query} onChange={e=>setQuery(e.target.value)} />
          <div className="tool-library-actions"><button className="btn" onClick={()=>{select({...defaultTools()[2],id:newToolId(),name:L('Nový nástroj','New tool')});}}>{L('+ Nový','+ New')}</button><button className="btn" onClick={()=>importRef.current.click()}>{L('Import JSON / CSV','Import JSON / CSV')}</button></div>
          <div className="tool-library-records">{cabinet.filter(t=>`${t.name} T${t.t}`.toLowerCase().includes(query.toLowerCase())).map(t=><button key={t.id} className={`tool-library-record ${draft.id===t.id?'selected':''}`} aria-pressed={draft.id===t.id} onClick={()=>select(t)}><CncToolPreview tool={t} fit/><span><strong>{t.name}</strong><small>T{t.t} · Ø{t.d} · L{t.l} mm</small></span></button>)}</div>
          {!cabinet.length&&<p>{L('Skrinka je prázdna. Pridaj alebo importuj nástroj.','Cabinet is empty. Add or import a tool.')}</p>}
          <button className="btn" onClick={()=>message(()=>{
            const next=[...cabinet];let count=0;
            for(const raw of tools){const tool=validateTool(raw);if(!next.some(t=>JSON.stringify(validateTool(t))===JSON.stringify(tool))){next.push({id:newToolId(),...tool});count++;}}
            persist(next);setNotice(L(`Uložených ${count} osadených nástrojov do skrinky. Zásobník sa nemení.`,`${count} installed tools saved to the cabinet. Magazine unchanged.`));
          })}>{L('Uložiť osadené do skrinky','Save installed tools to cabinet')}</button>
          <div className="tool-library-actions">{[['JSON',()=>encodeLibrary(cabinet),'json'],['CSV',()=>encodeCsv(cabinet),'csv']].map(([label,encode,ext])=><button key={label} className="btn" onClick={()=>message(()=>download(encode(),`rmt-tools.${ext}`,ext==='json'?'application/json':'text/csv'))}>Export {label}</button>)}</div>
          <p className="muted">{L('Skrinka sa ukladá lokálne v prehliadači. Export JSON slúži ako záloha a na prenos medzi zariadeniami.','Cabinet is saved locally in this browser. Export JSON to back up or transfer between devices.')}</p>
        </aside>
        <main className="tool-library-editor"><h3>{L('Editor nástroja','Tool editor')}</h3>
          {review&&<div className="tool-library-warning"><strong>{L('Over rozmery z NC','Verify NC dimensions')} · T{review.t}</strong><p>{L('Nezistené údaje používajú dočasný vzor z tabuľky stroja. Pred uložením ich zmeraj alebo doplň z CAM.','Missing values use a temporary machine-table template. Measure or obtain them from CAM before saving.')}</p><p>{L('Chýba','Missing')}: {review.missing.join(', ')||'—'}</p>{review.conflicts.length>0&&<p>{L('Rozpory','Conflicts')}: {review.conflicts.join('; ')}</p>}</div>}
          <div className="tool-library-edit-top">{valid?<CncToolPreview tool={valid} fit/>:<span className="muted">{L('Náhľad čaká na platné rozmery','Preview needs valid dimensions')}</span>}<div><label>{L('Názov nástroja','Tool name')}<input className="sel" maxLength={160} value={draft.name||''} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>{L('Tvar reznej časti','Cutter shape')}<select aria-label={L('Tvar reznej časti','Cutter shape')} className="sel" value={shapeOf(draft)} onChange={e=>setDraft(shapeTool(draft,e.target.value))}>{[['flat',L('Plochá / čelná fréza','Flat / face mill')],['ball',L('Guľová fréza','Ball mill')],['bull',L('Toroidná fréza','Bull nose')],['drill',L('Vrták','Drill')],['chamfer',L('Skosovacia fréza','Chamfer mill')]].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label></div></div>
          <div className="tool-library-fields">{fields().filter(([k])=>k!=='tip'||draft.kind==='cone').map(([k,label,min,max,step])=><label key={k}>{label}<input className="sel" type="number" min={min} max={max} step={step} value={draft[k]??''} onChange={e=>{const value=e.target.value;setDraft(d=>({...d,[k]:value,...(k==='d'&&d.kind==='mill'&&Number(d.cr)===Number(d.d)/2?{cr:Number(value)/2}:{})}));}}/></label>)}</div>
          {validation&&<p className="tool-library-error" role="status">{validation}</p>}
          {review&&<label className="tool-library-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>{L('Overil som tvar a všetky rozmery vrátane doplnených údajov.','I verified the shape and all dimensions, including missing values.')}</label>}
          <div className="tool-library-actions"><button className="btn on" disabled={!valid||(review&&!reviewed)} onClick={store}>{L('Uložiť do skrinky','Save to cabinet')}</button><button className="btn" onClick={()=>{setDraft({...draft,id:newToolId(),name:`${draft.name.slice(0,145)} · ${L('kópia','copy')}`});setNotice(L('Kópia je pripravená na uloženie.','Copy is ready to save.'));}}>{L('Duplikovať','Duplicate')}</button><button className="btn" disabled={!cabinet.some(t=>t.id===draft.id)} onClick={()=>message(()=>{persist(cabinet.filter(t=>t.id!==draft.id));setNotice(L('Nástroj odstránený zo skrinky. Osadenie stroja sa nemení.','Tool removed from cabinet. Machine installation is unchanged.'));})}>{L('Odstrániť zo skrinky','Remove from cabinet')}</button></div>
          <section className="tool-library-install"><h3>{L('Osadiť do stroja','Install in machine')} · {capacity} {L('miest','pockets')}</h3><p>{L('Uloženie v skrinke nemení stroj. Osadenie nahradí vybrané T a obnoví simuláciu od polotovaru.','Saving in the cabinet does not change the machine. Installing replaces the selected T and resets simulation to the blank.')}</p>
            <label>{L('Miesto zásobníka / číslo NC','Magazine pocket / NC number')}<select aria-label={L('Miesto zásobníka / číslo NC','Magazine pocket / NC number')} className="sel" value={pocket} onChange={e=>{setPocket(Number(e.target.value));setAck(false);}}>{Array.from({length:capacity},(_,i)=>i+1).map(t=><option key={t} value={t}>T{t} · {tools.find(x=>x.t===t)?.name||L('voľné','empty')}</option>)}</select></label>
            {Number(draft.t)>capacity&&<p className="tool-library-warning">{L('Predvolené T je mimo zásobníka. Pri osadení na iné miesto uprav rovnaké T aj v NC programe.','Preferred T exceeds magazine capacity. If installing at a different pocket, update the NC T number to match.')}</p>}
            {!canApply&&<p className="tool-library-warning">{busyNote}</p>}
            <label className="tool-library-check"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>{L('Potvrdzujem nahradenie T a obnovenie polotovaru.','Replace this T and reset the stock.')}</label>
            <button className="btn" disabled={!canApply||!ack||!valid||!!review} onClick={install}>{L('Osadiť vybraný nástroj','Install selected tool')}</button>
          </section>
        </main>
      </div>}
      {tab==='detect'&&<main className="tool-library-content"><h3>{L('Nástroje z NC programu','Tools from an NC program')}</h3><p>{L('Čítajú sa čísla T a explicitné metadáta v komentároch. H je register dĺžkovej korekcie a D v G41/G42 je register polomerovej korekcie; neudávajú rozmery. Chýbajúce údaje sa musia overiť v editore.','Reads T numbers and explicit comment metadata. H is a length-offset register and D in G41/G42 is a radius-offset register; they do not specify geometry. Missing data must be verified in the editor.')}</p>
        <div className="tool-library-actions"><button className="btn" onClick={()=>ncRef.current.click()}>{L('Vybrať .nc / .h…','Choose .nc / .h…')}</button><button className="btn" onClick={()=>{setNc(program);setNcName(L('Aktuálny program','Current program'));}}>{L('Použiť aktuálny program','Use current program')}</button><span>{ncName}</span></div>
        <textarea className="cnc-edit" spellCheck={false} rows={7} maxLength={MAX_FILE_BYTES} aria-label={L('NC pre detekciu nástrojov','NC for tool detection')} value={nc} onChange={e=>setNc(e.target.value.slice(0,MAX_FILE_BYTES))}/>
        <p>{detected.length} {L('zistených nástrojov','detected tools')}</p><div className="tool-library-detections">{detected.map(row=><article key={row.t}><strong>T{row.t} · {row.fields.name||L('Bez názvu','Unnamed')}</strong><p>{row.fields.d!==undefined?`Ø${row.fields.d} mm · `:''}{L('Chýba','Missing')}: {row.missing.join(', ')||'—'}</p>{row.conflicts.length>0&&<p className="tool-library-error">{L('Rozpory','Conflicts')}: {row.conflicts.join('; ')}</p>}<p className="muted">{L('V stroji','In machine')}: {tools.find(t=>t.t===row.t)?.name||L('neosadený','not installed')}{row.t>capacity?` · ${L('mimo kapacity zásobníka','outside magazine capacity')}`:''}</p><button className="btn" onClick={()=>reviewNc(row)}>{L('Otvoriť a overiť','Open & verify')}</button></article>)}</div>
        <p className="muted">{L('Detekcia nemení skrinku, program ani obrobok. Program z tohto okna načítaj až po kontrole nástrojov.','Detection does not change the cabinet, program or part. Load this program only after checking the tools.')}</p>
        <label className="tool-library-check"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>{L('Načítať tento program a obnoviť polotovar.','Load this program and reset the stock.')}</label><button className="btn" disabled={!canApply||!ack||!nc.trim()} onClick={()=>message(()=>{onLoadProgram(nc);setAck(false);setNotice(L('Program načítaný do editora stroja.','Program loaded into the machine editor.'));})}>{L('Načítať NC do stroja','Load NC into machine')}</button>
      </main>}
      {tab==='powermill'&&<main className="tool-library-content"><h3>Autodesk PowerMill → Hermle · {L('súbory','files')}</h3><p>{L('Prepojenie cez súbory: v PowerMill vytvor NC program postprocesorom pre zodpovedajúci stroj A/C a riadenie ISO/Fanuc alebo Heidenhain. Exportuj v mm, s dráhou stredu nástroja a nulovým bodom G54 v strede hornej plochy polotovaru.','File exchange: generate an NC program in PowerMill with a postprocessor matching the A/C machine and ISO/Fanuc or Heidenhain controller. Export in mm, using tool-centre paths and G54 at the centre of the blank’s top face.')}</p>
        <ol><li>{L('Načítaj .nc / .h do Detekcie z NC.','Load .nc / .h in Detect from NC.')}</li><li>{L('Over nástroje, ulož ich do skrinky a osaď na rovnaké T ako v NC.','Verify tools, save them to the cabinet and install at the NC T numbers.')}</li><li>{L('Načítaj program do stroja, skontroluj hlásenia interpretera a spusti simuláciu.','Load the program into the machine, check interpreter messages and run the simulation.')}</li><li>{L('Obrobený diel exportuj cez STP/STEP alebo STL v sekcii Výsledok.','Export the machined part through STP/STEP or STL in Results.')}</li></ol>
        <div className="tool-library-actions"><button className="btn" onClick={()=>{setTab('detect');ncRef.current.click();}}>{L('Načítať z PowerMill / CAM…','Load from PowerMill / CAM…')}</button><button className="btn" onClick={()=>message(()=>download(encodeToolComments(tools),'rmt-tool-metadata.nc','text/plain'))}>{L('Export metadát osadených nástrojov','Export installed tool metadata')}</button></div>
        <h3>{L('Metadáta postprocesora','Postprocessor metadata')}</h3><p>{L('Postprocesory sa líšia. Rozpoznávajú sa napríklad tieto komentáre (v mm); L znamená dĺžku od čela vretena po špičku, nie samotný brit.','Postprocessors vary. These comment formats are recognised (in mm); L means spindle-nose-to-tip length, not just the cutter length.')}</p><pre>{'(T3 D=10 CR=0 L=115 LC=25 S=48 DH=32 Z=3 TYPE=flat NAME=End mill 10)\n(TOOL NUMBER: 3)\n(TOOL NAME: End mill 10)\n(TOOL DIAMETER: 10)\n(CORNER RADIUS: 0)\n(GAUGE LENGTH: 115)'}</pre>
        <p>{L('JSON/CSV je prenosný formát tejto knižnice v mm. Pri prenose do PowerMill potrebuješ mapovanie polí alebo vlastný importér; nejde o jeho natívnu databázu nástrojov. Export metadát je súbor komentárov pre postprocesor, bez obrábacích pohybov.','JSON/CSV is this library’s portable millimetre format. Transfer to PowerMill requires field mapping or a custom importer; it is not its native tool database. The metadata export contains postprocessor comments and no machining moves.')}</p>
        <p className="tool-library-warning">{L('Projekty .pmlprj ani natívne dráhy sa do simulátora nepreberajú. Podporovaná je iba podmnožina NC príkazov uvedená v sekcii Program z CAM; nejde o verifikáciu výrobného NC programu.','.pmlprj projects and native toolpaths are not imported into the simulator. Only the NC subset listed in Program from CAM is supported; this is not production NC verification.')}</p>
        <a href="https://www.autodesk.com/products/powermill/product-details#all-features" target="_blank" rel="noreferrer">Autodesk PowerMill ↗</a>
      </main>}
    </section>
  </div>,document.body);
}
