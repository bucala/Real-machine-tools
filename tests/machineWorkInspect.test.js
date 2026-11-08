import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMachineWorkInspect } from '../src/core/machineWorkInspect';

it('blocks inspection while running and preserves the part, mode and callbacks on return', () => {
  const scene = new THREE.Scene(), parent = new THREE.Group(), part = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  scene.add(parent); parent.add(part); scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(5, 5, 8);
  const c = { running: true, manual: true }, ui = {}, apiRef = { current: {} }, messages = [], calls = [];
  const set = (key, value) => { c[key] = value; ui[key] = value; };
  const wi = createMachineWorkInspect({ scene, camera, c, set, apiRef, getObj: () => part, getSpot: () => new THREE.Vector3(0, 4, 5),
    dom: { addEventListener() {}, removeEventListener() {} },
    insp: { pose: () => ({ p: camera.position.clone(), t: new THREE.Vector3() }), flyTo() {}, goView: name => calls.push(name) },
    canInspect: () => c.running ? 'Stop first' : null, say: message => messages.push(message),
    prepare: () => calls.push('prepare'), restore: () => calls.push('restore') });
  apiRef.current.toggleWork();
  expect(messages).toEqual(['Stop first']); expect(part.parent).toBe(parent); expect(calls).toEqual([]);
  c.running = false; apiRef.current.toggleWork();
  expect(ui.unclamped).toBe(true); expect(ui.manual).toBe(false);
  apiRef.current.view('overview'); expect(calls).toEqual(['prepare']);
  wi.update(.5); wi.update(.9); apiRef.current.toggleWork(); wi.update(.9); wi.update(.5);
  expect(part.parent).toBe(parent); expect(ui.unclamped).toBe(false); expect(ui.manual).toBe(true);
  expect(calls).toEqual(['prepare', 'restore']);
  apiRef.current.view('overview'); expect(calls.at(-1)).toBe('overview');
  wi.dispose();
});

describe('Inspection of a missing piece', () => {
  it('does not enter inspection when a group has no geometry', () => {
    const c = { manual: false }, apiRef = { current: {} }, messages = [];
    const wi = createMachineWorkInspect({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), dom: { addEventListener() {}, removeEventListener() {} },
      insp: {}, c, set() {}, apiRef, getObj: () => new THREE.Group(), getSpot() {}, canInspect: () => null, say: m => messages.push(m) });
    apiRef.current.toggleWork(); expect(wi.phase()).toBe('in'); expect(messages).toHaveLength(1); wi.dispose();
  });
});
