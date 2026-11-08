import { describe, it, expect } from 'vitest';
import {
  createBrakeControl,
  BRAKE_PRESETS,
  brakeRecipe,
  saveBrakeRecipe,
  readBrakeRecipes,
  BRAKE_RECIPE_KEY,
} from '../src/machines/precision/brakeControl';
const fresh = () => {
  const c = {
    ...BRAKE_PRESETS[0],
    hydraulic: true,
    guardOpen: false,
    obstructed: false,
    estop: false,
    unclamped: false,
  };
  return { c, b: createBrakeControl({ c }) };
};
describe('Bystronic HMI control', () => {
  it('latches STOP, preserves the loaded sheet and never resumes on release or acknowledgement', () => {
    const { c, b } = fresh();
    b.action('start');
    b.advance(2.5);
    const y = b.process.S.y,
      beta = b.process.S.beta;
    b.action('emergency');
    expect(c.estop).toBe(true);
    expect(b.process.S.run).toBe(false);
    expect(b.action('acknowledge')).toBe(false);
    b.advance(20);
    expect(b.process.S.y).toBe(y);
    b.action('releaseStop');
    expect(b.process.S.run).toBe(false);
    expect(b.action('acknowledge')).toBe(true);
    expect(b.process.S.beta).toBe(beta);
    expect(b.process.S.run).toBe(false);
    b.action('start');
    b.advance(30);
    expect(b.snapshot().stats.completed).toBe(1);
    expect(b.snapshot().stats.lastForce).toBeGreaterThan(0);
  });
  it('shares edits, rejects in-cycle edits and stops immediately when hydraulics are disabled', () => {
    const { c, b } = fresh();
    expect(b.set('depth', 100)).toBe(true);
    expect(c.flange).toBe(80);
    b.set('v', 24);
    b.action('start');
    b.advance(1);
    expect(b.set('thickness', 8)).toBe(false);
    expect(b.load(BRAKE_PRESETS[2])).toBe(false);
    expect(c.thickness).toBe(4);
    b.set('hydraulic', false);
    expect(b.process.S.run).toBe(false);
    expect(b.process.S.alarm).toMatch(/hydraul/);
    expect(b.action('acknowledge')).toBe(false);
    b.set('hydraulic', true);
    expect(b.action('acknowledge')).toBe(true);
    expect(b.process.S.run).toBe(false);
  });
  it('counts interrupted cycles once and validates a recipe before changing any parameter', () => {
    const { c, b } = fresh();
    b.action('start');
    b.advance(2.5);
    b.action('hold');
    b.action('retract');
    b.advance(10);
    b.advance(10);
    expect(b.snapshot().stats).toMatchObject({ completed: 0, interrupted: 1 });
    b.action('reset');
    const before = { ...c };
    expect(b.load({ ...BRAKE_PRESETS[0], flange: 2000 })).toBe(false);
    expect(c).toEqual(before);
    expect(b.load(BRAKE_PRESETS[2])).toBe(true);
    expect(c.material).toBe('aluminium');
    expect(b.set('estop', false)).toBe(false);
  });
  it('stores only valid machining settings and tolerates corrupt local storage', () => {
    const data = {},
      storage = {
        getItem: (k) => data[k],
        setItem: (k, v) => {
          data[k] = v;
        },
      };
    saveBrakeRecipe(storage, { ...BRAKE_PRESETS[0], name: 'Test', estop: false, hydraulic: true });
    expect(readBrakeRecipes(storage)[0]).not.toHaveProperty('estop');
    saveBrakeRecipe(storage, { ...BRAKE_PRESETS[1], name: 'Test' });
    expect(readBrakeRecipes(storage)).toHaveLength(1);
    expect(readBrakeRecipes(storage)[0].thickness).toBe(6);
    expect(() => brakeRecipe({ ...BRAKE_PRESETS[0], r: 10 })).toThrow();
    data[BRAKE_RECIPE_KEY] = 'bad JSON';
    expect(readBrakeRecipes(storage)).toEqual([]);
  });
});
