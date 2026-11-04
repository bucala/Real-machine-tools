import * as THREE from 'three';

// Optional external equipment, in the same 100 mm scene units as the cabin.
// Approximate arrangement from the C42 reference: conveyor + chip cart, coolant/filter unit.
export function createAccessories(parent, M, scale) {
  const equipment = {};
  const group = (name) => {
    const g = new THREE.Group(); g.name = name; g.scale.setScalar(scale); g.visible = false; parent.add(g); equipment[name] = g; return g;
  };
  const box = (g, x, y, z, w, h, d, mat = M.cab2) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  const cylinder = (g, x, y, z, r, h, mat = M.steelD) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  const beam = (g, start, end, width, depth, mat) => {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), delta = b.clone().sub(a);
    const m = box(g, 0, 0, 0, width, delta.length(), depth, mat); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
  };
  const pipe = (g, points, radius = .1, mat = M.black) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), mat); g.add(m); return m;
  };
  const wheels = (g, x, z, width, depth) => {
    for (const dx of [-width / 2, width / 2]) for (const dz of [-depth / 2, depth / 2]) {
      box(g, x + dx, .72, z + dz, .15, .45, .4, M.steel);
      const w = cylinder(g, x + dx, .35, z + dz, .3, .22, M.black); w.rotation.z = Math.PI / 2;
    }
  };
  const conveyor = group('conveyor');
  box(conveyor, -12.8, 2.3, 0, 6.8, 1.8, 3.4, M.cab2); // sealed inlet connected to the bed
  box(conveyor, -12.8, 3.23, 0, 6.8, .12, 2.65, M.dark);
  const start = [-16, 3.2, 0], end = [-22.5, 12, 0];
  beam(conveyor, start, end, 1.15, 3.4, M.cab2);
  const belt = beam(conveyor, [-15.55, 3.55, 0], [-22.05, 12.35, 0], .14, 2.65, M.dark);
  const flights = [];
  for (let i = 0; i < 14; i++) flights.push(box(conveyor, 0, 0, 0, .12, .18, 2.5, M.steelD));
  box(conveyor, -23.4, 12.2, 0, 3.1, 1.65, 3.6, M.cab2); // discharge hood
  box(conveyor, -24.5, 11.2, 0, 1.2, 1.3, 2.7, M.dark);
  const motor = cylinder(conveyor, -22.6, 12.6, -2.4, .65, 1.8, M.steelD); motor.rotation.x = Math.PI / 2;
  cylinder(conveyor, -22.6, 12.6, -3.2, .72, .12, M.dark).rotation.x = Math.PI / 2;
  beam(conveyor, [-19.7, 1, -1.4], [-19.7, 7.4, -1.4], .25, .25, M.steelD);
  beam(conveyor, [-19.7, 1, 1.4], [-19.7, 7.4, 1.4], .25, .25, M.steelD);
  wheels(conveyor, -19.7, 0, .6, 3.2);
  // Open, tapered chip cart; the dark interior is below the open rim.
  box(conveyor, -25, 1.1, 0, 3.8, .3, 4.3, M.cab2);
  for (const z of [-2.2, 2.2]) {
    const shape = new THREE.Shape(); shape.moveTo(-26.9, 1.2); shape.lineTo(-23.1, 1.2); shape.lineTo(-21.9, 7); shape.lineTo(-28.1, 7); shape.closePath();
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: false }), M.cab2); wall.position.z = z; wall.castShadow = true; conveyor.add(wall);
    box(conveyor, -25, 7, z, 6.5, .18, .22, M.steel);
  }
  beam(conveyor, [-26.9, 1.2, 0], [-28.1, 7, 0], .14, 4.4, M.cab2);
  beam(conveyor, [-23.1, 1.2, 0], [-21.9, 7, 0], .14, 4.4, M.cab2);
  box(conveyor, -25, 1.32, 0, 3.6, .1, 4.15, M.dark);
  pipe(conveyor, [[-28, 6.8, 1.5], [-28.6, 6.3, 1.5], [-28.6, 6.3, -1.5], [-28, 6.8, -1.5]], .1, M.steelD);
  wheels(conveyor, -25, 0, 3.4, 3.8);

  const coolant = group('coolant');
  box(coolant, -28.6, 2.5, -6.4, 7, 3.5, 6, M.cab2); // coolant tank
  box(coolant, -28.6, 4.35, -6.4, 7.2, .2, 6.2, M.steel);
  box(coolant, -29.7, 8.6, -6.4, 4.4, 8.3, 5.7, M.cab); // filter cabinet
  for (const y of [6.7, 10.4]) {
    box(coolant, -29.7, y, -3.48, 4.05, 3.35, .1, M.cab2);
    box(coolant, -29.7, y + .65, -3.38, .6, .16, .1, M.black);
  }
  cylinder(coolant, -29.7, 12.9, -6.4, 1.85, .35, M.cab2);
  cylinder(coolant, -29.7, 13.15, -6.4, 1.65, .15, M.black);
  box(coolant, -26.4, 6.4, -6.4, 1.4, 4.2, 2.6, M.steelD); // pump
  cylinder(coolant, -26.4, 9, -6.4, .6, 1.2, M.dark);
  box(coolant, -26.5, 9.3, -3.45, 1.25, 1.7, .35, M.anth);
  const lamp = cylinder(coolant, -26.5, 9.6, -3.2, .13, .1, M.red); lamp.rotation.x = Math.PI / 2;
  pipe(coolant, [[-25.7, 5, -7.7], [-23, 4, -9], [-17, 1.2, -10], [-11.2, 2, -9]], .16);
  pipe(coolant, [[-25.7, 5.5, -7.2], [-23, 5.2, -8], [-17, 2, -9], [-11.2, 2.4, -8.5]], .12, M.steelD);
  wheels(coolant, -28.6, -6.4, 6.3, 5.2);

  let phase = 0;
  const update = (state, dt) => {
    conveyor.visible = !!state.chipConveyor; coolant.visible = !!state.coolantUnit;
    if (state.running && state.chipConveyor) phase = (phase + dt * .22) % 1;
    flights.forEach((f, i) => {
      const u = (i / flights.length + phase) % 1;
      f.position.set(-15.55 - 6.5 * u, 3.72 + 8.8 * u, 0); f.quaternion.copy(belt.quaternion);
    });
  };
  update({}, 0);
  return { equipment, update };
}
