// Frézka: konštanty stroja, diely na prehliadku, úlohy a BOZP (bez three.js scény).
import { L } from '../core/i18n';
import { fanAngles } from '../core/util';
import { indexChecks } from './millIndex';
import { millChecks } from '../core/hfMath';
import { mkParts } from '../ui/common';
import { MillDrawing } from '../ui/sketch';
import { PolyDrawing } from '../ui/sketch';

export const MILL = {
  SPX: 0,
  SPZ: 1.2,
  NOSE: 10.4, // os vretena a čelo vretena
  X0: -4,
  Y0: 0,
  H0: 4.2, // nulové polohy: posun stola, stred saní, výška stola
  CELL: 1.2,
  MAXV: 40000, // bunka výškovej mapy v mm, najviac vrcholov siete
};
export const MILL_SPEEDS = [40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000]; // 3 × 6
export const MILL_FEEDS = [19, 24, 30, 37.5, 47.5, 60, 75, 95, 118, 150, 190, 235, 300, 375, 475, 600, 750, 950]; // 3 × 6, mm/min
// knižnica fréz v normalizovaných priemeroch; len = vyloženie od čela vretena
export const MILL_TOOL_LIST = [
  ...[6, 8, 10, 12, 16, 20, 25].map((d) => ({ id: `end${d}`, kind: 'end', d })),
  ...[6, 10, 16].map((d) => ({ id: `ball${d}`, kind: 'ball', d })),
  ...[50, 63, 80, 100].map((d) => ({ id: `face${d}`, kind: 'face', d })),
];
export const MILL_TOOLS = Object.fromEntries(
  MILL_TOOL_LIST.map((t) => [t.id, { ...t, r: t.d / 200, len: t.kind === 'face' ? 1.15 : t.d <= 12 ? 1.3 : 1.5 }]),
);
export const millToolName = (t) =>
  `${t.kind === 'end' ? L('Stopková fréza', 'End mill') : t.kind === 'ball' ? L('Guľová fréza', 'Ball-nose mill') : L('Čelná fréza', 'Face mill')} Ø${t.d}`;
export const S3_ANG = [0.75, 0, -0.75],
  S6_ANG = fanAngles(6, 1.15),
  DIR_ANG = [0.55, 0, -0.55];

