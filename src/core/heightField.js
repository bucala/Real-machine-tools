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
  const rebuild = () => {
    for (let jj = 0; jj < GZ; jj++) for (let ii = 0; ii < GX; ii++) {
      const i = clamp(ii - 2, 0, NX), j = clamp(jj - 2, 0, NZ), ring = ii === 0 || jj === 0 || ii === GX - 1 || jj === GZ - 1;
      const edge = ii === 1 || jj === 1 || ii === GX - 2 || jj === GZ - 2;
      const k = jj * GX + ii, vi = j * (NX + 1) + i, c3 = !ring && !edge && mask[vi] ? CUT : RAW;
      pos[k * 3] = -W / 2 + i * dX; pos[k * 3 + 1] = ring ? base : hgt[vi]; pos[k * 3 + 2] = -D / 2 + j * dZ;
      col[k * 3] = c3.r; col[k * 3 + 1] = c3.g; col[k * 3 + 2] = c3.b;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox();
  };
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  // uzly v obdĺžniku [x0, x1] × [z0, z1] v súradniciach obrobku (stred = 0)
  const eachRect = (x0, x1, z0, z1, fn) => {
    // tolerancia 1e-9: uzol presne na hrane obdĺžnika nesmie vypadnúť kvôli zaokrúhleniu
    const i0 = Math.max(0, Math.ceil((x0 + W / 2) / dX - 1e-9)), i1 = Math.min(NX, Math.floor((x1 + W / 2) / dX + 1e-9));
    const j0 = Math.max(0, Math.ceil((z0 + D / 2) / dZ - 1e-9)), j1 = Math.min(NZ, Math.floor((z1 + D / 2) / dZ + 1e-9));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * (NX + 1) + i, -W / 2 + i * dX, -D / 2 + j * dZ);
  };
  const reset = () => { fill0(); mask.fill(0); rebuild(); };
  const dispose = () => geo.dispose();
  rebuild();
  return { hgt, mask, mesh, rebuild, reset, eachRect, dispose, W, D, H };
}

export { createHeightField };
