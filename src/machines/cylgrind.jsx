import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { createMachineWorkInspect } from '../core/machineWorkInspect';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createDrops, createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection, fromB64, toB64 } from '../ui/tools';
import { ShaftDrawing } from '../ui/sketch';
import { CYL_TRAVERSE, CYL_WORK_SPEEDS, WHEEL, createShaft, cylChecks, dAt, grindPass, shaftInfo } from './cylMath';
import {
  BlankSection,
  HelpFooter,
  PanelHeader,
  PartsSection,
  SceneView,
  SegRow,
  Slider,
  Toggle,
  ViewSection,
  mkParts,
  useMachine,
  useTele,
} from '../ui/common';

// =====================================================================
// HROTOVÁ BRÚSKA NA GUĽATO (predloha TOS BUA)
// =====================================================================
// mierka 1 = 100 mm. Os obrobku y = AX, z = ZA; stôl so hrotmi sa posúva v X, brúsny vreteník vzadu prisúva kotúč v Z.
// Stred kotúča je pevne v x = 0; poloha kotúča na hriadeli u (mm od ľavého konca) = L/2 − x stola.
const AX = 10.0,
  ZA = 1.0,
  RW = WHEEL.D / 200,
  BW = WHEEL.B / 100;
const cylParts = () =>
  mkParts([
    [
      'lozko',
      'Lôžko',
      'Bed',
      'Lôžko s hydraulikou',
      'Bed with hydraulics',
      'V lôžku je hydraulický agregát, ktorý posúva stôl tam a späť medzi dorazmi. Vpredu sú ručné kolesá stola a prísuvu a páka hydrauliky.',
      'The bed holds the hydraulic unit that moves the table back and forth between the dogs. The table and infeed handwheels and the hydraulic lever are at the front.',
    ],
    [
      'stol',
      'Stôl',
      'Table',
      'Stôl s vreteníkom a koníkom',
      'Table with headstock and tailstock',
      'Na stole je pracovný vreteník s unášacím kotúčom a koník. Obrobok je medzi pevnými hrotmi a otáča sa ho unášač. Na prednej hrane sú dorazy obratu stola.',
      'The table carries the work headstock with the drive plate and the tailstock. The work sits between dead centres and is turned by the dog. The reversing dogs are on the front edge.',
    ],
    [
      'vretennik',
      'Brúsny vreteník',
      'Wheelhead',
      'Brúsny vreteník',
      'Wheelhead',
      'Kotúč Ø400 × 40 mm sa točí obvodovou rýchlosťou asi 35 m/s. Vreteník sa prisúva k obrobku kolesom vpredu – 1 dielik = 0,005 mm na priemere.',
      'The Ø400 × 40 mm wheel runs at about 35 m/s. The wheelhead is fed to the work by the front handwheel – one division = 0.005 mm on diameter.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Hriadeľ medzi hrotmi',
      'Shaft between centres',
      'Kalený oceľový hriadeľ s prídavkom na brúsenie. Obrúsená plocha je lesklá, prepálené miesta sú tmavé.',
      'A hardened steel shaft with grinding allowance. The ground surface is bright, burnt spots are dark.',
    ],
    [
      'chladenie',
      'Chladenie',
      'Coolant',
      'Chladiaca emulzia',
      'Coolant',
      'Dýza nad kotúčom leje emulziu do miesta brúsenia. Bez chladenia sa povrch ľahko prepáli.',
      'The nozzle above the wheel floods the grinding zone with coolant. Without it the surface burns easily.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládací panel',
      'Control panel',
      'Hlavný vypínač, chod kotúča, otáčanie obrobku a chladenie.',
      'Main switch, wheel drive, work rotation and coolant.',
    ],
  ]);
