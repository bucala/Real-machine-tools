import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL, RPM } from '../core/i18n';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { createSound } from '../core/sound';
import { CutCalc, ExportSection, TaskSection } from '../ui/tools';
import { RadialFlangeDrawing, RadialRectDrawing } from '../ui/sketch';
import { RADIAL_FEEDS, RADIAL_SIZES, RADIAL_SPEEDS, RD, radialChecks, spindleXZ } from './radialMath';
import { BlankSection, GEAR_LOCK, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, StepSelect, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// RADIÁLNA VŔTAČKA TOS – obrobok stojí, k diere sa ide otočením ramena a posunom vreteníka
// =====================================================================
// mierka 1 = 100 mm. Stĺp v (RD.CX, RD.CZ); rameno sa otáča okolo stĺpa (α) a posúva po ňom zvisle (H = spodok ramena);
// vreteník jazdí po ramene (R = vyloženie od osi stĺpa), vreteno je pred ramenom (RD.SZO).
const RA = { PX: 5.1, PZ: 0, CUBE: 4.7, PAR: 0.2, NOSE: -2.8, HMIN: 11.2, HMAX: 16.5, RMIN: 3.2, RMAX: 12.4, QMAX: 3.0 };
const drillLen = (d) => 0.6 + 1.1 + d / 50;           // kužeľ + vrták (dlhší pri väčšom priemere)
const radialParts = () => mkParts([
  ['podstavec', 'Základová doska', 'Base', 'Základová doska', 'Base plate', 'Masívna liatinová doska s T-drážkami nesie stĺp a upínaciu kocku. Veľké obrobky sa upínajú priamo na ňu.', 'A massive cast-iron plate with T-slots carries the column and the box table. Large work is clamped directly on it.'],
  ['stlp', 'Stĺp', 'Column', 'Stĺp s otočným plášťom', 'Column with rotating sleeve', 'Na pevnom vnútornom stĺpe sa otáča plášť s ramenom. Upínacia páka plášť zovrie – pri vŕtaní musí byť stĺp upnutý, inak sa rameno pootočí.', 'A sleeve with the arm turns on the fixed inner column. The clamp lever locks the sleeve – while drilling the column must be clamped, otherwise the arm swings.'],
  ['rameno', 'Rameno', 'Arm', 'Rameno', 'Radial arm', 'Rameno sa otáča okolo stĺpa a motorom sa zdvíha po ňom (tlačidlá ▲ ▼ na vreteníku, len pri uvoľnenom stĺpe). Na jeho prednej strane sú vedenia vreteníka.', 'The arm swings around the column and is raised along it by a motor (▲ ▼ buttons on the head, only with the column unclamped). Its front carries the ways of the drill head.'],
  ['vretennik', 'Vreteník', 'Drill head', 'Vreteník', 'Drill head', 'Vreteník s motorom a prevodovkou jazdí po ramene ručným kolesom. Má 12 otáčok 32 – 1400 ot/min, automatický posuv 0,1 – 0,4 mm/ot a vlastnú upínaciu páku.', 'The head with motor and gearbox travels along the arm by the handwheel. It has 12 speeds 32 – 1400 rpm, automatic feed 0.1 – 0.4 mm/rev and its own clamp lever.'],
  ['vreteno', 'Vreteno a vrták', 'Spindle & drill', 'Vreteno s vrtákom', 'Spindle with drill', 'Pinola sa vysúva trojramennou kľukou alebo automatickým posuvom až o 300 mm. Vrták Ø10 – Ø50 je upnutý v Morseovom kuželi.', 'The quill extends by up to 300 mm with the three-spoke capstan or the power feed. The Ø10 – Ø50 drill is held in a Morse taper.'],
  ['stol', 'Upínacia kocka', 'Box table', 'Upínacia kocka', 'Box table', 'Liatinová kocka s T-drážkami na základovej doske. Obrobok leží na podložkách, aby sa dalo vŕtať naskrz.', 'A cast-iron box table with T-slots on the base. The work lies on parallels so that holes can be drilled through.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Doska na podložkách', 'Plate on parallels', 'Oceľová doska – pri vŕtaní stojí. Polohu diery určuje natočenie ramena a vyloženie vreteníka; displej ukazuje polohu vretena od stredu dosky.', 'A steel plate – it stays put while drilling. The hole position is set by the arm angle and the head reach; the display shows the spindle position from the plate centre.'],
  ['rozvadzac', 'Rozvádzač', 'Control box', 'Elektrický rozvádzač', 'Electrical box', 'Rozvádzač so šrafovaným vrchom je na plášti stĺpa a otáča sa s ramenom. Hlavný vypínač je na dvierkach, ovládanie chodu a zdvihu ramena na vreteníku.', 'The electrical box with a hatched top sits on the column sleeve and swings with the arm. The main switch is on its door, the drive and arm elevation buttons are on the drill head.'],
]);

const RADIAL_TASKS = [
  { id: 'roztec', title: () => L('Štyri diery Ø16 v rozteči 300 × 200', 'Four Ø16 holes at 300 × 200 pitch'),
    desc: () => L('Oceľová doska 400 × 300 × 30 mm. Vyvŕtaj štyri diery Ø16 naskrz v rohoch obdĺžnika 300 × 200 mm súmerne k stredu dosky (±0,5 mm). Doska stojí – vreteno nastavíš natočením ramena a posunom vreteníka podľa displeja X / Y. Pred vŕtaním upni stĺp aj vreteník.', 'Steel plate 400 × 300 × 30 mm. Drill four Ø16 through holes at the corners of a 300 × 200 mm rectangle, symmetric to the plate centre (±0.5 mm). The plate stays put – set the spindle by swinging the arm and moving the head according to the X / Y display. Clamp the column and the head before drilling.'),
    setup: { bL: 400, bW: 300, bT: 30, bit: 16, rpm: 500 },
    drawing: () => <RadialRectDrawing />,
    labels: { count: () => L('Práve štyri diery', 'Exactly four holes'), d: () => L('Priemer Ø16', 'Diameter Ø16'), through: () => L('Všetky naskrz', 'All through'), pos: () => L('Rozteč 300 × 200 ±0,5 mm', 'Pitch 300 × 200 ±0.5 mm') } },
  { id: 'priruba', title: () => L('Príruba: 6 dier Ø20 na kružnici Ø300', 'Flange: 6 holes Ø20 on a Ø300 circle'),
    desc: () => L('Oceľová doska 400 × 400 × 25 mm. Vyvŕtaj šesť dier Ø20 naskrz na rozstupovej kružnici Ø300 so stredom v strede dosky, po 60° (polomer ±0,5 mm, uhol ±0,3°). Súradnice dier: x = 150 · cos φ, y = 150 · sin φ. Veľký vrták – nízke otáčky a menší posuv.', 'Steel plate 400 × 400 × 25 mm. Drill six Ø20 through holes on a Ø300 pitch circle centred on the plate, 60° apart (radius ±0.5 mm, angle ±0.3°). Hole coordinates: x = 150 · cos φ, y = 150 · sin φ. Large drill – low speed and a smaller feed.'),
    setup: { bL: 400, bW: 400, bT: 25, bit: 20, rpm: 355 },
    drawing: () => <RadialFlangeDrawing />,
    labels: { count: () => L('Práve šesť dier', 'Exactly six holes'), d: () => L('Priemer Ø20', 'Diameter Ø20'), through: () => L('Všetky naskrz', 'All through'), circle: () => L('Rozstupová kružnica Ø300 ±0,5 mm', 'Pitch circle Ø300 ±0.5 mm'), pitch: () => L('Rozostup 60° ±0,3°', 'Spacing 60° ±0.3°') } },
].map((t) => ({ ...t, checks: (m) => radialChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const RADIAL_SAFETY = () => [
  L('Doska je upnutá upínkami k stolu, nedržím ju rukou.', 'The plate is clamped to the table, I do not hold it by hand.'),
  L('Stĺp a vreteník sú pred vŕtaním upnuté.', 'The column and the head are clamped before drilling.'),
  L('V dosahu ramena nikto nestojí, pri otáčaní ramena dávam pozor na okolie.', 'Nobody stands within the arm reach, I watch the surroundings when swinging the arm.'),
  L('Mám ochranné okuliare, bez rukavíc, vlasy zopnuté.', 'I wear safety glasses, no gloves, hair tied back.'),
];

function RadialSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { running: false, power: true, manual: false, light: true, rpm: 500, quill: 0, H: 1120, a: 0, R: 1030, bit: 16, autoF: false, feed: 0.16, stopQ: 300, timeScale: 5, colLock: true, headLock: true, bL: 400, bW: 300, bT: 30 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, quill: 0, depth: 0, vc: 0, msg: null, drilling: false, holes: 0, X: 0, Y: 0, a: 0, R: 0, H: 0 });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { PX, PZ, CUBE, PAR, NOSE, HMIN, HMAX, RMIN, RMAX, QMAX } = RA, { CX, CZ, SZO } = RD;
    const wk = { PT: 0.3, PW: 4.0, PD: 3.0 };
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('drill');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x7fab88, 0x6a9573, 0x4a6c54),
      col: std(0x8b9095, 0.35, 0.7), plate: std(0x737980, 0.42, 0.62), hole: std(0x0b0c0d, 0.9, 0.1), bit: std(0x2f3236, 0.32, 0.8),
      chip: std(0xa6adb4, 0.3, 0.85), lampShade: std(0x5b806b, 0.5, 0.2),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, pivotLever, handwheel } = kit;
    const root = new THREE.Group(); scene.add(root);
    apiRef.current.machineModel = { root, name: 'Radiálna vŕtačka' };
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // nápisy a šrafovanie (štítok VO50, logo TOS, výstražné pruhy na rozvádzači)
    const texMat = (w, h, draw, rough = 0.6) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
      return new THREE.MeshStandardMaterial({ map: tx, roughness: rough, metalness: 0.15 });
    };
    const decal = (parent, mat, w, h, x, y, z, ry = 0, rx = 0) => { const m = add(parent, new THREE.PlaneGeometry(w, h), mat, x, y, z); m.rotation.set(rx, ry, 0); return m; };
    const hatch = texMat(128, 32, (g, w, h) => { g.fillStyle = '#e3b51b'; g.fillRect(0, 0, w, h); g.fillStyle = '#16181a'; for (let x = -h; x < w + h; x += 24) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 12, h); g.lineTo(x + 12 + h, 0); g.lineTo(x + h, 0); g.fill(); } });
    const nameplate = texMat(160, 64, (g, w, h) => { g.fillStyle = '#d9dcd6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2b2e2c'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#1d2a22'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VO50', w / 2, h / 2 + 2); }, 0.4);
    const logo = texMat(96, 64, (g, w, h) => { g.fillStyle = '#5b806b'; g.fillRect(0, 0, w, h); g.fillStyle = '#eef0ea'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, TAU); g.fill(); g.fillStyle = '#23372b'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TOS', w / 2, h / 2 + 1); }, 0.5);

    // ---------- základová doska a upínacia kocka ----------
    const base = grp('podstavec');
    box(base, -7.4, 10.4, 0, 0.62, -3.5, 3.5, M.greenDark);                        // dlhá liatinová doska
    box(base, -7.5, 10.5, 0.62, 0.72, -3.6, -3.35, M.greenDark); box(base, -7.5, 10.5, 0.62, 0.72, 3.35, 3.6, M.greenDark);   // okraje žliabku
    box(base, 10.25, 10.5, 0.62, 0.72, -3.35, 3.35, M.greenDark);
    [-2.2, -1.1, 0, 1.1, 2.2].forEach((z) => box(base, 1.2, 10.1, 0.699, 0.705, z - 0.09, z + 0.09, M.black));   // T-drážky
    [-1, 1].forEach((s) => box(base, -7.6, 10.6, 0, 0.12, s * 3.6 - 0.1, s * 3.6 + 0.1, M.greenDark));
    const cube = grp('stol');
    box(cube, PX - 2.3, PX + 2.3, 0.7, CUBE, PZ - 2.25, PZ + 2.25, M.green);
    [-1.4, -0.45, 0.5, 1.45].forEach((z) => box(cube, PX - 2.3, PX + 2.3, CUBE - 0.02, CUBE + 0.003, PZ + z - 0.07, PZ + z + 0.07, M.black));
    box(cube, PX - 2.31, PX + 2.31, 1.2, 4.2, PZ + 2.25, PZ + 2.26, M.greenDark);
    [-1.4, 0, 1.4].forEach((y) => box(cube, PX - 2.31, PX + 2.31, CUBE - 1.2 + y * 0.6, CUBE - 1.12 + y * 0.6, PZ + 2.26, PZ + 2.3, M.black));   // drážky na boku kocky
    box(cube, PX + 2.3, PX + 2.32, 1.2, 4.2, PZ - 1.8, PZ + 1.8, M.greenDark);
    // ---------- stĺp s veľkou prírubou ----------
    const colG = grp('stlp');
    cylY(colG, 1.95, 1.95, 0.7, 1.0, CX, CZ, M.green, 48);                          // príruba stĺpa
    cylY(colG, 1.45, 1.75, 1.0, 1.45, CX, CZ, M.green, 48);
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; cylY(colG, 0.13, 0.13, 1.0, 1.12, CX + Math.cos(a) * 1.75, CZ + Math.sin(a) * 1.75, M.steelDark, 6); }
    cylY(colG, 0.62, 0.62, 1.45, 18.2, CX, CZ, M.col, 32);
    // ---------- otočný plášť s ramenom ----------
    const armRot = new THREE.Group(); armRot.position.set(CX, 0, CZ); root.add(armRot);
    const sleeve = grp('stlp', armRot);
    cylY(sleeve, 1.05, 1.05, 1.45, 1.85, 0, 0, M.greenDark, 40);                      // spodný krúžok plášťa
    cylY(sleeve, 0.9, 0.9, 1.85, 17.6, 0, 0, M.green, 40);
    // horná skriňa: prevodovka zdvihu ramena s motorom
    box(sleeve, -1.05, 1.05, 17.6, 19.1, -1.05, 1.05, M.green);
    box(sleeve, -1.12, 1.12, 19.1, 19.3, -1.12, 1.12, M.greenDark);
    cylX(sleeve, 0.6, 0.6, -2.4, -1.05, 18.35, 0, M.green, 28);                      // motor zdvihu (vodorovne, vzadu)
    cylX(sleeve, 0.65, 0.65, -2.55, -2.4, 18.35, 0, M.greenDark, 28);
    for (let k = 0; k < 6; k++) cylX(sleeve, 0.62, 0.62, -2.3 + k * 0.2, -2.24 + k * 0.2, 18.35, 0, M.greenDark, 28);   // rebrá chladenia
    box(sleeve, -1.9, -1.4, 18.95, 19.25, -0.3, 0.3, M.greenDark);                    // svorkovnica
    box(sleeve, 0.86, 0.94, 2.0, 17.4, -0.14, 0.14, M.steelDark);                     // skrutka zdvihu
    const colLockG = new THREE.Group(); colLockG.position.set(0.0, 2.2, 0.9); sleeve.add(colLockG);
    const levCol = pivotLever(colLockG, 0, 0, 0.02, 0.55, 1.2);                     // upnutie stĺpa
    // ---------- rozvádzač na boku plášťa (otáča sa s ramenom), šrafovaný vrch ----------
    const cab = grp('rozvadzac', armRot);
    box(cab, -2.35, -0.9, 3.0, 7.6, -0.95, 0.95, M.green);
    box(cab, -2.4, -0.85, 7.6, 7.75, -1.0, 1.0, M.greenDark);
    decal(cab, hatch, 1.45, 0.42, -1.625, 7.35, 0.952);                              // výstražné šrafovanie hore
    decal(cab, hatch, 1.9, 0.42, -2.352, 7.35, 0, -Math.PI / 2);
    box(cab, -2.2, -1.05, 3.3, 6.9, 0.95, 0.98, M.greenDark);                        // dvierka
    box(cab, -1.28, -1.18, 4.6, 5.3, 0.98, 1.02, M.steelDark);                       // kľučka
    box(cab, -2.05, -1.5, 5.8, 6.5, 0.98, 1.0, M.panel);
    const mainSw = new THREE.Group(); mainSw.position.set(-1.78, 6.15, 1.0); cab.add(mainSw);
    cylZ(mainSw, 0.18, 0.18, 0, 0.06, 0, 0, M.black, 24); box(mainSw, -0.045, 0.045, -0.22, 0.22, 0.06, 0.16, M.red);
    // ---------- skriňové rameno ----------
    const armY = grp('rameno', armRot);
    box(armY, -1.3, 1.3, -0.7, 2.3, -1.3, 1.3, M.green);                             // objímka na plášti
    box(armY, -1.36, 1.36, 2.3, 2.45, -1.36, 1.36, M.greenDark);
    [-1, 1].forEach((s) => box(armY, 1.3, 1.8, -0.5, 2.1, s * 0.55 - 0.08, s * 0.55 + 0.08, M.green));   // rebrá objímky
    box(armY, 1.3, 13.2, 0, 1.6, -0.7, 0.65, M.green);                               // skriňa ramena
    const armTop = new THREE.Shape(); armTop.moveTo(1.3, 1.6); armTop.lineTo(13.2, 1.6); armTop.lineTo(13.2, 1.75); armTop.lineTo(1.8, 2.25); armTop.lineTo(1.3, 2.25); armTop.lineTo(1.3, 1.6);
    const atg = new THREE.ExtrudeGeometry(armTop, { depth: 1.2, bevelEnabled: false }); atg.translate(0, 0, -0.65); add(armY, atg, M.green);   // zošikmený chrbát ramena
    box(armY, 1.3, 13.2, 0.05, 0.32, 0.65, 0.76, M.ways); box(armY, 1.3, 13.2, 1.18, 1.45, 0.65, 0.76, M.ways);
    box(armY, 1.3, 13.2, 0.6, 0.85, 0.65, 0.7, M.steelDark);                          // ozubená tyč posuvu vreteníka
    box(armY, 13.2, 13.4, -0.08, 1.8, -0.75, 0.75, M.greenDark);
    // ---------- vreteník VO 50 ----------
    const head = grp('vretennik', armY);
    box(head, -1.05, 1.05, -2.0, 0.6, 0.76, 2.45, M.green);                          // spodná skriňa (posuvy)
    box(head, -0.95, 0.95, 0.6, 2.25, 0.76, 2.3, M.green);                           // horná skriňa (prevodovka)
    box(head, -1.0, 1.0, 2.25, 2.4, 0.76, 2.35, M.greenDark);
    box(head, -1.0, 1.0, -2.3, -2.0, 0.9, 2.2, M.greenDark);                         // spodok vreteníka
    cylY(head, 0.62, 0.62, 2.4, 3.6, 0, 1.55, M.green, 28);                           // motor vretena
    cylY(head, 0.66, 0.66, 3.6, 3.75, 0, 1.55, M.greenDark, 28);
    for (let k = 0; k < 5; k++) cylY(head, 0.645, 0.645, 2.6 + k * 0.2, 2.66 + k * 0.2, 0, 1.55, M.greenDark, 28);
    box(head, 0.45, 0.9, 2.6, 3.1, 1.55, 2.05, M.greenDark);                          // svorkovnica motora
    cylY(head, 0.38, 0.38, -2.8, -2.3, 0, SZO, M.green, 28);                         // puzdro pinoly
    decal(head, nameplate, 1.05, 0.42, 0.0, 1.75, 2.302);                            // štítok VO50
    decal(head, logo, 0.62, 0.42, -0.55, -1.45, 2.452);                               // logo TOS
    box(head, -0.85, -0.05, -0.6, 0.9, 2.45, 2.48, M.panel);                          // ovládací panel
    const pbtn = (x, y, m) => { const g = new THREE.Group(); g.position.set(x, y, 2.48); head.add(g); cylZ(g, 0.09, 0.09, 0, 0.07, 0, 0, m, 18); hitProxy(g, 0.14, 0, 0, 0.05); return g; };
    const bStart = pbtn(-0.65, 0.6, M.btnGreen), bStop = pbtn(-0.25, 0.6, M.red), bUp = pbtn(-0.65, 0.05, M.steel), bDown = pbtn(-0.25, 0.05, M.steel);
    const lampRun = std(0x1f5f33, 0.4, 0.1); ball(head, 0.06, -0.45, 0.85, 2.5, lampRun);
    box(head, -0.8, -0.1, -0.45, -0.25, 2.48, 2.49, M.yellow);
    const eStop = new THREE.Group(); eStop.position.set(-0.45, -0.35, 2.49); head.add(eStop);
    cylZ(eStop, 0.07, 0.07, 0, 0.06, 0, 0, M.steelDark, 16); cylZ(eStop, 0.15, 0.14, 0.06, 0.13, 0, 0, M.red, 24); hitProxy(eStop, 0.2, 0, 0, 0.08);
    // páky voľby otáčok a posuvov na čele hornej skrine
    [-0.6, -0.2, 0.2, 0.6].forEach((x) => { cylZ(head, 0.1, 0.1, 2.3, 2.38, x, 1.15, M.steelDark, 14); cylZ(head, 0.03, 0.03, 2.38, 2.62, x, 1.15, M.steel, 8); ball(head, 0.07, x, 1.15, 2.64, M.black); });
    cylZ(head, 0.16, 0.13, 2.45, 2.6, 0.5, 0.6, M.black, 20);
    const levFeed = pivotLever(head, 0.5, 0.6, 2.6, 0.38, 1.25);                     // páka automatického posuvu
    // trojramenná kľuka pinoly na čele vreteníka
    const capF = new THREE.Group(); capF.position.set(0.45, -1.0, 2.45); head.add(capF);
    const capstan = new THREE.Group(); capF.add(capstan);
    cylZ(capstan, 0.26, 0.26, 0, 0.3, 0, 0, M.steelDark, 24); cylZ(capstan, 0.12, 0.12, 0.3, 0.4, 0, 0, M.steel, 16);
    for (let k = 0; k < 3; k++) { const arm = new THREE.Group(); arm.rotation.z = k * TAU / 3 + Math.PI / 2; capstan.add(arm); cylX(arm, 0.05, 0.04, 0.2, 0.95, 0, 0.18, M.steel, 10); ball(arm, 0.12, 1.0, 0, 0.18, M.black); }
    const wR = handwheel(head, 0.42, -1.12, -0.6, 1.6, '-x', 0.24);                 // koleso posuvu vreteníka po ramene
    const levHead = pivotLever(head, -1.02, 1.3, 1.0, 0.42, 1.2);                     // upnutie vreteníka
    levHead.rotation.y = -Math.PI / 2;
    armY.position.y = c.H / 100; head.position.x = c.R / 100; armRot.updateMatrixWorld(true);
    // ---------- vreteno a vrták ----------
    const spG = grp('vreteno', head); spG.position.set(0, NOSE, SZO);
    cylY(spG, 0.27, 0.27, 0, 0.6, 0, 0, M.steel, 28);
    const rot = new THREE.Group(); spG.add(rot);
    const bitG = new THREE.Group(); rot.add(bitG);
    const buildBit = (d) => {
      while (bitG.children.length) { const o = bitG.children[0]; bitG.remove(o); o.geometry.dispose(); }
      const r = d / 200, len = drillLen(d) - 0.6;
      cylY(bitG, 0.12 + r * 0.6, 0.22, -0.6, 0, 0, 0, M.steelDark, 20);                // Morseov kužeľ
      cylY(bitG, r, r, -0.6 - len, -0.6, 0, 0, M.bit, 18);
      const cone = add(bitG, new THREE.ConeGeometry(r, r * 1.2, 18), M.bit, 0, -0.6 - len - r * 0.6, 0); cone.rotation.x = Math.PI;
      for (let k = 0; k < 2; k++) { const f = add(bitG, new THREE.BoxGeometry(r * 2.04, len * 0.85, r * 0.28), M.steel, 0, -0.6 - len * 0.55, 0); f.rotation.y = k * Math.PI / 2 + 0.4; }
    };
    // ---------- obrobok na podložkách ----------
    const plateG = grp('obrobok'); plateG.position.set(PX, CUBE, PZ);
    const plateW = new THREE.Group(); plateG.add(plateW);
    const parG = new THREE.Group(); plateG.add(parG);
    const holeGeo = new THREE.CylinderGeometry(1, 1, 1, 28); holeGeo.translate(0, -0.5, 0);
    let holes = [];
    const showHole = (h) => { h.m.scale.set(h.r, Math.min(h.depth, wk.PT) + 0.004, h.r); };
    const addHole = (x, z, r) => { const m = new THREE.Mesh(holeGeo, M.hole); m.userData.stepSubtract=true; m.position.set(x, PAR + wk.PT + 0.002, z); plateW.add(m); const h = { x, z, r, depth: 0, m, through: false }; holes.push(h); return h; };
    const parX = () => wk.PW / 2 - 0.1;
    const makePlate = () => {
      [plateW, parG].forEach((g) => { for (let i = g.children.length - 1; i >= 0; i--) { const o = g.children[i]; if (o.geometry !== holeGeo) o.geometry.dispose(); g.remove(o); } });
      holes = [];
      box(parG, -parX() - 0.06, -parX() + 0.06, 0, PAR, -wk.PD / 2, wk.PD / 2, M.steel); box(parG, parX() - 0.06, parX() + 0.06, 0, PAR, -wk.PD / 2, wk.PD / 2, M.steel);
      box(plateW, -wk.PW / 2, wk.PW / 2, PAR, PAR + wk.PT, -wk.PD / 2, wk.PD / 2, M.plate);
      // upínky na krajoch dosky
      [-1, 1].forEach((s) => { box(plateW, s * wk.PW / 2 - 0.35, s * wk.PW / 2 + 0.25, PAR + wk.PT, PAR + wk.PT + 0.12, -0.15, 0.15, M.steelDark).userData.excludeFromExport=true; cylY(plateW, 0.05, 0.05, PAR + wk.PT + 0.12, PAR + wk.PT + 0.32, s * (wk.PW / 2 - 0.1), 0, M.steel, 8).userData.excludeFromExport=true; });
    };
    makePlate();
    const findHole = (x, z, r) => holes.find((h) => Math.hypot(h.x - x, h.z - z) < Math.max(0.012, r * 0.35));
    const chipsP = createParticles(scene, new THREE.BoxGeometry(0.06, 0.014, 0.1), M.chip, 140);
    const lamp = createLamp(scene, head, kit, M, { base: v3(1.0, 1.95, 2.0), elbow: v3(1.8, 2.6, 2.6), head: v3(1.4, 0.3, 3.0), aim: v3(PX, CUBE + 0.5, PZ), angle: 0.55, power: 2.6 });

    // ---------- stav ----------
    const st = { a: c.a, R: c.R / 100, H: c.H / 100, q: c.quill / 100, bit: c.bit, rpm: 0, spin: 0, drillT: -9, msg: null };
    let t = 0, last = performance.now(), teleT = 0, chipAcc = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 2.8 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const tipY = (H = st.H, q = st.q, d = st.bit) => H + NOSE - q - drillLen(d) - d / 200 * 1.2;
    const sp = (a = st.a, R = st.R) => spindleXZ(a, R);
    const topY = () => CUBE + PAR + wk.PT;
    const floorInfo = (a = st.a, R = st.R, d = st.bit) => {
      const r = d / 200, p = sp(a, R), px = p.x - PX, pz = p.z - PZ;
      const onPlate = !c.unclamped && Math.abs(px) < wk.PW / 2 + r * 0.5 && Math.abs(pz) < wk.PD / 2 + r * 0.5;
      const onCube = Math.abs(p.x - PX) < 2.3 + r && Math.abs(p.z - PZ) < 2.25 + r;
      let hard = onCube ? CUBE : 0.7, why = 'table';
      if (onPlate && Math.abs(Math.abs(px) - parX()) < 0.06 + r && Math.abs(pz) < wk.PD / 2 + r) { hard = CUBE + PAR; why = 'par'; }
      const h = onPlate ? findHole(px, pz, r) : null;
      const holeD = h && h.r >= r - 1e-6 ? (h.through ? Infinity : h.depth) : 0;
      return { onPlate, hard, why, free: onPlate ? topY() - holeD : -Infinity, px, pz, h, r };
    };
    const inWork = (a, R, H, q, d) => { const f = floorInfo(a, R, d); return f.onPlate && tipY(H, q, d) < topY() + 0.02; };
    buildBit(st.bit);

    // ---------- pohľady ----------
    const anchors = {
      podstavec: () => v3(9.4, 0.8, 3.4), stlp: () => v3(CX + 0.95, 10.0, CZ + 0.95), stol: () => v3(PX + 2.3, 3.0, PZ + 2.3),
      rameno: () => { const p = spindleXZ(st.a, 9); return v3(p.x, st.H + 1.7, p.z - SZO * 0.3); }, vretennik: () => { const p = sp(); return v3(p.x, st.H + 3.5, p.z); },
      vreteno: () => { const p = sp(); return v3(p.x + 0.35, tipY() + 0.6, p.z + 0.3); }, obrobok: () => v3(PX - wk.PW / 2 + 0.3, topY() + 0.05, PZ + wk.PD / 2), rozvadzac: () => v3(CX - 1.6 * Math.cos(st.a * Math.PI / 180), 7.9, CZ + 1.6 * Math.sin(st.a * Math.PI / 180)),
    };
    const views = {
      celok: () => [[13, 17, 24], [1, 8, 0]],
      rez: () => { const p = sp(); return [[p.x + 3.0, topY() + 3.2, p.z + 4.4], [p.x, topY() + 0.6, p.z], true]; },
      zhora: () => [[PX, 27, PZ + 1.5], [PX, topY(), PZ], true],
      rameno: () => [[CX + 4, st.H + 4, 13], [CX + 5, st.H, 0], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);

    // ---------- polotovar ----------
    const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj: () => plateW, getSpot: () => v3(PX, topY() + 3.5, PZ + 5), onState: (v) => { push('unclamped', v); push('manual', c.manual); } });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in') {
        if (c.running || st.rpm > 1) { say(L('Doska sa berie len pri stojacom vretene.', 'The plate can only be taken off with the spindle stopped.')); return; }
        if (tipY() < topY() + 0.4 && floorInfo().onPlate) { say(L('Najprv vytiahni vrták hore (pinola) alebo zdvihni rameno.', 'Retract the drill first (quill up) or raise the arm.')); return; }
      }
      if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb polotovaru.', 'Wait until the workpiece movement finishes.'), 'info');
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) { say(L('Najprv polož dosku späť.', 'Put the plate back first.')); return false; }
      if (inWork(st.a, st.R, st.H, st.q, st.bit)) { say(L('Najprv vytiahni vrták z obrobku (pinola hore).', 'Pull the drill out of the workpiece first (quill up).')); return false; }
      wk.PW = c.bL / 100; wk.PD = c.bW / 100; wk.PT = c.bT / 100; makePlate();
      say(L('Na podložkách je nová doska bez dier.', 'A new plate without holes is on the parallels.'), 'info');
      return true;
    };
    const holeData = () => holes.map((h) => ({ x: h.x * 100, y: -h.z * 100, d: Math.round(h.r * 200 * 10) / 10, depth: Math.min(h.depth, wk.PT) * 100, through: h.through }));
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

    // ---------- ručné ovládanie ----------
    const needPower = (fn) => () => { if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.')); else fn(); };
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0), onSet: (i) => { push('power', i === 1); if (!i) push('running', false); }, read: () => (c.power ? 'I' : '0') }, mainSw);
    ctrl.reg({ type: 'button', label: LL('ŠTART vretena', 'Spindle START'), hint: LL('Spustí vreteno.', 'Starts the spindle.'), action: needPower(() => push('running', true)) }, bStart);
    ctrl.reg({ type: 'button', label: LL('STOP vretena', 'Spindle STOP'), hint: LL('Zastaví vreteno.', 'Stops the spindle.'), action: () => push('running', false) }, bStop);
    ctrl.reg({ type: 'button', label: LL('Núdzový STOP', 'Emergency STOP'), hint: LL('Zastaví vreteno aj posuv.', 'Stops the spindle and the feed.'), action: () => { push('running', false); push('autoF', false); say(L('Núdzové zastavenie.', 'Emergency stop.'), 'danger'); } }, eStop);
    const armMove = (dir) => {
      if (!c.power) { say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.')); return; }
      if (c.colLock) { say(L('Rameno sa zdvíha len pri uvoľnenom stĺpe – uvoľni upínaciu páku stĺpa.', 'The arm is raised only with the column unclamped – release the column clamp lever.')); return; }
      push('H', clamp(Math.round(c.H + dir * 50), HMIN * 100, HMAX * 100));
    };
    ctrl.reg({ type: 'button', label: LL('Rameno ▲', 'Arm ▲'), hint: LL('Motor zdvihne rameno o 50 mm.', 'The motor raises the arm by 50 mm.'), action: () => armMove(1) }, bUp);
    ctrl.reg({ type: 'button', label: LL('Rameno ▼', 'Arm ▼'), hint: LL('Motor spustí rameno o 50 mm.', 'The motor lowers the arm by 50 mm.'), action: () => armMove(-1) }, bDown);
    ctrl.reg({ type: 'lever', angles: [0.5, -0.5], minR: 0.2, label: LL('Upnutie stĺpa', 'Column clamp'), hint: LL('Hore = upnuté. Uvoľnené rameno sa dá otáčať a zdvíhať.', 'Up = clamped. Released, the arm can be swung and raised.'),
      getIdx: () => (c.colLock ? 0 : 1), onSet: (i) => push('colLock', i === 0), read: () => (c.colLock ? L('upnutý', 'clamped') : L('uvoľnený', 'released')) }, levCol);
    ctrl.reg({ type: 'lever', angles: [0.5, -0.5], minR: 0.2, label: LL('Upnutie vreteníka', 'Head clamp'), hint: LL('Hore = upnutý. Uvoľnený vreteník sa posúva po ramene kolesom.', 'Up = clamped. Released, the head travels along the arm by the handwheel.'),
      getIdx: () => (c.headLock ? 0 : 1), onSet: (i) => push('headLock', i === 0), read: () => (c.headLock ? L('upnutý', 'clamped') : L('uvoľnený', 'released')) }, levHead);
    ctrl.reg({ type: 'lever', angles: [0.4, -0.4], minR: 0.2, label: LL('Páka automatického posuvu', 'Power feed lever'), hint: LL('Dole = posuv zapnutý, pinola ide dole so zvoleným posuvom na otáčku.', 'Down = feed on, the quill goes down at the selected feed per revolution.'),
      getIdx: () => (c.autoF ? 1 : 0), onSet: (i) => push('autoF', i === 1), read: () => (c.autoF ? `${c.feed} ${L('mm/ot', 'mm/rev')}` : L('vypnutý', 'off')) }, levFeed);
    ctrl.reg({ type: 'wheel', minR: 0.8, inc: 1, label: LL('Kľuka pinoly', 'Quill capstan'), hint: LL('K sebe = pinola ide dole. 1 otáčka = 120 mm.', 'Towards you = the quill goes down. 1 turn = 120 mm.'),
      turn: (d) => { const a = st.q * 100; push('quill', clamp(clamp(c.quill - d * 120 / TAU, a - 8, a + 8), 0, QMAX * 100)); }, read: () => `${L('pinola', 'quill')} ${(st.q * 100).toFixed(1)} mm` }, capstan);
    ctrl.reg({ type: 'wheel', minR: 0.3, inc: -1, label: LL('Koleso posuvu vreteníka', 'Head traverse handwheel'), hint: LL('Posúva vreteník po ramene (len uvoľnený). 1 otáčka = 20 mm.', 'Moves the head along the arm (only released). 1 turn = 20 mm.'),
      guard: () => { if (!c.headLock) return true; say(L('Vreteník je upnutý – uvoľni jeho páku.', 'The head is clamped – release its lever.')); return false; },
      turn: (d) => push('R', clamp(Math.round((c.R - d * 20 / TAU) * 100) / 100, RMIN * 100, RMAX * 100)), read: () => `R ${(st.R * 100).toFixed(1)} mm` }, wR);
    let a0 = 0;
    ctrl.reg({ type: 'slide', label: LL('Rameno', 'Arm'), hint: LL('Ťahaj rameno – otáča sa okolo stĺpa (len pri uvoľnenom stĺpe).', 'Drag the arm – it swings around the column (only with the column unclamped).'), read: () => `α ${st.a.toFixed(2)}°`,
      guard: () => { if (!c.colLock) return true; say(L('Stĺp je upnutý – uvoľni páku na plášti stĺpa.', 'The column is clamped – release the lever on the sleeve.')); return false; },
      start: () => { a0 = st.a; }, slide: (dx) => push('a', clamp(Math.round((a0 - dx * 5) * 100) / 100, -95, 95)), nudge: (dir) => push('a', clamp(st.a - dir * 0.5, -95, 95)) }, armY);
    ctrl.reg({ type: 'button', still: true, label: LL('Pracovná lampa', 'Work lamp'), hint: LL('Klik zapne alebo vypne lampu.', 'Click to switch the lamp on or off.'), action: () => push('light', !c.light) }, lamp.shade);
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      wi.update(dt);
      if (!c.power && c.running) push('running', false);
      st.rpm = approach(st.rpm, c.running && c.power ? c.rpm : 0, 1500 * dt);
      const running = st.rpm > 15;
      st.spin += (st.rpm > 0 ? 5 * st.rpm / (st.rpm + 400) : 0) * TAU * dt; rot.rotation.y = -st.spin;

      // výmena vrtáka
      if (c.bit !== st.bit) {
        if (c.running || running) { say(L('Vrták sa mení len pri stojacom vretene.', 'The drill is changed only with the spindle stopped.')); push('bit', st.bit); }
        else if (inWork(st.a, st.R, st.H, st.q, c.bit)) { say(L('Nový vrták by bol v obrobku – vytiahni pinolu hore.', 'The new drill would be in the workpiece – retract the quill.')); push('bit', st.bit); }
        else { st.bit = c.bit; buildBit(st.bit); say(`${L('Upnutý vrták', 'Drill clamped:')} Ø${st.bit} mm.`, 'info'); }
      }
      // upnutia: s upnutým stĺpom / vreteníkom sa rameno ani vreteník nepohnú
      if (c.colLock && (Math.abs(c.a - st.a) > 1e-6 || Math.abs(c.H / 100 - st.H) > 1e-6)) { sayOnce('colLock', true, L('Stĺp je upnutý – rameno sa neotočí ani nezdvihne. Uvoľni upínaciu páku stĺpa.', 'The column is clamped – the arm will not swing or rise. Release the column clamp.')); c.a = st.a; pend.a = st.a; c.H = st.H * 100; pend.H = c.H; } else flags.colLock = false;
      if (c.headLock && Math.abs(c.R / 100 - st.R) > 1e-6) { sayOnce('headLock', true, L('Vreteník je upnutý – neposunie sa po ramene. Uvoľni jeho páku.', 'The head is clamped – it will not travel along the arm. Release its lever.')); c.R = st.R * 100; pend.R = c.R; } else flags.headLock = false;
      // presuny ramena a vreteníka – nie s vrtákom v obrobku
      const aN = approach(st.a, clamp(c.a, -95, 95), 8 * dt), RN = approach(st.R, clamp(c.R / 100, RMIN, RMAX), 1.2 * dt), HN = approach(st.H, clamp(c.H / 100, HMIN, HMAX), 0.5 * dt);
      if (aN !== st.a || RN !== st.R || HN !== st.H) {
        const inside = inWork(st.a, st.R, st.H, st.q, st.bit);
        if (inside && (aN !== st.a || RN !== st.R)) { sayOnce('movein', true, L('Vrták je v obrobku – najprv vytiahni pinolu hore.', 'The drill is in the workpiece – retract the quill first.')); c.a = st.a; pend.a = st.a; c.R = st.R * 100; pend.R = c.R; }
        else {
          flags.movein = false;
          const fi = floorInfo(aN, RN), tipN = tipY(HN);
          if (HN < st.H && fi.onPlate && tipN < Math.max(fi.free, fi.hard) && tipN < tipY()) { c.H = st.H * 100; pend.H = c.H; say(L('Rameno by tlačilo vrták do obrobku – zastavené.', 'The arm would push the drill into the work – stopped.')); }
          else { wR.rotation.z -= (RN - st.R) / 0.2 * TAU; st.a = aN; st.R = RN; st.H = HN; }
        }
      }
      // automatický posuv pinoly s hĺbkovým dorazom
      const clampedOk = c.colLock && c.headLock;
      if (c.autoF && running) {
        const nq = Math.min(c.quill + c.feed * st.rpm / 60 * c.timeScale * dt, c.stopQ, QMAX * 100);
        if (nq >= Math.min(c.stopQ, QMAX * 100) - 1e-6) { c.autoF = false; pend.autoF = false; say(L('Hĺbkový doraz – automatický posuv sa vypol.', 'Depth stop – the power feed switched off.'), 'info'); }
        c.quill = nq; pend.quill = Math.round(nq * 10) / 10;
      }
      const fi = floorInfo();
      const fRate = (c.autoF ? c.feed : 0.3) * st.rpm / 60 * c.timeScale / 100 * dt;
      let nq = approach(st.q, clamp(c.quill, 0, QMAX * 100) / 100, 1.5 * dt), why = null;
      const rel = (q) => tipY(st.H, q);
      if (fi.onPlate && rel(nq) < fi.free) {
        const lim = running && clampedOk ? Math.min(rel(st.q), fi.free) - fRate : Math.min(rel(st.q), fi.free);
        if (rel(nq) < lim) { nq = st.H + NOSE - drillLen(st.bit) - st.bit / 200 * 1.2 - lim; why = !running ? 'work' : !clampedOk ? 'lock' : null; }
      }
      if (rel(nq) < fi.hard) { nq = st.H + NOSE - drillLen(st.bit) - st.bit / 200 * 1.2 - fi.hard; why = fi.why; }
      nq = Math.max(0, nq);
      sayOnce('work', why === 'work', L('Vrták narazil do obrobku – pri stojacom vretene nevŕta. Spusti vreteno.', 'The drill hit the workpiece – it does not drill with the spindle stopped. Start the spindle.'), 'danger');
      sayOnce('lock', why === 'lock', L('Stĺp alebo vreteník nie je upnutý – pri vŕtaní by sa rameno vychýlilo. Najprv upni obe páky.', 'The column or the head is not clamped – the arm would deflect while drilling. Clamp both levers first.'), 'danger');
      sayOnce('par', why === 'par', L('Vrták by navŕtal podložku – posuň vreteno mimo podložky.', 'The drill would drill into a parallel – move the spindle off the parallels.'), 'warn');
      sayOnce('table', why === 'table', L('Vrták by navŕtal stôl – zastav posuv pinoly.', 'The drill would drill into the table – stop the quill feed.'), 'warn');
      capstan.rotation.z -= (nq - st.q) / 1.2 * TAU;
      st.q = nq;
      if (c.autoF && Math.abs(c.quill / 100 - st.q) > 0.02) { c.quill = st.q * 100; pend.quill = Math.round(c.quill * 10) / 10; }

      // vŕtanie
      const depthNow = topY() - tipY();
      if (running && clampedOk && fi.onPlate && depthNow > 0.001) {
        let h = fi.h;
        if (!h) h = addHole(fi.px, fi.pz, fi.r);
        else if (h.r < fi.r - 1e-6) { h.r = fi.r; h.depth = 0; h.through = false; }
        if (depthNow > h.depth + 1e-5 && !h.through) {
          h.depth = Math.min(depthNow, wk.PT + 0.01);
          if (h.depth >= wk.PT) { h.through = true; say(`${L('Diera', 'Hole')} Ø${st.bit} mm ${L('je prevŕtaná naskrz.', 'is drilled through.')}`, 'info'); }
          showHole(h); st.drillT = t;
          const p = sp(); chipAcc += dt * 40;
          while (chipAcc >= 1) { chipAcc -= 1; const a = Math.random() * TAU, s = 1 + Math.random() * 1.5; chipsP.spawn(v3(p.x + Math.cos(a) * fi.r, topY() + 0.03, p.z + Math.sin(a) * fi.r), v3(Math.cos(a) * s, 1 + Math.random() * 1.6, Math.sin(a) * s), 3 + Math.random() * 2); }
        }
        sayOnce('vc', Math.PI * st.bit * st.rpm / 1000 > 38, L('Príliš vysoká rezná rýchlosť pre oceľ – vrták sa prehrieva. Zníž otáčky (20 – 30 m/min).', 'Cutting speed too high for steel – the drill overheats. Reduce the speed (20 – 30 m/min).'), 'warn');
      }
      const drilling = t - st.drillT < 0.25;

      // pohyb skupín
      armRot.rotation.y = st.a * Math.PI / 180; armY.position.y = st.H; head.position.x = st.R; spG.position.y = NOSE - st.q;
      lampRun.emissive.setHex(running ? 0x22dd55 : 0);
      lamp.update(c.light, v3(sp().x, topY(), sp().z));
      chipsP.update(dt, (q) => (Math.abs(q.x - PX) < wk.PW / 2 && Math.abs(q.z - PZ) < wk.PD / 2 ? topY() : Math.abs(q.x - PX) < 2.3 && Math.abs(q.z - PZ) < 2.25 ? CUBE : 0.7));
      ctrl.update(dt);
      insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        const h = floorInfo().h, p = sp();
        setTele({ rpm: st.rpm, quill: st.q * 100, depth: h ? Math.min(h.depth, wk.PT) * 100 : 0, vc: Math.PI * st.bit * st.rpm / 1000, drilling: drilling && running, holes: holes.length,
          X: (p.x - PX) * 100, Y: -(p.z - PZ) * 100, a: st.a, R: st.R * 100, H: st.H * 100, msg: st.msg && st.msg.until > t ? st.msg : null });
        if (Object.keys(pend).length) { const q = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]); setUi((u) => ({ ...u, ...q })); }
      }
      snd.update({ motor: st.rpm / 1400, cut: drilling && running ? 1 : 0 });
      renderer.render(scene, camera);
    };
    try { if (/[?&]debug/.test(window.location.search)) window.__radial = { st, c, holes: () => holes }; } catch (err) { /* ignorované */ }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); insp.dispose(); wi.dispose(); holeGeo.dispose(); try { if (window.__radial && window.__radial.st === st) delete window.__radial; } catch (err) { /* ignorované */ } disposeStage(); };
  }, []);

  const parts = radialParts();
  const fmt = (x, d = 1) => L(x.toFixed(d).replace('.', ','), x.toFixed(d));
  const statusMsg = tele.msg ? tele.msg
    : ui.unclamped ? { kind: 'info', text: L('Doska je zložená zo stola.', 'The plate is taken off the table.') }
    : tele.drilling ? { kind: 'run', text: `${L('Vŕtanie', 'Drilling')} Ø${ui.bit} mm – ${L('hĺbka', 'depth')} ${fmt(tele.depth)} mm, vc ${fmt(tele.vc, 0)} m/min` }
    : tele.rpm > 15 ? { kind: 'run', text: L('Vreteno beží. Upni stĺp aj vreteník a spusti vrták kľukou alebo automatickým posuvom.', 'The spindle is running. Clamp the column and the head and lower the drill with the capstan or the power feed.') }
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
    : { kind: 'idle', text: L('Nastav vreteno nad miesto diery otočením ramena a posunom vreteníka, upni ich a spusti vreteno.', 'Set the spindle over the hole by swinging the arm and moving the head, clamp them and start the spindle.') };
  const chips = [{ color: tele.rpm > 15 ? '#3ee06c' : '#8b8f89', text: tele.rpm > 15 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Vreteno stojí', 'Spindle stopped') }];
  if (!ui.colLock || !ui.headLock) chips.push({ color: '#ff8a1f', text: !ui.colLock && !ui.headLock ? L('Stĺp a vreteník uvoľnené', 'Column and head released') : !ui.colLock ? L('Stĺp uvoľnený', 'Column released') : L('Vreteník uvoľnený', 'Head released') });
  if (tele.drilling) chips.push({ color: '#ffb340', text: L('Vŕtanie', 'Drilling') });
  if (tele.holes) chips.push({ color: '#7fb6ff', text: `${L('Diery', 'Holes')}: ${tele.holes}` });
  const stopped = !ui.running && tele.rpm <= 1;
  const rec = Math.round(25000 / (Math.PI * ui.bit));
  const setupTask = (task) => {
    const su = task.setup; if (!stopped) return;
    ['bL', 'bW', 'bT'].forEach((k) => set(k, su[k]));
    set('quill', 0); set('autoF', false);
    setTimeout(() => { if (apiRef.current.newBlank) apiRef.current.newBlank(); set('bit', su.bit); set('rpm', su.rpm); }, 600);
  };
  const mholes = apiRef.current.measure ? apiRef.current.measure().holes : [];
  const nud = (k, dv, lo, hi, dig) => set(k, clamp(Math.round((ui[k] + dv) * 10 ** dig) / 10 ** dig, lo, hi));

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef}
        tips={[L('Doska stojí – miesto diery nastavíš natočením ramena (α) a vyložením vreteníka (R); displej X / Y ukazuje polohu vretena od stredu dosky.', 'The plate stays put – set the hole position by the arm angle (α) and the head reach (R); the X / Y display shows the spindle position from the plate centre.'),
          L('Pred vŕtaním upni stĺp aj vreteník, pred presunom ich uvoľni.', 'Clamp the column and the head before drilling, release them before moving.'),
          L('Automatický posuv sa vypne na hĺbkovom doraze.', 'The power feed switches off at the depth stop.')]} />
      <aside className="panel"><fieldset className="machine-settings" disabled={ui.unclamped}>
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · radiálna vŕtačka', 'Simulator · radial drill')} title={L('Radiálna vŕtačka', 'Radial drilling machine')}
          sub={L('Predloha: TOS VO 50 – otočné rameno na stĺpe s veľkou prírubou, vreteník posuvný po ramene, rozvádzač na plášti stĺpa, vŕtanie do Ø50 mm.', 'Modelled after the TOS VO 50 – an arm swinging on a column with a large base flange, a head travelling along the arm, the electrical box on the column sleeve, drilling up to Ø50 mm.')}
          rows={[['X mm', tele.X.toFixed(1)], ['Y mm', tele.Y.toFixed(1)], [L('Hĺbka', 'Depth'), tele.depth.toFixed(1)]]}
          foot={[`α ${tele.a.toFixed(2)}° · R ${tele.R.toFixed(1)}`, `n ${Math.round(tele.rpm)} · vc ${tele.vc.toFixed(0)} m/min`]} status={statusMsg} />

        <TaskSection machine="radialka" tasks={RADIAL_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'running', items: RADIAL_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
          <button type="button" className={`btn-run ${ui.running ? 'stop' : 'start'}`} onClick={() => { if (!ui.running && !ui.power) set('power', true); set('running', !ui.running); }}>
            {ui.running ? L('■ Stop vretena', '■ Stop spindle') : L('▶ Štart vretena', '▶ Start spindle')}
          </button>
          <div className="mt-2">
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => { const v = !ui.power; set('power', v); if (!v) set('running', false); }} />
            <Toggle on={ui.light} label={L('Pracovné osvetlenie', 'Work light')} onClick={() => set('light', !ui.light)} />
          </div>
          <div className="mt-3"><StepSelect id="rrpm" label={L('Otáčky vretena', 'Spindle speed')} unit={RPM()} values={RADIAL_SPEEDS} value={ui.rpm} onChange={(v) => set('rpm', v)} locked={ui.running || tele.rpm > 1} lockNote={GEAR_LOCK()} /></div>
          <CutCalc D={ui.bit} mat="steel" speeds={RADIAL_SPEEDS} rpm={ui.rpm} locked={!stopped} onApply={(n) => set('rpm', n)} what={L('Priemer vrtáka', 'Drill diameter')} />
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Rameno a vreteník', 'Arm and head')}</h2>
          <Toggle on={ui.colLock} label={L('Stĺp upnutý (rameno sa neotáča ani nezdvíha)', 'Column clamped (the arm neither swings nor rises)')} onClick={() => set('colLock', !ui.colLock)} />
          <Toggle on={ui.headLock} label={L('Vreteník upnutý na ramene', 'Head clamped on the arm')} onClick={() => set('headLock', !ui.headLock)} />
          <Slider id="ra" label={L('Natočenie ramena α', 'Arm angle α')} unit="°" min={-95} max={95} step={0.01} value={ui.a} actual={tele.a} digits={2} onChange={(v) => set('a', v)} disabled={ui.colLock} />
          <div className="flex flex-wrap gap-2 mb-2">{[-1, -0.1, -0.01, 0.01, 0.1, 1].map((x) => <button key={x} type="button" className="btn" disabled={ui.colLock} onClick={() => nud('a', x, -95, 95, 2)}>α {x > 0 ? '+' : ''}{fmt(x, 2)}°</button>)}</div>
          <Slider id="rr" label={L('Vyloženie vreteníka R', 'Head reach R')} unit="mm" min={RA.RMIN * 100} max={RA.RMAX * 100} step={0.1} value={ui.R} actual={tele.R} digits={1} onChange={(v) => set('R', v)} disabled={ui.headLock} />
          <div className="flex flex-wrap gap-2 mb-2">{[-10, -1, -0.1, 0.1, 1, 10].map((x) => <button key={x} type="button" className="btn" disabled={ui.headLock} onClick={() => nud('R', x, RA.RMIN * 100, RA.RMAX * 100, 1)}>R {x > 0 ? '+' : ''}{fmt(x, x % 1 ? 1 : 0)}</button>)}</div>
          <Slider id="rh" label={L('Výška ramena (motor)', 'Arm height (motor)')} unit="mm" min={RA.HMIN * 100} max={RA.HMAX * 100} step={10} value={ui.H} actual={tele.H} digits={0} onChange={(v) => set('H', v)} disabled={ui.colLock} />
          <p className="text-xs muted">{L('Poloha vretena od stredu dosky je na displeji (X doprava, Y od obsluhy). Presúva sa len pri uvoľnených pákach a s vrtákom mimo obrobku.', 'The spindle position from the plate centre is on the display (X to the right, Y away from you). It moves only with the levers released and the drill out of the work.')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Vrták a posuv', 'Drill and feed')}</h2>
          <div className="flex flex-wrap gap-1.5 mb-2">{RADIAL_SIZES.map((d) => <button key={d} type="button" className={`btn ${ui.bit === d ? 'active' : ''}`} aria-pressed={ui.bit === d} onClick={() => set('bit', d)}>Ø{d}</button>)}</div>
          <p className="text-xs muted mb-2">{L(`Pre oceľ 20 – 30 m/min: pre Ø${ui.bit} približne ${rec} ot/min.`, `For steel 20 – 30 m/min: about ${rec} rpm for Ø${ui.bit}.`)}</p>
          <Slider id="rq" label={L('Výsuv pinoly', 'Quill extension')} unit="mm" min={0} max={RA.QMAX * 100} step={0.5} value={ui.quill} actual={tele.quill} digits={1} onChange={(v) => set('quill', v)} />
          <Toggle on={ui.autoF} label={L('Automatický posuv pinoly', 'Quill power feed')} onClick={() => set('autoF', !ui.autoF)} />
          <SegRow label={L('Posuv mm/ot', 'Feed mm/rev')} value={ui.feed} options={RADIAL_FEEDS.map((f) => [f, fmt(f, 2)])} onChange={(v) => set('feed', v)} />
          <Slider id="rs" label={L('Hĺbkový doraz (výsuv pinoly)', 'Depth stop (quill travel)')} unit="mm" min={10} max={RA.QMAX * 100} step={1} value={ui.stopQ} onChange={(v) => set('stopQ', v)} />
          <SegRow label={L('Zrýchlenie', 'Acceleration')} value={ui.timeScale} options={[[1, '1×'], [5, '5×'], [20, '20×']]} onChange={(v) => set('timeScale', v)} />
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Meranie dier', 'Hole measurement')}</h2>
          {mholes.length ? (
            <table className="text-xs tnum w-full" style={{ borderCollapse: 'collapse' }}>
              <thead><tr className="muted"><th className="text-left font-semibold">Ø</th><th className="text-right font-semibold">{L('hĺbka', 'depth')}</th><th className="text-right font-semibold">X / Y {L('od stredu', 'from centre')}</th></tr></thead>
              <tbody>{mholes.map((h, i) => <tr key={i}><td>{h.d}</td><td className="text-right">{h.through ? L('naskrz', 'through') : `${h.depth.toFixed(1)} mm`}</td><td className="text-right">{h.x.toFixed(1)} / {h.y.toFixed(1)}</td></tr>)}</tbody>
            </table>
          ) : <p className="text-xs muted">{L('Na doske zatiaľ nie sú diery.', 'There are no holes in the plate yet.')}</p>}
        </div>

        <BlankSection onApply={() => apiRef.current.newBlank && apiRef.current.newBlank()} applyLabel={L('Položiť novú dosku bez dier', 'Put down a new plate without holes')}>
          <Slider id="rbl" label={L('Dĺžka', 'Length')} unit="mm" min={250} max={450} step={10} value={ui.bL} onChange={(v) => set('bL', v)} />
          <Slider id="rbw" label={L('Šírka', 'Width')} unit="mm" min={200} max={420} step={10} value={ui.bW} onChange={(v) => set('bW', v)} />
          <Slider id="rbt" label={L('Hrúbka', 'Thickness')} unit="mm" min={15} max={50} step={5} value={ui.bT} onChange={(v) => set('bT', v)} />
        </BlankSection>

        <ExportSection machine="radialka" apiRef={apiRef} canStl={false} />
        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['rez', L('Detail vŕtania', 'Drilling detail')], ['zhora', L('Zhora', 'Top')], ['rameno', L('Rameno', 'Arm')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </fieldset></aside>
    </div>
  );
}

export { RadialSimulator };
export default RadialSimulator;
