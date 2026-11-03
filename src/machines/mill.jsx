import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { createHeightField } from '../core/heightField';
import { L, LL, RPM } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createDrops, createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp, fanAngles, logNear } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { exportStl } from '../core/export';
import { hfInfo, millChecks } from '../core/hfMath';
import { createSound } from '../core/sound';
import { CutCalc, ExportSection, TaskSection, fromB64, toB64 } from '../ui/tools';
import { BlankSection, GEAR_LOCK, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, StepSelect, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// UNIVERZÁLNA FRÉZA TOS FA 3 B
// =====================================================================
const MILL = {
  SPX: 0, SPZ: 1.2, NOSE: 10.4,           // os vretena a čelo vretena
  X0: -4, Y0: 0, H0: 4.2,                  // nulové polohy: posun stola, stred saní, výška stola
  CELL: 1.2, MAXV: 40000,                  // bunka výškovej mapy v mm, najviac vrcholov siete
};
const MILL_SPEEDS = [40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000];   // 3 × 6
const MILL_FEEDS = [19, 24, 30, 37.5, 47.5, 60, 75, 95, 118, 150, 190, 235, 300, 375, 475, 600, 750, 950];        // 3 × 6, mm/min
// knižnica fréz v normalizovaných priemeroch; len = vyloženie od čela vretena
const MILL_TOOL_LIST = [
  ...[6, 8, 10, 12, 16, 20, 25].map((d) => ({ id: `end${d}`, kind: 'end', d })),
  ...[6, 10, 16].map((d) => ({ id: `ball${d}`, kind: 'ball', d })),
  ...[50, 63, 80, 100].map((d) => ({ id: `face${d}`, kind: 'face', d })),
];
const MILL_TOOLS = Object.fromEntries(MILL_TOOL_LIST.map((t) => [t.id, { ...t, r: t.d / 200, len: t.kind === 'face' ? 1.15 : t.d <= 12 ? 1.3 : 1.5 }]));
const millToolName = (t) => `${t.kind === 'end' ? L('Stopková fréza', 'End mill') : t.kind === 'ball' ? L('Guľová fréza', 'Ball-nose mill') : L('Čelná fréza', 'Face mill')} Ø${t.d}`;
const S3_ANG = [0.75, 0, -0.75], S6_ANG = fanAngles(6, 1.15), DIR_ANG = [0.55, 0, -0.55];

const millParts = () => mkParts([
  ['podstavec', 'Podstavec', 'Base', 'Podstavec', 'Base', 'Liatinový podstavec nesie stojan a konzolu. V jeho dutine je nádrž chladiacej kvapaliny s čerpadlom a pod konzolou zdvíhacia skrutka.', 'The cast-iron base carries the column and the knee. Its cavity holds the coolant tank with the pump, and the elevating screw sits under the knee.'],
  ['stojan', 'Stojan', 'Column', 'Stojan', 'Column', 'Skriňový stojan s prevodovkou otáčok vretena. Na prednej strane má rybinové vedenie, po ktorom sa zvisle posúva konzola. Páky otáčok sú na pravom boku, lampa na ľavom.', 'Box column with the spindle speed gearbox. The front dovetail guides the knee vertically. The speed levers are on the right side, the lamp on the left.'],
  ['hlava', 'Vertikálna hlava', 'Vertical head', 'Sklopná vertikálna hlava', 'Swivelling vertical head', 'Frézovacia hlava s vretenom, ktorá sa dá natočiť okolo vodorovnej osi o ±45°. V modeli je nastavená zvisle. Ručné koliesko na boku vysúva pinolu.', 'Milling head with the spindle that can swivel ±45° about a horizontal axis. In the model it is set vertical. The small handwheel on the side moves the quill.'],
  ['vreteno', 'Vreteno a fréza', 'Spindle & cutter', 'Vreteno a nástroj', 'Spindle and tool', 'Vreteno s kužeľom ISO 40 nesie frézu v klieštinovom upínači alebo na tŕni: stopkové frézy Ø6 – Ø25, guľové Ø6 – Ø16 a čelné frézy Ø50 – Ø100 s vymeniteľnými doštičkami.', 'The ISO 40 spindle holds the cutter in a collet chuck or on an arbor: end mills Ø6 – Ø25, ball-nose mills Ø6 – Ø16 and face mills Ø50 – Ø100 with indexable inserts.'],
  ['konzola', 'Konzola', 'Knee', 'Konzola', 'Knee', 'Posúva sa po stojane zvisle (os Z) kľukou cez skrutku a kužeľové kolesá. Vpredu má ručné koleso priečneho posuvu, kľuku zdvihu a páky prevodovky posuvov.', 'Moves vertically on the column (Z axis) by the crank through a screw and bevel gears. At the front it has the cross feed handwheel, the elevating crank and the feed gearbox levers.'],
  ['sane', 'Priečne sane', 'Saddle', 'Priečne sane', 'Saddle', 'Sane jazdia po konzole k stojanu a od neho (os Y). Nesú pracovný stôl a páku automatického posuvu stola.', 'The saddle travels on the knee towards and away from the column (Y axis). It carries the table and the table feed lever.'],
  ['stol', 'Pracovný stôl', 'Table', 'Pracovný stôl', 'Work table', 'Stôl 1300 × 300 mm s tromi T-drážkami sa posúva pozdĺžne (os X) ručnými kolesami na koncoch alebo automatickým posuvom. Červené narážky vpredu obmedzujú posuv.', 'The 1300 × 300 mm table with three T-slots moves longitudinally (X axis) by the handwheels at its ends or by the power feed. The red dogs at the front limit the travel.'],
  ['zverak', 'Zverák', 'Vise', 'Strojný zverák', 'Machine vise', 'Zverák upnutý v T-drážkach drží obrobok medzi pevnou a posuvnou čeľusťou na rovnobežných podložkách. Fréza nesmie zasiahnuť čeľuste ani podložky.', 'The vise bolted in the T-slots holds the workpiece between the fixed and the moving jaw on parallels. The cutter must not touch the jaws or the parallels.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Obrobok', 'Workpiece', 'Oceľový hranol alebo kruhová tyč zvoleného rozmeru s tmavou okujenou povrchou. Pri bežiacom vretene fréza odoberá materiál a obrobená plocha je lesklá. Pri stojacom vretene do neho fréza nevnikne.', 'Steel block or round bar of the selected size with a dark mill-scale surface. With the spindle running the cutter removes material and the machined surface is bright. With the spindle stopped the cutter cannot enter it.'],
  ['rozvadzac', 'Rozvádzač', 'Control cabinet', 'Elektrický rozvádzač', 'Electrical cabinet', 'Na pravom boku stojana: ampérmeter, hlavný vypínač, tlačidlá Štart, Stop a chladenie a núdzový STOP. Pod ním sú páky otáčok vretena.', 'On the right side of the column: ammeter, main switch, Start, Stop and coolant buttons and the emergency stop. The spindle speed levers are below it.'],
]);

// pôdorys obrobku s drážkou alebo zarovnanou plochou (rozmery v mm)
const TopSketch = ({ L: len, W, band, label, dims }) => {
  const k = Math.min(260 / len, 80 / W), x0 = 20, y0 = 14;
  return (
    <svg viewBox="0 0 300 118" width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      <rect x={x0} y={y0} width={len * k} height={W * k} fill="none" stroke="currentColor" strokeWidth="1.4" />
      {band && <rect x={x0} y={y0 + (W - band) / 2 * k} width={len * k} height={band * k} fill="currentColor" opacity="0.25" stroke="currentColor" strokeDasharray="4 2" />}
      {!band && <rect x={x0 + 2} y={y0 + 2} width={len * k - 4} height={W * k - 4} fill="currentColor" opacity="0.18" />}
      {dims.map(([t, x, y], i) => <text key={i} x={x} y={y} fontSize="10" fill="currentColor" fontFamily="var(--f-mono)">{t}</text>)}
    </svg>
  );
};
const MILL_TASKS = [
  { id: 'drazka', title: () => L('Drážka 20 × 5 mm cez celú dĺžku', 'Slot 20 × 5 mm along the whole length'),
    desc: () => L('Hranol 180 × 100 × 60 mm. Stopkovou frézou Ø20 vyfrézuj v strede šírky pozdĺžnu drážku hĺbky 5 ±0,15 mm cez celú dĺžku. Hĺbku nastav konzolou (Z) od dotyku, drážku veď posuvom stola X. Šírka sa meria s presnosťou siete (~1,2 mm).', 'Block 180 × 100 × 60 mm. With a Ø20 end mill cut a longitudinal slot 5 ±0.15 mm deep along the whole length, centred in the width. Set the depth with the knee (Z) from the touch-off, feed the table along X. The width is measured to the grid resolution (~1.2 mm).'),
    setup: { bShape: 'block', bL: 180, bW: 100, bH: 60, tool: 'end20', rpm: 315 },
    drawing: () => <TopSketch L={180} W={100} band={20} label="drážka 20 × 5" dims={[['180', 140, 112], ['20', 268, 66], ['hĺbka 5 ±0,15', 24, 10]]} />,
    labels: { depth: () => L('Hĺbka drážky 5 ±0,15 mm', 'Slot depth 5 ±0.15 mm'), width: () => L('Šírka drážky 20 mm', 'Slot width 20 mm'), len: () => L('Drážka cez celú dĺžku (≥ 95 %)', 'Slot along the whole length (≥ 95 %)'), center: () => L('Drážka v strede šírky', 'Slot centred in the width') } },
  { id: 'rovina', title: () => L('Zarovnanie hornej plochy o 2 mm', 'Facing the top by 2 mm'),
    desc: () => L('Hranol 180 × 100 × 60 mm. Čelnou frézou Ø100 zarovnaj celú hornú plochu o 2 ±0,1 mm. Najprv sa dotkni plochy, potom zdvihni konzolu o 2 mm a prejdi stolom cez celú dĺžku.', 'Block 180 × 100 × 60 mm. With the Ø100 face mill take 2 ±0.1 mm off the whole top surface. Touch off first, then raise the knee by 2 mm and traverse the table along the whole length.'),
    setup: { bShape: 'block', bL: 180, bW: 100, bH: 60, tool: 'face100', rpm: 80 },
    drawing: () => <TopSketch L={180} W={100} label="rovina" dims={[['180', 140, 112], ['−2 ±0,1', 120, 66]]} />,
    labels: { share: () => L('Plocha znížená o 2 ±0,1 mm (≥ 95 %)', 'Surface lowered by 2 ±0.1 mm (≥ 95 %)'), max: () => L('Nikde hlbšie ako 2,1 mm', 'Nowhere deeper than 2.1 mm') } },
].map((t) => ({ ...t, checks: (m) => millChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const MILL_SAFETY = () => [
  L('Obrobok je pevne upnutý vo zveráku, kľúč od zveráka je odložený.', 'The workpiece is clamped firmly in the vise, the vise handle is put away.'),
  L('Fréza je upnutá v klieštine a dotiahnutá.', 'The cutter is clamped in the collet and tightened.'),
  L('Mám ochranné okuliare, bez rukavíc; triesky neodstraňujem rukou.', 'I wear safety glasses, no gloves; I do not remove chips by hand.'),
  L('Aretácie osí, ktoré sa nemajú hýbať, sú zaistené.', 'The axes that must not move are clamped.'),
];

function MillSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { running: false, power: true, coolant: false, light: true, manual: false, rpm: 400, x: 400, y: 120, z: 150, feedDir: 0, feed: 118, timeScale: 10, tool: 'end20', quill: 0, quillLock: false, kneeLock: false, sadLock: false,
    bShape: 'block', bL: 180, bW: 100, bH: 60, bD: 60, probe: false, px: 90, pz: 50 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, x: 400, y: 120, z: 150, q: 0, vc: 0, vf: 0, msg: null, cutting: false, depth: 0, tool: 'end20', changing: false });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { SPX, SPZ, NOSE, X0, Y0, H0 } = MILL;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('mill');
    const dom = renderer.domElement;

    const M = {
      ...baseMats(0x5aa99e, 0x47928a, 0x35736c),
      cream: std(0xdedbcb, 0.6, 0.05), creamDark: std(0xc2bead, 0.62, 0.05), motor: std(0xd4d6d2, 0.5, 0.3),
      vise: std(0x5b646d, 0.5, 0.55), cutter: std(0x3a3f44, 0.28, 0.85, { side: THREE.DoubleSide }), gauge: std(0xf3f1e8, 0.5, 0),
      chip: std(0x9aa3ad, 0.3, 0.85), lampShade: std(0xdedbcb, 0.5, 0.2),
      coolant: new THREE.MeshStandardMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0, emissive: 0x1a4a6a, emissiveIntensity: 0.5 }),
      work: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.78, flatShading: true, side: THREE.DoubleSide }),
      raw: std(0x474b50, 0.34, 0.78, { side: THREE.DoubleSide }),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, pivotLever, detents, handwheel, crank, face } = kit;
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- podstavec ----------
    const base = grp('podstavec');
    box(base, -1.9, 1.9, 0.1, 0.45, -4.6, 3.8, M.green);
    box(base, -2.0, 2.0, 0, 0.1, -4.7, 3.9, M.greenDeep);
    box(base, -1.3, 1.3, 0.16, 0.4, 3.8, 3.82, M.greenDark);         // kryt nádrže chladiva
    cylZ(base, 0.09, 0.09, 3.82, 3.92, 1.0, 0.28, M.black, 12);
    cylY(base, 0.3, 0.3, 0.45, 0.6, 0, 1.0, M.greenDark, 24);         // pätka zdvíhacej skrutky
    const ramGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 20); ramGeo.translate(0, 0.5, 0);
    const ram = add(base, ramGeo, M.steel, 0, 0.6, 1.0);

    // ---------- stojan ----------
    const col = grp('stojan');
    box(col, -1.5, 1.5, 0.45, 13.4, -4.4, -1.6, M.green);
    box(col, -1.6, 1.6, 13.4, 13.6, -4.5, -1.5, M.greenDark);
    box(col, -1.15, -0.75, 0.45, 13.4, -1.6, -1.52, M.ways);          // rybinové vedenie konzoly
    box(col, 0.75, 1.15, 0.45, 13.4, -1.6, -1.52, M.ways);
    box(col, -1.52, -1.5, 1.4, 6.0, -4.0, -2.0, M.greenDark);         // bočné dvierka
    cylX(col, 0.05, 0.05, -1.56, -1.52, 3.7, -2.3, M.black, 10);
    box(col, -0.75, 0.75, 6.4, 9.6, -4.75, -4.4, M.greenDark);         // kryt remeňa vzadu
    box(col, -0.65, 0.65, 7.3, 7.45, -5.9, -4.75, M.greenDeep);       // konzola motora
    cylX(col, 0.62, 0.62, -0.85, 0.95, 8.1, -5.3, M.motor, 32);       // hlavný motor vzadu
    for (let k = 0; k < 10; k++) { const a = k * TAU / 10; const f = add(col, new THREE.BoxGeometry(1.5, 0.08, 0.05), M.motor, 0.05, 8.1 + Math.sin(a) * 0.64, -5.3 + Math.cos(a) * 0.64); f.rotation.x = -a; }
    cylX(col, 0.5, 0.45, 0.95, 1.15, 8.1, -5.3, M.motor, 24);
    box(col, -0.35, 0.35, 8.75, 9.15, -5.55, -5.05, M.motor);          // svorkovnica
    // horné rameno (pre vodorovné frézovanie) siaha dozadu nad motor
    box(col, -0.78, 0.78, 13.6, 14.35, -6.1, -1.55, M.green);
    cylX(col, 0.375, 0.375, -0.78, 0.78, 13.975, -6.1, M.green, 24);
    box(col, -0.82, 0.82, 13.55, 13.62, -4.4, -1.55, M.greenDark);
    // digitálny odmeriavač na ramene
    cylY(col, 0.05, 0.05, 14.35, 15.2, 0.5, -2.2, M.steel, 10);
    box(col, -0.4, 1.4, 15.15, 16.05, -2.42, -2.12, M.panel);
    const droCanvas = document.createElement('canvas'); droCanvas.width = 256; droCanvas.height = 128;
    const droTex = new THREE.CanvasTexture(droCanvas); droTex.colorSpace = THREE.SRGBColorSpace;
    add(col, new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: droTex, toneMapped: false }), 0.5, 15.6, -2.115);
    let droKey = '';
    const drawDro = (x, y, z) => {
      const key = `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}`; if (key === droKey) return; droKey = key;   // textúra sa mení len pri zmene údaja
      const g = droCanvas.getContext('2d');
      g.fillStyle = '#071008'; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#ff5a3c'; g.font = 'bold 34px "Share Tech Mono", Consolas, monospace';
      [['X', x], ['Y', y], ['Z', z]].forEach(([l, v], i) => { g.fillText(l, 12, 36 + i * 40); g.fillText(v.toFixed(2).padStart(7, ' '), 64, 36 + i * 40); });
      droTex.needsUpdate = true;
    };
    const sp = face(col, 1.5, 0, -3.0, Math.PI / 2);                  // panel pák otáčok na pravom boku
    box(sp, -0.95, 0.95, 6.15, 7.95, 0, 0.02, M.greenDark);
    box(sp, -0.7, 0.7, 6.3, 6.68, 0.02, 0.035, M.white);               // tabuľka otáčok
    [[-0.45, 7.3], [0.4, 7.3]].forEach(([x, y]) => cylZ(sp, 0.32, 0.28, 0.02, 0.2, x, y, M.black, 28));
    detents(sp, -0.45, 7.3, 0.2, 0.21, S3_ANG); detents(sp, 0.4, 7.3, 0.2, 0.21, S6_ANG, 0.028);
    const levSA = pivotLever(sp, -0.45, 7.3, 0.2, 0.5, 1.15), levSB = pivotLever(sp, 0.4, 7.3, 0.2, 0.5, 1.15);
    // pracovná lampa na ľavom boku stojana
    box(col, -1.75, -1.5, 9.0, 9.35, -2.0, -1.7, M.greenDark);
    const lamp = createLamp(scene, col, kit, M, { base: v3(-1.62, 9.45, -1.85), elbow: v3(-2.6, 11.3, -0.6), head: v3(-1.95, 10.95, 1.75), aim: v3(0.0, 7.0, 1.2), angle: 0.45, power: 3.2 });

    // ---------- elektrický rozvádzač ----------
    const cab = grp('rozvadzac');
    box(cab, 1.5, 2.2, 8.2, 11.2, -3.9, -2.1, M.green);
    const cf = face(cab, 2.2, 0, -3.0, Math.PI / 2);
    box(cf, -0.85, 0.85, 8.3, 11.1, 0, 0.015, M.greenDark);
    cylZ(cf, 0.25, 0.25, 0.015, 0.06, -0.45, 10.6, M.black, 28);        // ampérmeter
    cylZ(cf, 0.21, 0.21, 0.06, 0.066, -0.45, 10.6, M.gauge, 28);
    const needle = box(cf, -0.012, 0.012, 0, 0.17, 0.067, 0.072, M.red); needle.position.set(-0.45, 10.6, 0.07); needle.geometry.translate(0, 0.085, 0);
    ball(cf, 0.08, 0.2, 10.75, 0.03, M.lamp);
    box(cf, 0.15, 0.8, 9.95, 10.5, 0.015, 0.03, M.yellow);             // hlavný vypínač
    box(cf, 0.455, 0.495, 10.38, 10.47, 0.03, 0.035, M.black);
    add(cf, new THREE.TorusGeometry(0.03, 0.009, 6, 16), M.black, 0.21, 10.22, 0.033);
    const mainSwitch = new THREE.Group(); mainSwitch.position.set(0.475, 10.22, 0.03); cf.add(mainSwitch);
    cylZ(mainSwitch, 0.19, 0.19, 0, 0.07, 0, 0, M.black, 24);
    box(mainSwitch, -0.24, 0.24, -0.05, 0.05, 0.07, 0.19, M.red);
    const pbtn = (x, y, m) => { const g = new THREE.Group(); g.position.set(x, y, 0.015); cf.add(g); cylZ(g, 0.11, 0.11, 0, 0.08, 0, 0, m, 20); hitProxy(g, 0.16, 0, 0, 0.06); return g; };
    const btnStart = pbtn(-0.55, 9.45, M.btnGreen), btnStop = pbtn(-0.2, 9.45, M.red), btnCool = pbtn(0.15, 9.45, M.blue);
    box(cf, -0.75, 0.35, 9.15, 9.25, 0.015, 0.025, M.white);
    box(cf, 0.25, 0.75, 8.5, 9.0, 0.015, 0.025, M.yellow);
    const eStop = new THREE.Group(); eStop.position.set(0.5, 8.75, 0.025); cf.add(eStop);
    cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16); cylZ(eStop, 0.19, 0.18, 0.07, 0.16, 0, 0, M.red, 24); hitProxy(eStop, 0.25, 0, 0, 0.1);
    // kábel z rozvádzača k hlavnému motoru vzadu
    const cableTo = (pts, r = 0.05) => add(cab, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false), M.black);
    cableTo([v3(1.9, 11.2, -3.7), v3(1.85, 11.9, -4.2), v3(1.65, 10.6, -4.75), v3(0.95, 9.35, -5.05), v3(0.36, 9.0, -5.3)]);
    box(cab, 1.7, 2.05, 11.2, 11.3, -3.85, -3.55, M.black);
    box(cab, 1.8, 2.15, 8.1, 8.2, -2.55, -2.25, M.black);

    // ---------- sklopná vertikálna hlava ----------
    const head = grp('hlava');
    cylZ(head, 1.25, 1.25, -1.6, -1.38, 0, 12.25, M.greenDark, 48);    // príruba na stojane
    cylZ(head, 1.1, 1.1, -1.38, -1.05, 0, 12.25, M.green, 48);         // otočný bubon
    add(head, new THREE.TorusGeometry(1.1, 0.02, 6, 48), M.white, 0, 12.25, -1.2);
    box(head, -0.95, 0.95, 11.2, 13.3, -1.05, SPZ, M.green);
    cylY(head, 0.95, 0.95, 11.2, 13.3, SPX, SPZ, M.green, 40);
    box(head, -0.98, 0.98, 13.3, 13.45, -1.05, SPZ, M.greenDark);
    cylY(head, 0.98, 0.98, 13.3, 13.45, SPX, SPZ, M.greenDark, 40);
    cylY(head, 0.55, 0.55, 10.7, 11.2, SPX, SPZ, M.greenDark, 32);      // puzdro pinoly
    cylX(head, 0.08, 0.08, 0.95, 1.15, 11.9, 0.3, M.steel, 12);
    const wheelQ = handwheel(head, 0.32, 1.2, 11.9, 0.3, 'x', 0.22);    // koliesko pinoly
    cylZ(head, 0.09, 0.09, SPZ + 0.15, SPZ + 0.28, -0.62, 11.0, M.steelDark, 12);
    const levQ = pivotLever(head, -0.62, 11.0, SPZ + 0.28, 0.35, 0.9);      // aretácia pinoly
    // kĺbová hadica chladiva z boku hlavy, dýza mieri na rezné miesto
    box(head, 0.42, 0.68, 11.08, 11.2, 1.55, 1.8, M.steelDark);           // držiak hadice pod hlavou (mimo kolieska pinoly)
    const hose = new THREE.CatmullRomCurve3([v3(0.55, 11.1, 1.68), v3(0.95, 10.92, 2.08), v3(0.92, 10.4, 2.08), v3(0.62, NOSE - 0.45, SPZ + 0.62)]);
    add(head, new THREE.TubeGeometry(hose, 40, 0.05, 8, false), M.black);
    for (let k = 1; k < 6; k++) { const p = hose.getPoint(k / 6); ball(head, 0.065, p.x, p.y, p.z, M.black); }   // článkovaná hadica
    const nozzle = v3(0.62, NOSE - 0.45, SPZ + 0.62);
    cylY(head, 0.03, 0.06, nozzle.y - 0.12, nozzle.y + 0.02, nozzle.x, nozzle.z, M.steel, 12);

    // ---------- vreteno a nástroj ----------
    const spindle = grp('vreteno'); spindle.position.set(SPX, NOSE, SPZ);
    cylY(spindle, 0.42, 0.42, 0, 0.3, 0, 0, M.steel, 40);
    cylY(spindle, 0.4, 0.4, 0.3, 1.15, 0, 0, M.steel, 32);             // pinola (pri vysunutí viditeľná)
    box(spindle, -0.42, -0.3, -0.06, 0.02, -0.08, 0.08, M.steelDark);
    box(spindle, 0.3, 0.42, -0.06, 0.02, -0.08, 0.08, M.steelDark);
    const toolG = new THREE.Group(); spindle.add(toolG);
    // šróbovicové drážky: prierez so zubami pootočený pozdĺž osi (stúpanie 30°)
    const fluteGeo = (r, h, nf) => {
      const seg = 56, rows = 28, pos = [], idx = [], tw = Math.tan(0.52) / r;
      for (let j = 0; j <= rows; j++) {
        const y = -h * j / rows;
        for (let i = 0; i <= seg; i++) {
          const th = i / seg * TAU, u = ((((th + y * tw) * nf) / TAU) % 1 + 1) % 1;
          const rr = r * (1 - 0.32 * Math.pow(Math.sin(Math.PI * clamp((u - 0.15) / 0.85, 0, 1)), 1.3));
          pos.push(Math.cos(th) * rr, y, Math.sin(th) * rr);
        }
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      const c0 = pos.length / 3; pos.push(0, -h, 0);
      for (let i = 0; i < seg; i++) idx.push(c0, rows * (seg + 1) + i, rows * (seg + 1) + i + 1);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const buildTool = (id) => {
      while (toolG.children.length) { const o = toolG.children[0]; toolG.remove(o); if (o.geometry) o.geometry.dispose(); }
      const tl = MILL_TOOLS[id], r = tl.r, len = tl.len;
      cylY(toolG, 0.38, 0.38, -0.15, 0, 0, 0, M.steelDark, 32);
      if (tl.kind !== 'face') {
        cylY(toolG, 0.2, 0.27, -0.6, -0.15, 0, 0, M.steelDark, 28);          // klieštinový upínač
        cylY(toolG, 0.23, 0.23, -0.72, -0.6, 0, 0, M.steel, 6);               // matica
        const fl = clamp(r * 4.2, 0.2, 0.5), fEnd = tl.kind === 'ball' ? -len + r : -len;
        cylY(toolG, r * 0.98, r * 0.98, fEnd + fl, -0.72, 0, 0, M.steel, 24);   // driek
        add(toolG, fluteGeo(r, fl - (tl.kind === 'ball' ? 0 : 0), r < 0.05 ? 2 : r < 0.09 ? 3 : 4), M.cutter, 0, fEnd + fl, 0);
        if (tl.kind === 'ball') add(toolG, new THREE.SphereGeometry(r * 0.99, 24, 12, 0, TAU, Math.PI / 2, Math.PI / 2), M.cutter, 0, fEnd, 0);
      } else {
        const n = { 50: 4, 63: 5, 80: 6, 100: 7 }[tl.d] || 5;
        cylY(toolG, 0.2, 0.2, -0.6, -0.15, 0, 0, M.steelDark, 24);           // tŕň
        cylY(toolG, r * 0.93, r * 0.8, -len + 0.03, -0.6, 0, 0, M.cutter, 48);
        cylY(toolG, 0.16, 0.16, -0.68, -0.58, 0, 0, M.steel, 6);
        for (let k = 0; k < n; k++) {
          const a = k * TAU / n;
          const gul = add(toolG, new THREE.BoxGeometry(0.14, 0.2, 0.09), M.black, Math.cos(a) * (r - 0.05), -len + 0.12, Math.sin(a) * (r - 0.05)); gul.rotation.y = -a;
          const ins = add(toolG, new THREE.BoxGeometry(0.1, 0.11, 0.04), M.insert, Math.cos(a) * (r - 0.03), -len + 0.055, Math.sin(a) * (r - 0.03)); ins.rotation.y = -a + 0.25;
        }
      }
    };

    // ---------- konzola ----------
    const knee = grp('konzola');
    box(knee, -1.5, 1.5, -2.4, 0, -1.6, 3.4, M.green);
    box(knee, -1.3, -0.9, 0, 0.05, -1.5, 3.3, M.ways);
    box(knee, 0.9, 1.3, 0, 0.05, -1.5, 3.3, M.ways);
    box(knee, -1.55, 1.55, -0.14, 0, 3.4, 3.44, M.greenDark);
    box(knee, -1.3, -0.1, -0.24, -0.16, 3.4, 3.42, M.white);           // tabuľka posuvov
    [[-1.0, -0.6], [-0.4, -0.6]].forEach(([x, y]) => cylZ(knee, 0.24, 0.2, 3.4, 3.55, x, y, M.black, 24));
    detents(knee, -1.0, -0.6, 3.55, 0.15, S3_ANG, 0.025); detents(knee, -0.4, -0.6, 3.55, 0.15, S6_ANG, 0.02);
    const levFA = pivotLever(knee, -1.0, -0.6, 3.55, 0.38, 1.2), levFB = pivotLever(knee, -0.4, -0.6, 3.55, 0.38, 1.2);
    cylZ(knee, 0.2, 0.2, 3.4, 3.5, 0.75, -1.35, M.steelDark, 24);
    cylZ(knee, 0.08, 0.08, 3.5, 3.62, 0.75, -1.35, M.steel, 12);
    const wheelY = handwheel(knee, 0.5, 0.75, -1.35, 3.68, 'z', 0.35);
    cylZ(knee, 0.16, 0.16, 3.4, 3.52, -0.8, -1.55, M.steelDark, 20);
    const crankZ = crank(knee, 0.45, -0.8, -1.55, 3.56);
    const levKnee = pivotLever(knee, 1.15, -0.45, 3.42, 0.36, 1.2);       // aretácia konzoly

    // ---------- priečne sane ----------
    const sad = grp('sane', knee);
    box(sad, -1.45, 1.45, 0.05, 0.6, -0.95, 0.95, M.green);
    cylZ(sad, 0.2, 0.17, 0.95, 1.07, 0.75, 0.3, M.black, 20);
    detents(sad, 0.75, 0.3, 1.07, 0.12, DIR_ANG, 0.022);
    const levDir = pivotLever(sad, 0.75, 0.3, 1.07, 0.32, 1.25);
    const levSad = pivotLever(sad, -0.9, 0.3, 0.97, 0.3, 1.2);           // aretácia saní
    box(sad, 1.45, 1.6, 0.18, 0.44, -0.12, 0.12, M.black);                // prípojka motora posuvov
    const sadCable = new THREE.Mesh(new THREE.BufferGeometry(), M.black); sadCable.castShadow = true; root.add(sadCable);
    let sadCableKey = '';
    const updateSadCable = (h, sz) => {
      const key = `${h.toFixed(3)}|${sz.toFixed(3)}`; if (key === sadCableKey) return; sadCableKey = key;
      const e = v3(1.6, h - 1.35 + 0.31, sz);
      const curve = new THREE.CatmullRomCurve3([v3(2.0, 8.1, -2.4), v3(2.2, Math.min(7.6, e.y + 1.4), -2.1), v3(2.1, e.y - 0.55, e.z - 0.6), v3(1.8, e.y - 0.08, e.z - 0.12), e]);
      sadCable.geometry.dispose(); sadCable.geometry = new THREE.TubeGeometry(curve, 40, 0.05, 8, false);
    };

    // ---------- pracovný stôl ----------
    const tbl = grp('stol', sad); tbl.position.y = 0.6;
    box(tbl, -6.5, 6.5, 0, 0.6, -1.5, 1.5, M.green);
    box(tbl, -6.5, 6.5, 0.6, 0.75, -1.5, 1.5, M.ways);
    [-0.9, 0, 0.9].forEach((z) => box(tbl, -6.5, 6.5, 0.7, 0.752, z - 0.09, z + 0.09, M.steelDark));
    box(tbl, -6.5, 6.5, 0.12, 0.5, 1.5, 1.58, M.greenDark);
    [-3.6, 3.6].forEach((x) => box(tbl, x - 0.12, x + 0.12, 0.08, 0.55, 1.58, 1.72, M.red));
    box(tbl, -6.85, -6.5, 0.05, 0.6, -0.35, 0.35, M.green);
    box(tbl, 6.5, 6.85, 0.05, 0.6, -0.35, 0.35, M.green);
    cylX(tbl, 0.07, 0.07, -7.0, -6.85, 0.32, 0, M.steel, 12);
    cylX(tbl, 0.07, 0.07, 6.85, 7.0, 0.32, 0, M.steel, 12);
    const wheelXL = handwheel(tbl, 0.45, -7.05, 0.32, 0, '-x', 0.32), wheelXR = handwheel(tbl, 0.45, 7.05, 0.32, 0, 'x', 0.32);

    const recolor = (g) => g.traverse((o) => { if (!o.isMesh) return; if (o.material === M.green) o.material = M.cream; else if (o.material === M.greenDark || o.material === M.greenDeep) o.material = M.creamDark; });
    [head, knee].forEach(recolor);

    // ---------- zverák: pevná čeľusť vzadu (z = -0,5), posuvná sa prispôsobí šírke obrobku ----------
    const wk = { shape: 'block', WX: 1.8, WZ: 1.0, WH: 0.6, WB: 0.45 };
    const wzc = () => -0.5 + wk.WZ / 2;
    const vise = grp('zverak', tbl); vise.position.y = 0.75;
    box(vise, -1.25, 1.25, 0, 0.35, -0.95, 0.95, M.vise);
    box(vise, -1.25, 1.25, 0.35, 0.85, -0.95, -0.5, M.vise);
    box(vise, -1.1, 1.1, 0.4, 0.82, -0.52, -0.5, M.steel);
    const jawM = new THREE.Group(); vise.add(jawM);
    box(jawM, -1.1, 1.1, 0.35, 0.85, 0.5, 0.95, M.vise);
    box(jawM, -1.1, 1.1, 0.4, 0.82, 0.5, 0.52, M.steel);
    cylZ(vise, 0.08, 0.08, 0.95, 1.55, 0, 0.55, M.steel, 16);
    cylZ(vise, 0.13, 0.13, 1.55, 1.68, 0, 0.55, M.steelDark, 16);
    box(vise, -0.45, 0.45, 0.51, 0.59, 1.6, 1.66, M.steel);
    ball(vise, 0.06, -0.47, 0.55, 1.63, M.black); ball(vise, 0.06, 0.47, 0.55, 1.63, M.black);
    const pars = new THREE.Group(); vise.add(pars);
    const buildParallels = () => {
      while (pars.children.length) { const o = pars.children[0]; pars.remove(o); o.geometry.dispose(); }
      const z0 = -0.5, z1 = -0.5 + wk.WZ;
      box(pars, -0.95, 0.95, 0.35, wk.WB, z0 + 0.03, z0 + 0.15, M.steel);
      box(pars, -0.95, 0.95, 0.35, wk.WB, z1 - 0.15, z1 - 0.03, M.steel);
    };
    const obstacles = () => [
      { x0: -1.25, x1: 1.25, z0: -0.95, z1: 0.95, top: 0.35, name: L('zveráka', 'the vise') },
      { x0: -1.25, x1: 1.25, z0: -0.95, z1: -0.5, top: 0.85, name: L('pevnej čeľuste zveráka', 'the fixed vise jaw') },
      { x0: -1.1, x1: 1.1, z0: -0.5 + wk.WZ, z1: -0.05 + wk.WZ, top: 0.85, name: L('posuvnej čeľuste zveráka', 'the moving vise jaw') },
      { x0: -0.95, x1: 0.95, z0: -0.5, z1: -0.5 + wk.WZ, top: wk.WB, name: L('podložiek', 'the parallels') },
      { x0: -0.5, x1: 0.5, z0: 0.95, z1: 1.75, top: 0.72, name: L('skrutky zveráka', 'the vise screw') },
      { x0: -6.5, x1: 6.5, z0: -1.5, z1: 1.5, top: 0, name: L('stola', 'the table') },
    ];

    // ---------- obrobok: výšková mapa ----------
    let hf = null;
    const makeWork = () => {
      if (hf) { tbl.remove(hf.mesh); hf.mesh.children.forEach((o) => o.geometry.dispose()); hf.dispose(); }
      const R = wk.WZ / 2;
      // rozlíšenie podľa rozmeru kusu: ~1,2 mm na bunku, pri veľkom kuse hrubšie, aby sieť nemala viac ako MAXV vrcholov
      const k = Math.max(1, Math.sqrt((wk.WX * 100 / MILL.CELL) * (wk.WZ * 100 / MILL.CELL) / MILL.MAXV));
      const NX = Math.max(40, Math.round(wk.WX * 100 / MILL.CELL / k)), NZ = Math.max(20, Math.round(wk.WZ * 100 / MILL.CELL / k));
      hf = createHeightField({ NX, NZ, W: wk.WX, D: wk.WZ, H: wk.WH, raw: 0x474b50, cut: 0xdfe3e7, mat: M.work, base: wk.shape === 'round' ? R : 0,
        init: wk.shape === 'round' ? (x, z) => R + Math.sqrt(Math.max(0, R * R - z * z)) : null });
      if (wk.shape === 'round') {
        const lg = new THREE.CylinderGeometry(R, R, wk.WX, 40, 1, false, Math.PI, Math.PI); lg.rotateZ(Math.PI / 2);
        const low = new THREE.Mesh(lg, M.raw); low.position.y = R; low.castShadow = true; low.receiveShadow = true; hf.mesh.add(low);
      }
      hf.mesh.position.set(0, 0.75 + wk.WB, wzc()); hf.mesh.userData.part = 'obrobok';
      tbl.add(hf.mesh); G.obrobok = hf.mesh;
      buildParallels();
    };
    makeWork();
    const eachIn = (rx, rz, r, fn, write) => (write ? hf.cutRect : hf.eachRect)(rx - r, rx + r, rz - r, rz + r, (k, x, z) => { const d2 = (x - rx) * (x - rx) + (z - rz) * (z - rz); if (d2 <= r * r) fn(k, d2); });
    const limOf = (tl, wy, d2) => (tl.kind === 'ball' ? wy + tl.r - Math.sqrt(Math.max(0, tl.r * tl.r - d2)) : wy);
    // súradnice voči obrobku: rx, rz od stredu, wy = spodok nástroja nad spodkom obrobku
    const penetration = (rx, rz, wy, tl) => { let p = 0; eachIn(rx, rz - wzc(), tl.r, (k, d2) => { const v = hf.hgt[k] - limOf(tl, wy, d2); if (v > p) p = v; }); return p; };
    const cut = (rx, rz, wy, tl) => {
      let removed = 0;
      eachIn(rx, rz - wzc(), tl.r, (k, d2) => { const lim = Math.max(0, limOf(tl, wy, d2)); if (hf.hgt[k] > lim + 1e-4) { removed += hf.hgt[k] - lim; hf.hgt[k] = lim; hf.mask[k] = 1; } }, true);
      return removed;
    };
    const hitObst = (rx, rz, ry, r) => {
      for (const o of obstacles()) {
        if (ry >= o.top - 1e-4) continue;
        const dx = Math.max(o.x0 - rx, 0, rx - o.x1), dz = Math.max(o.z0 - rz, 0, rz - o.z1);
        if (dx * dx + dz * dz < r * r) return o.name;
      }
      return null;
    };

    // ---------- chladiaca kvapalina a triesky ----------
    const stream = add(head, new THREE.CylinderGeometry(0.02, 0.04, 1, 10, 1, true), M.coolant);
    stream.castShadow = false; stream.visible = false;
    const streamEnd = () => { const tl = MILL_TOOLS[st.tool]; return v3(SPX + tl.r * 0.7, NOSE - st.q - tl.len + 0.15, SPZ + tl.r * 0.7); };
    const placeStream = () => {
      const to = streamEnd(), dir = to.clone().sub(nozzle);
      stream.position.copy(nozzle).addScaledVector(dir, 0.5);
      stream.scale.set(1, dir.length(), 1);
      stream.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.normalize());
    };
    const chipsP = createParticles(scene, new THREE.BoxGeometry(0.05, 0.012, 0.08), M.chip, 160);
    const drops = createDrops(scene);
    let chipAcc = 0, dropAcc = 0;

    // ---------- stav simulácie ----------
    const st = { tx: X0 + c.x / 100, sz: Y0 + c.y / 100, h: H0 + c.z / 100, q: c.quill / 100, rpm: 0, spin: 0, cutT: -9, cutting: false, tool: c.tool, msg: null, change: null };
    let t = 0, last = performance.now(), teleT = 0, workDirty = false, lastBuild = 0, lastDir = c.feedDir;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 2.6 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const yT = (tool = st.tool, q = st.q) => NOSE - q - MILL_TOOLS[tool].len;
    // poloha spodku nástroja voči stredu a hornej ploche stola (vrátane výsuvu pinoly)
    const rel = (tx, sz, h, tool = st.tool, q = st.q) => [SPX - tx, SPZ - sz, yT(tool, q) - h];
    buildTool(st.tool); placeStream();
    const spawnChip = () => {
      const tl = MILL_TOOLS[st.tool], a = Math.random() * TAU, s = 1.5 + Math.random() * 2;
      chipsP.spawn(v3(SPX + Math.cos(a) * tl.r, yT() + 0.04 + Math.random() * 0.08, SPZ + Math.sin(a) * tl.r),
        v3(Math.cos(a) * s + Math.sin(a) * 2, 0.8 + Math.random() * 1.8, Math.sin(a) * s - Math.cos(a) * 2), 2.5 + Math.random() * 1.5);
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
      obrobok: () => v3(st.tx - 0.6, st.h + wk.WB + wk.WH + 0.05, st.sz + wzc()),
      rozvadzac: () => v3(2.2, 11.3, -3.0),
    };
    const views = {
      celok: () => [[10, 12.5, 17], [0, 7.2, 0]],
      rez: () => [[SPX + 1.9, yT() + 3.1, SPZ + 3.4], [SPX, yT() - 0.45, SPZ - 0.1], true],
      spredu: () => [[0, 8.5, 20], [0, 7.2, 0]],
      zhora: () => [[0.5, 24, 9], [0, 6.8, 0.8]],
      bok: () => [[11, 9.5, 2.5], [1.6, 8.6, -2.6], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);
    // meranie, uloženie a export obrobku
    apiRef.current.measure = () => ({ info: hfInfo(hf) });
    apiRef.current.save = () => {
      if (c.unclamped) { say(L('Najprv upni polotovar späť.', 'Clamp the workpiece back first.')); return null; }
      return { v: 1, wk: { ...wk }, NX: hf.NX, NZ: hf.NZ, hgt: toB64(hf.hgt), mask: toB64(hf.mask) };
    };
    apiRef.current.load = (r) => {
      if (!r || r.v !== 1 || !r.wk) return false;
      push('bShape', r.wk.shape); push('bL', Math.round(r.wk.WX * 100));
      if (r.wk.shape === 'round') push('bD', Math.round(r.wk.WZ * 100)); else { push('bW', Math.round(r.wk.WZ * 100)); push('bH', Math.round(r.wk.WH * 100)); }
      const out = apiRef.current.newBlank(); if (!out) return false;
      Object.entries(out).forEach(([k, v]) => push(k, v));
      if (hf.NX !== r.NX || hf.NZ !== r.NZ) return false;
      hf.hgt.set(fromB64(r.hgt, Float32Array)); hf.mask.set(fromB64(r.mask, Uint8Array)); hf.rebuild(true);
      return true;
    };
    apiRef.current.exportStl = () => exportStl(hf.mesh);
    apiRef.current.snapshot = snapshot;

    // ---------- polotovar ----------
    const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj: () => hf.mesh, getSpot: () => v3(3.2, 8.4, 4.6), onState: (v) => push('unclamped', v) });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in') {
        if (c.running || st.rpm > 1) { say(L('Polotovar sa odopína len pri stojacom vretene.', 'The workpiece can only be unclamped with the spindle stopped.')); return; }
        const [rx, rz, ry] = rel(st.tx, st.sz, st.h);
        if (penetration(rx, rz, ry - wk.WB, MILL_TOOLS[st.tool]) > 0.001 || ry - wk.WB < wk.WH + 0.05 && Math.abs(rx) < wk.WX / 2 + 0.6 && Math.abs(rz - wzc()) < wk.WZ / 2 + 0.6) { say(L('Najprv spusti konzolu nižšie – fréza je pri obrobku.', 'Lower the knee first – the cutter is next to the workpiece.')); return; }
      }
      if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb polotovaru.', 'Wait until the workpiece movement finishes.'), 'info');
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) { say(L('Najprv upni polotovar späť.', 'Clamp the workpiece back first.')); return null; }
      if (c.running || st.rpm > 1) { say(L('Polotovar sa mení len pri stojacom vretene.', 'The workpiece can only be changed with the spindle stopped.')); return null; }
      wk.shape = c.bShape; wk.WX = c.bL / 100;
      if (wk.shape === 'round') { wk.WZ = c.bD / 100; wk.WH = c.bD / 100; } else { wk.WZ = c.bW / 100; wk.WH = c.bH / 100; }
      wk.WB = Math.max(0.45, 0.97 - wk.WH);
      makeWork(); st.lastRel = null;
      say(L('Upnutý nový polotovar.', 'A new workpiece is clamped.'), 'info');
      const [rx, rz, ry] = rel(st.tx, st.sz, st.h), tl = MILL_TOOLS[st.tool];
      if (penetration(rx, rz, ry - wk.WB, tl) > 0.001 || hitObst(rx, rz, ry, tl.r)) {
        st.h = clamp(yT() - wk.WB - wk.WH - 0.2, H0, H0 + 4.2); c.z = (st.h - H0) * 100; return { z: c.z };
      }
      return {};
    };

    // ---------- ručné ovládanie prvkov ----------
    const gearGuard = () => {
      if (!c.running && st.rpm < 1) return true;
      say(L('Otáčky sa preraďujú len pri stojacom vretene – najprv ho zastav.', 'Speeds can only be changed with the spindle stopped – stop it first.'), 'warn'); return false;
    };
    const spdIdx = () => logNear(MILL_SPEEDS, c.rpm), feedIdx = () => logNear(MILL_FEEDS, c.feed);
    const setSpeed = (a, b) => { push('rpm', MILL_SPEEDS[a * 6 + b]); say(`${L('Zaradené otáčky', 'Speed selected:')} ${c.rpm} ${RPM()}.`, 'info'); };
    const setFeed = (a, b) => { push('feed', MILL_FEEDS[a * 6 + b]); say(`${L('Posuv nastavený na', 'Feed set to')} ${c.feed} mm/min.`, 'info'); };
    const xGuard = () => { if (!c.feedDir) return true; say(L('Pri zaradenom posuve stola sa ručné koleso netočí – vráť páku posuvu do stredu.', 'With the table feed engaged the handwheel is locked – return the feed lever to the centre.'), 'warn'); return false; };
    const xAct = () => (st.tx - X0) * 100, yAct = () => (st.sz - Y0) * 100, zAct = () => (st.h - H0) * 100;
    const turnX = (d) => { const a = xAct(); push('x', clamp(clamp(c.x + d * 10 / TAU, a - 20, a + 20), 0, 800)); };

    ctrl.reg({ type: 'wheel', minR: 0.32, inc: 1, guard: xGuard, label: LL('Ručné koleso stola (X) – pravé', 'Table handwheel (X) – right'), hint: LL('Ťahaj za veniec alebo kľučku, alebo toč kolieskom myši. 1 otáčka = 10 mm.', 'Drag the rim or handle, or use the mouse wheel. 1 turn = 10 mm.'),
      turn: turnX, read: () => `X ${xAct().toFixed(1)} mm` }, wheelXR);
    ctrl.reg({ type: 'wheel', minR: 0.32, inc: -1, guard: xGuard, label: LL('Ručné koleso stola (X) – ľavé', 'Table handwheel (X) – left'), hint: LL('Ťahaj za veniec alebo kľučku, alebo toč kolieskom myši. 1 otáčka = 10 mm.', 'Drag the rim or handle, or use the mouse wheel. 1 turn = 10 mm.'),
      turn: (d) => turnX(-d), read: () => `X ${xAct().toFixed(1)} mm` }, wheelXL);
    ctrl.reg({ type: 'wheel', minR: 0.36, inc: -1, label: LL('Ručné koleso priečnych saní (Y)', 'Saddle handwheel (Y)'), hint: LL('V smere hodinových ručičiek ide stôl od stojana. 1 otáčka = 10 mm.', 'Clockwise moves the table away from the column. 1 turn = 10 mm.'),
      turn: (d) => { const a = yAct(); push('y', clamp(clamp(c.y - d * 10 / TAU, a - 10, a + 10), 0, 300)); },
      read: () => `Y ${yAct().toFixed(1)} mm` }, wheelY);
    ctrl.reg({ type: 'wheel', minR: 0.32, inc: -1, label: LL('Kľuka zdvihu konzoly (Z)', 'Knee elevating crank (Z)'), hint: LL('V smere hodinových ručičiek konzola stúpa. 1 otáčka = 4 mm.', 'Clockwise raises the knee. 1 turn = 4 mm.'),
      turn: (d) => { const a = zAct(); push('z', clamp(clamp(c.z - d * 4 / TAU, a - 5, a + 5), 0, 420)); },
      read: () => `Z ${zAct().toFixed(1)} mm` }, crankZ);

    ctrl.reg({ type: 'lever', angles: S3_ANG, minR: 0.25, guard: gearGuard, label: LL('Páka otáčok I (rozsah)', 'Speed lever I (range)'), hint: LL('Ťahaj do polohy alebo klikni. Preraďuje sa len pri stojacom vretene.', 'Drag to a position or click. Shift only with the spindle stopped.'),
      getIdx: () => Math.floor(spdIdx() / 6), onSet: (i) => setSpeed(i, spdIdx() % 6), read: () => `${c.rpm} ${RPM()}` }, levSA);
    ctrl.reg({ type: 'lever', angles: S6_ANG, minR: 0.25, guard: gearGuard, label: LL('Páka otáčok II (stupeň)', 'Speed lever II (step)'), hint: LL('Ťahaj do polohy alebo klikni. Preraďuje sa len pri stojacom vretene.', 'Drag to a position or click. Shift only with the spindle stopped.'),
      getIdx: () => spdIdx() % 6, onSet: (i) => setSpeed(Math.floor(spdIdx() / 6), i), read: () => `${c.rpm} ${RPM()}` }, levSB);
    ctrl.reg({ type: 'lever', angles: S3_ANG, minR: 0.2, label: LL('Páka posuvov I (rozsah)', 'Feed lever I (range)'), hint: LL('18 posuvov 19 – 950 mm/min (3 × 6).', '18 feeds 19 – 950 mm/min (3 × 6).'),
      getIdx: () => Math.floor(feedIdx() / 6), onSet: (i) => setFeed(i, feedIdx() % 6), read: () => `${c.feed} mm/min` }, levFA);
    ctrl.reg({ type: 'lever', angles: S6_ANG, minR: 0.2, label: LL('Páka posuvov II (stupeň)', 'Feed lever II (step)'), hint: LL('18 posuvov 19 – 950 mm/min (3 × 6).', '18 feeds 19 – 950 mm/min (3 × 6).'),
      getIdx: () => feedIdx() % 6, onSet: (i) => setFeed(Math.floor(feedIdx() / 6), i), read: () => `${c.feed} mm/min` }, levFB);
    ctrl.reg({ type: 'lever', angles: DIR_ANG, minR: 0.2, label: LL('Páka posuvu stola (X)', 'Table feed lever (X)'), hint: LL('Vľavo / stred = stop / vpravo. Stôl sa pohne, keď sa točí vreteno.', 'Left / centre = stop / right. The table moves while the spindle turns.'),
      getIdx: () => c.feedDir + 1,
      onSet: (i) => {
        push('feedDir', i - 1);
        if (i !== 1 && !(c.running && c.power)) say(L('Posuv stola zaradený – stôl sa pohne, keď sa roztočí vreteno.', 'Table feed engaged – the table moves once the spindle turns.'), 'info');
      },
      read: () => (c.feedDir < 0 ? L('vľavo', 'left') : c.feedDir > 0 ? L('vpravo', 'right') : 'stop') }, levDir);
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.22, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('Otoč alebo klikni: 0 = vypnuté, I = zapnuté.', 'Turn or click: 0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0),
      onSet: (i) => {
        push('power', i === 1);
        if (i === 0) { push('running', false); say(L('Hlavný vypínač vypnutý – stroj je bez napätia.', 'Main switch off – the machine is de-energised.'), 'warn'); }
        else say(L('Hlavný vypínač zapnutý. Vreteno spustíš zeleným tlačidlom.', 'Main switch on. Start the spindle with the green button.'), 'info');
      },
      read: () => (c.power ? L('I – zapnuté', 'I – on') : L('0 – vypnuté', '0 – off')) }, mainSwitch);
    ctrl.reg({ type: 'button', label: LL('Tlačidlo ŠTART', 'START button'), hint: LL('Spustí vreteno, ak je zapnutý hlavný vypínač.', 'Starts the spindle if the main switch is on.'),
      action: () => { if (!c.power) say(L('Najprv zapni hlavný vypínač na rozvádzači.', 'Switch on the main switch on the cabinet first.'), 'warn'); else push('running', true); } }, btnStart);
    ctrl.reg({ type: 'button', label: LL('Tlačidlo STOP', 'STOP button'), hint: LL('Zastaví vreteno.', 'Stops the spindle.'), action: () => push('running', false) }, btnStop);
    ctrl.reg({ type: 'button', label: LL('Chladenie', 'Coolant'), hint: LL('Zapne alebo vypne čerpadlo chladiacej kvapaliny.', 'Switches the coolant pump on or off.'),
      action: () => { push('coolant', !c.coolant); say(c.coolant ? L('Chladenie zapnuté.', 'Coolant on.') : L('Chladenie vypnuté.', 'Coolant off.'), 'info'); } }, btnCool);
    ctrl.reg({ type: 'button', label: LL('Núdzový STOP', 'Emergency STOP'), hint: LL('Okamžite zastaví vreteno, posuv aj chladenie.', 'Immediately stops the spindle, the feed and the coolant.'),
      action: () => { push('running', false); push('feedDir', 0); push('coolant', false); say(L('Núdzové zastavenie – vreteno, posuv aj chladenie sú vypnuté.', 'Emergency stop – spindle, feed and coolant are off.'), 'danger'); } }, eStop);
    ctrl.reg({ type: 'wheel', minR: 0.22, inc: 1, label: LL('Koliesko pinoly', 'Quill handwheel'), hint: LL('Jemný zvislý posuv frézy pinolou. 1 otáčka = 4 mm, výsuv 0 – 80 mm.', 'Fine vertical feed of the cutter by the quill. 1 turn = 4 mm, stroke 0 – 80 mm.'),
      guard: () => { if (!c.quillLock) return true; say(L('Pinola je zaistená – uvoľni páku aretácie.', 'The quill is locked – release the lock lever.')); return false; },
      turn: (d) => { const a = st.q * 100; push('quill', clamp(clamp(c.quill + d * 4 / TAU, a - 4, a + 4), 0, 80)); }, read: () => `${L('pinola', 'quill')} ${(st.q * 100).toFixed(2)} mm` }, wheelQ);
    const lockLever = (key, title, hintSk, hintEn) => ({ type: 'lever', angles: [-0.45, 0.5], minR: 0.18, label: title, hint: LL(hintSk, hintEn),
      getIdx: () => (c[key] ? 1 : 0), onSet: (i) => { push(key, i === 1); say(i ? L('Zaistené.', 'Locked.') : L('Uvoľnené.', 'Released.'), 'info'); },
      read: () => (c[key] ? L('zaistené', 'locked') : L('uvoľnené', 'released')) });
    ctrl.reg(lockLever('quillLock', LL('Aretácia pinoly', 'Quill lock'), 'Zaistená pinola sa nedá vysúvať.', 'A locked quill cannot be moved.'), levQ);
    ctrl.reg(lockLever('kneeLock', LL('Aretácia konzoly', 'Knee clamp'), 'Zaistená konzola sa nepohne zvisle – používa sa pri frézovaní v osi X a Y.', 'A clamped knee cannot move vertically – used when milling along X and Y.'), levKnee);
    ctrl.reg(lockLever('sadLock', LL('Aretácia saní', 'Saddle clamp'), 'Zaistené sane sa nepohnú v osi Y.', 'A clamped saddle cannot move in Y.'), levSad);
    ctrl.reg({ type: 'button', still: true, label: LL('Pracovná lampa', 'Work lamp'), hint: LL('Klik zapne alebo vypne lampu.', 'Click to switch the lamp on or off.'), action: () => push('light', !c.light) }, lamp.shade);

    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;

      if (c.unclamped && c.running) { push('running', false); say(L('Polotovar nie je upnutý – vreteno sa nespustí.', 'The workpiece is not clamped – the spindle will not start.')); }
      if (st.change && c.running) { push('running', false); say(L('Počkaj, kým sa dokončí výmena nástroja.', 'Wait until the tool change finishes.'), 'info'); }
      // hlavný chod (vreteno sa točí v smere hodín pri pohľade zhora)
      st.rpm = approach(st.rpm, c.running && c.power ? c.rpm : 0, 1400 * dt);
      const running = st.rpm > 15;
      const revs = st.rpm > 0 ? 4.5 * st.rpm / (st.rpm + 500) : 0;
      st.spin += revs * TAU * dt; spindle.rotation.y = -st.spin;
      wi.update(dt);
      jawM.position.z = wk.WZ - 1.0 + wi.open() * 0.25;

      // výmena nástroja: starý vypadne nadol z upínača, nový sa zasunie
      if (c.tool !== st.tool && !st.change) {
        const nt = MILL_TOOLS[c.tool], [rx, rz, ry] = rel(st.tx, st.sz, st.h, c.tool);
        if (c.running || running) { say(L('Nástroj sa mení len pri stojacom vretene.', 'The tool can only be changed with the spindle stopped.'), 'warn'); push('tool', st.tool); }
        else if (!c.unclamped && (penetration(rx, rz, ry - wk.WB, nt) > 0.002 || hitObst(rx, rz, ry, nt.r))) { say(L('Nový nástroj by zasiahol obrobok alebo zverák – najprv spusti konzolu nižšie (os Z).', 'The new tool would hit the workpiece or the vise – lower the knee first (Z axis).'), 'warn'); push('tool', st.tool); }
        else st.change = { to: c.tool, t: 0, swapped: false };
      }
      if (st.change) {
        const ch = st.change; ch.t += dt;
        if (!ch.swapped) { toolG.position.y = -Math.min(1, ch.t / 0.5) * 1.2; if (ch.t >= 0.5) { buildTool(ch.to); st.tool = ch.to; st.lastRel = null; placeStream(); ch.swapped = true; ch.t = 0; } }
        else { toolG.position.y = -1.2 * (1 - Math.min(1, ch.t / 0.5)); if (ch.t >= 0.5) { toolG.position.y = 0; st.change = null; say(`${L('Upnutá', 'Clamped:')} ${millToolName(MILL_TOOLS[st.tool])}.`, 'info'); } }
      }

      // automatický posuv stola
      if (c.feedDir && running) {
        const a = xAct();
        c.x = clamp(clamp(c.x + c.feedDir * c.feed / 60 * c.timeScale * dt, a - 3, a + 3), 0, 800);
        if ((c.feedDir < 0 && a <= 0.05) || (c.feedDir > 0 && a >= 799.95)) { push('feedDir', 0); say(L('Posuv stola vypnutý – stôl dosiahol koncovú polohu.', 'Table feed off – the table reached its end position.'), 'info'); }
      } else if (c.feedDir) c.x = xAct();                              // posuv stojí s vretenom, stôl nedobieha

      // pohyb stola (X), saní (Y) a konzoly (Z) s kontrolou kolízií
      const tl = MILL_TOOLS[st.tool];
      // zaistené osi sa nehýbu
      const lockAxis = (key, on, val, act, text) => { if (on && Math.abs(c[val] - act) > 0.05) { sayOnce(key, true, text, 'warn'); c[val] = act; pend[val] = Math.round(act * 10) / 10; } else flags[key] = false; };
      lockAxis('lk', c.kneeLock, 'z', zAct(), L('Konzola je zaistená – uvoľni páku aretácie na konzole.', 'The knee is locked – release the knee clamp lever.'));
      lockAxis('ls', c.sadLock, 'y', yAct(), L('Sane sú zaistené – uvoľni páku aretácie na saniach.', 'The saddle is locked – release the saddle clamp lever.'));
      lockAxis('lq', c.quillLock, 'quill', st.q * 100, L('Pinola je zaistená – uvoľni páku aretácie na hlave.', 'The quill is locked – release the quill lock lever on the head.'));
      const txT = X0 + clamp(c.x, 0, 800) / 100, szT = Y0 + clamp(c.y, 0, 300) / 100, hT = H0 + clamp(c.z, 0, 420) / 100, qT = clamp(c.quill, 0, 80) / 100;
      const vx = st.cutting ? Math.max(0.25, c.feed / 6000 * c.timeScale * 1.2) : 2.4, vy = st.cutting ? 0.2 : 1.6, vh = st.cutting ? 0.06 : 0.7;
      let nx = approach(st.tx, txT, vx * dt), ny = approach(st.sz, szT, vy * dt), nh = approach(st.h, hT, vh * dt), nq = approach(st.q, qT, (st.cutting ? 0.05 : 0.5) * dt);
      let blocked = null;
      if (nx !== st.tx || ny !== st.sz || nh !== st.h || nq !== st.q) {
        const r = st.change ? 0.24 : tl.r, [rx0, rz0, ry0] = rel(st.tx, st.sz, st.h);
        const pen0 = running || c.unclamped ? 0 : penetration(rx0, rz0, ry0 - wk.WB, tl), obst0 = hitObst(rx0, rz0, ry0, r);
        let why = null;
        const ok = (a, b, h2, q2 = st.q) => {
          const [rx, rz, ry] = rel(a, b, h2, st.tool, q2);
          const o = hitObst(rx, rz, ry, r);
          if (o && !obst0) { why = o; return false; }
          if (!running && !c.unclamped && penetration(rx, rz, ry - wk.WB, tl) > Math.max(0.002, pen0 + 1e-5)) { why = 'work'; return false; }
          return true;
        };
        if (!ok(nx, ny, nh, nq)) {
          blocked = why;
          let ax = st.tx, ay = st.sz, ah = st.h, aq = st.q;
          if (ok(nx, ay, ah, aq)) ax = nx;
          if (ok(ax, ny, ah, aq)) ay = ny;
          if (ok(ax, ay, nh, aq)) ah = nh;
          if (ok(ax, ay, ah, nq)) aq = nq;
          nx = ax; ny = ay; nh = ah; nq = aq;
        }
      }
      sayOnce('work', blocked === 'work', L('Fréza narazila do obrobku. Pri stojacom vretene nemôže rezať – spusti vreteno.', 'The cutter hit the workpiece. It cannot cut with the spindle stopped – start the spindle.'), 'danger');
      sayOnce('obst', !!blocked && blocked !== 'work', `${L('Fréza by narazila do', 'The cutter would hit')} ${blocked} – ${L('pohyb je zastavený.', 'the motion is stopped.')}`, 'warn');
      wheelXR.rotation.z += (nx - st.tx) / 0.1 * TAU; wheelXL.rotation.z -= (nx - st.tx) / 0.1 * TAU;
      wheelY.rotation.z -= (ny - st.sz) / 0.1 * TAU;
      crankZ.rotation.z -= (nh - st.h) / 0.04 * TAU;
      wheelQ.rotation.z += (nq - st.q) / 0.04 * TAU;
      const qMoved = nq !== st.q;
      st.tx = nx; st.sz = ny; st.h = nh; st.q = nq;
      spindle.position.y = NOSE - st.q;
      if (qMoved) placeStream();

      // frézovanie po celej dráhe od minulej snímky, aby pri rýchlom posuve nezostali hrebene
      const cur = rel(st.tx, st.sz, st.h), prev = st.lastRel || cur;
      st.lastRel = cur;
      if (running && !st.change && !c.unclamped) {
        const n = Math.min(60, Math.max(1, Math.ceil(Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]) / (tl.r * 0.3))));
        let removed = 0;
        for (let s = 1; s <= n; s++) {
          const f = s / n;
          removed += cut(prev[0] + (cur[0] - prev[0]) * f, prev[1] + (cur[1] - prev[1]) * f, prev[2] + (cur[2] - prev[2]) * f - wk.WB, tl);
        }
        if (removed > 0) {
          st.cutT = t; workDirty = true;
          chipAcc += dt * (30 + Math.min(70, removed * 20)); while (chipAcc >= 1) { spawnChip(); chipAcc -= 1; }
        }
      }
      st.cutting = t - st.cutT < 0.25;
      if (workDirty && t - lastBuild > 0.06) { hf.rebuild(); workDirty = false; lastBuild = t; }

      // pohyb skupín, chladenie, lampa
      knee.position.y = st.h - 1.35; sad.position.z = st.sz; tbl.position.x = st.tx;
      updateSadCable(st.h, st.sz);
      ram.scale.y = Math.max(0.01, st.h - 1.35 - 2.4 - 0.6);
      stream.visible = c.coolant && c.power && !st.change;
      if (stream.visible) {
        M.coolant.opacity = 0.45 + 0.12 * Math.sin(t * 40);
        const to = streamEnd(); dropAcc += dt * 70;
        while (dropAcc >= 1) {
          dropAcc -= 1; const f = Math.random(), p = nozzle.clone().lerp(to, f);
          drops.spawn(p, to.clone().sub(nozzle).normalize().multiplyScalar(2.2).add(v3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)), 1.4);
        }
      }
      drops.update(dt, (p) => (Math.abs(p.x - st.tx) < wk.WX / 2 && Math.abs(p.z - st.sz - wzc()) < wk.WZ / 2 ? st.h + 0.75 + wk.WB + wk.WH * 0.9 : Math.abs(p.x - st.tx) < 6.5 && Math.abs(p.z - st.sz) < 1.5 ? st.h + 0.75 : 0.02));
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
          rpm: st.rpm, x: xAct(), y: yAct(), z: zAct(), q: st.q * 100, vc: Math.PI * tl.d * st.rpm / 1000,
          vf: c.feedDir && running ? c.feed : 0, cutting: st.cutting && running, tool: st.tool, changing: !!st.change,
          depth: over ? Math.max(0, (wk.WB + wk.WH - ry) * 100) : 0, msg: st.msg && st.msg.until > t ? st.msg : null,
        });
        drawDro(xAct(), yAct(), zAct() + st.q * 100);
        if (c.feedDir) pend.x = Math.round(c.x * 10) / 10;
        if (lastDir !== c.feedDir) pend.feedDir = c.feedDir;
        lastDir = c.feedDir;
        if (Object.keys(pend).length) {
          const p = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
      }

      snd.update({ motor: st.rpm / 2000, cut: st.cutting && running ? 1 : 0 });
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); insp.dispose(); wi.dispose(); disposeStage(); };
  }, []);

  const parts = millParts();
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped ? { kind: 'info', text: L('Polotovar je odopnutý a vybratý zo zveráka.', 'The workpiece is unclamped and out of the vise.') }
    : tele.cutting ? { kind: 'run', text: `${L('Frézovanie – hĺbka', 'Milling – depth')} ${tele.depth.toFixed(1)} mm ${L('pod pôvodnou plochou', 'below the original surface')}, vc ${tele.vc.toFixed(0)} m/min` }
    : tele.rpm > 15 ? { kind: 'run', text: L('Vreteno beží. Zdvihni konzolu (Z) k fréze a posúvaj stôl.', 'The spindle is running. Raise the knee (Z) to the cutter and move the table.') }
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý – stroj je bez napätia.', 'The main switch is off – the machine is de-energised.') }
    : { kind: 'idle', text: L('Stroj stojí. Spusti vreteno a priveď obrobok k fréze.', 'The machine is stopped. Start the spindle and bring the workpiece to the cutter.') };
  const running = ui.running;
  const chips = [{ color: tele.rpm > 15 ? '#3ee06c' : '#8b8f89', text: tele.rpm > 15 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Vreteno stojí', 'Spindle stopped') }];
  if (tele.cutting) chips.push({ color: '#ffb340', text: L('Rez', 'Cutting') });
  if (tele.vf) chips.push({ color: '#7fb6ff', text: `${L('Posuv', 'Feed')} ${tele.vf} mm/min` });
  if (ui.coolant && ui.power) chips.push({ color: '#8fd0ff', text: L('Chladenie', 'Coolant') });
  const kinds = [['end', L('Stopková', 'End mill')], ['ball', L('Guľová', 'Ball-nose')], ['face', L('Čelná', 'Face mill')]];
  const curKind = MILL_TOOLS[ui.tool].kind;
  const stopped = !ui.running && tele.rpm <= 1;
  const setupTask = (task) => {
    const su = task.setup; if (!stopped) return;
    ['bShape', 'bL', 'bW', 'bH'].forEach((k) => set(k, su[k]));
    const r = apiRef.current.newBlank && apiRef.current.newBlank(); if (r) Object.entries(r).forEach(([k, v]) => set(k, v));
    set('z', Math.min(ui.z, 150)); set('tool', su.tool); set('rpm', su.rpm);
  };
  const pinfo = ui.probe && apiRef.current.measure ? apiRef.current.measure().info : null;

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} />
      <aside className="panel">
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · fréza', 'Simulator · milling machine')} title={L('Univerzálna konzolová fréza', 'Universal knee-type milling machine')}
          sub={L('Predloha: TOS FA 3 B so sklopnou vertikálnou hlavou. Mierka 1 : 100 mm.', 'Modelled after the TOS FA 3 B with a swivelling vertical head. Scale 1 : 100 mm.')}
          rows={[['X', tele.x.toFixed(2)], ['Y', tele.y.toFixed(2)], ['Z', tele.z.toFixed(2)]]}
          foot={[`n ${Math.round(tele.rpm)} ${RPM()}`, `vf ${tele.vf} mm/min`, `${L('pinola', 'quill')} ${tele.q.toFixed(1)}`]} status={statusMsg} />

        <TaskSection machine="freza" tasks={MILL_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'running', items: MILL_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
          <button type="button" className={`btn-run ${running ? 'stop' : 'start'}`}
            onClick={() => { if (!running && !ui.power) set('power', true); set('running', !running); }}>
            {running ? L('■ Stop vretena', '■ Stop spindle') : L('▶ Štart vretena', '▶ Start spindle')}
          </button>
          <div className="mt-2">
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => { const v = !ui.power; set('power', v); if (!v) set('running', false); }} />
            <Toggle on={ui.coolant} label={L('Chladenie', 'Coolant')} onClick={() => set('coolant', !ui.coolant)} />
            <Toggle on={ui.light} label={L('Pracovné osvetlenie', 'Work light')} onClick={() => set('light', !ui.light)} />
          </div>
          <div className="mt-3">
            <StepSelect id="mrpm" label={L('Otáčky vretena', 'Spindle speed')} unit={RPM()} values={MILL_SPEEDS} value={ui.rpm} onChange={(v) => set('rpm', v)}
              locked={ui.running || tele.rpm > 1} lockNote={GEAR_LOCK()} />
            <CutCalc D={MILL_TOOLS[ui.tool].d} mat="steel" speeds={MILL_SPEEDS} rpm={ui.rpm} locked={!stopped} onApply={(n) => set('rpm', n)} what={L('Priemer frézy', 'Cutter diameter')} />
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Nástroj', 'Tool')}</h2>
          <SegRow label={L('Druh', 'Type')} value={curKind} options={kinds}
            onChange={(k) => { const first = MILL_TOOL_LIST.find((x) => x.kind === k && x.d === (k === 'face' ? 63 : k === 'ball' ? 10 : 20)) || MILL_TOOL_LIST.find((x) => x.kind === k); set('tool', first.id); }} />
          <div className="flex flex-wrap gap-1.5 mb-2">
            {MILL_TOOL_LIST.filter((x) => x.kind === curKind).map((x) => (
              <button key={x.id} type="button" className={`btn ${ui.tool === x.id ? 'active' : ''}`} aria-pressed={ui.tool === x.id} onClick={() => set('tool', x.id)}>Ø{x.d}</button>
            ))}
          </div>
          <p className="text-xs muted">{L('Upnutá', 'Clamped')}: <b className="ink">{millToolName(MILL_TOOLS[tele.tool])}</b>{tele.changing ? ` · ${L('výmena…', 'changing…')}` : ''}. {L('Nástroj sa mení len pri stojacom vretene a mimo obrobku. Odporúčané vc pre oceľ: 25 – 35 m/min (HSS), 120 – 180 m/min (SK).', 'Tools are changed only with the spindle stopped and clear of the work. Recommended vc for steel: 25 – 35 m/min (HSS), 120 – 180 m/min (carbide).')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Posuvy', 'Feeds')}</h2>
          <Slider id="mx" label={L('Stôl pozdĺžne X', 'Table X')} unit="mm" min={0} max={800} step={1} value={ui.x} actual={tele.x} onChange={(v) => set('x', v)} />
          <Slider id="my" label={L('Sane priečne Y', 'Saddle Y')} unit="mm" min={0} max={300} step={0.5} value={ui.y} actual={tele.y} digits={1} onChange={(v) => set('y', v)} />
          <Slider id="mz" label={L('Konzola zvisle Z', 'Knee Z')} unit="mm" min={0} max={420} step={0.5} value={ui.z} actual={tele.z} digits={1} onChange={(v) => set('z', v)} />
          <Slider id="mq" label={L('Výsuv pinoly', 'Quill extension')} unit="mm" min={0} max={80} step={0.1} value={ui.quill} actual={tele.q} digits={1} onChange={(v) => set('quill', v)} />
          <Toggle on={ui.kneeLock} label={L('Konzola zaistená', 'Knee clamped')} onClick={() => set('kneeLock', !ui.kneeLock)} />
          <Toggle on={ui.sadLock} label={L('Sane zaistené', 'Saddle clamped')} onClick={() => set('sadLock', !ui.sadLock)} />
          <Toggle on={ui.quillLock} label={L('Pinola zaistená', 'Quill locked')} onClick={() => set('quillLock', !ui.quillLock)} />
          <div className="mb-3" />
          <SegRow label={L('Posuv stola', 'Table feed')} value={ui.feedDir} options={[[-1, L('← Vľavo', '← Left')], [0, 'Stop'], [1, L('Vpravo →', 'Right →')]]} onChange={(v) => set('feedDir', v)} />
          <StepSelect id="mfeed" label={L('Rýchlosť posuvu', 'Feed rate')} unit="mm/min" values={MILL_FEEDS} value={ui.feed} onChange={(v) => set('feed', v)}
            fmt={(v) => L(String(v).replace('.', ','), String(v))} />
          <SegRow label={L('Zrýchlenie posuvu', 'Feed acceleration')} value={ui.timeScale} options={[[1, '1×'], [10, '10×'], [50, '50×']]} onChange={(v) => set('timeScale', v)} />
          <p className="text-xs muted">{L('Automatický posuv stola beží len pri otáčajúcom sa vretene. Pri X = 400 a Y = 120 je os frézy nad stredom 100 mm širokého obrobku.', 'The table power feed only runs while the spindle turns. At X = 400 and Y = 120 the cutter axis is above the centre of a 100 mm wide workpiece.')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Meranie', 'Measuring')}</h2>
          <Toggle on={ui.probe} label={L('Hĺbkomer na obrobku', 'Depth gauge on the workpiece')} onClick={() => set('probe', !ui.probe)} />
          {pinfo && (<div className="mt-2">
            <Slider id="mpx" label={L('Poloha pozdĺž (od ľavej hrany)', 'Position along (from the left edge)')} unit="mm" min={0} max={Math.round(pinfo.L)} step={0.5} value={Math.min(ui.px, pinfo.L)} digits={1} onChange={(v) => set('px', v)} />
            <Slider id="mpz" label={L('Poloha naprieč (od zadnej hrany)', 'Position across (from the back edge)')} unit="mm" min={0} max={Math.round(pinfo.Wd)} step={0.5} value={Math.min(ui.pz, pinfo.Wd)} digits={1} onChange={(v) => set('pz', v)} />
            <div className="dro tnum" style={{ padding: '8px 12px' }}>
              <div className="dro-row"><span>{L('hĺbka', 'depth')}</span><b style={{ fontSize: 22 }}>{pinfo.depthAt(Math.min(ui.px, pinfo.L), Math.min(ui.pz, pinfo.Wd)).toFixed(2)}</b></div>
              <div className="dro-sub"><span>{L('najväčšia', 'max')} {pinfo.maxDep.toFixed(2)} mm</span><span>{L('obrobené', 'machined')} {Math.round(pinfo.cover * 100)} %</span></div>
            </div>
            <p className="text-xs muted mt-2">{L(`Hĺbka pod pôvodnou hornou plochou. Sieť merania ${pinfo.dX.toFixed(1).replace('.', ',')} × ${pinfo.dZ.toFixed(1).replace('.', ',')} mm.`, `Depth below the original top surface. Measuring grid ${pinfo.dX.toFixed(1)} × ${pinfo.dZ.toFixed(1)} mm.`)}</p>
          </div>)}
        </div>

        <BlankSection onApply={() => { const r = apiRef.current.newBlank && apiRef.current.newBlank(); if (r) Object.entries(r).forEach(([k, v]) => set(k, v)); }}
          note={L('Obrobok leží vo zveráku na podložkách pri pevnej čeľusti; posuvná čeľusť dosadne podľa šírky. Nízky kus sa podloží vyššie, aby vyčnieval nad čeľuste.', 'The workpiece sits on parallels against the fixed jaw; the moving jaw closes to its width. A low part is raised on higher parallels so it sticks out above the jaws.')}>
          <SegRow label={L('Tvar', 'Shape')} value={ui.bShape} options={[['block', L('Hranol', 'Block')], ['round', L('Kruhová tyč', 'Round bar')]]} onChange={(v) => set('bShape', v)} />
          <Slider id="bl" label={L('Dĺžka', 'Length')} unit="mm" min={100} max={250} step={5} value={ui.bL} onChange={(v) => set('bL', v)} />
          {ui.bShape === 'block' ? (<>
            <Slider id="bw" label={L('Šírka', 'Width')} unit="mm" min={30} max={100} step={5} value={ui.bW} onChange={(v) => set('bW', v)} />
            <Slider id="bh" label={L('Výška', 'Height')} unit="mm" min={20} max={80} step={5} value={ui.bH} onChange={(v) => set('bH', v)} />
          </>) : (
            <Slider id="bdm" label={L('Priemer', 'Diameter')} unit="mm" min={20} max={80} step={5} value={ui.bD} onChange={(v) => set('bD', v)} />
          )}
        </BlankSection>

        <ExportSection machine="freza" apiRef={apiRef} />
        <ViewSection apiRef={apiRef}
          views={[['celok', L('Celok', 'Overview')], ['rez', L('Detail frézy', 'Cutter detail')], ['spredu', L('Spredu', 'Front')], ['zhora', L('Zhora', 'Top')], ['bok', L('Rozvádzač', 'Cabinet')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

export { MillSimulator, MILL_SPEEDS, MILL_FEEDS, MILL_TOOLS };
export default MillSimulator;
