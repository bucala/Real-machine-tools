// Poloha stroja a obrobku počas pohybu a čas pohybu podľa posuvu a dynamiky osí (rýchloposuv 45 / 40 m/min,
// A 25 ot/min, C 30 ot/min). Testované v tests/cnc.test.js.
import { MACH, add, len, sub, toMach, toTable, toolAxisT } from './kin';
import { arcPoint } from './gcode';

export function poseAt(mv, u, o54, hA = MACH.hA) {
  const a = mv.a0 + (mv.a1 - mv.a0) * u,
    c = mv.c0 + (mv.c1 - mv.c0) * u;
  const q = mv.kind === 'arc' ? arcPoint(mv, u) : add(mv.q0, mul3(sub(mv.q1, mv.q0), u));
  const m = mv.space === 'mach' ? q : toMach(add(q, o54), a, c, hA);
  const pT = mv.space === 'mach' ? toTable(q, a, c, hA) : add(q, o54);
  return { m, a, c, pT, vT: toolAxisT(a, c) };
}
const mul3 = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
// čas pohybu v sekundách; L = dĺžka nástroja (čelo vretena je L nad špičkou)
export function moveTime(mv, o54, MC = MACH) {
  if (mv.kind === 'dwell') return mv.t || 0;
  if (mv.kind === 'tc') return MC.tc;
  if (mv.kind !== 'lin' && mv.kind !== 'arc') return 0;
  const N = mv.kind === 'arc' || mv.space === 'work' ? 24 : 1;
  let path = 0,
    ax = [0, 0, 0],
    prev = poseAt(mv, 0, o54, MC.hA);
  for (let i = 1; i <= N; i++) {
    const p = poseAt(mv, i / N, o54, MC.hA);
    path += len(sub(mv.space === 'work' ? p.pT : p.m, mv.space === 'work' ? prev.pT : prev.m));
    for (let k = 0; k < 3; k++) ax[k] += Math.abs(p.m[k] - prev.m[k]);
    prev = p;
  }
  const da = Math.abs(mv.a1 - mv.a0),
    dc = Math.abs(mv.c1 - mv.c0);
  const dyn = Math.max(
    ax[0] / (MC.rapid / 60),
    ax[1] / (MC.rapid / 60),
    ax[2] / (MC.rapidZ / 60),
    da / MC.vA,
    dc / MC.vC,
  );
  if (mv.rapid) return dyn + 0.02;
  const t = mv.inv ? 60 / (mv.F || 1) : path / ((mv.F || 1) / 60);
  return Math.max(t, dyn);
}
export const programTime = (moves, o54, MC = MACH) => moves.reduce((s, mv) => s + moveTime(mv, o54, MC), 0);
