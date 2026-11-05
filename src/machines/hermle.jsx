import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { L } from '../core/i18n';
import { createControls } from '../core/controls';
import { exportStep } from '../core/step';
import { createInspector } from '../core/inspector';
import { createParticles } from '../core/particles';
import { createStage } from '../core/stage';
import { createSound } from '../core/sound';
import { createWorkInspect } from '../core/workInspect';
import { HelpFooter, PartsSection, SceneView, SegRow, Slider, Toggle, ViewSection, mkParts, useMachine, useTele } from '../ui/common';
import { interpret } from './cnc/gcode';
import { MODELS } from './cnc/kin';
import { programTime } from './cnc/motion';
import { SAMPLES } from './cnc/programs';
import { createExecutor } from './cnc/sim';
import { MATERIALS, defaultTools } from './cnc/tooling';
import { createHmiPanel } from './cnc/hmiPanel';
import { cabinHalfWidth, hmiPose } from './cnc/hermleLayout';
import { createAccessories } from './cnc/accessories';
import { createToolModel } from './cnc/toolModel';
import { HmiFullscreen } from '../ui/hmiFullscreen';
import { StepDownloadButton } from '../ui/tools';
import { CncToolPreview } from '../ui/cncToolPreview';
import { ToolLibrary } from '../ui/toolLibrary';
import { ToolPicker } from '../ui/toolPicker';
import { installTool, MAX_FILE_BYTES } from './cnc/toolLibrary';
import { createStock } from './cnc/voxel';
import { createCabinLighting } from './cnc/cabinLighting';
import { createRoedersModel } from './precision/roedersModel';
import { RXU, validateRxuTool, RXU_PROGRAM } from './precision/profiles';

