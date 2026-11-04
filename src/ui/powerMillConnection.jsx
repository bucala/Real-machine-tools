import { useEffect, useRef, useState } from 'react';
import { L } from '../core/i18n';
import { getPowerMillToken, powerMillRequest, powerMillToolsToNc, setPowerMillToken } from '../machines/cnc/powerMill';

export function PowerMillConnection({tool,onDetect}) {
  const [token,setToken]=useState(getPowerMillToken),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[snapshot,setSnapshot]=useState(null),[ncName,setNcName]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const requestRef=useRef(null);
  useEffect(()=>()=>requestRef.current?.abort(),[]);
  const action=async(fn)=>{
    if(busy)return;setBusy(true);setError('');setNotice('');
    const controller=new AbortController();requestRef.current=controller;
    const request=(path,body)=>powerMillRequest(path,{token,body,signal:controller.signal});
    try{await fn(request);}catch(e){if(!controller.signal.aborted){setError(e.message);setConnected(false);}}finally{if(!controller.signal.aborted)setBusy(false);}
  };
  return <section className="tool-library-live" aria-labelledby="pm-live-title"><h3 id="pm-live-title">{L('Živé prepojenie s PowerMillom vo Windows','Live connection to PowerMill on Windows')}</h3>
    <p>{L('Spusti lokálny most na tom istom počítači ako prehliadač a PowerMill. Vlož token z jeho okna. Token zostáva iba v pamäti tejto relácie.','Run the local bridge on the same computer as the browser and PowerMill. Paste its pairing token. The token stays in this session’s memory only.')}</p>
    <div className="tool-library-actions"><a className="btn" href="/rmt-powermill-bridge.zip" download>{L('Stiahnuť most pre Windows','Download Windows bridge')}</a><a href="https://github.com/bucala/Real-machine-tools/blob/main/integrations/powermill/README.md" target="_blank" rel="noreferrer">{L('Inštalácia a spustenie','Setup instructions')} ↗</a></div>
    <label>{L('Párovací token mosta','Bridge pairing token')}<input className="sel" type="password" autoComplete="off" spellCheck={false} value={token} disabled={busy} onChange={e=>{setToken(e.target.value.trim());setConnected(false);setSnapshot(null);}}/></label>
    <div className="tool-library-actions"><button className="btn" disabled={busy||!token} onClick={()=>action(async request=>{const data=await request('status');if(!data.connected)throw new Error('PowerMill nie je pripojený / PowerMill is not connected.');setPowerMillToken(token);setConnected(true);setNotice(data.busy?L('Pripojené; PowerMill práve pracuje.','Connected; PowerMill is busy.'):L('Pripojené k bežiacemu PowerMillu.','Connected to the running PowerMill.'));})}>{busy?L('Komunikujem…','Working…'):L('Pripojiť / overiť stav','Connect / check status')}</button><button className="btn" disabled={busy} onClick={()=>{setPowerMillToken('');setToken('');setConnected(false);setSnapshot(null);setNotice(L('Odpojené. PowerMill zostáva otvorený.','Disconnected. PowerMill stays open.'));}}>{L('Odpojiť','Disconnect')}</button></div>
    {error&&<p className="tool-library-error" role="alert">{error}</p>}{notice&&<p className="tool-library-notice" role="status">{notice}</p>}
    <div className="tool-library-actions"><button className="btn" disabled={busy||!connected} onClick={()=>action(async request=>{const data=await request('snapshot');setSnapshot(data);setNcName(data.ncPrograms?.[0]?.name||'');setNotice(L(`Prevzatých ${data.tools.length} nástrojov z otvoreného projektu.`,`${data.tools.length} tools read from the open project.`));})}>{L('Obnoviť nástroje a NC programy','Refresh tools & NC programs')}</button>
      <button className="btn" disabled={busy||!connected||!snapshot?.tools?.length} onClick={()=>{try{onDetect(powerMillToolsToNc(snapshot),'PowerMill · live');}catch(e){setError(e.message);}}}>{L('Overiť prevzaté nástroje v knižnici','Review retrieved tools in library')}</button></div>
    {snapshot&&<div><p>{snapshot.tools.length} {L('nástrojov','tools')} · {snapshot.ncPrograms.length} NC · {L('jednotky projektu','project units')}: {snapshot.sourceUnits}</p>{snapshot.warnings?.map((warning,i)=><p key={i} className="tool-library-warning">{warning}</p>)}
      <label>{L('Vygenerovaný NC program v PowerMill','Posted NC program in PowerMill')}<select className="sel" aria-label={L('Vygenerovaný NC program v PowerMill','Posted NC program in PowerMill')} value={ncName} disabled={busy} onChange={e=>setNcName(e.target.value)}>{!snapshot.ncPrograms.length&&<option value="">{L('Žiadne NC programy','No NC programs')}</option>}{snapshot.ncPrograms.map((nc,i)=><option key={i} value={nc.name}>{nc.name}</option>)}</select></label>
      <button className="btn" disabled={busy||!connected||!ncName} onClick={()=>action(async request=>{const data=await request('nc',{name:ncName});onDetect(data.text,`PowerMill · ${data.name}`);})}>{L('Prevziať NC do detekcie','Retrieve NC for review')}</button>
    </div>}
    <div className="tool-library-install"><h3>{L('Vytvoriť kópiu nástroja v PowerMill','Create a tool copy in PowerMill')}</h3><p>{tool?`${tool.name} · T${tool.t} · Ø${tool.d} · LC${tool.lc} · S${tool.s} mm`:L('Najprv v skrinke vyber a over platný nástroj.','Select and verify a valid tool in the cabinet first.')}</p><p>{L('Vytvorí nový nástroj s jedinečným názvom RMT. Rezná časť používa LC, vyloženie S a držiak je približný valec ØH s dĺžkou L − S. Skutočný HSK držiak a korekčnú dĺžku over v PowerMill pred použitím. Existujúce nástroje sa nenahrádzajú.','Creates a new tool with a unique RMT name. Cutter length is LC, overhang is S, and the approximate holder is a cylinder of ØH and length L − S. Verify the real HSK holder and gauge length in PowerMill before use. Existing tools are not replaced.')}</p>
      <button className="btn" disabled={busy||!connected||!tool} onClick={()=>action(async request=>{const data=await request('tools',{tool});setNotice(`${L('Vytvorený nástroj','Created tool')}: ${data.name}. ${data.warning}`);setSnapshot(null);})}>{L('Vytvoriť nový nástroj v PowerMill','Create new tool in PowerMill')}</button>
    </div>
  </section>;
}
