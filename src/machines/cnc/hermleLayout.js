// Scene units = 100 mm. Exterior width from C42 brochure layout (2450 mm).
export const cabinHalfWidth = (model) => model.id === 'c42' ? 12.25 : 11.35;
export const HMI_LINKS = [4.6, 6.8];
export function hmiPose(angle, trim = 0, halfWidth = 11.4, scale = 1) {
  const sweep = Math.max(0, Math.min(180, angle)) * Math.PI / 180;
  const base = [halfWidth + 2.5 * scale, 7.5 * scale];
  // Two real links fold to the OUTSIDE of the cabin, rather than doubling back
  // in front of the operator. The endpoint moves to the magazine loading side.
  const radius = (5 + 6 * Math.sin(sweep / 2)) * scale;
  const dx=radius*Math.sin(sweep), dz=radius*Math.cos(sweep);
  const first=HMI_LINKS[0]*scale,second=HMI_LINKS[1]*scale;
  const along=(first*first-second*second+radius*radius)/(2*radius);
  const side=Math.sqrt(Math.max(0,first*first-along*along));
  const ex=along*Math.sin(sweep)+side*Math.cos(sweep);
  const ez=along*Math.cos(sweep)-side*Math.sin(sweep);
  const a=Math.atan2(ex,ez),b=Math.atan2(dx-ex,dz-ez);
  return {
    base, angle:a, elbow:b-a, sweep,
    column:[base[0]+dx,base[1]+dz],
    yaw:(-25+115*Math.min(1,angle/90)+trim)*Math.PI/180,
  };
}
