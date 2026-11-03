import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createControls } from '../core/controls';
import { L, LL } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { baseMats, makeKit, std } from '../core/kit';
import { createStage } from '../core/stage';
import { TAU, approach, clamp } from '../core/util';
import { createWorkInspect } from '../core/workInspect';
import { BlankSection, HelpFooter, PanelHeader, PartsSection, SceneView, SegRow, Slider, ViewSection, mkParts, useMachine, useTele } from '../ui/common';

// =====================================================================
// VÝKYVNÁ OHÝBAČKA FASTI 204-10-2
// =====================================================================
const FOLD = { TT: 8.0, L: 5.2, MAXA: 130 };   // výška stola, polovica dĺžky líšt
const foldParts = () => mkParts([
  ['ramy', 'Bočné stojany', 'Side frames', 'Bočné stojany', 'Side frames', 'Dva liatinové stojany s nohami a priečnymi tyčami nesú celý stroj. Na pravom je ručné koleso upínania so stupnicou.', 'Two cast-iron frames with legs and tie bars carry the whole machine. The right one has the clamping handwheel with a scale.'],
  ['stol', 'Stôl', 'Bed', 'Stôl (spodná lišta)', 'Bed (lower beam)', 'Pevná spodná lišta s kalenou hranou – os ohybu leží presne na jej prednej hrane.', 'Fixed lower beam with a hardened edge – the bending axis lies exactly on its front edge.'],
  ['upinacia', 'Upínacia lišta', 'Clamping beam', 'Upínacia lišta', 'Clamping beam', 'Horná lišta so skoseným nosom pritlačí plech k stolu. Spúšťa sa kolesom cez dve zdvíhacie skrutky; nos je skosený, aby ohyb mohol ísť až do 130°.', 'The upper beam with a bevelled nose presses the sheet onto the bed. It is lowered by the handwheel through two lifting screws; the nose is bevelled so the bend can reach 130°.'],
  ['ohybacia', 'Ohýbacia lišta', 'Folding beam', 'Ohýbacia (výkyvná) lišta', 'Folding (swing) beam', 'Otáča sa okolo osi na prednej hrane stola. Za rukoväť pod lištou ju obsluha vykýva nahor a ohne vyčnievajúci okraj plechu.', 'Pivots about the axis on the front edge of the bed. The operator swings it up by the handle and folds the protruding edge of the sheet.'],
  ['skrutky', 'Skrutky upínania', 'Lifting screws', 'Zdvíhacie skrutky', 'Lifting screws', 'Dve závitové skrutky na koncoch upínacej lišty, spojené cez koleso a ozubené prevody – lišta klesá rovnobežne. 1 otáčka kolesa = 5 mm.', 'Two threaded screws at the ends of the clamping beam, linked through the handwheel and gears – the beam descends parallel. 1 turn = 5 mm.'],
  ['plech', 'Plech', 'Sheet', 'Plech', 'Sheet', 'Oceľový plech zvoleného rozmeru hrúbky 0,5 – 2 mm (predloha FASTI 204-10-2: dĺžka ohybu 1 040 mm, max. 2 mm). Po ohnutí sa časť ohybu vráti – odpruží.', 'Steel sheet of the selected size, 0.5 – 2 mm thick (model FASTI 204-10-2: 1,040 mm bending length, max. 2 mm). After bending part of the bend springs back.'],
]);

