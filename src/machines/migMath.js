// Proces MIG/MAG bez three.js: synergická charakteristika zdroja, druh prenosu kovu, ochrana plynom.
// Orientačné hodnoty pre výučbu (oceľ G3Si1), testované v tests/mig.test.js.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const MIG_WIRES = [0.8, 1.0, 1.2];
// ochranné plyny: M21 = Ar + 18 % CO₂ (umožní sprchový prenos), C1 = čistý CO₂ (viac rozstreku, vyššie napätie)
export const MIG_GASES = {
  M21: { sk: 'Ar + 18 % CO₂ (M21)', en: 'Ar + 18 % CO₂ (M21)', spray: true, spat: 1, dU: 0 },
  C1: { sk: 'CO₂ (C1)', en: 'CO₂ (C1)', spray: false, spat: 1.8, dU: 1.5 },
};
// I = a · vd + b; tr = hranice prenosu skrat → prechodový → sprchový (A); max = rozumný horný prúd pre drôt
const SYN = {
  0.8: { a: 10, b: 15, tr: [135, 175], max: 200 },
  1: { a: 14, b: 25, tr: [165, 215], max: 300 },
  1.2: { a: 19, b: 35, tr: [195, 255], max: 400 },
};
export const MODE_NAMES = {
  short: ['skratový prenos', 'short arc'],
  globular: ['prechodový (kvapkový) prenos', 'globular transfer'],
  spray: ['sprchový prenos', 'spray arc'],
  pulse: ['impulzný prenos', 'pulsed arc'],
};

// wire = Ø drôtu (mm), vd = rýchlosť drôtu (m/min), prog = 'std' | 'pulse', gas = 'M21' | 'C1', corr = korekcia oblúka (V)
export function migSynergic({ wire, vd, prog, gas, corr = 0 }) {
  const s = SYN[wire] || SYN[1],
    g = MIG_GASES[gas] || MIG_GASES.M21;
  const I = clamp(s.a * vd + s.b, 3, 450); // TPS 450: 3 – 450 A
  const U0 = 13.5 + 0.055 * I + g.dU; // synergická krivka napätia
  const U = U0 + corr;
  let mode;
  if (prog === 'pulse') mode = 'pulse';
  else if (I < s.tr[0]) mode = 'short';
  else if (I < s.tr[1] || !g.spray) mode = 'globular';
  else mode = 'spray';
  const la = clamp(1.8 + corr * 0.9 + (mode === 'spray' || mode === 'pulse' ? 1.2 : 0), 0.4, 8); // dĺžka oblúka (mm)
  const spat = { short: 18, globular: 85, spray: 8, pulse: 5 }[mode] * g.spat * (corr > 2 ? 1.6 : corr < -2 ? 1.8 : 1);
  const dep = ((Math.PI * (wire / 2) ** 2 * vd * 1000) / 60) * 0.95; // nanesený kov (mm³/s)
  return { I, U, U0, mode, la, spat, dep, overload: I > s.max };
}

// odporúčaný prúd podľa hrúbky plechu (A)
export const migRange = (t) => {
  const lo = clamp(20 + 10 * t, 40, 220);
  return [lo, Math.round(lo * 2.4)];
}; // 2 mm: 40 – 96 A, 8 mm: 100 – 240 A
// dlhší výlet drôtu ho viac ohreje odporom – prúd klesá (pri rovnakej rýchlosti drôtu)
export const stickoutI = (I, ctwd) => I * clamp(1 - 0.012 * (ctwd - 12), 0.75, 1.1);
// kvalita plynovej ochrany 0 – 1 podľa ventilu fľaše, prietoku (l/min) a výletu drôtu (mm)
export function gasCover({ valve, flow, ctwd }) {
  if (!valve || flow < 3) return 0;
  let k = 1;
  if (flow < 8) k *= (flow - 3) / 5;
  if (flow > 22) k *= Math.max(0.4, 1 - (flow - 22) / 10); // turbulencia nasáva vzduch
  if (ctwd > 18) k *= Math.max(0.2, 1 - (ctwd - 18) / 8);
  return clamp(k, 0, 1);
}
