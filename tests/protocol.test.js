import { describe, expect, it } from 'vitest';
import { buildProtocol, deviation, parseAct, parseReq, score } from '../src/ui/protocol';

describe('protokol z cvičenia', () => {
  it('predpis a odchýlka z textu požiadavky', () => {
    expect(parseReq('Polomer R 500 ±6 mm')).toMatchObject({ nom: 500, lo: 494, hi: 506 });
    expect(deviation('Polomer R 500 ±6 mm', 'R 498 mm')).toEqual({ req: '500 ±6', dev: '−2' });
    expect(deviation('Dno drážky Ø40 ±0,1 mm', 'Ø40.03').dev).toBe('+0,03');
    expect(deviation('Priemer Ø40 h6 (40,000 – 39,984)', 'Ø39.992').dev).toBe('−0,008');
    // dve čísla v nameranej hodnote alebo rozmer „a × b ±t“ – odchýlka sa nepočíta
    expect(deviation('Rovné konce ≤ 50 mm', '45 / 45 mm').dev).toBe('');
    expect(parseReq('Rozteč 300 × 200 ±0,5 mm')).toBe(null);
    expect(parseAct('–')).toBe(null);
  });
  it('hodnotenie: percentá, odpočet za varovania a známka', () => {
    const ch = [{ ok: true }, { ok: true }, { ok: false }, { ok: true }];
    expect(score(ch, 0)).toMatchObject({ ok: 3, total: 4, pct: 75, grade: 2 });
    expect(score(ch, 30).pct).toBe(55);
  });
  it('protokol obsahuje zadanie, výkres, tabuľku odchýlok, nastavenia a hodnotenie; texty sú ošetrené', () => {
    const html = buildProtocol({
      machine: 'sustruh',
      title: 'Hrotový sústruh',
      sub: 'TOS SN',
      kicker: 'Simulátor',
      task: 'Zápich <6>',
      desc: 'Tyč Ø50',
      svg: '<svg></svg>',
      shot: null,
      params: [{ sec: 'Pohon', l: 'Otáčky', v: '500 ot/min' }],
      dro: [['X', '40.00']],
      checks: [{ label: 'Dno drážky Ø40 ±0,1 mm', actual: 'Ø40.03', ok: true }],
      warns: 1,
      secs: 75,
      student: 'Jano',
      url: 'https://x/#sustruh/uloha=zapich',
      date: '4. 11. 2026',
    });
    expect(html).toContain('Zápich &lt;6&gt;');
    expect(html).toContain('<svg></svg>');
    expect(html).toContain('+0,03');
    expect(html).toContain('500 ot/min');
    expect(html).toContain('1:15');
    expect(html).toContain('známka 1');
  });
});
