// Sústruh TOS SN: konštanty stroja, diely na prehliadku, úlohy a BOZP (bez three.js scény).
import { L } from '../core/i18n';
import { latheChecks } from './latheMath';
import { mkParts } from '../ui/common';
import { LatheDrawing } from '../ui/sketch';

export const AXIS_Y = 7.5; // výška osi vretena nad podlahou
export const JAW_X = -3.45; // čelo čeľustí = nula osi Z
export const W_X0 = -4.2,
  W_N = 340; // začiatok obrobku v skľučovadle, počet úsekov profilu
export const TIP_LZ = -0.05; // hrot noža voči osi priečnych saní
export const TIP0 = -0.36; // vzťažná poloha hrotu voči suportu pre údaj Z suportu
export const POST = { x: 0.15, y: 6.62, z: 1.0 }; // stred nožovej hlavy na horných saniach
export const LIM = {
  tipMin: -3.35,
  rMax: 1.3,
  quillMax: 1.5,
  tailMax: 9.0,
  carToTail: 1.85,
  quillClear: 0.42,
  topMin: -0.5,
  topMax: 0.5,
};
export const SPEEDS = [40, 56, 80, 112, 160, 224, 315, 450, 630, 900, 1250, 1800]; // 3 × 4 stupne otáčok (SN 50)
// veľkosti TOS SN: S = mierka stroja voči SN 50 (výška hrotov 250 mm), axisH = výška osi vretena nad podlahou (jednotky scény).
// Rozmery obrobku a nožov zostávajú v skutočných mm – menší stroj má kratšie lôžko, nižšie hroty a menšie nože.
// Otáčky a rozmery sú orientačné hodnoty simulátora.
export const LATHE_MODELS = {
  sn32: { name: 'SN 32', S: 0.64, axisH: 6.7, speeds: [56, 80, 112, 160, 224, 315, 450, 630, 900, 1250, 1800, 2500] },
  sn40: { name: 'SN 40', S: 0.8, axisH: 7.1, speeds: [45, 63, 90, 125, 180, 250, 355, 500, 710, 1000, 1400, 2000] },
  sn50: { name: 'SN 50', S: 1, axisH: 7.5, speeds: SPEEDS },
  sn55: { name: 'SN 55', S: 1.1, axisH: 8.0, speeds: [28, 40, 56, 80, 112, 160, 224, 315, 450, 630, 900, 1250] },
};
// samostatné stroje so spoločným simulátorom (vlastná karta v menu, bez voľby veľkosti)
// SV 18 RA (TOS Trenčín): točný priemer nad lôžkom 380 mm, výška hrotov 190 mm, vreteno Ø41, 6 kW; otáčky orientačné
export const LATHE_VARIANTS = {
  sv18: { name: 'SV 18 RA', S: 0.76, axisH: 7.0, speeds: [31.5, 45, 63, 90, 125, 180, 250, 355, 500, 710, 1000, 1400] },
};
export const MODEL_KEY = 'rmt.lathe.model';
export const FEED_BASE = [0.05, 0.07, 0.1, 0.14, 0.2, 0.25, 0.35, 0.5],
  FEED_MULT = [1, 2];
export const A_ANG = [0.75, 0, -0.75],
  B_ANG = [0.95, 0.32, -0.32, -0.95]; // polohy pák otáčok
export const LATHE_FEEDS = [
  ...new Set(FEED_MULT.flatMap((m) => FEED_BASE.map((b) => Math.round(b * m * 100) / 100))),
].sort((a, b) => a - b); // všetky posuvy prevodovky
export const FEED_ANG = FEED_BASE.map((_, i) => 1.4 - (i * 2.8) / 7),
  MULT_ANG = [0.5, -0.5];

