import { describe, expect, it } from 'vitest';
import { CNC_SCREENS, cncHmiHit, cncHmiKey, drawCncScreen } from '../src/machines/cnc/cncScreen.js';

const c = (o = {}) => ({ scrTab: 'program', speed: 5, fo: 100, ro: 100, single: false, ...o });
const fake = () => {
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
const state = {
  controller: 'TNC 640',
  title: 'Ready',
  lines: [{ t: 'G0 X0', cur: true }],
  posList: [['X', '0.000']],
  status: 'Ready',
  alarm: false,
  pos: { X: 1, Y: 2, Z: 3, A: 0, C: 0 },
  T: 3,
  S: 8000,
  F: 1200,
  load: 0.4,
  tools: [{ t: 3, name: 'End mill', d: 10, l: 80 }],
  hist: [
    { t: 0, load: 0.2, mrr: 1 },
    { t: 5, load: 0.5, mrr: 3 },
  ],
  stock: { sx: 100, sy: 80, sz: 40, mat: 'al', res: 0.7 },
};

describe('dotykové displeje CNC', () => {
  for (const kind of ['tnc', 'rms']) {
    const D = CNC_SCREENS[kind];
    it(`${kind}: záložky, rýchlosť a korekcia posuvu`, () => {
      D.tabs.forEach(([id], i) => {
        const r = D.tab(i);
        expect(cncHmiHit(kind, c(), r.x + 5, r.y + 5)).toEqual({ id: 'tab', tab: id });
      });
      expect(cncHmiHit(kind, c(), D.speed.x1, D.speed.y)).toMatchObject({ id: 'speed', value: 80, drag: 'speed' });
      expect(cncHmiHit(kind, c(), D.feed.x0, D.feed.y)).toMatchObject({ id: 'fo', value: 0, drag: 'fo' });
      expect(cncHmiHit(kind, c(), D.feed.x1 + 500, 0, 'fo')).toEqual({ id: 'fo', value: 150 });
      expect(cncHmiKey(kind, c(), '2')).toEqual({ id: 'tab', tab: D.tabs[1][0] });
      expect(cncHmiKey(kind, c(), 'ArrowRight')).toEqual({ id: 'speed', value: 10 });
      expect(cncHmiKey(kind, c({ fo: 95 }), 'ArrowUp')).toEqual({ id: 'fo', value: 100 });
    });
    it(`${kind}: každá stránka sa vykreslí`, () => {
      for (const [tab] of D.tabs) {
        const { g, texts } = fake();
        drawCncScreen(g, D.w, D.h, kind, state, c({ scrTab: tab }));
        expect(texts.join(' ')).toContain('×5');
        if (tab === 'tools') expect(texts).toContain('End mill');
      }
    });
  }
  it('RMS: softvérové tlačidlá cyklu len na stránke PROGRAM', () => {
    const k = CNC_SCREENS.rms.keys[0];
    expect(cncHmiHit('rms', c(), k.x + 10, k.y + 10)).toEqual({ id: 'start' });
    expect(cncHmiHit('rms', c({ scrTab: 'tools' }), k.x + 10, k.y + 10)).toBeNull();
  });
});
