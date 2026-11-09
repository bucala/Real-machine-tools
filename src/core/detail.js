// Spoločné detaily klasických strojov: zaoblené odliatky, rebrá, výrobné štítky, olejoznaky, tabuľky pri pákach,
// káble a skrutky. Všetky rozmery v jednotkách scény (1 = 100 mm). Textúry sa kreslia do plátna raz a zdieľajú sa.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const texCache = new Map();
const canvasTex = (key, w, h, draw) => {
  if (texCache.has(key)) return texCache.get(key);
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (!g) return null;
  draw(g, w, h);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  texCache.set(key, tx);
  return tx;
};

export function makeDetail(kit, M) {
  const { add, cylZ, rod } = kit;
  // zaoblený kváder (odliatok) – r = polomer hrany
  const rbox = (p, x0, x1, y0, y1, z0, z1, m, r = 0.12) => {
    const w = x1 - x0,
      h = y1 - y0,
      d = z1 - z0,
      rr = Math.max(0.005, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    return add(p, new RoundedBoxGeometry(w, h, d, 3, rr), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };
  // rebrá odliatku na stene: n rebier pozdĺž osi 'x' alebo 'y' v rovine z = const (smerom k +z)
  const ribs = (p, axis, a0, a1, n, b0, b1, z, depth, thick, m) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
      if (axis === 'x') rbox(p, a - thick / 2, a + thick / 2, b0, b1, z, z + depth, m, thick * 0.4);
      else rbox(p, b0, b1, a - thick / 2, a + thick / 2, z, z + depth, m, thick * 0.4);
    }
  };
  // obdĺžnik s textúrou otočený k +z v rodičovi (štítky, tabuľky)
  const plane = (p, w, h, tex, x, y, z, ry = 0) => {
    const mat = tex
      ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.3 })
      : M.white || new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const o = add(p, new THREE.PlaneGeometry(w, h), mat, x, y, z);
    o.rotation.y = ry;
    o.castShadow = false;
    o.userData.noMerge = true;
    return o;
  };
  // výrobný štítok: hliníková tabuľka s logom výrobcu, typom a výrobným číslom
  const nameplate = (p, x, y, z, ry, maker, type, w = 1.0) =>
    plane(
      p,
      w,
      w * 0.6,
      canvasTex(`np:${maker}:${type}`, 320, 192, (g, W, H) => {
        g.fillStyle = '#c9ccc8';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = '#5b5f5c';
        g.lineWidth = 6;
        g.strokeRect(5, 5, W - 10, H - 10);
        g.fillStyle = '#1b3f8f';
        g.font = 'bold 54px Arial';
        g.textAlign = 'center';
        g.fillText(maker.split(' ')[0], W / 2, 64);
        g.fillStyle = '#222';
        g.font = 'bold 20px Arial';
        g.fillText(maker.split(' ').slice(1).join(' ').toUpperCase(), W / 2, 92);
        g.font = 'bold 30px Arial';
        g.fillText(type, W / 2, 134);
        g.font = '16px Arial';
        g.fillText('N° 4127 · 1984', W / 2, 166);
        for (const [cx, cy] of [
          [18, 18],
          [W - 18, 18],
          [18, H - 18],
          [W - 18, H - 18],
        ]) {
          g.fillStyle = '#7a7d7a';
          g.beginPath();
          g.arc(cx, cy, 6, 0, Math.PI * 2);
          g.fill();
        }
      }),
      x,
      y,
      z,
      ry,
    );
  // tabuľka pri pákach (otáčky / posuvy): mriežka hodnôt
  const valuePlate = (p, x, y, z, ry, title, values, w = 0.9) =>
    plane(
      p,
      w,
      w * 0.62,
      canvasTex(`vp:${title}:${values.join(',')}`, 300, 186, (g, W, H) => {
        g.fillStyle = '#e8e4d6';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#1c1c1c';
        g.font = 'bold 22px Arial';
        g.textAlign = 'center';
        g.fillText(title, W / 2, 28);
        const cols = Math.min(4, values.length),
          rows = Math.ceil(values.length / cols);
        g.font = 'bold 21px Arial';
        g.strokeStyle = '#555';
        g.lineWidth = 1.5;
        values.forEach((v, i) => {
          const cx = 14 + ((i % cols) + 0.5) * ((W - 28) / cols),
            cy = 52 + (Math.floor(i / cols) + 0.5) * ((H - 62) / rows);
          g.strokeRect(cx - (W - 28) / cols / 2, cy - (H - 62) / rows / 2, (W - 28) / cols, (H - 62) / rows);
          g.fillText(String(v), cx, cy + 8);
        });
      }),
      x,
      y,
      z,
      ry,
    );
  // zvislá stupnica (napr. napnutie pásu): ryska každých 5 %, čísla po 25 %
  const scalePlate = (p, x, y, z, ry, w, h) =>
    plane(
      p,
      w,
      h,
      canvasTex('scale:v', 96, 320, (g, W, H) => {
        g.fillStyle = '#e9e6da';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#c8322b';
        g.fillRect(W - 22, 14, 12, (H - 28) * 0.3);
        g.fillStyle = '#2e9b4a';
        g.fillRect(W - 22, 14 + (H - 28) * 0.3, 12, (H - 28) * 0.7);
        g.fillStyle = '#1b1d1f';
        g.strokeStyle = '#1b1d1f';
        g.font = 'bold 20px Arial';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        for (let v = 0; v <= 100; v += 5) {
          const yy = H - 14 - ((H - 28) * v) / 100;
          g.lineWidth = v % 25 ? 2 : 3;
          g.beginPath();
          g.moveTo(W - 26, yy);
          g.lineTo(W - 26 - (v % 25 ? 12 : 22), yy);
          g.stroke();
          if (v % 25 === 0) g.fillText(String(v), 6, yy);
        }
      }),
      x,
      y,
      z,
      ry,
    );
  // olejoznak: kruhový rámik so sklom a ryskou hladiny, otočený k +z (pre bok ry = ±π/2)
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xd99a2b, roughness: 0.15, metalness: 0.1 });
  const oilGlass = (p, x, y, z, ry = 0, r = 0.13) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    p.add(g);
    cylZ(g, r * 1.35, r * 1.35, 0, 0.03, 0, 0, M.steel, 24);
    cylZ(g, r, r, 0.03, 0.045, 0, 0, glassMat, 24);
    add(g, new THREE.BoxGeometry(r * 1.6, r * 0.08, 0.01), M.red, 0, 0, 0.052);
    return g;
  };
  // kábel / hadica ako hladká trubica cez body [x, y, z]
  const cable = (p, pts, r = 0.05, m = M.black) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
    return add(p, new THREE.TubeGeometry(curve, Math.max(12, pts.length * 8), r, 8, false), m);
  };
  // skrutky so šesťhrannou hlavou v rade (k +z)
  const bolts = (p, pts, z, r = 0.06, m = M.steelDark) =>
    pts.forEach(([x, y]) => cylZ(p, r, r, z, z + r * 0.8, x, y, m, 6));
  return { rbox, ribs, plane, nameplate, valuePlate, scalePlate, oilGlass, cable, bolts, rod };
}

