// Výpočty sústruhu bez three.js: profil obrobku, závit, meranie a kontrola úloh (testované v tests/lathe.test.js).

// metrické stúpania závitov (mm), ktoré ponúka prevodovka
export const METRIC_PITCHES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
// hĺbka vonkajšieho metrického závitu h3 = 0,6134 · P
export const threadDepth = (p) => 0.6134 * p;
export const TAN30 = Math.tan(Math.PI / 6);

// polomer povrchu závitu: R = vonkajší polomer, D = hĺbka drážky, p = stúpanie (rovnaké jednotky),
// x = poloha v osi, theta = uhol; drážka tvaru V 60° sa po skrutkovici posúva o p na otáčku
export function threadRadius(R, D, p, x, theta) {
  if (!(D > 0) || !(p > 0)) return R;
  let u = x / p + theta / (2 * Math.PI); u -= Math.floor(u);
  const s = Math.abs(u - 0.5) * p;                 // vzdialenosť od stredu drážky v osi
  return R - Math.max(0, Math.min(D, D - s / TAN30));
}

// rozbor profilu: prof = polomery úsekov (jednotky scény, 1 = 100 mm), thr = hĺbka závitu, pit = stúpanie;
// x0 = začiatok obrobku, dx = dĺžka úseku, jaw = čelo čeľustí (nula osi Z). Výsledok v mm od čeľustí.
export function profileInfo(prof, thr, pit, { x0, dx, jaw }) {
  const n = prof.length;
  let iEnd = n - 1; while (iEnd >= 0 && prof[iEnd] < 0.012) iEnd--;
  const iJ = Math.max(0, Math.ceil((jaw - x0) / dx - 1e-9));
  const zOf = (i) => (x0 + i * dx - jaw) * 100;
  const end = iEnd >= iJ ? zOf(iEnd + 1) : 0;
  const idx = (z) => Math.floor(((z / 100) + jaw - x0) / dx);
  const dAt = (z) => { const i = idx(z); return i >= iJ && i <= iEnd ? prof[i] * 200 : 0; };
  // osadenia: súvislé úseky s rovnakým priemerom (rozdiel do 0,02 mm), od čeľustí k voľnému koncu
  const steps = [];
  let s = iJ;
  for (let i = iJ + 1; i <= iEnd + 1; i++) {
    if (i > iEnd || Math.abs(prof[i] - prof[s]) * 200 > 0.02) { steps.push({ d: prof[s] * 200, z0: zOf(s), z1: zOf(i), len: zOf(i) - zOf(s) }); s = i; }
  }
  // závit: rozsah úsekov s drážkou, najväčšia hĺbka, stúpanie, vonkajší priemer
  let ta = -1, tb = -1, dep = 0, p = 0, crest = 0, mixed = false;
  if (thr) for (let i = iJ; i <= iEnd; i++) {
    if (thr[i] > 1e-5) {
      if (ta < 0) ta = i; tb = i; dep = Math.max(dep, thr[i]);
      // pri príliš hlbokej drážke (nad 0,866 · P) sa zrežú aj vrcholy závitu
      crest = Math.max(crest, prof[i] - Math.max(0, thr[i] - (pit ? pit[i] : 0) / (2 * TAN30)));
      const pi = pit ? pit[i] : 0; if (p && pi && Math.abs(pi - p) > 1e-6) mixed = true; if (pi) p = pi;
    }
  }
  const thread = ta >= 0 ? { z0: zOf(ta), z1: zOf(tb + 1), len: zOf(tb + 1) - zOf(ta), depth: dep * 100, pitch: Math.round(p * 1000) / 10, crest: crest * 200, mixed } : null;
  return { end, steps, thread, dAt };
}

