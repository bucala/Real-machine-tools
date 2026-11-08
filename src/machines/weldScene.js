import { ELECTRODES, FILLETS, WELD_DIAL, WELD_DIAL_ANG, WELD_MODES, WELD_MODE_ANG, WELD_TT } from './weldData';
import { L, LL } from '../core/i18n';
import { LIGHT_K, createStage } from '../core/stage';
import {
  POS_DOWN,
  POS_UP,
  POS_VERT,
  RES,
  W2,
  diffX,
  evalBead,
  makeShape,
  mapPoint,
  nearestOnPath,
  normalAt,
  sectionMetrics,
  tangentOf,
  unmapPoint,
  wrapX,
} from './weldShape';
import { TAU, clamp, logNear } from '../core/util';
import * as THREE from 'three';
import { baseMats, makeKit, std } from '../core/kit';
import { buildFronius } from './fronius';
import { createControls } from '../core/controls';
import { createInspector } from '../core/inspector';
import { createParticles } from '../core/particles';
import { createSound } from '../core/sound';
import { createWorkInspect } from '../core/workInspect';
import { exportStep } from '../core/step';
import { exportStl } from '../core/export';
import { gasCover, migRange, migSynergic, stickoutI } from './migMath';

// 3D scéna a hlavná slučka (pôvodne useEffect v weld.jsx); vracia upratanie
export function createWeldScene({ MIG, apiRef, ctl, flashRef, glassRef, layerRef, mountRef, setTele, setUi, tipRef }) {
  const mount = mountRef.current,
    layer = layerRef.current,
    tipEl = tipRef.current;
  const c = ctl.current;
  const TT = WELD_TT;
  const { renderer, scene, camera, dispose: disposeStage, snapshot } = createStage(mount);
  const snd = createSound(MIG ? 'mig' : 'weld');
  const dom = renderer.domElement;
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const M = {
    ...baseMats(0xf2cf1d, 0xd9b512, 0xb8970c),
    face: std(0xe4dfc8, 0.7, 0.05),
    table: std(0x4d5257, 0.55, 0.6),
    copper: std(0xc77b45, 0.35, 0.8),
    cable: std(0x18191a, 0.7, 0.05),
    rod: std(0xb9b39d, 0.75, 0.05),
    core: std(0x9aa1a7, 0.35, 0.85),
    handle: std(0x111213, 0.6, 0.05),
    arc: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    spatter: new THREE.MeshBasicMaterial({ color: 0xffa233, toneMapped: false }),
    smoke: new THREE.MeshBasicMaterial({ color: 0x9a9da1, transparent: true, opacity: 0.1, depthWrite: false }),
  };
  const kit = makeKit(M);
  const { add, box, cylY, cylZ, hitProxy, face } = kit;
  const root = new THREE.Group();
  scene.add(root);
  apiRef.current.machineModel = { root, name: MIG ? 'Fronius TPS 450 MIG MAG' : 'Zváracie pracovisko MMA' };
  const G = {};
  const grp = (k, parent = root) => {
    const g = new THREE.Group();
    g.userData.part = k;
    parent.add(g);
    G[k] = g;
    return g;
  };

  // ---------- zvárací stôl ----------
  const tbl = grp('stol');
  box(tbl, -5, 5, TT - 0.25, TT, -3, 3, M.table);
  [
    [-4.6, -2.6],
    [4.6, -2.6],
    [-4.6, 2.6],
    [4.6, 2.6],
  ].forEach(([x, z]) => box(tbl, x - 0.15, x + 0.15, 0, TT - 0.25, z - 0.15, z + 0.15, M.table));
  box(tbl, -4.6, 4.6, 1.0, 1.15, -2.6, 2.6, M.table);
  const fixture = new THREE.Group();
  tbl.add(fixture);
  cylY(fixture, 0.18, 0.18, TT, TT + 4.2, 0, -1.6, M.steelDark, 20);
  box(fixture, -0.35, 0.35, TT, TT + 0.1, -1.95, -1.25, M.steelDark);
  // rameno s tŕňom pre rúry: od stojana k čelu rúry (natáča sa v placeWeld)
  const pipeArm = new THREE.Group();
  tbl.add(pipeArm);
  pipeArm.visible = false;
  const armBar = add(pipeArm, new THREE.BoxGeometry(1, 1, 1), M.steelDark),
    armPin = add(pipeArm, new THREE.CylinderGeometry(1, 1, 1, 20), M.steelDark);

  // ---------- zváračka: Elektrokov JS 90FN (MMA) alebo Fronius TPS 450 (MIG/MAG) ----------
  let wel,
    sockW,
    knobI,
    knobM,
    breaker,
    brLever,
    fr = null;
  if (MIG) {
    fr = buildFronius({ kit, M, grp, v3, std });
    wel = fr.wel;
    sockW = fr.sockW;
  } else {
    wel = grp('zvaracka');
    wel.position.set(7.4, 0.9, 2.2);
    wel.rotation.y = -0.45;
    box(wel, -2.4, 2.4, 0, 2.5, -1.25, 1.25, M.green); // žltá skriňa
    box(wel, -2.45, 2.45, 2.42, 2.55, -1.3, 1.3, M.greenDark);
    [-1.9, 1.9].forEach((x) => box(wel, x - 0.3, x + 0.3, -0.9, 0, -0.9, 0.9, M.steelDark)); // podstavec / vozík
    for (let k = 0; k < 6; k++) box(wel, 2.4, 2.42, 0.4 + k * 0.28, 0.52 + k * 0.28, -0.8, 0.8, M.black); // vetracie štrbiny
    const fp = face(wel, 0, 1.25, 1.25, 0); // čelný panel (lokálna +Z von)
    box(fp, -2.2, 2.2, -1.1, 1.1, 0, 0.02, M.face);
    const panelCv = document.createElement('canvas');
    panelCv.width = 880;
    panelCv.height = 440;
    const panelTex = new THREE.CanvasTexture(panelCv);
    panelTex.colorSpace = THREE.SRGBColorSpace;
    panelTex.anisotropy = 4;
    (() => {
      const g = panelCv.getContext('2d'),
        P = (x, y) => [(x + 2.2) * 200, (1.1 - y) * 200];
      g.fillStyle = '#e4dfc8';
      g.fillRect(0, 0, 880, 440);
      g.fillStyle = '#c9c4ad';
      for (let i = 0; i < 220; i++) g.fillRect(Math.random() * 880, Math.random() * 440, 2, 2);
      g.fillStyle = '#2b2b2b';
      g.font = 'bold 40px Barlow, Arial';
      g.fillText('ELEKTROKOV', ...P(-0.15, 0.62));
      g.font = 'bold 46px Barlow, Arial';
      g.fillText('JS 90FN', ...P(1.05, 0.62));
      g.font = 'bold 15px Barlow, Arial';
      ['POZOR! PŘI 220V', 'SE SMÍ POUŽÍT NEJVYŠŠÍ', 'SVAŘOVACÍ PROUD 75A'].forEach((tx, i) =>
        g.fillText(tx, ...P(-0.25, 0.08 - i * 0.1)),
      );
      g.fillStyle = '#c0392b';
      ['POZOR! PŘI SVAŘENÍ CHRAŇ', 'SVÁŘEČKU VHODNÝM', 'PŘÍSTŘEŠKEM!!'].forEach((tx, i) =>
        g.fillText(tx, ...P(1.0, 0.08 - i * 0.1)),
      );
      g.fillStyle = '#2b2b2b';
      g.font = 'bold 22px Barlow, Arial';
      WELD_DIAL.forEach((v, i) => {
        const a = WELD_DIAL_ANG[i];
        const [x, y] = P(-1.55 - Math.sin(a) * 0.5, 0.45 + Math.cos(a) * 0.5);
        g.fillText(String(v), x - 16, y + 8);
      });
      g.font = 'bold 17px Barlow, Arial';
      ['0', '380V', '220V', 'NABÍJ.'].forEach((tx, i) => {
        const a = WELD_MODE_ANG[i];
        const [x, y] = P(-0.85 - Math.sin(a) * 0.42, -0.45 + Math.cos(a) * 0.42);
        g.fillText(tx, x - 18, y + 6);
      });
      g.fillText('SVAŘENÍ  NABÍJENÍ', ...P(-1.15, -0.95));
      g.fillText('NABÍJENÍ', ...P(0.45, -0.95));
      g.fillText('6A', ...P(1.05, -0.95));
      g.strokeStyle = '#a5402e';
      g.lineWidth = 3;
      g.strokeRect(...P(0.3, -0.35), 260, 140);
      g.fillStyle = '#2b2b2b';
      g.fillRect(...P(-2.15, -0.15), 860, 3);
    })();
    add(
      fp,
      new THREE.PlaneGeometry(4.4, 2.2),
      new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.8 }),
      0,
      0,
      0.021,
    );
    // gombík prúdu a prepínač režimu (otočné páčky)
    const knob = (x, y, len) => {
      const pv = new THREE.Group();
      pv.position.set(x, y, 0.03);
      fp.add(pv);
      cylZ(pv, 0.2, 0.18, 0, 0.12, 0, 0, M.black, 24);
      add(pv, new THREE.BoxGeometry(0.12, len, 0.16), M.black, 0, len * 0.3, 0.18);
      hitProxy(pv, 0.3, 0, 0, 0.15);
      return pv;
    };
    knobI = knob(-1.55, 0.45, 0.55);
    knobM = knob(-0.85, -0.45, 0.48);
    breaker = new THREE.Group();
    breaker.position.set(-1.9, -0.6, 0.03);
    fp.add(breaker);
    box(breaker, -0.1, 0.1, -0.2, 0.2, 0, 0.06, M.white);
    brLever = box(breaker, -0.05, 0.05, -0.02, 0.15, 0.06, 0.12, M.black);
    hitProxy(breaker, 0.22, 0, 0, 0.05);
    box(fp, -0.35, 1.95, 0.3, 0.42, 0.03, 0.3, M.black);
    box(fp, -0.35, -0.2, 0.3, 0.42, 0.03, 0.3, M.black); // rukoväť
    box(fp, -0.35, 1.95, 0.2, 0.42, 0.25, 0.32, M.black);
    [0.55, 0.8, 1.05].forEach((x) => cylZ(fp, 0.06, 0.06, 0, 0.12, x, -0.6, M.black, 12));
    const sockets = [1.5, 1.95].map((x) => {
      cylZ(fp, 0.17, 0.17, 0, 0.1, x, -0.6, M.black, 24);
      cylZ(fp, 0.07, 0.07, 0.1, 0.11, x, -0.6, M.copper, 16);
      return v3(x, -0.6, 0.12);
    });
    cylZ(fp, 0.1, 0.1, 0, 0.12, -0.45, -0.75, M.black, 16); // sieťový kábel
    sockW = sockets.map((p) => {
      wel.updateMatrixWorld(true);
      return fp.localToWorld(p.clone());
    });
    const mains = new THREE.CatmullRomCurve3([
      fp.localToWorld(v3(-0.45, -0.75, 0.12)),
      v3(5.3, 0.4, 3.6),
      v3(3.5, 0.05, 5.0),
      v3(1.0, 0.05, 6.5),
    ]);
    add(root, new THREE.TubeGeometry(mains, 40, 0.05, 8, false), M.cable);
  }

  // ---------- zemniaca svorka ----------
  const clampG = grp('svorka');
  const clampAt = v3(4.6, TT, 2.5);
  const jaw = new THREE.Group();
  jaw.position.copy(clampAt);
  clampG.add(jaw);
  box(jaw, -0.1, 0.5, -0.06, 0.06, -0.12, 0.12, M.copper);
  box(jaw, -0.1, 0.5, -0.36, -0.26, -0.12, 0.12, M.copper);
  cylZ(jaw, 0.05, 0.05, -0.14, 0.14, 0.42, -0.15, M.steel, 10);
  const gCable = new THREE.CatmullRomCurve3([
    sockW[1],
    sockW[1].clone().add(v3(0, -0.6, 0.6)),
    v3(5.6, 3.0, 3.4),
    v3(5.0, 6.2, 2.9),
    clampAt.clone().add(v3(0.45, -0.1, 0)),
  ]);
  add(clampG, new THREE.TubeGeometry(gCable, 48, 0.06, 8, false), M.cable);

  // ---------- zvarenec: výšková mapa v mm (mierka 0,01), lokálna x = os zvaru, y = normála plochy ----------
  const weldG = grp('zvarenec');
  const pivot = new THREE.Group();
  weldG.add(pivot);
  pivot.scale.setScalar(0.01);
  const wm = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0.62,
    side: THREE.DoubleSide,
  });
  wm.onBeforeCompile = (sh) => {
    sh.vertexShader =
      'attribute vec3 glow;\nvarying vec3 vGlow;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = glow;');
    sh.fragmentShader =
      'varying vec3 vGlow;\n' +
      sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vGlow;',
      );
  };
  const NZ = Math.round((2 * W2) / RES); // sieť 0,5 mm, šírka 2 · W2 (weldShape.js)
  const F = {
    NX: 0,
    L: 0,
    t: 0,
    h: null,
    h0: null,
    dep: null,
    temp: null,
    heat: null,
    rip: null,
    mesh: null,
    geo: null,
    pos: null,
    col: null,
    glow: null,
    type: 'V',
    prep: null,
    dirty: true,
    hot: 0,
  };
  const C = {
    raw: new THREE.Color(0x5f6469).convertSRGBToLinear(),
    bevel: new THREE.Color(0x9a9fa4).convertSRGBToLinear(),
    slag: new THREE.Color(0x2b241e).convertSRGBToLinear(),
    weld: new THREE.Color(0x8e959c).convertSRGBToLinear(),
    toe: new THREE.Color(0x40444a).convertSRGBToLinear(),
    straw: new THREE.Color(0xa9844a).convertSRGBToLinear(),
    bronze: new THREE.Color(0x7a4f62).convertSRGBToLinear(),
    blue: new THREE.Color(0x4a5a8a).convertSRGBToLinear(),
    tmp: new THREE.Color(),
  };
  const glowCol = (T, out) => {
    const k = Math.max(0, (T - 0.3) / 0.7);
    out[0] = 3.2 * Math.pow(k, 0.8);
    out[1] = 1.3 * k * k;
    out[2] = 0.5 * k * k * k * k;
  };
  const idxOf = (i, j) => j * (F.NX + 1) + i,
    gl = [0, 0, 0],
    mp = [0, 0, 0],
    LAYS = 6;
  // pridanie hrúbky a do vrstvy aktuálnej húsenice v bunke k
  const addPass = (k, a) => {
    const n = F.ln[k],
      b = k * LAYS;
    if (n && F.lid[b + n - 1] === st.pass) F.lh[b + n - 1] += a;
    else if (n < LAYS) {
      F.lid[b + n] = st.pass;
      F.lh[b + n] = a;
      F.ln[k] = n + 1;
    } else {
      F.lh[b + LAYS - 1] += a;
      F.lid[b + LAYS - 1] = st.pass;
    }
  };
  const copyCell = (k, k2) => {
    F.h[k2] = F.h[k];
    F.dep[k2] = F.dep[k];
    F.rip[k2] = F.rip[k];
    F.por[k2] = F.por[k];
    F.temp[k2] = F.temp[k];
    F.fus[k2] = F.fus[k];
    F.sl[k2] = F.sl[k];
    F.inc[k2] = F.inc[k];
    F.ln[k2] = F.ln[k];
    for (let q = 0; q < LAYS; q++) {
      F.lid[k2 * LAYS + q] = F.lid[k * LAYS + q];
      F.lh[k2 * LAYS + q] = F.lh[k * LAYS + q];
    }
  };
  // stĺpec siete; na rúre sa obvod uzatvára (stĺpec NX je ten istý ako 0), na plechu mimo dielu −1
  const colOf = (i) => (F.R ? ((i % F.NX) + F.NX) % F.NX : i < 0 || i > F.NX ? -1 : i);
  const RIP = (2 * Math.PI) / 1.4; // rozostup šupín húsenice ~1,4 mm
  const buildField = () => {
    if (F.mesh) {
      pivot.remove(F.mesh);
      F.geo.dispose();
    }
    const S = F.S,
      L = (F.L = S.L),
      NX = (F.NX = Math.round(L / RES)),
      VN = (NX + 1) * (NZ + 1);
    F.R = S.R;
    F.hb = null;
    F.por = new Uint8Array(VN);
    F.bev = new Uint8Array(VN);
    // natavenie základného materiálu (mm pod pôvodným povrchom), troska na povrchu, vtrúseniny
    F.fus = new Float32Array(VN);
    F.sl = new Uint8Array(VN);
    F.inc = new Uint8Array(VN);
    // vrstvy nad sebou: až LAYS húseníc na bunku (číslo húsenice a hrúbka), F.ln = počet
    F.lid = new Uint8Array(VN * LAYS);
    F.lh = new Float32Array(VN * LAYS);
    F.ln = new Uint8Array(VN);
    F.h = new Float32Array(VN);
    F.h0 = new Float32Array(VN);
    F.dep = new Float32Array(VN);
    F.temp = new Float32Array(VN);
    F.heat = new Float32Array(VN);
    F.rip = new Float32Array(VN);
    // tvar polotovarov: výška povrchu a úkosy v každom bode siete
    for (let j = 0; j <= NZ; j++) {
      const z = j * RES - W2;
      for (let i = 0; i <= NX; i++) {
        const x = i * RES - L / 2,
          k = idxOf(i, j),
          hz = S.h0(x, z);
        F.h[k] = hz;
        F.h0[k] = hz;
        F.bev[k] = S.bev(x, z) ? 1 : 0;
      }
    }
    const GX = NX + 5,
      GZ = NZ + 5,
      n = GX * GZ,
      idx = [];
    for (let j = 0; j < GZ - 1; j++)
      for (let i = 0; i < GX - 1; i++) {
        const a = j * GX + i,
          d = a + GX;
        idx.push(a, d, a + 1, a + 1, d, d + 1);
      }
    idx.push(0, GX - 1, (GZ - 1) * GX, GX - 1, GZ * GX - 1, (GZ - 1) * GX);
    F.geo = new THREE.BufferGeometry();
    F.pos = new Float32Array(n * 3);
    F.col = new Float32Array(n * 3);
    F.glow = new Float32Array(n * 3);
    F.geo.setAttribute('position', new THREE.BufferAttribute(F.pos, 3));
    F.geo.setAttribute('color', new THREE.BufferAttribute(F.col, 3));
    F.geo.setAttribute('glow', new THREE.BufferAttribute(F.glow, 3));
    F.geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : idx);
    F.mesh = new THREE.Mesh(F.geo, wm);
    F.mesh.castShadow = true;
    F.mesh.receiveShadow = true;
    F.mesh.userData.part = 'zvarenec';
    pivot.add(F.mesh);
    pivot.position.set(0, 0, -S.cz / 100); // spoj leží v počiatku zvarenca
    F.GX = GX;
    F.GZ = GZ;
    F.dirty = true;
    rebuildField(true);
  };
  const rebuildField = (geomToo) => {
    const { NX, GX, GZ } = F;
    let hot = 0;
    for (let jj = 0; jj < GZ; jj++)
      for (let ii = 0; ii < GX; ii++) {
        const i = clamp(ii - 2, 0, NX),
          j = clamp(jj - 2, 0, NZ),
          ring = ii === 0 || jj === 0 || ii === GX - 1 || jj === GZ - 1,
          edge = ii === 1 || jj === 1 || ii === GX - 2 || jj === GZ - 2;
        const k = jj * GX + ii,
          vi = idxOf(i, j),
          d = F.dep[vi];
        const rp = 0.5 + 0.5 * Math.sin(F.rip[vi]);
        if (geomToo) {
          // šupiny húsenice: jemné vlnenie povrchu zvarového kovu
          const ripple = !ring && !edge && d > 0.25 ? 0.24 * Math.min(1, d / 0.8) * (rp - 0.5) : 0;
          mapPoint(F.S, i * RES - F.L / 2, ring ? 0 : F.h[vi] + ripple, j * RES - W2, mp); // rúra: rozvinutý plášť sa zavinie na valec
          F.pos[k * 3] = mp[0];
          F.pos[k * 3 + 1] = mp[1];
          F.pos[k * 3 + 2] = mp[2];
        }
        let col = C.raw,
          T = 0;
        if (!ring && !edge) {
          T = F.temp[vi];
          if (T > hot) hot = T;
          if (d > 0.06) {
            const sl = F.sl[vi]; // troska len na húseniciach, ktoré ešte nie sú otlčené
            C.tmp.copy(sl ? C.slag : C.weld).multiplyScalar(sl ? 0.88 + 0.12 * rp : 0.62 + 0.5 * rp * rp);
            if (F.por[vi] && !sl && ((vi * 2654435761) >>> 0) % 5 < 2) C.tmp.multiplyScalar(0.28); // póry (zvar bez plynovej ochrany)
            if (!sl && d < 0.7) C.tmp.lerp(C.toe, (1 - d / 0.7) * 0.55); // tmavší okraj (prechod do základného materiálu)
            col = C.tmp;
          } else {
            col = F.bev[vi] ? C.bevel : C.raw;
            const ht = F.heat[vi];
            if (ht > 0.08) {
              C.tmp.copy(col).lerp(ht > 0.62 ? C.blue : ht > 0.4 ? C.bronze : C.straw, Math.min(0.55, ht * 0.7));
              col = C.tmp;
            }
          }
        }
        F.col[k * 3] = col.r;
        F.col[k * 3 + 1] = col.g;
        F.col[k * 3 + 2] = col.b;
        gl[0] = 0;
        gl[1] = 0;
        gl[2] = 0;
        if (T > 0.02) glowCol(T, gl);
        F.glow[k * 3] = gl[0];
        F.glow[k * 3 + 1] = gl[1];
        F.glow[k * 3 + 2] = gl[2];
      }
    F.hot = hot;
    ['color', 'glow', 'position'].forEach((n) => {
      F.geo.attributes[n].clearUpdateRanges();
    });
    F.geo.attributes.color.needsUpdate = true;
    F.geo.attributes.glow.needsUpdate = true;
    if (geomToo) {
      F.geo.attributes.position.needsUpdate = true;
      F.geo.computeVertexNormals();
      F.geo.computeBoundingSphere();
      F.geo.computeBoundingBox();
    }
  };
  // len žiara (teplota) v obdĺžniku uzlov [i0, i1, j0, j1]; farby a tvar sa pri chladnutí nemenia
  const rebuildGlow = ([i0, i1, j0, j1]) => {
    const { GX } = F;
    let hot = 0;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const T = F.temp[idxOf(i, j)],
          k = (j + 2) * GX + i + 2;
        if (T > hot) hot = T;
        gl[0] = 0;
        gl[1] = 0;
        gl[2] = 0;
        if (T > 0.02) glowCol(T, gl);
        F.glow[k * 3] = gl[0];
        F.glow[k * 3 + 1] = gl[1];
        F.glow[k * 3 + 2] = gl[2];
      }
    F.hot = hot;
    const a = F.geo.attributes.glow;
    a.addUpdateRange((j0 + 2) * GX * 3, (j1 - j0 + 1) * GX * 3);
    a.needsUpdate = true; // rozsahy sa do nahratia hromadia
  };
  const onPart = (x, z) => (F.R > 0 || Math.abs(x) <= F.L / 2) && Math.abs(z) <= W2;
  // výška povrchu dielu; mimo dielu null
  const surfAt = (x, z) => {
    if (!onPart(x, z)) return null;
    const i = colOf(Math.round((x + F.L / 2) / RES)),
      j = clamp(Math.round((z + W2) / RES), 0, NZ);
    return F.h[idxOf(i, j)];
  };
  // nános: hladina taveniny vyplní najnižšie miesta (úkos), navrchu vytvorí klenbu húsenice
  const deposit = (cx, cz, dV, rp, s, porous = false) => {
    const xi = (cx + F.L / 2) / RES,
      zj = (cz + W2) / RES,
      rc = rp / RES,
      cells = [];
    for (let j = Math.max(0, Math.floor(zj - rc)); j <= Math.min(NZ, Math.ceil(zj + rc)); j++)
      for (let i = Math.floor(xi - rc); i <= Math.ceil(xi + rc); i++) {
        const ii = colOf(i);
        if (ii < 0) continue;
        const r2 = ((i - xi) * (i - xi) + (j - zj) * (j - zj)) / (rc * rc);
        if (r2 > 1) continue;
        cells.push([idxOf(ii, j), r2, F.R && ii === 0 ? idxOf(F.NX, j) : -1]); // na rúre aj zdvojený stĺpec obvodu
      }
    if (!cells.length) return 0;
    const crown = 0.5 * rp,
      A = RES * RES,
      need = dV / A;
    let lo = Infinity;
    cells.forEach(([k]) => {
      if (F.h[k] < lo) lo = F.h[k];
    });
    let hi = lo + 40;
    for (let it = 0; it < 24; it++) {
      const mid = (lo + hi) / 2;
      let vol = 0;
      for (const [k, r2] of cells) vol += Math.max(0, mid - crown * r2 - F.h[k]);
      if (vol > need) hi = mid;
      else lo = mid;
    }
    let added = 0;
    for (const [k, r2, k2] of cells) {
      const a = Math.max(0, lo - crown * r2 - F.h[k]);
      // šupiny sú oblúky vypuklé v smere zvárania: okraje kúpeľa tuhnú o kúsok skôr
      if (a > 0.002) {
        // zvar cez neotlčenú trosku inej húsenice zanechá troskové vtrúseniny
        if (F.sl[k] && F.dep[k] > 0.05 && F.ln[k] && F.lid[k * LAYS + F.ln[k] - 1] !== st.pass) {
          if (!F.inc[k]) st.inc += A;
          F.inc[k] = 1;
        }
        F.h[k] += a;
        F.dep[k] += a;
        added += a * A;
        F.rip[k] = (s - 0.45 * rp * r2) * RIP;
        if (porous) F.por[k] = 1;
        addPass(k, a);
        if (!MIG) F.sl[k] = 1;
      }
      F.fus[k] = Math.max(F.fus[k], st.penNow * (1 - r2 * 0.8)); // natavenie pod kúpeľom (na okraji ~20 %)
      F.temp[k] = Math.max(F.temp[k], 1 - r2 * 0.4);
      if (k2 >= 0) copyCell(k, k2);
    }
    // ohrev okolia (popúšťacie farby)
    const rh = (rp * 2.4) / RES;
    const hj0 = Math.max(0, Math.floor(zj - rh)),
      hj1 = Math.min(NZ, Math.ceil(zj + rh));
    const hi0 = F.R ? Math.floor(xi - rh) : Math.max(0, Math.floor(xi - rh)),
      hi1 = F.R ? Math.ceil(xi + rh) : Math.min(F.NX, Math.ceil(xi + rh));
    const bx0 = F.R ? 0 : hi0,
      bx1 = F.R ? F.NX : hi1; // na rúre chladne celý obvod v ohriatych riadkoch
    // obdĺžnik ohriatych buniek – chladnutie sa počíta len v ňom, nie v celej sieti
    if (!F.hb) F.hb = [bx0, bx1, hj0, hj1];
    else {
      F.hb[0] = Math.min(F.hb[0], bx0);
      F.hb[1] = Math.max(F.hb[1], bx1);
      F.hb[2] = Math.min(F.hb[2], hj0);
      F.hb[3] = Math.max(F.hb[3], hj1);
    }
    for (let j = hj0; j <= hj1; j++)
      for (let i = hi0; i <= hi1; i++) {
        const r = Math.hypot(i - xi, j - zj) / rh;
        if (r > 1) continue;
        const ii = colOf(i),
          k = idxOf(ii, j);
        F.heat[k] = Math.max(F.heat[k], (1 - r) * 0.9);
        if (F.temp[k] < 0.35 * (1 - r)) F.temp[k] = 0.35 * (1 - r);
        if (F.R && ii === 0) {
          const k2 = idxOf(F.NX, j);
          F.heat[k2] = F.heat[k];
          F.temp[k2] = F.temp[k];
        }
      }
    return added;
  };
  // koncový kráter po zhasnutí oblúka
  const crater = (cx, cz, rp) => {
    const xi = (cx + F.L / 2) / RES,
      zj = (cz + W2) / RES,
      rc = (rp * 0.55) / RES;
    for (let j = Math.max(0, Math.floor(zj - rc)); j <= Math.min(NZ, Math.ceil(zj + rc)); j++)
      for (let i = Math.floor(xi - rc); i <= Math.ceil(xi + rc); i++) {
        const ii = colOf(i);
        if (ii < 0) continue;
        const r2 = ((i - xi) * (i - xi) + (j - zj) * (j - zj)) / (rc * rc);
        if (r2 > 1) continue;
        const k = idxOf(ii, j),
          cut = Math.min(F.dep[k] * 0.6, 0.55 * (1 - r2));
        if (cut > 0) {
          F.h[k] -= cut;
          F.dep[k] -= cut;
          const n = F.ln[k];
          if (n) F.lh[k * LAYS + n - 1] = Math.max(0, F.lh[k * LAYS + n - 1] - cut);
          if (F.R && ii === 0) copyCell(k, idxOf(F.NX, j));
        }
      }
  };
  // ---------- držiak, elektróda, oblúk, kábel ----------
  const holder = grp(MIG ? 'horak' : 'drziak');
  const elRod = add(holder, new THREE.CylinderGeometry(1, 1, 1, 12), M.rod);
  elRod.castShadow = false;
  const elCore = add(holder, new THREE.CylinderGeometry(1, 1, 1, 10), M.core);
  const hJaw = new THREE.Group();
  holder.add(hJaw);
  box(hJaw, -0.09, 0.09, 0, 0.35, -0.07, 0.07, M.copper);
  cylY(hJaw, 0.11, 0.13, 0.35, 0.5, 0, 0, M.handle, 16);
  cylY(hJaw, 0.13, 0.13, 0.5, 2.3, 0, 0, M.handle, 16);
  cylY(hJaw, 0.13, 0.09, 2.3, 2.5, 0, 0, M.handle, 16);
  const hCable = new THREE.Mesh(new THREE.BufferGeometry(), M.cable);
  hCable.castShadow = true;
  holder.add(hCable);
  // horák MIG/MAG (lokálna +Y od kontaktnej špičky k rukoväti): drôt, hubica, špička, krk, rukoväť so spúšťačom
  const torch = new THREE.Group();
  holder.add(torch);
  torch.visible = MIG;
  const wireM = add(torch, new THREE.CylinderGeometry(1, 1, 1, 8), M.copper);
  wireM.castShadow = false;
  if (MIG) {
    cylY(torch, 0.03, 0.035, -0.02, 0.12, 0, 0, M.copper, 12); // kontaktná špička
    cylY(torch, 0.085, 0.1, -0.03, 0.5, 0, 0, M.steel, 20); // plynová hubica
    cylY(torch, 0.1, 0.1, 0.5, 0.62, 0, 0, M.black, 20);
    cylY(torch, 0.055, 0.055, 0.62, 1.55, 0, 0, M.steelDark, 14); // krk horáka
    cylY(torch, 0.13, 0.15, 1.55, 2.85, 0, 0, M.handle, 18); // rukoväť
    box(torch, 0.1, 0.2, 1.75, 2.0, -0.05, 0.05, M.red); // spúšťač
    elRod.visible = elCore.visible = false;
    hJaw.visible = false;
  }
  const arcCore = add(root, new THREE.SphereGeometry(0.035, 12, 8), M.arc);
  arcCore.castShadow = false;
  const haloCv = document.createElement('canvas');
  haloCv.width = haloCv.height = 128;
  (() => {
    const g = haloCv.getContext('2d'),
      gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.15, 'rgba(210,230,255,.9)');
    gr.addColorStop(0.45, 'rgba(140,180,255,.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  })();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(haloCv),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
    }),
  );
  halo.scale.set(0.9, 0.9, 1);
  scene.add(halo);
  // decay 0 + dosah 9: mäkký okraj ako v r128
  const arcLight = new THREE.PointLight(0xdbe8ff, 0, 9, 0);
  scene.add(arcLight);
  const aimMark = new THREE.Mesh(
    new THREE.TorusGeometry(4, 0.5, 8, 32),
    new THREE.MeshBasicMaterial({
      color: 0x46c8ff,
      toneMapped: false,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    }),
  );
  aimMark.rotation.x = -Math.PI / 2;
  aimMark.renderOrder = 8;
  aimMark.visible = false;
  pivot.add(aimMark);
  const jointGeo = new THREE.BufferGeometry();
  const jointLine = new THREE.Line(
    jointGeo,
    new THREE.LineDashedMaterial({
      color: 0x46c8ff,
      dashSize: 4,
      gapSize: 3,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    }),
  );
  jointLine.renderOrder = 7;
  pivot.add(jointLine);
  const jointZ = () => F.S.path[0].z;
  // modrá čiara po krivke spoja (na rúre zavinutá po obvode)
  const placeJoint = () => {
    const S = F.S,
      pts = S.path.map((p) => v3(...mapPoint(S, p.x, S.lineY, p.z, mp)));
    if (S.closed) pts.push(pts[0].clone());
    jointGeo.setFromPoints(pts);
    jointLine.computeLineDistances();
  };
  // bod a normála výškovej mapy vo svete
  const locW = (x, y, z, out = tmpL) => pivot.localToWorld(out.set(...mapPoint(F.S, x, y, z, mp)));
  const nrmW = (x, out) => out.set(...normalAt(F.S, x, mp)).transformDirection(pivot.matrixWorld);
  // ohorky elektród: po výmene padnú na stôl (alebo na zem) a zostanú ležať
  const stubs = [];
  const dropStub = (len, rr, at, dir) => {
    if (len < 0.05) return;
    const m = new THREE.Mesh(elRod.geometry, M.rod);
    m.castShadow = true;
    m.scale.set(rr * 1.6, len, rr * 1.6);
    m.position.copy(at).addScaledVector(dir, len / 2);
    m.quaternion.setFromUnitVectors(v3(0, 1, 0), dir);
    scene.add(m);
    stubs.push({
      m,
      v: v3((Math.random() - 0.5) * 0.6, 0.4, 0.5 + Math.random() * 0.3),
      w: v3(Math.random() * 6, Math.random() * 2, 4 + Math.random() * 4),
      rest: false,
      len,
    });
    if (stubs.length > 10) {
      const o = stubs.shift();
      scene.remove(o.m);
    }
  };
  const updateStubs = (dt) => {
    for (const s of stubs) {
      if (s.rest) continue;
      s.v.y -= 12 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.w.x * dt;
      s.m.rotation.y += s.w.y * dt;
      s.m.rotation.z += s.w.z * dt;
      const onTable = Math.abs(s.m.position.x) < 5 && Math.abs(s.m.position.z) < 3,
        floorY = (onTable ? TT : 0) + s.m.scale.x;
      if (s.m.position.y <= floorY && s.v.y < 0) {
        s.m.position.y = floorY;
        s.m.rotation.set(0, Math.random() * TAU, Math.PI / 2);
        s.rest = true;
      }
    }
  };
  const tmpL = v3(0, 0, 0),
    ZAX = v3(0, 0, 1);
  const secMark = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff5a3c,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  secMark.renderOrder = 6;
  secMark.visible = false;
  pivot.add(secMark);
  const secBasis = new THREE.Matrix4(),
    sU = v3(0, 0, 0),
    sT = v3(0, 0, 0),
    sA = v3(0, 0, 0);
  const placeSecMark = () => {
    const S = F.S,
      p = S.path[clamp(Math.round((c.secPos / 100) * (S.path.length - 1)), 0, S.path.length - 1)],
      span = S.wTop + 6,
      hgt = S.gref + 16;
    const cx = p.x - p.tz * S.so,
      cz = p.z + p.tx * S.so;
    sU.set(...normalAt(S, cx, mp));
    sT.set(...tangentOf(S, cx, p.tx, p.tz, mp));
    sA.crossVectors(sU, sT);
    secBasis.makeBasis(sA, sU, sT);
    secMark.quaternion.setFromRotationMatrix(secBasis);
    secMark.position.set(...mapPoint(S, cx, hgt / 2 - 3, cz, mp));
    secMark.scale.set(2 * span, hgt, 1);
  };
  const spatter = createParticles(scene, new THREE.BoxGeometry(0.012, 0.012, 0.03), M.spatter, 220, false);
  const smoke = createParticles(scene, new THREE.SphereGeometry(0.035, 10, 8), M.smoke, 160, false);

  // ---------- stav ----------
  const st = {
    pass: 0,
    inc: 0,
    penNow: 0,
    wire: 0,
    por: 0,
    latch: false,
    trigPrev: false,
    tip: v3(),
    aim: { x: 0, z: 0 },
    tx: -40,
    tz: 0,
    wrongDir: 0,
    la: c.arcLen,
    arc: false,
    stuck: false,
    le: 350,
    v: 0,
    msg: null,
    phase: 0,
    cold: 0,
    longArc: 0,
    fast: 0,
    spat: 0,
    flashes: 0,
    sag: 0,
    lastBuild: 0,
    geomDirty: false,
    strikeT: -9,
  };
  let t = 0,
    last = performance.now(),
    teleT = 0,
    statT = 0,
    spAcc = 0,
    smAcc = 0,
    stats = null;
  const flags = {};
  const say = (text, kind = 'warn') => {
    st.msg = { text, kind, until: t + 2.8 };
  };
  const sayOnce = (key, cond, text, kind) => {
    if (cond && !flags[key]) say(text, kind);
    flags[key] = cond;
  };
  const elRange = () => ELECTRODES[c.etype].r[c.de] || [60, 120];

  // poloha zvarenca podľa polohy zvárania
  // natočenie zvarenca: lokálna x = os zvaru, lokálna y = normála lícnej plochy
  const quatOf = (pos, fillet) => {
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      qx = (deg) => new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), (deg * Math.PI) / 180);
    if (pos === 'PF' || pos === 'PG') {
      m.makeBasis(v3(0, 1, 0), v3(0, 0, 1), v3(1, 0, 0));
      return q.setFromRotationMatrix(m);
    }
    if (pos === 'PC') {
      m.makeBasis(v3(1, 0, 0), v3(0, 0, 1), v3(0, -1, 0));
      return q.setFromRotationMatrix(m);
    }
    if (fillet) return pos === 'PA' ? qx(-45) : pos === 'PB' ? q : pos === 'PD' ? qx(180) : qx(135); // PE: os kúta smeruje nadol
    return pos === 'PA' ? q : pos === 'PB' ? qx(45) : pos === 'PD' ? qx(135) : qx(180);
  };
  const basis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const placeWeld = () => {
    const S = F.S,
      Lw = F.L / 100,
      fillet = FILLETS.includes(F.type),
      post = fixture.children[0];
    if (S.R) {
      // rúra – rúra: os vodorovne (PH, PJ), šikmo 45° (H-L045) alebo zvislo (PC); lokálna z = os rúry, vrch rúry v počiatku
      const R = S.R / 100,
        d = (S.R - S.t) / 100,
        h = Math.SQRT1_2,
        hc = TT + 0.8 + R;
      if (c.wPos === 'PC') {
        weldG.quaternion.copy(basis(v3(-1, 0, 0), v3(0, 0, 1), v3(0, 1, 0)));
        weldG.position.set(0, TT + 1.0, -0.4 + d);
      } else if (c.wPos === 'H-L045') {
        weldG.quaternion.copy(basis(v3(0, 0, -1), v3(-h, h, 0), v3(h, h, 0)));
        weldG.position.set(-h * d, hc + 0.45 + h * d, 0.2);
      } else {
        weldG.quaternion.copy(basis(v3(0, 0, -1), v3(0, 1, 0), v3(1, 0, 0)));
        weldG.position.set(0, hc + d, 0.2);
      }
      weldG.updateMatrixWorld(true);
      // tŕň v čele rúry a rameno k stojanu (stojan siaha do výšky tŕňa)
      const end = weldG.localToWorld(v3(0, -(S.R - S.t) / 100, -W2 / 100 - 0.12)),
        axis = v3(0, 0, -1).transformDirection(weldG.matrixWorld);
      const top = v3(0, end.y, -1.6),
        sc = Math.max(0.15, (end.y - TT + 0.1) / 4.2);
      fixture.visible = true;
      post.scale.y = sc;
      post.position.y = TT + 2.1 * sc;
      armBar.scale.set(0.12, 0.12, top.distanceTo(end));
      armBar.position.copy(top).lerp(end, 0.5);
      armBar.lookAt(end);
      armPin.scale.set(((S.R - S.t) / 100) * 0.92, 0.24, ((S.R - S.t) / 100) * 0.92);
      armPin.position.copy(end).addScaledVector(axis, -0.1);
      armPin.quaternion.setFromUnitVectors(v3(0, 1, 0), axis);
      pipeArm.visible = true;
      return;
    }
    pipeArm.visible = false;
    // rúra alebo jokel na plechu: PB a PD ako kútový zvar, PH a PJ s plechom zvisle (os rúry vodorovne)
    const pos = S.id === 'RP' || S.id === 'JK' ? { PH: 'PF', PJ: 'PG' }[c.wPos] || c.wPos : c.wPos;
    weldG.quaternion.copy(quatOf(pos, fillet));
    const raised = pos === 'PD' || pos === 'PE';
    if (pos === 'PA' && !fillet) weldG.position.set(0, TT, 0.4);
    else if (pos === 'PB' && fillet) weldG.position.set(0, TT, 0.4);
    else if (pos === 'PC') weldG.position.set(0, TT + 1.6, -1.25);
    else if (pos === 'PF' || pos === 'PG') weldG.position.set(0, TT + 0.6 + Lw / 2, -1.25);
    else if (raised) weldG.position.set(0, TT + 3.6, 0.2);
    else weldG.position.set(0, TT + 1.0, 0.2);
    fixture.visible = !(pos === 'PA' && !fillet) && !(pos === 'PB' && fillet);
    const sc = raised ? 0.82 : pos === 'PF' || pos === 'PG' ? (0.6 + Lw) / 4.2 : pos === 'PC' ? 0.55 : 0.22;
    post.scale.y = sc;
    post.position.y = TT + 2.1 * sc;
    weldG.updateMatrixWorld(true);
  };
  const newParts = () => {
    F.type = c.wType;
    F.t = c.wT;
    F.S = makeShape(F.type, F.t, c.wL, c.wD);
    buildField();
    placeWeld();
    // začiatok: pri plechu 10 mm od okraja, pri rúre na vrchu, pri uzavretom obryse prvý bod krivky
    const S = F.S,
      p0 = S.R ? nearestOnPath(S, 0, 0) : S.closed ? S.path[0] : nearestOnPath(S, -F.L / 2 + 10, S.path[0].z);
    st.tx = p0.x;
    st.tz = p0.z;
    st.aim.x = st.tx;
    st.aim.z = st.tz;
    placeJoint();
    st.cold = 0;
    st.longArc = 0;
    st.fast = 0;
    st.spat = 0;
    st.sag = 0;
    st.wrongDir = 0;
    st.por = 0;
    st.Imax = 0;
    st.pass = 0;
    st.inc = 0;
    stats = null;
    c.slag = !MIG; // MAG plným drôtom: bez trosky
  };
  newParts();

  // ---------- pohľady, popisy, výber ----------
  const wc = () => weldG.localToWorld(v3(0, F.S.cy / 100, 0));
  const nrm = () => v3(0, 1, 0).transformDirection(weldG.matrixWorld);
  const anchors = {
    ...(MIG
      ? { ...fr.anchors, horak: () => holder.position.clone().add(v3(0, 0.6, 0)) }
      : {
          zvaracka: () => wel.localToWorld(v3(0, 2.8, 0)),
          drziak: () => holder.position.clone().add(v3(0, 0.4, 0)),
        }),
    svorka: () => clampAt.clone().add(v3(0.2, 0.35, 0)),
    stol: () => v3(-4.2, TT + 0.15, 2.6),
    zvarenec: () => wc().add(v3(-0.4, 0.25, 0.5)),
  };
  const views = {
    detail: () => {
      const p = wc(),
        n = nrm();
      const o = n
        .clone()
        .multiplyScalar(2.0)
        .add(v3(0.6, 0.9, 1.8));
      return [[p.x + o.x, p.y + o.y, p.z + o.z], [p.x, p.y, p.z], true];
    },
    celok: () =>
      MIG
        ? [
            [6, 17, 27],
            [4, 5.5, 1],
          ]
        : [
            [11, 15, 18],
            [3, 6, 1.5],
          ],
    zvaracka: () => {
      if (MIG) {
        const p = fr.panelView(),
          d = v3(0, 0, 1).transformDirection(wel.matrixWorld);
        return [[p.x + d.x * 8 + 1.0, p.y + 2.0, p.z + d.z * 8], [p.x, p.y, p.z], true];
      }
      const p = wel.localToWorld(v3(0, 1.3, 1.3));
      return [[p.x + 1.5, p.y + 2.2, p.z + 5.5], [p.x, p.y, p.z], true];
    },
    zhora: () => {
      const p = wc();
      return [[p.x + 0.1, p.y + 5, p.z + 1.2], [p.x, p.y, p.z], true];
    },
  };
  let mouseUsed = false;
  const insp = createInspector({
    dom,
    mount,
    camera,
    root,
    G,
    anchors,
    views,
    labelEls: Array.from(layer.querySelectorAll('[data-part]')),
    enabled: () => !c.manual && !c.unclamped,
    onPick: (k) => apiRef.current.onPick(k),
    blockPick: () => ctrl.isUsed() || c.unclamped || mouseUsed,
    onHL: () => ctrl.invalidate(),
  });
  const ctrl = createControls({ dom, mount, camera, root, tipEl, c, getT: () => t, getHL: insp.hl });
  const { push, pend } = ctrl;
  apiRef.current.view = (n) => insp.goView(n, false);
  // pri MAG sa hodnotí aj najvyšší prúd, ktorým sa zváralo (tenký plech)
  const migI = () =>
    stickoutI(migSynergic({ wire: c.wire, vd: c.vd, prog: c.prog, gas: c.gas, corr: c.corr }).I, c.ctwd);
  apiRef.current.measure = () => ({
    stats: evalWeld(),
    type: F.type,
    t: F.t,
    D: F.S.R ? c.wD : undefined,
    pos: c.wPos,
    slag: c.slag,
    ...(MIG ? { I: st.Imax || migI() } : {}),
  });
  apiRef.current.exportStl = () => exportStl(weldG);
  apiRef.current.snapshot = snapshot;
  apiRef.current.exportStep = async () => {
    if (c.running || c.drive || c.wheel || c.work || st.arc)
      throw new Error(
        L('Najprv zastav stroj a potom exportuj obrobok.', 'Stop the machine before exporting the workpiece.'),
      );
    return exportStep(weldG);
  };
  apiRef.current.newParts = () => {
    if (st.arc) {
      say(L('Najprv zhasni oblúk.', 'Stop the arc first.'));
      return;
    }
    if (c.unclamped) {
      say(L('Najprv polož zvarenec späť.', 'Put the weldment back first.'));
      return;
    }
    newParts();
    insp.goView('detail', false);
    say(L('Pripravené nové diely.', 'New parts are prepared.'), 'info');
  };
  // výmena elektródy s animáciou: držiak sa zdvihne, ohorok vypadne, nová elektróda sa zasunie do čeľustí
  apiRef.current.newElectrode = () => {
    if (MIG || st.arc || st.swap) return;
    if (c.unclamped) {
      say(L('Najprv polož zvarenec späť.', 'Put the weldment back first.'));
      return;
    }
    st.swap = { t: 0, oldLe: st.le, dropped: false, fitted: false };
    st.stuck = false;
    say(L('Výmena elektródy…', 'Changing the electrode…'), 'info');
  };
  apiRef.current.chip = () => {
    if (F.hot > 0.15) {
      say(L('Zvar je ešte horúci – počkaj, kým vychladne.', 'The weld is still hot – wait until it cools down.'));
      return false;
    }
    c.slag = false;
    F.sl.fill(0);
    F.dirty = true;
    say(
      L('Troska je otlčená – vidno kresbu húsenice.', 'The slag is chipped off – the bead ripples are visible.'),
      'info',
    );
    return true;
  };
  const wi = createWorkInspect({
    scene,
    camera,
    dom,
    insp,
    c,
    getObj: () => weldG,
    getSpot: () => v3(2.4, TT + 2.6, 4.2),
    onState: (v) => {
      push('unclamped', v);
      push('manual', c.manual);
    },
  });
  apiRef.current.toggleWork = () => {
    if (wi.phase() === 'in' && st.arc) {
      say(L('Najprv zhasni oblúk.', 'Stop the arc first.'));
      return;
    }
    if (wi.phase() === 'in' && F.hot > 0.3) {
      say(
        L(
          'Zvarenec je rozžhavený – nechaj ho chvíľu vychladnúť.',
          'The weldment is red-hot – let it cool for a moment.',
        ),
      );
      return;
    }
    if (!wi.toggle()) say(L('Počkaj, kým sa dokončí pohyb.', 'Wait until the movement finishes.'), 'info');
  };
  insp.goView('detail', true);

  // ---------- ručné ovládanie prvkov zváračky ----------
  if (MIG) {
    ctrl.reg(
      {
        type: 'lever',
        angles: [0.6, -0.6],
        minR: 0.2,
        label: LL('Hlavný vypínač', 'Main switch'),
        hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
        getIdx: () => (c.power ? 1 : 0),
        onSet: (i) => {
          push('power', i === 1);
          if (i === 0) {
            st.arc = false;
            st.latch = false;
          }
          say(i ? L('Zdroj zapnutý.', 'Source on.') : L('Zdroj vypnutý.', 'Source off.'), 'info');
        },
        read: () => (c.power ? 'I' : '0'),
      },
      fr.mainSw,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.15,
        inc: -1,
        label: LL('Rýchlosť drôtu (synergia)', 'Wire speed (synergic)'),
        hint: LL(
          'V smere hodinových ručičiek (alebo kolieskom nahor) pribúda; prúd a napätie dopočíta synergia.',
          'Clockwise (or wheel up) increases; the synergic line sets current and voltage.',
        ),
        turn: (d) => push('vd', Math.round(clamp(c.vd - d * 2, 1, 22) * 10) / 10),
        read: () => `${c.vd.toFixed(1)} m/min`,
      },
      fr.knobVd,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.15,
        inc: -1,
        label: LL('Korekcia dĺžky oblúka', 'Arc length correction'),
        hint: LL(
          'Plus = dlhší oblúk (vyššie napätie), mínus = kratší.',
          'Plus = longer arc (higher voltage), minus = shorter.',
        ),
        turn: (d) => push('corr', Math.round(clamp(c.corr - d * 0.8, -3, 3) * 10) / 10),
        read: () => `${c.corr > 0 ? '+' : ''}${c.corr.toFixed(1)} V`,
      },
      fr.knobCorr,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Proces: štandard / impulz', 'Process: standard / pulse'),
        hint: LL(
          'Prepína synergický štandardný a impulzný oblúk.',
          'Switches between synergic standard and pulsed arc.',
        ),
        action: () => push('prog', c.prog === 'std' ? 'pulse' : 'std'),
        read: () => (c.prog === 'std' ? 'SYNERGIC STANDARD' : 'SYNERGIC PULS'),
      },
      fr.btnProg,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Režim horáka 2T / 4T', 'Torch mode 2T / 4T'),
        hint: LL(
          '2T: zvára sa, kým držíš spúšťač. 4T: stlač raz = štart, znova = stop.',
          '2T: welds while you hold the trigger. 4T: press once = start, again = stop.',
        ),
        action: () => push('trig', c.trig === '2T' ? '4T' : '2T'),
        read: () => c.trig,
      },
      fr.btnTrig,
    );
    ctrl.reg(
      {
        type: 'lever',
        angles: [0, -1.6],
        minR: 0.15,
        label: LL('Ventil plynovej fľaše', 'Gas cylinder valve'),
        hint: LL('Otvor ventil – bez plynu je zvar pórovitý.', 'Open the valve – without gas the weld is porous.'),
        getIdx: () => (c.valve ? 1 : 0),
        onSet: (i) => {
          push('valve', i === 1);
          say(
            i
              ? L('Ventil fľaše otvorený.', 'Cylinder valve open.')
              : L('Ventil fľaše zatvorený.', 'Cylinder valve closed.'),
            'info',
          );
        },
        read: () => (c.valve ? L('otvorený', 'open') : L('zatvorený', 'closed')),
      },
      fr.vWheel,
    );
  } else {
    const dialIdx = () => logNear(WELD_DIAL, c.current);
    ctrl.reg(
      {
        type: 'lever',
        angles: WELD_DIAL_ANG,
        minR: 0.2,
        label: LL('Nastavenie zváracieho prúdu', 'Welding current setting'),
        hint: LL('Otoč na stupeň 55 – 155 A.', 'Turn to a step 55 – 155 A.'),
        getIdx: dialIdx,
        onSet: (i) => push('current', WELD_DIAL[i]),
        read: () => `${c.current} A`,
      },
      knobI,
    );
    ctrl.reg(
      {
        type: 'lever',
        angles: WELD_MODE_ANG,
        minR: 0.2,
        label: LL('Prepínač: 0 / sváranie 380 V / 220 V / nabíjanie', 'Switch: 0 / welding 380 V / 220 V / charging'),
        hint: LL('Pri 220 V je dovolený prúd najviac 75 A.', 'On 220 V the current is limited to 75 A.'),
        getIdx: () =>
          Math.max(
            0,
            WELD_MODES.findIndex(([k]) => k === c.mode),
          ),
        onSet: (i) => push('mode', WELD_MODES[i][0]),
        read: () => WELD_MODES.find(([k]) => k === c.mode)[1],
      },
      knobM,
    );
    ctrl.reg(
      {
        type: 'button',
        label: LL('Istič', 'Breaker'),
        hint: LL('Zapne istič po vypadnutí.', 'Resets the breaker after a trip.'),
        action: () => {
          push('tripped', false);
          say(L('Istič zapnutý.', 'Breaker reset.'), 'info');
        },
      },
      breaker,
    );
  }
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Zemniaca svorka', 'Ground clamp'),
      hint: LL('Klik pripojí alebo odpojí svorku.', 'Click to attach or detach the clamp.'),
      action: () => push('ground', !c.ground),
    },
    jaw,
  );

  // ---------- ovládanie myšou: pravé tlačidlo vedie elektródu, pravé + ľavé zvára; dotyk: 1 prst vedie, 2 prsty zvárajú ----------
  const io = { right: false, left: false, touches: new Map(), px: 0, py: 0 };
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2(),
    plane = new THREE.Plane(),
    hit = new THREE.Vector3();
  const aimAt = (cx, cy) => {
    const r = dom.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
    // najprv priamo povrch dielu (lemy, rebro, úkos), mimo dielu rovina vo výške spoja
    const hits = ray.intersectObject(F.mesh, false);
    let lp = null;
    const toField = (w) => {
      const p = pivot.worldToLocal(w.clone());
      return unmapPoint(F.S, p.x, p.y, p.z, [0, 0, 0]);
    };
    if (hits.length) lp = toField(hits[0].point);
    else {
      // mimo dielu: dotyková rovina v mieste elektródy (horáka)
      const sh = surfAt(st.tx, st.tz),
        p0 = locW(st.tx, sh == null ? F.t : sh, st.tz, v3(0, 0, 0));
      plane.setFromNormalAndCoplanarPoint(nrmW(st.tx, v3(0, 0, 0)), p0);
      if (ray.ray.intersectPlane(plane, hit)) lp = toField(hit);
    }
    if (lp) {
      st.aim.x = F.R ? wrapX(F.S, lp[0]) : clamp(lp[0], -F.L / 2 - 160, F.L / 2 + 160);
      st.aim.z = clamp(lp[2], -W2 - 160, W2 + 160);
    }
  };
  const active = () => c.manual && !c.unclamped; // zvára sa len v režime „Zváranie“
  const setBtns = (e) => {
    io.right = !!(e.buttons & 2);
    io.left = !!(e.buttons & 1);
  };
  const centroid = () => {
    let x = 0,
      y = 0;
    io.touches.forEach((p) => {
      x += p.x;
      y += p.y;
    });
    const n = io.touches.size || 1;
    return [x / n, y / n];
  };
  const pd = (e) => {
    if (!active()) return;
    if (e.pointerType === 'touch') {
      io.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      e.stopImmediatePropagation();
      mouseUsed = true;
      aimAt(...centroid());
      return;
    }
    setBtns(e);
    mouseUsed = io.right;
    if (io.right) {
      e.stopImmediatePropagation();
      try {
        dom.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignorované */
      }
      aimAt(e.clientX, e.clientY);
    } else if (io.left && !ctrl.isUsed()) {
      io.tilt = { x: e.clientX, y: e.clientY };
      e.stopImmediatePropagation();
      try {
        dom.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignorované */
      }
    }
  };
  const pm = (e) => {
    if (!active()) {
      io.right = io.left = false;
      io.touches.clear();
      return;
    }
    if (e.pointerType === 'touch') {
      if (io.touches.has(e.pointerId)) {
        io.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        e.stopImmediatePropagation();
        aimAt(...centroid());
      }
      return;
    }
    setBtns(e);
    if (io.right) {
      mouseUsed = true;
      e.stopImmediatePropagation();
      aimAt(e.clientX, e.clientY);
    } else if (io.tilt && io.left) {
      // ťahom hore / dole sklon v smere zvárania, do strán pracovný uhol
      const dx = e.clientX - io.tilt.x,
        dy = e.clientY - io.tilt.y;
      io.tilt.x = e.clientX;
      io.tilt.y = e.clientY;
      push('tiltA', Math.round(clamp(c.tiltA - dy * 0.35, -40, 70)));
      push('tiltB', Math.round(clamp(c.tiltB + dx * 0.35, -60, 60)));
      e.stopImmediatePropagation();
    }
  };
  const pu = (e) => {
    if (e.pointerType === 'touch') {
      io.touches.delete(e.pointerId);
      return;
    }
    setBtns(e);
    if (!io.left) io.tilt = null;
  };
  const wh = (e) => {
    if (!active() || !io.right) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (MIG) push('ctwd', clamp(c.ctwd + (e.deltaY > 0 ? -1 : 1), 2, 30));
    else push('arcLen', clamp(c.arcLen + (e.deltaY > 0 ? -0.5 : 0.5), 0, 12));
  };
  dom.addEventListener('pointerdown', pd, { capture: true });
  dom.addEventListener('pointermove', pm, { capture: true });
  dom.addEventListener('pointerup', pu, { capture: true });
  dom.addEventListener('pointercancel', pu, { capture: true });
  dom.addEventListener('wheel', wh, { capture: true, passive: false });
  apiRef.current.debug = (on, x, z) => {
    io.left = io.right = !!on;
    if (x != null) {
      st.aim.x = x;
      st.aim.z = z;
    }
  };

  // ---------- hlavná slučka ----------
  const dirW = v3(),
    xW = v3(),
    nW = v3(),
    tipW = v3(),
    tmp = v3(),
    tmp2 = v3(),
    sP = v3(),
    sV = v3(),
    UP = v3(0, 1, 0),
    q = new THREE.Quaternion(); // pomocné objekty – v slučke sa nič nové nevytvára
  let raf,
    cableKey = '',
    cableT = 0,
    flick = 1,
    flickT = 0;
  const loop = (nowMs) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    t += dt;
    wi.update(dt);
    const moving = io.right || io.touches.size >= 1;
    const trigger = !st.swap && ((io.right && io.left) || io.touches.size >= 2);
    // priebeh výmeny elektródy: čeľuste sa zdvihnú nad dĺžku novej elektródy, ohorok vypadne,
    // nová elektróda sa zboku zasunie do čeľustí a držiak sa vráti do pracovnej polohy
    let jawLen = -1,
      slide = 0,
      drop = false;
    if (st.swap) {
      const s = st.swap,
        e = (k) => k * k * (3 - 2 * k);
      s.t += dt;
      const T = s.t,
        A = s.oldLe / 100,
        B = 3.5 + 0.8;
      jawLen =
        T < 0.35 ? A + (B - A) * e(T / 0.35) : T < 1.35 ? B : T < 1.75 ? B + (3.5 - B) * e((T - 1.35) / 0.4) : 3.5;
      if (!s.dropped && T >= 0.4) {
        s.dropped = true;
        drop = true;
        st.le = 0;
      } // ohorok vypadne (dĺžka s.oldLe)
      if (s.dropped && !s.fitted && T >= 0.6) {
        s.fitted = true;
        st.le = 350;
      } // aj keby to bolo v tom istom snímku
      slide = T < 0.6 ? 1 : T < 1.25 ? 1 - e((T - 0.6) / 0.65) : 0;
      if (T >= 1.75) {
        st.swap = null;
        say(L('Vložená nová elektróda – môžeš pokračovať.', 'A new electrode is fitted – carry on.'), 'info');
      }
    }

    // vedenie ruky (obmedzená rýchlosť)
    const ox = st.tx,
      oz = st.tz;
    const posit = F.S.R > 0 && c.wPos === 'PA';
    if (posit && c.rotOn) st.aim.x = st.tx; // pri polohovadle ruka vedie len priečne
    if (moving) {
      const mx = diffX(F.S, st.aim.x, st.tx),
        mz = st.aim.z - st.tz,
        d = Math.hypot(mx, mz),
        lim = (st.arc ? c.handV : 250) * dt;
      if (d > lim) {
        st.tx += (mx / d) * lim;
        st.tz += (mz / d) * lim;
      } else {
        st.tx = st.aim.x;
        st.tz = st.aim.z;
      }
      st.tx = wrapX(F.S, st.tx);
    }
    if (posit && c.rotOn && !c.unclamped) {
      st.tx = wrapX(F.S, st.tx + c.rotV * dt);
      st.aim.x = st.tx;
    }
    // otočenie rúry: miesto zvárania je stále hore (stred rúry ostáva na mieste)
    if (posit) {
      const a0 = st.tx / F.S.R,
        cc = (F.S.R - F.S.t) / 100;
      pivot.rotation.z = a0;
      pivot.position.set(-cc * Math.sin(a0), -cc + cc * Math.cos(a0), 0);
    } else if (pivot.rotation.z) {
      pivot.rotation.z = 0;
      pivot.position.set(0, 0, -F.S.cz / 100);
    }
    weldG.updateMatrixWorld(true);
    secMark.visible = !!c.secOn && !c.unclamped;
    if (secMark.visible) placeSecMark();
    aimMark.visible = c.manual && moving && !c.unclamped;
    jointLine.visible = c.manual && !c.unclamped && F.type !== 'N';
    if (aimMark.visible) {
      const sa = surfAt(st.aim.x, st.aim.z);
      aimMark.position.set(...mapPoint(F.S, st.aim.x, (sa == null ? F.t : sa) + 0.6, st.aim.z, mp));
      aimMark.quaternion.setFromUnitVectors(ZAX, tmp.set(...normalAt(F.S, st.aim.x, mp)));
    }
    const stepL = Math.hypot(diffX(F.S, st.tx, ox), st.tz - oz),
      vNow = stepL / Math.max(dt, 1e-3);
    // posun ruky nahor / nadol vo svete – smer zvárania v polohách PF, PG, PH, PJ, H-L045
    const dUp = stepL > 0 ? locW(st.tx, F.t, st.tz).y - locW(ox, F.t, oz).y : 0;
    const wrongDir = (POS_UP.includes(c.wPos) && dUp < -0.0002) || (POS_DOWN.includes(c.wPos) && dUp > 0.0002);
    const dirMsg = POS_UP.includes(c.wPos)
      ? L(`V polohe ${c.wPos} sa zvára zdola nahor.`, `In position ${c.wPos} weld upwards.`)
      : L(`V polohe ${c.wPos} sa zvára zhora nadol.`, `In position ${c.wPos} weld downwards.`);
    const vert = POS_VERT.includes(c.wPos);
    st.v += (vNow - st.v) * Math.min(1, dt * 6);

    // parametre procesu: MMA – nastavený prúd a výška elektródy; MIG/MAG – synergia z rýchlosti drôtu a výlet drôtu
    let I,
      lo,
      hi,
      syn = null,
      cover = 1;
    const de = c.de;
    if (MIG) {
      syn = migSynergic({ wire: c.wire, vd: c.vd, prog: c.prog, gas: c.gas, corr: c.corr });
      I = stickoutI(syn.I, c.ctwd);
      [lo, hi] = migRange(F.t);
      cover =
        gasCover({ valve: c.valve, flow: c.flow, ctwd: c.ctwd }) *
        (Math.abs(c.tiltA) > 45 || Math.abs(c.tiltB) > 50 ? 0.6 : 1); // veľký sklon: plyn uniká bokom
    } else {
      I = c.current;
      [lo, hi] = elRange();
      if (st.arc) {
        const burn = I * 0.045 * dt;
        st.le = Math.max(0, st.le - burn);
        if (!c.autoArc) push('arcLen', clamp(c.arcLen + burn * 0.5, 0, 12));
      }
    }
    const sRaw = surfAt(st.tx, st.tz),
      surf = sRaw == null ? F.t : sRaw; // mimo dielu elektróda (drôt) visí v rovine jeho povrchu
    st.la = MIG ? syn.la : c.arcLen;
    const rpNow = MIG ? clamp(1.3 + 0.022 * I + 0.35 * (syn.la - 2), 2.5, 9) : clamp(1.1 * de + 0.025 * I, 2.5, 8);
    // hĺbka natavenia základného materiálu (mm): rastie s prúdom, pri pomalom posuve a sprchovom prenose; pri nízkom prúde a dlhom oblúku klesá
    const speedK = clamp(Math.sqrt(4 / Math.max(st.v, 1)), 0.6, 1.4);
    const tiltK = clamp(1 + 0.35 * Math.sin((c.tiltA * Math.PI) / 180), 0.75, 1.3),
      tiltBig = Math.abs(c.tiltA) > 45 || Math.abs(c.tiltB) > 50;
    st.penNow =
      tiltK *
      clamp(
        (MIG
          ? 0.011 * I * ({ short: 0.85, globular: 1, spray: 1.6, pulse: 1.25 }[syn.mode] || 1)
          : 0.013 * I * (c.etype === 'basic' ? 1.1 : 1) * (st.la > de + 1.5 ? 0.7 : 1)) *
          speedK *
          (I < lo ? 0.3 : 1),
        0,
        6,
      );

    // zapálenie a udržanie oblúka
    if (MIG) {
      // 2T: zvára sa, kým je stlačený spúšťač; 4T: stlačenie zapne, ďalšie stlačenie vypne
      if (trigger && !st.trigPrev && c.trig === '4T') st.latch = !st.latch;
      st.trigPrev = trigger;
      const want = c.trig === '4T' ? !!st.latch : trigger;
      if (!want) {
        if (st.arc) {
          say(L('Oblúk zhasol – drôt sa zastavil.', 'Arc off – the wire stopped.'), 'info');
          st.arcOff = t;
          if (sRaw != null) {
            crater(st.tx, st.tz, rpNow);
            st.geomDirty = true;
          }
        }
        st.arc = false;
      } else if (!st.arc) {
        if (!c.power) {
          sayOnce(
            'noP',
            true,
            L('Zdroj je vypnutý – zapni hlavný vypínač.', 'The source is off – switch on the main switch.'),
          );
          st.latch = false;
        } else if (!c.ground) {
          sayOnce(
            'noP',
            true,
            L(
              'Zemniaca svorka nie je pripojená – obvod nie je uzavretý.',
              'The ground clamp is not attached – the circuit is open.',
            ),
          );
          st.latch = false;
        } else if (sRaw == null)
          sayOnce(
            'noP',
            true,
            L(
              'Horák je mimo zvarenca – drôt nemá o čo zapáliť oblúk.',
              'The torch is off the part – the wire has nothing to strike on.',
            ),
          );
        else if (c.ctwd > 28)
          sayOnce(
            'noP',
            true,
            L(
              'Horák je príliš ďaleko – priblíž ho (koliesko pri držanom pravom tlačidle).',
              'The torch is too far – bring it closer (wheel while holding the right button).',
            ),
          );
        else {
          st.arc = true;
          st.strikeT = t;
          st.pass = (st.pass % 250) + 1;
          flags.noP = false;
          if (!c.helmet) st.flashes++;
        }
      }
      if (st.arc) {
        if (sRaw == null) {
          st.arc = false;
          st.latch = false;
          st.arcOff = t;
          say(L('Oblúk zhasol – horák zišiel z dielu.', 'The arc went out – the torch left the part.'), 'warn');
        } else if (c.ctwd < 3) {
          st.arc = false;
          st.latch = false;
          st.arcOff = t;
          say(
            L(
              'Hubica narazila do kúpeľa – drôt sa zapichol a prilepil ku kontaktnej špičke.',
              'The nozzle hit the pool – the wire stubbed and burnt back to the contact tip.',
            ),
            'danger',
          );
        }
      }
    } else {
      if (c.mode === 'w220' && I > 75 && trigger && !c.tripped) {
        push('tripped', true);
        say(
          L(
            'Istič vypadol – pri 220 V je najvyšší zvárací prúd 75 A.',
            'The breaker tripped – on 220 V the welding current is limited to 75 A.',
          ),
          'danger',
        );
      }
      if (!trigger) {
        if (st.arc) {
          say(L('Oblúk zhasol.', 'Arc extinguished.'), 'info');
          st.arcOff = t;
          if (sRaw != null) {
            crater(st.tx, st.tz, rpNow);
            st.geomDirty = true;
          }
        }
        st.arc = false;
        st.stuck = false;
      } else if (!st.arc && !st.stuck) {
        if (c.mode === 'off')
          sayOnce(
            'noP',
            true,
            L(
              'Zváračka je vypnutá – otoč prepínač na 380 V alebo 220 V.',
              'The welder is off – turn the switch to 380 V or 220 V.',
            ),
          );
        else if (c.mode === 'charge')
          sayOnce(
            'noP',
            true,
            L(
              'Prepínač je na nabíjaní – na zváranie ho otoč na 380 V alebo 220 V.',
              'The switch is on charging – turn it to 380 V or 220 V for welding.',
            ),
          );
        else if (c.tripped)
          sayOnce(
            'noP',
            true,
            L('Istič je vypnutý – zapni ho na zváračke.', 'The breaker is off – reset it on the welder.'),
          );
        else if (!c.ground)
          sayOnce(
            'noP',
            true,
            L(
              'Zemniaca svorka nie je pripojená – obvod nie je uzavretý.',
              'The ground clamp is not attached – the circuit is open.',
            ),
          );
        else if (st.le < 30)
          sayOnce(
            'noP',
            true,
            L(
              'Elektróda je spotrebovaná – vymeň ju (tlačidlo v scéne alebo E).',
              'The electrode is used up – replace it (button in the scene or E).',
            ),
          );
        else if (sRaw == null)
          sayOnce(
            'noP',
            true,
            L(
              'Elektróda je mimo zvarenca – oblúk nie je kde zapáliť.',
              'The electrode is off the part – there is nothing to strike the arc on.',
            ),
          );
        else if (st.la > 5)
          sayOnce(
            'noP',
            true,
            L(
              'Elektróda je ďaleko – priblíž ju k zvarencu (koliesko pri držanom pravom tlačidle).',
              'The electrode is too far – bring it closer (wheel while holding the right button).',
            ),
          );
        else {
          st.arc = true;
          st.strikeT = t;
          st.pass = (st.pass % 250) + 1;
          flags.noP = false;
          if (!c.helmet) st.flashes++;
        }
      }
      if (st.arc) {
        if (st.la < 0.4) {
          st.arc = false;
          st.stuck = true;
          say(
            L(
              'Elektróda sa prilepila – uvoľni tlačidlá a zdvihni ju.',
              'The electrode stuck – release the buttons and lift it.',
            ),
            'danger',
          );
        } else if (st.la > 1.6 * de + 4) {
          st.arc = false;
          say(L('Oblúk sa pretrhol – je príliš dlhý.', 'The arc broke – it is too long.'), 'warn');
        } else if (st.le <= 25) {
          st.arc = false;
          say(L('Elektróda dohorela – vymeň ju.', 'The electrode has burnt down – replace it.'), 'warn');
        } else if (sRaw == null) {
          st.arc = false;
          st.arcOff = t;
          say(
            L('Oblúk sa pretrhol – elektróda zišla z dielu.', 'The arc broke – the electrode left the part.'),
            'warn',
          );
        }
      }
    }

    // tavenie a tvorba húsenice
    if (st.arc) {
      if (MIG) {
        // nanesený kov = prierez drôtu × rýchlosť drôtu; slabá ochrana plynom zanechá póry
        const dV = syn.dep * dt * clamp(I / syn.I, 0.7, 1.1);
        st.phase += stepL + dt * 0.5;
        if (deposit(st.tx, st.tz, dV, rpNow, st.phase, cover < 0.7) > 0) st.geomDirty = true;
        st.wire += (c.vd / 60) * dt;
        st.Imax = Math.max(st.Imax || 0, I);
        if (I < lo) st.cold += dt;
        if (st.v > 14) st.fast += dt;
        if (cover < 0.7) st.por += dt;
        if (vert && (syn.mode === 'spray' || I > hi * 0.9)) st.sag += dt;
        if (wrongDir) st.wrongDir += dt;
        sayOnce('dir', wrongDir, dirMsg, 'warn');
        sayOnce(
          'gas',
          cover < 0.7,
          !c.valve
            ? L(
                'Ventil plynovej fľaše je zatvorený – zvar je pórovitý!',
                'The gas cylinder valve is closed – the weld is porous!',
              )
            : c.flow < 8
              ? L('Málo plynu – nastav prietok 12 – 16 l/min.', 'Too little gas – set the flow to 12 – 16 l/min.')
              : c.flow > 22
                ? L(
                    'Príliš veľký prietok plynu – turbulencia nasáva vzduch, vznikajú póry.',
                    'Gas flow too high – turbulence draws in air, porosity forms.',
                  )
                : L(
                    'Dlhý výlet drôtu – plyn kúpeľ nechráni, vznikajú póry. Priblíž horák.',
                    'Long stick-out – the gas does not cover the pool, porosity forms. Move the torch closer.',
                  ),
          'danger',
        );
        sayOnce(
          'cold',
          I < lo,
          L(
            `Prúd ${Math.round(I)} A je nízky pre plech ${F.t} mm (${lo} – ${hi} A) – hrozí studený spoj. Zvýš rýchlosť drôtu.`,
            `${Math.round(I)} A is low for a ${F.t} mm plate (${lo} – ${hi} A) – risk of cold lap. Raise the wire speed.`,
          ),
          'warn',
        );
        sayOnce(
          'hot',
          I > hi,
          L(
            `Prúd ${Math.round(I)} A je vysoký pre plech ${F.t} mm – hrozí prepálenie.`,
            `${Math.round(I)} A is high for a ${F.t} mm plate – risk of burn-through.`,
          ),
          'warn',
        );
        sayOnce(
          'glob',
          syn.mode === 'globular',
          L(
            'Prechodový oblúk – veľký rozstrek. Zmeň rýchlosť drôtu alebo zapni impulz.',
            'Globular transfer – heavy spatter. Change the wire speed or switch to pulse.',
          ),
          'warn',
        );
        sayOnce(
          'sprayv',
          vert && syn.mode === 'spray',
          L(
            'Sprchový prenos sa v tejto polohe nedá použiť – kúpeľ steká. Zníž rýchlosť drôtu alebo použi impulz.',
            'Spray transfer cannot be used in this position – the pool runs. Lower the wire speed or use pulse.',
          ),
          'warn',
        );
        sayOnce(
          'ctwdS',
          c.ctwd < 7,
          L(
            'Horák je veľmi blízko – rozstrek sa lepí na hubicu.',
            'The torch is very close – spatter sticks to the nozzle.',
          ),
          'warn',
        );
        spAcc += dt * syn.spat * (cover < 0.5 ? 1.5 : 1) * (c.ctwd > 18 ? 1.4 : 1) * (tiltBig ? 1.8 : 1);
        smAcc += dt * 8;
      } else {
        const eff = I < lo * 0.85 ? 0.55 : 1;
        const dV = 0.42 * I * eff * dt;
        st.phase += stepL + dt * 0.5; // dráha v mm – určuje šupiny húsenice
        if (deposit(st.tx, st.tz, dV, rpNow, st.phase) > 0) {
          st.geomDirty = true;
          if (!c.slag) push('slag', true);
        }
        if (I < lo) st.cold += dt;
        if (st.la > de + 1.5) st.longArc += dt;
        if (st.v > 9) st.fast += dt;
        if (vert && I > hi * 0.9) st.sag += dt;
        if (wrongDir) st.wrongDir += dt;
        sayOnce('dir', wrongDir, dirMsg, 'warn');
        sayOnce(
          'cold',
          I < lo,
          L(
            `Prúd je nízky pre elektródu Ø${de} (${lo} – ${hi} A) – oblúk je nestabilný, hrozí studený spoj.`,
            `The current is low for a Ø${de} electrode (${lo} – ${hi} A) – unstable arc, risk of cold lap.`,
          ),
          'warn',
        );
        sayOnce(
          'hot',
          I > hi,
          L(
            `Prúd je vysoký pre elektródu Ø${de} – veľký rozstrek a prepal.`,
            `The current is high for a Ø${de} electrode – heavy spatter and burn-through.`,
          ),
          'warn',
        );
        sayOnce(
          'long',
          st.la > de + 1.5,
          L(
            'Oblúk je dlhý – rozstrek a póry. Drž elektródu bližšie.',
            'The arc is long – spatter and porosity. Keep the electrode closer.',
          ),
          'warn',
        );
        sayOnce(
          'sag',
          vert && I > hi * 0.9,
          L('V tejto polohe kúpeľ steká – zníž prúd.', 'In this position the pool runs – reduce the current.'),
          'warn',
        );
        spAcc += dt * (25 + (st.la > de + 1 ? 70 : 0) + (I > hi ? 60 : 0)) * (tiltBig ? 1.8 : 1);
        smAcc += dt * 14;
      }
      // rady k sklonu horáka / elektródy
      sayOnce(
        'tiltBig',
        tiltBig,
        L(
          'Príliš veľký sklon – oblúk fúka bokom, pribúda rozstrek' + (MIG ? ' a plyn kúpeľ nechráni.' : '.'),
          'Tilt too large – the arc blows sideways, more spatter' +
            (MIG ? ' and the gas no longer covers the pool.' : '.'),
        ),
        'warn',
      );
      sayOnce(
        'tiltFil',
        FILLETS.includes(F.type) && F.type !== 'L' && Math.abs(c.tiltB) < 20 && st.v > 0.5,
        L(
          'Pri kútovom zvare nakloň ' +
            (MIG ? 'horák' : 'elektródu') +
            ' asi o 45° do kúta – drž ľavé tlačidlo a ťahaj do strany.',
          'For a fillet weld tilt the ' +
            (MIG ? 'torch' : 'electrode') +
            ' about 45° into the corner – hold the left button and drag sideways.',
        ),
        'info',
      );
      // rozstrek a dym
      tipW.copy(locW(st.tx, surf, st.tz));
      nrmW(st.tx, nW);
      while (spAcc >= 1) {
        spAcc -= 1;
        st.spat++;
        const a = Math.random() * TAU,
          s = 0.8 + Math.random() * 2.2;
        spatter.spawn(
          sP.copy(tipW).addScaledVector(nW, 0.02),
          sV.set(Math.cos(a) * s, 0, Math.sin(a) * s).addScaledVector(nW, 1 + Math.random() * 2),
          0.35 + Math.random() * 0.4,
          9,
          0,
        );
      }
      while (smAcc >= 1) {
        smAcc -= 1;
        smoke.spawn(
          sP.set((Math.random() - 0.5) * 0.1, 0.05, (Math.random() - 0.5) * 0.1).add(tipW),
          sV.set((Math.random() - 0.5) * 0.25, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.25),
          2.2 + Math.random(),
          -0.4,
          0,
        );
      }
    }

    // chladnutie
    if (F.hot > 0.01 || st.arc) {
      const k = Math.exp(-dt / 2.6),
        hb = F.hb;
      if (hb)
        for (let j = hb[2]; j <= hb[3]; j++)
          for (let i = hb[0], q = idxOf(hb[0], j); i <= hb[1]; i++, q++) if (F.temp[q] > 0) F.temp[q] *= k;
      F.cooling = true;
    } else F.hb = null; // všetko vychladlo
    if ((F.dirty || st.geomDirty || F.cooling) && t - st.lastBuild > 0.1) {
      if (F.dirty || st.geomDirty || !F.hb) rebuildField(st.geomDirty);
      else rebuildGlow(F.hb); // pri samotnom chladnutí len žiara v ohriatej oblasti
      F.dirty = false;
      F.cooling = false;
      st.geomDirty = false;
      st.lastBuild = t;
    }

    // elektróda, držiak, oblúk (pri prezeraní zvarenca zostáva držiak na mieste)
    weldG.updateMatrixWorld(true);
    if (!c.unclamped) {
      // normála povrchu a smer spoja v mieste elektródy (na rúre a po krivke sa menia)
      nrmW(st.tx, nW);
      const pp = nearestOnPath(F.S, st.tx, st.tz);
      xW.set(...tangentOf(F.S, st.tx, pp.tx, pp.tz, mp)).transformDirection(pivot.matrixWorld);
      tipW.copy(locW(st.tx, surf + st.la, st.tz)); // hrot elektródy pri zváraní
      const ta = (c.tiltA * Math.PI) / 180,
        tb = (c.tiltB * Math.PI) / 180; // sklon v smere zvárania (+ ťahom) a pracovný uhol do strany
      dirW.copy(nW).multiplyScalar(Math.cos(ta)).addScaledVector(xW, -Math.sin(ta)).normalize().applyAxisAngle(xW, tb);
      let endW;
      if (MIG) {
        // horák: kontaktná špička vo vzdialenosti výletu drôtu od dielu, drôt trčí z hubice k oblúku
        const stick = Math.max(0.02, (c.ctwd - st.la) / 100),
          wr = Math.max(0.004, c.wire / 200);
        holder.position.copy(tipW).addScaledVector(dirW, stick);
        q.setFromUnitVectors(UP, dirW);
        torch.quaternion.copy(q);
        wireM.scale.set(wr, stick, wr);
        wireM.position.set(0, -stick / 2, 0);
        endW = tmp2.copy(holder.position).addScaledVector(dirW, 2.85);
      } else {
        const rr = de / 200;
        // skupina držiaka stojí v čeľustiach; elektróda z nich trčí smerom k zvarencu
        const len = jawLen >= 0 ? jawLen : st.le / 100;
        holder.position.copy(tipW).addScaledVector(dirW, len);
        if (drop) {
          const sl = st.swap ? st.swap.oldLe / 100 : 0;
          dropStub(sl, rr, tmp.copy(holder.position).addScaledVector(dirW, -sl), dirW);
        }
        const rodLen = st.le / 100;
        q.setFromUnitVectors(UP, dirW);
        elRod.visible = elCore.visible = rodLen > 0.05;
        elRod.quaternion.copy(q);
        elRod.scale.set(rr * 1.6, Math.max(0.01, rodLen - 0.25), rr * 1.6);
        elRod.position
          .copy(dirW)
          .multiplyScalar(0.005 + (rodLen - 0.25) / 2 - rodLen)
          .addScaledVector(xW, slide * 1.1);
        elCore.quaternion.copy(q);
        elCore.scale.set(rr, 0.3, rr);
        elCore.position
          .copy(dirW)
          .multiplyScalar(-0.12)
          .addScaledVector(xW, slide * 1.1);
        hJaw.quaternion.copy(q);
        hJaw.position.copy(dirW).multiplyScalar(-0.05);
        endW = tmp2.copy(holder.position).addScaledVector(dirW, 2.45);
      }
      const key = `${endW.x.toFixed(2)}|${endW.y.toFixed(2)}|${endW.z.toFixed(2)}`; // kábel podľa konca rukoväte
      if (key !== cableKey && t - cableT > 0.05) {
        // kábel sa prestavuje najviac 20× za s
        cableKey = key;
        cableT = t;
        // kábel ide cez prednú hranu stola a voľne visí k zváračke (neprechádza stolom)
        const edge = v3(clamp(endW.x * 0.6 + 1.6, -4.4, 4.6), TT + 0.1, 3.12),
          drop = v3(edge.x + 0.8, TT - 3.2, 3.9);
        // MIG: hadicové vedenie visí zo stola a stúpa k centrálnej prípojke podávača
        const pts = MIG
          ? [
              endW.clone().addScaledVector(dirW, 0.2),
              endW
                .clone()
                .addScaledVector(dirW, 0.9)
                .add(v3(0, -0.3, 0)),
              edge.clone().add(v3(0, 0.25, -0.3)),
              edge,
              v3(edge.x + 1.6, TT - 2.2, 4.2),
              sockW[0]
                .clone()
                .lerp(edge, 0.3)
                .add(v3(0, -1.4, 0.6)),
              sockW[0].clone().lerp(edge, 0.08),
              sockW[0],
            ]
          : [
              endW.clone().addScaledVector(dirW, 0.2),
              endW
                .clone()
                .addScaledVector(dirW, 0.9)
                .add(v3(0, -0.3, 0)),
              edge.clone().add(v3(0, 0.25, -0.3)),
              edge,
              drop,
              sockW[0].clone().add(v3(0, -0.5, 0.6)),
              sockW[0],
            ];
        const curve = new THREE.CatmullRomCurve3(pts.map((p) => holder.worldToLocal(p.clone())));
        hCable.geometry.dispose();
        hCable.geometry = new THREE.TubeGeometry(curve, 56, MIG ? 0.09 : 0.055, 8, false);
      }
    }
    const arcPos = locW(st.tx, surf + st.la * 0.5, st.tz, tmp);
    // kolísanie oblúka: nová hodnota ~11× za sekundu (nie v každom snímku), bez efektov stály jas
    flickT += dt;
    if (flickT > 0.09) {
      flickT = 0;
      flick = 0.85 + Math.random() * 0.3;
    }
    const fl = c.flashFx ? flick : 1;
    arcCore.visible = halo.visible = st.arc;
    arcCore.position.copy(arcPos);
    halo.position.copy(arcPos);
    halo.scale.setScalar(0.7 + 0.35 * fl);
    arcLight.position.copy(arcPos).addScaledVector(nW, 0.15);
    arcLight.intensity = st.arc ? 5 * fl * LIGHT_K : 0;
    jaw.rotation.z = c.ground ? 0 : 0.5;
    jaw.position.y = clampAt.y + (c.ground ? 0 : 0.25);
    if (brLever) brLever.rotation.x = c.tripped ? 0.8 : 0;
    if (fr) {
      fr.update(dt, { feed: st.arc ? c.vd : 0, flow: c.valve ? c.flow : 0, vd: c.vd, corr: c.corr });
      const sy = migSynergic({ wire: c.wire, vd: c.vd, prog: c.prog, gas: c.gas, corr: c.corr });
      fr.drawPanel({
        power: c.power,
        I: st.arc ? I : sy.I,
        U: sy.U,
        vd: c.vd,
        prog: c.prog,
        trig: c.trig,
        arc: st.arc,
      });
      fr.setGas(c.gas);
    }
    spatter.update(dt, () => -1);
    smoke.update(dt, () => 99);
    updateStubs(dt);

    // záblesk bez kukly a sklo kukly
    const fe = flashRef.current,
      ge = glassRef.current;
    if (fe) {
      // s efektmi: okamžitý záblesk s jemným kolísaním v svetlej oblasti; bez efektov plynulý nábeh na stály jas
      const prevOp = parseFloat(fe.style.opacity) || 0;
      const op =
        st.arc && !c.helmet
          ? c.flashFx
            ? 0.82 + 0.4 * (fl - 0.85)
            : Math.min(0.55, prevOp + dt * 2)
          : Math.max(0, prevOp - dt * 2.5);
      fe.style.opacity = op.toFixed(3);
      if (st.arc) {
        const v = arcPos.clone().project(camera);
        fe.style.setProperty('--fx', `${(((v.x + 1) / 2) * 100).toFixed(1)}%`);
        fe.style.setProperty('--fy', `${(((1 - v.y) / 2) * 100).toFixed(1)}%`);
      }
    }
    if (ge) {
      if (c.helmetType === 'old') {
        const want = st.arc;
        if (ge.classList.contains('arc') !== want) ge.classList.toggle('arc', want);
        ge.style.backdropFilter = '';
        ge.style.webkitBackdropFilter = '';
      } else {
        // samostmievací filter: svetlý bez oblúka, pri oblúku okamžite stmavne na zvolený stupeň, po zhasnutí sa po oneskorení zosvetlí
        const dark = st.arc || t - (st.arcOff || -9) < c.adfDelay;
        const b = { 9: 0.62, 10: 0.54, 11: 0.46, 12: 0.38, 13: 0.3 }[c.shade] || 0.46;
        const f = dark ? `brightness(${b}) contrast(1.35) saturate(.75)` : 'brightness(.9) saturate(.92)';
        if (ge.style.backdropFilter !== f) {
          ge.style.backdropFilter = f;
          ge.style.webkitBackdropFilter = f;
        }
      }
    }
    const needShade = I < 60 ? 9 : I <= 100 ? 10 : I <= 150 ? 11 : 12;
    sayOnce(
      'shade',
      st.arc && c.helmet && c.helmetType === 'auto' && c.shade < needShade,
      L(
        `Filter je príliš svetlý – pre ${I} A nastav aspoň DIN ${needShade}.`,
        `The filter is too light – for ${I} A set at least DIN ${needShade}.`,
      ),
      'warn',
    );
    sayOnce(
      'flash',
      st.arc && !c.helmet,
      L('Oslňujúci záblesk! Pri zváraní spusti kuklu (H).', 'Blinding flash! Lower the helmet when welding (H).'),
      'danger',
    );

    ctrl.update(dt);
    insp.update(t, c);

    if (t - statT > 0.5) {
      statT = t;
      stats = evalWeld();
    }
    if (t - teleT > 0.1) {
      teleT = t;
      setTele({
        arc: st.arc,
        I: st.arc ? Math.round(I) : 0,
        la: st.la,
        v: st.v,
        le: st.le,
        stuck: st.stuck,
        swap: !!st.swap,
        msg: st.msg && st.msg.until > t ? st.msg : null,
        stats,
        hot: F.hot,
        flashes: st.flashes,
        ...(MIG ? { U: st.arc ? syn.U : 0, mode: syn.mode, cover, wire: st.wire } : {}),
      });
      if (Object.keys(pend).length) {
        const p = { ...pend };
        Object.keys(pend).forEach((k) => delete pend[k]);
        setUi((u) => ({ ...u, ...p }));
      }
    }
    if (MIG) snd.update({ motor: st.arc ? 0.25 + c.vd / 30 : 0, arc: st.arc });
    else snd.update({ on: (c.mode === 'w380' || c.mode === 'w220') && !c.tripped, arc: st.arc });
    renderer.render(scene, camera);
  };

  // ---------- hodnotenie zvaru ----------
  const sectionAt = (frac) => {
    const S = F.S,
      n = S.path.length,
      p = S.path[clamp(Math.round(frac * (n - 1)), 0, n - 1)],
      span = S.wTop + 6,
      nx = -p.tz,
      nz = p.tx,
      cols = [];
    for (let u = -span; u <= span + 1e-9; u += RES) {
      const x = p.x + nx * (u + S.so),
        z = p.z + nz * (u + S.so),
        i = colOf(Math.round((x + F.L / 2) / RES)),
        j = Math.round((z + W2) / RES);
      if (i < 0 || j < 0 || j > NZ) {
        cols.push(null);
        continue;
      }
      const k = idxOf(i, j),
        passes = [];
      for (let q = 0; q < F.ln[k]; q++) passes.push({ id: F.lid[k * LAYS + q], th: F.lh[k * LAYS + q] });
      cols.push({
        u,
        h0: F.h0[k],
        h: F.h[k],
        dep: F.dep[k],
        fus: F.fus[k],
        heat: F.heat[k],
        por: F.por[k],
        inc: F.inc[k],
        passes,
      });
    }
    return {
      cols,
      span,
      t: F.t,
      ref: S.ref,
      gref: S.gref,
      fillet: S.fillet,
      groove: S.groove,
      type: F.type,
      frac,
      p,
    };
  };
  apiRef.current.section = (frac) => {
    const sec = sectionAt(frac);
    return { sec, m: sectionMetrics(sec) };
  };
  const evalWeld = () => {
    const b = evalBead(F.S, F),
      th = F.t;
    if (!b) return null;
    // počet vrstiev nad sebou: najmenší z troch rezov (štvrtina, polovica, tri štvrtiny dĺžky)
    const lay = [0.25, 0.5, 0.75]
      .map((f) => sectionMetrics(sectionAt(f)))
      .filter(Boolean)
      .map((m) => m.layers);
    return {
      ...b,
      layers: lay.length ? Math.min(...lay) : 0,
      inc: st.inc,
      spat: st.spat,
      cold: st.cold,
      longArc: st.longArc,
      fast: st.fast,
      sag: st.sag,
      wrongDir: st.wrongDir,
      por: st.por,
      rootRisk: (F.type === 'I' || F.S.sub === 'I') && th > 4,
      thinPrep: (F.type === 'V' || F.type === 'HV' || F.type === 'Y') && th < 4,
    };
  };

  try {
    if (/[?&]debug/.test(window.location.search))
      window.__weld = {
        F,
        st,
        evalWeld,
        W2,
        RES,
        jointZ,
        fr,
        camera,
        dom,
        aimAt: (cx, cy) => {
          aimAt(cx, cy);
          return { ...st.aim };
        },
        proj: (x, z) => {
          const r = dom.getBoundingClientRect(),
            v = locW(x, surfAt(x, z) == null ? F.t : surfAt(x, z), z, v3(0, 0, 0)).project(camera);
          return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
        },
      };
  } catch (err) {
    /* ignorované */
  }
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    snd.dispose();
    ctrl.dispose();
    insp.dispose();
    wi.dispose();
    dom.removeEventListener('pointerdown', pd, { capture: true });
    dom.removeEventListener('pointermove', pm, { capture: true });
    dom.removeEventListener('pointerup', pu, { capture: true });
    dom.removeEventListener('pointercancel', pu, { capture: true });
    dom.removeEventListener('wheel', wh, { capture: true });
    try {
      if (window.__weld && window.__weld.F === F) delete window.__weld;
    } catch (err) {
      /* ignorované */
    }
    disposeStage();
  };
}
