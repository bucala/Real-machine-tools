// Ohýbaný dielec z panelov (dno, steny, lemy) spojených ohybmi s polomerom – pre programy ohybov, pri ktorých sa
// plech medzi ohybmi prevracia a otáča (krabička). Každý panel leží vo svojej rovine XZ, Y = „horná“ strana dielca;
// kladný ohyb dvíha panel k +Y (steny krabičky), záporný k −Y (vonkajší lem). Rozmery v mm.
//
// Ohyb je skutočný oblúk strednice s polomerom podľa nástroja (r = ri + t/2, ri z otvorenia matrice V). Rozvinutá
// dĺžka sa pri ohýbaní zachováva: oblúk má stálu dĺžku BA = r · θk (θk = konečný uhol ohybu), takže pri menšom
// uhle je polomer väčší (pri ohybe vo V sa plech najprv prehýba zľahka) a pri konečnom uhle je presne r.
// Rozmery v definícii sú k teoretickým ostrým hranám strednice; rovné časti sú o nábeh sb = r · tan(θk/2) kratšie.
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

// geometria ohybu (strednica) pre uhol th: polomer, bod a normála v parametri u ∈ [0, 1]
function bendShape(j, th) {
  const R = th > 1e-6 ? Math.max(j.r, j.ba / th) : Infinity;
  const at = (u) => {
    const f = th * u,
      p = R === Infinity ? [0, j.ba * u] : [j.sign * R * (1 - Math.cos(f)), R * Math.sin(f)];
    return { y: p[0], z: p[1], ny: Math.cos(f), nz: -j.sign * Math.sin(f) };
  };
  return { R, at };
}

// oblúk ohybu ako pás s hrúbkou t: horná a spodná plocha, dve bočné čelá
function arcGeometry(j, th) {
  const { at } = bendShape(j, th),
    n = Math.max(1, Math.ceil(th / (Math.PI / 36))),
    h = j.t / 2,
    x = j.w / 2,
    pos = [],
    idx = [];
  const strip = (pt, out) => {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) for (const p of pt(at(i / n))) pos.push(...p);
    for (let i = 0; i < n; i++) {
      const a = base + i * 2,
        q = [a, a + 1, a + 2, a + 3].map((k) => new THREE.Vector3().fromArray(pos, k * 3));
      const o = out(at((i + 0.5) / n)),
        nrm = new THREE.Vector3().subVectors(q[1], q[0]).cross(new THREE.Vector3().subVectors(q[3], q[0]));
      // poradie vrcholov tak, aby normála smerovala von z plechu
      if (nrm.dot(o) >= 0) idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      else idx.push(a, a + 3, a + 1, a, a + 2, a + 3);
    }
  };
  const P = (s, k) => [s, k.y, k.z];
  const off = (k, d) => ({ y: k.y + d * k.ny, z: k.z + d * k.nz });
  strip(
    (k) => [P(-x, off(k, h)), P(x, off(k, h))],
    (k) => new THREE.Vector3(0, k.ny, k.nz),
  );
  strip(
    (k) => [P(-x, off(k, -h)), P(x, off(k, -h))],
    (k) => new THREE.Vector3(0, -k.ny, -k.nz),
  );
  strip(
    (k) => [P(-x, off(k, -h)), P(-x, off(k, h))],
    () => new THREE.Vector3(-1, 0, 0),
  );
  strip(
    (k) => [P(x, off(k, -h)), P(x, off(k, h))],
    () => new THREE.Vector3(1, 0, 0),
  );
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// nastavenie uhla ohybu th (celý uhol) – poloha panela na konci oblúka a geometria oblúka
function setJoint(j, th) {
  if (j.theta !== null && Math.abs(j.theta - th) < 1e-6) return;
  j.theta = th;
  const e = bendShape(j, th).at(1);
  j.hinge.position.set(0, e.y, e.z);
  j.hinge.rotation.x = -j.sign * th;
  j.arc.geometry.dispose();
  j.arc.geometry = arcGeometry(j, th);
}

