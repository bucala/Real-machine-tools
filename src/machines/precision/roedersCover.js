import * as THREE from 'three';

// User STEP: two reference solids, not a replacement machine. Scene = 100 mm.
// Alignment: STEP mm -> [(X-734)/100, (Y+2)/100, (Z-1256.75012207)/100].
export const RXU_COVER = {
  left: -16.1,
  right: 11.07,
  cheek: -11.1,
  rearZ: 2.49,
  frontZ: 4.14389,
  lowerY: 21.321843,
  upperY: 26.657961,
  top: 35.5,
  portalLeft: -9.5,
  portalRight: 4.3,
  portalTop: 28.2,
  wedgeFaces: [
    [
      [-15.934192, 23.84893, 2.595956],
      [-11.1, 23.022651, 5.261864],
      [-11.1, 25.992968, 3.93778],
      [-15.005775, 26.660558, 1.783866],
    ],
    [
      [-15.005775, 21.989433, 0.336085],
      [-11.1, 21.321843, 2.49],
      [-11.1, 23.022651, 5.261864],
      [-15.934192, 23.84893, 2.595956],
    ],
    [
      [-15.005775, 26.660558, 1.783866],
      [-11.1, 25.992968, 3.93778],
      [-11.1, 21.321843, 2.49],
      [-15.005775, 21.989433, 0.336085],
    ],
    [
      [-15.934192, 23.84893, 2.595956],
      [-15.005775, 26.660558, 1.783866],
      [-15.005775, 21.989433, 0.336085],
    ],
    [
      [-11.1, 23.022651, 5.261864],
      [-11.1, 21.321843, 2.49],
      [-11.1, 25.992968, 3.93778],
    ],
  ],
};

