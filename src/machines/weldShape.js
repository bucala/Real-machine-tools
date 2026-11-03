// Tvar a vzájomná poloha polotovarov pri zváraní – bez three.js, testované v tests/weldShape.test.js.
// Zvarenec je výšková mapa v mm: x pozdĺž dielu (pri rúre po obvode), z naprieč, hodnota = výška povrchu.
// Spoj je krivka (otvorená alebo uzavretá) so smerom; hodnotí sa pás naprieč krivkou.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const W2 = 60, RES = 0.5;                                   // pol šírky dielu a krok siete (mm)

// zvarová príprava podľa druhu a hrúbky (mm, polovičný uhol úkosu v °)
export const weldPrep = (id, t) => {
  if (id === 'I') return { gap: clamp(t * 0.5, 0.5, 2), root: t, ang: 0 };
  if (id === 'V') return { gap: 2, root: t > 8 ? 2 : 1.5, ang: 30 };
  if (id === 'HV') return { gap: 2, root: 1.5, ang: 45 };
  if (id === 'Y') return { gap: 1.5, root: clamp(t * 0.35, 2, 6), ang: 30 };
  if (id === 'U') return { gap: 1, root: 2, ang: 8, R: 4 };
  if (id === 'J') return { gap: 1, root: 2, ang: 10, R: 5 };
  return { gap: 0, root: t, ang: 0 };
};
// priečny profil spoja: výška povrchu podľa vzdialenosti z od osi spoja
export const weldProfile = (id, t, p) => {
  const g2 = p.gap / 2, ta = Math.tan(Math.max(1, p.ang) * Math.PI / 180);
  const vee = (u) => Math.min(t, p.root + Math.max(0, u - g2) / ta);
  const ucup = (u) => { const R = p.R; if (u <= R) return Math.min(t, p.root + R - Math.sqrt(Math.max(0, R * R - u * u))); return Math.min(t, p.root + R + (u - R) / ta); };
  return (z) => {
    const u = Math.abs(z);
    switch (id) {
      case 'I': return u < g2 ? 0 : t;
      case 'V': case 'Y': return u < g2 ? 0 : vee(u);
      case 'HV': return u < g2 ? 0 : z > 0 ? vee(u) : t;
      case 'U': return u < g2 ? 0 : ucup(u);
      case 'J': return u < g2 ? 0 : z > 0 ? ucup(u) : t;
      case 'K': return u < t / 2 ? t + 60 : t;
      case 'L': return z < 0 ? t : 2 * t;
      case 'E': return u < 0.4 ? 2.6 * t : u <= t + 0.4 ? 3 * t : t;
      default: return t;
    }
  };
};

// skupiny podľa tvaru a vzájomnej polohy polotovarov
export const SHAPE_GROUPS = [
  ['plane', 'Rovinné plechy', 'Flat plates'], ['perp', 'Kolmé plechy', 'Perpendicular plates'],
  ['round', 'Kruhové – rúry', 'Round – pipes'], ['shaped', 'Tvarové', 'Shaped'],
];
export const PIPE_D = [48.3, 60.3, 76.1, 88.9];                    // vonkajší Ø rúr (mm)
export const BOX_A = [40, 50, 60, 80];                             // strana jokla (mm)
export const ALL_POS = ['PA', 'PB', 'PC', 'PD', 'PE', 'PF', 'PG'];
// polohy zvárania, ktoré sa pre daný tvar dajú nastaviť (EN ISO 6947); pôvodné druhy majú všetky polohy plechov
const POS = {
  C: ['PA', 'PB', 'PD', 'PF', 'PG'], O: ['PA', 'PF', 'PG'], TV: ['PA', 'PC', 'PE', 'PF', 'PG'],
  RP: ['PB', 'PD', 'PH', 'PJ'], JK: ['PB', 'PD', 'PH', 'PJ'], RR: ['PH', 'PJ', 'H-L045', 'PC'],
};
export const posAllowed = (id) => POS[id] || ALL_POS;
export const usesSize = (id) => id === 'RR' || id === 'RP' || id === 'JK';
export const sizeOptions = (id) => (id === 'JK' ? BOX_A : PIPE_D);
export const sizeDefault = (id) => (id === 'JK' ? 50 : 60.3);
// polohy, v ktorých sa zvára hore / dole (kontrola smeru zvárania)
export const POS_UP = ['PF', 'PH', 'H-L045'], POS_DOWN = ['PG', 'PJ'];
export const POS_VERT = ['PF', 'PG', 'PE', 'PD', 'PH', 'PJ', 'H-L045'];

