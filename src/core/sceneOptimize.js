// Zlučovanie statických sietí a obmedzenie vrhačov tieňa pre zložité modely strojov.
//
// Súrodenecké siete s rovnakým materiálom a nastavením sa zlúčia do jednej siete v tom istom rodičovi,
// takže pohyb rodiča (dvere, osi, stôl) sa prenáša ďalej. Pôvodné siete zostávajú v strome (pre
// výpočty polôh a export modelu stroja s pomenovanými dielmi), ale presunú sa do skrytej vrstvy –
// nekreslia sa ani nezasahujú do výberu myšou; zlúčená sieť sa naopak do exportu nezahrnie. Ak kód niektorú pôvodnú sieť neskôr pohne, skryje, vymení jej materiál alebo
// geometriu, zlúčenie celej skupiny sa pred ďalším vykreslením zruší a zostane zrušené (samooprava).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const HIDDEN_LAYER = 31;

const attrSig = (g) =>
  Object.keys(g.attributes)
    .sort()
    .map(
      (k) =>
        `${k}${g.attributes[k].itemSize}${g.attributes[k].array.constructor.name}${g.attributes[k].normalized ? 'n' : ''}`,
    )
    .join(',');

// userData len s jednoduchými hodnotami (odkazy na objekty môžu používať ovládače → takú sieť nezlučovať)
const userSig = (u) => {
  const e = Object.entries(u || {}).sort(([a], [b]) => (a < b ? -1 : 1));
  return e.every(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
    ? JSON.stringify(e)
    : null;
};
// materiál, userData a nastavenie siete musia byť v skupine rovnaké
const groupKey = (m) =>
  [
    m.material.uuid,
    m.castShadow,
    m.receiveShadow,
    m.renderOrder,
    m.frustumCulled,
    m.layers.mask,
    attrSig(m.geometry),
    m.geometry.index ? 'i' : 'n',
    userSig(m.userData),
  ].join('|');

// sieť sa dá zlúčiť: obyčajná viditeľná sieť bez potomkov, jeden nepriehľadný materiál, bez morfov
// (skupiny geometrie pri jednom materiáli nevadia – napr. BoxGeometry má 6 skupín)
const mergeable = (o) =>
  o.isMesh &&
  !o.isInstancedMesh &&
  !o.isSkinnedMesh &&
  o.visible &&
  !o.children.length &&
  !Array.isArray(o.material) &&
  o.material &&
  !o.material.transparent &&
  o.geometry?.attributes?.position &&
  !Object.keys(o.geometry.morphAttributes || {}).length &&
  !o.userData.noMerge &&
  !o.userData.mergedStatic &&
  !o.userData.mergedInto &&
  userSig(o.userData) !== null &&
  o.onBeforeRender === THREE.Object3D.prototype.onBeforeRender;

const snapshot = (o) => ({
  parent: o.parent,
  visible: o.visible,
  material: o.material,
  geometry: o.geometry,
  ver: o.geometry.attributes.position.version,
  p: o.position.clone(),
  q: o.quaternion.clone(),
  s: o.scale.clone(),
});
const changed = (o, s) =>
  o.parent !== s.parent ||
  o.visible !== s.visible ||
  o.material !== s.material ||
  o.geometry !== s.geometry ||
  o.geometry.attributes.position?.version !== s.ver ||
  !o.position.equals(s.p) ||
  !o.quaternion.equals(s.q) ||
  !o.scale.equals(s.s);

// geometria siete v súradniciach kotvy (matrix); pri zrkadlení (záporný determinant) sa otočí poradie vrcholov
function localGeometry(mesh, matrix) {
  const g = mesh.geometry.clone();
  g.clearGroups();
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) {
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i + 2 < a.length; i += 3) {
        const t = a[i + 1];
        a[i + 1] = a[i + 2];
        a[i + 2] = t;
      }
    } else
      for (const k of Object.keys(g.attributes)) {
        const at = g.attributes[k],
          n = at.itemSize;
        for (let i = 0; i + 2 < at.count; i += 3)
          for (let c = 0; c < n; c++) {
            const t = at.array[(i + 1) * n + c];
            at.array[(i + 1) * n + c] = at.array[(i + 2) * n + c];
            at.array[(i + 2) * n + c] = t;
          }
      }
  }
  return g;
}
// stav medziľahlej skupiny medzi sieťou a kotvou (poloha, viditeľnosť, rodič)
const nodeSnapshot = (o) => ({
  parent: o.parent,
  visible: o.visible,
  p: o.position.clone(),
  q: o.quaternion.clone(),
  s: o.scale.clone(),
});
const nodeChanged = (o, s) =>
  o.parent !== s.parent ||
  o.visible !== s.visible ||
  !o.position.equals(s.p) ||
  !o.quaternion.equals(s.q) ||
  !o.scale.equals(s.s);
// najbližší predok s userData.part – zlúčená sieť si ho nesie, aby výber a zvýraznenie častí fungovali
const partOf = (o) => {
  for (let p = o; p; p = p.parent) if (p.userData && p.userData.part) return p.userData.part;
  return '';
};

