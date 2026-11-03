// Zvislá obrážačka bez three.js: obrobok (náboj, prstenec) ako vnútorný a vonkajší polomer pre každý uhol, rez nožom
// zvislým zdvihom cez celú výšku a kontrola úloh. Testované v tests/slotter.test.js. Jednotky scény (1 = 100 mm).

// rozmery kulisy zvislej obrážačky (kulisa vodorovne, smykadlo zvisle) a stupne prevodovky
export const SL_K = { d: 2.2, Lk: 4.3 };
export const SLOTTER_SPEEDS = [12, 18, 25, 36, 50, 71];
// nože: w = šírka ostria (mm), b = hĺbka reznej časti za ostrím (mm), A = najväčší prierez triesky na zdvih (mm²)
export const SLOTTER_TOOLS = {
  drazk8: { w: 8, b: 12, A: 4.5 }, drazk12: { w: 12, b: 12, A: 7 }, plochy: { w: 16, b: 10, A: 12 },
};
// prierez reznej časti noža voči stredu obrobku: ostrie v x = tip, šírka okolo z = zc
export const toolRect = (T, tip, zc) => [tip - T.b / 100, tip, zc - T.w / 200, zc + T.w / 200];

export function createRing({ rIn, rOut, H, NT = 360 }) {
  return { NT, dT: 2 * Math.PI / NT, H, rIn0: rIn, rOut0: rOut, rin: new Float32Array(NT).fill(rIn), rout: new Float32Array(NT).fill(rOut), mIn: new Uint8Array(NT), mOut: new Uint8Array(NT) };
}

// Prierez noža je obdĺžnik [x0, x1] × [z0, z1] voči stredu obrobku (v smere stola), stôl natočený o phi.
// Pre každý lúč θ sa nájde úsek lúča v obdĺžniku a porovná s materiálom [rin, rout]:
// zvnútra (z otvoru) sa otvor zväčší, zvonka sa obrys zmenší; nôž zarezaný mimo otvoru aj obrysu = embedded (narazil).
// pen = najväčšie radiálne vniknutie, area = prierez triesky (mm²) – podľa neho sa nôž zastaví pri preťažení.
export function ringCut(g, phi, x0, x1, z0, z1, write = false) {
  let pen = 0, rem = 0, area = 0, emb = 0;
  const seg = (a, b) => (b * b - a * a) / 2 * g.dT * 1e4;
  for (let j = 0; j < g.NT; j++) {
    const a = j * g.dT + phi, ca = Math.cos(a), sa = Math.sin(a);
    let lo = 0, hi = Infinity;
    if (Math.abs(ca) > 1e-9) { let t0 = x0 / ca, t1 = x1 / ca; if (t0 > t1) [t0, t1] = [t1, t0]; lo = Math.max(lo, t0); hi = Math.min(hi, t1); } else if (x0 > 0 || x1 < 0) continue;
    if (Math.abs(sa) > 1e-9) { let t0 = z0 / sa, t1 = z1 / sa; if (t0 > t1) [t0, t1] = [t1, t0]; lo = Math.max(lo, t0); hi = Math.min(hi, t1); } else if (z0 > 0 || z1 < 0) continue;
    if (lo >= hi) continue;
    const ri = g.rin[j], ro = g.rout[j];
    if (hi <= ri + 1e-9 || lo >= ro - 1e-9) continue;
    if (lo <= ri + 1e-9 && hi < ro) { const p = hi - ri; if (p > pen) pen = p; area += seg(ri, hi); if (write) { rem += p; g.rin[j] = hi; g.mIn[j] = 1; } }
    else if (hi >= ro - 1e-9 && lo > ri) { const p = ro - lo; if (p > pen) pen = p; area += seg(lo, ro); if (write) { rem += p; g.rout[j] = lo; g.mOut[j] = 1; } }
    else if (lo <= ri && hi >= ro) { const p = ro - ri; if (p > pen) pen = p; area += seg(ri, ro); if (write) { rem += p; g.rin[j] = ro; g.mIn[j] = 1; } }
    else { emb += seg(lo, hi); area += seg(lo, hi); }   // úsek lúča celý v materiáli: kapsu výšková mapa nezobrazí, ráta sa len do prierezu
  }
  return { pen, rem, area, embedded: emb > 0.5 };
}