// stavba 3D dielca v mm: root (dno) a pre každý ohyb pivot (začiatok oblúka), oblúk a hinge (panel za oblúkom).
// ri = vnútorný polomer ohybu podľa nástroja, angle = konečný uhol ohybov (rad)
export function buildBoxPart(def, t, material, { ri = t, angle = Math.PI / 2 } = {}) {
  const r = ri + t / 2,
    sb = r * Math.tan(angle / 2),
    ba = r * angle;
  const root = new THREE.Group(),
    joints = {},
    frames = { base: root };
  const slab = (w, l, parent, x0, z0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, l), material);
    m.position.set(x0, 0, z0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
  };
  // dno: rovná časť skrátená o nábeh na každej ohnutej hrane
  const kids = (id) => def.panels.filter((p) => p.parent === id),
    side = (dx, dz) => (kids('base').some((p) => p.out[0] === dx && p.out[1] === dz) ? sb : 0);
  const x0 = -def.base.w / 2 + side(-1, 0),
    x1 = def.base.w / 2 - side(1, 0),
    z0 = -def.base.l / 2 + side(0, -1),
    z1 = def.base.l / 2 - side(0, 1);
  slab(x1 - x0, z1 - z0, root, (x0 + x1) / 2, (z0 + z1) / 2);
  for (const p of def.panels) {
    const pivot = new THREE.Group(),
      hinge = new THREE.Group(),
      w = p.w - 2 * sb;
    // poloha v ráme rodiča: rám panela začína na konci oblúka, teoretická hrana je o sb späť
    const shift = p.parent === 'base' ? 0 : -sb;
    pivot.position.set(p.at[0] - p.out[0] * sb, 0, p.at[1] + shift - p.out[1] * sb);
    pivot.rotation.y = Math.atan2(p.out[0], p.out[1]); // lokálna +Z = smer von z rodiča
    const arc = new THREE.Mesh(new THREE.BufferGeometry(), material);
    arc.name = `bend-${p.id}`;
    arc.castShadow = true;
    arc.receiveShadow = true;
    pivot.add(arc, hinge);
    frames[p.parent].add(pivot);
    const len = p.l - sb - (kids(p.id).length ? sb : 0);
    slab(w, len, hinge, 0, len / 2);
    frames[p.id] = hinge;
    joints[p.id] = { pivot, hinge, arc, sign: p.sign, w, t, r, ba, theta: null };
    setJoint(joints[p.id], 0);
  }
  return { root, joints, r, sb, ba };
}

// uhly ohybov: hotové (pol-uhol beta), práve ohýbaný, ostatné rovné
export function setBoxAngles(part, bends, cur, beta) {
  for (const [id, j] of Object.entries(part.joints)) setJoint(j, 2 * (id === cur ? beta : bends[id] || 0));
}

const tmp = new THREE.Matrix4();
// poloha dielca v lise (mm): počiatok = stred oblúka ohýbanej hrany na strednici (ako sheetSection), ohýbaný panel
// vzadu pri doraze (back = 'child') alebo vpredu; pri zápornom ohybe je dielec prevrátený (ohyb ide vždy nahor)
export function boxPose(part, cur, beta, back = 'child') {
  part.root.updateMatrixWorld(true);
  const j = part.joints[cur],
    th = 2 * beta,
    m = bendShape(j, th).at(0.5);
  // rám v strede oblúka: dotyčnica pootočená o polovicu uhla – obe ramená sú v ňom súmerné (V)
  const mid = part.root.matrixWorld
    .clone()
    .invert()
    .multiply(j.pivot.matrixWorld)
    .multiply(tmp.makeTranslation(0, m.y, m.z))
    .multiply(tmp.makeRotationX((-j.sign * th) / 2));
  const h = new THREE.Matrix4();
  if (back === 'child') h.multiply(tmp.makeRotationY(Math.PI));
  if (j.sign < 0) h.multiply(tmp.makeRotationZ(Math.PI));
  return h.multiply(mid.invert());
}
