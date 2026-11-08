import { PartLabelsButton } from '../../ui/common';
import { SectionInfo } from '../../ui/sectionInfo';
import { useEffect, useRef, useState } from 'react';
import { L } from '../../core/i18n';
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
} from '../../ui/common';
import { MODELS } from './kin';
import { SAMPLES } from './programs';
import { MATERIALS } from './tooling';
import { createCncScene } from './cncScene';
import { HmiFullscreen } from '../../ui/hmiFullscreen';
import { StepDownloadButton, TaskSection } from '../../ui/tools';
import { PocketDrawing } from '../../ui/sketch';
import { CNC_SAFETY, CNC_TASK_PROGRAMS, cncChecks } from './cncTasks';
import { CncToolPreview } from '../../ui/cncToolPreview';
import { ToolLibrary } from '../../ui/toolLibrary';
import { ToolPicker } from '../../ui/toolPicker';
import { installTool, MAX_FILE_BYTES } from './toolLibrary';
import { RXU, validateRxuTool, RXU_PROGRAM } from '../precision/profiles';

// =====================================================================
// 5-OSÉ CNC JADRO (HERMLE C 32 / C 42, RÖDERS RXU) – panel: program, nástroje, polotovar, úlohy, prevádzka.
// 3D scénu a beh programu stavia cncScene.js, úlohy a ich kontroly sú v cncTasks.js.
// =====================================================================
const hermleParts = () =>
  mkParts([
    [
      'kabina',
      'Kabína',
      'Cabin',
      'Kabína s posuvnými dverami',
      'Cabin with sliding doors',
      'Uzavretý pracovný priestor s veľkými oknami. Dvere majú bezpečnostný zámok – pri otvorených dverách sa program nespustí a posuv sa zastaví.',
      'Enclosed working area with large windows. The doors are interlocked – with the doors open the program does not start and the feed stops.',
    ],
    [
      'lozko',
      'Lôžko',
      'Bed',
      'Lôžko z minerálneho liatia',
      'Mineral-cast bed',
      'Masívne lôžko z minerálneho liatia tlmí chvenie. Os A stola je uložená priamo v lôžku.',
      'The massive mineral-cast bed damps vibration. The table A axis is mounted directly in the bed.',
    ],
    [
      'osi',
      'Osi X Y Z',
      'X Y Z axes',
      'Upravený portál – osi nad pracovným priestorom',
      'Modified gantry – axes above the working area',
      'Všetky tri lineárne osi nesie nástroj: priečnik Y jazdí po dvoch vedeniach na stenách lôžka, sane X po priečniku a smykadlo Z zvisle. Dráhy 650 × 650 × 500 mm, rýchloposuv 45 / 45 / 40 m/min.',
      'The tool carries all three linear axes: the Y cross-beam runs on two guideways on the bed walls, the X slide on the cross-beam and the Z ram vertically. Travels 650 × 650 × 500 mm, rapid traverse 45 / 45 / 40 m/min.',
    ],
    [
      'vreteno',
      'Vreteno',
      'Spindle',
      'Motorové vreteno HSK-A63',
      'HSK-A63 motor spindle',
      '18 000 ot/min, 42 kW / 148 Nm (20 % ED). Nástroj sa upína do kužeľa HSK-A63.',
      '18,000 rpm, 42 kW / 148 Nm (20 % duty). The tool is clamped in an HSK-A63 taper.',
    ],
    [
      'stol',
      'Stôl A / C',
      'A / C table',
      'Otočno-sklopný stôl Ø650 × 540 mm',
      'Swivelling rotary table Ø650 × 540 mm',
      'Os A sklápa stôl ±130° okolo osi X, os C ho otáča o 360°. Os A leží v obrobku (stôl tvaru U) – pri sklopení sa obrobok málo vychýli.',
      'The A axis swivels the table ±130° about X, the C axis rotates it 360°. The A axis lies within the workpiece (U-shaped table) – the workpiece moves little when swivelled.',
    ],
    [
      'zasobnik',
      'Zásobník',
      'Magazine',
      'Pick-up zásobník 36 / 42 miest',
      '36 / 42-pocket pick-up magazine',
      'Zásobník je integrovaný v lôžku za pracovným priestorom. Vreteno si nástroj vezme samo, výmena trvá asi 4,5 s.',
      'The magazine is integrated in the bed behind the working area. The spindle picks the tool itself, a change takes about 4.5 s.',
    ],
    [
      'panel',
      'Ovládací panel',
      'Control panel',
      'Riadiaci systém Heidenhain TNC 640',
      'Heidenhain TNC 640 control',
      'Otočný ovládací panel s 19" dotykovou obrazovkou. Simulátor číta programy ISO (G-kód) aj Heidenhain Klartext.',
      'Swivelling control panel with a 19" touch screen. The simulator reads ISO (G-code) and Heidenhain conversational programs.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Polotovar na upínači',
      'Blank on the fixture',
      'Polotovar na nulovom upínacom systéme. Nulový bod G54 je v strede hornej plochy.',
      'The blank on the zero-point clamping system. Datum G54 is at the centre of the top face.',
    ],
  ]);
