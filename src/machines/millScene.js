import { DIR_ANG, MILL, MILL_FEEDS, MILL_SPEEDS, MILL_TOOLS, S3_ANG, S6_ANG, millToolName } from './millData';
import { DIV_RATIO, barCut, createBar, indexPlan } from './millIndex';
import { L, LL, RPM } from '../core/i18n';
import { TAU, approach, clamp, logNear } from '../core/util';
import * as THREE from 'three';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createControls } from '../core/controls';
import { createDrops, createParticles } from '../core/particles';
import { createHeightField } from '../core/heightField';
import { createInspector } from '../core/inspector';
import { createSound } from '../core/sound';
import { createStage } from '../core/stage';
import { createWorkInspect } from '../core/workInspect';
import { exportStep } from '../core/step';
import { exportStl } from '../core/export';
import { fromB64, toB64 } from '../ui/tools';
import { hfInfo } from '../core/hfMath';

// 3D scéna a hlavná slučka (pôvodne useEffect v mill.jsx); vracia upratanie
export function createMillScene({ apiRef, ctl, layerRef, mountRef, setTele, setUi, tipRef }) {
  const mount = mountRef.current,
    layer = layerRef.current,
    tipEl = tipRef.current;
  const c = ctl.current;
  const { SPX, SPZ, NOSE, X0, Y0, H0 } = MILL;
  const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
  const snd = createSound('mill');
  const dom = renderer.domElement;

  const M = {
    ...baseMats(0x5aa99e, 0x47928a, 0x35736c),
    cream: std(0xdedbcb, 0.6, 0.05),
    creamDark: std(0xc2bead, 0.62, 0.05),
    motor: std(0xd4d6d2, 0.5, 0.3),
    vise: std(0x5b646d, 0.5, 0.55),
    cutter: std(0x3a3f44, 0.28, 0.85, { side: THREE.DoubleSide }),
    gauge: std(0xf3f1e8, 0.5, 0),
    chip: std(0x9aa3ad, 0.3, 0.85),
    lampShade: std(0xdedbcb, 0.5, 0.2),
    coolant: new THREE.MeshStandardMaterial({
      color: 0x8fd0ff,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
      metalness: 0,
      emissive: 0x1a4a6a,
      emissiveIntensity: 0.5,
    }),
    work: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.78,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    raw: std(0x474b50, 0.34, 0.78, { side: THREE.DoubleSide }),
  };
  const kit = makeKit(M);
  const { add, box, cylX, cylY, cylZ, ball, hitProxy, pivotLever, detents, handwheel, crank, face } = kit;
  const root = new THREE.Group();
  scene.add(root);
  apiRef.current.machineModel = { root, name: L('Frézka', 'Milling machine') };
  const G = {};
  const grp = (k, parent = root) => {
    const g = new THREE.Group();
    g.userData.part = k;
    parent.add(g);
    G[k] = g;
    return g;
  };
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- podstavec ----------
  const base = grp('podstavec');
  box(base, -1.9, 1.9, 0.1, 0.45, -4.6, 3.8, M.green);
  box(base, -2.0, 2.0, 0, 0.1, -4.7, 3.9, M.greenDeep);
  box(base, -1.3, 1.3, 0.16, 0.4, 3.8, 3.82, M.greenDark); // kryt nádrže chladiva
  cylZ(base, 0.09, 0.09, 3.82, 3.92, 1.0, 0.28, M.black, 12);
  cylY(base, 0.3, 0.3, 0.45, 0.6, 0, 1.0, M.greenDark, 24); // pätka zdvíhacej skrutky
  const ramGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 20);
  ramGeo.translate(0, 0.5, 0);
  const ram = add(base, ramGeo, M.steel, 0, 0.6, 1.0);

  // ---------- stojan ----------
  const col = grp('stojan');
  box(col, -1.5, 1.5, 0.45, 13.4, -4.4, -1.6, M.green);
  box(col, -1.6, 1.6, 13.4, 13.6, -4.5, -1.5, M.greenDark);
  box(col, -1.15, -0.75, 0.45, 13.4, -1.6, -1.52, M.ways); // rybinové vedenie konzoly
  box(col, 0.75, 1.15, 0.45, 13.4, -1.6, -1.52, M.ways);
  box(col, -1.52, -1.5, 1.4, 6.0, -4.0, -2.0, M.greenDark); // bočné dvierka
  cylX(col, 0.05, 0.05, -1.56, -1.52, 3.7, -2.3, M.black, 10);
  box(col, -0.75, 0.75, 6.4, 9.6, -4.75, -4.4, M.greenDark); // kryt remeňa vzadu
  box(col, -0.65, 0.65, 7.3, 7.45, -5.9, -4.75, M.greenDeep); // konzola motora
  cylX(col, 0.62, 0.62, -0.85, 0.95, 8.1, -5.3, M.motor, 32); // hlavný motor vzadu
  for (let k = 0; k < 10; k++) {
    const a = (k * TAU) / 10;
    const f = add(
      col,
      new THREE.BoxGeometry(1.5, 0.08, 0.05),
      M.motor,
      0.05,
      8.1 + Math.sin(a) * 0.64,
      -5.3 + Math.cos(a) * 0.64,
    );
    f.rotation.x = -a;
  }
  cylX(col, 0.5, 0.45, 0.95, 1.15, 8.1, -5.3, M.motor, 24);
  box(col, -0.35, 0.35, 8.75, 9.15, -5.55, -5.05, M.motor); // svorkovnica
  // horné rameno (pre vodorovné frézovanie) siaha dozadu nad motor
  box(col, -0.78, 0.78, 13.6, 14.35, -6.1, -1.55, M.green);
  cylX(col, 0.375, 0.375, -0.78, 0.78, 13.975, -6.1, M.green, 24);
  box(col, -0.82, 0.82, 13.55, 13.62, -4.4, -1.55, M.greenDark);
  // digitálny odmeriavač na ramene
  cylY(col, 0.05, 0.05, 14.35, 15.2, 0.5, -2.2, M.steel, 10);
  box(col, -0.4, 1.4, 15.15, 16.05, -2.42, -2.12, M.panel);
  const droCanvas = document.createElement('canvas');
  droCanvas.width = 256;
  droCanvas.height = 128;
  const droTex = new THREE.CanvasTexture(droCanvas);
  droTex.colorSpace = THREE.SRGBColorSpace;
  add(
    col,
    new THREE.PlaneGeometry(1.6, 0.8),
    new THREE.MeshBasicMaterial({ map: droTex, toneMapped: false }),
    0.5,
    15.6,
    -2.115,
  );
  let droKey = '';
  const drawDro = (x, y, z) => {
    const key = `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}`;
    if (key === droKey) return;
    droKey = key; // textúra sa mení len pri zmene údaja
    const g = droCanvas.getContext('2d');
    g.fillStyle = '#071008';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#ff5a3c';
    g.font = 'bold 34px "Share Tech Mono", Consolas, monospace';
    [
      ['X', x],
      ['Y', y],
      ['Z', z],
    ].forEach(([l, v], i) => {
      g.fillText(l, 12, 36 + i * 40);
      g.fillText(v.toFixed(2).padStart(7, ' '), 64, 36 + i * 40);
    });
    droTex.needsUpdate = true;
  };
  const sp = face(col, 1.5, 0, -3.0, Math.PI / 2); // panel pák otáčok na pravom boku
  box(sp, -0.95, 0.95, 6.15, 7.95, 0, 0.02, M.greenDark);
  box(sp, -0.7, 0.7, 6.3, 6.68, 0.02, 0.035, M.white); // tabuľka otáčok
  [
    [-0.45, 7.3],
    [0.4, 7.3],
  ].forEach(([x, y]) => cylZ(sp, 0.32, 0.28, 0.02, 0.2, x, y, M.black, 28));
  detents(sp, -0.45, 7.3, 0.2, 0.21, S3_ANG);
  detents(sp, 0.4, 7.3, 0.2, 0.21, S6_ANG, 0.028);
  const levSA = pivotLever(sp, -0.45, 7.3, 0.2, 0.5, 1.15),
    levSB = pivotLever(sp, 0.4, 7.3, 0.2, 0.5, 1.15);
  // pracovná lampa na ľavom boku stojana
  box(col, -1.75, -1.5, 9.0, 9.35, -2.0, -1.7, M.greenDark);
  const lamp = createLamp(scene, col, kit, M, {
    base: v3(-1.62, 9.45, -1.85),
    elbow: v3(-2.6, 11.3, -0.6),
    head: v3(-1.95, 10.95, 1.75),
    aim: v3(0.0, 7.0, 1.2),
    angle: 0.45,
    power: 3.2,
  });

  // ---------- elektrický rozvádzač ----------
  const cab = grp('rozvadzac');
  box(cab, 1.5, 2.2, 8.2, 11.2, -3.9, -2.1, M.green);
  const cf = face(cab, 2.2, 0, -3.0, Math.PI / 2);
  box(cf, -0.85, 0.85, 8.3, 11.1, 0, 0.015, M.greenDark);
  cylZ(cf, 0.25, 0.25, 0.015, 0.06, -0.45, 10.6, M.black, 28); // ampérmeter
  cylZ(cf, 0.21, 0.21, 0.06, 0.066, -0.45, 10.6, M.gauge, 28);
  const needle = box(cf, -0.012, 0.012, 0, 0.17, 0.067, 0.072, M.red);
  needle.position.set(-0.45, 10.6, 0.07);
  needle.geometry.translate(0, 0.085, 0);
  ball(cf, 0.08, 0.2, 10.75, 0.03, M.lamp);
  box(cf, 0.15, 0.8, 9.95, 10.5, 0.015, 0.03, M.yellow); // hlavný vypínač
  box(cf, 0.455, 0.495, 10.38, 10.47, 0.03, 0.035, M.black);
  add(cf, new THREE.TorusGeometry(0.03, 0.009, 6, 16), M.black, 0.21, 10.22, 0.033);
  const mainSwitch = new THREE.Group();
  mainSwitch.position.set(0.475, 10.22, 0.03);
  cf.add(mainSwitch);
  cylZ(mainSwitch, 0.19, 0.19, 0, 0.07, 0, 0, M.black, 24);
  box(mainSwitch, -0.24, 0.24, -0.05, 0.05, 0.07, 0.19, M.red);
  const pbtn = (x, y, m) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0.015);
    cf.add(g);
    cylZ(g, 0.11, 0.11, 0, 0.08, 0, 0, m, 20);
    hitProxy(g, 0.16, 0, 0, 0.06);
    return g;
  };
  const btnStart = pbtn(-0.55, 9.45, M.btnGreen),
    btnStop = pbtn(-0.2, 9.45, M.red),
    btnCool = pbtn(0.15, 9.45, M.blue);
  box(cf, -0.75, 0.35, 9.15, 9.25, 0.015, 0.025, M.white);
  box(cf, 0.25, 0.75, 8.5, 9.0, 0.015, 0.025, M.yellow);
  const eStop = new THREE.Group();
  eStop.position.set(0.5, 8.75, 0.025);
  cf.add(eStop);
  cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16);
  cylZ(eStop, 0.19, 0.18, 0.07, 0.16, 0, 0, M.red, 24);
  hitProxy(eStop, 0.25, 0, 0, 0.1);
  // kábel z rozvádzača k hlavnému motoru vzadu
  const cableTo = (pts, r = 0.05) =>
    add(cab, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false), M.black);
  cableTo([
    v3(1.9, 11.2, -3.7),
    v3(1.85, 11.9, -4.2),
    v3(1.65, 10.6, -4.75),
    v3(0.95, 9.35, -5.05),
    v3(0.36, 9.0, -5.3),
  ]);
  box(cab, 1.7, 2.05, 11.2, 11.3, -3.85, -3.55, M.black);
  box(cab, 1.8, 2.15, 8.1, 8.2, -2.55, -2.25, M.black);

  // ---------- sklopná vertikálna hlava ----------
  const head = grp('hlava');
  cylZ(head, 1.25, 1.25, -1.6, -1.38, 0, 12.25, M.greenDark, 48); // príruba na stojane
  cylZ(head, 1.1, 1.1, -1.38, -1.05, 0, 12.25, M.green, 48); // otočný bubon
  add(head, new THREE.TorusGeometry(1.1, 0.02, 6, 48), M.white, 0, 12.25, -1.2);
  box(head, -0.95, 0.95, 11.2, 13.3, -1.05, SPZ, M.green);
  cylY(head, 0.95, 0.95, 11.2, 13.3, SPX, SPZ, M.green, 40);
  box(head, -0.98, 0.98, 13.3, 13.45, -1.05, SPZ, M.greenDark);
  cylY(head, 0.98, 0.98, 13.3, 13.45, SPX, SPZ, M.greenDark, 40);
  cylY(head, 0.55, 0.55, 10.7, 11.2, SPX, SPZ, M.greenDark, 32); // puzdro pinoly
  cylX(head, 0.08, 0.08, 0.95, 1.15, 11.9, 0.3, M.steel, 12);
  const wheelQ = handwheel(head, 0.32, 1.2, 11.9, 0.3, 'x', 0.22); // koliesko pinoly
  cylZ(head, 0.09, 0.09, SPZ + 0.15, SPZ + 0.28, -0.62, 11.0, M.steelDark, 12);
  const levQ = pivotLever(head, -0.62, 11.0, SPZ + 0.28, 0.35, 0.9); // aretácia pinoly
  // kĺbová hadica chladiva z boku hlavy, dýza mieri na rezné miesto
  box(head, 0.42, 0.68, 11.08, 11.2, 1.55, 1.8, M.steelDark); // držiak hadice pod hlavou (mimo kolieska pinoly)
  const hose = new THREE.CatmullRomCurve3([
    v3(0.55, 11.1, 1.68),
    v3(0.95, 10.92, 2.08),
    v3(0.92, 10.4, 2.08),
    v3(0.62, NOSE - 0.45, SPZ + 0.62),
  ]);
  add(head, new THREE.TubeGeometry(hose, 40, 0.05, 8, false), M.black);
  for (let k = 1; k < 6; k++) {
    const p = hose.getPoint(k / 6);
    ball(head, 0.065, p.x, p.y, p.z, M.black);
  } // článkovaná hadica
  const nozzle = v3(0.62, NOSE - 0.45, SPZ + 0.62);
  cylY(head, 0.03, 0.06, nozzle.y - 0.12, nozzle.y + 0.02, nozzle.x, nozzle.z, M.steel, 12);

  // ---------- vreteno a nástroj ----------
  const spindle = grp('vreteno');
  spindle.position.set(SPX, NOSE, SPZ);
  cylY(spindle, 0.42, 0.42, 0, 0.3, 0, 0, M.steel, 40);
  cylY(spindle, 0.4, 0.4, 0.3, 1.15, 0, 0, M.steel, 32); // pinola (pri vysunutí viditeľná)
  box(spindle, -0.42, -0.3, -0.06, 0.02, -0.08, 0.08, M.steelDark);
  box(spindle, 0.3, 0.42, -0.06, 0.02, -0.08, 0.08, M.steelDark);
  const toolG = new THREE.Group();
  spindle.add(toolG);
  // šróbovicové drážky: prierez so zubami pootočený pozdĺž osi (stúpanie 30°)
  const fluteGeo = (r, h, nf) => {
    const seg = 56,
      rows = 28,
      pos = [],
      idx = [],
      tw = Math.tan(0.52) / r;
    for (let j = 0; j <= rows; j++) {
      const y = (-h * j) / rows;
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * TAU,
          u = (((((th + y * tw) * nf) / TAU) % 1) + 1) % 1;
        const rr = r * (1 - 0.32 * Math.pow(Math.sin(Math.PI * clamp((u - 0.15) / 0.85, 0, 1)), 1.3));
        pos.push(Math.cos(th) * rr, y, Math.sin(th) * rr);
      }
    }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < seg; i++) {
        const a = j * (seg + 1) + i,
          b = a + seg + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    const c0 = pos.length / 3;
    pos.push(0, -h, 0);
    for (let i = 0; i < seg; i++) idx.push(c0, rows * (seg + 1) + i, rows * (seg + 1) + i + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const buildTool = (id) => {
    while (toolG.children.length) {
      const o = toolG.children[0];
      toolG.remove(o);
      if (o.geometry) o.geometry.dispose();
    }
    const tl = MILL_TOOLS[id],
      r = tl.r,
      len = tl.len;
    cylY(toolG, 0.38, 0.38, -0.15, 0, 0, 0, M.steelDark, 32);
    if (tl.kind !== 'face') {
      cylY(toolG, 0.2, 0.27, -0.6, -0.15, 0, 0, M.steelDark, 28); // klieštinový upínač
      cylY(toolG, 0.23, 0.23, -0.72, -0.6, 0, 0, M.steel, 6); // matica
      const fl = clamp(r * 4.2, 0.2, 0.5),
        fEnd = tl.kind === 'ball' ? -len + r : -len;
      cylY(toolG, r * 0.98, r * 0.98, fEnd + fl, -0.72, 0, 0, M.steel, 24); // driek
      add(
        toolG,
        fluteGeo(r, fl - (tl.kind === 'ball' ? 0 : 0), r < 0.05 ? 2 : r < 0.09 ? 3 : 4),
        M.cutter,
        0,
        fEnd + fl,
        0,
      );
      if (tl.kind === 'ball')
        add(toolG, new THREE.SphereGeometry(r * 0.99, 24, 12, 0, TAU, Math.PI / 2, Math.PI / 2), M.cutter, 0, fEnd, 0);
    } else {
      const n = { 50: 4, 63: 5, 80: 6, 100: 7 }[tl.d] || 5;
      cylY(toolG, 0.2, 0.2, -0.6, -0.15, 0, 0, M.steelDark, 24); // tŕň
      cylY(toolG, r * 0.93, r * 0.8, -len + 0.03, -0.6, 0, 0, M.cutter, 48);
      cylY(toolG, 0.16, 0.16, -0.68, -0.58, 0, 0, M.steel, 6);
      for (let k = 0; k < n; k++) {
        const a = (k * TAU) / n;
        const gul = add(
          toolG,
          new THREE.BoxGeometry(0.14, 0.2, 0.09),
          M.black,
          Math.cos(a) * (r - 0.05),
          -len + 0.12,
          Math.sin(a) * (r - 0.05),
        );
        gul.rotation.y = -a;
        const ins = add(
          toolG,
          new THREE.BoxGeometry(0.1, 0.11, 0.04),
          M.insert,
          Math.cos(a) * (r - 0.03),
          -len + 0.055,
          Math.sin(a) * (r - 0.03),
        );
        ins.rotation.y = -a + 0.25;
      }
    }
  };

  // ---------- konzola ----------
  const knee = grp('konzola');
  box(knee, -1.5, 1.5, -2.4, 0, -1.6, 3.4, M.green);
  box(knee, -1.3, -0.9, 0, 0.05, -1.5, 3.3, M.ways);
  box(knee, 0.9, 1.3, 0, 0.05, -1.5, 3.3, M.ways);
  box(knee, -1.55, 1.55, -0.14, 0, 3.4, 3.44, M.greenDark);
  box(knee, -1.3, -0.1, -0.24, -0.16, 3.4, 3.42, M.white); // tabuľka posuvov
  [
    [-1.0, -0.6],
    [-0.4, -0.6],
  ].forEach(([x, y]) => cylZ(knee, 0.24, 0.2, 3.4, 3.55, x, y, M.black, 24));
  detents(knee, -1.0, -0.6, 3.55, 0.15, S3_ANG, 0.025);
  detents(knee, -0.4, -0.6, 3.55, 0.15, S6_ANG, 0.02);
  const levFA = pivotLever(knee, -1.0, -0.6, 3.55, 0.38, 1.2),
    levFB = pivotLever(knee, -0.4, -0.6, 3.55, 0.38, 1.2);
  cylZ(knee, 0.2, 0.2, 3.4, 3.5, 0.75, -1.35, M.steelDark, 24);
  cylZ(knee, 0.08, 0.08, 3.5, 3.62, 0.75, -1.35, M.steel, 12);
  const wheelY = handwheel(knee, 0.5, 0.75, -1.35, 3.68, 'z', 0.35);
  cylZ(knee, 0.16, 0.16, 3.4, 3.52, -0.8, -1.55, M.steelDark, 20);
  const crankZ = crank(knee, 0.45, -0.8, -1.55, 3.56);
  const levKnee = pivotLever(knee, 1.15, -0.45, 3.42, 0.36, 1.2); // aretácia konzoly

  // ---------- priečne sane ----------
  const sad = grp('sane', knee);
  box(sad, -1.45, 1.45, 0.05, 0.6, -0.95, 0.95, M.green);
  cylZ(sad, 0.2, 0.17, 0.95, 1.07, 0.75, 0.3, M.black, 20);
  detents(sad, 0.75, 0.3, 1.07, 0.12, DIR_ANG, 0.022);
  const levDir = pivotLever(sad, 0.75, 0.3, 1.07, 0.32, 1.25);
  const levSad = pivotLever(sad, -0.9, 0.3, 0.97, 0.3, 1.2); // aretácia saní
  box(sad, 1.45, 1.6, 0.18, 0.44, -0.12, 0.12, M.black); // prípojka motora posuvov
  const sadCable = new THREE.Mesh(new THREE.BufferGeometry(), M.black);
  sadCable.castShadow = true;
  root.add(sadCable);
  let sadCableKey = '';
  const updateSadCable = (h, sz) => {
    const key = `${h.toFixed(3)}|${sz.toFixed(3)}`;
    if (key === sadCableKey) return;
    sadCableKey = key;
    const e = v3(1.6, h - 1.35 + 0.31, sz);
    const curve = new THREE.CatmullRomCurve3([
      v3(2.0, 8.1, -2.4),
      v3(2.2, Math.min(7.6, e.y + 1.4), -2.1),
      v3(2.1, e.y - 0.55, e.z - 0.6),
      v3(1.8, e.y - 0.08, e.z - 0.12),
      e,
    ]);
    sadCable.geometry.dispose();
    sadCable.geometry = new THREE.TubeGeometry(curve, 40, 0.05, 8, false);
  };

  // ---------- pracovný stôl ----------
  const tbl = grp('stol', sad);
  tbl.position.y = 0.6;
  box(tbl, -6.5, 6.5, 0, 0.6, -1.5, 1.5, M.green);
  box(tbl, -6.5, 6.5, 0.6, 0.75, -1.5, 1.5, M.ways);
  [-0.9, 0, 0.9].forEach((z) => box(tbl, -6.5, 6.5, 0.7, 0.752, z - 0.09, z + 0.09, M.steelDark));
  box(tbl, -6.5, 6.5, 0.12, 0.5, 1.5, 1.58, M.greenDark);
  [-3.6, 3.6].forEach((x) => box(tbl, x - 0.12, x + 0.12, 0.08, 0.55, 1.58, 1.72, M.red));
  box(tbl, -6.85, -6.5, 0.05, 0.6, -0.35, 0.35, M.green);
  box(tbl, 6.5, 6.85, 0.05, 0.6, -0.35, 0.35, M.green);
  cylX(tbl, 0.07, 0.07, -7.0, -6.85, 0.32, 0, M.steel, 12);
  cylX(tbl, 0.07, 0.07, 6.85, 7.0, 0.32, 0, M.steel, 12);
  const wheelXL = handwheel(tbl, 0.45, -7.05, 0.32, 0, '-x', 0.32),
    wheelXR = handwheel(tbl, 0.45, 7.05, 0.32, 0, 'x', 0.32);

  const recolor = (g) =>
    g.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material === M.green) o.material = M.cream;
      else if (o.material === M.greenDark || o.material === M.greenDeep) o.material = M.creamDark;
    });
  [head, knee].forEach(recolor);

  // ---------- zverák: pevná čeľusť vzadu (z = -0,5), posuvná sa prispôsobí šírke obrobku ----------
  const wk = { shape: 'block', WX: 1.8, WZ: 1.0, WH: 0.6, WB: 0.45, hold: 'vise' };
  const wzc = () => -0.5 + wk.WZ / 2;
  const vise = grp('zverak', tbl);
  vise.position.y = 0.75;
  box(vise, -1.25, 1.25, 0, 0.35, -0.95, 0.95, M.vise);
  box(vise, -1.25, 1.25, 0.35, 0.85, -0.95, -0.5, M.vise);
  box(vise, -1.1, 1.1, 0.4, 0.82, -0.52, -0.5, M.steel);
  const jawM = new THREE.Group();
  vise.add(jawM);
  box(jawM, -1.1, 1.1, 0.35, 0.85, 0.5, 0.95, M.vise);
  box(jawM, -1.1, 1.1, 0.4, 0.82, 0.5, 0.52, M.steel);
  cylZ(vise, 0.08, 0.08, 0.95, 1.55, 0, 0.55, M.steel, 16);
  cylZ(vise, 0.13, 0.13, 1.55, 1.68, 0, 0.55, M.steelDark, 16);
  box(vise, -0.45, 0.45, 0.51, 0.59, 1.6, 1.66, M.steel);
  ball(vise, 0.06, -0.47, 0.55, 1.63, M.black);
  ball(vise, 0.06, 0.47, 0.55, 1.63, M.black);
  const pars = new THREE.Group();
  vise.add(pars);
  const buildParallels = () => {
    while (pars.children.length) {
      const o = pars.children[0];
      pars.remove(o);
      o.geometry.dispose();
    }
    const z0 = -0.5,
      z1 = -0.5 + wk.WZ;
    box(pars, -0.95, 0.95, 0.35, wk.WB, z0 + 0.03, z0 + 0.15, M.steel);
    box(pars, -0.95, 0.95, 0.35, wk.WB, z1 - 0.15, z1 - 0.03, M.steel);
  };
  const obstacles = () =>
    isDiv()
      ? [
          {
            x0: -3.05,
            x1: -1.85,
            z0: -0.62,
            z1: 0.62,
            top: 1.4,
            name: L('deliaceho prístroja', 'the dividing head'),
          },
          { x0: -1.88, x1: DIV.CH, z0: -0.42, z1: 0.42, top: DIV.AY + 0.42, name: L('skľučovadla', 'the chuck') },
          ...(c.tail
            ? [
                {
                  x0: tailX() - 0.4,
                  x1: tailX() + 0.8,
                  z0: -0.45,
                  z1: 0.45,
                  top: 1.2,
                  name: L('koníka', 'the tailstock'),
                },
              ]
            : []),
          { x0: -6.5, x1: 6.5, z0: -1.5, z1: 1.5, top: 0, name: L('stola', 'the table') },
        ]
      : [
          { x0: -1.25, x1: 1.25, z0: -0.95, z1: 0.95, top: 0.35, name: L('zveráka', 'the vise') },
          {
            x0: -1.25,
            x1: 1.25,
            z0: -0.95,
            z1: -0.5,
            top: 0.85,
            name: L('pevnej čeľuste zveráka', 'the fixed vise jaw'),
          },
          {
            x0: -1.1,
            x1: 1.1,
            z0: -0.5 + wk.WZ,
            z1: -0.05 + wk.WZ,
            top: 0.85,
            name: L('posuvnej čeľuste zveráka', 'the moving vise jaw'),
          },
          { x0: -0.95, x1: 0.95, z0: -0.5, z1: -0.5 + wk.WZ, top: wk.WB, name: L('podložiek', 'the parallels') },
          { x0: -0.5, x1: 0.5, z0: 0.95, z1: 1.75, top: 0.72, name: L('skrutky zveráka', 'the vise screw') },
          { x0: -6.5, x1: 6.5, z0: -1.5, z1: 1.5, top: 0, name: L('stola', 'the table') },
        ];

  // ---------- deliaci prístroj a koník (montujú sa na stôl namiesto zveráka) ----------
  // os tyče DIV.AY nad stolom (úroveň 0,75), čelo skľučovadla v x = DIV.CH; tyč sa vsunie DIV.IN do skľučovadla
  const DIV = { AY: 1.0, CH: -1.6, IN: 0.25 };
  const divG = grp('deliaci', tbl);
  divG.visible = false;
  box(divG, -3.05, -1.85, 0.75, 1.1, -0.62, 0.62, M.vise); // pätka s perami do T-drážky
  box(divG, -2.95, -2.0, 1.1, 2.15, -0.55, 0.55, M.green); // skriňa so závitovkou
  cylX(divG, 0.34, 0.34, -2.0, -1.88, 0.75 + DIV.AY, 0, M.greenDark, 28);
  const spinG = new THREE.Group();
  spinG.position.set(0, 0.75 + DIV.AY, 0);
  divG.add(spinG); // vreteno so skľučovadlom (otáča sa)
  cylX(spinG, 0.42, 0.42, -1.88, DIV.CH, 0, 0, M.steelDark, 32);
  for (let q = 0; q < 3; q++) {
    const a = (q * TAU) / 3,
      j = box(spinG, DIV.CH - 0.02, DIV.CH + 0.06, -0.06, 0.06, -0.1, 0.1, M.steel);
    j.position.set(DIV.CH + 0.02, Math.cos(a) * 0.32, Math.sin(a) * 0.32);
    j.rotation.x = a;
  }
  // deliaci kotúč s dierami a kľuka (os kolmá na vreteno, na strane obsluhy)
  cylZ(divG, 0.4, 0.4, 0.55, 0.6, -2.48, 1.62, M.steel, 40);
  for (let q = 0; q < 18; q++) {
    const a = (q * TAU) / 18;
    cylZ(divG, 0.018, 0.018, 0.6, 0.605, -2.48 + Math.sin(a) * 0.31, 1.62 + Math.cos(a) * 0.31, M.black, 6);
  }
  const crankI = crank(divG, 0.31, -2.48, 1.62, 0.62);
  const levDiv = pivotLever(divG, -2.1, 2.15, 0.35, 0.3, 1.0); // aretácia vretena
  const tailG = grp('konik', tbl);
  tailG.visible = false;
  box(tailG, 0, 0.8, 0.75, 1.05, -0.45, 0.45, M.vise);
  box(tailG, 0.05, 0.75, 1.05, 1.95, -0.3, 0.3, M.green);
  cylX(tailG, 0.12, 0.12, -0.25, 0.05, 0.75 + DIV.AY, 0, M.steel, 16);
  cylX(tailG, 0.0, 0.12, -0.4, -0.25, 0.75 + DIV.AY, 0, M.steel, 16);
  handwheel(tailG, 0.25, 0.85, 0.75 + DIV.AY, 0, 'x', 0.15);
  let bar = null,
    barMesh = null;
  const barG = new THREE.Group();
  barG.userData.part = 'obrobok';
  tbl.add(barG);
  const barX0 = () => DIV.CH - DIV.IN,
    barCx = () => barX0() + bar.L / 2,
    tailX = () => (c.tail && bar ? barX0() + bar.L + 0.35 : 5.4);
  const RAWC = new THREE.Color(0x474b50).convertSRGBToLinear(),
    CUTC = new THREE.Color(0xdfe3e7).convertSRGBToLinear();
  const buildBar = () => {
    if (barMesh) {
      barG.remove(barMesh);
      barMesh.geometry.dispose();
    }
    const L = wk.WX,
      R = wk.WZ / 2;
    bar = createBar({ L, R, NX: Math.max(40, Math.round((L * 100) / 1.5)), NT: 240 });
    const { NX, NT } = bar,
      n = (NX + 1) * NT,
      idx = [];
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NT; j++) {
        const a = i * NT + j,
          b = i * NT + ((j + 1) % NT),
          c2 = a + NT,
          d = b + NT;
        idx.push(a, c2, b, b, c2, d);
      }
    for (let j = 0; j < NT; j++) {
      idx.push(n, (j + 1) % NT, j);
      idx.push(n + 1, NX * NT + j, NX * NT + ((j + 1) % NT));
    } // čelá
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 2) * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((n + 2) * 3), 3));
    geo.setIndex(idx);
    barMesh = new THREE.Mesh(geo, M.work);
    barMesh.castShadow = true;
    barMesh.receiveShadow = true;
    barMesh.userData.part = 'obrobok';
    barG.add(barMesh);
    rebuildBar();
  };
  const rebuildBar = () => {
    const { NX, NT, dX, dT, r, mask } = bar,
      pos = barMesh.geometry.attributes.position.array,
      col = barMesh.geometry.attributes.color.array,
      n = (NX + 1) * NT;
    for (let i = 0; i <= NX; i++)
      for (let j = 0; j < NT; j++) {
        const k = i * NT + j,
          a = j * dT,
          cc = mask[k] ? CUTC : RAWC;
        pos[k * 3] = -bar.L / 2 + i * dX;
        pos[k * 3 + 1] = r[k] * Math.cos(a);
        pos[k * 3 + 2] = r[k] * Math.sin(a);
        col[k * 3] = cc.r;
        col[k * 3 + 1] = cc.g;
        col[k * 3 + 2] = cc.b;
      }
    pos[n * 3] = -bar.L / 2;
    pos[n * 3 + 1] = 0;
    pos[n * 3 + 2] = 0;
    pos[n * 3 + 3] = bar.L / 2;
    pos[n * 3 + 4] = 0;
    pos[n * 3 + 5] = 0;
    for (let q = n * 3; q < n * 3 + 6; q++) col[q] = RAWC.r;
    const g = barMesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };
  const isDiv = () => wk.hold === 'div';

  // ---------- obrobok: výšková mapa ----------
  let hf = null;
  const makeWork = () => {
    if (hf) {
      tbl.remove(hf.mesh);
      hf.mesh.children.forEach((o) => o.geometry.dispose());
      hf.dispose();
    }
    const R = wk.WZ / 2;
    // rozlíšenie podľa rozmeru kusu: ~1,2 mm na bunku, pri veľkom kuse hrubšie, aby sieť nemala viac ako MAXV vrcholov
    const k = Math.max(1, Math.sqrt((((wk.WX * 100) / MILL.CELL) * ((wk.WZ * 100) / MILL.CELL)) / MILL.MAXV));
    const NX = Math.max(40, Math.round((wk.WX * 100) / MILL.CELL / k)),
      NZ = Math.max(20, Math.round((wk.WZ * 100) / MILL.CELL / k));
    hf = createHeightField({
      NX,
      NZ,
      W: wk.WX,
      D: wk.WZ,
      H: wk.WH,
      raw: 0x474b50,
      cut: 0xdfe3e7,
      mat: M.work,
      base: wk.shape === 'round' ? R : 0,
      init: wk.shape === 'round' ? (x, z) => R + Math.sqrt(Math.max(0, R * R - z * z)) : null,
    });
    if (wk.shape === 'round') {
      const lg = new THREE.CylinderGeometry(R, R, wk.WX, 40, 1, false, Math.PI, Math.PI);
      lg.rotateZ(Math.PI / 2);
      const low = new THREE.Mesh(lg, M.raw);
      low.position.y = R;
      low.castShadow = true;
      low.receiveShadow = true;
      hf.mesh.add(low);
    }
    hf.mesh.position.set(0, 0.75 + wk.WB, wzc());
    hf.mesh.userData.part = 'obrobok';
    tbl.add(hf.mesh);
    G.obrobok = hf.mesh;
    buildParallels();
  };
  // upnutie: zverák alebo deliaci prístroj s tyčou (zverák a jeho obrobok sa vtedy skryjú)
  const applyHold = () => {
    const d = isDiv();
    vise.visible = !d;
    hf.mesh.visible = !d;
    divG.visible = d;
    tailG.visible = d;
    barG.visible = d;
    if (d) {
      buildBar();
      barG.position.set(barCx(), 0.75 + DIV.AY, 0);
      barG.rotation.x = st.phi;
      tailG.position.x = tailX();
      G.obrobok = barG;
    } else G.obrobok = hf.mesh;
  };
  makeWork();
  const eachIn = (rx, rz, r, fn, write) =>
    (write ? hf.cutRect : hf.eachRect)(rx - r, rx + r, rz - r, rz + r, (k, x, z) => {
      const d2 = (x - rx) * (x - rx) + (z - rz) * (z - rz);
      if (d2 <= r * r) fn(k, d2);
    });
  const limOf = (tl, wy, d2) => (tl.kind === 'ball' ? wy + tl.r - Math.sqrt(Math.max(0, tl.r * tl.r - d2)) : wy);
  // súradnice voči obrobku: rx, rz od stredu, wy = spodok nástroja nad spodkom obrobku
  const penetration = (rx, rz, wy, tl) => {
    let p = 0;
    eachIn(rx, rz - wzc(), tl.r, (k, d2) => {
      const v = hf.hgt[k] - limOf(tl, wy, d2);
      if (v > p) p = v;
    });
    return p;
  };
  const cut = (rx, rz, wy, tl) => {
    let removed = 0;
    eachIn(
      rx,
      rz - wzc(),
      tl.r,
      (k, d2) => {
        const lim = Math.max(0, limOf(tl, wy, d2));
        if (hf.hgt[k] > lim + 1e-4) {
          removed += hf.hgt[k] - lim;
          hf.hgt[k] = lim;
          hf.mask[k] = 1;
        }
      },
      true,
    );
    return removed;
  };
  // tyč: fréza s rovným čelom vo výške ry nad stolom, os tyče DIV.AY nad stolom (guľovú frézu berieme ako rovnú)
  const penAt = (rx, rz, ry, tl, phi = st.phi) =>
    isDiv() ? barCut(bar, phi, tl.r, ry - DIV.AY, rx - barCx(), rz, false).pen : penetration(rx, rz, ry - wk.WB, tl);
  const cutAt = (rx, rz, ry, tl) =>
    isDiv() ? barCut(bar, st.phi, tl.r, ry - DIV.AY, rx - barCx(), rz, true).rem : cut(rx, rz, ry - wk.WB, tl);
  const hitObst = (rx, rz, ry, r) => {
    for (const o of obstacles()) {
      if (ry >= o.top - 1e-4) continue;
      const dx = Math.max(o.x0 - rx, 0, rx - o.x1),
        dz = Math.max(o.z0 - rz, 0, rz - o.z1);
      if (dx * dx + dz * dz < r * r) return o.name;
    }
    return null;
  };

  // ---------- chladiaca kvapalina a triesky ----------
  const stream = add(head, new THREE.CylinderGeometry(0.02, 0.04, 1, 10, 1, true), M.coolant);
  stream.castShadow = false;
  stream.visible = false;
  const streamEnd = () => {
    const tl = MILL_TOOLS[st.tool];
    return v3(SPX + tl.r * 0.7, NOSE - st.q - tl.len + 0.15, SPZ + tl.r * 0.7);
  };
  const placeStream = () => {
    const to = streamEnd(),
      dir = to.clone().sub(nozzle);
    stream.position.copy(nozzle).addScaledVector(dir, 0.5);
    stream.scale.set(1, dir.length(), 1);
    stream.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.normalize());
  };
  const chipsP = createParticles(scene, new THREE.BoxGeometry(0.05, 0.012, 0.08), M.chip, 160);
  const drops = createDrops(scene);
  let chipAcc = 0,
    dropAcc = 0;

  // ---------- stav simulácie ----------
  const st = {
    phi: 0,
    phiT: 0,
    idx: 0,
    tx: X0 + c.x / 100,
    sz: Y0 + c.y / 100,
    h: H0 + c.z / 100,
    q: c.quill / 100,
    rpm: 0,
    spin: 0,
    cutT: -9,
    cutting: false,
    tool: c.tool,
    msg: null,
    change: null,
  };
  let t = 0,
    last = performance.now(),
    teleT = 0,
    workDirty = false,
    lastBuild = 0,
    lastDir = c.feedDir;
  const flags = {};
  const say = (text, kind = 'warn') => {
    st.msg = { text, kind, until: t + 2.6 };
  };
  const sayOnce = (key, cond, text, kind) => {
    if (cond && !flags[key]) say(text, kind);
    flags[key] = cond;
  };
  const yT = (tool = st.tool, q = st.q) => NOSE - q - MILL_TOOLS[tool].len;
  // poloha spodku nástroja voči stredu a hornej ploche stola (vrátane výsuvu pinoly)
  const rel = (tx, sz, h, tool = st.tool, q = st.q) => [SPX - tx, SPZ - sz, yT(tool, q) - h];
  buildTool(st.tool);
  placeStream();
  const spawnChip = () => {
    const tl = MILL_TOOLS[st.tool],
      a = Math.random() * TAU,
      s = 1.5 + Math.random() * 2;
    chipsP.spawn(
      v3(SPX + Math.cos(a) * tl.r, yT() + 0.04 + Math.random() * 0.08, SPZ + Math.sin(a) * tl.r),
      v3(Math.cos(a) * s + Math.sin(a) * 2, 0.8 + Math.random() * 1.8, Math.sin(a) * s - Math.cos(a) * 2),
      2.5 + Math.random() * 1.5,
    );
  };

  // ---------- pohľady, popisy a výber dielov ----------
  const anchors = {
    podstavec: () => v3(-1.4, 0.55, 3.7),
    stojan: () => v3(-1.5, 8.6, -2.6),
    hlava: () => v3(0, 13.55, SPZ),
    vreteno: () => v3(SPX + 0.5, NOSE - 0.25, SPZ + 0.45),
    konzola: () => v3(-1.5, st.h - 1.35 - 0.5, 3.4),
    sane: () => v3(1.45, st.h - 1.35 + 0.35, st.sz + 0.95),
    stol: () => v3(st.tx + 5, st.h + 0.05, st.sz + 1.5),
    zverak: () => v3(st.tx + 1.25, st.h + 0.55, st.sz + 0.95),
    obrobok: () =>
      isDiv()
        ? v3(st.tx + barCx(), st.h + 0.75 + DIV.AY + wk.WZ / 2 + 0.05, st.sz)
        : v3(st.tx - 0.6, st.h + wk.WB + wk.WH + 0.05, st.sz + wzc()),
    deliaci: () => v3(st.tx - 2.5, st.h + 2.2, st.sz + 0.6),
    konik: () => v3(st.tx + tailX() + 0.4, st.h + 2.0, st.sz + 0.3),
    rozvadzac: () => v3(2.2, 11.3, -3.0),
  };
  const views = {
    celok: () => [
      [10, 12.5, 17],
      [0, 7.2, 0],
    ],
    rez: () => [[SPX + 1.9, yT() + 3.1, SPZ + 3.4], [SPX, yT() - 0.45, SPZ - 0.1], true],
    spredu: () => [
      [0, 8.5, 20],
      [0, 7.2, 0],
    ],
    zhora: () => [
      [0.5, 24, 9],
      [0, 6.8, 0.8],
    ],
    bok: () => [[11, 9.5, 2.5], [1.6, 8.6, -2.6], true],
  };
  const insp = createInspector({
    dom,
    mount,
    camera,
    root,
    G,
    anchors,
    views,
    labelEls: Array.from(layer.querySelectorAll('[data-part]')),
    enabled: () => !c.manual && !c.unclamped,
    onPick: (k) => apiRef.current.onPick(k),
    blockPick: () => ctrl.isUsed() || c.unclamped,
    onHL: () => ctrl.invalidate(),
  });
  const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
  const { push, pend } = ctrl;
  apiRef.current.view = (n) => insp.goView(n, false);
  // meranie, uloženie a export obrobku
  apiRef.current.measure = () => ({ info: hfInfo(hf), bar: isDiv() ? bar : null });
  apiRef.current.save = () => {
    if (c.unclamped) {
      say(L('Najprv upni polotovar späť.', 'Clamp the workpiece back first.'));
      return null;
    }
    if (isDiv()) {
      say(
        L(
          'Tyč v deliacom prístroji sa zatiaľ neukladá – exportuj ju do STL.',
          'A bar on the dividing head is not saved yet – export it to STL.',
        ),
        'info',
      );
      return null;
    }
    return { v: 1, wk: { ...wk }, NX: hf.NX, NZ: hf.NZ, hgt: toB64(hf.hgt), mask: toB64(hf.mask) };
  };
  apiRef.current.load = (r) => {
    if (!r || r.v !== 1 || !r.wk) return false;
    push('bShape', r.wk.shape);
    push('bL', Math.round(r.wk.WX * 100));
    if (r.wk.shape === 'round') push('bD', Math.round(r.wk.WZ * 100));
    else {
      push('bW', Math.round(r.wk.WZ * 100));
      push('bH', Math.round(r.wk.WH * 100));
    }
    const out = apiRef.current.newBlank();
    if (!out) return false;
    Object.entries(out).forEach(([k, v]) => push(k, v));
    if (hf.NX !== r.NX || hf.NZ !== r.NZ) return false;
    hf.hgt.set(fromB64(r.hgt, Float32Array));
    hf.mask.set(fromB64(r.mask, Uint8Array));
    hf.rebuild(true);
    return true;
  };
  apiRef.current.exportStl = () => exportStl(isDiv() ? barMesh : hf.mesh);
  apiRef.current.snapshot = snapshot;
  apiRef.current.exportStep = async () => {
    if (c.running || c.drive || c.wheel || c.work)
      throw new Error(
        L('Najprv zastav stroj a potom exportuj obrobok.', 'Stop the machine before exporting the workpiece.'),
      );
    return exportStep(isDiv() ? barG : hf.mesh);
  };

  // ---------- polotovar ----------
  const wi = createWorkInspect({
    scene,
    camera,
    dom,
    insp,
    c,
    getObj: () => (isDiv() ? barG : hf.mesh),
    getSpot: () => v3(3.2, 8.4, 4.6),
    onState: (v) => {
      push('unclamped', v);
      push('manual', c.manual);
    },
  });
  apiRef.current.toggleWork = () => {
    if (wi.phase() === 'in') {
      if (c.running || st.rpm > 1) {
        say(
          L(
            'Polotovar sa odopína len pri stojacom vretene.',
            'The workpiece can only be unclamped with the spindle stopped.',
          ),
        );
        return;
      }
      const [rx, rz, ry] = rel(st.tx, st.sz, st.h);
      const near = isDiv()
        ? ry < DIV.AY + wk.WZ / 2 + 0.05 && Math.abs(rx - barCx()) < wk.WX / 2 + 0.6 && Math.abs(rz) < wk.WZ / 2 + 0.6
        : ry - wk.WB < wk.WH + 0.05 && Math.abs(rx) < wk.WX / 2 + 0.6 && Math.abs(rz - wzc()) < wk.WZ / 2 + 0.6;
      if (penAt(rx, rz, ry, MILL_TOOLS[st.tool]) > 0.001 || near) {
        say(
          L(
            'Najprv spusti konzolu nižšie – fréza je pri obrobku.',
            'Lower the knee first – the cutter is next to the workpiece.',
          ),
        );
        return;
      }
    }
    if (!wi.toggle())
      say(L('Počkaj, kým sa dokončí pohyb polotovaru.', 'Wait until the workpiece movement finishes.'), 'info');
  };
  apiRef.current.newBlank = () => {
    if (c.unclamped) {
      say(L('Najprv upni polotovar späť.', 'Clamp the workpiece back first.'));
      return null;
    }
    if (c.running || st.rpm > 1) {
      say(
        L('Polotovar sa mení len pri stojacom vretene.', 'The workpiece can only be changed with the spindle stopped.'),
      );
      return null;
    }
    wk.hold = c.hold;
    wk.shape = wk.hold === 'div' ? 'round' : c.bShape;
    wk.WX = c.bL / 100;
    if (wk.shape === 'round') {
      wk.WZ = c.bD / 100;
      wk.WH = c.bD / 100;
    } else {
      wk.WZ = c.bW / 100;
      wk.WH = c.bH / 100;
    }
    if (!isDiv()) {
      wk.WB = Math.max(0.45, 0.97 - wk.WH);
      makeWork();
    }
    st.phi = st.phiT = 0;
    st.idx = 0;
    applyHold();
    st.lastRel = null;
    say(L('Upnutý nový polotovar.', 'A new workpiece is clamped.'), 'info');
    const [rx, rz, ry] = rel(st.tx, st.sz, st.h),
      tl = MILL_TOOLS[st.tool];
    if (penAt(rx, rz, ry, tl) > 0.001 || hitObst(rx, rz, ry, tl.r)) {
      st.h = clamp(yT() - (isDiv() ? DIV.AY + wk.WZ / 2 + 0.3 : wk.WB + wk.WH) - 0.2, H0, H0 + 4.2);
      c.z = (st.h - H0) * 100;
      return { z: c.z };
    }
    return {};
  };

  // ---------- ručné ovládanie prvkov ----------
  const gearGuard = () => {
    if (!c.running && st.rpm < 1) return true;
    say(
      L(
        'Otáčky sa preraďujú len pri stojacom vretene – najprv ho zastav.',
        'Speeds can only be changed with the spindle stopped – stop it first.',
      ),
      'warn',
    );
    return false;
  };
  const spdIdx = () => logNear(MILL_SPEEDS, c.rpm),
    feedIdx = () => logNear(MILL_FEEDS, c.feed);
  const setSpeed = (a, b) => {
    push('rpm', MILL_SPEEDS[a * 6 + b]);
    say(`${L('Zaradené otáčky', 'Speed selected:')} ${c.rpm} ${RPM()}.`, 'info');
  };
  const setFeed = (a, b) => {
    push('feed', MILL_FEEDS[a * 6 + b]);
    say(`${L('Posuv nastavený na', 'Feed set to')} ${c.feed} mm/min.`, 'info');
  };
  const xGuard = () => {
    if (!c.feedDir) return true;
    say(
      L(
        'Pri zaradenom posuve stola sa ručné koleso netočí – vráť páku posuvu do stredu.',
        'With the table feed engaged the handwheel is locked – return the feed lever to the centre.',
      ),
      'warn',
    );
    return false;
  };
  const xAct = () => (st.tx - X0) * 100,
    yAct = () => (st.sz - Y0) * 100,
    zAct = () => (st.h - H0) * 100;
  const turnX = (d) => {
    const a = xAct();
    push('x', clamp(clamp(c.x + (d * 10) / TAU, a - 20, a + 20), 0, 800));
  };

  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.32,
      inc: 1,
      guard: xGuard,
      label: LL('Ručné koleso stola (X) – pravé', 'Table handwheel (X) – right'),
      hint: LL(
        'Ťahaj za veniec alebo kľučku, alebo toč kolieskom myši. 1 otáčka = 10 mm.',
        'Drag the rim or handle, or use the mouse wheel. 1 turn = 10 mm.',
      ),
      turn: turnX,
      read: () => `X ${xAct().toFixed(1)} mm`,
    },
    wheelXR,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.32,
      inc: -1,
      guard: xGuard,
      label: LL('Ručné koleso stola (X) – ľavé', 'Table handwheel (X) – left'),
      hint: LL(
        'Ťahaj za veniec alebo kľučku, alebo toč kolieskom myši. 1 otáčka = 10 mm.',
        'Drag the rim or handle, or use the mouse wheel. 1 turn = 10 mm.',
      ),
      turn: (d) => turnX(-d),
      read: () => `X ${xAct().toFixed(1)} mm`,
    },
    wheelXL,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.36,
      inc: -1,
      label: LL('Ručné koleso priečnych saní (Y)', 'Saddle handwheel (Y)'),
      hint: LL(
        'V smere hodinových ručičiek ide stôl od stojana. 1 otáčka = 10 mm.',
        'Clockwise moves the table away from the column. 1 turn = 10 mm.',
      ),
      turn: (d) => {
        const a = yAct();
        push('y', clamp(clamp(c.y - (d * 10) / TAU, a - 10, a + 10), 0, 300));
      },
      read: () => `Y ${yAct().toFixed(1)} mm`,
    },
    wheelY,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.32,
      inc: -1,
      label: LL('Kľuka zdvihu konzoly (Z)', 'Knee elevating crank (Z)'),
      hint: LL(
        'V smere hodinových ručičiek konzola stúpa. 1 otáčka = 4 mm.',
        'Clockwise raises the knee. 1 turn = 4 mm.',
      ),
      turn: (d) => {
        const a = zAct();
        push('z', clamp(clamp(c.z - (d * 4) / TAU, a - 5, a + 5), 0, 420));
      },
      read: () => `Z ${zAct().toFixed(1)} mm`,
    },
    crankZ,
  );

  ctrl.reg(
    {
      type: 'lever',
      angles: S3_ANG,
      minR: 0.25,
      guard: gearGuard,
      label: LL('Páka otáčok I (rozsah)', 'Speed lever I (range)'),
      hint: LL(
        'Ťahaj do polohy alebo klikni. Preraďuje sa len pri stojacom vretene.',
        'Drag to a position or click. Shift only with the spindle stopped.',
      ),
      getIdx: () => Math.floor(spdIdx() / 6),
      onSet: (i) => setSpeed(i, spdIdx() % 6),
      read: () => `${c.rpm} ${RPM()}`,
    },
    levSA,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: S6_ANG,
      minR: 0.25,
      guard: gearGuard,
      label: LL('Páka otáčok II (stupeň)', 'Speed lever II (step)'),
      hint: LL(
        'Ťahaj do polohy alebo klikni. Preraďuje sa len pri stojacom vretene.',
        'Drag to a position or click. Shift only with the spindle stopped.',
      ),
      getIdx: () => spdIdx() % 6,
      onSet: (i) => setSpeed(Math.floor(spdIdx() / 6), i),
      read: () => `${c.rpm} ${RPM()}`,
    },
    levSB,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: S3_ANG,
      minR: 0.2,
      label: LL('Páka posuvov I (rozsah)', 'Feed lever I (range)'),
      hint: LL('18 posuvov 19 – 950 mm/min (3 × 6).', '18 feeds 19 – 950 mm/min (3 × 6).'),
      getIdx: () => Math.floor(feedIdx() / 6),
      onSet: (i) => setFeed(i, feedIdx() % 6),
      read: () => `${c.feed} mm/min`,
    },
    levFA,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: S6_ANG,
      minR: 0.2,
      label: LL('Páka posuvov II (stupeň)', 'Feed lever II (step)'),
      hint: LL('18 posuvov 19 – 950 mm/min (3 × 6).', '18 feeds 19 – 950 mm/min (3 × 6).'),
      getIdx: () => feedIdx() % 6,
      onSet: (i) => setFeed(Math.floor(feedIdx() / 6), i),
      read: () => `${c.feed} mm/min`,
    },
    levFB,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: DIR_ANG,
      minR: 0.2,
      label: LL('Páka posuvu stola (X)', 'Table feed lever (X)'),
      hint: LL(
        'Vľavo / stred = stop / vpravo. Stôl sa pohne, keď sa točí vreteno.',
        'Left / centre = stop / right. The table moves while the spindle turns.',
      ),
      getIdx: () => c.feedDir + 1,
      onSet: (i) => {
        push('feedDir', i - 1);
        if (i !== 1 && !(c.running && c.power))
          say(
            L(
              'Posuv stola zaradený – stôl sa pohne, keď sa roztočí vreteno.',
              'Table feed engaged – the table moves once the spindle turns.',
            ),
            'info',
          );
      },
      read: () => (c.feedDir < 0 ? L('vľavo', 'left') : c.feedDir > 0 ? L('vpravo', 'right') : 'stop'),
    },
    levDir,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0, -Math.PI / 2],
      minR: 0.22,
      label: LL('Hlavný vypínač', 'Main switch'),
      hint: LL('Otoč alebo klikni: 0 = vypnuté, I = zapnuté.', 'Turn or click: 0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0),
      onSet: (i) => {
        push('power', i === 1);
        if (i === 0) {
          push('running', false);
          say(
            L('Hlavný vypínač vypnutý – stroj je bez napätia.', 'Main switch off – the machine is de-energised.'),
            'warn',
          );
        } else
          say(
            L(
              'Hlavný vypínač zapnutý. Vreteno spustíš zeleným tlačidlom.',
              'Main switch on. Start the spindle with the green button.',
            ),
            'info',
          );
      },
      read: () => (c.power ? L('I – zapnuté', 'I – on') : L('0 – vypnuté', '0 – off')),
    },
    mainSwitch,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Tlačidlo ŠTART', 'START button'),
      hint: LL('Spustí vreteno, ak je zapnutý hlavný vypínač.', 'Starts the spindle if the main switch is on.'),
      action: () => {
        if (!c.power)
          say(
            L('Najprv zapni hlavný vypínač na rozvádzači.', 'Switch on the main switch on the cabinet first.'),
            'warn',
          );
        else push('running', true);
      },
    },
    btnStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Tlačidlo STOP', 'STOP button'),
      hint: LL('Zastaví vreteno.', 'Stops the spindle.'),
      action: () => push('running', false),
    },
    btnStop,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Chladenie', 'Coolant'),
      hint: LL('Zapne alebo vypne čerpadlo chladiacej kvapaliny.', 'Switches the coolant pump on or off.'),
      action: () => {
        push('coolant', !c.coolant);
        say(c.coolant ? L('Chladenie zapnuté.', 'Coolant on.') : L('Chladenie vypnuté.', 'Coolant off.'), 'info');
      },
    },
    btnCool,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Núdzový STOP', 'Emergency STOP'),
      hint: LL(
        'Okamžite zastaví vreteno, posuv aj chladenie.',
        'Immediately stops the spindle, the feed and the coolant.',
      ),
      action: () => {
        push('running', false);
        push('feedDir', 0);
        push('coolant', false);
        say(
          L(
            'Núdzové zastavenie – vreteno, posuv aj chladenie sú vypnuté.',
            'Emergency stop – spindle, feed and coolant are off.',
          ),
          'danger',
        );
      },
    },
    eStop,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.22,
      inc: 1,
      label: LL('Koliesko pinoly', 'Quill handwheel'),
      hint: LL(
        'Jemný zvislý posuv frézy pinolou. 1 otáčka = 4 mm, výsuv 0 – 80 mm.',
        'Fine vertical feed of the cutter by the quill. 1 turn = 4 mm, stroke 0 – 80 mm.',
      ),
      guard: () => {
        if (!c.quillLock) return true;
        say(L('Pinola je zaistená – uvoľni páku aretácie.', 'The quill is locked – release the lock lever.'));
        return false;
      },
      turn: (d) => {
        const a = st.q * 100;
        push('quill', clamp(clamp(c.quill + (d * 4) / TAU, a - 4, a + 4), 0, 80));
      },
      read: () => `${L('pinola', 'quill')} ${(st.q * 100).toFixed(2)} mm`,
    },
    wheelQ,
  );
  const lockLever = (key, title, hintSk, hintEn) => ({
    type: 'lever',
    angles: [-0.45, 0.5],
    minR: 0.18,
    label: title,
    hint: LL(hintSk, hintEn),
    getIdx: () => (c[key] ? 1 : 0),
    onSet: (i) => {
      push(key, i === 1);
      say(i ? L('Zaistené.', 'Locked.') : L('Uvoľnené.', 'Released.'), 'info');
    },
    read: () => (c[key] ? L('zaistené', 'locked') : L('uvoľnené', 'released')),
  });
  ctrl.reg(
    lockLever(
      'quillLock',
      LL('Aretácia pinoly', 'Quill lock'),
      'Zaistená pinola sa nedá vysúvať.',
      'A locked quill cannot be moved.',
    ),
    levQ,
  );
  ctrl.reg(
    lockLever(
      'kneeLock',
      LL('Aretácia konzoly', 'Knee clamp'),
      'Zaistená konzola sa nepohne zvisle – používa sa pri frézovaní v osi X a Y.',
      'A clamped knee cannot move vertically – used when milling along X and Y.',
    ),
    levKnee,
  );
  ctrl.reg(
    lockLever(
      'sadLock',
      LL('Aretácia saní', 'Saddle clamp'),
      'Zaistené sane sa nepohnú v osi Y.',
      'A clamped saddle cannot move in Y.',
    ),
    levSad,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Pracovná lampa', 'Work lamp'),
      hint: LL('Klik zapne alebo vypne lampu.', 'Click to switch the lamp on or off.'),
      action: () => push('light', !c.light),
    },
    lamp.shade,
  );

  // delenie o dielik (n = 40 / z otáčok kľuky); fréza musí byť mimo obrobku
  apiRef.current.index = (dir = 1) => {
    if (!isDiv()) return;
    if (st.indexing) {
      say(L('Delenie ešte prebieha.', 'Indexing is still in progress.'), 'info');
      return;
    }
    const z = c.divZ,
      nphi = st.phiT + (dir * TAU) / z,
      [rx, rz, ry] = rel(st.tx, st.sz, st.h),
      tl = MILL_TOOLS[st.tool];
    if (penAt(rx, rz, ry, tl) > 0.0005 || penAt(rx, rz, ry, tl, nphi) > 0.0005) {
      say(
        L(
          'Najprv odsuň frézu od obrobku – pri delení by doň narazila.',
          'Move the cutter away from the work first – it would hit it while indexing.',
        ),
      );
      return;
    }
    const p = indexPlan(z);
    st.phiT = nphi;
    st.idx = (((st.idx + dir) % z) + z) % z;
    st.indexing = true;
    push('divLock', false);
    say(
      L(
        `Delenie: ${p.turns} otáčok kľuky${p.holes ? ` + ${p.holes} dier na kruhu ${p.circle}` : ''} (n = 40 / ${z}).`,
        `Indexing: ${p.turns} crank turns${p.holes ? ` + ${p.holes} holes on the ${p.circle}-hole circle` : ''} (n = 40 / ${z}).`,
      ),
      'info',
    );
  };
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.2,
      inc: -1,
      label: LL('Kľuka deliaceho prístroja', 'Dividing-head crank'),
      hint: LL(
        'Jedna otáčka kľuky = 1/40 otáčky vretena. Točí sa len s uvoľnenou aretáciou; na celý dielik použi tlačidlo v paneli.',
        'One crank turn = 1/40 of a spindle turn. Only with the lock released; for a whole division use the panel button.',
      ),
      guard: () => {
        if (!isDiv()) return false;
        if (c.divLock) {
          say(
            L(
              'Vreteno deliaceho prístroja je zaistené – uvoľni aretáciu.',
              'The dividing-head spindle is locked – release the lock.',
            ),
          );
          return false;
        }
        return true;
      },
      turn: (d) => {
        const nphi = st.phiT - d / DIV_RATIO,
          [rx, rz, ry] = rel(st.tx, st.sz, st.h);
        if (penAt(rx, rz, ry, MILL_TOOLS[st.tool], nphi) > 0.0005) {
          say(L('Obrobok by narazil do frézy.', 'The work would hit the cutter.'));
          return;
        }
        st.phiT = nphi;
        st.phi = nphi;
      },
      read: () => `${((((st.phi * 180) / Math.PI) % 360) + 360) % 360 | 0}°`,
    },
    crankI,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [-0.45, 0.5],
      minR: 0.18,
      label: LL('Aretácia vretena deliaceho prístroja', 'Dividing-head spindle lock'),
      hint: LL(
        'Pri frézovaní musí byť zaistená, pri delení uvoľnená.',
        'Locked while milling, released while indexing.',
      ),
      getIdx: () => (c.divLock ? 1 : 0),
      onSet: (i) => {
        push('divLock', i === 1);
        say(i ? L('Zaistené.', 'Locked.') : L('Uvoľnené.', 'Released.'), 'info');
      },
      read: () => (c.divLock ? L('zaistené', 'locked') : L('uvoľnené', 'released')),
    },
    levDiv,
  );

  insp.goView('celok', true);

  // ---------- hlavná slučka ----------
  let raf;
  const loop = (nowMs) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    t += dt;

    if (c.unclamped && c.running) {
      push('running', false);
      say(
        L(
          'Polotovar nie je upnutý – vreteno sa nespustí.',
          'The workpiece is not clamped – the spindle will not start.',
        ),
      );
    }
    if (st.change && c.running) {
      push('running', false);
      say(L('Počkaj, kým sa dokončí výmena nástroja.', 'Wait until the tool change finishes.'), 'info');
    }
    // hlavný chod (vreteno sa točí v smere hodín pri pohľade zhora)
    st.rpm = approach(st.rpm, c.running && c.power ? c.rpm : 0, 1400 * dt);
    const running = st.rpm > 15;
    const revs = st.rpm > 0 ? (4.5 * st.rpm) / (st.rpm + 500) : 0;
    st.spin += revs * TAU * dt;
    spindle.rotation.y = -st.spin;
    wi.update(dt);
    jawM.position.z = wk.WZ - 1.0 + wi.open() * 0.25;

    // výmena nástroja: starý vypadne nadol z upínača, nový sa zasunie
    if (c.tool !== st.tool && !st.change) {
      const nt = MILL_TOOLS[c.tool],
        [rx, rz, ry] = rel(st.tx, st.sz, st.h, c.tool);
      if (c.running || running) {
        say(
          L('Nástroj sa mení len pri stojacom vretene.', 'The tool can only be changed with the spindle stopped.'),
          'warn',
        );
        push('tool', st.tool);
      } else if (!c.unclamped && (penAt(rx, rz, ry, nt) > 0.002 || hitObst(rx, rz, ry, nt.r))) {
        say(
          L(
            'Nový nástroj by zasiahol obrobok alebo zverák – najprv spusti konzolu nižšie (os Z).',
            'The new tool would hit the workpiece or the vise – lower the knee first (Z axis).',
          ),
          'warn',
        );
        push('tool', st.tool);
      } else st.change = { to: c.tool, t: 0, swapped: false };
    }
    if (st.change) {
      const ch = st.change;
      ch.t += dt;
      if (!ch.swapped) {
        toolG.position.y = -Math.min(1, ch.t / 0.5) * 1.2;
        if (ch.t >= 0.5) {
          buildTool(ch.to);
          st.tool = ch.to;
          st.lastRel = null;
          placeStream();
          ch.swapped = true;
          ch.t = 0;
        }
      } else {
        toolG.position.y = -1.2 * (1 - Math.min(1, ch.t / 0.5));
        if (ch.t >= 0.5) {
          toolG.position.y = 0;
          st.change = null;
          say(`${L('Upnutá', 'Clamped:')} ${millToolName(MILL_TOOLS[st.tool])}.`, 'info');
        }
      }
    }

    // automatický posuv stola
    if (c.feedDir && running) {
      const a = xAct();
      c.x = clamp(clamp(c.x + ((c.feedDir * c.feed) / 60) * c.timeScale * dt, a - 3, a + 3), 0, 800);
      if ((c.feedDir < 0 && a <= 0.05) || (c.feedDir > 0 && a >= 799.95)) {
        push('feedDir', 0);
        say(
          L(
            'Posuv stola vypnutý – stôl dosiahol koncovú polohu.',
            'Table feed off – the table reached its end position.',
          ),
          'info',
        );
      }
    } else if (c.feedDir) c.x = xAct(); // posuv stojí s vretenom, stôl nedobieha

    // pohyb stola (X), saní (Y) a konzoly (Z) s kontrolou kolízií
    const tl = MILL_TOOLS[st.tool];
    // zaistené osi sa nehýbu
    const lockAxis = (key, on, val, act, text) => {
      if (on && Math.abs(c[val] - act) > 0.05) {
        sayOnce(key, true, text, 'warn');
        c[val] = act;
        pend[val] = Math.round(act * 10) / 10;
      } else flags[key] = false;
    };
    lockAxis(
      'lk',
      c.kneeLock,
      'z',
      zAct(),
      L('Konzola je zaistená – uvoľni páku aretácie na konzole.', 'The knee is locked – release the knee clamp lever.'),
    );
    lockAxis(
      'ls',
      c.sadLock,
      'y',
      yAct(),
      L(
        'Sane sú zaistené – uvoľni páku aretácie na saniach.',
        'The saddle is locked – release the saddle clamp lever.',
      ),
    );
    lockAxis(
      'lq',
      c.quillLock,
      'quill',
      st.q * 100,
      L(
        'Pinola je zaistená – uvoľni páku aretácie na hlave.',
        'The quill is locked – release the quill lock lever on the head.',
      ),
    );
    const txT = X0 + clamp(c.x, 0, 800) / 100,
      szT = Y0 + clamp(c.y, 0, 300) / 100,
      hT = H0 + clamp(c.z, 0, 420) / 100,
      qT = clamp(c.quill, 0, 80) / 100;
    const vx = st.cutting ? Math.max(0.25, (c.feed / 6000) * c.timeScale * 1.2) : 2.4,
      vy = st.cutting ? 0.2 : 1.6,
      vh = st.cutting ? 0.06 : 0.7;
    let nx = approach(st.tx, txT, vx * dt),
      ny = approach(st.sz, szT, vy * dt),
      nh = approach(st.h, hT, vh * dt),
      nq = approach(st.q, qT, (st.cutting ? 0.05 : 0.5) * dt);
    let blocked = null;
    if (nx !== st.tx || ny !== st.sz || nh !== st.h || nq !== st.q) {
      const r = st.change ? 0.24 : tl.r,
        [rx0, rz0, ry0] = rel(st.tx, st.sz, st.h);
      const pen0 = running || c.unclamped ? 0 : penAt(rx0, rz0, ry0, tl),
        obst0 = hitObst(rx0, rz0, ry0, r);
      let why = null;
      const ok = (a, b, h2, q2 = st.q) => {
        const [rx, rz, ry] = rel(a, b, h2, st.tool, q2);
        const o = hitObst(rx, rz, ry, r);
        if (o && !obst0) {
          why = o;
          return false;
        }
        if (!running && !c.unclamped && penAt(rx, rz, ry, tl) > Math.max(0.002, pen0 + 1e-5)) {
          why = 'work';
          return false;
        }
        return true;
      };
      if (!ok(nx, ny, nh, nq)) {
        blocked = why;
        let ax = st.tx,
          ay = st.sz,
          ah = st.h,
          aq = st.q;
        if (ok(nx, ay, ah, aq)) ax = nx;
        if (ok(ax, ny, ah, aq)) ay = ny;
        if (ok(ax, ay, nh, aq)) ah = nh;
        if (ok(ax, ay, ah, nq)) aq = nq;
        nx = ax;
        ny = ay;
        nh = ah;
        nq = aq;
      }
    }
    sayOnce(
      'work',
      blocked === 'work',
      L(
        'Fréza narazila do obrobku. Pri stojacom vretene nemôže rezať – spusti vreteno.',
        'The cutter hit the workpiece. It cannot cut with the spindle stopped – start the spindle.',
      ),
      'danger',
    );
    sayOnce(
      'obst',
      !!blocked && blocked !== 'work',
      `${L('Fréza by narazila do', 'The cutter would hit')} ${blocked} – ${L('pohyb je zastavený.', 'the motion is stopped.')}`,
      'warn',
    );
    wheelXR.rotation.z += ((nx - st.tx) / 0.1) * TAU;
    wheelXL.rotation.z -= ((nx - st.tx) / 0.1) * TAU;
    wheelY.rotation.z -= ((ny - st.sz) / 0.1) * TAU;
    crankZ.rotation.z -= ((nh - st.h) / 0.04) * TAU;
    wheelQ.rotation.z += ((nq - st.q) / 0.04) * TAU;
    const qMoved = nq !== st.q;
    st.tx = nx;
    st.sz = ny;
    st.h = nh;
    st.q = nq;
    spindle.position.y = NOSE - st.q;
    if (qMoved) placeStream();

    // frézovanie po celej dráhe od minulej snímky, aby pri rýchlom posuve nezostali hrebene
    const cur = rel(st.tx, st.sz, st.h),
      prev = st.lastRel || cur;
    st.lastRel = cur;
    // deliaci prístroj: s uvoľnenou aretáciou alebo počas delenia sa nesmie frézovať
    if (
      running &&
      isDiv() &&
      (!c.divLock || st.indexing) &&
      !c.unclamped &&
      penAt(cur[0], cur[1], cur[2], tl) > 0.0005
    ) {
      push('running', false);
      say(
        L(
          'Vreteno deliaceho prístroja nie je zaistené – obrobok by sa pootočil. Stroj zastavený; zaisti aretáciu.',
          'The dividing-head spindle is not locked – the work would turn. Machine stopped; lock the spindle.',
        ),
        'danger',
      );
    } else if (running && !st.change && !c.unclamped) {
      const n = Math.min(
        60,
        Math.max(1, Math.ceil(Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]) / (tl.r * 0.3))),
      );
      let removed = 0;
      for (let s = 1; s <= n; s++) {
        const f = s / n;
        removed += cutAt(
          prev[0] + (cur[0] - prev[0]) * f,
          prev[1] + (cur[1] - prev[1]) * f,
          prev[2] + (cur[2] - prev[2]) * f,
          tl,
        );
      }
      if (removed > 0) {
        st.cutT = t;
        workDirty = true;
        chipAcc += dt * (30 + Math.min(70, removed * 20));
        while (chipAcc >= 1) {
          spawnChip();
          chipAcc -= 1;
        }
      }
    }
    st.cutting = t - st.cutT < 0.25;
    if (workDirty && t - lastBuild > 0.06) {
      if (isDiv()) rebuildBar();
      else hf.rebuild();
      workDirty = false;
      lastBuild = t;
    }
    // delenie: vreteno sa pootočí na cieľový uhol, kľuka sa točí 40× rýchlejšie; potom sa aretácia zaistí
    if (isDiv()) {
      if (st.phi !== st.phiT) {
        st.phi = approach(st.phi, st.phiT, (TAU / Math.max(2, c.divZ) / 1.4) * dt);
        if (st.phi === st.phiT && st.indexing) {
          st.indexing = false;
          push('divLock', true);
          say(
            L('Pootočené o dielik – aretácia vretena zaistená.', 'Indexed one division – spindle lock engaged.'),
            'info',
          );
        }
      }
      if (!c.unclamped) barG.rotation.x = st.phi;
      spinG.rotation.x = st.phi;
      crankI.rotation.z = -st.phi * DIV_RATIO;
      tailG.position.x = approach(tailG.position.x, tailX(), 3 * dt);
    }

    // pohyb skupín, chladenie, lampa
    knee.position.y = st.h - 1.35;
    sad.position.z = st.sz;
    tbl.position.x = st.tx;
    updateSadCable(st.h, st.sz);
    ram.scale.y = Math.max(0.01, st.h - 1.35 - 2.4 - 0.6);
    stream.visible = c.coolant && c.power && !st.change;
    if (stream.visible) {
      M.coolant.opacity = 0.45 + 0.12 * Math.sin(t * 40);
      const to = streamEnd();
      dropAcc += dt * 70;
      while (dropAcc >= 1) {
        dropAcc -= 1;
        const f = Math.random(),
          p = nozzle.clone().lerp(to, f);
        drops.spawn(
          p,
          to
            .clone()
            .sub(nozzle)
            .normalize()
            .multiplyScalar(2.2)
            .add(v3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)),
          1.4,
        );
      }
    }
    drops.update(dt, (p) =>
      Math.abs(p.x - st.tx) < wk.WX / 2 && Math.abs(p.z - st.sz - wzc()) < wk.WZ / 2
        ? st.h + 0.75 + wk.WB + wk.WH * 0.9
        : Math.abs(p.x - st.tx) < 6.5 && Math.abs(p.z - st.sz) < 1.5
          ? st.h + 0.75
          : 0.02,
    );
    M.lamp.emissive.setHex(c.running && c.power ? 0x22dd55 : c.power ? 0x8a5a00 : 0x000000);
    needle.rotation.z = c.power ? -0.25 - (st.rpm / 2000) * 0.6 - (st.cutting ? 0.35 : 0) : 0.9;
    lamp.update(c.light);
    chipsP.update(dt, (p) => (Math.abs(p.x - st.tx) < 6.5 && Math.abs(p.z - st.sz) < 1.5 ? st.h + 0.75 : 0.02));

    ctrl.update(dt);
    insp.update(t, c);

    if (t - teleT > 0.1) {
      teleT = t;
      const [rx, rz, ry] = rel(st.tx, st.sz, st.h);
      const over = Math.abs(rx) < wk.WX / 2 + tl.r && Math.abs(rz - wzc()) < wk.WZ / 2 + tl.r;
      setTele({
        rpm: st.rpm,
        x: xAct(),
        y: yAct(),
        z: zAct(),
        q: st.q * 100,
        vc: (Math.PI * tl.d * st.rpm) / 1000,
        vf: c.feedDir && running ? c.feed : 0,
        cutting: st.cutting && running,
        tool: st.tool,
        changing: !!st.change,
        depth: isDiv()
          ? Math.max(0, (DIV.AY + wk.WZ / 2 - ry) * 100)
          : over
            ? Math.max(0, (wk.WB + wk.WH - ry) * 100)
            : 0,
        msg: st.msg && st.msg.until > t ? st.msg : null,
        hold: wk.hold,
        idx: st.idx,
        phi: st.phi,
        indexing: !!st.indexing,
      });
      drawDro(xAct(), yAct(), zAct() + st.q * 100);
      if (c.feedDir) pend.x = Math.round(c.x * 10) / 10;
      if (lastDir !== c.feedDir) pend.feedDir = c.feedDir;
      lastDir = c.feedDir;
      if (Object.keys(pend).length) {
        const p = { ...pend };
        Object.keys(pend).forEach((k) => delete pend[k]);
        setUi((u) => ({ ...u, ...p }));
      }
    }

    snd.update({ motor: st.rpm / 2000, cut: st.cutting && running ? 1 : 0 });
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    snd.dispose();
    ctrl.dispose();
    insp.dispose();
    wi.dispose();
    disposeStage();
  };
}
