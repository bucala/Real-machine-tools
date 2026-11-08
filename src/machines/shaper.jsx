import { SectionInfo } from '../ui/sectionInfo';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { createHeightField } from '../core/heightField';
import { L, LL } from '../core/i18n';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp, fanAngles, logNear } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { exportStl } from '../core/export';
import { grooveInfo, hfInfo } from '../core/hfMath';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection, fromB64, toB64 } from '../ui/tools';
import { ShaperDrawing } from '../ui/sketch';
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
import {
  SHAPER_SPEEDS,
  SHAPER_TOOLS,
  SH_K,
  crankR,
  cutSpeed,
  isForward,
  ramPos,
  shaperChecks,
  toolLift,
} from './shaperMath';

// =====================================================================
// OBRÁŽAČKA TOS – kulisová (priečna) obrážačka so zdvihom do 500 mm
// =====================================================================
// mierka 1 = 100 mm; smykadlo ide v osi X (dopredu = +X k stolu), stôl sa posúva priečne v osi Z
const SH = {
  CX: -4.6,
  PY: 2.0, // os kulisy (otočný bod) a stred veľkého kolesa je SH_K.d nad ním
  TT: 5.4,
  VX: 1.4, // výška stola, stred zveráka v osi X
  TIP_DX: 0.4,
  TIP_Y0: 6.95, // špička noža voči čelu smykadla pri nulovom prísuve
  JAW: 0.85, // horná hrana čeľustí nad stolom
  P0: 5.6, // čelo smykadla voči osi kulisy, keď je stred zdvihu špičky nad stredom zveráka
};
const SH_SPEED_ANG = fanAngles(6, 1.15);
const TOOL_LIST = [
  ['ubr', 'Ubierací nôž', 'Roughing tool'],
  ['hlad', 'Hladiaci nôž 8 mm', 'Finishing tool 8 mm'],
  ['drazk6', 'Drážkovací nôž 6 mm', 'Slotting tool 6 mm'],
  ['drazk10', 'Drážkovací nôž 10 mm', 'Slotting tool 10 mm'],
];
const toolName = (id) => {
  const t = TOOL_LIST.find(([k]) => k === id);
  return t ? L(t[1], t[2]) : id;
};

const shaperParts = () =>
  mkParts([
    [
      'podstavec',
      'Podstavec',
      'Base',
      'Podstavec',
      'Base',
      'Liatinový podstavec nesie stojan a opierku stola. Na zadnej strane je motor s remeňovým prevodom na prevodovku.',
      'The cast-iron base carries the column and the table support. The motor at the back drives the gearbox by belts.',
    ],
    [
      'stojan',
      'Stojan',
      'Column',
      'Skriňový stojan',
      'Box column',
      'V stojane je prevodovka so šiestimi stupňami zdvihov a kulisový mechanizmus. Hore sú vedenia smykadla, vpredu vedenie priečnika. Bočný kryt je odkrytý, aby bolo vidno kulisu.',
      'The column houses the six-speed gearbox and the slotted-link drive. The ram ways are on top, the cross-rail guide at the front. The side cover is open so that the link can be seen.',
    ],
    [
      'kulisa',
      'Kulisa',
      'Slotted link',
      'Kulisový mechanizmus',
      'Slotted-link mechanism',
      'Veľké ozubené koleso má čap v radiálnej drážke. Čap posúva kameň v kulise, ktorá sa kýve okolo spodného čapu a hore ťahá smykadlo. Vzdialenosť čapu od stredu určuje dĺžku zdvihu. Pracovný zdvih trvá asi 230° otáčky kolesa, spätný len 130° – spätný chod je rýchlejší.',
      'The bull gear carries a crank pin in a radial slot. The pin drives a block in the slotted link, which swings about its lower pivot and moves the ram at the top. The pin radius sets the stroke length. The cutting stroke takes about 230° of a turn, the return only 130° – a quick return.',
    ],
    [
      'smykadlo',
      'Smykadlo',
      'Ram',
      'Smykadlo',
      'Ram',
      'Smykadlo sa pohybuje tam a späť po vedeniach stojana. Poloha zdvihu sa nastavuje posunutím smykadla voči kulise pri stojacom stroji.',
      'The ram moves back and forth on the column ways. The stroke position is set by shifting the ram against the link with the machine stopped.',
    ],
    [
      'hlava',
      'Nožová hlava',
      'Tool head',
      'Nožová hlava so sklopnou doskou',
      'Tool head with clapper box',
      'Na čele smykadla je suport noža s kolieskom zvislého prísuvu (1 otáčka = 4 mm). Nôž je upnutý v sklopnej doske: pri spätnom zdvihu sa nadvihne a kĺže po obrobku bez rezania.',
      'The ram front carries the tool slide with the down-feed handwheel (1 turn = 4 mm). The tool is clamped in the clapper box: on the return stroke it lifts and slides over the work without cutting.',
    ],
    [
      'stol',
      'Stôl',
      'Table',
      'Stôl s priečnikom',
      'Table and cross rail',
      'Stôl s T-drážkami sa posúva po priečniku (os Z) kľukou alebo automaticky západkou o krok na začiatku každého pracovného zdvihu. Opierka zospodu ho podopiera.',
      'The T-slotted table moves along the cross rail (Z axis) by the crank or automatically by a ratchet step at the start of each cutting stroke. A support props it from below.',
    ],
    [
      'zverak',
      'Zverák',
      'Vise',
      'Strojný zverák',
      'Machine vise',
      'Obrobok leží na rovnobežných podložkách tak, aby vyčnieval nad čeľuste. Nôž nesmie zasiahnuť čeľuste.',
      'The workpiece sits on parallels so that it stands above the jaws. The tool must not hit the jaws.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Obrobok',
      'Workpiece',
      'Oceľový hranol. Nôž odoberá materiál len pri pracovnom zdvihu; obrobená plocha je svetlá.',
      'Steel block. The tool cuts only on the cutting stroke; the machined surface is bright.',
    ],
    [
      'rozvadzac',
      'Rozvádzač',
      'Control box',
      'Elektrický rozvádzač',
      'Electrical box',
      'Hlavný vypínač, tlačidlá Štart a Stop a núdzový STOP. Nad ním je páka prevodovky zdvihov.',
      'Main switch, Start and Stop buttons and the emergency stop. The stroke-speed gearbox lever is above it.',
    ],
  ]);

