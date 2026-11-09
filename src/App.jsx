// Hlavné menu, výber stroja a smerovanie podľa URL (#sustruh, #freza, …).
import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { L, PREFS, PrefsCtx } from './core/i18n';
import { setSoundOn } from './core/sound';
import {
  BandSawArt,
  BenderArt,
  CylGrinderArt,
  DrillArt,
  FolderArt,
  GrinderArt,
  HobberArt,
  HorizArt,
  LatheArt,
  MigArt,
  HermleArt,
  MillArt,
  PlateRollArt,
  PressArt,
  PrecisionArt,
  OscarArt,
  ShuangliArt,
  RoedersArt,
  RadialArt,
  ShaperArt,
  ShearArt,
  SlotterArt,
  WelderArt,
} from './ui/art';
import { PrefBar } from './ui/common';
import { BystronicArt } from './ui/bystronicArt';
import { BenchGrinderArt, CenterlessArt, FguArt, FnkArt, HovArt, KaruselArt, SvArt, ToolGrinderArt } from './ui/art2';

// každý stroj je samostatný súbor – načíta sa až pri otvorení, menu sa tak zobrazí bez three.js
const LatheSimulator = lazy(() => import('./machines/lathe'));
const MillSimulator = lazy(() => import('./machines/mill'));
const DrillSimulator = lazy(() => import('./machines/drill'));
const RadialSimulator = lazy(() => import('./machines/radial'));
const HorizSimulator = lazy(() => import('./machines/horiz'));
const HobberSimulator = lazy(() => import('./machines/hob'));
const FolderSimulator = lazy(() => import('./machines/folder'));
const BenderSimulator = lazy(() => import('./machines/bender'));
const PlateRollSimulator = lazy(() => import('./machines/plate'));
const ShearSimulator = lazy(() => import('./machines/shear'));
const PressSimulator = lazy(() => import('./machines/press'));
const HermleSimulator = lazy(() => import('./machines/hermle'));
const RoedersSimulator = lazy(() => import('./machines/roeders'));
const OscarSimulator = lazy(() => import('./machines/oscar'));
const ShuangliSimulator = lazy(() => import('./machines/shuangli'));
const BystronicSimulator = lazy(() => import('./machines/bystronic'));
const GrinderSimulator = lazy(() => import('./machines/grinder'));
const CylGrinderSimulator = lazy(() => import('./machines/cylgrind'));
const ShaperSimulator = lazy(() => import('./machines/shaper'));
const SlotterSimulator = lazy(() => import('./machines/slotter'));
const FguSimulator = lazy(() => import('./machines/fgu'));
const FnkSimulator = lazy(() => import('./machines/fnk'));
const KaruselSimulator = lazy(() => import('./machines/karusel'));
const BnSimulator = lazy(() => import('./machines/bn'));
const BbtSimulator = lazy(() => import('./machines/bbt'));
const BbjSimulator = lazy(() => import('./machines/bbj'));
const HovSimulator = lazy(() => import('./machines/hov'));
const SvSimulator = lazy(() => import('./machines/lathe').then((m) => ({ default: m.SvSimulator })));
const BandSawSimulator = lazy(() => import('./machines/saw'));
const WeldingSimulator = lazy(() => import('./machines/weld'));
const MigSimulator = lazy(() => import('./machines/weld').then((m) => ({ default: m.MigSimulator })));

function SimLoading() {
  return (
    <div className="boot" role="status">
      <i aria-hidden="true" />
      <b>Real machine tools</b>
      <span>{L('Načítava sa simulátor…', 'Loading the simulator…')}</span>
    </div>
  );
}

