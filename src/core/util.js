// Matematické pomôcky spoločné pre všetky stroje.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (cur, target, step) => {
  const d = target - cur;
  return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
};
const logNear = (arr, v) =>
  arr.reduce((bi, a, i) => (Math.abs(Math.log(a / v)) < Math.abs(Math.log(arr[bi] / v)) ? i : bi), 0);
const fanAngles = (n, a) => Array.from({ length: n }, (_, i) => (n === 1 ? 0 : a - (i * 2 * a) / (n - 1)));

export { TAU, approach, clamp, fanAngles, logNear };
