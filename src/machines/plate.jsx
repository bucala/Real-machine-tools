import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { baseMats, makeKit, std } from '../core/kit';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection } from '../ui/tools';
import { ArcDrawing, RingDrawing } from '../ui/sketch';
import { kFinal, kYield, rollForce } from './benderMath';
import { PLATE_A, PLATE_DMAX, PLATE_LMAX, PLATE_TMAX, bendInfo, createSheet, kPyr, passPyramid, plateChecks, plateProfile } from './plateMath';
import { BlankSection, DirRun, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// ZAKRUŽOVAČKA PLECHU TOS XZC 3000/10 – trojvalcová pyramída
// =====================================================================
// mierka 1 = 100 mm. Valce majú osi v smere Z (pracovná dĺžka 3 000 mm), plech ide v +X.
// Dva spodné poháňané valce v x = ±A, horný valec v x = 0 sa prisúva nadol o δ; plech sa ohýba nahor okolo neho.
// Pravý koniec: vidlicový stojan s odklopným ložiskom horného valca – cez neho sa hotový plášť vysunie.
const Y0 = 7.0, A = PLATE_A * 10, RT = 1.4, RB = 1.1, HW = 15.6, FW = 1.2;
const plateParts = () => mkParts([
  ['stojanL', 'Stojan pohonu', 'Drive housing', 'Stojan na strane pohonu', 'Drive-end housing', 'Liatinový stojan nesie ložiská všetkých troch valcov a prevodovku. Ručné koleso na stĺpiku prestavuje horný valec nadol o prísuv δ – na oboch koncoch naraz.', 'The cast housing carries the bearings of all three rolls and the gearbox. The handwheel on the column moves the top roll down by the infeed δ – at both ends together.'],
  ['stojanP', 'Odklopné ložisko', 'Drop-end housing', 'Vidlicový stojan s odklopným ložiskom', 'Fork housing with drop-end bearing', 'Ložisko horného valca leží vo vidlici a drží ho kolík s rukoväťou. Po vytiahnutí kolíka sa ložisko odklopí, horný valec sa nadvihne a hotový plášť sa vysunie cez koniec valca.', 'The top roll bearing sits in the fork, held by a pin with a T-handle. With the pin pulled, the bearing swings open, the top roll is lifted and the finished shell slides off the end of the roll.'],
  ['horny', 'Horný valec', 'Top roll', 'Horný (ohýbací) valec', 'Top (bending) roll', 'Voľne uložený valec Ø280 mm. Čím viac sa prisunie nadol medzi spodné valce, tým menší polomer. Plech odpruží – prísuv musí byť väčší, ako zodpovedá žiadanému polomeru.', 'A free Ø280 mm roll. The further it is moved down between the lower rolls, the smaller the radius. The sheet springs back – the infeed must be larger than the wanted radius suggests.'],
  ['spodne', 'Spodné valce', 'Lower rolls', 'Spodné poháňané valce', 'Lower driven rolls', 'Dva valce Ø220 mm s rozostupom 360 mm poháňa motor cez prevodovku. Plech sa ohne len v úseku, ktorý leží na oboch – asi 180 mm na každom konci zostane rovných.', 'Two Ø220 mm rolls 360 mm apart, driven by the motor through the gearbox. The sheet bends only where it lies on both – about 180 mm at each end stays flat.'],
  ['pohon', 'Pohon', 'Drive', 'Motor s prevodovkou', 'Motor with gearbox', 'Elektromotor a prevodovka za stojanom poháňajú spodné valce, chod vpred a vzad.', 'The motor and gearbox behind the housing drive the lower rolls, forward and reverse.'],
  ['ovladanie', 'Ovládanie', 'Controls', 'Ovládací stĺpik', 'Control column', 'Hlavný vypínač, chod vpred a vzad, stop a núdzový STOP.', 'Main switch, forward and reverse, stop and the emergency stop.'],
  ['plech', 'Plech', 'Sheet', 'Plech', 'Sheet', 'Oceľový plech S235 do hrúbky 10 mm a šírky 3 000 mm.', 'S235 steel sheet up to 10 mm thick and 3,000 mm wide.'],
]);
const PLATE_TASKS = [
  { id: 'plast', title: () => L('Plášť Ø1000 z plechu 6 mm', 'Shell Ø1000 from 6 mm sheet'),
    desc: () => L('Plech 6 × 1500 × 3140 mm (obvod Ø1000). Zakruž plášť R 500 ±6 mm s uhlom aspoň 340° a rovnými koncami najviac 50 mm. Na trojvalcovej pyramíde zostanú konce rovné v dĺžke polovice rozostupu spodných valcov – predohni ich s podložným plechom. Prísuv horného valca zväčšuj po krokoch (odpruženie), nakoniec odklop ložisko a plášť vysuň.', 'Sheet 6 × 1500 × 3140 mm (circumference of Ø1000). Roll a shell R 500 ±6 mm of at least 340° with flat ends of at most 50 mm. On a three-roll pyramid the ends stay flat for half the lower-roll spacing – pre-bend them with a backing plate. Increase the top-roll infeed in steps (springback), finally open the drop-end bearing and slide the shell off.'),
    setup: { t: 6, b: 1500, len: 3140, backing: false },
    drawing: () => <RingDrawing dia text="Ø1000 (R 500 ±6)" notes={[L('plech 6 × 1500 × 3140', 'sheet 6 × 1500 × 3140'), L('uhol ≥ 340°, konce ≤ 50', 'angle ≥ 340°, ends ≤ 50')]} />,
    labels: { radius: () => L('Polomer R 500 ±6 mm', 'Radius R 500 ±6 mm'), even: () => L('Rovnomerný polomer (±6 mm)', 'Even radius (±6 mm)'), angle: () => L('Uhol aspoň 340°', 'Angle at least 340°'), ends: () => L('Rovné konce ≤ 50 mm (predohnuté)', 'Flat ends ≤ 50 mm (pre-bent)') } },
  { id: 'oblukP', title: () => L('Oblúk R 800 z plechu 10 mm', 'Arc R 800 from 10 mm sheet'),
    desc: () => L('Plech 10 × 2000 × 2000 mm – plná kapacita stroja. Ohni oblúk R 800 ±10 mm na dĺžke aspoň 1 500 mm. Hrubý plech odpruží menej ako tenký, ale potrebuje veľkú silu – prisúvaj opatrne.', 'Sheet 10 × 2000 × 2000 mm – the full machine capacity. Roll an arc R 800 ±10 mm over at least 1,500 mm. A thick sheet springs back less than a thin one but needs a large force – feed carefully.'),
    setup: { t: 10, b: 2000, len: 2000, backing: false },
    drawing: () => <ArcDrawing R={800} text="R 800 ±10" notes={[L('plech 10 × 2000 × 2000', 'sheet 10 × 2000 × 2000'), L('ohnutá dĺžka ≥ 1 500 mm', 'bent length ≥ 1,500 mm')]} />,
    labels: { radius: () => L('Polomer R 800 ±10 mm', 'Radius R 800 ±10 mm'), even: () => L('Rovnomerný polomer (±10 mm)', 'Even radius (±10 mm)'), bent: () => L('Ohnutá dĺžka ≥ 1 500 mm', 'Bent length ≥ 1,500 mm') } },
].map((t) => ({ ...t, checks: (m) => plateChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const PLATE_SAFETY = () => [
  L('Ruky držím ďaleko od valcov – plech sa vťahuje medzi horný a spodné valce.', 'I keep my hands well away from the rolls – the sheet is drawn in between the top and lower rolls.'),
  L('Plech podopieram zboku, dlhý alebo ťažký plech podopiera žeriav alebo pomocník.', 'I support the sheet from the side; a long or heavy sheet is supported by a crane or a helper.'),
  L('Odklopné ložisko je zaistené kolíkom, kým sa valce točia.', 'The drop-end bearing is secured by its pin while the rolls turn.'),
];

function PlateRollSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { power: true, drive: 0, manual: false, v: 4, dT: 0, backing: false, t: 6, b: 1500, len: 3140 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ d: 0, s: 0, RL: 0, Rf: 0, F: 0, msg: null, bending: false, open: false, out: false });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('bender');
    const dom = renderer.domElement;
    const M = {
      ...baseMats(0xa9cd7f, 0x93b96a, 0x6f9150),
      top: std(0x9d8a80, 0.55, 0.45), low: std(0x7e8285, 0.45, 0.6), front: std(0xb3a79c, 0.55, 0.45), bronze: std(0x8a6a3a, 0.35, 0.8),
      sheet: new THREE.MeshStandardMaterial({ color: 0x9ea4a9, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide, flatShading: true }),
      floor: std(0x6c6f71, 0.9, 0.2), groove: std(0x4c4f51, 0.9, 0.1),
    };
    const kit = makeKit(M);
    const { add, box, cylX, cylY, cylZ, ball, hitProxy, handwheel } = kit;
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- podlaha z rebrovaných plechov ----------
    const fl = new THREE.Group(); root.add(fl);
    box(fl, -9, 9, -0.02, 0.0, -HW - 6, HW + 6, M.floor);
    for (let x = -8.5; x <= 8.5; x += 0.5) box(fl, x - 0.01, x + 0.01, 0.0, 0.006, -HW - 6, HW + 6, M.groove);
    // ---------- stojany (tvar podľa koncového pohľadu: široký spodok, vidlica hore) ----------
    const fork = [[3.2, Y0 - 0.3], [2.9, Y0 + 4.2], [1.55, Y0 + 4.2], [1.55, Y0 - 1.0], [-1.55, Y0 - 1.0], [-1.55, Y0 + 4.2], [-2.9, Y0 + 4.2], [-3.2, Y0 - 0.3]];
    const lower = [[-4.0, 0], [4.0, 0], [4.0, 1.4], [3.4, 2.2], [3.2, Y0 - 0.3]];
    const slab = (parent, pts, z0, m) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); const g = new THREE.ExtrudeGeometry(sh, { depth: FW, bevelEnabled: false }); g.translate(0, 0, z0); return add(parent, g, m); };
    // na strane pohonu je stojan v celku (spodok + vidlica), na odklopnej strane je vidlica oddelená a odklápa sa von
    const housing = (parent, z0, sgn, withFork) => {
      slab(parent, withFork ? [...lower, ...fork.slice(1), [-3.4, 2.2], [-4.0, 1.4]] : [...lower.slice(0, 4), [3.25, Y0 - 0.9], [-3.25, Y0 - 0.9], [-3.4, 2.2], [-4.0, 1.4]], z0, M.green);
      const zo = sgn > 0 ? z0 + FW : z0;                                                         // vonkajšia stena
      const curve = (s) => new THREE.CatmullRomCurve3([v3(s * 3.9, 1.2, zo + sgn * 0.12), v3(s * 4.5, 3.4, zo + sgn * 0.12), v3(s * 3.7, Y0 - 1.2, zo + sgn * 0.12), v3(s * 3.2, Y0 - 0.5, zo + sgn * 0.12)]);
      [-1, 1].forEach((s) => add(parent, new THREE.TubeGeometry(curve(s), 24, 0.16, 8, false), M.greenDark));   // zahnuté ramená
      cylX(parent, 0.13, 0.13, -3.6, 3.6, 1.9, zo + sgn * 0.2, M.steelDark, 12);                     // spojovacia tyč
      [-1, 1].forEach((s) => box(parent, s * 3.6 - 0.35, s * 3.6 + 0.35, 1.6, 2.2, sgn > 0 ? zo : zo - 0.3, sgn > 0 ? zo + 0.3 : zo, M.greenDark));
      [-1, 1].forEach((s) => { cylZ(parent, 0.95, 0.95, sgn > 0 ? zo : zo - 0.2, sgn > 0 ? zo + 0.2 : zo, s * A, Y0 - RB, M.greenDark, 32); cylZ(parent, 0.55, 0.55, sgn > 0 ? zo + 0.2 : zo - 0.28, sgn > 0 ? zo + 0.28 : zo - 0.2, s * A, Y0 - RB, M.green, 28); });   // veká ložísk spodných valcov
      box(parent, -1.2, 1.2, 3.6, 4.1, sgn > 0 ? zo : zo - 0.25, sgn > 0 ? zo + 0.25 : zo, M.greenDark);
    };
    const hL = grp('stojanL'), hR = grp('stojanP');
    housing(hL, -HW - FW - 0.2, -1, true); housing(hR, HW + 0.2, 1, false);
    cylY(hL, 0.32, 0.32, Y0 + 4.2, Y0 + 5.6, 0, -HW - FW - 0.8, M.bronze, 20);                        // skrutka prísuvu horného valca
    box(hL, -1.6, 1.6, Y0 + 4.2, Y0 + 4.6, -HW - FW - 0.2, -HW - 0.2, M.greenDark);                    // priečka vidlice
    // odklopná vidlica: pánt na vonkajšej hrane spodku, odklápa sa von (+z) – uvoľní koniec horného valca
    const YH = Y0 - 0.9, ZH = HW + 0.2 + FW;
    const forkD = [[3.25, YH], [2.9, Y0 + 4.2], [1.55, Y0 + 4.2], [1.55, Y0 - 0.3], [-1.55, Y0 - 0.3], [-1.55, Y0 + 4.2], [-2.9, Y0 + 4.2], [-3.25, YH]];
    const dropG = new THREE.Group(); dropG.position.set(0, YH, ZH); hR.add(dropG);
    const dropIn = new THREE.Group(); dropIn.position.set(0, -YH, -ZH); dropG.add(dropIn);
    slab(dropIn, forkD, HW + 0.2, M.green);
    box(dropIn, -1.6, 1.6, Y0 + 4.2, Y0 + 4.6, HW + 0.2, HW + 0.2 + FW, M.greenDark);
    cylX(dropG, 0.2, 0.2, -3.4, 3.4, 0, 0, M.steelDark, 14);                                         // čap pántu
    // ložiská horného valca (posúvajú sa vo vidlici s prísuvom δ); pravé sa odklápa s vidlicou
    const bearing = (parent, z0, sgn) => {
      const g = new THREE.Group(); parent.add(g);
      box(g, -1.5, 1.5, -1.0, 1.0, z0, z0 + FW, M.green);
      const zo = sgn > 0 ? z0 + FW : z0;
      box(g, -1.25, 1.25, -0.9, 0.9, sgn > 0 ? zo : zo - 0.12, sgn > 0 ? zo + 0.12 : zo, M.greenDark);
      cylZ(g, 0.8, 0.8, sgn > 0 ? zo + 0.12 : zo - 0.36, sgn > 0 ? zo + 0.36 : zo - 0.12, 0, 0, M.green, 32);
      [0, 1, 2].forEach((k) => { const a = k * TAU / 3 + 0.5; cylZ(g, 0.09, 0.09, sgn > 0 ? zo + 0.36 : zo - 0.4, sgn > 0 ? zo + 0.4 : zo - 0.36, Math.cos(a) * 0.45, Math.sin(a) * 0.45, M.black, 10); });
      return g;
    };
    const bL = bearing(hL, -HW - FW - 0.2, -1);
    const bR = bearing(dropIn, HW + 0.2, 1);
    // kolík s rukoväťou T (istí odklopnú vidlicu k spodku stojana)
    box(hR, 3.2, 3.9, Y0 - 1.5, Y0 - 0.9, HW + 0.2 + FW, HW + 0.2 + FW + 0.5, M.greenDark);
    box(dropIn, 3.2, 3.9, Y0 - 0.9, Y0 - 0.3, HW + 0.2 + FW, HW + 0.2 + FW + 0.5, M.greenDark);
    const pinG = new THREE.Group(); pinG.position.set(3.0, Y0 - 0.9, HW + 0.2 + FW + 0.25); hR.add(pinG);
    cylX(pinG, 0.14, 0.14, 0, 1.6, 0, 0, M.steelDark, 16); cylZ(pinG, 0.07, 0.07, -0.6, 0.6, 1.6, 0, M.steelDark, 10);
    hitProxy(pinG, 0.6, 1.2, 0, 0);
    // ---------- valce ----------
    const topG = grp('horny'), lowG = grp('spodne');
    const mkRoll = (parent, r, m, ext) => { const g = new THREE.Group(); parent.add(g); cylZ(g, r, r, -HW, HW, 0, 0, m, 48); cylZ(g, r * 0.45, r * 0.45, -HW - ext, HW + ext, 0, 0, M.steelDark, 20); box(g, -0.03, 0.03, r - 0.02, r + 0.004, -HW, HW, M.black); return g; };
    const topR = mkRoll(topG, RT, M.top, FW + 0.4), lowA = mkRoll(lowG, RB, M.low, FW + 0.4), lowB = mkRoll(lowG, RB, M.front, FW + 0.4);
    lowA.position.set(-A, Y0 - RB, 0); lowB.position.set(A, Y0 - RB, 0);
    // ---------- pohon, ručné koleso prísuvu, ovládanie ----------
    const drv = grp('pohon');
    box(drv, -2.6, 2.6, 0.3, Y0 - 0.5, -HW - FW - 3.4, -HW - FW - 0.2, M.greenDark);
    cylX(drv, 1.0, 1.0, 2.6, 5.4, 2.6, -HW - FW - 1.8, M.green, 32);
    box(drv, 2.6, 5.4, 0, 1.6, -HW - FW - 3.0, -HW - FW - 0.6, M.greenDark);
    const colW = new THREE.Group(); colW.position.set(-3.4, 0, -HW - FW - 1.2); hL.add(colW);
    box(colW, -0.45, 0.45, 0, Y0 + 3.8, -0.45, 0.45, M.green);
    cylY(colW, 0.1, 0.1, Y0 + 3.8, Y0 + 4.6, 0, 0, M.steel, 12);
    const wD = handwheel(colW, 0.9, 0, Y0 + 4.6, 0, 'y', 0.5);                                      // ručné koleso prísuvu horného valca
    const pan = grp('ovladanie');
    box(pan, 6.0, 6.8, 0, 9.5, -HW - 4.5, -HW - 3.7, M.green);
    box(pan, 5.9, 6.9, 9.5, 11.4, -HW - 4.6, -HW - 3.6, M.panel);
    const pbtn = (y, x, m) => { const g = new THREE.Group(); g.position.set(x, y, -HW - 3.6); pan.add(g); cylZ(g, 0.13, 0.13, 0, 0.07, 0, 0, m, 20); hitProxy(g, 0.18, 0, 0, 0.05); return g; };
    const bBack = pbtn(10.9, 6.1, M.btnGreen), bStop = pbtn(10.9, 6.4, M.black), bFwd = pbtn(10.9, 6.7, M.btnGreen);
    const eStop = new THREE.Group(); eStop.position.set(6.4, 10.1, -HW - 3.6); pan.add(eStop);
    cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16); cylZ(eStop, 0.18, 0.17, 0.07, 0.15, 0, 0, M.red, 24); hitProxy(eStop, 0.24, 0, 0, 0.1);
    const lampRun = std(0x1f5f33, 0.4, 0.1); ball(pan, 0.07, 6.4, 11.2, -HW - 3.58, lampRun);
    // ---------- plech ----------
    const shG = grp('plech');
    let sheet = null, prof = plateProfile(c.t, c.b), mesh = null;
    const st = { s: 0.03, d: 0, dirty: true, msg: null, bendT: -9, open: 0, pin: true, out: 0, done: false, F: 0 };
    const makeSheet = () => {
      prof = plateProfile(c.t, c.b); sheet = createSheet(clamp(c.len, 500, 4000) / 1000);
      if (mesh) { shG.remove(mesh); mesh.geometry.dispose(); }
      const N = sheet.N, geo = new THREE.BufferGeometry(), idx = [];
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 4 * 3), 3));
      for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b2 = i * 4 + (k + 1) % 4; idx.push(a, b2, a + 4, b2, b2 + 4, a + 4); }
      idx.push(0, 1, 2, 0, 2, 3, N * 4, N * 4 + 2, N * 4 + 1, N * 4, N * 4 + 3, N * 4 + 2);
      geo.setIndex(idx); mesh = new THREE.Mesh(geo, M.sheet); mesh.castShadow = true; mesh.userData.part = 'plech'; shG.add(mesh);
      st.s = 0.03; st.dirty = true; st.out = 0; st.done = false; shG.position.z = 0; shG.visible = true;
    };
    const th = new Float64Array(8001), px = new Float64Array(8001), py = new Float64Array(8001);
    const rebuild = () => {
      const N = sheet.N, ds = sheet.ds, kL = kPyr(st.d), span = st.s >= PLATE_A && sheet.L - st.s >= PLATE_A;
      const kv = (i) => { const u = (i + 0.5) * ds; return span && Math.abs(u - st.s) < PLATE_A ? Math.max(sheet.kf[i], kL) : sheet.kf[i]; };
      th[N] = 0; px[N] = 0; py[N] = 0;
      for (let i = N - 1; i >= 0; i--) { const k = kv(i), tm = th[i + 1] + k * ds / 2; th[i] = th[i + 1] + k * ds; px[i] = px[i + 1] + ds * Math.cos(tm); py[i] = py[i + 1] + ds * Math.sin(tm); }
      const i0 = clamp(Math.floor(st.s / ds), 0, N - 1), e = clamp((i0 + 1) * ds - st.s, 0, ds), k0 = kv(i0);
      const ts = th[i0 + 1] + k0 * e, tm = th[i0 + 1] + k0 * e / 2, sx = px[i0 + 1] + e * Math.cos(tm), sy = py[i0 + 1] + e * Math.sin(tm);
      const cs = Math.cos(-ts), sn = Math.sin(-ts), T = prof.h / 200, B = prof.b / 200, pos = mesh.geometry.attributes.position.array, dS = st.d * 10;
      let o = 0;
      for (let i = 0; i <= N; i++) {
        const qx = ((px[i] - sx) * cs - (py[i] - sy) * sn) * 10, qy = ((px[i] - sx) * sn + (py[i] - sy) * cs) * 10 - dS, a = th[i] - ts, nx = -Math.sin(a), ny = Math.cos(a);
        for (const [nn, zz] of [[-T, -B], [T, -B], [T, B], [-T, B]]) { pos[o] = qx + nn * nx; pos[o + 1] = Y0 + qy + nn * ny; pos[o + 2] = zz; o += 3; }
      }
      mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    };
    makeSheet();

    // ---------- pohľady ----------
    const anchors = {
      stojanL: () => v3(-2.9, Y0 + 4.4, -HW - FW - 0.6), stojanP: () => v3(3.6, Y0 - 0.6, HW + 2.0), horny: () => v3(0, Y0 + 2 * RT + 0.2 - st.d * 10, -HW + 3),
      spodne: () => v3(A, Y0 - 0.1, HW - 3), pohon: () => v3(4.0, 3.0, -HW - FW - 1.8), ovladanie: () => v3(6.4, 11.6, -HW - 3.6), plech: () => v3(-4, Y0 + 0.3, 0),
    };
    const views = {
      celok: () => [[20, 17, -30], [0, Y0 - 1, -2]],
      koniec: () => [[13, Y0 + 5, HW + 12], [0, Y0, HW], true],
      bok: () => [[2, Y0 + 2, -HW - 26], [1, Y0 + 1, 0], true],
      valce: () => [[9, Y0 + 7, -HW + 2], [0, Y0, -HW + 6], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed(), onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    let t = 0, last = performance.now(), teleT = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 3.2 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    apiRef.current.view = (n) => insp.goView(n, false);
    apiRef.current.measure = () => ({ sheet, info: bendInfo(sheet) });
    apiRef.current.snapshot = snapshot;
    apiRef.current.newBlank = () => {
      if (c.drive) { say(L('Najprv zastav valce.', 'Stop the rolls first.')); return false; }
      if (st.open > 0.02) { say(L('Najprv zatvor a zaisti odklopné ložisko.', 'Close and secure the drop-end bearing first.')); return false; }
      push('dT', 0); st.d = 0; makeSheet();
      say(L(`Vložený plech ${c.t} × ${c.b} × ${c.len} mm.`, `Sheet ${c.t} × ${c.b} × ${c.len} mm inserted.`), 'info'); return true;
    };
    // odklopné ložisko: kolík von → ložisko sa odklopí, plášť sa vysunie cez koniec horného valca
    apiRef.current.toggleDrop = () => {
      if (c.drive) { say(L('Ložisko sa odklápa len pri stojacich valcoch.', 'The bearing is opened only with the rolls stopped.')); return; }
      if (st.pin) { st.pin = false; say(L('Kolík vytiahnutý – odklopné ložisko sa otvára.', 'Pin pulled – the drop-end bearing opens.'), 'info'); }
      else if (st.open > 0.98 && !st.done) { st.done = true; say(L('Plášť sa vysúva cez koniec horného valca.', 'The shell slides off the end of the top roll.'), 'info'); }
      else if (st.done && st.out >= 1) { st.pin = true; say(L('Ložisko zatvorené a zaistené kolíkom.', 'Bearing closed and secured by the pin.'), 'info'); }
      else if (!st.done) { st.pin = true; }
    };

    // ---------- ovládanie ----------
    const needPower = (fn) => () => { if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.')); else fn(); };
    ctrl.reg({ type: 'button', label: LL('◀ Vzad', '◀ Reverse'), hint: LL('Spodné valce ťahajú plech späť.', 'The lower rolls pull the sheet back.'), action: needPower(() => push('drive', c.drive === -1 ? 0 : -1)) }, bBack);
    ctrl.reg({ type: 'button', label: LL('Vpred ▶', 'Forward ▶'), hint: LL('Spodné valce ťahajú plech vpred.', 'The lower rolls pull the sheet forward.'), action: needPower(() => push('drive', c.drive === 1 ? 0 : 1)) }, bFwd);
    ctrl.reg({ type: 'button', label: LL('STOP', 'STOP'), hint: LL('Zastaví valce.', 'Stops the rolls.'), action: () => push('drive', 0) }, bStop);
    ctrl.reg({ type: 'button', label: LL('Núdzový STOP', 'Emergency STOP'), hint: LL('Okamžite zastaví valce.', 'Stops the rolls at once.'), action: () => { push('drive', 0); say(L('Núdzové zastavenie.', 'Emergency stop.'), 'danger'); } }, eStop);
    ctrl.reg({ type: 'button', label: LL('Kolík odklopného ložiska', 'Drop-end pin'), hint: LL('Vytiahnutím sa ložisko horného valca odklopí, ďalším klikom sa plášť vysunie, potom sa ložisko zavrie.', 'Pulling it opens the top roll bearing, the next click slides the shell off, then the bearing closes.'), action: () => apiRef.current.toggleDrop() }, pinG);
    ctrl.reg({ type: 'wheel', minR: 0.4, inc: 1, label: LL('Koleso prísuvu horného valca', 'Top roll infeed handwheel'), hint: LL('V smere hodinových ručičiek ide horný valec nadol. 1 otáčka = 2 mm.', 'Clockwise moves the top roll down. 1 turn = 2 mm.'),
      turn: (d) => push('dT', clamp(Math.round((c.dT + d * 2 / TAU) * 10) / 10, 0, PLATE_DMAX)), read: () => `δ ${(st.d * 1000).toFixed(1)} mm` }, wD);
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf, rollA = 0;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      if (!c.power && c.drive) push('drive', 0);
      if (c.drive && (st.open > 0.01 || !st.pin)) { push('drive', 0); say(L('Odklopné ložisko nie je zaistené kolíkom – valce sa nespustia.', 'The drop-end bearing is not secured by the pin – the rolls will not start.'), 'danger'); }
      if (c.drive && prof.h > PLATE_TMAX) { push('drive', 0); say(L(`Plech ${prof.h} mm je nad kapacitu stroja (${PLATE_TMAX} mm) – motor sa preťaží.`, `The ${prof.h} mm sheet exceeds the machine capacity (${PLATE_TMAX} mm) – the motor overloads.`), 'danger'); }
      const dPrev = st.d;
      st.d = approach(st.d, clamp(c.dT, 0, PLATE_DMAX) / 1000, 0.008 * dt);
      const sPrev = st.s;
      if (c.drive && c.power && !st.done) st.s += c.drive * c.v / 60 * dt;
      if (st.s >= sheet.L - 0.002 || st.s <= 0.002) {
        st.s = clamp(st.s, 0.002, sheet.L - 0.002);
        if (c.drive) { push('drive', 0); say(st.s > 0.5 ? L('Plech prešiel valcami – zmeraj polomer, prípadne prisuň a prejdi späť.', 'The sheet has passed the rolls – measure the radius, feed more and pass back if needed.') : L('Plech vyšiel spredu.', 'The sheet came out at the front.'), 'info'); }
      }
      const kL = kPyr(st.d), span = st.s >= PLATE_A && sheet.L - st.s >= PLATE_A, bending = span && kL > kYield(prof);
      if (!st.done) { const n = passPyramid(sheet, prof, sPrev, st.s, st.d, { backing: c.backing }); if (n || st.s !== sPrev || st.d !== dPrev) st.dirty = true; }
      st.F = span ? rollForce(kL, prof, PLATE_A) : 0;
      if (bending && c.drive) st.bendT = t;
      sayOnce('elastic', c.drive !== 0 && st.d > 0 && kL <= kYield(prof), L('Horný valec je prisunutý tak málo, že sa plech ohne len pružne.', 'The top roll is fed so little that the sheet bends only elastically.'), 'info');
      if (st.dirty) { rebuild(); st.dirty = false; }
      // odklopné ložisko a vysunutie plášťa
      st.open = approach(st.open, st.pin ? 0 : 1, 0.7 * dt);
      dropG.rotation.x = st.open * 1.45;
      if (st.done && st.out < 1) { st.out = Math.min(1, st.out + dt * 0.25); shG.position.z = st.out * (HW * 2 + 8); if (st.out >= 1) { shG.visible = false; say(L('Plášť je vysunutý a odložený – zmeraj ho v paneli. Zatvor ložisko kolíkom.', 'The shell is off and set aside – measure it in the panel. Close the bearing with the pin.'), 'info'); } }
      pinG.position.x = 3.0 + (st.pin ? 0 : 1.1);
      shG.position.y = st.done ? st.open * 0.55 : 0;
      // valce
      rollA += (c.drive && c.power ? c.drive * c.v / 60 * dt * 10 : 0);
      const T = prof.h / 200;
      const lift = st.done ? st.open * 0.55 : 0;
      topR.position.set(0, Y0 + RT + T - st.d * 10 + lift, 0); topR.rotation.z = rollA / RT;
      lowA.rotation.z = -rollA / RB; lowB.rotation.z = -rollA / RB;
      bL.position.y = Y0 + RT + T - st.d * 10 + lift; bR.position.y = Y0 + RT + T - st.d * 10 + lift;
      wD.rotation.z = -st.d * 1000 / 2 * TAU;
      lampRun.emissive.setHex(c.drive ? 0x22dd55 : 0);
      ctrl.update(dt); insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        const kf = kFinal(kL, prof);
        setTele({ d: st.d * 1000, s: st.s * 1000, RL: kL > 0 ? 1000 / kL : 0, Rf: kf > 0 ? 1000 / kf : 0, F: st.F / 1000, bending: t - st.bendT < 0.3, open: !st.pin, out: st.done, msg: st.msg && st.msg.until > t ? st.msg : null });
        if (Object.keys(pend).length) { const q = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]); setUi((u) => ({ ...u, ...q })); }
      }
      snd.update({ motor: c.drive ? 0.55 : 0, cut: t - st.bendT < 0.3 ? 0.5 : 0 });
      renderer.render(scene, camera);
    };
    try { if (/[?&]debug/.test(window.location.search)) window.__plate = { st, c, sheet: () => sheet }; } catch (err) { /* ignorované */ }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); insp.dispose(); try { if (window.__plate && window.__plate.st === st) delete window.__plate; } catch (err) { /* ignorované */ } disposeStage(); };
  }, []);

  const parts = plateParts();
  const m = apiRef.current.measure ? apiRef.current.measure() : null, info = m ? m.info : null;
  const fmt = (x, d = 0) => L(x.toFixed(d).replace('.', ','), x.toFixed(d));
  const statusMsg = tele.msg ? tele.msg
    : !ui.power ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
    : tele.bending ? { kind: 'run', text: `${L('Zakružovanie', 'Rolling')} – δ ${fmt(tele.d, 1)} mm, R ${L('v zábere', 'under load')} ${fmt(tele.RL)} mm, F ${fmt(tele.F, 0)} kN` }
    : ui.drive ? { kind: 'run', text: L('Valce sa otáčajú.', 'The rolls are turning.') }
    : { kind: 'idle', text: L('Prisuň horný valec, spusti chod vpred a plech prevaľuj tam a späť.', 'Feed the top roll, run forward and roll the sheet back and forth.') };
  const chips = [{ color: ui.drive ? '#3ee06c' : '#8b8f89', text: ui.drive ? `${ui.drive > 0 ? L('Vpred', 'Forward') : L('Vzad', 'Reverse')} ${ui.v} m/min` : L('Stojí', 'Stopped') }];
  if (tele.open) chips.push({ color: '#ff8a1f', text: L('Ložisko odklopené', 'Bearing open') });
  const setupTask = (task) => { if (ui.drive) return; Object.entries(task.setup).forEach(([k, v]) => set(k, v)); setTimeout(() => { if (apiRef.current.newBlank) apiRef.current.newBlank(); }, 300); };

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} canUnclamp={false}
        tips={[L('Na trojvalcovej pyramíde zostane na oboch koncoch rovný úsek ≈ polovica rozostupu spodných valcov (180 mm) – konce sa predohýbajú s podložným plechom.', 'On a three-roll pyramid a flat length ≈ half the lower-roll spacing (180 mm) stays at both ends – the ends are pre-bent with a backing plate.'),
          L('Odpruženie: prisuň horný valec viac, ako zodpovedá žiadanému polomeru; menší prísuv pri ďalšom prechode už plech nezmení.', 'Springback: feed the top roll more than the wanted radius suggests; a smaller infeed on a later pass no longer changes the sheet.'),
          L('Hotový plášť obopína horný valec – vyberie sa po vytiahnutí kolíka a odklopení ložiska na pravom konci.', 'A finished shell surrounds the top roll – it is removed after pulling the pin and opening the bearing at the right end.')]} />
      <aside className="panel">
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · zakružovačka', 'Simulator · plate rolls')} title={L('Zakružovačka plechu', 'Plate bending rolls')}
          sub={L('Predloha: TOS XZC 3000/10 – trojvalcová pyramída, pracovná dĺžka 3 000 mm, plech do 10 mm; dva spodné poháňané valce, prisúvaný horný valec a odklopné ložisko. Rozmery valcov sú orientačné.', 'Modelled after the TOS XZC 3000/10 – three-roll pyramid, 3,000 mm working length, sheet up to 10 mm; two driven lower rolls, an adjustable top roll and a drop-end bearing. Roll sizes are approximate.')}
          rows={[['δ mm', tele.d.toFixed(1)], [L('Plech mm', 'Sheet mm'), tele.s.toFixed(0)], [L('Sila kN', 'Force kN'), tele.F.toFixed(0)]]}
          foot={[`${ui.t} × ${ui.b} × ${ui.len} mm`, `${ui.v} m/min`]} status={statusMsg} />

        <TaskSection machine="zakruzovacka" tasks={PLATE_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'drive', items: PLATE_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Chod valcov', 'Roll drive')}</h2>
          <DirRun value={ui.drive} onChange={(d) => { if (d && !ui.power) set('power', true); set('drive', d); }} />
          <div className="mt-2" />
          <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
          <SegRow label={L('Rýchlosť m/min', 'Speed m/min')} value={ui.v} options={[[2, '2'], [4, '4'], [6, '6']]} onChange={(v) => set('v', v)} />
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Horný valec', 'Top roll')}</h2>
          <Slider id="pd" label={L('Prísuv horného valca δ', 'Top roll infeed δ')} unit="mm" min={0} max={PLATE_DMAX} step={0.1} value={ui.dT} actual={tele.d} digits={1} onChange={(v) => set('dT', v)} />
          <div className="flex flex-wrap gap-2 mb-2">{[-5, -1, -0.2, 0.2, 1, 5].map((x) => <button key={x} type="button" className="btn" onClick={() => set('dT', clamp(Math.round((ui.dT + x) * 10) / 10, 0, PLATE_DMAX))}>{x > 0 ? '+' : ''}{fmt(x, x % 1 ? 1 : 0)}</button>)}</div>
          <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
            <div>{L('Polomer v zábere', 'Radius under load')}: <b>{tele.RL ? `R ${fmt(tele.RL)} mm` : '–'}</b></div>
            <div>{L('Po odpružení (odhad)', 'After springback (estimate)')}: <b>{tele.Rf ? `R ${fmt(tele.Rf)} mm` : L('rovný – len pružne', 'flat – elastic only')}</b></div>
          </div>
          <Toggle on={ui.backing} label={L('Podložný plech na predohnutie koncov', 'Backing plate to pre-bend the ends')} onClick={() => set('backing', !ui.backing)} />
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="btn" onClick={() => apiRef.current.toggleDrop && apiRef.current.toggleDrop()}>{tele.open ? (tele.out ? L('Zatvoriť ložisko', 'Close the bearing') : L('Vysunúť plášť', 'Slide the shell off')) : L('Vytiahnuť kolík – odklopiť ložisko', 'Pull the pin – open the bearing')}</button>
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Meranie', 'Measurement')}</h2>
          {info && info.bent > 0 ? (
            <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
              <div>{L('Polomer', 'Radius')}: <b>R {fmt(info.R)} mm</b> (± {fmt(info.spread)} mm)</div>
              <div>{L('Uhol', 'Angle')}: <b>{fmt(info.angle)}°</b>, {L('ohnutá dĺžka', 'bent length')} <b>{fmt(info.bent)} mm</b></div>
              <div>{L('Rovné konce', 'Flat ends')}: <b>{fmt(info.ends[0])} / {fmt(info.ends[1])} mm</b></div>
            </div>
          ) : <p className="text-xs muted">{L('Plech je zatiaľ rovný.', 'The sheet is still flat.')}</p>}
        </div>

        <BlankSection onApply={() => apiRef.current.newBlank && apiRef.current.newBlank()} applyLabel={L('Vložiť nový plech', 'Insert a new sheet')} note={L('Oceľ S235, plech do 10 × 3 000 mm.', 'S235 steel, sheet up to 10 × 3,000 mm.')}>
          <SegRow label={L('Hrúbka mm', 'Thickness mm')} value={ui.t} options={[3, 4, 6, 8, 10, 12].map((x) => [x, String(x)])} onChange={(v) => set('t', v)} />
          <Slider id="pb" label={L('Šírka (pozdĺž valcov)', 'Width (along the rolls)')} unit="mm" min={300} max={PLATE_LMAX} step={50} value={ui.b} onChange={(v) => set('b', v)} />
          <Slider id="pl" label={L('Dĺžka', 'Length')} unit="mm" min={500} max={4000} step={10} value={ui.len} onChange={(v) => set('len', v)} />
        </BlankSection>

        <ExportSection machine="zakruzovacka" apiRef={apiRef} canStl={false} />
        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['koniec', L('Odklopné ložisko', 'Drop-end')], ['bok', L('Zboku', 'Side')], ['valce', L('Valce', 'Rolls')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

export { PlateRollSimulator };
export default PlateRollSimulator;
