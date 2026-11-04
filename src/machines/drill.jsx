import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL, RPM } from '../core/i18n';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, makeKit, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp, logNear } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { createSound } from '../core/sound';
import { CutCalc, ExportSection, TaskSection } from '../ui/tools';
import { DrillDrawing } from '../ui/sketch';
import { drillChecks } from './shopMath';
import { BlankSection, GEAR_LOCK, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, StepSelect, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// STĹPOVÁ VŔTAČKA TOS SV16
// =====================================================================
const DRILL = {
  SX: -0.4, SZ: 0.4, NOSE: 11.8,            // os vretena a spodok puzdra pinoly
  T0: 4.0,                                   // najnižšia poloha stola
  PAR: 0.2,                                  // podložky 20 mm
  CH: 0.95, BL: 1.3,                         // dĺžka skľučovadla a vrtáka
};
const DRILL_SPEEDS = [125, 180, 250, 355, 500, 710, 1000, 1400];   // 2 × 4
const DRILL_SIZES = [3, 4, 5, 6, 8, 10, 12, 14, 16];
const D2_ANG = [0.5, -0.5], D4_ANG = [0.95, 0.32, -0.32, -0.95];
const drillParts = () => mkParts([
  ['podstavec', 'Základová doska', 'Base plate', 'Základová doska', 'Base plate', 'Liatinová doska s T-drážkami nesie stĺp. Pri vysokých obrobkoch sa stôl odklopí a obrobok sa upne priamo na ňu.', 'Cast-iron plate with T-slots carrying the column. For tall work the table is swung aside and the work is clamped directly on it.'],
  ['stlp', 'Stĺp', 'Column', 'Stĺp', 'Column', 'Brúsený oceľový stĺp s ozubeným hrebeňom. Po ňom sa kľukou posúva rameno stola nahor a nadol.', 'Ground steel column with a rack. The table arm is raised and lowered on it by a crank.'],
  ['hlava', 'Vŕtacia hlava', 'Drill head', 'Vŕtacia hlava', 'Drill head', 'Skriňa s prevodovkou otáčok, ovládacím panelom a priečnou kľukou posuvu pinoly. Pákami na boku sa volí 8 otáčok 125 – 1400 ot/min.', 'Housing with the speed gearbox, the control panel and the capstan quill feed. The side levers select 8 speeds 125 – 1400 rpm.'],
  ['motor', 'Motor', 'Motor', 'Elektromotor', 'Electric motor', 'Prírubový trojfázový motor s rebrovaním poháňa vreteno cez prevodovku v hlave.', 'A flanged, finned three-phase motor drives the spindle through the gearbox in the head.'],
  ['vreteno', 'Pinola a vrták', 'Quill & drill', 'Pinola, skľučovadlo a vrták', 'Quill, chuck and drill', 'Pinola sa vysúva priečnou kľukou až o 100 mm. V skľučovadle je špirálový vrták Ø3 – Ø16 mm (najväčší priemer pre SV16).', 'The capstan extends the quill by up to 100 mm. The chuck holds a twist drill Ø3 – Ø16 mm (the maximum for the SV16).'],
  ['stol', 'Stôl', 'Table', 'Stôl s ramenom', 'Table with arm', 'Stôl s T-drážkami na ramene okolo stĺpa. Kľukou vpravo sa zdvíha cez hrebeň, páka vľavo ho aretuje.', 'T-slotted table on an arm around the column. The crank on the right raises it via the rack, the lever on the left locks it.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Obrobok na podložkách', 'Workpiece on parallels', 'Oceľová doska zvoleného rozmeru na dvoch podložkách. Medzi podložkami sa dá vŕtať naskrz; vrták nesmie zasiahnuť podložku ani stôl.', 'Steel plate of the selected size on two parallels. You can drill through between the parallels; the drill must not hit a parallel or the table.'],
]);

// pôdorys dosky s dierami (rozmery v mm)
const DRILL_TASKS = [
  { id: 'dve', title: () => L('Dve diery Ø10 naskrz, rozostup 50 mm', 'Two Ø10 through holes, 50 mm apart'),
    desc: () => L('Oceľová doska 180 × 120 × 25 mm. Vyvŕtaj vrtákom Ø10 dve diery naskrz vo vzdialenosti 50 ±1 mm. Medzi dierami posúvaj stôl (u, v). Pri vŕtaní naskrz sleduj podložky – vrták musí vyjsť medzi ne.', 'Steel plate 180 × 120 × 25 mm. Drill two Ø10 through holes 50 ±1 mm apart. Move the table (u, v) between the holes. When drilling through, watch the parallels – the drill must exit between them.'),
    setup: { bL: 180, bW: 120, bT: 25, bit: 10, rpm: 710 },
    drawing: () => <DrillDrawing holes={[[-25, 0, 10], [25, 0, 10]]} callout={L('2 × Ø10 naskrz', '2 × Ø10 through')} dist="50 ±1" />,
    labels: { count: () => L('Práve dve diery', 'Exactly two holes'), d: () => L('Priemer Ø10', 'Diameter Ø10'), through: () => L('Obe naskrz', 'Both through'), dist: () => L('Rozostup 50 ±1 mm', 'Spacing 50 ±1 mm') } },
  { id: 'slepa', title: () => L('Slepá diera Ø8 hĺbky 15 mm', 'Blind hole Ø8, 15 mm deep'),
    desc: () => L('Oceľová doska 180 × 120 × 25 mm. Vyvŕtaj jednu slepú dieru Ø8 hĺbky 15 ±0,5 mm (nie naskrz). Hĺbku sleduj na displeji, pinolu posúvaj pomaly.', 'Steel plate 180 × 120 × 25 mm. Drill one blind Ø8 hole 15 ±0.5 mm deep (not through). Watch the depth on the display, feed the quill slowly.'),
    setup: { bL: 180, bW: 120, bT: 25, bit: 8, rpm: 1000 },
    drawing: () => <DrillDrawing holes={[[0, 0, 8]]} callout={L('Ø8, hĺbka 15 ±0,5', 'Ø8, depth 15 ±0.5')} />,
    labels: { count: () => L('Práve jedna diera', 'Exactly one hole'), d: () => L('Priemer Ø8', 'Diameter Ø8'), depth: () => L('Hĺbka 15 ±0,5 mm, nie naskrz', 'Depth 15 ±0.5 mm, not through') } },
].map((t) => ({ ...t, checks: (m) => drillChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const DRILL_SAFETY = () => [
  L('Doska je upnutá alebo zaistená proti pretočeniu, nedržím ju rukou.', 'The plate is clamped or secured against spinning, I do not hold it by hand.'),
  L('Kľúč od skľučovadla vrtáka je vybratý.', 'The drill chuck key is removed.'),
  L('Mám ochranné okuliare, bez rukavíc, vlasy zopnuté.', 'I wear safety glasses, no gloves, hair tied back.'),
];

function DrillSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { running: false, power: true, manual: false, rpm: 710, quill: 0, table: 450, u: 0, v: 0, bit: 10, timeScale: 1, bL: 180, bW: 120, bT: 25 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, quill: 0, table: 450, depth: 0, vc: 0, msg: null, drilling: false, holes: 0 });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { SX, SZ, NOSE, T0, PAR, CH, BL } = DRILL;
    const wk = { PT: 0.25, PW: 1.8, PD: 1.2 };
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('drill');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x52c2a5, 0x3da98c, 0x2c7d68),
      col: std(0x5e5953, 0.42, 0.6), motor: std(0x7d8389, 0.5, 0.55), plate: std(0x737980, 0.42, 0.62),
      hole: std(0x0b0c0d, 0.9, 0.1), bit: std(0x2f3236, 0.32, 0.8), chip: std(0xa6adb4, 0.3, 0.85),
    };
    const { add, box, cylX, cylY, cylZ, ball, lever, hitProxy, pivotLever, detents, crank, face } = makeKit(M);
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- základová doska ----------
    const base = grp('podstavec');
    box(base, -2.25, 2.25, 0, 0.12, -3.55, 2.55, M.greenDark);
    box(base, -2.1, 2.1, 0.12, 0.42, -3.4, 2.4, M.green);
    box(base, -1.75, 1.75, 0.42, 0.5, -1.7, 2.0, M.col);
    [-1.25, -0.55, 0.15, 0.85, 1.55].forEach((z) => box(base, -1.75, 1.75, 0.49, 0.505, z - 0.06, z + 0.06, M.black));
    box(base, -2.1, 2.1, 0.42, 0.62, -3.4, -1.7, M.green);
    cylY(base, 0.72, 0.6, 0.62, 0.95, 0, -2.4, M.green, 28);
    [[-1.95, -3.25], [1.95, -3.25], [-1.95, 2.25], [1.95, 2.25]].forEach(([x, z]) => cylY(base, 0.12, 0.12, 0.12, 0.2, x, z, M.steelDark, 12));

    // ---------- stĺp ----------
    const colG = grp('stlp');
    cylY(colG, 0.42, 0.42, 0.95, 12.0, 0, -2.4, M.col, 32);
    box(colG, 0.34, 0.5, 1.4, 11.4, -2.48, -2.32, M.steelDark);        // hrebeň
    cylY(colG, 0.56, 0.56, 11.5, 12.0, 0, -2.4, M.green, 28);

    // ---------- vŕtacia hlava ----------
    const head = grp('hlava');
    box(head, -1.5, 1.3, 12.0, 15.2, -3.3, 1.2, M.green);
    box(head, -1.62, 1.42, 15.2, 15.6, -3.45, 1.35, M.green);
    cylY(head, 0.45, 0.45, 11.4, 12.0, SX, SZ, M.green, 28);            // puzdro pinoly
    box(head, -1.2, -0.45, 14.0, 14.55, 1.2, 1.22, M.panel);            // výrobný štítok
    box(head, 0.2, 1.0, 12.7, 14.7, 1.2, 1.24, M.panel);                // ovládací panel
    ball(head, 0.07, 0.38, 14.45, 1.26, M.lamp);
    const pbtn = (x, y, m) => { const g = new THREE.Group(); g.position.set(x, y, 1.24); head.add(g); cylZ(g, 0.1, 0.1, 0, 0.07, 0, 0, m, 20); hitProxy(g, 0.15, 0, 0, 0.05); return g; };
    const btnStart = pbtn(0.42, 14.0, M.btnGreen), btnStop = pbtn(0.78, 14.0, M.red);
    box(head, 0.3, 0.9, 12.85, 13.5, 1.24, 1.25, M.yellow);
    const mainSwitch = new THREE.Group(); mainSwitch.position.set(0.6, 13.17, 1.25); head.add(mainSwitch);
    cylZ(mainSwitch, 0.17, 0.17, 0, 0.06, 0, 0, M.black, 24);
    box(mainSwitch, -0.22, 0.22, -0.045, 0.045, 0.06, 0.17, M.red);
    // priečna kľuka posuvu pinoly na ľavom boku
    const cfc = face(head, -1.5, 13.1, SZ, -Math.PI / 2);
    const capstan = new THREE.Group(); cfc.add(capstan);
    cylZ(capstan, 0.25, 0.25, 0, 0.28, 0, 0, M.steelDark, 24);
    cylZ(capstan, 0.1, 0.1, 0.28, 0.42, 0, 0, M.steel, 16);
    for (let k = 0; k < 3; k++) {
      const arm = new THREE.Group(); arm.rotation.z = k * TAU / 3 + Math.PI / 2; capstan.add(arm);
      cylX(arm, 0.05, 0.04, 0.2, 1.25, 0, 0.18, M.steel, 10); ball(arm, 0.13, 1.3, 0, 0.18, M.black);
    }
    // páky otáčok na pravom boku
    const sf = face(head, 1.3, 0, 0.5, Math.PI / 2);
    cylZ(sf, 0.26, 0.22, 0, 0.15, -0.5, 14.55, M.black, 24); cylZ(sf, 0.26, 0.22, 0, 0.15, 0.25, 14.55, M.black, 24);
    detents(sf, -0.5, 14.55, 0.15, 0.17, D2_ANG, 0.025); detents(sf, 0.25, 14.55, 0.15, 0.17, D4_ANG, 0.022);
    const levR = pivotLever(sf, -0.5, 14.55, 0.15, 0.42, 1.15), levS = pivotLever(sf, 0.25, 14.55, 0.15, 0.42, 1.15);

    // ---------- motor ----------
    const mot = grp('motor');
    cylX(mot, 0.62, 0.62, 1.3, 2.5, 13.55, -0.9, M.motor, 32);
    for (let k = 0; k < 12; k++) {
      const a = k * TAU / 12;
      const f = add(mot, new THREE.BoxGeometry(1.1, 0.12, 0.06), M.motor, 1.9, 13.55 + Math.sin(a) * 0.66, -0.9 + Math.cos(a) * 0.66);
      f.rotation.x = -a;
    }
    cylX(mot, 0.56, 0.5, 2.5, 2.72, 13.55, -0.9, M.motor, 28);
    box(mot, 1.55, 2.15, 14.15, 14.5, -1.25, -0.55, M.motor);

    // ---------- pinola, skľučovadlo, vrták ----------
    const spG = grp('vreteno'); spG.position.set(SX, NOSE, SZ);
    cylY(spG, 0.3, 0.3, 0, 0.9, 0, 0, M.steel, 28);
    const rot = new THREE.Group(); spG.add(rot);
    cylY(rot, 0.22, 0.22, -0.25, 0, 0, 0, M.steelDark, 24);
    cylY(rot, 0.3, 0.26, -0.85, -0.25, 0, 0, M.steel, 28);
    cylY(rot, 0.31, 0.31, -0.62, -0.5, 0, 0, M.steelDark, 28);
    cylY(rot, 0.16, 0.12, -CH, -0.85, 0, 0, M.steelDark, 20);
    const bitG = new THREE.Group(); rot.add(bitG);
    const bitR = (d = st.bit) => d / 200;
    const buildBit = (d) => {
      while (bitG.children.length) { const o = bitG.children[0]; bitG.remove(o); o.geometry.dispose(); }
      const r = bitR(d);
      cylY(bitG, r, r, -CH - BL, -CH, 0, 0, M.bit, 16);
      const cone = add(bitG, new THREE.ConeGeometry(r, r * 1.2, 16), M.bit, 0, -CH - BL - r * 0.6, 0); cone.rotation.x = Math.PI;
      for (let k = 0; k < 2; k++) {
        const f = add(bitG, new THREE.BoxGeometry(r * 2.04, BL * 0.85, r * 0.28), M.steel, 0, -CH - BL * 0.55, 0);
        f.rotation.y = k * Math.PI / 2 + 0.4;
      }
    };

    // ---------- stôl s ramenom ----------
    const tbl = grp('stol');
    cylY(tbl, 0.62, 0.62, -1.3, -0.2, 0, -2.4, M.green, 28);
    box(tbl, -0.45, 0.45, -1.0, -0.35, -1.9, SZ - 1.2, M.green);
    box(tbl, SX - 1.65, SX + 1.65, -0.48, -0.3, SZ - 1.35, SZ + 1.35, M.green);
    box(tbl, SX - 1.6, SX + 1.6, -0.3, 0, SZ - 1.3, SZ + 1.3, M.col);
    [SZ - 0.65, SZ, SZ + 0.65].forEach((z) => box(tbl, SX - 1.6, SX + 1.6, -0.03, 0.002, z - 0.07, z + 0.07, M.black));
    box(tbl, 0.55, 0.95, -1.15, -0.45, -2.65, -2.15, M.green);
    const tf = face(tbl, 0.95, -0.8, -2.4, Math.PI / 2);
    cylZ(tf, 0.08, 0.08, 0, 0.12, 0, 0, M.steel, 12);
    const crankT = crank(tf, 0.5, 0, 0, 0.12);
    lever(tbl, -0.62, -0.75, -2.4, 0.45, 0, 1.4);

    // ---------- obrobok na podložkách ----------
    const plateG = grp('obrobok', tbl);
    const plateW = new THREE.Group(); plateG.add(plateW);
    const parG = new THREE.Group(); plateG.add(parG);
    const holeGeo = new THREE.CylinderGeometry(1, 1, 1, 24); holeGeo.translate(0, -0.5, 0);
    let holes = [];
    const showHole = (h) => { h.m.scale.set(h.r, Math.min(h.depth, wk.PT) + 0.004, h.r); };
    const addHole = (x, z, r) => {
      const m = new THREE.Mesh(holeGeo, M.hole); m.userData.stepSubtract=true; m.position.set(x, PAR + wk.PT + 0.002, z); plateW.add(m);
      const h = { x, z, r, depth: 0, m, through: false }; holes.push(h); return h;
    };
    const makePlate = () => {
      [plateW, parG].forEach((g) => { for (let i = g.children.length - 1; i >= 0; i--) { const o = g.children[i]; if (o.geometry !== holeGeo) o.geometry.dispose(); g.remove(o); } });
      holes = [];
      box(parG, -0.8, -0.6, 0, PAR, -wk.PD / 2, wk.PD / 2, M.steel);
      box(parG, 0.6, 0.8, 0, PAR, -wk.PD / 2, wk.PD / 2, M.steel);
      box(plateW, -wk.PW / 2, wk.PW / 2, PAR, PAR + wk.PT, -wk.PD / 2, wk.PD / 2, M.plate);
    };
    makePlate();
    const findHole = (x, z, r) => holes.find((h) => Math.hypot(h.x - x, h.z - z) < Math.max(0.012, r * 0.35));

    const chipsP = createParticles(scene, new THREE.BoxGeometry(0.05, 0.012, 0.09), M.chip, 120);

    // ---------- stav simulácie ----------
    const st = { q: c.quill / 100, T: T0 + c.table / 100, u: c.u / 100, v: c.v / 100, bit: c.bit, rpm: 0, spin: 0, drillT: -9, msg: null };
    let t = 0, last = performance.now(), teleT = 0, chipAcc = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 2.6 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const tipK = (d = st.bit) => NOSE - CH - BL - bitR(d) * 1.2;      // hrot vrtáka pri zasunutej pinole
    buildBit(st.bit);
    // spodné hranice hrotu voči hornej ploche stola pre aktuálnu polohu obrobku
    const floorInfo = (d = st.bit) => {
      const r = bitR(d), px = -st.u, pz = -st.v;
      const onPlate = !c.unclamped && Math.abs(px) < wk.PW / 2 + r * 0.5 && Math.abs(pz) < wk.PD / 2 + r * 0.5;
      let hard = 0, why = 'table';
      if (Math.abs(Math.abs(px) - 0.7) < 0.1 + r && Math.abs(pz) < wk.PD / 2 + r) { hard = PAR; why = 'par'; }
      const h = onPlate ? findHole(px, pz, r) : null;
      const holeD = h && h.r >= r - 1e-6 ? (h.through ? Infinity : h.depth) : 0;
      return { onPlate, hard, why, free: onPlate ? PAR + wk.PT - holeD : -Infinity, px, pz, h, r };
    };
    const limitRel = (rel, old, fi, running, rate) => {
      let r2 = rel, why = null;
      if (fi.onPlate && r2 < fi.free) {
        const lim = running ? Math.min(old, fi.free) - rate : Math.min(old, fi.free);
        if (r2 < lim) { r2 = lim; if (!running) why = 'work'; }
      }
      if (r2 < fi.hard) { r2 = fi.hard; why = fi.why; }
      return [r2, why];
    };

    // ---------- pohľady, popisy a výber dielov ----------
    const anchors = {
      podstavec: () => v3(1.6, 0.6, 2.3),
      stlp: () => v3(0.45, 3.0, -2.2),
      hlava: () => v3(-0.3, 15.75, 0.6),
      motor: () => v3(2.4, 14.3, -0.9),
      vreteno: () => v3(SX + 0.35, NOSE - st.q - 0.5, SZ + 0.3),
      stol: () => v3(SX + 1.6, st.T + 0.05, SZ + 1.3),
      obrobok: () => v3(SX + st.u - 0.6, st.T + PAR + wk.PT + 0.05, SZ + st.v),
    };
    const views = {
      celok: () => [[10.5, 12, 19], [0, 7.8, -0.6]],
      rez: () => [[SX + 2.9, st.T + 3.4, SZ + 4.3], [SX, st.T + 0.6, SZ], true],
      spredu: () => [[0, 8.5, 17], [0, 7.8, -0.5]],
      zhora: () => [[0.3, 22, 6], [0, 6.5, 0]],
      bok: () => [[-11, 12, 5], [-0.6, 12, -0.5], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);
    const inPlate = () => tipK() - st.q - st.T < PAR + wk.PT + 0.04 && floorInfo().onPlate;

    // ---------- polotovar ----------
    const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj: () => plateW, getSpot: () => v3(2.6, 9.0, 4.6), onState: (v) => { push('unclamped', v); push('manual', c.manual); } });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in') {
        if (c.running || st.rpm > 1) { say(L('Doska sa berie zo stola len pri stojacom vretene.', 'The plate can only be taken off with the spindle stopped.')); return; }
        if (inPlate() || tipK() - st.q - st.T < PAR + wk.PT + 0.3) { say(L('Najprv vytiahni vrták hore (pinola) alebo spusti stôl.', 'Retract the drill first (quill up) or lower the table.')); return; }
      }
      if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb polotovaru.', 'Wait until the workpiece movement finishes.'), 'info');
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) { say(L('Najprv polož dosku späť.', 'Put the plate back first.')); return; }
      if (inPlate()) { say(L('Najprv vytiahni vrták z obrobku (pinola hore).', 'Pull the drill out of the workpiece first (quill up).')); return; }
      wk.PW = c.bL / 100; wk.PD = c.bW / 100; wk.PT = c.bT / 100; makePlate();
      say(L('Na podložkách je nová doska bez dier.', 'A new plate without holes is on the parallels.'), 'info');
      return true;
    };
    // meranie a uloženie dosky s dierami
    const holeData = () => holes.map((h) => ({ x: h.x * 100, z: h.z * 100, d: Math.round(h.r * 200 * 10) / 10, depth: Math.min(h.depth, wk.PT) * 100, through: h.through }));
    apiRef.current.measure = () => ({ holes: holeData(), PT: wk.PT * 100 });
    apiRef.current.save = () => ({ v: 1, wk: { ...wk }, holes: holes.map((h) => ({ x: h.x, z: h.z, r: h.r, depth: h.depth, through: h.through })) });
    apiRef.current.load = (r) => {
      if (!r || r.v !== 1) return false;
      push('bL', Math.round(r.wk.PW * 100)); push('bW', Math.round(r.wk.PD * 100)); push('bT', Math.round(r.wk.PT * 100));
      if (!apiRef.current.newBlank()) return false;
      r.holes.forEach((s) => { const h = addHole(s.x, s.z, s.r); h.depth = s.depth; h.through = s.through; showHole(h); });
      return true;
    };
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if(c.running || c.drive || c.wheel || c.work)throw new Error(L('Najprv zastav stroj a potom exportuj obrobok.','Stop the machine before exporting the workpiece.'));
      return exportStep(plateW);
    };

    // ---------- ručné ovládanie prvkov ----------
    const spdIdx = () => logNear(DRILL_SPEEDS, c.rpm);
    const gearGuard = () => {
      if (!c.running && st.rpm < 1) return true;
      say(L('Otáčky sa preraďujú len pri stojacom vretene – najprv ho zastav.', 'Speeds can only be changed with the spindle stopped – stop it first.'), 'warn'); return false;
    };
    const setSpeed = (a, b) => { push('rpm', DRILL_SPEEDS[a * 4 + b]); say(`${L('Zaradené otáčky', 'Speed selected:')} ${c.rpm} ${RPM()}.`, 'info'); };
    ctrl.reg({ type: 'wheel', minR: 0.9, inc: 1, label: LL('Priečna kľuka posuvu pinoly', 'Capstan quill feed'), hint: LL('Ťahaj za rukoväte k sebe – pinola s vrtákom ide dole. 1 otáčka = 90 mm.', 'Pull the handles towards you – the quill and drill go down. 1 turn = 90 mm.'),
      turn: (d) => { const a = st.q * 100; push('quill', clamp(clamp(c.quill - d * 90 / TAU, a - 6, a + 6), 0, 100)); },
      read: () => `${L('pinola', 'quill')} ${(st.q * 100).toFixed(1)} mm` }, capstan);
    ctrl.reg({ type: 'wheel', minR: 0.35, inc: 1, label: LL('Kľuka zdvihu stola', 'Table elevating crank'), hint: LL('Toč v smere hodinových ručičiek – stôl stúpa. 1 otáčka = 12 mm.', 'Turn clockwise – the table rises. 1 turn = 12 mm.'),
      turn: (d) => { const a = (st.T - T0) * 100; push('table', clamp(clamp(c.table + d * 12 / TAU, a - 10, a + 10), 0, 500)); },
      read: () => `${L('stôl', 'table')} ${((st.T - T0) * 100).toFixed(1)} mm` }, crankT);
    ctrl.reg({ type: 'lever', angles: D2_ANG, minR: 0.22, guard: gearGuard, label: LL('Páka otáčok I (rozsah)', 'Speed lever I (range)'), hint: LL('Pomalý / rýchly rozsah. Len pri stojacom vretene.', 'Slow / fast range. Only with the spindle stopped.'),
      getIdx: () => Math.floor(spdIdx() / 4), onSet: (i) => setSpeed(i, spdIdx() % 4), read: () => `${c.rpm} ${RPM()}` }, levR);
    ctrl.reg({ type: 'lever', angles: D4_ANG, minR: 0.22, guard: gearGuard, label: LL('Páka otáčok II (stupeň)', 'Speed lever II (step)'), hint: LL('4 stupne v každom rozsahu. Len pri stojacom vretene.', '4 steps in each range. Only with the spindle stopped.'),
      getIdx: () => spdIdx() % 4, onSet: (i) => setSpeed(Math.floor(spdIdx() / 4), i), read: () => `${c.rpm} ${RPM()}` }, levS);
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('Otoč alebo klikni: 0 = vypnuté, I = zapnuté.', 'Turn or click: 0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0),
      onSet: (i) => { push('power', i === 1); if (i === 0) { push('running', false); say(L('Hlavný vypínač vypnutý.', 'Main switch off.'), 'warn'); } else say(L('Hlavný vypínač zapnutý. Vreteno spustíš zeleným tlačidlom.', 'Main switch on. Start the spindle with the green button.'), 'info'); },
      read: () => (c.power ? L('I – zapnuté', 'I – on') : L('0 – vypnuté', '0 – off')) }, mainSwitch);
    ctrl.reg({ type: 'button', label: LL('Tlačidlo ŠTART', 'START button'), hint: LL('Spustí vreteno.', 'Starts the spindle.'),
      action: () => { if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'), 'warn'); else push('running', true); } }, btnStart);
    ctrl.reg({ type: 'button', label: LL('Tlačidlo STOP', 'STOP button'), hint: LL('Zastaví vreteno.', 'Stops the spindle.'), action: () => push('running', false) }, btnStop);
    let plate0 = 0;
    ctrl.reg({ type: 'slide', label: LL('Obrobok', 'Workpiece'), hint: LL('Ťahaj dosku po stole doľava alebo doprava (poloha diery v osi X).', 'Drag the plate left or right on the table (hole position in X).'),
      read: () => `X ${(st.u * 100).toFixed(1)} mm`,
      start: () => { plate0 = st.u; },
      slide: (dx) => push('u', clamp((plate0 + dx) * 100, -60, 60)),
      nudge: (dir) => push('u', clamp(st.u * 100 + dir * 5, -60, 60)) }, plateG);

    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      st.rpm = approach(st.rpm, c.running && c.power ? c.rpm : 0, 1600 * dt);
      const running = st.rpm > 15;
      const revs = st.rpm > 0 ? 5 * st.rpm / (st.rpm + 400) : 0;
      st.spin += revs * TAU * dt; rot.rotation.y = -st.spin;
      wi.update(dt);

      // výmena vrtáka
      if (c.bit !== st.bit) {
        const tipRel = tipK(c.bit) - st.q - st.T;
        if (c.running || running) { say(L('Vrták sa mení len pri stojacom vretene.', 'The drill can only be changed with the spindle stopped.'), 'warn'); push('bit', st.bit); }
        else if (tipRel < PAR + wk.PT + 0.02 && floorInfo(c.bit).onPlate) { say(L('Najprv vytiahni vrták z obrobku (pinola hore).', 'Pull the drill out of the workpiece first (quill up).'), 'warn'); push('bit', st.bit); }
        else { st.bit = c.bit; buildBit(st.bit); say(`${L('Upnutý vrták', 'Drill clamped:')} Ø${st.bit} mm.`, 'info'); }
      }

      // posun obrobku po stole – nie keď je vrták v diere
      const uT = clamp(c.u, -60, 60) / 100, vT = clamp(c.v, -50, 50) / 100;
      if (uT !== st.u || vT !== st.v) {
        if (tipK() - st.q - st.T < PAR + wk.PT + 0.005 && floorInfo().onPlate) { sayOnce('platemove', true, L('Vrták je v obrobku – najprv vytiahni pinolu hore.', 'The drill is in the workpiece – retract the quill first.'), 'warn'); push('u', st.u * 100); push('v', st.v * 100); }
        else { flags.platemove = false; st.u = approach(st.u, uT, 1.2 * dt); st.v = approach(st.v, vT, 1.2 * dt); }
      }

      const fi = floorInfo();
      const rate = running ? 0.12 * st.rpm / 60 * c.timeScale / 100 * dt : 0;   // posuv 0,12 mm/ot pri vŕtaní
      // stôl
      let nT = approach(st.T, T0 + clamp(c.table, 0, 500) / 100, 0.8 * dt);
      let rel = tipK() - st.q - nT;
      const [r1, why1] = limitRel(rel, tipK() - st.q - st.T, fi, running, rate);
      if (r1 > rel) nT = tipK() - st.q - r1;
      // pinola
      let nq = approach(st.q, clamp(c.quill, 0, 100) / 100, 1.5 * dt);
      rel = tipK() - nq - nT;
      const [r2, why2] = limitRel(rel, tipK() - st.q - nT, fi, running, rate);
      if (r2 > rel) nq = tipK() - r2 - nT;
      const why = why1 || why2;
      sayOnce('work', why === 'work', L('Vrták narazil do obrobku. Pri stojacom vretene nevŕta – spusti vreteno.', 'The drill hit the workpiece. It does not drill with the spindle stopped – start the spindle.'), 'danger');
      sayOnce('par', why === 'par', L('Vrták by navŕtal podložku – posuň obrobok tak, aby bol vrták medzi podložkami.', 'The drill would drill into a parallel – move the workpiece so the drill is between the parallels.'), 'warn');
      sayOnce('table', why === 'table', L('Vrták by navŕtal stôl – zastav posuv pinoly.', 'The drill would drill into the table – stop the quill feed.'), 'warn');
      capstan.rotation.z -= (nq - st.q) / 0.9 * TAU;
      crankT.rotation.z += (nT - st.T) / 0.12 * TAU;
      st.T = nT; st.q = nq;

      // vŕtanie
      const depthNow = PAR + wk.PT - (tipK() - st.q - st.T);
      if (running && fi.onPlate && depthNow > 0.001) {
        let h = fi.h;
        if (!h) h = addHole(fi.px, fi.pz, fi.r);
        else if (h.r < fi.r - 1e-6) { h.r = fi.r; h.depth = 0; h.through = false; }
        if (depthNow > h.depth + 1e-5 && !h.through) {
          h.depth = Math.min(depthNow, wk.PT + 0.01);
          if (h.depth >= wk.PT) { h.through = true; say(`${L('Diera', 'Hole')} Ø${st.bit} mm ${L('je prevŕtaná naskrz.', 'is drilled through.')}`, 'info'); }
          showHole(h); st.drillT = t;
          chipAcc += dt * 40;
          while (chipAcc >= 1) {
            chipAcc -= 1; const a = Math.random() * TAU, s = 1 + Math.random() * 1.5;
            chipsP.spawn(v3(SX + Math.cos(a) * fi.r, st.T + PAR + wk.PT + 0.03, SZ + Math.sin(a) * fi.r), v3(Math.cos(a) * s, 1 + Math.random() * 1.6, Math.sin(a) * s), 3 + Math.random() * 2);
          }
        }
      }
      const drilling = t - st.drillT < 0.25;

      // pohyb skupín
      spG.position.y = NOSE - st.q; tbl.position.y = st.T;
      plateG.position.set(SX + st.u, 0, SZ + st.v);
      M.lamp.emissive.setHex(c.running && c.power ? 0x22dd55 : c.power ? 0x8a5a00 : 0x000000);
      chipsP.update(dt, (p) => (Math.abs(p.x - SX) < 1.6 && Math.abs(p.z - SZ) < 1.3 ? st.T : Math.abs(p.x) < 1.75 && p.z > -1.7 && p.z < 2.0 ? 0.5 : 0.02));

      ctrl.update(dt);
      insp.update(t, c);

      if (t - teleT > 0.1) {
        teleT = t;
        const h = floorInfo().h;
        setTele({
          rpm: st.rpm, quill: st.q * 100, table: (st.T - T0) * 100, depth: h ? Math.min(h.depth, wk.PT) * 100 : 0,
          vc: Math.PI * st.bit * st.rpm / 1000, drilling: drilling && running, holes: holes.length,
          msg: st.msg && st.msg.until > t ? st.msg : null,
        });
        if (Object.keys(pend).length) {
          const p = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
      }
      snd.update({ motor: st.rpm / 1400, cut: drilling && running ? 1 : 0 });
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); insp.dispose(); wi.dispose(); holeGeo.dispose(); disposeStage(); };
  }, []);

  const parts = drillParts();
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped ? { kind: 'info', text: L('Doska je zložená zo stola.', 'The plate is taken off the table.') }
    : tele.drilling ? { kind: 'run', text: `${L('Vŕtanie', 'Drilling')} Ø${ui.bit} mm – ${L('hĺbka', 'depth')} ${tele.depth.toFixed(1)} mm, vc ${tele.vc.toFixed(0)} m/min` }
    : tele.rpm > 15 ? { kind: 'run', text: L('Vreteno beží. Spusti vrták kľukou alebo posuvníkom pinoly.', 'The spindle is running. Lower the drill with the capstan or the quill slider.') }
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
    : { kind: 'idle', text: L('Stroj stojí. Zdvihni stôl k vrtáku a spusti vreteno.', 'The machine is stopped. Raise the table to the drill and start the spindle.') };
  const chips = [{ color: tele.rpm > 15 ? '#3ee06c' : '#8b8f89', text: tele.rpm > 15 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Vreteno stojí', 'Spindle stopped') }];
  if (tele.drilling) chips.push({ color: '#ffb340', text: L('Vŕtanie', 'Drilling') });
  if (tele.holes) chips.push({ color: '#7fb6ff', text: `${L('Diery', 'Holes')}: ${tele.holes}` });
  const rec = Math.round(25000 / (Math.PI * ui.bit));
  const stopped = !ui.running && tele.rpm <= 1;
  const setupTask = (task) => {
    const su = task.setup; if (!stopped) return;
    ['bL', 'bW', 'bT'].forEach((k) => set(k, su[k]));
    if (apiRef.current.newBlank) apiRef.current.newBlank();
    set('bit', su.bit); set('rpm', su.rpm); set('u', 0); set('v', 0);
  };
  const mholes = apiRef.current.measure ? apiRef.current.measure().holes : [];

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} />
      <aside className="panel"><fieldset className="machine-settings" disabled={ui.unclamped}>
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · vŕtačka', 'Simulator · drill')} title={L('Stĺpová vŕtačka', 'Pillar drill')}
          sub={L('Predloha: TOS SV16, vŕtanie do Ø16 mm v oceli. Mierka 1 : 100 mm.', 'Modelled after the TOS SV16, drilling up to Ø16 mm in steel. Scale 1 : 100 mm.')}
          rows={[[L('Hĺbka', 'Depth'), tele.depth.toFixed(2)], [L('Pinola', 'Quill'), tele.quill.toFixed(2)], [L('Stôl', 'Table'), tele.table.toFixed(2)]]}
          foot={[`n ${Math.round(tele.rpm)} ${RPM()}`, `vc ${tele.vc.toFixed(0)} m/min`]} status={statusMsg} />

        <TaskSection machine="vrtacka" tasks={DRILL_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'running', items: DRILL_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
          <button type="button" className={`btn-run ${ui.running ? 'stop' : 'start'}`}
            onClick={() => { if (!ui.running && !ui.power) set('power', true); set('running', !ui.running); }}>
            {ui.running ? L('■ Stop vretena', '■ Stop spindle') : L('▶ Štart vretena', '▶ Start spindle')}
          </button>
          <div className="mt-2"><Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => { const v = !ui.power; set('power', v); if (!v) set('running', false); }} /></div>
          <div className="mt-3"><StepSelect id="drpm" label={L('Otáčky vretena', 'Spindle speed')} unit={RPM()} values={DRILL_SPEEDS} value={ui.rpm} onChange={(v) => set('rpm', v)}
            locked={ui.running || tele.rpm > 1} lockNote={GEAR_LOCK()} /></div>
          <CutCalc D={ui.bit} mat="steel" speeds={DRILL_SPEEDS} rpm={ui.rpm} locked={!stopped} onApply={(n) => set('rpm', n)} what={L('Priemer vrtáka', 'Drill diameter')} />
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Vrták', 'Drill')}</h2>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {DRILL_SIZES.map((d) => <button key={d} type="button" className={`btn ${ui.bit === d ? 'active' : ''}`} aria-pressed={ui.bit === d} onClick={() => set('bit', d)}>Ø{d}</button>)}
          </div>
          <p className="text-xs muted">{L(`Pre oceľ je vhodná rezná rýchlosť 20 – 30 m/min: pre Ø${ui.bit} približne ${rec} ot/min. Vrták sa mení len pri stojacom vretene.`, `For steel use a cutting speed of 20 – 30 m/min: about ${rec} rpm for Ø${ui.bit}. Drills are changed only with the spindle stopped.`)}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Posuvy', 'Feeds')}</h2>
          <Slider id="dq" label={L('Výsuv pinoly', 'Quill extension')} unit="mm" min={0} max={100} step={0.5} value={ui.quill} actual={tele.quill} digits={1} onChange={(v) => set('quill', v)} />
          <Slider id="dt" label={L('Výška stola', 'Table height')} unit="mm" min={0} max={500} step={1} value={ui.table} actual={tele.table} onChange={(v) => set('table', v)} />
          <SegRow label={L('Zrýchlenie vŕtania', 'Drilling acceleration')} value={ui.timeScale} options={[[1, '1×'], [5, '5×'], [20, '20×']]} onChange={(v) => set('timeScale', v)} />
          <p className="text-xs muted">{L('Pri vŕtaní je posuv obmedzený na 0,12 mm/ot – rýchlejšie ako vrták reže, pinola nepôjde.', 'While drilling the feed is limited to 0.12 mm/rev – the quill will not go faster than the drill cuts.')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Poloha obrobku', 'Workpiece position')}</h2>
          <Slider id="du" label={L('Posun dosky X', 'Plate offset X')} unit="mm" min={-60} max={60} step={1} value={ui.u} onChange={(v) => set('u', v)} />
          <Slider id="dv" label={L('Posun dosky Y', 'Plate offset Y')} unit="mm" min={-50} max={50} step={1} value={ui.v} onChange={(v) => set('v', v)} />
          <p className="text-xs muted">{L('Podložky sú 70 mm vľavo a vpravo od stredu dosky – tam nevŕtaj naskrz.', 'The parallels are 70 mm left and right of the plate centre – do not drill through there.')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Meranie dier', 'Hole measurement')}</h2>
          {mholes.length ? (
            <table className="text-xs tnum w-full" style={{ borderCollapse: 'collapse' }}>
              <thead><tr className="muted"><th className="text-left font-semibold">Ø</th><th className="text-right font-semibold">{L('hĺbka', 'depth')}</th><th className="text-right font-semibold">X / Y {L('od stredu', 'from centre')}</th></tr></thead>
              <tbody>{mholes.map((h, i) => <tr key={i}><td>{h.d}</td><td className="text-right">{h.through ? L('naskrz', 'through') : `${h.depth.toFixed(1)} mm`}</td><td className="text-right">{h.x.toFixed(1)} / {(-h.z).toFixed(1)}</td></tr>)}</tbody>
            </table>
          ) : <p className="text-xs muted">{L('Na doske zatiaľ nie sú diery.', 'There are no holes in the plate yet.')}</p>}
          {mholes.length >= 2 && <p className="text-xs mt-2">{L('Rozostup posledných dvoch dier', 'Spacing of the last two holes')}: <b>{Math.hypot(mholes[mholes.length - 1].x - mholes[mholes.length - 2].x, mholes[mholes.length - 1].z - mholes[mholes.length - 2].z).toFixed(1)} mm</b></p>}
        </div>

        <BlankSection onApply={() => apiRef.current.newBlank && apiRef.current.newBlank()} applyLabel={L('Položiť novú dosku bez dier', 'Put down a new plate without holes')}>
          <Slider id="dbl" label={L('Dĺžka', 'Length')} unit="mm" min={160} max={240} step={10} value={ui.bL} onChange={(v) => set('bL', v)} />
          <Slider id="dbw" label={L('Šírka', 'Width')} unit="mm" min={80} max={150} step={10} value={ui.bW} onChange={(v) => set('bW', v)} />
          <Slider id="dbt" label={L('Hrúbka', 'Thickness')} unit="mm" min={10} max={40} step={5} value={ui.bT} onChange={(v) => set('bT', v)} />
        </BlankSection>

        <ExportSection machine="vrtacka" apiRef={apiRef} canStl={false} />
        <ViewSection apiRef={apiRef}
          views={[['celok', L('Celok', 'Overview')], ['rez', L('Detail vŕtania', 'Drilling detail')], ['spredu', L('Spredu', 'Front')], ['zhora', L('Zhora', 'Top')], ['bok', L('Kľuka pinoly', 'Capstan')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </fieldset></aside>
    </div>
  );
}

export { DrillSimulator, DRILL_SPEEDS, DRILL_SIZES };
export default DrillSimulator;
