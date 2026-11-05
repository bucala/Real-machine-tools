import * as THREE from 'three';
import { modelKit } from './modelKit';
// Supplied close-up: silver square monitor in a red case, controls ABOVE the
// black keyboard, mouse to the right, separate pendant clipped beside the display.
export function createRmsPanel(parent,M,tex){
  const {box,cyl,rod,group}=modelKit(parent,M,tex),controls={buttons:{},knobs:{},duplicates:{}};
  box(parent,0,13.4,0,6.6,5.2,.65,M.red);
  box(parent,-.35,13.55,.35,5.65,4.65,.12,M.cab2);
  box(parent,-.35,13.55,.42,4.75,3.75,.04,M.black);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(4.48,3.48),new THREE.MeshBasicMaterial({toneMapped:false}));display.position.set(-.35,13.55,.45);parent.add(display);
  for(let i=0;i<5;i++)cyl(parent,1.18+i*.15,11.46,.43,.045,.04,M.steelD,'z');
  const deck=group('RMS-keyboard-shelf',parent);deck.position.set(0,10.87,.36);deck.rotation.x=.19;
  box(deck,0,0,1.7,7.3,.32,4.8,M.red);
  box(deck,-.45,.2,2.15,5.7,.16,2.35,M.black);
  // Draw a readable PC keyboard as a single texture over the raised key field.
  const keys=tex(1024,420,(g,W,H)=>{
    g.fillStyle='#272b2e';g.fillRect(0,0,W,H);g.font='19px sans-serif';g.textAlign='center';g.textBaseline='middle';
    ['ESC F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12','1 2 3 4 5 6 7 8 9 0 - = DEL','Q W E R T Y U I O P [ ]','A S D F G H J K L ; ENTER','Z X C V B N M , . / SHIFT','CTRL ALT SPACE ALT CTRL ← ↓ →'].forEach((row,r)=>{
      const names=row.split(' '),w=(W-24)/names.length;
      names.forEach((name,i)=>{const x=12+i*w,y=8+r*67;g.fillStyle='#484d50';g.fillRect(x,y,w-5,59);g.fillStyle='#202426';g.fillRect(x+2,y+2,w-9,53);g.fillStyle='#ccd0d2';g.fillText(name,x+(w-5)/2,y+29);});
    });
  });
  const keyFace=new THREE.Mesh(new THREE.PlaneGeometry(5.5,2.21),new THREE.MeshStandardMaterial({map:keys.tx,roughness:.85}));keyFace.rotation.x=-Math.PI/2;keyFace.position.set(-.45,.295,2.15);deck.add(keyFace);
  box(deck,2.86,.19,.94,1.05,.05,1.3,M.steelD);
  const mouse=new THREE.Mesh(new THREE.SphereGeometry(.37,18,12),M.black);mouse.scale.set(1,.38,1.45);mouse.position.set(2.86,.29,.92);deck.add(mouse);
  rod(deck,[2.86,.43,.65],[2.86,.43,1.03],.013,M.steelD);
  const wire=new THREE.CatmullRomCurve3([new THREE.Vector3(2.86,.24,.4),new THREE.Vector3(3.03,.22,-.3),new THREE.Vector3(2.5,.25,-.48)]);deck.add(new THREE.Mesh(new THREE.TubeGeometry(wire,16,.023,6,false),M.black));
  // Physical controls on the upper deck are reachable and depress along its normal.
  const button=(id,x,z,material,r=.15)=>{cyl(deck,x,.23,z,r+.045,.08,M.steelD);const b=cyl(deck,x,.32,z,r,.12,material);controls.buttons[id]=b;return b;};
  cyl(deck,.5,.26,-.04,.31,.12,M.yellow);controls.buttons.emergency=cyl(deck,.5,.43,-.04,.21,.22,M.red);
  button('hold',1.08,-.14,M.red);button('start',1.17,.42,M.cab2);
  button('light',-.15,.45,M.yellow);button('single',1.8,.42,M.steelD);button('coolant',1.8,-.14,M.steelD);button('reset',-.15,-.15,M.steelD);
  for(const [id,x] of [['feed',-2.15],['rapid',-1.25]]){
    cyl(deck,x,.26,.24,.27,.13,M.steelD);const knob=group(id,deck);knob.position.set(x,.37,.24);
    cyl(knob,0,.13,0,.13,.32,M.black);box(knob,0,.34,0,.22,.12,.18,M.black);box(knob,0,.406,0,.12,.01,.025,M.cab2);controls.knobs[id]=knob;
  }
  // Removable handwheel pendant on a black bracket beside the monitor.
  const remote=group('RMS-handwheel-pendant',parent);remote.position.set(3.23,13.4,.58);
  box(remote,0,0,0,1.02,3.6,.35,M.black);box(remote,0,.05,.2,.79,3.35,.11,M.cab2);
  cyl(remote,0,1.38,.3,.29,.09,M.yellow,'z');const remoteStop=cyl(remote,0,1.38,.42,.19,.18,M.red,'z');
  controls.duplicates.emergency=[{object:remoteStop,axis:'z'}];
  for(const [x,id,material] of [[-.18,'start',M.cab2],[.18,'hold',M.red]]){
    box(remote,x,-.2,.29,.23,.23,.08,M.steelD);const b=box(remote,x,-.2,.35,.16,.16,.06,material);controls.duplicates[id]=[{object:b,axis:'z'}];
  }
  for(const y of [.64,-.55])for(const x of [-.2,.2])cyl(remote,x,y,.33,.105,.1,M.steelD,'z');
  cyl(remote,0,-1.05,.32,.29,.14,M.black,'z');cyl(remote,.12,-1.1,.46,.065,.13,M.black,'z');
  // White shelf/metal bracket attach to the articulated arm, with cable below.
  box(parent,0,10.1,1.4,7.0,.3,3.7,M.cab2);box(parent,0,9.9,.45,4.4,.25,1.5,M.steelD);
  const paper=box(parent,-.7,17.35,-.4,3.5,2.4,.07,M.cab2);paper.rotation.x=-.35;
  rod(parent,[1,10,-.4],[1,16.3,-.4],.07,M.steelD);
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(3.23,11.6,.5),new THREE.Vector3(3.6,7,.2),new THREE.Vector3(.6,5.8,.1),new THREE.Vector3(-1.2,7,.3),new THREE.Vector3(-1.5,10,.3)]);parent.add(new THREE.Mesh(new THREE.TubeGeometry(cable,36,.055,8,false),M.black));
  return {display,controls,knobAxis:'y',pressAxis:()=> 'y'};
}