// body krivky po krokoch RES: priamka, kružnica, obdĺžnik so zaoblenými rohmi
const linePath = (z, L) => { const n = Math.round(L / RES), pts = []; for (let i = 0; i <= n; i++) pts.push({ x: -L / 2 + i * RES, z, tx: 1, tz: 0 }); return pts; };
const circlePath = (rho) => {
  const n = Math.round(2 * Math.PI * rho / RES), pts = [];
  for (let k = 0; k < n; k++) { const a = k / n * 2 * Math.PI; pts.push({ x: rho * Math.cos(a), z: rho * Math.sin(a), tx: -Math.sin(a), tz: Math.cos(a) }); }
  return pts;
};
// obrys štvorca s polstranou rovnej časti b a polomerom zaoblenia rho, proti smeru hodín
const roundRectPath = (b, rho) => {
  const pts = [], seg = [];
  const side = (x0, z0, tx, tz) => seg.push({ len: 2 * b, at: (s) => ({ x: x0 + tx * s, z: z0 + tz * s, tx, tz }) });
  const arc = (cx, cz, a0) => seg.push({ len: rho * Math.PI / 2, at: (s) => { const a = a0 + s / rho; return { x: cx + rho * Math.cos(a), z: cz + rho * Math.sin(a), tx: -Math.sin(a), tz: Math.cos(a) }; } });
  side(b + rho, -b, 0, 1); arc(b, b, 0); side(b, b + rho, -1, 0); arc(-b, b, Math.PI / 2);
  side(-b - rho, b, 0, -1); arc(-b, -b, Math.PI); side(-b, -b - rho, 1, 0); arc(b, -b, 1.5 * Math.PI);
  const total = seg.reduce((a, s) => a + s.len, 0), n = Math.round(total / RES);
  let si = 0, s0 = 0;
  for (let k = 0; k < n; k++) {
    const s = k * total / n;
    while (s - s0 > seg[si].len && si < seg.length - 1) { s0 += seg[si].len; si++; }
    pts.push(seg[si].at(s - s0));
  }
  return pts;
};

