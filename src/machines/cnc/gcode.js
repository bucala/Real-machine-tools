// Interpreter CNC programov pre 5-osé centrum: ISO / Fanuc (aj výstupy CAM postprocesorov) a Heidenhain Klartext.
// Výstup je zoznam elementárnych pohybov s koncovými polohami v priestore stroja ('mach') alebo obrobku ('work').
// Priestor 'mach': lineárna interpolácia osí stroja (bez TCP). Priestor 'work': špička nástroja ide po priamke /
// kružnici v súradniciach obrobku (TCP, naklonená rovina). Bez korekcie dĺžky (G43) je naprogramovaný bod čelo
// vretena – špička je o dĺžku nástroja nižšie. Testované v tests/cnc.test.js.
import { MACH, add, axisToAC, cross, dot, eulerZXZ, len, matT, matVec, mul, norm, spatialABC, sub, toMach, toTable, toolAxisT } from './kin';
import { toolsFromComments } from './tooling';

const ROT = (p, n, deg) => {        // otočenie vektora p okolo jednotkovej osi n (Rodrigues)
  const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), k = dot(n, p), x = cross(n, p);
  return [p[0] * c + x[0] * s + n[0] * k * (1 - c), p[1] * c + x[1] * s + n[1] * k * (1 - c), p[2] * c + x[2] * s + n[2] * k * (1 - c)];
};
export const arcPoint = (mv, u) => add(add(mv.c, ROT(mv.r0, mv.n, mv.sweep * u)), mul(mv.n, mv.h * u));
const isHeid = (lines) => lines.some((s) => /^\s*(\d+\s+)?(BEGIN PGM|TOOL CALL|BLK FORM|CYCL DEF|PLANE\s+(SPATIAL|RESET)|L\s+[IXYZAC]?[+-]?\d|L\s+[XYZAC]|CC\s+[XYZ])/i.test(s));

