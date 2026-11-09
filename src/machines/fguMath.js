// Univerzálna konzolová frézka TOS FGU 32 bez three.js: kotúčová fréza na vodorovnom tŕni, otočný stôl, nesúsledné /
// súsledné frézovanie a rozbor drážky na výškovej mape (hĺbka, šírka, uhol, prechod cez celý obrobok). Dĺžky v mm.

export const FGU = {
  speeds: [31.5, 45, 63, 90, 125, 180, 250, 355, 500, 710, 1000, 1400], // 12 otáčok vretena
  feeds: [20, 31.5, 50, 80, 125, 200, 315, 500], // posuv stola mm/min
  cutterD: 100, // kotúčová fréza Ø100
  cutterB: 10, // šírka 10 mm
  swivel: 45, // natočenie stola ±45°
};
// rezná rýchlosť (m/min) a vhodnosť pre HSS v oceli
export const cuttingSpeed = (n, d = FGU.cutterD) => (Math.PI * d * n) / 1000;
// súsledné (po smere) frézovanie: zub v mieste rezu ide rovnakým smerom ako posuv obrobku voči fréze
export const isClimb = (toothDir, feedDir) => toothDir * feedDir > 0;

// hĺbka rezu kotúča v bode vo vzdialenosti u od osi (v rovine kolmej na os): spodok kruhu polomeru R
export const discBottom = (yAxis, R, u) => (Math.abs(u) >= R ? Infinity : yAxis - Math.sqrt(R * R - u * u));

// rozbor drážky na výškovej mape: hf = { hgt, NX, NZ, W, D, H } v mm; uzol (i, j) na x = i·W/NX, z = j·D/NZ
export function slotInfo(hf, minDepth = 0.3) {
  const { hgt, NX, NZ, W, D, H } = hf,
    dX = W / NX,
    dZ = D / NZ;
  let cnt = 0,
    dMin = Infinity,
    dMax = 0,
    sx = 0,
    sz = 0,
    sxx = 0,
    sxz = 0;
  const cols = [];
  for (let i = 1; i < NX; i++) {
    let lo = Infinity,
      hi = -Infinity,
      deep = 0;
    for (let j = 1; j < NZ; j++) {
      const d = H - hgt[j * (NX + 1) + i];
      if (d < minDepth) continue;
      const x = i * dX,
        z = j * dZ;
      cnt++;
      dMax = Math.max(dMax, d);
      sx += x;
      sz += z;
      sxx += x * x;
      sxz += x * z;
      lo = Math.min(lo, z);
      hi = Math.max(hi, z);
      deep = Math.max(deep, d);
    }
    if (deep > 0) {
      cols.push({ x: i * dX, w: hi - lo + dZ, deep });
      dMin = Math.min(dMin, deep);
    }
  }
  if (!cnt) return { cut: false, depthMin: 0, depthMax: 0, width: 0, angle: 0, through: 0 };
  const n = cnt,
    slope = n * sxx - sx * sx > 1e-9 ? (n * sxz - sx * sz) / (n * sxx - sx * sx) : 0;
  const angle = (Math.atan(slope) * 180) / Math.PI;
  // šírka kolmo na os drážky z priemeru šírok stĺpcov (stĺpec meria šírku v smere Z)
  const wz = cols.reduce((a, c) => a + c.w, 0) / cols.length;
  const through = cols.length / (NX - 1);
  return {
    cut: true,
    depthMin: dMin === Infinity ? 0 : dMin,
    depthMax: dMax,
    width: wz * Math.cos(Math.atan(slope)),
    angle,
    through,
  };
}

// kontrola úloh: m = { slot: slotInfo, climbBad, crashes }
export const fguChecks = {
  drazka: (m) => [
    {
      key: 'depth',
      ok: m.slot.cut && m.slot.depthMin >= 4.85 && m.slot.depthMax <= 5.15,
      value: `${m.slot.depthMin.toFixed(2)} – ${m.slot.depthMax.toFixed(2)} mm`,
    },
    { key: 'through', ok: m.slot.through > 0.97, value: `${Math.round(m.slot.through * 100)} %` },
    { key: 'angle', ok: m.slot.cut && Math.abs(m.slot.angle) < 0.5, value: `${m.slot.angle.toFixed(1)}°` },
    { key: 'climb', ok: !m.climbBad, value: m.climbBad ? '✗' : '✓' },
  ],
  sikma: (m) => [
    {
      key: 'depth',
      ok: m.slot.cut && m.slot.depthMin >= 2.85 && m.slot.depthMax <= 3.15,
      value: `${m.slot.depthMin.toFixed(2)} – ${m.slot.depthMax.toFixed(2)} mm`,
    },
    {
      key: 'angle',
      ok: m.slot.cut && Math.abs(Math.abs(m.slot.angle) - 15) <= 0.5,
      value: `${m.slot.angle.toFixed(1)}°`,
    },
    { key: 'through', ok: m.slot.through > 0.97, value: `${Math.round(m.slot.through * 100)} %` },
    { key: 'climb', ok: !m.climbBad, value: m.climbBad ? '✗' : '✓' },
  ],
};
