// Scenáre sprievodcu „krok za krokom“ (ui/guide.jsx). Podmienky done čítajú stav panela (ui) a telemetriu (tele);
// start = stav pri začiatku kroku (napr. o koľko sa posunul suport). Popisy param/button sa musia zhodovať
// s popismi ovládačov v paneli daného stroja.
import { L } from '../core/i18n';

const s = (title, text, extra = {}) => ({ title, text, ...extra });

export const LATHE_GUIDE = () => [
  s(
    L('Prehľad sústruhu', 'Lathe overview'),
    L(
      'Obrobok je upnutý v skľučovadle na vretene. Nôž je v nožovej hlave na suporte – pozdĺžne sa pohybuje po lôžku (Z), priečne mení priemer (X).',
      'The workpiece is held in the chuck on the spindle. The tool sits in the tool post on the carriage – it moves along the bed (Z) and across to change the diameter (X).',
    ),
    { part: 'sklucovadlo' },
  ),
  s(
    L('Otáčky vretena', 'Spindle speed'),
    L(
      'Otáčky volíš pákami prevodovky. Rezná rýchlosť vc = π · D · n / 1000; pre mosadz Ø90 sú vhodné asi 300 – 600 ot/min.',
      'Speed is selected with gearbox levers. Cutting speed vc = π · D · n / 1000; for Ø90 brass about 300 – 600 rpm is suitable.',
    ),
    { part: 'vretennik', param: L('Otáčky vretena', 'Spindle speed') },
  ),
  s(
    L('Spusti vreteno', 'Start the spindle'),
    L('Stlač „Štart vretena“ (alebo medzerník).', 'Press “Start spindle” (or Space).'),
    { button: L('Štart vretena', 'Start spindle'), done: (ui) => ui.running },
  ),
  s(
    L('Nastav hĺbku rezu', 'Set the depth of cut'),
    L(
      'Priečnym posuvom X zmenši priemer o 1 – 2 mm pod priemer polotovaru – nôž sa zareže do otáčajúceho sa obrobku.',
      'Use the cross feed X to set a diameter 1 – 2 mm below the blank – the tool cuts into the turning workpiece.',
    ),
    {
      part: 'priecny',
      param: L('Priečny posuv X (priemer)', 'Cross feed X (diameter)'),
      done: (ui, tele) => tele.cutting || ui.x < tele.workD - 0.2,
    },
  ),
  s(
    L('Zapni automatický posuv', 'Engage the power feed'),
    L(
      'Automatický posuv vedie suport k skľučovadlu rovnomerne – povrch bude hladší než pri ručnom posuve.',
      'The power feed moves the carriage towards the chuck evenly – the surface is smoother than with hand feed.',
    ),
    {
      part: 'suport',
      param: L('Automatický pozdĺžny posuv k skľučovadlu', 'Automatic longitudinal feed towards the chuck'),
      done: (ui) => ui.autoFeed,
    },
  ),
  s(
    L('Sústruž 30 mm', 'Turn 30 mm'),
    L(
      'Sleduj, ako nôž odoberá materiál. Počkaj, kým suport prejde aspoň 30 mm.',
      'Watch the tool remove material. Wait until the carriage has travelled at least 30 mm.',
    ),
    { part: 'obrobok', done: (ui, tele, st) => st.tele.z - tele.z >= 30 },
  ),
  s(
    L('Vypni posuv', 'Disengage the feed'),
    L(
      'Vypni automatický posuv skôr, než nôž dôjde k čeľustiam.',
      'Disengage the power feed before the tool reaches the jaws.',
    ),
    {
      param: L('Automatický pozdĺžny posuv k skľučovadlu', 'Automatic longitudinal feed towards the chuck'),
      done: (ui) => !ui.autoFeed,
    },
  ),
  s(
    L('Zastav vreteno', 'Stop the spindle'),
    L(
      'Meria sa a manipuluje len pri stojacom vretene.',
      'Measure and handle the workpiece only with the spindle stopped.',
    ),
    { button: L('Stop vretena', 'Stop spindle'), done: (ui) => !ui.running },
  ),
  s(
    L('Odmeraj priemer', 'Measure the diameter'),
    L(
      'Zapni posuvné meradlo na obrobku a odčítaj priemer osadenia.',
      'Put the calliper on the workpiece and read the turned diameter.',
    ),
    { param: L('Posuvné meradlo na obrobku', 'Calliper on the workpiece'), done: (ui) => ui.measure },
  ),
];

