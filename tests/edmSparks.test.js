import { it,expect } from 'vitest';
import * as THREE from 'three';
import { createEdmSparks } from '../src/machines/precision/edmSparks';
it('animates discharge only during a valid active burn, follows the tool and stays out of machine exports',()=>{
 const fx=createEdmSparks(new THREE.Group()),c={sparks:true,flushing:true,electrode:{w:20,d:15,shape:'box'}},S={run:true,sparking:true,depth:2,x:12,y:-7};
 fx.update({c,S,t:1});expect(fx.group.visible).toBe(true);expect(fx.group.position.x).toBeCloseTo(.12);expect(fx.group.position.y).toBeCloseTo(9.78);expect(fx.group.position.z).toBeCloseTo(.07);expect(fx.group.userData.excludeFromMachineExport).toBe(true);
 const before=Array.from(fx.particles.geometry.attributes.position.array);fx.update({c,S,t:1.05});expect(Array.from(fx.particles.geometry.attributes.position.array)).not.toEqual(before);
 for(const flags of [{run:false},{sparking:false},{depth:0}]){fx.update({c,S:{...S,...flags},t:2});expect(fx.group.visible).toBe(false);expect(fx.light.intensity).toBe(0);}
 for(const flags of [{sparks:false},{estop:true},{door:true},{flushing:false},{unclamped:true}]){fx.update({c:{...c,...flags},S,t:3});expect(fx.group.visible).toBe(false);}
});
