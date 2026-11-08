import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHmiPanel } from './hmiPanel';
import { CHIP_DRAWER, createAccessories } from './accessories';
import { createToolModel } from './toolModel';
import { cabinHalfWidth, HMI_ARM, hmiPose } from './hermleLayout';
import { loadCradle } from './assets/hermleCradle';

// Dimensions: supplied C32 catalogue pp. 12–13, 34–39; C42 pp. 18–19, 46–50.
// Scene units are 100 mm. Small fittings are reconstructed from catalogue photos.
export const HERMLE_ENVELOPES = {
  c32: { width: 22.7, depth: 36.8, roof: 26.6, height: 31.9, opening: 7.58, tableDepth: 5.4, slots: 7 },
  c42: { width: 24.5, depth: 40, roof: 26.5, height: 32.9, opening: 9.4, tableDepth: 6.3, slots: 9 },
};

export function createHermleModel({ root, G, M, tex, MC, PY }) {
  const P = HERMLE_ENVELOPES[MC.id],
    K = MC.K,
    bodyHalf = cabinHalfWidth(MC),
    PY0 = PY,
    U = 0.01,
    FIX = { r: 35, h: 50 };
  const std = (col, rough = 0.5, metal = 0.2, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(col).convertSRGBToLinear(),
      roughness: rough,
      metalness: metal,
      ...extra,
    });
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const grp = (k, parent = root) => {
    const g = new THREE.Group();
    g.userData.part = k;
    parent.add(g);
    G[k] = g;
    return g;
  };
  const box = (p, xa, xb, y0, y1, z0, z1, m) => {
    const x0 = Math.min(xa, xb),
      x1 = Math.max(xa, xb);
    const me = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
    me.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    me.castShadow = true;
    me.receiveShadow = true;
    p.add(me);
    return me;
  };
  const cylY = (p, r0, r1, y0, y1, x, z, m, s = 32) => {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, s), m);
    me.position.set(x, (y0 + y1) / 2, z);
    me.castShadow = true;
    p.add(me);
    return me;
  };
  const cylX = (p, r, xa, xb, y, z, m, s = 40) => {
    const x0 = Math.min(xa, xb),
      x1 = Math.max(xa, xb);
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, s), m);
    me.rotation.z = Math.PI / 2;
    me.position.set((x0 + x1) / 2, y, z);
    me.castShadow = true;
    p.add(me);
    return me;
  };
  const sc = (parent) => {
    const g = new THREE.Group();
    g.scale.setScalar(K);
    parent.add(g);
    return g;
  };
  M.win = std(0x1d2329, 0.15, 0.4);
  M.yellow = std(0xf2c230, 0.5, 0.1);
  M.brush = std(0xc2c6ca, 0.38, 0.7);
  // A folded sheet or cast profile, extruded along Z; real edges catch the light.
  const profile = (parent, points, z, depth, mat, bevel = 0) => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: bevel > 0,
        bevelSize: bevel,
        bevelThickness: bevel,
        bevelSegments: 3,
        curveSegments: 32,
      }),
      mat,
    );
    mesh.position.z = z;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const rod = (parent, a, b, r, mat) => {
    const delta = v3(...b).sub(v3(...a)),
      mesh = cylY(parent, r, r, 0, delta.length(), 0, 0, mat, 12);
    mesh.position.copy(
      v3(...a)
        .add(v3(...b))
        .multiplyScalar(0.5),
    );
    mesh.quaternion.setFromUnitVectors(v3(0, 1, 0), delta.normalize());
    return mesh;
  };
  const bolts = (parent, positions, r = 0.045, axis = 'z') => {
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r, 0.035, 6), M.steelD, positions.length);
    const q = new THREE.Quaternion().setFromAxisAngle(
      v3(axis === 'z' ? 1 : 0, 0, axis === 'x' ? 1 : 0),
      axis === 'y' ? 0 : Math.PI / 2,
    );
    positions.forEach((p, i) => mesh.setMatrixAt(i, new THREE.Matrix4().compose(v3(...p), q, v3(1, 1, 1))));
    parent.add(mesh);
    return mesh;
  };
  const face = (parent, texture, w, h, x, y, z, ry = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    parent.add(mesh);
    return mesh;
  };
  const caution = tex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#edc632';
    g.strokeStyle = '#22282b';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(w / 2, 10);
    g.lineTo(w - 9, h - 12);
    g.lineTo(9, h - 12);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#22282b';
    g.fillRect(w / 2 - 5, 43, 10, 36);
    g.fillRect(w / 2 - 5, 89, 10, 10);
  });
  const warning = (parent, x, y, z, size = 0.22, ry = 0) => {
    const decal = face(parent, caution.tx, size, size, x, y, z, ry);
    decal.name = 'machine-caution-decal';
    decal.material.transparent = true;
    decal.material.depthWrite = false;
    return decal;
  };
  // ---------------- lôžko z minerálneho liatia a steny s vedeniami Y ----------------
  const bed = sc(grp('lozko'));
  bed.scale.y = 1;
  for (const sign of [-1, 1])
    for (const z of [-9.6 * K, 5.4]) {
      const x = (sign * (bodyHalf - 2.6)) / K,
        zz = z / K;
      const pad = box(bed, x - 0.6 / K, x + 0.6 / K, 0, 0.35, zz - 0.7 / K, zz + 0.7 / K, M.steelD);
      pad.name = 'machine-levelling-pad';
      cylY(bed, 0.13 / K, 0.13 / K, 0.35, 0.72, x, zz, M.steel, 16);
      cylY(bed, 0.23 / K, 0.23 / K, 0.43, 0.52, x, zz, M.steelD, 6);
    }
  const bedHalf = Math.min(10, bodyHalf / K - 0.1);
  const drawerScale = bodyHalf / 12.25,
    drawerRear = (CHIP_DRAWER.z - CHIP_DRAWER.depth / 2 - 0.3) * drawerScale,
    drawerFront = (CHIP_DRAWER.z + CHIP_DRAWER.depth / 2 + 0.3) * drawerScale;
  // Real base opening for the withdrawable reservoir; no solid casting through it.
  box(bed, -bedHalf, bedHalf, 3.4, 6.2, -12.5, 6.1 / K, M.dark);
  box(bed, -P.opening / 2 / K, P.opening / 2 / K, 3.4, 6.2, 6.1 / K, 6.8 / K, M.dark);
  box(bed, -bedHalf, bedHalf, 0.7, 3.4, -12.5, drawerRear / K, M.dark);
  box(bed, -bedHalf, (bodyHalf - 1.4) / K, 0.7, 3.4, drawerFront / K, 6.8 / K, M.dark);
  box(bed, (bodyHalf - 1.4) / K, bedHalf, 0.7, 1.85, drawerFront / K, 6.8 / K, M.dark);
  box(
    bed,
    ((CHIP_DRAWER.innerX + 0.3) * drawerScale) / K,
    (bodyHalf - 1.4) / K,
    0.7,
    3.4,
    drawerRear / K,
    drawerFront / K,
    M.dark,
  );
  box(bed, (bodyHalf - 1.4) / K, bedHalf, 0.7, 1.85, drawerRear / K, drawerFront / K, M.dark);
  [-1, 1].forEach((s) => {
    const wall = profile(
      bed,
      [
        [-6.05 / K, 6.2],
        [-7.5 / K, 7.8],
        [-7.8 / K, 12.7],
        [-1.7 / K, 12.7],
        [-1.7 / K, 20.8],
        [12.3, 20.8],
        [12.5, 6.2],
      ],
      0,
      2.7,
      M.anth,
    );
    wall.name = 'mineral-cast-bed-cheek';
    wall.rotation.y = Math.PI / 2;
    wall.position.x = s * 6.9;
    wall.scale.z = s; // stena lôžka
    box(bed, s * 7.6, s * 8.6, 20.8, 21.2, -11, 3.2, M.steelD); // vedenie Y
    cylX(bed, 2.1, s * 6.4, s * 6.9, PY0, 0, M.table, 48); // príruba osi A
    const motorOuter = Math.min(10.6, bodyHalf / K - 0.2);
    if (MC.id === 'c42' || s > 0) cylX(bed, 1.2, s * (motorOuter - 0.8), s * motorOuter, PY0, 0, M.steelD, 32); // pohon osi A (tandem)
  });
  const chipFloor = box(bed, -6.9, 6.9, 4.5, 4.65, -12.5, 6.1 / K, M.inox);
  chipFloor.name = 'recessed-stainless-chip-floor';
  box(bed, -6.9, 6.9, 7.2, 19, -12.4, -12.2, M.inox); // zadná stena
  box(bed, -6.9, 6.9, 6.3, 13.3, -3.55, -3.4, M.inox);
  for (const sign of [-1, 1]) box(bed, sign * 2.3, sign * 6.9, 13.3, 18.8, -3.55, -3.4, M.inox);
  for (const x of [-6.5, -2.6, 2.6, 6.5])
    bolts(
      bed,
      [
        [x, 13.6, -3.38],
        [x, 18.5, -3.38],
      ],
      0.05,
    ); // deliaca stena pred zásobníkom
  // Rear service/electrical section completes the 4000 mm C42 plan envelope.
  const service = sc(bed.parent),
    envelopeScale = bodyHalf / 12.25;
  const serviceRear = (8.9 - P.depth) / K,
    serviceFront = -12.4;
  service.scale.y = 1;
  const serviceHalf = (8.75 * envelopeScale) / K;
  const serviceTop = (21.5 * envelopeScale) / K;
  for (const sign of [-1, 1])
    box(service, sign * (serviceHalf - 0.12), sign * serviceHalf, 1.2, serviceTop, serviceRear, serviceFront, M.cab2);
  box(service, -serviceHalf, serviceHalf, serviceTop - 0.15, serviceTop, serviceRear, serviceFront, M.cab2);
  // Electrical rack and rear bulkhead remain visible through the open doors.
  box(service, -serviceHalf + 0.2, serviceHalf - 0.2, 2, serviceTop - 0.3, serviceFront - 0.2, serviceFront, M.anth);
  for (let i = 0; i < 5; i++)
    box(
      service,
      -serviceHalf + 0.8,
      serviceHalf - 0.8,
      3 + i * 2.4,
      3.5 + i * 2.4,
      serviceRear + 1.2,
      serviceRear + 1.6,
      M.steelD,
    );
  box(service, -serviceHalf + 0.2, serviceHalf - 0.2, 1, 1.2, serviceRear + 0.2, serviceFront - 0.2, M.dark);
  for (const x of [-serviceHalf * 0.8, serviceHalf * 0.8])
    for (const z of [serviceRear + 0.6, serviceFront - 0.6]) cylY(service, 0.4, 0.4, 0.05, 1.2, x, z, M.steelD);
  for (const sign of MC.id === 'c42' ? [-1, 1] : [1]) {
    box(bed, sign * 9.55, sign * Math.min(10.15, bodyHalf / K - 0.3), PY - 1, PY + 1, -0.9, 0.9, M.cab2);
    for (let i = 0; i < 7; i++)
      box(
        bed,
        sign * 9.6,
        sign * Math.min(10.1, bodyHalf / K - 0.3),
        PY - 0.9 + i * 0.25,
        PY - 0.85 + i * 0.25,
        -0.94,
        -0.9,
        M.steelD,
      );
  }
  const accessories = createAccessories(root, M, K, bodyHalf);
  // Cast U cradle, paired A bearings and the flattened, parallel-slot table.
  const tab = grp('stol'),
    aG = new THREE.Group();
  aG.position.set(0, PY, 0);
  tab.add(aG);
  const r = MC.table * 0.005,
    bearingX = 6.4 * K;
  // User supplied STL: disconnected table removed, casting reduced to 14k faces.
  // Calibrate the generated mesh to the catalogue bearings and table plane;
  // its original units/proportions are not a dimensional Hermle CAD drawing.
  // tvar kolísky z dodaného STL sa načíta asynchrónne (samostatný chunk); dovtedy prázdna geometria
  const castingFrom = (cradleAsset) => {
    const positions = [];
    for (let i = 0; i < cradleAsset.positions.length; i += 3) {
      const x = cradleAsset.positions[i],
        z = cradleAsset.positions[i + 1],
        h = cradleAsset.positions[i + 2];
      const y = h <= 23 ? (h - 23) * 0.105 - MC.hA * U : h < 28 ? ((h - 28) * MC.hA * U) / 5 : ((h - 28) * 2.15) / 22;
      const edge = THREE.MathUtils.smoothstep(Math.abs(x), 28, 40);
      positions.push((x * bearingX) / 44, y, -z * THREE.MathUtils.lerp(P.tableDepth / 44.5, 0.105, edge));
    }
    const casting = new THREE.BufferGeometry();
    casting.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    casting.setIndex(new THREE.BufferAttribute(cradleAsset.indices, 1));
    casting.computeVertexNormals();
    return casting;
  };
  const empty = new THREE.BufferGeometry();
  empty.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  const bowl = new THREE.Mesh(empty, std(0x9ca4aa, 0.38, 0.55));
  bowl.name = 'cast-A-cradle';
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  const cradleReady = loadCradle().then((data) => {
    bowl.geometry.dispose();
    bowl.geometry = castingFrom(data);
    bowl.castShadow = true; // obmedzenie vrhačov tieňa videlo prázdnu geometriu
    return bowl;
  });
  aG.add(bowl);
  for (const sign of [-1, 1]) {
    cylX(aG, 2.25, sign * (bearingX - 0.28), sign * (bearingX + 0.05), 0, 0, M.steelD, 96);
    cylX(aG, 2.12, sign * (bearingX - 0.36), sign * (bearingX - 0.27), 0, 0, M.table, 96);
    cylX(aG, 1.74, sign * (bearingX - 0.4), sign * (bearingX - 0.35), 0, 0, M.steelD, 96);
    cylX(aG, 1.64, sign * (bearingX - 0.44), sign * (bearingX - 0.39), 0, 0, M.table, 96);
    cylX(aG, 0.58, sign * (bearingX - 0.56), sign * (bearingX - 0.43), 0, 0, M.table, 48);
    const flange = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.055, 8, 96), M.steel);
    flange.rotation.y = Math.PI / 2;
    flange.position.x = sign * (bearingX - 0.38);
    aG.add(flange);
    bolts(
      aG,
      Array.from({ length: 24 }, (_, i) => [
        sign * (bearingX - 0.4),
        1.97 * Math.sin((i * Math.PI) / 12),
        1.97 * Math.cos((i * Math.PI) / 12),
      ]),
      0.055,
      'x',
    );
    const padX = sign * (bearingX - 0.38);
    box(aG, padX - 0.14, padX + 0.14, 0.6, 0.94, 0.68, 0.74, M.cab2);
    bolts(aG, [[padX, 0.78, 0.77]], 0.05);
    warning(aG, sign * (bearingX - 0.42), 1.5, 0.8, 0.24, sign < 0 ? Math.PI / 2 : -Math.PI / 2);
    for (const y of [0.75, -0.75])
      box(aG, sign * (bearingX - 0.64), sign * (bearingX - 0.47), y - 0.12, y + 0.12, -0.16, 0.16, M.steel);
  }
  box(aG, -0.18, 0.18, -2.9, -2.55, P.tableDepth / 2 + 0.36, P.tableDepth / 2 + 0.4, M.cab2);
  bolts(aG, [[0, -2.72, P.tableDepth / 2 + 0.43]], 0.05);
  const cG = new THREE.Group();
  cG.position.y = -MC.hA * U;
  aG.add(cG);
  cylY(cG, r - 0.25, r - 0.25, -0.55, -0.24, 0, 0, M.steelD, 80);
  const outline = new THREE.Shape(),
    halfDepth = P.tableDepth / 2;
  const outlinePts = [];
  for (let i = 0; i <= 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    outlinePts.push([Math.cos(a) * r, Math.max(-halfDepth, Math.min(halfDepth, Math.sin(a) * r))]);
  }
  outlinePts.forEach(([x, z], i) => (i ? outline.lineTo(x, z) : outline.moveTo(x, z)));
  outline.closePath();
  for (let i = 0; i < P.slots; i++) {
    const z = (i - (P.slots - 1) / 2) * 0.7,
      extent = Math.sqrt(r * r - z * z) - 0.04,
      slot = new THREE.Path();
    slot.moveTo(-extent, z - 0.07);
    slot.lineTo(-extent, z + 0.07);
    slot.lineTo(extent, z + 0.07);
    slot.lineTo(extent, z - 0.07);
    slot.closePath();
    outline.holes.push(slot);
    box(cG, -extent, extent, -0.245, -0.225, -z - 0.09, -z + 0.09, M.black);
  }
  const tdisc = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outline, { depth: 0.22, bevelEnabled: false, curveSegments: 80 }),
    M.table,
  );
  tdisc.name = 'parallel-slot-clamping-table';
  tdisc.rotation.x = -Math.PI / 2;
  tdisc.position.y = -0.22;
  tdisc.castShadow = true;
  tdisc.receiveShadow = true;
  cG.add(tdisc);
  bolts(
    cG,
    [
      [-r * 0.65, 0.025, -1.05],
      [r * 0.65, 0.025, -1.05],
      [-r * 0.65, 0.025, 1.05],
      [r * 0.65, 0.025, 1.05],
    ],
    0.06,
    'y',
  );
  for (const x of [-r * 0.7, r * 0.7]) {
    const label = warning(cG, x, 0.028, 0.45, 0.2);
    label.rotation.x = -Math.PI / 2;
  }
  cylY(cG, FIX.r * U * 1.35, FIX.r * U * 1.35, 0, 0.22, 0, 0, M.steelD, 40); // nulový upínací systém
  cylY(cG, FIX.r * U, FIX.r * U, 0.22, FIX.h * U, 0, 0, M.anth, 40);
  const clampPins = [0, 1, 2].map((i) => {
    const pin = new THREE.Group();
    pin.rotation.y = (i * Math.PI * 2) / 3;
    cG.add(pin);
    return box(pin, -0.055, 0.055, 0.25, 0.42, FIX.r * U - 0.06, FIX.r * U + 0.06, M.steel);
  });
  // ---------------- portál: priečnik Y, sane X, smykadlo Z, vreteno ----------------
  const ax = grp('osi');
  const yG = new THREE.Group();
  ax.add(yG);
  const yS = sc(yG);
  yS.scale.y = 1;
  box(yS, -8.8, 8.8, 21.2, 23.0, -1.7, 1.7, M.cab2); // priečnik Y
  box(yS, -8.8, 8.8, 23.0, 23.1, -1.7, 1.7, M.steelD);
  for (const y of [20.6, 22.4]) box(yS, -8.4, 8.4, y, y + 0.15, 1.73, 1.89, M.steel);
  const guideBolts = [];
  for (const y of [20.68, 22.48]) for (let x = -8; x <= 8; x += 0.8) guideBolts.push([x, y, 1.91]);
  bolts(yS, guideBolts, 0.035);
  // Short trapezoidal stainless accordion shields follow the brochure cutaway.
  // Every fold has depth; the outer edges taper inward toward the lower rail.
  const covers = [],
    bellows = [];
  for (const sign of [-1, 1]) {
    const folds = 48,
      positions = new Float32Array((folds + 1) * 6),
      uv = new Float32Array((folds + 1) * 4),
      indices = [];
    for (let i = 0; i <= folds; i++) {
      uv.set([i / folds, 0, i / folds, 1], i * 4);
      if (i < folds) {
        const n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo, M.inox);
    mesh.name = sign < 0 ? 'left-trapezoid-bellows' : 'right-trapezoid-bellows';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    yS.add(mesh);
    bellows.push({ mesh, sign, folds });
    profile(
      yS,
      [
        [sign * 8.7, 23.12],
        [sign * 8.5, 23.12],
        [sign * 6.73, 17.04],
        [sign * 6.94, 17.04],
      ],
      1.79,
      0.19,
      M.steelD,
    );
    rod(yS, [sign * 8.57, 23.1, 2.01], [sign * 6.84, 17.16, 2.01], 0.045, M.steel);
  }
  box(yS, -8.9, 8.9, 23.07, 23.65, 1.68, 2.12, M.cab2);
  box(yS, -6.95, 6.95, 16.95, 17.2, 1.68, 2.12, M.inox);
  box(yS, -6.95, 6.95, 16.78, 16.95, 1.7, 1.89, M.steelD);
  bolts(
    yS,
    [-8.5, -4.5, 0, 4.5, 8.5].map((x) => [x, 23.38, 2.14]),
    0.04,
  );
  bolts(
    yS,
    [-6.5, -3.2, 0, 3.2, 6.5].map((x) => [x, 17.08, 2.14]),
    0.04,
  );
  const xG = new THREE.Group();
  yG.add(xG);
  const xS = sc(xG);
  xS.scale.y = 1;
  box(xS, -1.45, 1.45, 20.0, 23.6, -2.0, 0.85, M.cab);
  for (const x of [-1.65, 1.65])
    for (const y of [20.4, 22.25]) box(xS, x - 0.25, x + 0.25, y, y + 0.5, 1.35, 1.55, M.steelD); // sane X
  const zG = new THREE.Group();
  xG.add(zG);
  const zS = sc(zG);
  zS.scale.setScalar(1);
  zS.position.z = 2.25 * K - 1.92;
  box(zS, -1.25, 1.25, 0.9, 13.0, -1.25, 1.9, M.inox); // smykadlo Z (počiatok = čelo vretena)
  const sp = grp('vreteno', zG);
  cylY(sp, 0.78, 0.78, 0.05, 0.9 * K, 0, 0, M.steel, 40);
  cylY(sp, 0.55, 0.78, 0, 0.05, 0, 0, M.steelD, 40);
  for (const y of [0.2, 0.45, 0.7]) cylY(sp, 0.8, 0.8, y, y + 0.035, 0, 0, M.steelD);
  for (const x of [-0.98, 0.98]) {
    cylY(sp, 0.12, 0.12, 0.55, 1.3, x, 0, M.red, 16);
    cylY(sp, 0.19, 0.19, 1.3, 1.5, x, 0, M.steelD, 16);
    box(sp, x - 0.18, x + 0.18, 1.5, 1.75, -0.18, 0.18, M.anth);
  }
  const toolG = new THREE.Group();
  sp.add(toolG);
  const clearTool = (g) => {
    while (g.children.length) {
      const o = g.children[0];
      g.remove(o);
      o.traverse((n) => n.geometry?.dispose());
    }
  };
  const buildTool = (t) => {
    clearTool(toolG);
    if (t) toolG.add(createToolModel(t, M));
  };
  // Pick-up carousel integrated in the rear bed: windowed drum, perimeter
  // pockets and a SIDE drive. The long guide assembly sits over the carrier;
  // it is not a fictitious drive shaft through the centre of the linear rails.
  const mag = grp('zasobnik'),
    magS = sc(mag);
  const magZ = (-MC.tcY * U) / K - 4,
    magY = (PY + (MC.nose[1] - 80) * U) / K;
  const drum = new THREE.Group();
  drum.name = 'magazine-support-drum';
  drum.position.set(0, magY - 2.3, magZ);
  magS.add(drum);
  cylY(drum, 3.62, 3.62, -0.22, 0, 0, 0, M.anth, 96);
  cylY(drum, 3.62, 3.62, 1.83, 2.03, 0, 0, M.anth, 96);
  for (let i = 0; i < 12; i++) {
    const bay = new THREE.Group();
    bay.rotation.y = (i * Math.PI) / 6;
    drum.add(bay);
    box(bay, -0.22, 0.22, 0, 1.85, 3.13, 3.58, M.anth);
    // Recessed inner wall leaves visible inspection pockets between the ribs.
    box(bay, -0.6, 0.6, 0.18, 1.65, 2.85, 2.92, M.black);
    bolts(
      bay,
      [
        [-0.05, 0.15, 3.6],
        [-0.05, 1.7, 3.6],
      ],
      0.055,
    );
  }
  for (const sign of [-1, 1]) {
    box(magS, sign * 3.7 - 0.35, sign * 3.7 + 0.35, 6.3 / K, magY - 2.45, magZ - 2, magZ + 2, M.anth);
    box(magS, sign * 3.7 - 0.65, sign * 3.7 + 0.65, 6.3 / K, 6.55 / K, magZ - 2.3, magZ + 2.3, M.steelD);
  }
  const magG = new THREE.Group();
  magG.name = 'indexed-tool-carousel';
  magG.position.set(0, magY, magZ);
  magS.add(magG);
  cylY(magG, 3.8, 3.8, -0.25, -0.09, 0, 0, M.steelD, 96);
  const race = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.11, 10, 128), M.red);
  race.rotation.x = Math.PI / 2;
  race.position.y = -0.025;
  magG.add(race);
  const innerRace = new THREE.Mesh(new THREE.TorusGeometry(3.57, 0.035, 8, 128), M.black);
  innerRace.rotation.x = Math.PI / 2;
  innerRace.position.y = 0.005;
  magG.add(innerRace);
  const pockets = [];
  for (let i = 0; i < MC.mag; i++) {
    const a = (i / MC.mag) * Math.PI * 2,
      g = new THREE.Group();
    g.name = `magazine-pocket-${i + 1}`;
    g.position.set(Math.sin(a) * 4, 0, Math.cos(a) * 4);
    g.rotation.y = a;
    magG.add(g);
    // Moulded red saddle with a U-shaped jaw around the HSK flange groove.
    box(g, -0.26, 0.26, -0.2, -0.08, -0.48, -0.24, M.red);
    for (const sign of [-1, 1]) {
      profile(
        g,
        [
          [sign * 0.19, -0.15],
          [sign * 0.27, -0.15],
          [sign * 0.3, 0.04],
          [sign * 0.21, 0.04],
        ],
        -0.27,
        0.59,
        M.red,
      );
      box(g, sign * 0.19, sign * 0.26, -0.05, 0.02, 0.15, 0.35, M.red);
    }
    box(g, -0.13, 0.13, -0.38, -0.2, -0.46, -0.2, M.steelD);
    bolts(
      g,
      [
        [-0.16, -0.06, -0.37],
        [0.16, -0.06, -0.37],
      ],
      0.032,
      'y',
    );
    const holder = new THREE.Group();
    holder.scale.setScalar(1 / K);
    g.add(holder);
    pockets.push(holder);
  }
  // Small gear teeth on the ring mesh with the outboard pinion, under its cover.
  for (let i = 0; i < 84; i++) {
    const a = (i * Math.PI) / 42,
      g = new THREE.Group();
    g.rotation.y = a;
    magG.add(g);
    box(g, -0.04, 0.04, -0.24, -0.08, 3.78, 3.94, M.red);
  }
  const driveShaft = new THREE.Group();
  driveShaft.name = 'carousel-side-pinion';
  driveShaft.position.set(-4.22, magY, magZ - 0.85);
  magS.add(driveShaft);
  cylY(driveShaft, 0.16, 0.16, -0.6, 0.9, 0, 0, M.steel);
  cylY(driveShaft, 0.45, 0.45, -0.23, -0.08, 0, 0, M.steelD);
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    g.rotation.y = (i * Math.PI) / 8;
    driveShaft.add(g);
    box(g, -0.045, 0.045, -0.23, -0.08, 0.39, 0.49, M.steelD);
  }
  const drive = new THREE.Group();
  drive.name = 'carousel-side-drive-cover';
  drive.position.set(-4.22, magY + 0.75, magZ - 0.85);
  magS.add(drive);
  const cap = profile(
    drive,
    [
      [-0.62, -0.45],
      [-0.5, -1.95],
      [0.25, -2.2],
      [0.7, -1.8],
      [0.62, 0.15],
      [0.25, 0.6],
      [-0.3, 0.55],
    ],
    0,
    0.13,
    M.red,
    0.045,
  );
  cap.rotation.x = Math.PI / 2;
  for (const z of [0, -1.65]) {
    cylY(drive, 0.25, 0.25, -0.16, 0.045, 0, z, M.steel);
    cylY(drive, 0.15, 0.15, 0.045, 0.07, 0, z, M.steelD);
  }
  cylY(drive, 0.42, 0.42, -1.55, -0.2, 0, -1.65, M.anth);
  box(magS, -4.9, -3.8, magY - 2.1, magY - 1.85, magZ - 3.1, magZ - 0.1, M.anth);
  box(magS, -4.48, -4.03, magY - 1.85, magY - 0.55, magZ - 2.8, magZ - 0.7, M.anth);
  bolts(
    magS,
    [
      [-4.65, magY - 1.82, magZ - 2.85],
      [-4.65, magY - 1.82, magZ - 0.4],
    ],
    0.065,
    'y',
  );
  // Long raised guide base: faceted cast platform, two bright rails and screw.
  const saddle = new THREE.Group();
  saddle.name = 'magazine-guide-bridge';
  saddle.position.set(0, magY + 0.08, magZ);
  magS.add(saddle);
  profile(
    saddle,
    [
      [-1.9, 0],
      [1.9, 0],
      [1.9, 0.4],
      [1.55, 0.7],
      [-1.55, 0.7],
      [-1.9, 0.4],
    ],
    -4.1,
    6.75,
    M.anth,
    0.06,
  );
  const rodZ = (x, y, z0, z1, r, mat) => rod(saddle, [x, y, z0], [x, y, z1], r, mat);
  for (const sign of [-1, 1]) {
    box(saddle, sign * 0.9, sign * 1.25, 0.7, 0.92, -3.85, 2.45, M.steel);
    box(saddle, sign * 1.35, sign * 1.44, 0.69, 0.73, -3.8, 2.42, M.steelD);
    bolts(
      saddle,
      Array.from({ length: 10 }, (_, i) => [sign * 1.07, 0.94, -3.6 + i * 0.6]),
      0.04,
      'y',
    );
  }
  rodZ(0, 1.06, -3.7, 2.4, 0.13, M.steelD);
  for (let i = 0; i < 49; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.137, 0.017, 4, 12), M.steel);
    ring.position.set(0, 1.06, -3.6 + i * 0.123);
    saddle.add(ring);
  }
  for (const z of [-3.85, 2.5]) {
    box(saddle, -1.65, 1.65, 0.65, 1.7, z - 0.15, z + 0.15, M.cab2);
    for (const x of [-1.07, 0, 1.07]) rodZ(x, 1.07, z - 0.17, z + 0.17, 0.23, M.steelD);
    bolts(
      saddle,
      [
        [-1.42, 0.85, z + 0.18],
        [1.42, 0.85, z + 0.18],
        [-1.42, 1.48, z + 0.18],
        [1.42, 1.48, z + 0.18],
      ],
      0.05,
    );
  }
  box(saddle, -0.53, 0.53, 0.8, 1.65, -4.15, -4.04, M.anth);
  rodZ(0, 1.1, -4.06, -3.85, 0.2, M.steel);
  const guideCarriage = box(saddle, -1.5, 1.5, 0.92, 1.32, -3.8, -2.7, M.steelD);
  guideCarriage.name = 'linear-guide-carriage';
  const loadMagazine = (tls) =>
    pockets.forEach((g, i) => {
      clearTool(g);
      const tl = tls.find((x) => x.t === i + 1);
      if (tl) g.add(createToolModel(tl, M));
    });
  // Thin enclosure panels: solid side service doors, not enormous side windows.
  const cab = grp('kabina'),
    cabS = new THREE.Group();
  cab.add(cabS);
  cab.add(service);
  const front = 8.6,
    rear = -12.3 * K,
    opening = P.opening,
    leaf = opening / 2 + 0.9,
    half = opening / 2;
  const logo = tex(768, 192, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#d8202a';
    g.lineWidth = 24;
    g.beginPath();
    g.arc(90, 96, 61, 0, Math.PI * 2);
    g.stroke();
    g.clearRect(0, 78, 155, 35);
    g.fillStyle = '#6b7277';
    g.fillRect(21, 80, 36, 31);
    g.fillStyle = '#6b7277';
    g.font = 'bold 105px sans-serif';
    g.textBaseline = 'middle';
    g.fillText('HERMLE', 165, 100);
  });
  const modelLabel = tex(192, 1536, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#d8202a';
    g.fillRect(60, 0, 72, 560);
    g.fillRect(60, 880, 72, h - 880);
    g.save();
    g.translate(100, 720);
    g.rotate(-Math.PI / 2);
    g.fillStyle = '#60666b';
    g.font = '68px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(MC.name, 0, 0);
    g.restore();
    g.save();
    g.translate(100, 445);
    g.rotate(-Math.PI / 2);
    g.fillStyle = 'white';
    g.font = '42px sans-serif';
    g.textAlign = 'center';
    g.fillText('dynamic', 0, 0);
    g.restore();
  });
  // Thin hinged leaves in real openings. Local +Z is the outside of each wall.
  const serviceDoors = [];
  const serviceDoor = (parent, { name, label, labelEn, x, y = 1.5, z, width, height, side = 1 }) => {
    const hinge = new THREE.Group();
    hinge.name = name;
    hinge.position.set(x, y, z);
    parent.add(hinge);
    box(hinge, 0, side * width, 0, height, -0.14, 0, M.cab);
    for (const yy of [0.8, height - 0.8]) box(hinge, -0.09, 0.09, yy, yy + 0.35, -0.02, 0.12, M.steelD);
    const hx = side * (width - 0.35);
    box(hinge, hx - 0.07, hx + 0.07, height * 0.5 - 0.35, height * 0.5 + 0.35, 0.02, 0.15, M.black);
    const d = { hinge, label, labelEn, side, width, height, open: false, angle: 0 };
    serviceDoors.push(d);
    return d;
  };
  // Thin folded sheets, with matching mitres at the front/side corners.
  const sheet = (parent, rows, inward, mat = M.cab2) => {
    const positions = [],
      indices = [],
      uv = [],
      n = rows.length * 2;
    for (const offset of [[0, 0, 0], inward])
      for (const [i, row] of rows.entries())
        for (const [j, p] of row.entries()) {
          positions.push(...p.map((v, k) => v + offset[k]));
          uv.push(j, i / (rows.length - 1));
        }
    const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
    for (let i = 0; i < n - 2; i += 2) {
      quad(i, i + 2, i + 3, i + 1);
      quad(n + i + 1, n + i + 3, n + i + 2, n + i);
      quad(i, n + i, n + i + 2, i + 2);
      quad(i + 3, n + i + 3, n + i + 1, i + 1);
    }
    quad(0, 1, n + 1, n);
    quad(n - 2, 2 * n - 2, 2 * n - 1, n - 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const fascia = (parent, x0, x1, frontZ, apron = false) => {
    const lo = x0 <= -bodyHalf + 0.01 ? x0 + 1.8 : x0,
      hi = x1 >= bodyHalf - 0.01 ? x1 - 1.8 : x1;
    const rows = [
      [
        [x0, 7.4, frontZ],
        [x1, 7.4, frontZ],
      ],
      [
        [lo, 4.65, frontZ - 2.2],
        [hi, 4.65, frontZ - 2.2],
      ],
      [
        [lo, apron ? 2.65 : 4.45, frontZ - 2.2],
        [hi, apron ? 2.65 : 4.45, frontZ - 2.2],
      ],
    ];
    const mesh = sheet(parent, rows, [0, 0, -0.14]);
    mesh.name = apron ? 'sliding-door-lower-fold' : 'fixed-front-lower-fold';
    return mesh;
  };
  const ventTexture = tex(128, 256, (g, w, h) => {
    g.fillStyle = '#c9cdd1';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#252b30';
    for (let y = 5; y < h; y += 12) for (let x = 6; x < w; x += 13) g.fillRect(x, y, 6, 7);
  });
  const sideLength = front - rear;
  let rightServiceLeaf;
  for (const sign of [-1, 1]) {
    const wall = new THREE.Group();
    wall.position.x = sign * bodyHalf;
    wall.rotation.y = (sign * Math.PI) / 2;
    cabS.add(wall);
    wall.position.z = (front + rear) / 2;
    if (sign < 0) {
      const mid = (front + rear) / 2;
      box(wall, -sideLength / 2, drawerRear - mid, 1.2, 4.45, -1.95, -1.8, M.anth);
      box(wall, drawerFront - mid, sideLength / 2 - 2.2, 1.2, 4.45, -1.95, -1.8, M.anth);
      box(wall, drawerRear - mid, drawerFront - mid, 3.35, 4.45, -1.95, -1.8, M.anth);
    } else box(wall, -sideLength / 2 + 2.2, sideLength / 2, 1.2, 4.45, -1.95, -1.8, M.anth);
    const sideRows = [
      [
        [sign * bodyHalf, 7.4, rear],
        [sign * bodyHalf, 7.4, front],
      ],
      [
        [sign * (bodyHalf - 1.8), 4.65, rear],
        [sign * (bodyHalf - 1.8), 4.65, front - 2.2],
      ],
      [
        [sign * (bodyHalf - 1.8), 4.45, rear],
        [sign * (bodyHalf - 1.8), 4.45, front - 2.2],
      ],
    ];
    if (sign > 0) sideRows.forEach((row) => row.reverse());
    const sideFold = sheet(cabS, sideRows, [-sign * 0.14, 0, 0]);
    sideFold.name = sign < 0 ? 'left-side-lower-fold' : 'right-side-lower-fold';

    box(wall, -sideLength / 2, sideLength / 2, P.roof - 0.15, P.roof, -0.22, 0, M.cab);
    // Service access is behind the work area; the front flank stays fixed
    // for the heat exchanger and HMI. No leaf sweeps through those fittings.
    const endZ = 0.4,
      midZ = (front + rear) / 2,
      centreX = sign * (midZ - (rear + endZ) / 2),
      span = endZ - rear,
      width = span / 2 - 0.12;
    let frontServiceLeaf;
    for (const side of [-1, 1]) {
      const d = serviceDoor(wall, {
        name: `service-${sign < 0 ? 'left' : 'right'}-${side}`,
        label: sign < 0 ? 'Ľavé servisné dvere' : 'Pravé servisné dvere',
        labelEn: sign < 0 ? 'Left service door' : 'Right service door',
        x: centreX + side * (span / 2 - 0.06),
        y: 7.44,
        z: 0.01,
        width,
        height: P.roof - 7.64,
        side: -side,
      });
      if (side === -sign) {
        frontServiceLeaf = d.hinge;
        if (sign > 0) rightServiceLeaf = d.hinge;
      }
      for (const seamY of [3.2, 11.92]) box(d.hinge, 0, -side * width, seamY, seamY + 0.035, 0, 0.012, M.steelD);
      if (sign < 0) {
        if (side < 0) {
          // Tall folded cooling cover on the rear left service leaf.
          // The annotated photo shows a smooth recessed face, not a flat wall.
          const cover = new THREE.Group();
          cover.name = 'left-service-cooling-cover';
          cover.position.set(width / 2, 1.15, 0.2);
          d.hinge.add(cover);
          profile(
            cover,
            [
              [-2.5, 0.3],
              [-2.2, 0],
              [2.2, 0],
              [2.5, 0.3],
              [2.5, 11.9],
              [2.05, 12.4],
              [-2.1, 12.6],
              [-2.5, 12.2],
            ],
            0,
            0.7,
            M.cab,
            0.09,
          ).name = 'left-cooling-folded-shell';
          profile(
            cover,
            [
              [-0.25, 1],
              [1.82, 1],
              [2.12, 1.32],
              [2.12, 11.45],
              [1.76, 11.9],
              [-0.25, 12.1],
            ],
            0.73,
            0.045,
            M.cab2,
            0.06,
          ).name = 'left-cooling-recessed-face';
          box(cover, -2.12, -0.45, 5.4, 5.9, 0.805, 0.835, M.black).name = 'left-cooling-label-band';
          for (let i = 0; i < 7; i++) box(cover, -2.12, -1.73, 3.2 + i * 0.3, 3.37 + i * 0.3, 0.805, 0.83, M.steelD);
          bolts(
            cover,
            [
              [-2.25, 0.55, 0.835],
              [2.25, 0.55, 0.835],
              [-2.25, 12.1, 0.835],
              [2.15, 11.9, 0.835],
            ],
            0.045,
          );
        }
      }
    }
    // Fixed front flank: a real glazed opening on BOTH sides, above the cooler.
    const x0 = Math.min(sign * (midZ - front), sign * (midZ - endZ)),
      x1 = Math.max(sign * (midZ - front), sign * (midZ - endZ));
    const skin = new THREE.Shape();
    skin.moveTo(x0, 7.4);
    skin.lineTo(x1, 7.4);
    skin.lineTo(x1, P.roof - 0.15);
    skin.lineTo(x0, P.roof - 0.15);
    skin.closePath();
    const outline = [
      [2.1, 20.1],
      [5.5, 18.95],
      [5.5, 13.6],
      [2.1, 13.6],
    ].map(([z, y]) => [sign * (midZ - z), y]);
    const hole = new THREE.Path();
    outline.forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)));
    hole.closePath();
    skin.holes.push(hole);
    const skinGeometry = new THREE.ExtrudeGeometry(skin, { depth: 0.22, bevelEnabled: false });
    skinGeometry.translate(0, 0, -0.22);
    const flank = new THREE.Mesh(skinGeometry, M.cab);
    flank.name = `${sign < 0 ? 'left' : 'right'}-windowed-flank`;
    wall.add(flank);
    const pane = new THREE.Shape();
    outline.forEach(([x, y], i) => (i ? pane.lineTo(x, y) : pane.moveTo(x, y)));
    pane.closePath();
    const glass = new THREE.Mesh(
      new THREE.ExtrudeGeometry(pane, { depth: 0.04, bevelEnabled: false }),
      M.glass.clone(),
    );
    glass.material.opacity = 0.2;
    glass.material.depthWrite = false;
    glass.material.roughness = 0.12;
    glass.material.metalness = 0.05;
    glass.material.color.setHex(0x273b43);
    glass.position.z = -0.09;
    glass.name = `${sign < 0 ? 'left' : 'right'}-side-inspection-glass`;
    wall.add(glass);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      rod(wall, [a[0], a[1], 0.018], [b[0], b[1], 0.018], 0.045, M.black);
    }
    for (const x of [centreX - span / 2, centreX, centreX + span / 2]) {
      box(wall, x - 0.025, x + 0.025, 7.4, P.roof, -0.22, 0.006, M.steelD);
      bolts(
        wall,
        [
          [x - 0.12, 19.58, 0.025],
          [x + 0.12, 19.58, 0.025],
          [x - 0.12, P.roof - 0.25, 0.025],
        ],
        0.04,
      );
    }
    if (sign > 0) box(wall, centreX - span / 2, centreX + span / 2, 19.36, 19.4, -0.1, 0.008, M.steelD);
    const sideLogo = face(wall, logo.tx, 4.8, 1.2, sign * (midZ + 3.4), 22.1, 0.03);
    sideLogo.name = `${sign < 0 ? 'left' : 'right'}-hermle-logo`;
    sideLogo.material.transparent = true;
    frontServiceLeaf.attach(sideLogo);
    bolts(wall, [
      [-sideLength / 2 + 0.3, 7.7, 0.04],
      [sideLength / 2 - 0.3, 7.7, 0.04],
      [-sideLength / 2 + 0.3, 25.6, 0.04],
      [sideLength / 2 - 0.3, 25.6, 0.04],
    ]);
    box(cabS, sign * half, sign * bodyHalf, 7.4, P.roof, front - 0.25, front, M.cab);
    fascia(cabS, Math.min(sign * half, sign * bodyHalf), Math.max(sign * half, sign * bodyHalf), front);
  }
  // Photo: compact solid cover BELOW the side window, perforations at the top.
  const coolerGroup = new THREE.Group();
  cabS.add(coolerGroup);
  const exchanger = box(coolerGroup, bodyHalf, bodyHalf + 0.85, 7.6, 12.7, -5.8, -1.2, M.cab2);
  exchanger.name = 'right-side-heat-exchanger';
  box(coolerGroup, bodyHalf + 0.85, bodyHalf + 0.9, 7.8, 12.1, -5.62, -1.38, M.cab).name = 'heat-exchanger-solid-front';
  face(coolerGroup, ventTexture.tx, 4.1, 0.45, bodyHalf + 0.915, 12.35, -3.5, Math.PI / 2);
  for (const z of [-5.57, -1.43])
    bolts(
      coolerGroup,
      [
        [bodyHalf + 0.93, 8, z],
        [bodyHalf + 0.93, 12, z],
      ],
      0.04,
      'x',
    );
  profile(
    coolerGroup,
    [
      [bodyHalf, 13.15],
      [bodyHalf + 0.85, 12.7],
      [bodyHalf, 12.7],
    ],
    -5.8,
    4.6,
    M.cab2,
  ).name = 'heat-exchanger-sloping-cap';
  const ventTop = face(coolerGroup, ventTexture.tx, Math.hypot(0.85, 0.45), 4.1, bodyHalf + 0.43, 12.96, -3.5);
  ventTop.rotation.z = -Math.atan(0.45 / 0.85);
  ventTop.rotateX(-Math.PI / 2);
  cabS.updateMatrixWorld(true);
  rightServiceLeaf.attach(coolerGroup);
  box(cabS, -bodyHalf, bodyHalf, 1.1, 1.35, rear, drawerRear, M.cab2);
  box(cabS, -bodyHalf, bodyHalf, 1.1, 1.35, drawerFront, front - 1.95, M.cab2);
  box(cabS, (CHIP_DRAWER.innerX + 0.3) * drawerScale, bodyHalf, 1.1, 1.35, drawerRear, drawerFront, M.cab2);
  box(cabS, -half, half, 1.35, 6.6, front - 2.45, front - 2.35, M.cab2);
  for (const y of [1.8, 2.5, 3.3, 4.1, 5.6, 6.2])
    box(cabS, -half, half, y, y + 0.045, front - 2.34, front - 2.29, M.steelD);
  bolts(
    cabS,
    [-half + 0.18, 0, half - 0.18].flatMap((x) => [1.8, 3.3, 6.2].map((y) => [x, y, front - 2.27])),
  );
  box(cabS, -bodyHalf, bodyHalf, P.roof - 0.35, P.roof, front - 0.55, front + 0.12, M.cab);
  box(cabS, -bodyHalf, bodyHalf, 1.2, P.roof, rear - 0.2, rear, M.cab);
  // Roof with a real aperture for the travelling ram and recessed concertina covers.
  for (const sign of [-1, 1]) box(cabS, sign * 6.5, sign * bodyHalf, P.roof - 0.3, P.roof, rear, front, M.cab);
  box(cabS, -6.5, 6.5, P.roof - 0.3, P.roof, 6.5, front, M.cab);
  box(cabS, -6.5, 6.5, P.roof - 0.3, P.roof, rear, -10.8, M.cab);
  for (const sign of [-1, 1])
    box(cabS, sign * (bodyHalf - 0.15), sign * bodyHalf, P.roof, P.roof + 0.15, rear, front, M.cab2);
  const frontLogo = face(cabS, logo.tx, 5.4, 1.35, -bodyHalf + 3.2, 20.6, front + 0.035);
  frontLogo.name = 'front-hermle-logo';
  frontLogo.material.transparent = true;
  const stripeX = bodyHalf - 1.6;
  const label = face(cabS, modelLabel.tx, 1.6, P.roof - 7.4, stripeX, (P.roof + 7.4) / 2, front + 0.04);
  label.name = 'fixed-model-stripe';
  label.material.transparent = true;
  const stripeFold = sheet(
    cabS,
    [
      [
        [stripeX - 0.3, 7.4, front + 0.045],
        [stripeX + 0.3, 7.4, front + 0.045],
      ],
      [
        [stripeX - 2.1, 4.65, front - 2.155],
        [stripeX - 1.5, 4.65, front - 2.155],
      ],
    ],
    [0, 0, -0.01],
    M.red,
  );
  stripeFold.name = 'model-stripe-lower-fold';
  // Upper door guide, drive belt, rollers, safety interlock and lower sill.
  for (const y of [1.55, P.roof - 0.65]) {
    const z = front - (y < 2 ? 2.2 : 0);
    box(cabS, -bodyHalf + 0.4, bodyHalf - 0.4, y - 0.14, y + 0.14, z + 0.08, z + 0.32, M.steelD);
    box(cabS, -bodyHalf + 0.4, bodyHalf - 0.4, y + 0.02, y + 0.08, z + 0.325, z + 0.36, M.steel);
  }
  for (let row = 0; row < 3; row++)
    box(cabS, -half, half, 1.8 + row * 0.34, 2.05 + row * 0.34, front - 2.35, front - 1.93, M.steel);
  box(cabS, -half, half, 7.15, 7.3, front - 0.9, front - 0.15, M.steel);
  box(cabS, half + 0.25, half + 1.25, P.roof - 0.45, P.roof + 0.02, front - 0.2, front + 0.2, M.red);
  box(cabS, half - 0.15, half + 0.15, P.roof - 0.8, P.roof - 0.55, front + 0.35, front + 0.55, M.black);
  const beacon = new THREE.Group();
  beacon.name = 'machine-status-beacon';
  beacon.position.set(bodyHalf - 0.55, P.roof, -0.7);
  cabS.add(beacon);
  cylY(beacon, 0.27, 0.27, 0, 0.1, 0, 0, M.steelD);
  cylY(beacon, 0.09, 0.09, 0.1, 0.75, 0, 0, M.steel);
  for (const [i, color] of [0x8eafa4, 0xddbe72, 0xc98481].entries()) {
    cylY(beacon, 0.2, 0.2, 0.75 + i * 0.38, 1.1 + i * 0.38, 0, 0, std(color, 0.27, 0.08), 24);
    cylY(beacon, 0.21, 0.21, 1.1 + i * 0.38, 1.13 + i * 0.38, 0, 0, M.steelD, 24);
  }
  const doors = [-1, 1].map((sign) => {
    const d = new THREE.Group();
    d.name = sign < 0 ? 'left-sliding-door' : 'right-sliding-door';
    cabS.add(d);
    d.userData.s = sign;
    const w = leaf / 2,
      windowW = leaf * 0.54,
      bottom = 2.65,
      top = P.roof - 0.35,
      wy0 = 7.8,
      wy1 = 18.8;
    const shape = new THREE.Shape();
    shape.moveTo(-w, 7.4);
    shape.lineTo(w, 7.4);
    shape.lineTo(w, top);
    shape.lineTo(-w, top);
    shape.closePath();
    // Mirror the inward step in the safety glass beside each handle.
    const edge = windowW / 2,
      notch = 0.32;
    const glassPoints = [
      [-edge, wy0],
      [edge - notch, wy0],
      [edge - notch, 11.7],
      [edge, 12.35],
      [edge, wy1],
      [-edge, wy1],
    ].map(([x, y]) => [-sign * x, y]);
    const aperture = new THREE.Path();
    glassPoints.forEach(([x, y], i) => (i ? aperture.lineTo(x, y) : aperture.moveTo(x, y)));
    aperture.closePath();
    shape.holes.push(aperture);
    const skin = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: false }), M.cab);
    skin.name = 'shaped-door-skin';
    skin.position.z = -0.14;
    skin.castShadow = true;
    d.add(skin);
    const glassShape = new THREE.Shape();
    glassPoints.forEach(([x, y], i) => (i ? glassShape.lineTo(x, y) : glassShape.moveTo(x, y)));
    glassShape.closePath();
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), M.glass.clone());
    glass.material.opacity = 0.34;
    glass.material.color.setHex(0x44605c);
    glass.material.side = THREE.DoubleSide;
    glass.name = 'door-safety-glass';
    glass.position.z = -0.1;
    d.add(glass);
    for (let i = 0; i < glassPoints.length; i++) {
      const a = glassPoints[i],
        b = glassPoints[(i + 1) % glassPoints.length];
      rod(d, [...a, 0.015], [...b, 0.015], 0.035, M.black);
    }
    fascia(d, -w, w, 0.14, true);
    const hx = -sign * (w - 0.22),
      points = [
        [hx, 8.5, 0.2],
        [hx + sign * 0.36, 9.2, 0.57],
        [hx + sign * 0.36, 11.8, 0.57],
        [hx, 12.5, 0.2],
      ];
    for (let j = 1; j < points.length; j++) rod(d, points[j - 1], points[j], 0.09, M.red);
    for (const y of [8.5, 12.5]) {
      box(d, hx - 0.13, hx + 0.13, y - 0.15, y + 0.15, 0.14, 0.28, M.black);
      bolts(d, [[hx, y, 0.29]]);
    }
    for (const y of [bottom + 0.3, top - 0.3])
      for (const x of [-w + 0.25, w - 0.25]) {
        const roller = cylY(d, 0.12, 0.12, -0.04, 0.04, 0, 0, M.steel);
        roller.rotation.x = Math.PI / 2;
        roller.position.set(x, y, y < 7.4 ? -2.4 : -0.2);
      }
    box(d, -sign * w - 0.025, -sign * w + 0.025, 7.4, top, -0.16, 0.16, M.black);
    rod(d, [-sign * w, 7.4, 0.14], [-sign * w, 4.65, -2.06], 0.025, M.black);
    box(d, -sign * w - 0.025, -sign * w + 0.025, bottom, 4.65, -2.2, -2.02, M.black);
    bolts(d, [
      [-w + 0.12, bottom + 0.15, -2.02],
      [w - 0.12, bottom + 0.15, -2.02],
      [-w + 0.12, top - 0.15, 0.2],
      [w - 0.12, top - 0.15, 0.2],
    ]);
    const glassMark = face(d, logo.tx, 0.38, 0.095, sign * (w - 0.48), 7.59, 0.151);
    glassMark.name = 'door-glass-marking';
    glassMark.material.transparent = true;
    return d;
  });
  // ---------------- ovládací panel TNC 640 (Hermle) na otočnom ramene ----------------
  const pan = grp('panel');
  const panBase = new THREE.Group();
  pan.add(panBase);
  // C42 ergonomics photograph: a single welded low arm rises into a box
  // column. Its crank is rigid; only the machine pivot and terminal swivel turn.
  const hmiBase = hmiPose(0, 0, bodyHalf, 1);
  const mounting = box(panBase, bodyHalf - 1.3, bodyHalf + 0.02, 1.65, 2.12, 3.48, 4.92, M.anth);
  mounting.name = 'HMI-fixed-mounting-bracket';
  bolts(
    panBase,
    [3.65, 4.75].map((z) => [bodyHalf - 1.08, 2.15, z]),
    0.085,
    'y',
  );
  cylY(panBase, 0.46, 0.46, 2.1, 3.05, ...hmiBase.base, M.steelD);
  const armPivot = new THREE.Group();
  armPivot.name = 'HMI-machine-pivot';
  armPivot.position.set(hmiBase.base[0], 0, hmiBase.base[1]);
  panBase.add(armPivot);
  const reach = HMI_ARM.reach;
  // Extruded side elevation: the straight run and rising end are one solid.
  const arm = profile(
    armPivot,
    [
      [0, 2.18],
      [-reach + 2.1, 2.18],
      [-reach, 4.08],
      [-reach, 4.92],
      [-reach + 2.3, 2.94],
      [0, 2.94],
    ],
    0,
    0.82,
    M.anth,
    0.035,
  );
  arm.name = 'HMI-rigid-cranked-arm';
  arm.rotation.y = Math.PI / 2;
  arm.position.x = -0.41;
  cylY(armPivot, 0.48, 0.48, 2.97, 3.06, 0, 0, M.steelD);
  bolts(armPivot, [[0, 3.085, 0]], 0.1, 'y');
  const column = new THREE.Group();
  column.name = 'HMI-column-assembly';
  column.position.z = reach;
  armPivot.add(column);
  const sleeve = box(column, -0.56, 0.56, 1.25, 8.05, -0.6, 0.6, M.anth);
  sleeve.name = 'HMI-terminal-column';
  box(column, -0.58, 0.58, 1.25, 1.4, -0.62, 0.62, M.steelD);
  box(column, -0.59, 0.59, 7.88, 8.1, -0.63, 0.63, M.steelD);
  box(column, -0.44, 0.44, 2, 7.45, 0.602, 0.63, M.anth).name = 'HMI-column-access-cover';
  bolts(
    column,
    [
      [-0.34, 2.2, 0.66],
      [0.34, 2.2, 0.66],
      [-0.34, 7.22, 0.66],
      [0.34, 7.22, 0.66],
    ],
    0.045,
  );
  cylY(column, 0.34, 0.34, 8.05, 9.55, 0, 0, M.brush, 48);
  cylY(column, 0.4, 0.4, 8.07, 8.24, 0, 0, M.black, 48);
  box(column, 0.55, 0.75, 7.55, 7.78, -0.15, 0.15, M.black);
  // Cable is protected underneath the beam; no fictitious elbow/slack loop.
  const cableCurve = new THREE.CatmullRomCurve3([
    v3(0.2, 2.12, 0),
    v3(0.3, 2.04, 0.6),
    v3(0.3, 2.04, reach - 2.3),
    v3(0.3, 3.8, reach - 0.4),
  ]);
  const armCable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 32, 0.055, 8, false), M.black);
  armCable.name = 'HMI-arm-cable';
  armPivot.add(armCable);
  for (const z of [1.2, 4, 7]) box(armPivot, 0.2, 0.4, 1.98, 2.21, z - 0.06, z + 0.06, M.steelD);
  const panG = new THREE.Group();
  panG.position.z = reach;
  armPivot.add(panG);
  cylY(panG, 0.52, 0.52, 9.38, 9.55, 0, 0, M.steelD, 48);
  const hmi = createHmiPanel(panG, M, tex),
    sm = hmi.display;
  // Folded stainless chip troughs, linear guide shoes and fastened ram panels.
  for (const sign of [-1, 1]) {
    const trough = profile(
      bed,
      [
        [sign * 3.9, 5.6],
        [sign * 6.9, 7.5],
        [sign * 6.9, 7.62],
        [sign * 3.9, 5.72],
      ],
      -3.1,
      6.1 / K + 3.1,
      M.inox,
    );
    trough.name = 'recessed-side-chip-trough';
    box(bed, sign * 3.85, sign * 4.35, 5.5, 5.62, -3.1, 6.1 / K, M.dark);
    const lining = box(bed, sign * 6.65, sign * 6.78, 7.4, 19.9, -3.3, 1.7 / K, M.inox);
    lining.name = 'stainless-workspace-lining';
    box(bed, sign * 6.65, sign * 6.78, 7.4, 12.7, 1.7 / K, 3.2, M.inox).name = 'stainless-workspace-lining';
    for (const z of [-0.95, 0.95]) box(yS, sign * 7.45, sign * 8.7, 20.7, 21.35, z - 0.4, z + 0.4, M.steelD);
    for (const y of [3, 6, 9, 11.8]) bolts(zS, [[sign * 1.1, y, 1.93]], 0.04);
    rod(sp, [sign * 0.72, 1.2, 0.5], [sign * 0.68, 0.3, 0.75], 0.055, M.black);
    cylY(sp, 0.085, 0.06, 0.15, 0.3, sign * 0.68, 0.75, M.steel);
  }
  box(zS, -1.25, 1.25, 7.1, 7.16, 1.901, 1.94, M.steelD);
  box(zS, -1.22, 1.22, 1.05, 7.05, 1.9, 1.92, M.cab2);
  box(zS, -1.22, 1.22, 7.22, 12.8, 1.9, 1.92, M.cab2);
  // Upper Z motor cap and cable carrier follow X/Y; Z ram slides through it.
  box(xS, -1.6, 1.6, P.roof - 0.1, P.height - 2.2, -1.65, 1.4, M.cab);
  box(xS, -2.4, 2.4, P.height - 2.2, P.height, -1.8, 2.1, M.cab2);
  bolts(xS, [
    [-2.1, P.height - 0.25, 2.12],
    [2.1, P.height - 0.25, 2.12],
    [-2.1, P.height - 1.9, 2.12],
    [2.1, P.height - 1.9, 2.12],
  ]);
  const cableChain = new THREE.Group();
  cableChain.name = 'Z-cable-carrier';
  xS.add(cableChain);
  const curve = new THREE.CatmullRomCurve3([
    v3(0, P.height - 0.05, -1.2),
    v3(0, P.height - 0.1, -2.4),
    v3(0, P.roof + 1.6, -6.5),
    v3(0, P.roof + 0.3, -6.1),
  ]);
  for (let i = 0; i < 28; i++) {
    const mesh = box(cableChain, -0.65, 0.65, -0.17, 0.17, -0.22, 0.22, M.black);
    mesh.position.copy(curve.getPoint(i / 27));
    mesh.quaternion.setFromUnitVectors(v3(0, 1, 0), curve.getTangent(i / 27).normalize());
  }
  // Roof bellows move with the crossbeam, staying attached at front/rear.
  const roofCovers = [0, 1].map(() => {
    const mesh = box(cabS, -6.5, 6.5, -0.09, 0.09, -0.5, 0.5, M.anth);
    mesh.position.y = P.roof - 0.22;
    return mesh;
  });
  M.lamp = std(0xffffff, 0.3, 0, { emissive: 0xffffff, emissiveIntensity: 0.5 });
  for (const sign of [-1, 1]) {
    box(cabS, sign * 5.2 - 0.24, sign * 5.2 + 0.24, 20.4, 20.7, -1.8, 3.6, M.steelD);
    box(cabS, sign * 5.2 - 0.17, sign * 5.2 + 0.17, 20.35, 20.4, -1.6, 3.4, M.lamp);
  }
  // Two rear electrical-cabinet doors swing out into the service aisle.
  const rearWorld = 8.9 - P.depth,
    rearWidth = serviceHalf * K,
    rearHeight = serviceTop - 1.8;
  const rearFrame = new THREE.Group();
  rearFrame.position.z = rearWorld - 0.04;
  rearFrame.rotation.y = Math.PI;
  cab.add(rearFrame);
  for (const sign of [-1, 1]) {
    const d = serviceDoor(rearFrame, {
      name: `rear-service-${sign}`,
      label: 'Zadné servisné dvere',
      labelEn: 'Rear service door',
      x: sign * (rearWidth - 0.03),
      y: 1.5,
      z: 0,
      width: rearWidth - 0.06,
      height: rearHeight,
      side: -sign,
    });
    face(d.hinge, ventTexture.tx, 2.9, 2.2, (-sign * rearWidth) / 2, 3.5, 0.025);
    if (sign > 0) {
      box(d.hinge, (-sign * rearWidth) / 2 - 0.4, (-sign * rearWidth) / 2 + 0.4, 10, 10.8, 0.02, 0.13, M.yellow);
      rod(d.hinge, [(-sign * rearWidth) / 2, 10.15, 0.2], [(-sign * rearWidth) / 2, 10.7, 0.2], 0.1, M.red);
    }
  }
  serviceDoors.push(...accessories.serviceDoors);
  const updateServiceDoors = (dt) =>
    serviceDoors.forEach((d) => {
      if (d.enabled && !d.enabled()) d.open = false;
      const target = d.open ? (-d.side * Math.PI) / 2 : 0;
      d.angle = THREE.MathUtils.damp(d.angle, target, 5, dt);
      d.hinge.rotation.y = d.angle;
    });
  const serviceOpen = () =>
    serviceDoors.some((d) => (!d.enabled || d.enabled()) && (d.open || Math.abs(d.angle) > 0.01));
  let lastBellowsX = NaN;
  const updateAxes = () => {
    const xc = xG.position.x / K;
    if (xc === lastBellowsX) return;
    lastBellowsX = xc;
    for (const { mesh, sign, folds } of bellows) {
      const edge = xc + sign * 1.32,
        positions = mesh.geometry.attributes.position;
      for (let i = 0; i <= folds; i++) {
        const u = i / folds,
          z = 1.91 + (i % 2 ? 0.06 : 0);
        const lower = sign < 0 ? THREE.MathUtils.lerp(-6.83, edge, u) : THREE.MathUtils.lerp(edge, 6.83, u);
        const upper = sign < 0 ? THREE.MathUtils.lerp(-8.56, edge, u) : THREE.MathUtils.lerp(edge, 8.56, u);
        positions.setXYZ(i * 2, lower, 17.19, z);
        positions.setXYZ(i * 2 + 1, upper, 23.08, z);
      }
      positions.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
    }
  };
  updateAxes();
  const updateGeometry = ({ doorK, panelA = 0, panelYaw = 0 }) => {
    doors.forEach((d) => d.position.set(d.userData.s * (leaf / 2 + (doorK * opening) / 2), 0, front + 0.54));
    const pose = hmiPose((panelA * 180) / Math.PI, (panelYaw * 180) / Math.PI, bodyHalf, 1);
    armPivot.rotation.y = pose.angle;
    panG.rotation.y = pose.yaw - pose.angle;
    const centre = yG.position.z,
      limits = [
        [-10.8, centre - 2],
        [centre + 2, 6.5],
      ];
    roofCovers.forEach((mesh, i) => {
      const [lo, hi] = limits[i];
      mesh.scale.z = Math.max(0.01, hi - lo);
      mesh.position.z = (hi + lo) / 2;
    });
  };
  updateGeometry({ doorK: 1 });
  const lighting = {
    scale: 1,
    halfWidth: bodyHalf,
    workHeight: 9.5,
    bounds: [
      [-bodyHalf + 0.3, 5.8, rear + 0.3],
      [bodyHalf - 0.3, P.roof - 0.1, front - 0.25],
    ],
    lampPositions: [
      [-5.2, 20.3, 1],
      [5.2, 20.3, 1],
    ],
  };
  const anchorOverrides = {
    kabina: () => v3(-bodyHalf + 1, P.roof - 0.5, front),
    lozko: () => v3(bodyHalf - 1, 3, 7.8),
    osi: () => v3(8.6 * K, 22.8, yG.position.z),
    stol: () => v3(-5 * K, PY - 2, 2),
    panel: () => new THREE.Vector3(0, 15, 0).applyMatrix4(panG.matrixWorld),
  };
  const viewOverrides = {
    celok: () =>
      Object.values(accessories.equipment).some((g) => g.visible)
        ? [[-65, 43, 60], [-8, 13, -7], false]
        : [[39, 28, 46], [0, 13, -4], false],
    panel: () => {
      const p = new THREE.Vector3(0, 9.1, -2.6).applyMatrix4(panG.matrixWorld),
        direction = new THREE.Vector3(12, 4, 18).transformDirection(panG.matrixWorld).multiplyScalar(37);
      return [p.clone().add(direction).toArray(), p.toArray(), true];
    },
    vybavenie: () =>
      Object.values(accessories.equipment).some((g) => g.visible)
        ? [[-54, 27, 35], [-25, 7, -10], false]
        : [[-49, 31, 32], [-7, 12, -5], false],
    lavy: () => [[-48, 24, 15], [-6, 14, -3], false],
    pravy: () => [[48, 24, 15], [6, 14, -3], false],
    spredu: () => [[0, 16, 48], [0, 14, 0], false],
    zhora: () => [[0.01, 78, -6], [0, 9, -6], true],
  };
  // Hundreds of immobile jaws, screws and teeth share a handful of draw calls.
  // Pocket groups remain separate so tool loading/indexing keeps its real poses.
  for (const group of [magG, drum, saddle]) batchStaticMeshes(group);
  return {
    cradleReady,
    serviceDoors,
    updateServiceDoors,
    serviceOpen,
    profile: P,
    doorTravel: opening / 2,
    updateGeometry,
    updateAxes,
    lighting,
    viewOverrides,
    anchorOverrides,
    cab,
    aG,
    cG,
    yG,
    xG,
    zG,
    sp,
    toolG,
    buildTool,
    pockets,
    magG,
    driveShaft,
    saddle,
    magY,
    magZ,
    panG,
    armPivot,
    hmi,
    sm,
    covers,
    clampPins,
    doors,
    loadMagazine,
    accessories,
  };
}

function batchStaticMeshes(group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert(),
    byMaterial = new Map(),
    meshes = [];
  group.traverse((mesh) => {
    if (mesh.isMesh && !Array.isArray(mesh.material)) meshes.push(mesh);
  });
  for (const mesh of meshes) {
    const transform = inverse.clone().multiply(mesh.matrixWorld),
      copies = [];
    if (mesh.isInstancedMesh) {
      for (let i = 0; i < mesh.count; i++) {
        const instance = new THREE.Matrix4();
        mesh.getMatrixAt(i, instance);
        copies.push(transform.clone().multiply(instance));
      }
    } else copies.push(transform);
    const list = byMaterial.get(mesh.material) || [];
    for (const matrix of copies) {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(matrix);
      list.push(geometry);
    }
    byMaterial.set(mesh.material, list);
    mesh.removeFromParent();
    mesh.geometry.dispose();
    if (mesh.isInstancedMesh) mesh.dispose();
  }
  for (const [material, parts] of byMaterial) {
    const merged = mergeGeometries(parts),
      mesh = new THREE.Mesh(merged, material);
    mesh.name = 'batched-static-detail';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    parts.forEach((g) => g.dispose());
  }
}