// úlohy s hodnotením (kontroly a pripravené programy v cncTasks.js)
const CNC_TASKS = (samples) =>
  [
    {
      id: 'kapsa',
      title: () => L('Kapsa 40 × 30 × 5 ±0,1 mm', 'Pocket 40 × 30 × 5 ±0.1 mm'),
      desc: () =>
        L(
          'Hliníkový polotovar 100 × 80 × 40 mm, nulový bod G54 v strede hornej plochy. Pripravený program vyfrézuje len kapsu 30 × 20 mm do hĺbky 2,5 mm – doplň dráhy tak, aby kapsa mala 40 × 30 mm a hĺbku 5 mm s rovným dnom. Fréza Ø10: dráha stredu nástroja je o polomer 5 mm vnútri steny, hĺbku rozdeľ na dva prechody.',
          'Aluminium blank 100 × 80 × 40 mm, datum G54 at the centre of the top face. The prepared program only mills a 30 × 20 mm pocket 2.5 mm deep – add toolpaths so the pocket is 40 × 30 mm and 5 mm deep with a flat floor. Ø10 cutter: the tool-centre path is one radius (5 mm) inside the wall; split the depth into two passes.',
        ),
      setup: { program: () => CNC_TASK_PROGRAMS.kapsa },
      drawing: () => <PocketDrawing px={40} py={30} depth={5} tol={0.1} />,
      labels: {
        run: () => L('Program dokončený bez alarmu', 'Program finished without alarm'),
        depth: () => L('Hĺbka 5 ±0,1 mm', 'Depth 5 ±0.1 mm'),
        x: () => L('Dĺžka kapsy 40 ±0,1 mm', 'Pocket length 40 ±0.1 mm'),
        y: () => L('Šírka kapsy 30 ±0,1 mm', 'Pocket width 30 ±0.1 mm'),
        floor: () => L('Rovné dno (4 body ±0,1 mm)', 'Flat floor (4 points ±0.1 mm)'),
        load: () => L('Bez preťaženia vretena', 'No spindle overload'),
      },
    },
    {
      id: 'kolizia',
      title: () => L('Nájdi chybu v programe – zápich', 'Find the program error – plunge'),
      desc: () =>
        L(
          'Program má vyfrézovať drážku 30 × 10 mm hlbokú 3 mm, ale pri spustení skončí alarmom. Nájdi chybný blok (pozri Kontrolu programu a riadok alarmu), oprav ho a program dokonči. Do materiálu sa smie vchádzať len pracovným posuvom G1 s posuvom F.',
          'The program should mill a 30 × 10 mm slot 3 mm deep but ends with an alarm. Find the faulty block (see Program check and the alarm line), fix it and finish the program. The tool may enter material only with a working feed G1 and a feed rate F.',
        ),
      setup: { program: () => CNC_TASK_PROGRAMS.kolizia },
      drawing: () => <PocketDrawing px={30} py={10} depth={3} tol={0.2} />,
      labels: {
        run: () => L('Program dokončený bez alarmu', 'Program finished without alarm'),
        depth: () => L('Hĺbka drážky 3 ±0,1 mm', 'Slot depth 3 ±0.1 mm'),
        x: () => L('Dĺžka drážky 30 ±0,2 mm', 'Slot length 30 ±0.2 mm'),
      },
    },
    {
      id: 'naklon',
      title: () => L('3+2: šikmá plocha 30° (G68.2)', '3+2: 30° inclined face (G68.2)'),
      desc: () =>
        L(
          'Spusti ukážkový program 3+2. Príkaz G68.2 definuje naklonenú rovinu, G53.1 natočí stôl osou A tak, aby nástroj stál kolmo na rovinu. Sleduj os A na displeji a over, že vznikne plocha so sklonom 30°.',
          'Run the sample 3+2 program. G68.2 defines a tilted plane, G53.1 rotates the table with the A axis so the tool is normal to the plane. Watch the A axis on the display and check that a 30° face is produced.',
        ),
      setup: { program: () => (samples.find((x) => x.id === 'p32') || {}).text },
      labels: {
        run: () => L('Program dokončený bez alarmu', 'Program finished without alarm'),
        a: () => L('Os A natočená na 30 ±0,1°', 'A axis at 30 ±0.1°'),
        slope: () => L('Sklon plochy 30 ±0,5°', 'Face slope 30 ±0.5°'),
      },
    },
  ].map((t) => ({ ...t, checks: (m) => cncChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Spoločné CNC jadro pre Hermle aj Röders. Geometriu stroja dodá createModel (každý stroj vo vlastnom chunku).
function CncCore({ onBack, model, setModel, text, setText, tools, setTools, progId, setProgId, createModel, params }) {
  const rxu = model === RXU.id,
    MC = rxu ? RXU : MODELS[model] || MODELS.c32;
  const brand = rxu ? 'Röders' : 'Hermle',
    controller = rxu ? 'RMS6' : 'HEIDENHAIN · TNC 640';
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null),
    fileRef = useRef(null);
  const init = {
    door: true,
    cabin: true,
    panelAngle: 0,
    panelYaw: 0,
    hmiLocked: false,
    accessorySetup: 'none',
    speed: 5,
    fo: 100,
    ro: 100,
    single: false,
    mat: 'al',
    sx: 100,
    sy: 80,
    sz: 40,
    res: 0.7,
    labels: false,
    manual: false,
    light: true,
    estop: false,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [hmiOpen, setHmiOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState(null);
  const [libraryPocket, setLibraryPocket] = useState(undefined);
  const [libraryToolId, setLibraryToolId] = useState(undefined);
  const [libraryReturn, setLibraryReturn] = useState(null);
  const [librarySource, setLibrarySource] = useState(null);
  const [programImportError, setProgramImportError] = useState('');
  const samples = rxu
    ? [
        { id: 'rxu', name: L('ISO: kruhová kapsa', 'ISO: circular pocket'), text: RXU_PROGRAM },
        ...SAMPLES().filter((s) => s.id !== 'p3' && s.id !== 'ph'),
      ]
    : SAMPLES();
  const [check, setCheck] = useState({
    errors: [],
    warns: [],
    time: 0,
    dialect: 'iso',
    toolDefs: [],
    stock: null,
    n: 0,
  });
  const [tele, setTele] = useTele({
    run: false,
    paused: false,
    done: false,
    alarm: null,
    line: 0,
    X: 0,
    Y: 0,
    Z: 0,
    A: 0,
    C: 0,
    wx: 0,
    wy: 0,
    wz: 0,
    T: 0,
    S: 0,
    F: 0,
    load: 0,
    mrr: 0,
    t: 0,
    removed: 0,
    busy: false,
    building: false,
    maxLoad: 0,
  });

  useEffect(
    () =>
      createCncScene({
        mount: mountRef.current,
        layer: layerRef.current,
        tipEl: tipRef.current,
        c: ctl.current,
        apiRef,
        set,
        setUi,
        setTele,
        setCheck,
        setHmiOpen,
        MC,
        rxu,
        brand,
        controller,
        createModel,
      }),
    [],
  );

  // program, nástroje alebo polotovar sa zmenili → znova interpretovať (pri zastavenom stroji)
  const reload = (txt = text, tls = tools) => {
    if (!ctl.current.unclamped && apiRef.current.load) {
      set('running', false);
      setCheck(apiRef.current.load(txt, tls));
    }
  };
  useEffect(() => {
    const h = setTimeout(() => reload(), 350);
    return () => clearTimeout(h);
  }, [text, tools, ui.mat, ui.sx, ui.sy, ui.sz, ui.res]);
  const pickSample = (id) => {
    const s = samples.find((x) => x.id === id);
    setProgId(id);
    if (s) setText(s.text);
  };
  const onFile = (e) => {
    const fl = e.target.files && e.target.files[0];
    if (!fl) return;
    setProgramImportError('');
    if (ctl.current.running || ctl.current.unclamped || fl.size > MAX_FILE_BYTES) {
      setProgramImportError(
        L(
          'Zastav stroj a upni obrobok. Najväčší súbor je 2 MB.',
          'Stop the machine and clamp the part. File limit is 2 MB.',
        ),
      );
      e.target.value = '';
      return;
    }
    const rd = new FileReader();
    rd.onload = () => {
      if (ctl.current.running || ctl.current.unclamped) {
        setProgramImportError(
          L(
            'Načítanie zrušené: stroj je v chode alebo je obrobok odopnutý.',
            'Load cancelled: machine is running or workpiece is unclamped.',
          ),
        );
        return;
      }
      setLibrarySource({ text: String(rd.result || ''), name: fl.name });
      setLibraryTab('detect');
    };
    rd.onerror = () => setProgramImportError(L('Súbor sa nepodarilo prečítať.', 'Could not read the file.'));
    rd.readAsText(fl);
    e.target.value = '';
  };
  const save = (blob, nameF) => {
    const u = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = u;
    a.download = nameF;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  const canEditTools = !ctl.current.running && !tele.run && !ui.unclamped;
  const requireStopped = () => {
    if (ctl.current.running || ctl.current.unclamped)
      throw new Error(L('Najprv zastav stroj a upni obrobok.', 'Stop the machine and clamp the workpiece first.'));
  };
  const openToolPicker = (pocket, toolId) => {
    setLibraryPocket(pocket);
    setLibraryToolId(toolId);
    setLibraryReturn(null);
    setLibraryTab('pick');
  };
  const closeLibrary = () => {
    setLibraryTab(null);
    setLibrarySource(null);
    setLibraryPocket(undefined);
    setLibraryToolId(undefined);
    setLibraryReturn(null);
  };
  const closePicker = () => {
    if (libraryReturn) {
      setLibrarySource(libraryReturn.source);
      setLibraryTab(libraryReturn.tab);
      setLibraryReturn(null);
    } else closeLibrary();
  };
  const installSavedTool = (tool, pocket) => {
    requireStopped();
    if (rxu) validateRxuTool(tool);
    setTools((ts) => installTool(ts, tool, pocket, MC.mag));
  };
  const freePocket = Array.from({ length: MC.mag }, (_, i) => i + 1).find((t) => !tools.some((tool) => tool.t === t));
  const start = () => {
    const r = apiRef.current.start && apiRef.current.start();
    if (r === 'ok') set('running', true);
  };
  const tasks = CNC_TASKS(samples);
  // úloha pripraví hliníkový polotovar 100 × 80 × 40 a program; program sa potom znova načíta (reload)
  const setupTask = (task) => {
    if (ctl.current.running || ctl.current.unclamped) return;
    set('mat', 'al');
    set('sx', 100);
    set('sy', 80);
    set('sz', 40);
    const txt = task.setup?.program?.();
    if (txt) {
      setProgId('');
      setText(txt);
    }
  };
  const parts = hermleParts();
  if (!rxu) {
    const dims = MC.id === 'c42' ? '800 × 800 × 550' : '650 × 650 × 500',
      depth = MC.id === 'c42' ? 630 : 540;
    const axis = parts.find((p) => p.key === 'osi');
    axis.desc = L(
      `Tri lineárne osi nesie vreteno; priečnik Y jazdí po stenách minerálneho lôžka. Dráhy ${dims} mm, rýchloposuv 45 / 45 / 40 m/min.`,
      `The spindle carries all three linear axes; the Y crossbeam travels on the mineral-cast bed walls. Travel ${dims} mm, rapid 45 / 45 / 40 m/min.`,
    );
    const table = parts.find((p) => p.key === 'stol');
    table.name = L(
      `Otočno-sklopný stôl Ø${MC.table} × ${depth} mm`,
      `Swivelling rotary table Ø${MC.table} × ${depth} mm`,
    );
    const spindle = parts.find((p) => p.key === 'vreteno');
    spindle.desc = L(
      `18 000 ot/min, ${MC.pmax} kW / ${MC.mmax} Nm (20 % ED), HSK-A63.`,
      `18,000 rpm, ${MC.pmax} kW / ${MC.mmax} Nm (20% duty), HSK-A63.`,
    );
    const magazine = parts.find((p) => p.key === 'zasobnik');
    magazine.desc = L(
      `${MC.mag} miest v karuseli integrovanom do lôžka. Obvodové držiaky, nosný bubon, bočný pohon a vedenia nad prstencom. Výmena pick-up priamo vretenom.`,
      `${MC.mag} pockets in a carousel integrated into the bed. Perimeter forks, support drum, side drive and guideways above the ring. Direct spindle pick-up tool change.`,
    );
  }
  if (rxu) {
    const detail = {
      kabina: [
        'Pracovná kabína RXU',
        'Ľavé bočné pozorovacie okno a červené čelné dvere posúvané doprava po spodnej koľajnici.',
        'Left observation window and red front door sliding to the right along its lower rail.',
      ],
      lozko: [
        'QUADROGUIDE',
        'Masívne lôžko, priame pohony a teplotná stabilizácia.',
        'Massive bed, direct drives and thermal stabilisation.',
      ],
      osi: [
        'QUADROGUIDE · X/Y/Z',
        'Dráhy 800 × 855 × 500 mm; štyri vedenia v rohoch osi Z.',
        '800 × 855 × 500 mm travel; four guide rails at the corners of Z.',
      ],
      vreteno: [
        'HSK-A63 · 24 000 ot/min',
        'Štandardné vreteno 67 Nm S1, nástroj max. Ø35 mm.',
        'Standard spindle 67 Nm S1, tool max. Ø35 mm.',
      ],
      stol: [
        'A/C · Ø600 mm',
        'Obojstranné uloženie, A ±115°, C neobmedzene; nosnosť 800 kg.',
        'Two-sided support, A ±115°, continuous C; 800 kg load.',
      ],
      zasobnik: [
        '24 miest / pockets',
        'Štandardný rotačný zásobník. Čas výmeny v simulácii je odhad.',
        'Standard rotary magazine. Simulated tool-change timing is estimated.',
      ],
      panel: [
        'Röders RMS6',
        'Výukové ISO rozhranie; nejde o emuláciu proprietárneho RMS6.',
        'Training ISO interface; not an emulation of proprietary RMS6.',
      ],
    };
    for (const [key, v] of Object.entries(detail)) {
      const part = parts.find((p) => p.key === key);
      if (part) {
        part.name = v[0];
        part.desc = L(v[1], v[2]);
      }
    }
  }
  const status = ui.unclamped
    ? {
        kind: 'info',
        text: L(
          'Prehliadka obrobku: ťahaním ho otáčaj, kolieskom približuj. Potom ho upni späť.',
          'Workpiece inspection: drag to rotate, scroll to zoom, then clamp it back.',
        ),
      }
    : tele.alarm
      ? {
          kind: 'danger',
          text: `${L('Alarm', 'Alarm')}: ${tele.alarm.text} (${L('riadok', 'line')} ${tele.alarm.line + 1})`,
        }
      : tele.msg
        ? { kind: 'warn', text: tele.msg }
        : tele.done
          ? {
              kind: 'idle',
              text: L(
                `Program ukončený za ${mmss(tele.t)} – odobratých ${fmt(tele.removed, 1)} cm³.`,
                `Program finished in ${mmss(tele.t)} – ${fmt(tele.removed, 1)} cm³ removed.`,
              ),
            }
          : tele.run
            ? {
                kind: 'run',
                text: `${L('Chod programu', 'Program running')} · ${L('riadok', 'line')} ${tele.line + 1}${tele.busy ? L(' · výpočet úberu spomaľuje simuláciu', ' · material removal slows the simulation') : ''}`,
              }
            : tele.paused
              ? {
                  kind: 'warn',
                  text: L(
                    'Program zastavený (M0 / blok po bloku) – pokračuj Štartom.',
                    'Program stopped (M0 / single block) – continue with Start.',
                  ),
                }
              : check.errors.length
                ? {
                    kind: 'danger',
                    text: L(
                      `Program má ${check.errors.length} chýb – pozri Kontrola programu.`,
                      `The program has ${check.errors.length} errors – see Program check.`,
                    ),
                  }
                : {
                    kind: 'idle',
                    text: L(
                      'Pripravený. Zatvor dvere a stlač Štart cyklu.',
                      'Ready. Close the doors and press Cycle start.',
                    ),
                  };
  const chips = [
    {
      color: tele.run ? '#3ee06c' : tele.alarm ? '#ff5a4f' : '#8b8f89',
      text: tele.run ? L('Automat', 'Auto') : tele.alarm ? L('Alarm', 'Alarm') : L('Stojí', 'Stopped'),
    },
    {
      color: ui.door || tele.serviceDoorOpen ? '#ff8a1f' : '#3ee06c',
      text: ui.door || tele.serviceDoorOpen ? L('Dvere otvorené', 'Doors open') : L('Dvere zatvorené', 'Doors closed'),
    },
  ];
  const lines = text.split('\n'),
    li = tele.line,
    from = Math.max(0, li - 4);
  const dro = [
    ['X', tele.X],
    ['Y', tele.Y],
    ['Z', tele.Z],
    ['A', tele.A, 'deg'],
    ['C', tele.C, 'deg'],
  ];
  const tl = tools.find((x) => x.t === tele.T);
  const fz = tl && tele.S > 0 && tele.F > 0 ? tele.F / (tele.S * tl.z) : 0;

  return (
    <div className="machine-app modern-app hermle-app w-full flex flex-col md:flex-row">
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
        workBelowModes
        workLabels={[L('Pozrieť obrobok', 'Inspect workpiece'), L('Upnúť späť', 'Clamp back')]}
        tools={
          <button
            type="button"
            className={`scene-btn ${ui.hmiLocked ? 'on' : ''}`}
            aria-pressed={ui.hmiLocked}
            aria-label={L('HMI', 'HMI')}
            onClick={() => apiRef.current.lockHmi?.()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d={ui.hmiLocked ? 'M8 10V6a4 4 0 0 1 8 0v4' : 'M8 10V6a4 4 0 0 1 8 0'} />
              <path d="M12 14v3" />
            </svg>
            HMI
          </button>
        }
        tips={[
          L(
            'Dvere v ručnom režime otvoríš alebo zatvoríš kliknutím na madlo či ťahaním do strany. Tlačidlo HMI zaistí aktuálnu polohu ramena a panela; ďalším kliknutím ju odistíš.',
            'In manual mode, click a door handle or drag it sideways to open or close the doors. HMI locks the current arm and panel position; click again to unlock.',
          ),
          ...(!rxu
            ? [
                L(
                  'Zásuvku na triesky vysunieš kliknutím; zastavený vozík vyklopíš kliknutím na jeho vaňu. Servisné dvere na bokoch a vzadu otvoríš kliknutím v ručnom režime. Pred spustením programu ich zatvor; pohyb sa zastaví aj počas ich otvárania.',
                  'Click the chip pan to pull it out; with the machine stopped, click the cart bucket to tip it. Click side and rear service doors in manual mode to open them. Close them before starting the program; opening them also stops motion.',
                ),
              ]
            : []),
          L(
            'Nulový bod G54 je v strede hornej plochy polotovaru; nástroje T1 – T10 sú v tabuľke (alebo sa prevezmú z komentárov CAM programu).',
            'Datum G54 is at the centre of the top face of the blank; tools T1 – T10 are in the table (or taken over from the CAM program comments).',
          ),
          L(
            'Bez G43 / G43.4 (alebo TOOL CALL) je naprogramovaná výška čelo vretena – nástroj potom ide o svoju dĺžku hlbšie.',
            'Without G43 / G43.4 (or TOOL CALL) the programmed height is the spindle nose – the tool then goes deeper by its length.',
          ),
          L(
            'Pohľad Nástroj ukáže detail rezu; rýchlosť simulácie a korekcie posuvu sú v paneli.',
            'The Tool view shows a close-up of the cut; simulation speed and feed overrides are in the panel.',
          ),
        ]}
      />
      {libraryTab === 'pick' && (
        <ToolPicker
          tools={tools}
          capacity={MC.mag}
          canApply={canEditTools}
          initialPocket={libraryPocket || 1}
          initialToolId={libraryToolId}
          onInstall={installSavedTool}
          onClose={closePicker}
          backLabel={libraryReturn ? L('Späť do skrinky', 'Back to cabinet') : undefined}
        />
      )}
      {libraryTab && libraryTab !== 'pick' && (
        <ToolLibrary
          initialTab={libraryTab}
          initialPocket={libraryPocket}
          initialToolId={libraryToolId}
          initialNc={librarySource?.text}
          initialName={librarySource?.name}
          tools={tools}
          program={text}
          capacity={MC.mag}
          canApply={canEditTools}
          onChoose={(tool, source) => {
            openToolPicker(libraryPocket || Math.min(MC.mag, tool.t), tool.id);
            setLibraryReturn({ tab: libraryTab, source });
          }}
          onLoadProgram={(txt) => {
            requireStopped();
            setProgId('');
            setText(txt);
          }}
          onClose={closeLibrary}
        />
      )}
      {hmiOpen && (
        <HmiFullscreen
          apiRef={apiRef}
          ui={ui}
          tele={tele}
          model={MC.name}
          brand={brand}
          controller={controller}
          compactOnly={rxu}
          onClose={() => setHmiOpen(false)}
        />
      )}
      <aside className="panel">
        <fieldset className="hermle-settings" disabled={ui.unclamped}>
          <div className="sec">
            <p className="sec-title" style={{ letterSpacing: '.14em' }}>
              {L('Moderné stroje · 5-osé CNC', 'Modern machines · 5-axis CNC')}
            </p>
            <div className="section-heading">
              <h1 className="app-title mt-2" tabIndex={-1}>
                {brand} {MC.name}
              </h1>
              <PartLabelsButton ui={ui} set={set} />
              <SectionInfo title={L('Informácie o stroji', 'Machine information')}>
                <p className="text-xs muted">
                  {rxu
                    ? L(
                        'QUADROGUIDE · X 800 / Y 855 / Z 500 mm · A ±115° · stôl Ø600 mm (katalógový variant), 800 kg · HSK-A63, 24 000 ot/min, 67 Nm S1 · 24 miest. Výučbové ISO rozhranie pre RMS6; čas výmeny, dynamika rotačných osí a zaťaženie sú odhady.',
                        'QUADROGUIDE · X 800 / Y 855 / Z 500 mm · A ±115° · Ø600 mm table (catalogue variant), 800 kg · HSK-A63, 24,000 rpm, 67 Nm S1 · 24 pockets. Educational ISO interface for RMS6; change time, rotary dynamics and load are estimates.',
                      )
                    : L(
                        `5-osé obrábacie centrum: dráhy ${MC.X[1] * 2} × ${MC.Y[1] * 2} × ${MC.nose[1] - MC.nose[0]} mm, otočno-sklopný stôl Ø${MC.table} (A ±130°, C 360°), vreteno ${MC.smax} ot/min HSK-A63, ${MC.pmax} kW, ${MC.mag} miest v zásobníku, Heidenhain TNC 640. Prídavné zariadenia sa zapínajú samostatne nižšie.`,
                        `5-axis machining centre: travels ${MC.X[1] * 2} × ${MC.Y[1] * 2} × ${MC.nose[1] - MC.nose[0]} mm, swivelling rotary table Ø${MC.table} (A ±130°, C 360°), ${MC.smax} rpm HSK-A63 spindle, ${MC.pmax} kW, ${MC.mag} magazine pockets, Heidenhain TNC 640. Optional equipment can be enabled separately below.`,
                      )}
                  {MC.approx ? L(' Údaje C 42 U sú orientačné.', ' C 42 U data are approximate.') : ''}
                </p>
              </SectionInfo>
            </div>
            {!rxu && (
              <div className="mt-2">
                <SegRow
                  label={L('Model', 'Model')}
                  value={model}
                  options={Object.values(MODELS).map((x) => [x.id, x.name])}
                  onChange={(v) => {
                    if (!tele.run) setModel(v);
                  }}
                />
              </div>
            )}

            <div className="cnc-dro mt-3">
              <div className="cnc-dro-col">
                <span className="cnc-dro-h">{L('Stroj', 'Machine')}</span>
                {dro.map(([k, v, u]) => (
                  <div key={k} className="cnc-dro-row">
                    <span>{k}</span>
                    <b>{fmt(v, u ? 2 : 3)}</b>
                  </div>
                ))}
              </div>
              <div className="cnc-dro-col">
                <span className="cnc-dro-h">{L('Obrobok (G54)', 'Workpiece (G54)')}</span>
                {[
                  ['X', tele.wx],
                  ['Y', tele.wy],
                  ['Z', tele.wz],
                ].map(([k, v]) => (
                  <div key={k} className="cnc-dro-row">
                    <span>{k}</span>
                    <b>{fmt(v)}</b>
                  </div>
                ))}
                <div className="cnc-dro-row">
                  <span>T</span>
                  <b>{tele.T || '–'}</b>
                </div>
                <div className="cnc-dro-row">
                  <span>S</span>
                  <b>{tele.S}</b>
                </div>
              </div>
            </div>
            <div className="cnc-bars mt-2 text-xs">
              <div>
                <span>{L('Posuv', 'Feed')}</span>
                <b>{tele.F < 0 ? 'FMAX' : `${tele.F} mm/min`}</b>
              </div>
              <div>
                <span>{L('Úber', 'MRR')}</span>
                <b>{fmt(tele.mrr, 1)} cm³/min</b>
              </div>
              <div>
                <span>fz</span>
                <b>{fz ? `${fmt(fz, 3)} mm` : '–'}</b>
              </div>
              <div className="cnc-load">
                <span>{L('Zaťaženie vretena', 'Spindle load')}</span>
                <i
                  style={{
                    width: `${Math.min(100, tele.load * 100)}%`,
                    background: tele.load > 0.9 ? 'var(--danger)' : tele.load > 0.7 ? 'var(--warn)' : 'var(--accent)',
                  }}
                />
                <b>{Math.round(tele.load * 100)} %</b>
              </div>
            </div>
            <div className={`msg msg-${status.kind}`} role="status">
              <span className="lamp" />
              {status.text}
            </div>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Prevádzka', 'Operation')}</h2>
              <SectionInfo title={L('Prevádzka', 'Operation')}>
                <p className="text-xs muted mb-2">
                  {rxu
                    ? L('Rameno 0–180°.', '0–180° arm swing.')
                    : L(
                        'Poloha 0–100 % medzi krajnými polohami pevného ramena.',
                        'Position 0–100% between the rigid arm endpoints.',
                      )}{' '}
                  {L(
                    'Panel sa natočí k operátorovi automaticky. Korekcia umožňuje vlastné natočenie o 360°. V ručnom ovládaní potiahni panel; Shift + potiahnutie otáča iba panel. Dvojklik na displej otvorí HMI cez celé okno.',
                    'The panel automatically faces the operator. Trim allows a full 360° manual adjustment. In manual mode, drag the panel; Shift + drag rotates only the panel. Double-click the display for full-screen HMI.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <div className="cnc-run">
              <button type="button" className="btn-run start" onClick={start}>
                ▶ {L('Štart cyklu', 'Cycle start')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  apiRef.current.hold && apiRef.current.hold();
                  set('running', false);
                }}
              >
                ❚❚ {L('Stop posuvu', 'Feed hold')}
              </button>
              <button type="button" className="btn" onClick={() => reload()}>
                ■ Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn" onClick={() => apiRef.current.ffwd && apiRef.current.ffwd()}>
                ⏭ {L('Rýchlo na koniec', 'Fast to the end')}
              </button>
              <button
                type="button"
                className={`btn ${ui.estop ? 'active' : ''}`}
                onClick={() => apiRef.current.emergency?.()}
              >
                {ui.estop ? L('Uvoľniť núdzový STOP', 'Release Emergency STOP') : L('Núdzový STOP', 'Emergency STOP')}
              </button>
              <button
                type="button"
                className={`btn ${ui.door ? 'active' : ''}`}
                onClick={() => (apiRef.current.toggleDoor ? apiRef.current.toggleDoor() : set('door', !ui.door))}
              >
                {ui.door ? L('Zatvoriť dvere', 'Close doors') : L('Otvoriť dvere', 'Open doors')}
              </button>
            </div>
            <div className="mt-2">
              <SegRow
                label={L('Rýchlosť simulácie', 'Simulation speed')}
                value={ui.speed}
                options={[
                  [1, '×1'],
                  [5, '×5'],
                  [20, '×20'],
                  [80, '×80'],
                ]}
                onChange={(v) => set('speed', v)}
              />
              <SegRow
                label={L('Korekcia posuvu', 'Feed override')}
                value={ui.fo}
                options={[
                  [50, '50 %'],
                  [100, '100 %'],
                  [120, '120 %'],
                  [150, '150 %'],
                ]}
                onChange={(v) => set('fo', v)}
              />
              <SegRow
                label={L('Rýchloposuv', 'Rapid')}
                value={ui.ro}
                options={[
                  [5, '5 %'],
                  [25, '25 %'],
                  [50, '50 %'],
                  [100, '100 %'],
                ]}
                onChange={(v) => set('ro', v)}
              />
              <Toggle
                on={ui.light}
                label={L('Pracovné osvetlenie', 'Work light')}
                onClick={() => set('light', !ui.light)}
              />
              <Toggle
                on={ui.single}
                label={L('Blok po bloku', 'Single block')}
                onClick={() => set('single', !ui.single)}
              />
              <fieldset className="hermle-hmi-position" disabled={ui.hmiLocked}>
                <SegRow
                  label={L('Poloha ovládacieho panela', 'Control panel position')}
                  value={ui.panelAngle}
                  options={[
                    [0, L('Obsluha', 'Operator')],
                    [90, L('Bok', 'Side')],
                    [180, L('Zásobník', 'Magazine')],
                  ]}
                  onChange={(v) => set('panelAngle', v)}
                />
                <Slider
                  id="hermle-arm-angle"
                  label={rxu ? L('Uhol ramena HMI', 'HMI arm angle') : L('Poloha ramena HMI', 'HMI arm position')}
                  min={0}
                  max={rxu ? 180 : 100}
                  step={0.1}
                  digits={1}
                  disabled={ui.hmiLocked}
                  value={rxu ? ui.panelAngle : ui.panelAngle / 1.8}
                  unit={rxu ? '°' : '%'}
                  onChange={(v) => set('panelAngle', rxu ? v : v * 1.8)}
                />
                <Slider
                  id="hermle-panel-yaw"
                  label={L('Korekcia natočenia HMI', 'HMI rotation trim')}
                  min={-180}
                  max={180}
                  step={0.1}
                  digits={1}
                  disabled={ui.hmiLocked}
                  value={ui.panelYaw}
                  unit="°"
                  onChange={(v) => set('panelYaw', v)}
                />
              </fieldset>
              <button type="button" className="btn mb-2" onClick={() => apiRef.current.view?.('panel')}>
                {L('Pohľad na HMI', 'HMI view')}
              </button>
              {ui.manual && (
                <button
                  type="button"
                  className="btn mb-2 ml-2"
                  onClick={() => {
                    if (ctl.current.manual) setHmiOpen(true);
                  }}
                >
                  {L('HMI cez celé okno', 'Full-screen HMI')}
                </button>
              )}

              <Toggle
                on={ui.cabin}
                label={L('Zobraziť kabínu', 'Show the cabin')}
                onClick={() => set('cabin', !ui.cabin)}
              />
            </div>
          </div>

          {rxu && (
            <div className="sec">
              <div className="section-heading">
                <h2 className="sec-title mb-2">
                  {L('Prídavné vybavenie podľa pôdorysu', 'Optional equipment from layout')}
                </h2>
                <SectionInfo title={L('Prídavné vybavenie podľa pôdorysu', 'Optional equipment from layout')}>
                  <p className="text-xs muted mt-2">
                    {L(
                      'Predvolene vypnuté. Pôdorysné rozmery z katalógu; výšky a vnútorné diely sú vizuálny odhad.',
                      'Off by default. Plan dimensions follow the catalogue; heights and internal parts are visual estimates.',
                    )}
                  </p>
                </SectionInfo>
              </div>
              <select
                className="sel"
                aria-label={L('Vybavenie Röders', 'Röders equipment')}
                value={ui.accessorySetup}
                onChange={(e) => set('accessorySetup', e.target.value)}
              >
                <option value="none">{L('Vypnuté', 'Off')}</option>
                <option value="cooling">{L('Chladiaca jednotka 1050 × 750 mm', 'Cooling unit 1050 × 750 mm')}</option>
                <option value="filter">
                  {L('Chladenie + pásový filter 1523 × 1380 mm', 'Cooling + band filter 1523 × 1380 mm')}
                </option>
              </select>
              <button className="btn mt-2" onClick={() => apiRef.current.view?.('vybavenie')}>
                {L('Pohľad na vybavenie', 'Equipment view')}
              </button>
            </div>
          )}
          {!rxu && (
            <>
              <div className="sec">
                <div className="section-heading">
                  <h2 className="sec-title mb-2">{L('Prídavné vybavenie', 'Optional equipment')}</h2>
                  <SectionInfo title={L('Prídavné vybavenie', 'Optional equipment')}>
                    <p className="text-xs muted mt-2">
                      {L(
                        'Prídavné vybavenie je predvolene vypnuté. Zostavy podľa katalógu sa navzájom nahrádzajú; chladiace jednotky sú znázornené vizuálne.',
                        'Optional equipment is off by default. Catalogue configurations replace one another; coolant units are represented visually.',
                      )}
                    </p>
                  </SectionInfo>
                </div>
                <label className="text-sm font-semibold" htmlFor="hermle-accessories">
                  {L('Katalógová zostava', 'Catalogue configuration')}
                </label>
                <select
                  id="hermle-accessories"
                  className="sel mt-2"
                  value={ui.accessorySetup}
                  onChange={(e) => {
                    set('accessorySetup', e.target.value);
                    apiRef.current.view?.('celok');
                  }}
                >
                  <option value="none">{L('Základ – zásuvka na triesky', 'Basic – chip drawer')}</option>
                  <option value="conveyor">{L('Dopravník triesok s vozíkom', 'Chip conveyor with cart')}</option>
                  <option value="ics40">
                    {L('Dopravník + vnútorné chladenie ICS 40', 'Conveyor + internal coolant ICS 40')}
                  </option>
                  <option value="ics80">
                    {L('Dopravník + vnútorné chladenie ICS 80', 'Conveyor + internal coolant ICS 80')}
                  </option>
                  <option value="ics80cooler">
                    {L('Dopravník + ICS 80 + dochladzovacia jednotka', 'Conveyor + ICS 80 + recooling unit')}
                  </option>
                </select>

                <button
                  type="button"
                  className="btn mt-2"
                  onClick={() => apiRef.current.view && apiRef.current.view('vybavenie')}
                >
                  {L('Pohľad na vybavenie', 'Equipment view')}
                </button>
              </div>
            </>
          )}
          <TaskSection
            machine={rxu ? 'roeders' : 'hermle'}
            tasks={tasks}
            apiRef={apiRef}
            params={params}
            status={status}
            onSetup={setupTask}
            safety={{
              ui,
              set,
              runKey: 'running',
              items: CNC_SAFETY(),
              onConfirm: () => {
                if (apiRef.current.start() !== 'ok') set('running', false);
              },
            }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('CNC program', 'CNC program')}</h2>
            <select
              className="sel mb-2"
              value={progId}
              onChange={(e) => pickSample(e.target.value)}
              aria-label={L('Ukážkový program', 'Sample program')}
            >
              {!progId && <option value="">{L('Vlastný / načítaný program', 'Own / loaded program')}</option>}
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                className="btn"
                disabled={!canEditTools}
                onClick={() => fileRef.current && fileRef.current.click()}
              >
                {L('Načítať z PowerMill / CAM…', 'Load from PowerMill / CAM…')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  save(
                    new Blob([text], { type: 'text/plain' }),
                    check.dialect === 'heidenhain' ? 'program.h' : 'program.nc',
                  )
                }
              >
                {L('Uložiť program', 'Save program')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".nc,.ngc,.tap,.cnc,.iso,.gcode,.h,.mpf,.txt,.eia,.ptp"
                style={{ display: 'none' }}
                onChange={onFile}
              />
            </div>
            {programImportError && (
              <p className="msg msg-danger" role="alert">
                {programImportError}
              </p>
            )}
            <div className="cnc-listing" aria-label={L('Aktuálny blok', 'Current block')}>
              {lines.slice(from, from + 9).map((s, i) => (
                <div key={from + i} className={from + i === li ? 'cur' : ''}>
                  <span>{from + i + 1}</span>
                  {s || ' '}
                </div>
              ))}
            </div>
            <label className="sr-only" htmlFor="cnc-edit">
              {L('Editor programu', 'Program editor')}
            </label>
            <textarea
              id="cnc-edit"
              className="cnc-edit mt-2"
              spellCheck={false}
              value={text}
              onChange={(e) => {
                setProgId('');
                setText(e.target.value);
              }}
              rows={10}
            />
            <div className="text-xs mt-2" style={{ lineHeight: 1.5 }}>
              <div>
                {check.dialect === 'heidenhain' ? 'Heidenhain Klartext' : L('ISO / G-kód', 'ISO / G-code')} · {check.n}{' '}
                {L('pohybov', 'moves')} · {L('odhad času', 'estimated time')} <b>{mmss(check.time)}</b>
              </div>
              {check.errors.slice(0, 6).map((e, i) => (
                <div key={`e${i}`} style={{ color: 'var(--danger)' }}>
                  ✗ {L('riadok', 'line')} {e.line + 1}: {e.text}
                </div>
              ))}
              {check.warns.slice(0, 5).map((e, i) => (
                <div key={`w${i}`} style={{ color: 'var(--warn)' }}>
                  ! {L('riadok', 'line')} {e.line + 1}: {e.text}
                </div>
              ))}
              {!check.errors.length && (
                <div style={{ color: 'var(--accent)' }}>✓ {L('Program bez chýb', 'No errors in the program')}</div>
              )}
            </div>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Polotovar a upnutie', 'Blank and clamping')}</h2>
              <SectionInfo title={L('Polotovar a upnutie', 'Blank and clamping')}>
                <p className="text-xs muted">
                  {L(
                    'Upnutie na nulovom systéme Ø70 × 50 mm, nulový bod G54 v strede hornej plochy. Jemnejšia sieť = presnejší povrch, ale pomalší výpočet.',
                    'Clamped on a Ø70 × 50 mm zero-point system, datum G54 at the centre of the top face. A finer mesh = a more accurate surface but slower computation.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label={L('Materiál', 'Material')}
              value={ui.mat}
              options={Object.entries(MATERIALS).map(([k, v]) => [k, v.name().split(' ')[0]])}
              onChange={(v) => set('mat', v)}
            />
            {check.stock ? (
              <p className="text-xs muted mb-2">
                {L('Rozmery z BLK FORM programu', 'Dimensions from the program BLK FORM')}:{' '}
                {check.stock.max[0] - check.stock.min[0]} × {check.stock.max[1] - check.stock.min[1]} ×{' '}
                {check.stock.max[2] - check.stock.min[2]} mm
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  ['sx', 'X'],
                  ['sy', 'Y'],
                  ['sz', 'Z'],
                ].map(([k, l]) => (
                  <label key={k} className="text-xs">
                    {l} mm
                    <input
                      className="sel"
                      type="number"
                      min={10}
                      max={k === 'sz' ? 200 : 300}
                      value={ui[k]}
                      onChange={(e) =>
                        set(k, Math.max(10, Math.min(k === 'sz' ? 200 : 300, Number(e.target.value) || 10)))
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <SegRow
              label={L('Jemnosť siete', 'Mesh resolution')}
              value={ui.res}
              options={[
                [1.0, '1 mm'],
                [0.7, '0,7 mm'],
                [0.5, '0,5 mm'],
              ]}
              onChange={(v) => set('res', v)}
            />
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nástroje', 'Tools')}</h2>
              <SectionInfo title={L('Nástroje', 'Tools')}>
                <p className="text-xs muted">
                  {L(
                    'Rozmery sa upravujú v skrinke. Nový nástroj najprv ulož do skrinky a potom ho vyber pre miesto T v zásobníku.',
                    'Edit dimensions in the cabinet. Save a new tool there first, then choose it for a magazine pocket T.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                className="btn"
                disabled={!canEditTools}
                onClick={() => openToolPicker(freePocket || 1)}
              >
                {L('Vybrať nástroj zo skrinky…', 'Choose a tool from cabinet…')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setLibraryPocket(undefined);
                  setLibraryTab('cabinet');
                }}
              >
                {L('Spravovať skrinku…', 'Manage cabinet…')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <button type="button" className="btn" onClick={() => setLibraryTab('detect')}>
                {L('Detekovať nástroje z NC…', 'Detect tools from NC…')}
              </button>
              <button type="button" className="btn" onClick={() => setLibraryTab('powermill')}>
                PowerMill / CAM
              </button>
            </div>

            <ul className="cnc-installed-tools" aria-label={L('Osadené nástroje', 'Installed tools')}>
              {tools.map((tool) => (
                <li key={tool.t} className={tool.t === tele.T ? 'cur' : ''}>
                  <b className="cnc-pocket">T{tool.t}</b>
                  <CncToolPreview tool={tool} fit />
                  <div>
                    <strong>{tool.name}</strong>
                    <span>
                      Ø{tool.d} · R{tool.cr} · L{tool.l} mm
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={!canEditTools}
                    aria-label={L(`Vybrať nástroj pre T${tool.t}`, `Choose tool for T${tool.t}`)}
                    onClick={() => openToolPicker(tool.t)}
                  >
                    {L('Zmeniť', 'Change')}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Výsledok', 'Result')}</h2>
            <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
              <div>
                {L('Čas obrábania', 'Machining time')}: <b>{mmss(tele.t)}</b> / {L('odhad', 'estimate')}{' '}
                {mmss(check.time)}
              </div>
              <div>
                {L('Odobratý objem', 'Removed volume')}: <b>{fmt(tele.removed, 1)} cm³</b>
              </div>
              <div>
                {L('Najväčšie zaťaženie vretena', 'Peak spindle load')}: <b>{Math.round(tele.maxLoad * 100)} %</b>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const b = apiRef.current.stl && apiRef.current.stl();
                  if (b) save(b, `${model}-obrobok.stl`);
                }}
              >
                {L('Stiahnuť STL obrobku', 'Download part STL')}
              </button>
              <StepDownloadButton machine={model} apiRef={apiRef} />
              <button
                type="button"
                className="btn"
                onClick={() => apiRef.current.snapshot && apiRef.current.snapshot((b) => b && save(b, `${model}.png`))}
              >
                {L('Snímka PNG', 'PNG snapshot')}
              </button>
            </div>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Program z CAM', 'Program from CAM')}</h2>
              <SectionInfo title={L('Program z CAM', 'Program from CAM')}>
                <div className="text-xs" style={{ lineHeight: 1.55 }}>
                  <p>
                    {L(
                      'Simulátor číta výstup postprocesorov CAM (PowerMill, Fusion 360, Mastercam, hyperMILL, SolidCAM, NX …):',
                      'The simulator reads CAM post-processor output (PowerMill, Fusion 360, Mastercam, hyperMILL, SolidCAM, NX …):',
                    )}
                  </p>
                  <ul className="ctl-list" style={{ marginTop: 4 }}>
                    <li>
                      <b>ISO / Fanuc:</b> G0 G1 G2 G3 (I J K / R), G17–G19, G90 / G91, G93 / G94, G43 H, G43.4 (TCP),
                      G49, G68.2 + G53.1, G69, G81 / G82 / G83 / G73, G53, G28, M3 M4 M5 M6 M8 M9 M0 M1 M30, osi A a C.
                    </li>
                    <li>
                      <b>Heidenhain Klartext:</b> BLK FORM, TOOL CALL, L, CC, C, CR, FMAX, M128 / FUNCTION TCPM, PLANE
                      SPATIAL / RESET, CYCL DEF 200, CYCL CALL / M99, M140.
                    </li>
                    <li>
                      {L(
                        'Postprocesor: Fanuc / Heidenhain 5-osí s otočno-sklopným stolom A/C, výstup v mm, dráha stredu nástroja (bez G41/G42), nulový bod v strede hornej plochy polotovaru.',
                        'Post-processor: Fanuc / Heidenhain 5-axis with an A/C trunnion table, output in mm, tool centre path (no G41/G42), datum at the centre of the top face of the blank.',
                      )}
                    </li>
                    <li>
                      {L(
                        'Komentáre nástrojov typu „T3 D=10. CR=0. - flat end mill“ skontroluj cez Detekovať nástroje z NC; doplň chýbajúce rozmery a osaď ich cez knižnicu.',
                        'Review tool comments such as “T3 D=10. CR=0. - flat end mill” in Detect tools from NC; fill in missing dimensions and install them through the library.',
                      )}
                    </li>
                  </ul>
                </div>
              </SectionInfo>
            </div>
          </div>

          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['priestor', L('Pracovný priestor', 'Working area')],
              ['obrobok', L('Obrobok', 'Workpiece')],
              ['nastroj', L('Nástroj', 'Tool')],
              ['zhora', L('Zhora', 'Top')],
              ['zasobnik', L('Zásobník', 'Magazine')],
              ...(!rxu
                ? [
                    ['lavy', L('Ľavý bok', 'Left side')],
                    ['pravy', L('Pravý bok', 'Right side')],
                  ]
                : []),
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

export { CncCore };
