import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { L } from '../core/i18n';
import { createInspector } from '../core/inspector';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { createSound } from '../core/sound';
import { HelpFooter, PartsSection, SceneView, SegRow, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';
import { interpret } from './cnc/gcode';
import { MODELS } from './cnc/kin';
import { programTime } from './cnc/motion';
import { SAMPLES } from './cnc/programs';
import { createExecutor } from './cnc/sim';
import { MATERIALS, defaultTools } from './cnc/tooling';
import { createStock } from './cnc/voxel';

// =====================================================================
// 5-OSÉ OBRÁBACIE CENTRUM HERMLE C 32 – CNC program, 5-osá kinematika a úber materiálu
// =====================================================================
// mierka scény 1 = 100 mm. Scéna: x = X stroja, y hore, z = −Y stroja (k obsluhe). Otočný bod (os A ∩ os C) je
// v (0, PY, 0); plocha stola pri A = 0 je 100 mm pod ním (výška nakladania 950 mm). Základný stroj bez prídavných zariadení.
const PY0 = 10.5, U = 0.01;
const FIX = { r: 35, h: 50 };                         // nulový upínací systém pod polotovarom
const hermleParts = () => mkParts([
  ['kabina', 'Kabína', 'Cabin', 'Kabína s posuvnými dverami', 'Cabin with sliding doors', 'Uzavretý pracovný priestor s veľkými oknami. Dvere majú bezpečnostný zámok – pri otvorených dverách sa program nespustí a posuv sa zastaví.', 'Enclosed working area with large windows. The doors are interlocked – with the doors open the program does not start and the feed stops.'],
  ['lozko', 'Lôžko', 'Bed', 'Lôžko z minerálneho liatia', 'Mineral-cast bed', 'Masívne lôžko z minerálneho liatia tlmí chvenie. Os A stola je uložená priamo v lôžku.', 'The massive mineral-cast bed damps vibration. The table A axis is mounted directly in the bed.'],
  ['osi', 'Osi X Y Z', 'X Y Z axes', 'Upravený portál – osi nad pracovným priestorom', 'Modified gantry – axes above the working area', 'Všetky tri lineárne osi nesie nástroj: priečnik Y jazdí po dvoch vedeniach na stenách lôžka, sane X po priečniku a smykadlo Z zvisle. Dráhy 650 × 650 × 500 mm, rýchloposuv 45 / 45 / 40 m/min.', 'The tool carries all three linear axes: the Y cross-beam runs on two guideways on the bed walls, the X slide on the cross-beam and the Z ram vertically. Travels 650 × 650 × 500 mm, rapid traverse 45 / 45 / 40 m/min.'],
  ['vreteno', 'Vreteno', 'Spindle', 'Motorové vreteno HSK-A63', 'HSK-A63 motor spindle', '18 000 ot/min, 42 kW / 148 Nm (20 % ED). Nástroj sa upína do kužeľa HSK-A63.', '18,000 rpm, 42 kW / 148 Nm (20 % duty). The tool is clamped in an HSK-A63 taper.'],
  ['stol', 'Stôl A / C', 'A / C table', 'Otočno-sklopný stôl Ø650 × 540 mm', 'Swivelling rotary table Ø650 × 540 mm', 'Os A sklápa stôl ±130° okolo osi X, os C ho otáča o 360°. Os A leží v obrobku (stôl tvaru U) – pri sklopení sa obrobok málo vychýli.', 'The A axis swivels the table ±130° about X, the C axis rotates it 360°. The A axis lies within the workpiece (U-shaped table) – the workpiece moves little when swivelled.'],
  ['zasobnik', 'Zásobník', 'Magazine', 'Pick-up zásobník 36 miest', '36-pocket pick-up magazine', 'Zásobník je integrovaný v lôžku za pracovným priestorom. Vreteno si nástroj vezme samo, výmena trvá asi 4,5 s.', 'The magazine is integrated in the bed behind the working area. The spindle picks the tool itself, a change takes about 4.5 s.'],
  ['panel', 'Ovládací panel', 'Control panel', 'Riadiaci systém Heidenhain TNC 640', 'Heidenhain TNC 640 control', 'Otočný ovládací panel s 19" dotykovou obrazovkou. Simulátor číta programy ISO (G-kód) aj Heidenhain Klartext.', 'Swivelling control panel with a 19" touch screen. The simulator reads ISO (G-code) and Heidenhain conversational programs.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Polotovar na upínači', 'Blank on the fixture', 'Polotovar na nulovom upínacom systéme. Nulový bod G54 je v strede hornej plochy.', 'The blank on the zero-point clamping system. Datum G54 is at the centre of the top face.'],
]);
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function HermleCore({ onBack, model, setModel, text, setText, tools, setTools, progId, setProgId }) {
  const MC = MODELS[model] || MODELS.c32;
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null), fileRef = useRef(null);
  const init = { door: true, cabin: true, speed: 5, fo: 100, ro: 100, single: false, mat: 'al', sx: 100, sy: 80, sz: 40, res: 0.7, labels: false, manual: false };
  const { ctl, ui, set, selected, selectPart, apiRef } = useMachine(init);
  const samples = SAMPLES();
  const [check, setCheck] = useState({ errors: [], warns: [], time: 0, dialect: 'iso', toolDefs: [], stock: null, n: 0 });
  const [tele, setTele] = useTele({ run: false, paused: false, done: false, alarm: null, line: 0, X: 0, Y: 0, Z: 0, A: 0, C: 0, wx: 0, wy: 0, wz: 0, T: 0, S: 0, F: 0, load: 0, mrr: 0, t: 0, removed: 0, busy: false, building: false, maxLoad: 0 });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
    const snd = createSound('mill');
    if (scene.fog) { scene.fog.near = 90; scene.fog.far = 200; }
    const dom = renderer.domElement;
    const std = (col, rough = 0.5, metal = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(col).convertSRGBToLinear(), roughness: rough, metalness: metal, ...extra });
    const M = {
      cab: std(0xe6e8ea, 0.55, 0.1), cab2: std(0xc9cdd1, 0.5, 0.15), dark: std(0x2c3035, 0.7, 0.15), anth: std(0x3a3f45, 0.6, 0.2),
      steel: std(0xb9bec4, 0.28, 0.85), steelD: std(0x6d737a, 0.35, 0.8), inox: std(0xc4c8cc, 0.32, 0.75), table: std(0xd3d6d9, 0.38, 0.55),
      red: std(0xd8202a, 0.4, 0.2), black: std(0x141618, 0.6, 0.2), glass: new THREE.MeshStandardMaterial({ color: 0xbfd6e6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
      tool: std(0x7b8087, 0.3, 0.9), coat: std(0xb08a3c, 0.3, 0.85), holder: std(0x9aa0a6, 0.25, 0.9),
    };
    const root = new THREE.Group(); scene.add(root);
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const box = (p, xa, xb, y0, y1, z0, z1, m) => { const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb); const me = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); me.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); me.castShadow = true; me.receiveShadow = true; p.add(me); return me; };
    const cylY = (p, r0, r1, y0, y1, x, z, m, s = 32) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, s), m); me.position.set(x, (y0 + y1) / 2, z); me.castShadow = true; p.add(me); return me; };
    const cylX = (p, r, xa, xb, y, z, m, s = 40) => { const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb); const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, s), m); me.rotation.z = Math.PI / 2; me.position.set((x0 + x1) / 2, y, z); me.castShadow = true; p.add(me); return me; };
    const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const g = cv.getContext('2d'); const redraw = () => { draw(g, w, h); tx.needsUpdate = true; }; redraw(); return { tx, redraw, g }; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // geometria je kreslená v rozmeroch C 32; väčší model sa zväčší mierkou K (pohyby osí sú v skutočných mm)
    const K = MC.K, PY = PY0 * K;
    const sc = (parent) => { const g = new THREE.Group(); g.scale.setScalar(K); parent.add(g); return g; };
    M.win = std(0x1d2329, 0.15, 0.4); M.yellow = std(0xf2c230, 0.5, 0.1); M.brush = std(0xc2c6ca, 0.38, 0.7);
    // ---------------- lôžko z minerálneho liatia a steny s vedeniami Y ----------------
    const bed = sc(grp('lozko'));
    [[-8.6, -9.6], [8.6, -9.6], [-8.6, 7.4], [8.6, 7.4]].forEach(([x, z]) => box(bed, x - 0.9, x + 0.9, 0, 0.7, z - 0.9, z + 0.9, M.black));
    box(bed, -10, 10, 0.7, 6.2, -11, 8.0, M.dark);
    [-1, 1].forEach((s) => {
      box(bed, s * 6.9, s * 9.6, 6.2, 20.8, -11, 3.2, M.anth);                                    // stena lôžka
      box(bed, s * 7.6, s * 8.6, 20.8, 21.2, -11, 3.2, M.steelD);                                  // vedenie Y
      cylX(bed, 2.1, s * 6.4, s * 6.9, PY0, 0, M.table, 48);                                      // príruba osi A
      cylX(bed, 1.2, s * 9.6, s * 10.6, PY0, 0, M.steelD, 32);                                    // pohon osi A (tandem)
    });
    box(bed, -6.9, 6.9, 6.2, 7.2, -11, 3.2, M.inox);                                               // dno pracovného priestoru (nerez)
    box(bed, -6.9, 6.9, 7.2, 19, -11, -10.5, M.inox);                                              // zadná stena
    box(bed, -6.9, 6.9, 7.2, 13.9, -3.55, -3.4, M.inox);                                           // deliaca stena pred zásobníkom
    // ---------------- otočno-sklopný stôl A / C ----------------
    const tab = grp('stol');
    const aG = new THREE.Group(); aG.position.set(0, PY, 0); tab.add(aG);
    const cr = sc(aG);
    [-1, 1].forEach((s) => {
      box(cr, s * 4.4, s * 6.3, -3.4, 0.8, -2.0, 2.0, M.table); cylX(cr, 2.0, s * 4.4, s * 6.4, 0, 0, M.table, 40);
      const fr = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.32, 12, 56), M.steel); fr.rotation.y = Math.PI / 2; fr.position.set(s * 6.05, 0, 0); fr.castShadow = true; cr.add(fr);   // prstencová príruba osi A
    });
    box(cr, -4.6, 4.6, -3.6, -1.55, -3.0, 3.0, M.table);                                           // vaňa stola (U)
    cylY(cr, 3.0, 3.0, -1.75, -1.55, 0, 0, M.steelD, 56);
    const cG = new THREE.Group(); cG.position.y = -MC.hA * U; aG.add(cG);
    const cT = sc(cG);
    // plocha stola: radiálne T-drážky, sústredné rysky a uhlová stupnica na obvode (ako na predlohe)
    const top = tex(512, 512, (g, w) => {
      const c0 = w / 2; g.fillStyle = '#b9bec3'; g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(70,76,82,.45)'; g.lineWidth = 1.5; for (let r = 30; r < 240; r += 15) { g.beginPath(); g.arc(c0, c0, r, 0, Math.PI * 2); g.stroke(); }
      g.strokeStyle = '#4b5157'; g.lineWidth = 2; for (let d = 0; d < 360; d += 5) { const a = d * Math.PI / 180, r1 = d % 10 ? 246 : 240; g.beginPath(); g.moveTo(c0 + Math.cos(a) * r1, c0 + Math.sin(a) * r1); g.lineTo(c0 + Math.cos(a) * 252, c0 + Math.sin(a) * 252); g.stroke(); }
      g.fillStyle = '#8a9096'; g.beginPath(); g.arc(c0, c0, 22, 0, Math.PI * 2); g.fill();
    });
    const tdisc = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.22, 72), [M.table, new THREE.MeshStandardMaterial({ map: top.tx, roughness: 0.32, metalness: 0.7 }), M.table]);
    tdisc.position.y = -0.11; tdisc.receiveShadow = true; cT.add(tdisc);
    for (let i = 0; i < 12; i++) { const sl = box(cT, 0.45, 3.1, -0.02, 0.003, -0.065, 0.065, M.steelD); sl.position.x = 0; sl.geometry.translate(1.775, 0, 0); sl.rotation.y = i * Math.PI / 6; }
    cylY(cG, FIX.r * U * 1.35, FIX.r * U * 1.35, 0, 0.22, 0, 0, M.steelD, 40);                     // nulový upínací systém
    cylY(cG, FIX.r * U, FIX.r * U, 0.22, FIX.h * U, 0, 0, M.anth, 40);
    // ---------------- portál: priečnik Y, sane X, smykadlo Z, vreteno ----------------
    const ax = grp('osi');
    const yG = new THREE.Group(); ax.add(yG);
    const yS = sc(yG);
    box(yS, -8.8, 8.8, 21.2, 23.0, -1.7, 1.7, M.cab2);                                             // priečnik Y
    box(yS, -8.8, 8.8, 23.0, 23.1, -1.7, 1.7, M.steelD);
    // lamelové nerezové kryty osi X vľavo a vpravo od smykadla (skracujú / predlžujú sa)
    const rib = tex(256, 64, (g, w, h) => { g.fillStyle = '#c3c8cd'; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 64) { g.fillStyle = '#9aa1a8'; g.fillRect(i, 0, 3, h); g.fillStyle = '#e1e4e7'; g.fillRect(i + 3, 0, 24, h); g.fillStyle = '#3f454b'; for (let y = 6; y < h; y += 14) g.fillRect(i + 8, y, 2, 2); } });   // nerezové lamely s nitmi
    rib.tx.wrapS = THREE.RepeatWrapping;
    const covers = [0, 1].map(() => { const tx = rib.tx.clone(); tx.needsUpdate = true; const me = new THREE.Mesh(new THREE.BoxGeometry(1, 8.6, 0.08), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.3, metalness: 0.75 })); me.position.set(0, 18.4, 1.78); yS.add(me); return me; });
    const xG = new THREE.Group(); yG.add(xG);
    const xS = sc(xG);
    box(xS, -1.9, 1.9, 20.0, 23.6, -2.0, 2.0, M.cab);                                              // sane X
    const zG = new THREE.Group(); xG.add(zG);
    const zS = sc(zG);
    box(zS, -1.25, 1.25, 0.9, 13.0, -1.25, 1.25, M.inox);                                          // smykadlo Z (počiatok = čelo vretena)
    const sp = grp('vreteno', zG);
    cylY(sp, 0.78, 0.78, 0.05, 0.9 * K, 0, 0, M.steel, 40);
    cylY(sp, 0.55, 0.78, 0, 0.05, 0, 0, M.steelD, 40);
    const toolG = new THREE.Group(); sp.add(toolG);
    const buildTool = (t) => {
      while (toolG.children.length) { const o = toolG.children.pop(); o.geometry.dispose(); }
      if (!t) return;
      const add = (geo, m, y) => { const me = new THREE.Mesh(geo, m); me.position.y = y; me.castShadow = true; toolG.add(me); return me; };
      const R = t.d / 2 * U, l = t.l * U, s = t.s * U, lc = t.lc * U, dh = t.dh / 2 * U, rs = Math.min(t.d, 20) / 2 * U;
      add(new THREE.CylinderGeometry(0.32, 0.36, 0.3, 32), M.steelD, -0.15);
      add(new THREE.CylinderGeometry(dh, Math.min(dh * 1.25, 0.42), l - s - 0.3, 32), M.holder, -0.3 - (l - s - 0.3) / 2);
      if (s - lc > 0.001) add(new THREE.CylinderGeometry(rs, rs, s - lc, 24), M.tool, -(l - s) - (s - lc) / 2);
      if (t.kind === 'cone') {
        const hc = R / Math.tan((t.tip || 118) * Math.PI / 360);
        add(new THREE.CylinderGeometry(R, R, lc - hc, 24), M.coat, -l + hc + (lc - hc) / 2);
        add(new THREE.ConeGeometry(R, hc, 24), M.coat, -l + hc / 2).rotation.x = Math.PI;
      } else {
        const crr = Math.min(t.cr || 0, t.d / 2) * U;
        add(new THREE.CylinderGeometry(R, R, lc - crr, 28), M.coat, -l + crr + (lc - crr) / 2);
        if (crr >= R - 1e-6) add(new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.coat, -l + R);
        else if (crr > 0) { const to = add(new THREE.TorusGeometry(R - crr, crr, 10, 28), M.coat, -l + crr); to.rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(R - crr, R - crr, 0.002, 28), M.coat, -l + 0.001); }
        else add(new THREE.CylinderGeometry(R, R, 0.002, 28), M.coat, -l + 0.001);
      }
    };
    // ---------------- pick-up zásobník za pracovným priestorom ----------------
    const mag = grp('zasobnik');
    const magG = new THREE.Group(); magG.position.set(0, 15.6 * K, -5.6 * K); magG.scale.setScalar(K); mag.add(magG);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.09, 8, 72), M.steelD); ring.rotation.x = Math.PI / 2; magG.add(ring);
    const pockets = [];
    for (let i = 0; i < MC.mag; i++) {
      const a = i / MC.mag * Math.PI * 2, g = new THREE.Group(); g.position.set(Math.sin(a) * 2.4, 0, Math.cos(a) * 2.4); magG.add(g);
      const fork = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.5), M.red); g.add(fork);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.19, 0.7, 16), M.holder); h.position.y = -0.4; g.add(h);
      const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 10), M.coat); tt.position.y = -1.05; g.add(tt);
      pockets.push(g);
    }
    // ---------------- kabína: čelo podľa predlohy (široký spodný a podľa modelu užší horný otvor) ----------------
    const cab = grp('kabina'), cabS = sc(cab), uw = MC.upperW;
    [-1, 1].forEach((s) => {                                                                       // bočné panely s oknom
      box(cabS, s * 9.6, s * 11.4, 0.7, 9, -12, 8.2, M.cab); box(cabS, s * 9.6, s * 11.4, 21, 26, -12, 8.2, M.cab);
      box(cabS, s * 9.6, s * 11.4, 9, 21, -12, -9, M.cab); box(cabS, s * 9.6, s * 11.4, 9, 21, 5, 8.2, M.cab);
    });
    box(cabS, -11.4, 11.4, 26, 26.4, -12, 8.6, M.cab2);                                            // strecha
    box(cabS, -11.4, 11.4, 0.7, 26.4, -12.4, -12, M.cab);                                          // zadná stena
    box(cabS, -3.6, 3.6, 26.4, 29.6, -4.2, 1.2, M.cab2); box(cabS, -3.7, 3.7, 29.6, 29.8, -4.3, 1.3, M.steelD);   // nadstavba pohonu Z
    box(cabS, -11.4, 11.4, 0.7, 2.2, 8.2, 9.3, M.cab2);                                            // svetlý sokel
    box(cabS, -11.4, 11.4, 2.2, 6.4, 8.2, 8.6, M.dark);                                            // tmavý pás
    box(cabS, -4.4, 4.4, 2.6, 6.2, 8.6, 8.72, M.cab2); box(cabS, -3.6, 3.6, 4.1, 4.35, 8.72, 8.76, M.dark);   // spodný kryt so žliabkom
    [-1, 1].forEach((s) => box(cabS, s * 4.4, s * 11.4, 6.4, 26, 8.2, 8.6, M.cab));                // čelné panely
    if (uw < 4.39) [-1, 1].forEach((s) => box(cabS, s * uw, s * 4.4, 14.2, 23.6, 8.2, 8.6, M.cab)); // užší horný otvor (C 32)
    box(cabS, -4.4, 4.4, 23.6, 26, 8.2, 8.6, M.cab);                                               // nadpražie
    box(cabS, -9.0, -6.6, 9.5, 19.5, 8.6, 8.64, M.win); box(cabS, 6.0, 8.4, 9.5, 19.5, 8.6, 8.64, M.win);   // úzke tmavé okná
    box(cabS, 8.75, 9.0, 9.5, 19.5, 8.6, 8.66, M.red);                                             // červený pás
    const label = tex(512, 128, (g, w, h) => { g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8202a'; g.lineWidth = 16; g.beginPath(); g.arc(70, 64, 40, 0.5, Math.PI * 2 - 0.5); g.stroke(); g.fillStyle = '#5d6369'; g.font = 'bold 62px sans-serif'; g.textBaseline = 'middle'; g.fillText('HERMLE', 128, 66); });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: label.tx, roughness: 0.6 })); lab.position.set(-8.9, 21.4, 8.63); cabS.add(lab);
    const name = tex(128, 512, (g, w, h) => { g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#6b7178'; g.font = '78px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(MC.name, 0, 0); g.restore(); });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.8), new THREE.MeshStandardMaterial({ map: name.tx, roughness: 0.6 })); nm.position.set(9.6, 18.0, 8.63); cabS.add(nm);
    // posuvné dvere za čelom: v otvorenej polohe zostanú v otvore len červené rukoväte (ako na predlohe)
    const doors = [-1, 1].map((s) => {
      const d = new THREE.Group(); cabS.add(d);
      box(d, -2.2, 2.2, 0, 1.0, -0.08, 0.08, M.cab); box(d, -2.2, 2.2, 16.2, 17.2, -0.08, 0.08, M.cab);
      box(d, -2.2, -1.85, 1.0, 16.2, -0.08, 0.08, M.cab); box(d, 1.85, 2.2, 1.0, 16.2, -0.08, 0.08, M.cab);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 15.2), M.glass); win.position.set(0, 8.6, 0); d.add(win);
      const hx = -s * 1.95, hc = new THREE.CatmullRomCurve3([v3(hx, 2.6, 0.1), v3(hx - s * 0.25, 4.0, 0.5), v3(hx - s * 0.25, 7.4, 0.5), v3(hx, 8.8, 0.1)]);
      d.add(new THREE.Mesh(new THREE.TubeGeometry(hc, 24, 0.1, 10, false), M.red));
      d.userData.s = s; return d;
    });
    [-1, 1].forEach((s) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), M.glass); w.rotation.y = Math.PI / 2; w.position.set(s * 11.4, 15, -2); cabS.add(w); });
    // ---------------- ovládací panel TNC 640 (Hermle) na otočnom ramene ----------------
    const pan = grp('panel');
    const panG = new THREE.Group(); panG.position.set(13.3 * K, 0, 9.0 * K); panG.rotation.y = -0.42; panG.scale.setScalar(K); pan.add(panG);
    const col = new THREE.CatmullRomCurve3([v3(0.9, 0, -1.2), v3(1.2, 3.5, -1.0), v3(0.5, 7.6, -0.7), v3(0, 10.0, -0.5)]);
    panG.add(new THREE.Mesh(new THREE.TubeGeometry(col, 24, 0.34, 12, false), M.anth));
    box(panG, -2.4, 2.4, 10.0, 12.1, -1.2, 1.2, M.brush);                                          // pult s klávesnicou (brúsená nerez)
    box(panG, -2.3, 2.3, 9.4, 10.0, -1.0, 1.0, M.cab2);                                            // zásuvka
    box(panG, -2.4, 2.4, 12.2, 17.7, -0.55, 0.0, M.brush);                                         // obrazovková jednotka
    [-1, 1].forEach((s) => {                                                                       // červený rúrkový rám
      const rc = new THREE.CatmullRomCurve3([v3(s * 2.55, 9.9, 1.3), v3(s * 2.75, 11.6, 0.9), v3(s * 2.62, 14.6, 0.35), v3(s * 2.55, 17.9, 0.2)]);
      panG.add(new THREE.Mesh(new THREE.TubeGeometry(rc, 24, 0.11, 10, false), M.red));
    });
    const keys = tex(512, 230, (g, w, h) => {
      g.fillStyle = '#c4c8cc'; g.fillRect(0, 0, w, h);
      const key = (x, y, ww, col2) => { g.fillStyle = col2; g.fillRect(x, y, ww, 13); };
      for (let r = 0; r < 4; r++) for (let k = 0; k < 13; k++) key(30 + k * 18 + (r % 2) * 5, 18 + r * 18, 14, '#2a2f36');   // QWERTY
      key(70, 90, 150, '#2a2f36');
      ['#f0902a', '#f0902a', '#f0902a', '#f0902a', '#f0902a'].forEach((cc, i) => key(300, 14 + i * 18, 16, cc));                  // osi X Y Z IV V
      for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) key(326 + k * 20, 14 + r * 18, 16, r === 4 ? '#2a2f36' : '#eef0f2');   // číslice
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) key(130 + k * 22, 130 + r * 20, 18, '#e6e8ea');                     // funkcie
      for (let k = 0; k < 4; k++) key(20 + k * 22, 150, 18, '#2a2f36');
      g.strokeStyle = '#d8202a'; g.lineWidth = 5; g.beginPath(); g.arc(292, 200, 11, 0.5, Math.PI * 2 - 0.5); g.stroke();
      g.fillStyle = '#4d535a'; g.font = 'bold 15px sans-serif'; g.fillText('HERMLE', 308, 205);
    });
    const kp = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.1), new THREE.MeshStandardMaterial({ map: keys.tx, roughness: 0.55 })); kp.rotation.x = -Math.PI / 2 + 0.32; kp.position.set(0, 12.12, 0.0); panG.add(kp);
    [[-1.65, 0.55], [1.5, 0.62]].forEach(([x, z]) => { const kn = cylY(panG, 0.18, 0.18, 12.1, 12.32, x, z, M.black, 20); kn.rotation.x = 0.32; });   // korekcie posuvu a otáčok
    const eb = cylY(panG, 0.34, 0.34, 11.72, 11.8, -1.9, 0.85, M.yellow, 24); eb.rotation.x = 0.32; const es = cylY(panG, 0.22, 0.18, 11.8, 12.0, -1.9, 0.85, M.red, 24); es.rotation.x = 0.32;   // NOT-STOP
    box(panG, 2.45, 2.85, 10.2, 11.7, 0.2, 0.9, M.black); cylX(panG, 0.26, 2.85, 2.98, 10.6, 0.55, M.black, 20); cylX(panG, 0.12, 2.85, 2.95, 11.35, 0.55, M.red, 16);   // ručné koliesko HR
    const bezel = tex(256, 300, (g, w, h) => { g.fillStyle = '#bfc3c7'; g.fillRect(0, 0, w, h); g.fillStyle = '#9aa1a8'; for (let i = 0; i < 8; i++) { g.fillRect(8, 26 + i * 26, 16, 16); g.fillRect(w - 24, 26 + i * 26, 16, 16); } for (let k = 0; k < 9; k++) g.fillRect(34 + k * 22, h - 26, 16, 16); });
    const bz = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 5.4), new THREE.MeshStandardMaterial({ map: bezel.tx, roughness: 0.55 })); bz.position.set(0, 14.95, 0.01); panG.add(bz);
    let scr = null;
    const screen = tex(640, 460, (g, w, h) => {
      g.fillStyle = '#0d1a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f6fbf'; g.fillRect(0, 0, w, 34);
      g.fillStyle = '#fff'; g.font = 'bold 18px monospace'; g.fillText(`HEIDENHAIN · ${scr ? scr.title : 'TNC 640'}`, 12, 23);
      if (!scr) return;
      g.font = '17px monospace';
      scr.lines.forEach((ln, i) => { if (ln.cur) { g.fillStyle = '#ffd34d'; g.fillRect(8, 48 + i * 24, 384, 22); g.fillStyle = '#10202f'; } else g.fillStyle = '#b8c7d8'; g.fillText(ln.t.slice(0, 36), 12, 64 + i * 24); });
      g.fillStyle = '#16304a'; g.fillRect(404, 44, 228, 340); g.font = '18px monospace';
      scr.pos.forEach(([k, v], i) => { g.fillStyle = '#7fd1ff'; g.fillText(k, 414, 74 + i * 38); g.fillStyle = '#ffffff'; g.fillText(v, 446, 74 + i * 38); });
      g.fillStyle = scr.alarm ? '#ff5a4f' : '#59d17b'; g.fillRect(0, h - 40, w, 40); g.fillStyle = '#0d1a2a'; g.font = 'bold 17px sans-serif'; g.fillText(scr.status.slice(0, 64), 12, h - 14);
    });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.8), new THREE.MeshBasicMaterial({ map: screen.tx, toneMapped: false })); sm.position.set(0, 15.25, 0.03); panG.add(sm);
    // ---------------- osvetlenie pracovného priestoru ----------------
    const lamp = new THREE.PointLight(0xffffff, 18, 18 * K, 1.6); lamp.position.set(0, 19 * K, 3 * K); scene.add(lamp);

    // ---------------- polotovar (voxely) ----------------
    const stockG = grp('obrobok', cG); stockG.rotation.x = -Math.PI / 2; stockG.scale.setScalar(U);
    const meshes = new Map();
    let stock = null, mat = null;
    const clearStock = () => { meshes.forEach((me) => { stockG.remove(me); me.geometry.dispose(); }); meshes.clear(); };
    const applyChunks = (parts) => {
      parts.forEach((p) => {
        let me = meshes.get(p.id);
        if (!p.idx.length) { if (me) { stockG.remove(me); me.geometry.dispose(); meshes.delete(p.id); } return; }
        const geo = new THREE.BufferGeometry(), M2 = MATERIALS[c.mat] || MATERIALS.al, col = new Float32Array(p.raw.length * 3);
        for (let i = 0; i < p.raw.length; i++) { const cc = p.raw[i] ? M2.raw : M2.rgb; col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2]; }
        geo.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(p.nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setIndex(new THREE.BufferAttribute(p.idx, 1)); geo.computeBoundingSphere();
        if (me) { me.geometry.dispose(); me.geometry = geo; } else { me = new THREE.Mesh(geo, mat); me.receiveShadow = true; me.userData.part = 'obrobok'; stockG.add(me); meshes.set(p.id, me); }
      });
    };

    // ---------------- program a vykonávanie ----------------
    let prog = null, ex = null, toolsNow = [], o54 = [0, 0, 90], curT = -1, stockMin = null, stockMax = null, maxLoad = 0, msg = null;
    const stockCfg = () => {
      if (prog && prog.stock) {
        const s = prog.stock, sx = s.max[0] - s.min[0], sy = s.max[1] - s.min[1], sz = s.max[2] - s.min[2];
        return { sx, sy, sz, off: [-(s.min[0] + s.max[0]) / 2, -(s.min[1] + s.max[1]) / 2, FIX.h - s.min[2]] };
      }
      return { sx: c.sx, sy: c.sy, sz: c.sz, off: [0, 0, FIX.h + c.sz] };
    };
    const buildStock = () => {
      const s = stockCfg(); o54 = s.off;
      stockMin = [-s.sx / 2, -s.sy / 2, FIX.h]; stockMax = [s.sx / 2, s.sy / 2, FIX.h + s.sz];
      const M2 = MATERIALS[c.mat] || MATERIALS.al;
      if (mat) mat.dispose();
      mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: M2.rough, metalness: M2.metal, side: THREE.FrontSide });
      clearStock(); stock = createStock({ min: stockMin, max: stockMax, res: c.res });
      applyChunks(stock.takeDirty());
    };
    const load = (txt, tls) => {
      toolsNow = tls;
      prog = interpret(txt, { o54: [0, 0, 0], tools: tls, mach: MC });                        // najprv kvôli BLK FORM
      buildStock();
      prog = interpret(txt, { o54, tools: tls, mach: MC });
      ex = createExecutor({ moves: prog.moves, tools: tls, o54, stock, fixture: FIX, kc: (MATERIALS[c.mat] || MATERIALS.al).kc, mach: MC });
      maxLoad = 0; msg = null; curT = -1;
      return { errors: prog.errors, warns: prog.warns, time: programTime(prog.moves, o54, MC), dialect: prog.dialect, toolDefs: prog.toolDefs, stock: prog.stock, n: prog.moves.length };
    };
    apiRef.current.load = load;
    apiRef.current.start = () => {
      if (!ex) return 'noprog';
      if (c.door) { msg = L('Dvere sú otvorené – zatvor ich, potom spusti program.', 'The doors are open – close them, then start the program.'); return 'door'; }
      if (prog.errors.length) { msg = L(`Program má chyby (${prog.errors.length}) – oprav ich pred spustením.`, `The program has errors (${prog.errors.length}) – fix them before starting.`); return 'err'; }
      if (ex.S.alarm) { msg = L('Najprv potvrď alarm tlačidlom Reset.', 'Acknowledge the alarm with Reset first.'); return 'alarm'; }
      if (ex.S.done) return 'done';
      ex.S.paused = false; c.running = true; msg = null; return 'ok';
    };
    apiRef.current.hold = () => { c.running = false; };
    apiRef.current.ffwd = () => { if (!ex || ex.S.alarm || prog.errors.length || c.door) return; ex.S.paused = false; c.running = true; c.fast = true; };
    apiRef.current.snapshot = snapshot;
    apiRef.current.stl = () => {
      const parts = [];
      meshes.forEach((me) => parts.push(me.geometry));
      let n = 0; parts.forEach((g) => { n += g.index.count / 3; });
      const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf); dv.setUint32(80, n, true);
      let o = 84;
      parts.forEach((g) => {
        const p = g.attributes.position.array, ix = g.index.array;
        for (let i = 0; i < ix.length; i += 3) {
          const a = ix[i] * 3, b = ix[i + 1] * 3, d = ix[i + 2] * 3;
          const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], wx = p[d] - p[a], wy = p[d + 1] - p[a + 1], wz = p[d + 2] - p[a + 2];
          let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          [nx, ny, nz].forEach((v) => { dv.setFloat32(o, v, true); o += 4; });
          [a, b, d].forEach((q) => { dv.setFloat32(o, p[q] - o54[0], true); dv.setFloat32(o + 4, p[q + 1] - o54[1], true); dv.setFloat32(o + 8, p[q + 2] - o54[2], true); o += 12; });
          o += 2;
        }
      });
      return new Blob([buf], { type: 'model/stl' });
    };

    // ---------------- pohľady ----------------
    const toolTip = () => { const p = ex ? ex.S.pose.m : [0, MC.tcY, MC.nose[1]]; return v3(p[0] * U, PY + p[2] * U, -p[1] * U); };
    const anchors = {
      kabina: () => v3(-9.5 * K, 25 * K, 8.7 * K), lozko: () => v3(9.6 * K, 4 * K, 8.5 * K), osi: () => v3(8.8 * K, 23.1 * K, -1.7 * K + yG.position.z), vreteno: () => v3(xG.position.x + 1.3 * K, zG.position.y + 1.5 * K, yG.position.z + 1.3 * K),
      stol: () => v3(-6.3 * K, PY - 2.5 * K, 2.0 * K), zasobnik: () => v3(2.4 * K, 15.6 * K, -3.2 * K), panel: () => new THREE.Vector3(0, 17.8, 0).applyMatrix4(panG.matrixWorld), obrobok: () => toolTip().clone().setY(PY + 0.3),
    };
    const views = {
      celok: () => [[30 * K, 25 * K, 42 * K], [0, 12.5 * K, 0]],
      priestor: () => [[3.8 * K, PY + 4.1 * K, 7.0 * K], [0, PY - 0.2 * K, -0.4 * K], true],
      obrobok: () => [[1.5, PY + 1.0, 2.3], [0, PY - MC.hA * U + 0.75, 0], true],
      nastroj: () => { const t = toolTip(); return [[t.x + 1.9, t.y + 1.1, t.z + 2.6], [t.x, t.y - 0.15, t.z], true]; },
      zhora: () => [[0.01, 27 * K, 2.5 * K], [0, PY, 0], true],
    };
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      enabled: () => true, onPick: (k) => apiRef.current.onPick(k), blockPick: () => false, onHL: () => {},
    });
    apiRef.current.view = (n) => insp.goView(n, false);
    insp.goView('celok', true);

    // ---------------- triesky a chladenie ----------------
    const chips = createParticles(scene, new THREE.BoxGeometry(0.04, 0.012, 0.07), std(0xc9ced3, 0.3, 0.85), 220);
    const drops = createParticles(scene, new THREE.SphereGeometry(0.025, 5, 4), new THREE.MeshStandardMaterial({ color: 0xdfeaf2, roughness: 0.1, transparent: true, opacity: 0.7 }), 160, false);

    // ---------------- hlavná slučka ----------------
    let raf, last = performance.now(), teleT = 0, scrT = 0, doorK = c.door ? 1 : 0, magA = 0, spinA = 0, t = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // dvere: otvorenie počas chodu zastaví posuv (bezpečnostný zámok)
      if (c.door && c.running) { c.running = false; c.fast = false; msg = L('Dvere sa otvorili – posuv a vreteno zastavené.', 'The doors opened – feed and spindle stopped.'); }
      doorK += ((c.door ? 1 : 0) - doorK) * Math.min(1, dt * 4);
      doors.forEach((d) => { d.position.set(d.userData.s * (2.2 + doorK * 4.0), 6.4, 8.02); });
      const xc = xG.position.x / K;
      covers.forEach((me, i) => { const x0 = i ? xc + 1.95 : -6.9, x1 = i ? 6.9 : xc - 1.95, w = Math.max(0.05, x1 - x0); me.scale.x = w; me.position.x = (x0 + x1) / 2; me.material.map.repeat.set(w / 2.2, 1); });
      cab.visible = c.cabin;
      let busy = false;
      if (ex && c.running && !ex.S.alarm && !ex.S.done && !ex.S.paused) {
        const sp2 = c.fast ? 400 : c.speed, budget = c.fast ? 2.5e7 : 4e6;
        const ops = ex.advance(dt * sp2, { fo: c.fo / 100, ro: c.ro / 100, single: c.single, budget });
        busy = ops >= budget * 0.98;
        if (ex.S.alarm || ex.S.done || ex.S.paused) { c.running = false; c.fast = false; }
        maxLoad = Math.max(maxLoad, ex.S.load || 0);
      }
      if (stock) applyChunks(stock.takeDirty(c.fast ? 60 : 14, ex ? ex.S.pose.pT : null));
      // poloha osí
      const S = ex ? ex.S : null, p = S ? S.pose : { m: [0, MC.tcY, MC.nose[1]], a: 0, c: 0, pT: [0, 0, 0], vT: [0, 0, 1] };
      const T = S ? S.T : 0, tl = toolsNow.find((x) => x.t === T), Lt = tl ? tl.l : 0;
      if (T !== curT) { curT = T; buildTool(tl); pockets.forEach((pk, i) => { pk.visible = i + 1 !== T; }); }
      yG.position.z = -p.m[1] * U; xG.position.x = p.m[0] * U; zG.position.y = PY + (p.m[2] + Lt) * U;
      aG.rotation.x = p.a * Math.PI / 180; cG.rotation.y = p.c * Math.PI / 180;
      const spinOn = S && S.dir && S.spin > 0 && !S.alarm && (c.running || false);
      spinA += spinOn ? dt * Math.min(60, S.spin / 60 * 2 * Math.PI) * 0.15 * (S.dir || 1) : 0; toolG.rotation.y = spinA;
      magA += ((T ? -(T - 1) / MC.mag * Math.PI * 2 : 0) - magA) * Math.min(1, dt * 3); magG.rotation.y = magA;
      // triesky a emulzia pri reze
      const tipW = toolTip();
      if (S && S.cutting && c.running) {
        const n = Math.min(6, 1 + Math.floor((S.mrr || 0) / 60));
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sv = 2 + Math.random() * 3; chips.spawn(v3(tipW.x, tipW.y + 0.05, tipW.z), v3(Math.cos(a) * sv, 1 + Math.random() * 2.5, Math.sin(a) * sv), 2.2); }
      }
      if (S && S.cool && c.running) for (let i = 0; i < 3; i++) drops.spawn(v3(tipW.x + 0.9, tipW.y + 2.2, tipW.z + 0.4), v3(-1.6 + Math.random() * 0.4, -3.4, -0.7 + Math.random() * 0.4), 0.7, 8);
      chips.update(dt, () => 7.25); drops.update(dt, () => 7.25);
      snd.update({ motor: spinOn ? Math.min(1, S.spin / MC.smax) : 0, cut: S && S.cutting && c.running ? Math.min(1, 0.3 + (S.load || 0)) : 0 });
      insp.update(t, c);
      if (t - scrT > 0.25 && S) {
        scrT = t;
        const lines = prog ? prog.lines : [], li = S.line, from = Math.max(0, li - 5);
        scr = { title: L('Chod programu – plynulý', 'Program run, full sequence'), lines: lines.slice(from, from + 13).map((tt, i) => ({ t: tt, cur: from + i === li })),
          pos: [['X', fmt(p.m[0])], ['Y', fmt(p.m[1])], ['Z', fmt(p.m[2] + Lt - MC.nose[1])], ['A', fmt(p.a)], ['C', fmt(p.c)], ['T', String(T)], ['S', String(S.spin)], ['F', String(Math.round(c.fo))]],
          status: S.alarm ? S.alarm.text : S.done ? L('Program ukončený', 'Program finished') : c.running ? L('Chod programu', 'Program running') : L('Pripravený', 'Ready'), alarm: !!S.alarm };
        screen.redraw();
      }
      if (t - teleT > 0.12 && S) {
        teleT = t;
        const w = [p.pT[0] - o54[0], p.pT[1] - o54[1], p.pT[2] - o54[2]], mv = prog && prog.moves[S.idx];
        setTele({ run: !!c.running, paused: S.paused, done: S.done, alarm: S.alarm, line: S.line, X: p.m[0], Y: p.m[1], Z: p.m[2] + Lt - MC.nose[1], A: p.a, C: p.c, wx: w[0], wy: w[1], wz: w[2], T, S: S.dir ? S.spin : 0,
          F: mv && mv.kind !== 'tc' ? (mv.rapid ? -1 : Math.round((mv.F || 0) * c.fo / 100)) : 0, load: S.load || 0, mrr: (S.mrr || 0) * 60 / 1000, t: S.t, removed: S.removed / 1000, busy, building: false, maxLoad, msg });
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    try { if (/[?&]debug/.test(window.location.search)) window.__hermle = { c, get ex() { return ex; }, get prog() { return prog; }, get stock() { return stock; } }; } catch (err) { /* ignorované */ }
    return () => { cancelAnimationFrame(raf); snd.dispose(); insp.dispose(); clearStock(); if (mat) mat.dispose(); try { delete window.__hermle; } catch (err) { /* ignorované */ } disposeStage(); };
  }, []);

  // program, nástroje alebo polotovar sa zmenili → znova interpretovať (pri zastavenom stroji)
  const reload = (txt = text, tls = tools) => { if (apiRef.current.load) { set('running', false); setCheck(apiRef.current.load(txt, tls)); } };
  useEffect(() => { const h = setTimeout(() => reload(), 350); return () => clearTimeout(h); }, [text, tools, ui.mat, ui.sx, ui.sy, ui.sz, ui.res]);
  const pickSample = (id) => { const s = samples.find((x) => x.id === id); setProgId(id); if (s) setText(s.text); };
  const onFile = (e) => {
    const fl = e.target.files && e.target.files[0]; if (!fl) return;
    const rd = new FileReader(); rd.onload = () => { setProgId(''); setText(String(rd.result || '')); }; rd.readAsText(fl); e.target.value = '';
  };
  const save = (blob, nameF) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nameF; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  const takeCamTools = () => {
    const defs = check.toolDefs || []; if (!defs.length) return;
    setTools((ts) => { const out = ts.filter((x) => !defs.some((d) => d.t === x.t)); return [...out, ...defs].sort((a, b) => a.t - b.t); });
  };
  const setTool = (t, k, v) => setTools((ts) => ts.map((x) => (x.t === t ? { ...x, [k]: v } : x)));
  const start = () => { const r = apiRef.current.start && apiRef.current.start(); if (r === 'ok') set('running', true); };
  const parts = hermleParts();
  const status = tele.alarm ? { kind: 'danger', text: `${L('Alarm', 'Alarm')}: ${tele.alarm.text} (${L('riadok', 'line')} ${tele.alarm.line + 1})` }
    : tele.msg ? { kind: 'warn', text: tele.msg }
    : tele.done ? { kind: 'idle', text: L(`Program ukončený za ${mmss(tele.t)} – odobratých ${fmt(tele.removed, 1)} cm³.`, `Program finished in ${mmss(tele.t)} – ${fmt(tele.removed, 1)} cm³ removed.`) }
    : tele.run ? { kind: 'run', text: `${L('Chod programu', 'Program running')} · ${L('riadok', 'line')} ${tele.line + 1}${tele.busy ? L(' · výpočet úberu spomaľuje simuláciu', ' · material removal slows the simulation') : ''}` }
    : tele.paused ? { kind: 'warn', text: L('Program zastavený (M0 / blok po bloku) – pokračuj Štartom.', 'Program stopped (M0 / single block) – continue with Start.') }
    : check.errors.length ? { kind: 'danger', text: L(`Program má ${check.errors.length} chýb – pozri Kontrola programu.`, `The program has ${check.errors.length} errors – see Program check.`) }
    : { kind: 'idle', text: L('Pripravený. Zatvor dvere a stlač Štart cyklu.', 'Ready. Close the doors and press Cycle start.') };
  const chips = [{ color: tele.run ? '#3ee06c' : tele.alarm ? '#ff5a4f' : '#8b8f89', text: tele.run ? L('Automat', 'Auto') : tele.alarm ? L('Alarm', 'Alarm') : L('Stojí', 'Stopped') }, { color: ui.door ? '#ff8a1f' : '#3ee06c', text: ui.door ? L('Dvere otvorené', 'Doors open') : L('Dvere zatvorené', 'Doors closed') }];
  const lines = text.split('\n'), li = tele.line, from = Math.max(0, li - 4);
  const dro = [['X', tele.X], ['Y', tele.Y], ['Z', tele.Z], ['A', tele.A, 'deg'], ['C', tele.C, 'deg']];
  const tl = tools.find((x) => x.t === tele.T);
  const fz = tl && tele.S > 0 && tele.F > 0 ? tele.F / (tele.S * tl.z) : 0;

  return (
    <div className="machine-app modern-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} canUnclamp={false}
        tips={[L('Nulový bod G54 je v strede hornej plochy polotovaru; nástroje T1 – T10 sú v tabuľke (alebo sa prevezmú z komentárov CAM programu).', 'Datum G54 is at the centre of the top face of the blank; tools T1 – T10 are in the table (or taken over from the CAM program comments).'),
          L('Bez G43 / G43.4 (alebo TOOL CALL) je naprogramovaná výška čelo vretena – nástroj potom ide o svoju dĺžku hlbšie.', 'Without G43 / G43.4 (or TOOL CALL) the programmed height is the spindle nose – the tool then goes deeper by its length.'),
          L('Pohľad Nástroj ukáže detail rezu; rýchlosť simulácie a korekcie posuvu sú v paneli.', 'The Tool view shows a close-up of the cut; simulation speed and feed overrides are in the panel.')]} />
      <aside className="panel">
        <div className="sec">
          <p className="sec-title" style={{ letterSpacing: '.14em' }}>{L('Moderné stroje · 5-osé CNC', 'Modern machines · 5-axis CNC')}</p>
          <h1 className="app-title mt-2" tabIndex={-1}>Hermle {MC.name}</h1>
          <div className="mt-2"><SegRow label={L('Model', 'Model')} value={model} options={Object.values(MODELS).map((x) => [x.id, x.name])} onChange={(v) => { if (!tele.run) setModel(v); }} /></div>
          <p className="text-xs muted">{L(`5-osé obrábacie centrum: dráhy ${MC.X[1] * 2} × ${MC.Y[1] * 2} × ${MC.nose[1] - MC.nose[0]} mm, otočno-sklopný stôl Ø${MC.table} (A ±130°, C 360°), vreteno ${MC.smax} ot/min HSK-A63, ${MC.pmax} kW, ${MC.mag} miest v zásobníku, Heidenhain TNC 640. Základný stroj bez prídavných zariadení.`, `5-axis machining centre: travels ${MC.X[1] * 2} × ${MC.Y[1] * 2} × ${MC.nose[1] - MC.nose[0]} mm, swivelling rotary table Ø${MC.table} (A ±130°, C 360°), ${MC.smax} rpm HSK-A63 spindle, ${MC.pmax} kW, ${MC.mag} magazine pockets, Heidenhain TNC 640. Basic machine without optional equipment.`)}{MC.approx ? L(' Údaje C 42 U sú orientačné.', ' C 42 U data are approximate.') : ''}</p>
          <div className="cnc-dro mt-3">
            <div className="cnc-dro-col">
              <span className="cnc-dro-h">{L('Stroj', 'Machine')}</span>
              {dro.map(([k, v, u]) => <div key={k} className="cnc-dro-row"><span>{k}</span><b>{fmt(v, u ? 2 : 3)}</b></div>)}
            </div>
            <div className="cnc-dro-col">
              <span className="cnc-dro-h">{L('Obrobok (G54)', 'Workpiece (G54)')}</span>
              {[['X', tele.wx], ['Y', tele.wy], ['Z', tele.wz]].map(([k, v]) => <div key={k} className="cnc-dro-row"><span>{k}</span><b>{fmt(v)}</b></div>)}
              <div className="cnc-dro-row"><span>T</span><b>{tele.T || '–'}</b></div>
              <div className="cnc-dro-row"><span>S</span><b>{tele.S}</b></div>
            </div>
          </div>
          <div className="cnc-bars mt-2 text-xs">
            <div><span>{L('Posuv', 'Feed')}</span><b>{tele.F < 0 ? 'FMAX' : `${tele.F} mm/min`}</b></div>
            <div><span>{L('Úber', 'MRR')}</span><b>{fmt(tele.mrr, 1)} cm³/min</b></div>
            <div><span>fz</span><b>{fz ? `${fmt(fz, 3)} mm` : '–'}</b></div>
            <div className="cnc-load"><span>{L('Zaťaženie vretena', 'Spindle load')}</span><i style={{ width: `${Math.min(100, tele.load * 100)}%`, background: tele.load > 0.9 ? 'var(--danger)' : tele.load > 0.7 ? 'var(--warn)' : 'var(--accent)' }} /><b>{Math.round(tele.load * 100)} %</b></div>
          </div>
          <div className={`msg msg-${status.kind}`} role="status"><span className="lamp" />{status.text}</div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Prevádzka', 'Operation')}</h2>
          <div className="cnc-run">
            <button type="button" className="btn-run start" onClick={start}>▶ {L('Štart cyklu', 'Cycle start')}</button>
            <button type="button" className="btn" onClick={() => { apiRef.current.hold && apiRef.current.hold(); set('running', false); }}>❚❚ {L('Stop posuvu', 'Feed hold')}</button>
            <button type="button" className="btn" onClick={() => reload()}>■ Reset</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="btn" onClick={() => apiRef.current.ffwd && apiRef.current.ffwd()}>⏭ {L('Rýchlo na koniec', 'Fast to the end')}</button>
            <button type="button" className={`btn ${ui.door ? 'active' : ''}`} onClick={() => set('door', !ui.door)}>{ui.door ? L('Zatvoriť dvere', 'Close doors') : L('Otvoriť dvere', 'Open doors')}</button>
          </div>
          <div className="mt-2">
            <SegRow label={L('Rýchlosť simulácie', 'Simulation speed')} value={ui.speed} options={[[1, '×1'], [5, '×5'], [20, '×20'], [80, '×80']]} onChange={(v) => set('speed', v)} />
            <SegRow label={L('Korekcia posuvu', 'Feed override')} value={ui.fo} options={[[50, '50 %'], [100, '100 %'], [120, '120 %'], [150, '150 %']]} onChange={(v) => set('fo', v)} />
            <SegRow label={L('Rýchloposuv', 'Rapid')} value={ui.ro} options={[[5, '5 %'], [25, '25 %'], [50, '50 %'], [100, '100 %']]} onChange={(v) => set('ro', v)} />
            <Toggle on={ui.single} label={L('Blok po bloku', 'Single block')} onClick={() => set('single', !ui.single)} />
            <Toggle on={ui.cabin} label={L('Zobraziť kabínu', 'Show the cabin')} onClick={() => set('cabin', !ui.cabin)} />
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('CNC program', 'CNC program')}</h2>
          <select className="sel mb-2" value={progId} onChange={(e) => pickSample(e.target.value)} aria-label={L('Ukážkový program', 'Sample program')}>
            {!progId && <option value="">{L('Vlastný / načítaný program', 'Own / loaded program')}</option>}
            {samples.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2 mb-2">
            <button type="button" className="btn" onClick={() => fileRef.current && fileRef.current.click()}>{L('Načítať z CAM…', 'Load from CAM…')}</button>
            <button type="button" className="btn" onClick={() => save(new Blob([text], { type: 'text/plain' }), check.dialect === 'heidenhain' ? 'program.h' : 'program.nc')}>{L('Uložiť program', 'Save program')}</button>
            <input ref={fileRef} type="file" accept=".nc,.ngc,.tap,.cnc,.iso,.gcode,.h,.mpf,.txt,.eia,.ptp" style={{ display: 'none' }} onChange={onFile} />
          </div>
          <div className="cnc-listing" aria-label={L('Aktuálny blok', 'Current block')}>
            {lines.slice(from, from + 9).map((s, i) => <div key={from + i} className={from + i === li ? 'cur' : ''}><span>{from + i + 1}</span>{s || ' '}</div>)}
          </div>
          <label className="sr-only" htmlFor="cnc-edit">{L('Editor programu', 'Program editor')}</label>
          <textarea id="cnc-edit" className="cnc-edit mt-2" spellCheck={false} value={text} onChange={(e) => { setProgId(''); setText(e.target.value); }} rows={10} />
          <div className="text-xs mt-2" style={{ lineHeight: 1.5 }}>
            <div>{check.dialect === 'heidenhain' ? 'Heidenhain Klartext' : 'ISO / G-kód'} · {check.n} {L('pohybov', 'moves')} · {L('odhad času', 'estimated time')} <b>{mmss(check.time)}</b></div>
            {check.errors.slice(0, 6).map((e, i) => <div key={`e${i}`} style={{ color: 'var(--danger)' }}>✗ {L('riadok', 'line')} {e.line + 1}: {e.text}</div>)}
            {check.warns.slice(0, 5).map((e, i) => <div key={`w${i}`} style={{ color: 'var(--warn)' }}>! {L('riadok', 'line')} {e.line + 1}: {e.text}</div>)}
            {!check.errors.length && <div style={{ color: 'var(--accent)' }}>✓ {L('Program bez chýb', 'No errors in the program')}</div>}
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Polotovar a upnutie', 'Blank and clamping')}</h2>
          <SegRow label={L('Materiál', 'Material')} value={ui.mat} options={Object.entries(MATERIALS).map(([k, v]) => [k, v.name().split(' ')[0]])} onChange={(v) => set('mat', v)} />
          {check.stock ? <p className="text-xs muted mb-2">{L('Rozmery z BLK FORM programu', 'Dimensions from the program BLK FORM')}: {check.stock.max[0] - check.stock.min[0]} × {check.stock.max[1] - check.stock.min[1]} × {check.stock.max[2] - check.stock.min[2]} mm</p> : (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[['sx', 'X'], ['sy', 'Y'], ['sz', 'Z']].map(([k, l]) => <label key={k} className="text-xs">{l} mm<input className="sel" type="number" min={10} max={k === 'sz' ? 200 : 300} value={ui[k]} onChange={(e) => set(k, Math.max(10, Math.min(k === 'sz' ? 200 : 300, Number(e.target.value) || 10)))} /></label>)}
            </div>
          )}
          <SegRow label={L('Jemnosť siete', 'Mesh resolution')} value={ui.res} options={[[1.0, '1 mm'], [0.7, '0,7 mm'], [0.5, '0,5 mm']]} onChange={(v) => set('res', v)} />
          <p className="text-xs muted">{L('Upnutie na nulovom systéme Ø70 × 50 mm, nulový bod G54 v strede hornej plochy. Jemnejšia sieť = presnejší povrch, ale pomalší výpočet.', 'Clamped on a Ø70 × 50 mm zero-point system, datum G54 at the centre of the top face. A finer mesh = a more accurate surface but slower computation.')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Nástroje', 'Tools')}</h2>
          {check.toolDefs && check.toolDefs.length > 0 && <button type="button" className="btn w-full mb-2" onClick={takeCamTools}>{L(`Prevziať ${check.toolDefs.length} nástrojov z komentárov programu (CAM)`, `Take over ${check.toolDefs.length} tools from the program comments (CAM)`)}</button>}
          <table className="cnc-tools text-xs tnum w-full">
            <thead><tr><th>T</th><th>{L('Nástroj', 'Tool')}</th><th>Ø</th><th>R</th><th>L</th><th>{L('rez.', 'flute')}</th></tr></thead>
            <tbody>{tools.map((x) => (
              <tr key={x.t} className={x.t === tele.T ? 'cur' : ''}><td>{x.t}</td><td title={x.name}>{x.name}</td>
                {['d', 'cr', 'l', 'lc'].map((k) => <td key={k}><input type="number" step="0.1" value={x[k]} aria-label={`T${x.t} ${k}`} onChange={(e) => setTool(x.t, k, Math.max(k === 'cr' ? 0 : 0.5, Number(e.target.value) || 0))} /></td>)}
              </tr>
            ))}</tbody>
          </table>
          <p className="text-xs muted mt-2">{L('L = dĺžka od čela vretena po špičku (korekcia dĺžky G43 / TOOL CALL), R = polomer rohu (R = Ø/2 guľová fréza).', 'L = length from the spindle nose to the tip (length offset G43 / TOOL CALL), R = corner radius (R = Ø/2 ball mill).')}</p>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Výsledok', 'Result')}</h2>
          <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
            <div>{L('Čas obrábania', 'Machining time')}: <b>{mmss(tele.t)}</b> / {L('odhad', 'estimate')} {mmss(check.time)}</div>
            <div>{L('Odobratý objem', 'Removed volume')}: <b>{fmt(tele.removed, 1)} cm³</b></div>
            <div>{L('Najväčšie zaťaženie vretena', 'Peak spindle load')}: <b>{Math.round(tele.maxLoad * 100)} %</b></div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="btn" onClick={() => { const b = apiRef.current.stl && apiRef.current.stl(); if (b) save(b, 'hermle-c32-obrobok.stl'); }}>{L('Stiahnuť STL obrobku', 'Download part STL')}</button>
            <button type="button" className="btn" onClick={() => apiRef.current.snapshot && apiRef.current.snapshot((b) => b && save(b, 'hermle-c32.png'))}>{L('Snímka PNG', 'PNG snapshot')}</button>
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Program z CAM', 'Program from CAM')}</h2>
          <div className="text-xs" style={{ lineHeight: 1.55 }}>
            <p>{L('Simulátor číta výstup postprocesorov CAM (Fusion 360, Mastercam, hyperMILL, SolidCAM, NX …):', 'The simulator reads CAM post-processor output (Fusion 360, Mastercam, hyperMILL, SolidCAM, NX …):')}</p>
            <ul className="ctl-list" style={{ marginTop: 4 }}>
              <li><b>ISO / Fanuc:</b> G0 G1 G2 G3 (I J K / R), G17–G19, G90 / G91, G93 / G94, G43 H, G43.4 (TCP), G49, G68.2 + G53.1, G69, G81 / G82 / G83 / G73, G53, G28, M3 M4 M5 M6 M8 M9 M0 M1 M30, osi A a C.</li>
              <li><b>Heidenhain Klartext:</b> BLK FORM, TOOL CALL, L, CC, C, CR, FMAX, M128 / FUNCTION TCPM, PLANE SPATIAL / RESET, CYCL DEF 200, CYCL CALL / M99, M140.</li>
              <li>{L('Postprocesor: Fanuc / Heidenhain 5-osí s otočno-sklopným stolom A/C, výstup v mm, dráha stredu nástroja (bez G41/G42), nulový bod v strede hornej plochy polotovaru.', 'Post-processor: Fanuc / Heidenhain 5-axis with an A/C trunnion table, output in mm, tool centre path (no G41/G42), datum at the centre of the top face of the blank.')}</li>
              <li>{L('Komentáre nástrojov typu „T3 D=10. CR=0. - flat end mill“ sa dajú prevziať do tabuľky nástrojov.', 'Tool comments like “T3 D=10. CR=0. - flat end mill” can be taken over into the tool table.')}</li>
            </ul>
          </div>
        </div>

        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['priestor', L('Pracovný priestor', 'Working area')], ['obrobok', L('Obrobok', 'Workpiece')], ['nastroj', L('Nástroj', 'Tool')], ['zhora', L('Zhora', 'Top')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </aside>
    </div>
  );
}

const MODEL_KEY = 'rmt-hermle-model';
function HermleSimulator({ onBack }) {
  const [model, setModelS] = useState(() => { try { const m = localStorage.getItem(MODEL_KEY); return MODELS[m] ? m : 'c32'; } catch (err) { return 'c32'; } });
  const setModel = (m) => { try { localStorage.setItem(MODEL_KEY, m); } catch (err) { /* ignorované */ } setModelS(m); };
  const [progId, setProgId] = useState('p3');
  const [text, setText] = useState(() => SAMPLES()[0].text);
  const [tools, setTools] = useState(defaultTools);
  return <HermleCore key={model} {...{ onBack, model, setModel, text, setText, tools, setTools, progId, setProgId }} />;
}

export { HermleSimulator };
export default HermleSimulator;
