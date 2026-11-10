// 3D model laseru Amada BREVIS 1212 AJ (mierka 1 = 100 mm, obsluha vpredu +z). Rozmery podľa letáku Amada:
// 3 088 × 2 389 × 1 900 mm. Vizuálna rekonštrukcia podľa fotografií – tvary, farby a polepy sú zjednodušené.
import * as THREE from 'three';

export const BV = {
  TY: 9.0, // horná hrana lamiel stola (výška pracovnej roviny)
  SX: -3.2, // stred tabule (x)
  SZ: 0, // stred tabule (z)
  HALF: 6.25, // polovica tabule 1 250 mm
  DOOR_Y: 17.8, // os výklopných dverí
  FZ: 11.85, // čelo stroja
  DRAWER: 10.5, // vysunutie stola
};
// súradnice programu (mm, počiatok v ľavom prednom rohu tabule) → svet
export const sheetToWorld = (u, v) => [BV.SX - BV.HALF + u / 100, BV.SZ + BV.HALF - v / 100];

const canvasTex = (w, h, draw) => {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (!g) return null;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

export function buildBrevis({ kit, det, M, grp }) {
  const { add, box, cylX, cylY, cylZ, hitProxy } = kit;
  const { rbox, cable, bolts } = det;
  // polep: priehľadný obdĺžnik s textúrou otočený k +z v rodičovi (ry pre bočné steny)
  const decal = (p, w, h, draw, x, y, z, ry = 0, px = 512) => {
    const tx = canvasTex(px, Math.round((px * h) / w), draw);
    if (!tx) return null;
    const m = add(
      p,
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.5, metalness: 0.1, depthWrite: false }),
      x,
      y,
      z,
    );
    m.rotation.y = ry;
    m.userData.noMerge = true;
    m.castShadow = false;
    m.renderOrder = 2;
    return m;
  };
  const logo = (g, w, h, color = '#D7262E', sub) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    // stilizovaný znak (trojuholník s výrezom) a nápis AMADA
    const s = h * 0.78;
    g.beginPath();
    g.moveTo(s * 0.1, h * 0.88);
    g.lineTo(s * 0.5, h * 0.12);
    g.lineTo(s * 0.9, h * 0.88);
    g.closePath();
    g.fill();
    g.fillStyle = sub || '#FFFFFF';
    g.fillRect(s * 0.36, h * 0.55, s * 0.28, h * 0.33);
    g.fillStyle = color;
    g.font = `bold ${Math.round(h * 0.82)}px Arial, Helvetica, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('AMADA', s * 1.05, h * 0.55);
  };
  const textDraw =
    (txt, color, { font = 'bold italic', size = 0.7, align = 'left', bg = null } = {}) =>
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      if (bg) {
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
      }
      g.fillStyle = color;
      g.font = `${font} ${Math.round(h * size)}px Arial, Helvetica, sans-serif`;
      g.textAlign = align;
      g.textBaseline = 'middle';
      g.fillText(txt, align === 'center' ? w / 2 : align === 'right' ? w - 6 : 6, h / 2);
    };
  const stripes =
    (n, color = '#D7262E') =>
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = color;
      for (let i = 0; i < n; i++) g.fillRect(0, (i * h) / n + h / n / 4, w, h / n / 2);
    };
  const warn = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#F2C200';
    g.beginPath();
    g.moveTo(w / 2, h * 0.06);
    g.lineTo(w * 0.96, h * 0.92);
    g.lineTo(w * 0.04, h * 0.92);
    g.closePath();
    g.fill();
    g.lineWidth = w * 0.05;
    g.strokeStyle = '#111';
    g.stroke();
    g.strokeStyle = '#111';
    g.lineWidth = w * 0.035;
    g.beginPath();
    g.arc(w / 2, h * 0.62, w * 0.12, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(w / 2 + Math.cos(a) * w * 0.16, h * 0.62 + Math.sin(a) * w * 0.16);
      g.lineTo(w / 2 + Math.cos(a) * w * 0.24, h * 0.62 + Math.sin(a) * w * 0.24);
      g.stroke();
    }
  };

  const FZ = BV.FZ;
  // ---------- podstavec ----------
  const base = grp('podstavec');
  rbox(base, -15.3, 15.3, 0.6, 4.4, -11.8, 11.8, M.dark, 0.15);
  [-14.6, 14.6].forEach((x) =>
    [-11.1, 11.1].forEach((z) => {
      cylY(base, 0.32, 0.32, 0, 0.18, x, z, M.steelD, 16);
      cylY(base, 0.12, 0.12, 0.18, 0.62, x, z, M.steel, 10);
    }),
  );
  box(base, -15.3, 15.3, 3.55, 3.95, FZ - 0.05, FZ + 0.01, M.red); // červený pás
  decal(base, 2.6, 0.55, (g, w, h) => logo(g, w, h, '#FFFFFF', '#2B2D30'), 11.5, 2.2, FZ + 0.02);
  // ---------- ľavý stĺp (červené čelo) ----------
  const frame = grp('kryt');
  rbox(frame, -15.3, -12.4, 4.4, 18.9, -11.8, 11.6, M.cab, 0.3);
  rbox(frame, -15.3, -12.4, 4.4, 18.9, 9.6, FZ, M.red, 0.3);
  decal(
    frame,
    0.75,
    8.5,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(-Math.PI / 2);
      g.fillStyle = '#FFFFFF';
      g.font = `bold italic ${Math.round(w * 0.62)}px Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('BREVIS 1212 AJ', 0, 0);
      g.restore();
    },
    -13.85,
    12.6,
    FZ + 0.02,
    0,
    128,
  );
  decal(frame, 2.2, 0.48, (g, w, h) => logo(g, w, h, '#FFFFFF', '#D7262E'), -13.85, 17.8, FZ + 0.02);
  // ---------- rezací priestor: zadná stena, strecha, priečky, čelo pod dverami ----------
  box(frame, -12.4, 5.8, 4.4, 18.9, -11.8, -11.3, M.cab2);
  rbox(frame, -12.6, 6.0, 18.5, 19.0, -11.8, FZ, M.cab, 0.2);
  box(frame, -12.6, 6.0, 18.35, 18.55, FZ - 0.2, FZ + 0.02, M.dark); // tmavá horná lišta
  box(frame, -12.4, 5.8, 17.6, 18.5, FZ - 0.4, FZ, M.cab); // hlavica nad dverami
  box(frame, -12.4, 5.8, 4.4, 8.3, FZ - 0.4, FZ, M.cab); // čelo pod dverami
  box(frame, -11.6, 5.0, 7.95, 8.3, FZ - 0.42, FZ + 0.01, M.dark); // štrbina výsuvného stola
  box(frame, 5.4, 5.8, 4.4, 18.5, -11.3, FZ, M.cab2); // priečka k skrini
  decal(
    frame,
    1.3,
    0.35,
    textDraw('CLASS 1 LASER PRODUCT', '#111', { font: 'bold', size: 0.55, align: 'center', bg: '#F5F5F0' }),
    3.6,
    6.6,
    FZ + 0.01,
  );
  // LED osvetlenie priestoru
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde8ff, emissiveIntensity: 1.2 });
  const led = add(frame, new THREE.BoxGeometry(16.6, 0.08, 0.3), ledMat, -3.3, 18.3, 8.9);
  led.userData.noMerge = true;
  // osvetlenie pracovného priestoru (zapína sa s napájaním)
  const cabLight = new THREE.PointLight(0xeef4ff, 0, 26, 1.6);
  cabLight.position.set(-3.3, 17.6, 2.0);
  frame.add(cabLight);
  // ---------- pravá skriňa so znakom a polepmi ----------
  rbox(frame, 5.8, 15.3, 4.4, 17.5, -11.8, FZ, M.cab, 0.55);
  rbox(frame, 6.1, 15.0, 17.3, 17.9, -11.5, 11.4, M.cab, 0.25);
  decal(frame, 5.2, 1.0, (g, w, h) => logo(g, w, h), 12.2, 15.9, FZ + 0.02);
  decal(frame, 6.0, 0.8, textDraw('BREVIS 1212 AJ', '#1E1F21', { size: 0.72, align: 'right' }), 12.0, 14.3, FZ + 0.02);
  decal(
    frame,
    3.8,
    1.6,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#D7262E';
      g.lineWidth = h * 0.05;
      g.lineCap = 'round';
      g.font = `italic ${Math.round(h * 0.75)}px "Brush Script MT", "Segoe Script", cursive`;
      g.fillStyle = '#D7262E';
      g.textBaseline = 'middle';
      g.fillText('Brevis', w * 0.08, h * 0.5);
    },
    9.6,
    11.6,
    FZ + 0.02,
  );
  decal(frame, 6.8, 2.0, stripes(5), 11.4, 7.0, FZ + 0.02);
  // pravý bok: pruhy a znak
  decal(frame, 9.0, 2.0, stripes(5), 15.32, 7.0, 2.0, Math.PI / 2);
  decal(frame, 4.0, 0.78, (g, w, h) => logo(g, w, h), 15.32, 15.4, -6.0, Math.PI / 2);
  // ---------- servisné dvere: ľavé na stĺpe, dve na pravom boku ----------
  // span = ±1: panel leží od pántu v lokálnom +x alebo −x; otvorenie = rotácia ry0 − span·φ (von zo stroja)
  const sideDoor = (parent, hingeX, hingeZ, w, y0, y1, ry0, span) => {
    const pv = new THREE.Group();
    pv.position.set(hingeX, 0, hingeZ);
    pv.rotation.y = ry0;
    parent.add(pv);
    const x0 = Math.min(0, span * w),
      x1 = Math.max(0, span * w),
      hx = span * (w - 0.4),
      hy = (y0 + y1) / 2;
    rbox(pv, x0, x1, y0, y1, 0, 0.12, M.cab, 0.06);
    // škára okolo dverí
    box(pv, x0, x1, y1 - 0.04, y1, 0.12, 0.125, M.dark);
    box(pv, x0, x1, y0, y0 + 0.04, 0.12, 0.125, M.dark);
    box(pv, x0, x0 + 0.04, y0, y1, 0.12, 0.125, M.dark);
    box(pv, x1 - 0.04, x1, y0, y1, 0.12, 0.125, M.dark);
    box(pv, x0 + 0.2, x1 - 0.2, y0 + 0.2, y0 + 0.3, 0.12, 0.13, M.dark);
    rbox(pv, hx - 0.1, hx + 0.1, hy - 0.8, hy + 0.8, 0.12, 0.3, M.dark, 0.05); // madlo
    cylZ(pv, 0.12, 0.12, 0.12, 0.2, hx, hy + 1.2, M.steel, 12); // zámok
    hitProxy(pv, 0.7, hx, hy, 0.3);
    return { pivot: pv, ry0, span, open: 0 };
  };
  const doorsSide = [
    sideDoor(frame, -15.32, 8.6, 7.8, 5.2, 16.8, -Math.PI / 2, -1), // ľavý bok stĺpa
    sideDoor(frame, 15.32, -11.0, 9.2, 5.0, 16.4, Math.PI / 2, -1), // pravý bok – zadné
    sideDoor(frame, 15.32, 11.0, 9.2, 5.0, 16.4, Math.PI / 2, 1), // pravý bok – predné
  ];
  // ---------- čelné výklopné dvere s dvoma oknami ----------
  const fd = grp('dvere', frame);
  const door = new THREE.Group();
  door.position.set(-3.3, BV.DOOR_Y, FZ + 0.02);
  fd.add(door);
  const DW = 8.75,
    DH = 9.5;
  // rám dverí okolo dvoch okien (okná sú skutočné otvory so sklom)
  const WY0 = -7.9,
    WY1 = -1.4,
    wins = [
      [-7.9, -1.3],
      [-0.2, 7.9],
    ];
  rbox(door, -DW, DW, WY1, 0, -0.32, 0, M.cab, 0.1); // horný pás
  rbox(door, -DW, DW, -DH, WY0, -0.32, 0, M.cab, 0.1); // spodný pás
  rbox(door, -DW, wins[0][0], WY0, WY1, -0.32, 0, M.cab, 0.06);
  rbox(door, wins[0][1], wins[1][0], WY0, WY1, -0.32, 0, M.cab, 0.06);
  rbox(door, wins[1][1], DW, WY0, WY1, -0.32, 0, M.cab, 0.06);
  rbox(door, -DW, DW, -DH, -DH + 1.3, -0.34, 0.02, M.cab2, 0.08);
  wins.forEach(([x0, x1]) => {
    // tmavý rámik okna: štyri lišty
    box(door, x0 - 0.15, x1 + 0.15, WY1, WY1 + 0.15, -0.36, 0.04, M.dark);
    box(door, x0 - 0.15, x1 + 0.15, WY0 - 0.15, WY0, -0.36, 0.04, M.dark);
    box(door, x0 - 0.15, x0, WY0, WY1, -0.36, 0.04, M.dark);
    box(door, x1, x1 + 0.15, WY0, WY1, -0.36, 0.04, M.dark);
    const gl = add(door, new THREE.PlaneGeometry(x1 - x0, WY1 - WY0), M.glass, (x0 + x1) / 2, (WY0 + WY1) / 2, -0.16);
    gl.userData.noMerge = true;
  });
  // madlo dverí po celej šírke
  rbox(door, -6.5, 6.5, -DH + 0.55, -DH + 0.95, 0.05, 0.45, M.dark, 0.12);
  [-6.0, 6.0].forEach((x) => box(door, x - 0.15, x + 0.15, -DH + 0.6, -DH + 0.9, 0, 0.1, M.dark));
  hitProxy(door, 1.2, 0, -DH + 0.8, 0.4);
  decal(door, 0.9, 0.8, warn, 8.0, -1.9, 0.04, 0, 128);
  decal(door, 2.2, 0.32, textDraw('AMADA', '#D7262E', { font: 'bold', size: 0.9, align: 'center' }), 0, -0.55, 0.04);
  // ---------- výsuvný stôl (paleta) ----------
  const tbl = grp('stol', frame);
  const drawer = new THREE.Group();
  tbl.add(drawer);
  // vodiace koľajnice (pevné) a teleskopické výsuvy
  [-11.3, 4.7].forEach((x) => box(tbl, x - 0.15, x + 0.15, 7.6, 7.9, -9.0, FZ - 0.3, M.steelD));
  const ext = [-11.3, 4.7].map((x) => box(tbl, x - 0.12, x + 0.12, 7.62, 7.86, FZ - 3.0, FZ - 0.3, M.steel));
  rbox(drawer, -11.6, -11.0, 7.9, BV.TY - 0.1, -8.0, 7.6, M.red, 0.06);
  rbox(drawer, 4.4, 5.0, 7.9, BV.TY - 0.1, -8.0, 7.6, M.red, 0.06);
  rbox(drawer, -11.6, 5.0, 7.9, BV.TY - 0.05, 7.6, 8.1, M.red, 0.08); // predné čelo palety
  rbox(drawer, -11.6, 5.0, 7.9, 8.4, -8.1, -7.6, M.red, 0.06);
  for (let x = -10.7; x <= 4.2; x += 0.62) {
    const sl = box(drawer, x - 0.025, x + 0.025, 8.0, BV.TY, -7.5, 7.5, M.slat);
    sl.castShadow = false;
  }
  const handles = [-8.5, 1.9].map((x) => {
    const h = new THREE.Group();
    h.position.set(x, 8.5, 8.1);
    drawer.add(h);
    cylX(h, 0.08, 0.08, -0.7, 0.7, 0, 0.45, M.dark, 12);
    box(h, -0.7, -0.55, -0.08, 0.08, 0, 0.45, M.dark);
    box(h, 0.55, 0.7, -0.08, 0.08, 0, 0.45, M.dark);
    hitProxy(h, 0.55, 0, 0, 0.4);
    return h;
  });
  // tabuľa plechu: textúra so zárezmi, priehľadná tam, kde vypadli výrezy alebo sa odobrali diely
  const SHEET_PX = 1024;
  const sheetCv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (sheetCv) sheetCv.width = sheetCv.height = SHEET_PX;
  const sheetTex = sheetCv ? new THREE.CanvasTexture(sheetCv) : null;
  if (sheetTex) sheetTex.colorSpace = THREE.SRGBColorSpace;
  const sheetMat = new THREE.MeshStandardMaterial({
    map: sheetTex,
    alphaTest: 0.5,
    roughness: 0.42,
    metalness: 0.7,
    side: THREE.DoubleSide,
  });
  const sheet = add(drawer, new THREE.PlaneGeometry(BV.HALF * 2, BV.HALF * 2), sheetMat, BV.SX, BV.TY + 0.02, BV.SZ);
  sheet.rotation.x = -Math.PI / 2;
  sheet.userData.noMerge = true;
  sheet.userData.part = 'plech';
  // ---------- portál, vozík a rezacia hlava ----------
  const gan = grp('portal', frame);
  [-9.8, 9.6].forEach((z) => {
    box(gan, -12.2, 5.2, 12.6, 13.0, z - 0.35, z + 0.35, M.dark);
    box(gan, -12.2, 5.2, 13.0, 13.12, z - 0.12, z + 0.12, M.steel);
  });
  const gx = new THREE.Group();
  gan.add(gx);
  rbox(gx, -0.45, 0.45, 13.1, 14.7, -10.1, 9.9, M.red, 0.12);
  box(gx, -0.48, 0.48, 13.25, 13.4, -10.1, 9.9, M.steel);
  const gz = new THREE.Group();
  gx.add(gz);
  rbox(gz, -0.75, 0.75, 12.0, 15.0, -0.7, 0.7, M.dark, 0.1);
  box(gz, -0.77, 0.77, 13.9, 14.3, -0.72, 0.72, M.red);
  const gy = new THREE.Group();
  gz.add(gy);
  cylY(gy, 0.38, 0.38, 0.8, 3.4, 0, 0, M.dark, 24);
  cylY(gy, 0.3, 0.3, 0.35, 0.8, 0, 0, M.steel, 24);
  cylY(gy, 0.06, 0.24, 0, 0.35, 0, 0, M.copper, 24); // dýza
  add(gy, new THREE.TorusGeometry(0.39, 0.04, 6, 24), M.red, 0, 2.6, 0).rotation.x = Math.PI / 2;
  cable(
    gz,
    [
      [0.6, 14.8, 0.6],
      [1.4, 16.2, 0.8],
      [1.0, 17.6, 0.4],
    ],
    0.08,
    M.black,
  );
  // energetická reťaz vzadu
  box(gan, -12.0, 5.0, 14.8, 15.4, -10.9, -10.4, M.black);
  // žiara lúča a svetlo
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff1c0, toneMapped: false });
  const glow = add(gy, new THREE.SphereGeometry(0.09, 12, 8), glowMat, 0, -0.02, 0);
  glow.userData.noMerge = true;
  const beamLight = new THREE.PointLight(0xffa04a, 0, 6, 2);
  beamLight.position.set(0, -0.2, 0);
  gy.add(beamLight);
  // ---------- odsávanie a chladič vzadu ----------
  const rear = grp('prislusenstvo', frame);
  cylZ(rear, 0.75, 0.75, -14.4, -11.8, -3.0, 6.0, M.cab2, 24);
  rbox(rear, -6.0, 0.0, 0, 7.0, -18.5, -14.4, M.cab, 0.3); // odsávacie zariadenie
  decal(rear, 3.0, 0.6, (g, w, h) => logo(g, w, h), -3.0, 5.8, -14.38);
  rbox(rear, 8.0, 13.0, 0, 6.5, -17.0, -12.6, M.cab, 0.3); // chladič laserového zdroja
  for (let k = 0; k < 6; k++) box(rear, 8.4, 12.6, 1.4 + k * 0.6, 1.6 + k * 0.6, -12.62, -12.55, M.dark);
  cable(
    rear,
    [
      [10.5, 6.5, -14.5],
      [10.5, 8.0, -12.6],
      [10.5, 9.0, -11.8],
    ],
    0.12,
    M.black,
  );
  // ---------- ovládací panel AMNC 3i na otočnom ramene ----------
  const pan = grp('panel');
  rbox(pan, -19.4, -17.4, 0, 0.25, 9.6, 11.6, M.dark, 0.06);
  cylY(pan, 0.22, 0.22, 0.25, 11.0, -18.4, 10.6, M.dark, 16);
  rbox(pan, -18.7, -16.9, 10.8, 11.3, 10.3, 12.4, M.dark, 0.1); // rameno
  const head = new THREE.Group();
  head.position.set(-17.3, 13.4, 12.6);
  head.rotation.y = 0.35;
  pan.add(head);
  rbox(head, -1.6, 1.6, -2.4, 2.4, -0.35, 0, M.dark, 0.18); // teleso
  [-1.68, 1.68].forEach((x) => {
    for (let k = 0; k < 5; k++) box(head, x - 0.08, x + 0.08, -0.4 + k * 0.38, -0.25 + k * 0.38, -0.3, 0.02, M.black); // rebrovanie bokov
  });
  const display = add(
    head,
    new THREE.PlaneGeometry(2.9, 1.82),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    0,
    0.85,
    0.02,
  );
  display.userData.noMerge = true;
  rbox(head, -1.5, 1.5, -2.25, -0.25, 0, 0.06, M.panelL, 0.06); // tlačidlová doska
  decal(head, 1.1, 0.24, (g, w, h) => logo(g, w, h), -0.9, 2.1, 0.02, 0, 256);
  const pbtn = (x, y, mat, r = 0.13, mush = false) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0.06);
    head.add(g);
    if (mush) {
      cylZ(g, r * 0.6, r * 0.6, 0, 0.12, 0, 0, M.yellow, 20);
      cylZ(g, r, r * 0.95, 0.12, 0.25, 0, 0, mat, 24);
    } else {
      cylZ(g, r * 1.2, r * 1.2, 0, 0.03, 0, 0, M.black, 20);
      cylZ(g, r, r, 0.03, 0.09, 0, 0, mat, 20);
    }
    hitProxy(g, r * 1.6, 0, 0, 0.08);
    return g;
  };
  const btn = {
    power: pbtn(-1.1, -0.55, M.white),
    laser: pbtn(-0.6, -0.55, M.yellow),
    door: pbtn(-0.1, -0.55, M.white),
    start: pbtn(-1.1, -1.2, M.green),
    hold: pbtn(-0.6, -1.2, M.white),
    reset: pbtn(-0.1, -1.2, M.blue),
    estop: pbtn(-1.05, -1.85, M.red, 0.26, true),
  };
  const knob = kit.handwheel(head, 0.26, 0.85, -1.15, 0.12, 'z', 0); // regulátor posuvu (override)
  // popisy tlačidiel
  [
    ['POWER', -1.1, -0.55],
    ['LASER', -0.6, -0.55],
    ['DOOR', -0.1, -0.55],
    ['START', -1.1, -1.2],
    ['HOLD', -0.6, -1.2],
    ['RESET', -0.1, -1.2],
    ['OVERRIDE', 0.85, -1.15],
  ].forEach(([t, x, y]) =>
    decal(
      head,
      0.5,
      0.1,
      textDraw(t, '#E8EBE6', { font: 'bold', size: 0.8, align: 'center' }),
      x,
      y - (t === 'OVERRIDE' ? 0.4 : 0.25),
      0.07,
      0,
      160,
    ),
  );
  // závesný ovládač na kábli
  const pend = new THREE.Group();
  pend.position.set(1.95, -2.9, 0.1);
  head.add(pend);
  rbox(pend, -0.32, 0.32, -0.9, 0, -0.15, 0.15, M.dark, 0.1);
  cylZ(pend, 0.08, 0.08, 0.15, 0.2, 0, -0.25, M.red, 12);
  cable(
    head,
    [
      [1.5, -2.3, -0.1],
      [2.0, -2.5, 0.0],
      [1.95, -2.9, 0.1],
    ],
    0.035,
    M.black,
  );
  // ---------- nožný pedál dverí ----------
  const pedal = new THREE.Group();
  pedal.position.set(3.2, 0, 15.0);
  pan.add(pedal);
  rbox(pedal, -0.6, 0.6, 0, 0.7, -0.7, 0.7, M.red, 0.12);
  rbox(pedal, -0.45, 0.45, 0.7, 0.85, -0.5, 0.55, M.dark, 0.05);
  hitProxy(pedal, 0.8, 0, 0.5, 0);
  cable(
    pan,
    [
      [3.2, 0.3, 14.3],
      [3.6, 0.1, 13.0],
      [4.0, 0.3, FZ],
    ],
    0.05,
    M.black,
  );
  bolts(
    base,
    [
      [-13.0, 1.2],
      [13.0, 1.2],
    ],
    FZ,
    0.1,
  );

  return {
    door,
    doorsSide,
    drawer,
    ext,
    handles,
    sheet: { mesh: sheet, mat: sheetMat, cv: sheetCv, tex: sheetTex, px: SHEET_PX },
    gx,
    gz,
    gy,
    glow,
    beamLight,
    display,
    btn,
    knob,
    pedal,
    pend,
    led,
    cabLight,
  };
}
