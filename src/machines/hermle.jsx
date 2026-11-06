import { SectionInfo } from '../ui/sectionInfo';
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
import { cabinHalfWidth, hmiPose } from './cnc/hermleLayout';
import { HmiFullscreen } from '../ui/hmiFullscreen';
import { StepDownloadButton } from '../ui/tools';
import { CncToolPreview } from '../ui/cncToolPreview';
import { ToolLibrary } from '../ui/toolLibrary';
import { ToolPicker } from '../ui/toolPicker';
import { installTool, MAX_FILE_BYTES } from './cnc/toolLibrary';
import { createStock } from './cnc/voxel';
import { createCabinLighting } from './cnc/cabinLighting';
import { createHermleModel } from './cnc/hermleModel';
import { createRoedersModel } from './precision/roedersModel';
import { RXU, validateRxuTool, RXU_PROGRAM } from './precision/profiles';

// =====================================================================
// 5-OSÉ OBRÁBACIE CENTRUM HERMLE C 32 – CNC program, 5-osá kinematika a úber materiálu
// =====================================================================
// mierka scény 1 = 100 mm. Scéna: x = X stroja, y hore, z = −Y stroja (k obsluhe). Otočný bod (os A ∩ os C) je
// v (0, PY, 0); plocha stola pri A = 0 je 100 mm pod ním (výška nakladania 950 mm). Prídavné zariadenia sa zapínajú samostatne nižšie.
const U = 0.01;
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
    apiRef.current.machineModel = { root, name: `${brand} ${MC.name}` };
    const G = {};
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const g = cv.getContext('2d'); const redraw = () => { draw(g, w, h); tx.needsUpdate = true; }; redraw(); return { tx, redraw, g }; };
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

    // Scene dimensions follow each catalogue; the CNC pose remains in real millimetres.
    const K = MC.K, PY = rxu?14:9.5+MC.hA*U, bodyHalf = rxu?12:cabinHalfWidth(MC);
    let scr = null;
    const geometry = rxu ? createRoedersModel({root,G,M,tex,MC,PY}) : createHermleModel({root,G,M,tex,MC,PY});
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
    const lighting = createCabinLighting(scene, root, { scale: K, halfWidth: bodyHalf, emitter: M.lamp, workHeight:rxu?13.4:9.5*K, ...geometry.lighting });
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
      if (c.door || geometry.serviceOpen?.()) { msg = L('Dvere sú otvorené – zatvor ich, potom spusti program.', 'The doors are open – close them, then start the program.'); return 'door'; }
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
    apiRef.current.ffwd = () => { if (!ex || ex.S.alarm || prog.errors.length || c.door || geometry.serviceOpen?.() || c.estop || c.unclamped) return; ex.S.paused = false; c.running = true; c.fast = true; };
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
    const toolTip = () => { const p = ex ? ex.S.pose.m : [0, MC.tcY, MC.nose[1]]; const point=[p[0]*U,PY+p[2]*U,-p[1]*U];return geometry.machinePoint?geometry.machinePoint(point):v3(...point); };
    const anchors = {
      kabina: () => v3(-9.5 * K, 25 * K, 8.7 * K), lozko: () => v3(9.6 * K, 4 * K, 8.5 * K), osi: () => v3(8.8 * K, 23.1 * K, -1.7 * K + yG.position.z), vreteno: () => v3(xG.position.x + 1.3 * K, zG.position.y + 1.5 * K, yG.position.z + 1.3 * K),
      stol: () => v3(-6.3 * K, PY - 2.5 * K, 2.0 * K), zasobnik: () => v3(4 * K, magY * K, magZ * K), panel: () => new THREE.Vector3(0, 17.8, 0).applyMatrix4(panG.matrixWorld), obrobok: () => toolTip().clone().setY(PY + 0.3),
    };
    Object.assign(anchors,geometry.anchorOverrides||{});
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
      ctrl.reg({type:'slide',axis:'x',tooltip:false,label:rxu?L('Posuvné dvere doprava','Right-sliding door'):L('Posuvné dvere','Sliding doors'),
        hint:rxu?L('Potiahni doprava po koľajnici alebo klikni.','Drag right along the rail or click.'):L('Potiahni madlo do strany alebo klikni na otvorenie / zatvorenie.','Drag the handle sideways or click to open / close.'),
        read:()=>c.door?L('otvorené','open'):L('zatvorené','closed'),
        start:()=>{doorDragStart=doorK;manualDoor=doorK;},
        slide:(dx)=>{manualDoor=Math.max(0,Math.min(1,doorDragStart+dx*d.userData.s/(geometry.doorTravel ?? (rxu?11.8:4)*K)));ctrl.push('door',manualDoor>.01);},
        click:()=>ctrl.push('door',!c.door),
        end:({click})=>{if(!click&&manualDoor!==null)ctrl.push('door',manualDoor>=.5);manualDoor=null;}
      },d);
    }
    for(const d of geometry.serviceDoors||[]){
      ctrl.reg({type:'button',still:true,tooltip:false,label:L(d.label,'Service door'),
        action:()=>{d.open=!d.open;if(d.open){apiRef.current.hold();ctrl.push('running',false);}},
        read:()=>d.open?L('otvorené','open'):L('zatvorené','closed')},d.hinge);
    }
    if(accessories.chipPan){
      const pan=accessories.chipPan;
      ctrl.reg({type:'button',still:true,tooltip:false,label:L('Zásuvka na triesky','Chip pan'),action:()=>{pan.open=!pan.open;}},pan.object);
    }
    if(accessories.chipCart){
      const cart=accessories.chipCart;
      ctrl.reg({type:'button',still:true,tooltip:false,label:L('Výklopný vozík','Tipping chip cart'),guard:()=>!c.running,action:()=>{cart.open=!cart.open;}},cart.object);
    }
    const hmiActions={};
    const button=(id,label,hint,action,read,latched)=>{const control={type:'button',pressAxis:hmi.pressAxis?.(id)||'y',label,hint,action,read,latched};hmiActions[id]=control;ctrl.reg(control,hmi.controls.buttons[id]);for(const duplicate of hmi.controls.duplicates?.[id]||[])ctrl.reg({...control,pressAxis:duplicate.axis},duplicate.object);};
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
      if ((c.door || geometry.serviceOpen?.()) && c.running) { c.running = false; c.fast = false; msg = L('Dvere sa otvorili – posuv a vreteno zastavené.', 'The doors opened – feed and spindle stopped.'); }
      if(c.unclamped){c.running=false;c.fast=false;c.door=true;c.manual=false;}
      if(manualDoor!==null)doorK=manualDoor;else doorK += ((c.door ? 1 : 0) - doorK) * Math.min(1, dt * 4);
      wi.update(dt);
      clampPins.forEach(pin=>{pin.position.z=FIX.r*U+wi.open()*.12;});
      const xc = xG.position.x / K;
      covers.forEach((me, i) => { const x0 = i ? xc + 1.95 : -6.9, x1 = i ? 6.9 : xc - 1.95, w = Math.max(0.05, x1 - x0); me.scale.x = w; me.position.x = (x0 + x1) / 2; me.material.map.repeat.set(w / 2.2, 1); });
      cab.visible = c.cabin;lighting.update({ cabin: c.cabin, light: c.light, opening: doorK });
      hmi.controls.knobs.feed.rotation[hmi.knobAxis||'y']=(c.fo-100)*Math.PI/75;hmi.controls.knobs.rapid.rotation[hmi.knobAxis||'y']=(c.ro-100)*Math.PI/50;
      accessories.update(c, dt);
      if(!c.hmiLocked)panelA += ((c.panelAngle || 0) * Math.PI / 180 - panelA) * Math.min(1, dt * 4);
      if(!c.hmiLocked)panelYaw += ((c.panelYaw || 0) * Math.PI / 180 - panelYaw) * Math.min(1, dt * 8);
      geometry.updateGeometry?.({doorK,panelA,panelYaw});
      geometry.updateServiceDoors?.(dt);
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
      geometry.updateAxes?.();
      const spinOn = S && S.dir && S.spin > 0 && !S.alarm && (c.running || false);
      spinA += spinOn ? dt * Math.min(60, S.spin / 60 * 2 * Math.PI) * 0.15 * (S.dir || 1) : 0; toolG.rotation.y = spinA;
      const change = S && prog?.moves[S.idx]?.kind === 'tc' ? prog.moves[S.idx] : null;
      geometry.updateTransfer?.(change,S?.tcPhase||0,toolsNow,T);
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
        setTele({ serviceDoorOpen:!!geometry.serviceOpen?.(), run: !!c.running, paused: S.paused, done: S.done, alarm: S.alarm, line: S.line, X: p.m[0], Y: p.m[1], Z: p.m[2] + Lt - MC.nose[1], A: p.a, C: p.c, wx: w[0], wy: w[1], wz: w[2], T, S: S.dir ? S.spin : 0,
          F: mv && mv.kind !== 'tc' ? (mv.rapid ? -1 : Math.round((mv.F || 0) * c.fo / 100)) : 0, load: S.load || 0, mrr: (S.mrr || 0) * 60 / 1000, t: S.t, removed: S.removed / 1000, busy, building: false, maxLoad, msg, cool: !!S.cool });
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    try { if (/[?&]debug/.test(window.location.search)) window.__hermle = { c, lighting, chipPan:accessories.chipPan, chipCart:accessories.chipCart, equipment: accessories.equipment, root, camera, serviceDoors:geometry.serviceDoors, serviceOpen:geometry.serviceOpen, armPivot, armElbow, panG, hmiControls:hmi.controls, workInspect:wi, stockG, clampPins, insp, manualControls:ctrl, doors, get doorTravel(){return doorK;}, driveShaft, magazine: magG, magDrive: saddle, get ex() { return ex; }, get prog() { return prog; }, get stock() { return stock; } }; } catch (err) { /* ignorované */ }
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
  if(!rxu){
    const dims=MC.id==='c42'?'800 × 800 × 550':'650 × 650 × 500',depth=MC.id==='c42'?630:540;
    const axis=parts.find(p=>p.key==='osi');axis.desc=L(`Tri lineárne osi nesie vreteno; priečnik Y jazdí po stenách minerálneho lôžka. Dráhy ${dims} mm, rýchloposuv 45 / 45 / 40 m/min.`,`The spindle carries all three linear axes; the Y crossbeam travels on the mineral-cast bed walls. Travel ${dims} mm, rapid 45 / 45 / 40 m/min.`);
    const table=parts.find(p=>p.key==='stol');table.name=L(`Otočno-sklopný stôl Ø${MC.table} × ${depth} mm`,`Swivelling rotary table Ø${MC.table} × ${depth} mm`);
    const spindle=parts.find(p=>p.key==='vreteno');spindle.desc=L(`18 000 ot/min, ${MC.pmax} kW / ${MC.mmax} Nm (20 % ED), HSK-A63.`,`18,000 rpm, ${MC.pmax} kW / ${MC.mmax} Nm (20% duty), HSK-A63.`);
    const magazine=parts.find(p=>p.key==='zasobnik');magazine.desc=L(`${MC.mag} miest v karuseli integrovanom do lôžka. Obvodové držiaky, nosný bubon, bočný pohon a vedenia nad prstencom. Výmena pick-up priamo vretenom.`,`${MC.mag} pockets in a carousel integrated into the bed. Perimeter forks, support drum, side drive and guideways above the ring. Direct spindle pick-up tool change.`);
  }
  if(rxu){
    const detail={kabina:['Pracovná kabína RXU','Ľavé bočné pozorovacie okno a červené čelné dvere posúvané doprava po spodnej koľajnici.','Left observation window and red front door sliding to the right along its lower rail.'],lozko:['QUADROGUIDE','Masívne lôžko, priame pohony a teplotná stabilizácia.','Massive bed, direct drives and thermal stabilisation.'],osi:['QUADROGUIDE · X/Y/Z','Dráhy 800 × 855 × 500 mm; štyri vedenia v rohoch osi Z.','800 × 855 × 500 mm travel; four guide rails at the corners of Z.'],vreteno:['HSK-A63 · 24 000 ot/min','Štandardné vreteno 67 Nm S1, nástroj max. Ø35 mm.','Standard spindle 67 Nm S1, tool max. Ø35 mm.'],stol:['A/C · Ø600 mm','Obojstranné uloženie, A ±115°, C neobmedzene; nosnosť 800 kg.','Two-sided support, A ±115°, continuous C; 800 kg load.'],zasobnik:['24 miest / pockets','Štandardný rotačný zásobník. Čas výmeny v simulácii je odhad.','Standard rotary magazine. Simulated tool-change timing is estimated.'],panel:['Röders RMS6','Výukové ISO rozhranie; nejde o emuláciu proprietárneho RMS6.','Training ISO interface; not an emulation of proprietary RMS6.']};
    for(const [key,v] of Object.entries(detail)){const part=parts.find(p=>p.key===key);if(part){part.name=v[0];part.desc=L(v[1],v[2]);}}
  }
  const status = ui.unclamped ? {kind:'info',text:L('Prehliadka obrobku: ťahaním ho otáčaj, kolieskom približuj. Potom ho upni späť.','Workpiece inspection: drag to rotate, scroll to zoom, then clamp it back.')} : tele.alarm ? { kind: 'danger', text: `${L('Alarm', 'Alarm')}: ${tele.alarm.text} (${L('riadok', 'line')} ${tele.alarm.line + 1})` }
    : tele.msg ? { kind: 'warn', text: tele.msg }
    : tele.done ? { kind: 'idle', text: L(`Program ukončený za ${mmss(tele.t)} – odobratých ${fmt(tele.removed, 1)} cm³.`, `Program finished in ${mmss(tele.t)} – ${fmt(tele.removed, 1)} cm³ removed.`) }
    : tele.run ? { kind: 'run', text: `${L('Chod programu', 'Program running')} · ${L('riadok', 'line')} ${tele.line + 1}${tele.busy ? L(' · výpočet úberu spomaľuje simuláciu', ' · material removal slows the simulation') : ''}` }
    : tele.paused ? { kind: 'warn', text: L('Program zastavený (M0 / blok po bloku) – pokračuj Štartom.', 'Program stopped (M0 / single block) – continue with Start.') }
    : check.errors.length ? { kind: 'danger', text: L(`Program má ${check.errors.length} chýb – pozri Kontrola programu.`, `The program has ${check.errors.length} errors – see Program check.`) }
    : { kind: 'idle', text: L('Pripravený. Zatvor dvere a stlač Štart cyklu.', 'Ready. Close the doors and press Cycle start.') };
  const chips = [{ color: tele.run ? '#3ee06c' : tele.alarm ? '#ff5a4f' : '#8b8f89', text: tele.run ? L('Automat', 'Auto') : tele.alarm ? L('Alarm', 'Alarm') : L('Stojí', 'Stopped') }, { color: ui.door||tele.serviceDoorOpen ? '#ff8a1f' : '#3ee06c', text: ui.door||tele.serviceDoorOpen ? L('Dvere otvorené', 'Doors open') : L('Dvere zatvorené', 'Doors closed') }];
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
          ...(!rxu?[L('Zásuvku na triesky vysunieš kliknutím; zastavený vozík vyklopíš kliknutím na jeho vaňu. Servisné dvere na bokoch a vzadu otvoríš kliknutím v ručnom režime. Pred spustením programu ich zatvor; pohyb sa zastaví aj počas ich otvárania.', 'Click the chip pan to pull it out; with the machine stopped, click the cart bucket to tip it. Click side and rear service doors in manual mode to open them. Close them before starting the program; opening them also stops motion.')]:[]),
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
          <div className="section-heading"><h1 className="app-title mt-2" tabIndex={-1}>{brand} {MC.name}</h1><SectionInfo title={L('Informácie o stroji','Machine information')}><p className="text-xs muted">{rxu?L('QUADROGUIDE · X 800 / Y 855 / Z 500 mm · A ±115° · stôl Ø600 mm (katalógový variant), 800 kg · HSK-A63, 24 000 ot/min, 67 Nm S1 · 24 miest. Výučbové ISO rozhranie pre RMS6; čas výmeny, dynamika rotačných osí a zaťaženie sú odhady.','QUADROGUIDE · X 800 / Y 855 / Z 500 mm · A ±115° · Ø600 mm table (catalogue variant), 800 kg · HSK-A63, 24,000 rpm, 67 Nm S1 · 24 pockets. Educational ISO interface for RMS6; change time, rotary dynamics and load are estimates.'):L(`5-osé obrábacie centrum: dráhy ${MC.X[1] * 2} × ${MC.Y[1] * 2} × ${MC.nose[1] - MC.nose[0]} mm, otočno-sklopný stôl Ø${MC.table} (A ±130°, C 360°), vreteno ${MC.smax} ot/min HSK-A63, ${MC.pmax} kW, ${MC.mag} miest v zásobníku, Heidenhain TNC 640. Prídavné zariadenia sa zapínajú samostatne nižšie.`, `5-axis machining centre: travels ${MC.X[1] * 2} × ${MC.Y[1] * 2} × ${MC.nose[1] - MC.nose[0]} mm, swivelling rotary table Ø${MC.table} (A ±130°, C 360°), ${MC.smax} rpm HSK-A63 spindle, ${MC.pmax} kW, ${MC.mag} magazine pockets, Heidenhain TNC 640. Optional equipment can be enabled separately below.`)}{MC.approx ? L(' Údaje C 42 U sú orientačné.', ' C 42 U data are approximate.') : ''}</p></SectionInfo></div>
          {!rxu&&<div className="mt-2"><SegRow label={L('Model', 'Model')} value={model} options={Object.values(MODELS).map((x) => [x.id, x.name])} onChange={(v) => { if (!tele.run) setModel(v); }} /></div>}

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
          <div className="section-heading"><h2 className="sec-title mb-2">{L('Prevádzka', 'Operation')}</h2><SectionInfo title={L('Prevádzka', 'Operation')}><p className="text-xs muted mb-2">{rxu?L('Rameno 0–180°.', '0–180° arm swing.'):L('Poloha 0–100 % medzi krajnými polohami pevného ramena.', 'Position 0–100% between the rigid arm endpoints.')} {L('Panel sa natočí k operátorovi automaticky. Korekcia umožňuje vlastné natočenie o 360°. V ručnom ovládaní potiahni panel; Shift + potiahnutie otáča iba panel. Dvojklik na displej otvorí HMI cez celé okno.', 'The panel automatically faces the operator. Trim allows a full 360° manual adjustment. In manual mode, drag the panel; Shift + drag rotates only the panel. Double-click the display for full-screen HMI.')}</p></SectionInfo></div>
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
            <Slider id="hermle-arm-angle" label={rxu?L('Uhol ramena HMI','HMI arm angle'):L('Poloha ramena HMI','HMI arm position')} min={0} max={rxu?180:100} step={0.1} digits={1} disabled={ui.hmiLocked} value={rxu?ui.panelAngle:ui.panelAngle/1.8} unit={rxu?'°':'%'} onChange={(v) => set('panelAngle',rxu?v:v*1.8)} />
            <Slider id="hermle-panel-yaw" label={L('Korekcia natočenia HMI', 'HMI rotation trim')} min={-180} max={180} step={0.1} digits={1} disabled={ui.hmiLocked} value={ui.panelYaw} unit="°" onChange={(v) => set('panelYaw', v)} />
            </fieldset>
            <button type="button" className="btn mb-2" onClick={() => apiRef.current.view?.('panel')}>{L('Pohľad na HMI', 'HMI view')}</button>
            {ui.manual&&<button type="button" className="btn mb-2 ml-2" onClick={()=>{if(ctl.current.manual)setHmiOpen(true);}}>{L('HMI cez celé okno','Full-screen HMI')}</button>}

            <Toggle on={ui.cabin} label={L('Zobraziť kabínu', 'Show the cabin')} onClick={() => set('cabin', !ui.cabin)} />
          </div>
        </div>

        {rxu&&<div className="sec"><div className="section-heading"><h2 className="sec-title mb-2">{L('Prídavné vybavenie podľa pôdorysu','Optional equipment from layout')}</h2><SectionInfo title={L('Prídavné vybavenie podľa pôdorysu','Optional equipment from layout')}><p className="text-xs muted mt-2">{L('Predvolene vypnuté. Pôdorysné rozmery z katalógu; výšky a vnútorné diely sú vizuálny odhad.','Off by default. Plan dimensions follow the catalogue; heights and internal parts are visual estimates.')}</p></SectionInfo></div><select className="sel" aria-label={L('Vybavenie Röders','Röders equipment')} value={ui.accessorySetup} onChange={e=>set('accessorySetup',e.target.value)}><option value="none">{L('Vypnuté','Off')}</option><option value="cooling">{L('Chladiaca jednotka 1050 × 750 mm','Cooling unit 1050 × 750 mm')}</option><option value="filter">{L('Chladenie + pásový filter 1523 × 1380 mm','Cooling + band filter 1523 × 1380 mm')}</option></select><button className="btn mt-2" onClick={()=>apiRef.current.view?.('vybavenie')}>{L('Pohľad na vybavenie','Equipment view')}</button></div>}
        {!rxu&&<>
        <div className="sec">
          <div className="section-heading"><h2 className="sec-title mb-2">{L('Prídavné vybavenie', 'Optional equipment')}</h2><SectionInfo title={L('Prídavné vybavenie', 'Optional equipment')}><p className="text-xs muted mt-2">{L('Prídavné vybavenie je predvolene vypnuté. Zostavy podľa katalógu sa navzájom nahrádzajú; chladiace jednotky sú znázornené vizuálne.', 'Optional equipment is off by default. Catalogue configurations replace one another; coolant units are represented visually.')}</p></SectionInfo></div>
          <label className="text-sm font-semibold" htmlFor="hermle-accessories">{L('Katalógová zostava', 'Catalogue configuration')}</label>
          <select id="hermle-accessories" className="sel mt-2" value={ui.accessorySetup} onChange={(e) => { set('accessorySetup', e.target.value); apiRef.current.view?.('celok'); }}>
            <option value="none">{L('Základ – zásuvka na triesky', 'Basic – chip drawer')}</option>
            <option value="conveyor">{L('Dopravník triesok s vozíkom', 'Chip conveyor with cart')}</option>
            <option value="ics40">{L('Dopravník + vnútorné chladenie ICS 40', 'Conveyor + internal coolant ICS 40')}</option>
            <option value="ics80">{L('Dopravník + vnútorné chladenie ICS 80', 'Conveyor + internal coolant ICS 80')}</option>
            <option value="ics80cooler">{L('Dopravník + ICS 80 + dochladzovacia jednotka', 'Conveyor + ICS 80 + recooling unit')}</option>
          </select>

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
          <div className="section-heading"><h2 className="sec-title mb-2">{L('Polotovar a upnutie', 'Blank and clamping')}</h2><SectionInfo title={L('Polotovar a upnutie', 'Blank and clamping')}><p className="text-xs muted">{L('Upnutie na nulovom systéme Ø70 × 50 mm, nulový bod G54 v strede hornej plochy. Jemnejšia sieť = presnejší povrch, ale pomalší výpočet.', 'Clamped on a Ø70 × 50 mm zero-point system, datum G54 at the centre of the top face. A finer mesh = a more accurate surface but slower computation.')}</p></SectionInfo></div>
          <SegRow label={L('Materiál', 'Material')} value={ui.mat} options={Object.entries(MATERIALS).map(([k, v]) => [k, v.name().split(' ')[0]])} onChange={(v) => set('mat', v)} />
          {check.stock ? <p className="text-xs muted mb-2">{L('Rozmery z BLK FORM programu', 'Dimensions from the program BLK FORM')}: {check.stock.max[0] - check.stock.min[0]} × {check.stock.max[1] - check.stock.min[1]} × {check.stock.max[2] - check.stock.min[2]} mm</p> : (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[['sx', 'X'], ['sy', 'Y'], ['sz', 'Z']].map(([k, l]) => <label key={k} className="text-xs">{l} mm<input className="sel" type="number" min={10} max={k === 'sz' ? 200 : 300} value={ui[k]} onChange={(e) => set(k, Math.max(10, Math.min(k === 'sz' ? 200 : 300, Number(e.target.value) || 10)))} /></label>)}
            </div>
          )}
          <SegRow label={L('Jemnosť siete', 'Mesh resolution')} value={ui.res} options={[[1.0, '1 mm'], [0.7, '0,7 mm'], [0.5, '0,5 mm']]} onChange={(v) => set('res', v)} />

        </div>

        <div className="sec">
          <div className="section-heading"><h2 className="sec-title mb-2">{L('Nástroje', 'Tools')}</h2><SectionInfo title={L('Nástroje', 'Tools')}><p className="text-xs muted">{L('Rozmery sa upravujú v skrinke. Nový nástroj najprv ulož do skrinky a potom ho vyber pre miesto T v zásobníku.','Edit dimensions in the cabinet. Save a new tool there first, then choose it for a magazine pocket T.')}</p></SectionInfo></div>
          <div className="flex flex-wrap gap-2 mb-2">
            <button type="button" className="btn" disabled={!canEditTools} onClick={()=>openToolPicker(freePocket||1)}>{L('Vybrať nástroj zo skrinky…','Choose a tool from cabinet…')}</button>
            <button type="button" className="btn" onClick={()=>{setLibraryPocket(undefined);setLibraryTab('cabinet');}}>{L('Spravovať skrinku…','Manage cabinet…')}</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2"><button type="button" className="btn" onClick={()=>setLibraryTab('detect')}>{L('Detekovať nástroje z NC…','Detect tools from NC…')}</button><button type="button" className="btn" onClick={()=>setLibraryTab('powermill')}>PowerMill / CAM</button></div>

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
          <div className="section-heading"><h2 className="sec-title mb-2">{L('Program z CAM', 'Program from CAM')}</h2><SectionInfo title={L('Program z CAM', 'Program from CAM')}>
          <div className="text-xs" style={{ lineHeight: 1.55 }}>
            <p>{L('Simulátor číta výstup postprocesorov CAM (PowerMill, Fusion 360, Mastercam, hyperMILL, SolidCAM, NX …):', 'The simulator reads CAM post-processor output (PowerMill, Fusion 360, Mastercam, hyperMILL, SolidCAM, NX …):')}</p>
            <ul className="ctl-list" style={{ marginTop: 4 }}>
              <li><b>ISO / Fanuc:</b> G0 G1 G2 G3 (I J K / R), G17–G19, G90 / G91, G93 / G94, G43 H, G43.4 (TCP), G49, G68.2 + G53.1, G69, G81 / G82 / G83 / G73, G53, G28, M3 M4 M5 M6 M8 M9 M0 M1 M30, osi A a C.</li>
              <li><b>Heidenhain Klartext:</b> BLK FORM, TOOL CALL, L, CC, C, CR, FMAX, M128 / FUNCTION TCPM, PLANE SPATIAL / RESET, CYCL DEF 200, CYCL CALL / M99, M140.</li>
              <li>{L('Postprocesor: Fanuc / Heidenhain 5-osí s otočno-sklopným stolom A/C, výstup v mm, dráha stredu nástroja (bez G41/G42), nulový bod v strede hornej plochy polotovaru.', 'Post-processor: Fanuc / Heidenhain 5-axis with an A/C trunnion table, output in mm, tool centre path (no G41/G42), datum at the centre of the top face of the blank.')}</li>
              <li>{L('Komentáre nástrojov typu „T3 D=10. CR=0. - flat end mill“ skontroluj cez Detekovať nástroje z NC; doplň chýbajúce rozmery a osaď ich cez knižnicu.', 'Review tool comments such as “T3 D=10. CR=0. - flat end mill” in Detect tools from NC; fill in missing dimensions and install them through the library.')}</li>
            </ul>
          </div>
          </SectionInfo></div>
        </div>

        <ViewSection apiRef={apiRef} views={[['celok', L('Celok', 'Overview')], ['priestor', L('Pracovný priestor', 'Working area')], ['obrobok', L('Obrobok', 'Workpiece')], ['nastroj', L('Nástroj', 'Tool')], ['zhora', L('Zhora', 'Top')], ['zasobnik', L('Zásobník', 'Magazine')]]} />
        <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
        <HelpFooter apiRef={apiRef} ui={ui} />
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