// stupnica uhla na otočnej doske (±max°, dielik 1°, čísla po 10° – pri max ≤ 20 po 5°); k = zväčšenie uhla v scéne,
// numR = polomer čísel (podiel polomeru), step = krok čísel v °, len = dĺžka dlhej rysky (podiel polomeru)
export const angleScaleTex = (max = 45, k = 1, { numR = 0.68, step = max <= 20 ? 5 : 10, len = 0.18 } = {}) =>
  canvasTex(`ang:${max}:${k}:${numR}:${step}:${len}`, 512, 512, (g, w) => {
    const c = w / 2,
      rO = c - 2;
    g.fillStyle = '#d6d9d6';
    g.beginPath();
    g.arc(c, c, rO, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b1d1f';
    g.strokeStyle = '#1b1d1f';
    g.font = 'bold 34px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let d = -max; d <= max; d++) {
      if (max >= 180 && d === -180) continue;
      const a = (d * k * Math.PI) / 180 - Math.PI / 2,
        l = d % step ? (d % 5 ? len * 0.45 : len * 0.7) : len;
      g.lineWidth = d % 5 ? 2.5 : 4;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * rO * 0.985, c + Math.sin(a) * rO * 0.985);
      g.lineTo(c + Math.cos(a) * rO * (0.985 - l), c + Math.sin(a) * rO * (0.985 - l));
      g.stroke();
      if (d % step === 0) {
        g.save();
        g.translate(c + Math.cos(a) * rO * numR, c + Math.sin(a) * rO * numR);
        g.rotate(a + Math.PI / 2);
        g.fillText(String(max >= 180 ? (d + 360) % 360 : Math.abs(d)), 0, 0);
        g.restore();
      }
    }
  });
