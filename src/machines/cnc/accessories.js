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
  const drawer = new THREE.Group(); drawer.scale.setScalar(scale); parent.add(drawer);
  box(drawer, -11.8, 2.1, 0, 1.2, 1.6, 7.2, M.cab2);
  box(drawer, -12.45, 2.2, 0, .12, .18, 1.4, M.black);
  pipe(drawer, [[-12.5, 2.2, -.7], [-12.7, 2.2, -.7], [-12.7, 2.2, .7], [-12.5, 2.2, .7]], .06, M.steelD);
  const conveyor = group('conveyor');
  box(conveyor, -12.8, 2.3, 0, 6.8, 1.8, 3.4, M.cab2); // sealed inlet connected to the bed
  box(conveyor, -12.8, 3.23, 0, 6.8, .12, 2.65, M.dark);
  const start = [-16, 3.2, 0], end = [-22.5, 9.2, 0];
  beam(conveyor, start, end, 1.15, 3.4, M.cab2);
  const belt = beam(conveyor, [-15.55, 3.55, 0], [-22.05, 9.55, 0], .14, 2.65, M.dark);
  for (const z of [-1.55, 1.55]) beam(conveyor, [-15.7, 3.6, z], [-22.2, 9.6, z], .8, .18, M.cab2);
  const flights = [];
  for (let i = 0; i < 14; i++) flights.push(box(conveyor, 0, 0, 0, .12, .18, 2.5, M.steelD));
  box(conveyor, -23.4, 9.4, 0, 3.1, 1.65, 3.6, M.cab2); // discharge hood
  box(conveyor, -24.5, 8.4, 0, 1.2, 1.3, 2.7, M.dark);
  const motor = cylinder(conveyor, -22.6, 9.8, -2.4, .65, 1.8, M.steelD); motor.rotation.x = Math.PI / 2;
  cylinder(conveyor, -22.6, 9.8, -3.2, .72, .12, M.dark).rotation.x = Math.PI / 2;
  beam(conveyor, [-19.7, 1, -1.4], [-19.7, 5.5, -1.4], .25, .25, M.steelD);
  beam(conveyor, [-19.7, 1, 1.4], [-19.7, 5.5, 1.4], .25, .25, M.steelD);
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

  for (let i = 0; i < 8; i++) box(conveyor, -27.7 + i * .75, 7.02, 2.35, .75, .28, .08, i % 2 ? M.black : M.yellow);

  const coolant = group('coolant');
  box(coolant, -28.6, 2.5, -6.4, 7, 3.5, 6, M.cab2); // coolant tank
  box(coolant, -28.6, 4.35, -6.4, 7.2, .2, 6.2, M.steel);
  box(coolant, -29.7, 8.6, -6.4, 4.4, 8.3, 5.7, M.cab); // filter cabinet
  for (const y of [6.7, 10.4]) {
    box(coolant, -29.7, y, -3.48, 4.05, 3.35, .1, M.cab2);
    box(coolant, -29.7, y + .65, -3.38, .6, .16, .1, M.black);
  }
  const filterTop = new THREE.Shape();
  filterTop.moveTo(-31.9, 12.75); filterTop.lineTo(-27.5, 12.75); filterTop.lineTo(-27.5, 14.1); filterTop.lineTo(-30.7, 14.1); filterTop.closePath();
  const filterCover = new THREE.Mesh(new THREE.ExtrudeGeometry(filterTop, { depth: 5.7, bevelEnabled: false }), M.cab2); filterCover.position.z = -9.25; coolant.add(filterCover);
  box(coolant, -28.8, 14.15, -6.4, 1.8, .15, 2, M.dark);
  const pump40 = new THREE.Group(); pump40.name = 'ICS40'; coolant.add(pump40);
  box(pump40, -26.4, 6.4, -6.4, 1.4, 4.2, 2.6, M.steelD);
  cylinder(pump40, -26.4, 9, -6.4, .6, 1.2, M.dark);
  const pump80 = new THREE.Group(); pump80.name = 'ICS80'; coolant.add(pump80);
  for (const z of [-7.5, -5.3]) {
    cylinder(pump80, -26.2, 7.2, z, .55, 5.4, M.steelD);
    cylinder(pump80, -26.2, 10.3, z, .7, 1.5, M.anth);
    box(pump80, -26.2, 11.15, z, 1.1, .2, 1.1, M.dark);
  }
  box(coolant, -26.5, 9.3, -3.45, 1.25, 1.7, .35, M.anth);
  const lamp = cylinder(coolant, -26.5, 9.6, -3.2, .13, .1, M.red); lamp.rotation.x = Math.PI / 2;
  pipe(coolant, [[-25.7, 5, -7.7], [-23, 4, -9], [-17, 1.2, -10], [-11.2, 2, -9]], .16);
  pipe(coolant, [[-25.7, 5.5, -7.2], [-23, 5.2, -8], [-17, 2, -9], [-11.2, 2.4, -8.5]], .12, M.steelD);
  wheels(coolant, -28.6, -6.4, 6.3, 5.2);

  const recooler = group('recooler');
  box(recooler, -36.5, 6.8, -6.4, 5.2, 11.8, 5.4, M.cab2);
  for (const y of [3.4, 7.2, 10.8]) box(recooler, -36.5, y, -3.64, 4.8, .09, .12, M.dark);
  cylinder(recooler, -36.5, 12.8, -6.4, 2.25, .25, M.dark);
  for (let i = 0; i < 9; i++) {
    const x = -38.3 + i * .45, half = Math.sqrt(Math.max(0, 2.1 ** 2 - (x + 36.5) ** 2));
    box(recooler, x, 12.96, -6.4, .07, .05, half * 2, M.steelD);
  }
  for (let i = 0; i < 12; i++) box(recooler, -39.14, 3 + i * .65, -6.4, .1, .18, 4.6, M.dark);
  pipe(recooler, [[-33.9, 3, -7.5], [-33.1, 2, -8.7], [-31.8, 2.5, -9]], .12);
  pipe(recooler, [[-33.9, 3.5, -7.1], [-33.1, 2.5, -8.3], [-31.8, 3, -8.6]], .12, M.steelD);
  wheels(recooler, -36.5, -6.4, 4.6, 4.8);

  let phase = 0;
  const update = (state, dt) => {
    const mode = state.accessorySetup || 'none';
    drawer.visible = mode === 'none';
    conveyor.visible = ['conveyor', 'ics40', 'ics80', 'ics80cooler'].includes(mode);
    coolant.visible = ['ics40', 'ics80', 'ics80cooler'].includes(mode);
    pump40.visible = mode === 'ics40'; pump80.visible = mode === 'ics80' || mode === 'ics80cooler';
    recooler.visible = mode === 'ics80cooler';
    if (state.running && conveyor.visible) phase = (phase + dt * .22) % 1;
    flights.forEach((f, i) => {
      const u = (i / flights.length + phase) % 1;
      f.position.set(-15.55 - 6.5 * u, 3.72 + 6 * u, 0); f.quaternion.copy(belt.quaternion);
    });
  };
  update({}, 0);
  return { equipment, update };
}
