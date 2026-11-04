// Odopnutie polotovaru a jeho prehliadka mimo stroja.
import * as THREE from 'three';
import { clamp } from './util';

// ---------- odopnutie polotovaru: vyberie sa zo stroja, dá sa otáčať a vráti sa na pôvodné miesto ----------
function createWorkInspect({ scene, camera, dom, insp, c, getObj, getSpot, onState, canDetach = () => true }) {
  const pivot = new THREE.Group(), box3 = new THREE.Box3();
  const s = { phase: 'in', t: 0, obj: null, parent: null, lp: new THREE.Vector3(), lq: new THREE.Quaternion(), cL: new THREE.Vector3(),
    manual: false, from: new THREE.Vector3(), to: new THREE.Vector3(), q0: new THREE.Quaternion(), pose: null, rad: 1 };
  const OPEN = 0.5, MOVE = 0.9, qI = new THREE.Quaternion(), tmp = new THREE.Vector3();
  let open = 0;
  const ease = (k) => k * k * (3 - 2 * k);
  const detach = () => {
    const obj = getObj(); s.obj = obj; s.parent = obj.parent;
    s.lp.copy(obj.position); s.lq.copy(obj.quaternion);
    box3.setFromObject(obj); box3.getCenter(s.from); s.rad = box3.getSize(tmp).length() / 2;
    s.cL.copy(s.from); s.parent.worldToLocal(s.cL);
    pivot.position.copy(s.from); pivot.quaternion.identity(); scene.add(pivot); pivot.attach(obj);
    s.to.copy(getSpot());
    s.pose = insp.pose();
    const d = tmp.subVectors(camera.position, s.to).normalize();
    const dist = Math.max(2.4, s.rad * 1.1 / Math.sin(camera.fov * Math.PI / 360) / Math.min(1, camera.aspect));
    insp.flyTo(s.to.clone().addScaledVector(d, dist).add(new THREE.Vector3(0, dist * 0.25, 0)), s.to);
  };
  const attachBack = () => {
    s.parent.attach(s.obj); s.obj.position.copy(s.lp); s.obj.quaternion.copy(s.lq);
    scene.remove(pivot); s.obj = null;
  };
  const toggle = () => {
    if (s.phase === 'in') { s.manual = c.manual; c.unclamped = true; c.manual = false; onState(true); s.phase = 'opening'; s.t = 0; return true; }
    if (s.phase === 'inspect') {
      s.phase = 'back'; s.t = 0; s.from.copy(pivot.position); s.q0.copy(pivot.quaternion);
      s.to.copy(s.cL); s.parent.localToWorld(s.to);
      if (s.pose) insp.flyTo(s.pose.p, s.pose.t);
      return true;
    }
    return false;
  };
  const update = (dt) => {
    if (s.phase === 'in') { open = 0; return; }
    s.t += dt;
    if (s.phase === 'opening') { open = Math.min(1, s.t / OPEN); if (s.t >= OPEN && canDetach()) { detach(); s.phase = 'out'; s.t = 0; } }
    else if (s.phase === 'out') {
      const k = ease(Math.min(1, s.t / MOVE));
      pivot.position.lerpVectors(s.from, s.to, k); pivot.position.y += Math.sin(Math.PI * k) * 0.8;
      if (k >= 1) { s.phase = 'inspect'; s.t = 0; }
    } else if (s.phase === 'back') {
      const k = ease(Math.min(1, s.t / MOVE));
      pivot.position.lerpVectors(s.from, s.to, k); pivot.position.y += Math.sin(Math.PI * k) * 0.8;
      pivot.quaternion.copy(s.q0).slerp(qI, k);
      if (k >= 1) { attachBack(); s.phase = 'closing'; s.t = 0; }
    } else if (s.phase === 'closing') {
      open = Math.max(0, 1 - s.t / OPEN);
      if (s.t >= OPEN) { s.phase = 'in'; open = 0; c.unclamped = false; c.manual = s.manual; onState(false); }
    }
  };
  // otáčanie polotovaru ťahaním, priblíženie kolieskom
  let drag = null;
  const qa = new THREE.Quaternion(), ax = new THREE.Vector3();
  const down = (e) => { if (s.phase !== 'inspect') return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { dom.setPointerCapture(e.pointerId); } catch (err) { /* ignorované */ } };
  const move = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    camera.updateMatrixWorld();
    ax.setFromMatrixColumn(camera.matrixWorld, 1); qa.setFromAxisAngle(ax, dx * 0.012); pivot.quaternion.premultiply(qa);
    ax.setFromMatrixColumn(camera.matrixWorld, 0); qa.setFromAxisAngle(ax, dy * 0.012); pivot.quaternion.premultiply(qa);
  };
  const up = () => { drag = null; };
  const wheel = (e) => {
    if (s.phase !== 'inspect') return; e.preventDefault();
    tmp.subVectors(camera.position, pivot.position);
    const d = clamp(tmp.length() * Math.exp(e.deltaY * 0.0012), Math.max(1.2, s.rad * 1.4), Math.max(30, s.rad * 12));
    camera.position.copy(pivot.position).addScaledVector(tmp.normalize(), d); camera.lookAt(pivot.position);
  };
  dom.addEventListener('pointerdown', down); dom.addEventListener('pointermove', move);
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  dom.addEventListener('wheel', wheel, { passive: false });
  const dispose = () => {
    dom.removeEventListener('pointerdown', down); dom.removeEventListener('pointermove', move);
    dom.removeEventListener('pointerup', up); dom.removeEventListener('pointercancel', up); dom.removeEventListener('wheel', wheel);
  };
  const api = { toggle, update, open: () => open, phase: () => s.phase, busy: () => s.phase !== 'in' && s.phase !== 'inspect', dispose };
  try { if (/[?&]debug/.test(window.location.search) && window.__stage) window.__stage.inspection = { ...api, object: () => s.obj || getObj() }; } catch (err) { /* test without window */ }
  return api;
}

export { createWorkInspect };
