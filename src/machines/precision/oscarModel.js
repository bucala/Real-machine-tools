import { drawTerminalKeyboard } from './terminalKeyboard';
import * as THREE from 'three';
import { modelKit } from './modelKit';
import { accordionGeometry,oscarDecals } from './oscarDetails';

// EX500: manufacturer table/axis dimensions; sheet-metal details reconstructed
// from the supplied EX catalogue and front/side photographs (not factory CAD).
export function createOscarModel({root,G,M,tex}){
  const {group,box,cyl,rod,label,bolts,clear}=modelKit(root,M,tex);
  const part=k=>{const g=group(k);g.userData.part=k;G[k]=g;return g;};
  const named=(o,name)=>(o.name=name,o);
  const decals=oscarDecals(tex);
  const decal=(parent,o,name,x,y,z,ry=0)=>{o.name=name;o.position.set(x,y,z);o.rotation.y=ry;parent.add(o);return o;};
  const rubber=M.black.clone();rubber.roughness=.86;rubber.metalness=.03;
  const boot=(parent,name,w,d,folds)=>{const o=new THREE.Mesh(accordionGeometry(w,d,folds),rubber);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const screw=(parent,x,y,z,axis='z')=>{
    const g=group('captive-screw',parent);g.position.set(x,y,z);if(axis==='x'||axis==='-x')g.rotation.y=(axis==='x'?1:-1)*Math.PI/2;
    cyl(g,0,0,0,.037,.018,M.steel,'z');box(g,0,0,.011,.042,.009,.005,M.dark);
  };
  const profile=(parent,name,points,width,material,x=0)=>{
    const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(-z,y):shape.moveTo(-z,y));shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false});g.translate(0,0,-width/2);g.rotateY(Math.PI/2);
    const o=new THREE.Mesh(g,material);o.name=name;o.position.x=x;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  };
  const tube=(parent,name,points,r,mat=M.black)=>{const o=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),28,r,8,false),mat);o.name=name;parent.add(o);return o;};
  const eye=(p,x,y,z)=>{const o=new THREE.Mesh(new THREE.TorusGeometry(.18,.045,8,20),M.brass);o.position.set(x,y,z);p.add(o);cyl(p,x,y-.19,z,.12,.12,M.steelD);};
  const body=part('lozko');
  box(body,.5,.5,-4.5,18.3,.8,18.2,M.dark);
  box(body,-.8,4.65,-4.5,15.7,8,17.2,M.cab);
  for(const x of [-7.5,7.9])for(const z of [-12,3.5]){cyl(body,x,.25,z,.48,.4,M.steelD);cyl(body,x,.55,z,.2,.45,M.steel);}
  // Separate front cover plates with narrow seams and captive screws.
  for(const [x,w] of [[-7.35,2.2],[-.6,11.15],[6.65,3.25]]){
    box(body,x,4.55,4.16,w,7.9,.12,M.cab);
    for(const sx of [-1,1])for(const y of [1,4.4,8.05])screw(body,x+sx*(w/2-.14),y,4.23);
  }
  // The front corner towers meet the lower fascia; the tank wall sits between
  // them, rather than overlapping a second, disconnected pair of boxes.
  for(const [x,w] of [[-7.35,2.2],[6.65,3.25]]){
    box(body,x,10.67,-.2,w,4.36,8.9,M.cab);
    profile(body,'folded-tank-pillar-cap',[[-4.65,12.85],[4.25,12.85],[4.25,12.94],[3.9,13.05],[-4.65,13.05]],w,M.cab,x);
    for(const y of [8.65,12.6])for(const sx of [-1,1])screw(body,x+sx*(w/2-.15),y,4.265);
  }
  decal(body,decals.plate(),'EX500-identification-plate',-7.35,11.95,4.27);
  // Left side service panels and folded upper shelf visible in the exhibition views.
  for(const z of [-8.4,-.25]){
    box(body,-8.68,4.7,z,.075,7.65,7.9,M.cab);
    for(const y of [1.1,8.25])for(const zz of [z-3.7,z+3.7])screw(body,-8.73,y,zz,'-x');
    for(const y of [2.1,6.8])box(body,-8.74,y,z-3.5,.08,.45,.13,M.steelD);
  }
  box(body,-7.65,13.7,-3.5,2.5,.55,6.3,M.cab);
  box(body,-7.65,13.97,-3.5,2.44,.06,6.22,M.inox);
  box(body,-7.65,12.9,-6.35,2.2,1.3,.45,M.cab2);
  // Open stainless tank, seal channels and sliding front gate.
  const tank=part('nadrz');
  box(tank,0,8.8,-.5,11.4,.35,8.2,M.inox);
  for(const x of [-5.7,5.7]){box(tank,x,10.7,-.6,.16,3.8,8.2,M.inox);box(tank,x,12.64,-.6,.3,.1,8.35,M.steel);
    for(const z of [-3.7,-1.4,1,3])cyl(tank,x,12.705,z,.035,.018,M.steelD);
  }
  box(tank,0,10.7,-4.7,11.5,3.8,.16,M.inox);
  box(tank,0,12.66,-4.7,11.6,.12,.32,M.steel);
  // Rear upper return, drain, and flush manifold remain clear of the work table.
  box(tank,5,13.4,-3.7,1.5,1.3,.4,M.cab);box(tank,5,14.02,-3.1,1.5,.35,1.6,M.cab);
  cyl(tank,4.8,9.01,-3.7,.23,.04,M.steelD);cyl(tank,4.8,9.04,-3.7,.16,.02,M.black);
  for(let i=0;i<4;i++){const x=-4.8+i*.34;cyl(tank,x,12,-4.55,.07,.2,M.brass,'z');rod(tank,[x,12,-4.43],[x,11.65,-4.3],.045,M.steel);}
  const gate=group('descending-loading-gate',tank);
  box(gate,0,0,0,11.4,3.7,.22,M.inox);box(gate,0,1.88,0,11.45,.1,.34,M.steel);
  box(gate,0,1.22,.126,11.35,1.16,.035,M.steelD);
  box(gate,0,-1.8,.14,11.3,.12,.08,M.steelD);
  decal(gate,decals.model(),'EX500-white-red-badge',-4.35,1.5,.151);
  decal(gate,decals.safety(),'tank-safety-pictograms',3.42,1.39,.151);
  for(const x of [-5.45,5.45]){box(tank,x,10.3,3.85,.19,4.8,.22,M.steelD);cyl(tank,x,9.8,3.65,.08,4.8,M.steel);bolts(gate,x,0,.14,.1,3.2);}
  const oil=new THREE.Mesh(new THREE.PlaneGeometry(11.05,7.9),M.oil);oil.rotation.x=-Math.PI/2;oil.position.z=-.6;oil.userData.excludeFromExport=true;oil.userData.excludeFromMachineExport=true;tank.add(oil);
  const table=part('stol');table.position.y=9;
  const slideY=group('fixed-table-support',table),slideX=group('fixed-850x450-table',slideY);
  box(slideY,0,-.45,0,10,.5,6.5,M.dark);box(slideX,0,-.1,0,8.5,.3,4.5,M.table);
  for(const z of [-1.5,-.5,.5,1.5]){box(slideX,0,.055,z,8.3,.03,.065,M.steelD);box(slideX,0,.051,z+.05,8.3,.008,.015,M.steel);}
  for(const x of [-3.8,3.8])for(const z of [-1.9,1.9])cyl(slideX,x,.065,z,.045,.02,M.black);
  box(slideX,0,.3,0,1.4,.5,1.1,M.steelD);box(slideX,0,.45,0,1.3,.15,1,M.steel);
  for(const x of [-.8,.8]){box(slideX,x,.2,0,.2,.3,.7,M.dark);cyl(slideX,x,.38,0,.06,.12,M.steel);cyl(slideX,x,.45,0,.085,.06,M.steelD);}
  for(const z of [-.44,.44])for(const x of [-.55,.55])cyl(slideX,x,.535,z,.035,.025,M.black);
  const stockMount=group('stock-fixture',slideX);stockMount.position.y=.5;
  // Moving C column. The slim front tower is continuous to the black Z bellows.
  const axes=part('osi');
  const framePoints=[[-11.5,8.8],[-11.5,17.4],[-1.4,21.25],[-1.4,14.9],[-7.2,14.9],[-7.2,8.8]];
  profile(axes,'sloped-C-frame',framePoints,3.4,M.cab2);
  for(const side of [-1,1]){
    profile(axes,'C-frame-side-sheet',framePoints,.045,M.cab,side*1.73);
    for(const z of [-10.9,-8,-5,-2])for(const y of [15.18,17.25+(z+10.9)*.38])screw(axes,side*1.77,y,z,side<0?'-x':'x');
    box(axes,side*1.77,15.4,-6,.035,.025,9.9,M.steelD);
  }
  box(axes,0,21.5,0,3.1,12.56,2.8,M.cab);
  named(box(axes,0,21.5,1.43,3.06,12.56,.06,M.inox),'continuous-front-column');
  for(const x of [-1.48,1.48]){box(axes,x,21.5,1.465,.015,12.5,.008,M.steelD);for(const y of [15.6,18.7,22,26.8])screw(axes,x,y,1.48);}
  decal(axes,decals.column(),'EX-diagonal-brand-stripes',0,25.49,1.468);
  box(axes,0,15.22,0,3.22,.2,2.96,M.cab);box(axes,0,15.095,0,2.92,.05,2.76,M.steelD);
  const xBoots=[boot(axes,'X-left-accordion',1.2,3.5,24),boot(axes,'X-right-accordion',1.2,3.5,24)];
  for(const b of xBoots)b.rotation.z=-Math.PI/2;
  for(const x of [-6.65,6.65]){box(body,x,13.55,-6,1.1,1.8,3.7,M.cab);box(body,x,14.5,-6,1.2,.15,3.8,M.cab);}
  const ram=group('Z-servo-ram',axes);
  box(ram,0,2,0,1.8,2,1.8,M.steelD);
  box(ram,0,.91,0,2.62,.16,2.42,M.steelD);box(ram,0,.77,0,1.22,.16,1.22,M.black);
  cyl(ram,0,.55,0,.48,.36,M.steel);cyl(ram,0,.32,0,.47,.1,M.black);cyl(ram,0,.18,0,.36,.18,M.steel);
  for(const y of [.42,.62])cyl(ram,0,y,0,.495,.025,M.steelD);
  for(const x of [-.53,.53])box(ram,x,.55,0,.1,.18,.3,M.steelD);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(ram,Math.cos(a)*.4,.3,Math.sin(a)*.4,.035,.08,M.black);}
  const electrode=group('non-rotating-electrode',ram);
  const bellows=boot(axes,'Z-servo-bellows',2.72,2.52,28);
  // Hoses follow the ram; fittings and nozzle ends stay beside the electrode.
  const hose=M.brass.clone();hose.color.setRGB(.37,.37,.18);hose.metalness=.05;hose.roughness=.35;
  for(const s of [-1,1]){
    tube(ram,s<0?'left-flush-hose':'right-flush-hose',[[s*.95,.92,-.5],[s*1.4,.72,-.3],[s*1.45,-.05,.8],[s*.6,-.4,.6]],.038,hose);
    cyl(ram,s*.95,.88,-.5,.08,.15,M.brass);
    rod(ram,[s*.6,-.4,.6],[s*.3,-.55,.2],.055,M.brass);
    cyl(ram,s*.6,-.4,.6,.075,.1,M.steel,'z');
  }
  // Restrained, clipped service run along the C-frame (no free-standing loop).
  tube(axes,'clipped-rear-cable',[[1.8,15,-1.8],[1.9,15.7,-4],[1.9,15.8,-8.8],[1.9,14.9,-10],[1.9,9,-10]],.085);
  for(const z of [-3.8,-6.5,-8.8])box(axes,1.9,15.78,z,.23,.28,.12,M.steelD);
  const safety=part('bezpecnost');axes.add(safety);
  cyl(safety,-1.9,17.1,.8,.25,2.4,M.red);cyl(safety,-1.9,18.33,.8,.2,.06,M.steelD);
  cyl(safety,-1.9,15.81,.8,.25,.18,M.red,'y',.09);cyl(safety,-1.9,15.64,.8,.065,.16,M.brass);
  for(const y of [16.35,17.85]){cyl(safety,-1.9,y,.8,.258,.12,M.steel);box(safety,-1.65,y,.7,.45,.12,.18,M.steelD);}
  label(safety,'FIRE',-1.9,17.1,1.06,.37,.5,{color:'#d71924',background:'#f0f0eb',size:90});
  tube(safety,'extinguisher-delivery',[[-1.9,15.6,.8],[-1.95,15.35,.8],[-1.8,15.15,.6]],.035,M.steel);
  cyl(safety,.9,15.85,1.48,.18,.06,M.blue,'z');cyl(safety,.9,15.85,1.52,.14,.025,M.yellow,'z');cyl(safety,.9,15.85,1.54,.085,.015,M.cab,'z');
  const lampMaterial=new THREE.MeshStandardMaterial({color:0xe9f5ed,emissive:0xdff3e4,emissiveIntensity:1.8,roughness:.24});
  const lightBars=[];
  for(const x of [-3.45,3.45]){
    for(const s of [-1,1])box(tank,x+s*1.35,12.85,-4.58,.17,.4,.14,M.steelD);
    box(tank,x,13.13,-4.47,3.3,.3,.23,M.cab2);
    lightBars.push(named(box(tank,x,13.1,-4.33,3.05,.18,.06,lampMaterial),'sealed-task-light'));
    for(const s of [-1,1])box(tank,x+s*1.62,13.12,-4.38,.12,.35,.2,M.dark);
  }
  // Generator / dielectric service cabinet, full-height doors, hinges and louvers.
  const rear=part('generator');
  box(rear,6.9,7.6,-7.5,5.3,14.2,12.8,M.cab2);
  for(const z of [-11,-4.45]){
    box(rear,9.62,7.7,z,.09,13.5,6.42,M.cab);
    for(const y of [4.8,11])box(rear,9.7,y,z-2.8,.1,.55,.17,M.steelD);
    box(rear,9.76,9.4,z+2.4,.18,1.05,.11,M.black);
    for(let i=0;i<13;i++)box(rear,9.69,1.6+i*.12,z,.06,.045,4.55,M.dark);
    for(const y of [1,14.2])for(const zz of [z-2.8,z+2.8])cyl(rear,9.7,y,zz,.04,.04,M.steelD,'x');
  }
  box(rear,6.9,7.6,-14,5.25,13.7,.1,M.cab);bolts(rear,6.9,7.6,-13.92,4.8,13);
  box(rear,6.9,14.77,-7.5,5.4,.16,12.95,M.cab);for(let i=0;i<20;i++)box(rear,5.1+i*.16,14.86,-8.5,.05,.025,3.6,M.dark);
  for(const x of [4.7,9])for(const z of [-13,-2])eye(rear,x,15.0,z);
  cyl(rear,6.6,16.25,-8,.18,2.7,M.steel);cyl(rear,6.6,17.65,-8,.25,.14,M.steelD);
  decal(rear,decals.plate(),'generator-identification',6.8,13.1,-1.04);
  box(rear,8.8,10.3,-1.03,.12,1.2,.15,M.steelD);box(rear,8.8,10.3,-.93,.1,.9,.1,M.black);
  label(rear,'60 A',6.8,11.7,-1.04,1.2,.6,{color:'#d9e5ef',background:'#263541',size:100});
  tube(rear,'dielectric-return',[[5.9,2,-2],[5.9,1,-.5],[3.5,1,1],[3.5,8,-3]],.13);
  // Mobile PC terminal with sloping base, caster wheels and folded keyboard tray.
  const panel=part('panel'),panelPivot=group('mobile-console',panel);panelPivot.position.set(9.5,0,10);
  profile(panelPivot,'sloping-console-foot',[[-2.4,.25],[2.4,.25],[2.4,.55],[1.8,.95],[-1.7,.95],[-2.4,.55]],5.2,M.cab2);
  for(const x of [-1.9,1.9])for(const z of [-1.7,1.7]){cyl(panelPivot,x,.2,z,.22,.2,M.black,'x');box(panelPivot,x,.44,z,.25,.22,.38,M.steelD);}
  box(panelPivot,0,4.9,-.4,1.7,8,1.5,M.cab);box(panelPivot,0,5,-1.18,1.45,7.4,.08,M.cab2);
  box(panelPivot,0,6,-1.24,1.18,4.5,.04,M.cab);bolts(panelPivot,0,6,-1.27,1,4.2);
  const deck=group('PC-keyboard-deck',panelPivot);deck.position.set(0,9.8,0);deck.rotation.x=.12;
  profile(deck,'folded-keyboard-tray',[[-1.3,-.25],[1.35,-.25],[1.35,.05],[1.13,.28],[-1.3,.28]],5.7,M.cab);
  box(deck,-.3,.3,0,4.25,.14,1.42,M.black);
  const keyTexture=tex(1024,420,drawTerminalKeyboard);
  const keyboard=new THREE.Mesh(new THREE.PlaneGeometry(4.15,1.35),new THREE.MeshStandardMaterial({map:keyTexture.tx,roughness:.85}));keyboard.rotation.x=-Math.PI/2;keyboard.position.set(-.3,.385,0);deck.add(keyboard);
  const mouse=new THREE.Mesh(new THREE.SphereGeometry(.22,18,12),M.black);mouse.scale.set(1,.48,1.6);mouse.position.set(2,.36,.25);deck.add(mouse);
  tube(deck,'mouse-cable',[[2,.34,-.1],[2.2,.33,-.6],[1.7,.32,-1]],.018);
  for(const x of [-2.65,2.65])for(const z of [-1.05,1.05])cyl(deck,x,.3,z,.035,.018,M.steelD);
  const controls={buttons:{},knobs:{}};
  for(const [id,x,color] of [['start',.5,M.green],['hold',1.1,M.red],['reset',-.2,M.steelD],['light',-1,M.steel],['coolant',-1.7,M.blue]]){
    const g=group(id,deck);g.position.set(x,-.06,1.37);cyl(g,0,0,0,.13,.05,M.steelD,'z');controls.buttons[id]=cyl(g,0,0,.04,.09,.1,color,'z');
  }
  cyl(deck,2.45,.36,-.65,.19,.08,M.yellow);controls.buttons.emergency=cyl(deck,2.45,.49,-.65,.13,.19,M.red);
  tube(panelPivot,'push-handle',[[-1.6,9.4,.9],[-1.6,8.9,1.55],[-1.35,8.75,1.65],[1.35,8.75,1.65],[1.6,8.9,1.55],[1.6,9.4,.9]],.095,M.steel);
  const monitor=group('EX500-monitor',panelPivot);monitor.position.set(0,10.3,-.9);monitor.rotation.x=-.12;
  box(monitor,0,1.65,0,5.8,3.7,.3,M.black);box(monitor,0,1.65,.17,5.45,3.46,.04,M.steelD);box(monitor,0,1.6,-.35,1.4,1.5,.5,M.black);
  label(monitor,'OSCARMAX',0,-.075,.176,1.15,.13,{color:'#b4bdc1',background:'#151b1e',size:105});
  cyl(monitor,2.65,-.075,.18,.026,.012,M.green,'z');
  const display=new THREE.Mesh(new THREE.PlaneGeometry(5.28,3.3),new THREE.MeshBasicMaterial({toneMapped:false}));display.position.set(0,1.65,.2);monitor.add(display);
  box(panelPivot,0,10.15,-.9,1.2,.18,1,M.black);
  cyl(panelPivot,0,10.55,-1.1,.13,1.05,M.black);
  tube(panelPivot,'console-cable',[[0,9.8,-1.3],[0,8,-1.8],[.7,1,-1.4],[2,1,-2]],.07);
  const pendant=group('remote-pendant',panelPivot);pendant.position.set(-3,8.5,0);pendant.rotation.z=-.16;box(pendant,0,0,0,.7,1.45,.32,M.dark);box(pendant,0,.3,.17,.52,.53,.03,M.black);
  for(let i=0;i<6;i++)cyl(pendant,-.18+(i%2)*.36,-.12-Math.floor(i/2)*.2,.19,.065,.05,i===0?M.red:M.steel,'z');
  tube(panelPivot,'pendant-lead',[[-3,7.8,0],[-3,6.8,-.2],[-2.3,6.4,-.5],[-1,7.9,-1]],.045);
  const lamp=new THREE.PointLight(0xeaf5ff,45,12,2);lamp.position.set(0,13,-3.8);root.add(lamp);
  return {gate,oil,slideX,slideY,ram,electrode,stockMount,panelPivot,display,controls,lamp,bellows,xBoots,lightBars,
    buildElectrode(e){clear(electrode);const material=e.material==='graphite'?M.graphite:M.copper;if(e.shape==='round')cyl(electrode,0,-e.length*.005,0,e.w*.005,e.length*.01,material);else box(electrode,0,-e.length*.005,0,e.w*.01,e.length*.01,e.d*.01,material);},
    update({S,oilLevel,door,light,hmiAngle}){
      gate.position.set(0,10.7-door*3.4,3.65);oil.position.y=9+oilLevel*.01;oil.visible=oilLevel>2;
      axes.position.x=S.x*.01;axes.position.z=-S.y*.01;
      const len=electrode.userData.length||100;ram.position.set(0,9+(80-S.depth+len)*.01,0);
      const bottom=ram.position.y+.99;bellows.position.y=bottom;bellows.scale.y=Math.max(.2,15.07-bottom);
      xBoots[0].position.set(-6.65-axes.position.x,14.25,-6);xBoots[0].scale.y=4.95+axes.position.x;
      xBoots[1].position.set(1.7,14.25,-6);xBoots[1].scale.y=4.95-axes.position.x;
      lamp.visible=light;lampMaterial.emissiveIntensity=light?1.8:0;panelPivot.rotation.y=hmiAngle*Math.PI/180;
    },
  };
}