const MACHINES = [
  {
    id: 'sustruh',
    Art: LatheArt,
    Comp: LatheSimulator,
    t: () => ({
      meta: L('Sústruh', 'Lathe'),
      name: L('Konvenčný hrotový sústruh', 'Conventional centre lathe'),
      model: 'TOS SN / VDF',
      desc: L(
        'Sústruženie tyčí rôznych priemerov a tvarov: štvorpolohová nožová hlava s 8 typmi nožov, mikroposuv horných saní, koník so zaistením.',
        'Turning bars of various sizes and shapes: four-way tool post with 8 tool types, top-slide fine feed, lockable tailstock.',
      ),
      specs: [
        L('12 otáčok 40 – 1800 ot/min', '12 speeds 40 – 1800 rpm'),
        L('Posuv 0,05 – 1 mm/ot', 'Feed 0.05 – 1 mm/rev'),
        L('DRO na ramene', 'Arm-mounted DRO'),
      ],
    }),
  },
  {
    id: 'freza',
    Art: MillArt,
    Comp: MillSimulator,
    t: () => ({
      meta: L('Fréza', 'Milling machine'),
      name: L('Univerzálna konzolová fréza', 'Universal knee-type milling machine'),
      model: 'TOS FA 3 B',
      desc: L(
        'Konzolová fréza so sklopnou vertikálnou hlavou: frézovanie hranola alebo tyče vo zveráku stopkovými, guľovými a čelnými frézami.',
        'Knee-type mill with a swivelling vertical head: milling a block or a bar in the vise with end, ball-nose and face mills.',
      ),
      specs: [
        L('18 otáčok 40 – 2000 ot/min', '18 speeds 40 – 2000 rpm'),
        L('Posuv 19 – 950 mm/min', 'Feed 19 – 950 mm/min'),
        L('Zdvihy X 800 · Y 300 · Z 420 mm', 'Travel X 800 · Y 300 · Z 420 mm'),
      ],
    }),
  },
  {
    id: 'sv',
    Art: SvArt,
    Comp: SvSimulator,
    t: () => ({
      meta: L('Sústruh', 'Lathe'),
      name: L('Univerzálny hrotový sústruh', 'Universal centre lathe'),
      model: 'TOS Trenčín SV 18 RA',
      desc: L(
        'Najčastejší školský sústruh: menší a ľahší než SN – točný priemer 380 mm nad lôžkom, výška hrotov 190 mm. Rovnaké ovládanie, nože, závity a úlohy ako na SN, na porovnanie veľkostí.',
        'The most common school lathe: smaller and lighter than the SN – 380 mm swing over the bed, 190 mm centre height. Same controls, tools, threads and tasks as the SN, for comparing sizes.',
      ),
      specs: [
        L('Točný Ø 380 mm', 'Swing Ø380 mm'),
        L('Vreteno Ø41, 6 kW', 'Spindle bore Ø41, 6 kW'),
        L('Hroty 750 – 1 250 mm', 'Centres 750 – 1,250 mm'),
      ],
    }),
  },
  {
    id: 'karusel',
    Art: KaruselArt,
    Comp: KaruselSimulator,
    t: () => ({
      meta: L('Karuselový sústruh', 'Vertical lathe'),
      name: L('Karuselový sústruh', 'Vertical turret lathe'),
      model: 'TOS Hulín SK 12',
      desc: L(
        'Veľké kotúče na otočnej upínacej doske: priečnik so zdvihom, suport so smykadlom, posuv v mm na otáčku, rezná rýchlosť podľa priemeru, čelo a osadenie.',
        'Large discs on a rotary faceplate: elevating cross rail, rail head with ram, feed in mm per revolution, cutting speed by diameter, facing and shouldering.',
      ),
      specs: [
        L('Doska Ø1 200 mm', 'Faceplate Ø1,200 mm'),
        L('Točný Ø do 1 300 mm', 'Swing up to Ø1,300 mm'),
        L('Obrobok do 4 t', 'Work up to 4 t'),
      ],
    }),
  },
  {
    id: 'fgu',
    Art: FguArt,
    Comp: FguSimulator,
    t: () => ({
      meta: L('Univerzálna frézka', 'Universal mill'),
      name: L('Univerzálna konzolová frézka', 'Universal knee-type milling machine'),
      model: 'TOS Olomouc FGU 32',
      desc: L(
        'Vodorovné vreteno s tŕňom a podperou, kotúčová fréza, otočný stôl ±45° pre šikmé drážky, súsledné a nesúsledné frézovanie s vymedzením vôle.',
        'Horizontal spindle with arbor and support, side-and-face cutter, ±45° swivel table for inclined slots, climb and conventional milling with backlash eliminator.',
      ),
      specs: [
        L('Stôl 320 × 1 250 mm', 'Table 320 × 1,250 mm'),
        L('12 otáčok 31,5 – 1 400', '12 speeds 31.5 – 1,400'),
        L('Natočenie stola ±45°', 'Table swivel ±45°'),
      ],
    }),
  },
  {
    id: 'fnk',
    Art: FnkArt,
    Comp: FnkSimulator,
    t: () => ({
      meta: L('Nástrojárska frézka', 'Toolroom mill'),
      name: L('Nástrojárska frézka s natáčacou hlavou', 'Toolroom mill with swivelling head'),
      model: 'TOS Kuřim FNK 25',
      desc: L(
        'Zvislá hlava natáčaná o ±45° podľa stupnice, pinola, stopkové frézy Ø12 / Ø16: úkosy čelom frézy a drážky, krížový stôl s posuvmi X a Y.',
        'Vertical head swivelling ±45° by its scale, quill, Ø12 / Ø16 end mills: bevels with the cutter face and slots, compound table with X and Y feeds.',
      ),
      specs: [
        L('Stôl 1 250 × 290 mm', 'Table 1,250 × 290 mm'),
        L('X 800 / Y 370 / Z 450', 'X 800 / Y 370 / Z 450'),
        L('Hlava ±45°', 'Head ±45°'),
      ],
    }),
  },
  {
    id: 'vrtacka',
    Art: DrillArt,
    Comp: DrillSimulator,
    t: () => ({
      meta: L('Vŕtačka', 'Drill'),
      name: L('Stĺpová vŕtačka', 'Pillar drill'),
      model: 'TOS SV16',
      desc: L(
        'Vŕtanie dier Ø3 – Ø16 mm do oceľovej dosky na podložkách: priečna kľuka pinoly, zdvíhací stôl, otvory naslepo aj naskrz.',
        'Drilling Ø3 – Ø16 mm holes into a steel plate on parallels: capstan quill feed, rising table, blind and through holes.',
      ),
      specs: [
        L('8 otáčok 125 – 1400 ot/min', '8 speeds 125 – 1400 rpm'),
        L('Zdvih pinoly 100 mm', 'Quill stroke 100 mm'),
        L('Vŕtanie do Ø16 mm', 'Drilling up to Ø16 mm'),
      ],
    }),
  },
  {
    id: 'odvalovacka',
    Art: HobberArt,
    Comp: HobberSimulator,
    t: () => ({
      meta: L('Odvalovacia frézka', 'Gear hobber'),
      name: L('Odvalovacia frézka na ozubenie', 'Gear hobbing machine'),
      model: 'TOS Čelákovice OFA 32',
      desc: L(
        'Výroba čelných ozubených kolies odvalovaním: výmenné kolesá delenia i = 24 / z, sklon frézy na stúpací uhol, radiálny prísuv na hĺbku 2,25 · m, zvislý posuv a kontrola rozmeru cez zuby Wk.',
        'Generating spur gears by hobbing: index change gears i = 24 / z, hob swivel to the lead angle, radial infeed to 2.25 · m, vertical feed and span-over-teeth Wk check.',
      ),
      specs: [
        L('Modul 2, z 20 – 40', 'Module 2, z 20 – 40'),
        L('Fréza Ø70 jednochodá', 'Single-start Ø70 hob'),
        L('Kontrola Wk ±0,05', 'Wk check ±0.05'),
      ],
    }),
  },
  {
    id: 'hov',
    Art: HovArt,
    Comp: HovSimulator,
    t: () => ({
      meta: L('Zvislá obrážačka', 'Vertical slotter'),
      name: L('Zvislá obrážačka s otočným stolom', 'Vertical slotter with rotary table'),
      model: 'TOS HOV 25',
      desc: L(
        'Oblúkový stojan so smykadlom vpredu, krížový a otočný stôl Ø500: viac drážok v náboji s delením otočného stola, vonkajší oblúk kruhovým posuvom, dĺžka a poloha zdvihu, narážky posuvov, nárazy do stola a upínok.',
        'Arched column with the ram at the front, compound and rotary table Ø500: several keyways in a hub indexed on the rotary table, an outside arc with the rotary feed, stroke length and position, feed stops, crashes into the table and clamps.',
      ),
      specs: [
        L('Zdvih do 250 mm', 'Stroke up to 250 mm'),
        L('Otočný stôl Ø500', 'Rotary table Ø500'),
        L('Posuvy 560 × 450 mm', 'Travels 560 × 450 mm'),
      ],
    }),
  },
  {
    id: 'radialka',
    Art: RadialArt,
    Comp: RadialSimulator,
    t: () => ({
      meta: L('Radiálna vŕtačka', 'Radial drill'),
      name: L('Radiálna vŕtačka', 'Radial drilling machine'),
      model: 'TOS VO 50',
      desc: L(
        'Vŕtanie veľkých dosiek a prírub bez posúvania obrobku: rameno sa otáča okolo stĺpa a zdvíha motorom, vreteník jazdí po ramene, upínanie stĺpa a vreteníka, automatický posuv s hĺbkovým dorazom.',
        'Drilling large plates and flanges without moving the work: the arm swings around the column and is raised by a motor, the head travels along the arm, column and head clamps, power feed with a depth stop.',
      ),
      specs: [
        L('Vŕtanie do Ø50 mm', 'Drilling up to Ø50 mm'),
        L('Vyloženie 320 – 1240 mm', 'Reach 320 – 1240 mm'),
        L('12 otáčok 32 – 1400 ot/min', '12 speeds 32 – 1400 rpm'),
      ],
    }),
  },
  {
    id: 'horizontalka',
    Art: HorizArt,
    Comp: HorizSimulator,
    t: () => ({
      meta: L('Horizontálka', 'Horizontal borer'),
      name: L('Horizontálna vŕtačka a frézka', 'Horizontal boring mill'),
      model: 'TOS Varnsdorf W 9',
      desc: L(
        'Vyvrtávanie otvorov v skriňových odliatkoch: vreteník na stojane, vysúvacie vreteno W, krížový stôl a otočný stôl s aretáciou po 90°, mikrometrická vyvrtávacia hlava a priehyb tyče podľa vyloženia.',
        'Boring holes in box castings: headstock on the column, extending W spindle, compound table and a rotary table locking every 90°, micrometer boring head and bar deflection by overhang.',
      ),
      specs: [
        L('Vreteno W 500 mm', 'Spindle W 500 mm'),
        L('Otočný stôl B', 'Rotary table B'),
        L('Otvor Ø80 H7', 'Hole Ø80 H7'),
      ],
    }),
  },
  {
    id: 'ohybacka',
    Art: FolderArt,
    Comp: FolderSimulator,
    t: () => ({
      meta: L('Ohýbačka', 'Folder'),
      name: L('Výkyvná ohýbačka plechu', 'Manual swing-beam folder'),
      model: 'FASTI 204-10-2',
      desc: L(
        'Ručné ohýbanie plechu: upnutie kolesom cez dve skrutky, vykývnutie ohýbacej lišty a odpruženie plechu podľa hrúbky.',
        'Manual sheet folding: clamping by handwheel through two screws, swinging the folding beam and springback according to thickness.',
      ),
      specs: [
        L('Dĺžka ohybu 1 040 mm', 'Bending length 1,040 mm'),
        L('Plech do 2 mm', 'Sheet up to 2 mm'),
        L('Uhol ohybu do 130°', 'Bend angle up to 130°'),
      ],
    }),
  },
  {
    id: 'noznice',
    Art: ShearArt,
    Comp: ShearSimulator,
    t: () => ({
      meta: L('Tabuľové nožnice', 'Guillotine shear'),
      name: L('Tabuľové nožnice', 'Guillotine shear'),
      model: 'BS 2000/8',
      desc: L(
        'Strihanie plechov na pásy a prírezy: zadný doraz, bočný uholník, vôľa nožov podľa hrúbky, prítlaky, kryt prstov blokujúci pedál a kapacita stroja.',
        'Shearing sheets into strips and blanks: back gauge, side square, blade clearance by thickness, hold-downs, a finger guard that blocks the pedal and the machine capacity.',
      ),
      specs: [
        L('Plech do 8 mm', 'Sheet up to 8 mm'),
        L('Dĺžka strihu 2 000 mm', 'Cut length 2,000 mm'),
        L('Zadný doraz do 750 mm', 'Back gauge up to 750 mm'),
      ],
    }),
  },
  {
    id: 'lis',
    Art: PressArt,
    Comp: PressSimulator,
    t: () => ({
      meta: L('Výstredníkový lis', 'Eccentric press'),
      name: L('Výstredníkový lis', 'Eccentric press'),
      model: 'TOMA LEN 40C',
      desc: L(
        'Dierovanie a vystrihovanie z pásu: sila strihu podľa priemeru a hrúbky, prestavenie baranidla a zanorenie razníka, jednotlivý zdvih pedálom, kryt nástroja, preťaženie a zlomený razník.',
        'Punching and blanking from strip: cutting force by diameter and thickness, ram adjustment and punch entry, single stroke by pedal, tool guard, overload and a broken punch.',
      ),
      specs: [
        L('Sila 400 kN', 'Force 400 kN'),
        L('Zdvih 10 – 80 mm', 'Stroke 10 – 80 mm'),
        L('80 zdvihov/min', '80 strokes/min'),
      ],
    }),
  },
  {
    id: 'profilova',
    Art: BenderArt,
    Comp: BenderSimulator,
    t: () => ({
      meta: L('Profilová ohýbačka', 'Section bender'),
      name: L('Zakružovačka profilov', 'Section and profile bender'),
      model: 'COMAC 3025 HV',
      desc: L(
        'Zakružovanie plochých tyčí, rúr, jäklov a uholníkov tromi poháňanými valcami: prísuv stredného valca, odpruženie po ohybe, tvarové valce, bočné vodiace kladky a pracovná poloha vodorovná aj zvislá.',
        'Rolling flat bars, tubes, square tubes and angles with three driven rolls: centre-roll feed, springback after bending, forming rolls, side guide rollers and horizontal or vertical working position.',
      ),
      specs: [
        L('3 poháňané valce v pyramíde', '3 driven rolls in a pyramid'),
        L('Pracovná poloha H aj V', 'Working position H and V'),
        L('Rýchlosť 3 / 5 / 8 m/min', 'Speed 3 / 5 / 8 m/min'),
      ],
    }),
  },
  {
    id: 'zakruzovacka',
    Art: PlateRollArt,
    Comp: PlateRollSimulator,
    t: () => ({
      meta: L('Zakružovačka plechu', 'Plate rolls'),
      name: L('Zakružovačka plechu', 'Plate bending rolls'),
      model: 'TOS XZC 3000/10',
      desc: L(
        'Trojvalcová pyramída: dva poháňané spodné valce, horný valec prisúvaný ručným kolesom, odpruženie podľa hrúbky, predohnutie koncov podložným plechom a vysunutie plášťa cez odklopné ložisko.',
        'Three-roll pyramid: two driven lower rolls, a top roll fed by a handwheel, springback by thickness, pre-bending the ends with a backing plate and sliding the shell off through the drop-end bearing.',
      ),
      specs: [
        L('Pracovná dĺžka 3 000 mm', 'Working length 3,000 mm'),
        L('Plech do 10 mm', 'Sheet up to 10 mm'),
        L('Odklopné ložisko', 'Drop-end bearing'),
      ],
    }),
  },
  {
    id: 'bruska',
    Art: GrinderArt,
    Comp: GrinderSimulator,
    t: () => ({
      meta: L('Brúska', 'Grinder'),
      name: L('Rovinná brúska', 'Surface grinder'),
      model: 'TOS Hostivař BPH 300',
      desc: L(
        'Rovinné brúsenie na magnetickej doske: hydraulický pohyb stola tam a späť, priečny posuv na konci zdvihu, prísuv po stotinách mm, chladenie emulziou.',
        'Surface grinding on a magnetic chuck: hydraulic table reciprocation, cross feed at the stroke end, infeed in hundredths of a mm, emulsion cooling.',
      ),
      specs: [
        L('Kotúč Ø300 × 40 mm', 'Wheel Ø300 × 40 mm'),
        L('Stôl 1 – 25 m/min', 'Table 1 – 25 m/min'),
        L('Prísuv 0,005 mm', 'Infeed 0.005 mm'),
      ],
    }),
  },
  {
    id: 'bn',
    Art: ToolGrinderArt,
    Comp: BnSimulator,
    t: () => ({
      meta: L('Nástrojárska brúska', 'Tool grinder'),
      name: L('Nástrojárska brúska na ostrenie nožov', 'Tool and cutter grinder'),
      model: 'TOS Hostivař BN 102',
      desc: L(
        'Ostrenie sústružníckeho noža hrnčekovým kotúčom: univerzálny naklápací držiak so stupnicou, uhol chrbta α a čela γ, prísuv po stotinách, prepálenie pri veľkom prísuve.',
        'Sharpening a turning tool with a cup wheel: universal tilting holder with a scale, clearance α and rake γ angles, infeed in hundredths, burning at too large an infeed.',
      ),
      specs: [
        L('Kotúč do Ø280', 'Wheel up to Ø280'),
        L('2 800 – 5 600 ot/min', '2,800 – 5,600 rpm'),
        L('Stôl 920 × 140 mm', 'Table 920 × 140 mm'),
      ],
    }),
  },
  {
    id: 'bezhrot',
    Art: CenterlessArt,
    Comp: BbjSimulator,
    t: () => ({
      meta: L('Bezhrotová brúska', 'Centreless grinder'),
      name: L('Bezhrotová brúska', 'Centreless grinder'),
      model: 'TOS Hostivař BBJ 6',
      desc: L(
        'Priebežné brúsenie kolíkov medzi brúsnym a podávacím kotúčom: medzera = priemer, naklopenie α a rýchlosť prechodu, výška podpery a guľatosť, úber na prechod.',
        'Throughfeed grinding of pins between the grinding and the regulating wheel: gap = diameter, tilt α and throughfeed rate, rest height and roundness, stock per pass.',
      ),
      specs: [
        L('Priemer do 63 mm', 'Diameter up to 63 mm'),
        L('Kotúče Ø500 / Ø250', 'Wheels Ø500 / Ø250'),
        L('Kolíky Ø20 ±0,01', 'Pins Ø20 ±0.01'),
      ],
    }),
  },
  {
    id: 'dvojkotuc',
    Art: BenchGrinderArt,
    Comp: BbtSimulator,
    t: () => ({
      meta: L('Stojanová brúska', 'Pedestal grinder'),
      name: L('Dvojkotúčová stojanová brúska', 'Double-wheel pedestal grinder'),
      model: 'TOS BBT 350',
      desc: L(
        'Ručné ostrenie nožov na opierke a BOZP: medzera opierky do 3 mm, ochranný štít, hrubý a jemný kotúč, teplota noža a chladenie vo vode.',
        'Freehand tool sharpening on the rest and safety: rest gap up to 3 mm, eye shield, coarse and fine wheel, tool temperature and quenching in water.',
      ),
      specs: [
        L('Kotúče Ø350', 'Wheels Ø350'),
        L('Opierka ≤ 3 mm', 'Rest gap ≤ 3 mm'),
        L('Chladenie vo vode', 'Water quench'),
      ],
    }),
  },
  {
    id: 'gulato',
    Art: CylGrinderArt,
    Comp: CylGrinderSimulator,
    t: () => ({
      meta: L('Brúska na guľato', 'Cylindrical grinder'),
      name: L('Hrotová brúska na guľato', 'Cylindrical grinder'),
      model: 'TOS Hostivař BUA 25',
      desc: L(
        'Brúsenie hriadeľov medzi hrotmi na mikróny: hydraulický stôl s dorazmi, prísuv kotúča po 0,005 mm, automatický prísuv na obrate, vyiskrovanie, prepal pri veľkom zábere a meranie mikrometrom.',
        'Grinding shafts between centres to microns: hydraulic table with dogs, 0.005 mm wheel infeed, automatic infeed at reversal, spark-out, burning at too large an infeed and micrometer measurement.',
      ),
      specs: [
        L('Kotúč Ø400 × 40 mm', 'Wheel Ø400 × 40 mm'),
        L('Prísuv 0,005 mm', 'Infeed 0.005 mm'),
        L('Tolerancia h5 / h6', 'Tolerance h5 / h6'),
      ],
    }),
  },
  // priečna obrážačka: v menu skrytá, simulátor zostáva dostupný cez #obrazacka
  {
    id: 'obrazacka',
    hidden: true,
    Art: ShaperArt,
    Comp: ShaperSimulator,
    t: () => ({
      meta: L('Obrážačka', 'Shaper'),
      name: L('Priečna obrážačka', 'Shaping machine'),
      model: 'TOS',
      desc: L(
        'Historický stroj školských dielní: kulisa poháňa smykadlo tam a späť s rýchlym spätným chodom, nôž v sklopnej doske reže len pri pracovnom zdvihu, stôl sa posúva západkou.',
        'A classic of school workshops: the slotted link drives the ram back and forth with a quick return, the tool in the clapper box cuts only on the cutting stroke, the table is fed by a ratchet.',
      ),
      specs: [
        L('Zdvih 20 – 500 mm', 'Stroke 20 – 500 mm'),
        L('10 – 56 zdvihov/min', '10 – 56 strokes/min'),
        L('Posuv 0,2 – 4 mm/zdvih', 'Feed 0.2 – 4 mm/stroke'),
      ],
    }),
  },
  {
    id: 'zobrazacka',
    Art: SlotterArt,
    Comp: SlotterSimulator,
    t: () => ({
      meta: L('Zvislá obrážačka', 'Slotting machine'),
      name: L('Zvislá obrážačka (drážkovačka)', 'Vertical slotter'),
      model: 'TOS ST 350',
      desc: L(
        'Obrážanie drážok pre perá a tvarových otvorov v nábojoch: zvislé smykadlo s kulisovým pohonom, krížový stôl so západkovým posuvom a otočný stôl s delením.',
        'Slotting keyways and shaped holes in hubs: vertical ram with a slotted-link drive, compound table with ratchet feed and an indexing rotary table.',
      ),
      specs: [
        L('Zdvih 20 – 350 mm', 'Stroke 20 – 350 mm'),
        L('12 – 71 zdvihov/min', '12 – 71 strokes/min'),
        L('Otočný stôl, delenie 2 – 8', 'Rotary table, indexing 2 – 8'),
      ],
    }),
  },
  {
    id: 'pila',
    Art: BandSawArt,
    Comp: BandSawSimulator,
    t: () => ({
      meta: L('Píla', 'Saw'),
      name: L('Strojná pásová píla', 'Vertical band saw'),
      model: 'TOS PPN',
      desc: L(
        'Rezanie dreva, hliníka a ocele pásom: napínanie pásu, nastavenie horného vodidla, voľba rýchlosti pásu podľa materiálu.',
        'Cutting wood, aluminium and steel with a band: blade tensioning, upper guide setting, blade speed chosen by material.',
      ),
      specs: [
        L('Kolesá Ø720 mm', 'Wheels Ø720 mm'),
        L('Pás 3 / 10 / 25 m/s', 'Blade 3 / 10 / 25 m/s'),
        L('Rez do 150 mm', 'Cut up to 150 mm'),
      ],
    }),
  },
  {
    id: 'zvaranie',
    Art: WelderArt,
    Comp: WeldingSimulator,
    t: () => ({
      meta: L('Zváranie', 'Welding'),
      name: L('Oblúková zváračka', 'Arc welder'),
      model: 'Elektrokov JS 90FN',
      desc: L(
        'Ručné zváranie obalenou elektródou: plechy v rovine aj kolmo, rúry a tvarové diely, polohy PA – PG aj rúrové, výmena elektródy, kukla proti zábleskom a hodnotenie húsenice.',
        'Manual metal arc welding: flat and perpendicular plates, pipes and shaped parts, positions PA – PG and pipe positions, electrode change, a helmet against the flash and bead assessment.',
      ),
      specs: [
        L('Prúd 55 – 155 A', 'Current 55 – 155 A'),
        L('380 / 220 V', '380 / 220 V'),
        L('Elektródy Ø2 – Ø4 mm', 'Electrodes Ø2 – Ø4 mm'),
      ],
      note: L(
        'Obsahuje svetelné záblesky. Blikanie sa dá vypnúť v paneli (Efekty záblesku).',
        'Contains light flashes. Flicker can be turned off in the panel (Flash effects).',
      ),
    }),
  },
  {
    id: 'mag',
    Art: MigArt,
    Comp: MigSimulator,
    t: () => ({
      meta: L('Zváranie MIG/MAG', 'MIG/MAG welding'),
      name: L('Zváranie v ochrannom plyne', 'Gas metal arc welder'),
      model: 'Fronius TransPuls Synergic TPS 450',
      desc: L(
        'Poloautomatické zváranie drôtom v ochrannom plyne: synergický program podľa drôtu a plynu, štandardný aj impulzný oblúk, 2T / 4T, plynová fľaša a výlet drôtu.',
        'Semi-automatic welding with wire under shielding gas: synergic program by wire and gas, standard and pulsed arc, 2-step / 4-step, gas cylinder and stick-out.',
      ),
      specs: [
        L('Prúd 3 – 450 A', 'Current 3 – 450 A'),
        L('Drôt Ø0,8 – 1,2 mm', 'Wire Ø0.8 – 1.2 mm'),
        L('Ar + CO₂ / CO₂', 'Ar + CO₂ / CO₂'),
      ],
      note: L(
        'Obsahuje svetelné záblesky. Blikanie sa dá vypnúť v paneli (Efekty záblesku).',
        'Contains light flashes. Flicker can be turned off in the panel (Flash effects).',
      ),
    }),
  },
];
const SOON = [];
// moderné stroje: samostatné menu #moderne s vlastným vizuálom
const MODERN = [
  {
    id: 'hermle',
    Art: HermleArt,
    Comp: HermleSimulator,
    t: () => ({
      meta: L('5-osé obrábacie centrá', '5-axis machining centres'),
      name: 'Hermle C 32 U / C 42 U',
      model: 'Hermle C 32 U / C 42 U',
      desc: L(
        'Obrábanie podľa CNC programu: ISO / G-kód aj Heidenhain Klartext, programy z CAM, 3-osé, 3+2 aj simultánne 5-osé obrábanie s TCP, skutočný úber materiálu, kolízie, zaťaženie vretena a export obrobku do STL.',
        'Machining from a CNC program: ISO / G-code and Heidenhain conversational, programs from CAM, 3-axis, 3+2 and simultaneous 5-axis machining with TCP, real material removal, collisions, spindle load and part export to STL.',
      ),
      specs: [
        L('C 32: 650 / 650 / 500 mm, stôl Ø650', 'C 32: 650 / 650 / 500 mm, table Ø650'),
        L('C 42: 800 / 800 / 550 mm, stôl Ø800', 'C 42: 800 / 800 / 550 mm, table Ø800'),
        L('A ±130°, C 360° · TNC 640', 'A ±130°, C 360° · TNC 640'),
      ],
    }),
  },
  {
    id: 'roeders',
    Art: RoedersArt,
    Comp: RoedersSimulator,
    t: () => ({
      meta: L('5-osé HSC · QUADROGUIDE', '5-axis HSC · QUADROGUIDE'),
      name: 'Röders RXU 1001 DSH',
      model: 'Röders RXU 1001 DSH',
      desc: L(
        'Presné vysokorýchlostné frézovanie s priamymi pohonmi, obojstranne uloženým stolom A/C a štyrmi vedeniami osi Z. ISO program, skrinka nástrojov, úber materiálu a prehliadka obrobku.',
        'Precision high-speed milling with direct drives, a two-sided A/C trunnion and four Z guideways. ISO program, tool cabinet, material removal and workpiece inspection.',
      ),
      specs: [
        '800 / 855 / 500 mm · Ø600 mm',
        'A ±115° · C 360°',
        L('24 000 ot/min · HSK-A63 · 24 miest', '24,000 rpm · HSK-A63 · 24 pockets'),
      ],
    }),
  },
  // Retained, including its simulator and saved data; unavailable in the public UI.
  {
    id: 'shuangli',
    hidden: true,
    Art: ShuangliArt,
    Comp: ShuangliSimulator,
    t: () => ({
      meta: L('CNC hĺbkové vŕtanie', 'CNC deep hole drilling'),
      name: 'ShuangliCNC ZJA13-2013F',
      model: 'ZJA13-2013F · Siemens Edition',
      desc: L(
        'Vodorovné vŕtanie s dlhým jednobritým vrtákom, vodiacimi podperami a tlakovým chladením. Posuvné presklené dvere, odkrytý mechanizmus, živé HMI a export modelu aj obrobku. Vizuálna rekonštrukcia podľa rodiny ZJA13.',
        'Horizontal drilling with a long single-lip drill, guide supports and pressure coolant. Glazed sliding doors, exposed mechanism, live HMI and machine/workpiece export. Visual reconstruction of the ZJA13 family.',
      ),
      specs: [
        L('3 osi · vodorovné vreteno', '3 axes · horizontal spindle'),
        'Siemens Edition',
        L('Parametre výučbového modelu v info', 'Training model parameters in info'),
      ],
    }),
  },
  {
    id: 'oscarmax',
    Art: OscarArt,
    Comp: OscarSimulator,
    t: () => ({
      meta: L('Hĺbiaca elektroerózia', 'Die-sinking EDM'),
      name: 'OSCARMAX EX 500',
      model: 'OSCARMAX EX 500',
      desc: L(
        'Tvarová medená elektróda hĺbi dutiny v oceli bez otáčania. Pohyblivý stĺp, dielektrická nádrž, výplach a generátor 60 A. Viac operácií, aktuálna geometria dutín a export prerušeného procesu.',
        'A shaped copper electrode sinks cavities in steel without rotation. Moving column, dielectric tank, flushing and 60 A generator. Multiple operations, actual cavity geometry and paused-process export.',
      ),
      specs: ['500 / 400 / 450 mm', '850 × 450 mm · 2 300 kg', '60 A · 10 kVA · 850 l'],
    }),
  },
  {
    id: 'bystronic',
    Art: BystronicArt,
    Comp: BystronicSimulator,
    t: () => ({
      meta: L('CNC ohraňovací lis', 'CNC press brake'),
      name: 'Bystronic Xpert Pro 320',
      model: 'Xpert Pro 320/4300',
      desc: L(
        'Ohýbanie plechu do V-matrice: synchronizovaný baran, zadné dorazy X/R/Z, predné podpery a mobilné dotykové HMI. Nastavenie materiálu, nástrojov, uhla a kontrola lisovacej sily.',
        'Air bending in a V-die: synchronised ram, X/R/Z back gauges, front supports and a mobile touch HMI. Material, tooling and angle setup with bending-force checks.',
      ),
      specs: [
        '3 200 kN · 4 300 mm',
        L('Zdvih 250 mm · otvorenie 640 mm', '250 mm stroke · 640 mm open height'),
        L('Zadný doraz do 1 050 mm', 'Back gauge up to 1,050 mm'),
      ],
    }),
  },
];