// najväčší priemer v rozsahu [za, zb] mm od čeľustí (napr. nedotknutá časť)
export const minMaxD = (info, za, zb) => {
  let lo = Infinity, hi = 0;
  for (let z = Math.min(za, zb); z <= Math.max(za, zb); z += 0.25) { const d = info.dAt(z); if (d > 0) { lo = Math.min(lo, d); hi = Math.max(hi, d); } }
  return [lo === Infinity ? 0 : lo, hi];
};

// poloha prechodu z priemeru nad prahom na priemer pod prahom, hľadaná od voľného konca k čeľustiam
export const edgeFromEnd = (info, threshold, from = 0) => {
  for (let z = info.end - from; z > 0; z -= 0.05) {
    const d = info.dAt(z - 0.025);
    if (d >= threshold) return z;
  }
  return 0;
};

const f2 = (v) => v.toFixed(2);
const ok = (v, target, tol) => Math.abs(v - target) <= tol;

// kontrola úloh sústruhu; m = { info, D0 } (D0 = priemer polotovaru v mm)
export const latheChecks = {
  celo: ({ info }) => [
    { key: 'len', ok: ok(info.end, 100, 0.3), actual: `${f2(info.end)} mm` },
  ],
  // porovnáva sa s predpísaným polotovarom (Ø60), nie s práve upnutým kusom
  osadenie: ({ info }) => {
    const shoulder = edgeFromEnd(info, 50);                 // prechod Ø40 → Ø60
    const len = info.end - shoulder;
    const [dLo, dHi] = minMaxD(info, shoulder + 3, info.end - 3);
    const [rLo] = minMaxD(info, Math.max(1, shoulder - 25), shoulder - 2);
    return [
      { key: 'd', ok: len > 6 && ok(dLo, 40, 0.1) && ok(dHi, 40, 0.1), actual: len > 6 ? `Ø${f2(dLo)} – ${f2(dHi)}` : '–' },
      { key: 'len', ok: ok(len, 50, 0.5), actual: `${f2(len)} mm` },
      { key: 'rest', ok: ok(rLo, 60, 0.1), actual: `Ø${f2(rLo)}` },
    ];
  },
  zapich: ({ info }) => {
    const thr = 45;                                          // polovica medzi Ø50 (polotovar) a Ø40 (dno)
    let za = 0, zb = 0;                                       // okraj drážky bližšie ku koncu (za) a k čeľustiam (zb)
    for (let z = info.end - 1; z > 1; z -= 0.05) { if (info.dAt(z) < thr) { za = z + 0.05; break; } }
    if (za) for (let z = za - 0.05; z > 0; z -= 0.05) { if (info.dAt(z) >= thr) { zb = z + 0.05; break; } }
    const pos = za ? info.end - za : 0, width = za && zb ? za - zb : 0;
    const [bottom] = width ? minMaxD(info, zb + 0.3, za - 0.3) : [0];
    return [
      { key: 'pos', ok: ok(pos, 30, 0.5), actual: za ? `${f2(pos)} mm` : '–' },
      { key: 'width', ok: ok(width, 6, 0.4), actual: width ? `${f2(width)} mm` : '–' },
      { key: 'd', ok: width > 0 && ok(bottom, 40, 0.1), actual: width ? `Ø${f2(bottom)}` : '–' },
    ];
  },
  zavit: ({ info }) => {
    const t = info.thread;
    return [
      { key: 'pitch', ok: !!t && t.pitch === 1.5 && !t.mixed, actual: t ? `P ${t.pitch}${t.mixed ? ' !' : ''}` : '–' },
      { key: 'depth', ok: !!t && t.depth >= 0.87 && t.depth <= 0.98, actual: t ? `${f2(t.depth)} mm` : '–' },
      { key: 'len', ok: !!t && t.z1 >= info.end - 1.5 && t.z1 - t.z0 >= 30, actual: t ? `${f2(Math.min(t.z1, info.end) - t.z0)} mm` : '–' },
      { key: 'crest', ok: !!t && ok(t.crest, 30, 0.1), actual: t ? `Ø${f2(t.crest)}` : '–' },
    ];
  },
};
