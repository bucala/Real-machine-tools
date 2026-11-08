import { PartLabelsButton } from '../ui/common';
import { createEdmSparks } from './precision/edmSparks';
import { drawOscarScreen } from '../ui/machineScreens';
import { compileEdmGcode,EDM_GCODE_SAMPLE } from './precision/edmGcode';
import { workAreaFeed } from '../core/workAreaFeed';
import { SectionInfo } from '../ui/sectionInfo';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { L } from '../core/i18n';
import { createStage } from '../core/stage';
import { createInspector } from '../core/inspector';
import { createControls } from '../core/controls';
import { createWorkInspect } from '../core/workInspect';
import { exportStl } from '../core/export';
import { exportStep } from '../core/step';
import { createSound } from '../core/sound';
import { HelpFooter,PartsSection,SceneView,SegRow,Slider,Toggle,ViewSection,mkParts,useMachine,useTele } from '../ui/common';
import { StepDownloadButton } from '../ui/tools';
import { ElectrodeLibrary } from '../ui/electrodeLibrary';
import '../ui/toolPicker.css';
import { EdmFullscreen } from '../ui/edmFullscreen';
import { createStock } from './cnc/voxel';
import { EX500 } from './precision/profiles';
import { createEdmProcess } from './precision/edmProcess';
import { createOscarModel } from './precision/oscarModel';
const parts=()=>mkParts([
  ['lozko','Lôžko','Bed','EX 500 · masívne lôžko','EX 500 · massive bed','Stroj 3 000 kg, nosnosť obrobku 2 300 kg. Obrysy plechov podľa fotografií výrobcu.','3,000 kg machine, 2,300 kg workpiece capacity. Sheet-metal contours follow manufacturer photographs.'],
  ['osi','Osi X/Y/Z','X/Y/Z axes','Servoposuvy','Servo axes','Dráhy X 500 / Y 400 / Z 450 mm. Elektróda sa pri hĺbení netočí.','X 500 / Y 400 / Z 450 mm travel. The electrode does not rotate during sinking.'],
  ['stol','Stôl','Table','Stôl 850 × 450 mm','850 × 450 mm table','Obrobok je pevne upnutý. Pohyblivý stĺp nesie elektródu v XY; stôl a obrobok stoja.','The workpiece is clamped. The moving column carries the electrode in XY; the table and workpiece remain stationary.'],
  ['nadrz','Dielektrikum','Dielectric','Pracovná nádrž','Working tank','Dvere umožňujú nakladanie. Pri výboji musí hladina siahať aspoň 40 mm nad obrobok.','The gate allows loading. During discharge, fluid must cover the workpiece by at least 40 mm.'],
  ['generator','Generátor','Generator','60 A · 10 kVA','60 A · 10 kVA','Nádrž 850 l, filtrácia 20 µm, šesť vložiek. Úber a opotrebenie sú výučbové odhady.','850 l tank, 20 µm filtration, six elements. Removal rate and wear are educational estimates.'],
  ['bezpecnost','Senzory','Sensors','Ochrana pracovného priestoru','Working-area protection','Model UV snímača, hasiaceho zariadenia a trysiek. Simulácia kontroluje dvere, hladinu a výplach.','Modelled UV detector, extinguisher and nozzles. Simulation checks the gate, fluid level and flushing.'],
  ['panel','HMI','HMI','Mobilný panel EX','Mobile EX terminal','PC monitor, klávesnica a fyzické tlačidlá. V ručnom režime dvojklik na displej otvorí HMI.','PC monitor, keyboard and physical buttons. Double-click the display in manual mode to open HMI.'],
  ['obrobok','Obrobok','Workpiece','Hĺbená dutina','Sunk cavity','Tvar elektródy a výbojová medzera určujú geometriu dutiny. Export zachová aj prerušené hĺbenie.','Electrode shape and discharge gap determine the cavity. Export also preserves a paused cut.'],
]);
const save=(blob,name)=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);};
export default function OscarSimulator({onBack}){
  const mountRef=useRef(null),layerRef=useRef(null),tipRef=useRef(null);
  const {ctl,ui,set,setUi,selected,selectPart,apiRef}=useMachine({sparks:true,ncMode:'operations',ncText:EDM_GCODE_SAMPLE,manual:false,door:true,fill:false,light:true,flushing:true,estop:false,hmiLocked:false,hmiAngle:0,speed:20,current:30,gap:.05,electrode:{shape:'box',w:20,d:15,length:100},rows:[{x:-20,y:0,depth:8},{x:20,y:0,depth:5}]});
  const [tele,setTele]=useTele({phase:'idle',run:false,started:false,done:false,row:0,x:0,y:0,depth:-5,t:0,removed:0,wear:0,oilLevel:0,alarm:null,sparking:false});
  const [hmiOpen,setHmiOpen]=useState(false),[notice,setNotice]=useState(''),[library,setLibrary]=useState(null);
  useEffect(()=>{
    const c=ctl.current,mount=mountRef.current;
    const {scene,camera,renderer,snapshot,dispose:disposeStage}=createStage(mount,{far:400,floorSize:300,gridSize:200,fogNear:150,fogFar:350});
    const snd=createSound('mill'),dom=renderer.domElement,root=new THREE.Group();scene.add(root);
    apiRef.current.machineModel = { root, name: 'OSCARMAX EX 500' };
    const mat=(color,metal=.25,rough=.5)=>new THREE.MeshStandardMaterial({color:new THREE.Color(color).convertSRGBToLinear(),metalness:metal,roughness:rough});
    const M={cab:mat(0xbdc5c1,.25,.44),cab2:mat(0xa9b2ae,.3,.5),steel:mat(0xd6dad8,.7,.23),steelD:mat(0x747d80,.55,.4),inox:mat(0xc2c7c6,.48,.38),table:mat(0xb1b9b9,.65,.3),black:mat(0x151b1c,.04,.8),dark:mat(0x343e40,.18,.65),red:mat(0xcc2431,.15,.32),blue:mat(0x2854a0),yellow:mat(0xf0df36),green:mat(0x299d75),brass:mat(0xb49b57,.7),copper:mat(0xb77848,.8,.3),graphite:mat(0x303235,.05,.95),oil:new THREE.MeshStandardMaterial({color:0x8a9878,transparent:true,opacity:.18,roughness:.16,metalness:.15,depthWrite:false,side:THREE.DoubleSide})};
    const tex=(w,h,draw)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;const redraw=()=>{draw(cv.getContext('2d'),w,h);tx.needsUpdate=true;};redraw();return {tx,redraw};};
    const G={},model=createOscarModel({root,G,M,tex}),sparks=createEdmSparks(root);
    const stockG=new THREE.Group();stockG.userData.part='obrobok';stockG.userData.stepJoin=true;stockG.rotation.x=-Math.PI/2;stockG.scale.setScalar(.01);model.stockMount.add(stockG);G.obrobok=stockG;
    const stockMat=mat(0x899299,.7,.4),chunks=new Map();let stock,process,ncCommands=null,ncEndApplied=false;
    const flush=()=>{for(const p of stock.takeDirty()){let me=chunks.get(p.id);if(!p.idx.length){if(me){stockG.remove(me);me.geometry.dispose();chunks.delete(p.id);}continue;}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(p.nor,3));g.setIndex(new THREE.BufferAttribute(p.idx,1));g.computeBoundingSphere();if(me){me.geometry.dispose();me.geometry=g;}else{me=new THREE.Mesh(g,stockMat);me.castShadow=true;me.receiveShadow=true;stockG.add(me);chunks.set(p.id,me);}}};
    const reset=()=>{if(c.unclamped)return;for(const me of chunks.values()){stockG.remove(me);me.geometry.dispose();}chunks.clear();stock=createStock({min:[-50,-40,0],max:[50,40,30],res:.7});process=createEdmProcess(stock);ncCommands=null;ncEndApplied=false;flush();c.running=false;setNotice('');};reset();
    let oilLevel=0,gate=1,depth=-5,last=performance.now(),t=0,teleT=0,signature='',raf;
    const cfg=()=>({rows:c.rows,electrode:c.electrode,current:c.current,gap:c.gap,oilLevel:oilLevel-50,fixtureHeight:50,ncCommands:c.ncMode==='gcode'?ncCommands:null});
    const compile=()=>{if(process.job||process.S.run||c.unclamped){setNotice(L('Najprv Reset pre nový program.','Reset before loading a new program.'));return false;}try{const result=compileEdmGcode(c.ncText);ncCommands=result;set('rows',result.rows);process.S.alarm=null;setNotice(L('NC program načítaný.','NC program loaded.'));return true;}catch(e){setNotice(e.message);process.stop(e.message);return false;}};
    const start=()=>{
      if(c.ncMode==='gcode'&&!process.job&&!compile())return;
      if(c.unclamped||gate>.01||c.door||c.estop){process.stop(L('Zatvor nádrž, upni obrobok, uvoľni STOP a zapni výplach.','Close the tank, clamp the workpiece, release STOP and enable flushing.'));return;}
      if(c.ncMode==='gcode'&&!process.job&&ncCommands?.startFlushing===true)set('flushing',true);
      if(!c.flushing){process.stop(L('Zapni výplach.','Enable flushing.'));return;}
      process.start(cfg());c.running=process.S.run;
    };
    const hold=()=>{process.hold();c.running=false;};
    const actions={start,hold,reset,emergency:()=>{set('estop',!c.estop);hold();if(c.estop)process.stop(L('Núdzový STOP','Emergency STOP'));},coolant:()=>set('flushing',!c.flushing),light:()=>set('light',!c.light)};
    apiRef.current={...apiRef.current,start,hold,reset,compileNc:compile,setNcText:text=>{if(!process.job&&!process.S.run&&!c.unclamped)set('ncText',text);},hmiAction:id=>actions[id]?.(),setSpeed:v=>set('speed',v),getHmiCanvas:()=>screen.tx.image,snapshot,lockHmi:()=>set('hmiLocked',!c.hmiLocked)};
    apiRef.current.exportStep=async()=>{if(process.S.run)throw new Error(L('Najprv zastav hĺbenie.','Stop sinking first.'));flush();return exportStep(stockG);};
    apiRef.current.stl=()=>{if(process.S.run)return null;flush();return exportStl(stockG);};
    const screen=tex(1040,650,(g,w,h)=>drawOscarScreen(g,w,h,{S:process.S,c,oilLevel}));model.display.material.map=screen.tx;
    const v=(x,y,z)=>new THREE.Vector3(x,y,z);
    const views={celok:()=>[[25,21,43],[0,13,-1]],priestor:()=>[[3.7,12,3.2],[0,9.7,0],true],lavy:()=>[[-31,22,32],[0,13,-3]],hlava:()=>[[-8,15,16],[0,14,0],true],obrobok:()=>[[2.4,11.8,3.6],[0,9.7,0],true],panel:()=>{const p=model.panelPivot.getWorldPosition(v(0,0,0)).add(v(0,11,0)),d=v(3,3,13).applyAxisAngle(v(0,1,0),model.panelPivot.rotation.y);return [p.clone().add(d).toArray(),p.toArray()];},zhora:()=>[[.01,70,-1],[0,10,-1],true]};
    apiRef.current.mountWorkArea=workAreaFeed({scene,camera,renderer,view:views.priestor});
    const anchors=Object.fromEntries(Object.keys(G).map(k=>[k,()=>G[k].getWorldPosition(v(0,0,0)).add(v(0,4,0))]));
    const insp=createInspector({dom,mount,camera,root,G,anchors,views,labelEls:[...layerRef.current.querySelectorAll('[data-part]')],enabled:()=>!c.manual&&!c.unclamped,onPick:k=>apiRef.current.onPick(k),blockPick:()=>ctrl.isUsed()||c.unclamped,onHL:()=>ctrl.invalidate(),orbitOptions:{maxDistance:180,maxTargetY:45}});
    const ctrl=createControls({dom,mount,camera,root,tipEl:tipRef.current,c,getT:()=>t,getHL:insp.hl});
    for(const [id,o] of Object.entries(model.controls.buttons))ctrl.reg({type:'button',pressAxis:id==='emergency'?'y':'z',label:({start:L('Štart cyklu','Cycle start'),hold:L('Stop posuvu','Feed hold'),reset:'Reset',light:L('Svetlo','Light'),coolant:L('Výplach','Flushing'),emergency:L('Núdzový STOP','Emergency STOP')})[id],action:actions[id],latched:id==='emergency'?()=>c.estop:undefined},o);
    ctrl.reg({type:'slide',axis:'y',tooltip:false,label:L('Dvere nádrže','Tank gate'),click:()=>ctrl.push('door',!c.door),start:()=>{},slide:dy=>{if(Math.abs(dy)>.1)ctrl.push('door',dy<0);}},model.gate);
    const openHmi=e=>{if(c.manual&&ctrl.pickAt(e.clientX,e.clientY)?.object===model.display){e.preventDefault();setHmiOpen(true);}};dom.addEventListener('dblclick',openHmi);
    let saved={};const wi=createWorkInspect({scene,camera,dom,insp,c,getObj:()=>stockG,getSpot:()=>v(0,12,14),canDetach:()=>gate>.995&&oilLevel<.5&&depth<-4.9,onState:unclamped=>{set('unclamped',unclamped);set('manual',unclamped?false:saved.manual);if(!unclamped){set('door',saved.door);set('fill',saved.fill);}}});
    apiRef.current.toggleWork=()=>{if(wi.phase()==='in'){hold();saved={manual:c.manual,door:c.door,fill:c.fill};set('door',true);set('fill',false);}wi.toggle();};
    apiRef.current.view=n=>{if(!c.unclamped)insp.goView(n,false);};insp.goView('celok',true);
    const tick=(dt,render=true)=>{
      t+=dt;
      gate+=((c.door?1:0)-gate)*Math.min(1,dt*5);
      const targetOil=c.fill&&!c.door&&!c.unclamped?130:0;oilLevel+=Math.sign(targetOil-oilLevel)*Math.min(Math.abs(targetOil-oilLevel),dt*40);
      if(c.door||c.estop||c.unclamped)hold();
      process.advance(dt*c.speed,{door:c.door||gate>.01,oilLevel:oilLevel-50,flushing:c.flushing,estop:c.estop});c.running=process.S.run;
      if(process.S.done&&!ncEndApplied){ncEndApplied=true;const end=process.job?.ncCommands?.endFlushing;if(typeof end==='boolean')set('flushing',end);}
      const e=JSON.stringify(c.electrode);if(e!==signature){signature=e;model.buildElectrode(c.electrode);model.electrode.userData.length=c.electrode.length;}
      depth+=((c.unclamped?-5:process.S.depth)-depth)*Math.min(1,dt*15);
      model.update({S:{...process.S,depth},oilLevel,door:gate,light:c.light,hmiAngle:c.hmiAngle});
      sparks.update({S:process.S,c,t});flush();wi.update(dt);insp.update(t,c);ctrl.update(dt);
      if(Object.keys(ctrl.pend).length){const next={...ctrl.pend};for(const k of Object.keys(ctrl.pend))delete ctrl.pend[k];setUi(u=>({...u,...next}));}
      snd.update({motor:process.S.run?.08:0,cut:process.S.sparking?.05:0});
      if(t-teleT>.15){teleT=t;screen.redraw();setTele({...process.S,oilLevel,started:!!process.job});}
      if(render)renderer.render(scene,camera);
    };
    const loop=now=>{raf=requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;tick(dt);};raf=requestAnimationFrame(loop);
    if(/[?&]debug/.test(window.location.search))window.__oscar={c,root,camera,model,sparks,stockG,insp,ctrl,wi,advance:dt=>tick(dt,false),api:apiRef.current,get process(){return process;},get stock(){return stock;}};
    return()=>{cancelAnimationFrame(raf);dom.removeEventListener('dblclick',openHmi);snd.dispose();ctrl.dispose();wi.dispose();insp.dispose();delete window.__oscar;disposeStage();};
  },[]);
  const p=parts(),locked=tele.run||tele.started||ui.unclamped;
  const number=(label,value,min,max,onChange,step=1)=><label className="text-xs">{label}<input className="sel" type="number" min={min} max={max} step={step} value={value} onChange={e=>onChange(Math.max(min,Math.min(max,Number(e.target.value)||min)))}/></label>;
  return <div className="machine-app modern-app hermle-app oscar-app w-full flex flex-col md:flex-row">
    <SceneView {...{mountRef,layerRef,tipRef,ui,set,selected,selectPart,onBack,apiRef}} parts={p} canUnclamp workBelowModes chips={[{color:tele.run?'#34d399':'#94a3b8',text:tele.run?L('Hĺbenie','Sinking'):L('Stojí','Stopped')},{color:ui.door?'#f0c93e':'#34d399',text:ui.door?L('Nádrž otvorená','Tank open'):L('Nádrž zatvorená','Tank closed')}]}
      tools={<button className={`scene-btn ${ui.hmiLocked?'on':''}`} aria-pressed={ui.hmiLocked} onClick={()=>apiRef.current.lockHmi?.()}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg> HMI</button>}
      manualHint={L('Klikaj na tlačidlá panela. Dvere nádrže potiahni zvisle alebo klikni. Dvojklik na displej otvorí HMI.','Click the terminal buttons. Drag the tank gate vertically or click it. Double-click the display to open HMI.')} />
    {library&&<ElectrodeLibrary mode={library} canApply={!locked} onClose={()=>setLibrary(null)} onChoose={e=>{if(!e||ctl.current.running||ctl.current.unclamped)throw new Error(L('Najprv zastav stroj a upni obrobok.','Stop the machine and clamp the workpiece first.'));set('electrode',e);setLibrary(null);}}/>}
    {hmiOpen&&<EdmFullscreen {...{apiRef,ui,tele}} onClose={()=>setHmiOpen(false)}/>}
    <aside className="panel">
      <div className="sec"><p className="sec-title">{L('Moderné stroje · hĺbiaca EDM','Modern machines · sinker EDM')}</p><div className="section-heading"><h1 className="app-title mt-2" tabIndex={-1}>OSCARMAX EX 500</h1><PartLabelsButton ui={ui} set={set}/><SectionInfo title={"OSCARMAX EX 500"}><p className="text-xs muted">X 500 / Y 400 / Z 450 mm · {L('stôl','table')} 850 × 450 mm · 60 A · 10 kVA · 850 l · {L('nosnosť','capacity')} 2 300 kg.</p></SectionInfo></div>

        <div className="cnc-dro mt-3"><div className="cnc-dro-col">{[['X',tele.x],['Y',tele.y],['Z',-tele.depth]].map(([k,v])=><div key={k} className="cnc-dro-row"><span>{k}</span><b>{v.toFixed(3)}</b></div>)}</div><div className="cnc-dro-col"><div className="cnc-dro-row"><span>A</span><b>{tele.sparking?ui.current:0}</b></div><div className="cnc-dro-row"><span>OIL</span><b>{tele.oilLevel.toFixed(0)} mm</b></div><div className="cnc-dro-row"><span>OP</span><b>{tele.row+1}/{ui.rows.length}</b></div></div></div>
        <div className={`msg msg-${tele.alarm?'danger':tele.run?'run':'idle'}`} role="status">{tele.alarm||notice||(tele.done?L('Hĺbenie dokončené','Sinking complete'):tele.run?L('Prebieha hĺbenie','Sinking in progress'):L('Zatvor nádrž, napusť dielektrikum a spusti cyklus.','Close the tank, fill dielectric, then start the cycle.'))}</div>
      </div>
      <div className="sec"><h2 className="sec-title mb-2">{L('Prevádzka','Operation')}</h2><div className="cnc-run"><button className="btn-run start" disabled={ui.unclamped} onClick={()=>apiRef.current.start?.()}>▶ {L('Štart cyklu','Cycle start')}</button><button className="btn" onClick={()=>apiRef.current.hold?.()}>❚❚ {L('Stop posuvu','Feed hold')}</button><button className="btn" disabled={ui.unclamped} onClick={()=>apiRef.current.reset?.()}>↺ Reset</button></div>
        <div className="flex gap-2 flex-wrap mt-2"><button className={`btn ${ui.estop?'active':''}`} onClick={()=>apiRef.current.hmiAction?.('emergency')}>{ui.estop?L('Uvoľniť STOP','Release STOP'):L('Núdzový STOP','Emergency STOP')}</button><button className="btn" disabled={ui.unclamped} onClick={()=>{set('door',!ui.door);if(!ui.door)set('fill',false);}}>{ui.door?L('Zatvoriť nádrž','Close tank'):L('Otvoriť nádrž','Open tank')}</button></div>
        <Toggle on={ui.fill} label={L('Napustiť dielektrikum','Fill dielectric')} onClick={()=>{if(ui.door||ui.unclamped){setNotice(L('Najprv zatvor nádrž.','Close the tank first.'));return;}setNotice('');set('fill',!ui.fill);}}/>
        <Toggle on={ui.sparks} label={L('Iskrenie erózie','EDM discharge effect')} onClick={()=>set('sparks',!ui.sparks)}/><Toggle on={ui.flushing} label={L('Výplach elektródy','Electrode flushing')} onClick={()=>set('flushing',!ui.flushing)}/><Toggle on={ui.light} label={L('Pracovné osvetlenie','Work light')} onClick={()=>set('light',!ui.light)}/>
        <SegRow label={L('Rýchlosť simulácie','Simulation speed')} value={ui.speed} options={[[1,'×1'],[20,'×20'],[80,'×80']]} onChange={v=>set('speed',v)}/>
        <fieldset disabled={ui.hmiLocked} className="hermle-hmi-position"><Slider id="ex-hmi" label={L('Natočenie HMI','HMI rotation')} min={-110} max={110} value={ui.hmiAngle} unit="°" onChange={v=>set('hmiAngle',v)}/></fieldset><button className="btn" onClick={()=>apiRef.current.view?.('panel')}>{L('Pohľad na HMI','HMI view')}</button>{ui.manual&&<button className="btn ml-2" onClick={()=>setHmiOpen(true)}>{L('HMI cez celé okno','Full-screen HMI')}</button>}
      </div>
      <div className="sec"><div className="section-heading"><h2 className="sec-title mb-2">{L('Elektróda a generátor','Electrode and generator')}</h2><SectionInfo title={L('Elektróda a generátor','Electrode and generator')}><p className="text-xs muted">{L('Medená alebo grafitová elektróda, oceľový polotovar 100 × 80 × 30 mm. Nastavenie procesu a úberová rýchlosť sú výučbové, nie emulácia technológie výrobcu. Po rozbehnutí cyklu zmeny odomkne Reset (nový polotovar).','Copper or graphite electrode, 100 × 80 × 30 mm steel blank. Process parameters and removal rate are educational, not manufacturer technology emulation. After starting, Reset unlocks edits and creates a new blank.')}</p></SectionInfo></div><fieldset disabled={locked} className="hermle-settings">
        <div className="flex flex-wrap gap-2 mb-3"><button className="btn" onClick={()=>setLibrary('pick')}>{L('Vybrať elektródu zo skrinky…','Choose electrode from cabinet…')}</button><button className="btn" onClick={()=>setLibrary('manage')}>{L('Spravovať skrinku…','Manage cabinet…')}</button></div>
        <p className="text-sm mb-3">{ui.electrode.material==='graphite'?L('Grafit','Graphite'):'Cu'} · {ui.electrode.shape==='round'?`Ø${ui.electrode.w}`:`${ui.electrode.w} × ${ui.electrode.d}`} · L{ui.electrode.length} mm</p>
        <Slider id="ex-current" label={L('Pracovný prúd','Working current')} min={1} max={EX500.current} value={ui.current} unit="A" onChange={v=>set('current',v)}/><Slider id="ex-gap" label={L('Výbojová medzera','Discharge gap')} min={.01} max={.2} step={.01} digits={2} value={ui.gap} unit="mm" onChange={v=>set('gap',v)}/>
      </fieldset></div>
      <div className="sec"><div className="section-heading"><h2 className="sec-title mb-2">{L('Program hĺbenia','Sinking program')}</h2><SectionInfo title={L('Program hĺbenia','Sinking program')}><p className="text-xs muted mt-2">{L('Každá operácia: bezpečný zdvih → presun XY → hĺbenie → odtiahnutie. Elektróda sa netočí; dutina kopíruje jej tvar vrátane medzery.','Each operation: safe lift → XY move → sink → retract. The electrode does not rotate; the cavity follows its shape including the gap.')}</p></SectionInfo></div><fieldset disabled={locked} className="hermle-settings"><SegRow label={L('Riadenie','Control')} value={ui.ncMode} options={[["operations",L('Operácie','Operations')],["gcode","G-kód / ISO"]]} onChange={v=>set('ncMode',v)}/>{ui.ncMode==='gcode'&&<div className="edm-nc-editor"><label htmlFor="edm-nc">{L('NC program · G54 Z0 = horná plocha obrobku','NC program · G54 Z0 = blank top')}</label><textarea id="edm-nc" rows={14} spellCheck={false} value={ui.ncText} onChange={e=>apiRef.current.setNcText(e.target.value)}/><div className="flex flex-wrap gap-2 mt-2"><button className="btn" onClick={()=>apiRef.current.compileNc()}>{L('Skontrolovať a načítať NC','Check and load NC')}</button><button className="btn" onClick={()=>apiRef.current.setNcText(EDM_GCODE_SAMPLE)}>{L('Ukážkový program','Sample program')}</button><label className="btn">{L('Otvoriť NC súbor','Open NC file')}<input hidden type="file" accept=".nc,.tap,.txt,.iso" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>256000){setNotice('NC: max. 256 kB');return;}apiRef.current.setNcText(await f.text());}}/></label></div><SectionInfo title="G-kód / ISO"><p>G0 / G1 · G21 · G90 / G91 · G54 · G94 · F (mm/min) · M3/M5 · M8/M9 · M2/M30. {L('Pred XY presunom a na konci programu použi G0 Z5. Podporované je zvislé hĺbenie; nepodporované bloky sa odmietnu s číslom riadku. Posuv F obmedzí výučbový servo-prísuv.','Use G0 Z5 before XY moves and at program end. Vertical burns are supported; unsupported blocks are rejected with their line number. F limits the training servo feed.')}</p></SectionInfo></div>}<fieldset disabled={ui.ncMode==='gcode'} className="edm-operations">{ui.rows.map((r,i)=><div className="edm-operation" key={i}><b>{i+1}</b>{number('X mm',r.x,-40,40,v=>set('rows',ui.rows.map((r,j)=>j===i?{...r,x:v}:r)))}{number('Y mm',r.y,-30,30,v=>set('rows',ui.rows.map((r,j)=>j===i?{...r,y:v}:r)))}{number(L('Hĺbka mm','Depth mm'),r.depth,.1,29,v=>set('rows',ui.rows.map((r,j)=>j===i?{...r,depth:v}:r)),.1)}<button className="btn" disabled={ui.rows.length===1} aria-label={L(`Odstrániť operáciu ${i+1}`,`Remove operation ${i+1}`)} onClick={()=>set('rows',ui.rows.filter((_,j)=>j!==i))}>×</button></div>)}</fieldset><button className="btn mt-2" disabled={ui.ncMode==='gcode'||ui.rows.length>=12} onClick={()=>set('rows',[...ui.rows,{x:0,y:0,depth:5}])}>+ {L('Operácia','Operation')}</button></fieldset>

      </div>
      <div className="sec"><h2 className="sec-title mb-2">{L('Výsledok','Result')}</h2><p className="text-sm tnum">{L('Čas','Time')} {Math.floor(tele.t/60)}:{String(Math.floor(tele.t%60)).padStart(2,'0')} · {L('Úber','Removed')} {(tele.removed/1000).toFixed(3)} cm³</p><p className="text-xs muted">{L('Odhad opotrebenia elektródy','Estimated electrode wear')}: {tele.wear.toFixed(3)} mm · {L('Sieť','Mesh')}: 0,7 mm</p><div className="flex flex-wrap gap-2 mt-2"><button className="btn" disabled={tele.run} onClick={()=>save(apiRef.current.stl?.(),'oscarmax-ex500.stl')}>STL</button><StepDownloadButton machine="oscarmax-ex500" apiRef={apiRef}/><button className="btn" onClick={()=>apiRef.current.snapshot?.(b=>save(b,'oscarmax-ex500.png'))}>PNG</button></div></div>
      <ViewSection apiRef={apiRef} views={[["celok",L('Celok','Overview')],["priestor",L('Pracovný priestor','Working area')],["lavy",L('Ľavý bok','Left side')],["hlava",L('Detail hlavy','Head detail')],["obrobok",L('Obrobok','Workpiece')],["panel","HMI"],["zhora",L('Zhora','Top')]]}/><PartsSection parts={p} {...{selected,selectPart}}/><HelpFooter apiRef={apiRef} ui={ui}/>
    </aside>
  </div>;
}
