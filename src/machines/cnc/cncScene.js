import { cncHmiHit, cncHmiKey, drawCncScreen } from './cncScreen';
import { workAreaFeed } from '../../core/workAreaFeed';
import * as THREE from 'three';
import { L } from '../../core/i18n';
import { createControls } from '../../core/controls';
import { exportStep } from '../../core/step';
import { createInspector } from '../../core/inspector';
import { createParticles } from '../../core/particles';
import { createStage } from '../../core/stage';
import { createSound } from '../../core/sound';
import { createWorkInspect } from '../../core/workInspect';
import { interpret } from './gcode';
import { programTime } from './motion';
import { createExecutor } from './sim';
import { MATERIALS } from './tooling';
import { cabinHalfWidth, hmiPose } from './hermleLayout';
import { measureCnc } from './cncTasks';
import { stockSnapshot } from '../../core/workSession';
import { createStock } from './voxel';
import { createStockMesh } from './stockMesh';
import { createCabinLighting } from './cabinLighting';
import { optimizeMachine } from '../../core/sceneOptimize';
import { validateRxuTool } from '../precision/profiles';

// mierka scény 1 = 100 mm. Scéna: x = X stroja, y hore, z = −Y stroja (k obsluhe). Otočný bod (os A ∩ os C) je
// v (0, PY, 0); plocha stola pri A = 0 je 100 mm pod ním (výška nakladania 950 mm).
const U = 0.01;
const FIX = { r: 35, h: 50 }; // nulový upínací systém pod polotovarom
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '–');

