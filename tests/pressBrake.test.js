import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  XPERT320,
  brakeSetup,
  brakeForce,
  createBrakeProcess,
  sheetSection,
  supportDepth,
} from '../src/machines/precision/pressBrakeProcess';
import { createBystronicModel } from '../src/machines/precision/bystronicModel';
const cfg = {
  material: 'steel',
  thickness: 4,
  length: 2400,
  depth: 600,
  flange: 150,
  v: 32,
  angle: 90,
  r: 0,
  light: true,
  hmiAngle: 0,
};
const safe = { hydraulic: true, estop: false, guardOpen: false, obstructed: false, unclamped: false };
const model = () => {
  const root = new THREE.Group(),
    G = {},
    M = Object.fromEntries(
      [
        'cab',
        'cab2',
        'dark',
        'anth',
        'black',
        'visor',
        'red',
        'steel',
        'steelD',
        'tool',
        'brass',
        'green',
        'yellow',
        'sheet',
        'glass',
      ].map((k) => [k, new THREE.MeshStandardMaterial()]),
    );
  return { root, G, M, m: createBystronicModel({ root, G, M, tex: () => ({ tx: new THREE.Texture() }) }) };
};
describe('Xpert Pro 320/4300 press brake', () => {
  it('uses the standard 320/4300 data-sheet column and dimensionally correct force scaling', () => {
    expect(XPERT320).toMatchObject({
      length: 5260,
      width: 2000,
      height: 3170,
      force: 3200,
      bendLength: 4300,
      stroke: 250,
      openHeight: 640,
      mass: 24300,
    });
    expect(brakeForce(cfg)).toBeCloseTo(766.8);
    expect(brakeForce({ ...cfg, length: 1200 })).toBeCloseTo(383.4);
    expect(brakeForce({ ...cfg, thickness: 8 })).toBeCloseTo(4 * brakeForce(cfg));
    expect(brakeSetup(cfg).target).toBeLessThan(250);
  });
  it('rejects overload, unsupported flanges, unsuitable V dies and non-finite input', () => {
    expect(() => brakeSetup({ ...cfg, thickness: 12, length: 4300, v: 72, material: 'stainless' })).toThrow(/3 200/);
    expect(() => brakeSetup({ ...cfg, flange: 20, v: 80 })).toThrow(/rameno/);
    expect(() => brakeSetup({ ...cfg, v: 16 })).toThrow(/úzka/);
    expect(() => brakeSetup({ ...cfg, angle: NaN })).toThrow(/rozsahu/);
    expect(() => brakeSetup({ ...cfg, flange: 601 })).toThrow();
    expect(() => brakeSetup({ ...cfg, length: 4300, depth: 900, flange: 500 })).toThrow(/400 mm/);
  });
  it('finishes a bend, unloads with springback, retracts, and requires a new blank', () => {
    const p = createBrakeProcess();
    expect(p.start(cfg, safe)).toBe(true);
    p.advance(30, safe);
    expect(p.S.done).toBe(true);
    expect(p.S.complete).toBe(true);
    expect(p.S.run).toBe(false);
    expect(p.S.y).toBe(0);
    expect(180 - (p.S.beta * 360) / Math.PI).toBeCloseTo(90, 6);
    expect(p.S.force).toBe(0);
    expect(p.start(cfg, safe)).toBe(false);
    expect(p.reset()).toBe(true);
    expect(p.S.beta).toBe(0);
  });
  it('freezes at interlocks and holds the part through pause, resume and partial retract', () => {
    for (const hazard of [
      { guardOpen: true },
      { estop: true },
      { obstructed: true },
      { hydraulic: false },
      { unclamped: true },
    ]) {
      const p = createBrakeProcess();
      expect(p.start(cfg, { ...safe, ...hazard })).toBe(false);
      expect(p.start(cfg, safe)).toBe(true);
      p.advance(2.5, safe);
      const y = p.S.y,
        b = p.S.beta;
      p.advance(1, { ...safe, ...hazard });
      expect(p.S.run).toBe(false);
      expect(p.S.y).toBe(y);
      expect(p.S.beta).toBe(b);
    }
    const p = createBrakeProcess();
    p.start(cfg, safe);
    p.advance(2.5, safe);
    p.hold();
    const y = p.S.y;
    p.advance(10, safe);
    expect(p.S.y).toBe(y);
    expect(p.reset()).toBe(false);
    expect(p.start(cfg, safe)).toBe(true);
    p.advance(0.2, safe);
    p.hold();
    expect(p.retract(safe)).toBe(true);
    p.advance(5, safe);
    expect(p.S.done).toBe(true);
    expect(p.S.complete).toBe(false);
    expect(p.S.beta).toBeGreaterThan(0);
  });
  it('preserves developed sheet length and keeps the punch on the sheet surface', () => {
    for (const beta of [0, 0.3, 0.7]) {
      const pts = sheetSection(cfg, beta);
      let length = 0;
      for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].z - pts[i - 1].z, pts[i].y - pts[i - 1].y);
      expect(length).toBeCloseTo(cfg.depth, 2);
      expect(pts.every((p) => Number.isFinite(p.z + p.y))).toBe(true);
    }
    const { m, root } = model(),
      p = createBrakeProcess();
    p.start(cfg, safe);
    p.advance(3, safe);
    m.update({ S: p.S, c: cfg, guardAngle: 0 });
    root.updateMatrixWorld(true);
    const punch = new THREE.Box3().setFromObject(m.punch),
      surface = 11 + (cfg.thickness - supportDepth(cfg, p.S.beta)) * 0.01;
    expect(punch.min.y).toBeCloseTo(surface, 4);
    const ray = new THREE.Raycaster(new THREE.Vector3(0.5, 11.1, 2), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(m.die, true)[0];
    expect(hit.point.y).toBeLessThan(10.9); // real V cavity, not a solid rectangular die
    const fixed = new THREE.Box3().setFromObject(m.die);
    m.update({ S: { ...p.S, y: 0 }, c: cfg, guardAngle: 0 });
    root.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(m.die).equals(fixed)).toBe(true);
  });
  it('aligns the rear finger contact with X and preserves the detached sheet pose', () => {
    const { m, root } = model();
    m.update({ S: { y: 0, beta: 0 }, c: cfg, guardAngle: 0 });
    root.updateMatrixWorld(true);
    m.update({ S: { y: 0, beta: 0 }, c: { ...cfg, cutaway: true }, guardAngle: 0 });
    expect(m.cutawayParts.every((o) => !o.visible && o.raycast() === false)).toBe(true);
    m.update({ S: { y: 0, beta: 0 }, c: cfg, guardAngle: 0 });
    expect(m.cutawayParts.every((o) => o.visible)).toBe(true);
    const finger = new THREE.Box3().setFromObject(m.fingers[0]);
    expect(finger.max.z).toBeCloseTo(2 - cfg.flange * 0.01, 4);
    m.stock.position.set(4, 5, 6);
    m.update({ S: { y: 0, beta: 0 }, c: { ...cfg, unclamped: true }, guardAngle: 1.1 });
    expect(m.stock.position.toArray()).toEqual([4, 5, 6]);
    expect(Math.abs(m.guardPivots[0].rotation.y)).toBeCloseTo(1.1);
  });
  it('leaves the operator frame and hand grip open as in the reference', () => {
    const { m, root } = model();
    root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(12, 4, 20), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(m.pedal, true)).toHaveLength(0);
    const origin = m.operatorFace.localToWorld(new THREE.Vector3(0, -1.13, 2));
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(m.operatorFace.matrixWorld);
    ray.set(origin, direction);
    expect(ray.intersectObject(m.operatorFace, true)).toHaveLength(0);
  });
});

