// Meranie obrobku z voxelového poľa (stock.sdfAt) – pre úlohy s hodnotením. Súradnice v ráme stola (mm),
// o54 = nulový bod G54. Hrany sa hľadajú krokom a potom bisekciou na nulovej hladine vzdialenosti.
const bisect = (f, a, b, n = 24) => {
  let fa = f(a);
  for (let i = 0; i < n; i++) {
    const m = (a + b) / 2,
      fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
};

// výška povrchu materiálu (Z v G54) v bode (x, y) G54; null, ak tam materiál nie je
export function surfaceZ(stock, o54, x, y) {
  const px = o54[0] + x,
    py = o54[1] + y,
    top = stock.max[2] + 1,
    bottom = stock.min[2],
    step = stock.res / 2;
  const f = (z) => stock.sdfAt([px, py, z]);
  for (let z = top; z > bottom; z -= step) if (f(z - step) > 0) return bisect(f, z, z - step) - o54[2];
  return null;
}

// vzdialenosť steny od bodu (x, y, z) G54 v smere (dx, dy) – hľadá prvý materiál; null, ak ho nenájde
export function wallDistance(stock, o54, x, y, z, dx, dy, max = 80) {
  const p = (t) => [o54[0] + x + dx * t, o54[1] + y + dy * t, o54[2] + z],
    step = stock.res / 2;
  const f = (t) => stock.sdfAt(p(t));
  if (f(0) > 0) return 0;
  for (let t = 0; t < max; t += step) if (f(t + step) > 0) return bisect(f, t, t + step);
  return null;
}

// rozmer kapsy so stredom (cx, cy) vo výške z: šírka v X a Y
export function pocketSize(stock, o54, cx, cy, z) {
  const d = (dx, dy) => wallDistance(stock, o54, cx, cy, z, dx, dy);
  const xm = d(-1, 0),
    xp = d(1, 0),
    ym = d(0, -1),
    yp = d(0, 1);
  return { x: xm != null && xp != null ? xm + xp : null, y: ym != null && yp != null ? ym + yp : null };
}
