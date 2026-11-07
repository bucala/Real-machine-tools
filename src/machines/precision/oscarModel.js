import * as THREE from 'three';
import { modelKit } from './modelKit';

// EX500: manufacturer table/axis dimensions; sheet-metal details reconstructed
// from the supplied EX catalogue and front/side photographs (not factory CAD).
export function createOscarModel({root,G,M,tex}){
  const {group,box,cyl,rod,label,bolts,clear}=modelKit(root,M,tex);
  const part=k=>{const g=group(k);g.userData.part=k;G[k]=g;return g;};
  const named=(o,name)=>(o.name=name,o);
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
    box(body,x,4.55,4.16,w,7.9,.12,M.cab);bolts(body,x,4.6,4.24,w-.3,7.2);
  }
  for(const x of [-7.35,6.6]){box(body,x,10.7,-.2,2.25,4.4,8.9,M.cab);box(body,x,12.95,-.2,2.27,.14,8.9,M.inox);}
  // Open stainless tank, seal channels and sliding front gate.
  const tank=part('nadrz');
  box(tank,0,8.8,-.5,11.4,.35,8.2,M.inox);
  for(const x of [-5.7,5.7]){box(tank,x,10.7,-.6,.16,3.8,8.2,M.inox);box(tank,x,12.64,-.6,.3,.1,8.35,M.steel);}
  box(tank,0,10.7,-4.7,11.5,3.8,.16,M.inox);
  const gate=group('descending-loading-gate',tank);
  box(gate,0,0,0,11.4,3.7,.22,M.inox);box(gate,0,1.88,0,11.45,.1,.34,M.steel);
  box(gate,0,-1.8,.14,11.3,.12,.08,M.steelD);
  label(gate,'EX 500',-4.3,1.44,.13,2.2,.42,{color:'#d51e2c',background:'#b9bdc1',size:100});
  for(let i=0;i<6;i++){
    const x=1.25+i*.63;label(gate,i%2?'!':'⚠',x,1.44,.135,.57,.34,{color:'#20242a',background:'#eeeeea',size:90});
    box(gate,x,1.62,.14,.57,.045,.015,M.red);
  }
  for(const x of [-5.45,5.45]){box(tank,x,10.3,3.85,.19,4.8,.22,M.steelD);cyl(tank,x,9.8,3.65,.08,4.8,M.steel);bolts(gate,x,0,.14,.1,3.2);}
  const oil=new THREE.Mesh(new THREE.PlaneGeometry(11.05,7.9),M.oil);oil.rotation.x=-Math.PI/2;oil.position.z=-.6;oil.userData.excludeFromExport=true;oil.userData.excludeFromMachineExport=true;tank.add(oil);
  const table=part('stol');table.position.y=9;
  const slideY=group('fixed-table-support',table),slideX=group('fixed-850x450-table',slideY);
  box(slideY,0,-.45,0,10,.5,6.5,M.dark);box(slideX,0,-.1,0,8.5,.3,4.5,M.table);
  for(const z of [-1.5,-.5,.5,1.5])box(slideX,0,.055,z,8.3,.03,.065,M.steelD);
  for(const x of [-3.8,3.8])for(const z of [-1.9,1.9])cyl(slideX,x,.065,z,.045,.02,M.black);
  box(slideX,0,.3,0,1.4,.5,1.1,M.steelD);box(slideX,0,.45,0,1.3,.15,1,M.steel);
  for(const x of [-.8,.8]){box(slideX,x,.2,0,.2,.3,.7,M.dark);cyl(slideX,x,.38,0,.06,.12,M.steel);}
  const stockMount=group('stock-fixture',slideX);stockMount.position.y=.5;
  // Moving C column. The slim front tower is continuous to the black Z bellows.
  const axes=part('osi');
  profile(axes,'sloped-C-frame',[[ -11.5,8.8],[-11.5,19.1],[-3.0,24.2],[-3.0,15.0],[-.7,15.0],[-.7,12.7],[-6.6,12.7],[-6.6,8.8]],4.3,M.cab2);
  box(axes,0,21.5,-1.8,3.1,12.56,2.8,M.cab);
  named(box(axes,0,21.5,-.37,3.06,12.56,.1,M.inox),'continuous-front-column');
  for(const x of [-1.45,1.45]){box(axes,x,21.5,-.31,.035,12.5,.025,M.steelD);for(const y of [15.6,18.7,22,26.8])cyl(axes,x,y,-.27,.035,.035,M.steelD,'z');}
  const stripe=tex(512,640,(g,w,h)=>{
    g.fillStyle='#bcc0c3';g.fillRect(0,0,w,h);
    for(const [y,c] of [[60,'#f2e54f'],[185,'#f1f3f4'],[255,'#9da5ad'],[325,'#234a99'],[395,'#f0e44a']]){
      g.fillStyle=c;g.beginPath();g.moveTo(0,y);g.lineTo(w,y-110);g.lineTo(w,y+20);g.lineTo(0,y+130);g.fill();
    }
    g.save();g.translate(w/2,450);g.rotate(-.21);g.fillStyle='#151b25';g.font='bold 51px sans-serif';g.textAlign='center';g.fillText('OSCARMAX',0,0);g.restore();
  });
  const band=new THREE.Mesh(new THREE.PlaneGeometry(3.02,4.4),new THREE.MeshStandardMaterial({map:stripe.tx,roughness:.44}));band.position.set(0,25.54,-.306);band.name='EX-diagonal-brand-stripes';axes.add(band);
  box(axes,0,15.0,-.65,4.1,.95,3.8,M.cab);box(axes,0,14.48,-.65,3.75,.12,3.55,M.inox);
  for(const side of [-1,1])for(let i=0;i<18;i++)box(axes,side*3.7,13.65,-6+i*.13,3,.08,.085,i%2?M.black:M.dark);
  const ram=group('Z-servo-ram',axes);
  box(ram,0,2,0,1.8,3.5,1.8,M.steelD);cyl(ram,0,.65,0,.48,.9,M.steel);cyl(ram,0,.18,0,.36,.22,M.steelD);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(ram,Math.cos(a)*.4,.3,Math.sin(a)*.4,.035,.08,M.black);}
  const electrode=group('non-rotating-electrode',ram);
  const bellows=[];for(let i=0;i<24;i++){const o=box(axes,0,0,0,i%2?2.52:2.7,.15,i%2?2.28:2.5,i%2?M.black:M.dark);o.name=`Z-accordion-${i}`;bellows.push(o);}
  // Hoses follow the ram; fittings and nozzle ends stay beside the electrode.
  tube(ram,'left-flush-hose',[[-.85,2.1,-.2],[-1.15,.9,.1],[-1,.2,.6],[-.45,-.15,.3]],.055);
  tube(ram,'right-flush-hose',[[.85,2.1,-.2],[1.15,.9,.1],[1,.2,.6],[.45,-.15,.3]],.055);
  for(const s of [-1,1])rod(ram,[s*.45,-.15,.3],[s*.23,-.33,.13],.07,M.brass);
  tube(axes,'rear-cable-loop',[[1.9,15,-3],[2.9,18,-5],[2.9,24,-8],[2.4,23,-10]],.16);
  const safety=part('bezpecnost');axes.add(safety);
  cyl(safety,-1.95,17.1,-.6,.28,2.65,M.red);cyl(safety,-1.95,18.46,-.6,.14,.18,M.steelD);
  for(const y of [16.3,17.9]){cyl(safety,-1.95,y,-.6,.289,.13,M.steel);box(safety,-1.7,y,-.85,.6,.12,.12,M.steelD);}
  label(safety,'FIRE',-1.95,17.1,-.30,.4,.6,{color:'#d71924',background:'#f0f0eb',size:65});
  tube(safety,'extinguisher-delivery',[[-1.95,18.55,-.6],[-2.5,18.5,-.4],[-2.5,15.2,0],[-1.7,14.3,.2]],.055);
  cyl(safety,.9,15.8,-.25,.21,.1,M.yellow,'z');cyl(safety,.9,15.8,-.18,.16,.08,M.cab,'z');cyl(safety,.9,15.8,-.13,.08,.035,M.black,'z');
  box(tank,0,12.5,-4.52,4,.16,.18,M.cab);box(tank,0,12.4,-4.4,3.7,.06,.12,M.steel);
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
  label(rear,'OSCARMAX · EX 500',6.8,13.1,-1.04,3.2,.5,{color:'#252e35',background:'#c2c5c7',size:60});
  label(rear,'POWER  ·  60 A',6.8,11.7,-1.04,2.8,.65,{color:'#d9e5ef',background:'#263541',size:60});
  tube(rear,'dielectric-return',[[5.9,2,-2],[5.9,1,-.5],[3.5,1,1],[3.5,8,-3]],.13);
  // Mobile PC terminal with sloping base, caster wheels and folded keyboard tray.
  const panel=part('panel'),panelPivot=group('mobile-console',panel);panelPivot.position.set(9.5,0,10);
  profile(panelPivot,'sloping-console-foot',[[-2.4,.25],[2.4,.25],[2.4,.55],[1.8,.95],[-1.7,.95],[-2.4,.55]],5.2,M.cab2);
  for(const x of [-1.9,1.9])for(const z of [-1.7,1.7]){cyl(panelPivot,x,.2,z,.22,.2,M.black,'x');box(panelPivot,x,.44,z,.25,.22,.38,M.steelD);}
  box(panelPivot,0,4.9,-.4,1.7,8,1.5,M.cab);box(panelPivot,0,5,-1.18,1.45,7.4,.08,M.cab2);
  const deck=group('PC-keyboard-deck',panelPivot);deck.position.set(0,9.8,0);deck.rotation.x=.12;
  profile(deck,'folded-keyboard-tray',[[-1.3,-.25],[1.35,-.25],[1.35,.05],[1.13,.28],[-1.3,.28]],5.7,M.cab);
  box(deck,-.3,.3,0,4.25,.14,1.42,M.black);
  const keys=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,.045,.17),M.dark,80);let ki=0;
  for(let r=0;r<5;r++)for(let c=0;c<16;c++)keys.setMatrixAt(ki++,new THREE.Matrix4().makeTranslation(-2+c*.21,.4,-.6+r*.23));deck.add(keys);
  box(deck,-.4,.42,.53,1.55,.04,.16,M.steelD);box(deck,2,.32,.25,.35,.15,.55,M.black);
  const controls={buttons:{},knobs:{}};
  for(const [id,x,color] of [['start',.5,M.green],['hold',1.1,M.red],['reset',-.2,M.steelD],['light',-1,M.steel],['coolant',-1.7,M.blue]]){
    const g=group(id,deck);g.position.set(x,-.06,1.37);cyl(g,0,0,0,.13,.05,M.steelD,'z');controls.buttons[id]=cyl(g,0,0,.04,.09,.1,color,'z');
  }
  cyl(deck,2.45,.36,-.65,.19,.08,M.yellow);controls.buttons.emergency=cyl(deck,2.45,.49,-.65,.13,.19,M.red);
  tube(panelPivot,'push-handle',[[-1.6,9.4,.9],[-1.6,8.9,1.55],[-1.35,8.75,1.65],[1.35,8.75,1.65],[1.6,8.9,1.55],[1.6,9.4,.9]],.095,M.steel);
  const monitor=group('EX500-monitor',panelPivot);monitor.position.set(0,10.3,-.9);monitor.rotation.x=-.12;
  box(monitor,0,1.65,0,5.8,3.7,.3,M.black);box(monitor,0,1.65,.17,5.4,3.3,.04,M.steelD);box(monitor,0,1.6,-.35,1.4,1.5,.5,M.black);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(5.2,3.1),new THREE.MeshBasicMaterial({toneMapped:false}));display.position.set(0,1.65,.2);monitor.add(display);
  tube(panelPivot,'console-cable',[[0,9.8,-1.3],[0,8,-1.8],[.7,1,-1.4],[2,1,-2]],.07);
  const pendant=group('remote-pendant',panelPivot);pendant.position.set(-3,8.5,0);pendant.rotation.z=-.16;box(pendant,0,0,0,.7,1.45,.32,M.dark);box(pendant,0,.3,.17,.52,.53,.03,M.black);
  for(let i=0;i<6;i++)cyl(pendant,-.18+(i%2)*.36,-.12-Math.floor(i/2)*.2,.19,.065,.05,i===0?M.red:M.steel,'z');
  tube(panelPivot,'pendant-lead',[[-3,7.8,0],[-3,6.8,-.2],[-2.3,6.4,-.5],[-1,7.9,-1]],.045);
  const lamp=new THREE.PointLight(0xeaf5ff,80,12,2);lamp.position.set(0,13,1);root.add(lamp);
  return {gate,oil,slideX,slideY,ram,electrode,stockMount,panelPivot,display,controls,lamp,
    buildElectrode(e){clear(electrode);if(e.shape==='round')cyl(electrode,0,-e.length*.005,0,e.w*.005,e.length*.01,M.copper);else box(electrode,0,-e.length*.005,0,e.w*.01,e.length*.01,e.d*.01,M.copper);},
    update({S,oilLevel,door,light,hmiAngle}){
      gate.position.set(0,10.7-door*3.4,3.65);oil.position.y=9+oilLevel*.01;oil.visible=oilLevel>2;
      axes.position.x=S.x*.01;axes.position.z=-S.y*.01;
      const len=electrode.userData.length||100;ram.position.set(0,9+(80-S.depth+len)*.01,0);
      const bottom=ram.position.y+.9,h=Math.max(.2,15.5-bottom);bellows.forEach((o,i)=>{o.position.y=bottom+(i+.5)/bellows.length*h;o.scale.y=h/bellows.length/.15;});
      lamp.visible=light;panelPivot.rotation.y=hmiAngle*Math.PI/180;
    },
  };
}
