// 3D model laseru Amada BREVIS 1212 AJ (mierka 1 = 100 mm, obsluha vpredu +z). Rozmery podľa letáku Amada:
// šírka 2 389 (x), dĺžka 3 088 (z), výška 1 900 mm. Tvar podľa siete odhadnutej z fotografií (Meshy) a fotografií:
// úzke čelo s červeným stĺpom vľavo, dve čelné posuvné krídla so zaoblenými oknami, ktoré sa kaskádovo
// zasúvajú doľava pod červený stĺp, pod nimi výsuvná červená paleta s čiernou zásterou a madlom; boky z troch sekcií (predná
// s oknom, stredná s podpisom FL, nižšia tmavá zadná skriňa laserového zdroja), päť červených pruhov, čierny podstavec;
// robustný tablet AMNC 3i na konzole na čele stĺpa, závesný ovládač a nožný pedál.
import * as THREE from 'three';

const FZ = 14.25; // čelo stĺpa a palety
const SLOPE = 0.148; // sklon čela nad spodnou hranou dverí (dozadu nahor)
const DOOR_Y0 = 9.05; // spodná hrana čelných dverí
const CEIL = 18.41; // vodiaca dráha dverí pod strechou predného posuvného dielu
const YC = 18.45; // spodná hrana strechy predného dielu a začiatok zaoblenia čela
const zf = (y) => (y <= DOOR_Y0 ? FZ : FZ - (y - DOOR_Y0) * SLOPE); // čelná plocha v danej výške

