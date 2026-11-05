import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { createHermleModel,HERMLE_ENVELOPES } from '../src/machines/cnc/hermleModel';
import { MODELS } from '../src/machines/cnc/kin';
import { cabinHalfWidth } from '../src/machines/cnc/hermleLayout';
const setup=id=>{
  const root=new THREE.Group(),G={},tex=()=>({tx:new THREE.Texture(),redraw(){}}),MC=MODELS[id];
  const M=Object.fromEntries(['cab','cab2','dark','anth','steel','steelD','inox','table','red','black','glass','tool','coat','holder','flute'].map(k=>[k,new THREE.MeshStandardMaterial({transparent:k==='glass',opacity:k==='glass'?.16:1})]));
  const ctx={root,G,M,tex,MC,PY:9.5+MC.hA*.01};return {...ctx,model:createHermleModel(ctx)};
};
describe.each(['c32','c42'])('Hermle %s catalogue geometry',id=>{
  it('preserves catalogue table size and 950 mm loading height independently of cabinet scaling',()=>{
    const {root,model:m,MC}=setup(id),P=HERMLE_ENVELOPES[id];root.updateMatrixWorld(true);
    const plate=root.getObjectByName('parallel-slot-clamping-table'),bounds=new THREE.Box3().setFromObject(plate),size=bounds.getSize(new THREE.Vector3());
    expect(size.x*100).toBeCloseTo(MC.table,3);expect(size.z*100).toBeCloseTo(P.tableDepth*100,3);
    expect(bounds.max.y*100).toBeCloseTo(950);expect(plate.geometry.parameters.shapes.holes).toHaveLength(P.slots);
    expect(m.cG.parent).toBe(m.aG);expect(cabinHalfWidth(MC)*2).toBe(P.width);
    m.aG.rotation.x=.6;m.cG.rotation.y=.4;root.updateMatrixWorld(true);
    expect(plate.getWorldPosition(new THREE.Vector3()).z).not.toBeCloseTo(0);
  });
  it('opens a clear catalogue-width entrance using two translating leaves with attached handles',()=>{
    const {root,model:m}=setup(id),P=HERMLE_ENVELOPES[id];
    m.updateGeometry({doorK:0});root.updateMatrixWorld(true);
    const initial=m.doors.map(d=>d.position.clone());
    const ray=new THREE.Raycaster(new THREE.Vector3(.01,22,20),new THREE.Vector3(0,0,-1));
    expect(ray.intersectObjects(m.doors,true).length).toBeGreaterThan(0);
    m.updateGeometry({doorK:1});root.updateMatrixWorld(true);
    expect(ray.intersectObjects(m.doors,true)).toHaveLength(0);
    m.doors.forEach((d,i)=>{expect(d.position.distanceTo(initial[i])).toBeCloseTo(P.opening/2);expect(d.rotation.toArray().slice(0,3)).toEqual([0,0,0]);});
    const left=new THREE.Box3().setFromObject(m.doors[0]),right=new THREE.Box3().setFromObject(m.doors[1]);
    // Rubber lips overlap the aperture by 2.5 mm, the metal leaves don't.
    expect(right.min.x-left.max.x).toBeCloseTo(P.opening-.05,3);
  });
  it('keeps the pick-up point aligned to CNC coordinates, uses an outboard drive and contains the bridge in the bed',()=>{
    const {root,model:m,MC}=setup(id);root.updateMatrixWorld(true);
    expect(m.pockets).toHaveLength(MC.mag);
    const pick=m.pockets[0].getWorldPosition(new THREE.Vector3());
    expect(pick.x).toBeCloseTo(0);expect(pick.z).toBeCloseTo(-MC.tcY*.01);
    expect(root.getObjectByName('carousel-side-drive-cover')).toBeTruthy();
    expect(m.driveShaft.getWorldPosition(new THREE.Vector3()).x).toBeLessThan(-3.8*MC.K);
    const bridge=new THREE.Box3().setFromObject(m.saddle);
    expect(bridge.min.z).toBeGreaterThan(-12.3*MC.K);expect(bridge.max.y).toBeLessThan(HERMLE_ENVELOPES[id].roof);
    expect(root.getObjectByName('magazine-support-drum')).toBeTruthy();
  });
  it('leaves the A flanges exposed and uses narrow rising arms rather than full-depth ears',()=>{
    const {root,MC,PY}=setup(id);root.updateMatrixWorld(true);const cradle=root.getObjectByName('cast-A-cradle');
    const outerX=6.4*MC.K-.5;
    const outside=new THREE.Raycaster(new THREE.Vector3(outerX,PY+5,2),new THREE.Vector3(0,-1,0));
    expect(outside.intersectObject(cradle)).toHaveLength(0);
    const front=new THREE.Raycaster(new THREE.Vector3(0,PY-MC.hA*.01-1.3,10),new THREE.Vector3(0,0,-1));
    const hits=front.intersectObject(cradle);expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.z).toBeGreaterThan(2);expect(hits[0].face.normal.z).toBeGreaterThan(.8);
  });
  it('keeps short trapezoidal bellows attached to the X slide across its full stroke',()=>{
    const {root,model:m,MC}=setup(id),left=root.getObjectByName('left-trapezoid-bellows');
    for(const x of [MC.X[0]*.01,0,MC.X[1]*.01]){
      m.xG.position.x=x;m.updateAxes();root.updateMatrixWorld(true);const p=left.geometry.attributes.position;
      expect(p.getY(1)-p.getY(0)).toBeCloseTo(5.89,3);
      expect(p.getX(0)).toBeGreaterThan(p.getX(1));
      const edge=new THREE.Vector3().fromBufferAttribute(p,p.count-1);left.localToWorld(edge);
      expect(edge.x).toBeCloseTo(x-1.32*MC.K,4);
      expect(left.geometry.boundingSphere.radius).toBeGreaterThan(0);
    }
  });
  it('keeps the physical TNC panel the same size and all manual controls attached during the arm sweep',()=>{
    const {root,model:m}=setup(id);expect(Object.keys(m.hmi.controls.buttons)).toHaveLength(7);
    for(const angle of [0,Math.PI/2,Math.PI]){
      m.updateGeometry({doorK:0,panelA:angle});root.updateMatrixWorld(true);
      const panel=m.panG.getWorldPosition(new THREE.Vector3());expect(panel.x).toBeGreaterThan(cabinHalfWidth(MODELS[id]));
      const scale=m.panG.getWorldScale(new THREE.Vector3());scale.toArray().forEach(v=>expect(v).toBeCloseTo(1));
    }
    expect(m.accessories.equipment.conveyor.visible).toBe(false);
  });
});
