// Obrážačka bez three.js: kinematika kulisového mechanizmu, profily nožov a kontrola úloh. Testované v tests/shaper.test.js.
// Jednotky: mechanizmus v jednotkách scény (1 = 100 mm), nože a úlohy v mm.
import { grooveInfo } from '../core/hfMath';

// Kulisa: veľké koleso s čapom na polomere r sa točí okolo stredu, ktorý je d nad otočným bodom kulisy.
// Kulisa siaha Lk nad otočný bod k smykadlu; smykadlo sa posunie o Lk · tg θ.
export const SH_K = { d: 2.4, Lk: 6.7 };
// polomer čapu pre zdvih S (jednotky scény) – najväčší výkyv kulisy je pri dotyčnici čapu
// K = rozmery kulisy (predvolene vodorovná obrážačka; zvislá má kulisu inak rozmiestnenú)
export const crankR = (S, K = SH_K) => {
  const a = S / 2;
  return (K.d * a) / Math.sqrt(K.Lk * K.Lk + a * a);
};
// uhol kulisy θ a posun smykadla x (od stredu zdvihu) pri uhle kolesa φ (φ = 0: čap hore)
export const ramPos = (phi, r, K = SH_K) => {
  const th = Math.atan2(r * Math.sin(phi), K.d + r * Math.cos(phi));
  return { th, x: K.Lk * Math.tan(th) };
};
// pracovný (dopredný) zdvih prebieha, kým je čap na hornom oblúku – je dlhší ako spätný (rýchly spätný chod)
export const isForward = (phi, r, K = SH_K) => Math.cos(phi) > -r / K.d;
export const fwdShare = (r, K = SH_K) => (Math.PI + 2 * Math.asin(Math.min(1, r / K.d))) / (2 * Math.PI);
// priemerná rezná rýchlosť (m/min) pri zdvihu S (mm) a n zdvihoch za minútu
export const cutSpeed = (S, n, r, K = SH_K) => (S * n) / 1000 / fwdShare(r, K);
export const SHAPER_SPEEDS = [10, 14, 20, 28, 40, 56]; // zdvihy za minútu (6 stupňov prevodovky)

// nože: w = šírka plôšky (mm), slope = sklon bokov (mm výšky na mm do strany), max = najväčší záber na zdvih (mm)
export const SHAPER_TOOLS = {
  ubr: { w: 1, slope: 1, max: 5 }, // ubierací so zaoblenou špičkou, boky 45°
  hlad: { w: 8, slope: 3, max: 0.3 }, // hladiaci so širokou plôškou
  drazk6: { w: 6, slope: 40, max: 1.5 }, // drážkovací (zapichovací) 6 mm
  drazk10: { w: 10, slope: 40, max: 1.5 }, // drážkovací 10 mm
};
// výška rezného profilu nad špičkou vo vzdialenosti u (mm) od osi noža
export const toolLift = (t, u) => Math.max(0, Math.abs(u) - t.w / 2) * t.slope;

const f2 = (v) => v.toFixed(2);
const near = (v, t, tol) => Math.abs(v - t) <= tol;
export const shaperChecks = {
  // horná plocha znížená o 2 mm
  rovina: ({ info }) => {
    let inTol = 0,
      n = 0;
    for (let j = 1; j < info.NZ; j++)
      for (let i = 1; i < info.NX; i++) {
        n++;
        if (near(info.at(i, j), 2, 0.1)) inTol++;
      }
    const share = n ? inTol / n : 0;
    return [
      { key: 'share', ok: share >= 0.95, actual: `${Math.round(share * 100)} %` },
      { key: 'max', ok: info.maxDep <= 2.1, actual: `${f2(info.maxDep)} mm` },
    ];
  },
  // drážka pre pero 10 × 5 mm v strede šírky
  drazka: ({ info }) => {
    const g = grooveInfo(info, 5);
    return [
      { key: 'depth', ok: near(g.depth, 5, 0.15), actual: g.cover ? `${f2(g.depth)} mm` : '–' },
      {
        key: 'width',
        ok: near(g.width, 10, Math.max(0.6, info.dZ * 1.2)),
        actual: g.cover ? `${f2(g.width)} mm` : '–',
      },
      { key: 'len', ok: g.cover >= 0.95, actual: `${Math.round(g.cover * 100)} %` },
      {
        key: 'center',
        ok: g.cover > 0 && near(g.center, info.Wd / 2, Math.max(1, info.dZ * 2)),
        actual: g.cover ? `${f2(g.center)} mm` : '–',
      },
    ];
  },
  // osadenie 30 × 10 mm pozdĺž jednej hrany (ktorejkoľvek)
  osadenie: ({ info }) => {
    const side = (fromLow) => {
      let inStep = 0,
        nStep = 0,
        rest = 0,
        nRest = 0;
      for (let j = 1; j < info.NZ; j++) {
        const z = fromLow ? j * info.dZ : info.Wd - j * info.dZ; // vzdialenosť od zvolenej hrany
        for (let i = 1; i < info.NX; i++) {
          const d = info.at(i, j);
          if (z <= 29) {
            nStep++;
            if (near(d, 10, 0.2)) inStep++;
          } else if (z >= 32) {
            nRest++;
            if (d <= 0.2) rest++;
          }
        }
      }
      return { step: nStep ? inStep / nStep : 0, rest: nRest ? rest / nRest : 0 };
    };
    const a = side(true),
      b = side(false),
      s = a.step >= b.step ? a : b;
    return [
      { key: 'step', ok: s.step >= 0.9, actual: `${Math.round(s.step * 100)} %` },
      { key: 'rest', ok: s.rest >= 0.95, actual: `${Math.round(s.rest * 100)} %` },
    ];
  },
};
