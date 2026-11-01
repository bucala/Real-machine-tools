import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three'; // testované s three r128

/* Interaktívny model konvenčného hrotového sústruhu (React + Three.js r128).
   Mierka: 1 jednotka scény = 100 mm. Os vretena leží v osi X scény, obsluha stojí na strane +Z. */

const TAU = Math.PI * 2;
const AXIS_Y = 7.5;                       // výška osi vretena nad podlahou
const JAW_X = -3.45;                      // čelo čeľustí = nula osi Z
const W_X0 = -4.2, W_X1 = 2.6;            // obrobok (časť je v skľučovadle)
const W_N = 340, W_DX = (W_X1 - W_X0) / W_N, W_R0 = 0.45;   // profil obrobku, Ø90 mm
const TIP_LX = -0.36, TIP_LZ = -0.05;     // hrot noža v súradniciach suportu
const LIM = { tipMin: -3.35, rMax: 1.3, quillMax: 1.5, tailMax: 9.0, carToTail: 2.21, quillClear: 0.42 };
const SPEEDS = [40, 56, 80, 112, 160, 224, 315, 450, 630, 900, 1250, 1800];   // 3 × 4 stupne otáčok
const FEED_BASE = [0.05, 0.07, 0.1, 0.14, 0.2, 0.25, 0.35, 0.5], FEED_MULT = [1, 2];
const A_ANG = [0.75, 0, -0.75], B_ANG = [0.95, 0.32, -0.32, -0.95];      // polohy pák otáčok
const FEED_ANG = FEED_BASE.map((_, i) => 1.4 - i * 2.8 / 7), MULT_ANG = [0.5, -0.5];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (cur, target, step) => { const d = target - cur; return Math.abs(d) <= step ? target : cur + Math.sign(d) * step; };

const PARTS = [
  { key: 'lozko', short: 'Lôžko', name: 'Lôžko', desc: 'Masívny liatinový základ stroja. Kalené a brúsené vodiace plochy (prizmatická „V“ a plochá) vedú suport aj koník presne rovnobežne s osou vretena.' },
  { key: 'vretennik', short: 'Vretenník', name: 'Vretenník', desc: 'Skriňa s hlavným vretenom v presných ložiskách a s prevodovkou otáčok. Pákami sa volia otáčky, hlavným vypínačom sa zapína pohon. Na vretene je upínač obrobku.' },
  { key: 'sklucovadlo', short: 'Skľučovadlo', name: 'Trojčeľusťové skľučovadlo', desc: 'Samostrediace skľučovadlo. Kľúčom sa cez špirálu posúvajú všetky tri čeľuste naraz, takže valcový obrobok je upnutý súosovo s vretenom.' },
  { key: 'obrobok', short: 'Obrobok', name: 'Obrobok', desc: 'Mosadzná tyč Ø90 mm. Keď sa vreteno točí, nôž odoberá materiál a priemer sa zmenšuje podľa polohy noža v osi X. Pri stojacom vretene nôž do obrobku nevnikne.' },
  { key: 'suport', short: 'Suport', name: 'Suport – pozdĺžne sane a zámková skriňa', desc: 'Pozdĺžne sane jazdia po lôžku (os Z). Zámková skriňa vpredu má ručné koleso s pastorkom na ozubenom hrebeni, páku matice vodiacej skrutky a zapínanie automatického posuvu.' },
  { key: 'priecny', short: 'Nožová hlava', name: 'Priečne sane a nožová hlava', desc: 'Priečne sane sa posúvajú skrutkou kolmo na os vretena (os X). Nesú otočné nožové sane a štvorpolohovú nožovú hlavu, v ktorej je upnutý sústružnícky nôž s vymeniteľnou doštičkou.' },
  { key: 'konik', short: 'Koník', name: 'Koník', desc: 'Posúva sa po lôžku. Ručným kolesom sa cez skrutku vysúva pinola s otočným hrotom, ktorý podopiera dlhé obrobky. Do pinoly sa dá upnúť aj vrták alebo výstružník.' },
  { key: 'skrutky', short: 'Skrutka a ťažná tyč', name: 'Vodiaca skrutka a ťažná tyč', desc: 'Vodiaca skrutka (so závitom) poháňa suport pri rezaní závitov cez maticu. Ťažná tyč (s drážkou) prenáša pohyb pre bežné pozdĺžne a priečne posuvy.' },
  { key: 'prevodovka', short: 'Prevodovka posuvov', name: 'Prevodovka posuvov (Norton)', desc: 'Volí sa ňou veľkosť posuvu v mm/ot a stúpanie závitu. Pohon dostáva od vretena cez výmenné kolesá pod ľavým krytom.' },
  { key: 'podstavec', short: 'Podstavec', name: 'Podstavce a vaňa na triesky', desc: 'Podstavce nesú lôžko, v ľavom je hlavný elektromotor a rozvádzač. Vaňa medzi nimi zachytáva triesky a chladiacu kvapalinu.' },
];

const CSS = `
:root{
  --bg:#eef0eb; --panel:#fbfcf9; --panel-2:#f0f2ec; --border:#d9ddd3; --text:#1c2419; --muted:#5d6858;
  --accent:#4f7f3b; --accent-soft:#e1ecd8; --run:#2f8a45; --stop:#bf3a2c;
  --danger:#b3362a; --danger-soft:#f9e3df; --warn:#94600a; --warn-soft:#fbefd7; --info:#285f9c; --info-soft:#e1ecf8;
  --scene-bg:#dde2da; --floor:#b7bcb2; --grid-1:#8b9386; --grid-2:#a6ac9f;
  --dro-bg:#0b100c; --dro-ink:#69f28f; --hl:#ff8a1f;
  --f-ui:"Barlow",ui-sans-serif,system-ui,"Segoe UI",sans-serif;
  --f-head:"Barlow Condensed","Barlow",ui-sans-serif,system-ui,sans-serif;
  --f-mono:"Share Tech Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#111511; --panel:#171c16; --panel-2:#1f251d; --border:#2c3429; --text:#e5ebe1; --muted:#98a492;
  --accent:#7fb565; --accent-soft:#25331f; --run:#2f8a45; --stop:#bf3a2c;
  --danger:#f07767; --danger-soft:#3a1d19; --warn:#efb453; --warn-soft:#382b14; --info:#76acec; --info-soft:#162a40;
  --scene-bg:#1a1f19; --floor:#272d25; --grid-1:#485244; --grid-2:#343b31; color-scheme:dark;
}}
:root[data-theme="dark"]{
  --bg:#111511; --panel:#171c16; --panel-2:#1f251d; --border:#2c3429; --text:#e5ebe1; --muted:#98a492;
  --accent:#7fb565; --accent-soft:#25331f; --run:#2f8a45; --stop:#bf3a2c;
  --danger:#f07767; --danger-soft:#3a1d19; --warn:#efb453; --warn-soft:#382b14; --info:#76acec; --info-soft:#162a40;
  --scene-bg:#1a1f19; --floor:#272d25; --grid-1:#485244; --grid-2:#343b31; color-scheme:dark;
}
body{background:var(--bg);color:var(--text);font-family:var(--f-ui)}
.lathe-app{background:var(--bg);color:var(--text);font-family:var(--f-ui);min-height:100%}
.scene-wrap{height:58vh;min-height:320px;background:var(--scene-bg);touch-action:none}
.panel{background:var(--panel);border-top:1px solid var(--border)}
@media (min-width:768px){
  .lathe-app{height:100%}
  .scene-wrap{height:auto;min-height:0}
  .panel{width:380px;flex:none;border-top:0;border-left:1px solid var(--border);height:100%;overflow-y:auto}
}
.sec{padding-block:14px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));border-bottom:1px solid var(--border)}
.sec-title{font-family:var(--f-head);font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:700;margin:0}
.app-title{font-family:var(--f-head);font-size:26px;line-height:1.05;font-weight:700;margin:0;text-wrap:balance}
.muted{color:var(--muted)} .ink{color:var(--text)} .tnum{font-variant-numeric:tabular-nums}
.range{width:100%;accent-color:var(--accent);margin-top:6px;cursor:pointer}
.range:disabled{opacity:.45;cursor:not-allowed}
.btn{border:1px solid var(--border);background:var(--panel-2);color:var(--text);border-radius:7px;padding:6px 10px;font-size:13px;font-weight:600;cursor:pointer;transition:border-color .15s,background .15s;font-family:var(--f-ui)}
.btn:hover{border-color:var(--accent)}
.btn.active{background:var(--accent-soft);border-color:var(--accent)}
.btn-run{width:100%;border-radius:9px;padding:12px;font-weight:700;font-size:16px;letter-spacing:.04em;text-transform:uppercase;color:#fff;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;font-family:var(--f-head)}
.btn-run.start{background:var(--run)} .btn-run.stop{background:var(--stop)}
.btn:focus-visible,.btn-run:focus-visible,.range:focus-visible,.part-label:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.dro{background:var(--dro-bg);border-radius:8px;padding:10px 14px;font-family:var(--f-mono);color:var(--dro-ink);box-shadow:inset 0 0 0 1px #000,inset 0 2px 12px rgba(0,0,0,.65)}
.dro-row{display:flex;justify-content:space-between;align-items:baseline;font-size:14px}
.dro-row b{font-size:28px;font-weight:400;letter-spacing:.06em;text-shadow:0 0 8px rgba(105,242,143,.45)}
.dro-sub{display:flex;justify-content:space-between;gap:8px;font-size:13px;opacity:.78;margin-top:4px;border-top:1px solid rgba(105,242,143,.2);padding-top:6px}
.msg{font-size:13px;border-radius:7px;padding:8px 10px;margin-top:10px;min-height:40px;display:flex;align-items:center;gap:8px;line-height:1.3}
.msg-idle{background:var(--panel-2);color:var(--muted)}
.msg-run{background:var(--accent-soft);color:var(--text)}
.msg-warn{background:var(--warn-soft);color:var(--warn)}
.msg-danger{background:var(--danger-soft);color:var(--danger)}
.msg-info{background:var(--info-soft);color:var(--info)}
.lamp{width:9px;height:9px;border-radius:50%;flex:none;background:currentColor}
.sw{width:36px;height:20px;border-radius:999px;background:var(--border);position:relative;transition:background .15s;flex:none}
.sw i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.35)}
.sw.on{background:var(--accent)} .sw.on i{left:18px}
.part-label{position:absolute;left:0;top:0;opacity:0;font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:999px;background:rgba(18,24,17,.8);color:#fff;border:1px solid rgba(255,255,255,.2);white-space:nowrap;cursor:pointer;will-change:transform;font-family:var(--f-ui);transition:opacity .2s}
.part-label.is-active{background:var(--hl);color:#1b1204;border-color:#ffc58f}
.chip{font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:rgba(18,24,17,.78);color:#fff;display:inline-flex;align-items:center;gap:6px}
.hint{font-size:11.5px;color:var(--muted);background:var(--panel);border:1px solid var(--border);padding:4px 8px;border-radius:6px}
.part-btn{border:1px solid var(--border);background:var(--panel-2);color:var(--text);border-radius:999px;padding:4px 10px;font-size:12.5px;font-weight:500;cursor:pointer;font-family:var(--f-ui)}
.part-btn:hover{border-color:var(--hl)}
.part-btn.active{background:var(--hl);border-color:var(--hl);color:#1b1204}
.desc{background:var(--panel-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:13.5px;line-height:1.45;margin-top:10px}
.seg{display:inline-flex;border:1px solid var(--border);border-radius:7px;overflow:hidden}
.seg button{padding:3px 9px;font-size:12px;font-weight:600;background:var(--panel-2);color:var(--muted);border:0;cursor:pointer;font-family:var(--f-ui)}
.seg button.on{background:var(--accent);color:#fff}
.mode-seg{display:inline-flex;gap:2px;padding:3px;border-radius:9px;background:rgba(18,24,17,.82);border:1px solid rgba(255,255,255,.18)}
.mode-seg button{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:7px;border:0;background:transparent;color:#d9e0d5;font-size:12.5px;font-weight:600;cursor:pointer;font-family:var(--f-ui)}
.mode-seg button.on{background:var(--accent);color:#fff}
.mode-seg button:focus-visible{outline:2px solid #fff;outline-offset:1px}
.manual-frame{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 2px var(--accent)}
.ctl-tip{position:absolute;left:0;top:0;display:none;max-width:250px;pointer-events:none;z-index:5;background:rgba(14,19,14,.92);color:#fff;border:1px solid rgba(120,170,255,.45);border-radius:8px;padding:6px 9px;font-size:12px;line-height:1.35}
.ctl-tip b{font-weight:700} .ctl-tip span{display:block;opacity:.72;font-size:11.5px;margin-top:2px}
.ctl-list{font-size:12.5px;line-height:1.45;margin-top:8px;padding-left:16px;list-style:disc;color:var(--muted)}
.ctl-list li{margin-top:3px} .ctl-list b{color:var(--text);font-weight:600}
@media (prefers-reduced-motion: reduce){.sw i,.part-label{transition:none}}
`;

