import * as THREE from 'three';

// Photo reconstruction: swept orange/grey terminal pedestal and the separate
// silver/orange operator station. Control caps stay separate for picking/CAD.
export function createBystronicControls({ part, kit, M, tex }) {
  const { group, box, cyl, rod, label } = kit;
  const profile = (p, name, points, width, mat, x = 0) => {
    const shape = new THREE.Shape(),
      vertices = points.map(([z, y]) => new THREE.Vector2(-z, y));
    vertices.forEach((v, i) => {
      const a = vertices[(i + vertices.length - 1) % vertices.length],
        b = vertices[(i + 1) % vertices.length],
        r = Math.min(0.35, v.distanceTo(a) * 0.35, v.distanceTo(b) * 0.35),
        before = v.clone().add(a.clone().sub(v).normalize().multiplyScalar(r)),
        after = v.clone().add(b.clone().sub(v).normalize().multiplyScalar(r));
      if (i) shape.lineTo(before.x, before.y);
      else shape.moveTo(before.x, before.y);
      shape.quadraticCurveTo(v.x, v.y, after.x, after.y);
    });
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(0, 0, -width / 2);
    geo.rotateY(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = x;
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  };
  const cable = (p, pts, r = 0.05) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((v) => new THREE.Vector3(...v))),
      o = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 8, false), M.black);
    o.name = 'control-cable';
    p.add(o);
  };
  const controls = { buttons: {} },
    indicators = [];
  const button = (p, id, x, y, z, text, material = M.cab) => {
    cyl(p, x, y, z, 0.16, 0.05, M.steelD, 'z');
    const cap = group(id + '-button', p);
    cap.position.set(x, y, z + 0.045);
    cap.userData.pressAxis = 'z';
    cyl(cap, 0, 0, 0, 0.125, 0.055, material, 'z');
    if (text) label(cap, text, 0, 0, 0.031, 0.2, 0.1, { color: '#38434a', background: '#d7dcdd', size: 70 });
    controls.buttons[id] = cap;
    return cap;
  };
  const panel = part('panel'),
    consolePivot = group('mobile-touch-console', panel);
  consolePivot.position.set(29.2, 0, 13);
  box(consolePivot, 0, 0.34, 0, 5.5, 0.18, 4.7, M.dark);
  for (const x of [-2.25, 2.25])
    for (const z of [-1.85, 1.85]) {
      cyl(consolePivot, x, 0.15, z, 0.32, 0.26, M.black);
      cyl(consolePivot, x, 0.48, z, 0.24, 0.08, M.red);
      cyl(consolePivot, x, 0.54, z, 0.065, 0.05, M.steel);
    }
  const spine = [
    [-0.6, 0.45],
    [0.35, 0.45],
    [0.1, 2.6],
    [-0.5, 6.5],
    [-0.55, 8.1],
    [-0.2, 9.8],
    [0.45, 11.2],
    [-0.2, 11.7],
    [-1.05, 10],
    [-1.35, 8.2],
    [-1.3, 6.5],
    [-0.7, 2.5],
  ];
  profile(consolePivot, 'curved-terminal-spine', spine, 1.25, M.anth);
  for (const x of [-0.78, 0.78]) {
    profile(consolePivot, 'white-terminal-edge', spine, 0.2, M.cab, x);
    profile(consolePivot, 'orange-terminal-cheek', spine, 0.11, M.red, x + Math.sign(x) * 0.13);
  }
  box(consolePivot, 0, 8.05, 1.1, 5.4, 0.11, 2.4, M.anth);
  rod(consolePivot, [-0.7, 7.75, 0.1], [-0.7, 8.0, 1.5], 0.06, M.steel);
  rod(consolePivot, [0.7, 7.75, 0.1], [0.7, 8.0, 1.5], 0.06, M.steel);
  button(consolePivot, 'hydraulic', 0, 9.2, -0.22, 'I');
  button(consolePivot, 'light', 0, 8.7, -0.36, '☼');
  for (const [key, y, z] of [
    ['hydraulic', 9.2, -0.17],
    ['light', 8.7, -0.31],
  ]) {
    const m = cyl(consolePivot, 0.32, y, z, 0.055, 0.035, M.green.clone(), 'z');
    indicators.push({ key, mesh: m });
  }
  // Articulated monitor, black bezel, silver shell and open lower grab rail.
  const monitor = group('touchscreen-tilt-bracket', consolePivot);
  monitor.position.set(0, 11.1, 0.8);
  monitor.rotation.x = -0.2;
  box(monitor, 0, 1.05, -0.15, 8.05, 4.95, 0.3, M.cab);
  box(monitor, 0, 1.15, 0.05, 7.8, 4.55, 0.12, M.black);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(7.35, 4.28),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
  );
  display.position.set(0, 1.15, 0.12);
  display.name = 'live-HMI-touch-display';
  monitor.add(display);
  box(monitor, 0, 1.05, -0.4, 4, 2.5, 0.3, M.dark);
  cyl(monitor, 0, 0.1, -0.68, 0.3, 2.4, M.steelD, 'x');
  box(consolePivot, 0, 10.9, -0.2, 1.6, 0.45, 2.2, M.steelD);
  for (const x of [-3.9, 3.9]) box(monitor, x, -1.66, -0.02, 0.14, 1.0, 0.2, M.cab);
  box(monitor, 0, -2.1, -0.02, 7.95, 0.14, 0.2, M.cab);
  label(monitor, 'Bystronic', -2.8, -1.06, 0.13, 1.25, 0.17, { color: '#dce1e3', background: '#14171b', size: 90 });
  for (const x of [-1.4, 1.4]) for (const y of [0.25, 1.8]) cyl(monitor, x, y, -0.58, 0.055, 0.05, M.steel, 'z');
  for (let i = 0; i < 12; i++) box(monitor, -2 + i * 0.36, 2.9, -0.35, 0.16, 0.035, 0.05, M.black);
  cable(consolePivot, [
    [0, 10.8, -1.5],
    [0.5, 9.8, -1.9],
    [0.6, 8, -1.8],
    [0.4, 3, -0.9],
    [0.3, 0.4, -0.2],
  ]);
  cable(
    panel,
    [
      [29.5, 0.3, 13],
      [33, 0.18, 11],
      [34, 0.16, 6],
      [28, 0.15, 5],
      [25, 0.5, 0],
    ],
    0.055,
  );
  // The operator face is tilted towards the user. The STOP mushroom is here,
  // surrounded by a yellow collar, rather than floating below the HMI screen.
  const pedal = part('pedal');
  pedal.position.set(12, 0, 14);
  const stem = [
    [-0.6, 0.35],
    [0.45, 0.35],
    [-0.35, 5.8],
    [-0.25, 6.5],
    [1.6, 7.4],
    [-0.32, 9.8],
    [-0.75, 9.9],
    [-1.1, 9.45],
    [-0.9, 6.6],
    [-1.25, 5.8],
  ];
  // Separate bent side rails leave the centre open down to the foot enclosure.
  for (const x of [-0.9, 0.9]) {
    profile(pedal, 'open-operator-side-rail', stem, 0.32, M.cab, x);
    profile(pedal, 'orange-operator-side', stem, 0.055, M.red, x + Math.sign(x) * 0.18);
  }
  box(pedal, 0, 0.65, 0.1, 1.85, 0.16, 0.65, M.steelD);
  box(pedal, 0, 0.38, 0.8, 2.8, 0.32, 2.7, M.anth);
  const operatorFace = group('inclined-STOP-control-face', pedal);
  operatorFace.position.set(0, 8.65, 0.7);
  operatorFace.rotation.x = -0.7;
  const rounded = (x, y, w, h, r) => {
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const faceShape = rounded(-1.125, -1.64, 2.25, 3.165, 0.17),
    gripHole = rounded(-0.83, -1.43, 1.66, 0.58, 0.12);
  faceShape.holes.push(gripHole);
  const faceGeo = new THREE.ExtrudeGeometry(faceShape, { depth: 0.12, bevelEnabled: false });
  faceGeo.translate(0, 0, -0.06);
  const faceMesh = new THREE.Mesh(faceGeo, M.steelD);
  faceMesh.name = 'operator-face-with-open-hand-grip';
  operatorFace.add(faceMesh);
  for (const x of [-1.14, 1.14]) rod(operatorFace, [x, -1.46, 0.04], [x, 1.34, 0.04], 0.065, M.cab);
  const layout = [
    ['hold', -0.65, 0.93, 'Ⅱ'],
    ['acknowledge', 0, 0.93, 'ACK'],
    ['reset', 0.65, 0.93, 'NEW'],
    ['startPanel', -0.65, 0.35, '▼'],
    ['retractPanel', 0.65, 0.35, '▲'],
  ];
  for (const [id, x, y, text] of layout) button(operatorFace, id, x, y, 0.09, text);
  cyl(operatorFace, 0, -0.35, 0.105, 0.29, 0.06, M.yellow, 'z');
  const stop = group('latching-emergency-STOP', operatorFace);
  stop.position.set(0, -0.35, 0.16);
  stop.userData.pressAxis = 'z';
  cyl(stop, 0, 0, 0.015, 0.13, 0.12, M.dark, 'z');
  cyl(stop, 0, 0, 0.12, 0.22, 0.12, M.red, 'z');
  cyl(stop, 0, 0, 0.19, 0.19, 0.025, M.red, 'z');
  controls.buttons.emergency = stop;
  label(stop, '↻', 0, 0, 0.207, 0.26, 0.18, { color: '#fff', background: '#f44d34', size: 90 });
  label(operatorFace, 'STOP', 0, -0.82, 0.075, 0.48, 0.16, { color: '#fff', background: '#737e86', size: 100 });
  for (const x of [-0.82, 0.82]) rod(operatorFace, [x, -1.52, 0.04], [x, -1.52, 0.3], 0.075, M.steel);
  rod(operatorFace, [-0.82, -1.52, 0.3], [0.82, -1.52, 0.3], 0.1, M.steel);
  for (const x of [-1, 1]) for (const y of [-1.38, 1.38]) cyl(operatorFace, x, y, 0.09, 0.035, 0.04, M.steel, 'z');
  // Two independent foot pads under a protective hood, with front access.
  for (const x of [-1.32, 1.32]) box(pedal, x, 0.84, 1, 0.14, 0.84, 2.4, M.anth);
  box(pedal, 0, 1.22, 0.7, 2.8, 0.13, 1.8, M.anth);
  for (const [id, x] of [
    ['start', -0.62],
    ['retract', 0.62],
  ]) {
    const pad = group(id + '-foot-pad', pedal);
    pad.position.set(x, 0.62, 1.35);
    pad.userData.pressAxis = 'y';
    controls.buttons[id] = pad;
    box(pad, 0, 0, 0, 0.95, 0.12, 1.8, M.steelD);
    for (let i = 0; i < 9; i++) box(pad, 0, 0.07, -0.7 + i * 0.17, 0.85, 0.035, 0.035, M.black);
  }
  cable(
    pedal,
    [
      [0, 0.5, -0.45],
      [0.5, 0.2, -0.7],
      [2, 0.15, -0.8],
      [4, 0.15, -2],
      [6, 0.3, -8],
    ],
    0.06,
  );
  cyl(pedal, 0, 0.5, -0.48, 0.12, 0.24, M.black, 'z');
  return { panel, pedal, consolePivot, monitor, display, operatorFace, controls, indicators };
}
