import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL, RPM } from '../core/i18n';
import { createMachineWorkInspect } from '../core/machineWorkInspect';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection } from '../ui/tools';
import { GearDrawing } from '../ui/sketch';
import { HOB, HOB_FEEDS, HOB_Z, createGear, fullDepth, gearInfo, hobAngle, hobChecks, hobCut, indexGears, tipD } from './hobMath';
import { HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// ODVALOVACIA FRÉZKA NA OZUBENIE (predloha TOS Čelákovice)
// =====================================================================
// mierka 1 = 100 mm. Stôl s obrobkom (os C) v x = WX, stojan s frézovacou hlavou sa prisúva radiálne (X),
// hlava sa posúva zvisle (Y) a natáča o sklon frézy. Stôl sa otáča 1/z otáčky na otáčku jednochodej frézy.
const WX = 2.5, WY0 = 3.0, RH = HOB.d0 / 200, M2 = 2;
const hobParts = () => mkParts([
  ['lozko', 'Lôžko', 'Bed', 'Lôžko', 'Bed', 'Lôžko nesie stôl s obrobkom a vedenia stojana, ktorý sa prisúva k obrobku na hĺbku zuba.', 'The bed carries the work table and the ways of the column, which is fed to the work to the tooth depth.'],
  ['stojan', 'Stojan', 'Column', 'Stojan s frézovacou hlavou', 'Column with hob head', 'Hlava s frézou sa posúva po stojane zvisle (axiálny posuv cez šírku kolesa) a natáča sa o stúpací uhol frézy.', 'The hob head moves vertically on the column (axial feed across the face width) and swivels by the hob lead angle.'],
  ['freza', 'Odvalovacia fréza', 'Hob', 'Odvalovacia fréza', 'Hob', 'Jednochodá fréza Ø70 mm, modul 2. Jej zuby tvoria závitovku – pri odvalovaní so stolom vytvárajú evolventné boky zubov kolesa.', 'Single-start Ø70 mm hob, module 2. Its teeth form a worm – rolling with the table they generate the involute tooth flanks.'],
  ['stol', 'Stôl', 'Table', 'Otočný stôl (os C) s tŕňom', 'Rotary table (C axis) with arbor', 'Stôl poháňa deliaca závitovka cez výmenné kolesá delenia i = 24 / z. Obrobok je na tŕni, zhora ho podopiera rameno protistojana.', 'The table is driven by the index worm through the index change gears i = 24 / z. The blank sits on the arbor, supported from above by the outer support arm.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Polotovar kolesa', 'Gear blank', 'Oceľový polotovar s hlavovým priemerom da = m (z + 2), šírka 20 mm.', 'Steel blank with tip diameter da = m (z + 2), face width 20 mm.'],
  ['ovladanie', 'Ovládanie', 'Controls', 'Ovládací panel', 'Control panel', 'Hlavný vypínač, chod frézy a stola, automatický posuv.', 'Main switch, hob and table drive, automatic feed.'],
]);
const HOB_TASKS = [30, 24].map((z) => ({
  id: `z${z}`, title: () => L(`Čelné koleso z ${z}, m 2`, `Spur gear z ${z}, m 2`),
  desc: () => L(`Polotovar Ø${tipD(M2, z)} × 20 mm. Odvaluj priame čelné koleso m 2, z ${z}. Nastav výmenné kolesá delenia na z ${z}, sklon frézy na stúpací uhol (${hobAngle(M2).toFixed(2).replace('.', ',')}°), prisuň stojan na plnú hĺbku zuba 2,25 · m = 4,5 mm a zapni zvislý posuv cez celú šírku kolesa. Kontroluje sa rozmer cez zuby W${Math.max(2, Math.round(z / 9 + 0.5))} (±0,05 mm).`, `Blank Ø${tipD(M2, z)} × 20 mm. Hob a spur gear m 2, z ${z}. Set the index change gears to z ${z}, the hob swivel to the lead angle (${hobAngle(M2).toFixed(2)}°), feed the column to the full tooth depth 2.25 · m = 4.5 mm and switch on the vertical feed across the whole face width. The span over teeth W${Math.max(2, Math.round(z / 9 + 0.5))} is checked (±0.05 mm).`),
  setup: { zT: z, zSel: 20, ang: 0, d: 0, y: 60 },
  drawing: () => <GearDrawing z={z} da={tipD(M2, z)} />,
  labels: { z: () => L(`Počet zubov z ${z} (jedno delenie)`, `Number of teeth z ${z} (one index setting)`), wk: () => L('Rozmer cez zuby Wk ±0,05 mm', 'Span over teeth Wk ±0.05 mm'), face: () => L('Ozubenie po celej šírke', 'Teeth along the whole face width'), angle: () => L('Sklon frézy ±0,3° od stúpacieho uhla', 'Hob swivel within ±0.3° of the lead angle') },
  checks: (m) => hobChecks.gear(m).map((c) => ({ ...c, label: { z: () => L(`Počet zubov z ${z}`, `Teeth z ${z}`), wk: () => L('Rozmer cez zuby Wk ±0,05 mm', 'Span over teeth Wk ±0.05 mm'), face: () => L('Ozubenie po celej šírke', 'Teeth along the whole face width'), angle: () => L('Sklon frézy ±0,3°', 'Hob swivel ±0.3°') }[c.key]() })),
}));
const HOB_SAFETY = () => [
  L('Výmenné kolesá sú zakryté, kryt kolies je zatvorený.', 'The change gears are covered, the gear cover is closed.'),
  L('Polotovar je dotiahnutý na tŕni a podopretý ramenom protistojana.', 'The blank is tightened on the arbor and supported by the outer support arm.'),
  L('Fréza je upnutá a jej kryt je na mieste, ruky mám mimo záberu.', 'The hob is clamped and its guard is in place, my hands are clear of the cut.'),
];

function HobberSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { power: true, running: false, manual: false, light: true, nh: 160, zSel: 30, ang: 1.64, d: 0, y: 60, autoF: false, feed: 1, timeScale: 10, zT: 30 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, d: 0, y: 0, cutting: false, msg: null });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('mill');
    const dom = renderer.domElement;
    const M = { ...baseMats(0x7f8f9a, 0x6a7a86, 0x4c5964), gear: std(0xc9ced2, 0.32, 0.85), hob: std(0x8c7550, 0.35, 0.8), chip: std(0xa6adb4, 0.3, 0.85), lampShade: std(0x6a7a86, 0.5, 0.2) };
    M.gear.flatShading = true;
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, handwheel } = kit;
    const root = new THREE.Group(); scene.add(root);
    apiRef.current.machineModel = { root, name: 'Odvaľovacia frézka' };
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- lôžko, stôl, protistojan ----------
    const bed = grp('lozko');
    box(bed, -6.5, 6.0, 0, 1.2, -2.8, 2.8, M.greenDark);
    [-1, 1].forEach((s) => box(bed, -6.3, 0.5, 1.2, 1.28, s * 1.6 - 0.25, s * 1.6 + 0.25, M.ways));
    const wR = handwheel(bed, 0.45, -2.0, 0.65, 2.95, 'z', 0.28);                     // radiálny prísuv stojana
    const tbl = grp('stol');
    cylY(tbl, 1.6, 1.7, 1.2, 2.4, WX, 0, M.green, 48);
    const turn = new THREE.Group(); turn.position.set(WX, 2.4, 0); tbl.add(turn);
    cylY(turn, 1.4, 1.4, 0, 0.2, 0, 0, M.steelDark, 48);
    cylY(turn, 0.16, 0.16, 0.2, 4.6, 0, 0, M.steel, 20);                               // tŕň
    cylY(turn, 0.45, 0.45, 0.2, WY0 - 2.4, 0, 0, M.steel, 28);                         // podložka
    box(tbl, WX + 1.8, WX + 3.0, 1.2, 7.6, -0.6, 0.6, M.green);                        // protistojan
    box(tbl, WX - 0.4, WX + 3.0, 6.9, 7.3, -0.4, 0.4, M.green);                        // rameno
    cylY(tbl, 0.22, 0.12, 6.4, 6.9, WX, 0, M.steelDark, 16);
    // ---------- obrobok ----------
    const gearG = grp('obrobok', turn);
    let gear = null, gMesh = null, dirty = true;
    const ra = () => tipD(gear.m, gear.zT) / 2;
    const profile = (frac) => { const q = Math.abs(frac - 0.5); return q < 0.16 ? 0 : q > 0.36 ? 1 : (q - 0.16) / 0.2; };
    const buildGear = () => {
      if (gMesh) { gearG.remove(gMesh); gMesh.geometry.dispose(); }
      const NA = gear.zT * 14, NH = gear.NH, rows = NH + 1, pos = [], idx = [], H = gear.b / 100;
      const r0 = ra() / 100;
      for (let i = 0; i < rows; i++) {
        const cell = Math.min(NH - 1, i), z = gear.z[cell], d = gear.depth[cell];
        for (let j = 0; j < NA; j++) {
          const a = j / NA * TAU, rr = d > 0.01 && z ? r0 - d / 100 * profile(((a / TAU) * z) % 1) : r0;
          pos.push(Math.cos(a) * rr, i * H / NH, Math.sin(a) * rr);
        }
      }
      for (let i = 0; i < NH; i++) for (let j = 0; j < NA; j++) { const a = i * NA + j, b = i * NA + (j + 1) % NA; idx.push(a, a + NA, b, b, a + NA, b + NA); }
      const cB = pos.length / 3; pos.push(0, 0, 0); const cT = cB + 1; pos.push(0, H, 0);
      for (let j = 0; j < NA; j++) { idx.push(cB, j, (j + 1) % NA); idx.push(cT, NH * NA + (j + 1) % NA, NH * NA + j); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      gMesh = new THREE.Mesh(geo, M.gear); gMesh.castShadow = true; gMesh.userData.part = 'obrobok'; gMesh.position.y = WY0 - 2.4; gearG.add(gMesh); G.obrobok = gearG;
    };
    const makeGear = () => { gear = createGear(M2, c.zT, 20); buildGear(); };
    makeGear();
    // ---------- stojan s hlavou a frézou ----------
    const colG = grp('stojan');
    box(colG, -6.2, -3.6, 1.28, 10.2, -1.9, 1.9, M.green);
    box(colG, -3.6, -3.45, 1.6, 9.8, -1.5, -1.2, M.ways); box(colG, -3.6, -3.45, 1.6, 9.8, 1.2, 1.5, M.ways);
    box(colG, -6.3, -3.5, 10.2, 10.6, -2.0, 2.0, M.greenDark);
    const wY = handwheel(colG, 0.42, -4.9, 8.6, 2.05, 'z', 0.26);                         // zvislý posuv hlavy
    cylZ(colG, 0.09, 0.09, 1.9, 2.05, -4.9, 8.6, M.steel, 12);
    const pan = grp('ovladanie', colG);
    box(pan, -6.0, -4.4, 3.2, 5.4, 1.9, 1.98, M.panel);
    const pbtn = (x, y, m) => { const g = new THREE.Group(); g.position.set(x, y, 1.98); pan.add(g); cylZ(g, 0.12, 0.12, 0, 0.07, 0, 0, m, 20); hitProxy(g, 0.16, 0, 0, 0.05); return g; };
    const bStart = pbtn(-5.6, 4.8, M.btnGreen), bStop = pbtn(-5.2, 4.8, M.red), bFeed = pbtn(-4.8, 4.8, M.blue);
    const lampRun = std(0x1f5f33, 0.4, 0.1); ball(pan, 0.06, -5.6, 4.3, 2.0, lampRun);
    const mainSw = new THREE.Group(); mainSw.position.set(-5.0, 3.8, 1.99); pan.add(mainSw);
    cylZ(mainSw, 0.17, 0.17, 0, 0.06, 0, 0, M.black, 24); box(mainSw, -0.045, 0.045, -0.2, 0.2, 0.06, 0.16, M.red);
    const headG = new THREE.Group(); colG.add(headG);
    box(headG, -3.45, -1.6, -0.9, 0.9, -1.4, 1.4, M.green);
    cylX(headG, 1.0, 1.0, -1.7, -1.55, 0, 0, M.greenDark, 40);                           // otočná doska (sklon)
    const swG = new THREE.Group(); swG.position.x = -1.55; headG.add(swG);
    box(swG, 0, 0.35, -0.5, 0.5, -1.5, 1.5, M.green);
    const hobArm = new THREE.Group(); swG.add(hobArm);
    const hobG = grp('freza', hobArm);
    const hobSpin = new THREE.Group(); hobG.add(hobSpin);
    cylZ(hobSpin, 0.12, 0.12, -1.3, 1.3, 0, 0, M.steel, 16);
    cylZ(hobSpin, RH - 0.05, RH - 0.05, -0.45, 0.45, 0, 0, M.hob, 28);
    for (let k = 0; k < 9; k++) { const r = add(hobSpin, new THREE.TorusGeometry(RH - 0.03, 0.035, 6, 24), M.hob, 0, 0, -0.4 + k * 0.1); r.rotation.y = 0.06; }
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; box(hobSpin, Math.cos(a) * (RH - 0.06) - 0.02, Math.cos(a) * (RH - 0.06) + 0.02, Math.sin(a) * (RH - 0.06) - 0.02, Math.sin(a) * (RH - 0.06) + 0.02, -0.46, 0.46, M.black); }
    box(hobArm, -0.2, 0.2, -0.25, 0.25, -1.45, -1.3, M.green); box(hobArm, -0.2, 0.2, -0.25, 0.25, 1.3, 1.45, M.green);
    const chipsP = createParticles(scene, new THREE.BoxGeometry(0.03, 0.01, 0.05), M.chip, 160);
    const lamp = createLamp(scene, colG, kit, M, { base: v3(-4.0, 10.6, -1.6), elbow: v3(-2.4, 11.6, -1.4), head: v3(0.6, 8.6, -1.6), aim: v3(WX, WY0 + 0.1, 0), angle: 0.5, power: 2.4 });

    // ---------- stav ----------
    const st = { d: c.d, y: c.y, rpm: 0, hA: 0, cA: 0, cutT: -9, msg: null, zSel: c.zSel, ang: c.ang };
    let t = 0, last = performance.now(), teleT = 0, chipAcc = 0, lastB = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 3 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const hobX = (d = st.d) => WX - (ra() - d + HOB.d0 / 2) / 100;                    // stred frézy v svete x
    const band = (d = st.d) => (d > 0 ? Math.sqrt(Math.max(0, (HOB.d0 / 2) ** 2 - (HOB.d0 / 2 - d) ** 2)) : 0);
    const engaged = (d = st.d, y = st.y) => d > 0.005 && y - band(d) < gear.b && y + band(d) > 0;

    // ---------- pohľady ----------
    const anchors = {
      lozko: () => v3(5.5, 1.25, 2.8), stojan: () => v3(-4.9, 10.8, 1.9), freza: () => v3(hobX(), WY0 + st.y / 100 + RH + 0.2, 0.5), stol: () => v3(WX + 1.6, 2.5, 1.0),
      obrobok: () => v3(WX + ra() / 100, WY0 + 0.25, 0.3), ovladanie: () => v3(-5.2, 5.5, 1.98),
    };
    const views = {
      celok: () => [[8, 11, 15], [0, 4.5, 0]],
      rez: () => [[WX - 0.4, WY0 + 1.6, 2.6], [WX - 0.3, WY0 + 0.15, 0], true],
      zhora: () => [[WX - 0.5, 12, 0.6], [WX - 0.5, WY0, 0], true],
      panel: () => [[-3.5, 5.5, 7], [-5.2, 4.4, 1.9], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.measure = () => ({ gear, info: gearInfo(gear) });
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if(c.running || c.drive || c.wheel || c.work)throw new Error(L('Najprv zastav stroj a potom exportuj obrobok.','Stop the machine before exporting the workpiece.'));
      if(dirty){buildGear();dirty=false;}return exportStep(gearG);
    };
    const wi=createMachineWorkInspect({scene,camera,dom,insp,c,set,apiRef,say,
      getObj:()=>(gearG),getSpot:()=>v3(WX, WY0+2, 6),
      canInspect:()=>c.running || st.rpm>1 ? L('Najprv zastav frézu a stôl.', 'Stop the hob and the table first.') : engaged() ? L('Najprv odsuň frézu zo záberu.', 'Retract the hob from the cut first.') : null, prepare:()=>{buildGear();dirty=false;},
    });

    apiRef.current.newBlank = () => {
      if(c.unclamped){say(L('Najprv vráť obrobok do stroja.','Return the workpiece to the machine first.'));return false;}
      if (c.running || st.rpm > 1) { say(L('Polotovar sa mení pri stojacom stroji.', 'The blank is changed with the machine stopped.')); return false; }
      push('d', 0); st.d = 0; push('y', 60); st.y = 60; makeGear();
      say(L(`Na tŕni je nový polotovar Ø${tipD(M2, c.zT)} × 20 mm pre z ${c.zT}.`, `A new blank Ø${tipD(M2, c.zT)} × 20 mm for z ${c.zT} is on the arbor.`), 'info'); return true;
    };

    // ---------- ovládanie ----------
    const needPower = (fn) => () => { if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.')); else fn(); };
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0), onSet: (i) => { push('power', i === 1); if (!i) push('running', false); }, read: () => (c.power ? 'I' : '0') }, mainSw);
    ctrl.reg({ type: 'button', label: LL('ŠTART', 'START'), hint: LL('Spustí frézu a stôl (odvalovanie).', 'Starts the hob and the table (generating).'), action: needPower(() => push('running', true)) }, bStart);
    ctrl.reg({ type: 'button', label: LL('STOP', 'STOP'), hint: LL('Zastaví frézu, stôl aj posuv.', 'Stops the hob, the table and the feed.'), action: () => { push('running', false); push('autoF', false); } }, bStop);
    ctrl.reg({ type: 'button', label: LL('Zvislý posuv', 'Vertical feed'), hint: LL('Zapne alebo vypne automatický posuv hlavy nadol.', 'Switches the automatic downward head feed on or off.'), action: () => push('autoF', !c.autoF) }, bFeed);
    ctrl.reg({ type: 'wheel', minR: 0.3, inc: 1, label: LL('Radiálny prísuv stojana', 'Column radial infeed'), hint: LL('V smere hodinových ručičiek ide fréza do hĺbky. 1 otáčka = 1 mm.', 'Clockwise feeds the hob into depth. 1 turn = 1 mm.'),
      turn: (d) => push('d', clamp(Math.round((c.d + d / TAU) * 100) / 100, 0, 6)), read: () => `${L('hĺbka', 'depth')} ${st.d.toFixed(2)} mm` }, wR);
    ctrl.reg({ type: 'wheel', minR: 0.3, inc: -1, label: LL('Zvislý posuv hlavy', 'Head vertical travel'), hint: LL('1 otáčka = 5 mm.', '1 turn = 5 mm.'),
      turn: (d) => push('y', clamp(Math.round((c.y - d * 5 / TAU) * 10) / 10, -60, 120)), read: () => `Y ${st.y.toFixed(1)} mm` }, wY);
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      wi.update(dt);
      if(c.unclamped){ctrl.update(dt);insp.update(t,c);renderer.render(scene,camera);return;}

      if (!c.power && c.running) push('running', false);
      // nastavenie delenia a sklonu – len pri stojacom stroji
      if ((c.zSel !== st.zSel || Math.abs(c.ang - st.ang) > 1e-9) && st.rpm > 1) { sayOnce('set', true, L('Výmenné kolesá a sklon frézy sa menia len pri stojacom stroji.', 'The change gears and the hob swivel are changed only with the machine stopped.')); c.zSel = st.zSel; pend.zSel = st.zSel; c.ang = st.ang; pend.ang = st.ang; }
      else { flags.set = false; st.zSel = c.zSel; st.ang = c.ang; }
      st.rpm = approach(st.rpm, c.running && c.power ? c.nh : 0, 300 * dt);
      const running = st.rpm > 5, dts = dt * c.timeScale;
      st.hA += st.rpm / 60 * TAU * dt * 0.4; st.cA += st.rpm / 60 / st.zSel * TAU * dts;
      // posuvy: radiálny len mimo záberu alebo za chodu; zvislý posuv nadol za chodu
      if (c.autoF && running) { c.y = Math.max(-60, c.y - c.feed * st.rpm / st.zSel / 60 * dts); pend.y = Math.round(c.y * 10) / 10; if (c.y <= -60) { c.autoF = false; pend.autoF = false; } }
      const dN = approach(st.d, clamp(c.d, 0, 6), (running ? 0.4 : 2) * dt), yN = approach(st.y, clamp(c.y, -60, 120), (c.autoF ? 1000 : 25) * dt);
      if (!running && engaged(dN, yN) && (dN > st.d || !engaged(st.d, st.y))) { sayOnce('still', true, L('Fréza by sa zarezala do stojaceho polotovaru – spusti stroj.', 'The hob would cut into the stationary blank – start the machine.'), 'danger'); c.d = st.d; pend.d = st.d; c.y = st.y; pend.y = st.y; }
      else { flags.still = false; st.d = dN; st.y = yN; }
      // rez
      let cut = false;
      if (running && engaged()) {
        const bb = band(), err = st.ang - hobAngle(M2);
        if (hobCut(gear, st.y - bb, st.y + bb, st.zSel, st.d, err)) { dirty = true; cut = true; }
        st.cutT = t;
        sayOnce('zwrong', st.zSel !== gear.zT, L(`Výmenné kolesá sú nastavené na z ${st.zSel}, polotovar je pre z ${gear.zT} – koleso bude mať zlý počet zubov.`, `The change gears are set for z ${st.zSel}, the blank is for z ${gear.zT} – the gear will have the wrong number of teeth.`), 'warn');
        sayOnce('ang', Math.abs(err) > 0.3, L(`Sklon frézy ${st.ang.toFixed(2)}° nezodpovedá stúpaciemu uhlu ${hobAngle(M2).toFixed(2)}° – zuby budú zošikmené.`, `The hob swivel ${st.ang.toFixed(2)}° does not match the lead angle ${hobAngle(M2).toFixed(2)}° – the teeth will be skewed.`), 'warn');
        sayOnce('deep', st.d > fullDepth(M2) + 0.05, L('Hĺbka je väčšia ako 2,25 · m – zuby budú tenké.', 'The depth exceeds 2.25 · m – the teeth will be thin.'), 'warn');
        chipAcc += dt * 25; while (chipAcc >= 1) { chipAcc -= 1; chipsP.spawn(v3(WX - ra() / 100, WY0 + clamp(st.y, 0, 20) / 100, (Math.random() - 0.5) * 0.3), v3(-0.6 - Math.random(), 0.3 + Math.random(), (Math.random() - 0.5) * 1.5), 2.5); }
      }
      if (dirty && t - lastB > 0.25) { buildGear(); dirty = false; lastB = t; }
      // pohyb skupín
      colG.position.x = hobX() - (-1.55 + 0.0);
      headG.position.y = WY0 + st.y / 100; swG.rotation.x = st.ang * Math.PI / 180 * 3;
      hobSpin.rotation.z = st.hA; turn.rotation.y = -st.cA;
      wR.rotation.z = -st.d * TAU; wY.rotation.z = st.y / 5 * TAU;
      lampRun.emissive.setHex(running ? 0x22dd55 : 0);
      lamp.update(c.light);
      chipsP.update(dt, (q) => (Math.hypot(q.x - WX, q.z) < 1.4 ? 2.6 : 1.2));
      ctrl.update(dt); insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        setTele({ rpm: st.rpm, d: st.d, y: st.y, cutting: (t - st.cutT < 0.3) && running, msg: st.msg && st.msg.until > t ? st.msg : null });
        if (Object.keys(pend).length) { const q = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]); setUi((u) => ({ ...u, ...q })); }
      }
      snd.update({ motor: st.rpm / 250, cut: cut ? 0.7 : 0 });
      renderer.render(scene, camera);
    };
    try { if (/[?&]debug/.test(window.location.search)) window.__hob = { st, c, gear: () => gear }; } catch (err) { /* ignorované */ }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); wi.dispose(); insp.dispose(); try { if (window.__hob && window.__hob.st === st) delete window.__hob; } catch (err) { /* ignorované */ } disposeStage(); };
  }, []);

  const parts = hobParts();
  const m = apiRef.current.measure ? apiRef.current.measure() : null, info = m ? m.info : null;
  const stopped = !ui.running && tele.rpm <= 1;
  const statusMsg = tele.msg ? tele.msg
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
    : tele.cutting ? { kind: 'run', text: `${L('Odvalovanie', 'Hobbing')} – ${L('hĺbka', 'depth')} ${tele.d.toFixed(2)} mm, Y ${tele.y.toFixed(1)} mm` }
    : tele.rpm > 5 ? { kind: 'run', text: L('Fréza a stôl sa odvaľujú. Prisuň do hĺbky nad obrobkom a zapni zvislý posuv.', 'The hob and the table are rolling. Feed to depth above the blank and switch on the vertical feed.') }
    : { kind: 'idle', text: L('Nastav výmenné kolesá a sklon frézy, potom spusti stroj.', 'Set the change gears and the hob swivel, then start the machine.') };
  const chips = [{ color: tele.rpm > 5 ? '#3ee06c' : '#8b8f89', text: tele.rpm > 5 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Stojí', 'Stopped') }];
  chips.push({ color: ui.zSel === ui.zT ? '#7fb6ff' : '#ff8a1f', text: `${L('delenie', 'index')} z ${ui.zSel}` });
  if (tele.cutting) chips.push({ color: '#ffb340', text: L('Odvalovanie', 'Hobbing') });
  const gs = indexGears(ui.zSel);
  const setupTask = (task) => { if (!stopped) return; Object.entries(task.setup).forEach(([k, v]) => set(k, v)); setTimeout(() => { if (apiRef.current.newBlank) apiRef.current.newBlank(); }, 300); };
  const f3 = (x) => L(x.toFixed(3).replace('.', ','), x.toFixed(3));

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} canUnclamp workLabels={[L('Pozrieť obrobok','Inspect workpiece'),L('Upnúť späť','Clamp back')]}
        tips={[L('Pri jednochodej fréze sa stôl otočí o 1/z otáčky na otáčku frézy – výmenné kolesá delenia i = 24 / z.', 'With a single-start hob the table turns 1/z of a revolution per hob revolution – index change gears i = 24 / z.'),
          L('Do hĺbky prisúvaj nad obrobkom, potom zvislým posuvom prejdi celú šírku kolesa.', 'Feed to depth above the blank, then traverse the whole face width with the vertical feed.'),
          L('Rozmer cez zuby Wk ukáže, či je zub dorezaný na plnú hĺbku.', 'The span over teeth Wk shows whether the tooth is cut to full depth.')]} />
      <aside className="panel"><fieldset className="machine-settings" disabled={ui.unclamped}>
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · odvalovacia frézka', 'Simulator · gear hobber')} title={L('Odvalovacia frézka na ozubenie', 'Gear hobbing machine')}
          sub={L('Predloha: odvalovacie frézky TOS Čelákovice – výmenné kolesá delenia, sklon frézy, radiálny prísuv stojana a zvislý posuv hlavy.', 'Modelled after TOS Čelákovice gear hobbers – index change gears, hob swivel, radial column infeed and vertical head feed.')}
          rows={[[L('Hĺbka mm', 'Depth mm'), tele.d.toFixed(2)], ['Y mm', tele.y.toFixed(1)]]}
          foot={[`m 2 · z ${ui.zT}`, `${L('sklon', 'swivel')} ${ui.ang.toFixed(2)}°`]} status={statusMsg} />

        <TaskSection machine="odvalovacka" tasks={HOB_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'running', items: HOB_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
          <button type="button" className={`btn-run ${ui.running ? 'stop' : 'start'}`} onClick={() => { if (!ui.running && !ui.power) set('power', true); set('running', !ui.running); if (ui.running) set('autoF', false); }}>
            {ui.running ? L('■ Stop', '■ Stop') : L('▶ Štart odvalovania', '▶ Start hobbing')}
          </button>
          <div className="mt-2"><Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} /></div>
          <SegRow label={L('Otáčky frézy', 'Hob speed')} value={ui.nh} options={[80, 125, 160, 200, 250].map((n) => [n, String(n)])} onChange={(n) => { if (stopped) set('nh', n); }} />
          <p className="text-xs muted">{L(`Rezná rýchlosť frézy ${(Math.PI * HOB.d0 * ui.nh / 1000).toFixed(0)} m/min (HSS v oceli 25 – 40 m/min).`, `Hob cutting speed ${(Math.PI * HOB.d0 * ui.nh / 1000).toFixed(0)} m/min (HSS in steel 25 – 40 m/min).`)}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Nastavenie', 'Setup')}</h2>
          <SegRow label={L('Výmenné kolesá delenia – z', 'Index change gears – z')} value={ui.zSel} options={HOB_Z.map((z) => [z, String(z)])} onChange={(v) => { if (stopped) set('zSel', v); }} />
          <p className="text-xs muted">{gs ? L(`i = 24 / ${ui.zSel} = ${gs.a}/${gs.b}${gs.c !== 1 ? ` · ${gs.c}/${gs.d}` : ''}`, `i = 24 / ${ui.zSel} = ${gs.a}/${gs.b}${gs.c !== 1 ? ` · ${gs.c}/${gs.d}` : ''}`) : ''}</p>
          <Slider id="ha" label={L('Sklon frézy', 'Hob swivel')} unit="°" min={-5} max={5} step={0.01} value={ui.ang} digits={2} onChange={(v) => { if (stopped) set('ang', v); }} disabled={!stopped} />
          <p className="text-xs muted">{L(`Stúpací uhol jednochodej frézy m 2, Ø70: γ = arcsin(m / d0) = ${hobAngle(M2).toFixed(2).replace('.', ',')}°.`, `Lead angle of a single-start hob m 2, Ø70: γ = arcsin(m / d0) = ${hobAngle(M2).toFixed(2)}°.`)}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Prísuvy', 'Feeds')}</h2>
          <Slider id="hdp" label={L('Hĺbka zuba (radiálny prísuv)', 'Tooth depth (radial infeed)')} unit="mm" min={0} max={6} step={0.01} value={ui.d} actual={tele.d} digits={2} onChange={(v) => set('d', v)} />
          <Slider id="hyy" label={L('Výška frézy nad spodkom kolesa', 'Hob height above the gear bottom')} unit="mm" min={-60} max={120} step={0.5} value={ui.y} actual={tele.y} digits={1} onChange={(v) => set('y', v)} />
          <Toggle on={ui.autoF} label={L('Automatický zvislý posuv nadol', 'Automatic downward vertical feed')} onClick={() => set('autoF', !ui.autoF)} />
          <SegRow label={L('Posuv mm/ot stola', 'Feed mm/table rev')} value={ui.feed} options={HOB_FEEDS.map((x) => [x, String(x).replace('.', ',')])} onChange={(v) => set('feed', v)} />
          <SegRow label={L('Zrýchlenie', 'Acceleration')} value={ui.timeScale} options={[[1, '1×'], [10, '10×'], [50, '50×']]} onChange={(v) => set('timeScale', v)} />
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Meranie', 'Measurement')}</h2>
          {info && info.cover > 0 ? (
            <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
              <div>{L('Zuby', 'Teeth')}: <b>{info.zs.join(' / ')}</b>{info.mixed ? L(' – poškodené (zmena delenia)', ' – damaged (index changed)') : ''}</div>
              <div>{L('Hĺbka', 'Depth')}: <b>{info.dMin.toFixed(2)} – {info.dMax.toFixed(2)} mm</b>, {L('šírka', 'face')} <b>{Math.round(info.cover * 100)} %</b></div>
              {info.z > 0 && <div>W{info.k}: <b>{f3(info.Wk)}</b> ({L('výkres', 'drawing')} {f3(info.Wk0)})</div>}
            </div>
          ) : <p className="text-xs muted">{L('Polotovar je zatiaľ bez zubov.', 'The blank has no teeth yet.')}</p>}
          <SegRow label={L('Polotovar pre z', 'Blank for z')} value={ui.zT} options={[20, 24, 30, 36].map((z) => [z, String(z)])} onChange={(v) => set('zT', v)} />
          <button type="button" className="btn mt-2" onClick={() => apiRef.current.newBlank && apiRef.current.newBlank()}>{L('Nový polotovar', 'New blank')}</button>
        </div>

        <ExportSection machine="odvalovacka" apiRef={apiRef} canStl={false} />
        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['rez', L('Detail frézy', 'Hob detail')], ['zhora', L('Zhora', 'Top')], ['panel', L('Ovládanie', 'Controls')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </fieldset></aside>
    </div>
  );
}

export { HobberSimulator };
export default HobberSimulator;
