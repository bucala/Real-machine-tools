import { describe, expect, it } from 'vitest';
import { gasCover, migRange, migSynergic, stickoutI } from '../src/machines/migMath';
import { migChecks } from '../src/machines/shopMath';

describe('synergia MIG/MAG', () => {
  it('prúd rastie s rýchlosťou drôtu a je v rozsahu zdroja 3 – 450 A', () => {
    const a = migSynergic({ wire: 1, vd: 4, prog: 'std', gas: 'M21' }), b = migSynergic({ wire: 1, vd: 10, prog: 'std', gas: 'M21' });
    expect(b.I).toBeGreaterThan(a.I);
    expect(b.U).toBeGreaterThan(a.U);
    expect(migSynergic({ wire: 1.2, vd: 30, prog: 'std', gas: 'M21' }).I).toBeLessThanOrEqual(450);
    expect(migSynergic({ wire: 0.8, vd: 0, prog: 'std', gas: 'M21' }).I).toBeGreaterThanOrEqual(3);
  });
  it('druh prenosu: skrat → prechodový → sprchový; v CO₂ sprcha nevznikne; impulz je vždy impulz', () => {
    expect(migSynergic({ wire: 1, vd: 6, prog: 'std', gas: 'M21' }).mode).toBe('short');
    expect(migSynergic({ wire: 1, vd: 12, prog: 'std', gas: 'M21' }).mode).toBe('globular');
    expect(migSynergic({ wire: 1, vd: 16, prog: 'std', gas: 'M21' }).mode).toBe('spray');
    expect(migSynergic({ wire: 1, vd: 16, prog: 'std', gas: 'C1' }).mode).toBe('globular');
    expect(migSynergic({ wire: 1, vd: 6, prog: 'pulse', gas: 'M21' }).mode).toBe('pulse');
  });
  it('korekcia mení napätie a dĺžku oblúka, CO₂ potrebuje vyššie napätie', () => {
    const z = migSynergic({ wire: 1, vd: 8, prog: 'std', gas: 'M21' }), p = migSynergic({ wire: 1, vd: 8, prog: 'std', gas: 'M21', corr: 2 });
    expect(p.U - z.U).toBeCloseTo(2, 6);
    expect(p.la).toBeGreaterThan(z.la);
    expect(migSynergic({ wire: 1, vd: 8, prog: 'std', gas: 'C1' }).U).toBeGreaterThan(z.U);
  });
  it('nanesený kov = prierez drôtu × rýchlosť', () => {
    const s = migSynergic({ wire: 1, vd: 6, prog: 'std', gas: 'M21' });
    expect(s.dep).toBeCloseTo(Math.PI * 0.25 * 6000 / 60 * 0.95, 6);
  });
  it('dlhší výlet drôtu zníži prúd', () => {
    expect(stickoutI(200, 12)).toBeCloseTo(200, 6);
    expect(stickoutI(200, 22)).toBeLessThan(200);
  });
  it('plynová ochrana: zatvorený ventil, málo plynu, turbulencia, dlhý výlet', () => {
    expect(gasCover({ valve: false, flow: 14, ctwd: 12 })).toBe(0);
    expect(gasCover({ valve: true, flow: 14, ctwd: 12 })).toBe(1);
    expect(gasCover({ valve: true, flow: 5, ctwd: 12 })).toBeLessThan(0.7);
    expect(gasCover({ valve: true, flow: 25, ctwd: 12 })).toBeLessThan(1);
    expect(gasCover({ valve: true, flow: 14, ctwd: 25 })).toBeLessThan(0.7);
  });
  it('odporúčaný prúd rastie s hrúbkou', () => {
    const [l2] = migRange(2), [l8, h8] = migRange(8);
    expect(l8).toBeGreaterThan(l2);
    expect(h8).toBeGreaterThan(l8);
  });
});

describe('úlohy MAG', () => {
  const good = { cov: 1, off: 0.05, fill: 0.95, width: 7, cold: 0, longArc: 0, fast: 0, wrongDir: 0, sag: 0, por: 0 };
  it('zvar V bez chýb je splnený, póry ho pokazia', () => {
    const m = { stats: good, type: 'V', t: 8, pos: 'PA' };
    expect(migChecks.mvpa(m).every((c) => c.ok)).toBe(true);
    expect(migChecks.mvpa(m).some((c) => c.key === 'slag')).toBe(false);
    const por = migChecks.mvpa({ ...m, stats: { ...good, por: 2 } }).find((c) => c.key === 'por');
    expect(por.ok).toBe(false);
  });
  it('tenký plech: vysoký prúd nevyhovuje', () => {
    const m = { stats: good, type: 'I', t: 2, pos: 'PA', I: 90 };
    expect(migChecks.mtenky(m).every((c) => c.ok)).toBe(true);
    expect(migChecks.mtenky({ ...m, I: 160 }).find((c) => c.key === 'cur').ok).toBe(false);
  });
  it('bez zvaru nič nie je splnené okrem prípravy', () => {
    const cs = migChecks.mkpb({ stats: null, type: 'K', t: 8, pos: 'PB' });
    expect(cs.filter((c) => c.ok).map((c) => c.key)).toEqual(['setup']);
  });
});
