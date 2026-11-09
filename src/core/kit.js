// Materiály, súprava tvarov (kolesá, páky, kľuky) a pracovná lampa.
import * as THREE from 'three';
import { LIGHT_K } from './stage';
import { TAU } from './util';

// ---------- materiály a súprava tvarov ----------
const DIAL_IN = 0.44; // vnútorný polomer stupnice voči vonkajšiemu
const std = (hex, roughness, metalness, o = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), roughness, metalness, ...o });
const mkTex = (w, h, draw, rx, ry) => {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(rx, ry);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
};
const baseMats = (g1, g2, g3) => ({
  green: std(g1, 0.6, 0.05),
  greenDark: std(g2, 0.65, 0.05),
  greenDeep: std(g3, 0.7, 0.05),
  steel: std(0xc9ced2, 0.3, 0.85),
  steelDark: std(0x81888e, 0.4, 0.75),
  ways: std(0xdfe3e6, 0.18, 0.9),
  black: std(0x1d1f21, 0.45, 0.2),
  red: std(0xc8322b, 0.45, 0.1),
  yellow: std(0xf1c40f, 0.5, 0.05),
  blue: std(0x1f6fd1, 0.5, 0.05),
  white: std(0xeceee8, 0.6, 0),
  panel: std(0x2b3035, 0.6, 0.2),
  btnGreen: std(0x2e9b4a, 0.45, 0.05),
  insert: std(0xd4ab38, 0.35, 0.8),
  lamp: std(0x1f5f33, 0.4, 0.1),
});

