import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createControls } from '../src/core/controls';

function setup() {
  const handlers = {},
    dom = {
      style: {},
      addEventListener: (n, f) => {
        handlers[n] = f;
      },
      removeEventListener: (n) => {
        delete handlers[n];
      },
      setPointerCapture: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
    };
  const root = new THREE.Group(),
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 8;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const material = new THREE.MeshStandardMaterial(),
    button = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.4), material);
  root.add(button);
  root.updateMatrixWorld(true);
  const c = { manual: true },
    ctrl = createControls({
      dom,
      mount: { clientWidth: 200, clientHeight: 200 },
      camera,
      root,
      tipEl: { style: {}, innerHTML: '' },
      c,
      getT: () => 1,
      getHL: () => [],
    });
  const event = (type = 'pointerdown') => ({ type, clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' });
  return { ctrl, c, root, button, handlers, event };
}
describe('Manual machine controls', () => {
  it('presses a deck button on its local Y axis and invokes its action once', () => {
    const s = setup();
    let calls = 0;
    s.ctrl.reg({ type: 'button', pressAxis: 'y', label: 'Start', hint: 'Start', action: () => calls++ }, s.button);
    s.handlers.pointerdown(s.event());
    s.ctrl.update(0.1);
    expect(calls).toBe(1);
    expect(s.button.position.y).toBeCloseTo(-0.05);
    expect(s.button.position.z).toBe(0);
    expect(s.ctrl.isUsed()).toBe(true);
    s.handlers.pointerup(s.event('pointerup'));
    s.ctrl.dispose();
  });
  it('keeps the default Z-axis button travel used by the lathe', () => {
    const s = setup();
    s.ctrl.reg({ type: 'button', label: 'Start', hint: 'Start', action: () => {} }, s.button);
    s.handlers.pointerdown(s.event());
    s.ctrl.update(0.1);
    expect(s.button.position.z).toBeCloseTo(-0.05);
    expect(s.button.position.y).toBe(0);
    s.ctrl.dispose();
  });
  it('respects real occlusion but ignores a hidden cover and a pass-through legend plane', () => {
    const s = setup();
    s.ctrl.reg({ type: 'button', label: 'Start', hint: 'Start', action: () => {} }, s.button);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), new THREE.MeshBasicMaterial());
    cover.position.z = 2;
    s.root.add(cover);
    expect(s.ctrl.hitAt(100, 100)).toBeNull();
    cover.visible = false;
    expect(s.ctrl.hitAt(100, 100)?.label).toBe('Start');
    cover.visible = true;
    cover.userData.controlPassThrough = true;
    expect(s.ctrl.hitAt(100, 100)?.label).toBe('Start');
    s.ctrl.dispose();
  });
  it('supports a slide click and ends an active drag when leaving manual mode', () => {
    const s = setup();
    let clicks = 0,
      ended = null;
    s.ctrl.reg(
      {
        type: 'slide',
        label: 'Door',
        hint: 'Drag',
        start: () => {},
        slide: () => {},
        click: () => clicks++,
        end: (e) => {
          ended = e;
        },
      },
      s.button,
    );
    s.handlers.pointerdown(s.event());
    s.handlers.pointerup(s.event('pointerup'));
    expect(clicks).toBe(1);
    expect(ended.click).toBe(true);
    s.ctrl.update(0.01);
    s.handlers.pointerdown(s.event());
    s.c.manual = false;
    s.ctrl.update(0.01);
    expect(ended.cancelled).toBe(true);
    expect(clicks).toBe(1);
    s.ctrl.dispose();
  });
});
