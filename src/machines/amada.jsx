import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL } from '../core/i18n';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
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
import { createClassicScene } from './classic/scaffold';
import { BV, buildBrevis, sheetToWorld } from './precision/brevisModel';
import {
  BREVIS,
  LASER_TASKS,
  MATERIALS,
  PROGRAMS,
  createLaserProcess,
  laserChecks,
  laserInfo,
  operations,
  programStats,
  recommend,
} from './precision/laserProcess';

// =====================================================================
// VLÁKNOVÝ LASER AMADA BREVIS 1212 AJ – 3 kW, tabuľa 1 250 × 1 250, čelné dvere zasúvané pod strechu, výsuvná paleta, AMNC 3i
// =====================================================================
const EDGE = () => ({
  ok: L('čistý rez', 'clean cut'),
  otrep: L('otrep na spodnej hrane', 'dross on the bottom edge'),
  oxid: L('oxidovaná hrana', 'oxidised edge'),
  prepal: L('prepálená hrana', 'burnt edge'),
  nie: L('neprerezané', 'not cut through'),
});
const GAS = () => [
  ['O2', L('kyslík O₂', 'oxygen O₂')],
  ['N2', L('dusík N₂', 'nitrogen N₂')],
  ['AIR', L('vzduch', 'air')],
];

const brevisParts = () =>
  mkParts([
    [
      'kryt',
      'Kryt stroja',
      'Enclosure',
      'Laserová ochranná kabína',
      'Laser safety enclosure',
      'Uzavretá kabína triedy 1 s tmavými ochrannými oknami: úzke čelo s červeným stĺpom, boky z troch sekcií s piatimi červenými pruhmi a nižšia tmavá skriňa laserového zdroja vzadu. Čelné dvere s posuvnými dielmi (otvára ich aj nožný pedál) a tri servisné dvere sú blokované – ich otvorenie zastaví lúč. Predloha: Amada BREVIS 1212 AJ – 3 088 × 2 389 × 1 900 mm.',
      'Class 1 enclosure with dark protective windows: narrow front with a red column, three-section sides with five red stripes and a lower dark laser source cabinet at the back. The front door with the sliding sections (also opened by the foot pedal) and three service doors are interlocked – opening them stops the beam. Model: Amada BREVIS 1212 AJ – 3,088 × 2,389 × 1,900 mm.',
    ],
    [
      'dvere',
      'Čelné dvere a posuvné diely',
      'Front door and sliding sections',
      'Dvere so zaoblenými oknami, pravý bok so strechou z dvoch dielov',
      'Door with rounded windows, two-part right side with roof',
      'Čelné dvere sa vysunú nahor a dozadu pod strechu predného dielu. Potom sa pravý bok so strechou – delený na predný a stredný diel – teleskopicky zasunie dozadu nad nižšiu skriňu laserového zdroja: čelo, strecha aj pravý bok rezacieho priestoru sú otvorené pre paletu, žeriav a údržbu.',
      'The front door slides up and back under the roof of the front section. Then the right side with the roof – split into a front and a middle section – telescopes back over the lower laser source cabinet: the front, roof and right side of the cutting area open for the pallet, a crane and maintenance.',
    ],
    [
      'stol',
      'Výsuvný stôl',
      'Pull-out table',
      'Paleta s lamelami',
      'Slat pallet',
      'Stôl s lamelami sa vysúva k obsluhe na nakladanie tabule 1 250 × 1 250 mm a vyberanie dielov.',
      'The slat table pulls out to the operator for loading the 1,250 × 1,250 mm sheet and unloading the parts.',
    ],
    [
      'portal',
      'Portál a hlava',
      'Gantry and head',
      'Lineárny portál s rezacou hlavou',
      'Linear gantry with cutting head',
      'Rýchloposuv 40 m/min, zdvih Z 200 mm. Hlava drží dýzu nad plechom, lúč 3 kW vláknového laseru taví materiál a rezný plyn ho vyfukuje.',
      'Rapid traverse 40 m/min, Z stroke 200 mm. The head keeps the nozzle above the sheet, the 3 kW fibre beam melts the metal and the assist gas blows it out.',
    ],
    [
      'plech',
      'Tabuľa plechu',
      'Sheet',
      'Tabuľa 1 250 × 1 250 mm',
      'Sheet 1,250 × 1,250 mm',
      'Výrezy otvorov po prerezaní vypadnú, diely ostanú v tabuli až do vybratia.',
      'Hole slugs drop out when cut through, the parts stay in the sheet until unloaded.',
    ],
    [
      'panel',
      'Panel AMNC 3i',
      'AMNC 3i panel',
      'Robustný tablet na konzole na čele stroja',
      'Rugged tablet on a bracket on the machine front',
      'Tablet na výšku s gumenými rohmi a bočnými úchopmi na ramene pripevnenom na červenom stĺpe. Pod obrazovkou strieborná doska: núdzový stop, regulátor rýchlosti rezu, štvorcové tlačidlá štartu, zastavenia, dverí a resetu, kľúčový spínač laseru a tlačidlo napájania. Obrazovka ukazuje program a priebeh rezania; vpravo dole je nožný pedál dverí.',
      'Portrait tablet with rubber corners and side grips on an arm fixed to the red column. Below the screen a silver plate: emergency stop, cutting speed override, square start, hold, door and reset buttons, laser key switch and power button. The screen shows the program and cutting progress; the door foot pedal is at the front right.',
    ],
    [
      'prislusenstvo',
      'Príslušenstvo',
      'Accessories',
      'Odsávanie a chladič',
      'Extraction and chiller',
      'Odsávanie dymu z rezacieho priestoru a chladič laserového zdroja za strojom.',
      'Fume extraction from the cutting area and the laser source chiller behind the machine.',
    ],
  ]);

