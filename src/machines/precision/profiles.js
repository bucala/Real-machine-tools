// Dimensions transcribed from the supplied manufacturer catalogues. Scene units = 100 mm.
export const RXU = {
  id:'rxu1001', brand:'Röders', name:'RXU 1001 DSH', controller:'RMS6 · ISO training interface',
  K:1, table:600, mag:24, hA:101, X:[-400,400], Y:[-450,405], nose:[76,576], A:[-115,115],
  rapid:60000, rapidZ:60000, vA:90, vC:180, smax:24000, mmax:67,
  // Catalogue supplies torque, not a spindle power curve. Load is an educational estimate.
  pmax:Infinity, tc:6, tcY:350, maxToolDiameter:35, maxToolLength:250,
  weight:21000, maxWorkpiece:800, envelope:[3500,5300,3550],
  source:'Röders catalogue, supplied PDF pp. 58–59; Ø600 round table variant',
};
export function validateRxuTool(tool) {
  if(tool.d>RXU.maxToolDiameter)throw new Error('RXU 1001 DSH · štandardné vreteno: nástroj max. Ø35 mm / standard spindle: tool max. Ø35 mm.');
  if(tool.l>RXU.maxToolLength)throw new Error('Výukový profil RXU: dĺžka nástroja max. 250 mm / training profile: tool length max. 250 mm.');
}
export const RXU_PROGRAM = `%
O1001 (ROEDERS - ISO TRAINING POST)
(T3 D=10. CR=0. - flat end mill)
G21 G90 G17 G40 G49 G80
T3 M6
S16000 M3
G54 G43 H3
G0 X0 Y0 Z20
M8
G0 Z2
G1 Z-2 F180
G1 X10 F900
G2 X10 Y0 I-10 J0
G1 X0
G0 Z20
M5 M9
G53 G0 Z0
M30
%`;

// Manufacturer EX500 web specification, screenshots supplied by the user 2026-11-05.
// The separate EXD catalogue describes EDM drilling and is NOT the source for this sinker.
export const EX500={
  id:'ex500',brand:'OSCARMAX',name:'EX 500',X:[-250,250],Y:[-200,200],Z:450,
  table:[850,450],workpiece:[1020,710],tankHeight:355,chuck:[130,480],
  maxWorkpiece:2300,maxElectrode:200,weight:3000,current:60,powerKva:10,
  tankLitres:850,filterMicrons:20,filters:6,
  envelope:[2493,2810.5,2778],structure:'column-moving',
  source:'https://www.oscaredm.com/en-US/p182-die-sinker-electrical-discharge-machine-ex-500',
};
