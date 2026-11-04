// Scene units = 100 mm. Exterior width from C42 brochure layout (2450 mm).
export const cabinHalfWidth = (model) => model.id === 'c42' ? 12.25 : 11.4;
export function hmiPose(angle, trim = 0, halfWidth = 11.4, scale = 1) {
  const a = Math.max(0, Math.min(180, angle)) * Math.PI / 180;
  const base = [halfWidth + 1.8 * scale, 7.5 * scale];
  const first = 8.8 * scale, second = 4.3 * scale;
  return {
    base, angle: a, elbow: Math.PI - a,
    column: [base[0] + first * Math.sin(a), base[1] + first * Math.cos(a) - second],
    yaw: (-25 + 115 * Math.min(1, angle / 90) + trim) * Math.PI / 180,
  };
}
