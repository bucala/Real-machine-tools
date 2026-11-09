import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL, RPM } from '../core/i18n';
import { createHeightField } from '../core/heightField';
import { angleScaleTex } from '../core/detail';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { ChamferDrawing, SlotDrawing } from '../ui/sketch2';
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
import { createClassicScene, mainSwitch, panelButton } from './classic/scaffold';
import { FNK, chamferInfo, cuttingSpeed, endMillBottom, fnkChecks, toolAxis } from './fnkMath';
import { slotInfo } from './fguMath';

// =====================================================================
// NÁSTROJÁRSKA FRÉZKA TOS KUŘIM FNK 25 – natáčacia zvislá hlava ±45°, pinola, stopkové frézy
// =====================================================================
const HY = 12.0, // čap natáčania hlavy
  NOSE = 1.6, // vzdialenosť čela vretena od čapu pozdĺž osi
  HZ = 0.25, // os vretena (pred otočnou doskou)
  K0 = 7.4, // výška konzoly pri Z = 0
  WX = 1.0,
  WZ = 0.8,
  WH = 0.6,
  HFY = 0.95;

const fnkParts = () =>
  mkParts([
    [
      'stojan',
      'Stojan',
      'Column',
      'Stojan s prevodovkou',
      'Column with gearbox',
      'Tuhý liatinový stojan nesie výsuvné rameno s hlavou a vedenie konzoly. 14 otáčok 56 – 4 500 ot/min.',
      'The stiff cast-iron column carries the ram with the head and the knee ways. 14 speeds 56 – 4,500 rpm.',
    ],
    [
      'hlava',
      'Zvislá hlava',
      'Vertical head',
      'Natáčacia zvislá hlava s pinolou',
      'Swivelling vertical head with quill',
      'Hlava sa natáča okolo vodorovnej osi o ±45° podľa stupnice – stopková fréza tak čelom vyfrézuje úkos. Pinola vysúva nástroj pozdĺž jeho osi.',
      'The head swivels about a horizontal axis by ±45° by its scale – the end mill then faces a bevel. The quill extends the tool along its axis.',
    ],
    [
      'konzola',
      'Konzola',
      'Knee',
      'Konzola so stolom',
      'Knee with table',
      'Konzola (Z) nesie priečne sane (Y) a stôl (X). Posuvy X a Y zapínajú páky na čele.',
      'The knee (Z) carries the cross slide (Y) and the table (X). The X and Y feeds are engaged by the levers at the front.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Hranol vo zveráku',
      'Block in the vise',
      'Oceľový hranol 100 × 80 × 60 mm, čeľuste 20 mm pod hornou plochou.',
      'Steel block 100 × 80 × 60 mm, jaws 20 mm below the top face.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládací panel',
      'Control panel',
      'Hlavný vypínač, štart a stop vretena, chladenie.',
      'Main switch, spindle start and stop, coolant.',
    ],
  ]);

