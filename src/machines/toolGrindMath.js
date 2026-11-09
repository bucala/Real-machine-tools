// Brúsenie sústružníckeho noža (nástrojárska brúska TOS BN 102, dvojkotúčová brúska TOS BBT 350) bez three.js.
// Prierez noža v rovine (u pozdĺž noža k špičke, v nahor) je konvexný mnohouholník – každé brúsenie ho oreže polrovinou
// (čelo kotúča). Uhol chrbta α = sklon čelnej plochy od zvislice, uhol čela γ = sklon hornej plochy od vodorovnej.
// Dĺžky v mm, uhly v stupňoch.

export const TOOL = { L: 100, H: 16 };
export const toolPoly = (L = TOOL.L, H = TOOL.H) => [
  [0, 0],
  [L, 0],
  [L, H],
  [0, H],
];
// polrovina a·u + b·v ≤ c (Sutherland–Hodgman pre konvexný mnohouholník); vráti nový mnohouholník a odobratú plochu
export function clipPoly(poly, a, b, c) {
  const out = [],
    inside = (p) => a * p[0] + b * p[1] <= c + 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      pi = inside(p),
      qi = inside(q);
    if (pi) out.push(p);
    if (pi !== qi) {
      const dp = a * p[0] + b * p[1] - c,
        dq = a * q[0] + b * q[1] - c,
        t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return { poly: out, removed: area(poly) - area(out) };
}
export const area = (poly) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i],
      [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
};
// rovina kotúča (svet x = X) pri natočení noža o φ (svet = Rz(φ)·lokál + o): u·cos φ − v·sin φ ≤ X − ox
export const grindPlane = (phiDeg, X, ox) => {
  const f = (phiDeg * Math.PI) / 180;
  return [Math.cos(f), -Math.sin(f), X - ox];
};
// rozbor mnohouholníka: uhol chrbta (čelná plocha), uhol čela (horná plocha), zbrúsená výška čela
export function toolAngles(poly, L = TOOL.L, H = TOOL.H) {
  let alpha = null,
    gamma = null,
    endLen = 0,
    topLen = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      du = q[0] - p[0],
      dv = q[1] - p[1],
      len = Math.hypot(du, dv);
    if (len < 0.05) continue;
    // vonkajšia normála (mnohouholník proti smeru hodín): (dv, −du)
    const nu = dv / len,
      nv = -du / len;
    const orig =
      (Math.abs(du) < 1e-6 && Math.abs(p[0] - L) < 1e-6) || (Math.abs(dv) < 1e-6 && Math.abs(p[1] - H) < 1e-6);
    if (nu > 0.7 && !orig) {
      alpha = (Math.atan2(-nv, nu) * 180) / Math.PI; // čelná plocha ustupuje smerom dole
      endLen = Math.max(endLen, Math.abs(dv));
    }
    if (nv > 0.7 && !orig) {
      gamma = (Math.atan2(nu, nv) * 180) / Math.PI;
      topLen = Math.max(topLen, Math.abs(du));
    }
  }
  return { alpha, gamma, endLen, topLen };
}
export const grindChecksTool = {
  chrbat: (m) => [
    {
      key: 'alpha',
      ok: m.ang.alpha !== null && Math.abs(m.ang.alpha - 8) <= 0.5,
      value: m.ang.alpha === null ? '—' : `${m.ang.alpha.toFixed(1)}°`,
    },
    { key: 'face', ok: m.ang.endLen >= 0.9 * TOOL.H, value: `${m.ang.endLen.toFixed(1)} mm` },
    { key: 'burn', ok: !m.burn, value: m.burn ? '✗' : '✓' },
  ],
  celo: (m) => [
    {
      key: 'gamma',
      ok: m.ang.gamma !== null && Math.abs(m.ang.gamma - 12) <= 0.5,
      value: m.ang.gamma === null ? '—' : `${m.ang.gamma.toFixed(1)}°`,
    },
    { key: 'face', ok: m.ang.topLen >= 5, value: `${m.ang.topLen.toFixed(1)} mm` },
    { key: 'burn', ok: !m.burn, value: m.burn ? '✗' : '✓' },
  ],
};
