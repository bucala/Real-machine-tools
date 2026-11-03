import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHeightField } from '../src/core/heightField';

const make = (o = {}) => createHeightField({ NX: 20, NZ: 10, W: 2, D: 1, H: 0.5, raw: 0x444444, cut: 0xdddddd, mat: new THREE.MeshBasicMaterial(), ...o });

describe('výšková mapa obrobku', () => {
  it('má sieť s okrajovými prstencami a plnú výšku', () => {
    const hf = make();
    expect(hf.mesh.geometry.attributes.position.count).toBe((20 + 5) * (10 + 5));
    expect(Math.min(...hf.hgt)).toBe(0.5); expect(Math.max(...hf.hgt)).toBe(0.5);
  });
  it('eachRect prejde práve uzly v obdĺžniku', () => {
    const hf = make(); let n = 0;
    hf.eachRect(-0.1, 0.1, -0.1, 0.1, () => { n++; });    // krok 0,1 → x ∈ {-0.1, 0, 0.1}, z ∈ {-0.1, 0, 0.1}
    expect(n).toBe(9);
    n = 0; hf.eachRect(-5, 5, -5, 5, () => { n++; });
    expect(n).toBe(21 * 11);
  });
  it('reset vráti obrobok do pôvodného stavu vrátane tvaru valca', () => {
    const R = 0.5, hf = make({ init: (x, z) => R + Math.sqrt(Math.max(0, R * R - z * z)) });
    const before = Float32Array.from(hf.hgt);
    hf.eachRect(-1, 1, -0.2, 0.2, (k) => { hf.hgt[k] = 0.1; hf.mask[k] = 1; });
    hf.reset();
    expect(Array.from(hf.hgt)).toEqual(Array.from(before));
    expect(hf.mask.every((m) => m === 0)).toBe(true);
  });
});
