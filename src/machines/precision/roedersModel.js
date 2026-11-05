import * as THREE from 'three';
import { modelKit } from './modelKit';
import { createRmsPanel } from './rmsPanel';
import { createToolModel } from '../cnc/toolModel';

// RXU 1001 DSH, supplied catalogue photo p58. Separate construction, not a scaled Hermle.
// The catalogue gives installation space, not every sheet-metal dimension: those details follow the photo.
export function createRoedersModel({root,G,M,tex,MC,PY}){
  const {group,box,cyl,rod,label,bolts,clear}=modelKit(root,M,tex);
  const part=k=>{const g=group(k);g.userData.part=k;G[k]=g;return g;};
  M.red.color.setHex(0xa51536).convertSRGBToLinear();
  M.lamp=new THREE.MeshStandardMaterial({color:0xeaf5ff,emissive:0xeaf5ff,emissiveIntensity:3});
  M.brush=M.inox;M.yellow=new THREE.MeshStandardMaterial({color:0xf4c32b});
  const bed=part('lozko');
  box(bed,0,3.4,-14.4,21.9,5.8,47.7,M.red);
  box(bed,0,.65,-14.4,21.3,.7,46.7,M.black);
  for(const x of [-10,10])for(const z of [-27,5.8]){cyl(bed,x,.2,z,.7,.4,M.steelD);cyl(bed,x,.7,z,.3,.6);}
  for(const x of [-7.4,7.4]){
    box(bed,x,14.4,-12,3.2,16.8,14,M.anth);
    for(const dx of [-.65,.65])box(bed,x+dx,23,-7,.24,.25,27,M.steel);
    box(bed,x,(6+PY)/2,0,2.6,PY-6,3.8,M.anth); // trunnion bearings join the bed, below the observation window
    cyl(bed,x,PY,0,2.2,1.2,M.steelD,'x');
    for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(bed,x+(x<0?.65:-.65),PY+1.85*Math.sin(a),1.85*Math.cos(a),.1,.12,M.steel,'x');}
  }
  box(bed,0,6.5,-1,11.5,.35,16,M.inox);
  for(const x of [-4.8,4.8]){const chute=box(bed,x,7.1,1.2,2,.1,13,M.inox);chute.rotation.z=x<0?-.3:.3;}
  box(bed,0,11,-11,11.5,9,.25,M.inox);
  const aG=group('A-trunnion',part('stol'));aG.position.y=PY;
  for(const x of [-5.3,5.3]){
    cyl(aG,x,0,0,1.9,2,M.table,'x');box(aG,x,-1.45,0,1.6,3,4,M.table);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.95,.14,10,48),M.steel);ring.rotation.y=Math.PI/2;ring.position.x=x;aG.add(ring);
  }
  box(aG,0,-2.3,0,10.3,1.7,5.5,M.table);
  cyl(aG,0,-1.65,0,2.5,.6,M.steelD);
  const cG=group('C-direct-drive',aG);cG.position.y=-MC.hA*.01;
  cyl(cG,0,-.25,0,MC.table*.005,.5,M.table);
  // Parallel table T-slots, concentric finish and hole circle are visible in the catalogue.
  for(const z of [-2,-1,0,1,2])box(cG,0,.006,z,Math.sqrt(9-z*z)*2-.15,.015,.06,M.steelD);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;cyl(cG,Math.cos(a)*2.65,.015,Math.sin(a)*2.65,.045,.025,M.black);}
  cyl(cG,0,.1,0,.47,.2,M.steelD);cyl(cG,0,.35,0,.35,.3,M.anth);
  const clampPins=[0,1,2].map(i=>{const g=group('clamp',cG);g.rotation.y=i*Math.PI*2/3;return box(g,0,.35,.35,.12,.12,.16,M.steel);});

  // QUADROGUIDE: four rails on the four corners of the Z ram, linear motor gantry.
  const ax=part('osi'),yG=group('Y-linear-motor',ax),xG=group('X-saddle',yG),zG=group('Z-quadroguide',xG);
  box(yG,0,23.4,0,17.8,2.3,4.6,M.cab2);
  for(const y of [22.5,24.2])box(yG,0,y,2.4,17.6,.22,.26,M.steel);
  box(xG,0,24.2,0,4.1,4.6,5.1,M.cab);
  box(zG,0,6.4,0,2.4,11.6,2.4,M.cab2);
  for(const x of [-1.23,1.23])for(const z of [-1.23,1.23])box(zG,x,6.5,z,.16,11.5,.16,M.steel);
  for(const x of [-1.12,1.12])for(const z of [-1.12,1.12])box(xG,x,21.9,z,.5,.8,.5,M.steelD);
  const sp=group('HSK-A63',zG);sp.userData.part='vreteno';G.vreteno=sp;
  cyl(sp,0,.55,0,.7,1.1);cyl(sp,0,.13,0,.56,.26,M.steelD);
  for(const x of [-.8,.8])rod(sp,[x,.9,.5],[x*.5,.05,.6],.065,M.dark);
  const toolG=group('tool',sp),buildTool=t=>{clear(toolG);if(t)toolG.add(createToolModel(t,M));};
  // Bellows are actual separate folds, updated with X travel.
  const covers=[];
  const bellows=group('X-bellows',yG);
  for(const s of [-1,1])for(let i=0;i<20;i++){
    const o=box(bellows,s*(2.2+i*.32),19.2,2.35,.32,7,.12,i%2?M.steelD:M.inox);
    o.userData={side:s,index:i};covers.push(o);
  }
  const chain=group('Z-cable-chain',xG);
  for(let i=0;i<26;i++){
    const t=i/25,angle=t*Math.PI;
    box(chain,2.6,27+Math.sin(angle)*3,-3+Math.cos(angle)*3,.65,.3,.55,M.black);
  }
  // The standard 24-position rotary magazine sits in the rear service space.
  const mag=part('zasobnik'),magY=PY+(MC.nose[1]-80)*.01,magZ=-7.5;
  box(mag,0,12,-12,10,11,7,M.anth);
  for(const x of [-3.5,3.5])box(mag,x,magY-2,magZ,1,4,6,M.steelD);
  const magG=group('24-pocket-carousel',mag);magG.position.set(0,magY,magZ);
  cyl(magG,0,-.2,0,4,.4,M.steelD);cyl(magG,0,.1,0,.65,.6);
  const driveShaft=group('carousel-shaft',mag);driveShaft.position.copy(magG.position);cyl(driveShaft,0,-1,0,.28,2.5);
  const saddle=group('tool-change-transfer',mag);
  box(saddle,0,magY+1,magZ,1.8,.6,6,M.anth);
  for(const x of [-.55,.55])rod(saddle,[x,magY+1.4,magZ-2.6],[x,magY+1.4,magZ+2.6],.09);
  const pockets=[];
  for(let i=0;i<MC.mag;i++){
    const a=i*Math.PI*2/MC.mag,g=group(`T${i+1}`,magG);g.position.set(Math.sin(a)*4,0,Math.cos(a)*4);g.rotation.y=a;
    for(const x of [-.25,.25])box(g,x,0,0,.08,.12,.55,M.red);
    box(g,0,0,-.25,.55,.12,.08,M.red);pockets.push(group('holder',g));
  }
  const loadMagazine=tls=>pockets.forEach((g,i)=>{clear(g);const t=tls.find(t=>t.t===i+1);if(t)g.add(createToolModel(t,M));});

  const cab=part('kabina');
  // Tall silver rear enclosure, burgundy base and sliding front door seen in the photograph.
  box(cab,0,20.6,-25.7,21.9,28.8,26.4,M.cab);
  box(cab,0,35.35,-25.7,22.1,.4,26.4,M.cab2);
  box(cab,0,25.5,-39,21.8,19,.25,M.cab2);
  box(cab,0,7.4,8.8,24,.7,.7,M.red);
  box(cab,0,27.7,3.4,24,1,11.4,M.cab);
  box(cab,8.2,17.6,5.2,7.6,19.5,7.8,M.cab);
  // Left observation window is a true aperture: no opaque wall or bed behind it.
  // The white cheek wraps around the front-left corner, as in the catalogue photo.
  for(const y of [8.9,25.3])box(cab,-9.25,y,2.5,.5,2.8,10,M.cab);
  for(const z of [-2.7,7.7])box(cab,-9.25,17.2,z,.5,13.6,.65,M.cab);
  box(cab,-7.8,17.6,8.3,2.4,19.5,1.5,M.cab);
  box(cab,-10.6,17.6,-4.5,2.8,19.5,3,M.cab);
  const sideWindow=new THREE.Mesh(new THREE.PlaneGeometry(9.75,13.6),M.glass);
  sideWindow.rotation.y=-Math.PI/2;sideWindow.position.set(-9.53,17.2,2.5);sideWindow.name='left-observation-window';cab.add(sideWindow);
  for(const z of [-2.35,7.35])box(cab,-9.55,17.2,z,.05,13.4,.12,M.dark);
  for(const y of [10.4,24])box(cab,-9.55,y,2.5,.05,.12,9.8,M.dark);
  // Right-hinged red loading door. The handle is on the left edge of the leaf;
  // the door swings out towards the operator and folds to the machine's right.
  const door=group('right-hinged-loading-door',cab);door.userData.s=1;
  const leaf=group('red-door-leaf',door);
  box(leaf,-5.4,1.6,0,10.8,3.2,.45,M.red);box(leaf,-5.4,18.3,0,10.8,2.7,.45,M.red);
  box(leaf,-10.05,10,0,1.5,13.6,.45,M.red);box(leaf,-.75,10,0,1.5,13.6,.45,M.red);
  const win=new THREE.Mesh(new THREE.PlaneGeometry(7.8,13.6),M.glass);win.position.set(-5.4,10,.03);leaf.add(win);
  rod(leaf,[-9.65,3.5,.45],[-9.65,13.9,.45],.1,M.black);
  for(const y of [3.8,13.6])rod(leaf,[-9.65,y,.1],[-9.65,y,.5],.09,M.steelD);
  for(const y of [9,17,25]){cyl(cab,4.45,y,9.45,.12,.55,M.steelD);}
  label(cab,'RXU 1001 DSH',8.3,26,9.13,5.4,1);
  label(cab,'röders TEC',8.3,21.8,9.15,4.5,1.2);
  box(cab,8.3,14.5,9.15,5.1,7.8,.09,M.steelD);box(cab,8.3,14.5,9.22,4.95,7.65,.09,M.cab);
  for(const y of [9,25])bolts(cab,8.3,y,9.3,4.8,.2);
  for(let i=0;i<13;i++)box(cab,8.3,8.4+i*.13,9.25,5.2,.06,.06,M.dark);
  for(const x of [-10,10])for(const y of [11,17,24])bolts(cab,x,y,-39.2,.5,.5);
  // Rear electrical cabinet, service handles and air vents.
  for(const x of [-6,6]){box(cab,x*.9,16,-39.15,10.5,23,.3,M.cab2);box(cab,x*.9+4.2,15,-39.4,.14,1.3,.18,M.black);}
  for(let i=0;i<22;i++)box(cab,6,24+i*.18,-39.37,7,.055,.05,M.dark);
  // Left-side compact RMS terminal, articulated support and chip collection tray.
  const pan=part('panel'),armPivot=group('terminal-shoulder',pan);armPivot.position.set(-14.3,0,-16.3);
  cyl(pan,-14.3,3.6,-16.3,.55,1.5,M.steelD);
  box(armPivot,0,3.8,2.3,.8,.7,4.6,M.steelD);
  const armElbow=group('terminal-elbow',armPivot);armElbow.position.z=4.6;
  box(armElbow,0,4.1,1.7,.75,.65,3.4,M.anth);cyl(armElbow,0,5.9,3.4,.27,9.9,M.steelD);
  const panG=group('RMS-console',armElbow);panG.position.set(0,3,3.4);panG.scale.setScalar(.95);
  const hmi=createRmsPanel(panG,M,tex);
  // Chip box behind the left side, matching the plan (two screw outlets).
  box(bed,-24.8,1.3,-21.4,9.5,.35,16,M.inox);
  for(const x of [-29.5,-20.1])box(bed,x,2.8,-21.4,.18,3,16,M.cab2);
  for(const z of [-29.3,-13.5])box(bed,-24.8,2.8,z,9.5,3,.18,M.inox);
  for(const x of [-28.5,-21.1])for(const z of [-28.3,-14.5])cyl(bed,x,.65,z,.5,.3,M.black,'x');
  for(const z of [-23.8,-19])rod(bed,[-10.9,3.7,z],[-20.1,3.2,z],.4,M.steelD);
  for(const x of [-5.4,5.4])box(cab,x,20.2,1.5,.25,.3,4,M.lamp);
  // External units from the supplied plan: cooling 1050 × 750 mm and
  // optional band filter 1523 × 1390 mm. Heights are visual estimates.
  const equipment=group('RXU-layout-equipment');equipment.userData.part='lozko';
  const cooling=group('cooling-unit',equipment),filter=group('optional-band-filter',equipment);
  box(cooling,5.6,5.5,-50.9,10.5,10.5,7.5,M.cab2);box(cooling,5.6,10.85,-50.9,10.6,.2,7.6,M.dark);
  for(let i=0;i<17;i++)box(cooling,5.6,4.1+i*.25,-47.12,8,.08,.07,M.dark);
  label(cooling,'COOLING',5.6,9.9,-47.1,3,.45,{color:'#52616b',background:'#c9cdd1',size:60});
  for(const x of [1.2,10])for(const z of [-53.8,-48])cyl(cooling,x,.2,z,.3,.4,M.steelD);
  box(filter,-20.8,5.5,-48.9,15.23,10.5,13.9,M.cab2);box(filter,-20.8,10.9,-48.9,15.4,.25,14.1,M.inox);
  for(const x of [-25.6,-17])cyl(filter,x,11.2,-51,1.25,.45,M.dark);
  box(filter,-20.8,7,-41.92,13.5,6,.15,M.cab);label(filter,'BAND FILTER',-20.8,9,-41.8,5,.5,{color:'#52616b',background:'#e6e8ea',size:60});
  const hoses=group('coolant-connections',equipment);
  for(const [x,z] of [[4,-47.2],[-18,-41.9]]){
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(x,2,z),new THREE.Vector3(x*.7,1.5,-43),new THREE.Vector3(4,2,-39.3)]);
    hoses.add(new THREE.Mesh(new THREE.TubeGeometry(path,24,.12,8,false),M.black));
  }
  return {cab,aG,cG,yG,xG,zG,sp,toolG,buildTool,pockets,magG,driveShaft,saddle,magY,magZ,panG,armPivot,armElbow,hmi,sm:hmi.display,covers:[],clampPins,doors:[door],loadMagazine,
    accessories:{equipment:{cooling,filter},update(c){equipment.visible=c.accessorySetup!=='none';filter.visible=c.accessorySetup==='filter';hoses.children.forEach((h,i)=>h.visible=i===0||filter.visible);}},
    updateGeometry({doorK,panelA,panelYaw}){
      door.position.set(4.3,7.8,9.45);door.rotation.y=doorK*Math.PI*100/180;
      armPivot.rotation.y=-panelA*.4;armElbow.rotation.y=panelA*.2;panG.rotation.y=panelA*.2+panelYaw;
      covers.forEach(o=>{const {side,index}=o.userData,x=xG.position.x,lo=side<0?-8.7:x+2,hi=side<0?x-2:8.7,w=Math.max(.1,hi-lo)/20;o.position.x=lo+(index+.5)*w;o.scale.x=w/.32;});
    },
    viewOverrides:{celok:()=>[[-43,32,61],[-2,15,-12]],vybavenie:()=>[[-42,28,-68],[-10,7,-40]],panel:()=>{const p=panG.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,11.5,0));return [p.clone().add(new THREE.Vector3(-8,5,15)).toArray(),p.toArray()];},zhora:()=>[[.01,100,-10],[0,12,-10],true]},
  };
}