function FolderSimulator({ onBack }) {
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null);
  const init = { manual: false, gap: 30, beam: 0, flange: 50, thick: 1, bLen: 800, bDep: 300 };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ beam: 0, sheet: 0, perm: 0, gap: 30, clamped: false, msg: null, bending: false });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { TT, L: BL, MAXA } = FOLD;
    const wk = { SW: 4.0, SD: 3.0 };                                         // polovica šírky plechu, hĺbka plechu
    const { renderer, scene, camera, dispose: disposeStage } = createStage(mount);
    const dom = renderer.domElement;
    const M = { ...baseMats(0x9dc58b, 0x82ab70, 0x5f8253), sheet: std(0xb4bcc4, 0.35, 0.75, { side: THREE.DoubleSide }), screw: std(0x3b3d40, 0.45, 0.7) };
    const { add, box, cylX, cylY, cylZ, handwheel, rod } = makeKit(M);
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const D2R = Math.PI / 180;
    // profil v rovine (z, y) vytiahnutý pozdĺž osi X na dĺžku 2·len
    const prism = (p, pts, len, m, x = 0, y = 0, z = 0) => {
      const s = new THREE.Shape(); pts.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)));
      const g = new THREE.ExtrudeGeometry(s, { depth: 2 * len, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(len, 0, 0);
      return add(p, g, m, x, y, z);
    };

    // ---------- bočné stojany ----------
    const fr = grp('ramy');
    [-1, 1].forEach((sx) => {
      const x0 = sx * 5.7;
      box(fr, x0 - 0.3, x0 + 0.3, 0, 10.6, -1.7, -1.0, M.green);                // stĺpik
      box(fr, x0 - 0.35, x0 + 0.35, 10.4, 10.7, -1.8, -0.9, M.green);
      const leg = box(fr, x0 - 0.22, x0 + 0.22, 0, 7.4, -0.25, 0.25, M.green);  // šikmá predná noha
      leg.position.set(x0, 3.4, 0.9); leg.rotation.x = -0.32;
      box(fr, x0 - 0.35, x0 + 0.35, 0, 0.12, -2.0, -0.7, M.greenDark);
      box(fr, x0 - 0.3, x0 + 0.3, 0, 0.12, 1.8, 2.4, M.greenDark);
    });
    cylX(fr, 0.07, 0.07, -5.5, 5.5, 1.0, 1.3, M.green, 12);                     // priečne tyče
    cylX(fr, 0.07, 0.07, -5.5, 5.5, 2.4, -1.35, M.green, 12);
    box(fr, 6.0, 6.5, TT - 1.2, TT + 0.2, -1.0, -0.2, M.green);                  // ložisko kolesa
    cylX(fr, 0.36, 0.36, 6.35, 6.5, TT - 0.6, -0.6, M.black, 40);                // stupnica
    cylX(fr, 0.06, 0.06, 6.5, 6.75, TT - 0.6, -0.6, M.steel, 12);
    const wheelC = handwheel(fr, 0.65, 6.8, TT - 0.6, -0.6, 'x', 0.45);

    // ---------- stôl (spodná lišta) ----------
    const tbl = grp('stol');
    prism(tbl, [[0, 0], [-1.3, 0], [-1.3, -1.2], [-0.4, -1.6], [0, -1.6]], BL + 0.2, M.green, 0, TT, 0);
    box(tbl, -BL, BL, TT - 0.35, TT, -0.18, 0, M.steel);                           // kalená hrana
    box(tbl, -BL - 0.2, BL + 0.2, TT - 0.02, TT, -1.3, -0.18, M.greenDark);
    [-2.6, 0, 2.6].forEach((x) => cylZ(tbl, 0.32, 0.32, -0.01, 0.002, x, TT - 0.9, M.greenDark, 24));

    // ---------- upínacia lišta ----------
    const clampG = grp('upinacia');
    prism(clampG, [[-0.03, 0], [-1.05, 0], [-1.05, 1.5], [-0.62, 1.5], [-0.62, 0.55]], BL, M.green);
    box(clampG, -BL, BL, 0, 0.12, -0.62, -0.03, M.steel);
    const arch = new THREE.Shape(); arch.moveTo(-BL, 1.45); arch.lineTo(BL, 1.45); arch.lineTo(BL, 2.1); arch.quadraticCurveTo(0, 3.2, -BL, 2.1); arch.lineTo(-BL, 1.45);
    const archG = new THREE.ExtrudeGeometry(arch, { depth: 0.45, bevelEnabled: false });
    add(clampG, archG, M.green, 0, 0, -1.0);
    [-1, 1].forEach((sx) => { box(clampG, sx * BL - 0.25, sx * BL + 0.25, 0.4, 1.9, -1.15, -0.35, M.green); cylY(clampG, 0.26, 0.26, 1.9, 2.15, sx * 5.45, -0.75, M.insert, 6); });

    // ---------- zdvíhacie skrutky ----------
    const scr = grp('skrutky');
    const screws = [-1, 1].map((sx) => cylY(scr, 0.13, 0.13, TT - 0.5, TT + 4.2, sx * 5.45, -0.75, M.screw, 16));

    // ---------- ohýbacia lišta (os = predná hrana stola) ----------
    const swAxis = grp('ohybacia'); swAxis.position.set(0, TT, 0); swAxis.rotation.y = -Math.PI / 2;   // lokálna x = dopredu, z = -X
    const swing = new THREE.Group(); swAxis.add(swing);
    box(swing, 0, 0.42, -0.3, 0, -BL, BL, M.steel);
    const swProf = new THREE.Shape(); [[0, -0.3], [0.62, -0.3], [0.62, -0.95], [0.1, -1.25], [0, -1.25]].forEach(([a, b], i) => (i ? swProf.lineTo(a, b) : swProf.moveTo(a, b)));
    const swGeo = new THREE.ExtrudeGeometry(swProf, { depth: 2 * BL, bevelEnabled: false }); swGeo.translate(0, 0, -BL);
    add(swing, swGeo, M.green);
    [-1, 1].forEach((sz) => {
      cylZ(swing, 0.32, 0.32, sz > 0 ? BL : -BL - 0.38, sz > 0 ? BL + 0.38 : -BL, 0, 0, M.green, 24);
      rod(swing, v3(0.35, -1.1, sz * 2.4), v3(1.25, -3.1, sz * 2.4), 0.06, M.steel);
    });
    cylZ(swing, 0.065, 0.065, -2.5, 2.5, 1.25, -3.1, M.steel, 14);                // rukoväť

    // ---------- plech ----------
    const sheetG = grp('plech'); sheetG.position.set(0, TT, 0);
    const flat = add(sheetG, new THREE.BoxGeometry(1, 1, 1), M.sheet);
    const fAxis = new THREE.Group(); fAxis.rotation.y = -Math.PI / 2; sheetG.add(fAxis);
    const fRot = new THREE.Group(); fAxis.add(fRot);
    const flange = add(fRot, new THREE.BoxGeometry(1, 1, 1), M.sheet);
    const shapeSheet = (Lmm, tmm) => {
      const fl = Lmm / 100, th = tmm / 100;
      flat.scale.set(2 * wk.SW, th, wk.SD - fl); flat.position.set(0, th / 2, -(wk.SD - fl) / 2);
      flange.scale.set(fl, th, 2 * wk.SW); flange.position.set(fl / 2, th / 2, 0);
    };

    // ---------- stav simulácie ----------
    const st = { gap: c.gap, B: 0, P: 0, L: c.flange, th: c.thick, msg: null, bendT: -9 };
    let t = 0, last = performance.now(), teleT = 0;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 2.6 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };
    const spring = () => 1.5 + 1.2 * st.th;                                   // odpruženie v stupňoch
    const clamped = () => !c.unclamped && st.gap <= st.th + 0.05;
    shapeSheet(st.L, st.th);

    // ---------- pohľady, popisy a výber dielov ----------
    const anchors = {
      ramy: () => v3(-5.7, 10.85, -1.35),
      stol: () => v3(-4.6, TT - 1.0, 0.1),
      upinacia: () => v3(0, TT + st.gap / 100 + 2.95, -0.8),
      ohybacia: () => v3(3.6, TT - 1.0 + Math.sin(st.B * D2R) * 0.8, 0.7),
      skrutky: () => v3(5.45, TT + 4.35, -0.75),
      plech: () => v3(-Math.min(3.0, wk.SW - 0.6), TT + 0.1, -0.9),
    };
    const views = {
      celok: () => [[8, 13, 17], [0, 6.5, 0]],
      rez: () => [[-1.6, TT + 4.6, 6.4], [-3.4, TT + 0.4, -0.2], true],
      spredu: () => [[0, 8.5, 19], [0, 6.5, 0]],
      bok: () => [[17, TT + 2.0, 0.5], [0, TT, -0.3], true],
      zadu: () => [[-6, 12, -15], [0, 7, -0.5]],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
    const { push, pend } = ctrl;
    apiRef.current.view = (n) => insp.goView(n, false);

    // ---------- polotovar ----------
    const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj: () => sheetG, getSpot: () => v3(0, TT + 2.5, 6.0), onState: (v) => push('unclamped', v) });
    apiRef.current.toggleWork = () => {
      if (wi.phase() === 'in') {
        if (st.B > 0.5) { say(L('Najprv sklop ohýbaciu lištu dole.', 'Lower the folding beam first.')); return; }
        if (st.gap < st.th + 1) { say(L('Najprv uvoľni upínaciu lištu – plech je upnutý.', 'Release the clamping beam first – the sheet is clamped.')); return; }
      }
      if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb plechu.', 'Wait until the sheet movement finishes.'), 'info');
    };
    apiRef.current.newBlank = () => {
      if (c.unclamped) { say(L('Najprv vlož plech späť.', 'Put the sheet back first.')); return; }
      if (st.B > 0.5) { say(L('Najprv sklop ohýbaciu lištu dole.', 'Lower the folding beam first.'), 'warn'); return; }
      if (clamped()) { say(L('Najprv uvoľni upínaciu lištu.', 'Release the clamping beam first.'), 'warn'); return; }
      wk.SW = c.bLen / 200; wk.SD = c.bDep / 100; st.P = 0; st.th = c.thick; st.L = clamp(c.flange, 10, Math.min(150, c.bDep - 50));
      shapeSheet(st.L, st.th); say(L('Vložený nový rovný plech.', 'A new flat sheet is inserted.'), 'info');
    };

    ctrl.reg({ type: 'wheel', minR: 0.5, inc: -1, label: LL('Koleso upínania', 'Clamping handwheel'), hint: LL('V smere hodinových ručičiek lišta klesá a upne plech. 1 otáčka = 5 mm.', 'Clockwise lowers the beam and clamps the sheet. 1 turn = 5 mm.'),
      turn: (d) => push('gap', clamp(clamp(c.gap + d * 5 / TAU, st.gap - 4, st.gap + 4), 0, 40)),
      read: () => `${L('medzera', 'gap')} ${st.gap.toFixed(2)} mm` }, wheelC);
    ctrl.reg({ type: 'wheel', minR: 1.2, inc: 1, label: LL('Ohýbacia lišta', 'Folding beam'), hint: LL('Ťahaj za rukoväť alebo lištu nahor – ohne vyčnievajúci okraj plechu.', 'Drag the handle or the beam upwards – it folds the protruding edge of the sheet.'),
      turn: (d) => push('beam', clamp(clamp(c.beam + d / D2R, st.B - 12, st.B + 12), 0, MAXA)),
      read: () => `${st.B.toFixed(1)}°` }, swing);

    insp.goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (nowMs) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs; t += dt;
      wi.update(dt);

      // plech: hrúbka a vyloženie sa dajú meniť len pri voľnom rovnom plechu
      if (c.thick !== st.th || c.flange !== st.L) {
        if (clamped() || st.B > 0.5 || st.P > 0.01) {
          say(st.P > 0.01 ? L('Ohnutý plech sa už nedá posúvať – vlož nový plech.', 'A bent sheet can no longer be moved – insert a new sheet.') : L('Najprv uvoľni upínaciu lištu a sklop ohýbaciu lištu.', 'Release the clamping beam and lower the folding beam first.'), 'warn');
          push('thick', st.th); push('flange', st.L);
        } else { st.th = c.thick; st.L = clamp(c.flange, 10, Math.min(150, wk.SD * 100 - 50)); shapeSheet(st.L, st.th); }
      }

      // upínacia lišta – dosadne na plech (bez plechu až na stôl)
      const gT = clamp(c.gap, 0, 40);
      let ng = approach(st.gap, gT, 18 * dt);
      const floorG = c.unclamped ? 0 : st.th;
      if (ng < floorG) ng = floorG;
      sayOnce('clamp', !c.unclamped && gT < st.th + 0.05 && ng <= st.th + 0.05, L('Upínacia lišta dosadla – plech je upnutý.', 'The clamping beam has seated – the sheet is clamped.'), 'info');
      wheelC.rotation.z += (ng - st.gap) / 5 * TAU;
      screws.forEach((s) => { s.rotation.y -= (ng - st.gap) / 5 * TAU; });
      st.gap = ng;

      // ohýbacia lišta
      const bT = clamp(c.beam, 0, MAXA);
      let nb = approach(st.B, bT, 75 * dt);
      if (nb > st.B && !clamped() && nb > 2 && !c.unclamped) { nb = Math.max(st.B, 2); push('beam', nb); }
      sayOnce('loose', bT > 2 && !clamped() && !c.unclamped, L('Plech nie je upnutý – pri ohybe by vyskočil. Najprv dotiahni upínaciu lištu kolesom vpravo.', 'The sheet is not clamped – it would jump out when bending. Tighten the clamping beam with the handwheel on the right first.'), 'danger');
      sayOnce('maxa', bT >= MAXA && nb >= MAXA - 0.1, `${L('Ohýbacia lišta je na doraze', 'The folding beam is at its stop of')} ${MAXA}° – ${L('ďalej by narazila do nosa upínacej lišty.', 'further it would hit the clamping beam nose.')}`, 'warn');
      if (nb > st.B + 1e-6 && clamped() && nb > st.P) st.bendT = t;
      st.B = nb;
      // trvalý ohyb a odpruženie
      if (clamped() && st.B - spring() > st.P) st.P = st.B - spring();
      const shown = clamped() ? Math.max(st.P, st.B) : st.P;
      swing.rotation.z = st.B * D2R;
      fRot.rotation.z = shown * D2R;
      clampG.position.y = TT + st.gap / 100;

      ctrl.update(dt);
      insp.update(t, c);

      if (t - teleT > 0.1) {
        teleT = t;
        setTele({ beam: st.B, sheet: shown, perm: st.P, gap: st.gap, clamped: clamped(), bending: t - st.bendT < 0.2, msg: st.msg && st.msg.until > t ? st.msg : null });
        if (Object.keys(pend).length) {
          const p = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ctrl.dispose(); insp.dispose(); wi.dispose(); disposeStage(); };
  }, []);

  const parts = foldParts();
  const sb = 1.5 + 1.2 * ui.thick;
  const fmt = (v) => L(v.toFixed(1).replace('.', ','), v.toFixed(1));
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped ? { kind: 'info', text: L('Plech je vybratý zo stroja.', 'The sheet is out of the machine.') }
    : tele.bending ? { kind: 'run', text: `${L('Ohýbanie – plech', 'Bending – sheet')} ${tele.sheet.toFixed(1)}°, ${L('po uvoľnení odpruží na', 'springs back to')} ${tele.perm.toFixed(1)}°` }
    : !tele.clamped ? { kind: 'idle', text: L('Plech je voľný. Nastav vyloženie a dotiahni upínaciu lištu kolesom.', 'The sheet is free. Set the flange length and tighten the clamping beam with the handwheel.') }
    : tele.perm > 0.05 ? { kind: 'info', text: `${L('Plech je ohnutý na', 'The sheet is bent to')} ${tele.perm.toFixed(1)}° (${L('odpruženie', 'springback')} ${fmt(sb)}°).` }
    : { kind: 'run', text: L('Plech je upnutý. Vykývni ohýbaciu lištu nahor.', 'The sheet is clamped. Swing the folding beam up.') };
  const chips = [{ color: tele.clamped ? '#3ee06c' : '#8b8f89', text: tele.clamped ? L('Plech upnutý', 'Sheet clamped') : L('Plech voľný', 'Sheet free') }];
  if (tele.perm > 0.05) chips.push({ color: '#7fb6ff', text: `${L('Ohyb', 'Bend')} ${tele.perm.toFixed(1)}°` });

  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} />
      <aside className="panel">
        <PanelHeader ui={ui} set={set} kicker={L('Simulátor · ohýbačka', 'Simulator · folder')} title={L('Výkyvná ohýbačka plechu', 'Manual swing-beam folder')}
          sub={L('Predloha: FASTI 204-10-2, dĺžka ohybu 1 040 mm, plech do 2 mm. Mierka 1 : 100 mm.', 'Modelled after the FASTI 204-10-2, 1,040 mm bending length, sheet up to 2 mm. Scale 1 : 100 mm.')}
          rows={[[L('Lišta', 'Beam'), `${tele.beam.toFixed(1)}°`], [L('Plech', 'Sheet'), `${tele.sheet.toFixed(1)}°`], [L('Medzera', 'Gap'), tele.gap.toFixed(2)]]}
          foot={[`${L('plech', 'sheet')} ${ui.thick} mm`, `${L('odpruženie', 'springback')} ${fmt(sb)}°`]} status={statusMsg} />

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Plech a upínanie', 'Sheet and clamping')}</h2>
          <SegRow label={L('Hrúbka plechu', 'Sheet thickness')} value={ui.thick} options={[[0.5, L('0,5 mm', '0.5 mm')], [1, '1 mm'], [2, '2 mm']]} onChange={(v) => set('thick', v)} />
          <Slider id="ffl" label={L('Vyloženie (dĺžka ohnutého okraja)', 'Flange length (bent edge)')} unit="mm" min={10} max={150} step={1} value={ui.flange} onChange={(v) => set('flange', v)} />
          <Slider id="fgap" label={L('Upínacia lišta – medzera nad stolom', 'Clamping beam – gap above the bed')} unit="mm" min={0} max={40} step={0.1} value={ui.gap} actual={tele.gap} digits={1} onChange={(v) => set('gap', v)} />
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" onClick={() => set('gap', 0)}>{L('Upnúť', 'Clamp')}</button>
            <button type="button" className="btn flex-1" onClick={() => set('gap', 30)}>{L('Uvoľniť', 'Release')}</button>
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Ohýbanie', 'Bending')}</h2>
          <Slider id="fbeam" label={L('Uhol ohýbacej lišty', 'Folding beam angle')} unit="°" min={0} max={130} step={0.5} value={ui.beam} actual={tele.beam} digits={1} onChange={(v) => set('beam', v)} />
          <div className="flex flex-wrap gap-2">
            {[45, 90, 120].map((a) => <button key={a} type="button" className="btn" onClick={() => set('beam', a + sb)}>{a}° (+{fmt(sb)}°)</button>)}
            <button type="button" className="btn" onClick={() => set('beam', 0)}>{L('Sklopiť', 'Lower')}</button>
          </div>
          <p className="text-xs muted mt-2">{L(`Plech po uvoľnení odpruží o ${fmt(sb)}°, preto treba lištu vykývnuť o kúsok ďalej, ako je cieľový uhol.`, `After release the sheet springs back by ${fmt(sb)}°, so swing the beam slightly past the target angle.`)}</p>
        </div>

        <BlankSection onApply={() => apiRef.current.newBlank && apiRef.current.newBlank()} applyLabel={L('Vložiť nový rovný plech', 'Insert a new flat sheet')}>
          <Slider id="fbl" label={L('Dĺžka plechu (pozdĺž ohybu)', 'Sheet length (along the bend)')} unit="mm" min={300} max={1000} step={50} value={ui.bLen} onChange={(v) => set('bLen', v)} />
          <Slider id="fbd" label={L('Hĺbka plechu', 'Sheet depth')} unit="mm" min={200} max={400} step={10} value={ui.bDep} onChange={(v) => set('bDep', v)} />
        </BlankSection>

        <ViewSection apiRef={apiRef}
          views={[['celok', L('Celok', 'Overview')], ['rez', L('Detail ohybu', 'Bend detail')], ['bok', L('Z boku', 'Side')], ['spredu', L('Spredu', 'Front')], ['zadu', L('Zozadu', 'Rear')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

export { FolderSimulator };
export default FolderSimulator;
