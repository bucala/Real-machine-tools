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
import { DeepDrillHmi,drawDeepHmi } from '../ui/deepDrillHmi';
import '../ui/deepDrill.css';
import { createStock } from './cnc/voxel';
import { createDeepDrillProcess,DEEP_BLANK } from './precision/deepDrillProcess';
import { createShuangliModel } from './precision/shuangliModel';
const parts=()=>mkParts([
  ['kabina','Kabína a dvere','Enclosure and doors','Presklené okrytovanie','Glazed enclosure','Tri teleskopické predné dvere a ľavé otočné dvere. Otvorenie blokuje cyklus. Odkrytie je iba vizuálny rez modelom.','Three telescoping front doors and a hinged left door. Opening interlocks the cycle. Cutaway is only a model visualization.'],
  ['lozko','Lôžko','Bed','Liatinové lôžko','Cast machine bed','Masívna základňa, vodiace lišty a vyrovnávacie pätky podľa referenčných fotografií.','Massive base, guide rails and leveling feet reconstructed from reference photographs.'],
  ['stol','Stôl X','X table','Priečny pracovný stôl','Transverse work table','Drážkovaný stôl sa pohybuje priečne k vodorovnému vrtáku. Upínky držia polotovar nad stolom.','The slotted table moves across the horizontal drill axis. Clamps hold the blank above the table.'],
  ['osi','Vreteník Y/Z','Y/Z spindle','Vodorovné hĺbkové vŕtanie','Horizontal deep drilling','Zvislé dvojité vedenie Y, pozdĺžny posuv Z, vreteno, jednobritý vrták s priamou drážkou a vodiace podpery.','Twin vertical Y guides, longitudinal Z feed, spindle, single-lip gun drill with a straight flute and steady supports.'],
  ['prislusenstvo','Príslušenstvo','Accessories','Tlakové chladenie a triesky','Pressure coolant and chips','Filtračná jednotka, čerpadlá, šikmé dno, dopravník a otvorený vozík na triesky.','Filter unit, pumps, sloped tray, conveyor and open chip cart.'],
  ['panel','HMI','HMI','Siemens Edition','Siemens Edition','Výučbový panel inšpirovaný SINUMERIK. Displej v modeli aj vo veľkom okne zobrazuje rovnaké údaje.','Educational SINUMERIK-inspired panel. The model screen and fullscreen view share identical live data.'],
  ['obrobok','Obrobok','Workpiece','Vŕtaný polotovar','Drilled blank','Oceľový polotovar 500 × 160 × 240 mm. Otvory a export zachovávajú aktuálnu hĺbku vŕtania.','500 × 160 × 240 mm steel blank. Holes and export preserve the current drilling depth.'],
]);
const save=(b,n)=>{if(!b)return;const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(u),4000);};
export default function ShuangliSimulator({onBack}){
  const mountRef=useRef(null),layerRef=useRef(null),tipRef=useRef(null);
  const {ctl,ui,set,setUi,selected,selectPart,apiRef}=useMachine({manual:false,door:true,sideDoor:false,cover:true,light:true,coolant:true,pressure:40,estop:false,speed:20,diameter:16,rpm:1800,feed:120,rows:[{x:-55,y:0,depth:140},{x:55,y:25,depth:220}]});
  const [tele,setTele]=useTele({phase:'idle',run:false,started:false,done:false,row:0,x:0,y:0,depth:-30,t:0,removed:0,alarm:null});
  const [hmiOpen,setHmiOpen]=useState(false);
  useEffect(()=>{
    const c=ctl.current,mount=mountRef.current,{scene,camera,renderer,snapshot,dispose:disposeStage}=createStage(mount,{far:500,floorSize:400,gridSize:260,fogNear:200,fogFar:400});
    const dom=renderer.domElement,root=new THREE.Group();scene.add(root);const snd=createSound('mill');
    const mat=(color,metal=.2,rough=.5)=>new THREE.MeshStandardMaterial({color:new THREE.Color(color).convertSRGBToLinear(),metalness:metal,roughness:rough});
    const M={cab:mat(0xe4e7e6),cab2:mat(0xb3bec1,.3),dark:mat(0x343e45),black:mat(0x171c20),steel:mat(0xb8c8d1,.8,.28),steelD:mat(0x566b79,.7),table:mat(0xa5b2bb,.8,.3),inox:mat(0xb4c2c7,.65),green:mat(0x248c76),yellow:mat(0xe5ba28),red:mat(0xc71932),blue:mat(0x2c5b8b),brass:mat(0xc4a467,.6),glass:new THREE.MeshStandardMaterial({color:new THREE.Color(0x7695a2).convertSRGBToLinear(),transparent:true,opacity:.2,roughness:.2,metalness:.1,side:THREE.DoubleSide,depthWrite:false})};
    const tex=(w,h,draw)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;const redraw=()=>{draw(cv.getContext('2d'),w,h);tx.needsUpdate=true;};redraw();return {tx,redraw};};
    const G={},model=createShuangliModel({root,G,M,tex}),stockG=new THREE.Group();stockG.scale.setScalar(.01);stockG.userData.part='obrobok';stockG.userData.stepJoin=true;model.stockMount.add(stockG);G.obrobok=stockG;
    const chunks=new Map();let stock,process,gate=1,actualDepth=-30,raf,last=performance.now(),time=0,teleTime=0,saved={};
    const flush=()=>{for(const p of stock.takeDirty()){let me=chunks.get(p.id);if(!p.idx.length){if(me){me.geometry.dispose();stockG.remove(me);chunks.delete(p.id);}continue;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p.pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(p.nor,3));geo.setIndex(new THREE.BufferAttribute(p.idx,1));geo.computeBoundingSphere();if(me){me.geometry.dispose();me.geometry=geo;}else{me=new THREE.Mesh(geo,M.steel);me.castShadow=true;me.receiveShadow=true;stockG.add(me);chunks.set(p.id,me);}}};
    const reset=()=>{if(c.unclamped)return;for(const m of chunks.values()){m.geometry.dispose();stockG.remove(m);}chunks.clear();stock=createStock(DEEP_BLANK);process=createDeepDrillProcess(stock);c.running=false;flush();};reset();
    const conditions=()=>({door:c.door||gate>.01||c.sideDoor||model.serviceOpen(),estop:c.estop,clamped:!c.unclamped,coolant:c.coolant,pressure:c.pressure});
    const start=()=>{process.start(c,conditions());c.running=process.S.run;};
    const hold=()=>{process.hold();c.running=false;};
    const actions={start,hold,reset,emergency:()=>{set('estop',!c.estop);if(c.estop)process.stop(L('Núdzový STOP','Emergency STOP'));}};
    const screen=tex(960,600,(g,w,h)=>drawDeepHmi(g,w,h,{S:process.S,c}));model.display.material.map=screen.tx;
    apiRef.current={...apiRef.current,machineModel:{root,name:'ShuangliCNC ZJA13-2013F Siemens Edition'},start,hold,reset,hmiAction:id=>actions[id]?.(),getHmiCanvas:()=>screen.tx.image,snapshot};
    apiRef.current.stl=()=>{if(process.S.run)return null;flush();return exportStl(stockG);};
    apiRef.current.exportStep=async()=>{if(process.S.run)throw new Error(L('Najprv zastav cyklus.','Stop the cycle first.'));flush();return exportStep(stockG);};
    const v=(x,y,z)=>new THREE.Vector3(x,y,z);
    const views={celok:()=>[[64,43,75],[2,12,0]],priestor:()=>[[-5,21,35],[-5,12,0],true],mechanizmus:()=>[[37,29,38],[5,12,0],true],obrobok:()=>[[-2,16,7],[-10.5,10.2,0],true],panel:()=>[[22.2,16,25],[22.2,16,14],true],zhora:()=>[[0,90,.01],[0,8,0],true]};
    const anchors=Object.fromEntries(Object.keys(G).map(k=>[k,()=>new THREE.Box3().setFromObject(G[k]).getCenter(v(0,0,0))]));
    const insp=createInspector({dom,mount,camera,root,G,anchors,views,labelEls:[...layerRef.current.querySelectorAll('[data-part]')],enabled:()=>!c.manual&&!c.unclamped,onPick:k=>apiRef.current.onPick(k),blockPick:()=>ctrl.isUsed()||c.unclamped,onHL:()=>ctrl.invalidate(),orbitOptions:{maxDistance:230,maxTargetY:50}});
    const ctrl=createControls({dom,mount,camera,root,tipEl:tipRef.current,c,getT:()=>time,getHL:insp.hl});
    for(const [id,o] of Object.entries(model.controls))ctrl.reg({type:'button',pressAxis:'z',label:({start:'CYCLE START',hold:'FEED HOLD',reset:'RESET',emergency:'EMERGENCY STOP'})[id],action:actions[id],latched:id==='emergency'?()=>c.estop:undefined},o);
    for(const d of model.doors)ctrl.reg({type:'slide',axis:'x',tooltip:false,label:L('Posuvné dvere','Sliding doors'),click:()=>ctrl.push('door',!c.door),start:()=>{},slide:dx=>{if(Math.abs(dx)>.1)ctrl.push('door',dx>0);}},d);
    ctrl.reg({type:'button',tooltip:false,label:L('Ľavé dvere','Left door'),action:()=>set('sideDoor',!c.sideDoor)},model.serviceDoors[0].pivot);
    const openHmi=e=>{if(c.manual&&ctrl.pickAt(e.clientX,e.clientY)?.object===model.display){e.preventDefault();setHmiOpen(true);}};dom.addEventListener('dblclick',openHmi);
    const wi=createWorkInspect({scene,camera,dom,insp,c,getObj:()=>stockG,getSpot:()=>v(-8,13,23),canDetach:()=>gate>.995&&actualDepth<-29.9,onState:unclamped=>{set('unclamped',unclamped);set('manual',unclamped?false:saved.manual);if(!unclamped)set('door',saved.door);}});
    apiRef.current.toggleWork=()=>{if(wi.phase()==='in'){hold();process.retract();saved={manual:c.manual,door:c.door};set('door',true);}wi.toggle();};
    apiRef.current.view=n=>{if(!c.unclamped){if(n==='mechanizmus')set('cover',false);insp.goView(n,false);}};insp.goView('celok',true);
    const tick=(dt,render=true)=>{
      time+=dt;gate+=((c.door?1:0)-gate)*Math.min(1,dt*5);model.serviceDoors[0].open=c.sideDoor;
      process.advance(dt*c.speed,conditions());c.running=process.S.run;
      actualDepth+=(process.S.depth-actualDepth)*Math.min(1,dt*25);
      model.update({S:{...process.S,depth:actualDepth},door:gate,cover:c.cover,light:c.light,diameter:c.diameter,dt});flush();wi.update(dt);insp.update(time,c);ctrl.update(dt);
      if(Object.keys(ctrl.pend).length){const next={...ctrl.pend};for(const k of Object.keys(ctrl.pend))delete ctrl.pend[k];setUi(u=>({...u,...next}));}
      snd.update({motor:process.S.run?.3:0,cut:process.S.phase==='drill'&&process.S.run?.18:0});
      if(time-teleTime>.15){teleTime=time;screen.redraw();setTele({...process.S,started:!!process.job});}
      if(render)renderer.render(scene,camera);
    };
    const loop=now=>{raf=requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;tick(dt);};raf=requestAnimationFrame(loop);
    if(/[?&]debug/.test(window.location.search))window.__shuangli={c,root,camera,model,stockG,insp,ctrl,wi,api:apiRef.current,advance:dt=>tick(dt,false),get process(){return process;},get stock(){return stock;}};
    return()=>{cancelAnimationFrame(raf);dom.removeEventListener('dblclick',openHmi);ctrl.dispose();wi.dispose();insp.dispose();snd.dispose();delete window.__shuangli;disposeStage();};
  },[]);
  const p=parts(),locked=tele.run||tele.started||ui.unclamped;
  const numeric=(label,value,min,max,change)=><label className="text-xs">{label}<input className="sel" type="number" min={min} max={max} value={value} onChange={e=>change(Math.max(min,Math.min(max,Number(e.target.value)||0)))}/></label>;
  return <div className="machine-app modern-app hermle-app shuangli-app w-full flex flex-col md:flex-row">
    <SceneView {...{mountRef,layerRef,tipRef,ui,set,selected,selectPart,onBack,apiRef}} parts={p} canUnclamp workBelowModes chips={[{color:tele.run?'#34d399':'#94a3b8',text:tele.run?L('Vŕtanie','Drilling'):L('Stojí','Stopped')},{color:ui.door||ui.sideDoor?'#f0a733':'#34d399',text:ui.door||ui.sideDoor?L('Dvere otvorené','Doors open'):L('Dvere zatvorené','Doors closed')}]}
      tools={<button className="scene-btn" onClick={()=>setHmiOpen(true)}>HMI</button>} manualHint={L('Tlačidlá HMI ovládajú cyklus. Predné dvere sa posúvajú kliknutím alebo potiahnutím; ľavé sa otáčajú. Dvojklik na displej otvorí HMI.','HMI buttons operate the cycle. Click or drag the sliding front doors; the left door swings. Double-click the display to open HMI.')}/>
    {hmiOpen&&<DeepDrillHmi apiRef={apiRef} onClose={()=>setHmiOpen(false)}/>}
    <aside className="panel">
      <div className="sec"><p className="sec-title">{L('Moderné stroje · hĺbkové vŕtanie','Modern machines · deep hole drilling')}</p><div className="section-heading"><h1 className="app-title mt-2" tabIndex={-1}>ShuangliCNC ZJA13-2013F</h1><SectionInfo title="ZJA13-2013F · Siemens Edition"><p>{L('Vizuálny model podľa dodaných fotografií rodiny ZJA13. Referenčná tabuľka používateľa patrí k Zonjet ZJA13-1610: 3 osi, výška 2 800 mm, hĺbka vŕtania 1 300 mm, hmotnosť 12 t, nosnosť 10 t. Tieto hodnoty nie sú overenou špecifikáciou ShuangliCNC ZJA13-2013F.','Visual model reconstructed from supplied ZJA13-family photographs. The supplied reference table is for Zonjet ZJA13-1610: 3 axes, 2,800 mm height, 1,300 mm drilling depth, 12 t weight and 10 t capacity. These are not verified ShuangliCNC ZJA13-2013F specifications.')}</p><p>{L('Rozmery okrytovania, stôl, dopravník a rozmiestnenie príslušenstva sú obrazový odhad. Siemens Edition je výučbové rozhranie inšpirované SINUMERIK; neemuluje firmvér riadenia.','Enclosure dimensions, table, conveyor and accessory positions are visual estimates. Siemens Edition is an educational SINUMERIK-inspired interface, not controller firmware emulation.')}</p></SectionInfo></div>
      <div className="cnc-dro mt-3"><div className="cnc-dro-col">{[['X',tele.x],['Y',tele.y],['Z',tele.depth]].map(([k,v])=><div className="cnc-dro-row" key={k}><span>{k}</span><b>{v.toFixed(3)}</b></div>)}</div><div className="cnc-dro-col"><div className="cnc-dro-row"><span>S</span><b>{tele.run?ui.rpm:0}</b></div><div className="cnc-dro-row"><span>F</span><b>{tele.run?ui.feed:0}</b></div><div className="cnc-dro-row"><span>OP</span><b>{tele.row+1}/{ui.rows.length}</b></div></div></div>
      <div className={`msg msg-${tele.alarm?'danger':tele.run?'run':'idle'}`} role="status">{tele.alarm||(tele.done?L('Vŕtanie dokončené','Drilling complete'):tele.run?L('Prebieha cyklus','Cycle in progress'):L('Pripravený','Ready'))}</div></div>
      <div className="sec"><div className="section-heading"><h2 className="sec-title">{L('Prevádzka','Operation')}</h2><SectionInfo title={L('Prevádzka','Operation')}><p>{L('Cyklus vyžaduje zatvorené predné aj ľavé dvere, upnutý obrobok a tlakové chladenie aspoň 10 bar. Otvorenie dverí, vypnutie chladenia alebo STOP okamžite preruší posuv. Po odstránení príčiny pokračuj tlačidlom Štart.','The cycle requires closed front and left doors, a clamped blank and coolant pressure of at least 10 bar. Opening doors, disabling coolant or STOP immediately pauses feed. Use Start to resume after resolving the cause.')}</p></SectionInfo></div>
      <div className="cnc-run mt-2"><button className="btn-run start" disabled={ui.unclamped} onClick={()=>apiRef.current.start?.()}>▶ {L('Štart cyklu','Cycle start')}</button><button className="btn" onClick={()=>apiRef.current.hold?.()}>❚❚ {L('Stop posuvu','Feed hold')}</button><button className="btn" disabled={ui.unclamped} onClick={()=>apiRef.current.reset?.()}>↺ Reset</button></div>
      <div className="flex gap-2 flex-wrap mt-2"><button className={`btn ${ui.estop?'active':''}`} onClick={()=>apiRef.current.hmiAction?.('emergency')}>{ui.estop?L('Uvoľniť STOP','Release STOP'):L('Núdzový STOP','Emergency STOP')}</button><button className="btn" disabled={ui.unclamped} onClick={()=>set('door',!ui.door)}>{ui.door?L('Zatvoriť predné dvere','Close front doors'):L('Otvoriť predné dvere','Open front doors')}</button><button className="btn" disabled={ui.unclamped} onClick={()=>set('sideDoor',!ui.sideDoor)}>{ui.sideDoor?L('Zatvoriť ľavé dvere','Close left door'):L('Otvoriť ľavé dvere','Open left door')}</button></div>
      <Toggle on={ui.coolant} label={L('Tlakové chladenie','Pressure coolant')} onClick={()=>set('coolant',!ui.coolant)}/><Toggle on={ui.light} label={L('Pracovné svetlo','Work light')} onClick={()=>set('light',!ui.light)}/><Toggle on={!ui.cover} label={L('Odkryť mechanizmus','Show internal mechanism')} onClick={()=>set('cover',!ui.cover)}/>
      <Slider id="deep-pressure" label={L('Tlak chladenia','Coolant pressure')} min={0} max={80} value={ui.pressure} unit="bar" onChange={v=>set('pressure',v)}/><SegRow label={L('Rýchlosť simulácie','Simulation speed')} value={ui.speed} options={[[1,'×1'],[20,'×20'],[80,'×80']]} onChange={v=>set('speed',v)}/></div>
      <div className="sec"><div className="section-heading"><h2 className="sec-title">{L('Nástroj a program','Tool and program')}</h2><SectionInfo title={L('Nástroj a program','Tool and program')}><p>{L('Výučbový rozsah: Ø8–40 mm, 100–6 000 ot/min, 5–400 mm/min. Polotovar 500 × 160 × 240 mm, sieť 2 mm. X určuje priečnu polohu na čele, Y výšku, Z hĺbku od vstupnej plochy. Vrták má pevnú podperu pred obrobkom. Postup: polohovanie → nájazd → súvislé vŕtanie → vytiahnutie.','Training limits: Ø8–40 mm, 100–6,000 rpm, 5–400 mm/min. Blank 500 × 160 × 240 mm, 2 mm mesh. X is the transverse face position, Y is height, Z is depth from the entry face. A fixed guide supports the drill before the workpiece. Sequence: position → approach → continuous drilling → retract.')}</p><p>{L('Reset vytvorí nový polotovar a odomkne úpravu programu. Prehliadka prerušeného obrobku vytiahne vrták; po návrate sa aktuálny otvor dokončí.','Reset creates a new blank and unlocks program edits. Inspecting a paused workpiece retracts the drill; resuming finishes the current hole.')}</p></SectionInfo></div>
      <fieldset disabled={locked} className="hermle-settings mt-2"><Slider id="deep-diameter" label={L('Priemer vrtáka','Drill diameter')} min={8} max={40} value={ui.diameter} unit="mm" onChange={v=>set('diameter',v)}/><Slider id="deep-rpm" label={L('Otáčky','Spindle speed')} min={100} max={6000} step={100} value={ui.rpm} unit="rpm" onChange={v=>set('rpm',v)}/><Slider id="deep-feed" label={L('Posuv','Feed')} min={5} max={400} value={ui.feed} unit="mm/min" onChange={v=>set('feed',v)}/>
      <div className="deep-hole-rows">{ui.rows.map((r,i)=><div className="deep-hole-row" key={i}><b>{i+1}</b>{[['x','X mm',-100,100],['y','Y mm',-60,60],['depth',L('Hĺbka','Depth'),1,495]].map(([k,l,min,max])=><div key={k}>{numeric(l,r[k],min,max,v=>set('rows',ui.rows.map((row,j)=>j===i?{...row,[k]:v}:row)))}</div>)}<button className="btn" aria-label={L(`Odstrániť otvor ${i+1}`,`Remove hole ${i+1}`)} disabled={ui.rows.length===1} onClick={()=>set('rows',ui.rows.filter((_,j)=>j!==i))}>×</button></div>)}</div><button className="btn mt-2" disabled={ui.rows.length>=10} onClick={()=>set('rows',[...ui.rows,{x:0,y:0,depth:100}])}>+ {L('Otvor','Hole')}</button></fieldset></div>
      <div className="sec"><h2 className="sec-title">{L('Výsledok','Result')}</h2><p className="text-sm mt-2">{Math.floor(tele.t/60)}:{String(Math.floor(tele.t%60)).padStart(2,'0')} · {L('Úber','Removed')} {(tele.removed/1000).toFixed(2)} cm³</p><div className="flex flex-wrap gap-2 mt-2"><button className="btn" disabled={tele.run} onClick={()=>save(apiRef.current.stl?.(),'shuangli-workpiece.stl')}>{L('STL obrobku','Workpiece STL')}</button><StepDownloadButton machine="shuangli-workpiece" apiRef={apiRef}/><button className="btn" onClick={()=>apiRef.current.snapshot?.(b=>save(b,'shuangli.png'))}>PNG</button></div></div>
      <ViewSection apiRef={apiRef} views={[["celok",L('Celok','Overview')],["priestor",L('Pracovný priestor','Working area')],["mechanizmus",L('Mechanizmus','Mechanism')],["obrobok",L('Obrobok','Workpiece')],["panel","HMI"],["zhora",L('Zhora','Top')]]}/><PartsSection parts={p} {...{selected,selectPart}}/><HelpFooter apiRef={apiRef} ui={ui}/>
    </aside>
  </div>;
}
