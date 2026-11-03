// Výšková mapa obrobku pre frézu a brúsku.
import * as THREE from 'three';
import { clamp } from './util';

// ---------- výšková mapa obrobku: horná plocha + bočné steny, obrobené miesta sú svetlé ----------
function createHeightField({ NX, NZ, W, D, H, raw, cut, mat, init, base = 0 }) {
  const VN = (NX + 1) * (NZ + 1), dX = W / NX, dZ = D / NZ;
  const hgt = new Float32Array(VN).fill(H), mask = new Uint8Array(VN);
  const fill0 = () => { if (!init) { hgt.fill(H); return; } for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) hgt[j * (NX + 1) + i] = init(-W / 2 + i * dX, -D / 2 + j * dZ); };
  fill0();
  // dva okrajové prstence: vonkajší (spodok bočnej steny) a vnútorný (horná hrana steny) – stena má vlastné vrcholy,
  // takže farba obrobenej plochy sa neprelieva na boky
  const GX = NX + 5, GZ = NZ + 5, pos = new Float32Array(GX * GZ * 3), col = new Float32Array(GX * GZ * 3), idx = [];
  for (let j = 0; j < GZ - 1; j++) for (let i = 0; i < GX - 1; i++) { const a = j * GX + i, d = a + GX; idx.push(a, d, a + 1, a + 1, d, d + 1); }
  { const c0 = 0, c1 = GX - 1, c2 = (GZ - 1) * GX, c3 = GZ * GX - 1; idx.push(c0, c1, c2, c1, c3, c2); }   // spodná plocha – plný kváder
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  const RAW = new THREE.Color(raw).convertSRGBToLinear(), CUT = new THREE.Color(cut).convertSRGBToLinear();
  // zmenená oblasť v uzloch [i0, i1, j0, j1] – po reze sa prestavuje len ona
  let dirty = null;
  const C0 = 0, C1 = GX - 1, C2 = (GZ - 1) * GX, C3 = GZ * GX - 1;
  const writeVerts = (iiA, iiB, jjA, jjB) => {
    for (let jj = jjA; jj <= jjB; jj++) for (let ii = iiA; ii <= iiB; ii++) {
      const i = clamp(ii - 2, 0, NX), j = clamp(jj - 2, 0, NZ), ring = ii === 0 || jj === 0 || ii === GX - 1 || jj === GZ - 1;
      const edge = ii === 1 || jj === 1 || ii === GX - 2 || jj === GZ - 2;
      const k = jj * GX + ii, vi = j * (NX + 1) + i, c3 = !ring && !edge && mask[vi] ? CUT : RAW;
      pos[k * 3] = -W / 2 + i * dX; pos[k * 3 + 1] = ring ? base : hgt[vi]; pos[k * 3 + 2] = -D / 2 + j * dZ;
      col[k * 3] = c3.r; col[k * 3 + 1] = c3.g; col[k * 3 + 2] = c3.b;
    }
  };
  // normála vrcholu = súčet (nenormovaných) normál priľahlých trojuholníkov – rovnako ako computeVertexNormals
  const nrm = new Float32Array(3);
  const addFace = (a, b, c) => {
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2], bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
    const cbx = pos[c * 3] - bx, cby = pos[c * 3 + 1] - by, cbz = pos[c * 3 + 2] - bz, abx = ax - bx, aby = ay - by, abz = az - bz;
    nrm[0] += cby * abz - cbz * aby; nrm[1] += cbz * abx - cbx * abz; nrm[2] += cbx * aby - cby * abx;
  };
  const writeNormals = (iiA, iiB, jjA, jjB) => {
    const na = geo.attributes.normal.array;
    for (let jj = jjA; jj <= jjB; jj++) for (let ii = iiA; ii <= iiB; ii++) {
      const v = jj * GX + ii; nrm[0] = nrm[1] = nrm[2] = 0;
      for (let qj = Math.max(0, jj - 1); qj <= Math.min(GZ - 2, jj); qj++) for (let qi = Math.max(0, ii - 1); qi <= Math.min(GX - 2, ii); qi++) {
        const a = qj * GX + qi, d = a + GX;
        if (v === a || v === d || v === a + 1) addFace(a, d, a + 1);
        if (v === a + 1 || v === d || v === d + 1) addFace(a + 1, d, d + 1);
      }
      if (v === C0 || v === C1 || v === C2) addFace(C0, C1, C2);          // spodná plocha
      if (v === C1 || v === C3 || v === C2) addFace(C1, C3, C2);
      const l = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
      na[v * 3] = nrm[0] / l; na[v * 3 + 1] = nrm[1] / l; na[v * 3 + 2] = nrm[2] / l;
    }
  };
  // ak sa údaje ešte nenahrali do GPU, nový rozsah sa zlúči s predchádzajúcim
  const setRange = (attr, off, cnt) => {
    const r = attr.updateRange;
    if (r.count !== -1) { const e = Math.max(r.offset + r.count, off + cnt); r.offset = Math.min(r.offset, off); r.count = e - r.offset; }
    else { r.offset = off; r.count = cnt; }
    attr.needsUpdate = true;
  };
  const rebuild = (full = false) => {
    const normal = geo.attributes.normal;
    if (full || !dirty || !normal) {
      writeVerts(0, GX - 1, 0, GZ - 1); dirty = null;
      ['position', 'color'].forEach((n) => { geo.attributes[n].updateRange.count = -1; geo.attributes[n].needsUpdate = true; });
      if (normal) normal.updateRange.count = -1;
      geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox();
      return;
    }
    const [i0, i1, j0, j1] = dirty; dirty = null;
    const iiA = i0 === 0 ? 0 : i0 + 2, iiB = i1 === NX ? GX - 1 : i1 + 2, jjA = j0 === 0 ? 0 : j0 + 2, jjB = j1 === NZ ? GZ - 1 : j1 + 2;
    writeVerts(iiA, iiB, jjA, jjB);
    const nA = Math.max(0, jjA - 1), nB = Math.min(GZ - 1, jjB + 1);
    writeNormals(Math.max(0, iiA - 1), Math.min(GX - 1, iiB + 1), nA, nB);
    setRange(geo.attributes.position, jjA * GX * 3, (jjB - jjA + 1) * GX * 3);
    setRange(geo.attributes.color, jjA * GX * 3, (jjB - jjA + 1) * GX * 3);
    setRange(normal, nA * GX * 3, (nB - nA + 1) * GX * 3);
    // spodná plocha sa nemení – jej rohy ležia na vonkajšom prstenci, ktorý má stálu výšku (base)
  };
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  // uzly v obdĺžniku [x0, x1] × [z0, z1] v súradniciach obrobku (stred = 0)
  const eachRect = (x0, x1, z0, z1, fn) => {
    // tolerancia 1e-9: uzol presne na hrane obdĺžnika nesmie vypadnúť kvôli zaokrúhleniu
    const i0 = Math.max(0, Math.ceil((x0 + W / 2) / dX - 1e-9)), i1 = Math.min(NX, Math.floor((x1 + W / 2) / dX + 1e-9));
    const j0 = Math.max(0, Math.ceil((z0 + D / 2) / dZ - 1e-9)), j1 = Math.min(NZ, Math.floor((z1 + D / 2) / dZ + 1e-9));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * (NX + 1) + i, -W / 2 + i * dX, -D / 2 + j * dZ);
  };
  // ako eachRect, ale oblasť sa zapamätá na prestavbu – používa sa pri reze (zápis do hgt / mask)
  const cutRect = (x0, x1, z0, z1, fn) => {
    const i0 = Math.max(0, Math.ceil((x0 + W / 2) / dX - 1e-9)), i1 = Math.min(NX, Math.floor((x1 + W / 2) / dX + 1e-9));
    const j0 = Math.max(0, Math.ceil((z0 + D / 2) / dZ - 1e-9)), j1 = Math.min(NZ, Math.floor((z1 + D / 2) / dZ + 1e-9));
    if (i0 > i1 || j0 > j1) return;
    if (!dirty) dirty = [i0, i1, j0, j1];
    else { dirty[0] = Math.min(dirty[0], i0); dirty[1] = Math.max(dirty[1], i1); dirty[2] = Math.min(dirty[2], j0); dirty[3] = Math.max(dirty[3], j1); }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * (NX + 1) + i, -W / 2 + i * dX, -D / 2 + j * dZ);
  };
  const reset = () => { fill0(); mask.fill(0); rebuild(true); };
  const dispose = () => geo.dispose();
  rebuild(true);
  return { hgt, mask, mesh, rebuild, reset, eachRect, cutRect, dispose, W, D, H, NX, NZ };
}

export { createHeightField };
