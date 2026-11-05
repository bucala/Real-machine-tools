import * as THREE from 'three';

// Directional room lighting is shadowed by the enclosure. Local indirect-light
// occlusion accounts for the cabin roof/walls, which a global PMREM/hemisphere
// cannot occlude. It never darkens albedo, emissive screens or the whole scene.
export function createCabinLighting(scene, root, { scale: K, halfWidth, emitter, workHeight=9.5*K, lampPositions, targets, bounds }) {
  const uniforms = {
    rmtCabinMin: { value: new THREE.Vector3(...(bounds?.[0]||[-halfWidth + .3 * K, 6 * K, -12.25 * K])) },
    rmtCabinMax: { value: new THREE.Vector3(...(bounds?.[1]||[halfWidth - .3 * K, 26.15 * K, 8.15 * K])) },
    rmtCabinFade: { value: .35 * K },
    rmtCabinClosed: { value: 1 },
    rmtCabinAmbient: { value: .06 },
    rmtCabinBounce: { value: 0 },
  };
  const materials = new Set();
  const registerMaterial = material => {
    if (!material?.isMeshStandardMaterial || materials.has(material)) return;
    materials.add(material);
    material.addEventListener('dispose',()=>materials.delete(material));
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = function(shader, renderer) {
      compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRmtCabinPosition;');
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 rmtWorld = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          rmtWorld = batchingMatrix * rmtWorld;
        #endif
        #ifdef USE_INSTANCING
          rmtWorld = instanceMatrix * rmtWorld;
        #endif
        vRmtCabinPosition = (modelMatrix * rmtWorld).xyz;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vRmtCabinPosition;
        uniform vec3 rmtCabinMin;
        uniform vec3 rmtCabinMax;
        uniform float rmtCabinFade;
        uniform float rmtCabinClosed;
        uniform float rmtCabinAmbient;
        uniform float rmtCabinBounce;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
        vec3 rmtEdge = smoothstep(rmtCabinMin, rmtCabinMin + vec3(rmtCabinFade), vRmtCabinPosition)
          * (vec3(1.0) - smoothstep(rmtCabinMax - vec3(rmtCabinFade), rmtCabinMax, vRmtCabinPosition));
        float rmtInside = rmtEdge.x * rmtEdge.y * rmtEdge.z * rmtCabinClosed;
        float rmtOcclusion = mix(1.0, rmtCabinAmbient, rmtInside);
        reflectedLight.indirectDiffuse *= rmtOcclusion;
        reflectedLight.indirectSpecular *= mix(1.0, min(1.0, rmtCabinAmbient + rmtCabinBounce * .5), rmtInside);
        // Approximate interreflection from the illuminated enclosure surfaces.
        // Confined to the cabin; extinguished with the actual work lights.
        reflectedLight.indirectDiffuse += material.diffuseColor * rmtCabinBounce * rmtInside;`);
    };
    material.customProgramCacheKey = () => 'rmt-cabin-indirect-v2';
    material.needsUpdate = true;
  };
  root.traverse(o => {
    if (o.isMesh && !o.material?.transparent) o.receiveShadow = true;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(registerMaterial);
  });
  const roomLights = scene.children.filter(o => o.isDirectionalLight);
  roomLights.forEach((light, i) => {
    light.position.set(...(i ? [35 * K, 48 * K, -34 * K] : [-26 * K, 62 * K, 38 * K]));
    light.castShadow = true;
    light.shadow.mapSize.set(i ? 1024 : 2048, i ? 1024 : 2048);
    Object.assign(light.shadow.camera, { left: -36 * K, right: 36 * K, top: 36 * K, bottom: -36 * K, near: .5 * K, far: 180 * K });
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.bias = -.00015;
    light.shadow.normalBias = .015 * K;
  });
  // Two broad sources follow the two modelled side diffusers. The brochure
  // (PDF pages 13/15) shows distributed illumination, not calibrated photometry.
  const lamps = [-1, 1].map((side,index) => {
    const lamp = new THREE.SpotLight(0xeaf3ff, 360 * K * K, 34 * K, Math.PI / 2.7, .85, 2);
    lamp.name = `CNC work light ${side < 0 ? 'left' : 'right'}`;
    lamp.position.set(...(lampPositions?.[index]||[side * 5.4 * K, 19.95 * K, 1.6 * K]));
    lamp.target.position.set(...(targets?.[index]||[-side * .6 * K, workHeight, .1 * K]));
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.near = .3 * K;
    lamp.shadow.bias = -.0002;
    lamp.shadow.normalBias = .02 * K;
    lamp.shadow.radius = 2;
    scene.add(lamp, lamp.target);
    return lamp;
  });
  const update = ({ cabin = true, light = true, opening = 0 }) => {
    uniforms.rmtCabinClosed.value = cabin ? 1 : 0;
    uniforms.rmtCabinAmbient.value = .06 + .14 * THREE.MathUtils.clamp(opening, 0, 1);
    lamps.forEach(lamp => { lamp.visible = light; });
    uniforms.rmtCabinBounce.value = light ? .32 : 0;
    emitter.emissiveIntensity = light ? 3 : 0;
  };
  return { lamp: lamps[0], lamps, uniforms, registerMaterial, update };
}