describe('program ohybov', () => {
  it('prierez bez hotových ohybov sa zhoduje s jedným ohybom', async () => {
    const { profileSection, sheetSection } = await import('../src/machines/precision/pressBrakeProcess.js');
    const c = { material: 'steel', thickness: 3, length: 1500, depth: 360, flange: 25, v: 24, angle: 90 };
    const a = sheetSection(c, 0.7),
      b = profileSection(c, 0.7, { bends: [], cur: 25, side: 'A' });
    expect(b.length).toBe(a.length);
    b.forEach((p, i) => {
      expect(p.z).toBeCloseTo(a[i].z, 6);
      expect(p.y).toBeCloseTo(a[i].y, 6);
    });
  });
  it('krabička: päť ohybov s otáčaním plechu, štart bez otočenia sa odmietne', async () => {
    const { createBrakeControl } = await import('../src/machines/precision/brakeControl.js');
    const { BRAKE_PROGRAMS } = await import('../src/machines/precision/pressBrakeProcess.js');
    const c = { hydraulic: true, estop: false, guardOpen: false, obstructed: false, unclamped: false, r: 0, speed: 1 };
    const ctl = createBrakeControl({ c });
    expect(ctl.loadProgram('krabicka')).toBe(true);
    const steps = BRAKE_PROGRAMS.find((p) => p.id === 'krabicka').steps;
    expect(ctl.action('turn')).toBe(false); // pred prvým ohybom sa neotáča
    for (let i = 0; i < steps.length; i++) {
      expect([c.flange, c.length, c.depth, c.angle]).toEqual([
        steps[i].flange,
        steps[i].length,
        steps[i].depth,
        steps[i].angle,
      ]);
      expect(ctl.action('start')).toBe(true);
      for (let k = 0; k < 2000 && !ctl.process.S.done; k++) ctl.advance(0.05);
      expect(ctl.process.S.complete).toBe(true);
      expect(ctl.snapshot().program.bends).toBe(i + 1);
      if (i === steps.length - 1) break;
      expect(ctl.snapshot().program.needsTurn).toBe(true);
      expect(ctl.action('start')).toBe(false); // najprv otočiť plech
      expect(ctl.action('turn')).toBe(true);
      expect(ctl.snapshot().program.turning).toBe(true);
      expect(ctl.action('start')).toBe(false); // plech sa ešte otáča
      for (let k = 0; k < 100 && ctl.snapshot().program.turning; k++) ctl.advance(0.05);
      expect(ctl.snapshot().program.index).toBe(i + 1);
      expect(ctl.profile().cur).toBe(steps[i + 1].hinge);
    }
    expect(ctl.snapshot().program.needsTurn).toBe(false);
    expect(ctl.action('start')).toBe(false); // program je dokončený
    expect(Object.keys(ctl.profile().bends)).toEqual(['F', 'A', 'B', 'C']);
    expect(ctl.action('reset')).toBe(true);
    expect(ctl.snapshot().program).toMatchObject({ index: 0, bends: 0 });
    expect(c.flange).toBe(25);
  });
  it('krabička: hotový dielec má steny 60 mm, lem 25 mm smerom von a ohyby s polomerom nástroja', async () => {
    const { BOX_PART, boxPose, buildBoxPart, setBoxAngles } = await import('../src/machines/precision/brakePart.js');
    const { insideRadius } = await import('../src/machines/precision/pressBrakeProcess.js');
    const ri = insideRadius({ v: 16, thickness: 2 });
    expect(ri).toBeCloseTo(2.56);
    const part = buildBoxPart(BOX_PART, 2, new THREE.MeshBasicMaterial(), { ri }),
      q = Math.PI / 4;
    expect(part.r).toBeCloseTo(ri + 1);
    setBoxAngles(part, { F: q, A: q, B: q, C: q }, 'D', q);
    part.root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(part.root, true);
    expect(bb.max.y - bb.min.y).toBeCloseTo(62, 1); // steny 60 mm + polovice hrúbky dna a lemu
    expect(bb.max.x - bb.min.x).toBeCloseTo(202, 1);
    // lem trčí von zo zadnej steny A o 25 mm
    expect(-bb.min.z).toBeCloseTo(75 + 25, 1);
    expect(bb.max.z).toBeCloseTo(76, 1);
    // oblúk ohybu: vnútorná plocha má polomer ri okolo stredu ohybu (dno je v rovine XZ, stena C ide nahor)
    const arc = part.joints.C.arc,
      pos = arc.geometry.attributes.position,
      v = new THREE.Vector3(),
      toRoot = part.root.matrixWorld.clone().invert(),
      m = toRoot.clone().multiply(arc.matrixWorld),
      center = new THREE.Vector3(0, part.r, 0).applyMatrix4(toRoot.clone().multiply(part.joints.C.pivot.matrixWorld));
    let rMin = Infinity,
      rMax = 0;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(m);
      const d = Math.hypot(v.x - center.x, v.y - center.y);
      rMin = Math.min(rMin, d);
      rMax = Math.max(rMax, d);
    }
    expect(rMin).toBeCloseTo(ri, 3);
    expect(rMax).toBeCloseTo(ri + 2, 3);
    // rozvinutá dĺžka sa zachová: pri rovnom plechu je oblúk rovný pás dĺžky BA = r · π/2
    setBoxAngles(part, {}, 'A', 0);
    expect(part.joints.A.hinge.position.z).toBeCloseTo((part.r * Math.PI) / 2, 6);
    // poloha v lise: stred oblúka ohýbanej hrany je na ohybovej čiare, ohýbaný panel smeruje dozadu k dorazu
    for (const cur of ['F', 'A', 'C']) {
      setBoxAngles(part, { F: q }, cur, 0);
      const h = boxPose(part, cur, 0);
      part.root.updateMatrixWorld(true);
      const rootInv = part.root.matrixWorld.clone().invert(),
        pivot = new THREE.Vector3().setFromMatrixPosition(rootInv.clone().multiply(part.joints[cur].pivot.matrixWorld));
      const p = pivot.applyMatrix4(h);
      expect(p.z).toBeCloseTo(part.ba / 2, 6);
      expect(Math.abs(p.y)).toBeLessThan(1e-6);
      const tip = new THREE.Vector3(0, 0, 10).applyMatrix4(
        rootInv.clone().multiply(part.joints[cur].hinge.matrixWorld),
      );
      tip.applyMatrix4(h);
      expect(tip.z).toBeCloseTo(-10 - part.ba / 2, 6);
      expect(Math.abs(tip.y)).toBeLessThan(1e-6);
    }
    // pri ohybe sú obe ramená súmerné (V) a stred oblúka zostáva v počiatku
    setBoxAngles(part, {}, 'B', q);
    const h = boxPose(part, 'B', q);
    part.root.updateMatrixWorld(true);
    const rootInv = part.root.matrixWorld.clone().invert(),
      a = new THREE.Vector3(0, 0, 30).applyMatrix4(rootInv.clone().multiply(part.joints.B.hinge.matrixWorld)),
      b = new THREE.Vector3(0, 0, -30).applyMatrix4(rootInv.clone().multiply(part.joints.B.pivot.matrixWorld));
    a.applyMatrix4(h);
    b.applyMatrix4(h);
    expect(a.y).toBeGreaterThan(20);
    expect(a.y).toBeCloseTo(b.y, 0);
  });
  it('model lisu: krabička, úzka matrica a razník zložený na dĺžku ohybu', () => {
    const { m } = model();
    const S = { y: 0, beta: 0 },
      c = { ...cfg, thickness: 2, v: 16, length: 150, depth: 320, flange: 60 };
    m.update({
      S,
      c,
      guardAngle: 0,
      prog: { part: 'box', bends: { F: 0.78, A: 0.78, B: 0.78 }, cur: 'C', turn: null },
    });
    expect(m.punch.visible).toBe(false);
    expect(m.boxPunch.visible).toBe(true);
    expect(m.boxPunch.userData.segments).toBe('100+40');
    expect(m.die.children[0].name).toBe('narrow-V-die-segment');
    expect(m.stock.getObjectByName('box-part').visible).toBe(true);
    m.update({
      S,
      c: { ...c, length: 200 },
      guardAngle: 0,
      prog: { part: 'box', bends: {}, cur: 'F', turn: { u: 0.5, from: { hinge: 'F', beta: 0.78 } } },
    });
    expect(m.boxPunch.userData.segments).toBe('100+50+40');
    m.update({ S, c: cfg, guardAngle: 0 });
    expect(m.punch.visible).toBe(true);
    expect(m.stock.getObjectByName('box-part').visible).toBe(false);
    expect(m.die.children[0].name).toBe('V-die-segment');
  });
});
