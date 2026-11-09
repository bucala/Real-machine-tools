// Bezhrotová brúska TOS Hostivař BBJ 6 bez three.js: priebežné brúsenie kolíkov medzi brúsnym a podávacím kotúčom.
// Rýchlosť prechodu v = π · dR · nR · sin α, priemer po prechode = nastavená medzera (najviac uber na prechod),
// guľatosť podľa výšky stredu obrobku nad spojnicou osí kotúčov. Dĺžky v mm, uhly v °.

export const BBJ = { dR: 250, speedsR: [20, 30, 45, 60], maxD: 63, maxCut: 0.1 };
// rýchlosť prechodu obrobku (mm/s)
export const throughFeed = (alphaDeg, nR, dR = BBJ.dR) =>
  Math.PI * dR * (nR / 60) * Math.sin((alphaDeg * Math.PI) / 180);
// odchýlka guľatosti (mm) podľa výšky h stredu nad spojnicou osí: na spojnici vzniká mnohohran (laloky)
export function roundness(h, d) {
  if (h <= 0) return 0.015;
  const opt = Math.min(15, d / 2);
  return Math.max(0.002, 0.015 * (1 - Math.min(1, h / opt)) + 0.002 * Math.max(0, h - 2 * opt));
}
// prechod kolíka: nový priemer a stav (ťažký úber, bez úberu)
export function grindPass(d, gap, h) {
  if (gap >= d) return { d, cut: 0, round: null, heavy: false };
  const cut = d - gap;
  return { d: gap + (cut > BBJ.maxCut + 1e-6 ? 0.004 : 0), cut, round: roundness(h, d), heavy: cut > BBJ.maxCut + 1e-6 };
}
export function pinsInfo(pins, target = 20, tol = 0.01) {
  const done = pins.filter((p) => p.passes > 0);
  const ok = done.filter((p) => Math.abs(p.d - target) <= tol && p.round <= 0.005 && !p.burn);
  return {
    n: done.length,
    ok: ok.length,
    last: done.slice(-5).map((p) => ({ d: p.d, round: p.round, burn: !!p.burn })),
  };
}
export const bbjChecks = {
  kolik: (m) => [
    { key: 'count', ok: m.info.ok >= 5, value: `${m.info.ok} / 5` },
    {
      key: 'round',
      ok: m.info.last.length > 0 && m.info.last.every((p) => p.round <= 0.005),
      value: m.info.last.length ? `${Math.max(...m.info.last.map((p) => p.round)).toFixed(3)} mm` : '—',
    },
    { key: 'burn', ok: !m.info.last.some((p) => p.burn), value: m.info.last.some((p) => p.burn) ? '✗' : '✓' },
  ],
};