function makeKit(M) {
  const add = (p, geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    o.position.set(x, y, z);
    p.add(o);
    return o;
  };
  const box = (p, x0, x1, y0, y1, z0, z1, m) =>
    add(p, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const cylX = (p, r0, r1, x0, x1, y, z, m, seg = 32) => {
    const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, seg);
    g.rotateZ(-Math.PI / 2);
    return add(p, g, m, (x0 + x1) / 2, y, z);
  };
  const cylY = (p, r0, r1, y0, y1, x, z, m, seg = 24) =>
    add(p, new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), m, x, (y0 + y1) / 2, z);
  const cylZ = (p, r0, r1, z0, z1, x, y, m, seg = 24) => {
    const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, seg);
    g.rotateX(Math.PI / 2);
    return add(p, g, m, x, y, (z0 + z1) / 2);
  };
  const ball = (p, r, x, y, z, m) => add(p, new THREE.SphereGeometry(r, 16, 12), m, x, y, z);
  const lever = (p, x, y, z, len, rx, rz, knob = M.black) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(rx, 0, rz);
    p.add(g);
    cylY(g, 0.045, 0.035, 0, len, 0, 0, M.steel, 12);
    ball(g, 0.11, 0, len, 0, knob);
    ball(g, 0.09, 0, 0, 0, M.steelDark);
    return g;
  };
  // neviditeľná väčšia úchopová zóna pre malé ovládacie prvky
  const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const hitProxy = (p, r, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), hitMat);
    m.position.set(x, y, z);
    p.add(m);
  };
  // páka na otočnom čape: uhol polohy = pivot.rotation.z
  const pivotLever = (p, x, y, z, len, tilt) => {
    const pv = new THREE.Group();
    pv.position.set(x, y, z);
    p.add(pv);
    hitProxy(lever(pv, 0, 0, 0, len, tilt, 0), 0.2, 0, len * 0.8, 0);
    return pv;
  };
  // páka otočná okolo zvislej osi (pri uhle 0 smeruje dozadu, kladný uhol ju točí doľava)
  const pivotLeverY = (p, x, y, z, len, tilt) => {
    const pv = new THREE.Group();
    pv.position.set(x, y, z);
    pv.rotation.x = -Math.PI / 2;
    p.add(pv);
    hitProxy(lever(pv, 0, 0, 0, len, tilt, 0), 0.2, 0, len * 0.8, 0);
    return pv;
  };
  // páka otočná okolo osi X scény (pri uhle 0 smeruje hore, kladný uhol ju nakláňa k obsluhe)
  const pivotLeverX = (p, x, y, z, len) => {
    const pv = new THREE.Group();
    pv.position.set(x, y, z);
    pv.rotation.y = Math.PI / 2;
    p.add(pv);
    hitProxy(lever(pv, 0, 0, 0, len, 0, 0), 0.18, 0, len * 0.8, 0);
    return pv;
  };
  const detents = (p, x, y, z, r, angles, s = 0.035) =>
    angles.forEach((a) => cylZ(p, s, s, z, z + 0.012, x - Math.sin(a) * r, y + Math.cos(a) * r, M.white, 10));
  // ryskovaná stupnica (nonius) za ručným kolesom: 50 dielikov, čísla po 10; pevná ryska je na ráme
  const dialMat = (() => {
    let mat = null;
    return () => {
      if (mat || typeof document === 'undefined') return mat;
      const tx = mkTex(
        256,
        256,
        (g, w) => {
          const c = w / 2,
            rO = c - 1,
            rI = rO * DIAL_IN;
          g.clearRect(0, 0, w, w);
          g.fillStyle = '#d9dcdc';
          g.beginPath();
          g.arc(c, c, rO, 0, TAU);
          g.arc(c, c, rI, 0, TAU, true);
          g.fill();
          g.strokeStyle = '#1b1d1f';
          g.fillStyle = '#1b1d1f';
          g.font = 'bold 22px Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          for (let i = 0; i < 50; i++) {
            const a = (i / 50) * TAU - Math.PI / 2,
              len = i % 10 ? (i % 5 ? 0.16 : 0.26) : 0.34;
            g.lineWidth = i % 5 ? 2 : 3;
            g.beginPath();
            g.moveTo(c + Math.cos(a) * rO * 0.98, c + Math.sin(a) * rO * 0.98);
            g.lineTo(c + Math.cos(a) * rO * (0.98 - len), c + Math.sin(a) * rO * (0.98 - len));
            g.stroke();
            if (i % 10 === 0) {
              g.save();
              g.translate(c + Math.cos(a) * rO * 0.5, c + Math.sin(a) * rO * 0.5);
              g.rotate(a + Math.PI / 2);
              g.fillText(String(i), 0, 0);
              g.restore();
            }
          }
        },
        1,
        1,
      );
      tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping;
      mat = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.35, metalness: 0.55, transparent: true });
      return mat;
    };
  })();
  // ručné koleso: os otáčania = lokálna Z (pre 'x' / '-x' otočená na svetovú ±X)
  const handwheel = (p, R, x, y, z, axis, crankLen) => {
    const outer = new THREE.Group();
    outer.position.set(x, y, z);
    if (axis === 'x') outer.rotation.y = Math.PI / 2;
    if (axis === '-x') outer.rotation.y = -Math.PI / 2;
    if (axis === 'y') outer.rotation.x = -Math.PI / 2;
    p.add(outer);
    const spin = new THREE.Group();
    outer.add(spin);
    add(spin, new THREE.TorusGeometry(R, R * 0.075, 10, 40), M.steel);
    cylZ(spin, R * 0.2, R * 0.2, -0.12, 0.12, 0, 0, M.steel);
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3 + Math.PI / 2;
      const s = add(
        spin,
        new THREE.BoxGeometry(R * 0.85, R * 0.09, R * 0.07),
        M.steel,
        Math.cos(a) * R * 0.52,
        Math.sin(a) * R * 0.52,
        0,
      );
      s.rotation.z = a;
    }
    const hx = Math.cos(-Math.PI / 6) * R * 0.95,
      hy = Math.sin(-Math.PI / 6) * R * 0.95;
    cylZ(spin, R * 0.07, R * 0.06, 0, crankLen, hx, hy, M.black, 12);
    ball(spin, R * 0.1, hx, hy, crankLen, M.black);
    // stupnica sa točí s kolesom, ryska stojí; dvojklik na koleso nastaví nulu (core/controls)
    const dm = dialMat();
    if (dm) {
      const rO = Math.max(R * 0.46, R * 0.2 + 0.1),
        dial = new THREE.Mesh(new THREE.RingGeometry(rO * DIAL_IN, rO, 48, 1), dm);
      dial.position.z = -0.135;
      dial.name = 'graduated-dial';
      dial.userData.noMerge = true;
      spin.add(dial);
      spin.userData.dial = dial;
      cylZ(spin, rO * 1.02, rO * 1.02, -0.17, -0.14, 0, 0, M.steelDark, 40);
      const mark = add(outer, new THREE.BoxGeometry(R * 0.035, rO * 0.22, 0.02), M.red, 0, rO * 1.08, -0.13);
      mark.name = 'dial-index-mark';
    }
    return spin;
  };
  // kľuka s jedným ramenom, os otáčania = lokálna Z
  const crank = (p, len, x, y, z) => {
    const spin = new THREE.Group();
    spin.position.set(x, y, z);
    p.add(spin);
    cylZ(spin, 0.13, 0.13, -0.06, 0.1, 0, 0, M.steel, 20);
    add(spin, new THREE.BoxGeometry(len, 0.1, 0.07), M.steel, len / 2, 0, 0.06);
    cylZ(spin, 0.055, 0.05, 0.09, 0.42, len, 0, M.black, 12);
    ball(spin, 0.075, len, 0, 0.42, M.black);
    hitProxy(spin, len * 0.62, len * 0.5, 0, 0.15);
    return spin;
  };
  // pomocná skupina pre bočné steny: lokálna +Z = normála steny
  const face = (p, x, y, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    p.add(g);
    return g;
  };
  // valec natiahnutý medzi dvoma bodmi (tyče, hadice, prúd chladiva)
  const up = new THREE.Vector3(0, 1, 0);
  const orient = (o, a, b) => {
    const d = b.clone().sub(a);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.scale.set(1, d.length(), 1);
    o.quaternion.setFromUnitVectors(up, d.normalize());
  };
  const rod = (p, a, b, r, m, seg = 12) => {
    const o = add(p, new THREE.CylinderGeometry(r, r, 1, seg), m);
    orient(o, a, b);
    return o;
  };
  return {
    add,
    box,
    cylX,
    cylY,
    cylZ,
    ball,
    lever,
    hitProxy,
    pivotLever,
    pivotLeverY,
    pivotLeverX,
    detents,
    handwheel,
    crank,
    face,
    orient,
    rod,
  };
}

