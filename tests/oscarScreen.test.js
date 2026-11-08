import { describe, expect, it } from 'vitest';
import { OSCAR_TABS, drawOscarScreen, oscarHmiHit, oscarHmiKey, speedToX, xToSpeed } from '../src/ui/oscarScreen.js';

const c = (o = {}) => ({
  hmiTab: 'machine',
  speed: 20,
  current: 30,
  ncMode: 'operations',
  ncText: '',
  fill: false,
  flushing: true,
  light: true,
  door: false,
  estop: false,
  electrode: { material: 'copper', shape: 'box', w: 20, d: 15, length: 100 },
  electrode2: { material: 'copper', shape: 'box', w: 20, d: 15, length: 100 },
  rows: [
    { x: -20, y: 0, depth: 8 },
    { x: 20, y: 0, depth: 5, tool: 2, current: 12 },
  ],
  ...o,
});
const S = { phase: 'idle', run: false, x: 0, y: 0, depth: -5, t: 0, removed: 0, row: 0, line: null, alarm: null };

// záznam volaní 2D kontextu – stačí na overenie, že každá stránka sa vykreslí bez chyby
const fakeContext = () => {
  const texts = [];
  const g = new Proxy(
    {},
    {
      get: (o, k) =>
        k === 'fillText'
          ? (t) => texts.push(String(t))
          : k === 'measureText'
            ? (t) => ({ width: String(t).length * 8 })
            : k in o
              ? o[k]
              : () => {},
      set: (o, k, v) => ((o[k] = v), true),
    },
  );
  return { g, texts };
};

describe('HMI OSCARMAX EX 500', () => {
  it('záložky menu prepínajú stránky', () => {
    OSCAR_TABS.forEach(([id], i) => expect(oscarHmiHit(c(), 20 + i * 172, 55)).toEqual({ id: 'tab', tab: id }));
    expect(oscarHmiKey(c(), '4')).toEqual({ id: 'tab', tab: 'generator' });
  });

  it('posuvník rýchlosti v stavovom riadku: logaritmická stupnica so značkami', () => {
    for (const v of [1, 5, 20, 80]) expect(xToSpeed(speedToX(v))).toBe(v);
    const hit = oscarHmiHit(c(), speedToX(40), 625);
    expect(hit).toMatchObject({ id: 'speed', value: 40, drag: 'speed' });
    // pri ťahaní rozhoduje len vodorovná poloha, aj mimo stavového riadku
    expect(oscarHmiHit(c(), speedToX(5), 300, 'speed')).toEqual({ id: 'speed', value: 5 });
    expect(oscarHmiHit(c(), 2000, 625, 'speed').value).toBe(80);
    expect(oscarHmiKey(c(), 'ArrowRight')).toEqual({ id: 'speed', value: 40 });
    expect(oscarHmiKey(c({ speed: 7 }), 'ArrowLeft')).toEqual({ id: 'speed', value: 5 });
    expect(oscarHmiKey(c({ speed: 1 }), 'ArrowLeft').value).toBe(1);
  });

  it('stránka GENERATOR mení prúd a prepínače, iná stránka nie', () => {
    const gen = c({ hmiTab: 'generator' });
    expect(oscarHmiHit(gen, 300, 260)).toEqual({ id: 'current', value: 31 });
    expect(oscarHmiHit(gen, 420, 260)).toEqual({ id: 'current', value: 40 });
    expect(oscarHmiHit(c({ hmiTab: 'generator', current: 55 }), 420, 260).value).toBe(60);
    expect(oscarHmiHit(gen, 30 + 230, 345)).toMatchObject({ id: 'current', value: 30, drag: 'currentBar' });
    expect(oscarHmiHit(gen, 600, 150)).toEqual({ id: 'fill' });
    expect(oscarHmiHit(gen, 850, 150)).toEqual({ id: 'coolant' });
    expect(oscarHmiHit(c(), 300, 260)).toBeNull();
    expect(oscarHmiHit(c({ hmiTab: 'program' }), 500, 570)).toEqual({ id: 'hold' });
  });

  it('každá stránka sa vykreslí s údajmi procesu', () => {
    const hist = [
      { t: 0, d: 0, r: 0 },
      { t: 10, d: 1, r: 300 },
    ];
    for (const [tab] of OSCAR_TABS) {
      const { g, texts } = fakeContext();
      drawOscarScreen(g, 1040, 650, { S, c: c({ hmiTab: tab }), oilLevel: 130, job: null, locked: false, hist });
      expect(texts.join(' ')).toContain('×20');
      if (tab === 'tool') expect(texts).toContain('ELECTRODE  E2');
      if (tab === 'program') expect(texts.join(' ')).toContain('WAIT');
    }
    const { g, texts } = fakeContext();
    drawOscarScreen(g, 1040, 650, { S, c: c(), oilLevel: 0, hist: [], msg: 'Najprv zatvor nádrž.' });
    expect(texts).toContain('Najprv zatvor nádrž.');
  });
});