export const millParts = () =>
  mkParts([
    [
      'podstavec',
      'Podstavec',
      'Base',
      'Podstavec',
      'Base',
      'Liatinový podstavec nesie stojan a konzolu. V jeho dutine je nádrž chladiacej kvapaliny s čerpadlom a pod konzolou zdvíhacia skrutka.',
      'The cast-iron base carries the column and the knee. Its cavity holds the coolant tank with the pump, and the elevating screw sits under the knee.',
    ],
    [
      'stojan',
      'Stojan',
      'Column',
      'Stojan',
      'Column',
      'Skriňový stojan s prevodovkou otáčok vretena. Na prednej strane má rybinové vedenie, po ktorom sa zvisle posúva konzola. Páky otáčok sú na pravom boku, lampa na ľavom.',
      'Box column with the spindle speed gearbox. The front dovetail guides the knee vertically. The speed levers are on the right side, the lamp on the left.',
    ],
    [
      'hlava',
      'Vertikálna hlava',
      'Vertical head',
      'Sklopná vertikálna hlava',
      'Swivelling vertical head',
      'Frézovacia hlava s vretenom, ktorá sa dá natočiť okolo vodorovnej osi o ±45°. V modeli je nastavená zvisle. Ručné koliesko na boku vysúva pinolu.',
      'Milling head with the spindle that can swivel ±45° about a horizontal axis. In the model it is set vertical. The small handwheel on the side moves the quill.',
    ],
    [
      'vreteno',
      'Vreteno a fréza',
      'Spindle & cutter',
      'Vreteno a nástroj',
      'Spindle and tool',
      'Vreteno s kužeľom ISO 40 nesie frézu v klieštinovom upínači alebo na tŕni: stopkové frézy Ø6 – Ø25, guľové Ø6 – Ø16 a čelné frézy Ø50 – Ø100 s vymeniteľnými doštičkami.',
      'The ISO 40 spindle holds the cutter in a collet chuck or on an arbor: end mills Ø6 – Ø25, ball-nose mills Ø6 – Ø16 and face mills Ø50 – Ø100 with indexable inserts.',
    ],
    [
      'konzola',
      'Konzola',
      'Knee',
      'Konzola',
      'Knee',
      'Posúva sa po stojane zvisle (os Z) kľukou cez skrutku a kužeľové kolesá. Vpredu má ručné koleso priečneho posuvu, kľuku zdvihu a páky prevodovky posuvov.',
      'Moves vertically on the column (Z axis) by the crank through a screw and bevel gears. At the front it has the cross feed handwheel, the elevating crank and the feed gearbox levers.',
    ],
    [
      'sane',
      'Priečne sane',
      'Saddle',
      'Priečne sane',
      'Saddle',
      'Sane jazdia po konzole k stojanu a od neho (os Y). Nesú pracovný stôl a páku automatického posuvu stola.',
      'The saddle travels on the knee towards and away from the column (Y axis). It carries the table and the table feed lever.',
    ],
    [
      'stol',
      'Pracovný stôl',
      'Table',
      'Pracovný stôl',
      'Work table',
      'Stôl 1300 × 300 mm s tromi T-drážkami sa posúva pozdĺžne (os X) ručnými kolesami na koncoch alebo automatickým posuvom. Červené narážky vpredu obmedzujú posuv.',
      'The 1300 × 300 mm table with three T-slots moves longitudinally (X axis) by the handwheels at its ends or by the power feed. The red dogs at the front limit the travel.',
    ],
    [
      'zverak',
      'Zverák',
      'Vise',
      'Strojný zverák',
      'Machine vise',
      'Zverák upnutý v T-drážkach drží obrobok medzi pevnou a posuvnou čeľusťou na rovnobežných podložkách. Fréza nesmie zasiahnuť čeľuste ani podložky.',
      'The vise bolted in the T-slots holds the workpiece between the fixed and the moving jaw on parallels. The cutter must not touch the jaws or the parallels.',
    ],
    [
      'deliaci',
      'Deliaci prístroj',
      'Dividing head',
      'Deliaci prístroj so skľučovadlom',
      'Dividing head with chuck',
      'Vreteno so skľučovadlom poháňa závitovka s pomerom 40 : 1. Kľuka s kolíkom zapadá do dier deliaceho kotúča: jeden dielik je n = 40 / z otáčok kľuky. Pri frézovaní sa vreteno zaistí aretáciou.',
      'The spindle with the chuck is driven by a 40 : 1 worm. The crank pin engages the holes of the index plate: one division is n = 40 / z turns of the crank. The spindle is locked while milling.',
    ],
    [
      'konik',
      'Koník',
      'Tailstock',
      'Koník s hrotom',
      'Tailstock with centre',
      'Podopiera dlhú tyč na voľnom konci. Pri krátkom presahu sa odsunie, aby fréza mohla obrábať koniec tyče.',
      'Supports a long bar at its free end. With a short overhang it is moved away so the cutter can machine the bar end.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Obrobok',
      'Workpiece',
      'Oceľový hranol alebo kruhová tyč zvoleného rozmeru s tmavou okujenou povrchou. Pri bežiacom vretene fréza odoberá materiál a obrobená plocha je lesklá. Pri stojacom vretene do neho fréza nevnikne.',
      'Steel block or round bar of the selected size with a dark mill-scale surface. With the spindle running the cutter removes material and the machined surface is bright. With the spindle stopped the cutter cannot enter it.',
    ],
    [
      'rozvadzac',
      'Rozvádzač',
      'Control cabinet',
      'Elektrický rozvádzač',
      'Electrical cabinet',
      'Na pravom boku stojana: ampérmeter, hlavný vypínač, tlačidlá Štart, Stop a chladenie a núdzový STOP. Pod ním sú páky otáčok vretena.',
      'On the right side of the column: ammeter, main switch, Start, Stop and coolant buttons and the emergency stop. The spindle speed levers are below it.',
    ],
  ]);

