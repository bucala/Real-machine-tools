import { drawTerminalKeyboard } from './terminalKeyboard';
import * as THREE from 'three';
import { modelKit } from './modelKit';
import { accordionGeometry, oscarDecals } from './oscarDetails';

// EX500: manufacturer table/axis dimensions; sheet-metal details reconstructed
// from the supplied EX catalogue and front/side photographs (not factory CAD).
export function createOscarModel({ root, G, M, tex }) {
  const { group, box, cyl, rod, label, bolts, clear } = modelKit(root, M, tex);
  const part = (k) => {
    const g = group(k);
    g.userData.part = k;
    G[k] = g;
    return g;
  };
  const named = (o, name) => ((o.name = name), o);
  const decals = oscarDecals(tex);
  const decal = (parent, o, name, x, y, z, ry = 0) => {
    o.name = name;
    o.position.set(x, y, z);
    o.rotation.y = ry;
    parent.add(o);
    return o;
  };
  const rubber = M.black.clone();
  rubber.roughness = 0.86;
  rubber.metalness = 0.03;
  const boot = (parent, name, w, d, folds) => {
    const o = new THREE.Mesh(accordionGeometry(w, d, folds), rubber);
    o.name = name;
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const screw = (parent, x, y, z, axis = 'z') => {
    const g = group('captive-screw', parent);
    g.position.set(x, y, z);
    if (axis === 'x' || axis === '-x') g.rotation.y = ((axis === 'x' ? 1 : -1) * Math.PI) / 2;
    cyl(g, 0, 0, 0, 0.037, 0.018, M.steel, 'z');
    box(g, 0, 0, 0.011, 0.042, 0.009, 0.005, M.dark);
  };
  const profile = (parent, name, points, width, material, x = 0) => {
    const shape = new THREE.Shape();
    points.forEach(([z, y], i) => (i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    g.translate(0, 0, -width / 2);
    g.rotateY(Math.PI / 2);
    const o = new THREE.Mesh(g, material);
    o.name = name;
    o.position.x = x;
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const tube = (parent, name, points, r, mat = M.black) => {
    const o = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 28, r, 8, false),
      mat,
    );
    o.name = name;
    parent.add(o);
    return o;
  };
  const eye = (p, x, y, z) => {
    const o = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 20), M.brass);
    o.position.set(x, y, z);
    p.add(o);
    cyl(p, x, y - 0.19, z, 0.12, 0.12, M.steelD);
  };
  const body = part('lozko');
  box(body, 0.5, 0.5, -4.5, 18.3, 0.8, 18.2, M.dark);
  box(body, -0.8, 4.65, -4.5, 15.7, 8, 17.2, M.cab);
  for (const x of [-7.5, 7.9])
    for (const z of [-12, 3.5]) {
      cyl(body, x, 0.25, z, 0.48, 0.4, M.steelD);
      cyl(body, x, 0.55, z, 0.2, 0.45, M.steel);
    }
  // Separate front cover plates with narrow seams and captive screws.
  for (const [x, w] of [
    [-7.35, 2.2],
    [-0.6, 11.15],
    [6.65, 3.25],
  ]) {
    box(body, x, 4.55, 4.16, w, 7.9, 0.12, M.cab);
    for (const sx of [-1, 1]) for (const y of [1, 4.4, 8.05]) screw(body, x + sx * (w / 2 - 0.14), y, 4.23);
  }
  // The front corner towers meet the lower fascia; the tank wall sits between
  // them, rather than overlapping a second, disconnected pair of boxes.
  for (const [x, w] of [
    [-7.35, 2.2],
    [6.65, 3.25],
  ]) {
    box(body, x, 10.67, -0.2, w, 4.36, 8.9, M.cab);
    profile(
      body,
      'folded-tank-pillar-cap',
      [
        [-4.65, 12.85],
        [4.25, 12.85],
        [4.25, 12.94],
        [3.9, 13.05],
        [-4.65, 13.05],
      ],
      w,
      M.cab,
      x,
    );
    for (const y of [8.65, 12.6]) for (const sx of [-1, 1]) screw(body, x + sx * (w / 2 - 0.15), y, 4.265);
  }
  decal(body, decals.plate(), 'EX500-identification-plate', -7.35, 11.95, 4.27);
  // Left side service panels and folded upper shelf visible in the exhibition views.
  for (const z of [-8.4, -0.25]) {
    box(body, -8.68, 4.7, z, 0.075, 7.65, 7.9, M.cab);
    for (const y of [1.1, 8.25]) for (const zz of [z - 3.7, z + 3.7]) screw(body, -8.73, y, zz, '-x');
    for (const y of [2.1, 6.8]) box(body, -8.74, y, z - 3.5, 0.08, 0.45, 0.13, M.steelD);
  }
  box(body, -7.65, 13.7, -3.5, 2.5, 0.55, 6.3, M.cab);
  box(body, -7.65, 13.97, -3.5, 2.44, 0.06, 6.22, M.inox);
  box(body, -7.65, 12.9, -6.35, 2.2, 1.3, 0.45, M.cab2);
  // Open stainless tank, seal channels and sliding front gate.
  const tank = part('nadrz');
  box(tank, 0, 8.8, -0.5, 11.4, 0.35, 8.2, M.inox);
  for (const x of [-5.7, 5.7]) {
    box(tank, x, 10.7, -0.6, 0.16, 3.8, 8.2, M.inox);
    box(tank, x, 12.64, -0.6, 0.3, 0.1, 8.35, M.steel);
    for (const z of [-3.7, -1.4, 1, 3]) cyl(tank, x, 12.705, z, 0.035, 0.018, M.steelD);
  }
  box(tank, 0, 10.7, -4.7, 11.5, 3.8, 0.16, M.inox);
  box(tank, 0, 12.66, -4.7, 11.6, 0.12, 0.32, M.steel);
  // Rear upper return, drain, and flush manifold remain clear of the work table.
  box(tank, 5, 13.4, -3.7, 1.5, 1.3, 0.4, M.cab);
  box(tank, 5, 14.02, -3.1, 1.5, 0.35, 1.6, M.cab);
  cyl(tank, 4.8, 9.01, -3.7, 0.23, 0.04, M.steelD);
  cyl(tank, 4.8, 9.04, -3.7, 0.16, 0.02, M.black);
  for (let i = 0; i < 4; i++) {
    const x = -4.8 + i * 0.34;
    cyl(tank, x, 12, -4.55, 0.07, 0.2, M.brass, 'z');
    rod(tank, [x, 12, -4.43], [x, 11.65, -4.3], 0.045, M.steel);
  }
  const gate = group('descending-loading-gate', tank);
  box(gate, 0, 0, 0, 11.4, 3.7, 0.22, M.inox);
  box(gate, 0, 1.88, 0, 11.45, 0.1, 0.34, M.steel);
  box(gate, 0, 1.22, 0.126, 11.35, 1.16, 0.035, M.steelD);
  box(gate, 0, -1.8, 0.14, 11.3, 0.12, 0.08, M.steelD);
  decal(gate, decals.model(), 'EX500-white-red-badge', -4.35, 1.5, 0.151);
  decal(gate, decals.safety(), 'tank-safety-pictograms', 3.42, 1.39, 0.151);
  for (const x of [-5.45, 5.45]) {
    box(tank, x, 10.3, 3.85, 0.19, 4.8, 0.22, M.steelD);
    cyl(tank, x, 9.8, 3.65, 0.08, 4.8, M.steel);
    bolts(gate, x, 0, 0.14, 0.1, 3.2);
  }
  const oil = new THREE.Mesh(new THREE.PlaneGeometry(11.05, 7.9), M.oil);
  oil.rotation.x = -Math.PI / 2;
  oil.position.z = -0.6;
  oil.userData.excludeFromExport = true;
  oil.userData.excludeFromMachineExport = true;
  tank.add(oil);
  const table = part('stol');
  table.position.y = 9;
  const slideY = group('fixed-table-support', table),
    slideX = group('fixed-850x450-table', slideY);
  box(slideY, 0, -0.45, 0, 10, 0.5, 6.5, M.dark);
  box(slideX, 0, -0.1, 0, 8.5, 0.3, 4.5, M.table);
  for (const z of [-1.5, -0.5, 0.5, 1.5]) {
    box(slideX, 0, 0.055, z, 8.3, 0.03, 0.065, M.steelD);
    box(slideX, 0, 0.051, z + 0.05, 8.3, 0.008, 0.015, M.steel);
  }
  for (const x of [-3.8, 3.8]) for (const z of [-1.9, 1.9]) cyl(slideX, x, 0.065, z, 0.045, 0.02, M.black);
  box(slideX, 0, 0.3, 0, 1.4, 0.5, 1.1, M.steelD);
  box(slideX, 0, 0.45, 0, 1.3, 0.15, 1, M.steel);
  for (const x of [-0.8, 0.8]) {
    box(slideX, x, 0.2, 0, 0.2, 0.3, 0.7, M.dark);
    cyl(slideX, x, 0.38, 0, 0.06, 0.12, M.steel);
    cyl(slideX, x, 0.45, 0, 0.085, 0.06, M.steelD);
  }
  for (const z of [-0.44, 0.44]) for (const x of [-0.55, 0.55]) cyl(slideX, x, 0.535, z, 0.035, 0.025, M.black);
  const stockMount = group('stock-fixture', slideX);
  stockMount.position.y = 0.5;
  // Moving C column. The slim front tower is continuous to the black Z bellows.
  const axes = part('osi');
  const framePoints = [
    [-11.5, 8.8],
    [-11.5, 17.4],
    [-1.4, 21.25],
    [-1.4, 14.9],
    [-7.2, 14.9],
    [-7.2, 8.8],
  ];
  profile(axes, 'sloped-C-frame', framePoints, 3.4, M.cab2);
  for (const side of [-1, 1]) {
    profile(axes, 'C-frame-side-sheet', framePoints, 0.045, M.cab, side * 1.73);
    for (const z of [-10.9, -8, -5, -2])
      for (const y of [15.18, 17.25 + (z + 10.9) * 0.38]) screw(axes, side * 1.77, y, z, side < 0 ? '-x' : 'x');
    box(axes, side * 1.77, 15.4, -6, 0.035, 0.025, 9.9, M.steelD);
  }
  box(axes, 0, 21.5, 0, 3.1, 12.56, 2.8, M.cab);
  named(box(axes, 0, 21.5, 1.43, 3.06, 12.56, 0.06, M.inox), 'continuous-front-column');
  for (const x of [-1.48, 1.48]) {
    box(axes, x, 21.5, 1.465, 0.015, 12.5, 0.008, M.steelD);
    for (const y of [15.6, 18.7, 22, 26.8]) screw(axes, x, y, 1.48);
  }
  decal(axes, decals.column(), 'EX-diagonal-brand-stripes', 0, 25.49, 1.468);
  box(axes, 0, 15.22, 0, 3.22, 0.2, 2.96, M.cab);
  box(axes, 0, 15.095, 0, 2.92, 0.05, 2.76, M.steelD);
  const xBoots = [boot(axes, 'X-left-accordion', 1.2, 3.5, 24), boot(axes, 'X-right-accordion', 1.2, 3.5, 24)];
  for (const b of xBoots) b.rotation.z = -Math.PI / 2;
  for (const x of [-6.65, 6.65]) {
    box(body, x, 13.55, -6, 1.1, 1.8, 3.7, M.cab);
    box(body, x, 14.5, -6, 1.2, 0.15, 3.8, M.cab);
  }
  const ram = group('Z-servo-ram', axes);
  box(ram, 0, 2, 0, 1.8, 2, 1.8, M.steelD);
  box(ram, 0, 0.91, 0, 2.62, 0.16, 2.42, M.steelD);
  box(ram, 0, 0.77, 0, 1.22, 0.16, 1.22, M.black);
  cyl(ram, 0, 0.55, 0, 0.48, 0.36, M.steel);
  cyl(ram, 0, 0.32, 0, 0.47, 0.1, M.black);
  cyl(ram, 0, 0.18, 0, 0.36, 0.18, M.steel);
  for (const y of [0.42, 0.62]) cyl(ram, 0, y, 0, 0.495, 0.025, M.steelD);
  for (const x of [-0.53, 0.53]) box(ram, x, 0.55, 0, 0.1, 0.18, 0.3, M.steelD);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    cyl(ram, Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4, 0.035, 0.08, M.black);
  }
  const electrode = group('non-rotating-electrode', ram);
  const bellows = boot(axes, 'Z-servo-bellows', 2.72, 2.52, 28);
  // Hoses follow the ram; fittings and nozzle ends stay beside the electrode.
  const hose = M.brass.clone();
  hose.color.setRGB(0.37, 0.37, 0.18);
  hose.metalness = 0.05;
  hose.roughness = 0.35;
  for (const s of [-1, 1]) {
    tube(
      ram,
      s < 0 ? 'left-flush-hose' : 'right-flush-hose',
      [
        [s * 0.95, 0.92, -0.5],
        [s * 1.4, 0.72, -0.3],
        [s * 1.45, -0.05, 0.8],
        [s * 0.6, -0.4, 0.6],
      ],
      0.038,
      hose,
    );
    cyl(ram, s * 0.95, 0.88, -0.5, 0.08, 0.15, M.brass);
    rod(ram, [s * 0.6, -0.4, 0.6], [s * 0.3, -0.55, 0.2], 0.055, M.brass);
    cyl(ram, s * 0.6, -0.4, 0.6, 0.075, 0.1, M.steel, 'z');
  }
  // Restrained, clipped service run along the C-frame (no free-standing loop).
  tube(
    axes,
    'clipped-rear-cable',
    [
      [1.8, 15, -1.8],
      [1.9, 15.7, -4],
      [1.9, 15.8, -8.8],
      [1.9, 14.9, -10],
      [1.9, 9, -10],
    ],
    0.085,
  );
  for (const z of [-3.8, -6.5, -8.8]) box(axes, 1.9, 15.78, z, 0.23, 0.28, 0.12, M.steelD);
  const safety = part('bezpecnost');
  axes.add(safety);
  cyl(safety, -1.9, 17.1, 0.8, 0.25, 2.4, M.red);
  cyl(safety, -1.9, 18.33, 0.8, 0.2, 0.06, M.steelD);
  cyl(safety, -1.9, 15.81, 0.8, 0.25, 0.18, M.red, 'y', 0.09);
  cyl(safety, -1.9, 15.64, 0.8, 0.065, 0.16, M.brass);
  for (const y of [16.35, 17.85]) {
    cyl(safety, -1.9, y, 0.8, 0.258, 0.12, M.steel);
    box(safety, -1.65, y, 0.7, 0.45, 0.12, 0.18, M.steelD);
  }
  label(safety, 'FIRE', -1.9, 17.1, 1.06, 0.37, 0.5, { color: '#d71924', background: '#f0f0eb', size: 90 });
  tube(
    safety,
    'extinguisher-delivery',
    [
      [-1.9, 15.6, 0.8],
      [-1.95, 15.35, 0.8],
      [-1.8, 15.15, 0.6],
    ],
    0.035,
    M.steel,
  );
  cyl(safety, 0.9, 15.85, 1.48, 0.18, 0.06, M.blue, 'z');
  cyl(safety, 0.9, 15.85, 1.52, 0.14, 0.025, M.yellow, 'z');
  cyl(safety, 0.9, 15.85, 1.54, 0.085, 0.015, M.cab, 'z');
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9f5ed,
    emissive: 0xdff3e4,
    emissiveIntensity: 1.8,
    roughness: 0.24,
  });
  const lightBars = [];
  for (const x of [-3.45, 3.45]) {
    for (const s of [-1, 1]) box(tank, x + s * 1.35, 12.85, -4.58, 0.17, 0.4, 0.14, M.steelD);
    box(tank, x, 13.13, -4.47, 3.3, 0.3, 0.23, M.cab2);
    lightBars.push(named(box(tank, x, 13.1, -4.33, 3.05, 0.18, 0.06, lampMaterial), 'sealed-task-light'));
    for (const s of [-1, 1]) box(tank, x + s * 1.62, 13.12, -4.38, 0.12, 0.35, 0.2, M.dark);
  }
  // Generator / dielectric service cabinet, full-height doors, hinges and louvers.
  const rear = part('generator');
  box(rear, 6.9, 7.6, -7.5, 5.3, 14.2, 12.8, M.cab2);
  for (const z of [-11, -4.45]) {
    box(rear, 9.62, 7.7, z, 0.09, 13.5, 6.42, M.cab);
    for (const y of [4.8, 11]) box(rear, 9.7, y, z - 2.8, 0.1, 0.55, 0.17, M.steelD);
    box(rear, 9.76, 9.4, z + 2.4, 0.18, 1.05, 0.11, M.black);
    for (let i = 0; i < 13; i++) box(rear, 9.69, 1.6 + i * 0.12, z, 0.06, 0.045, 4.55, M.dark);
    for (const y of [1, 14.2]) for (const zz of [z - 2.8, z + 2.8]) cyl(rear, 9.7, y, zz, 0.04, 0.04, M.steelD, 'x');
  }
  box(rear, 6.9, 7.6, -14, 5.25, 13.7, 0.1, M.cab);
  bolts(rear, 6.9, 7.6, -13.92, 4.8, 13);
  box(rear, 6.9, 14.77, -7.5, 5.4, 0.16, 12.95, M.cab);
  for (let i = 0; i < 20; i++) box(rear, 5.1 + i * 0.16, 14.86, -8.5, 0.05, 0.025, 3.6, M.dark);
  for (const x of [4.7, 9]) for (const z of [-13, -2]) eye(rear, x, 15.0, z);
  cyl(rear, 6.6, 16.25, -8, 0.18, 2.7, M.steel);
  cyl(rear, 6.6, 17.65, -8, 0.25, 0.14, M.steelD);
  decal(rear, decals.plate(), 'generator-identification', 6.8, 13.1, -1.04);
  box(rear, 8.8, 10.3, -1.03, 0.12, 1.2, 0.15, M.steelD);
  box(rear, 8.8, 10.3, -0.93, 0.1, 0.9, 0.1, M.black);
  label(rear, '60 A', 6.8, 11.7, -1.04, 1.2, 0.6, { color: '#d9e5ef', background: '#263541', size: 100 });
  tube(
    rear,
    'dielectric-return',
    [
      [5.9, 2, -2],
      [5.9, 1, -0.5],
      [3.5, 1, 1],
      [3.5, 8, -3],
    ],
    0.13,
  );
  // Mobile PC terminal with sloping base, caster wheels and folded keyboard tray.
  const panel = part('panel'),
    panelPivot = group('mobile-console', panel);
  panelPivot.position.set(9.5, 0, 10);
  profile(
    panelPivot,
    'sloping-console-foot',
    [
      [-2.4, 0.25],
      [2.4, 0.25],
      [2.4, 0.55],
      [1.8, 0.95],
      [-1.7, 0.95],
      [-2.4, 0.55],
    ],
    5.2,
    M.cab2,
  );
  for (const x of [-1.9, 1.9])
    for (const z of [-1.7, 1.7]) {
      cyl(panelPivot, x, 0.2, z, 0.22, 0.2, M.black, 'x');
      box(panelPivot, x, 0.44, z, 0.25, 0.22, 0.38, M.steelD);
    }
  box(panelPivot, 0, 4.9, -0.4, 1.7, 8, 1.5, M.cab);
  box(panelPivot, 0, 5, -1.18, 1.45, 7.4, 0.08, M.cab2);
  box(panelPivot, 0, 6, -1.24, 1.18, 4.5, 0.04, M.cab);
  bolts(panelPivot, 0, 6, -1.27, 1, 4.2);
  const deck = group('PC-keyboard-deck', panelPivot);
  deck.position.set(0, 9.8, 0);
  deck.rotation.x = 0.12;
  profile(
    deck,
    'folded-keyboard-tray',
    [
      [-1.3, -0.25],
      [1.35, -0.25],
      [1.35, 0.05],
      [1.13, 0.28],
      [-1.3, 0.28],
    ],
    5.7,
    M.cab,
  );
  box(deck, -0.3, 0.3, 0, 4.25, 0.14, 1.42, M.black);
  const keyTexture = tex(1024, 420, drawTerminalKeyboard);
  const keyboard = new THREE.Mesh(
    new THREE.PlaneGeometry(4.15, 1.35),
    new THREE.MeshStandardMaterial({ map: keyTexture.tx, roughness: 0.85 }),
  );
  keyboard.rotation.x = -Math.PI / 2;
  keyboard.position.set(-0.3, 0.385, 0);
  deck.add(keyboard);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), M.black);
  mouse.scale.set(1, 0.48, 1.6);
  mouse.position.set(2, 0.36, 0.25);
  deck.add(mouse);
  tube(
    deck,
    'mouse-cable',
    [
      [2, 0.34, -0.1],
      [2.2, 0.33, -0.6],
      [1.7, 0.32, -1],
    ],
    0.018,
  );
  for (const x of [-2.65, 2.65]) for (const z of [-1.05, 1.05]) cyl(deck, x, 0.3, z, 0.035, 0.018, M.steelD);
  const controls = { buttons: {}, knobs: {} };
  for (const [id, x, color] of [
    ['start', 0.5, M.green],
    ['hold', 1.1, M.red],
    ['reset', -0.2, M.steelD],
    ['light', -1, M.steel],
    ['coolant', -1.7, M.blue],
  ]) {
    const g = group(id, deck);
    g.position.set(x, -0.06, 1.37);
    cyl(g, 0, 0, 0, 0.13, 0.05, M.steelD, 'z');
    controls.buttons[id] = cyl(g, 0, 0, 0.04, 0.09, 0.1, color, 'z');
  }
  cyl(deck, 2.45, 0.36, -0.65, 0.19, 0.08, M.yellow);
  controls.buttons.emergency = cyl(deck, 2.45, 0.49, -0.65, 0.13, 0.19, M.red);
  tube(
    panelPivot,
    'push-handle',
    [
      [-1.6, 9.4, 0.9],
      [-1.6, 8.9, 1.55],
      [-1.35, 8.75, 1.65],
      [1.35, 8.75, 1.65],
      [1.6, 8.9, 1.55],
      [1.6, 9.4, 0.9],
    ],
    0.095,
    M.steel,
  );
  const monitor = group('EX500-monitor', panelPivot);
  monitor.position.set(0, 10.3, -0.9);
  monitor.rotation.x = -0.12;
  box(monitor, 0, 1.65, 0, 5.8, 3.7, 0.3, M.black);
  box(monitor, 0, 1.65, 0.17, 5.45, 3.46, 0.04, M.steelD);
  box(monitor, 0, 1.6, -0.35, 1.4, 1.5, 0.5, M.black);
  label(monitor, 'OSCARMAX', 0, -0.075, 0.176, 1.15, 0.13, { color: '#b4bdc1', background: '#151b1e', size: 105 });
  cyl(monitor, 2.65, -0.075, 0.18, 0.026, 0.012, M.green, 'z');
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(5.28, 3.3),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
  );
  display.position.set(0, 1.65, 0.2);
  monitor.add(display);
  box(panelPivot, 0, 10.15, -0.9, 1.2, 0.18, 1, M.black);
  cyl(panelPivot, 0, 10.55, -1.1, 0.13, 1.05, M.black);
  tube(
    panelPivot,
    'console-cable',
    [
      [0, 9.8, -1.3],
      [0, 8, -1.8],
      [0.7, 1, -1.4],
      [2, 1, -2],
    ],
    0.07,
  );
  const pendant = group('remote-pendant', panelPivot);
  pendant.position.set(-3, 8.5, 0);
  pendant.rotation.z = -0.16;
  box(pendant, 0, 0, 0, 0.7, 1.45, 0.32, M.dark);
  box(pendant, 0, 0.3, 0.17, 0.52, 0.53, 0.03, M.black);
  for (let i = 0; i < 6; i++)
    cyl(
      pendant,
      -0.18 + (i % 2) * 0.36,
      -0.12 - Math.floor(i / 2) * 0.2,
      0.19,
      0.065,
      0.05,
      i === 0 ? M.red : M.steel,
      'z',
    );
  tube(
    panelPivot,
    'pendant-lead',
    [
      [-3, 7.8, 0],
      [-3, 6.8, -0.2],
      [-2.3, 6.4, -0.5],
      [-1, 7.9, -1],
    ],
    0.045,
  );
  const lamp = new THREE.PointLight(0xeaf5ff, 45, 12, 2);
  lamp.position.set(0, 13, -3.8);
  root.add(lamp);
  return {
    gate,
    oil,
    slideX,
    slideY,
    ram,
    electrode,
    stockMount,
    panelPivot,
    display,
    controls,
    lamp,
    bellows,
    xBoots,
    lightBars,
    buildElectrode(e) {
      clear(electrode);
      const material = e.material === 'graphite' ? M.graphite : M.copper;
      if (e.shape === 'round') cyl(electrode, 0, -e.length * 0.005, 0, e.w * 0.005, e.length * 0.01, material);
      else box(electrode, 0, -e.length * 0.005, 0, e.w * 0.01, e.length * 0.01, e.d * 0.01, material);
    },
    update({ S, oilLevel, door, light, hmiAngle }) {
      gate.position.set(0, 10.7 - door * 3.4, 3.65);
      oil.position.y = 9 + oilLevel * 0.01;
      oil.visible = oilLevel > 2;
      axes.position.x = S.x * 0.01;
      axes.position.z = -S.y * 0.01;
      const len = electrode.userData.length || 100;
      ram.position.set(0, 9 + (80 - S.depth + len) * 0.01, 0);
      const bottom = ram.position.y + 0.99;
      bellows.position.y = bottom;
      bellows.scale.y = Math.max(0.2, 15.07 - bottom);
      xBoots[0].position.set(-6.65 - axes.position.x, 14.25, -6);
      xBoots[0].scale.y = 4.95 + axes.position.x;
      xBoots[1].position.set(1.7, 14.25, -6);
      xBoots[1].scale.y = 4.95 - axes.position.x;
      lamp.visible = light;
      lampMaterial.emissiveIntensity = light ? 1.8 : 0;
      panelPivot.rotation.y = (hmiAngle * Math.PI) / 180;
    },
  };
}