// drážka v otvore: súvislý úsek lúčov s otvorom väčším ako pôvodný; šírka medzi bokmi a hĺbka od pôvodného otvoru (mm)
export function keywayInfo(g) {
  const r0 = g.rIn0, cut = Array.from(g.rin, (r) => r > r0 + 0.0005);
  if (!cut.some(Boolean)) return { width: 0, depth: 0, n: 0, runs: 0 };
  // začiatok úseku za nevyrezaným lúčom
  let s = cut.findIndex((v, j) => v && !cut[(j - 1 + g.NT) % g.NT]); if (s < 0) s = 0;
  let n = 0; while (n < g.NT && cut[(s + n) % g.NT]) n++;
  const thc = (s + (n - 1) / 2) * g.dT;
  // krajné lúče končia na bočných stenách drážky: šírka = rozdiel ich kolmých vzdialeností od osi drážky
  let wp = -Infinity, wm = Infinity, d = 0;
  for (let q = 0; q < n; q++) { const j = (s + q) % g.NT, del = j * g.dT - thc, r = g.rin[j]; wp = Math.max(wp, r * Math.sin(del)); wm = Math.min(wm, r * Math.sin(del)); d = Math.max(d, r * Math.cos(del)); }
  return { width: (wp - wm) * 100, depth: (d - r0) * 100, n, runs: cut.filter((v, j) => v && !cut[(j - 1 + g.NT) % g.NT]).length };
}

// štvorhranný otvor: natočenie štvorca s najmenšou odchýlkou stien; err = najväčšia odchýlka steny (mm), corner = najmenší polomer v rohoch
export function squareInfo(g, half) {
  let best = { err: Infinity, rot: 0 };
  for (let k = 0; k < 180; k++) {
    const rot = k / 180 * Math.PI / 2; let err = 0;
    for (let j = 0; j < g.NT; j++) {
      const a = j * g.dT - rot, ideal = half / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      err = Math.max(err, Math.abs(g.rin[j] - ideal));
    }
    if (err < best.err) best = { err, rot };
  }
  let corner = Infinity;
  for (let q = 0; q < 4; q++) { const j = Math.round((best.rot + Math.PI / 4 + q * Math.PI / 2) / g.dT) % g.NT; corner = Math.min(corner, g.rin[j]); }
  return { err: best.err * 100, corner: corner * 100 };
}

const f2 = (v) => v.toFixed(2);
export const slotterChecks = {
  // drážka pre pero 12 × 3,3 mm v otvore Ø40
  drazka: ({ ring }) => {
    const k = ring ? keywayInfo(ring) : null;
    return [
      { key: 'width', ok: !!k && k.n > 0 && Math.abs(k.width - 12) <= 0.25, actual: k && k.n ? `${f2(k.width)} mm` : '–' },
      { key: 'depth', ok: !!k && k.n > 0 && Math.abs(k.depth - 3.3) <= 0.1, actual: k && k.n ? `${f2(k.depth)} mm` : '–' },
      { key: 'one', ok: !!k && k.runs === 1, actual: k ? `${k.runs || 0}` : '–' },
    ];
  },
  // štvorhranný otvor 25 × 25 mm z otvoru Ø24 (roh štvorca je 17,7 mm od stredu)
  stvorec: ({ ring }) => {
    const q = ring ? squareInfo(ring, 0.125) : null;
    return [
      { key: 'walls', ok: !!q && q.err <= 0.2, actual: q ? `${f2(q.err)} mm` : '–' },
      { key: 'corners', ok: !!q && q.corner >= 17.4, actual: q ? `${f2(q.corner)} mm` : '–' },
    ];
  },
};
