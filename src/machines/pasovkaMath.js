// Pásová píla Pilous ARG 200 PLUS bez three.js: delenie kruhovej tyče na kusy pod uhlom.
// Dĺžky v mm, uhly v °, rýchlosti v mm/s, úber v mm²/s.

export const ARG = { D: 40, speeds: [40, 80], kerf: 0.9, swing: [-45, 60], qSteel: [70, 25], feedMax: 3 };
// tetiva kruhového prierezu vo výške y nad spodkom tyče
export const chord = (D, y) => (y <= 0 || y >= D ? 0 : 2 * Math.sqrt(y * (D - y)));
// šírka záberu pílového pásu pri šikmom reze (prierez je elipsa)
export const cutWidth = (D, y, aDeg) => chord(D, y) / Math.cos((aDeg * Math.PI) / 180);
// najväčší prípustný úber pre oceľ podľa rýchlosti pásu a chladenia
export const qMax = (speedIdx, coolant) => ARG.qSteel[speedIdx] * (coolant ? 1 : 0.6);
// kus je dobrý, ak má predpísanú dĺžku, oba konce pod predpísaným uhlom a nebol rezaný voľný ani zlým pásom
export const pieceOk = (p, L, A, tol = 1, aTol = 0.5) =>
  !p.rough &&
  !p.loose &&
  !p.bad &&
  Math.abs(p.l - L) <= tol &&
  Math.abs(p.aL - A) <= aTol &&
  Math.abs(p.aR - A) <= aTol;
export function piecesInfo(pieces, L, A) {
  const real = pieces.filter((p) => p.l >= 30); // kratšie = odrezok pri zarovnaní čela
  return {
    n: real.length,
    ok: real.filter((p) => pieceOk(p, L, A)).length,
    last: real.length ? real[real.length - 1] : null,
  };
}
const ARG_TASK = { kusy: [250, 0, 3], uhol: [150, 45, 2] };
export const argTask = (id) => ARG_TASK[id];
const fmt = (p) => (p ? `${p.l.toFixed(1)} mm` : '—');
export const argChecks = Object.fromEntries(
  Object.entries(ARG_TASK).map(([id, [L, A, n]]) => [
    id,
    (m) => {
      const inf = piecesInfo(m.pieces, L, A);
      return [
        { key: 'count', ok: inf.ok >= n, value: `${inf.ok} / ${n}` },
        { key: 'len', ok: !!inf.last && Math.abs(inf.last.l - L) <= 1, value: fmt(inf.last) },
        {
          key: 'angle',
          ok: !!inf.last && Math.abs(inf.last.aL - A) <= 0.5 && Math.abs(inf.last.aR - A) <= 0.5,
          value: inf.last ? `${inf.last.aR.toFixed(1)}° / ${inf.last.aL.toFixed(1)}°` : '—',
        },
        { key: 'blade', ok: !m.blade, value: m.blade ? '✗' : '✓' },
      ];
    },
  ]),
);
