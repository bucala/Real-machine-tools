import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createToolModel, toolProfile } from '../src/machines/cnc/toolModel';
import { defaultTools } from '../src/machines/cnc/tooling';
import { createExecutor } from '../src/machines/cnc/sim';
import { MODELS } from '../src/machines/cnc/kin';
import { interpret } from '../src/machines/cnc/gcode';
import { createStock } from '../src/machines/cnc/voxel';

describe('CNC tool geometry and pick-up', () => {
  it('preserves cutting diameter, corner radius and gauge length for all tool types', () => {
    const material = new THREE.MeshBasicMaterial();
    for (const t of defaultTools()) {
      const profile = toolProfile(t);
      expect(Math.max(...profile.map(([r]) => r))).toBeCloseTo(t.d / 2);
      expect(Math.min(...profile.map(([, y]) => y))).toBeCloseTo(-t.l);
      const g = createToolModel(t, { holder: material, tool: material, coat: material, flute: material });
      const bounds = new THREE.Box3().setFromObject(g);
      expect(bounds.min.y).toBeCloseTo(-t.l / 100, 5);
      expect(bounds.max.y).toBeCloseTo(0, 5);
      g.traverse((n) => {
        if (n.geometry) {
          expect(Array.from(n.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
          n.geometry.dispose();
        }
      });
    }
    material.dispose();
  });
  it.each(['c32', 'c42'])('deposits before indexing and picks up at the magazine seating plane (%s)', (model) => {
    const mach = MODELS[model],
      tools = defaultTools(),
      o54 = [0, 0, 90];
    const prog = interpret('T3 M6', { tools, o54, mach });
    const stock = createStock({ min: [-5, -5, 50], max: [5, 5, 60], res: 1 });
    const ex = createExecutor({ moves: prog.moves, tools, o54, stock, mach });
    ex.advance(mach.tc * 0.5);
    expect(ex.S.T).toBe(0);
    expect(ex.S.pose.m[1]).toBeCloseTo(mach.tcY);
    expect(ex.S.pose.m[2]).toBeCloseTo(mach.nose[1] - 80);
    ex.advance(mach.tc * 0.21);
    expect(ex.S.T).toBe(3);
    expect(ex.S.pose.m[2] + tools[2].l).toBeGreaterThan(mach.nose[1] - 80);
    ex.advance(mach.tc);
    expect(ex.S.pose.m[2] + tools[2].l).toBeCloseTo(mach.nose[1]);
    expect(ex.S.alarm).toBeNull();
  });
});
