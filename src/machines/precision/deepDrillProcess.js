import { L } from '../../core/i18n';
// Educational ZJA13-family drilling cycle. These are simulator limits, not a
// certified parameter table for the ZJA13-2013F / Siemens controller firmware.
export const DEEP_BLANK = { min: [-500, -80, -120], max: [0, 80, 120], res: 2 };
export function validateDeepJob(c, stock) {
  const inRange = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
  if (!Array.isArray(c.rows) || !c.rows.length || c.rows.length > 20)
    throw new Error(L('Zadaj 1–20 otvorov.', 'Enter 1–20 holes.'));
  if (!inRange(c.diameter, 8, 40) || !inRange(c.feed, 5, 400) || !inRange(c.rpm, 100, 6000))
    throw new Error(L('Neplatný nástroj alebo rezné parametre.', 'Invalid tool or cutting parameters.'));
  const r = c.diameter / 2;
  for (const row of c.rows) {
    if (!inRange(row.x, -stock.max[2] + r, -stock.min[2] - r) || !inRange(row.y, stock.min[1] + r, stock.max[1] - r))
      throw new Error(L('Otvor presahuje polotovar.', 'Hole exceeds the blank.'));
    if (!inRange(row.depth, 1, stock.max[0] - stock.min[0] - 5))
      throw new Error(L('Hĺbka presahuje bezpečnú dĺžku polotovaru.', 'Depth exceeds safe blank length.'));
  }
}
export function createDeepDrillProcess(stock) {
  const S = { phase: 'idle', run: false, done: false, row: 0, x: 0, y: 0, depth: -30, t: 0, removed: 0, alarm: null };
  let job = null;
  const hold = () => {
    S.run = false;
  };
  const stop = (msg) => {
    hold();
    S.alarm = msg;
  };
  const guard = ({ door = false, estop = false, clamped = true, coolant = true, pressure = 40 } = {}) =>
    door
      ? L('Zatvor všetky dvere.', 'Close all doors.')
      : estop
        ? L('Núdzový STOP.', 'Emergency STOP.')
        : !clamped
          ? L('Upni obrobok.', 'Clamp the workpiece.')
          : !coolant || !Number.isFinite(pressure) || pressure < 10
            ? L('Zapni tlakové chladenie (≥10 bar)', 'Enable pressure coolant (≥10 bar).')
            : null;
  const start = (config, conditions) => {
    const error = guard(conditions);
    if (error) {
      stop(error);
      return false;
    }
    try {
      validateDeepJob(config, stock);
    } catch (e) {
      stop(e.message);
      return false;
    }
    if (S.done) return false;
    if (!job) {
      job = structuredClone(config);
      S.phase = 'position';
    }
    S.alarm = null;
    S.run = true;
    return true;
  };
  const advance = (dt, conditions) => {
    if (!S.run) return;
    const error = guard(conditions);
    if (error) {
      stop(error);
      return;
    }
    if (!Number.isFinite(dt) || dt <= 0) return;
    let left = Math.min(dt, 120);
    while (left > 1e-8 && S.run) {
      const h = Math.min(left, 0.2);
      left -= h;
      S.t += h;
      const row = job.rows[S.row];
      if (S.phase === 'position') {
        const d = Math.hypot(row.x - S.x, row.y - S.y),
          k = Math.min(1, (h * 120) / Math.max(d, 0.001));
        S.x += (row.x - S.x) * k;
        S.y += (row.y - S.y) * k;
        if (d < 0.01) {
          S.x = row.x;
          S.y = row.y;
          S.phase = 'approach';
        }
      } else if (S.phase === 'approach') {
        S.depth = Math.min(0, S.depth + h * 10);
        if (S.depth === 0) S.phase = 'drill';
      } else if (S.phase === 'drill') {
        S.depth = Math.min(row.depth, S.depth + (h * job.feed) / 60);
        stock.cut([-S.depth, S.y, -S.x], [1, 0, 0], { kind: 'mill', d: job.diameter, cr: 0, lc: S.depth + 2 });
        S.removed = stock.removed();
        if (S.depth >= row.depth) S.phase = 'retract';
      } else if (S.phase === 'retract') {
        S.depth = Math.max(-30, S.depth - h * 60);
        if (S.depth === -30) {
          S.row++;
          if (S.row === job.rows.length) {
            S.row--;
            S.done = true;
            S.run = false;
            S.phase = 'done';
          } else S.phase = 'position';
        }
      }
    }
  };
  const retract = () => {
    hold();
    S.depth = -30;
    if (job && !S.done) S.phase = 'position';
  };
  return {
    S,
    start,
    hold,
    stop,
    advance,
    retract,
    get job() {
      return job;
    },
  };
}
