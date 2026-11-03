import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL, RPM } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection } from '../ui/tools';
import { BAR_R, HZ_FEEDS, HZ_SPEEDS, WALL, boreStep, createHole, faceOf, findHole, holeInfo, horizChecks } from './horizMath';
import { HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, StepSelect, Toggle, ViewSection, GEAR_LOCK, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// HORIZONTÁLNA VŔTAČKA A FRÉZKA – vyvrtávanie (predloha TOS Varnsdorf, rad W)
// =====================================================================
// mierka 1 = 100 mm. Stojan vľavo, os vretena vodorovne v +X sveta v z = 0, výška Ys (vreteník po stojane).
// Stôl: sane Z (svet x, k vretenu) a stôl X (svet z), na ňom otočný stôl B so skriňovým odliatkom.
// Súradnica otvoru videná od vretena: a = −z stola (mm), y = výška osi nad spodkom skrine.
const HZ = { TTOP: 3.3, BD: 3.0, BW: 4.0, BH: 3.0, WL: WALL / 100, LB: 3.0, XQ: -4.15 };
const tipOf = (W) => HZ.XQ + 0.3 + W + HZ.LB - 0.25;   // nôž na konci tyče (svet x)
const horizParts = () => mkParts([
  ['stojan', 'Stojan', 'Column', 'Stojan s lôžkom', 'Column with bed', 'Pevný stojan nesie vreteník, ktorý sa po ňom posúva zvisle (os Y). Protiváha vo vnútri vyrovnáva hmotnosť vreteníka.', 'The fixed column carries the headstock, which moves vertically on it (Y axis). A counterweight inside balances the headstock.'],
  ['vretennik', 'Vreteník', 'Headstock', 'Vreteník s planžetou', 'Headstock with facing head', 'V dutom vretene sa vysúva vyvrtávacie vreteno (os W). Planžeta pred vreteníkom slúži na čelné sústruženie. Otáčky 20 – 800 ot/min, posuv vretena 0,05 – 0,25 mm/ot.', 'The boring spindle extends from the hollow main spindle (W axis). The facing head in front of the headstock is used for facing. Speeds 20 – 800 rpm, spindle feed 0.05 – 0.25 mm/rev.'],
  ['tyc', 'Vyvrtávacia tyč', 'Boring bar', 'Vyvrtávacia tyč s nožom', 'Boring bar with tool', 'Tyč Ø48 mm nesie nôž v mikrometrickej hlave – priemer vyvrtávania sa nastavuje po 0,005 mm. Čím dlhšie vyloženie, tým viac sa tyč pri reze prehne a otvor vyjde menší.', 'A Ø48 mm bar holds the tool in a micrometer head – the boring diameter is set in 0.005 mm steps. The longer the overhang, the more the bar deflects in the cut and the smaller the hole.'],
  ['stol', 'Stôl', 'Table', 'Krížový stôl s otočným stolom', 'Compound table with rotary table', 'Sane jazdia k vretenu (os Z), stôl priečne (os X). Otočný stôl (os B) sa aretuje po 90° – po otočení o 180° sa vyvrtá protiľahlá stena.', 'The saddle travels towards the spindle (Z axis), the table across (X axis). The rotary table (B axis) locks every 90° – after a 180° turn the opposite wall is bored.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Skriňový odliatok', 'Box casting', 'Liatinová skriňa 400 × 300 × 300 mm so stenami hrúbky 40 mm a predliatymi otvormi Ø60 v čelných stenách.', 'A cast-iron box 400 × 300 × 300 mm with 40 mm walls and cored Ø60 holes in the end walls.'],
  ['ovladanie', 'Ovládanie', 'Controls', 'Ovládací panel', 'Control panel', 'Hlavný vypínač, chod vretena, posuv vretena a aretácia otočného stola.', 'Main switch, spindle drive, spindle feed and rotary table lock.'],
]);
const BoxSketch = ({ two }) => (
  <svg viewBox="0 0 300 110" width="100%" role="img" aria-label="Ø80 H7" style={{ display: 'block' }}>
    <rect x="60" y="15" width="180" height="80" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.4" />
    <rect x="70" y="25" width="160" height="60" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 3" />
    <rect x="54" y="43" width="12" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" />
    {two && <rect x="234" y="43" width="12" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    <line x1="30" y1="55" x2="270" y2="55" stroke="currentColor" strokeDasharray="8 3 2 3" strokeWidth="0.8" />
    <text x="12" y="40" fontSize="10" fill="currentColor" fontFamily="var(--f-mono)">Ø80 H7</text>
    <text x="118" y="106" fontSize="10" fill="currentColor" fontFamily="var(--f-mono)">{two ? L('súosé ≤ 0,02', 'coaxial ≤ 0.02') : 'y = 150'}</text>
  </svg>
);
const HZ_TASKS = [
  { id: 'otvor', title: () => L('Otvor Ø80 H7 v čelnej stene', 'Ø80 H7 hole in the end wall'),
    desc: () => L('Skriňa s predliatym otvorom Ø60. Vyvrtaj otvor Ø80 H7 (80,000 – 80,030 mm) s osou v strede šírky (a = 0) a 150 mm nad spodkom skrine (±0,05 mm). Os nastav stolom X a vreteníkom Y podľa displeja, potom vyvrtávaj po prechodoch: hrubovanie po 5 – 6 mm na priemere, posledný prechod do 0,5 mm s krátkym vyložením – tyč sa menej prehne.', 'A box with a cored Ø60 hole. Bore a Ø80 H7 hole (80.000 – 80.030 mm) with its axis in the middle of the width (a = 0) and 150 mm above the bottom (±0.05 mm). Set the axis with table X and headstock Y according to the display, then bore in passes: roughing 5 – 6 mm on diameter, the last pass up to 0.5 mm with a short overhang – the bar deflects less.'),
    setup: { x: 0, y: 150, B: 0, dB: 66 },
    drawing: () => <BoxSketch />,
    labels: { size: () => L('Priemer Ø80 H7 (80,000 – 80,030)', 'Diameter Ø80 H7 (80.000 – 80.030)'), pos: () => L('Os a = 0, y = 150 ±0,05 mm', 'Axis a = 0, y = 150 ±0.05 mm'), ecc: () => L('Jedna os pre všetky prechody', 'One axis for all passes') } },
  { id: 'suose', title: () => L('Súosé otvory v protiľahlých stenách', 'Coaxial holes in opposite walls'),
    desc: () => L('Vyvrtaj Ø80 H7 v stene oproti vretenu, vysuň tyč, odsuň sane, otoč stôl o 180° a vyvrtaj protiľahlú stenu. Otvory musia byť súosé do 0,02 mm. Pozor: po otočení je os otvoru videná od vretena zrkadlovo – stôl X nastav na opačnú hodnotu.', 'Bore Ø80 H7 in the wall facing the spindle, withdraw the bar, move the saddle back, turn the table by 180° and bore the opposite wall. The holes must be coaxial within 0.02 mm. Note: after the turn the hole axis seen from the spindle is mirrored – set table X to the opposite value.'),
    setup: { x: 20, y: 150, B: 0, dB: 66 },
    drawing: () => <BoxSketch two />,
    labels: { size0: () => L('Stena 0: Ø80 H7', 'Wall 0: Ø80 H7'), size2: () => L('Stena 180°: Ø80 H7', 'Wall 180°: Ø80 H7'), coax: () => L('Súosovosť ≤ 0,02 mm', 'Coaxiality ≤ 0.02 mm') } },
].map((t) => ({ ...t, checks: (m) => horizChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const HZ_SAFETY = () => [
  L('Odliatok je upnutý upínkami k otočnému stolu, otočný stôl je zaaretovaný.', 'The casting is clamped to the rotary table, the rotary table is locked.'),
  L('Nôž v mikrometrickej hlave je dotiahnutý, tyč je upnutá vo vretene.', 'The tool in the micrometer head is tight, the bar is clamped in the spindle.'),
  L('Pred otočením stola je tyč vysunutá z obrobku.', 'The bar is withdrawn from the work before the table is turned.'),
  L('Mám okuliare, ruky mám mimo rotujúcej tyče a planžety.', 'I wear glasses and keep my hands away from the rotating bar and facing head.'),
];

function HorizSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { power: true, running: false, manual: false, light: true, rpm: 315, feed: 0.1, autoW: false, timeScale: 5, x: 0, z: 150, y: 120, w: 0, B: 0, bLock: true, dB: 66, measFace: 0 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, x: 0, z: 0, y: 0, w: 0, B: 0, depth: -1, cutting: false, msg: null, face: 0 });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { TTOP, BD, BW, BH, WL, LB, XQ } = HZ;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('mill');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x6e8a6a, 0x5a7457, 0x40553e),
      cast: std(0x6b6f72, 0.85, 0.35), hole: std(0x111214, 0.9, 0.1), bright: std(0xdfe4e8, 0.25, 0.9), chip: std(0x9aa2a8, 0.4, 0.8), lampShade: std(0x5a7457, 0.5, 0.2),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, pivotLever, handwheel } = kit;
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- stojan a lôžko ----------
    const colG = grp('stojan');
    box(colG, -10.2, -3.6, 0, 1.0, -3.2, 3.2, M.greenDark);
    box(colG, -9.6, -7.0, 1.0, 15.5, -2.2, 2.2, M.green);
    box(colG, -7.0, -6.85, 1.2, 15.0, -1.9, -1.5, M.ways); box(colG, -7.0, -6.85, 1.2, 15.0, 1.5, 1.9, M.ways);
    box(colG, -9.7, -6.9, 15.5, 15.9, -2.3, 2.3, M.greenDark);
    box(colG, -3.6, 7.8, 0, 1.2, -5.6, 5.6, M.greenDark);                          // lôžko stola
    [-1, 1].forEach((s) => box(colG, -3.4, 7.6, 1.2, 1.28, s * 3.2 - 0.3, s * 3.2 + 0.3, M.ways));
    // ---------- vreteník ----------
    const headY = grp('vretennik');
    box(headY, -7.0, -4.6, -1.4, 1.6, -1.6, 1.6, M.green);
    cylY(headY, 0.7, 0.7, 1.6, 3.0, -5.8, 0, M.green, 28);
    cylX(headY, 0.62, 0.62, -4.6, -4.3, 0, 0, M.greenDark, 32);
    const spin = new THREE.Group(); headY.add(spin);
    cylX(spin, 1.15, 1.15, -4.3, -4.15, 0, 0, M.steelDark, 40);                      // planžeta
    box(spin, -4.15, -4.05, 0.7, 1.0, -0.14, 0.14, M.steel);
    const quill = new THREE.Group(); spin.add(quill);
    cylX(quill, 0.42, 0.42, 0, 1, 0, 0, M.steel, 28);                                   // vyvrtávacie vreteno (mierka podľa W)
    const barG = grp('tyc', spin);
    cylX(barG, BAR_R / 100, BAR_R / 100, 0, LB, 0, 0, M.steel, 24);
    const head = new THREE.Group(); barG.add(head);
    box(head, LB - 0.45, LB - 0.05, -0.33, 0.33, -0.33, 0.33, M.steelDark);           // mikrometrická hlava
    const toolBit = box(head, LB - 0.32, LB - 0.18, 0, 1, -0.04, 0.04, M.bright);      // nôž (výška podľa priemeru)
    // ovládanie na vreteníku
    const pan = grp('ovladanie', headY);
    box(pan, -6.9, -5.2, -1.2, 0.5, 1.6, 1.68, M.panel);
    const pbtn = (x, y, m) => { const g = new THREE.Group(); g.position.set(x, y, 1.68); pan.add(g); cylZ(g, 0.11, 0.11, 0, 0.07, 0, 0, m, 20); hitProxy(g, 0.15, 0, 0, 0.05); return g; };
    const bStart = pbtn(-6.5, 0.15, M.btnGreen), bStop = pbtn(-6.1, 0.15, M.red);
    const lampRun = std(0x1f5f33, 0.4, 0.1); ball(pan, 0.06, -5.7, 0.15, 1.7, lampRun);
    const mainSw = new THREE.Group(); mainSw.position.set(-6.3, -0.6, 1.69); pan.add(mainSw);
    cylZ(mainSw, 0.17, 0.17, 0, 0.06, 0, 0, M.black, 24); box(mainSw, -0.045, 0.045, -0.2, 0.2, 0.06, 0.16, M.red);
    cylZ(pan, 0.14, 0.12, 1.6, 1.72, -5.4, -0.6, M.black, 20);
    const levW = pivotLever(pan, -5.4, -0.6, 1.72, 0.36, 1.2);                          // posuv vretena W
    const wW = handwheel(headY, 0.38, -4.9, 1.0, 1.8, 'z', 0.22);                      // koleso vysúvania vretena
    const wY = handwheel(colG, 0.5, -8.3, 3.0, 2.4, 'z', 0.3);                          // zdvih vreteníka
    cylZ(colG, 0.1, 0.1, 2.2, 2.4, -8.3, 3.0, M.steel, 12);
    // ---------- sane, stôl, otočný stôl ----------
    const sad = grp('stol');
    box(sad, -2.4, 2.4, 1.28, 2.0, -4.6, 4.6, M.green);
    const wZ = handwheel(sad, 0.45, 2.7, 1.6, 3.8, 'x', 0.26);
    const tbl = new THREE.Group(); sad.add(tbl);
    box(tbl, -2.2, 2.2, 2.0, 2.8, -2.4, 2.4, M.green);
    const wX = handwheel(tbl, 0.42, 0, 2.4, 2.7, 'z', 0.25);
    const turn = new THREE.Group(); turn.position.y = 2.8; tbl.add(turn);
    cylY(turn, 2.1, 2.1, 0, 0.5, 0, 0, M.steelDark, 64);
    for (let k = 0; k < 4; k++) { const s2 = add(turn, new THREE.BoxGeometry(3.6, 0.012, 0.12), M.black, 0, 0.502, 0); s2.rotation.y = k * Math.PI / 4; }
    box(tbl, 2.15, 2.25, 2.85, 3.25, -0.03, 0.03, M.red);                              // ryska otočného stola
    const bLockG = new THREE.Group(); bLockG.position.set(1.6, 2.4, 2.4); tbl.add(bLockG);
    const levB = pivotLever(bLockG, 0, 0, 0, 0.4, 1.2);                                // aretácia otočného stola
    // ---------- obrobok: dutá skriňa ----------
    const work = grp('obrobok', turn);
    const T = TTOP - 2.8, w = WL;
    box(work, -BD / 2, BD / 2, T, T + w, -BW / 2, BW / 2, M.cast);
    box(work, -BD / 2, BD / 2, T + BH - w, T + BH, -BW / 2, BW / 2, M.cast);
    box(work, -BD / 2, BD / 2, T + w, T + BH - w, -BW / 2, -BW / 2 + w, M.cast); box(work, -BD / 2, BD / 2, T + w, T + BH - w, BW / 2 - w, BW / 2, M.cast);
    // čelné steny (x = ±BD/2) – sú „rozdelené“ okolo otvoru, otvor je tmavý valec
    const endWall = (s) => {
      const x0 = s < 0 ? -BD / 2 : BD / 2 - w;
      const ring = new THREE.Shape(); ring.moveTo(-BW / 2 + w, T + w); ring.lineTo(BW / 2 - w, T + w); ring.lineTo(BW / 2 - w, T + BH - w); ring.lineTo(-BW / 2 + w, T + BH - w); ring.closePath();
      const holeP = new THREE.Path(); holeP.absarc(0, T + BH / 2, 0.52, 0, TAU, true); ring.holes.push(holeP);
      const g = new THREE.ExtrudeGeometry(ring, { depth: w, bevelEnabled: false, curveSegments: 24 }); g.rotateY(Math.PI / 2); g.translate(x0, 0, 0);
      add(work, g, M.cast);
    };
    endWall(-1); endWall(1);
    // otvory: pre každú čelnú stenu tmavý valec s polomerom otvoru a svetlý okraj po vyvrtaní
    const holeGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true); holeGeo.rotateZ(Math.PI / 2);
    const plugGeo = new THREE.RingGeometry(0.5, 1, 40); plugGeo.rotateY(Math.PI / 2);
    let holes = [];
    const vis = [];
    const faceLocal = (f) => { const b = f * Math.PI / 2; return { d: v3(Math.cos(b), 0, Math.sin(b)), e: v3(-Math.sin(b), 0, Math.cos(b)), half: f % 2 ? BW / 2 : BD / 2 }; };
    const makeWork = () => {
      vis.forEach((m) => { work.remove(m.cyl); work.remove(m.plug); }); vis.length = 0;
      holes = [createHole(0, 0, 150, 30), createHole(2, 0, 150, 30)];
      holes.forEach((h) => {
        const cyl = new THREE.Mesh(holeGeo, M.hole), plug = new THREE.Mesh(plugGeo, M.cast);
        work.add(cyl); work.add(plug); vis.push({ h, cyl, plug });
      });
      refreshHoles();
    };
    const refreshHoles = () => vis.forEach(({ h, cyl, plug }) => {
      const fl = faceLocal(h.face), r = holeInfo(h).dMin / 200, c0 = fl.d.clone().multiplyScalar(-(fl.half - w / 2)).addScaledVector(fl.e, h.ca / 100);
      cyl.position.set(c0.x, T + h.cy / 100, c0.z); cyl.rotation.y = -h.face * Math.PI / 2; cyl.scale.set(w + 0.004, r, r);
      cyl.material = h.bored ? M.bright : M.hole;
      // výplň medzi otvorom Ø84 v stene a skutočným otvorom
      const p0 = fl.d.clone().multiplyScalar(-(fl.half + 0.002)).addScaledVector(fl.e, h.ca / 100);
      plug.position.set(p0.x, T + BH / 2, p0.z); plug.rotation.y = -h.face * Math.PI / 2; plug.scale.setScalar(0.52);
      if (plug.geometry !== plugGeo) plug.geometry.dispose();
      plug.geometry = new THREE.RingGeometry(Math.min(0.98, r / 0.52), 1, 40); plug.geometry.rotateY(Math.PI / 2);
    });
    makeWork();
    const chipsP = createParticles(scene, new THREE.BoxGeometry(0.05, 0.012, 0.08), M.chip, 160);
    const lamp = createLamp(scene, colG, kit, M, { base: v3(-7.2, 15.9, 1.8), elbow: v3(-5.2, 17.0, 3.2), head: v3(-2.5, 10.0, 3.6), aim: v3(0, TTOP + 1.5, 0), angle: 0.55, power: 2.6 });

    // ---------- stav ----------
    const st = { x: c.x / 100, z: c.z / 100, ys: TTOP + c.y / 100, w: c.w / 100, B: c.B, rpm: 0, spin: 0, cutT: -9, msg: null, rb: c.dB / 200 };
    let t = 0, last = performance.now(), teleT = 0, chipAcc = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 3 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const boxCx = (z = st.z) => z;                                               // stred skrine v svete x = sane
    // poloha noža voči skrini pozdĺž osi: s (jednotky) od stredu; stena začína v s = −half
    const sOf = (W = st.w, z = st.z) => tipOf(W) - boxCx(z);
    const aOf = (x = st.x) => -x * 100, yOf = (ys = st.ys) => (ys - TTOP) * 100;
    const halfOf = (B = st.B) => { const f = faceOf(B); return f < 0 ? Math.hypot(BD, BW) / 2 : (f % 2 ? BW / 2 : BD / 2); };
    const barIn = () => sOf() > -Math.hypot(BD, BW) / 2 - 0.05;                  // tyč v dosahu skrine (bráni otáčaniu stola)
    const ext = () => (0.3 + st.w + LB) * 100;
    const depthMm = (s, B = st.B) => (s + halfOf(B)) * 100;

    // ---------- pohľady ----------
    const anchors = {
      stojan: () => v3(-8.3, 13.5, 2.2), vretennik: () => v3(-5.8, st.ys + 3.1, 0), tyc: () => v3(tipOf(st.w) - 1.2, st.ys + 0.45, 0),
      stol: () => v3(st.z + 2.4, 2.0, st.x + 4.6), obrobok: () => v3(st.z, TTOP + BH + 0.1, st.x), ovladanie: () => v3(-6.0, st.ys + 0.7, 1.7),
    };
    const views = {
      celok: () => [[6, 13, 21], [-1.5, 5, 0]],
      rez: () => [[st.z - BD / 2 - 2.5, st.ys + 2.4, st.x + 4.2], [st.z - BD / 2, st.ys, st.x], true],
      zhora: () => [[-1, 24, 1], [-1, 3, 0], true],
      panel: () => [[-4.5, st.ys + 1.5, 7.5], [-6, st.ys - 0.3, 1.6], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed(), onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);
    const holeData = () => holes.map((h) => ({ ...holeInfo(h), face: h.face, r: h.r, ca: h.ca, cy: h.cy, bored: h.bored, ecc: h.ecc }));
    apiRef.current.measure = () => ({ holes: holes.map((h) => ({ face: h.face, r: h.r, ca: h.ca, cy: h.cy, bored: h.bored, ecc: h.ecc, core: h.core })), info: holeData() });
    apiRef.current.save = () => ({ v: 1, holes: holes.map((h) => ({ face: h.face, r: Array.from(h.r), ca: h.ca, cy: h.cy, bored: h.bored, ecc: h.ecc })) });
    apiRef.current.load = (r) => {
      if (!r || r.v !== 1 || barIn()) return false;
      makeWork(); r.holes.forEach((s, i) => { const h = holes[i]; if (!h) return; h.r.set(s.r); h.ca = s.ca; h.cy = s.cy; h.bored = s.bored; h.ecc = s.ecc; }); refreshHoles(); return true;
    };
    apiRef.current.snapshot = snapshot;
    apiRef.current.newBlank = () => {
      if (barIn()) { say(L('Najprv vysuň tyč a odsuň sane od obrobku.', 'Withdraw the bar and move the saddle back first.')); return false; }
      makeWork(); say(L('Na otočnom stole je nový odliatok s predliatymi otvormi Ø60.', 'A new casting with cored Ø60 holes is on the rotary table.'), 'info'); return true;
    };

    // ---------- ovládanie ----------
    const needPower = (fn) => () => { if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.')); else fn(); };
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0), onSet: (i) => { push('power', i === 1); if (!i) push('running', false); }, read: () => (c.power ? 'I' : '0') }, mainSw);
    ctrl.reg({ type: 'button', label: LL('ŠTART vretena', 'Spindle START'), hint: LL('Spustí vreteno.', 'Starts the spindle.'), action: needPower(() => push('running', true)) }, bStart);
    ctrl.reg({ type: 'button', label: LL('STOP vretena', 'Spindle STOP'), hint: LL('Zastaví vreteno aj posuv.', 'Stops the spindle and the feed.'), action: () => { push('running', false); push('autoW', false); } }, bStop);
    ctrl.reg({ type: 'lever', angles: [0.4, -0.4], minR: 0.2, label: LL('Páka posuvu vretena W', 'Spindle feed lever W'), hint: LL('Dole = vreteno sa vysúva zvoleným posuvom na otáčku.', 'Down = the spindle extends at the selected feed per revolution.'),
      getIdx: () => (c.autoW ? 1 : 0), onSet: (i) => push('autoW', i === 1), read: () => (c.autoW ? `${c.feed} ${L('mm/ot', 'mm/rev')}` : L('vypnutý', 'off')) }, levW);
    ctrl.reg({ type: 'lever', angles: [0.5, -0.5], minR: 0.2, label: LL('Aretácia otočného stola', 'Rotary table lock'), hint: LL('Hore = zaaretovaný. Otáča sa len uvoľnený a s tyčou mimo obrobku.', 'Up = locked. It turns only released and with the bar out of the work.'),
      getIdx: () => (c.bLock ? 0 : 1), onSet: (i) => push('bLock', i === 0), read: () => `B ${st.B.toFixed(0)}° · ${c.bLock ? L('zaaretovaný', 'locked') : L('uvoľnený', 'released')}` }, levB);
    const wheel = (k, lo, hi, pitch, label, hint, mesh, inc = -1) => ctrl.reg({ type: 'wheel', minR: 0.3, inc, label, hint, turn: (d) => push(k, clamp(Math.round((c[k] - d * pitch / TAU) * 100) / 100, lo, hi)), read: () => `${c[k].toFixed(2)} mm` }, mesh);
    wheel('x', -250, 250, 5, LL('Koleso stola X', 'Table X handwheel'), LL('Priečny posun stola. 1 otáčka = 5 mm.', 'Table cross travel. 1 turn = 5 mm.'), wX);
    wheel('z', -50, 350, 5, LL('Koleso saní Z', 'Saddle Z handwheel'), LL('Sane k vretenu a od neho. 1 otáčka = 5 mm.', 'Saddle to and from the spindle. 1 turn = 5 mm.'), wZ);
    wheel('y', 30, 470, 5, LL('Koleso vreteníka Y', 'Headstock Y handwheel'), LL('Zdvih vreteníka po stojane. 1 otáčka = 5 mm.', 'Headstock elevation. 1 turn = 5 mm.'), wY, 1);
    wheel('w', 0, 500, 10, LL('Koleso vysúvania vretena W', 'Spindle W handwheel'), LL('Vysúva vyvrtávacie vreteno. 1 otáčka = 10 mm.', 'Extends the boring spindle. 1 turn = 10 mm.'), wW, 1);
    ctrl.reg({ type: 'button', still: true, label: LL('Pracovná lampa', 'Work lamp'), hint: LL('Klik zapne alebo vypne lampu.', 'Click to switch the lamp on or off.'), action: () => push('light', !c.light) }, lamp.shade);
    apiRef.current.indexB = (b) => {
      if (c.bLock) { say(L('Otočný stôl je zaaretovaný – uvoľni aretáciu.', 'The rotary table is locked – release the lock.')); return; }
      if (barIn()) { say(L('Tyč je v dosahu obrobku – vysuň vreteno W a odsuň sane Z, inak by skriňa narazila do tyče.', 'The bar is within reach of the work – retract W and move the saddle Z back, otherwise the box would hit the bar.')); return; }
      push('B', ((b % 360) + 360) % 360);
    };
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      if (!c.power && c.running) push('running', false);
      // nastavenie priemeru vyvrtávania – len pri stojacom vretene
      if (Math.abs(c.dB / 200 - st.rb) > 1e-9) {
        if (st.rpm > 1) { sayOnce('dB', true, L('Mikrometrická hlava sa nastavuje len pri stojacom vretene.', 'The micrometer head is set only with the spindle stopped.')); c.dB = st.rb * 200; pend.dB = c.dB; }
        else { flags.dB = false; st.rb = clamp(c.dB, 60, 100) / 200; }
      }
      st.rpm = approach(st.rpm, c.running && c.power ? c.rpm : 0, 600 * dt);
      const running = st.rpm > 5;
      st.spin += (st.rpm > 0 ? 3 * st.rpm / (st.rpm + 300) : 0) * TAU * dt; spin.rotation.x = st.spin;
      // otočný stôl
      const bT = c.B;
      if (Math.abs(bT - st.B) > 1e-6) {
        if (c.bLock || barIn()) { c.B = st.B; pend.B = st.B; }
        else { let d = ((bT - st.B + 540) % 360) - 180; st.B = (st.B + Math.sign(d) * Math.min(Math.abs(d), 30 * dt) + 360) % 360; }
      }
      // automatický posuv vretena W
      if (c.autoW && running) { c.w = Math.min(500, c.w + c.feed * st.rpm / 60 * c.timeScale * dt); pend.w = Math.round(c.w * 100) / 100; if (c.w >= 500) { c.autoW = false; pend.autoW = false; } }
      // pohyby s kontrolou: v otvore sa nepohne X, Y; pozdĺž osi rez len za chodu so stĺpaním posuvom
      const xN = approach(st.x, clamp(c.x, -250, 250) / 100, 0.8 * dt), yN = approach(st.ys, TTOP + clamp(c.y, 30, 470) / 100, 0.6 * dt);
      const zN = approach(st.z, clamp(c.z, -50, 350) / 100, 0.8 * dt), wN = approach(st.w, clamp(c.w, 0, 500) / 100, 0.6 * dt);
      const s0 = sOf(), sN = sOf(wN, zN), half = halfOf(), f = faceOf(st.B);
      if (xN !== st.x || yN !== st.ys) {
        if (s0 > -half - 0.01 && f >= 0 && s0 < half) { sayOnce('inhole', true, L('Tyč je v otvore – stôl X ani vreteník Y sa nepohnú. Najprv vysuň tyč (W, Z).', 'The bar is in the hole – table X and headstock Y will not move. Withdraw the bar first (W, Z).')); c.x = st.x * 100; pend.x = c.x; c.y = yOf(); pend.y = c.y; }
        else { flags.inhole = false; st.x = xN; st.ys = yN; }
      }
      let sGo = sN, cut = false;
      if (sN > s0 && sN > -half - 0.002) {
        const a = aOf(), y = yOf(), h = f >= 0 ? findHole(holes, f, a, y) : null;
        const z0 = Math.max(0, depthMm(s0)), z1 = depthMm(sN);
        if (f < 0) { sGo = Math.min(sN, -half - 0.005); sayOnce('bidx', true, L('Otočný stôl nie je v aretovanej polohe po 90° – vyvrtávať sa nedá.', 'The rotary table is not at a locked 90° position – boring is not possible.')); }
        else if (z0 < WALL) {
          const fr = c.feed * st.rpm / 60 * c.timeScale * dt / 100, lim = running ? s0 + fr : s0;
          let need = false;
          if (h) { const off = Math.hypot(a - h.ca, y - h.cy); for (let i = Math.max(0, Math.floor(z0)); i <= Math.min(WALL - 1, Math.floor(z1)); i++) if (st.rb * 100 > h.r[i] - off + 1e-6 || h.r[i] - off < BAR_R + 0.5) need = true; }
          if (!h) { sGo = Math.min(sN, -half - 0.002); sayOnce('solid', true, L('Vyvrtávacia tyč narazila do plnej steny – vyvrtáva sa len predliaty otvor. Nastav os nad otvor (X, Y).', 'The boring bar hit the solid wall – only a cored hole can be bored. Set the axis over the hole (X, Y).'), 'danger'); }
          else if (need && !running) { sGo = Math.min(sN, s0); sayOnce('stopcut', true, L('Nôž sa dotkol steny otvoru – pri stojacom vretene nereže. Spusti vreteno.', 'The tool touched the hole wall – it does not cut with the spindle stopped. Start the spindle.'), 'warn'); }
          else if (need) {
            sGo = Math.min(sN, lim);
            const r = boreStep(h, a, y, st.rb * 100, z0, Math.min(WALL, depthMm(sGo)), ext());
            if (r.crash) {
              sGo = s0; push('running', false); push('autoW', false);
              say(r.crash === 'bar' ? L('Tyč sa do otvoru nezmestí – os je príliš mimo stredu predliateho otvoru.', 'The bar does not fit the hole – the axis is too far off the cored hole centre.') : r.crash === 'chatter' ? L(`Príliš veľký záber (${r.ap.toFixed(1).replace('.', ',')} mm) – tyč sa rozchvela, vreteno zastavené. Zmenši priemer v hlave a vyvrtávaj po prechodoch.`, `Cut too deep (${r.ap.toFixed(1)} mm) – the bar chattered, spindle stopped. Reduce the head diameter and bore in passes.`) : L('Náraz.', 'Crash.'), 'danger');
            } else if (r.removed > 0) { cut = true; st.cutT = t; }
          }
        } else if (sN > half - WL - 0.05) { sGo = Math.min(sN, half - WL - 0.05); sayOnce('far', true, L('Nôž by narazil do protiľahlej steny skrine.', 'The tool would hit the opposite wall of the box.'), 'warn'); }
      }
      if (sGo < sN - 1e-9) {
        // obmedzenie posuvu: najprv sa zastaví W, potom sane Z
        const dW = wN - st.w, dZ = st.z - zN, need = sN - sGo;
        if (dW > 0) { const take = Math.min(dW, need); st.w = wN - take; st.z = zN + Math.max(0, need - take); } else { st.w = wN; st.z = zN + need; }
        c.w = st.w * 100; pend.w = Math.round(c.w * 100) / 100; if (dZ > 0) { c.z = st.z * 100; pend.z = Math.round(c.z * 100) / 100; }
      } else { st.w = wN; st.z = zN; }
      if (cut) {
        chipAcc += dt * 35; refreshHoles();
        while (chipAcc >= 1) { chipAcc -= 1; const a = Math.random() * TAU; chipsP.spawn(v3(tipOf(st.w) - 0.2, st.ys + Math.cos(a) * st.rb, Math.sin(a) * st.rb), v3(-0.5 - Math.random(), -0.5 - Math.random(), (Math.random() - 0.5) * 1.5), 3); }
      }
      const cutting = t - st.cutT < 0.3;
      // pohyb skupín
      headY.position.y = st.ys; quill.position.x = XQ; quill.children[0].position.x = (0.3 + st.w) / 2; quill.children[0].scale.x = Math.max(0.01, 0.3 + st.w);
      barG.position.x = XQ + 0.3 + st.w; toolBit.scale.y = st.rb - BAR_R / 100 + 0.02; toolBit.position.y = BAR_R / 100 - 0.02 + (st.rb - BAR_R / 100 + 0.02) / 2;
      sad.position.x = st.z; tbl.position.z = st.x; turn.rotation.y = st.B * Math.PI / 180;
      lampRun.emissive.setHex(running ? 0x22dd55 : 0);
      lamp.update(c.light);
      chipsP.update(dt, (q) => (Math.abs(q.x - st.z) < 2.2 && Math.abs(q.z - st.x) < 2.4 ? TTOP : 1.2));
      ctrl.update(dt); insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        const s = sOf(), dm = depthMm(s);
        setTele({ rpm: st.rpm, x: aOf(), z: st.z * 100, y: yOf(), w: st.w * 100, B: st.B, depth: faceOf(st.B) >= 0 && s > -half - 0.5 ? dm : -1, cutting: cutting && running, face: faceOf(st.B), msg: st.msg && st.msg.until > t ? st.msg : null });
        if (Object.keys(pend).length) { const q = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]); setUi((u) => ({ ...u, ...q })); }
      }
      snd.update({ motor: st.rpm / 800, cut: cutting && running ? 0.8 : 0 });
      renderer.render(scene, camera);
    };
    try { if (/[?&]debug/.test(window.location.search)) window.__horiz = { st, c, holes: () => holes }; } catch (err) { /* ignorované */ }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); insp.dispose(); try { if (window.__horiz && window.__horiz.st === st) delete window.__horiz; } catch (err) { /* ignorované */ } disposeStage(); };
  }, []);

  const parts = horizParts();
  const m = apiRef.current.measure ? apiRef.current.measure() : null;
  const f3 = (x) => L(x.toFixed(3).replace('.', ','), x.toFixed(3));
  const stopped = !ui.running && tele.rpm <= 1;
  const statusMsg = tele.msg ? tele.msg
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
    : tele.cutting ? { kind: 'run', text: `${L('Vyvrtávanie', 'Boring')} Ø${f3(ui.dB)} – ${L('hĺbka', 'depth')} ${Math.max(0, tele.depth).toFixed(1)} mm` }
    : tele.rpm > 5 ? { kind: 'run', text: L('Vreteno beží. Posúvaj vreteno W (alebo sane Z) do otvoru.', 'The spindle is running. Feed the spindle W (or the saddle Z) into the hole.') }
    : { kind: 'idle', text: L('Nastav os otvoru stolom X a vreteníkom Y, priemer v mikrometrickej hlave a spusti vreteno.', 'Set the hole axis with table X and headstock Y, the diameter in the micrometer head and start the spindle.') };
  const chips = [{ color: tele.rpm > 5 ? '#3ee06c' : '#8b8f89', text: tele.rpm > 5 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Vreteno stojí', 'Spindle stopped') }];
  chips.push({ color: ui.bLock ? '#7fb6ff' : '#ff8a1f', text: `B ${Math.round(tele.B)}°${ui.bLock ? '' : L(' uvoľnený', ' released')}` });
  if (tele.cutting) chips.push({ color: '#ffb340', text: L('Vyvrtávanie', 'Boring') });
  const setupTask = (task) => {
    if (!stopped) return;
    set('w', 0); set('z', 150); set('autoW', false);
    setTimeout(() => { if (apiRef.current.newBlank) apiRef.current.newBlank(); Object.entries(task.setup).forEach(([k, v]) => set(k, v)); }, 2500);
  };
  const vc = Math.PI * ui.dB * tele.rpm / 1000;
  const faceName = (f) => (f === 0 ? L('stena 0°', 'wall 0°') : f === 2 ? L('stena 180°', 'wall 180°') : `${f * 90}°`);

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} canUnclamp={false}
        tips={[L('Os otvoru sa nastavuje stolom X a vreteníkom Y; s tyčou v otvore sa tieto osi nepohnú.', 'The hole axis is set with table X and headstock Y; with the bar in the hole these axes do not move.'),
          L('Vyloženie tyče zväčšuje priehyb – na posledný prechod prisuň radšej sane Z a vreteno W nechaj krátke.', 'The bar overhang increases deflection – for the last pass bring the saddle Z closer and keep the spindle W short.'),
          L('Po otočení stola o 180° je os videná od vretena zrkadlová: X nastav na opačnú hodnotu.', 'After turning the table by 180° the axis seen from the spindle is mirrored: set X to the opposite value.')]} />
      <aside className="panel">
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · horizontálka', 'Simulator · horizontal borer')} title={L('Horizontálna vŕtačka a frézka', 'Horizontal boring mill')}
          sub={L('Predloha: horizontálky TOS Varnsdorf (rad W) – vreteník na stojane, vysúvacie vyvrtávacie vreteno, krížový a otočný stôl.', 'Modelled after TOS Varnsdorf horizontal boring mills (W series) – headstock on the column, extending boring spindle, compound and rotary table.')}
          rows={[['X (a)', tele.x.toFixed(2)], ['Y', tele.y.toFixed(2)], ['Z', tele.z.toFixed(1)], ['W', tele.w.toFixed(1)]]}
          foot={[`B ${Math.round(tele.B)}° · ${tele.depth >= 0 ? `${L('hĺbka', 'depth')} ${tele.depth.toFixed(1)} mm` : L('mimo obrobku', 'clear of the work')}`, `Ø${ui.dB.toFixed(3)} · vc ${vc.toFixed(0)} m/min`]} status={statusMsg} />

        <TaskSection machine="horizontalka" tasks={HZ_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'running', items: HZ_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
          <button type="button" className={`btn-run ${ui.running ? 'stop' : 'start'}`} onClick={() => { if (!ui.running && !ui.power) set('power', true); set('running', !ui.running); if (ui.running) set('autoW', false); }}>
            {ui.running ? L('■ Stop vretena', '■ Stop spindle') : L('▶ Štart vretena', '▶ Start spindle')}
          </button>
          <div className="mt-2">
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
            <Toggle on={ui.light} label={L('Pracovné osvetlenie', 'Work light')} onClick={() => set('light', !ui.light)} />
          </div>
          <div className="mt-3"><StepSelect id="hrpm" label={L('Otáčky vretena', 'Spindle speed')} unit={RPM()} values={HZ_SPEEDS} value={ui.rpm} onChange={(v) => set('rpm', v)} locked={ui.running || tele.rpm > 1} lockNote={GEAR_LOCK()} /></div>
          <p className="text-xs muted">{L(`Spekaný karbid v liatine 60 – 100 m/min: pre Ø${Math.round(ui.dB)} približne ${Math.round(80000 / (Math.PI * ui.dB))} ot/min.`, `Carbide in cast iron 60 – 100 m/min: about ${Math.round(80000 / (Math.PI * ui.dB))} rpm for Ø${Math.round(ui.dB)}.`)}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Osi', 'Axes')}</h2>
          <Slider id="hx" label={L('Stôl X (os otvoru a)', 'Table X (hole axis a)')} unit="mm" min={-250} max={250} step={0.01} value={ui.x} actual={tele.x * -1} digits={2} onChange={(v) => set('x', v)} />
          <Slider id="hy" label={L('Vreteník Y (výška osi nad spodkom skrine)', 'Headstock Y (axis height above the box bottom)')} unit="mm" min={30} max={470} step={0.01} value={ui.y} actual={tele.y} digits={2} onChange={(v) => set('y', v)} />
          <div className="flex flex-wrap gap-2 mb-2">{[['x', -0.1], ['x', 0.1], ['y', -0.1], ['y', 0.1], ['y', -0.01], ['y', 0.01]].map(([k, d], i) => <button key={i} type="button" className="btn" onClick={() => set(k, Math.round((ui[k] + d) * 100) / 100)}>{k.toUpperCase()} {d > 0 ? '+' : ''}{d}</button>)}</div>
          <Slider id="hz" label={L('Sane Z (k vretenu)', 'Saddle Z (towards the spindle)')} unit="mm" min={-50} max={350} step={0.5} value={ui.z} actual={tele.z} digits={1} onChange={(v) => set('z', v)} />
          <Slider id="hw" label={L('Vreteno W (výsuv)', 'Spindle W (extension)')} unit="mm" min={0} max={500} step={0.5} value={ui.w} actual={tele.w} digits={1} onChange={(v) => set('w', v)} />
          <Toggle on={ui.autoW} label={L('Automatický posuv vretena W', 'Spindle W power feed')} onClick={() => set('autoW', !ui.autoW)} />
          <SegRow label={L('Posuv mm/ot', 'Feed mm/rev')} value={ui.feed} options={HZ_FEEDS.map((x) => [x, String(x).replace('.', ',')])} onChange={(v) => set('feed', v)} />
          <SegRow label={L('Zrýchlenie', 'Acceleration')} value={ui.timeScale} options={[[1, '1×'], [5, '5×'], [20, '20×']]} onChange={(v) => set('timeScale', v)} />
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Mikrometrická hlava a otočný stôl', 'Micrometer head and rotary table')}</h2>
          <Slider id="hd" label={L('Priemer vyvrtávania', 'Boring diameter')} unit="mm" min={60} max={100} step={0.005} value={ui.dB} digits={3} onChange={(v) => set('dB', v)} disabled={!stopped} />
          <div className="flex flex-wrap gap-2 mb-2">{[1, 2, 5, 0.5, 0.1, 0.01, 0.005].map((x) => <button key={x} type="button" className="btn" disabled={!stopped} onClick={() => set('dB', clamp(Math.round((ui.dB + x) * 1000) / 1000, 60, 100))}>+{L(String(x).replace('.', ','), String(x))}</button>)}</div>
          <Toggle on={ui.bLock} label={L('Otočný stôl zaaretovaný', 'Rotary table locked')} onClick={() => set('bLock', !ui.bLock)} />
          <div className="flex flex-wrap gap-2">{[0, 90, 180, 270].map((b) => <button key={b} type="button" className={`btn ${Math.round(tele.B) === b ? 'active' : ''}`} onClick={() => apiRef.current.indexB && apiRef.current.indexB(b)}>B {b}°</button>)}</div>
          <p className="text-xs muted mt-2">{L('Otáča sa len uvoľnený stôl a s tyčou mimo dosahu skrine (vysuň W, odsuň Z).', 'The table turns only when released and with the bar out of reach of the box (retract W, move Z back).')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Meranie otvorov', 'Hole measurement')}</h2>
          {m && m.info.length ? (
            <table className="text-xs tnum w-full" style={{ borderCollapse: 'collapse' }}>
              <thead><tr className="muted"><th className="text-left font-semibold">{L('stena', 'wall')}</th><th className="text-right font-semibold">Ø min – max</th><th className="text-right font-semibold">a / y</th></tr></thead>
              <tbody>{m.info.map((h, i) => <tr key={i}><td>{faceName(h.face)}</td><td className="text-right">{h.bored ? `${h.dMin.toFixed(3)} – ${h.dMax.toFixed(3)}` : `${L('predliaty', 'cored')} Ø${h.dMin.toFixed(0)}`}</td><td className="text-right">{h.a.toFixed(2)} / {h.y.toFixed(2)}{h.ecc > 0.001 ? ` (e ${h.ecc.toFixed(3)})` : ''}</td></tr>)}</tbody>
            </table>
          ) : null}
          <p className="text-xs muted mt-2">{L('Priemer otvoru vyjde o priehyb tyče menší ako nastavený: chyba ≈ 0,002 · záber · (vyloženie / 100 mm)².', 'The hole comes out smaller than set by the bar deflection: error ≈ 0.002 · cut depth · (overhang / 100 mm)².')}</p>
          <button type="button" className="btn mt-2" onClick={() => apiRef.current.newBlank && apiRef.current.newBlank()}>{L('Nový odliatok', 'New casting')}</button>
        </div>

        <ExportSection machine="horizontalka" apiRef={apiRef} canStl={false} />
        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['rez', L('Detail otvoru', 'Hole detail')], ['zhora', L('Zhora', 'Top')], ['panel', L('Ovládanie', 'Controls')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

export { HorizSimulator };
export default HorizSimulator;
