// Kamera (orbit) a spoločná scéna: renderer, prostredie, svetlá, podlaha.
import * as THREE from 'three';

// Farby sa v kóde prevádzajú do lineárneho priestoru ručne (convertSRGBToLinear) – automatický prevod
// three.js (od r152) by ich previedol druhýkrát, preto zostáva vypnutý ako v r128.
THREE.ColorManagement.enabled = false;
// Fyzikálne osvetlenie (od r155) nemá násobok π, ktorý mal pôvodný režim – intenzity sa preto násobia LIGHT_K.
const LIGHT_K = Math.PI;
import { clamp } from './util';

// ---------- ovládanie kamery ----------
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
    target.y = clamp(target.y, 0, 16);
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

// ---------- spoločná scéna: renderer, prostredie, svetlá, podlaha ----------
function createStage(mount) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.display = 'block';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  let forceNext = true;                          // vynútené prekreslenie (zmena veľkosti, vzhľadu)
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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3f4a3d, 0.35 * LIGHT_K));
  const sun = new THREE.DirectionalLight(0xffffff, 1.25 * LIGHT_K);
  sun.position.set(-8, 20, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35 * LIGHT_K); fill.position.set(12, 8, -10); scene.add(fill);

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
    forceNext = true;
  };
  applyTheme();
  const mo = new MutationObserver(applyTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-skin'] });

  const resize = () => {
    const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(() => { resize(); forceNext = true; }); ro.observe(mount); resize();

  // ---------- vykresľovanie len pri zmene ----------
  // Simulácia beží v každom snímku, scéna sa však prekreslí len vtedy, keď sa v nej niečo zmenilo
  // (poloha, viditeľnosť, farba, jas, geometria, textúra), keď sa pohne kamera alebo keď používateľ
  // pracuje myšou či klávesnicou. Inak sa obnoví 4× za sekundu ako poistka. Tiene sa prepočítajú
  // len pri zmene scény – samotný pohyb kamery ich nemení.
  const IDLE_MS = 250, WAKE_MS = 600;
  let wakeUntil = 0, lastDraw = -1e9, lastScene = NaN, lastCam = NaN;
  const wake = () => { wakeUntil = performance.now() + WAKE_MS; };
  const INPUT = ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'input', 'change'];
  INPUT.forEach((ev) => window.addEventListener(ev, wake, { capture: true, passive: true }));
  const sceneSig = () => {
    let a = 0, b = 0, n = 0;
    const add = (v) => { n++; a += v * ((n % 89) + 1); b += v * ((n % 61) + 7); };
    scene.traverseVisible((o) => {
      add(o.id);
      const e = o.matrixWorld.elements; for (let i = 0; i < 16; i++) add(e[i]);
      if (o.isLight) add(o.intensity);
      if (o.isInstancedMesh) { add(o.count); add(o.instanceMatrix.version); }
      const g = o.geometry;
      if (g) { add(g.id); for (const k in g.attributes) add(g.attributes[k].version); }
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
      if (ms) for (const m of ms) {
        add(m.id); add(m.opacity);
        if (m.color) { add(m.color.r); add(m.color.g); add(m.color.b); }
        if (m.emissive) { add(m.emissive.r); add(m.emissive.g); add(m.emissive.b); add(m.emissiveIntensity); }
        if (m.map) add(m.map.version);
      }
    });
    if (scene.background && scene.background.isColor) { add(scene.background.r); add(scene.background.g); add(scene.background.b); }
    return a * 1.000001 + b;
  };
  const camSig = (c) => { let a = 0; const e = c.matrixWorld.elements, p = c.projectionMatrix.elements; for (let i = 0; i < 16; i++) a += e[i] * (i + 1) + p[i] * (i + 17); return a; };
  const rawRender = renderer.render.bind(renderer);
  scene.matrixWorldAutoUpdate = false;           // matice sa aktualizujú tu, raz za snímok
  renderer.shadowMap.autoUpdate = false;
  renderer.render = (s, c) => {
    if (s !== scene) { rawRender(s, c); return; }
    scene.updateMatrixWorld(); c.updateMatrixWorld();
    const now = performance.now(), ss = sceneSig(), cs = camSig(c);
    const sceneChanged = forceNext || ss !== lastScene;
    if (!sceneChanged && cs === lastCam && now > wakeUntil && now - lastDraw < IDLE_MS) return;
    if (sceneChanged) renderer.shadowMap.needsUpdate = true;
    lastScene = ss; lastCam = cs; lastDraw = now; forceNext = false;
    rawRender(s, c);
    drawCount++;
  };
  let drawCount = 0;
  const stats = () => ({ draws: drawCount });

  const dispose = () => {
    ro.disconnect(); mo.disconnect();
    INPUT.forEach((ev) => window.removeEventListener(ev, wake, { capture: true }));
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    envRT.dispose(); pmrem.dispose(); renderer.dispose();
    try { renderer.forceContextLoss(); } catch (err) { /* ignorované */ }
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  };
  try { if (/[?&]debug/.test(window.location.search)) window.__stage = { stats }; } catch (err) { /* ignorované */ }
  return { renderer, scene, camera, dispose, stats };
}

export { LIGHT_K, createOrbit, createStage };