function createOrbit(camera, dom, onUser, enabled) {
  const target = new THREE.Vector3();
  const sph = { r: 20, theta: 0, phi: 1 };
  const sync = () => {
    const o = camera.position.clone().sub(target);
    sph.r = o.length(); sph.theta = Math.atan2(o.x, o.z); sph.phi = Math.acos(clamp(o.y / sph.r, -1, 1));
  };
  const apply = () => {
    sph.phi = clamp(sph.phi, 0.03, 1.5); sph.r = clamp(sph.r, 4, 50);
    const s = Math.sin(sph.phi);
    camera.position.set(target.x + sph.r * s * Math.sin(sph.theta), target.y + sph.r * Math.cos(sph.phi), target.z + sph.r * s * Math.cos(sph.theta));
    camera.lookAt(target);
  };
  const vR = new THREE.Vector3(), vU = new THREE.Vector3();
  const pan = (dx, dy) => {
    camera.updateMatrix();
    vR.setFromMatrixColumn(camera.matrix, 0); vU.setFromMatrixColumn(camera.matrix, 1);
    const k = sph.r * 0.0017;
    target.addScaledVector(vR, -dx * k).addScaledVector(vU, dy * k);
    target.y = clamp(target.y, 0, 14);
  };
  const pts = new Map();
  let mode = null, pinch = 0, mid = null;
  const two = () => {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  const down = (e) => {
    if (!enabled()) return;
    try { dom.setPointerCapture(e.pointerId); } catch (err) { /* ignorované */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
    else if (pts.size === 2) { mode = 'pinch'; const t = two(); pinch = t.d; mid = t.m; }
  };
  const move = (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (!enabled()) { pts.clear(); mode = null; return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (mode === 'rot') { sph.theta -= dx * 0.0065; sph.phi -= dy * 0.0065; }
    else if (mode === 'pan') pan(dx, dy);
    else if (mode === 'pinch' && pts.size >= 2) {
      const t = two(); if (t.d > 0) sph.r *= pinch / t.d; pinch = t.d;
      pan(t.m.x - mid.x, t.m.y - mid.y); mid = t.m;
    } else return;
    onUser(); apply();
  };
  const up = (e) => { pts.delete(e.pointerId); mode = pts.size === 1 ? 'rot' : null; };
  const wheel = (e) => { if (!enabled()) return; e.preventDefault(); sph.r *= Math.exp(e.deltaY * 0.0012); onUser(); apply(); };
  const ctx = (e) => e.preventDefault();
  dom.addEventListener('pointerdown', down); dom.addEventListener('pointermove', move);
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  dom.addEventListener('wheel', wheel, { passive: false }); dom.addEventListener('contextmenu', ctx);
  const dispose = () => {
    dom.removeEventListener('pointerdown', down); dom.removeEventListener('pointermove', move);
    dom.removeEventListener('pointerup', up); dom.removeEventListener('pointercancel', up);
    dom.removeEventListener('wheel', wheel); dom.removeEventListener('contextmenu', ctx);
  };
  return { target, sync, apply, dispose };
}

function Slider({ id, label, value, min, max, step, unit, onChange, actual, disabled, digits = 0 }) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tnum muted text-xs">
          {actual != null && <span>skut. {actual.toFixed(digits)} · </span>}
          <span className="ink font-semibold text-sm">{Number(value).toFixed(digits)} {unit}</span>
        </span>
      </label>
      <input id={id} className="range" type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Toggle({ on, onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between w-full text-sm py-1 gap-3 text-left" aria-pressed={on}>
      <span className="font-semibold">{label}</span>
      <span className={`sw ${on ? 'on' : ''}`}><i /></span>
    </button>
  );
}

function LatheSimulator() {
  const mountRef = useRef(null);
  const layerRef = useRef(null);
  const tipRef = useRef(null);
  const apiRef = useRef({});
  const init = { running: false, power: true, light: true, manual: false, rpm: 450, z: 395, x: 120, quill: 0, tail: 765, autoFeed: false, feed: 0.25, timeScale: 10, labels: true };
  const ctl = useRef({ ...init, highlight: null });
  const [ui, setUi] = useState(init);
  const [tele, setTele] = useState({ rpm: 0, z: 395, x: 120, quill: 0, tail: 765, vc: 0, msg: null, cutting: false, engaged: false, workD: 90 });
  const [selected, setSelected] = useState(null);

  const set = (k, v) => { ctl.current[k] = v; setUi((u) => ({ ...u, [k]: v })); };
  const selectPart = (k) => {
    const next = ctl.current.highlight === k ? null : k;
    ctl.current.highlight = next; setSelected(next);
  };
  apiRef.current.onPick = (k) => { ctl.current.highlight = k; setSelected(k); };

  // M = prepnutie kamera / ručné ovládanie, Esc = späť na kameru
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey || tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'range')) return;
      if (e.key === 'm' || e.key === 'M') set('manual', !ctl.current.manual);
      else if (e.key === 'Escape' && ctl.current.manual) set('manual', false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;

    // ---------- renderer, scéna, kamera ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

    // jednoduché prostredie pre odlesky kovov
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x4d5450, side: THREE.BackSide })));
    const envPanel = (x, y, z, w, h, col) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
    };
    envPanel(0, 14, 0, 34, 12, 0xffffff); envPanel(-26, 6, 12, 12, 9, 0xdde6ff); envPanel(22, 6, -18, 14, 9, 0xfff0dc);
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3f4a3d, 0.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(-8, 20, 14); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35); fill.position.set(12, 8, -10); scene.add(fill);
    const spot = new THREE.SpotLight(0xfff0d0, 1.1, 16, 0.55, 0.6, 1.5);
    spot.position.set(-4.2, 10.3, -1.35); scene.add(spot, spot.target);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.95, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    let grid = null;
    const applyTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      const col = (n, d) => new THREE.Color((cs.getPropertyValue(n) || '').trim() || d).convertSRGBToLinear();
      scene.background = col('--scene-bg', '#dde2da');
      scene.fog = new THREE.Fog(scene.background, 45, 95);
      floor.material.color = col('--floor', '#b7bcb2');
      if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
      grid = new THREE.GridHelper(80, 80, col('--grid-1', '#8b9386'), col('--grid-2', '#a6ac9f'));
      grid.position.y = 0.005; scene.add(grid);
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    const mo = new MutationObserver(applyTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ---------- materiály a textúry ----------
    const std = (hex, roughness, metalness, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).convertSRGBToLinear(), roughness, metalness, ...o });
    const mkTex = (w, h, draw, rx, ry) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
      const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(rx, ry);
      tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4; return tx;
    };
    const brassTex = mkTex(256, 4, (g) => {
      for (let i = 0; i < 256; i++) {
        const n = 0.93 + 0.05 * Math.sin(i * 1.7) + (Math.random() - 0.5) * 0.06;
        const base = i < 6 ? [140, 104, 38] : [224, 186, 94];
        g.fillStyle = `rgb(${base.map((v) => Math.min(255, Math.round(v * n))).join(',')})`; g.fillRect(i, 0, 1, 4);
      }
    }, 1, 1);
    const leadTex = mkTex(64, 64, (g, w) => {
      g.fillStyle = '#c2c7cb'; g.fillRect(0, 0, w, w); g.strokeStyle = '#5a6066'; g.lineWidth = 11;
      for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(0, k * 32); g.lineTo(64, k * 32 + 32); g.stroke(); }
    }, 1, 110);
    const feedTex = mkTex(64, 4, (g) => { g.fillStyle = '#c6cbcf'; g.fillRect(0, 0, 64, 4); g.fillStyle = '#464c51'; g.fillRect(0, 0, 7, 4); }, 1, 1);

    const M = {
      green: std(0x8db57d, 0.6, 0.05), greenDark: std(0x6d9461, 0.65, 0.05), greenDeep: std(0x4f6e47, 0.7, 0.05),
      steel: std(0xc9ced2, 0.3, 0.85), steelDark: std(0x81888e, 0.4, 0.75), ways: std(0xdfe3e6, 0.18, 0.9),
      black: std(0x1d1f21, 0.45, 0.2), red: std(0xc8322b, 0.45, 0.1), yellow: std(0xf1c40f, 0.5, 0.05),
      blue: std(0x1f6fd1, 0.5, 0.05), white: std(0xeceee8, 0.6, 0), panel: std(0x2b3035, 0.6, 0.2),
      btnGreen: std(0x2e9b4a, 0.45, 0.05), insert: std(0xd4ab38, 0.35, 0.8),
      brass: std(0xffffff, 0.3, 0.85, { map: brassTex, side: THREE.DoubleSide }),
      lead: std(0xffffff, 0.35, 0.8, { map: leadTex }), feed: std(0xffffff, 0.3, 0.85, { map: feedTex }),
      lamp: std(0x1f5f33, 0.4, 0.1), bulb: new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xfff0c0, emissiveIntensity: 1.4 }),
      chip: std(0xe6c068, 0.3, 0.85),
    };

    // ---------- pomocné tvary ----------
    const add = (p, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; o.position.set(x, y, z); p.add(o); return o; };
    const box = (p, x0, x1, y0, y1, z0, z1, m) => add(p, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const cylX = (p, r0, r1, x0, x1, y, z, m, seg = 32) => { const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, seg); g.rotateZ(-Math.PI / 2); return add(p, g, m, (x0 + x1) / 2, y, z); };
    const cylY = (p, r0, r1, y0, y1, x, z, m, seg = 24) => add(p, new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), m, x, (y0 + y1) / 2, z);
    const cylZ = (p, r0, r1, z0, z1, x, y, m, seg = 24) => { const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, seg); g.rotateX(Math.PI / 2); return add(p, g, m, x, y, (z0 + z1) / 2); };
    const ball = (p, r, x, y, z, m) => add(p, new THREE.SphereGeometry(r, 16, 12), m, x, y, z);
    const lever = (p, x, y, z, len, rx, rz, knob = M.black) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, 0, rz); p.add(g);
      cylY(g, 0.045, 0.035, 0, len, 0, 0, M.steel, 12); ball(g, 0.11, 0, len, 0, knob); ball(g, 0.09, 0, 0, 0, M.steelDark);
      return g;
    };
    // neviditeľná väčšia úchopová zóna pre malé ovládacie prvky
    const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const hitProxy = (p, r, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), hitMat); m.position.set(x, y, z); p.add(m); };
    // páka na otočnom čape: uhol polohy = pivot.rotation.z
    const pivotLever = (p, x, y, z, len, tilt) => {
      const pv = new THREE.Group(); pv.position.set(x, y, z); p.add(pv);
      hitProxy(lever(pv, 0, 0, 0, len, tilt, 0), 0.2, 0, len * 0.8, 0);
      return pv;
    };
    const detents = (p, x, y, z, r, angles, s = 0.035) => angles.forEach((a) => cylZ(p, s, s, z, z + 0.012, x - Math.sin(a) * r, y + Math.cos(a) * r, M.white, 10));
    // ručné koleso: os otáčania = lokálna Z (pre axis 'x' otočené na svetovú +X)
    const handwheel = (p, R, x, y, z, axis, crank) => {
      const outer = new THREE.Group(); outer.position.set(x, y, z);
      if (axis === 'x') outer.rotation.y = Math.PI / 2;
      p.add(outer);
      const spin = new THREE.Group(); outer.add(spin);
      add(spin, new THREE.TorusGeometry(R, R * 0.075, 10, 40), M.steel);
      cylZ(spin, R * 0.2, R * 0.2, -0.12, 0.12, 0, 0, M.steel);
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + Math.PI / 2;
        const s = add(spin, new THREE.BoxGeometry(R * 0.85, R * 0.09, R * 0.07), M.steel, Math.cos(a) * R * 0.52, Math.sin(a) * R * 0.52, 0);
        s.rotation.z = a;
      }
      const hx = Math.cos(-Math.PI / 6) * R * 0.95, hy = Math.sin(-Math.PI / 6) * R * 0.95;
      cylZ(spin, R * 0.07, R * 0.06, 0, crank, hx, hy, M.black, 12); ball(spin, R * 0.1, hx, hy, crank, M.black);
      return spin;
    };

    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };

    // ---------- podstavce a vaňa ----------
    const base = grp('podstavec');
    box(base, -10, -5.2, 0.15, 3.5, -1.9, 1.9, M.green);
    box(base, -10.1, -5.1, 0, 0.15, -2.0, 2.0, M.greenDeep);
    box(base, -9.5, -5.7, 0.55, 3.05, 1.9, 1.94, M.greenDark);
    cylZ(base, 0.08, 0.08, 1.94, 2.04, -6.0, 1.8, M.black);
    box(base, 9.6, 12, 0.15, 3.5, -1.7, 1.7, M.green);
    box(base, 9.5, 12.1, 0, 0.15, -1.8, 1.8, M.greenDeep);
    box(base, 10.0, 11.6, 0.55, 3.05, 1.7, 1.74, M.greenDark);
    box(base, -5.2, 9.6, 1.4, 1.55, -2.0, 2.8, M.greenDark);
    box(base, -5.2, 9.6, 1.55, 2.05, 2.7, 2.8, M.greenDark);
    box(base, -5.2, 9.6, 1.55, 2.4, -2.0, -1.9, M.greenDark);

    // ---------- lôžko s vodiacimi plochami ----------
    const bed = grp('lozko');
    box(bed, -10, 12, 3.5, 5.0, -1.5, 1.5, M.green);
    const vway = (z) => { const m = add(bed, new THREE.BoxGeometry(17.2, 0.26, 0.26), M.ways, 3.4, 5.0, z); m.rotation.x = Math.PI / 4; };
    vway(1.15); vway(-0.45);
    box(bed, -5.2, 12, 5.0, 5.14, -1.45, -0.85, M.ways);
    box(bed, -5.2, 12, 5.0, 5.14, 0.2, 0.7, M.ways);
    box(bed, -5.2, 11.3, 4.55, 4.78, 1.5, 1.6, M.steelDark);        // ozubený hrebeň
    box(bed, 11.3, 11.9, 3.0, 4.75, 1.5, 2.1, M.green);             // ložisko skrutiek

    // ---------- vretenník ----------
    const hs = grp('vretennik');
    box(hs, -10, -5.0, 5.0, 9.0, -1.85, 1.85, M.green);
    box(hs, -9.9, -5.1, 9.0, 9.25, -1.75, 1.75, M.greenDark);
    box(hs, -10.6, -10.0, 3.6, 9.1, -1.6, 1.6, M.green);            // kryt výmenných kolies
    cylX(hs, 1.15, 1.15, -5.05, -4.85, AXIS_Y, 0, M.green, 40);
    box(hs, -7.7, -6.2, 7.75, 8.6, 1.85, 1.87, M.white);            // tabuľka otáčok
    cylZ(hs, 0.22, 0.22, 1.85, 1.875, -5.55, 8.35, M.blue, 28);
    [[-9.3, 7.0], [-8.4, 7.0], [-9.3, 6.0]].forEach(([x, y]) => cylZ(hs, 0.32, 0.28, 1.85, 2.05, x, y, M.black, 28));
    detents(hs, -9.3, 7.0, 2.05, 0.21, A_ANG); detents(hs, -8.4, 7.0, 2.05, 0.21, B_ANG);
    const levA = pivotLever(hs, -9.3, 7.0, 2.05, 0.5, 1.15), levB = pivotLever(hs, -8.4, 7.0, 2.05, 0.5, 1.15);
    lever(hs, -9.3, 6.0, 2.05, 0.5, 1.15, 0.5);
    lever(hs, -9.4, 9.25, -0.9, 0.95, -0.35, 0.15);
    lever(hs, -8.9, 9.25, -1.1, 0.8, -0.5, -0.1);
    box(hs, -8.9, -7.3, 9.25, 10.35, 0.5, 1.1, M.panel);            // ovládací panel
    const pbtn = (x, m) => { const g = new THREE.Group(); g.position.set(x, 9.6, 1.1); hs.add(g); cylZ(g, 0.13, 0.13, 0, 0.08, 0, 0, m, 20); hitProxy(g, 0.19, 0, 0, 0.06); return g; };
    const btnStop = pbtn(-8.6, M.red), btnStart = pbtn(-8.2, M.btnGreen), btnLight = pbtn(-7.8, M.blue);
    cylZ(hs, 0.12, 0.12, 1.1, 1.16, -7.55, 10.0, M.white, 20);
    ball(hs, 0.12, -8.6, 10.02, 1.1, M.lamp);
    box(hs, -6.75, -5.85, 5.55, 6.45, 1.85, 1.87, M.yellow);         // hlavný vypínač
    box(hs, -6.32, -6.28, 6.33, 6.43, 1.87, 1.88, M.black);           // značky „I“ a „0“
    add(hs, new THREE.TorusGeometry(0.035, 0.01, 6, 16), M.black, -6.66, 6.0, 1.875);
    const mainSwitch = new THREE.Group(); mainSwitch.position.set(-6.3, 6.0, 1.95); hs.add(mainSwitch);
    cylZ(mainSwitch, 0.28, 0.28, -0.1, 0, 0, 0, M.black, 28);
    box(mainSwitch, -0.34, 0.34, -0.07, 0.07, 0, 0.16, M.red);
    cylY(hs, 0.06, 0.06, 9.25, 11.0, -5.5, -1.35, M.black, 12);       // lampa
    cylX(hs, 0.05, 0.05, -5.5, -4.2, 11.0, -1.35, M.black, 12);
    cylY(hs, 0.38, 0.14, 10.45, 10.95, -4.2, -1.35, M.greenDark, 24);
    ball(hs, 0.13, -4.2, 10.42, -1.35, M.bulb);

    // ---------- prevodovka posuvov ----------
    const gb = grp('prevodovka');
    box(gb, -9.9, -5.25, 2.5, 4.95, 1.5, 2.35, M.green);
    box(gb, -9.7, -8.4, 3.9, 4.7, 2.35, 2.37, M.white);
    [-7.8, -6.9, -6.0].forEach((x) => cylZ(gb, 0.22, 0.18, 2.35, 2.6, x, 3.4, M.black));
    detents(gb, -7.8, 3.4, 2.6, 0.15, FEED_ANG, 0.02); detents(gb, -6.9, 3.4, 2.6, 0.15, MULT_ANG, 0.025);
    const levF = pivotLever(gb, -7.8, 3.4, 2.6, 0.4, 1.3), levM = pivotLever(gb, -6.9, 3.4, 2.6, 0.4, 1.3);
    lever(gb, -6.0, 3.4, 2.6, 0.4, 1.3, 0);
    lever(gb, -9.3, 3.2, 2.35, 0.6, 1.2, 0.4);

    // ---------- vodiaca skrutka, ťažná tyč, spínacia tyč ----------
    const rods = grp('skrutky');
    const leadScrew = cylX(rods, 0.13, 0.13, -5.25, 11.3, 4.25, 1.78, M.lead, 20);
    const feedRod = cylX(rods, 0.1, 0.1, -5.25, 11.3, 3.8, 1.78, M.feed, 16);
    cylX(rods, 0.07, 0.07, -5.25, 11.3, 3.38, 1.78, M.steel, 12);

    // ---------- vreteno, skľučovadlo, obrobok ----------
    const spindle = grp('sklucovadlo'); spindle.position.set(0, AXIS_Y, 0);
    cylX(spindle, 1.0, 1.0, -4.85, -4.55, 0, 0, M.steelDark, 40);
    cylX(spindle, 1.35, 1.35, -4.55, -3.75, 0, 0, M.steel, 56);
    cylX(spindle, 1.37, 1.37, -4.5, -4.42, 0, 0, M.steelDark, 56);
    for (let i = 0; i < 3; i++) {
      const jg = new THREE.Group(); jg.rotation.x = i * TAU / 3; spindle.add(jg);
      box(jg, -3.75, -3.45, W_R0, 0.85, -0.16, 0.16, M.steelDark);
      box(jg, -3.75, -3.6, 0.85, 1.3, -0.16, 0.16, M.steelDark);
      const kg = new THREE.Group(); kg.rotation.x = i * TAU / 3 + Math.PI / 3; spindle.add(kg);
      add(kg, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), M.black, -4.15, 1.34, 0);
    }
    const prof = new Float32Array(W_N).fill(W_R0);
    const work = new THREE.Mesh(new THREE.BufferGeometry(), M.brass);
    work.castShadow = true; work.receiveShadow = true; work.position.x = W_X0; work.userData.part = 'obrobok';
    spindle.add(work); G.obrobok = work;
    const rebuildWork = () => {
      // body profilu s duplikátmi na hranách → ostré osadenia
      const pts = [new THREE.Vector2(0, 0)];
      let s = 0, first = true;
      for (let k = 1; k <= W_N; k++) {
        if (k === W_N || Math.abs(prof[k] - prof[s]) > 1e-4) {
          const r = prof[s], a = s * W_DX, b = k * W_DX;
          if (first) { pts.push(new THREE.Vector2(r, 0)); first = false; }
          pts.push(new THREE.Vector2(r, a), new THREE.Vector2(r, a), new THREE.Vector2(r, b), new THREE.Vector2(r, b));
          s = k;
        }
      }
      pts.push(new THREE.Vector2(0, W_N * W_DX));
      const geo = new THREE.LatheGeometry(pts, 56);
      geo.rotateZ(-Math.PI / 2);
      work.geometry.dispose(); work.geometry = geo;
    };
    rebuildWork();

    // ---------- koník ----------
    const tail = grp('konik');
    box(tail, 0, 2.4, 5.14, 5.75, -1.45, 1.45, M.green);
    box(tail, 0.15, 2.25, 5.75, 7.4, -0.95, 0.95, M.green);
    cylX(tail, 0.78, 0.78, 0, 2.35, AXIS_Y, 0, M.green, 40);
    cylX(tail, 0.82, 0.82, -0.02, 0.12, AXIS_Y, 0, M.greenDark, 40);
    const quill = new THREE.Group(); quill.position.set(0, AXIS_Y, 0); tail.add(quill);
    cylX(quill, 0.36, 0.36, 0, 2.2, 0, 0, M.steel, 32);
    cylX(quill, 0.3, 0.3, -0.25, 0, 0, 0, M.steelDark, 32);
    cylX(quill, 0, 0.22, -0.7, -0.25, 0, 0, M.steel, 32);
    cylX(tail, 0.2, 0.2, 2.35, 2.75, AXIS_Y, 0, M.steelDark, 20);
    const wheelT = handwheel(tail, 0.75, 2.8, AXIS_Y, 0, 'x', 0.5);
    lever(tail, 0.9, 8.22, 0, 0.7, 0, -0.6);
    lever(tail, 2.2, 5.5, 1.45, 0.8, 1.2, 0);

    // ---------- suport ----------
    const car = grp('suport');
    box(car, -1.4, 1.4, 5.14, 5.6, -1.9, 3.0, M.green);              // pozdĺžne sane
    box(car, -1.8, 1.8, 2.6, 5.14, 1.5, 2.15, M.green);              // zámková skriňa
    box(car, -0.75, 0.75, 5.6, 5.7, -1.9, 2.9, M.ways);              // rybinové vedenie
    box(car, -0.3, 0.3, 5.45, 6.05, 3.0, 3.15, M.green);
    cylZ(car, 0.08, 0.08, 3.0, 3.35, 0, 5.8, M.steel, 12);
    cylZ(car, 0.2, 0.2, 3.15, 3.3, 0, 5.8, M.steel, 28);             // nónius
    const wheelX = handwheel(car, 0.55, 0, 5.8, 3.4, 'z', 0.45);
    cylZ(car, 0.2, 0.2, 2.15, 2.35, -0.9, 3.9, M.steelDark, 20);
    const wheelZ = handwheel(car, 0.65, -0.9, 3.9, 2.4, 'z', 0.5);
    const levFeed = pivotLever(car, 0.9, 3.3, 2.15, 0.55, 1.2);       // páka automatického posuvu
    lever(car, 0.4, 4.4, 2.15, 0.5, 1.1, 0.5);
    box(car, 1.05, 1.65, 4.25, 4.85, 2.15, 2.35, M.yellow);
    const eStop = new THREE.Group(); eStop.position.set(1.35, 4.55, 2.35); car.add(eStop);   // núdzový STOP
    cylZ(eStop, 0.09, 0.09, 0, 0.07, 0, 0, M.steelDark, 16); cylZ(eStop, 0.2, 0.19, 0.07, 0.16, 0, 0, M.red, 24); hitProxy(eStop, 0.27, 0, 0, 0.1);
    cylY(car, 0.07, 0.07, 5.6, 9.85, 1.25, -1.75, M.steel, 12);       // rameno DRO
    cylZ(car, 0.06, 0.06, -1.75, -0.6, 1.25, 9.8, M.steel, 12);
    box(car, 0.55, 1.95, 9.45, 10.15, -0.6, -0.35, M.panel);
    const droCanvas = document.createElement('canvas'); droCanvas.width = 256; droCanvas.height = 112;
    const droTex = new THREE.CanvasTexture(droCanvas); droTex.encoding = THREE.sRGBEncoding;
    add(car, new THREE.PlaneGeometry(1.25, 0.55), new THREE.MeshBasicMaterial({ map: droTex, toneMapped: false }), 1.25, 9.8, -0.344);
    const drawDro = (x, z) => {
      const g = droCanvas.getContext('2d');
      g.fillStyle = '#071008'; g.fillRect(0, 0, 256, 112);
      g.fillStyle = '#ff5a3c'; g.font = 'bold 40px "Share Tech Mono", Consolas, monospace';
      g.fillText('X', 12, 48); g.fillText(x.toFixed(2).padStart(7, ' '), 64, 48);
      g.fillText('Z', 12, 98); g.fillText(z.toFixed(2).padStart(7, ' '), 64, 98);
      droTex.needsUpdate = true;
    };

    // ---------- priečne sane, nožová hlava, nôž ----------
    const cross = grp('priecny', car);
    box(cross, -0.9, 0.9, 5.7, 6.1, -0.35, 1.6, M.green);
    cylY(cross, 0.68, 0.68, 6.1, 6.22, 0.15, 0.95, M.greenDark, 40);
    box(cross, -0.6, 0.75, 6.22, 6.6, 0.25, 1.65, M.green);
    cylZ(cross, 0.06, 0.06, 1.65, 1.9, 0.1, 6.42, M.steel, 12);
    handwheel(cross, 0.3, 0.1, 6.42, 1.92, 'z', 0.25);
    box(cross, -0.3, 0.6, 6.6, 7.75, 0.55, 1.45, M.steelDark);
    cylY(cross, 0.075, 0.075, 7.75, 7.97, -0.2, 0.8, M.black, 12);
    cylY(cross, 0.075, 0.075, 7.75, 7.97, -0.2, 1.25, M.black, 12);
    cylY(cross, 0.1, 0.1, 7.75, 7.95, 0.25, 1.0, M.steel, 16);
    lever(cross, 0.25, 7.95, 1.0, 0.75, 0, 1.25);
    box(cross, -0.33, -0.08, 7.3, 7.47, 0.12, 1.5, M.steelDark);       // driek noža
    box(cross, -0.34, -0.08, 7.38, 7.47, -0.03, 0.2, M.steelDark);
    const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(0.3, 0.075); tri.lineTo(0.05, 0.3); tri.lineTo(0, 0);
    const insGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.06, bevelEnabled: false }); insGeo.rotateX(Math.PI / 2);
    add(cross, insGeo, M.insert, TIP_LX, AXIS_Y + 0.03, TIP_LZ);       // rezná doštička, hrot v (TIP_LX, AXIS_Y, TIP_LZ)

    // ---------- triesky ----------
    const chipGeo = new THREE.BoxGeometry(0.06, 0.015, 0.1);
    const chips = [];
    for (let i = 0; i < 140; i++) {
      const m = new THREE.Mesh(chipGeo, M.chip); m.visible = false; m.castShadow = true; scene.add(m);
      chips.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, rest: false });
    }
    let chipIdx = 0, chipAcc = 0;

    // ---------- stav simulácie ----------
    const st = {
      tipX: JAW_X + c.z / 100, r: c.x / 200, q: c.quill / 100, tail: JAW_X + c.tail / 100,
      rpm: 0, spin: 0, rodA: 0, cutting: false, cutT: -9, workEnd: W_X1, msg: null,
    };
    let t = 0, last = performance.now(), teleT = 0, workDirty = false, lastBuild = 0, lastAuto = c.autoFeed;
    const flags = {};
    const say = (text, kind = 'warn') => { st.msg = { text, kind, until: t + 2.4 }; };
    const sayOnce = (key, cond, text, kind) => { if (cond && !flags[key]) say(text, kind); flags[key] = cond; };

    const penetration = (tx, rr) => {
      let p = 0;
      const i0 = Math.max(0, Math.floor((tx - W_X0) / W_DX)), i1 = Math.min(W_N - 1, Math.floor((tx + 0.32 - W_X0) / W_DX));
      for (let i = i0; i <= i1; i++) {
        const xc = W_X0 + (i + 0.5) * W_DX;
        const d = prof[i] - (rr + Math.max(0, xc - tx) * 0.25);
        if (d > p) p = d;
      }
      return p;
    };
    const cut = (tx, rr) => {
      let removed = 0;
      const i0 = Math.max(0, Math.floor((tx - W_X0) / W_DX)), i1 = Math.min(W_N - 1, Math.floor((tx + 0.32 - W_X0) / W_DX));
      for (let i = i0; i <= i1; i++) {
        const xc = W_X0 + (i + 0.5) * W_DX;
        const lim = Math.max(0, rr + Math.max(0, xc - tx) * 0.25);
        if (prof[i] > lim + 1e-4) { removed += prof[i] - lim; prof[i] = lim; }
      }
      return removed;
    };
    const tailEngaged = () => (st.tail - st.q - 0.7) <= st.workEnd + 0.035;
    const checkPartOff = () => {
      const iJ = Math.ceil((JAW_X - W_X0) / W_DX);
      for (let i = iJ; i < W_N; i++) {
        if (prof[i] < 0.012) {
          let rest = false;
          for (let j = i + 1; j < W_N; j++) if (prof[j] > 0.012) { rest = true; break; }
          if (!rest || tailEngaged()) return;
          for (let j = i; j < W_N; j++) prof[j] = 0;
          workDirty = true; say('Obrobok bol odpichnutý – odrezaná časť odpadla.', 'info');
          return;
        }
      }
    };
    const spawnChip = () => {
      const ch = chips[chipIdx++ % chips.length];
      ch.m.position.set(st.tipX + 0.03, AXIS_Y + 0.04, st.r + 0.02);
      ch.v.set((Math.random() - 0.3) * 1.2, 1.2 + Math.random() * 2.2, 0.8 + Math.random() * 1.8);
      ch.w.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
      ch.life = 5 + Math.random() * 3; ch.rest = false; ch.m.visible = true;
    };

    // ---------- ovládanie kamery a výber dielov ----------
    const tween = { active: false };
    const orbit = createOrbit(camera, renderer.domElement, () => { tween.active = false; }, () => !c.manual);
    const viewFactor = () => clamp(1.65 / camera.aspect, 1, 2.3);
    const views = {
      celok: () => [[3.5, 12.5, 20], [1, 6, 0]],
      rez: () => [[st.tipX + 1.7, 12, st.r + 2.8], [st.tipX + 0.3, AXIS_Y, st.r * 0.5]],
      spredu: () => [[1, 7.2, 21], [1, 6, 0]],
      zhora: () => [[1, 25, 0.6], [1, 6, 0]],
      konik: () => [[st.tail + 4.8, 10.2, 6.5], [st.tail + 0.2, 7, 0]],
    };
    const goView = (name, instant) => {
      const [p, tg] = views[name]();
      const tt = new THREE.Vector3(...tg);
      const tp = new THREE.Vector3(...p).sub(tt).multiplyScalar(name === 'rez' || name === 'konik' ? 1 : viewFactor()).add(tt);
      if (instant) { camera.position.copy(tp); orbit.target.copy(tt); orbit.sync(); orbit.apply(); return; }
      Object.assign(tween, { active: true, t0: t, dur: 0.9, fp: camera.position.clone(), ft: orbit.target.clone(), tp, tt });
    };
    apiRef.current.view = (n) => goView(n, false);
    apiRef.current.resetWork = () => {
      prof.fill(W_R0); workDirty = true;
      if (penetration(st.tipX, st.r) > 0.001) { st.r = W_R0 + 0.15; c.x = st.r * 200; return c.x; }
      return null;
    };

    const ray = new THREE.Raycaster();
    let downAt = null;
    const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
    const onUp = (e) => {
      if (!downAt) return;
      if (ctlUsed) { downAt = null; return; }                         // klik na ovládací prvok nevyberá časť
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null;
      if (moved > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      let key = null;
      for (const h of ray.intersectObjects(root.children, true)) {
        let o = h.object; while (o && !o.userData.part) o = o.parent;
        if (o) { key = o.userData.part; break; }
      }
      apiRef.current.onPick(key);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    let hlKey = null, hlMeshes = [];
    const applyHL = (key) => {
      hlMeshes.forEach((m) => { m.material.dispose(); m.material = m.userData.om; });
      hlMeshes = []; hlKey = key;
      if (!key || !G[key]) return;
      G[key].traverse((o) => {
        if (!o.isMesh) return;
        let p = o; while (p && !p.userData.part) p = p.parent;
        if (!p || p.userData.part !== key) return;
        o.userData.om = o.material; const m2 = o.material.clone();
        if (m2.emissive) m2.emissive.setHex(0xff8a1f);
        o.material = m2; hlMeshes.push(o);
      });
      ctrls.forEach((k) => { k.glow = -1; });                           // vynúti obnovenie zvýraznenia prvkov
    };

    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const anchors = {
      lozko: () => v3(9.0, 5.3, 1.2),
      vretennik: () => v3(-7.2, 9.5, 0.6),
      sklucovadlo: () => v3(-4.15, AXIS_Y + 1.55, 0),
      obrobok: () => v3(Math.min(JAW_X + 1.0, st.workEnd - 0.2), AXIS_Y + 0.55, 0),
      suport: () => v3(st.tipX - TIP_LX - 1.3, 5.2, 2.2),
      priecny: () => v3(st.tipX - TIP_LX + 0.15, 8.1, st.r - TIP_LZ + 1.0),
      konik: () => v3(st.tail + 1.2, 8.5, 0),
      skrutky: () => v3(8.6, 4.3, 1.9),
      prevodovka: () => v3(-7.5, 5.0, 2.35),
      podstavec: () => v3(-7.6, 3.4, 1.95),
    };
    const labelEls = Array.from(layer.querySelectorAll('[data-part]'));

    // ---------- ručné ovládanie prvkov stroja ----------
    const dom = renderer.domElement;
    const ctrls = [], meshCtl = new Map(), pend = {};
    const push = (k, v) => { c[k] = v; pend[k] = v; };
    const regCtl = (k, obj) => {
      Object.assign(k, { pivot: obj, meshes: [], glow: 0, pressT: -9, pressed: false });
      obj.traverse((o) => { if (o.isMesh && !meshCtl.has(o)) { o.material = o.material.clone(); meshCtl.set(o, k); k.meshes.push(o); } });
      if (k.type === 'lever') { k.angle = k.angles[k.getIdx()]; obj.rotation.z = k.angle; }
      if (k.type === 'button') k.z0 = obj.position.z;
      ctrls.push(k);
    };
    const setGlow = (k, v) => k.meshes.forEach((m) => {
      const mat = m.material; if (!mat.emissive) return;
      if (v > 0) { mat.emissive.setHex(0x2f8bff); mat.emissiveIntensity = v; }
      else { mat.emissive.setHex(hlMeshes.includes(m) ? 0xff8a1f : 0x000000); mat.emissiveIntensity = 1; }
    });
    const logNear = (arr, v) => arr.reduce((bi, a, i) => (Math.abs(Math.log(a / v)) < Math.abs(Math.log(arr[bi] / v)) ? i : bi), 0);
    const spdIdx = () => logNear(SPEEDS, c.rpm);
    const feedSel = () => {
      let best = [0, 0], bd = Infinity;
      FEED_BASE.forEach((b, i) => FEED_MULT.forEach((m, j) => { const d = Math.abs(Math.log(b * m / c.feed)) + j * 1e-6; if (d < bd) { bd = d; best = [i, j]; } }));
      return best;
    };
    const gearGuard = () => {
      if (!c.running && st.rpm < 1) return true;
      say('Otáčky sa preraďujú len pri stojacom vretene – najprv ho zastav.', 'warn'); return false;
    };
    const setSpeed = (a, b) => { push('rpm', SPEEDS[a * 4 + b]); say(`Zaradené otáčky ${c.rpm} ot/min.`, 'info'); };
    const setFeed = (i, j) => { push('feed', Math.round(FEED_BASE[i] * FEED_MULT[j] * 100) / 100); say(`Posuv nastavený na ${c.feed.toFixed(2)} mm/ot.`, 'info'); };
    const zAct = () => (st.tipX - JAW_X) * 100;

    // ručné kolesá: turn(d) dostane pootočenie v radiánoch okolo osi kolesa
    regCtl({ type: 'wheel', minR: 0.45, inc: -1, label: 'Ručné koleso suportu (Z)', hint: 'Ťahaj za veniec alebo kľučku, alebo toč kolieskom myši. 1 otáčka = 30 mm.',
      guard: () => { if (!c.autoFeed) return true; say('Pri zaradenom automatickom posuve sa ručné koleso suportu netočí – vypni páku posuvu.', 'warn'); return false; },
      turn: (d) => { const a = zAct(); push('z', clamp(clamp(c.z - d * 30 / TAU, a - 20, a + 20), 10, 1150)); },
      read: () => `Z ${zAct().toFixed(1)} mm` }, wheelZ);
    regCtl({ type: 'wheel', minR: 0.38, inc: 1, label: 'Ručné koleso priečnych saní (X)', hint: 'V smere hodinových ručičiek ide nôž k osi. 1 otáčka = 10 mm na priemere.',
      turn: (d) => { const a = st.r * 200; push('x', clamp(clamp(c.x + d * 10 / TAU, a - 5, a + 5), 0, 260)); },
      read: () => `X Ø${(st.r * 200).toFixed(2)} mm` }, wheelX);
    regCtl({ type: 'wheel', minR: 0.5, inc: -1, label: 'Ručné koleso koníka – pinola', hint: 'V smere hodinových ručičiek sa pinola vysúva. 1 otáčka = 6 mm.',
      turn: (d) => { const a = st.q * 100; push('quill', clamp(clamp(c.quill - d * 6 / TAU, a - 5, a + 5), 0, 150)); },
      read: () => `pinola ${(st.q * 100).toFixed(1)} mm` }, wheelT);

    // páky s aretovanými polohami
    regCtl({ type: 'lever', angles: A_ANG, minR: 0.25, guard: gearGuard, label: 'Páka otáčok I (rozsah)', hint: 'Ťahaj do polohy alebo klikni. Preraďuje sa len pri stojacom vretene.',
      getIdx: () => Math.floor(spdIdx() / 4), onSet: (i) => setSpeed(i, spdIdx() % 4), read: () => `${c.rpm} ot/min` }, levA);
    regCtl({ type: 'lever', angles: B_ANG, minR: 0.25, guard: gearGuard, label: 'Páka otáčok II (stupeň)', hint: 'Ťahaj do polohy alebo klikni. Preraďuje sa len pri stojacom vretene.',
      getIdx: () => spdIdx() % 4, onSet: (i) => setSpeed(Math.floor(spdIdx() / 4), i), read: () => `${c.rpm} ot/min` }, levB);
    regCtl({ type: 'lever', angles: FEED_ANG, minR: 0.2, label: 'Páka posuvov (Norton)', hint: '8 základných posuvov 0,05 – 0,5 mm/ot.',
      getIdx: () => feedSel()[0], onSet: (i) => setFeed(i, feedSel()[1]), read: () => `${c.feed.toFixed(2)} mm/ot` }, levF);
    regCtl({ type: 'lever', angles: MULT_ANG, minR: 0.2, label: 'Páka násobiča posuvu', hint: 'Prepína násobok posuvu ×1 / ×2.',
      getIdx: () => feedSel()[1], onSet: (j) => setFeed(feedSel()[0], j), read: () => `×${FEED_MULT[feedSel()[1]]} · ${c.feed.toFixed(2)} mm/ot` }, levM);
    regCtl({ type: 'lever', angles: [0.35, -0.45], minR: 0.22, label: 'Páka automatického posuvu', hint: 'Dole = posuv zaradený, suport ide k skľučovadlu, keď sa točí vreteno.',
      getIdx: () => (c.autoFeed ? 1 : 0),
      onSet: (i) => { push('autoFeed', i === 1); if (i === 1 && !(c.running && c.power)) say('Posuv zaradený – suport sa pohne, keď sa roztočí vreteno.', 'info'); },
      read: () => (c.autoFeed ? 'zaradený' : 'vypnutý') }, levFeed);
    regCtl({ type: 'lever', angles: [0, -Math.PI / 2], minR: 0.25, label: 'Hlavný vypínač', hint: 'Otoč alebo klikni: 0 = vypnuté, I = zapnuté.',
      getIdx: () => (c.power ? 1 : 0),
      onSet: (i) => {
        push('power', i === 1);
        if (i === 0) { push('running', false); say('Hlavný vypínač vypnutý – stroj je bez napätia.', 'warn'); }
        else say('Hlavný vypínač zapnutý. Vreteno spustíš zeleným tlačidlom.', 'info');
      },
      read: () => (c.power ? 'I – zapnuté' : '0 – vypnuté') }, mainSwitch);

    // tlačidlá
    regCtl({ type: 'button', label: 'Tlačidlo ŠTART', hint: 'Spustí vreteno, ak je zapnutý hlavný vypínač.',
      action: () => { if (!c.power) say('Najprv zapni hlavný vypínač na vretenníku.', 'warn'); else push('running', true); } }, btnStart);
    regCtl({ type: 'button', label: 'Tlačidlo STOP', hint: 'Zastaví vreteno.', action: () => push('running', false) }, btnStop);
    regCtl({ type: 'button', label: 'Pracovné osvetlenie', hint: 'Zapne alebo vypne lampu.',
      action: () => { push('light', !c.light); say(c.light ? 'Pracovné osvetlenie zapnuté.' : 'Pracovné osvetlenie vypnuté.', 'info'); } }, btnLight);
    regCtl({ type: 'button', label: 'Núdzový STOP', hint: 'Okamžite zastaví vreteno aj automatický posuv.',
      action: () => { push('running', false); push('autoFeed', false); say('Núdzové zastavenie – vreteno aj posuv sú vypnuté.', 'danger'); } }, eStop);

    // koník sa posúva ťahaním za teleso (zvyšok skupiny koníka, okrem kolesa)
    regCtl({ type: 'slide', label: 'Koník', hint: 'Ťahaj teleso koníka po lôžku.', read: () => `${((st.tail - JAW_X) * 100).toFixed(0)} mm od čeľustí` }, tail);

    const ptr = { x: 0, y: 0, cx: 0, cy: 0, in: false, dirty: false };
    const drag = { ctl: null, id: null, x: 0, y: 0, moved: 0 };
    let hover = null, ctlUsed = false, introT = -9, prevManual = false, tipHtml = '', wheelAcc = 0;
    const ndc = new THREE.Vector2();
    const setRay = (cx, cy) => {
      const r = dom.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
    };
    const ctlAt = (cx, cy) => {
      setRay(cx, cy);
      const h = ray.intersectObjects(root.children, true)[0], k = h && meshCtl.get(h.object);
      return k ? { k, point: h.point } : null;
    };
    // otáčanie: pohyb myši sa premietne na dotyčnicu k obvodu v mieste uchopenia
    const rs = { axis: new THREE.Vector3(), C: new THREE.Vector3(), d: new THREE.Vector3() };
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), s0 = { x: 0, y: 0 }, s1 = { x: 0, y: 0 };
    const toScreen = (v, out) => { tmpA.copy(v).project(camera); out.x = (tmpA.x + 1) / 2 * mount.clientWidth; out.y = (1 - tmpA.y) / 2 * mount.clientHeight; };
    const beginRot = (k, point) => {
      k.pivot.updateMatrixWorld(true);
      rs.axis.set(0, 0, 1).transformDirection(k.pivot.matrixWorld);
      rs.C.setFromMatrixPosition(k.pivot.matrixWorld);
      rs.d.subVectors(point, rs.C).addScaledVector(rs.axis, -rs.d.dot(rs.axis));
      if (rs.d.length() < k.minR) {
        rs.d.subVectors(camera.position, rs.C).cross(rs.axis);
        if (rs.d.lengthSq() < 1e-8) rs.d.set(0, 1, 0).cross(rs.axis);
        rs.d.setLength(k.minR);
      }
    };
    const rotStep = (dx, dy) => {
      tmpB.copy(rs.C).add(rs.d); toScreen(tmpB, s0);
      tmpB.crossVectors(rs.axis, rs.d).multiplyScalar(0.02).add(rs.C).add(rs.d); toScreen(tmpB, s1);
      const sx = (s1.x - s0.x) / 0.02, sy = (s1.y - s0.y) / 0.02, s2 = sx * sx + sy * sy;
      if (s2 < 25) return 0;
      const a = clamp((dx * sx + dy * sy) / s2, -0.5, 0.5);
      rs.d.applyAxisAngle(rs.axis, a);
      return a;
    };
    const slidePlane = new THREE.Plane(), slideHit = new THREE.Vector3();
    let slideOff = 0;
    const beginSlide = (p) => {
      tmpB.subVectors(camera.position, p); tmpB.x = 0;
      if (tmpB.lengthSq() < 1e-4) tmpB.set(0, 1, 0);
      slidePlane.setFromNormalAndCoplanarPoint(tmpB.normalize(), p); slideOff = st.tail - p.x;
    };
    const moveSlide = (cx, cy) => {
      setRay(cx, cy);
      if (!ray.ray.intersectPlane(slidePlane, slideHit)) return;
      const a = (st.tail - JAW_X) * 100;
      push('tail', clamp(clamp((slideHit.x + slideOff - JAW_X) * 100, a - 40, a + 40), 350, 1245));
    };
    const leverStep = (k, i) => { i = clamp(i, 0, k.angles.length - 1); if (i !== k.getIdx()) k.onSet(i); };
    const nearestDetent = (k) => k.angles.reduce((bi, a, i) => (Math.abs(a - k.angle) < Math.abs(k.angles[bi] - k.angle) ? i : bi), 0);

    const trackPtr = (e) => {
      const r = dom.getBoundingClientRect();
      Object.assign(ptr, { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY, in: true, dirty: true });
    };
    const mDown = (e) => {
      ctlUsed = false;
      if (!c.manual) return;
      trackPtr(e);
      const h = ctlAt(e.clientX, e.clientY);
      if (!h) return;
      ctlUsed = true; hover = h.k;
      if (h.k.guard && !h.k.guard()) return;
      try { dom.setPointerCapture(e.pointerId); } catch (err) { /* ignorované */ }
      Object.assign(drag, { ctl: h.k, id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 });
      if (h.k.type === 'button') { h.k.pressed = true; h.k.pressT = t; h.k.action(); }
      else if (h.k.type === 'slide') beginSlide(h.point);
      else beginRot(h.k, h.point);
    };
    const mMove = (e) => {
      if (!c.manual) return;
      trackPtr(e);
      const k = drag.ctl;
      if (!k || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.hypot(dx, dy);
      if (k.type === 'slide') moveSlide(e.clientX, e.clientY);
      else if (k.type === 'wheel') { const a = rotStep(dx, dy); if (a) k.turn(a); }
      else if (k.type === 'lever') {
        const lo = Math.min(...k.angles), hi = Math.max(...k.angles);
        k.angle = clamp(k.angle + rotStep(dx, dy), lo - 0.08, hi + 0.08); k.pivot.rotation.z = k.angle;
      }
    };
    const mUp = (e) => {
      if (e.pointerType !== 'mouse') { ptr.in = false; if (!drag.ctl) hover = null; }
      const k = drag.ctl;
      if (!k || e.pointerId !== drag.id) return;
      drag.ctl = null; k.pressed = false;
      if (e.pointerType !== 'mouse') hover = null;
      if (k.type === 'lever') leverStep(k, drag.moved < 4 ? (k.getIdx() + 1) % k.angles.length : nearestDetent(k));
    };
    const mLeave = () => { ptr.in = false; if (!drag.ctl) hover = null; };
    const mWheel = (e) => {
      if (!c.manual) return;
      e.preventDefault();
      const h = ctlAt(e.clientX, e.clientY);
      if (!h || h.k.type === 'button') return;
      const k = h.k, amt = clamp(-e.deltaY * (e.deltaMode === 1 ? 33 : 1) / 100, -1, 1);
      if (k.guard && !k.guard()) return;
      if (k.type === 'wheel') { k.turn(amt * 0.4 * k.inc); return; }
      wheelAcc += amt;
      if (Math.abs(wheelAcc) < 1) return;
      const dir = Math.sign(wheelAcc); wheelAcc = 0;
      if (k.type === 'lever') leverStep(k, k.getIdx() + dir);
      else push('tail', clamp((st.tail - JAW_X) * 100 + dir * 10, 350, 1245));
    };
    dom.addEventListener('pointerdown', mDown); dom.addEventListener('pointermove', mMove);
    dom.addEventListener('pointerup', mUp); dom.addEventListener('pointercancel', mUp);
    dom.addEventListener('pointerleave', mLeave); dom.addEventListener('wheel', mWheel, { passive: false });

    const resize = () => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(mount); resize();
    goView('celok', true);

    // ---------- hlavná slučka ----------
    let raf;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;

      // hlavný chod
      st.rpm = approach(st.rpm, c.running && c.power ? c.rpm : 0, 1400 * dt);
      const running = st.rpm > 15;
      const revs = st.rpm > 0 ? 4.5 * st.rpm / (st.rpm + 500) : 0;     // vizuálne spomalené otáčanie
      st.spin += revs * TAU * dt; spindle.rotation.x = st.spin;
      st.rodA += revs * 0.35 * TAU * dt; leadScrew.rotation.x = st.rodA; feedRod.rotation.x = st.rodA * 1.6;

      let iEnd = W_N - 1; while (iEnd >= 0 && prof[iEnd] < 0.012) iEnd--;
      st.workEnd = iEnd >= 0 ? W_X0 + (iEnd + 1) * W_DX : JAW_X;

      // automatický pozdĺžny posuv (smerom k skľučovadlu)
      if (c.autoFeed && running) {
        const zAct = (st.tipX - JAW_X) * 100, zMin = (LIM.tipMin - JAW_X) * 100;
        c.z = Math.max(c.z - c.feed * st.rpm / 60 * c.timeScale * dt, zAct - 3, zMin);
        if (c.z <= zMin + 0.01 && zAct <= zMin + 0.05) { c.autoFeed = false; say('Automatický posuv vypnutý – suport dosiahol koncovú polohu pri skľučovadle.', 'info'); }
      }

      // pinola koníka
      const qT = clamp(c.quill / 100, 0, LIM.quillMax);
      let qMax = st.tail - 0.7 - (st.workEnd - 0.03), qWhy = 'work';
      if (st.r < LIM.quillClear) { const m2 = st.tail - 0.7 - (st.tipX + 0.05); if (m2 < qMax) { qMax = m2; qWhy = 'tool'; } }
      let nq = approach(st.q, qT, 0.8 * dt);
      if (nq > st.q && nq > qMax) nq = Math.max(st.q, qMax);
      sayOnce('quill', qT > qMax + 0.004 && nq >= qMax - 0.004, qWhy === 'tool' ? 'Pinola by narazila do noža.' : 'Hrot koníka dosadol do strediaceho otvoru – obrobok je podopretý.', qWhy === 'tool' ? 'warn' : 'info');
      wheelT.rotation.z -= (nq - st.q) / 0.06 * TAU; st.q = nq;

      // poloha koníka na lôžku
      const tT = clamp(JAW_X + c.tail / 100, -2, LIM.tailMax);
      let tMin = st.tipX + LIM.carToTail, tWhy = 'car';
      const m3 = st.workEnd - 0.03 + st.q + 0.7; if (m3 > tMin) { tMin = m3; tWhy = 'work'; }
      if (st.r < LIM.quillClear) { const m4 = st.tipX + 0.05 + st.q + 0.7; if (m4 > tMin) { tMin = m4; tWhy = 'tool'; } }
      let nt = approach(st.tail, tT, 2.2 * dt);
      if (nt < st.tail && nt < tMin) nt = Math.min(st.tail, tMin);
      sayOnce('tail', tT < tMin - 0.004 && nt <= tMin + 0.004, tWhy === 'car' ? 'Koník narazil na suport.' : tWhy === 'work' ? 'Hrot koníka dosadol na obrobok.' : 'Hrot koníka by narazil do noža.', tWhy === 'work' ? 'info' : 'warn');
      st.tail = nt;

      // suport (Z) a priečne sane (X)
      const zWant = JAW_X + c.z / 100, tipMax = st.tail - LIM.carToTail;
      const zT = clamp(zWant, LIM.tipMin, Math.max(LIM.tipMin, tipMax)), xT = clamp(c.x / 200, 0, LIM.rMax);
      const vz = st.cutting ? 0.35 : 2.6, vx = st.cutting ? 0.22 : 0.75;
      let nx = approach(st.tipX, zT, vz * dt), nr = approach(st.r, xT, vx * dt);
      sayOnce('cartail', zWant > tipMax + 0.004 && st.tipX >= tipMax - 0.003, 'Suport narazil na koník – koncový doraz.', 'warn');
      let blocked = null;
      if (nx !== st.tipX || nr !== st.r) {
        const qTip = st.tail - st.q - 0.7;
        const pen0 = running ? 0 : penetration(st.tipX, st.r);
        let why = null;
        const ok = (tx, rr) => {
          if (rr < LIM.quillClear && tx > qTip - 0.05) { why = 'quill'; return false; }
          if (!running && penetration(tx, rr) > Math.max(0.002, pen0 + 1e-5)) { why = 'work'; return false; }
          return true;
        };
        if (!ok(nx, nr)) {
          blocked = why;
          if (ok(st.tipX, nr)) nx = st.tipX; else if (ok(nx, st.r)) nr = st.r; else { nx = st.tipX; nr = st.r; }
        }
      }
      sayOnce('toolwork', blocked === 'work', 'Nôž narazil na obrobok. Pri stojacom vretene nemôže rezať – spusti hlavný chod.', 'danger');
      sayOnce('toolquill', blocked === 'quill', 'Nôž by narazil do hrotu koníka.', 'warn');
      wheelZ.rotation.z -= (nx - st.tipX) / 0.3 * TAU;
      wheelX.rotation.z += (nr - st.r) / 0.05 * TAU;
      st.tipX = nx; st.r = nr;

      // rezanie
      if (running) {
        const removed = cut(st.tipX, st.r);
        if (removed > 0) {
          st.cutT = t; workDirty = true; checkPartOff();
          chipAcc += dt * 45; while (chipAcc >= 1) { spawnChip(); chipAcc -= 1; }
        }
      }
      st.cutting = t - st.cutT < 0.25;
      if (workDirty && t - lastBuild > 0.06) { rebuildWork(); workDirty = false; lastBuild = t; }

      // pohyb skupín
      car.position.x = st.tipX - TIP_LX;
      cross.position.z = st.r - TIP_LZ;
      tail.position.x = st.tail;
      quill.position.x = -st.q;
      M.lamp.emissive.setHex(c.running && c.power ? 0x22dd55 : c.power ? 0x8a5a00 : 0x000000);
      spot.intensity = c.light ? 1.1 : 0; M.bulb.emissiveIntensity = c.light ? 1.4 : 0.03;
      spot.target.position.set(st.tipX, AXIS_Y, 0);

      // ručné ovládanie: polohy pák a tlačidiel, zvýraznenie, popis pod kurzorom
      if (c.manual !== prevManual) {
        prevManual = c.manual;
        if (c.manual) introT = t; else { drag.ctl = null; hover = null; }
        tipEl.style.display = 'none'; tipHtml = ''; dom.style.cursor = '';
      }
      if (c.manual && ptr.dirty && ptr.in && !drag.ctl) { ptr.dirty = false; const h = ctlAt(ptr.cx, ptr.cy); hover = h ? h.k : null; }
      const intro = c.manual && t - introT < 1.8 ? 0.3 + 0.3 * Math.sin((t - introT) * 10) : 0;
      for (const k of ctrls) {
        if (k.type === 'lever' && k !== drag.ctl) { k.angle = approach(k.angle, k.angles[k.getIdx()], 5 * dt); k.pivot.rotation.z = k.angle; }
        if (k.type === 'button') k.pivot.position.z = approach(k.pivot.position.z, k.z0 - (k.pressed || t - k.pressT < 0.18 ? 0.05 : 0), 0.8 * dt);
        const g = !c.manual ? 0 : k === drag.ctl ? 0.9 : k === hover ? 0.6 : intro;
        if (g !== k.glow) { setGlow(k, g); k.glow = g; }
      }
      if (c.manual) {
        const k = drag.ctl || (ptr.in ? hover : null);
        const cur = drag.ctl ? (k.type === 'button' ? 'pointer' : 'grabbing') : k ? (k.type === 'button' ? 'pointer' : 'grab') : 'default';
        if (dom.style.cursor !== cur) dom.style.cursor = cur;
        const html = k ? `<b>${k.label}</b>${k.read ? ` · ${k.read()}` : ''}<span>${k.hint}</span>` : '';
        if (html !== tipHtml) { tipHtml = html; tipEl.innerHTML = html; tipEl.style.display = html ? 'block' : 'none'; }
        if (html) {
          const fx = ptr.x > mount.clientWidth - 270, fy = ptr.y > mount.clientHeight - 90;
          tipEl.style.transform = `translate(${ptr.x + (fx ? -16 : 16)}px, ${ptr.y + (fy ? -14 : 18)}px) translate(${fx ? '-100%' : '0'}, ${fy ? '-100%' : '0'})`;
        }
      }

      for (const ch of chips) {
        if (ch.life <= 0) continue;
        ch.life -= dt;
        if (ch.life <= 0) { ch.m.visible = false; continue; }
        if (ch.rest) continue;
        ch.v.y -= 14 * dt; ch.m.position.addScaledVector(ch.v, dt);
        ch.m.rotation.x += ch.w.x * dt; ch.m.rotation.y += ch.w.y * dt; ch.m.rotation.z += ch.w.z * dt;
        const p = ch.m.position;
        let fy = 0.02;
        if (p.x > -5.2 && p.x < 9.6 && p.z > -2 && p.z < 2.7) fy = 1.57;
        if (p.x > -5.2 && p.x < 12 && Math.abs(p.z) < 1.5) fy = 5.16;
        if (p.y <= fy) { p.y = fy; ch.rest = true; }
      }

      if (c.highlight !== hlKey) applyHL(c.highlight);
      if (hlMeshes.length) { const k = 0.3 + 0.22 * Math.sin(t * 5); hlMeshes.forEach((m) => { if (m.material.emissive) m.material.emissiveIntensity = k; }); }

      if (tween.active) {
        const k = Math.min(1, (t - tween.t0) / tween.dur), e = k * k * (3 - 2 * k);
        camera.position.lerpVectors(tween.fp, tween.tp, e); orbit.target.lerpVectors(tween.ft, tween.tt, e); camera.lookAt(orbit.target);
        if (k >= 1) { tween.active = false; orbit.sync(); }
      }

      if (c.labels) {
        const w = mount.clientWidth, h = mount.clientHeight;
        for (const el of labelEls) {
          const v = anchors[el.dataset.part]().project(camera);
          if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; continue; }
          el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -130%)`;
          el.style.opacity = '1'; el.style.pointerEvents = 'auto';
        }
      }

      if (t - teleT > 0.1) {
        teleT = t;
        const zmm = (st.tipX - JAW_X) * 100, dmm = st.r * 200;
        const iTool = clamp(Math.floor((st.tipX - W_X0) / W_DX), 0, W_N - 1);
        setTele({
          rpm: st.rpm, z: zmm, x: dmm, quill: st.q * 100, tail: (st.tail - JAW_X) * 100,
          vc: Math.PI * dmm * st.rpm / 1000, cutting: st.cutting && running, engaged: tailEngaged(),
          msg: st.msg && st.msg.until > t ? st.msg : null, workD: prof[iTool] * 200,
        });
        if (c.autoFeed) pend.z = Math.round(c.z * 10) / 10;
        if (lastAuto !== c.autoFeed) pend.autoFeed = c.autoFeed;
        lastAuto = c.autoFeed;
        if (Object.keys(pend).length) {
          const p = { ...pend }; Object.keys(pend).forEach((k) => delete pend[k]);
          setUi((u) => ({ ...u, ...p }));
        }
        drawDro(dmm, zmm);
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); mq.removeEventListener('change', applyTheme); mo.disconnect();
      orbit.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointerdown', mDown); dom.removeEventListener('pointermove', mMove);
      dom.removeEventListener('pointerup', mUp); dom.removeEventListener('pointercancel', mUp);
      dom.removeEventListener('pointerleave', mLeave); dom.removeEventListener('wheel', mWheel);
      envRT.dispose(); pmrem.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  const statusMsg = tele.msg
    ? tele.msg
    : tele.cutting ? { kind: 'run', text: `Nôž v reze – Ø${tele.workD.toFixed(1)} mm, vc ${tele.vc.toFixed(0)} m/min` }
    : tele.rpm > 15 ? { kind: 'run', text: 'Vreteno beží. Prisuň nôž k obrobku posuvom X.' }
    : !ui.power ? { kind: 'warn', text: 'Hlavný vypínač je vypnutý – stroj je bez napätia.' }
    : { kind: 'idle', text: 'Stroj stojí. Spusti hlavný chod, potom nastav nôž.' };
  const sel = PARTS.find((p) => p.key === selected);
  const running = ui.running;

  return (
    <div className="lathe-app w-full flex flex-col md:flex-row">
      <style>{CSS}</style>
      <div className="scene-wrap relative flex-1 overflow-hidden">
        <div ref={mountRef} className="absolute inset-0" />
        <div ref={layerRef} className={`absolute inset-0 pointer-events-none overflow-hidden ${ui.labels && !ui.manual ? '' : 'hidden'}`}>
          {PARTS.map((p) => (
            <button key={p.key} type="button" data-part={p.key} onClick={() => selectPart(p.key)}
              className={`part-label ${selected === p.key ? 'is-active' : ''}`}>{p.short}</button>
          ))}
        </div>
        {ui.manual && <div className="manual-frame" />}
        <div ref={tipRef} className="ctl-tip" />
        <div className="absolute right-3 top-3">
          <div className="mode-seg" role="group" aria-label="Režim ovládania">
            <button type="button" className={ui.manual ? '' : 'on'} aria-pressed={!ui.manual} onClick={() => set('manual', false)} title="Ovládanie pohľadu (M)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg>
              Kamera
            </button>
            <button type="button" className={ui.manual ? 'on' : ''} aria-pressed={ui.manual} onClick={() => set('manual', true)} title="Ručné ovládanie prvkov stroja (M)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v8M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 15.5L3 12a1.5 1.5 0 0 1 2.7-1.2L8 14" /></svg>
              <span className="hidden lg:inline">Ručné ovládanie</span><span className="lg:hidden">Ručne</span>
            </button>
          </div>
        </div>
        <div className="absolute left-3 top-3 flex flex-wrap gap-2 pointer-events-none" style={{ maxWidth: 'calc(100% - 215px)' }}>
          <span className="chip"><span className="lamp" style={{ color: tele.rpm > 15 ? '#3ee06c' : '#8b8f89' }} />{tele.rpm > 15 ? `${Math.round(tele.rpm)} ot/min` : 'Vreteno stojí'}</span>
          {tele.cutting && <span className="chip"><span className="lamp" style={{ color: '#ffb340' }} />Rez</span>}
          {tele.engaged && <span className="chip"><span className="lamp" style={{ color: '#7fb6ff' }} />Podopreté hrotom</span>}
        </div>
        {ui.manual ? (
          <div className="absolute left-3 right-3 bottom-3 md:right-auto hint pointer-events-none" style={{ maxWidth: 520 }}>
            <b className="ink">Ručné ovládanie:</b> ťahaj ručné kolesá a páky, klikaj na tlačidlá a vypínač, koliesko myši točí prvkom pod kurzorom. Pohľad je zamknutý – kameru vráti <b className="ink">M</b> alebo Esc.
          </div>
        ) : (
          <div className="absolute left-3 bottom-3 hint hidden md:block pointer-events-none">
            Ťahaj: otáčanie · koliesko: zoom · pravé tlačidlo: posun · klik: výber časti · M: ručné ovládanie
          </div>
        )}
      </div>

      <aside className="panel">
        <div className="sec">
          <p className="sec-title" style={{ letterSpacing: '.12em' }}>Simulátor · hrotový sústruh</p>
          <h1 className="app-title mt-1">Konvenčný hrotový sústruh</h1>
          <p className="text-xs muted mt-1">Model v štýle strojov TOS SN a VDF. Mierka 1 : 100 mm, obrobok mosadz Ø90 mm.</p>
          <div className="dro mt-3 tnum">
            <div className="dro-row"><span>X Ø</span><b>{tele.x.toFixed(2)}</b></div>
            <div className="dro-row"><span>Z</span><b>{tele.z.toFixed(2)}</b></div>
            <div className="dro-sub"><span>n {Math.round(tele.rpm)} ot/min</span><span>vc {tele.vc.toFixed(0)} m/min</span></div>
          </div>
          <div className={`msg msg-${statusMsg.kind}`} role="status"><span className="lamp" />{statusMsg.text}</div>
        </div>

        <div className="sec">
          <h3 className="sec-title mb-2">Ručné ovládanie stroja</h3>
          <Toggle on={ui.manual} label="Zamknúť pohľad a ovládať prvky myšou (M)" onClick={() => set('manual', !ui.manual)} />
          <ul className="ctl-list">
            <li><b>Ručné kolesá</b> suportu (Z), priečnych saní (X) a koníka (pinola) – ťahaj za veniec alebo toč kolieskom myši.</li>
            <li><b>Páky otáčok</b> na vretenníku – 3 × 4 = 12 stupňov, preraďovať len pri stojacom vretene.</li>
            <li><b>Páky prevodovky posuvov</b> – 0,05 až 1,0 mm/ot, a <b>páka automatického posuvu</b> na suporte.</li>
            <li><b>Hlavný vypínač</b> a tlačidlá <b>Štart</b> (zelené), <b>Stop</b> (červené), <b>osvetlenie</b> (modré).</li>
            <li><b>Núdzový STOP</b> na suporte a <b>koník</b>, ktorý posunieš ťahaním za teleso.</li>
          </ul>
        </div>

        <div className="sec">
          <h3 className="sec-title mb-2">Hlavný chod</h3>
          <button type="button" className={`btn-run ${running ? 'stop' : 'start'}`}
            onClick={() => { if (!running && !ui.power) set('power', true); set('running', !running); }}>
            {running ? '■ Stop vretena' : '▶ Štart vretena'}
          </button>
          <div className="mt-2">
            <Toggle on={ui.power} label="Hlavný vypínač" onClick={() => { const v = !ui.power; set('power', v); if (!v) set('running', false); }} />
            <Toggle on={ui.light} label="Pracovné osvetlenie" onClick={() => set('light', !ui.light)} />
          </div>
          <div className="mt-3">
            <Slider id="rpm" label="Otáčky vretena" unit="ot/min" min={40} max={2000} step={10} value={ui.rpm} onChange={(v) => set('rpm', v)} />
          </div>
        </div>

        <div className="sec">
          <h3 className="sec-title mb-2">Posuvy suportu</h3>
          <Slider id="z" label="Pozdĺžny posuv Z (od čeľustí)" unit="mm" min={10} max={1150} step={1} value={ui.z} actual={tele.z} onChange={(v) => set('z', v)} />
          <Slider id="x" label="Priečny posuv X (priemer)" unit="mm" min={0} max={260} step={0.5} value={ui.x} actual={tele.x} digits={1} onChange={(v) => set('x', v)} />
          <Toggle on={ui.autoFeed} label="Automatický pozdĺžny posuv k skľučovadlu" onClick={() => set('autoFeed', !ui.autoFeed)} />
          <div className="mt-2">
            <Slider id="feed" label="Posuv na otáčku" unit="mm/ot" min={0.05} max={1} step={0.01} value={ui.feed} digits={2} onChange={(v) => set('feed', v)} />
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Zrýchlenie posuvu</span>
              <div className="seg" role="group" aria-label="Zrýchlenie posuvu">
                {[1, 10, 50].map((k) => (
                  <button key={k} type="button" className={ui.timeScale === k ? 'on' : ''} onClick={() => set('timeScale', k)}>{k}×</button>
                ))}
              </div>
            </div>
            <p className="text-xs muted mt-2">Automatický posuv beží len pri otáčajúcom sa vretene, rýchlosťou posuv × otáčky.</p>
          </div>
        </div>

        <div className="sec">
          <h3 className="sec-title mb-2">Koník</h3>
          <Slider id="quill" label="Výsuv pinoly" unit="mm" min={0} max={150} step={1} value={ui.quill} actual={tele.quill} onChange={(v) => set('quill', v)} />
          <Slider id="tail" label="Poloha koníka na lôžku" unit="mm" min={350} max={1245} step={1} value={ui.tail} actual={tele.tail} onChange={(v) => set('tail', v)} />
        </div>

        <div className="sec">
          <h3 className="sec-title mb-2">Pohľad</h3>
          <div className="flex flex-wrap gap-2">
            {[['celok', 'Celok'], ['rez', 'Detail rezu'], ['spredu', 'Spredu'], ['zhora', 'Zhora'], ['konik', 'Koník']].map(([k, l]) => (
              <button key={k} type="button" className="btn" onClick={() => apiRef.current.view && apiRef.current.view(k)}>{l}</button>
            ))}
          </div>
          <div className="mt-3">
            <Toggle on={ui.labels} label="Popisy častí v modeli" onClick={() => set('labels', !ui.labels)} />
          </div>
          <button type="button" className="btn mt-2 w-full" onClick={() => { const r = apiRef.current.resetWork && apiRef.current.resetWork(); if (r != null) set('x', r); }}>
            Vložiť nový obrobok Ø90 mm
          </button>
        </div>

        <div className="sec">
          <div className="flex items-center justify-between mb-2">
            <h3 className="sec-title">Časti stroja</h3>
            {selected && <button type="button" className="text-xs muted underline" onClick={() => selectPart(selected)}>Zrušiť výber</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {PARTS.map((p) => (
              <button key={p.key} type="button" className={`part-btn ${selected === p.key ? 'active' : ''}`} onClick={() => selectPart(p.key)}>{p.short}</button>
            ))}
          </div>
          <div className="desc">
            {sel ? (<><div className="font-semibold mb-1">{sel.name}</div><div>{sel.desc}</div></>)
              : <span className="muted">Vyber časť zo zoznamu alebo klikni na ňu v modeli – zvýrazní sa a zobrazí sa jej popis.</span>}
          </div>
        </div>

        <div className="sec text-xs muted" style={{ borderBottom: 0 }}>
          Ovládanie: ťahaním myšou otáčaš pohľad, koliesko približuje, pravým tlačidlom (alebo Shift) posúvaš. Na dotykovej obrazovke sa pohľad otáča jedným prstom a približuje dvoma. Kláves M (alebo prepínač vpravo hore v scéne) zamkne pohľad a prepne na ručné ovládanie prvkov stroja.
        </div>
      </aside>
    </div>
  );
}

export default LatheSimulator;
