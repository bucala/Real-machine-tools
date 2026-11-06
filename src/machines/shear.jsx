import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { createMachineWorkInspect } from '../core/machineWorkInspect';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, makeKit, std } from '../core/kit';
import { createStage } from '../core/stage';
import { approach, clamp } from '../core/util';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection } from '../ui/tools';
import { SheetDrawing } from '../ui/sketch';
import { SHEAR, cutStrip, gapIdeal, shearChecks } from './shearMath';
import { BlankSection, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// TABUĽOVÉ NOŽNICE (mechanické, s nožným pedálom)
// =====================================================================
// mierka 1 = 100 mm. Strihová čiara je v x = 0 (spodný nôž), obsluha stojí v −X, zadný doraz je za nožom v +X.
// Plech leží na stole vo výške YT; jeho zadná hrana je o p za strihovou čiarou – pri strihu sa odstrihne pás šírky p.
const YT = 8.5, LEN = 22, HW = LEN / 2;
const shearParts = () => mkParts([
  ['ramy', 'Stojany', 'Frames', 'Stojany a stôl', 'Frames and table', 'Liatinové bočné stojany spája horný kryt výstredníkovej hriadele a stôl so spodným nožom. Vpredu sú tri podperné ramená, pravé s mierkou.', 'Cast side frames are joined by the top housing of the eccentric shaft and by the table with the lower blade. Three front support arms are at the front, the right one with a scale.'],
  ['tram', 'Nožový trám', 'Blade beam', 'Nožový trám so šikmým nožom', 'Blade beam with raked blade', 'Horný nôž je uložený šikmo (uhol strihu) – plech sa strihá postupne od jedného konca, preto stačí menšia sila. Trám poháňa výstredník cez jednootáčkovú spojku.', 'The upper blade is raked – the sheet is cut progressively from one end, so less force is needed. The beam is driven by an eccentric through a single-revolution clutch.'],
  ['pritlaky', 'Prítlaky', 'Hold-downs', 'Prítlaky plechu', 'Sheet hold-downs', 'Pred nožom zovrú plech k stolu, aby sa pri strihu nepreklopil. Prsty pod prítlakmi = úraz – preto je pred nimi kryt prstov.', 'In front of the blade they clamp the sheet to the table so that it does not tip during the cut. Fingers under the hold-downs = injury – hence the finger guard in front of them.'],
  ['kryt', 'Kryt prstov', 'Finger guard', 'Ochranný kryt prstov', 'Finger guard', 'Oranžový hrebeň z tyčiek pred prítlakmi a nožom – plech prejde pod ním, prsty nie. Pri zdvihnutom kryte pedál nespustí strih.', 'An orange comb of bars in front of the hold-downs and the blade – the sheet passes under it, fingers do not. With the guard raised the pedal does not start a cut.'],
  ['doraz', 'Zadný doraz', 'Back gauge', 'Zadný doraz', 'Back gauge', 'Lišta za nožom nastavená na šírku pásu. Plech sa zasúva, kým sa jej nedotkne.', 'A bar behind the blade set to the strip width. The sheet is pushed in until it touches it.'],
  ['uholnik', 'Uholník', 'Side square', 'Bočný uholník', 'Side square', 'Pravítko kolmé na nôž vľavo na stole. Plech priložený k uholníku sa odstrihne pravouhlo.', 'A rule square to the blade on the left of the table. A sheet laid against it is cut square.'],
  ['pedal', 'Pedál', 'Pedal', 'Pedálová tyč', 'Foot treadle', 'Tyč po celej šírke stroja – dá sa stlačiť z ktoréhokoľvek miesta. Stlačenie zapne jednootáčkovú spojku: jeden strih, jedna otáčka výstredníka.', 'A bar across the full width of the machine – it can be pressed from anywhere. Pressing it engages the single-revolution clutch: one cut, one revolution of the eccentric.'],
  ['pohon', 'Pohon', 'Drive', 'Motor so zotrvačníkom', 'Motor with flywheel', 'Elektromotor 7,5 kW vľavo roztáča cez prevod zotrvačník; pri strihu odovzdá energiu výstredníkovej hriadeli v hornom kryte. Na podstavci je hlavný vypínač a prepínač.', 'The 7.5 kW motor on the left spins the flywheel through a drive; during the cut it gives its energy to the eccentric shaft in the top housing. The main switch and the selector are on the pedestal.'],
  ['plech', 'Plech', 'Sheet', 'Plech', 'Sheet', 'Oceľový plech S235 na stole. Odstrihnuté pásy padajú za nožom do zberného koša.', 'S235 steel sheet on the table. The cut strips fall behind the blade into the bin.'],
]);
const SHEAR_TASKS = [
  { id: 'pasy', title: () => L('Tri pásy 100 × 1000 z plechu 2 mm', 'Three 100 × 1000 strips from 2 mm sheet'),
    desc: () => L('Plech 2 × 1000 × 500 mm. Nastrihaj tri pásy šírky 100 ±0,3 mm. Nastav zadný doraz na 100 mm a vôľu nožov podľa hrúbky (≈ 7 % = 0,14 mm), plech prilož k bočnému uholníku a zasuň po doraz. Kryt prstov musí byť dole, strih spustíš pedálom.', 'Sheet 2 × 1000 × 500 mm. Cut three strips 100 ±0.3 mm wide. Set the back gauge to 100 mm and the blade clearance to the thickness (≈ 7 % = 0.14 mm), lay the sheet against the side square and push it to the gauge. The finger guard must be down; the pedal triggers the cut.'),
    setup: { t: 2, L: 1000, D: 500, gauge: 300, gap: 0.3 },
    drawing: () => <SheetDrawing w={100} n={3} t={2} L={1000} D={500} />,
    labels: { count: () => L('Tri pásy 100 ±0,3 mm', 'Three strips 100 ±0.3 mm'), square: () => L('Pravouhlé (klin ≤ 0,3 mm)', 'Square (taper ≤ 0.3 mm)'), burr: () => L('Bez ostriny (správna vôľa nožov)', 'No burr (correct blade clearance)') } },
  { id: 'hrube', title: () => L('Prírezy 150 mm z plechu 6 mm', '150 mm blanks from 6 mm sheet'),
    desc: () => L('Plech 6 × 1500 × 500 mm. Nastrihaj dva pásy 150 ±0,3 mm bez ostriny. Hrubší plech potrebuje väčšiu vôľu nožov (≈ 0,42 mm) – s vôľou pre tenký plech bude mať strih ostrinu.', 'Sheet 6 × 1500 × 500 mm. Cut two strips 150 ±0.3 mm without burr. A thicker sheet needs a larger blade clearance (≈ 0.42 mm) – with the clearance for thin sheet the cut has a burr.'),
    setup: { t: 6, L: 1500, D: 500, gauge: 300, gap: 0.14 },
    drawing: () => <SheetDrawing w={150} n={2} t={6} L={1500} D={500} />,
    labels: { size: () => L('Dva pásy 150 ±0,3 mm (6 mm)', 'Two strips 150 ±0.3 mm (6 mm)'), burr: () => L('Bez ostriny', 'No burr') } },
].map((t) => ({ ...t, checks: (m) => shearChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const SHEAR_SAFETY = () => [
  L('Kryt prstov je sklopený, ruky nedávam pod prítlaky ani za kryt.', 'The finger guard is down, I do not put my hands under the hold-downs or behind the guard.'),
  L('Za nožnicami nikto nestojí – odstrihnuté pásy padajú dozadu.', 'Nobody stands behind the shear – the cut strips fall to the back.'),
  L('Plech nie je hrubší ako 8 mm (S235), mám rukavice proti porezaniu.', 'The sheet is not thicker than 8 mm (S235), I wear cut-resistant gloves.'),
];

function ShearSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { power: true, manual: false, gauge: 100, gap: 0.14, guard: true, square: true, push: 0, t: 2, L: 1000, D: 500 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ p: 0, stroke: 0, msg: null, strips: 0, D: 500 });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('bender');
    const dom = renderer.domElement;
    const M = { ...baseMats(0x8cb37b, 0x759b65, 0x587a4b), sheet: std(0xa2a8ad, 0.4, 0.75), blade: std(0xd7dbde, 0.2, 0.9), grid: std(0xe2781e, 0.6, 0.2), plateG: std(0x6d7174, 0.55, 0.5) };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, hitProxy, handwheel } = kit;
    const root = new THREE.Group(); scene.add(root);
    apiRef.current.machineModel = { root, name: 'Tabuľové nožnice' };
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const texMat = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5, metalness: 0.2 }); };
    const plateTex = texMat(160, 110, (g, w, h) => { g.fillStyle = '#c9c7b8'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f2321'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('BS 2000/8', w / 2, 30); g.font = '13px sans-serif'; g.fillText('2000 × 8 mm', w / 2, 54); g.fillText('7,5 kW', w / 2, 74); g.fillText('1951', w / 2, 94); g.strokeStyle = '#1f2321'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); });
    const FZ = HW + 0.25, FT = 1.1;                                                     // vnútorná hrana a hrúbka bočného stojana

    // ---------- stojany, horný kryt výstredníkovej hriadele, stôl ----------
    const fr = grp('ramy');
    [-1, 1].forEach((s) => {
      const z0 = s > 0 ? FZ : -FZ - FT, z1 = z0 + FT;
      box(fr, -1.9, 3.4, 0, 12.4, z0, z1, M.green);                                   // bočný stojan
      box(fr, -2.05, -1.9, 0.3, 12.2, z0 + 0.1, z1 - 0.1, M.greenDark);                  // predná lišta stojana
      [2.2, 5.0, 10.3, 11.6].forEach((y) => cylX(fr, 0.12, 0.12, -2.15, -2.05, y, (z0 + z1) / 2, M.steelDark, 8));   // skrutky
      box(fr, -2.0, 3.5, 0, 0.35, z0 - 0.2, z1 + 0.2, M.greenDeep);                    // pätka
    });
    box(fr, -1.0, 2.0, 10.9, 12.0, -FZ, FZ, M.green);                                  // horný kryt výstredníkovej hriadele
    const capG = new THREE.CylinderGeometry(1.5, 1.5, FZ * 2, 40, 1, false, -Math.PI / 2, Math.PI); capG.rotateX(Math.PI / 2); capG.rotateZ(-Math.PI / 2); capG.scale(1, 0.55, 1);
    add(fr, capG, M.green, 0.5, 12.0, 0);
    box(fr, -1.05, 2.05, 10.85, 10.95, -FZ, FZ, M.greenDark);
    box(fr, -2.2, 0.0, YT - 1.6, YT, -FZ, FZ, M.green);                                // stôl pred nožom
    for (let k = 0; k < 7; k++) { const z = -FZ + 0.3 + k * (FZ * 2 - 0.6) / 7; box(fr, -2.15, -0.25, YT, YT + 0.04, z + 0.06, z + (FZ * 2 - 0.6) / 7 - 0.06, M.plateG); }   // oceľové platne stola
    box(fr, -0.15, 0.0, YT - 0.6, YT + 0.001, -FZ, FZ, M.blade);                         // spodný nôž
    box(fr, -1.2, 0.0, 1.2, YT - 1.6, -FZ, FZ, M.greenDeep);                            // spodná stena
    box(fr, -2.3, -1.2, 0.35, 1.2, -FZ, FZ, M.greenDark);                              // spodný trám
    box(fr, 0.0, 3.0, YT - 2.6, YT - 2.2, -FZ, FZ, M.greenDark);                        // zadná priečka
    // podperné ramená stola s mierkou (zošikmené konzoly)
    [-FZ + 0.75, 0, 6.5].forEach((z, i) => {
      const sh = new THREE.Shape(); sh.moveTo(-2.2, YT); sh.lineTo(-8.2, YT); sh.lineTo(-8.2, YT - 0.35); sh.lineTo(-2.2, YT - 1.6); sh.lineTo(-2.2, YT);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }); g.translate(0, 0, z - 0.25); add(fr, g, M.green);
      box(fr, -8.2, -2.2, YT, YT + 0.08, z - 0.3, z + 0.3, M.greenDark);
      if (i === 2) for (let k = 1; k < 30; k++) box(fr, -2.2 - k * 0.2, -2.18 - k * 0.2, YT + 0.08, YT + 0.085, z - 0.28, z - (k % 5 ? 0.18 : 0.08), M.white);
    });
    box(fr, 2.6, 5.6, 0, 1.6, -FZ, FZ, M.greenDark);                                    // zberný kôš
    // štítok stroja na ľavom stojane
    add(fr, new THREE.PlaneGeometry(1.2, 0.82), plateTex, -2.07, 9.6, -FZ - FT / 2).rotation.y = -Math.PI / 2;
    // ---------- pohon vľavo: motor, prevod, rozvádzač ----------
    const drv = grp('pohon');
    const ZD = -FZ - FT;
    box(drv, -2.6, 2.8, 0, 6.6, ZD - 4.4, ZD, M.green);                                 // podstavec pohonu
    box(drv, -2.7, 2.9, 6.6, 6.8, ZD - 4.5, ZD + 0.05, M.greenDark);
    box(drv, -2.62, -2.6, 0.6, 5.6, ZD - 3.9, ZD - 2.2, M.greenDark);                   // dvierka
    cylX(drv, 1.05, 1.05, -1.2, 1.8, 7.9, ZD - 2.2, M.green, 32);                        // elektromotor 7,5 kW
    cylX(drv, 1.1, 1.1, 1.8, 2.1, 7.9, ZD - 2.2, M.greenDark, 32);
    for (let k = 0; k < 8; k++) cylX(drv, 1.08, 1.08, -1.0 + k * 0.33, -0.92 + k * 0.33, 7.9, ZD - 2.2, M.greenDark, 32);
    box(drv, -0.4, 0.4, 8.9, 9.4, ZD - 2.6, ZD - 1.8, M.greenDark);                     // svorkovnica
    box(drv, -1.6, -1.2, 6.8, 7.4, ZD - 3.2, ZD - 1.2, M.greenDark);                    // pätky motora
    box(drv, -2.2, 3.0, 6.8, 11.6, ZD - 1.0, ZD, M.green);                              // kryt prevodu na zotrvačník
    box(drv, -2.2, 3.0, 11.6, 11.8, ZD - 1.05, ZD + 0.05, M.greenDark);
    box(drv, -2.62, -2.6, 3.4, 4.4, ZD - 1.6, ZD - 0.4, M.black);
    cylX(drv, 0.22, 0.22, -2.75, -2.62, 3.9, ZD - 1.0, M.steel, 20);                     // otočný prepínač
    handwheel(drv, 0.3, -2.75, 5.0, ZD - 3.2, '-x', 0.08);                 // ručné koliesko spojky
    const mainSw = new THREE.Group(); mainSw.position.set(-2.6, 4.9, ZD - 1.0); mainSw.rotation.y = -Math.PI / 2; drv.add(mainSw);
    box(mainSw, -0.4, 0.4, -0.4, 0.4, -0.05, 0.02, M.yellow);
    cylZ(mainSw, 0.24, 0.24, 0, 0.06, 0, 0, M.black, 24); box(mainSw, -0.05, 0.05, -0.3, 0.3, 0.06, 0.18, M.red);
    // predný stolík s náradím
    box(drv, -5.6, -2.6, 0, 5.4, ZD - 3.6, ZD - 0.4, M.green);
    const tray = new THREE.Shape(); tray.moveTo(-5.7, 5.4); tray.lineTo(-2.6, 5.4); tray.lineTo(-2.6, 6.0); tray.lineTo(-5.7, 5.7); tray.lineTo(-5.7, 5.4);
    const tg = new THREE.ExtrudeGeometry(tray, { depth: 3.4, bevelEnabled: false }); tg.translate(0, 0, ZD - 3.7); add(drv, tg, M.greenDark);
    // pravý stojan: prevodovka na konci hriadele
    box(fr, -0.8, 2.4, 10.0, 12.6, FZ + FT, FZ + FT + 1.0, M.green);
    cylZ(fr, 0.6, 0.6, FZ + FT + 1.0, FZ + FT + 1.3, 0.8, 11.3, M.greenDark, 28);
    // bočný uholník
    const sq = grp('uholnik');
    box(sq, -8.2, -0.05, YT + 0.08, YT + 0.34, -FZ + 0.4, -FZ + 0.55, M.steelDark);
    // ---------- nožový trám, prítlaky, hrebeňový kryt prstov ----------
    const beam = grp('tram');
    box(beam, -0.5, 0.45, YT + 0.7, YT + 2.3, -FZ, FZ, M.green);
    box(beam, -0.55, 0.5, YT + 2.3, YT + 2.45, -FZ, FZ, M.greenDark);
    [-FZ + 0.8, FZ - 0.8].forEach((z) => box(beam, -0.6, 0.5, YT + 0.9, YT + 2.2, z - 0.35, z + 0.35, M.greenDark));   // úchyty ojníc
    const upper = box(beam, -0.05, 0.12, YT + 0.12, YT + 0.8, -FZ, FZ, M.blade);
    const hold = grp('pritlaky');
    const holdPins = [];
    for (let z = -FZ + 1; z <= FZ - 1; z += 1.5) { const g = new THREE.Group(); g.position.set(-0.75, 0, z); hold.add(g); cylY(g, 0.12, 0.12, YT + 0.04, YT + 1.6, 0, 0, M.steelDark, 14); holdPins.push(g); }
    box(hold, -1.25, -0.5, YT + 1.6, YT + 2.15, -FZ, FZ, M.green);                     // prítlačný trám
    for (let z = -FZ + 0.8; z < FZ; z += 1.5) cylX(hold, 0.1, 0.1, -1.32, -1.25, YT + 1.88, z, M.steelDark, 8);
    const guardG = grp('kryt');
    const guardPiv = new THREE.Group(); guardPiv.position.set(-1.35, YT + 2.95, 0); guardG.add(guardPiv);
    [[-FZ + 0.5, -FZ + 5.2], [-FZ + 5.6, FZ - 2.8], [FZ - 2.4, FZ - 0.5]].forEach(([z0, z1]) => {
      box(guardPiv, -0.12, 0.0, -0.15, 0.0, z0, z1, M.grid);                           // horná lišta sekcie
      box(guardPiv, -0.12, 0.0, -2.45, -2.33, z0, z1, M.grid);
      for (let z = z0 + 0.08; z < z1; z += 0.22) box(guardPiv, -0.1, -0.02, -2.4, -0.1, z - 0.035, z + 0.035, M.grid);   // zvislé tyčky hrebeňa
    });
    hitProxy(guardPiv, 0.8, -0.05, -1.2, 0);
    // ---------- zadný doraz ----------
    const gaugeG = grp('doraz');
    box(gaugeG, 0, 0.18, YT, YT + 0.5, -FZ + 0.5, FZ - 0.5, M.steelDark);
    [-6, 6].forEach((z) => box(gaugeG, 0.18, 3.0, YT + 0.3, YT + 0.45, z - 0.1, z + 0.1, M.steel));
    // ---------- pedálová tyč po celej šírke ----------
    const ped = grp('pedal');
    [-1, 1].forEach((s) => box(ped, -2.4, -1.9, 0.35, 1.3, s * (FZ - 0.3) - 0.2, s * (FZ - 0.3) + 0.2, M.greenDark));   // ložiská pedálovej hriadele
    cylZ(ped, 0.14, 0.14, -FZ, FZ, -2.15, 0.85, M.green, 14);                            // hriadeľ pedálu
    const pedal = new THREE.Group(); pedal.position.set(-2.15, 0.85, 0); ped.add(pedal);
    [-1, 1].forEach((s) => box(pedal, -1.6, 0, -0.08, 0.08, s * (FZ - 0.9) - 0.1, s * (FZ - 0.9) + 0.1, M.green));
    cylZ(pedal, 0.11, 0.11, -FZ + 0.4, FZ - 0.4, -1.6, -0.3, M.green, 14);              // pedálová tyč
    cylZ(pedal, 0.11, 0.11, -FZ + 0.4, FZ - 0.4, -1.0, 0.5, M.green, 14);               // horná tyč (zábrana)
    [-1, 1].forEach((s) => cylY(pedal, 0.08, 0.08, -0.3, 0.5, -1.3 + s * 0.3, s * (FZ - 0.9), M.green, 10));
    for (let z = -FZ + 1.2; z < FZ - 0.8; z += 1.4) hitProxy(pedal, 0.45, -1.6, -0.3, z);
    // ---------- plech ----------
    const shG = grp('plech');
    const sheetM = box(shG, 0, 1, 0, 1, 0, 1, M.sheet);
    const fall = [];                                                                   // padajúce pásy
    const st = { p: -0.5, g: c.gauge, stroke: 0, phase: 0, msg: null, sheet: { L: c.L, D: c.D }, t: c.t, strips: [] };
    let t = 0, last = performance.now(), teleT = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 3 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const layout = () => {
      const T = st.t / 100, D = st.sheet.D / 100, Lz = st.sheet.L / 100, x1 = st.p / 100;
      sheetM.visible = D > 0.005;
      sheetM.scale.set(D, T, Lz); sheetM.position.set(x1 - D / 2, YT + T / 2, -HW + 0.55 + Lz / 2 + (c.square ? 0 : 0.3));
      sheetM.rotation.y = c.square ? 0 : 0.006;
    };

    // ---------- pohľady ----------
    const anchors = {
      ramy: () => v3(-1.9, 12.5, FZ + FT / 2), pohon: () => v3(0.3, 9.1, -FZ - FT - 2.2), tram: () => v3(0.2, YT + 2.7 - st.stroke * 0.6, HW - 2), pritlaky: () => v3(-1.3, YT + 1.9, -FZ + 3), kryt: () => v3(-1.45, YT + 2.9, FZ - 3),
      doraz: () => v3(st.g / 100, YT + 0.6, 0), uholnik: () => v3(-4, YT + 0.35, -FZ + 0.5), pedal: () => v3(-3.75, 0.7, 2.0), plech: () => v3(st.p / 100 - 1, YT + 0.1, 0),
    };
    const views = {
      celok: () => [[-30, 19, -17], [-0.5, 5.5, -2.5]],
      noz: () => [[-4, YT + 2.5, 6], [0, YT, 3], true],
      zhora: () => [[-2, 26, 0.5], [-1, YT, 0], true],
      zboku: () => [[-1, YT + 1, 22], [-1, YT, 0], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.measure = () => ({ strips: st.strips.slice(), D: st.sheet.D });
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if(c.running || c.drive || c.wheel || c.work || st.phase)throw new Error(L('Najprv zastav stroj a potom exportuj obrobok.','Stop the machine before exporting the workpiece.'));
      return exportStep(fall.length ? fall[fall.length-1].m : shG);
    };
    const wi=createMachineWorkInspect({scene,camera,dom,insp,c,set,apiRef,say,
      getObj:()=>(fall.length ? fall[fall.length-1].m : shG),getSpot:()=>v3(3, YT+3, 6),
      canInspect:()=>st.phase ? L('Počkaj na dokončenie strihu.', 'Wait until the cut finishes.') : fall.length && fall[fall.length-1].m.position.y>1.7 ? L('Počkaj, kým sa odstrihnutý pás odloží.', 'Wait until the cut strip settles.') : null,
    });

    apiRef.current.newBlank = () => {
      if(c.unclamped){say(L('Najprv vráť obrobok do stroja.','Return the workpiece to the machine first.'));return false;}
      if (st.phase) { say(L('Počkaj, kým sa dokončí strih.', 'Wait until the cut is finished.')); return false; }
      st.sheet = { L: clamp(c.L, 200, SHEAR.Wmax), D: clamp(c.D, 100, 1000) }; st.t = c.t; st.strips = []; st.p = -0.5; push('push', 0);
      say(L(`Na stole je nový plech ${c.t} × ${c.L} × ${c.D} mm.`, `A new sheet ${c.t} × ${c.L} × ${c.D} mm is on the table.`), 'info'); return true;
    };
    const pedalPress = () => {
      if (!c.power) { say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.')); return; }
      if (st.phase) return;
      if (!c.guard) { say(L('Kryt prstov je zdvihnutý – pedál nespustí strih. Sklop kryt.', 'The finger guard is raised – the pedal will not start a cut. Lower the guard.'), 'danger'); return; }
      st.phase = 1; st.stroke = 0;
    };
    apiRef.current.pedal = pedalPress;
    ctrl.reg({ type: 'button', label: LL('Nožný pedál', 'Foot pedal'), hint: LL('Stlačenie spustí jeden strih.', 'Pressing it triggers one cut.'), action: pedalPress }, pedal);
    ctrl.reg({ type: 'button', still:true, label: LL('Kryt prstov', 'Finger guard'), hint: LL('Klik kryt sklopí alebo zdvihne.', 'Click to lower or raise the guard.'), action: () => push('guard', !c.guard) }, guardPiv);
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0), onSet: (i) => push('power', i === 1), read: () => (c.power ? 'I' : '0') }, mainSw);
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      wi.update(dt);
      if(c.unclamped){ctrl.update(dt);insp.update(t,c);renderer.render(scene,camera);return;}

      // zadný doraz motorom, plech sa zasúva po doraz
      st.g = approach(st.g, clamp(c.gauge, 5, 750), 60 * dt);
      const pT = c.push > 0 ? Math.min(st.g, c.push) : -0.5;
      if (!st.phase) {
        st.p = approach(st.p, Math.min(pT, st.sheet.D + 0.0), 300 * dt);
        sayOnce('gauge', c.push > st.g + 0.5, L('Plech dosadol na zadný doraz.', 'The sheet touched the back gauge.'), 'info');
      }
      // strih: prítlaky, nôž dole, pás padá dozadu
      if (st.phase) {
        st.stroke = Math.min(2, st.stroke + dt * 1.6);
        if (st.phase === 1 && st.stroke >= 1) {
          st.phase = 2;
          const r = cutStrip(st.sheet, st.p, { t: st.t, gap: c.gap, square: c.square });
          if (r.error === 'capacity') say(L(`Plech ${st.t} mm je nad kapacitu nožníc (${SHEAR.maxT} mm) – trám sa zastavil na plechu, strih sa nevykonal.`, `The ${st.t} mm sheet exceeds the shear capacity (${SHEAR.maxT} mm) – the beam stalled on the sheet, no cut.`), 'danger');
          else if (r.strip) {
            const s = { ...r.strip, w: Math.round(r.strip.w * 100) / 100 }; st.strips.push(s);
            const m = new THREE.Mesh(new THREE.BoxGeometry(s.w / 100, st.t / 100, st.sheet.L / 100), M.sheet); m.position.set(s.w / 200, YT + st.t / 200, sheetM.position.z); root.add(m);
            fall.push({ m, v: 0, w: 0 });
            say(s.burr ? L(`Odstrihnutý pás ${s.w.toFixed(1)} mm má ostrinu – vôľa nožov nezodpovedá hrúbke (≈ ${gapIdeal(st.t).toFixed(2)} mm).`, `The cut strip ${s.w.toFixed(1)} mm has a burr – the blade clearance does not match the thickness (≈ ${gapIdeal(st.t).toFixed(2)} mm).`)
              : !c.square ? L(`Pás ${s.w.toFixed(1)} mm je klinový – plech nebol priložený k uholníku.`, `The strip ${s.w.toFixed(1)} mm is tapered – the sheet was not against the square.`)
              : L(`Odstrihnutý pás ${s.w.toFixed(1)} mm.`, `Strip cut: ${s.w.toFixed(1)} mm.`), s.burr || !c.square ? 'warn' : 'info');
            st.p = 0; push('push', 0);
          } else say(L('Plech nie je zasunutý za strihovú čiaru – nebolo čo strihnúť.', 'The sheet is not pushed past the cutting line – nothing was cut.'), 'info');
        }
        if (st.stroke >= 2) { st.phase = 0; st.stroke = 0; }
      }
      fall.forEach((f) => { if (f.m.position.y > 1.7) { f.v += 9.8 * dt; f.m.position.y -= f.v * dt * 0.4; f.m.position.x += dt * 1.2; f.m.rotation.z -= dt * 1.5; } });
      // pohyb skupín
      const k = st.phase ? (st.stroke < 1 ? st.stroke : 2 - st.stroke) : 0;
      beam.position.y = -k * 0.75; beam.rotation.x = k * 0.012;
      holdPins.forEach((g) => { g.position.y = -Math.min(1, k * 2) * 0.02; });
      hold.position.y = -Math.min(1, k * 2.5) * 0.2;
      guardPiv.rotation.z = c.guard ? 0 : -1.3;
      gaugeG.position.x = st.g / 100;
      pedal.rotation.z = st.phase === 1 ? 0.22 : 0;
      upper.visible = true;
      layout();
      ctrl.update(dt); insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        setTele({ p: Math.max(0, st.p), stroke: k, strips: st.strips.length, D: st.sheet.D, msg: st.msg && st.msg.until > t ? st.msg : null });
        if (Object.keys(pend).length) { const q = { ...pend }; Object.keys(pend).forEach((kk) => delete pend[kk]); setUi((u) => ({ ...u, ...q })); }
      }
      snd.update({ motor: c.power ? 0.25 : 0, cut: st.phase === 1 && st.stroke > 0.6 ? 1 : 0 });
      renderer.render(scene, camera);
    };
    try { if (/[?&]debug/.test(window.location.search)) window.__shear = { st, c }; } catch (err) { /* ignorované */ }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); wi.dispose(); insp.dispose(); fall.forEach((f) => f.m.geometry.dispose()); try { if (window.__shear && window.__shear.st === st) delete window.__shear; } catch (err) { /* ignorované */ } disposeStage(); };
  }, []);

  const parts = shearParts();
  const m = apiRef.current.measure ? apiRef.current.measure() : null;
  const statusMsg = tele.msg ? tele.msg
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
    : tele.stroke > 0 ? { kind: 'run', text: L('Strih – prítlaky zovreli plech, nôž ide dole.', 'Cutting – the hold-downs clamp the sheet, the blade goes down.') }
    : { kind: 'idle', text: L('Nastav zadný doraz, prilož plech k uholníku, zasuň ho po doraz a stlač pedál.', 'Set the back gauge, lay the sheet against the square, push it to the gauge and press the pedal.') };
  const chips = [{ color: ui.guard ? '#3ee06c' : '#ff8a1f', text: ui.guard ? L('Kryt prstov dole', 'Finger guard down') : L('Kryt zdvihnutý', 'Guard raised') }, { color: '#7fb6ff', text: `${L('Doraz', 'Gauge')} ${ui.gauge} mm` }];
  const setupTask = (task) => { Object.entries(task.setup).forEach(([k, v]) => set(k, v)); setTimeout(() => { if (apiRef.current.newBlank) apiRef.current.newBlank(); }, 300); };

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} canUnclamp workLabels={[L('Pozrieť obrobok','Inspect workpiece'),L('Upnúť späť','Clamp back')]}
        tips={[L('Šírka pásu = nastavenie zadného dorazu; plech zasúvaj, kým nedosadne.', 'Strip width = back gauge setting; push the sheet in until it touches.'),
          L('Vôľa nožov ≈ 7 % hrúbky plechu – inak má strih ostrinu.', 'Blade clearance ≈ 7 % of the sheet thickness – otherwise the cut has a burr.'),
          L('Pri zdvihnutom kryte prstov pedál nespustí strih.', 'With the finger guard raised the pedal does not start a cut.')]} />
      <aside className="panel"><fieldset className="machine-settings" disabled={ui.unclamped}>
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · tabuľové nožnice', 'Simulator · guillotine shear')} title={L('Tabuľové nožnice', 'Guillotine shear')}
          sub={L('Predloha: mechanické tabuľové nožnice BS 2000/8 (1951) – plech do 8 mm, dĺžka strihu 2 000 mm, motor 7,5 kW so zotrvačníkom a jednootáčkovou spojkou; šikmý horný nôž, prítlaky, hrebeňový kryt prstov, zadný doraz a pedálová tyč po celej šírke.', 'Modelled after the BS 2000/8 mechanical guillotine shear (1951) – sheet up to 8 mm, 2,000 mm cut, 7.5 kW motor with flywheel and single-revolution clutch; raked upper blade, hold-downs, comb finger guard, back gauge and a full-width foot treadle.')}
          rows={[[L('Doraz mm', 'Gauge mm'), String(ui.gauge)], [L('Za nožom', 'Past blade'), tele.p.toFixed(1)], [L('Pásy', 'Strips'), String(tele.strips)]]}
          foot={[`${ui.t} × ${ui.L} mm`, `${L('vôľa', 'clearance')} ${ui.gap.toFixed(2)} mm`]} status={statusMsg} />

        <TaskSection machine="noznice" tasks={SHEAR_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'power', items: SHEAR_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Strih', 'Cut')}</h2>
          <button type="button" className="btn-run start" onClick={() => apiRef.current.pedal && apiRef.current.pedal()}>{L('▼ Pedál – strih', '▼ Pedal – cut')}</button>
          <div className="mt-2">
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
            <Toggle on={ui.guard} label={L('Kryt prstov sklopený', 'Finger guard lowered')} onClick={() => set('guard', !ui.guard)} />
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Nastavenie', 'Setup')}</h2>
          <Slider id="sg" label={L('Zadný doraz (šírka pásu)', 'Back gauge (strip width)')} unit="mm" min={5} max={750} step={0.1} value={ui.gauge} digits={1} onChange={(v) => set('gauge', v)} />
          <div className="flex flex-wrap gap-2 mb-2">{[-10, -1, -0.1, 0.1, 1, 10].map((x) => <button key={x} type="button" className="btn" onClick={() => set('gauge', clamp(Math.round((ui.gauge + x) * 10) / 10, 5, 750))}>{x > 0 ? '+' : ''}{x}</button>)}</div>
          <Slider id="sv" label={L('Vôľa nožov', 'Blade clearance')} unit="mm" min={0.03} max={0.8} step={0.01} value={ui.gap} digits={2} onChange={(v) => set('gap', v)} />
          <p className="text-xs muted">{L(`Pre plech ${ui.t} mm je vhodná vôľa približne ${gapIdeal(ui.t).toFixed(2).replace('.', ',')} mm.`, `For ${ui.t} mm sheet the recommended clearance is about ${gapIdeal(ui.t).toFixed(2)} mm.`)}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Plech na stole', 'Sheet on the table')}</h2>
          <Toggle on={ui.square} label={L('Priložený k bočnému uholníku', 'Against the side square')} onClick={() => set('square', !ui.square)} />
          <Slider id="sp" label={L('Zasunutie za strihovú čiaru', 'Push past the cutting line')} unit="mm" min={0} max={760} step={0.5} value={ui.push} actual={tele.p} digits={1} onChange={(v) => set('push', v)} />
          <div className="flex flex-wrap gap-2"><button type="button" className="btn" onClick={() => set('push', 760)}>{L('Zasunúť po doraz', 'Push to the gauge')}</button><button type="button" className="btn" onClick={() => set('push', 0)}>{L('Vytiahnuť', 'Pull back')}</button></div>
          <p className="text-xs muted mt-2">{L(`Zostáva plechu ${tele.D.toFixed(0)} mm.`, `Sheet remaining: ${tele.D.toFixed(0)} mm.`)}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Odstrihnuté pásy', 'Cut strips')}</h2>
          {m && m.strips.length ? (
            <table className="text-xs tnum w-full" style={{ borderCollapse: 'collapse' }}>
              <thead><tr className="muted"><th className="text-left font-semibold">#</th><th className="text-right font-semibold">{L('šírka', 'width')}</th><th className="text-right font-semibold">{L('klin', 'taper')}</th><th className="text-right font-semibold">{L('ostrina', 'burr')}</th></tr></thead>
              <tbody>{m.strips.map((s, i) => <tr key={i}><td>{i + 1}</td><td className="text-right">{s.w.toFixed(2)}</td><td className="text-right">{s.taper.toFixed(2)}</td><td className="text-right">{s.burr ? L('áno', 'yes') : '–'}</td></tr>)}</tbody>
            </table>
          ) : <p className="text-xs muted">{L('Zatiaľ nič nie je odstrihnuté.', 'Nothing has been cut yet.')}</p>}
        </div>

        <BlankSection onApply={() => apiRef.current.newBlank && apiRef.current.newBlank()} applyLabel={L('Položiť nový plech', 'Put down a new sheet')} note={L('Oceľ S235.', 'S235 steel.')}>
          <SegRow label={L('Hrúbka mm', 'Thickness mm')} value={ui.t} options={[1, 2, 3, 4, 6, 8, 10].map((x) => [x, String(x)])} onChange={(v) => set('t', v)} />
          <Slider id="sl" label={L('Dĺžka (pozdĺž noža)', 'Length (along the blade)')} unit="mm" min={200} max={2000} step={50} value={ui.L} onChange={(v) => set('L', v)} />
          <Slider id="sd" label={L('Hĺbka', 'Depth')} unit="mm" min={100} max={1000} step={10} value={ui.D} onChange={(v) => set('D', v)} />
        </BlankSection>

        <ExportSection machine="noznice" apiRef={apiRef} canStl={false} />
        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['noz', L('Nôž', 'Blade')], ['zhora', L('Zhora', 'Top')], ['zboku', L('Zboku', 'Side')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </fieldset></aside>
    </div>
  );
}

export { ShearSimulator };
export default ShearSimulator;
