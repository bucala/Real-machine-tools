import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { createMachineWorkInspect } from '../core/machineWorkInspect';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, makeKit, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection } from '../ui/tools';
import { PressDrawing } from '../ui/sketch';
import {
  PRESS,
  PRESS_PUNCHES,
  PRESS_STROKES,
  addHole,
  penetration,
  pressChecks,
  punchForce,
  strokeResult,
} from './pressMath';
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
// VÝSTREDNÍKOVÝ LIS TOMA LEN 40C – C-stojan, 400 kN
// =====================================================================
// mierka 1 = 100 mm. Obsluha stojí v +Z, pás sa posúva v osi X (zľava doprava), os nástroja je v (0, ZT).
// Baranidlo poháňa výstredník cez spojku zo zotrvačníka; jednotlivý zdvih sa spúšťa pedálom a končí v hornej úvrati.
const YD = 9.25,
  ZT = 1.2,
  PUNCH = 1.3; // čelo matrice, os nástroja, dĺžka razníka
const pressParts = () =>
  mkParts([
    [
      'stojan',
      'Stojan',
      'Frame',
      'C-stojan',
      'C-frame',
      'Liatinový stojan tvaru C je otvorený spredu aj zboku – nástroj sa dobre zakladá, ale pri plnej sile sa stojan mierne rozovrie.',
      'The cast C-shaped frame is open at the front and sides – the tool is easy to load, but under full load the frame opens slightly.',
    ],
    [
      'zotrvacnik',
      'Zotrvačník',
      'Flywheel',
      'Zotrvačník s krytom',
      'Flywheel with guard',
      'Motor roztáča remeňom zotrvačník. Pri zdvihu odovzdá energiu výstredníkovému hriadeľu – pred prvým zdvihom ho nechaj rozbehnúť.',
      'The motor spins the flywheel through a belt. During a stroke it gives its energy to the eccentric shaft – let it run up to speed before the first stroke.',
    ],
    [
      'baranidlo',
      'Baranidlo',
      'Ram',
      'Baranidlo s prestavením',
      'Ram with adjustment',
      'Baranidlo ide hore a dole o nastavený zdvih výstredníka (10 – 80 mm). Skrutkou na čele sa prestavuje výška – tým sa nastaví, ako hlboko sa razník zanorí do matrice.',
      'The ram moves up and down by the set eccentric stroke (10 – 80 mm). The screw on its front adjusts its height – this sets how deep the punch enters the die.',
    ],
    [
      'stol',
      'Stôl',
      'Bolster',
      'Upínacia doska stola',
      'Bolster plate',
      'Žltý stôl s T-drážkami a otvorom na prepad výstrižkov. Výstrižky a odpad padajú žľabom dopredu.',
      'The yellow bolster with T-slots and an opening for the blanks. Blanks and slugs fall down the chute to the front.',
    ],
    [
      'nastroj',
      'Nástroj',
      'Tool',
      'Strihadlo: razník a matrica',
      'Punch and die set',
      'Razník na baranidle, matrica na stole a vodiaca doska, ktorá stiahne pás z razníka. Sila strihu F = π · d · t · τ.',
      'The punch on the ram, the die on the bolster and the stripper that strips the strip off the punch. Cutting force F = π · d · t · τ.',
    ],
    [
      'kryt',
      'Kryt nástroja',
      'Tool guard',
      'Ochranný kryt nástroja',
      'Tool guard',
      'Sklopný kryt pred nástrojom. Kým je zdvihnutý, pedál zdvih nespustí.',
      'A hinged guard in front of the tool. While it is raised the pedal does not start a stroke.',
    ],
    [
      'rozvadzac',
      'Rozvádzač',
      'Control box',
      'Elektrický rozvádzač',
      'Electrical cabinet',
      'Hlavný vypínač, voľba režimu (jednotlivý zdvih / trvalý chod) a kontrolky.',
      'Main switch, mode selector (single stroke / continuous) and indicator lamps.',
    ],
    [
      'pedal',
      'Pedál',
      'Pedal',
      'Nožný pedál',
      'Foot pedal',
      'Stlačenie zapne spojku: v režime jednotlivý zdvih urobí lis jeden zdvih a zastaví v hornej úvrati.',
      'Pressing it engages the clutch: in single-stroke mode the press makes one stroke and stops at top dead centre.',
    ],
    [
      'pas',
      'Pás',
      'Strip',
      'Oceľový pás',
      'Steel strip',
      'Pás S235 sa posúva medzi vodiacimi lištami. Poloha razníka sa meria od ľavého konca pásu.',
      'The S235 strip slides between guide rails. The punch position is measured from the left end of the strip.',
    ],
  ]);