// ---------- pracovná lampa na kĺbovom ramene so skutočným bodovým svetlom ----------
// base, elbow, head sú v súradniciach rodiča; aim je bod v scéne, na ktorý lampa svieti
function createLamp(scene, parent, kit, M, { base, elbow, head, aim, angle = 0.5, power = 3.2 }) {
  const { add, cylY, ball, rod } = kit;
  const g = new THREE.Group();
  parent.add(g);
  cylY(g, 0.15, 0.17, base.y - 0.1, base.y, base.x, base.z, M.black, 20);
  ball(g, 0.075, base.x, base.y, base.z, M.steelDark);
  rod(g, base, elbow, 0.042, M.black);
  ball(g, 0.07, elbow.x, elbow.y, elbow.z, M.steelDark);
  rod(g, elbow, head, 0.038, M.black);
  ball(g, 0.06, head.x, head.y, head.z, M.steelDark);
  // tienidlo s dnom, natočené na cieľ (lokálna -Y = smer svetla)
  const shade = new THREE.Group();
  shade.position.copy(head);
  g.add(shade);
  parent.updateMatrixWorld(true);
  const aimL = parent.worldToLocal(aim.clone());
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aimL.sub(head).normalize());
  shade.translateY(-0.12);
  const shadeMat = new THREE.MeshStandardMaterial({
    color: M.lampShade ? M.lampShade.color : 0x5b6f52,
    roughness: 0.5,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const prof = [
    [0.0, 0.1],
    [0.1, 0.1],
    [0.14, 0.04],
    [0.2, -0.12],
    [0.3, -0.34],
    [0.31, -0.35],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const sh = add(shade, new THREE.LatheGeometry(prof, 32), shadeMat);
  sh.castShadow = false;
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false });
  const bulb = add(shade, new THREE.SphereGeometry(0.09, 18, 12), bulbMat, 0, -0.13, 0);
  bulb.castShadow = false;
  const glassMat = new THREE.MeshBasicMaterial({
    color: 0xfff0c8,
    transparent: true,
    opacity: 0.55,
    toneMapped: false,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glass = add(shade, new THREE.CircleGeometry(0.29, 32), glassMat, 0, -0.33, 0);
  glass.rotation.x = Math.PI / 2;
  glass.castShadow = false;
  // skutočné bodové svetlo s tieňmi
  // decay 0: bez útlmu so vzdialenosťou, ako pri distance = 0 v r128
  const spot = new THREE.SpotLight(0xffefd2, power * LIGHT_K, 0, angle, 0.45, 0);
  spot.position.set(0, -0.15, 0);
  shade.add(spot);
  scene.add(spot.target);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  spot.shadow.camera.near = 0.2;
  spot.shadow.camera.far = 40;
  // jemný svetelný kužeľ, aby bolo vidno, že lampa svieti
  const beamGeo = new THREE.CylinderGeometry(0.04, 1, 1, 40, 1, true);
  beamGeo.translate(0, -0.5, 0);
  const bc = new Float32Array(beamGeo.attributes.position.count * 3);
  for (let i = 0; i < beamGeo.attributes.position.count; i++) {
    const k = 1 + beamGeo.attributes.position.getY(i) * 0.92;
    bc[i * 3] = k;
    bc[i * 3 + 1] = k * 0.95;
    bc[i * 3 + 2] = k * 0.82;
  }
  beamGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }),
  );
  beam.renderOrder = 5;
  scene.add(beam);
  const wp = new THREE.Vector3(),
    dir = new THREE.Vector3(),
    down = new THREE.Vector3(0, -1, 0);
  const update = (on, target = aim) => {
    spot.target.position.copy(target);
    spot.intensity = on ? power * LIGHT_K : 0;
    bulbMat.color.setHex(on ? 0xfff6dc : 0x6b6a64);
    glassMat.opacity = on ? 0.55 : 0.18;
    beam.visible = on;
    if (on) {
      spot.getWorldPosition(wp);
      dir.subVectors(target, wp);
      const len = dir.length() * 1.05;
      beam.position.copy(wp);
      beam.quaternion.setFromUnitVectors(down, dir.normalize());
      const R = len * Math.tan(angle) * 0.85;
      beam.scale.set(R, len, R);
    }
  };
  return { group: g, shade, spot, update };
}

export { baseMats, createLamp, makeKit, mkTex, std };
