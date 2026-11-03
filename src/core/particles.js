// Častice: triesky, iskry, kvapky a hmla emulzie.
import * as THREE from 'three';
import { TAU } from './util';

// ---------- častice: triesky a iskry ----------
// Všetky častice jedného druhu sú jeden InstancedMesh (jedno vykreslenie). Každá častica má vlastný
// pomocný Object3D (ch.m) na výpočet polohy a natočenia; do GPU sa zapíšu len živé častice.
function createParticles(scene, geo, mat, n, shadow = true) {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = shadow; mesh.frustumCulled = false; mesh.count = 0;
  scene.add(mesh);
  const list = [];
  for (let i = 0; i < n; i++) list.push({ m: new THREE.Object3D(), v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, rest: false, g: 14 });
  let idx = 0;
  const spawn = (p, v, life, g = 14, spin = 20, tag = 0) => {
    const ch = list[idx++ % n];
    ch.m.position.copy(p); ch.v.copy(v); ch.w.set(Math.random() * spin, Math.random() * spin, Math.random() * spin);
    Object.assign(ch, { life, g, rest: false, tag });
  };
  const update = (dt, floorAt, onLand) => {
    let alive = 0, moving = false;
    for (const ch of list) {
      if (ch.life <= 0) continue;
      ch.life -= dt;
      if (ch.life <= 0) continue;
      if (!ch.rest) {
        moving = true;
        ch.v.y -= ch.g * dt; ch.m.position.addScaledVector(ch.v, dt);
        ch.m.rotation.x += ch.w.x * dt; ch.m.rotation.y += ch.w.y * dt; ch.m.rotation.z += ch.w.z * dt;
        const fy = floorAt(ch.m.position);
        if (ch.m.position.y <= fy && ch.v.y < 0) { ch.m.position.y = fy; ch.rest = true; if (onLand) onLand(ch); }
      }
      if (ch.life > 0) { ch.m.updateMatrix(); mesh.setMatrixAt(alive++, ch.m.matrix); }
    }
    if (moving || alive !== mesh.count) { mesh.count = alive; mesh.instanceMatrix.needsUpdate = true; }   // ležiace častice sa neprepisujú
  };
  return { spawn, update, mesh };
}


// ---------- kvapky a hmla chladiacej emulzie ----------
function createDrops(scene, n = 260) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.7, roughness: 0.05, metalness: 0, emissive: 0x3a6f92, emissiveIntensity: 0.45, depthWrite: false });
  const P = createParticles(scene, new THREE.SphereGeometry(0.016, 6, 4), mat, n, false);
  const tmpP = new THREE.Vector3(), tmpV = new THREE.Vector3();
  // pri dopade sa kvapka rozstrekne na dve menšie (tag 1), tie už len zmiznú
  const land = (ch) => {
    ch.life = Math.min(ch.life, 0.12);
    if (ch.tag === 0 && Math.random() < 0.6) {
      for (let k = 0; k < 2; k++) { const a = Math.random() * TAU, s = 0.4 + Math.random() * 0.6; P.spawn(tmpP.copy(ch.m.position).setY(ch.m.position.y + 0.01), tmpV.set(Math.cos(a) * s, 0.6 + Math.random() * 0.6, Math.sin(a) * s), 0.35, 9, 0, 1); }
    }
  };
  return { spawn: (p, v, life = 1.2, g = 9.8) => P.spawn(p, v, life, g, 0, 0), update: (dt, floorAt) => P.update(dt, floorAt, land), mat };
}

export { createDrops, createParticles };
