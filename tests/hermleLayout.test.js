import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cabinHalfWidth, hmiPose } from '../src/machines/cnc/hermleLayout';
import { createOrbit } from '../src/core/stage';

describe('Hermle front HMI and layout', () => {
  it('places the front column ahead of the door, turns toward the operator and preserves link lengths', () => {
    for (const K of [1,1.23]) {
      const half=K===1?11.4:12.25;
      const front=hmiPose(0,0,half,K);
      expect(front.base[1]).toBeCloseTo(7.5*K);
      expect(front.column[1]-2.3*K).toBeGreaterThan(8.6*K);
      expect(front.yaw*180/Math.PI).toBeCloseTo(-25);
      for(const angle of [0,37.5,90,135,180]) {
        const p=hmiPose(angle,0,half,K);
        const elbow=[p.base[0]+8.8*K*Math.sin(p.angle),p.base[1]+8.8*K*Math.cos(p.angle)];
        expect(Math.hypot(elbow[0]-p.base[0],elbow[1]-p.base[1])).toBeCloseTo(8.8*K);
        expect(Math.hypot(elbow[0]-p.column[0],elbow[1]-p.column[1])).toBeCloseTo(4.3*K);
        expect(p.column[0]).toBeGreaterThanOrEqual(half);
      }
      expect(hmiPose(180,0,half,K).yaw*180/Math.PI).toBeCloseTo(90);
    }
    expect(2*cabinHalfWidth({id:'c42'})*100).toBe(2450);
  });
  it('allows Hermle to zoom beyond 50 units while consuming wheel gestures locally', () => {
    const handlers={},dom={style:{},addEventListener:(k,f)=>{handlers[k]=f;},removeEventListener:(k)=>{delete handlers[k];}};
    const camera=new THREE.PerspectiveCamera();camera.position.set(0,10,40);
    let enabled=true,prevented=0;
    const orbit=createOrbit(camera,dom,()=>{},()=>enabled,{maxDistance:180,maxTargetY:45});orbit.sync();
    const wheel={deltaY:2000,preventDefault:()=>prevented++,stopPropagation:()=>{}};
    handlers.wheel(wheel);
    expect(camera.position.distanceTo(orbit.target)).toBeCloseTo(180);
    expect(prevented).toBe(1);
    enabled=false;handlers.wheel({...wheel,deltaY:-1000});
    expect(prevented).toBe(2);expect(camera.position.distanceTo(orbit.target)).toBeCloseTo(180);
    orbit.dispose();expect(handlers.wheel).toBeUndefined();
  });
});
