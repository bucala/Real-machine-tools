import * as THREE from 'three';
import { modelKit } from './modelKit';
import { XPERT320,OPEN_TIP,sheetSection,supportDepth } from './pressBrakeProcess';

export const BRAKE_DIE_TOP=11;
// Millimetres from the supplied 320/4300 data sheet, converted at 1 unit = 100 mm.
// Covers, optional supports and controls are reconstructed from the photographs.
export function createBystronicModel({root,G,M,tex}){
  const {group,box,cyl,rod,label,bolts,clear}=modelKit(root,M,tex);
  const part=k=>{const g=group(k);g.userData.part=k;G[k]=g;return g;};
  const profile=(p,name,points,width,mat,x=0)=>{
    const s=new THREE.Shape();points.forEach(([z,y],i)=>i?s.lineTo(-z,y):s.moveTo(-z,y));s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:width,bevelEnabled:false});g.translate(0,0,-width/2);g.rotateY(Math.PI/2);
    const m=new THREE.Mesh(g,mat);m.name=name;m.position.x=x;m.castShadow=true;m.receiveShadow=true;p.add(m);return m;
  };
  const tube=(p,pts,r,mat=M.black)=>{const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))),32,r,8,false),mat);p.add(m);return m;};
  const frame=part('ram');
  for(const s of [-1,1]){
    const x=s*22.525;
    profile(frame,'C-side-frame',[[-14.5,.35],[5.5,.35],[5.5,9.5],[-2,9.5],[-2,19.4],[5.5,19.4],[5.5,31.7],[-14.5,31.7]],7.55,M.cab,x);
    box(frame,x,.35,-4.5,7.65,.65,19.9,M.dark);
    // Sloping lower cheeks of the white front covers.
    profile(frame,'upper-cheek',[[3.5,20.4],[5.5,20.4],[6.1,21.1],[6.1,31.45],[3.5,31.7]],7.5,M.cab,x);
    box(frame,s*26.34,16.2,-4.5,.06,30.3,19.8,M.cab);
    box(frame,s*26.38,16.2,1.8,.035,30.3,.22,M.red);
    for(const y of [7.3,22.1])box(frame,s*26.39,y,-6.1,.035,.025,16.4,M.dark);
    for(const y of [2,16,29])for(const z of [-12.9,.8])cyl(frame,s*26.42,y,z,.04,.035,M.steelD,'x');
    for(const z of [-12.5,3.5]){cyl(frame,x,.2,z,.65,.35,M.steelD);cyl(frame,x,.58,z,.22,.45,M.steel);}
  }
  box(frame,0,31.4,-4.5,37.5,.6,20,M.cab);
  const rearWall=box(frame,0,15.9,-14.45,37.5,30.8,.16,M.cab2);
  // Separate rear cabinet doors, louver packs, hinges and service latches.
  const back=part('servis');
  for(const x of [-14,0,14]){
    box(back,x,15.8,-14.58,13.8,30.4,.12,M.cab);
    for(const sx of [-1,1])for(const y of [4,26])box(back,x+sx*6.6,y,-14.69,.14,.65,.12,M.steelD);
    box(back,x+5.8,15.8,-14.75,.14,1.1,.12,M.black);
    for(const xx of [x-3.7,x+3.7])for(let i=0;i<28;i++)box(back,xx,4.6+i*.47,-14.68,2.6,.13,.08,M.steelD);
    box(back,x,23,-14.66,13.6,.025,.025,M.dark);
  }
  label(back,'Bystronic',0,25.8,-14.66,2.6,1.2,{color:'#fff',background:'#f34b32',rotate:Math.PI,size:100});
  // Rounded black visor, with its characteristic falling ends and raised red tab.
  const hood=part('kryty'),hs=new THREE.Shape();hs.moveTo(-18.75,31.6);hs.lineTo(18.75,31.6);hs.quadraticCurveTo(18.55,30.8,18.3,29.6);hs.lineTo(17.6,25.5);hs.quadraticCurveTo(17.35,24.7,16.5,24.7);hs.lineTo(-16.5,24.7);hs.quadraticCurveTo(-17.35,24.7,-17.6,25.5);hs.lineTo(-18.3,29.6);hs.quadraticCurveTo(-18.55,30.8,-18.75,31.6);
  const hg=new THREE.ExtrudeGeometry(hs,{depth:.35,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.06,bevelThickness:.06});hg.translate(0,0,5.85);const hm=new THREE.Mesh(hg,M.visor);hm.name='rounded-black-visor';hm.castShadow=true;hood.add(hm);
  label(hood,'Xpert Pro 320',-10.5,25.7,6.28,4.1,.42,{color:'#f2f4f4',background:'#24272b',size:86});
  profile(hood,'raised-Bystronic-tab',[[6.2,29],[7.05,29],[7.05,31.7],[6.35,31.7],[5.95,31.1]],2.2,M.red,-11.9);
  label(hood,'Bystronic',-11.9,31.2,7.075,1.8,.32,{color:'#fff',background:'#f44b32',size:100});
  const lightMat=new THREE.MeshStandardMaterial({color:0xe7f7ff,emissive:0xc6edff,emissiveIntensity:1.4,roughness:.2});
  box(hood,0,24.42,4.85,35.9,.16,.35,M.steelD);box(hood,0,24.35,5.02,35.5,.09,.08,lightMat);
  // Synchronised Y1/Y2 ram and hydraulic cylinders; all tooling moves with it.
  const ramPart=part('baran'),ram=group('synchronised-Y1-Y2',ramPart);
  box(ram,0,19.1,2.05,43,8.4,3.4,M.anth);box(ram,0,22.7,3.79,42.8,1.15,.12,M.cab2);box(ram,0,22.08,3.88,42.8,.25,.07,M.red);
  box(ram,0,14.95,2,43,.32,1.3,M.black);box(ram,0,14.82,2.65,43,.3,.12,M.steel);
  for(const s of [-1,1]){
    cyl(frame,s*20,26,-1,.85,7.3,M.anth);cyl(ram,s*20,21,-1,.42,7.2,M.steel);
    box(frame,s*21.6,19.5,1.8,.3,10,1.5,M.steelD);box(ram,s*21.4,18.1,1.8,.2,5.3,1.35,M.steel);
    tube(frame,[[s*20,29.3,-1],[s*20,30,-3],[s*15,30,-8],[s*15,20,-10]],.09);
  }
  // Orange tooling scales and individual clamps.
  const ruler=tex(2048,64,(g,w,h)=>{g.fillStyle='#ef482f';g.fillRect(0,0,w,h);g.fillStyle='#f4f1eb';for(let i=0;i<=86;i++){const x=i*w/86;g.fillRect(x,0,2,i%5?14:25);if(i%5===0){g.font='17px Arial';g.fillText(String(i*50),x+4,48);}}});
  const scale=(p,y,z)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(43,.16),new THREE.MeshBasicMaterial({map:ruler.tx,toneMapped:false}));m.position.set(0,y,z);p.add(m);};scale(ram,14.68,2.75);
  for(let i=0;i<43;i++){const x=-21+i+.5;box(ram,x,14.63,2,.91,.35,.75,M.steelD);cyl(ram,x,14.62,2.43,.045,.035,M.black,'z');}
  const punch=group('segmented-85-degree-punch',ram);
  for(let i=0;i<20;i++)profile(punch,'punch-segment',[[1.72,14.9],[2.28,14.9],[2.28,14.55],[2.5,14.55],[2.5,14.1],[2.06,12.865],[2,12.8],[1.94,12.865],[1.5,13.75],[1.5,14.4],[1.72,14.4]],2.145,M.tool,-21.5+(i+.5)*2.15);
  // Bed, crowning cassette and V die. The V opening is an actual concave section.
  const bed=part('stol');box(bed,0,4.45,.2,43,8,6.6,M.anth);box(bed,0,.6,-.5,43,.8,9,M.dark);
  box(bed,0,8.35,2,43,.3,.74,M.steel);box(bed,0,9.2,2,43,1.4,.95,M.steelD);box(bed,0,9.92,2,43,.16,1.62,M.steel);
  scale(bed,9.94,2.83);
  for(let i=0;i<43;i++){const x=-21+i;cyl(bed,x,8.18,3.55,.065,.04,M.black,'z');}
  for(const x of [-18,-12,-6,0,6,12,18]){cyl(bed,x,6.5,3.58,.18,.08,M.steel,'z');cyl(bed,x,6.5,3.64,.09,.08,M.dark,'z');}
  for(const y of [1.2,3,7.2])box(bed,0,y,3.55,42,.08,.12,M.dark);
  const die=group('replaceable-V-die',bed);let previousV;
  // Back gauge X carriage, R lift columns, Z fingers and ball screws.
  const gauge=part('dorazy'),xSlide=group('X-backgauge-carriage',gauge),rSlide=group('R-backgauge-lift',xSlide),fingers=[];
  for(const x of [-12,12]){
    box(gauge,x,4.4,-6,1,1,12,M.anth);box(gauge,x,4.97,-6,.28,.14,11.7,M.steel);cyl(gauge,x,4.65,-6,.1,11.8,M.steel,'z');
    box(xSlide,x,5.4,0,1.9,.65,2.2,M.steelD);box(xSlide,x,7.3,0,1.4,3.2,1.2,M.anth);
    for(const sx of [-.45,.45])box(xSlide,x+sx,7.4,.65,.16,3.2,.12,M.steel);
    cyl(xSlide,x,7.4,.7,.09,3.1,M.steel);
  }
  box(rSlide,0,9.8,0,32,1.15,1.6,M.anth);box(rSlide,0,10.42,.6,31.5,.16,.2,M.steel);
  for(const s of [-1,1]){
    const f=group('Z'+(s<0?'1':'2')+'-finger',rSlide);fingers.push(f);
    box(f,0,10.5,.1,1.5,.55,1.9,M.steelD);box(f,0,10.87,1,1,.25,2.8,M.steel);
    box(f,0,11.09,2.3,.55,.3,.38,M.brass);box(f,0,11.22,2.12,.4,.16,.18,M.brass);
    for(const x of [-.3,.3])cyl(f,x,11.02,.5,.06,.06,M.black);
  }
  // Front adjustable support arms on a common rail, with rollers and hand clamps.
  const supports=part('podpery');box(supports,0,8,4.45,43,.3,.3,M.steel);
  for(const x of [-10,10]){
    profile(supports,'support-upright',[[4.6,3],[5.5,3],[6.1,8.5],[7.3,10.8],[5.5,10.8]],1.5,M.anth,x);
    box(supports,x,10.68,7.8,1.5,.5,6.3,M.anth);box(supports,x,10.84,7.8,1.65,.12,6.4,M.steel);
    for(const z of [5,6.2,7.4,8.6,9.8,10.6])cyl(supports,x,10.91,z,.09,1.45,M.steel,'x');
    cyl(supports,x,9.7,5.9,.18,.18,M.steel,'z');rod(supports,[x-.25,10.94,10.2],[x+.4,10.94,10.2],.06,M.red);
    for(const y of [4.5,7.4])cyl(supports,x,y,5.9,.09,.05,M.steel,'z');
  }
  box(supports,-18.7,5.6,7.2,4.1,5.7,4.6,M.anth);
  for(let i=0;i<13;i++)box(supports,-18.7,8.6+i*.13,7.2,4.5,.045,4.8,M.black);
  box(supports,-18.7,10.4,7.2,4.6,.2,4.9,M.steel);bolts(supports,-18.7,5.5,9.55,3.6,4.8);
  // Angled, glazed side guards. Their full frames pivot from the cabinet edge.
  const guards=part('ochrana'),guardPivots=[];
  for(const side of [-1,1]){
    const p=group('side-guard',guards);p.position.set(side*26.3,0,5.65);p.scale.x=-side;guardPivots.push(p);
    const outline=[[0,7],[4.8,7],[6.5,9],[6.5,21],[0,21]],pane=[[.55,8],[4.55,8],[5.95,9.6],[5.95,20.45],[.55,20.45]];
    const s=new THREE.Shape();outline.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const hole=new THREE.Path();pane.forEach(([x,y],i)=>i?hole.lineTo(x,y):hole.moveTo(x,y));hole.closePath();s.holes.push(hole);
    const g=new THREE.ExtrudeGeometry(s,{depth:.16,bevelEnabled:false}),m=new THREE.Mesh(g,M.cab);p.add(m);m.castShadow=true;
    const gs=new THREE.Shape();pane.forEach(([x,y],i)=>i?gs.lineTo(x,y):gs.moveTo(x,y));gs.closePath();const glass=new THREE.Mesh(new THREE.ExtrudeGeometry(gs,{depth:.06,bevelEnabled:false}),M.glass);glass.position.z=.05;glass.name='smoked-side-guard-window';p.add(glass);
    for(const y of [9,19])box(p,.15,y,.22,.26,.55,.18,M.black);box(p,5.8,15,.35,.18,2,.18,M.black);
  }
  const laser=[];
  for(const side of [-1,1]){
    box(ram,side*21.95,14.5,3.7,.65,.8,1.05,M.black);box(ram,side*21.95,14.5,4.25,.5,.48,.05,M.glass);
    const m=cyl(ram,side*21.95,14.5,4.31,.1,.04,M.green,'z');laser.push(m);
  }
  // Mobile ByVision-style touch terminal and the separate bent pedal pedestal.
  const panel=part('panel'),consolePivot=group('mobile-touch-console',panel);consolePivot.position.set(29.2,0,13);
  box(consolePivot,0,.35,0,5.5,.2,4.7,M.dark);
  for(const x of [-2.25,2.25])for(const z of [-1.85,1.85]){cyl(consolePivot,x,.15,z,.32,.3,M.black);cyl(consolePivot,x,.48,z,.24,.09,M.red);}
  for(const x of [-.7,.7]){rod(consolePivot,[x,.5,0],[x,10.9,-1.1],.15,M.red);box(consolePivot,x,5.8,-.6,.26,10.5,.32,M.red);}
  box(consolePivot,0,7.1,-.75,1.1,6,.3,M.steel);box(consolePivot,0,8.1,1.05,5,.1,2.2,M.dark);
  const monitor=group('ByVision-touchscreen',consolePivot);monitor.position.set(0,11,-1);monitor.rotation.x=-.23;
  box(monitor,0,1.2,0,7.4,4.5,.35,M.black);box(monitor,0,1.2,-.25,3.8,2.7,.2,M.anth);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(7,4.06),new THREE.MeshBasicMaterial({toneMapped:false}));display.position.set(0,1.2,.19);monitor.add(display);
  label(monitor,'Bystronic',-2.7,3.2,.2,1.1,.16,{color:'#fff',background:'#181b1f',size:100});
  const pedal=part('pedal');pedal.position.set(12,0,14);
  profile(pedal,'bent-pedal-pedestal',[[-1,.2],[1.4,.2],[1.4,.6],[.2,6.3],[.9,7.6],[-1,8.5],[-1.6,7.9],[-.5,6.4]],1.45,M.cab);
  profile(pedal,'orange-pedal-edge',[[-1,.25],[1.2,.25],[0,6.3],[.7,7.6],[-1,8.3],[-1.25,8.05],[-.1,7.55],[-.5,6.4]],.15,M.red,.8);
  box(pedal,0,.35,1.4,2.6,.5,2,M.dark);box(pedal,0,7.65,-.2,1.1,.18,1.4,M.dark);
  const controls={buttons:{}};controls.buttons.start=box(pedal,-.52,.65,1.5,.85,.16,1.1,M.steelD);controls.buttons.retract=box(pedal,.52,.65,1.5,.85,.16,1.1,M.steelD);
  for(const [id,x,mat] of [['hold',-.3,M.red],['reset',.28,M.green]])controls.buttons[id]=cyl(pedal,x,7.84,-.15,.1,.08,mat);
  cyl(consolePivot,0,10.2,0,.25,.1,M.yellow,'z');controls.buttons.emergency=cyl(consolePivot,0,10.2,.13,.17,.2,M.red,'z');
  tube(panel,[[29.2,.4,12],[33,.25,11],[34,.2,6],[28,.15,5],[25,.5,0]],.06);tube(pedal,[[0,.3,0],[3,.15,-1],[5,.15,-4],[6,.3,-8]],.055);
  const light=new THREE.PointLight(0xddeeff,90,30,2);light.position.set(0,13.8,-1);frame.add(light);
  const cutawayParts=[hood,back,rearWall];
  for(const o of cutawayParts){const raycast=o.raycast;o.raycast=function(...args){if(!this.visible)return false;return raycast.apply(this,args);};}
  const stock=part('plech');stock.name='bent-sheet';stock.userData.stepJoin=true;
  let sheetKey;
  const rebuildSheet=(c,beta)=>{
    const key=[c.length,c.depth,c.flange,c.thickness,c.v,beta.toFixed(5)].join(':');if(key===sheetKey)return;sheetKey=key;clear(stock);
    const points=sheetSection(c,beta),t=c.thickness/2,poly=[...points.map(p=>[-p.z+t*Math.sin(p.t),p.y+t*Math.cos(p.t)]),...points.toReversed().map(p=>[-p.z-t*Math.sin(p.t),p.y-t*Math.cos(p.t)])];
    const s=new THREE.Shape();poly.forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y));s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:c.length,bevelEnabled:false});g.translate(0,0,-c.length/2);g.rotateY(Math.PI/2);g.scale(.01,.01,.01);
    const mesh=new THREE.Mesh(g,M.sheet);mesh.castShadow=true;mesh.receiveShadow=true;stock.add(mesh);
  };
  return {ram,punch,die,xSlide,rSlide,fingers,stock,consolePivot,display,controls,guardPivots,light,cutawayParts,
    update({S,c,guardAngle}){
      cutawayParts.forEach(o=>{o.visible=!c.cutaway;});
      ram.position.y=-S.y*.01;
      if(previousV!==c.v){previousV=c.v;clear(die);const half=c.v*.005,depth=half/Math.tan(42.5*Math.PI/180);
        for(let i=0;i<20;i++)profile(die,'V-die-segment',[[1.2,10],[2.8,10],[2.8,11],[2+half,11],[2,11-depth],[2-half,11],[1.2,11]],2.145,M.tool,-21.5+(i+.5)*2.15);
      }
      xSlide.position.z=2-c.flange*.01-2.49;rSlide.position.y=c.r*.01;
      const z=Math.min(14.5,Math.min(c.length*.003,c.length*.005-.3));fingers[0].position.x=-z;fingers[1].position.x=z;
      guardPivots.forEach((p,i)=>{p.rotation.y=(i?1:-1)*guardAngle;});
      laser.forEach(m=>{m.material=c.obstructed?M.red:M.green;});light.visible=c.light;lightMat.emissiveIntensity=c.light?1.4:0;
      if(!c.unclamped){rebuildSheet(c,S.beta);stock.position.set(0,BRAKE_DIE_TOP+(c.thickness/2-supportDepth(c,S.beta))*.01,2);}
      consolePivot.rotation.y=c.hmiAngle*Math.PI/180;
    },
    nominal:XPERT320,openTip:OPEN_TIP,
  };
}