export const MILL_GUIDE = () => [
  s(
    L('Prehľad frézky', 'Milling machine overview'),
    L(
      'Obrobok je upnutý vo zveráku na stole. Stôl sa posúva pozdĺžne (X), sane priečne (Y) a konzola zvisle (Z); fréza sa len otáča.',
      'The workpiece is held in the vise on the table. The table moves along X, the saddle across Y and the knee vertically Z; the cutter only rotates.',
    ),
    { part: 'zverak' },
  ),
  s(
    L('Otáčky vretena', 'Spindle speed'),
    L(
      'Pre frézu Ø20 z rýchloreznej ocele v hliníku zvoľ asi 400 – 800 ot/min.',
      'For a Ø20 high-speed steel cutter in aluminium choose about 400 – 800 rpm.',
    ),
    { part: 'hlava', param: L('Otáčky vretena', 'Spindle speed') },
  ),
  s(
    L('Spusti vreteno', 'Start the spindle'),
    L('Stlač „Štart vretena“ (alebo medzerník).', 'Press “Start spindle” (or Space).'),
    { button: L('Štart vretena', 'Start spindle'), done: (ui) => ui.running },
  ),
  s(
    L('Prisuň frézu k obrobku', 'Bring the cutter to the work'),
    L(
      'Fréza je nad stredom obrobku. Zdvíhaj konzolu Z, kým fréza nezačne rezať – pri polotovare výšky 60 mm asi pri Z 415 mm. Hĺbku rezu ukazuje hláška nad scénou.',
      'The cutter is above the centre of the work. Raise the knee Z until the cutter starts cutting – about Z 415 mm for a 60 mm high blank. The message above the scene shows the depth of cut.',
    ),
    { part: 'konzola', param: L('Konzola zvisle Z', 'Knee Z'), done: (ui, tele) => tele.cutting },
  ),
  s(
    L('Zaisti konzolu', 'Clamp the knee'),
    L(
      'Pri frézovaní posuvom stola sa konzola zaisťuje, aby sa nepohla.',
      'Clamp the knee before power-feeding the table so it cannot move.',
    ),
    { param: L('Konzola zaistená', 'Knee clamped'), done: (ui) => ui.kneeLock },
  ),
  s(
    L('Zapni posuv stola', 'Engage the table feed'),
    L(
      'Zvoľ smer posuvu stola – fréza prefrézuje drážku alebo plochu.',
      'Choose a table feed direction – the cutter mills a slot or face.',
    ),
    { part: 'stol', param: L('Posuv stola', 'Table feed'), done: (ui) => ui.feedDir !== 0 },
  ),
  s(
    L('Frézuj 40 mm', 'Mill 40 mm'),
    L('Počkaj, kým stôl prejde aspoň 40 mm.', 'Wait until the table has moved at least 40 mm.'),
    { part: 'obrobok', done: (ui, tele, st) => Math.abs(tele.x - st.tele.x) >= 40 },
  ),
  s(
    L('Vypni posuv a vreteno', 'Stop the feed and the spindle'),
    L('Najprv zastav posuv stola, potom vreteno.', 'Stop the table feed first, then the spindle.'),
    { button: L('Stop vretena', 'Stop spindle'), done: (ui) => ui.feedDir === 0 && !ui.running },
  ),
  s(
    L('Zmeraj hĺbku', 'Measure the depth'),
    L('Hĺbkomerom over hĺbku obrobenej plochy.', 'Check the machined depth with the depth gauge.'),
    { param: L('Hĺbkomer na obrobku', 'Depth gauge on the workpiece'), done: (ui) => ui.probe },
  ),
];

