// Kontrola úloh vŕtačky, ohýbačky, píly a zváračky bez three.js (testované v tests/tasks.test.js). Rozmery v mm.

const f1 = (v) => v.toFixed(1);
const ok = (v, t, tol) => Math.abs(v - t) <= tol;

// vŕtačka: m = { holes: [{ x, z, d, depth, through }], PT }
export const drillChecks = {
  dve: ({ holes }) => {
    const h = holes.filter((x) => x.depth > 0.5);
    const dist = h.length === 2 ? Math.hypot(h[0].x - h[1].x, h[0].z - h[1].z) : 0;
    return [
      { key: 'count', ok: h.length === 2, actual: `${h.length}` },
      { key: 'd', ok: h.length === 2 && h.every((x) => Math.abs(x.d - 10) < 0.01), actual: h.map((x) => `Ø${x.d}`).join(', ') || '–' },
      { key: 'through', ok: h.length === 2 && h.every((x) => x.through), actual: h.filter((x) => x.through).length ? `${h.filter((x) => x.through).length}×` : '–' },
      { key: 'dist', ok: ok(dist, 50, 1), actual: dist ? `${f1(dist)} mm` : '–' },
    ];
  },
  slepa: ({ holes }) => {
    const h = holes.filter((x) => x.depth > 0.5), one = h.length === 1 ? h[0] : null;
    return [
      { key: 'count', ok: !!one, actual: `${h.length}` },
      { key: 'd', ok: !!one && Math.abs(one.d - 8) < 0.01, actual: one ? `Ø${one.d}` : '–' },
      { key: 'depth', ok: !!one && !one.through && ok(one.depth, 15, 0.5), actual: one ? (one.through ? 'naskrz' : `${f1(one.depth)} mm`) : '–' },
    ];
  },
};

// ohýbačka: m = { perm (trvalý uhol °), flange (mm), th (mm) }
export const folderChecks = {
  ohyb90: ({ perm, flange, th }) => [
    { key: 'angle', ok: ok(perm, 90, 1), actual: `${f1(perm)}°` },
    { key: 'flange', ok: ok(flange, 50, 0.5), actual: `${f1(flange)} mm` },
    { key: 'th', ok: ok(th, 1, 0.01), actual: `${th} mm` },
  ],
  ohyb45: ({ perm, flange, th }) => [
    { key: 'angle', ok: ok(perm, 45, 1), actual: `${f1(perm)}°` },
    { key: 'flange', ok: ok(flange, 30, 0.5), actual: `${f1(flange)} mm` },
    { key: 'th', ok: ok(th, 2, 0.01), actual: `${th} mm` },
  ],
};

// píla: m = { split, mat, speed (m/s), recommended (m/s), tension (%), gap (vodidlo nad obrobkom, mm), offcut (mm) }
export const sawChecks = {
  pas: ({ split, speed, recommended, tension, gapMax, offcut }) => [
    { key: 'offcut', ok: ok(offcut, 40, 0.5), actual: `${f1(offcut)} mm` },
    { key: 'speed', ok: speed === recommended, actual: `${speed} m/s` },
    { key: 'tension', ok: tension >= 70, actual: `${Math.round(tension)} %` },
    { key: 'guide', ok: gapMax > 0 && gapMax <= 20, actual: gapMax > 0 ? `${f1(gapMax)} mm` : '–' },
    { key: 'split', ok: !!split, actual: split ? '✓' : '–' },
  ],
};

// zváranie: m = { stats (evalWeld), type, t, pos, slag }
const weldCommon = ({ stats, slag }) => {
  const s = stats || {};
  const flaws = s.cov ? (s.cold > 1 ? 1 : 0) + (s.longArc > 1.5 ? 1 : 0) + (s.fast > 1 ? 1 : 0) + (s.wrongDir > 0.5 ? 1 : 0) + (s.sag > 1 ? 1 : 0) : 0;
  return [
    { key: 'cov', ok: !!stats && s.cov >= 0.95, actual: stats ? `${Math.round(s.cov * 100)} %` : '–' },
    { key: 'off', ok: !!stats && s.off <= 0.15, actual: stats ? `${Math.round(s.off * 100)} %` : '–' },
    { key: 'flaws', ok: !!stats && flaws === 0, actual: stats ? `${flaws}` : '–' },
    { key: 'slag', ok: !!stats && !slag, actual: slag ? L_SLAG[0] : L_SLAG[1] },
  ];
};
const L_SLAG = ['troska', '✓'];
export const weldChecks = {
  vpa: (m) => [
    { key: 'setup', ok: m.type === 'V' && m.t === 8 && m.pos === 'PA', actual: `${m.type} ${m.t} mm ${m.pos}` },
    { key: 'fill', ok: !!m.stats && m.stats.fill >= 0.9, actual: m.stats && m.stats.fill != null ? `${Math.round(m.stats.fill * 100)} %` : '–' },
    ...weldCommon(m),
  ],
  kpb: (m) => [
    { key: 'setup', ok: m.type === 'K' && m.t === 8 && m.pos === 'PB', actual: `${m.type} ${m.t} mm ${m.pos}` },
    { key: 'width', ok: !!m.stats && m.stats.width >= 6, actual: m.stats ? `${f1(m.stats.width)} mm` : '–' },
    ...weldCommon(m),
  ],
};

// MIG/MAG: bez trosky, navyše sa hodnotí pórovitosť (slabá plynová ochrana)
const migCommon = ({ stats }) => {
  const s = stats || {};
  return [
    ...weldCommon({ stats, slag: false }).filter((c) => c.key !== 'slag'),
    { key: 'por', ok: !!stats && (s.por || 0) <= 0.5, actual: stats ? `${f1(s.por || 0)} s` : '–' },
  ];
};
export const migChecks = {
  mvpa: (m) => [
    { key: 'setup', ok: m.type === 'V' && m.t === 8 && m.pos === 'PA', actual: `${m.type} ${m.t} mm ${m.pos}` },
    { key: 'fill', ok: !!m.stats && m.stats.fill >= 0.9, actual: m.stats && m.stats.fill != null ? `${Math.round(m.stats.fill * 100)} %` : '–' },
    ...migCommon(m),
  ],
  mkpb: (m) => [
    { key: 'setup', ok: m.type === 'K' && m.t === 8 && m.pos === 'PB', actual: `${m.type} ${m.t} mm ${m.pos}` },
    { key: 'width', ok: !!m.stats && m.stats.width >= 6, actual: m.stats ? `${f1(m.stats.width)} mm` : '–' },
    ...migCommon(m),
  ],
  mtenky: (m) => [
    { key: 'setup', ok: m.type === 'I' && m.t === 2 && m.pos === 'PA', actual: `${m.type} ${m.t} mm ${m.pos}` },
    { key: 'cur', ok: m.I != null && m.I <= 110, actual: m.I != null ? `${Math.round(m.I)} A` : '–' },
    ...migCommon(m),
  ],
};