// tieň vrhajú len diely s polomerom obalovej gule aspoň minRadius (v jednotkách scény)
export function limitShadowCasters(root, minRadius) {
  root.updateMatrixWorld(true);
  const s = new THREE.Vector3();
  let off = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    if (o.geometry.boundingSphere.radius * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)) < minRadius) {
      o.castShadow = false;
      off++;
    }
  });
  return off;
}

// anchorOf(sieť) = predok, do ktorého sa zlúčená sieť vloží (predvolene rodič). Skupiny medzi sieťou a kotvou
// sa sledujú rovnako ako pôvodné siete – ak sa niektorá pohne alebo skryje, zlúčenie sa zruší.
export function mergeStaticMeshes(root, { minGroup = 2, anchorOf = (o) => o.parent, skip = null } = {}) {
  root.updateMatrixWorld(true);
  const anchors = new Map();
  root.traverse((o) => {
    if (!mergeable(o) || !o.parent || (skip && skip.has(o))) return;
    const anchor = anchorOf(o);
    if (!anchor) return;
    const chain = [];
    let p = o.parent;
    while (p && p !== anchor) {
      if (!p.visible) return;
      chain.push(p);
      p = p.parent;
    }
    if (p !== anchor) return;
    let byKey = anchors.get(anchor);
    if (!byKey) anchors.set(anchor, (byKey = new Map()));
    const k = `${groupKey(o)}|${partOf(o)}`,
      list = byKey.get(k) || [];
    list.push({ o, chain });
    byKey.set(k, list);
  });
  const groups = [];
  for (const [anchor, byKey] of anchors) {
    const inv = anchor.matrixWorld.clone().invert();
    for (const list of byKey.values()) {
      if (list.length < minGroup) continue;
      const geos = list.map(({ o }) => localGeometry(o, inv.clone().multiply(o.matrixWorld)));
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const first = list[0].o,
        mesh = new THREE.Mesh(merged, first.material);
      Object.assign(mesh, {
        castShadow: first.castShadow,
        receiveShadow: first.receiveShadow,
        renderOrder: first.renderOrder,
        frustumCulled: first.frustumCulled,
      });
      mesh.layers.mask = first.layers.mask;
      const part = partOf(first);
      mesh.userData = {
        ...first.userData,
        ...(part ? { part } : {}),
        mergedStatic: true,
        excludeFromMachineExport: true,
      };
      anchor.add(mesh);
      mesh.updateMatrixWorld(true);
      mesh.userData.mergedFrom = list.map(({ o }) => o); // pre ovládače: zásah do zlúčenej siete = zásah do pôvodnej
      const nodes = [...new Set(list.flatMap(({ chain }) => chain))].map((n) => ({ n, s: nodeSnapshot(n) }));
      const originals = list.map(({ o }) => {
        const rec = { o, s: snapshot(o), mask: o.layers.mask };
        o.layers.set(HIDDEN_LAYER);
        o.userData.mergedInto = mesh;
        return rec;
      });
      groups.push({ parent: anchor, mesh, originals, nodes, live: true });
    }
  }
  const unmerge = (gr) => {
    gr.live = false;
    gr.mesh.removeFromParent();
    gr.mesh.geometry.dispose();
    for (const r of gr.originals) {
      r.o.layers.mask = r.mask;
      delete r.o.userData.mergedInto;
    }
  };
  // zistí zmenené pôvodné siete a ich skupiny vráti do pôvodného stavu; vracia počet zrušených skupín.
  // Zmenené uzly a siete si zapamätá (drainChanges) – optimizeMachine z nich učí, čo sa hýbe.
  let movedNodes = new Set(),
    movedMeshes = new Set();
  const check = () => {
    let n = 0;
    for (const gr of groups) {
      if (!gr.live) continue;
      const meshes = gr.originals.filter((r) => changed(r.o, r.s)).map((r) => r.o),
        nodes = gr.nodes.filter((r) => nodeChanged(r.n, r.s)).map((r) => r.n);
      if (!meshes.length && !nodes.length) continue;
      meshes.forEach((m) => movedMeshes.add(m));
      nodes.forEach((m) => movedNodes.add(m));
      unmerge(gr);
      n++;
    }
    return n;
  };
  const drainChanges = () => {
    const out = { nodes: movedNodes, meshes: movedMeshes };
    movedNodes = new Set();
    movedMeshes = new Set();
    return out;
  };
  const stats = () => {
    const live = groups.filter((g) => g.live);
    return {
      groups: live.length,
      merged: live.reduce((a, g) => a + g.originals.length, 0),
      undone: groups.length - live.length,
    };
  };
  return { check, stats, groups, drainChanges };
}

