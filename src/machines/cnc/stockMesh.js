// Sieť voxelového obrobku pre three.js: povrch sa prepočítava po blokoch 16³ (voxel.js), ale do GPU sa
// posiela zlúčený po 2 × 2 × 2 blokoch – osemkrát menej vykreslení, pričom pri zmene jedného bloku sa
// len skopírujú už spočítané polia susedných blokov (bez nového výpočtu povrchu).
import * as THREE from 'three';

export function createStockMesh({
  group,
  material,
  stock,
  color = null,
  castShadow = false,
  part = 'obrobok',
  size = 2,
}) {
  const data = new Map(), // id bloku → { pos, nor, raw, idx }
    supers = new Map(), // kľúč skupiny blokov → Mesh
    members = new Map(); // kľúč → Set id blokov
  let mat = material,
    dims = stock.chunks;
  const keyOf = (id) => {
    const [cx, cy] = dims,
      i = id % cx,
      j = Math.floor(id / cx) % cy,
      k = Math.floor(id / (cx * cy));
    return `${Math.floor(i / size)},${Math.floor(j / size)},${Math.floor(k / size)}`;
  };
  const rebuild = (key) => {
    const ids = members.get(key) || new Set();
    let nv = 0,
      ni = 0;
    for (const id of ids) {
      const d = data.get(id);
      nv += d.pos.length / 3;
      ni += d.idx.length;
    }
    let me = supers.get(key);
    if (!ni) {
      if (me) {
        group.remove(me);
        me.geometry.dispose();
        supers.delete(key);
      }
      return;
    }
    const pos = new Float32Array(nv * 3),
      nor = new Float32Array(nv * 3),
      idx = new Uint32Array(ni),
      col = color ? new Float32Array(nv * 3) : null;
    const [rawRgb, rgb] = color ? color() : [];
    let v = 0,
      o = 0;
    for (const id of ids) {
      const d = data.get(id);
      pos.set(d.pos, v * 3);
      nor.set(d.nor, v * 3);
      for (let t = 0; t < d.idx.length; t++) idx[o + t] = d.idx[t] + v;
      if (col)
        for (let t = 0; t < d.pos.length / 3; t++) {
          const cc = d.raw && d.raw[t] ? rawRgb : rgb;
          col[(v + t) * 3] = cc[0];
          col[(v + t) * 3 + 1] = cc[1];
          col[(v + t) * 3 + 2] = cc[2];
        }
      v += d.pos.length / 3;
      o += d.idx.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    if (me) {
      me.geometry.dispose();
      me.geometry = geo;
      me.material = mat;
    } else {
      me = new THREE.Mesh(geo, mat);
      me.castShadow = castShadow;
      me.receiveShadow = true;
      me.userData.part = part;
      me.userData.noMerge = true; // geometria sa mení počas obrábania – optimalizátor scény ju nezlučuje
      group.add(me);
      supers.set(key, me);
    }
  };
  // nové alebo zmenené bloky z stock.takeDirty()
  const apply = (parts) => {
    const dirty = new Set();
    for (const p of parts) {
      const key = keyOf(p.id);
      if (!members.has(key)) members.set(key, new Set());
      if (p.idx.length) {
        data.set(p.id, p);
        members.get(key).add(p.id);
      } else {
        data.delete(p.id);
        members.get(key).delete(p.id);
      }
      dirty.add(key);
    }
    dirty.forEach(rebuild);
  };
  const clear = () => {
    supers.forEach((me) => {
      group.remove(me);
      me.geometry.dispose();
    });
    supers.clear();
    members.clear();
    data.clear();
  };
  return {
    apply,
    clear,
    meshes: () => [...supers.values()],
    // nový polotovar (iné rozmery bloku) alebo nový materiál
    reset: (nextStock, nextMaterial = mat) => {
      clear();
      dims = nextStock.chunks;
      mat = nextMaterial;
    },
  };
}
