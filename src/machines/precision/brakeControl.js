import { L } from '../../core/i18n';
import { BRAKE_PROGRAMS, brakeSetup, createBrakeProcess } from './pressBrakeProcess';

export const BRAKE_TABS = ['part', 'tools', 'bend', 'machine', 'diagnostics'];
export const RECIPE_LIMITS = {
  thickness: [0.5, 12],
  length: [100, 4300],
  depth: [80, 1400],
  flange: [20, 1050],
  v: [16, 120],
  angle: [90, 170],
  r: [0, 250],
};
export const BRAKE_RECIPE_KEY = 'rmt-bystronic-recipes-v1';
export const BRAKE_PRESETS = [
  {
    name: 'Konzola 90°',
    material: 'steel',
    thickness: 4,
    length: 1200,
    depth: 300,
    flange: 80,
    v: 32,
    angle: 90,
    r: 0,
  },
  {
    name: 'Oceľ 120°',
    material: 'steel',
    thickness: 6,
    length: 1800,
    depth: 500,
    flange: 150,
    v: 50,
    angle: 120,
    r: 0,
  },
  {
    name: 'Hliník 90°',
    material: 'aluminium',
    thickness: 2,
    length: 800,
    depth: 250,
    flange: 60,
    v: 16,
    angle: 90,
    r: 0,
  },
];
export function brakeRecipe(source) {
  if (!source || typeof source !== 'object' || !['steel', 'stainless', 'aluminium'].includes(source.material))
    throw new Error(L('Neplatný materiál.', 'Invalid material.'));
  const out = {
    name:
      String(source.name || 'Diel')
        .trim()
        .slice(0, 48) || 'Diel',
    material: source.material,
  };
  for (const [key, [min, max]] of Object.entries(RECIPE_LIMITS)) {
    const n = source[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
      throw new Error(L(`Neplatný parameter: ${key}`, `Invalid parameter: ${key}`));
    out[key] = n;
  }
  brakeSetup(out);
  if (out.r !== 0) throw new Error(L('Program pre plochý plech vyžaduje R = 0.', 'Flat sheet program requires R = 0.'));
  return out;
}
export function readBrakeRecipes(storage) {
  try {
    const value = JSON.parse(storage.getItem(BRAKE_RECIPE_KEY) || '[]');
    return Array.isArray(value)
      ? value.slice(0, 20).flatMap((r) => {
          try {
            return [brakeRecipe(r)];
          } catch {
            return [];
          }
        })
      : [];
  } catch {
    return [];
  }
}
export function saveBrakeRecipe(storage, source) {
  const recipe = brakeRecipe(source),
    all = readBrakeRecipes(storage).filter((r) => r.name !== recipe.name);
  all.unshift(recipe);
  storage.setItem(BRAKE_RECIPE_KEY, JSON.stringify(all.slice(0, 20)));
  return all.slice(0, 20);
}
export const recommendedV = (t) =>
  [16, 20, 24, 32, 40, 50, 64, 80, 100, 120].reduce((a, b) => (Math.abs(b - 8 * t) < Math.abs(a - 8 * t) ? b : a), 16);
export function brakeChecks(c, guardClosed = !c.guardOpen) {
  return [
    {
      id: 'stop',
      ok: !c.estop,
      sk: 'Núdzový STOP uvoľnený',
      en: 'Emergency STOP released',
      helpSk: 'Uvoľni červené tlačidlo STOP.',
      helpEn: 'Release the red STOP button.',
    },
    {
      id: 'hydraulic',
      ok: !!c.hydraulic,
      sk: 'Hydraulika zapnutá',
      en: 'Hydraulics enabled',
      helpSk: 'Zapni hydrauliku v záložke Stroj.',
      helpEn: 'Enable hydraulics on the Machine tab.',
    },
    {
      id: 'guards',
      ok: !c.guardOpen && guardClosed,
      sk: 'Bočné kryty zatvorené',
      en: 'Side guards closed',
      helpSk: 'Zatvor kryty a počkaj na ich dosadnutie.',
      helpEn: 'Close the guards and wait for them to seat.',
    },
    {
      id: 'field',
      ok: !c.obstructed,
      sk: 'Ochranné pole voľné',
      en: 'Safety field clear',
      helpSk: 'Odstráň simulovanú prekážku v záložke Stroj.',
      helpEn: 'Clear the simulated obstruction on the Machine tab.',
    },
    {
      id: 'sheet',
      ok: !c.unclamped,
      sk: 'Plech pri nástroji',
      en: 'Sheet at tooling',
      helpSk: 'Vráť plech z prehliadky späť do stroja.',
      helpEn: 'Return the sheet from inspection to the machine.',
    },
  ];
}
// The sidebar, fullscreen HMI and physical panel all use this controller.
export function createBrakeControl({
  c,
  onChange = () => {},
  guardClosed = () => !c.guardOpen,
  now = () => Date.now(),
}) {
  const process = createBrakeProcess(),
    stats = { completed: 0, interrupted: 0, lastTime: 0, lastForce: 0 };
  let events = [],
    sequence = 0,
    counted = null,
    lastAlarm = null,
    notice = '',
    program = null; // program ohybov: { id, name, steps, index, bends: [{ s, beta }] }
  const safety = () => ({ ...c, guardOpen: c.guardOpen || !guardClosed() });
  const event = (sk, en, level = 'info') => {
    events = [{ id: ++sequence, time: now(), sk, en, level }, ...events].slice(0, 40);
  };
  const reject = (sk, en) => {
    notice = L(sk, en);
    event(sk, en, 'warning');
    return false;
  };
  const write = (key, value) => {
    c[key] = value;
    onChange(key, value);
  };
  const editable = () => !process.job && !process.S.run && !c.unclamped && process.S.y < 0.01;
  const observe = () => {
    if (process.S.alarm && process.S.alarm !== lastAlarm) event(process.S.alarm, process.S.alarm, 'error');
    lastAlarm = process.S.alarm;
    if (process.S.done && process.job !== counted) {
      counted = process.job;
      stats[process.S.complete ? 'completed' : 'interrupted']++;
      stats.lastTime = process.S.t;
      stats.lastForce = process.S.maxForce;
      event(
        process.S.complete ? 'Ohyb dokončený.' : 'Cyklus prerušený, baran zdvihnutý.',
        process.S.complete ? 'Bend completed.' : 'Cycle interrupted, ram retracted.',
      );
    }
  };
  // program ohybov: poloha ohybu od hrany A, nastavenie dorazu a uhla pre aktuálny krok
  const stepPos = (st) => (st.side === 'B' ? c.depth - st.flange : st.flange);
  const applyStep = () => {
    const st = program.steps[program.index];
    write('flange', st.flange);
    write('angle', st.angle);
  };
  const loadProgram = (id) => {
    const p = BRAKE_PROGRAMS.find((x) => x.id === id);
    if (!p) return false;
    if (process.S.run || c.unclamped || process.S.y > 0.01)
      return reject('Najprv zdvihni baran a zastav cyklus.', 'Retract the ram and stop the cycle first.');
    process.reset();
    for (const k of ['material', 'thickness', 'length', 'depth', 'v', 'r']) write(k, p[k]);
    program = { id: p.id, name: p.name(), steps: p.steps, index: 0, bends: [] };
    applyStep();
    event(`Program ohybov: ${program.name}`, `Bend program: ${program.name}`);
    return true;
  };
  const set = (key, value) => {
    notice = '';
    if (key in RECIPE_LIMITS || key === 'material') {
      if (program && editable()) {
        program = null; // ručná zmena nastavenia ukončí program
        event('Program ohybov zrušený ručnou zmenou.', 'Bend program cancelled by a manual change.');
      }
      if (!editable())
        return reject('Najprv zdvihni baran a vlož nový plech.', 'Retract the ram and load a new sheet first.');
      if (key === 'material') {
        if (!['steel', 'stainless', 'aluminium'].includes(value)) return false;
      } else {
        const [min, max] = RECIPE_LIMITS[key];
        if (!Number.isFinite(value) || value < min || value > max)
          return reject('Hodnota je mimo rozsahu.', 'Value outside range.');
      }
      if (key === 'flange' && value > c.depth - 20)
        return reject('Doraz presahuje prírez.', 'Back gauge exceeds the blank.');
      write(key, value);
      if (key === 'depth' && c.flange > value - 20) write('flange', value - 20);
      return true;
    }
    if (['hydraulic', 'light', 'guardOpen', 'obstructed', 'cutaway'].includes(key)) {
      if (typeof value !== 'boolean') return false;
      write(key, value);
      process.advance(0, safety());
      observe();
      const labels = {
        hydraulic: ['Hydraulika', 'Hydraulics'],
        light: ['Osvetlenie', 'Lighting'],
        guardOpen: ['Otvorenie krytov', 'Open guards'],
        obstructed: ['Prekážka v poli', 'Field obstruction'],
        cutaway: ['Odkrytý mechanizmus', 'Exposed mechanism'],
      }[key];
      event(`${labels[0]}: ${value ? 'áno' : 'nie'}`, `${labels[1]}: ${value ? 'on' : 'off'}`);
      return true;
    }
    if (
      (key === 'hmiTab' && BRAKE_TABS.includes(value)) ||
      (key === 'hmiAngle' && Number.isFinite(value) && Math.abs(value) <= 80) ||
      (key === 'speed' && [1, 4, 10].includes(value))
    ) {
      write(key, value);
      return true;
    }
    return false;
  };
  const load = (source) => {
    if (!editable()) return reject('Nastavenie je počas cyklu zamknuté.', 'Setup is locked during a cycle.');
    let recipe;
    try {
      recipe = brakeRecipe(source);
    } catch (e) {
      notice = e.message;
      event(e.message, e.message, 'warning');
      return false;
    }
    program = null;
    for (const key of ['material', ...Object.keys(RECIPE_LIMITS)]) write(key, recipe[key]);
    notice = '';
    event(`Načítaný diel: ${recipe.name}`, `Loaded part: ${recipe.name}`);
    return true;
  };
  const action = (id) => {
    notice = '';
    let ok = true;
    if (id === 'start') {
      if (c.r !== 0) return reject('Pre plochý plech nastav R = 0 mm.', 'Set R = 0 mm for the flat sheet.');
      // program: po dokončenom ohybe sa diel otočí a pokračuje ďalší krok na tom istom plechu
      if (program && process.S.done) {
        if (!process.S.complete)
          return reject('Ohyb nebol dokončený – vlož nový plech.', 'The bend was not completed – load a new sheet.');
        if (program.index >= program.steps.length - 1)
          return reject('Program je dokončený – vlož nový plech.', 'The program is finished – load a new sheet.');
        program.bends.push({ s: stepPos(program.steps[program.index]), beta: process.S.beta });
        program.index++;
        process.reset();
        applyStep();
        const st = program.steps[program.index];
        event(
          `Ohyb ${program.index + 1}/${program.steps.length}: hrana ${st.side} k dorazu, X ${st.flange} mm, ${st.angle}°.`,
          `Bend ${program.index + 1}/${program.steps.length}: edge ${st.side} to the gauge, X ${st.flange} mm, ${st.angle}°.`,
        );
      }
      ok = process.start(c, safety());
      if (ok) event('Cyklus spustený.', 'Cycle started.');
    } else if (id === 'hold') {
      process.hold();
      event('Cyklus pozastavený.', 'Cycle paused.');
    } else if (id === 'retract') {
      ok = process.retract(safety());
      if (ok) event('Návrat barana.', 'Ram retracting.');
    } else if (id === 'reset') {
      if (c.unclamped || !process.reset())
        return reject(
          'Nový plech vyžaduje stojaci a zdvihnutý baran.',
          'Stop and retract the ram before loading a new sheet.',
        );
      if (program) {
        program.index = 0;
        program.bends = [];
        applyStep();
      }
      event('Vložený nový plech.', 'New sheet loaded.');
    } else if (id === 'emergency') {
      write('estop', true);
      process.hold(L('Núdzový STOP', 'Emergency STOP'));
    } else if (id === 'releaseStop') {
      write('estop', false);
      event('STOP uvoľnený. Pohyb ostáva zastavený.', 'STOP released. Motion remains stopped.');
    } else if (id === 'acknowledge') {
      ok = process.acknowledge(safety());
      if (ok) event('Hlásenie potvrdené.', 'Alarm acknowledged.');
    } else if (id === 'light' || id === 'hydraulic') return set(id, !c[id]);
    else return false;
    observe();
    return ok;
  };
  const advance = (dt) => {
    process.advance(dt, safety());
    observe();
  };
  const snapshot = () => ({
    ...process.S,
    hasJob: !!process.job,
    guardClosed: guardClosed(),
    events,
    stats: { ...stats },
    notice,
    program: program && {
      id: program.id,
      name: program.name,
      index: program.index,
      steps: program.steps,
      bends: program.bends.length + (process.S.complete ? 1 : 0),
    },
  });
  // prierez dielu pre model: hotové ohyby a práve ohýbaný
  const profile = () =>
    program && {
      bends: program.bends,
      cur: stepPos(program.steps[program.index]),
      side: program.steps[program.index].side,
    };
  event('Ovládanie pripravené.', 'Control ready.');
  return {
    process,
    set,
    load,
    loadProgram,
    profile,
    action,
    advance,
    snapshot,
    editable,
    get events() {
      return events;
    },
  };
}