function LaserDrawing({ prog }) {
  const c = 'currentColor';
  return prog === 'priruba' ? (
    <svg viewBox="0 0 300 150" style={{ width: '100%' }} aria-label={L('Príruba Ø200', 'Flange Ø200')}>
      <circle cx="90" cy="75" r="62" fill="none" stroke={c} strokeWidth="1.6" />
      <circle cx="90" cy="75" r="25" fill="none" stroke={c} strokeWidth="1.4" />
      <circle cx="90" cy="75" r="50" fill="none" stroke={c} strokeWidth="0.5" strokeDasharray="6 2 1 2" />
      {Array.from({ length: 6 }, (_, k) => (
        <circle
          key={k}
          cx={90 + 50 * Math.cos((k * Math.PI) / 3)}
          cy={75 + 50 * Math.sin((k * Math.PI) / 3)}
          r="4.4"
          fill="none"
          stroke={c}
          strokeWidth="1.2"
        />
      ))}
      <text x="170" y="40" fontSize="11" fill={c}>
        Ø200 · Ø80
      </text>
      <text x="170" y="60" fontSize="11" fill={c}>
        6 × Ø14 / Ø160
      </text>
      <text x="170" y="80" fontSize="11" fill={c}>
        S235 · t = 3 mm
      </text>
      <text x="170" y="100" fontSize="11" fill={c}>
        9 ks
      </text>
    </svg>
  ) : (
    <svg viewBox="0 0 300 150" style={{ width: '100%' }} aria-label={L('Konzola 300 × 120', 'Bracket 300 × 120')}>
      <rect x="20" y="35" width="180" height="72" rx="6" fill="none" stroke={c} strokeWidth="1.6" />
      <rect x="44" y="67" width="30" height="7" rx="3.5" fill="none" stroke={c} strokeWidth="1.2" />
      <rect x="146" y="67" width="30" height="7" rx="3.5" fill="none" stroke={c} strokeWidth="1.2" />
      <circle cx="110" cy="53" r="3" fill="none" stroke={c} strokeWidth="1.2" />
      <circle cx="110" cy="89" r="3" fill="none" stroke={c} strokeWidth="1.2" />
      <text x="70" y="25" fontSize="11" fill={c}>
        300 × 120 · R10
      </text>
      <text x="210" y="60" fontSize="11" fill={c}>
        1.4301
      </text>
      <text x="210" y="80" fontSize="11" fill={c}>
        t = 2 mm
      </text>
      <text x="210" y="100" fontSize="11" fill={c}>
        12 ks
      </text>
    </svg>
  );
}

const mkTask = (id, title, desc) => {
  const T = LASER_TASKS[id];
  const labels = {
    setup: () =>
      `${L('Program a plech', 'Program and sheet')}: ${L(PROGRAMS[T.prog].sk, PROGRAMS[T.prog].en)} · ${T.mat} ${T.t} mm`,
    parts: () => L('Všetky diely prerezané bez chyby', 'All parts cut through without defects'),
    edge: () => L('Čistá rezná hrana', 'Clean cut edge'),
    door: () => L('Dvere počas rezu zatvorené', 'Door closed while cutting'),
    unload: () => L('Diely vybraté zo stola', 'Parts unloaded from the table'),
  };
  return {
    id,
    title,
    desc,
    setup: {},
    drawing: () => <LaserDrawing prog={T.prog} />,
    checks: (m) => laserChecks[id](m).map((c) => ({ ...c, label: labels[c.key]() })),
  };
};
const LASER_TASK_LIST = [
  mkTask(
    'priruba',
    () => L('Príruby z ocele 3 mm', 'Flanges from 3 mm steel'),
    () =>
      L(
        'Otvor dvere, vysuň stôl a nalož oceľ S235 hrúbky 3 mm. Zvoľ program príruba, prevezmi rezné podmienky z tabuľky (kyslík) a zapni laser. Zasuň stôl, zatvor dvere a spusti program. Po dorezaní vyber diely.',
        'Open the door, pull out the table and load S235 steel 3 mm thick. Select the flange program, take the cutting conditions from the table (oxygen) and switch the laser on. Push the table in, close the door and start. When finished, unload the parts.',
      ),
  ),
  mkTask(
    'nerez',
    () => L('Konzoly z nerezu 2 mm bez oxidácie', 'Stainless brackets 2 mm without oxidation'),
    () =>
      L(
        'Nalož nerez 1.4301 hrúbky 2 mm a zvoľ program konzola. Nerez sa reže dusíkom pod vysokým tlakom – kyslík by hranu zoxidoval. Rýchlosť drž pri odporúčanej hodnote, inak vznikne otrep.',
        'Load 1.4301 stainless 2 mm thick and select the bracket program. Stainless is cut with high-pressure nitrogen – oxygen would oxidise the edge. Keep the speed near the recommended value, otherwise dross forms.',
      ),
  ),
];
const LASER_SAFETY = () => [
  L(
    'Laser triedy 1 – lúč je bezpečný len pri zatvorených dverách; okná sú z ochranného skla.',
    'Class 1 laser – the beam is safe only with the doors closed; the windows are protective glass.',
  ),
  L(
    'Pred spustením je stôl zasunutý, dvere zatvorené a odsávanie beží.',
    'Before starting the table is pushed in, the doors closed and extraction running.',
  ),
  L(
    'Diely beriem v rukaviciach – hrany sú ostré a ešte horúce.',
    'I take the parts with gloves – the edges are sharp and still hot.',
  ),
];

function AmadaSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: false,
    laser: false,
    estop: false,
    door: false,
    drawer: false,
    sideL: false,
    sideR1: false,
    sideR2: false,
    mat: 'S235',
    t: 3,
    prog: 'priruba',
    speed: 4.2,
    pw: 100,
    gas: 'O2',
    pressure: 0.7,
    focus: 1,
    ovr: 100,
    ts: 5,
    light: true,
    manual: false,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    phase: 'idle',
    op: 0,
    ops: 0,
    laserReady: false,
    sheet: null,
    doorK: 0,
    drawerK: 0,
    alarm: null,
    info: null,
    time: 0,
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
      colors: [0xc9ccd0, 0xa9aeb3, 0x2b2d30],
      mats: {
        cab: [0xc4c7cb, 0.45, 0.25],
        cab2: [0x9ea3a9, 0.5, 0.3],
        dark: [0x26282b, 0.55, 0.3],
        red: [0xc8102e, 0.42, 0.15],
        steelD: [0x55595e, 0.4, 0.7],
        slat: [0x6e7378, 0.5, 0.6],
        copper: [0xc37b45, 0.3, 0.85],
        panelL: [0x34373b, 0.5, 0.3],
        green: [0x2e9b4a, 0.45, 0.1],
        rear: [0x3b3e43, 0.55, 0.3],
        glass: new THREE.MeshStandardMaterial({
          color: 0x24402a,
          transparent: true,
          opacity: 0.62,
          roughness: 0.1,
          metalness: 0.1,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
        spark: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
      },
      name: 'Amada BREVIS 1212 AJ',
      sound: 'laser',
      debugKey: '__amada',
      orbitOptions: { maxDistance: 110, maxTargetY: 25 },
      stageOptions: { far: 400, floorSize: 300, gridSize: 200, fogNear: 120, fogFar: 320 },
      build: (x) => buildAmada(x),
    });
  }, []);
  const parts = brevisParts();
  const act = (k, v) => apiRef.current.act?.[k]?.(v);
  const rec = recommend(ui.mat, ui.t);
  const stats = programStats(ui.prog, ui.mat, ui.t, { speed: (ui.speed * ui.ovr) / 100 });
  const edge = EDGE();
  const alarmText = (a) =>
    !a
      ? null
      : {
          noprog: L('Nie je zvolený program.', 'No program selected.'),
          power: L('Zapni napájanie stroja.', 'Switch on the machine power.'),
          estop: L(
            'Núdzový stop je stlačený – uvoľni ho a daj RESET.',
            'Emergency stop is pressed – release it and press RESET.',
          ),
          laser: L(
            'Laser nie je pripravený – zapni ho a počkaj na zahriatie.',
            'The laser is not ready – switch it on and wait for warm-up.',
          ),
          door: L('Čelné dvere nie sú zatvorené.', 'The front door is not closed.'),
          side: L('Servisné dvere sú otvorené.', 'A service door is open.'),
          drawer: L('Stôl nie je zasunutý.', 'The table is not pushed in.'),
          sheet: L('Na stole nie je plech.', 'There is no sheet on the table.'),
          cut: L(
            'Plech je už vyrezaný – vyber diely a nalož nový.',
            'The sheet is already cut – unload the parts and load a new one.',
          ),
          thick: L('Hrúbka presahuje rozsah stroja.', 'The thickness exceeds the machine range.'),
          dooropen: L(
            'Otvorené dvere počas rezu – lúč vypnutý, program pozastavený.',
            'Door opened while cutting – beam off, program held.',
          ),
        }[a] || a;
  const statusMsg = tele.msg
    ? tele.msg
    : tele.alarm
      ? { kind: 'danger', text: alarmText(tele.alarm) }
      : !ui.power
        ? {
            kind: 'warn',
            text: L(
              'Stroj je vypnutý – zapni napájanie na paneli.',
              'The machine is off – switch the power on at the panel.',
            ),
          }
        : tele.phase === 'run'
          ? { kind: 'run', text: `${L('Rezanie', 'Cutting')} – ${L('obrys', 'contour')} ${tele.op + 1} / ${tele.ops}` }
          : tele.phase === 'done'
            ? {
                kind: 'run',
                text: L(
                  'Program dokončený – otvor dvere a vyber diely.',
                  'Program finished – open the door and unload the parts.',
                ),
              }
            : {
                kind: 'idle',
                text: L(
                  'Nalož plech, zvoľ program a podmienky, zatvor dvere a spusti.',
                  'Load a sheet, select the program and conditions, close the door and start.',
                ),
              };
  const chips = [
    { color: ui.power ? '#3ee06c' : '#8b8f89', text: ui.power ? L('napájanie', 'power') : L('vypnuté', 'off') },
    {
      color: tele.laserReady ? '#ffb347' : '#8b8f89',
      text: tele.laserReady
        ? L('laser pripravený', 'laser ready')
        : ui.laser
          ? L('laser sa zahrieva', 'laser warming up')
          : L('laser vypnutý', 'laser off'),
    },
    {
      color: tele.doorK < 0.01 ? '#7fb6ff' : '#ff8a1f',
      text: tele.doorK < 0.01 ? L('dvere zatvorené', 'door closed') : L('dvere otvorené', 'door open'),
    },
  ];
  const info = tele.info;
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
            'Čelné dvere otvoríš tlačidlom na paneli, nožným pedálom alebo za madlo; stôl vysunieš za rukoväte palety.',
            'Open the front door with the panel button, the foot pedal or by its handle; pull the table out by the pallet handles.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · laserové rezanie', 'Simulator · laser cutting')}
            title={L('Vláknový laser', 'Fibre laser')}
            sub={L(
              'Predloha: Amada BREVIS 1212 AJ – vláknový laser 3 kW, pracovný priestor 1 270 × 1 270 × 200 mm, rýchloposuv 40 m/min, AMNC 3i, oceľ / nerez / hliník do 12 mm. Rezné podmienky sú orientačné. Mierka 1 : 100 mm.',
              'Modelled after the Amada BREVIS 1212 AJ – 3 kW fibre laser, work area 1,270 × 1,270 × 200 mm, rapid 40 m/min, AMNC 3i, steel / stainless / aluminium up to 12 mm. Cutting conditions are approximate. Scale 1 : 100 mm.',
            )}
            rows={[
              [L('Obrys', 'Contour'), `${tele.ops ? Math.min(tele.op + 1, tele.ops) : 0} / ${tele.ops}`],
              [L('Diely', 'Parts'), info ? `${info.good} / ${info.parts}` : '—'],
              [
                L('Čas', 'Time'),
                `${Math.floor(tele.time / 60)}:${String(Math.floor(tele.time % 60)).padStart(2, '0')}`,
              ],
            ]}
            foot={[
              tele.sheet ? `${tele.sheet.mat} · ${tele.sheet.t} mm` : L('bez plechu', 'no sheet'),
              info && info.edges.length ? info.edges.map((e) => edge[e]).join(', ') : '—',
            ]}
            status={statusMsg}
          />
          <TaskSection
            machine="amada"
            tasks={LASER_TASK_LIST}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={() => apiRef.current.newBlank?.()}
            safety={{ ui, set, runKey: 'running', items: LASER_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Stroj', 'Machine')}</h2>
            <div className="flex gap-2">
              <button type="button" className="btn-run flex-1" onClick={() => act('start')}>
                {L('▶ Štart', '▶ Start')}
              </button>
              <button type="button" className="btn flex-1" onClick={() => act('hold')}>
                {L('Zastaviť', 'Hold')}
              </button>
              <button type="button" className="btn flex-1" onClick={() => act('reset')}>
                RESET
              </button>
            </div>
            <Toggle on={ui.power} label={L('Napájanie', 'Power')} onClick={() => act('power')} />
            <Toggle on={ui.laser} label={L('Laserový zdroj', 'Laser source')} onClick={() => act('laser')} />
            <Toggle on={ui.estop} label={L('Núdzový stop', 'Emergency stop')} onClick={() => act('estop')} />
            <Toggle on={ui.door} label={L('Čelné dvere otvorené', 'Front door open')} onClick={() => act('door')} />
            <Toggle on={ui.drawer} label={L('Stôl vysunutý', 'Table pulled out')} onClick={() => act('drawer')} />
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn flex-1" onClick={() => act('loadSheet')}>
                {L('Naložiť plech', 'Load sheet')}
              </button>
              <button type="button" className="btn flex-1" onClick={() => act('unload')}>
                {L('Vybrať diely', 'Unload parts')}
              </button>
              <button type="button" className="btn flex-1" onClick={() => act('skeleton')}>
                {L('Odobrať zvyšok', 'Remove skeleton')}
              </button>
            </div>
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Plech a program', 'Sheet and program')}</h2>
              <SectionInfo title={L('Rezné podmienky', 'Cutting conditions')}>
                <p className="text-xs muted">
                  {L(
                    'Oceľ sa reže kyslíkom pri nízkom tlaku – horenie pridáva teplo. Nerez a hliník dusíkom pod vysokým tlakom, hrana ostane lesklá. Príliš rýchly rez neprereže plech alebo nechá otrep, príliš pomalý prepáli hranu.',
                    'Steel is cut with low-pressure oxygen – burning adds heat. Stainless and aluminium with high-pressure nitrogen, the edge stays bright. Too fast a cut does not go through or leaves dross, too slow burns the edge.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label={L('Materiál', 'Material')}
              value={ui.mat}
              options={Object.entries(MATERIALS).map(([k, m]) => [k, L(m.sk, m.en)])}
              onChange={(v) => set('mat', v)}
            />
            <SegRow
              label={L('Hrúbka mm', 'Thickness mm')}
              value={ui.t}
              options={MATERIALS[ui.mat].thick.map((t) => [t, String(t)])}
              onChange={(v) => set('t', v)}
            />
            <SegRow
              label={L('Program', 'Program')}
              value={ui.prog}
              options={Object.entries(PROGRAMS).map(([k, p]) => [k, L(p.sk, p.en)])}
              onChange={(v) => set('prog', v)}
            />
            <button type="button" className="btn w-full mt-2" onClick={() => act('table')}>
              {L('Prevziať podmienky z tabuľky', 'Take conditions from the table')}
              {rec ? ` (${rec.speed} m/min · ${rec.gas} ${rec.pressure} bar)` : ''}
            </button>
            <SegRow
              label={L('Rezný plyn', 'Assist gas')}
              value={ui.gas}
              options={GAS()}
              onChange={(v) => set('gas', v)}
            />
            <Slider
              id="lsv"
              label={L('Rýchlosť rezu', 'Cutting speed')}
              unit="m/min"
              min={0.3}
              max={30}
              step={0.1}
              value={ui.speed}
              digits={1}
              onChange={(v) => set('speed', v)}
            />
            <Slider
              id="lsp"
              label={L('Výkon laseru', 'Laser power')}
              unit="%"
              min={10}
              max={100}
              step={5}
              value={ui.pw}
              digits={0}
              onChange={(v) => set('pw', v)}
            />
            <Slider
              id="lsg"
              label={L('Tlak plynu', 'Gas pressure')}
              unit="bar"
              min={0.3}
              max={20}
              step={0.1}
              value={ui.pressure}
              digits={1}
              onChange={(v) => set('pressure', v)}
            />
            <Slider
              id="lsf"
              label={L('Poloha ohniska', 'Focus position')}
              unit="mm"
              min={-5}
              max={5}
              step={0.5}
              value={ui.focus}
              digits={1}
              onChange={(v) => set('focus', v)}
            />
            <Slider
              id="lso"
              label={L('Regulátor rýchlosti (override)', 'Speed override')}
              unit="%"
              min={50}
              max={150}
              step={5}
              value={ui.ovr}
              digits={0}
              onChange={(v) => set('ovr', v)}
            />
            <p className="text-xs muted mt-2">
              {L('Odhad programu', 'Program estimate')}: {stats.parts} {L('ks', 'pcs')}, {stats.pierces}{' '}
              {L('prepalov', 'pierces')}, {(stats.cutLen / 1000).toFixed(1)} m, ≈ {Math.ceil(stats.time / 60)} min
            </p>
            <SegRow
              label={L('Zrýchlenie simulácie', 'Simulation speed')}
              value={ui.ts}
              options={[1, 5, 20, 60].map((v) => [v, `${v}×`])}
              onChange={(v) => set('ts', v)}
            />
          </div>
          <ExportSection machine="amada" apiRef={apiRef} canSave={false} canStl={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['obsluha', L('Miesto obsluhy', 'Operator')],
              ['priestor', L('Rezací priestor', 'Cutting area')],
              ['zhora', L('Paleta zhora', 'Pallet from above')],
              ['panel', L('Panel', 'Panel')],
              ['zboku', L('Pravý bok', 'Right side')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

// ---------- obrazovka AMNC 3i (zjednodušená) ----------
function drawHmi(g, W, H, d) {
  g.fillStyle = '#0d1b2a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#16324f';
  g.fillRect(0, 0, W, 44);
  g.fillStyle = '#ffffff';
  g.font = 'bold 22px Arial';
  g.fillText('AMNC 3i', 14, 29);
  g.font = '18px Arial';
  g.fillText(d.progName, 130, 29);
  const ph =
    { idle: 'READY', ready: 'READY', run: 'CUTTING', hold: 'HOLD', done: 'END' }[d.phase] || d.phase.toUpperCase();
  g.fillStyle = d.alarm ? '#ff5a4f' : d.phase === 'run' ? '#5bd27a' : '#f2c26b';
  g.fillRect(W - 170, 8, 156, 28);
  g.fillStyle = '#0d1b2a';
  g.font = 'bold 18px Arial';
  g.fillText(d.alarm ? 'ALARM' : ph, W - 160, 29);
  // nesting
  const S = 330,
    ox = 16,
    oy = 58,
    k = S / 1250;
  g.fillStyle = '#1d2b3a';
  g.fillRect(ox, oy, S, S);
  g.strokeStyle = '#5b6b7b';
  g.strokeRect(ox, oy, S, S);
  d.ops.forEach((o, i) => {
    g.strokeStyle =
      i < d.op
        ? d.results[i] && d.results[i].edge !== 'ok'
          ? '#ff8a1f'
          : '#5bd27a'
        : i === d.op && d.phase === 'run'
          ? '#ffd166'
          : '#8fa3b6';
    g.lineWidth = i === d.op ? 2 : 1;
    g.beginPath();
    o.pts.forEach(([u, v], j) => (j ? g.lineTo(ox + u * k, oy + S - v * k) : g.moveTo(ox + u * k, oy + S - v * k)));
    g.closePath();
    g.stroke();
  });
  g.fillStyle = '#ff5a4f';
  g.beginPath();
  g.arc(ox + d.hx * k, oy + S - d.hy * k, 4, 0, TAU);
  g.fill();
  // údaje
  g.fillStyle = '#cfe0f0';
  g.font = '17px Arial';
  const rows = [
    ['MAT', d.mat],
    ['GAS', `${d.gas}  ${d.pressure.toFixed(1)} bar`],
    ['F', `${d.speed.toFixed(1)} m/min  (${d.ovr}%)`],
    ['P', `${Math.round((BREVIS.power * d.pw) / 100)} W`],
    ['FOCUS', `${d.focus.toFixed(1)} mm`],
    ['X / Y', `${d.hx.toFixed(1)} / ${d.hy.toFixed(1)}`],
    ['PROG', `${Math.min(d.op + 1, d.ops.length)} / ${d.ops.length}`],
    ['TIME', `${Math.floor(d.time / 60)}:${String(Math.floor(d.time % 60)).padStart(2, '0')}`],
    ['LASER', d.laser ? (d.beam ? 'BEAM ON' : 'READY') : 'OFF'],
  ];
  rows.forEach(([a, b], i) => {
    g.fillStyle = '#7f95aa';
    g.fillText(a, 366, 86 + i * 34);
    g.fillStyle = a === 'LASER' && d.beam ? '#ffb347' : '#e6f0fa';
    g.fillText(b, 450, 86 + i * 34);
  });
  // spodné tlačidlá
  ['PROGRAM', 'CONDITION', 'MANUAL', 'SETUP', 'MAINT'].forEach((t, i) => {
    g.fillStyle = i === 1 ? '#2d6aa3' : '#22384f';
    g.fillRect(16 + i * 124, H - 46, 116, 34);
    g.fillStyle = '#ffffff';
    g.font = 'bold 14px Arial';
    g.fillText(t, 26 + i * 124, H - 23);
  });
}

function buildAmada(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, say, sayOnce, anchors, views, apiRef } = x;
  const model = buildBrevis({ kit, det, M, grp });
  const proc = createLaserProcess();
  const SW = model.sheet;
  // ---------- tabuľa: kreslenie rezov ----------
  const px = (u) => (u / 1250) * SW.px,
    py = (v) => (1 - v / 1250) * SW.px;
  const colorOf = (m) => ({ S235: [118, 126, 134], 1.4301: [196, 200, 204], AlMg3: [214, 218, 222] })[m];
  const fillSheet = (m) => {
    if (!SW.cv) return;
    const g = SW.cv.getContext('2d'),
      [r, gg, b] = colorOf(m);
    g.clearRect(0, 0, SW.px, SW.px);
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(0, 0, SW.px, SW.px);
    for (let i = 0; i < 1600; i++) {
      const y = Math.random() * SW.px,
        d = (Math.random() - 0.5) * 22;
      g.fillStyle = `rgba(${d > 0 ? 255 : 0},${d > 0 ? 255 : 0},${d > 0 ? 255 : 0},${Math.abs(d) / 255})`;
      g.fillRect(0, y, SW.px, 1);
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, SW.px - 4, SW.px - 4);
    SW.tex.needsUpdate = true;
  };
  const edgeColor = { ok: '#151515', otrep: '#3a2a20', oxid: '#5a2f12', prepal: '#1d1f3a', nie: '#5d6266' };
  const drawSegs = (segs) => {
    if (!SW.cv || !segs.length) return;
    const g = SW.cv.getContext('2d');
    g.lineCap = 'round';
    segs.forEach((s) => {
      g.strokeStyle = edgeColor[s.q.edge];
      g.lineWidth = s.q.edge === 'prepal' ? 4 : s.q.edge === 'nie' ? 1.2 : 2.4;
      g.beginPath();
      g.moveTo(px(s.x0), py(s.y0));
      g.lineTo(px(s.x1), py(s.y1));
      g.stroke();
    });
    SW.tex.needsUpdate = true;
  };
  const clearPoly = (pts) => {
    if (!SW.cv) return;
    const g = SW.cv.getContext('2d');
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000'; // plná výplň – inak by sa zmazalo len toľko, koľko má posledná farba
    g.beginPath();
    pts.forEach(([u, v], i) => (i ? g.lineTo(px(u), py(v)) : g.moveTo(px(u), py(v))));
    g.closePath();
    g.fill();
    g.restore();
    SW.tex.needsUpdate = true;
  };
  // ---------- obrazovka ----------
  const scr = (() => {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = 800;
    cv.height = 500;
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    model.display.material.map = tx;
    model.display.material.needsUpdate = true;
    return { cv, tx };
  })();
  // ---------- stav ----------
  Object.assign(st, {
    doorK: 0,
    shellK: 0,
    drawerK: 0,
    side: [0, 0, 0],
    laserT: 0,
    laserReady: false,
    sheet: null, // { mat, t, cut, unloaded }
    doorAlarm: false,
    unloaded: false,
    sparks: [],
    hmiT: 0,
  });
  model.sheet.mesh.visible = false;
  const cond = () => ({
    speed: (c.speed * c.ovr) / 100,
    power: c.pw,
    gas: c.gas,
    pressure: c.pressure,
    focus: c.focus,
  });
  const sidesOpen = () => c.sideL || c.sideR1 || c.sideR2 || st.side.some((k) => k > 0.01);
  const running = () => proc.S.phase === 'run';
  const startCheck = () => {
    if (!c.power) return 'power';
    if (c.estop) return 'estop';
    if (!st.laserReady) return 'laser';
    if (c.door || st.doorK > 0.01 || st.shellK > 0.01) return 'door';
    if (sidesOpen()) return 'side';
    if (c.drawer || st.drawerK > 0.01) return 'drawer';
    if (!st.sheet) return 'sheet';
    if (st.sheet.t > BREVIS.maxT[st.sheet.mat]) return 'thick';
    return null;
  };
  const act = {
    power: () => {
      if (running()) return say(L('Najprv zastav program.', 'Stop the program first.'));
      push('power', !c.power);
      if (!c.power) push('laser', false);
    },
    laser: () => {
      if (!c.power) return say(L('Najprv zapni napájanie.', 'Switch on the power first.'));
      if (running()) return say(L('Laser sa nevypína počas rezu.', 'The laser is not switched off while cutting.'));
      push('laser', !c.laser);
    },
    estop: () => {
      push('estop', !c.estop);
      if (c.estop) {
        proc.hold('estop');
        push('laser', false);
      }
    },
    door: () => {
      if (!c.power && !c.door)
        return say(L('Dvere sa ovládajú pri zapnutom stroji.', 'The door works with the machine powered.'));
      if (!c.door && running()) {
        proc.hold('dooropen');
        st.doorAlarm = true;
      }
      push('door', !c.door);
    },
    drawer: () => {
      if (!c.door || st.doorK < 0.98) return say(L('Najprv úplne otvor čelo.', 'Fully open the front first.'));
      if (running()) return;
      push('drawer', !c.drawer);
    },
    side: (k) => {
      const key = ['sideL', 'sideR1', 'sideR2'][k];
      if (!c[key] && running()) {
        proc.hold('side');
        st.doorAlarm = true;
      }
      push(key, !c[key]);
    },
    loadSheet: () => {
      if (!c.drawer || st.drawerK < 0.98) return say(L('Vysuň stôl k obsluhe.', 'Pull the table out to the operator.'));
      if (st.sheet) return say(L('Na stole už je plech.', 'There is already a sheet on the table.'));
      if (c.t > BREVIS.maxT[c.mat])
        return say(L('Táto hrúbka presahuje rozsah stroja.', 'This thickness exceeds the machine range.'));
      st.sheet = { mat: c.mat, t: c.t, cut: false };
      st.unloaded = false;
      proc.reset();
      fillSheet(c.mat);
      model.sheet.mesh.visible = true;
    },
    unload: () => {
      if (!c.drawer || st.drawerK < 0.98) return say(L('Vysuň stôl k obsluhe.', 'Pull the table out to the operator.'));
      if (!st.sheet || proc.S.phase !== 'done')
        return say(L('Diely sa vyberajú po dokončení programu.', 'The parts are unloaded after the program ends.'));
      proc.S.ops.forEach((o, i) => {
        const r = proc.S.results[i];
        if (!o.inner && r && r.through) clearPoly(o.pts);
      });
      st.unloaded = true;
      say(
        L('Diely sú vybraté – zostáva kostra tabule.', 'The parts are unloaded – the sheet skeleton remains.'),
        'info',
      );
    },
    skeleton: () => {
      if (!c.drawer || st.drawerK < 0.98) return say(L('Vysuň stôl k obsluhe.', 'Pull the table out to the operator.'));
      if (running()) return;
      st.sheet = null;
      model.sheet.mesh.visible = false;
    },
    table: () => {
      const r = recommend(c.mat, c.t);
      if (!r) return;
      push('speed', r.speed);
      push('gas', r.gas);
      push('pressure', r.pressure);
      push('focus', r.focus);
      push('pw', 100);
      push('ovr', 100);
    },
    start: () => {
      if (proc.S.phase === 'hold' && proc.job()) {
        const why = startCheck();
        if (why) return (proc.S.alarm = why);
        proc.S.alarm = null;
        proc.S.phase = 'run';
        return;
      }
      if (st.sheet?.cut) return (proc.S.alarm = 'cut');
      const why = startCheck();
      if (why) return (proc.S.alarm = why);
      if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) {
        proc.load(c.prog, st.sheet.mat, st.sheet.t, cond());
        proc.start(() => null);
        st.sheet.cut = true;
        st.doorAlarm = false;
      } else apiRef.current.safetyGate.request();
    },
    hold: () => proc.hold(),
    reset: () => {
      if (c.estop) push('estop', false);
      if (proc.S.phase === 'hold' || proc.S.alarm) {
        proc.S.alarm = null;
        if (proc.S.phase === 'hold') {
          proc.S.phase = 'done';
          proc.S.done = true;
        }
      }
    },
  };
  apiRef.current.act = act;
  apiRef.current.toggleRun = () => (running() ? act.hold() : act.start());
  apiRef.current.newBlank = () => {
    if (running()) return false;
    proc.reset();
    st.sheet = null;
    st.unloaded = false;
    st.doorAlarm = false;
    model.sheet.mesh.visible = false;
    return true;
  };
  // ---------- ovládače v scéne ----------
  const B = model.btn;
  const btn = (o, label, hint, action, read) => ctrl.reg({ type: 'button', label, hint, action, read }, o);
  btn(
    B.power,
    LL('Napájanie', 'Power'),
    LL('Zapne alebo vypne napájanie stroja.', 'Switches the machine power on or off.'),
    act.power,
    () => (c.power ? 'I' : '0'),
  );
  btn(
    B.laser,
    LL('Laser', 'Laser'),
    LL(
      'Zapne laserový zdroj – pred rezaním sa niekoľko sekúnd zahrieva.',
      'Switches the laser source on – it warms up for a few seconds before cutting.',
    ),
    act.laser,
    () => (st.laserReady ? 'READY' : c.laser ? '…' : 'OFF'),
  );
  btn(
    B.door,
    LL('Dvere', 'Door'),
    LL('Vysunie čelné dvere pod strechu alebo ich zatvorí.', 'Slides the front door up under the roof or closes it.'),
    act.door,
  );
  btn(
    B.start,
    LL('CYCLE START', 'CYCLE START'),
    LL(
      'Spustí program (dvere zatvorené, stôl zasunutý, laser pripravený).',
      'Starts the program (door closed, table in, laser ready).',
    ),
    act.start,
  );
  btn(
    B.hold,
    LL('FEED HOLD', 'FEED HOLD'),
    LL('Pozastaví rez – lúč sa vypne.', 'Pauses the cut – the beam switches off.'),
    act.hold,
  );
  btn(
    B.reset,
    LL('RESET', 'RESET'),
    LL('Zruší alarm a ukončí pozastavený program.', 'Clears the alarm and ends a held program.'),
    act.reset,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Núdzový STOP', 'Emergency STOP'),
      hint: LL('Okamžite zastaví stroj a vypne laser.', 'Stops the machine immediately and switches the laser off.'),
      action: act.estop,
      latched: () => c.estop,
    },
    B.estop,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.15,
      inc: 1,
      label: LL('Regulátor rýchlosti', 'Speed override'),
      hint: LL(
        'Mení rýchlosť rezu v percentách – ovplyvní kvalitu hrany.',
        'Changes the cutting speed in percent – it affects the edge quality.',
      ),
      turn: (d) => push('ovr', clamp(Math.round(c.ovr + (d / TAU) * 20), 50, 150)),
      read: () => `${c.ovr} %`,
    },
    model.knob,
  );
  btn(
    model.pedal,
    LL('Nožný pedál dverí', 'Door foot pedal'),
    LL('Šliapnutím otvoríš alebo zatvoríš čelné dvere.', 'Press to open or close the front door.'),
    act.door,
  );
  btn(
    model.door,
    LL('Madlo čelných dverí', 'Front door handle'),
    LL(
      'Vysunie dvere pod strechu a zasunie posuvné diely dozadu, alebo všetko zatvorí.',
      'Slides the door under the roof and the sliding sections back, or closes everything.',
    ),
    act.door,
    () => (c.door ? L('otvorené', 'open') : L('zatvorené', 'closed')),
  );
  model.grips.forEach((h, k) =>
    btn(
      h,
      [
        LL('Madlo predného posuvného dielu', 'Front sliding section grip'),
        LL('Madlo stredného posuvného dielu', 'Middle sliding section grip'),
      ][k],
      LL(
        'Pravý bok so strechou je delený na dva diely – zasunú sa dozadu nad skriňu zdroja (spolu s čelnými dverami).',
        'The right side with the roof is split into two sections – they slide back over the source cabinet (together with the front door).',
      ),
      act.door,
      () => (c.door ? L('otvorené', 'open') : L('zatvorené', 'closed')),
    ),
  );
  model.handles.forEach((h) =>
    btn(
      h,
      LL('Rukoväť stola', 'Table handle'),
      LL(
        'Vysunie stôl k obsluhe alebo ho zasunie do stroja (dvere musia byť otvorené).',
        'Pulls the table out to the operator or pushes it in (the door must be open).',
      ),
      act.drawer,
      () => (c.drawer ? L('vysunutý', 'out') : L('zasunutý', 'in')),
    ),
  );
  model.doorsSide.forEach((d, k) =>
    btn(
      d.pivot,
      [
        LL('Ľavé servisné dvere', 'Left service door'),
        LL('Zadné dvere skrine zdroja', 'Laser source cabinet rear door'),
        LL('Servisné dvere ľavého stĺpa', 'Left column service door'),
      ][k],
      LL(
        'Servisné dvere sú blokované – otvorenie zastaví lúč.',
        'The service doors are interlocked – opening one stops the beam.',
      ),
      () => act.side(k),
    ),
  );
  // ---------- pohľady a popisy ----------
  Object.assign(anchors, {
    podstavec: () => v3(10.5, 3.0, 13.4),
    kryt: () => v3(-9.2, 19.0, 12.0),
    dvere: () => v3(5.5, 16.5, 13.4),
    stol: () => v3(-4.2, BV.TY, BV.FZ + 0.6 + st.drawerK * BV.DRAWER),
    portal: () => v3(model.gx.position.x, 16.6, model.gz.position.z),
    plech: () => v3(BV.SX, BV.TY, BV.SZ + st.drawerK * BV.DRAWER),
    panel: () => v3(-14.65, 17.9, BV.FZ + 1.2),
    prislusenstvo: () => v3(-5.6, 6.6, -19.4),
  });
  Object.assign(views, {
    celok: () => [
      [30, 22, 40],
      [0, 9, 2],
    ],
    obsluha: () => [
      [-2, 19, 38],
      [1, 9, 10],
    ],
    priestor: () => [[6.5, 22.5, 24], [3.0, 8.6, 6], true], // cez pravé okno dverí
    zhora: () => [[1, 31, 38], [0.6, 8.6, 15], true], // vysunutá paleta zhora
    panel: () => [[-13.4, 15.0, 25.4], [-14.65, 13.6, 15.45], true],
    zboku: () => [[50, 15, 2], [0, 9, 0], true],
  });
  // ---------- slučka ----------
  let last = 0;
  const update = (dt, t) => {
    if (!c.power) {
      if (running()) proc.hold('power');
      if (c.laser) push('laser', false);
    }
    // laser: zahriatie 3 s
    st.laserT = c.laser && c.power && !c.estop ? st.laserT + dt : 0;
    st.laserReady = st.laserT > 3;
    // dvere, stôl, servisné dvere
    // otváranie: čelné dvere sa vysunú pod strechu, potom sa posuvné diely (strecha + pravý bok) zasunú dozadu;
    // zatváranie v opačnom poradí
    st.shellK = approach(st.shellK, c.door && st.doorK > 0.98 ? 1 : 0, 0.32 * dt);
    st.doorK = approach(st.doorK, c.door ? 1 : st.shellK > 0.001 ? st.doorK : 0, 0.6 * dt);
    st.drawerK = approach(st.drawerK, c.drawer ? 1 : 0, 0.6 * dt);
    st.side = st.side.map((k, i) => approach(k, [c.sideL, c.sideR1, c.sideR2][i] ? 1 : 0, 1.2 * dt));
    const e = (k) => k * k * (3 - 2 * k);
    model.setDoor(e(st.doorK)); // horná hrana po dráhe pod strechou, spodná po čele nahor
    model.setShells(e(st.shellK));
    model.drawer.position.z = BV.DRAWER * e(st.drawerK);
    model.ext.forEach((m) => (m.position.z = (BV.DRAWER * e(st.drawerK)) / 2));
    model.doorsSide.forEach((d, i) => (d.pivot.rotation.y = d.ry0 - d.span * 1.75 * e(st.side[i])));
    // proces
    proc.setCond(cond());
    if (running()) {
      if (!st.laserReady || c.estop) proc.hold(c.estop ? 'estop' : 'laser');
      proc.advance(dt * c.ts);
    }
    drawSegs(proc.takeSegs());
    proc.takeFinished().forEach((f) => {
      if (f.o.inner && f.q.through) clearPoly(f.o.pts); // výrez otvoru vypadne
      if (!f.q.through)
        sayOnce(
          'nie',
          true,
          L(
            'Plech nie je prerezaný – rez je príliš rýchly alebo slabý výkon.',
            'The sheet is not cut through – the cut is too fast or the power too low.',
          ),
          'danger',
        );
      if (f.q.edge === 'oxid')
        sayOnce(
          'ox',
          true,
          L(
            'Hrana sa oxiduje – nerez a hliník rež dusíkom.',
            'The edge oxidises – cut stainless and aluminium with nitrogen.',
          ),
          'warn',
        );
      if (f.q.edge === 'otrep')
        sayOnce(
          'otr',
          true,
          L(
            'Na spodnej hrane vzniká otrep – skontroluj rýchlosť, tlak a ohnisko.',
            'Dross forms on the bottom edge – check speed, pressure and focus.',
          ),
          'warn',
        );
      if (f.q.edge === 'prepal')
        sayOnce(
          'pre',
          true,
          L('Hrana je prepálená – rýchlosť je príliš nízka.', 'The edge is burnt – the speed is too low.'),
          'warn',
        );
    });
    // hlava
    // mimo rezu hlava parkuje vzadu v strede – dráha zasúvaných dverí ostáva voľná
    const H = proc.S.head,
      [wx, wz] = running() ? sheetToWorld(clamp(H.x, -10, 1260), clamp(H.y, -10, 1260)) : sheetToWorld(625, 1250);
    model.gx.position.x = approach(model.gx.position.x, wx, 30 * dt);
    model.gz.position.z = approach(model.gz.position.z, wz, 30 * dt);
    const hz = proc.S.phase === 'run' || proc.S.phase === 'hold' ? H.z : 30;
    model.gy.position.y = BV.TY + 0.02 + hz / 100;
    const beam = proc.S.beam && running();
    model.glow.visible = beam;
    model.beamLight.intensity = beam ? 6 + Math.random() * 3 : 0;
    // iskry pod plechom
    if (beam && st.sparks.length < 160)
      for (let k = 0; k < 4; k++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.08), M.spark);
        sp.position.set(model.gx.position.x, BV.TY - 0.05, model.gz.position.z);
        x.scene.add(sp);
        st.sparks.push({
          m: sp,
          v: v3((Math.random() - 0.5) * 2, -2 - Math.random() * 4, (Math.random() - 0.5) * 2),
          life: 0.35,
        });
      }
    st.sparks = st.sparks.filter((s) => {
      s.life -= dt;
      s.v.y -= 9 * dt;
      s.m.position.addScaledVector(s.v, dt);
      if (s.life <= 0 || s.m.position.y < 5.5) {
        x.scene.remove(s.m);
        s.m.geometry.dispose();
        return false;
      }
      return true;
    });
    model.led.material.emissiveIntensity = c.power ? 1.2 : 0;
    model.cabLight.intensity = c.power ? 40 : 0;
    model.knob.rotation.z = -((c.ovr - 100) / 50) * 0.75 * Math.PI; // 50–150 % na stupnici ±135°
    B.estop.position.z = c.estop ? 0.0 : 0.07;
    // obrazovka každých 0,2 s
    if (scr && t - last > 0.2) {
      last = t;
      const g = scr.cv.getContext('2d');
      if (!c.power) {
        g.fillStyle = '#05080b';
        g.fillRect(0, 0, 800, 500);
      } else
        drawHmi(g, 800, 500, {
          progName: L(PROGRAMS[c.prog].sk, PROGRAMS[c.prog].en),
          phase: proc.S.phase,
          alarm: proc.S.alarm,
          ops: proc.S.ops.length ? proc.S.ops : operations(c.prog),
          op: proc.S.op,
          results: proc.S.results,
          hx: H.x,
          hy: H.y,
          mat: st.sheet ? `${st.sheet.mat}  ${st.sheet.t} mm` : '—',
          gas: c.gas,
          pressure: c.pressure,
          speed: (c.speed * c.ovr) / 100,
          ovr: c.ovr,
          pw: c.pw,
          focus: c.focus,
          time: proc.S.time,
          laser: st.laserReady,
          beam,
        });
      scr.tx.needsUpdate = true;
    }
  };
  const measure = () => {
    const job = proc.job();
    return {
      prog: job?.prog || null,
      mat: st.sheet?.mat || job?.mat || c.mat,
      t: st.sheet?.t || job?.t || c.t,
      info: laserInfo(proc.S, job?.prog),
      doorAlarm: st.doorAlarm,
      unloaded: st.unloaded,
    };
  };
  return {
    update,
    tele: () => ({
      phase: proc.S.phase,
      op: proc.S.op,
      ops: proc.S.ops.length,
      laserReady: st.laserReady,
      sheet: st.sheet ? { mat: st.sheet.mat, t: st.sheet.t } : null,
      doorK: st.doorK,
      drawerK: st.drawerK,
      alarm: proc.S.alarm,
      info: proc.job() ? laserInfo(proc.S, proc.job().prog) : null,
      time: proc.S.time,
    }),
    measure,
    sound: () => ({ motor: c.power ? (st.laserReady ? 0.5 : 0.25) : 0, cut: proc.S.beam && running() ? 0.7 : 0 }),
  };
}

export { AmadaSimulator };
export default AmadaSimulator;