export const BV = {
  TY: 8.6, // horná hrana hrotov lôžka (pracovná rovina)
  SX: 0.55, // stred tabule (x)
  SZ: 5.4, // stred tabule (z) – predná hrana tabule ostáva za zatvorenými dverami aj s hlavou
  HALF: 6.25, // polovica tabule 1 250 mm
  FZ,
  DRAWER: 11.0, // vysunutie palety
  X0: -6.42, // otvor čela – ľavý okraj
  X1: 10.72, // otvor čela – pravý okraj
  W: 11.95, // polovica šírky stroja
  ZM: 2.4, // hranica prednej a strednej sekcie
  ZB: -7.8, // zadná stena rezacieho priestoru
  ZR: -15.4, // zadná hrana stroja
  RT: 17.5, // výška zadnej skrine (nad ňu sa zasúvajú posuvné diely)
  SLIDE1: 7.6, // zdvih stredného dielu
  SLIDE2: 17.75, // zdvih predného dielu (aj s pravým predným rohom)
  CEIL,
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

const RED = '#D7262E';
const YEL = '#F2B705';

// zaoblený obdĺžnik do tvaru/cesty
const rrect = (p, x0, y0, x1, y1, r) => {
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.quadraticCurveTo(x1, y0, x1, y0 + r);
  p.lineTo(x1, y1 - r);
  p.quadraticCurveTo(x1, y1, x1 - r, y1);
  p.lineTo(x0 + r, y1);
  p.quadraticCurveTo(x0, y1, x0, y1 - r);
  p.lineTo(x0, y0 + r);
  p.quadraticCurveTo(x0, y0, x0 + r, y0);
  return p;
};

export function buildBrevis({ kit, det, M, grp }) {
  const { add, box, cylX, cylY, cylZ, hitProxy } = kit;
  const { rbox, cable, bolts } = det;
  const { X0, X1, W, ZM, ZB, ZR, TY } = BV;
  // polep: priehľadný obdĺžnik s textúrou otočený k +z v rodičovi (ry pre boky, rx pre šikmé čelo)
  const decal = (p, w, h, draw, x, y, z, ry = 0, px = 512, rx = 0) => {
    const tx = canvasTex(px, Math.max(8, Math.round((px * h) / w)), draw);
    if (!tx) return null;
    const m = add(
      p,
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.5, metalness: 0.1, depthWrite: false }),
      x,
      y,
      z,
    );
    m.rotation.set(rx, ry, 0, 'YXZ');
    m.userData.noMerge = true;
    m.castShadow = false;
    m.renderOrder = 2;
    return m;
  };
  // znak AMADA: červený kruh s výrezom (stilizované „A“) a nápis
  const logo = (g, w, h, color = RED, sub = '#FFFFFF') => {
    g.clearRect(0, 0, w, h);
    const r = h * 0.4;
    g.fillStyle = color;
    g.beginPath();
    g.arc(r + 2, h / 2, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = sub;
    g.fillRect(r * 0.55 + 2, h / 2 + r * 0.2, r * 0.9, r * 0.8);
    g.fillStyle = color;
    g.font = `bold ${Math.round(h * 0.78)}px Arial, Helvetica, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('MADA', r * 2 + 6, h * 0.54);
  };
  const yellowBars = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = YEL;
    [0.1, 0.56].forEach((y) => g.fillRect(0, h * y, w * 0.72, h * 0.32));
    g.fillStyle = '#F5F5F0';
    g.font = `bold ${Math.round(h * 0.42)}px Arial, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('EF', w * 0.78, h * 0.5);
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
    (n, color = RED) =>
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = color;
      for (let i = 0; i < n; i++) g.fillRect(0, (i * h) / n + h / n / 4, w, h / n / 2.2);
    };
  const warn = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = YEL;
    g.beginPath();
    g.moveTo(w / 2, h * 0.06);
    g.lineTo(w * 0.96, h * 0.92);
    g.lineTo(w * 0.04, h * 0.92);
    g.closePath();
    g.fill();
    g.lineWidth = w * 0.05;
    g.strokeStyle = '#111';
    g.stroke();
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
  const label =
    (txt, bg = YEL) =>
    (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#111';
      g.lineWidth = Math.max(2, h * 0.06);
      g.strokeRect(2, 2, w - 4, h - 4);
      g.fillStyle = '#111';
      g.font = `bold ${Math.round(h * 0.3)}px Arial, Helvetica, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      txt.split('\n').forEach((line, i, a) => g.fillText(line, w / 2, h * (0.5 + (i - (a.length - 1) / 2) * 0.36)));
    };
  // ručný podpis „FL“ (fiber laser) – tenký červený ťah
  const signature = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = RED;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = h * 0.045;
    g.beginPath(); // F
    g.moveTo(w * 0.12, h * 0.22);
    g.bezierCurveTo(w * 0.25, h * 0.12, w * 0.36, h * 0.18, w * 0.46, h * 0.14);
    g.moveTo(w * 0.27, h * 0.18);
    g.bezierCurveTo(w * 0.24, h * 0.45, w * 0.2, h * 0.7, w * 0.12, h * 0.86);
    g.moveTo(w * 0.17, h * 0.5);
    g.lineTo(w * 0.34, h * 0.46);
    g.moveTo(w * 0.5, h * 0.16); // L
    g.bezierCurveTo(w * 0.47, h * 0.45, w * 0.42, h * 0.68, w * 0.38, h * 0.84);
    g.bezierCurveTo(w * 0.55, h * 0.78, w * 0.75, h * 0.8, w * 0.92, h * 0.7);
    g.stroke();
  };

  // bočný profil prednej sekcie v rovine (z, y) vytlačený pozdĺž x: šikmé čelo, zaoblený horný roh
  const sideShape = (zBack, yb, yTop = 19.0) => {
    const s = new THREE.Shape();
    const zt = zf(YC),
      ze = Math.max(zt - 0.85, zBack);
    s.moveTo(-zBack, yb);
    if (yb < DOOR_Y0) {
      s.lineTo(-FZ, yb);
      s.lineTo(-FZ, DOOR_Y0);
    } else if (yb < YC) s.lineTo(-zf(yb), yb);
    s.lineTo(-zt, Math.max(yb, YC));
    s.quadraticCurveTo(-(zt - 0.12), yTop, -ze, yTop);
    if (ze > zBack) s.lineTo(-zBack, yTop);
    s.closePath();
    return s;
  };
  const profile = (p, x0, x1, shape, m) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 10 });
    geo.rotateY(Math.PI / 2); // (u, v, w) → (w, v, −u): u = −z
    geo.translate(x0, 0, 0);
    return add(p, geo, m, 0, 0, 0);
  };
  const slant = -Math.atan(SLOPE); // sklon polepov na šikmom čele

  // ---------- podstavec: čierny, ustúpený, s nivelačnými nohami a podložkami ----------
  const base = grp('podstavec');
  rbox(base, -11.3, 11.3, 0.55, 4.7, -15.0, 13.4, M.black, 0.12);
  [
    [-10.2, 12.2],
    [10.2, 12.2],
    [-10.2, -13.6],
    [10.2, -13.6],
  ].forEach(([x, z]) => {
    const s = Math.sign(x);
    box(base, x - 0.9 + s * 0.6, x + 0.9 + s * 0.6, 0, 0.14, z - 0.6, z + 0.6, M.black); // podložka
    cylY(base, 0.42, 0.42, 0.14, 0.32, x, z, M.steelD, 18);
    cylY(base, 0.13, 0.13, 0.32, 0.62, x, z, M.steel, 10);
    cylY(base, 0.3, 0.3, 0.42, 0.56, x, z, M.steelD, 6); // matica
  });
  // nízky predný sokel pod paletou a pravá podperná veža palety
  box(base, X0, 7.6, 0.6, 5.45, 13.4, 13.9, M.black);
  rbox(base, 7.6, X1 - 0.04, 0.6, 8.6, 12.8, 14.6, M.black, 0.08);
  rbox(base, 7.6, X1 - 0.04, 8.1, 8.6, 14.0, 14.85, M.red, 0.06); // pokračovanie červeného pásu
  decal(base, 1.6, 0.55, label('CAUTION\nHIGH VOLTAGE'), 9.15, 6.6, 14.62, 0, 256);
  decal(base, 0.9, 0.5, label('BRE1212AJ', '#E9ECEF'), 9.15, 5.6, 14.62, 0, 256);
  decal(base, 0.6, 0.54, warn, 8.4, 3.0, 14.62, 0, 128);
  decal(base, 2.2, 0.45, (g, w, h) => logo(g, w, h, '#FFFFFF', '#1D1F21'), 4.0, 2.4, 13.42);

  // ---------- kryt: pevné časti ----------
  const frame = grp('kryt');
  const { RT, SLIDE1, SLIDE2 } = BV;
  // ľavý červený stĺp: profil s čelom a zaobleným vrcholom, strieborná vnútorná hrana
  profile(frame, -W, X0, sideShape(ZM, 4.7), M.red);
  profile(frame, -W - 0.03, -W, sideShape(12.0, 8.9, 18.85), M.black); // čierny bok stĺpa pred servisnými dverami (kopíruje šikmé čelo)
  profile(frame, X0, X0 + 0.03, sideShape(12.4, 4.75, 18.85), M.cab); // vnútorná hrana pri otvore (kopíruje šikmé čelo)
  decal(frame, 2.0, 0.85, yellowBars, -10.2, 17.75, zf(17.75) + 0.02, 0, 256, slant);
  decal(frame, 3.9, 0.62, (g, w, h) => logo(g, w, h, '#FFFFFF', RED), -9.1, 16.6, zf(16.6) + 0.02, 0, 512, slant);
  decal(
    frame,
    4.4,
    0.6,
    textDraw('BREVIS 1212 AJ', '#FFFFFF', { size: 0.78 }),
    -9.0,
    15.6,
    zf(15.6) + 0.02,
    0,
    512,
    slant,
  );
  const ZP = 12.6; // zadná hrana pravého predného rohu (roh je súčasťou predného posuvného dielu)
  // ľavá pevná stena strednej sekcie a spodný pás s pruhmi na ľavom boku
  // ľavý bok: červený stĺp pokračuje v rovnakej výške čiernou stenou až dozadu a ohýba sa za stroj
  rbox(frame, -11.55, X0, 4.7, 18.4, ZR, ZM + 0.02, M.black, 0.12); // odskočená: užšia a nižšia ako stĺp
  rbox(frame, -W - 0.02, -W + 0.35, 4.7, 8.9, ZM - 0.05, FZ - 0.3, M.black, 0.08);
  rbox(frame, -11.58, -11.2, 4.7, 8.9, ZR, ZM, M.black, 0.08);
  rbox(frame, -11.55, W, 4.7, 18.4, ZR - 0.3, ZR + 0.02, M.black, 0.12); // zadná stena za strojom (posuvné diely končia pri nej)
  // pravý spodný rám (pod posuvnými dielmi) a pozdĺžny nosník pravého vedenia portálu
  // (všetko je vnútri x < X1, aby nad tým prešiel pravý predný roh pri zasúvaní)
  box(frame, 7.9, X1 - 0.04, 4.7, 8.0, ZB, 12.8, M.black);
  box(frame, 8.9, 9.3, 8.0, 8.08, ZB, 12.6, M.steel); // vedenie portálu na spodnom masívnom nosníku
  // zadná nižšia tmavá skriňa (laserový zdroj)
  rbox(frame, -11.6, 11.6, 4.7, RT, ZR + 0.02, ZB, M.rear, 0.3);
  [-1, 1].forEach((s) =>
    box(frame, s > 0 ? 11.55 : -11.59, s > 0 ? 11.59 : -11.55, 6.0, 16.6, ZR + 0.8, ZB - 0.6, M.dark),
  );
  // ---------- rezací priestor: čierne vnútro, podlaha, zadná stena, LED ----------
  box(frame, X0, X1 - 0.04, 4.7, 5.45, ZB, 13.9, M.black); // podlaha / zberná vaňa
  box(frame, X0 + 0.2, 7.55, 8.9, 9.02, 13.5, 13.86, M.black); // prah s kefou pod dverami (paleta prejde popod)
  box(frame, X0, X1, 5.2, RT, ZB, ZB + 0.2, M.black); // zadná stena
  box(frame, X0, X0 + 0.12, 5.45, RT, ZB, ZP, M.black); // ľavý obklad
  box(frame, X0, X0 + 0.12, RT, 18.4, ZM, ZP, M.black);
  for (let k = 0; k < 3; k++) box(frame, X0 + 0.12, X0 + 0.22, 10.2 + k * 2.2, 10.35 + k * 2.2, ZB, 8.0, M.dark); // police
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde8ff, emissiveIntensity: 1.2 });
  const led = add(frame, new THREE.BoxGeometry(0.08, 0.16, 12.0), ledMat, X0 + 0.16, 17.15, -0.5);
  led.userData.noMerge = true;
  const cabLight = new THREE.PointLight(0xeef4ff, 0, 30, 1.5);
  cabLight.position.set(2.2, 16.6, 4.0);
  frame.add(cabLight);

  // ---------- servisné dvere: ľavá stena, zadná stena skrine zdroja, ľavý bok stĺpa ----------
  // span = ±1: panel leží od pántu v lokálnom +x alebo −x; otvorenie = rotácia ry0 − span·φ (von zo stroja)
  const sideDoor = (hingeX, hingeZ, w, y0, y1, ry0, span, mat, deco) => {
    const pv = new THREE.Group();
    pv.position.set(hingeX, 0, hingeZ);
    pv.rotation.y = ry0;
    frame.add(pv);
    const x0 = Math.min(0, span * w),
      x1 = Math.max(0, span * w),
      fe = span * w, // voľná hrana (madlo)
      dir = -span; // smer od voľnej hrany dovnútra panela
    rbox(pv, x0, x1, y0, y1, 0, 0.12, mat, 0.06);
    box(pv, x0, x1, y0, y0 + 0.04, 0.12, 0.125, M.dark);
    const hx = fe + dir * 0.55;
    rbox(pv, hx - 0.09, hx + 0.09, y0 + 0.5, y0 + 2.1, 0.17, 0.42, M.black, 0.05);
    box(pv, hx - 0.07, hx + 0.07, y0 + 0.55, y0 + 0.75, 0.12, 0.3, M.black);
    box(pv, hx - 0.07, hx + 0.07, y0 + 1.85, y0 + 2.05, 0.12, 0.3, M.black);
    hitProxy(pv, 0.8, hx, y0 + 1.3, 0.35);
    if (deco) deco(pv, fe, dir, y0, y1);
    return { pivot: pv, ry0, span, open: 0 };
  };
  const doorsSide = [
    // ľavá pevná stena strednej sekcie (pánt vpredu, voľná hrana vzadu)
    sideDoor(-11.55, ZM - 0.05, 9.6, 8.95, 17.6, -Math.PI / 2, -1, M.black, (pv, fe, dir) =>
      decal(pv, 3.6, 0.6, (g, w, h) => logo(g, w, h), fe + dir * 6.0, 16.3, 0.13),
    ),
    // zadná stena skrine laserového zdroja (pánt vpravo)
    sideDoor(4.2, ZR - 0.3, 8.4, 6.0, 16.6, Math.PI, 1, M.black, (pv, fe, dir) => {
      for (let k = 0; k < 6; k++) box(pv, 1.2 + k * 1.1, 1.75 + k * 1.1, 12.2, 15.6, 0.12, 0.14, M.dark); // mriežka
      decal(pv, 3.2, 0.55, (g, w, h) => logo(g, w, h), fe + dir * 4.6, 10.5, 0.13);
    }),
    // ľavý bok červeného stĺpa (pánt vpredu, voľná hrana vzadu)
    sideDoor(-W, 12.0, 9.1, 8.95, 18.3, -Math.PI / 2, -1, M.black, (pv, fe, dir) =>
      decal(pv, 3.4, 0.56, (g, w, h) => logo(g, w, h), fe + dir * 6.4, 17.2, 0.13),
    ),
  ];

  // ---------- posuvné diely: stredný (strecha + pravý bok) a predný (strecha + pravý bok + čelné dvere) ----------
  // diely sú do seba vnorené: predný nad stredným, stredný nad zadnou skriňou – pri otvorení sa zasunú dozadu
  const fd = grp('dvere', frame);
  const sh1 = new THREE.Group();
  const sh2 = new THREE.Group();
  fd.add(sh1, sh2);
  // čierny klin s madlom v dolnom rohu bočného panela (fz – hrana s madlom, dz = ±1 smer dovnútra panela)
  // flat = zapustené madlo (vnútorný diel, cez ktorý sa prekĺzne vonkajší)
  const sideGrip = (g, xo, fz, dz, y0, flat = false) => {
    const tri = new THREE.Shape();
    tri.moveTo(-fz, y0);
    tri.lineTo(-fz, y0 + 3.0);
    tri.lineTo(-(fz + dz * 3.2), y0);
    tri.closePath();
    const geo = new THREE.ExtrudeGeometry(tri, { depth: flat ? 0.004 : 0.05, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    add(g, geo, M.black, xo, 0, 0);
    const hz = fz + dz * 0.55;
    if (flat) box(g, xo - 0.1, xo + 0.006, y0 + 0.5, y0 + 2.1, hz - 0.1, hz + 0.1, M.dark);
    else {
      rbox(g, xo + 0.05, xo + 0.3, y0 + 0.5, y0 + 2.1, hz - 0.09, hz + 0.09, M.black, 0.05);
      box(g, xo, xo + 0.2, y0 + 0.55, y0 + 0.75, hz - 0.07, hz + 0.07, M.black);
      box(g, xo, xo + 0.2, y0 + 1.85, y0 + 2.05, hz - 0.07, hz + 0.07, M.black);
    }
    const h = new THREE.Group();
    h.position.set(xo + (flat ? 0.1 : 0.3), y0 + 1.3, hz);
    g.add(h);
    hitProxy(h, 0.8, 0, 0, 0);
    return h;
  };
  // stredný diel
  const S1B = 17.6,
    S1T = 18.05;
  rbox(sh1, X0 + 0.02, 11.8, S1B, S1T, ZB, ZM, M.cab, 0.12); // strecha (od čiernej ľavej steny)
  box(sh1, X0, X1, S1B - 0.04, S1B, ZB, ZM, M.black);
  rbox(sh1, 11.66, 11.8, 4.7, S1T, ZB, ZM, M.cab, 0.05); // pravý bok
  box(sh1, 11.62, 11.66, 8.9, S1B, ZB, ZM, M.black);
  decal(sh1, 4.6, 2.2, signature, 11.805, 15.0, (ZB + ZM) / 2 - 1.2, Math.PI / 2, 512);
  decal(sh1, ZM - ZB - 0.1, 3.3, stripes(5), 11.805, 6.75, (ZB + ZM) / 2, Math.PI / 2, 512);
  const grip1 = sideGrip(sh1, 11.8, ZB + 0.05, 1, 8.95, true);
  // predný diel: strecha (nad otvorom profil so zaobleným čelom), pravý bok s oknom, znakom a typom
  profile(sh2, X0, X1, sideShape(ZM, YC), M.cab);
  profile(sh2, X1, W, sideShape(ZP, 4.7), M.cab); // pravý predný roh – posúva sa s dielom
  decal(sh2, FZ - 0.3 - ZP, 3.3, stripes(5), W + 0.02, 6.75, (FZ - 0.3 + ZP) / 2, Math.PI / 2, 256);
  rbox(sh2, X1 - 0.02, W, YC, 19.0, ZM, ZP, M.cab, 0.12);
  box(sh2, X0, X1, YC - 0.04, YC, ZM, zf(YC) - 0.05, M.black);
  rbox(sh2, 11.82, W, 4.7, 19.0, ZM, ZP, M.cab, 0.04); // pravý bok
  box(sh2, 11.81, 11.82, 8.9, YC, ZM, ZP, M.black);
  add(sh2, new THREE.PlaneGeometry(5.8, 2.7), M.black, W + 0.012, 14.75, 8.0).rotation.y = Math.PI / 2;
  const sw = add(sh2, new THREE.PlaneGeometry(5.56, 2.46), M.glass, W + 0.02, 14.75, 8.0);
  sw.rotation.y = Math.PI / 2;
  sw.userData.noMerge = true;
  decal(sh2, 3.4, 0.56, (g, w, h) => logo(g, w, h), W + 0.02, 17.4, 10.2, Math.PI / 2);
  decal(sh2, 5.0, 0.62, textDraw('BREVIS 1212 AJ', '#1E1F21', { size: 0.8 }), W + 0.02, 10.9, 5.6, Math.PI / 2);
  decal(sh2, ZP - ZM - 0.1, 3.3, stripes(5), W + 0.02, 6.75, (ZP + ZM) / 2, Math.PI / 2, 512);
  const grip2 = sideGrip(sh2, W, ZP - 0.05, -1, 8.95);
  // kaskáda ako pri čelných dverách: predný diel sa najprv zasunie cez stredný, potom idú oba spolu nad skriňu
  // zdroja; úplne otvorené končia pri zadnej stene (neprečnievajú za stroj). Zatváranie v opačnom poradí.
  const setShells = (k) => {
    const s = k * SLIDE2;
    sh2.position.z = -s;
    sh1.position.z = -Math.max(0, s - (SLIDE2 - SLIDE1));
  };

  // ---------- čelné dvere: dve posuvné krídla so zaoblenými oknami, kaskádovo doľava pod červený stĺp ----------
  // pravé krídlo zájde pod ľavé, potom idú obe spolu pod pevný červený stĺp; úplne otvorené sú celé mimo otvoru
  // a prečnievajú cez ľavý bok stroja. Pri zatváraní najprv idú obe spolu, potom samo pravé krídlo.
  const door = new THREE.Group();
  fd.add(door);
  const DH = Math.hypot(CEIL - DOOR_Y0, zf(DOOR_Y0) - zf(CEIL)); // výška krídla (pozdĺž šikmého čela)
  const DT = 0.26; // hrúbka
  door.position.set(0, CEIL, zf(CEIL) - 0.1);
  door.rotation.x = -Math.atan(SLOPE);
  const leafL = new THREE.Group();
  const leafR = new THREE.Group();
  leafR.position.z = -(DT + 0.12); // pravé krídlo jazdí v zadnej dráhe (zasunie sa pod ľavé)
  door.add(leafL, leafR);
  const leaf = (g, xa, xb, wa, wb) => {
    const s = new THREE.Shape();
    s.moveTo(xa, -DH);
    s.lineTo(xb, -DH);
    s.lineTo(xb, 0);
    s.lineTo(xa, 0);
    s.closePath();
    s.holes.push(rrect(new THREE.Path(), wa, -5.0, wb, -2.15, 0.45));
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: DT - 0.06,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 1,
      curveSegments: 6,
    });
    geo.translate(0, 0, -DT + 0.03);
    add(g, geo, M.cab, 0, 0, 0);
    // čierne tesnenie okna a tmavé ochranné sklo
    const ring = rrect(new THREE.Shape(), wa - 0.14, -5.14, wb + 0.14, -2.01, 0.55);
    ring.holes.push(rrect(new THREE.Path(), wa, -5.0, wb, -2.15, 0.45));
    add(
      g,
      new THREE.ExtrudeGeometry(ring, { depth: 0.03, bevelEnabled: false, curveSegments: 6 }),
      M.black,
      0,
      0,
      0.005,
    );
    const gl = add(g, new THREE.PlaneGeometry(wb - wa, 2.85), M.glass, (wa + wb) / 2, -3.575, -DT / 2);
    gl.userData.noMerge = true;
  };
  const XS = 2.15; // stretnutie krídel
  const LA = X0 + 0.1; // ľavá hrana ľavého krídla (zatvorené)
  leaf(leafL, LA, XS + 0.15, -5.25, 0.1);
  leaf(leafR, XS - 0.15, X1 - 0.32, 3.25, 8.5);
  box(leafL, XS + 0.1, XS + 0.15, -DH, 0, -DT, 0.01, M.dark); // tesniaca lišta na styku krídel
  // čierny klin so zapusteným madlom v pravom dolnom rohu pravého krídla
  const wedge = new THREE.Shape();
  wedge.moveTo(X1 - 0.32, -DH);
  wedge.lineTo(X1 - 0.32, -DH + 3.1);
  wedge.lineTo(X1 - 3.4, -DH);
  wedge.closePath();
  add(leafR, new THREE.ExtrudeGeometry(wedge, { depth: 0.04, bevelEnabled: false }), M.black, 0, 0, 0.005);
  const hx = X1 - 0.82;
  rbox(leafR, hx - 0.1, hx + 0.1, -DH + 0.55, -DH + 2.35, 0.0, 0.09, M.dark, 0.04);
  hitProxy(leafR, 1.1, hx, -DH + 1.4, 0.3);
  decal(leafR, 0.8, 0.72, warn, 9.4, -DH + 3.9, 0.01, 0, 128);
  // dráhy: pravé krídlo najprv samo pod ľavé (D), potom obe spolu, až kým nie sú celé mimo otvoru
  const D = XS - 0.15 - LA,
    T1 = XS + 0.15 - (X0 - 0.05), // ľavé krídlo celé z otvoru – prečnieva cez ľavý bok pod červeným stĺpom
    T2 = D + T1;
  const setDoor = (k) => {
    const s = k * T2;
    leafR.position.x = -s;
    leafL.position.x = -Math.max(0, s - D);
  };
  setDoor(0);

  // ---------- výsuvná paleta: červený rám, čierna zástera s madlom, špicaté lôžko ----------
  const tbl = grp('stol', frame);
  const drawer = new THREE.Group();
  tbl.add(drawer);
  const PX0 = -6.2,
    PX1 = 7.3,
    PZ0 = -1.4;
  [X0 + 0.25, 7.75].forEach((x) => box(tbl, x - 0.15, x + 0.15, 5.45, 5.65, -6.0, 13.9, M.steelD)); // vedenie
  const ext = [X0 + 0.25, 7.75].map((x) => box(tbl, x - 0.12, x + 0.12, 5.65, 5.85, 3.0, 13.9, M.black)); // výsuvy
  rbox(drawer, PX0, PX0 + 0.45, 5.85, TY - 0.15, PZ0, 14.1, M.red, 0.06);
  rbox(drawer, PX1 - 0.45, PX1, 5.85, TY - 0.15, PZ0, 14.1, M.red, 0.06);
  rbox(drawer, PX0, PX1, 5.66, 5.8, PZ0, PZ0 + 0.45, M.red, 0.04); // nízka zadná spojka (pod pevnými lamelami)
  box(drawer, PX0 + 0.45, PX1 - 0.45, 5.66, 5.8, PZ0, 14.1, M.black); // zberná vanička
  rbox(drawer, PX0, PX1, 7.9, TY, 14.0, 14.85, M.red, 0.07); // predný červený nosník
  rbox(drawer, PX0, PX1, 5.85, 7.95, 14.4, 14.85, M.black, 0.06); // čierna zástera
  cylX(drawer, 0.1, 0.1, -4.4, 5.5, 7.1, 15.3, M.black, 12); // dlhé madlo palety
  [-4.2, 0.55, 5.3].forEach((x) => rbox(drawer, x - 0.28, x + 0.28, 6.88, 7.32, 14.8, 15.35, M.black, 0.08));
  cylZ(drawer, 0.16, 0.16, 14.85, 15.25, 6.4, 6.6, M.black, 14); // zámok palety
  // pílovité lamely (hroty): jeden profil v rovine (z, y) vytlačený na hrúbku lamely
  const tooth = new THREE.Shape();
  const ZL = 6.45,
    STEP = 0.5,
    PLATE = TY - 0.22;
  tooth.moveTo(-ZL, 6.05);
  tooth.lineTo(ZL, 6.05);
  tooth.lineTo(ZL, PLATE);
  for (let z = ZL; z > -ZL + 1e-6; z -= STEP) {
    tooth.lineTo(z - STEP / 2, TY);
    tooth.lineTo(z - STEP, PLATE);
  }
  tooth.closePath();
  const slatGeo = new THREE.ExtrudeGeometry(tooth, { depth: 0.05, bevelEnabled: false });
  slatGeo.rotateY(Math.PI / 2);
  slatGeo.translate(-0.025, 0, BV.SZ);
  // rošt: párne lamely sa vysúvajú s paletou, nepárne ostávajú v stroji na pevnej vaničke
  for (let i = 0, x = PX0 + 0.75; x <= PX1 - 0.6; i++, x += 0.6) {
    const sl = add(i % 2 ? tbl : drawer, slatGeo, i % 2 ? M.steelD : M.slat, x, 0, 0);
    sl.castShadow = false;
  }
  // úchyty – ovládacie prvky (ľavý a pravý)
  const handles = [-4.2, 5.3].map((x) => {
    const h = new THREE.Group();
    h.position.set(x, 7.1, 15.3);
    drawer.add(h);
    hitProxy(h, 0.6, 0, 0, 0.1);
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
  const sheet = add(drawer, new THREE.PlaneGeometry(BV.HALF * 2, BV.HALF * 2), sheetMat, BV.SX, TY + 0.02, BV.SZ);
  sheet.rotation.x = -Math.PI / 2;
  sheet.userData.noMerge = true;
  sheet.userData.part = 'plech';

  // ---------- portál: priečny nosník (os Y stroja), vozík s hlavou, os Z ----------
  const gan = grp('portal', frame);
  // ľavý koniec nosníka jazdí na plochom vedení v ľavej stene, pravý na nohe po spodnom masívnom nosníku
  box(gan, X0 + 0.12, X0 + 0.2, 12.9, 13.15, ZB + 0.3, 11.8, M.steel);
  box(gan, X0 + 0.12, X0 + 0.2, 13.75, 13.85, ZB + 0.3, 11.8, M.steel);
  const gz = new THREE.Group(); // masívny priečny nosník – pohyb v z
  gan.add(gz);
  rbox(gz, X0 + 0.5, 9.8, 12.3, 14.3, -2.2, -0.65, M.black, 0.14);
  box(gz, X0 + 0.6, 8.4, 13.6, 13.75, -0.66, -0.6, M.steel); // lineárne vedenie vozíka
  box(gz, X0 + 0.6, 8.4, 12.75, 12.9, -0.66, -0.6, M.steel);
  rbox(gz, X0 + 0.17, X0 + 0.95, 12.1, 14.5, -2.3, -0.55, M.dark, 0.08); // ľavý vozík
  rbox(gz, 8.6, 9.8, 8.1, 12.3, -2.0, -0.85, M.black, 0.1); // pravá noha
  rbox(gz, 8.4, 10.0, 8.08, 8.55, -2.3, -0.55, M.dark, 0.08); // pätka na vedení
  const gx = new THREE.Group(); // vozík – pohyb v x
  gz.add(gx);
  rbox(gx, -0.95, 0.95, 11.4, 15.3, -0.6, 0.6, M.black, 0.12); // čierne puzdro hlavy
  rbox(gx, -0.98, 0.98, 15.2, 15.85, -0.62, 0.62, M.red, 0.14); // červený kryt navrchu
  box(gx, -0.6, 0.6, 12.0, 14.9, 0.6, 0.65, M.dark);
  decal(gx, 0.5, 0.45, warn, -0.35, 14.3, 0.66, 0, 128);
  decal(gx, 0.7, 0.28, label('LASER', YEL), 0.4, 14.35, 0.66, 0, 128);
  decal(gx, 0.7, 0.28, label('DANGER', YEL), 0.4, 13.9, 0.66, 0, 128);
  const gy = new THREE.Group(); // os Z – hrot dýzy v počiatku
  gx.add(gy);
  cylY(gy, 0.42, 0.42, 0.9, 3.6, 0, 0, M.black, 24);
  cylY(gy, 0.3, 0.3, 0.35, 0.9, 0, 0, M.steel, 24);
  cylY(gy, 0.06, 0.24, 0, 0.35, 0, 0, M.copper, 24); // dýza
  add(gy, new THREE.TorusGeometry(0.43, 0.04, 6, 24), M.red, 0, 2.8, 0).rotation.x = Math.PI / 2;
  cable(
    gx,
    [
      [0.5, 15.8, -0.4],
      [1.4, 16.6, -1.2],
      [2.4, 16.9, -2.4],
    ],
    0.08,
    M.black,
  );
  // energetická reťaz – slučka „U“ nad zadnou časťou priestoru
  const chain = (x0, x1, y, z) => {
    for (let x = x0; x < x1; x += 0.42) {
      box(gan, x, x + 0.36, y - 0.22, y + 0.22, z - 0.35, z + 0.35, M.black);
      box(gan, x + 0.1, x + 0.26, y + 0.22, y + 0.27, z - 0.25, z + 0.25, M.dark);
    }
  };
  chain(0.5, 7.4, 15.7, -6.4);
  chain(2.4, 7.4, 17.0, -6.4);
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI;
    box(
      gan,
      7.4 + Math.cos(a) * 0.65 - 0.2,
      7.4 + Math.cos(a) * 0.65 + 0.2,
      16.35 + Math.sin(a) * 0.65 - 0.2,
      16.35 + Math.sin(a) * 0.65 + 0.2,
      -6.75,
      -6.05,
      M.black,
    );
  }
  // žiara lúča a svetlo
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff1c0, toneMapped: false });
  const glow = add(gy, new THREE.SphereGeometry(0.09, 12, 8), glowMat, 0, -0.02, 0);
  glow.userData.noMerge = true;
  const beamLight = new THREE.PointLight(0xffa04a, 0, 6, 2);
  beamLight.position.set(0, -0.2, 0);
  gy.add(beamLight);

  // ---------- príslušenstvo za strojom: odsávanie a chladič ----------
  const rear = grp('prislusenstvo', frame);
  rbox(rear, -8.6, -2.6, 0, 6.6, -21.6, -17.2, M.cab, 0.3); // odsávacie zariadenie
  decal(rear, 3.0, 0.55, (g, w, h) => logo(g, w, h), -5.6, 5.8, -17.18);
  cylZ(rear, 0.6, 0.6, -17.2, ZR, -5.6, 5.0, M.cab2, 20); // potrubie
  rbox(rear, 2.6, 8.6, 0, 6.2, -21.0, -17.2, M.cab, 0.3); // chladič laserového zdroja
  for (let k = 0; k < 6; k++) box(rear, 3.0, 8.2, 1.2 + k * 0.6, 1.4 + k * 0.6, -17.22, -17.15, M.dark);
  cable(
    rear,
    [
      [5.6, 6.2, -18.0],
      [5.6, 7.2, -16.6],
      [5.6, 7.6, ZR],
    ],
    0.12,
    M.black,
  );

  // ---------- ovládací panel AMNC 3i: robustný tablet na konzole pripevnenej na čele stroja ----------
  const pan = grp('panel');
  // konzola: zvislý držiak na čele červeného stĺpa, vodorovné rameno doľava a podstavec pod tabletom
  rbox(pan, -10.4, -8.9, 6.6, 10.5, FZ - 0.02, FZ + 0.32, M.black, 0.08);
  bolts(
    pan,
    [
      [-10.05, 7.1],
      [-9.25, 7.1],
      [-10.05, 10.0],
      [-9.25, 10.0],
    ],
    FZ + 0.32,
    0.06,
  );
  rbox(pan, -16.0, -8.9, 9.3, 9.85, FZ + 0.25, FZ + 1.75, M.black, 0.1); // rameno
  rbox(pan, -15.9, -13.4, 9.85, 10.75, FZ + 0.45, FZ + 1.55, M.black, 0.1); // podstavec
  const head = new THREE.Group();
  head.position.set(-14.65, 14.25, FZ + 1.2);
  head.rotation.y = 0.12;
  pan.add(head);
  // telo tabletu (na výšku), hrubé gumené rohy, bočné rebrované úchopy a horné držadlo
  rbox(head, -2.5, 2.5, -3.25, 3.25, -0.62, 0, M.black, 0.22);
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sy) =>
      rbox(head, sx * 2.15 - 0.6, sx * 2.15 + 0.6, sy * 2.85 - 0.6, sy * 2.85 + 0.6, -0.72, 0.12, M.black, 0.32),
    ),
  );
  [-1, 1].forEach((sx) => {
    rbox(head, sx * 2.58 - 0.16, sx * 2.58 + 0.16, -2.3, 2.3, -0.6, 0.04, M.panelL, 0.08); // bočný nárazník
    for (let k = 0; k < 7; k++) {
      const y = -0.1 + k * 0.27;
      rbox(head, sx * 2.72 - 0.08, sx * 2.72 + 0.08, y, y + 0.17, -0.55, 0.0, M.black, 0.04); // rebrovanie
    }
  });
  rbox(head, -1.1, 1.1, 3.1, 3.55, -0.62, 0.1, M.black, 0.15); // horné držadlo
  for (let k = 0; k < 7; k++) box(head, -0.85 + k * 0.28, -0.73 + k * 0.28, 3.2, 3.58, -0.5, 0.06, M.panelL);
  rbox(head, -1.9, 1.9, -3.55, -3.15, -0.6, 0.06, M.black, 0.12); // spodný nárazník
  // čierne sklo s obrazovkou
  rbox(head, -2.38, 2.38, -0.8, 3.05, -0.04, 0.02, M.black, 0.08);
  const display = add(
    head,
    new THREE.PlaneGeometry(4.5, 2.81),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    0,
    1.2,
    0.025,
  );
  display.userData.noMerge = true;
  decal(head, 1.1, 0.22, (g, w, h) => logo(g, w, h, '#FFFFFF', '#111316'), -1.55, 2.82, 0.025, 0, 256);
  decal(
    head,
    0.9,
    0.2,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = RED;
      g.font = `bold italic ${Math.round(h * 0.75)}px Arial, sans-serif`;
      g.textBaseline = 'middle';
      g.fillText('AMNC', 4, h * 0.52);
      g.fillStyle = '#E8EBE6';
      g.fillText('3i', w * 0.7, h * 0.52);
    },
    1.65,
    -0.55,
    0.025,
    0,
    256,
  );
  // spodná strieborná doska s čiernym ovládacím poľom
  rbox(head, -2.3, 2.3, -3.05, -0.92, -0.04, 0.05, M.cab, 0.1);
  rbox(head, -2.1, 2.1, -2.88, -1.08, 0.03, 0.07, M.black, 0.06);
  const lines = (pts) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1],
        [x1, y1] = pts[i];
      box(
        head,
        Math.min(x0, x1) - 0.01,
        Math.max(x0, x1) + 0.01,
        Math.min(y0, y1) - 0.01,
        Math.max(y0, y1) + 0.01,
        0.07,
        0.075,
        M.white,
      );
    }
  };
  // tlačidlo: sq – štvorcové (biele s čiernym rámikom), inak okrúhle; mush – hríbik núdzového stopu so žltým krúžkom
  const pbtn = (x, y, mat, { r = 0.13, sq = false, mush = false, ctl = true } = {}) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0.07);
    head.add(g);
    if (mush) {
      cylZ(g, r * 1.45, r * 1.45, 0, 0.04, 0, 0, M.yellow, 24);
      cylZ(g, r * 0.6, r * 0.6, 0.04, 0.16, 0, 0, M.black, 16);
      cylZ(g, r, r * 0.9, 0.16, 0.3, 0, 0, mat, 24);
    } else if (sq) {
      box(g, -r * 1.25, r * 1.25, -r * 1.25, r * 1.25, 0, 0.03, M.dark);
      rbox(g, -r, r, -r, r, 0.02, 0.1, mat, 0.03);
    } else {
      cylZ(g, r * 1.3, r * 1.3, 0, 0.04, 0, 0, M.cab, 20);
      cylZ(g, r, r, 0.04, 0.1, 0, 0, mat, 20);
    }
    if (ctl) hitProxy(g, (sq ? 1.4 : 1.6) * r * (mush ? 1.2 : 1), 0, 0, 0.08);
    return g;
  };
  // kľúčový spínač laseru
  const keySw = (x, y) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0.07);
    head.add(g);
    cylZ(g, 0.17, 0.17, 0, 0.05, 0, 0, M.steel, 20);
    cylZ(g, 0.11, 0.11, 0.05, 0.09, 0, 0, M.steelD, 16);
    box(g, -0.025, 0.025, -0.02, 0.24, 0.09, 0.14, M.yellow); // kľúč
    rbox(g, -0.08, 0.08, 0.2, 0.36, 0.09, 0.14, M.yellow, 0.03);
    hitProxy(g, 0.26, 0, 0.05, 0.1);
    return g;
  };
  const btn = {
    estop: pbtn(-1.6, -2.0, M.red, { r: 0.27, mush: true }),
    start: pbtn(-0.45, -2.42, M.green, { sq: true }),
    hold: pbtn(-0.12, -2.42, M.white, { sq: true }),
    door: pbtn(0.62, -1.48, M.white, { sq: true }),
    laser: keySw(0.85, -1.98),
    reset: pbtn(0.85, -2.5, M.blue, { sq: true }),
    power: pbtn(1.45, -1.6, M.white, { r: 0.15 }),
    pallet: pbtn(0.25, -1.82, M.yellow, { sq: true }), // vysunutie / zasunutie rezacej palety
    light: pbtn(-1.72, -1.32, M.white, { sq: true, r: 0.1 }), // osvetlenie priestoru
    cover: pbtn(-0.45, -1.62, M.white, { sq: true }), // bočné posuvné kryty
  };
  // ďalšie (dekoratívne) tlačidlá a schéma
  pbtn(-1.42, -1.32, M.white, { sq: true, r: 0.1, ctl: false });
  pbtn(-0.12, -1.62, M.white, { sq: true, ctl: false });
  pbtn(1.45, -2.38, M.dark, { r: 0.15, ctl: false });
  lines([
    [-0.62, -1.42],
    [-0.62, -1.3],
    [0.25, -1.3],
    [0.25, -1.62],
  ]);
  lines([
    [-0.62, -2.22],
    [-0.62, -2.15],
    [0.05, -2.15],
    [0.05, -2.22],
  ]);
  // regulátor posuvu (override): biely gombík s ryskou na stupnici
  decal(
    head,
    0.62,
    0.62,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#E8EBE6';
      g.lineWidth = 3;
      for (let k = 0; k <= 20; k++) {
        const a = Math.PI * (0.75 + (k / 20) * 1.5),
          r0 = w * (k % 5 ? 0.42 : 0.38);
        g.beginPath();
        g.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
        g.lineTo(w / 2 + Math.cos(a) * w * 0.48, h / 2 + Math.sin(a) * w * 0.48);
        g.stroke();
      }
    },
    -1.02,
    -2.0,
    0.075,
    0,
    128,
  );
  const knob = new THREE.Group();
  knob.position.set(-1.02, -2.0, 0.07);
  head.add(knob);
  cylZ(knob, 0.19, 0.17, 0, 0.16, 0, 0, M.white, 28);
  box(knob, -0.018, 0.018, 0.02, 0.17, 0.16, 0.175, M.black);
  [
    ['POWER', 1.45, -1.6, 0.25],
    ['LASER', 0.85, -1.98, -0.27],
    ['DOOR', 0.62, -1.48, 0.24],
    ['PALLET', 0.25, -1.82, -0.24],
    ['LIGHT', -1.57, -1.32, 0.2],
    ['COVER', -0.45, -1.62, 0.24],
    ['START', -0.45, -2.42, -0.24],
    ['HOLD', -0.12, -2.42, -0.24],
    ['RESET', 0.85, -2.5, -0.24],
    ['OVERRIDE', -1.02, -2.0, -0.4],
  ].forEach(([t, x, y, dy]) =>
    decal(
      head,
      0.46,
      0.09,
      textDraw(t, '#E8EBE6', { font: 'bold', size: 0.8, align: 'center' }),
      x,
      y + dy,
      0.076,
      0,
      160,
    ),
  );
  // konektory na pravom boku
  [-2.0, -2.45].forEach((y) => cylX(head, 0.12, 0.12, 2.5, 2.75, y, -0.3, M.dark, 16));
  // závesný ovládač na špirálovom kábli pod ramenom
  const pend = new THREE.Group();
  pend.position.set(-12.6, 6.2, FZ + 1.1);
  pan.add(pend);
  rbox(pend, -0.32, 0.32, -1.6, 0, -0.18, 0.18, M.black, 0.12);
  rbox(pend, -0.24, 0.24, -1.1, -0.2, 0.15, 0.2, M.panelL, 0.05);
  cylZ(pend, 0.08, 0.08, 0.18, 0.24, 0, -1.3, M.red, 12);
  const coil = [];
  for (let k = 0; k <= 36; k++) {
    const a = k * 0.9;
    coil.push([-12.6 + Math.cos(a) * 0.14, 9.3 - (k / 36) * 3.1, FZ + 1.1 + Math.sin(a) * 0.14]);
  }
  cable(pan, coil, 0.035, M.black);
  cable(
    pan,
    [
      [-12.0, 9.3, FZ + 0.6],
      [-11.0, 8.4, FZ + 0.4],
      [-10.4, 7.4, FZ + 0.2],
    ],
    0.06,
    M.black,
  );
  // ---------- nožný pedál dverí ----------
  const pedal = new THREE.Group();
  pedal.position.set(9.3, 0, 18.4);
  pan.add(pedal);
  rbox(pedal, -0.6, 0.6, 0, 0.7, -0.7, 0.7, M.red, 0.12);
  rbox(pedal, -0.45, 0.45, 0.7, 0.85, -0.5, 0.55, M.black, 0.05);
  hitProxy(pedal, 0.8, 0, 0.5, 0);
  cable(
    pan,
    [
      [9.3, 0.3, 17.7],
      [9.6, 0.1, 16.2],
      [9.2, 0.3, 14.6],
    ],
    0.05,
    M.black,
  );
  bolts(
    base,
    [
      [-9.0, 1.4],
      [9.0, 1.4],
    ],
    13.42,
    0.1,
  );

  return {
    door,
    setDoor,
    setShells,
    grips: [grip2, grip1],
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