const PRESS_TASKS = [
  {
    id: 'dierovanie',
    title: () => L('Päť dier Ø20 v rozstupe 50 mm', 'Five Ø20 holes at 50 mm pitch'),
    desc: () =>
      L(
        'Pás 4 × 60 × 400 mm. Razníkom Ø20 vydieruj päť dier: prvú 50 mm od ľavého konca, ďalšie po 50 mm (±0,5 mm), všetky naskrz. Baranidlo prestavuj po malých krokoch – najprv skúšobný zdvih nad pásom, potom nižšie, kým razník neprestrihne (zanorenie 0,5 – 6 mm). Príliš nízko = zlomený razník.',
        'Strip 4 × 60 × 400 mm. Punch five holes with the Ø20 punch: the first 50 mm from the left end, the rest every 50 mm (±0.5 mm), all through. Adjust the ram in small steps – a trial stroke above the strip first, then lower until the punch cuts through (entry 0.5 – 6 mm). Too low = broken punch.',
      ),
    setup: { t: 4, W: 60, len: 400, d: 20, feed: 0, adj: 30 },
    drawing: () => (
      <PressDrawing
        L={400}
        W={60}
        t={4}
        d={20}
        xs={[50, 100, 150, 200, 250]}
        first="50"
        pitch="4 × 50"
        callout="5 × Ø20"
      />
    ),
    labels: {
      count: () => L('Päť dier Ø20 naskrz', 'Five Ø20 through holes'),
      edge: () => L('Prvá diera 50 ±0,5 mm od konca', 'First hole 50 ±0.5 mm from the end'),
      pitch: () => L('Rozstup 50 ±0,5 mm', 'Pitch 50 ±0.5 mm'),
      tool: () => L('Bez nárazu razníka', 'No punch crash'),
    },
  },
  {
    id: 'podlozky',
    title: () => L('Štyri podložky Ø50 zo 6 mm', 'Four Ø50 washers from 6 mm'),
    desc: () =>
      L(
        'Pás 6 × 80 × 300 mm, vystrihni aspoň štyri výstrižky Ø50. Mostík medzi výstrižkami musí byť aspoň hrúbka plechu (6 mm) – inak sa okraj roztrhne. Najprv si spočítaj silu: F = π · d · t · 0,8 · Rm; lis má 400 kN. Hrubší plech by lis preťažil.',
        'Strip 6 × 80 × 300 mm, blank at least four Ø50 discs. The web between the blanks must be at least the sheet thickness (6 mm) – otherwise the edge tears. Work out the force first: F = π · d · t · 0.8 · Rm; the press has 400 kN. A thicker sheet would overload the press.',
      ),
    setup: { t: 6, W: 80, len: 300, d: 50, feed: 0, adj: 30 },
    drawing: () => <PressDrawing L={300} W={80} t={6} d={50} xs={[35, 91, 147, 203]} web="≥ 6" callout="4 × Ø50" />,
    labels: {
      count: () => L('Aspoň štyri výstrižky Ø50', 'At least four Ø50 blanks'),
      web: () => L('Mostík ≥ 6 mm', 'Web ≥ 6 mm'),
      load: () => L('Bez preťaženia lisu', 'No press overload'),
    },
  },
].map((t) => ({ ...t, checks: (m) => pressChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const PRESS_SAFETY = () => [
  L(
    'Kryt nástroja je sklopený, ruky nikdy nedávam pod baranidlo.',
    'The tool guard is down, I never put my hands under the ram.',
  ),
  L(
    'Pás posúvam len v hornej úvrati, pri trvalom chode nohu z pedálu.',
    'I move the strip only at top dead centre; in continuous mode my foot is off the pedal.',
  ),
  L(
    'Pred zmenou nástroja vypnem motor a počkám, kým sa zotrvačník zastaví.',
    'Before changing the tool I switch off the motor and wait until the flywheel stops.',
  ),
];

function PressSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    motor: false,
    manual: false,
    mode: 'single',
    guard: true,
    stroke: 40,
    adj: 30,
    d: 20,
    feed: 0,
    t: 4,
    W: 60,
    len: 400,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    fw: 0,
    phi: 0,
    msg: null,
    F: 0,
    pen: 0,
    holes: 0,
    jam: false,
    broken: false,
    running: false,
    x: 0,
  });

  useEffect(() => {
    const mount = mountRef.current,
      layer = layerRef.current,
      tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('bender');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x92c79c, 0x7cb187, 0x5c8a68),
      strip: std(0x9ea4a9, 0.42, 0.75),
      hole: std(0x0b0c0d, 0.9, 0.1),
      dent: std(0x6f757a, 0.5, 0.6),
      tool: std(0xb8bdc1, 0.25, 0.9),
      skid: std(0x34424f, 0.7, 0.3),
      glass: new THREE.MeshStandardMaterial({
        color: 0xcfe6ff,
        roughness: 0.1,
        metalness: 0,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, pivotLever } = kit;
    const root = new THREE.Group();
    scene.add(root);
    apiRef.current.machineModel = { root, name: L('Výstredníkový lis', 'Eccentric press') };
    const G = {};
    const grp = (k, parent = root) => {
      const g = new THREE.Group();
      g.userData.part = k;
      parent.add(g);
      G[k] = g;
      return g;
    };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const texMat = (w, h, draw) => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      draw(cv.getContext('2d'), w, h);
      const tx = new THREE.CanvasTexture(cv);
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = 4;
      return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5, metalness: 0.15 });
    };
    const plateTex = texMat(200, 50, (g, w, h) => {
      g.fillStyle = '#f2f2ee';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b3f7a';
      g.font = 'bold 26px sans-serif';
      g.textBaseline = 'middle';
      g.fillText('TOMA', 10, h / 2 + 1);
      g.font = '15px sans-serif';
      g.fillText('LEN 40 C', 106, h / 2 + 1);
    });

    // ---------- C-stojan ----------
    const fr = grp('stojan');
    box(fr, -3.3, 3.3, 0, 0.45, -3.9, 3.6, M.skid); // podkladné lyžiny
    box(fr, -2.4, 2.4, 0.45, 7.2, -3.4, 0.4, M.green); // spodok stojana
    box(fr, -2.2, 2.2, 7.2, 13.6, -3.4, -0.8, M.green); // chrbát (hrdlo)
    // bočné steny s výstuhami: profil v rovine (z, y), vytiahnutý v x
    const side = new THREE.Shape();
    [
      [-3.5, 0.45],
      [3.4, 0.45],
      [3.4, 1.3],
      [1.0, 6.9],
      [-0.6, 8.0],
      [-0.9, 13.8],
      [-3.5, 13.8],
    ].forEach(([z, y], i) => (i ? side.lineTo(z, y) : side.moveTo(z, y)));
    [-1, 1].forEach((s) => {
      const g = new THREE.ExtrudeGeometry(side, { depth: 0.35, bevelEnabled: false });
      g.rotateY(-Math.PI / 2);
      g.translate(s > 0 ? 2.75 : -2.4, 0, 0);
      add(fr, g, M.green);
      box(fr, s > 0 ? 2.4 : -2.75, s > 0 ? 2.75 : -2.4, 0.45, 1.3, 0.4, 3.4, M.greenDark);
    });
    // hlava stojana s ložiskami výstredníka
    box(fr, -2.7, 2.7, 13.6, 22.6, -3.4, 2.5, M.green);
    box(fr, -2.75, 2.75, 22.6, 22.9, -3.45, 2.55, M.greenDark);
    box(fr, -2.6, -0.4, 14.6, 21.8, 2.5, 2.56, M.greenDark); // veko vľavo
    add(fr, new THREE.PlaneGeometry(1.7, 0.42), plateTex, -1.5, 21.0, 2.57);
    box(fr, -2.7, 2.7, 13.3, 13.6, -0.8, 2.5, M.yellow); // žltý pás pod hlavou
    box(fr, -2.2, -1.7, 13.5, 21.0, -3.4, -3.9, M.greenDark); // kábelový kanál vzadu
    // ---------- zotrvačník vpravo ----------
    const fw = grp('zotrvacnik');
    const FX = 2.7,
      FY = 18.6,
      FZ = -0.6,
      FR = 3.7;
    cylX(fw, FR, FR, FX, FX + 1.9, FY, FZ, M.green, 56); // kryt zotrvačníka
    box(fw, FX, FX + 1.9, 13.6, FY, FZ - FR, FZ + 1.2, M.green); // spodná časť krytu
    cylX(fw, FR + 0.03, FR + 0.03, FX + 0.75, FX + 1.15, FY, FZ, M.black, 56); // čierny pás (remeň)
    cylX(fw, 1.25, 1.25, FX + 1.9, FX + 2.4, FY, FZ, M.green, 40); // náboj
    cylX(fw, 1.0, 1.0, FX + 2.4, FX + 2.45, FY, FZ, M.yellow, 40);
    const hub = new THREE.Group();
    hub.position.set(FX + 2.46, FY, FZ);
    fw.add(hub);
    box(hub, 0, 0.03, -0.12, 0.12, -0.85, 0.85, M.black); // značka otáčania
    // ---------- stôl ----------
    const tbl = grp('stol');
    box(tbl, -2.9, 2.9, 7.2, 8.6, -0.9, 3.4, M.yellow);
    box(tbl, -2.9, 2.9, 8.6, 8.75, -0.8, 3.3, M.steelDark);
    [-1.6, 1.6].forEach((x) => box(tbl, x - 0.12, x + 0.12, 8.74, 8.751, -0.8, 3.3, M.black));
    box(tbl, -1.1, 1.1, 6.2, 7.2, 2.2, 3.1, M.yellow); // žľab výstrižkov
    const chute = new THREE.Shape();
    chute.moveTo(0, 0);
    chute.lineTo(1.6, -0.9);
    chute.lineTo(1.6, -0.6);
    chute.lineTo(0, 0.3);
    chute.lineTo(0, 0);
    const cg = new THREE.ExtrudeGeometry(chute, { depth: 2.2, bevelEnabled: false });
    cg.rotateY(-Math.PI / 2);
    cg.translate(1.1, 6.4, 3.1);
    add(tbl, cg, M.yellow);
    // ovládací panel pod stolom
    box(tbl, -2.3, -0.6, 5.6, 6.9, 3.4, 3.55, M.panel);
    const pbtn = (x, y, m) => {
      const g = new THREE.Group();
      g.position.set(x, y, 3.55);
      tbl.add(g);
      cylZ(g, 0.13, 0.13, 0, 0.07, 0, 0, m, 20);
      hitProxy(g, 0.18, 0, 0, 0.05);
      return g;
    };
    const bOn = pbtn(-1.85, 6.45, M.btnGreen),
      bOff = pbtn(-1.45, 6.45, M.red),
      bStop = pbtn(-1.0, 6.25, M.black);
    const lampRun = std(0x1f5f33, 0.4, 0.1);
    ball(tbl, 0.08, -1.0, 6.65, 3.56, lampRun);
    // ---------- nástroj: matrica, vodiaca doska, vodiace lišty ----------
    const tool = grp('nastroj');
    box(tool, -1.5, 1.5, 8.75, 9.1, -0.3, 2.7, M.steelDark); // spodná doska
    box(tool, -0.9, 0.9, 9.1, YD, ZT - 0.9, ZT + 0.9, M.tool); // matrica
    const dieHole = add(tool, new THREE.CylinderGeometry(1, 1, 0.02, 28), M.hole, 0, YD + 0.002, ZT);
    const railF = box(tool, -1.5, 1.5, YD, YD + 0.13, 0, 0.12, M.steel),
      railB = box(tool, -1.5, 1.5, YD, YD + 0.13, -0.12, 0, M.steel);
    [-1.3, 1.3].forEach((x) =>
      [ZT - 1.1, ZT + 1.1].forEach((z) => cylY(tool, 0.08, 0.08, YD, YD + 0.55, x, z, M.steel, 10)),
    );
    box(tool, -1.45, 1.45, YD + 0.14, YD + 0.42, ZT - 1.05, ZT + 1.05, M.steel); // vodiaca (sťahovacia) doska
    // ---------- baranidlo s razníkom (počiatok skupiny = hrana razníka) ----------
    const ramG = grp('baranidlo');
    const ram = new THREE.Group();
    ramG.add(ram);
    box(ram, -1.7, 1.7, PUNCH + 0.5, PUNCH + 5.0, ZT - 1.4, ZT + 1.6, M.green); // teleso baranidla
    box(ram, -1.75, 1.75, PUNCH + 0.5, PUNCH + 1.0, ZT + 1.6, ZT + 1.66, M.yellow); // žlté čelo
    [-1, 1].forEach((s) => box(ram, s * 1.7, s * 1.95, PUNCH + 0.6, PUNCH + 5.0, ZT - 1.0, ZT + 1.2, M.ways)); // vedenia
    box(ram, -1.2, 1.2, PUNCH + 0.2, PUNCH + 0.5, ZT - 1.0, ZT + 1.0, M.steelDark); // upínacia doska razníka
    cylY(ram, 0.32, 0.32, PUNCH - 0.1, PUNCH + 0.2, 0, ZT, M.steelDark, 20); // držiak
    const punchM = cylY(ram, 1, 1, 0, PUNCH - 0.1, 0, ZT, M.tool, 28); // razník (polomer sa mení)
    const adjNut = new THREE.Group();
    adjNut.position.set(0, PUNCH + 3.0, ZT + 1.6);
    ram.add(adjNut);
    const nut = new THREE.Group();
    adjNut.add(nut);
    cylZ(nut, 0.38, 0.38, 0, 0.25, 0, 0, M.steelDark, 6);
    cylZ(nut, 0.09, 0.09, 0.25, 0.75, 0.0, 0, M.steel, 10);
    box(nut, -0.05, 0.05, -0.6, 0.6, 0.7, 0.8, M.steel);
    ball(nut, 0.11, 0, 0.62, 0.75, M.black);
    hitProxy(nut, 0.55, 0, 0, 0.4);
    // ---------- ochranný kryt nástroja ----------
    const guardG = grp('kryt');
    const guardPiv = new THREE.Group();
    guardPiv.position.set(0, 12.9, ZT + 2.3);
    guardG.add(guardPiv);
    box(guardPiv, -2.0, 2.0, -0.12, 0, -0.05, 0.05, M.yellow);
    box(guardPiv, -2.0, 2.0, -3.6, -3.48, -0.05, 0.05, M.yellow);
    [-2.0, 1.88].forEach((x) => box(guardPiv, x, x + 0.12, -3.6, 0, -0.05, 0.05, M.yellow));
    add(guardPiv, new THREE.PlaneGeometry(3.76, 3.48), M.glass, 0, -1.8, 0);
    hitProxy(guardPiv, 0.6, 0, -0.3, 0.1);
    // ---------- rozvádzač vpravo ----------
    const cab = grp('rozvadzac');
    box(cab, 5.2, 7.4, 0, 7.2, -1.0, 1.4, M.green);
    box(cab, 5.15, 7.45, 7.2, 7.35, -1.05, 1.45, M.greenDark);
    box(cab, 5.4, 7.2, 5.5, 6.9, 1.4, 1.43, M.panel);
    const lampOn = std(0x5a4a18, 0.4, 0.1);
    ball(cab, 0.09, 5.8, 6.5, 1.45, lampOn);
    ball(cab, 0.09, 6.3, 6.5, 1.45, lampRun);
    box(cab, 5.6, 7.0, 3.2, 4.0, 1.4, 1.43, M.white); // štítok s parametrami
    const mainSw = new THREE.Group();
    mainSw.position.set(6.3, 1.6, 1.43);
    cab.add(mainSw);
    box(mainSw, -0.35, 0.35, -0.35, 0.35, 0, 0.04, M.yellow);
    cylZ(mainSw, 0.22, 0.22, 0.04, 0.1, 0, 0, M.black, 24);
    box(mainSw, -0.05, 0.05, -0.28, 0.28, 0.1, 0.2, M.red);
    const modeSel = new THREE.Group();
    modeSel.position.set(6.3, 5.95, 1.43);
    cab.add(modeSel);
    cylZ(modeSel, 0.16, 0.16, 0, 0.06, 0, 0, M.black, 20);
    const modeLev = pivotLever(modeSel, 0, 0, 0.06, 0.3, 0); // volič režimu
    cylY(cab, 0.07, 0.07, 7.35, 9.0, 6.0, 0, M.black, 8);
    cylX(cab, 0.07, 0.07, 3.0, 6.0, 9.0, 0, M.black, 8); // kábel k lisu
    // ---------- nožný pedál ----------
    const ped = grp('pedal');
    const PX = 1.8,
      PZ = 6.6;
    box(ped, PX - 0.75, PX + 0.75, 0, 0.35, PZ - 1.0, PZ + 1.0, M.yellow);
    box(ped, PX - 0.75, PX + 0.75, 0.35, 1.1, PZ - 1.0, PZ - 0.75, M.yellow); // kryt pedálu proti náhodnému šliapnutiu
    [-1, 1].forEach((s) =>
      box(
        ped,
        PX + s * 0.75 - (s > 0 ? 0.1 : 0),
        PX + s * 0.75 + (s > 0 ? 0 : 0.1),
        0.35,
        1.1,
        PZ - 1.0,
        PZ + 0.6,
        M.yellow,
      ),
    );
    const pedal = new THREE.Group();
    pedal.position.set(PX, 0.42, PZ - 0.7);
    ped.add(pedal);
    box(pedal, -0.6, 0.6, 0, 0.1, 0, 1.3, M.black);
    hitProxy(pedal, 0.6, 0, 0.1, 0.7);
    const cable = new THREE.CatmullRomCurve3([
      v3(PX, 0.3, PZ - 1.0),
      v3(3.2, 0.05, 4.4),
      v3(5.4, 0.05, 2.2),
      v3(5.6, 0.6, 1.4),
    ]);
    add(ped, new THREE.TubeGeometry(cable, 24, 0.05, 6, false), M.black);

    // ---------- pás ----------
    const pasG = grp('pas');
    let stripM = null;
    const holeGeo = new THREE.CylinderGeometry(1, 1, 1, 28);
    holeGeo.translate(0, -0.5, 0);
    const holeGrp = new THREE.Group();
    pasG.add(holeGrp);
    const st = {
      adj: c.adj,
      phi: 0,
      fw: 0,
      run: false,
      cont: false,
      jam: false,
      broken: false,
      x: 0,
      d: c.d,
      holes: [],
      crashes: 0,
      overloads: 0,
      F: 0,
      msg: null,
      hit: false,
      sheet: { t: c.t, W: c.W, L: c.len },
    };
    const showHoles = () => {
      while (holeGrp.children.length) holeGrp.remove(holeGrp.children[0]);
      const T = st.sheet.t / 100;
      st.holes.forEach((h) => {
        const m = new THREE.Mesh(holeGeo, h.through ? M.hole : M.dent);
        m.userData.stepSubtract = true;
        m.position.set(h.x / 100, YD + T + 0.003, ZT);
        m.scale.set(h.d / 200, h.through ? T + 0.006 : Math.max(0.004, h.depth / 100), h.d / 200);
        holeGrp.add(m);
      });
    };
    const makeStrip = () => {
      if (stripM) {
        pasG.remove(stripM);
        stripM.geometry.dispose();
      }
      const { t, W, L: Ls } = st.sheet,
        T = t / 100;
      stripM = box(pasG, 0, Ls / 100, YD, YD + T, ZT - W / 200, ZT + W / 200, M.strip);
      railF.position.z = ZT + W / 200;
      railB.position.z = ZT - W / 200;
      showHoles();
    };
    makeStrip();
    const slugs = createParticles(scene, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), M.strip, 24);

    // ---------- stav a kinematika ----------
    const tipY = (phi = st.phi) => {
      const S = c.stroke / 100,
        pen = penetration(st.adj) / 100;
      return YD - pen + (S / 2) * (1 + Math.cos(phi));
    };
    let t = 0,
      last = performance.now(),
      teleT = 0;
    const flags = {};
    const say = (text, kind = 'warn') => {
      st.msg = { text, kind, until: t + 3.4 };
    };
    const sayOnce = (key, cond, text, kind) => {
      if (cond && !flags[key]) say(text, kind);
      flags[key] = cond;
    };
    const atTop = () => !st.run && !st.jam && Math.abs(Math.sin(st.phi / 2)) < 0.02;

    // ---------- pohľady ----------
    const anchors = {
      stojan: () => v3(-2.4, 4.0, 0.5),
      zotrvacnik: () => v3(FX + 1.0, FY + FR + 0.2, FZ),
      baranidlo: () => v3(-1.8, tipY() + PUNCH + 3.0, ZT + 1.7),
      stol: () => v3(-2.9, 8.0, 3.4),
      nastroj: () => v3(1.5, YD + 0.3, 2.7),
      kryt: () => v3(2.0, c.guard ? 11.0 : 13.4, ZT + 2.4),
      rozvadzac: () => v3(6.3, 7.5, 1.4),
      pedal: () => v3(PX, 1.2, PZ),
      pas: () => v3(-st.x / 100 + 0.2, YD + 0.2, ZT + st.sheet.W / 200),
    };
    const views = {
      celok: () => [
        [17, 18, 27],
        [1.5, 10, 0],
      ],
      nastroj: () => [[4.5, YD + 3.0, 8.5], [0, YD + 0.4, ZT], true],
      bok: () => [[26, 13, 3], [0, 12, 0], true],
      rozvadzac: () => [[9, 6, 10], [6.2, 4.5, 1], true],
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
    apiRef.current.measure = () => ({
      holes: st.holes.map((h) => ({ ...h })),
      crashes: st.crashes,
      overloads: st.overloads,
      t: st.sheet.t,
    });
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if (c.running || c.drive || c.wheel || c.work || st.run)
        throw new Error(
          L('Najprv zastav stroj a potom exportuj obrobok.', 'Stop the machine before exporting the workpiece.'),
        );
      return exportStep(pasG);
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
      getObj: () => pasG,
      getSpot: () => v3(4, YD + 3, 8),
      canInspect: () =>
        !atTop() ? L('Najprv zastav lis v hornej úvrati.', 'Stop the press at top dead centre first.') : null,
    });

    apiRef.current.newBlank = () => {
      if (c.unclamped) {
        say(L('Najprv vráť obrobok do stroja.', 'Return the workpiece to the machine first.'));
        return false;
      }
      if (!atTop()) {
        say(L('Najprv zastav lis v hornej úvrati.', 'Stop the press at top dead centre first.'));
        return false;
      }
      st.sheet = { t: c.t, W: clamp(c.W, 30, 200), L: clamp(c.len, 100, 1000) };
      st.holes = [];
      st.crashes = 0;
      st.overloads = 0;
      push('feed', 0);
      st.x = 0;
      makeStrip();
      say(
        L(
          `Vložený pás ${c.t} × ${st.sheet.W} × ${st.sheet.L} mm.`,
          `Strip ${c.t} × ${st.sheet.W} × ${st.sheet.L} mm loaded.`,
        ),
        'info',
      );
      return true;
    };
    apiRef.current.newPunch = () => {
      if (c.motor || st.fw > 0.05) {
        say(
          L(
            'Razník sa mení len pri vypnutom motore a stojacom zotrvačníku.',
            'The punch is changed only with the motor off and the flywheel stopped.',
          ),
        );
        return false;
      }
      st.broken = false;
      st.d = c.d;
      st.jam = false;
      st.phi = 0;
      say(L(`Upnutý nový razník Ø${c.d} s matricou.`, `A new Ø${c.d} punch and die fitted.`), 'info');
      return true;
    };
    const pedalPress = () => {
      if (!c.power) {
        say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'));
        return;
      }
      if (!c.motor) {
        say(
          L(
            'Motor stojí – zapni ho zeleným tlačidlom a nechaj rozbehnúť zotrvačník.',
            'The motor is stopped – start it with the green button and let the flywheel run up.',
          ),
        );
        return;
      }
      if (st.fw < 0.9) {
        say(L('Zotrvačník sa ešte nerozbehol – počkaj.', 'The flywheel is not yet up to speed – wait.'));
        return;
      }
      if (st.jam) {
        say(
          L(
            'Lis je zaseknutý v dolnej úvrati – najprv ho uvoľni spätným chodom.',
            'The press is jammed at bottom dead centre – release it with reverse first.',
          ),
          'danger',
        );
        return;
      }
      if (st.broken) {
        say(
          L(
            'Razník je zlomený – vymeň nástroj (motor vypnutý).',
            'The punch is broken – replace the tool (motor off).',
          ),
          'danger',
        );
        return;
      }
      if (!c.guard) {
        say(
          L(
            'Kryt nástroja je zdvihnutý – pedál zdvih nespustí. Sklop kryt.',
            'The tool guard is raised – the pedal will not start a stroke. Lower the guard.',
          ),
          'danger',
        );
        return;
      }
      if (st.run) return;
      if (atTop()) st.adj = c.adj;
      st.run = true;
      st.cont = c.mode === 'cont';
      st.hit = false;
    };
    const stopPress = () => {
      st.cont = false;
    };
    apiRef.current.pedal = pedalPress;
    apiRef.current.stop = stopPress;
    apiRef.current.release = () => {
      if (!st.jam) return;
      if (c.motor) {
        say(
          L(
            'Spätný chod sa robí pri vypnutom motore – pootočením zotrvačníka späť.',
            'Reverse is done with the motor off – by turning the flywheel back.',
          ),
        );
        return;
      }
      st.jam = false;
      st.phi = 0;
      say(
        L('Baranidlo je uvoľnené a vrátené do hornej úvrate.', 'The ram is released and back at top dead centre.'),
        'info',
      );
    };
    const needPower = (fn) => () => {
      if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'));
      else fn();
    };
    ctrl.reg(
      {
        type: 'button',
        label: LL('Nožný pedál', 'Foot pedal'),
        hint: LL(
          'Zapne spojku – jeden zdvih (alebo trvalý chod).',
          'Engages the clutch – one stroke (or continuous running).',
        ),
        action: pedalPress,
      },
      pedal,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Motor ZAP', 'Motor ON'),
        hint: LL('Rozbehne zotrvačník.', 'Runs up the flywheel.'),
        action: needPower(() => push('motor', true)),
      },
      bOn,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Motor VYP', 'Motor OFF'),
        hint: LL('Vypne motor, zotrvačník dobieha.', 'Switches the motor off, the flywheel runs down.'),
        action: () => {
          push('motor', false);
          stopPress();
        },
      },
      bOff,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('STOP zdvihu', 'Stroke STOP'),
        hint: LL('Ukončí trvalý chod v hornej úvrati.', 'Ends continuous running at top dead centre.'),
        action: stopPress,
      },
      bStop,
    );
    ctrl.reg(
      {
        type: 'button',
        still: true,
        label: LL('Kryt nástroja', 'Tool guard'),
        hint: LL('Klik kryt sklopí alebo zdvihne.', 'Click to lower or raise the guard.'),
        action: () => push('guard', !c.guard),
      },
      guardPiv,
    );
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
            push('motor', false);
            stopPress();
          }
        },
        read: () => (c.power ? 'I' : '0'),
      },
      mainSw,
    );
    ctrl.reg(
      {
        type: 'lever',
        angles: [0.6, -0.6],
        minR: 0.15,
        label: LL('Volič režimu', 'Mode selector'),
        hint: LL('Vľavo jednotlivý zdvih, vpravo trvalý chod.', 'Left single stroke, right continuous.'),
        getIdx: () => (c.mode === 'cont' ? 1 : 0),
        onSet: (i) => push('mode', i ? 'cont' : 'single'),
        read: () => (c.mode === 'cont' ? L('trvalý chod', 'continuous') : L('jednotlivý zdvih', 'single stroke')),
      },
      modeLev,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.3,
        inc: 1,
        label: LL('Prestavenie baranidla', 'Ram adjustment'),
        hint: LL(
          'V smere hodinových ručičiek baranidlo nižšie. 1 otáčka = 1 mm.',
          'Clockwise lowers the ram. 1 turn = 1 mm.',
        ),
        guard: () => {
          if (atTop()) return true;
          say(L('Baranidlo sa prestavuje len v hornej úvrati.', 'The ram is adjusted only at top dead centre.'));
          return false;
        },
        turn: (d) => push('adj', clamp(Math.round((c.adj + d / TAU) * 10) / 10, 0, 80)),
        read: () => `${L('prestavenie', 'adjust')} ${c.adj.toFixed(1)} mm`,
      },
      nut,
    );
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf,
      fwA = 0;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      t += dt;
      wi.update(dt);
      if (c.unclamped) {
        ctrl.update(dt);
        insp.update(t, c);
        renderer.render(scene, camera);
        return;
      }

      if (!c.power && c.motor) push('motor', false);
      st.fw = approach(st.fw, c.motor && c.power ? 1 : 0, (c.motor ? 0.35 : 0.12) * dt);
      fwA += st.fw * 6 * dt;
      hub.rotation.x = fwA;
      // zmeny nastavení len v hornej úvrati
      if (Math.abs(c.adj - st.adj) > 1e-9) {
        if (atTop()) {
          st.adj = c.adj;
          flags.adj = false;
        } else
          sayOnce(
            'adj',
            true,
            L('Baranidlo sa prestaví až v hornej úvrati.', 'The ram is adjusted only at top dead centre.'),
            'info',
          );
      }
      if (c.d !== st.d) {
        if (!st.broken && (c.motor || st.fw > 0.05)) {
          sayOnce(
            'dchg',
            true,
            L(
              'Nástroj sa mení len pri vypnutom motore – vypni motor a počkaj, kým zotrvačník zastane.',
              'The tool is changed only with the motor off – switch it off and wait until the flywheel stops.',
            ),
          );
          c.d = st.d;
          pend.d = st.d;
        } else if (!st.run) {
          st.d = c.d;
          st.broken = false;
          flags.dchg = false;
        }
      }
      // posuv pásu – len keď razník nie je v páse
      const xT = clamp(c.feed, 0, st.sheet.L);
      if (Math.abs(xT - st.x) > 1e-9) {
        if (tipY() < YD + st.sheet.t / 100 + 0.01) {
          sayOnce(
            'feed',
            true,
            L(
              'Razník je v páse – pás sa posúva len v hornej úvrati.',
              'The punch is in the strip – the strip moves only at top dead centre.',
            ),
          );
          c.feed = st.x;
          pend.feed = st.x;
        } else {
          flags.feed = false;
          st.x = approach(st.x, xT, 400 * dt);
        }
      }
      // zdvih
      if (st.run) {
        const w = (PRESS.spm / 60) * TAU * (0.6 + 0.4 * st.fw);
        const p0 = st.phi;
        let p1 = p0 + w * dt;
        if (!st.hit && p0 < Math.PI && p1 >= Math.PI) {
          st.hit = true;
          const r = strokeResult({ d: st.d, t: st.sheet.t, adj: st.adj, x: st.x, L: st.sheet.L });
          st.F = r.F || 0;
          if (r.kind === 'overload') {
            st.overloads++;
            st.jam = true;
            st.run = false;
            st.cont = false;
            push('motor', false);
            const tipC = YD + st.sheet.t / 100,
              S = c.stroke / 100,
              pen0 = penetration(st.adj) / 100;
            p1 = Math.acos(clamp((tipC - YD + pen0) / (S / 2) - 1, -1, 1));
            say(
              L(
                `Preťaženie: dierovanie Ø${st.d} do ${st.sheet.t} mm potrebuje ${Math.round(r.F)} kN, lis má ${PRESS.Fmax} kN. Lis sa zasekol – vypni motor a uvoľni ho spätným chodom.`,
                `Overload: punching Ø${st.d} in ${st.sheet.t} mm needs ${Math.round(r.F)} kN, the press has ${PRESS.Fmax} kN. The press jammed – switch the motor off and release it by reverse.`,
              ),
              'danger',
            );
          } else if (r.kind === 'crash') {
            st.crashes++;
            st.broken = true;
            st.cont = false;
            say(
              L(
                `Razník sa zanoril ${r.pen.toFixed(1)} mm do matrice a narazil – je zlomený. Baranidlo prestav vyššie a vymeň nástroj.`,
                `The punch entered the die by ${r.pen.toFixed(1)} mm and crashed – it is broken. Raise the ram and replace the tool.`,
              ),
              'danger',
            );
          } else if (r.kind === 'air')
            say(
              L(
                `Razník nedosiahol pás (chýba ${(-r.pen - st.sheet.t).toFixed(1)} mm) – baranidlo spusti nižšie.`,
                `The punch did not reach the strip (${(-r.pen - st.sheet.t).toFixed(1)} mm short) – lower the ram.`,
              ),
              'info',
            );
          else if (r.kind === 'miss') say(L('Pod razníkom nie je pás.', 'There is no strip under the punch.'), 'info');
          else {
            addHole(st.holes, {
              x: Math.round(st.x * 10) / 10,
              d: st.d,
              t: st.sheet.t,
              kind: r.kind,
              edge: r.edge,
              depth: r.depth,
            });
            showHoles();
            if (r.kind === 'through') {
              slugs.spawn(v3(0, 6.6, 3.2), v3((Math.random() - 0.5) * 0.6, 0.4, 2.2), 4, 14, 6);
              say(
                r.edge
                  ? L(
                      'Strih na okraji pásu – razník je zaťažený jednostranne, výstrižok je neúplný.',
                      'Cut at the strip edge – the punch is loaded on one side, the blank is incomplete.',
                    )
                  : L(
                      `Prestrihnuté Ø${st.d} na x = ${st.x.toFixed(1)} mm, sila ${Math.round(r.F)} kN.`,
                      `Punched Ø${st.d} at x = ${st.x.toFixed(1)} mm, force ${Math.round(r.F)} kN.`,
                    ),
                r.edge ? 'warn' : 'info',
              );
            } else
              say(
                L(
                  `Razník plech len vtlačil (zanorenie ${r.pen.toFixed(1)} mm) – baranidlo spusti nižšie, aspoň ${PRESS.penMin} mm pod čelo matrice.`,
                  `The punch only dented the sheet (entry ${r.pen.toFixed(1)} mm) – lower the ram, at least ${PRESS.penMin} mm below the die face.`,
                ),
                'warn',
              );
          }
          st.fw = Math.max(0.6, st.fw - (st.F / PRESS.Fmax) * 0.25);
        }
        if (!st.jam) {
          if (p1 >= TAU) {
            if (st.cont && c.mode === 'cont' && c.motor) {
              p1 -= TAU;
              st.hit = false;
            } else {
              p1 = 0;
              st.run = false;
            }
          }
          st.phi = p1;
        } else st.phi = p1;
      }
      // vzhľad
      const pr = st.d / 200;
      punchM.scale.set(pr, 1, pr);
      punchM.visible = !st.broken;
      dieHole.scale.set(pr * 1.02, 1, pr * 1.02);
      ramG.position.set(0, tipY(), 0);
      nut.rotation.z = -st.adj * TAU;
      pasG.position.x = -st.x / 100;
      guardPiv.rotation.x = c.guard ? 0 : -1.25;
      pedal.rotation.x = st.run && st.phi < 0.6 ? 0.18 : 0;
      lampRun.emissive.setHex(c.motor ? 0x22dd55 : 0);
      lampOn.emissive.setHex(c.power ? 0xffb020 : 0);
      slugs.update(dt, () => 0.02);
      ctrl.update(dt);
      insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        setTele({
          fw: st.fw,
          phi: st.phi,
          F: punchForce(st.d, st.sheet.t),
          pen: penetration(c.adj),
          holes: st.holes.length,
          jam: st.jam,
          broken: st.broken,
          running: st.run,
          x: st.x,
          msg: st.msg && st.msg.until > t ? st.msg : null,
        });
        if (Object.keys(pend).length) {
          const q = { ...pend };
          Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...q }));
        }
      }
      snd.update({ motor: st.fw * 0.5, cut: st.run && Math.abs(st.phi - Math.PI) < 0.25 ? 1 : 0 });
      renderer.render(scene, camera);
    };
    try {
      if (/[?&]debug/.test(window.location.search)) window.__press = { st, c, pedal: pedalPress };
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
      holeGeo.dispose();
      try {
        if (window.__press && window.__press.st === st) delete window.__press;
      } catch (err) {
        /* ignorované */
      }
      disposeStage();
    };
  }, []);

  const parts = pressParts();
  const m = apiRef.current.measure ? apiRef.current.measure() : null;
  const fmt = (x, d = 0) => L(x.toFixed(d).replace('.', ','), x.toFixed(d));
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.jam
        ? { kind: 'danger', text: L('Lis je zaseknutý v dolnej úvrati.', 'The press is jammed at bottom dead centre.') }
        : tele.running
          ? { kind: 'run', text: L('Zdvih baranidla.', 'Ram stroke.') }
          : !ui.motor
            ? {
                kind: 'idle',
                text: L('Zapni motor a nechaj rozbehnúť zotrvačník.', 'Start the motor and let the flywheel run up.'),
              }
            : tele.fw < 0.9
              ? { kind: 'run', text: L('Zotrvačník sa rozbieha…', 'The flywheel is running up…') }
              : {
                  kind: 'idle',
                  text: L(
                    'Nastav pás pod razník, sklop kryt a stlač pedál.',
                    'Set the strip under the punch, lower the guard and press the pedal.',
                  ),
                };
  const chips = [
    {
      color: ui.motor ? '#3ee06c' : '#8b8f89',
      text: ui.motor ? `${L('Zotrvačník', 'Flywheel')} ${Math.round(tele.fw * 100)} %` : L('Motor stojí', 'Motor off'),
    },
    {
      color: ui.guard ? '#3ee06c' : '#ff8a1f',
      text: ui.guard ? L('Kryt dole', 'Guard down') : L('Kryt hore', 'Guard up'),
    },
  ];
  const setupTask = (task) => {
    if (tele.running) return;
    Object.entries(task.setup).forEach(([k, v]) => set(k, v));
    setTimeout(() => {
      if (apiRef.current.newBlank) apiRef.current.newBlank();
    }, 300);
  };
  const F = tele.F;

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
            'Sila strihu F = π · d · t · 0,8 · Rm – pred zdvihom ju porovnaj s 400 kN lisu.',
            'Cutting force F = π · d · t · 0.8 · Rm – compare it with the 400 kN of the press before the stroke.',
          ),
          L(
            'Baranidlo spúšťaj po malých krokoch skúšobnými zdvihmi; razník má zájsť 0,5 – 6 mm pod čelo matrice.',
            'Lower the ram in small steps with trial strokes; the punch should go 0.5 – 6 mm below the die face.',
          ),
          L(
            'Mostík medzi výstrižkami aspoň hrúbka plechu, inak sa okraj roztrhne.',
            'The web between blanks is at least the sheet thickness, otherwise the edge tears.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · výstredníkový lis', 'Simulator · eccentric press')}
            title={L('Výstredníkový lis', 'Eccentric press')}
            sub={L(
              'Predloha: TOMA LEN 40C – lis s C-stojanom, 400 kN, zotrvačník s jednootáčkovou spojkou, zdvih 10 – 80 mm, pedál a kryt nástroja. Rozmery sú orientačné.',
              'Modelled after the TOMA LEN 40C – C-frame press, 400 kN, flywheel with a single-revolution clutch, 10 – 80 mm stroke, foot pedal and tool guard. Dimensions are approximate.',
            )}
            rows={[
              [L('Zdvih mm', 'Stroke mm'), String(ui.stroke)],
              [L('Sila kN', 'Force kN'), F.toFixed(0)],
              [L('Diery', 'Holes'), String(tele.holes)],
            ]}
            foot={[`${ui.t} × ${ui.W} × ${ui.len} mm`, `Ø${ui.d}`]}
            status={statusMsg}
          />

          <TaskSection
            machine="lis"
            tasks={PRESS_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'motor', items: PRESS_SAFETY() }}
          />

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Chod lisu', 'Press operation')}</h2>
            <button
              type="button"
              className="btn-run start"
              onClick={() => apiRef.current.pedal && apiRef.current.pedal()}
            >
              {L('▼ Pedál – zdvih', '▼ Pedal – stroke')}
            </button>
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn" onClick={() => apiRef.current.stop && apiRef.current.stop()}>
                {L('STOP zdvihu', 'Stroke STOP')}
              </button>
              {tele.jam && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => apiRef.current.release && apiRef.current.release()}
                >
                  {L('Spätný chod – uvoľniť', 'Reverse – release')}
                </button>
              )}
            </div>
            <div className="mt-2">
              <Toggle
                on={ui.power}
                label={L('Hlavný vypínač', 'Main switch')}
                onClick={() => {
                  set('power', !ui.power);
                  if (ui.power) set('motor', false);
                }}
              />
              <Toggle
                on={ui.motor}
                label={L('Motor a zotrvačník', 'Motor and flywheel')}
                onClick={() => {
                  if (!ui.motor && !ui.power) set('power', true);
                  set('motor', !ui.motor);
                }}
              />
              <Toggle
                on={ui.guard}
                label={L('Kryt nástroja sklopený', 'Tool guard lowered')}
                onClick={() => set('guard', !ui.guard)}
              />
            </div>
            <SegRow
              label={L('Režim', 'Mode')}
              value={ui.mode}
              options={[
                ['single', L('Jednotlivý', 'Single')],
                ['cont', L('Trvalý', 'Continuous')],
              ]}
              onChange={(v) => set('mode', v)}
            />
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Nástroj a baranidlo', 'Tool and ram')}</h2>
            <SegRow
              label={L('Razník Ø', 'Punch Ø')}
              value={ui.d}
              options={PRESS_PUNCHES.map((x) => [x, String(x)])}
              onChange={(v) => set('d', v)}
            />
            {tele.broken && (
              <button
                type="button"
                className="btn mb-2"
                onClick={() => apiRef.current.newPunch && apiRef.current.newPunch()}
              >
                {L('Vymeniť razník', 'Replace the punch')}
              </button>
            )}
            <SegRow
              label={L('Zdvih mm', 'Stroke mm')}
              value={ui.stroke}
              options={PRESS_STROKES.map((x) => [x, String(x)])}
              onChange={(v) => {
                if (!tele.running && !tele.jam) set('stroke', v);
              }}
            />
            <Slider
              id="pa"
              label={L('Prestavenie baranidla', 'Ram adjustment')}
              unit="mm"
              min={0}
              max={80}
              step={0.1}
              value={ui.adj}
              digits={1}
              onChange={(v) => set('adj', v)}
            />
            <div className="flex flex-wrap gap-2 mb-2">
              {[-5, -1, -0.5, 0.5, 1, 5].map((x) => (
                <button
                  key={x}
                  type="button"
                  className="btn"
                  onClick={() => set('adj', clamp(Math.round((ui.adj + x) * 10) / 10, 0, 80))}
                >
                  {x > 0 ? '+' : ''}
                  {fmt(x, x % 1 ? 1 : 0)}
                </button>
              ))}
            </div>
            <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
              <div>
                {L('Razník v dolnej úvrati', 'Punch at bottom dead centre')}:{' '}
                <b>
                  {tele.pen >= 0
                    ? `${fmt(tele.pen, 1)} mm ${L('pod čelom matrice', 'below the die face')}`
                    : `${fmt(-tele.pen, 1)} mm ${L('nad matricou', 'above the die')}`}
                </b>
              </div>
              <div>
                {L('Potrebná sila', 'Required force')}:{' '}
                <b style={{ color: F > PRESS.Fmax ? 'var(--c-danger, #ff6b5b)' : undefined }}>{fmt(F)} kN</b> /{' '}
                {PRESS.Fmax} kN
              </div>
            </div>
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Posuv pásu', 'Strip feed')}</h2>
            <Slider
              id="pf"
              label={L('Poloha razníka od ľavého konca', 'Punch position from the left end')}
              unit="mm"
              min={0}
              max={ui.len}
              step={0.1}
              value={ui.feed}
              actual={tele.x}
              digits={1}
              onChange={(v) => set('feed', v)}
            />
            <div className="flex flex-wrap gap-2 mb-2">
              {[-10, -1, -0.1, 0.1, 1, 10, 50, 56].map((x) => (
                <button
                  key={x}
                  type="button"
                  className="btn"
                  onClick={() => set('feed', clamp(Math.round((ui.feed + x) * 10) / 10, 0, ui.len))}
                >
                  {x > 0 ? '+' : ''}
                  {fmt(x, x % 1 ? 1 : 0)}
                </button>
              ))}
            </div>
            {m && m.holes.length ? (
              <table className="text-xs tnum w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="muted">
                    <th className="text-left font-semibold">#</th>
                    <th className="text-right font-semibold">x mm</th>
                    <th className="text-right font-semibold">Ø</th>
                    <th className="text-right font-semibold">{L('stav', 'state')}</th>
                  </tr>
                </thead>
                <tbody>
                  {m.holes
                    .slice()
                    .sort((a, b) => a.x - b.x)
                    .map((h, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td className="text-right">{h.x.toFixed(1)}</td>
                        <td className="text-right">{h.d}</td>
                        <td className="text-right">
                          {h.through ? (h.edge ? L('okraj', 'edge') : L('naskrz', 'through')) : L('vtlačené', 'dent')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs muted">{L('V páse zatiaľ nie je žiadna diera.', 'No holes in the strip yet.')}</p>
            )}
          </div>

          <BlankSection
            onApply={() => apiRef.current.newBlank && apiRef.current.newBlank()}
            applyLabel={L('Vložiť nový pás', 'Load a new strip')}
            note={L('Oceľ S235, Rm ≈ 440 MPa.', 'S235 steel, Rm ≈ 440 MPa.')}
          >
            <SegRow
              label={L('Hrúbka mm', 'Thickness mm')}
              value={ui.t}
              options={[1, 2, 3, 4, 5, 6, 8, 10].map((x) => [x, String(x)])}
              onChange={(v) => set('t', v)}
            />
            <Slider
              id="pw"
              label={L('Šírka pásu', 'Strip width')}
              unit="mm"
              min={30}
              max={200}
              step={5}
              value={ui.W}
              onChange={(v) => set('W', v)}
            />
            <Slider
              id="pl"
              label={L('Dĺžka pásu', 'Strip length')}
              unit="mm"
              min={100}
              max={1000}
              step={10}
              value={ui.len}
              onChange={(v) => set('len', v)}
            />
          </BlankSection>

          <ExportSection machine="lis" apiRef={apiRef} canStl={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['nastroj', L('Nástroj', 'Tool')],
              ['bok', L('Zboku', 'Side')],
              ['rozvadzac', L('Rozvádzač', 'Cabinet')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

export { PressSimulator };
export default PressSimulator;
