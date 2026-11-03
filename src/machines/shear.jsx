import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { baseMats, makeKit, std } from '../core/kit';
import { createStage } from '../core/stage';
import { approach, clamp } from '../core/util';
import { createSound } from '../core/sound';
import { ExportSection, TaskSection } from '../ui/tools';
import { SHEAR, cutStrip, gapIdeal, shearChecks } from './shearMath';
import { BlankSection, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// TABUĽOVÉ NOŽNICE (mechanické, s nožným pedálom)
// =====================================================================
// mierka 1 = 100 mm. Strihová čiara je v x = 0 (spodný nôž), obsluha stojí v −X, zadný doraz je za nožom v +X.
// Plech leží na stole vo výške YT; jeho zadná hrana je o p za strihovou čiarou – pri strihu sa odstrihne pás šírky p.
const YT = 8.5, LEN = 22, HW = LEN / 2;
const shearParts = () => mkParts([
  ['ramy', 'Stojany', 'Frames', 'Stojany a stôl', 'Frames and table', 'Zvárané stojany nesú stôl so spodným nožom a vedenia nožového trámu. Vpredu sú podperné ramená s mierkou.', 'Welded frames carry the table with the lower blade and the guides of the blade beam. Front support arms with a scale are at the front.'],
  ['tram', 'Nožový trám', 'Blade beam', 'Nožový trám so šikmým nožom', 'Blade beam with raked blade', 'Horný nôž je uložený šikmo (uhol strihu) – plech sa strihá postupne od jedného konca, preto stačí menšia sila. Trám poháňa výstredník cez jednootáčkovú spojku.', 'The upper blade is raked – the sheet is cut progressively from one end, so less force is needed. The beam is driven by an eccentric through a single-revolution clutch.'],
  ['pritlaky', 'Prítlaky', 'Hold-downs', 'Prítlaky plechu', 'Sheet hold-downs', 'Pred nožom zovrú plech k stolu, aby sa pri strihu nepreklopil. Prsty pod prítlakmi = úraz – preto je pred nimi kryt prstov.', 'In front of the blade they clamp the sheet to the table so that it does not tip during the cut. Fingers under the hold-downs = injury – hence the finger guard in front of them.'],
  ['kryt', 'Kryt prstov', 'Finger guard', 'Ochranný kryt prstov', 'Finger guard', 'Sklopná mreža pred prítlakmi a nožom. Pri zdvihnutom kryte pedál nespustí strih.', 'A hinged grid in front of the hold-downs and the blade. With the guard raised the pedal does not start a cut.'],
  ['doraz', 'Zadný doraz', 'Back gauge', 'Zadný doraz', 'Back gauge', 'Lišta za nožom nastavená na šírku pásu. Plech sa zasúva, kým sa jej nedotkne.', 'A bar behind the blade set to the strip width. The sheet is pushed in until it touches it.'],
  ['uholnik', 'Uholník', 'Side square', 'Bočný uholník', 'Side square', 'Pravítko kolmé na nôž vľavo na stole. Plech priložený k uholníku sa odstrihne pravouhlo.', 'A rule square to the blade on the left of the table. A sheet laid against it is cut square.'],
  ['pedal', 'Pedál', 'Pedal', 'Nožný pedál', 'Foot pedal', 'Stlačenie spustí jeden strih (jedna otáčka výstredníka).', 'Pressing it triggers one cut (one revolution of the eccentric).'],
  ['plech', 'Plech', 'Sheet', 'Plech', 'Sheet', 'Oceľový plech S235 na stole. Odstrihnuté pásy padajú za nožom do zberného koša.', 'S235 steel sheet on the table. The cut strips fall behind the blade into the bin.'],
]);
const StripSketch = ({ w, n, t }) => (
  <svg viewBox="0 0 300 100" width="100%" role="img" aria-label={`${n} × ${w}`} style={{ display: 'block' }}>
    {Array.from({ length: n }, (_, k) => <rect key={k} x={30 + k * 85} y="20" width="70" height="60" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.4" />)}
    <text x="30" y="95" fontSize="10" fill="currentColor" fontFamily="var(--f-mono)">{`${n} × ${w} ±0,3 · t ${t}`}</text>
  </svg>
);
const SHEAR_TASKS = [
  { id: 'pasy', title: () => L('Tri pásy 100 × 1000 z plechu 2 mm', 'Three 100 × 1000 strips from 2 mm sheet'),
    desc: () => L('Plech 2 × 1000 × 500 mm. Nastrihaj tri pásy šírky 100 ±0,3 mm. Nastav zadný doraz na 100 mm a vôľu nožov podľa hrúbky (≈ 7 % = 0,14 mm), plech prilož k bočnému uholníku a zasuň po doraz. Kryt prstov musí byť dole, strih spustíš pedálom.', 'Sheet 2 × 1000 × 500 mm. Cut three strips 100 ±0.3 mm wide. Set the back gauge to 100 mm and the blade clearance to the thickness (≈ 7 % = 0.14 mm), lay the sheet against the side square and push it to the gauge. The finger guard must be down; the pedal triggers the cut.'),
    setup: { t: 2, L: 1000, D: 500, gauge: 300, gap: 0.3 },
    drawing: () => <StripSketch w={100} n={3} t={2} />,
    labels: { count: () => L('Tri pásy 100 ±0,3 mm', 'Three strips 100 ±0.3 mm'), square: () => L('Pravouhlé (klin ≤ 0,3 mm)', 'Square (taper ≤ 0.3 mm)'), burr: () => L('Bez ostriny (správna vôľa nožov)', 'No burr (correct blade clearance)') } },
  { id: 'hrube', title: () => L('Prírezy 150 mm z plechu 3 mm', '150 mm blanks from 3 mm sheet'),
    desc: () => L('Plech 3 × 1000 × 500 mm – na hranici kapacity nožníc. Nastrihaj dva pásy 150 ±0,3 mm bez ostriny. Hrubší plech potrebuje väčšiu vôľu nožov (≈ 0,21 mm).', 'Sheet 3 × 1000 × 500 mm – at the capacity limit of the shear. Cut two strips 150 ±0.3 mm without burr. A thicker sheet needs a larger blade clearance (≈ 0.21 mm).'),
    setup: { t: 3, L: 1000, D: 500, gauge: 300, gap: 0.14 },
    drawing: () => <StripSketch w={150} n={2} t={3} />,
    labels: { size: () => L('Dva pásy 150 ±0,3 mm (3 mm)', 'Two strips 150 ±0.3 mm (3 mm)'), burr: () => L('Bez ostriny', 'No burr') } },
].map((t) => ({ ...t, checks: (m) => shearChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));
const SHEAR_SAFETY = () => [
  L('Kryt prstov je sklopený, ruky nedávam pod prítlaky ani za kryt.', 'The finger guard is down, I do not put my hands under the hold-downs or behind the guard.'),
  L('Za nožnicami nikto nestojí – odstrihnuté pásy padajú dozadu.', 'Nobody stands behind the shear – the cut strips fall to the back.'),
  L('Plech nie je hrubší ako 3 mm (S235), mám rukavice proti porezaniu.', 'The sheet is not thicker than 3 mm (S235), I wear cut-resistant gloves.'),
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
    const M = { ...baseMats(0x5f86a8, 0x4e7392, 0x395569), sheet: std(0xa2a8ad, 0.4, 0.75), blade: std(0xd7dbde, 0.2, 0.9), grid: std(0xffc21a, 0.6, 0.2) };
    const kit = makeKit(M);
    const { box, cylY, cylZ, hitProxy } = kit;
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- stojany a stôl ----------
    const fr = grp('ramy');
    [-1, 1].forEach((s) => { box(fr, -2.0, 3.2, 0, 12.5, s * HW, s * HW + s * 0.9, M.green); });
    box(fr, -2.2, 0.0, YT - 1.6, YT, -HW, HW, M.green);                               // stôl pred nožom
    box(fr, -0.15, 0.0, YT - 0.6, YT + 0.001, -HW, HW, M.blade);                       // spodný nôž
    box(fr, 0.0, 3.0, YT - 2.6, YT - 2.2, -HW, HW, M.greenDark);                       // spodná priečka
    box(fr, -2.0, 3.2, 0, 0.4, -HW - 0.9, HW + 0.9, M.greenDeep);
    [-7, 7].forEach((z) => { box(fr, -7.5, -2.2, YT - 0.12, YT, z - 0.3, z + 0.3, M.greenDark); for (let k = 1; k < 25; k++) box(fr, -2.2 - k * 0.2, -2.18 - k * 0.2, YT, YT + 0.005, z - 0.15, z - 0.05, M.white); });   // podperné ramená s mierkou
    box(fr, 2.5, 5.5, 0, 1.6, -HW, HW, M.greenDark);                                  // zberný kôš
    // bočný uholník
    const sq = grp('uholnik');
    box(sq, -7.5, -0.05, YT, YT + 0.25, -HW + 0.4, -HW + 0.55, M.steelDark);
    // ---------- nožový trám, prítlaky, kryt ----------
    const beam = grp('tram');
    box(beam, -0.4, 0.45, YT + 0.7, YT + 2.6, -HW, HW, M.green);
    const upper = box(beam, -0.05, 0.12, YT + 0.12, YT + 0.8, -HW, HW, M.blade);
    beam.rotation.x = 0;                                                               // uhol strihu sa naznačí natočením trámu
    const hold = grp('pritlaky');
    const holdPins = [];
    for (let z = -HW + 1; z <= HW - 1; z += 1.5) { const g = new THREE.Group(); g.position.set(-0.75, 0, z); hold.add(g); cylY(g, 0.12, 0.12, YT + 0.02, YT + 1.6, 0, 0, M.steelDark, 14); holdPins.push(g); }
    box(hold, -1.0, -0.5, YT + 1.6, YT + 2.0, -HW, HW, M.greenDark);
    const guardG = grp('kryt');
    const guardPiv = new THREE.Group(); guardPiv.position.set(-1.15, YT + 2.1, 0); guardG.add(guardPiv);
    box(guardPiv, -0.05, 0.0, -1.9, 0.0, -HW + 0.3, HW - 0.3, M.grid);
    for (let z = -HW + 0.6; z < HW - 0.3; z += 0.6) box(guardPiv, -0.07, 0.01, -1.9, 0, z - 0.03, z + 0.03, M.black);
    hitProxy(guardPiv, 0.8, -0.05, -1.0, 0);
    // ---------- zadný doraz ----------
    const gaugeG = grp('doraz');
    box(gaugeG, 0, 0.18, YT, YT + 0.5, -HW + 0.5, HW - 0.5, M.steelDark);
    [-6, 6].forEach((z) => box(gaugeG, 0.18, 3.0, YT + 0.3, YT + 0.45, z - 0.1, z + 0.1, M.steel));
    // ---------- pedál a ovládanie ----------
    const ped = grp('pedal');
    box(ped, -3.6, -2.4, 0, 0.25, -1.2, 1.2, M.yellow);
    const pedal = new THREE.Group(); pedal.position.set(-3.0, 0.3, 0); ped.add(pedal);
    box(pedal, -0.4, 0.4, 0, 0.14, -0.9, 0.9, M.black); hitProxy(pedal, 0.7, 0, 0.1, 0);
    const mainSw = new THREE.Group(); mainSw.position.set(-2.02, 9.8, HW + 0.45); mainSw.rotation.y = -Math.PI / 2; fr.add(mainSw);
    cylZ(mainSw, 0.2, 0.2, 0, 0.06, 0, 0, M.black, 24); box(mainSw, -0.05, 0.05, -0.24, 0.24, 0.06, 0.16, M.red);
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
      ramy: () => v3(-2.0, 12.6, HW + 0.5), tram: () => v3(0.2, YT + 2.7 - st.stroke * 0.6, HW - 2), pritlaky: () => v3(-0.75, YT + 2.1, -HW + 3), kryt: () => v3(-1.2, YT + 0.5, HW - 3),
      doraz: () => v3(st.g / 100, YT + 0.6, 0), uholnik: () => v3(-3, YT + 0.3, -HW + 0.5), pedal: () => v3(-3.0, 0.6, 1.0), plech: () => v3(st.p / 100 - 1, YT + 0.1, 0),
    };
    const views = {
      celok: () => [[-16, 16, 18], [0, 6, 0]],
      noz: () => [[-4, YT + 2.5, 6], [0, YT, 3], true],
      zhora: () => [[-2, 26, 0.5], [-1, YT, 0], true],
      zboku: () => [[-1, YT + 1, 22], [-1, YT, 0], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed(), onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);
    apiRef.current.measure = () => ({ strips: st.strips.slice(), D: st.sheet.D });
    apiRef.current.snapshot = snapshot;
    apiRef.current.newBlank = () => {
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
    ctrl.reg({ type: 'button', label: LL('Kryt prstov', 'Finger guard'), hint: LL('Klik kryt sklopí alebo zdvihne.', 'Click to lower or raise the guard.'), action: () => push('guard', !c.guard) }, guardPiv);
    ctrl.reg({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.2, label: LL('Hlavný vypínač', 'Main switch'), hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0), onSet: (i) => push('power', i === 1), read: () => (c.power ? 'I' : '0') }, mainSw);
    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
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
          if (r.error === 'capacity') say(L(`Plech ${st.t} mm je nad kapacitu nožníc (3 mm) – spojka preklzla, strih sa nevykonal.`, `The ${st.t} mm sheet exceeds the shear capacity (3 mm) – the clutch slipped, no cut.`), 'danger');
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
      pedal.rotation.z = st.phase === 1 ? -0.2 : 0;
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
    return () => { cancelAnimationFrame(raf); snd.dispose(); ctrl.dispose(); insp.dispose(); fall.forEach((f) => f.m.geometry.dispose()); try { if (window.__shear && window.__shear.st === st) delete window.__shear; } catch (err) { /* ignorované */ } disposeStage(); };
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
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} canUnclamp={false}
        tips={[L('Šírka pásu = nastavenie zadného dorazu; plech zasúvaj, kým nedosadne.', 'Strip width = back gauge setting; push the sheet in until it touches.'),
          L('Vôľa nožov ≈ 7 % hrúbky plechu – inak má strih ostrinu.', 'Blade clearance ≈ 7 % of the sheet thickness – otherwise the cut has a burr.'),
          L('Pri zdvihnutom kryte prstov pedál nespustí strih.', 'With the finger guard raised the pedal does not start a cut.')]} />
      <aside className="panel">
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · tabuľové nožnice', 'Simulator · guillotine shear')} title={L('Tabuľové nožnice', 'Guillotine shear')}
          sub={L('Mechanické tabuľové nožnice na plech do 3 mm a dĺžky strihu 2 000 mm: šikmý horný nôž, prítlaky, kryt prstov, zadný doraz a nožný pedál.', 'Mechanical guillotine shear for sheet up to 3 mm and a 2,000 mm cut: raked upper blade, hold-downs, finger guard, back gauge and foot pedal.')}
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
          <Slider id="sv" label={L('Vôľa nožov', 'Blade clearance')} unit="mm" min={0.03} max={0.5} step={0.01} value={ui.gap} digits={2} onChange={(v) => set('gap', v)} />
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
          <SegRow label={L('Hrúbka mm', 'Thickness mm')} value={ui.t} options={[1, 2, 3, 4].map((x) => [x, String(x)])} onChange={(v) => set('t', v)} />
          <Slider id="sl" label={L('Dĺžka (pozdĺž noža)', 'Length (along the blade)')} unit="mm" min={200} max={2000} step={50} value={ui.L} onChange={(v) => set('L', v)} />
          <Slider id="sd" label={L('Hĺbka', 'Depth')} unit="mm" min={100} max={1000} step={10} value={ui.D} onChange={(v) => set('D', v)} />
        </BlankSection>

        <ExportSection machine="noznice" apiRef={apiRef} canStl={false} />
        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['noz', L('Nôž', 'Blade')], ['zhora', L('Zhora', 'Top')], ['zboku', L('Zboku', 'Side')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

export { ShearSimulator };
export default ShearSimulator;