// Tvar polotovarov: id druhu zvaru, hrúbka t, dĺžka plechu L0, rozmer rúry / jokla D.
// Vráti výšku povrchu h0(x, z), úkos bev(x, z), krivku spoja, rúru (polomer R) a údaje pre hodnotenie.
export function makeShape(id, t, L0, D = 60.3) {
  const S = { id, t, L: L0, R: 0, cz: 0, so: 0, fillet: false, groove: true, gref: t, ref: t, cy: t, closed: false, lineY: t + 0.3 };
  const widthOf = (prof) => { for (let z = 0; z <= W2; z += RES) if (prof(z) >= t - 0.01 && prof(-z) >= t - 0.01) return z + 4; return 6; };
  const bevOf = (h) => h < t - 0.01 && h > 0.01;
  if (id === 'RR') {
    // rúra – rúra: obvodový tupý zvar; výšková mapa je rozvinutý plášť (x = oblúk po obvode)
    const sub = t <= 3 ? 'I' : 'V', prof = weldProfile(sub, t, weldPrep(sub, t)), n = Math.round(Math.PI * D / RES);
    Object.assign(S, { sub, L: n * RES, R: n * RES / (2 * Math.PI), closed: true, h0: (x, z) => prof(z), bev: (x, z) => bevOf(prof(z)), wTop: widthOf(prof) });
    S.gw = S.wTop; S.path = linePath(0, S.L).slice(0, -1);              // posledný bod obvodu je zhodný s prvým
  } else if (id === 'RP' || id === 'JK') {
    // rúra alebo jokel postavený na plech: kútový zvar dookola
    const s = clamp(t * 0.5, 2, 5), H = t + 50;
    Object.assign(S, { wall: s, fillet: true, groove: false, closed: true, L: Math.max(L0, Math.ceil((D + 50) / 10) * 10), wTop: 9, gw: 0, bev: () => false });
    if (id === 'RP') {
      const R = D / 2;
      S.h0 = (x, z) => { const r = Math.hypot(x, z); return r >= R - s && r <= R ? H : t; };
      S.path = circlePath(R + 1.5);
    } else {
      const rc = 2 * s, b = D / 2 - rc;
      const sd = (x, z) => { const qx = Math.abs(x) - b, qz = Math.abs(z) - b; return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rc; };
      S.h0 = (x, z) => { const d = sd(x, z); return d >= -s && d <= 0 ? H : t; };
      S.path = roundRectPath(b, rc + 1.5);
    }
  } else if (id === 'C') {
    // rohový spoj vnútorný: kolmý plech na okraji vodorovného, kútový zvar v kúte
    const jz = W2 - t - 1.5;
    Object.assign(S, { fillet: true, groove: false, cz: jz, so: t / 2 + 1.5, wTop: t / 2 + 10, gw: 0, h0: (x, z) => (z >= W2 - t ? t + 60 : t), bev: () => false, path: linePath(jz, L0) });
  } else if (id === 'O') {
    // rohový spoj vonkajší: dva plechy pod 90° hranou nahor, medzi hranami drážka V
    const H = W2 - 2, d = t * Math.SQRT1_2;
    Object.assign(S, {
      gref: H - d, ref: H - d, cy: H - d, lineY: H - d + 0.3, gw: d, wTop: d + 6, path: linePath(0, L0),
      h0: (x, z) => { const u = Math.abs(z); return u < d ? H - 2 * d + u : Math.max(0.5, H - u); }, bev: (x, z) => Math.abs(z) < d,
    });
  } else if (id === 'TV') {
    // tvarový rez: plechy spojené po vlnovke (napr. vypálený tvar), tupý zvar I alebo V
    const sub = t <= 4 ? 'I' : 'V', prof = weldProfile(sub, t, weldPrep(sub, t)), A = 10, k = 2 * Math.PI / 100;
    const z0 = (x) => A * Math.sin(k * x), dz = (x) => A * k * Math.cos(k * x);
    const u = (x, z) => (z - z0(x)) / Math.sqrt(1 + dz(x) ** 2);
    Object.assign(S, { sub, h0: (x, z) => prof(u(x, z)), bev: (x, z) => bevOf(prof(u(x, z))), wTop: widthOf(prof) });
    S.gw = S.wTop;
    S.path = linePath(0, L0).map((p) => { const g = dz(p.x), m = Math.sqrt(1 + g * g); return { x: p.x, z: z0(p.x), tx: 1 / m, tz: g / m }; });
  } else {
    // pôvodné druhy: priečny profil vytiahnutý po priamke
    const prof = weldProfile(id, t, weldPrep(id, t)), jz = id === 'K' ? t / 2 + 1.5 : id === 'L' ? 0.5 : 0;
    const wTop = id === 'K' ? t / 2 + 10 : id === 'L' ? 10 : id === 'E' ? t + 5 : id === 'N' ? W2 : widthOf(prof);
    Object.assign(S, {
      fillet: id === 'K' || id === 'L', groove: !['K', 'L', 'N'].includes(id), so: id === 'K' || id === 'L' ? -jz : 0, wTop, gw: wTop,
      ref: id === 'L' ? 2 * t : id === 'E' ? 3 * t : t, lineY: (id === 'E' ? 3 * t : t) + 0.3,
      h0: (x, z) => prof(z), bev: (x, z) => id !== 'K' && id !== 'L' && bevOf(prof(z)), path: linePath(jz, L0),
    });
  }
  return S;
}

