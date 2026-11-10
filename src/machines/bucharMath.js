// Kovací buchar Šmeral KHZ 2 bez three.js: ohrev v peci, chladnutie na vzduchu, úder baranom (energia podľa zdvihu),
// pretváranie hranola medzi plochými kovadlami so zachovaním objemu a rozšírením. Dĺžky v mm, teplota v °C.

// 20 kJ, baran 920 kg, zdvih 400 mm, 60 úderov/min (inzerát exapro – Šmeral KHZ 2)
export const KHZ = { E: 20000, ram: 920, stroke: 400, bpm: 60, eta: 0.35, levels: [0.05, 0.1, 0.25, 0.5, 1] };
export const FORGE = { hot: 1200, cold: 850, crack: 750, burn: 1280, spread: 0.3 };
// pretvárny odpor ocele (MPa) – rastie s klesajúcou teplotou
export const flowStress = (T) => 45 * Math.exp((1200 - Math.min(1250, T)) / 260);
// chladnutie na vzduchu / ohrev v peci (exponenciálne k okoliu); tenší prierez sa mení rýchlejšie
export const cool = (T, dt, thin) => 20 + (T - 20) * Math.exp((-0.33 / thin) * dt);
export const heat = (T, dt, thin, Tf) => Tf + (T - Tf) * Math.exp((-5.4 / thin) * dt);
// úder: práca η·E·podiel rozdelená na pretvorenie objemu V – logaritmické stlačenie výšky; šírka sa rozšíri, dĺžka dopočíta
export function blow(b, level, T) {
  const V = b.h * b.w * b.L,
    W = KHZ.eta * KHZ.E * KHZ.levels[level] * 1000, // N·mm
    d = Math.min(0.6, W / (flowStress(T) * V));
  const h = b.h * Math.exp(-d),
    w = b.w * Math.exp(d * FORGE.spread);
  return { h, w, L: V / (h * w), d };
}
// otočenie hranola o 90° okolo dlhej osi: výška a šírka sa vymenia
export const turn = (b) => ({ ...b, h: b.w, w: b.h });
export const blank = () => ({ h: 60, w: 60, L: 120 });

const TASKS = {
  plochy: { h: 40, w: 60, th: 1, tw: 3 },
  stvorec: { h: 40, w: 40, th: 1, tw: 1 },
};
export const bucharTask = (id) => TASKS[id];
// kontrola: rozmery, žiadne údery za studena, žiadna trhlina, nespálený materiál
export const bucharChecks = Object.fromEntries(
  Object.entries(TASKS).map(([id, t]) => [
    id,
    (m) => [
      { key: 'h', ok: Math.abs(m.b.h - t.h) <= t.th, value: `${m.b.h.toFixed(1)} mm` },
      { key: 'w', ok: Math.abs(m.b.w - t.w) <= t.tw, value: `${m.b.w.toFixed(1)} mm` },
      { key: 'cold', ok: !m.cold, value: String(m.cold) },
      { key: 'crack', ok: !m.crack, value: m.crack ? '✗' : '✓' },
      { key: 'burn', ok: !m.burnt, value: m.burnt ? '✗' : '✓' },
    ],
  ]),
);
