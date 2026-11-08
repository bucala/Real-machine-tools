// Polotovar ako voxelové pole so znamienkovou vzdialenosťou (kladná v materiáli) v ráme stola (mm).
// Úber: f = min(f, d_nástroja) – rotačný nástroj ľubovoľne natočený (plochý, toroidný, guľový, kužeľový hrot),
// takže funguje aj 5-osé obrábanie s podrezaniami. Povrch sa skladá metódou surface nets po blokoch 16³,
// obnovujú sa len zmenené bloky. Bez three.js – testované v tests/cnc.test.js.
export const CH = 16;
export function createStock({ min, max, res }) {
  const pad = 2, nx = Math.ceil((max[0] - min[0]) / res) + 2 * pad + 1, ny = Math.ceil((max[1] - min[1]) / res) + 2 * pad + 1, nz = Math.ceil((max[2] - min[2]) / res) + 2 * pad + 1;
  const o = [min[0] - pad * res, min[1] - pad * res, min[2] - pad * res], q = res / 32;     // q = mm na jednotku hodnoty
  const f = new Int8Array(nx * ny * nz);
  const cx = Math.ceil(nx / CH), cy = Math.ceil(ny / CH), cz = Math.ceil(nz / CH);
  const dirty = new Uint8Array(cx * cy * cz).fill(1);
  const boxSdf = (x, y, z) => {                 // kladná vnútri polotovaru
    const dx = Math.min(x - min[0], max[0] - x), dy = Math.min(y - min[1], max[1] - y), dz = Math.min(z - min[2], max[2] - z);
    if (dx >= 0 && dy >= 0 && dz >= 0) return Math.min(dx, dy, dz);
    const ox = Math.max(0, -dx), oy = Math.max(0, -dy), oz = Math.max(0, -dz);
    return -Math.hypot(ox, oy, oz);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = boxSdf(o[0] + i * res, o[1] + j * res, o[2] + k * res) / q;
    f[i + nx * (j + ny * k)] = v > 127 ? 127 : v < -127 ? -127 : Math.round(v);
  }
  const vox = res * res * res;
  let removed = 0;
  // nástroj: tip (špička), v (jednotková os smerom k vretenu), t = { kind, d, cr, tip, lc }
  const toolDist = (t) => {
    const R = t.d / 2, cr = Math.min(t.cr || 0, R), lc = t.lc;
    if (t.kind === 'cone') {
      const h = (t.tip || 118) * Math.PI / 360, ch = Math.cos(h), sh = Math.sin(h);
      return (z, r) => Math.max(r * ch - z * sh, r - R, z - lc);
    }
    return (z, r) => {
      let d;
      if (z < cr) { const rr = Math.max(r - (R - cr), 0), dz = z - cr; d = Math.sqrt(rr * rr + dz * dz) - cr; }
      else d = Math.max(r - R, -z);                // vnútri: aj vzdialenosť k čelu – presná hĺbka dna (nie o pol voxelu hlbšie)
      return d > z - lc ? d : z - lc;
    };
  };
  // pre každý voxel v obale nástroja: callback(index, vzdialenosť) – spoločné pre úber aj kontrolu kolízie
  const scan = (tip, v, R, z0, z1, fn) => {
    const e0 = [tip[0] + v[0] * z0, tip[1] + v[1] * z0, tip[2] + v[2] * z0], e1 = [tip[0] + v[0] * z1, tip[1] + v[1] * z1, tip[2] + v[2] * z1];
    const ext = (a) => R * Math.sqrt(Math.max(0, 1 - a * a)) + res;
    const lo = [0, 1, 2].map((a) => Math.min(e0[a], e1[a]) - ext(v[a])), hi = [0, 1, 2].map((a) => Math.max(e0[a], e1[a]) + ext(v[a]));
    const i0 = Math.max(0, Math.floor((lo[0] - o[0]) / res)), i1 = Math.min(nx - 1, Math.ceil((hi[0] - o[0]) / res));
    const j0 = Math.max(0, Math.floor((lo[1] - o[1]) / res)), j1 = Math.min(ny - 1, Math.ceil((hi[1] - o[1]) / res));
    const k0 = Math.max(0, Math.floor((lo[2] - o[2]) / res)), k1 = Math.min(nz - 1, Math.ceil((hi[2] - o[2]) / res));
    if (i0 > i1 || j0 > j1 || k0 > k1) return 0;
    let ops = 0;
    for (let k = k0; k <= k1; k++) {
      const pz = o[2] + k * res - tip[2];
      for (let j = j0; j <= j1; j++) {
        const py = o[1] + j * res - tip[1], base = nx * (j + ny * k);
        for (let i = i0; i <= i1; i++) {
          const px = o[0] + i * res - tip[0], z = px * v[0] + py * v[1] + pz * v[2];
          if (z < z0 - res || z > z1 + res) continue;
          const r2 = px * px + py * py + pz * pz - z * z, r = r2 > 0 ? Math.sqrt(r2) : 0;
          if (r > R + res) continue;
          ops++; fn(base + i, z, r);
        }
      }
    }
    return { ops, i0, i1, j0, j1, k0, k1 };
  };
  const markDirty = (b) => {
    if (!b) return;
    for (let k = Math.max(0, Math.floor((b.k0 - 1) / CH)); k <= Math.min(cz - 1, Math.floor((b.k1 + 1) / CH)); k++)
      for (let j = Math.max(0, Math.floor((b.j0 - 1) / CH)); j <= Math.min(cy - 1, Math.floor((b.j1 + 1) / CH)); j++)
        for (let i = Math.max(0, Math.floor((b.i0 - 1) / CH)); i <= Math.min(cx - 1, Math.floor((b.i1 + 1) / CH)); i++) dirty[i + cx * (j + cy * k)] = 1;
  };
  // odobratie materiálu nástrojom; vráti počet odobratých voxelov a výpočtovú prácu
  const cut = (tip, v, t) => {
    const dist = toolDist(t);
    let n = 0;
    const b = scan(tip, v, t.d / 2, 0, t.lc, (idx, z, r) => {
      const val = dist(z, r) / q, cur = f[idx];
      if (val < cur) { const next=val < -127 ? -127 : Math.round(val); if (cur > 0 && next <= 0) n++; f[idx] = next; }
    });
    if (n) { markDirty(b); removed += n; }
    return { n, ops: b ? b.ops : 0 };
  };
  // Non-rotating prismatic electrode, used by sinker EDM. Same SDF and dirty-chunk
  // pipeline as milling; the electrode face subtracts material without a spindle.
  const cutBox = (lo, hi) => {
    const low=lo.map((v,a)=>Math.max(0,Math.floor((v-res-o[a])/res)));
    const high=hi.map((v,a)=>Math.min([nx,ny,nz][a]-1,Math.ceil((v+res-o[a])/res)));
    let n=0,ops=0;
    for(let k=low[2];k<=high[2];k++)for(let j=low[1];j<=high[1];j++)for(let i=low[0];i<=high[0];i++){
      const p=[o[0]+i*res,o[1]+j*res,o[2]+k*res];
      const d=p.map((v,a)=>Math.max(lo[a]-v,v-hi[a]));
      const sdf=Math.hypot(...d.map(v=>Math.max(0,v)))+Math.min(0,Math.max(...d));
      const idx=i+nx*(j+ny*k),val=sdf/q,cur=f[idx];ops++;
      if(val<cur){const next=Math.max(-127,Math.round(val));if(cur>0&&next<=0)n++;f[idx]=next;}
    }
    // Surface can change before a sample changes sign; retain sub-voxel face updates.
    markDirty({i0:low[0],i1:high[0],j0:low[1],j1:high[1],k0:low[2],k1:high[2]});removed+=n;
    return {n,ops};
  };
  // kolízia driekom alebo držiakom: počet voxelov materiálu (s rezervou) v danom valci
  const hits = (tip, v, R, z0, z1) => {
    let n = 0;
    scan(tip, v, R, z0, z1, (idx, z, r) => { if (z >= z0 && z <= z1 && r <= R && f[idx] > 16) n++; });
    return n;
  };
  // ---------------- surface nets ----------------
  const at = (i, j, k) => f[i + nx * (j + ny * k)];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const meshChunk = (ci, cj, ck) => {
    const x0 = ci * CH, y0 = cj * CH, z0 = ck * CH, S = CH + 1;
    const vidx = new Int32Array(S * S * S).fill(-1), pos = [], nor = [], raw = [], idx = [];
    const vert = (i, j, k) => {                 // vrchol bunky s minimálnym rohom (i, j, k)
      if (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1) return -1;
      const li = i - x0 + 1, lj = j - y0 + 1, lk = k - z0 + 1;
      if (li < 0 || lj < 0 || lk < 0 || li >= S || lj >= S || lk >= S) return -1;
      const key = li + S * (lj + S * lk);
      if (vidx[key] !== -1) return vidx[key];
      const c = [at(i, j, k), at(i + 1, j, k), at(i, j + 1, k), at(i + 1, j + 1, k), at(i, j, k + 1), at(i + 1, j, k + 1), at(i, j + 1, k + 1), at(i + 1, j + 1, k + 1)];
      let sx = 0, sy = 0, sz = 0, m = 0;
      for (const [a, b] of EDGES) {
        if ((c[a] > 0) === (c[b] > 0)) continue;
        const t = c[a] / (c[a] - c[b]);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t; m++;
      }
      if (!m) { vidx[key] = -2; return -1; }
      const px = o[0] + (i + sx / m) * res, py = o[1] + (j + sy / m) * res, pz = o[2] + (k + sz / m) * res;
      const gx = (c[1] + c[3] + c[5] + c[7]) - (c[0] + c[2] + c[4] + c[6]), gy = (c[2] + c[3] + c[6] + c[7]) - (c[0] + c[1] + c[4] + c[5]), gz = (c[4] + c[5] + c[6] + c[7]) - (c[0] + c[1] + c[2] + c[3]);
      const gl = Math.hypot(gx, gy, gz) || 1;
      const id = pos.length / 3; pos.push(px, py, pz); nor.push(-gx / gl, -gy / gl, -gz / gl);
      raw.push(Math.abs(boxSdf(px, py, pz)) < res * 0.55 ? 1 : 0);
      vidx[key] = id; return id;
    };
    const quad = (a, b, c2, d, flip) => { if (a < 0 || b < 0 || c2 < 0 || d < 0) return; if (flip) idx.push(a, c2, b, a, d, c2); else idx.push(a, b, c2, a, c2, d); };
    for (let k = z0; k < Math.min(z0 + CH, nz - 1); k++) for (let j = y0; j < Math.min(y0 + CH, ny - 1); j++) for (let i = x0; i < Math.min(x0 + CH, nx - 1); i++) {
      const v0 = at(i, j, k) > 0;
      if (j > 0 && k > 0 && v0 !== (at(i + 1, j, k) > 0)) quad(vert(i, j - 1, k - 1), vert(i, j, k - 1), vert(i, j, k), vert(i, j - 1, k), !v0);
      if (i > 0 && k > 0 && v0 !== (at(i, j + 1, k) > 0)) quad(vert(i - 1, j, k - 1), vert(i - 1, j, k), vert(i, j, k), vert(i, j, k - 1), !v0);
      if (i > 0 && j > 0 && v0 !== (at(i, j, k + 1) > 0)) quad(vert(i - 1, j - 1, k), vert(i, j - 1, k), vert(i, j, k), vert(i - 1, j, k), !v0);
    }
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), raw: new Uint8Array(raw), idx: new Uint32Array(idx) };
  };
  const takeDirty = (limit = Infinity, prio = null) => {
    const out = [];
    const list = [];
    for (let i = 0; i < dirty.length; i++) if (dirty[i]) list.push(i);
    if (prio) { const pc = [Math.floor((prio[0] - o[0]) / res / CH), Math.floor((prio[1] - o[1]) / res / CH), Math.floor((prio[2] - o[2]) / res / CH)]; const dd = (id) => { const i = id % cx, j = Math.floor(id / cx) % cy, k = Math.floor(id / (cx * cy)); return Math.abs(i - pc[0]) + Math.abs(j - pc[1]) + Math.abs(k - pc[2]); }; list.sort((a, b) => dd(a) - dd(b)); }
    for (const id of list.slice(0, limit)) { dirty[id] = 0; out.push({ id, ...meshChunk(id % cx, Math.floor(id / cx) % cy, Math.floor(id / (cx * cy))) }); }
    return out;
  };
  const volume = () => { let n = 0; for (let i = 0; i < f.length; i++) if (f[i] > 0) n++; return n * vox; };
  const inside = (p) => {                     // je bod v materiáli?
    const i = Math.round((p[0] - o[0]) / res), j = Math.round((p[1] - o[1]) / res), k = Math.round((p[2] - o[2]) / res);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return false;
    return f[i + nx * (j + ny * k)] > 0;
  };
  // znamienková vzdialenosť v mm (kladná v materiáli) s trilineárnou interpoláciou – na meranie obrobku
  const sdfAt = (p) => {
    const gx = (p[0] - o[0]) / res, gy = (p[1] - o[1]) / res, gz = (p[2] - o[2]) / res;
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz);
    if (i < 0 || j < 0 || k < 0 || i >= nx - 1 || j >= ny - 1 || k >= nz - 1) return -4 * res;
    const fx = gx - i, fy = gy - j, fz = gz - k, at = (a, b, c) => f[i + a + nx * (j + b + ny * (k + c))];
    const l = (a, b, t) => a + (b - a) * t;
    const v = l(l(l(at(0, 0, 0), at(1, 0, 0), fx), l(at(0, 1, 0), at(1, 1, 0), fx), fy), l(l(at(0, 0, 1), at(1, 0, 1), fx), l(at(0, 1, 1), at(1, 1, 1), fx), fy), fz);
    return v * q;
  };
  return { cut, cutBox, hits, takeDirty, volume, inside, sdfAt, removed: () => removed * vox, vox, res, min, max, dims: [nx, ny, nz], chunks: [cx, cy, cz], o, field: f, boxSdf };
}