// sústružnícke nože (pravé prevedenie): obrys v pôdoryse (x doprava, z k obsluhe, hrot v 0,0),
// rozsah drieku a tvar reznej časti – prof(d) = výška ostria nad hrotom vo vzdialenosti d od hrotu v osi Z
export const LT_R = 0.05;
export const LATHE_TOOLS = {
  rough: {
    sk: 'Ubierací nôž priamy',
    en: 'Straight turning tool',
    sh: [0, 0.25],
    pts: [
      [0, 0],
      [0.24, 0.06],
      [0.25, 0.36],
      [0, 0.36],
    ],
    prof: (d) => (d >= -0.005 && d <= 0.32 ? Math.max(0, d) * 0.25 : Infinity),
  },
  corner: {
    sk: 'Rohový nôž',
    en: 'Corner tool',
    sh: [0, 0.25],
    pts: [
      [0, 0],
      [0.25, 0.02],
      [0.25, 0.36],
      [0, 0.36],
    ],
    prof: (d) => (d >= -0.005 && d <= 0.3 ? Math.max(0, d) * 0.08 : Infinity),
  },
  bent: {
    sk: 'Ubierací nôž ohnutý',
    en: 'Bent turning tool',
    sh: [0, 0.25],
    pts: [
      [0, 0],
      [0.25, 0.08],
      [0.25, 0.42],
      [0, 0.42],
      [-0.13, 0.13],
    ],
    prof: (d) => (d >= -0.13 && d < 0 ? -d : d >= 0 && d <= 0.3 ? d * 0.32 : Infinity),
  },
  finish: {
    sk: 'Hladiaci nôž',
    en: 'Finishing tool',
    sh: [-0.125, 0.125],
    pts: [
      [-0.035, 0],
      [0.035, 0],
      [0.125, 0.08],
      [0.125, 0.36],
      [-0.125, 0.36],
      [-0.125, 0.08],
    ],
    prof: (d) => (Math.abs(d) <= 0.035 ? 0 : Math.abs(d) <= 0.15 ? (Math.abs(d) - 0.035) * 0.7 : Infinity),
  },
  plunge: {
    sk: 'Nabierací nôž',
    en: 'Broad plunge tool',
    sh: [-0.075, 0.175],
    pts: [
      [0, 0],
      [0.1, 0],
      [0.1, 0.3],
      [0.175, 0.42],
      [0.175, 0.5],
      [-0.075, 0.5],
      [-0.075, 0.42],
      [0, 0.3],
    ],
    prof: (d) => (d >= -0.005 && d <= 0.105 ? 0 : Infinity),
  },
  radius: {
    sk: 'Rádiusový nôž',
    en: 'Radius tool',
    sh: [-0.125, 0.125],
    pts: [
      ...Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + (i * Math.PI) / 12;
        return [LT_R * Math.cos(a), LT_R + LT_R * Math.sin(a)];
      }),
      [0.05, 0.2],
      [0.125, 0.3],
      [0.125, 0.36],
      [-0.125, 0.36],
      [-0.125, 0.3],
      [-0.05, 0.2],
    ],
    prof: (d) => (Math.abs(d) <= LT_R ? LT_R - Math.sqrt(LT_R * LT_R - d * d) : Infinity),
  },
  side: {
    sk: 'Ubierací nôž stranový',
    en: 'Side (facing) tool',
    sh: [0.01, 0.26],
    pts: [
      [0, 0],
      [0.26, 0.015],
      [0.26, 0.36],
      [0.04, 0.36],
      [0, 0.1],
    ],
    prof: (d) => (d >= -0.005 && d <= 0.3 ? Math.max(0, d) * 0.05 : Infinity),
  },
  parting: {
    sk: 'Zapichovací nôž',
    en: 'Grooving / parting tool',
    sh: [-0.05, 0.2],
    pts: [
      [0, 0],
      [0.03, 0],
      [0.03, 0.56],
      [0.2, 0.64],
      [0.2, 0.72],
      [-0.05, 0.72],
      [-0.05, 0.64],
      [0, 0.56],
    ],
    prof: (d) => (d >= -0.005 && d <= 0.035 ? 0 : Infinity),
  },
  // závitový nôž 60°: súmerný hrot, boky pod 30° od kolmice na os – reže drážku tvaru V
  thread: {
    sk: 'Závitový nôž 60°',
    en: 'Thread-cutting tool 60°',
    sh: [-0.1, 0.1],
    sym: true,
    pts: [
      [0, 0],
      [0.1, 0.1732],
      [0.1, 0.36],
      [-0.1, 0.36],
      [-0.1, 0.1732],
    ],
    prof: (d) => (Math.abs(d) <= 0.1 ? Math.abs(d) * 1.732 : Infinity),
  },
};
export const toolName = (s) =>
  LATHE_TOOLS[s.type].sym
    ? L(LATHE_TOOLS[s.type].sk, LATHE_TOOLS[s.type].en)
    : `${L(LATHE_TOOLS[s.type].sk, LATHE_TOOLS[s.type].en)} ${s.hand === 'L' ? L('ľavý', 'left') : L('pravý', 'right')}`;
