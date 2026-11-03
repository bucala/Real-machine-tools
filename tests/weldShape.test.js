import { describe, expect, it } from 'vitest';
import { RES, W2, diffX, evalBead, makeShape, mapPoint, nearestOnPath, normalAt, posAllowed, unmapPoint, weldPrep, weldProfile, wrapX } from '../src/machines/weldShape';

const NZ = Math.round(2 * W2 / RES);
// výšková mapa z tvaru ako v simulátore (stĺpce i = 0 … NX, riadky j = 0 … NZ)
const field = (S) => {
  const NX = Math.round(S.L / RES), n = (NX + 1) * (NZ + 1), f = { NX, h: new Float32Array(n), h0: new Float32Array(n), dep: new Float32Array(n) };
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i, h = S.h0(i * RES - S.L / 2, j * RES - W2); f.h[k] = h; f.h0[k] = h; }
  return f;
};
const idx = (S, f, x, z) => { let i = Math.round((x + S.L / 2) / RES); if (S.R) i = ((i % f.NX) + f.NX) % f.NX; return Math.round((z + W2) / RES) * (f.NX + 1) + i; };
// nános pozdĺž krivky: húsenica šírky w (mm) a výšky a (mm) na podiele krivky part
const lay = (S, f, { part = 1, w = 6, a = 2, shift = 0 } = {}) => {
  const n = Math.round(S.path.length * part);
  for (let q = 0; q < n; q++) {
    const p = S.path[q];
    for (let u = -w / 2; u <= w / 2; u += RES / 2) { const k = idx(S, f, p.x - p.tz * (u + shift), p.z + p.tx * (u + shift)); if (f.dep[k] < a) { f.h[k] += a - f.dep[k]; f.dep[k] = a; } }
  }
};

// pôvodné hodnotenie priameho spoja (pred zovšeobecnením na krivky) – na porovnanie
const oldEval = (type, th, f) => {
  const prof = weldProfile(type, th, weldPrep(type, th)), NX = f.NX, idxOf = (i, j) => j * (NX + 1) + i;
  let wTop = 6; for (let z = 0; z <= W2; z += 0.5) { if (prof(z) >= th - 0.01 && prof(-z) >= th - 0.01) { wTop = z + 4; break; } }
  if (type === 'K') wTop = th / 2 + 10; if (type === 'L') wTop = 10; if (type === 'E') wTop = th + 5; if (type === 'N') wTop = W2;
  let covered = 0, grooveSum = 0, fillSum = 0, reinf = 0, widthSum = 0, depAll = 0, depTotal = 0;
  for (let k = 0; k < f.dep.length; k++) depTotal += f.dep[k] * RES;
  for (let i = 0; i <= NX; i++) {
    let dsum = 0, w = 0, top = 0;
    for (let j = Math.max(0, Math.round((W2 - wTop) / RES)); j <= Math.min(NZ, Math.round((W2 + wTop) / RES)); j++) {
      const k = idxOf(i, j), g = Math.max(0, th - f.h0[k]);
      if (type !== 'K' && type !== 'L' && type !== 'N') { grooveSum += g * RES; fillSum += Math.min(g, f.dep[k]) * RES; }
      dsum += f.dep[k] * RES; if (f.dep[k] > 0.2) w += RES;
      if (f.dep[k] > 0.1) top = Math.max(top, f.h[k] - (type === 'L' ? 2 * th : type === 'E' ? 3 * th : th));
    }
    depAll += dsum;
    if (dsum > 2) { covered++; widthSum += w; reinf += Math.max(0, top); }
  }
  return { cov: covered / (NX + 1), off: type === 'N' ? 0 : Math.max(0, 1 - depAll / depTotal), fill: grooveSum > 0 ? fillSum / grooveSum : null, width: covered ? widthSum / covered : 0, reinf: covered ? reinf / covered : 0 };
};

describe('pôvodné priame spoje', () => {
  for (const [type, th] of [['V', 8], ['I', 3], ['K', 8], ['L', 6], ['E', 2], ['N', 10], ['U', 16]]) {
    it(`${type} ${th} mm: tvar a hodnotenie sa zhodujú s pôvodným výpočtom`, () => {
      const S = makeShape(type, th, 150), f = field(S), prof = weldProfile(type, th, weldPrep(type, th));
      expect(S.path).toHaveLength(Math.round(150 / RES) + 1);
      for (const z of [-30, -3, -0.5, 0, 0.5, 3, 30]) expect(S.h0(12, z)).toBe(prof(z));
      lay(S, f, { part: 0.7, w: 7, a: th / 2 + 1, shift: 1 });
      const a = evalBead(S, f), b = oldEval(type, th, f);
      for (const key of ['cov', 'off', 'width', 'reinf']) expect(a[key]).toBeCloseTo(b[key], 6);
      if (b.fill == null) expect(a.fill).toBeNull(); else expect(a.fill).toBeCloseTo(b.fill, 6);
    });
  }
});