export const DRILL_GUIDE = () => [
  s(
    L('Prehľad vŕtačky', 'Drill press overview'),
    L(
      'Doska je upnutá na stole. Vrták sa otáča vo vretene a do materiálu ho posúva pinola (páka posuvu).',
      'The plate is clamped on the table. The drill turns in the spindle and the quill (feed lever) pushes it into the material.',
    ),
    { part: 'stol' },
  ),
  s(
    L('Otáčky', 'Speed'),
    L(
      'Čím väčší vrták, tým nižšie otáčky: pre Ø10 v oceli asi 500 – 800 ot/min.',
      'The larger the drill, the lower the speed: about 500 – 800 rpm for Ø10 in steel.',
    ),
    { part: 'motor', param: L('Otáčky vretena', 'Spindle speed') },
  ),
  s(
    L('Spusti vreteno', 'Start the spindle'),
    L('Stlač „Štart vretena“ (alebo medzerník).', 'Press “Start spindle” (or Space).'),
    { button: L('Štart vretena', 'Start spindle'), done: (ui) => ui.running },
  ),
  s(
    L('Vŕtaj', 'Drill'),
    L('Posúvaj pinolu nadol, kým vrták nezačne vŕtať.', 'Lower the quill until the drill starts cutting.'),
    { part: 'vreteno', param: L('Výsuv pinoly', 'Quill extension'), done: (ui, tele) => tele.drilling },
  ),
  s(
    L('Prevŕtaj dosku', 'Drill through'),
    L('Pokračuj, kým vrták neprejde celou hrúbkou dosky.', 'Keep going until the drill passes through the plate.'),
    { part: 'obrobok', done: (ui, tele, st) => tele.holes > st.tele.holes },
  ),
  s(
    L('Vytiahni vrták', 'Retract the drill'),
    L('Vráť pinolu hore, až potom zastav vreteno.', 'Raise the quill first, then stop the spindle.'),
    { param: L('Výsuv pinoly', 'Quill extension'), done: (ui, tele) => tele.quill < 5 },
  ),
  s(
    L('Zastav vreteno', 'Stop the spindle'),
    L('Hotovú dieru si pozri v scéne.', 'Look at the finished hole in the scene.'),
    { button: L('Stop vretena', 'Stop spindle'), done: (ui) => !ui.running },
  ),
];

export const WELD_GUIDE = () => [
  s(
    L('Zapni zváračku', 'Switch the welder on'),
    L(
      'Prepínač daj na 380 V – na 220 V je prúd obmedzený.',
      'Set the switch to 380 V – on 220 V the current is limited.',
    ),
    { part: 'zvaracka', param: L('Prepínač', 'Switch'), done: (ui) => ui.mode === 'w380' },
  ),
  s(
    L('Pripoj zemniacu svorku', 'Attach the ground clamp'),
    L('Bez zemniacej svorky sa oblúk nezapáli.', 'Without the ground clamp the arc will not strike.'),
    { part: 'svorka', param: L('Zemniaca svorka pripojená', 'Ground clamp attached'), done: (ui) => ui.ground },
  ),
  s(
    L('Nastav prúd', 'Set the current'),
    L(
      'Orientačne 40 A na 1 mm priemeru elektródy: pre Ø3,2 asi 100 – 130 A.',
      'Roughly 40 A per 1 mm of electrode diameter: about 100 – 130 A for Ø3.2.',
    ),
    { part: 'zvaracka' },
  ),
  s(
    L('Spusti kuklu', 'Lower the helmet'),
    L('Oblúk bez kukly poškodí zrak – stlač H.', 'The arc damages eyes without a helmet – press H.'),
    { param: L('Zváračská kukla spustená (H)', 'Welding helmet down (H)'), done: (ui) => ui.helmet },
  ),
  s(
    L('Režim Zváranie', 'Welding mode'),
    L('Prepni nad scénou na Zváranie (alebo stlač M).', 'Switch to Welding above the scene (or press M).'),
    { part: 'drziak', done: (ui) => ui.manual },
  ),
  s(
    L('Zapáľ oblúk', 'Strike the arc'),
    L(
      'Drž pravé tlačidlo myši a ľavým ťukni elektródou o materiál na začiatku spoja.',
      'Hold the right mouse button and tap the electrode on the material at the start of the joint with the left one.',
    ),
    { part: 'zvarenec', done: (ui, tele) => tele.arc },
  ),
  s(
    L('Zvar spoj', 'Weld the joint'),
    L(
      'Veď elektródu rovnomerne pozdĺž modrej čiary a drž krátky oblúk. Zvar aspoň polovicu dĺžky spoja.',
      'Move the electrode steadily along the blue line with a short arc. Weld at least half of the joint length.',
    ),
    { part: 'zvarenec', done: (ui, tele) => (tele.stats?.cov || 0) >= 0.5 },
  ),
  s(
    L('Pozri hodnotenie', 'Check the result'),
    L(
      'Pusti tlačidlá, Esc ukončí zváranie. V paneli je hodnotenie zvaru a rez zvarom.',
      'Release the buttons, Esc ends welding. The panel shows the weld rating and a weld section.',
    ),
  ),
];

