// Výpočtové jadrá nových klasických strojov: TOS FGU 32, FNK 25, SK 12, BN 102 / BBT 350, BBJ 6, HOV 25 a píla Pilous ARG.
import { describe, expect, it } from 'vitest';
import { FGU, cuttingSpeed, discBottom, isClimb } from '../src/machines/fguMath';
import { toolAxis } from '../src/machines/fnkMath';
import { createDisc, cutSpeed, cutTool, engage } from '../src/machines/karuselMath';
import { TOOL, area, clipPoly, toolAngles, toolPoly } from '../src/machines/toolGrindMath';
import { BBJ, grindPass, pinsInfo, throughFeed } from '../src/machines/bbjMath';
import { ringCut } from '../src/machines/slotterMath';
import { HOV_TOOLS, arcInfo, hovBlank, hovChecks, hovToolRect, keywaysInfo, pitchErr } from '../src/machines/hovMath';
import { ARG, argChecks, chord, cutWidth, piecesInfo, qMax } from '../src/machines/pasovkaMath';

describe('frézky FGU 32 a FNK 25', () => {
  it('rezná rýchlosť kotúčovej frézy Ø100 pri 63 ot/min je ≈ 19,8 m/min', () => {
    expect(cuttingSpeed(63)).toBeCloseTo(19.79, 1);
    expect(FGU.speeds).toHaveLength(12);
  });
  it('súsledné frézovanie = zub a posuv v rovnakom smere', () => {
    expect(isClimb(1, 1)).toBe(true);
    expect(isClimb(1, -1)).toBe(false);
  });
  it('spodok kotúča pod osou a mimo kotúča nekonečno', () => {
    expect(discBottom(100, 50, 0)).toBe(50);
    expect(discBottom(100, 50, 60)).toBe(Infinity);
  });
  it('os nástroja pri natočení hlavy 30° je naklonená k +X', () => {
    const [x, y] = toolAxis(30);
    expect(x).toBeCloseTo(0.5, 6);
    expect(y).toBeCloseTo(Math.sqrt(3) / 2, 6);
  });
});

describe('karuselový sústruh SK 12', () => {
  it('rezná rýchlosť na Ø1 000 pri 25 ot/min', () => {
    expect(cutSpeed(1000, 25)).toBeCloseTo(78.54, 1);
  });
  it('nôž skráti riadky na svoj polomer a záber potom zmizne', () => {
    const d = createDisc({ R0: 500, rIn: 100, H: 200 });
    expect(engage(d, 495, 0)).toBeCloseTo(5, 6);
    expect(cutTool(d, 495, 0)).toBeGreaterThan(0);
    expect(engage(d, 495, 0)).toBe(0);
  });
});

describe('brúsenie noža (BN 102, BBT 350)', () => {
  it('rovina pod uhlom 8° vytvorí uhol chrbta 8° a ubudne plocha', () => {
    const p = toolPoly(),
      a = (8 * Math.PI) / 180;
    // čelná plocha nakláňaná od zvislice: u·cos α + v·sin α ≤ c (hrot pri u = L)
    const c = (TOOL.L - 3) * Math.cos(a); // rovina prechádza spodkom 3 mm od hrotu – celé čelo je zbrúsené
    const r = clipPoly(p, Math.cos(a), Math.sin(a), c);
    expect(r.removed).toBeGreaterThan(0);
    expect(area(r.poly)).toBeCloseTo(area(p) - r.removed, 6);
    const ang = toolAngles(r.poly);
    expect(Math.abs(ang.alpha)).toBeCloseTo(8, 6);
    expect(ang.endLen).toBeCloseTo(TOOL.H, 6);
  });
});

describe('bezhrotová brúska BBJ 6', () => {
  it('rýchlosť prechodu rastie so sklonom podávacieho kotúča', () => {
    expect(throughFeed(0, 30)).toBe(0);
    expect(throughFeed(3, 30)).toBeGreaterThan(throughFeed(2, 30));
  });
  it('prechod zbrúsi kolík na medzeru, veľký úber je ťažký', () => {
    expect(grindPass(20.05, 20, 10).d).toBeCloseTo(20, 6);
    expect(grindPass(20.05, 20, 10).heavy).toBe(false);
    expect(grindPass(20.3, 20, 10).heavy).toBe(true);
    expect(grindPass(20, 20.2, 10).cut).toBe(0);
    expect(BBJ.maxCut).toBe(0.1);
  });
  it('dobrý kolík má rozmer v tolerancii a guľatosť ≤ 0,005', () => {
    const info = pinsInfo([
      { passes: 2, d: 20.004, round: 0.003 },
      { passes: 1, d: 20.05, round: 0.003 },
      { passes: 0, d: 21, round: 0 },
    ]);
    expect(info.n).toBe(2);
    expect(info.ok).toBe(1);
  });
});

