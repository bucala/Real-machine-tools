import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cabinHalfWidth, HMI_ARM, hmiPose } from '../src/machines/cnc/hermleLayout';
import { createOrbit } from '../src/core/stage';

describe('Hermle front HMI and layout', () => {
  it('sweeps one rigid arm on a circle, with only an independent terminal swivel', () => {
    for (const K of [1, 1.23]) {
      const half = K === 1 ? 11.4 : 12.25;
      const front = hmiPose(0, 0, half, K);
      expect(front.base[1]).toBeLessThan(8.6 * K); // side mounting, behind the front fascia
      expect(front.base[0]).toBeLessThan(half); // pivot tucked underneath, not on an outboard shelf
      expect(front.column[1] - 2.3 * K).toBeGreaterThan(8.6 * K);
      expect((front.yaw * 180) / Math.PI).toBeCloseTo(-25);
      for (let angle = 0; angle <= 180; angle++) {
        const p = hmiPose(angle, 0, half, K);
        expect(Math.hypot(p.column[0] - p.base[0], p.column[1] - p.base[1])).toBeCloseTo(HMI_ARM.reach * K);
        expect(p.angle).toBeGreaterThan(0);
        expect(p.angle).toBeLessThan(Math.PI);
        expect(p).not.toHaveProperty('elbow');
        expect(p.column[0] - 3.8 * K).toBeGreaterThan(half);
        const trimmed = hmiPose(angle, 73, half, K);
        expect(trimmed.column).toEqual(p.column);
        expect(trimmed.yaw - p.yaw).toBeCloseTo((73 * Math.PI) / 180);
      }
      expect((hmiPose(180, 0, half, K).yaw * 180) / Math.PI).toBeCloseTo(90);
      expect(hmiPose(90, 0, half, K).angle).toBeCloseTo(Math.PI / 2);
      expect(hmiPose(180, 0, half, K).column[1]).toBeLessThan(0);
    }
    expect(2 * cabinHalfWidth({ id: 'c42' }) * 100).toBe(2450);
    expect(hmiPose(-10)).toEqual(hmiPose(0));
    expect(hmiPose(190)).toEqual(hmiPose(180));
  });
  it('allows Hermle to zoom beyond 50 units while consuming wheel gestures locally', () => {
    const handlers = {},
      dom = {
        style: {},
        addEventListener: (k, f) => {
          handlers[k] = f;
        },
        removeEventListener: (k) => {
          delete handlers[k];
        },
      };
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 10, 40);
    let enabled = true,
      prevented = 0;
    const orbit = createOrbit(
      camera,
      dom,
      () => {},
      () => enabled,
      { maxDistance: 180, maxTargetY: 45 },
    );
    orbit.sync();
    const wheel = { deltaY: 2000, preventDefault: () => prevented++, stopPropagation: () => {} };
    handlers.wheel(wheel);
    expect(camera.position.distanceTo(orbit.target)).toBeCloseTo(180);
    expect(prevented).toBe(1);
    enabled = false;
    handlers.wheel({ ...wheel, deltaY: -1000 });
    expect(prevented).toBe(2);
    expect(camera.position.distanceTo(orbit.target)).toBeCloseTo(180);
    orbit.dispose();
    expect(handlers.wheel).toBeUndefined();
  });
});
