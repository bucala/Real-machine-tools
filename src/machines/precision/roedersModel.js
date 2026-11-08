import * as THREE from 'three';
import { modelKit } from './modelKit';
import { createRoedersCover } from './roedersCover';
import { createRoedersDetails } from './roedersDetails';
import { createRmsPanel } from './rmsPanel';
import { createToolModel } from '../cnc/toolModel';
import { RXU_LAYOUT as L, RXU_PLAN } from './roedersLayout';

// RXU 1001 DSH: exterior p58, A/C sections p58–59, related base-machine plan p57.
// Sheet metal is a photographic reconstruction. Keep it separate from the CNC datum.
export function createRoedersModel({ root, G, M, tex, MC, PY }) {
  const { group, box, cyl, rod, label, bolts, clear } = modelKit(root, M, tex);
  const part = (k, parent = root) => {
    const g = group(k, parent);
    g.userData.part = k;
    G[k] = g;
    return g;
  };
  M.red.color.setHex(0x9d182f).convertSRGBToLinear();
  M.lamp = new THREE.MeshStandardMaterial({ color: 0xeaf5ff, emissive: 0xeaf5ff, emissiveIntensity: 3 });
  M.brush = M.inox;
  M.yellow = new THREE.MeshStandardMaterial({ color: 0xf4c32b });
  M.bellows = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.92, metalness: 0.08 });
  M.bellows.color.convertSRGBToLinear();
  const shape = (points, holes = []) => {
    const s = new THREE.Shape(points.map((p) => new THREE.Vector2(...p)));
    holes.forEach((h) => s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(...p)))));
    return s;
  };
  const plate = (parent, name, points, depth, mat, holes = [], bevel = 0.035) => {
    const o = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape(points, holes), {
        depth,
        steps: 1,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 1,
        curveSegments: 16,
      }),
      mat,
    );
    o.name = name;
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const footprint = (p, name, points, y, h, mat) => {
    // Shape's Y maps to -world Z after rotating the extrusion into the floor.
    const o = plate(
      p,
      name,
      points.map(([x, z]) => [x, -z]),
      h,
      mat,
      [],
      0,
    );
    o.rotation.x = -Math.PI / 2;
    o.position.y = y;
    return o;
  };
  // Explicit flat folds: unlike rotated boxes these share their arrises exactly,
  // and a triangular end can converge to a single tip without a square end cap.
  const foldedShell = (parent, name, vertices, faces, mat = M.cab) => {
    const positions = [];
    for (const face of faces)
      for (let i = 1; i < face.length - 1; i++) {
        for (const j of [face[0], face[i], face[i + 1]]) positions.push(...vertices[j]);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const tube = (p, points, r = 0.06, mat = M.black) => {
    const path = new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(...v)));
    const o = new THREE.Mesh(new THREE.TubeGeometry(path, 32, r, 8, false), mat);
    o.castShadow = true;
    p.add(o);
    return o;
  };
  const rim = (p, points, mat = M.dark, r = 0.045) => {
    for (let i = 0; i < points.length; i++) rod(p, points[i], points[(i + 1) % points.length], r, mat);
  };
  const bed = part('lozko');
  // The stepped front plinth and the L-shaped rear service spine follow the plan.
  footprint(
    bed,
    'stepped-burgundy-plinth',
    RXU_PLAN.slice(0, 2).concat([
      [10.95, -22.8],
      [-16.1, -22.8],
      [-16.1, -0.5],
      [-10.95, -0.5],
    ]),
    0.8,
    6.25,
    M.red,
  );
  footprint(bed, 'base-shadow-gap', RXU_PLAN, 0.5, 0.25, M.black);
  for (const [x, z] of [
    [-9, 8],
    [9, 8],
    [-14, -18],
    [9, -19],
    [8, -34],
  ]) {
    cyl(bed, x, 0.22, z, 0.55, 0.4, M.steelD);
    cyl(bed, x, 0.6, z, 0.24, 0.5, M.steelD);
  }
  for (const y of [1.7, 5.7])
    for (const x of [-9, -5, 0, 5, 9]) cyl(bed, x, y, L.front + 0.025, 0.055, 0.04, M.steelD, 'z');
  box(bed, 0, 7.13, 10.95, 22.3, 0.13, 0.65, M.red);

  // The work station is offset towards the front-left loading bay. Move the
  // complete frame (stock, trunnion, spindle and axes) together, so the CNC datum
  // remains coincident with the visible fixture. A is along the two bearing centres.
  const machiningFrame = group('RXU-machining-frame');
  machiningFrame.position.set(...L.workCentre);
  const structure = group('mineral-cast-support', machiningFrame);
  structure.userData.part = 'lozko';
  box(structure, 0, 8.0, 0, 14, 1.5, 12.7, M.anth);
  // Sloped stainless collection floor, with two screw channels at the edges.
  for (const z of [-4.4, 4.4]) {
    const chute = box(structure, 0, 8.35, z, 13, 0.1, 2.8, M.inox);
    chute.rotation.x = z < 0 ? -0.28 : 0.28;
    cyl(structure, 0, 7.8, z, 0.28, 13, M.steelD, 'x');
  }
  const aG = group('A-cradle', part('stol', machiningFrame));
  aG.position.y = PY;
  const cG = group('C-direct-drive', aG);
  cG.position.y = -MC.hA * 0.01;
  const tableOutline = [],
    flatAngle = Math.asin(2.6 / 3);
  for (let i = 0; i <= 32; i++) {
    const a = -flatAngle + (i * 2 * flatAngle) / 32;
    tableOutline.push([Math.cos(a) * 3, Math.sin(a) * 3]);
  }
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI - flatAngle + (i * 2 * flatAngle) / 32;
    tableOutline.push([Math.cos(a) * 3, Math.sin(a) * 3]);
  }
  const tableFace = plate(cG, '600mm-table-with-two-flats', tableOutline, 0.4, M.table, [], 0);
  tableFace.rotation.x = -Math.PI / 2;
  tableFace.position.y = -0.4;
  for (const z of [-2, -1, 0, 1, 2]) box(cG, 0, 0.008, z, Math.sqrt(9 - z * z) * 2 - 0.12, 0.018, 0.085, M.steelD);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    cyl(cG, Math.cos(a) * 2.65, 0.015, Math.sin(a) * 2.65, 0.045, 0.025, M.black);
  }
  cyl(cG, 0, 0.1, 0, 0.47, 0.2, M.steelD);
  cyl(cG, 0, 0.35, 0, 0.35, 0.3, M.anth);
  const clampPins = [0, 1, 2].map((i) => {
    const g = group('clamp', cG);
    g.rotation.y = (i * Math.PI * 2) / 3;
    return box(g, 0, 0.35, 0.35, 0.12, 0.12, 0.16, M.steel);
  });

  const ax = part('osi', machiningFrame),
    yG = group('Y-carrier', ax),
    xG = group('X-saddle', yG),
    zG = group('Z-quadroguide', xG);
  // Four corner rails and two carriages per rail. The upper portal fits UNDER the roof.
  for (const x of [-6.8, 6.8]) {
    box(ax, x, 21.9, 0, 1.2, 3.8, 13, M.anth);
    plate(
      ax,
      'fixed-guideway-shroud',
      [
        [x - 0.7, 24.1],
        [x + 0.7, 24.1],
        [x + 0.7, 20.1],
        [x + 0.3, 19.7],
        [x - 0.7, 20.1],
      ],
      13.1,
      M.cab2,
      [],
      0.025,
    ).position.z = -6.55;
    for (const dx of [-0.36, 0.36]) box(ax, x + dx, 24, 0, 0.17, 0.2, 12.8, M.steel);
  }
  for (const z of [-2.1, 2.1]) box(yG, 0, 24.35, z, 14.9, 0.65, 0.5, M.cab2);
  for (const x of [-7.1, 7.1]) box(yG, x, 24.35, 0, 0.7, 0.65, 4.7, M.cab2);
  for (const z of [-1.9, 1.9]) box(yG, 0, 24.78, z, 14.6, 0.16, 0.2, M.steel);
  for (const x of [-1.6, 1.6]) box(xG, x, 22.6, 0, 0.6, 4.1, 3.8, M.cab2);
  for (const z of [-1.6, 1.6]) box(xG, 0, 22.6, z, 2.6, 4.1, 0.6, M.cab2);
  box(zG, 0, 4.35, 0, 2.35, 7.0, 2.35, M.cab);
  for (const x of [-1.2, 1.2])
    for (const z of [-1.2, 1.2]) {
      box(zG, x, 4.35, z, 0.14, 7.0, 0.14, M.steel);
      for (const y of [20.95, 22.2]) box(xG, x, y, z, 0.4, 0.55, 0.4, M.steelD);
    }
  const sp = group('HSK-A63', zG);
  sp.userData.part = 'vreteno';
  G.vreteno = sp;
  box(sp, 0, 1.15, 0, 2.5, 0.75, 2.5, M.cab);
  cyl(sp, 0, 0.53, 0, 0.76, 0.75);
  cyl(sp, 0, 0.13, 0, 0.56, 0.26, M.steelD);
  for (const y of [0.25, 0.45, 0.65]) cyl(sp, 0, y, 0, 0.78, 0.045, M.steelD);
  for (const x of [-1.05, 1.05]) {
    cyl(sp, x, 0.6, 0.6, 0.12, 0.6, M.steelD);
    tube(
      sp,
      [
        [x, 1.1, 0.6],
        [x * 0.9, 0.5, 0.85],
        [x * 0.5, 0.03, 0.6],
      ],
      0.055,
      M.dark,
    );
  }
  const toolG = group('tool', sp),
    buildTool = (t) => {
      clear(toolG);
      if (t) toolG.add(createToolModel(t, M));
    };
  // Telescopic stainless way covers, not a wall of exposed vertical fins.
  const covers = [];
  for (const s of [-1, 1])
    for (let i = 0; i < 9; i++) {
      const fold = box(yG, 0, 22.15, -0.2, 0.4, 0.07, 6.9, M.bellows);
      fold.rotation.x = 0.528;
      fold.name = 'sloped-gantry-bellows';
      fold.userData = { side: s, index: i };
      covers.push(fold);
    }
  const chain = group('Y-energy-chain', ax);
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    box(chain, -6.1, 25 + Math.sin(t * Math.PI) * 0.9, -5.2 + t * 10, 0.45, 0.23, 0.39, M.black);
  }
  const backLiner = group('sloped-workspace-liner', structure);
  const liner = plate(
    backLiner,
    'rear-stainless-bulkhead',
    [
      [-6.6, 8.8],
      [-6.6, 19.9],
      [-3.5, 23.6],
      [3.5, 23.6],
      [6.6, 19.9],
      [6.6, 8.8],
    ],
    0.12,
    M.cab2,
  );
  liner.position.z = -5.3;
  for (const s of [-1, 1]) rod(backLiner, [s * 6.4, 9, -5.1], [s * 2.4, 23.3, -5.1], 0.055, M.steelD);

  // Standard rear rotary magazine. The transfer carriage brings its selected holder
  // to the spindle; its undocumented internal linkage is an illustrative reconstruction.
  const mag = part('zasobnik'),
    magY = PY + (MC.nose[1] - 80) * 0.01,
    magZ = -15.4,
    magX = L.workCentre[0];
  box(mag, magX, 11.8, magZ, 9, 9.2, 8.5, M.anth);
  for (const x of [magX - 2.8, magX + 2.8]) box(mag, x, magY - 2.2, magZ, 0.8, 4.4, 7, M.steelD);
  const magG = group('24-pocket-carousel', mag);
  magG.position.set(magX, magY, magZ);
  cyl(magG, 0, -0.2, 0, 3.6, 0.4, M.steelD);
  cyl(magG, 0, 0.1, 0, 0.65, 0.6, M.steel);
  const driveShaft = group('carousel-shaft', mag);
  driveShaft.position.copy(magG.position);
  cyl(driveShaft, 0, -1.2, 0, 0.28, 2.9, M.steel);
  const pockets = [];
  for (let i = 0; i < MC.mag; i++) {
    const a = (i * Math.PI * 2) / MC.mag,
      g = group(`T${i + 1}`, magG);
    g.position.set(Math.sin(a) * 3.6, 0, Math.cos(a) * 3.6);
    g.rotation.y = a;
    for (const x of [-0.23, 0.23]) box(g, x, 0, 0, 0.07, 0.12, 0.48, M.red);
    box(g, 0, 0, -0.22, 0.52, 0.12, 0.07, M.red);
    pockets.push(group('holder', g));
  }
  const loadMagazine = (tls) =>
    pockets.forEach((g, i) => {
      clear(g);
      const t = tls.find((t) => t.t === i + 1);
      if (t) g.add(createToolModel(t, M));
    });
  const transferX = L.workCentre[0],
    transferZ = L.workCentre[2] - MC.tcY * 0.01;
  const saddle = group('tool-transfer-carriage', mag);
  saddle.position.set(transferX, magY, -11.8);
  box(saddle, 0, 0.45, 0, 1.1, 0.45, 1.1, M.steelD);
  const transferTool = group('transfer-holder', saddle);
  let transferT = 0;
  for (const s of [-1, 1]) box(saddle, s * 0.31, 0, 0, 0.12, 0.13, 0.75, M.red);
  for (const x of [transferX - 0.6, transferX + 0.6])
    rod(mag, [x, magY + 0.7, -12], [x, magY + 0.7, transferZ], 0.085, M.steel);
  for (const z of [-12, transferZ]) box(mag, transferX, magY + 1.3, z, 1.9, 1.1, 0.25, M.anth);

  const cab = part('kabina');
  const wall = (x, y, z, w, h, d, mat = M.cab) => box(cab, x, y, z, w, h, d, mat);
  const shoulderCentre = (L.shoulderLeft + L.right) / 2,
    shoulderWidth = L.right - L.shoulderLeft;
  wall(L.shoulderLeft, 21.3, -11.65, 0.16, 28.1, 22.3);
  // The continuous side skin and its hatch opening are built with the cover.
  const rightGlass = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.5), M.glass);
  rightGlass.rotation.y = Math.PI / 2;
  rightGlass.position.set(11.09, 12.75, -5.1);
  rightGlass.name = 'right-service-inspection-window';
  cab.add(rightGlass);
  for (const z of [-7.2, -3]) box(cab, 11.08, 12.75, z, 0.09, 5.8, 0.12, M.steelD);
  for (const y of [10, 15.5]) box(cab, 11.08, y, -5.1, 0.09, 0.12, 4.35, M.steelD);
  box(cab, 11.18, 12.2, -2.6, 0.13, 1, 0.18, M.black);
  for (const y of [10.2, 15.3]) box(cab, 11.17, y, -7.4, 0.2, 0.35, 0.2, M.steelD);
  label(cab, 'CAUTION', 11.2, 15.2, -5.1, 1.25, 0.24, {
    rotate: Math.PI / 2,
    color: '#2c3035',
    background: '#e5ce38',
    size: 110,
  });
  wall(shoulderCentre, 21.3, -22.8, shoulderWidth, 28.1, 0.16);
  for (const y of [9, 17, 26, 34]) for (const z of [-21, -12, -2]) cyl(cab, -16.21, y, z, 0.04, 0.04, M.steelD, 'x');
  label(cab, 'röders TEC', -16.21, 23, -5, 3.1, 1, { rotate: -Math.PI / 2, background: '#e6e8ea', size: 45 });
  const spineW = L.right - L.rearSpineLeft,
    spineZ = (L.rear + L.shoulderRear) / 2;
  wall((L.right + L.rearSpineLeft) / 2, 12.75, spineZ, spineW, 23.5, L.shoulderRear - L.rear, M.cab2);
  wall(
    (L.right + L.rearCrossLeft) / 2,
    12.75,
    (L.rear + L.rearCrossFront) / 2,
    L.right - L.rearCrossLeft,
    23.5,
    L.rearCrossFront - L.rear,
    M.cab,
  );
  // Two cabinet cooling modules and the large extraction duct visible in the rear photos.
  for (const z of [-17.4, -21.8]) {
    box(cab, 11.85, 29.1, z, 1.75, 4.6, 3.3, M.cab2);
    box(cab, 12.75, 29.1, z, 0.08, 4.1, 2.9, M.cab);
    for (let i = 0; i < 10; i++) box(cab, 12.81, 27.7 + i * 0.28, z, 0.05, 0.055, 2.3, M.steelD);
    box(cab, 12.83, 30.5, z, 0.07, 0.6, 1.1, M.dark);
  }
  tube(
    cab,
    [
      [5.2, 30.2, -22.9],
      [5.2, 30.7, -25.5],
      [5.2, 26.0, -28.7],
      [5.2, 24.6, -30.0],
    ],
    0.63,
    M.steelD,
  );
  // Service seams/handles on both exposed faces of the electrical cabinet.
  for (const z of [-25.5, -30.8, -34.8]) {
    wall(11.055, 12.75, z, 0.045, 22.6, 3.6, M.dark);
    wall(11.09, 12.75, z, 0.06, 22.5, 3.5, M.cab);
    box(cab, 11.16, 15, z - 1.1, 0.12, 1.1, 0.16, M.black);
  }
  for (const x of [-4.5, 0, 5.5]) {
    wall(x, 12.75, -37.04, 4.2, 22.5, 0.08, M.cab2);
    box(cab, x + 1.6, 15, -37.14, 0.13, 1.1, 0.12, M.black);
  }
  for (let i = 0; i < 15; i++) box(cab, 6, 21 + i * 0.14, -37.12, 5, 0.055, 0.04, M.dark);

  const cover = createRoedersCover({ cab, M, group, box, cyl, rod, label, bolts, plate, foldedShell });
  plate(
    cab,
    'front-left-cheek',
    [
      [-11.1, 7.1],
      [-11.1, 28.2],
      [-8.55, 28.2],
      [-8.55, 7.1],
    ],
    0.55,
    M.cab,
  ).position.z = 10.65;
  plate(
    cab,
    'right-service-fascia',
    [
      [3.35, 7.1],
      [11.07, 7.1],
      [11.07, 28.2],
      [3.35, 28.2],
    ],
    0.35,
    M.cab,
  ).position.z = 10.76;
  const door = group('right-sliding-loading-door', cab);
  door.userData.s = 1;
  const doorShape = [
    [0, 0],
    [11.7, 0],
    [11.7, 19.9],
    [11.15, 20.85],
    [0.25, 20.85],
    [0, 20.2],
  ];
  const doorWindow = [
    [1.85, 2.5],
    [10.05, 2.5],
    [10.05, 15.4],
    [1.85, 15.4],
  ];
  plate(door, 'red-sliding-leaf', doorShape, 0.32, M.red, [doorWindow]);
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 12.9), M.glass);
  frontGlass.position.set(5.95, 8.95, 0.16);
  frontGlass.name = 'front-observation-window';
  door.add(frontGlass);
  rim(
    door,
    doorWindow.map(([x, y]) => [x, y, 0.345]),
    M.steelD,
    0.055,
  );
  rod(door, [0.95, 3.0, 0.62], [0.95, 12.2, 0.62], 0.105, M.steelD);
  for (const y of [3.1, 12.1]) rod(door, [0.95, y, 0.32], [0.95, y, 0.68], 0.095, M.black);
  // Door runs IN FRONT of the right service fascia; no hinge or outward swing.
  box(cab, 1.15, 7.25, 11.46, 19.6, 0.14, 0.25, M.steelD);
  box(cab, 7.2, 7.55, 11.36, 7.8, 0.34, 0.24, M.inox);
  for (const y of [7.4, 7.62, 7.85]) box(cab, 7.1, y, 11.48, 7.6, 0.05, 0.08, M.steelD);
  for (const x of [1.1, 7.2]) box(door, x, 0.05, 0.06, 0.85, 0.32, 0.45, M.steelD);
  label(cab, 'RXU 1001', 7.15, 25.6, 11.2, 5.6, 0.85, { size: 140 });
  label(cab, 'DSH', 7.15, 24.65, 11.2, 2.5, 0.7, { size: 140 });
  label(cab, 'röders', 7.15, 19.15, 11.2, 4.3, 0.9, { size: 150 });
  label(cab, 'TEC', 7.15, 18.4, 11.2, 2, 0.55, { size: 145 });
  wall(6.55, 13.25, 11.15, 5.2, 7.7, 0.035, M.steelD);
  wall(6.55, 13.25, 11.18, 5.08, 7.58, 0.04);
  for (const x of [4.25, 8.8]) cyl(cab, x, 13.1, 11.23, 0.075, 0.045, M.steelD, 'z');
  for (const y of [9.3, 26]) bolts(cab, 7.15, y, 11.23, 6.6, 0.2);

  // RMS is beside the wider left shoulder, behind the side viewing window.
  // The articulated bracket is attached to the chassis, not a detached floor post.
  const pan = part('panel'),
    armPivot = group('terminal-shoulder', pan);
  armPivot.position.set(-16.25, 0, -8.7);
  box(pan, -16.23, 10.8, -8.7, 0.3, 2.1, 1.4, M.steelD);
  cyl(armPivot, 0, 10.4, 0, 0.37, 1.9, M.steelD);
  box(armPivot, -1.2, 10.4, 0, 2.4, 0.4, 0.65, M.steelD);
  const armElbow = group('terminal-elbow', armPivot);
  armElbow.position.set(-2.4, 0, 0);
  cyl(armElbow, 0, 10.4, 0, 0.32, 0.8, M.steelD);
  rod(armElbow, [0, 10.4, 0], [-1.65, 10.4, 2.4], 0.18, M.steelD);
  const panG = group('RMS-console', armElbow);
  panG.position.set(-1.65, 2.1, 2.4);
  panG.scale.setScalar(0.9);
  const hmi = createRmsPanel(panG, M, tex);
  tube(
    pan,
    [
      [-16.3, 10.5, -8.7],
      [-18, 9.1, -8.5],
      [-20.3, 9, -6.7],
    ],
    0.07,
  );

  const cart = group('rear-chip-cart', bed),
    C = L.chipCart;
  cart.position.set(C.x, 0, C.z);
  // Two screw outlets discharge into a separate wheeled collector, near the rear.
  box(cart, 0, 2.0, 0, C.width + 0.15, 0.35, C.depth + 0.15, M.red);
  box(cart, 0, 3.2, 0, C.width - 0.1, 0.18, C.depth - 0.1, M.inox);
  for (const x of [-C.width / 2, C.width / 2]) box(cart, x, 6.1, 0, 0.14, 5.8, C.depth, M.cab2);
  for (const z of [-C.depth / 2, C.depth / 2]) box(cart, 0, 6.1, z, C.width, 5.8, 0.14, M.cab2);
  for (const x of [-3.8, 3.8])
    for (const z of [-6.5, 6.5]) {
      box(cart, x, 1.4, z, 0.3, 1.2, 0.3, M.red);
      cyl(cart, x, 0.6, z, 0.46, 0.32, M.black, 'x');
    }
  for (const z of [-C.depth / 2, C.depth / 2]) {
    rod(cart, [-C.width / 2, 9.05, z], [C.width / 2, 9.05, z], 0.14, M.inox);
    rod(cart, [-C.width / 2 - 0.1, 7.1, z * 1.02], [C.width / 2 + 0.1, 7.1, z * 1.02], 0.13, M.steelD);
  }
  for (const x of [-C.width / 2, C.width / 2]) rod(cart, [x, 9.05, -C.depth / 2], [x, 9.05, C.depth / 2], 0.14, M.inox);
  for (const z of [-22.8, -18.0]) {
    box(bed, -18.35, 10.3, z, 4.5, 0.6, 1, M.inox);
    cyl(bed, -18.1, 10, z, 0.28, 4.1, M.steelD, 'x');
  }
  // The supplied machine has a fixed KNOLL discharge hopper over its cart.
  // It belongs to the base assembly; only the external coolant units are optional.
  const conveyor = group('KNOLL-chip-conveyor', bed);
  conveyor.userData.part = 'lozko';
  const belt = group('inclined-chip-belt', conveyor),
    flights = [];
  const beltA = new THREE.Vector3(-17.1, 3.1, -20.2),
    beltB = new THREE.Vector3(-18.7, 23.8, -20.2),
    beltD = beltB.clone().sub(beltA),
    beltLen = beltD.length();
  box(conveyor, -17.6, 13.7, -20.2, 2.3, 21.7, 5.2, M.cab2);
  box(conveyor, -18.7, 23.8, -20.2, 5.4, 1.2, 5.6, M.cab);
  rod(belt, [-17.1, 3.1, -20.2], [-18.7, 23.8, -20.2], 0.95, M.black);
  // Four sheet-metal faces, not a solid cuboid: the mouth is genuinely open.
  const hopper = group('KNOLL-open-discharge-hopper', conveyor);
  M.chute = M.cab.clone();
  M.chute.side = THREE.DoubleSide;
  const quad = (name, points) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const face = new THREE.Mesh(geo, M.chute);
    face.name = name;
    face.castShadow = true;
    face.receiveShadow = true;
    hopper.add(face);
    return face;
  };
  const top = [
    [-22.1, 24.3, -23.1],
    [-18.5, 24.3, -23.1],
    [-18.5, 24.3, -17.3],
    [-22.1, 24.3, -17.3],
  ];
  const mouth = [
    [-26.3, 10.9, -23.1],
    [-22.7, 10.9, -23.1],
    [-22.7, 10.9, -17.3],
    [-26.3, 10.9, -17.3],
  ];
  for (let i = 0; i < 4; i++) quad(`hopper-wall-${i}`, [top[i], top[(i + 1) % 4], mouth[(i + 1) % 4], mouth[i]]);
  rim(hopper, mouth, M.steelD, 0.055);
  const mouthDatum = group('hopper-open-mouth', hopper);
  mouthDatum.position.set(-24.5, 10.9, -20.2);
  mouthDatum.userData.opening = [3.6, 5.8];
  const plateLabel = label(hopper, 'KNOLL', -23.18, 21, -20.2, 2.8, 0.65, {
    rotate: -Math.PI / 2,
    color: '#234e9c',
    background: '#c9cdd1',
    size: 125,
  });
  plateLabel.rotation.set(-Math.atan(4.2 / 13.4), -Math.PI / 2, 0, 'YXZ');
  for (const z of [-22.7, -17.7]) box(hopper, -23.55, 19.8, z, 0.18, 0.23, 0.37, M.black);
  for (let i = 0; i < 20; i++) {
    const f = box(belt, 0, 0, 0, 0.15, 0.13, 4.6, M.steelD);
    f.rotation.z = -Math.atan2(beltD.x, beltD.y);
    flights.push(f);
  }
  let beltPhase = 0;
  // Optional units remain off at load. P57 filter is 1523 × 1380 (not 1390).
  const equipment = group('RXU-layout-equipment');
  equipment.userData.part = 'lozko';
  const cooling = group('cooling-unit', equipment),
    filter = group('optional-band-filter', equipment),
    C0 = L.cooling,
    F = L.filter;
  box(cooling, C0.x, 5.5, C0.z, C0.width, 10.4, C0.depth, M.cab2);
  box(cooling, C0.x, 10.85, C0.z, C0.width, 0.2, C0.depth, M.dark);
  for (let i = 0; i < 17; i++) box(cooling, C0.x, 4.1 + i * 0.25, C0.z + C0.depth / 2 + 0.02, 8, 0.08, 0.07, M.dark);
  label(cooling, 'COOLING', C0.x, 9.9, C0.z + C0.depth / 2 + 0.05, 3, 0.45, {
    color: '#52616b',
    background: '#c9cdd1',
    size: 60,
  });
  for (const x of [C0.x - 2.6, C0.x + 2.6]) {
    cyl(cooling, x, 11.03, C0.z, 1.65, 0.2, M.black);
    for (const radius of [0.55, 1, 1.5]) {
      const guard = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.028, 6, 32), M.steelD);
      guard.rotation.x = -Math.PI / 2;
      guard.position.set(x, 11.2, C0.z);
      cooling.add(guard);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      rod(cooling, [x, 11.2, C0.z], [x + Math.cos(a) * 1.6, 11.2, C0.z + Math.sin(a) * 1.6], 0.026, M.steelD);
    }
  }
  const filterPlan = [
    [-7.615, -6.9],
    [5.3, -6.9],
    [5.3, -3.5],
    [7.615, -3.5],
    [7.615, 2.5],
    [5.3, 2.5],
    [5.3, 4.2],
    [2.1, 4.2],
    [2.1, 6.9],
    [-1.1, 6.9],
    [-1.1, 4.2],
    [-4.4, 4.2],
    [-4.4, 0.1],
    [-7.615, 0.1],
  ].map(([x, z]) => [x + F.x, z + F.z]);
  footprint(filter, 'band-filter-stepped-body', filterPlan, 0.4, 9.8, M.cab2);
  footprint(filter, 'band-filter-lid', filterPlan, 10.2, 0.18, M.inox);
  cyl(filter, F.x, 10.5, F.z - 2, 1.25, 0.45, M.dark);
  box(filter, F.x + 5, 9, F.z, 2, 3.5, 5, M.steelD);
  const hoses = group('coolant-connections', equipment);
  tube(
    hoses,
    [
      [C0.x, 2, C0.z + 3.8],
      [C0.x, 1.6, -41],
      [6, 2, -37.1],
    ],
    0.13,
  );
  tube(
    hoses,
    [
      [F.x + 5, 2, F.z + 4],
      [F.x + 9, 1.5, -40],
      [6, 1.4, -37.1],
    ],
    0.13,
  );
  equipment.visible = false;
  const lampPositions = [
    [-8.5, 24.7, 5.4],
    [2.5, 24.7, 5.4],
  ];
  lampPositions.forEach(([x, y, z]) => box(cab, x, y, z, 0.28, 0.2, 3.7, M.lamp));
  createRoedersDetails({
    structure,
    aG,
    cG,
    xG,
    zG,
    sp,
    cab,
    bed,
    M,
    group,
    box,
    cyl,
    rod,
    label,
    plate,
    foldedShell,
    tube,
    PY,
  });
  const machinePoint = (p) => new THREE.Vector3(...p).add(machiningFrame.position);
  return {
    ...cover,
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
    armElbow,
    hmi,
    sm: hmi.display,
    covers: [],
    clampPins,
    doors: [door],
    loadMagazine,
    machiningFrame,
    machinePoint,
    lighting: {
      lampPositions,
      targets: [
        [-2.6, PY - 0.4, 3.2],
        [-2.6, PY - 0.4, 3.2],
      ],
      bounds: [
        [-10.65, 7.4, -0.3],
        [10.6, 27.3, 10.7],
      ],
    },
    accessories: {
      equipment: { cooling, filter, conveyor },
      update(c, dt = 0) {
        equipment.visible = c.accessorySetup !== 'none';
        filter.visible = c.accessorySetup === 'filter';
        hoses.children.forEach((h, i) => (h.visible = i === 0 || filter.visible));
        if (c.running) beltPhase = (beltPhase + dt * 0.9) % beltLen;
        flights.forEach((f, i) =>
          f.position.copy(beltA).addScaledVector(beltD, ((i * 1.05 + beltPhase) % beltLen) / beltLen),
        );
      },
    },
    updateGeometry({ doorK, panelA, panelYaw }) {
      door.position.set(L.door.left + doorK * L.door.travel, L.door.bottom, L.door.z);
      door.rotation.y = 0;
      // Sweep out into the operator aisle. The complete monitor stays left of the chassis.
      armPivot.rotation.y = -panelA * 0.18;
      armElbow.rotation.y = panelA * 0.08;
      panG.rotation.y = panelA * 0.1 + panelYaw;
      covers.forEach((o) => {
        const { side, index } = o.userData,
          x = xG.position.x,
          lo = side < 0 ? -7.4 : x + 3.35,
          hi = side < 0 ? x - 3.35 : 7.4,
          w = Math.max(0.1, hi - lo) / 9;
        o.position.x = lo + (index + 0.5) * w;
        o.scale.x = w / 0.4;
        o.position.y = 22.15 + index * 0.025;
      });
    },
    updateTransfer(change, phase, tls, T) {
      const k = !change
        ? 0
        : phase < 0.3
          ? Math.max(0, (phase - 0.18) / 0.12)
          : phase < 0.4
            ? 1
            : phase < 0.55
              ? 1 - (phase - 0.4) / 0.15
              : phase < 0.7
                ? (phase - 0.55) / 0.15
                : 1 - (phase - 0.7) / 0.3;
      saddle.position.z = -11.8 + (transferZ + 11.8) * Math.max(0, Math.min(1, k));
      const held = change && phase >= 0.4 && phase < 0.7 ? (phase < 0.55 ? change.from : change.to) : 0;
      if (held !== transferT) {
        clear(transferTool);
        transferT = held;
        const tool = tls.find((t) => t.t === held);
        if (tool) transferTool.add(createToolModel(tool, M));
      }
      pockets.forEach((p, i) => (p.visible = i + 1 !== T && i + 1 !== held));
    },
    anchorOverrides: {
      kabina: () => new THREE.Vector3(-8.9, 26, 10.8),
      lozko: () => new THREE.Vector3(8, 4, 11.3),
      osi: () => machinePoint([5, 24, 0]),
      vreteno: () => sp.getWorldPosition(new THREE.Vector3()),
      stol: () => machinePoint([4.5, PY, 0]),
      zasobnik: () => magG.getWorldPosition(new THREE.Vector3()),
      panel: () => hmi.display.getWorldPosition(new THREE.Vector3()),
      obrobok: () => machinePoint([0, PY - 0.3, 0]),
    },
    viewOverrides: {
      celok: () => [
        [-36, 26, 57],
        [-4, 16, -8],
      ],
      vybavenie: () => [
        [-65, 43, -80],
        [-9, 11, -25],
      ],
      panel: () => {
        const p = hmi.display.getWorldPosition(new THREE.Vector3());
        return [
          p
            .clone()
            .add(new THREE.Vector3(-2, 2, 14))
            .toArray(),
          p.toArray(),
        ];
      },
      priestor: () => [[-8.8, PY + 5.2, 9.8], [-2.6, PY, 3.2], true],
      obrobok: () => [[-0.7, PY + 1.4, 5.7], [-2.6, PY - 0.3, 3.2], true],
      zasobnik: () => [[-22, 29, -10], [magX, magY, magZ], true],
      zhora: () => [[-6, 140, -21], [-6, 8, -21], true],
    },
  };
}