export const LATHE_MATS = { brass: [0xe0ba5e, 0.3, 0.85], steel: [0xb7bec5, 0.34, 0.85], alu: [0xd9dde0, 0.3, 0.7] };

export const latheParts = () =>
  mkParts([
    [
      'lozko',
      'Lôžko',
      'Bed',
      'Lôžko',
      'Bed',
      'Masívny liatinový základ stroja. Kalené a brúsené vodiace plochy (prizmatická „V“ a plochá) vedú suport aj koník presne rovnobežne s osou vretena.',
      'Massive cast-iron base of the machine. Hardened and ground ways (a prismatic “V” and a flat way) guide the carriage and the tailstock exactly parallel to the spindle axis.',
    ],
    [
      'vretennik',
      'Vretenník',
      'Headstock',
      'Vretenník',
      'Headstock',
      'Skriňa s hlavným vretenom v presných ložiskách a s prevodovkou otáčok. Pákami sa volia otáčky, hlavným vypínačom sa zapína pohon. Na vretene je upínač obrobku.',
      'Housing with the main spindle in precision bearings and the speed gearbox. Levers select the speed, the main switch powers the drive. The work-holding chuck sits on the spindle.',
    ],
    [
      'sklucovadlo',
      'Skľučovadlo',
      'Chuck',
      'Trojčeľusťové skľučovadlo',
      'Three-jaw chuck',
      'Samostrediace skľučovadlo. Kľúčom sa cez špirálu posúvajú všetky tri čeľuste naraz, takže valcový obrobok je upnutý súosovo s vretenom.',
      'Self-centring chuck. The key turns a scroll that moves all three jaws at once, so a round workpiece is clamped coaxially with the spindle.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Obrobok',
      'Workpiece',
      'Tyč zvoleného priemeru, tvaru a materiálu. Keď sa vreteno točí, nôž odoberá materiál podľa svojho tvaru. Pri stojacom vretene nôž do obrobku nevnikne.',
      'Bar of the selected diameter, shape and material. While the spindle turns, the tool removes material according to its shape. With the spindle stopped the tool cannot enter the workpiece.',
    ],
    [
      'suport',
      'Suport',
      'Carriage',
      'Suport – pozdĺžne sane a zámková skriňa',
      'Carriage and apron',
      'Pozdĺžne sane jazdia po lôžku (os Z). Zámková skriňa vpredu má ručné koleso s pastorkom na ozubenom hrebeni, páku matice vodiacej skrutky a zapínanie automatického posuvu.',
      'The saddle travels along the bed (Z axis). The apron at the front carries the handwheel with a pinion on the rack, the half-nut lever and the automatic feed engagement.',
    ],
    [
      'priecny',
      'Nožová hlava',
      'Tool post',
      'Priečne sane, horné sane a nožová hlava',
      'Cross slide, top slide and tool post',
      'Priečne sane sa posúvajú kolmo na os vretena (os X). Nesú horné sane s mikroposuvom v osi Z a štvorpolohovú nožovú hlavu so štyrmi nožmi, ktorá sa po uvoľnení páky pootočí na ďalší nôž.',
      'The cross slide moves perpendicular to the spindle axis (X axis). It carries the top slide with fine Z feed and the four-way tool post holding four tools, which indexes to the next tool after its lever is released.',
    ],
    [
      'konik',
      'Koník',
      'Tailstock',
      'Koník',
      'Tailstock',
      'Posúva sa po lôžku po uvoľnení páky zaistenia. Ručným kolesom sa vysúva pinola s otočným hrotom, ktorý podopiera dlhé obrobky; pinola sa aretuje pákou hore.',
      'Slides along the bed once its clamp lever is released. The handwheel extends the quill with a live centre that supports long workpieces; the quill is locked by the lever on top.',
    ],
    [
      'skrutky',
      'Skrutka a ťažná tyč',
      'Leadscrew & feed rod',
      'Vodiaca skrutka a ťažná tyč',
      'Leadscrew and feed rod',
      'Vodiaca skrutka (so závitom) poháňa suport pri rezaní závitov cez maticu. Ťažná tyč (s drážkou) prenáša pohyb pre bežné pozdĺžne a priečne posuvy.',
      'The leadscrew drives the carriage through the half-nut when cutting threads. The feed rod (with a keyway) transmits motion for ordinary longitudinal and cross feeds.',
    ],
    [
      'prevodovka',
      'Prevodovka posuvov',
      'Feed gearbox',
      'Prevodovka posuvov (Norton)',
      'Feed gearbox (Norton)',
      'Volí sa ňou veľkosť posuvu v mm/ot a stúpanie závitu. Pohon dostáva od vretena cez výmenné kolesá pod ľavým krytom.',
      'Selects the feed in mm/rev and the thread pitch. It is driven from the spindle through change gears under the left cover.',
    ],
    [
      'kryt',
      'Kryt skľučovadla',
      'Chuck guard',
      'Ochranný kryt skľučovadla',
      'Chuck guard',
      'Obyčajný odklápací plechový kryt nad skľučovadlom. Mikrospínač na pánte nedovolí spustiť vreteno, kým je kryt otvorený, a pri otvorení za chodu vreteno zastaví.',
      'A plain hinged sheet-metal cover over the chuck. A microswitch on the hinge prevents the spindle from starting while the cover is open and stops it if the cover is opened while running.',
    ],
    [
      'chladenie',
      'Chladenie',
      'Coolant',
      'Chladiaci systém',
      'Coolant system',
      'Čerpadlo v nádrži pravého podstavca vedie reznú kvapalinu ohybnou článkovou hadicou (Loc-Line) priamo na nôž. Kvapalina chladí, maže a odplavuje triesky, steká do vane a späť do nádrže.',
      'A pump in the tank of the right stand feeds cutting fluid through a flexible segmented hose (Loc-Line) straight onto the tool. The fluid cools, lubricates and flushes the chips, then drains into the tray and back to the tank.',
    ],
    [
      'zadnykryt',
      'Zadný kryt',
      'Splash guard',
      'Zadný ochranný kryt',
      'Splash and chip guard',
      'Plechový štít po celej dĺžke za strojom zachytáva odlietavajúce triesky a emulziu, aby nezasiahli okolie.',
      'A sheet-metal shield along the whole back of the machine catches flying chips and coolant so that they do not reach the surroundings.',
    ],
    [
      'luneta',
      'Pevná luneta',
      'Steady rest',
      'Pevná luneta',
      'Steady rest',
      'Prstenec upnutý na lôžku s tromi nastaviteľnými čeľusťami s kladkami podopiera dlhý hriadeľ. Suport ani koník cez ňu neprejdú.',
      'A ring clamped to the bed with three adjustable roller jaws supports a long shaft. Neither the carriage nor the tailstock can pass it.',
    ],
    [
      'luneta2',
      'Pohyblivá luneta',
      'Follow rest',
      'Pohyblivá luneta',
      'Follow rest',
      'Je upnutá na suporte a jej dve čeľuste podopierajú obrobok tesne pri noži – pri sústružení dlhých tenkých hriadeľov bráni prehýbaniu a chveniu.',
      'Mounted on the carriage, its two jaws support the work right next to the tool – when turning long slender shafts it prevents bending and chatter.',
    ],
    [
      'krytskrutky',
      'Kryt skrutiek',
      'Screw guard',
      'Kryt vodiacej skrutky a ťažnej tyče',
      'Leadscrew and feed-rod guard',
      'Teleskopický kryt zakrýva rotujúce tyče, aby sa na ne nenavinul odev alebo handra.',
      'A telescopic cover over the rotating rods so that clothing or a rag cannot wind onto them.',
    ],
    [
      'brzda',
      'Nožná brzda',
      'Foot brake',
      'Nožná brzda',
      'Foot brake',
      'Pedál po celej dĺžke stroja – šliapnutím sa vreteno okamžite zabrzdí a vypne, obsluha má ruky voľné.',
      'A pedal along the whole machine – stepping on it brakes and switches off the spindle at once, with the hands free.',
    ],
    [
      'podstavec',
      'Podstavec',
      'Stands',
      'Podstavce a vaňa na triesky',
      'Stands and chip tray',
      'Podstavce nesú lôžko, v ľavom je hlavný elektromotor a rozvádzač. Vaňa medzi nimi zachytáva triesky a chladiacu kvapalinu.',
      'The stands carry the bed; the left one houses the main motor and the electrical cabinet. The tray between them catches chips and coolant.',
    ],
  ]);