// Stavba a beh 3D scény CNC centra (Hermle, Röders): model stroja, polotovar, vykonávanie programu, ovládače,
// pohľady a hlavná slučka. Volá ju CncCore v useEffect; vracia funkciu na uvoľnenie scény.
export function createCncScene({
  mount,
  layer,
  tipEl,
  c,
  apiRef,
  set,
  setUi,
  setTele,
  setCheck,
  setHmiOpen,
  MC,
  rxu,
  brand,
  controller,
  createModel,
}) {
  const {
    renderer,
    scene,
    camera,
    dispose: disposeStage,
    snapshot,
  } = createStage(mount, { far: 500, floorSize: 400, gridSize: 240, fogNear: 180, fogFar: 400 });
  const snd = createSound('mill');

  const dom = renderer.domElement;
  const std = (col, rough = 0.5, metal = 0.2, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(col).convertSRGBToLinear(),
      roughness: rough,
      metalness: metal,
      ...extra,
    });
  const M = {
    cab: std(0xe6e8ea, 0.55, 0.1),
    cab2: std(0xc9cdd1, 0.5, 0.15),
    dark: std(0x2c3035, 0.7, 0.15),
    anth: std(0x3a3f45, 0.6, 0.2),
    steel: std(0xb9bec4, 0.28, 0.85),
    steelD: std(0x6d737a, 0.35, 0.8),
    inox: std(0xc4c8cc, 0.32, 0.75),
    table: std(0xd3d6d9, 0.38, 0.55),
    red: std(0xd8202a, 0.4, 0.2),
    black: std(0x141618, 0.6, 0.2),
    glass: new THREE.MeshStandardMaterial({
      color: 0xbfd6e6,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    tool: std(0x7b8087, 0.3, 0.9),
    coat: std(0xb08a3c, 0.3, 0.85),
    holder: std(0x9aa0a6, 0.25, 0.9),
    flute: new THREE.LineBasicMaterial({ color: 0x4d4431 }),
  };
  const root = new THREE.Group();
  scene.add(root);
  apiRef.current.machineModel = { root, name: `${brand} ${MC.name}` };
  const G = {};
  const grp = (k, parent = root) => {
    const g = new THREE.Group();
    g.userData.part = k;
    parent.add(g);
    G[k] = g;
    return g;
  };
  const tex = (w, h, draw) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    const g = cv.getContext('2d');
    const redraw = () => {
      draw(g, w, h);
      tx.needsUpdate = true;
    };
    redraw();
    return { tx, redraw, g };
  };
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // Scene dimensions follow each catalogue; the CNC pose remains in real millimetres.
  const K = MC.K,
    PY = rxu ? 14 : 9.5 + MC.hA * U,
    bodyHalf = rxu ? 12 : cabinHalfWidth(MC);
  let scr = null;
  const geometry = createModel({ root, G, M, tex, MC, PY });
  const {
    cab,
    aG,
    cG,
    yG,
    xG,
    zG,
    toolG,
    buildTool,
    pockets,
    magG,
    driveShaft,
    saddle,
    magY,
    magZ,
    panG,
    armPivot,
    armElbow,
    hmi,
    sm,
    covers,
    clampPins,
    doors,
    loadMagazine,
    accessories,
  } = geometry;
  let loadedText = '',
    loadedTools = [];
  let prog = null,
    ex = null,
    toolsNow = [],
    o54 = [0, 0, 90],
    curT = -1,
    stockMin = null,
    stockMax = null,
    maxLoad = 0,
    maxA = 0,
    msg = null;
  // živý dotykový displej (cnc/cncScreen.js): záložky, rýchlosť simulácie a korekcia posuvu na displeji
  const scrKind = rxu ? 'rms' : 'tnc';
  let live = {},
    hist = [],
    histT = -Infinity,
    histStep = 0.5,
    est = 0;
  const scrState = () => ({
    controller,
    title: scr ? scr.title : L('Pripravený', 'Ready'),
    lines: scr ? scr.lines : [],
    posList: scr ? scr.pos : [],
    status: scr ? scr.status : L('Pripravený', 'Ready'),
    alarm: scr ? scr.alarm : false,
    msg,
    pos: { X: live.X, Y: live.Y, Z: live.Z, A: live.A, C: live.C },
    wx: live.wx,
    wy: live.wy,
    wz: live.wz,
    T: live.T ?? 0,
    S: live.S ?? 0,
    F: live.F ?? 0,
    load: live.load ?? 0,
    t: live.t ?? 0,
    removed: live.removed ?? 0,
    maxLoad,
    line: live.line ?? 0,
    running: !!c.running,
    paused: !!live.paused,
    done: !!live.done,
    tools: toolsNow,
    hist,
    est,
    nLines: prog ? prog.lines.length : 0,
    dialect: prog ? prog.dialect : 'iso',
    stock: { ...(prog ? stockCfg() : { sx: c.sx, sy: c.sy, sz: c.sz }), mat: c.mat, res: c.res },
    door: c.door,
    fo: c.fo,
    ro: c.ro,
    single: c.single,
  });
  const screen = tex(rxu ? 1024 : 640, rxu ? 768 : 460, (g, w, h) => drawCncScreen(g, w, h, scrKind, scrState(), c));
  sm.material.map = screen.tx;
  sm.material.needsUpdate = true;
  apiRef.current.getHmiCanvas = () => screen.tx.image;
  // ---------------- osvetlenie pracovného priestoru ----------------
  const lighting = createCabinLighting(scene, root, {
    scale: K,
    halfWidth: bodyHalf,
    emitter: M.lamp,
    workHeight: rxu ? 13.4 : 9.5 * K,
    ...geometry.lighting,
  });
  Object.values(M).forEach(lighting.registerMaterial);

  // ---------------- polotovar (voxely) ----------------
  const stockG = grp('obrobok', cG);
  stockG.userData.stepJoin = true;
  stockG.rotation.x = -Math.PI / 2;
  stockG.scale.setScalar(U);
  // obrobok: povrch po blokoch, do GPU zlúčený po 2 × 2 × 2 blokoch (stockMesh.js)
  let stock = null,
    mat = null,
    stockMesh = null;
  const clearStock = () => stockMesh?.clear();
  const applyChunks = (parts) => stockMesh?.apply(parts);

  // ---------------- program a vykonávanie ----------------
  const stockCfg = () => {
    if (prog && prog.stock) {
      const s = prog.stock,
        sx = s.max[0] - s.min[0],
        sy = s.max[1] - s.min[1],
        sz = s.max[2] - s.min[2];
      return { sx, sy, sz, off: [-(s.min[0] + s.max[0]) / 2, -(s.min[1] + s.max[1]) / 2, FIX.h - s.min[2]] };
    }
    return { sx: c.sx, sy: c.sy, sz: c.sz, off: [0, 0, FIX.h + c.sz] };
  };
  let stockSig = '';
  const buildStock = () => {
    const s = stockCfg();
    o54 = s.off;
    stockMin = [-s.sx / 2, -s.sy / 2, FIX.h];
    stockMax = [s.sx / 2, s.sy / 2, FIX.h + s.sz];
    // pri písaní programu sa nedotknutý polotovar rovnakých rozmerov znova nevytvára (rýchla odozva editora)
    const sig = JSON.stringify([stockMin, stockMax, c.res, c.mat]);
    if (stock && sig === stockSig && stock.removed() === 0) return;
    stockSig = sig;
    const M2 = MATERIALS[c.mat] || MATERIALS.al;
    if (mat) mat.dispose();
    mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: M2.rough,
      metalness: M2.metal,
      side: THREE.FrontSide,
    });
    lighting.registerMaterial(mat);
    stock = createStock({ min: stockMin, max: stockMax, res: c.res });
    if (stockMesh) stockMesh.reset(stock, mat);
    else
      stockMesh = createStockMesh({
        group: stockG,
        material: mat,
        stock,
        color: () => {
          const m3 = MATERIALS[c.mat] || MATERIALS.al;
          return [m3.raw, m3.rgb];
        },
      });
    applyChunks(stock.takeDirty());
  };
  const load = (txt, tls) => {
    if (rxu) tls.forEach(validateRxuTool);
    loadedText = txt;
    loadedTools = tls;
    toolsNow = tls;
    loadMagazine(tls);
    prog = interpret(txt, { o54: [0, 0, 0], tools: tls, mach: MC }); // najprv kvôli BLK FORM
    buildStock();
    prog = interpret(txt, { o54, tools: tls, mach: MC });
    ex = createExecutor({
      moves: prog.moves,
      tools: tls,
      o54,
      stock,
      fixture: FIX,
      kc: (MATERIALS[c.mat] || MATERIALS.al).kc,
      mach: MC,
    });
    if (c.estop)
      ex.S.alarm = { kind: 'estop', text: L('Núdzový STOP je stlačený.', 'Emergency STOP is latched.'), line: 0 };
    scr = {
      title: L('Pripravený', 'Ready'),
      lines: prog.lines.slice(0, 13).map((t, i) => ({ t, cur: i === 0 })),
      pos: [
        ['X', fmt(ex.S.pose.m[0])],
        ['Y', fmt(ex.S.pose.m[1])],
        ['Z', '0.000'],
        ['A', '0.000'],
        ['C', '0.000'],
        ['T', '0'],
        ['S', '0'],
        ['F', '100'],
      ],
      status: L('Pripravený', 'Ready'),
      alarm: false,
    };
    screen.redraw();
    maxLoad = 0;
    maxA = 0;
    msg = null;
    curT = -1;
    hist = [];
    histT = -Infinity;
    histStep = 0.5;
    est = programTime(prog.moves, o54, MC);
    return {
      errors: prog.errors,
      warns: prog.warns,
      time: est,
      dialect: prog.dialect,
      toolDefs: prog.toolDefs,
      stock: prog.stock,
      n: prog.moves.length,
    };
  };
  apiRef.current.load = load;
  // rozpracovaná práca: obrobok v stave pri uložení (len rovnaké rozmery, materiál a rozlíšenie)
  apiRef.current.stockState = () => stockSnapshot(stock, stockSig);
  apiRef.current.stockRemoved = () => (stock ? stock.removed() : 0);
  apiRef.current.restoreStock = (saved) => {
    if (!stock || !saved || c.running || saved.sig !== stockSig || !stock.restore(saved.field, saved.removed))
      return false;
    if (ex) ex.S.removed = saved.removed;
    applyChunks(stock.takeDirty());
    return true;
  };
  apiRef.current.measure = () => measureCnc({ stock, o54, ex, maxA, maxLoad });
  apiRef.current.start = () => {
    if (!ex) return 'noprog';
    if (c.unclamped) {
      msg = L('Najprv upni obrobok späť.', 'Clamp the workpiece back first.');
      return 'unclamped';
    }
    if (c.estop) {
      msg = L('Uvoľni núdzový STOP a stlač Reset.', 'Release Emergency STOP and press Reset.');
      return 'estop';
    }
    if (c.door || geometry.serviceOpen?.()) {
      pendingStart = false;
      msg = L(
        'Dvere sú otvorené – zatvor ich, potom spusti program.',
        'The doors are open – close them, then start the program.',
      );
      return 'door';
    }
    // bezpečnostný zámok: program sa spustí až pri fyzicky zatvorených dverách, nie počas ich zatvárania
    if (doorK > 0.01) {
      pendingStart = true;
      msg = L(
        'Dvere sa zatvárajú – program sa spustí po ich zatvorení a zamknutí.',
        'The doors are closing – the program starts once they are closed and locked.',
      );
      return 'closing';
    }
    if (prog.errors.length) {
      msg = L(
        `Program má chyby (${prog.errors.length}) – oprav ich pred spustením.`,
        `The program has errors (${prog.errors.length}) – fix them before starting.`,
      );
      return 'err';
    }
    if (ex.S.alarm) {
      msg = L('Najprv potvrď alarm tlačidlom Reset.', 'Acknowledge the alarm with Reset first.');
      return 'alarm';
    }
    if (ex.S.done) return 'done';
    ex.S.paused = false;
    c.fast = false;
    c.running = true;
    pendingStart = false;
    msg = null;
    return 'ok';
  };
  // dvere sú počas chodu programu zamknuté (ako na skutočnom stroji); odomknú sa po Stop posuvu
  const doorLockMsg = () =>
    L(
      'Dvere sú počas programu zamknuté – najprv stlač Stop posuvu.',
      'The doors are locked while the program runs – press Feed hold first.',
    );
  const doorFree = () => {
    if (c.running) {
      msg = doorLockMsg();
      return false;
    }
    return true;
  };
  apiRef.current.toggleDoor = () => {
    if (!doorFree()) return false;
    pendingStart = false;
    set('door', !c.door);
    return true;
  };
  apiRef.current.hold = () => {
    pendingStart = false;
    c.running = false;
    c.fast = false;
    if (ex) ex.S.paused = true;
  };
  apiRef.current.emergency = () => {
    set('estop', !c.estop);
    set('running', false);
    c.fast = false;
    if (c.estop && ex) {
      ex.S.dir = 0;
      ex.S.cool = false;
      ex.S.paused = true;
      ex.S.alarm = {
        kind: 'estop',
        text: L('Núdzové zastavenie – uvoľni STOP a stlač Reset.', 'Emergency stop – release STOP and press Reset.'),
        line: ex.S.line,
      };
    }
    msg = c.estop
      ? L('Núdzový STOP stlačený.', 'Emergency STOP latched.')
      : L('Núdzový STOP uvoľnený – stlač Reset.', 'Emergency STOP released – press Reset.');
  };
  apiRef.current.reset = () => {
    if (c.unclamped) return;
    set('running', false);
    c.fast = false;
    setCheck(load(loadedText, loadedTools));
  };
  apiRef.current.ffwd = () => {
    if (
      !ex ||
      ex.S.alarm ||
      prog.errors.length ||
      c.door ||
      doorK > 0.01 ||
      geometry.serviceOpen?.() ||
      c.estop ||
      c.unclamped
    )
      return;
    ex.S.paused = false;
    c.running = true;
    c.fast = true;
  };
  apiRef.current.snapshot = snapshot;
  apiRef.current.exportStep = async () => {
    if (c.running || c.drive || c.wheel || c.work)
      throw new Error(
        L('Najprv zastav stroj a potom exportuj obrobok.', 'Stop the machine before exporting the workpiece.'),
      );
    if (stock) applyChunks(stock.takeDirty());
    return exportStep(stockG);
  };
  apiRef.current.stl = () => {
    const parts = [];
    (stockMesh ? stockMesh.meshes() : []).forEach((me) => parts.push(me.geometry));
    let n = 0;
    parts.forEach((g) => {
      n += g.index.count / 3;
    });
    const buf = new ArrayBuffer(84 + n * 50),
      dv = new DataView(buf);
    dv.setUint32(80, n, true);
    let o = 84;
    parts.forEach((g) => {
      const p = g.attributes.position.array,
        ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) {
        const a = ix[i] * 3,
          b = ix[i + 1] * 3,
          d = ix[i + 2] * 3;
        const ux = p[b] - p[a],
          uy = p[b + 1] - p[a + 1],
          uz = p[b + 2] - p[a + 2],
          wx = p[d] - p[a],
          wy = p[d + 1] - p[a + 1],
          wz = p[d + 2] - p[a + 2];
        let nx = uy * wz - uz * wy,
          ny = uz * wx - ux * wz,
          nz = ux * wy - uy * wx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        [nx, ny, nz].forEach((v) => {
          dv.setFloat32(o, v, true);
          o += 4;
        });
        [a, b, d].forEach((q) => {
          dv.setFloat32(o, p[q] - o54[0], true);
          dv.setFloat32(o + 4, p[q + 1] - o54[1], true);
          dv.setFloat32(o + 8, p[q + 2] - o54[2], true);
          o += 12;
        });
        o += 2;
      }
    });
    return new Blob([buf], { type: 'model/stl' });
  };

  // ---------------- pohľady ----------------
  const toolTip = () => {
    const p = ex ? ex.S.pose.m : [0, MC.tcY, MC.nose[1]];
    const point = [p[0] * U, PY + p[2] * U, -p[1] * U];
    return geometry.machinePoint ? geometry.machinePoint(point) : v3(...point);
  };
  const anchors = {
    kabina: () => v3(-9.5 * K, 25 * K, 8.7 * K),
    lozko: () => v3(9.6 * K, 4 * K, 8.5 * K),
    osi: () => v3(8.8 * K, 23.1 * K, -1.7 * K + yG.position.z),
    vreteno: () => v3(xG.position.x + 1.3 * K, zG.position.y + 1.5 * K, yG.position.z + 1.3 * K),
    stol: () => v3(-6.3 * K, PY - 2.5 * K, 2.0 * K),
    zasobnik: () => v3(4 * K, magY * K, magZ * K),
    panel: () => new THREE.Vector3(0, 17.8, 0).applyMatrix4(panG.matrixWorld),
    obrobok: () =>
      toolTip()
        .clone()
        .setY(PY + 0.3),
  };
  Object.assign(anchors, geometry.anchorOverrides || {});
  const views = {
    celok: () =>
      c.accessorySetup !== 'none'
        ? [
            [-42 * K, 38 * K, 65 * K],
            [-9 * K, 13 * K, -5 * K],
          ]
        : [
            [42 * K, 38 * K, 62 * K],
            [0, 13 * K, -5 * K],
          ],
    vybavenie: () => [
      [-44 * K, 22 * K, 34 * K],
      [-26 * K, 7 * K, -4 * K],
    ],
    panel: () => {
      const pose = hmiPose(c.panelAngle || 0, c.panelYaw || 0, bodyHalf, K),
        p = v3(pose.column[0], 9 * K, pose.column[1]);
      const offset = v3(9 * K, 5 * K, 20 * K).applyAxisAngle(v3(0, 1, 0), pose.yaw);
      return [p.clone().add(offset).toArray(), p.toArray()];
    },
    priestor: () => [[3.8 * K, PY + 4.1 * K, 7.0 * K], [0, PY - 0.2 * K, -0.4 * K], true],
    obrobok: () => [[1.5, PY + 1.0, 2.3], [0, PY - MC.hA * U + 0.75, 0], true],
    nastroj: () => {
      const t = toolTip();
      return [[t.x + 1.9, t.y + 1.1, t.z + 2.6], [t.x, t.y - 0.15, t.z], true];
    },
    zasobnik: () => [[18 * K, 32 * K, -24 * K], [0, 18 * K, -6.5 * K], true],
    zhora: () => [[0.01, 90 * K, -6 * K], [0, 10 * K, -6 * K], true],
  };
  Object.assign(views, geometry.viewOverrides || {});
  apiRef.current.mountWorkArea = workAreaFeed({ scene, camera, renderer, view: views.priestor });
  const insp = createInspector({
    dom,
    mount,
    camera,
    root,
    G,
    anchors,
    views,
    labelEls: Array.from(layer.querySelectorAll('[data-part]')),
    orbitOptions: { maxDistance: 180, maxTargetY: 45 },
    enabled: () => !c.manual && !c.unclamped,
    onPick: (k) => apiRef.current.onPick(k),
    blockPick: () => ctrl.isUsed() || !!panelDrag || c.unclamped,
    onHL: () => ctrl.invalidate(),
  });
  const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
  let doorDragStart = 0,
    manualDoor = null,
    pendingStart = false;
  for (const d of doors) {
    ctrl.reg(
      {
        type: 'slide',
        axis: 'x',
        tooltip: false,
        label: rxu ? L('Posuvné dvere doprava', 'Right-sliding door') : L('Posuvné dvere', 'Sliding doors'),
        hint: rxu
          ? L('Potiahni doprava po koľajnici alebo klikni.', 'Drag right along the rail or click.')
          : L(
              'Potiahni madlo do strany alebo klikni na otvorenie / zatvorenie.',
              'Drag the handle sideways or click to open / close.',
            ),
        read: () => (c.door ? L('otvorené', 'open') : L('zatvorené', 'closed')),
        guard: doorFree,
        start: () => {
          doorDragStart = doorK;
          manualDoor = doorK;
        },
        slide: (dx) => {
          manualDoor = Math.max(
            0,
            Math.min(1, doorDragStart + (dx * d.userData.s) / (geometry.doorTravel ?? (rxu ? 11.8 : 4) * K)),
          );
          ctrl.push('door', manualDoor > 0.01);
        },
        click: () => {
          pendingStart = false;
          ctrl.push('door', !c.door);
        },
        end: ({ click }) => {
          if (!click && manualDoor !== null) ctrl.push('door', manualDoor >= 0.5);
          manualDoor = null;
        },
      },
      d,
    );
  }
  for (const d of geometry.serviceDoors || []) {
    ctrl.reg(
      {
        type: 'button',
        still: true,
        tooltip: false,
        label: L(d.label, d.labelEn || 'Service door'),
        guard: doorFree,
        action: () => {
          d.open = !d.open;
          if (d.open) {
            apiRef.current.hold();
            ctrl.push('running', false);
          }
        },
        read: () => (d.open ? L('otvorené', 'open') : L('zatvorené', 'closed')),
      },
      d.hinge,
    );
  }
  if (accessories.chipPan) {
    const pan = accessories.chipPan;
    ctrl.reg(
      {
        type: 'button',
        still: true,
        tooltip: false,
        label: L('Zásuvka na triesky', 'Chip pan'),
        action: () => {
          pan.open = !pan.open;
        },
      },
      pan.object,
    );
  }
  if (accessories.chipCart) {
    const cart = accessories.chipCart;
    ctrl.reg(
      {
        type: 'button',
        still: true,
        tooltip: false,
        label: L('Výklopný vozík', 'Tipping chip cart'),
        guard: () => !c.running,
        action: () => {
          cart.open = !cart.open;
        },
      },
      cart.object,
    );
  }
  const hmiActions = {};
  const button = (id, label, hint, action, read, latched) => {
    const control = { type: 'button', pressAxis: hmi.pressAxis?.(id) || 'y', label, hint, action, read, latched };
    hmiActions[id] = control;
    ctrl.reg(control, hmi.controls.buttons[id]);
    for (const duplicate of hmi.controls.duplicates?.[id] || [])
      ctrl.reg({ ...control, pressAxis: duplicate.axis }, duplicate.object);
  };
  apiRef.current.hmiAction = (id) => {
    const control = hmiActions[id];
    if (control) {
      control.pressT = t;
      control.action();
    }
  };
  // dotyk / klávesnica na displeji
  const hmiApply = (hit) => {
    if (!hit) return null;
    if (hit.id === 'tab') set('scrTab', hit.tab);
    else if (hit.id === 'speed') set('speed', hit.value);
    else if (hit.id === 'fo') apiRef.current.setHmiOverride('fo', hit.value);
    else apiRef.current.hmiAction(hit.id);
    screen.redraw();
    return hit;
  };
  apiRef.current.hmiPoint = (x, y, drag) => hmiApply(cncHmiHit(scrKind, c, x, y, drag));
  apiRef.current.hmiHover = (x, y) => !!cncHmiHit(scrKind, c, x, y);
  apiRef.current.hmiKey = (key) => hmiApply(cncHmiKey(scrKind, c, key));
  apiRef.current.setHmiOverride = (key, value) => {
    if (key === 'fo' || key === 'ro')
      set(key, Math.max(key === 'fo' ? 0 : 5, Math.min(key === 'fo' ? 150 : 100, Math.round(value))));
  };
  button(
    'start',
    L('Štart cyklu', 'Cycle start'),
    L('Spustí alebo obnoví program pri zatvorených dverách.', 'Start / resume the program with the doors closed.'),
    () => {
      if (apiRef.current.start() === 'ok') ctrl.push('running', true);
    },
  );
  button(
    'hold',
    L('Stop posuvu', 'Feed hold'),
    L('Pozastaví program. Zelené tlačidlo pokračuje.', 'Pause the program. Green resumes.'),
    () => {
      apiRef.current.hold();
      ctrl.push('running', false);
    },
  );
  button(
    'emergency',
    L('Núdzový STOP', 'Emergency STOP'),
    L('Zastaví stroj. Klik uvoľní; potom Reset.', 'Stop the machine. Click to release, then Reset.'),
    () => apiRef.current.emergency(),
    () => (c.estop ? L('stlačený', 'latched') : L('uvoľnený', 'released')),
    () => c.estop,
  );
  button(
    'reset',
    'Reset',
    L(
      'Vynuluje program a potvrdí alarm po uvoľnení STOP.',
      'Reset the program and clear an alarm after releasing STOP.',
    ),
    () => apiRef.current.reset(),
  );
  button(
    'single',
    L('Blok po bloku', 'Single block'),
    L('Prepne vykonávanie po jednotlivých blokoch.', 'Toggle single-block execution.'),
    () => ctrl.push('single', !c.single),
    () => (c.single ? L('zapnuté', 'on') : L('vypnuté', 'off')),
  );
  button(
    'light',
    L('Pracovné osvetlenie', 'Work light'),
    L('Zapne alebo vypne svetlo pracovného priestoru.', 'Toggle the work light.'),
    () => ctrl.push('light', !c.light),
    () => (c.light ? L('zapnuté', 'on') : L('vypnuté', 'off')),
  );
  button(
    'coolant',
    L('Chladenie', 'Coolant'),
    L(
      'Prepne chladenie; príkazy programu M8/M9 môžu stav zmeniť.',
      'Toggle coolant; program M8/M9 can change its state.',
    ),
    () => {
      if (ex && !c.estop) ex.S.cool = !ex.S.cool;
    },
    () => (ex?.S.cool ? L('zapnuté', 'on') : L('vypnuté', 'off')),
  );
  for (const [id, key, max, min] of [
    ['feed', 'fo', 150, 0],
    ['rapid', 'ro', 100, 5],
  ]) {
    ctrl.reg(
      {
        type: 'wheel',
        axis: hmi.knobAxis || 'y',
        minR: 0.12,
        inc: 1,
        label: id === 'feed' ? L('Korekcia posuvu', 'Feed override') : L('Korekcia rýchloposuvu', 'Rapid override'),
        hint: L('Otáčaj ťahaním alebo kolieskom myši.', 'Turn by dragging or using the mouse wheel.'),
        read: () => `${c[key]} %`,
        turn: (a) => ctrl.push(key, Math.max(min, Math.min(max, Math.round(c[key] + a * 40)))),
      },
      hmi.controls.knobs[id],
    );
  }
  // Use the same detach / rotate / return mechanism as the lathe.
  let savedDoor = true,
    savedManual = false;
  const wi = createWorkInspect({
    scene,
    camera,
    dom,
    insp,
    c,
    getObj: () => stockG,
    getSpot: () => v3(0, PY + 2 * K, 14 * K),
    canDetach: () => doorK >= 0.995,
    onState: (unclamped) => {
      set('unclamped', unclamped);
      set('manual', unclamped ? false : savedManual);
      if (!unclamped) {
        set('door', savedDoor);
        msg = null;
      }
    },
  });
  apiRef.current.toggleWork = () => {
    if (wi.phase() === 'in') {
      if (c.running) {
        msg = L('Najprv zastav posuv.', 'Stop the feed first.');
        return;
      }
      if (!stockG.children.length) {
        msg = L('Nie je dostupný obrobok na prehliadku.', 'No workpiece is available to inspect.');
        return;
      }
      savedDoor = c.door;
      savedManual = c.manual;
      set('door', true);
      manualDoor = null;
      msg = L('Otváranie dverí a odopínanie obrobku…', 'Opening the doors and unclamping the workpiece…');
    }
    if (!wi.toggle()) msg = L('Počkaj na dokončenie pohybu obrobku.', 'Wait until the workpiece movement finishes.');
  };
  apiRef.current.view = (n) => {
    if (!c.unclamped) insp.goView(n, false);
  };
  insp.goView('celok', true);

  // ---------------- triesky a chladenie ----------------
  const chips = createParticles(scene, new THREE.BoxGeometry(0.04, 0.012, 0.07), std(0xc9ced3, 0.3, 0.85), 220);
  const drops = createParticles(
    scene,
    new THREE.SphereGeometry(0.025, 5, 4),
    new THREE.MeshStandardMaterial({ color: 0xdfeaf2, roughness: 0.1, transparent: true, opacity: 0.7 }),
    160,
    false,
  );

  let panelDrag = null;
  const panelDown = (e) => {
    if (!c.manual || c.unclamped || c.hmiLocked || e.button !== 0) return;
    if (ctrl.hitAt(e.clientX, e.clientY)) return;
    const hit = ctrl.pickAt(e.clientX, e.clientY);
    let obj = hit?.object;
    while (obj && obj !== panG) obj = obj.parent;
    if (obj !== panG) return;
    panelDrag = {
      id: e.pointerId,
      x: e.clientX,
      key: e.shiftKey ? 'panelYaw' : 'panelAngle',
      start: e.shiftKey ? c.panelYaw : c.panelAngle,
    };
    dom.setPointerCapture(e.pointerId);
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  const panelMove = (e) => {
    if (!panelDrag || panelDrag.id !== e.pointerId) return;
    if (!c.manual || c.hmiLocked || c.unclamped) {
      panelUp(e);
      return;
    }
    const v = panelDrag.start + (e.clientX - panelDrag.x) * 0.5;
    set(
      panelDrag.key,
      panelDrag.key === 'panelAngle' ? Math.max(0, Math.min(180, v)) : ((((v + 180) % 360) + 360) % 360) - 180,
    );
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  const panelUp = (e) => {
    if (panelDrag?.id === e.pointerId) {
      panelDrag = null;
      e.stopImmediatePropagation();
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    }
  };
  const openHmi = (e) => {
    if (!c.manual) return;
    const hit = ctrl.pickAt(e.clientX, e.clientY);
    if (hit?.object !== sm) return;
    e.preventDefault();
    e.stopPropagation();
    setHmiOpen(true);
  };
  apiRef.current.lockHmi = () => {
    if (!c.hmiLocked) {
      set('panelAngle', (panelA * 180) / Math.PI);
      set('panelYaw', (panelYaw * 180) / Math.PI);
      if (panelDrag) {
        const id = panelDrag.id;
        panelDrag = null;
        if (dom.hasPointerCapture(id)) dom.releasePointerCapture(id);
      }
    }
    set('hmiLocked', !c.hmiLocked);
  };
  dom.addEventListener('dblclick', openHmi);
  dom.addEventListener('pointerdown', panelDown, true);
  dom.addEventListener('pointermove', panelMove, true);
  dom.addEventListener('pointerup', panelUp, true);
  dom.addEventListener('pointercancel', panelUp, true);

  // ---------------- hlavná slučka ----------------
  let raf,
    last = performance.now(),
    teleT = 0,
    scrT = 0,
    doorK = c.door ? 1 : 0,
    magA = 0,
    panelA = 0,
    panelYaw = 0,
    spinA = 0,
    t = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    // dvere: otvorenie počas chodu zastaví posuv (bezpečnostný zámok)
    if ((c.door || geometry.serviceOpen?.()) && c.running) {
      c.running = false;
      c.fast = false;
      msg = L('Dvere sa otvorili – posuv a vreteno zastavené.', 'The doors opened – feed and spindle stopped.');
    }
    if (c.unclamped) {
      c.running = false;
      c.fast = false;
      c.door = true;
      c.manual = false;
    }
    if (manualDoor !== null) doorK = manualDoor;
    else {
      // dvere dobiehajú plynulo a posledné 2 % dosadnú naraz (zámok dverí reaguje na úplné zatvorenie)
      const target = c.door ? 1 : 0;
      doorK += (target - doorK) * Math.min(1, dt * 4);
      if (Math.abs(target - doorK) < 0.02) doorK = target;
    }
    if (pendingStart && !c.door && doorK <= 0.01 && apiRef.current.start() === 'ok') ctrl.push('running', true);
    wi.update(dt);
    clampPins.forEach((pin) => {
      pin.position.z = FIX.r * U + wi.open() * 0.12;
    });
    const xc = xG.position.x / K;
    covers.forEach((me, i) => {
      const x0 = i ? xc + 1.95 : -6.9,
        x1 = i ? 6.9 : xc - 1.95,
        w = Math.max(0.05, x1 - x0);
      me.scale.x = w;
      me.position.x = (x0 + x1) / 2;
      me.material.map.repeat.set(w / 2.2, 1);
    });
    cab.visible = c.cabin;
    lighting.update({ cabin: c.cabin, light: c.light, opening: doorK });
    hmi.controls.knobs.feed.rotation[hmi.knobAxis || 'y'] = ((c.fo - 100) * Math.PI) / 75;
    hmi.controls.knobs.rapid.rotation[hmi.knobAxis || 'y'] = ((c.ro - 100) * Math.PI) / 50;
    accessories.update(c, dt);
    if (!c.hmiLocked) panelA += (((c.panelAngle || 0) * Math.PI) / 180 - panelA) * Math.min(1, dt * 4);
    if (!c.hmiLocked) panelYaw += (((c.panelYaw || 0) * Math.PI) / 180 - panelYaw) * Math.min(1, dt * 8);
    geometry.updateGeometry?.({ doorK, panelA, panelYaw });
    geometry.updateServiceDoors?.(dt);
    let busy = false;
    if (ex && c.running && !ex.S.alarm && !ex.S.done && !ex.S.paused) {
      const sp2 = c.fast ? 400 : c.speed,
        budget = c.fast ? 2.5e7 : 4e6;
      const ops = ex.advance(dt * sp2, { fo: c.fo / 100, ro: c.ro / 100, single: c.single, budget });
      busy = ops >= budget * 0.98;
      if (ex.S.alarm || ex.S.done || ex.S.paused) {
        c.running = false;
        c.fast = false;
      }
      maxLoad = Math.max(maxLoad, ex.S.load || 0);
    }
    if (stock) applyChunks(stock.takeDirty(c.fast ? 60 : 14, ex ? ex.S.pose.pT : null));
    // poloha osí
    const S = ex ? ex.S : null,
      p = S ? S.pose : { m: [0, MC.tcY, MC.nose[1]], a: 0, c: 0, pT: [0, 0, 0], vT: [0, 0, 1] };
    const T = S ? S.T : 0,
      tl = toolsNow.find((x) => x.t === T),
      Lt = tl ? tl.l : 0;
    if (T !== curT) {
      curT = T;
      buildTool(tl);
      pockets.forEach((pk, i) => {
        pk.visible = i + 1 !== T;
      });
    }
    yG.position.z = -p.m[1] * U;
    xG.position.x = p.m[0] * U;
    zG.position.y = PY + (p.m[2] + Lt) * U;
    aG.rotation.x = (p.a * Math.PI) / 180;
    cG.rotation.y = (p.c * Math.PI) / 180;
    if (Math.abs(p.a) > Math.abs(maxA)) maxA = p.a;
    geometry.updateAxes?.();
    const spinOn = S && S.dir && S.spin > 0 && !S.alarm && (c.running || false);
    spinA += spinOn ? dt * Math.min(60, (S.spin / 60) * 2 * Math.PI) * 0.15 * (S.dir || 1) : 0;
    toolG.rotation.y = spinA;
    const change = S && prog?.moves[S.idx]?.kind === 'tc' ? prog.moves[S.idx] : null;
    geometry.updateTransfer?.(change, S?.tcPhase || 0, toolsNow, T);
    const indexedT = change ? (S.tcPhase < 0.4 ? change.from : change.to) : T;
    const targetA = indexedT ? (-(indexedT - 1) / MC.mag) * Math.PI * 2 : magA;
    const deltaA = Math.atan2(Math.sin(targetA - magA), Math.cos(targetA - magA));
    magA += deltaA * Math.min(1, dt * 10 * (c.running ? c.speed : 1));
    magG.rotation.y = magA;
    driveShaft.rotation.y = magA;
    // triesky a emulzia pri reze
    const tipW = toolTip();
    if (S && S.cutting && c.running) {
      const n = Math.min(6, 1 + Math.floor((S.mrr || 0) / 60));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2,
          sv = 2 + Math.random() * 3;
        chips.spawn(
          v3(tipW.x, tipW.y + 0.05, tipW.z),
          v3(Math.cos(a) * sv, 1 + Math.random() * 2.5, Math.sin(a) * sv),
          2.2,
        );
      }
    }
    if (S && S.cool && c.running)
      for (let i = 0; i < 3; i++)
        drops.spawn(
          v3(tipW.x + 0.9, tipW.y + 2.2, tipW.z + 0.4),
          v3(-1.6 + Math.random() * 0.4, -3.4, -0.7 + Math.random() * 0.4),
          0.7,
          8,
        );
    chips.update(dt, () => 7.25);
    drops.update(dt, () => 7.25);
    snd.update({
      motor: spinOn ? Math.min(1, S.spin / MC.smax) : 0,
      cut: S && S.cutting && c.running ? Math.min(1, 0.3 + (S.load || 0)) : 0,
    });
    insp.update(t, c);
    ctrl.update(dt);
    if (Object.keys(ctrl.pend).length) {
      const next = { ...ctrl.pend };
      for (const k of Object.keys(ctrl.pend)) delete ctrl.pend[k];
      setUi((u) => ({ ...u, ...next }));
    }
    if (t - scrT > 0.25 && S) {
      scrT = t;
      const lines = prog ? prog.lines : [],
        li = S.line,
        from = Math.max(0, li - 5);
      scr = {
        title: L('Chod programu – plynulý', 'Program run, full sequence'),
        lines: lines.slice(from, from + 13).map((tt, i) => ({ t: tt, cur: from + i === li })),
        pos: [
          ['X', fmt(p.m[0])],
          ['Y', fmt(p.m[1])],
          ['Z', fmt(p.m[2] + Lt - MC.nose[1])],
          ['A', fmt(p.a)],
          ['C', fmt(p.c)],
          ['T', String(T)],
          ['S', String(S.spin)],
          ['F', String(Math.round(c.fo))],
        ],
        status: S.alarm
          ? S.alarm.text
          : S.done
            ? L('Program ukončený', 'Program finished')
            : c.running
              ? L('Chod programu', 'Program running')
              : L('Pripravený', 'Ready'),
        alarm: !!S.alarm,
      };
      screen.redraw();
    }
    if (t - teleT > 0.12 && S) {
      teleT = t;
      const w = [p.pT[0] - o54[0], p.pT[1] - o54[1], p.pT[2] - o54[2]],
        mv = prog && prog.moves[S.idx];
      if (c.running && S.t - histT >= histStep) {
        histT = S.t;
        hist.push({ t: S.t, load: S.load || 0, mrr: ((S.mrr || 0) * 60) / 1000 });
        if (hist.length > 360) {
          hist = hist.filter((_, i) => i % 2 === 0);
          histStep *= 2;
        }
      }
      setTele(
        (live = {
          serviceDoorOpen: !!geometry.serviceOpen?.(),
          run: !!c.running,
          paused: S.paused,
          done: S.done,
          alarm: S.alarm,
          line: S.line,
          X: p.m[0],
          Y: p.m[1],
          Z: p.m[2] + Lt - MC.nose[1],
          A: p.a,
          C: p.c,
          wx: w[0],
          wy: w[1],
          wz: w[2],
          T,
          S: S.dir ? S.spin : 0,
          F: mv && mv.kind !== 'tc' ? (mv.rapid ? -1 : Math.round(((mv.F || 0) * c.fo) / 100)) : 0,
          load: S.load || 0,
          mrr: ((S.mrr || 0) * 60) / 1000,
          t: S.t,
          removed: S.removed / 1000,
          busy,
          building: false,
          maxLoad,
          msg,
          cool: !!S.cool,
        }),
      );
    }
    renderer.render(scene, camera);
  };
  // zlúčenie statických sietí a menej vrhačov tieňa (stovky vykreslení menej na snímok)
  const sceneOpt = optimizeMachine({ root, scene, renderer, refs: { geometry, G, clampPins }, controls: ctrl });
  raf = requestAnimationFrame(loop);
  try {
    if (/[?&]debug/.test(window.location.search))
      window.__hermle = {
        sceneOpt,
        api: apiRef.current,
        c,
        lighting,
        chipPan: accessories.chipPan,
        chipCart: accessories.chipCart,
        equipment: accessories.equipment,
        root,
        camera,
        serviceDoors: geometry.serviceDoors,
        serviceOpen: geometry.serviceOpen,
        armPivot,
        armElbow,
        panG,
        hmiControls: hmi.controls,
        workInspect: wi,
        stockG,
        clampPins,
        insp,
        manualControls: ctrl,
        doors,
        get doorTravel() {
          return doorK;
        },
        driveShaft,
        magazine: magG,
        magDrive: saddle,
        get ex() {
          return ex;
        },
        get prog() {
          return prog;
        },
        get stock() {
          return stock;
        },
      };
  } catch (err) {
    /* ignorované */
  }
  return () => {
    cancelAnimationFrame(raf);
    dom.removeEventListener('dblclick', openHmi);
    dom.removeEventListener('pointerdown', panelDown, true);
    dom.removeEventListener('pointermove', panelMove, true);
    dom.removeEventListener('pointerup', panelUp, true);
    dom.removeEventListener('pointercancel', panelUp, true);
    snd.dispose();
    ctrl.dispose();
    wi.dispose();
    insp.dispose();
    clearStock();
    if (mat) mat.dispose();
    try {
      delete window.__hermle;
    } catch (err) {
      /* ignorované */
    }
    disposeStage();
  };
}
