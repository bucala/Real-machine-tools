import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { createRoedersModel } from '../src/machines/precision/roedersModel';
import { createOscarModel } from '../src/machines/precision/oscarModel';
import { RXU } from '../src/machines/precision/profiles';
const setup=()=>{
  const root=new THREE.Group(),G={},tex=()=>({tx:new THREE.Texture(),redraw(){}});
  const M=Object.fromEntries(['cab','cab2','dark','anth','steel','steelD','inox','table','red','black','glass','tool','coat','holder','flute','blue','yellow','green','brass','copper','oil'].map(k=>[k,new THREE.MeshStandardMaterial({transparent:k==='glass',opacity:k==='glass'?.16:1})]));
  return {root,G,M,tex,MC:RXU,PY:14};
};
describe('Manufacturer-specific machine geometry',()=>{
  it('leaves the RXU left window open to the work area and places RMS behind the loading face',()=>{
    const ctx=setup(),m=createRoedersModel(ctx);m.updateGeometry({doorK:0,panelA:0,panelYaw:0});ctx.root.updateMatrixWorld(true);
    expect(ctx.root.getObjectByName('left-observation-window')).toBeTruthy();
    const ray=new THREE.Raycaster(new THREE.Vector3(-20,17.2,2.5),new THREE.Vector3(1,0,0));
    const hits=ray.intersectObjects(ctx.G.kabina.children,true).filter(h=>!h.object.material.transparent);
    expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.x).toBeGreaterThan(-6);
    const terminal=m.panG.getWorldPosition(new THREE.Vector3());expect(terminal.x).toBeLessThan(-12);expect(terminal.z).toBeLessThan(-7);
  });
  it('swings the RXU loading door out on its right hinge and keeps HMI outside on rotation',()=>{
    const ctx=setup(),m=createRoedersModel(ctx);m.updateGeometry({doorK:0,panelA:0,panelYaw:0});ctx.root.updateMatrixWorld(true);
    const hinge=m.doors[0].position.clone(),left=new THREE.Vector3(-10.8,10,0);m.doors[0].localToWorld(left);expect(left.x).toBeLessThan(hinge.x);
    m.updateGeometry({doorK:1,panelA:Math.PI,panelYaw:0});ctx.root.updateMatrixWorld(true);
    const opened=m.doors[0].localToWorld(new THREE.Vector3(-10.8,10,0));expect(opened.x).toBeGreaterThan(hinge.x);expect(opened.z).toBeGreaterThan(hinge.z+8);
    expect(m.panG.getWorldPosition(new THREE.Vector3()).x).toBeLessThan(-12);
  });
  it('moves the EX500 column, keeps the table fixed, and lowers the gate to load',()=>{
    const ctx=setup(),m=createOscarModel(ctx);m.buildElectrode({shape:'box',w:20,d:15,length:100});m.electrode.userData.length=100;
    m.update({S:{x:100,y:-50,depth:5},oilLevel:130,door:0,light:true,hmiAngle:30});
    expect(ctx.G.osi.position.x).toBe(1);expect(ctx.G.osi.position.z).toBe(.5);expect(m.slideX.position.x).toBe(0);expect(m.slideY.position.z).toBe(0);
    const closed=m.gate.position.y;m.update({S:{x:0,y:0,depth:-5},oilLevel:0,door:1,light:false,hmiAngle:0});expect(m.gate.position.y).toBeLessThan(closed-3);expect(m.oil.visible).toBe(false);expect(m.lamp.visible).toBe(false);
    // 850 × 450 mm table has exact geometry, independently of exterior reconstruction.
    expect(m.slideX.children.some(o=>o.geometry?.parameters.width===8.5&&o.geometry.parameters.depth===4.5)).toBe(true);
  });
});
