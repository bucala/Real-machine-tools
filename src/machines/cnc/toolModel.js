// Common millimetre profile for spindle, magazine and tool-table illustrations.
import * as THREE from 'three';

export function toolProfile(t) {
  const r = t.d / 2,
    cr = Math.min(t.cr || 0, r),
    points = [];
  if (t.kind === 'cone') {
    const h = Math.min(t.lc, r / Math.tan(((t.tip || 118) * Math.PI) / 360));
    points.push([0, -t.l], [r, -t.l + h]);
  } else if (cr > 0) {
    points.push([0, -t.l], [r - cr, -t.l]);
    for (let i = 1; i <= 12; i++) {
      const a = ((i / 12) * Math.PI) / 2;
      points.push([r - cr + cr * Math.sin(a), -t.l + cr * (1 - Math.cos(a))]);
    }
  } else points.push([0, -t.l], [r, -t.l]);
  points.push([r, -t.l + t.lc], [0, -t.l + t.lc]);
  return points;
}
export function holderProfile(t) {
  const end = -(t.l - t.s),
    r = t.dh / 2;
  // HSK-A63 flange, gripper groove, tapered holder body and collet nose.
  return [
    [0, 0],
    [25, 0],
    [31.5, -2],
    [31.5, -7],
    [27, -9],
    [27, -13],
    [31.5, -15],
    [31.5, -20],
    [26, -23],
    [r, end + 10],
    [r, end + 2],
    [r * 0.9, end],
    [0, end],
  ];
}
export function createToolModel(t, materials) {
  const g = new THREE.Group();
  const lathe = (profile, material) => {
    const mesh = new THREE.Mesh(
      new THREE.LatheGeometry(
        profile.map(([r, y]) => new THREE.Vector2(r * 0.01, y * 0.01)),
        32,
      ),
      material,
    );
    mesh.castShadow = true;
    g.add(mesh);
  };
  lathe(holderProfile(t).slice().reverse(), materials.holder);
  const rs = Math.min(t.d, 20) / 2;
  if (t.s > t.lc)
    lathe(
      [
        [0, -t.l + t.lc],
        [rs, -t.l + t.lc],
        [rs, -t.l + t.s],
        [0, -t.l + t.s],
      ],
      materials.tool,
    );
  lathe(toolProfile(t), materials.coat);
  // Helical flute lines follow the cutting envelope, not an oversized decorative cylinder.
  const profile = toolProfile(t);
  for (let i = 0; i < t.z; i++) {
    const pts = [];
    for (let j = 0; j <= 32; j++) {
      const y = -t.l + 0.2 + ((t.lc - 0.4) * j) / 32;
      let radius = t.d / 2;
      for (let k = 1; k < profile.length; k++) {
        const [r0, y0] = profile[k - 1],
          [r1, y1] = profile[k];
        if (y >= y0 && y <= y1 && y1 > y0) {
          radius = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
          break;
        }
      }
      const a = (i * Math.PI * 2) / t.z + (j / 32) * 2.1;
      pts.push(new THREE.Vector3(Math.cos(a) * radius * 0.01, y * 0.01, Math.sin(a) * radius * 0.01));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), materials.flute);
    g.add(line);
  }
  return g;
}
