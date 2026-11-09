import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL, RPM } from '../core/i18n';
import { createHeightField } from '../core/heightField';
import { angleScaleTex } from '../core/detail';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { SlotDrawing } from '../ui/sketch2';
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
import { FGU, cuttingSpeed, discBottom, fguChecks, isClimb, slotInfo } from './fguMath';

// =====================================================================
// UNIVERZÁLNA KONZOLOVÁ FRÉZKA TOS OLOMOUC FGU 32
// vodorovné vreteno s tŕňom a podperou, kotúčová fréza Ø100 × 10, otočný stôl ±45°, vymedzenie vôle
// =====================================================================
const SY = 11.0, // os vretena
  CZ = 0.6, // stred kotúčovej frézy na tŕni
  R = FGU.cutterD / 200,
  B = FGU.cutterB / 100,
  K0 = 7.8, // výška konzoly pri Z = 0 (obrobok 50 mm pod frézou)
  WX = 1.8,
  WZ = 1.0,
  WH = 0.6,
  HFY = 0.95; // spodok obrobku nad stredom stola (lokálne)

const fguParts = () =>
  mkParts([
    [
      'stojan',
      'Stojan',
      'Column',
      'Stojan s prevodovkou',
      'Column with gearbox',
      'Liatinový stojan nesie vreteno, previsnuté rameno a vedenie konzoly. Vnútri je 12-stupňová prevodovka otáčok 31,5 – 1 400 ot/min.',
      'The cast-iron column carries the spindle, the overarm and the knee ways. Inside is the 12-speed gearbox, 31.5 – 1,400 rpm.',
    ],
    [
      'rameno',
      'Previsnuté rameno',
      'Overarm',
      'Previsnuté rameno s podperou tŕňa',
      'Overarm with arbor support',
      'Rameno nad vretenom nesie podperu, ktorá drží koniec frézovacieho tŕňa – tŕň sa pri reze neprehne.',
      'The arm above the spindle carries the support holding the end of the milling arbor so it does not bend in the cut.',
    ],
    [
      'freza',
      'Kotúčová fréza',
      'Side-and-face cutter',
      'Kotúčová fréza na tŕni',
      'Side-and-face cutter on the arbor',
      'Fréza Ø100 × 10 mm na vodorovnom tŕni. Šírka frézy dáva šírku drážky; smer otáčania volí páka na stojane.',
      'Ø100 × 10 mm cutter on the horizontal arbor. Its width gives the slot width; the rotation is selected by the lever on the column.',
    ],
    [
      'konzola',
      'Konzola',
      'Knee',
      'Konzola (os Z)',
      'Knee (Z axis)',
      'Konzola sa zdvíha kľukou po vedení stojana – určuje hĺbku rezu. Na jej čele je koleso priečnych saní.',
      'The knee is raised by the crank on the column ways – it sets the depth of cut. The cross-slide handwheel is on its front.',
    ],
    [
      'stol',
      'Stôl',
      'Table',
      'Otočný stôl (os X, natočenie ±45°)',
      'Swivel table (X axis, ±45°)',
      'Univerzálna frézka má stôl na otočnej doske – po uvoľnení páky sa natočí až o 45° (šikmé a skrutkovicové drážky). Pozdĺžny posuv zapína páka vpredu.',
      'The universal mill has its table on a swivel plate – released, it turns up to 45° (inclined and helical slots). The lever at the front engages the longitudinal feed.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Hranol vo zveráku',
      'Block in the vise',
      'Oceľový hranol 180 × 100 × 60 mm na podložkách vo zveráku; čeľuste sú 20 mm pod hornou plochou.',
      'Steel block 180 × 100 × 60 mm on parallels in the vise; the jaws are 20 mm below the top face.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládací panel',
      'Control panel',
      'Hlavný vypínač, štart a stop vretena, chladenie. Otáčky a posuvy sa volia pri stojacom vretene.',
      'Main switch, spindle start and stop, coolant. Speeds and feeds are selected with the spindle stopped.',
    ],
  ]);

