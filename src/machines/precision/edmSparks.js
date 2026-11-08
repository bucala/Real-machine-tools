import * as THREE from 'three';
// Restrained illustration of the discharge zone, not a fire or full-screen flash.
export function createEdmSparks(root) {
  const group = new THREE.Group();
  group.name = 'EDM-discharge-effect';
  group.userData.excludeFromMachineExport = true;
  group.userData.excludeFromExport = true;
  group.visible = false;
  root.add(group);
  const size = 32,
    pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4,
        d = Math.hypot(x - 15.5, y - 15.5) / 16;
      pixels[i] = 255;
      pixels[i + 1] = 222;
      pixels[i + 2] = 128;
      pixels[i + 3] = Math.round(Math.max(0, 1 - d) ** 2 * 255);
    }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.needsUpdate = true;
  const positions = new Float32Array(48 * 3),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffdc7a,
    size: 0.045,
    map: texture,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  group.add(particles);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffb747,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  group.add(glow);
  const light = new THREE.PointLight(0xffcf76, 0, 1.5, 2);
  group.add(light);
  return {
    group,
    particles,
    light,
    update({ S, c, t }) {
      group.visible = !!(
        c.sparks !== false &&
        S.run &&
        S.sparking &&
        S.depth > 0 &&
        !c.estop &&
        !c.door &&
        c.flushing &&
        !c.unclamped
      );
      if (!group.visible) {
        light.intensity = 0;
        return;
      }
      group.position.set(S.x * 0.01, 9.8 - S.depth * 0.01, -S.y * 0.01);
      const rx = c.electrode.w * 0.005 + 0.003,
        rz = (c.electrode.shape === 'round' ? c.electrode.w : c.electrode.d) * 0.005 + 0.003;
      for (let i = 0; i < 48; i++) {
        const phase = (t * 9 + i * 0.618) % 1,
          a = i * 2.399 + t * 3,
          r = 1 + phase * 0.35;
        let x, z;
        if (c.electrode.shape === 'round') {
          x = Math.cos(a) * rx;
          z = Math.sin(a) * rz;
        } else {
          const side = i % 4,
            u = ((i * 0.347) % 1) * 2 - 1;
          x = side === 0 ? -rx : side === 1 ? rx : u * rx;
          z = side === 2 ? -rz : side === 3 ? rz : u * rz;
        }
        positions[i * 3] = x * r;
        positions[i * 3 + 1] = 0.006 + Math.sin(phase * Math.PI) * 0.045;
        positions[i * 3 + 2] = z * r;
      }
      geometry.attributes.position.needsUpdate = true;
      glow.position.y = S.depth * 0.01 + 0.012;
      glow.scale.set(rx * 3.5, rz * 3.5, 1);
      glow.material.opacity = 0.25 + 0.12 * Math.sin(t * 24) ** 2;
      light.intensity = 0.08 + 0.1 * Math.sin(t * 31) ** 2;
    },
  };
}
