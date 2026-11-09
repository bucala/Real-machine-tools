// Ohýbaný dielec z panelov (dno, steny, lemy) spojených ohybovými čiarami – pre programy ohybov, pri ktorých sa plech
// medzi ohybmi prevracia a otáča (krabička). Každý panel leží vo svojej rovine XZ, Y = „horná“ strana dielca;
// kladný ohyb dvíha panel k +Y (steny krabičky), záporný k −Y (vonkajší lem). Rozmery v mm.
import * as THREE from 'three';

// krabička 200 × 150 × 60 mm, na zadnej dlhej stene A vonkajší lem 25 mm
export const BOX_PART = {
  base: { w: 200, l: 150 },
  panels: [
    { id: 'A', parent: 'base', at: [0, -75], out: [0, -1], w: 200, l: 60, sign: 1 },
    { id: 'B', parent: 'base', at: [0, 75], out: [0, 1], w: 200, l: 60, sign: 1 },
    { id: 'C', parent: 'base', at: [-100, 0], out: [-1, 0], w: 150, l: 60, sign: 1 },
    { id: 'D', parent: 'base', at: [100, 0], out: [1, 0], w: 150, l: 60, sign: 1 },
    { id: 'F', parent: 'A', at: [0, 60], out: [0, 1], w: 200, l: 25, sign: -1 },
  ],
};

// stavba 3D dielca v mm: root (dno) a pre každý ohyb pivot (rovina ohybu) a hinge (otáčanie panela)
export function buildBoxPart(def, t, material) {
  const root = new THREE.Group(),
    joints = {},
    frames = { base: root };
  const slab = (w, l, parent, z0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, l), material);
    m.position.z = z0;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
  };
  slab(def.base.w, def.base.l, root, 0);
  for (const p of def.panels) {
    const pivot = new THREE.Group(),
      hinge = new THREE.Group();
    pivot.position.set(p.at[0], 0, p.at[1]);
    pivot.rotation.y = Math.atan2(p.out[0], p.out[1]); // lokálna +Z = smer von z rodiča
    pivot.add(hinge);
    frames[p.parent].add(pivot);
    slab(p.w, p.l, hinge, p.l / 2);
    frames[p.id] = hinge;
    joints[p.id] = { pivot, hinge, sign: p.sign };
  }
  return { root, joints };
}

// uhly ohybov: hotové (pol-uhol beta), práve ohýbaný, ostatné rovné
export function setBoxAngles(part, bends, cur, beta) {
  for (const [id, j] of Object.entries(part.joints)) {
    const b = id === cur ? beta : bends[id] || 0;
    j.hinge.rotation.x = -j.sign * 2 * b; // celý uhol ohybu = 2 · beta
  }
}

const tmp = new THREE.Matrix4();
// poloha dielca v lise (mm, počiatok = ohybová čiara nad matricou): ohýbaný panel vzadu pri doraze (back = 'child')
// alebo vpredu; pri zápornom ohybe je dielec prevrátený (ohyb ide vždy nahor k razníku)
export function boxPose(part, cur, beta, back = 'child') {
  part.root.updateMatrixWorld(true);
  const j = part.joints[cur],
    mh = part.root.matrixWorld.clone().invert().multiply(j.pivot.matrixWorld); // rovina ohybu voči dnu
  const h = new THREE.Matrix4();
  if (back === 'child') h.multiply(tmp.makeRotationY(Math.PI));
  h.multiply(tmp.makeRotationX(beta));
  if (j.sign < 0) h.multiply(tmp.makeRotationZ(Math.PI));
  return h.multiply(mh.invert());
}
