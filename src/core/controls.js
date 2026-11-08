// Ručné ovládanie prvkov stroja (kolesá, páky, tlačidlá, posuvné diely).
import * as THREE from 'three';
import { approach, clamp } from './util';

// ---------- ručné ovládanie prvkov stroja (kolesá, páky, tlačidlá, posuvné diely) ----------
function createControls({ dom, mount, camera, root, tipEl, c, getT, getHL }) {
  const ray = new THREE.Raycaster();
  const ctrls = [], meshCtl = new Map(), pend = {};
  const push = (k, v) => { c[k] = v; pend[k] = v; };
  const reg = (k, obj) => {
    Object.assign(k, { pivot: obj, meshes: [], glow: 0, pressT: -9, pressed: false });
    // diely jedného ovládača s rovnakým materiálom zdieľajú jednu kópiu (svietenie je pre celý ovládač rovnaké),
    // takže sa ich siete dajú zlúčiť (core/sceneOptimize)
    const clones = new Map();
    obj.traverse((o) => {
      if (!o.isMesh || meshCtl.has(o)) return;
      if (!clones.has(o.material)) clones.set(o.material, o.material.clone());
      o.material = clones.get(o.material); meshCtl.set(o, k); k.meshes.push(o);
    });
    if (k.type === 'lever') { k.angle = k.angles[k.getIdx()]; obj.rotation.z = k.angle; }
    if (k.type === 'button') k.z0 = obj.position[k.pressAxis || 'z'];
    ctrls.push(k);
  };
  const setGlow = (k, v) => k.meshes.forEach((m) => {
    const mat = m.material; if (!mat.emissive) return;
    if (v > 0) { mat.emissive.setHex(0x2f8bff); mat.emissiveIntensity = v; }
    else { mat.emissive.setHex(getHL().includes(m) ? 0xff8a1f : 0x000000); mat.emissiveIntensity = 1; }
  });

  const ptr = { x: 0, y: 0, cx: 0, cy: 0, in: false, dirty: false };
  const drag = { ctl: null, id: null, x: 0, y: 0, moved: 0 };
  let hover = null, ctlUsed = false, introT = -9, prevManual = false, tipHtml = '', wheelAcc = 0;
  const ndc = new THREE.Vector2();
  const setRay = (cx, cy) => {
    const r = dom.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
  };
  const pickAt = (cx, cy) => {
    setRay(cx, cy);
    root.updateMatrixWorld(true);
    return ray.intersectObjects(root.children, true).find((h) => {
      if (h.object.userData.controlPassThrough) return false;
      for (let o=h.object;o;o=o.parent) if (!o.visible) return false;
      return true;
    }) || null;
  };
  const ctlAt = (cx, cy) => {
    // zlúčená sieť (sceneOptimize) patrí ovládaču svojich pôvodných sietí
    const h = pickAt(cx,cy), k=h && meshCtl.get(h.object.userData.mergedFrom?.[0] || h.object);
    return k ? { k, point:h.point } : null;
  };
  // otáčanie: pohyb myši sa premietne na dotyčnicu k obvodu v mieste uchopenia
  const rs = { axis: new THREE.Vector3(), C: new THREE.Vector3(), d: new THREE.Vector3() };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), s0 = { x: 0, y: 0 }, s1 = { x: 0, y: 0 };
  const toScreen = (v, out) => { tmpA.copy(v).project(camera); out.x = (tmpA.x + 1) / 2 * mount.clientWidth; out.y = (1 - tmpA.y) / 2 * mount.clientHeight; };
  const beginRot = (k, point) => {
    k.pivot.updateMatrixWorld(true);
    rs.axis.set(0,0,0); rs.axis[k.axis || 'z']=1; rs.axis.transformDirection(k.pivot.matrixWorld);
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
  // posúvanie dielu po osi X (predvolene) alebo Z scény
  const slidePlane = new THREE.Plane(), slideHit = new THREE.Vector3();
  let slideX0 = 0;
  const beginSlide = (k, p) => {
    const ax = k.axis || 'x';
    tmpB.subVectors(camera.position, p); tmpB[ax] = 0;
    if (tmpB.lengthSq() < 1e-4) tmpB.set(0, 1, 0);
    slidePlane.setFromNormalAndCoplanarPoint(tmpB.normalize(), p); slideX0 = p[ax]; k.start();
  };
  const moveSlide = (k, cx, cy) => { setRay(cx, cy); if (ray.ray.intersectPlane(slidePlane, slideHit)) k.slide(slideHit[k.axis || 'x'] - slideX0); };
  const leverStep = (k, i) => { i = clamp(i, 0, k.angles.length - 1); if (i !== k.getIdx()) k.onSet(i); };
  const nearestDetent = (k) => k.angles.reduce((bi, a, i) => (Math.abs(a - k.angle) < Math.abs(k.angles[bi] - k.angle) ? i : bi), 0);

  const trackPtr = (e) => {
    const r = dom.getBoundingClientRect();
    Object.assign(ptr, { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY, in: true, dirty: true });
  };
  const mDown = (e) => {
    ctlUsed = false;
    if (!c.manual || c.unclamped) return;
    trackPtr(e);
    const h = ctlAt(e.clientX, e.clientY);
    if (!h) return;
    ctlUsed = true; hover = h.k;
    if (h.k.guard && !h.k.guard()) return;
    try { dom.setPointerCapture(e.pointerId); } catch (err) { /* ignorované */ }
    Object.assign(drag, { ctl: h.k, id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 });
    if (h.k.type === 'button') { h.k.pressed = true; h.k.pressT = getT(); h.k.action(); }
    else if (h.k.type === 'slide') beginSlide(h.k, h.point);
    else beginRot(h.k, h.point);
  };
  const mMove = (e) => {
    if (!c.manual || c.unclamped) return;
    trackPtr(e);
    const k = drag.ctl;
    if (!k || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.hypot(dx, dy);
    if (k.type === 'slide') moveSlide(k, e.clientX, e.clientY);
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
    if (k.type === 'slide') {
      const cancelled=e.type==='pointercancel';
      if (!cancelled && drag.moved<4) k.click?.();
      k.end?.({cancelled,click:!cancelled&&drag.moved<4});
    }
    if (k.type === 'lever') leverStep(k, drag.moved < 4 ? (k.getIdx() + 1) % k.angles.length : nearestDetent(k));
  };
  const mLeave = () => { ptr.in = false; if (!drag.ctl) hover = null; };
  const mWheel = (e) => {
    if (!c.manual || c.unclamped) return;
    e.preventDefault();
    const h = ctlAt(e.clientX, e.clientY);
    if (!h || h.k.type === 'button') return;
    const k = h.k, amt = clamp(-e.deltaY * (e.deltaMode === 1 ? 33 : 1) / 100, -1, 1);
    if (k.guard && !k.guard()) return;
    if (k.type === 'wheel') { k.turn(amt * 0.4 * k.inc); return; }
    wheelAcc += amt;
    if (Math.abs(wheelAcc) < 1) return;
    const dir = Math.sign(wheelAcc); wheelAcc = 0;
    if (k.type === 'lever') leverStep(k, k.getIdx() + dir); else k.nudge(dir);
  };
  dom.addEventListener('pointerdown', mDown); dom.addEventListener('pointermove', mMove);
  dom.addEventListener('pointerup', mUp); dom.addEventListener('pointercancel', mUp);
  dom.addEventListener('pointerleave', mLeave); dom.addEventListener('wheel', mWheel, { passive: false });

  // za snímku: polohy pák a tlačidiel, zvýraznenie, popis pod kurzorom
  const update = (dt) => {
    const t = getT();
    if (c.manual !== prevManual) {
      prevManual = c.manual;
      if (c.manual) introT = t; else { if (drag.ctl) { drag.ctl.pressed=false; if(drag.ctl.type==='slide')drag.ctl.end?.({cancelled:true,click:false}); } drag.ctl = null; hover = null; }
      tipEl.style.display = 'none'; tipHtml = ''; dom.style.cursor = '';
    }
    if (c.manual && ptr.dirty && ptr.in && !drag.ctl) { ptr.dirty = false; const h = ctlAt(ptr.cx, ptr.cy); hover = h ? h.k : null; }
    const intro = c.manual && t - introT < 1.8 ? 0.3 + 0.3 * Math.sin((t - introT) * 10) : 0;
    for (const k of ctrls) {
      if (k.type === 'lever' && k !== drag.ctl) { k.angle = approach(k.angle, k.angles[k.getIdx()], 5 * dt); k.pivot.rotation.z = k.angle; }
      if (k.type === 'button' && !k.still) k.pivot.position[k.pressAxis || 'z'] = approach(k.pivot.position[k.pressAxis || 'z'], k.z0 - (k.pressed || k.latched?.() || t - k.pressT < 0.18 ? 0.05 : 0), 0.8 * dt);
      const g = !c.manual ? 0 : k === drag.ctl ? 0.9 : k === hover ? 0.6 : intro;
      if (g !== k.glow) { setGlow(k, g); k.glow = g; }
    }
    if (!c.manual || c.unclamped) return;
    const k = drag.ctl || (ptr.in ? hover : null);
    const cur = drag.ctl ? (k.type === 'button' ? 'pointer' : 'grabbing') : k ? (k.type === 'button' ? 'pointer' : 'grab') : 'default';
    if (dom.style.cursor !== cur) dom.style.cursor = cur;
    const html = k && k.tooltip !== false ? `<b>${k.label}</b>${k.read ? ` · ${k.read()}` : ''}<span>${k.hint}</span>` : '';
    if (html !== tipHtml) { tipHtml = html; tipEl.innerHTML = html; tipEl.style.display = html ? 'block' : 'none'; }
    if (html) {
      const fx = ptr.x > mount.clientWidth - 270, fy = ptr.y > mount.clientHeight - 90;
      tipEl.style.transform = `translate(${ptr.x + (fx ? -16 : 16)}px, ${ptr.y + (fy ? -14 : 18)}px) translate(${fx ? '-100%' : '0'}, ${fy ? '-100%' : '0'})`;
    }
  };
  const dispose = () => {
    if (drag.ctl?.type==='slide') drag.ctl.end?.({cancelled:true,click:false});
    dom.removeEventListener('pointerdown', mDown); dom.removeEventListener('pointermove', mMove);
    dom.removeEventListener('pointerup', mUp); dom.removeEventListener('pointercancel', mUp);
    dom.removeEventListener('pointerleave', mLeave); dom.removeEventListener('wheel', mWheel);
  };
  const api = { reg, push, pend, update, pickAt, hitAt: (x,y) => ctlAt(x,y)?.k || null, isUsed: () => ctlUsed, invalidate: () => ctrls.forEach((k) => { k.glow = -1; }), dispose, entries: () => ctrls };
  try { if (/[?&]debug/.test(window.location.search) && window.__stage) window.__stage.controls = { ...api, c, root, camera }; } catch (err) { /* test without window */ }
  return api;
}

export { createControls };