// výkres: obrys obrobku zboku s kótami (rozmery v mm, sk / en popisy)
export const LATHE_TASKS = [
  {
    id: 'celo',
    title: () => L('Zarovnanie čela na dĺžku 100 mm', 'Facing to a length of 100 mm'),
    desc: () =>
      L(
        'Hliníková tyč Ø50 vyložená 110 mm. Zarovnaj čelo tak, aby obrobok meral od čeľustí 100 ± 0,3 mm. Použi ubierací nôž stranový alebo ohnutý, priečny posuv k osi.',
        'Aluminium bar Ø50 with 110 mm stick-out. Face the end so that the part measures 100 ± 0.3 mm from the jaws. Use the side or bent tool with the cross feed towards the axis.',
      ),
    setup: { bShape: 'round', bD: 50, bLen: 110, bMat: 'alu', slot: 0, tool: { type: 'side', hand: 'R' } },
    drawing: () => (
      <LatheDrawing
        parts={[[100, 50]]}
        dims={[
          { d: 50, text: 'Ø50' },
          { h: [0, 100], text: L('100 ±0,3', '100 ±0.3') },
        ]}
        label="Ø50 × 100"
      />
    ),
    labels: { len: () => L('Dĺžka od čeľustí 100 ±0,3 mm', 'Length from the jaws 100 ±0.3 mm') },
  },
  {
    id: 'osadenie',
    title: () => L('Osadenie Ø40 × 50 mm', 'Shoulder Ø40 × 50 mm'),
    desc: () =>
      L(
        'Mosadzná tyč Ø60 vyložená 150 mm. Vysústruž na voľnom konci osadenie Ø40 ±0,1 mm dĺžky 50 ±0,5 mm. Zvyšok tyče zostáva Ø60. Hrubuj ubieracím nožom, načisto hladiacim.',
        'Brass bar Ø60 with 150 mm stick-out. Turn a Ø40 ±0.1 mm shoulder 50 ±0.5 mm long at the free end. The rest stays Ø60. Rough with the turning tool, finish with the finishing tool.',
      ),
    setup: { bShape: 'round', bD: 60, bLen: 150, bMat: 'brass', slot: 0, tool: { type: 'rough', hand: 'R' } },
    drawing: () => (
      <LatheDrawing
        parts={[
          [100, 60],
          [50, 40],
        ]}
        dims={[
          { d: 50, text: 'Ø60' },
          { lead: 125, text: L('Ø40 ±0,1', 'Ø40 ±0.1') },
          { h: [100, 150], text: L('50 ±0,5', '50 ±0.5') },
        ]}
        label="Ø60 / Ø40 × 50"
      />
    ),
    labels: {
      d: () => L('Priemer osadenia Ø40 ±0,1 mm', 'Shoulder diameter Ø40 ±0.1 mm'),
      len: () => L('Dĺžka osadenia 50 ±0,5 mm', 'Shoulder length 50 ±0.5 mm'),
      rest: () => L('Zvyšok tyče Ø60 nedotknutý', 'Rest of the bar Ø60 untouched'),
    },
  },
  {
    id: 'zapich',
    title: () => L('Zápich 6 mm na Ø40', 'Groove 6 mm to Ø40'),
    desc: () =>
      L(
        'Oceľová tyč Ø50 vyložená 120 mm. Zapichovacím nožom (šírka 3 mm) urob dvoma zápichmi drážku širokú 6 ±0,4 mm s dnom Ø40 ±0,1 mm. Bližší okraj drážky je 30 ±0,5 mm od voľného konca.',
        'Steel bar Ø50 with 120 mm stick-out. With the 3 mm parting tool make a 6 ±0.4 mm wide groove in two plunges, bottom Ø40 ±0.1 mm. The nearer edge of the groove is 30 ±0.5 mm from the free end.',
      ),
    setup: { bShape: 'round', bD: 50, bLen: 120, bMat: 'steel', slot: 2, tool: { type: 'parting', hand: 'R' } },
    drawing: () => (
      <LatheDrawing
        parts={[
          [84, 50],
          [6, 40],
          [30, 50],
        ]}
        dims={[
          { d: 40, text: 'Ø50' },
          { lead: 87, text: L('Ø40 ±0,1', 'Ø40 ±0.1') },
          { h: [84, 90], text: L('6 ±0,4', '6 ±0.4'), side: 'l' },
          { h: [90, 120], text: L('30 ±0,5', '30 ±0.5'), row: 1 },
        ]}
        label={L('zápich', 'groove')}
      />
    ),
    labels: {
      pos: () => L('Poloha drážky 30 ±0,5 mm od konca', 'Groove position 30 ±0.5 mm from the end'),
      width: () => L('Šírka drážky 6 ±0,4 mm', 'Groove width 6 ±0.4 mm'),
      d: () => L('Dno drážky Ø40 ±0,1 mm', 'Groove bottom Ø40 ±0.1 mm'),
    },
  },
  {
    id: 'zavit',
    title: () => L('Závit M30 × 1,5', 'Thread M30 × 1.5'),
    desc: () =>
      L(
        'Oceľová tyč Ø30 vyložená 150 mm. Nareži vonkajší závit M30 × 1,5 dĺžky aspoň 30 mm od voľného konca. Závitový nôž v polohe 4, stúpanie 1,5 mm, nízke otáčky. Zapni maticu vodiacej skrutky, po prechode vysuň nôž (X), vypni maticu, vráť suport a pridaj prísuv. Hĺbka závitu h3 = 0,6134 · P ≈ 0,92 mm.',
        'Steel bar Ø30 with 150 mm stick-out. Cut an external M30 × 1.5 thread at least 30 mm long from the free end. Thread tool in position 4, pitch 1.5 mm, low speed. Engage the half-nut, after the pass retract the tool (X), disengage, return the carriage and add infeed. Thread depth h3 = 0.6134 · P ≈ 0.92 mm.',
      ),
    setup: {
      bShape: 'round',
      bD: 30,
      bLen: 150,
      bMat: 'steel',
      slot: 3,
      tool: { type: 'thread', hand: 'R' },
      pitch: 1.5,
      rpm: 56,
    },
    drawing: () => (
      <LatheDrawing
        parts={[
          [120, 30],
          [30, 30, true],
        ]}
        dims={[
          { lead: 135, text: L('M30 × 1,5', 'M30 × 1.5') },
          { h: [120, 150], text: '≥ 30' },
        ]}
        label="M30×1,5"
      />
    ),
    labels: {
      pitch: () => L('Stúpanie 1,5 mm (jedno nastavenie)', 'Pitch 1.5 mm (one setting)'),
      depth: () => L('Hĺbka závitu 0,87 – 0,98 mm', 'Thread depth 0.87 – 0.98 mm'),
      len: () => L('Dĺžka závitu ≥ 30 mm až po koniec', 'Thread length ≥ 30 mm up to the end'),
      crest: () => L('Vonkajší priemer Ø30 ±0,1 mm', 'Major diameter Ø30 ±0.1 mm'),
    },
  },
].map((t) => ({ ...t, checks: (m) => latheChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

export const LATHE_SAFETY = () => [
  L('Kľúč je vybratý zo skľučovadla.', 'The chuck key is removed.'),
  L(
    'Obrobok je pevne upnutý, nôž je zaistený v nožovej hlave.',
    'The workpiece is clamped firmly, the tool is secured in the tool post.',
  ),
  L(
    'Mám ochranné okuliare a priliehavý odev, bez rukavíc a šperkov.',
    'I wear safety glasses and close-fitting clothes, no gloves or jewellery.',
  ),
  L('V pracovnom priestore nie je náradie ani meradlá.', 'No tools or gauges are left in the working area.'),
  L(
    'Kryt skľučovadla je zatvorený, kryt skrutiek je na mieste a viem, kde je nožná brzda.',
    'The chuck guard is closed, the screw guard is in place and I know where the foot brake is.',
  ),
];
