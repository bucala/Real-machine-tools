// Deliaci prístroj frézy bez three.js: plán delenia, kruhová tyč ako polomer r(x, θ), rez frézou zhora a rozbor mnohohrana.
// Testované v tests/millIndex.test.js. Tyč: jednotky scény (1 = 100 mm), os X, uhol θ meraný od +Y k +Z.

export const DIV_RATIO = 40; // závitovka : závitové koleso
export const HOLE_CIRCLES = [15, 16, 17, 18, 19, 20, 21, 23, 27, 29, 31, 33, 37, 39, 41, 43, 47, 49];
export const DIVISIONS = [2, 3, 4, 5, 6, 8, 10, 12];

// jednoduché delenie: n = 40 / z = celé otáčky + diery na vhodnom kruhu deliaceho kotúča
export function indexPlan(z) {
  const turns = Math.floor(DIV_RATIO / z),
    rem = DIV_RATIO % z;
  if (!rem) return { turns, holes: 0, circle: null, exact: true };
  for (const n of HOLE_CIRCLES) if ((rem * n) % z === 0) return { turns, holes: (rem * n) / z, circle: n, exact: true };
  return { turns, holes: 0, circle: null, exact: false };
}

// tyč dĺžky L a polomeru R: NX + 1 rezov pozdĺž osi, NT lúčov po obvode
export function createBar({ L, R, NX, NT }) {
  const n = (NX + 1) * NT,
    r = new Float32Array(n).fill(R),
    mask = new Uint8Array(n);
  return { L, R, NX, NT, dX: L / NX, dT: (2 * Math.PI) / NT, r, mask };
}

// Rez frézou s rovným čelom (stopková, čelná): valec s osou zvisle, polomer rc, čelo vo výške yb nad osou tyče,
// stred v (cx, cz) voči stredu tyče. phi = natočenie tyče deliacim prístrojom. write = zapísať rez.
// Vráti najväčšie vniknutie (pen) a odobratý objem (rem). Lúč, ktorý z frézy vystúpi ešte v materiáli, sa nereže
// (výšková mapa po polomere nevie zobraziť previs).
export function barCut(b, phi, rc, yb, cx, cz, write = false) {
  let pen = 0,
    rem = 0;
  const i0 = Math.max(0, Math.ceil((cx - rc + b.L / 2) / b.dX - 1e-9)),
    i1 = Math.min(b.NX, Math.floor((cx + rc + b.L / 2) / b.dX + 1e-9));
  for (let i = i0; i <= i1; i++) {
    const dx = -b.L / 2 + i * b.dX - cx,
      w2 = rc * rc - dx * dx;
    if (w2 < 0) continue;
    const w = Math.sqrt(w2);
    for (let j = 0; j < b.NT; j++) {
      const k = i * b.NT + j,
        R0 = b.r[k],
        a = j * b.dT + phi,
        ca = Math.cos(a),
        sa = Math.sin(a);
      let lo = 0,
        hi = Infinity;
      if (ca > 1e-6) lo = Math.max(lo, yb / ca);
      else if (ca < -1e-6) {
        if (yb >= 0) continue;
        hi = Math.min(hi, yb / ca);
      } else if (yb > 0) continue;
      if (sa > 1e-6) {
        lo = Math.max(lo, (cz - w) / sa);
        hi = Math.min(hi, (cz + w) / sa);
      } else if (sa < -1e-6) {
        lo = Math.max(lo, (cz + w) / sa);
        hi = Math.min(hi, (cz - w) / sa);
      } else if (Math.abs(cz) > w) continue;
      if (lo >= R0 || hi < R0 - 1e-6 || lo > hi) continue;
      const p = R0 - lo;
      if (p > pen) pen = p;
      if (write) {
        rem += p;
        b.r[k] = lo;
        b.mask[k] = 1;
      }
    }
  }
  return { pen, rem };
}

