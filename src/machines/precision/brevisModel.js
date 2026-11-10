// 3D model laseru Amada BREVIS 1212 AJ (mierka 1 = 100 mm, obsluha vpredu +z). Rozmery podľa letáku Amada:
// 3 088 × 2 389 × 1 900 mm. Rekonštrukcia podľa fotografií: červený hlavový blok vľavo so žltým logom, dva veľké
// strieborné posuvné čelné panely so zelenými oknami, strieborná skriňa vpravo s logom a červenými pruhmi, čierny
// podstavec s výstražnými štítkami, zdvíhateľná strecha, čierny interiér s LED osvetlením, červená paleta so
// špicatým lôžkom, robustný tablet AMNC 3i na otočnom ramene a nožný pedál.
import * as THREE from 'three';

export const BV = {
  TY: 9.0, // horná hrana lamiel stola (výška pracovnej roviny)
  SX: -3.2, // stred tabule (x)
  SZ: 0, // stred tabule (z)
  HALF: 6.25, // polovica tabule 1 250 mm
  DOOR_Y: 13.5, // stred otvoru čela
  FZ: 11.85, // čelo stroja
  DRAWER: 10.5, // vysunutie stola
  PW: 9.5, // šírka predného čelného panela (zadný je o 0,3 užší)
  ROOF_Y: 18.9, // os pántu strechy
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

export function buildBrevis({ kit, det, M, grp }) {
  const { add, box, cylX, cylY, cylZ, hitProxy } = kit;
  const { rbox, cable, bolts } = det;
  // polep: priehľadný obdĺžnik s textúrou otočený k +z v rodičovi (ry pre bočné steny)
  const decal = (p, w, h, draw, x, y, z, ry = 0, px = 512) => {
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
    m.rotation.y = ry;
    m.userData.noMerge = true;
    m.castShadow = false;
    m.renderOrder = 2;
    return m;
  };
  // znak AMADA: červená „A“ so šípkou a nápis
  const logo = (g, w, h, color = RED, sub) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
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
  // žltý dvojpruh (logo na červenom hlavovom bloku)
  const yellowBars = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = YEL;
    [0.12, 0.56].forEach((y) => {
      g.beginPath();
      g.moveTo(w * 0.1, h * (y + 0.32));
      g.lineTo(w * 0.22, h * y);
      g.lineTo(w * 0.96, h * y);
      g.lineTo(w * 0.84, h * (y + 0.32));
      g.closePath();
      g.fill();
    });
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
      for (let i = 0; i < n; i++) g.fillRect(0, (i * h) / n + h / n / 4, w, h / n / 2);
    };
  // výstražný trojuholník (laserové žiarenie / pozor)
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
  // žltý štítok s čiernym textom (výstrahy na podstavci)
  const label = (txt) => (g, w, h) => {
    g.fillStyle = YEL;
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
  // podpis „FL“ (fiber laser) s červeným šmihom
  const signature = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = RED;
    g.strokeStyle = RED;
    g.lineCap = 'round';
    g.font = `italic bold ${Math.round(h * 0.82)}px "Brush Script MT", "Segoe Script", "Times New Roman", serif`;
    g.textBaseline = 'middle';
    g.fillText('FL', w * 0.06, h * 0.46);
    g.lineWidth = h * 0.06;
    g.beginPath();
    g.moveTo(w * 0.04, h * 0.88);
    g.quadraticCurveTo(w * 0.35, h * 0.72, w * 0.62, h * 0.9);
    g.stroke();
    g.font = `bold ${Math.round(h * 0.15)}px Arial, sans-serif`;
    g.fillStyle = '#2B2D30';
    g.fillText('FIBER LASER', w * 0.46, h * 0.3);
  };

  const FZ = BV.FZ;
  const AX0 = -12.4, // otvor čela: ľavý a pravý okraj
    AX1 = 5.8,
    AY0 = 8.4,
    AY1 = 18.2, // horná hrana panelov
    CEIL = 18.4; // spodná hrana strechy
  // ---------- podstavec: čierny, s červeným pásom a výstražnými štítkami ----------
  const base = grp('podstavec');
  rbox(base, -15.3, 15.3, 0.6, 4.4, -11.8, 11.8, M.dark, 0.15);
  [-14.6, 14.6].forEach((x) =>
    [-11.1, 11.1].forEach((z) => {
      box(base, x - 0.7, x + 0.7, 0, 0.18, z - 0.7, z + 0.7, M.black); // podložka nôh
      cylY(base, 0.14, 0.14, 0.18, 0.62, x, z, M.steel, 10);
      cylY(base, 0.28, 0.28, 0.5, 0.62, x, z, M.steelD, 6); // matica nivelačnej nohy
    }),
  );
  box(base, -15.3, 15.3, 3.45, 3.8, FZ - 0.05, FZ + 0.01, M.red); // červený pás
  box(base, -15.3, 15.3, 3.1, 3.18, FZ - 0.05, FZ + 0.01, M.red); // tenký druhý pás
  decal(base, 2.6, 0.55, (g, w, h) => logo(g, w, h, '#FFFFFF', '#2B2D30'), 11.0, 2.15, FZ + 0.02);
  decal(base, 0.7, 0.62, warn, -9.0, 2.0, FZ + 0.02, 0, 128);
  decal(base, 0.7, 0.62, warn, -4.5, 2.0, FZ + 0.02, 0, 128);
  decal(base, 1.9, 0.62, label('CAUTION\nHOT SURFACE'), -7.0, 2.0, FZ + 0.02, 0, 256);
  decal(base, 1.9, 0.62, label('LIFTING\nPOINT'), 5.5, 2.0, FZ + 0.02, 0, 256);
  decal(base, 1.9, 0.62, label('CAUTION\nHIGH VOLTAGE'), 8.0, 2.0, FZ + 0.02, 0, 256);
  decal(base, 0.7, 0.62, warn, 14.0, 2.0, FZ + 0.02, 0, 128);
  // ---------- ľavý stĺp: červený hlavový blok so žltým dvojpruhom ----------
  const frame = grp('kryt');
  rbox(frame, -15.3, -12.4, 4.4, 18.9, -11.8, -0.8, M.dark, 0.3);
  rbox(frame, -15.3, -12.4, 4.4, 18.9, -0.8, FZ, M.red, 0.35);
  decal(frame, 2.3, 1.0, yellowBars, -13.85, 17.0, FZ + 0.02, 0, 256);
  decal(
    frame,
    0.8,
    7.2,
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
    11.0,
    FZ + 0.02,
    0,
    128,
  );
  decal(frame, 2.2, 0.48, (g, w, h) => logo(g, w, h, '#FFFFFF', RED), -13.85, 6.2, FZ + 0.02);
  // ---------- pevný korpus: čierna zadná stena, tmavé vnútro, pevná strecha ----------
  box(frame, AX0, AX1, 4.4, CEIL, -11.8, -11.3, M.dark); // zadná stena
  box(frame, AX0, AX1, 7.6, 7.85, -11.3, FZ - 0.3, M.black); // podlaha rezacieho priestoru
  box(frame, AX0, AX0 + 0.1, 7.85, CEIL, -11.3, FZ - 0.5, M.black); // ľavý vnútorný obklad
  box(frame, AX1 - 0.4, AX1, 4.4, CEIL, -11.3, FZ - 0.3, M.dark); // pravá priečka
  box(frame, AX1 - 0.45, AX1 - 0.4, 7.85, CEIL, -11.3, FZ - 0.5, M.black);
  box(frame, AX0, AX1, 4.4, 7.6, -11.3, FZ - 0.4, M.dark); // teleso pod stolom
  rbox(frame, AX0, AX1, 4.4, 7.7, 10.2, FZ, M.cab, 0.2); // strieborný predný plech pod otvorom
  decal(
    frame,
    2.4,
    0.5,
    textDraw('CLASS 1 LASER PRODUCT', '#111', { font: 'bold', size: 0.5, align: 'center', bg: '#F5F5F0' }),
    -8.2,
    5.2,
    FZ + 0.01,
  );
  decal(frame, 1.4, 0.7, warn, -5.5, 5.3, FZ + 0.01, 0, 128);
  decal(frame, 2.6, 0.55, (g, w, h) => logo(g, w, h), 1.6, 5.8, FZ + 0.01);
  decal(frame, 3.4, 0.4, stripes(3), 1.8, 4.9, FZ + 0.015);
  rbox(frame, -12.6, 6.0, CEIL, BV.ROOF_Y, -11.8, 0.0, M.cab, 0.15); // zadná (pevná) polovica strechy
  box(frame, AX0, AX1, CEIL - 0.04, CEIL, -11.3, 0.0, M.black);
  // LED osvetlenie priestoru (pásy pod strechou)
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde8ff, emissiveIntensity: 1.2 });
  const led = add(frame, new THREE.BoxGeometry(14.0, 0.08, 0.3), ledMat, -3.3, CEIL - 0.08, -5.0);
  led.userData.noMerge = true;
  const cabLight = new THREE.PointLight(0xeef4ff, 0, 30, 1.5);
  cabLight.position.set(-3.3, 17.6, 2.0);
  frame.add(cabLight);
  // ---------- pravá skriňa: strieborné čelo, čierny korpus, logo, nápis, pruhy ----------
  rbox(frame, AX1, 15.3, 4.4, 17.5, -11.8, FZ - 0.5, M.dark, 0.5);
  rbox(frame, AX1, 15.3, 4.4, 17.5, 6.0, FZ, M.cab, 0.5);
  rbox(frame, 6.1, 15.0, 17.3, 17.9, -11.5, 11.4, M.dark, 0.25);
  decal(frame, 5.0, 0.95, (g, w, h) => logo(g, w, h), 12.0, 15.9, FZ + 0.02);
  decal(frame, 6.4, 0.8, textDraw('BREVIS 1212 AJ', '#1E1F21', { size: 0.72, align: 'right' }), 11.8, 14.3, FZ + 0.02);
  decal(frame, 3.6, 1.6, signature, 9.4, 11.8, FZ + 0.02, 0, 512);
  decal(frame, 8.4, 2.2, stripes(5), 10.7, 7.4, FZ + 0.02);
  decal(frame, 1.5, 0.5, label('AMNC 3i'), 14.0, 9.9, FZ + 0.02, 0, 256);
  // ---------- servisné dvere: ľavé na stĺpe, dve na pravom boku ----------
  // span = ±1: panel leží od pántu v lokálnom +x alebo −x; otvorenie = rotácia ry0 − span·φ (von zo stroja)
  const sideDoor = (parent, hingeX, hingeZ, w, y0, y1, ry0, span, mat, deco) => {
    const pv = new THREE.Group();
    pv.position.set(hingeX, 0, hingeZ);
    pv.rotation.y = ry0;
    parent.add(pv);
    const x0 = Math.min(0, span * w),
      x1 = Math.max(0, span * w),
      hx = span * (w - 0.4),
      hy = (y0 + y1) / 2;
    rbox(pv, x0, x1, y0, y1, 0, 0.12, mat, 0.06);
    box(pv, x0, x1, y1 - 0.04, y1, 0.12, 0.125, M.dark);
    box(pv, x0, x1, y0, y0 + 0.04, 0.12, 0.125, M.dark);
    box(pv, x0, x0 + 0.04, y0, y1, 0.12, 0.125, M.dark);
    box(pv, x1 - 0.04, x1, y0, y1, 0.12, 0.125, M.dark);
    box(pv, x0 + 0.2, x1 - 0.2, y0 + 0.2, y0 + 0.3, 0.12, 0.13, M.black); // vetracia štrbina
    rbox(pv, hx - 0.1, hx + 0.1, hy - 0.8, hy + 0.8, 0.12, 0.3, M.black, 0.05); // madlo
    cylZ(pv, 0.12, 0.12, 0.12, 0.2, hx, hy + 1.2, M.steel, 12); // zámok
    hitProxy(pv, 0.7, hx, hy, 0.3);
    if (deco) deco(pv, (x0 + x1) / 2, y0, y1);
    return { pivot: pv, ry0, span, open: 0 };
  };
  const doorsSide = [
    sideDoor(frame, -15.32, 8.6, 7.8, 5.2, 16.8, -Math.PI / 2, -1, M.red), // ľavý bok stĺpa
    sideDoor(frame, 15.32, -11.0, 9.2, 5.0, 16.4, Math.PI / 2, -1, M.dark, (pv, xc, y0, y1) =>
      decal(pv, 4.0, 0.78, (g, w, h) => logo(g, w, h, '#FFFFFF', '#2B2D30'), xc, (y0 + y1) / 2 + 2.2, 0.14),
    ), // pravý bok – zadné
    sideDoor(frame, 15.32, 11.0, 9.2, 5.0, 16.4, Math.PI / 2, 1, M.dark, (pv, xc, y0) =>
      decal(pv, 8.0, 2.0, stripes(5), xc, y0 + 2.3, 0.14),
    ), // pravý bok – predné
  ];
  // ---------- čelo: dva veľké posuvné panely so zelenými oknami + zdvíhateľná strecha ----------
  const fd = grp('dvere', frame);
  const PW = BV.PW;
  const W0 = 11.4,
    W1 = 17.3; // spodná a horná hrana okien
  // panel = skupina v svetových súradniciach zatvorenej polohy; posúva sa pozdĺž x doprava do pravej skrine
  const mkPanel = (xa, xb, z0, z1, win) => {
    const g = new THREE.Group();
    fd.add(g);
    rbox(g, xa, xb, W1, AY1, z0, z1, M.cab, 0.08); // horný pás
    rbox(g, xa, xb, AY0, W0, z0, z1, M.cab, 0.08); // spodný pás
    rbox(g, xa, win[0], W0, W1, z0, z1, M.cab, 0.06);
    rbox(g, win[1], xb, W0, W1, z0, z1, M.cab, 0.06);
    // spodný pás s tmavým pruhom a rámik okna
    box(g, xa + 0.15, xb - 0.15, AY0 + 0.1, AY0 + 0.45, z1, z1 + 0.02, M.cab2);
    const zf = z1 + 0.012;
    box(g, win[0] - 0.12, win[1] + 0.12, W1, W1 + 0.12, z0, zf, M.black);
    box(g, win[0] - 0.12, win[1] + 0.12, W0 - 0.12, W0, z0, zf, M.black);
    box(g, win[0] - 0.12, win[0], W0, W1, z0, zf, M.black);
    box(g, win[1], win[1] + 0.12, W0, W1, z0, zf, M.black);
    const gl = add(
      g,
      new THREE.PlaneGeometry(win[1] - win[0], W1 - W0),
      M.glass,
      (win[0] + win[1]) / 2,
      (W0 + W1) / 2,
      (z0 + z1) / 2,
    );
    gl.userData.noMerge = true;
    return g;
  };
  const PWA = PW - 0.3;
  const panelA = mkPanel(AX0, AX0 + PWA, FZ - 0.95, FZ - 0.62, [AX0 + 1.1, AX0 + PWA - 1.0]);
  const panelB = mkPanel(AX1 - PW, AX1, FZ - 0.4, FZ - 0.07, [AX1 - PW + 1.2, AX1 - 1.1]);
  // čierne úchytky s uhlovými rohmi na stretnutí panelov + zámok
  const hx = AX1 - PW + 0.55;
  rbox(panelB, hx - 0.16, hx + 0.16, 11.6, 16.6, FZ - 0.07, FZ + 0.32, M.black, 0.1);
  rbox(panelB, hx - 0.16, hx + 0.7, 16.35, 16.7, FZ - 0.07, FZ + 0.2, M.black, 0.08); // horný uhol
  rbox(panelB, hx - 0.16, hx + 0.7, 11.5, 11.85, FZ - 0.07, FZ + 0.2, M.black, 0.08); // dolný uhol
  hitProxy(panelB, 1.0, hx, 14.0, FZ + 0.3);
  // úchytka aj na ľavom paneli (zakrytá pravým, odkryje sa pri otvorení)
  rbox(panelA, AX0 + PWA - 0.35, AX0 + PWA - 0.05, 12.0, 16.2, FZ - 0.62, FZ - 0.4, M.black, 0.05);
  // polepy na paneloch
  decal(panelB, 1.0, 0.9, warn, AX1 - 0.75, 9.4, FZ - 0.055, 0, 128);
  decal(
    panelB,
    2.4,
    0.4,
    textDraw('AMADA', RED, { font: 'bold', size: 0.9, align: 'center' }),
    AX1 - 3.4,
    9.6,
    FZ - 0.055,
  );
  decal(
    panelA,
    2.8,
    0.34,
    textDraw('FIBER LASER', '#2B2D30', { font: 'bold', size: 0.85, align: 'center' }),
    AX0 + 3.4,
    9.6,
    FZ - 0.605,
  );
  // strecha: predná polovica sa zdvíha hore na pánte v strede stroja – prístup pre žeriav
  const hood = new THREE.Group();
  hood.position.set(0, BV.ROOF_Y, 0);
  fd.add(hood);
  rbox(hood, -12.6, 6.0, -0.5, 0, 0.0, FZ, M.cab, 0.15);
  rbox(hood, -12.6, 6.0, -0.75, -0.2, FZ - 0.9, FZ, M.cab, 0.12); // čelný nadpražný pás
  box(hood, AX0, AX1, -0.52, -0.5, 0.0, FZ - 0.9, M.black); // tmavá spodná strana
  const led2 = add(hood, new THREE.BoxGeometry(14.0, 0.08, 0.3), ledMat, -3.3, -0.58, 7.0);
  led2.userData.noMerge = true;
  box(hood, -12.5, 5.9, -0.05, 0.02, -0.05, 0.4, M.black); // pánt
  [-10.5, 4.0].forEach((x) => cylX(hood, 0.2, 0.2, x - 0.8, x + 0.8, 0, 0, M.steelD, 12));
  // plynové vzpery strechy
  [-12.3, 5.7].forEach((x) => cylY(frame, 0.12, 0.12, 16.9, CEIL, x, -0.3, M.steel, 10));
  decal(hood, 3.0, 0.5, (g, w, h) => logo(g, w, h, RED), -7.5, -0.47, FZ + 0.01);
  decal(
    hood,
    4.0,
    0.38,
    textDraw('BREVIS 1212 AJ', '#2B2D30', { size: 0.72, align: 'center' }),
    -1.0,
    -0.47,
    FZ + 0.01,
    0,
    512,
  );
  // ---------- výsuvný stôl (červená paleta so špicatým lôžkom) ----------
  const tbl = grp('stol', frame);
  const drawer = new THREE.Group();
  tbl.add(drawer);
  [-11.3, 4.7].forEach((x) => box(tbl, x - 0.15, x + 0.15, 7.6, 7.9, -9.0, FZ - 0.3, M.steelD));
  const ext = [-11.3, 4.7].map((x) => box(tbl, x - 0.12, x + 0.12, 7.62, 7.86, FZ - 3.0, FZ - 0.3, M.steel));
  rbox(drawer, -11.6, -11.0, 7.9, BV.TY - 0.1, -8.0, 7.6, M.red, 0.06);
  rbox(drawer, 4.4, 5.0, 7.9, BV.TY - 0.1, -8.0, 7.6, M.red, 0.06);
  rbox(drawer, -11.6, 5.0, 7.9, BV.TY - 0.05, 7.6, 8.1, M.red, 0.08); // predné čelo palety
  rbox(drawer, -11.6, 5.0, 7.9, 8.4, -8.1, -7.6, M.red, 0.06);
  // pílovité lamely (špicaté lôžko): jeden profil v rovine (z, y) vytlačený na hrúbku lamely
  const tooth = new THREE.Shape();
  const ZL = 7.5,
    STEP = 0.5,
    PLATE = BV.TY - 0.22;
  tooth.moveTo(-ZL, 8.1);
  tooth.lineTo(ZL, 8.1);
  tooth.lineTo(ZL, PLATE);
  for (let z = ZL; z > -ZL + 1e-6; z -= STEP) {
    tooth.lineTo(z - STEP / 2, BV.TY);
    tooth.lineTo(z - STEP, PLATE);
  }
  tooth.closePath();
  const slatGeo = new THREE.ExtrudeGeometry(tooth, { depth: 0.06, bevelEnabled: false });
  slatGeo.rotateY(Math.PI / 2);
  slatGeo.translate(-0.03, 0, 0);
  for (let x = -10.7; x <= 4.2; x += 0.62) {
    const sl = add(drawer, slatGeo, M.slat, x, 0, 0);
    sl.castShadow = false;
  }
  const handles = [-8.5, 1.9].map((x) => {
    const h = new THREE.Group();
    h.position.set(x, 8.5, 8.1);
    drawer.add(h);
    cylX(h, 0.08, 0.08, -0.7, 0.7, 0, 0.45, M.black, 12);
    box(h, -0.7, -0.55, -0.08, 0.08, 0, 0.45, M.black);
    box(h, 0.55, 0.7, -0.08, 0.08, 0, 0.45, M.black);
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
    box(gan, -12.2, 5.2, 12.6, 13.0, z - 0.35, z + 0.35, M.black);
    box(gan, -12.2, 5.2, 13.0, 13.12, z - 0.12, z + 0.12, M.steel);
  });
  const gx = new THREE.Group();
  gan.add(gx);
  rbox(gx, -0.45, 0.45, 13.1, 14.7, -10.1, 9.9, M.red, 0.12);
  box(gx, -0.48, 0.48, 13.25, 13.4, -10.1, 9.9, M.steel);
  box(gx, -0.3, 0.3, 14.7, 14.85, -10.0, 9.8, M.black); // vedenie vozíka
  const gz = new THREE.Group();
  gx.add(gz);
  rbox(gz, -0.75, 0.75, 12.0, 15.0, -0.7, 0.7, M.black, 0.1);
  rbox(gz, -0.78, 0.78, 13.1, 15.0, -0.72, 0.72, M.red, 0.14); // červený hlavový blok
  box(gz, -0.8, 0.8, 13.0, 13.1, -0.74, 0.74, M.steel);
  const gy = new THREE.Group();
  gz.add(gy);
  cylY(gy, 0.38, 0.38, 0.8, 3.4, 0, 0, M.black, 24);
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
  // čierna energetická reťaz pri zadnej stene (články)
  for (let x = -12.0; x < 5.0; x += 0.46) {
    box(gan, x, x + 0.4, 14.8, 15.5, -10.9, -10.4, M.black);
    box(gan, x + 0.12, x + 0.28, 15.5, 15.58, -10.8, -10.5, M.steelD);
  }
  box(gan, -12.2, -11.6, 14.6, 15.7, -10.95, -10.35, M.steelD);
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
  // ---------- ovládací panel AMNC 3i: robustný tablet na otočnom ramene nad tlačidlovou doskou ----------
  const pan = grp('panel');
  rbox(pan, -19.4, -17.4, 0, 0.25, 9.6, 11.6, M.dark, 0.06);
  cylY(pan, 0.22, 0.22, 0.25, 11.0, -18.4, 10.6, M.dark, 16);
  // otočné rameno z kolóna na čelo stĺpa
  rbox(pan, -18.7, -16.9, 10.8, 11.3, 10.3, 12.4, M.dark, 0.1);
  rbox(pan, -17.6, -15.3, 14.55, 15.05, 10.3, 10.8, M.black, 0.1);
  rbox(pan, -17.9, -17.4, 14.55, 15.05, 10.3, 12.3, M.black, 0.1);
  cylY(pan, 0.3, 0.3, 14.3, 15.3, -15.5, 10.55, M.steelD, 14); // čap ramena
  const head = new THREE.Group();
  head.position.set(-17.3, 13.4, 12.6);
  head.rotation.y = 0.35;
  pan.add(head);
  // tablet (horná časť): čierny odolný rám s gumovými rebrovanými bokmi
  rbox(head, -1.75, 1.75, -0.05, 2.75, -0.38, 0, M.black, 0.22);
  [-1.82, 1.82].forEach((x) => {
    for (let k = 0; k < 7; k++)
      rbox(head, x - 0.09, x + 0.09, 0.2 + k * 0.34, 0.42 + k * 0.34, -0.34, 0.04, M.panelL, 0.04);
  });
  const display = add(
    head,
    new THREE.PlaneGeometry(2.9, 1.78),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    0,
    1.35,
    0.025,
  );
  display.userData.noMerge = true;
  decal(head, 1.0, 0.2, (g, w, h) => logo(g, w, h, '#FFFFFF', '#2B2D30'), -0.4, 2.52, 0.03, 0, 256);
  decal(
    head,
    0.9,
    0.2,
    textDraw('AMNC 3i', '#E8EBE6', { font: 'bold', size: 0.8, align: 'center' }),
    0.9,
    2.52,
    0.03,
    0,
    256,
  );
  // červená doska s nápisom BREVIS pod tabletom
  rbox(head, -1.5, 1.5, 0.04, 0.32, 0, 0.05, M.red, 0.04);
  decal(
    head,
    1.4,
    0.2,
    textDraw('BREVIS', '#FFFFFF', { font: 'bold italic', size: 0.8, align: 'center' }),
    0,
    0.18,
    0.06,
    0,
    256,
  );
  // tlačidlová doska (spodná časť)
  rbox(head, -1.7, 1.7, -2.4, -0.2, -0.38, 0.06, M.panelL, 0.14);
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
  rbox(pend, -0.32, 0.32, -0.9, 0, -0.15, 0.15, M.black, 0.1);
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
  rbox(pedal, -0.45, 0.45, 0.7, 0.85, -0.5, 0.55, M.black, 0.05);
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
    door: panelB, // úchytka na paneli (ovládací prvok)
    panels: [
      { g: panelA, travel: AX1 - AX0 }, // zadný panel prejde celú šírku otvoru
      { g: panelB, travel: PW }, // predný panel sa zasunie do pravej skrine
    ],
    hood,
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
    led2,
    cabLight,
  };
}
