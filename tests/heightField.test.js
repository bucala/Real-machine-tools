import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHeightField } from '../src/core/heightField';

const make = (o = {}) =>
  createHeightField({
    NX: 20,
    NZ: 10,
    W: 2,
    D: 1,
    H: 0.5,
    raw: 0x444444,
    cut: 0xdddddd,
    mat: new THREE.MeshBasicMaterial(),
    ...o,
  });

describe('výšková mapa obrobku', () => {
  it('má sieť s okrajovými prstencami a plnú výšku', () => {
    const hf = make();
    expect(hf.mesh.geometry.attributes.position.count).toBe((20 + 5) * (10 + 5));
    expect(Math.min(...hf.hgt)).toBe(0.5);
    expect(Math.max(...hf.hgt)).toBe(0.5);
  });
  it('eachRect prejde práve uzly v obdĺžniku', () => {
    const hf = make();
    let n = 0;
    hf.eachRect(-0.1, 0.1, -0.1, 0.1, () => {
      n++;
    }); // krok 0,1 → x ∈ {-0.1, 0, 0.1}, z ∈ {-0.1, 0, 0.1}
    expect(n).toBe(9);
    n = 0;
    hf.eachRect(-5, 5, -5, 5, () => {
      n++;
    });
    expect(n).toBe(21 * 11);
  });
  it('reset vráti obrobok do pôvodného stavu vrátane tvaru valca', () => {
    const R = 0.5,
      hf = make({ init: (x, z) => R + Math.sqrt(Math.max(0, R * R - z * z)) });
    const before = Float32Array.from(hf.hgt);
    hf.eachRect(-1, 1, -0.2, 0.2, (k) => {
      hf.hgt[k] = 0.1;
      hf.mask[k] = 1;
    });
    hf.reset();
    expect(Array.from(hf.hgt)).toEqual(Array.from(before));
    expect(hf.mask.every((m) => m === 0)).toBe(true);
  });
});

describe('čiastočná prestavba po reze', () => {
  const cutAt = (hf, x0, x1, z0, z1, h) =>
    hf.cutRect(x0, x1, z0, z1, (k) => {
      hf.hgt[k] = Math.min(hf.hgt[k], h);
      hf.mask[k] = 1;
    });
  const compare = (a, b) => {
    let m = 0;
    for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
    return m;
  };
  it.each([
    ['uprostred', -0.3, 0.2, -0.1, 0.15],
    ['cez ľavú a prednú hranu', -1.2, -0.6, -0.6, -0.3],
    ['celý obrobok', -2, 2, -1, 1],
  ])('%s: polohy, farby aj normály sú rovnaké ako pri úplnej prestavbe', (_, x0, x1, z0, z1) => {
    const a = make(),
      b = make();
    cutAt(a, x0, x1, z0, z1, 0.3);
    a.rebuild(); // čiastočne
    cutAt(b, x0, x1, z0, z1, 0.3);
    b.rebuild(true); // úplne (computeVertexNormals)
    const ga = a.mesh.geometry.attributes,
      gb = b.mesh.geometry.attributes;
    expect(compare(ga.position.array, gb.position.array)).toBe(0);
    expect(compare(ga.color.array, gb.color.array)).toBe(0);
    expect(compare(ga.normal.array, gb.normal.array)).toBeLessThan(1e-5);
  });
  it('do GPU sa posiela len dotknutý pás riadkov', () => {
    const hf = make();
    cutAt(hf, -0.1, 0.1, -0.05, 0.05, 0.2);
    hf.rebuild();
    const rs = hf.mesh.geometry.attributes.position.updateRanges,
      total = hf.mesh.geometry.attributes.position.array.length;
    const sent = rs.reduce((n, r) => n + r.count, 0);
    expect(rs.length).toBeGreaterThan(0);
    expect(sent).toBeGreaterThan(0);
    expect(sent).toBeLessThan(total / 3);
  });
});