const CYL_TASKS = [
  {
    id: 'h6',
    title: () => L('Hriadeľ Ø40 h6', 'Shaft Ø40 h6'),
    desc: () =>
      L(
        'Kalený hriadeľ Ø40,3 × 200 mm medzi hrotmi. Obrús ho pozdĺžnym brúsením na Ø40 h6 (40,000 – 39,984 mm) na dĺžke aspoň 160 mm, kužeľovitosť najviac 0,005 mm, bez prepálenia. Dorazy nastav tak, aby kotúč na koncoch prebiehal asi o tretinu šírky. Hrubuj prísuvom 0,01 – 0,02 mm na obrat, nakoniec 0,005 mm a nechaj vyiskriť (niekoľko prechodov bez prísuvu).',
        'A hardened shaft Ø40.3 × 200 mm between centres. Traverse-grind it to Ø40 h6 (40.000 – 39.984 mm) over at least 160 mm, taper at most 0.005 mm, no burns. Set the dogs so that the wheel overruns the ends by about a third of its width. Rough with 0.01 – 0.02 mm infeed per reversal, finish with 0.005 mm and spark out (a few passes without infeed).',
      ),
    setup: { bD: 40.3, bL: 200, dT: 40.32, dogL: 15, dogR: 185, nw: 112, tv: 1, cool: true },
    drawing: () => <ShaftDrawing d={40} tol="h6" len={160} bL={200} />,
    labels: {
      size: () => L('Priemer Ø40 h6 (40,000 – 39,984)', 'Diameter Ø40 h6 (40.000 – 39.984)'),
      len: () => L('Obrúsená dĺžka ≥ 160 mm bez medzier', 'Ground length ≥ 160 mm without gaps'),
      taper: () => L('Kužeľovitosť ≤ 0,005 mm', 'Taper ≤ 0.005 mm'),
      burn: () => L('Bez prepálenia', 'No burns'),
    },
  },
  {
    id: 'h5',
    title: () => L('Čap Ø25 h5', 'Journal Ø25 h5'),
    desc: () =>
      L(
        'Hriadeľ Ø25,2 × 150 mm. Obrús Ø25 h5 (25,000 – 24,991 mm) na dĺžke aspoň 120 mm s kužeľovitosťou do 0,004 mm. Malý priemer – vyššie otáčky obrobku (vw 10 – 20 m/min), jemný posledný prísuv a dôkladné vyiskrovanie.',
        'Shaft Ø25.2 × 150 mm. Grind Ø25 h5 (25.000 – 24.991 mm) over at least 120 mm with taper up to 0.004 mm. Small diameter – higher work speed (vw 10 – 20 m/min), a fine last infeed and thorough spark-out.',
      ),
    setup: { bD: 25.2, bL: 150, dT: 25.22, dogL: 12, dogR: 138, nw: 224, tv: 1, cool: true },
    drawing: () => <ShaftDrawing d={25} tol="h5" len={120} bL={150} />,
    labels: {
      size: () => L('Priemer Ø25 h5 (25,000 – 24,991)', 'Diameter Ø25 h5 (25.000 – 24.991)'),
      len: () => L('Obrúsená dĺžka ≥ 120 mm bez medzier', 'Ground length ≥ 120 mm without gaps'),
      taper: () => L('Kužeľovitosť ≤ 0,004 mm', 'Taper ≤ 0.004 mm'),
      burn: () => L('Bez prepálenia', 'No burns'),
    },
  },
].map((t) => ({ ...t, checks: (m) => cylChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const CYL_SAFETY = () => [
  L(
    'Kotúč je bez trhlín (skúška zvukom), kryt kotúča je na mieste.',
    'The wheel is free of cracks (ring test), the wheel guard is in place.',
  ),
  L(
    'Obrobok je medzi hrotmi, unášač je dotiahnutý, koník zaistený.',
    'The work is between centres, the dog is tight, the tailstock clamped.',
  ),
  L('Pri rozbehu kotúča nestojím v rovine kotúča.', 'I do not stand in the plane of the wheel when it starts.'),
  L(
    'Mám ochranné okuliare a dorazy stola sú nastavené pri stojacom stole.',
    'I wear safety glasses and the table dogs were set with the table stopped.',
  ),
];

function CylGrinderSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    wheel: false,
    work: false,
    trav: false,
    cool: true,
    light: true,
    manual: false,
    dT: 40.6,
    u: 100,
    dogL: 15,
    dogR: 185,
    tv: 1,
    nw: 112,
    autoIn: false,
    inStep: 0.01,
    dStop: 39.992,
    timeScale: 5,
    measX: 100,
    bD: 40.3,
    bL: 200,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    d: 40.6,
    u: 100,
    contact: false,
    sparks: false,
    msg: null,
    wheelOn: false,
    workOn: false,
    trav: false,
  });

  useEffect(() => {
    const mount = mountRef.current,
      layer = layerRef.current,
      tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('grinder');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x7d9aa8, 0x698694, 0x4b6370),
      work: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.85 }),
      wheelM: std(0xb9b39f, 0.95, 0.0),
      spark: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
      lampShade: std(0x698694, 0.5, 0.2),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, pivotLever, handwheel } = kit;
    const root = new THREE.Group();
    scene.add(root);
    apiRef.current.machineModel = { root, name: L('Hrotová brúska na guľato', 'Cylindrical grinder') };
    const G = {};
    const grp = (k, parent = root) => {
      const g = new THREE.Group();
      g.userData.part = k;
      parent.add(g);
      G[k] = g;
      return g;
    };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- lôžko ----------
    const bed = grp('lozko');
    box(bed, -9, 9, 0, 8.0, -4.6, 2.6, M.green);
    box(bed, -9.1, 9.1, 0, 0.3, -4.7, 2.7, M.greenDeep);
    box(bed, -8.6, 8.6, 7.9, 8.02, 0.1, 1.9, M.ways);
    box(bed, -2.6, 2.6, 8.0, 8.6, -4.4, -0.6, M.greenDark); // lôžko brúsneho vreteníka
    const wTable = handwheel(bed, 0.6, -3.2, 5.6, 2.75, 'z', 0.4);
    cylZ(bed, 0.12, 0.12, 2.6, 2.75, -3.2, 5.6, M.steel, 12);
    const wFeed = handwheel(bed, 0.72, 3.2, 5.6, 2.8, 'z', 0.45);
    cylZ(bed, 0.12, 0.12, 2.6, 2.8, 3.2, 5.6, M.steel, 12);
    cylZ(bed, 0.42, 0.42, 2.6, 2.66, 3.2, 5.6, M.white, 40); // stupnica prísuvu
    box(bed, -0.35, 0.35, 6.6, 7.6, 2.6, 2.72, M.greenDark);
    const levTrav = pivotLever(bed, 0, 7.1, 2.72, 0.5, 1.25); // páka hydrauliky stola
    const revLever = new THREE.Group();
    revLever.position.set(0, 7.9, 2.65);
    bed.add(revLever);
    box(revLever, -0.06, 0.06, 0, 0.55, -0.06, 0.06, M.steelDark); // obracacia páka (dorazy)
    // ---------- ovládací panel ----------
    const pan = grp('ovladanie');
    box(pan, 5.0, 8.4, 4.6, 7.4, 2.6, 2.7, M.panel);
    const pbtn = (x, y, m) => {
      const g = new THREE.Group();
      g.position.set(x, y, 2.7);
      pan.add(g);
      cylZ(g, 0.13, 0.13, 0, 0.07, 0, 0, m, 20);
      hitProxy(g, 0.18, 0, 0, 0.05);
      return g;
    };
    const bWOn = pbtn(5.6, 6.6, M.btnGreen),
      bWOff = pbtn(6.1, 6.6, M.red),
      bKOn = pbtn(5.6, 5.8, M.btnGreen),
      bKOff = pbtn(6.1, 5.8, M.red),
      bCool = pbtn(6.9, 5.8, M.blue);
    const lampW = std(0x1f5f33, 0.4, 0.1),
      lampK = std(0x1f5f33, 0.4, 0.1);
    ball(pan, 0.06, 6.55, 6.6, 2.72, lampW);
    ball(pan, 0.06, 6.55, 5.8, 2.72, lampK);
    const mainSw = new THREE.Group();
    mainSw.position.set(7.6, 6.6, 2.71);
    pan.add(mainSw);
    cylZ(mainSw, 0.2, 0.2, 0, 0.06, 0, 0, M.black, 24);
    box(mainSw, -0.05, 0.05, -0.24, 0.24, 0.06, 0.16, M.red);
    const eStop = new THREE.Group();
    eStop.position.set(7.6, 5.3, 2.7);
    pan.add(eStop);
    cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16);
    cylZ(eStop, 0.2, 0.19, 0.07, 0.16, 0, 0, M.red, 24);
    hitProxy(eStop, 0.26, 0, 0, 0.1);
    // ---------- stôl s vreteníkom a koníkom ----------
    const tbl = grp('stol');
    box(tbl, -8.0, 8.0, 8.02, 8.5, 0.0, 2.0, M.greenDark);
    const head = new THREE.Group();
    tbl.add(head);
    box(head, -1.9, 0, 8.5, 11.4, 0.0, 2.0, M.green);
    cylX(head, 0.32, 0.32, 0, 0.3, AX, ZA, M.steelDark, 24);
    const drive = new THREE.Group();
    drive.position.set(0.32, AX, ZA);
    head.add(drive);
    cylX(drive, 0.62, 0.62, 0, 0.1, 0, 0, M.steel, 36);
    box(drive, 0.1, 0.3, 0.35, 0.55, -0.06, 0.06, M.steelDark); // unášací kotúč s kolíkom
    cylX(head, 0.0, 0.13, 0.42, 0.75, AX, ZA, M.steel, 20); // pevný hrot
    const tail = new THREE.Group();
    tbl.add(tail);
    box(tail, 0.5, 2.2, 8.5, 11.0, 0.15, 1.85, M.green);
    cylX(tail, 0.28, 0.28, 0.0, 0.5, AX, ZA, M.steel, 24);
    cylX(tail, 0.13, 0.0, -0.33, 0.0, AX, ZA, M.steel, 20);
    ball(tail, 0.12, 1.4, 11.15, 1.0, M.black);
    // dorazy obratu na prednej hrane stola
    const dogLm = box(tbl, -0.1, 0.1, 7.85, 8.3, 2.0, 2.18, M.red),
      dogRm = box(tbl, -0.1, 0.1, 7.85, 8.3, 2.0, 2.18, M.red);
    // obrobok – prstence s farbou podľa stavu povrchu
    const workG = grp('obrobok', tbl);
    workG.position.set(0, AX, ZA);
    const NT = 40;
    let shaft = null,
      wMesh = null,
      wL = 2,
      dirty = true;
    const C_RAW = new THREE.Color(0x5d6267),
      C_GR = new THREE.Color(0xe5e9ec),
      C_BURN = new THREE.Color(0x5a4a6e);
    const buildWork = () => {
      if (wMesh) {
        workG.remove(wMesh);
        wMesh.geometry.dispose();
      }
      const N = shaft.N,
        geo = new THREE.BufferGeometry(),
        pos = new Float32Array(((N + 1) * NT + 2) * 3),
        col = new Float32Array(((N + 1) * NT + 2) * 3),
        idx = [];
      for (let i = 0; i < N; i++)
        for (let j = 0; j < NT; j++) {
          const a = i * NT + j,
            b = i * NT + ((j + 1) % NT);
          idx.push(a, b, a + NT, b, b + NT, a + NT);
        }
      const left = (N + 1) * NT,
        right = left + 1;
      for (let j = 0; j < NT; j++) {
        idx.push(left, (j + 1) % NT, j);
        idx.push(right, N * NT + j, N * NT + ((j + 1) % NT));
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(idx);
      wMesh = new THREE.Mesh(geo, M.work);
      wMesh.castShadow = true;
      wMesh.userData.part = 'obrobok';
      workG.add(wMesh);
      G.obrobok = workG;
      dirty = true;
    };
    const refreshWork = () => {
      const N = shaft.N,
        pos = wMesh.geometry.attributes.position.array,
        col = wMesh.geometry.attributes.color.array;
      let o = 0;
      for (let i = 0; i <= N; i++) {
        const k = Math.min(i, N - 1),
          r = shaft.d[k] / 200,
          x = -wL / 2 + (i * shaft.dx) / 100,
          cc = shaft.burn[k] ? C_BURN : shaft.mask[k] ? C_GR : C_RAW;
        for (let j = 0; j < NT; j++) {
          const a = (j / NT) * TAU;
          pos[o] = x;
          pos[o + 1] = Math.cos(a) * r;
          pos[o + 2] = Math.sin(a) * r;
          col[o] = cc.r;
          col[o + 1] = cc.g;
          col[o + 2] = cc.b;
          o += 3;
        }
      }
      for (const x of [-wL / 2, wL / 2]) {
        pos[o] = x;
        pos[o + 1] = 0;
        pos[o + 2] = 0;
        col[o] = C_RAW.r;
        col[o + 1] = C_RAW.g;
        col[o + 2] = C_RAW.b;
        o += 3;
      }
      wMesh.geometry.attributes.position.needsUpdate = true;
      wMesh.geometry.attributes.color.needsUpdate = true;
      wMesh.geometry.computeVertexNormals();
      wMesh.geometry.computeBoundingSphere();
    };
    const makeShaft = (D, Lmm) => {
      shaft = createShaft(D, Lmm, Math.round(Lmm * 2));
      wL = Lmm / 100;
      head.position.x = -wL / 2 - 0.75;
      tail.position.x = wL / 2 + 0.33;
      buildWork();
    };
    makeShaft(c.bD, c.bL);
    // ---------- brúsny vreteník ----------
    const wh = grp('vretennik');
    const whz = new THREE.Group();
    wh.add(whz);
    box(whz, -2.2, 2.2, 8.6, 9.0, -1.4, 1.4, M.green);
    box(whz, 0.3, 2.0, AX - 0.9, AX + 0.9, -1.0, 1.0, M.green); // skriňa vretena
    cylY(whz, 0.55, 0.55, AX + 0.9, AX + 2.0, 1.15, -0.2, M.green, 24); // motor
    box(whz, -2.0, 2.0, 9.0, AX - 0.9, -1.2, 0.2, M.greenDark);
    const wheel = new THREE.Group();
    whz.add(wheel);
    wheel.position.set(0, AX, 0);
    cylX(wheel, RW, RW, -BW / 2, BW / 2, 0, 0, M.wheelM, 64);
    cylX(wheel, 0.45, 0.45, -BW / 2 - 0.05, BW / 2 + 0.05, 0, 0, M.steelDark, 24);
    box(wheel, -BW / 2 - 0.06, -BW / 2 - 0.05, -0.08, 0.08, -0.5, 0.5, M.black); // značka otáčania
    // kryt kotúča: plechový výsek prstenca s bočnicami, otvorený k obrobku (svet: z = r cos θ, y = r sin θ)
    const gShape = new THREE.Shape(),
      gA = Math.PI / 3,
      gB = Math.PI * 1.78,
      ro = RW + 0.2,
      ri = RW + 0.05;
    for (let k = 0; k <= 40; k++) {
      const th = gA + ((gB - gA) * k) / 40;
      const x = -ro * Math.cos(th),
        y = ro * Math.sin(th);
      if (k) gShape.lineTo(x, y);
      else gShape.moveTo(x, y);
    }
    for (let k = 40; k >= 0; k--) {
      const th = gA + ((gB - gA) * k) / 40;
      gShape.lineTo(-ri * Math.cos(th), ri * Math.sin(th));
    }
    const guardGeo = new THREE.ExtrudeGeometry(gShape, { depth: BW + 0.3, bevelEnabled: false, curveSegments: 4 });
    guardGeo.rotateY(Math.PI / 2);
    guardGeo.translate(-(BW + 0.3) / 2, 0, 0);
    add(whz, guardGeo, M.green, 0, AX, 0);
    [-1, 1].forEach((sd) => {
      const side = new THREE.Shape();
      side.absarc(0, 0, ro, Math.PI - gB, Math.PI - gA, false);
      side.lineTo(0, 0);
      const sg = new THREE.ShapeGeometry(side, 24);
      sg.rotateY(Math.PI / 2);
      add(whz, sg, M.greenDark, sd * (BW / 2 + 0.15), AX, 0);
    });
    // chladenie: dýza nad kotúčom
    const coolG = grp('chladenie', whz);
    cylY(coolG, 0.05, 0.05, AX + RW + 0.3, AX + RW + 1.4, 0.6, RW * 0.55, M.steel, 10);
    box(coolG, -0.25, 0.65, AX + RW + 0.25, AX + RW + 0.35, RW * 0.55 - 0.05, RW * 0.55 + 0.05, M.steel);
    const nozzle = add(coolG, new THREE.CylinderGeometry(0.06, 0.12, 0.3, 12), M.blue, 0, AX + 0.95, RW * 0.82);
    nozzle.rotation.x = 0.7;
    const drops = createDrops(scene, 260),
      sparks = createParticles(scene, new THREE.BoxGeometry(0.03, 0.03, 0.09), M.spark, 260, false);
    const lamp = createLamp(scene, bed, kit, M, {
      base: v3(-5.0, 8.0, -1.8),
      elbow: v3(-4.4, 12.6, -1.0),
      head: v3(-2.4, 12.4, 1.8),
      aim: v3(0, AX, ZA),
      angle: 0.5,
      power: 2.8,
    });

    // ---------- stav ----------
    const st = {
      xt: wL / 2 - c.u / 100,
      d: c.dT,
      dir: 1,
      wheel: 0,
      work: 0,
      spin: 0,
      wspin: 0,
      msg: null,
      sparkT: -9,
      burnSaid: 0,
    };
    let t = 0,
      last = performance.now(),
      teleT = 0,
      sparkAcc = 0,
      dropAcc = 0;
    const flags = {};
    const say = (text, kind = 'warn') => {
      st.msg = { text, kind, until: t + 3 };
    };
    const sayOnce = (key, cond, text, kind) => {
      if (cond && !flags[key]) say(text, kind);
      flags[key] = cond;
    };
    const uNow = () => (wL / 2 - st.xt) * 100; // stred kotúča na hriadeli (mm od ľavého konca)
    const uMin = () => -WHEEL.B / 3,
      uMax = () => shaft.L + WHEEL.B / 3;
    const maxUnder = (u = uNow()) => {
      let m = 0;
      const i0 = Math.max(0, Math.floor((u - WHEEL.B / 2) / shaft.dx)),
        i1 = Math.min(shaft.N - 1, Math.floor((u + WHEEL.B / 2) / shaft.dx));
      for (let i = i0; i <= i1; i++) m = Math.max(m, shaft.d[i]);
      return m;
    };
    const wheelZ = (d) => ZA - (RW + d / 200);

    // ---------- pohľady ----------
    const anchors = {
      lozko: () => v3(-7.5, 4.0, 2.7),
      stol: () => v3(st.xt + 6.5, 8.6, 2.0),
      vretennik: () => v3(1.4, AX + 2.2, wheelZ(st.d) - 0.2),
      obrobok: () => v3(st.xt - wL / 4, AX + 0.45, ZA),
      chladenie: () => v3(0.6, AX + RW + 1.5, wheelZ(st.d) + RW * 0.55),
      ovladanie: () => v3(6.7, 7.5, 2.7),
    };
    const views = {
      celok: () => [
        [9, 15, 20],
        [0, 8.5, -0.5],
      ],
      rez: () => [[2.6, AX + 2.2, ZA + 4.5], [0, AX, ZA - 0.3], true],
      zhora: () => [[0, 22, 2.5], [0, AX, 0], true],
      panel: () => [[4, 7.5, 11], [3.5, 6.2, 2.6], true],
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
    apiRef.current.measure = () => ({ shaft, info: shaftInfo(shaft) });
    apiRef.current.dAt = (x) => dAt(shaft, x);
    apiRef.current.save = () => ({
      v: 1,
      D: shaft.d0,
      L: shaft.L,
      N: shaft.N,
      d: toB64(shaft.d),
      mask: toB64(shaft.mask),
      burn: toB64(shaft.burn),
    });
    apiRef.current.load = (r) => {
      if (!r || r.v !== 1) return false;
      push('bD', r.D);
      push('bL', r.L);
      if (!apiRef.current.newBlank()) return false;
      if (shaft.N !== r.N) return false;
      shaft.d.set(fromB64(r.d, Float64Array));
      shaft.mask.set(fromB64(r.mask, Uint8Array));
      shaft.burn.set(fromB64(r.burn, Uint8Array));
      dirty = true;
      return true;
    };
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if (c.running || c.drive || c.wheel || c.work || c.trav)
        throw new Error(
          L('Najprv zastav stroj a potom exportuj obrobok.', 'Stop the machine before exporting the workpiece.'),
        );
      refreshWork();
      return exportStep(workG);
    };
    const wi = createMachineWorkInspect({
      scene,
      camera,
      dom,
      insp,
      c,
      set,
      apiRef,
      say,
      getObj: () => workG,
      getSpot: () => v3(0, AX + 1.5, 7),
      canInspect: () =>
        c.wheel || c.work || c.trav || st.wheel > 0.01 || st.work > 0.01
          ? L('Najprv zastav kotúč, obrobok aj posuv stola.', 'Stop the wheel, work rotation and table traverse first.')
          : st.d < maxUnder() + 0.02
            ? L('Najprv odsuň kotúč od obrobku.', 'Retract the wheel from the work first.')
            : null,
      prepare: () => {
        refreshWork();
        dirty = false;
      },
    });

    apiRef.current.newBlank = () => {
      if (c.unclamped) {
        say(L('Najprv vráť obrobok do stroja.', 'Return the workpiece to the machine first.'));
        return false;
      }
      if (st.work > 0.05 || c.trav) {
        say(
          L(
            'Obrobok sa mení pri stojacom obrobku a stole.',
            'The work is changed with the work and the table stopped.',
          ),
        );
        return false;
      }
      const D = clamp(c.bD, 15, 60);
      push('dT', Math.round((D + 1) * 1000) / 1000);
      st.d = D + 1;
      makeShaft(D, clamp(c.bL, 100, 300));
      st.xt = clamp(st.xt, wL / 2 - uMax() / 100, wL / 2 - uMin() / 100);
      say(
        L(`Medzi hrotmi je nový hriadeľ Ø${D} × ${c.bL} mm.`, `A new shaft Ø${D} × ${c.bL} mm is between centres.`),
        'info',
      );
      return true;
    };

    // ---------- ovládanie ----------
    const needPower = (fn) => () => {
      if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'));
      else fn();
    };
    ctrl.reg(
      {
        type: 'lever',
        angles: [0, -Math.PI / 2],
        minR: 0.2,
        label: LL('Hlavný vypínač', 'Main switch'),
        hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
        getIdx: () => (c.power ? 1 : 0),
        onSet: (i) => {
          push('power', i === 1);
          if (!i) {
            push('wheel', false);
            push('work', false);
            push('trav', false);
          }
        },
        read: () => (c.power ? 'I' : '0'),
      },
      mainSw,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Kotúč ŠTART', 'Wheel START'),
        hint: LL('Rozbehne brúsny kotúč.', 'Starts the grinding wheel.'),
        action: needPower(() => push('wheel', true)),
      },
      bWOn,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Kotúč STOP', 'Wheel STOP'),
        hint: LL('Zastaví kotúč.', 'Stops the wheel.'),
        action: () => push('wheel', false),
      },
      bWOff,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Obrobok ŠTART', 'Work START'),
        hint: LL('Roztočí obrobok (pracovný vreteník).', 'Starts the work rotation (work headstock).'),
        action: needPower(() => push('work', true)),
      },
      bKOn,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Obrobok STOP', 'Work STOP'),
        hint: LL('Zastaví otáčanie obrobku.', 'Stops the work rotation.'),
        action: () => push('work', false),
      },
      bKOff,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Chladenie', 'Coolant'),
        hint: LL('Zapne alebo vypne čerpadlo emulzie.', 'Switches the coolant pump on or off.'),
        action: () => push('cool', !c.cool),
      },
      bCool,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Núdzový STOP', 'Emergency STOP'),
        hint: LL('Zastaví kotúč, obrobok aj stôl.', 'Stops the wheel, the work and the table.'),
        action: () => {
          push('wheel', false);
          push('work', false);
          push('trav', false);
          say(L('Núdzové zastavenie.', 'Emergency stop.'), 'danger');
        },
      },
      eStop,
    );
    ctrl.reg(
      {
        type: 'lever',
        angles: [0.5, -0.5],
        minR: 0.2,
        label: LL('Páka hydrauliky stola', 'Table hydraulics lever'),
        hint: LL('Dole = stôl sa posúva tam a späť medzi dorazmi.', 'Down = the table reciprocates between the dogs.'),
        getIdx: () => (c.trav ? 1 : 0),
        onSet: (i) => {
          if (i && !c.power) {
            say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'));
            return;
          }
          push('trav', i === 1);
        },
        read: () => (c.trav ? `${c.tv} m/min` : L('stojí', 'stopped')),
      },
      levTrav,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.45,
        inc: 1,
        label: LL('Koleso prísuvu kotúča', 'Wheel infeed handwheel'),
        hint: LL(
          'V smere hodinových ručičiek ide kotúč k obrobku. 1 otáčka = 0,5 mm na priemere, dielik 0,005 mm.',
          'Clockwise feeds the wheel to the work. 1 turn = 0.5 mm on diameter, one division 0.005 mm.',
        ),
        turn: (d) => push('dT', clamp(Math.round((c.dT - (d * 0.5) / TAU) * 1000) / 1000, 10, 70)),
        read: () => `Ø ${st.d.toFixed(3)} mm`,
      },
      wFeed,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.35,
        inc: -1,
        label: LL('Ručné koleso stola', 'Table handwheel'),
        hint: LL(
          'Ručný posun stola (pri vypnutej hydraulike). 1 otáčka = 10 mm.',
          'Manual table movement (with the hydraulics off). 1 turn = 10 mm.',
        ),
        guard: () => {
          if (!c.trav) return true;
          say(L('Pri zapnutej hydraulike sa ručné koleso netočí.', 'With the hydraulics on the handwheel is locked.'));
          return false;
        },
        turn: (d) => push('u', clamp(Math.round(c.u + (d * 10) / TAU), Math.ceil(uMin()), Math.floor(uMax()))),
        read: () => `u ${uNow().toFixed(1)} mm`,
      },
      wTable,
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
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf,
      lastRef = 0;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      t += dt;
      wi.update(dt);
      if (c.unclamped) {
        tail.position.x = wL / 2 + 0.33 + wi.open() * 0.35;
        ctrl.update(dt);
        insp.update(t, c);
        renderer.render(scene, camera);
        return;
      }

      const ts = c.timeScale,
        dts = dt * ts;
      if (!c.power && (c.wheel || c.work || c.trav)) {
        push('wheel', false);
        push('work', false);
        push('trav', false);
      }
      st.wheel = approach(st.wheel, c.wheel && c.power ? 1 : 0, (c.wheel ? 0.35 : 0.25) * dt);
      st.work = approach(st.work, c.work && c.power ? 1 : 0, 2 * dt);
      const wheelOn = st.wheel > 0.95,
        workOn = st.work > 0.9;
      // prísuv kotúča: rýchlo voľne, pomaly v styku; pri stojacom kotúči alebo obrobku sa do materiálu nezarezáva
      const under = maxUnder(),
        dGoal = clamp(c.dT, 10, 70);
      let dN = approach(st.d, dGoal, (st.d - 0.05 > under ? 2.0 : 0.02) * dts);
      if (dN < st.d && dN < under && !(wheelOn && workOn)) {
        dN = Math.max(dN, Math.min(st.d, under));
        sayOnce(
          'touch',
          true,
          L(
            'Kotúč sa dotkol obrobku – brúsi sa len pri točiacom sa kotúči aj obrobku.',
            'The wheel touched the work – grinding needs both the wheel and the work turning.',
          ),
          'warn',
        );
      } else flags.touch = false;
      wFeed.rotation.z -= ((dN - st.d) / 0.5) * TAU * -1;
      st.d = dN;
      // stôl: hydraulický pohyb medzi dorazmi, prísuv na obrate
      const v = (c.tv * 1000) / 60 / 100; // jednotky scény za s
      if (c.trav && c.power) {
        const uL = clamp(c.dogL, uMin(), uMax()),
          uR = clamp(Math.max(c.dogR, c.dogL + 5), uMin(), uMax());
        let u = uNow() + st.dir * v * 100 * dts;
        if (u >= uR || u <= uL) {
          st.dir = u >= uR ? -1 : 1;
          u = clamp(u, uL, uR);
          if (c.autoIn && c.dT > c.dStop + 1e-9) {
            const nd = Math.max(c.dStop, Math.round((c.dT - c.inStep) * 1000) / 1000);
            c.dT = nd;
            pend.dT = nd;
          }
          revLever.rotation.z = st.dir * 0.35;
        }
        if (c.dogR > uMax() + 0.5 || c.dogL < uMin() - 0.5)
          sayOnce(
            'dog',
            true,
            L(
              'Doraz je za koncom obrobku – kotúč by narazil do hrotu alebo unášača. Stôl sa obracia na krajnej polohe.',
              'A dog is beyond the end of the work – the wheel would hit the centre or the dog. The table reverses at the end position.',
            ),
            'warn',
          );
        st.xt = wL / 2 - u / 100;
        c.u = Math.round(u);
        pend.u = c.u;
      } else {
        const uT = clamp(c.u, uMin(), uMax()),
          u = approach(uNow(), uT, v * 100 * 2 * dt);
        wTable.rotation.z -= ((wL / 2 - u / 100 - st.xt) / 0.1) * TAU;
        st.xt = wL / 2 - u / 100;
      }
      // brúsenie
      let sp = false;
      if (wheelOn && workOn) {
        const u = uNow(),
          burnD = c.cool ? 0.06 : 0.03;
        const r = grindPass(shaft, u - WHEEL.B / 2, u + WHEEL.B / 2, st.d, dts, { burnDepth: burnD });
        if (r.removed > 1e-7) {
          dirty = true;
          sp = true;
          st.sparkT = t;
          sparkAcc += dt * Math.min(120, 30 + r.depth * 4000);
          while (sparkAcc >= 1) {
            sparkAcc -= 1;
            sparks.spawn(
              v3((Math.random() - 0.5) * BW, AX - 0.15 + Math.random() * 0.1, ZA - shaft.d0 / 200 - 0.02),
              v3((Math.random() - 0.5) * 1.2, -1.5 - Math.random() * 2.5, 1.2 + Math.random() * 2.2),
              0.4 + Math.random() * 0.4,
              6,
              0,
            );
          }
          sayOnce(
            'burn',
            r.depth > burnD,
            L(
              `Príliš veľký záber (${(r.depth * 1000).toFixed(0)} µm) – povrch sa prepaľuje. Zmenši prísuv na obrat${c.cool ? '' : ' a zapni chladenie'}.`,
              `Infeed too large (${(r.depth * 1000).toFixed(0)} µm) – the surface is burning. Reduce the infeed per reversal${c.cool ? '' : ' and switch on the coolant'}.`,
            ),
            'danger',
          );
          const vw = (Math.PI * shaft.d0 * c.nw) / 1000;
          sayOnce(
            'vw',
            vw < 6 || vw > 30,
            L(
              `Obvodová rýchlosť obrobku ${vw.toFixed(0)} m/min je mimo 10 – 20 m/min – horší povrch. Zmeň otáčky obrobku.`,
              `The work speed ${vw.toFixed(0)} m/min is outside 10 – 20 m/min – poorer finish. Change the work speed.`,
            ),
            'warn',
          );
        }
      }
      if (dirty && t - lastRef > 0.15) {
        refreshWork();
        dirty = false;
        lastRef = t;
      }
      // chladenie
      coolG.visible = true;
      if (c.cool && c.power && st.wheel > 0.2) {
        dropAcc += dt * 80;
        while (dropAcc >= 1) {
          dropAcc -= 1;
          drops.spawn(
            v3((Math.random() - 0.5) * BW, AX + 0.85, wheelZ(st.d) + RW * 0.78),
            v3((Math.random() - 0.5) * 0.3, -2.2, 1.0 + Math.random() * 0.6),
            0.8,
          );
        }
      }
      drops.update(dt, (q) => (q.y > 8.4 && q.z > 0 && q.z < 2 && Math.abs(q.x - st.xt) < 8 ? 8.5 : 8.0));
      sparks.update(dt, () => 8.5);
      // pohyb skupín
      tbl.position.x = st.xt;
      whz.position.z = wheelZ(st.d);
      st.spin += st.wheel * 6 * TAU * dt;
      wheel.rotation.x = -st.spin;
      st.wspin += st.work * (c.nw / 60) * TAU * dt * 0.5;
      drive.rotation.x = st.wspin;
      workG.rotation.x = st.wspin;
      tail.position.x = wL / 2 + 0.33;
      dogLm.position.x = clamp(c.dogL, uMin(), uMax()) / 100 - wL / 2;
      dogRm.position.x = clamp(c.dogR, uMin(), uMax()) / 100 - wL / 2;
      lampW.emissive.setHex(c.wheel && c.power ? 0x22dd55 : 0);
      lampK.emissive.setHex(c.work && c.power ? 0x22dd55 : 0);
      lamp.update(c.light);
      ctrl.update(dt);
      insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        setTele({
          d: st.d,
          u: uNow(),
          contact: st.d < maxUnder() - 1e-6,
          sparks: t - st.sparkT < 0.3,
          wheelOn,
          workOn,
          trav: c.trav,
          msg: st.msg && st.msg.until > t ? st.msg : null,
        });
        if (Object.keys(pend).length) {
          const q = { ...pend };
          Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((uu) => ({ ...uu, ...q }));
        }
      }
      snd.update({ motor: st.wheel * 0.8 + st.work * 0.1, cut: sp ? 0.9 : 0 });
      renderer.render(scene, camera);
    };
    try {
      if (/[?&]debug/.test(window.location.search)) window.__cyl = { st, c, shaft: () => shaft, root };
    } catch (err) {
      /* ignorované */
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      snd.dispose();
      ctrl.dispose();
      wi.dispose();
      insp.dispose();
      try {
        if (window.__cyl && window.__cyl.st === st) delete window.__cyl;
      } catch (err) {
        /* ignorované */
      }
      disposeStage();
    };
  }, []);

  const parts = cylParts();
  const m = apiRef.current.measure ? apiRef.current.measure() : null,
    info = m ? m.info : null;
  const f3 = (x) => L(x.toFixed(3).replace('.', ','), x.toFixed(3));
  const busy = tele.workOn || ui.trav;
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.sparks
        ? {
            kind: 'run',
            text: `${L('Brúsenie', 'Grinding')} – ${L('nastavený', 'set')} Ø${f3(tele.d)} mm, u ${Math.round(tele.u)} mm`,
          }
        : tele.wheelOn && tele.workOn
          ? {
              kind: 'run',
              text: L(
                'Kotúč aj obrobok sa točia. Prisuň kotúč po dielikoch, až kým nezaiskrí.',
                'The wheel and the work are turning. Feed the wheel in divisions until it sparks.',
              ),
            }
          : {
              kind: 'idle',
              text: L(
                'Rozbehni kotúč, roztoč obrobok, nastav dorazy stola a zapni hydrauliku.',
                'Start the wheel, turn the work, set the table dogs and switch on the hydraulics.',
              ),
            };
  const chips = [
    {
      color: tele.wheelOn ? '#3ee06c' : '#8b8f89',
      text: tele.wheelOn ? L('Kotúč 35 m/s', 'Wheel 35 m/s') : L('Kotúč stojí', 'Wheel stopped'),
    },
  ];
  if (tele.workOn) chips.push({ color: '#7fb6ff', text: `${ui.nw} ${L('ot/min', 'rpm')}` });
  if (ui.trav) chips.push({ color: '#7fb6ff', text: `${L('Stôl', 'Table')} ${ui.tv} m/min` });
  if (tele.sparks) chips.push({ color: '#ffb340', text: L('Iskrí', 'Sparking') });
  const setupTask = (task) => {
    if (busy) return;
    Object.entries(task.setup).forEach(([k, val]) => set(k, val));
    setTimeout(() => {
      if (apiRef.current.newBlank) apiRef.current.newBlank();
      set('dT', task.setup.dT);
      set('dStop', task.id === 'h6' ? 39.992 : 24.996);
    }, 500);
  };
  const vw = (Math.PI * ui.bD * ui.nw) / 1000;
  const mx = Math.min(ui.measX, ui.bL),
    md = apiRef.current.dAt ? apiRef.current.dAt(mx) : ui.bD;

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView
        mountRef={mountRef}
        layerRef={layerRef}
        tipRef={tipRef}
        ui={ui}
        set={set}
        parts={parts}
        selected={selected}
        selectPart={selectPart}
        chips={chips}
        onBack={onBack}
        apiRef={apiRef}
        canUnclamp
        workLabels={[L('Pozrieť obrobok', 'Inspect workpiece'), L('Upnúť späť', 'Clamp back')]}
        tips={[
          L(
            'Kotúč sa pri brúsení odtláča – po poslednom prísuve nechaj niekoľko prechodov vyiskriť, až kým iskry nezmiznú.',
            'The wheel deflects while grinding – after the last infeed let it spark out for several passes until the sparks stop.',
          ),
          L(
            'Prísuv na obrat nad 0,03 mm (bez chladenia nad 0,015 mm) prepáli povrch.',
            'An infeed above 0.03 mm per reversal (0.015 mm without coolant) burns the surface.',
          ),
          L(
            'Dorazy nastav tak, aby kotúč na koncoch prebiehal o tretinu šírky – inak zostanú konce hrubšie.',
            'Set the dogs so that the wheel overruns the ends by a third of its width – otherwise the ends stay oversize.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · brúska na guľato', 'Simulator · cylindrical grinder')}
            title={L('Hrotová brúska na guľato', 'Cylindrical grinder')}
            sub={L(
              'Predloha: univerzálna hrotová brúska TOS BUA – hydraulický stôl s dorazmi, brúsny vreteník s prísuvom po 0,005 mm, kotúč Ø400 × 40 mm.',
              'Modelled after the TOS BUA universal cylindrical grinder – hydraulic table with dogs, wheelhead with 0.005 mm infeed, Ø400 × 40 mm wheel.',
            )}
            rows={[
              [L('Prísuv Ø', 'Infeed Ø'), tele.d.toFixed(3)],
              [L('Kotúč u mm', 'Wheel u mm'), tele.u.toFixed(0)],
            ]}
            foot={[`${ui.nw} ${L('ot/min', 'rpm')} · vw ${vw.toFixed(0)} m/min`, `${ui.tv} m/min`]}
            status={statusMsg}
          />

          <TaskSection
            machine="gulato"
            tasks={CYL_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'wheel', items: CYL_SAFETY() }}
          />

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Pohony', 'Drives')}</h2>
            <button
              type="button"
              className={`btn-run ${ui.wheel ? 'stop' : 'start'}`}
              onClick={() => {
                if (!ui.power) set('power', true);
                set('wheel', !ui.wheel);
              }}
            >
              {ui.wheel ? L('■ Stop kotúča', '■ Stop wheel') : L('▶ Štart kotúča', '▶ Start wheel')}
            </button>
            <div className="mt-2" />
            <button
              type="button"
              className={`btn-run ${ui.work ? 'stop' : 'start'}`}
              onClick={() => {
                if (!ui.power) set('power', true);
                set('work', !ui.work);
              }}
            >
              {ui.work ? L('■ Stop obrobku', '■ Stop work') : L('▶ Otáčanie obrobku', '▶ Work rotation')}
            </button>
            <div className="mt-2">
              <Toggle
                on={ui.power}
                label={L('Hlavný vypínač', 'Main switch')}
                onClick={() => set('power', !ui.power)}
              />
              <Toggle on={ui.cool} label={L('Chladenie emulziou', 'Coolant')} onClick={() => set('cool', !ui.cool)} />
              <Toggle
                on={ui.light}
                label={L('Pracovné osvetlenie', 'Work light')}
                onClick={() => set('light', !ui.light)}
              />
            </div>
            <SegRow
              label={L('Otáčky obrobku', 'Work speed')}
              value={ui.nw}
              options={CYL_WORK_SPEEDS.map((n) => [n, String(n)])}
              onChange={(n) => set('nw', n)}
            />
            <p className="text-xs muted" style={{ color: vw < 10 || vw > 20 ? 'var(--warn)' : undefined }}>
              {L(
                `Obvodová rýchlosť obrobku ${vw.toFixed(0)} m/min (vhodné 10 – 20 m/min).`,
                `Work surface speed ${vw.toFixed(0)} m/min (recommended 10 – 20 m/min).`,
              )}
            </p>
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Prísuv kotúča', 'Wheel infeed')}</h2>
            <Slider
              id="cd"
              label={L('Nastavený priemer (stupnica prísuvu)', 'Set diameter (infeed dial)')}
              unit="mm"
              min={10}
              max={70}
              step={0.001}
              value={ui.dT}
              actual={tele.d}
              digits={3}
              onChange={(v) => set('dT', v)}
            />
            <div className="flex flex-wrap gap-2 mb-2">
              {[-0.02, -0.01, -0.005, 0.005, 0.05, 0.5].map((x) => (
                <button
                  key={x}
                  type="button"
                  className="btn"
                  onClick={() => set('dT', Math.round((ui.dT + x) * 1000) / 1000)}
                >
                  {x > 0 ? '+' : ''}
                  {f3(x)}
                </button>
              ))}
            </div>
            <Toggle
              on={ui.autoIn}
              label={L('Automatický prísuv na obrate stola', 'Automatic infeed at table reversal')}
              onClick={() => set('autoIn', !ui.autoIn)}
            />
            <SegRow
              label={L('Prísuv na obrat', 'Infeed per reversal')}
              value={ui.inStep}
              options={[
                [0.005, '0,005'],
                [0.01, '0,01'],
                [0.02, '0,02'],
                [0.04, '0,04'],
              ]}
              onChange={(v) => set('inStep', v)}
            />
            <Slider
              id="cs"
              label={L('Doraz prísuvu (konečný priemer)', 'Infeed stop (final diameter)')}
              unit="mm"
              min={10}
              max={70}
              step={0.001}
              value={ui.dStop}
              digits={3}
              onChange={(v) => set('dStop', v)}
            />
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Stôl', 'Table')}</h2>
            <Toggle
              on={ui.trav}
              label={L('Hydraulický pohyb stola', 'Hydraulic table traverse')}
              onClick={() => {
                if (!ui.power) set('power', true);
                set('trav', !ui.trav);
              }}
            />
            <SegRow
              label={L('Rýchlosť stola m/min', 'Table speed m/min')}
              value={ui.tv}
              options={CYL_TRAVERSE.map((x) => [x, String(x).replace('.', ',')])}
              onChange={(v) => set('tv', v)}
            />
            <Slider
              id="cl"
              label={L('Ľavý doraz (stred kotúča od ľavého konca)', 'Left dog (wheel centre from the left end)')}
              unit="mm"
              min={-15}
              max={ui.bL}
              step={1}
              value={ui.dogL}
              onChange={(v) => set('dogL', v)}
            />
            <Slider
              id="cr"
              label={L('Pravý doraz', 'Right dog')}
              unit="mm"
              min={0}
              max={ui.bL + 15}
              step={1}
              value={ui.dogR}
              onChange={(v) => set('dogR', v)}
            />
            <Slider
              id="cu"
              label={L('Poloha kotúča na hriadeli (ručne)', 'Wheel position on the shaft (manual)')}
              unit="mm"
              min={-13}
              max={ui.bL + 13}
              step={1}
              value={ui.u}
              actual={tele.u}
              onChange={(v) => set('u', v)}
              disabled={ui.trav}
            />
            <SegRow
              label={L('Zrýchlenie', 'Acceleration')}
              value={ui.timeScale}
              options={[
                [1, '1×'],
                [5, '5×'],
                [20, '20×'],
              ]}
              shortcut="speed"
              onChange={(v) => set('timeScale', v)}
            />
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Meranie mikrometrom', 'Micrometer')}</h2>
            <Slider
              id="cm"
              label={L('Miesto merania od ľavého konca', 'Measuring position from the left end')}
              unit="mm"
              min={0}
              max={ui.bL}
              step={1}
              value={mx}
              onChange={(v) => set('measX', v)}
            />
            <div className="dro tnum" style={{ padding: '8px 12px' }}>
              <div className="dro-row">
                <span>Ø (0,001)</span>
                <b style={{ fontSize: 22 }}>{md.toFixed(3)}</b>
              </div>
            </div>
            {info && info.len > 0 && (
              <div className="text-sm tnum mt-2" style={{ lineHeight: 1.6 }}>
                <div>
                  {L('Obrúsené', 'Ground')}:{' '}
                  <b>
                    {Math.round(info.x0)} – {Math.round(info.x1)} mm
                  </b>
                  {info.gaps ? L(` (${info.gaps} neobrúsených miest)`, ` (${info.gaps} unground spots)`) : ''}
                </div>
                <div>
                  Ø{' '}
                  <b>
                    {f3(info.dMin)} – {f3(info.dMax)}
                  </b>
                  , {L('kužeľovitosť', 'taper')} <b>{f3(info.taper)} mm</b>
                </div>
                {info.burn > 0 && (
                  <div style={{ color: 'var(--danger)' }}>{L('Prepálený povrch', 'Burnt surface')}</div>
                )}
              </div>
            )}
          </div>

          <BlankSection
            onApply={() => apiRef.current.newBlank && apiRef.current.newBlank()}
            applyLabel={L('Upnúť nový hriadeľ', 'Mount a new shaft')}
            note={L(
              'Kalený hriadeľ s prídavkom na brúsenie, medzi hrotmi s unášačom.',
              'A hardened shaft with grinding allowance, between centres with a dog.',
            )}
          >
            <Slider
              id="cbd"
              label={L('Priemer', 'Diameter')}
              unit="mm"
              min={15}
              max={60}
              step={0.1}
              value={ui.bD}
              digits={1}
              onChange={(v) => set('bD', v)}
            />
            <Slider
              id="cbl"
              label={L('Dĺžka', 'Length')}
              unit="mm"
              min={100}
              max={300}
              step={10}
              value={ui.bL}
              onChange={(v) => set('bL', v)}
            />
          </BlankSection>

          <ExportSection machine="gulato" apiRef={apiRef} canStl={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail brúsenia', 'Grinding detail')],
              ['zhora', L('Zhora', 'Top')],
              ['panel', L('Ovládanie', 'Controls')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

export { CylGrinderSimulator };
export default CylGrinderSimulator;