// pôdorys obrobku s drážkou alebo zarovnanou plochou (rozmery v mm)
export const MILL_TASKS = [
  {
    id: 'drazka',
    title: () => L('Drážka 20 × 5 mm cez celú dĺžku', 'Slot 20 × 5 mm along the whole length'),
    desc: () =>
      L(
        'Hranol 180 × 100 × 60 mm. Stopkovou frézou Ø20 vyfrézuj v strede šírky pozdĺžnu drážku hĺbky 5 ±0,15 mm cez celú dĺžku. Hĺbku nastav konzolou (Z) od dotyku, drážku veď posuvom stola X. Šírka sa meria s presnosťou siete (~1,2 mm).',
        'Block 180 × 100 × 60 mm. With a Ø20 end mill cut a longitudinal slot 5 ±0.15 mm deep along the whole length, centred in the width. Set the depth with the knee (Z) from the touch-off, feed the table along X. The width is measured to the grid resolution (~1.2 mm).',
      ),
    setup: { bShape: 'block', bL: 180, bW: 100, bH: 60, tool: 'end20', rpm: 315 },
    drawing: () => <MillDrawing slot />,
    labels: {
      depth: () => L('Hĺbka drážky 5 ±0,15 mm', 'Slot depth 5 ±0.15 mm'),
      width: () => L('Šírka drážky 20 mm', 'Slot width 20 mm'),
      len: () => L('Drážka cez celú dĺžku (≥ 95 %)', 'Slot along the whole length (≥ 95 %)'),
      center: () => L('Drážka v strede šírky', 'Slot centred in the width'),
    },
  },
  {
    id: 'rovina',
    title: () => L('Zarovnanie hornej plochy o 2 mm', 'Facing the top by 2 mm'),
    desc: () =>
      L(
        'Hranol 180 × 100 × 60 mm. Čelnou frézou Ø100 zarovnaj celú hornú plochu o 2 ±0,1 mm. Najprv sa dotkni plochy, potom zdvihni konzolu o 2 mm a prejdi stolom cez celú dĺžku.',
        'Block 180 × 100 × 60 mm. With the Ø100 face mill take 2 ±0.1 mm off the whole top surface. Touch off first, then raise the knee by 2 mm and traverse the table along the whole length.',
      ),
    setup: { bShape: 'block', bL: 180, bW: 100, bH: 60, tool: 'face100', rpm: 80 },
    drawing: () => <MillDrawing />,
    labels: {
      share: () => L('Plocha znížená o 2 ±0,1 mm (≥ 95 %)', 'Surface lowered by 2 ±0.1 mm (≥ 95 %)'),
      max: () => L('Nikde hlbšie ako 2,1 mm', 'Nowhere deeper than 2.1 mm'),
    },
  },
  {
    id: 'sesthran',
    title: () => L('Šesťhran s = 36 mm v deliacom prístroji', 'Hexagon s = 36 mm on the dividing head'),
    desc: () =>
      L(
        'Tyč Ø45 × 120 mm v skľučovadle deliaceho prístroja, koník odsunutý. Čelnou frézou Ø100 vyfrézuj na voľnom konci na dĺžke aspoň 40 mm šesťhran s rozmerom cez plochy 36 ±0,15 mm. Stenu frézuj priečnym posuvom (Y) s čelom frézy 18 mm nad osou tyče, potom pootoč o dielik: n = 40 / 6 = 6 2/3 otáčky kľuky (6 otáčok + 12 dier na kruhu 18).',
        'Ø45 × 120 mm bar in the dividing-head chuck, tailstock moved away. With the Ø100 face mill cut a hexagon 36 ±0.15 mm across flats on the free end over at least 40 mm. Mill each face with the cross feed (Y), cutter face 18 mm above the bar axis, then index one division: n = 40 / 6 = 6 2/3 crank turns (6 turns + 12 holes on the 18-hole circle).',
      ),
    setup: { hold: 'div', bShape: 'round', bL: 120, bD: 45, tail: false, divZ: 6, tool: 'face100', rpm: 80 },
    div: true,
    drawing: () => <PolyDrawing n={6} s={36} />,
    labels: {
      size: () => L('Rozmer cez plochy 36 ±0,15 mm', 'Across flats 36 ±0.15 mm'),
      flat: () => L('Rovinné steny (do 0,2 mm)', 'Flat faces (within 0.2 mm)'),
      len: () => L('Dĺžka šesťhranu aspoň 40 mm', 'Hexagon length at least 40 mm'),
    },
  },
  {
    id: 'stvorhran',
    title: () => L('Štvorhran 30 × 30 mm v deliacom prístroji', 'Square 30 × 30 mm on the dividing head'),
    desc: () =>
      L(
        'Tyč Ø45 × 120 mm, koník odsunutý. Na voľnom konci vyfrézuj na dĺžke aspoň 40 mm štvorhran 30 ±0,15 mm. Delenie: n = 40 / 4 = 10 otáčok kľuky.',
        'Ø45 × 120 mm bar, tailstock moved away. Mill a 30 ±0.15 mm square on the free end over at least 40 mm. Indexing: n = 40 / 4 = 10 crank turns.',
      ),
    setup: { hold: 'div', bShape: 'round', bL: 120, bD: 45, tail: false, divZ: 4, tool: 'face100', rpm: 80 },
    div: true,
    drawing: () => <PolyDrawing n={4} s={30} />,
    labels: {
      size: () => L('Rozmer cez plochy 30 ±0,15 mm', 'Across flats 30 ±0.15 mm'),
      flat: () => L('Rovinné steny (do 0,2 mm)', 'Flat faces (within 0.2 mm)'),
      len: () => L('Dĺžka štvorhranu aspoň 40 mm', 'Square length at least 40 mm'),
    },
  },
].map((t) => ({
  ...t,
  checks: (m) => (t.div ? indexChecks : millChecks)[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })),
}));
export const MILL_SAFETY = () => [
  L(
    'Obrobok je pevne upnutý vo zveráku, kľúč od zveráka je odložený.',
    'The workpiece is clamped firmly in the vise, the vise handle is put away.',
  ),
  L('Fréza je upnutá v klieštine a dotiahnutá.', 'The cutter is clamped in the collet and tightened.'),
  L(
    'Mám ochranné okuliare, bez rukavíc; triesky neodstraňujem rukou.',
    'I wear safety glasses, no gloves; I do not remove chips by hand.',
  ),
  L('Aretácie osí, ktoré sa nemajú hýbať, sú zaistené.', 'The axes that must not move are clamped.'),
];
