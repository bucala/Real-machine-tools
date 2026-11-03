import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL, REDUCED_MOTION } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { baseMats, makeKit, std } from '../core/kit';
import { createParticles } from '../core/particles';
import { LIGHT_K, createStage } from '../core/stage';
import { TAU, clamp, logNear } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { exportStl } from '../core/export';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection } from '../ui/tools';
import { buildFronius } from './fronius';
import { MIG_GASES, MIG_WIRES, MODE_NAMES, gasCover, migRange, migSynergic, stickoutI } from './migMath';
import { migChecks, weldChecks } from './shopMath';
import { HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// OBLÚKOVÉ ZVÁRANIE – TRANSFORMÁTOROVÁ ZVÁRAČKA ELEKTROKOV JS 90FN
// =====================================================================
const WELD_TT = 8.0;                                                    // výška zváracieho stola
const WELD_DIAL = [55, 70, 80, 90, 100, 120, 155];                     // stupne prúdu na stupnici
const WELD_DIAL_ANG = WELD_DIAL.map((_, i) => 2.0 - i * 4.0 / 6);
const WELD_MODES = [['off', '0'], ['w380', '380 V'], ['w220', '220 V'], ['charge', 'NAB.']];
const WELD_MODE_ANG = [1.25, 0.45, -0.35, -1.15];
const ELECTRODES = {
  rutile: { sk: 'Rutilová E 6013', en: 'Rutile E 6013', r: { 2: [40, 70], 2.5: [55, 95], 3.2: [80, 135], 4: [120, 180] } },
  basic: { sk: 'Bázická E 7018', en: 'Basic E 7018', r: { 2.5: [65, 105], 3.2: [95, 145], 4: [130, 190] } },
};
const WELD_TYPES = [
  { id: 'I', sk: 'Zvar I', en: 'Square butt', t: [1, 4], sym: 'M11 4v16M19 4v16' },
  { id: 'V', sk: 'Zvar V', en: 'Single-V', t: [4, 16], sym: 'M7 4l8 16 8-16' },
  { id: 'HV', sk: 'Zvar ½ V', en: 'Single-bevel', t: [4, 16], sym: 'M11 4v16l10-16' },
  { id: 'Y', sk: 'Zvar Y', en: 'Y butt', t: [6, 20], sym: 'M7 4l8 9 8-9M15 13v7' },
  { id: 'U', sk: 'Zvar U', en: 'Single-U', t: [12, 30], sym: 'M8 4v5a7 7 0 0 0 14 0V4M15 16v4' },
  { id: 'J', sk: 'Zvar J', en: 'Single-J', t: [12, 30], sym: 'M11 4v16M11 15a7 7 0 0 0 9-7V4' },
  { id: 'K', sk: 'Kútový', en: 'Fillet (T)', t: [2, 25], sym: 'M8 20h14L8 6z' },
  { id: 'L', sk: 'Presahový', en: 'Lap', t: [2, 10], sym: 'M6 14h18M6 18h18' },
  { id: 'E', sk: 'Lemový', en: 'Edge', t: [1, 3], sym: 'M8 6q0 10 6 12M22 6q0 10-6 12' },
  { id: 'N', sk: 'Návar', en: 'Build-up', t: [4, 30], sym: 'M5 10a5 5 0 0 0 10 0a5 5 0 0 0 10 0' },
];
// polohy zvárania podľa EN ISO 6947 (v zátvorke ASME): plechy PA – PG, rúry PH, PJ, H-L045
const WELD_POS = [
  ['PA', '1G/1F', 'vodorovná zhora', 'flat'], ['PB', '2F', 'vodorovná – zvislá', 'horizontal-vertical'], ['PC', '2G', 'vodorovná na stene', 'horizontal'],
  ['PD', '4F', 'nad hlavou – zvislá', 'horizontal-overhead'], ['PE', '4G/4F', 'nad hlavou', 'overhead'], ['PF', '3G/3F', 'zvislá nahor', 'vertical up'], ['PG', '3G/3F', 'zvislá nadol', 'vertical down'],
];
const WELD_POS_PIPE = [['PH', '5G'], ['PJ', '5G'], ['H-L045', '6G']];
const FILLETS = ['K', 'L'];
// zvarová príprava podľa druhu a hrúbky (mm, polovičný uhol úkosu v °)
const weldPrep = (id, t) => {
  if (id === 'I') return { gap: clamp(t * 0.5, 0.5, 2), root: t, ang: 0 };
  if (id === 'V') return { gap: 2, root: t > 8 ? 2 : 1.5, ang: 30 };
  if (id === 'HV') return { gap: 2, root: 1.5, ang: 45 };
  if (id === 'Y') return { gap: 1.5, root: clamp(t * 0.35, 2, 6), ang: 30 };
  if (id === 'U') return { gap: 1, root: 2, ang: 8, R: 4 };
  if (id === 'J') return { gap: 1, root: 2, ang: 10, R: 5 };
  return { gap: 0, root: t, ang: 0 };
};
const weldProfile = (id, t, p) => {
  const g2 = p.gap / 2, ta = Math.tan(Math.max(1, p.ang) * Math.PI / 180);
  const vee = (u) => Math.min(t, p.root + Math.max(0, u - g2) / ta);
  const ucup = (u) => { const R = p.R; if (u <= R) return Math.min(t, p.root + R - Math.sqrt(Math.max(0, R * R - u * u))); return Math.min(t, p.root + R + (u - R) / ta); };
  return (z) => {
    const u = Math.abs(z);
    switch (id) {
      case 'I': return u < g2 ? 0 : t;
      case 'V': case 'Y': return u < g2 ? 0 : vee(u);
      case 'HV': return u < g2 ? 0 : z > 0 ? vee(u) : t;
      case 'U': return u < g2 ? 0 : ucup(u);
      case 'J': return u < g2 ? 0 : z > 0 ? ucup(u) : t;
      case 'K': return u < t / 2 ? t + 60 : t;
      case 'L': return z < 0 ? t : 2 * t;
      case 'E': return u < 0.4 ? 2.6 * t : u <= t + 0.4 ? 3 * t : t;
      default: return t;
    }
  };
};
const weldParts = () => mkParts([
  ['zvaracka', 'Zváračka', 'Welder', 'Transformátorová zváračka', 'Transformer welder', 'Elektrokov JS 90FN: rozptylový transformátor so stupňami prúdu 55 – 155 A. Prepínač 380 V / 220 V / nabíjanie; pri 220 V najviac 75 A, inak vypadne istič.', 'Elektrokov JS 90FN: leakage transformer with current steps 55 – 155 A. Switch 380 V / 220 V / charging; on 220 V at most 75 A, otherwise the breaker trips.'],
  ['drziak', 'Držiak elektródy', 'Electrode holder', 'Držiak elektródy s káblom', 'Electrode holder and lead', 'Izolovaný držiak so svorkou na elektródu. Vedie sa pravým tlačidlom myši, oblúk sa zapáli ľavým tlačidlom pri držanom pravom.', 'Insulated holder clamping the electrode. It is guided with the right mouse button; the arc strikes with the left button while the right is held.'],
  ['svorka', 'Zemniaca svorka', 'Ground clamp', 'Zemniaca svorka', 'Ground clamp', 'Uzatvára zvárací obvod cez stôl a zvarenec. Bez pripojenej zeme sa oblúk nezapáli.', 'Closes the welding circuit through the table and the work. Without it the arc will not strike.'],
  ['stol', 'Zvárací stôl', 'Welding table', 'Zvárací stôl s prípravkom', 'Welding table and fixture', 'Oceľový stôl; pre polohy PC, PF a PE drží zvarenec stojan s upínačom.', 'Steel table; for positions PC, PF and PE a stand with a clamp holds the work.'],
  ['zvarenec', 'Zvarenec', 'Weldment', 'Zvarenec s úkosmi', 'Weldment with preparation', 'Diely pripravené podľa druhu zvaru a hrúbky: medzera, otupenie a úkos. Húsenica sa tvorí podľa prúdu, rýchlosti posuvu a dĺžky oblúka.', 'Parts prepared for the chosen joint and thickness: gap, root face and bevel. The bead forms according to current, travel speed and arc length.'],
]);

const migParts = () => mkParts([
  ['zdroj', 'Zdroj TPS 450', 'TPS 450 source', 'Invertorový zdroj Fronius TransPuls Synergic TPS 450', 'Fronius TransPuls Synergic TPS 450 inverter source', 'Digitálne riadený zdroj 3 – 450 A. Synergia: k zvolenej rýchlosti drôtu nastaví prúd a napätie podľa programu (drôt, plyn), korekciou sa dolaďuje dĺžka oblúka. Režimy štandard a impulz, 2-takt a 4-takt.', 'Digitally controlled source 3 – 450 A. Synergic: for the chosen wire speed it sets current and voltage from the program (wire, gas); the arc length is fine-tuned by the correction. Standard and pulse modes, 2-step and 4-step.'],
  ['podavac', 'Podávač drôtu', 'Wire feeder', 'Podávač drôtu VR 4000', 'VR 4000 wire feeder', 'Cievka s drôtom a štvorkladkový podávač; drôt ide cez hadicové vedenie do horáka. Spúšťač na horáku zapne plyn, podávanie a prúd naraz.', 'Wire spool and four-roll drive; the wire runs through the hose pack to the torch. The torch trigger switches gas, wire feed and current together.'],
  ['chladenie', 'Chladiaci modul', 'Cooling unit', 'Chladiaci modul FK', 'FK cooling unit', 'Čerpá chladiacu kvapalinu do horáka – pri vysokých prúdoch sa horák neprehrieva.', 'Pumps coolant to the torch so that it does not overheat at high currents.'],
  ['flasa', 'Plynová fľaša', 'Gas cylinder', 'Fľaša s ochranným plynom a redukčným ventilom', 'Shielding gas cylinder and regulator', 'Ochranný plyn chráni kúpeľ pred vzduchom. Bežne Ar + 18 % CO₂ (M21) s prietokom 12 – 16 l/min. Bez plynu je zvar pórovitý.', 'The shielding gas protects the pool from air. Usually Ar + 18 % CO₂ (M21) at 12 – 16 l/min. Without gas the weld is porous.'],
  ['horak', 'Horák MIG/MAG', 'MIG/MAG torch', 'Zvárací horák s hadicovým vedením', 'Welding torch and hose pack', 'Plynová hubica, kontaktná špička a drôt. Výlet drôtu (vzdialenosť špičky od dielu) 10 – 15 mm. Vedie sa pravým tlačidlom myši, spúšťač je ľavé tlačidlo.', 'Gas nozzle, contact tip and wire. Contact tip to work distance 10 – 15 mm. Guided with the right mouse button, the left button is the trigger.'],
  ['svorka', 'Zemniaca svorka', 'Ground clamp', 'Zemniaca svorka', 'Ground clamp', 'Uzatvára zvárací obvod cez stôl a zvarenec.', 'Closes the welding circuit through the table and the work.'],
  ['stol', 'Zvárací stôl', 'Welding table', 'Zvárací stôl s prípravkom', 'Welding table and fixture', 'Oceľový stôl; pre polohy PC, PF a PE drží zvarenec stojan s upínačom.', 'Steel table; for positions PC, PF and PE a stand with a clamp holds the work.'],
  ['zvarenec', 'Zvarenec', 'Weldment', 'Zvarenec s úkosmi', 'Weldment with preparation', 'Diely pripravené podľa druhu zvaru a hrúbky. Pri MAG zváraní plným drôtom nevzniká troska.', 'Parts prepared for the chosen joint and thickness. MAG welding with solid wire leaves no slag.'],
]);
const MIG_TASKS = [
  { id: 'mvpa', title: () => L('MAG: tupý zvar V, plech 8 mm, PA', 'MAG: single-V butt weld, 8 mm, PA'),
    desc: () => L('Zvar V na plechoch 8 mm vo vodorovnej polohe. Drôt Ø1,0, plyn M21 s prietokom 12 – 16 l/min, výlet drôtu 10 – 15 mm. Koreň aj výplň skratovým prenosom (rýchlosť drôtu 6 – 9 m/min), úkos vyplň celý.', 'Single-V weld on 8 mm plates in the flat position. Ø1.0 wire, M21 gas at 12 – 16 l/min, 10 – 15 mm stick-out. Root and fill with a short arc (wire speed 6 – 9 m/min), fill the whole groove.'),
    setup: { wType: 'V', wT: 8, wPos: 'PA', wire: 1, gas: 'M21', vd: 8, corr: 0, prog: 'std', flow: 14, valve: true, ctwd: 12 },
    labels: { setup: () => L('Zvar V, 8 mm, poloha PA', 'V joint, 8 mm, position PA'), fill: () => L('Úkos vyplnený (≥ 90 %)', 'Groove filled (≥ 90 %)'), cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'), off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'), flaws: () => L('Bez chýb (studený spoj, rýchly posuv, stekanie)', 'No defects (cold lap, fast travel, sagging)'), por: () => L('Bez pórov (plynová ochrana)', 'No porosity (gas shielding)') } },
  { id: 'mkpb', title: () => L('MAG: kútový zvar, plech 8 mm, PB', 'MAG: fillet weld, 8 mm, PB'),
    desc: () => L('Kútový zvar T-spoja v polohe PB, šírka húsenice aspoň 6 mm. Drôt Ø1,0 alebo Ø1,2, plyn M21, rýchlosť drôtu 8 – 10 m/min.', 'Fillet weld of a T-joint in position PB, bead at least 6 mm wide. Ø1.0 or Ø1.2 wire, M21 gas, wire speed 8 – 10 m/min.'),
    setup: { wType: 'K', wT: 8, wPos: 'PB', wire: 1, gas: 'M21', vd: 9, corr: 0, prog: 'std', flow: 14, valve: true, ctwd: 12 },
    labels: { setup: () => L('Kútový zvar, 8 mm, poloha PB', 'Fillet weld, 8 mm, position PB'), width: () => L('Šírka húsenice ≥ 6 mm', 'Bead width ≥ 6 mm'), cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'), off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'), flaws: () => L('Bez chýb', 'No defects'), por: () => L('Bez pórov', 'No porosity') } },
  { id: 'mtenky', title: () => L('MAG: tenký plech 2 mm, zvar I, PA', 'MAG: thin 2 mm sheet, square butt, PA'),
    desc: () => L('Zvar I na plechoch 2 mm. Drôt Ø0,8, nízka rýchlosť drôtu (4 – 6 m/min), rýchlejší posuv bez zastavenia – pri vysokom prúde hrozí prepálenie.', 'Square butt on 2 mm sheets. Ø0.8 wire, low wire speed (4 – 6 m/min), faster steady travel – high current risks burning through.'),
    setup: { wType: 'I', wT: 2, wPos: 'PA', wire: 0.8, gas: 'M21', vd: 5, corr: 0, prog: 'std', flow: 12, valve: true, ctwd: 10 },
    labels: { setup: () => L('Zvar I, 2 mm, poloha PA', 'Square butt, 2 mm, position PA'), cur: () => L('Prúd primeraný hrúbke (do 110 A)', 'Current suited to the thickness (up to 110 A)'), cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'), off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'), flaws: () => L('Bez chýb', 'No defects'), por: () => L('Bez pórov', 'No porosity') } },
].map((t) => ({ ...t, checks: (m) => migChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const MIG_SAFETY = () => [
  L('Mám zváračskú kuklu (DIN 10 – 13), kožené rukavice a odev bez syntetiky.', 'I have a welding helmet (DIN 10 – 13), leather gloves and no synthetic clothing.'),
  L('Plynová fľaša je zaistená reťazou na vozíku.', 'The gas cylinder is chained to the trolley.'),
  L('Odsávanie dymu je zapnuté, v okolí nie sú horľaviny.', 'Fume extraction is on, there is nothing flammable around.'),
  L('Zemniaca svorka je na zvarenci, hadicové vedenie nie je zalomené.', 'The ground clamp is on the work, the hose pack is not kinked.'),
];

const WELD_TASKS = [
  { id: 'vpa', title: () => L('Tupý zvar V, plech 8 mm, poloha PA', 'Single-V butt weld, 8 mm plate, PA'),
    desc: () => L('Zvar V na plechoch hrúbky 8 mm vo vodorovnej polohe PA. Zvar celú dĺžku spoja, vyplň úkos, drž krátky oblúk a rovnomernú rýchlosť, potom otlč trosku. Elektróda rutilová Ø3,2, prúd 100 – 120 A.', 'Single-V weld on 8 mm plates in the flat position PA. Weld the whole joint length, fill the groove, keep a short arc and a steady speed, then chip the slag. Rutile Ø3.2 electrode, 100 – 120 A.'),
    setup: { wType: 'V', wT: 8, wPos: 'PA', etype: 'rutile', de: 3.2, current: 100 },
    labels: { setup: () => L('Zvar V, 8 mm, poloha PA', 'V joint, 8 mm, position PA'), fill: () => L('Úkos vyplnený (≥ 90 %)', 'Groove filled (≥ 90 %)'), cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'), off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'), flaws: () => L('Bez chýb (studený spoj, dlhý oblúk, rýchly posuv)', 'No defects (cold lap, long arc, fast travel)'), slag: () => L('Troska otlčená', 'Slag chipped off') } },
  { id: 'kpb', title: () => L('Kútový zvar, plech 8 mm, poloha PB', 'Fillet weld, 8 mm plate, PB'),
    desc: () => L('Kútový zvar T-spoja na plechoch 8 mm v polohe PB. Zvar celú dĺžku so šírkou húsenice aspoň 6 mm, potom otlč trosku. Elektróda rutilová Ø3,2, prúd 110 – 120 A.', 'Fillet weld of a T-joint on 8 mm plates in position PB. Weld the whole length with a bead at least 6 mm wide, then chip the slag. Rutile Ø3.2 electrode, 110 – 120 A.'),
    setup: { wType: 'K', wT: 8, wPos: 'PB', etype: 'rutile', de: 3.2, current: 120 },
    labels: { setup: () => L('Kútový zvar, 8 mm, poloha PB', 'Fillet weld, 8 mm, position PB'), width: () => L('Šírka húsenice ≥ 6 mm', 'Bead width ≥ 6 mm'), cov: () => L('Zvarená celá dĺžka (≥ 95 %)', 'Whole length welded (≥ 95 %)'), off: () => L('Materiál mimo spoja ≤ 15 %', 'Metal off the joint ≤ 15 %'), flaws: () => L('Bez chýb', 'No defects'), slag: () => L('Troska otlčená', 'Slag chipped off') } },
].map((t) => ({ ...t, checks: (m) => weldChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const WELD_SAFETY = () => [
  L('Mám zváračskú kuklu so správnym stupňom filtra (DIN 10 – 12).', 'I have a welding helmet with the right filter shade (DIN 10 – 12).'),
  L('Mám kožené rukavice, zástere a odev bez syntetiky.', 'I wear leather gloves, an apron and no synthetic clothing.'),
  L('Odsávanie dymu je zapnuté, v okolí nie sú horľaviny.', 'Fume extraction is on, there is nothing flammable around.'),
  L('Zemniaca svorka je pripojená priamo na zvarenec.', 'The ground clamp is attached directly to the workpiece.'),
];

function WeldingSimulator({ onBack, params, process = 'mma' }) {
  const MIG = process === 'mig';
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null), flashRef = useRef(null), glassRef = useRef(null);
  const init = { manual: false, mode: 'w380', current: 100, etype: 'rutile', de: 3.2, ground: true, helmet: false, helmetType: 'auto', shade: 11, adfDelay: 0.3, autoArc: true, arcLen: 3, handV: 6, wType: 'V', wPos: 'PA', wT: 8, wL: 150, tripped: false, slag: true, flashFx: !REDUCED_MOTION,
    ...(MIG ? { power: true, prog: 'std', trig: '2T', wire: 1, gas: 'M21', vd: 8, corr: 0, valve: true, flow: 14, ctwd: 12, handV: 8, slag: false } : {}) };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ arc: false, I: 0, la: 3, v: 0, le: 350, msg: null, stats: null, U: 0, mode: 'short', cover: 1, wire: 0 });

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey || tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'range')) return;
      if (e.key === 'h' || e.key === 'H') set('helmet', !ctl.current.helmet);
      if ((e.key === 'e' || e.key === 'E') && apiRef.current.newElectrode) apiRef.current.newElectrode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const TT = WELD_TT;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound(MIG ? 'mig' : 'weld');
    const dom = renderer.domElement;
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const M = {
      ...baseMats(0xf2cf1d, 0xd9b512, 0xb8970c),
      face: std(0xe4dfc8, 0.7, 0.05), table: std(0x4d5257, 0.55, 0.6), copper: std(0xc77b45, 0.35, 0.8), cable: std(0x18191a, 0.7, 0.05),
      rod: std(0xb9b39d, 0.75, 0.05), core: std(0x9aa1a7, 0.35, 0.85), handle: std(0x111213, 0.6, 0.05),
      arc: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      spatter: new THREE.MeshBasicMaterial({ color: 0xffa233, toneMapped: false }),
      smoke: new THREE.MeshBasicMaterial({ color: 0x9a9da1, transparent: true, opacity: 0.1, depthWrite: false }),
    };
    const kit = makeKit(M);
    const { add, box, cylY, cylZ, hitProxy, face } = kit;
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };

    // ---------- zvárací stôl ----------
    const tbl = grp('stol');
    box(tbl, -5, 5, TT - 0.25, TT, -3, 3, M.table);
    [[-4.6, -2.6], [4.6, -2.6], [-4.6, 2.6], [4.6, 2.6]].forEach(([x, z]) => box(tbl, x - 0.15, x + 0.15, 0, TT - 0.25, z - 0.15, z + 0.15, M.table));
    box(tbl, -4.6, 4.6, 1.0, 1.15, -2.6, 2.6, M.table);
    const fixture = new THREE.Group(); tbl.add(fixture);
    cylY(fixture, 0.18, 0.18, TT, TT + 4.2, 0, -1.6, M.steelDark, 20);
    box(fixture, -0.35, 0.35, TT, TT + 0.1, -1.95, -1.25, M.steelDark);

    // ---------- zváračka: Elektrokov JS 90FN (MMA) alebo Fronius TPS 450 (MIG/MAG) ----------
    let wel, sockW, knobI, knobM, breaker, brLever, fr = null;
    if (MIG) { fr = buildFronius({ kit, M, grp, v3, std }); wel = fr.wel; sockW = fr.sockW; } else {
    wel = grp('zvaracka'); wel.position.set(7.4, 0.9, 2.2); wel.rotation.y = -0.45;
    box(wel, -2.4, 2.4, 0, 2.5, -1.25, 1.25, M.green);                        // žltá skriňa
    box(wel, -2.45, 2.45, 2.42, 2.55, -1.3, 1.3, M.greenDark);
    [-1.9, 1.9].forEach((x) => box(wel, x - 0.3, x + 0.3, -0.9, 0, -0.9, 0.9, M.steelDark));   // podstavec / vozík
    for (let k = 0; k < 6; k++) box(wel, 2.4, 2.42, 0.4 + k * 0.28, 0.52 + k * 0.28, -0.8, 0.8, M.black);   // vetracie štrbiny
    const fp = face(wel, 0, 1.25, 1.25, 0);                                    // čelný panel (lokálna +Z von)
    box(fp, -2.2, 2.2, -1.1, 1.1, 0, 0.02, M.face);
    const panelCv = document.createElement('canvas'); panelCv.width = 880; panelCv.height = 440;
    const panelTex = new THREE.CanvasTexture(panelCv); panelTex.colorSpace = THREE.SRGBColorSpace; panelTex.anisotropy = 4;
    (() => {
      const g = panelCv.getContext('2d'), P = (x, y) => [(x + 2.2) * 200, (1.1 - y) * 200];
      g.fillStyle = '#e4dfc8'; g.fillRect(0, 0, 880, 440);
      g.fillStyle = '#c9c4ad'; for (let i = 0; i < 220; i++) g.fillRect(Math.random() * 880, Math.random() * 440, 2, 2);
      g.fillStyle = '#2b2b2b'; g.font = 'bold 40px Barlow, Arial'; g.fillText('ELEKTROKOV', ...P(-0.15, 0.62)); g.font = 'bold 46px Barlow, Arial'; g.fillText('JS 90FN', ...P(1.05, 0.62));
      g.font = 'bold 15px Barlow, Arial'; ['POZOR! PŘI 220V', 'SE SMÍ POUŽÍT NEJVYŠŠÍ', 'SVAŘOVACÍ PROUD 75A'].forEach((tx, i) => g.fillText(tx, ...P(-0.25, 0.08 - i * 0.1)));
      g.fillStyle = '#c0392b'; ['POZOR! PŘI SVAŘENÍ CHRAŇ', 'SVÁŘEČKU VHODNÝM', 'PŘÍSTŘEŠKEM!!'].forEach((tx, i) => g.fillText(tx, ...P(1.0, 0.08 - i * 0.1)));
      g.fillStyle = '#2b2b2b'; g.font = 'bold 22px Barlow, Arial';
      WELD_DIAL.forEach((v, i) => { const a = WELD_DIAL_ANG[i]; const [x, y] = P(-1.55 - Math.sin(a) * 0.5, 0.45 + Math.cos(a) * 0.5); g.fillText(String(v), x - 16, y + 8); });
      g.font = 'bold 17px Barlow, Arial';
      ['0', '380V', '220V', 'NABÍJ.'].forEach((tx, i) => { const a = WELD_MODE_ANG[i]; const [x, y] = P(-0.85 - Math.sin(a) * 0.42, -0.45 + Math.cos(a) * 0.42); g.fillText(tx, x - 18, y + 6); });
      g.fillText('SVAŘENÍ  NABÍJENÍ', ...P(-1.15, -0.95)); g.fillText('NABÍJENÍ', ...P(0.45, -0.95)); g.fillText('6A', ...P(1.05, -0.95));
      g.strokeStyle = '#a5402e'; g.lineWidth = 3; g.strokeRect(...P(0.3, -0.35), 260, 140);
      g.fillStyle = '#2b2b2b'; g.fillRect(...P(-2.15, -0.15), 860, 3);
    })();
    add(fp, new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.8 }), 0, 0, 0.021);
    // gombík prúdu a prepínač režimu (otočné páčky)
    const knob = (x, y, len) => {
      const pv = new THREE.Group(); pv.position.set(x, y, 0.03); fp.add(pv);
      cylZ(pv, 0.2, 0.18, 0, 0.12, 0, 0, M.black, 24);
      add(pv, new THREE.BoxGeometry(0.12, len, 0.16), M.black, 0, len * 0.3, 0.18);
      hitProxy(pv, 0.3, 0, 0, 0.15);
      return pv;
    };
    knobI = knob(-1.55, 0.45, 0.55); knobM = knob(-0.85, -0.45, 0.48);
    breaker = new THREE.Group(); breaker.position.set(-1.9, -0.6, 0.03); fp.add(breaker);
    box(breaker, -0.1, 0.1, -0.2, 0.2, 0, 0.06, M.white); brLever = box(breaker, -0.05, 0.05, -0.02, 0.15, 0.06, 0.12, M.black); hitProxy(breaker, 0.22, 0, 0, 0.05);
    box(fp, -0.35, 1.95, 0.3, 0.42, 0.03, 0.3, M.black); box(fp, -0.35, -0.2, 0.3, 0.42, 0.03, 0.3, M.black);   // rukoväť
    box(fp, -0.35, 1.95, 0.2, 0.42, 0.25, 0.32, M.black);
    [0.55, 0.8, 1.05].forEach((x) => cylZ(fp, 0.06, 0.06, 0, 0.12, x, -0.6, M.black, 12));
    const sockets = [1.5, 1.95].map((x) => { cylZ(fp, 0.17, 0.17, 0, 0.1, x, -0.6, M.black, 24); cylZ(fp, 0.07, 0.07, 0.1, 0.11, x, -0.6, M.copper, 16); return v3(x, -0.6, 0.12); });
    cylZ(fp, 0.1, 0.1, 0, 0.12, -0.45, -0.75, M.black, 16);                  // sieťový kábel
    sockW = sockets.map((p) => { wel.updateMatrixWorld(true); return fp.localToWorld(p.clone()); });
    const mains = new THREE.CatmullRomCurve3([fp.localToWorld(v3(-0.45, -0.75, 0.12)), v3(5.3, 0.4, 3.6), v3(3.5, 0.05, 5.0), v3(1.0, 0.05, 6.5)]);
    add(root, new THREE.TubeGeometry(mains, 40, 0.05, 8, false), M.cable);
    }

    // ---------- zemniaca svorka ----------
    const clampG = grp('svorka');
    const clampAt = v3(4.6, TT, 2.5);
    const jaw = new THREE.Group(); jaw.position.copy(clampAt); clampG.add(jaw);
    box(jaw, -0.1, 0.5, -0.06, 0.06, -0.12, 0.12, M.copper); box(jaw, -0.1, 0.5, -0.36, -0.26, -0.12, 0.12, M.copper);
    cylZ(jaw, 0.05, 0.05, -0.14, 0.14, 0.42, -0.15, M.steel, 10);
    const gCable = new THREE.CatmullRomCurve3([sockW[1], sockW[1].clone().add(v3(0, -0.6, 0.6)), v3(5.6, 3.0, 3.4), v3(5.0, 6.2, 2.9), clampAt.clone().add(v3(0.45, -0.1, 0))]);
    add(clampG, new THREE.TubeGeometry(gCable, 48, 0.06, 8, false), M.cable);

    // ---------- zvarenec: výšková mapa v mm (mierka 0,01), lokálna x = os zvaru, y = normála plochy ----------
    const weldG = grp('zvarenec');
    const pivot = new THREE.Group(); weldG.add(pivot); pivot.scale.setScalar(0.01);
    const wm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.62, side: THREE.DoubleSide });
    wm.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute vec3 glow;\nvarying vec3 vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = glow;');
      sh.fragmentShader = 'varying vec3 vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vGlow;');
    };
    const W2 = 60, RES = 0.5, NZ = Math.round(2 * W2 / RES);               // sieť 0,5 mm
    const F = { NX: 0, L: 0, t: 0, h: null, h0: null, dep: null, temp: null, heat: null, rip: null, mesh: null, geo: null, pos: null, col: null, glow: null, type: 'V', prep: null, dirty: true, hot: 0 };
    const C = {
      raw: new THREE.Color(0x5f6469).convertSRGBToLinear(), bevel: new THREE.Color(0x9a9fa4).convertSRGBToLinear(),
      slag: new THREE.Color(0x2b241e).convertSRGBToLinear(), weld: new THREE.Color(0x8e959c).convertSRGBToLinear(), toe: new THREE.Color(0x40444a).convertSRGBToLinear(),
      straw: new THREE.Color(0xa9844a).convertSRGBToLinear(), bronze: new THREE.Color(0x7a4f62).convertSRGBToLinear(), blue: new THREE.Color(0x4a5a8a).convertSRGBToLinear(), tmp: new THREE.Color(),
    };
    const glowCol = (T, out) => { const k = Math.max(0, (T - 0.3) / 0.7); out[0] = 3.2 * Math.pow(k, 0.8); out[1] = 1.3 * k * k; out[2] = 0.5 * k * k * k * k; };
    const idxOf = (i, j) => j * (F.NX + 1) + i, gl = [0, 0, 0];
    const RIP = 2 * Math.PI / 1.4;                                            // rozostup šupín húsenice ~1,4 mm
    const buildField = () => {
      if (F.mesh) { pivot.remove(F.mesh); F.geo.dispose(); }
      const L = F.L, NX = F.NX = Math.round(L / RES), VN = (NX + 1) * (NZ + 1), prof = weldProfile(F.type, F.t, F.prep);
      F.hb = null;
      F.por = new Uint8Array(VN); F.h = new Float32Array(VN); F.h0 = new Float32Array(VN); F.dep = new Float32Array(VN); F.temp = new Float32Array(VN); F.heat = new Float32Array(VN); F.rip = new Float32Array(VN);
      for (let j = 0; j <= NZ; j++) { const hz = prof(j * RES - W2); for (let i = 0; i <= NX; i++) { F.h[idxOf(i, j)] = hz; F.h0[idxOf(i, j)] = hz; } }
      const GX = NX + 5, GZ = NZ + 5, n = GX * GZ, idx = [];
      for (let j = 0; j < GZ - 1; j++) for (let i = 0; i < GX - 1; i++) { const a = j * GX + i, d = a + GX; idx.push(a, d, a + 1, a + 1, d, d + 1); }
      idx.push(0, GX - 1, (GZ - 1) * GX, GX - 1, GZ * GX - 1, (GZ - 1) * GX);
      F.geo = new THREE.BufferGeometry(); F.pos = new Float32Array(n * 3); F.col = new Float32Array(n * 3); F.glow = new Float32Array(n * 3);
      F.geo.setAttribute('position', new THREE.BufferAttribute(F.pos, 3)); F.geo.setAttribute('color', new THREE.BufferAttribute(F.col, 3)); F.geo.setAttribute('glow', new THREE.BufferAttribute(F.glow, 3));
      F.geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : idx);
      F.mesh = new THREE.Mesh(F.geo, wm); F.mesh.castShadow = true; F.mesh.receiveShadow = true; F.mesh.position.x = -L / 2; F.mesh.userData.part = 'zvarenec'; pivot.add(F.mesh);
      F.GX = GX; F.GZ = GZ; F.dirty = true; rebuildField(true);
    };
    const rebuildField = (geomToo) => {
      const { NX, GX, GZ } = F; let hot = 0;
      for (let jj = 0; jj < GZ; jj++) for (let ii = 0; ii < GX; ii++) {
        const i = clamp(ii - 2, 0, NX), j = clamp(jj - 2, 0, NZ), ring = ii === 0 || jj === 0 || ii === GX - 1 || jj === GZ - 1, edge = ii === 1 || jj === 1 || ii === GX - 2 || jj === GZ - 2;
        const k = jj * GX + ii, vi = idxOf(i, j), d = F.dep[vi];
        const rp = 0.5 + 0.5 * Math.sin(F.rip[vi]);
        if (geomToo) {
          // šupiny húsenice: jemné vlnenie povrchu zvarového kovu
          const ripple = !ring && !edge && d > 0.25 ? 0.24 * Math.min(1, d / 0.8) * (rp - 0.5) : 0;
          F.pos[k * 3] = i * RES; F.pos[k * 3 + 1] = ring ? 0 : F.h[vi] + ripple; F.pos[k * 3 + 2] = j * RES - W2;
        }
        let col = C.raw, T = 0;
        if (!ring && !edge) {
          T = F.temp[vi]; if (T > hot) hot = T;
          if (d > 0.06) {
            C.tmp.copy(c.slag ? C.slag : C.weld).multiplyScalar(c.slag ? 0.88 + 0.12 * rp : 0.62 + 0.5 * rp * rp);
            if (F.por[vi] && !c.slag && ((vi * 2654435761) >>> 0) % 5 < 2) C.tmp.multiplyScalar(0.28);   // póry (zvar bez plynovej ochrany)
            if (!c.slag && d < 0.7) C.tmp.lerp(C.toe, (1 - d / 0.7) * 0.55);            // tmavší okraj (prechod do základného materiálu)
            col = C.tmp;
          } else {
            col = F.h0[vi] < F.t - 0.01 && F.h0[vi] > 0.01 && F.type !== 'K' && F.type !== 'L' ? C.bevel : C.raw;
            const ht = F.heat[vi];
            if (ht > 0.08) { C.tmp.copy(col).lerp(ht > 0.62 ? C.blue : ht > 0.4 ? C.bronze : C.straw, Math.min(0.55, ht * 0.7)); col = C.tmp; }
          }
        }
        F.col[k * 3] = col.r; F.col[k * 3 + 1] = col.g; F.col[k * 3 + 2] = col.b;
        gl[0] = 0; gl[1] = 0; gl[2] = 0; if (T > 0.02) glowCol(T, gl);
        F.glow[k * 3] = gl[0]; F.glow[k * 3 + 1] = gl[1]; F.glow[k * 3 + 2] = gl[2];
      }
      F.hot = hot;
      ['color', 'glow', 'position'].forEach((n) => { F.geo.attributes[n].clearUpdateRanges(); });
      F.geo.attributes.color.needsUpdate = true; F.geo.attributes.glow.needsUpdate = true;
      if (geomToo) { F.geo.attributes.position.needsUpdate = true; F.geo.computeVertexNormals(); F.geo.computeBoundingSphere(); F.geo.computeBoundingBox(); }
    };
    // len žiara (teplota) v obdĺžniku uzlov [i0, i1, j0, j1]; farby a tvar sa pri chladnutí nemenia
    const rebuildGlow = ([i0, i1, j0, j1]) => {
      const { GX } = F; let hot = 0;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const T = F.temp[idxOf(i, j)], k = (j + 2) * GX + i + 2; if (T > hot) hot = T;
        gl[0] = 0; gl[1] = 0; gl[2] = 0; if (T > 0.02) glowCol(T, gl);
        F.glow[k * 3] = gl[0]; F.glow[k * 3 + 1] = gl[1]; F.glow[k * 3 + 2] = gl[2];
      }
      F.hot = hot;
      const a = F.geo.attributes.glow;
      a.addUpdateRange((j0 + 2) * GX * 3, (j1 - j0 + 1) * GX * 3); a.needsUpdate = true;   // rozsahy sa do nahratia hromadia
    };
    const onPart = (x, z) => Math.abs(x) <= F.L / 2 && Math.abs(z) <= W2;
    // výška povrchu dielu; mimo dielu null
    const surfAt = (x, z) => {
      if (!onPart(x, z)) return null;
      const i = clamp(Math.round((x + F.L / 2) / RES), 0, F.NX), j = clamp(Math.round((z + W2) / RES), 0, NZ);
      return F.h[idxOf(i, j)];
    };
    // nános: hladina taveniny vyplní najnižšie miesta (úkos), navrchu vytvorí klenbu húsenice
    const deposit = (cx, cz, dV, rp, s, porous = false) => {
      const xi = (cx + F.L / 2) / RES, zj = (cz + W2) / RES, rc = rp / RES, cells = [];
      for (let j = Math.max(0, Math.floor(zj - rc)); j <= Math.min(NZ, Math.ceil(zj + rc)); j++)
        for (let i = Math.max(0, Math.floor(xi - rc)); i <= Math.min(F.NX, Math.ceil(xi + rc)); i++) {
          const r2 = ((i - xi) * (i - xi) + (j - zj) * (j - zj)) / (rc * rc); if (r2 > 1) continue;
          cells.push([idxOf(i, j), r2]);
        }
      if (!cells.length) return 0;
      const crown = 0.5 * rp, A = RES * RES, need = dV / A;
      let lo = Infinity; cells.forEach(([k]) => { if (F.h[k] < lo) lo = F.h[k]; });
      let hi = lo + 40;
      for (let it = 0; it < 24; it++) {
        const mid = (lo + hi) / 2; let vol = 0;
        for (const [k, r2] of cells) vol += Math.max(0, mid - crown * r2 - F.h[k]);
        if (vol > need) hi = mid; else lo = mid;
      }
      let added = 0;
      for (const [k, r2] of cells) {
        const a = Math.max(0, lo - crown * r2 - F.h[k]);
        // šupiny sú oblúky vypuklé v smere zvárania: okraje kúpeľa tuhnú o kúsok skôr
        if (a > 0.002) { F.h[k] += a; F.dep[k] += a; added += a * A; F.rip[k] = (s - 0.45 * rp * r2) * RIP; if (porous) F.por[k] = 1; }
        F.temp[k] = Math.max(F.temp[k], 1 - r2 * 0.4);
      }
      // ohrev okolia (popúšťacie farby)
      const rh = rp * 2.4 / RES;
      const hj0 = Math.max(0, Math.floor(zj - rh)), hj1 = Math.min(NZ, Math.ceil(zj + rh)), hi0 = Math.max(0, Math.floor(xi - rh)), hi1 = Math.min(F.NX, Math.ceil(xi + rh));
      // obdĺžnik ohriatych buniek – chladnutie sa počíta len v ňom, nie v celej sieti
      if (!F.hb) F.hb = [hi0, hi1, hj0, hj1];
      else { F.hb[0] = Math.min(F.hb[0], hi0); F.hb[1] = Math.max(F.hb[1], hi1); F.hb[2] = Math.min(F.hb[2], hj0); F.hb[3] = Math.max(F.hb[3], hj1); }
      for (let j = hj0; j <= hj1; j++)
        for (let i = hi0; i <= hi1; i++) {
          const r = Math.hypot(i - xi, j - zj) / rh; if (r > 1) continue;
          const k = idxOf(i, j); F.heat[k] = Math.max(F.heat[k], (1 - r) * 0.9); if (F.temp[k] < 0.35 * (1 - r)) F.temp[k] = 0.35 * (1 - r);
        }
      return added;
    };
    // koncový kráter po zhasnutí oblúka
    const crater = (cx, cz, rp) => {
      const xi = (cx + F.L / 2) / RES, zj = (cz + W2) / RES, rc = rp * 0.55 / RES;
      for (let j = Math.max(0, Math.floor(zj - rc)); j <= Math.min(NZ, Math.ceil(zj + rc)); j++)
        for (let i = Math.max(0, Math.floor(xi - rc)); i <= Math.min(F.NX, Math.ceil(xi + rc)); i++) {
          const r2 = ((i - xi) * (i - xi) + (j - zj) * (j - zj)) / (rc * rc); if (r2 > 1) continue;
          const k = idxOf(i, j), cut = Math.min(F.dep[k] * 0.6, 0.55 * (1 - r2));
          if (cut > 0) { F.h[k] -= cut; F.dep[k] -= cut; }
        }
    };
    // ---------- držiak, elektróda, oblúk, kábel ----------
    const holder = grp(MIG ? 'horak' : 'drziak');
    const elRod = add(holder, new THREE.CylinderGeometry(1, 1, 1, 12), M.rod); elRod.castShadow = false;
    const elCore = add(holder, new THREE.CylinderGeometry(1, 1, 1, 10), M.core);
    const hJaw = new THREE.Group(); holder.add(hJaw);
    box(hJaw, -0.09, 0.09, 0, 0.35, -0.07, 0.07, M.copper);
    cylY(hJaw, 0.11, 0.13, 0.35, 0.5, 0, 0, M.handle, 16); cylY(hJaw, 0.13, 0.13, 0.5, 2.3, 0, 0, M.handle, 16); cylY(hJaw, 0.13, 0.09, 2.3, 2.5, 0, 0, M.handle, 16);
    const hCable = new THREE.Mesh(new THREE.BufferGeometry(), M.cable); hCable.castShadow = true; holder.add(hCable);
    // horák MIG/MAG (lokálna +Y od kontaktnej špičky k rukoväti): drôt, hubica, špička, krk, rukoväť so spúšťačom
    const torch = new THREE.Group(); holder.add(torch); torch.visible = MIG;
    const wireM = add(torch, new THREE.CylinderGeometry(1, 1, 1, 8), M.copper); wireM.castShadow = false;
    if (MIG) {
      cylY(torch, 0.03, 0.035, -0.02, 0.12, 0, 0, M.copper, 12);                     // kontaktná špička
      cylY(torch, 0.085, 0.1, -0.03, 0.5, 0, 0, M.steel, 20);                      // plynová hubica
      cylY(torch, 0.1, 0.1, 0.5, 0.62, 0, 0, M.black, 20);
      cylY(torch, 0.055, 0.055, 0.62, 1.55, 0, 0, M.steelDark, 14);                // krk horáka
      cylY(torch, 0.13, 0.15, 1.55, 2.85, 0, 0, M.handle, 18);                     // rukoväť
      box(torch, 0.1, 0.2, 1.75, 2.0, -0.05, 0.05, M.red);                         // spúšťač
      elRod.visible = elCore.visible = false; hJaw.visible = false;
    }
    const arcCore = add(root, new THREE.SphereGeometry(0.035, 12, 8), M.arc); arcCore.castShadow = false;
    const haloCv = document.createElement('canvas'); haloCv.width = haloCv.height = 128;
    (() => { const g = haloCv.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(210,230,255,.9)'); gr.addColorStop(0.45, 'rgba(140,180,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); })();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloCv), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }));
    halo.scale.set(0.9, 0.9, 1); scene.add(halo);
    // decay 0 + dosah 9: mäkký okraj ako v r128
    const arcLight = new THREE.PointLight(0xdbe8ff, 0, 9, 0); scene.add(arcLight);
    const aimMark = new THREE.Mesh(new THREE.TorusGeometry(4, 0.5, 8, 32), new THREE.MeshBasicMaterial({ color: 0x46c8ff, toneMapped: false, transparent: true, opacity: 0.85, depthTest: false }));
    aimMark.rotation.x = -Math.PI / 2; aimMark.renderOrder = 8; aimMark.visible = false; pivot.add(aimMark);
    const jointGeo = new THREE.BufferGeometry();
    const jointLine = new THREE.Line(jointGeo, new THREE.LineDashedMaterial({ color: 0x46c8ff, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.9, depthTest: false }));
    jointLine.renderOrder = 7; pivot.add(jointLine);
    const jointZ = () => (F.type === 'K' ? F.t / 2 + 1.5 : F.type === 'L' ? 0.5 : 0);
    const placeJoint = () => {
      const z = jointZ(), y = (F.type === 'L' ? F.t : F.type === 'E' ? 3 * F.t : F.t) + 0.3;
      jointGeo.setFromPoints([v3(-F.L / 2, y, z), v3(F.L / 2, y, z)]); jointLine.computeLineDistances();
    };
    // ohorky elektród: po výmene padnú na stôl (alebo na zem) a zostanú ležať
    const stubs = [];
    const dropStub = (len, rr, at, dir) => {
      if (len < 0.05) return;
      const m = new THREE.Mesh(elRod.geometry, M.rod); m.castShadow = true; m.scale.set(rr * 1.6, len, rr * 1.6);
      m.position.copy(at).addScaledVector(dir, len / 2); m.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); scene.add(m);
      stubs.push({ m, v: v3((Math.random() - 0.5) * 0.6, 0.4, 0.5 + Math.random() * 0.3), w: v3(Math.random() * 6, Math.random() * 2, 4 + Math.random() * 4), rest: false, len });
      if (stubs.length > 10) { const o = stubs.shift(); scene.remove(o.m); }
    };
    const updateStubs = (dt) => {
      for (const s of stubs) {
        if (s.rest) continue;
        s.v.y -= 12 * dt; s.m.position.addScaledVector(s.v, dt);
        s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
        const onTable = Math.abs(s.m.position.x) < 5 && Math.abs(s.m.position.z) < 3, floorY = (onTable ? TT : 0) + s.m.scale.x;
        if (s.m.position.y <= floorY && s.v.y < 0) { s.m.position.y = floorY; s.m.rotation.set(0, Math.random() * TAU, Math.PI / 2); s.rest = true; }
      }
    };
    const spatter = createParticles(scene, new THREE.BoxGeometry(0.012, 0.012, 0.03), M.spatter, 220, false);
    const smoke = createParticles(scene, new THREE.SphereGeometry(0.035, 10, 8), M.smoke, 160, false);

    // ---------- stav ----------
    const st = { wire: 0, por: 0, latch: false, trigPrev: false, tip: v3(), aim: { x: 0, z: 0 }, tx: -40, tz: 0, wrongDir: 0, la: c.arcLen, arc: false, stuck: false, le: 350, v: 0, msg: null, phase: 0, cold: 0, longArc: 0, fast: 0, spat: 0, flashes: 0, sag: 0, lastBuild: 0, geomDirty: false, strikeT: -9 };
    let t = 0, last = performance.now(), teleT = 0, statT = 0, spAcc = 0, smAcc = 0, stats = null;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 2.8 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const elRange = () => (ELECTRODES[c.etype].r[c.de] || [60, 120]);

    // poloha zvarenca podľa polohy zvárania
    // natočenie zvarenca: lokálna x = os zvaru, lokálna y = normála lícnej plochy
    const quatOf = (pos, fillet) => {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qx = (deg) => new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), deg * Math.PI / 180);
      if (pos === 'PF' || pos === 'PG') { m.makeBasis(v3(0, 1, 0), v3(0, 0, 1), v3(1, 0, 0)); return q.setFromRotationMatrix(m); }
      if (pos === 'PC') { m.makeBasis(v3(1, 0, 0), v3(0, 0, 1), v3(0, -1, 0)); return q.setFromRotationMatrix(m); }
      if (fillet) return pos === 'PA' ? qx(-45) : pos === 'PB' ? q : pos === 'PD' ? qx(180) : qx(135);   // PE: os kúta smeruje nadol
      return pos === 'PA' ? q : pos === 'PB' ? qx(45) : pos === 'PD' ? qx(135) : qx(180);
    };
    const placeWeld = () => {
      const pos = c.wPos, Lw = F.L / 100, fillet = FILLETS.includes(F.type);
      weldG.quaternion.copy(quatOf(pos, fillet));
      const raised = pos === 'PD' || pos === 'PE';
      if (pos === 'PA' && !fillet) weldG.position.set(0, TT, 0.4);
      else if (pos === 'PB' && fillet) weldG.position.set(0, TT, 0.4);
      else if (pos === 'PC') weldG.position.set(0, TT + 1.6, -1.25);
      else if (pos === 'PF' || pos === 'PG') weldG.position.set(0, TT + 0.6 + Lw / 2, -1.25);
      else if (raised) weldG.position.set(0, TT + 3.6, 0.2);
      else weldG.position.set(0, TT + 1.0, 0.2);
      fixture.visible = !(pos === 'PA' && !fillet) && !(pos === 'PB' && fillet);
      const post = fixture.children[0], sc = raised ? 0.82 : pos === 'PF' || pos === 'PG' ? (0.6 + Lw) / 4.2 : pos === 'PC' ? 0.55 : 0.22;
      post.scale.y = sc; post.position.y = TT + 2.1 * sc;
      weldG.updateMatrixWorld(true);
    };
    const newParts = () => {
      F.type = c.wType; F.t = c.wT; F.L = c.wL; F.prep = weldPrep(F.type, F.t);
      buildField(); placeWeld();
      st.tx = -F.L / 2 + 10; st.tz = jointZ(); st.aim.x = st.tx; st.aim.z = st.tz; placeJoint(); st.cold = 0; st.longArc = 0; st.fast = 0; st.spat = 0; st.sag = 0; st.wrongDir = 0; st.por = 0; st.Imax = 0; stats = null;
      c.slag = !MIG;                                                  // MAG plným drôtom: bez trosky
    };
    newParts();

    // ---------- pohľady, popisy, výber ----------
    const wc = () => weldG.localToWorld(v3(0, F.t / 100, 0));
    const nrm = () => v3(0, 1, 0).transformDirection(weldG.matrixWorld);
    const anchors = {
      ...(MIG ? { ...fr.anchors, horak: () => holder.position.clone().add(v3(0, 0.6, 0)) } : { zvaracka: () => wel.localToWorld(v3(0, 2.8, 0)), drziak: () => holder.position.clone().add(v3(0, 0.4, 0)) }),
      svorka: () => clampAt.clone().add(v3(0.2, 0.35, 0)),
      stol: () => v3(-4.2, TT + 0.15, 2.6),
      zvarenec: () => wc().add(v3(-0.4, 0.25, 0.5)),
    };
    const views = {
      detail: () => { const p = wc(), n = nrm(); const o = n.clone().multiplyScalar(2.0).add(v3(0.6, 0.9, 1.8)); return [[p.x + o.x, p.y + o.y, p.z + o.z], [p.x, p.y, p.z], true]; },
      celok: () => (MIG ? [[6, 17, 27], [4, 5.5, 1]] : [[11, 15, 18], [3, 6, 1.5]]),
      zvaracka: () => {
        if (MIG) { const p = fr.panelView(), d = v3(0, 0, 1).transformDirection(wel.matrixWorld); return [[p.x + d.x * 8 + 1.0, p.y + 2.0, p.z + d.z * 8], [p.x, p.y, p.z], true]; }
        const p = wel.localToWorld(v3(0, 1.3, 1.3)); return [[p.x + 1.5, p.y + 2.2, p.z + 5.5], [p.x, p.y, p.z], true];
      },
      zhora: () => { const p = wc(); return [[p.x + 0.1, p.y + 5, p.z + 1.2], [p.x, p.y, p.z], true]; },
    };
    let mouseUsed = false;
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped || mouseUsed, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);
    // pri MAG sa hodnotí aj najvyšší prúd, ktorým sa zváralo (tenký plech)
    const migI = () => stickoutI(migSynergic({ wire: c.wire, vd: c.vd, prog: c.prog, gas: c.gas, corr: c.corr }).I, c.ctwd);
    apiRef.current.measure = () => ({ stats: evalWeld(), type: F.type, t: F.t, pos: c.wPos, slag: c.slag, ...(MIG ? { I: st.Imax || migI() } : {}) });
    apiRef.current.exportStl = () => exportStl(weldG);
    apiRef.current.snapshot = snapshot;
    apiRef.current.newParts = () => { if (st.arc) { say(L('Najprv zhasni oblúk.', 'Stop the arc first.')); return; } if (c.unclamped) { say(L('Najprv polož zvarenec späť.', 'Put the weldment back first.')); return; } newParts(); insp.goView('detail', false); say(L('Pripravené nové diely.', 'New parts are prepared.'), 'info'); };
    // výmena elektródy s animáciou: držiak sa zdvihne, ohorok vypadne, nová elektróda sa zasunie do čeľustí
    apiRef.current.newElectrode = () => {
      if (MIG || st.arc || st.swap) return;
      if (c.unclamped) { say(L('Najprv polož zvarenec späť.', 'Put the weldment back first.')); return; }
      st.swap = { t: 0, oldLe: st.le, dropped: false, fitted: false }; st.stuck = false;
      say(L('Výmena elektródy…', 'Changing the electrode…'), 'info');
    };
    apiRef.current.chip = () => { if (F.hot > 0.15) { say(L('Zvar je ešte horúci – počkaj, kým vychladne.', 'The weld is still hot – wait until it cools down.')); return false; } c.slag = false; F.dirty = true; say(L('Troska je otlčená – vidno kresbu húsenice.', 'The slag is chipped off – the bead ripples are visible.'), 'info'); return true; };
    const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj: () => weldG, getSpot: () => v3(2.4, TT + 2.6, 4.2), onState: (v) => push('unclamped', v) });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in' && st.arc) { say(L('Najprv zhasni oblúk.', 'Stop the arc first.')); return; }
      if (wi.phase() === 'in' && F.hot > 0.3) { say(L('Zvarenec je rozžhavený – nechaj ho chvíľu vychladnúť.', 'The weldment is red-hot – let it cool for a moment.')); return; }
      if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb.', 'Wait until the movement finishes.'), 'info');
    };
    insp.goView('detail', true);

    // ---------- ručné ovládanie prvkov zváračky ----------
    if (MIG) {
      ctrl.reg({ type: 'lever', angles: [0.6, -0.6], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
        getIdx: () => (c.power ? 1 : 0), onSet: (i) => { push('power', i === 1); if (i === 0) { st.arc = false; st.latch = false; } say(i ? L('Zdroj zapnutý.', 'Source on.') : L('Zdroj vypnutý.', 'Source off.'), 'info'); }, read: () => (c.power ? 'I' : '0') }, fr.mainSw);
      ctrl.reg({ type: 'wheel', minR: 0.15, inc: 1, label: LL('Rýchlosť drôtu (synergia)', 'Wire speed (synergic)'), hint: LL('Otáčaním sa mení rýchlosť drôtu; prúd a napätie dopočíta synergia.', 'Turning changes the wire speed; the synergic line sets current and voltage.'),
        turn: (d) => push('vd', Math.round(clamp(c.vd - d * 2, 1, 22) * 10) / 10), read: () => `${c.vd.toFixed(1)} m/min` }, fr.knobVd);
      ctrl.reg({ type: 'wheel', minR: 0.15, inc: 1, label: LL('Korekcia dĺžky oblúka', 'Arc length correction'), hint: LL('Plus = dlhší oblúk (vyššie napätie), mínus = kratší.', 'Plus = longer arc (higher voltage), minus = shorter.'),
        turn: (d) => push('corr', Math.round(clamp(c.corr - d * 0.8, -3, 3) * 10) / 10), read: () => `${c.corr > 0 ? '+' : ''}${c.corr.toFixed(1)} V` }, fr.knobCorr);
      ctrl.reg({ type: 'button', label: LL('Proces: štandard / impulz', 'Process: standard / pulse'), hint: LL('Prepína synergický štandardný a impulzný oblúk.', 'Switches between synergic standard and pulsed arc.'),
        action: () => push('prog', c.prog === 'std' ? 'pulse' : 'std'), read: () => (c.prog === 'std' ? 'SYNERGIC STANDARD' : 'SYNERGIC PULS') }, fr.btnProg);
      ctrl.reg({ type: 'button', label: LL('Režim horáka 2T / 4T', 'Torch mode 2T / 4T'), hint: LL('2T: zvára sa, kým držíš spúšťač. 4T: stlač raz = štart, znova = stop.', '2T: welds while you hold the trigger. 4T: press once = start, again = stop.'),
        action: () => push('trig', c.trig === '2T' ? '4T' : '2T'), read: () => c.trig }, fr.btnTrig);
      ctrl.reg({ type: 'lever', angles: [0, -1.6], minR: 0.15, label: LL('Ventil plynovej fľaše', 'Gas cylinder valve'), hint: LL('Otvor ventil – bez plynu je zvar pórovitý.', 'Open the valve – without gas the weld is porous.'),
        getIdx: () => (c.valve ? 1 : 0), onSet: (i) => { push('valve', i === 1); say(i ? L('Ventil fľaše otvorený.', 'Cylinder valve open.') : L('Ventil fľaše zatvorený.', 'Cylinder valve closed.'), 'info'); }, read: () => (c.valve ? L('otvorený', 'open') : L('zatvorený', 'closed')) }, fr.vWheel);
    } else {
    const dialIdx = () => logNear(WELD_DIAL, c.current);
    ctrl.reg({ type: 'lever', angles: WELD_DIAL_ANG, minR: 0.2, label: LL('Nastavenie zváracieho prúdu', 'Welding current setting'), hint: LL('Otoč na stupeň 55 – 155 A.', 'Turn to a step 55 – 155 A.'),
      getIdx: dialIdx, onSet: (i) => push('current', WELD_DIAL[i]), read: () => `${c.current} A` }, knobI);
    ctrl.reg({ type: 'lever', angles: WELD_MODE_ANG, minR: 0.2, label: LL('Prepínač: 0 / sváranie 380 V / 220 V / nabíjanie', 'Switch: 0 / welding 380 V / 220 V / charging'), hint: LL('Pri 220 V je dovolený prúd najviac 75 A.', 'On 220 V the current is limited to 75 A.'),
      getIdx: () => Math.max(0, WELD_MODES.findIndex(([k]) => k === c.mode)), onSet: (i) => push('mode', WELD_MODES[i][0]), read: () => WELD_MODES.find(([k]) => k === c.mode)[1] }, knobM);
    ctrl.reg({ type: 'button', label: LL('Istič', 'Breaker'), hint: LL('Zapne istič po vypadnutí.', 'Resets the breaker after a trip.'), action: () => { push('tripped', false); say(L('Istič zapnutý.', 'Breaker reset.'), 'info'); } }, breaker);
    }
    ctrl.reg({ type: 'button', still: true, label: LL('Zemniaca svorka', 'Ground clamp'), hint: LL('Klik pripojí alebo odpojí svorku.', 'Click to attach or detach the clamp.'), action: () => push('ground', !c.ground) }, jaw);

    // ---------- ovládanie myšou: pravé tlačidlo vedie elektródu, pravé + ľavé zvára; dotyk: 1 prst vedie, 2 prsty zvárajú ----------
    const io = { right: false, left: false, touches: new Map(), px: 0, py: 0 };
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
    const aimAt = (cx, cy) => {
      const r = dom.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
      // najprv priamo povrch dielu (lemy, rebro, úkos), mimo dielu rovina vo výške spoja
      const hits = ray.intersectObject(F.mesh, false);
      let lp = null;
      if (hits.length) lp = pivot.worldToLocal(hits[0].point.clone());
      else {
        const jh = surfAt(0, jointZ()), p0 = pivot.localToWorld(v3(0, jh == null ? F.t : jh, 0));
        plane.setFromNormalAndCoplanarPoint(nrm(), p0);
        if (ray.ray.intersectPlane(plane, hit)) lp = pivot.worldToLocal(hit.clone());
      }
      if (lp) { st.aim.x = clamp(lp.x, -F.L / 2 - 160, F.L / 2 + 160); st.aim.z = clamp(lp.z, -W2 - 160, W2 + 160); }
    };
    const active = () => c.manual && !c.unclamped;                 // zvára sa len v režime „Zváranie“
    const setBtns = (e) => { io.right = !!(e.buttons & 2); io.left = !!(e.buttons & 1); };
    const centroid = () => { let x = 0, y = 0; io.touches.forEach((p) => { x += p.x; y += p.y; }); const n = io.touches.size || 1; return [x / n, y / n]; };
    const pd = (e) => {
      if (!active()) return;
      if (e.pointerType === 'touch') { io.touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.stopImmediatePropagation(); mouseUsed = true; aimAt(...centroid()); return; }
      setBtns(e); mouseUsed = io.right;
      if (io.right) { e.stopImmediatePropagation(); try { dom.setPointerCapture(e.pointerId); } catch (err) { /* ignorované */ } aimAt(e.clientX, e.clientY); }
    };
    const pm = (e) => {
      if (!active()) { io.right = io.left = false; io.touches.clear(); return; }
      if (e.pointerType === 'touch') { if (io.touches.has(e.pointerId)) { io.touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.stopImmediatePropagation(); aimAt(...centroid()); } return; }
      setBtns(e);
      if (io.right) { mouseUsed = true; e.stopImmediatePropagation(); aimAt(e.clientX, e.clientY); }
    };
    const pu = (e) => { if (e.pointerType === 'touch') { io.touches.delete(e.pointerId); return; } setBtns(e); };
    const wh = (e) => {
      if (!active() || !io.right) return; e.preventDefault(); e.stopImmediatePropagation();
      if (MIG) push('ctwd', clamp(c.ctwd + (e.deltaY > 0 ? -1 : 1), 2, 30)); else push('arcLen', clamp(c.arcLen + (e.deltaY > 0 ? -0.5 : 0.5), 0, 12));
    };
    dom.addEventListener('pointerdown', pd, { capture: true }); dom.addEventListener('pointermove', pm, { capture: true });
    dom.addEventListener('pointerup', pu, { capture: true }); dom.addEventListener('pointercancel', pu, { capture: true });
    dom.addEventListener('wheel', wh, { capture: true, passive: false });
    apiRef.current.debug = (on, x, z) => { io.left = io.right = !!on; if (x != null) { st.aim.x = x; st.aim.z = z; } };

    // ---------- hlavná slučka ----------
    const dirW = v3(), xW = v3(), nW = v3(), tipW = v3(), tmp = v3(), tmp2 = v3(), sP = v3(), sV = v3(), UP = v3(0, 1, 0), q = new THREE.Quaternion();   // pomocné objekty – v slučke sa nič nové nevytvára
    let raf, cableKey = '', cableT = 0, flick = 1, flickT = 0;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      wi.update(dt);
      const moving = io.right || io.touches.size >= 1;
      const trigger = !st.swap && ((io.right && io.left) || io.touches.size >= 2);
      // priebeh výmeny elektródy: čeľuste sa zdvihnú nad dĺžku novej elektródy, ohorok vypadne,
      // nová elektróda sa zboku zasunie do čeľustí a držiak sa vráti do pracovnej polohy
      let jawLen = -1, slide = 0, drop = false;
      if (st.swap) {
        const s = st.swap, e = (k) => k * k * (3 - 2 * k); s.t += dt;
        const T = s.t, A = s.oldLe / 100, B = 3.5 + 0.8;
        jawLen = T < 0.35 ? A + (B - A) * e(T / 0.35) : T < 1.35 ? B : T < 1.75 ? B + (3.5 - B) * e((T - 1.35) / 0.4) : 3.5;
        if (!s.dropped && T >= 0.4) { s.dropped = true; drop = true; st.le = 0; }     // ohorok vypadne (dĺžka s.oldLe)
        if (s.dropped && !s.fitted && T >= 0.6) { s.fitted = true; st.le = 350; }  // aj keby to bolo v tom istom snímku
        slide = T < 0.6 ? 1 : T < 1.25 ? 1 - e((T - 0.6) / 0.65) : 0;
        if (T >= 1.75) { st.swap = null; say(L('Vložená nová elektróda – môžeš pokračovať.', 'A new electrode is fitted – carry on.'), 'info'); }
      }

      // vedenie ruky (obmedzená rýchlosť)
      const ox = st.tx, oz = st.tz;
      if (moving) { const mx = st.aim.x - st.tx, mz = st.aim.z - st.tz, d = Math.hypot(mx, mz), lim = (st.arc ? c.handV : 250) * dt; if (d > lim) { st.tx += mx / d * lim; st.tz += mz / d * lim; } else { st.tx = st.aim.x; st.tz = st.aim.z; } }
      aimMark.visible = c.manual && moving && !c.unclamped;
      jointLine.visible = c.manual && !c.unclamped && F.type !== 'N' && c.slag;
      if (aimMark.visible) { const sa = surfAt(st.aim.x, st.aim.z); aimMark.position.set(st.aim.x, (sa == null ? F.t : sa) + 0.6, st.aim.z); }
      const vNow = Math.hypot(st.tx - ox, st.tz - oz) / Math.max(dt, 1e-3);
      st.v += (vNow - st.v) * Math.min(1, dt * 6);

      // parametre procesu: MMA – nastavený prúd a výška elektródy; MIG/MAG – synergia z rýchlosti drôtu a výlet drôtu
      let I, lo, hi, syn = null, cover = 1;
      const de = c.de;
      if (MIG) {
        syn = migSynergic({ wire: c.wire, vd: c.vd, prog: c.prog, gas: c.gas, corr: c.corr });
        I = stickoutI(syn.I, c.ctwd); [lo, hi] = migRange(F.t);
        cover = gasCover({ valve: c.valve, flow: c.flow, ctwd: c.ctwd });
      } else {
        I = c.current; [lo, hi] = elRange();
        if (st.arc) {
          const burn = I * 0.045 * dt;
          st.le = Math.max(0, st.le - burn);
          if (!c.autoArc) push('arcLen', clamp(c.arcLen + burn * 0.5, 0, 12));
        }
      }
      const sRaw = surfAt(st.tx, st.tz), surf = sRaw == null ? F.t : sRaw;      // mimo dielu elektróda (drôt) visí v rovine jeho povrchu
      st.la = MIG ? syn.la : c.arcLen;
      const rpNow = MIG ? clamp(1.3 + 0.022 * I + 0.35 * (syn.la - 2), 2.5, 9) : clamp(1.1 * de + 0.025 * I, 2.5, 8);

      // zapálenie a udržanie oblúka
      if (MIG) {
        // 2T: zvára sa, kým je stlačený spúšťač; 4T: stlačenie zapne, ďalšie stlačenie vypne
        if (trigger && !st.trigPrev && c.trig === '4T') st.latch = !st.latch;
        st.trigPrev = trigger;
        const want = c.trig === '4T' ? !!st.latch : trigger;
        if (!want) { if (st.arc) { say(L('Oblúk zhasol – drôt sa zastavil.', 'Arc off – the wire stopped.'), 'info'); st.arcOff = t; if (sRaw != null) { crater(st.tx, st.tz, rpNow); st.geomDirty = true; } } st.arc = false; }
        else if (!st.arc) {
          if (!c.power) { sayOnce('noP', true, L('Zdroj je vypnutý – zapni hlavný vypínač.', 'The source is off – switch on the main switch.')); st.latch = false; }
          else if (!c.ground) { sayOnce('noP', true, L('Zemniaca svorka nie je pripojená – obvod nie je uzavretý.', 'The ground clamp is not attached – the circuit is open.')); st.latch = false; }
          else if (sRaw == null) sayOnce('noP', true, L('Horák je mimo zvarenca – drôt nemá o čo zapáliť oblúk.', 'The torch is off the part – the wire has nothing to strike on.'));
          else if (c.ctwd > 28) sayOnce('noP', true, L('Horák je príliš ďaleko – priblíž ho (koliesko pri držanom pravom tlačidle).', 'The torch is too far – bring it closer (wheel while holding the right button).'));
          else { st.arc = true; st.strikeT = t; flags.noP = false; if (!c.helmet) st.flashes++; }
        }
        if (st.arc) {
          if (sRaw == null) { st.arc = false; st.latch = false; st.arcOff = t; say(L('Oblúk zhasol – horák zišiel z dielu.', 'The arc went out – the torch left the part.'), 'warn'); }
          else if (c.ctwd < 3) { st.arc = false; st.latch = false; st.arcOff = t; say(L('Hubica narazila do kúpeľa – drôt sa zapichol a prilepil ku kontaktnej špičke.', 'The nozzle hit the pool – the wire stubbed and burnt back to the contact tip.'), 'danger'); }
        }
      } else {
        if (c.mode === 'w220' && I > 75 && trigger && !c.tripped) { push('tripped', true); say(L('Istič vypadol – pri 220 V je najvyšší zvárací prúd 75 A.', 'The breaker tripped – on 220 V the welding current is limited to 75 A.'), 'danger'); }
        if (!trigger) { if (st.arc) { say(L('Oblúk zhasol.', 'Arc extinguished.'), 'info'); st.arcOff = t; if (sRaw != null) { crater(st.tx, st.tz, rpNow); st.geomDirty = true; } } st.arc = false; st.stuck = false; }
        else if (!st.arc && !st.stuck) {
          if (c.mode === 'off') sayOnce('noP', true, L('Zváračka je vypnutá – otoč prepínač na 380 V alebo 220 V.', 'The welder is off – turn the switch to 380 V or 220 V.'));
          else if (c.mode === 'charge') sayOnce('noP', true, L('Prepínač je na nabíjaní – na zváranie ho otoč na 380 V alebo 220 V.', 'The switch is on charging – turn it to 380 V or 220 V for welding.'));
          else if (c.tripped) sayOnce('noP', true, L('Istič je vypnutý – zapni ho na zváračke.', 'The breaker is off – reset it on the welder.'));
          else if (!c.ground) sayOnce('noP', true, L('Zemniaca svorka nie je pripojená – obvod nie je uzavretý.', 'The ground clamp is not attached – the circuit is open.'));
          else if (st.le < 30) sayOnce('noP', true, L('Elektróda je spotrebovaná – vymeň ju (tlačidlo v scéne alebo E).', 'The electrode is used up – replace it (button in the scene or E).'));
          else if (sRaw == null) sayOnce('noP', true, L('Elektróda je mimo zvarenca – oblúk nie je kde zapáliť.', 'The electrode is off the part – there is nothing to strike the arc on.'));
          else if (st.la > 5) sayOnce('noP', true, L('Elektróda je ďaleko – priblíž ju k zvarencu (koliesko pri držanom pravom tlačidle).', 'The electrode is too far – bring it closer (wheel while holding the right button).'));
          else { st.arc = true; st.strikeT = t; flags.noP = false; if (!c.helmet) st.flashes++; }
        }
        if (st.arc) {
          if (st.la < 0.4) { st.arc = false; st.stuck = true; say(L('Elektróda sa prilepila – uvoľni tlačidlá a zdvihni ju.', 'The electrode stuck – release the buttons and lift it.'), 'danger'); }
          else if (st.la > 1.6 * de + 4) { st.arc = false; say(L('Oblúk sa pretrhol – je príliš dlhý.', 'The arc broke – it is too long.'), 'warn'); }
          else if (st.le <= 25) { st.arc = false; say(L('Elektróda dohorela – vymeň ju.', 'The electrode has burnt down – replace it.'), 'warn'); }
          else if (sRaw == null) { st.arc = false; st.arcOff = t; say(L('Oblúk sa pretrhol – elektróda zišla z dielu.', 'The arc broke – the electrode left the part.'), 'warn'); }
        }

      }

      // tavenie a tvorba húsenice
      if (st.arc) {
        if (MIG) {
          // nanesený kov = prierez drôtu × rýchlosť drôtu; slabá ochrana plynom zanechá póry
          const dV = syn.dep * dt * clamp(I / syn.I, 0.7, 1.1);
          st.phase += Math.hypot(st.tx - ox, st.tz - oz) + dt * 0.5;
          if (deposit(st.tx, st.tz, dV, rpNow, st.phase, cover < 0.7) > 0) st.geomDirty = true;
          st.wire += c.vd / 60 * dt; st.Imax = Math.max(st.Imax || 0, I);
          const vert = c.wPos === 'PF' || c.wPos === 'PG' || c.wPos === 'PE' || c.wPos === 'PD';
          if (I < lo) st.cold += dt; if (st.v > 14) st.fast += dt; if (cover < 0.7) st.por += dt;
          if (vert && (syn.mode === 'spray' || I > hi * 0.9)) st.sag += dt;
          const dxl = st.tx - ox, wrong = (c.wPos === 'PF' && dxl < -0.02) || (c.wPos === 'PG' && dxl > 0.02);
          if (wrong) st.wrongDir += dt;
          sayOnce('dir', wrong, c.wPos === 'PF' ? L('V polohe PF sa zvára zdola nahor.', 'In position PF weld upwards.') : L('V polohe PG sa zvára zhora nadol.', 'In position PG weld downwards.'), 'warn');
          sayOnce('gas', cover < 0.7, !c.valve ? L('Ventil plynovej fľaše je zatvorený – zvar je pórovitý!', 'The gas cylinder valve is closed – the weld is porous!') : c.flow < 8 ? L('Málo plynu – nastav prietok 12 – 16 l/min.', 'Too little gas – set the flow to 12 – 16 l/min.') : c.flow > 22 ? L('Príliš veľký prietok plynu – turbulencia nasáva vzduch, vznikajú póry.', 'Gas flow too high – turbulence draws in air, porosity forms.') : L('Dlhý výlet drôtu – plyn kúpeľ nechráni, vznikajú póry. Priblíž horák.', 'Long stick-out – the gas does not cover the pool, porosity forms. Move the torch closer.'), 'danger');
          sayOnce('cold', I < lo, L(`Prúd ${Math.round(I)} A je nízky pre plech ${F.t} mm (${lo} – ${hi} A) – hrozí studený spoj. Zvýš rýchlosť drôtu.`, `${Math.round(I)} A is low for a ${F.t} mm plate (${lo} – ${hi} A) – risk of cold lap. Raise the wire speed.`), 'warn');
          sayOnce('hot', I > hi, L(`Prúd ${Math.round(I)} A je vysoký pre plech ${F.t} mm – hrozí prepálenie.`, `${Math.round(I)} A is high for a ${F.t} mm plate – risk of burn-through.`), 'warn');
          sayOnce('glob', syn.mode === 'globular', L('Prechodový oblúk – veľký rozstrek. Zmeň rýchlosť drôtu alebo zapni impulz.', 'Globular transfer – heavy spatter. Change the wire speed or switch to pulse.'), 'warn');
          sayOnce('sprayv', vert && syn.mode === 'spray', L('Sprchový prenos sa v tejto polohe nedá použiť – kúpeľ steká. Zníž rýchlosť drôtu alebo použi impulz.', 'Spray transfer cannot be used in this position – the pool runs. Lower the wire speed or use pulse.'), 'warn');
          sayOnce('ctwdS', c.ctwd < 7, L('Horák je veľmi blízko – rozstrek sa lepí na hubicu.', 'The torch is very close – spatter sticks to the nozzle.'), 'warn');
          spAcc += dt * syn.spat * (cover < 0.5 ? 1.5 : 1) * (c.ctwd > 18 ? 1.4 : 1);
          smAcc += dt * 8;
        } else {
          const eff = I < lo * 0.85 ? 0.55 : 1;
          const dV = 0.42 * I * eff * dt;
          st.phase += Math.hypot(st.tx - ox, st.tz - oz) + dt * 0.5;            // dráha v mm – určuje šupiny húsenice
          if (deposit(st.tx, st.tz, dV, rpNow, st.phase) > 0) st.geomDirty = true;
          if (I < lo) st.cold += dt; if (st.la > de + 1.5) st.longArc += dt; if (st.v > 9) st.fast += dt;
          if ((c.wPos === 'PF' || c.wPos === 'PG' || c.wPos === 'PE' || c.wPos === 'PD') && I > hi * 0.9) st.sag += dt;
          const dxl = st.tx - ox, wrong = (c.wPos === 'PF' && dxl < -0.02) || (c.wPos === 'PG' && dxl > 0.02);
          if (wrong) st.wrongDir += dt;
          sayOnce('dir', wrong, c.wPos === 'PF' ? L('V polohe PF sa zvára zdola nahor.', 'In position PF weld upwards.') : L('V polohe PG sa zvára zhora nadol.', 'In position PG weld downwards.'), 'warn');
          sayOnce('cold', I < lo, L(`Prúd je nízky pre elektródu Ø${de} (${lo} – ${hi} A) – oblúk je nestabilný, hrozí studený spoj.`, `The current is low for a Ø${de} electrode (${lo} – ${hi} A) – unstable arc, risk of cold lap.`), 'warn');
          sayOnce('hot', I > hi, L(`Prúd je vysoký pre elektródu Ø${de} – veľký rozstrek a prepal.`, `The current is high for a Ø${de} electrode – heavy spatter and burn-through.`), 'warn');
          sayOnce('long', st.la > de + 1.5, L('Oblúk je dlhý – rozstrek a póry. Drž elektródu bližšie.', 'The arc is long – spatter and porosity. Keep the electrode closer.'), 'warn');
          sayOnce('sag', (c.wPos === 'PF' || c.wPos === 'PG' || c.wPos === 'PE' || c.wPos === 'PD') && I > hi * 0.9, L('V tejto polohe kúpeľ steká – zníž prúd.', 'In this position the pool runs – reduce the current.'), 'warn');
          spAcc += dt * (25 + (st.la > de + 1 ? 70 : 0) + (I > hi ? 60 : 0));
          smAcc += dt * 14;
        }
        // rozstrek a dym
        tipW.copy(pivot.localToWorld(tmp.set(st.tx, surf, st.tz)));
        nW.copy(nrm());
        while (spAcc >= 1) { spAcc -= 1; st.spat++; const a = Math.random() * TAU, s = 0.8 + Math.random() * 2.2; spatter.spawn(sP.copy(tipW).addScaledVector(nW, 0.02), sV.set(Math.cos(a) * s, 0, Math.sin(a) * s).addScaledVector(nW, 1 + Math.random() * 2), 0.35 + Math.random() * 0.4, 9, 0); }
        while (smAcc >= 1) { smAcc -= 1; smoke.spawn(sP.set((Math.random() - 0.5) * 0.1, 0.05, (Math.random() - 0.5) * 0.1).add(tipW), sV.set((Math.random() - 0.5) * 0.25, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.25), 2.2 + Math.random(), -0.4, 0); }
      }

      // chladnutie
      if (F.hot > 0.01 || st.arc) {
        const k = Math.exp(-dt / 2.6), hb = F.hb;
        if (hb) for (let j = hb[2]; j <= hb[3]; j++) for (let i = hb[0], q = idxOf(hb[0], j); i <= hb[1]; i++, q++) if (F.temp[q] > 0) F.temp[q] *= k;
        F.cooling = true;
      } else F.hb = null;                                               // všetko vychladlo
      if ((F.dirty || st.geomDirty || F.cooling) && t - st.lastBuild > 0.1) {
        if (F.dirty || st.geomDirty || !F.hb) rebuildField(st.geomDirty); else rebuildGlow(F.hb);   // pri samotnom chladnutí len žiara v ohriatej oblasti
        F.dirty = false; F.cooling = false; st.geomDirty = false; st.lastBuild = t;
      }

      // elektróda, držiak, oblúk (pri prezeraní zvarenca zostáva držiak na mieste)
      weldG.updateMatrixWorld(true);
      if (!c.unclamped) {
      nW.copy(nrm()); xW.set(1, 0, 0).transformDirection(weldG.matrixWorld);
      tipW.copy(pivot.localToWorld(tmp.set(st.tx, surf + st.la, st.tz)));       // hrot elektródy pri zváraní
      dirW.copy(nW).multiplyScalar(Math.cos(0.35)).addScaledVector(xW, -Math.sin(0.35)).normalize();
      let endW;
      if (MIG) {
        // horák: kontaktná špička vo vzdialenosti výletu drôtu od dielu, drôt trčí z hubice k oblúku
        const stick = Math.max(0.02, (c.ctwd - st.la) / 100), wr = Math.max(0.004, c.wire / 200);
        holder.position.copy(tipW).addScaledVector(dirW, stick);
        q.setFromUnitVectors(UP, dirW); torch.quaternion.copy(q);
        wireM.scale.set(wr, stick, wr); wireM.position.set(0, -stick / 2, 0);
        endW = tmp2.copy(holder.position).addScaledVector(dirW, 2.85);
      } else {
        const rr = de / 200;
        // skupina držiaka stojí v čeľustiach; elektróda z nich trčí smerom k zvarencu
        const len = jawLen >= 0 ? jawLen : st.le / 100;
        holder.position.copy(tipW).addScaledVector(dirW, len);
        if (drop) { const sl = st.swap ? st.swap.oldLe / 100 : 0; dropStub(sl, rr, tmp.copy(holder.position).addScaledVector(dirW, -sl), dirW); }
        const rodLen = st.le / 100;
        q.setFromUnitVectors(UP, dirW);
        elRod.visible = elCore.visible = rodLen > 0.05;
        elRod.quaternion.copy(q); elRod.scale.set(rr * 1.6, Math.max(0.01, rodLen - 0.25), rr * 1.6); elRod.position.copy(dirW).multiplyScalar(0.005 + (rodLen - 0.25) / 2 - rodLen).addScaledVector(xW, slide * 1.1);
        elCore.quaternion.copy(q); elCore.scale.set(rr, 0.3, rr); elCore.position.copy(dirW).multiplyScalar(-0.12).addScaledVector(xW, slide * 1.1);
        hJaw.quaternion.copy(q); hJaw.position.copy(dirW).multiplyScalar(-0.05);
        endW = tmp2.copy(holder.position).addScaledVector(dirW, 2.45);
      }
      const key = `${endW.x.toFixed(2)}|${endW.y.toFixed(2)}|${endW.z.toFixed(2)}`;   // kábel podľa konca rukoväte
      if (key !== cableKey && t - cableT > 0.05) {                     // kábel sa prestavuje najviac 20× za s
        cableKey = key; cableT = t;
        // kábel ide cez prednú hranu stola a voľne visí k zváračke (neprechádza stolom)
        const edge = v3(clamp(endW.x * 0.6 + 1.6, -4.4, 4.6), TT + 0.1, 3.12), drop = v3(edge.x + 0.8, TT - 3.2, 3.9);
        // MIG: hadicové vedenie visí zo stola a stúpa k centrálnej prípojke podávača
        const pts = MIG
          ? [endW.clone().addScaledVector(dirW, 0.2), endW.clone().addScaledVector(dirW, 0.9).add(v3(0, -0.3, 0)), edge.clone().add(v3(0, 0.25, -0.3)), edge, v3(edge.x + 1.6, TT - 2.2, 4.2), sockW[0].clone().lerp(edge, 0.3).add(v3(0, -1.4, 0.6)), sockW[0].clone().lerp(edge, 0.08), sockW[0]]
          : [endW.clone().addScaledVector(dirW, 0.2), endW.clone().addScaledVector(dirW, 0.9).add(v3(0, -0.3, 0)), edge.clone().add(v3(0, 0.25, -0.3)), edge, drop, sockW[0].clone().add(v3(0, -0.5, 0.6)), sockW[0]];
        const curve = new THREE.CatmullRomCurve3(pts.map((p) => holder.worldToLocal(p.clone())));
        hCable.geometry.dispose(); hCable.geometry = new THREE.TubeGeometry(curve, 56, MIG ? 0.09 : 0.055, 8, false);
      }
      }
      const arcPos = pivot.localToWorld(tmp.set(st.tx, surf + st.la * 0.5, st.tz));
      // kolísanie oblúka: nová hodnota ~11× za sekundu (nie v každom snímku), bez efektov stály jas
      flickT += dt;
      if (flickT > 0.09) { flickT = 0; flick = 0.85 + Math.random() * 0.3; }
      const fl = c.flashFx ? flick : 1;
      arcCore.visible = halo.visible = st.arc; arcCore.position.copy(arcPos); halo.position.copy(arcPos); halo.scale.setScalar(0.7 + 0.35 * fl);
      arcLight.position.copy(arcPos).addScaledVector(nW, 0.15); arcLight.intensity = st.arc ? 5 * fl * LIGHT_K : 0;
      jaw.rotation.z = c.ground ? 0 : 0.5; jaw.position.y = clampAt.y + (c.ground ? 0 : 0.25);
      if (brLever) brLever.rotation.x = c.tripped ? 0.8 : 0;
      if (fr) {
        fr.update(dt, { feed: st.arc ? c.vd : 0, flow: c.valve ? c.flow : 0, valveOpen: c.valve });
        const sy = migSynergic({ wire: c.wire, vd: c.vd, prog: c.prog, gas: c.gas, corr: c.corr });
        fr.drawPanel({ power: c.power, I: st.arc ? I : sy.I, U: sy.U, vd: c.vd, prog: c.prog, trig: c.trig, arc: st.arc });
        fr.setGas(c.gas);
      }
      spatter.update(dt, () => -1); smoke.update(dt, () => 99); updateStubs(dt);

      // záblesk bez kukly a sklo kukly
      const fe = flashRef.current, ge = glassRef.current;
      if (fe) {
        // s efektmi: okamžitý záblesk s jemným kolísaním v svetlej oblasti; bez efektov plynulý nábeh na stály jas
        const prevOp = parseFloat(fe.style.opacity) || 0;
        const op = st.arc && !c.helmet ? (c.flashFx ? 0.82 + 0.4 * (fl - 0.85) : Math.min(0.55, prevOp + dt * 2)) : Math.max(0, prevOp - dt * 2.5);
        fe.style.opacity = op.toFixed(3);
        if (st.arc) { const v = arcPos.clone().project(camera); fe.style.setProperty('--fx', `${((v.x + 1) / 2 * 100).toFixed(1)}%`); fe.style.setProperty('--fy', `${((1 - v.y) / 2 * 100).toFixed(1)}%`); }
      }
      if (ge) {
        if (c.helmetType === 'old') { const want = st.arc; if (ge.classList.contains('arc') !== want) ge.classList.toggle('arc', want); ge.style.backdropFilter = ''; ge.style.webkitBackdropFilter = ''; }
        else {
          // samostmievací filter: svetlý bez oblúka, pri oblúku okamžite stmavne na zvolený stupeň, po zhasnutí sa po oneskorení zosvetlí
          const dark = st.arc || t - (st.arcOff || -9) < c.adfDelay;
          const b = { 9: 0.62, 10: 0.54, 11: 0.46, 12: 0.38, 13: 0.3 }[c.shade] || 0.46;
          const f = dark ? `brightness(${b}) contrast(1.35) saturate(.75)` : 'brightness(.9) saturate(.92)';
          if (ge.style.backdropFilter !== f) { ge.style.backdropFilter = f; ge.style.webkitBackdropFilter = f; }
        }
      }
      const needShade = I < 60 ? 9 : I <= 100 ? 10 : I <= 150 ? 11 : 12;
      sayOnce('shade', st.arc && c.helmet && c.helmetType === 'auto' && c.shade < needShade, L(`Filter je príliš svetlý – pre ${I} A nastav aspoň DIN ${needShade}.`, `The filter is too light – for ${I} A set at least DIN ${needShade}.`), 'warn');
      sayOnce('flash', st.arc && !c.helmet, L('Oslňujúci záblesk! Pri zváraní spusti kuklu (H).', 'Blinding flash! Lower the helmet when welding (H).'), 'danger');

      ctrl.update(dt);
      insp.update(t, c);

      if (t - statT > 0.5) { statT = t; stats = evalWeld(); }
      if (t - teleT > 0.1) {
        teleT = t;
        setTele({ arc: st.arc, I: st.arc ? Math.round(I) : 0, la: st.la, v: st.v, le: st.le, stuck: st.stuck, swap: !!st.swap, msg: st.msg && st.msg.until > t ? st.msg : null, stats, hot: F.hot,
          flashes: st.flashes, ...(MIG ? { U: st.arc ? syn.U : 0, mode: syn.mode, cover, wire: st.wire } : {}) });
        if (Object.keys(pend).length) { const p = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]); setUi((u) => ({ ...u, ...p })); }
      }
      if (MIG) snd.update({ motor: st.arc ? 0.25 + c.vd / 30 : 0, arc: st.arc });
      else snd.update({ on: (c.mode === 'w380' || c.mode === 'w220') && !c.tripped, arc: st.arc });
      renderer.render(scene, camera);
    };

    // ---------- hodnotenie zvaru ----------
    const evalWeld = () => {
      const { NX, t: th } = F; const prof = weldProfile(F.type, th, F.prep);
      let wTop = 6; for (let z = 0; z <= W2; z += 0.5) { if (prof(z) >= th - 0.01 && prof(-z) >= th - 0.01) { wTop = z + 4; break; } }
      if (F.type === 'K') wTop = th / 2 + 10; if (F.type === 'L') wTop = 10; if (F.type === 'E') wTop = th + 5; if (F.type === 'N') wTop = W2;
      let covered = 0, grooveSum = 0, fillSum = 0, reinf = 0, widthSum = 0, depAll = 0, depTotal = 0;
      for (let k = 0; k < F.dep.length; k++) depTotal += F.dep[k] * RES;
      for (let i = 0; i <= NX; i++) {
        let dsum = 0, w = 0, top = 0;
        for (let j = Math.max(0, Math.round((W2 - wTop) / RES)); j <= Math.min(NZ, Math.round((W2 + wTop) / RES)); j++) {
          const k = idxOf(i, j), g = Math.max(0, th - F.h0[k]);
          if (F.type !== 'K' && F.type !== 'L' && F.type !== 'N') { grooveSum += g * RES; fillSum += Math.min(g, F.dep[k]) * RES; }
          dsum += F.dep[k] * RES; if (F.dep[k] > 0.2) w += RES;
          if (F.dep[k] > 0.1) top = Math.max(top, F.h[k] - (F.type === 'L' ? 2 * th : F.type === 'E' ? 3 * th : th));
        }
        depAll += dsum;
        if (dsum > 2) { covered++; widthSum += w; reinf += Math.max(0, top); }
      }
      if (depTotal < 1) return null;
      const cov = covered / (NX + 1), off = F.type === 'N' ? 0 : Math.max(0, 1 - depAll / depTotal);
      return { cov, off, fill: grooveSum > 0 ? fillSum / grooveSum : null, width: covered ? widthSum / covered : 0, reinf: covered ? reinf / covered : 0, spat: st.spat, cold: st.cold, longArc: st.longArc, fast: st.fast, sag: st.sag, wrongDir: st.wrongDir, por: st.por,
        rootRisk: F.type === 'I' && th > 4, thinPrep: (F.type === 'V' || F.type === 'HV' || F.type === 'Y') && th < 4 };
    };

    try { if (/[?&]debug/.test(window.location.search)) window.__weld = { F, st, evalWeld, W2, RES, jointZ, aimAt: (cx, cy) => { aimAt(cx, cy); return { ...st.aim }; }, proj: (x, z) => { const r = dom.getBoundingClientRect(), v = pivot.localToWorld(v3(x, surfAt(x, z) == null ? F.t : surfAt(x, z), z)).project(camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; } }; } catch (err) { /* ignorované */ }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); insp.dispose(); wi.dispose();
      dom.removeEventListener('pointerdown', pd, { capture: true }); dom.removeEventListener('pointermove', pm, { capture: true });
      dom.removeEventListener('pointerup', pu, { capture: true }); dom.removeEventListener('pointercancel', pu, { capture: true });
      dom.removeEventListener('wheel', wh, { capture: true });
      try { if (window.__weld && window.__weld.F === F) delete window.__weld; } catch (err) { /* ignorované */ }
      disposeStage();
    };
  }, []);

  const parts = MIG ? migParts() : weldParts();
  // MIG/MAG: synergický bod z nastavenia (aj bez oblúka), odporúčaný prúd podľa hrúbky plechu
  const syn = MIG ? migSynergic({ wire: ui.wire, vd: ui.vd, prog: ui.prog, gas: ui.gas, corr: ui.corr }) : null;
  const synI = MIG ? Math.round(stickoutI(syn.I, ui.ctwd)) : 0;
  const cover = MIG ? gasCover({ valve: ui.valve, flow: ui.flow, ctwd: ui.ctwd }) : 1;
  const [lo, hi] = MIG ? migRange(ui.wT) : (ELECTRODES[ui.etype].r[ui.de] || [60, 120]);
  const modeName = (m) => { const n = MODE_NAMES[m] || MODE_NAMES.short; return L(n[0], n[1]); };
  const wt = WELD_TYPES.find((w) => w.id === ui.wType);
  const prep = weldPrep(ui.wType, ui.wT);
  const fmt = (v, d = 1) => L(v.toFixed(d).replace('.', ','), v.toFixed(d));
  const prepText = ['I', 'V', 'HV', 'Y', 'U', 'J'].includes(ui.wType)
    ? `${L('Medzera', 'Gap')} ${fmt(prep.gap)} mm${ui.wType !== 'I' ? `, ${L('otupenie', 'root face')} ${fmt(prep.root)} mm, ${ui.wType === 'U' || ui.wType === 'J' ? `R ${prep.R} mm, ${L('boky', 'sides')} ${prep.ang}°` : `${L('úkos', 'bevel')} ${ui.wType === 'HV' ? 45 : 60}°`}` : ''}.`
    : ui.wType === 'K' ? `${L('Kútový zvar s výškou', 'Fillet weld, throat')} a ≈ ${fmt(0.7 * ui.wT)} mm (${L('rameno', 'leg')} ≈ ${fmt(ui.wT)} mm).`
    : ui.wType === 'L' ? L('Presah dielov – kútový zvar na hrane horného plechu.', 'Overlapping parts – fillet on the edge of the upper plate.')
    : ui.wType === 'E' ? L('Okraje plechov ohnuté nahor – zvar sa robí bez prídavného materiálu natavením lemov.', 'Sheet edges flanged up – welded by melting the flanges.')
    : L('Navárať sa dá kdekoľvek na plech – húsenice vedľa seba s prekrytím asi tretiny, ďalšie vrstvy sa ukladajú na predchádzajúce.', 'You can build up material anywhere on the plate – beads side by side overlapping about a third, further layers go on top of the previous ones.');
  const curNow = MIG ? synI : ui.current;
  const groove = ['V', 'HV', 'Y', 'U', 'J'].includes(ui.wType) ? Math.max(1, Math.round((ui.wT * ui.wT * 0.45) / ((MIG ? syn.dep : 0.42 * ui.current) / 3))) : 1;
  const thWarn = ui.wT < wt.t[0] || ui.wT > wt.t[1];
  const s = tele.stats;
  const defects = [];
  if (s) {
    if (s.cold > 0.8) defects.push(L('studený spoj (nízky prúd)', 'cold lap (low current)'));
    if (MIG && s.por > 0.5) defects.push(L('póry (slabá plynová ochrana)', 'porosity (poor gas shielding)'));
    if (MIG && s.spat > 400) defects.push(L('veľký rozstrek', 'heavy spatter'));
    if (s.longArc > 1.2) defects.push(L('póry a rozstrek (dlhý oblúk)', 'porosity and spatter (long arc)'));
    if (s.fast > 1.2) defects.push(L('úzka húsenica, neprevarenie (rýchly posuv)', 'narrow bead, lack of fusion (fast travel)'));
    if (s.off > 0.4) defects.push(L(`${Math.round(s.off * 100)} % kovu je mimo spoja – veď ${MIG ? 'horák' : 'elektródu'} po modrej čiare`, `${Math.round(s.off * 100)} % of the metal is off the joint – guide the ${MIG ? 'torch' : 'electrode'} along the blue line`));
    if (s.wrongDir > 0.8) defects.push(L('zlý smer zvárania pre túto polohu', 'wrong travel direction for this position'));
    if (s.sag > 0.8) defects.push(L('stekanie kúpeľa (vysoký prúd v polohe)', 'sagging pool (current too high for the position)'));
    if (s.fill != null && s.cov > 0.6 && s.fill < 0.9) defects.push(L('neúplne vyplnený úkos – pridaj ďalšie vrstvy', 'groove not completely filled – add more passes'));
    if (s.reinf > 3.2) defects.push(L('príliš veľké prevýšenie', 'excessive reinforcement'));
    if (s.rootRisk) defects.push(L('pri zvare I nad 4 mm hrozí neprevarený koreň', 'square butt over 4 mm risks lack of root fusion'));
  }
  const setupTask = (task) => {
    if (tele.arc) return;
    Object.entries(task.setup).forEach(([k, v]) => set(k, v));
    if (apiRef.current.newParts) apiRef.current.newParts();
  };
  const statusMsg = tele.msg ? tele.msg
    : ui.unclamped ? { kind: 'info', text: L('Prezeráš si zvarenec – ťahaním ho otáčaš.', 'Inspecting the weldment – drag to rotate it.') }
    : tele.arc && MIG ? { kind: 'run', text: `${L('Oblúk horí', 'Arc burning')} – ${tele.I} A, ${fmt(tele.U)} V, ${modeName(tele.mode)}, ${L('posuv', 'travel')} ${fmt(tele.v)} mm/s` }
    : tele.arc ? { kind: 'run', text: `${L('Oblúk horí', 'Arc burning')} – ${tele.I} A, ${L('oblúk', 'arc')} ${fmt(tele.la)} mm, ${L('posuv', 'travel')} ${fmt(tele.v)} mm/s` }
    : tele.stuck ? { kind: 'danger', text: L('Elektróda je prilepená – pusti tlačidlá.', 'The electrode is stuck – release the buttons.') }
    : MIG && !ui.manual ? { kind: 'idle', text: L('Prepni na režim Zváranie (M) – potom drž pravé tlačidlo a veď horák, ľavé tlačidlo je spúšťač. Kukla: H.', 'Switch to welding mode (M) – then hold the right button to guide the torch, the left button is the trigger. Helmet: H.') }
    : MIG ? { kind: 'idle', text: ui.trig === '4T' ? L('4-takt: ľavým tlačidlom (pri držanom pravom) oblúk zapáliš, ďalším stlačením zhasneš. Kukla: H.', '4-step: press the left button (with the right held) to start the arc, press again to stop. Helmet: H.') : L('Drž pravé tlačidlo a veď horák k spoju, ľavým (spúšťač) zváraš, kým ho držíš. Kukla: H.', 'Hold the right button to guide the torch to the joint, the left one (trigger) welds while held. Helmet: H.') }
    : !ui.manual ? { kind: 'idle', text: L('Prepni na režim Zváranie (M) – potom drž pravé tlačidlo a veď elektródu, ľavým zapáliš oblúk. Kukla: H.', 'Switch to welding mode (M) – then hold the right button to guide the electrode, press the left one to strike the arc. Helmet: H.') }
    : { kind: 'idle', text: L('Drž pravé tlačidlo a veď elektródu k spoju, ľavým tlačidlom zapáliš oblúk. Kukla: H.', 'Hold the right button to guide the electrode to the joint, press the left button to strike the arc. Helmet: H.') };
  const chips = [{ color: tele.arc ? '#ffffff' : '#8b8f89', text: tele.arc ? L('Oblúk', 'Arc') : L('Oblúk zhasnutý', 'No arc') }];
  if (ui.helmet) chips.push({ color: '#3ee06c', text: L('Kukla dole', 'Helmet down') });
  if (tele.hot > 0.15) chips.push({ color: '#ff7a2a', text: L('Horúci zvar', 'Hot weld') });
  if (MIG && !ui.power) chips.push({ color: '#ff5a3c', text: L('Zdroj vypnutý', 'Source off') });
  if (MIG && cover < 0.7) chips.push({ color: '#ff7a2a', text: L('Bez plynovej ochrany', 'No gas shielding') });
  if (ui.tripped) chips.push({ color: '#ff5a3c', text: L('Istič vypadol', 'Breaker tripped') });
  const overlay = (<>
    {ui.helmet && (
      <div className={`helmet ${ui.helmetType}`}>
        <div ref={glassRef} className="helmet-glass" />
        <div className="helmet-tag">{ui.helmetType === 'auto'
          ? `${L('Samostmievacia kukla', 'Auto-darkening helmet')} · DIN ${ui.shade} · ${fmt(ui.adfDelay)} s · ${L('H zdvihne', 'H lifts')}`
          : L('Stará kukla · pevné sklo DIN 11 · H zdvihne', 'Old helmet · fixed DIN 11 glass · H lifts')}</div>
      </div>
    )}
    <div ref={flashRef} className="flash" />
    {!MIG && tele.le < 30 && !tele.swap && !tele.arc && !ui.unclamped && (
      <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ bottom: 70, zIndex: 7 }}>
        <div className="pop-in desc" role="alert" style={{ pointerEvents: 'auto', marginTop: 0, background: 'var(--chrome)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}>
          <div className="text-sm mb-2">{L('Elektróda je spotrebovaná.', 'The electrode is used up.')}</div>
          <button type="button" className="scene-btn on" style={{ fontSize: 15, padding: '9px 16px' }} onClick={() => apiRef.current.newElectrode && apiRef.current.newElectrode()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" /></svg>
            {L('Vymeň elektródu (E)', 'Replace electrode (E)')}
          </button>
        </div>
      </div>
    )}
  </>);

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef}
        workLabels={[L('Prezrieť si zvarenec', 'Inspect the weldment'), L('Vrátiť na stôl', 'Back to the table')]} overlay={overlay}
        manualLabel={L('Zváranie', 'Welding')}
        tools={<>
          <button type="button" className={`scene-btn ${ui.helmet ? 'on' : ''}`} aria-pressed={ui.helmet} onClick={() => set('helmet', !ui.helmet)} title="H">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M5 10a7 7 0 0 1 14 0v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" /><path d="M8 11h8v4H8z" /></svg>
            {ui.helmet ? L('Kukla spustená', 'Helmet down') : L('Kukla zdvihnutá', 'Helmet up')}
          </button>
          {!MIG && <button type="button" className="scene-btn" disabled={!ui.slag || ui.unclamped} style={{ opacity: ui.slag ? 1 : 0.5 }} onClick={() => { if (apiRef.current.chip && apiRef.current.chip()) set('slag', false); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4l6 6-3 3-6-6zM11 7l-7 7 3 3 7-7" /></svg>
            {L('Otĺcť trosku', 'Chip slag')}
          </button>}
        </>}
        hint={L('Ťahaj: otáčanie · pravé tlačidlo: posun · koliesko: zoom · M: režim Zváranie · H: kukla', 'Drag: orbit · right button: pan · wheel: zoom · M: welding mode · H: helmet')}
        manualHint={MIG ? <><b className="ink">{L('Zváranie:', 'Welding:')}</b> {L('drž pravé tlačidlo a veď horák, ľavé tlačidlo pri držanom pravom je spúšťač (2T / 4T), koliesko s pravým mení výlet drôtu. Na dotyku 1 prst vedie, 2 prsty zvárajú. Kameru vráti M alebo Esc.', 'hold the right button to guide the torch, the left button with the right held is the trigger (2T / 4T), the wheel with the right button sets the stick-out. On touch 1 finger guides, 2 fingers weld. M or Esc returns to the camera.')}</> : <><b className="ink">{L('Zváranie:', 'Welding:')}</b> {L('drž pravé tlačidlo a veď elektródu, ľavým pri držanom pravom zapáliš oblúk, koliesko s pravým mení dĺžku oblúka. Na dotyku 1 prst vedie, 2 prsty zvárajú. Kameru vráti M alebo Esc.', 'hold the right button to guide the electrode, press the left one as well to strike the arc, the wheel with the right button sets the arc length. On touch 1 finger guides, 2 fingers weld. M or Esc returns to the camera.')}</>} />
      <aside className="panel">
        {MIG ? (
          <PanelHeader ui={ui} set={set} kicker={L('Simulátor · zváranie MIG/MAG', 'Simulator · MIG/MAG welding')} title={L('Zváranie v ochrannom plyne', 'Gas metal arc welder')}
            sub={L('Predloha: invertorový zdroj Fronius TransPuls Synergic TPS 450 s podávačom drôtu VR 4000 a chladiacim modulom FK.', 'Modelled after the Fronius TransPuls Synergic TPS 450 inverter source with a VR 4000 wire feeder and an FK cooling unit.')}
            rows={[[L('Prúd A', 'Current A'), String(tele.arc ? tele.I : synI)], [L('Napätie V', 'Voltage V'), (tele.arc ? tele.U : syn.U).toFixed(1)], [L('Drôt m/min', 'Wire m/min'), ui.vd.toFixed(1)]]}
            foot={[`Ø${L(String(ui.wire).replace('.', ','), String(ui.wire))} G3Si1 · ${ui.gas}`, `${L('výlet', 'stick-out')} ${ui.ctwd} mm · ${ui.trig}`]} status={statusMsg} />
        ) : (
          <PanelHeader ui={ui} set={set} kicker={L('Simulátor · zváranie', 'Simulator · welding')} title={L('Oblúková zváračka', 'Arc welder')}
            sub={L('Predloha: transformátorová zváračka Elektrokov JS 90FN, ručné zváranie obalenou elektródou (MMA).', 'Modelled after the Elektrokov JS 90FN transformer welder, manual metal arc welding (MMA).')}
            rows={[[L('Prúd A', 'Current A'), String(tele.I)], [L('Oblúk mm', 'Arc mm'), tele.la.toFixed(1)], [L('Posuv mm/s', 'Travel mm/s'), tele.v.toFixed(1)]]}
            foot={[`Ø${ui.de} ${ui.etype === 'rutile' ? 'E 6013' : 'E 7018'}`, `${L('elektróda', 'electrode')} ${Math.round(tele.le)} mm`]} status={statusMsg} />
        )}

        <TaskSection machine={MIG ? 'mag' : 'zvaranie'} tasks={MIG ? MIG_TASKS : WELD_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'manual', items: MIG ? MIG_SAFETY() : WELD_SAFETY() }} />

        {MIG && (<>
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Zdroj TPS 450', 'TPS 450 source')}</h2>
            <Toggle on={ui.power} label={L('Hlavný vypínač zapnutý', 'Main switch on')} onClick={() => set('power', !ui.power)} />
            <SegRow label={L('Proces', 'Process')} value={ui.prog} options={[['std', L('Synergic štandard', 'Synergic standard')], ['pulse', L('Synergic impulz', 'Synergic pulse')]]} onChange={(v) => set('prog', v)} />
            <SegRow label={L('Horák', 'Torch')} value={ui.trig} options={[['2T', L('2-takt', '2-step')], ['4T', L('4-takt', '4-step')]]} onChange={(v) => set('trig', v)} />
            <Toggle on={ui.ground} label={L('Zemniaca svorka pripojená', 'Ground clamp attached')} onClick={() => set('ground', !ui.ground)} />
            <p className="text-xs muted mt-2">{L('2-takt: zvára sa, kým držíš spúšťač – na krátke zvary a stehy. 4-takt: stlač a pusti = štart, znova = koniec – na dlhé zvary.', '2-step: welds while you hold the trigger – for short welds and tacks. 4-step: press and release = start, again = stop – for long welds.')}</p>
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Synergický program', 'Synergic program')}</h2>
            <SegRow label={L('Drôt G3Si1', 'Wire G3Si1')} value={ui.wire} options={MIG_WIRES.map((d) => [d, `Ø${L(String(d).replace('.', ','), String(d))}`])} onChange={(v) => set('wire', v)} />
            <SegRow label={L('Plyn', 'Gas')} value={ui.gas} options={Object.entries(MIG_GASES).map(([k, g]) => [k, L(g.sk, g.en)])} onChange={(v) => set('gas', v)} />
            <Slider id="mvd" label={L('Rýchlosť drôtu', 'Wire speed')} unit="m/min" min={1} max={22} step={0.5} value={ui.vd} digits={1} onChange={(v) => set('vd', v)} />
            <Slider id="mco" label={L('Korekcia dĺžky oblúka', 'Arc length correction')} unit="V" min={-3} max={3} step={0.5} value={ui.corr} digits={1} onChange={(v) => set('corr', v)} />
            <div className="desc" style={{ marginTop: 0 }}>
              <div><b>{synI} A</b> · <b>{fmt(syn.U)} V</b> · {modeName(syn.mode)}</div>
              <div className="mt-1">{L(`Odporúčaný prúd pre plech ${ui.wT} mm: ${lo} – ${hi} A.`, `Recommended current for a ${ui.wT} mm plate: ${lo} – ${hi} A.`)}</div>
              {syn.overload && <div className="mt-1" style={{ color: 'var(--warn)' }}>{L(`Na drôt Ø${String(ui.wire).replace('.', ',')} je prúd príliš vysoký – zvoľ hrubší drôt.`, `The current is too high for a Ø${ui.wire} wire – choose a thicker one.`)}</div>}
              {syn.mode === 'globular' && <div className="mt-1" style={{ color: 'var(--warn)' }}>{ui.gas === 'C1' ? L('V čistom CO₂ nevznikne sprchový prenos – rozstrek je väčší.', 'Pure CO₂ gives no spray transfer – more spatter.') : L('Prechodová oblasť – veľký rozstrek. Zmeň rýchlosť drôtu alebo zapni impulz.', 'Globular range – heavy spatter. Change the wire speed or switch to pulse.')}</div>}
            </div>
            <p className="text-xs muted mt-2">{L('Synergia: zvolíš drôt a plyn, rýchlosťou drôtu nastavíš výkon – zdroj sám dopočíta prúd a napätie. Korekciou predĺžiš (+) alebo skrátiš (−) oblúk.', 'Synergic: choose the wire and gas, set the power with the wire speed – the source works out current and voltage. The correction lengthens (+) or shortens (−) the arc.')}</p>
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Plyn a horák', 'Gas and torch')}</h2>
            <Toggle on={ui.valve} label={L('Ventil plynovej fľaše otvorený', 'Gas cylinder valve open')} onClick={() => set('valve', !ui.valve)} />
            <Slider id="mfl" label={L('Prietok plynu', 'Gas flow')} unit="l/min" min={0} max={25} step={1} value={ui.flow} onChange={(v) => set('flow', v)} />
            <Slider id="mct" label={L('Výlet drôtu (vzdialenosť špičky)', 'Stick-out (contact tip distance)')} unit="mm" min={2} max={30} step={1} value={ui.ctwd} onChange={(v) => set('ctwd', v)} />
            <Slider id="mhv" label={L('Najvyššia rýchlosť ruky pri zváraní', 'Max hand speed while welding')} unit="mm/s" min={1} max={20} step={0.5} value={ui.handV} digits={1} onChange={(v) => set('handV', v)} />
            <p className="text-xs muted mt-1" style={{ color: cover < 0.7 ? 'var(--warn)' : undefined }}>{L(`Plynová ochrana: ${Math.round(cover * 100)} %. Prietok 12 – 16 l/min, výlet 10 – 15 mm. Dlhší výlet zníži prúd a plyn kúpeľ nechráni.`, `Gas shielding: ${Math.round(cover * 100)} %. Flow 12 – 16 l/min, stick-out 10 – 15 mm. A longer stick-out lowers the current and the gas no longer covers the pool.`)}</p>
            {ui.manual && <p className="text-xs muted mt-1">{L(`Drôtu spotrebovaného: ${fmt(tele.wire || 0)} m.`, `Wire used: ${fmt(tele.wire || 0)} m.`)}</p>}
          </div>
        </>)}

        {!MIG && (<>
        <div className="sec">
          <h2 className="sec-title mb-2">{L('Zváračka', 'Welder')}</h2>
          <SegRow label={L('Prepínač', 'Switch')} value={ui.mode} options={[['off', '0'], ['w380', '380 V'], ['w220', '220 V'], ['charge', L('Nabíjanie', 'Charging')]]} onChange={(v) => set('mode', v)} />
          <div className="text-sm font-semibold mb-1">{L('Zvárací prúd', 'Welding current')}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {WELD_DIAL.map((a) => <button key={a} type="button" className={`btn ${ui.current === a ? 'active' : ''}`} aria-pressed={ui.current === a} onClick={() => set('current', a)}>{a} A</button>)}
          </div>
          <Toggle on={ui.ground} label={L('Zemniaca svorka pripojená', 'Ground clamp attached')} onClick={() => set('ground', !ui.ground)} />
          {ui.tripped && <button type="button" className="btn w-full mt-2" onClick={() => set('tripped', false)}>{L('Zapnúť istič', 'Reset the breaker')}</button>}
          <p className="text-xs muted mt-2">{L('Pri 220 V je dovolený prúd najviac 75 A – inak istič vypadne.', 'On 220 V the current is limited to 75 A – otherwise the breaker trips.')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Elektróda', 'Electrode')}</h2>
          <SegRow label={L('Druh', 'Type')} value={ui.etype} options={Object.entries(ELECTRODES).map(([k, e]) => [k, L(e.sk, e.en)])}
            onChange={(v) => { set('etype', v); if (!ELECTRODES[v].r[ui.de]) set('de', 3.2); }} />
          <SegRow label={L('Priemer', 'Diameter')} value={ui.de} options={Object.keys(ELECTRODES[ui.etype].r).map(Number).sort((a, b) => a - b).map((d) => [d, `Ø${L(String(d).replace('.', ','), String(d))}`])} onChange={(v) => set('de', v)} />
          <p className="text-xs muted mb-2">{L(`Odporúčaný prúd pre Ø${ui.de}: ${lo} – ${hi} A. Dĺžka oblúka ≈ priemer elektródy.`, `Recommended current for Ø${ui.de}: ${lo} – ${hi} A. Arc length ≈ electrode diameter.`)}</p>
          <Slider id="wla" label={L('Dĺžka oblúka (výška elektródy)', 'Arc length (electrode height)')} unit="mm" min={0} max={12} step={0.5} value={ui.arcLen} digits={1} onChange={(v) => set('arcLen', v)} />
          <Slider id="whv" label={L('Najvyššia rýchlosť ruky pri zváraní', 'Max hand speed while welding')} unit="mm/s" min={1} max={20} step={0.5} value={ui.handV} digits={1} onChange={(v) => set('handV', v)} />
          <Toggle on={ui.autoArc} label={L('Ruka dorovnáva opaľovanie elektródy', 'Hand compensates electrode burn-off')} onClick={() => set('autoArc', !ui.autoArc)} />
          <p className="text-xs muted mt-1">{L('Elektróda ide za kurzorom (modrý krúžok) najviac touto rýchlosťou – bežne 2 – 6 mm/s. Pomalší posuv dá širšiu a vyššiu húsenicu.', 'The electrode follows the cursor (blue ring) at most at this speed – typically 2 – 6 mm/s. Slower travel gives a wider, higher bead.')}</p>
          <button type="button" className="btn w-full mt-2" disabled={tele.swap || tele.arc} onClick={() => apiRef.current.newElectrode && apiRef.current.newElectrode()}>{L('Vymeniť elektródu (E)', 'Replace the electrode (E)')}</button>
        </div>
        </>)}

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Zvar a polotovar', 'Joint and parts')}</h2>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {WELD_TYPES.map((w) => (
              <button key={w.id} type="button" className={`weld-type ${ui.wType === w.id ? 'on' : ''}`} aria-pressed={ui.wType === w.id} onClick={() => set('wType', w.id)} title={L(w.sk, w.en)}>
                <svg viewBox="0 0 30 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={w.sym} /></svg>
                {L(w.sk, w.en)}
              </button>
            ))}
          </div>
          <div className="text-sm font-semibold mb-1">{L('Poloha zvárania', 'Welding position')}</div>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            {WELD_POS.map(([k, code, sk, en]) => (
              <button key={k} type="button" className={`tool-slot ${ui.wPos === k ? 'on' : ''}`} aria-pressed={ui.wPos === k} onClick={() => set('wPos', k)}>
                <b>{k} · {code}</b>{L(sk, en)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {WELD_POS_PIPE.map(([k, code]) => <button key={k} type="button" className="btn" disabled title={L('Rúrové polohy – pripravujeme', 'Pipe positions – coming soon')} style={{ opacity: 0.5 }}>{k} · {code}</button>)}
          </div>
          <p className="text-xs muted mb-3">{L('Rúrové polohy PH, PJ a H-L045 pripravujeme.', 'Pipe positions PH, PJ and H-L045 are coming soon.')}{FILLETS.includes(ui.wType) && ui.wPos === 'PC' ? ` ${L('PC je poloha pre tupé zvary.', 'PC is a butt-weld position.')}` : ''}{!FILLETS.includes(ui.wType) && (ui.wPos === 'PB' || ui.wPos === 'PD') ? ` ${L('PB a PD sú polohy pre kútové zvary.', 'PB and PD are fillet-weld positions.')}` : ''}</p>
          <Slider id="wt" label={L('Hrúbka plechu', 'Plate thickness')} unit="mm" min={1} max={30} step={1} value={ui.wT} onChange={(v) => set('wT', v)} />
          <Slider id="wl" label={L('Dĺžka zvaru', 'Weld length')} unit="mm" min={80} max={250} step={10} value={ui.wL} onChange={(v) => set('wL', v)} />
          <div className="desc" style={{ marginTop: 0 }}>
            <div className="font-semibold mb-1">{L('Zvarová príprava', 'Joint preparation')}: {L(wt.sk, wt.en)}</div>
            <div>{prepText}</div>
            {groove > 1 && <div className="mt-1">{L(`Odhad: ${groove} húseníc pri ${curNow} A.`, `Estimate: ${groove} passes at ${curNow} A.`)}</div>}
            {thWarn && <div className="mt-1" style={{ color: 'var(--warn)' }}>{L(`Tento druh zvaru sa používa pre hrúbky ${wt.t[0]} – ${wt.t[1]} mm.`, `This joint is used for thicknesses ${wt.t[0]} – ${wt.t[1]} mm.`)}</div>}
          </div>
          <button type="button" className="btn w-full mt-2" onClick={() => apiRef.current.newParts && apiRef.current.newParts()}>{L('Pripraviť nové diely', 'Prepare new parts')}</button>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Ochrana', 'Protection')}</h2>
          <SegRow label={L('Kukla', 'Helmet')} value={ui.helmetType} options={[['auto', L('Moderná (senzor)', 'Modern (sensor)')], ['old', L('Stará (pevné sklo)', 'Old (fixed glass)')]]} onChange={(v) => set('helmetType', v)} />
          <Toggle on={ui.helmet} label={L('Zváračská kukla spustená (H)', 'Welding helmet down (H)')} onClick={() => set('helmet', !ui.helmet)} />
          {ui.helmetType === 'auto' ? (<div className="mt-2">
            <Slider id="wsh" label={L('Stupeň stmavenia', 'Shade')} unit="DIN" min={9} max={13} step={1} value={ui.shade} onChange={(v) => set('shade', v)} />
            <Slider id="wdl" label={L('Oneskorenie zosvetlenia', 'Light-state delay')} unit="s" min={0.1} max={1} step={0.1} value={ui.adfDelay} digits={1} onChange={(v) => set('adfDelay', v)} />
            <p className="text-xs muted">{L('Senzory zachytia oblúk a sklo okamžite stmavne; bez oblúka je priehľadné, takže vidíš, kam priložíš elektródu.', 'The sensors detect the arc and the glass darkens instantly; without the arc it is clear, so you see where to place the electrode.')}</p>
          </div>) : <p className="text-xs muted mt-2">{L('Pevné tmavé sklo DIN 11 – bez oblúka cez neho takmer nič nevidno, elektródu treba priložiť naslepo.', 'Fixed dark DIN 11 glass – without the arc you can hardly see anything, the electrode has to be placed blind.')}</p>}
          <Toggle on={ui.flashFx} label={L('Efekty záblesku (blikanie oblúka)', 'Flash effects (arc flicker)')} onClick={() => set('flashFx', !ui.flashFx)} />
          <p className="text-xs muted mt-2">{L(`Bez kukly oblúk oslňuje celú obrazovku. Záblesky bez kukly: ${tele.flashes || 0}.`, `Without the helmet the arc blinds the whole screen. Flashes without helmet: ${tele.flashes || 0}.`)} {L('Pri vypnutých efektoch sa obrazovka rozjasní plynulo a nebliká.', 'With effects off the screen brightens smoothly and does not flicker.')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Hodnotenie zvaru', 'Weld assessment')}</h2>
          {s ? (<div className="text-sm" style={{ lineHeight: 1.6 }}>
            <div>{L('Zvarená dĺžka', 'Welded length')}: <b>{Math.round(s.cov * 100)} %</b></div>
            {s.fill != null && <div>{L('Vyplnenie úkosu', 'Groove filled')}: <b>{Math.round(s.fill * 100)} %</b></div>}
            <div>{L('Šírka húsenice', 'Bead width')}: <b>{fmt(s.width)} mm</b> · {L('prevýšenie', 'reinforcement')}: <b>{fmt(s.reinf)} mm</b></div>
            <div>{L('Rozstrek', 'Spatter')}: <b>{s.spat}</b>{MIG && <> · {L('póry', 'porosity')}: <b>{fmt(s.por || 0)} s</b></>}</div>
            <div className="mt-1" style={{ color: defects.length ? 'var(--warn)' : 'var(--accent)' }}>{defects.length ? `${L('Chyby', 'Defects')}: ${defects.join(', ')}.` : L('Bez zjavných chýb.', 'No obvious defects.')}</div>
          </div>) : <p className="text-sm muted">{L('Zatiaľ nie je nič zvarené.', 'Nothing welded yet.')}</p>}
          {!MIG && <button type="button" className="btn w-full mt-2" disabled={!ui.slag} onClick={() => { if (apiRef.current.chip && apiRef.current.chip()) set('slag', false); }}>{L('Otĺcť trosku', 'Chip off the slag')}</button>}
        </div>

        <ExportSection machine={MIG ? 'mag' : 'zvaranie'} apiRef={apiRef} canSave={false} />
        <ViewSection apiRef={apiRef} views={[['detail', L('Detail spoja', 'Joint detail')], ['zhora', L('Zhora', 'Top')], ['celok', L('Celok', 'Overview')], ['zvaracka', MIG ? L('Zdroj TPS 450', 'TPS 450 source') : L('Zváračka', 'Welder')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

function MigSimulator(props) { return <WeldingSimulator {...props} process="mig" />; }

export { WeldingSimulator, MigSimulator, weldPrep, weldProfile, WELD_TYPES, WELD_DIAL, ELECTRODES };
export default WeldingSimulator;
