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
import { kFinal, kYield } from './benderMath';
import { PLATE_A, bendInfo, createSheet, kPinch, passPinch, plateChecks, plateProfile, reverseSheet } from './plateMath';
import { BlankSection, DirRun, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// ZAKRUŽOVAČKA PLECHU – tri valce so zovretím (horný a spodný ťahajú, zadný ohýba)
// =====================================================================
// mierka 1 = 100 mm. Valce majú osi v smere Z, plech ide v +X (od obsluhy), zovretie v x = 0 vo výške Y0.
// Zadný valec v x = A sa zdvíha o h – plech sa za zovretím ohýba nahor okolo horného valca.
const Y0 = 9.0, A = PLATE_A * 10, RT = 0.75, RR = 0.6, RLEN = 11.6;
const plateParts = () => mkParts([
  ['ramy', 'Stojany', 'Frames', 'Stojany s ložiskami', 'Side frames', 'Dva liatinové stojany nesú ložiská troch valcov. Ložisko horného valca na pravej strane sa dá odklopiť a hotový plášť sa vysunie cez koniec valca.', 'Two cast frames carry the bearings of the three rolls. The right bearing of the top roll can be swung open so that a finished shell slides off the end of the roll.'],
  ['valce', 'Valce', 'Rolls', 'Horný a spodný valec', 'Top and bottom rolls', 'Poháňané valce zovrú plech a ťahajú ho. Spodný valec sa prisúva k hornému podľa hrúbky plechu – bez zovretia sa plech nepohne.', 'The driven rolls pinch the sheet and pull it through. The bottom roll is raised to the top one according to the sheet thickness – without the pinch the sheet does not move.'],
  ['zadny', 'Zadný valec', 'Rear roll', 'Zadný (ohýbací) valec', 'Rear (bending) roll', 'Zdvíha sa ručným kolesom. Čím vyššie, tým menší polomer. Plech odpruží, preto treba valec zdvihnúť viac, ako zodpovedá žiadanému polomeru.', 'Raised by the handwheel. The higher it is, the smaller the radius. The sheet springs back, so the roll must be raised more than the wanted radius would suggest.'],
  ['pohon', 'Pohon', 'Drive', 'Motor s prevodovkou', 'Motor with gearbox', 'Motor poháňa horný a spodný valec cez prevodovku, chod vpred a vzad.', 'The motor drives the top and bottom rolls through the gearbox, forward and reverse.'],
  ['ovladanie', 'Ovládanie', 'Controls', 'Ovládací pult', 'Control stand', 'Hlavný vypínač, chod vpred a vzad, stop a núdzový STOP.', 'Main switch, forward and reverse, stop and the emergency stop.'],
  ['plech', 'Plech', 'Sheet', 'Plech', 'Sheet', 'Oceľový plech S235. Pri jednom prechode zostane začiatok rovný v dĺžke po zadný valec – predohne sa po otočení plechu.', 'S235 steel sheet. In one pass the leading edge stays flat up to the rear roll – it is pre-bent after turning the sheet round.'],
]);
const RingSketch = ({ label, note, ring }) => (
  <svg viewBox="0 0 300 110" width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
    {ring ? <circle cx="150" cy="56" r="40" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.6" /> : <path d="M40 90A150 150 0 0 1 260 90" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.6" />}
    <text x="10" y="18" fontSize="10" fill="currentColor" fontFamily="var(--f-mono)">{label}</text>
    <text x="10" y="32" fontSize="10" fill="currentColor" fontFamily="var(--f-mono)">{note}</text>
  </svg>
);
const PLATE_TASKS = [
  { id: 'plast', title: () => L('Plášť Ø500 z plechu 3 mm', 'Shell Ø500 from 3 mm sheet'),
    desc: () => L('Plech 3 × 1000 × 1570 mm (obvod Ø500). Zakruž plášť R 250 ±4 mm s uhlom aspoň 345° a rovnými koncami najviac 25 mm. Pri prvom prechode zostane začiatok rovný v dĺžke po zadný valec – po prechode plech otoč (začiatok sa stane koncom) a prejdi znova s rovnakým zdvihom. Plech odpruží, zadný valec zdvíhaj po krokoch.', 'Sheet 3 × 1000 × 1570 mm (circumference of Ø500). Roll a shell R 250 ±4 mm of at least 345° with flat ends of at most 25 mm. In the first pass the leading edge stays flat up to the rear roll – after the pass turn the sheet round (the start becomes the end) and pass again with the same setting. The sheet springs back, raise the rear roll in steps.'),
    setup: { t: 3, b: 1000, len: 1570 },
    drawing: () => <RingSketch ring label={L('Ø500, R 250 ±4', 'Ø500, R 250 ±4')} note={L('plech 3 × 1000 × 1570', 'sheet 3 × 1000 × 1570')} />,
    labels: { radius: () => L('Polomer R 250 ±4 mm', 'Radius R 250 ±4 mm'), even: () => L('Rovnomerný polomer (±4 mm)', 'Even radius (±4 mm)'), angle: () => L('Uhol aspoň 345°', 'Angle at least 345°'), ends: () => L('Rovné konce ≤ 25 mm (predohnuté)', 'Flat ends ≤ 25 mm (pre-bent)') } },
  { id: 'oblukP', title: () => L('Oblúk R 400 z plechu 4 mm', 'Arc R 400 from 4 mm sheet'),
    desc: () => L('Plech 4 × 600 × 1000 mm. Ohni oblúk R 400 ±6 mm na dĺžke aspoň 800 mm. Hrubší plech odpruží menej ako tenký – nastavenie z plášťa sa neprenesie.', 'Sheet 4 × 600 × 1000 mm. Roll an arc R 400 ±6 mm over at least 800 mm. A thicker sheet springs back less than a thin one – the setting from the shell does not carry over.'),
    setup: { t: 4, b: 600, len: 1000 },
    drawing: () => <RingSketch label={L('R 400 ±6', 'R 400 ±6')} note={L('plech 4 × 600 × 1000', 'sheet 4 × 600 × 1000')} />,
    labels: { radius: () => L('Polomer R 400 ±6 mm', 'Radius R 400 ±6 mm'), even: () => L('Rovnomerný polomer (±6 mm)', 'Even radius (±6 mm)'), bent: () => L('Ohnutá dĺžka ≥ 800 mm', 'Bent length ≥ 800 mm') } },
].map((t) => ({ ...t, checks: (m) => plateChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const PLATE_SAFETY = () => [
  L('Ruky držím ďaleko od zovretia valcov – plech sa vťahuje.', 'I keep my hands well away from the roll pinch – the sheet is drawn in.'),
  L('Plech podopieram zboku, nie pred valcami; dlhý plech podopiera pomocník.', 'I support the sheet from the side, not in front of the rolls; a long sheet is supported by a helper.'),
  L('Chod ovládam z pultu a viem, kde je núdzový STOP.', 'I run the machine from the stand and know where the emergency stop is.'),
];

function PlateRollSimulator({ onBack, params }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { power: true, drive: 0, manual: false, v: 4, pinch: false, hT: 0, t: 3, b: 1000, len: 1570 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ h: 0, s: 0, RL: 0, Rf: 0, msg: null, bending: false });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('bender');
    const dom = renderer.domElement;
    const M = { ...baseMats(0x8a6f5a, 0x735a47, 0x553f30), roll: std(0x9aa1a6, 0.3, 0.85), sheet: new THREE.MeshStandardMaterial({ color: 0x9ea4a9, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide, flatShading: true }) };
    const kit = makeKit(M);
    const { box, cylY, cylZ, ball, hitProxy, handwheel } = kit;
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- stojany, rám ----------
    const fr = grp('ramy');
    [-1, 1].forEach((s) => { box(fr, -1.8, 3.2, 0, Y0 + 2.4, s * (RLEN / 2) - (s > 0 ? 0 : 0.8), s * (RLEN / 2) + (s > 0 ? 0.8 : 0), M.green); });
    box(fr, -1.6, 3.0, 0, 1.2, -RLEN / 2, RLEN / 2, M.greenDark);
    // ---------- valce ----------
    const rolls = grp('valce'), rear = grp('zadny');
    const mkRoll = (parent, r) => { const g = new THREE.Group(); parent.add(g); cylZ(g, r, r, -RLEN / 2, RLEN / 2, 0, 0, M.roll, 40); cylZ(g, 0.22, 0.22, -RLEN / 2 - 0.9, RLEN / 2 + 0.9, 0, 0, M.steelDark, 16); box(g, -0.03, 0.03, r - 0.02, r + 0.01, -RLEN / 2, RLEN / 2, M.black); return g; };
    const topR = mkRoll(rolls, RT), botR = mkRoll(rolls, RT), rearR = mkRoll(rear, RR);
    // ---------- pohon a ovládanie ----------
    const drv = grp('pohon');
    box(drv, -1.2, 1.6, 3.0, 6.0, RLEN / 2 + 0.8, RLEN / 2 + 2.6, M.greenDark);
    cylZ(drv, 0.7, 0.7, RLEN / 2 + 2.6, RLEN / 2 + 4.2, 0.2, 4.4, M.green, 28);
    const hwG = new THREE.Group(); hwG.position.set(A, Y0 + 2.4, -RLEN / 2 - 0.4); fr.add(hwG);
    cylY(fr, 0.08, 0.08, Y0 - 1.0, Y0 + 2.4, A, -RLEN / 2 - 0.4, M.steel, 10);
    const wH = handwheel(hwG, 0.55, 0, 0.1, 0, 'y', 0.35);                          // koleso zdvihu zadného valca
    const pan = grp('ovladanie');
    box(pan, -5.2, -4.6, 0, 10.0, -RLEN / 2 - 1.4, -RLEN / 2 - 0.8, M.steelDark);
    box(pan, -5.4, -4.4, 10.0, 12.2, -RLEN / 2 - 1.6, -RLEN / 2 - 0.6, M.panel);
    const pbtn = (y, z, m) => { const g = new THREE.Group(); g.position.set(-4.4, y, z); g.rotation.y = Math.PI / 2; pan.add(g); cylZ(g, 0.13, 0.13, 0, 0.07, 0, 0, m, 20); hitProxy(g, 0.18, 0, 0, 0.05); return g; };
    const zc = -RLEN / 2 - 1.1;
    const bBack = pbtn(11.2, zc - 0.3, M.btnGreen), bStop = pbtn(11.2, zc, M.black), bFwd = pbtn(11.2, zc + 0.3, M.btnGreen), bPinch = pbtn(10.6, zc - 0.3, M.blue);
    const eStop = new THREE.Group(); eStop.position.set(-4.4, 10.5, zc + 0.3); eStop.rotation.y = Math.PI / 2; pan.add(eStop);
    cylZ(eStop, 0.08, 0.08, 0, 0.07, 0, 0, M.steelDark, 16); cylZ(eStop, 0.18, 0.17, 0.07, 0.15, 0, 0, M.red, 24); hitProxy(eStop, 0.24, 0, 0, 0.1);
    const lampRun = std(0x1f5f33, 0.4, 0.1); ball(pan, 0.07, -4.38, 11.85, zc, lampRun);
    // ---------- plech ----------
    const shG = grp('plech');
    let sheet = null, prof = plateProfile(c.t, c.b), mesh = null;
    const st = { s: 0.03, h: 0, pinch: 0, dirty: true, msg: null, bendT: -9 };
    const makeSheet = () => {
      prof = plateProfile(c.t, c.b); sheet = createSheet(clamp(c.len, 400, 2500) / 1000);
      if (mesh) { shG.remove(mesh); mesh.geometry.dispose(); }
      const N = sheet.N, geo = new THREE.BufferGeometry(), idx = [];
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 4 * 3), 3));
      for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b2 = i * 4 + (k + 1) % 4; idx.push(a, b2, a + 4, b2, b2 + 4, a + 4); }
      idx.push(0, 1, 2, 0, 2, 3, N * 4, N * 4 + 2, N * 4 + 1, N * 4, N * 4 + 3, N * 4 + 2);
      geo.setIndex(idx); mesh = new THREE.Mesh(geo, M.sheet); mesh.castShadow = true; mesh.userData.part = 'plech'; shG.add(mesh);
      st.s = 0.03; st.dirty = true;
    };
    const th = new Float64Array(5001), px = new Float64Array(5001), py = new Float64Array(5001);
    const rebuild = () => {
      const N = sheet.N, ds = sheet.ds, kL = kPinch(st.h), reach = st.s >= PLATE_A;
      const kv = (i) => { const u = (i + 0.5) * ds, ah = st.s - u; return reach && ah > 0 && ah < PLATE_A ? Math.max(sheet.kf[i], kL) : sheet.kf[i]; };
      th[N] = 0; px[N] = 0; py[N] = 0;
      for (let i = N - 1; i >= 0; i--) { const k = kv(i), tm = th[i + 1] + k * ds / 2; th[i] = th[i + 1] + k * ds; px[i] = px[i + 1] + ds * Math.cos(tm); py[i] = py[i + 1] + ds * Math.sin(tm); }
      const i0 = clamp(Math.floor(st.s / ds), 0, N - 1), e = clamp((i0 + 1) * ds - st.s, 0, ds), k0 = kv(i0);
      const ts = th[i0 + 1] + k0 * e, tm = th[i0 + 1] + k0 * e / 2, sx = px[i0 + 1] + e * Math.cos(tm), sy = py[i0 + 1] + e * Math.sin(tm);
      const cs = Math.cos(-ts), sn = Math.sin(-ts), T = prof.h / 200, B = prof.b / 200, pos = mesh.geometry.attributes.position.array;
      let o = 0;
      for (let i = 0; i <= N; i++) {
        const qx = ((px[i] - sx) * cs - (py[i] - sy) * sn) * 10, qy = ((px[i] - sx) * sn + (py[i] - sy) * cs) * 10, a = th[i] - ts, nx = -Math.sin(a), ny = Math.cos(a);
        for (const [nn, zz] of [[-T, -B], [T, -B], [T, B], [-T, B]]) { pos[o] = qx + nn * nx; pos[o + 1] = Y0 + qy + nn * ny; pos[o + 2] = zz; o += 3; }
      }
      mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    };
    makeSheet();

    // ---------- pohľady ----------
    const anchors = {
      ramy: () => v3(3.2, Y0 + 2.5, RLEN / 2 + 0.4), valce: () => v3(-0.6, Y0 + 1.7, -RLEN / 2 + 1.5), zadny: () => v3(A + 0.7, Y0 - 0.7 + st.h * 10, RLEN / 2 - 1.5),
      pohon: () => v3(0.2, 5.3, RLEN / 2 + 3.6), ovladanie: () => v3(-4.9, 12.3, zc), plech: () => v3(-3, Y0 + 0.2, 0),
    };
    const views = {
      celok: () => [[-13, 15, 17], [0, Y0 - 1, 0]],
      bok: () => [[0.5, Y0 + 1, 22], [0.5, Y0 + 1, 0], true],
      valce: () => [[-4, Y0 + 3.5, 6], [0.5, Y0, 0], true],
      pult: () => [[-9, 11.5, -RLEN / 2 - 1], [-4.5, 11, zc], true],
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
      push('pinch', false); push('hT', 0); st.h = 0; makeSheet();
      say(L(`Vložený nový plech ${c.t} × ${c.b} × ${c.len} mm.`, `New sheet ${c.t} × ${c.b} × ${c.len} mm inserted.`), 'info'); return true;
    };
    apiRef.current.flip = () => {
      if (c.drive) { say(L('Najprv zastav valce.', 'Stop the rolls first.')); return; }
      if (c.pinch) { say(L('Najprv uvoľni zovretie (spodný valec dole).', 'Release the pinch first (bottom roll down).')); return; }
      reverseSheet(sheet); st.s = 0.03; st.dirty = true;
      say(L('Plech je otočený – predný a zadný koniec sa vymenili. Zovri ho a prejdi znova.', 'The sheet is turned round – the leading and trailing ends swapped. Pinch it and pass again.'), 'info');
    };

    // ---------- ovládanie ----------
    const needPower = (fn) => () => { if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.')); else fn(); };
    ctrl.reg({ type: 'button', label: LL('◀ Vzad', '◀ Reverse'), hint: LL('Valce ťahajú plech späť.', 'The rolls pull the sheet back.'), action: needPower(() => push('drive', c.drive === -1 ? 0 : -1)) }, bBack);
    ctrl.reg({ type: 'button', label: LL('Vpred ▶', 'Forward ▶'), hint: LL('Valce ťahajú plech vpred.', 'The rolls pull the sheet forward.'), action: needPower(() => push('drive', c.drive === 1 ? 0 : 1)) }, bFwd);
    ctrl.reg({ type: 'button', label: LL('STOP', 'STOP'), hint: LL('Zastaví valce.', 'Stops the rolls.'), action: () => push('drive', 0) }, bStop);
    ctrl.reg({ type: 'button', label: LL('Zovretie plechu', 'Sheet pinch'), hint: LL('Prisunie alebo odsunie spodný valec.', 'Raises or lowers the bottom roll.'), action: () => push('pinch', !c.pinch) }, bPinch);
    ctrl.reg({ type: 'button', label: LL('Núdzový STOP', 'Emergency STOP'), hint: LL('Okamžite zastaví valce.', 'Stops the rolls at once.'), action: () => { push('drive', 0); say(L('Núdzové zastavenie.', 'Emergency stop.'), 'danger'); } }, eStop);
    ctrl.reg({ type: 'wheel', minR: 0.3, inc: 1, label: LL('Koleso zdvihu zadného valca', 'Rear roll handwheel'), hint: LL('V smere hodinových ručičiek valec stúpa. 1 otáčka = 2 mm.', 'Clockwise raises the roll. 1 turn = 2 mm.'),
      turn: (d) => push('hT', clamp(Math.round((c.hT + d * 2 / TAU) * 10) / 10, 0, 150)), read: () => `h ${(st.h * 1000).toFixed(1)} mm` }, wH);
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf, rollA = 0;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      if (!c.power && c.drive) push('drive', 0);
      const hPrev = st.h;
      st.h = approach(st.h, clamp(c.hT, 0, 150) / 1000, 0.01 * dt);
      st.pinch = approach(st.pinch, c.pinch ? 1 : 0, 2 * dt);
      const sPrev = st.s;
      if (c.drive && c.power) {
        if (st.pinch < 0.99) sayOnce('nopinch', true, L('Plech nie je zovretý – valce sa prešmykujú. Zovri plech spodným valcom.', 'The sheet is not pinched – the rolls slip. Pinch the sheet with the bottom roll.'));
        else st.s += c.drive * c.v / 60 * dt;
      } else flags.nopinch = false;
      if (st.s >= sheet.L - 0.002 || st.s <= 0.002) {
        st.s = clamp(st.s, 0.002, sheet.L - 0.002);
        if (c.drive) { push('drive', 0); say(st.s > 0.3 ? L('Plech prešiel valcami – zmeraj polomer, pri plášti ho otoč a prejdi znova.', 'The sheet has passed the rolls – measure the radius; for a shell turn it round and pass again.') : L('Plech vyšiel spredu.', 'The sheet came out at the front.'), 'info'); }
      }
      const kL = kPinch(st.h), bending = st.pinch > 0.99 && st.s >= PLATE_A && kL > kYield(prof);
      if (st.pinch > 0.99) { const n = passPinch(sheet, prof, sPrev, st.s, st.h); if (n || st.s !== sPrev || st.h !== hPrev) st.dirty = true; }
      if (bending && c.drive) st.bendT = t;
      sayOnce('elastic', c.drive !== 0 && st.h > 0 && kL <= kYield(prof), L('Zadný valec je tak nízko, že sa plech ohne len pružne – za valcami zostane rovný.', 'The rear roll is so low that the sheet bends only elastically – it stays flat after the rolls.'), 'info');
      if (st.dirty) { rebuild(); st.dirty = false; }
      // valce
      rollA += (c.drive && c.power && st.pinch > 0.99 ? c.drive * c.v / 60 * dt * 10 / RT : 0);
      const T = prof.h / 200;
      topR.position.set(0, Y0 + RT + T, 0); topR.rotation.z = -rollA;
      botR.position.set(0, Y0 - RT - T - (1 - st.pinch) * 0.25, 0); botR.rotation.z = rollA;
      rearR.position.set(A, Y0 - RR - T + st.h * 10, 0);
      wH.rotation.z = -st.h * 1000 / 2 * TAU;
      lampRun.emissive.setHex(c.drive ? 0x22dd55 : 0);
      ctrl.update(dt); insp.update(t, c);
      if (t - teleT > 0.1) {
        teleT = t;
        const kf = kFinal(kL, prof);
        setTele({ h: st.h * 1000, s: st.s * 1000, RL: kL > 0 ? 1000 / kL : 0, Rf: kf > 0 ? 1000 / kf : 0, bending: t - st.bendT < 0.3, msg: st.msg && st.msg.until > t ? st.msg : null });
        if (Object.keys(pend).length) { const q = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]); setUi((u) => ({ ...u, ...q })); }
      }
      snd.update({ motor: c.drive ? 0.5 : 0, cut: t - st.bendT < 0.3 ? 0.5 : 0 });
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
    : tele.bending ? { kind: 'run', text: `${L('Zakružovanie', 'Rolling')} – ${L('zdvih', 'rise')} ${fmt(tele.h, 1)} mm, R ${L('v zábere', 'under load')} ${fmt(tele.RL)} mm` }
    : ui.drive ? { kind: 'run', text: L('Valce sa otáčajú.', 'The rolls are turning.') }
    : { kind: 'idle', text: L('Zovri plech, zdvihni zadný valec a spusti chod vpred.', 'Pinch the sheet, raise the rear roll and run forward.') };
  const chips = [{ color: ui.drive ? '#3ee06c' : '#8b8f89', text: ui.drive ? `${ui.drive > 0 ? L('Vpred', 'Forward') : L('Vzad', 'Reverse')} ${ui.v} m/min` : L('Stojí', 'Stopped') }];
  chips.push({ color: ui.pinch ? '#7fb6ff' : '#ff8a1f', text: ui.pinch ? L('Zovretý', 'Pinched') : L('Nezovretý', 'Not pinched') });
  const setupTask = (task) => { if (ui.drive) return; Object.entries(task.setup).forEach(([k, v]) => set(k, v)); setTimeout(() => { if (apiRef.current.newBlank) apiRef.current.newBlank(); }, 300); };

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} canUnclamp={false}
        tips={[L('Začiatok plechu zostane po prvom prechode rovný v dĺžke po zadný valec – plech otoč a prejdi znova, tak sa predohne.', 'The leading edge stays flat up to the rear roll after the first pass – turn the sheet round and pass again to pre-bend it.'),
          L('Odpruženie: zdvihni zadný valec viac, ako zodpovedá žiadanému polomeru; menší zdvih pri ďalšom prechode už plech nezmení.', 'Springback: raise the rear roll more than the wanted radius suggests; a smaller rise on a later pass no longer changes the sheet.')]} />
      <aside className="panel">
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · zakružovačka', 'Simulator · plate rolls')} title={L('Zakružovačka plechu', 'Plate bending rolls')}
          sub={L('Trojvalcová zakružovačka so zovretím: horný a spodný valec ťahajú plech, zadný valec ohýba. Plech do šírky 1 000 mm a hrúbky 6 mm.', 'Three-roll initial-pinch plate rolls: the top and bottom rolls pull the sheet, the rear roll bends it. Sheet up to 1,000 mm wide and 6 mm thick.')}
          rows={[[L('Zdvih mm', 'Rise mm'), tele.h.toFixed(1)], [L('Plech mm', 'Sheet mm'), tele.s.toFixed(0)]]}
          foot={[`${ui.t} × ${ui.b} × ${ui.len} mm`, `${ui.v} m/min`]} status={statusMsg} />

        <TaskSection machine="zakruzovacka" tasks={PLATE_TASKS} apiRef={apiRef} params={params} status={statusMsg} onSetup={setupTask}
          safety={{ ui, set, runKey: 'drive', items: PLATE_SAFETY() }} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Chod valcov', 'Roll drive')}</h2>
          <DirRun value={ui.drive} onChange={(d) => { if (d && !ui.power) set('power', true); set('drive', d); }} />
          <div className="mt-2" />
          <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
          <Toggle on={ui.pinch} label={L('Plech zovretý (spodný valec hore)', 'Sheet pinched (bottom roll up)')} onClick={() => set('pinch', !ui.pinch)} />
          <SegRow label={L('Rýchlosť m/min', 'Speed m/min')} value={ui.v} options={[[2, '2'], [4, '4'], [6, '6']]} onChange={(v) => set('v', v)} />
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Zadný valec', 'Rear roll')}</h2>
          <Slider id="ph" label={L('Zdvih zadného valca h', 'Rear roll rise h')} unit="mm" min={0} max={150} step={0.1} value={ui.hT} actual={tele.h} digits={1} onChange={(v) => set('hT', v)} />
          <div className="flex flex-wrap gap-2 mb-2">{[-5, -1, -0.2, 0.2, 1, 5].map((x) => <button key={x} type="button" className="btn" onClick={() => set('hT', clamp(Math.round((ui.hT + x) * 10) / 10, 0, 150))}>{x > 0 ? '+' : ''}{fmt(x, x % 1 ? 1 : 0)}</button>)}</div>
          <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
            <div>{L('Polomer v zábere', 'Radius under load')}: <b>{tele.RL ? `R ${fmt(tele.RL)} mm` : '–'}</b></div>
            <div>{L('Po odpružení (odhad)', 'After springback (estimate)')}: <b>{tele.Rf ? `R ${fmt(tele.Rf)} mm` : L('rovný – len pružne', 'flat – elastic only')}</b></div>
          </div>
          <button type="button" className="btn mt-2" onClick={() => apiRef.current.flip && apiRef.current.flip()}>{L('↻ Otočiť plech (predohnutie začiatku)', '↻ Turn the sheet round (pre-bend the start)')}</button>
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

        <BlankSection onApply={() => apiRef.current.newBlank && apiRef.current.newBlank()} applyLabel={L('Vložiť nový plech', 'Insert a new sheet')} note={L('Oceľ S235, plech sa vloží predným koncom do zovretia.', 'S235 steel, the sheet is inserted with its leading edge into the pinch.')}>
          <SegRow label={L('Hrúbka mm', 'Thickness mm')} value={ui.t} options={[2, 3, 4, 5, 6].map((x) => [x, String(x)])} onChange={(v) => set('t', v)} />
          <Slider id="pb" label={L('Šírka', 'Width')} unit="mm" min={200} max={1000} step={50} value={ui.b} onChange={(v) => set('b', v)} />
          <Slider id="pl" label={L('Dĺžka', 'Length')} unit="mm" min={400} max={2500} step={10} value={ui.len} onChange={(v) => set('len', v)} />
        </BlankSection>

        <ExportSection machine="zakruzovacka" apiRef={apiRef} canStl={false} />
        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['bok', L('Zboku', 'Side')], ['valce', L('Valce', 'Rolls')], ['pult', L('Pult', 'Stand')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

export { PlateRollSimulator };
export default PlateRollSimulator;
