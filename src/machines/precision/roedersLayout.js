// Scene units = 100 mm. The datum is the centre of the 2190 mm front base.
// PDF p57: traced RXU 1001 plan, described on p59 as VERY SIMILAR to the DSH.
// 4814 is the base-model body length; 5300 in the DSH table is required space,
// not a dimension to stretch every sheet-metal panel to.
export const RXU_LAYOUT = {
  front: 11.2,
  rear: -36.94,
  left: -10.95,
  right: 10.95,
  shoulderLeft: -16.1,
  shoulderFront: -0.5,
  shoulderRear: -22.8,
  rearSpineLeft: 2.6,
  rearCrossLeft: -7.1,
  rearCrossFront: -32.5,
  // These heights and window/panel dimensions are reconstructed from p58.
  baseTop: 7.1,
  frontTop: 28.2,
  towerTop: 35.5,
  door: { left: -8.5, right: 3.2, bottom: 7.25, top: 28.1, z: 11.34, travel: 11.8 },
  workCentre: [-2.6, 0, 3.2],
  terminal: [-20.3, 2.1, -6.3],
  chipCart: { x: -24.95, z: -20.2, width: 9.5, depth: 15.8 },
  cooling: { x: 5.6, z: -49.3, width: 10.5, depth: 7.5 },
  filter: { x: -20.8, z: -48.8, width: 15.23, depth: 13.8 },
};
export const RXU_PLAN = [
  [-10.95, 11.2],
  [10.95, 11.2],
  [10.95, -36.94],
  [-7.1, -36.94],
  [-7.1, -32.5],
  [2.6, -32.5],
  [2.6, -22.8],
  [-16.1, -22.8],
  [-16.1, -0.5],
  [-10.95, -0.5],
];
