import { WorkResume } from '../ui/workResume';
import { PartLabelsButton } from '../ui/common';
import { workAreaFeed } from '../core/workAreaFeed';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { L } from '../core/i18n';
import { createStage } from '../core/stage';
import { optimizeMachine } from '../core/sceneOptimize';
import { createInspector } from '../core/inspector';
import { createControls } from '../core/controls';
import { createWorkInspect } from '../core/workInspect';
import { createSound } from '../core/sound';
import { exportStl } from '../core/export';
import { exportStep } from '../core/step';
import {
  HelpFooter,
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
import { SectionInfo } from '../ui/sectionInfo';
import { StepDownloadButton, TaskSection } from '../ui/tools';
import { BendDrawing } from '../ui/sketch';
import { brakeChecks, measureBrake } from './precision/modernTasks';
import { BystronicHmi, drawBrakeHmi } from '../ui/bystronicHmi';
import { createBystronicModel } from './precision/bystronicModel';
import { brakeSetup, XPERT320 } from './precision/pressBrakeProcess';
import { createBrakeControl } from './precision/brakeControl';
import '../ui/bystronic.css';

const parts = () =>
  mkParts([
    [
      'ram',
      L('Rám', 'Frame'),
      'Frame',
      'Xpert Pro 320/4300',
      'Xpert Pro 320/4300',
      'Rám 5 260 × 2 000 × 3 170 mm. Sila 3 200 kN, hmotnosť 24,3 t.',
      '5,260 × 2,000 × 3,170 mm frame. 3,200 kN capacity, 24.3 t weight.',
    ],
    [
      'kryty',
      'Kryty',
      'Covers',
      'Horné okrytovanie',
      'Upper enclosure',
      'Čierny tvarovaný kryt, biele bočnice a pracovné osvetlenie podľa fotografií.',
      'Shaped black visor, white cheeks and task lighting from photographs.',
    ],
    [
      'baran',
      'Baran Y1/Y2',
      'Y1/Y2 ram',
      'Synchronizovaný baran',
      'Synchronised ram',
      'Zdvih 250 mm, otvorenie bez nástrojov 640 mm. Horný nástroj sa pohybuje s baranom.',
      '250 mm stroke, 640 mm opening without tooling. Upper tooling follows the ram.',
    ],
    [
      'stol',
      'Stôl a matrica',
      'Bed and die',
      'V-matrica a spodný stôl',
      'V die and lower bed',
      'Pracovná dĺžka 4 300 mm, stôl 74 mm. Vymeniteľná V-matrica a kazeta bombírovania.',
      '4,300 mm bending length, 74 mm table. Replaceable V die and crowning cassette.',
    ],
    [
      'dorazy',
      'Dorazy X/R/Z',
      'X/R/Z gauges',
      'Zadné dorazy',
      'Back gauges',
      'Rozsah X do 1 050 mm, zdvih R 250 mm, dráha Z 2 900 mm. Prsty sa rozostavia podľa plechu.',
      'X range up to 1,050 mm, R travel 250 mm, Z travel 2,900 mm. Fingers spread to suit the sheet.',
    ],
    [
      'podpery',
      'Podpery',
      'Supports',
      'Predné podpery plechu',
      'Front sheet supports',
      'Posuvné ramená s valčekmi a pomocná podpera. Tvary príslušenstva sú odhadnuté z fotografií.',
      'Sliding roller arms and auxiliary support. Accessory shapes are reconstructed from photographs.',
    ],
    [
      'ochrana',
      'Ochrana',
      'Guards',
      'Bočné dvere a laserové snímače',
      'Side doors and laser sensors',
      'Otvorené kryty alebo prekážka v ochrannom poli zastavia simulovaný cyklus.',
      'Open guards or an obstructed safety field stop the simulated cycle.',
    ],
    [
      'panel',
      'HMI',
      'HMI',
      'Mobilný dotykový panel',
      'Mobile touch terminal',
      'Displej v modeli a vo veľkom okne používa rovnaké údaje. Výučbové rozhranie, nie emulácia ByVision.',
      'The model and fullscreen share the same display. A training interface, not a ByVision emulation.',
    ],
    [
      'pedal',
      'Pedál',
      'Pedal',
      'Nožné ovládanie',
      'Foot controls',
      'V ručnom režime ľavý pedál spustí cyklus, pravý zdvihne baran.',
      'In manual mode the left pedal starts the cycle; the right retracts the ram.',
    ],
    [
      'servis',
      'Servisné kryty',
      'Service panels',
      'Zadná časť stroja',
      'Rear enclosure',
      'Ventilácia, rozdelenie panelov, pánty a servisné uzávery podľa zadného pohľadu.',
      'Ventilation, panel divisions, hinges and service latches follow the rear reference.',
    ],
    [
      'plech',
      'Plech',
      'Sheet',
      'Ohýbaný diel',
      'Bent workpiece',
      'Súvislý plech s hrúbkou a polomerom ohybu. Po zdvihnutí barana sa dá prezrieť a exportovať.',
      'Continuous sheet with thickness and bend radius. Inspect and export after retracting the ram.',
    ],
  ]);
const save = (blob, name) => {
  if (!blob) return;
  const u = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
};
const getSetup = (c) => {
  try {
    return { value: brakeSetup(c), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
};
// úlohy s hodnotením (kontroly v precision/modernTasks.js)
const BRAKE_TASKS = [
  {
    id: 'uholnik',
    title: () => L('Uholník 90° ±0,5° z plechu 3 mm', '90° ±0.5° angle from 3 mm sheet'),
    desc: () =>
      L(
        'Oceľový plech 3 × 2 000 mm, hĺbka prírezu 100 mm. Ohni uholník s ramenami 50 × 50 mm (doraz X 50 mm) na vnútorný uhol 90°. Zvoľ V-matricu podľa pravidla V = 6 až 10 × t (najčastejšie 8 × t).',
        'Steel sheet 3 × 2,000 mm, blank depth 100 mm. Bend an angle with 50 × 50 mm legs (X gauge 50 mm) to an inside angle of 90°. Choose the V die by the rule V = 6 to 10 × t (usually 8 × t).',
      ),
    setup: { material: 'steel', thickness: 3, length: 2000, depth: 100, flange: 50, angle: 135, v: 40 },
    drawing: () => <BendDrawing angle={90} flange={50} th={3} />,
    labels: {
      run: () => L('Ohyb dokončený bez hlásenia', 'Bend finished without message'),
      sheet: () => L('Oceľ 3 × 2 000 mm', 'Steel 3 × 2,000 mm'),
      angle: () => L('Uhol 90 ±0,5°', 'Angle 90 ±0.5°'),
      flange: () => L('Rameno (doraz X) 50 ±0,5 mm', 'Leg (X gauge) 50 ±0.5 mm'),
      v: () => L('V-matrica 6 – 10 × t', 'V die 6 – 10 × t'),
    },
  },
  {
    id: 'sila',
    title: () => L('Ohyb 6 mm × 3 m do 50 % sily lisu', '6 mm × 3 m bend within 50 % of press force'),
    desc: () =>
      L(
        'Oceľový plech 6 × 3 000 mm ohni na 90°. Lisovacia sila nesmie prekročiť polovicu kapacity (1 600 kN), aby sa šetril stroj aj nástroje. Sila F = 1,42 · Rm · L · t² / V klesá so šírkou matrice – zvoľ V tak, aby F ≤ 1 600 kN, ale nie viac ako 12 × t (veľký polomer ohybu).',
        'Bend a steel sheet 6 × 3,000 mm to 90°. The bending force must not exceed half the capacity (1,600 kN) to spare the machine and tooling. Force F = 1.42 · Rm · L · t² / V falls with die width – choose V so that F ≤ 1,600 kN, but not more than 12 × t (large bend radius).',
      ),
    setup: { material: 'steel', thickness: 6, length: 3000, depth: 300, flange: 150, angle: 90, v: 36 },
    drawing: () => <BendDrawing angle={90} flange={150} th={6} />,
    labels: {
      run: () => L('Ohyb dokončený bez hlásenia', 'Bend finished without message'),
      sheet: () => L('Oceľ 6 × 3 000 mm', 'Steel 6 × 3,000 mm'),
      angle: () => L('Uhol 90 ±0,5°', 'Angle 90 ±0.5°'),
      force: () => L('Sila ≤ 1 600 kN (50 %)', 'Force ≤ 1,600 kN (50 %)'),
      v: () => L('V-matrica 6 – 12 × t', 'V die 6 – 12 × t'),
    },
  },
].map((t) => ({ ...t, checks: (m) => brakeChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

const BRAKE_SAFETY = () => [
  L(
    'Ochranné pole (svetelná závora) je voľné a bočné kryty sú zatvorené.',
    'The safety field (light curtain) is clear and the side guards are closed.',
  ),
  L(
    'Plech pridržiavam zboku, prsty nikdy nedávam medzi razník a matricu.',
    'I hold the sheet from the side and never put my fingers between punch and die.',
  ),
  L(
    'Sila ohybu je pod kapacitou lisu a matrice (pozri Nástroje a dorazy).',
    'The bending force is within the press and die capacity (see Tooling and gauges).',
  ),
];

export default function BystronicSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const { ctl, ui, set, setUi, selected, selectPart, apiRef } = useMachine({
    hmiTab: 'bend',
    manual: false,
    hydraulic: true,
    estop: false,
    guardOpen: false,
    obstructed: false,
    cutaway: false,
    light: true,
    hmiAngle: -10,
    speed: 1,
    material: 'steel',
    thickness: 4,
    length: 2400,
    depth: 600,
    flange: 150,
    v: 32,
    angle: 90,
    r: 0,
  });
  const [tele, setTele] = useTele({
    phase: 'idle',
    run: false,
    paused: false,
    done: false,
    complete: false,
    y: 0,
    beta: 0,
    force: 0,
    t: 0,
    alarm: null,
    hasJob: false,
  });
  const [hmi, setHmi] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    const c = ctl.current,
      mount = mountRef.current,
      {
        scene,
        camera,
        renderer,
        snapshot,
        dispose: disposeStage,
      } = createStage(mount, { far: 700, floorSize: 400, gridSize: 250, fogNear: 180, fogFar: 500 });
    const dom = renderer.domElement,
      root = new THREE.Group();
    scene.add(root);
    const G = {};
    const mat = (color, metal = 0.2, rough = 0.5) =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).convertSRGBToLinear(),
        metalness: metal,
        roughness: rough,
      });
    const M = {
      cab: mat(0xd7dbdd, 0.25, 0.36),
      cab2: mat(0xb6bdc2, 0.3, 0.42),
      dark: mat(0x282c32),
      anth: mat(0x484c53, 0.3),
      black: mat(0x14171b, 0.1, 0.7),
      visor: mat(0x202126, 0.38, 0.19),
      red: mat(0xf44d34, 0.22, 0.32),
      steel: mat(0xc6ced2, 0.8, 0.22),
      steelD: mat(0x737e86, 0.6, 0.35),
      tool: mat(0xb9c2c9, 0.78, 0.22),
      brass: mat(0xbba13f, 0.6, 0.3),
      green: mat(0x58cf61),
      yellow: mat(0xe9d637),
      sheet: mat(0x8da8bb, 0.65, 0.28),
      glass: new THREE.MeshStandardMaterial({
        color: 0x182e3b,
        transparent: true,
        opacity: 0.22,
        roughness: 0.12,
        metalness: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };
    const tex = (w, h, draw) => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const tx = new THREE.CanvasTexture(cv);
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = 4;
      const redraw = () => {
        draw(cv.getContext('2d'), w, h);
        tx.needsUpdate = true;
      };
      redraw();
      return { tx, redraw };
    };
    const model = createBystronicModel({ root, G, M, tex });
    let t = 0,
      last = performance.now(),
      lastTele = 0,
      guardAngle = 0,
      raf;
    const control = createBrakeControl({ c, onChange: set, guardClosed: () => guardAngle < 0.01 }),
      process = control.process;
    const snd = createSound('bender');
    const actions = Object.fromEntries(
      ['start', 'hold', 'retract', 'reset', 'emergency', 'releaseStop', 'acknowledge', 'light', 'hydraulic'].map(
        (id) => [id, () => control.action(id)],
      ),
    );
    // pri úlohe s kontrolou BOZP sa prvý ohyb spustí až po potvrdení zoznamu (TaskSection → SafetyGate)
    actions.start = () => {
      const gate = apiRef.current.safetyGate;
      if (gate && !gate.ok()) {
        gate.request();
        return;
      }
      control.action('start');
    };
    actions.startPanel = actions.start;
    actions.retractPanel = actions.retract;
    actions.hmi = () => setHmi(true);
    const screen = tex(1200, 700, (g, w, h) =>
      drawBrakeHmi(g, w, h, { S: control.snapshot(), c, setup: getSetup(c).value }),
    );
    model.display.material.map = screen.tx;
    apiRef.current.measure = () => measureBrake({ S: process.S, c });
    apiRef.current = {
      ...apiRef.current,
      machineModel: { root, name: 'Bystronic Xpert Pro 320-4300' },
      hmiAction: (id) => actions[id]?.(),
      hmiSet: control.set,
      hmiLoad: control.load,
      getHmiCanvas: () => screen.tx.image,
      snapshot,
      stl: () => (process.S.run ? null : exportStl(model.stock)),
      exportStep: async () => {
        if (process.S.run) throw new Error(L('Najprv zastav cyklus.', 'Stop the cycle first.'));
        return exportStep(model.stock);
      },
    };
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const views = {
      celok: () => [
        [49, 29, 63],
        [0, 15, 0],
      ],
      celo: () => [
        [0, 19, 79],
        [0, 15, 1],
      ],
      nastroje: () => [[20, 18, 35], [0, 12, 2], true],
      dorazy: () => [[8, 17, -29], [0, 10, -4], true],
      zadok: () => [
        [-58, 31, -67],
        [0, 16, -5],
      ],
      stop: () => [[18, 10, 30], [12, 5.8, 14], true],
      panel: () => {
        const p = model.consolePivot.getWorldPosition(v(0, 0, 0)).add(v(0, 12, 0));
        return [
          p
            .clone()
            .add(v(1, 2, 16))
            .toArray(),
          p.toArray(),
          true,
        ];
      },
      plech: () => [[16, 19, 30], [0, 11, 4], true],
    };
    apiRef.current.mountWorkArea = workAreaFeed({ scene, camera, renderer, view: views.nastroje });
    const anchors = Object.fromEntries(
      Object.keys(G).map((k) => [k, () => G[k].getWorldPosition(v(0, 0, 0)).add(v(0, 10, 0))]),
    );
    const insp = createInspector({
      dom,
      mount,
      camera,
      root,
      G,
      anchors,
      views,
      labelEls: [...layerRef.current.querySelectorAll('[data-part]')],
      enabled: () => !c.manual && !c.unclamped,
      onPick: (k) => apiRef.current.onPick(k),
      blockPick: () => ctrl.isUsed() || c.unclamped,
      onHL: () => ctrl.invalidate(),
      orbitOptions: { maxDistance: 240, maxTargetY: 55 },
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl: tipRef.current, c, getT: () => t, getHL: insp.hl });
    for (const [id, o] of Object.entries(model.controls.buttons))
      ctrl.reg(
        {
          type: 'button',
          hint: L('Kliknutím aktivuješ.', 'Click to activate.'),
          pressAxis: o.userData.pressAxis || 'z',
          label: {
            start: L('Spustiť ohyb', 'Start bend'),
            retract: L('Zdvihnúť baran', 'Retract ram'),
            hold: L('Pozastaviť', 'Pause'),
            reset: L('Nový plech', 'New sheet'),
            startPanel: L('Spustiť ohyb', 'Start bend'),
            retractPanel: L('Zdvihnúť baran', 'Retract ram'),
            acknowledge: L('Potvrdiť hlásenie', 'Acknowledge alarm'),
            hydraulic: L('Hydraulika', 'Hydraulics'),
            light: L('Pracovné osvetlenie', 'Work light'),
            hmi: 'HMI',
            emergency: L('Núdzový STOP · kliknutím uvoľniť', 'Emergency STOP · click to release'),
          }[id],
          action: id === 'emergency' ? () => control.action(c.estop ? 'releaseStop' : 'emergency') : actions[id],
          latched: id === 'emergency' ? () => c.estop : undefined,
        },
        o,
      );
    for (const p of model.guardPivots)
      ctrl.reg(
        {
          type: 'button',
          tooltip: false,
          label: L('Bočné kryty', 'Side guards'),
          still: true,
          action: () => control.set('guardOpen', !c.guardOpen),
        },
        p,
      );
    ctrl.reg({ type: 'button', label: 'HMI', still: true, tooltip: false, action: () => setHmi(true) }, model.display);
    const wi = createWorkInspect({
      scene,
      camera,
      dom,
      insp,
      c,
      getObj: () => model.stock,
      getSpot: () => v(0, 16, 30),
      canDetach: () => !process.S.run && process.S.y < 0.01,
      onState: (unclamped) => set('unclamped', unclamped),
    });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in' && (process.S.run || process.S.y > 0.01)) {
        setNotice(L('Pred prehliadkou zastav cyklus a zdvihni baran.', 'Stop and retract the ram before inspection.'));
        return;
      }
      setNotice('');
      wi.toggle();
    };
    apiRef.current.view = (name) => {
      if (!c.unclamped) {
        if (name === 'dorazy') set('cutaway', true);
        else if (['celok', 'celo', 'zadok'].includes(name)) set('cutaway', false);
        insp.goView(name, false);
      }
    };
    insp.goView('celok', true);
    const tick = (dt, render = true) => {
      t += dt;
      guardAngle += ((c.guardOpen ? 1.15 : 0) - guardAngle) * Math.min(1, dt * 5);
      control.advance(dt * c.speed);
      c.running = process.S.run;
      model.update({ S: process.S, c, guardAngle });
      wi.update(dt);
      insp.update(t, c);
      ctrl.update(dt);
      if (Object.keys(ctrl.pend).length) {
        const next = { ...ctrl.pend };
        for (const k of Object.keys(ctrl.pend)) delete ctrl.pend[k];
        setUi((u) => ({ ...u, ...next }));
      }
      snd.update({ motor: c.hydraulic ? 0.04 : 0, cut: process.S.run ? 0.025 : 0 });
      if (t - lastTele > 0.12) {
        lastTele = t;
        screen.redraw();
        setTele(control.snapshot());
      }
      if (render) renderer.render(scene, camera);
    };
    tick(0);
    const sceneOpt = optimizeMachine({ root, scene, renderer, refs: { model, G }, controls: ctrl });
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt);
    };
    raf = requestAnimationFrame(loop);
    if (/[?&]debug/.test(window.location.search))
      window.__bystronic = {
        sceneOpt,
        c,
        root,
        camera,
        model,
        process,
        control,
        insp,
        ctrl,
        wi,
        api: apiRef.current,
        advance: (dt) => tick(dt, false),
      };
    return () => {
      cancelAnimationFrame(raf);
      snd.dispose();
      ctrl.dispose();
      wi.dispose();
      insp.dispose();
      delete window.__bystronic;
      disposeStage();
    };
  }, []);
  const setup = getSetup(ui),
    locked = tele.hasJob || ui.unclamped,
    angle = 180 - (tele.beta * 360) / Math.PI,
    p = parts();
  const change = (key, value) => apiRef.current.hmiSet?.(key, value);
  // rozpracovaná práca (ui/workResume.jsx): plech, nástroje a ohyb
  const WORK_KEYS = ['material', 'thickness', 'length', 'depth', 'flange', 'v', 'angle', 'r', 'speed'];
  apiRef.current.workSig = () => (apiRef.current.hmiSet ? JSON.stringify(WORK_KEYS.map((k) => ctl.current[k])) : null);
  apiRef.current.workSave = () => ({
    v: 1,
    label: `${ctl.current.thickness} mm · ${ctl.current.angle}°`,
    ui: Object.fromEntries(WORK_KEYS.map((k) => [k, ctl.current[k]])),
  });
  apiRef.current.workRestore = (d) => {
    if (!d || d.v !== 1 || tele.run || ui.unclamped) return false;
    apiRef.current.hmiAction?.('reset');
    WORK_KEYS.forEach((k) => d.ui?.[k] !== undefined && change(k, d.ui[k]));
    return true;
  };
  // úloha: nový plech a predpísané údaje (uhol, matricu a doraz nastavuje žiak)
  const setupTask = (t) => {
    if (tele.run || ui.unclamped) return;
    apiRef.current.hmiAction?.('reset');
    Object.entries(t.setup).forEach(([k, v]) => change(k, v));
  };
  const number = (key, label, min, max, step = 1) => (
    <label>
      {label}
      <input
        className="sel"
        type="number"
        min={min}
        max={max}
        step={step}
        value={ui[key]}
        onChange={(e) => {
          const value = Math.min(max, Math.max(min, Number(e.target.value) || min));
          change(key, value);
          if (key === 'depth' && ui.flange > value - 20) change('flange', value - 20);
        }}
      />
    </label>
  );
  return (
    <div className="machine-app modern-app hermle-app brake-app w-full flex flex-col md:flex-row">
      <SceneView
        {...{ mountRef, layerRef, tipRef, ui, set, selected, selectPart, onBack, apiRef }}
        parts={p}
        canUnclamp
        workBelowModes
        chips={[
          {
            color: tele.run ? '#34d399' : '#94a3b8',
            text: tele.run ? L('Ohýbanie', 'Bending') : L('Stojí', 'Stopped'),
          },
          {
            color: ui.guardOpen ? '#f5b64d' : '#34d399',
            text: ui.guardOpen ? L('Kryty otvorené', 'Guards open') : L('Kryty zatvorené', 'Guards closed'),
          },
        ]}
        tools={
          <button className="scene-btn" onClick={() => setHmi(true)}>
            HMI
          </button>
        }
        manualHint={L(
          'Ľavý pedál spustí ohyb, pravý zdvihne baran. Kliknutím na bočný kryt ho otvoríš; displej otvorí HMI.',
          'The left pedal starts a bend; the right retracts the ram. Click a side guard to open it, or the display to open HMI.',
        )}
      />
      {hmi && (
        <BystronicHmi apiRef={apiRef} c={ui} S={tele} setup={setup} onChange={change} onClose={() => setHmi(false)} />
      )}
      <aside className="panel">
        <WorkResume machine="bystronic" apiRef={apiRef} skip={!!params?.uloha} />
        <div className="sec">
          <p className="sec-title">{L('Moderné stroje · CNC ohraňovací lis', 'Modern machines · CNC press brake')}</p>
          <div className="section-heading">
            <h1 className="app-title mt-2" tabIndex={-1}>
              Bystronic Xpert Pro 320
            </h1>
            <PartLabelsButton ui={ui} set={set} />
            <SectionInfo title="Xpert Pro 320/4300">
              <p>
                {L(
                  'Štandardná verzia 320/4300 podľa dodaného technického listu: 3 200 kN, pracovná dĺžka 4 300 mm, zdvih 250 mm, otvorenie 640 mm, 5 260 × 2 000 × 3 170 mm, 24,3 t. Neokótované kryty a príslušenstvo sú rekonštrukciou z fotografií.',
                  'Standard 320/4300 from the supplied technical data: 3,200 kN, 4,300 mm bending length, 250 mm stroke, 640 mm opening, 5,260 × 2,000 × 3,170 mm, 24.3 t. Undimensioned covers and accessories are reconstructed from photographs.',
                )}
              </p>
            </SectionInfo>
          </div>
          <div className="cnc-dro mt-3">
            <div className="cnc-dro-col">
              {[
                ['Y1', tele.y],
                ['Y2', tele.y],
                ['X', ui.flange],
              ].map(([k, v]) => (
                <div className="cnc-dro-row" key={k}>
                  <span>{k}</span>
                  <b>{v.toFixed(2)}</b>
                </div>
              ))}
            </div>
            <div className="cnc-dro-col">
              <div className="cnc-dro-row">
                <span>R</span>
                <b>{ui.r.toFixed(1)}</b>
              </div>
              <div className="cnc-dro-row">
                <span>kN</span>
                <b>{tele.force.toFixed(0)}</b>
              </div>
              <div className="cnc-dro-row">
                <span>∠</span>
                <b>{angle.toFixed(1)}°</b>
              </div>
            </div>
          </div>
          <div
            className={`msg msg-${ui.estop || tele.alarm || setup.error ? 'danger' : tele.run ? 'run' : 'idle'}`}
            role="status"
          >
            {(ui.estop ? L('Núdzový STOP je aktívny.', 'Emergency STOP is active.') : null) ||
              tele.alarm ||
              tele.notice ||
              notice ||
              setup.error ||
              (tele.done
                ? tele.complete
                  ? L('Ohyb dokončený. Plech môžeš prezrieť.', 'Bend complete. Inspect the sheet.')
                  : L('Cyklus prerušený. Baran je zdvihnutý.', 'Cycle interrupted. Ram retracted.')
                : tele.paused
                  ? L('Cyklus pozastavený.', 'Cycle paused.')
                  : tele.run
                    ? L('Prebieha cyklus ohýbania.', 'Bending cycle in progress.')
                    : L('Pripravený na ohyb.', 'Ready to bend.'))}
          </div>
        </div>
        <div className="sec">
          <h2 className="sec-title mb-2">{L('Prevádzka', 'Operation')}</h2>
          <div className="cnc-run" data-running={String(!!tele.run)}>
            <button
              className="btn-run brake-start"
              disabled={ui.unclamped || !!setup.error}
              onClick={() => apiRef.current.hmiAction('start')}
            >
              ▶ {L('Spustiť ohyb', 'Start bend')}
            </button>
            <button className="btn" onClick={() => apiRef.current.hmiAction('hold')}>
              {L('Pozastaviť', 'Pause')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn" disabled={ui.unclamped} onClick={() => apiRef.current.hmiAction('retract')}>
              {L('Zdvihnúť baran', 'Retract ram')}
            </button>
            <button
              className="btn"
              disabled={ui.unclamped || tele.run}
              onClick={() => apiRef.current.hmiAction('reset')}
            >
              {L('Nový plech', 'New sheet')}
            </button>
            <button
              className={`btn ${ui.estop ? 'active' : ''}`}
              onClick={() => apiRef.current.hmiAction(ui.estop ? 'releaseStop' : 'emergency')}
            >
              {ui.estop ? L('Uvoľniť STOP', 'Release STOP') : L('Núdzový STOP', 'Emergency STOP')}
            </button>
          </div>
          <Toggle
            on={ui.hydraulic}
            label={L('Hydraulika', 'Hydraulics')}
            onClick={() => change('hydraulic', !ui.hydraulic)}
          />
          <Toggle
            on={ui.light}
            label={L('Pracovné osvetlenie', 'Work light')}
            onClick={() => change('light', !ui.light)}
          />
          <Toggle
            on={ui.guardOpen}
            label={L('Otvoriť bočné kryty', 'Open side guards')}
            onClick={() => change('guardOpen', !ui.guardOpen)}
          />
          <Toggle
            on={ui.obstructed}
            label={L('Prekážka v ochrannom poli', 'Safety field obstruction')}
            onClick={() => change('obstructed', !ui.obstructed)}
          />
          <SegRow
            label={L('Rýchlosť simulácie', 'Simulation speed')}
            value={ui.speed}
            options={[
              [1, '×1'],
              [4, '×4'],
              [10, '×10'],
            ]}
            shortcut="speed"
            onChange={(v) => change('speed', v)}
          />
        </div>
        <TaskSection
          machine="bystronic"
          tasks={BRAKE_TASKS}
          apiRef={apiRef}
          params={params}
          status={{ kind: tele.alarm ? 'danger' : 'idle', text: tele.alarm || '' }}
          onSetup={setupTask}
          safety={{ ui, set, items: BRAKE_SAFETY(), onConfirm: () => apiRef.current.hmiAction?.('start') }}
        />
        <div className="sec">
          <div className="section-heading">
            <h2 className="sec-title">{L('Plech a ohyb', 'Sheet and bend')}</h2>
            <SectionInfo title={L('Plech a ohyb', 'Sheet and bend')}>
              <p>
                {L(
                  'Jeden ohyb vo vzduchu. Uhol je vnútorný uhol dielu (rovný plech = 180°). Doraz X určuje dĺžku zadného ramena. Po cykle sa parametre odomknú tlačidlom Nový plech.',
                  'Single air bend. The angle is the inside angle (flat sheet = 180°). X sets the rear flange length. New sheet unlocks settings after a cycle.',
                )}
              </p>
            </SectionInfo>
          </div>
          <fieldset disabled={locked} className="brake-fields mt-3">
            <label>
              {L('Materiál', 'Material')}
              <select className="sel" value={ui.material} onChange={(e) => change('material', e.target.value)}>
                <option value="steel">{L('Oceľ', 'Steel')}</option>
                <option value="stainless">{L('Nehrdzavejúca oceľ', 'Stainless steel')}</option>
                <option value="aluminium">{L('Hliník', 'Aluminium')}</option>
              </select>
            </label>
            {number('thickness', L('Hrúbka [mm]', 'Thickness [mm]'), 0.5, 12, 0.5)}
            {number('length', L('Dĺžka ohybu [mm]', 'Bend length [mm]'), 100, XPERT320.bendLength, 10)}
            {number('depth', L('Hĺbka prírezu [mm]', 'Blank depth [mm]'), 80, 1400, 10)}
            {number('flange', L('Doraz X [mm]', 'X back gauge [mm]'), 20, Math.min(XPERT320.xRange, ui.depth - 20), 1)}
            {number('angle', L('Vnútorný uhol [°]', 'Inside angle [°]'), 90, 170, 1)}
          </fieldset>
        </div>
        <div className="sec">
          <div className="section-heading">
            <h2 className="sec-title">{L('Nástroje a dorazy', 'Tooling and gauges')}</h2>
            <SectionInfo title={L('Nástroje a sila', 'Tooling and force')}>
              <p>
                {L(
                  'Výučbový odhad sily F = 1,42 × Rm × L × t² / V. Polomer ohybu a odpruženie sú približné; nejde o technologický predpis. Osadenie obsahuje segmentovaný 85° horný nástroj a V-matricu. Rozsah X 1 050 mm nie je totožný so zdvihom saní X 600 mm.',
                  'Training force estimate F = 1.42 × Rm × L × t² / V. Bend radius and springback are approximate, not production instructions. Tooling comprises a segmented 85° punch and V die. The 1,050 mm X range differs from the 600 mm X carriage travel.',
                )}
              </p>
            </SectionInfo>
          </div>
          <fieldset disabled={locked} className="mt-3">
            <Slider
              id="brake-v"
              label={L('Otvorenie matrice V', 'Die opening V')}
              min={16}
              max={120}
              step={2}
              value={ui.v}
              unit="mm"
              onChange={(v) => change('v', v)}
            />
            <Slider
              id="brake-r"
              label={L('Výška dorazu R', 'R gauge height')}
              min={0}
              max={250}
              value={ui.r}
              unit="mm"
              onChange={(v) => change('r', v)}
            />
          </fieldset>
          <p className="text-sm">
            {L('Odhad sily', 'Estimated force')}: {setup.value?.force.toFixed(0) || '—'} / 3 200 kN
          </p>
          <div className="brake-force">
            <span style={{ width: `${Math.min(100, (setup.value?.force || 0) / 32)}%` }} />
          </div>
        </div>
        <div className="sec">
          <h2 className="sec-title mb-3">HMI</h2>
          <Slider
            id="brake-hmi"
            label={L('Natočenie panela', 'Panel angle')}
            min={-80}
            max={80}
            value={ui.hmiAngle}
            unit="°"
            onChange={(v) => change('hmiAngle', v)}
          />
          <button className="btn" onClick={() => setHmi(true)}>
            {L('HMI cez celé okno', 'Fullscreen HMI')}
          </button>
        </div>
        <div className="sec">
          <h2 className="sec-title mb-3">{L('Výsledný diel', 'Finished part')}</h2>
          <p className="text-sm">
            {angle.toFixed(1)}° · {tele.t.toFixed(1)} s
          </p>
          <div className="flex gap-2 flex-wrap mt-2">
            <button
              className="btn"
              disabled={tele.run}
              onClick={() => save(apiRef.current.stl?.(), 'bystronic-bent-sheet.stl')}
            >
              STL
            </button>
            <StepDownloadButton machine="bystronic-bent-sheet" apiRef={apiRef} />
            <button
              className="btn"
              onClick={() => apiRef.current.snapshot?.((b) => save(b, 'bystronic-xpert-pro-320.png'))}
            >
              PNG
            </button>
          </div>
        </div>
        <div className="sec">
          <Toggle
            on={ui.cutaway}
            label={L('Odkryť mechanizmus', 'Reveal mechanism')}
            onClick={() => change('cutaway', !ui.cutaway)}
          />
        </div>
        <ViewSection
          apiRef={apiRef}
          views={[
            ['celok', L('Celok', 'Overview')],
            ['celo', L('Čelo', 'Front')],
            ['nastroje', L('Nástroje', 'Tools')],
            ['dorazy', L('Dorazy', 'Gauges')],
            ['zadok', L('Zadná časť', 'Rear')],
            ['panel', 'HMI'],
            ['stop', L('STOP panel', 'STOP station')],
            ['plech', L('Plech', 'Sheet')],
          ]}
        />
        <PartsSection parts={p} {...{ selected, selectPart }} />
        <HelpFooter apiRef={apiRef} ui={ui} />
      </aside>
    </div>
  );
}
