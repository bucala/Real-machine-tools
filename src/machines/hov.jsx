import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL } from '../core/i18n';
import { angleScaleTex } from '../core/detail';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { HovDrawing } from '../ui/sketch2';
import {
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
import { ringCut } from './slotterMath';
import { HOV, HOV_TOOLS, arcInfo, hovBlank, hovChecks, hovToolRect, keywaysInfo, pitchErr } from './hovMath';

// =====================================================================
// ZVISLÁ OBRÁŽAČKA TOS HOV 25 – oblúkový stojan, smykadlo vpredu, krížový a otočný stôl Ø500
// =====================================================================
// mierka 1 = 100 mm; os smykadla je zvislá v x = 0, z = 0; ostrie noža je o TIPX vpravo (+x) alebo vľavo (nôž otočený).
// Stôl: priečny posuv X (tx), pozdĺžny Z k stojanu a od neho (tz), otočný stôl C (uhol cA).
const TT = 8.4, // horná plocha otočného stola
  SP = 0.4, // výška podložky pod obrobkom
  WB = TT + SP, // spodok obrobku
  WH = 0.6, // výška obrobku
  WT = WB + WH,
  TIPX = 0.1,
  TL = 1.1, // dĺžka noža pod držiakom
  HOLE = 0.3, // stredový otvor otočného stola a podložky
  SPO = 0.45, // vonkajší polomer podložky
  CLAMP_A = [Math.PI / 2, (3 * Math.PI) / 2], // upínky na obrobku (uhly v obrobku)
  CLAMP_TOP = WT + 0.16;
const TOOL_KEYS = Object.keys(HOV_TOOLS);

const hovParts = () =>
  mkParts([
    [
      'stojan',
      'Stojan',
      'Column',
      'Oblúkový stojan',
      'Arched column',
      'Liatinový stojan s oblúkom nesie vpredu vedenie smykadla, vzadu motor a prevodovku. Predloha: TOS HOV 25 – zdvih do 250 mm, otočný stôl Ø500, pozdĺžny posuv 560 mm, priečny 450 mm, vyloženie 365 mm, motor 4,5 kW, ≈ 2,85 t.',
      'The cast arched column carries the ram guide at the front and the motor and gearbox at the back. Model: TOS HOV 25 – stroke up to 250 mm, rotary table Ø500, longitudinal travel 560 mm, cross 450 mm, throat 365 mm, motor 4.5 kW, ≈ 2.85 t.',
    ],
    [
      'smykadlo',
      'Smykadlo',
      'Ram',
      'Zvislé smykadlo s držiakom noža',
      'Vertical ram with tool holder',
      'Smykadlo kmitá zvisle – nadol reže, nahor sa vracia. Dĺžka zdvihu sa nastavuje na prevodovke, poloha zdvihu kolesom na hlave smykadla.',
      'The ram reciprocates vertically – cutting down, returning up. The stroke length is set on the gearbox, the stroke position with the wheel on the ram head.',
    ],
    [
      'prevodovka',
      'Prevodovka',
      'Gearbox',
      'Prevodovka s ukazovateľom zdvihu',
      'Gearbox with stroke indicator',
      'Na boku stojana: páka stupňov zdvihov, štvorhran dĺžky zdvihu a okienko s ukazovateľom dĺžky zdvihu.',
      'On the column side: the stroke-rate lever, the stroke-length square and the window with the stroke-length pointer.',
    ],
    [
      'stol',
      'Stôl',
      'Table',
      'Krížový a otočný stôl Ø500',
      'Compound and rotary table Ø500',
      'Priečny a pozdĺžny suport s ručnými kolesami a samočinným posuvom po každom zdvihu; otočný stôl so šnekom (1 otáčka kolesa = 4°), stupnicou a zaistením.',
      'Cross and longitudinal slides with handwheels and automatic feed after each stroke; rotary table with a worm (1 handwheel turn = 4°), scale and clamp.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Náboj Ø120 / Ø40 × 60',
      'Hub Ø120 / Ø40 × 60',
      'Náboj leží na podložke a drží ho dve upínky.',
      'The hub sits on a spacer ring and is held by two strap clamps.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Elektrická skriňa',
      'Electrical cabinet',
      'Hlavný vypínač, štart a stop.',
      'Main switch, start and stop.',
    ],
  ]);

const HOV_TASKS = [
  {
    id: 'drazky',
    title: () => L('Štyri drážky 10 × 3 po 90°', 'Four keyways 10 × 3 at 90°'),
    desc: () =>
      L(
        'Nôž 10 mm, ostrie k stene otvoru. Zdvih nastav cez celú výšku náboja (nábeh nad ním, výbeh pod ním). Drážku obrážaj priečnym posuvom do hĺbky 3 mm (narážka), potom vráť stôl, otoč otočný stôl o 90°, zaisti ho a opakuj – spolu 4 drážky.',
        'Tool 10 mm, edge towards the bore wall. Set the stroke over the full hub height (run-in above, run-out below). Slot each keyway with the cross feed to 3 mm depth (feed stop), then back off, turn the rotary table 90°, clamp it and repeat – 4 keyways in all.',
      ),
    setup: {},
    drawing: () => <HovDrawing kind="drazky" />,
  },
  {
    id: 'oblouk',
    title: () => L('Vonkajší oblúk R55 na 120°', 'Outside arc R55 over 120°'),
    desc: () =>
      L(
        'Plochý nôž otoč ostrím k obrobku (dovnútra) a postav ho mimo náboja. Upínky sú na 90° a 270° – oblúk umiestni medzi ne (napr. stôl od 304° po 56°). Nastav polomer 55 mm priečnym suportom a obrážaj kruhovým posuvom otočného stola (zaistenie uvoľnené, narážka kruhového posuvu). Pozor na stôl pod nožom – výbeh zdvihu len nad stôl. Plochý nôž predĺži oblúk asi o 4° na každej strane.',
        'Turn the flat tool with its edge towards the work (inwards) and place it outside the hub. The clamps are at 90° and 270° – place the arc between them (e.g. table from 304° to 56°). Set radius 55 mm with the cross slide and shape with the rotary feed (clamp released, rotary feed stop). Mind the table under the tool – run-out only above it. The flat tool lengthens the arc by about 4° at each end.',
      ),
    setup: {},
    drawing: () => <HovDrawing kind="oblouk" />,
  },
].map((t) => {
  const labels = {
    count: () => L('Počet drážok 4', '4 keyways'),
    width: () => L('Šírka 10 ±0,2 mm', 'Width 10 ±0.2 mm'),
    depth: () => L('Hĺbka t2 = 3 ±0,1 mm', 'Depth t2 = 3 ±0.1 mm'),
    pitch: () => L('Rozostup 90° ±0,5°', 'Pitch 90° ±0.5°'),
    radius: () => L('Polomer R55 ±0,2 mm', 'Radius R55 ±0.2 mm'),
    span: () => L('Rozsah oblúka 120° ±5°', 'Arc span 120° ±5°'),
    one: () => L('Jeden súvislý oblúk', 'One continuous arc'),
    through: () => L('Zdvih cez celú výšku', 'Stroke over the full height'),
    crash: () => L('Bez nárazu a preťaženia', 'No crash or overload'),
  };
  return { ...t, checks: (m) => hovChecks[t.id](m).map((c) => ({ ...c, label: labels[c.key]() })) };
});

const HOV_SAFETY = () => [
  L(
    'Obrobok je upnutý, otočný stôl zaistený (ak nepoužívam kruhový posuv).',
    'The work is clamped, the rotary table locked (unless I use the rotary feed).',
  ),
  L(
    'Dĺžku a polohu zdvihu som skontroloval ručne – nôž nenarazí do stola ani do upínok.',
    'I checked the stroke length and position by hand – the tool will not hit the table or the clamps.',
  ),
  L(
    'Počas chodu nesiaham pod smykadlo a triesky odstraňujem štetcom po zastavení.',
    'I do not reach under the ram while running and remove chips with a brush after stopping.',
  ),
];

function HovSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    running: false,
    sp: 1,
    L: 60,
    top: 150,
    tool: 'drazk10',
    dir: 1,
    fm: 0,
    fx: 1,
    fc: 1,
    xStop: -13,
    cStop: 120,
    tx: 0,
    tz: 0,
    cA: 0,
    lock: true,
    light: true,
    manual: false,
    timeScale: 3,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    spm: 0,
    tip: 150,
    tx: 0,
    tz: 0,
    cA: 0,
    area: 0,
    ks: [],
    arc: null,
    cutting: false,
    msg: null,
  });
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
      colors: [0x9cc2a0, 0x84aa89, 0x6b8f70],
      mats: {
        work: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.75 }),
        cast: [0x5f6468, 0.5, 0.6],
      },
      name: L('Zvislá obrážačka TOS HOV 25', 'TOS HOV 25 vertical slotter'),
      sound: 'mill',
      debugKey: '__hov',
      build: (x) => buildHov(x),
    });
  }, []);
  const parts = hovParts();
  const act = (k, v) => apiRef.current.act?.[k]?.(v);
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.cutting
        ? {
            kind: 'run',
            text: `${L('Obrážanie', 'Slotting')} – ${L('prierez triesky', 'chip section')} ${tele.area.toFixed(1)} mm²`,
          }
        : tele.spm > 1
          ? {
              kind: 'run',
              text: L('Smykadlo kmitá. Prisuň stôl k nožu.', 'The ram reciprocates. Feed the table to the tool.'),
            }
          : {
              kind: 'idle',
              text: L(
                'Nastav dĺžku a polohu zdvihu, nôž a stôl, potom spusti stroj.',
                'Set the stroke length and position, the tool and the table, then start.',
              ),
            };
  const chips = [
    {
      color: tele.spm > 1 ? '#3ee06c' : '#8b8f89',
      text: tele.spm > 1 ? `${HOV.speeds[ui.sp]} ${L('zdvihov/min', 'strokes/min')}` : L('Stojí', 'Stopped'),
    },
    {
      color: ui.lock ? '#7fb6ff' : '#ff8a1f',
      text: ui.lock ? L('stôl zaistený', 'table locked') : L('stôl voľný', 'table free'),
    },
    ui.fm ? { color: '#ffd166', text: ui.fm === 1 ? L('posuv X', 'feed X') : L('kruhový posuv', 'rotary feed') } : null,
  ].filter(Boolean);
  const ks = tele.ks || [];
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
            'Ručné kolesá stola majú stupnicu – dvojklikom ju vynuluješ pri dotyku noža.',
            'The table handwheels have dials – double-click to zero them when the tool touches.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · obrážanie', 'Simulator · slotting')}
            title={L('Zvislá obrážačka', 'Vertical slotter')}
            sub={L(
              'Predloha: TOS HOV 25 – zdvih do 250 mm, otočný stôl Ø500, posuvy 560 × 450 mm, vyloženie 365 mm, 4,5 kW, ≈ 2,85 t. Stupne zdvihov sú v simulátore orientačné. Mierka 1 : 100 mm.',
              'Modelled after the TOS HOV 25 – stroke up to 250 mm, rotary table Ø500, travels 560 × 450 mm, throat 365 mm, 4.5 kW, ≈ 2.85 t. Stroke rates are approximate in the simulator. Scale 1 : 100 mm.',
            )}
            rows={[
              ['X', `${tele.tx.toFixed(2)}`],
              ['Z', `${tele.tz.toFixed(2)}`],
              ['C', `${tele.cA.toFixed(2)}°`],
            ]}
            foot={[
              `${L('zdvih', 'stroke')} ${ui.L} / ${ui.top} mm`,
              ks.length
                ? `${ks.length} × ${ks[0].width.toFixed(2)} / ${Math.max(...ks.map((k) => k.depth)).toFixed(2)} mm`
                : tele.arc
                  ? `R ${tele.arc.r.toFixed(2)} / ${tele.arc.span.toFixed(0)}°`
                  : '—',
            ]}
            status={statusMsg}
          />
          <TaskSection
            machine="hov"
            tasks={HOV_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={() => apiRef.current.newBlank?.()}
            safety={{ ui, set, runKey: 'running', items: HOV_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Chod', 'Run')}</h2>
            <button type="button" className="btn-run w-full" onClick={() => apiRef.current.toggleRun?.()}>
              {ui.running ? L('■ Stop', '■ Stop') : L('▶ Štart', '▶ Start')}
            </button>
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
            <SegRow
              label={L('Zdvihy/min', 'Strokes/min')}
              value={ui.sp}
              options={HOV.speeds.map((n, i) => [i, String(n)])}
              onChange={(i) => act('speed', i)}
            />
            <Slider
              id="hvl"
              label={L('Dĺžka zdvihu', 'Stroke length')}
              unit="mm"
              min={20}
              max={HOV.stroke}
              step={1}
              value={ui.L}
              digits={0}
              onChange={(v) => act('L', v)}
            />
            <Slider
              id="hvt"
              label={L('Horná poloha ostria nad stolom', 'Top of stroke above the table')}
              unit="mm"
              min={60}
              max={400}
              step={1}
              value={ui.top}
              digits={0}
              onChange={(v) => act('top', v)}
            />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nôž a posuvy', 'Tool and feeds')}</h2>
              <SectionInfo title={L('Posuv po zdvihu', 'Feed per stroke')}>
                <p className="text-xs muted">
                  {L(
                    'Samočinný posuv pootočí stôl vždy v hornej úvrati, keď je nôž mimo obrobku. Narážka posuv vypne v nastavenej polohe.',
                    'The automatic feed moves the table at the top of each stroke while the tool is clear of the work. The stop disengages it at the set position.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label={L('Nôž', 'Tool')}
              value={ui.tool}
              options={[
                ['drazk10', L('drážkový 10', 'keyway 10')],
                ['plochy', L('plochý 16', 'flat 16')],
              ]}
              onChange={(v) => act('tool', v)}
            />
            <Toggle
              on={ui.dir < 0}
              label={L('Nôž otočený ostrím doľava (k obrobku zvonka)', 'Tool turned edge left (outside the work)')}
              onClick={() => act('flip')}
            />
            <SegRow
              label={L('Samočinný posuv', 'Automatic feed')}
              value={ui.fm}
              options={[
                [0, '0'],
                [1, 'X'],
                [2, 'C'],
              ]}
              onChange={(v) => act('fm', v)}
            />
            <SegRow
              label={L('Priečny posuv mm/zdvih', 'Cross feed mm/stroke')}
              value={ui.fx}
              options={HOV.feeds.map((f, i) => [i, String(f)])}
              onChange={(i) => set('fx', i)}
            />
            <SegRow
              label={L('Kruhový posuv °/zdvih', 'Rotary feed °/stroke')}
              value={ui.fc}
              options={HOV.cFeeds.map((f, i) => [i, String(f)])}
              onChange={(i) => set('fc', i)}
            />
            <Slider
              id="hvxs"
              label={L('Narážka priečneho posuvu X', 'Cross feed stop X')}
              unit="mm"
              min={-225}
              max={225}
              step={0.05}
              value={ui.xStop}
              digits={2}
              onChange={(v) => set('xStop', v)}
            />
            <Slider
              id="hvcs"
              label={L('Narážka kruhového posuvu C', 'Rotary feed stop C')}
              unit="°"
              min={0}
              max={359.5}
              step={0.5}
              value={ui.cStop}
              digits={1}
              onChange={(v) => set('cStop', v)}
            />
          </div>
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Stôl', 'Table')}</h2>
            <Slider
              id="hvx"
              label={L('Priečny suport X', 'Cross slide X')}
              unit="mm"
              min={-HOV.travX / 2}
              max={HOV.travX / 2}
              step={0.05}
              value={ui.tx}
              actual={tele.tx}
              digits={2}
              onChange={(v) => act('tx', v)}
            />
            <Slider
              id="hvz"
              label={L('Pozdĺžny suport Z', 'Longitudinal slide Z')}
              unit="mm"
              min={-HOV.travZ / 2}
              max={HOV.travZ / 2}
              step={0.05}
              value={ui.tz}
              actual={tele.tz}
              digits={2}
              onChange={(v) => act('tz', v)}
            />
            <Slider
              id="hvc"
              label={L('Otočný stôl C', 'Rotary table C')}
              unit="°"
              min={0}
              max={359.95}
              step={0.05}
              value={ui.cA}
              actual={tele.cA}
              digits={2}
              onChange={(v) => act('cA', v)}
            />
            <Toggle
              on={ui.lock}
              label={L('Otočný stôl zaistený', 'Rotary table locked')}
              onClick={() => act('lock', !ui.lock)}
            />
          </div>
          <ExportSection machine="hov" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['obsluha', L('Miesto obsluhy', 'Operator')],
              ['noz', L('Detail noža', 'Tool detail')],
              ['zhora', L('Zhora', 'Top')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

function buildHov(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, say, sayOnce, needPower, anchors, views, apiRef, lamp } = x;
  const { add, box, cylX, cylY, cylZ, ball, handwheel } = kit;
  const { rbox, ribs, nameplate, valuePlate, oilGlass, cable, bolts } = det;
  // ---------- lôžko ----------
  const col = grp('stojan');
  rbox(col, -3.4, 3.4, 0, 0.4, -10.4, 6.8, M.greenDeep, 0.08); // päta
  rbox(col, -3.1, 3.1, 0.4, 5.6, -9.6, 6.4, M.green, 0.25);
  ribs(col, 'x', -2.6, 2.6, 4, 0.8, 5.0, 6.4, 0.12, 0.14, M.greenDark);
  // vedenie pozdĺžneho suportu na lôžku
  [-2.4, 2.4].forEach((xx) => rbox(col, xx - 0.35, xx + 0.35, 5.6, 5.75, -3.4, 6.3, M.ways, 0.03));
  // ---------- oblúkový stojan (profil v rovine z–y vytiahnutý pozdĺž x) ----------
  const prof = new THREE.Shape();
  prof.moveTo(-9.6, 5.6);
  prof.lineTo(-3.65, 5.6);
  prof.lineTo(-3.65, 12.4);
  prof.quadraticCurveTo(-3.4, 13.2, -1.3, 13.3);
  prof.lineTo(-1.3, 20.2);
  prof.quadraticCurveTo(-1.6, 21.6, -3.6, 21.6);
  prof.absarc(-3.6, 15.6, 6.0, Math.PI / 2, Math.PI, false);
  prof.lineTo(-9.6, 5.6);
  const ag = new THREE.ExtrudeGeometry(prof, {
    depth: 4.4,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.12,
    bevelSegments: 2,
    curveSegments: 24,
  });
  ag.rotateY(-Math.PI / 2);
  ag.translate(2.2, 0, 0);
  const arch = add(col, ag, M.green);
  arch.castShadow = true;
  nameplate(col, 0, 10.6, -3.55, 0, 'TOS', 'HOV 25', 1.2);
  valuePlate(col, 0, 9.0, -3.55, 0, L('Zdvihy / min', 'Strokes / min'), HOV.speeds.map(String), 1.0);
  oilGlass(col, -1.6, 7.0, -3.55);
  // motor a remeňový kryt vzadu
  cylX(col, 0.75, 0.75, -1.4, 1.6, 3.4, -10.5, M.greenDark, 32);
  for (let k = 0; k < 8; k++) cylX(col, 0.79, 0.79, -1.2 + k * 0.32, -1.1 + k * 0.32, 3.4, -10.5, M.green, 32);
  rbox(col, -2.0, -1.4, 2.6, 8.4, -10.9, -9.6, M.greenDark, 0.15);
  // ---------- vedenie smykadla vpredu ----------
  const head = new THREE.Group();
  col.add(head);
  rbox(head, -1.1, 1.1, 13.0, 24.0, -1.45, -0.55, M.green, 0.1);
  [-0.82, 0.82].forEach((xx) => rbox(head, xx - 0.26, xx + 0.26, 13.0, 24.0, -0.6, 0.62, M.greenDark, 0.05)); // lišty
  bolts(
    head,
    [-0.82, 0.82].flatMap((xx) => [14, 16, 18, 20, 22].map((y) => [xx, y])),
    0.62,
    0.06,
  );
  // ---------- smykadlo ----------
  const ramG = grp('smykadlo', col);
  const ram = new THREE.Group();
  ramG.add(ram);
  rbox(ram, -0.55, 0.55, 0, 5.2, -0.5, 0.5, M.ways, 0.04);
  box(ram, -0.56, 0.56, 1.4, 1.6, -0.51, 0.51, M.steelDark);
  // držiak noža (odklopná doska) – nôž dole
  const holder = new THREE.Group();
  ram.add(holder);
  rbox(holder, -0.45, 0.45, -0.75, 0.05, -0.42, 0.42, M.cast, 0.05);
  bolts(
    holder,
    [
      [-0.25, -0.35],
      [0.25, -0.35],
    ],
    0.42,
    0.07,
  );
  const toolG = new THREE.Group();
  holder.add(toolG);
  const toolMeshes = {};
  TOOL_KEYS.forEach((k) => {
    const T = HOV_TOOLS[k],
      g = new THREE.Group();
    toolG.add(g);
    // driek a rezná časť: ostrie v lokálnom +x vo vzdialenosti TIPX od osi
    box(g, -0.08, 0.08, -TL, -0.7, -0.08, 0.08, M.steel);
    box(g, TIPX - T.b / 100, TIPX, -TL, -TL + 0.22, -T.w / 200, T.w / 200, M.insert);
    box(g, -0.08, TIPX - T.b / 100, -TL, -TL + 0.22, -Math.min(0.08, T.w / 200), Math.min(0.08, T.w / 200), M.steel);
    toolMeshes[k] = g;
  });
  kit.hitProxy(holder, 0.55, 0, -0.4, 0.3);
  // tlačidlo výmeny noža na boku držiaka
  const toolBtn = new THREE.Group();
  toolBtn.position.set(0.46, -0.35, 0.1);
  toolBtn.rotation.y = Math.PI / 2;
  holder.add(toolBtn);
  cylZ(toolBtn, 0.1, 0.1, 0, 0.08, 0, 0, M.yellow, 16);
  kit.hitProxy(toolBtn, 0.18, 0, 0, 0.06);
  // koleso polohy zdvihu na hlave smykadla
  const wTop = handwheel(head, 0.38, 1.45, 21.5, -0.9, 'x', 0.22);
  // ---------- prevodovka s ukazovateľom zdvihu ----------
  const gb = grp('prevodovka', col);
  rbox(gb, 2.2, 3.1, 9.6, 15.4, -8.2, -4.0, M.green, 0.2);
  const dialG = new THREE.Group();
  dialG.position.set(3.11, 13.6, -6.0);
  dialG.rotation.y = Math.PI / 2;
  gb.add(dialG);
  cylZ(dialG, 1.0, 1.0, 0, 0.06, 0, 0, M.steel, 40);
  cylZ(dialG, 0.88, 0.88, 0.06, 0.08, 0, 0, M.black, 40);
  const sector = add(dialG, new THREE.CircleGeometry(0.8, 32, Math.PI * 1.15, Math.PI * 0.7), M.red, 0, 0, 0.085);
  sector.userData.noMerge = true;
  const ptr = new THREE.Group();
  ptr.position.z = 0.1;
  dialG.add(ptr);
  box(ptr, -0.025, 0.025, -0.1, 0.78, 0, 0.02, M.white);
  const levSp = kit.pivotLever(gb, 3.15, 11.4, -5.0, 0.6, 0);
  levSp.rotation.y = Math.PI / 2;
  const wLen = handwheel(gb, 0.3, 3.2, 11.4, -7.0, 'x', 0.2); // štvorhran dĺžky zdvihu s kľukou
  // zvislý hriadeľ posuvu a skriňa posuvov
  cylY(gb, 0.07, 0.07, 6.0, 9.6, 2.7, -4.6, M.ways, 12);
  rbox(gb, 2.2, 3.2, 4.6, 6.6, -5.4, -3.8, M.greenDark, 0.12);
  const levFm = kit.pivotLever(gb, 3.25, 5.9, -4.6, 0.5, 0);
  levFm.rotation.y = Math.PI / 2;
  // ---------- suporty a otočný stôl ----------
  const tb = grp('stol');
  const sadZ = new THREE.Group();
  tb.add(sadZ);
  rbox(sadZ, -3.0, 3.0, 5.75, 6.7, -3.0, 3.2, M.green, 0.12);
  [-2.0, 2.0].forEach((zz) => rbox(sadZ, -3.0, 3.0, 6.7, 6.82, zz - 0.3, zz + 0.3, M.ways, 0.03));
  const wZ = handwheel(sadZ, 0.42, -2.2, 6.2, 3.4, 'z', 0.26);
  const sadX = new THREE.Group();
  sadZ.add(sadX);
  rbox(sadX, -2.9, 2.9, 6.82, 7.6, -2.6, 2.6, M.green, 0.12);
  const wX = handwheel(sadX, 0.42, 1.2, 7.1, 2.95, 'z', 0.26);
  const wC = handwheel(sadX, 0.32, -1.6, 7.2, 2.95, 'z', 0.2);
  cylZ(sadX, 0.09, 0.09, 2.6, 2.95, -1.6, 7.2, M.steelDark, 12);
  const levLock = kit.pivotLever(sadX, 2.2, 7.6, 2.62, 0.45, 0.5);
  cylY(sadX, 2.75, 2.75, 7.6, 8.0, 0, 0, M.greenDark, 72);
  box(sadX, -0.04, 0.04, 7.98, 8.06, 2.5, 2.78, M.red); // ryska otočného stola
  const rot = new THREE.Group();
  sadX.add(rot);
  const disk = cylY(rot, 2.5, 2.5, 8.0, TT, 0, 0, M.steelDark, 96);
  disk.userData.noMerge = true;
  for (let k = 0; k < 4; k++) {
    const s = box(rot, -2.3, 2.3, TT - 0.002, TT + 0.004, -0.09, 0.09, M.black);
    s.rotation.y = (k * Math.PI) / 4;
  }
  const atx = angleScaleTex(180, 1, { numR: 0.8, step: 30, len: 0.08 });
  if (atx) {
    const sc = add(
      rot,
      new THREE.RingGeometry(2.2, 2.5, 96),
      new THREE.MeshStandardMaterial({ map: atx, roughness: 0.4, metalness: 0.3 }),
      0,
      TT + 0.006,
      0,
    );
    sc.rotation.x = -Math.PI / 2;
    sc.userData.noMerge = true;
    sc.castShadow = false;
  }
  // podložka a upínky (s obrobkom sa točia)
  const wkG = grp('obrobok', rot);
  const spacer = new THREE.Mesh(new THREE.CylinderGeometry(SPO, SPO, SP, 48, 1, true), M.steel);
  spacer.position.y = TT + SP / 2;
  wkG.add(spacer);
  CLAMP_A.forEach((a) => {
    const g = new THREE.Group();
    g.rotation.y = -a;
    wkG.add(g);
    rbox(g, 0.45, 1.25, WT, WT + 0.16, -0.15, 0.15, M.steelDark, 0.03);
    cylY(g, 0.07, 0.07, TT, WT + 0.3, 1.0, 0, M.steel, 12);
    cylY(g, 0.14, 0.14, WT + 0.16, WT + 0.26, 1.0, 0, M.steelDark, 6);
    rbox(g, 1.15, 1.45, TT, WT, -0.15, 0.15, M.steelDark, 0.03);
  });
  // ---------- obrobok (prstenec s polomermi pre každý uhol) ----------
  let ring = hovBlank(),
    mesh = null;
  const COL_RAW = new THREE.Color(0x3e4246),
    COL_CUT = new THREE.Color(0xc4cad0),
    COL_TOP = new THREE.Color(0x4b5055);
  const rebuild = () => {
    const g = ring,
      pos = mesh.geometry.attributes.position.array,
      col2 = mesh.geometry.attributes.color.array;
    let o = 0;
    const put = (p, cc) => {
      pos[o] = p[0];
      pos[o + 1] = p[1];
      pos[o + 2] = p[2];
      col2[o] = cc.r;
      col2[o + 1] = cc.g;
      col2[o + 2] = cc.b;
      o += 3;
    };
    const quad = (a, b, cc, d, e) => {
      put(a, cc);
      put(b, cc);
      put(d, cc);
      put(b, cc);
      put(e, cc);
      put(d, cc);
    };
    for (let j = 0; j < g.NT; j++) {
      const j1 = (j + 1) % g.NT,
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
        I0t = [ri0 * c0, WH, ri0 * s0],
        I1t = [ri1 * c1, WH, ri1 * s1];
      const O0b = [ro0 * c0, 0, ro0 * s0],
        O1b = [ro1 * c1, 0, ro1 * s1],
        O0t = [ro0 * c0, WH, ro0 * s0],
        O1t = [ro1 * c1, WH, ro1 * s1];
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
    ring = hovBlank();
    const geo = new THREE.BufferGeometry(),
      n = ring.NT * 24 * 3;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n), 3));
    mesh = new THREE.Mesh(geo, M.work);
    mesh.position.y = WB;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.part = 'obrobok';
    mesh.userData.noMerge = true;
    wkG.add(mesh);
    rebuild();
  };
  makeWork();
  // ---------- elektrická skriňa ----------
  const pan = grp('ovladanie', col);
  rbox(pan, 3.9, 5.5, 3.2, 8.2, -4.4, -2.9, M.green, 0.08);
  cylY(pan, 0.08, 0.08, 0, 3.2, 4.7, -3.6, M.steelDark, 10);
  const face = new THREE.Group();
  face.position.set(4.7, 0, -2.89);
  pan.add(face);
  const mSw = mainSwitch(kit, M, face, 0, 7.4, 0.01);
  const bStart = panelButton(kit, M, face, -0.3, 6.4, 0.01, M.btnGreen),
    bStop = panelButton(kit, M, face, 0.3, 6.4, 0.01, M.red);
  const lampRun = M.lamp.clone();
  ball(face, 0.07, 0, 5.8, 0.02, lampRun);
  cable(col, [
    [4.7, 3.2, -3.6],
    [4.0, 1.0, -5.5],
    [2.2, 0.6, -8.5],
  ]);
  lamp({
    parent: col,
    base: v3(-2.2, 13.6, -3.0),
    elbow: v3(-2.6, 15.0, -0.4),
    head: v3(-1.4, 12.6, 1.4),
    aim: v3(0, WB, 0),
    angle: 0.5,
    power: 2.6,
  });
  // ---------- stav ----------
  Object.assign(st, {
    spm: 0,
    ph: 0,
    tip: c.top,
    tx: c.tx,
    tz: c.tz,
    cA: c.cA,
    crashes: 0,
    shallow: false,
    cutT: -9,
    area: 0,
    stroke: 0,
  });
  const stopped = () => !c.running && st.spm < 1;
  const T = () => HOV_TOOLS[c.tool];
  // ostrie nad stolom (mm) vo fáze zdvihu (0 = horná úvrať)
  const tipAt = (ph) => c.top - c.L * (0.5 - 0.5 * Math.cos(ph));
  // obdĺžnik reznej časti voči stredu obrobku (jednotky scény) pri polohe stola tx, tz
  const toolRel = (tx = st.tx, tz = st.tz) => hovToolRect(T(), c.dir * TIPX - tx / 100, -tz / 100, c.dir);
  const phiOf = (a = st.cA) => (a * Math.PI) / 180;
  // dotyk s pevnými časťami: stôl mimo stredového otvoru, podložka, upínky (body obdĺžnika noža v súradniciach obrobku)
  const hard = (tipMm, tx = st.tx, tz = st.tz, cA = st.cA) => {
    const y = TT + tipMm / 100,
      [x0, x1, z0, z1] = toolRel(tx, tz),
      phi = phiOf(cA),
      pts = [];
    for (let i = 0; i <= 4; i++)
      for (let k = 0; k <= 2; k++) pts.push([x0 + ((x1 - x0) * i) / 4, z0 + ((z1 - z0) * k) / 2]);
    for (const [px, pz] of pts) {
      const r = Math.hypot(px, pz),
        a = Math.atan2(pz, px) - phi;
      if (y < TT + 0.005 && r > HOLE) return 'table';
      if (y < WB && r > HOLE && r < SPO) return 'spacer';
      if (y < CLAMP_TOP && r > 0.45 && r < 1.25)
        for (const ca of CLAMP_A) {
          const d = Math.atan2(Math.sin(a - ca), Math.cos(a - ca));
          if (Math.abs(d * r) < 0.16) return 'clamp';
        }
    }
    return null;
  };
  // vniknutie noža do materiálu obrobku (pri ručnom pohybe stola s nožom v obrobku)
  const inWork = (tx, tz, cA) => {
    if (TT + st.tip / 100 > WT - 0.002) return 0;
    const [x0, x1, z0, z1] = toolRel(tx, tz);
    return ringCut(ring, phiOf(cA), x0, x1, z0, z1, false).pen;
  };
  // nôž by stál v plnom materiáli (ostrie pod hornou plochou mimo otvoru a mimo obrysu)
  const toolInSolid = (tipMm) => {
    if (TT + tipMm / 100 >= WT) return false;
    const [x0, x1, z0, z1] = toolRel();
    return ringCut(ring, phiOf(), x0, x1, z0, z1, false).pen > 0.0005;
  };
  const crash = (what) => {
    st.crashes++;
    push('running', false);
    push('fm', 0);
    say(
      what === 'table'
        ? L(
            'Nôž narazil do otočného stola – zdvihni polohu zdvihu!',
            'The tool hit the rotary table – raise the stroke position!',
          )
        : what === 'spacer'
          ? L('Nôž narazil do podložky pod obrobkom!', 'The tool hit the spacer under the work!')
          : what === 'clamp'
            ? L(
                'Nôž narazil do upínky – otoč stôl alebo zdvihni zdvih!',
                'The tool hit a clamp – turn the table or raise the stroke!',
              )
            : what === 'overload'
              ? L(
                  'Prierez triesky je pre nôž priveľký – nôž sa vylomil. Uber posuv!',
                  'The chip section is too large for the tool – the edge broke. Reduce the feed!',
                )
              : L('Nôž narazil do plného materiálu obrobku!', 'The tool rammed into solid material!'),
      'danger',
    );
  };
  const place = () => {
    sadZ.position.z = st.tz / 100;
    sadX.position.x = st.tx / 100;
    rot.rotation.y = -phiOf();
    // smykadlo: spodok držiaka = ostrie + TL
    ram.position.y = TT + st.tip / 100 + TL;
    toolG.rotation.y = c.dir > 0 ? 0 : Math.PI;
    TOOL_KEYS.forEach((k) => (toolMeshes[k].visible = k === c.tool));
  };
  // ručné pohyby a nastavenia s obmedzeniami (ovládače v scéne aj posuvníky)
  // pohyb stola po krokoch (1 mm / 0,5°): pri prekážke zastaví pred ňou
  const moveTable = (tx, tz, cA) => {
    tx = clamp(tx, -HOV.travX / 2, HOV.travX / 2);
    tz = clamp(tz, -HOV.travZ / 2, HOV.travZ / 2);
    const dc = ((((cA - c.cA) % 360) + 540) % 360) - 180;
    const n = Math.min(
      400,
      Math.max(1, Math.ceil(Math.max(Math.abs(tx - c.tx), Math.abs(tz - c.tz), Math.abs(dc) * 2))),
    );
    let ok = null,
      why = null;
    for (let i = 1; i <= n; i++) {
      const k = i / n,
        px = c.tx + (tx - c.tx) * k,
        pz = c.tz + (tz - c.tz) * k,
        pa = (((c.cA + dc * k) % 360) + 360) % 360;
      if (inWork(px, pz, pa) > 0.0005) why = 'work';
      else if (hard(st.tip, px, pz, pa)) why = 'hard';
      if (why) break;
      ok = [px, pz, pa];
    }
    if (why)
      say(
        why === 'work'
          ? L(
              'Nôž je v obrobku – stôl ďalej nepôjde. Najprv zdvihni smykadlo.',
              'The tool is in the work – the table stops here. Raise the ram first.',
            )
          : L(
              'Nôž by narazil – stôl ďalej nepôjde. Najprv zdvihni smykadlo.',
              'The tool would collide – the table stops here. Raise the ram first.',
            ),
      );
    if (!ok) return false;
    const r = (v) => Math.round(v * 100) / 100;
    if (ok[0] !== c.tx) push('tx', r(ok[0]));
    if (ok[1] !== c.tz) push('tz', r(ok[1]));
    if (ok[2] !== c.cA) push('cA', r(ok[2]) % 360);
    return !why;
  };
  const setupOnly = (fn) => (v) =>
    stopped() ? fn(v) : say(L('Toto sa nastavuje pri stojacom stroji.', 'This is set with the machine stopped.'));
  const act = {
    speed: (i) => push('sp', i),
    L: setupOnly((v) => push('L', clamp(Math.round(v), 20, HOV.stroke))),
    top: setupOnly((v) => {
      const nv = clamp(Math.round(v), 60, 400);
      if (nv < c.top && (hard(nv) || toolInSolid(nv)))
        return say(
          L('Nôž by narazil – smykadlo tak nízko nespustíš.', 'The tool would collide – the ram cannot go that low.'),
        );
      push('top', nv);
    }),
    tool: setupOnly((k) => push('tool', k)),
    flip: setupOnly(() => push('dir', -c.dir)),
    fm: (v) => {
      if (v === 2 && c.lock)
        return say(
          L(
            'Kruhový posuv potrebuje uvoľnené zaistenie otočného stola.',
            'The rotary feed needs the rotary table clamp released.',
          ),
        );
      push('fm', v);
    },
    tx: (v) => moveTable(v, c.tz, c.cA),
    tz: (v) => moveTable(c.tx, v, c.cA),
    cA: (v) =>
      c.lock
        ? say(
            L(
              'Otočný stôl je zaistený – uvoľni páku zaistenia.',
              'The rotary table is locked – release the clamp lever.',
            ),
          )
        : moveTable(c.tx, c.tz, v),
    lock: (v) => {
      if (v && c.fm === 2) push('fm', 0);
      push('lock', v);
    },
  };
  apiRef.current.act = act;
  place();
  Object.assign(anchors, {
    stojan: () => v3(-2.2, 18.0, -6.0),
    smykadlo: () => v3(0, ram.position.y + 1.6, 0.5),
    prevodovka: () => v3(3.1, 15.4, -6.0),
    stol: () => v3(st.tx / 100 + 2.5, TT, st.tz / 100),
    obrobok: () => v3(st.tx / 100, WT, st.tz / 100 + 0.6),
    ovladanie: () => v3(4.7, 8.2, -2.9),
  });
  Object.assign(views, {
    celok: () => [
      [13, 17, 17],
      [0, 10.5, -1.5],
    ],
    obsluha: () => [
      [2.2, 15.4, 9.5],
      [0, TT + 0.8, 0],
    ],
    noz: () => [[st.tx / 100 + 1.8, WT + 1.6, st.tz / 100 + 2.6], [st.tx / 100, WT - 0.2, st.tz / 100], true],
    zhora: () => [[st.tx / 100 + 0.1, WT + 6.5, st.tz / 100 + 0.8], [st.tx / 100, WT, st.tz / 100], true],
  });
  const start = needPower(() => {
    if (c.top - c.L < -60)
      return say(
        L(
          'Výbeh pod stôl je priveľký – skontroluj polohu zdvihu.',
          'The run-out below the table is too long – check the stroke position.',
        ),
      );
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
  apiRef.current.newBlank = () => {
    if (!stopped())
      return (say(L('Obrobok sa mení pri stojacom stroji.', 'The work is changed with the machine stopped.')), false);
    if (TT + st.tip / 100 < CLAMP_TOP + 0.05) push('top', Math.max(c.top, 150));
    st.tip = Math.max(st.tip, 150);
    makeWork();
    st.crashes = 0;
    st.shallow = false;
    return true;
  };
  // ---------- ovládače v scéne ----------
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
    { type: 'button', label: LL('ŠTART', 'START'), hint: LL('Spustí smykadlo.', 'Starts the ram.'), action: start },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP', 'STOP'),
      hint: LL('Zastaví stroj.', 'Stops the machine.'),
      action: () => push('running', false),
    },
    bStop,
  );
  const spAng = [0.6, 0.2, -0.2, -0.6];
  ctrl.reg(
    {
      type: 'lever',
      angles: spAng,
      minR: 0.2,
      label: LL('Stupne zdvihov', 'Stroke rate'),
      hint: LL(
        'Počet zdvihov za minútu – meň pri stojacom stroji.',
        'Strokes per minute – change with the machine stopped.',
      ),
      getIdx: () => c.sp,
      onSet: (i) =>
        stopped()
          ? push('sp', i)
          : say(L('Prevod sa preraďuje pri stojacom stroji.', 'Shift gears with the machine stopped.')),
      read: () => `${HOV.speeds[c.sp]} /min`,
    },
    levSp,
  );
  const fmAng = [0.5, 0, -0.5];
  ctrl.reg(
    {
      type: 'lever',
      angles: fmAng,
      minR: 0.18,
      label: LL('Samočinný posuv', 'Automatic feed'),
      hint: LL(
        '0 = vypnutý, X = priečny, C = kruhový (otočný stôl).',
        '0 = off, X = cross, C = rotary (rotary table).',
      ),
      getIdx: () => c.fm,
      onSet: (i) => act.fm(i),
      read: () => ['0', 'X', 'C'][c.fm],
    },
    levFm,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.18,
      label: LL('Zaistenie otočného stola', 'Rotary table clamp'),
      hint: LL(
        'Pri obrážaní drážok zaisti, pri kruhovom posuve uvoľni.',
        'Lock it for keyways, release it for the rotary feed.',
      ),
      getIdx: () => (c.lock ? 1 : 0),
      onSet: (i) => act.lock(i === 1),
      read: () => (c.lock ? L('zaistený', 'locked') : L('uvoľnený', 'released')),
    },
    levLock,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Držiak noža', 'Tool holder'),
      hint: LL(
        'Otočí nôž v držiaku o 180° (ostrie vpravo / vľavo) – pri stojacom stroji.',
        'Turns the tool 180° in the holder (edge right / left) – machine stopped.',
      ),
      action: () => act.flip(),
      read: () => (c.dir > 0 ? L('ostrie vpravo', 'edge right') : L('ostrie vľavo', 'edge left')),
    },
    holder,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Výmena noža', 'Tool change'),
      hint: LL(
        'Vymení drážkový nôž 10 mm za plochý 16 mm a späť.',
        'Swaps the 10 mm keyway tool for the 16 mm flat tool and back.',
      ),
      action: () => act.tool(c.tool === 'drazk10' ? 'plochy' : 'drazk10'),
      read: () => (c.tool === 'drazk10' ? L('drážkový 10', 'keyway 10') : L('plochý 16', 'flat 16')),
    },
    toolBtn,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.2,
      inc: 1,
      label: LL('Priečny suport X', 'Cross slide X'),
      hint: LL('1 otáčka = 5 mm, dielik 0,05 mm.', '1 turn = 5 mm, division 0.05 mm.'),
      turn: (d) => act.tx(c.tx + (d / TAU) * 5),
      read: () => `${st.tx.toFixed(2)} mm`,
    },
    wX,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.2,
      inc: 1,
      label: LL('Pozdĺžny suport Z', 'Longitudinal slide Z'),
      hint: LL('1 otáčka = 5 mm, dielik 0,05 mm.', '1 turn = 5 mm, division 0.05 mm.'),
      turn: (d) => act.tz(c.tz + (d / TAU) * 5),
      read: () => `${st.tz.toFixed(2)} mm`,
    },
    wZ,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.15,
      inc: 1,
      label: LL('Otočný stôl C', 'Rotary table C'),
      hint: LL(
        'Šnek 1 : 90 – 1 otáčka = 4°. Najprv uvoľni zaistenie.',
        'Worm 1 : 90 – 1 turn = 4°. Release the clamp first.',
      ),
      turn: (d) => act.cA(c.cA + (d / TAU) * HOV.cTurn),
      read: () => `${st.cA.toFixed(2)}°`,
    },
    wC,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.15,
      inc: 1,
      label: LL('Dĺžka zdvihu', 'Stroke length'),
      hint: LL(
        'Štvorhran na prevodovke – 1 otáčka = 10 mm, len pri stojacom stroji.',
        'Square on the gearbox – 1 turn = 10 mm, machine stopped only.',
      ),
      turn: (d) => act.L(c.L + (d / TAU) * 10),
      read: () => `${c.L} mm`,
    },
    wLen,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.2,
      inc: 1,
      label: LL('Poloha zdvihu', 'Stroke position'),
      hint: LL(
        'Prestaví smykadlo voči ojnici – 1 otáčka = 10 mm, len pri stojacom stroji.',
        'Moves the ram against the connecting rod – 1 turn = 10 mm, machine stopped only.',
      ),
      turn: (d) => act.top(c.top + (d / TAU) * 10),
      read: () => `${c.top} mm`,
    },
    wTop,
  );
  // ---------- slučka ----------
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    st.spm = approach(st.spm, c.running && c.power ? HOV.speeds[c.sp] : 0, 120 * dt);
    const running = st.spm > 1;
    const dts = dt * c.timeScale;
    // poloha stola: kolesá a posuvníky menia c priamo (moveTable kontroluje prekážky po ceste)
    st.tx = c.tx;
    st.tz = c.tz;
    st.cA = c.cA;
    // smykadlo
    const ph0 = st.ph;
    if (running) st.ph += (st.spm / 60) * TAU * dts;
    else st.ph = Math.min(Math.ceil(st.ph / TAU - 1e-9) * TAU, st.ph + 2 * dt); // pri zastavení dobehne do hornej úvrate
    st.tip = tipAt(st.ph);
    // pevné prekážky
    const h = hard(st.tip);
    if (h && running) crash(h);
    // dolná úvrať: rez celou výškou
    const bot = (p) => Math.floor((p + Math.PI) / TAU);
    if (running && bot(st.ph) > bot(ph0)) {
      const lo = c.top - c.L;
      if (lo / 100 + TT < WT) {
        const [x0, x1, z0, z1] = toolRel();
        const probe = ringCut(ring, phiOf(), x0, x1, z0, z1, false);
        st.area = probe.area;
        if (probe.embedded) crash('work');
        else if (probe.area > T().A + 1e-6) crash('overload');
        else if (probe.pen > 0) {
          ringCut(ring, phiOf(), x0, x1, z0, z1, true);
          rebuild();
          st.cutT = t;
          if (c.top / 100 + TT < WT + 0.03 || lo / 100 + TT > WB - 0.02) {
            st.shallow = true;
            sayOnce(
              'shallow',
              true,
              L(
                'Zdvih neprechádza celou výškou náboja s nábehom a výbehom!',
                'The stroke does not pass the full hub height with run-in and run-out!',
              ),
              'warn',
            );
          }
          if (c.lock === false && c.fm !== 2) {
            push('cA', (c.cA + (Math.random() - 0.5) * 0.6 + 360) % 360);
            sayOnce(
              'slip',
              true,
              L(
                'Otočný stôl nie je zaistený – pri reze sa pootočil!',
                'The rotary table is not locked – it turned during the cut!',
              ),
              'danger',
            );
          }
        }
      }
    }
    // horná úvrať: samočinný posuv (nôž musí byť nad obrobkom)
    if (running && Math.floor(st.ph / TAU) > Math.floor(ph0 / TAU) && c.fm) {
      if (TT + c.top / 100 < WT + 0.005) {
        sayOnce(
          'fclr',
          true,
          L(
            'Nôž v hornej úvrati nevychádza z obrobku – posuv sa nedá zapnúť. Zdvihni polohu zdvihu.',
            'The tool does not clear the work at the top of the stroke – the feed cannot act. Raise the stroke position.',
          ),
          'warn',
        );
      } else if (c.fm === 1) {
        const f = HOV.feeds[c.fx],
          dir = c.xStop < c.tx ? -1 : 1;
        let nx = c.tx + dir * f;
        if ((dir < 0 && nx <= c.xStop) || (dir > 0 && nx >= c.xStop)) {
          nx = c.xStop;
          push('fm', 0);
          say(L('Narážka vypla priečny posuv.', 'The stop disengaged the cross feed.'), 'info');
        }
        push('tx', Math.round(nx * 100) / 100);
        st.tx = c.tx;
      } else if (c.fm === 2) {
        const f = HOV.cFeeds[c.fc],
          rem = (((c.cStop - c.cA) % 360) + 360) % 360;
        let na = c.cA + f;
        if (rem <= f + 1e-9) {
          na = c.cStop;
          push('fm', 0);
          say(L('Narážka vypla kruhový posuv.', 'The stop disengaged the rotary feed.'), 'info');
        }
        push('cA', ((na % 360) + 360) % 360);
        st.cA = c.cA;
      }
    }
    place();
    lampRun.emissive.setHex(running ? 0x22dd55 : 0);
    mSw.rotation.z = c.power ? -Math.PI / 2 : 0;
    levSp.rotation.z = spAng[c.sp];
    levFm.rotation.z = fmAng[c.fm];
    levLock.rotation.z = c.lock ? -0.5 : 0.5;
    ptr.rotation.z = Math.PI * 0.35 - (c.L / HOV.stroke) * Math.PI * 0.7;
    wX.rotation.z = (st.tx / 5) * TAU;
    wZ.rotation.z = (st.tz / 5) * TAU;
    wC.rotation.z = (st.cA / HOV.cTurn) * TAU;
    wLen.rotation.z = (c.L / 10) * TAU;
    wTop.rotation.z = (c.top / 10) * TAU;
  };
  return {
    update,
    tele: () => ({
      spm: st.spm,
      tip: st.tip,
      tx: st.tx,
      tz: st.tz,
      cA: st.cA,
      area: st.area,
      ks: keywaysInfo(ring),
      arc: (() => {
        const a = arcInfo(ring, 55);
        return a.runs ? a : null;
      })(),
      cutting: x.time() - st.cutT < 1.5,
    }),
    measure: () => ({ ring, crashes: st.crashes, shallow: st.shallow, pitch: pitchErr(keywaysInfo(ring)) }),
    workObj: () => wkG,
    workSpot: () => v3(0, 9, 6),
    canInspect: () => (!stopped() ? L('Najprv zastav stroj.', 'Stop the machine first.') : null),
    prepareInspect: () => rebuild(),
    sound: () => ({ motor: st.spm / 100, cut: x.time() - st.cutT < 0.5 ? 0.6 : 0 }),
  };
}

export { HovSimulator };
export default HovSimulator;