export const CNC_GUIDE =
  (rxu = false) =>
  () => [
    s(
      L('Program', 'Program'),
      L(
        'V časti Program je ukážkový program. Kontrola pod ním musí byť bez chýb – inak stroj program nespustí.',
        'The Program section holds a sample program. The check below it must show no errors, otherwise the machine will not run it.',
      ),
      { part: 'panel' },
    ),
    s(
      L('Zatvor dvere', 'Close the doors'),
      L('Cyklus sa spustí len pri zatvorených dverách.', 'The cycle starts only with closed doors.'),
      { part: 'kabina', button: L('Zatvoriť dvere', 'Close doors'), done: (ui) => !ui.door },
    ),
    s(L('Štart cyklu', 'Cycle start'), L('Stlač „Štart cyklu“ (alebo medzerník).', 'Press “Cycle start” (or Space).'), {
      button: L('Štart cyklu', 'Cycle start'),
      done: (ui, tele) => tele.run || tele.done,
    }),
    s(
      L('Sleduj displej', 'Watch the display'),
      rxu
        ? L(
            'V HMI cez celé okno (ručné ovládanie) ťukni na displeji na DIAGNOSTICS – uvidíš zaťaženie vretena a úber. Posuvníky SPEED a FEED dole menia rýchlosť a korekciu posuvu.',
            'In the full-screen HMI (manual control) tap DIAGNOSTICS on the display – it shows spindle load and removal. The SPEED and FEED sliders at the bottom change speed and feed override.',
          )
        : L(
            'V HMI cez celé okno (ručné ovládanie) ťukni na displeji na MONITOR – uvidíš zaťaženie vretena a úber. Posuvníky SPEED a FEED dole menia rýchlosť a korekciu posuvu.',
            'In the full-screen HMI (manual control) tap MONITOR on the display – it shows spindle load and removal. The SPEED and FEED sliders at the bottom change speed and feed override.',
          ),
      { part: 'panel', done: (ui) => ui.scrTab === 'monitor' },
    ),
    s(
      L('Dokonči program', 'Finish the program'),
      L(
        'Počkaj na koniec programu alebo stlač „Rýchlo na koniec“.',
        'Wait for the end of the program or press “Fast to the end”.',
      ),
      { button: L('Rýchlo na koniec', 'Fast to the end'), done: (ui, tele) => tele.done },
    ),
    s(
      L('Otvor dvere', 'Open the doors'),
      L('Po skončení programu sa dvere odomknú.', 'The doors unlock when the program ends.'),
      { button: L('Otvoriť dvere', 'Open doors'), done: (ui) => ui.door },
    ),
    s(
      L('Pozri obrobok', 'Inspect the workpiece'),
      L(
        'Nad scénou stlač „Pozrieť obrobok“ – obrobok môžeš otáčať a zmerať v úlohe.',
        'Press “Inspect workpiece” above the scene – rotate it and measure it in a task.',
      ),
      { part: 'obrobok', done: (ui) => ui.unclamped },
    ),
  ];