const FGU_TASKS = [
  {
    id: 'drazka',
    title: () => L('Drážka 10 × 5 cez celý hranol', 'Slot 10 × 5 through the block'),
    desc: () =>
      L(
        'Kotúčovou frézou Ø100 × 10 vyfrézuj pozdĺžnu drážku hĺbky 5 ±0,15 mm cez celú dĺžku hranola (stôl nenatočený). Zvoľ otáčky pre HSS v oceli (25 – 35 m/min) a nesúsledné frézovanie – súsledné len so zapnutým vymedzením vôle.',
        'Mill a longitudinal slot 5 ±0.15 mm deep through the whole block with the Ø100 × 10 cutter (table not swivelled). Choose the speed for HSS in steel (25 – 35 m/min) and conventional milling – climb milling only with the backlash eliminator on.',
      ),
    setup: { swivel: 0 },
    drawing: () => <SlotDrawing b={10} h={5} />,
    labels: {
      depth: () => L('Hĺbka 5 ±0,15 mm', 'Depth 5 ±0.15 mm'),
      through: () => L('Drážka cez celú dĺžku', 'Slot through the whole length'),
      angle: () => L('Rovnobežná s hranou', 'Parallel to the edge'),
      climb: () => L('Bez súsledného rezu bez vymedzenia vôle', 'No climb cut without backlash eliminator'),
    },
  },
  {
    id: 'sikma',
    title: () => L('Šikmá drážka pod 15°', 'Slot inclined at 15°'),
    desc: () =>
      L(
        'Natoč stôl o 15° (uvoľni páku otočnej dosky, natoč kolesom a znova upni) a vyfrézuj drážku hĺbky 3 ±0,15 mm cez celý hranol.',
        'Swivel the table by 15° (release the swivel lock, turn it with the wheel and lock it again) and mill a slot 3 ±0.15 mm deep through the whole block.',
      ),
    setup: { swivel: 0 },
    drawing: () => <SlotDrawing b={10} h={3} a={15} />,
    labels: {
      depth: () => L('Hĺbka 3 ±0,15 mm', 'Depth 3 ±0.15 mm'),
      angle: () => L('Uhol 15 ±0,5°', 'Angle 15 ±0.5°'),
      through: () => L('Drážka cez celú dĺžku', 'Slot through the whole length'),
      climb: () => L('Bez súsledného rezu bez vymedzenia vôle', 'No climb cut without backlash eliminator'),
    },
  },
].map((t) => ({ ...t, checks: (m) => fguChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

const FGU_SAFETY = () => [
  L(
    'Kryt frézy je nasadený, obrobok pevne v zveráku, kľúč je vybratý.',
    'The cutter guard is on, the work is tight in the vise, the key is removed.',
  ),
  L(
    'Súsledne frézujem len so zapnutým vymedzením vôle skrutky stola.',
    'I climb-mill only with the table screw backlash eliminator on.',
  ),
  L(
    'Meriam a upínam len pri stojacom vretene, triesky odstraňujem štetcom.',
    'I measure and clamp only with the spindle stopped and remove chips with a brush.',
  ),
];

function FguSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    running: false,
    dir: 1,
    sp: 3,
    fd: 3,
    feedX: 0,
    x: 260,
    y: 60,
    z: 0,
    swivel: 0,
    swLock: true,
    backlash: false,
    coolant: false,
    light: true,
    manual: false,
    timeScale: 4,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, x: 260, y: 60, z: 0, sw: 0, cutting: false, climb: false, msg: null });

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
      colors: [0x86a58f, 0x6f8e78, 0x52705b],
      mats: {
        work: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
        cutter: [0xb9a46a, 0.3, 0.85],
        chip: [0xa6adb4, 0.3, 0.85],
      },
      name: L('Univerzálna konzolová frézka TOS FGU 32', 'TOS FGU 32 universal knee-type milling machine'),
      sound: 'mill',
      debugKey: '__fgu',
      build: (x) => buildFgu(x),
    });
  }, []);

  const parts = fguParts();
  const v = cuttingSpeed(FGU.speeds[ui.sp]);
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.cutting
        ? {
            kind: tele.climb && !ui.backlash ? 'danger' : 'run',
            text: `${L('Frézovanie', 'Milling')} ${tele.climb ? L('súsledné', 'climb') : L('nesúsledné', 'conventional')} – X ${tele.x.toFixed(1)} mm, Z ${tele.z.toFixed(2)} mm`,
          }
        : tele.rpm > 5
          ? {
              kind: 'run',
              text: L(
                'Vreteno sa točí. Prisuň obrobok k fréze a zapni posuv stola.',
                'The spindle runs. Bring the work to the cutter and engage the table feed.',
              ),
            }
          : {
              kind: 'idle',
              text: L(
                'Zvoľ otáčky a smer, spusti vreteno a nastav hĺbku kľukou konzoly.',
                'Select speed and direction, start the spindle and set the depth with the knee crank.',
              ),
            };
  const chips = [
    {
      color: tele.rpm > 5 ? '#3ee06c' : '#8b8f89',
      text: tele.rpm > 5 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Vreteno stojí', 'Spindle stopped'),
    },
  ];
  if (Math.abs(tele.sw) > 0.05) chips.push({ color: '#7fb6ff', text: `${L('stôl', 'table')} ${tele.sw.toFixed(1)}°` });
  if (ui.backlash) chips.push({ color: '#ffd166', text: L('Vymedzenie vôle', 'Backlash elim.') });
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
            'Nesúsledné frézovanie: zub fréze ide proti posuvu obrobku. Súsledné dáva lepší povrch, ale bez vymedzenia vôle vtiahne stôl do frézy.',
            'Conventional milling: the tooth moves against the work feed. Climb milling gives a better finish but without the backlash eliminator it pulls the table into the cutter.',
          ),
          L(
            'Hĺbku nastav kľukou konzoly mimo obrobku, až potom zapni pozdĺžny posuv.',
            'Set the depth with the knee crank clear of the work, then engage the longitudinal feed.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · frézka', 'Simulator · mill')}
            title={L('Univerzálna konzolová frézka', 'Universal knee-type milling machine')}
            sub={L(
              'Predloha: TOS Olomouc FGU 32 – stôl 320 × 1 250 mm, X 850 / Y 275 / Z 420 mm, 12 otáčok 31,5 – 1 400 ot/min, natočenie stola ±45°. Mierka 1 : 100 mm.',
              'Modelled after the TOS Olomouc FGU 32 – table 320 × 1,250 mm, X 850 / Y 275 / Z 420 mm, 12 speeds 31.5 – 1,400 rpm, table swivel ±45°. Scale 1 : 100 mm.',
            )}
            rows={[
              ['X', tele.x.toFixed(1)],
              ['Y', tele.y.toFixed(1)],
              ['Z', tele.z.toFixed(2)],
            ]}
            foot={[`${FGU.speeds[ui.sp]} ${RPM()}`, `v ${v.toFixed(0)} m/min`, `${FGU.feeds[ui.fd]} mm/min`]}
            status={statusMsg}
          />
          <TaskSection
            machine="fgu"
            tasks={FGU_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'running', items: FGU_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Vreteno', 'Spindle')}</h2>
            <button
              type="button"
              className="btn-run w-full"
              data-run={String(!!ui.running)}
              onClick={() => apiRef.current.toggleRun?.()}
            >
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
              label={L('Otáčky vretena', 'Spindle speed')}
              value={ui.sp}
              options={FGU.speeds.map((n, i) => [i, String(n)])}
              onChange={(i) => !ui.running && set('sp', i)}
            />
            <p className="text-xs muted">
              {L(
                `Rezná rýchlosť ${v.toFixed(0)} m/min (HSS v oceli 25 – 35 m/min).`,
                `Cutting speed ${v.toFixed(0)} m/min (HSS in steel 25 – 35 m/min).`,
              )}
            </p>
            <SegRow
              label={L('Smer otáčania', 'Rotation')}
              value={ui.dir}
              options={[
                [1, L('vpravo', 'right')],
                [-1, L('vľavo', 'left')],
              ]}
              onChange={(d) => !ui.running && set('dir', d)}
            />
            <Toggle on={ui.coolant} label={L('Chladenie', 'Coolant')} onClick={() => set('coolant', !ui.coolant)} />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Stôl a posuvy', 'Table and feeds')}</h2>
              <SectionInfo title={L('Súsledné a nesúsledné frézovanie', 'Climb and conventional milling')}>
                <p className="text-xs muted">
                  {L(
                    'Pri súslednom frézovaní ťahá zub obrobok so sebou; vôľa skrutky stola sa vtedy vyberie náhle a stôl skočí do frézy. Vymedzenie vôle (páka na stole) to zabráni.',
                    'In climb milling the tooth pulls the work along; the table screw backlash is taken up suddenly and the table jumps into the cutter. The backlash eliminator (lever on the table) prevents it.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label={L('Posuv stola', 'Table feed')}
              value={ui.fd}
              options={FGU.feeds.map((f, i) => [i, String(f)])}
              onChange={(i) => set('fd', i)}
            />
            <SegRow
              label={L('Pozdĺžny posuv X', 'Longitudinal feed X')}
              value={ui.feedX}
              options={[
                [-1, '◀'],
                [0, '0'],
                [1, '▶'],
              ]}
              onChange={(d) => set('feedX', d)}
            />
            <Toggle
              on={ui.backlash}
              label={L('Vymedzenie vôle', 'Backlash eliminator')}
              onClick={() => set('backlash', !ui.backlash)}
            />
            <Slider
              id="fx"
              label={L('Stôl X', 'Table X')}
              unit="mm"
              min={-425}
              max={425}
              step={0.5}
              value={ui.x}
              actual={tele.x}
              digits={1}
              onChange={(val) => set('x', val)}
            />
            <Slider
              id="fy"
              label={L('Priečne sane Y', 'Cross slide Y')}
              unit="mm"
              min={-140}
              max={135}
              step={0.5}
              value={ui.y}
              actual={tele.y}
              digits={1}
              onChange={(val) => set('y', val)}
            />
            <Slider
              id="fz"
              label={L('Konzola Z', 'Knee Z')}
              unit="mm"
              min={-280}
              max={140}
              step={0.05}
              value={ui.z}
              actual={tele.z}
              digits={2}
              onChange={(val) => set('z', val)}
            />
            <Toggle
              on={!ui.swLock}
              label={L('Otočná doska uvoľnená', 'Swivel plate released')}
              onClick={() => set('swLock', !ui.swLock)}
            />
            <Slider
              id="fsw"
              label={L('Natočenie stola', 'Table swivel')}
              unit="°"
              min={-45}
              max={45}
              step={0.5}
              value={ui.swivel}
              actual={tele.sw}
              digits={1}
              onChange={(val) => set('swivel', val)}
              disabled={ui.swLock}
            />
          </div>
          <BlankSection
            onApply={() => apiRef.current.newBlank?.()}
            applyLabel={L('Upnúť nový hranol', 'Clamp a new block')}
          >
            <p className="text-xs muted">
              {L(
                'Oceľ 11 523, hranol 180 × 100 × 60 mm na podložkách.',
                'Steel S355, block 180 × 100 × 60 mm on parallels.',
              )}
            </p>
          </BlankSection>
          <ExportSection machine="fgu" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail rezu', 'Cut detail')],
              ['zhora', L('Zhora', 'Top')],
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

function buildFgu(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, box, cylY, cylZ, ball, handwheel, crank, pivotLever, detents } = kit;
  const { rbox, ribs, nameplate, oilGlass, valuePlate, cable } = det;
  // ---------- stojan, previsnuté rameno, podpera ----------
  const col = grp('stojan');
  rbox(col, -2.6, 2.6, 0, 0.5, -6.6, 3.4, M.greenDeep, 0.1); // základová doska s vaňou
  rbox(col, -2.0, 2.0, 0.5, 15.0, -6.4, -2.4, M.green, 0.25);
  ribs(col, 'y', 2.0, 14.0, 6, -2.0, 2.0, -6.55, 0.15, 0.12, M.greenDark);
  box(col, -1.4, -1.0, 1.0, 13.6, -2.4, -2.32, M.ways); // vedenie konzoly
  box(col, 1.0, 1.4, 1.0, 13.6, -2.4, -2.32, M.ways);
  rbox(col, -1.0, 1.0, SY - 0.9, SY + 0.9, -2.4, -2.1, M.greenDark, 0.08); // čelo vretena
  cylZ(col, 0.45, 0.45, -2.1, -1.9, 0, SY, M.steelDark, 32);
  nameplate(col, 0, 6.2, -2.39, 0, 'TOS Olomouc', 'FGU 32', 1.25);
  oilGlass(col, 1.2, 4.0, -2.38);
  valuePlate(col, -0.9, 13.9, -2.39, 0, 'n [1/min]', FGU.speeds, 1.1);
  const arm = grp('rameno');
  rbox(arm, -0.9, 0.9, 15.0, 16.4, -6.2, 4.0, M.green, 0.2);
  // podpera tŕňa visiaca z ramena
  rbox(arm, -0.6, 0.6, SY - 0.4, 15.0, 3.0, 3.6, M.green, 0.12);
  cylZ(arm, 0.28, 0.28, 2.95, 3.65, 0, SY, M.greenDark, 24);
  cylZ(arm, 0.08, 0.08, 3.65, 3.8, 0.4, 15.6, M.black, 10);
  // ---------- vreteno, tŕň a kotúčová fréza ----------
  const fr = grp('freza');
  const spin = new THREE.Group();
  spin.position.set(0, SY, 0);
  fr.add(spin);
  cylZ(spin, 0.16, 0.16, -1.9, 3.3, 0, 0, M.steel, 20); // tŕň
  [-1.2, -0.5, 1.1, 1.9, 2.6].forEach((z) => cylZ(spin, 0.24, 0.24, z, z + 0.42, 0, 0, M.steelDark, 20)); // rozperné krúžky
  const cutter = new THREE.Group();
  cutter.position.z = CZ;
  spin.add(cutter);
  cylZ(cutter, R - 0.04, R - 0.04, -B / 2, B / 2, 0, 0, M.cutter, 48);
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU,
      tooth = add(
        cutter,
        new THREE.BoxGeometry(0.07, 0.05, B * 1.02),
        M.cutter,
        Math.cos(a) * (R - 0.02),
        Math.sin(a) * (R - 0.02),
        0,
      );
    tooth.rotation.z = a + 0.4;
  }
  cylZ(cutter, 0.25, 0.25, -B / 2 - 0.01, B / 2 + 0.01, 0, 0, M.steel, 20);
  // kryt frézy (polovičný prstenec nad frézou)
  const guard = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.12, R + 0.12, B + 0.3, 32, 1, true, 0, Math.PI),
    M.yellow,
  );
  guard.material = guard.material.clone();
  guard.material.side = THREE.DoubleSide;
  guard.geometry.rotateX(Math.PI / 2);
  guard.geometry.rotateZ(Math.PI / 2);
  guard.position.set(0, SY, CZ);
  fr.add(guard);
  // ---------- konzola, sane, otočná doska, stôl, zverák ----------
  const knee = grp('konzola');
  rbox(knee, -2.0, 2.0, -2.6, 0, -2.3, 2.4, M.green, 0.15);
  ribs(knee, 'x', -1.8, 1.8, 3, -2.4, -0.2, 2.4, 0.1, 0.12, M.greenDark);
  cylY(knee, 0.18, 0.18, -7.4, -2.6, 0, 0.6, M.steel, 14); // zdvíhacia skrutka
  const wY = handwheel(knee, 0.5, 0.0, -1.2, 2.55, 'z', 0.32); // koleso priečnych saní
  const cZ = crank(knee, 0.5, -1.3, -1.0, 2.45); // kľuka konzoly
  const sad = new THREE.Group();
  knee.add(sad);
  rbox(sad, -1.8, 1.8, 0, 0.5, -1.9, 1.9, M.greenDark, 0.08);
  const swv = new THREE.Group();
  swv.position.y = 0.5;
  sad.add(swv);
  cylY(swv, 1.6, 1.6, 0, 0.15, 0, 0, M.green, 48);
  const swTx = angleScaleTex(45, 1, { numR: 0.86, step: 15, len: 0.09 });
  if (swTx) {
    const ring = add(
      swv,
      new THREE.RingGeometry(1.35, 1.6, 96),
      new THREE.MeshStandardMaterial({ map: swTx, roughness: 0.4, metalness: 0.4 }),
      0,
      0.152,
      0,
    );
    ring.rotation.set(-Math.PI / 2, 0, Math.PI);
    ring.userData.noMerge = true;
    ring.castShadow = false;
  }
  box(sad, -0.03, 0.03, 0.5, 0.68, 1.6, 1.72, M.red); // ryska natočenia (vpredu)
  const tbl = grp('stol', swv);
  tbl.position.y = 0.15;
  const tblX = new THREE.Group();
  tbl.add(tblX);
  rbox(tblX, -6.25, 6.25, 0, 0.6, -1.6, 1.6, M.green, 0.08);
  for (const z of [-0.9, 0, 0.9]) box(tblX, -6.2, 6.2, 0.56, 0.61, z - 0.1, z + 0.1, M.black); // T-drážky
  const wX = handwheel(tblX, 0.45, -6.55, 0.3, 0, '-x', 0.3);
  box(tblX, -6.25, 6.25, 0.1, 0.5, 1.6, 1.66, M.steelDark); // pravítko so stupnicou
  // páka pozdĺžneho posuvu a vymedzenia vôle na čele stola
  cylZ(tblX, 0.15, 0.13, 1.6, 1.72, 0.8, 0.3, M.black, 18);
  detents(tblX, 0.8, 0.3, 1.72, 0.2, [0.6, 0, -0.6], 0.025);
  const levFeed = pivotLever(tblX, 0.8, 0.3, 1.74, 0.42, 1.2);
  const levBack = pivotLever(tblX, -1.0, 0.3, 1.66, 0.34, 1.2);
  const levLock = pivotLever(sad, 1.4, 0.25, 1.9, 0.36, 1.2); // upnutie otočnej dosky
  const wSw = handwheel(sad, 0.24, -1.4, 0.25, 1.92, 'z', 0.12); // natáčanie stola (1 otáčka = 5°)
  // zverák a obrobok
  const vise = new THREE.Group();
  tblX.add(vise);
  rbox(vise, -0.95, 0.95, 0.6, 0.75, -0.95, 0.95, M.steelDark, 0.03);
  rbox(vise, -0.75, 0.75, 0.75, HFY + WH - 0.2, -WZ / 2 - 0.16, -WZ / 2, M.steel, 0.02); // pevná čeľusť
  rbox(vise, -0.75, 0.75, 0.75, HFY + WH - 0.2, WZ / 2, WZ / 2 + 0.16, M.steel, 0.02); // pohyblivá čeľusť
  [-0.5, 0.5].forEach((xx) => box(vise, xx - 0.25, xx + 0.25, 0.75, HFY, -0.45, 0.45, M.steel)); // podložky
  const workG = grp('obrobok', tblX);
  let hf = null;
  const crashes = { n: 0 },
    flagsW = { climbBad: false };
  const makeWork = () => {
    if (hf) {
      workG.remove(hf.mesh);
      hf.dispose();
    }
    hf = createHeightField({ NX: 90, NZ: 50, W: WX, D: WZ, H: WH, raw: 0x474b50, cut: 0xdfe3e7, mat: M.work });
    hf.mesh.position.set(0, HFY, 0);
    hf.mesh.userData.part = 'obrobok';
    workG.add(hf.mesh);
    flagsW.climbBad = false;
    crashes.n = 0;
  };
  makeWork();
  // ---------- ovládací panel na stojane ----------
  const pan = grp('ovladanie', col);
  rbox(pan, 2.0, 2.12, 5.4, 8.4, -4.8, -3.0, M.panel, 0.04);
  const face = new THREE.Group();
  face.position.set(2.12, 0, -3.9);
  face.rotation.y = Math.PI / 2;
  pan.add(face);
  const mSw = mainSwitch(kit, M, face, 0, 7.6, 0.01);
  const bStart = panelButton(kit, M, face, -0.45, 6.6, 0.01, M.btnGreen),
    bStop = panelButton(kit, M, face, 0.0, 6.6, 0.01, M.red),
    bCool = panelButton(kit, M, face, 0.45, 6.6, 0.01, M.blue);
  const lampRun = M.lamp.clone();
  ball(face, 0.07, 0.6, 7.6, 0.03, lampRun);
  const levDir = pivotLever(col, 1.5, SY + 1.2, -2.3, 0.4, 1.2); // smer otáčania
  cable(col, [
    [2.06, 5.4, -3.9],
    [2.3, 3.0, -3.6],
    [2.4, 0.6, -3.3],
  ]);
  const lamp = x.lamp({
    parent: col,
    base: v3(-1.6, 15.0, -2.6),
    elbow: v3(-2.6, 15.6, -0.8),
    head: v3(-1.6, 13.2, 2.2),
    aim: v3(0, SY - 1.2, CZ),
    angle: 0.5,
    power: 2.4,
  });
  // ---------- stav ----------
  Object.assign(st, { x: c.x, y: c.y, z: c.z, sw: c.swivel, rpm: 0, a: 0, cutT: -9, climb: false });
  const kneeY = (z = st.z) => K0 + z / 100;
  const place = () => {
    knee.position.set(0, kneeY(), 0);
    sad.position.z = st.y / 100;
    swv.rotation.y = (st.sw * Math.PI) / 180;
    tblX.position.x = st.x / 100;
  };
  place();
  // fréza v súradniciach obrobku (hf.mesh): bod na osi a smer osi
  const pW = new THREE.Vector3(),
    aW = new THREE.Vector3();
  const cutterLocal = () => {
    hf.mesh.updateWorldMatrix(true, false);
    const inv = hf.mesh.matrixWorld.clone().invert();
    pW.set(0, SY, CZ).applyMatrix4(inv);
    aW.set(0, 0, 1).transformDirection(inv);
    return { px: pW.x, py: pW.y, pz: pW.z, ax: aW.x, az: aW.z };
  };
  const bottomAt = (q, xx, zz) => {
    const dx = xx - q.px,
      dz = zz - q.pz,
      s = dx * q.ax + dz * q.az;
    if (Math.abs(s) > B / 2) return Infinity;
    return discBottom(q.py, R, dx * -q.az + dz * q.ax);
  };
  // prienik frézy do obrobku, zveráka a stola pri danej polohe (bez zápisu)
  const probe = () => {
    place();
    const q = cutterLocal();
    let pen = 0;
    hf.eachRect(q.px - R - B, q.px + R + B, q.pz - R - B, q.pz + R + B, (i, xx, zz) => {
      const yb = bottomAt(q, xx, zz);
      if (yb < hf.hgt[i]) pen = Math.max(pen, hf.hgt[i] - yb);
    });
    let obst = null;
    const jawTop = WH - 0.2;
    for (let xx = -0.75; xx <= 0.75; xx += 0.05)
      for (const zz of [-WZ / 2 - 0.08, WZ / 2 + 0.08])
        if (bottomAt(q, xx, zz) < jawTop) obst = L('čeľusti zveráka', 'the vise jaws');
    for (let xx = -6.2; xx <= 6.2 && !obst; xx += 0.1)
      if (bottomAt(q, xx, q.pz) < 0.6 - HFY) obst = L('stola', 'the table');
    return { pen, obst, q };
  };
  const doCut = (q) => {
    let removed = 0;
    hf.cutRect(q.px - R - B, q.px + R + B, q.pz - R - B, q.pz + R + B, (i, xx, zz) => {
      const yb = bottomAt(q, xx, zz);
      if (yb < hf.hgt[i]) {
        removed += hf.hgt[i] - Math.max(0, yb);
        hf.hgt[i] = Math.max(0, yb);
        hf.mask[i] = 1;
      }
    });
    if (removed > 0) hf.rebuild();
    return removed;
  };
  // ---------- pohľady ----------
  Object.assign(anchors, {
    stojan: () => v3(0, 9.0, -6.4),
    rameno: () => v3(0, 16.4, 1.0),
    freza: () => v3(0, SY + R + 0.2, CZ),
    konzola: () => v3(-2.0, kneeY() - 1.2, 2.4),
    stol: () => v3(st.x / 100 + 4.5, kneeY() + 1.3, 1.6),
    obrobok: () => v3(st.x / 100, kneeY() + 0.65 + HFY + WH, 0.5),
    ovladanie: () => v3(2.12, 8.4, -3.9),
  });
  Object.assign(views, {
    celok: () => [
      [11, 13.5, 16],
      [0, 8.5, -0.5],
    ],
    rez: () => [[2.2, SY + 0.6, 4.2], [0, SY - 0.6, CZ], true],
    zhora: () => [[0.5, 20, 1.5], [0, kneeY(), 0], true],
    panel: () => [[7, 7.5, -2.5], [2.1, 6.9, -3.9], true],
  });
  // ---------- ovládanie ----------
  const stopped = () => !c.running && st.rpm < 1;
  const start = needPower(() => {
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
      hint: LL('Spustí vreteno zvoleným smerom.', 'Starts the spindle in the selected direction.'),
      action: start,
    },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP vretena', 'Spindle STOP'),
      hint: LL('Zastaví vreteno aj posuv.', 'Stops the spindle and the feed.'),
      action: () => {
        push('running', false);
        push('feedX', 0);
      },
    },
    bStop,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Chladenie', 'Coolant'),
      hint: LL('Zapne alebo vypne čerpadlo chladiacej kvapaliny.', 'Switches the coolant pump on or off.'),
      action: () => push('coolant', !c.coolant),
    },
    bCool,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.2,
      label: LL('Smer otáčania vretena', 'Spindle direction'),
      hint: LL(
        'Hore = vpravo, dole = vľavo. Mení sa len pri stojacom vretene.',
        'Up = right, down = left. Changed only with the spindle stopped.',
      ),
      getIdx: () => (c.dir > 0 ? 0 : 1),
      onSet: (i) =>
        stopped()
          ? push('dir', i === 0 ? 1 : -1)
          : say(L('Smer sa mení len pri stojacom vretene.', 'The direction is changed only with the spindle stopped.')),
      read: () => (c.dir > 0 ? L('vpravo', 'right') : L('vľavo', 'left')),
    },
    levDir,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.6, 0, -0.6],
      minR: 0.2,
      label: LL('Páka pozdĺžneho posuvu X', 'Longitudinal feed lever X'),
      hint: LL(
        'Vľavo / 0 / vpravo – posuv stola zvolenou rýchlosťou (len pri bežiacom vretene).',
        'Left / 0 / right – table feed at the selected rate (only with the spindle running).',
      ),
      getIdx: () => c.feedX + 1,
      onSet: (i) => push('feedX', i - 1),
      read: () => ['◀', '0', '▶'][c.feedX + 1],
    },
    levFeed,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.2,
      label: LL('Vymedzenie vôle skrutky stola', 'Table screw backlash eliminator'),
      hint: LL('Dole = zapnuté – potrebné pri súslednom frézovaní.', 'Down = on – needed for climb milling.'),
      getIdx: () => (c.backlash ? 1 : 0),
      onSet: (i) => push('backlash', i === 1),
      read: () => (c.backlash ? L('zapnuté', 'on') : L('vypnuté', 'off')),
    },
    levBack,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.2,
      label: LL('Upnutie otočnej dosky stola', 'Swivel plate lock'),
      hint: LL(
        'Hore = upnutá. Uvoľnená doska sa natáča kolesom vedľa (len pri stojacom vretene).',
        'Up = locked. Released, the plate is turned by the wheel next to it (spindle stopped only).',
      ),
      getIdx: () => (c.swLock ? 0 : 1),
      onSet: (i) => push('swLock', i === 0),
      read: () => (c.swLock ? L('upnutá', 'locked') : L('uvoľnená', 'released')),
    },
    levLock,
  );
  const wheel = (label, hint, key, perTurn, lo, hi, obj, read) =>
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.25,
        inc: 1,
        label,
        hint,
        guard: () => {
          if (key === 'x' && c.feedX) {
            say(L('Najprv vypni pozdĺžny posuv.', 'Disengage the longitudinal feed first.'));
            return false;
          }
          if (key === 'swivel') {
            if (c.swLock) {
              say(L('Otočná doska je upnutá – uvoľni páku.', 'The swivel plate is locked – release the lever.'));
              return false;
            }
            if (!stopped()) {
              say(
                L('Stôl sa natáča len pri stojacom vretene.', 'The table is swivelled only with the spindle stopped.'),
              );
              return false;
            }
          }
          return true;
        },
        turn: (d) => push(key, clamp(Math.round((c[key] + (d / TAU) * perTurn) * 100) / 100, lo, hi)),
        read,
      },
      obj,
    );
  wheel(
    LL('Koleso stola (X)', 'Table handwheel (X)'),
    LL('1 otáčka = 6 mm.', '1 turn = 6 mm.'),
    'x',
    6,
    -425,
    425,
    wX,
    () => `X ${st.x.toFixed(2)} mm`,
  );
  wheel(
    LL('Koleso priečnych saní (Y)', 'Cross-slide handwheel (Y)'),
    LL('1 otáčka = 6 mm.', '1 turn = 6 mm.'),
    'y',
    6,
    -140,
    135,
    wY,
    () => `Y ${st.y.toFixed(2)} mm`,
  );
  wheel(
    LL('Kľuka konzoly (Z)', 'Knee crank (Z)'),
    LL('V smere hodinových ručičiek stôl stúpa. 1 otáčka = 2 mm.', 'Clockwise raises the table. 1 turn = 2 mm.'),
    'z',
    2,
    -280,
    140,
    cZ,
    () => `Z ${st.z.toFixed(2)} mm`,
  );
  wheel(
    LL('Natáčanie stola', 'Table swivel'),
    LL('1 otáčka = 5°, rozsah ±45°.', '1 turn = 5°, range ±45°.'),
    'swivel',
    5,
    -45,
    45,
    wSw,
    () => `${st.sw.toFixed(1)}°`,
  );
  apiRef.current.newBlank = () => {
    if (!stopped()) {
      say(L('Obrobok sa mení pri stojacom vretene.', 'The work is changed with the spindle stopped.'));
      return false;
    }
    makeWork();
    say(L('Upnutý nový hranol 180 × 100 × 60 mm.', 'A new block 180 × 100 × 60 mm is clamped.'), 'info');
    return true;
  };
  // ---------- slučka ----------
  let chipAcc = 0;
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    st.rpm = approach(st.rpm, c.running && c.power ? FGU.speeds[c.sp] : 0, 900 * dt);
    const running = st.rpm > 5;
    st.a += (st.rpm / 60) * TAU * dt * 0.25 * c.dir;
    spin.rotation.z = st.a;
    // posuv stola
    const dts = dt * c.timeScale;
    if (c.feedX && running) {
      c.x = clamp(c.x + c.feedX * (FGU.feeds[c.fd] / 60) * dts, -425, 425);
      x.pend.x = Math.round(c.x * 10) / 10;
      if (Math.abs(c.x) >= 425) push('feedX', 0);
    } else if (c.feedX && !running) {
      sayOnce(
        'feedStop',
        true,
        L('Posuv stola ide len pri bežiacom vretene.', 'The table feed runs only with the spindle running.'),
        'info',
      );
      push('feedX', 0);
    }
    if (c.running && !c.swLock)
      sayOnce('swl', true, L('Otočná doska stola nie je upnutá!', 'The swivel plate is not locked!'), 'danger');
    else flagsW.swl = false;
    // nové polohy s kontrolou dotyku
    const old = { x: st.x, y: st.y, z: st.z, sw: st.sw };
    const vx = c.feedX && running ? 1e9 : 400 * dt;
    st.x = approach(st.x, c.x, vx);
    st.y = approach(st.y, c.y, 400 * dt);
    st.z = approach(st.z, c.z, 120 * dt);
    st.sw = c.swLock ? st.sw : approach(st.sw, c.swivel, 40 * dt);
    const moved = old.x !== st.x || old.y !== st.y || old.z !== st.z || old.sw !== st.sw;
    let cut = 0;
    if (moved || running) {
      const p = probe();
      const block = (why, kind) => {
        Object.assign(st, old);
        c.x = st.x;
        c.y = st.y;
        c.z = st.z;
        x.pend.x = st.x;
        x.pend.y = st.y;
        x.pend.z = st.z;
        if (c.feedX) push('feedX', 0);
        place();
        sayOnce('crash', true, why, kind);
      };
      if (p.obst) {
        block(
          `${L('Fréza by narazila do', 'The cutter would hit')} ${p.obst} – ${L('pohyb je zastavený.', 'the motion is stopped.')}`,
          'danger',
        );
        if (!flagsW.crash) crashes.n++;
        flagsW.crash = true;
      } else if (p.pen > 1e-5 && !running) {
        block(
          L(
            'Fréza sa dotkla obrobku pri stojacom vretene – spusti vreteno.',
            'The cutter touched the work with the spindle stopped – start the spindle.',
          ),
          'danger',
        );
      } else {
        flagsW.crash = false;
        if (p.pen > 1e-5) {
          cut = doCut(p.q);
          if (cut > 0) {
            st.cutT = t;
            // súsledné / nesúsledné: smer zuba v mieste rezu (dole) proti posuvu obrobku
            const dxw = (st.x - old.x) / 100,
              ang = (st.sw * Math.PI) / 180,
              vWork = dxw * Math.cos(ang);
            if (Math.abs(vWork) > 1e-7) {
              st.climb = isClimb(c.dir, Math.sign(vWork));
              if (st.climb && !c.backlash) {
                flagsW.climbBad = true;
                sayOnce(
                  'climb',
                  true,
                  L(
                    'Súsledné frézovanie bez vymedzenia vôle – stôl sa vťahuje do frézy! Zapni vymedzenie vôle alebo obráť posuv.',
                    'Climb milling without the backlash eliminator – the table is pulled into the cutter! Engage the eliminator or reverse the feed.',
                  ),
                  'danger',
                );
              }
            }
            sayOnce(
              'speed',
              cuttingSpeed(FGU.speeds[c.sp]) > 45,
              L(
                'Príliš vysoké otáčky pre HSS v oceli – fréza sa prehrieva. Zníž otáčky.',
                'Speed too high for HSS in steel – the cutter overheats. Reduce the speed.',
              ),
              'warn',
            );
            sayOnce(
              'cool',
              !c.coolant,
              L('Režeš bez chladenia – zapni chladiacu kvapalinu.', 'Cutting without coolant – switch the coolant on.'),
              'info',
            );
            chipAcc += dt * 30;
            while (chipAcc >= 1) {
              chipAcc--;
              chips.spawn(
                v3((Math.random() - 0.5) * 0.4, SY - R, CZ + (Math.random() - 0.5) * 0.2),
                v3(-c.dir * (1 + Math.random()), 0.6 + Math.random(), (Math.random() - 0.5) * 1.2),
                2.2,
              );
            }
          }
        }
      }
    }
    place();
    chips.update(dt, () => 0.3);
    lampRun.emissive.setHex(running ? 0x22dd55 : 0);
    lamp.update(c.light);
    wX.rotation.z = (-st.x / 6) * TAU;
    wY.rotation.z = (st.y / 6) * TAU;
    cZ.rotation.z = (st.z / 2) * TAU;
    wSw.rotation.z = (st.sw / 5) * TAU;
  };
  const chips = (() => {
    const geo = new THREE.BoxGeometry(0.02, 0.01, 0.04);
    const ps = [];
    const grpP = new THREE.Group();
    x.scene.add(grpP);
    return {
      spawn: (p, vel, life) => {
        if (ps.length > 120) {
          const o = ps.shift();
          grpP.remove(o.m);
        }
        const m = new THREE.Mesh(geo, M.chip);
        m.position.copy(p);
        grpP.add(m);
        ps.push({ m, v: vel, life });
      },
      update: (dt, floor) => {
        for (const p of ps) {
          if (p.life <= 0) continue;
          p.v.y -= 9 * dt;
          p.m.position.addScaledVector(p.v, dt);
          if (p.m.position.y < floor()) p.life = 0;
          p.m.rotation.x += dt * 8;
        }
      },
    };
  })();
  return {
    update,
    tele: () => ({
      rpm: st.rpm,
      x: st.x,
      y: st.y,
      z: st.z,
      sw: st.sw,
      cutting: x.time() - st.cutT < 0.3,
      climb: st.climb,
    }),
    measure: () => {
      const hfm = {
        hgt: Array.from(hf.hgt, (h) => h * 100),
        NX: hf.NX,
        NZ: hf.NZ,
        W: WX * 100,
        D: WZ * 100,
        H: WH * 100,
      };
      return { slot: slotInfo(hfm), climbBad: flagsW.climbBad, crashes: crashes.n };
    },
    workObj: () => workG,
    workSpot: () => v3(0, 12, 8),
    canInspect: () => (!stopped() ? L('Najprv zastav vreteno.', 'Stop the spindle first.') : null),
    sound: () => ({ motor: st.rpm / 1400, cut: x.time() - st.cutT < 0.3 ? 0.7 : 0 }),
  };
}

export { FguSimulator };
export default FguSimulator;