describe('zvislá obrážačka HOV 25', () => {
  // drážka: nôž 10 mm s ostrím k +x sa prisúva po 0,01 mm od steny otvoru (R 20) do hĺbky t pri natočení stola phi (rad)
  const slot = (g, depthMm, phi) => {
    const T = HOV_TOOLS.drazk10;
    for (let s = 0; s <= depthMm * 100; s++) {
      const [x0, x1, z0, z1] = hovToolRect(T, 0.2 + s / 10000, 0, 1);
      ringCut(g, phi, x0, x1, z0, z1, true);
    }
  };
  it('štyri drážky 10 × 3 po 90° splnia kontrolu', () => {
    const g = hovBlank();
    [0, 90, 180, 270].forEach((a) => slot(g, 3, (a * Math.PI) / 180));
    const ks = keywaysInfo(g);
    expect(ks).toHaveLength(4);
    ks.forEach((k) => {
      expect(k.width).toBeCloseTo(10, 1);
      expect(k.depth).toBeCloseTo(3, 1);
    });
    expect(pitchErr(ks)).toBeLessThan(0.5);
    expect(hovChecks.drazky({ ring: g, crashes: 0, shallow: false }).every((c) => c.ok)).toBe(true);
  });
  it('tri drážky alebo zlý rozostup kontrolou neprejdú', () => {
    const g = hovBlank();
    [0, 90, 200].forEach((a) => slot(g, 3, (a * Math.PI) / 180));
    const ch = hovChecks.drazky({ ring: g, crashes: 0, shallow: false });
    expect(ch.find((c) => c.key === 'count').ok).toBe(false);
    expect(ch.find((c) => c.key === 'pitch').ok).toBe(false);
  });
  it('vonkajší oblúk R55 kruhovým posuvom: rozsah a polomer', () => {
    const g = hovBlank(),
      T = HOV_TOOLS.plochy;
    // nôž otočený (ostrie k −x) na polomere 55 mm, stôl sa točí o 112° po 0,5°
    for (let a = 0; a <= 112; a += 0.5) {
      const [x0, x1, z0, z1] = hovToolRect(T, 0.55, 0, -1);
      ringCut(g, (a * Math.PI) / 180, x0, x1, z0, z1, true);
    }
    const arc = arcInfo(g, 55);
    expect(arc.runs).toBe(1);
    expect(arc.err).toBeLessThan(0.2);
    expect(arc.span).toBeGreaterThan(115);
    expect(arc.span).toBeLessThan(125);
    expect(hovChecks.oblouk({ ring: g, crashes: 0, shallow: false }).every((c) => c.ok)).toBe(true);
  });
});

describe('pásová píla Pilous ARG 200 PLUS', () => {
  it('tetiva kruhu je najširšia v strede a šikmý rez je širší', () => {
    expect(chord(40, 20)).toBeCloseTo(40, 6);
    expect(chord(40, 0)).toBe(0);
    expect(cutWidth(40, 20, 45)).toBeCloseTo(40 * Math.SQRT2, 6);
  });
  it('bez chladenia a pri vyššej rýchlosti pásu je prípustný úber menší', () => {
    expect(qMax(0, true)).toBe(ARG.qSteel[0]);
    expect(qMax(0, false)).toBeLessThan(qMax(0, true));
    expect(qMax(1, true)).toBeLessThan(qMax(0, true));
  });
  it('zarovnanie čela sa nepočíta, tri kusy 250 splnia úlohu', () => {
    const P = (l, extra = {}) => ({ l, aL: 0, aR: 0, rough: false, loose: false, bad: false, ...extra });
    const pieces = [P(12, { rough: true }), P(250), P(250.4), P(249.7)];
    expect(piecesInfo(pieces, 250, 0)).toMatchObject({ n: 3, ok: 3 });
    expect(argChecks.kusy({ pieces, blade: false }).every((c) => c.ok)).toBe(true);
    const bad = [...pieces.slice(0, 3), P(251.5)];
    expect(argChecks.kusy({ pieces: bad, blade: false }).find((c) => c.key === 'count').ok).toBe(false);
    expect(argChecks.kusy({ pieces, blade: true }).find((c) => c.key === 'blade').ok).toBe(false);
  });
  it('šikmé kusy musia mať oba konce pod 45°', () => {
    const p = (aR) => ({ l: 150, aL: 45, aR, rough: false, loose: false, bad: false });
    expect(piecesInfo([p(45), p(45)], 150, 45).ok).toBe(2);
    expect(piecesInfo([p(0), p(45)], 150, 45).ok).toBe(1);
  });
});
