import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHeightField } from '../src/core/heightField';
import { grindChecks, grooveInfo, hfInfo, millChecks } from '../src/core/hfMath';
import { drillChecks, folderChecks, sawChecks, weldChecks } from '../src/machines/shopMath';
import { VC, nFromVc, vcFromN } from '../src/ui/tools';

const okAll = (cs) => cs.every((c) => c.ok);
// hranol 180 × 100 × 60 mm ako vo fréze (bunka ~1,2 mm)
const block = () =>
  createHeightField({
    NX: 150,
    NZ: 83,
    W: 1.8,
    D: 1.0,
    H: 0.6,
    raw: 0x444444,
    cut: 0xdddddd,
    mat: new THREE.MeshBasicMaterial(),
  });
const cutBox = (hf, x0, x1, z0, z1, depthMm) =>
  hf.cutRect(x0, x1, z0, z1, (k) => {
    hf.hgt[k] = Math.min(hf.hgt[k], hf.H - depthMm / 100);
    hf.mask[k] = 1;
  });

describe('fréza', () => {
  it('drážka 20 × 5 cez celú dĺžku v strede', () => {
    const hf = block();
    cutBox(hf, -0.95, 0.95, -0.1, 0.1, 5);
    const info = hfInfo(hf),
      g = grooveInfo(info, 5);
    expect(g.depth).toBeCloseTo(5, 3);
    expect(g.width).toBeGreaterThan(19);
    expect(g.width).toBeLessThan(21.5);
    expect(okAll(millChecks.drazka({ info }))).toBe(true);
  });
  it('plytká drážka alebo len kus dĺžky nevyhovuje', () => {
    const hf = block();
    cutBox(hf, -0.95, 0.2, -0.1, 0.1, 4.5);
    const cs = millChecks.drazka({ info: hfInfo(hf) });
    expect(cs.find((c) => c.key === 'depth').ok).toBe(false);
    expect(cs.find((c) => c.key === 'len').ok).toBe(false);
  });
  it('zarovnanie hornej plochy o 2 mm', () => {
    const hf = block();
    cutBox(hf, -1, 1, -1, 1, 2);
    expect(okAll(millChecks.rovina({ info: hfInfo(hf) }))).toBe(true);
    cutBox(hf, -0.2, 0.2, -0.2, 0.2, 2.5);
    expect(millChecks.rovina({ info: hfInfo(hf) })[1].ok).toBe(false);
  });
});

describe('brúska', () => {
  it('prebrúsenie o 0,1 mm s rovinnosťou do 0,01 mm', () => {
    const hf = createHeightField({
      NX: 100,
      NZ: 50,
      W: 2,
      D: 1,
      H: 0.4,
      raw: 0x444444,
      cut: 0xdddddd,
      mat: new THREE.MeshBasicMaterial(),
    });
    cutBox(hf, -1, 1, -1, 1, 0.105);
    expect(okAll(grindChecks.rovinnost({ info: hfInfo(hf) }))).toBe(true);
    cutBox(hf, -0.3, 0.3, -0.2, 0.2, 0.13); // jama 0,025 mm – rovinnosť nevyhovie
    expect(grindChecks.rovinnost({ info: hfInfo(hf) })[2].ok).toBe(false);
  });
});

describe('vŕtačka, ohýbačka, píla, zváranie', () => {
  it('dve diery Ø10 naskrz s rozostupom 50 mm', () => {
    const holes = [
      { x: -25, z: 0, d: 10, depth: 25, through: true },
      { x: 25.3, z: 0, d: 10, depth: 25, through: true },
    ];
    expect(okAll(drillChecks.dve({ holes }))).toBe(true);
    expect(drillChecks.dve({ holes: [holes[0]] })[0].ok).toBe(false);
  });
  it('slepá diera Ø8 hĺbky 15 mm', () => {
    expect(okAll(drillChecks.slepa({ holes: [{ x: 0, z: 0, d: 8, depth: 15.2, through: false }] }))).toBe(true);
    expect(drillChecks.slepa({ holes: [{ x: 0, z: 0, d: 8, depth: 25, through: true }] })[2].ok).toBe(false);
  });
  it('ohyb 90° ±1° a 45° ±1°', () => {
    expect(okAll(folderChecks.ohyb90({ perm: 90.6, flange: 50, th: 1 }))).toBe(true);
    expect(folderChecks.ohyb90({ perm: 88.5, flange: 50, th: 1 })[0].ok).toBe(false);
    expect(okAll(folderChecks.ohyb45({ perm: 45, flange: 30, th: 2 }))).toBe(true);
  });
  it('pás 40 mm: rýchlosť, napnutie, vodidlo, prerezanie', () => {
    const m = { split: true, speed: 25, recommended: 25, tension: 80, gapMax: 12, offcut: 40 };
    expect(okAll(sawChecks.pas(m))).toBe(true);
    expect(sawChecks.pas({ ...m, speed: 3 })[1].ok).toBe(false);
    expect(sawChecks.pas({ ...m, gapMax: 60 })[3].ok).toBe(false);
  });
  it('zvar V: nastavenie, vyplnenie, pokrytie, chyby, troska', () => {
    const stats = { cov: 0.98, off: 0.05, fill: 0.95, width: 9, cold: 0, longArc: 0.3, fast: 0, wrongDir: 0, sag: 0 };
    expect(okAll(weldChecks.vpa({ stats, type: 'V', t: 8, pos: 'PA', slag: false }))).toBe(true);
    expect(weldChecks.vpa({ stats, type: 'V', t: 8, pos: 'PA', slag: true }).find((c) => c.key === 'slag').ok).toBe(
      false,
    );
    expect(
      weldChecks
        .vpa({ stats: { ...stats, longArc: 4 }, type: 'V', t: 8, pos: 'PA', slag: false })
        .find((c) => c.key === 'flaws').ok,
    ).toBe(false);
    expect(okAll(weldChecks.vpa({ stats: null, type: 'V', t: 8, pos: 'PA', slag: true }))).toBe(false);
  });
});

describe('rezné podmienky', () => {
  it('n = 1000 · vc / (π · D) a späť', () => {
    expect(nFromVc(25, 10)).toBeCloseTo(795.8, 1);
    expect(vcFromN(nFromVc(120, 63), 63)).toBeCloseTo(120, 9);
  });
  it('odporúčané rýchlosti: spekaný karbid je rýchlejší ako HSS', () => {
    for (const m of Object.values(VC)) expect(m.sk[0]).toBeGreaterThanOrEqual(m.hss[0]);
  });
});