// ctx = { o54: [x, y, z] nulový bod obrobku v ráme stola, tools: [...], startA, startC }
export function interpret(text, ctx) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const isH = isHeid(lines);
  const moves = [], errors = [], warns = [], comments = [];
  const o54 = ctx.o54 || [0, 0, 0], tools = ctx.tools || [], MC = ctx.mach || MACH, hA = MC.hA;
  const tool = (t) => tools.find((x) => x.t === t);
  const w0 = toMach(o54, 0, 0, hA);                                 // nulový bod obrobku v súradniciach stroja pri A = C = 0
  const NOSE_MAX = MC.nose[1];
  const st = {
    a: ctx.startA || 0, c: ctx.startC || 0, T: 0, pendT: null, H: 0, lenComp: false, tcp: false, frame: null,
    abs: true, plane: 17, mot: 0, F: 0, inv: false, perRev: false, S: 0, dir: 0, scale: 1, cyc: null, ret98: true, cc: null,
    feedMod: false, line: 0,
  };
  const Lact = () => (tool(st.T) ? tool(st.T).l : 0);
  const Lcomp = () => (st.lenComp ? (tool(st.H) ? tool(st.H).l : 0) : 0);
  let m = [0, MC.tcY, NOSE_MAX];                                     // poloha špičky v stroji (na začiatku bez nástroja = čelo hore vzadu)
  const err = (s) => errors.push({ line: st.line, text: s });
  const warn = (s) => { if (!warns.some((w) => w.text === s)) warns.push({ line: st.line, text: s }); };
  const space = () => (st.frame || st.tcp ? 'work' : 'mach');
  const axisW = (a = st.a, c = st.c) => toolAxisT(a, c);
  const dL = () => Lact() - Lcomp();                              // o koľko je špička nižšie ako naprogramovaný bod
  // naprogramovaný bod (v aktívnom ráme) → bod v priestore pohybu (špička)
  const toSpace = (p, a = st.a, c = st.c) => {
    if (st.frame) return sub(add(st.frame.O, matVec(st.frame.R, p)), mul(axisW(a, c), st.tcp ? 0 : dL()));
    if (st.tcp) return p;
    return sub(add(p, w0), [0, 0, dL()]);
  };
  const toWork = (mm, a, c) => sub(toTable(mm, a, c, hA), o54);
  // aktuálna poloha stroja → naprogramované súradnice aktívneho rámu (po zmene režimu)
  const fromMach = () => {
    if (st.frame) { const w = add(toWork(m, st.a, st.c), mul(axisW(), st.tcp ? 0 : dL())); return matVec(matT(st.frame.R), sub(w, st.frame.O)); }
    if (st.tcp) return toWork(m, st.a, st.c);
    return add(sub(m, w0), [0, 0, dL()]);
  };
  let pos = fromMach();
  const resync = () => { pos = fromMach(); };
  const machOf = (q, a, c, sp) => (sp === 'mach' ? q : toMach(add(q, o54), a, c, hA));
  const checkLim = (mm, a) => {
    const nose = mm[2] + Lact();
    if (mm[0] < MC.X[0] - 1e-6 || mm[0] > MC.X[1] + 1e-6) err(`os X mimo rozsahu (${mm[0].toFixed(1)} mm)`);
    if (mm[1] < MC.Y[0] - 1e-6 || mm[1] > MC.Y[1] + 1e-6) err(`os Y mimo rozsahu (${mm[1].toFixed(1)} mm)`);
    if (nose > MC.nose[1] + 1e-6 || nose < MC.nose[0] - 1e-6) err(`os Z mimo rozsahu (${(nose - NOSE_MAX).toFixed(1)} mm)`);
    if (a < MC.A[0] - 1e-6 || a > MC.A[1] + 1e-6) err(`os A mimo rozsahu ${MC.A[0]}…${MC.A[1]}° (${a.toFixed(1)}°)`);
  };
  const feed = () => ({ F: st.perRev ? st.F * st.S : st.F, inv: st.inv });
  const lin = (p1, a1, c1, rapid) => {
    const sp = space(), q0 = sp === 'mach' ? m : toWork(m, st.a, st.c), q1 = toSpace(p1, a1, c1);
    if (!rapid && !st.inv && !(feed().F > 0)) err('posuv F nie je zadaný');
    const mv = { kind: 'lin', rapid, space: sp, line: st.line, q0, q1, a0: st.a, a1, c0: st.c, c1, T: st.T, ...feed() };
    const m1 = machOf(q1, a1, c1, sp);
    if (len(sub(m1, m)) > 1e-7 || Math.abs(a1 - st.a) > 1e-9 || Math.abs(c1 - st.c) > 1e-9) moves.push(mv);
    m = m1; st.a = a1; st.c = c1; pos = p1; checkLim(m, a1);
  };
  const machRapid = (m1, a1 = st.a, c1 = st.c) => {      // pohyb osí stroja (G53, G28, M140, výmena nástroja)
    moves.push({ kind: 'lin', rapid: true, space: 'mach', line: st.line, q0: m, q1: m1, a0: st.a, a1, c0: st.c, c1, T: st.T, F: 0, inv: false });
    m = m1; st.a = a1; st.c = c1; resync(); checkLim(m, a1);
  };
  const planeAx = () => (st.plane === 17 ? [0, 1, 2] : st.plane === 18 ? [2, 0, 1] : [1, 2, 0]);
  const arc = (p1, ctr, cw) => {
    const [i, j, k] = planeAx(), p0 = pos;
    const r0p = [p0[i] - ctr[i], p0[j] - ctr[j]], r1p = [p1[i] - ctr[i], p1[j] - ctr[j]], r = Math.hypot(r0p[0], r0p[1]);
    if (r < 1e-6) { err('kruhový oblúk s nulovým polomerom'); return; }
    if (Math.abs(Math.hypot(r1p[0], r1p[1]) - r) > Math.max(0.01, r * 1e-3)) err('koncový bod oblúka nie je na kružnici');
    let sw = (Math.atan2(r1p[1], r1p[0]) - Math.atan2(r0p[1], r0p[0])) * 180 / Math.PI;
    if (cw) { while (sw >= -1e-9) sw -= 360; } else { while (sw <= 1e-9) sw += 360; }
    const full = Math.hypot(r1p[0] - r0p[0], r1p[1] - r0p[1]) < 1e-6;
    if (!full) { if (cw && sw < -360 + 1e-9) sw += 360; if (!cw && sw > 360 - 1e-9) sw -= 360; }
    const nP = [0, 0, 0]; nP[k] = 1;
    const cP = [...p0]; cP[i] = ctr[i]; cP[j] = ctr[j];
    const sp = space(), c = toSpace(cP), q0 = sp === 'mach' ? m : toWork(m, st.a, st.c), q1 = toSpace(p1);
    const n = st.frame ? norm(matVec(st.frame.R, nP)) : nP, h = dot(sub(q1, q0), n);
    const r0 = sub(sub(q0, c), mul(n, dot(sub(q0, c), n)));
    if (!(feed().F > 0) && !st.inv) err('posuv F nie je zadaný');
    moves.push({ kind: 'arc', rapid: false, space: sp, line: st.line, q0, q1, c, n, r0, sweep: sw, h, r, a0: st.a, a1: st.a, c0: st.c, c1: st.c, T: st.T, ...feed() });
    m = machOf(q1, st.a, st.c, sp); pos = p1; checkLim(m, st.a);
  };
  const toolChange = (t) => {
    if (!tool(t)) { err(`nástroj T${t} nie je v tabuľke nástrojov`); return; }
    if (st.dir) warn('pred výmenou nástroja zastav vreteno (M5) – riadenie ho zastaví samo');
    moves.push({ kind: 'tc', line: st.line, from: st.T, to: t, q0: m, a0: st.a, c0: st.c });
    st.T = t; st.dir = 0; m = [0, MC.tcY, NOSE_MAX - tool(t).l]; resync();
  };
  const setFrame = (O, R) => { st.frame = O ? { O, R } : null; resync(); };
  const orient = (move) => {              // natočenie A/C tak, aby os nástroja = os Z naklonenej roviny
    const v = st.frame ? matVec(st.frame.R, [0, 0, 1]) : [0, 0, 1];
    const s = axisToAC(v, st.c, MC.A);
    if (!s) { err(`naklonenú rovinu nedosiahne os A (${MC.A[0]}…${MC.A[1]}°)`); return; }
    if (move) machRapid(m, s.a, s.c); else { st.a = s.a; st.c = s.c; resync(); }
  };
  // vŕtacie cykly (v aktívnom ráme, os vŕtania = Z rámu)
  const drill = (x, y) => {
    const cy = st.cyc, zi = cy.zInit, R = cy.R, Z = cy.Z;
    lin([x, y, pos[2]], st.a, st.c, true);
    lin([x, y, R], st.a, st.c, true);
    const F0 = st.F; st.F = cy.F || st.F;
    if (cy.type === 81 || cy.type === 82 || !(cy.Q > 0)) lin([x, y, Z], st.a, st.c, false);
    else { let d = R; while (d > Z + 1e-6) { d = Math.max(Z, d - cy.Q); lin([x, y, d], st.a, st.c, false); if (d > Z + 1e-6) { lin([x, y, cy.type === 73 ? d + 0.5 : R], st.a, st.c, true); if (cy.type === 83) lin([x, y, Math.min(R, d + 1)], st.a, st.c, true); } } }
    if (cy.P > 0) moves.push({ kind: 'dwell', line: st.line, t: cy.P });
    st.F = F0;
    lin([x, y, st.ret98 ? zi : R], st.a, st.c, true);
  };
  const spin = () => moves.push({ kind: 'spin', line: st.line, S: st.S, dir: st.dir });
  const cool = (on) => moves.push({ kind: 'cool', line: st.line, on });

  // ---------------- ISO / Fanuc ----------------
  const iso = (raw) => {
    let s = raw.replace(/\(([^)]*)\)/g, (_, c) => { comments.push(c); return ' '; });
    const sc = s.indexOf(';'); if (sc >= 0) { comments.push(s.slice(sc + 1)); s = s.slice(0, sc); }
    s = s.trim().toUpperCase();
    if (!s || s === '%' || /^O\d+/.test(s)) return;
    if (/[#[\]]|\bIF\b|\bGOTO\b|\bWHILE\b/.test(s)) { err('premenné a skoky (makrá) nie sú podporované'); return; }
    if (/\bTRAORI\b/.test(s)) { st.tcp = true; resync(); return; }
    if (/\bTRAFOOF\b/.test(s)) { st.tcp = false; resync(); return; }
    if (/CYCLE800/.test(s)) { warn('CYCLE800 (Siemens) nie je podporovaný – použi G68.2 / G53.1 alebo TCP'); return; }
    const toks = s.match(/[A-Z][+-]?\d*\.?\d*/g) || [];
    const w = {}, gs = [], ms = [];
    toks.forEach((t) => { const L = t[0], v = parseFloat(t.slice(1)); if (L === 'G') gs.push(Math.round(v * 10) / 10); else if (L === 'M') ms.push(v); else if (!Number.isNaN(v)) w[L] = v; });
    const k = st.scale;
    let motion = null, g53 = false, g28 = false, g682 = false, g531 = false, cycleCall = false;
    gs.forEach((g) => {
      if ([0, 1, 2, 3].includes(g)) { st.mot = g; motion = g; st.cyc = null; }
      else if (g === 4) { moves.push({ kind: 'dwell', line: st.line, t: w.P != null ? w.P / 1000 : (w.X || 0) }); delete w.X; delete w.P; }
      else if (g === 17 || g === 18 || g === 19) st.plane = g;
      else if (g === 20) { st.scale = 25.4; warn('program v palcoch (G20) – prepočítané na mm'); }
      else if (g === 21) st.scale = 1;
      else if (g === 90) st.abs = true; else if (g === 91) st.abs = false;
      else if (g === 93) st.inv = true; else if (g === 94) { st.inv = false; st.perRev = false; } else if (g === 95) { st.inv = false; st.perRev = true; }
      else if (g === 54) { /* jediný nulový bod */ }
      else if (g >= 55 && g <= 59.9) warn(`G${g}: použije sa nulový bod G54 (stred hornej plochy polotovaru)`);
      else if (g === 43) { st.lenComp = true; st.H = w.H != null ? w.H : st.T; resync(); }
      else if (g === 43.4 || g === 43.5) { st.lenComp = true; st.H = w.H != null ? w.H : st.T; st.tcp = true; resync(); }
      else if (g === 49) { st.lenComp = false; st.tcp = false; resync(); }
      else if (g === 40 || g === 80 || g === 15 || g === 69 || g === 64 || g === 61 || g === 61.1 || g === 5.1 || g === 187 || g === 8) {
        if (g === 80) st.cyc = null;
        if (g === 69) setFrame(null);
      }
      else if (g === 41 || g === 42) warn('korekcia polomeru G41/G42 sa ignoruje – program musí mať dráhu stredu nástroja (CAM: kompenzácia „v počítači“)');
      else if (g === 53) g53 = true;
      else if (g === 28) g28 = true;
      else if (g === 68.2) g682 = true;
      else if (g === 53.1) g531 = true;
      else if (g === 98) st.ret98 = true; else if (g === 99) st.ret98 = false;
      else if ([73, 81, 82, 83].includes(g)) { st.cyc = { type: g, zInit: pos[2], R: 0, Z: 0, Q: 0, P: 0, F: 0 }; cycleCall = true; }
      else if (g === 10 || g === 52 || g === 92) warn(`G${g} sa ignoruje (posunutie súradníc)`);
      else warn(`G${g} nie je podporovaný`);
    });
    if (w.B != null) err('stroj nemá os B (len A a C)');
    if (w.F != null) st.F = w.F * (st.inv ? 1 : k);
    if (w.S != null) { st.S = w.S; if (st.dir) spin(); }
    if (w.T != null) st.pendT = w.T;
    if (ms.includes(6)) { toolChange(st.pendT != null ? st.pendT : w.T); st.pendT = null; }
    if (ms.includes(3)) { st.dir = 1; spin(); } if (ms.includes(4)) { st.dir = -1; spin(); }
    if (ms.includes(8) || ms.includes(7)) cool(true);
    if (g682) {
      const O = [(w.X || 0) * k, (w.Y || 0) * k, (w.Z || 0) * k];
      setFrame(O, eulerZXZ(w.I || 0, w.J || 0, w.K || 0)); return;
    }
    if (g531) { orient(true); return; }
    if (g53 || g28) {
      const t = [...m];
      if (g53) { if (w.X != null) t[0] = w.X * k; if (w.Y != null) t[1] = w.Y * k; if (w.Z != null) t[2] = NOSE_MAX + w.Z * k - Lact(); }
      else { if (w.Z != null) t[2] = NOSE_MAX - Lact(); if (w.X != null) t[0] = 0; if (w.Y != null) t[1] = 0; }
      machRapid(t, w.A != null ? w.A : st.a, w.C != null ? w.C : st.c);
    } else {
      const has = ['X', 'Y', 'Z', 'A', 'C'].some((L) => w[L] != null);
      const tgt = [...pos];
      ['X', 'Y', 'Z'].forEach((L, i) => { if (w[L] != null) tgt[i] = st.abs ? w[L] * k : pos[i] + w[L] * k; });
      const a1 = w.A != null ? (st.abs ? w.A : st.a + w.A) : st.a, c1 = w.C != null ? (st.abs ? w.C : st.c + w.C) : st.c;
      if (st.cyc && (cycleCall || has) && motion == null) {
        const cy = st.cyc;
        if (w.R != null) cy.R = w.R * k; if (w.Z != null) cy.Z = w.Z * k; if (w.Q != null) cy.Q = w.Q * k; if (w.P != null) cy.P = w.P / 1000; if (w.F != null) cy.F = w.F * k;
        if (cycleCall) cy.zInit = pos[2];
        drill(w.X != null ? tgt[0] : pos[0], w.Y != null ? tgt[1] : pos[1]);
      } else if (has || motion != null) {
        const mo = motion != null ? motion : st.mot;
        if (mo === 2 || mo === 3) {
          if (w.R != null) {
            const [i, j] = planeAx(), dx = tgt[i] - pos[i], dy = tgt[j] - pos[j], d = Math.hypot(dx, dy), R = Math.abs(w.R * k);
            if (d > 2 * R + 1e-6) err('polomer oblúka R je menší ako polovica tetivy');
            const hh = Math.sqrt(Math.max(0, R * R - d * d / 4)), sgn = (mo === 2 ? -1 : 1) * (w.R < 0 ? -1 : 1);
            const ctr = [...pos]; ctr[i] = pos[i] + dx / 2 - sgn * hh * dy / (d || 1); ctr[j] = pos[j] + dy / 2 + sgn * hh * dx / (d || 1);
            arc(tgt, ctr, mo === 2);
          } else {
            const ctr = [pos[0] + (w.I || 0) * k, pos[1] + (w.J || 0) * k, pos[2] + (w.K || 0) * k];
            arc(tgt, ctr, mo === 2);
          }
        } else if (mo === 0 || mo === 1) lin(tgt, a1, c1, mo === 0);
        else if (has) lin(tgt, a1, c1, false);
      }
    }
    if (ms.includes(5)) { st.dir = 0; spin(); }
    if (ms.includes(9)) cool(false);
    if (ms.includes(0) || ms.includes(1)) moves.push({ kind: 'stop', line: st.line, opt: ms.includes(1) });
    if (ms.includes(30) || ms.includes(2)) moves.push({ kind: 'end', line: st.line });
  };

  // ---------------- Heidenhain Klartext ----------------
  let cyc200 = null, blk = { min: null, max: null }, pendingCyc = null;
  const num = (s, key) => { const mm = s.match(new RegExp(`(?:^|\\s)(I?)${key}([+-]?\\d*\\.?\\d+)`)); return mm ? { inc: !!mm[1], v: parseFloat(mm[2]) } : null; };
  const heidMs = (s) => (s.match(/\bM(\d+)/g) || []).map((x) => Number(x.slice(1)));
  const heidXYZ = (s) => {
    const tgt = [...pos];
    ['X', 'Y', 'Z'].forEach((L, i) => { const v = num(s, L); if (v) tgt[i] = v.inc ? pos[i] + v.v : v.v; });
    const A = num(s, 'A'), C = num(s, 'C');
    return { tgt, a1: A ? (A.inc ? st.a + A.v : A.v) : st.a, c1: C ? (C.inc ? st.c + C.v : C.v) : st.c, has: ['X', 'Y', 'Z', 'A', 'C'].some((L) => num(s, L)) };
  };
  const runCyc200 = () => {
    if (!cyc200) { err('CYCL CALL bez definície cyklu'); return; }
    const q = cyc200, zs = q[203] || 0, safe = zs + (q[200] || 2), bot = zs + (q[201] || -5), top = zs + Math.max(q[204] || 50, q[200] || 2), x = pos[0], y = pos[1];
    lin([x, y, Math.max(pos[2], safe)], st.a, st.c, true); lin([x, y, safe], st.a, st.c, true);
    const F0 = st.F; st.F = q[206] || st.F;
    let d = safe; const pl = Math.abs(q[202] || 0) || Math.abs(bot - safe);
    while (d > bot + 1e-6) { d = Math.max(bot, d - pl); lin([x, y, d], st.a, st.c, false); if (d > bot + 1e-6) lin([x, y, safe], st.a, st.c, true), lin([x, y, Math.min(safe, d + 0.5)], st.a, st.c, true); }
    if (q[211] > 0) moves.push({ kind: 'dwell', line: st.line, t: q[211] });
    st.F = F0; lin([x, y, top], st.a, st.c, true);
  };
  const heid = (raw) => {
    let s = raw; const sc = s.indexOf(';'); if (sc >= 0) { comments.push(s.slice(sc + 1)); s = s.slice(0, sc); }
    s = s.replace(/^\s*\d+\s*/, '').trim();
    if (!s) return;
    if (s.startsWith('*')) { comments.push(s.slice(1)); return; }
    const S = s.toUpperCase();
    if (/^BEGIN PGM/.test(S)) return;
    if (/^END PGM/.test(S)) { moves.push({ kind: 'end', line: st.line }); return; }
    if (/^BLK FORM 0\.1/.test(S)) { blk.min = ['X', 'Y', 'Z'].map((L) => (num(S, L) || { v: 0 }).v); return; }
    if (/^BLK FORM 0\.2/.test(S)) { blk.max = ['X', 'Y', 'Z'].map((L) => (num(S, L) || { v: 0 }).v); return; }
    if (/^Q(\d+)\s*=\s*([+-]?\d*\.?\d+)/.test(S) && pendingCyc) { const mm = S.match(/^Q(\d+)\s*=\s*([+-]?\d*\.?\d+)/); pendingCyc[Number(mm[1])] = parseFloat(mm[2]); return; }
    if (/^CYCL DEF\s+200\b/.test(S)) { cyc200 = {}; pendingCyc = cyc200; return; }
    if (/^CYCL DEF/.test(S)) { pendingCyc = {}; if (!/CYCL DEF\s+(32|7|19|247)\b/.test(S)) warn(`${S.slice(0, 16)} – cyklus nie je podporovaný`); return; }
    pendingCyc = null;
    if (/^CYCL CALL/.test(S)) { runCyc200(); return; }
    if (/^TOOL DEF/.test(S)) return;
    if (/^TOOL CALL/.test(S)) {
      const mm = S.match(/^TOOL CALL\s+(\d+)/), nm = s.match(/TOOL CALL\s+"([^"]+)"/i);
      let t = mm ? Number(mm[1]) : null;
      if (t == null && nm) { const f = tools.find((x) => x.name && x.name.toUpperCase() === nm[1].toUpperCase()); t = f ? f.t : null; if (t == null) err(`nástroj „${nm[1]}“ nie je v tabuľke`); }
      if (t != null && t !== st.T) toolChange(t); else if (t != null) resync();
      st.lenComp = true; st.H = st.T; resync();
      const sv = S.match(/\bS(\d+\.?\d*)/); if (sv) st.S = parseFloat(sv[1]);
      const fv = S.match(/\bF(\d+\.?\d*)/); if (fv) st.F = parseFloat(fv[1]);
      return;
    }
    if (/^FUNCTION TCPM/.test(S)) { st.tcp = true; resync(); return; }
    if (/^FUNCTION RESET TCPM/.test(S)) { st.tcp = false; resync(); return; }
    const mbMax = () => { if (/MB\s*MAX/.test(S)) machRapid([m[0], m[1], NOSE_MAX - Lact()]); };
    if (/^PLANE RESET/.test(S)) { setFrame(null); if (!/STAY/.test(S)) { mbMax(); machRapid(m, 0, st.c); } return; }
    if (/^PLANE SPATIAL/.test(S)) {
      const g = (k2) => { const mm = S.match(new RegExp(`${k2}([+-]?\\d*\\.?\\d+)`)); return mm ? parseFloat(mm[1]) : 0; };
      setFrame([0, 0, 0], spatialABC(g('SPA'), g('SPB'), g('SPC')));
      if (/STAY/.test(S)) warn('PLANE … STAY: os A a C natoč blokom L A… C…'); else { mbMax(); orient(true); }
      return;
    }
    if (/^PLANE/.test(S)) { err('podporované sú len PLANE SPATIAL a PLANE RESET'); return; }
    if (/^STOP/.test(S)) { moves.push({ kind: 'stop', line: st.line, opt: false }); return; }
    if (/^CC\b/.test(S)) {
      const c = [...pos]; ['X', 'Y', 'Z'].forEach((L, i) => { const v = num(S, L); if (v) c[i] = v.inc ? pos[i] + v.v : v.v; });
      st.cc = c; return;
    }
    const msAll = heidMs(S);
    const pre = () => {
      if (msAll.includes(3)) { st.dir = 1; spin(); } if (msAll.includes(4)) { st.dir = -1; spin(); }
      if (msAll.includes(8)) cool(true);
      if (msAll.includes(128)) { st.tcp = true; resync(); } if (msAll.includes(129)) { st.tcp = false; resync(); }
    };
    const post = () => {
      if (msAll.includes(140)) machRapid([m[0], m[1], NOSE_MAX - Lact()]);
      if (msAll.includes(99)) runCyc200();
      if (msAll.includes(5)) { st.dir = 0; spin(); } if (msAll.includes(9)) cool(false);
      if (msAll.includes(0) || msAll.includes(1)) moves.push({ kind: 'stop', line: st.line, opt: msAll.includes(1) });
      if (msAll.includes(30) || msAll.includes(2)) moves.push({ kind: 'end', line: st.line });
    };
    const fm = S.match(/\bF(MAX|AUTO|\d+\.?\d*)/);
    const rapid = fm && fm[1] === 'MAX';
    if (fm && fm[1] !== 'MAX' && fm[1] !== 'AUTO') st.F = parseFloat(fm[1]);
    if (/\bR[LR]\b/.test(S)) warn('korekcia polomeru RL/RR sa ignoruje – program musí mať dráhu stredu nástroja (R0)');
    if (/^L\b/.test(S)) {
      if (/\bB[+-]?\d/.test(S)) err('stroj nemá os B (len A a C)');
      pre(); const { tgt, a1, c1, has } = heidXYZ(S); if (has) lin(tgt, a1, c1, rapid); post(); return;
    }
    if (/^C\b/.test(S) || /^CR\b/.test(S)) {
      pre();
      const { tgt } = heidXYZ(S), cw = /DR-/.test(S);
      if (/^CR\b/.test(S)) {
        const R = (num(S, 'R') || { v: 0 }).v, [i, j] = planeAx(), dx = tgt[i] - pos[i], dy = tgt[j] - pos[j], d = Math.hypot(dx, dy), Ra = Math.abs(R);
        if (d > 2 * Ra + 1e-6) err('polomer CR je menší ako polovica tetivy');
        const hh = Math.sqrt(Math.max(0, Ra * Ra - d * d / 4)), sgn = (cw ? -1 : 1) * (R < 0 ? -1 : 1);
        const ctr = [...pos]; ctr[i] = pos[i] + dx / 2 - sgn * hh * dy / (d || 1); ctr[j] = pos[j] + dy / 2 + sgn * hh * dx / (d || 1);
        arc(tgt, ctr, cw);
      } else { if (!st.cc) err('kruhový pohyb C bez stredu CC'); else arc(tgt, st.cc, cw); }
      post(); return;
    }
    if (/^CT\b/.test(S)) { warn('CT (tangenciálny oblúk) sa nahrádza priamkou'); pre(); const { tgt, a1, c1 } = heidXYZ(S); lin(tgt, a1, c1, false); post(); return; }
    if (/^(LBL|CALL LBL|FN|Q\d|FUNCTION|DECLARE|SEL|M\d)/.test(S)) {
      if (/^M\d/.test(S)) { pre(); post(); return; }
      err(`${S.split(/\s/)[0]} (podprogramy / parametre) nie je podporované`); return;
    }
    warn(`neznámy blok: ${S.slice(0, 24)}`);
  };

  lines.forEach((raw, idx) => { st.line = idx; try { (isH ? heid : iso)(raw); } catch (e) { err(String(e && e.message ? e.message : e)); } });
  const stock = blk.min && blk.max ? { min: blk.min, max: blk.max } : null;
  return { moves, errors, warns, dialect: isH ? 'heidenhain' : 'iso', lines, stock, toolDefs: toolsFromComments(comments) };
}