describe('rúra – rúra (rozvinutý plášť)', () => {
  const S = makeShape('RR', 4, 150, 60.3);
  it('obvod je násobok kroku siete, polomer zodpovedá Ø', () => {
    expect(S.L / RES).toBeCloseTo(Math.round(S.L / RES), 9);
    expect(S.R).toBeCloseTo(30.15, 1);
    expect(S.closed).toBe(true);
    expect(S.path).toHaveLength(Math.round(S.L / RES));
  });
  it('vrch rúry leží v počiatku, spodok R − t pod osou', () => {
    const top = mapPoint(S, 0, S.t, 5, []), bottom = mapPoint(S, S.L / 2, S.t, 0, []);
    expect(top[0]).toBeCloseTo(0, 9); expect(top[1]).toBeCloseTo(4, 9); expect(top[2]).toBe(5);
    expect(bottom[1]).toBeCloseTo(-2 * (S.R - S.t) - S.t, 6);           // celý priemer pod vrchom
  });
  it('prevod tam a späť a normála kolmá na plášť', () => {
    for (const x of [-80, -10, 0, 33, 90]) for (const y of [0, 4, 6.5]) {
      const p = mapPoint(S, x, y, 7, []), q = unmapPoint(S, p[0], p[1], p[2], []);
      expect(q[0]).toBeCloseTo(x, 6); expect(q[1]).toBeCloseTo(y, 6); expect(q[2]).toBeCloseTo(7, 9);
      const n = normalAt(S, x, []), c = [p[0], p[1] + S.R - S.t];       // normála smeruje od osi rúry
      expect(n[0] * c[1] - n[1] * c[0]).toBeCloseTo(0, 6);
    }
  });
  it('obvod sa uzatvára: posun cez spodok rúry', () => {
    expect(wrapX(S, S.L / 2 + 3)).toBeCloseTo(-S.L / 2 + 3, 9);
    expect(diffX(S, -S.L / 2 + 1, S.L / 2 - 1)).toBeCloseTo(2, 9);
  });
  it('húsenica po celom obvode = 100 %, cez spodok rúry sa počíta správne', () => {
    const f = field(S); lay(S, f, { part: 1, w: 8, a: 5 });
    const r = evalBead(S, f);
    expect(r.cov).toBe(1); expect(r.off).toBeCloseTo(0, 6); expect(r.fill).toBeGreaterThan(0.9);
    const g = field(S); lay(S, g, { part: 0.5, w: 8, a: 5 });
    expect(evalBead(S, g).cov).toBeCloseTo(0.5, 2);
  });
});

describe('polotovary na plechu a kolmé plechy', () => {
  it('rúra na plech: krivka je kružnica 1,5 mm od rúry, stena je vysoká, vnútri plech', () => {
    const S = makeShape('RP', 6, 150, 60.3);
    for (const p of S.path) { expect(Math.hypot(p.x, p.z)).toBeCloseTo(30.15 + 1.5, 6); expect(Math.hypot(p.tx, p.tz)).toBeCloseTo(1, 9); expect(p.x * p.tx + p.z * p.tz).toBeCloseTo(0, 6); }
    expect(S.h0(30.15 - S.wall / 2, 0)).toBeGreaterThan(50);
    expect(S.h0(0, 0)).toBe(6); expect(S.h0(45, 0)).toBe(6);
    expect(S.fillet).toBe(true); expect(S.closed).toBe(true);
  });
  it('jokel: obrys vo vzdialenosti 1,5 mm od steny, súvislý a uzavretý', () => {
    const S = makeShape('JK', 6, 150, 50);
    for (let q = 0; q < S.path.length; q++) {
      const p = S.path[q], n = S.path[(q + 1) % S.path.length];
      expect(Math.hypot(n.x - p.x, n.z - p.z)).toBeLessThan(RES * 1.2);
      expect(S.h0(p.x, p.z)).toBe(6);                                   // krivka leží na plechu, nie v stene
      expect(S.h0(p.x - p.tz * 2, p.z + p.tx * 2)).toBeGreaterThan(50);  // 2 mm dovnútra je stena jokla
    }
    expect(Math.max(...S.path.map((p) => Math.abs(p.x)))).toBeCloseTo(25 + 1.5, 6);
  });
  it('rohový vnútorný: stena na okraji, spoj v kúte, pás hodnotenia zasahuje stenu', () => {
    const S = makeShape('C', 8, 150);
    expect(S.h0(0, W2 - 2)).toBe(68); expect(S.h0(0, S.path[0].z)).toBe(8);
    expect(S.path[0].z).toBeCloseTo(W2 - 8 - 1.5, 9); expect(S.cz).toBe(S.path[0].z);
    const f = field(S); lay(S, f, { w: 8, a: 4, shift: -2 });
    expect(evalBead(S, f).cov).toBe(1);
  });
  it('rohový vonkajší: drážka V medzi hranami, plnenie sa počíta len v drážke', () => {
    const S = makeShape('O', 8, 150), d = 8 * Math.SQRT1_2;
    expect(S.h0(0, 0)).toBeLessThan(S.h0(0, d)); expect(S.h0(0, d - 0.01)).toBeCloseTo(S.h0(0, d), 1);
    expect(S.h0(0, 20)).toBeLessThan(S.h0(0, d));
    const f = field(S); lay(S, f, { w: 2 * d, a: d + 1 });
    expect(evalBead(S, f).fill).toBeGreaterThan(0.95);
  });
  it('tvarový rez: krivka ide stredom medzery', () => {
    const S = makeShape('TV', 3, 150);
    for (const p of S.path.filter((_, q) => q % 20 === 0)) expect(S.h0(p.x, p.z)).toBe(0);
    expect(Math.max(...S.path.map((p) => p.z))).toBeCloseTo(10, 1);
    const near = nearestOnPath(S, 25.2, 9); expect(near.x).toBeCloseTo(25, 0);
  });
});

describe('polohy podľa tvaru', () => {
  it('rúry majú rúrové polohy, pôvodné spoje všetky polohy plechov', () => {
    expect(posAllowed('RR')).toEqual(['PH', 'PJ', 'H-L045', 'PC']);
    expect(posAllowed('RP')).toContain('PB'); expect(posAllowed('RP')).not.toContain('PA');
    expect(posAllowed('V')).toHaveLength(7);
  });
});
