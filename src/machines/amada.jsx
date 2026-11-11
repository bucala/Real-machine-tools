import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { L, LL } from '../core/i18n';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { WorkAreaButton } from '../ui/workAreaWindow';
import { useTouchScreen } from '../ui/touchScreen';
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
  SoundToggle,
  useMachine,
  useTele,
} from '../ui/common';
import { createClassicScene } from './classic/scaffold';
import { workAreaFeed } from '../core/workAreaFeed';
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
// VLÁKNOVÝ LASER AMADA BREVIS 1212 AJ – 3 kW, tabuľa 1 250 × 1 250, čelné posuvné dvere, posuvné diely, výsuvná paleta, AMNC 3i
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
      'Dve čelné krídla sa posúvajú kaskádovo doľava: pravé zájde pod ľavé, potom idú obe spolu pod pevný červený stĺp a úplne otvorené sú celé mimo otvoru, prečnievajú cez ľavý bok pod stĺpom. Potom sa pravý bok so strechou – delený na predný a stredný diel – kaskádovo zasunie dozadu – predný diel cez stredný, potom oba spolu nad nižšiu skriňu laserového zdroja, bez presahu za stroj: čelo, strecha aj pravý bok rezacieho priestoru sú otvorené pre paletu, žeriav a údržbu.',
      'The two front leaves slide to the left in cascade: the right one goes under the left one, then both move together under the fixed red column and, fully open, clear the opening completely, protruding past the left side under the column. Then the right side with the roof – split into a front and a middle section – slides back in cascade – the front section over the middle one, then both together over the lower laser source cabinet, without protruding behind the machine: the front, roof and right side of the cutting area open for the pallet, a crane and maintenance.',
    ],
    [
      'stol',
      'Rezacia paleta',
      'Cutting pallet',
      'Výsuvná paleta s hrotovým roštom',
      'Pull-out pallet with a pin grate',
      'Rezacia paleta sa vysúva k obsluhe na nakladanie tabule 1 250 × 1 250 mm a vyberanie dielov. Rošt má dve sady lamiel: párne sa vysúvajú s paletou, nepárne ostávajú v stroji. Pri vysúvaní sa paleta s plechom mierne nadvihne nad pevné lamely, po zasunutí klesne a plech znova leží na hrotoch všetkých lamiel.',
      'The cutting pallet pulls out to the operator for loading the 1,250 × 1,250 mm sheet and unloading the parts. The grate has two sets of slats: the even ones travel with the pallet, the odd ones stay in the machine. When pulled out the pallet with the sheet lifts slightly above the fixed slats; pushed in, it lowers and the sheet rests on the tips of all slats again.',
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
      'Tablet na výšku s gumenými rohmi a bočnými úchopmi na ramene pripevnenom na červenom stĺpe. Pod obrazovkou strieborná doska: núdzový stop, regulátor rýchlosti rezu, štvorcové tlačidlá štartu, zastavenia, dverí, palety (PALLET) a resetu, kľúčový spínač laseru a tlačidlo napájania. Obrazovka ukazuje program a priebeh rezania; vpravo dole je nožný pedál dverí.',
      'Portrait tablet with rubber corners and side grips on an arm fixed to the red column. Below the screen a silver plate: emergency stop, cutting speed override, square start, hold, door, PALLET and reset buttons, laser key switch and power button. The screen shows the program and cutting progress; the door foot pedal is at the front right.',
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
    unload: () => L('Diely vybraté z palety', 'Parts unloaded from the pallet'),
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
        'Otvor dvere, vysuň rezaciu paletu a nalož oceľ S235 hrúbky 3 mm. Zvoľ program príruba, prevezmi rezné podmienky z tabuľky (kyslík) a zapni laser. Zasuň paletu, zatvor dvere a spusti program. Po dorezaní vyber diely.',
        'Open the door, pull out the cutting pallet and load S235 steel 3 mm thick. Select the flange program, take the cutting conditions from the table (oxygen) and switch the laser on. Push the pallet in, close the door and start. When finished, unload the parts.',
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
    'Pred spustením je rezacia paleta zasunutá, dvere zatvorené a odsávanie beží.',
    'Before starting the cutting pallet is pushed in, the doors closed and extraction running.',
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
    cover: false,
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
  const [hmi, setHmi] = useState(false);
  useEffect(() => {
    apiRef.current.openHmi = () => setHmi(true);
  }, [apiRef]);
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
        rear: [0x26282c, 0.55, 0.3],
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
          drawer: L('Rezacia paleta nie je zasunutá.', 'The cutting pallet is not pushed in.'),
          sheet: L('Na palete nie je plech.', 'There is no sheet on the pallet.'),
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
        tools={
          <button type="button" className="scene-btn" onClick={() => setHmi(true)}>
            HMI
          </button>
        }
        tips={[
          L(
            'Čelné dvere otvoríš tlačidlom na paneli, nožným pedálom alebo za madlo; rezaciu paletu vysunieš tlačidlom PALLET alebo za jej rukoväte.',
            'Open the front door with the panel button, the foot pedal or by its handle; pull the cutting pallet out with the PALLET button or by its handles.',
          ),
        ]}
      />
      {hmi && <AmadaHmi apiRef={apiRef} ui={ui} tele={tele} set={set} onClose={() => setHmi(false)} />}
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
            <h2 className="sec-title mb-2">{L('Prevádzka', 'Operation')}</h2>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className="btn-run" onClick={() => act('start')}>
                {L('▶ Štart', '▶ Start')}
              </button>
              <button type="button" className="btn" onClick={() => act('hold')}>
                {L('Zastaviť', 'Hold')}
              </button>
              <button type="button" className="btn" onClick={() => act('reset')}>
                Reset
              </button>
              <button
                type="button"
                className={`btn ${ui.power ? 'on' : ''}`}
                aria-pressed={ui.power}
                onClick={() => act('power')}
              >
                {ui.power ? L('Vypnúť stroj', 'Machine off') : L('Zapnúť stroj', 'Machine on')}
              </button>
              <button
                type="button"
                className={`btn ${ui.laser ? 'on' : ''}`}
                aria-pressed={ui.laser}
                onClick={() => act('laser')}
              >
                {ui.laser ? L('Vypnúť laser', 'Laser off') : L('Zapnúť laser', 'Laser on')}
              </button>
              <button
                type="button"
                className={`btn ${ui.estop ? 'on' : ''}`}
                aria-pressed={ui.estop}
                onClick={() => act('estop')}
              >
                {ui.estop ? L('Uvoľniť STOP', 'Release STOP') : L('Núdzový STOP', 'Emergency STOP')}
              </button>
              <button type="button" className="btn" onClick={() => act('door')}>
                {ui.door ? L('Zatvoriť dvere', 'Close door') : L('Otvoriť dvere', 'Open door')}
              </button>
              <button type="button" className="btn" onClick={() => act('cover')}>
                {ui.cover ? L('Zatvoriť kryty', 'Close covers') : L('Otvoriť kryty', 'Open covers')}
              </button>
              <button type="button" className="btn" onClick={() => act('drawer')}>
                {ui.drawer ? L('Zasunúť paletu', 'Pallet in') : L('Vysunúť paletu', 'Pallet out')}
              </button>
            </div>
            <Toggle on={ui.light} label={L('Pracovné osvetlenie', 'Work light')} onClick={() => act('light')} />
            <button type="button" className="btn w-full mt-2" onClick={() => setHmi(true)}>
              {L('Otvoriť HMI', 'Open HMI')}
            </button>
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

// ---------- HMI AMNC 3i na celú obrazovku (dvojklik na obrazovku v ručnom režime alebo tlačidlo HMI) ----------
// verná kópia tabletu z modelu (brevisModel – súradnice hlavy: šírka 5,0, výška 7,1; stred v strede)
const HW = 5.0,
  HH = 7.1;
const hx = (x) => `${((x + HW / 2) / HW) * 100}%`,
  hy = (y) => `${((HH / 2 - y) / HH) * 100}%`,
  hw = (w) => `${(w / HW) * 100}%`,
  hh = (h) => `${(h / HH) * 100}%`;
// obdĺžnik v súradniciach modelu (x0..x1, y0..y1)
const rect = (x0, x1, y0, y1, style = {}) => ({
  position: 'absolute',
  left: hx(x0),
  top: hy(y1),
  width: hw(x1 - x0),
  height: hh(y1 - y0),
  ...style,
});
function AmadaHmi({ apiRef, ui, tele, set, onClose }) {
  const canvasRef = useRef(null),
    closeRef = useRef(null);
  // dotykový displej: klik na plátno prejde na obrazovku stroja (stránky, voľby), hneď sa prekreslí
  const paint = () => {
    apiRef.current.paintHmi?.();
    const src = apiRef.current.getHmiCanvas?.(),
      cv = canvasRef.current;
    if (src && cv) cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  };
  const touch = useTouchScreen(apiRef, paint);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const key = (e) => {
      if (document.querySelector('.work-area-dialog[open]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', key, true);
    let raf,
      last = -1;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 65) return;
      last = now;
      const src = apiRef.current.getHmiCanvas?.(),
        cv = canvasRef.current;
      if (src && cv) cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', key, true);
      document.body.style.overflow = overflow;
    };
  }, []);
  const act = (k) => apiRef.current.act?.[k]?.();
  const lbl = (t, x, y) => (
    <span
      key={`l${t}`}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: hx(x - 0.4),
        top: hy(y + 0.06),
        width: hw(0.8),
        textAlign: 'center',
        color: '#e8ebe6',
        fontSize: '1.05cqh',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {t}
    </span>
  );
  // štvorcové tlačidlo (biele s čiernym rámikom), poloha a veľkosť ako na modeli
  const sq = (k, x, y, r, color, name, on, label, ly) => [
    ctl(
      k,
      name,
      on,
      rect(x - r, x + r, y - r, y + r, {
        background: color,
        border: `0.35cqh solid ${on ? '#5bd27a' : '#2c3034'}`,
        borderRadius: '0.5cqh',
        boxShadow: '0 0.35cqh 0 #000a',
      }),
    ),
    label ? lbl(label, x, y + (ly ?? -r - 0.04)) : null,
  ];
  const round = (k, x, y, r, color, name, on, label, ly) => [
    ctl(
      k,
      name,
      on,
      rect(x - r, x + r, y - r, y + r, {
        borderRadius: '50%',
        background: color,
        border: `0.45cqh solid ${on ? '#5bd27a' : '#b9bec3'}`,
        boxShadow: '0 0.35cqh 0 #000a',
      }),
    ),
    label ? lbl(label, x, y + (ly ?? -r - 0.04)) : null,
  ];
  // ovládací prvok; bez funkcie (k) len dekoratívny, mimo prístupnosti
  const ctl = (k, name, on, style) =>
    k ? (
      <button
        key={k}
        type="button"
        aria-label={name}
        title={name}
        aria-pressed={on === undefined ? undefined : !!on}
        onClick={() => act(k)}
        style={{ ...style, cursor: 'pointer' }}
      />
    ) : (
      <i key={`d${style.left}${style.top}`} aria-hidden="true" style={style} />
    );
  const message = ui.estop
    ? L('Núdzový STOP', 'Emergency STOP')
    : tele.alarm
      ? L('Alarm – stlač RESET', 'Alarm – press RESET')
      : ui.door || ui.cover
        ? L('Dvere alebo kryty otvorené', 'Door or covers open')
        : { idle: 'READY', ready: 'READY', run: 'CUTTING', hold: 'HOLD', done: 'END' }[tele.phase] || '';
  const ovr = (d) => set('ovr', clamp(ui.ovr + d, 50, 150));
  return createPortal(
    <div
      className="hmi-fullscreen amada-hmi"
      role="dialog"
      aria-modal="true"
      aria-labelledby="amada-hmi-title"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="hmi-full-toolbar">
        <strong id="amada-hmi-title">
          AMADA BREVIS 1212 AJ <span>AMNC 3i</span>
        </strong>
        <span className={`hmi-full-message ${tele.alarm || ui.estop ? 'alarm' : ''}`} role="status">
          {message}
        </span>
        <WorkAreaButton apiRef={apiRef} />
        <SoundToggle className="scene-btn" />
        <button
          ref={closeRef}
          type="button"
          className="scene-btn hmi-exit"
          onClick={onClose}
          aria-label={L('Späť k stroju', 'Back to machine')}
          title={L('Späť k stroju', 'Back to machine')}
        >
          ×
        </button>
      </header>
      <section
        className="amada-tablet-pane"
        aria-label={L('Tablet AMNC 3i', 'AMNC 3i tablet')}
        style={{
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5dvh 12px',
          containerType: 'size',
          background: 'radial-gradient(circle at 50% 40%, #3a4047, #1b1f24)',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: `min(100cqh, ${(HH / HW).toFixed(4)} * 100cqw)`,
            aspectRatio: `${HW}/${HH}`,
            containerType: 'size',
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          {/* gumené rohy, telo, bočné úchopy a horné držadlo */}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sy) => (
              <i
                key={`c${sx}${sy}`}
                aria-hidden="true"
                style={rect(sx * 2.15 - 0.6, sx * 2.15 + 0.6, sy * 2.85 - 0.6, sy * 2.85 + 0.6, {
                  background: '#141618',
                  borderRadius: '28%',
                })}
              />
            )),
          )}
          <i aria-hidden="true" style={rect(-2.5, 2.5, -3.25, 3.25, { background: '#1a1c1f', borderRadius: '4cqh' })} />
          {[-1, 1].map((sx) => (
            <i
              key={`g${sx}`}
              aria-hidden="true"
              style={rect(sx * 2.58 - 0.16, sx * 2.58 + 0.16, -2.3, 2.3, {
                background:
                  'repeating-linear-gradient(#34373b 0 1.1cqh, #111 1.1cqh 1.9cqh) 0 50% / 100% 40% no-repeat, #34373b',
                borderRadius: '1cqh',
              })}
            />
          ))}
          <i
            aria-hidden="true"
            style={rect(-1.1, 1.1, 3.1, 3.55, {
              background: 'repeating-linear-gradient(90deg, #111 0 1.6cqh, #34373b 1.6cqh 2.6cqh)',
              borderRadius: '1cqh 1cqh 0 0',
            })}
          />
          {/* čierne sklo s obrazovkou a logami */}
          <i
            aria-hidden="true"
            style={rect(-2.38, 2.38, -0.8, 3.05, { background: '#07080a', borderRadius: '1.2cqh' })}
          />
          <canvas
            ref={canvasRef}
            width="800"
            height="500"
            {...touch}
            aria-label={L('Dotyková obrazovka AMNC 3i', 'AMNC 3i touch screen')}
            style={rect(-2.25, 2.25, 1.2 - 1.405, 1.2 + 1.405, { display: 'block', outline: 'none' })}
          />
          <span
            aria-hidden="true"
            style={{ ...rect(-2.1, -0.6, 2.72, 2.95), color: '#fff', fontWeight: 800, fontSize: '1.7cqh' }}
          >
            ●MADA
          </span>
          <span
            aria-hidden="true"
            style={{ ...rect(1.1, 2.3, -0.68, -0.42), fontSize: '1.6cqh', fontWeight: 800, fontStyle: 'italic' }}
          >
            <b style={{ color: '#d7262e' }}>AMNC</b> <b style={{ color: '#e8ebe6' }}>3i</b>
          </span>
          {/* strieborná doska a čierne ovládacie pole */}
          <i
            aria-hidden="true"
            style={rect(-2.3, 2.3, -3.05, -0.92, { background: '#c4c7cb', borderRadius: '1cqh' })}
          />
          <i
            aria-hidden="true"
            style={rect(-2.1, 2.1, -2.88, -1.08, { background: '#1d1f21', borderRadius: '0.6cqh' })}
          />
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${HW} ${HH}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <polyline
              points={[
                [-0.62, -1.42],
                [-0.62, -1.3],
                [0.25, -1.3],
                [0.25, -1.62],
              ]
                .map(([x, y]) => `${x + HW / 2},${HH / 2 - y}`)
                .join(' ')}
              fill="none"
              stroke="#e8ebe6"
              strokeWidth="0.02"
            />
            <polyline
              points={[
                [-0.62, -2.22],
                [-0.62, -2.15],
                [0.05, -2.15],
                [0.05, -2.22],
              ]
                .map(([x, y]) => `${x + HW / 2},${HH / 2 - y}`)
                .join(' ')}
              fill="none"
              stroke="#e8ebe6"
              strokeWidth="0.02"
            />
          </svg>
          {/* núdzový stop so žltým krúžkom */}
          <i
            aria-hidden="true"
            style={rect(-1.7 - 0.3625, -1.7 + 0.3625, -2.0 - 0.3625, -2.0 + 0.3625, {
              background: '#f2b705',
              borderRadius: '50%',
            })}
          />
          <button
            type="button"
            aria-label={
              ui.estop ? L('Uvoľniť núdzový STOP', 'Release Emergency STOP') : L('Núdzový STOP', 'Emergency STOP')
            }
            aria-pressed={!!ui.estop}
            onClick={() => act('estop')}
            style={rect(-1.95, -1.45, -2.25, -1.75, {
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 35%, #f04848, #b5121c)',
              border: 'none',
              boxShadow: ui.estop ? 'inset 0 0.6cqh 1cqh #0009' : '0 0.6cqh 0 #5a0a0e',
              cursor: 'pointer',
            })}
          />
          {/* regulátor posuvu: klik vľavo / vpravo, koliesko alebo šípky */}
          <button
            type="button"
            aria-label={`${L('Regulátor rýchlosti rezu', 'Cutting speed override')} ${ui.ovr} %`}
            title={`OVERRIDE ${ui.ovr} %`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              ovr(e.clientX < r.left + r.width / 2 ? -5 : 5);
            }}
            onWheel={(e) => ovr(e.deltaY > 0 ? -5 : 5)}
            onKeyDown={(e) => {
              if (['ArrowLeft', 'ArrowDown'].includes(e.key)) ovr(-5);
              if (['ArrowRight', 'ArrowUp'].includes(e.key)) ovr(5);
            }}
            style={rect(-1.14, -0.76, -2.19, -1.81, {
              borderRadius: '50%',
              background: '#f4f5f6',
              border: '0.3cqh solid #9aa0a5',
              boxShadow: '0 0 0 0.9cqh #2a2d30',
              cursor: 'pointer',
              transform: `rotate(${((ui.ovr - 100) / 50) * 135}deg)`,
              backgroundImage: 'linear-gradient(#111, #111)',
              backgroundSize: '8% 45%',
              backgroundPosition: '50% 4%',
              backgroundRepeat: 'no-repeat',
            })}
          />
          {lbl(`OVERRIDE ${ui.ovr}%`, -0.95, -2.4)}
          {sq('light', -1.72, -1.32, 0.1, '#f2f3f4', L('Pracovné osvetlenie', 'Work light'), ui.light, 'LIGHT', 0.2)}
          {sq(null, -1.42, -1.32, 0.1, '#f2f3f4', '')}
          {sq('cover', -0.45, -1.62, 0.13, '#f2f3f4', L('Bočné kryty', 'Side covers'), ui.cover, 'COVER', 0.26)}
          {sq(null, -0.12, -1.62, 0.13, '#f2f3f4', '')}
          {sq('drawer', 0.25, -1.82, 0.13, '#f2c200', L('Rezacia paleta', 'Cutting pallet'), ui.drawer, 'PALLET')}
          {sq('door', 0.62, -1.48, 0.13, '#f2f3f4', L('Čelné dvere', 'Front door'), ui.door, 'DOOR', 0.26)}
          {sq('start', -0.45, -2.42, 0.13, '#2e9b4a', L('Štart cyklu', 'Cycle start'), undefined, 'START')}
          {sq('hold', -0.12, -2.42, 0.13, '#f2f3f4', L('Zastaviť', 'Hold'), undefined, 'HOLD')}
          {sq('reset', 0.85, -2.5, 0.13, '#2563c9', 'Reset', undefined, 'RESET')}
          {/* kľúčový spínač laseru */}
          <button
            type="button"
            aria-label={L('Kľúčový spínač laseru', 'Laser key switch')}
            aria-pressed={!!ui.laser}
            onClick={() => act('laser')}
            style={rect(0.68, 1.02, -2.15, -1.81, {
              borderRadius: '50%',
              background: 'radial-gradient(circle, #8d949a 40%, #c9ced2 42%)',
              border: `0.35cqh solid ${ui.laser ? '#5bd27a' : '#555'}`,
              cursor: 'pointer',
            })}
          >
            <i
              style={{
                position: 'absolute',
                left: '42%',
                top: '-30%',
                width: '16%',
                height: '80%',
                background: '#f2b705',
                borderRadius: '0.4cqh',
                transform: `rotate(${ui.laser ? 90 : 0}deg)`,
                transformOrigin: '50% 75%',
              }}
            />
          </button>
          {lbl('LASER', 0.85, -2.21)}
          {round('power', 1.45, -1.6, 0.15, '#f4f5f6', L('Napájanie', 'Power'), ui.power, 'POWER', 0.3)}
          {round(null, 1.45, -2.38, 0.15, '#2b2e31', '')}
          {/* konektory na pravom boku */}
          {[-2.0, -2.45].map((y) => (
            <i
              key={`k${y}`}
              aria-hidden="true"
              style={rect(2.5, 2.75, y - 0.12, y + 0.12, { background: '#2b2e31', borderRadius: '0.5cqh' })}
            />
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}

// ---------- obrazovka AMNC 3i (zjednodušená) ----------
// spoločné vykreslenie obrazovky AMNC 3i: hlavička, (pri PROGRAM / CONDITION) nesting vľavo, dotykové prvky stránky
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
  if (d.nest) {
    const S = 330,
      ox = 16,
      oy = 58,
      k = S / 1250;
    g.fillStyle = '#1d2b3a';
    g.fillRect(ox, oy, S, S);
    g.strokeStyle = '#5b6b7b';
    g.lineWidth = 1;
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
  }
  // texty stránky: [text, x, y, farba, písmo]
  d.texts.forEach(([t, x, y, col = '#e6f0fa', font = '17px Arial']) => {
    g.fillStyle = col;
    g.font = font;
    g.fillText(t, x, y);
  });
  // dotykové tlačidlá (aj spodné voľby stránok)
  d.widgets.forEach((w) => {
    g.fillStyle = w.on ? '#2d6aa3' : w.dis ? '#1a2633' : '#22384f';
    g.fillRect(w.x, w.y, w.w, w.h);
    if (w.on || w.hot) {
      g.strokeStyle = w.hot ? '#ffd166' : '#7fb6ff';
      g.lineWidth = 2;
      g.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
    }
    g.fillStyle = w.dis ? '#6b7d8f' : '#ffffff';
    g.font = `bold ${w.fs || 14}px Arial`;
    const tw = g.measureText(w.label).width;
    g.fillText(w.label, w.x + (w.w - tw) / 2, w.y + w.h / 2 + (w.fs || 14) * 0.36);
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
  apiRef.current.getHmiCanvas = () => scr?.cv || null;
  // ---------- stav ----------
  Object.assign(st, {
    doorK: 0,
    doorTgt: 0, // cieľ čelných krídel: 0 zatvorené, doorStep pravé pod ľavým, 1 obe pod stĺpom
    shellK: 0,
    pedalDir: 1,
    pedal: null,
    page: 'condition', // stránka dotykovej obrazovky AMNC 3i
    view: null, // naposledy vykreslené dotykové prvky
    beamT: 0,
    pendingCover: false,
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
    if (c.door || c.cover || st.doorK > 0.01 || st.shellK > 0.01) return 'door';
    if (sidesOpen()) return 'side';
    if (c.drawer || st.drawerK > 0.01) return 'drawer';
    if (!st.sheet) return 'sheet';
    if (st.sheet.t > BREVIS.maxT[st.sheet.mat]) return 'thick';
    return null;
  };
  const setDoorTgt = (v) => {
    st.doorTgt = v;
    push('door', v > 0);
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
    light: () => push('light', !c.light),
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
      if (c.door && c.cover) push('cover', false); // pri zatváraní sa najprv vrátia bočné kryty
      setDoorTgt(c.door ? 0 : 1);
    },
    // bočné posuvné kryty (pravý bok so strechou) – otvárajú sa až pri úplne otvorených čelných dverách
    cover: () => {
      if (!c.cover && (!c.door || st.doorK < 0.98))
        return say(L('Najprv úplne otvor čelné dvere.', 'Fully open the front door first.'));
      if (!c.cover && running()) {
        proc.hold('dooropen');
        st.doorAlarm = true;
      }
      push('cover', !c.cover);
    },
    // pedál – krátke stlačenie posúva len čelné krídla po jednom: pravé pod ľavé → obe pod stĺp → späť pravé
    // → zatvorené; dlhé podržanie otvorí / zatvorí čelo aj bočné kryty naraz
    pedalStep: () => {
      const k = model.doorStep;
      if (!c.door && !c.power)
        return say(L('Dvere sa ovládajú pri zapnutom stroji.', 'The door works with the machine powered.'));
      if (st.doorTgt >= 1) st.pedalDir = -1;
      else if (st.doorTgt <= 0) st.pedalDir = 1;
      if (st.pedalDir > 0) {
        if (!c.door && running()) {
          proc.hold('dooropen');
          st.doorAlarm = true;
        }
        setDoorTgt(st.doorTgt < k ? k : 1);
      } else {
        if (c.cover) push('cover', false); // krídla sa pohnú až po zasunutí bočných krytov
        setDoorTgt(st.doorTgt > k ? k : 0);
      }
    },
    pedalAll: () => {
      if (c.door || c.cover) {
        if (c.cover) push('cover', false);
        if (c.door) act.door();
        st.pedalDir = 1;
      } else {
        act.door();
        if (c.door) st.pendingCover = true;
        st.pedalDir = -1;
      }
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
      if (!c.drawer || st.drawerK < 0.98)
        return say(L('Vysuň rezaciu paletu k obsluhe.', 'Pull the cutting pallet out to the operator.'));
      if (st.sheet) return say(L('Na palete už je plech.', 'There is already a sheet on the pallet.'));
      if (c.t > BREVIS.maxT[c.mat])
        return say(L('Táto hrúbka presahuje rozsah stroja.', 'This thickness exceeds the machine range.'));
      st.sheet = { mat: c.mat, t: c.t, cut: false };
      st.unloaded = false;
      proc.reset();
      fillSheet(c.mat);
      model.sheet.mesh.visible = true;
    },
    unload: () => {
      if (!c.drawer || st.drawerK < 0.98)
        return say(L('Vysuň rezaciu paletu k obsluhe.', 'Pull the cutting pallet out to the operator.'));
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
      if (!c.drawer || st.drawerK < 0.98)
        return say(L('Vysuň rezaciu paletu k obsluhe.', 'Pull the cutting pallet out to the operator.'));
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
  // ---------- dotyková obrazovka AMNC 3i: stránky PROGRAM, CONDITION, MANUAL, SETUP, MAINT ----------
  const PAGES = [
    ['program', 'PROGRAM'],
    ['condition', 'CONDITION'],
    ['manual', 'MANUAL'],
    ['setup', 'SETUP'],
    ['maint', 'MAINT'],
  ];
  const r1 = (v) => Math.round(v * 10) / 10;
  const mmss = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  const busy = () => {
    if (!running()) return false;
    say(L('Počas rezu sa toto nastavenie nemení.', 'This setting is not changed while cutting.'));
    return true;
  };
  const adj = (key, d, lo, hi) => push(key, r1(clamp(c[key] + d, lo, hi)));
  const screenView = () => {
    const H = proc.S.head,
      T = [],
      Wd = [];
    const b = (x, y, w, h, label, fn, o = {}) => Wd.push({ x, y, w, h, label, fn, ...o });
    const row = (lab, val, x, y, col) => {
      T.push([lab, x, y, '#7f95aa']);
      T.push([val, x + 130, y, col]);
    };
    PAGES.forEach(([k, t], i) => b(16 + i * 124, 454, 116, 34, t, () => (st.page = k), { on: st.page === k }));
    const shut = !c.door && !c.cover && st.doorK < 0.01 && st.shellK < 0.01;
    const sideOpen = c.sideL || c.sideR1 || c.sideR2;
    let nest = false;
    if (st.page === 'program') {
      nest = true;
      T.push(['PROGRAM', 366, 78, '#7fb6ff', 'bold 17px Arial']);
      const progs = Object.entries(PROGRAMS);
      progs.forEach(([k, p], i) =>
        b(366, 92 + i * 52, 418, 44, L(p.sk, p.en), () => !busy() && push('prog', k), { on: c.prog === k, fs: 15 }),
      );
      const y0 = 92 + progs.length * 52 + 34,
        ops = proc.S.ops.length ? proc.S.ops : operations(c.prog);
      row('CONTOURS', `${Math.min(proc.S.op + 1, ops.length)} / ${ops.length}`, 366, y0);
      row('SHEET', st.sheet ? `${st.sheet.mat}  ${st.sheet.t} mm` : '—', 366, y0 + 32);
      row('TIME', mmss(proc.S.time), 366, y0 + 64);
      row(
        'STATUS',
        proc.S.alarm ? 'ALARM' : proc.S.phase.toUpperCase(),
        366,
        y0 + 96,
        proc.S.alarm ? '#ff5a4f' : undefined,
      );
    } else if (st.page === 'condition') {
      nest = true;
      const gases = ['O2', 'N2', 'AIR'];
      [
        [
          'F  m/min',
          `${r1((c.speed * c.ovr) / 100).toFixed(1)}${c.ovr !== 100 ? `  (${c.ovr}%)` : ''}`,
          'speed',
          0.1,
          0.3,
          30,
        ],
        ['P', `${c.pw} %  ·  ${Math.round((BREVIS.power * c.pw) / 100)} W`, 'pw', 5, 10, 100],
        ['GAS', c.gas, 'gas'],
        ['PRESS  bar', c.pressure.toFixed(1), 'pressure', 0.1, 0.3, 20],
        ['FOCUS  mm', c.focus.toFixed(1), 'focus', 0.5, -5, 5],
      ].forEach(([lab, val, key, step, lo, hi], i) => {
        const y = 60 + i * 48;
        T.push([lab, 366, y + 26, '#7f95aa']);
        T.push([val, 466, y + 26]);
        if (key === 'gas')
          b(650, y, 130, 38, 'O2 / N2 / AIR', () => {
            if (!busy()) push('gas', gases[(gases.indexOf(c.gas) + 1) % gases.length]);
          });
        else {
          b(650, y, 60, 38, '−', () => adj(key, -step, lo, hi), { fs: 22 });
          b(720, y, 60, 38, '+', () => adj(key, step, lo, hi), { fs: 22 });
        }
      });
      b(366, 300, 414, 38, 'E-TABLE  →  CONDITION', () => !busy() && act.table());
      row('X / Y', `${H.x.toFixed(1)} / ${H.y.toFixed(1)}`, 366, 372);
      row(
        'LASER',
        st.laserReady ? (proc.S.beam && running() ? 'BEAM ON' : 'READY') : 'OFF',
        366,
        402,
        proc.S.beam && running() ? '#ffb347' : undefined,
      );
      row('TIME', mmss(proc.S.time), 366, 432);
    } else if (st.page === 'manual') {
      [
        ['DOOR', c.door, act.door],
        ['COVER', c.cover, act.cover],
        ['PALLET', c.drawer, act.drawer],
        ['LIGHT', c.light, act.light],
        ['LASER', c.laser, act.laser],
        ['RESET', false, act.reset],
        ['LOAD SHEET', false, act.loadSheet],
        ['UNLOAD PARTS', false, act.unload],
        ['REMOVE SKELETON', false, act.skeleton],
      ].forEach(([t, on, fn], i) => b(16 + (i % 3) * 256, 60 + Math.floor(i / 3) * 70, 246, 60, t, fn, { on, fs: 17 }));
      row('X / Y', `${H.x.toFixed(1)} / ${H.y.toFixed(1)} mm`, 24, 300);
      row('SHEET', st.sheet ? `${st.sheet.mat}  ${st.sheet.t} mm` : '—', 24, 332);
      row('PALLET', st.drawerK > 0.99 ? 'OUT' : st.drawerK < 0.01 ? 'IN' : 'MOVING', 24, 364);
      row('INTERLOCK', shut && !sideOpen ? 'CLOSED' : 'OPEN', 24, 396, shut && !sideOpen ? '#5bd27a' : '#ffb347');
      row('FRONT DOOR', `${Math.round(st.doorK * 100)} %`, 420, 300);
      row('SIDE COVERS', `${Math.round(st.shellK * 100)} %`, 420, 332);
      row('LIGHT', c.light ? 'ON' : 'OFF', 420, 364);
      row('OVERRIDE', `${c.ovr} %`, 420, 396);
    } else if (st.page === 'setup') {
      T.push(['MATERIAL', 16, 80, '#7fb6ff', 'bold 16px Arial']);
      Object.entries(MATERIALS).forEach(([k, m], i) =>
        b(
          16 + i * 258,
          92,
          248,
          44,
          `${k}  ${L(m.sk, m.en)}`,
          () => {
            if (busy()) return;
            push('mat', k);
            if (!m.thick.includes(c.t)) push('t', m.thick[0]);
          },
          { on: c.mat === k, fs: 14 },
        ),
      );
      T.push(['THICKNESS  mm', 16, 170, '#7fb6ff', 'bold 16px Arial']);
      MATERIALS[c.mat].thick.forEach((v, i) =>
        b(16 + i * 154, 182, 144, 44, String(v), () => !busy() && push('t', v), { on: c.t === v, fs: 17 }),
      );
      T.push(['SIMULATION SPEED', 16, 260, '#7fb6ff', 'bold 16px Arial']);
      [1, 5, 20, 60].forEach((v, i) =>
        b(16 + i * 154, 272, 144, 44, `${v}×`, () => push('ts', v), { on: c.ts === v, fs: 17 }),
      );
      row('LOADED', st.sheet ? `${st.sheet.mat}  ${st.sheet.t} mm` : '—', 16, 360);
      row('MAX', `${BREVIS.maxT[c.mat]} mm`, 16, 392);
      row('WORK AREA', '1270 × 1270 mm', 420, 360);
      row('SOURCE', `FIBER ${BREVIS.power / 1000} kW`, 420, 392);
    } else {
      const ok = (v) => (v ? 'OK' : 'CHECK'),
        rows = [
          ['SOURCE', `FIBER ${BREVIS.power / 1000} kW`],
          ['BEAM ON', mmss(st.beamT)],
          ['CUT TIME', mmss(proc.S.time)],
          ['CHILLER', c.power ? 'RUN' : 'OFF'],
          ['GAS', `${c.gas}  ${c.pressure.toFixed(1)} bar`],
          ['NOZZLE', '1.5 mm  SINGLE'],
          ['PROT. GLASS', ok(true)],
          ['FRONT DOOR', c.door ? 'OPEN' : 'CLOSED'],
          ['SIDE COVERS', c.cover ? 'OPEN' : 'CLOSED'],
          ['SERVICE', sideOpen ? 'OPEN' : 'CLOSED'],
          ['E-STOP', c.estop ? 'ACTIVE' : 'OK'],
          ['ALARM', proc.S.alarm ? String(proc.S.alarm).toUpperCase() : '—'],
        ];
      rows.forEach(([a, v], i) =>
        row(a, v, i < 6 ? 24 : 420, 82 + (i % 6) * 36, /OPEN|ACTIVE|CHECK/.test(v) ? '#ffb347' : undefined),
      );
      b(16, 300 + 2 * 36, 246, 50, 'ALARM RESET', act.reset, { fs: 16 });
    }
    return { nest, texts: T, widgets: Wd, page: st.page };
  };
  const drawScreen = () => {
    if (!scr) return;
    const g = scr.cv.getContext('2d');
    if (!c.power) {
      st.view = null;
      g.fillStyle = '#05080b';
      g.fillRect(0, 0, 800, 500);
    } else {
      const H = proc.S.head;
      st.view = screenView();
      drawHmi(g, 800, 500, {
        ...st.view,
        progName: L(PROGRAMS[c.prog].sk, PROGRAMS[c.prog].en),
        phase: proc.S.phase,
        alarm: proc.S.alarm,
        ops: proc.S.ops.length ? proc.S.ops : operations(c.prog),
        op: proc.S.op,
        results: proc.S.results,
        hx: H.x,
        hy: H.y,
      });
    }
    scr.tx.needsUpdate = true;
  };
  const hitAt = (x, y) => st.view?.widgets.find((w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
  apiRef.current.hmiPoint = (x, y) => {
    const w = hitAt(x, y);
    if (!w) return null;
    w.fn();
    return { id: w.label };
  };
  apiRef.current.hmiHover = (x, y) => !!hitAt(x, y);
  apiRef.current.paintHmi = drawScreen;
  // živý pohľad do rezacieho priestoru (Priestor / Split v HMI): pevná širokouhlá kamera vnútri krytu
  // pod strechou za čelným sklom – celý plech a portál v zábere bez pohybu kamery
  apiRef.current.mountWorkArea = workAreaFeed({
    scene: x.scene,
    camera: x.camera,
    renderer: x.renderer,
    fov: 84,
    view: () => [
      [-3.0, 17.0, 12.4],
      [BV.SX, BV.TY, BV.SZ - 1.0],
    ],
  });
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
    B.pallet,
    LL('PALLET – rezacia paleta', 'PALLET – cutting pallet'),
    LL(
      'Vysunie alebo zasunie rezaciu paletu (dvere musia byť otvorené).',
      'Pulls the cutting pallet out or pushes it in (the door must be open).',
    ),
    act.drawer,
    () => (c.drawer ? L('vysunutá', 'out') : L('zasunutá', 'in')),
  );
  btn(
    B.door,
    LL('Dvere', 'Door'),
    LL(
      'Odsunie čelné dvere doľava pod červený stĺp alebo ich zatvorí.',
      'Slides the front door left under the red column or closes it.',
    ),
    act.door,
  );
  btn(
    B.start,
    LL('CYCLE START', 'CYCLE START'),
    LL(
      'Spustí program (dvere zatvorené, paleta zasunutá, laser pripravený).',
      'Starts the program (door closed, pallet in, laser ready).',
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
    LL(
      'Krátke stlačenie posúva len čelné krídla po jednom: pravé pod ľavé, obe pod stĺp, späť pravé, zatvorené. Dlhé podržanie otvorí alebo zatvorí čelo aj bočné kryty naraz.',
      'A short press moves only the front leaves one at a time: right under left, both under the column, right back, closed. A long press opens or closes the front and the side covers at once.',
    ),
    () => {
      st.pedal = { t0: performance.now(), fired: false };
    },
  );
  const pedalK = ctrl.entries().find((k) => k.pivot === model.pedal);
  btn(
    B.light,
    LL('LIGHT – osvetlenie', 'LIGHT – work light'),
    LL('Zapne alebo vypne osvetlenie pracovného priestoru.', 'Switches the work area light on or off.'),
    act.light,
    () => (c.light ? 'ON' : 'OFF'),
  );
  btn(
    B.cover,
    LL('COVER – bočné kryty', 'COVER – side covers'),
    LL(
      'Zasunie pravý bok so strechou dozadu alebo ho vráti (čelné dvere musia byť otvorené).',
      'Slides the right side with the roof back or returns it (the front door must be open).',
    ),
    act.cover,
    () => (c.cover ? L('otvorené', 'open') : L('zatvorené', 'closed')),
  );
  // dvojklik na obrazovku v ručnom režime otvorí HMI na celú obrazovku (ako pri iných strojoch)
  x.dom?.addEventListener('dblclick', (e) => {
    if (!c.manual) return;
    const hit = ctrl.pickAt(e.clientX, e.clientY);
    if (hit?.object !== model.display) return;
    e.preventDefault();
    apiRef.current.openHmi?.();
  });
  btn(
    model.door,
    LL('Madlo čelných dverí', 'Front door handle'),
    LL(
      'Odsunie čelné dvere doľava pod červený stĺp alebo ich zatvorí (otvorené bočné kryty sa najprv vrátia).',
      'Slides the front door left under the red column or closes it (open side covers return first).',
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
        'Pravý bok so strechou je delený na dva diely – kaskádovo sa zasunú dozadu nad skriňu zdroja (čelné dvere musia byť otvorené).',
        'The right side with the roof is split into two sections – they slide back in cascade over the source cabinet (the front door must be open).',
      ),
      act.cover,
      () => (c.cover ? L('otvorené', 'open') : L('zatvorené', 'closed')),
    ),
  );
  model.handles.forEach((h) =>
    btn(
      h,
      LL('Rukoväť rezacej palety', 'Cutting pallet handle'),
      LL(
        'Vysunie rezaciu paletu k obsluhe alebo ju zasunie do stroja (dvere musia byť otvorené).',
        'Pulls the cutting pallet out to the operator or pushes it in (the door must be open).',
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
  // pohyb dverí, krytov, palety a servisných dverí (beží aj počas prehliadky obrobku)
  const enclosure = (dt) => {
    if (!c.door) st.doorTgt = 0;
    else if (st.doorTgt <= 0) st.doorTgt = 1; // obnovený stav alebo iné ovládanie
    st.doorK = approach(st.doorK, st.shellK > 0.001 ? st.doorK : st.doorTgt, 0.35 * dt);
    // paleta vyjde až pri úplne otvorenom čele
    st.drawerK = approach(st.drawerK, c.drawer && st.doorK > 0.98 ? 1 : 0, 0.6 * dt);
    st.side = st.side.map((k, i) => approach(k, [c.sideL, c.sideR1, c.sideR2][i] ? 1 : 0, 1.2 * dt));
    const e = (k) => k * k * (3 - 2 * k);
    // pravé krídlo pod ľavé, potom obe spolu pod stĺp; plynulý rozbeh a dobeh aj v medzipolohe pedálu
    const ks = model.doorStep;
    model.setDoor(st.doorK <= ks ? ks * e(st.doorK / ks) : ks + (1 - ks) * e((st.doorK - ks) / (1 - ks)));
    model.setShells(e(st.shellK));
    model.drawer.position.z = BV.DRAWER * e(st.drawerK);
    // pri vysúvaní sa paleta s plechom nadvihne nad pevné lamely, pri zasunutí klesne späť na všetky hroty
    model.drawer.position.y = 0.22 * e(clamp(st.drawerK / 0.08, 0, 1));
    model.ext.forEach((m) => (m.position.z = (BV.DRAWER * e(st.drawerK)) / 2));
    model.doorsSide.forEach((d, i) => (d.pivot.rotation.y = d.ry0 - d.span * 1.75 * e(st.side[i])));
  };
  // Pozrieť obrobok: pri vypnutom alebo nečinnom stroji sa úplne otvorí čelo a vysunie paleta, plech sa vyberie
  // na prehliadku; po vrátení sa dvere a paleta vrátia do pôvodného stavu
  let before = null;
  const inspect = {
    workObj: () => model.sheet.mesh,
    workSpot: () => v3(BV.SX, BV.TY + 4.5, BV.SZ + BV.DRAWER + 7),
    canInspect: () =>
      running() || proc.S.phase === 'hold'
        ? L(
            'Plech sa dá pozrieť pri vypnutom alebo nečinnom stroji.',
            'The sheet can be inspected with the machine off or idle.',
          )
        : !st.sheet
          ? L('Na palete nie je plech.', 'There is no sheet on the pallet.')
          : null,
    prepareInspect: () => {
      before = { tgt: st.doorTgt, drawer: c.drawer };
      setDoorTgt(1);
      push('drawer', true);
    },
    canDetach: () => st.doorK > 0.99 && st.drawerK > 0.99,
    restoreInspect: () => {
      if (!before) return;
      push('drawer', before.drawer);
      setDoorTgt(before.tgt);
      before = null;
    },
    idleUpdate: (dt) => enclosure(dt),
  };
  const update = (dt, t) => {
    if (!c.power) {
      if (running()) proc.hold('power');
      if (c.laser) push('laser', false);
    }
    // laser: zahriatie 3 s
    st.laserT = c.laser && c.power && !c.estop ? st.laserT + dt : 0;
    st.laserReady = st.laserT > 3;
    // dvere, rezacia paleta, servisné dvere
    // otváranie: čelné krídla sa kaskádovo odsunú doľava pod stĺp, potom sa posuvné diely (strecha + pravý bok) zasunú dozadu;
    // zatváranie v opačnom poradí
    if (st.pendingCover && c.door && st.doorK > 0.98) {
      st.pendingCover = false;
      act.cover();
    }
    if (!c.door) st.pendingCover = false;
    st.shellK = approach(st.shellK, c.cover && c.door && st.doorK > 0.98 ? 1 : 0, 0.32 * dt);
    // pedál: dlhé podržanie (> 0,6 s) otvorí / zatvorí všetko, krátke stlačenie posunie o krok
    if (st.pedal) {
      if (pedalK.pressed) {
        if (!st.pedal.fired && performance.now() - st.pedal.t0 > 600) {
          st.pedal.fired = true;
          act.pedalAll();
        }
      } else {
        if (!st.pedal.fired) act.pedalStep();
        st.pedal = null;
      }
    }
    enclosure(dt);
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
    if (beam) st.beamT += dt;
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
    const lit = c.power && c.light; // osvetlenie pracovného priestoru (tlačidlo svetla)
    model.led.material.emissiveIntensity = lit ? 1.2 : 0;
    model.cabLight.intensity = lit ? 40 : 0;
    model.knob.rotation.z = -((c.ovr - 100) / 50) * 0.75 * Math.PI; // 50–150 % na stupnici ±135°
    B.estop.position.z = c.estop ? 0.0 : 0.07;
    // obrazovka každých 0,2 s
    if (scr && t - last > 0.2) {
      last = t;
      drawScreen();
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
    ...inspect,
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
