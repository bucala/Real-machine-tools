// Rozbor výškovej mapy obrobku (fréza, brúska) bez three.js – meranie a kontrola úloh. Všetky výsledky v mm.
// hf = { hgt, mask, NX, NZ, W, D, H } v jednotkách scény (1 = 100 mm); uzol (i, j) leží na x = i·W/NX, z = j·D/NZ od rohu.

export function hfInfo(hf) {
  const { hgt, mask, NX, NZ, W, D, H } = hf, dX = W / NX * 100, dZ = D / NZ * 100;
  const at = (i, j) => (H - hgt[j * (NX + 1) + i]) * 100;            // hĺbka pod pôvodnou plochou
  const depthAt = (x, z) => at(Math.max(0, Math.min(NX, Math.round(x / dX))), Math.max(0, Math.min(NZ, Math.round(z / dZ))));
  // len vnútorné uzly – okraje sú bočné steny
  let cut = 0, tot = 0, maxDep = 0, lo = Infinity, hi = -Infinity;
  for (let j = 1; j < NZ; j++) for (let i = 1; i < NX; i++) {
    tot++; const d = at(i, j); if (d > maxDep) maxDep = d;
    if (mask && mask[j * (NX + 1) + i]) { cut++; lo = Math.min(lo, d); hi = Math.max(hi, d); }
  }
  return { NX, NZ, dX, dZ, L: W * 100, Wd: D * 100, H: H * 100, at, depthAt, cover: tot ? cut / tot : 0, maxDep, cutMin: cut ? lo : 0, cutMax: cut ? hi : 0 };
}

// drážka v smere X: v každom stĺpci (x) súvislý úsek uzlov s hĺbkou ≥ polovica cieľa
export function grooveInfo(info, target) {
  const widths = [], depths = [], centers = []; let cols = 0;
  for (let i = 1; i < info.NX; i++) {
    let best = null, run = null;
    for (let j = 0; j <= info.NZ; j++) {
      const d = info.at(i, j);
      if (d >= target / 2) { if (!run) run = { a: j, b: j, s: 0, n: 0 }; run.b = j; run.s += d; run.n++; }
      if ((d < target / 2 || j === info.NZ) && run) { if (!best || run.n > best.n) best = run; run = null; }
    }
    if (best) { cols++; widths.push((best.b - best.a) * info.dZ); depths.push(best.s / best.n); centers.push((best.a + best.b) / 2 * info.dZ); }
  }
  const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  // šírka medzi krajnými uzlami s hĺbkou + jedna bunka (hrana leží medzi uzlami)
  return { cover: cols / Math.max(1, info.NX - 1), width: widths.length ? med(widths) + info.dZ : 0, depth: med(depths), center: med(centers) };
}

const f2 = (v) => v.toFixed(2);
const ok = (v, t, tol) => Math.abs(v - t) <= tol;

export const millChecks = {
  drazka: ({ info }) => {
    const g = grooveInfo(info, 5);
    return [
      { key: 'depth', ok: ok(g.depth, 5, 0.15), actual: g.cover ? `${f2(g.depth)} mm` : '–' },
      { key: 'width', ok: ok(g.width, 20, Math.max(1, info.dZ * 1.2)), actual: g.cover ? `${f2(g.width)} mm` : '–' },
      { key: 'len', ok: g.cover >= 0.95, actual: `${Math.round(g.cover * 100)} %` },
      { key: 'center', ok: g.cover > 0 && ok(g.center, info.Wd / 2, Math.max(1, info.dZ * 1.2)), actual: g.cover ? `${f2(g.center)} mm` : '–' },
    ];
  },
  rovina: ({ info }) => {
    let inTol = 0, n = 0;
    for (let j = 1; j < info.NZ; j++) for (let i = 1; i < info.NX; i++) { n++; if (ok(info.at(i, j), 2, 0.1)) inTol++; }
    const share = n ? inTol / n : 0;
    return [
      { key: 'share', ok: share >= 0.95, actual: `${Math.round(share * 100)} %` },
      { key: 'max', ok: info.maxDep <= 2.1, actual: `${f2(info.maxDep)} mm` },
    ];
  },
};

export const grindChecks = {
  rovinnost: ({ info }) => {
    const removed = info.cutMin, flat = info.cutMax - info.cutMin;
    return [
      { key: 'cover', ok: info.cover >= 0.98, actual: `${Math.round(info.cover * 100)} %` },
      { key: 'removed', ok: removed >= 0.1 - 1e-6, actual: `${removed.toFixed(3)} mm` },
      { key: 'flat', ok: info.cover > 0 && flat <= 0.01 + 1e-6, actual: `${flat.toFixed(3)} mm` },
    ];
  },
};
