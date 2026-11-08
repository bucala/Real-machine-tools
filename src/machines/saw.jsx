import { SectionInfo } from '../ui/sectionInfo';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, makeKit, mkTex, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { exportStl } from '../core/export';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection } from '../ui/tools';
import { sawChecks } from './shopMath';
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
// STROJNÁ PÁSOVÁ PÍLA TOS PPN
// =====================================================================
const SAW = { TT: 9.6, R: 3.6, WX: -3.6, UY: 15.6, LY: 4.6, KERF: 0.024 }; // výška stola, polomer kolies, os kolies, rez 1,4 mm
const SAW_SPEEDS = [3, 10, 25]; // rýchlosť pásu v m/s (stupne remenice)
const SAW_MATS = {
  wood: { sk: 'Drevo', en: 'Wood', col: 0xc89b5f, chip: 0xd9b47c, v: 0.7, maxSpeed: 99 },
  alu: { sk: 'Hliník', en: 'Aluminium', col: 0xc9cdd1, chip: 0xd5d9dd, v: 0.12, maxSpeed: 10 },
  steel: { sk: 'Oceľ', en: 'Steel', col: 0x7f868d, chip: 0xa0a7ae, v: 0.035, maxSpeed: 3 },
};
const sawParts = () =>
  mkParts([
    [
      'podstavec',
      'Podstavec',
      'Base',
      'Podstavec s nohami',
      'Base with feet',
      'Liatinový podstavec s dvoma pätkami nesie celý stroj. Vnútri je dolné hnacie koleso, vzadu motor s remeňovým prevodom.',
      'Cast-iron base on two feet carrying the whole machine. It houses the lower drive wheel; the motor with the belt drive is at the back.',
    ],
    [
      'ram',
      'Rameno',
      'Frame',
      'Rameno (stojan)',
      'Frame (column)',
      'Oblúkové liatinové rameno spája dolnú a hornú časť. Jeho vyloženie určuje, aký široký obrobok sa zmestí medzi pás a rameno.',
      'The curved cast-iron frame joins the lower and upper parts. Its throat depth sets how wide a workpiece fits between the blade and the frame.',
    ],
    [
      'kolesa',
      'Kolesá a kryty',
      'Wheels & covers',
      'Kolesá pásu a kryty',
      'Band wheels and covers',
      'Dve kolesá Ø720 mm s gumovou bandážou vedú nekonečný pás. Horné koleso sa napína ručným kolesom navrchu, dolné je poháňané. Kryty chránia obsluhu.',
      'Two Ø720 mm rubber-tyred wheels carry the endless band. The upper wheel is tensioned by the handwheel on top, the lower one is driven. Covers protect the operator.',
    ],
    [
      'pas',
      'Pílový pás',
      'Saw blade',
      'Pílový pás',
      'Band saw blade',
      'Oceľový pás so zubami smerom k obsluhe. Reže smerom nadol; rýchlosť pásu sa volí podľa materiálu – drevo rýchlo, kov pomaly.',
      'Steel band with the teeth facing the operator. It cuts downwards; the band speed is chosen by material – wood fast, metal slow.',
    ],
    [
      'vodidlo',
      'Horné vodidlo',
      'Upper guide',
      'Horné vedenie pásu s krytom',
      'Upper blade guide and guard',
      'Vedenie s kladkami drží pás pri reze. Nastavuje sa hviezdicovým kolieskom čo najbližšie nad obrobok, kryt zakrýva zvyšok pásu.',
      'The roller guide steadies the blade in the cut. It is set with the star knob as close above the work as possible; the guard covers the rest of the blade.',
    ],
    [
      'stol',
      'Stôl',
      'Table',
      'Pracovný stôl',
      'Work table',
      'Liatinový stôl 660 × 600 mm s drážkou pre pás. Obrobok sa po ňom posúva k pásu rukou alebo posuvom.',
      'Cast-iron 660 × 600 mm table with a slot for the blade. The work is pushed along it to the blade by hand or by the feed.',
    ],
    [
      'motor',
      'Motor',
      'Motor',
      'Elektromotor s remeňom',
      'Motor and belt drive',
      'Motor poháňa dolné koleso cez stupňovitú remenicu – tri rýchlosti pásu 3, 10 a 25 m/s. Prestavuje sa len pri stojacom stroji.',
      'The motor drives the lower wheel through a stepped pulley – three band speeds 3, 10 and 25 m/s. It may only be changed with the machine stopped.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Obrobok',
      'Workpiece',
      'Doska alebo platňa zvoleného materiálu a rozmeru. Posúva sa proti pásu; prerezaná časť sa po dorezaní oddelí.',
      'Board or plate of the selected material and size. It is fed against the blade; the cut-off part separates when the cut is complete.',
    ],
    [
      'rozvadzac',
      'Vypínač',
      'Switch box',
      'Vypínač a tlačidlá',
      'Switch and buttons',
      'Hlavný vypínač a tlačidlá Štart a Stop na ramene stroja.',
      'Main switch and the Start and Stop buttons on the machine frame.',
    ],
  ]);

