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

const attrSig = (g) => Object.keys(g.attributes).sort().map((k) => `${k}${g.attributes[k].itemSize}${g.attributes[k].array.constructor.name}${g.attributes[k].normalized ? 'n' : ''}`).join(',');

// userData len s jednoduchými hodnotami (odkazy na objekty môžu používať ovládače → takú sieť nezlučovať)
const userSig = (u) => {
  const e = Object.entries(u || {}).sort(([a], [b]) => (a < b ? -1 : 1));
  return e.every(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v)) ? JSON.stringify(e) : null;
};
// materiál, userData a nastavenie siete musia byť v skupine rovnaké
const groupKey = (m) => [
  m.material.uuid, m.castShadow, m.receiveShadow, m.renderOrder, m.frustumCulled, m.layers.mask,
  attrSig(m.geometry), m.geometry.index ? 'i' : 'n', userSig(m.userData),
].join('|');

// sieť sa dá zlúčiť: obyčajná viditeľná sieť bez potomkov, jeden nepriehľadný materiál, bez morfov
// (skupiny geometrie pri jednom materiáli nevadia – napr. BoxGeometry má 6 skupín)
const mergeable = (o) => o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible && !o.children.length
  && !Array.isArray(o.material) && o.material && !o.material.transparent
  && o.geometry?.attributes?.position && !Object.keys(o.geometry.morphAttributes || {}).length
  && !o.userData.noMerge && !o.userData.mergedStatic && userSig(o.userData) !== null && o.onBeforeRender === THREE.Object3D.prototype.onBeforeRender;

const snapshot = (o) => ({
  parent: o.parent, visible: o.visible, material: o.material, geometry: o.geometry,
  ver: o.geometry.attributes.position.version, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(),
});
const changed = (o, s) => o.parent !== s.parent || o.visible !== s.visible || o.material !== s.material || o.geometry !== s.geometry
  || o.geometry.attributes.position?.version !== s.ver || !o.position.equals(s.p) || !o.quaternion.equals(s.q) || !o.scale.equals(s.s);

// geometria siete v súradniciach rodiča; pri zrkadlení (záporný determinant) sa otočí poradie vrcholov
function localGeometry(mesh) {
  mesh.updateMatrix();
  const g = mesh.geometry.clone();
  g.clearGroups();
  g.applyMatrix4(mesh.matrix);
  if (mesh.matrix.determinant() < 0) {
    if (g.index) { const a = g.index.array; for (let i = 0; i + 2 < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
    else for (const k of Object.keys(g.attributes)) {
      const at = g.attributes[k], n = at.itemSize;
      for (let i = 0; i + 2 < at.count; i += 3) for (let c = 0; c < n; c++) { const t = at.array[(i + 1) * n + c]; at.array[(i + 1) * n + c] = at.array[(i + 2) * n + c]; at.array[(i + 2) * n + c] = t; }
    }
  }
  return g;
}

// tieň vrhajú len diely s polomerom obalovej gule aspoň minRadius (v jednotkách scény)
export function limitShadowCasters(root, minRadius) {
  root.updateMatrixWorld(true);
  const s = new THREE.Vector3();
  let off = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    if (o.geometry.boundingSphere.radius * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)) < minRadius) { o.castShadow = false; off++; }
  });
  return off;
}

export function mergeStaticMeshes(root, { minGroup = 2 } = {}) {
  const parents = new Map();
  root.traverse((o) => {
    if (!mergeable(o) || !o.parent) return;
    let byKey = parents.get(o.parent); if (!byKey) parents.set(o.parent, (byKey = new Map()));
    const k = groupKey(o), list = byKey.get(k) || []; list.push(o); byKey.set(k, list);
  });
  const groups = [];
  for (const [parent, byKey] of parents) for (const list of byKey.values()) {
    if (list.length < minGroup) continue;
    const geos = list.map(localGeometry);
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    const first = list[0], mesh = new THREE.Mesh(merged, first.material);
    Object.assign(mesh, { castShadow: first.castShadow, receiveShadow: first.receiveShadow, renderOrder: first.renderOrder, frustumCulled: first.frustumCulled });
    mesh.layers.mask = first.layers.mask; mesh.userData = { ...first.userData, mergedStatic: true, excludeFromMachineExport: true };
    parent.add(mesh);
    mesh.userData.mergedFrom = list;                    // pre ovládače: zásah do zlúčenej siete = zásah do pôvodnej
    const originals = list.map((o) => {
      const rec = { o, s: snapshot(o), mask: o.layers.mask };
      o.layers.set(HIDDEN_LAYER); o.userData.mergedInto = mesh;
      return rec;
    });
    groups.push({ parent, mesh, originals, live: true });
  }
  const unmerge = (gr) => {
    gr.live = false;
    gr.mesh.removeFromParent(); gr.mesh.geometry.dispose();
    for (const r of gr.originals) { r.o.layers.mask = r.mask; delete r.o.userData.mergedInto; }
  };
  // zistí zmenené pôvodné siete a ich skupiny vráti do pôvodného stavu; vracia počet zrušených skupín
  const check = () => {
    let n = 0;
    for (const gr of groups) if (gr.live && gr.originals.some((r) => changed(r.o, r.s))) { unmerge(gr); n++; }
    return n;
  };
  const stats = () => {
    const live = groups.filter((g) => g.live);
    return { groups: live.length, merged: live.reduce((a, g) => a + g.originals.length, 0), undone: groups.length - live.length };
  };
  return { check, stats, groups };
}

// valce s počtom segmentov podľa skutočného obvodu (najdlhšia hrana maxEdge v jednotkách scény);
// malé skrutky a čapy nepotrebujú 64 – 96 segmentov
export function simplifyCylinders(root, maxEdge = 0.1) {
  root.updateMatrixWorld(true);
  const cache = new Map(), s = new THREE.Vector3();
  let saved = 0;
  root.traverse((o) => {
    const g = o.geometry;
    if (!o.isMesh || o.isInstancedMesh || g?.type !== 'CylinderGeometry') return;
    const p = g.parameters;
    o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    const r = Math.max(p.radiusTop, p.radiusBottom) * Math.max(Math.abs(s.x), Math.abs(s.z));
    const seg = Math.min(p.radialSegments, Math.max(8, Math.ceil((2 * Math.PI * r * p.thetaLength) / (2 * Math.PI) / maxEdge)));
    if (seg >= p.radialSegments) return;
    const key = `${g.uuid}|${seg}`;
    if (!cache.has(key)) cache.set(key, new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, seg, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength));
    const before = g.index ? g.index.count : g.attributes.position.count, ng = cache.get(key);
    saved += (before - ng.index.count) / 3;
    o.geometry = ng;
  });
  return Math.round(saved);
}

// pre celý model stroja: obmedzí tiene, zjednoduší valce, zlúči statické siete a pred každým vykreslením
// scény skontroluje zmeny
export function optimizeMachine({ root, scene, renderer, shadowMin = 0.25 }) {
  const trianglesSaved = simplifyCylinders(root);
  const shadowsOff = limitShadowCasters(root, shadowMin);
  const opt = mergeStaticMeshes(root);
  const inner = renderer.render;
  renderer.render = (s, c) => { if (s === scene) opt.check(); inner(s, c); };
  return { ...opt, shadowsOff, trianglesSaved };
}
