import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { createStock } from '../src/machines/cnc/voxel';
import { createDeepDrillProcess,validateDeepJob } from '../src/machines/precision/deepDrillProcess';
import { createShuangliModel,DEEP_LAYOUT } from '../src/machines/precision/shuangliModel';
const blank=()=>createStock({min:[-120,-40,-50],max:[0,40,50],res:2});
const job={diameter:16,feed:300,rpm:1800,rows:[{x:-20,y:0,depth:45},{x:20,y:10,depth:70}]};
const ctx=()=>({root:new THREE.Group(),G:{},M:Object.fromEntries(['cab','cab2','dark','black','steel','steelD','table','inox','green','yellow','red','blue','brass','glass'].map(k=>[k,new THREE.MeshStandardMaterial({transparent:k==='glass'})])),tex:()=>({tx:new THREE.Texture()})});
describe('Deep hole drilling cycle',()=>{
  it('rejects holes beyond stock, excessive depths and non-finite parameters before moving',()=>{
    const s=blank();for(const bad of [{...job,diameter:NaN},{...job,feed:0},{...job,rows:[{x:48,y:0,depth:20}]},{...job,rows:[{x:0,y:0,depth:120}]},{...job,rows:[]}])expect(()=>validateDeepJob(bad,s)).toThrow();
    const p=createDeepDrillProcess(s);expect(p.start({...job,rpm:Infinity})).toBe(false);expect(p.S.depth).toBe(-30);expect(p.job).toBe(null);expect(s.removed()).toBe(0);
  });
  it('interlocks front/side doors, coolant, pressure, fixture and emergency stop',()=>{
    for(const conditions of [{door:true},{coolant:false},{pressure:9},{pressure:NaN},{estop:true},{clamped:false}]){
      const stock=blank(),p=createDeepDrillProcess(stock);expect(p.start(job,conditions)).toBe(false);expect(p.S.alarm).toBeTruthy();expect(stock.removed()).toBe(0);
      expect(p.start(job)).toBe(true);p.advance(8);const depth=p.S.depth,removed=stock.removed();p.advance(10,conditions);expect(p.S.run).toBe(false);expect(p.S.depth).toBe(depth);expect(stock.removed()).toBe(removed);
    }
  });
  it('cuts two blind horizontal holes at independent face coordinates and retracts before indexing',()=>{
    const stock=blank(),p=createDeepDrillProcess(stock);expect(p.start(job)).toBe(true);
    for(let i=0;i<1000&&!p.S.done;i++){
      const x=p.S.x,y=p.S.y,depth=p.S.depth;p.advance(.1);
      if(p.S.x!==x||p.S.y!==y)expect(depth).toBe(-30);
    }
    expect(p.S.done).toBe(true);expect(p.S.depth).toBe(-30);expect(p.S.run).toBe(false);
    expect(stock.inside([-20,0,20])).toBe(false);expect(stock.inside([-50,10,-20])).toBe(false);
    expect(stock.inside([-65,0,20])).toBe(true);expect(stock.inside([-90,10,-20])).toBe(true);expect(stock.inside([-25,-20,0])).toBe(true);
    const analytic=Math.PI*8**2*(45+70);expect(stock.removed()).toBeGreaterThan(analytic*.7);expect(stock.removed()).toBeLessThan(analytic*1.3);
  });
  it('holds the actual cavity, resumes the saved program and preserves it during inspection',()=>{
    const stock=blank(),p=createDeepDrillProcess(stock);p.start(job);p.advance(8);p.hold();const amount=stock.removed(),depth=p.S.depth;expect(amount).toBeGreaterThan(0);p.advance(30);expect(stock.removed()).toBe(amount);expect(p.S.depth).toBe(depth);
    p.retract();expect(p.S.depth).toBe(-30);expect(stock.removed()).toBe(amount);
    const edited={...job,rows:[{x:0,y:-20,depth:10}]};p.start(edited);expect(p.job.rows).toEqual(job.rows);p.advance(120);expect(p.S.done).toBe(true);expect(stock.inside([-5,-20,0])).toBe(true);
  });
});
describe('Shuangli ZJA13-family geometry',()=>{
  it('aligns the moving table, Y spindle and tool tip with the process coordinates',()=>{
    const c=ctx(),m=createShuangliModel(c),S={x:65,y:30,depth:210,run:false};m.update({S,diameter:20,dt:1});c.root.updateMatrixWorld(true);
    const tip=m.drill.localToWorld(new THREE.Vector3(-DEEP_LAYOUT.drillLength,0,0));
    const hole=m.stockMount.localToWorld(new THREE.Vector3(-S.depth*.01,S.y*.01,-S.x*.01));
    expect(tip.distanceTo(hole)).toBeLessThan(1e-6);expect(m.spindle.position.x).toBeCloseTo(11.9);
    // The fixed guide actually has a bore through which the drill can pass.
    const guide=c.root.getObjectByName('bored-guide-housing'),center=guide.getWorldPosition(new THREE.Vector3());
    expect(new THREE.Raycaster(center.clone().add(new THREE.Vector3(-2,0,0)),new THREE.Vector3(1,0,0)).intersectObject(guide)).toHaveLength(0);
    m.update({S:{x:0,y:0,depth:-30,run:false}});c.root.updateMatrixWorld(true);
    const shaftRay=new THREE.Raycaster(new THREE.Vector3(-7.6,DEEP_LAYOUT.axisY,0),new THREE.Vector3(1,0,0),0,20);
    const obstruction=shaftRay.intersectObject(c.G.osi,true).filter(h=>{let o=h.object;while(o){if(o===m.spindle)return false;o=o.parent;}return true;});
    expect(obstruction).toHaveLength(0); // no solid guide/carriage through the long drill

  });
  it('keeps loading windows open and slides all front leaves clear of the left aperture',()=>{
    const c=ctx(),m=createShuangliModel(c),S={x:0,y:0,depth:-30,run:false};m.update({S,door:0});c.root.updateMatrixWorld(true);
    const door=m.doors[0],before=new THREE.Box3().setFromObject(door),glass=c.root.getObjectByName('front-door-1-glass');
    const center=glass.getWorldPosition(new THREE.Vector3());const hits=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,0,3)),new THREE.Vector3(0,0,-1)).intersectObject(door,true).filter(h=>!h.object.material.transparent);expect(hits).toHaveLength(0);
    m.update({S,cover:false});expect(new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,0,3)),new THREE.Vector3(0,0,-1)).intersectObject(m.cab,true)).toHaveLength(0);
    m.update({S,door:1});c.root.updateMatrixWorld(true);const after=new THREE.Box3().setFromObject(door);expect(after.min.x-before.min.x).toBeCloseTo(17);expect(after.min.z).toBeCloseTo(before.min.z);
    m.serviceDoors[0].open=true;expect(m.serviceOpen()).toBe(true);m.update({S,dt:1});m.serviceDoors[0].open=false;expect(m.serviceOpen()).toBe(true);m.update({S,dt:1});expect(m.serviceOpen()).toBe(false);
  });
});
