// Nástrojárska frézka TOS FNK 25 bez three.js: stopková fréza v natočenej zvislej hlave (úkos), obálka nástroja
// nad výškovou mapou a rozbor úkosu / drážky. Dĺžky v mm, uhly v stupňoch.

export const FNK = {
  speeds: [56, 80, 112, 160, 224, 315, 450, 630, 900, 1250, 1800, 2500, 3550, 4500], // 56 – 4 500 ot/min
  feeds: [16, 25, 40, 63, 100, 160, 250, 400], // mm/min
  tilt: 45, // natočenie hlavy ±45°
  tools: { e16: { d: 16, len: 40 }, e12: { d: 12, len: 30 } },
};
export const cuttingSpeed = (n, d) => (Math.PI * d * n) / 1000;
// os nástroja pri natočení hlavy o h° okolo osi Z stroja (k +X), smer od čela nástroja k vretenu
export const toolAxis = (h) => {
  const r = (h * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r), 0];
};
// najnižší bod nástroja (valec polomeru r, dĺžky len od čela E pozdĺž osi a) nad bodom (x, z) – vzorkovanie diskami
export function endMillBottom(E, a, r, len, x, z, n = 10) {
  let lo = Infinity;
  for (let k = 0; k <= n; k++) {
    const s = (len * k) / n,
      cx = E[0] + a[0] * s,
      cy = E[1] + a[1] * s,
      cz = E[2] + a[2] * s;
    if (Math.abs(a[1]) < 1e-6) continue;
    // rovina disku: (p − c)·a = 0 → y na zvislej priamke (x, z)
    const y = cy - ((x - cx) * a[0] + (z - cz) * a[2]) / a[1];
    const dx = x - cx,
      dy = y - cy,
      dz = z - cz;
    if (dx * dx + dy * dy + dz * dz <= r * r + 1e-9) lo = Math.min(lo, y);
  }
  return lo;
}
// rozbor úkosu na hrane x = W (hranol W × D × H, uzly ako vo výškovej mape): šírka úkosu a uhol roviny
export function chamferInfo(hf, minDepth = 0.3) {
  const { hgt, NX, NZ, W, D, H } = hf,
    dX = W / NX;
  let n = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0,
    xMin = Infinity,
    rows = 0,
    rowsCut = 0;
  for (let j = 1; j < NZ; j++) {
    rows++;
    let any = false;
    for (let i = 1; i <= NX; i++) {
      const d = H - hgt[j * (NX + 1) + i];
      if (d < minDepth) continue;
      any = true;
      const x = i * dX;
      n++;
      sx += x;
      sy += d;
      sxx += x * x;
      sxy += x * d;
      xMin = Math.min(xMin, x);
    }
    if (any) rowsCut++;
  }
  if (n < 3) return { cut: false, width: 0, angle: 0, along: 0 };
  const slope = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx);
  return {
    cut: true,
    width: W - xMin + dX / 2,
    angle: (Math.atan(slope) * 180) / Math.PI,
    along: rowsCut / rows,
    D,
  };
}
export const fnkChecks = {
  ukos: (m) => [
    { key: 'angle', ok: m.ch.cut && Math.abs(m.ch.angle - 30) <= 0.5, value: `${m.ch.angle.toFixed(1)}°` },
    { key: 'width', ok: m.ch.cut && Math.abs(m.ch.width - 15) <= 0.6, value: `${m.ch.width.toFixed(1)} mm` },
    { key: 'along', ok: m.ch.along > 0.97, value: `${Math.round(m.ch.along * 100)} %` },
    { key: 'crash', ok: !m.crashes, value: String(m.crashes) },
  ],
  drazka: (m) => [
    {
      key: 'depth',
      ok: m.slot.cut && m.slot.depthMin >= 5.85 && m.slot.depthMax <= 6.15,
      value: `${m.slot.depthMin.toFixed(2)} – ${m.slot.depthMax.toFixed(2)} mm`,
    },
    { key: 'width', ok: Math.abs(m.slot.width - 12) <= 0.3, value: `${m.slot.width.toFixed(1)} mm` },
    { key: 'through', ok: m.slot.through > 0.97, value: `${Math.round(m.slot.through * 100)} %` },
    { key: 'crash', ok: !m.crashes, value: String(m.crashes) },
  ],
};