const SAW_TASKS = [
  {
    id: 'pas',
    title: () => L('Pás 40 mm z drevenej dosky', 'A 40 mm strip from a wooden board'),
    desc: () =>
      L(
        'Drevená doska 400 × 160 × 40 mm, rez 40 mm od ľavej hrany. Nastav rýchlosť pásu vhodnú pre drevo, napni pás aspoň na 70 %, horné vodidlo spusti najviac 20 mm nad dosku a dosku prerež rovnomerným posuvom.',
        'Wooden board 400 × 160 × 40 mm, cut 40 mm from the left edge. Set the blade speed suitable for wood, tension the blade to at least 70 %, lower the upper guide to at most 20 mm above the board and cut through with a steady feed.',
      ),
    setup: { bMat: 'wood', bL: 400, bW: 160, bT: 40, cutX: 40 },
    labels: {
      offcut: () => L('Šírka pásu 40 mm', 'Strip width 40 mm'),
      speed: () => L('Rýchlosť pásu pre drevo (25 m/s)', 'Blade speed for wood (25 m/s)'),
      tension: () => L('Napnutie pásu ≥ 70 %', 'Blade tension ≥ 70 %'),
      guide: () => L('Vodidlo pri reze najviac 20 mm nad doskou', 'Guide at most 20 mm above the board while cutting'),
      split: () => L('Doska prerezaná', 'Board cut through'),
    },
  },
].map((t) => ({ ...t, checks: (m) => sawChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const SAW_SAFETY = () => [
  L(
    'Pás je napnutý a horné vodidlo je spustené tesne nad obrobok.',
    'The blade is tensioned and the upper guide is lowered just above the workpiece.',
  ),
  L(
    'Úzke kusy posúvam posúvadlom, prsty držím mimo línie rezu.',
    'I feed narrow pieces with a push stick and keep my fingers out of the cutting line.',
  ),
  L('Mám ochranné okuliare a chrániče sluchu, bez rukavíc.', 'I wear safety glasses and ear protection, no gloves.'),
];
const SAW_REC = { wood: 25, alu: 10, steel: 3 };

function BandSawSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    running: false,
    power: true,
    manual: false,
    speed: 2,
    tension: 80,
    guide: 80,
    feed: 0,
    autoFeed: false,
    feedRate: 20,
    bMat: 'wood',
    bL: 400,
    bW: 160,
    bT: 40,
    cutX: 50,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ v: 0, feed: 0, cut: 0, msg: null, cutting: false, split: false, tension: 80 });

  useEffect(() => {
    const mount = mountRef.current,
      layer = layerRef.current,
      tipEl = tipRef.current;
    const c = ctl.current;
    const { TT, R, WX, UY, LY, KERF } = SAW;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('saw');
    const dom = renderer.domElement;
    const bladeTex = mkTex(
      16,
      128,
      (g, w, h) => {
        g.fillStyle = '#c9cfd4';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#4b5258';
        for (let y = 0; y < h; y += 8) {
          g.beginPath();
          g.moveTo(w, y);
          g.lineTo(w - 6, y + 2);
          g.lineTo(w, y + 8);
          g.fill();
        }
      },
      1,
      6,
    );
    const M = {
      ...baseMats(0x2f78bd, 0x23649f, 0x1b4f80),
      table: std(0x8a8f93, 0.55, 0.55),
      rubber: std(0x222326, 0.9, 0),
      blade: std(0xffffff, 0.3, 0.85, { map: bladeTex }),
      work: std(SAW_MATS.wood.col, 0.75, 0.0),
      chip: std(SAW_MATS.wood.chip, 0.8, 0),
      kerf: std(0x1a1712, 0.9, 0),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, pivotLever, detents, handwheel } = kit;
    const root = new THREE.Group();
    scene.add(root);
    apiRef.current.machineModel = { root, name: L('Pásová píla', 'Band saw') };
    const G = {};
    const grp = (k, parent = root) => {
      const g = new THREE.Group();
      g.userData.part = k;
      parent.add(g);
      G[k] = g;
      return g;
    };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- podstavec a rameno ----------
    const base = grp('podstavec');
    [
      [-6.2, -5.0],
      [-1.3, 0.1],
    ].forEach(([x0, x1]) => {
      box(base, x0 - 0.3, x1 + 0.3, 0, 0.18, -1.6, 1.4, M.greenDark);
      box(base, x0, x1, 0.18, 0.75, -1.2, 1.0, M.green);
    });
    box(base, -6.4, -0.6, 0.75, 1.3, -1.25, 0.55, M.green);
    const frame = grp('ram');
    const arc = new THREE.Shape();
    arc.moveTo(-6.0, 0.9);
    arc.lineTo(-5.0, 0.9);
    arc.quadraticCurveTo(-7.0, 10.1, -5.0, 19.0);
    arc.lineTo(-6.2, 19.0);
    arc.quadraticCurveTo(-8.4, 10.1, -6.0, 0.9);
    add(
      frame,
      new THREE.ExtrudeGeometry(arc, {
        depth: 0.9,
        bevelEnabled: true,
        bevelSize: 0.08,
        bevelThickness: 0.08,
        bevelSegments: 2,
      }),
      M.green,
      0,
      0,
      -1.65,
    );
    box(frame, -6.0, -2.2, 8.55, 9.3, -1.6, -0.7, M.green); // konzola stola
    box(frame, -1.0, 1.0, 8.75, 9.3, -1.2, 0.8, M.greenDark); // čap stola

    // ---------- kolesá a kryty ----------
    const wh = grp('kolesa');
    const wheels = [UY, LY].map((y) => {
      const g = new THREE.Group();
      g.position.set(WX, y, -0.05);
      wh.add(g);
      cylZ(g, R, R, -0.14, 0.14, 0, 0, M.rubber, 64);
      cylZ(g, R - 0.12, R - 0.12, -0.16, 0.16, 0, 0, M.steelDark, 48);
      for (let k = 0; k < 6; k++) {
        const s = add(g, new THREE.BoxGeometry(R * 1.8, 0.16, 0.08), M.steelDark);
        s.rotation.z = (k * Math.PI) / 6;
      }
      return g;
    });
    [UY, LY].forEach((y, i) => {
      cylZ(wh, R + 0.25, R + 0.25, -0.65, -0.25, WX, y, M.green, 64);
      const front = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.25, R + 0.25, 0.35, 64, 1, false), M.green);
      front.geometry.rotateX(Math.PI / 2);
      front.position.set(WX, y, 0.38);
      front.castShadow = true;
      front.receiveShadow = true;
      wh.add(front);
      add(wh, new THREE.TorusGeometry(R + 0.25, 0.06, 8, 64), M.greenDark, WX, y, 0.56);
      const hump = add(
        wh,
        new THREE.SphereGeometry(0.5, 20, 10, 0, TAU, 0, Math.PI / 2),
        M.greenDark,
        WX,
        y + 0.3,
        0.55,
      );
      hump.rotation.x = Math.PI / 2;
      hump.scale.set(1, 0.5, 1);
      if (i === 0)
        add(wh, new THREE.TorusGeometry(0.45, 0.025, 6, 24, Math.PI * 0.7), M.red, WX + 0.2, y + R - 0.2, 0.57);
    });
    // napínanie horného kolesa – ručné koleso navrchu
    cylY(wh, 0.09, 0.09, UY + R + 0.25, UY + R + 0.9, WX, -0.1, M.steel, 12);
    const tens = new THREE.Group();
    tens.position.set(WX, UY + R + 0.9, -0.1);
    tens.rotation.x = -Math.PI / 2;
    wh.add(tens);
    const wheelTension = handwheel(tens, 0.55, 0, 0, 0, 'z', 0.35);

    // ---------- pílový pás (viditeľný úsek medzi krytmi) ----------
    const bandG = grp('pas');
    const yB0 = LY + R + 0.25,
      yB1 = UY - R - 0.25;
    add(bandG, new THREE.BoxGeometry(0.012, yB1 - yB0, 0.2), M.blade, 0, (yB0 + yB1) / 2, 0.0);
    bladeTex.repeat.set(1, (yB1 - yB0) / 0.5);

    // ---------- stôl ----------
    const tbl = grp('stol');
    box(tbl, -3.2, 3.4, TT - 0.3, TT, -3.0, 3.0, M.table);
    box(tbl, -3.25, 3.45, TT - 0.45, TT - 0.3, -3.05, 3.05, M.green);
    box(tbl, -KERF, KERF, TT - 0.002, TT + 0.003, 0.15, 3.0, M.kerf); // drážka k pásu
    cylY(tbl, 0.32, 0.32, TT - 0.005, TT + 0.001, 0, 0, M.black, 32); // vložka stola

    // ---------- horné vodidlo s krytom ----------
    const guideG = grp('vodidlo');
    box(guideG, -0.25, 0.45, 12.2, 13.0, -0.75, -0.25, M.green); // držiak na hornom kryte
    const post = new THREE.Group();
    guideG.add(post);
    box(post, 0.05, 0.25, 0, 5.2, -0.5, -0.32, M.steelDark); // tyč vodidla s ozubením
    box(post, -0.22, 0.22, 0, 0.32, -0.38, 0.12, M.steelDark); // blok vedenia
    [-0.04, 0.04].forEach((x) => cylZ(post, 0.06, 0.06, -0.12, 0.08, x * 2.2, 0.16, M.steel, 14));
    box(post, -0.1, 0.1, 0.32, 3.4, 0.12, 0.22, M.green); // kryt pásu
    box(post, -0.1, -0.06, 0.32, 3.4, -0.2, 0.12, M.green);
    const knobG = new THREE.Group();
    knobG.position.set(0.45, 12.6, -0.5);
    guideG.add(knobG);
    cylX(knobG, 0.05, 0.05, 0, 0.18, 0, 0, M.steel, 10);
    const knob = new THREE.Group();
    knob.position.set(0.22, 0, 0);
    knob.rotation.y = Math.PI / 2;
    knobG.add(knob);
    cylZ(knob, 0.08, 0.08, -0.05, 0.05, 0, 0, M.black, 16);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ball(knob, 0.06, Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0, M.black);
      const s = add(knob, new THREE.BoxGeometry(0.18, 0.06, 0.06), M.black, Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0);
      s.rotation.z = a;
    }
    hitProxy(knob, 0.28, 0, 0, 0);

    // ---------- motor a remeňový kryt ----------
    const mot = grp('motor');
    cylX(mot, 0.62, 0.62, 0.6, 2.2, 1.7, -1.25, M.green, 32);
    cylX(mot, 0.55, 0.5, 2.2, 2.45, 1.7, -1.25, M.greenDark, 28);
    for (let k = 0; k < 10; k++) {
      const a = (k * TAU) / 10;
      const f = add(
        mot,
        new THREE.BoxGeometry(1.4, 0.08, 0.05),
        M.green,
        1.4,
        1.7 + Math.sin(a) * 0.64,
        -1.25 + Math.cos(a) * 0.64,
      );
      f.rotation.x = -a;
    }
    const belt = new THREE.Group();
    belt.position.set(0, 0, 0.7);
    mot.add(belt);
    box(belt, -2.4, 1.0, 1.0, 2.4, -0.12, 0.18, M.green);
    cylZ(belt, 0.7, 0.7, -0.12, 0.18, -2.4, 1.7, M.green, 32);
    cylZ(belt, 0.7, 0.7, -0.12, 0.18, 1.0, 1.7, M.green, 32);
    cylZ(belt, 0.2, 0.17, 0.18, 0.3, 1.0, 1.7, M.black, 20);
    detents(belt, 1.0, 1.7, 0.3, 0.14, [0.6, 0, -0.6], 0.022);
    const levSpeed = pivotLever(belt, 1.0, 1.7, 0.3, 0.45, 1.2);

    // ---------- vypínač na ramene ----------
    const sw = grp('rozvadzac');
    box(sw, -6.6, -5.7, 6.6, 8.2, 0.55, 0.85, M.panel);
    const pbtn = (y, m) => {
      const g = new THREE.Group();
      g.position.set(-6.15, y, 0.85);
      sw.add(g);
      cylZ(g, 0.12, 0.12, 0, 0.08, 0, 0, m, 20);
      hitProxy(g, 0.17, 0, 0, 0.06);
      return g;
    };
    const btnStart = pbtn(7.2, M.btnGreen),
      btnStop = pbtn(6.85, M.red);
    box(sw, -6.5, -5.8, 7.45, 8.1, 0.85, 0.86, M.yellow);
    const mainSwitch = new THREE.Group();
    mainSwitch.position.set(-6.15, 7.77, 0.86);
    sw.add(mainSwitch);
    cylZ(mainSwitch, 0.2, 0.2, 0, 0.06, 0, 0, M.black, 24);
    box(mainSwitch, -0.26, 0.26, -0.05, 0.05, 0.06, 0.18, M.red);
    ball(sw, 0.06, -5.85, 8.05, 0.87, M.lamp);
    cylY(sw, 0.05, 0.05, 1.3, 6.6, -6.4, 0.7, M.black, 10);

    // ---------- obrobok: dve časti spojené ešte nerozrezaným mostíkom ----------
    const wk = { mat: 'wood', Lp: 4.0, W: 1.6, T: 0.4, cx: 0.5 };
    const pieceG = grp('obrobok');
    pieceG.position.y = TT;
    const partL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.work),
      partR = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.work),
      bridge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.work);
    [partL, partR, bridge].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
      pieceG.add(m);
    });
    const leftG = new THREE.Group();
    pieceG.add(leftG);
    leftG.add(partL);
    const layout = () => {
      const k = KERF / 2;
      partL.scale.set(wk.cx - k, wk.T, wk.Lp);
      partL.position.set(-(wk.cx + k) / 2, wk.T / 2, wk.Lp / 2);
      partR.scale.set(wk.W - wk.cx - k, wk.T, wk.Lp);
      partR.position.set((wk.W - wk.cx + k) / 2, wk.T / 2, wk.Lp / 2);
      const bl = Math.max(0.0001, wk.Lp - st.cutMax);
      bridge.scale.set(KERF * 1.02, wk.T, bl);
      bridge.position.set(0, wk.T / 2, st.cutMax + bl / 2);
      bridge.visible = st.cutMax < wk.Lp - 1e-4;
    };

    const dust = createParticles(scene, new THREE.BoxGeometry(0.035, 0.016, 0.035), M.chip, 260);

    // ---------- stav simulácie ----------
    const st = {
      v: 0,
      s: c.feed / 100,
      cutMax: 0,
      split: false,
      sepX: 0,
      tension: c.tension,
      g: c.guide / 100,
      msg: null,
      cutT: -9,
      bandOff: 0,
    };
    let t = 0,
      last = performance.now(),
      teleT = 0,
      dustAcc = 0,
      lastAuto = c.autoFeed;
    const flags = {};
    const say = (text, kind = 'warn') => {
      st.msg = { text, kind, until: t + 2.6 };
    };
    const sayOnce = (key, cond, text, kind) => {
      if (cond && !flags[key]) say(text, kind);
      flags[key] = cond;
    };
    const Z0 = 0.4; // zadná hrana obrobku pred pásom pri posuve 0
    const zb = (s = st.s) => Z0 - s;
    const cutAt = (s) => clamp(0.1 - zb(s), 0, wk.Lp);
    layout();

    // ---------- pohľady, popisy a výber dielov ----------
    const anchors = {
      podstavec: () => v3(-0.6, 1.0, 1.1),
      ram: () => v3(-7.4, 12.0, -1.2),
      kolesa: () => v3(WX, UY + R + 0.4, 0.4),
      pas: () => v3(0.1, TT + st.g + 0.9, 0.2),
      vodidlo: () => v3(0.5, TT + st.g + 3.6, -0.4),
      stol: () => v3(3.0, TT + 0.05, 2.6),
      motor: () => v3(1.6, 2.5, -1.25),
      obrobok: () => v3(wk.W - wk.cx - 0.2, TT + wk.T + 0.05, zb() + wk.Lp * 0.7),
      rozvadzac: () => v3(-6.15, 8.35, 0.85),
    };
    const views = {
      celok: () => [
        [11, 15, 21],
        [-2.5, 10, 0],
      ],
      rez: () => [[2.8, TT + 2.6, 3.8], [0, TT + 0.3, 0.3], true],
      spredu: () => [
        [-1.5, 11, 19],
        [-2, 10, 0],
      ],
      zhora: () => [
        [0.3, 22, 3.5],
        [0, TT, 0.5],
      ],
      bok: () => [
        [15, 11, 1.5],
        [-2, 9.5, 0],
      ],
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
    apiRef.current.measure = () => ({
      split: st.split,
      speed: SAW_SPEEDS[c.speed],
      recommended: SAW_REC[wk.mat],
      tension: st.tension,
      gapMax: st.gapMax || 0,
      offcut: wk.cx * 100,
    });
    apiRef.current.exportStl = () => exportStl(pieceG);
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if (c.running || c.drive || c.wheel || c.work)
        throw new Error(
          L('Najprv zastav stroj a potom exportuj obrobok.', 'Stop the machine before exporting the workpiece.'),
        );
      return exportStep(pieceG);
    };

    // ---------- polotovar ----------
    const wi = createWorkInspect({
      scene,
      camera,
      dom,
      insp,
      c,
      getObj: () => pieceG,
      getSpot: () => v3(3.4, TT + 1.6, 5.0),
      onState: (v) => {
        push('unclamped', v);
        push('manual', c.manual);
      },
    });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in' && zb() < 0.12 && st.cutMax > 0 && !st.split) {
        say(
          L(
            'Obrobok je na páse – najprv ho stiahni späť (posuv) alebo dorež.',
            'The workpiece is on the blade – pull it back (feed) or finish the cut first.',
          ),
        );
        return;
      }
      if (!wi.toggle())
        say(L('Počkaj, kým sa dokončí pohyb polotovaru.', 'Wait until the workpiece movement finishes.'), 'info');
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) {
        say(L('Najprv polož obrobok späť na stôl.', 'Put the workpiece back on the table first.'));
        return null;
      }
      wk.mat = c.bMat;
      wk.Lp = c.bL / 100;
      wk.W = c.bW / 100;
      wk.T = c.bT / 100;
      wk.cx = clamp(c.cutX, 5, c.bW - 5) / 100;
      M.work.color.setHex(SAW_MATS[wk.mat].col).convertSRGBToLinear();
      M.work.roughness = wk.mat === 'wood' ? 0.75 : 0.35;
      M.work.metalness = wk.mat === 'wood' ? 0 : 0.8;
      M.chip.color.setHex(SAW_MATS[wk.mat].chip).convertSRGBToLinear();
      st.s = 0;
      st.cutMax = 0;
      st.split = false;
      st.sepX = 0;
      st.gapMax = 0;
      c.feed = 0;
      c.autoFeed = false;
      layout();
      say(L('Na stole je nový obrobok.', 'A new workpiece is on the table.'), 'info');
      return { feed: 0, autoFeed: false };
    };

    // ---------- ručné ovládanie prvkov ----------
    const stopped = () => !c.running && st.v < 0.05;
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.4,
        inc: 1,
        label: LL('Napínanie pásu', 'Blade tension'),
        hint: LL(
          'V smere hodinových ručičiek sa horné koleso dvíha a pás napína. Pod 60 % sa stroj nespustí.',
          'Clockwise raises the upper wheel and tensions the blade. Below 60 % the machine will not start.',
        ),
        turn: (d) => push('tension', clamp(c.tension + (d * 12) / TAU, 0, 100)),
        read: () => `${Math.round(st.tension)} %`,
      },
      wheelTension,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.12,
        inc: 1,
        label: LL('Hviezdicové koliesko vodidla', 'Guide star knob'),
        hint: LL(
          'Nastaví výšku horného vodidla nad stolom. 1 otáčka = 20 mm.',
          'Sets the height of the upper guide above the table. 1 turn = 20 mm.',
        ),
        turn: (d) => push('guide', clamp(c.guide + (d * 20) / TAU, 10, 300)),
        read: () => `${(st.g * 100).toFixed(0)} mm`,
      },
      knob,
    );
    ctrl.reg(
      {
        type: 'lever',
        angles: [0.6, 0, -0.6],
        minR: 0.2,
        label: LL('Páka rýchlosti pásu', 'Blade speed lever'),
        hint: LL(
          '3 stupne remenice: 3 / 10 / 25 m/s. Len pri stojacom stroji.',
          '3 pulley steps: 3 / 10 / 25 m/s. Only with the machine stopped.',
        ),
        guard: () => {
          if (stopped()) return true;
          say(
            L(
              'Rýchlosť pásu sa mení len pri stojacom stroji.',
              'The blade speed can only be changed with the machine stopped.',
            ),
          );
          return false;
        },
        getIdx: () => c.speed,
        onSet: (i) => {
          push('speed', i);
          say(`${L('Rýchlosť pásu', 'Blade speed')} ${SAW_SPEEDS[i]} m/s.`, 'info');
        },
        read: () => `${SAW_SPEEDS[c.speed]} m/s`,
      },
      levSpeed,
    );
    ctrl.reg(
      {
        type: 'lever',
        angles: [0, -Math.PI / 2],
        minR: 0.22,
        label: LL('Hlavný vypínač', 'Main switch'),
        hint: LL('Otoč alebo klikni: 0 = vypnuté, I = zapnuté.', 'Turn or click: 0 = off, I = on.'),
        getIdx: () => (c.power ? 1 : 0),
        onSet: (i) => {
          push('power', i === 1);
          if (!i) {
            push('running', false);
            say(L('Hlavný vypínač vypnutý.', 'Main switch off.'), 'warn');
          } else say(L('Hlavný vypínač zapnutý.', 'Main switch on.'), 'info');
        },
        read: () => (c.power ? L('I – zapnuté', 'I – on') : L('0 – vypnuté', '0 – off')),
      },
      mainSwitch,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Tlačidlo ŠTART', 'START button'),
        hint: LL('Spustí pás.', 'Starts the blade.'),
        action: () => {
          if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'));
          else push('running', true);
        },
      },
      btnStart,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Tlačidlo STOP', 'STOP button'),
        hint: LL('Zastaví pás.', 'Stops the blade.'),
        action: () => push('running', false),
      },
      btnStop,
    );
    let s0 = 0;
    ctrl.reg(
      {
        type: 'slide',
        axis: 'z',
        label: LL('Obrobok', 'Workpiece'),
        hint: LL(
          'Ťahaj obrobok dozadu proti pásu (posuv) alebo späť k sebe.',
          'Drag the workpiece back against the blade (feed) or towards you.',
        ),
        read: () => `${L('posuv', 'feed')} ${(st.s * 100).toFixed(0)} mm`,
        start: () => {
          s0 = st.s;
        },
        slide: (dz) => push('feed', clamp((s0 - dz) * 100, 0, (wk.Lp + 1.2) * 100)),
        nudge: (dir) => push('feed', clamp(st.s * 100 - dir * 10, 0, (wk.Lp + 1.2) * 100)),
      },
      pieceG,
    );

    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      t += dt;
      wi.update(dt);

      // napnutie a štart
      st.tension = approach(st.tension, c.tension, 40 * dt);
      if (c.running && st.v < 0.05 && st.tension < 60) {
        push('running', false);
        say(
          L(
            'Pás nie je napnutý – dotiahni napínanie (aspoň 60 %).',
            'The blade is not tensioned – tighten it (at least 60 %).',
          ),
        );
      }
      if (c.running && st.tension < 45) {
        push('running', false);
        say(L('Pás povolil – stroj zastavený.', 'The blade went slack – machine stopped.'), 'danger');
      }
      const vT = c.running && c.power ? SAW_SPEEDS[c.speed] : 0;
      st.v = approach(st.v, vT, 18 * dt);
      const running = st.v > 0.5;
      st.bandOff -= st.v * dt * 0.4;
      bladeTex.offset.y = st.bandOff % 1;
      wheels.forEach((w) => {
        w.rotation.z -= st.v * dt * 0.25;
      });
      wheelTension.rotation.z = st.tension * 0.12;

      // horné vodidlo
      const gT = clamp(c.guide, 10, 300) / 100;
      let ng = approach(st.g, gT, 0.8 * dt);
      const top = wk.T + 0.02,
        pieceUnder = !c.unclamped && zb() < 0.3 && zb() + wk.Lp > -0.4;
      if (ng < st.g && ng < top && pieceUnder) {
        ng = Math.max(Math.min(st.g, top), ng);
        sayOnce('guideDown', true, L('Vodidlo dosadlo na obrobok.', 'The guide touched the workpiece.'), 'info');
      } else flags.guideDown = false;
      knob.rotation.z += ((ng - st.g) / 0.2) * TAU;
      st.g = ng;

      // posuv obrobku proti pásu
      if (c.autoFeed && !c.unclamped) {
        c.feed = Math.min(c.feed + c.feedRate * dt, (wk.Lp + 1.2) * 100);
      }
      const sT = clamp(c.feed, 0, (wk.Lp + 1.2) * 100) / 100;
      let ns = approach(st.s, sT, 1.5 * dt);
      const mat = SAW_MATS[wk.mat];
      let why = null;
      if (!c.unclamped && !st.split && ns > st.s) {
        const want = cutAt(ns);
        if (want > st.cutMax + 1e-5) {
          if (st.g < top) why = 'guide';
          else if (!running) why = 'stopped';
          else if (SAW_SPEEDS[c.speed] > mat.maxSpeed) why = 'speed';
          if (why) ns = st.s + Math.max(0, st.cutMax - cutAt(st.s));
          else {
            const vmax = mat.v * (0.4 / wk.T) * (wk.mat === 'wood' ? SAW_SPEEDS[c.speed] / 25 : 1) * dt;
            const lim = st.cutMax + vmax;
            if (want > lim) ns = st.s + (lim - cutAt(st.s));
            st.cutMax = Math.max(st.cutMax, cutAt(ns));
            st.cutT = t;
            st.gapMax = Math.max(st.gapMax || 0, (st.g - wk.T) * 100); // najvyššie vodidlo nad obrobkom počas rezu
            dustAcc += dt * (wk.mat === 'wood' ? 120 : 50);
            while (dustAcc >= 1) {
              dustAcc -= 1;
              const below = Math.random() < 0.6;
              dust.spawn(
                v3((Math.random() - 0.5) * 0.06, below ? TT - 0.35 : TT + 0.02, 0.1 + Math.random() * 0.05),
                v3((Math.random() - 0.5) * 1.2, below ? -0.5 : 0.5 + Math.random(), 0.4 + Math.random() * 1.2),
                3 + Math.random() * 2,
                10,
                15,
              );
            }
            if (st.cutMax >= wk.Lp - 1e-4) {
              st.split = true;
              say(
                L(
                  'Obrobok je prerezaný – odrezok sa oddelil.',
                  'The workpiece is cut through – the offcut has separated.',
                ),
                'info',
              );
            }
          }
        }
        if (st.g < top && ns > st.s && zb(ns) < 0.3 && zb(st.s) >= 0.3) {
          ns = st.s;
          why = 'guide';
        }
      }
      if (why && c.autoFeed) c.autoFeed = false;
      if (why) {
        c.feed = ns * 100;
        pend.feed = Math.round(c.feed);
      }
      sayOnce(
        'stopped',
        why === 'stopped',
        L(
          'Pás stojí – obrobok sa o neho zastavil. Spusti pílu.',
          'The blade is stopped – the workpiece stopped against it. Start the saw.',
        ),
        'danger',
      );
      sayOnce(
        'speed',
        why === 'speed',
        `${L('Príliš vysoká rýchlosť pásu pre', 'Blade speed too high for')} ${L(mat.sk.toLowerCase(), mat.en.toLowerCase())} – ${L('zuby by sa spálili. Zníž rýchlosť na', 'the teeth would burn. Reduce it to')} ${mat.maxSpeed} m/s.`,
        'warn',
      );
      sayOnce(
        'guide',
        why === 'guide',
        L(
          'Horné vodidlo je nižšie ako obrobok – zdvihni ho hviezdicovým kolieskom.',
          'The upper guide is lower than the workpiece – raise it with the star knob.',
        ),
        'warn',
      );
      sayOnce(
        'high',
        running && st.cutT === t && st.g > top + 0.5,
        L(
          'Vodidlo je vysoko nad obrobkom – nastav ho tesne nad materiál, pás je nekrytý.',
          'The guide is high above the workpiece – set it just above the material, the blade is exposed.',
        ),
        'warn',
      );
      st.s = ns;
      if (st.split) st.sepX = approach(st.sepX, 0.08, 0.3 * dt);

      // pohyb skupín
      if (!c.unclamped) pieceG.position.z = zb();
      leftG.position.x = -st.sepX;
      if (st.cutT === t || st.split) layout();
      post.position.y = TT + st.g;
      dust.update(dt, (p) => (Math.abs(p.x) < 3.3 && Math.abs(p.z) < 3.0 && p.y > TT - 0.2 ? TT : 0.02));
      M.lamp.emissive.setHex(c.running && c.power ? 0x22dd55 : c.power ? 0x8a5a00 : 0x000000);

      ctrl.update(dt);
      insp.update(t, c);

      if (t - teleT > 0.1) {
        teleT = t;
        setTele({
          v: st.v,
          feed: st.s * 100,
          cut: st.cutMax * 100,
          cutting: t - st.cutT < 0.25 && running,
          split: st.split,
          tension: st.tension,
          guide: st.g * 100,
          msg: st.msg && st.msg.until > t ? st.msg : null,
        });
        if (c.autoFeed || lastAuto !== c.autoFeed) {
          pend.feed = Math.round(c.feed);
          pend.autoFeed = c.autoFeed;
        }
        lastAuto = c.autoFeed;
        if (Object.keys(pend).length) {
          const p = { ...pend };
          Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
      }
      snd.update({ motor: st.v / 25, cut: t - st.cutT < 0.25 && st.v > 0.5 ? 1 : 0 });
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      snd.dispose();
      ctrl.dispose();
      insp.dispose();
      wi.dispose();
      disposeStage();
    };
  }, []);

  const parts = sawParts();
  const setupTask = (task) => {
    if (ui.running || tele.v > 0.05) return;
    Object.entries(task.setup).forEach(([k, v]) => set(k, v));
    const r = apiRef.current.newBlank && apiRef.current.newBlank();
    if (r) Object.entries(r).forEach(([k, v]) => set(k, v));
  };
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped
      ? { kind: 'info', text: L('Obrobok je zdvihnutý zo stola.', 'The workpiece is lifted off the table.') }
      : tele.cutting
        ? {
            kind: 'run',
            text: `${L('Rez', 'Cutting')} – ${tele.cut.toFixed(0)} / ${ui.bL} mm, ${L('pás', 'blade')} ${tele.v.toFixed(0)} m/s`,
          }
        : tele.split
          ? {
              kind: 'info',
              text: L('Obrobok je prerezaný. Vlož nový polotovar.', 'The workpiece is cut through. Insert a new one.'),
            }
          : tele.v > 0.5
            ? {
                kind: 'run',
                text: L(
                  'Pás beží. Nastav vodidlo nad obrobok a posúvaj ho proti pásu.',
                  'The blade is running. Set the guide above the work and feed it against the blade.',
                ),
              }
            : !ui.power
              ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
              : {
                  kind: 'idle',
                  text: L(
                    'Stroj stojí. Napni pás, nastav rýchlosť podľa materiálu a spusti pílu.',
                    'The machine is stopped. Tension the blade, choose the speed for the material and start the saw.',
                  ),
                };
  const chips = [
    {
      color: tele.v > 0.5 ? '#3ee06c' : '#8b8f89',
      text: tele.v > 0.5 ? `${L('Pás', 'Blade')} ${tele.v.toFixed(0)} m/s` : L('Pás stojí', 'Blade stopped'),
    },
  ];
  if (tele.cutting) chips.push({ color: '#ffb340', text: L('Rez', 'Cutting') });
  if (tele.tension < 60) chips.push({ color: '#ff8a1f', text: L('Pás povolený', 'Blade slack') });
  const mat = SAW_MATS[ui.bMat];

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
            kicker={L('Simulátor · pásová píla', 'Simulator · band saw')}
            title={L('Strojná pásová píla', 'Vertical band saw')}
            sub={L(
              'Predloha: TOS PPN s kolesami Ø720 mm. Mierka 1 : 100 mm.',
              'Modelled after the TOS PPN with Ø720 mm wheels. Scale 1 : 100 mm.',
            )}
            rows={[
              [L('Posuv', 'Feed'), tele.feed.toFixed(1)],
              [L('Rez', 'Cut'), tele.cut.toFixed(1)],
              [L('Vodidlo', 'Guide'), (tele.guide || ui.guide).toFixed(1)],
            ]}
            foot={[
              `${L('pás', 'blade')} ${tele.v.toFixed(1)} m/s`,
              `${L('napnutie', 'tension')} ${Math.round(tele.tension)} %`,
            ]}
            status={statusMsg}
          />

          <TaskSection
            machine="pila"
            tasks={SAW_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'running', items: SAW_SAFETY() }}
          />

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
              <SectionInfo title={L('Hlavný chod', 'Main drive')}>
                <p className="text-xs muted">
                  {L(
                    `Pre ${mat.sk.toLowerCase()} je najvyššia vhodná rýchlosť ${mat.maxSpeed > 30 ? 25 : mat.maxSpeed} m/s. Rýchlosť sa mení len pri stojacom stroji.`,
                    `For ${mat.en.toLowerCase()} the highest suitable speed is ${mat.maxSpeed > 30 ? 25 : mat.maxSpeed} m/s. The speed is changed only with the machine stopped.`,
                  )}
                </p>
              </SectionInfo>
            </div>
            <button
              type="button"
              className={`btn-run ${ui.running ? 'stop' : 'start'}`}
              onClick={() => {
                if (!ui.running && !ui.power) set('power', true);
                set('running', !ui.running);
              }}
            >
              {ui.running ? L('■ Stop píly', '■ Stop saw') : L('▶ Štart píly', '▶ Start saw')}
            </button>
            <div className="mt-2">
              <Toggle
                on={ui.power}
                label={L('Hlavný vypínač', 'Main switch')}
                onClick={() => {
                  const v = !ui.power;
                  set('power', v);
                  if (!v) set('running', false);
                }}
              />
            </div>
            <div className="mt-3">
              <SegRow
                label={L('Rýchlosť pásu', 'Blade speed')}
                value={ui.speed}
                options={SAW_SPEEDS.map((v, i) => [i, `${v} m/s`])}
                onChange={(v) => {
                  if (ui.running || tele.v > 0.05) return;
                  set('speed', v);
                }}
              />
              {(ui.running || tele.v > 0.05) && (
                <p className="text-xs -mt-2 mb-3" style={{ color: 'var(--warn)' }}>
                  {L(
                    'Rýchlosť pásu sa mení len pri stojacom stroji (remeň na inom stupni remenice).',
                    'The blade speed can only be changed with the machine stopped (belt on another pulley step).',
                  )}
                </p>
              )}
              <Slider
                id="sten"
                label={L('Napnutie pásu', 'Blade tension')}
                unit="%"
                min={0}
                max={100}
                step={1}
                value={ui.tension}
                actual={tele.tension}
                onChange={(v) => set('tension', v)}
              />
            </div>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Vodidlo a posuv', 'Guide and feed')}</h2>
              <SectionInfo title={L('Vodidlo a posuv', 'Guide and feed')}>
                <p className="text-xs muted">
                  {L(
                    'Vodidlo nastav 5 – 10 mm nad obrobok. Obrobok môžeš posúvať aj ťahaním v režime ručného ovládania.',
                    'Set the guide 5 – 10 mm above the work. In manual control you can also drag the workpiece.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="sgd"
              label={L('Výška horného vodidla nad stolom', 'Upper guide height above the table')}
              unit="mm"
              min={10}
              max={300}
              step={1}
              value={ui.guide}
              actual={tele.guide}
              onChange={(v) => set('guide', v)}
            />
            <Slider
              id="sfd"
              label={L('Posuv obrobku proti pásu', 'Workpiece feed against the blade')}
              unit="mm"
              min={0}
              max={ui.bL + 120}
              step={1}
              value={ui.feed}
              actual={tele.feed}
              onChange={(v) => set('feed', v)}
            />
            <Toggle
              on={ui.autoFeed}
              label={L('Rovnomerný posuv', 'Steady feed')}
              onClick={() => set('autoFeed', !ui.autoFeed)}
            />
            <Slider
              id="sfr"
              label={L('Rýchlosť posuvu', 'Feed rate')}
              unit="mm/s"
              min={2}
              max={80}
              step={1}
              value={ui.feedRate}
              onChange={(v) => set('feedRate', v)}
            />
          </div>

          <BlankSection
            onApply={() => {
              const r = apiRef.current.newBlank && apiRef.current.newBlank();
              if (r) Object.entries(r).forEach(([k, v]) => set(k, v));
            }}
            applyLabel={L('Položiť nový polotovar', 'Put down a new workpiece')}
          >
            <SegRow
              label={L('Materiál', 'Material')}
              value={ui.bMat}
              options={Object.entries(SAW_MATS).map(([k, m]) => [k, L(m.sk, m.en)])}
              onChange={(v) => set('bMat', v)}
            />
            <Slider
              id="sbl"
              label={L('Dĺžka (v smere rezu)', 'Length (along the cut)')}
              unit="mm"
              min={150}
              max={550}
              step={10}
              value={ui.bL}
              onChange={(v) => set('bL', v)}
            />
            <Slider
              id="sbw"
              label={L('Šírka', 'Width')}
              unit="mm"
              min={60}
              max={300}
              step={10}
              value={ui.bW}
              onChange={(v) => set('bW', v)}
            />
            <Slider
              id="sbt"
              label={L('Hrúbka', 'Thickness')}
              unit="mm"
              min={10}
              max={150}
              step={5}
              value={ui.bT}
              onChange={(v) => set('bT', v)}
            />
            <Slider
              id="scx"
              label={L('Rez od ľavej hrany', 'Cut from the left edge')}
              unit="mm"
              min={5}
              max={ui.bW - 5}
              step={5}
              value={Math.min(ui.cutX, ui.bW - 5)}
              onChange={(v) => set('cutX', v)}
            />
          </BlankSection>

          <ExportSection machine="pila" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail rezu', 'Cutting detail')],
              ['spredu', L('Spredu', 'Front')],
              ['zhora', L('Zhora', 'Top')],
              ['bok', L('Z boku', 'Side')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

export { BandSawSimulator };
export default BandSawSimulator;