const FNK_TASKS = [
  {
    id: 'ukos',
    title: () => L('Úkos 30° × 15 mm', 'Bevel 30° × 15 mm'),
    desc: () =>
      L(
        'Natoč hlavu o 30° (stupnica na hlave), frézou Ø16 vyfrézuj na pravej hrane hranola úkos šírky 15 ±0,6 mm pod uhlom 30 ±0,5° po celej dĺžke hrany. Hĺbku nastav pinolou alebo konzolou, hranou prejdi priečnym posuvom Y.',
        'Swivel the head by 30° (scale on the head) and with the Ø16 cutter mill a bevel 15 ±0.6 mm wide at 30 ±0.5° along the whole right edge of the block. Set the depth with the quill or the knee and traverse the edge with the cross feed Y.',
      ),
    setup: { tilt: 0, tool: 'e16' },
    drawing: () => <ChamferDrawing a={30} s={15} />,
    labels: {
      angle: () => L('Uhol úkosu 30 ±0,5°', 'Bevel angle 30 ±0.5°'),
      width: () => L('Šírka úkosu 15 ±0,6 mm', 'Bevel width 15 ±0.6 mm'),
      along: () => L('Po celej dĺžke hrany', 'Along the whole edge'),
      crash: () => L('Bez nárazu', 'No crash'),
    },
  },
  {
    id: 'drazka',
    title: () => L('Drážka 12 × 6 stopkovou frézou', 'Slot 12 × 6 with an end mill'),
    desc: () =>
      L(
        'Pri nenatočenej hlave vyfrézuj frézou Ø12 pozdĺžnu drážku hĺbky 6 ±0,15 mm cez celú dĺžku hranola (posuv X).',
        'With the head not swivelled mill a longitudinal slot 6 ±0.15 mm deep through the whole block with the Ø12 cutter (feed X).',
      ),
    setup: { tilt: 0, tool: 'e12' },
    drawing: () => <SlotDrawing b={12} h={6} />,
    labels: {
      depth: () => L('Hĺbka 6 ±0,15 mm', 'Depth 6 ±0.15 mm'),
      width: () => L('Šírka 12 ±0,3 mm', 'Width 12 ±0.3 mm'),
      through: () => L('Drážka cez celú dĺžku', 'Slot through the whole length'),
      crash: () => L('Bez nárazu', 'No crash'),
    },
  },
].map((t) => ({ ...t, checks: (m) => fnkChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

const FNK_SAFETY = () => [
  L(
    'Fréza je dotiahnutá v klieštine, kľúč je vybratý z hlavy.',
    'The cutter is tight in the collet, the key is removed from the head.',
  ),
  L('Hlavu natáčam a upínam len pri stojacom vretene.', 'I swivel and clamp the head only with the spindle stopped.'),
  L(
    'Obrobok je pevne vo zveráku, ruky mám mimo dosahu frézy.',
    'The work is tight in the vise, my hands are clear of the cutter.',
  ),
];

function FnkSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    running: false,
    sp: 6,
    fd: 3,
    feedX: 0,
    feedY: 0,
    tool: 'e16',
    tilt: 0,
    headLock: true,
    q: 0,
    x: 0,
    y: 255,
    z: 0,
    coolant: false,
    light: true,
    manual: false,
    timeScale: 4,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, x: 0, y: 255, z: 0, q: 0, tilt: 0, cutting: false, msg: null });

  useEffect(() => {
    const c = ctl.current;
    return createClassicScene({
      mount: mountRef.current,
      layer: layerRef.current,
      tipEl: tipRef.current,
      c,
      apiRef,
      set,
      setUi,
      setTele,
      colors: [0x8ea8b8, 0x7690a0, 0x58707f],
      mats: {
        work: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
        cutter: [0xc9a95a, 0.3, 0.85],
        chip: [0xa6adb4, 0.3, 0.85],
      },
      name: L('Nástrojárska frézka TOS FNK 25', 'TOS FNK 25 toolroom milling machine'),
      sound: 'mill',
      debugKey: '__fnk',
      build: (x) => buildFnk(x),
    });
  }, []);

  const parts = fnkParts();
  const tl = FNK.tools[ui.tool];
  const v = cuttingSpeed(FNK.speeds[ui.sp], tl.d);
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.cutting
        ? {
            kind: 'run',
            text: `${L('Frézovanie', 'Milling')} – ${L('hlava', 'head')} ${tele.tilt.toFixed(1)}°, X ${tele.x.toFixed(1)}, Y ${tele.y.toFixed(1)}, Z ${tele.z.toFixed(2)}`,
          }
        : tele.rpm > 5
          ? {
              kind: 'run',
              text: L(
                'Vreteno sa točí. Nastav hĺbku a zapni posuv.',
                'The spindle runs. Set the depth and engage the feed.',
              ),
            }
          : {
              kind: 'idle',
              text: L(
                'Natoč a upni hlavu, zvoľ frézu a otáčky, potom spusti vreteno.',
                'Swivel and clamp the head, select the cutter and speed, then start the spindle.',
              ),
            };
  const chips = [
    {
      color: tele.rpm > 5 ? '#3ee06c' : '#8b8f89',
      text: tele.rpm > 5 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Vreteno stojí', 'Spindle stopped'),
    },
  ];
  if (Math.abs(tele.tilt) > 0.05)
    chips.push({ color: '#7fb6ff', text: `${L('hlava', 'head')} ${tele.tilt.toFixed(1)}°` });
  const setupTask = (task) => {
    if (ui.running) return;
    Object.entries(task.setup).forEach(([k, val]) => set(k, val));
    setTimeout(() => apiRef.current.newBlank?.(), 200);
  };
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
            'Pri natočenej hlave frézuje čelo frézy rovinu pod uhlom natočenia – úkos.',
            'With the head swivelled the cutter face mills a plane at the swivel angle – a bevel.',
          ),
          L(
            'Pinola posúva nástroj pozdĺž jeho osi, konzola zvisle.',
            'The quill moves the tool along its axis, the knee vertically.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · frézka', 'Simulator · mill')}
            title={L('Nástrojárska frézka', 'Toolroom milling machine')}
            sub={L(
              'Predloha: TOS FNK 25 – stôl 1 250 × 290 mm, X 800 / Y 370 / Z 450 mm, ISO 40, natáčacia zvislá hlava. Mierka 1 : 100 mm.',
              'Modelled after the TOS FNK 25 – table 1,250 × 290 mm, X 800 / Y 370 / Z 450 mm, ISO 40, swivelling vertical head. Scale 1 : 100 mm.',
            )}
            rows={[
              ['X', tele.x.toFixed(1)],
              ['Y', tele.y.toFixed(1)],
              ['Z', tele.z.toFixed(2)],
            ]}
            foot={[
              `${FNK.speeds[ui.sp]} ${RPM()}`,
              `v ${v.toFixed(0)} m/min`,
              `${L('pinola', 'quill')} ${tele.q.toFixed(2)}`,
            ]}
            status={statusMsg}
          />
          <TaskSection
            machine="fnk"
            tasks={FNK_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'running', items: FNK_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Vreteno a nástroj', 'Spindle and tool')}</h2>
            <button type="button" className="btn-run w-full" onClick={() => apiRef.current.toggleRun?.()}>
              {ui.running ? L('■ Stop vretena', '■ Stop spindle') : L('▶ Štart vretena', '▶ Start spindle')}
            </button>
            <div className="mt-2">
              <Toggle
                on={ui.power}
                label={L('Hlavný vypínač', 'Main switch')}
                onClick={() => set('power', !ui.power)}
              />
            </div>
            <SegRow
              label={L('Stopková fréza', 'End mill')}
              value={ui.tool}
              options={[
                ['e16', 'Ø16'],
                ['e12', 'Ø12'],
              ]}
              onChange={(k) => !ui.running && set('tool', k)}
            />
            <SegRow
              label={L('Otáčky', 'Speed')}
              value={ui.sp}
              options={FNK.speeds.map((n, i) => [i, String(n)])}
              onChange={(i) => !ui.running && set('sp', i)}
            />
            <p className="text-xs muted">
              {L(
                `Rezná rýchlosť ${v.toFixed(0)} m/min (HSS v oceli 25 – 35 m/min).`,
                `Cutting speed ${v.toFixed(0)} m/min (HSS in steel 25 – 35 m/min).`,
              )}
            </p>
            <Toggle on={ui.coolant} label={L('Chladenie', 'Coolant')} onClick={() => set('coolant', !ui.coolant)} />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Hlava a posuvy', 'Head and feeds')}</h2>
              <SectionInfo title={L('Natáčanie hlavy', 'Head swivel')}>
                <p className="text-xs muted">
                  {L(
                    'Uvoľni upínacie matice hlavy, natoč ju šnekom podľa stupnice a znova upni. Pri reze musí byť hlava upnutá.',
                    'Release the head clamping nuts, swivel it with the worm by the scale and clamp it again. The head must be clamped while cutting.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Toggle
              on={!ui.headLock}
              label={L('Hlava uvoľnená', 'Head released')}
              onClick={() => set('headLock', !ui.headLock)}
            />
            <Slider
              id="kt"
              label={L('Natočenie hlavy', 'Head swivel')}
              unit="°"
              min={-45}
              max={45}
              step={0.5}
              value={ui.tilt}
              actual={tele.tilt}
              digits={1}
              onChange={(val) => set('tilt', val)}
              disabled={ui.headLock}
            />
            <Slider
              id="kq"
              label={L('Pinola', 'Quill')}
              unit="mm"
              min={0}
              max={80}
              step={0.05}
              value={ui.q}
              actual={tele.q}
              digits={2}
              onChange={(val) => set('q', val)}
            />
            <SegRow
              label={L('Posuv', 'Feed')}
              value={ui.fd}
              options={FNK.feeds.map((f, i) => [i, String(f)])}
              onChange={(i) => set('fd', i)}
            />
            <SegRow
              label={L('Posuv X', 'Feed X')}
              value={ui.feedX}
              options={[
                [-1, '◀'],
                [0, '0'],
                [1, '▶'],
              ]}
              onChange={(d) => set('feedX', d)}
            />
            <SegRow
              label={L('Posuv Y', 'Feed Y')}
              value={ui.feedY}
              options={[
                [-1, L('dozadu', 'back')],
                [0, '0'],
                [1, L('dopredu', 'fwd')],
              ]}
              onChange={(d) => set('feedY', d)}
            />
            <Slider
              id="kx"
              label={L('Stôl X', 'Table X')}
              unit="mm"
              min={-400}
              max={400}
              step={0.5}
              value={ui.x}
              actual={tele.x}
              digits={1}
              onChange={(val) => set('x', val)}
            />
            <Slider
              id="ky"
              label={L('Priečne sane Y', 'Cross slide Y')}
              unit="mm"
              min={-185}
              max={370}
              step={0.5}
              value={ui.y}
              actual={tele.y}
              digits={1}
              onChange={(val) => set('y', val)}
            />
            <Slider
              id="kz"
              label={L('Konzola Z', 'Knee Z')}
              unit="mm"
              min={-300}
              max={150}
              step={0.05}
              value={ui.z}
              actual={tele.z}
              digits={2}
              onChange={(val) => set('z', val)}
            />
          </div>
          <BlankSection
            onApply={() => apiRef.current.newBlank?.()}
            applyLabel={L('Upnúť nový hranol', 'Clamp a new block')}
          >
            <p className="text-xs muted">{L('Oceľ, hranol 100 × 80 × 60 mm.', 'Steel block 100 × 80 × 60 mm.')}</p>
          </BlankSection>
          <ExportSection machine="fnk" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail rezu', 'Cut detail')],
              ['spredu', L('Spredu', 'Front')],
              ['panel', L('Panel', 'Panel')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

function buildFnk(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, pend, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, box, cylY, cylZ, ball, handwheel, crank, pivotLever, detents } = kit;
  const { rbox, ribs, nameplate, oilGlass, valuePlate, cable } = det;
  // ---------- stojan a výsuvné rameno ----------
  const col = grp('stojan');
  rbox(col, -2.4, 2.4, 0, 0.5, -6.2, 3.0, M.greenDeep, 0.1);
  rbox(col, -1.8, 1.8, 0.5, 13.0, -5.8, -2.2, M.green, 0.22);
  ribs(col, 'y', 2.0, 12.0, 5, -1.8, 1.8, -5.95, 0.15, 0.12, M.greenDark);
  box(col, -1.3, -0.9, 1.0, 12.0, -2.2, -2.12, M.ways);
  box(col, 0.9, 1.3, 1.0, 12.0, -2.2, -2.12, M.ways);
  rbox(col, -1.2, 1.2, 12.6, 13.8, -5.6, -0.75, M.green, 0.2); // výsuvné rameno
  nameplate(col, 0, 5.5, -2.19, 0, 'TOS Kuřim', 'FNK 25', 1.15);
  oilGlass(col, 1.1, 3.6, -2.18);
  valuePlate(col, -0.85, 11.4, -2.19, 0, 'n [1/min]', FNK.speeds.slice(0, 12), 1.0);
  // ---------- natáčacia hlava ----------
  const hd = grp('hlava');
  cylZ(hd, 1.8, 1.8, -0.75, -0.6, 0, HY, M.greenDark, 64); // otočná doska na čele ramena
  const scTx = angleScaleTex(45, 1, { numR: 0.9, step: 15, len: 0.08 });
  if (scTx) {
    const sc = add(
      hd,
      new THREE.RingGeometry(1.42, 1.78, 96),
      new THREE.MeshStandardMaterial({ map: scTx, roughness: 0.4, metalness: 0.4 }),
      0,
      HY,
      -0.595,
    );
    sc.userData.noMerge = true;
    sc.castShadow = false;
  }
  const head = new THREE.Group();
  head.position.set(0, HY, HZ);
  hd.add(head);
  rbox(head, -0.85, 0.85, -NOSE + 0.2, 1.4, -0.85, 0.85, M.green, 0.18);
  box(head, -0.035, 0.035, 1.36, 1.62, -0.86, -0.8, M.red); // ryska na hlave (proti stupnici na doske)
  cylY(head, 0.5, 0.5, 1.4, 2.6, 0, 0, M.green, 28); // motor
  cylZ(head, 0.12, 0.12, 0.85, 1.0, 0.55, 0.6, M.black, 12);
  const quillG = new THREE.Group();
  head.add(quillG);
  cylY(quillG, 0.32, 0.32, -NOSE, -NOSE + 0.4, 0, 0, M.steel, 24);
  const toolG = new THREE.Group();
  quillG.add(toolG);
  const buildTool = () => {
    while (toolG.children.length) toolG.remove(toolG.children[0]);
    const t = FNK.tools[c.tool],
      r = t.d / 200,
      len = t.len / 100;
    cylY(toolG, r, r, -NOSE - len, -NOSE, 0, 0, M.cutter, 24);
    for (let k = 0; k < 4; k++) {
      const flute = add(
        toolG,
        new THREE.BoxGeometry(r * 0.25, len * 0.92, r * 2.04),
        M.steelDark,
        0,
        -NOSE - len / 2,
        0,
      );
      flute.rotation.y = (k * Math.PI) / 4;
    }
    toolG.userData.tool = c.tool;
  };
  buildTool();
  const wTilt = handwheel(hd, 0.22, 1.45, HY - 1.15, -0.55, 'z', 0.12); // šnek natáčania (1 otáčka = 3°)
  const levHead = pivotLever(hd, 1.45, HY - 0.55, -0.58, 0.34, 1.2); // upnutie hlavy (na strane k obsluhe)
  const wQ = handwheel(head, 0.26, 0.95, 0.0, 0.0, 'x', 0.14); // koliesko pinoly (1 otáčka = 2 mm)
  // ---------- konzola, sane, stôl, zverák ----------
  const knee = grp('konzola');
  rbox(knee, -1.8, 1.8, -2.6, 0, -2.1, 2.2, M.green, 0.15);
  cylY(knee, 0.16, 0.16, -7.0, -2.6, 0, 0.5, M.steel, 14);
  const wY = handwheel(knee, 0.45, 0.0, -1.2, 2.35, 'z', 0.3);
  const cZ = crank(knee, 0.45, -1.2, -1.0, 2.25);
  const sad = new THREE.Group();
  knee.add(sad);
  rbox(sad, -1.6, 1.6, 0, 0.5, -1.7, 1.7, M.greenDark, 0.08);
  const tblX = new THREE.Group();
  tblX.position.y = 0.5;
  sad.add(tblX);
  rbox(tblX, -6.25, 6.25, 0, 0.6, -1.45, 1.45, M.green, 0.08);
  for (const z of [-0.8, 0, 0.8]) box(tblX, -6.2, 6.2, 0.56, 0.61, z - 0.09, z + 0.09, M.black);
  const wX = handwheel(tblX, 0.42, 6.55, 0.3, 0, 'x', 0.28);
  cylZ(tblX, 0.15, 0.13, 1.45, 1.57, 0.6, 0.3, M.black, 18);
  detents(tblX, 0.6, 0.3, 1.57, 0.2, [0.6, 0, -0.6], 0.025);
  const levFX = pivotLever(tblX, 0.6, 0.3, 1.59, 0.4, 1.2);
  cylZ(sad, 0.15, 0.13, 1.7, 1.82, 1.1, 0.25, M.black, 18);
  const levFY = pivotLever(sad, 1.1, 0.25, 1.84, 0.36, 1.2);
  const vise = new THREE.Group();
  tblX.add(vise);
  rbox(vise, -0.7, 0.7, 0.6, 0.75, -0.75, 0.75, M.steelDark, 0.03);
  rbox(vise, -0.55, 0.55, 0.75, HFY + WH - 0.2, -WZ / 2 - 0.15, -WZ / 2, M.steel, 0.02);
  rbox(vise, -0.55, 0.55, 0.75, HFY + WH - 0.2, WZ / 2, WZ / 2 + 0.15, M.steel, 0.02);
  [-0.3, 0.3].forEach((xx) => box(vise, xx - 0.15, xx + 0.15, 0.75, HFY, -0.35, 0.35, M.steel));
  const workG = grp('obrobok', tblX);
  let hf = null;
  const crashes = { n: 0 };
  const makeWork = () => {
    if (hf) {
      workG.remove(hf.mesh);
      hf.dispose();
    }
    hf = createHeightField({ NX: 80, NZ: 64, W: WX, D: WZ, H: WH, raw: 0x474b50, cut: 0xdfe3e7, mat: M.work });
    hf.mesh.position.set(0, HFY, 0);
    hf.mesh.userData.part = 'obrobok';
    workG.add(hf.mesh);
    crashes.n = 0;
  };
  makeWork();
  // ---------- panel ----------
  const pan = grp('ovladanie', col);
  rbox(pan, 1.8, 1.92, 3.0, 6.0, -4.2, -2.4, M.panel, 0.04);
  const face = new THREE.Group();
  face.position.set(1.92, -2.0, -3.3);
  face.rotation.y = Math.PI / 2;
  pan.add(face);
  const mSw = mainSwitch(kit, M, face, 0, 7.2, 0.01);
  const bStart = panelButton(kit, M, face, -0.45, 6.2, 0.01, M.btnGreen),
    bStop = panelButton(kit, M, face, 0, 6.2, 0.01, M.red),
    bCool = panelButton(kit, M, face, 0.45, 6.2, 0.01, M.blue);
  const lampRun = M.lamp.clone();
  ball(face, 0.07, 0.6, 7.2, 0.03, lampRun);
  cable(col, [
    [1.86, 3.0, -3.3],
    [2.1, 1.8, -3.2],
    [2.2, 0.6, -3.1],
  ]);
  const lamp = x.lamp({
    parent: col,
    base: v3(-1.4, 13.8, -2.6),
    elbow: v3(-2.4, 14.4, -0.6),
    head: v3(-1.4, 12.6, 2.6),
    aim: v3(0, 9.0, 0.4),
    angle: 0.5,
    power: 2.4,
  });
  // ---------- stav a geometria nástroja ----------
  Object.assign(st, { x: c.x, y: c.y, z: c.z, q: c.q, tilt: c.tilt, rpm: 0, a: 0, cutT: -9 });
  const kneeY = (z = st.z) => K0 + z / 100;
  const place = () => {
    knee.position.set(0, kneeY(), 0);
    sad.position.z = (st.y - 255) / 100;
    tblX.position.x = st.x / 100;
    head.rotation.z = (-st.tilt * Math.PI) / 180;
    quillG.position.y = -st.q / 100;
    if (toolG.userData.tool !== c.tool && !c.running) buildTool();
  };
  place();
  const tmp = new THREE.Vector3();
  const toolLocal = () => {
    place();
    hf.mesh.updateWorldMatrix(true, false);
    const t = FNK.tools[toolG.userData.tool],
      a = toolAxis(st.tilt),
      len = t.len / 100,
      // čelo nástroja vo svete: čap − os · (NOSE + výsuv pinoly + dĺžka nástroja)
      dd = NOSE + st.q / 100 + len;
    tmp.set(0 - a[0] * dd, HY - a[1] * dd, HZ).applyMatrix4(hf.mesh.matrixWorld.clone().invert());
    return { E: [tmp.x, tmp.y, tmp.z], a, r: t.d / 200, len };
  };
  const probe = () => {
    const q = toolLocal(),
      R2 = q.r + q.len;
    let pen = 0;
    hf.eachRect(q.E[0] - R2, q.E[0] + R2, q.E[2] - q.r, q.E[2] + q.r, (i, xx, zz) => {
      const yb = endMillBottom(q.E, q.a, q.r, q.len, xx, zz);
      if (yb < hf.hgt[i]) pen = Math.max(pen, hf.hgt[i] - yb);
    });
    let obst = null;
    for (let xx = -0.55; xx <= 0.55; xx += 0.04)
      for (const zz of [-WZ / 2 - 0.07, WZ / 2 + 0.07])
        if (endMillBottom(q.E, q.a, q.r, q.len, xx, zz) < WH - 0.2) obst = L('čeľusti zveráka', 'the vise jaws');
    if (q.E[1] < 0.6 - HFY + 0.01) obst = obst || L('stola', 'the table');
    return { pen, obst, q };
  };
  const doCut = (q) => {
    let removed = 0;
    const R2 = q.r + q.len;
    hf.cutRect(q.E[0] - R2, q.E[0] + R2, q.E[2] - q.r, q.E[2] + q.r, (i, xx, zz) => {
      const yb = endMillBottom(q.E, q.a, q.r, q.len, xx, zz);
      if (yb < hf.hgt[i]) {
        removed += hf.hgt[i] - Math.max(0, yb);
        hf.hgt[i] = Math.max(0, yb);
        hf.mask[i] = 1;
      }
    });
    if (removed > 0) hf.rebuild();
    return removed;
  };
  Object.assign(anchors, {
    stojan: () => v3(0, 9.0, -5.8),
    hlava: () => v3(0.9, HY + 1.4, HZ + 0.85),
    konzola: () => v3(-1.8, kneeY() - 1.0, 2.2),
    obrobok: () => v3(st.x / 100, kneeY() + 0.5 + HFY + WH, (st.y - 255) / 100),
    ovladanie: () => v3(1.92, 8.0, -3.7),
  });
  Object.assign(views, {
    celok: () => [
      [10, 13, 14],
      [0, 8.6, 0],
    ],
    rez: () => [[2.6, 10.6, 3.4], [0.4, 9.1, 0.3], true],
    spredu: () => [[0, 10, 9], [0, 9.2, 0.3], true],
    panel: () => [[6.6, 7, -2.2], [1.9, 6.6, -3.7], true],
  });
  // ---------- ovládanie ----------
  const stopped = () => !c.running && st.rpm < 1;
  const start = needPower(() => {
    if (!c.headLock) {
      say(L('Najprv upni hlavu.', 'Clamp the head first.'));
      return;
    }
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
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
        if (!i) push('running', false);
      },
      read: () => (c.power ? 'I' : '0'),
    },
    mSw,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('ŠTART vretena', 'Spindle START'),
      hint: LL('Spustí vreteno (hlava musí byť upnutá).', 'Starts the spindle (the head must be clamped).'),
      action: start,
    },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP vretena', 'Spindle STOP'),
      hint: LL('Zastaví vreteno aj posuvy.', 'Stops the spindle and the feeds.'),
      action: () => {
        push('running', false);
        push('feedX', 0);
        push('feedY', 0);
      },
    },
    bStop,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Chladenie', 'Coolant'),
      hint: LL('Zapne alebo vypne chladenie.', 'Switches the coolant on or off.'),
      action: () => push('coolant', !c.coolant),
    },
    bCool,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.2,
      label: LL('Upnutie hlavy', 'Head clamp'),
      hint: LL(
        'Hore = upnutá. Uvoľnená hlava sa natáča šnekom (len pri stojacom vretene).',
        'Up = clamped. Released, the head is swivelled by the worm (spindle stopped only).',
      ),
      getIdx: () => (c.headLock ? 0 : 1),
      onSet: (i) =>
        stopped() || i === 0
          ? push('headLock', i === 0)
          : say(
              L('Hlava sa uvoľňuje len pri stojacom vretene.', 'The head is released only with the spindle stopped.'),
            ),
      read: () => (c.headLock ? L('upnutá', 'clamped') : L('uvoľnená', 'released')),
    },
    levHead,
  );
  const feedLever = (key, label, obj) =>
    ctrl.reg(
      {
        type: 'lever',
        angles: [0.6, 0, -0.6],
        minR: 0.2,
        label,
        hint: LL(
          'Posuv v jednom smere / 0 / v druhom smere (len pri bežiacom vretene).',
          'Feed one way / 0 / the other way (only with the spindle running).',
        ),
        getIdx: () => c[key] + 1,
        onSet: (i) => push(key, i - 1),
        read: () => ['−', '0', '+'][c[key] + 1],
      },
      obj,
    );
  feedLever('feedX', LL('Páka posuvu X', 'Feed lever X'), levFX);
  feedLever('feedY', LL('Páka posuvu Y', 'Feed lever Y'), levFY);
  const wheel = (label, hint, key, perTurn, lo, hi, obj, read, guard) =>
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.2,
        inc: 1,
        label,
        hint,
        guard,
        turn: (d) => push(key, clamp(Math.round((c[key] + (d / TAU) * perTurn) * 100) / 100, lo, hi)),
        read,
      },
      obj,
    );
  wheel(
    LL('Koleso stola (X)', 'Table handwheel (X)'),
    LL('1 otáčka = 5 mm.', '1 turn = 5 mm.'),
    'x',
    5,
    -400,
    400,
    wX,
    () => `X ${st.x.toFixed(2)} mm`,
    () => !c.feedX || (say(L('Najprv vypni posuv X.', 'Disengage feed X first.')), false),
  );
  wheel(
    LL('Koleso priečnych saní (Y)', 'Cross-slide handwheel (Y)'),
    LL('1 otáčka = 5 mm.', '1 turn = 5 mm.'),
    'y',
    5,
    -185,
    370,
    wY,
    () => `Y ${st.y.toFixed(2)} mm`,
    () => !c.feedY || (say(L('Najprv vypni posuv Y.', 'Disengage feed Y first.')), false),
  );
  wheel(
    LL('Kľuka konzoly (Z)', 'Knee crank (Z)'),
    LL('1 otáčka = 2 mm.', '1 turn = 2 mm.'),
    'z',
    2,
    -300,
    150,
    cZ,
    () => `Z ${st.z.toFixed(2)} mm`,
  );
  wheel(
    LL('Koliesko pinoly', 'Quill handwheel'),
    LL('Vysúva nástroj pozdĺž osi. 1 otáčka = 2 mm.', 'Extends the tool along its axis. 1 turn = 2 mm.'),
    'q',
    2,
    0,
    80,
    wQ,
    () => `${st.q.toFixed(2)} mm`,
  );
  wheel(
    LL('Šnek natáčania hlavy', 'Head swivel worm'),
    LL('1 otáčka = 3°, rozsah ±45°.', '1 turn = 3°, range ±45°.'),
    'tilt',
    3,
    -45,
    45,
    wTilt,
    () => `${st.tilt.toFixed(1)}°`,
    () => {
      if (c.headLock) {
        say(L('Hlava je upnutá – uvoľni páku.', 'The head is clamped – release the lever.'));
        return false;
      }
      return true;
    },
  );
  apiRef.current.newBlank = () => {
    if (!stopped()) {
      say(L('Obrobok sa mení pri stojacom vretene.', 'The work is changed with the spindle stopped.'));
      return false;
    }
    makeWork();
    say(L('Upnutý nový hranol 100 × 80 × 60 mm.', 'A new block 100 × 80 × 60 mm is clamped.'), 'info');
    return true;
  };
  // ---------- slučka ----------
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    if (c.running && !c.headLock) {
      push('running', false);
      say(L('Hlava nie je upnutá – vreteno zastavené.', 'The head is not clamped – spindle stopped.'), 'danger');
    }
    const t0 = FNK.tools[c.tool];
    st.rpm = approach(st.rpm, c.running && c.power ? FNK.speeds[c.sp] : 0, 3000 * dt);
    const running = st.rpm > 5;
    st.a += (st.rpm / 60) * TAU * dt * 0.1;
    toolG.rotation.y = -st.a;
    const dts = dt * c.timeScale,
      fr = (FNK.feeds[c.fd] / 60) * dts;
    for (const [key, ax, lo, hi] of [
      ['feedX', 'x', -400, 400],
      ['feedY', 'y', -185, 370],
    ]) {
      if (!c[key]) continue;
      if (!running) {
        push(key, 0);
        sayOnce(
          'feedStop',
          true,
          L('Posuv ide len pri bežiacom vretene.', 'The feed runs only with the spindle running.'),
          'info',
        );
        continue;
      }
      c[ax] = clamp(c[ax] + c[key] * fr, lo, hi);
      pend[ax] = Math.round(c[ax] * 10) / 10;
      if (c[ax] <= lo || c[ax] >= hi) push(key, 0);
    }
    const old = { x: st.x, y: st.y, z: st.z, q: st.q, tilt: st.tilt };
    st.x = approach(st.x, c.x, c.feedX && running ? 1e9 : 400 * dt);
    st.y = approach(st.y, c.y, c.feedY && running ? 1e9 : 400 * dt);
    st.z = approach(st.z, c.z, 120 * dt);
    st.q = approach(st.q, c.q, 60 * dt);
    st.tilt = c.headLock ? st.tilt : approach(st.tilt, c.tilt, 30 * dt);
    const moved = ['x', 'y', 'z', 'q', 'tilt'].some((k) => old[k] !== st[k]);
    if (moved || running) {
      const p = probe();
      const block = (why) => {
        Object.assign(st, old);
        for (const k of ['x', 'y', 'z', 'q']) {
          c[k] = st[k];
          pend[k] = st[k];
        }
        push('feedX', 0);
        push('feedY', 0);
        place();
        sayOnce('crash', true, why, 'danger');
      };
      if (p.obst) {
        if (!st.crashFlag) crashes.n++;
        st.crashFlag = true;
        block(
          `${L('Fréza by narazila do', 'The cutter would hit')} ${p.obst} – ${L('pohyb je zastavený.', 'the motion is stopped.')}`,
        );
      } else if (p.pen > 1e-5 && !running) {
        block(
          L(
            'Fréza sa dotkla obrobku pri stojacom vretene – spusti vreteno.',
            'The cutter touched the work with the spindle stopped – start the spindle.',
          ),
        );
      } else {
        st.crashFlag = false;
        if (p.pen > 1e-5 && doCut(p.q) > 0) {
          st.cutT = t;
          sayOnce(
            'speed',
            cuttingSpeed(FNK.speeds[c.sp], t0.d) > 45,
            L(
              'Príliš vysoké otáčky pre HSS v oceli – zníž otáčky.',
              'Speed too high for HSS in steel – reduce the speed.',
            ),
            'warn',
          );
          sayOnce(
            'cool',
            !c.coolant,
            L('Režeš bez chladenia – zapni chladiacu kvapalinu.', 'Cutting without coolant – switch the coolant on.'),
            'info',
          );
        }
      }
    }
    place();
    lampRun.emissive.setHex(running ? 0x22dd55 : 0);
    lamp.update(c.light);
    wX.rotation.z = (st.x / 5) * TAU;
    wY.rotation.z = (st.y / 5) * TAU;
    cZ.rotation.z = (st.z / 2) * TAU;
    wQ.rotation.z = (st.q / 2) * TAU;
    wTilt.rotation.z = (st.tilt / 3) * TAU;
  };
  return {
    update,
    tele: () => ({ rpm: st.rpm, x: st.x, y: st.y, z: st.z, q: st.q, tilt: st.tilt, cutting: x.time() - st.cutT < 0.3 }),
    measure: () => {
      const hfm = {
        hgt: Array.from(hf.hgt, (h) => h * 100),
        NX: hf.NX,
        NZ: hf.NZ,
        W: WX * 100,
        D: WZ * 100,
        H: WH * 100,
      };
      return { ch: chamferInfo(hfm), slot: slotInfo(hfm), crashes: crashes.n };
    },
    workObj: () => workG,
    workSpot: () => v3(0, 11, 7),
    canInspect: () => (!stopped() ? L('Najprv zastav vreteno.', 'Stop the spindle first.') : null),
    sound: () => ({ motor: st.rpm / 4500, cut: x.time() - st.cutT < 0.3 ? 0.6 : 0 }),
  };
}

export { FnkSimulator };
export default FnkSimulator;