// podpora WebGL – bez nej sa 3D scéna nedá vytvoriť
let webglOk = null;
const hasWebGL = () => {
  if (webglOk !== null) return webglOk;
  try {
    const cv = document.createElement('canvas'),
      gl = window.WebGLRenderingContext && (cv.getContext('webgl2') || cv.getContext('webgl'));
    webglOk = !!gl;
    if (gl) {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } // skúšobný kontext hneď uvoľniť
  } catch (err) {
    webglOk = false;
  }
  return webglOk;
};

// návod pri chýbajúcom WebGL: ako zapnúť akceleráciu grafiky alebo kde stiahnuť aktuálny prehliadač
const BROWSERS = [
  ['Chrome', 'https://www.google.com/chrome/'],
  ['Firefox', 'https://www.mozilla.org/firefox/new/'],
  ['Edge', 'https://www.microsoft.com/edge/download'],
];
function WebGLHelp() {
  return (
    <div className="text-sm" style={{ lineHeight: 1.5 }}>
      <ul className="ctl-list" style={{ marginTop: 6 }}>
        <li>
          <b>Chrome / Edge:</b>{' '}
          {L(
            'Nastavenia → Systém → zapni „Použiť grafickú akceleráciu, keď je k dispozícii“ a reštartuj prehliadač.',
            'Settings → System → turn on “Use graphics acceleration when available” and restart the browser.',
          )}
        </li>
        <li>
          <b>Firefox:</b>{' '}
          {L(
            'Nastavenia → Všeobecné → Výkon → zruš „Použiť odporúčané nastavenia výkonu“ a zapni „Použiť hardvérovú akceleráciu, ak je dostupná“.',
            'Settings → General → Performance → untick “Use recommended performance settings” and tick “Use hardware acceleration when available”.',
          )}
        </li>
        <li>
          <b>Safari:</b>{' '}
          {L(
            'WebGL je zapnuté v aktuálnej verzii macOS / iOS – aktualizuj systém.',
            'WebGL is on in current macOS / iOS – update the system.',
          )}
        </li>
        <li>
          {L('Pomôcť môže aj aktualizácia ovládača grafickej karty.', 'Updating the graphics driver can also help.')}
        </li>
      </ul>
      <p className="mt-2">
        {L('Alebo stiahni aktuálny prehliadač:', 'Or download a current browser:')}{' '}
        {BROWSERS.map(([n, u], i) => (
          <span key={n}>
            {i ? ' · ' : ''}
            <a
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
            >
              {n}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}

// zachytí chybu pri stavbe alebo behu simulátora – namiesto prázdnej stránky zobrazí hlášku a cestu späť
class SimBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err) {
    try {
      console.error(err);
    } catch (e) {
      /* ignorované */
    }
  }
  render() {
    if (!this.state.err) return this.props.children;
    const gl = hasWebGL();
    const msg = String((this.state.err && this.state.err.message) || this.state.err);
    const net = /dynamically imported module|Importing a module script failed|Failed to fetch|error loading/i.test(msg);
    return (
      <main className="menu">
        <div className="menu-inner">
          <p className="menu-kicker">Real machine tools</p>
          <h1 className="menu-title" tabIndex={-1}>
            {L('Simulátor sa nepodarilo spustiť', 'The simulator could not start')}
          </h1>
          <p className="menu-lead">
            {net
              ? L(
                  'Súbor simulátora sa nepodarilo stiahnuť – skontroluj pripojenie na internet a stránku načítaj znova.',
                  'The simulator file could not be downloaded – check your internet connection and reload the page.',
                )
              : gl
                ? L(
                    'Pri stavbe 3D scény nastala chyba. Skús stránku načítať znova; ak sa chyba opakuje, skús iný prehliadač.',
                    'An error occurred while building the 3D scene. Try reloading the page; if it happens again, try another browser.',
                  )
                : L(
                    'Prehliadač nepodporuje WebGL alebo je v ňom vypnutá hardvérová akcelerácia grafiky. Zapni ju alebo použi aktuálny prehliadač:',
                    'The browser does not support WebGL or hardware graphics acceleration is turned off. Turn it on or use a current browser:',
                  )}
          </p>
          {!net && !gl && (
            <div className="desc" style={{ maxWidth: '62ch' }}>
              <WebGLHelp />
            </div>
          )}
          <p className="text-xs muted mt-3" style={{ fontFamily: 'var(--f-mono)' }}>
            {msg}
          </p>
          <div className="flex gap-2 mt-6 flex-wrap">
            <button type="button" className="btn" onClick={this.props.onBack}>
              ← {L('Späť do menu', 'Back to menu')}
            </button>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              {L('Načítať znova', 'Reload')}
            </button>
          </div>
        </div>
      </main>
    );
  }
}

// upozornenie o ochranných známkach – názvy a logá slúžia len na identifikáciu predlohy
function TrademarkNote() {
  return (
    <p className="text-xs muted mt-2">
      {L(
        'Názvy a logá strojov sú ochranné známky ich vlastníkov a slúžia len na identifikáciu predlohy. Projekt nie je spojený s výrobcami; modely sú výučbové rekonštrukcie, nie výrobná dokumentácia.',
        'Machine names and logos are trademarks of their owners and only identify the original. The project is not affiliated with the manufacturers; the models are training reconstructions, not production documentation.',
      )}
    </p>
  );
}

// uloží všetky stroje do offline pamäte (service worker); bez podpory alebo vo vývoji sa nezobrazí
function OfflineSave() {
  const supported = import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!supported) return undefined;
    const on = (e) => {
      if (e.data?.type === 'cache-all-progress') setState({ done: e.data.done, total: e.data.total });
      if (e.data?.type === 'cache-all-done') setState(e.data.ok ? 'ok' : 'error');
    };
    navigator.serviceWorker.addEventListener('message', on);
    return () => navigator.serviceWorker.removeEventListener('message', on);
  }, [supported]);
  if (!supported) return null;
  const save = () => {
    setState({ done: 0, total: 0 });
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ type: 'cache-all' }))
      .catch(() => setState('error'));
  };
  const busy = state && typeof state === 'object';
  return (
    <p className="text-xs muted mt-3 flex items-center gap-3 flex-wrap">
      <button type="button" className="btn" disabled={busy} onClick={save}>
        {L('Uložiť všetky stroje pre offline', 'Save all machines for offline use')}
      </button>
      <span role="status">
        {busy
          ? L(`Ukladá sa… ${state.done} / ${state.total || '…'}`, `Saving… ${state.done} / ${state.total || '…'}`)
          : state === 'ok'
            ? L('Všetky stroje fungujú aj bez internetu.', 'All machines now work offline.')
            : state === 'error'
              ? L('Uloženie sa nepodarilo – skontroluj pripojenie.', 'Saving failed – check the connection.')
              : L('Otvorené stroje sa ukladajú automaticky.', 'Opened machines are saved automatically.')}
      </span>
    </p>
  );
}

