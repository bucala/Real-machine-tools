import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { createHeightField } from '../core/heightField';
import { L, LL, RPM } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createDrops, createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { BlankSection, HelpFooter, PanelHeader, PartsSection, SceneView, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// ROVINNÁ BRÚSKA BPH 300
// =====================================================================
const GRIND = { R: 1.5, HW: 0.2, WZc: 0.25, CT: 8.0, Y0: -0.8 };   // kotúč Ø300 × 40, os kotúča, výška magnetickej dosky
const grindParts = () => mkParts([
  ['lozko', 'Lôžko', 'Bed', 'Lôžko', 'Bed', 'Skriňové lôžko s hydraulickým agregátom a nádržou chladiva. Vpredu sú ručné kolesá stola a priečneho posuvu a elektrický panel.', 'Box bed with the hydraulic unit and the coolant tank. At the front are the table and cross-feed handwheels and the electrical panel.'],
  ['stojan', 'Stojan', 'Column', 'Stojan', 'Column', 'Stojan vzadu nesie brúsny vreteník a pracovnú lampu. Veľké koleso hore zvisle prisúva kotúč – 1 otáčka = 1 mm, dielik stupnice 0,01 mm.', 'The column at the back carries the wheel head and the work lamp. The large handwheel on top feeds the wheel down – 1 turn = 1 mm, one division 0.01 mm.'],
  ['vretennik', 'Brúsny kotúč', 'Grinding wheel', 'Brúsny vreteník a kotúč', 'Wheel head and grinding wheel', 'Kotúč Ø300 × 40 mm sa točí 2 800 ot/min (obvodová rýchlosť ~44 m/s). Kryt zachytáva úlomky, hadica s dýzou privádza emulziu do miesta brúsenia.', 'The Ø300 × 40 mm wheel turns at 2,800 rpm (~44 m/s surface speed). The guard catches fragments; the hose and nozzle bring emulsion to the grinding zone.'],
  ['sane', 'Sane', 'Saddle', 'Priečne sane', 'Cross saddle', 'Nesú stôl a posúvajú ho k stojanu a od neho (os Y) – ručne kolesom alebo automaticky o krok na konci každého zdvihu stola.', 'Carries the table and moves it towards and away from the column (Y axis) – by handwheel or automatically by one step at the end of each table stroke.'],
  ['stol', 'Stôl', 'Table', 'Stôl s hydraulickým pohonom', 'Hydraulically driven table', 'Stôl sa hydraulicky pohybuje tam a späť (os X). Červené narážky vpredu prestavujú smer na konci zdvihu. Konce sú kryté zásterkami.', 'The table reciprocates hydraulically (X axis). The red dogs at the front reverse it at the end of the stroke. The ends are covered by splash guards.'],
  ['magnet', 'Magnetická doska', 'Magnetic chuck', 'Elektromagnetická upínacia doska', 'Electromagnetic chuck', 'Doska 500 × 150 mm drží oceľový obrobok magneticky. Bez zapnutého magnetu sa nesmie brúsiť – kotúč by obrobok vymrštil.', 'The 500 × 150 mm chuck holds the steel workpiece magnetically. Never grind with the magnet off – the wheel would throw the workpiece.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Obrobok', 'Workpiece', 'Oceľový hranol zvoleného rozmeru. Pri brúsení sa odoberajú stotiny milimetra – obrúsená plocha je lesklá, DRO ukazuje úbytok.', 'Steel block of the selected size. Grinding removes hundredths of a millimetre – the ground surface is bright and the DRO shows the stock removed.'],
  ['panel', 'Elektrický panel', 'Control panel', 'Elektrický panel', 'Electrical panel', 'Hlavný vypínač, hydraulika, kotúč, magnet a chladenie (štart / stop) a núdzový STOP.', 'Main switch, hydraulics, wheel, magnet and coolant (start / stop) and the emergency stop.'],
]);

function GrinderSimulator({ onBack }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { power: true, hydro: false, wheel: false, magnet: true, coolant: false, light: true, manual: false, x: 300, y: 105, z: 60, autoX: false, autoY: false, speed: 8, xL: 150, xR: 450, step: 2, yA: 75, yB: 135,
    bL: 200, bW: 100, bH: 40 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ x: 300, y: 105, z: 60, wrpm: 0, removed: 0, msg: null, grinding: false });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { R, HW, WZc, CT, Y0 } = GRIND;
    const { renderer, scene, camera, dispose: disposeStage } = createStage(mount);
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x8fbf78, 0x76a662, 0x557a47),
      guard: std(0x8fbf78, 0.6, 0.05, { side: THREE.DoubleSide }), wheelM: std(0xd8d1c0, 0.95, 0), chuck: std(0x4a4f55, 0.5, 0.6), chuckLine: std(0xa0a8b0, 0.3, 0.85),
      work: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.8, flatShading: true, side: THREE.DoubleSide }),
      spark: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
      coolant: new THREE.MeshStandardMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0, emissive: 0x1a4a6a, emissiveIntensity: 0.5 }),
      mist: new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.55, depthWrite: false }),
      lampShade: std(0x76a662, 0.5, 0.2),
    };
    const kit = makeKit(M);
    const { add, box, cylY, cylZ, ball, lever, hitProxy, pivotLever, detents, handwheel, orient } = kit;
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- lôžko s ručnými kolesami ----------
    const bed = grp('lozko');
    box(bed, -3.3, 3.3, 0, 0.12, -1.9, 2.0, M.greenDark);
    box(bed, -3.2, 3.2, 0.12, 6.2, -1.8, 1.9, M.green);
    box(bed, -2.7, -0.6, 0.7, 4.2, 1.9, 1.94, M.greenDark);
    box(bed, -2.6, -2.2, 6.2, 6.25, -1.6, 1.6, M.ways); box(bed, 2.2, 2.6, 6.2, 6.25, -1.6, 1.6, M.ways);
    box(bed, -3.0, -0.1, 4.7, 6.1, 1.9, 2.55, M.green);                        // konzola kolies
    cylZ(bed, 0.14, 0.14, 2.55, 2.7, -2.3, 5.4, M.steel, 14); cylZ(bed, 0.12, 0.12, 2.55, 2.7, -1.05, 5.4, M.steel, 14);
    const wX = handwheel(bed, 0.55, -2.3, 5.4, 2.75, 'z', 0.4), wY = handwheel(bed, 0.47, -1.05, 5.4, 2.75, 'z', 0.35);
    cylZ(bed, 0.18, 0.15, 2.55, 2.66, -0.35, 5.4, M.black, 20); detents(bed, -0.35, 5.4, 2.66, 0.13, [0.45, -0.45], 0.02);
    cylZ(bed, 0.16, 0.13, 2.55, 2.65, -1.65, 5.95, M.black, 20); detents(bed, -1.65, 5.95, 2.65, 0.11, [0.45, -0.45], 0.018);
    const levAX = pivotLever(bed, -0.35, 5.4, 2.66, 0.38, 1.2), levAY = pivotLever(bed, -1.65, 5.95, 2.65, 0.32, 1.2);
    // elektrický panel
    const pan = grp('panel', bed);
    box(pan, 0.9, 2.3, 2.0, 4.8, 1.9, 1.98, M.panel);
    const pbtn = (x, y, m) => { const g = new THREE.Group(); g.position.set(x, y, 1.98); pan.add(g); cylZ(g, 0.1, 0.1, 0, 0.07, 0, 0, m, 20); hitProxy(g, 0.14, 0, 0, 0.05); return g; };
    const bHyOn = pbtn(1.15, 4.45, M.btnGreen), bHyOff = pbtn(1.45, 4.45, M.red), bMag = pbtn(1.85, 4.45, M.yellow);
    const bWOn = pbtn(1.15, 4.0, M.btnGreen), bWOff = pbtn(1.45, 4.0, M.red), bCool = pbtn(1.85, 4.0, M.blue);
    const lampW = std(0x1f5f33, 0.4, 0.1), lampM = std(0x5f4a10, 0.4, 0.1);
    ball(pan, 0.06, 2.12, 4.45, 1.99, lampM); ball(pan, 0.06, 2.12, 4.0, 1.99, lampW);
    box(pan, 1.3, 1.9, 2.95, 3.45, 1.98, 1.99, M.yellow);
    const eStop = new THREE.Group(); eStop.position.set(1.6, 3.2, 1.99); pan.add(eStop);
    cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16); cylZ(eStop, 0.19, 0.18, 0.07, 0.16, 0, 0, M.red, 24); hitProxy(eStop, 0.25, 0, 0, 0.1);
    box(pan, 1.3, 1.9, 2.2, 2.7, 1.98, 1.99, M.yellow);
    const mainSwitch = new THREE.Group(); mainSwitch.position.set(1.6, 2.45, 1.99); pan.add(mainSwitch);
    cylZ(mainSwitch, 0.17, 0.17, 0, 0.06, 0, 0, M.black, 24); box(mainSwitch, -0.22, 0.22, -0.045, 0.045, 0.06, 0.17, M.red);

    // ---------- stojan s kolesom zvislého prísuvu a lampou ----------
    const col = grp('stojan');
    box(col, -1.1, 1.1, 6.2, 14.8, -3.8, -1.9, M.green);
    box(col, -1.2, 1.2, 14.8, 15.0, -3.9, -1.8, M.greenDark);
    box(col, -0.95, -0.7, 6.6, 13.0, -1.9, -1.86, M.ways); box(col, 0.7, 0.95, 6.6, 13.0, -1.9, -1.86, M.ways);
    cylZ(col, 0.4, 0.4, -1.9, -1.78, 0, 13.6, M.black, 40);
    const wZ = handwheel(col, 0.72, 0, 13.6, -1.7, 'z', 0.45);
    box(col, 1.1, 1.35, 12.2, 12.55, -2.4, -2.05, M.greenDark);
    const lamp = createLamp(scene, col, kit, M, { base: v3(1.22, 12.65, -2.22), elbow: v3(2.35, 13.4, -1.0), head: v3(2.05, 11.9, 1.75), aim: v3(0, CT + 0.45, 0.3), angle: 0.45, power: 3.2 });

    // ---------- brúsny vreteník a kotúč ----------
    const head = grp('vretennik');
    box(head, -0.95, 0.95, -0.9, 1.1, -1.85, -0.3, M.green);
    box(head, -0.7, 0.7, 1.1, 1.65, -1.8, -0.6, M.greenDark);
    cylZ(head, 0.42, 0.42, -0.3, WZc - 0.26, 0, 0, M.green, 28);
    const spin = new THREE.Group(); spin.position.set(0, 0, WZc); head.add(spin);
    cylZ(spin, R, R, -HW, HW, 0, 0, M.wheelM, 56);
    cylZ(spin, 0.55, 0.55, -HW - 0.04, -HW, 0, 0, M.steel, 28); cylZ(spin, 0.55, 0.55, HW, HW + 0.04, 0, 0, M.steel, 28);
    box(spin, 0.3, 0.5, -0.05, 0.05, HW + 0.04, HW + 0.06, M.black);
    const gCyl = new THREE.CylinderGeometry(R + 0.12, R + 0.12, 0.56, 40, 1, true, Math.PI / 2 - 0.35, Math.PI + 0.7); gCyl.rotateX(Math.PI / 2);
    add(head, gCyl, M.guard, 0, 0, WZc);
    [WZc + 0.28, WZc - 0.28].forEach((z) => add(head, new THREE.CircleGeometry(R + 0.12, 40, -0.35, Math.PI + 0.7), M.guard, 0, 0, z));
    // hadica chladiva: od vreteníka ponad kryt a pred ním dole k dýze (mimo krytu kotúča)
    const hosePts = [v3(0.45, 1.65, -0.95), v3(0.8, 2.15, -0.45), v3(1.0, 2.1, 0.95), v3(1.55, 1.1, 0.95), v3(1.45, -0.25, 0.88), v3(1.0, -1.0, 0.76)];
    const hoseC = new THREE.CatmullRomCurve3(hosePts);
    add(head, new THREE.TubeGeometry(hoseC, 48, 0.045, 8, false), M.black);
    for (let k = 1; k < 10; k++) { const p = hoseC.getPoint(k / 10); ball(head, 0.06, p.x, p.y, p.z, M.black); }
    cylY(head, 0.05, 0.05, 2.15, 2.3, 0.8, -0.45, M.steelDark, 10);
    const nozzleA = v3(0.92, -1.08, 0.72), nozzleB = v3(0.3, -1.46, WZc + 0.05);
    const nz = add(head, new THREE.CylinderGeometry(0.035, 0.06, 0.22, 12), M.steel); orient(nz, v3(1.05, -0.96, 0.78), nozzleA);
    const stream = add(head, new THREE.CylinderGeometry(0.025, 0.045, 1, 10, 1, true), M.coolant); stream.castShadow = false; orient(stream, nozzleA, nozzleB);

    // ---------- sane, stôl, magnetická doska, obrobok ----------
    const sad = grp('sane'); sad.position.y = 6.2;
    box(sad, -2.6, 2.6, 0, 0.6, -1.0, 1.0, M.green);
    lever(sad, 0, 0.3, 1.0, 0.35, 1.1, 0);
    const tbl = grp('stol', sad); tbl.position.y = 0.6;
    box(tbl, -4.6, 4.6, 0, 0.6, -1.05, 1.05, M.green);
    box(tbl, -4.6, 4.6, 0.6, 0.8, -1.0, 1.0, M.greenDark);
    box(tbl, -4.6, 4.6, 0.6, 0.95, 1.0, 1.1, M.green); box(tbl, -4.6, 4.6, 0.6, 0.95, -1.1, -1.0, M.green);
    box(tbl, 4.35, 4.6, 0.8, 2.0, -1.05, 1.05, M.green); box(tbl, 4.35, 4.6, 2.0, 2.2, -1.05, 1.05, M.yellow);
    box(tbl, -4.6, -4.35, 0.8, 1.6, -1.05, 1.05, M.green); box(tbl, -4.6, -4.35, 1.6, 1.8, -1.05, 1.05, M.yellow);
    box(tbl, -4.5, 4.5, 0.15, 0.45, 1.05, 1.13, M.greenDark);
    const dogL = box(tbl, -0.1, 0.1, 0.1, 0.5, 1.13, 1.28, M.red), dogR = box(tbl, -0.1, 0.1, 0.1, 0.5, 1.13, 1.28, M.red);
    const mag = grp('magnet', tbl);
    box(mag, -2.5, 2.5, 0.8, 1.2, -0.75, 0.75, M.chuck);
    for (let x = -2.4; x <= 2.41; x += 0.2) box(mag, x - 0.02, x + 0.02, 1.2, 1.203, -0.72, 0.72, M.chuckLine);
    const wk = { WX: 2.0, WZ: 1.0, H: 0.4 };
    let hf = null;
    const makeWork = () => {
      if (hf) { tbl.remove(hf.mesh); hf.dispose(); }
      hf = createHeightField({ NX: 100, NZ: 50, W: wk.WX, D: wk.WZ, H: wk.H, raw: 0x5a5f65, cut: 0xe9edf0, mat: M.work });
      hf.mesh.position.y = 1.2; hf.mesh.userData.part = 'obrobok'; tbl.add(hf.mesh); G.obrobok = hf.mesh;
    };
    makeWork();
    const sparks = createParticles(scene, new THREE.BoxGeometry(0.014, 0.014, 0.07), M.spark, 160, false);
    const mist = createParticles(scene, new THREE.SphereGeometry(0.012, 5, 4), M.mist, 160, false);
    const drops = createDrops(scene);

    // ---------- stav simulácie ----------
    const st = { tx: (c.x - 300) / 100, sz: Y0 + c.y / 100, zb: c.z / 100, wr: 0, spin: 0, xdir: 1, ydir: 1, grindT: -9, msg: null, last: null };
    let t = 0, last = performance.now(), teleT = 0, dirty = false, lastBuild = 0, sparkAcc = 0, dropAcc = 0, mistAcc = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 2.6 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const rel = (tx, sz, zb) => [-tx, WZc - sz, zb];                       // spodok kotúča voči stredu obrobku a ploche dosky
    const pen = (rx, rz, wb) => { let m = 0; hf.eachRect(rx - 0.35, rx + 0.35, rz - HW, rz + HW, (k, x) => { const p = hf.hgt[k] - (wb + (x - rx) * (x - rx) / (2 * R)); if (p > m) m = p; }); return m; };
    const grind = (rx, rz, wb) => {
      let rem = 0;
      hf.eachRect(rx - 0.35, rx + 0.35, rz - HW, rz + HW, (k, x) => {
        const lim = Math.max(0, wb + (x - rx) * (x - rx) / (2 * R));
        if (hf.hgt[k] > lim + 1e-7) { rem += hf.hgt[k] - lim; hf.hgt[k] = lim; hf.mask[k] = 1; }
      });
      return rem;
    };
    const onChuck = (rx, rz, wb) => wb < 0 && Math.abs(rx) < 2.5 && Math.abs(rz) < 0.75 + HW;
    const wheelOn = () => st.wr > 500;

    // ---------- pohľady, popisy a výber dielov ----------
    const anchors = {
      lozko: () => v3(-2.9, 4.4, 1.95),
      stojan: () => v3(-1.1, 11.0, -2.0),
      vretennik: () => v3(-1.3, CT + st.zb + R + 1.0, WZc),
      sane: () => v3(2.6, 6.55, st.sz + 1.0),
      stol: () => v3(st.tx + 3.6, 7.65, st.sz + 1.1),
      magnet: () => v3(st.tx - 2.1, CT + 0.05, st.sz + 0.75),
      obrobok: () => v3(st.tx + 0.6, CT + wk.H + 0.05, st.sz),
      panel: () => v3(1.6, 4.95, 1.98),
    };
    const views = {
      celok: () => [[9.5, 13, 15.5], [0, 7.5, 0]],
      rez: () => [[3.4, CT + 2.4, st.sz + 4.2], [0, CT + 0.4, WZc], true],
      spredu: () => [[0, 8.5, 19], [0, 7.5, 0]],
      zhora: () => [[0.5, 23, 8], [0, 7, 0.4]],
      panel: () => [[2.5, 5.5, 7.5], [0.6, 4.6, 1.9], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);

    // ---------- polotovar ----------
    const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj: () => hf.mesh, getSpot: () => v3(3.0, 9.6, 4.6),
      onState: (v) => { push('unclamped', v); push('magnet', !v); } });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in') {
        if (c.wheel || st.wr > 1) { say(L('Obrobok sa snímá len pri stojacom kotúči.', 'The workpiece can only be removed with the wheel stopped.')); return; }
        if (c.autoX && c.hydro) { say(L('Najprv vypni hydraulický posuv stola.', 'Switch off the hydraulic table feed first.')); return; }
        if (st.zb < wk.H + 0.05) { say(L('Najprv zdvihni kotúč nad obrobok (os Z).', 'Raise the wheel above the workpiece first (Z axis).')); return; }
      }
      if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb polotovaru.', 'Wait until the workpiece movement finishes.'), 'info');
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) { say(L('Najprv upni polotovar späť.', 'Clamp the workpiece back first.')); return null; }
      if (c.wheel || st.wr > 1) { say(L('Polotovar sa mení len pri stojacom kotúči.', 'The workpiece can only be changed with the wheel stopped.')); return null; }
      wk.WX = c.bL / 100; wk.WZ = c.bW / 100; wk.H = c.bH / 100; makeWork(); dirty = false; st.last = null;
      say(L('Na magnetickej doske je nový polotovar.', 'A new workpiece is on the magnetic chuck.'), 'info');
      const [rx, rz, wb] = rel(st.tx, st.sz, st.zb);
      if (pen(rx, rz, wb) > 0) { st.zb = wk.H + 0.2; c.z = st.zb * 100; return { z: c.z }; }
      return {};
    };

    const xAct = () => st.tx * 100 + 300, yAct = () => (st.sz - Y0) * 100, zAct = () => st.zb * 100;
    ctrl.reg({ type: 'wheel', minR: 0.4, inc: 1, label: LL('Koleso stola (X)', 'Table handwheel (X)'), hint: LL('Ručný pohyb stola, keď je hydraulický posuv vypnutý. 1 otáčka = 10 mm.', 'Moves the table by hand when the hydraulic feed is off. 1 turn = 10 mm.'),
      guard: () => { if (!c.autoX) return true; say(L('Pri zapnutom hydraulickom posuve sa koleso stola netočí – vypni páku posuvu.', 'With the hydraulic feed on the table handwheel is locked – switch off the feed lever.'), 'warn'); return false; },
      turn: (d) => { const a = xAct(); push('x', clamp(clamp(c.x + d * 10 / TAU, a - 20, a + 20), 0, 600)); }, read: () => `X ${xAct().toFixed(1)} mm` }, wX);
    ctrl.reg({ type: 'wheel', minR: 0.35, inc: 1, label: LL('Koleso priečneho posuvu (Y)', 'Cross-feed handwheel (Y)'), hint: LL('1 otáčka = 5 mm.', '1 turn = 5 mm.'),
      turn: (d) => { const a = yAct(); push('y', clamp(clamp(c.y + d * 5 / TAU, a - 10, a + 10), 0, 240)); }, read: () => `Y ${yAct().toFixed(2)} mm` }, wY);
    ctrl.reg({ type: 'wheel', minR: 0.5, inc: 1, label: LL('Koleso zvislého prísuvu (Z)', 'Down-feed handwheel (Z)'), hint: LL('V smere hodinových ručičiek kotúč klesá. 1 otáčka = 1 mm, dielik 0,01 mm.', 'Clockwise lowers the wheel. 1 turn = 1 mm, one division 0.01 mm.'),
      turn: (d) => { const a = zAct(); push('z', clamp(clamp(c.z + d * 1 / TAU, a - 0.5, a + 0.5), 0, 200)); }, read: () => `Z ${zAct().toFixed(3)} mm` }, wZ);
    ctrl.reg({ type: 'lever', angles: [0.45, -0.45], minR: 0.2, label: LL('Páka hydraulického posuvu stola', 'Hydraulic table feed lever'), hint: LL('Zapne pohyb stola tam a späť medzi narážkami (potrebuje bežiacu hydrauliku).', 'Starts the table reciprocating between the dogs (needs the hydraulics running).'),
      getIdx: () => (c.autoX ? 1 : 0), onSet: (i) => { push('autoX', i === 1); if (i && !c.hydro) say(L('Posuv zaradený – stôl sa pohne po zapnutí hydrauliky.', 'Feed engaged – the table moves once the hydraulics are on.'), 'info'); }, read: () => (c.autoX ? L('zapnutý', 'on') : L('vypnutý', 'off')) }, levAX);
    ctrl.reg({ type: 'lever', angles: [0.45, -0.45], minR: 0.18, label: LL('Páka priečneho posuvu', 'Cross-feed lever'), hint: LL('Automatický priečny posuv o krok na konci každého zdvihu stola.', 'Automatic cross feed by one step at the end of each table stroke.'),
      getIdx: () => (c.autoY ? 1 : 0), onSet: (i) => push('autoY', i === 1), read: () => (c.autoY ? `${L('krok', 'step')} ${c.step} mm` : L('vypnutý', 'off')) }, levAY);
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('Otoč alebo klikni: 0 = vypnuté, I = zapnuté.', 'Turn or click: 0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0),
      onSet: (i) => { push('power', i === 1); if (!i) { push('wheel', false); push('hydro', false); say(L('Hlavný vypínač vypnutý.', 'Main switch off.'), 'warn'); } else say(L('Hlavný vypínač zapnutý.', 'Main switch on.'), 'info'); },
      read: () => (c.power ? L('I – zapnuté', 'I – on') : L('0 – vypnuté', '0 – off')) }, mainSwitch);
    const needPower = (fn) => () => { if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'), 'warn'); else fn(); };
    ctrl.reg({ type: 'button', label: LL('Hydraulika ŠTART', 'Hydraulics START'), hint: LL('Spustí hydraulický agregát pohonu stola.', 'Starts the hydraulic unit driving the table.'), action: needPower(() => push('hydro', true)) }, bHyOn);
    ctrl.reg({ type: 'button', label: LL('Hydraulika STOP', 'Hydraulics STOP'), hint: LL('Zastaví hydrauliku.', 'Stops the hydraulics.'), action: () => push('hydro', false) }, bHyOff);
    ctrl.reg({ type: 'button', label: LL('Kotúč ŠTART', 'Wheel START'), hint: LL('Roztočí brúsny kotúč na 2 800 ot/min.', 'Runs the grinding wheel up to 2,800 rpm.'), action: needPower(() => push('wheel', true)) }, bWOn);
    ctrl.reg({ type: 'button', label: LL('Kotúč STOP', 'Wheel STOP'), hint: LL('Zastaví brúsny kotúč.', 'Stops the grinding wheel.'), action: () => push('wheel', false) }, bWOff);
    ctrl.reg({ type: 'button', label: LL('Magnetická doska', 'Magnetic chuck'), hint: LL('Zapne / vypne magnet. Pri vypnutom sa nesmie brúsiť.', 'Switches the magnet on / off. Never grind with it off.'),
      action: () => { if (c.unclamped) return; push('magnet', !c.magnet); say(c.magnet ? L('Magnet zapnutý – obrobok je upnutý.', 'Magnet on – the workpiece is held.') : L('Magnet vypnutý – obrobok je voľný.', 'Magnet off – the workpiece is free.'), c.magnet ? 'info' : 'warn'); } }, bMag);
    ctrl.reg({ type: 'button', label: LL('Chladenie', 'Coolant'), hint: LL('Zapne / vypne prívod emulzie.', 'Switches the emulsion supply on / off.'), action: () => { push('coolant', !c.coolant); } }, bCool);
    ctrl.reg({ type: 'button', label: LL('Núdzový STOP', 'Emergency STOP'), hint: LL('Zastaví kotúč, hydrauliku aj posuvy.', 'Stops the wheel, the hydraulics and the feeds.'),
      action: () => { push('wheel', false); push('hydro', false); push('autoX', false); push('coolant', false); say(L('Núdzové zastavenie – kotúč, hydraulika aj posuvy sú vypnuté.', 'Emergency stop – wheel, hydraulics and feeds are off.'), 'danger'); } }, eStop);
    ctrl.reg({ type: 'button', still: true, label: LL('Pracovná lampa', 'Work lamp'), hint: LL('Klik zapne alebo vypne lampu.', 'Click to switch the lamp on or off.'), action: () => push('light', !c.light) }, lamp.shade);

    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      if (c.unclamped && c.magnet) push('magnet', false);
      st.wr = approach(st.wr, c.wheel && c.power ? 2800 : 0, 1100 * dt);
      st.spin += (st.wr > 0 ? 6 * st.wr / (st.wr + 600) : 0) * TAU * dt; spin.rotation.z = -st.spin;
      wi.update(dt);

      // hydraulický pohyb stola a priečny posuv na konci zdvihu
      const xl = Math.min(c.xL, c.xR), xr = Math.max(c.xL, c.xR);
      if (c.autoX && c.hydro && c.power) {
        const a = xAct();
        c.x = clamp(clamp(c.x + st.xdir * c.speed / 6 * 100 * dt, a - 15, a + 15), xl, xr);
        if ((st.xdir > 0 && a >= xr - 0.5) || (st.xdir < 0 && a <= xl + 0.5)) {
          st.xdir = -st.xdir;
          if (c.autoY) {
            const ya = Math.min(c.yA, c.yB), yb = Math.max(c.yA, c.yB);
            let ny = c.y + st.ydir * c.step;
            if (ny > yb || ny < ya) { st.ydir = -st.ydir; ny = clamp(ny, ya, yb); }
            push('y', ny);
          }
        }
      }

      // pohyb s kontrolou dotyku kotúča
      const vx = c.autoX && c.hydro ? c.speed / 6 * 1.3 : 2.0;
      let nx = approach(st.tx, (clamp(c.x, 0, 600) - 300) / 100, vx * dt), ny = approach(st.sz, Y0 + clamp(c.y, 0, 240) / 100, 1.0 * dt), nz = approach(st.zb, clamp(c.z, 0, 200) / 100, 0.5 * dt);
      let blocked = null;
      if (nx !== st.tx || ny !== st.sz || nz !== st.zb) {
        const [rx0, rz0, wb0] = rel(st.tx, st.sz, st.zb), p0 = c.unclamped ? 0 : pen(rx0, rz0, wb0);
        let why = null;
        const ok = (a, b, z) => {
          const [rx, rz, wb] = rel(a, b, z);
          if (onChuck(rx, rz, wb)) { why = 'chuck'; return false; }
          if (c.unclamped) return true;
          const p = pen(rx, rz, wb);
          if (p <= p0 + 1e-7 || p < 2e-6) return true;
          if (!wheelOn()) { why = 'stopped'; return false; }
          if (!c.magnet) { why = 'magnet'; return false; }
          if (p > 0.0012) { why = 'deep'; return false; }
          return true;
        };
        if (!ok(nx, ny, nz)) {
          blocked = why;
          let ax = st.tx, ay = st.sz, az = st.zb;
          if (ok(nx, ay, az)) ax = nx;
          if (ok(ax, ny, az)) ay = ny;
          if (ok(ax, ay, nz)) az = nz;
          nx = ax; ny = ay; nz = az;
        }
      }
      sayOnce('stopped', blocked === 'stopped', L('Kotúč stojí – pri dotyku by poškodil obrobok. Spusti brúsny kotúč.', 'The wheel is stopped – touching would damage the workpiece. Start the grinding wheel.'), 'danger');
      sayOnce('magnet', blocked === 'magnet', L('Magnetická doska je vypnutá – obrobok nie je upnutý a kotúč by ho vymrštil!', 'The magnetic chuck is off – the workpiece is not held and the wheel would throw it!'), 'danger');
      sayOnce('deep', blocked === 'deep', L('Príliš veľký prísuv – brúsi sa po 0,01 – 0,05 mm, najviac 0,1 mm na prechod.', 'Infeed too large – grind 0.01 – 0.05 mm at a time, at most 0.1 mm per pass.'), 'warn');
      sayOnce('chuck', blocked === 'chuck', L('Kotúč by zabrúsil do magnetickej dosky.', 'The wheel would grind into the magnetic chuck.'), 'warn');
      wX.rotation.z += (nx - st.tx) / 0.1 * TAU; wY.rotation.z += (ny - st.sz) / 0.05 * TAU; wZ.rotation.z += (nz - st.zb) / 0.01 * TAU;
      st.tx = nx; st.sz = ny; st.zb = nz;

      // brúsenie po dráhe od minulej snímky
      const cur = rel(st.tx, st.sz, st.zb), prev = st.last || cur; st.last = cur;
      if (wheelOn() && c.magnet && !c.unclamped) {
        const n = Math.min(80, Math.max(1, Math.ceil(Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) / 0.03)));
        let rem = 0;
        for (let s = 1; s <= n; s++) { const f = s / n; rem += grind(prev[0] + (cur[0] - prev[0]) * f, prev[1] + (cur[1] - prev[1]) * f, prev[2] + (cur[2] - prev[2]) * f); }
        if (rem > 0) {
          st.grindT = t; dirty = true;
          sparkAcc += dt * (c.coolant ? 70 : 160);
          while (sparkAcc >= 1) {
            sparkAcc -= 1;
            sparks.spawn(v3(0.05, CT + st.zb + 0.01, WZc + (Math.random() - 0.5) * 0.4), v3(-(3 + Math.random() * 4) * (st.xdir > 0 || !c.autoX ? 1 : 0.8), 0.4 + Math.random() * 2, (Math.random() - 0.5) * 1.2), 0.3 + Math.random() * 0.35, 6, 0);
          }
        }
      }
      const grinding = t - st.grindT < 0.25;
      if (dirty && t - lastBuild > 0.08) { hf.rebuild(); dirty = false; lastBuild = t; }

      // pohyb skupín
      head.position.y = CT + st.zb + R; sad.position.z = st.sz; tbl.position.x = st.tx;
      dogL.position.x = -(xl - 300) / 100; dogR.position.x = -(xr - 300) / 100;

      // emulzia: prúd z dýzy, kvapky a jemná hmla strhávaná kotúčom
      stream.visible = c.coolant && c.power;
      if (stream.visible) {
        M.coolant.opacity = 0.45 + 0.12 * Math.sin(t * 40);
        head.updateMatrixWorld();
        const a = nozzleA.clone().applyMatrix4(head.matrixWorld), b = nozzleB.clone().applyMatrix4(head.matrixWorld), dir = b.clone().sub(a).normalize();
        dropAcc += dt * 80;
        while (dropAcc >= 1) { dropAcc -= 1; drops.spawn(a.clone().lerp(b, Math.random()), dir.clone().multiplyScalar(2.4).add(v3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)), 1.4); }
        if (wheelOn()) {
          mistAcc += dt * (grinding ? 150 : 60);
          while (mistAcc >= 1) {
            mistAcc -= 1; const sp = 2 + Math.random() * 3.5;
            mist.spawn(v3(-0.1 + Math.random() * 0.3, CT + st.zb + 0.02 + Math.random() * 0.05, WZc + (Math.random() - 0.5) * 0.4), v3(-sp, 0.3 + Math.random() * 1.6, (Math.random() - 0.5) * 1.4), 0.4 + Math.random() * 0.5, 5, 0);
          }
        }
      }
      const floorAt = (p) => {
        const lx = p.x - st.tx, lz = p.z - st.sz;
        if (Math.abs(lx) < wk.WX / 2 && Math.abs(lz) < wk.WZ / 2 && !c.unclamped) return CT + wk.H;
        if (Math.abs(lx) < 2.5 && Math.abs(lz) < 0.75) return CT;
        if (Math.abs(lx) < 4.6 && Math.abs(lz) < 1.05) return 7.6;
        return 0.02;
      };
      drops.update(dt, floorAt); mist.update(dt, floorAt);
      lampW.emissive.setHex(st.wr > 15 ? 0x22dd55 : 0); lampM.emissive.setHex(c.magnet ? 0xffb020 : 0);
      sparks.update(dt, () => -1);
      lamp.update(c.light);

      ctrl.update(dt);
      insp.update(t, c);

      if (t - teleT > 0.1) {
        teleT = t;
        let mn = wk.H; for (let k = 0; k < hf.hgt.length; k++) if (hf.hgt[k] < mn) mn = hf.hgt[k];
        setTele({ x: xAct(), y: yAct(), z: zAct(), wrpm: st.wr, removed: (wk.H - mn) * 100, grinding: grinding && wheelOn(), msg: st.msg && st.msg.until > t ? st.msg : null });
        if (c.autoX && c.hydro) pend.x = Math.round(c.x * 10) / 10;
        if (Object.keys(pend).length) {
          const p = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ctrl.dispose(); insp.dispose(); wi.dispose(); disposeStage(); };
  }, []);

  const parts = grindParts();
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped ? { kind: 'info', text: L('Obrobok je sňatý z magnetickej dosky.', 'The workpiece is taken off the magnetic chuck.') }
    : tele.grinding ? { kind: 'run', text: `${L('Brúsenie – odbrúsené', 'Grinding – removed')} ${tele.removed.toFixed(3)} mm, ${L('kotúč', 'wheel')} ${Math.round(tele.wrpm)} ${RPM()}` }
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
    : tele.wrpm > 15 ? { kind: 'run', text: L('Kotúč beží. Prisúvaj ho kolesom Z po stotinách a zapni hydraulický posuv stola.', 'The wheel is running. Feed it down in hundredths with the Z handwheel and start the hydraulic table feed.') }
    : { kind: 'idle', text: L('Stroj stojí. Zapni magnet, roztoč kotúč a spusti hydrauliku.', 'The machine is stopped. Switch on the magnet, start the wheel and the hydraulics.') };
  const chips = [{ color: tele.wrpm > 15 ? '#3ee06c' : '#8b8f89', text: tele.wrpm > 15 ? `${L('Kotúč', 'Wheel')} ${Math.round(tele.wrpm)} ${RPM()}` : L('Kotúč stojí', 'Wheel stopped') }];
  if (tele.grinding) chips.push({ color: '#ffb340', text: L('Brúsenie', 'Grinding') });
  chips.push({ color: ui.magnet ? '#ffcf4a' : '#8b8f89', text: ui.magnet ? L('Magnet zap.', 'Magnet on') : L('Magnet vyp.', 'Magnet off') });
  if (ui.hydro && ui.autoX) chips.push({ color: '#7fb6ff', text: `${L('Stôl', 'Table')} ${ui.speed} m/min` });
  if (ui.coolant && ui.power) chips.push({ color: '#8fd0ff', text: L('Emulzia', 'Emulsion') });

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} />
      <aside className="panel">
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · brúska', 'Simulator · grinder')} title={L('Rovinná brúska', 'Surface grinder')}
          sub={L('Predloha: BPH 300 s vodorovným vretenom a magnetickou doskou. Kotúč Ø300 × 40 mm.', 'Modelled after the BPH 300 with a horizontal spindle and a magnetic chuck. Wheel Ø300 × 40 mm.')}
          rows={[['X', tele.x.toFixed(2)], ['Y', tele.y.toFixed(2)], ['Z', tele.z.toFixed(3)]]}
          foot={[`${L('kotúč', 'wheel')} ${Math.round(tele.wrpm)} ${RPM()}`, `${L('úbytok', 'removed')} ${tele.removed.toFixed(3)} mm`]} status={statusMsg} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
          <button type="button" className={`btn-run ${ui.wheel ? 'stop' : 'start'}`}
            onClick={() => { if (!ui.wheel && !ui.power) set('power', true); set('wheel', !ui.wheel); }}>
            {ui.wheel ? L('■ Stop kotúča', '■ Stop wheel') : L('▶ Štart kotúča', '▶ Start wheel')}
          </button>
          <div className="mt-2">
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => { const v = !ui.power; set('power', v); if (!v) { set('wheel', false); set('hydro', false); } }} />
            <Toggle on={ui.hydro} label={L('Hydraulika', 'Hydraulics')} onClick={() => { if (!ui.hydro && !ui.power) set('power', true); set('hydro', !ui.hydro); }} />
            <Toggle on={ui.magnet} label={L('Magnetická doska', 'Magnetic chuck')} onClick={() => { if (!ui.unclamped) set('magnet', !ui.magnet); }} />
            <Toggle on={ui.coolant} label={L('Chladenie (emulzia)', 'Coolant (emulsion)')} onClick={() => set('coolant', !ui.coolant)} />
            <Toggle on={ui.light} label={L('Pracovné osvetlenie', 'Work light')} onClick={() => set('light', !ui.light)} />
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Polohy', 'Positions')}</h2>
          <Slider id="gx" label={L('Stôl X', 'Table X')} unit="mm" min={0} max={600} step={1} value={ui.x} actual={tele.x} onChange={(v) => set('x', v)} />
          <Slider id="gy" label={L('Sane Y', 'Saddle Y')} unit="mm" min={0} max={240} step={0.5} value={ui.y} actual={tele.y} digits={1} onChange={(v) => set('y', v)} />
          <Slider id="gz" label={L('Kotúč nad doskou Z', 'Wheel above chuck Z')} unit="mm" min={0} max={200} step={0.005} value={ui.z} actual={tele.z} digits={3} onChange={(v) => set('z', v)} />
          <div className="flex flex-wrap gap-2">
            {[-0.1, -0.02, -0.01, 0.01, 0.1, 1].map((d) => <button key={d} type="button" className="btn" onClick={() => set('z', Math.round((ui.z + d) * 1000) / 1000)}>{d > 0 ? '+' : ''}{L(String(d).replace('.', ','), String(d))}</button>)}
          </div>
          <p className="text-xs muted mt-2">{L(`Obrobok je vysoký ${ui.bH} mm. Prisúvaj po 0,01 – 0,05 mm; viac ako 0,1 mm na prechod stroj nedovolí.`, `The workpiece is ${ui.bH} mm high. Feed in 0.01 – 0.05 mm steps; the machine refuses more than 0.1 mm per pass.`)}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hydraulický posuv', 'Hydraulic feed')}</h2>
          <Toggle on={ui.autoX} label={L('Pohyb stola tam a späť', 'Table reciprocation')} onClick={() => set('autoX', !ui.autoX)} />
          <Slider id="gsp" label={L('Rýchlosť stola', 'Table speed')} unit="m/min" min={1} max={25} step={0.5} value={ui.speed} digits={1} onChange={(v) => set('speed', v)} />
          <Slider id="gxl" label={L('Ľavá narážka', 'Left dog')} unit="mm" min={0} max={600} step={1} value={ui.xL} onChange={(v) => set('xL', v)} />
          <Slider id="gxr" label={L('Pravá narážka', 'Right dog')} unit="mm" min={0} max={600} step={1} value={ui.xR} onChange={(v) => set('xR', v)} />
          <Toggle on={ui.autoY} label={L('Priečny posuv na konci zdvihu', 'Cross feed at stroke end')} onClick={() => set('autoY', !ui.autoY)} />
          <Slider id="gst" label={L('Krok priečneho posuvu', 'Cross-feed step')} unit="mm" min={0.5} max={10} step={0.5} value={ui.step} digits={1} onChange={(v) => set('step', v)} />
          <Slider id="gya" label={L('Priečny rozsah od', 'Cross range from')} unit="mm" min={0} max={240} step={1} value={ui.yA} onChange={(v) => set('yA', v)} />
          <Slider id="gyb" label={L('Priečny rozsah do', 'Cross range to')} unit="mm" min={0} max={240} step={1} value={ui.yB} onChange={(v) => set('yB', v)} />
        </div>

        <BlankSection onApply={() => { const r = apiRef.current.newBlank && apiRef.current.newBlank(); if (r) Object.entries(r).forEach(([k, v]) => set(k, v)); }}
          applyLabel={L('Položiť nový polotovar na dosku', 'Put a new workpiece on the chuck')}
          note={L('Oceľový hranol leží v strede magnetickej dosky 500 × 150 mm.', 'The steel block lies in the middle of the 500 × 150 mm magnetic chuck.')}>
          <Slider id="gbl" label={L('Dĺžka', 'Length')} unit="mm" min={100} max={300} step={10} value={ui.bL} onChange={(v) => set('bL', v)} />
          <Slider id="gbw" label={L('Šírka', 'Width')} unit="mm" min={40} max={140} step={5} value={ui.bW} onChange={(v) => set('bW', v)} />
          <Slider id="gbh" label={L('Výška', 'Height')} unit="mm" min={20} max={80} step={5} value={ui.bH} onChange={(v) => set('bH', v)} />
        </BlankSection>

        <ViewSection apiRef={apiRef}
          views={[['celok', L('Celok', 'Overview')], ['rez', L('Detail kotúča', 'Wheel detail')], ['spredu', L('Spredu', 'Front')], ['zhora', L('Zhora', 'Top')], ['panel', L('Panel', 'Panel')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

export { GrinderSimulator };
export default GrinderSimulator;