// --- rozvinutý plášť rúry: bod výškovej mapy (x po obvode, výška y, z po osi) ↔ lokálne súradnice zvarenca ---
// vrch rúry (x = 0) leží v počiatku ako pri plechu, os rúry je lokálna z, stred rúry v hĺbke R − t
export const mapPoint = (S, x, y, z, out) => {
  if (!S.R) { out[0] = x; out[1] = y; out[2] = z; return out; }
  const a = x / S.R, r = S.R - S.t + y;
  out[0] = r * Math.sin(a); out[1] = r * Math.cos(a) - (S.R - S.t); out[2] = z; return out;
};
export const unmapPoint = (S, lx, ly, lz, out) => {
  if (!S.R) { out[0] = lx; out[1] = ly; out[2] = lz; return out; }
  const cy = ly + S.R - S.t;
  out[0] = Math.atan2(lx, cy) * S.R; out[1] = Math.hypot(lx, cy) - (S.R - S.t); out[2] = lz; return out;
};
// normála povrchu a smer pozdĺž x v lokálnych súradniciach
export const normalAt = (S, x, out) => { if (!S.R) { out[0] = 0; out[1] = 1; out[2] = 0; } else { const a = x / S.R; out[0] = Math.sin(a); out[1] = Math.cos(a); out[2] = 0; } return out; };
export const tangentOf = (S, x, tx, tz, out) => {
  if (!S.R) { out[0] = tx; out[1] = 0; out[2] = tz; return out; }
  const a = x / S.R; out[0] = tx * Math.cos(a); out[1] = -tx * Math.sin(a); out[2] = tz; return out;
};
export const wrapX = (S, x) => (S.R ? ((((x + S.L / 2) % S.L) + S.L) % S.L) - S.L / 2 : x);
export const diffX = (S, a, b) => (S.R ? a - b - S.L * Math.round((a - b) / S.L) : a - b);
// najbližší bod krivky spoja
export const nearestOnPath = (S, x, z) => {
  let best = S.path[0], bd = Infinity;
  for (const p of S.path) { const d = diffX(S, p.x, x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
};

// Hodnotenie húsenice pozdĺž krivky spoja: f = { h, h0, dep, NX } (stĺpce i = 0 … NX, riadky j = 0 … 2·W2/RES).
// cov = podiel zvarenej dĺžky, off = podiel kovu mimo spoja, fill = vyplnenie úkosu, width a reinf = priemer zvarenej časti.
export function evalBead(S, f) {
  const NZ = Math.round(2 * W2 / RES), cols = f.NX + 1, cell = (x, z) => {
    let i = Math.round((x + S.L / 2) / RES); const j = Math.round((z + W2) / RES);
    if (S.R) i = ((i % f.NX) + f.NX) % f.NX; else if (i < 0 || i > f.NX) return -1;
    return j < 0 || j > NZ ? -1 : j * cols + i;
  };
  let depTotal = 0; for (let k = 0; k < f.dep.length; k++) depTotal += f.dep[k] * RES;
  if (depTotal < 1) return null;
  const seen = new Uint8Array(f.dep.length);
  let covered = 0, grooveSum = 0, fillSum = 0, reinf = 0, widthSum = 0, depAll = 0;
  for (const p of S.path) {
    const nx = -p.tz, nz = p.tx;
    let dsum = 0, w = 0, top = 0;
    for (let u = -S.wTop; u <= S.wTop + 1e-9; u += RES) {
      const k = cell(p.x + nx * (u + S.so), p.z + nz * (u + S.so)); if (k < 0) continue;
      const d = f.dep[k];
      if (S.groove && Math.abs(u) <= S.gw + 1e-9) { const g = Math.max(0, S.gref - f.h0[k]); grooveSum += g * RES; fillSum += Math.min(g, d) * RES; }
      dsum += d * RES; if (d > 0.2) w += RES;
      if (d > 0.1) top = Math.max(top, f.h[k] - S.ref);
      if (!seen[k]) { seen[k] = 1; depAll += d * RES; }
    }
    if (dsum > 2) { covered++; widthSum += w; reinf += Math.max(0, top); }
  }
  return {
    cov: covered / S.path.length, off: S.id === 'N' ? 0 : Math.max(0, 1 - depAll / depTotal),
    fill: S.groove && grooveSum > 0 ? fillSum / grooveSum : null, width: covered ? widthSum / covered : 0, reinf: covered ? reinf / covered : 0,
  };
}
