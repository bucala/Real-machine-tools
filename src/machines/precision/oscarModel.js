import * as THREE from 'three';
import { modelKit } from './modelKit';

// EX500 photographs and technical table supplied by the user. Sheet-metal contours
// are reconstructed from those views; only the documented table/axis sizes are exact.
export function createOscarModel({root,G,M,tex}){
  const {group,box,cyl,rod,label,bolts,clear}=modelKit(root,M,tex);
  const part=k=>{const g=group(k);g.userData.part=k;G[k]=g;return g;};
  const body=part('lozko');
  box(body,0,.35,-2,18.2,.7,18.2,M.dark);
  box(body,-.7,4.5,-1.5,15.4,8.2,16.5,M.cab);
  box(body,6.2,6.9,-4.2,4.6,13,12.5,M.cab2);
  for(const x of [-7.5,7.5])for(const z of [-9,5])cyl(body,x,.15,z,.5,.3,M.steelD);
  for(const x of [-5.6,0,5.6])for(const y of [1.2,7.5])bolts(body,x,y,6.85,.2,.2);
  // Front dielectric tank: stainless liner and descending loading gate.
  const tank=part('nadrz');
  box(tank,0,8.8,-.5,11.4,.35,8.2,M.inox);
  for(const x of [-5.7,5.7])box(tank,x,10.7,-.6,.2,3.8,8.2,M.inox);
  box(tank,0,10.7,-4.7,11.5,3.8,.2,M.inox);
  const gate=group('descending-loading-gate',tank);
  box(gate,0,0,0,11.4,3.7,.2,M.inox);
  rod(gate,[-2.3,.75,.2],[2.3,.75,.2],.075,M.steelD);
  for(const x of [-2.3,2.3])rod(gate,[x,.75,0],[x,.75,.25],.06,M.steelD);
  label(gate,'EX 500',-4.4,1.2,.13,1.8,.4,{color:'#d21b25',background:'#bec3c7',size:72});
  label(gate,'⚠  EDM · DIELECTRIC',2.5,1.3,.14,3,.35,{color:'#161b20',background:'#d4d7d8'});
  for(const x of [-5.4,5.4]){box(tank,x,10.8,3.8,.25,4.5,.3,M.steelD);for(let i=0;i<7;i++)box(tank,x,9.2+i*.4,4,.35,.12,.12,M.inox);}
  // Fluid is separate from the workpiece and excluded from exports.
  const oil=new THREE.Mesh(new THREE.PlaneGeometry(11.05,7.9),M.oil);oil.rotation.x=-Math.PI/2;oil.position.z=-.6;oil.userData.excludeFromExport=true;tank.add(oil);
  const table=part('stol');table.position.y=9;
  const slideY=group('Y-slide',table),slideX=group('X-slide',slideY);
  box(slideY,0,-.45,0,10,.5,6.5,M.dark);box(slideX,0,-.1,0,8.5,.3,4.5,M.table);
  for(const z of [-1.5,-.5,.5,1.5])box(slideX,0,.055,z,8.3,.03,.06,M.steelD);
  box(slideX,0,.3,0,1.4,.5,1.1,M.steelD);box(slideX,0,.45,0,1.3,.15,1,M.steel);
  for(const x of [-.8,.8])box(slideX,x,.2,0,.2,.3,.7,M.dark);
  const stockMount=group('stock-fixture',slideX);stockMount.position.y=.5;
  const axes=part('osi');
  box(axes,0,13.5,-7.2,5.8,24.5,5.8,M.cab2);
  box(axes,0,22,-4,4.8,9,1.8,M.inox);
  for(const x of [-1.7,1.7])box(axes,x,20,-3.1,.2,14,.22,M.steel);
  // Fixed front fascia and telescoping ram/guide bellows.
  box(axes,0,24.25,-2.5,3.4,7.06,1.2,M.cab);
  const stripe=tex(256,512,(g,w,h)=>{g.fillStyle='#b9bec4';g.fillRect(0,0,w,h);for(const [y,c] of [[20,'#eee44e'],[95,'#edf0f2'],[150,'#aeb4bb'],[205,'#244e96'],[260,'#eee44e']]){g.fillStyle=c;g.beginPath();g.moveTo(0,y);g.lineTo(w,y-45);g.lineTo(w,y+35);g.lineTo(0,y+80);g.fill();}g.save();g.translate(w/2,300);g.rotate(-.17);g.fillStyle='#101820';g.font='bold 27px sans-serif';g.textAlign='center';g.fillText('OSCARMAX',0,0);g.restore();});
  const band=new THREE.Mesh(new THREE.PlaneGeometry(3.25,5.2),new THREE.MeshStandardMaterial({map:stripe.tx,roughness:.5}));band.position.set(0,25.1,-1.87);axes.add(band);
  const ram=group('Z-servo-ram',axes);
  box(ram,0,2.1,0,2.7,3.5,2.5,M.cab2);
  cyl(ram,0,.5,0,.42,1);cyl(ram,0,.1,0,.3,.2,M.steelD);
  const electrode=group('non-rotating-electrode',ram);
  const bellows=[];for(let i=0;i<18;i++)bellows.push(box(axes,0,0,-1.2,2.5,.15,2.8,i%2?M.black:M.dark));
  const hose=new THREE.CatmullRomCurve3([new THREE.Vector3(1.2,14,-2),new THREE.Vector3(2,12.8,-.2),new THREE.Vector3(.8,12,.5)]);
  axes.add(new THREE.Mesh(new THREE.TubeGeometry(hose,20,.075,8,false),M.black));
  // Fire extinguisher, UV sensor and dielectric flush nozzles from EX brochure.
  const safety=part('bezpecnost');axes.add(safety);
  cyl(safety,-2.8,17,-3.8,.3,2.8,M.red);cyl(safety,-2.8,18.45,-3.8,.18,.2,M.steelD);
  label(safety,'FIRE',-2.8,17,-3.48,.4,.8,{color:'#fff',background:'#bc1925',size:65});
  cyl(safety,1.2,18,-1.77,.22,.1,M.cab,'z');cyl(safety,1.2,18,-1.7,.1,.05,M.black,'z');
  for(const x of [-1,1]){rod(safety,[x,11.8,-1.7],[x*.5,10.7,.2],.07,M.black);cyl(safety,x*.5,10.7,.2,.08,.2,M.brass);}
  const rear=part('generator');
  for(const x of [6.4,8.55]){
    const isSide=x>8;box(rear,isSide?x:6.4,6.9,isSide?-4:-10.65,isSide?.12:3.9,12.8,isSide?12.8:.12,M.cab2);
    for(const z of [-8,-2]){box(rear,8.65,8,z,.12,1,.12,M.black);box(rear,8.65,4,z,.12,.4,.2,M.steelD);}
  }
  for(let row=0;row<3;row++)for(let i=0;i<12;i++)box(rear,8.65,1.7+row*.7+i*.035,-6.7,.08,.025,2.7,M.dark);
  for(const x of [4.7,7.7])for(const z of [-9,-.2]){cyl(rear,x,13.65,z,.16,.25,M.steelD);}
  cyl(rear,6,14.4,-6,.12,1.4,M.steel);cyl(rear,6,15.1,-6,.2,.12,M.steelD);
  const panel=part('panel');
  const panelPivot=group('mobile-console',panel);panelPivot.position.set(9.5,0,10);
  box(panelPivot,0,.3,0,5,.6,4.7,M.cab2);box(panelPivot,0,4.3,-.3,1.5,7.5,1.3,M.cab);
  const deck=group('PC-keyboard-deck',panelPivot);deck.position.set(0,9.8,0);deck.rotation.x=.12;
  box(deck,0,0,0,5.7,.5,2.4,M.cab);
  box(deck,-.35,.3,-.1,4.3,.15,1.4,M.black);
  const keys=new THREE.InstancedMesh(new THREE.BoxGeometry(.17,.04,.17),M.dark,80);let ki=0;
  for(let r=0;r<5;r++)for(let c=0;c<16;c++)keys.setMatrixAt(ki++,new THREE.Matrix4().makeTranslation(-2+c*.21,.4,-.6+r*.22));deck.add(keys);
  const controls={buttons:{},knobs:{}};
  for(const [id,x,y,color] of [['start',.5,0,M.green],['hold',1.1,0,M.red],['reset',-.2,0,M.steelD],['light',-1,0,M.steel],['coolant',-1.7,0,M.blue]]){
    const g=group(id,deck);g.position.set(x,-.06,1.23);const o=cyl(g,0,y,0,.1,.1,color,'z');controls.buttons[id]=o;
  }
  cyl(deck,2.45,.31,-.65,.18,.08,M.yellow);controls.buttons.emergency=cyl(deck,2.45,.45,-.65,.12,.2,M.red);
  rod(panelPivot,[-1.5,9,1.4],[1.5,9,1.4],.09);for(const x of [-1.5,1.5])rod(panelPivot,[x,9,1.4],[x,9.5,.7],.08);
  const monitor=group('EX500-monitor',panelPivot);monitor.position.set(0,10.3,-.9);monitor.rotation.x=-.12;
  box(monitor,0,1.65,0,5.8,3.7,.3,M.black);box(monitor,0,1.65,.17,5.4,3.3,.04,M.steelD);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(5.2,3.1),new THREE.MeshBasicMaterial({toneMapped:false}));display.position.set(0,1.65,.2);monitor.add(display);
  const lamp=new THREE.PointLight(0xeaf5ff,80,12,2);lamp.position.set(0,15,1);root.add(lamp);
  return {gate,oil,slideX,slideY,ram,electrode,stockMount,panelPivot,display,controls,lamp,
    buildElectrode(e){clear(electrode);if(e.shape==='round')cyl(electrode,0,-e.length*.005,0,e.w*.005,e.length*.01,M.copper);else box(electrode,0,-e.length*.005,0,e.w*.01,e.length*.01,e.d*.01,M.copper);},
    update({S,oilLevel,door,light,hmiAngle}){
      gate.position.set(0,10.7-door*3.4,3.65);oil.position.y=9+oilLevel*.01;oil.visible=oilLevel>2;
      // EX500 is column-moving (catalogue p11); the table and workpiece stay fixed.
      axes.position.x=S.x*.01;axes.position.z=-S.y*.01;
      const len=electrode.userData.length||100;ram.position.set(0,9+(80-S.depth+len)*.01,0);
      const bottom=ram.position.y+3.8,top=21.4,h=Math.max(.2,top-bottom);bellows.forEach((o,i)=>{o.position.y=bottom+(i+.5)/18*h;o.scale.y=h/18/.15;});
      lamp.visible=light;panelPivot.rotation.y=hmiAngle*Math.PI/180;
    },
  };
}
