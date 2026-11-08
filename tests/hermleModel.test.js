import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHermleModel, HERMLE_ENVELOPES } from '../src/machines/cnc/hermleModel';
import { MODELS } from '../src/machines/cnc/kin';
import { cabinHalfWidth, hmiPose } from '../src/machines/cnc/hermleLayout';
const setup = (id) => {
  const root = new THREE.Group(),
    G = {},
    tex = () => ({ tx: new THREE.Texture(), redraw() {} }),
    MC = MODELS[id];
  const M = Object.fromEntries(
    [
      'cab',
      'cab2',
      'dark',
      'anth',
      'steel',
      'steelD',
      'inox',
      'table',
      'red',
      'black',
      'glass',
      'tool',
      'coat',
      'holder',
      'flute',
    ].map((k) => [
      k,
      new THREE.MeshStandardMaterial({ transparent: k === 'glass', opacity: k === 'glass' ? 0.16 : 1 }),
    ]),
  );
  const ctx = { root, G, M, tex, MC, PY: 9.5 + MC.hA * 0.01 };
  return { ...ctx, model: createHermleModel(ctx) };
};
describe.each(['c32', 'c42'])('Hermle %s catalogue geometry', (id) => {
  it('preserves catalogue table size and 950 mm loading height independently of cabinet scaling', () => {
    const { root, model: m, MC } = setup(id),
      P = HERMLE_ENVELOPES[id];
    root.updateMatrixWorld(true);
    const plate = root.getObjectByName('parallel-slot-clamping-table'),
      bounds = new THREE.Box3().setFromObject(plate),
      size = bounds.getSize(new THREE.Vector3());
    expect(size.x * 100).toBeCloseTo(MC.table, 3);
    expect(size.z * 100).toBeCloseTo(P.tableDepth * 100, 3);
    expect(bounds.max.y * 100).toBeCloseTo(950);
    expect(plate.geometry.parameters.shapes.holes).toHaveLength(P.slots);
    expect(m.cG.parent).toBe(m.aG);
    expect(cabinHalfWidth(MC) * 2).toBe(P.width);
    m.aG.rotation.x = 0.6;
    m.cG.rotation.y = 0.4;
    root.updateMatrixWorld(true);
    expect(plate.getWorldPosition(new THREE.Vector3()).z).not.toBeCloseTo(0);
  });
  it('opens a clear catalogue-width entrance using two translating leaves with attached handles', () => {
    const { root, model: m } = setup(id),
      P = HERMLE_ENVELOPES[id];
    m.updateGeometry({ doorK: 0 });
    root.updateMatrixWorld(true);
    const initial = m.doors.map((d) => d.position.clone());
    const ray = new THREE.Raycaster(new THREE.Vector3(0.01, 22, 20), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObjects(m.doors, true).length).toBeGreaterThan(0);
    m.updateGeometry({ doorK: 1 });
    root.updateMatrixWorld(true);
    expect(ray.intersectObjects(m.doors, true)).toHaveLength(0);
    m.doors.forEach((d, i) => {
      expect(d.position.distanceTo(initial[i])).toBeCloseTo(P.opening / 2);
      expect(d.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    });
    const left = new THREE.Box3().setFromObject(m.doors[0]),
      right = new THREE.Box3().setFromObject(m.doors[1]);
    // Rubber lips overlap the aperture by 2.5 mm, the metal leaves don't.
    expect(right.min.x - left.max.x).toBeCloseTo(P.opening - 0.05, 3);
  });
  it('keeps the pick-up point aligned to CNC coordinates, uses an outboard drive and contains the bridge in the bed', () => {
    const { root, model: m, MC } = setup(id);
    root.updateMatrixWorld(true);
    expect(m.pockets).toHaveLength(MC.mag);
    const pick = m.pockets[0].getWorldPosition(new THREE.Vector3());
    expect(pick.x).toBeCloseTo(0);
    expect(pick.z).toBeCloseTo(-MC.tcY * 0.01);
    expect(root.getObjectByName('carousel-side-drive-cover')).toBeTruthy();
    expect(m.driveShaft.getWorldPosition(new THREE.Vector3()).x).toBeLessThan(-3.8 * MC.K);
    const bridge = new THREE.Box3().setFromObject(m.saddle);
    expect(bridge.min.z).toBeGreaterThan(-12.3 * MC.K);
    expect(bridge.max.y).toBeLessThan(HERMLE_ENVELOPES[id].roof);
    expect(root.getObjectByName('magazine-support-drum')).toBeTruthy();
  });
  it('leaves the A flanges exposed and uses narrow rising arms rather than full-depth ears', () => {
    const { root, MC, PY } = setup(id);
    root.updateMatrixWorld(true);
    const cradle = root.getObjectByName('cast-A-cradle');
    const outerX = 6.4 * MC.K - 0.5;
    const outside = new THREE.Raycaster(new THREE.Vector3(outerX, PY + 5, 2), new THREE.Vector3(0, -1, 0));
    expect(outside.intersectObject(cradle)).toHaveLength(0);
    const front = new THREE.Raycaster(new THREE.Vector3(0, PY - MC.hA * 0.01 - 1.3, 10), new THREE.Vector3(0, 0, -1));
    const hits = front.intersectObject(cradle);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.z).toBeGreaterThan(2);
    expect(hits[0].face.normal.z).toBeGreaterThan(0.8);
  });
  it('opens each service leaf outward and keeps the cycle interlock active until fully closed', () => {
    const { root, model: m } = setup(id);
    expect(m.serviceDoors.filter((d) => !d.enabled)).toHaveLength(6);
    expect(m.serviceOpen()).toBe(false);
    for (const d of m.serviceDoors.filter((d) => !d.enabled)) {
      root.updateMatrixWorld(true);
      const origin = d.hinge.localToWorld(new THREE.Vector3(d.side * d.width * 0.7, d.height * 0.6, 1));
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(d.hinge.matrixWorld);
      const ray = new THREE.Raycaster(origin, direction, 0, 2);
      expect(ray.intersectObject(d.hinge, true).length).toBeGreaterThan(0);
      d.open = true;
      expect(m.serviceOpen()).toBe(true);
      for (let i = 0; i < 100; i++) m.updateServiceDoors(0.05);
      root.updateMatrixWorld(true);
      expect(d.hinge.rotation.y).toBeCloseTo((-d.side * Math.PI) / 2, 4);
      expect(ray.intersectObject(d.hinge, true)).toHaveLength(0);
      d.open = false;
      expect(m.serviceOpen()).toBe(true);
      for (let i = 0; i < 100; i++) m.updateServiceDoors(0.05);
      expect(m.serviceOpen()).toBe(false);
    }
  });
  it('models the shortened left cooling cover above the fixed tank and carries it with its service leaf', () => {
    const { root, model: m, MC } = setup(id),
      half = cabinHalfWidth(MC);
    const cover = root.getObjectByName('left-service-cooling-cover');
    expect(cover.getObjectByName('left-cooling-folded-shell').geometry.type).toBe('ExtrudeGeometry');
    expect(cover.getObjectByName('left-cooling-recessed-face')).toBeTruthy();
    expect(cover.getObjectByName('left-cooling-label-band')).toBeTruthy();
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(cover),
      size = bounds.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(12);
    expect(size.y).toBeLessThan(14);
    expect(size.y / size.z).toBeGreaterThan(2);
    expect(bounds.min.x).toBeLessThan(-half - 0.9);
    expect(bounds.max.x).toBeLessThan(-half);
    expect(bounds.min.y).toBeGreaterThan(7.4);
    expect(bounds.max.y).toBeLessThan(HERMLE_ENVELOPES[id].roof);
    expect(bounds.max.z).toBeLessThan(-4);
    const origin = cover.localToWorld(new THREE.Vector3(-1, 5.65, 3)),
      direction = new THREE.Vector3(0, 0, -1).transformDirection(cover.matrixWorld);
    expect(new THREE.Raycaster(origin, direction).intersectObject(cover, true)[0].object.name).toBe(
      'left-cooling-label-band',
    );
    const door = m.serviceDoors.find((d) => d.hinge === cover.parent);
    expect(cover.position.x - size.z / 2).toBeGreaterThan(0);
    expect(cover.position.x + size.z / 2).toBeLessThan(door.width);
    const before = cover.getWorldPosition(new THREE.Vector3());
    door.open = true;
    for (let i = 0; i < 100; i++) m.updateServiceDoors(0.05);
    root.updateMatrixWorld(true);
    expect(cover.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeGreaterThan(2);
    expect(new THREE.Box3().setFromObject(cover).max.x).toBeLessThan(-half);
  });
  it('has real side windows, raised logos and a compact cooler below the glass', () => {
    const { root } = setup(id);
    root.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
      const flank = root.getObjectByName(side + '-windowed-flank'),
        glass = root.getObjectByName(side + '-side-inspection-glass'),
        logo = root.getObjectByName(side + '-hermle-logo');
      expect(flank.geometry.parameters.shapes.holes).toHaveLength(1);
      expect(glass.material.transparent).toBe(true);
      glass.geometry.computeBoundingBox();
      const centre = glass.geometry.boundingBox.getCenter(new THREE.Vector3()),
        origin = glass.localToWorld(centre.clone().add(new THREE.Vector3(0, 0, 2))),
        direction = new THREE.Vector3(0, 0, -1).transformDirection(glass.matrixWorld);
      const ray = new THREE.Raycaster(origin, direction);
      expect(ray.intersectObject(flank)).toHaveLength(0);
      expect(ray.intersectObject(glass).length).toBeGreaterThan(0);
      expect(logo.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(21);
      expect(logo.geometry.parameters.width).toBeGreaterThan(4);
    }
    const cooler = new THREE.Box3().setFromObject(root.getObjectByName('right-side-heat-exchanger')),
      glass = new THREE.Box3().setFromObject(root.getObjectByName('right-side-inspection-glass'));
    expect(cooler.max.y).toBeLessThan(glass.min.y);
    expect(cooler.min.y).toBeGreaterThan(7);
  });
  it('keeps the model stripe fixed and mirrors the notched transparent door openings', () => {
    const { root, model: m } = setup(id),
      label = root.getObjectByName('fixed-model-stripe');
    root.updateMatrixWorld(true);
    const before = label.getWorldPosition(new THREE.Vector3());
    // Reference front photos: stripe is near the outer right edge, not the door jamb.
    expect(before.x).toBeGreaterThan(cabinHalfWidth(MODELS[id]) - 2);
    expect(before.x).toBeLessThan(cabinHalfWidth(MODELS[id]) - 0.8);
    expect(root.getObjectByName('model-stripe-lower-fold')).toBeTruthy();
    m.updateGeometry({ doorK: 0 });
    root.updateMatrixWorld(true);
    expect(label.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBe(0);
    const shapes = m.doors.map((d) =>
      d.getObjectByName('shaped-door-skin').geometry.parameters.shapes.holes[0].getPoints(),
    );
    shapes[0].forEach((p, i) => {
      expect(p.x).toBeCloseTo(-shapes[1][i].x);
      expect(p.y).toBe(shapes[1][i].y);
    });
    for (const d of m.doors) {
      const glass = d.getObjectByName('door-safety-glass');
      expect(glass.material.transparent).toBe(true);
      expect(glass.geometry.type).toBe('ShapeGeometry');
    }
  });
  it('leaves both side inspection sightlines clear of the mineral casting', () => {
    const { root, G, MC } = setup(id);
    root.updateMatrixWorld(true);
    for (const sign of [-1, 1])
      for (const y of [14.2, 16, 18])
        for (const z of [2.5, 4.5]) {
          const ray = new THREE.Raycaster(
            new THREE.Vector3(sign * (cabinHalfWidth(MC) + 1), y, z),
            new THREE.Vector3(-sign, 0, 0),
            0,
            cabinHalfWidth(MC) + 1,
          );
          expect(
            ray
              .intersectObject(G.lozko, true)
              .filter((h) => ['mineral-cast-bed-cheek', 'stainless-workspace-lining'].includes(h.object.name)),
          ).toHaveLength(0);
        }
  });
  it('keeps the low chip pan below the cabinet and slides it along X without duplicating the conveyor', () => {
    const { model: m, MC } = setup(id),
      { chipPan, update, equipment } = m.accessories;
    update({ accessorySetup: 'none' }, 0);
    const size = new THREE.Box3()
      .setFromObject(chipPan.object.getObjectByName('chip-drawer-open-tray'))
      .getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(size.z * 2);
    expect(size.y).toBeLessThan(2.5);
    chipPan.open = true;
    for (let i = 0; i < 100; i++) update({ accessorySetup: 'none' }, 0.05);
    expect(chipPan.object.position.x).toBeCloseTo((-17 * cabinHalfWidth(MC)) / 12.25, 4);
    update({ accessorySetup: 'conveyor' }, 0.05);
    expect(chipPan.object.visible).toBe(false);
    expect(chipPan.open).toBe(false);
    expect(equipment.conveyor.visible).toBe(true);
    expect(equipment.conveyor.getObjectByName('chip-conveyor-discharge-hood')).toBeTruthy();
    const bucket = m.accessories.chipCart;
    bucket.open = true;
    for (let i = 0; i < 100; i++) update({ accessorySetup: 'conveyor' }, 0.05);
    expect(bucket.object.rotation.z).toBeCloseTo(0.6, 4);
    for (let i = 0; i < 100; i++) update({ accessorySetup: 'conveyor', running: true }, 0.05);
    expect(bucket.object.rotation.z).toBeCloseTo(0, 4);
    equipment.coolant.updateWorldMatrix(true, true);
    const head = new THREE.Box3().setFromObject(equipment.coolant.getObjectByName('ICS-sloping-filter-housing'));
    expect(head.max.y - head.min.y).toBeLessThan(10);
    update({ accessorySetup: 'ics80cooler' }, 0);
    equipment.coolant.updateWorldMatrix(true, true);
    const coolantBounds = new THREE.Box3();
    for (const child of equipment.coolant.children)
      if (child.geometry?.type === 'BoxGeometry') coolantBounds.union(new THREE.Box3().setFromObject(child));
    expect(-cabinHalfWidth(MC) - coolantBounds.max.x).toBeGreaterThan((8 * cabinHalfWidth(MC)) / 12.25);
    const cooler = m.serviceDoors.find((d) => d.enabled);
    cooler.open = true;
    m.updateServiceDoors(0.1);
    expect(m.serviceOpen()).toBe(true);
    update({ accessorySetup: 'none' }, 0);
    m.updateServiceDoors(0.1);
    expect(cooler.open).toBe(false);
    expect(m.serviceOpen()).toBe(false);
  });
  it('has an open broad chip drawer, outboard pump and a real withdrawal opening in the base', () => {
    const { root, G, MC, model: m } = setup(id),
      { chipPan, update } = m.accessories,
      k = cabinHalfWidth(MC) / 12.25,
      half = cabinHalfWidth(MC);
    root.updateMatrixWorld(true);
    const tray = chipPan.object.getObjectByName('chip-drawer-open-tray'),
      pump = root.getObjectByName('chip-drawer-coolant-pump');
    const bounds = new THREE.Box3().setFromObject(tray),
      pumpBounds = new THREE.Box3().setFromObject(pump);
    // Latest photo correction: 680 mm projection, 290 mm setback; tray width 400 mm.
    expect((-half - bounds.min.x) / k).toBeCloseTo(6.8 + 0.125, 3);
    expect(bounds.getSize(new THREE.Vector3()).z / k).toBeCloseTo(4.12, 3);
    expect((8.6 * k - bounds.max.z) / k).toBeCloseTo(2.9 - 0.06, 3);
    expect(pumpBounds.max.x).toBeLessThan(-half);
    expect(pumpBounds.max.y).toBeGreaterThan(bounds.max.y);
    const ray = new THREE.Raycaster(new THREE.Vector3(-16 * k, 8, 3.7 * k), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObject(tray, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeLessThan(1.3 * k);
    // The tank must not slide through a solid bed or lower cabinet skin.
    for (const z of [1.9, 3.3, 4.3, 5.5]) {
      const opening = new THREE.Raycaster(
        new THREE.Vector3(-half - 1, 1.8 * k, z * k),
        new THREE.Vector3(1, 0, 0),
        0,
        half + 1 + 5.2 * k,
      );
      expect(opening.intersectObjects([G.lozko, m.cab], true)).toHaveLength(0);
    }
    let wheels = 0;
    chipPan.object.traverse((o) => {
      if (o.name === 'chip-drawer-wheel') wheels++;
    });
    expect(wheels).toBe(4);
    const fixedPump = pump.getWorldPosition(new THREE.Vector3());
    chipPan.open = true;
    update({ accessorySetup: 'none' }, 0.1);
    expect(chipPan.amount).toBeGreaterThan(0);
    expect(chipPan.amount).toBeLessThan(1);
    for (let i = 0; i < 100; i++) update({ accessorySetup: 'none' }, 0.05);
    root.updateMatrixWorld(true);
    expect(pump.getWorldPosition(new THREE.Vector3()).distanceTo(fixedPump)).toBe(0);
    // 1700 mm is additional to the closed 680 mm, not a 2380 mm translation.
    const extended = new THREE.Box3().setFromObject(tray);
    expect((bounds.min.x - extended.min.x) / k).toBeCloseTo(17, 4);
    expect((-half - extended.min.x) / k).toBeCloseTo(23.8 + 0.125, 3);
    chipPan.open = false;
    update({ accessorySetup: 'none' }, 0.1);
    expect(pump.parent.name).toBe('chip-drawer-fixed-reservoir');
    update({ accessorySetup: 'conveyor' }, 0.1);
    expect(chipPan.object.visible).toBe(false);
    expect(root.getObjectByName('chip-pan-guide-rails').visible).toBe(false);
    for (let i = 0; i < 100; i++) update({ accessorySetup: 'none' }, 0.05);
    expect(chipPan.object.position.x).toBeCloseTo(0, 4);
  });
  it('matches the photo with a lower folded reservoir, split lids and a stationary pump behind the drawer', () => {
    const { root, model: m } = setup(id),
      { chipPan, update } = m.accessories;
    root.updateMatrixWorld(true);
    const fixed = root.getObjectByName('chip-drawer-fixed-reservoir'),
      tank = new THREE.Box3().setFromObject(root.getObjectByName('chip-reservoir-folded-tank'));
    const tray = new THREE.Box3().setFromObject(chipPan.object.getObjectByName('chip-drawer-open-tray'));
    expect(tank.min.x).toBeCloseTo(tray.min.x, 1);
    expect(tank.max.z).toBeLessThan(tray.min.z);
    expect(tank.max.y).toBeLessThan(tray.max.y);
    expect(tank.getSize(new THREE.Vector3()).z).toBeLessThan(tray.getSize(new THREE.Vector3()).z);
    const pumpLid = new THREE.Box3().setFromObject(root.getObjectByName('chip-reservoir-pump-lid'));
    const forwardLid = new THREE.Box3().setFromObject(root.getObjectByName('chip-reservoir-recessed-lid'));
    expect(forwardLid.max.y).toBeLessThan(pumpLid.max.y);
    const before = new THREE.Box3().setFromObject(fixed);
    chipPan.open = true;
    for (let i = 0; i < 100; i++) update({ accessorySetup: 'none' }, 0.05);
    root.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(fixed).equals(before)).toBe(true);
    for (const accessorySetup of ['conveyor', 'ics40', 'ics80', 'ics80cooler']) {
      update({ accessorySetup }, 0.05);
      expect(fixed.visible).toBe(false);
    }
  });
  it('aligns the conveyor inlet with the same base outlet and keeps the external modules separated', () => {
    const { root, G, model: m, MC } = setup(id),
      k = cabinHalfWidth(MC) / 12.25,
      { equipment: e, update } = m.accessories;
    update({ accessorySetup: 'ics80cooler' }, 0);
    root.updateMatrixWorld(true);
    const inlet = new THREE.Box3().setFromObject(e.conveyor.getObjectByName('chip-conveyor-inlet'));
    expect(inlet.getCenter(new THREE.Vector3()).z / k).toBeCloseTo(3.7, 4);
    expect(inlet.max.x).toBeGreaterThan(-cabinHalfWidth(MC)); // enters the machine, not floating beside it
    for (const z of [2.3, 3.7, 5.1]) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(-cabinHalfWidth(MC) - 1, 3.2 * k, z * k),
        new THREE.Vector3(1, 0, 0),
        0,
        3,
      );
      expect(ray.intersectObjects([G.lozko, m.cab], true)).toHaveLength(0);
    }
    const cart = new THREE.Box3().setFromObject(e.conveyor.getObjectByName('chip-cart-chassis'));
    const tank = new THREE.Box3().setFromObject(e.coolant);
    expect(cart.min.z).toBeGreaterThan(tank.max.z); // no shifted cart through the ICS tank
  });
  it('matches the recessed front/side lower folds and keeps door aprons behind their upper skins', () => {
    const { root, model: m } = setup(id);
    root.updateMatrixWorld(true);
    for (const name of ['left-side-lower-fold', 'right-side-lower-fold']) {
      const fold = root.getObjectByName(name),
        p = fold.geometry.attributes.position;
      expect(Math.abs(p.getX(0)) - Math.abs(p.getX(2))).toBeCloseTo(1.8, 4);
      expect(p.getY(0) - p.getY(2)).toBeCloseTo(2.75, 4);
    }
    const fixed = [];
    root.traverse((o) => {
      if (o.name === 'fixed-front-lower-fold') fixed.push(o);
    });
    expect(fixed).toHaveLength(2);
    for (const fold of fixed) {
      const p = fold.geometry.attributes.position;
      expect(p.getZ(0) - p.getZ(2)).toBeCloseTo(2.2, 4);
    }
    for (const d of m.doors) {
      const fold = d.getObjectByName('sliding-door-lower-fold'),
        p = fold.geometry.attributes.position;
      expect(p.getZ(0) - p.getZ(2)).toBeCloseTo(2.2, 4);
      expect(p.getY(4)).toBeCloseTo(2.65, 4);
    }
    root.traverse((o) => {
      if (o.geometry) expect(Array.from(o.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
    });
  });
  it('keeps the chip floor and troughs inside closed door folds and tucks the levelling pads under the base', () => {
    const { root, G, model: m, MC } = setup(id);
    m.updateGeometry({ doorK: 0 });
    root.updateMatrixWorld(true);
    for (const x of [-2, -0.5, 0.5, 2])
      for (const y of [2.9, 3.6, 4.55, 4.7, 5.6, 6.3, 7.3]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 20), new THREE.Vector3(0, 0, -1));
        const front = ray.intersectObjects(m.doors, true)[0],
          inside = ray.intersectObject(G.lozko, true)[0];
        expect(front).toBeTruthy();
        if (inside) expect(inside.point.z).toBeLessThan(front.point.z - 0.05);
      }
    const pads = [];
    root.traverse((o) => {
      if (o.name === 'machine-levelling-pad') pads.push(o);
    });
    expect(pads).toHaveLength(4);
    for (const pad of pads) {
      const b = new THREE.Box3().setFromObject(pad),
        s = b.getSize(new THREE.Vector3());
      expect(s.x).toBeCloseTo(1.2, 4);
      expect(s.z).toBeCloseTo(1.4, 4);
      expect(b.max.z).toBeLessThan(6.4);
      expect(Math.max(Math.abs(b.min.x), Math.abs(b.max.x))).toBeLessThan(cabinHalfWidth(MC) - 1.8);
    }
    expect(new THREE.Box3().setFromObject(root.getObjectByName('recessed-stainless-chip-floor')).max.z).toBeCloseTo(
      6.1,
      4,
    );
  });
  it('keeps short trapezoidal bellows attached to the X slide across its full stroke', () => {
    const { root, model: m, MC } = setup(id),
      left = root.getObjectByName('left-trapezoid-bellows');
    for (const x of [MC.X[0] * 0.01, 0, MC.X[1] * 0.01]) {
      m.xG.position.x = x;
      m.updateAxes();
      root.updateMatrixWorld(true);
      const p = left.geometry.attributes.position;
      expect(p.getY(1) - p.getY(0)).toBeCloseTo(5.89, 3);
      expect(p.getX(0)).toBeGreaterThan(p.getX(1));
      const edge = new THREE.Vector3().fromBufferAttribute(p, p.count - 1);
      left.localToWorld(edge);
      expect(edge.x).toBeCloseTo(x - 1.32 * MC.K, 4);
      expect(left.geometry.boundingSphere.radius).toBeGreaterThan(0);
    }
  });
  it('keeps the physical TNC panel the same size and all manual controls attached during the arm sweep', () => {
    const { root, model: m } = setup(id);
    expect(Object.keys(m.hmi.controls.buttons)).toHaveLength(7);
    expect(root.getObjectByName('HMI-elbow')).toBeUndefined();
    expect(root.getObjectByName('HMI-rigid-cranked-arm').parent).toBe(m.armPivot);
    expect(m.panG.parent).toBe(m.armPivot);
    expect(m.armPivot.position.x).toBeLessThan(cabinHalfWidth(MODELS[id]));
    const mount = new THREE.Box3().setFromObject(root.getObjectByName('HMI-fixed-mounting-bracket'));
    expect(mount.max.x).toBeLessThan(cabinHalfWidth(MODELS[id]) + 0.05);
    for (let degrees = 0; degrees <= 180; degrees += 5) {
      const angle = (degrees * Math.PI) / 180;
      m.updateGeometry({ doorK: 0, panelA: angle });
      root.updateMatrixWorld(true);
      const panel = m.panG.getWorldPosition(new THREE.Vector3()),
        column = root.getObjectByName('HMI-terminal-column'),
        centre = column.getWorldPosition(new THREE.Vector3());
      expect(centre.x).toBeCloseTo(panel.x);
      expect(centre.z).toBeCloseTo(panel.z);
      expect(new THREE.Box3().setFromObject(column).getSize(new THREE.Vector3()).y).toBeCloseTo(6.8);
      expect(panel.x).toBeGreaterThan(cabinHalfWidth(MODELS[id]));
      const scale = m.panG.getWorldScale(new THREE.Vector3());
      scale.toArray().forEach((v) => expect(v).toBeCloseTo(1));
      const pose = hmiPose(degrees, 0, cabinHalfWidth(MODELS[id]));
      expect(panel.x).toBeCloseTo(pose.column[0]);
      expect(panel.z).toBeCloseTo(pose.column[1]);
      const columnBounds = new THREE.Box3().setFromObject(column);
      expect(columnBounds.min.x).toBeGreaterThan(cabinHalfWidth(MODELS[id]) + 1);
      m.updateGeometry({ doorK: 1, panelA: angle, panelYaw: Math.PI / 3 });
      root.updateMatrixWorld(true);
      expect(m.panG.getWorldPosition(new THREE.Vector3()).distanceTo(panel)).toBeCloseTo(0);
    }
    expect(m.accessories.equipment.conveyor.visible).toBe(false);
  });
  it('clears the base opening with the arm and the enclosure with the independently rotated console', () => {
    const { root, G, model: m, MC } = setup(id),
      half = cabinHalfWidth(MC);
    for (const degrees of [0, 30, 60, 90, 120, 150, 180]) {
      for (const trim of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) {
        m.updateGeometry({ doorK: 0, panelA: (degrees * Math.PI) / 180, panelYaw: (trim * Math.PI) / 180 });
        root.updateMatrixWorld(true);
        expect(new THREE.Box3().setFromObject(m.panG).min.x).toBeGreaterThan(half);
      }
      const origin = m.armPivot.localToWorld(new THREE.Vector3(0, 2.6, 0.6));
      const direction = new THREE.Vector3(0, 0, 1).transformDirection(m.armPivot.matrixWorld);
      expect(new THREE.Raycaster(origin, direction, 0, 7).intersectObjects([G.lozko, m.cab], true)).toHaveLength(0);
    }
  });
});