// =====================================================================
// 5-OSÉ OBRÁBACIE CENTRUM HERMLE C 32 – CNC program, 5-osá kinematika a úber materiálu
// =====================================================================
// mierka scény 1 = 100 mm. Scéna: x = X stroja, y hore, z = −Y stroja (k obsluhe). Otočný bod (os A ∩ os C) je
// v (0, PY, 0); plocha stola pri A = 0 je 100 mm pod ním (výška nakladania 950 mm). Prídavné zariadenia sa zapínajú samostatne nižšie.
const PY0 = 10.5, U = 0.01;
const FIX = { r: 35, h: 50 };                         // nulový upínací systém pod polotovarom
const hermleParts = () => mkParts([
  ['kabina', 'Kabína', 'Cabin', 'Kabína s posuvnými dverami', 'Cabin with sliding doors', 'Uzavretý pracovný priestor s veľkými oknami. Dvere majú bezpečnostný zámok – pri otvorených dverách sa program nespustí a posuv sa zastaví.', 'Enclosed working area with large windows. The doors are interlocked – with the doors open the program does not start and the feed stops.'],
  ['lozko', 'Lôžko', 'Bed', 'Lôžko z minerálneho liatia', 'Mineral-cast bed', 'Masívne lôžko z minerálneho liatia tlmí chvenie. Os A stola je uložená priamo v lôžku.', 'The massive mineral-cast bed damps vibration. The table A axis is mounted directly in the bed.'],
  ['osi', 'Osi X Y Z', 'X Y Z axes', 'Upravený portál – osi nad pracovným priestorom', 'Modified gantry – axes above the working area', 'Všetky tri lineárne osi nesie nástroj: priečnik Y jazdí po dvoch vedeniach na stenách lôžka, sane X po priečniku a smykadlo Z zvisle. Dráhy 650 × 650 × 500 mm, rýchloposuv 45 / 45 / 40 m/min.', 'The tool carries all three linear axes: the Y cross-beam runs on two guideways on the bed walls, the X slide on the cross-beam and the Z ram vertically. Travels 650 × 650 × 500 mm, rapid traverse 45 / 45 / 40 m/min.'],
  ['vreteno', 'Vreteno', 'Spindle', 'Motorové vreteno HSK-A63', 'HSK-A63 motor spindle', '18 000 ot/min, 42 kW / 148 Nm (20 % ED). Nástroj sa upína do kužeľa HSK-A63.', '18,000 rpm, 42 kW / 148 Nm (20 % duty). The tool is clamped in an HSK-A63 taper.'],
  ['stol', 'Stôl A / C', 'A / C table', 'Otočno-sklopný stôl Ø650 × 540 mm', 'Swivelling rotary table Ø650 × 540 mm', 'Os A sklápa stôl ±130° okolo osi X, os C ho otáča o 360°. Os A leží v obrobku (stôl tvaru U) – pri sklopení sa obrobok málo vychýli.', 'The A axis swivels the table ±130° about X, the C axis rotates it 360°. The A axis lies within the workpiece (U-shaped table) – the workpiece moves little when swivelled.'],
  ['zasobnik', 'Zásobník', 'Magazine', 'Pick-up zásobník 36 / 42 miest', '36 / 42-pocket pick-up magazine', 'Zásobník je integrovaný v lôžku za pracovným priestorom. Vreteno si nástroj vezme samo, výmena trvá asi 4,5 s.', 'The magazine is integrated in the bed behind the working area. The spindle picks the tool itself, a change takes about 4.5 s.'],
  ['panel', 'Ovládací panel', 'Control panel', 'Riadiaci systém Heidenhain TNC 640', 'Heidenhain TNC 640 control', 'Otočný ovládací panel s 19" dotykovou obrazovkou. Simulátor číta programy ISO (G-kód) aj Heidenhain Klartext.', 'Swivelling control panel with a 19" touch screen. The simulator reads ISO (G-code) and Heidenhain conversational programs.'],
  ['obrobok', 'Obrobok', 'Workpiece', 'Polotovar na upínači', 'Blank on the fixture', 'Polotovar na nulovom upínacom systéme. Nulový bod G54 je v strede hornej plochy.', 'The blank on the zero-point clamping system. Datum G54 is at the centre of the top face.'],
]);
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function CncCore({ onBack, model, setModel, text, setText, tools, setTools, progId, setProgId }) {
  const rxu=model===RXU.id, MC = rxu ? RXU : MODELS[model] || MODELS.c32;
  const brand=rxu?'Röders':'Hermle', controller=rxu?'RMS6':'HEIDENHAIN · TNC 640';
  const mountRef = useRef(null), layerRef = useRef(null), tipRef = useRef(null), fileRef = useRef(null);
  const init = { door: true, cabin: true, panelAngle: 0, panelYaw: 0, hmiLocked: false, accessorySetup: 'none', speed: 5, fo: 100, ro: 100, single: false, mat: 'al', sx: 100, sy: 80, sz: 40, res: 0.7, labels: false, manual: false, light: true, estop: false };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [hmiOpen,setHmiOpen]=useState(false);
  const [libraryTab,setLibraryTab]=useState(null);
  const [libraryPocket,setLibraryPocket]=useState(undefined);
  const [libraryToolId,setLibraryToolId]=useState(undefined);
  const [libraryReturn,setLibraryReturn]=useState(null);
  const [librarySource,setLibrarySource]=useState(null);
  const [programImportError,setProgramImportError]=useState('');
  const samples = rxu ? [{id:'rxu',name:L('ISO: kruhová kapsa','ISO: circular pocket'),text:RXU_PROGRAM},...SAMPLES().filter(s=>s.id!=='p3'&&s.id!=='ph')] : SAMPLES();
  const [check, setCheck] = useState({ errors: [], warns: [], time: 0, dialect: 'iso', toolDefs: [], stock: null, n: 0 });
  const [tele, setTele] = useTele({ run: false, paused: false, done: false, alarm: null, line: 0, X: 0, Y: 0, Z: 0, A: 0, C: 0, wx: 0, wy: 0, wz: 0, T: 0, S: 0, F: 0, load: 0, mrr: 0, t: 0, removed: 0, busy: false, building: false, maxLoad: 0 });

  useEffect(() => {
    const mount = mountRef.current, layer = layerRef.current, tipEl = tipRef.current;
    const c = ctl.current;
    const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount, { far: 500, floorSize: 400, gridSize: 240, fogNear: 180, fogFar: 400 });
    const snd = createSound('mill');

    const dom = renderer.domElement;
    const std = (col, rough = 0.5, metal = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(col).convertSRGBToLinear(), roughness: rough, metalness: metal, ...extra });
    const M = {
      cab: std(0xe6e8ea, 0.55, 0.1), cab2: std(0xc9cdd1, 0.5, 0.15), dark: std(0x2c3035, 0.7, 0.15), anth: std(0x3a3f45, 0.6, 0.2),
      steel: std(0xb9bec4, 0.28, 0.85), steelD: std(0x6d737a, 0.35, 0.8), inox: std(0xc4c8cc, 0.32, 0.75), table: std(0xd3d6d9, 0.38, 0.55),
      red: std(0xd8202a, 0.4, 0.2), black: std(0x141618, 0.6, 0.2), glass: new THREE.MeshStandardMaterial({ color: 0xbfd6e6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
      tool: std(0x7b8087, 0.3, 0.9), coat: std(0xb08a3c, 0.3, 0.85), holder: std(0x9aa0a6, 0.25, 0.9), flute: new THREE.LineBasicMaterial({ color: 0x4d4431 }),
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
    const K = MC.K, PY = rxu?14:PY0*K, bodyHalf = rxu?12:cabinHalfWidth(MC);
    let scr = null;
    const buildHermleGeometry = () => {
    const sc = (parent) => { const g = new THREE.Group(); g.scale.setScalar(K); parent.add(g); return g; };
    M.win = std(0x1d2329, 0.15, 0.4); M.yellow = std(0xf2c230, 0.5, 0.1); M.brush = std(0xc2c6ca, 0.38, 0.7);
    // ---------------- lôžko z minerálneho liatia a steny s vedeniami Y ----------------
    const bed = sc(grp('lozko'));
    [[-8.6, -9.6], [8.6, -9.6], [-8.6, 7.4], [8.6, 7.4]].forEach(([x, z]) => box(bed, x - 0.9, x + 0.9, 0, 0.7, z - 0.9, z + 0.9, M.black));
    const bedHalf=Math.min(10,bodyHalf/K-.1);
    box(bed, -bedHalf, bedHalf, 0.7, 6.2, -12.5, 8.0, M.dark);
    [-1, 1].forEach((s) => {
      box(bed, s * 6.9, s * 9.6, 6.2, 20.8, -11, 3.2, M.anth);                                    // stena lôžka
      box(bed, s * 7.6, s * 8.6, 20.8, 21.2, -11, 3.2, M.steelD);                                  // vedenie Y
      cylX(bed, 2.1, s * 6.4, s * 6.9, PY0, 0, M.table, 48);                                      // príruba osi A
      const motorOuter=Math.min(10.6,bodyHalf/K-.2);
      cylX(bed, 1.2, s * (motorOuter-.8), s * motorOuter, PY0, 0, M.steelD, 32);                                    // pohon osi A (tandem)
    });
    box(bed, -6.9, 6.9, 6.2, 7.2, -12.5, 3.2, M.inox);                                               // dno pracovného priestoru (nerez)
    box(bed, -6.9, 6.9, 7.2, 19, -12.4, -12.2, M.inox);                                              // zadná stena
    box(bed, -6.9, 6.9, 7.2, 13.9, -3.55, -3.4, M.inox);                                           // deliaca stena pred zásobníkom
    // Rear service/electrical section completes the 4000 mm C42 plan envelope.
    const service = sc(bed.parent), envelopeScale = bodyHalf / 12.25;
    const serviceRear = (9.3*K - 40*envelopeScale)/K, serviceFront = -12.4;
    const serviceHalf = 8.75*envelopeScale/K;
    box(service,-serviceHalf,serviceHalf,1.2,21.5*envelopeScale/K,serviceRear,serviceFront,M.cab2);
    box(service,-serviceHalf+.2,serviceHalf-.2,1,1.2,serviceRear+.2,serviceFront-.2,M.dark);
    for(const x of [-serviceHalf*.8,serviceHalf*.8])for(const z of [serviceRear+.6,serviceFront-.6])cylY(service,.4,.4,.05,1.2,x,z,M.steelD);
    for(const x of [-serviceHalf*.5,serviceHalf*.5]){
      box(service,x-serviceHalf*.48,x+serviceHalf*.48,2,20.7*envelopeScale/K,serviceRear-.08,serviceRear-.02,M.cab);
      box(service,x+.8,x+.9,10,11,serviceRear-.18,serviceRear-.08,M.black);
    }
    const accessories = createAccessories(root, M, K, bodyHalf);
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
    const clampPins = [0,1,2].map(i=>{
      const pin=new THREE.Group();pin.rotation.y=i*Math.PI*2/3;cG.add(pin);
      return box(pin,-.055,.055,.25,.42,FIX.r*U-.06,FIX.r*U+.06,M.steel);
    });
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
    for (const y of [.2, .45, .7]) cylY(sp, .8, .8, y, y + .035, 0, 0, M.steelD);
    for (const x of [-.98, .98]) {
      cylY(sp, .12, .12, .55, 1.3, x, 0, M.red, 16);
      cylY(sp, .19, .19, 1.3, 1.5, x, 0, M.steelD, 16);
      box(sp, x - .18, x + .18, 1.5, 1.75, -.18, .18, M.anth);
    }
    const toolG = new THREE.Group(); sp.add(toolG);
    const clearTool = (g) => { while (g.children.length) { const o = g.children[0]; g.remove(o); o.traverse((n) => n.geometry?.dispose()); } };
    const buildTool = (t) => { clearTool(toolG); if (t) toolG.add(createToolModel(t, M)); };
    // Pick-up ring on a stationary bearing housing bolted to the mineral-cast bed.
    const mag = grp('zasobnik'), magS = sc(mag);
    const magZ = -MC.tcY * U / K - 4.0, magY = (PY + (MC.nose[1] - 80) * U) / K;
    box(magS, -5.3, 5.3, 6.2, 8, magZ - 4.5, magZ + 3.5, M.anth);
    [-1, 1].forEach((s) => {
      box(magS, s * 3.6 - .35, s * 3.6 + .35, 8, magY - .5, magZ - 2, magZ + 2, M.dark);
      for (const z of [-1.6, 1.6]) cylY(magS, .12, .12, magY - .48, magY - .35, s * 3.6, magZ + z, M.steel);
    });
    cylY(magS, 3.6, 3.6, magY - .5, magY - .2, 0, magZ, M.steelD, 72);
    cylY(magS, .65, .65, magY - .2, magY + .45, 0, magZ, M.steel, 40);
    box(magS, -4.7, -3.8, magY - .8, magY + .4, magZ - .8, magZ + .8, M.dark); // index motor
    const magG = new THREE.Group(); magG.position.set(0, magY, magZ); magS.add(magG);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, .12, 10, 96), M.steel); ring.rotation.x = Math.PI / 2; magG.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4; cylY(magS, .1, .1, magY - .18, magY - .1, Math.sin(a) * 3.4, magZ + Math.cos(a) * 3.4, M.steel);
    }
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Group(); magG.add(spoke); spoke.rotation.y = i * Math.PI * 2 / 3;
      box(spoke, -.15, .15, -.18, -.05, .55, 3.9, M.steelD);
    }
    const pockets = [];
    for (let i = 0; i < MC.mag; i++) {
      const a = i / MC.mag * Math.PI * 2, g = new THREE.Group(); g.position.set(Math.sin(a) * 4, 0, Math.cos(a) * 4); g.rotation.y = a; magG.add(g);
      // Open fork engages the HSK flange groove; no fabricated tools in empty pockets.
      for (const x of [-.28, .28]) box(g, x - .045, x + .045, -.14, -.08, -.25, .28, M.red);
      box(g, -.32, .32, -.14, -.08, -.32, -.24, M.red);
      const holder = new THREE.Group(); holder.scale.setScalar(1 / K); g.add(holder);
      pockets.push(holder);
    }
    // Compact mechanism stays over the magazine, within the bed's rear wall.
    const saddle = new THREE.Group(); saddle.name = 'magazine-drive'; magS.add(saddle);
    const driveY = magY + 1.6;
    for (const x of [-1.55, 1.55]) {
      box(saddle, x - .25, x + .25, magY + .2, driveY, magZ - 1.1, magZ + 1.1, M.anth);
      box(saddle, x - .3, x + .3, driveY, driveY + .2, magZ - 2.8, magZ + 2.8, M.dark);
    }
    const rodZ = (x, y, z0, z1, r, mat) => {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(r, r, z1-z0, 24), mat);
      rod.rotation.x = Math.PI/2; rod.position.set(x,y,(z0+z1)/2); saddle.add(rod); return rod;
    };
    for (const x of [-1.1, 1.1]) rodZ(x, driveY + .45, magZ - 2.55, magZ + 2.55, .12, M.steel);
    rodZ(0, driveY + .45, magZ - 2.55, magZ + 2.55, .15, M.red);
    for (const z of [-2.7, 2.7]) {
      box(saddle, -1.85, 1.85, driveY + .05, driveY + .9, magZ + z - .15, magZ + z + .15, M.inox);
      for (const x of [-1.1,0,1.1]) rodZ(x,driveY+.45,magZ+z-.17,magZ+z+.17,.23,M.steelD);
    }
    box(saddle, -.5,.5,driveY+.05,driveY+.9,magZ-3.45,magZ-2.85,M.black);
    rodZ(0,driveY+.45,magZ-2.85,magZ-2.55,.18,M.steelD);
    // Flanged vertical transmission physically joins the bridge to the ring hub.
    const driveShaft = new THREE.Group(); driveShaft.position.set(0,magY,magZ); magS.add(driveShaft);
    cylY(driveShaft,.25,.25,0,1.8,0,0,M.steel);
    for(const y of [.25,1.35]) cylY(driveShaft,.62,.62,y,y+.15,0,0,M.steelD);
    cylY(saddle,.8,.8,driveY-.1,driveY+.1,0,magZ,M.anth);
    box(saddle,-2.9,-1.85,driveY-.1,driveY+.55,magZ-.8,magZ+.8,M.cab2);
    cylY(saddle,.55,.55,driveY+.55,driveY+.75,-2.35,magZ,M.steelD);
    const loadMagazine = (tls) => pockets.forEach((g, i) => { clearTool(g); const tl = tls.find((x) => x.t === i + 1); if (tl) g.add(createToolModel(tl, M)); });
    // ---------------- kabína: čelo podľa predlohy (široký spodný a podľa modelu užší horný otvor) ----------------
    const cab = grp('kabina'), cabS = sc(cab), uw = MC.upperW;
    cabS.scale.x = bodyHalf / 11.4;
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
    box(cabS, -9.0, -6.6, 9.5, 19.5, 8.6, 8.64, M.cab2); box(cabS, 6.0, 8.4, 9.5, 19.5, 8.6, 8.64, M.cab2);   // zapustené sivé čelné plechy
    box(cabS, 8.75, 9.0, 9.5, 19.5, 8.6, 8.66, M.red);                                             // červený pás
    const label = tex(512, 128, (g, w, h) => { g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8202a'; g.lineWidth = 16; g.beginPath(); g.arc(70, 64, 40, 0.5, Math.PI * 2 - 0.5); g.stroke(); g.fillStyle = '#5d6369'; g.font = 'bold 62px sans-serif'; g.textBaseline = 'middle'; g.fillText('HERMLE', 128, 66); });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: label.tx, roughness: 0.6 })); lab.position.set(-8.9, 21.4, 8.63); cabS.add(lab);
    const name = tex(128, 512, (g, w, h) => { g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#6b7178'; g.font = '78px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(MC.name, 0, 0); g.restore(); });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.8), new THREE.MeshStandardMaterial({ map: name.tx, roughness: 0.6 })); nm.position.set(9.6, 18.0, 8.63); cabS.add(nm);
    // Separate sliding leaves on upper and lower rails; handles stay on their own outer frame edges.
    for (const y of [6.35, 23.65]) box(cabS, -8.8, 8.8, y - .12, y + .12, 7.75, 8.1, M.steelD);
    const doors = [-1, 1].map((s) => {
      const d = new THREE.Group(); cabS.add(d);
      box(d, -2.2, 2.2, 0, 1.0, -0.08, 0.08, M.cab); box(d, -2.2, 2.2, 16.2, 17.2, -0.08, 0.08, M.cab);
      box(d, -2.2, -1.85, 1.0, 16.2, -0.08, 0.08, M.cab); box(d, 1.85, 2.2, 1.0, 16.2, -0.08, 0.08, M.cab);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 15.2), M.glass); win.position.set(0, 8.6, 0); d.add(win);
      const hx = -s * 1.7;
      const pts = [v3(hx, 3.6, .12), v3(hx + s * .38, 4.2, .5), v3(hx + s * .38, 6.4, .5), v3(hx, 7.0, .12)];
      for (let j = 1; j < pts.length; j++) {
        const delta = pts[j].clone().sub(pts[j - 1]);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, delta.length(), 12), M.red);
        bar.position.copy(pts[j]).add(pts[j - 1]).multiplyScalar(.5); bar.quaternion.setFromUnitVectors(v3(0, 1, 0), delta.normalize()); d.add(bar);
      }
      for (const y of [3.6, 7]) box(d, hx - .16, hx + .16, y - .16, y + .16, .08, .21, M.steelD);
      box(d, s < 0 ? 2.12 : -2.2, s < 0 ? 2.2 : -2.12, 0, 17.2, -.1, .11, M.black); // meeting seal
      d.userData.s = s; return d;
    });
    [-1, 1].forEach((s) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), M.glass); w.rotation.y = Math.PI / 2; w.position.set(s * 11.4, 15, -2); cabS.add(w); });
    // ---------------- ovládací panel TNC 640 (Hermle) na otočnom ramene ----------------
    const pan = grp('panel');
    const panBase = sc(pan);
    // Two low articulated links. The machine-side pivot is at the FRONT corner.
    const hmiBase = hmiPose(0, 0, bodyHalf, K);
    box(panBase, bodyHalf/K-.1,hmiBase.base[0]/K,2.9,4.3,7.05,7.95,M.anth);
    cylY(panBase,.65,.65,2.7,4.7,hmiBase.base[0]/K,7.5,M.steelD);
    const armPivot = new THREE.Group(); armPivot.position.set(hmiBase.base[0]/K,0,7.5); panBase.add(armPivot);
    // Offset links and forked elbow: the folded arm has clearance between its two members.
    box(armPivot,-.48,.48,3.2,4.05,0,4.6,M.anth);
    box(armPivot,-.52,.52,4.05,4.16,.4,4.2,M.steelD);
    const armElbow = new THREE.Group(); armElbow.position.z=4.6; armPivot.add(armElbow);
    cylY(armElbow,.68,.68,3.85,4.95,0,0,M.steelD);
    box(armElbow,-.42,.42,4.35,5.05,0,6.8,M.anth);
    const brace=new THREE.Mesh(new THREE.BoxGeometry(.7,3.95,.7),M.anth);
    brace.position.set(0,6.8,6.02);brace.rotation.x=.42;armElbow.add(brace);
    cylY(armElbow,.38,.38,2.4,9.45,0,6.8,M.anth);
    cylY(armElbow,.55,.55,4.25,5.2,0,6.8,M.steelD);
    const panG = new THREE.Group(); panG.position.set(0,0,6.8); armElbow.add(panG);
    const hmi = createHmiPanel(panG,M,tex), sm = hmi.display;
    // Cabinet seams, ventilation grille and levelling pads from the brochure views.
    for (const x of [-10.9,10.9]) for(const y of [7,23.2]) {
      const screw=new THREE.Mesh(new THREE.CircleGeometry(.07,12),M.steelD);screw.position.set(x,y,8.68);cabS.add(screw);
    }
    const vents=sc(cab);
    for(let i=0;i<12;i++) box(vents,bodyHalf/K+.02,bodyHalf/K+.08,5+i*.35,5.12+i*.35,-5.8,-2.8,M.dark);
    for(const x of [-8.6,8.6]) for(const z of [-9.6,7.4]) cylY(bed,.55,.55,.05,.2,x,z,M.steelD);
    const roofCable = new THREE.CatmullRomCurve3([v3(2.8,29.7,.8),v3(2.8,29.1,-1.8),v3(2.8,27.8,-4.5),v3(2.8,26.5,-4.5)]);
    for(let i=0;i<22;i++){
      const p=roofCable.getPoint(i/21), link=box(cabS,-.32,.32,-.2,.2,-.3,.3,M.black);
      link.position.copy(p);link.quaternion.setFromUnitVectors(v3(0,1,0),roofCable.getTangent(i/21).normalize());
    }
    M.lamp=std(0xffffff,.3,0,{emissive:0xffffff,emissiveIntensity:.5});
    for(const x of [-5.6,5.6])box(cabS,x-.15,x+.15,20.1,20.35,-2,2.5,M.lamp);
    for(const x of [-.65,.65]){
      const hose=new THREE.CatmullRomCurve3([v3(x,1.4,.7),v3(x,1,.9),v3(x*.7,.25,.8)]);
      sp.add(new THREE.Mesh(new THREE.TubeGeometry(hose,12,.07,8,false),M.dark));
    }
    return {cab,aG,cG,yG,xG,zG,sp,toolG,buildTool,pockets,magG,driveShaft,saddle,magY,magZ,panG,armPivot,armElbow,hmi,sm,covers,clampPins,doors,loadMagazine,accessories};
    };
    const geometry = rxu ? createRoedersModel({root,G,M,tex,MC,PY}) : buildHermleGeometry();
    const {cab,aG,cG,yG,xG,zG,toolG,buildTool,pockets,magG,driveShaft,saddle,magY,magZ,panG,armPivot,armElbow,hmi,sm,covers,clampPins,doors,loadMagazine,accessories}=geometry;
    const screen = tex(640, 460, (g, w, h) => {
      g.fillStyle = '#e9edf0'; g.fillRect(0, 0, w, h); g.fillStyle = '#292e33'; g.fillRect(0, 0, w, 34);
      g.fillStyle = '#fff'; g.font = 'bold 18px monospace'; g.fillText(`${controller} · ${scr ? scr.title : 'Ready'}`, 12, 23);
      if (!scr) return;
      g.font = '17px monospace';
      scr.lines.forEach((ln, i) => { if (ln.cur) { g.fillStyle = '#ffd34d'; g.fillRect(8, 48 + i * 24, 384, 22); g.fillStyle = '#10202f'; } else g.fillStyle = '#27333e'; g.fillText(ln.t.slice(0, 36), 12, 64 + i * 24); });
      g.fillStyle = '#d7dfe5'; g.fillRect(404, 44, 228, 340); g.font = '18px monospace';
      scr.pos.forEach(([k, v], i) => { g.fillStyle = '#334b5f'; g.fillText(k, 414, 74 + i * 38); g.fillStyle = '#172b3b'; g.fillText(v, 446, 74 + i * 38); });
      g.fillStyle = scr.alarm ? '#ff5a4f' : '#59d17b'; g.fillRect(0, h - 40, w, 40); g.fillStyle = '#0d1a2a'; g.font = 'bold 17px sans-serif'; g.fillText(scr.status.slice(0, 64), 12, h - 14);
    });
    sm.material.map=screen.tx;sm.material.needsUpdate=true;
    apiRef.current.getHmiCanvas=()=>screen.tx.image;
    // ---------------- osvetlenie pracovného priestoru ----------------
    const lighting = createCabinLighting(scene, root, { scale: K, halfWidth: bodyHalf, emitter: M.lamp, workHeight:rxu?13.4:9.5*K });
    Object.values(M).forEach(lighting.registerMaterial);

    // ---------------- polotovar (voxely) ----------------
    const stockG = grp('obrobok', cG); stockG.userData.stepJoin=true; stockG.rotation.x = -Math.PI / 2; stockG.scale.setScalar(U);
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
    let loadedText='',loadedTools=[];
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
      lighting.registerMaterial(mat);
      clearStock(); stock = createStock({ min: stockMin, max: stockMax, res: c.res });
      applyChunks(stock.takeDirty());
    };
    const load = (txt, tls) => {
      if(rxu)tls.forEach(validateRxuTool);
      loadedText=txt;loadedTools=tls;toolsNow = tls; loadMagazine(tls);
      prog = interpret(txt, { o54: [0, 0, 0], tools: tls, mach: MC });                        // najprv kvôli BLK FORM
      buildStock();
      prog = interpret(txt, { o54, tools: tls, mach: MC });
      ex = createExecutor({ moves: prog.moves, tools: tls, o54, stock, fixture: FIX, kc: (MATERIALS[c.mat] || MATERIALS.al).kc, mach: MC });
      if(c.estop)ex.S.alarm={kind:'estop',text:L('Núdzový STOP je stlačený.', 'Emergency STOP is latched.'),line:0};
      scr = { title: L('Pripravený', 'Ready'), lines: prog.lines.slice(0,13).map((t,i)=>({t,cur:i===0})),
        pos: [['X',fmt(ex.S.pose.m[0])],['Y',fmt(ex.S.pose.m[1])],['Z','0.000'],['A','0.000'],['C','0.000'],['T','0'],['S','0'],['F','100']],
        status: L('Pripravený', 'Ready'), alarm: false };
      screen.redraw();
      maxLoad = 0; msg = null; curT = -1;
      return { errors: prog.errors, warns: prog.warns, time: programTime(prog.moves, o54, MC), dialect: prog.dialect, toolDefs: prog.toolDefs, stock: prog.stock, n: prog.moves.length };
    };
    apiRef.current.load = load;
    apiRef.current.start = () => {
      if (!ex) return 'noprog';
      if(c.unclamped){msg=L('Najprv upni obrobok späť.','Clamp the workpiece back first.');return 'unclamped';}
      if (c.estop) { msg=L('Uvoľni núdzový STOP a stlač Reset.', 'Release Emergency STOP and press Reset.'); return 'estop'; }
      if (c.door) { msg = L('Dvere sú otvorené – zatvor ich, potom spusti program.', 'The doors are open – close them, then start the program.'); return 'door'; }
      if (prog.errors.length) { msg = L(`Program má chyby (${prog.errors.length}) – oprav ich pred spustením.`, `The program has errors (${prog.errors.length}) – fix them before starting.`); return 'err'; }
      if (ex.S.alarm) { msg = L('Najprv potvrď alarm tlačidlom Reset.', 'Acknowledge the alarm with Reset first.'); return 'alarm'; }
      if (ex.S.done) return 'done';
      ex.S.paused = false; c.fast=false; c.running = true; msg = null; return 'ok';
    };
    apiRef.current.hold = () => { c.running = false;c.fast=false;if(ex)ex.S.paused=true; };
    apiRef.current.emergency = () => {
      set('estop',!c.estop);set('running',false);c.fast=false;
      if(c.estop&&ex){ex.S.dir=0;ex.S.cool=false;ex.S.paused=true;ex.S.alarm={kind:'estop',text:L('Núdzové zastavenie – uvoľni STOP a stlač Reset.','Emergency stop – release STOP and press Reset.'),line:ex.S.line};}
      msg=c.estop?L('Núdzový STOP stlačený.','Emergency STOP latched.'):L('Núdzový STOP uvoľnený – stlač Reset.','Emergency STOP released – press Reset.');
    };
    apiRef.current.reset = () => { if(c.unclamped)return;set('running',false);c.fast=false;setCheck(load(loadedText,loadedTools)); };
    apiRef.current.ffwd = () => { if (!ex || ex.S.alarm || prog.errors.length || c.door || c.estop || c.unclamped) return; ex.S.paused = false; c.running = true; c.fast = true; };
    apiRef.current.snapshot = snapshot;
    apiRef.current.exportStep = async () => {
      if(c.running || c.drive || c.wheel || c.work)throw new Error(L('Najprv zastav stroj a potom exportuj obrobok.','Stop the machine before exporting the workpiece.'));
      if(stock)applyChunks(stock.takeDirty());return exportStep(stockG);
    };
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
      stol: () => v3(-6.3 * K, PY - 2.5 * K, 2.0 * K), zasobnik: () => v3(4 * K, magY * K, magZ * K), panel: () => new THREE.Vector3(0, 17.8, 0).applyMatrix4(panG.matrixWorld), obrobok: () => toolTip().clone().setY(PY + 0.3),
    };
    const views = {
      celok: () => c.accessorySetup !== 'none' ? [[-42 * K, 38 * K, 65 * K], [-9 * K, 13 * K, -5*K]] : [[42 * K, 38 * K, 62 * K], [0, 13 * K, -5*K]],
      vybavenie: () => [[-44 * K, 22 * K, 34 * K], [-26 * K, 7 * K, -4 * K]],
      panel: () => {
        const pose = hmiPose(c.panelAngle || 0,c.panelYaw || 0,bodyHalf,K), p=v3(pose.column[0],9*K,pose.column[1]);
        const offset=v3(9*K,5*K,20*K).applyAxisAngle(v3(0,1,0),pose.yaw);
        return [p.clone().add(offset).toArray(),p.toArray()];
      },
      priestor: () => [[3.8 * K, PY + 4.1 * K, 7.0 * K], [0, PY - 0.2 * K, -0.4 * K], true],
      obrobok: () => [[1.5, PY + 1.0, 2.3], [0, PY - MC.hA * U + 0.75, 0], true],
      nastroj: () => { const t = toolTip(); return [[t.x + 1.9, t.y + 1.1, t.z + 2.6], [t.x, t.y - 0.15, t.z], true]; },
      zasobnik: () => [[18 * K, 32 * K, -24 * K], [0, 18 * K, -6.5 * K], true],
      zhora: () => [[0.01, 90 * K, -6 * K], [0, 10 * K, -6 * K], true],
    };
    Object.assign(views,geometry.viewOverrides||{});
    const insp = createInspector({
      dom, mount, camera, root, G, anchors, views, labelEls: Array.from(layer.querySelectorAll('[data-part]')),
      orbitOptions: { maxDistance: 180, maxTargetY: 45 },
      enabled: () => !c.manual && !c.unclamped, onPick: (k) => apiRef.current.onPick(k), blockPick: () => ctrl.isUsed() || !!panelDrag || c.unclamped, onHL: () => ctrl.invalidate(),
    });
    const ctrl=createControls({dom,mount,camera,root,tipEl,c,getT:()=>t,getHL:insp.hl});
    let doorDragStart=0,manualDoor=null;
    for(const d of doors){
      ctrl.reg({type:'slide',axis:'x',tooltip:false,label:rxu?L('Pravé otváracie dvere','Right-hinged door'):L('Posuvné dvere','Sliding doors'),
        hint:rxu?L('Pravý pánt: potiahni doprava alebo klikni.','Right hinge: drag right or click.'):L('Potiahni madlo do strany alebo klikni na otvorenie / zatvorenie.','Drag the handle sideways or click to open / close.'),
        read:()=>c.door?L('otvorené','open'):L('zatvorené','closed'),
        start:()=>{doorDragStart=doorK;manualDoor=doorK;},
        slide:(dx)=>{manualDoor=Math.max(0,Math.min(1,doorDragStart+dx*d.userData.s/((rxu?10.5:4)*K)));ctrl.push('door',manualDoor>.01);},
        click:()=>ctrl.push('door',!c.door),
        end:({click})=>{if(!click&&manualDoor!==null)ctrl.push('door',manualDoor>=.5);manualDoor=null;}
      },d);
    }
    const hmiActions={};
    const button=(id,label,hint,action,read,latched)=>{const control={type:'button',pressAxis:hmi.pressAxis?.(id)||'y',label,hint,action,read,latched};hmiActions[id]=control;ctrl.reg(control,hmi.controls.buttons[id]);};
    apiRef.current.hmiAction=id=>{const control=hmiActions[id];if(control){control.pressT=t;control.action();}};
    apiRef.current.setHmiOverride=(key,value)=>{if(key==='fo'||key==='ro')set(key,Math.max(key==='fo'?0:5,Math.min(key==='fo'?150:100,Math.round(value))));};
    button('start',L('Štart cyklu','Cycle start'),L('Spustí alebo obnoví program pri zatvorených dverách.','Start / resume the program with the doors closed.'),()=>{if(apiRef.current.start()==='ok')ctrl.push('running',true);});
    button('hold',L('Stop posuvu','Feed hold'),L('Pozastaví program. Zelené tlačidlo pokračuje.','Pause the program. Green resumes.'),()=>{apiRef.current.hold();ctrl.push('running',false);});
    button('emergency',L('Núdzový STOP','Emergency STOP'),L('Zastaví stroj. Klik uvoľní; potom Reset.','Stop the machine. Click to release, then Reset.'),()=>apiRef.current.emergency(),()=>c.estop?L('stlačený','latched'):L('uvoľnený','released'),()=>c.estop);
    button('reset','Reset',L('Vynuluje program a potvrdí alarm po uvoľnení STOP.','Reset the program and clear an alarm after releasing STOP.'),()=>apiRef.current.reset());
    button('single',L('Blok po bloku','Single block'),L('Prepne vykonávanie po jednotlivých blokoch.','Toggle single-block execution.'),()=>ctrl.push('single',!c.single),()=>c.single?L('zapnuté','on'):L('vypnuté','off'));
    button('light',L('Pracovné osvetlenie','Work light'),L('Zapne alebo vypne svetlo pracovného priestoru.','Toggle the work light.'),()=>ctrl.push('light',!c.light),()=>c.light?L('zapnuté','on'):L('vypnuté','off'));
    button('coolant',L('Chladenie','Coolant'),L('Prepne chladenie; príkazy programu M8/M9 môžu stav zmeniť.','Toggle coolant; program M8/M9 can change its state.'),()=>{if(ex&&!c.estop)ex.S.cool=!ex.S.cool;},()=>ex?.S.cool?L('zapnuté','on'):L('vypnuté','off'));
    for(const [id,key,max,min] of [['feed','fo',150,0],['rapid','ro',100,5]]){
      ctrl.reg({type:'wheel',axis:hmi.knobAxis||'y',minR:.12,inc:1,label:id==='feed'?L('Korekcia posuvu','Feed override'):L('Korekcia rýchloposuvu','Rapid override'),
        hint:L('Otáčaj ťahaním alebo kolieskom myši.','Turn by dragging or using the mouse wheel.'),read:()=>`${c[key]} %`,
        turn:(a)=>ctrl.push(key,Math.max(min,Math.min(max,Math.round(c[key]+a*40))))},hmi.controls.knobs[id]);
    }
    // Use the same detach / rotate / return mechanism as the lathe.
    let savedDoor=true,savedManual=false;
    const wi=createWorkInspect({scene,camera,dom,insp,c,getObj:()=>stockG,
      getSpot:()=>v3(0,PY+2*K,14*K),canDetach:()=>doorK>=.995,
      onState:unclamped=>{
        set('unclamped',unclamped);set('manual',unclamped?false:savedManual);
        if(!unclamped){set('door',savedDoor);msg=null;}
      }});
    apiRef.current.toggleWork=()=>{
      if(wi.phase()==='in'){
        if(c.running){msg=L('Najprv zastav posuv.','Stop the feed first.');return;}
        if(!stockG.children.length){msg=L('Nie je dostupný obrobok na prehliadku.','No workpiece is available to inspect.');return;}
        savedDoor=c.door;savedManual=c.manual;
        set('door',true);manualDoor=null;
        msg=L('Otváranie dverí a odopínanie obrobku…','Opening the doors and unclamping the workpiece…');
      }
      if(!wi.toggle())msg=L('Počkaj na dokončenie pohybu obrobku.','Wait until the workpiece movement finishes.');
    };
    apiRef.current.view = (n) => {if(!c.unclamped)insp.goView(n, false);};
    insp.goView('celok', true);

    // ---------------- triesky a chladenie ----------------
    const chips = createParticles(scene, new THREE.BoxGeometry(0.04, 0.012, 0.07), std(0xc9ced3, 0.3, 0.85), 220);
    const drops = createParticles(scene, new THREE.SphereGeometry(0.025, 5, 4), new THREE.MeshStandardMaterial({ color: 0xdfeaf2, roughness: 0.1, transparent: true, opacity: 0.7 }), 160, false);

    let panelDrag = null;
    const panelDown = (e) => {
      if (!c.manual || c.unclamped || c.hmiLocked || e.button !== 0) return;
      if(ctrl.hitAt(e.clientX,e.clientY))return;
      const hit=ctrl.pickAt(e.clientX,e.clientY);
      let obj=hit?.object;while(obj&&obj!==panG)obj=obj.parent;
      if(obj!==panG)return;
      panelDrag = { id: e.pointerId, x: e.clientX, key: e.shiftKey ? 'panelYaw' : 'panelAngle', start: e.shiftKey ? c.panelYaw : c.panelAngle };
      dom.setPointerCapture(e.pointerId); e.stopImmediatePropagation(); e.preventDefault();
    };
    const panelMove = (e) => {
      if (!panelDrag || panelDrag.id !== e.pointerId) return;
      if(!c.manual||c.hmiLocked||c.unclamped){panelUp(e);return;}
      const v = panelDrag.start + (e.clientX - panelDrag.x) * .5;
      set(panelDrag.key, panelDrag.key === 'panelAngle' ? Math.max(0, Math.min(180, v)) : ((v + 180) % 360 + 360) % 360 - 180);
      e.stopImmediatePropagation(); e.preventDefault();
    };
    const panelUp = (e) => { if (panelDrag?.id === e.pointerId) { panelDrag = null; e.stopImmediatePropagation(); if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId); } };
    const openHmi=e=>{
      if(!c.manual)return;
      const hit=ctrl.pickAt(e.clientX,e.clientY);
      if(hit?.object!==sm)return;
      e.preventDefault();e.stopPropagation();setHmiOpen(true);
    };
    apiRef.current.lockHmi=()=>{
      if(!c.hmiLocked){
        set('panelAngle',panelA*180/Math.PI);set('panelYaw',panelYaw*180/Math.PI);
        if(panelDrag){const id=panelDrag.id;panelDrag=null;if(dom.hasPointerCapture(id))dom.releasePointerCapture(id);}
      }
      set('hmiLocked',!c.hmiLocked);
    };
    dom.addEventListener('dblclick',openHmi);
    dom.addEventListener('pointerdown', panelDown, true); dom.addEventListener('pointermove', panelMove, true);
    dom.addEventListener('pointerup', panelUp, true); dom.addEventListener('pointercancel', panelUp, true);

    // ---------------- hlavná slučka ----------------
    let raf, last = performance.now(), teleT = 0, scrT = 0, doorK = c.door ? 1 : 0, magA = 0, panelA = 0, panelYaw = 0, spinA = 0, t = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // dvere: otvorenie počas chodu zastaví posuv (bezpečnostný zámok)
      if (c.door && c.running) { c.running = false; c.fast = false; msg = L('Dvere sa otvorili – posuv a vreteno zastavené.', 'The doors opened – feed and spindle stopped.'); }
      if(c.unclamped){c.running=false;c.fast=false;c.door=true;c.manual=false;}
      if(manualDoor!==null)doorK=manualDoor;else doorK += ((c.door ? 1 : 0) - doorK) * Math.min(1, dt * 4);
      if(!rxu)doors.forEach((d) => { d.position.set(d.userData.s * (2.2 + doorK * 4.0), 6.4, 8.82); });
      wi.update(dt);
      clampPins.forEach(pin=>{pin.position.z=FIX.r*U+wi.open()*.12;});
      const xc = xG.position.x / K;
      covers.forEach((me, i) => { const x0 = i ? xc + 1.95 : -6.9, x1 = i ? 6.9 : xc - 1.95, w = Math.max(0.05, x1 - x0); me.scale.x = w; me.position.x = (x0 + x1) / 2; me.material.map.repeat.set(w / 2.2, 1); });
      cab.visible = c.cabin;lighting.update({ cabin: c.cabin, light: c.light, opening: doorK });
      hmi.controls.knobs.feed.rotation[hmi.knobAxis||'y']=(c.fo-100)*Math.PI/75;hmi.controls.knobs.rapid.rotation[hmi.knobAxis||'y']=(c.ro-100)*Math.PI/50;
      accessories.update(c, dt);
      if(!c.hmiLocked)panelA += ((c.panelAngle || 0) * Math.PI / 180 - panelA) * Math.min(1, dt * 4);
      const armPose = hmiPose(panelA*180/Math.PI,0,bodyHalf,K);
      if(!rxu)armPivot.rotation.y = armPose.angle;
      if(!rxu)armElbow.rotation.y = armPose.elbow;
      if(!c.hmiLocked)panelYaw += ((c.panelYaw || 0) * Math.PI / 180 - panelYaw) * Math.min(1, dt * 8);
      if(!rxu)panG.rotation.y = hmiPose(panelA*180/Math.PI, panelYaw*180/Math.PI, bodyHalf,K).yaw - armPose.angle - armPose.elbow;
      geometry.updateGeometry?.({doorK,panelA,panelYaw});
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
      const change = S && prog?.moves[S.idx]?.kind === 'tc' ? prog.moves[S.idx] : null;
      const indexedT = change ? (S.tcPhase < .4 ? change.from : change.to) : T;
      const targetA = indexedT ? -(indexedT - 1) / MC.mag * Math.PI * 2 : magA;
      const deltaA = Math.atan2(Math.sin(targetA - magA), Math.cos(targetA - magA));
      magA += deltaA * Math.min(1, dt * 10 * (c.running ? c.speed : 1)); magG.rotation.y = magA; driveShaft.rotation.y = magA;
      // triesky a emulzia pri reze
      const tipW = toolTip();
      if (S && S.cutting && c.running) {
        const n = Math.min(6, 1 + Math.floor((S.mrr || 0) / 60));
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sv = 2 + Math.random() * 3; chips.spawn(v3(tipW.x, tipW.y + 0.05, tipW.z), v3(Math.cos(a) * sv, 1 + Math.random() * 2.5, Math.sin(a) * sv), 2.2); }
      }
      if (S && S.cool && c.running) for (let i = 0; i < 3; i++) drops.spawn(v3(tipW.x + 0.9, tipW.y + 2.2, tipW.z + 0.4), v3(-1.6 + Math.random() * 0.4, -3.4, -0.7 + Math.random() * 0.4), 0.7, 8);
      chips.update(dt, () => 7.25); drops.update(dt, () => 7.25);
      snd.update({ motor: spinOn ? Math.min(1, S.spin / MC.smax) : 0, cut: S && S.cutting && c.running ? Math.min(1, 0.3 + (S.load || 0)) : 0 });
      insp.update(t, c);ctrl.update(dt);
      if(Object.keys(ctrl.pend).length){const next={...ctrl.pend};for(const k of Object.keys(ctrl.pend))delete ctrl.pend[k];setUi(u=>({...u,...next}));}
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
          F: mv && mv.kind !== 'tc' ? (mv.rapid ? -1 : Math.round((mv.F || 0) * c.fo / 100)) : 0, load: S.load || 0, mrr: (S.mrr || 0) * 60 / 1000, t: S.t, removed: S.removed / 1000, busy, building: false, maxLoad, msg, cool: !!S.cool });
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    try { if (/[?&]debug/.test(window.location.search)) window.__hermle = { c, lighting, equipment: accessories.equipment, root, camera, armPivot, armElbow, panG, hmiControls:hmi.controls, workInspect:wi, stockG, clampPins, insp, manualControls:ctrl, doors, get doorTravel(){return doorK;}, driveShaft, magazine: magG, magDrive: saddle, get ex() { return ex; }, get prog() { return prog; }, get stock() { return stock; } }; } catch (err) { /* ignorované */ }
    return () => { cancelAnimationFrame(raf); dom.removeEventListener('dblclick',openHmi);dom.removeEventListener('pointerdown', panelDown, true); dom.removeEventListener('pointermove', panelMove, true); dom.removeEventListener('pointerup', panelUp, true); dom.removeEventListener('pointercancel', panelUp, true); snd.dispose(); ctrl.dispose(); wi.dispose(); insp.dispose(); clearStock(); if (mat) mat.dispose(); try { delete window.__hermle; } catch (err) { /* ignorované */ } disposeStage(); };
  }, []);

  // program, nástroje alebo polotovar sa zmenili → znova interpretovať (pri zastavenom stroji)
  const reload = (txt = text, tls = tools) => { if (!ctl.current.unclamped && apiRef.current.load) { set('running', false); setCheck(apiRef.current.load(txt, tls)); } };
  useEffect(() => { const h = setTimeout(() => reload(), 350); return () => clearTimeout(h); }, [text, tools, ui.mat, ui.sx, ui.sy, ui.sz, ui.res]);
  const pickSample = (id) => { const s = samples.find((x) => x.id === id); setProgId(id); if (s) setText(s.text); };
  const onFile = (e) => {
    const fl = e.target.files && e.target.files[0]; if (!fl) return;
    setProgramImportError('');
    if (ctl.current.running || ctl.current.unclamped || fl.size > MAX_FILE_BYTES) { setProgramImportError(L('Zastav stroj a upni obrobok. Najväčší súbor je 2 MB.','Stop the machine and clamp the part. File limit is 2 MB.')); e.target.value = ''; return; }
    const rd = new FileReader(); rd.onload = () => { if (ctl.current.running || ctl.current.unclamped) { setProgramImportError(L('Načítanie zrušené: stroj je v chode alebo je obrobok odopnutý.','Load cancelled: machine is running or workpiece is unclamped.')); return; } setLibrarySource({text:String(rd.result || ''),name:fl.name}); setLibraryTab('detect'); }; rd.onerror = () => setProgramImportError(L('Súbor sa nepodarilo prečítať.','Could not read the file.')); rd.readAsText(fl); e.target.value = '';
  };
  const save = (blob, nameF) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nameF; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  const canEditTools = !ctl.current.running && !tele.run && !ui.unclamped;
  const requireStopped = () => { if (ctl.current.running || ctl.current.unclamped) throw new Error(L('Najprv zastav stroj a upni obrobok.', 'Stop the machine and clamp the workpiece first.')); };
  const openToolPicker = (pocket,toolId) => { setLibraryPocket(pocket);setLibraryToolId(toolId);setLibraryReturn(null);setLibraryTab('pick'); };
  const closeLibrary = () => {setLibraryTab(null);setLibrarySource(null);setLibraryPocket(undefined);setLibraryToolId(undefined);setLibraryReturn(null);};
  const closePicker = () => { if(libraryReturn){setLibrarySource(libraryReturn.source);setLibraryTab(libraryReturn.tab);setLibraryReturn(null);}else closeLibrary(); };
  const installSavedTool = (tool,pocket) => {requireStopped();if(rxu)validateRxuTool(tool);setTools(ts=>installTool(ts,tool,pocket,MC.mag));};
  const freePocket = Array.from({length:MC.mag},(_,i)=>i+1).find(t=>!tools.some(tool=>tool.t===t));
  const start = () => { const r = apiRef.current.start && apiRef.current.start(); if (r === 'ok') set('running', true); };
  const parts = hermleParts();
  if(rxu){
    const detail={kabina:['Pracovná kabína RXU','Ľavé bočné pozorovacie okno a červené nakladacie dvere otvárané doprava okolo pravého pántu.','Left observation window and red loading door opening to the right around its right hinge.'],lozko:['QUADROGUIDE','Masívne lôžko, priame pohony a teplotná stabilizácia.','Massive bed, direct drives and thermal stabilisation.'],osi:['QUADROGUIDE · X/Y/Z','Dráhy 800 × 855 × 500 mm; štyri vedenia v rohoch osi Z.','800 × 855 × 500 mm travel; four guide rails at the corners of Z.'],vreteno:['HSK-A63 · 24 000 ot/min','Štandardné vreteno 67 Nm S1, nástroj max. Ø35 mm.','Standard spindle 67 Nm S1, tool max. Ø35 mm.'],stol:['A/C · Ø600 mm','Obojstranné uloženie, A ±115°, C neobmedzene; nosnosť 800 kg.','Two-sided support, A ±115°, continuous C; 800 kg load.'],zasobnik:['24 miest / pockets','Štandardný rotačný zásobník. Čas výmeny v simulácii je odhad.','Standard rotary magazine. Simulated tool-change timing is estimated.'],panel:['Röders RMS6','Výukové ISO rozhranie; nejde o emuláciu proprietárneho RMS6.','Training ISO interface; not an emulation of proprietary RMS6.']};
    for(const [key,v] of Object.entries(detail)){const part=parts.find(p=>p.key===key);if(part){part.name=v[0];part.desc=L(v[1],v[2]);}}
  }
  const status = ui.unclamped ? {kind:'info',text:L('Prehliadka obrobku: ťahaním ho otáčaj, kolieskom približuj. Potom ho upni späť.','Workpiece inspection: drag to rotate, scroll to zoom, then clamp it back.')} : tele.alarm ? { kind: 'danger', text: `${L('Alarm', 'Alarm')}: ${tele.alarm.text} (${L('riadok', 'line')} ${tele.alarm.line + 1})` }
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
    <div className="machine-app modern-app hermle-app w-full flex flex-col md:flex-row">
      <SceneView mountRef={mountRef} layerRef={layerRef} tipRef={tipRef} ui={ui} set={set} parts={parts} selected={selected} selectPart={selectPart} chips={chips} onBack={onBack} apiRef={apiRef} canUnclamp workBelowModes workLabels={[L('Pozrieť obrobok','Inspect workpiece'),L('Upnúť späť','Clamp back')]}
        tools={<button type="button" className={`scene-btn ${ui.hmiLocked?'on':''}`} aria-pressed={ui.hmiLocked} aria-label={L('HMI','HMI')} onClick={()=>apiRef.current.lockHmi?.()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d={ui.hmiLocked?'M8 10V6a4 4 0 0 1 8 0v4':'M8 10V6a4 4 0 0 1 8 0'} /><path d="M12 14v3" /></svg>
          HMI
        </button>}
        tips={[L('Dvere v ručnom režime otvoríš alebo zatvoríš kliknutím na madlo či ťahaním do strany. Tlačidlo HMI zaistí aktuálnu polohu ramena a panela; ďalším kliknutím ju odistíš.', 'In manual mode, click a door handle or drag it sideways to open or close the doors. HMI locks the current arm and panel position; click again to unlock.'),
          L('Nulový bod G54 je v strede hornej plochy polotovaru; nástroje T1 – T10 sú v tabuľke (alebo sa prevezmú z komentárov CAM programu).', 'Datum G54 is at the centre of the top face of the blank; tools T1 – T10 are in the table (or taken over from the CAM program comments).'),
          L('Bez G43 / G43.4 (alebo TOOL CALL) je naprogramovaná výška čelo vretena – nástroj potom ide o svoju dĺžku hlbšie.', 'Without G43 / G43.4 (or TOOL CALL) the programmed height is the spindle nose – the tool then goes deeper by its length.'),
          L('Pohľad Nástroj ukáže detail rezu; rýchlosť simulácie a korekcie posuvu sú v paneli.', 'The Tool view shows a close-up of the cut; simulation speed and feed overrides are in the panel.')]} />
      {libraryTab==='pick'&&<ToolPicker tools={tools} capacity={MC.mag} canApply={canEditTools} initialPocket={libraryPocket||1} initialToolId={libraryToolId} onInstall={installSavedTool} onClose={closePicker} backLabel={libraryReturn?L('Späť do skrinky','Back to cabinet'):undefined}/>}
      {libraryTab&&libraryTab!=='pick'&&<ToolLibrary initialTab={libraryTab} initialPocket={libraryPocket} initialToolId={libraryToolId} initialNc={librarySource?.text} initialName={librarySource?.name} tools={tools} program={text} capacity={MC.mag} canApply={canEditTools}
        onChoose={(tool,source)=>{openToolPicker(libraryPocket||Math.min(MC.mag,tool.t),tool.id);setLibraryReturn({tab:libraryTab,source});}}
        onLoadProgram={txt=>{requireStopped();setProgId('');setText(txt);}}
        onClose={closeLibrary} />}
      {hmiOpen&&<HmiFullscreen apiRef={apiRef} ui={ui} tele={tele} model={MC.name} brand={brand} controller={controller} compactOnly={rxu} onClose={()=>setHmiOpen(false)} />}
      <aside className="panel"><fieldset className="hermle-settings" disabled={ui.unclamped}>
        <div className="sec">
          <p className="sec-title" style={{ letterSpacing: '.14em' }}>{L('Moderné stroje · 5-osé CNC', 'Modern machines · 5-axis CNC')}</p>
          <h1 className="app-title mt-2" tabIndex={-1}>{brand} {MC.name}</h1>
          {!rxu&&<div className="mt-2"><SegRow label={L('Model', 'Model')} value={model} options={Object.values(MODELS).map((x) => [x.id, x.name])} onChange={(v) => { if (!tele.run) setModel(v); }} /></div>}
          <p className="text-xs muted">{rxu?L('QUADROGUIDE · X 800 / Y 855 / Z 500 mm · A ±115° · stôl Ø600 mm (katalógový variant), 800 kg · HSK-A63, 24 000 ot/min, 67 Nm S1 · 24 miest. Výučbové ISO rozhranie pre RMS6; čas výmeny, dynamika rotačných osí a zaťaženie sú odhady.','QUADROGUIDE · X 800 / Y 855 / Z 500 mm · A ±115° · Ø600 mm table (catalogue variant), 800 kg · HSK-A63, 24,000 rpm, 67 Nm S1 · 24 pockets. Educational ISO interface for RMS6; change time, rotary dynamics and load are estimates.'):L(`5-osé obrábacie centrum: dráhy ${MC.X[1] * 2} × ${MC.Y[1] * 2} × ${MC.nose[1] - MC.nose[0]} mm, otočno-sklopný stôl Ø${MC.table} (A ±130°, C 360°), vreteno ${MC.smax} ot/min HSK-A63, ${MC.pmax} kW, ${MC.mag} miest v zásobníku, Heidenhain TNC 640. Prídavné zariadenia sa zapínajú samostatne nižšie.`, `5-axis machining centre: travels ${MC.X[1] * 2} × ${MC.Y[1] * 2} × ${MC.nose[1] - MC.nose[0]} mm, swivelling rotary table Ø${MC.table} (A ±130°, C 360°), ${MC.smax} rpm HSK-A63 spindle, ${MC.pmax} kW, ${MC.mag} magazine pockets, Heidenhain TNC 640. Optional equipment can be enabled separately below.`)}{MC.approx ? L(' Údaje C 42 U sú orientačné.', ' C 42 U data are approximate.') : ''}</p>
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
            <button type="button" className={`btn ${ui.estop ? 'active' : ''}`} onClick={() => apiRef.current.emergency?.()}>{ui.estop ? L('Uvoľniť núdzový STOP','Release Emergency STOP') : L('Núdzový STOP','Emergency STOP')}</button>
            <button type="button" className={`btn ${ui.door ? 'active' : ''}`} onClick={() => set('door', !ui.door)}>{ui.door ? L('Zatvoriť dvere', 'Close doors') : L('Otvoriť dvere', 'Open doors')}</button>
          </div>
          <div className="mt-2">
            <SegRow label={L('Rýchlosť simulácie', 'Simulation speed')} value={ui.speed} options={[[1, '×1'], [5, '×5'], [20, '×20'], [80, '×80']]} onChange={(v) => set('speed', v)} />
            <SegRow label={L('Korekcia posuvu', 'Feed override')} value={ui.fo} options={[[50, '50 %'], [100, '100 %'], [120, '120 %'], [150, '150 %']]} onChange={(v) => set('fo', v)} />
            <SegRow label={L('Rýchloposuv', 'Rapid')} value={ui.ro} options={[[5, '5 %'], [25, '25 %'], [50, '50 %'], [100, '100 %']]} onChange={(v) => set('ro', v)} />
            <Toggle on={ui.light} label={L('Pracovné osvetlenie','Work light')} onClick={() => set('light',!ui.light)} />
            <Toggle on={ui.single} label={L('Blok po bloku', 'Single block')} onClick={() => set('single', !ui.single)} />
            <fieldset className="hermle-hmi-position" disabled={ui.hmiLocked}>
            <SegRow label={L('Poloha ovládacieho panela', 'Control panel position')} value={ui.panelAngle} options={[[0, L('Obsluha', 'Operator')], [90, L('Bok', 'Side')], [180, L('Zásobník', 'Magazine')]]} onChange={(v) => set('panelAngle', v)} />
            <Slider id="hermle-arm-angle" label={L('Uhol ramena HMI', 'HMI arm angle')} min={0} max={180} step={0.1} digits={1} disabled={ui.hmiLocked} value={ui.panelAngle} unit="°" onChange={(v) => set('panelAngle', v)} />
            <Slider id="hermle-panel-yaw" label={L('Korekcia natočenia HMI', 'HMI rotation trim')} min={-180} max={180} step={0.1} digits={1} disabled={ui.hmiLocked} value={ui.panelYaw} unit="°" onChange={(v) => set('panelYaw', v)} />
            </fieldset>
            <button type="button" className="btn mb-2" onClick={() => apiRef.current.view?.('panel')}>{L('Pohľad na HMI', 'HMI view')}</button>
            {ui.manual&&<button type="button" className="btn mb-2 ml-2" onClick={()=>{if(ctl.current.manual)setHmiOpen(true);}}>{L('HMI cez celé okno','Full-screen HMI')}</button>}
            <p className="text-xs muted mb-2">{L('Rameno 0–180°; panel sa natočí k operátorovi automaticky. Korekcia umožňuje vlastné natočenie o 360°. V ručnom ovládaní potiahni panel; Shift + potiahnutie otáča iba panel. Dvojklik na displej otvorí HMI cez celé okno.', '0–180° arm swing; the panel automatically faces the operator. Trim allows a full 360° manual adjustment. In manual mode, drag the panel; Shift + drag rotates only the panel. Double-click the display for full-screen HMI.')}</p>
            <Toggle on={ui.cabin} label={L('Zobraziť kabínu', 'Show the cabin')} onClick={() => set('cabin', !ui.cabin)} />
          </div>
        </div>

        {rxu&&<div className="sec"><h2 className="sec-title mb-2">{L('Prídavné vybavenie podľa pôdorysu','Optional equipment from layout')}</h2><select className="sel" aria-label={L('Vybavenie Röders','Röders equipment')} value={ui.accessorySetup} onChange={e=>set('accessorySetup',e.target.value)}><option value="none">{L('Vypnuté','Off')}</option><option value="cooling">{L('Chladiaca jednotka 1050 × 750 mm','Cooling unit 1050 × 750 mm')}</option><option value="filter">{L('Chladenie + pásový filter 1523 × 1390 mm','Cooling + band filter 1523 × 1390 mm')}</option></select><button className="btn mt-2" onClick={()=>apiRef.current.view?.('vybavenie')}>{L('Pohľad na vybavenie','Equipment view')}</button><p className="text-xs muted mt-2">{L('Predvolene vypnuté. Pôdorysné rozmery z katalógu; výšky a vnútorné diely sú vizuálny odhad.','Off by default. Plan dimensions follow the catalogue; heights and internal parts are visual estimates.')}</p></div>}
        {!rxu&&<>
        <div className="sec">
          <h2 className="sec-title mb-2">{L('Prídavné vybavenie', 'Optional equipment')}</h2>
          <label className="text-sm font-semibold" htmlFor="hermle-accessories">{L('Katalógová zostava', 'Catalogue configuration')}</label>
          <select id="hermle-accessories" className="sel mt-2" value={ui.accessorySetup} onChange={(e) => { set('accessorySetup', e.target.value); apiRef.current.view?.('celok'); }}>
            <option value="none">{L('Základ – zásuvka na triesky', 'Basic – chip drawer')}</option>
            <option value="conveyor">{L('Dopravník triesok s vozíkom', 'Chip conveyor with cart')}</option>
            <option value="ics40">{L('Dopravník + vnútorné chladenie ICS 40', 'Conveyor + internal coolant ICS 40')}</option>
            <option value="ics80">{L('Dopravník + vnútorné chladenie ICS 80', 'Conveyor + internal coolant ICS 80')}</option>
            <option value="ics80cooler">{L('Dopravník + ICS 80 + dochladzovacia jednotka', 'Conveyor + ICS 80 + recooling unit')}</option>
          </select>
          <p className="text-xs muted mt-2">{L('Prídavné vybavenie je predvolene vypnuté. Zostavy podľa katalógu sa navzájom nahrádzajú; chladiace jednotky sú znázornené vizuálne.', 'Optional equipment is off by default. Catalogue configurations replace one another; coolant units are represented visually.')}</p>
          <button type="button" className="btn mt-2" onClick={() => apiRef.current.view && apiRef.current.view('vybavenie')}>{L('Pohľad na vybavenie', 'Equipment view')}</button>
        </div>

        </>}
        <div className="sec">
          <h2 className="sec-title mb-2">{L('CNC program', 'CNC program')}</h2>
          <select className="sel mb-2" value={progId} onChange={(e) => pickSample(e.target.value)} aria-label={L('Ukážkový program', 'Sample program')}>
            {!progId && <option value="">{L('Vlastný / načítaný program', 'Own / loaded program')}</option>}
            {samples.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2 mb-2">
            <button type="button" className="btn" disabled={!canEditTools} onClick={() => fileRef.current && fileRef.current.click()}>{L('Načítať z PowerMill / CAM…', 'Load from PowerMill / CAM…')}</button>
            <button type="button" className="btn" onClick={() => save(new Blob([text], { type: 'text/plain' }), check.dialect === 'heidenhain' ? 'program.h' : 'program.nc')}>{L('Uložiť program', 'Save program')}</button>
            <input ref={fileRef} type="file" accept=".nc,.ngc,.tap,.cnc,.iso,.gcode,.h,.mpf,.txt,.eia,.ptp" style={{ display: 'none' }} onChange={onFile} />
          </div>
          {programImportError&&<p className="msg msg-danger" role="alert">{programImportError}</p>}
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
          <div className="flex flex-wrap gap-2 mb-2">
            <button type="button" className="btn" disabled={!canEditTools} onClick={()=>openToolPicker(freePocket||1)}>{L('Vybrať nástroj zo skrinky…','Choose a tool from cabinet…')}</button>
            <button type="button" className="btn" onClick={()=>{setLibraryPocket(undefined);setLibraryTab('cabinet');}}>{L('Spravovať skrinku…','Manage cabinet…')}</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2"><button type="button" className="btn" onClick={()=>setLibraryTab('detect')}>{L('Detekovať nástroje z NC…','Detect tools from NC…')}</button><button type="button" className="btn" onClick={()=>setLibraryTab('powermill')}>PowerMill / CAM</button></div>
          <p className="text-xs muted">{L('Rozmery sa upravujú v skrinke. Nový nástroj najprv ulož do skrinky a potom ho vyber pre miesto T v zásobníku.','Edit dimensions in the cabinet. Save a new tool there first, then choose it for a magazine pocket T.')}</p>
          <ul className="cnc-installed-tools" aria-label={L('Osadené nástroje','Installed tools')}>
            {tools.map(tool=><li key={tool.t} className={tool.t===tele.T?'cur':''}>
              <b className="cnc-pocket">T{tool.t}</b><CncToolPreview tool={tool} fit/>
              <div><strong>{tool.name}</strong><span>Ø{tool.d} · R{tool.cr} · L{tool.l} mm</span></div>
              <button type="button" className="btn" disabled={!canEditTools} aria-label={L(`Vybrať nástroj pre T${tool.t}`,`Choose tool for T${tool.t}`)} onClick={()=>openToolPicker(tool.t)}>{L('Zmeniť','Change')}</button>
            </li>)}
          </ul>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Výsledok', 'Result')}</h2>
          <div className="text-sm tnum" style={{ lineHeight: 1.6 }}>
            <div>{L('Čas obrábania', 'Machining time')}: <b>{mmss(tele.t)}</b> / {L('odhad', 'estimate')} {mmss(check.time)}</div>
            <div>{L('Odobratý objem', 'Removed volume')}: <b>{fmt(tele.removed, 1)} cm³</b></div>
            <div>{L('Najväčšie zaťaženie vretena', 'Peak spindle load')}: <b>{Math.round(tele.maxLoad * 100)} %</b></div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="btn" onClick={() => { const b = apiRef.current.stl && apiRef.current.stl(); if (b) save(b, `${model}-obrobok.stl`); }}>{L('Stiahnuť STL obrobku', 'Download part STL')}</button>
            <StepDownloadButton machine={model} apiRef={apiRef} />
            <button type="button" className="btn" onClick={() => apiRef.current.snapshot && apiRef.current.snapshot((b) => b && save(b, `${model}.png`))}>{L('Snímka PNG', 'PNG snapshot')}</button>
          </div>
        </div>

        <div className="sec">
          <h2 className="sec-title mb-2">{L('Program z CAM', 'Program from CAM')}</h2>
          <div className="text-xs" style={{ lineHeight: 1.55 }}>
            <p>{L('Simulátor číta výstup postprocesorov CAM (PowerMill, Fusion 360, Mastercam, hyperMILL, SolidCAM, NX …):', 'The simulator reads CAM post-processor output (PowerMill, Fusion 360, Mastercam, hyperMILL, SolidCAM, NX …):')}</p>
            <ul className="ctl-list" style={{ marginTop: 4 }}>
              <li><b>ISO / Fanuc:</b> G0 G1 G2 G3 (I J K / R), G17–G19, G90 / G91, G93 / G94, G43 H, G43.4 (TCP), G49, G68.2 + G53.1, G69, G81 / G82 / G83 / G73, G53, G28, M3 M4 M5 M6 M8 M9 M0 M1 M30, osi A a C.</li>
              <li><b>Heidenhain Klartext:</b> BLK FORM, TOOL CALL, L, CC, C, CR, FMAX, M128 / FUNCTION TCPM, PLANE SPATIAL / RESET, CYCL DEF 200, CYCL CALL / M99, M140.</li>
              <li>{L('Postprocesor: Fanuc / Heidenhain 5-osí s otočno-sklopným stolom A/C, výstup v mm, dráha stredu nástroja (bez G41/G42), nulový bod v strede hornej plochy polotovaru.', 'Post-processor: Fanuc / Heidenhain 5-axis with an A/C trunnion table, output in mm, tool centre path (no G41/G42), datum at the centre of the top face of the blank.')}</li>
              <li>{L('Komentáre nástrojov typu „T3 D=10. CR=0. - flat end mill“ skontroluj cez Detekovať nástroje z NC; doplň chýbajúce rozmery a osaď ich cez knižnicu.', 'Review tool comments such as “T3 D=10. CR=0. - flat end mill” in Detect tools from NC; fill in missing dimensions and install them through the library.')}</li>
            </ul>
          </div>
        </div>

        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['priestor', L('Pracovný priestor', 'Working area')], ['obrobok', L('Obrobok', 'Workpiece')], ['nastroj', L('Nástroj', 'Tool')], ['zhora', L('Zhora', 'Top')], ['zasobnik', L('Zásobník', 'Magazine')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter />
      </fieldset></aside>
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
  return <CncCore key={model} {...{ onBack, model, setModel, text, setText, tools, setTools, progId, setProgId }} />;
}

export { HermleSimulator, CncCore };
export default HermleSimulator;
