import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { createRoedersModel } from '../src/machines/precision/roedersModel';
import { createOscarModel } from '../src/machines/precision/oscarModel';
import { RXU } from '../src/machines/precision/profiles';
import { RXU_LAYOUT } from '../src/machines/precision/roedersLayout';
const setup=()=>{
  const root=new THREE.Group(),G={},tex=()=>({tx:new THREE.Texture(),redraw(){}});
  const M=Object.fromEntries(['cab','cab2','dark','anth','steel','steelD','inox','table','red','black','glass','tool','coat','holder','flute','blue','yellow','green','brass','copper','oil'].map(k=>[k,new THREE.MeshStandardMaterial({transparent:k==='glass',opacity:k==='glass'?.16:1})]));
  return {root,G,M,tex,MC:RXU,PY:14};
};
describe('Manufacturer-specific machine geometry',()=>{
  it('keeps the RXU side window open to the table and puts RMS beside the left shoulder',()=>{
    const ctx=setup(),m=createRoedersModel(ctx);m.updateGeometry({doorK:0,panelA:0,panelYaw:0});ctx.root.updateMatrixWorld(true);
    expect(ctx.root.getObjectByName('left-observation-window')).toBeTruthy();
    const ray=new THREE.Raycaster(new THREE.Vector3(-24,17.2,5.4),new THREE.Vector3(1,0,0));
    const hits=ray.intersectObjects(ctx.G.kabina.children,true).filter(h=>!h.object.material.transparent);
    expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.x).toBeGreaterThan(-7);
    const terminal=m.panG.getWorldPosition(new THREE.Vector3());
    expect(terminal.x).toBeLessThan(-19);expect(terminal.z).toBeLessThan(-5);
    // Unlike the old floating post, the arm actually starts at the left chassis.
    expect(m.armPivot.position.x).toBeCloseTo(RXU_LAYOUT.shoulderLeft-.15);
  });
  it('slides the entire RXU door right, parallel to its rail, and clears the loading aperture',()=>{
    const ctx=setup(),m=createRoedersModel(ctx);m.updateGeometry({doorK:0,panelA:0,panelYaw:0});ctx.root.updateMatrixWorld(true);
    const before=new THREE.Box3().setFromObject(m.doors[0]),q=m.doors[0].quaternion.clone();
    m.updateGeometry({doorK:1,panelA:0,panelYaw:0});ctx.root.updateMatrixWorld(true);
    const after=new THREE.Box3().setFromObject(m.doors[0]);
    expect(after.min.x).toBeGreaterThan(3.2);expect(after.min.x-before.min.x).toBeCloseTo(11.8);
    expect(after.min.z).toBeCloseTo(before.min.z);expect(after.max.z).toBeCloseTo(before.max.z);
    expect(after.min.y).toBeCloseTo(before.min.y);expect(m.doors[0].quaternion.equals(q)).toBe(true);
    expect(ctx.root.getObjectByName('right-hinged-loading-door')).toBeUndefined();
  });
  it('retains the stepped p57 footprint and leaves the rear service recess empty',()=>{
    const ctx=setup();createRoedersModel(ctx);ctx.root.updateMatrixWorld(true);
    // A solid rectangular rear block was the original layout error. Neither its
    // cabinet nor plinth may span the maintenance recess between the two wings.
    const vertical=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,50,z),new THREE.Vector3(0,-1,0)).intersectObjects([ctx.G.kabina,ctx.root.getObjectByName('stepped-burgundy-plinth')],true);
    expect(vertical(-4,-28)).toHaveLength(0);
    expect(vertical(7,-28).length).toBeGreaterThan(0);
    expect(vertical(-4,-35).length).toBeGreaterThan(0);
    expect(vertical(-14,5)).toHaveLength(0);
    expect(vertical(-14,-10).length).toBeGreaterThan(0);
  });
  it('offsets the complete machining frame into the loading bay without separating tool and stock',()=>{
    const ctx=setup(),m=createRoedersModel(ctx);ctx.root.updateMatrixWorld(true);
    const o=m.machinePoint([0,14,0]),x=m.machinePoint([1,14,0]).sub(o),y=m.machinePoint([0,14,-1]).sub(o);
    expect(x.x).toBeCloseTo(1);expect(x.z).toBeCloseTo(0);expect(y.z).toBeCloseTo(-1);
    expect(o.x).toBeCloseTo(-2.6);expect(o.z).toBeCloseTo(3.2);
    expect(m.cG.parent).toBe(m.aG);expect(m.aG.parent.parent).toBe(m.machiningFrame);
    expect(m.yG.parent.parent).toBe(m.machiningFrame);
    m.xG.position.x=4;m.yG.position.z=-4.05;m.zG.position.y=19.76;ctx.root.updateMatrixWorld(true);
    const ram=new THREE.Box3().setFromObject(m.zG);
    expect(ram.max.y).toBeLessThan(27.64);expect(ram.min.x).toBeGreaterThan(-10.9);
  });
  it('keeps the full RMS console outside the chassis throughout its arm sweep',()=>{
    const ctx=setup(),m=createRoedersModel(ctx);
    for(const a of [0,Math.PI/2,Math.PI])for(const yaw of [-Math.PI/2,0,Math.PI/2]){
      m.updateGeometry({doorK:0,panelA:a,panelYaw:yaw});ctx.root.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(m.panG).max.x).toBeLessThan(RXU_LAYOUT.shoulderLeft);
    }
  });
  it('includes an open KNOLL hopper over the cart at load and moves its belt during operation',()=>{
    const ctx=setup(),m=createRoedersModel(ctx),conveyor=m.accessories.equipment.conveyor;
    expect(conveyor.visible).toBe(true);
    const c={accessorySetup:'none',running:false};m.accessories.update(c,.2);ctx.root.updateMatrixWorld(true);
    expect(m.accessories.equipment.cooling.parent.visible).toBe(false);
    const mouth=ctx.root.getObjectByName('hopper-open-mouth').getWorldPosition(new THREE.Vector3());
    expect(mouth.x).toBeGreaterThan(-29.7);expect(mouth.x).toBeLessThan(-20.2);
    expect(mouth.z).toBeGreaterThan(-28);expect(mouth.z).toBeLessThan(-12.3);
    expect(mouth.y).toBeGreaterThan(9.1);expect(mouth.y).toBeLessThan(12);
    const ray=new THREE.Raycaster(mouth.clone().add(new THREE.Vector3(0,-.05,0)),new THREE.Vector3(0,1,0));
    const hits=ray.intersectObjects(ctx.root.getObjectByName('KNOLL-open-discharge-hopper').children,true);
    expect(hits.length).toBeGreaterThan(0);expect(hits[0].distance).toBeGreaterThan(3); // no cap blocking the outlet
    const flight=ctx.root.getObjectByName('inclined-chip-belt').children[1],before=flight.position.clone();
    m.accessories.update(c,1);expect(flight.position.equals(before)).toBe(true);
    m.accessories.update({...c,running:true},1);expect(flight.position.distanceTo(before)).toBeGreaterThan(.5);
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
