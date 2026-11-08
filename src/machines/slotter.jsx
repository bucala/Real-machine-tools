import { SectionInfo } from '../ui/sectionInfo';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp, fanAngles, logNear } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { exportStl } from '../core/export';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection, fromB64, toB64 } from '../ui/tools';
import { HubDrawing } from '../ui/sketch';
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
import { crankR, cutSpeed, fwdShare, isForward, ramPos } from './shaperMath';
import {
  SLOTTER_SPEEDS,
  SLOTTER_TOOLS,
  SL_K,
  createRing,
  keywayInfo,
  ringCut,
  slotterChecks,
  squareInfo,
  toolRect,
} from './slotterMath';

// =====================================================================
// ZVISLÁ OBRÁŽAČKA TOS ST 350 – drážkovačka s kulisovým pohonom smykadla
// =====================================================================
// mierka 1 = 100 mm; os smykadla je zvislá v x = 0, z = 0; pracovný zdvih ide dole.
// Krížový stôl: pozdĺžne X (k stojanu = −X), priečne Z, otočný stôl C; na ňom trojčeľusťové skľučovadlo s obrobkom.
const SL = {
  TIPX: 0.1, // ostrie noža voči osi smykadla
  WB: 4.35, // spodok obrobku = čelo skľučovadla
  TL: 1.2, // dĺžka noža od ostria po spodok smykadla
  HOLE: 0.3, // priechodný otvor skľučovadla a otočného stola
  GX: SL_K.d - SL_K.Lk,
  GY: 9.9, // stred kolesa kulisy (os kývania kulisy je o SL_K.d ďalej od smykadla)
};
const PX = SL.GX - SL_K.d; // os kývania kulisy; koniec kulisy je v osi smykadla (PX + Lk = 0)
const SPEED_ANG = fanAngles(6, 1.15);
const TOOL_LIST = [
  ['drazk8', 'Drážkovací nôž 8 mm', 'Keyway tool 8 mm'],
  ['drazk12', 'Drážkovací nôž 12 mm', 'Keyway tool 12 mm'],
  ['plochy', 'Plochý nôž 16 mm', 'Flat tool 16 mm'],
];
const toolName = (id) => {
  const t = TOOL_LIST.find(([k]) => k === id);
  return t ? L(t[1], t[2]) : id;
};
const DIVS = [2, 3, 4, 6, 8];

const slotterParts = () =>
  mkParts([
    [
      'podstavec',
      'Lôžko',
      'Bed',
      'Lôžko stroja',
      'Machine bed',
      'Liatinové lôžko nesie stojan a vedenia pozdĺžneho saní stola. V prednej časti je koleso pozdĺžneho posuvu.',
      'The cast-iron bed carries the column and the ways of the longitudinal saddle. The longitudinal feed handwheel is at the front.',
    ],
    [
      'stojan',
      'Stojan',
      'Column',
      'Stojan s hlavou',
      'Column with head',
      'Vysoký stojan prechádza hore do vyloženej hlavy („labutí krk“). V hlave je prevodovka so šiestimi stupňami zdvihov a kulisový mechanizmus, vpredu zvislé vedenie smykadla.',
      'The tall column rises into an overhanging head ("gooseneck"). The head houses the six-speed gearbox and the slotted-link drive, with the vertical ram guide at the front.',
    ],
    [
      'kulisa',
      'Kulisa',
      'Slotted link',
      'Kulisový mechanizmus',
      'Slotted-link mechanism',
      'Veľké koleso má čap v radiálnej drážke; čap posúva kameň v kulise, ktorá sa kýve okolo zadného čapu a koncom ťahá smykadlo hore a dole. Vzdialenosť čapu od stredu určuje dĺžku zdvihu. Pracovný zdvih (dole) trvá dlhšie ako spätný.',
      'The bull gear carries a crank pin in a radial slot; the pin drives a block in the link, which swings about its rear pivot and moves the ram up and down. The pin radius sets the stroke. The cutting stroke (down) is slower than the return.',
    ],
    [
      'smykadlo',
      'Smykadlo',
      'Ram',
      'Zvislé smykadlo',
      'Vertical ram',
      'Smykadlo sa pohybuje zvisle vo vedení hlavy. Poloha zdvihu sa nastavuje posunutím smykadla voči kulise pri stojacom stroji – nôž musí pri každom zdvihu prejsť celou výškou obrobku a vyjsť nad neho.',
      'The ram moves vertically in the head guide. The stroke position is set by shifting the ram against the link with the machine stopped – the tool must pass the full height of the work and clear it on every stroke.',
    ],
    [
      'noz',
      'Nôž',
      'Tool',
      'Drážkovací nôž',
      'Slotting tool',
      'Nôž je upnutý v držiaku na spodku smykadla, ostrie smeruje od stojana. Režie len pri zdvihu dole; prierez triesky = šírka × posuv na zdvih.',
      'The tool is clamped in the holder at the bottom of the ram, its edge facing away from the column. It cuts only on the down stroke; chip section = width × feed per stroke.',
    ],
    [
      'stol',
      'Krížový stôl',
      'Compound table',
      'Krížový stôl',
      'Compound table',
      'Pozdĺžne sane (X, k stojanu a od neho) a priečne sane (Z). Oba posuvy majú ručné koleso (1 otáčka = 5 mm) a automatický západkový posuv o krok na začiatku každého pracovného zdvihu.',
      'Longitudinal saddle (X, to and from the column) and cross slide (Z). Both have a handwheel (1 turn = 5 mm) and an automatic ratchet step at the start of every cutting stroke.',
    ],
    [
      'otocny',
      'Otočný stôl',
      'Rotary table',
      'Otočný stôl',
      'Rotary table',
      'Kruhový stôl so závitovkou: 1 otáčka kolieska = 4°. Delením sa obrobok pootočí o 360°/z – napr. o 90° pri štvorhrannom otvore.',
      'Circular table driven by a worm: 1 turn of the handwheel = 4°. Indexing turns the work by 360°/z – e.g. 90° for a square hole.',
    ],
    [
      'sklucovadlo',
      'Skľučovadlo',
      'Chuck',
      'Trojčeľusťové skľučovadlo',
      'Three-jaw chuck',
      'Obrobok je upnutý za vonkajší priemer. Skľučovadlo aj stôl majú v strede otvor Ø60 – nôž doň vybehne pod obrobok. Mimo otvoru by narazil.',
      'The work is gripped on its outside. The chuck and the table have a Ø60 hole in the centre – the tool overruns into it below the work. Outside the hole it would crash.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Náboj (obrobok)',
      'Hub (workpiece)',
      'Oceľový náboj s predvŕtaným otvorom. Obrobená plocha otvoru je svetlá.',
      'Steel hub with a pre-bored hole. The machined part of the bore is bright.',
    ],
    [
      'rozvadzac',
      'Rozvádzač',
      'Control box',
      'Elektrický rozvádzač',
      'Electrical box',
      'Hlavný vypínač, Štart, Stop a núdzový STOP. Nad ním páka prevodovky zdvihov a štvorhran dĺžky zdvihu.',
      'Main switch, Start, Stop and the emergency stop. Above it the stroke-speed lever and the stroke-length square.',
    ],
  ]);