export const EDM_GUIDE = () => [
  s(
    L('Zatvor nádrž', 'Close the tank'),
    L(
      'Hĺbi sa pod dielektrikom – nádrž musí byť zatvorená.',
      'Sinking runs under dielectric – the tank must be closed.',
    ),
    { part: 'nadrz', button: L('Zatvoriť nádrž', 'Close tank'), done: (ui) => !ui.door },
  ),
  s(
    L('Napusti dielektrikum', 'Fill the dielectric'),
    L(
      'Dielektrikum chladí, odplavuje častice a izoluje medzeru.',
      'The dielectric cools, flushes particles and insulates the gap.',
    ),
    { param: L('Napustiť dielektrikum', 'Fill dielectric'), done: (ui) => ui.fill },
  ),
  s(
    L('Počkaj na hladinu', 'Wait for the level'),
    L('Hladina musí byť aspoň 40 mm nad obrobkom.', 'The level must be at least 40 mm above the workpiece.'),
    { part: 'nadrz', done: (ui, tele) => tele.oilLevel >= 120 },
  ),
  s(
    L('Prúd generátora', 'Generator current'),
    L(
      'Vyšší prúd hĺbi rýchlejšie, ale zväčší medzeru a drsnosť. Údaje o medzere a Ra sú pod posuvníkom.',
      'Higher current sinks faster but widens the gap and roughness. Gap and Ra are shown below the slider.',
    ),
    { part: 'generator', param: L('Pracovný prúd', 'Working current') },
  ),
  s(L('Štart cyklu', 'Cycle start'), L('Stlač „Štart cyklu“ (alebo medzerník).', 'Press “Cycle start” (or Space).'), {
    button: L('Štart cyklu', 'Cycle start'),
    done: (ui, tele) => tele.run || tele.done,
  }),
  s(
    L('Sleduj hĺbenie', 'Watch the sinking'),
    L(
      'V HMI cez celé okno ťukni na MONITOR – graf hĺbky a úberu. Posuvník SPEED v stavovom riadku zrýchli simuláciu.',
      'In the full-screen HMI tap MONITOR – depth and removal graph. The SPEED slider in the status bar speeds up the simulation.',
    ),
    { part: 'panel', done: (ui) => ui.hmiTab === 'monitor' },
  ),
  s(
    L('Koniec programu', 'End of program'),
    L('Počkaj, kým elektróda vyhĺbi všetky operácie.', 'Wait until the electrode has sunk all operations.'),
    { part: 'obrobok', done: (ui, tele) => tele.done },
  ),
];

export const BRAKE_GUIDE = () => [
  s(
    L('Zapni hydrauliku', 'Switch on the hydraulics'),
    L('Baran sa pohybuje hydraulicky.', 'The ram is driven hydraulically.'),
    { part: 'baran', param: L('Hydraulika', 'Hydraulics'), done: (ui) => ui.hydraulic },
  ),
  s(
    L('Plech', 'Sheet'),
    L(
      'Zadaj hrúbku, dĺžku a hĺbku prírezu v časti Ohyb.',
      'Enter the thickness, length and depth of the blank in the Bend section.',
    ),
    { part: 'plech' },
  ),
  s(
    L('Zvoľ matricu', 'Choose the die'),
    L(
      'Otvorenie matrice V má byť 6 – 10 × hrúbka plechu.',
      'The die opening V should be 6 – 10 × the sheet thickness.',
    ),
    {
      part: 'stol',
      param: L('Otvorenie matrice V', 'Die opening V'),
      done: (ui) => ui.v >= 6 * ui.thickness && ui.v <= 10 * ui.thickness,
    },
  ),
  s(
    L('Spusti ohyb', 'Start the bend'),
    L(
      'Stlač „Spustiť ohyb“ – pri úlohe najprv potvrď kontrolu BOZP.',
      'Press “Start bend” – in a task confirm the safety check first.',
    ),
    { button: L('Spustiť ohyb', 'Start bend'), done: (ui, tele) => tele.run || tele.complete },
  ),
  s(
    L('Dokončenie ohybu', 'Bend complete'),
    L('Počkaj, kým baran ohne plech a vráti sa hore.', 'Wait until the ram bends the sheet and returns up.'),
    { part: 'plech', done: (ui, tele) => tele.complete },
  ),
];
