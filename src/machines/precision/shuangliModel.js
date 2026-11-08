import * as THREE from 'three';
import { modelKit } from './modelKit';

// Visual reconstruction: supplied ZJA13 family photographs. The 1610 specification
// is a related reference, not a verified dimensional drawing of the 2013F.
export const DEEP_LAYOUT = { entryX: -8, axisY: 10.2, drillLength: 22, table: [13, 20] };
export function createShuangliModel({ root, G, M, tex }) {
  const { group, box, cyl, rod, label, bolts } = modelKit(root, M, tex);
  const part = (k) => {
    const o = group(k);
    o.userData.part = k;
    G[k] = o;
    return o;
  };
  const name = (o, n) => ((o.name = n), o);
  const tube = (p, points, r, mat = M.black) => {
    const o = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(...v))), 24, r, 8, false),
      mat,
    );
    p.add(o);
    return o;
  };
  const profile = (p, n, pts, depth, mat) => {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    const o = new THREE.Mesh(geo, mat);
    o.name = n;
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  };
  const bed = part('lozko');
  box(bed, 1, 1.5, 0, 47, 2.6, 28, M.dark);
  box(bed, -12.5, 3.4, 0, 18, 2.4, 24, M.cab2);
  box(bed, 9, 3.4, 0, 23, 2.4, 15, M.cab2);
  for (const x of [-19, -8, 6, 20])
    for (const z of [-11.5, 11.5]) {
      cyl(bed, x, 0.25, z, 0.65, 0.4, M.black);
      cyl(bed, x, 0.7, z, 0.3, 0.7, M.steelD);
    }
  // Cross slide below the work table: X is transverse to the drill (scene Z).
  for (const x of [-17, -9]) {
    box(bed, x, 4.8, 0, 0.45, 0.35, 22, M.steel);
    for (let z = -10; z <= 10; z += 2) cyl(bed, x, 5, z, 0.065, 0.06, M.black);
  }
  const table = part('stol'),
    tableSlide = group('X-cross-slide', table);
  box(tableSlide, -12.5, 5.8, 0, 16, 1.6, 21, M.cab2);
  box(tableSlide, -12.5, 7.1, 0, 14, 1, 20.5, M.dark);
  name(box(tableSlide, -12.5, 8, 0, 13, 1, 20, M.table), 'T-slot-table');
  for (let i = 0; i < 9; i++) box(tableSlide, -12.5, 8.51, -8.8 + i * 2.2, 12.95, 0.045, 0.14, M.black);
  for (const x of [-18, -15, -10, -7])
    for (const z of [-8, -4, 0, 4, 8]) cyl(tableSlide, x, 8.54, z, 0.045, 0.04, M.steelD);
  for (const z of [-1.65, 1.65]) {
    box(tableSlide, -10.5, 8.9, z, 5, 0.7, 0.45, M.steelD);
    for (const x of [-12.5, -8.5]) {
      box(tableSlide, x, 9.32, z, 0.8, 0.15, 0.6, M.steel);
      cyl(tableSlide, x, 9.45, z, 0.08, 0.3, M.black);
    }
  }
  const stockMount = group('clamped-stock', tableSlide);
  stockMount.position.set(DEEP_LAYOUT.entryX, DEEP_LAYOUT.axisY, 0);
  // Twin vertical guide column with exposed blocks, screw and servo.
  const axes = part('osi');
  box(axes, 7.5, 13, -6.5, 6, 21, 6, M.cab2);
  for (const x of [5.5, 9.5]) {
    box(axes, x, 14, -3.26, 0.38, 20, 0.4, M.steel);
    for (let y = 5; y < 24; y += 1.1) cyl(axes, x, y, -3.02, 0.07, 0.04, M.black, 'z');
  }
  cyl(axes, 7.5, 14, -2.9, 0.18, 20, M.steel);
  cyl(axes, 7.5, 25.1, -2.9, 0.55, 1.5, M.dark);
  box(axes, 7.5, 26, -2.9, 1.3, 0.25, 1.3, M.black);
  const beam = group('Y-vertical-drilling-beam', axes);
  box(beam, 7.5, 0, -2.6, 6.4, 4.5, 2, M.dark);
  for (const x of [5.5, 9.5])
    for (const y of [-1.45, 1.45]) {
      box(beam, x, y, -3.5, 0.9, 0.85, 0.7, M.steelD);
      box(beam, x, y, -3.07, 0.82, 0.7, 0.12, M.green);
    }
  box(beam, 7.5, -1.3, -1.3, 6.4, 1.9, 3.4, M.cab2);
  name(box(beam, 7.2, -1.3, 1.4, 30, 1.9, 3.6, M.cab2), 'horizontal-feed-bed');
  for (const z of [0.2, 2.65]) {
    box(beam, 7.2, -0.28, z, 30, 0.25, 0.35, M.steel);
    for (let x = -7; x <= 21; x += 1.1) cyl(beam, x, -0.13, z, 0.055, 0.05, M.black);
  }
  cyl(beam, 7.2, -0.25, 1.4, 0.16, 30, M.steel, 'x');
  cyl(beam, 22.2, -0.25, 1.4, 0.52, 1.6, M.dark, 'x');
  box(beam, 23.1, -0.25, 1.4, 0.35, 1.3, 1.3, M.black);
  // Fixed drill guide, then two sliding steady rests that support the long shaft.
  const guides = [];
  for (const x of [-7.35, 0, 7]) {
    const g = group('drill-guide', beam);
    g.position.x = x;
    box(g, 0, -1.03, 1.4, 0.7, 0.4, 3.2, M.steelD);
    const outline = new THREE.Shape();
    outline.moveTo(-0.85, -0.85);
    outline.lineTo(0.85, -0.85);
    outline.lineTo(0.85, 0.85);
    outline.lineTo(-0.85, 0.85);
    outline.closePath();
    const bore = new THREE.Path();
    bore.absarc(0, 0, 0.26, 0, Math.PI * 2, true);
    outline.holes.push(bore);
    const housing = new THREE.ExtrudeGeometry(outline, { depth: 0.7, bevelEnabled: false, curveSegments: 24 });
    housing.translate(0, 0, -0.35);
    housing.rotateY(Math.PI / 2);
    const support = new THREE.Mesh(housing, M.cab2);
    support.name = 'bored-guide-housing';
    g.add(support);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.12, 8, 32), M.steel);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, 0, 0);
    g.add(ring);
    // The front guide face is a bored annulus, not a solid cap over the drill.
    box(g, 0, -0.65, 0, 0.8, 0.3, 1.2, M.dark);
    guides.push(g);
  }
  const spindle = group('Z-feed-spindle', beam);
  box(spindle, 1.2, -0.1, 1.4, 3.5, 0.55, 3.5, M.steelD);
  box(spindle, 1.7, 0.75, 0, 3.5, 2.3, 2.3, M.cab);
  cyl(spindle, 0.45, 0, 0, 0.68, 1, M.steelD, 'x');
  cyl(spindle, 0.02, 0, 0, 0.45, 0.28, M.steel, 'x');
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    cyl(spindle, -0.14, Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.045, 0.04, M.black, 'x');
  }
  box(spindle, 3.5, 0.6, 0, 1.4, 1.9, 1.9, M.dark);
  for (let i = 0; i < 10; i++) box(spindle, 3.05 + i * 0.1, 0.6, 0, 0.045, 2, 2, M.black);
  const drill = group('single-lip-gun-drill', spindle);
  const shaft = cyl(drill, -11, 0, 0, 0.08, 22, M.steel, 'x');
  const tip = cyl(drill, -21.94, 0, 0, 0.1, 0.12, M.brass, 'x');
  // Single straight flute: gun drills do not have the helical flutes of a twist drill.
  const flute = box(drill, -11, 0.065, 0, 21.8, 0.045, 0.05, M.dark);
  tube(
    spindle,
    [
      [3.6, 0.8, -1],
      [4, 2, -1.5],
      [1.6, 2.8, -1.8],
      [0.4, 1.4, -0.8],
    ],
    0.12,
  );
  for (let i = 0; i < 24; i++) {
    const x = -1 + i * 0.75;
    box(beam, x, 2.6, -1.5, 0.6, 0.35, 0.6, M.black);
  }
  const verticalBellows = [];
  for (let i = 0; i < 34; i++) verticalBellows.push(box(axes, 7.5, 0, -3.2, 3.2, 0.12, 0.5, i % 2 ? M.black : M.dark));
  // White enclosure with real cut-out windows and a continuous lower red stripe.
  const cab = part('kabina'),
    doors = [],
    serviceDoors = [];
  // Raycaster otherwise visits invisible descendants and selects the hidden cover.
  cab.raycast = () => (cab.visible ? undefined : false);
  const windowPanel = (p, n, w, h, ww, wh, wx = 0, wy = 0.4) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2);
    s.lineTo(w / 2, -h / 2);
    s.lineTo(w / 2, h / 2);
    s.lineTo(-w / 2, h / 2);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(wx - ww / 2, wy - wh / 2);
    hole.lineTo(wx - ww / 2, wy + wh / 2);
    hole.lineTo(wx + ww / 2, wy + wh / 2);
    hole.lineTo(wx + ww / 2, wy - wh / 2);
    hole.closePath();
    s.holes.push(hole);
    const metal = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false }), M.cab);
    metal.name = n;
    metal.castShadow = true;
    p.add(metal);
    for (const x of [-ww / 2, ww / 2]) box(p, wx + x, wy, 0.1, 0.12, wh + 0.1, 0.12, M.dark);
    for (const y of [-wh / 2, wh / 2]) box(p, wx, wy + y, 0.1, ww, 0.12, 0.12, M.dark);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), M.glass);
    glass.position.set(wx, wy, 0.08);
    glass.name = `${n}-glass`;
    p.add(glass);
    return metal;
  };
  // Left bay projects in front of the wide loading aperture, as in the photographs.
  box(cab, -15.9, 3.9, 15.9, 13, 6, 0.3, M.black);
  box(cab, 7.3, 3.9, 12.2, 33.4, 6, 0.3, M.black);
  for (const [x, w, z] of [
    [-15.9, 13, 16],
    [7.3, 33.4, 12.3],
  ]) {
    box(cab, x, 7.3, z, w, 2.2, 0.25, M.cab);
    box(cab, x, 8.25, z + 0.15, w, 0.25, 0.08, M.red);
    box(cab, x, 25.5, z, w, 2.5, 0.4, M.cab);
    box(cab, x, 27, z - 0.7, w, 0.5, 1.8, M.cab);
  }
  const left = group('left-access-door', cab);
  left.position.set(-22.4, 16.6, 16);
  const leftLeaf = group('left-door-leaf', left);
  leftLeaf.position.x = 6.4;
  windowPanel(leftLeaf, 'left-loading-window', 12.65, 16, 5.6, 10.1, -0.8, 0.1);
  rod(leftLeaf, [4.6, -1, 0.45], [4.6, 1.5, 0.45], 0.09, M.black);
  serviceDoors.push({ pivot: left, open: false, angle: 0, sign: -1 });
  // Three telescoping front leaves: stacked at the right when open.
  for (let i = 0; i < 3; i++) {
    const d = group(`sliding-door-${i + 1}`, cab);
    d.position.set(-3.8 + i * 8.5, 16.5, 12.42 + i * 0.22);
    windowPanel(d, `front-door-${i + 1}`, 8.42, 16, 5.8, 11.6, 0, 0.3);
    doors.push(d);
    if (i === 0) {
      rod(d, [-3.5, -2, 0.45], [-3.5, 2, 0.45], 0.12, M.black);
      for (const y of [-2, 2]) rod(d, [-3.5, y, 0.15], [-3.5, y, 0.45], 0.08, M.steel);
    }
  }
  box(cab, 22, 16.5, 12.3, 4, 16, 0.3, M.cab);
  for (const y of [8.5, 24.6]) {
    box(cab, 6.8, y, 12.6, 31, 0.15, 0.28, M.steel);
    box(cab, 6.8, y + 0.15, 12.65, 31, 0.08, 0.1, M.dark);
  }
  const rear = group('rear-window-panel', cab);
  rear.position.set(-9, 16.5, -14);
  rear.rotation.y = Math.PI;
  windowPanel(rear, 'rear-observation', 26, 17, 11, 10);
  box(cab, 16, 16.5, -14, 16, 17, 0.18, M.cab);
  box(cab, 1, 5, -14, 46, 8, 0.2, M.cab2);
  for (const side of [-1, 1]) {
    const wall = group(`side-panel-${side}`, cab);
    wall.position.set(side < 0 ? -22.5 : 24, 16.5, side < 0 ? 1 : 0);
    wall.rotation.y = (side * Math.PI) / 2;
    windowPanel(wall, 'side-observation', side < 0 ? 30 : 28, 17, 10, 10);
    box(wall, 0, -12, 0, side < 0 ? 30 : 28, 7, 0.3, M.black);
    box(wall, 0, -8.25, 0.18, side < 0 ? 30 : 28, 0.25, 0.05, M.red);
  }
  box(cab, -9.25, 17, 14.1, 0.2, 20, 4);
  box(cab, -9.25, 8.25, 14.1, 0.25, 0.25, 4.1, M.red);
  box(cab, 1, 26, -13.4, 46, 2.2, 1.5, M.cab);
  box(cab, -21.8, 26, 1, 0.9, 2.2, 30, M.cab);
  box(cab, 23.3, 26, 0, 1.5, 2.2, 28, M.cab);
  box(cab, 1, 26.8, -0.9, 45, 0.25, 25.9, M.cab);
  box(cab, -15.9, 26.8, 14.1, 13, 0.25, 4, M.cab);
  const hood = profile(
    cab,
    'raised-ventilation-hood',
    [
      [-7, 0],
      [9, 0],
      [7, 2.1],
      [-5, 2.1],
    ],
    7,
    M.cab,
  );
  hood.position.set(5, 26, -2);
  for (let i = 0; i < 22; i++) box(cab, 0.6 + i * 0.4, 28.12, -2, 0.14, 0.025, 4.8, M.dark);
  label(cab, 'ZJA13-2013F', 5, 25.7, 12.54, 6, 0.8, { color: '#e9ecec', background: '#151a20', size: 80 });
  label(leftLeaf, 'ShuangliCNC', 0, 6.9, 0.19, 6, 0.5, { color: '#c92735', background: '#e5e8e9', size: 70 });
  for (const x of [-21, 23]) for (const y of [10, 14, 20, 24]) cyl(cab, x, y, sideZ(x), 0.045, 0.05, M.steelD, 'z');
  function sideZ(x) {
    return x < 0 ? 16.22 : 12.52;
  }
  cyl(cab, -19, 28.2, -11, 0.1, 2.6, M.steel);
  for (let i = 0; i < 3; i++) cyl(cab, -19, 29.3 + i * 0.3, -11, 0.22, 0.27, [M.green, M.yellow, M.red][i]);
  // Sloped chip pan, external belt conveyor and open wheeled collection bin.
  const accessory = part('prislusenstvo');
  for (const z of [-9, 9]) {
    const pan = box(accessory, 1, 4.6, z, 44, 0.12, 6.7, M.inox);
    pan.rotation.x = z > 0 ? -0.22 : 0.22;
  }
  box(accessory, 25, 1.3, 8, 9, 1.6, 3, M.dark);
  const conveyor = group('inclined-chip-conveyor', accessory);
  conveyor.position.set(28.8, 1.4, 8);
  conveyor.rotation.z = 0.9;
  box(conveyor, 3.6, 0, 0, 8, 1.3, 3, M.dark);
  for (const z of [-1.6, 1.6]) box(conveyor, 3.6, 0.3, z, 8, 1.7, 0.14, M.cab2);
  for (let i = 0; i < 16; i++) box(conveyor, i * 0.47, 0.73, 0, 0.12, 0.16, 2.8, M.steelD);
  cyl(conveyor, 7, 0.2, 2, 0.55, 1, M.dark, 'z');
  box(accessory, 34, 5.8, 8, 3, 0.2, 3.2, M.cab2);
  const cart = group('open-chip-cart', accessory);
  cart.position.set(34, 0, 8);
  box(cart, 0, 1.1, 0, 4.7, 0.2, 4.3, M.dark);
  for (const z of [-2.15, 2.15]) box(cart, 0, 2.5, z, 4.8, 2.8, 0.15, M.cab2);
  for (const x of [-2.35, 2.35]) box(cart, x, 2.5, 0, 0.15, 2.8, 4.3, M.cab2);
  for (const x of [-1.8, 1.8])
    for (const z of [-1.6, 1.6]) {
      cyl(cart, x, 0.42, z, 0.35, 0.25, M.black, 'x');
      box(cart, x, 0.8, z, 0.3, 0.6, 0.45, M.steelD);
    }
  // High-pressure coolant cabinet and filter head behind the main enclosure.
  box(accessory, 13, 4, -18, 12, 7, 5, M.cab2);
  for (const x of [9, 16]) {
    cyl(accessory, x, 8.8, -18, 0.6, 2.2, M.dark);
    box(accessory, x, 7.6, -18, 1.5, 0.2, 1.5, M.steel);
  }
  tube(
    accessory,
    [
      [9, 9, -18],
      [8, 10, -16],
      [6, 8, -10],
      [4, 5, -6],
    ],
    0.14,
  );
  label(accessory, 'FILTER / COOLANT', 13, 5, -15.45, 5, 0.6, { color: '#34434b', background: '#c5c9cb', size: 60 });
  // Siemens-style terminal on the front right corner, with a live shared display.
  const panel = part('panel');
  panel.position.set(22.2, 15.8, 14.4);
  panel.rotation.y = -0.12;
  box(panel, 0, 0, -0.35, 4.5, 7.6, 0.8, M.cab2);
  box(panel, 0, 1.65, 0.1, 3.9, 3.25, 0.15, M.black);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(3.55, 2.65),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
  );
  display.position.set(0, 1.65, 0.19);
  panel.add(display);
  label(panel, 'SIEMENS', -0.9, 3.52, 0.09, 1.8, 0.32, { color: '#008d91', background: '#b9bfc4', size: 75 });
  label(panel, 'SINUMERIK', 0.8, 3.52, 0.09, 1.65, 0.25, { color: '#33404a', background: '#b9bfc4', size: 60 });
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 9; c++)
      box(panel, -1.6 + c * 0.4, -0.55 - r * 0.31, 0.16, 0.27, 0.22, 0.12, c > 5 ? M.dark : M.steelD);
  for (let i = 0; i < 8; i++) box(panel, -1.55 + i * 0.44, 0.06, 0.18, 0.3, 0.18, 0.12, M.dark);
  const controls = {};
  for (const [id, x, y, mat] of [
    ['start', 0.65, -3.1, M.green],
    ['hold', -0.05, -3.1, M.red],
    ['reset', 1.5, -3.1, M.blue],
    ['emergency', -1.4, -3.1, M.red],
  ]) {
    cyl(panel, x, y, 0.15, id === 'emergency' ? 0.34 : 0.25, 0.1, id === 'emergency' ? M.yellow : M.dark, 'z');
    controls[id] = cyl(panel, x, y, 0.27, id === 'emergency' ? 0.23 : 0.16, 0.2, mat, 'z');
  }
  for (const x of [-2.4, 2.4]) rod(panel, [x, -3.5, 0.15], [x, 3.5, 0.15], 0.09, M.steel);
  box(panel, 0, -4.2, -0.1, 4.5, 0.9, 1.3, M.cab);
  bolts(panel, 0, 0, 0.2, 4.1, 7.2);
  const lamp = new THREE.PointLight(0xe8f3ff, 220, 30, 2);
  lamp.position.set(-10, 22, 4);
  root.add(lamp);
  return {
    doors,
    serviceDoors,
    cab,
    beam,
    spindle,
    drill,
    tableSlide,
    stockMount,
    display,
    panel,
    controls,
    lamp,
    update({ S, door = 0, cover = true, light = true, diameter = 16, dt = 0 }) {
      tableSlide.position.z = S.x * 0.01;
      beam.position.y = DEEP_LAYOUT.axisY + S.y * 0.01;
      spindle.position.x = DEEP_LAYOUT.entryX + DEEP_LAYOUT.drillLength - S.depth * 0.01;
      shaft.scale.set(1, 1, 1);
      shaft.scale.x = diameter / 16;
      shaft.scale.z = diameter / 16; // cylinder is rotated: geometry radius lies in local X/Z
      tip.scale.set(diameter / 20, 1, diameter / 20);
      flute.position.y = diameter * 0.004;
      flute.scale.z = diameter / 16;
      drill.rotation.x = S.run ? drill.rotation.x + dt * 20 : drill.rotation.x;
      guides[1].position.x = -0.2 - S.depth * 0.004;
      guides[2].position.x = 7 - S.depth * 0.007;
      const top = 24.6,
        bottom = beam.position.y + 2.3;
      verticalBellows.forEach((b, i) => {
        b.position.y = bottom + ((i + 0.5) / 34) * (top - bottom);
        b.scale.y = Math.max(0.01, (top - bottom) / 34 / 0.12);
      });
      doors.forEach((d, i) => {
        d.position.x = -3.8 + i * 8.5 + door * (17 - i * 8.5);
      });
      for (const d of serviceDoors) {
        d.angle += ((d.open ? 1 : 0) - d.angle) * Math.min(1, dt * 6);
        d.pivot.rotation.y = d.angle * Math.PI * 0.55 * d.sign;
      }
      cab.visible = cover;
      lamp.visible = light;
    },
    serviceOpen: () => serviceDoors.some((d) => d.open || d.angle > 0.01),
  };
}