// valce s počtom segmentov podľa skutočného obvodu (najdlhšia hrana maxEdge v jednotkách scény);
// malé skrutky a čapy nepotrebujú 64 – 96 segmentov
export function simplifyCylinders(root, maxEdge = 0.1) {
  root.updateMatrixWorld(true);
  const cache = new Map(),
    s = new THREE.Vector3();
  let saved = 0;
  root.traverse((o) => {
    const g = o.geometry;
    if (!o.isMesh || o.isInstancedMesh || g?.type !== 'CylinderGeometry') return;
    const p = g.parameters;
    o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    const r = Math.max(p.radiusTop, p.radiusBottom) * Math.max(Math.abs(s.x), Math.abs(s.z));
    const seg = Math.min(
      p.radialSegments,
      Math.max(8, Math.ceil((2 * Math.PI * r * p.thetaLength) / (2 * Math.PI) / maxEdge)),
    );
    if (seg >= p.radialSegments) return;
    const key = `${g.uuid}|${seg}`;
    if (!cache.has(key))
      cache.set(
        key,
        new THREE.CylinderGeometry(
          p.radiusTop,
          p.radiusBottom,
          p.height,
          seg,
          p.heightSegments,
          p.openEnded,
          p.thetaStart,
          p.thetaLength,
        ),
      );
    const before = g.index ? g.index.count : g.attributes.position.count,
      ng = cache.get(key);
    saved += (before - ng.index.count) / 3;
    o.geometry = ng;
  });
  return Math.round(saved);
}

// všetky objekty 3D, na ktoré odkazuje hodnota (vrátená stavba modelu, ovládače…) – môžu sa hýbať
export function collectObjects(value, out = new Set(), depth = 0, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value) || depth > 5) return out;
  seen.add(value);
  if (value.isObject3D) {
    out.add(value);
    return out;
  }
  if (Array.isArray(value)) value.forEach((v) => collectObjects(v, out, depth + 1, seen));
  else if (value instanceof Map) value.forEach((v) => collectObjects(v, out, depth + 1, seen));
  else if (Object.getPrototypeOf(value) === Object.prototype)
    for (const k of Object.keys(value)) {
      let v;
      try {
        v = value[k];
      } catch {
        continue;
      }
      collectObjects(v, out, depth + 1, seen);
    }
  return out;
}

// pre celý model stroja: obmedzí tiene, zjednoduší valce a zlúči statické siete. Zlučuje sa naprieč skupinami
// až po kotvu = skupinu časti (userData.part), pivot ovládača alebo uzol, o ktorom sa zistilo, že sa hýbe.
// Pred každým vykreslením sa skontrolujú zmeny: pohnutý uzol sa stane kotvou, pohnutá sieť sa už nezlučuje
// a dotknuté siete sa o chvíľu zlúčia znova (učenie počas behu – stačí niekoľko pohybov osí a dverí).
// refs: siete, na ktoré kód odkazuje (stavba modelu…), sa nezlučujú – kód ich pravdepodobne mení.
export function optimizeMachine({ root, scene, renderer, shadowMin = 0.25, refs = null, controls = null }) {
  // ?noopt vypne optimalizáciu (porovnanie vzhľadu a výkonu)
  const off = (() => {
    try {
      return /[?&]noopt\b/.test(window.location.search);
    } catch {
      return false;
    }
  })();
  if (off)
    return {
      stats: () => ({ groups: 0, merged: 0, undone: 0, learned: 0, off: true }),
      passes: [],
      shadowsOff: 0,
      trianglesSaved: 0,
    };
  const trianglesSaved = simplifyCylinders(root);
  const shadowsOff = limitShadowCasters(root, shadowMin);
  const dynamic = new Set([root]),
    skip = new Set();
  if (controls) controls.entries().forEach((k) => dynamic.add(k.pivot));
  if (refs) collectObjects(refs).forEach((o) => o.isMesh && skip.add(o));
  const anchorOf = (o) => {
    let p = o.parent;
    while (p && p !== root && !dynamic.has(p) && !(p.userData && p.userData.part)) p = p.parent;
    return p || root;
  };
  const passes = [mergeStaticMeshes(root, { anchorOf, skip })];
  let pending = false,
    last = 0;
  const inner = renderer.render;
  renderer.render = (sc, cam) => {
    if (sc === scene) {
      for (const pass of passes) {
        pass.check();
        const ch = pass.drainChanges();
        ch.nodes.forEach((n) => dynamic.add(n));
        ch.meshes.forEach((m) => skip.add(m));
        if (ch.nodes.size || ch.meshes.size) pending = true;
      }
      const now = performance.now();
      if (pending && now - last > 400) {
        pending = false;
        last = now;
        passes.push(mergeStaticMeshes(root, { anchorOf, skip }));
      }
    }
    inner(sc, cam);
  };
  const stats = () => {
    const all = passes.map((p) => p.stats());
    return {
      groups: all.reduce((a, x) => a + x.groups, 0),
      merged: all.reduce((a, x) => a + x.merged, 0),
      undone: all.reduce((a, x) => a + x.undone, 0),
      learned: dynamic.size - 1,
    };
  };
  return { stats, passes, shadowsOff, trianglesSaved };
}
