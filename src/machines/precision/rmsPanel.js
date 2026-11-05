import * as THREE from 'three';
import { modelKit } from './modelKit';
// Compact red RMS terminal in the supplied RXU photograph. It has a PC keyboard
// and a machine-button strip, distinct from the Hermle TNC console.
export function createRmsPanel(parent,M,tex){
  const {box,cyl,rod,group,label}=modelKit(parent,M,tex),controls={buttons:{},knobs:{}};
  box(parent,0,13,0,6.1,4.9,.55,M.red);box(parent,0,13.25,.3,5.7,3.9,.06,M.black);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(5.2,3.45),new THREE.MeshBasicMaterial({toneMapped:false}));display.position.set(0,13.25,.345);parent.add(display);
  box(parent,0,10.2,.55,6.3,.65,2.5,M.red);box(parent,0,10.55,.5,5.8,.06,2.1,M.steelD);
  for(let r=0;r<4;r++)for(let c=0;c<14;c++)box(parent,-2.5+c*.34,10.63,-.18+r*.32,.27,.09,.25,M.cab2);
  for(const [id,x,material] of [['reset',-2.6,M.steelD],['light',-1.95,M.yellow],['single',-1.3,M.steelD],['coolant',-.65,M.steelD],['hold',1.25,M.red],['start',1.9,M.cab2]]){
    controls.buttons[id]=cyl(parent,x,10.15,1.86,.14,.09,material,'z');
  }
  cyl(parent,2.65,10.57,1.1,.21,.08,M.yellow);controls.buttons.emergency=cyl(parent,2.65,10.71,1.1,.15,.2,M.red);
  for(const [id,x] of [['feed',.2],['rapid',.75]]){const knob=group(id,parent);knob.position.set(x,10.15,1.88);cyl(knob,0,0,0,.16,.13,M.black,'z');box(knob,0,.07,.08,.025,.12,.025,M.cab);controls.knobs[id]=knob;}
  for(const s of [-1,1])rod(parent,[s*3.2,9.9,1.8],[s*3.2,15.5,.1],.08,M.steelD);
  label(parent,'RÖDERS · RMS',0,10.95,.32,2.4,.25,{color:'#eee',background:'#a51536',size:60});
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(1.5,9.9,0),new THREE.Vector3(2,7.6,-.8),new THREE.Vector3(.5,7,-.5),new THREE.Vector3(0,9,0)]);parent.add(new THREE.Mesh(new THREE.TubeGeometry(cable,24,.055,8,false),M.black));
  return {display,controls,knobAxis:'z',pressAxis:id=>id==='emergency'?'y':'z'};
}
