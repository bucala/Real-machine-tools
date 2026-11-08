import { L } from '../core/i18n';
export function drawRmsScreen(g, w, h, scr) {
  g.save();
  g.scale(w / 1024, h / 768);
  g.fillStyle = '#b9bdc5';
  g.fillRect(0, 0, 1024, 768);
  g.fillStyle = '#a63243';
  g.fillRect(0, 0, 1024, 49);
  g.fillStyle = 'white';
  g.font = 'bold 20px Arial';
  g.fillText('Röders precision and rapid machining', 24, 31);
  g.font = '18px Arial';
  g.fillText('RMS6 · RXU 1001 DSH', 730, 31);
  g.fillStyle = '#e5e6ea';
  g.fillRect(5, 53, 1014, 39);
  g.fillStyle = '#343b55';
  g.font = '18px Arial';
  g.fillText('PROGRAM    MACHINE    TOOLS    SETUP    DIAGNOSTICS', 24, 80);
  const menus = [
    ['Coordinate system', 'NC program', 'Manual operation'],
    ['Corrections', 'Tool management', 'Job list'],
    ['Geometry', 'Measurements', 'Machine configuration'],
    ['Workpiece', 'Technology data', 'Simulation'],
    ['Service', 'Production', 'Diagnostics'],
  ];
  menus.forEach((row, r) =>
    row.forEach((t, col) => {
      g.fillStyle = r === 0 && col === 1 ? '#a33d52' : '#1635b1';
      g.fillRect(26 + col * 245, 108 + r * 67, 230, 59);
      g.fillStyle = 'white';
      g.font = '17px Arial';
      g.fillText(t, 38 + col * 245, 143 + r * 67);
    }),
  );
  g.fillStyle = '#263498';
  g.fillRect(783, 104, 219, 448);
  g.fillStyle = 'white';
  g.font = 'bold 19px Arial';
  g.fillText(scr?.title || 'RMS6 READY', 800, 134);
  (scr?.pos || []).forEach(([k, v], i) => {
    g.fillStyle = '#c2cafa';
    g.font = '18px Arial';
    g.fillText(k, 799, 174 + i * 43);
    g.fillStyle = 'white';
    g.font = '20px monospace';
    g.fillText(v, 840, 174 + i * 43);
  });
  g.fillStyle = '#e8e9ed';
  g.fillRect(20, 462, 740, 91);
  g.fillStyle = '#30394b';
  g.font = '16px Arial';
  g.fillText('NC / ISO · RXU 1001 DSH · QUADROGUIDE', 34, 489);
  g.fillText('X 800   Y 855   Z 500 mm     A / C', 34, 519);
  g.fillStyle = '#e6e7eb';
  g.fillRect(12, 565, 1000, 155);
  (scr?.lines || []).slice(0, 6).forEach((ln, i) => {
    if (ln.cur) {
      g.fillStyle = '#ded7ae';
      g.fillRect(18, 570 + i * 24, 988, 23);
    }
    g.fillStyle = '#343847';
    g.font = '16px monospace';
    g.fillText(ln.t.slice(0, 105), 28, 588 + i * 24);
  });
  g.fillStyle = scr?.alarm ? '#ae3345' : '#424e7e';
  g.fillRect(8, 729, 1008, 32);
  g.fillStyle = 'white';
  g.font = '17px Arial';
  g.fillText((scr?.status || L('Pripravený', 'Ready')).slice(0, 104), 21, 751);
  g.restore();
}
