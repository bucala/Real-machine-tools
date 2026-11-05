import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCabinLighting } from '../src/machines/cnc/cabinLighting';

describe('CNC enclosure lighting',()=>{
  it('shadows room lights from above the roof and switches the local lamp and emitters together',()=>{
    const scene=new THREE.Scene(),root=new THREE.Group(),emitter=new THREE.MeshStandardMaterial({emissive:0xffffff});
    scene.add(root,new THREE.DirectionalLight(0xffffff,4),new THREE.DirectionalLight(0xffffff,1));
    const lighting=createCabinLighting(scene,root,{scale:1.3,halfWidth:12.25,emitter});
    lighting.update({cabin:true,light:false,opening:0});
    expect(lighting.lamp.visible).toBe(false);expect(emitter.emissiveIntensity).toBe(0);
    expect(lighting.uniforms.rmtCabinAmbient.value).toBeLessThan(.1);
    scene.children.filter(o=>o.isDirectionalLight).forEach(light=>{expect(light.position.y).toBeGreaterThan(26.4*1.3);expect(light.castShadow).toBe(true);});
    lighting.update({cabin:true,light:true,opening:0});
    expect(lighting.lamp.visible).toBe(true);expect(emitter.emissiveIntensity).toBeGreaterThan(1);
    expect(lighting.uniforms.rmtCabinAmbient.value).toBeLessThan(.1); // light adds illumination; no global exposure trick
    lighting.update({cabin:true,light:false,opening:1});
    expect(lighting.uniforms.rmtCabinAmbient.value).toBeCloseTo(.2);
    lighting.update({cabin:false,light:false});expect(lighting.uniforms.rmtCabinClosed.value).toBe(0);
  });
  it('occludes indirect light in world space, including dynamic stock, without changing albedo or direct light',()=>{
    const scene=new THREE.Scene(),root=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0xd3d6d9}),emitter=new THREE.MeshStandardMaterial();
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);root.add(mesh);scene.add(root);
    const original=material.color.clone(),lighting=createCabinLighting(scene,root,{scale:1,halfWidth:11,emitter});
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    material.onBeforeCompile(shader,{});
    expect(shader.vertexShader).toContain('instanceMatrix * rmtWorld');expect(shader.vertexShader).toContain('modelMatrix * rmtWorld');
    expect(shader.fragmentShader).toContain('reflectedLight.indirectDiffuse *= rmtOcclusion');
    expect(shader.fragmentShader).not.toContain('reflectedLight.directDiffuse *=');expect(material.color.equals(original)).toBe(true);
    const stockMaterial=new THREE.MeshStandardMaterial({vertexColors:true});lighting.registerMaterial(stockMaterial);
    const stockShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};stockMaterial.onBeforeCompile(stockShader,{});
    expect(stockShader.uniforms.rmtCabinClosed).toBe(lighting.uniforms.rmtCabinClosed);expect(mesh.receiveShadow).toBe(true);
    mesh.geometry.dispose();material.dispose();stockMaterial.dispose();emitter.dispose();
  });
});
