// Úlohy s hodnotením pre elektroeróziu (OSCARMAX) a CNC ohraňovací lis (Bystronic).
// Čisté funkcie: meranie z procesu a voxelového poľa, kontroly. Testované v tests/modernTasks.test.js.
import { L } from '../../core/i18n';
import { pocketSize, surfaceZ } from '../cnc/measure';
import { edmGap } from './edmProcess';

const f2 = (v, d = 2) => (v == null || !Number.isFinite(v) ? '–' : v.toFixed(d));
const within = (v, nom, tol) => v != null && Math.abs(v - nom) <= tol + 1e-9;
const state = (m) =>
  m.alarm
    ? L(`hlásenie: ${m.alarm}`, `message: ${m.alarm}`)
    : m.done
      ? L('dokončené', 'finished')
      : L('nedokončené', 'not finished');

// ---------- elektroerózia ----------
// stock v ráme stola (horná plocha = stock.max[2]); rows = operácie hĺbenia (x, y, depth)
export function measureEdm({ stock, S, current, row }) {
  if (!stock || !S || !row) return null;
  const o = [0, 0, stock.max[2]],
    top = surfaceZ(stock, o, row.x, row.y);
  const depth = top == null ? null : -top;
  const size = depth > 0.3 ? pocketSize(stock, o, row.x, row.y, -Math.min(depth / 2, 1)) : { x: null, y: null };
  return {
    done: !!S.done,
    alarm: S.alarm || null,
    depth,
    size,
    ra: S.ra || 0,
    current,
    gap: edmGap(current),
    wear: S.wear || 0,
  };
}
export const edmChecks = {
  dutina: (m) => [
    { key: 'run', ok: m.done && !m.alarm, actual: state(m) },
    { key: 'depth', ok: within(m.depth, 6, 0.03), actual: `${f2(m.depth, 3)} mm` },
    { key: 'x', ok: within(m.size.x, 20.3, 0.05), actual: `${f2(m.size.x, 3)} mm` },
    { key: 'y', ok: within(m.size.y, 15.3, 0.05), actual: `${f2(m.size.y, 3)} mm` },
  ],
  dokoncenie: (m) => [
    { key: 'run', ok: m.done && !m.alarm, actual: state(m) },
    { key: 'ra', ok: m.done && m.ra > 0 && m.ra <= 1.6, actual: m.ra ? `Ra ${f2(m.ra, 1)} µm` : '–' },
    { key: 'depth', ok: within(m.depth, 2, 0.03), actual: `${f2(m.depth, 3)} mm` },
  ],
};
export const EDM_SAFETY = () => [
  L(
    'Nádrž je zatvorená a dielektrikum siaha aspoň 40 mm nad obrobok (nebezpečenstvo požiaru).',
    'The tank is closed and the dielectric is at least 40 mm above the workpiece (fire hazard).',
  ),
  L(
    'Elektróda aj obrobok sú pevne upnuté, výplach je zapnutý.',
    'The electrode and workpiece are firmly clamped, flushing is on.',
  ),
  L(
    'Počas iskrenia sa nedotýkam elektródy ani obrobku – je na nich napätie generátora.',
    'While sparking I do not touch the electrode or the workpiece – they carry generator voltage.',
  ),
];

// ---------- ohraňovací lis ----------
// konečný vnútorný uhol dielu po odpružení: 180° − 2β
export function measureBrake({ S, c }) {
  if (!S || !c) return null;
  return {
    done: !!S.done,
    complete: !!S.complete,
    alarm: S.alarm || null,
    angle: 180 - (S.beta * 360) / Math.PI,
    force: S.maxForce || 0,
    material: c.material,
    t: c.thickness,
    length: c.length,
    v: c.v,
    flange: c.flange,
  };
}
export const brakeChecks = {
  uholnik: (m) => [
    {
      key: 'run',
      ok: m.done && m.complete && !m.alarm,
      actual: m.complete ? L('ohyb dokončený', 'bend complete') : state(m),
    },
    {
      key: 'sheet',
      ok: m.material === 'steel' && m.t === 3 && m.length === 2000,
      actual: `${m.material} · ${m.t} × ${m.length} mm`,
    },
    { key: 'angle', ok: m.complete && within(m.angle, 90, 0.5), actual: `${f2(m.angle, 1)}°` },
    { key: 'flange', ok: within(m.flange, 50, 0.5), actual: `${f2(m.flange, 1)} mm` },
    { key: 'v', ok: m.v >= 6 * m.t && m.v <= 10 * m.t, actual: `V ${m.v} = ${f2(m.v / m.t, 1)} × t` },
  ],
  sila: (m) => [
    {
      key: 'run',
      ok: m.done && m.complete && !m.alarm,
      actual: m.complete ? L('ohyb dokončený', 'bend complete') : state(m),
    },
    {
      key: 'sheet',
      ok: m.material === 'steel' && m.t === 6 && m.length === 3000,
      actual: `${m.material} · ${m.t} × ${m.length} mm`,
    },
    { key: 'angle', ok: m.complete && within(m.angle, 90, 0.5), actual: `${f2(m.angle, 1)}°` },
    { key: 'force', ok: m.complete && m.force <= 1600, actual: `${Math.round(m.force)} kN` },
    { key: 'v', ok: m.v >= 6 * m.t && m.v <= 12 * m.t, actual: `V ${m.v} = ${f2(m.v / m.t, 1)} × t` },
  ],
};
