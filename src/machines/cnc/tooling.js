// Nástroje a materiály CNC centra. Nástroj: d priemer, cr polomer rohu (0 = plochý, d/2 = guľový), tip uhol špičky
// (vrták 118°, skosovacia fréza 90°), lc dĺžka reznej časti, l dĺžka od čela vretena po špičku, s vyloženie z držiaka,
// dh priemer držiaka, z počet zubov. Pick-up zásobník má 36 miest.
import { L } from '../../core/i18n';

export const MAG = 36;
export const defaultTools = () => [
  {
    t: 1,
    name: L('Čelná fréza Ø50', 'Face mill Ø50'),
    kind: 'mill',
    d: 50,
    cr: 0.8,
    lc: 6,
    l: 110,
    s: 42,
    dh: 63,
    z: 5,
  },
  {
    t: 2,
    name: L('Stopková fréza Ø16', 'End mill Ø16'),
    kind: 'mill',
    d: 16,
    cr: 0,
    lc: 32,
    l: 125,
    s: 58,
    dh: 40,
    z: 3,
  },
  {
    t: 3,
    name: L('Stopková fréza Ø10', 'End mill Ø10'),
    kind: 'mill',
    d: 10,
    cr: 0,
    lc: 25,
    l: 115,
    s: 48,
    dh: 32,
    z: 3,
  },
  { t: 4, name: L('Guľová fréza Ø6', 'Ball mill Ø6'), kind: 'mill', d: 6, cr: 3, lc: 18, l: 110, s: 40, dh: 27, z: 2 },
  {
    t: 5,
    name: L('Vrták Ø8,5', 'Drill Ø8.5'),
    kind: 'cone',
    tip: 118,
    d: 8.5,
    cr: 0,
    lc: 55,
    l: 140,
    s: 75,
    dh: 32,
    z: 2,
  },
  {
    t: 6,
    name: L('Skosovacia fréza 90° Ø12', 'Chamfer mill 90° Ø12'),
    kind: 'cone',
    tip: 90,
    d: 12,
    cr: 0,
    lc: 8,
    l: 105,
    s: 38,
    dh: 32,
    z: 4,
  },
  { t: 7, name: L('Stopková fréza Ø6', 'End mill Ø6'), kind: 'mill', d: 6, cr: 0, lc: 16, l: 105, s: 36, dh: 27, z: 3 },
  {
    t: 8,
    name: L('Guľová fréza Ø10', 'Ball mill Ø10'),
    kind: 'mill',
    d: 10,
    cr: 5,
    lc: 22,
    l: 120,
    s: 50,
    dh: 32,
    z: 2,
  },
  {
    t: 9,
    name: L('Toroidná fréza Ø12 R2', 'Bull nose Ø12 R2'),
    kind: 'mill',
    d: 12,
    cr: 2,
    lc: 24,
    l: 120,
    s: 50,
    dh: 32,
    z: 4,
  },
  { t: 10, name: L('Vrták Ø5', 'Drill Ø5'), kind: 'cone', tip: 118, d: 5, cr: 0, lc: 40, l: 125, s: 60, dh: 27, z: 2 },
];
// materiál polotovaru: kc = merný rezný odpor (N/mm²), farba obrobenej a surovej plochy
export const MATERIALS = {
  al: {
    name: () => L('Hliník EN AW-7075', 'Aluminium EN AW-7075'),
    kc: 800,
    rgb: [0.86, 0.88, 0.9],
    raw: [0.62, 0.64, 0.66],
    metal: 0.85,
    rough: 0.32,
  },
  steel: {
    name: () => L('Oceľ C45', 'Steel C45'),
    kc: 2100,
    rgb: [0.78, 0.79, 0.8],
    raw: [0.36, 0.37, 0.38],
    metal: 0.8,
    rough: 0.38,
  },
  brass: {
    name: () => L('Mosadz CuZn39Pb3', 'Brass CuZn39Pb3'),
    kc: 900,
    rgb: [0.93, 0.8, 0.45],
    raw: [0.66, 0.55, 0.3],
    metal: 0.85,
    rough: 0.3,
  },
  pom: {
    name: () => L('Plast POM-C', 'Plastic POM-C'),
    kc: 250,
    rgb: [0.93, 0.93, 0.9],
    raw: [0.82, 0.82, 0.78],
    metal: 0,
    rough: 0.55,
  },
};
// nástroje z komentárov CAM postprocesorov, napr. Fusion: "(T2 D=10. CR=0. - ZMIN=-12. - flat end mill)"
// alebo "; T4  D=6  CR=3  TAPER=118deg - drill"
export function toolsFromComments(comments) {
  const out = [];
  comments.forEach((c) => {
    const m = c.match(/\bT(\d+)\b[^\n]*?\bD\s*=\s*([\d.]+)/i);
    if (!m) return;
    const t = Number(m[1]),
      d = parseFloat(m[2]);
    if (!(d > 0) || out.some((x) => x.t === t)) return;
    const cr = parseFloat((c.match(/\bCR\s*=\s*([\d.]+)/i) || [])[1] || '0') || 0;
    const tap = parseFloat((c.match(/TAPER\s*=\s*([\d.]+)/i) || [])[1] || '0') || 0;
    const kind = /drill|spot|center|vrt/i.test(c) ? 'cone' : /chamfer|countersink|skos/i.test(c) ? 'cone' : 'mill';
    const tip = kind === 'cone' ? (tap > 0 ? tap : /chamfer|countersink|skos/i.test(c) ? 90 : 118) : 0;
    const ball = /ball|guľ/i.test(c);
    const lc = Math.max(d * 2.5, 12),
      s = Math.round(Math.max(lc + 12, d * 4));
    out.push({
      t,
      name: c.replace(/^[\s(;*-]+|[)\s]+$/g, '').slice(0, 48),
      kind,
      tip,
      d,
      cr: ball ? d / 2 : Math.min(cr, d / 2),
      lc,
      l: s + 65,
      s,
      dh: d > 20 ? 63 : d > 12 ? 40 : 32,
      z: d >= 40 ? 5 : d > 8 ? 3 : 2,
      cam: true,
    });
  });
  return out;
}
