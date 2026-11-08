// Scene units = 100 mm. Exterior width from C42 brochure layout (2450 mm).
export const cabinHalfWidth = (model) => model.id === 'c42' ? 12.25 : 11.35;
// One rigid, cranked support, not a two-link folding arm (C42 PDF p. 19).
// Undimensioned fittings are photo estimates; the terminal is not scaled with K.
export const HMI_ARM = { reach:10.2, mountOffset:-.55, mountZ:4.2, start:34, end:146 };
export function hmiPose(angle, trim = 0, halfWidth = 11.4, scale = 1) {
  const sweep = Math.max(0, Math.min(180, angle)) * Math.PI / 180;
  const base = [halfWidth + HMI_ARM.mountOffset * scale, HMI_ARM.mountZ * scale];
  const radius = HMI_ARM.reach * scale;
  // UI 0–180 is the operator-to-magazine travel, not a half-circle through
  // the enclosure. With the pivot under the edge, the physical sector is smaller.
  const bearing=(HMI_ARM.start+(HMI_ARM.end-HMI_ARM.start)*sweep/Math.PI)*Math.PI/180;
  const dx=radius*Math.sin(bearing), dz=radius*Math.cos(bearing);
  return {
    base, angle:bearing, sweep,
    column:[base[0]+dx,base[1]+dz],
    yaw:(-25+115*Math.min(1,sweep/(Math.PI/2))+trim)*Math.PI/180,
  };
}
