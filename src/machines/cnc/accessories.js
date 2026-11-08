import * as THREE from 'three';

// Photo-adjusted front chip drawer: 680 mm outboard,
// 290 mm behind the front; 1700 mm ADDITIONAL withdrawal space.
// The matching tray is 400 mm wide along Z (explicit in the newer PDF p. 52).
// Sheet thicknesses, internal length and pump details are photo estimates.
export const CHIP_DRAWER = { outerX: -19.05, innerX: 5.15, z: 3.7, depth: 4, rim: 2.65, travel: 17 };

// C42 layout, in 100 mm units: cabin 2450 mm, conveyor reach 1710 mm,
// ICS footprint 1110 × 1630 mm, recooler 740 × 950 mm. C32 scales by cabin width.
export function createAccessories(parent, M, scale, halfWidth = 11.4 * scale) {
  const equipment = {},
    k = halfWidth / 12.25;
  const housing = M.cab2.clone();
  housing.color.setHex(0x626a6e).convertSRGBToLinear();
  const group = (name) => {
    const g = new THREE.Group();
    g.name = name;
    g.scale.setScalar(k);
    parent.add(g);
    equipment[name] = g;
    return g;
  };
  const box = (g, x, y, z, w, h, d, m = housing) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const cyl = (g, x, y, z, r, h, m = M.steelD) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  const link = (g, a, b, w, d, m = housing) => {
    const p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b),
      v = q.clone().sub(p);
    const o = box(g, 0, 0, 0, w, v.length(), d, m);
    o.position.copy(p).add(q).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    return o;
  };
  const hose = (g, pts, r = 0.12) => {
    g.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 8, false),
        M.black,
      ),
    );
  };
  const wheels = (g, x, z, w, d) => {
    for (const dx of [-w / 2, w / 2])
      for (const dz of [-d / 2, d / 2]) {
        box(g, x + dx, 0.65, z + dz, 0.15, 0.35, 0.35, M.steel);
        cyl(g, x + dx, 0.32, z + dz, 0.27, 0.2, M.black).rotation.z = Math.PI / 2;
      }
  };
  const profile = (g, points, z, depth, mat = housing) => {
    const sh = new THREE.Shape();
    points.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
    sh.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), mat);
    mesh.position.z = z;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const rod = (g, a, b, r, mat = M.steelD) => {
    const p = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b),
      d = q.clone().sub(p),
      mesh = cyl(g, 0, 0, 0, r, d.length(), mat);
    mesh.position.copy(p).add(q).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return mesh;
  };
  const fasteners = (g, points) => {
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 6), M.steelD, points.length),
      q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    points.forEach((p, i) =>
      mesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(...p), q, new THREE.Vector3(1, 1, 1))),
    );
    g.add(mesh);
  };
  // Open, folded reservoir at the left base, not a narrow trough across the front.
  const drawer = new THREE.Group();
  drawer.name = 'pull-out-chip-pan';
  drawer.scale.setScalar(k);
  parent.add(drawer);
  const { outerX: panOuter, innerX: panInner, z: panZ, depth: panDepth, rim } = CHIP_DRAWER,
    mid = (panOuter + panInner) / 2;
  const tray = new THREE.Group();
  tray.name = 'chip-drawer-open-tray';
  drawer.add(tray);
  box(tray, mid, 1.06, panZ, panInner - panOuter - 0.35, 0.14, panDepth - 0.4, M.steelD);
  // A shallow return at the bottom, sloping outer folds and narrow rolled lips.
  const wall = [
    [panOuter, 1.35],
    [panOuter + 0.22, 1.05],
    [panInner - 0.2, 1.05],
    [panInner, 1.35],
    [panInner, rim],
    [panOuter, rim],
  ];
  for (const z of [panZ - panDepth / 2, panZ + panDepth / 2 - 0.12]) {
    profile(tray, wall, z, 0.12);
    box(tray, mid, rim, z + 0.06, panInner - panOuter, 0.12, 0.24, housing);
    fasteners(tray, [
      [panOuter + 0.3, 1.65, z + 0.14],
      [panInner - 0.3, 1.65, z + 0.14],
    ]);
  }
  for (const x of [panOuter, panInner]) {
    const end = profile(
      tray,
      [
        [-panDepth / 2, 1.35],
        [-panDepth / 2 + 0.2, 1.05],
        [panDepth / 2 - 0.2, 1.05],
        [panDepth / 2, 1.35],
        [panDepth / 2, rim],
        [-panDepth / 2, rim],
      ],
      0,
      0.12,
    );
    end.rotation.y = Math.PI / 2;
    end.position.set(x, 0, panZ);
    box(tray, x, rim, panZ, 0.25, 0.12, panDepth, housing);
  }
  box(tray, mid, 1.145, panZ, panInner - panOuter - 0.65, 0.025, panDepth - 0.65, M.dark).name =
    'chip-drawer-recessed-floor';
  for (const z of [panZ - 1.05, panZ + 1.05]) box(drawer, panOuter - 0.17, 1.95, z, 0.3, 0.22, 0.2, M.steelD);
  rod(drawer, [panOuter - 0.32, 1.95, panZ - 1.05], [panOuter - 0.32, 1.95, panZ + 1.05], 0.095, M.black).name =
    'chip-drawer-pull-handle';
  // The pump stands on the fixed rear reservoir, outside the hatched withdrawal
  // aisle in the plan. It must not follow the removable chip drawer.
  const reservoir = new THREE.Group();
  reservoir.name = 'chip-drawer-fixed-reservoir';
  reservoir.scale.setScalar(k);
  parent.add(reservoir);
  const tankInner = -12.38,
    tankRear = -10.85,
    tankFront = panZ - panDepth / 2 - 0.32,
    tankMid = (panOuter + tankInner) / 2,
    tankZ = (tankRear + tankFront) / 2,
    tankWidth = tankInner - panOuter,
    tankDepth = tankFront - tankRear;
  const tank = new THREE.Group();
  tank.name = 'chip-reservoir-folded-tank';
  reservoir.add(tank);
  box(tank, tankMid, 0.8, tankZ, tankWidth - 0.25, 0.2, tankDepth - 0.25);
  for (const z of [tankRear, tankFront - 0.12])
    profile(
      tank,
      [
        [panOuter + 0.18, 0.8],
        [panOuter, 1.06],
        [panOuter, 2.3],
        [tankInner, 2.3],
        [tankInner, 1.06],
        [tankInner - 0.18, 0.8],
      ],
      z,
      0.12,
    );
  for (const x of [panOuter, tankInner]) {
    box(tank, x, 1.61, tankZ, 0.12, 1.38, tankDepth);
    box(tank, x, 2.32, tankZ, 0.24, 0.14, tankDepth + 0.12, M.steelD);
    box(tank, x, 0.98, tankZ, 0.22, 0.14, tankDepth, M.steelD);
  }
  for (const z of [tankRear, tankFront]) box(tank, tankMid, 2.32, z, tankWidth, 0.14, 0.24, M.steelD);
  // Split lids, a shallow recessed forward deck and an exposed lower return.
  box(reservoir, tankMid, 2.29, (tankRear - 6.25) / 2, tankWidth - 0.24, 0.12, -6.25 - tankRear - 0.16, M.steelD).name =
    'chip-reservoir-pump-lid';
  box(
    reservoir,
    tankMid,
    2.19,
    (-6.25 + tankFront) / 2,
    tankWidth - 0.3,
    0.12,
    tankFront + 6.25 - 0.15,
    M.steelD,
  ).name = 'chip-reservoir-recessed-lid';
  for (const z of [-5.9, -4.9, -3.9]) box(reservoir, tankMid, 2.27, z, tankWidth - 0.6, 0.06, 0.1, M.dark);
  for (const z of [tankRear + 0.4, tankFront - 0.4])
    box(reservoir, tankMid, 0.54, z, tankWidth - 0.6, 0.32, 0.4, M.steelD);
  const pump = new THREE.Group();
  pump.name = 'chip-drawer-coolant-pump';
  pump.position.set(tankMid, -0.3, -8.15);
  reservoir.add(pump);
  box(pump, 0, rim + 0.04, 0, 2.6, 0.16, 2.45, M.steelD);
  cyl(pump, 0, rim + 0.18, 0, 0.58, 0.18);
  cyl(pump, 0, 3.25, 0, 0.32, 1.15);
  cyl(pump, 0, 4.25, 0, 0.48, 1.3, M.anth);
  cyl(pump, 0, 4.96, 0, 0.5, 0.14);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    box(pump, Math.cos(a) * 0.49, 4.25, Math.sin(a) * 0.49, 0.055, 1.15, 0.055, M.steelD);
  }
  box(pump, 0.55, 4.24, 0, 0.36, 0.5, 0.55, M.black);
  rod(pump, [0.2, 3.12, 0.4], [1, 3.12, 0.4], 0.1);
  rod(pump, [0.82, 3.25, 0.17], [0.82, 3.25, 0.63], 0.065, M.red);
  hose(
    pump,
    [
      [0.6, 3.1, 0.4],
      [1.25, 2.9, 0.55],
      [1.45, 2, 0.8],
    ],
    0.09,
  );
  // Compact rear motor reservoir; its front meets the relocated drawer.
  reservoir.scale.z = k * 0.3;
  reservoir.position.z = tankFront * (1 - 0.3) * k;
  pump.scale.set(0.8, 0.8, 0.8 / 0.3);
  // Compact wheel forks sit under the reservoir, rather than hovering on rails.
  for (const x of [panOuter + 0.65, panInner - 0.65])
    for (const z of [panZ - panDepth / 2 + 0.55, panZ + panDepth / 2 - 0.55]) {
      const fork = new THREE.Group();
      fork.name = 'chip-drawer-wheel';
      fork.position.set(x, 0, z);
      drawer.add(fork);
      box(fork, 0, 0.72, 0, 0.65, 0.12, 0.62, M.steelD);
      for (const side of [-1, 1]) box(fork, 0, 0.51, side * 0.22, 0.48, 0.42, 0.08, M.steelD);
      const wheel = cyl(fork, 0, 0.35, 0, 0.32, 0.34, M.black);
      wheel.rotation.x = Math.PI / 2;
      const hub = cyl(fork, 0, 0.35, 0.185, 0.13, 0.035, M.steel);
      hub.rotation.x = Math.PI / 2;
    }
  for (const z of [panZ - panDepth / 2 + 0.55, panZ + panDepth / 2 - 0.55])
    box(drawer, mid, 0.88, z, panInner - panOuter - 0.3, 0.24, 0.45, M.steelD);
  const panRails = new THREE.Group();
  panRails.name = 'chip-pan-guide-rails';
  panRails.scale.setScalar(k);
  parent.add(panRails);
  for (const z of [panZ - panDepth / 2 - 0.17, panZ + panDepth / 2 + 0.17])
    box(panRails, -3.5, 1.45, z, 17.5, 0.2, 0.18, M.steelD);
  const chipPan = { object: drawer, open: false, amount: 0, travel: CHIP_DRAWER.travel * k };
  const conveyor = group('conveyor'),
    flights = [];
  // Enclosed hinge-belt conveyor, folded side sheets and a continuous rising hood.
  const cheek = [
    [-12.1, 1.1],
    [-17.2, 1.1],
    [-24.2, 8.2],
    [-26.35, 8.8],
    [-26.35, 10],
    [-24.9, 10.8],
    [-23.5, 10.65],
    [-16.1, 3.05],
    [-12.1, 3.05],
  ];
  for (const z of [4.7, 8.15]) {
    const side = profile(conveyor, cheek, z, 0.13);
    side.name = 'conveyor-folded-side';
    fasteners(conveyor, [
      [-13, 2.4, z + 0.14],
      [-16, 2.3, z + 0.14],
      [-19.5, 5, z + 0.14],
      [-23.8, 9.4, z + 0.14],
    ]);
  }
  box(conveyor, -14.1, 1.15, 6.5, 4.1, 0.18, 3.5).name = 'chip-conveyor-inlet';
  link(conveyor, [-16.3, 1.4, 6.5], [-24.3, 8.5, 6.5], 0.18, 3.5);
  const belt = link(conveyor, [-16.05, 2.9, 6.5], [-24.25, 9.4, 6.5], 0.12, 2.9, M.dark);
  for (let i = 0; i < 14; i++) flights.push(box(conveyor, 0, 0, 0, 0.15, 0.18, 2.75, M.steelD));
  link(conveyor, [-16.1, 3.12, 6.5], [-23.55, 10.7, 6.5], 0.16, 3.5);
  box(conveyor, -14.1, 3.12, 6.5, 4, 0.14, 3.5);
  const hood = new THREE.Group();
  hood.name = 'chip-conveyor-discharge-hood';
  conveyor.add(hood);
  // Cantilevered rectangular canopy over the cart, with an open downward throat.
  box(hood, -26.9, 10.85, 6.5, 5.1, 0.16, 3.75, M.dark);
  for (const z of [4.63, 8.24]) box(hood, -26.9, 10.2, z, 5.1, 1.3, 0.14);
  box(hood, -29.4, 10.2, 6.5, 0.14, 1.3, 3.75);
  box(hood, -24.4, 10.15, 6.5, 0.14, 1.3, 3.75);
  for (const z of [5.1, 7.9]) box(hood, -26, 9.2, z, 3.2, 0.9, 0.12);
  for (const x of [-27.6, -24.4]) box(hood, x, 9.2, 6.5, 0.12, 0.9, 2.8);
  for (const z of [5.02, 8]) {
    box(hood, -26, 8.7, z, 3.3, 0.45, 0.05, M.yellow);
    for (let i = 0; i < 6; i++)
      profile(
        hood,
        [
          [-27.6 + i * 0.55, 8.47],
          [-27.34 + i * 0.55, 8.47],
          [-27.56 + i * 0.55, 8.92],
          [-27.82 + i * 0.55, 8.92],
        ],
        z + 0.03,
        0.02,
        M.black,
      );
  }
  // Gear motor at the foot of the inclined conveyor, separate from its head axle.
  box(conveyor, -17.1, 2.0, 3.7, 1.5, 1.35, 1.4, M.steelD);
  cyl(conveyor, -17.1, 3.5, 3.7, 0.53, 1.65, M.anth);
  cyl(conveyor, -17.1, 4.4, 3.7, 0.57, 0.2, M.steelD);
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI) / 7;
    box(conveyor, -17.1 + Math.cos(a) * 0.54, 3.5, 3.7 + Math.sin(a) * 0.54, 0.07, 1.5, 0.07, M.steelD);
  }
  hose(
    conveyor,
    [
      [-17.6, 2.4, 3.7],
      [-18, 2.5, 3.2],
      [-18.2, 1.5, 4.5],
    ],
    0.08,
  );
  rod(conveyor, [-24.7, 9.6, 4.5], [-24.7, 9.6, 8.5], 0.18, M.steelD);
  for (const z of [4.9, 8.1]) {
    link(conveyor, [-20.4, 0.85, z], [-20.4, 5, z], 0.22, 0.22, M.steelD);
    box(conveyor, -20.4, 0.8, z, 0.65, 0.15, 0.75, M.steelD);
  }
  wheels(conveyor, -20.4, 6.5, 0.6, 3.4);
  // Flared, open tipping cart. The lower nose is folded back, not a solid box.
  const cart = new THREE.Group();
  cart.name = 'chip-cart-chassis';
  cart.position.set(-26.55, 0, 6.5);
  conveyor.add(cart);
  for (const z of [-2.3, 2.3]) box(cart, 0, 0.85, z, 4.9, 0.35, 0.3, M.steelD);
  for (const x of [-2.25, 2.25]) box(cart, x, 0.85, 0, 0.3, 0.35, 4.9, M.steelD);
  wheels(cart, 0, 0, 4.4, 4.5);
  const bucket = new THREE.Group();
  bucket.name = 'open-tipping-chip-cart';
  bucket.position.y = 2.15;
  cart.add(bucket);
  const outline = [
    [-2.8, 5.35],
    [2.8, 5.35],
    [1.95, 0.25],
    [-0.8, -0.55],
    [-2.8, 2.05],
  ];
  for (const z of [-2.85, 2.72]) {
    profile(bucket, outline, z, 0.13);
    fasteners(bucket, [
      [-2.55, 4.9, z + 0.14],
      [2.5, 4.9, z + 0.14],
      [1.7, 0.5, z + 0.14],
      [-0.6, -0.2, z + 0.14],
    ]);
    box(bucket, 0, 5.39, z, 5.7, 0.14, 0.2);
  }
  // Recessed darker inner liners make the open hopper readable in ambient light.
  for (const z of [-2.69, 2.68]) profile(bucket, outline, z, 0.02, M.dark);
  // Join the lower four contour segments; leave the entire top mouth open.
  for (let i = 1; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    link(bucket, [a[0], a[1], 0], [b[0], b[1], 0], 0.12, 5.7);
    link(bucket, [a[0] + 0.02, a[1] + 0.06, 0], [b[0] + 0.02, b[1] + 0.06, 0], 0.02, 5.35, M.dark);
  }
  rod(cart, [0, 2.15, -3.04], [0, 2.15, 3.04], 0.15, M.steelD);
  for (const z of [-2.95, 2.95]) {
    profile(
      cart,
      [
        [-0.55, 1],
        [0.55, 1],
        [0.32, 2.5],
        [-0.32, 2.5],
      ],
      z,
      0.12,
      M.steelD,
    );
    rod(bucket, [-2.93, 4.6, z], [-2.93, 3.7, z], 0.08, M.black);
  }
  box(cart, -2.4, 1.1, 0, 0.18, 0.45, 0.7, M.red); // tipping latch
  const chipCart = { object: bucket, open: false, amount: 0 };
  // Small yellow/red isolator on the discharge hood, as in the reference.
  box(hood, -26.43, 10.12, 6.5, 0.12, 0.38, 0.42, M.yellow);
  rod(hood, [-26.52, 10, 6.5], [-26.52, 10.25, 6.5], 0.065, M.red);

  const coolant = group('coolant');
  coolant.position.x = -2.8 * k; // 900 mm service aisle to the cabinet
  // Broad low reservoir, removable lid and raised paper-filter module.
  box(coolant, -24, 4.55, -9.4, 11.1, 7.5, 16.3);
  box(coolant, -24, 8.36, -9.4, 11.2, 0.18, 16.4, M.steelD);
  for (const z of [-17.5, -1.3]) box(coolant, -24, 8.65, z, 11, 0.4, 0.13);
  for (const x of [-29.45, -18.55]) box(coolant, x, 8.65, -9.4, 0.13, 0.4, 16.2);
  box(coolant, -24, 4.7, -1.16, 10.6, 6.8, 0.08);
  fasteners(coolant, [
    [-29.1, 1.6, -1.1],
    [-18.9, 1.6, -1.1],
    [-29.1, 7.9, -1.1],
    [-18.9, 7.9, -1.1],
  ]);
  box(coolant, -19.25, 5.6, -1.04, 0.35, 2.5, 0.1, M.black);
  box(coolant, -19.25, 5.6, -0.98, 0.13, 2.1, 0.04, M.steel); // level gauge
  box(coolant, -23.2, 9.1, -9.1, 7.5, 1.3, 10.7, M.dark);
  // Cross section in Y/Z, extruded along X: sloping filter face and rear roll.
  const head = profile(
    coolant,
    [
      [14.8, 9.7],
      [14.8, 18.4],
      [12.1, 19.0],
      [4.9, 15.4],
      [3.8, 11.0],
      [5.8, 9.7],
    ],
    0,
    7.1,
  );
  head.name = 'ICS-sloping-filter-housing';
  head.rotation.y = Math.PI / 2;
  head.position.x = -26.8;
  for (const x of [-26.85, -19.65]) {
    // Narrow cheek around the roll opening.
    const cheek = profile(
      coolant,
      [
        [14.8, 17.8],
        [14.8, 19.35],
        [11.8, 19.35],
        [11.2, 18.5],
      ],
      0,
      0.12,
      M.steelD,
    );
    cheek.rotation.y = Math.PI / 2;
    cheek.position.x = x;
  }
  const paper = M.cab.clone();
  paper.color.setHex(0xd4d7d5).convertSRGBToLinear();
  rod(coolant, [-26.55, 18.95, -12.8], [-19.9, 18.95, -12.8], 0.48, paper);
  rod(coolant, [-26.55, 18.35, -11.7], [-19.9, 18.35, -11.7], 0.2, M.steel);
  // Parallel folds and a recessed handle on the angled service face.
  for (const z of [-10, -9.55, -9.1]) {
    const y = 19 - (12.1 + z) * 0.5;
    rod(coolant, [-26.4, y + 0.025, z], [-20.1, y + 0.025, z], 0.045, M.steelD);
  }
  rod(coolant, [-24.6, 17.3, -8.5], [-22, 17.3, -8.5], 0.075, M.black);
  for (const x of [-26.3, -20.2]) rod(coolant, [x, 12.1, -4.05], [x, 13.7, -4.45], 0.06, M.steelD);
  const makePump = (g, x, z, height) => {
    cyl(g, x, 8.9, z, 0.85, 0.25, M.steelD);
    cyl(g, x, 10.6, z, 0.37, 3.5, M.steelD);
    cyl(g, x, 12.3 + height / 2, z, 0.64, height, M.anth);
    cyl(g, x, 12.2, z, 0.76, 0.22, M.steelD);
    cyl(g, x, 12.35 + height, z, 0.7, 0.24, M.steelD);
    for (let i = 0; i < 14; i++) {
      const a = (i * Math.PI) / 7;
      box(g, x + Math.cos(a) * 0.65, 12.3 + height / 2, z + Math.sin(a) * 0.65, 0.08, height, 0.08, M.steelD);
    }
    box(g, x - 0.72, 12.8, z, 0.4, 0.65, 0.65, M.anth);
    hose(
      g,
      [
        [x, 9.5, z],
        [x + 0.6, 9.7, z + 0.8],
        [-26.7, 10.8, z + 1.1],
      ],
      0.13,
    );
    rod(g, [x + 0.3, 10.2, z + 0.3], [x + 0.9, 10.2, z + 0.3], 0.09, M.red);
  };
  const pump40 = new THREE.Group();
  pump40.name = 'ICS40';
  coolant.add(pump40);
  makePump(pump40, -28.2, -7.5, 2.25);
  const pump80 = new THREE.Group();
  pump80.name = 'ICS80';
  coolant.add(pump80);
  for (const z of [-6.4, -11]) makePump(pump80, -28.2, z, 2.7);
  // The high rear separator/control tower distinguishes the ICS 80 configuration.
  box(pump80, -28, 15.0, -15.45, 2.65, 12.8, 3.6);
  box(pump80, -28, 20.1, -13.6, 2.3, 1.8, 0.12, M.steelD);
  for (let i = 0; i < 7; i++) box(pump80, -28, 19.5 + i * 0.16, -13.51, 1.9, 0.05, 0.035, M.black);
  hose(
    pump80,
    [
      [-28, 17, -13.6],
      [-27.2, 17.3, -12.9],
      [-26.7, 17.5, -12],
    ],
    0.12,
  );
  hose(coolant, [
    [-18.45, 4, -7],
    [-16, 2, -6],
    [-9.45, 2.8, -6],
  ]);
  hose(
    coolant,
    [
      [-18.45, 4.5, -7.5],
      [-16, 2.5, -6.5],
      [-9.45, 3.3, -6.5],
    ],
    0.1,
  );
  wheels(coolant, -24, -9.4, 10.3, 15.5);

  const recooler = group('recooler');
  recooler.position.x = -2.8 * k;
  for (const x of [-37.8, -30.5]) box(recooler, x, 8.8, -9.4, 0.1, 16.1, 9.5);
  box(recooler, -34.15, 8.8, -14.1, 7.4, 16.1, 0.1);
  for (const y of [0.8, 16.8]) box(recooler, -34.15, y, -9.4, 7.4, 0.15, 9.5);
  // Front service leaf of the optional recooler (swing shown in the layout).
  const coolerDoor = new THREE.Group();
  coolerDoor.name = 'recooler-service-door';
  coolerDoor.position.set(-37.7, 1.2, -4.58);
  recooler.add(coolerDoor);
  box(coolerDoor, 3.55, 7.65, 0, 7.1, 15.3, 0.12);
  for (const y of [2.8, 7.3, 11.8]) box(coolerDoor, 3.55, y, 0.08, 6.8, 0.08, 0.08, M.dark);
  box(coolerDoor, 6.7, 8, 0.14, 0.12, 0.7, 0.16, M.black);
  for (const y of [1, 13.5]) box(coolerDoor, 0, y, 0.12, 0.18, 0.4, 0.18, M.steelD);
  box(recooler, -34.15, 8, -10, 5.8, 11, 3, M.dark);
  for (let i = 0; i < 15; i++) box(recooler, -34.15, 3 + i * 0.7, -8.4, 5.5, 0.13, 0.16, M.steelD);
  const serviceDoors = [
    {
      hinge: coolerDoor,
      label: 'Servisné dvere dochladzovača',
      side: 1,
      width: 7.1,
      height: 15.3,
      open: false,
      angle: 0,
      enabled: () => recooler.visible,
    },
  ];
  cyl(recooler, -34.15, 16.96, -9.4, 2.8, 0.1, M.dark);
  for (let i = 0; i < 13; i++) box(recooler, -37.1 + i * 0.49, 17.04, -9.4, 0.07, 0.05, 7.9, M.steelD);
  for (const x of [-37.2, -31.1]) box(recooler, x, 17.1, -9.4, 0.13, 0.22, 8.2);
  for (const z of [-13.45, -5.35]) box(recooler, -34.15, 17.1, z, 6.2, 0.22, 0.13);
  box(coolerDoor, 3.55, 10.9, 0.1, 2.1, 2.1, 0.12, M.cab2);
  box(coolerDoor, 3.55, 11.35, 0.18, 1.25, 0.52, 0.08, M.black);
  for (const [x, mat] of [
    [3.1, M.red],
    [3.9, M.steelD],
  ]) {
    const button = cyl(coolerDoor, x, 10.45, 0.22, 0.11, 0.05, mat);
    button.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 14; i++) box(recooler, -37.9, 3 + i * 0.85, -9.4, 0.08, 0.14, 8.4, M.dark);
  hose(recooler, [
    [-30.45, 3, -8],
    [-30, 2.5, -8],
    [-29.55, 3, -8],
  ]);
  wheels(recooler, -34.15, -9.4, 6.7, 8.8);
  // All external modules share the same outlet datum. Keep their mutual aisle
  // clearances while aligning the conveyor with the drawer opening, not the front.
  for (const g of Object.values(equipment)) g.position.z = (CHIP_DRAWER.z - 6.5) * k;
  let phase = 0;
  const update = (state, dt) => {
    const mode = state.accessorySetup || 'none';
    drawer.visible = mode === 'none';
    panRails.visible = drawer.visible;
    reservoir.visible = drawer.visible;
    if (!drawer.visible) chipPan.open = false;
    chipPan.amount = THREE.MathUtils.damp(chipPan.amount, chipPan.open ? 1 : 0, 5, dt);
    drawer.position.x = -chipPan.amount * chipPan.travel;
    conveyor.visible = ['conveyor', 'ics40', 'ics80', 'ics80cooler'].includes(mode);
    coolant.visible = ['ics40', 'ics80', 'ics80cooler'].includes(mode);
    pump40.visible = mode === 'ics40';
    pump80.visible = mode === 'ics80' || mode === 'ics80cooler';
    recooler.visible = mode === 'ics80cooler';
    if (state.running && conveyor.visible) phase = (phase + dt * 0.22) % 1;
    chipCart.amount = THREE.MathUtils.damp(chipCart.amount, chipCart.open && !state.running ? 1 : 0, 4, dt);
    chipCart.object.rotation.z = chipCart.amount * 0.6;
    flights.forEach((f, i) => {
      const u = (i / flights.length + phase) % 1;
      f.position.set(-16.05 - 8.2 * u, 3.02 + 6.5 * u, 6.5);
      f.quaternion.copy(belt.quaternion);
    });
  };
  update({}, 0);
  return { equipment, update, chipPan, chipCart, serviceDoors };
}
