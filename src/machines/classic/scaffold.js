// Spoločné jadro nových klasických strojov: scéna, materiály, súprava tvarov a detailov, výber dielov, pohľady,
// ručné ovládače, prehliadka obrobku, hlavná slučka s telemetriou a zvukom. Stroj dodá len funkciu build(ctx),
// ktorá postaví model, zaregistruje ovládače a vráti { update(dt, t), tele(), measure?, workObj?, ... }.
import * as THREE from 'three';
import { createControls } from '../../core/controls';
import { L } from '../../core/i18n';
import { createMachineWorkInspect } from '../../core/machineWorkInspect';
import { createInspector } from '../../core/inspector';
import { baseMats, createLamp, makeKit, std } from '../../core/kit';
import { makeDetail } from '../../core/detail';
import { createStage } from '../../core/stage';
import { createSound } from '../../core/sound';
import { exportStep } from '../../core/step';

export function createClassicScene({
  mount,
  layer,
  tipEl,
  c,
  apiRef,
  set,
  setUi,
  setTele,
  colors,
  mats = {},
  name,
  sound,
  debugKey,
  orbitOptions,
  stageOptions,
  build,
}) {
  const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount, stageOptions);
  const snd = sound ? createSound(sound) : null;
  const dom = renderer.domElement;
  const M = { ...baseMats(...colors), lampShade: std(colors[1], 0.5, 0.2) };
  for (const [k, v] of Object.entries(mats)) M[k] = Array.isArray(v) ? std(...v) : v;
  const kit = makeKit(M),
    det = makeDetail(kit, M);
  const root = new THREE.Group();
  scene.add(root);
  apiRef.current.machineModel = { root, name };
  apiRef.current.snapshot = snapshot;
  const G = {};
  const grp = (k, parent = root) => {
    const g = new THREE.Group();
    g.userData.part = k;
    parent.add(g);
    G[k] = g;
    return g;
  };
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  let t = 0;
  const st = { msg: null };
  const flags = {};
  const say = (text, kind = 'warn') => {
    st.msg = { text, kind, until: t + 3 };
  };
  const sayOnce = (key, cond, text, kind) => {
    if (cond && !flags[key]) say(text, kind);
    flags[key] = cond;
  };
  const anchors = {},
    views = {};
  let ctrl = null;
  const insp = createInspector({
    dom,
    mount,
    camera,
    root,
    G,
    anchors,
    views,
    labelEls: Array.from(layer.querySelectorAll('[data-part]')),
    enabled: () => !c.manual && !c.unclamped,
    onPick: (k) => apiRef.current.onPick(k),
    blockPick: () => ctrl.isUsed() || c.unclamped,
    onHL: () => ctrl.invalidate(),
    orbitOptions,
  });
  ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
  const { push, pend } = ctrl;
  const needPower = (fn) => () => {
    if (!c.power) say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'));
    else fn();
  };
  const ctx = {
    scene,
    camera,
    renderer,
    dom,
    root,
    kit,
    det,
    M,
    G,
    grp,
    v3,
    c,
    st,
    ctrl,
    push,
    pend,
    say,
    sayOnce,
    needPower,
    anchors,
    views,
    apiRef,
    set,
    lamp: (o) => createLamp(scene, o.parent || root, kit, M, o),
    time: () => t,
  };
  const m = build(ctx);
  apiRef.current.measure = m.measure || null;
  const wi = m.workObj
    ? createMachineWorkInspect({
        scene,
        camera,
        dom,
        insp,
        c,
        set,
        apiRef,
        say,
        getObj: m.workObj,
        getSpot: m.workSpot || (() => v3(0, 8, 8)),
        canInspect: m.canInspect || (() => null),
        prepare: m.prepareInspect,
      })
    : null;
  if (!wi)
    apiRef.current.view = (nm) => {
      if (!c.unclamped) insp.goView(nm, false);
    };
  if (m.workObj)
    apiRef.current.exportStep = async () => {
      const why = m.canInspect?.();
      if (why) throw new Error(why);
      m.prepareInspect?.();
      return exportStep(m.workObj());
    };
  insp.goView('celok', true);
  let raf,
    last = performance.now(),
    teleT = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    wi?.update(dt);
    if (!c.unclamped) m.update(dt, t);
    ctrl.update(dt);
    insp.update(t, c);
    if (t - teleT > 0.1) {
      teleT = t;
      setTele({ ...m.tele(), msg: st.msg && st.msg.until > t ? st.msg : null });
      if (Object.keys(pend).length) {
        const q = { ...pend };
        Object.keys(pend).forEach((k) => delete pend[k]);
        setUi((u) => ({ ...u, ...q }));
      }
    }
    if (snd && m.sound) snd.update(m.sound());
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  try {
    if (debugKey && /[?&]debug/.test(window.location.search)) window[debugKey] = { c, st, ctx, m };
  } catch (err) {
    /* ignorované */
  }
  return () => {
    cancelAnimationFrame(raf);
    snd?.dispose();
    ctrl.dispose();
    wi?.dispose();
    insp.dispose();
    m.dispose?.();
    try {
      if (debugKey && window[debugKey]?.c === c) delete window[debugKey];
    } catch (err) {
      /* ignorované */
    }
    disposeStage();
  };
}

// štandardné tlačidlo na paneli (valec s okrajom a úchopovou zónou), lokálna +Z = čelo panela
export function panelButton(kit, M, parent, x, y, z, mat, r = 0.12) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  kit.cylZ(g, r * 1.25, r * 1.25, -0.02, 0.02, 0, 0, M.steelDark, 20);
  kit.cylZ(g, r, r, 0, 0.07, 0, 0, mat, 20);
  kit.hitProxy(g, r * 1.35, 0, 0, 0.05);
  return g;
}

// otočný hlavný vypínač (žltý štítok, červená páčka), lokálna +Z = čelo
export function mainSwitch(kit, M, parent, x, y, z) {
  kit.box(parent, x - 0.26, x + 0.26, y - 0.26, y + 0.26, z - 0.03, z, M.yellow); // štítok 0 / I sa netočí
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  kit.cylZ(g, 0.17, 0.17, 0, 0.06, 0, 0, M.black, 24);
  kit.box(g, -0.045, 0.045, -0.2, 0.2, 0.06, 0.16, M.red);
  kit.hitProxy(g, 0.25, 0, 0, 0.08);
  return g;
}