function Menu({ onOpen }) {
  const [gl] = useState(hasWebGL);
  const [hideGl, setHideGl] = useState(false);
  return (
    <main className="menu">
      <div className="menu-inner">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="menu-kicker">Real machine tools</p>
          <PrefBar />
        </div>
        <h1 className="menu-title" tabIndex={-1}>
          {L('Simulátory obrábacích a tvárniacich strojov', 'Machine tool and forming simulators')}
        </h1>
        <p className="menu-lead">
          {L(
            'Vyber stroj. Každý model je zostavený v 3D, dá sa otáčať, rezať v ňom a v režime ručného ovládania sa obsluhuje kolesami, pákami a tlačidlami ako skutočný stroj.',
            'Choose a machine. Every model is built in 3D; you can orbit it, cut with it and, in manual mode, operate it with handwheels, levers and buttons like the real thing.',
          )}
        </p>
        {!gl && !hideGl && (
          <div
            className="msg-warn"
            role="note"
            style={{
              maxWidth: '68ch',
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 9,
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <b>
                {L('Upozornenie: prehliadač nehlási podporu WebGL', 'Notice: the browser reports no WebGL support')}
              </b>
              <button
                type="button"
                className="btn"
                style={{ padding: '2px 8px' }}
                onClick={() => setHideGl(true)}
                aria-label={L('Skryť upozornenie', 'Hide notice')}
              >
                ✕
              </button>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
              {L(
                '3D simulátory ho potrebujú. Skús stroj aj tak otvoriť – ak sa nespustí, zapni hardvérovú akceleráciu alebo použi iný prehliadač.',
                'The 3D simulators need it. Try opening a machine anyway – if it does not start, turn on hardware acceleration or use another browser.',
              )}
            </p>
            <div style={{ color: 'var(--text)' }}>
              <WebGLHelp />
            </div>
          </div>
        )}
        <button type="button" className="modern-banner mt-8" onClick={() => onOpen('moderne')}>
          <span className="modern-banner-art">
            <PrecisionArt />
          </span>
          <span className="modern-banner-body">
            <span className="modern-kicker">{L('Nová kategória', 'New category')}</span>
            <span className="modern-banner-title">
              {L('Moderné stroje: obrábanie, elektroerózia a tvárnenie', 'Modern machines: machining, EDM & forming')}
            </span>
            <span className="text-sm" style={{ opacity: 0.85 }}>
              {L(
                'Moderné CNC technológie: 5-osé frézovanie, presné obrábanie, hĺbiaca elektroerózia a CNC ohraňovanie plechu v spoločnom prostredí simulátorov.',
                'Modern CNC technology: 5-axis milling, precision machining, die-sinking EDM and CNC press braking in a shared simulator environment.',
              )}
            </span>
          </span>
          <span className="modern-banner-cta">{L('Otvoriť →', 'Open →')}</span>
        </button>
        <h2 className="sec-title" style={{ fontSize: 15, marginTop: 34 }}>
          {L('Konvenčné stroje', 'Conventional machines')}
        </h2>
        <div className="grid gap-5 mt-4 md:grid-cols-2 xl:grid-cols-3">
          {MACHINES.filter((m) => !m.hidden).map((m) => {
            const tx = m.t();
            return (
              <button key={m.id} type="button" className="card" onClick={() => onOpen(m.id)}>
                <div className="card-art">
                  <m.Art />
                </div>
                <div className="card-body">
                  <span className="card-meta">{tx.meta}</span>
                  <span className="card-name">{tx.name}</span>
                  <span className="text-sm muted" style={{ lineHeight: 1.45 }}>
                    {tx.desc}
                  </span>
                  <span className="text-sm">
                    <span className="muted">{L('Predloha', 'Modelled after')}:</span> <b>{tx.model}</b>
                  </span>
                  <span className="spec">
                    {tx.specs.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </span>
                  {tx.note && (
                    <span className="text-xs" style={{ color: 'var(--warn)' }}>
                      ⚠ {tx.note}
                    </span>
                  )}
                  <span className="card-cta">{L('Spustiť simulátor →', 'Open simulator →')}</span>
                </div>
              </button>
            );
          })}
        </div>
        {SOON.length > 0 && (
          <h2 className="sec-title mb-4" style={{ fontSize: 15, marginTop: 40 }}>
            {L('Pripravujeme', 'Coming soon')}
          </h2>
        )}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {SOON.map((m) => {
            const tx = m.t();
            return (
              <div key={m.id} className="card soon" aria-disabled="true">
                <div className="card-art">
                  <m.Art />
                </div>
                <div className="card-body">
                  <span className="card-meta">{tx.meta}</span>
                  <span className="card-name">{tx.name}</span>
                  <span className="text-sm muted" style={{ lineHeight: 1.45 }}>
                    {tx.desc}
                  </span>
                  <span className="mt-auto pt-2">
                    <span className="badge">{L('Pripravujeme', 'Coming soon')}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs muted mt-8">
          {L(
            'Mierka modelov 1 : 100 mm · ovládanie myšou alebo dotykom · kláves M prepína na ručné ovládanie prvkov stroja · raz otvorený simulátor funguje aj bez internetu, aplikácia sa dá nainštalovať.',
            'Model scale 1 : 100 mm · mouse or touch control · the M key switches to manual control of the machine elements · a simulator opened once also works offline; the app can be installed.',
          )}
        </p>
        <OfflineSave />
        <TrademarkNote />
      </div>
    </main>
  );
}

function ModernMenu({ onOpen, onBack }) {
  return (
    <main className="menu modern-menu">
      <div className="menu-inner">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button type="button" className="modern-back" onClick={onBack}>
            ← {L('Konvenčné stroje', 'Conventional machines')}
          </button>
          <PrefBar />
        </div>
        <p className="modern-kicker mt-8">Real machine tools · {L('Moderné stroje', 'Modern machines')}</p>
        <h1 className="menu-title modern-title" tabIndex={-1}>
          {L('Obrábanie, elektroerózia a tvárnenie', 'Machining, EDM & forming')}
        </h1>
        <p className="menu-lead">
          {L(
            'Moderné výrobné technológie v spoločnom rozhraní. Vyber dostupný stroj, priprav nástroj a program a sleduj jeho pracovný proces v 3D.',
            'Modern manufacturing technologies in a shared interface. Select an available machine, prepare a tool and program, and explore its working process in 3D.',
          )}
        </p>
        <div className="modern-category-visual">
          <PrecisionArt />
          <div>
            <span>01 · CNC</span>
            <span>02 · HSC</span>
            <span>03 · EDM</span>
            <span>04 · {L('OHÝBANIE', 'BENDING')}</span>
          </div>
        </div>
        <div className="modern-machine-grid grid gap-6 mt-8 lg:grid-cols-2">
          {MODERN.filter((m) => !m.hidden).map((m) => {
            const tx = m.t();
            return (
              <button key={m.id} type="button" className="card modern-card" onClick={() => onOpen(m.id)}>
                <div className="card-art">
                  <m.Art />
                </div>
                <div className="card-body">
                  <span className="card-meta">{tx.meta}</span>
                  <span className="card-name">{tx.name}</span>
                  <span className="text-sm muted" style={{ lineHeight: 1.5 }}>
                    {tx.desc}
                  </span>
                  <span className="spec">
                    {tx.specs.map((sp) => (
                      <span key={sp}>{sp}</span>
                    ))}
                  </span>
                  <span className="card-cta">{L('Spustiť simulátor →', 'Open simulator →')}</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs muted mt-8">
          {L(
            'Simulácia je výučbová – rozmery a dynamika stroja vychádzajú z katalógových údajov, riadiaci systém je zjednodušený.',
            'The simulation is for training – machine dimensions and dynamics follow catalogue data, the control is simplified.',
          )}
        </p>
        <TrademarkNote />
      </div>
    </main>
  );
}

function App() {
  const readRoute = () => {
    try {
      return (window.location.hash || '').replace('#', '');
    } catch (err) {
      return '';
    }
  };
  const [route, setRoute] = useState(readRoute);
  const [prefs, setPrefs] = useState({ ...PREFS });
  const moved = useRef(false);
  const setPref = (k, v) => {
    PREFS[k] = v;
    const n = { ...PREFS };
    setPrefs(n);
    try {
      localStorage.setItem('rmt-prefs', JSON.stringify(n));
    } catch (err) {
      /* bez uloženia */
    }
    try {
      document.documentElement.dataset.skin = n.skin;
      document.documentElement.lang = n.lang;
    } catch (err) {
      /* ignorované */
    }
    if (k === 'sound') setSoundOn(v);
  };
  useEffect(() => {
    const sync = () => {
      moved.current = true;
      setRoute(readRoute());
    };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  useEffect(() => {
    document.title = L('Simulátory obrábacích strojov', 'Machine tool simulators');
  }, [prefs.lang]);
  // po prechode menu ↔ stroj presunie fokus na hlavný nadpis (čítačky obrazovky, klávesnica)
  useEffect(() => {
    if (!moved.current) return undefined;
    // simulátor sa načítava postupne – počká sa, kým sa nadpis objaví (najviac ~5 s)
    let n = 0,
      raf = 0;
    const tryFocus = () => {
      const h = document.querySelector('.app-title, .menu-title');
      if (h) {
        try {
          h.focus({ preventScroll: true });
        } catch (err) {
          /* ignorované */
        }
      } else if (n++ < 300) raf = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, [route]);
  const go = (id) => {
    moved.current = true;
    setRoute(id);
    try {
      if (id) window.location.hash = id;
      else window.history.pushState('', document.title, window.location.pathname + window.location.search);
    } catch (err) {
      /* ignorované */
    }
    window.scrollTo(0, 0);
  };
  // #stroj alebo #stroj/uloha=… (odkaz učiteľa na konkrétnu úlohu)
  const [mid, query = ''] = route.split('/');
  const entry = MODERN.find((x) => x.id === mid),
    mm = entry?.hidden ? null : entry,
    m = mm || MACHINES.find((x) => x.id === mid);
  const modernMenu = mid === 'moderne' || !!entry?.hidden;
  const modern = modernMenu || !!mm;
  // moderné stroje majú vlastný vizuál – nastaví sa pred vytvorením 3D scény (useLayoutEffect beží skôr)
  useLayoutEffect(() => {
    try {
      if (modern) document.documentElement.dataset.mode = modernMenu ? 'modern-menu' : 'modern';
      else delete document.documentElement.dataset.mode;
      document.documentElement.dataset.machine = mid;
    } catch (err) {
      /* ignorované */
    }
  }, [modern, modernMenu, mid]);
  const params = Object.fromEntries(new URLSearchParams(query));
  return (
    <PrefsCtx.Provider value={{ prefs, setPref }}>
      {m ? (
        <SimBoundary key={m.id} onBack={() => go(mm ? 'moderne' : '')}>
          <Suspense fallback={<SimLoading />}>
            <m.Comp lang={prefs.lang} params={params} onBack={() => go(mm ? 'moderne' : '')} />
          </Suspense>
        </SimBoundary>
      ) : modernMenu ? (
        <ModernMenu onOpen={go} onBack={() => go('')} />
      ) : (
        <Menu onOpen={go} />
      )}
    </PrefsCtx.Provider>
  );
}

export default App;