// Rozbor mnohohrana v obrobenej časti: pre každý lúč najmenší polomer cez obrobenú dĺžku, potom z stien po 360°/z.
// Vráti rozmer cez plochy s (mm) pre každú stenu, rovinnosť stien, obrobenú dĺžku a uhlovú polohu prvej steny.
export function polyInfo(b, z) {
  let cutCols = 0;
  const rmin = new Float32Array(b.NT).fill(Infinity);
  for (let i = 0; i <= b.NX; i++) {
    let cut = false;
    for (let j = 0; j < b.NT; j++)
      if (b.mask[i * b.NT + j]) {
        cut = true;
        break;
      }
    if (!cut) continue;
    cutCols++;
    for (let j = 0; j < b.NT; j++) rmin[j] = Math.min(rmin[j], b.r[i * b.NT + j]);
  }
  const len = cutCols ? (cutCols - 1) * b.dX * 100 : 0;
  if (!cutCols) return { len: 0, faces: [], flat: Infinity, s: [] };
  // stena k: smer s najmenším polomerom v jej výseku; vzdialenosť steny = polomer × cos(odchýlka) zo susedných lúčov
  let j0 = 0;
  for (let j = 1; j < b.NT; j++) if (rmin[j] < rmin[j0]) j0 = j;
  const faces = [],
    step = b.NT / z;
  let flat = 0;
  for (let q = 0; q < z; q++) {
    const jc = Math.round(j0 + q * step) % b.NT,
      half = Math.floor(step * 0.35);
    // vzdialenosť roviny steny od osi: medián z r · cos(Δθ) v strede výseku
    const ds = [];
    for (let m = -half; m <= half; m++) {
      const jj = (((jc + m) % b.NT) + b.NT) % b.NT;
      ds.push(rmin[jj] * Math.cos(m * b.dT));
    }
    ds.sort((x, y) => x - y);
    const d = ds[Math.floor(ds.length / 2)] * 100;
    flat = Math.max(flat, (ds[ds.length - 1] - ds[0]) * 100);
    faces.push(d);
  }
  // rozmer cez plochy: protiľahlé steny (pri párnom z), inak 2 × vzdialenosť steny
  const s = z % 2 === 0 ? faces.slice(0, z / 2).map((d, q) => d + faces[q + z / 2]) : faces.map((d) => 2 * d);
  return { len, faces, flat, s, first: j0 * b.dT };
}

const f2 = (v) => v.toFixed(2);
export const indexChecks = {
  // šesťhran s = 36 mm na dĺžke aspoň 40 mm
  sesthran: ({ bar }) => {
    const p = bar ? polyInfo(bar, 6) : null,
      s = p ? p.s : [];
    return [
      {
        key: 'size',
        ok: s.length === 3 && s.every((v) => Math.abs(v - 36) <= 0.15),
        actual: s.length ? s.map(f2).join(' / ') : '–',
      },
      {
        key: 'flat',
        ok: !!p && p.faces.length === 6 && p.flat <= 0.2,
        actual: p && p.faces.length ? `${f2(p.flat)} mm` : '–',
      },
      { key: 'len', ok: !!p && p.len >= 40 - 1.5, actual: p ? `${Math.round(p.len)} mm` : '–' },
    ];
  },
  // štvorhran s = 30 mm na dĺžke aspoň 40 mm
  stvorhran: ({ bar }) => {
    const p = bar ? polyInfo(bar, 4) : null,
      s = p ? p.s : [];
    return [
      {
        key: 'size',
        ok: s.length === 2 && s.every((v) => Math.abs(v - 30) <= 0.15),
        actual: s.length ? s.map(f2).join(' / ') : '–',
      },
      {
        key: 'flat',
        ok: !!p && p.faces.length === 4 && p.flat <= 0.2,
        actual: p && p.faces.length ? `${f2(p.flat)} mm` : '–',
      },
      { key: 'len', ok: !!p && p.len >= 40 - 1.5, actual: p ? `${Math.round(p.len)} mm` : '–' },
    ];
  },
};
