import * as THREE from 'three';
import { modelKit } from './modelKit';
import { createBystronicControls } from './bystronicControls';
import { XPERT320, OPEN_TIP, profileSection, supportDepth } from './pressBrakeProcess';
import { BOX_PART, boxPose, buildBoxPart, setBoxAngles } from './brakePart';

export const BRAKE_DIE_TOP = 11;
// sada segmentov razníka (mm) – skladá sa od najdlhšieho na dĺžku ohybu mínus vôľa
export const PUNCH_SEGMENTS = [100, 50, 40, 20, 15, 10];
// Millimetres from the supplied 320/4300 data sheet, converted at 1 unit = 100 mm.
// Covers, optional supports and controls are reconstructed from the photographs.
export function createBystronicModel({ root, G, M, tex }) {
  const kit = modelKit(root, M, tex),
    { group, box, cyl, rod, label, bolts, clear } = kit;
  const part = (k) => {
    const g = group(k);
    g.userData.part = k;
    G[k] = g;
    return g;
  };
  const profile = (p, name, points, width, mat, x = 0) => {
    const s = new THREE.Shape();
    points.forEach(([z, y], i) => (i ? s.lineTo(-z, y) : s.moveTo(-z, y)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
    g.translate(0, 0, -width / 2);
    g.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.position.x = x;
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  };
  const tube = (p, pts, r, mat = M.black) => {
    const m = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((v) => new THREE.Vector3(...v))), 32, r, 8, false),
      mat,
    );
    p.add(m);
    return m;
  };
  const frame = part('ram');
  for (const s of [-1, 1]) {
    const x = s * 22.525;
    profile(
      frame,
      'C-side-frame',
      [
        [-14.5, 0.35],
        [5.5, 0.35],
        [5.5, 9.5],
        [-2, 9.5],
        [-2, 19.4],
        [5.5, 19.4],
        [5.5, 31.7],
        [-14.5, 31.7],
      ],
      7.55,
      M.cab,
      x,
    );
    box(frame, x, 0.35, -4.5, 7.65, 0.65, 19.9, M.dark);
    // Sloping lower cheeks of the white front covers.
    profile(
      frame,
      'upper-cheek',
      [
        [3.5, 20.4],
        [5.5, 20.4],
        [6.1, 21.1],
        [6.1, 31.45],
        [3.5, 31.7],
      ],
      7.5,
      M.cab,
      x,
    );
    box(frame, s * 26.34, 16.2, -4.5, 0.06, 30.3, 19.8, M.cab);
    box(frame, s * 26.38, 16.2, 1.8, 0.035, 30.3, 0.22, M.red);
    for (const y of [7.3, 22.1]) box(frame, s * 26.39, y, -6.1, 0.035, 0.025, 16.4, M.dark);
    for (const y of [2, 16, 29]) for (const z of [-12.9, 0.8]) cyl(frame, s * 26.42, y, z, 0.04, 0.035, M.steelD, 'x');
    for (const z of [-12.5, 3.5]) {
      cyl(frame, x, 0.2, z, 0.65, 0.35, M.steelD);
      cyl(frame, x, 0.58, z, 0.22, 0.45, M.steel);
    }
  }
  box(frame, 0, 31.4, -4.5, 37.5, 0.6, 20, M.cab);
  const rearWall = box(frame, 0, 15.9, -14.45, 37.5, 30.8, 0.16, M.cab2);
  // Separate rear cabinet doors, louver packs, hinges and service latches.
  const back = part('servis');
  for (const x of [-14, 0, 14]) {
    box(back, x, 15.8, -14.58, 13.8, 30.4, 0.12, M.cab);
    for (const sx of [-1, 1]) for (const y of [4, 26]) box(back, x + sx * 6.6, y, -14.69, 0.14, 0.65, 0.12, M.steelD);
    box(back, x + 5.8, 15.8, -14.75, 0.14, 1.1, 0.12, M.black);
    for (const xx of [x - 3.7, x + 3.7])
      for (let i = 0; i < 28; i++) box(back, xx, 4.6 + i * 0.47, -14.68, 2.6, 0.13, 0.08, M.steelD);
    box(back, x, 23, -14.66, 13.6, 0.025, 0.025, M.dark);
  }
  label(back, 'Bystronic', 0, 25.8, -14.66, 2.6, 1.2, {
    color: '#fff',
    background: '#f34b32',
    rotate: Math.PI,
    size: 100,
  });
  // Rounded black visor, with its characteristic falling ends and raised red tab.
  const hood = part('kryty'),
    hs = new THREE.Shape();
  hs.moveTo(-18.75, 31.6);
  hs.lineTo(18.75, 31.6);
  hs.quadraticCurveTo(18.55, 30.8, 18.3, 29.6);
  hs.lineTo(17.6, 25.5);
  hs.quadraticCurveTo(17.35, 24.7, 16.5, 24.7);
  hs.lineTo(-16.5, 24.7);
  hs.quadraticCurveTo(-17.35, 24.7, -17.6, 25.5);
  hs.lineTo(-18.3, 29.6);
  hs.quadraticCurveTo(-18.55, 30.8, -18.75, 31.6);
  const hg = new THREE.ExtrudeGeometry(hs, {
    depth: 0.35,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.06,
    bevelThickness: 0.06,
  });
  hg.translate(0, 0, 5.85);
  const hm = new THREE.Mesh(hg, M.visor);
  hm.name = 'rounded-black-visor';
  hm.castShadow = true;
  hood.add(hm);
  label(hood, 'Xpert Pro 320', -10.5, 25.7, 6.28, 4.1, 0.42, { color: '#f2f4f4', background: '#24272b', size: 86 });
  profile(
    hood,
    'raised-Bystronic-tab',
    [
      [6.2, 29],
      [7.05, 29],
      [7.05, 31.7],
      [6.35, 31.7],
      [5.95, 31.1],
    ],
    2.2,
    M.red,
    -11.9,
  );
  label(hood, 'Bystronic', -11.9, 31.2, 7.075, 1.8, 0.32, { color: '#fff', background: '#f44b32', size: 100 });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xe7f7ff,
    emissive: 0xc6edff,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  box(hood, 0, 24.42, 4.85, 35.9, 0.16, 0.35, M.steelD);
  box(hood, 0, 24.35, 5.02, 35.5, 0.09, 0.08, lightMat);
  // Synchronised Y1/Y2 ram and hydraulic cylinders; all tooling moves with it.
  const ramPart = part('baran'),
    ram = group('synchronised-Y1-Y2', ramPart);
  box(ram, 0, 19.1, 2.05, 43, 8.4, 3.4, M.anth);
  box(ram, 0, 22.7, 3.79, 42.8, 1.15, 0.12, M.cab2);
  box(ram, 0, 22.08, 3.88, 42.8, 0.25, 0.07, M.red);
  box(ram, 0, 14.95, 2, 43, 0.32, 1.3, M.black);
  box(ram, 0, 14.82, 2.65, 43, 0.3, 0.12, M.steel);
  for (const s of [-1, 1]) {
    cyl(frame, s * 20, 26, -1, 0.85, 7.3, M.anth);
    cyl(ram, s * 20, 21, -1, 0.42, 7.2, M.steel);
    box(frame, s * 21.6, 19.5, 1.8, 0.3, 10, 1.5, M.steelD);
    box(ram, s * 21.4, 18.1, 1.8, 0.2, 5.3, 1.35, M.steel);
    tube(
      frame,
      [
        [s * 20, 29.3, -1],
        [s * 20, 30, -3],
        [s * 15, 30, -8],
        [s * 15, 20, -10],
      ],
      0.09,
    );
  }
  // Orange tooling scales and individual clamps.
  const ruler = tex(2048, 64, (g, w, h) => {
    g.fillStyle = '#ef482f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4f1eb';
    for (let i = 0; i <= 86; i++) {
      const x = (i * w) / 86;
      g.fillRect(x, 0, 2, i % 5 ? 14 : 25);
      if (i % 5 === 0) {
        g.font = '17px Arial';
        g.fillText(String(i * 50), x + 4, 48);
      }
    }
  });
  const scale = (p, y, z) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(43, 0.16),
      new THREE.MeshBasicMaterial({ map: ruler.tx, toneMapped: false }),
    );
    m.position.set(0, y, z);
    p.add(m);
  };
  scale(ram, 14.68, 2.75);
  for (let i = 0; i < 43; i++) {
    const x = -21 + i + 0.5;
    box(ram, x, 14.63, 2, 0.91, 0.35, 0.75, M.steelD);
    cyl(ram, x, 14.62, 2.43, 0.045, 0.035, M.black, 'z');
  }
  const PUNCH_PTS = [
    [1.72, 14.9],
    [2.28, 14.9],
    [2.28, 14.55],
    [2.5, 14.55],
    [2.5, 14.1],
    [2.06, 12.865],
    [2, 12.8],
    [1.94, 12.865],
    [1.5, 13.75],
    [1.5, 14.4],
    [1.72, 14.4],
  ];
  const punch = group('segmented-85-degree-punch', ram);
  for (let i = 0; i < 20; i++) profile(punch, 'punch-segment', PUNCH_PTS, 2.145, M.tool, -21.5 + (i + 0.5) * 2.15);
  // Krabička: razník zložený zo segmentov na dĺžku ohybu (krátke steny sa ohýbajú medzi už ohnutými dlhými)
  const boxPunch = group('box-punch-assembled-segments', ram);
  boxPunch.visible = false;
  let boxPunchLen;
  const rebuildBoxPunch = (len) => {
    if (len === boxPunchLen) return;
    boxPunchLen = len;
    clear(boxPunch);
    const segs = [];
    let rest = len - 6;
    for (const s of PUNCH_SEGMENTS) while (rest >= s) (segs.push(s), (rest -= s));
    let x = -segs.reduce((a, b) => a + b, 0) / 2;
    for (const s of segs) {
      profile(boxPunch, `punch-segment-${s}mm`, PUNCH_PTS, s * 0.01 - 0.004, M.tool, (x + s / 2) * 0.01);
      x += s;
    }
    boxPunch.userData.segments = segs.join('+');
  };
  // Bed, crowning cassette and V die. The V opening is an actual concave section.
  const bed = part('stol');
  box(bed, 0, 4.45, 0.2, 43, 8, 6.6, M.anth);
  box(bed, 0, 0.6, -0.5, 43, 0.8, 9, M.dark);
  box(bed, 0, 8.35, 2, 43, 0.3, 0.74, M.steel);
  box(bed, 0, 9.2, 2, 43, 1.4, 0.95, M.steelD);
  box(bed, 0, 9.92, 2, 43, 0.16, 1.62, M.steel);
  scale(bed, 9.94, 2.83);
  for (let i = 0; i < 43; i++) {
    const x = -21 + i;
    cyl(bed, x, 8.18, 3.55, 0.065, 0.04, M.black, 'z');
  }
  for (const x of [-18, -12, -6, 0, 6, 12, 18]) {
    cyl(bed, x, 6.5, 3.58, 0.18, 0.08, M.steel, 'z');
    cyl(bed, x, 6.5, 3.64, 0.09, 0.08, M.dark, 'z');
  }
  for (const y of [1.2, 3, 7.2]) box(bed, 0, y, 3.55, 42, 0.08, 0.12, M.dark);
  const die = group('replaceable-V-die', bed);
  let previousV;
  // Back gauge X carriage, R lift columns, Z fingers and ball screws.
  const gauge = part('dorazy'),
    xSlide = group('X-backgauge-carriage', gauge),
    rSlide = group('R-backgauge-lift', xSlide),
    fingers = [];
  for (const x of [-12, 12]) {
    box(gauge, x, 4.4, -6, 1, 1, 12, M.anth);
    box(gauge, x, 4.97, -6, 0.28, 0.14, 11.7, M.steel);
    cyl(gauge, x, 4.65, -6, 0.1, 11.8, M.steel, 'z');
    box(xSlide, x, 5.4, 0, 1.9, 0.65, 2.2, M.steelD);
    box(xSlide, x, 7.3, 0, 1.4, 3.2, 1.2, M.anth);
    for (const sx of [-0.45, 0.45]) box(xSlide, x + sx, 7.4, 0.65, 0.16, 3.2, 0.12, M.steel);
    cyl(xSlide, x, 7.4, 0.7, 0.09, 3.1, M.steel);
  }
  box(rSlide, 0, 9.8, 0, 32, 1.15, 1.6, M.anth);
  box(rSlide, 0, 10.42, 0.6, 31.5, 0.16, 0.2, M.steel);
  for (const s of [-1, 1]) {
    const f = group('Z' + (s < 0 ? '1' : '2') + '-finger', rSlide);
    fingers.push(f);
    box(f, 0, 10.5, 0.1, 1.5, 0.55, 1.9, M.steelD);
    box(f, 0, 10.87, 1, 1, 0.25, 2.8, M.steel);
    box(f, 0, 11.09, 2.3, 0.55, 0.3, 0.38, M.brass);
    box(f, 0, 11.22, 2.12, 0.4, 0.16, 0.18, M.brass);
    for (const x of [-0.3, 0.3]) cyl(f, x, 11.02, 0.5, 0.06, 0.06, M.black);
  }
  // Front adjustable support arms on a common rail, with rollers and hand clamps.
  const supports = part('podpery');
  box(supports, 0, 8, 4.45, 43, 0.3, 0.3, M.steel);
  for (const x of [-10, 10]) {
    profile(
      supports,
      'support-upright',
      [
        [4.6, 3],
        [5.5, 3],
        [6.1, 8.5],
        [7.3, 10.8],
        [5.5, 10.8],
      ],
      1.5,
      M.anth,
      x,
    );
    box(supports, x, 10.68, 7.8, 1.5, 0.5, 6.3, M.anth);
    box(supports, x, 10.84, 7.8, 1.65, 0.12, 6.4, M.steel);
    for (const z of [5, 6.2, 7.4, 8.6, 9.8, 10.6]) cyl(supports, x, 10.91, z, 0.09, 1.45, M.steel, 'x');
    cyl(supports, x, 9.7, 5.9, 0.18, 0.18, M.steel, 'z');
    rod(supports, [x - 0.25, 10.94, 10.2], [x + 0.4, 10.94, 10.2], 0.06, M.red);
    for (const y of [4.5, 7.4]) cyl(supports, x, y, 5.9, 0.09, 0.05, M.steel, 'z');
  }
  box(supports, -18.7, 5.6, 7.2, 4.1, 5.7, 4.6, M.anth);
  for (let i = 0; i < 13; i++) box(supports, -18.7, 8.6 + i * 0.13, 7.2, 4.5, 0.045, 4.8, M.black);
  box(supports, -18.7, 10.4, 7.2, 4.6, 0.2, 4.9, M.steel);
  bolts(supports, -18.7, 5.5, 9.55, 3.6, 4.8);
  // Angled, glazed side guards. Their full frames pivot from the cabinet edge.
  const guards = part('ochrana'),
    guardPivots = [];
  for (const side of [-1, 1]) {
    const p = group('side-guard', guards);
    p.position.set(side * 26.3, 0, 5.65);
    p.scale.x = -side;
    guardPivots.push(p);
    const outline = [
        [0, 7],
        [4.8, 7],
        [6.5, 9],
        [6.5, 21],
        [0, 21],
      ],
      pane = [
        [0.55, 8],
        [4.55, 8],
        [5.95, 9.6],
        [5.95, 20.45],
        [0.55, 20.45],
      ];
    const s = new THREE.Shape();
    outline.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const hole = new THREE.Path();
    pane.forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)));
    hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false }),
      m = new THREE.Mesh(g, M.cab);
    p.add(m);
    m.castShadow = true;
    const gs = new THREE.Shape();
    pane.forEach(([x, y], i) => (i ? gs.lineTo(x, y) : gs.moveTo(x, y)));
    gs.closePath();
    const glass = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.06, bevelEnabled: false }), M.glass);
    glass.position.z = 0.05;
    glass.name = 'smoked-side-guard-window';
    p.add(glass);
    for (const y of [9, 19]) box(p, 0.15, y, 0.22, 0.26, 0.55, 0.18, M.black);
    box(p, 5.8, 15, 0.35, 0.18, 2, 0.18, M.black);
  }
  const laser = [];
  for (const side of [-1, 1]) {
    box(ram, side * 21.95, 14.5, 3.7, 0.65, 0.8, 1.05, M.black);
    box(ram, side * 21.95, 14.5, 4.25, 0.5, 0.48, 0.05, M.glass);
    const m = cyl(ram, side * 21.95, 14.5, 4.31, 0.1, 0.04, M.green, 'z');
    laser.push(m);
  }
  const { pedal, consolePivot, monitor, display, operatorFace, controls, indicators } = createBystronicControls({
    part,
    kit,
    M,
    tex,
  });
  const light = new THREE.PointLight(0xddeeff, 90, 30, 2);
  light.position.set(0, 13.8, -1);
  frame.add(light);
  const cutawayParts = [hood, back, rearWall];
  for (const o of cutawayParts) {
    const raycast = o.raycast;
    o.raycast = function (...args) {
      if (!this.visible) return false;
      return raycast.apply(this, args);
    };
  }
  const stock = part('plech');
  stock.name = 'bent-sheet';
  stock.userData.stepJoin = true;
  const sheetG = new THREE.Group();
  sheetG.name = 'bent-sheet-profile';
  stock.add(sheetG);
  let sheetKey;
  const rebuildSheet = (c, beta, prog) => {
    const key = [c.length, c.depth, c.flange, c.thickness, c.v, beta.toFixed(5), prog ? JSON.stringify(prog) : ''].join(
      ':',
    );
    if (key === sheetKey) return;
    sheetKey = key;
    clear(sheetG);
    const points = profileSection(c, beta, prog),
      t = c.thickness / 2,
      poly = [
        ...points.map((p) => [-p.z + t * Math.sin(p.t), p.y + t * Math.cos(p.t)]),
        ...points.toReversed().map((p) => [-p.z - t * Math.sin(p.t), p.y - t * Math.cos(p.t)]),
      ];
    const s = new THREE.Shape();
    poly.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: c.length, bevelEnabled: false });
    g.translate(0, 0, -c.length / 2);
    g.rotateY(Math.PI / 2);
    g.scale(0.01, 0.01, 0.01);
    const mesh = new THREE.Mesh(g, M.sheet);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    sheetG.add(mesh);
  };
  // Krabička z panelov (brakePart.js): poloha podľa práve ohýbanej hrany; pri otáčaní plechu sa medzi
  // polohou po predchádzajúcom ohybe a polohou pre ďalší ohyb plynulo prechádza (zdvih a odsun k obsluhe).
  let boxPart = null,
    boxHolder = null,
    boxT = 0;
  const pa = new THREE.Vector3(),
    pb = new THREE.Vector3(),
    qa = new THREE.Quaternion(),
    qb = new THREE.Quaternion(),
    sc = new THREE.Vector3();
  const updateBox = (c, S, prog) => {
    if (!boxPart || boxT !== c.thickness) {
      if (boxHolder) (clear(boxHolder), stock.remove(boxHolder));
      boxT = c.thickness;
      boxHolder = new THREE.Group();
      boxHolder.name = 'box-part';
      boxHolder.scale.setScalar(0.01);
      boxPart = buildBoxPart(BOX_PART, c.thickness, M.sheet);
      boxPart.root.traverse((o) => {
        if (o.isMesh) o.userData.noMerge = true;
      });
      boxHolder.add(boxPart.root);
      stock.add(boxHolder);
    }
    sheetG.visible = false;
    boxHolder.visible = true;
    const r = boxPart.root;
    r.position.set(0, 0, 0);
    r.quaternion.identity();
    r.scale.setScalar(1);
    setBoxAngles(boxPart, prog.bends, prog.cur, S.beta);
    const h = boxPose(boxPart, prog.cur, S.beta);
    if (prog.turn) {
      const u = prog.turn.u,
        e = u * u * (3 - 2 * u),
        from = boxPose(boxPart, prog.turn.from.hinge, prog.turn.from.beta);
      from.decompose(pa, qa, sc);
      h.decompose(pb, qb, sc);
      // hotový ohyb ležal hlbšie vo V – rozdiel výšky sa pri otáčaní vyrovná
      pa.y -= supportDepth(c, prog.turn.from.beta) - supportDepth(c, S.beta);
      pa.lerp(pb, e);
      qa.slerp(qb, e);
      const lift = Math.sin(Math.PI * u);
      pa.y += 90 * lift;
      pa.z += 380 * lift;
      r.position.copy(pa);
      r.quaternion.copy(qa);
    } else h.decompose(r.position, r.quaternion, r.scale);
  };
  return {
    ram,
    punch,
    boxPunch,
    die,
    xSlide,
    rSlide,
    fingers,
    stock,
    pedal,
    consolePivot,
    monitor,
    display,
    operatorFace,
    controls,
    guardPivots,
    light,
    cutawayParts,
    update({ S, c, guardAngle, prog = null }) {
      cutawayParts.forEach((o) => {
        o.visible = !c.cutaway;
      });
      ram.position.y = -S.y * 0.01;
      const isBox = prog?.part === 'box',
        dieKey = `${c.v}:${isBox}`;
      if (previousV !== dieKey) {
        previousV = dieKey;
        clear(die);
        const half = c.v * 0.005,
          depth = half / Math.tan((42.5 * Math.PI) / 180);
        // krabička: úzka matrica (40 mm pri hrane), aby sa zahnutý lem a steny zmestili vedľa nej
        const pts = isBox
          ? [
              [1.65, 10],
              [2.35, 10],
              [2.35, 10.55],
              [2.2, 10.75],
              [2.2, 11],
              [2 + half, 11],
              [2, 11 - depth],
              [2 - half, 11],
              [1.8, 11],
              [1.8, 10.75],
              [1.65, 10.55],
            ]
          : [
              [1.2, 10],
              [2.8, 10],
              [2.8, 11],
              [2 + half, 11],
              [2, 11 - depth],
              [2 - half, 11],
              [1.2, 11],
            ];
        for (let i = 0; i < 20; i++)
          profile(die, isBox ? 'narrow-V-die-segment' : 'V-die-segment', pts, 2.145, M.tool, -21.5 + (i + 0.5) * 2.15);
      }
      punch.visible = !isBox;
      boxPunch.visible = isBox;
      if (isBox) rebuildBoxPunch(c.length);
      xSlide.position.z = 2 - c.flange * 0.01 - 2.49;
      rSlide.position.y = c.r * 0.01;
      const z = Math.min(14.5, Math.min(c.length * 0.003, c.length * 0.005 - 0.3));
      fingers[0].position.x = -z;
      fingers[1].position.x = z;
      guardPivots.forEach((p, i) => {
        p.rotation.y = (i ? 1 : -1) * guardAngle;
      });
      laser.forEach((m) => {
        m.material = c.obstructed ? M.red : M.green;
      });
      light.visible = c.light;
      lightMat.emissiveIntensity = c.light ? 1.4 : 0;
      if (!c.unclamped) {
        if (isBox) updateBox(c, S, prog);
        else {
          if (boxHolder) boxHolder.visible = false;
          sheetG.visible = true;
          rebuildSheet(c, S.beta, prog);
        }
        stock.position.set(0, BRAKE_DIE_TOP + (c.thickness / 2 - supportDepth(c, S.beta)) * 0.01, 2);
      }
      consolePivot.rotation.y = (c.hmiAngle * Math.PI) / 180;
      for (const { key, mesh } of indicators) {
        mesh.material.color.setHex(c[key] ? 0x58cf61 : 0x26312b);
        mesh.material.emissive.setHex(c[key] ? 0x16551b : 0);
      }
    },
    nominal: XPERT320,
    openTip: OPEN_TIP,
  };
}
