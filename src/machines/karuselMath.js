// Karuselový (zvislý) sústruh TOS Hulín SK 12 bez three.js: kotúč s otvorom ako vonkajší polomer po riadkoch výšky,
// úber nožom (špička vľavo dole, nôž siaha von a nahor), obrys pre zobrazenie, meranie priemerov a výšky. Dĺžky v mm.

export const SK = {
  speeds: [3.15, 4.5, 6.3, 9, 12.5, 18, 25, 35.5, 50, 71], // otáčky stola ot/min
  feeds: [0.1, 0.16, 0.25, 0.4, 0.63], // posuv mm/ot
  table: 1200, // upínacia doska Ø1 200
  toolH: 25, // výška noža nad špičkou (mm)
};
export const cutSpeed = (D, n) => (Math.PI * D * n) / 1000; // m/min

// kotúč: vonkajší polomer R0, otvor rIn, výška H; riadky výšky dy
export function createDisc({ R0 = 500, rIn = 100, H = 200, dy = 0.5 } = {}) {
  const NY = Math.round(H / dy);
  return { R0, rIn, H, dy, NY, rOut: new Float32Array(NY).fill(R0) };
}
const rows = (d, y) => {
  const j0 = Math.max(0, Math.ceil(y / d.dy - 0.5)),
    j1 = Math.min(d.NY - 1, Math.floor((y + SK.toolH) / d.dy - 0.5));
  return [j0, j1];
};
// je nôž (špička r, y) v materiáli? Vráti hĺbku záberu v mm
export function engage(d, r, y) {
  const [j0, j1] = rows(d, y);
  let e = 0;
  for (let j = j0; j <= j1; j++) if (d.rOut[j] > d.rIn) e = Math.max(e, d.rOut[j] - Math.max(r, d.rIn));
  return e;
}
// úber: riadky nad špičkou (do výšky noža) sa skrátia na polomer špičky; pod otvorom riadok zmizne
export function cutTool(d, r, y) {
  const [j0, j1] = rows(d, y);
  let removed = 0;
  for (let j = j0; j <= j1; j++) {
    const nr = Math.max(d.rIn, r);
    if (d.rOut[j] > nr) {
      removed += d.rOut[j] - nr;
      d.rOut[j] = nr;
    }
  }
  return removed;
}
// obrys na sústruženie (LatheGeometry): body [r, y] od otvoru dole cez vonkajší obrys hore späť k otvoru
export function outline(d) {
  const pts = [[d.rIn, 0]];
  let top = 0;
  for (let j = 0; j < d.NY; j++) {
    const r = d.rOut[j];
    if (r <= d.rIn + 1e-6) break;
    if (!j || Math.abs(r - d.rOut[j - 1]) > 1e-6) pts.push([r, j * d.dy]);
    top = (j + 1) * d.dy;
    if (j === d.NY - 1 || Math.abs(d.rOut[j + 1] - r) > 1e-6) pts.push([r, top]);
  }
  pts.push([d.rIn, top]);
  return pts;
}
// meranie: výška, priemer spodnej časti a osadenia pri vrchu
export function discInfo(d) {
  let top = 0;
  for (let j = 0; j < d.NY; j++) if (d.rOut[j] > d.rIn + 1e-6) top = (j + 1) * d.dy;
  const band = (y0, y1) => {
    let lo = Infinity,
      hi = 0;
    for (let j = Math.max(0, Math.floor(y0 / d.dy)); j < Math.min(d.NY, Math.ceil(y1 / d.dy)); j++) {
      const r = d.rOut[j];
      if (r <= d.rIn + 1e-6) continue;
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    return { min: lo === Infinity ? 0 : 2 * lo, max: 2 * hi };
  };
  // osadenie: od vrchu riadky s polomerom menším ako spodná tretina
  const base = band(0, top / 3).max / 2;
  let step = 0;
  for (let j = Math.round(top / d.dy) - 1; j >= 0; j--) {
    if (d.rOut[j] < base - 2) step += d.dy;
    else break;
  }
  return {
    top,
    low: band(0, Math.max(d.dy, top - step - 1)),
    high: step ? band(top - step + 1, top) : { min: 0, max: 0 },
    step,
  };
}
export const karuselChecks = {
  priemer: (m) => [
    {
      key: 'dia',
      ok: Math.abs(m.info.low.min - 900) <= 0.5 && Math.abs(m.info.low.max - 900) <= 0.5,
      value: `Ø${m.info.low.min.toFixed(1)} – ${m.info.low.max.toFixed(1)}`,
    },
    { key: 'top', ok: Math.abs(m.info.top - 180) <= 0.5, value: `${m.info.top.toFixed(1)} mm` },
    { key: 'crash', ok: !m.crashes, value: String(m.crashes) },
  ],
  osadenie: (m) => [
    {
      key: 'dia',
      ok: m.info.step > 0 && Math.abs(m.info.high.max - 600) <= 1,
      value: `Ø${m.info.high.max.toFixed(1)}`,
    },
    { key: 'step', ok: Math.abs(m.info.step - 60) <= 1, value: `${m.info.step.toFixed(1)} mm` },
    { key: 'top', ok: m.info.top >= 199.5, value: `${m.info.top.toFixed(1)} mm` },
    { key: 'crash', ok: !m.crashes, value: String(m.crashes) },
  ],
};