// pohľad zhora na náboj s tvarom otvoru (mm)
const SLOTTER_TASKS = [
  {
    id: 'drazka',
    title: () => L('Drážka pre pero 12 × 3,3 v náboji', 'Keyway 12 × 3.3 in a hub'),
    desc: () =>
      L(
        'Náboj Ø100 × 50 mm s otvorom Ø40. Drážkovacím nožom 12 mm vyobrážaj drážku pre pero 12 × 8 (STN/DIN 6885, hĺbka v náboji t2 = 3,3 ±0,1 mm). Nastav zdvih asi o 40 mm dlhší ako náboj tak, aby nôž hore vyšiel nad obrobok a dole vybehol do otvoru skľučovadla. Nôž prisúvaj stolom k stojanu (os X) automatickým posuvom 0,2 – 0,5 mm na zdvih.',
        'Hub Ø100 × 50 mm with a Ø40 bore. With the 12 mm keyway tool shape a keyway for a 12 × 8 key (DIN 6885, hub depth t2 = 3.3 ±0.1 mm). Set the stroke about 40 mm longer than the hub so that the tool clears the top and overruns into the chuck hole. Feed the table towards the column (X axis) automatically by 0.2 – 0.5 mm per stroke.',
      ),
    setup: {
      dOut: 100,
      dIn: 40,
      H: 50,
      tool: 'drazk12',
      S: 90,
      pos: 0,
      tx: 0,
      tz: 0,
      cA: 0,
      autoF: false,
      fAx: 'x',
      fdir: -1,
      feed: 0.3,
    },
    drawing: () => <HubDrawing kind="drazka" />,
    labels: {
      width: () => L('Šírka drážky 12 ±0,25 mm', 'Keyway width 12 ±0.25 mm'),
      depth: () => L('Hĺbka od otvoru 3,3 ±0,1 mm', 'Depth from the bore 3.3 ±0.1 mm'),
      one: () => L('Jedna súvislá drážka', 'One continuous keyway'),
    },
  },
  {
    id: 'stvorec',
    title: () => L('Štvorhranný otvor 25 × 25', 'Square hole 25 × 25'),
    desc: () =>
      L(
        'Náboj Ø100 × 50 mm s otvorom Ø24. Plochým nožom 16 mm vyobrážaj štvorhranný otvor 25 × 25 mm (steny 12,5 mm od stredu, ostré rohy). Pri každej stene najprv prisuň nôž stolom X na mieru steny, potom posúvaj stôl priečne (Z) od stredu k rohom – pri rohoch s menším posuvom. Ďalšiu stenu dostaneš pootočením otočného stola o 90° (delenie z = 4).',
        'Hub Ø100 × 50 mm with a Ø24 bore. With the 16 mm flat tool shape a square hole 25 × 25 mm (walls 12.5 mm from the centre, sharp corners). For each wall first feed the tool to the wall with table X, then traverse the table across (Z) from the centre to the corners – with a smaller feed near the corners. The next wall is reached by indexing the rotary table by 90° (z = 4).',
      ),
    setup: {
      dOut: 100,
      dIn: 24,
      H: 50,
      tool: 'plochy',
      S: 90,
      pos: 0,
      tx: 0,
      tz: 0,
      cA: 0,
      autoF: false,
      fAx: 'x',
      fdir: -1,
      feed: 0.5,
      div: 4,
    },
    drawing: () => <HubDrawing kind="stvorec" />,
    labels: {
      walls: () => L('Steny štvorca 25 × 25 ±0,2 mm', 'Square walls 25 × 25 ±0.2 mm'),
      corners: () => L('Vyobrážané rohy (≥ 17,4 mm od stredu)', 'Corners shaped out (≥ 17.4 mm from the centre)'),
    },
  },
].map((t) => ({ ...t, checks: (m) => slotterChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const SLOTTER_SAFETY = () => [
  L(
    'Obrobok je pevne v skľučovadle, kľúč od skľučovadla je vybratý.',
    'The work is firm in the chuck, the chuck key is removed.',
  ),
  L(
    'Zdvih a jeho poloha sú nastavené pri stojacom stroji: nôž vyjde nad obrobok a dole vybehne do otvoru skľučovadla.',
    'Stroke length and position were set with the machine stopped: the tool clears the top and overruns into the chuck hole.',
  ),
  L(
    'Nôž je upnutý s ostrím od stojana, držiak je dotiahnutý.',
    'The tool is clamped with the edge away from the column, the holder is tight.',
  ),
  L(
    'Mám okuliare, ruky mám mimo dráhy smykadla a stola.',
    'I wear glasses and keep my hands away from the ram and table path.',
  ),
];

function SlotterSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    run: false,
    manual: false,
    cover: false,
    light: true,
    n: 36,
    S: 90,
    pos: 0,
    tx: 0,
    tz: 0,
    cA: 0,
    autoF: false,
    fAx: 'x',
    fdir: -1,
    feed: 0.3,
    div: 4,
    tool: 'drazk12',
    dOut: 100,
    dIn: 40,
    H: 50,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    tip: 0,
    tx: 0,
    tz: 0,
    ca: 0,
    msg: null,
    cutting: false,
    fwd: true,
    running: false,
    area: 0,
  });

  useEffect(() => {
    const mount = mountRef.current,
      layer = layerRef.current,
      tipEl = tipRef.current;
    const c = ctl.current;
    const { TIPX, WB, TL, HOLE, GX, GY } = SL;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('shaper');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x58798c, 0x4a687a, 0x354b59),
      work: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.32,
        metalness: 0.75,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
      chip: std(0x6b5a48, 0.45, 0.6),
      inner: std(0x262b2f, 0.8, 0.1),
      gear: std(0x5d6468, 0.45, 0.7),
      hss: std(0xd9dde0, 0.25, 0.9),
      lampShade: std(0x5b7a8e, 0.5, 0.2),
    };
    const kit = makeKit(M);
    const { add, box, cylY, cylZ, ball, hitProxy, pivotLever, detents, handwheel, crank } = kit;
    const root = new THREE.Group();
    scene.add(root);
    apiRef.current.machineModel = { root, name: 'Zvislá obrážačka' };
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
    const bed = grp('podstavec');
    box(bed, -5.2, 4.6, 0, 1.1, -2.0, 2.0, M.greenDark);
    [-1.3, 1.3].forEach((z) => box(bed, -1.9, 4.5, 1.1, 1.16, z - 0.25, z + 0.25, M.ways));
    box(bed, 4.6, 4.7, 0.45, 0.95, -0.3, 0.3, M.greenDeep);
    const wX = handwheel(bed, 0.34, 4.78, 0.7, 0, 'x', 0.2);
    // ---------- stojan s hlavou; bok hlavy na strane obsluhy má okno ku kulise ----------
    const col = grp('stojan');
    box(col, -5.0, -2.3, 1.1, 8.8, -1.3, 1.3, M.green);
    box(col, -5.2, -2.1, 1.1, 1.5, -1.5, 1.5, M.greenDark);
    box(col, -5.0, 0.8, 8.8, 9.0, -1.2, 1.2, M.green); // dno hlavy
    box(col, -5.0, 0.8, 10.95, 11.2, -1.2, 1.2, M.green); // strop hlavy
    box(col, -5.0, -4.7, 9.0, 10.95, -1.2, 1.2, M.green); // zadná stena
    box(col, -5.0, 0.8, 9.0, 10.95, -1.2, -1.0, M.green); // bok odvrátený
    box(col, -4.7, -0.9, 9.0, 10.95, -1.0, -0.96, M.inner);
    box(col, -4.7, -4.4, 9.0, 10.95, 1.0, 1.2, M.green);
    box(col, -1.2, 0.8, 9.0, 10.95, 1.0, 1.2, M.green);
    const cover = box(col, -4.4, -1.2, 9.0, 10.95, 1.12, 1.2, M.green); // kryt okna kulisy
    // zvislé vedenie smykadla v čele hlavy
    box(col, -0.8, -0.42, 7.2, 11.2, -0.6, 0.6, M.greenDark);
    [-1, 1].forEach((s) => {
      box(col, -0.8, 0.55, 7.2, 8.8, s * 0.42, s * 0.6, M.greenDark);
      box(col, 0.42, 0.55, 7.2, 11.2, s * 0.3, s * 0.42, M.ways);
    });
    box(col, -2.3, -0.8, 7.6, 8.8, -0.9, 0.9, M.green); // náväznosť vedenia na stojan
    // ---------- kulisa v hlave ----------
    const kul = grp('kulisa', col);
    const bull = new THREE.Group();
    bull.position.set(GX, GY, 0.35);
    kul.add(bull);
    cylZ(bull, 0.95, 0.95, -0.12, 0.12, 0, 0, M.gear, 48);
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * TAU,
        t = add(bull, new THREE.BoxGeometry(0.1, 0.12, 0.22), M.gear, Math.cos(a) * 0.99, Math.sin(a) * 0.99, 0);
      t.rotation.z = a;
    }
    box(bull, 0.04, 0.88, -0.08, 0.08, 0.12, 0.14, M.inner); // radiálna drážka čapu
    const pin = cylZ(bull, 0.1, 0.1, 0.12, 0.42, 0.5, 0, M.steel, 16);
    const pinion = new THREE.Group();
    pinion.position.set(GX - 1.25, GY + 0.45, 0.35);
    kul.add(pinion);
    cylZ(pinion, 0.32, 0.32, -0.1, 0.1, 0, 0, M.steelDark, 20);
    box(pinion, -0.04, 0.04, -0.34, 0.34, -0.11, 0.11, M.inner);
    const lnk = new THREE.Group();
    lnk.position.set(PX, GY, 0.68);
    kul.add(lnk);
    box(lnk, 0, SL_K.Lk - 0.05, -0.2, 0.2, -0.08, 0.08, M.steelDark);
    box(lnk, 0.6, SL_K.Lk - 0.45, -0.07, 0.07, 0.08, 0.09, M.inner);
    cylZ(kul, 0.18, 0.18, 0.5, 0.86, PX, GY, M.steel, 16);
    const stone = add(kul, new THREE.BoxGeometry(0.32, 0.18, 0.14), M.black);
    const endBlock = add(kul, new THREE.BoxGeometry(0.3, 0.42, 0.26), M.steelDark);
    // ---------- rozvádzač, páka prevodovky, štvorhran zdvihu ----------
    const box2 = grp('rozvadzac', col);
    box(box2, -4.6, -2.8, 3.0, 5.2, 1.3, 1.42, M.panel);
    const pbtn = (x, y, m) => {
      const g = new THREE.Group();
      g.position.set(x, y, 1.42);
      box2.add(g);
      cylZ(g, 0.12, 0.12, 0, 0.07, 0, 0, m, 20);
      hitProxy(g, 0.16, 0, 0, 0.05);
      return g;
    };
    const bStart = pbtn(-4.1, 3.9, M.btnGreen),
      bStop = pbtn(-3.7, 3.9, M.red);
    const lampRun = std(0x1f5f33, 0.4, 0.1);
    ball(box2, 0.07, -3.3, 3.9, 1.44, lampRun);
    const eStop = new THREE.Group();
    eStop.position.set(-3.7, 3.45, 1.42);
    box2.add(eStop);
    box(box2, -4.0, -3.4, 3.2, 3.7, 1.42, 1.43, M.yellow);
    cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16);
    cylZ(eStop, 0.18, 0.17, 0.07, 0.15, 0, 0, M.red, 24);
    hitProxy(eStop, 0.24, 0, 0, 0.1);
    const mainSw = new THREE.Group();
    mainSw.position.set(-3.7, 4.7, 1.43);
    box2.add(mainSw);
    cylZ(mainSw, 0.17, 0.17, 0, 0.06, 0, 0, M.black, 24);
    box(mainSw, -0.045, 0.045, -0.2, 0.2, 0.06, 0.16, M.red);
    cylZ(col, 0.2, 0.17, 1.3, 1.4, -3.7, 6.3, M.black, 20);
    detents(col, -3.7, 6.3, 1.4, 0.15, SPEED_ANG, 0.022);
    const levN = pivotLever(col, -3.7, 6.3, 1.4, 0.45, 1.25);
    cylZ(col, 0.08, 0.08, 1.3, 1.42, -3.7, 7.5, M.steel, 4);
    const crS = crank(col, 0.32, -3.7, 7.5, 1.46);
    // ---------- smykadlo s nožom (počiatok skupiny = ostrie noža) ----------
    const ram = grp('smykadlo');
    box(ram, -0.4, 0.4, TL, TL + 4.6, -0.4, 0.4, M.green);
    box(ram, -0.12, 0.12, TL + 3.4, TL + 4.5, 0.4, 0.42, M.inner); // drážka pre kameň kulisy
    box(ram, -0.3, 0.3, TL - 0.2, TL, -0.3, 0.3, M.steelDark); // držiak noža
    cylZ(ram, 0.05, 0.05, 0.3, 0.38, 0.15, TL - 0.1, M.black, 8);
    const toolG = grp('noz', ram);
    const buildTool = (id) => {
      while (toolG.children.length) {
        const o = toolG.children.pop();
        o.geometry.dispose();
      }
      const T = SLOTTER_TOOLS[id],
        b = T.b / 100,
        w = T.w / 100,
        sw = Math.min(w, 0.1);
      box(toolG, TIPX - b, TIPX, 0, 0.12, -w / 2, w / 2, M.hss); // rezná časť
      box(toolG, TIPX - b, TIPX - b + 0.08, 0.12, TL - 0.2, -sw / 2, sw / 2, M.hss); // driek
    };
    buildTool(c.tool);
    // ---------- krížový stôl, otočný stôl, skľučovadlo ----------
    const sad = grp('stol');
    box(sad, -1.9, 2.3, 1.16, 2.2, -1.9, 1.9, M.green);
    [-1, 1].forEach((s) => box(sad, -1.7, 1.9, 2.2, 2.26, s * 0.9 - 0.2, s * 0.9 + 0.2, M.ways));
    cylZ(sad, 0.06, 0.06, 1.9, 2.05, 0.2, 1.7, M.steel, 10);
    const wZ = handwheel(sad, 0.3, 0.2, 1.7, 2.1, 'z', 0.18);
    const crs = new THREE.Group();
    sad.add(crs);
    box(crs, -1.7, 1.9, 2.26, 3.3, -1.6, 1.6, M.green);
    const rot = grp('otocny', crs);
    cylY(rot, 1.7, 1.7, 3.3, 3.5, 0, 0, M.greenDark, 48);
    box(rot, 1.6, 2.0, 3.25, 3.6, 0.35, 0.85, M.greenDark); // skriňa závitovky
    const wC = handwheel(rot, 0.24, 2.08, 3.45, 0.6, 'x', 0.14);
    const turn = new THREE.Group();
    turn.position.y = 3.5;
    rot.add(turn);
    cylY(turn, 1.6, 1.6, 0, 0.4, 0, 0, M.steelDark, 64);
    for (let k = 0; k < 4; k++) {
      const s = add(turn, new THREE.BoxGeometry(1.25, 0.012, 0.12), M.inner, 0, 0.402, 0);
      s.rotation.y = (k * Math.PI) / 4;
      s.translateX(0.95);
    }
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * TAU,
        m = add(
          turn,
          new THREE.BoxGeometry(k % 9 ? 0.06 : 0.12, 0.012, 0.012),
          M.white,
          Math.cos(a) * (1.6 - (k % 9 ? 0.03 : 0.06)),
          0.402,
          -Math.sin(a) * (1.6 - (k % 9 ? 0.03 : 0.06)),
        );
      m.rotation.y = a;
    }
    box(rot, 1.62, 1.66, 3.62, 3.9, -0.02, 0.02, M.red); // ryska stupnice
    const chuck = grp('sklucovadlo', turn);
    cylY(chuck, 0.92, 0.92, 0.4, WB - 3.5, 0, 0, M.steel, 48);
    cylY(chuck, HOLE, HOLE, 0.41, WB - 3.5 + 0.002, 0, 0, M.inner, 32);
    const jaws = [];
    for (let k = 0; k < 3; k++) {
      const j = new THREE.Group();
      j.rotation.y = (k * TAU) / 3 + Math.PI / 2;
      chuck.add(j);
      jaws.push(j);
    }
    const jawH = () => Math.min(0.3, wk.H * 0.6);
    const buildJaws = () =>
      jaws.forEach((j) => {
        while (j.children.length) {
          const o = j.children.pop();
          o.geometry.dispose();
        }
        const r0 = wk.dOut / 2;
        box(j, r0, Math.min(0.92, r0 + 0.32), WB - 3.5, WB - 3.5 + jawH(), -0.09, 0.09, M.steelDark);
        box(j, r0 + 0.1, Math.min(0.95, r0 + 0.4), WB - 3.5 - 0.02, WB - 3.5 + 0.05, -0.11, 0.11, M.steelDark);
      });
    // obrobok: prstenec r_in(θ), r_out(θ) ako sieť s tvrdými hranami
    const wk = { dOut: c.dOut / 100, dIn: c.dIn / 100, H: c.H / 100 };
    const wkG = new THREE.Group();
    wkG.position.y = WB - 3.5;
    turn.add(wkG);
    let g = null,
      mesh = null;
    const COL_RAW = new THREE.Color(0x3e4246),
      COL_CUT = new THREE.Color(0xc4cad0),
      COL_TOP = new THREE.Color(0x4b5055);
    const rebuild = () => {
      const NT = g.NT,
        pos = mesh.geometry.attributes.position.array,
        col2 = mesh.geometry.attributes.color.array,
        H = wk.H;
      let o = 0;
      const put = (x, y, z, cc) => {
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
        col2[o] = cc.r;
        col2[o + 1] = cc.g;
        col2[o + 2] = cc.b;
        o += 3;
      };
      const quad = (a, b, cc, d, e) => {
        put(...a, cc);
        put(...b, cc);
        put(...d, cc);
        put(...b, cc);
        put(...e, cc);
        put(...d, cc);
      };
      for (let j = 0; j < NT; j++) {
        const j1 = (j + 1) % NT,
          a0 = j * g.dT,
          a1 = (j + 1) * g.dT,
          c0 = Math.cos(a0),
          s0 = Math.sin(a0),
          c1 = Math.cos(a1),
          s1 = Math.sin(a1);
        const ri0 = g.rin[j],
          ri1 = g.rin[j1],
          ro0 = g.rout[j],
          ro1 = g.rout[j1];
        const I0b = [ri0 * c0, 0, ri0 * s0],
          I1b = [ri1 * c1, 0, ri1 * s1],
          I0t = [ri0 * c0, H, ri0 * s0],
          I1t = [ri1 * c1, H, ri1 * s1];
        const O0b = [ro0 * c0, 0, ro0 * s0],
          O1b = [ro1 * c1, 0, ro1 * s1],
          O0t = [ro0 * c0, H, ro0 * s0],
          O1t = [ro1 * c1, H, ro1 * s1];
        const ci = g.mIn[j] || g.mIn[j1] ? COL_CUT : COL_RAW,
          co = g.mOut[j] || g.mOut[j1] ? COL_CUT : COL_RAW;
        quad(I0b, I1b, ci, I0t, I1t);
        quad(O1b, O0b, co, O1t, O0t);
        quad(I0t, I1t, COL_TOP, O0t, O1t);
        quad(O0b, O1b, COL_RAW, I0b, I1b);
      }
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.attributes.color.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
    };
    const makeWork = () => {
      if (mesh) {
        wkG.remove(mesh);
        mesh.geometry.dispose();
      }
      g = createRing({ rIn: wk.dIn / 2, rOut: wk.dOut / 2, H: wk.H, NT: 720 });
      const geo = new THREE.BufferGeometry(),
        n = g.NT * 24 * 3;
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n), 3));
      mesh = new THREE.Mesh(geo, M.work);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.part = 'obrobok';
      wkG.add(mesh);
      G.obrobok = mesh;
      rebuild();
      buildJaws();
    };
    makeWork();
    const chips = createParticles(scene, new THREE.TorusGeometry(0.018, 0.006, 4, 8, 4.2), M.chip, 220);
    const lamp = createLamp(scene, col, kit, M, {
      base: v3(-2.4, 8.4, 1.3),
      elbow: v3(-0.4, 9.6, 1.9),
      head: v3(1.1, 8.0, 1.5),
      aim: v3(0, WB + 0.3, 0),
      angle: 0.5,
      power: 2.6,
    });

    // ---------- stav ----------
    const st = {
      phi: 0,
      w: 0,
      tip: 0,
      tx: c.tx / 100,
      tz: c.tz / 100,
      ca: (c.cA * Math.PI) / 180,
      fwd: true,
      msg: null,
      cutT: -9,
      eng: null,
      area: 0,
      cuts: 0,
    };
    let t = 0,
      last = performance.now(),
      teleT = 0,
      chipAcc = 0;
    const flags = {};
    const say = (text, kind = 'warn') => {
      st.msg = { text, kind, until: t + 3 };
    };
    const sayOnce = (key, cond, text, kind) => {
      if (cond && !flags[key]) say(text, kind);
      flags[key] = cond;
    };
    const tool = () => SLOTTER_TOOLS[c.tool] || SLOTTER_TOOLS.drazk12;
    const rOf = () => crankR(clamp(c.S, 20, 350) / 100, SL_K);
    const wTop = () => WB + wk.H;
    const tipMid = () => WB + wk.H / 2 + c.pos / 100;
    const tipAt = (phi) => tipMid() - ramPos(phi, rOf(), SL_K).x;
    const topPhi = () => TAU - Math.acos(-rOf() / SL_K.d) + 0.001; // horná úvrať = začiatok pracovného zdvihu
    // prierez noža voči stredu obrobku pri polohe stola (tx, tz)
    const rect = (tx, tz) => toolRect(tool(), TIPX - tx, -tz);
    const maxR = (r) =>
      Math.max(Math.hypot(r[0], r[2]), Math.hypot(r[0], r[3]), Math.hypot(r[1], r[2]), Math.hypot(r[1], r[3]));
    // skľučovadlo: pod obrobkom len v otvore, v pásme čeľustí len vnútri obrysu obrobku
    const hitChuck = (tip, r) =>
      (tip < WB - 0.002 && maxR(r) > HOLE) || (tip < WB + jawH() && tip > WB - 0.6 && maxR(r) > wk.dOut / 2 + 0.003);
    const inWork = (tip) => tip < wTop() - 0.001 && tip > WB - 0.001;
    const probe = (tip, tx, tz, ca) => {
      const r = rect(tx, tz);
      if (hitChuck(tip, r)) return { chuck: true, area: 0 };
      if (!inWork(tip) || c.unclamped) return { area: 0 };
      const q = ringCut(g, ca, ...r);
      return { area: q.area, embedded: q.embedded };
    };

    // ---------- pohľady, popisy, výber ----------
    const anchors = {
      podstavec: () => v3(3.8, 1.15, 1.9),
      stojan: () => v3(-4.8, 8.2, 1.3),
      kulisa: () => v3(GX, GY + 1.0, 1.0),
      smykadlo: () => v3(0.4, st.tip + TL + 1.5, 0.4),
      noz: () => v3(TIPX + 0.05, st.tip + 0.3, 0.1),
      stol: () => v3(2.3, 2.0, 1.9 + st.tz),
      otocny: () => v3(st.tx + 1.4, 3.8, st.tz + 0.8),
      sklucovadlo: () => v3(st.tx + 0.7, WB - 0.05, st.tz + 0.6),
      obrobok: () => v3(st.tx + wk.dOut / 2, wTop(), st.tz),
      rozvadzac: () => v3(-3.7, 5.3, 1.42),
    };
    const views = {
      celok: () => [
        [9.5, 9.5, 12.5],
        [-0.8, 5.4, 0],
      ],
      noz: () => [[st.tx + 1.9, WB + 2.0, st.tz + 2.3], [st.tx, WB + 0.3, st.tz], true],
      zhora: () => [[st.tx - 1.0, WB + 2.4, st.tz + 0.9], [st.tx + 0.15, wTop(), st.tz], true],
      kulisa: () => [[GX - 0.2, GY, 8.0], [GX - 0.6, GY, 0.4], true],
      panel: () => [[-2.6, 5.0, 6.0], [-3.7, 4.6, 1.4], true],
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
    const running = () => st.w > 0.05;
    apiRef.current.view = (n) => insp.goView(n, false);
    apiRef.current.measure = () => {
      let lo = Infinity,
        hi = 0;
      for (let j = 0; j < g.NT; j++) {
        lo = Math.min(lo, g.rin[j]);
        hi = Math.max(hi, g.rin[j]);
      }
      return { ring: g, info: { dMin: lo * 200, dMax: hi * 200, key: keywayInfo(g), sq: squareInfo(g, 0.125) } };
    };
    apiRef.current.save = () =>
      c.unclamped
        ? null
        : {
            v: 1,
            wk: { ...wk },
            NT: g.NT,
            rin: toB64(g.rin),
            rout: toB64(g.rout),
            mIn: toB64(g.mIn),
            mOut: toB64(g.mOut),
          };
    apiRef.current.load = (r) => {
      if (!r || r.v !== 1) return false;
      push('dOut', Math.round(r.wk.dOut * 100));
      push('dIn', Math.round(r.wk.dIn * 100));
      push('H', Math.round(r.wk.H * 100));
      if (!apiRef.current.newBlank()) return false;
      if (g.NT !== r.NT) return false;
      g.rin.set(fromB64(r.rin, Float32Array));
      g.rout.set(fromB64(r.rout, Float32Array));
      g.mIn.set(fromB64(r.mIn, Uint8Array));
      g.mOut.set(fromB64(r.mOut, Uint8Array));
      rebuild();
      return true;
    };
    apiRef.current.exportStl = () => exportStl(mesh);
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if (c.running || c.drive || c.wheel || c.work)
        throw new Error(
          L('Najprv zastav stroj a potom exportuj obrobok.', 'Stop the machine before exporting the workpiece.'),
        );
      return exportStep(mesh);
    };
    const wi = createWorkInspect({
      scene,
      camera,
      dom,
      insp,
      c,
      getObj: () => mesh,
      getSpot: () => v3(2.6, 6.4, 3.2),
      onState: (v) => {
        push('unclamped', v);
        push('manual', c.manual);
      },
    });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in' && (c.run || running())) {
        say(
          L(
            'Obrobok sa vyberá len pri stojacom stroji.',
            'The workpiece can only be removed with the machine stopped.',
          ),
        );
        return;
      }
      if (wi.phase() === 'in' && inWork(st.tip)) {
        say(
          L(
            'Najprv vytiahni nôž z obrobku – pootoč kolesom kulisy hore alebo spusti stroj a zastav ho v hornej polohe.',
            'Pull the tool out of the work first – stop the ram in its upper position.',
          ),
        );
        return;
      }
      if (!wi.toggle())
        say(L('Počkaj, kým sa dokončí pohyb polotovaru.', 'Wait until the workpiece movement finishes.'), 'info');
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) {
        say(L('Najprv upni polotovar späť.', 'Clamp the workpiece back first.'));
        return false;
      }
      if (c.run || running()) {
        say(
          L(
            'Polotovar sa mení len pri stojacom stroji.',
            'The workpiece can only be changed with the machine stopped.',
          ),
        );
        return false;
      }
      wk.dOut = c.dOut / 100;
      wk.H = c.H / 100;
      wk.dIn = Math.min(c.dIn, c.dOut - 30) / 100;
      // smykadlo do hornej polohy, aby nôž nebol v novom obrobku
      st.phi = topPhi();
      st.tip = tipAt(st.phi);
      st.fwd = true;
      st.eng = null;
      makeWork();
      say(L('V skľučovadle je nový polotovar.', 'A new workpiece is in the chuck.'), 'info');
      return true;
    };
    apiRef.current.setTool = (id) => {
      if (c.run || running()) {
        say(L('Nôž sa mení len pri stojacom stroji.', 'The tool can only be changed with the machine stopped.'));
        return false;
      }
      if (inWork(st.tip) || st.tip < WB) {
        say(
          L(
            'Nôž sa mení v hornej polohe smykadla, mimo obrobku.',
            'The tool is changed with the ram up, out of the work.',
          ),
        );
        return false;
      }
      buildTool(id);
      return true;
    };
    apiRef.current.index = (dir) => {
      if (inWork(st.tip) || st.tip < WB) {
        say(L('Otočný stôl sa delí, keď je nôž nad obrobkom.', 'Index the rotary table with the tool above the work.'));
        return;
      }
      const step = 360 / c.div,
        nv = Math.round((c.cA + dir * step) / step) * step;
      push('cA', nv);
    };

    // ---------- ručné ovládanie ----------
    const needPower = (fn) => () => {
      if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'));
      else fn();
    };
    const stopped = (what) => {
      if (c.run || running()) {
        say(L(`${what} sa nastavuje len pri stojacom stroji.`, `${what} is only set with the machine stopped.`));
        return false;
      }
      return true;
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
          if (!i) push('run', false);
        },
        read: () => (c.power ? 'I' : '0'),
      },
      mainSw,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('ŠTART', 'START'),
        hint: LL('Rozbehne motor – smykadlo sa začne pohybovať.', 'Starts the motor – the ram begins to move.'),
        action: needPower(() => push('run', true)),
      },
      bStart,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('STOP', 'STOP'),
        hint: LL('Zastaví motor.', 'Stops the motor.'),
        action: () => push('run', false),
      },
      bStop,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Núdzový STOP', 'Emergency STOP'),
        hint: LL('Okamžite zastaví stroj a vypne posuv.', 'Stops the machine at once and the feed.'),
        action: () => {
          push('run', false);
          push('autoF', false);
          say(L('Núdzové zastavenie.', 'Emergency stop.'), 'danger');
        },
      },
      eStop,
    );
    ctrl.reg(
      {
        type: 'lever',
        angles: SPEED_ANG,
        minR: 0.25,
        label: LL('Páka prevodovky zdvihov', 'Stroke-speed lever'),
        hint: LL(
          '6 stupňov 12 – 71 zdvihov za minútu, preraďuje sa pri stojacom stroji.',
          '6 steps 12 – 71 strokes per minute, shifted with the machine stopped.',
        ),
        getIdx: () => logNear(SLOTTER_SPEEDS, c.n),
        onSet: (i) => {
          if (stopped(L('Počet zdvihov', 'The stroke rate'))) push('n', SLOTTER_SPEEDS[i]);
        },
        read: () => `${c.n} / min`,
      },
      levN,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.25,
        inc: -1,
        label: LL('Dĺžka zdvihu', 'Stroke length'),
        hint: LL(
          'Štvorhran posúva čap na kolese kulisy. Len pri stojacom stroji.',
          'The square shaft moves the crank pin on the bull gear. Only with the machine stopped.',
        ),
        guard: () => stopped(L('Zdvih', 'The stroke')),
        turn: (d) => push('S', clamp(Math.round(c.S - d * 20), 20, 350)),
        read: () => `${c.S} mm`,
      },
      crS,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.3,
        inc: -1,
        label: LL('Koleso pozdĺžneho posuvu X', 'Longitudinal feed handwheel X'),
        hint: LL(
          '1 otáčka = 5 mm. Stôl k stojanu (−) prehlbuje drážku na strane od stojana.',
          '1 turn = 5 mm. Table towards the column (−) deepens a keyway on the far side.',
        ),
        turn: (d) => push('tx', clamp(Math.round((c.tx - (d * 5) / TAU) * 100) / 100, -200, 200)),
        read: () => `X ${(st.tx * 100).toFixed(2)} mm`,
      },
      wX,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.3,
        inc: -1,
        label: LL('Koleso priečneho posuvu Z', 'Cross feed handwheel Z'),
        hint: LL('1 otáčka = 5 mm.', '1 turn = 5 mm.'),
        turn: (d) => push('tz', clamp(Math.round((c.tz - (d * 5) / TAU) * 100) / 100, -200, 200)),
        read: () => `Z ${(st.tz * 100).toFixed(2)} mm`,
      },
      wZ,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.2,
        inc: -1,
        label: LL('Koliesko otočného stola', 'Rotary table handwheel'),
        hint: LL('1 otáčka = 4°.', '1 turn = 4°.'),
        turn: (d) => push('cA', Math.round((c.cA - (d * 4) / TAU) * 100) / 100),
        read: () => `C ${((st.ca * 180) / Math.PI).toFixed(2)}°`,
      },
      wC,
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
    let raf;
    const stall = (text) => {
      push('run', false);
      st.w = 0;
      st.eng = null;
      say(text, 'danger');
    };
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      t += dt;
      wi.update(dt);
      if (!c.power && c.run) push('run', false);
      const r = rOf(),
        wTarget = c.run && c.power ? (c.n / 60) * TAU : 0;
      st.w = approach(st.w, wTarget, (wTarget > st.w ? 3 : 6) * dt);

      // ručné polohy stola s kontrolou dotyku: nôž v obrobku sa posuvom nezareže, mimo otvoru skľučovadla nenarazí
      const txN = approach(st.tx, clamp(c.tx, -200, 200) / 100, 0.8 * dt),
        tzN = approach(st.tz, clamp(c.tz, -200, 200) / 100, 0.8 * dt),
        caN = approach(st.ca, (c.cA * Math.PI) / 180, 0.6 * dt);
      if (txN !== st.tx || tzN !== st.tz || caN !== st.ca) {
        const p0 = probe(st.tip, st.tx, st.tz, st.ca);
        const okAt = (x, z, a) => {
          const p = probe(st.tip, x, z, a);
          if (p.chuck && !p0.chuck) return 'chuck';
          return p.area <= p0.area + 0.05 ? null : 'mat';
        };
        const why = okAt(txN, tzN, caN);
        if (!why) {
          st.tx = txN;
          st.tz = tzN;
          st.ca = caN;
        } else {
          if (!okAt(txN, st.tz, st.ca)) st.tx = txN;
          else if (!okAt(st.tx, tzN, st.ca)) st.tz = tzN;
          else if (!okAt(st.tx, st.tz, caN)) st.ca = caN;
          if (why === 'mat')
            sayOnce(
              'matStill',
              true,
              L(
                'Nôž je v obrobku – posuvom stola sa do materiálu nezareže. Režie len zdvihom smykadla: posuv sa robí, keď je nôž hore.',
                'The tool is inside the work – moving the table cannot cut into the material. Only the ram stroke cuts: feed while the tool is up.',
              ),
              'warn',
            );
          if (why === 'chuck')
            sayOnce(
              'chuckStill',
              true,
              L(
                'Nôž by narazil do skľučovadla – pod obrobkom je voľný len otvor v strede.',
                'The tool would hit the chuck – only the central hole below the work is free.',
              ),
              'danger',
            );
        }
        if (!why) {
          flags.matStill = false;
          flags.chuckStill = false;
        }
        wX.rotation.z = ((-st.tx * 100) / 5) * TAU;
        wZ.rotation.z = ((st.tz * 100) / 5) * TAU;
        wC.rotation.z = ((-st.ca * 180) / Math.PI / 4) * TAU;
      }

      // kulisa a smykadlo; pracovný zdvih = dole
      const prevTip = st.tip;
      st.phi += st.w * dt;
      const fwd = isForward(st.phi, r, SL_K);
      if (fwd && !st.fwd && running()) {
        // horná úvrať: kontrola polohy zdvihu a západkový posuv o krok
        st.cuts++;
        const top = tipMid() + c.S / 200,
          bot = tipMid() - c.S / 200;
        sayOnce(
          'noClear',
          top < wTop() + 0.005,
          L(
            'Nôž pri spätnom zdvihu nevyjde nad obrobok – posuň polohu zdvihu hore alebo ho predĺž.',
            'The tool does not clear the top of the work on the return – move the stroke up or lengthen it.',
          ),
          'warn',
        );
        sayOnce(
          'short',
          bot > WB - 0.005,
          L(
            'Nôž neprejde celou výškou obrobku – drážka by nebola priebežná. Posuň polohu zdvihu dole alebo ho predĺž.',
            'The tool does not pass the full height of the work – the slot would not go through. Move the stroke down or lengthen it.',
          ),
          'warn',
        );
        if (c.autoF) {
          if (c.fAx === 'c') {
            const nv = Math.round((c.cA + c.fdir * c.feed) * 100) / 100;
            c.cA = nv;
            pend.cA = nv;
          } else {
            const k = c.fAx === 'x' ? 'tx' : 'tz',
              nv = clamp(Math.round((c[k] + c.fdir * c.feed) * 100) / 100, -200, 200);
            if (nv === c[k]) {
              push('autoF', false);
              say(
                L(
                  'Stôl je na konci posuvu – posuv sa vypol.',
                  'The table reached the end of travel – the feed switched off.',
                ),
                'info',
              );
            } else {
              c[k] = nv;
              pend[k] = nv;
            }
          }
        }
      }
      st.fwd = fwd;
      st.tip = tipAt(st.phi);
      const th = ramPos(st.phi, r, SL_K).th;

      // rez: pri vstupe zhora sa skontroluje prierez triesky, pri výbehu pod obrobok sa zapíše
      if (running() && !c.unclamped) {
        const R = rect(st.tx, st.tz);
        if (fwd && st.tip < prevTip) {
          if (prevTip >= wTop() && st.tip < wTop()) {
            const q = ringCut(g, st.ca, ...R),
              T = tool();
            if (q.embedded && q.area > T.A)
              stall(
                L(
                  'Nôž narazil do plného materiálu! Stroj zastavený – nôž sa zarezáva len z otvoru alebo zvonka obrobku.',
                  'The tool hit solid material! Machine stopped – the tool can only cut from the bore or from the outside.',
                ),
              );
            else if (q.area > T.A + 0.01)
              stall(
                L(
                  `Príliš veľký prierez triesky (${q.area.toFixed(1).replace('.', ',')} mm²) – ${toolName(c.tool).toLowerCase()} zvládne najviac ${String(T.A).replace('.', ',')} mm² na zdvih. Stroj zastavený, zmenši posuv alebo odsuň stôl.`,
                  `Chip section too large (${q.area.toFixed(1)} mm²) – the ${toolName(c.tool).toLowerCase()} takes at most ${T.A} mm² per stroke. Machine stopped, reduce the feed or move the table back.`,
                ),
              );
            else st.eng = q.area > 0 ? { area: q.area } : null;
            st.area = q.area;
          }
          if (running() && hitChuck(st.tip, R))
            stall(
              L(
                'Nôž narazil do skľučovadla! Pod obrobkom je voľný len otvor Ø60 v strede – posuň stôl alebo skráť zdvih.',
                'The tool hit the chuck! Below the work only the Ø60 central hole is free – move the table or shorten the stroke.',
              ),
            );
          if (st.eng && prevTip >= WB && st.tip < WB) {
            ringCut(g, st.ca, ...R, true);
            rebuild();
            st.eng = null;
          }
          if (st.eng && st.tip < wTop() && st.tip > WB) {
            st.cutT = t;
            chipAcc += dt * 30;
            while (chipAcc >= 1) {
              chipAcc -= 1;
              chips.spawn(
                v3(TIPX + 0.02, st.tip, ((Math.random() - 0.5) * tool().w) / 100),
                v3(0.3 + Math.random() * 0.6, -0.2 - Math.random() * 0.6, (Math.random() - 0.5) * 0.6),
                4 + Math.random() * 3,
              );
            }
          }
        }
      }
      const cutting = t - st.cutT < 0.3;

      // pohyb skupín
      ram.position.y = st.tip;
      sad.position.x = st.tx;
      crs.position.z = st.tz;
      turn.rotation.y = -st.ca;
      bull.rotation.z = -st.phi;
      pinion.rotation.z = st.phi * 3;
      pin.position.set(r, 0, 0.27);
      lnk.rotation.z = -th;
      stone.position.set(GX + Math.cos(st.phi) * r, GY - Math.sin(st.phi) * r, 0.78);
      stone.rotation.z = -th;
      endBlock.position.set(0, GY - SL_K.Lk * Math.tan(th), 0.55);
      cover.visible = c.cover;
      lampRun.emissive.setHex(running() ? 0x22dd55 : 0);
      chips.update(dt, (q) =>
        Math.hypot(q.x - st.tx, q.z - st.tz) < 0.9
          ? WB - 0.2
          : Math.abs(q.x - st.tx) < 1.8 && Math.abs(q.z - st.tz) < 1.6
            ? 3.9
            : 1.1,
      );
      lamp.update(c.light);

      crS.rotation.z = -c.S / 20;
      ctrl.update(dt);
      insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        setTele({
          tip: (st.tip - WB) * 100,
          tx: st.tx * 100,
          tz: st.tz * 100,
          ca: (st.ca * 180) / Math.PI,
          cutting,
          fwd,
          running: running(),
          area: st.area,
          msg: st.msg && st.msg.until > t ? st.msg : null,
        });
        if (Object.keys(pend).length) {
          const p = { ...pend };
          Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
      }
      snd.update({
        motor: (st.w / ((71 / 60) * TAU)) * 0.8 + (st.w > 0.05 ? 0.2 : 0),
        cut: cutting && running() ? 0.8 : 0,
      });
      renderer.render(scene, camera);
    };
    // úvodná poloha: smykadlo hore
    st.phi = topPhi();
    st.tip = tipAt(st.phi);
    st.fwd = true;
    try {
      if (/[?&]debug/.test(window.location.search)) window.__slotter = { st, c, g: () => g, wk, rect, probe };
    } catch (err) {
      /* ignorované */
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      snd.dispose();
      ctrl.dispose();
      insp.dispose();
      wi.dispose();
      try {
        if (window.__slotter && window.__slotter.st === st) delete window.__slotter;
      } catch (err) {
        /* ignorované */
      }
      disposeStage();
    };
  }, []);

  const parts = slotterParts();
  const m = apiRef.current.measure ? apiRef.current.measure() : null,
    info = m ? m.info : null;
  const r = crankR(ui.S / 100, SL_K),
    v = cutSpeed(ui.S, ui.n, r, SL_K);
  const fmt = (x, d = 1) => L(x.toFixed(d).replace('.', ','), x.toFixed(d));
  const busy = ui.run || tele.running;
  const setupTask = (task) => {
    if (busy) return;
    Object.entries(task.setup).forEach(([k, val]) => {
      if (k === 'tool') {
        if (apiRef.current.setTool && apiRef.current.setTool(val)) set('tool', val);
      } else set(k, val);
    });
    if (apiRef.current.newBlank) apiRef.current.newBlank();
  };
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped
      ? { kind: 'info', text: L('Obrobok je vybratý zo skľučovadla.', 'The workpiece is out of the chuck.') }
      : tele.cutting && tele.running
        ? {
            kind: 'run',
            text: `${L('Obrážanie', 'Slotting')} – ${ui.n} ${L('zdvihov/min', 'strokes/min')}, v ≈ ${fmt(v)} m/min, ${L('prierez triesky', 'chip section')} ${fmt(tele.area)} mm²`,
          }
        : !ui.power
          ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
          : tele.running
            ? {
                kind: 'run',
                text: L(
                  'Smykadlo beží. Prisúvaj stôl k nožu po malých krokoch – automatickým posuvom alebo kolesom, keď je nôž hore.',
                  'The ram is running. Feed the table to the tool in small steps – automatically or by the handwheel while the tool is up.',
                ),
              }
            : {
                kind: 'idle',
                text: L(
                  'Stroj stojí. Nastav zdvih a jeho polohu voči obrobku, potom spusti stroj.',
                  'The machine is stopped. Set the stroke length and its position against the work, then start the machine.',
                ),
              };
  const chips = [
    {
      color: tele.running ? '#3ee06c' : '#8b8f89',
      text: tele.running ? `${ui.n} ${L('zdvihov/min', 'strokes/min')}` : L('Stojí', 'Stopped'),
    },
  ];
  if (tele.running)
    chips.push({
      color: tele.fwd ? '#ffb340' : '#7fb6ff',
      text: tele.fwd ? L('Pracovný zdvih ↓', 'Cutting stroke ↓') : L('Spätný zdvih ↑', 'Return stroke ↑'),
    });
  if (ui.autoF)
    chips.push({
      color: '#7fb6ff',
      text: `${L('Posuv', 'Feed')} ${ui.fAx.toUpperCase()} ${ui.fdir > 0 ? '+' : '−'}${fmt(ui.feed, 2)} ${ui.fAx === 'c' ? '°' : 'mm'}`,
    });
  const k = info && info.key && info.key.n ? info.key : null,
    sq = info ? info.sq : null;

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
        tips={[
          L(
            'Posuv stola sa robí v hornej úvrati – keď je nôž nad obrobkom. S nožom v obrobku sa stôl do materiálu nepohne.',
            'The table is fed at the top of the stroke – with the tool above the work. With the tool in the work the table will not move into the material.',
          ),
          L(
            'Zdvih nastav tak, aby nôž vyšiel nad obrobok a dole vybehol do otvoru skľučovadla.',
            'Set the stroke so that the tool clears the top of the work and overruns into the chuck hole.',
          ),
          L(
            'Ďalšiu stenu štvorhranu dostaneš pootočením otočného stola o 90° (delenie z = 4).',
            'The next wall of a square is reached by indexing the rotary table by 90° (z = 4).',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · zvislá obrážačka', 'Simulator · slotting machine')}
            title={L('Zvislá obrážačka', 'Slotting machine')}
            sub={L(
              'Predloha: TOS ST 350 – drážkovačka so zvislým smykadlom, kulisovým pohonom a krížovým otočným stolom. Obrába drážky pre perá a tvarové otvory v nábojoch.',
              'Modelled after a TOS ST 350 slotter – vertical ram, slotted-link drive and a compound rotary table. It cuts keyways and shaped holes in hubs.',
            )}
            rows={[
              [L('Zdvih mm', 'Stroke mm'), String(ui.S)],
              ['X mm', tele.tx.toFixed(2)],
              ['Z mm', tele.tz.toFixed(2)],
              ['C °', tele.ca.toFixed(2)],
            ]}
            foot={[`${ui.n} ${L('zdvihov/min', 'strokes/min')} · v ≈ ${fmt(v)} m/min`, toolName(ui.tool)]}
            status={statusMsg}
          />

          <TaskSection
            machine="zobrazacka"
            tasks={SLOTTER_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'run', items: SLOTTER_SAFETY() }}
          />

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
              <SectionInfo title={L('Hlavný chod', 'Main drive')}>
                <p className="text-xs muted" style={{ color: v > 20 ? 'var(--warn)' : undefined }}>
                  {L(
                    `Priemerná rezná rýchlosť pri zdvihu dole ${fmt(v)} m/min (oceľ nožom HSS: 8 – 15 m/min). Pracovný zdvih trvá ${Math.round(fwdShare(r, SL_K) * 360)}° otáčky kolesa.`,
                    `Mean cutting speed on the down stroke ${fmt(v)} m/min (steel with HSS: 8 – 15 m/min). The cutting stroke takes ${Math.round(fwdShare(r, SL_K) * 360)}° of the wheel turn.`,
                  )}
                  {busy
                    ? ` ${L('Prevodovka sa preraďuje len pri stojacom stroji.', 'The gearbox is shifted only with the machine stopped.')}`
                    : ''}
                </p>
              </SectionInfo>
            </div>
            <button
              type="button"
              className={`btn-run ${ui.run ? 'stop' : 'start'}`}
              onClick={() => {
                if (!ui.run && !ui.power) set('power', true);
                set('run', !ui.run);
              }}
            >
              {ui.run ? L('■ Stop', '■ Stop') : L('▶ Štart', '▶ Start')}
            </button>
            <div className="mt-2">
              <Toggle
                on={ui.power}
                label={L('Hlavný vypínač', 'Main switch')}
                onClick={() => {
                  const val = !ui.power;
                  set('power', val);
                  if (!val) set('run', false);
                }}
              />
              <Toggle
                on={!ui.cover}
                label={L('Odkrytá hlava – vidno kulisu', 'Head open – link visible')}
                onClick={() => set('cover', !ui.cover)}
              />
              <Toggle
                on={ui.light}
                label={L('Pracovné osvetlenie', 'Work light')}
                onClick={() => set('light', !ui.light)}
              />
            </div>
            <SegRow
              label={L('Zdvihy/min', 'Strokes/min')}
              value={ui.n}
              options={SLOTTER_SPEEDS.map((n) => [n, String(n)])}
              onChange={(n) => {
                if (!busy) set('n', n);
              }}
            />
            <p className="text-xs muted" style={{ color: v > 20 ? 'var(--warn)' : undefined }}>
              {L('Rezná rýchlosť', 'Cutting speed')}: {fmt(v)} m/min
              {busy ? ` · ${L('Prevodovka uzamknutá', 'Gearbox locked')}` : ''}
            </p>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Zdvih smykadla', 'Ram stroke')}</h2>
              <SectionInfo title={L('Zdvih smykadla', 'Ram stroke')}>
                <p className="text-xs muted">
                  {L(
                    `Náboj je vysoký ${ui.H} mm – zdvih nastav o 30 – 50 mm dlhší, aby nôž vyšiel nad obrobok a dole vybehol do otvoru skľučovadla. Ostrie je teraz ${fmt(tele.tip)} mm nad spodkom obrobku.`,
                    `The hub is ${ui.H} mm high – set the stroke 30 – 50 mm longer so that the tool clears the top and overruns into the chuck hole. The tool edge is now ${fmt(tele.tip)} mm above the bottom of the work.`,
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="sls"
              label={L('Dĺžka zdvihu', 'Stroke length')}
              unit="mm"
              min={20}
              max={350}
              step={5}
              value={ui.S}
              onChange={(val) => set('S', val)}
              disabled={busy}
            />
            <Slider
              id="slp"
              label={L('Poloha zdvihu (stred voči stredu obrobku)', 'Stroke position (centre to work centre)')}
              unit="mm"
              min={-100}
              max={100}
              step={5}
              value={ui.pos}
              onChange={(val) => set('pos', val)}
              disabled={busy}
            />
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nôž a stôl', 'Tool and table')}</h2>
              <SectionInfo title={L('Nôž a stôl', 'Tool and table')}>
                <p className="text-xs muted">
                  {L(
                    'Posuv sa urobí v hornej úvrati pred každým pracovným zdvihom. Prierez triesky = šírka záberu × posuv; pri prekročení sa nôž zastaví. Pri stojacom smykadle s nožom v obrobku stôl do materiálu nevojde.',
                    'The feed happens at the top before every cutting stroke. Chip section = engaged width × feed; above the limit the tool stalls. With the ram stopped and the tool in the work the table will not move into the material.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {TOOL_LIST.map(([id, sk, en]) => (
                <button
                  key={id}
                  type="button"
                  className={`tool-slot ${ui.tool === id ? 'on' : ''}`}
                  aria-pressed={ui.tool === id}
                  disabled={busy}
                  onClick={() => {
                    if (apiRef.current.setTool && apiRef.current.setTool(id)) set('tool', id);
                  }}
                >
                  <b>{L(sk, en)}</b>
                  {L(`trieska do ${SLOTTER_TOOLS[id].A} mm²`, `chip up to ${SLOTTER_TOOLS[id].A} mm²`)}
                </button>
              ))}
            </div>
            <Slider
              id="slx"
              label={L('Stôl pozdĺžne X (− k stojanu)', 'Table X (− to column)')}
              unit="mm"
              min={-200}
              max={200}
              step={0.05}
              value={ui.tx}
              actual={tele.tx}
              digits={2}
              onChange={(val) => set('tx', val)}
            />
            <div className="flex flex-wrap gap-2 mb-3">
              {[-1, -0.5, -0.1, 0.1, 0.5, 1].map((x) => (
                <button
                  key={x}
                  type="button"
                  className="btn"
                  onClick={() => set('tx', clamp(Math.round((ui.tx + x) * 100) / 100, -200, 200))}
                >
                  X {x > 0 ? '+' : ''}
                  {fmt(x, x % 1 ? 1 : 0)}
                </button>
              ))}
            </div>
            <Slider
              id="slz"
              label={L('Stôl priečne Z', 'Table cross Z')}
              unit="mm"
              min={-200}
              max={200}
              step={0.05}
              value={ui.tz}
              actual={tele.tz}
              digits={2}
              onChange={(val) => set('tz', val)}
            />
            <Toggle
              on={ui.autoF}
              label={L('Západkový posuv na zdvih', 'Ratchet feed per stroke')}
              onClick={() => set('autoF', !ui.autoF)}
            />
            <SegRow
              label={L('Os', 'Axis')}
              value={ui.fAx}
              options={[
                ['x', 'X'],
                ['z', 'Z'],
                ['c', 'C'],
              ]}
              onChange={(val) => set('fAx', val)}
            />
            <SegRow
              label={L('Smer', 'Direction')}
              value={ui.fdir}
              options={[
                [-1, '−'],
                [1, '+'],
              ]}
              onChange={(val) => set('fdir', val)}
            />
            <Slider
              id="slf"
              label={
                ui.fAx === 'c' ? L('Posuv na zdvih (°)', 'Feed per stroke (°)') : L('Posuv na zdvih', 'Feed per stroke')
              }
              unit={ui.fAx === 'c' ? '°' : 'mm'}
              min={0.05}
              max={3}
              step={0.05}
              value={ui.feed}
              digits={2}
              onChange={(val) => set('feed', val)}
            />
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Otočný stôl', 'Rotary table')}</h2>
              <SectionInfo title={L('Otočný stôl', 'Rotary table')}>
                <p className="text-xs muted">
                  {L(
                    'Delí sa, keď je nôž nad obrobkom (smykadlo v hornej polohe).',
                    'Index with the tool above the work (ram up).',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="slc"
              label={L('Natočenie C', 'Angle C')}
              unit="°"
              min={-360}
              max={360}
              step={0.5}
              value={ui.cA}
              actual={tele.ca}
              digits={2}
              onChange={(val) => set('cA', val)}
            />
            <SegRow
              label={L('Delenie z', 'Division z')}
              value={ui.div}
              options={DIVS.map((z) => [z, String(z)])}
              onChange={(val) => set('div', val)}
            />
            <div className="flex flex-wrap gap-2 mb-2">
              <button type="button" className="btn" onClick={() => apiRef.current.index && apiRef.current.index(-1)}>
                ◀ −{fmt(360 / ui.div, 0)}°
              </button>
              <button type="button" className="btn" onClick={() => apiRef.current.index && apiRef.current.index(1)}>
                +{fmt(360 / ui.div, 0)}° ▶
              </button>
            </div>
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Meranie', 'Measurement')}</h2>
            {info ? (
              <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
                <div>
                  {L('Otvor', 'Bore')}: <b>Ø{fmt(info.dMin, 2)}</b>
                  {info.dMax - info.dMin > 0.05 ? (
                    <>
                      {' '}
                      {L('až', 'to')} <b>{fmt(info.dMax, 2)} mm</b>
                    </>
                  ) : (
                    ' mm'
                  )}
                </div>
                {k && (
                  <div>
                    {L('Drážka', 'Keyway')}:{' '}
                    <b>
                      {fmt(k.width, 2)} × {fmt(k.depth, 2)} mm
                    </b>
                    {k.runs > 1 ? ` (${k.runs} ${L('úseky', 'sections')})` : ''}
                  </div>
                )}
                {ui.tool === 'plochy' && sq && (
                  <div>
                    {L('Štvorec 25 × 25', 'Square 25 × 25')}: {L('odchýlka stien', 'wall error')}{' '}
                    <b>{fmt(sq.err, 2)} mm</b>, {L('roh', 'corner')} <b>{fmt(sq.corner, 1)} mm</b>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <BlankSection
            onApply={() => {
              if (apiRef.current.newBlank) apiRef.current.newBlank();
            }}
            applyLabel={L('Upnúť nový polotovar', 'Clamp a new workpiece')}
            note={L(
              'Oceľový náboj s predvŕtaným otvorom, upnutý za vonkajší priemer v trojčeľusťovom skľučovadle.',
              'Steel hub with a pre-bored hole, gripped on its outside in the three-jaw chuck.',
            )}
          >
            <Slider
              id="sbo"
              label={L('Vonkajší priemer', 'Outside diameter')}
              unit="mm"
              min={70}
              max={160}
              step={5}
              value={ui.dOut}
              onChange={(val) => set('dOut', val)}
            />
            <Slider
              id="sbi"
              label={L('Otvor', 'Bore')}
              unit="mm"
              min={16}
              max={60}
              step={1}
              value={ui.dIn}
              onChange={(val) => set('dIn', val)}
            />
            <Slider
              id="sbh"
              label={L('Výška', 'Height')}
              unit="mm"
              min={20}
              max={100}
              step={5}
              value={ui.H}
              onChange={(val) => set('H', val)}
            />
          </BlankSection>

          <ExportSection machine="zobrazacka" apiRef={apiRef} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['noz', L('Detail noža', 'Tool detail')],
              ['zhora', L('Otvor zhora', 'Bore from above')],
              ['kulisa', L('Kulisa', 'Slotted link')],
              ['panel', L('Rozvádzač', 'Control box')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

export { SlotterSimulator };
export default SlotterSimulator;
