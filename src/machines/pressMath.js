// Výstredníkový lis (predloha TOMA LEN 40C) bez three.js: sila strihu, zanorenie razníka podľa prestavenia
// baranidla, výsledok zdvihu (vzduch / vtlačené / prestrihnuté / preťaženie / náraz) a kontrola úloh.
// Testované v tests/press.test.js. Dĺžky v mm, sily v kN.

export const PRESS = { Fmax: 400, spm: 80, Rm: 440, penMin: 0.5, penMax: 6, adj0: 40 };
export const PRESS_STROKES = [10, 20, 40, 60, 80]; // zdvih výstredníka (mm)
export const PRESS_PUNCHES = [10, 16, 20, 25, 32, 40, 50]; // priemer razníka (mm)
export const shearStrength = (Rm = PRESS.Rm) => 0.8 * Rm; // pevnosť v strihu τ ≈ 0,8 Rm (MPa)
export const punchForce = (d, t, Rm = PRESS.Rm) => (Math.PI * d * t * shearStrength(Rm)) / 1000;
// zanorenie hrany razníka pod čelo matrice v dolnej úvrati; prestavenie baranidla adj (mm, väčšie = nižšie)
export const penetration = (adj) => adj - PRESS.adj0;
// zdvih nad pásom hrúbky t: kontakt nastane, keď hrana razníka zíde pod hornú plochu pásu (pen > −t)
export function strokeResult({ d, t, adj, x, L, Rm = PRESS.Rm, Fmax = PRESS.Fmax }) {
  const pen = penetration(adj),
    r = d / 2;
  if (x + r <= 0 || x - r >= L) return { kind: 'miss', pen };
  if (pen <= -t) return { kind: 'air', pen };
  const F = punchForce(d, t, Rm);
  if (F > Fmax) return { kind: 'overload', pen, F };
  if (pen > PRESS.penMax) return { kind: 'crash', pen, F };
  const edge = x - r < 0 || x + r > L;
  if (pen < PRESS.penMin) return { kind: 'dent', pen, F, depth: Math.max(0, pen + t), edge };
  return { kind: 'through', pen, F, edge };
}
// jeden diera/výstrižok do zoznamu pásu (opakovaný zdvih na tom istom mieste nič nepridá)
export function addHole(holes, { x, d, t, kind, edge = false, depth = 0 }) {
  const same = holes.find((h) => Math.abs(h.x - x) < 0.05 && Math.abs(h.d - d) < 1e-6);
  if (same) {
    if (kind === 'through' && !same.through) {
      same.through = true;
      same.depth = t;
    } else if (kind === 'dent') same.depth = Math.max(same.depth, depth);
    return same;
  }
  const h = { x, d, t, through: kind === 'through', depth: kind === 'through' ? t : depth, edge };
  holes.push(h);
  return h;
}

const f1 = (v) => v.toFixed(1);
const sorted = (hs) => hs.slice().sort((a, b) => a.x - b.x);
export const pressChecks = {
  // 5 dier Ø20 v rozstupe 50 mm, prvá 50 mm od ľavého konca, do pásu 4 mm
  dierovanie: ({ holes = [], crashes = 0 }) => {
    const ok = sorted(holes.filter((h) => h.through && h.d === 20 && !h.edge)),
      xs = ok.map((h) => h.x);
    const pitches = xs.slice(1).map((x, i) => x - xs[i]);
    return [
      { key: 'count', ok: ok.length === 5 && holes.length === 5, actual: `${ok.length} / ${holes.length}` },
      { key: 'edge', ok: ok.length > 0 && Math.abs(xs[0] - 50) <= 0.5, actual: ok.length ? `${f1(xs[0])} mm` : '–' },
      {
        key: 'pitch',
        ok: pitches.length === 4 && pitches.every((p) => Math.abs(p - 50) <= 0.5),
        actual: pitches.length ? pitches.map(f1).join(' / ') : '–',
      },
      { key: 'tool', ok: holes.length > 0 && crashes === 0, actual: `${crashes}` },
    ];
  },
  // 4 podložky Ø50 zo 6 mm pásu: mostík medzi výstrižkami aspoň hrúbka plechu, bez preťaženia
  podlozky: ({ holes = [], overloads = 0 }) => {
    const ok = sorted(holes.filter((h) => h.through && h.d === 50 && h.t === 6 && !h.edge)),
      xs = ok.map((h) => h.x);
    const webs = xs.slice(1).map((x, i) => x - xs[i] - 50);
    return [
      { key: 'count', ok: ok.length >= 4, actual: `${ok.length}` },
      {
        key: 'web',
        ok: ok.length >= 2 && webs.every((w) => w >= 6 - 1e-6),
        actual: webs.length ? `${f1(Math.min(...webs))} mm` : '–',
      },
      { key: 'load', ok: ok.length > 0 && overloads === 0, actual: `${overloads}` },
    ];
  },
};
