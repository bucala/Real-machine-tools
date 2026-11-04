// Vykonávanie CNC programu: postup po pohyboch v čase simulácie, úber materiálu voxelovým poľom, kontroly
// (koncové spínače, rýchloposuv do materiálu, stojace vreteno, kolízia drieku / držiaka, náraz do stola a upínača,
// preťaženie vretena), úberová rýchlosť a zaťaženie vretena. Bez three.js – testované v tests/cnc.test.js.
import { MACH, add, len, mul, sub, toTable, toolAxisT } from './kin';
import { moveTime, poseAt } from './motion';

export function createExecutor({ moves, tools, o54, stock, fixture = { r: 45, h: 50 }, kc = 800, mach = MACH }) {
  const MC = mach, hA = MC.hA;
  const tool = (t) => tools.find((x) => x.t === t);
  const NOSE_MAX = MC.nose[1];
  const S = { idx: 0, tau: 0, dur: -1, T: 0, spin: 0, dir: 0, cool: false, alarm: null, done: false, paused: false, line: 0, t: 0, cutT: 0,
    pose: { m: [0, MC.tcY, NOSE_MAX], a: 0, c: 0, pT: toTable([0, MC.tcY, NOSE_MAX], 0, 0, hA), vT: [0, 0, 1] }, nose: NOSE_MAX, tcPhase: 0,
    win: [], mrr: 0, power: 0, removed: 0, cutting: false };
  const alarm = (text, kind = 'crash') => { if (!S.alarm) S.alarm = { text, kind, line: S.line }; };
  const L = () => (tool(S.T) ? tool(S.T).l : 0);
  // kontroly jednej polohy a úber
  let sinceCheck = 0;
  const stamp = (p, rapid, ds) => {
    const t = tool(S.T), nose = p.m[2] + L();
    if (p.m[0] < MC.X[0] - 0.01 || p.m[0] > MC.X[1] + 0.01) { alarm(`Softvérový koncový spínač X (${p.m[0].toFixed(1)} mm)`, 'limit'); return 0; }
    if (p.m[1] < MC.Y[0] - 0.01 || p.m[1] > MC.Y[1] + 0.01) { alarm(`Softvérový koncový spínač Y (${p.m[1].toFixed(1)} mm)`, 'limit'); return 0; }
    if (nose < MC.nose[0] - 0.01 || nose > MC.nose[1] + 0.01) { alarm(`Softvérový koncový spínač Z (${(nose - NOSE_MAX).toFixed(1)} mm)`, 'limit'); return 0; }
    if (p.a < MC.A[0] - 0.01 || p.a > MC.A[1] + 0.01) { alarm(`Softvérový koncový spínač A (${p.a.toFixed(1)}°)`, 'limit'); return 0; }
    if (!t) return 0;
    // stôl a upínač (rám stola): špička a spodok držiaka
    const pts = [p.pT, add(p.pT, mul(p.vT, t.s))];
    for (const q of pts) {
      if (q[2] < 0.3 && Math.hypot(q[0], q[1]) < (MC.table || 650) / 2) { alarm('Kolízia: nástroj narazil do stola'); return 0; }
      if (q[2] < fixture.h - 0.3 && q[2] > 0 && Math.hypot(q[0], q[1]) < fixture.r) { alarm('Kolízia: nástroj narazil do upínača'); return 0; }
    }
    const r = stock.cut(p.pT, p.vT, t);
    sinceCheck += ds;
    if (r.n > 0) {
      // do 2 voxelov za krok = zaokrúhlenie siete (napr. návrat vrtáka nad dno diery), nie kolízia
      if (rapid && r.n > 2) { alarm('Kolízia: rýchloposuv (G0) do materiálu'); return r.ops; }
      if ((!S.dir || S.spin < 1) && r.n > 2) { alarm('Kolízia: nástroj vošiel do materiálu so stojacim vretenom'); return r.ops; }
      S.removed += r.n * stock.vox; S.cutting = true;
    }
    if (sinceCheck > 1 || (r.n > 0 && sinceCheck > 0.4)) {
      sinceCheck = 0;
      const shank = Math.min(t.d, 20) / 2 * 0.98;
      if (t.s > t.lc + 0.5 && stock.hits(p.pT, p.vT, shank, t.lc + 0.5, t.s) > 4) alarm('Kolízia: driek nástroja nad reznou časťou sa dotkol materiálu (vyloženie / dĺžka reznej časti)');
      else if (stock.hits(p.pT, p.vT, t.dh / 2, t.s, t.s + 70) > 0) alarm('Kolízia: držiak nástroja narazil do obrobku');
    }
    return r.ops;
  };
  const toolChangePose = (u, mv) => {
    // Retract before traversing; deposit, index while empty, pick up, retract.
    const oldL = tool(mv.from)?.l || 0, newL = tool(mv.to)?.l || 0;
    const seat = NOSE_MAX - 80, safe = NOSE_MAX;
    const startNose = mv.q0[2] + oldL;
    let nose, x, y;
    if (u < .18) { const k = u / .18; nose = startNose + (safe - startNose) * k; x = mv.q0[0]; y = mv.q0[1]; }
    else if (u < .3) { const k = (u - .18) / .12; nose = safe; x = mv.q0[0] * (1 - k); y = mv.q0[1] + (MC.tcY - mv.q0[1]) * k; }
    else { x = 0; y = MC.tcY; nose = u < .4 ? safe - (safe - seat) * (u - .3) / .1 : u < .7 ? seat : seat + (safe - seat) * Math.min(1, (u - .7) / .3); }
    const length = u < .4 ? oldL : u < .7 ? 0 : newL;
    const m = [x, y, nose - length];
    return { m, a: mv.a0, c: mv.c0, pT: toTable(m, mv.a0, mv.c0, hA), vT: toolAxisT(mv.a0, mv.c0) };
  };
  const step = 0.4 * stock.res;
  // posun o dt sekúnd simulácie; fo / ro = korekcia posuvu / rýchloposuvu; budget = najviac výpočtov voxelov
  const advance = (dt, { fo = 1, ro = 1, single = false, budget = 3e6 } = {}) => {
    let ops = 0; S.cutting = false;
    const t0 = S.t;
    while (dt > 1e-9 && !S.alarm && !S.done && !S.paused && ops < budget) {
      const mv = moves[S.idx];
      if (!mv) { S.done = true; break; }
      S.line = mv.line;
      if (mv.kind === 'spin') { S.spin = mv.S; S.dir = mv.dir; if (mv.dir && mv.S > MC.smax) alarm(`Otáčky S${mv.S} sú nad maximom vretena ${MC.smax} ot/min`, 'limit'); S.idx++; continue; }
      if (mv.kind === 'cool') { S.cool = mv.on; S.idx++; continue; }
      if (mv.kind === 'stop') { S.idx++; if (!mv.opt) S.paused = true; continue; }
      if (mv.kind === 'end') { S.done = true; S.dir = 0; S.cool = false; break; }
      if (S.dur < 0) { S.dur = Math.max(1e-6, moveTime(mv, o54, MC)); S.tau = 0; }
      const k = mv.kind === 'tc' || mv.kind === 'dwell' ? 1 : mv.rapid ? ro : fo;
      if (k <= 0) break;
      const left = (S.dur - S.tau) / k, use = Math.min(dt, left);
      const u0 = S.tau / S.dur, u1 = Math.min(1, (S.tau + use * k) / S.dur);
      if (mv.kind === 'tc') {
        S.tcPhase = u1; S.dir = 0;
        S.T = u1 < .4 ? mv.from : u1 < .7 ? 0 : mv.to;
        S.pose = toolChangePose(u1, mv);
      } else if (mv.kind === 'dwell') { /* stojí */ } else {
        const pa = poseAt(mv, u0, o54, hA), pb = poseAt(mv, u1, o54, hA), t = tool(S.T), lc = t ? t.lc : 0;
        const d = Math.max(len(sub(pb.pT, pa.pT)), len(sub(add(pb.pT, mul(pb.vT, lc)), add(pa.pT, mul(pa.vT, lc)))));
        const n = Math.max(1, Math.ceil(d / step));
        let uDone = u0;
        for (let i = 1; i <= n; i++) {
          const u = u0 + (u1 - u0) * i / n, p = poseAt(mv, u, o54, hA);
          ops += stamp(p, mv.rapid, d / n); S.pose = p; uDone = u;
          if (S.alarm) break;
          if (ops >= budget && i < n) break;
        }
        if (uDone < u1) { const spent = (uDone - u0) * S.dur / k; S.tau += spent * k; dt -= spent; S.t += spent; break; }
      }
      S.tau += use * k; dt -= use; S.t += use;
      if (S.tau >= S.dur - 1e-9) { S.idx++; S.dur = -1; S.tau = 0; if (single && mv.kind !== 'tc') S.paused = true; }
    }
    // úberová rýchlosť a výkon za posledných 0,5 s
    const dts = S.t - t0;
    if (dts > 0) { S.win.push([S.t, S.removed]); while (S.win.length > 2 && S.t - S.win[0][0] > 0.5) S.win.shift(); }
    if (S.win.length > 1) {
      const [ta, va] = S.win[0], [tb, vb] = S.win[S.win.length - 1];
      S.mrr = tb > ta ? (vb - va) / (tb - ta) : 0;                       // mm³/s
      S.power = S.mrr * kc / 1e6;                                       // kW
      const pmax = Math.min(MC.pmax, MC.mmax * 2 * Math.PI * Math.max(S.spin, 1) / 60 / 1000);
      if (S.power > pmax * 1.15 && S.dir) alarm(`Preťaženie vretena: ${S.power.toFixed(1)} kW pri ${S.spin} ot/min (max. ${pmax.toFixed(1)} kW) – zníž posuv alebo záber`, 'load');
      S.load = pmax > 0 ? S.power / pmax : 0;
    }
    S.nose = S.pose.m[2] + L();
    return ops;
  };
  return { S, advance, tool };
}
