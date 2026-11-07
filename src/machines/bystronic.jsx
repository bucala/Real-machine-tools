import { useEffect,useRef,useState } from 'react';
import * as THREE from 'three';
import { L } from '../core/i18n';
import { createStage } from '../core/stage';
import { createInspector } from '../core/inspector';
import { createControls } from '../core/controls';
import { createWorkInspect } from '../core/workInspect';
import { createSound } from '../core/sound';
import { exportStl } from '../core/export';
import { exportStep } from '../core/step';
import { HelpFooter,PartsSection,SceneView,SegRow,Slider,Toggle,ViewSection,mkParts,useMachine,useTele } from '../ui/common';
import { SectionInfo } from '../ui/sectionInfo';
import { StepDownloadButton } from '../ui/tools';
import { BystronicHmi,drawBrakeHmi } from '../ui/bystronicHmi';
import { createBystronicModel } from './precision/bystronicModel';
import { createBrakeProcess,brakeSetup,XPERT320 } from './precision/pressBrakeProcess';
import '../ui/bystronic.css';

const parts=()=>mkParts([
  ['ram',L('Rám','Frame'),'Frame','Xpert Pro 320/4300','Xpert Pro 320/4300','Rám 5 260 × 2 000 × 3 170 mm. Sila 3 200 kN, hmotnosť 24,3 t.','5,260 × 2,000 × 3,170 mm frame. 3,200 kN capacity, 24.3 t weight.'],
  ['kryty','Kryty','Covers','Horné okrytovanie','Upper enclosure','Čierny tvarovaný kryt, biele bočnice a pracovné osvetlenie podľa fotografií.','Shaped black visor, white cheeks and task lighting from photographs.'],
  ['baran','Baran Y1/Y2','Y1/Y2 ram','Synchronizovaný baran','Synchronised ram','Zdvih 250 mm, otvorenie bez nástrojov 640 mm. Horný nástroj sa pohybuje s baranom.','250 mm stroke, 640 mm opening without tooling. Upper tooling follows the ram.'],
  ['stol','Stôl a matrica','Bed and die','V-matrica a spodný stôl','V die and lower bed','Pracovná dĺžka 4 300 mm, stôl 74 mm. Vymeniteľná V-matrica a kazeta bombírovania.','4,300 mm bending length, 74 mm table. Replaceable V die and crowning cassette.'],
  ['dorazy','Dorazy X/R/Z','X/R/Z gauges','Zadné dorazy','Back gauges','Rozsah X do 1 050 mm, zdvih R 250 mm, dráha Z 2 900 mm. Prsty sa rozostavia podľa plechu.','X range up to 1,050 mm, R travel 250 mm, Z travel 2,900 mm. Fingers spread to suit the sheet.'],
  ['podpery','Podpery','Supports','Predné podpery plechu','Front sheet supports','Posuvné ramená s valčekmi a pomocná podpera. Tvary príslušenstva sú odhadnuté z fotografií.','Sliding roller arms and auxiliary support. Accessory shapes are reconstructed from photographs.'],
  ['ochrana','Ochrana','Guards','Bočné dvere a laserové snímače','Side doors and laser sensors','Otvorené kryty alebo prekážka v ochrannom poli zastavia simulovaný cyklus.','Open guards or an obstructed safety field stop the simulated cycle.'],
  ['panel','HMI','HMI','Mobilný dotykový panel','Mobile touch terminal','Displej v modeli a vo veľkom okne používa rovnaké údaje. Výučbové rozhranie, nie emulácia ByVision.','The model and fullscreen share the same display. A training interface, not a ByVision emulation.'],
  ['pedal','Pedál','Pedal','Nožné ovládanie','Foot controls','V ručnom režime ľavý pedál spustí cyklus, pravý zdvihne baran.','In manual mode the left pedal starts the cycle; the right retracts the ram.'],
  ['servis','Servisné kryty','Service panels','Zadná časť stroja','Rear enclosure','Ventilácia, rozdelenie panelov, pánty a servisné uzávery podľa zadného pohľadu.','Ventilation, panel divisions, hinges and service latches follow the rear reference.'],
  ['plech','Plech','Sheet','Ohýbaný diel','Bent workpiece','Súvislý plech s hrúbkou a polomerom ohybu. Po zdvihnutí barana sa dá prezrieť a exportovať.','Continuous sheet with thickness and bend radius. Inspect and export after retracting the ram.'],
]);
const save=(blob,name)=>{if(!blob)return;const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),4000);};
const getSetup=c=>{try{return {value:brakeSetup(c),error:null};}catch(e){return {value:null,error:e.message};}};
export default function BystronicSimulator({onBack}){
  const mountRef=useRef(null),layerRef=useRef(null),tipRef=useRef(null);
  const {ctl,ui,set,setUi,selected,selectPart,apiRef}=useMachine({manual:false,hydraulic:true,estop:false,guardOpen:false,obstructed:false,cutaway:false,light:true,hmiAngle:-10,speed:1,material:'steel',thickness:4,length:2400,depth:600,flange:150,v:32,angle:90,r:0});
  const [tele,setTele]=useTele({phase:'idle',run:false,paused:false,done:false,complete:false,y:0,beta:0,force:0,t:0,alarm:null,hasJob:false});
  const [hmi,setHmi]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{
    const c=ctl.current,mount=mountRef.current,{scene,camera,renderer,snapshot,dispose:disposeStage}=createStage(mount,{far:700,floorSize:400,gridSize:250,fogNear:180,fogFar:500});
    const dom=renderer.domElement,root=new THREE.Group();scene.add(root);const G={};
    const mat=(color,metal=.2,rough=.5)=>new THREE.MeshStandardMaterial({color:new THREE.Color(color).convertSRGBToLinear(),metalness:metal,roughness:rough});
    const M={cab:mat(0xd7dbdd,.25,.36),cab2:mat(0xb6bdc2,.3,.42),dark:mat(0x282c32),anth:mat(0x484c53,.3),black:mat(0x14171b,.1,.7),visor:mat(0x202126,.38,.19),red:mat(0xf44d34,.22,.32),steel:mat(0xc6ced2,.8,.22),steelD:mat(0x737e86,.6,.35),tool:mat(0xb9c2c9,.78,.22),brass:mat(0xbba13f,.6,.3),green:mat(0x58cf61),yellow:mat(0xe9d637),sheet:mat(0x8da8bb,.65,.28),glass:new THREE.MeshStandardMaterial({color:0x182e3b,transparent:true,opacity:.22,roughness:.12,metalness:.1,depthWrite:false,side:THREE.DoubleSide})};
    const tex=(w,h,draw)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=4;const redraw=()=>{draw(cv.getContext('2d'),w,h);tx.needsUpdate=true;};redraw();return {tx,redraw};};
    const model=createBystronicModel({root,G,M,tex}),process=createBrakeProcess();let t=0,last=performance.now(),lastTele=0,guardAngle=0,raf;
    const snd=createSound('bender'),safety=()=>({...c,guardOpen:c.guardOpen||guardAngle>.01});
    const actions={start:()=>{setNotice('');if(c.r!==0){setNotice(L('Pre tento ohyb nastav R = 0 mm.','Set R = 0 mm for this bend.'));return;}process.start(c,safety());},hold:()=>process.hold(),retract:()=>process.retract(safety()),reset:()=>{if(c.unclamped)return;if(!process.reset())setNotice(L('Najprv zastav cyklus a zdvihni baran.','Stop the cycle and retract the ram first.'));else setNotice('');},emergency:()=>{set('estop',!c.estop);process.hold();},light:()=>set('light',!c.light)};
    const screen=tex(1200,700,(g,w,h)=>drawBrakeHmi(g,w,h,{S:process.S,c,setup:getSetup(c).value}));model.display.material.map=screen.tx;
    apiRef.current={...apiRef.current,machineModel:{root,name:'Bystronic Xpert Pro 320-4300'},hmiAction:id=>actions[id]?.(),getHmiCanvas:()=>screen.tx.image,snapshot,
      stl:()=>process.S.run?null:exportStl(model.stock),exportStep:async()=>{if(process.S.run)throw new Error(L('Najprv zastav cyklus.','Stop the cycle first.'));return exportStep(model.stock);}};
    const v=(x,y,z)=>new THREE.Vector3(x,y,z);
    const views={celok:()=>[[49,29,63],[0,15,0]],celo:()=>[[0,19,79],[0,15,1]],nastroje:()=>[[20,18,35],[0,12,2],true],dorazy:()=>[[8,17,-29],[0,10,-4],true],zadok:()=>[[-58,31,-67],[0,16,-5]],panel:()=>{const p=model.consolePivot.getWorldPosition(v(0,0,0)).add(v(0,12,0));return [p.clone().add(v(1,2,16)).toArray(),p.toArray(),true];},plech:()=>[[16,19,30],[0,11,4],true]};
    const anchors=Object.fromEntries(Object.keys(G).map(k=>[k,()=>G[k].getWorldPosition(v(0,0,0)).add(v(0,10,0))]));
    const insp=createInspector({dom,mount,camera,root,G,anchors,views,labelEls:[...layerRef.current.querySelectorAll('[data-part]')],enabled:()=>!c.manual&&!c.unclamped,onPick:k=>apiRef.current.onPick(k),blockPick:()=>ctrl.isUsed()||c.unclamped,onHL:()=>ctrl.invalidate(),orbitOptions:{maxDistance:240,maxTargetY:55}});
    const ctrl=createControls({dom,mount,camera,root,tipEl:tipRef.current,c,getT:()=>t,getHL:insp.hl});
    for(const [id,o] of Object.entries(model.controls.buttons))ctrl.reg({type:'button',hint:L('Kliknutím aktivuješ.','Click to activate.'),pressAxis:id==='emergency'?'z':'y',label:({start:L('Spustiť ohyb','Start bend'),retract:L('Zdvihnúť baran','Retract ram'),hold:L('Pozastaviť','Pause'),reset:L('Nový plech','New sheet'),emergency:L('Núdzový STOP','Emergency STOP')})[id],action:actions[id],latched:id==='emergency'?()=>c.estop:undefined},o);
    for(const p of model.guardPivots)ctrl.reg({type:'button',tooltip:false,label:L('Bočné kryty','Side guards'),action:()=>set('guardOpen',!c.guardOpen)},p);
    ctrl.reg({type:'button',label:'HMI',tooltip:false,action:()=>setHmi(true)},model.display);
    const wi=createWorkInspect({scene,camera,dom,insp,c,getObj:()=>model.stock,getSpot:()=>v(0,16,30),canDetach:()=>!process.S.run&&process.S.y<.01,onState:unclamped=>set('unclamped',unclamped)});
    apiRef.current.toggleWork=()=>{if(wi.phase()==='in'&&(process.S.run||process.S.y>.01)){setNotice(L('Pred prehliadkou zastav cyklus a zdvihni baran.','Stop and retract the ram before inspection.'));return;}setNotice('');wi.toggle();};
    apiRef.current.view=name=>{if(!c.unclamped){if(name==='dorazy')set('cutaway',true);else if(['celok','celo','zadok'].includes(name))set('cutaway',false);insp.goView(name,false);}};insp.goView('celok',true);
    const tick=(dt,render=true)=>{
      t+=dt;guardAngle+=((c.guardOpen?1.15:0)-guardAngle)*Math.min(1,dt*5);process.advance(dt*c.speed,safety());c.running=process.S.run;
      model.update({S:process.S,c,guardAngle});wi.update(dt);insp.update(t,c);ctrl.update(dt);
      if(Object.keys(ctrl.pend).length){const next={...ctrl.pend};for(const k of Object.keys(ctrl.pend))delete ctrl.pend[k];setUi(u=>({...u,...next}));}
      snd.update({motor:c.hydraulic?.04:0,cut:process.S.run?.025:0});
      if(t-lastTele>.12){lastTele=t;screen.redraw();setTele({...process.S,hasJob:!!process.job});}
      if(render)renderer.render(scene,camera);
    };
    tick(0);const loop=now=>{raf=requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;tick(dt);};raf=requestAnimationFrame(loop);
    if(/[?&]debug/.test(window.location.search))window.__bystronic={c,root,camera,model,process,insp,ctrl,wi,api:apiRef.current,advance:dt=>tick(dt,false)};
    return()=>{cancelAnimationFrame(raf);snd.dispose();ctrl.dispose();wi.dispose();insp.dispose();delete window.__bystronic;disposeStage();};
  },[]);
  const setup=getSetup(ui),locked=tele.hasJob||ui.unclamped,angle=180-tele.beta*360/Math.PI,p=parts();
  const number=(key,label,min,max,step=1)=><label>{label}<input className="sel" type="number" min={min} max={max} step={step} value={ui[key]} onChange={e=>{const value=Math.min(max,Math.max(min,Number(e.target.value)||min));set(key,value);if(key==='depth'&&ui.flange>value-20)set('flange',value-20);}}/></label>;
  return <div className="machine-app modern-app hermle-app brake-app w-full flex flex-col md:flex-row">
    <SceneView {...{mountRef,layerRef,tipRef,ui,set,selected,selectPart,onBack,apiRef}} parts={p} canUnclamp workBelowModes chips={[{color:tele.run?'#34d399':'#94a3b8',text:tele.run?L('Ohýbanie','Bending'):L('Stojí','Stopped')},{color:ui.guardOpen?'#f5b64d':'#34d399',text:ui.guardOpen?L('Kryty otvorené','Guards open'):L('Kryty zatvorené','Guards closed')}]}
      tools={<button className="scene-btn" onClick={()=>setHmi(true)}>HMI</button>} manualHint={L('Ľavý pedál spustí ohyb, pravý zdvihne baran. Kliknutím na bočný kryt ho otvoríš; displej otvorí HMI.','The left pedal starts a bend; the right retracts the ram. Click a side guard to open it, or the display to open HMI.')} />
    {hmi&&<BystronicHmi apiRef={apiRef} onClose={()=>setHmi(false)}/>}
    <aside className="panel">
      <div className="sec"><p className="sec-title">{L('Moderné stroje · CNC ohraňovací lis','Modern machines · CNC press brake')}</p><div className="section-heading"><h1 className="app-title mt-2" tabIndex={-1}>Bystronic Xpert Pro 320</h1><SectionInfo title="Xpert Pro 320/4300"><p>{L('Štandardná verzia 320/4300 podľa dodaného technického listu: 3 200 kN, pracovná dĺžka 4 300 mm, zdvih 250 mm, otvorenie 640 mm, 5 260 × 2 000 × 3 170 mm, 24,3 t. Neokótované kryty a príslušenstvo sú rekonštrukciou z fotografií.','Standard 320/4300 from the supplied technical data: 3,200 kN, 4,300 mm bending length, 250 mm stroke, 640 mm opening, 5,260 × 2,000 × 3,170 mm, 24.3 t. Undimensioned covers and accessories are reconstructed from photographs.')}</p></SectionInfo></div>
        <div className="cnc-dro mt-3"><div className="cnc-dro-col">{[['Y1',tele.y],['Y2',tele.y],['X',ui.flange]].map(([k,v])=><div className="cnc-dro-row" key={k}><span>{k}</span><b>{v.toFixed(2)}</b></div>)}</div><div className="cnc-dro-col"><div className="cnc-dro-row"><span>R</span><b>{ui.r.toFixed(1)}</b></div><div className="cnc-dro-row"><span>kN</span><b>{tele.force.toFixed(0)}</b></div><div className="cnc-dro-row"><span>∠</span><b>{angle.toFixed(1)}°</b></div></div></div>
        <div className={`msg msg-${ui.estop||tele.alarm||setup.error?'danger':tele.run?'run':'idle'}`} role="status">{(ui.estop?L('Núdzový STOP je aktívny.','Emergency STOP is active.'):null)||tele.alarm||notice||setup.error||(tele.done?(tele.complete?L('Ohyb dokončený. Plech môžeš prezrieť.','Bend complete. Inspect the sheet.'):L('Cyklus prerušený. Baran je zdvihnutý.','Cycle interrupted. Ram retracted.')):tele.paused?L('Cyklus pozastavený.','Cycle paused.'):tele.run?L('Prebieha cyklus ohýbania.','Bending cycle in progress.'):L('Pripravený na ohyb.','Ready to bend.'))}</div>
      </div>
      <div className="sec"><h2 className="sec-title mb-2">{L('Prevádzka','Operation')}</h2><div className="cnc-run"><button className="btn-run brake-start" disabled={ui.unclamped||!!setup.error} onClick={()=>apiRef.current.hmiAction('start')}>▶ {L('Spustiť ohyb','Start bend')}</button><button className="btn" onClick={()=>apiRef.current.hmiAction('hold')}>{L('Pozastaviť','Pause')}</button></div><div className="flex flex-wrap gap-2 mt-2"><button className="btn" disabled={ui.unclamped} onClick={()=>apiRef.current.hmiAction('retract')}>{L('Zdvihnúť baran','Retract ram')}</button><button className="btn" disabled={ui.unclamped||tele.run} onClick={()=>apiRef.current.hmiAction('reset')}>{L('Nový plech','New sheet')}</button><button className={`btn ${ui.estop?'active':''}`} onClick={()=>apiRef.current.hmiAction('emergency')}>{ui.estop?L('Uvoľniť STOP','Release STOP'):L('Núdzový STOP','Emergency STOP')}</button></div>
        <Toggle on={ui.hydraulic} label={L('Hydraulika','Hydraulics')} onClick={()=>set('hydraulic',!ui.hydraulic)}/><Toggle on={ui.light} label={L('Pracovné osvetlenie','Work light')} onClick={()=>set('light',!ui.light)}/><Toggle on={ui.guardOpen} label={L('Otvoriť bočné kryty','Open side guards')} onClick={()=>set('guardOpen',!ui.guardOpen)}/><Toggle on={ui.obstructed} label={L('Prekážka v ochrannom poli','Safety field obstruction')} onClick={()=>set('obstructed',!ui.obstructed)}/>
        <SegRow label={L('Rýchlosť simulácie','Simulation speed')} value={ui.speed} options={[[1,'×1'],[4,'×4'],[10,'×10']]} onChange={v=>set('speed',v)}/>
      </div>
      <div className="sec"><div className="section-heading"><h2 className="sec-title">{L('Plech a ohyb','Sheet and bend')}</h2><SectionInfo title={L('Plech a ohyb','Sheet and bend')}><p>{L('Jeden ohyb vo vzduchu. Uhol je vnútorný uhol dielu (rovný plech = 180°). Doraz X určuje dĺžku zadného ramena. Po cykle sa parametre odomknú tlačidlom Nový plech.','Single air bend. The angle is the inside angle (flat sheet = 180°). X sets the rear flange length. New sheet unlocks settings after a cycle.')}</p></SectionInfo></div><fieldset disabled={locked} className="brake-fields mt-3"><label>{L('Materiál','Material')}<select className="sel" value={ui.material} onChange={e=>set('material',e.target.value)}><option value="steel">{L('Oceľ','Steel')}</option><option value="stainless">{L('Nehrdzavejúca oceľ','Stainless steel')}</option><option value="aluminium">{L('Hliník','Aluminium')}</option></select></label>{number('thickness',L('Hrúbka [mm]','Thickness [mm]'),.5,12,.5)}{number('length',L('Dĺžka ohybu [mm]','Bend length [mm]'),100,XPERT320.bendLength,10)}{number('depth',L('Hĺbka prírezu [mm]','Blank depth [mm]'),80,1400,10)}{number('flange',L('Doraz X [mm]','X back gauge [mm]'),20,Math.min(XPERT320.xRange,ui.depth-20),1)}{number('angle',L('Vnútorný uhol [°]','Inside angle [°]'),90,170,1)}</fieldset></div>
      <div className="sec"><div className="section-heading"><h2 className="sec-title">{L('Nástroje a dorazy','Tooling and gauges')}</h2><SectionInfo title={L('Nástroje a sila','Tooling and force')}><p>{L('Výučbový odhad sily F = 1,42 × Rm × L × t² / V. Polomer ohybu a odpruženie sú približné; nejde o technologický predpis. Osadenie obsahuje segmentovaný 85° horný nástroj a V-matricu. Rozsah X 1 050 mm nie je totožný so zdvihom saní X 600 mm.','Training force estimate F = 1.42 × Rm × L × t² / V. Bend radius and springback are approximate, not production instructions. Tooling comprises a segmented 85° punch and V die. The 1,050 mm X range differs from the 600 mm X carriage travel.')}</p></SectionInfo></div><fieldset disabled={locked} className="mt-3"><Slider id="brake-v" label={L('Otvorenie matrice V','Die opening V')} min={16} max={120} step={2} value={ui.v} unit="mm" onChange={v=>set('v',v)}/><Slider id="brake-r" label={L('Výška dorazu R','R gauge height')} min={0} max={250} value={ui.r} unit="mm" onChange={v=>set('r',v)}/></fieldset><p className="text-sm">{L('Odhad sily','Estimated force')}: {setup.value?.force.toFixed(0)||'—'} / 3 200 kN</p><div className="brake-force"><span style={{width:`${Math.min(100,(setup.value?.force||0)/32)}%`}}/></div></div>
      <div className="sec"><h2 className="sec-title mb-3">HMI</h2><Slider id="brake-hmi" label={L('Natočenie panela','Panel angle')} min={-80} max={80} value={ui.hmiAngle} unit="°" onChange={v=>set('hmiAngle',v)}/><button className="btn" onClick={()=>setHmi(true)}>{L('HMI cez celé okno','Fullscreen HMI')}</button></div>
      <div className="sec"><h2 className="sec-title mb-3">{L('Výsledný diel','Finished part')}</h2><p className="text-sm">{angle.toFixed(1)}° · {tele.t.toFixed(1)} s</p><div className="flex gap-2 flex-wrap mt-2"><button className="btn" disabled={tele.run} onClick={()=>save(apiRef.current.stl?.(),'bystronic-bent-sheet.stl')}>STL</button><StepDownloadButton machine="bystronic-bent-sheet" apiRef={apiRef}/><button className="btn" onClick={()=>apiRef.current.snapshot?.(b=>save(b,'bystronic-xpert-pro-320.png'))}>PNG</button></div></div>
      <div className="sec"><Toggle on={ui.cutaway} label={L('Odkryť mechanizmus','Reveal mechanism')} onClick={()=>set('cutaway',!ui.cutaway)}/></div><ViewSection apiRef={apiRef} views={[["celok",L('Celok','Overview')],["celo",L('Čelo','Front')],["nastroje",L('Nástroje','Tools')],["dorazy",L('Dorazy','Gauges')],["zadok",L('Zadná časť','Rear')],["panel","HMI"],["plech",L('Plech','Sheet')]]}/><PartsSection parts={p} {...{selected,selectPart}}/><HelpFooter apiRef={apiRef} ui={ui}/>
    </aside>
  </div>;
}
