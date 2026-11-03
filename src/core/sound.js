// Zvuk strojov syntetizovaný cez Web Audio – motor, rez, iskrenie brúsky, transformátor, podávač drôtu a oblúk zváračky.
// Nič sa nesťahuje. Predvolene vypnutý; zapína sa v hornej lište (PREFS.sound), prehliadač ho pustí až po prvom kliknutí.
import { PREFS } from './i18n';

let ctx = null, master = null, noiseBuf = null;

const ensure = () => {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = PREFS.sound ? 0.7 : 0; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (err) { ctx = null; }
  return ctx;
};

// prehliadač dovolí zvuk až po interakcii používateľa
const unlock = () => { if (PREFS.sound && ensure() && ctx.state !== 'running') ctx.resume().catch(() => {}); };
try { ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true })); } catch (err) { /* bez zvuku */ }

const setSoundOn = (on) => {
  if (on) { if (!ensure()) return; ctx.resume().catch(() => {}); }
  if (master) master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.05);
};

// zvukový profil stroja: rozsah frekvencie motora (Hz) a pásmo zvuku rezu
const PROFILES = {
  lathe: { motor: [42, 120], cut: 2600, q: 5, cutGain: 0.16 },
  mill: { motor: [48, 150], cut: 1800, q: 4, cutGain: 0.15, tooth: 4 },
  drill: { motor: [60, 170], cut: 1300, q: 3, cutGain: 0.13 },
  grinder: { motor: [70, 240], cut: 6500, q: 1.2, cutGain: 0.14 },
  saw: { motor: [50, 140], cut: 3300, q: 6, cutGain: 0.14 },
  shaper: { motor: [38, 95], cut: 1500, q: 2.5, cutGain: 0.17 },
  weld: { hum: 100, arc: true },
  mig: { motor: [95, 210], arc: true },                                // invertor nehučí – počuť podávač drôtu a oblúk
  folder: {},
};

function createSound(kind) {
  const P = PROFILES[kind] || {};
  const N = {}; let built = false, lastT = 0;
  const noise = () => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(); return n; };
  const gain = (dst) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(dst || master); return g; };
  const filter = (type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const build = () => {
    if (built || !ensure()) return;
    built = true;
    if (P.motor) {
      N.mg = gain(); N.mlp = filter('lowpass', 520, 0.8); N.mlp.connect(N.mg);
      N.o1 = ctx.createOscillator(); N.o1.type = 'sawtooth'; N.o1.connect(N.mlp); N.o1.start();
      N.o2 = ctx.createOscillator(); N.o2.type = 'square'; N.o2.connect(N.mlp); N.o2.start();
    }
    if (P.cut) {
      N.cg = gain(); N.cbp = filter('bandpass', P.cut, P.q); N.cbp.connect(N.cg);
      N.cn = noise(); N.cn.connect(N.cbp);
    }
    if (P.hum) {
      N.hg = gain(); N.hlp = filter('lowpass', 420, 0.7); N.hlp.connect(N.hg);
      N.ho = ctx.createOscillator(); N.ho.type = 'sawtooth'; N.ho.frequency.value = P.hum; N.ho.connect(N.hlp); N.ho.start();
    }
    if (P.arc) {
      N.ag = gain(); N.ahp = filter('highpass', 1400, 0.7); N.ahp.connect(N.ag);
      N.an = noise(); N.an.connect(N.ahp);
    }
  };
  const to = (param, v, tc = 0.08) => param.setTargetAtTime(v, ctx.currentTime, tc);
  // motor 0 – 1 (pomer k najvyšším otáčkam), cut 0 – 1 (intenzita rezu), on = transformátor pod napätím, arc = horí oblúk
  const update = ({ motor = 0, cut = 0, on = false, arc = false } = {}) => {
    if (!PREFS.sound) return;
    build();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - lastT < 0.04 && !arc) return;
    lastT = now;
    if (N.mg) {
      const f = P.motor[0] + motor * (P.motor[1] - P.motor[0]);
      to(N.o1.frequency, f); to(N.o2.frequency, f * 1.503); to(N.mlp.frequency, 300 + 900 * motor);
      to(N.mg.gain, motor > 0.01 ? 0.035 + 0.06 * motor : 0, 0.15);
    }
    if (N.cg) {
      // fréza: rez pulzuje s frekvenciou zubov (počet zubov × otáčky)
      const pulse = P.tooth ? 0.65 + 0.35 * Math.sin(now * TAU_ * P.tooth * Math.max(0.5, motor * 30)) : 1;
      to(N.cbp.frequency, P.cut * (0.75 + 0.5 * motor));
      to(N.cg.gain, cut * P.cutGain * pulse, 0.05);
    }
    if (N.hg) {
      to(N.hg.gain, on ? (arc ? 0.06 : 0.025) : 0, 0.1);
      to(N.ho.frequency, arc ? P.hum * 0.97 : P.hum, 0.1);
    }
    if (N.ag) {
      // praskanie oblúka: náhodná hlasitosť šumu pri každej aktualizácii
      to(N.ag.gain, arc ? 0.05 + 0.12 * Math.random() : 0, 0.008);
    }
  };
  const dispose = () => {
    if (!built) return;
    Object.values(N).forEach((n) => { try { if (n.stop) n.stop(); n.disconnect(); } catch (err) { /* ignorované */ } });
  };
  return { update, dispose };
}
const TAU_ = Math.PI * 2;

export { createSound, setSoundOn };
