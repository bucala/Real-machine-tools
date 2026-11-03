import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL, RPM } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, mkTex, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp, logNear } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { BlankSection, GEAR_LOCK, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, StepSelect, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// HROTOVÝ SÚSTRUH
// =====================================================================
const AXIS_Y = 7.5;                       // výška osi vretena nad podlahou
const JAW_X = -3.45;                      // čelo čeľustí = nula osi Z
const W_X0 = -4.2, W_N = 340;             // začiatok obrobku v skľučovadle, počet úsekov profilu
const TIP_LZ = -0.05;                     // hrot noža voči osi priečnych saní
const TIP0 = -0.36;                       // vzťažná poloha hrotu voči suportu pre údaj Z suportu
const POST = { x: 0.15, y: 6.62, z: 1.0 };   // stred nožovej hlavy na horných saniach
const LIM = { tipMin: -3.35, rMax: 1.3, quillMax: 1.5, tailMax: 9.0, carToTail: 1.85, quillClear: 0.42, topMin: -0.5, topMax: 0.5 };
const SPEEDS = [40, 56, 80, 112, 160, 224, 315, 450, 630, 900, 1250, 1800];   // 3 × 4 stupne otáčok
const FEED_BASE = [0.05, 0.07, 0.1, 0.14, 0.2, 0.25, 0.35, 0.5], FEED_MULT = [1, 2];
const A_ANG = [0.75, 0, -0.75], B_ANG = [0.95, 0.32, -0.32, -0.95];      // polohy pák otáčok
const LATHE_FEEDS = [...new Set(FEED_MULT.flatMap((m) => FEED_BASE.map((b) => Math.round(b * m * 100) / 100)))].sort((a, b) => a - b);   // všetky posuvy prevodovky
const FEED_ANG = FEED_BASE.map((_, i) => 1.4 - i * 2.8 / 7), MULT_ANG = [0.5, -0.5];

// sústružnícke nože (pravé prevedenie): obrys v pôdoryse (x doprava, z k obsluhe, hrot v 0,0),
// rozsah drieku a tvar reznej časti – prof(d) = výška ostria nad hrotom vo vzdialenosti d od hrotu v osi Z
const LT_R = 0.05;
const LATHE_TOOLS = {
  rough: { sk: 'Ubierací nôž priamy', en: 'Straight turning tool', sh: [0, 0.25],
    pts: [[0, 0], [0.24, 0.06], [0.25, 0.36], [0, 0.36]], prof: (d) => (d >= -0.005 && d <= 0.32 ? Math.max(0, d) * 0.25 : Infinity) },
  corner: { sk: 'Rohový nôž', en: 'Corner tool', sh: [0, 0.25],
    pts: [[0, 0], [0.25, 0.02], [0.25, 0.36], [0, 0.36]], prof: (d) => (d >= -0.005 && d <= 0.3 ? Math.max(0, d) * 0.08 : Infinity) },
  bent: { sk: 'Ubierací nôž ohnutý', en: 'Bent turning tool', sh: [0, 0.25],
    pts: [[0, 0], [0.25, 0.08], [0.25, 0.42], [0, 0.42], [-0.13, 0.13]], prof: (d) => (d >= -0.13 && d < 0 ? -d : d >= 0 && d <= 0.3 ? d * 0.32 : Infinity) },
  finish: { sk: 'Hladiaci nôž', en: 'Finishing tool', sh: [-0.125, 0.125],
    pts: [[-0.035, 0], [0.035, 0], [0.125, 0.08], [0.125, 0.36], [-0.125, 0.36], [-0.125, 0.08]], prof: (d) => (Math.abs(d) <= 0.035 ? 0 : Math.abs(d) <= 0.15 ? (Math.abs(d) - 0.035) * 0.7 : Infinity) },
  plunge: { sk: 'Nabierací nôž', en: 'Broad plunge tool', sh: [-0.075, 0.175],
    pts: [[0, 0], [0.1, 0], [0.1, 0.3], [0.175, 0.42], [0.175, 0.5], [-0.075, 0.5], [-0.075, 0.42], [0, 0.3]], prof: (d) => (d >= -0.005 && d <= 0.105 ? 0 : Infinity) },
  radius: { sk: 'Rádiusový nôž', en: 'Radius tool', sh: [-0.125, 0.125],
    pts: [...Array.from({ length: 13 }, (_, i) => { const a = Math.PI + i * Math.PI / 12; return [LT_R * Math.cos(a), LT_R + LT_R * Math.sin(a)]; }), [0.05, 0.2], [0.125, 0.3], [0.125, 0.36], [-0.125, 0.36], [-0.125, 0.3], [-0.05, 0.2]],
    prof: (d) => (Math.abs(d) <= LT_R ? LT_R - Math.sqrt(LT_R * LT_R - d * d) : Infinity) },
  side: { sk: 'Ubierací nôž stranový', en: 'Side (facing) tool', sh: [0.01, 0.26],
    pts: [[0, 0], [0.26, 0.015], [0.26, 0.36], [0.04, 0.36], [0, 0.1]], prof: (d) => (d >= -0.005 && d <= 0.3 ? Math.max(0, d) * 0.05 : Infinity) },
  parting: { sk: 'Zapichovací nôž', en: 'Grooving / parting tool', sh: [-0.05, 0.2],
    pts: [[0, 0], [0.03, 0], [0.03, 0.56], [0.2, 0.64], [0.2, 0.72], [-0.05, 0.72], [-0.05, 0.64], [0, 0.56]], prof: (d) => (d >= -0.005 && d <= 0.035 ? 0 : Infinity) },
};
const toolName = (s) => `${L(LATHE_TOOLS[s.type].sk, LATHE_TOOLS[s.type].en)} ${s.hand === 'L' ? L('ľavý', 'left') : L('pravý', 'right')}`;
const LATHE_MATS = { brass: [0xe0ba5e, 0.3, 0.85], steel: [0xb7bec5, 0.34, 0.85], alu: [0xd9dde0, 0.3, 0.7] };

const latheParts = () => mkParts([
  ['lozko', 'Lôžko', 'Bed', 'Lôžko', 'Bed', 'Masívny liatinový základ stroja. Kalené a brúsené vodiace plochy (prizmatická „V“ a plochá) vedú suport aj koník presne rovnobežne s osou vretena.', 'Massive cast-iron base of the machine. Hardened and ground ways (a prismatic “V” and a flat way) guide the carriage and the tailstock exactly parallel to the spindle axis.'],
  ['vretennik', 'Vretenník', 'Headstock', 'Vretenník', 'Headstock', 'Skriňa s hlavným vretenom v presných ložiskách a s prevodovkou otáčok. Pákami sa volia otáčky, hlavným vypínačom sa zapína pohon. Na vretene je upínač obrobku.', 'Housing with the main spindle in precision bearings and the speed gearbox. Levers select the speed, the main switch powers the drive. The work-holding chuck sits on the spindle.'],
  ['sklucovadlo', 'Skľučovadlo', 'Chuck', 'Trojčeľusťové skľučovadlo', 'Three-jaw chuck', 'Samostrediace skľučovadlo. Kľúčom sa cez špirálu posúvajú všetky tri čeľuste naraz, takže valcový obrobok je upnutý súosovo s vretenom.', 'Self-centring chuck. The key turns a scroll that moves all three jaws at once, so a round workpiece is clamped coaxially with the spindle.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Obrobok', 'Workpiece', 'Tyč zvoleného priemeru, tvaru a materiálu. Keď sa vreteno točí, nôž odoberá materiál podľa svojho tvaru. Pri stojacom vretene nôž do obrobku nevnikne.', 'Bar of the selected diameter, shape and material. While the spindle turns, the tool removes material according to its shape. With the spindle stopped the tool cannot enter the workpiece.'],
  ['suport', 'Suport', 'Carriage', 'Suport – pozdĺžne sane a zámková skriňa', 'Carriage and apron', 'Pozdĺžne sane jazdia po lôžku (os Z). Zámková skriňa vpredu má ručné koleso s pastorkom na ozubenom hrebeni, páku matice vodiacej skrutky a zapínanie automatického posuvu.', 'The saddle travels along the bed (Z axis). The apron at the front carries the handwheel with a pinion on the rack, the half-nut lever and the automatic feed engagement.'],
  ['priecny', 'Nožová hlava', 'Tool post', 'Priečne sane, horné sane a nožová hlava', 'Cross slide, top slide and tool post', 'Priečne sane sa posúvajú kolmo na os vretena (os X). Nesú horné sane s mikroposuvom v osi Z a štvorpolohovú nožovú hlavu so štyrmi nožmi, ktorá sa po uvoľnení páky pootočí na ďalší nôž.', 'The cross slide moves perpendicular to the spindle axis (X axis). It carries the top slide with fine Z feed and the four-way tool post holding four tools, which indexes to the next tool after its lever is released.'],
  ['konik', 'Koník', 'Tailstock', 'Koník', 'Tailstock', 'Posúva sa po lôžku po uvoľnení páky zaistenia. Ručným kolesom sa vysúva pinola s otočným hrotom, ktorý podopiera dlhé obrobky; pinola sa aretuje pákou hore.', 'Slides along the bed once its clamp lever is released. The handwheel extends the quill with a live centre that supports long workpieces; the quill is locked by the lever on top.'],
  ['skrutky', 'Skrutka a ťažná tyč', 'Leadscrew & feed rod', 'Vodiaca skrutka a ťažná tyč', 'Leadscrew and feed rod', 'Vodiaca skrutka (so závitom) poháňa suport pri rezaní závitov cez maticu. Ťažná tyč (s drážkou) prenáša pohyb pre bežné pozdĺžne a priečne posuvy.', 'The leadscrew drives the carriage through the half-nut when cutting threads. The feed rod (with a keyway) transmits motion for ordinary longitudinal and cross feeds.'],
  ['prevodovka', 'Prevodovka posuvov', 'Feed gearbox', 'Prevodovka posuvov (Norton)', 'Feed gearbox (Norton)', 'Volí sa ňou veľkosť posuvu v mm/ot a stúpanie závitu. Pohon dostáva od vretena cez výmenné kolesá pod ľavým krytom.', 'Selects the feed in mm/rev and the thread pitch. It is driven from the spindle through change gears under the left cover.'],
  ['podstavec', 'Podstavec', 'Stands', 'Podstavce a vaňa na triesky', 'Stands and chip tray', 'Podstavce nesú lôžko, v ľavom je hlavný elektromotor a rozvádzač. Vaňa medzi nimi zachytáva triesky a chladiacu kvapalinu.', 'The stands carry the bed; the left one houses the main motor and the electrical cabinet. The tray between them catches chips and coolant.'],
]);

function LatheSimulator({ onBack }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = {
    running: false, power: true, light: true, manual: false, rpm: 450, z: 395, x: 140, top: 0, quill: 0, tail: 765, autoFeed: false, feed: 0.25, timeScale: 10,
    slot: 0, slots: [{ type: 'rough', hand: 'R' }, { type: 'bent', hand: 'R' }, { type: 'parting', hand: 'R' }, { type: 'finish', hand: 'R' }],
    postLock: true, quillLock: false, tailLock: true, bShape: 'round', bD: 90, bLen: 605, bMat: 'brass',
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, z: 395, x: 140, quill: 0, tail: 765, vc: 0, msg: null, cutting: false, engaged: false, workD: 90, slot: 0, busy: false, postLocked: true, blank: 'round 90 605 brass' });
  const [edit, setEdit] = useState(null);

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage } = createStage(mount);
    const dom = renderer.domElement;
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- materiály a textúry ----------
    const brassTex = mkTex(256, 4, (g) => {
      for (let i = 0; i < 256; i++) {
        const n = 0.93 + 0.05 * Math.sin(i * 1.7) + (Math.random() - 0.5) * 0.06;
        g.fillStyle = `rgb(${[224, 186, 94].map((v) => Math.min(255, Math.round(v * n))).join(',')})`; g.fillRect(i, 0, 1, 4);
      }
    }, 1, 1);
    const leadTex = mkTex(64, 64, (g, w) => {
      g.fillStyle = '#c2c7cb'; g.fillRect(0, 0, w, w); g.strokeStyle = '#5a6066'; g.lineWidth = 11;
      for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(0, k * 32); g.lineTo(64, k * 32 + 32); g.stroke(); }
    }, 1, 110);
    const feedTex = mkTex(64, 4, (g) => { g.fillStyle = '#c6cbcf'; g.fillRect(0, 0, 64, 4); g.fillStyle = '#464c51'; g.fillRect(0, 0, 7, 4); }, 1, 1);
    const M = {
      ...baseMats(0x8db57d, 0x6d9461, 0x4f6e47),
      wbrass: std(0xffffff, 0.3, 0.85, { map: brassTex, side: THREE.DoubleSide }),
      wsteel: std(LATHE_MATS.steel[0], 0.34, 0.85, { side: THREE.DoubleSide }), walu: std(LATHE_MATS.alu[0], 0.3, 0.7, { side: THREE.DoubleSide }),
      lead: std(0xffffff, 0.35, 0.8, { map: leadTex }), feed: std(0xffffff, 0.3, 0.85, { map: feedTex }),
      chip: std(0xe6c068, 0.3, 0.85), shank: std(0x5d646b, 0.45, 0.7), lampShade: std(0x6d9461, 0.5, 0.2),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, lever, hitProxy, pivotLever, pivotLeverY, pivotLeverX, detents, handwheel } = kit;

    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };

    // ---------- podstavce a vaňa ----------
    const base = grp('podstavec');
    box(base, -10, -5.2, 0.15, 3.5, -1.9, 1.9, M.green);
    box(base, -10.1, -5.1, 0, 0.15, -2.0, 2.0, M.greenDeep);
    box(base, -9.5, -5.7, 0.55, 3.05, 1.9, 1.94, M.greenDark);
    cylZ(base, 0.08, 0.08, 1.94, 2.04, -6.0, 1.8, M.black);
    box(base, 9.6, 12, 0.15, 3.5, -1.7, 1.7, M.green);
    box(base, 9.5, 12.1, 0, 0.15, -1.8, 1.8, M.greenDeep);
    box(base, 10.0, 11.6, 0.55, 3.05, 1.7, 1.74, M.greenDark);
    box(base, -5.2, 9.6, 1.4, 1.55, -2.0, 2.8, M.greenDark);
    box(base, -5.2, 9.6, 1.55, 2.05, 2.7, 2.8, M.greenDark);
    box(base, -5.2, 9.6, 1.55, 2.4, -2.0, -1.9, M.greenDark);

    // ---------- lôžko s vodiacimi plochami ----------
    const bed = grp('lozko');
    box(bed, -10, 12, 3.5, 5.0, -1.5, 1.5, M.green);
    const vway = (z) => { const m = add(bed, new THREE.BoxGeometry(17.2, 0.26, 0.26), M.ways, 3.4, 5.0, z); m.rotation.x = Math.PI / 4; };
    vway(1.15); vway(-0.45);
    box(bed, -5.2, 12, 5.0, 5.14, -1.45, -0.85, M.ways);
    box(bed, -5.2, 12, 5.0, 5.14, 0.2, 0.7, M.ways);
    box(bed, -5.2, 11.3, 4.55, 4.78, 1.5, 1.6, M.steelDark);        // ozubený hrebeň
    box(bed, 11.3, 11.9, 3.0, 4.75, 1.5, 2.1, M.green);             // ložisko skrutiek

    // ---------- vretenník ----------
    const hs = grp('vretennik');
    box(hs, -10, -5.0, 5.0, 9.0, -1.85, 1.85, M.green);
    box(hs, -9.9, -5.1, 9.0, 9.25, -1.75, 1.75, M.greenDark);
    box(hs, -10.6, -10.0, 3.6, 9.1, -1.6, 1.6, M.green);            // kryt výmenných kolies
    cylX(hs, 1.15, 1.15, -5.05, -4.85, AXIS_Y, 0, M.green, 40);
    box(hs, -7.7, -6.2, 7.75, 8.6, 1.85, 1.87, M.white);            // tabuľka otáčok
    cylZ(hs, 0.22, 0.22, 1.85, 1.875, -5.55, 8.35, M.blue, 28);
    [[-9.3, 7.0], [-8.4, 7.0], [-9.3, 6.0]].forEach(([x, y]) => cylZ(hs, 0.32, 0.28, 1.85, 2.05, x, y, M.black, 28));
    detents(hs, -9.3, 7.0, 2.05, 0.21, A_ANG); detents(hs, -8.4, 7.0, 2.05, 0.21, B_ANG);
    const levA = pivotLever(hs, -9.3, 7.0, 2.05, 0.5, 1.15), levB = pivotLever(hs, -8.4, 7.0, 2.05, 0.5, 1.15);
    lever(hs, -9.3, 6.0, 2.05, 0.5, 1.15, 0.5);
    lever(hs, -9.4, 9.25, -0.9, 0.95, -0.35, 0.15);
    lever(hs, -8.9, 9.25, -1.1, 0.8, -0.5, -0.1);
    box(hs, -8.9, -7.3, 9.25, 10.35, 0.5, 1.1, M.panel);            // ovládací panel
    const pbtn = (x, m) => { const g = new THREE.Group(); g.position.set(x, 9.6, 1.1); hs.add(g); cylZ(g, 0.13, 0.13, 0, 0.08, 0, 0, m, 20); hitProxy(g, 0.19, 0, 0, 0.06); return g; };
    const btnStop = pbtn(-8.6, M.red), btnStart = pbtn(-8.2, M.btnGreen), btnLight = pbtn(-7.8, M.blue);
    cylZ(hs, 0.12, 0.12, 1.1, 1.16, -7.55, 10.0, M.white, 20);
    ball(hs, 0.12, -8.6, 10.02, 1.1, M.lamp);
    box(hs, -6.75, -5.85, 5.55, 6.45, 1.85, 1.87, M.yellow);         // hlavný vypínač
    box(hs, -6.32, -6.28, 6.33, 6.43, 1.87, 1.88, M.black);           // značky „I“ a „0“
    add(hs, new THREE.TorusGeometry(0.035, 0.01, 6, 16), M.black, -6.66, 6.0, 1.875);
    const mainSwitch = new THREE.Group(); mainSwitch.position.set(-6.3, 6.0, 1.95); hs.add(mainSwitch);
    cylZ(mainSwitch, 0.28, 0.28, -0.1, 0, 0, 0, M.black, 28);
    box(mainSwitch, -0.34, 0.34, -0.07, 0.07, 0, 0.16, M.red);
    const lamp = createLamp(scene, hs, kit, M, { base: v3(-5.6, 9.25, -1.25), elbow: v3(-5.4, 11.7, -1.1), head: v3(-3.7, 11.4, -0.3), aim: v3(-2.1, AXIS_Y, 0.25), angle: 0.5, power: 3.4 });

    // ---------- prevodovka posuvov ----------
    const gb = grp('prevodovka');
    box(gb, -9.9, -5.25, 2.5, 4.95, 1.5, 2.35, M.green);
    box(gb, -9.7, -8.4, 3.9, 4.7, 2.35, 2.37, M.white);
    [-7.8, -6.9, -6.0].forEach((x) => cylZ(gb, 0.22, 0.18, 2.35, 2.6, x, 3.4, M.black));
    detents(gb, -7.8, 3.4, 2.6, 0.15, FEED_ANG, 0.02); detents(gb, -6.9, 3.4, 2.6, 0.15, MULT_ANG, 0.025);
    const levF = pivotLever(gb, -7.8, 3.4, 2.6, 0.4, 1.3), levM = pivotLever(gb, -6.9, 3.4, 2.6, 0.4, 1.3);
    lever(gb, -6.0, 3.4, 2.6, 0.4, 1.3, 0);
    lever(gb, -9.3, 3.2, 2.35, 0.6, 1.2, 0.4);

    // ---------- vodiaca skrutka, ťažná tyč, spínacia tyč ----------
    const rods = grp('skrutky');
    const leadScrew = cylX(rods, 0.13, 0.13, -5.25, 11.3, 4.25, 1.78, M.lead, 20);
    const feedRod = cylX(rods, 0.1, 0.1, -5.25, 11.3, 3.8, 1.78, M.feed, 16);
    cylX(rods, 0.07, 0.07, -5.25, 11.3, 3.38, 1.78, M.steel, 12);

    // ---------- vreteno, skľučovadlo, obrobok ----------
    const wk = { shape: 'round', r0: 0.45, x1: 2.6, dx: (2.6 - W_X0) / W_N, mat: 'brass' };
    const gripR = () => (wk.shape === 'hex' ? wk.r0 * Math.cos(Math.PI / 6) : wk.r0);
    const spindle = grp('sklucovadlo'); spindle.position.set(0, AXIS_Y, 0);
    cylX(spindle, 1.0, 1.0, -4.85, -4.55, 0, 0, M.steelDark, 40);
    cylX(spindle, 1.35, 1.35, -4.55, -3.75, 0, 0, M.steel, 56);
    cylX(spindle, 1.37, 1.37, -4.5, -4.42, 0, 0, M.steelDark, 56);
    const jaws = [];
    for (let i = 0; i < 3; i++) {
      const jg = new THREE.Group(); jg.rotation.x = i * TAU / 3; spindle.add(jg);
      const jaw = new THREE.Group(); jg.add(jaw); jaws.push(jaw);
      box(jaw, -3.75, -3.45, 0.45, 0.85, -0.16, 0.16, M.steelDark);
      box(jaw, -3.75, -3.6, 0.85, 1.3, -0.16, 0.16, M.steelDark);
      const kg = new THREE.Group(); kg.rotation.x = i * TAU / 3 + Math.PI / 3; spindle.add(kg);
      add(kg, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), M.black, -4.15, 1.34, 0);
    }
    const prof = new Float32Array(W_N).fill(wk.r0);
    const work = new THREE.Group(); work.position.x = W_X0; work.userData.part = 'obrobok'; spindle.add(work); G.obrobok = work;
    const workRound = new THREE.Mesh(new THREE.BufferGeometry(), M.wbrass), workHex = new THREE.Mesh(new THREE.BufferGeometry(), M.wbrass);
    [workRound, workHex].forEach((m) => { m.castShadow = true; m.receiveShadow = true; work.add(m); });
    const latheGeo = (rf, seg) => {
      // body profilu s duplikátmi na hranách → ostré osadenia
      const pts = [new THREE.Vector2(0, 0)];
      let s = 0, first = true;
      for (let k = 1; k <= W_N; k++) {
        if (k === W_N || Math.abs(rf(k) - rf(s)) > 1e-4) {
          const r = rf(s), a = s * wk.dx, b = k * wk.dx;
          if (first) { pts.push(new THREE.Vector2(r, 0)); first = false; }
          pts.push(new THREE.Vector2(r, a), new THREE.Vector2(r, a), new THREE.Vector2(r, b), new THREE.Vector2(r, b));
          s = k;
        }
      }
      pts.push(new THREE.Vector2(0, W_N * wk.dx));
      const geo = new THREE.LatheGeometry(pts, seg, Math.PI / 6);
      geo.rotateZ(-Math.PI / 2);
      return geo;
    };
    const rebuildWork = () => {
      const inR = wk.r0 * Math.cos(Math.PI / 6), hex = wk.shape === 'hex';
      workRound.geometry.dispose(); workRound.geometry = latheGeo((k) => (k >= W_N ? 0 : hex ? Math.min(prof[k], inR) : prof[k]), 56);
      workHex.visible = hex;
      if (hex) { workHex.geometry.dispose(); workHex.geometry = latheGeo((k) => (k >= W_N ? 0 : prof[k] > inR + 1e-4 ? prof[k] : inR * 0.98), 6); }
    };
    const workMat = () => (wk.mat === 'steel' ? M.wsteel : wk.mat === 'alu' ? M.walu : M.wbrass);
    rebuildWork();

    // ---------- koník ----------
    const tail = grp('konik');
    box(tail, 0, 2.4, 5.14, 5.75, -1.45, 1.45, M.green);
    box(tail, 0.15, 2.25, 5.75, 7.4, -0.95, 0.95, M.green);
    cylX(tail, 0.78, 0.78, 0, 2.35, AXIS_Y, 0, M.green, 40);
    cylX(tail, 0.82, 0.82, -0.02, 0.12, AXIS_Y, 0, M.greenDark, 40);
    const quill = new THREE.Group(); quill.position.set(0, AXIS_Y, 0); tail.add(quill);
    cylX(quill, 0.36, 0.36, 0, 2.2, 0, 0, M.steel, 32);
    cylX(quill, 0.3, 0.3, -0.25, 0, 0, 0, M.steelDark, 32);
    cylX(quill, 0, 0.22, -0.7, -0.25, 0, 0, M.steel, 32);
    cylX(tail, 0.2, 0.2, 2.35, 2.75, AXIS_Y, 0, M.steelDark, 20);
    const wheelT = handwheel(tail, 0.75, 2.8, AXIS_Y, 0, 'x', 0.5);
    cylY(tail, 0.12, 0.12, 8.2, 8.3, 0.9, 0, M.steelDark, 16);
    const levQuill = pivotLeverX(tail, 0.9, 8.3, 0, 0.6);              // aretácia pinoly
    box(tail, 2.0, 2.4, 5.2, 5.7, 1.45, 1.5, M.greenDark);
    const levTail = pivotLever(tail, 2.2, 5.45, 1.5, 0.55, 1.2);       // zaistenie koníka na lôžku

    // ---------- suport ----------
    const car = grp('suport');
    box(car, -1.4, 1.4, 5.14, 5.6, -1.9, 3.0, M.green);              // pozdĺžne sane
    box(car, -1.8, 1.8, 2.6, 5.14, 1.5, 2.15, M.green);              // zámková skriňa
    box(car, -0.75, 0.75, 5.6, 5.7, -1.9, 2.9, M.ways);              // rybinové vedenie
    box(car, -0.3, 0.3, 5.45, 6.05, 3.0, 3.15, M.green);
    cylZ(car, 0.08, 0.08, 3.0, 3.35, 0, 5.8, M.steel, 12);
    cylZ(car, 0.2, 0.2, 3.15, 3.3, 0, 5.8, M.steel, 28);             // nónius
    const wheelX = handwheel(car, 0.55, 0, 5.8, 3.4, 'z', 0.45);
    cylZ(car, 0.2, 0.2, 2.15, 2.35, -0.9, 3.9, M.steelDark, 20);
    const wheelZ = handwheel(car, 0.65, -0.9, 3.9, 2.4, 'z', 0.5);
    const levFeed = pivotLever(car, 0.9, 3.3, 2.15, 0.55, 1.2);       // páka automatického posuvu
    lever(car, 0.4, 4.4, 2.15, 0.5, 1.1, 0.5);
    box(car, 1.05, 1.65, 4.25, 4.85, 2.15, 2.35, M.yellow);
    const eStop = new THREE.Group(); eStop.position.set(1.35, 4.55, 2.35); car.add(eStop);   // núdzový STOP
    cylZ(eStop, 0.09, 0.09, 0, 0.07, 0, 0, M.steelDark, 16); cylZ(eStop, 0.2, 0.19, 0.07, 0.16, 0, 0, M.red, 24); hitProxy(eStop, 0.27, 0, 0, 0.1);
    cylY(car, 0.07, 0.07, 5.6, 9.85, 1.25, -1.75, M.steel, 12);       // rameno DRO
    cylZ(car, 0.06, 0.06, -1.75, -0.6, 1.25, 9.8, M.steel, 12);
    box(car, 0.55, 1.95, 9.45, 10.15, -0.6, -0.35, M.panel);
    const droCanvas = document.createElement('canvas'); droCanvas.width = 256; droCanvas.height = 112;
    const droTex = new THREE.CanvasTexture(droCanvas); droTex.encoding = THREE.sRGBEncoding;
    add(car, new THREE.PlaneGeometry(1.25, 0.55), new THREE.MeshBasicMaterial({ map: droTex, toneMapped: false }), 1.25, 9.8, -0.344);
    let droKey = '';
    const drawDro = (x, z) => {
      const key = `${x.toFixed(2)}|${z.toFixed(2)}`; if (key === droKey) return; droKey = key;   // textúra sa mení len pri zmene údaja
      const g = droCanvas.getContext('2d');
      g.fillStyle = '#071008'; g.fillRect(0, 0, 256, 112);
      g.fillStyle = '#ff5a3c'; g.font = 'bold 40px "Share Tech Mono", Consolas, monospace';
      g.fillText('X', 12, 48); g.fillText(x.toFixed(2).padStart(7, ' '), 64, 48);
      g.fillText('Z', 12, 98); g.fillText(z.toFixed(2).padStart(7, ' '), 64, 98);
      droTex.needsUpdate = true;
    };

    // ---------- priečne sane, horné sane s mikroposuvom, nožová hlava ----------
    const cross = grp('priecny', car);
    box(cross, -0.9, 0.9, 5.7, 6.1, -0.35, 1.6, M.green);
    cylY(cross, 0.68, 0.68, 6.1, 6.2, POST.x, POST.z, M.greenDark, 40);   // otočná podložka horných saní
    box(cross, -0.7, 1.0, 6.2, 6.38, 0.6, 1.4, M.green);                 // spodok horných saní
    box(cross, 1.0, 1.15, 6.2, 6.5, 0.78, 1.22, M.greenDark);            // ložisko skrutky
    cylX(cross, 0.06, 0.06, 1.15, 1.32, 6.38, POST.z, M.steel, 12);
    cylX(cross, 0.14, 0.14, 1.15, 1.22, 6.38, POST.z, M.steel, 24);      // nónius mikroposuvu
    const wheelTop = handwheel(cross, 0.3, 1.36, 6.38, POST.z, 'x', 0.22);
    const top = new THREE.Group(); cross.add(top);
    box(top, -0.78, 0.82, 6.38, 6.6, 0.5, 1.5, M.green);                 // horné sane
    box(top, -0.78, 0.82, 6.38, 6.42, 0.48, 1.52, M.ways);
    const post = new THREE.Group(); post.position.set(POST.x, POST.y, POST.z); top.add(post);
    const postBody = new THREE.Group(); post.add(postBody);
    box(postBody, -0.45, 0.45, 0, 0.68, -0.45, 0.45, M.steelDark);
    box(postBody, -0.45, 0.45, 0.9, 1.12, -0.45, 0.45, M.steelDark);
    box(postBody, -0.12, 0.12, 0.68, 0.9, -0.12, 0.12, M.steel);
    cylY(postBody, 0.12, 0.12, 1.12, 1.2, 0, 0, M.steel, 16);
    hitProxy(postBody, 0.55, 0, 0.5, 0);
    const levPost = pivotLeverY(post, 0, 1.22, 0, 0.75, 0.25);           // páka odistenia nožovej hlavy
    const slotG = [0, 1, 2, 3].map((k) => { const g = new THREE.Group(); g.rotation.y = k * Math.PI / 2; post.add(g); return g; });
    const TIP_Y = AXIS_Y - POST.y, TIP_OZ = TIP_LZ - POST.z;
    const toolOx = (s) => { const tl = LATHE_TOOLS[s.type]; return -0.47 - (s.hand === 'L' ? -tl.sh[1] : tl.sh[0]); };
    const buildTool = (k, s) => {
      const g = slotG[k];
      while (g.children.length) { const o = g.children[0]; g.remove(o); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); }
      const tl = LATHE_TOOLS[s.type], mir = s.hand === 'L' ? -1 : 1;
      const tool = new THREE.Group(); tool.position.set(toolOx(s), TIP_Y, TIP_OZ); g.add(tool);
      const pts = tl.pts.map(([x, z]) => [x * mir, z]);
      const shp = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? shp.lineTo(x, z) : shp.moveTo(x, z)));
      const head = new THREE.ExtrudeGeometry(shp, { depth: 0.17, bevelEnabled: false }); head.rotateX(Math.PI / 2);
      add(tool, head, M.shank);
      const tipShp = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? tipShp.lineTo(x * 0.4, z * 0.4) : tipShp.moveTo(x * 0.4, z * 0.4)));
      const tipGeo = new THREE.ExtrudeGeometry(tipShp, { depth: 0.05, bevelEnabled: false }); tipGeo.rotateX(Math.PI / 2); tipGeo.translate(0, 0.004, 0);
      add(tool, tipGeo, M.insert);
      const zMax = Math.max(...pts.map((p) => p[1])), sx0 = mir > 0 ? tl.sh[0] : -tl.sh[1], sx1 = mir > 0 ? tl.sh[1] : -tl.sh[0];
      box(tool, sx0, sx1, -0.17, 0, zMax, 1.6, M.shank);
      // upínacie skrutky nad drieku
      const bolts = new THREE.Group(); g.add(bolts); tool.userData.bolts = bolts;
      [-0.25, 0.2].forEach((z) => cylY(bolts, 0.055, 0.055, 1.12, 1.27, toolOx(s) + (sx0 + sx1) / 2, z, M.black, 6));
      g.userData.key = `${s.type}${s.hand}`; g.userData.tool = tool;
    };

    // ---------- triesky ----------
    const chipsP = createParticles(scene, new THREE.BoxGeometry(0.06, 0.015, 0.1), M.chip, 140);
    let chipAcc = 0;

    // ---------- stav simulácie ----------
    const st = {
      car: JAW_X + c.z / 100 - TIP0, top: c.top / 100, r: c.x / 200, q: c.quill / 100, tail: JAW_X + c.tail / 100, tipX: 0,
      rpm: 0, spin: 0, rodA: 0, cutting: false, cutT: -9, workEnd: wk.x1, msg: null,
      slot: c.slot, ang: 0, postLocked: c.postLock, job: null, jobs: [],
    };
    const slots = c.slots.map((s) => ({ ...s }));
    slots.forEach((s, k) => buildTool(k, s));
    const tipOf = (car = st.car, tp = st.top, slot = st.slot) => car + tp + POST.x + toolOx(slots[slot]);
    st.tipX = tipOf();
    let t = 0, last = performance.now(), teleT = 0, workDirty = false, lastBuild = 0, lastAuto = c.autoFeed;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 2.6 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };

    // tvar aktívneho noža a rozsah jeho tela v osi Z
    const profOf = (s) => { const tl = LATHE_TOOLS[s.type], m = s.hand === 'L' ? -1 : 1; return (d) => tl.prof(d * m); };
    // vzdialenosť tela noža od hrotu v smere k osi pri bočnej polohe d (mimo ostria) – podľa obrysu noža
    const bodyZ = (s, d) => {
      const m = s.hand === 'L' ? -1 : 1, pts = LATHE_TOOLS[s.type].pts; let zm = Infinity;
      for (let k = 0; k < pts.length; k++) {
        const [x1, z1] = pts[k], [x2, z2] = pts[(k + 1) % pts.length], a = x1 * m, b = x2 * m;
        if (a !== b && (d - a) * (d - b) <= 0) { const z = z1 + (z2 - z1) * (d - a) / (b - a); if (z < zm) zm = z; }
      }
      return zm;
    };
    const span = (tx, fn) => {
      const i0 = Math.max(0, Math.floor((tx - 0.36 - W_X0) / wk.dx)), i1 = Math.min(W_N - 1, Math.floor((tx + 0.36 - W_X0) / wk.dx));
      for (let i = i0; i <= i1; i++) fn(i, W_X0 + (i + 0.5) * wk.dx - tx);
    };
    // prienik reznej časti (pen) a tela noža mimo ostria (side) do materiálu
    const penetration = (tx, rr, s = slots[st.slot]) => {
      const pf = profOf(s); let pen = 0, side = 0;
      span(tx, (i, d) => {
        const o = pf(d);
        if (o !== Infinity) { const v = prof[i] - (rr + o); if (v > pen) pen = v; return; }
        const bz = bodyZ(s, d);
        if (bz !== Infinity) { const v = prof[i] - (rr + Math.max(0.02, bz)); if (v > side) side = v; }
      });
      return { pen, side };
    };
    const cut = (tx, rr) => {
      const pf = profOf(slots[st.slot]); let removed = 0;
      span(tx, (i, d) => {
        const o = pf(d); if (o === Infinity) return;
        const lim = Math.max(0, rr + o);
        if (prof[i] > lim + 1e-4) { removed += prof[i] - lim; prof[i] = lim; }
      });
      return removed;
    };
    const tailEngaged = () => (st.tail - st.q - 0.7) <= st.workEnd + 0.035;
    const checkPartOff = () => {
      const iJ = Math.ceil((JAW_X - W_X0) / wk.dx);
      for (let i = iJ; i < W_N; i++) {
        if (prof[i] < 0.012) {
          let rest = false;
          for (let j = i + 1; j < W_N; j++) if (prof[j] > 0.012) { rest = true; break; }
          if (!rest || tailEngaged()) return;
          for (let j = i; j < W_N; j++) prof[j] = 0;
          workDirty = true; say(L('Obrobok bol odpichnutý – odrezaná časť odpadla.', 'The workpiece was parted off – the cut-off part fell away.'), 'info');
          return;
        }
      }
    };
    const spawnChip = () => {
      chipsP.spawn(v3(st.tipX + 0.03, AXIS_Y + 0.04, st.r + 0.02), v3((Math.random() - 0.3) * 1.2, 1.2 + Math.random() * 2.2, 0.8 + Math.random() * 1.8), 5 + Math.random() * 3);
    };

    // ---------- pohľady, popisy a výber dielov ----------
    const anchors = {
      lozko: () => v3(9.0, 5.3, 1.2),
      vretennik: () => v3(-7.2, 9.5, 0.6),
      sklucovadlo: () => v3(-4.15, AXIS_Y + 1.55, 0),
      obrobok: () => v3(Math.min(JAW_X + 1.0, st.workEnd - 0.2), AXIS_Y + wk.r0 + 0.1, 0),
      suport: () => v3(st.car - 1.3, 5.2, 2.2),
      priecny: () => v3(st.car + st.top + POST.x, 8.1, st.r - TIP_LZ + 1.0),
      konik: () => v3(st.tail + 1.2, 8.7, 0),
      skrutky: () => v3(8.6, 4.3, 1.9),
      prevodovka: () => v3(-7.5, 5.0, 2.35),
      podstavec: () => v3(-7.6, 3.4, 1.95),
    };
    const views = {
      celok: () => [[3.5, 12.5, 20], [1, 6, 0]],
      rez: () => [[st.tipX + 1.7, 12, st.r + 2.8], [st.tipX + 0.3, AXIS_Y, st.r * 0.5], true],
      noz: () => [[st.car + st.top + 1.6, 10.6, st.r + 4.2], [st.car + st.top + POST.x, AXIS_Y, st.r + 0.6], true],
      spredu: () => [[1, 7.2, 21], [1, 6, 0]],
      zhora: () => [[1, 25, 0.6], [1, 6, 0]],
      konik: () => [[st.tail + 4.8, 10.2, 6.5], [st.tail + 0.2, 7, 0], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);

    // ---------- polotovar: nový kus, odopnutie ----------
    const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj: () => work, getSpot: () => v3(1.0, AXIS_Y + 1.2, 5.5), onState: (v) => push('unclamped', v) });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in') {
        if (c.running || st.rpm > 1) { say(L('Polotovar sa odopína len pri stojacom vretene.', 'The workpiece can only be unclamped with the spindle stopped.')); return; }
        if (tailEngaged()) { say(L('Najprv odsuň pinolu koníka – hrot podopiera obrobok.', 'Retract the tailstock quill first – the centre is supporting the workpiece.')); return; }
        if (penetration(st.tipX, st.r).pen > 0.002 || st.r < wk.r0 + 0.03) { say(L('Najprv odsuň nôž od obrobku (os X).', 'Move the tool away from the workpiece first (X axis).')); return; }
      }
      if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb polotovaru.', 'Wait until the workpiece movement finishes.'), 'info');
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) { say(L('Najprv upni polotovar späť.', 'Clamp the workpiece back first.')); return null; }
      if (c.running || st.rpm > 1) { say(L('Polotovar sa mení len pri stojacom vretene.', 'The workpiece can only be changed with the spindle stopped.')); return null; }
      wk.shape = c.bShape; wk.r0 = c.bD / 200; wk.x1 = JAW_X + c.bLen / 100; wk.dx = (wk.x1 - W_X0) / W_N; wk.mat = c.bMat;
      prof.fill(wk.r0); st.workEnd = wk.x1; workDirty = true;
      const m = workMat(); workRound.material = m; workHex.material = m; M.chip.color.setHex(LATHE_MATS[wk.mat][0]).convertSRGBToLinear();
      const out = {};
      if (st.tail - st.q - 0.7 < wk.x1 + 0.03) { st.q = 0; c.quill = 0; out.quill = 0; st.tail = Math.min(LIM.tailMax, wk.x1 + 0.8); c.tail = (st.tail - JAW_X) * 100; out.tail = c.tail; }
      if (penetration(st.tipX, st.r).pen > 0.001 || penetration(st.tipX, st.r).side > 0.001) { st.r = wk.r0 + 0.15; c.x = st.r * 200; out.x = c.x; }
      say(L('Upnutý nový polotovar.', 'A new workpiece is clamped.'), 'info');
      return out;
    };

    // ---------- výmena a natáčanie nožov ----------
    const indexClear = () => {
      // pri otáčaní hlavy opisujú nože kružnicu okolo stredu hlavy – nesmú zasiahnuť obrobok ani skľučovadlo
      const cx = st.car + st.top + POST.x, cz = st.r - TIP_LZ + POST.z, R = 1.17;
      if (cx - R < JAW_X + 0.05 && cz - R < 1.4) return false;
      let mr = 0;
      const i0 = Math.max(0, Math.floor((cx - R - W_X0) / wk.dx)), i1 = Math.min(W_N - 1, Math.floor((cx + R - W_X0) / wk.dx));
      for (let i = i0; i <= i1; i++) mr = Math.max(mr, prof[i]);
      if (st.tail - st.q - 0.7 < cx + R) mr = Math.max(mr, 0.4);
      return cz - R > mr + 0.04;
    };
    const stopped = () => !c.running && st.rpm < 1;
    const queueIndex = (target) => {
      if (st.job || st.jobs.length) { say(L('Nožová hlava sa práve otáča – počkaj.', 'The tool post is moving – wait.'), 'info'); return false; }
      if (!stopped()) { say(L('Nožová hlava sa otáča len pri stojacom vretene.', 'The tool post can only be indexed with the spindle stopped.')); return false; }
      if (!indexClear()) { say(L('Nože by pri otáčaní hlavy narazili – odsuň priečne sane od obrobku (zväčši X) alebo suport od skľučovadla.', 'The tools would hit the work while indexing – move the cross slide out (increase X) or the carriage away from the chuck.')); return false; }
      st.jobs.push({ kind: 'index', target }); return true;
    };
    const queueSwap = (k, s) => {
      if (!stopped()) { say(L('Nôž sa mení len pri stojacom vretene.', 'Tools can only be changed with the spindle stopped.')); return false; }
      if (k === st.slot) {
        const nt = st.car + st.top + POST.x + toolOx(s), p = penetration(nt, st.r, s);
        if (p.pen > 0.002 || p.side > 0.002) { say(L('Nový nôž by zasiahol obrobok – najprv odsuň priečne sane (X).', 'The new tool would hit the workpiece – move the cross slide out first (X).')); return false; }
      }
      st.jobs.push({ kind: 'swap', k, s: { ...s } }); return true;
    };
    const runJob = (dt) => {
      if (!st.job) { if (!st.jobs.length) return; st.job = st.jobs.shift(); st.job.t = 0; st.job.ph = 0; }
      const j = st.job; j.t += dt;
      if (j.kind === 'index') {
        if (j.ph === 0) { st.postLocked = false; if (j.t > 0.45) { j.ph = 1; j.t = 0; } }
        else if (j.ph === 1) {
          let d = j.target - st.slot; if (d > 2) d -= 4; if (d < -2) d += 4;
          const goal = -(st.slot + d) * Math.PI / 2;
          st.ang = approach(st.ang, goal, 3.2 * dt);
          if (Math.abs(st.ang - goal) < 1e-4) {
            st.slot = ((j.target % 4) + 4) % 4; st.ang = -st.slot * Math.PI / 2; j.ph = 2; j.t = 0;
            say(`${L('Aktívny nôž', 'Active tool')} ${st.slot + 1}: ${toolName(slots[st.slot])}.`, 'info');
          }
        } else if (j.ph === 2) { if (c.postLock) st.postLocked = true; if (j.t > 0.45 || !c.postLock) st.job = null; }
      } else {
        const g = slotG[j.k], tool = g.userData.tool, bolts = tool && tool.userData.bolts;
        if (j.ph === 0) { if (bolts) bolts.position.y = Math.min(0.12, j.t * 0.4); if (j.t > 0.3) { j.ph = 1; j.t = 0; } }
        else if (j.ph === 1) { if (tool) tool.position.z = TIP_OZ + j.t * 1.8; if (j.t > 0.5) { buildTool(j.k, j.s); slots[j.k] = { ...j.s }; const nt = g.userData.tool; nt.position.z = TIP_OZ + 0.9; nt.userData.bolts.position.y = 0.12; j.ph = 2; j.t = 0; } }
        else if (j.ph === 2) { tool.position.z = Math.max(TIP_OZ, TIP_OZ + 0.9 - j.t * 1.8); if (j.t > 0.5) { tool.position.z = TIP_OZ; j.ph = 3; j.t = 0; } }
        else { if (bolts) bolts.position.y = Math.max(0, 0.12 - j.t * 0.4); if (j.t > 0.3) { st.job = null; say(`${L('Upnutý nôž', 'Tool clamped')} ${j.k + 1}: ${toolName(slots[j.k])}.`, 'info'); } }
      }
    };

    // ---------- ručné ovládanie prvkov ----------
    const spdIdx = () => logNear(SPEEDS, c.rpm);
    const feedSel = () => {
      let best = [0, 0], bd = Infinity;
      FEED_BASE.forEach((b, i) => FEED_MULT.forEach((m, j) => { const d = Math.abs(Math.log(b * m / c.feed)) + j * 1e-6; if (d < bd) { bd = d; best = [i, j]; } }));
      return best;
    };
    const gearGuard = () => {
      if (!c.running && st.rpm < 1) return true;
      say(L('Otáčky sa preraďujú len pri stojacom vretene – najprv ho zastav.', 'Speeds can only be changed with the spindle stopped – stop it first.'), 'warn'); return false;
    };
    const setSpeed = (a, b) => { push('rpm', SPEEDS[a * 4 + b]); say(`${L('Zaradené otáčky', 'Speed selected:')} ${c.rpm} ${RPM()}.`, 'info'); };
    const setFeed = (i, j) => { push('feed', Math.round(FEED_BASE[i] * FEED_MULT[j] * 100) / 100); say(`${L('Posuv nastavený na', 'Feed set to')} ${c.feed.toFixed(2)} ${L('mm/ot', 'mm/rev')}.`, 'info'); };
    const zCar = () => (st.car + TIP0 - JAW_X) * 100;

    // ručné kolesá: turn(d) dostane pootočenie v radiánoch okolo osi kolesa
    ctrl.reg({ type: 'wheel', minR: 0.45, inc: -1, label: LL('Ručné koleso suportu (Z)', 'Carriage handwheel (Z)'), hint: LL('Ťahaj za veniec alebo kľučku, alebo toč kolieskom myši. 1 otáčka = 30 mm.', 'Drag the rim or handle, or use the mouse wheel. 1 turn = 30 mm.'),
      guard: () => { if (!c.autoFeed) return true; say(L('Pri zaradenom automatickom posuve sa ručné koleso suportu netočí – vypni páku posuvu.', 'With the automatic feed engaged the carriage handwheel is locked – disengage the feed lever.'), 'warn'); return false; },
      turn: (d) => { const a = zCar(); push('z', clamp(clamp(c.z - d * 30 / TAU, a - 20, a + 20), 10, 1150)); },
      read: () => `Z ${zCar().toFixed(1)} mm` }, wheelZ);
    ctrl.reg({ type: 'wheel', minR: 0.38, inc: 1, label: LL('Ručné koleso priečnych saní (X)', 'Cross slide handwheel (X)'), hint: LL('V smere hodinových ručičiek ide nôž k osi. 1 otáčka = 10 mm na priemere.', 'Clockwise moves the tool towards the axis. 1 turn = 10 mm on diameter.'),
      turn: (d) => { const a = st.r * 200; push('x', clamp(clamp(c.x + d * 10 / TAU, a - 5, a + 5), -10, 260)); },
      read: () => `X Ø${(st.r * 200).toFixed(2)} mm` }, wheelX);
    ctrl.reg({ type: 'wheel', minR: 0.22, inc: 1, label: LL('Mikroposuv – horné sane (Z)', 'Fine feed – top slide (Z)'), hint: LL('Jemný pozdĺžny posun noža. 1 otáčka = 2 mm, rozsah ±50 mm.', 'Fine longitudinal tool movement. 1 turn = 2 mm, range ±50 mm.'),
      turn: (d) => { const a = st.top * 100; push('top', clamp(clamp(c.top + d * 2 / TAU, a - 2, a + 2), -50, 50)); },
      read: () => `${(st.top * 100).toFixed(2)} mm` }, wheelTop);
    ctrl.reg({ type: 'wheel', minR: 0.5, inc: -1, label: LL('Ručné koleso koníka – pinola', 'Tailstock handwheel – quill'), hint: LL('V smere hodinových ručičiek sa pinola vysúva. 1 otáčka = 6 mm.', 'Clockwise extends the quill. 1 turn = 6 mm.'),
      guard: () => { if (!c.quillLock) return true; say(L('Pinola je zaistená – najprv uvoľni páku aretácie na koníku.', 'The quill is locked – release the lock lever on the tailstock first.'), 'warn'); return false; },
      turn: (d) => { const a = st.q * 100; push('quill', clamp(clamp(c.quill - d * 6 / TAU, a - 5, a + 5), 0, 150)); },
      read: () => `${L('pinola', 'quill')} ${(st.q * 100).toFixed(1)} mm` }, wheelT);

    // páky s aretovanými polohami
    ctrl.reg({ type: 'lever', angles: A_ANG, minR: 0.25, guard: gearGuard, label: LL('Páka otáčok I (rozsah)', 'Speed lever I (range)'), hint: LL('Ťahaj do polohy alebo klikni. Preraďuje sa len pri stojacom vretene.', 'Drag to a position or click. Shift only with the spindle stopped.'),
      getIdx: () => Math.floor(spdIdx() / 4), onSet: (i) => setSpeed(i, spdIdx() % 4), read: () => `${c.rpm} ${RPM()}` }, levA);
    ctrl.reg({ type: 'lever', angles: B_ANG, minR: 0.25, guard: gearGuard, label: LL('Páka otáčok II (stupeň)', 'Speed lever II (step)'), hint: LL('Ťahaj do polohy alebo klikni. Preraďuje sa len pri stojacom vretene.', 'Drag to a position or click. Shift only with the spindle stopped.'),
      getIdx: () => spdIdx() % 4, onSet: (i) => setSpeed(Math.floor(spdIdx() / 4), i), read: () => `${c.rpm} ${RPM()}` }, levB);
    ctrl.reg({ type: 'lever', angles: FEED_ANG, minR: 0.2, label: LL('Páka posuvov (Norton)', 'Feed lever (Norton)'), hint: LL('8 základných posuvov 0,05 – 0,5 mm/ot.', '8 basic feeds 0.05 – 0.5 mm/rev.'),
      getIdx: () => feedSel()[0], onSet: (i) => setFeed(i, feedSel()[1]), read: () => `${c.feed.toFixed(2)} ${L('mm/ot', 'mm/rev')}` }, levF);
    ctrl.reg({ type: 'lever', angles: MULT_ANG, minR: 0.2, label: LL('Páka násobiča posuvu', 'Feed multiplier lever'), hint: LL('Prepína násobok posuvu ×1 / ×2.', 'Switches the feed multiplier ×1 / ×2.'),
      getIdx: () => feedSel()[1], onSet: (j) => setFeed(feedSel()[0], j), read: () => `×${FEED_MULT[feedSel()[1]]} · ${c.feed.toFixed(2)} ${L('mm/ot', 'mm/rev')}` }, levM);
    ctrl.reg({ type: 'lever', angles: [0.35, -0.45], minR: 0.22, label: LL('Páka automatického posuvu', 'Automatic feed lever'), hint: LL('Dole = posuv zaradený, suport ide k skľučovadlu, keď sa točí vreteno.', 'Down = feed engaged, the carriage moves towards the chuck while the spindle turns.'),
      getIdx: () => (c.autoFeed ? 1 : 0),
      onSet: (i) => { push('autoFeed', i === 1); if (i === 1 && !(c.running && c.power)) say(L('Posuv zaradený – suport sa pohne, keď sa roztočí vreteno.', 'Feed engaged – the carriage moves once the spindle turns.'), 'info'); },
      read: () => (c.autoFeed ? L('zaradený', 'engaged') : L('vypnutý', 'off')) }, levFeed);
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.25, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('Otoč alebo klikni: 0 = vypnuté, I = zapnuté.', 'Turn or click: 0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0),
      onSet: (i) => {
        push('power', i === 1);
        if (i === 0) { push('running', false); say(L('Hlavný vypínač vypnutý – stroj je bez napätia.', 'Main switch off – the machine is de-energised.'), 'warn'); }
        else say(L('Hlavný vypínač zapnutý. Vreteno spustíš zeleným tlačidlom.', 'Main switch on. Start the spindle with the green button.'), 'info');
      },
      read: () => (c.power ? L('I – zapnuté', 'I – on') : L('0 – vypnuté', '0 – off')) }, mainSwitch);
    ctrl.reg({ type: 'lever', angles: [2.35, 1.05], minR: 0.25, label: LL('Páka odistenia nožovej hlavy', 'Tool post locking lever'), hint: LL('Uvoľnená páka dovolí pootočiť hlavu na ďalší nôž (klik na hlavu). Pri reze musí byť hlava zaistená.', 'Releasing it lets you index the post to the next tool (click the post). The post must be locked when cutting.'),
      guard: () => { if (!st.job) return true; say(L('Nožová hlava sa práve otáča – počkaj.', 'The tool post is moving – wait.'), 'info'); return false; },
      getIdx: () => (st.postLocked ? 0 : 1),
      onSet: (i) => { push('postLock', i === 0); st.postLocked = i === 0; say(i === 0 ? L('Nožová hlava zaistená.', 'Tool post locked.') : L('Nožová hlava uvoľnená – klikni na ňu a pootočí sa na ďalší nôž.', 'Tool post released – click it to index to the next tool.'), 'info'); },
      read: () => (st.postLocked ? L('zaistená', 'locked') : L('uvoľnená', 'released')) }, levPost);
    ctrl.reg({ type: 'lever', angles: [0.55, -0.55], minR: 0.2, label: LL('Aretácia pinoly', 'Quill lock'), hint: LL('Zaistená pinola sa nedá vysúvať kolesom.', 'A locked quill cannot be moved with the handwheel.'),
      getIdx: () => (c.quillLock ? 0 : 1),
      onSet: (i) => { push('quillLock', i === 0); say(i === 0 ? L('Pinola zaistená.', 'Quill locked.') : L('Pinola uvoľnená.', 'Quill released.'), 'info'); },
      read: () => (c.quillLock ? L('zaistená', 'locked') : L('uvoľnená', 'released')) }, levQuill);
    ctrl.reg({ type: 'lever', angles: [-0.7, 0.7], minR: 0.2, label: LL('Zaistenie koníka na lôžku', 'Tailstock clamp'), hint: LL('Uvoľni, ak chceš koník posunúť po lôžku.', 'Release it to slide the tailstock along the bed.'),
      getIdx: () => (c.tailLock ? 0 : 1),
      onSet: (i) => { push('tailLock', i === 0); say(i === 0 ? L('Koník zaistený na lôžku.', 'Tailstock clamped to the bed.') : L('Koník uvoľnený – dá sa posúvať.', 'Tailstock released – it can be moved.'), 'info'); },
      read: () => (c.tailLock ? L('zaistený', 'clamped') : L('uvoľnený', 'released')) }, levTail);

    // tlačidlá
    ctrl.reg({ type: 'button', label: LL('Tlačidlo ŠTART', 'START button'), hint: LL('Spustí vreteno, ak je zapnutý hlavný vypínač.', 'Starts the spindle if the main switch is on.'),
      action: () => { if (!c.power) say(L('Najprv zapni hlavný vypínač na vretenníku.', 'Switch on the main switch on the headstock first.'), 'warn'); else push('running', true); } }, btnStart);
    ctrl.reg({ type: 'button', label: LL('Tlačidlo STOP', 'STOP button'), hint: LL('Zastaví vreteno.', 'Stops the spindle.'), action: () => push('running', false) }, btnStop);
    ctrl.reg({ type: 'button', label: LL('Pracovné osvetlenie', 'Work light'), hint: LL('Zapne alebo vypne lampu.', 'Switches the lamp on or off.'),
      action: () => { push('light', !c.light); say(c.light ? L('Pracovné osvetlenie zapnuté.', 'Work light on.') : L('Pracovné osvetlenie vypnuté.', 'Work light off.'), 'info'); } }, btnLight);
    ctrl.reg({ type: 'button', label: LL('Núdzový STOP', 'Emergency STOP'), hint: LL('Okamžite zastaví vreteno aj automatický posuv.', 'Immediately stops the spindle and the automatic feed.'),
      action: () => { push('running', false); push('autoFeed', false); say(L('Núdzové zastavenie – vreteno aj posuv sú vypnuté.', 'Emergency stop – spindle and feed are off.'), 'danger'); } }, eStop);
    ctrl.reg({ type: 'button', still: true, label: LL('Nožová hlava', 'Tool post'), hint: LL('Klik pootočí hlavu na ďalší nôž – len pri uvoľnenej páke a stojacom vretene.', 'Click to index to the next tool – only with the lever released and the spindle stopped.'),
      read: () => `${st.slot + 1}: ${toolName(slots[st.slot])}`,
      action: () => {
        if (st.postLocked) { say(L('Nožová hlava je zaistená – najprv uvoľni páku na jej vrchu.', 'The tool post is locked – release the lever on top first.'), 'warn'); return; }
        if (queueIndex((st.slot + 1) % 4)) push('slot', (st.slot + 1) % 4);
      } }, postBody);

    // koník sa posúva ťahaním za teleso (zvyšok skupiny koníka, okrem kolesa a pák)
    let tail0 = 0;
    ctrl.reg({ type: 'slide', label: LL('Koník', 'Tailstock'), hint: LL('Ťahaj teleso koníka po lôžku (po uvoľnení páky zaistenia).', 'Drag the tailstock body along the bed (after releasing the clamp lever).'), read: () => `${((st.tail - JAW_X) * 100).toFixed(0)} ${L('mm od čeľustí', 'mm from the jaws')}`,
      guard: () => { if (!c.tailLock) return true; say(L('Koník je zaistený – uvoľni páku na jeho spodku.', 'The tailstock is clamped – release the lever at its base.'), 'warn'); return false; },
      start: () => { tail0 = st.tail; },
      slide: (dx) => { const a = (st.tail - JAW_X) * 100; push('tail', clamp(clamp((tail0 + dx - JAW_X) * 100, a - 40, a + 40), 350, 1245)); },
      nudge: (dir) => push('tail', clamp((st.tail - JAW_X) * 100 + dir * 10, 350, 1245)) }, tail);

    // požiadavky z panelu
    apiRef.current.setSlot = (k) => { if (queueIndex(k)) push("slot", k); };
    apiRef.current.swapTool = (k, s) => queueSwap(k, s);
    apiRef.current.setPostLock = (v) => { if (st.job) { say(L('Nožová hlava sa práve otáča – počkaj.', 'The tool post is moving – wait.'), 'info'); return; } push('postLock', v); st.postLocked = v; };

    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;

      // hlavný chod – s odopnutým polotovarom sa nespustí
      if (c.unclamped && c.running) { push('running', false); say(L('Polotovar nie je upnutý – vreteno sa nespustí.', 'The workpiece is not clamped – the spindle will not start.')); }
      st.rpm = approach(st.rpm, c.running && c.power ? c.rpm : 0, 1400 * dt);
      const running = st.rpm > 15;
      const revs = st.rpm > 0 ? 4.5 * st.rpm / (st.rpm + 500) : 0;     // vizuálne spomalené otáčanie
      st.spin += revs * TAU * dt; spindle.rotation.x = st.spin;
      st.rodA += revs * 0.35 * TAU * dt; leadScrew.rotation.x = st.rodA; feedRod.rotation.x = st.rodA * 1.6;
      wi.update(dt);
      const open = wi.open();
      jaws.forEach((j) => { j.position.y = gripR() - 0.45 + open * 0.22; });

      let iEnd = W_N - 1; while (iEnd >= 0 && prof[iEnd] < 0.012) iEnd--;
      st.workEnd = iEnd >= 0 ? W_X0 + (iEnd + 1) * wk.dx : JAW_X;

      // nožová hlava: výmena a natáčanie, aretácia
      if (c.slot !== st.slot && !st.job && !st.jobs.length) { if (!queueIndex(c.slot)) push('slot', st.slot); }
      if (!st.job && !st.jobs.length) {
        for (let k = 0; k < 4; k++) {
          const want = c.slots[k], have = slots[k];
          if (want.type !== have.type || want.hand !== have.hand) { if (!queueSwap(k, want)) { const arr = c.slots.slice(); arr[k] = { ...have }; push('slots', arr); } break; }
        }
      }
      if (!st.job && !st.jobs.length && st.postLocked !== c.postLock) st.postLocked = c.postLock;
      runJob(dt);
      post.rotation.y = st.ang;

      // automatický pozdĺžny posuv (smerom k skľučovadlu)
      if (c.autoFeed && running) {
        const zMin = (LIM.tipMin - st.top - POST.x - toolOx(slots[st.slot]) + TIP0 - JAW_X) * 100;
        c.z = Math.max(c.z - c.feed * st.rpm / 60 * c.timeScale * dt, zCar() - 3, zMin);
        if (c.z <= zMin + 0.01 && zCar() <= zMin + 0.05) { c.autoFeed = false; say(L('Automatický posuv vypnutý – suport dosiahol koncovú polohu pri skľučovadle.', 'Automatic feed off – the carriage reached its end position at the chuck.'), 'info'); }
      } else if (c.autoFeed) c.z = zCar();                              // posuv stojí s vretenom, suport nedobieha

      // pinola koníka (zaistená pinola sa nehýbe)
      if (c.quillLock && Math.abs(c.quill - st.q * 100) > 0.05) { sayOnce('qlock', true, L('Pinola je zaistená – uvoľni páku aretácie na koníku.', 'The quill is locked – release the lock lever on the tailstock.'), 'warn'); c.quill = st.q * 100; pend.quill = c.quill; } else flags.qlock = false;
      const qT = clamp(c.quill / 100, 0, LIM.quillMax);
      let qMax = st.tail - 0.7 - (st.workEnd - 0.03), qWhy = 'work';
      if (c.unclamped) qMax = LIM.quillMax;
      if (st.r < LIM.quillClear) { const m2 = st.tail - 0.7 - (st.tipX + 0.05); if (m2 < qMax) { qMax = m2; qWhy = 'tool'; } }
      let nq = approach(st.q, qT, 0.8 * dt);
      if (nq > st.q && nq > qMax) nq = Math.max(st.q, qMax);
      sayOnce('quill', qT > qMax + 0.004 && nq >= qMax - 0.004, qWhy === 'tool' ? L('Pinola by narazila do noža.', 'The quill would hit the tool.') : L('Hrot koníka dosadol do strediaceho otvoru – obrobok je podopretý.', 'The tailstock centre seated in the centre hole – the workpiece is supported.'), qWhy === 'tool' ? 'warn' : 'info');
      wheelT.rotation.z -= (nq - st.q) / 0.06 * TAU; st.q = nq;

      // poloha koníka na lôžku (zaistený koník stojí)
      if (c.tailLock && Math.abs(c.tail - (st.tail - JAW_X) * 100) > 0.5) { sayOnce('tlock', true, L('Koník je zaistený – uvoľni páku zaistenia na jeho spodku.', 'The tailstock is clamped – release the clamp lever at its base.'), 'warn'); c.tail = (st.tail - JAW_X) * 100; pend.tail = c.tail; } else flags.tlock = false;
      const tT = clamp(JAW_X + c.tail / 100, -2, LIM.tailMax);
      let tMin = st.car + LIM.carToTail, tWhy = 'car';
      const m3 = st.workEnd - 0.03 + st.q + 0.7; if (m3 > tMin && !c.unclamped) { tMin = m3; tWhy = 'work'; }
      if (st.r < LIM.quillClear) { const m4 = st.tipX + 0.05 + st.q + 0.7; if (m4 > tMin) { tMin = m4; tWhy = 'tool'; } }
      let nt = approach(st.tail, tT, 2.2 * dt);
      if (nt < st.tail && nt < tMin) nt = Math.min(st.tail, tMin);
      sayOnce('tail', tT < tMin - 0.004 && nt <= tMin + 0.004, tWhy === 'car' ? L('Koník narazil na suport.', 'The tailstock hit the carriage.') : tWhy === 'work' ? L('Hrot koníka dosadol na obrobok.', 'The tailstock centre touched the workpiece.') : L('Hrot koníka by narazil do noža.', 'The tailstock centre would hit the tool.'), tWhy === 'work' ? 'info' : 'warn');
      st.tail = nt;

      // suport (Z), horné sane (mikroposuv) a priečne sane (X) s kontrolou kolízií
      const carWant = JAW_X + c.z / 100 - TIP0, carMax = st.tail - LIM.carToTail;
      const carT = clamp(carWant, -3.4, Math.max(-3.4, carMax)), topT = clamp(c.top / 100, LIM.topMin, LIM.topMax), xT = clamp(c.x / 200, -0.05, LIM.rMax);
      const vz = st.cutting ? 0.35 : 2.6, vx = st.cutting ? 0.22 : 0.75, vt = st.cutting ? 0.12 : 0.4;
      let nc = approach(st.car, carT, vz * dt), ntp = approach(st.top, topT, vt * dt), nr = approach(st.r, xT, vx * dt);
      sayOnce('cartail', carWant > carMax + 0.004 && st.car >= carMax - 0.003, L('Suport narazil na koník – koncový doraz.', 'The carriage hit the tailstock – end stop.'), 'warn');
      let blocked = null;
      const busy = !!st.job;
      if (nc !== st.car || ntp !== st.top || nr !== st.r) {
        const qTip = st.tail - st.q - 0.7, p0 = penetration(st.tipX, st.r);
        const canCut = running && st.postLocked && !busy;
        let why = null;
        const ok = (cc, tp, rr) => {
          const tx = tipOf(cc, tp);
          if (tx < LIM.tipMin) { why = 'chuck'; return false; }
          if (rr < LIM.quillClear && tx > qTip - 0.05) { why = 'quill'; return false; }
          if (c.unclamped) return true;
          const p = penetration(tx, rr);
          if (p.side > Math.max(0.002, p0.side + 1e-5)) { why = 'side'; return false; }
          if (!canCut && p.pen > Math.max(0.002, p0.pen + 1e-5)) { why = running ? 'post' : 'work'; return false; }
          return true;
        };
        if (!ok(nc, ntp, nr)) {
          blocked = why;
          let a = st.car, b = st.top, r = st.r;
          if (ok(nc, b, r)) a = nc;
          if (ok(a, ntp, r)) b = ntp;
          if (ok(a, b, nr)) r = nr;
          nc = a; ntp = b; nr = r;
        }
      }
      sayOnce('toolwork', blocked === 'work', L('Nôž narazil na obrobok. Pri stojacom vretene nemôže rezať – spusti hlavný chod.', 'The tool hit the workpiece. It cannot cut with the spindle stopped – start the spindle.'), 'danger');
      sayOnce('toolpost', blocked === 'post', L('Nožová hlava nie je zaistená – pri reze by sa nôž pootočil. Zaisti páku.', 'The tool post is not locked – the tool would turn in the cut. Lock the lever.'), 'danger');
      sayOnce('toolside', blocked === 'side', L('Nôž by narazil do materiálu bokom – tento tvar noža tadiaľ nereže. Zvoľ vhodný nôž alebo smer posuvu.', 'The tool would hit the material with its side – this tool shape does not cut that way. Choose a suitable tool or feed direction.'), 'warn');
      sayOnce('toolquill', blocked === 'quill', L('Nôž by narazil do hrotu koníka.', 'The tool would hit the tailstock centre.'), 'warn');
      sayOnce('toolchuck', blocked === 'chuck', L('Nôž by narazil do čeľustí skľučovadla.', 'The tool would hit the chuck jaws.'), 'warn');
      wheelZ.rotation.z -= (nc - st.car) / 0.3 * TAU;
      wheelTop.rotation.z += (ntp - st.top) / 0.02 * TAU;
      wheelX.rotation.z += (nr - st.r) / 0.05 * TAU;
      st.car = nc; st.top = ntp; st.r = nr; st.tipX = tipOf();

      // rezanie
      if (running && st.postLocked && !busy && !c.unclamped) {
        const removed = cut(st.tipX, st.r);
        if (removed > 0) {
          st.cutT = t; workDirty = true; checkPartOff();
          chipAcc += dt * 45; while (chipAcc >= 1) { spawnChip(); chipAcc -= 1; }
        }
      }
      st.cutting = t - st.cutT < 0.25;
      if (workDirty && t - lastBuild > 0.06) { rebuildWork(); workDirty = false; lastBuild = t; }

      // pohyb skupín
      car.position.x = st.car;
      top.position.x = st.top;
      cross.position.z = st.r - TIP_LZ;
      tail.position.x = st.tail;
      quill.position.x = -st.q;
      M.lamp.emissive.setHex(c.running && c.power ? 0x22dd55 : c.power ? 0x8a5a00 : 0x000000);
      lamp.update(c.light);

      chipsP.update(dt, (p) => (p.x > -5.2 && p.x < 12 && Math.abs(p.z) < 1.5 ? 5.16 : p.x > -5.2 && p.x < 9.6 && p.z > -2 && p.z < 2.7 ? 1.57 : 0.02));

      ctrl.update(dt);
      insp.update(t, c);

      if (t - teleT > 0.1) {
        teleT = t;
        const zmm = (st.tipX - JAW_X) * 100, dmm = st.r * 200;
        const iTool = clamp(Math.floor((st.tipX - W_X0) / wk.dx), 0, W_N - 1);
        setTele({
          rpm: st.rpm, z: zmm, x: dmm, quill: st.q * 100, tail: (st.tail - JAW_X) * 100, carZ: zCar(), top: st.top * 100,
          vc: Math.PI * Math.max(0, dmm) * st.rpm / 1000, cutting: st.cutting && running, engaged: tailEngaged() && !c.unclamped,
          msg: st.msg && st.msg.until > t ? st.msg : null, workD: prof[iTool] * 200, slot: st.slot, busy: !!st.job || st.jobs.length > 0, postLocked: st.postLocked,
        });
        if (c.autoFeed) pend.z = Math.round(c.z * 10) / 10;
        if (lastAuto !== c.autoFeed) pend.autoFeed = c.autoFeed;
        lastAuto = c.autoFeed;
        if (Object.keys(pend).length) {
          const p = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
        drawDro(dmm, zmm);
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(raf); ctrl.dispose(); insp.dispose(); wi.dispose(); disposeStage(); };
  }, []);

  const parts = latheParts();
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped ? { kind: 'info', text: L('Polotovar je odopnutý a vybratý zo stroja.', 'The workpiece is unclamped and out of the machine.') }
    : tele.cutting ? { kind: 'run', text: `${L('Nôž v reze', 'Tool cutting')} – Ø${tele.workD.toFixed(1)} mm, vc ${tele.vc.toFixed(0)} m/min` }
    : tele.rpm > 15 ? { kind: 'run', text: L('Vreteno beží. Prisuň nôž k obrobku posuvom X.', 'The spindle is running. Bring the tool to the workpiece with the X feed.') }
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý – stroj je bez napätia.', 'The main switch is off – the machine is de-energised.') }
    : { kind: 'idle', text: L('Stroj stojí. Spusti hlavný chod, potom nastav nôž.', 'The machine is stopped. Start the spindle, then set the tool.') };
  const running = ui.running;
  const chips = [{ color: tele.rpm > 15 ? '#3ee06c' : '#8b8f89', text: tele.rpm > 15 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Vreteno stojí', 'Spindle stopped') }];
  if (tele.cutting) chips.push({ color: '#ffb340', text: L('Rez', 'Cutting') });
  if (tele.engaged) chips.push({ color: '#7fb6ff', text: L('Podopreté hrotom', 'Supported by centre') });
  if (!tele.postLocked) chips.push({ color: '#ff8a1f', text: L('Hlava uvoľnená', 'Post released') });
  const es = edit != null ? edit : tele.slot;
  const draft = ui.slots[es];
  const setDraft = (patch) => { const arr = ui.slots.map((s) => ({ ...s })); arr[es] = { ...arr[es], ...patch }; set('slots', arr); };

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} />
      <aside className="panel">
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · sústruh', 'Simulator · lathe')} title={L('Konvenčný hrotový sústruh', 'Conventional centre lathe')}
          sub={L('Predloha: sústruhy TOS SN a VDF. Mierka 1 : 100 mm.', 'Modelled after TOS SN and VDF lathes. Scale 1 : 100 mm.')}
          rows={[['X Ø', tele.x.toFixed(2)], ['Z', tele.z.toFixed(2)]]}
          foot={[`n ${Math.round(tele.rpm)} ${RPM()}`, `vc ${tele.vc.toFixed(0)} m/min`]} status={statusMsg} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
          <button type="button" className={`btn-run ${running ? 'stop' : 'start'}`}
            onClick={() => { if (!running && !ui.power) set('power', true); set('running', !running); }}>
            {running ? L('■ Stop vretena', '■ Stop spindle') : L('▶ Štart vretena', '▶ Start spindle')}
          </button>
          <div className="mt-2">
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => { const v = !ui.power; set('power', v); if (!v) set('running', false); }} />
            <Toggle on={ui.light} label={L('Pracovné osvetlenie', 'Work light')} onClick={() => set('light', !ui.light)} />
          </div>
          <div className="mt-3">
            <StepSelect id="rpm" label={L('Otáčky vretena', 'Spindle speed')} unit={RPM()} values={SPEEDS} value={ui.rpm} onChange={(v) => set('rpm', v)}
              locked={ui.running || tele.rpm > 1} lockNote={GEAR_LOCK()} />
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Posuvy suportu', 'Carriage feeds')}</h2>
          <Slider id="z" label={L('Suport pozdĺžne Z (od čeľustí)', 'Carriage Z (from the jaws)')} unit="mm" min={10} max={1150} step={1} value={ui.z} actual={tele.carZ} onChange={(v) => set('z', v)} />
          <Slider id="top" label={L('Mikroposuv – horné sane Z', 'Fine feed – top slide Z')} unit="mm" min={-50} max={50} step={0.05} value={ui.top} actual={tele.top} digits={2} onChange={(v) => set('top', v)} />
          <Slider id="x" label={L('Priečny posuv X (priemer)', 'Cross feed X (diameter)')} unit="mm" min={-10} max={260} step={0.5} value={ui.x} actual={tele.x} digits={1} onChange={(v) => set('x', v)} />
          <Toggle on={ui.autoFeed} label={L('Automatický pozdĺžny posuv k skľučovadlu', 'Automatic longitudinal feed towards the chuck')} onClick={() => set('autoFeed', !ui.autoFeed)} />
          <div className="mt-2">
            <StepSelect id="feed" label={L('Posuv na otáčku', 'Feed per revolution')} unit={L('mm/ot', 'mm/rev')} values={LATHE_FEEDS} value={ui.feed} onChange={(v) => set('feed', v)}
              fmt={(v) => L(v.toFixed(2).replace('.', ','), v.toFixed(2))} />
            <SegRow label={L('Zrýchlenie posuvu', 'Feed acceleration')} value={ui.timeScale} options={[[1, '1×'], [10, '10×'], [50, '50×']]} onChange={(v) => set('timeScale', v)} />
            <p className="text-xs muted">{L('Údaj Z na displeji je poloha hrotu noža = suport + horné sane + vyloženie zvoleného noža. X = 0 je os vretena, nôž prejde až 5 mm za os.', 'The Z readout is the tool tip position = carriage + top slide + offset of the selected tool. X = 0 is the spindle axis; the tool can go 5 mm past it.')}</p>
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Nožová hlava', 'Tool post')}</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {ui.slots.map((s, k) => (
              <button key={k} type="button" className={`tool-slot ${tele.slot === k ? 'on' : ''}`} aria-pressed={tele.slot === k}
                onClick={() => { setEdit(k); if (k !== tele.slot) apiRef.current.setSlot && apiRef.current.setSlot(k); }}>
                <b>{L('Poloha', 'Position')} {k + 1}{tele.slot === k ? ` · ${L('v reze', 'active')}` : ''}</b>{toolName(s)}
              </button>
            ))}
          </div>
          <label className="text-sm font-semibold block mb-1" htmlFor="ltool">{L('Nôž v polohe', 'Tool in position')} {es + 1}</label>
          <select id="ltool" className="sel mb-2" value={draft.type} onChange={(e) => setDraft({ type: e.target.value })}>
            {Object.entries(LATHE_TOOLS).map(([k, tl], i) => <option key={k} value={k}>{i + 1}. {L(tl.sk, tl.en)}</option>)}
          </select>
          <SegRow label={L('Prevedenie', 'Hand')} value={draft.hand} options={[['R', L('Pravý', 'Right')], ['L', L('Ľavý', 'Left')]]} onChange={(v) => setDraft({ hand: v })} />
          <Toggle on={ui.postLock} label={L('Nožová hlava zaistená', 'Tool post locked')} onClick={() => apiRef.current.setPostLock && apiRef.current.setPostLock(!ui.postLock)} />
          <p className="text-xs muted mt-2">{L('Výber polohy pootočí hlavu (páka sa uvoľní a znovu zaistí), zmena noža ho vymení. Oboje len pri stojacom vretene a s nožmi mimo obrobku. Pravý nôž reže smerom k skľučovadlu, ľavý ku koníku.', 'Choosing a position indexes the post (the lever is released and locked again); changing the tool swaps it. Both only with the spindle stopped and the tools clear of the work. A right-hand tool cuts towards the chuck, a left-hand one towards the tailstock.')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Koník', 'Tailstock')}</h2>
          <Toggle on={ui.tailLock} label={L('Koník zaistený na lôžku', 'Tailstock clamped to the bed')} onClick={() => set('tailLock', !ui.tailLock)} />
          <Toggle on={ui.quillLock} label={L('Pinola zaistená', 'Quill locked')} onClick={() => set('quillLock', !ui.quillLock)} />
          <div className="mt-2">
            <Slider id="quill" label={L('Výsuv pinoly', 'Quill extension')} unit="mm" min={0} max={150} step={1} value={ui.quill} actual={tele.quill} onChange={(v) => set('quill', v)} />
            <Slider id="tail" label={L('Poloha koníka na lôžku', 'Tailstock position')} unit="mm" min={350} max={1245} step={1} value={ui.tail} actual={tele.tail} onChange={(v) => set('tail', v)} />
          </div>
        </div>

        <BlankSection onApply={() => { const r = apiRef.current.newBlank && apiRef.current.newBlank(); if (r) Object.entries(r).forEach(([k, v]) => set(k, v)); }}
          note={L('Šesťhran sa upína na plochy, priemer je cez rohy. Polotovar sa mení len pri stojacom vretene.', 'A hexagon is clamped on its flats; the size is across the corners. The workpiece can only be changed with the spindle stopped.')}>
          <SegRow label={L('Tvar', 'Shape')} value={ui.bShape} options={[['round', L('Kruhová tyč', 'Round bar')], ['hex', L('Šesťhran', 'Hexagon')]]} onChange={(v) => set('bShape', v)} />
          <SegRow label={L('Materiál', 'Material')} value={ui.bMat} options={[['brass', L('Mosadz', 'Brass')], ['steel', L('Oceľ', 'Steel')], ['alu', L('Hliník', 'Alu')]]} onChange={(v) => set('bMat', v)} />
          <Slider id="bd" label={L('Priemer', 'Diameter')} unit="mm" min={30} max={120} step={5} value={ui.bD} onChange={(v) => set('bD', v)} />
          <Slider id="blen" label={L('Vyloženie zo skľučovadla', 'Stick-out from the chuck')} unit="mm" min={150} max={600} step={10} value={ui.bLen} onChange={(v) => set('bLen', v)} />
        </BlankSection>

        <ViewSection apiRef={apiRef}
          views={[['celok', L('Celok', 'Overview')], ['rez', L('Detail rezu', 'Cutting detail')], ['noz', L('Nožová hlava', 'Tool post')], ['spredu', L('Spredu', 'Front')], ['zhora', L('Zhora', 'Top')], ['konik', L('Koník', 'Tailstock')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

export { LatheSimulator, LATHE_TOOLS, SPEEDS, LATHE_FEEDS, FEED_BASE, FEED_MULT };
export default LatheSimulator;
