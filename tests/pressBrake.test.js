import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { XPERT320,brakeSetup,brakeForce,createBrakeProcess,sheetSection,supportDepth } from '../src/machines/precision/pressBrakeProcess';
import { createBystronicModel } from '../src/machines/precision/bystronicModel';
const cfg={material:'steel',thickness:4,length:2400,depth:600,flange:150,v:32,angle:90,r:0,light:true,hmiAngle:0};
const safe={hydraulic:true,estop:false,guardOpen:false,obstructed:false,unclamped:false};
const model=()=>{const root=new THREE.Group(),G={},M=Object.fromEntries(['cab','cab2','dark','anth','black','visor','red','steel','steelD','tool','brass','green','yellow','sheet','glass'].map(k=>[k,new THREE.MeshStandardMaterial()]));return {root,G,M,m:createBystronicModel({root,G,M,tex:()=>({tx:new THREE.Texture()})})};};
describe('Xpert Pro 320/4300 press brake',()=>{
  it('uses the standard 320/4300 data-sheet column and dimensionally correct force scaling',()=>{
    expect(XPERT320).toMatchObject({length:5260,width:2000,height:3170,force:3200,bendLength:4300,stroke:250,openHeight:640,mass:24300});
    expect(brakeForce(cfg)).toBeCloseTo(766.8);expect(brakeForce({...cfg,length:1200})).toBeCloseTo(383.4);
    expect(brakeForce({...cfg,thickness:8})).toBeCloseTo(4*brakeForce(cfg));
    expect(brakeSetup(cfg).target).toBeLessThan(250);
  });
  it('rejects overload, unsupported flanges, unsuitable V dies and non-finite input',()=>{
    expect(()=>brakeSetup({...cfg,thickness:12,length:4300,v:72,material:'stainless'})).toThrow(/3 200/);
    expect(()=>brakeSetup({...cfg,flange:20,v:80})).toThrow(/rameno/);
    expect(()=>brakeSetup({...cfg,v:16})).toThrow(/úzka/);
    expect(()=>brakeSetup({...cfg,angle:NaN})).toThrow(/rozsahu/);
    expect(()=>brakeSetup({...cfg,flange:601})).toThrow();
    expect(()=>brakeSetup({...cfg,length:4300,depth:900,flange:500})).toThrow(/400 mm/);
  });
  it('finishes a bend, unloads with springback, retracts, and requires a new blank',()=>{
    const p=createBrakeProcess();expect(p.start(cfg,safe)).toBe(true);p.advance(30,safe);
    expect(p.S.done).toBe(true);expect(p.S.complete).toBe(true);expect(p.S.run).toBe(false);expect(p.S.y).toBe(0);
    expect(180-p.S.beta*360/Math.PI).toBeCloseTo(90,6);expect(p.S.force).toBe(0);
    expect(p.start(cfg,safe)).toBe(false);expect(p.reset()).toBe(true);expect(p.S.beta).toBe(0);
  });
  it('freezes at interlocks and holds the part through pause, resume and partial retract',()=>{
    for(const hazard of [{guardOpen:true},{estop:true},{obstructed:true},{hydraulic:false},{unclamped:true}]){
      const p=createBrakeProcess();expect(p.start(cfg,{...safe,...hazard})).toBe(false);
      expect(p.start(cfg,safe)).toBe(true);p.advance(2.5,safe);const y=p.S.y,b=p.S.beta;
      p.advance(1,{...safe,...hazard});expect(p.S.run).toBe(false);expect(p.S.y).toBe(y);expect(p.S.beta).toBe(b);
    }
    const p=createBrakeProcess();p.start(cfg,safe);p.advance(2.5,safe);p.hold();const y=p.S.y;
    p.advance(10,safe);expect(p.S.y).toBe(y);expect(p.reset()).toBe(false);
    expect(p.start(cfg,safe)).toBe(true);p.advance(.2,safe);p.hold();expect(p.retract(safe)).toBe(true);p.advance(5,safe);
    expect(p.S.done).toBe(true);expect(p.S.complete).toBe(false);expect(p.S.beta).toBeGreaterThan(0);
  });
  it('preserves developed sheet length and keeps the punch on the sheet surface',()=>{
    for(const beta of [0,.3,.7]){
      const pts=sheetSection(cfg,beta);let length=0;
      for(let i=1;i<pts.length;i++)length+=Math.hypot(pts[i].z-pts[i-1].z,pts[i].y-pts[i-1].y);
      expect(length).toBeCloseTo(cfg.depth,2);expect(pts.every(p=>Number.isFinite(p.z+p.y))).toBe(true);
    }
    const {m,root}=model(),p=createBrakeProcess();p.start(cfg,safe);p.advance(3,safe);m.update({S:p.S,c:cfg,guardAngle:0});root.updateMatrixWorld(true);
    const punch=new THREE.Box3().setFromObject(m.punch),surface=11+(cfg.thickness-supportDepth(cfg,p.S.beta))*.01;
    expect(punch.min.y).toBeCloseTo(surface,4);
    const ray=new THREE.Raycaster(new THREE.Vector3(.5,11.1,2),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(m.die,true)[0];
    expect(hit.point.y).toBeLessThan(10.9); // real V cavity, not a solid rectangular die
    const fixed=new THREE.Box3().setFromObject(m.die);m.update({S:{...p.S,y:0},c:cfg,guardAngle:0});root.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(m.die).equals(fixed)).toBe(true);
  });
  it('aligns the rear finger contact with X and preserves the detached sheet pose',()=>{
    const {m,root}=model();m.update({S:{y:0,beta:0},c:cfg,guardAngle:0});root.updateMatrixWorld(true);
    m.update({S:{y:0,beta:0},c:{...cfg,cutaway:true},guardAngle:0});
    expect(m.cutawayParts.every(o=>!o.visible&&o.raycast()===false)).toBe(true);
    m.update({S:{y:0,beta:0},c:cfg,guardAngle:0});expect(m.cutawayParts.every(o=>o.visible)).toBe(true);
    const finger=new THREE.Box3().setFromObject(m.fingers[0]);expect(finger.max.z).toBeCloseTo(2-cfg.flange*.01,4);
    m.stock.position.set(4,5,6);m.update({S:{y:0,beta:0},c:{...cfg,unclamped:true},guardAngle:1.1});
    expect(m.stock.position.toArray()).toEqual([4,5,6]);expect(Math.abs(m.guardPivots[0].rotation.y)).toBeCloseTo(1.1);
  });
});
