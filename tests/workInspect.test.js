import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWorkInspect } from '../src/core/workInspect';

function setup(canDetach) {
  const scene = new THREE.Scene(), parent = new THREE.Group(), work = new THREE.Group();
  scene.add(parent); parent.add(work);
  parent.position.set(3, 2, -1); parent.rotation.set(.3, .2, -.1);
  work.rotation.x = -Math.PI / 2; work.scale.setScalar(.01);
  work.add(new THREE.Mesh(new THREE.BoxGeometry(100, 80, 40)));
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(8, 6, 10);
  const handlers = {}, dom = { addEventListener: (k, f) => { handlers[k] = f; }, removeEventListener: k => { delete handlers[k]; }, setPointerCapture: () => {} };
  const flights = [], states = [], c = { manual: true, unclamped: false };
  const wi = createWorkInspect({ scene, camera, dom, c, getObj: () => work, getSpot: () => new THREE.Vector3(0, 4, 10), canDetach,
    insp: { pose: () => ({ p: camera.position.clone(), t: new THREE.Vector3(3, 2, -1) }), flyTo: (p, t) => flights.push({ p, t }) },
    onState: v => states.push(v) });
  return { wi, scene, parent, work, camera, handlers, c, flights, states };
}

describe('Workpiece inspection shared with the lathe', () => {
  it('fits a large sheet instead of placing the camera inside it', () => {
    const s=setup();s.work.scale.setScalar(1);s.camera.aspect=.6;
    s.wi.toggle();s.wi.update(.5);
    const bounds=new THREE.Box3().setFromObject(s.work),radius=bounds.getSize(new THREE.Vector3()).length()/2;
    expect(s.flights[0].p.distanceTo(s.flights[0].t)).toBeGreaterThan(radius/Math.sin(s.camera.fov*Math.PI/360));
    s.wi.dispose();
  });
  it('waits for the CNC doors before detaching or moving the camera', () => {
    let ready = false;
    const s = setup(() => ready);
    expect(s.wi.toggle()).toBe(true);
    s.wi.update(2);
    expect(s.wi.phase()).toBe('opening');
    expect(s.work.parent).toBe(s.parent);
    expect(s.flights).toHaveLength(0);
    expect(s.c.unclamped).toBe(true);
    expect(s.c.manual).toBe(false);
    ready = true; s.wi.update(.01);
    expect(s.wi.phase()).toBe('out');
    expect(s.work.parent).not.toBe(s.parent);
    expect(s.flights).toHaveLength(1);
    s.wi.dispose();
  });

  it('rotates only the detached part and restores its transform, clamp and camera', () => {
    const s = setup(), position = s.work.position.clone(), rotation = s.work.quaternion.clone(), scale = s.work.scale.clone();
    s.wi.toggle(); s.wi.update(.5); s.wi.update(.9);
    expect(s.wi.phase()).toBe('inspect');
    const rootMatrix = s.parent.matrixWorld.clone(), camera = s.camera.position.clone(), pivot = s.work.parent;
    s.handlers.pointerdown({ clientX: 10, clientY: 10, pointerId: 1 });
    s.handlers.pointermove({ clientX: 80, clientY: 30, pointerId: 1 });
    s.handlers.pointerup();
    expect(pivot.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(.1);
    expect(s.camera.position.equals(camera)).toBe(true);
    expect(s.parent.matrixWorld.equals(rootMatrix)).toBe(true);
    s.handlers.wheel({ deltaY: -100, preventDefault: () => {} });
    expect(s.camera.position.equals(camera)).toBe(false);
    expect(s.wi.toggle()).toBe(true);
    expect(s.wi.toggle()).toBe(false);
    s.wi.update(.9); s.wi.update(.5);
    expect(s.work.parent).toBe(s.parent);
    expect(s.work.position.distanceTo(position)).toBeLessThan(1e-8);
    expect(s.work.quaternion.angleTo(rotation)).toBeLessThan(1e-6);
    expect(s.work.scale.distanceTo(scale)).toBeLessThan(1e-8);
    expect(s.c.unclamped).toBe(false);
    expect(s.states).toEqual([true, false]);
    expect(s.flights[1].p.equals(camera)).toBe(true);
    s.wi.dispose();
    expect(Object.keys(s.handlers)).toHaveLength(0);
  });
});
