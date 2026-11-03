import { describe, expect, it } from 'vitest';
import { SL_K, SLOTTER_TOOLS, createRing, toolRect as tRect, keywayInfo, ringCut, slotterChecks, squareInfo } from '../src/machines/slotterMath';
import { crankR, ramPos } from '../src/machines/shaperMath';

const hub = () => createRing({ rIn: 0.2, rOut: 0.5, H: 0.5, NT: 720 });
// drážkovací nôž šírky w (mm): obdĺžnik s ostrím v x = tip (jednotky scény), telo 12 mm dozadu
const toolRect = (tip, w, z = 0) => tRect({ w, b: 12 }, tip, z);

describe('kulisa zvislej obrážačky', () => {
  it('zdvih zodpovedá polomeru čapu aj s inými rozmermi kulisy', () => {
    const r = crankR(3.5, SL_K); let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 3600; k++) { const { x } = ramPos(k / 3600 * 2 * Math.PI, r, SL_K); lo = Math.min(lo, x); hi = Math.max(hi, x); }
    expect(hi - lo).toBeCloseTo(3.5, 3);
  });
});

describe('rez v náboji', () => {
  it('nôž v otvore bez dotyku nereže, pri dotyku zväčší otvor len v šírke noža', () => {
    const g = hub();
    expect(ringCut(g, 0, ...toolRect(0.15, 12)).pen).toBe(0);
    // prvý dotyk: roh ostria (x = tip, z = 6 mm) sa dotkne otvoru Ø40 pri tip = √(0,2² − 0,06²) ≈ 0,1908
    expect(ringCut(g, 0, ...toolRect(0.19, 12)).pen).toBe(0);
    const r = ringCut(g, 0, ...toolRect(0.195, 12), true);
    expect(r.pen).toBeGreaterThan(0); expect(r.pen).toBeLessThan(0.005); expect(r.embedded).toBe(false);
    expect(keywayInfo(g).runs).toBe(2);   // najprv sa dotknú oba rohy ostria
    ringCut(g, 0, ...toolRect(0.2, 12), true); ringCut(g, 0, ...toolRect(0.205, 12), true);
    const k = keywayInfo(g); expect(k.runs).toBe(1); expect(k.width).toBeLessThan(13);
  });
  it('drážka 12 × 3,3: postupným prísuvom po 0,5 mm úloha splnená', () => {
    const g = hub();
    for (let tip = 0.191; tip <= 0.2375; tip += 0.0045) { const r = ringCut(g, 0, ...toolRect(Math.min(tip, 0.233), 12), false); expect(r.area).toBeLessThanOrEqual(SLOTTER_TOOLS.drazk12.A);  ringCut(g, 0, ...toolRect(Math.min(tip, 0.233), 12), true); }
    const k = keywayInfo(g);
    expect(k.depth).toBeCloseTo(3.3, 1); expect(k.width).toBeCloseTo(12, 1);
    expect(slotterChecks.drazka({ ring: g }).every((c) => c.ok)).toBe(true);
  });
  it('nôž v plnom materiáli = náraz, zvonka sa obrys zmenšuje', () => {
    const g = hub();
    expect(ringCut(g, 0, ...toolRect(0.35, 12)).embedded).toBe(true);
    const r = ringCut(g, 0, 0.48, 0.6, -0.06, 0.06, true); expect(r.pen).toBeCloseTo(0.02, 4); expect(g.rout[0]).toBeCloseTo(0.48, 6);
  });
  it('štvorhranný otvor 25 × 25 z Ø24: prísuv k stene, priečny posuv k rohom, štyri polohy stola po 90°', () => {
    const sq = () => createRing({ rIn: 0.12, rOut: 0.5, H: 0.5, NT: 720 });
    const T = SLOTTER_TOOLS.plochy, g = sq();
    let maxA = 0;
    const go = (phi, tip, zc) => { const r = ringCut(g, phi, ...tRect(T, tip, zc), true); expect(r.embedded).toBe(false); maxA = Math.max(maxA, r.area); };
    for (let q = 0; q < 4; q++) {
      const phi = q * Math.PI / 2;
      for (let tip = 0.1; tip < 0.125; tip += 0.002) go(phi, tip, 0);
      go(phi, 0.125, 0);
      for (const sg of [1, -1]) { for (let z = 0.01; z < 0.045; z += 0.01) go(phi, 0.125, sg * z); go(phi, 0.125, sg * 0.045); }
    }
    expect(maxA).toBeLessThanOrEqual(T.A);
    const s = squareInfo(g, 0.125);
    expect(s.err).toBeLessThan(0.2); expect(s.corner).toBeGreaterThan(17.4);
    expect(slotterChecks.stvorec({ ring: g }).every((c) => c.ok)).toBe(true);
    expect(slotterChecks.stvorec({ ring: sq() }).every((c) => c.ok)).toBe(false);
    // nôž za stenou poškodí susednú stenu
    ringCut(g, 0, ...tRect(T, 0.125, 0.06), true);
    expect(slotterChecks.stvorec({ ring: g }).every((c) => c.ok)).toBe(false);
  });
});
