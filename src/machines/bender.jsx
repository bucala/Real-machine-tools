import { SectionInfo } from '../ui/sectionInfo';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../core/kit';
import { createStage } from '../core/stage';
import { createWorkInspect } from '../core/workInspect';
import { TAU, approach, clamp } from '../core/util';
import { exportStl } from '../core/export';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection, fromB64, toB64 } from '../ui/tools';
import { ArcDrawing, RingDrawing } from '../ui/sketch';
import { BlankSection, DirRun, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';
import { BEND_A, BEND_SPEEDS, PROFILES, bendChecks, bendInfo, createBar, kFinal, kLoaded, kYield, passBar, rollForce } from './benderMath';

// =====================================================================
// PROFILOVÁ OHÝBAČKA – tri poháňané valce v pyramíde (predloha COMAC 3025 HV)
// =====================================================================
// mierka 1 = 100 mm. Miestne súradnice stroja (poloha H): hriadele zvisle, profil vodorovne vo výške YW.
// Krajné valce stoja v z = +(R + h/2) na x = ±A, stredný valec v z = −(R + h/2) + δ tlačí profil k obsluhe;
// profil sa ohýba okolo stredného valca (stred oblúka je za ním, v −z). Poloha V = stroj sklopený o 90°.
const A = BEND_A * 10, RR = 0.9, YW = 10.6;
const PROF_LIST = [
  ['ploNap', 'Plochá tyč 40 × 10 naplocho', 'Flat bar 40 × 10 the easy way'], ['ploNas', 'Plochá tyč 40 × 10 nastojato', 'Flat bar 40 × 10 the hard way'],
  ['rura', 'Rúra Ø33,7 × 3', 'Tube Ø33.7 × 3'], ['jakl', 'Jäkel 30 × 30 × 2', 'Square tube 30 × 30 × 2'], ['uhol', 'Uholník L40 × 4', 'Angle L40 × 4'],
];
const profName = (id) => { const t = PROF_LIST.find(([k]) => k === id); return t ? L(t[1], t[2]) : id; };
// obrys prierezu (mm): n = v rovine ohybu (kladné k stredu oblúka), y = zvisle
const outline = (p) => {
  const h = p.h / 2, b = p.b / 2;
  if (p.shape === 'tube') return Array.from({ length: 20 }, (_, i) => [Math.cos(i / 20 * TAU) * h, Math.sin(i / 20 * TAU) * h]);
  if (p.shape === 'angle') { const t = p.t; return [[-h, -b], [h, -b], [h, -b + t], [-h + t, -b + t], [-h + t, b], [-h, b]]; }
  return [[-h, -b], [h, -b], [h, b], [-h, b]];
};

const benderParts = () => mkParts([
  ['skrina', 'Skriňa stroja', 'Machine body', 'Skriňa s pohonom', 'Body with drive', 'Zváraná skriňa nesie tri hriadele. Vnútri je elektromotor s prevodovkou, ktorá poháňa všetky tri valce rovnakou obvodovou rýchlosťou, a hydraulika prísuvu stredného valca. Celý stroj sa dá sklopiť do zvislej polohy (V) – veľké prstence potom stoja vo zvislej rovine.', 'The welded body carries the three shafts. Inside are the motor and gearbox, which drive all three rolls at the same surface speed, and the hydraulics of the centre-roll feed. The whole machine can be tilted to the vertical position (V) – large rings then stand in a vertical plane.'],
  ['valce', 'Valce', 'Rolls', 'Krajné valce', 'Outer rolls', 'Dva krajné valce na pevných hriadeľoch podopierajú profil. Na hriadele sa nasadzujú tvarové valce podľa profilu: valce s nákružkami pre plochú tyč, jäkel a uholník, drážkové valce pre rúru.', 'Two outer rolls on fixed shafts support the profile. Forming rolls are fitted to the shafts according to the profile: flanged rolls for flat bar, square tube and angle, grooved rolls for tube.'],
  ['stredny', 'Stredný valec', 'Centre roll', 'Stredný (ohýbací) valec', 'Centre (bending) roll', 'Stredný valec sa hydraulicky prisúva k profilu o δ. Čím väčší prísuv, tým menší polomer. Po prejdení valcami profil odpruží – nastavený polomer v zábere je vždy menší ako výsledný.', 'The centre roll is fed hydraulically against the profile by δ. The larger the feed, the smaller the radius. After the rolls the profile springs back – the radius under load is always smaller than the result.'],
  ['vodiace', 'Vodiace kladky', 'Guide rollers', 'Bočné vodiace kladky', 'Side guide rollers', 'Kladky na nastaviteľných ramenách pridržiavajú profil pri vstupe a výstupe. Pri profiloch ohýbaných nastojato a pri uholníkoch bránia vybočeniu a skrúteniu.', 'Rollers on adjustable arms hold the profile at the entry and exit. With profiles bent the hard way and with angles they prevent buckling and twisting.'],
  ['rozvadzac', 'Ovládací panel', 'Control panel', 'Ovládací panel', 'Control panel', 'Hlavný vypínač, chod valcov vpred a vzad, stop, núdzový STOP a tlačidlá prísuvu stredného valca. Na podlahe je dvojitý nožný pedál.', 'Main switch, roll drive forward and back, stop, emergency stop and the centre-roll feed buttons. A double foot pedal is on the floor.'],
  ['pedal', 'Pedál', 'Pedal', 'Nožný pedál', 'Foot pedal', 'Ľavý pedál = chod vzad, pravý = vpred. Obsluha má obe ruky voľné na vedenie dlhého profilu.', 'Left pedal = reverse, right = forward. The operator keeps both hands free to guide a long profile.'],
  ['profil', 'Profil', 'Profile', 'Ohýbaný profil', 'Profile being bent', 'Oceľový profil S235. Ohýba sa len úsek, ktorý leží na oboch krajných valcoch – asi 200 mm na každom konci zostane rovných.', 'S235 steel profile. Only the part lying on both outer rolls is bent – about 200 mm at each end stays straight.'],
]);

const BENDER_TASKS = [
  { id: 'oblukNap', title: () => L('Oblúk R 500 z plochej tyče naplocho', 'Arc R 500 from flat bar, easy way'),
    desc: () => L('Plochá tyč 40 × 10 mm, dĺžka 1 500 mm, valce s nákružkami. Ohni ju naplocho na polomer R 500 ±10 mm. Profil po prejdení valcami odpruží – začni menším prísuvom stredného valca, zmeraj polomer a pri ďalšom prechode prisuň viac (menší prísuv už profil nezmení). Polomer má byť rovnaký po celej ohnutej dĺžke (aspoň 1 000 mm).', 'Flat bar 40 × 10 mm, 1,500 mm long, flanged rolls. Bend it the easy way to R 500 ±10 mm. The profile springs back after the rolls – start with a smaller centre-roll feed, measure the radius and feed more on the next pass (a smaller feed no longer changes the profile). The radius must be even along the bent length (at least 1,000 mm).'),
    setup: { prof: 'ploNap', len: 1500, rolls: 'plocha', guides: false, hv: 'h', dT: 0 },
    drawing: () => <ArcDrawing R={500} text="R 500 ±10" notes={[L('plochá 40 × 10 naplocho', 'flat 40 × 10 easy way'), L('ohnutá dĺžka ≥ 1 000 mm', 'bent length ≥ 1,000 mm')]} />,
    labels: { radius: () => L('Polomer R 500 ±10 mm', 'Radius R 500 ±10 mm'), even: () => L('Rovnomerný polomer (odchýlka ≤ 10 mm)', 'Even radius (deviation ≤ 10 mm)'), bent: () => L('Ohnutá dĺžka aspoň 1 000 mm', 'Bent length at least 1,000 mm'), defect: () => L('Bez skrútenia a zvlnenia', 'No twist or ripples') } },
  { id: 'prstenec', title: () => L('Prstenec R 300 z rúry', 'Ring R 300 from tube'),
    desc: () => L('Rúra Ø33,7 × 3 mm, dĺžka 2 300 mm. Nasaď drážkové valce pre rúru – na rovných valcoch by sa rúra sploštila. Zakruž ju na prstenec R 300 ±8 mm s uhlom aspoň 345°. Rovné konce (asi 200 mm) sa po ohnutí odrežú.', 'Tube Ø33.7 × 3 mm, 2,300 mm long. Fit the grooved tube rolls – on plain rolls the tube would flatten. Roll it into a ring R 300 ±8 mm of at least 345°. The straight ends (about 200 mm) are cut off afterwards.'),
    setup: { prof: 'rura', len: 2300, rolls: 'rura', guides: false, hv: 'v', dT: 0 },
    drawing: () => <RingDrawing text="R 300 ±8" gap={18} notes={[L('rúra Ø33,7 × 3', 'tube Ø33.7 × 3'), L('uhol ≥ 345°', 'angle ≥ 345°')]} />,
    labels: { radius: () => L('Polomer R 300 ±8 mm', 'Radius R 300 ±8 mm'), even: () => L('Rovnomerný polomer (odchýlka ≤ 8 mm)', 'Even radius (deviation ≤ 8 mm)'), angle: () => L('Uhol prstenca aspoň 345°', 'Ring angle at least 345°'), defect: () => L('Rúra nesploštená (drážkové valce)', 'Tube not flattened (grooved rolls)') } },
  { id: 'oblukNas', title: () => L('Oblúk R 800 z plochej tyče nastojato', 'Arc R 800 from flat bar, hard way'),
    desc: () => L('Plochá tyč 40 × 10 mm nastojato, dĺžka 1 600 mm. Pri ohybe nastojato má profil sklon vybočiť a skrútiť sa – priklop bočné vodiace kladky. Ohni oblúk R 800 ±15 mm na dĺžke aspoň 1 000 mm.', 'Flat bar 40 × 10 mm on edge, 1,600 mm long. Bent the hard way the profile tends to buckle and twist – swing in the side guide rollers. Bend an arc R 800 ±15 mm over at least 1,000 mm.'),
    setup: { prof: 'ploNas', len: 1600, rolls: 'plocha', guides: false, hv: 'h', dT: 0 },
    drawing: () => <ArcDrawing R={800} text="R 800 ±15" notes={[L('plochá 40 × 10 nastojato', 'flat 40 × 10 hard way'), L('ohnutá dĺžka ≥ 1 000 mm', 'bent length ≥ 1,000 mm')]} />,
    labels: { radius: () => L('Polomer R 800 ±15 mm', 'Radius R 800 ±15 mm'), even: () => L('Rovnomerný polomer (odchýlka ≤ 15 mm)', 'Even radius (deviation ≤ 15 mm)'), bent: () => L('Ohnutá dĺžka aspoň 1 000 mm', 'Bent length at least 1,000 mm'), defect: () => L('Bez skrútenia (vodiace kladky)', 'No twist (guide rollers)') } },
].map((t) => ({ ...t, checks: (m) => bendChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const BENDER_SAFETY = () => [
  L('Valce zodpovedajú profilu a sú dotiahnuté na hriadeľoch.', 'The rolls match the profile and are tightened on the shafts.'),
  L('Ruky držím aspoň 300 mm od valcov – medzi valcami a profilom hrozí vtiahnutie.', 'I keep my hands at least 300 mm from the rolls – the gap between rolls and profile can pull them in.'),
  L('Dlhý profil podopiera pomocník alebo podpera, priestor okolo oblúka je voľný.', 'A long profile is supported by a helper or a stand, the area around the arc is clear.'),
  L('Chod ovládam pedálom a viem, kde je núdzový STOP.', 'I run the rolls with the pedal and know where the emergency stop is.'),
];

function BenderSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { power: true, drive: 0, manual: false, light: true, v: 5, dT: 0, rolls: 'plocha', guides: false, hv: 'h', prof: 'ploNap', len: 1500 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ d: 0, s: 0, F: 0, RL: 0, msg: null, bending: false, inRolls: true });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('bender');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0x3f6f98, 0x355f84, 0x274866),
      bar: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.7, flatShading: true, side: THREE.DoubleSide }),
      roll: std(0x8d969c, 0.3, 0.85), inner: std(0x22272b, 0.8, 0.1), lampShade: std(0x355f84, 0.5, 0.2),
    };
    const kit = makeKit(M);
    const { box, cylY, cylZ, ball, hitProxy } = kit;
    const root = new THREE.Group(); scene.add(root);
    apiRef.current.machineModel = { root, name: 'Ohýbačka profilov' };
    const mach = new THREE.Group(); root.add(mach);
    const G = {};
    const grp = (k, parent = mach) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- skriňa ----------
    const body = grp('skrina');
    box(body, -5, 5, 0.3, 9.4, -4, 4, M.green);
    box(body, -5.2, 5.2, 0, 0.3, -4.2, 4.2, M.greenDark);
    box(body, -5.2, 5.2, 9.4, 9.7, -4.2, 4.2, M.greenDark);                     // horná doska
    box(body, -4.4, 4.4, 1.2, 8.4, 4.0, 4.04, M.greenDeep);                      // predný kryt
    box(body, -0.9, 0.9, 9.7, 9.72, -3.2, -0.6, M.inner);                        // drážka stredného hriadeľa
    [-1, 1].forEach((s) => box(body, s * 4.0 - 0.6, s * 4.0 + 0.6, 0.3, 0.32, 4.2, 4.6, M.steelDark));
    // ---------- hriadele a valce ----------
    const rollsG = grp('valce');
    const midG = grp('stredny');
    const shaftOut = [-1, 1].map((s) => { const g = new THREE.Group(); g.position.set(s * A, 0, 0); rollsG.add(g); return g; });
    const shaftMid = new THREE.Group(); midG.add(shaftMid);
    const slide = box(midG, -0.8, 0.8, 9.72, 9.9, -0.8, 0.8, M.steelDark);
    const spins = [];
    const buildRolls = () => {
      [...shaftOut, shaftMid].forEach((g) => { while (g.children.length) { const o = g.children.pop(); o.traverse((q) => { if (q.geometry) q.geometry.dispose(); }); } });
      spins.length = 0;
      const p = PROFILES[c.prof], b = p.b / 200, tube = c.rolls === 'rura';
      [...shaftOut, shaftMid].forEach((g) => {
        cylY(g, 0.26, 0.26, 9.7, YW + 1.0, 0, 0, M.steel, 20);
        const sp = new THREE.Group(); g.add(sp); spins.push(sp);
        if (tube) {
          // drážkový valec: dve polovice s polkruhovou drážkou pre rúru Ø33,7
          const prof = [];
          for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI; prof.push(new THREE.Vector2(RR + p.h / 200 - Math.cos(a) * p.h / 200 * 1.02, YW + Math.sin(a) * p.h / 200 * 1.02)); }
          prof.unshift(new THREE.Vector2(RR + 0.25, YW - p.h / 200 - 0.25)); prof.unshift(new THREE.Vector2(0.3, YW - p.h / 200 - 0.25));
          prof.push(new THREE.Vector2(RR + 0.25, YW + p.h / 200 + 0.25)); prof.push(new THREE.Vector2(0.3, YW + p.h / 200 + 0.25));
          const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), M.roll); m.castShadow = true; sp.add(m);
        } else {
          cylY(sp, RR, RR, YW - b - 0.02, YW + b + 0.02, 0, 0, M.roll, 48);
          cylY(sp, RR + 0.32, RR + 0.32, YW - b - 0.2, YW - b - 0.02, 0, 0, M.roll, 48);
          cylY(sp, RR + 0.32, RR + 0.32, YW + b + 0.02, YW + b + 0.2, 0, 0, M.roll, 48);
        }
        for (let k = 0; k < 3; k++) { const mk = box(sp, RR * 0.4, RR * 0.4 + 0.18, YW + b + 0.2, YW + b + 0.24, -0.05, 0.05, M.inner); mk.rotation.y = k * TAU / 3; mk.position.set(Math.cos(k * TAU / 3) * RR * 0.5, YW + b + 0.22, -Math.sin(k * TAU / 3) * RR * 0.5); }
        cylY(g, 0.34, 0.34, YW + b + 0.24, YW + b + 0.44, 0, 0, M.steelDark, 6);
      });
    };
    // ---------- vodiace kladky na ramenách ----------
    const guideG = grp('vodiace');
    const guides = [-1, 1].map((s) => {
      const piv = new THREE.Group(); piv.position.set(s * (A + 2.2), 9.7, -3.2); guideG.add(piv);
      cylY(piv, 0.22, 0.22, 0, 0.5, 0, 0, M.steelDark, 16);
      const arm = new THREE.Group(); arm.position.y = YW - 9.7; piv.add(arm);
      box(arm, -0.12, 0.12, -0.08, 0.08, 0, 1, M.green);
      const roller = new THREE.Group(); guideG.add(roller);
      cylY(roller, 0.28, 0.28, -0.3, 0.3, 0, 0, M.roll, 24); cylY(roller, 0.08, 0.08, -0.45, 0.45, 0, 0, M.steel, 10);
      return { piv, arm, roller, s };
    });
    // ---------- ovládací panel a pedál ----------
    const pan = grp('rozvadzac');
    box(pan, 2.0, 4.6, 6.0, 8.8, 4.04, 4.2, M.panel);
    const pbtn = (x, y, m) => { const g = new THREE.Group(); g.position.set(x, y, 4.2); pan.add(g); cylZ(g, 0.13, 0.13, 0, 0.07, 0, 0, m, 20); hitProxy(g, 0.17, 0, 0, 0.05); return g; };
    const bBack = pbtn(2.5, 7.6, M.btnGreen), bStop = pbtn(3.3, 7.6, M.black), bFwd = pbtn(4.1, 7.6, M.btnGreen);
    const bMinus = pbtn(2.9, 6.8, M.steel), bPlus = pbtn(3.7, 6.8, M.steel);
    const lampRun = std(0x1f5f33, 0.4, 0.1); ball(pan, 0.07, 4.25, 8.4, 4.22, lampRun);
    const eStop = new THREE.Group(); eStop.position.set(2.6, 8.3, 4.2); pan.add(eStop);
    cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16); cylZ(eStop, 0.18, 0.17, 0.07, 0.15, 0, 0, M.red, 24); hitProxy(eStop, 0.24, 0, 0, 0.1);
    const mainSw = new THREE.Group(); mainSw.position.set(3.45, 8.3, 4.2); pan.add(mainSw);
    cylZ(mainSw, 0.17, 0.17, 0, 0.06, 0, 0, M.black, 24); box(mainSw, -0.045, 0.045, -0.2, 0.2, 0.06, 0.16, M.red);
    const ped = grp('pedal', root);
    box(ped, -1.4, 1.4, 0, 0.25, 5.2, 7.0, M.yellow);
    const pedL = new THREE.Group(); pedL.position.set(-0.65, 0.3, 6.0); ped.add(pedL); box(pedL, -0.5, 0.5, 0, 0.12, -0.7, 0.7, M.black); hitProxy(pedL, 0.6, 0, 0.1, 0);
    const pedR = new THREE.Group(); pedR.position.set(0.65, 0.3, 6.0); ped.add(pedR); box(pedR, -0.5, 0.5, 0, 0.12, -0.7, 0.7, M.black); hitProxy(pedR, 0.6, 0, 0.1, 0);
    const lamp = createLamp(scene, body, kit, M, { base: v3(-4.6, 9.7, -3.6), elbow: v3(-4.0, 13.2, -3.0), head: v3(-2.2, 13.0, -1.0), aim: v3(0, YW, 0), angle: 0.6, power: 2.4 });

    // ---------- profil ----------
    const barG = grp('profil');
    let bar = null, prof = PROFILES[c.prof], barMesh = null, ol = outline(prof);
    const st = { s: 0.03, d: 0, tilt: c.hv === 'v' ? 1 : 0, msg: null, dirty: true, F: 0, bendT: -9, out: false };
    const makeBar = () => {
      prof = PROFILES[c.prof]; ol = outline(prof);
      bar = createBar(clamp(c.len, 600, 3000) / 1000);
      if (barMesh) { barG.remove(barMesh); barMesh.geometry.dispose(); }
      const K = ol.length, n = (bar.N + 1) * K, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const idx = [];
      for (let i = 0; i < bar.N; i++) for (let k = 0; k < K; k++) { const a = i * K + k, b = i * K + (k + 1) % K, cc = a + K, d = b + K; idx.push(a, b, cc, b, d, cc); }
      if (prof.shape !== 'angle') for (const e of [0, bar.N]) for (let k = 1; k < K - 1; k++) idx.push(e * K, e * K + k, e * K + k + 1);
      geo.setIndex(idx);
      barMesh = new THREE.Mesh(geo, M.bar); barMesh.castShadow = true; barMesh.userData.part = 'profil'; barG.add(barMesh); G.profil = barG;
      st.s = 0.03; st.out = false; st.dirty = true;
    };
    const COL = new THREE.Color(0x6b7177), COL_DEF = new THREE.Color(0x9a5a3a);
    const th = new Float64Array(3001), px = new Float64Array(3001), pw = new Float64Array(3001);
    const kVis = (i, kL, span) => { const u = (i + 0.5) * bar.ds; return span && Math.abs(u - st.s) < BEND_A ? Math.max(bar.kf[i], kL) : bar.kf[i]; };
    const rebuildBar = (kL) => {
      const N = bar.N, ds = bar.ds, span = st.s >= BEND_A && bar.L - st.s >= BEND_A;
      // integrácia od zadného konca (uzol N) k prednému (uzol 0); oblúk sa stáča k +w
      th[N] = 0; px[N] = 0; pw[N] = 0;
      for (let i = N - 1; i >= 0; i--) { const k = kVis(i, kL, span), tm = th[i + 1] + k * ds / 2; th[i] = th[i + 1] + k * ds; px[i] = px[i + 1] + ds * Math.cos(tm); pw[i] = pw[i + 1] + ds * Math.sin(tm); }
      // rámec v bode profilu pod stredným valcom
      const i0 = clamp(Math.floor(st.s / ds), 0, N - 1), e = clamp((i0 + 1) * ds - st.s, 0, ds), k0 = kVis(i0, kL, span);
      const ts = th[i0 + 1] + k0 * e, tm = th[i0 + 1] + k0 * e / 2, sx = px[i0 + 1] + e * Math.cos(tm), sw = pw[i0 + 1] + e * Math.sin(tm);
      const cs = Math.cos(-ts), sn = Math.sin(-ts), dS = st.d * 10;
      const pos = barMesh.geometry.attributes.position.array, col = barMesh.geometry.attributes.color.array, K = ol.length;
      let o = 0;
      for (let i = 0; i <= N; i++) {
        const qx = (px[i] - sx) * cs - (pw[i] - sw) * sn, qw = (px[i] - sx) * sn + (pw[i] - sw) * cs, tt = th[i] - ts;
        const X = qx * 10, W = qw * 10 - dS, nx = -Math.sin(tt), nw = Math.cos(tt);
        const el = Math.min(i, N - 1), tw = bar.tw[el] ? 0.18 : 0, ov = bar.ov[el];
        const cc = tw || ov ? COL_DEF : COL;
        for (let k = 0; k < K; k++) {
          let [n, y] = ol[k]; n /= 100; y /= 100;
          if (ov) { n *= 0.82; y *= 1.14; }
          if (tw) { const n2 = n * Math.cos(tw) - y * Math.sin(tw); y = n * Math.sin(tw) + y * Math.cos(tw); n = n2; }
          pos[o] = X + n * nx; pos[o + 1] = YW + y; pos[o + 2] = -(W + n * nw);
          col[o] = cc.r; col[o + 1] = cc.g; col[o + 2] = cc.b; o += 3;
        }
      }
      barMesh.geometry.attributes.position.needsUpdate = true; barMesh.geometry.attributes.color.needsUpdate = true;
      barMesh.geometry.computeBoundingSphere();
      // vodiace kladky na vnútornej strane oblúka pri x = ±(A + 1.3)
      guides.forEach((gd) => {
        let best = -1, bd = Infinity;
        for (let i = 0; i <= N; i++) { const qx = ((px[i] - sx) * cs - (pw[i] - sw) * sn) * 10, dd = Math.abs(qx - gd.s * (A + 1.3)); if (dd < bd) { bd = dd; best = i; } }
        const on = c.guides && bd < 0.3;
        gd.roller.visible = on;
        if (on) {
          const qx = ((px[best] - sx) * cs - (pw[best] - sw) * sn) * 10, qw = ((px[best] - sx) * sn + (pw[best] - sw) * cs) * 10 - dS, tt = th[best] - ts, off = prof.h / 200 + 0.28;
          gd.roller.position.set(qx - Math.sin(tt) * off, YW, -(qw + Math.cos(tt) * off));
          const dx = gd.roller.position.x - gd.piv.position.x, dz = gd.roller.position.z - gd.piv.position.z;
          gd.arm.rotation.y = Math.atan2(dx, dz); gd.arm.scale.z = Math.hypot(dx, dz);
        } else { gd.arm.rotation.y = gd.s * 2.4; gd.arm.scale.z = 1.2; }
      });
    };
    buildRolls(); makeBar();

    // ---------- pohľady, popisy ----------
    const W = (x, y, z) => { mach.updateMatrixWorld(); return mach.localToWorld(v3(x, y, z)); };
    const Wa = (x, y, z) => W(x, y, z).toArray();
    const anchors = {
      skrina: () => W(-4.6, 5, 4), valce: () => W(A + RR, YW + 0.6, RR), stredny: () => W(0, YW + 0.8, -RR - 0.4 + st.d * 10), vodiace: () => W(A + 2.2, YW, -3.2),
      rozvadzac: () => W(3.3, 8.9, 4.2), pedal: () => v3(1.3, 0.4, 6.4), profil: () => W(-A - 1.5, YW + 0.3, 0),
    };
    const views = {
      celok: () => (c.hv === 'v' ? [[10, 10, 26], [-2, 5, 0]] : [[12, 17, 21], Wa(-2, YW - 2, -1)]),
      valce: () => [Wa(1.5, YW + 6.5, 5.5), Wa(0, YW, 0), true],
      profil: () => [Wa(-1, YW + 24, 6), Wa(-1, YW, -2), true],
      panel: () => [[4.5, 8.0, 10.5], Wa(3.3, 7.6, 4.2), true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    let t = 0, last = performance.now(), teleT = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 3.2 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const inRolls = () => st.s > 0.001 && st.s < bar.L - 0.001;
    apiRef.current.view = (n) => insp.goView(n, false);
    apiRef.current.measure = () => ({ bar, info: bendInfo(bar) });
    apiRef.current.save = () => ({ v: 1, prof: c.prof, L: bar.L, N: bar.N, s: st.s, kmax: toB64(bar.kmax), kf: toB64(bar.kf), tw: toB64(bar.tw), ov: toB64(bar.ov) });
    apiRef.current.load = (r) => {
      if (!r || r.v !== 1 || !PROFILES[r.prof]) return false;
      push('prof', r.prof); push('len', Math.round(r.L * 1000));
      if (!apiRef.current.newBlank()) return false;
      if (bar.N !== r.N) return false;
      bar.kmax.set(fromB64(r.kmax, Float32Array)); bar.kf.set(fromB64(r.kf, Float32Array)); bar.tw.set(fromB64(r.tw, Uint8Array)); bar.ov.set(fromB64(r.ov, Uint8Array));
      st.s = clamp(r.s, 0.03, bar.L - 0.03); st.dirty = true;
      return true;
    };
    apiRef.current.exportStl = () => exportStl(barMesh);
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if(c.running || c.drive || c.wheel || c.work)throw new Error(L('Najprv zastav stroj a potom exportuj obrobok.','Stop the machine before exporting the workpiece.'));
      return exportStep(barG);
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) { say(L('Najprv vlož profil späť do valcov.', 'Put the profile back into the rolls first.')); return false; }
      if (c.drive) { say(L('Najprv zastav valce.', 'Stop the rolls first.')); return false; }
      push('dT', 0); st.d = 0; makeBar();
      say(L(`Vložený nový profil: ${profName(c.prof).toLowerCase()}, ${c.len} mm.`, `New profile inserted: ${profName(c.prof).toLowerCase()}, ${c.len} mm.`), 'info');
      return true;
    };
    apiRef.current.setRolls = (id, force = false) => {
      if (c.drive) { say(L('Valce sa menia pri stojacom stroji.', 'The rolls are changed with the machine stopped.')); return false; }
      if (force) { st.d = 0; c.dT = 0; pend.dT = 0; }
      if (st.d > 0.0005) { say(L('Najprv odsuň stredný valec (prísuv 0).', 'Retract the centre roll first (feed 0).')); return false; }
      c.rolls = id; buildRolls(); st.dirty = true; return true;
    };
    // vybratie profilu zo stroja: valce stoja a stredný valec je odsunutý
    const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj: () => barG, getSpot: () => v3(0, 9, 9), onState: (v) => { push('unclamped', v); push('manual', c.manual); } });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in') {
        if (c.drive) { say(L('Profil sa vyberá pri stojacich valcoch.', 'The profile is taken out with the rolls stopped.')); return; }
        if (st.d > 0.0005 || c.dT > 0) { say(L('Najprv odsuň stredný valec (prísuv 0) – profil je zovretý medzi valcami.', 'Retract the centre roll first (feed 0) – the profile is gripped between the rolls.')); return; }
        if (st.tilt !== (c.hv === 'v' ? 1 : 0)) { say(L('Počkaj, kým sa stroj sklopí.', 'Wait until the machine has tilted.'), 'info'); return; }
      }
      if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb profilu.', 'Wait until the profile movement finishes.'), 'info');
    };
    apiRef.current.setHv = (v) => { if (c.unclamped) { say(L('Najprv vlož profil späť do valcov.', 'Put the profile back into the rolls first.')); return false; } if (c.drive) { say(L('Poloha stroja sa mení pri stojacich valcoch.', 'The machine position is changed with the rolls stopped.')); return false; } return true; };

    // ---------- ovládanie ----------
    const needPower = (fn) => () => { if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.')); else fn(); };
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0), onSet: (i) => { push('power', i === 1); if (!i) push('drive', 0); }, read: () => (c.power ? 'I' : '0') }, mainSw);
    ctrl.reg({ type: 'button', label: LL('◀ Vzad', '◀ Reverse'), hint: LL('Valce otáčajú profil späť (doľava).', 'The rolls drive the profile back (to the left).'), action: needPower(() => push('drive', c.drive === -1 ? 0 : -1)) }, bBack);
    ctrl.reg({ type: 'button', label: LL('Vpred ▶', 'Forward ▶'), hint: LL('Valce posúvajú profil vpred (doprava).', 'The rolls drive the profile forward (to the right).'), action: needPower(() => push('drive', c.drive === 1 ? 0 : 1)) }, bFwd);
    ctrl.reg({ type: 'button', label: LL('STOP valcov', 'Rolls STOP'), hint: LL('Zastaví valce.', 'Stops the rolls.'), action: () => push('drive', 0) }, bStop);
    ctrl.reg({ type: 'button', label: LL('Stredný valec −', 'Centre roll −'), hint: LL('Hydraulika odsunie stredný valec o 1 mm.', 'The hydraulics retract the centre roll by 1 mm.'), action: needPower(() => push('dT', clamp(Math.round((c.dT - 1) * 10) / 10, 0, 150))) }, bMinus);
    ctrl.reg({ type: 'button', label: LL('Stredný valec +', 'Centre roll +'), hint: LL('Hydraulika prisunie stredný valec o 1 mm – menší polomer.', 'The hydraulics feed the centre roll by 1 mm – smaller radius.'), action: needPower(() => push('dT', clamp(Math.round((c.dT + 1) * 10) / 10, 0, 150))) }, bPlus);
    ctrl.reg({ type: 'button', label: LL('Núdzový STOP', 'Emergency STOP'), hint: LL('Okamžite zastaví valce.', 'Stops the rolls at once.'), action: () => { push('drive', 0); say(L('Núdzové zastavenie.', 'Emergency stop.'), 'danger'); } }, eStop);
    ctrl.reg({ type: 'button', label: LL('Ľavý pedál – vzad', 'Left pedal – reverse'), hint: LL('Stlač = chod vzad, znova = stop.', 'Press = reverse, again = stop.'), action: needPower(() => push('drive', c.drive === -1 ? 0 : -1)) }, pedL);
    ctrl.reg({ type: 'button', label: LL('Pravý pedál – vpred', 'Right pedal – forward'), hint: LL('Stlač = chod vpred, znova = stop.', 'Press = forward, again = stop.'), action: needPower(() => push('drive', c.drive === 1 ? 0 : 1)) }, pedR);
    ctrl.reg({ type: 'button', still: true, label: LL('Pracovná lampa', 'Work lamp'), hint: LL('Klik zapne alebo vypne lampu.', 'Click to switch the lamp on or off.'), action: () => push('light', !c.light) }, lamp.shade);
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf, roll = 0;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      wi.update(dt);
      if (!c.power && c.drive) push('drive', 0);
      if (c.unclamped && c.drive) { push('drive', 0); say(L('Profil je vybratý zo stroja – najprv ho vlož späť.', 'The profile is out of the machine – put it back first.')); }
      if (c.unclamped && c.dT > 0) { push('dT', 0); }
      // sklopenie stroja H / V
      const tgt = c.hv === 'v' ? 1 : 0;
      if (st.tilt !== tgt) {
        if (approach(st.tilt, tgt, 0.5 * dt) === tgt) setTimeout(() => insp.goView('celok', false), 0);
        st.tilt = approach(st.tilt, tgt, 0.5 * dt);
        const e = st.tilt * st.tilt * (3 - 2 * st.tilt);
        mach.rotation.x = e * Math.PI / 2; mach.position.set(0, Math.sin(e * Math.PI / 2) * 4.2, -e * 7.6);
        if (c.drive) push('drive', 0);
      }
      // hydraulický prísuv stredného valca 4 mm/s
      const p = prof, dPrev = st.d;
      st.d = approach(st.d, clamp(c.dT, 0, 150) / 1000, 0.004 * dt);
      const sPrev = st.s, v = c.power ? c.drive * c.v / 60 : 0;
      st.s += v * dt;
      if (st.s >= bar.L - 0.001 || st.s <= 0.001) {
        st.s = clamp(st.s, 0.001, bar.L - 0.001);
        if (c.drive) { push('drive', 0); say(st.s > 0.5 ? L('Profil prešiel valcami – zmeraj polomer, prípadne prisuň a prejdi späť.', 'The profile has passed the rolls – measure the radius, feed more and pass back if needed.') : L('Profil vyšiel zo vstupnej strany.', 'The profile left on the entry side.'), 'info'); }
      }
      const kL = kLoaded(st.d), span = st.s >= BEND_A && bar.L - st.s >= BEND_A, bending = span && kL > kYield(p);
      // chyby: profil nastojato / uholník bez kladiek sa skrúti, rúra na rovných valcoch sa sploští, iný profil v drážkach sa nevedie
      let defect = null;
      if (bending) {
        if (p.rolls === 'rura' && c.rolls !== 'rura') defect = 'ov';
        else if (p.rolls !== 'rura' && c.rolls === 'rura') defect = 'tw';
        else if (p.guide && !c.guides) defect = 'tw';
      }
      sayOnce('ov', defect === 'ov', L('Rúra sa na valcoch s nákružkami splošťuje – nasaď drážkové valce pre rúru.', 'The tube is flattening on the flanged rolls – fit the grooved tube rolls.'), 'danger');
      sayOnce('tw', defect === 'tw' && c.rolls !== 'rura', L('Profil sa pri ohybe skrúca a vybočuje – priklop bočné vodiace kladky.', 'The profile twists and buckles while bending – swing in the side guide rollers.'), 'danger');
      sayOnce('twR', defect === 'tw' && c.rolls === 'rura', L('V drážkových valcoch pre rúru sa tento profil nevedie a skrúca sa – nasaď valce s nákružkami.', 'This profile is not guided in the tube grooves and twists – fit the flanged rolls.'), 'danger');
      sayOnce('elastic', span && kL > 0 && kL <= kYield(p) && c.drive !== 0, L('Prísuv je taký malý, že profil sa ohne len pružne – za valcami zostane rovný.', 'The feed is so small that the profile bends only elastically – it stays straight after the rolls.'), 'info');
      if (inRolls()) {
        const n = passBar(bar, p, sPrev, st.s, kL, BEND_A, defect);
        if (n || st.s !== sPrev || st.d !== dPrev) st.dirty = true;
      }
      st.F = span ? rollForce(kL, p) : 0;
      if (bending && c.drive) st.bendT = t;
      if (st.dirty) { rebuildBar(kL); st.dirty = false; }

      // pohyb valcov
      roll += v * dt * 10 / RR;
      spins.forEach((sp, i) => { sp.rotation.y = (i === 2 ? 1 : -1) * roll; });
      shaftMid.position.z = -(RR + p.h / 200) + st.d * 10; slide.position.z = shaftMid.position.z;
      pedL.rotation.x = c.drive === -1 ? 0.18 : 0; pedR.rotation.x = c.drive === 1 ? 0.18 : 0;
      shaftOut.forEach((g) => { g.position.z = RR + p.h / 200; });
      lampRun.emissive.setHex(c.drive ? 0x22dd55 : 0);
      lamp.update(c.light);
      ctrl.update(dt);
      insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        const kf = kFinal(kL, p);
        setTele({ d: st.d * 1000, s: st.s * 1000, F: st.F / 1000, RL: kL > 0 ? 1000 / kL : 0, Rf: kf > 0 ? 1000 / kf : 0, msg: st.msg && st.msg.until > t ? st.msg : null, bending: t - st.bendT < 0.3, inRolls: inRolls() });
        if (Object.keys(pend).length) { const q = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]); setUi((u) => ({ ...u, ...q })); }
      }
      snd.update({ motor: c.drive ? 0.25 + c.v / 8 * 0.5 : 0, cut: t - st.bendT < 0.3 ? Math.min(1, st.F / 8000) * 0.8 : 0 });
      renderer.render(scene, camera);
    };
    if (c.hv === 'v') { mach.rotation.x = Math.PI / 2; mach.position.set(0, 4.2, -7.6); }
    try { if (/[?&]debug/.test(window.location.search)) window.__bender = { st, c, bar: () => bar }; } catch (err) { /* ignorované */ }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); insp.dispose(); wi.dispose();
      try { if (window.__bender && window.__bender.st === st) delete window.__bender; } catch (err) { /* ignorované */ }
      disposeStage();
    };
  }, []);

  const parts = benderParts();
  const m = apiRef.current.measure ? apiRef.current.measure() : null, info = m ? m.info : null;
  const fmt = (x, d = 0) => L(x.toFixed(d).replace('.', ','), x.toFixed(d));
  const p = PROFILES[ui.prof];
  const setupTask = (task) => {
    if (ui.drive) return;
    Object.entries(task.setup).forEach(([k, val]) => {
      if (k === 'rolls') { if (apiRef.current.setRolls && apiRef.current.setRolls(val, true)) set('rolls', val); } else set(k, val);
    });
    if (apiRef.current.newBlank) apiRef.current.newBlank();
  };
  const statusMsg = tele.msg ? tele.msg
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
    : tele.bending ? { kind: 'run', text: `${L('Ohýbanie', 'Bending')} – ${ui.v} m/min, ${L('prísuv', 'feed')} ${fmt(tele.d, 1)} mm, ${L('sila', 'force')} ${fmt(tele.F, 1)} kN` }
    : ui.drive ? { kind: 'run', text: L('Valce sa otáčajú.', 'The rolls are turning.') }
    : { kind: 'idle', text: L('Valce stoja. Prisuň stredný valec a spusti chod pedálom alebo tlačidlom.', 'The rolls are stopped. Feed the centre roll and start with the pedal or button.') };
  const chips = [{ color: ui.drive ? '#3ee06c' : '#8b8f89', text: ui.drive ? `${ui.drive > 0 ? L('Vpred', 'Forward') : L('Vzad', 'Reverse')} ${ui.v} m/min` : L('Stojí', 'Stopped') }];
  chips.push({ color: '#7fb6ff', text: `${L('Poloha', 'Position')} ${ui.hv.toUpperCase()}` });
  if (tele.bending) chips.push({ color: '#ffb340', text: `F ${fmt(tele.F, 1)} kN` });
  const busy = !!ui.drive;

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef}
        workLabels={[L('Pozrieť obrobok', 'Inspect workpiece'), L('Upnúť späť', 'Clamp back')]}
        tips={[L('Odpruženie: nastav menší polomer, ako má vyjsť – začni menším prísuvom, zmeraj a prisúvaj po krokoch.', 'Springback: set a smaller radius than wanted – start with a small feed, measure and feed in steps.'),
          L('Profil sa vyberá len pri odsunutom strednom valci (prísuv 0).', 'The profile can be taken out only with the centre roll retracted (feed 0).'),
          L('Rovné konce (asi 200 mm) sa na troch valcoch neohnú – po ohnutí sa odrežú.', 'The straight ends (about 200 mm) cannot be bent on three rolls – they are cut off afterwards.')]} />
      <aside className="panel"><fieldset className="machine-settings" disabled={ui.unclamped}>
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · profilová ohýbačka', 'Simulator · section bender')} title={L('Profilová ohýbačka', 'Section bending machine')}
          sub={L('Predloha: COMAC 3025 HV – tri poháňané valce v pyramíde, hydraulický prísuv stredného valca, bočné vodiace kladky, pracovná poloha vodorovná (H) aj zvislá (V).', 'Modelled after a COMAC 3025 HV – three driven rolls in a pyramid, hydraulic centre-roll feed, side guide rollers, horizontal (H) and vertical (V) working position.')}
          rows={[[L('Prísuv mm', 'Feed mm'), tele.d.toFixed(1)], [L('Profil mm', 'Profile mm'), tele.s.toFixed(0)], [L('Sila kN', 'Force kN'), tele.F.toFixed(1)]]}
          foot={[`${ui.v} m/min · ${L('poloha', 'position')} ${ui.hv.toUpperCase()}`, profName(ui.prof)]} status={statusMsg} />

        <TaskSection machine="profilova" tasks={BENDER_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'drive', items: BENDER_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Chod valcov', 'Roll drive')}</h2>
          <DirRun value={ui.drive} onChange={(d) => { if (d && ui.unclamped) return; if (d && !ui.power) set('power', true); set('drive', d); }} />
          <div className="mt-2" />
          <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => { const val = !ui.power; set('power', val); if (!val) set('drive', 0); }} />
          <Toggle on={ui.light} label={L('Pracovné osvetlenie', 'Work light')} onClick={() => set('light', !ui.light)} />
          <SegRow label={L('Rýchlosť m/min', 'Speed m/min')} value={ui.v} options={BEND_SPEEDS.map((n) => [n, String(n)])} onChange={(n) => set('v', n)} />
          <SegRow label={L('Pracovná poloha', 'Working position')} value={ui.hv} options={[['h', L('H – vodorovne', 'H – horizontal')], ['v', L('V – zvisle', 'V – vertical')]]} onChange={(val) => { if (apiRef.current.setHv && apiRef.current.setHv(val)) set('hv', val); }} />
        </div>

        <div className="sec">
          <div className="section-heading"><h2 className="sec-title mb-2">{L('Stredný valec', 'Centre roll')}</h2><SectionInfo title={L('Stredný valec', 'Centre roll')}><p className="text-xs muted">{L('Profil sa ohne trvalo, až keď krajné vlákna prekročia medzu klzu. Po odľahčení sa oblúk čiastočne narovná – preto sa nastavuje menší polomer, ako má vyjsť. Menší prísuv pri ďalšom prechode už oblúk nezmení.', 'The profile bends permanently only when the outer fibres exceed the yield point. After unloading the arc partly straightens – so a smaller radius is set than the one wanted. A smaller feed on a later pass no longer changes the arc.')}</p></SectionInfo></div>
          <Slider id="bd" label={L('Prísuv δ (hydraulika)', 'Feed δ (hydraulic)')} unit="mm" min={0} max={150} step={0.1} value={ui.dT} actual={tele.d} digits={1} onChange={(val) => set('dT', val)} />
          <div className="flex flex-wrap gap-2 mb-2">
            {[-5, -1, -0.2, 0.2, 1, 5].map((x) => <button key={x} type="button" className="btn" onClick={() => set('dT', clamp(Math.round((ui.dT + x) * 10) / 10, 0, 150))}>{x > 0 ? '+' : ''}{fmt(x, x % 1 ? 1 : 0)}</button>)}
          </div>
          <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
            <div>{L('Polomer v zábere', 'Radius under load')}: <b>{tele.RL ? `R ${fmt(tele.RL)} mm` : '–'}</b></div>
            <div>{L('Po odpružení (odhad)', 'After springback (estimate)')}: <b>{tele.Rf ? `R ${fmt(tele.Rf)} mm` : L('rovný – len pružný ohyb', 'straight – elastic only')}</b></div>
          </div>

        </div>

        <div className="sec">
          <div className="section-heading"><h2 className="sec-title mb-2">{L('Valce a vedenie', 'Rolls and guides')}</h2><SectionInfo title={L('Valce a vedenie', 'Rolls and guides')}><p className="text-xs muted">{p.rolls === 'rura' ? L('Rúra potrebuje drážkové valce, inak sa sploští.', 'A tube needs grooved rolls, otherwise it flattens.') : p.guide ? L('Tento profil sa bez vodiacich kladiek skrúti.', 'This profile twists without the guide rollers.') : L('Tento profil sa vedie vo valcoch s nákružkami.', 'This profile is guided in the flanged rolls.')}</p></SectionInfo></div>
          <SegRow label={L('Tvarové valce', 'Forming rolls')} value={ui.rolls} options={[['plocha', L('s nákružkami', 'flanged')], ['rura', L('pre rúru Ø33,7', 'tube Ø33.7')]]} onChange={(val) => { if (apiRef.current.setRolls && apiRef.current.setRolls(val)) set('rolls', val); }} />
          <Toggle on={ui.guides} label={L('Bočné vodiace kladky', 'Side guide rollers')} onClick={() => set('guides', !ui.guides)} />

        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Meranie oblúka', 'Arc measurement')}</h2>
          {info && info.bent > 0 ? (
            <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
              <div>{L('Polomer', 'Radius')}: <b>R {fmt(info.R)} mm</b> (± {fmt(info.spread)} mm)</div>
              <div>{L('Ohnutá dĺžka', 'Bent length')}: <b>{fmt(info.bent)} mm</b>, {L('uhol', 'angle')} <b>{fmt(info.angle)}°</b></div>
              <div>{L('Rovné konce', 'Straight ends')}: <b>{fmt(info.ends[0])} / {fmt(info.ends[1])} mm</b></div>
              {(info.tw > 0 || info.ov > 0) && <div style={{ color: 'var(--danger)' }}>{info.ov ? L('Rúra sploštená', 'Tube flattened') : L('Profil skrútený', 'Profile twisted')}</div>}
            </div>
          ) : <p className="text-xs muted">{L('Profil je zatiaľ rovný.', 'The profile is still straight.')}</p>}
        </div>

        <BlankSection onApply={() => { if (apiRef.current.newBlank) apiRef.current.newBlank(); }} applyLabel={L('Vložiť nový profil', 'Insert a new profile')}
          note={L('Oceľ S235 (Re 235 MPa). Profil sa vloží predným koncom pod stredný valec.', 'S235 steel (yield 235 MPa). The profile is inserted with its front end under the centre roll.')}>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {PROF_LIST.map(([id, sk, en]) => (
              <button key={id} type="button" className={`tool-slot ${ui.prof === id ? 'on' : ''}`} aria-pressed={ui.prof === id} disabled={busy} onClick={() => set('prof', id)}>
                <b>{L(sk, en)}</b>{PROFILES[id].rolls === 'rura' ? L('drážkové valce', 'grooved rolls') : PROFILES[id].guide ? L('s kladkami', 'with guides') : L('valce s nákružkami', 'flanged rolls')}
              </button>
            ))}
          </div>
          <Slider id="bl" label={L('Dĺžka', 'Length')} unit="mm" min={600} max={3000} step={100} value={ui.len} onChange={(val) => set('len', val)} />
        </BlankSection>

        <ExportSection machine="profilova" apiRef={apiRef} />
        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['valce', L('Valce', 'Rolls')], ['profil', L('Profil zhora', 'Profile from above')], ['panel', L('Panel', 'Panel')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter apiRef={apiRef} ui={ui} />
      </fieldset></aside>
    </div>
  );
}

export { BenderSimulator };
export default BenderSimulator;