export function createRoedersCover({ cab, M, group, box, cyl, rod, label, bolts, plate, foldedShell }) {
  const R = RXU_COVER,
    cover = group('STEP-derived-upper-cover', cab);
  const sheet = (name, vertices, material = M.cab) => {
    const triangles = [];
    for (let i = 1; i < vertices.length - 1; i++) triangles.push([0, i, i + 1], [i + 1, i, 0]);
    return foldedShell(cover, name, vertices, triangles, material);
  };
  // Keep only the skins of the reference solids. The central opening is sized
  // around the existing travelling spindle, so the reference block cannot fill it.
  box(cover, (R.left + R.right) / 2, 35.35, (4.14389 - 22.8) / 2, R.right - R.left, 0.3, 26.94389, M.cab2);
  box(
    cover,
    (R.left + R.right) / 2,
    (R.top + R.portalTop) / 2,
    R.frontZ,
    R.right - R.left,
    R.top - R.portalTop,
    0.12,
    M.cab,
  );
  for (const [a, b] of [
    [R.left, R.portalLeft],
    [R.portalRight, R.right],
  ]) {
    box(cover, (a + b) / 2, (R.upperY + R.portalTop) / 2, R.frontZ, b - a, R.portalTop - R.upperY, 0.12, M.cab);
    sheet(`sloped-portal-fascia-${a}`, [
      [a, R.lowerY, R.rearZ],
      [b, R.lowerY, R.rearZ],
      [b, R.upperY, R.frontZ],
      [a, R.upperY, R.frontZ],
    ]);
    box(cover, (a + b) / 2, (7.2 + R.lowerY) / 2, R.rearZ, b - a, R.lowerY - 7.2, 0.12, M.cab);
  }
  const sideProfile = [
    [-0.5, 7.2],
    [R.rearZ, 7.2],
    [R.rearZ, R.lowerY],
    [R.frontZ, R.upperY],
    [R.frontZ, R.top],
    [-0.5, R.top],
  ];
  for (const x of [R.left]) {
    const g = group('tower-profile-return', cover);
    g.position.x = x;
    g.rotation.y = -Math.PI / 2;
    plate(g, 'STEP-tower-side-profile', sideProfile, 0.12, M.cab, [], 0);
  }
  for (const x of [-11.5, 6.7]) {
    box(cover, x, 31.55, R.frontZ + 0.08, 3.6, 3.2, 0.04, M.dark);
    box(cover, x, 31.55, R.frontZ + 0.11, 3.52, 3.12, 0.04, M.cab);
    bolts(cover, x, 31.55, R.frontZ + 0.15, 3.2, 2.8);
  }
  // Interior jambs follow the measured ramp rather than a vertical rectangular
  // portal. Their rear edges leave the working travel behind the opening free.
  for (const x of [R.portalLeft, R.portalRight]) {
    sheet(
      `inclined-portal-reveal-${x}`,
      [
        [x, R.lowerY, R.rearZ],
        [x, R.upperY, R.frontZ],
        [x, R.upperY, R.frontZ - 1.15],
        [x, R.lowerY, R.rearZ - 1.15],
      ],
      M.cab2,
    );
    const left = x === R.portalLeft ? x : x - 1.0;
    for (let i = 0; i < 22; i++) {
      const t = i / 22,
        u = (i + 0.86) / 22;
      const y = R.lowerY + (R.upperY - R.lowerY) * t,
        z = R.rearZ + (R.frontZ - R.rearZ) * t - 0.08;
      const y1 = R.lowerY + (R.upperY - R.lowerY) * u,
        z1 = R.rearZ + (R.frontZ - R.rearZ) * u - 0.08;
      sheet(
        'inclined-portal-bellows',
        [
          [left, y, z],
          [left + 1, y, z],
          [left + 1, y1, z1],
          [left, y1, z1],
        ],
        M.black,
      );
    }
  }
  sheet(
    'portal-upper-reveal',
    [
      [R.portalLeft, R.portalTop, R.frontZ],
      [R.portalRight, R.portalTop, R.frontZ],
      [R.portalRight, R.portalTop, R.frontZ - 1.15],
      [R.portalLeft, R.portalTop, R.frontZ - 1.15],
    ],
    M.cab2,
  );
  // The second STEP solid supplies the actual compound wedge, with all five
  // planar faces intact. It is outside the machining bay, not a plugged aperture.
  R.wedgeFaces.forEach((face, i) => sheet(`STEP-side-wedge-${i}`, face));
  const upperRim = group('fixed-left-door-rebate', cover);
  upperRim.position.x = R.cheek;
  upperRim.rotation.y = -Math.PI / 2;
  plate(
    upperRim,
    'left-cheek-above-wedge',
    [
      [4.14389, 28.5],
      [10.65, 28.5],
      [10.65, 28.26],
      [4.3, 28.26],
      [4.08778, 26.072968],
      [5.411864, 22.902651],
      [5.261864, 23.022651],
      [3.93778, 25.992968],
    ],
    0.1,
    M.cab,
    [],
    0,
  );
  sheet('front-hood-roof', [
    [R.cheek, 28.5, R.frontZ],
    [R.right, 28.5, R.frontZ],
    [R.right, 28.5, 10.65],
    [R.cheek, 28.5, 10.65],
  ]);
  sheet('front-hood-roof-fold', [
    [R.cheek, 28.5, 10.65],
    [R.right, 28.5, 10.65],
    [R.right, 28.2, 11.2],
    [R.cheek, 28.2, 11.2],
  ]);
  // One continuous right skin, including the tall tower and lower front hood.
  // The previous separate boxes left a 131 mm slot behind the front fascia.
  const right = group('continuous-right-enclosure', cab);
  right.position.x = R.right;
  right.rotation.y = -Math.PI / 2;
  plate(
    right,
    'right-enclosure-skin',
    [
      [-22.8, 7.1],
      [11.2, 7.1],
      [11.2, 28.2],
      [10.65, 28.5],
      [R.frontZ, 28.5],
      [R.frontZ, R.top],
      [-22.8, R.top],
    ],
    0.16,
    M.cab,
    [
      [
        [-7.2, 10],
        [-3, 10],
        [-3, 15.5],
        [-7.2, 15.5],
      ],
    ],
    0,
  );
  for (const y of [7.3, 28.2]) rod(right, [-22.6, y, 0.17], [-0.6, y, 0.17], 0.025, M.cab2);
  for (const z of [-21, -12, -1]) for (const y of [8, 18, 27, 34]) cyl(right, z, y, -0.025, 0.04, 0.035, M.steelD, 'z');

  // The white side door wraps around both folds; the glass has the same lower
  // slope, then a vertical step into its taller front viewing pane (photo).
  const slope = (23.022651 - R.lowerY) / (5.261864 - R.rearZ);
  const outline = [
    [R.rearZ + 0.15, 7.2],
    [10.2, 7.2],
    [10.2, 28.2],
    [4.3, 28.2],
    [4.08778, 26.072968],
    [5.411864, 22.902651],
    [R.rearZ + 0.15, R.lowerY - 0.12],
  ];
  const aperture = [
    [3.3, 9.8],
    [9.45, 9.8],
    [9.45, 25.0],
    [6.15, 25.0],
    [6.15, 22.5],
    [3.3, 22.5 - (6.15 - 3.3) * slope],
  ];
  const hinge = group('left-access-door-hinge', cab);
  hinge.position.set(R.cheek - 0.04, 0, 10.2);
  const side = group('left-window-cheek', hinge);
  side.position.z = -10.2;
  side.rotation.y = -Math.PI / 2;
  plate(side, 'left-window-sheet-metal', outline, 0.1, M.cab, [aperture], 0.015);
  // Recessed rebate closes the edge joints while leaving the entire door clear.
  const rebate = group('left-door-inner-rebate', cab);
  rebate.position.set(R.cheek + 0.1, 0, 0);
  rebate.rotation.y = -Math.PI / 2;
  const inside = outline.map(([z, y]) => [z + (6.4 - z) * 0.065, y + (17.7 - y) * 0.025]);
  plate(rebate, 'continuous-left-door-frame', outline, 0.12, M.cab2, [inside], 0);
  const glass = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape(aperture.map((p) => new THREE.Vector2(...p)))),
    M.glass,
  );
  glass.name = 'left-observation-window';
  glass.position.z = 0.115;
  side.add(glass);
  for (let i = 0; i < aperture.length; i++)
    rod(side, [...aperture[i], 0.14], [...aperture[(i + 1) % aperture.length], 0.14], 0.055, M.black);
  const jamb = group('left-door-front-jamb', cab);
  jamb.position.x = R.cheek;
  jamb.rotation.y = -Math.PI / 2;
  plate(
    jamb,
    'fixed-front-side-strip',
    [
      [10.26, 7.1],
      [11.2, 7.1],
      [11.2, 28.2],
      [10.26, 28.2],
    ],
    0.14,
    M.cab,
    [],
    0,
  );
  for (const y of [8.8, 17.9, 26.8]) {
    box(side, 10.15, y, 0.2, 0.42, 0.52, 0.13, M.black);
    for (const dx of [-0.12, 0.12])
      for (const dy of [-0.16, 0.16]) cyl(side, 10.15 + dx, y + dy, 0.285, 0.035, 0.035, M.steel, 'z');
  }
  rod(side, [3.0, 13, 0.32], [3.0, 15, 0.32], 0.075, M.black);
  for (const y of [13, 15]) rod(side, [3, y, 0.12], [3, y, 0.32], 0.065, M.steelD);
  label(side, 'CAUTION', 7.7, 9.0, 0.17, 2.2, 0.35, { size: 100, background: '#e6e8ea' });
  const door = {
    hinge,
    label: 'Ľavé dvierka pracovného priestoru',
    labelEn: 'Left work-area door',
    open: false,
    angle: 0,
  };
  return {
    serviceDoors: [door],
    serviceOpen: () => door.open || Math.abs(door.angle) > 0.01,
    updateServiceDoors: (dt) => {
      door.angle = THREE.MathUtils.damp(door.angle, door.open ? Math.PI / 2 : 0, 5, dt);
      hinge.rotation.y = door.angle;
    },
  };
}