// priečny rez obrobku so zadaným tvarom (mm)
const SHAPER_TASKS = [
  {
    id: 'rovina',
    title: () => L('Obrobenie roviny o 2 mm', 'Shaping a flat face by 2 mm'),
    desc: () =>
      L(
        'Hranol 160 × 80 × 50 mm. Ubieracím nožom zníž celú hornú plochu o 2 ±0,1 mm. Zdvih nastav o 20 – 30 mm dlhší ako obrobok, nôž sa dotkne plochy, potom prisuň o 2 mm a zapni posuv stola 0,5 – 1 mm na zdvih. Pri väčšom posuve zostanú ryhy hlbšie ako tolerancia.',
        'Block 160 × 80 × 50 mm. With the roughing tool lower the whole top face by 2 ±0.1 mm. Set the stroke 20 – 30 mm longer than the work, touch the face, feed the tool down 2 mm and switch on the table feed of 0.5 – 1 mm per stroke. A larger feed leaves ridges deeper than the tolerance.',
      ),
    setup: { bL: 160, bW: 80, bH: 50, tool: 'ubr', S: 190, pos: 0 },
    drawing: () => <ShaperDrawing kind="rovina" />,
    labels: {
      share: () => L('Plocha znížená o 2 ±0,1 mm (≥ 95 %)', 'Face lowered by 2 ±0.1 mm (≥ 95 %)'),
      max: () => L('Nikde hlbšie ako 2,1 mm', 'Nowhere deeper than 2.1 mm'),
    },
  },
  {
    id: 'drazka',
    title: () => L('Drážka pre pero 10 × 5 mm', 'Keyway slot 10 × 5 mm'),
    desc: () =>
      L(
        'Hranol 160 × 80 × 50 mm. Drážkovacím nožom 10 mm vyobrážaj v strede šírky drážku hĺbky 5 ±0,15 mm cez celú dĺžku. Posuv stola je vypnutý, nôž prisúvaj kolieskom hlavy po 0,5 – 1 mm na zdvih (viac ako 1,5 mm naraz nôž nezvládne).',
        'Block 160 × 80 × 50 mm. With the 10 mm slotting tool shape a slot 5 ±0.15 mm deep along the whole length, centred in the width. Keep the table feed off and feed the tool down with the head handwheel by 0.5 – 1 mm per stroke (more than 1.5 mm at once stalls the tool).',
      ),
    setup: { bL: 160, bW: 80, bH: 50, tool: 'drazk10', S: 190, pos: 0, tz: 0 },
    drawing: () => <ShaperDrawing kind="drazka" />,
    labels: {
      depth: () => L('Hĺbka drážky 5 ±0,15 mm', 'Slot depth 5 ±0.15 mm'),
      width: () => L('Šírka drážky 10 mm', 'Slot width 10 mm'),
      len: () => L('Drážka cez celú dĺžku (≥ 95 %)', 'Slot along the whole length (≥ 95 %)'),
      center: () => L('Drážka v strede šírky', 'Slot centred in the width'),
    },
  },
  {
    id: 'osadenie',
    title: () => L('Osadenie 30 × 10 mm', 'Shoulder 30 × 10 mm'),
    desc: () =>
      L(
        'Hranol 160 × 80 × 50 mm. Pozdĺž jednej hrany vyobrážaj osadenie šírky 30 mm a hĺbky 10 ±0,2 mm; zvyšok plochy nechaj neporušený. Ber po 2 – 4 mm s posuvom stola, posledný prechod jemne.',
        'Block 160 × 80 × 50 mm. Along one edge shape a shoulder 30 mm wide and 10 ±0.2 mm deep; leave the rest of the face untouched. Take 2 – 4 mm per pass with the table feed, finish with a light pass.',
      ),
    setup: { bL: 160, bW: 80, bH: 50, tool: 'ubr', S: 190, pos: 0 },
    drawing: () => <ShaperDrawing kind="osadenie" />,
    labels: {
      step: () => L('Osadenie 30 mm hlboké 10 ±0,2 mm (≥ 90 %)', '30 mm shoulder 10 ±0.2 mm deep (≥ 90 %)'),
      rest: () => L('Zvyšok plochy neporušený (≥ 95 %)', 'Rest of the face untouched (≥ 95 %)'),
    },
  },
].map((t) => ({ ...t, checks: (m) => shaperChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const SHAPER_SAFETY = () => [
  L(
    'Nôž je upnutý v sklopnej doske s čo najkratším vyložením.',
    'The tool is clamped in the clapper box with the shortest overhang.',
  ),
  L(
    'Obrobok je pevne vo zveráku, kľúč od zveráka je odložený.',
    'The workpiece is firm in the vise, the vise handle is put away.',
  ),
  L(
    'Zdvih a jeho poloha sú nastavené pri stojacom stroji – nôž nenarazí na zverák.',
    'Stroke length and position were set with the machine stopped – the tool will not hit the vise.',
  ),
  L(
    'Mám okuliare a nestojím pred smykadlom v smere zdvihu.',
    'I wear glasses and do not stand in front of the ram in the stroke direction.',
  ),
];

function ShaperSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    run: false,
    manual: false,
    cover: false,
    light: true,
    n: 20,
    S: 190,
    pos: 0,
    d: 50,
    tz: 0,
    autoF: false,
    fdir: 1,
    feed: 0.8,
    tool: 'ubr',
    bL: 160,
    bW: 80,
    bH: 50,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    ram: 0,
    phi: 0,
    v: 0,
    d: 0,
    tz: 0,
    msg: null,
    cutting: false,
    fwd: true,
    running: false,
  });

  useEffect(() => {
    const mount = mountRef.current,
      layer = layerRef.current,
      tipEl = tipRef.current;
    const c = ctl.current;
    const { CX, PY, TT, VX, TIP_DX, TIP_Y0, JAW, P0 } = SH,
      CY = PY + SH_K.d;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('shaper');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x7f9f86, 0x678a70, 0x4c6a55),
      work: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.32,
        metalness: 0.75,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
      chip: std(0x6b5a48, 0.45, 0.6),
      inner: std(0x2b2f2c, 0.8, 0.1),
      gear: std(0x5d6468, 0.45, 0.7),
      hss: std(0xd9dde0, 0.25, 0.9),
      lampShade: std(0x678a70, 0.5, 0.2),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, pivotLever, detents, handwheel, crank } = kit;
    const root = new THREE.Group();
    scene.add(root);
    apiRef.current.machineModel = { root, name: 'Vodorovná obrážačka' };
    const G = {};
    const grp = (k, parent = root) => {
      const g = new THREE.Group();
      g.userData.part = k;
      parent.add(g);
      G[k] = g;
      return g;
    };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- podstavec s motorom ----------
    const base = grp('podstavec');
    box(base, -7.4, 3.6, 0, 0.5, -2.0, 2.0, M.greenDark);
    box(base, -8.2, -7.0, 0.5, 2.4, -1.0, 1.0, M.greenDeep); // motor
    cylX(base, 0.42, 0.42, -8.3, -8.2, 1.45, 0, M.black, 24);
    // ---------- stojan: bok na strane obsluhy má okno ku kulise ----------
    const col = grp('stojan');
    box(col, -7.0, -6.8, 0.5, 8.4, -1.5, 1.5, M.green);
    box(col, -0.8, -0.6, 0.5, 8.4, -1.5, 1.5, M.green);
    box(col, -7.0, -0.6, 8.2, 8.4, -1.5, 1.5, M.green);
    box(col, -7.0, -0.6, 0.5, 8.4, -1.5, -1.3, M.green);
    box(col, -6.8, -0.8, 0.6, 8.2, -1.3, -1.25, M.inner); // tmavá vnútorná stena
    box(col, -6.8, -6.2, 0.5, 8.2, 1.3, 1.5, M.green);
    box(col, -3.0, -0.8, 0.5, 8.2, 1.3, 1.5, M.green);
    box(col, -6.2, -3.0, 0.5, 1.2, 1.3, 1.5, M.green);
    box(col, -6.2, -3.0, 7.8, 8.2, 1.3, 1.5, M.green);
    const cover = box(col, -6.2, -3.0, 1.2, 7.8, 1.42, 1.5, M.green); // bočný kryt kulisy
    box(col, -7.0, -0.6, 8.4, 8.46, -1.1, -0.8, M.ways);
    box(col, -7.0, -0.6, 8.4, 8.46, 0.8, 1.1, M.ways); // vedenia smykadla
    // priečnik (pevný) so skrutkou priečneho posuvu
    box(col, -0.6, -0.2, 4.05, 5.15, -3.0, 3.0, M.greenDark);
    cylZ(col, 0.06, 0.06, -3.0, 3.1, -0.4, 4.25, M.steel, 10);
    // ---------- kulisový mechanizmus ----------
    const kul = grp('kulisa', col);
    const bull = new THREE.Group();
    bull.position.set(CX, CY, 0.3);
    kul.add(bull);
    cylZ(bull, 1.75, 1.75, -0.14, 0.14, 0, 0, M.gear, 48);
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * TAU,
        t = add(bull, new THREE.BoxGeometry(0.12, 0.14, 0.26), M.gear, Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0);
      t.rotation.z = a;
    }
    box(bull, -0.09, 0.09, 0.05, 1.5, 0.14, 0.17, M.inner); // radiálna drážka čapu
    const pin = cylZ(bull, 0.13, 0.13, 0.14, 0.42, 0, 1, M.steel, 16);
    const pinion = new THREE.Group();
    pinion.position.set(CX + 2.25, CY - 0.55, 0.3);
    kul.add(pinion);
    cylZ(pinion, 0.42, 0.42, -0.12, 0.12, 0, 0, M.steelDark, 20);
    box(pinion, -0.05, 0.05, -0.45, 0.45, -0.13, 0.13, M.inner);
    const lnk = new THREE.Group();
    lnk.position.set(CX, PY, 0.62);
    kul.add(lnk);
    box(lnk, -0.24, 0.24, 0, SH_K.Lk - 0.1, -0.09, 0.09, M.steelDark);
    box(lnk, -0.08, 0.08, 0.6, SH_K.Lk - 0.5, 0.09, 0.1, M.inner);
    cylZ(kul, 0.2, 0.2, 0.45, 0.8, CX, PY, M.steel, 16);
    const stone = add(kul, new THREE.BoxGeometry(0.2, 0.36, 0.16), M.black); // kameň v kulise
    const topBlock = add(kul, new THREE.BoxGeometry(0.5, 0.3, 0.3), M.steelDark);
    // ---------- rozvádzač a páka prevodovky ----------
    const box2 = grp('rozvadzac', col);
    box(box2, -2.6, -1.0, 2.6, 4.6, 1.5, 1.62, M.panel);
    const pbtn = (x, y, m) => {
      const g = new THREE.Group();
      g.position.set(x, y, 1.62);
      box2.add(g);
      cylZ(g, 0.12, 0.12, 0, 0.07, 0, 0, m, 20);
      hitProxy(g, 0.16, 0, 0, 0.05);
      return g;
    };
    const bStart = pbtn(-2.15, 3.3, M.btnGreen),
      bStop = pbtn(-1.75, 3.3, M.red);
    const lampRun = std(0x1f5f33, 0.4, 0.1);
    ball(box2, 0.07, -1.35, 3.3, 1.64, lampRun);
    const eStop = new THREE.Group();
    eStop.position.set(-1.8, 2.9, 1.62);
    box2.add(eStop);
    box(box2, -2.1, -1.5, 2.65, 3.1, 1.62, 1.63, M.yellow);
    cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16);
    cylZ(eStop, 0.18, 0.17, 0.07, 0.15, 0, 0, M.red, 24);
    hitProxy(eStop, 0.24, 0, 0, 0.1);
    const mainSw = new THREE.Group();
    mainSw.position.set(-1.8, 4.1, 1.63);
    box2.add(mainSw);
    cylZ(mainSw, 0.17, 0.17, 0, 0.06, 0, 0, M.black, 24);
    box(mainSw, -0.045, 0.045, -0.2, 0.2, 0.06, 0.16, M.red);
    cylZ(col, 0.2, 0.17, 1.5, 1.6, -1.8, 6.2, M.black, 20);
    detents(col, -1.8, 6.2, 1.6, 0.15, SH_SPEED_ANG, 0.022);
    const levN = pivotLever(col, -1.8, 6.2, 1.6, 0.45, 1.25);
    // kľuka dĺžky zdvihu (štvorhran na boku stojana)
    cylZ(col, 0.08, 0.08, 1.5, 1.62, -1.8, 7.3, M.steel, 4);
    const crS = crank(col, 0.32, -1.8, 7.3, 1.66);
    // ---------- smykadlo s nožovou hlavou ----------
    const ram = grp('smykadlo');
    box(ram, -6.4, 0, 8.46, 9.3, -0.62, 0.62, M.green);
    box(ram, -6.4, 0, 9.3, 9.4, -0.42, 0.42, M.greenDark);
    box(ram, -3.4, -2.8, 9.4, 9.55, -0.12, 0.12, M.steelDark); // upínanie polohy smykadla
    const head = grp('hlava', ram);
    cylX(head, 0.58, 0.58, 0, 0.12, 8.95, 0, M.greenDark, 32); // otočná doska hlavy
    box(head, 0.12, 0.3, 7.95, 9.4, -0.3, 0.3, M.green); // vedenie suportu
    const slide = new THREE.Group();
    head.add(slide);
    box(slide, 0.3, 0.5, 7.85, 9.25, -0.26, 0.26, M.greenDark);
    const hwG = new THREE.Group();
    hwG.position.set(0.4, 9.58, 0);
    hwG.rotation.x = -Math.PI / 2;
    head.add(hwG);
    cylY(head, 0.05, 0.05, 9.25, 9.58, 0.4, 0, M.steel, 10);
    const wD = handwheel(hwG, 0.28, 0, 0, 0, 'z', 0.16);
    const clap = new THREE.Group();
    clap.position.set(0.5, 7.9, 0);
    slide.add(clap);
    box(clap, -0.34, 0.02, -0.52, 0, -0.22, 0.22, M.green); // sklopná doska
    box(clap, -0.26, -0.02, -0.5, -0.12, 0.22, 0.27, M.steelDark); // nožový držiak
    cylZ(clap, 0.04, 0.04, 0.27, 0.33, -0.14, -0.3, M.black, 8);
    const toolG = new THREE.Group();
    clap.add(toolG);
    const buildTool = (id) => {
      while (toolG.children.length) {
        const o = toolG.children.pop();
        o.geometry.dispose();
      }
      const t = SHAPER_TOOLS[id],
        w = Math.max(0.03, t.w / 100);
      box(toolG, -0.19, -0.07, -0.82, -0.2, -0.06, 0.06, M.hss);
      box(toolG, -0.16, -0.04, -0.95, -0.8, -w / 2, w / 2, M.hss);
    };
    buildTool(c.tool);
    // ---------- stôl na priečniku, opierka, zverák ----------
    const tbl = grp('stol');
    box(tbl, -0.2, 0.15, 4.0, 5.2, -0.9, 0.9, M.greenDark);
    box(tbl, 0.15, 3.1, 4.1, TT, -1.0, 1.0, M.green);
    [-0.5, 0, 0.5].forEach((z) => box(tbl, 0.15, 3.1, TT - 0.01, TT + 0.004, z - 0.06, z + 0.06, M.inner));
    [4.5, 4.95].forEach((y) => box(tbl, 3.1, 3.104, y - 0.05, y + 0.05, -0.95, 0.95, M.inner));
    box(tbl, 2.5, 3.0, 0.5, 4.1, -0.35, 0.35, M.greenDark); // opierka stola
    const vise = grp('zverak', tbl);
    const wk = { L: 1.6, W: 0.8, H: 0.5, par: 0.1 };
    let hf = null,
      jawM = null;
    box(vise, VX - 1.2, VX + 1.2, TT, TT + 0.35, -0.9, 0.9, M.steelDark);
    const jawF = box(vise, VX - 1.0, VX + 1.0, TT + 0.35, TT + JAW, -1, -0.8, M.steelDark);
    cylZ(vise, 0.07, 0.07, 0.9, 1.35, VX, TT + 0.2, M.steel, 10);
    const parL = box(vise, VX - 0.7, VX + 0.7, TT + 0.35, TT + 0.45, -0.3, -0.2, M.steel),
      parR = box(vise, VX - 0.7, VX + 0.7, TT + 0.35, TT + 0.45, 0.2, 0.3, M.steel);
    const workBottom = () => TT + 0.35 + wk.par;
    const makeWork = () => {
      if (hf) {
        vise.remove(hf.mesh);
        hf.dispose();
      }
      if (jawM) {
        vise.remove(jawM);
        jawM.geometry.dispose();
      }
      wk.par = Math.max(0.05, JAW - 0.35 + 0.15 - wk.H); // obrobok vyčnieva nad čeľuste aspoň 15 mm
      const NX = Math.round(wk.L * 50),
        NZ = Math.round(wk.W * 200);
      hf = createHeightField({ NX, NZ, W: wk.L, D: wk.W, H: wk.H, raw: 0x585d62, cut: 0xdfe4e8, mat: M.work });
      hf.mesh.position.set(VX, workBottom(), 0);
      hf.mesh.userData.part = 'obrobok';
      vise.add(hf.mesh);
      G.obrobok = hf.mesh;
      jawF.position.z = -wk.W / 2 - 0.1;
      jawM = box(vise, VX - 1.0, VX + 1.0, TT + 0.35, TT + JAW, wk.W / 2, wk.W / 2 + 0.2, M.steelDark);
      [parL, parR].forEach((p, i) => {
        p.scale.set(Math.min(1, wk.L / 1.5), Math.max(0.1, wk.par / 0.1), 1);
        p.position.set(VX, TT + 0.35 + wk.par / 2, (i ? 1 : -1) * (wk.W / 2 - 0.1));
      });
    };
    makeWork();
    const crZ = crank(tbl, 0.36, -0.4, 4.55, 3.05); // kľuka priečneho posuvu (na konci priečnika)
    tbl.remove(crZ);
    col.add(crZ);
    cylZ(col, 0.12, 0.1, 3.0, 3.08, -0.4, 5.05, M.black, 16);
    detents(col, -0.4, 5.05, 3.08, 0.13, [0.5, 0, -0.5], 0.02);
    const levF = pivotLever(col, -0.4, 5.05, 3.08, 0.35, 1.2); // páka západkového posuvu
    const chips = createParticles(scene, new THREE.TorusGeometry(0.02, 0.006, 4, 8, 4.2), M.chip, 260);
    const lamp = createLamp(scene, col, kit, M, {
      base: v3(-1.0, 8.2, -1.3),
      elbow: v3(0.2, 9.9, -1.8),
      head: v3(1.0, 9.2, -1.4),
      aim: v3(VX, TT + 0.8, 0),
      angle: 0.5,
      power: 2.6,
    });

    // ---------- stav ----------
    const st = {
      phi: 0,
      w: 0,
      ram: 0,
      d: c.d / 100,
      tz: c.tz / 100,
      lift: 0,
      fwd: true,
      msg: null,
      cutT: -9,
      last: null,
      cuts: 0,
      fed: false,
      short: false,
    };
    let t = 0,
      last = performance.now(),
      teleT = 0,
      dirty = false,
      lastBuild = 0,
      chipAcc = 0;
    const flags = {};
    const say = (text, kind = 'warn') => {
      st.msg = { text, kind, until: t + 2.8 };
    };
    const sayOnce = (key, cond, text, kind) => {
      if (cond && !flags[key]) say(text, kind);
      flags[key] = cond;
    };
    const tool = () => SHAPER_TOOLS[c.tool] || SHAPER_TOOLS.ubr;
    const rOf = () => crankR(clamp(c.S, 20, 500) / 100);
    // špička noža voči obrobku: [x od stredu, z od stredu, y od spodku obrobku]
    const tipRel = (ramX, d, tz, lift = 0) => [
      ramX + TIP_DX + lift * 0.9 - VX,
      -tz,
      TIP_Y0 - d + lift * 0.1 - workBottom(),
    ];
    const ramFront = (phi) => CX + P0 + c.pos / 100 + ramPos(phi, rOf()).x;
    // najväčšie vniknutie noža do materiálu v pásme x0 – x1
    const pen = (x0, x1, rz, ry) => {
      let m = -1;
      const T = tool();
      hf.eachRect(x0, x1, rz - 0.2, rz + 0.2, (k, x, z) => {
        const p = hf.hgt[k] - (ry + toolLift(T, (z - rz) * 100) / 100);
        if (p > m) m = p;
      });
      return m;
    };
    const cut = (x0, x1, rz, ry) => {
      let rem = 0;
      const T = tool();
      hf.cutRect(x0, x1, rz - 0.2, rz + 0.2, (k, x, z) => {
        const lim = Math.max(0, ry + toolLift(T, (z - rz) * 100) / 100);
        if (hf.hgt[k] > lim + 1e-7) {
          rem += hf.hgt[k] - lim;
          hf.hgt[k] = lim;
          hf.mask[k] = 1;
        }
      });
      return rem;
    };
    // čeľuste zveráka: nôž pod hornou hranou čeľustí v ich priečnom pásme
    const hitsJaw = (rx, rz, ry) =>
      ry + workBottom() < TT + JAW + 0.005 &&
      Math.abs(rx) < 1.05 &&
      Math.abs(rz) > wk.W / 2 - 0.004 &&
      Math.abs(rz) < wk.W / 2 + 0.22;

    // ---------- pohľady, popisy, výber ----------
    const anchors = {
      podstavec: () => v3(2.6, 0.55, 1.9),
      stojan: () => v3(-6.6, 8.5, 1.5),
      kulisa: () => v3(CX + 0.9, CY + 1.9, 0.9),
      smykadlo: () => v3(st.ram - 3.2, 9.6, 0.6),
      hlava: () => v3(st.ram + 0.7, 9.2, 0.35),
      stol: () => v3(2.9, TT - 0.4, st.tz + 1.0),
      zverak: () => v3(VX + 1.1, TT + 0.5, st.tz + 0.9),
      obrobok: () => v3(VX + 0.5, workBottom() + wk.H + 0.05, st.tz),
      rozvadzac: () => v3(-1.8, 4.75, 1.62),
    };
    const views = {
      celok: () => [
        [8.5, 12, 15],
        [-1.8, 5.5, 0],
      ],
      noz: () => [[VX + 2.4, TT + 3.3, st.tz + 3.4], [VX + 0.1, TT + 1.0, st.tz], true],
      kulisa: () => [[CX + 0.6, 5.2, 9.5], [CX, 5.0, 0.3], true],
      zhora: () => [[VX - 0.5, 15.5, 2.5], [VX - 0.5, TT, 0], true],
      panel: () => [[-1.2, 4.6, 6.5], [-1.8, 4.2, 1.6], true],
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
    apiRef.current.measure = () => ({ info: hfInfo(hf) });
    apiRef.current.save = () =>
      c.unclamped
        ? null
        : { v: 1, wk: { L: wk.L, W: wk.W, H: wk.H }, NX: hf.NX, NZ: hf.NZ, hgt: toB64(hf.hgt), mask: toB64(hf.mask) };
    apiRef.current.load = (r) => {
      if (!r || r.v !== 1) return false;
      push('bL', Math.round(r.wk.L * 100));
      push('bW', Math.round(r.wk.W * 100));
      push('bH', Math.round(r.wk.H * 100));
      if (!apiRef.current.newBlank()) return false;
      if (hf.NX !== r.NX || hf.NZ !== r.NZ) return false;
      hf.hgt.set(fromB64(r.hgt, Float32Array));
      hf.mask.set(fromB64(r.mask, Uint8Array));
      hf.rebuild(true);
      return true;
    };
    apiRef.current.exportStl = () => exportStl(hf.mesh);
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if (c.running || c.drive || c.wheel || c.work)
        throw new Error(
          L('Najprv zastav stroj a potom exportuj obrobok.', 'Stop the machine before exporting the workpiece.'),
        );
      return exportStep(hf.mesh);
    };
    const running = () => st.w > 0.05;
    const wi = createWorkInspect({
      scene,
      camera,
      dom,
      insp,
      c,
      getObj: () => hf.mesh,
      getSpot: () => v3(2.6, 8.4, 4.2),
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
      wk.L = c.bL / 100;
      wk.W = c.bW / 100;
      wk.H = c.bH / 100;
      makeWork();
      st.last = null;
      // nôž nad nový obrobok
      const [rx, rz, ry] = tipRel(st.ram, st.d, st.tz);
      if (Math.abs(rx) < wk.L / 2 + 0.03 && pen(rx - 0.02, rx + 0.02, rz, ry) > 0) {
        st.d = Math.max(0, TIP_Y0 - workBottom() - wk.H - 0.1);
        push('d', Math.round(st.d * 1000) / 10);
      }
      say(L('Vo zveráku je nový polotovar.', 'A new workpiece is in the vise.'), 'info');
      return true;
    };
    apiRef.current.setTool = (id) => {
      if (c.run || running()) {
        say(L('Nôž sa mení len pri stojacom stroji.', 'The tool can only be changed with the machine stopped.'));
        return false;
      }
      buildTool(id);
      return true;
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
        angles: SH_SPEED_ANG,
        minR: 0.25,
        label: LL('Páka prevodovky zdvihov', 'Stroke-speed lever'),
        hint: LL(
          '6 stupňov 10 – 56 zdvihov za minútu, preraďuje sa pri stojacom stroji.',
          '6 steps 10 – 56 strokes per minute, shifted with the machine stopped.',
        ),
        getIdx: () => logNear(SHAPER_SPEEDS, c.n),
        onSet: (i) => {
          if (stopped(L('Počet zdvihov', 'The stroke rate'))) push('n', SHAPER_SPEEDS[i]);
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
          'Štvorhran na boku stojana posúva čap na kolese kulisy. Len pri stojacom stroji.',
          'The square shaft on the column side moves the crank pin. Only with the machine stopped.',
        ),
        guard: () => stopped(L('Zdvih', 'The stroke')),
        turn: (d) => push('S', clamp(Math.round(c.S - d * 20), 20, 500)),
        read: () => `${c.S} mm`,
      },
      crS,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.3,
        inc: -1,
        label: LL('Kľuka priečneho posuvu stola', 'Table cross-feed crank'),
        hint: LL('1 otáčka = 5 mm.', '1 turn = 5 mm.'),
        turn: (d) => push('tz', clamp(Math.round((c.tz - (d * 5) / TAU) * 10) / 10, -250, 250)),
        read: () => `Z ${(st.tz * 100).toFixed(1)} mm`,
      },
      crZ,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.2,
        inc: -1,
        label: LL('Koliesko prísuvu noža', 'Tool down-feed handwheel'),
        hint: LL(
          'V smere hodinových ručičiek nôž klesá. 1 otáčka = 4 mm, dielik 0,04 mm.',
          'Clockwise lowers the tool. 1 turn = 4 mm, one division 0.04 mm.',
        ),
        turn: (d) => push('d', clamp(Math.round((c.d - (d * 4) / TAU) * 100) / 100, 0, 150)),
        read: () => `${(st.d * 100).toFixed(2)} mm`,
      },
      wD,
    );
    ctrl.reg(
      {
        type: 'lever',
        angles: [0.5, 0, -0.5],
        minR: 0.2,
        label: LL('Páka západkového posuvu stola', 'Ratchet table-feed lever'),
        hint: LL(
          'Vľavo / vypnuté / vpravo – stôl sa posunie o krok na začiatku každého pracovného zdvihu.',
          'Left / off / right – the table moves one step at the start of each cutting stroke.',
        ),
        getIdx: () => (!c.autoF ? 1 : c.fdir > 0 ? 2 : 0),
        onSet: (i) => {
          push('autoF', i !== 1);
          if (i !== 1) push('fdir', i === 2 ? 1 : -1);
        },
        read: () => (!c.autoF ? L('vypnutý', 'off') : `${c.fdir > 0 ? '→' : '←'} ${c.feed} mm`),
      },
      levF,
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
    const tmp = v3(0, 0, 0);
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

      // ručné polohy: prísuv a priečny posuv s kontrolou dotyku (pri stojacom stroji nôž nevnikne do materiálu)
      const dNew = approach(st.d, clamp(c.d, 0, 150) / 100, 0.6 * dt),
        zNew = approach(st.tz, clamp(c.tz, -250, 250) / 100, 0.8 * dt);
      if (dNew !== st.d || zNew !== st.tz) {
        const [rx, rz0, ry0] = tipRel(st.ram, st.d, st.tz),
          inX = Math.abs(rx) < wk.L / 2 + 0.005;
        const p0 = inX && !c.unclamped ? pen(rx - 0.02, rx + 0.02, rz0, ry0) : -1;
        const okAt = (d, z) => {
          const [, rz, ry] = tipRel(st.ram, d, z);
          if (hitsJaw(rx, rz, ry)) return 'jaw';
          if (!inX || c.unclamped) return null;
          const p = pen(rx - 0.02, rx + 0.02, rz, ry);
          return p <= Math.max(0, p0) + 1e-6 ? null : 'mat';
        };
        let why = okAt(dNew, zNew);
        if (!why) {
          st.d = dNew;
          st.tz = zNew;
        } else {
          if (!okAt(st.d, zNew)) st.tz = zNew;
          else if (!okAt(dNew, st.tz)) st.d = dNew;
          if (why === 'mat')
            sayOnce(
              'matStill',
              true,
              L(
                'Nôž je nad obrobkom – pri stojacom smykadle sa do materiálu nezareže. Vyjdi smykadlom za obrobok alebo spusti stroj.',
                'The tool is over the work – with the ram stopped it cannot cut into the material. Move the ram past the work or start the machine.',
              ),
              'warn',
            );
          if (why === 'jaw')
            sayOnce(
              'jawStill',
              true,
              L('Nôž by narazil do čeľuste zveráka.', 'The tool would hit the vise jaw.'),
              'danger',
            );
        }
        if (!why) {
          flags.matStill = false;
          flags.jawStill = false;
        }
        wD.rotation.z = (-st.d / 0.04) * TAU;
        crZ.rotation.z = ((st.tz * 100) / 5) * TAU;
      }

      // kulisa a smykadlo
      const prevRam = st.ram;
      st.phi += st.w * dt;
      const fwd = isForward(st.phi, r);
      // začiatok pracovného zdvihu: západkový posuv stola o krok
      if (fwd && !st.fwd && st.w > 0.05) {
        st.cuts++;
        const [rx] = tipRel(st.ram, st.d, st.tz);
        sayOnce(
          'short',
          rx > -wk.L / 2 - 0.01,
          L(
            'Spätný zdvih nevyjde za obrobok – zväčši zdvih alebo posuň jeho polohu dozadu.',
            'The return stroke does not clear the work – lengthen the stroke or move its position back.',
          ),
          'warn',
        );
        if (c.autoF) {
          const nz = clamp(c.tz + c.fdir * c.feed, -250, 250);
          if (nz === c.tz) {
            push('autoF', false);
            say(
              L(
                'Stôl je na konci priečnika – posuv sa vypol.',
                'The table reached the end of the rail – the feed switched off.',
              ),
              'info',
            );
          } else {
            c.tz = nz;
            st.tz = nz / 100;
            pend.tz = nz;
            crZ.rotation.z = ((st.tz * 100) / 5) * TAU;
          }
        }
      }
      st.fwd = fwd;
      st.ram = ramFront(st.phi);
      const th = ramPos(st.phi, r).th;
      if (!running()) st.ram = ramFront(st.phi);

      // obrábanie pri pracovnom zdvihu; pri spätnom sa sklopná doska nadvihne
      const [rx0] = tipRel(prevRam, st.d, st.tz),
        [rx1, rz, ry] = tipRel(st.ram, st.d, st.tz);
      let rem = 0;
      const lo = Math.min(rx0, rx1),
        hi = Math.max(rx0, rx1),
        overWork = hi > -wk.L / 2 && lo < wk.L / 2 && !c.unclamped;
      if (running() && fwd && rx1 > rx0 && overWork) {
        if (hitsJaw(rx1, rz, ry)) {
          push('run', false);
          st.w = 0;
          say(
            L(
              'Nôž narazil do čeľuste zveráka! Stroj zastavený – zdvihni nôž alebo posuň stôl.',
              'The tool hit the vise jaw! Machine stopped – raise the tool or move the table.',
            ),
            'danger',
          );
        } else {
          const p = pen(lo, hi, rz, ry);
          if (p > tool().max / 100 + 0.0005) {
            push('run', false);
            st.w = 0;
            say(
              L(
                `Príliš veľký záber (${(p * 100).toFixed(1).replace('.', ',')} mm) – ${toolName(c.tool).toLowerCase()} zvládne najviac ${String(tool().max).replace('.', ',')} mm na zdvih. Stroj zastavený, zdvihni nôž.`,
                `Cut too deep (${(p * 100).toFixed(1)} mm) – the ${toolName(c.tool).toLowerCase()} takes at most ${tool().max} mm per stroke. Machine stopped, raise the tool.`,
              ),
              'danger',
            );
          } else if (p > 0) rem = cut(lo, hi, rz, ry);
        }
      }
      if (rem > 0) {
        st.cutT = t;
        dirty = true;
        chipAcc += dt * 40;
        while (chipAcc >= 1) {
          chipAcc -= 1;
          chips.spawn(
            v3(st.ram + TIP_DX + 0.05, TIP_Y0 - st.d + 0.03, 0),
            v3(0.8 + Math.random() * 1.2, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2),
            6 + Math.random() * 4,
          );
        }
      }
      // sklopná doska: pri spätnom zdvihu nad obrobkom sa nôž nadvihne
      const dragging =
        running() && !fwd && Math.abs(rx1) < wk.L / 2 + 0.02 && pen(rx1 - 0.02, rx1 + 0.02, rz, ry + 0.002) > -0.004;
      st.lift = approach(st.lift, dragging ? 0.12 : 0, 2 * dt);
      const cutting = t - st.cutT < 0.3;
      if (dirty && t - lastBuild > 0.08) {
        hf.rebuild();
        dirty = false;
        lastBuild = t;
      }

      // pohyb skupín
      ram.position.x = st.ram;
      slide.position.y = -st.d;
      clap.rotation.z = st.lift;
      tbl.position.z = st.tz;
      bull.rotation.z = -st.phi;
      pinion.rotation.z = st.phi * 4.3;
      pin.position.set(0, r, 0.28);
      pin.scale.set(1, 1, 1);
      lnk.rotation.z = -th;
      const pinW = tmp.set(Math.sin(st.phi) * r, Math.cos(st.phi) * r, 0);
      stone.position.set(CX + pinW.x, CY + pinW.y, 0.72);
      stone.rotation.z = -th;
      topBlock.position.set(CX + SH_K.Lk * Math.tan(th), PY + SH_K.Lk, 0.62);
      cover.visible = c.cover;
      lampRun.emissive.setHex(running() ? 0x22dd55 : 0);
      chips.update(dt, (q) => {
        if (Math.abs(q.x - VX) < 1.2 && Math.abs(q.z - st.tz) < 0.9)
          return Math.abs(q.z - st.tz) < wk.W / 2 && Math.abs(q.x - VX) < wk.L / 2 ? workBottom() + wk.H : TT + 0.35;
        return Math.abs(q.z - st.tz) < 1.0 && q.x > 0.15 && q.x < 3.1 ? TT : 0.5;
      });
      lamp.update(c.light);

      crS.rotation.z = -c.S / 20;
      ctrl.update(dt);
      insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        setTele({
          ram: st.ram,
          phi: st.phi,
          v: cutSpeed(c.S, c.n, r),
          d: st.d * 100,
          tz: st.tz * 100,
          cutting,
          fwd,
          running: running(),
          msg: st.msg && st.msg.until > t ? st.msg : null,
        });
        if (Object.keys(pend).length) {
          const p = { ...pend };
          Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
      }
      snd.update({
        motor: (st.w / ((56 / 60) * TAU)) * 0.8 + (st.w > 0.05 ? 0.2 : 0),
        cut: cutting && running() ? (fwd ? 0.8 : 0.15) : 0,
      });
      renderer.render(scene, camera);
    };
    try {
      if (/[?&]debug/.test(window.location.search)) window.__shaper = { st, c, hf: () => hf, tipRel, wk };
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
        if (window.__shaper && window.__shaper.st === st) delete window.__shaper;
      } catch (err) {
        /* ignorované */
      }
      disposeStage();
    };
  }, []);

  const parts = shaperParts();
  const info = apiRef.current.measure ? apiRef.current.measure().info : null;
  const g = info && ui.tool.startsWith('drazk') ? grooveInfo(info, 2) : null;
  const r = crankR(ui.S / 100),
    v = cutSpeed(ui.S, ui.n, r);
  const fmt = (x, d = 1) => L(x.toFixed(d).replace('.', ','), x.toFixed(d));
  const setupTask = (task) => {
    if (ui.run || tele.running) return;
    Object.entries(task.setup).forEach(([k, val]) => {
      if (k === 'tool') {
        if (apiRef.current.setTool && apiRef.current.setTool(val)) set('tool', val);
      } else set(k, val);
    });
    set('d', 50);
    if (apiRef.current.newBlank) apiRef.current.newBlank();
  };
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped
      ? { kind: 'info', text: L('Obrobok je vybratý zo zveráka.', 'The workpiece is out of the vise.') }
      : tele.cutting && tele.running
        ? {
            kind: 'run',
            text: `${L('Obrážanie', 'Shaping')} – ${ui.n} ${L('zdvihov/min', 'strokes/min')}, v ≈ ${fmt(v)} m/min, ${L('prísuv', 'down-feed')} ${fmt(tele.d, 2)} mm`,
          }
        : !ui.power
          ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
          : tele.running
            ? {
                kind: 'run',
                text: L(
                  'Smykadlo beží. Prisuň nôž kolieskom na hlave a zapni posuv stola.',
                  'The ram is running. Feed the tool down with the head handwheel and switch on the table feed.',
                ),
              }
            : {
                kind: 'idle',
                text: L(
                  'Stroj stojí. Nastav zdvih a jeho polohu, potom spusti stroj.',
                  'The machine is stopped. Set the stroke length and position, then start the machine.',
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
      text: tele.fwd ? L('Pracovný zdvih', 'Cutting stroke') : L('Spätný zdvih', 'Return stroke'),
    });
  if (ui.autoF)
    chips.push({ color: '#7fb6ff', text: `${L('Posuv', 'Feed')} ${fmt(ui.feed)} mm ${ui.fdir > 0 ? '→' : '←'}` });
  const busy = ui.run || tele.running;

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
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · obrážačka', 'Simulator · shaper')}
            title={L('Priečna obrážačka', 'Shaping machine')}
            sub={L(
              'Predloha: kulisová obrážačka TOS so zdvihom do 500 mm. Smykadlo poháňa kulisa, stôl sa posúva západkou.',
              'Modelled after a TOS slotted-link shaper with strokes up to 500 mm. The ram is driven by the slotted link, the table by a ratchet.',
            )}
            rows={[
              [L('Zdvih mm', 'Stroke mm'), String(ui.S)],
              [L('Prísuv mm', 'Feed mm'), tele.d.toFixed(2)],
              [L('Stôl Z', 'Table Z'), tele.tz.toFixed(1)],
            ]}
            foot={[`${ui.n} ${L('zdvihov/min', 'strokes/min')} · v ≈ ${fmt(v)} m/min`, toolName(ui.tool)]}
            status={statusMsg}
          />

          <TaskSection
            machine="obrazacka"
            tasks={SHAPER_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'run', items: SHAPER_SAFETY() }}
          />

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
              <SectionInfo title={L('Hlavný chod', 'Main drive')}>
                <p className="text-xs muted" style={{ color: v > 25 ? 'var(--warn)' : undefined }}>
                  {L(
                    `Priemerná rezná rýchlosť pri pracovnom zdvihu ${fmt(v)} m/min (oceľ nožom HSS: 10 – 20 m/min). Pracovný zdvih trvá ${Math.round(((Math.PI + 2 * Math.asin(r / SH_K.d)) / TAU) * 360)}° otáčky kolesa.`,
                    `Mean cutting speed on the cutting stroke ${fmt(v)} m/min (steel with HSS: 10 – 20 m/min). The cutting stroke takes ${Math.round(((Math.PI + 2 * Math.asin(r / SH_K.d)) / TAU) * 360)}° of the wheel turn.`,
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
                label={L('Odkrytý bok – vidno kulisu', 'Side open – link visible')}
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
              options={SHAPER_SPEEDS.map((n) => [n, String(n)])}
              onChange={(n) => {
                if (!busy) set('n', n);
              }}
            />
            <p className="text-xs muted" style={{ color: v > 25 ? 'var(--warn)' : undefined }}>
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
                    `Obrobok je dlhý ${ui.bL} mm – zdvih nastav o 20 – 30 mm dlhší, aby nôž pred rezom vyšiel za obrobok. Mení sa len pri stojacom stroji.`,
                    `The work is ${ui.bL} mm long – set the stroke 20 – 30 mm longer so that the tool clears the work before each cut. Only changed with the machine stopped.`,
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="shs"
              label={L('Dĺžka zdvihu', 'Stroke length')}
              unit="mm"
              min={20}
              max={500}
              step={5}
              value={ui.S}
              onChange={(val) => set('S', val)}
              disabled={busy}
            />
            <Slider
              id="shp"
              label={L('Poloha zdvihu (stred voči zveráku)', 'Stroke position (centre to vise)')}
              unit="mm"
              min={-150}
              max={150}
              step={5}
              value={ui.pos}
              onChange={(val) => set('pos', val)}
              disabled={busy}
            />
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nôž a posuvy', 'Tool and feeds')}</h2>
              <SectionInfo title={L('Nôž a posuvy', 'Tool and feeds')}>
                <p className="text-xs muted">
                  {L(
                    'Posuv sa urobí na začiatku každého pracovného zdvihu. Ubieracím nožom 0,5 – 1 mm, hladiacim do 6 mm; drážkovacím nožom posuv vypni a prisúvaj nôž.',
                    'The feed happens at the start of each cutting stroke. Roughing tool 0.5 – 1 mm, finishing tool up to 6 mm; with the slotting tool switch the feed off and feed the tool down.',
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
                  {L(
                    `záber do ${String(SHAPER_TOOLS[id].max).replace('.', ',')} mm`,
                    `cut up to ${SHAPER_TOOLS[id].max} mm`,
                  )}
                </button>
              ))}
            </div>
            <Slider
              id="shd"
              label={L('Prísuv noža (koliesko na hlave)', 'Tool down-feed (head handwheel)')}
              unit="mm"
              min={0}
              max={150}
              step={0.04}
              value={ui.d}
              actual={tele.d}
              digits={2}
              onChange={(val) => set('d', val)}
            />
            <div className="flex flex-wrap gap-2 mb-3">
              {[-1, -0.2, 0.2, 0.5, 1, 2].map((x) => (
                <button
                  key={x}
                  type="button"
                  className="btn"
                  onClick={() => set('d', clamp(Math.round((ui.d + x) * 100) / 100, 0, 150))}
                >
                  {x > 0 ? '+' : ''}
                  {fmt(x, x % 1 ? 1 : 0)}
                </button>
              ))}
            </div>
            <Slider
              id="shz"
              label={L('Stôl priečne Z', 'Table cross Z')}
              unit="mm"
              min={-250}
              max={250}
              step={0.5}
              value={ui.tz}
              actual={tele.tz}
              digits={1}
              onChange={(val) => set('tz', val)}
              disabled={ui.autoF && busy}
            />
            <Toggle
              on={ui.autoF}
              label={L('Západkový posuv stola', 'Ratchet table feed')}
              onClick={() => set('autoF', !ui.autoF)}
            />
            <SegRow
              label={L('Smer', 'Direction')}
              value={ui.fdir}
              options={[
                [-1, L('← k stojanu', '← to column')],
                [1, L('od stojana →', 'away →')],
              ]}
              onChange={(val) => set('fdir', val)}
            />
            <Slider
              id="shf"
              label={L('Posuv na zdvih', 'Feed per stroke')}
              unit="mm"
              min={0.2}
              max={4}
              step={0.1}
              value={ui.feed}
              digits={1}
              onChange={(val) => set('feed', val)}
            />
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Meranie', 'Measurement')}</h2>
            {info && info.cover > 0 ? (
              <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
                <div>
                  {L('Obrobené', 'Machined')}: <b>{Math.round(info.cover * 100)} %</b> {L('plochy', 'of the face')}
                </div>
                <div>
                  {L('Hĺbka', 'Depth')}:{' '}
                  <b>
                    {info.cutMin.toFixed(2)} – {info.cutMax.toFixed(2)} mm
                  </b>
                </div>
                {g && g.cover > 0 && (
                  <div>
                    {L('Drážka', 'Slot')}:{' '}
                    <b>
                      {fmt(g.width, 1)} × {fmt(g.depth, 2)} mm
                    </b>
                    , {L('stred', 'centre')} {fmt(g.center, 1)} mm
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs muted">
                {L('Plocha zatiaľ nie je obrobená.', 'The face has not been machined yet.')}
              </p>
            )}
          </div>

          <BlankSection
            onApply={() => {
              if (apiRef.current.newBlank) apiRef.current.newBlank();
            }}
            applyLabel={L('Upnúť nový polotovar', 'Clamp a new workpiece')}
            note={L(
              'Oceľový hranol vo zveráku na rovnobežných podložkách; dĺžka v smere zdvihu.',
              'Steel block in the vise on parallels; length along the stroke.',
            )}
          >
            <Slider
              id="sbl"
              label={L('Dĺžka', 'Length')}
              unit="mm"
              min={80}
              max={250}
              step={10}
              value={ui.bL}
              onChange={(val) => set('bL', val)}
            />
            <Slider
              id="sbw"
              label={L('Šírka', 'Width')}
              unit="mm"
              min={40}
              max={120}
              step={5}
              value={ui.bW}
              onChange={(val) => set('bW', val)}
            />
            <Slider
              id="sbh"
              label={L('Výška', 'Height')}
              unit="mm"
              min={30}
              max={80}
              step={5}
              value={ui.bH}
              onChange={(val) => set('bH', val)}
            />
          </BlankSection>

          <ExportSection machine="obrazacka" apiRef={apiRef} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['noz', L('Detail noža', 'Tool detail')],
              ['kulisa', L('Kulisa', 'Slotted link')],
              ['zhora', L('Zhora', 'Top')],
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

export { ShaperSimulator };
export default ShaperSimulator;
