// Model zváracieho poloautomatu Fronius TransPuls Synergic TPS 450 na vozíku: chladiaci modul, zdroj,
// podávač drôtu s cievkou navrchu a plynová fľaša so redukčným ventilom vzadu. Mierka 1 = 100 mm, predok = +Z.
import * as THREE from 'three';

const RED = 0xc8262b, BEIGE = 0xd8ccae, GREY = 0x3b3e41;

export function buildFronius({ kit, M, grp, v3, std }) {
  const { add, box, cylX, cylY, cylZ, hitProxy } = kit;
  const R = { red: std(RED, 0.45, 0.15), beige: std(BEIGE, 0.7, 0.05), grey: std(GREY, 0.6, 0.4), dark: std(0x1c1d1f, 0.6, 0.2),
    brass: std(0xc9a14a, 0.35, 0.85), wire: std(0xb87333, 0.35, 0.9), plastic: new THREE.MeshStandardMaterial({ color: 0xdfe8ef, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }),
    cyl: std(0x6d7275, 0.45, 0.55), shoulder: std(0x45b04d, 0.5, 0.2), gauge: std(0xf2f2ee, 0.4, 0.05) };

  const wel = grp('zdroj'); wel.position.set(8.4, 0, 1.4); wel.rotation.y = -0.62;

  // ---------- vozík ----------
  [[-1.15, -2.7], [1.15, -2.7], [-1.15, 2.6], [1.15, 2.6]].forEach(([x, z]) => { cylX(wel, 0.36, 0.36, x - 0.12, x + 0.12, 0.36, z, M.black, 24); cylX(wel, 0.14, 0.14, x - 0.14, x + 0.14, 0.36, z, M.steel, 12); });
  box(wel, -1.5, 1.5, 0.62, 0.76, -3.7, 3.4, R.dark);
  box(wel, -1.5, 1.5, 0.76, 1.6, -4.0, -3.7, R.dark);                    // zadná opierka fľaše
  box(wel, -0.08, 0.08, 0.76, 7.0, 3.4, 3.55, R.dark); box(wel, -1.4, 1.4, 6.9, 7.05, 3.4, 3.55, R.dark);   // rukoväť vpredu

  // ---------- chladiaci modul FK ----------
  const fk = grp('chladenie', wel);
  box(fk, -1.4, 1.4, 0.76, 3.2, -3.1, 3.1, R.beige);
  for (let k = 0; k < 7; k++) box(fk, -1.1 + k * 0.32, -0.95 + k * 0.32, 1.1, 2.8, 3.1, 3.13, R.dark);   // mriežka
  cylZ(fk, 0.09, 0.09, 3.1, 3.3, 1.05, 1.0, M.red, 12); cylZ(fk, 0.09, 0.09, 3.1, 3.3, 1.05, 1.35, M.blue, 12);   // prípojky chladiva

  // ---------- zdroj TPS 450 ----------
  const src = new THREE.Group(); wel.add(src);
  box(src, -1.45, 1.45, 3.2, 7.9, -3.1, 3.1, R.red);
  box(src, -1.25, 1.25, 3.45, 7.7, 3.1, 3.13, R.beige);                    // čelný panel
  for (let k = 0; k < 8; k++) [-1.47, 1.45].forEach((x) => box(src, x, x + 0.02, 3.6 + k * 0.32, 3.75 + k * 0.32, 1.0, 2.6, R.dark));   // vetracie štrbiny
  // nápis Fronius na bokoch
  const logoCv = document.createElement('canvas'); logoCv.width = 512; logoCv.height = 96;
  { const g = logoCv.getContext('2d'); g.fillStyle = '#c8262b'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#ffffff'; g.font = 'italic bold 70px Barlow, Arial'; g.fillText('Fronius', 40, 72); }
  const logoTex = new THREE.CanvasTexture(logoCv); logoTex.colorSpace = THREE.SRGBColorSpace;
  const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.5 });
  [[1.462, Math.PI / 2], [-1.462, -Math.PI / 2]].forEach(([x, ry]) => { const m = add(src, new THREE.PlaneGeometry(3.2, 0.6), logoMat, x, 6.4, -1.0); m.rotation.y = ry; m.castShadow = false; });
  // panel: popisy, displeje a kontrolky (displej sa prekreslí len pri zmene)
  const pCv = document.createElement('canvas'); pCv.width = 500; pCv.height = 850;
  const pTex = new THREE.CanvasTexture(pCv); pTex.colorSpace = THREE.SRGBColorSpace; pTex.anisotropy = 4;
  add(src, new THREE.PlaneGeometry(2.5, 4.25), new THREE.MeshBasicMaterial({ map: pTex, toneMapped: false }), 0, 5.575, 3.135).castShadow = false;
  let panelKey = '';
  const drawPanel = ({ power, I, U, vd, prog, trig, arc }) => {
    const key = `${power}|${Math.round(I)}|${U.toFixed(1)}|${vd.toFixed(1)}|${prog}|${trig}|${arc}`;
    if (key === panelKey) return; panelKey = key;
    const g = pCv.getContext('2d');
    g.fillStyle = '#d8ccae'; g.fillRect(0, 0, 500, 850);
    g.fillStyle = '#c8262b'; g.fillRect(0, 0, 500, 46); g.fillStyle = '#fff'; g.font = 'italic bold 34px Barlow, Arial'; g.fillText('Fronius', 18, 35);
    g.fillStyle = '#2b2b2b'; g.font = 'bold 20px Barlow, Arial'; g.fillText('TRANSPULS SYNERGIC  TPS 450', 18, 82);
    // displeje: vľavo A / m/min, vpravo V
    const disp = (x, txt, unit) => {
      g.fillStyle = '#1b0d0d'; g.fillRect(x, 104, 200, 86);
      g.fillStyle = power ? '#ff3b2f' : '#4a2522'; g.font = 'bold 58px "Share Tech Mono", Consolas, monospace'; g.fillText(power ? txt : '', x + 12, 168);
      g.fillStyle = '#2b2b2b'; g.font = 'bold 17px Barlow, Arial'; g.fillText(unit, x + 6, 212);
    };
    disp(30, arc ? String(Math.round(I)).padStart(3, ' ') : vd.toFixed(1).padStart(4, ' '), arc ? 'A' : 'm/min');
    disp(270, U.toFixed(1).padStart(4, ' '), 'V');
    // kontrolky procesov a režimu horáka
    const led = (x, y, on, txt) => { g.fillStyle = power && on ? '#3ee06c' : '#5a5a52'; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2b2b2b'; g.font = 'bold 16px Barlow, Arial'; g.fillText(txt, x + 18, y + 6); };
    led(40, 262, prog === 'std', 'SYNERGIC STANDARD'); led(40, 296, prog === 'pulse', 'SYNERGIC PULS');
    led(290, 262, trig === '2T', '2-TAKT'); led(290, 296, trig === '4T', '4-TAKT');
    g.fillStyle = '#2b2b2b'; g.font = 'bold 15px Barlow, Arial';
    g.fillText('PROZESS', 28, 352); g.fillText('BETRIEBSART', 280, 352); g.fillText('DRAHTVORSCHUB', 288, 452); g.fillText('LICHTBOGEN-', 288, 552); g.fillText('LÄNGENKORREKTUR', 288, 570);
    g.fillText('NETZ', 214, 728); g.fillText('0', 166, 690); g.fillText('I', 324, 690);
    g.strokeStyle = '#8d846c'; g.lineWidth = 2; g.strokeRect(14, 96, 472, 280);
  };
  // gombíky (rýchlosť drôtu, korekcia oblúka), tlačidlá procesov, hlavný vypínač, zásuvky
  const knob = (x, y, r = 0.2) => {
    const pv = new THREE.Group(); pv.position.set(x, y, 3.16); src.add(pv);
    cylZ(pv, r, r * 0.9, 0, 0.14, 0, 0, M.black, 28); add(pv, new THREE.BoxGeometry(0.04, r * 0.8, 0.02), M.white, 0, r * 0.45, 0.15);
    hitProxy(pv, r + 0.12, 0, 0, 0.1); return pv;
  };
  const knobVd = knob(0.62, 6.0), knobCorr = knob(0.62, 5.0);
  const pbtn = (x, y) => { const g = new THREE.Group(); g.position.set(x, y, 3.14); src.add(g); box(g, -0.13, 0.13, -0.08, 0.08, 0, 0.06, R.grey); hitProxy(g, 0.2, 0, 0, 0.05); return g; };
  const btnProg = pbtn(-0.75, 5.75), btnTrig = pbtn(0.3, 5.75);
  const mainSw = new THREE.Group(); mainSw.position.set(0, 4.25, 3.16); src.add(mainSw);
  cylZ(mainSw, 0.3, 0.3, -0.03, 0.03, 0, 0, M.yellow, 28); box(mainSw, -0.07, 0.07, -0.32, 0.32, 0.03, 0.16, M.red);
  const sockets = [-0.75, 0.75].map((x) => { cylZ(src, 0.15, 0.15, 3.13, 3.23, x, 3.75, M.black, 24); cylZ(src, 0.06, 0.06, 3.23, 3.24, x, 3.75, M.copper, 16); return v3(x, 3.75, 3.24); });

  // ---------- podávač drôtu VR s cievkou (bočný kryt priehľadný) ----------
  const vr = grp('podavac', wel);
  box(vr, -0.3, 0.3, 7.9, 8.15, -0.3, 0.3, R.dark);                     // otočný čap
  box(vr, -1.3, 1.3, 8.15, 8.3, -2.8, 3.0, R.red); box(vr, -1.3, 1.3, 11.25, 11.4, -2.8, 3.0, R.red);
  box(vr, -1.3, 1.3, 8.3, 11.25, 2.85, 3.0, R.red); box(vr, -1.3, 1.3, 8.3, 11.25, -2.8, -2.65, R.red);
  box(vr, -1.3, -1.15, 8.3, 11.25, -2.65, 2.85, R.red);
  const cover = box(vr, 1.28, 1.3, 8.3, 11.25, -2.65, 2.85, R.plastic); cover.castShadow = false;
  cylX(vr, 1.55, 1.55, -0.95, -0.85, 9.8, -0.6, M.black, 40); cylX(vr, 1.55, 1.55, 0.75, 0.85, 9.8, -0.6, M.black, 40);   // bočnice cievky
  const spool = cylX(vr, 1.25, 1.25, -0.85, 0.75, 9.8, -0.6, R.wire, 40);
  cylX(vr, 0.35, 0.35, -1.15, 1.0, 9.8, -0.6, R.grey, 16);
  box(vr, -0.4, 0.4, 8.7, 9.4, 1.6, 2.6, R.grey);                       // podávacie kladky
  [9.15, 8.95].forEach((y) => cylX(vr, 0.16, 0.16, -0.25, 0.25, y, 2.1, M.steel, 20));
  const feedRolls = vr.children.slice(-2);
  cylZ(vr, 0.2, 0.2, 3.0, 3.25, 0, 9.0, M.black, 24); cylZ(vr, 0.11, 0.11, 3.25, 3.32, 0, 9.0, R.brass, 16);   // centrálna prípojka horáka
  // nápis VR
  const vrCv = document.createElement('canvas'); vrCv.width = 256; vrCv.height = 96;
  { const g = vrCv.getContext('2d'); g.fillStyle = '#d8ccae'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#c8262b'; g.font = 'italic bold 40px Barlow, Arial'; g.fillText('VR 4000', 20, 62); }
  const vrTex = new THREE.CanvasTexture(vrCv); vrTex.colorSpace = THREE.SRGBColorSpace;
  add(vr, new THREE.PlaneGeometry(1.4, 0.52), new THREE.MeshStandardMaterial({ map: vrTex, roughness: 0.6 }), 0, 10.5, 3.01).castShadow = false;

  // ---------- plynová fľaša s redukčným ventilom a prietokomerom ----------
  const fl = grp('flasa', wel);
  cylY(fl, 1.15, 1.15, 0.78, 12.0, 0, -5.0, R.cyl, 36);
  add(fl, new THREE.SphereGeometry(1.15, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), R.shoulder, 0, 12.0, -5.0);   // rameno fľaše: farba podľa plynu
  cylY(fl, 0.32, 0.28, 13.05, 13.5, 0, -5.0, R.brass, 20);
  [[3.3], [8.6]].forEach(([y]) => { const ch = add(fl, new THREE.TorusGeometry(1.2, 0.04, 6, 40), M.steel, 0, y, -5.0); ch.rotation.x = Math.PI / 2; });   // reťaze
  const valve = new THREE.Group(); valve.position.set(0, 13.6, -5.0); fl.add(valve);   // ručné koleso ventilu (os Y)
  const vWheel = new THREE.Group(); valve.add(vWheel); vWheel.rotation.x = -Math.PI / 2;
  add(vWheel, new THREE.TorusGeometry(0.28, 0.05, 8, 24), M.black); cylZ(vWheel, 0.07, 0.07, -0.05, 0.05, 0, 0, M.black, 12); hitProxy(vWheel, 0.4, 0, 0, 0);
  // redukčný ventil s dvoma manometrami a prietokomerom
  cylZ(fl, 0.14, 0.14, -5.0, -4.3, 0, 13.2, R.brass, 16);
  [[-0.38, 13.55], [0.38, 13.55]].forEach(([x, y]) => { cylZ(fl, 0.3, 0.3, -4.45, -4.3, x, y, R.brass, 24); cylZ(fl, 0.26, 0.26, -4.3, -4.28, x, y, R.gauge, 24); });
  const flowTube = cylY(fl, 0.09, 0.09, 12.45, 13.15, 0.0, -4.25, R.plastic, 16); flowTube.castShadow = false;
  const flowBall = add(fl, new THREE.SphereGeometry(0.07, 12, 8), M.red, 0, 12.5, -4.25);
  // hadice: plyn do podávača, prepojovací zväzok zdroj – podávač, sieťový kábel
  const flasaW = (x, y, z) => { wel.updateMatrixWorld(true); return fl.localToWorld(v3(x, y, z)); };
  const vrW = (x, y, z) => { wel.updateMatrixWorld(true); return vr.localToWorld(v3(x, y, z)); };
  wel.updateMatrixWorld(true);
  const gasHose = new THREE.CatmullRomCurve3([flasaW(0, 12.45, -4.25), flasaW(0, 11.6, -3.6), vrW(-0.4, 10.6, -3.6), vrW(-0.4, 10.2, -2.8)]);
  add(wel.parent, new THREE.TubeGeometry(gasHose, 24, 0.045, 8, false), M.blue).castShadow = false;
  const inter = new THREE.CatmullRomCurve3([src.localToWorld(v3(0.6, 7.2, -3.1)), src.localToWorld(v3(0.9, 6.2, -3.9)), vr.localToWorld(v3(0.5, 8.8, -3.4)), vr.localToWorld(v3(0.5, 9.0, -2.8))]);
  add(wel.parent, new THREE.TubeGeometry(inter, 30, 0.12, 10, false), M.cable);

  const sockW = [vr.localToWorld(v3(0, 9.0, 3.32)), src.localToWorld(sockets[1].clone())];
  const setGas = (gas) => { R.shoulder.color.setHex(gas === 'C1' ? 0x7d8386 : 0x45b04d).convertSRGBToLinear(); };
  // každý snímok: kladky a cievka sa točia pri podávaní, gulička prietokomera ukazuje prietok
  let spin = 0;
  const update = (dt, { feed, flow, valveOpen }) => {
    if (feed > 0) { spin += feed * dt; spool.rotation.x = -spin * 0.6; feedRolls.forEach((r, i) => { r.rotation.x = (i ? 1 : -1) * spin * 6; }); }
    vWheel.rotation.z = valveOpen ? -1.6 : 0;
    flowBall.position.y = 12.5 + Math.min(1, flow / 25) * 0.58;
  };
  return { wel, src, sockW, knobVd, knobCorr, btnProg, btnTrig, mainSw, vWheel, drawPanel, setGas, update, anchors: {
    zdroj: () => src.localToWorld(v3(0, 8.0, 1.0)), podavac: () => vr.localToWorld(v3(0, 11.6, 0)), chladenie: () => fk.localToWorld(v3(0, 3.4, 2.5)), flasa: () => fl.localToWorld(v3(0, 14.0, -5.0)),
  }, panelView: () => src.localToWorld(v3(0, 5.6, 3.1)) };
}
