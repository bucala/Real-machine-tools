import { drawTerminalKeyboard } from './terminalKeyboard';
import * as THREE from 'three';
import { modelKit } from './modelKit';
// Supplied close-up: silver square monitor in a red case, controls ABOVE the
// black keyboard, mouse to the right, separate pendant clipped beside the display.
export function createRmsPanel(parent, M, tex) {
  const { box, cyl, rod, group, label } = modelKit(parent, M, tex),
    controls = { buttons: {}, knobs: {}, duplicates: {} };
  box(parent, 0, 13.4, 0, 6.6, 5.2, 0.65, M.red);
  for (const x of [-3.15, 3.15]) box(parent, x, 13.4, 0.34, 0.08, 4.9, 0.08, M.steelD);
  box(parent, -0.35, 13.55, 0.35, 5.65, 4.65, 0.12, M.cab2);
  box(parent, -0.35, 13.55, 0.42, 4.75, 3.75, 0.04, M.black);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(4.48, 3.36),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
  );
  display.position.set(-0.35, 13.55, 0.45);
  parent.add(display);
  for (const x of [-3.12, 3.12]) for (const y of [11.02, 15.8]) cyl(parent, x, y, 0.35, 0.028, 0.025, M.steelD, 'z');
  for (let i = 0; i < 5; i++) cyl(parent, 1.18 + i * 0.15, 11.46, 0.43, 0.045, 0.04, M.steelD, 'z');
  const deck = group('RMS-keyboard-shelf', parent);
  deck.position.set(0, 10.87, 0.36);
  deck.rotation.x = 0.19;
  box(deck, 0, 0, 1.7, 7.3, 0.32, 4.8, M.red);
  box(deck, -0.45, 0.2, 2.15, 5.7, 0.16, 2.35, M.black);
  // Draw a readable PC keyboard as a single texture over the raised key field.
  const keys = tex(1024, 420, drawTerminalKeyboard);
  const keyFace = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 2.21),
    new THREE.MeshStandardMaterial({ map: keys.tx, roughness: 0.85 }),
  );
  keyFace.rotation.x = -Math.PI / 2;
  keyFace.position.set(-0.45, 0.295, 2.15);
  deck.add(keyFace);
  box(deck, 2.86, 0.19, 0.94, 1.05, 0.05, 1.3, M.steelD);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.37, 18, 12), M.black);
  mouse.scale.set(1, 0.38, 1.45);
  mouse.position.set(2.86, 0.29, 0.92);
  deck.add(mouse);
  rod(deck, [2.86, 0.43, 0.65], [2.86, 0.43, 1.03], 0.013, M.steelD);
  const wire = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.86, 0.24, 0.4),
    new THREE.Vector3(3.03, 0.22, -0.3),
    new THREE.Vector3(2.5, 0.25, -0.48),
  ]);
  deck.add(new THREE.Mesh(new THREE.TubeGeometry(wire, 16, 0.023, 6, false), M.black));
  // Physical controls on the upper deck are reachable and depress along its normal.
  const button = (id, x, z, material, r = 0.15) => {
    cyl(deck, x, 0.23, z, r + 0.045, 0.08, M.steelD);
    const b = cyl(deck, x, 0.32, z, r, 0.12, material);
    controls.buttons[id] = b;
    return b;
  };
  cyl(deck, 0.5, 0.26, -0.04, 0.31, 0.12, M.yellow);
  controls.buttons.emergency = cyl(deck, 0.5, 0.43, -0.04, 0.21, 0.22, M.red);
  button('hold', 1.08, -0.14, M.red);
  button('start', 1.17, 0.42, M.cab2);
  button('light', -0.15, 0.45, M.yellow);
  button('single', 1.8, 0.42, M.steelD);
  button('coolant', 1.8, -0.14, M.steelD);
  button('reset', -0.15, -0.15, M.steelD);
  for (const [id, x] of [
    ['feed', -2.15],
    ['rapid', -1.25],
  ]) {
    cyl(deck, x, 0.26, 0.24, 0.27, 0.13, M.steelD);
    const knob = group(id, deck);
    knob.position.set(x, 0.37, 0.24);
    cyl(knob, 0, 0.13, 0, 0.13, 0.32, M.black);
    box(knob, 0, 0.34, 0, 0.22, 0.12, 0.18, M.black);
    box(knob, 0, 0.406, 0, 0.12, 0.01, 0.025, M.cab2);
    controls.knobs[id] = knob;
  }
  // Removable handwheel pendant on a black bracket beside the monitor.
  const remote = group('RMS-handwheel-pendant', parent);
  remote.position.set(3.23, 13.4, 0.58);
  box(remote, 0, 0, 0, 1.02, 3.6, 0.35, M.black);
  box(remote, 0, 0.05, 0.2, 0.79, 3.35, 0.11, M.cab2);
  cyl(remote, 0, 1.38, 0.3, 0.29, 0.09, M.yellow, 'z');
  const remoteStop = cyl(remote, 0, 1.38, 0.42, 0.19, 0.18, M.red, 'z');
  controls.duplicates.emergency = [{ object: remoteStop, axis: 'z' }];
  for (const [x, id, material] of [
    [-0.18, 'start', M.cab2],
    [0.18, 'hold', M.red],
  ]) {
    box(remote, x, -0.2, 0.29, 0.23, 0.23, 0.08, M.steelD);
    const b = box(remote, x, -0.2, 0.35, 0.16, 0.16, 0.06, material);
    controls.duplicates[id] = [{ object: b, axis: 'z' }];
  }
  for (const y of [0.64, -0.55]) for (const x of [-0.2, 0.2]) cyl(remote, x, y, 0.33, 0.105, 0.1, M.steelD, 'z');
  label(remote, 'röders TEC', 0, 0.92, 0.32, 0.65, 0.24, { color: '#1e2527', background: '#a9b2b5', size: 90 });
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    cyl(remote, Math.sin(a) * 0.32, -1.05 + Math.cos(a) * 0.32, 0.31, 0.015, 0.025, M.steelD, 'z');
  }
  cyl(remote, 0, -1.05, 0.32, 0.29, 0.14, M.black, 'z');
  cyl(remote, 0.12, -1.1, 0.46, 0.065, 0.13, M.black, 'z');
  // White shelf/metal bracket attach to the articulated arm, with cable below.
  box(parent, 0, 10.1, 1.4, 7.0, 0.3, 3.7, M.cab2);
  box(parent, 0, 9.9, 0.45, 4.4, 0.25, 1.5, M.steelD);
  const paper = box(parent, -0.7, 17.35, -0.4, 3.5, 2.4, 0.07, M.cab2);
  paper.rotation.x = -0.35;
  rod(parent, [1, 10, -0.4], [1, 16.3, -0.4], 0.07, M.steelD);
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.23, 11.6, 0.5),
    new THREE.Vector3(3.6, 7, 0.2),
    new THREE.Vector3(0.6, 5.8, 0.1),
    new THREE.Vector3(-1.2, 7, 0.3),
    new THREE.Vector3(-1.5, 10, 0.3),
  ]);
  parent.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 36, 0.055, 8, false), M.black));
  return { display, controls, knobAxis: 'y', pressAxis: () => 'y' };
}
