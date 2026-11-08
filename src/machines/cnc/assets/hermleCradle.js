// Kolíska Hermle: používateľom dodané STL (Meshy_AI_Industrial_Rotary_Positioner_20261105_texture.stl),
// zjednodušené na 14000 trojuholníkov, súradnice kvantované krokom 0,002 / 0,001 / 0,001 (odchýlka ≤ 0,001).
// Dáta sú v samostatnom chunku (hermleCradleData.js), ktorý sa stiahne až pri stavbe stroja – stroj sa zobrazí
// hneď a kolíska sa doplní o chvíľu; text s rozdielmi sa komprimuje o pätinu lepšie než pôvodné base64.
export const CRADLE_SOURCE = 'Meshy_AI_Industrial_Rotary_Positioner_20261105_texture.stl';
const MIN = [-46.574, -23.833, 0.002],
  STEP = [0.002, 0.001, 0.001];

// { P, I } → { positions: Float32Array (x, z, h ako v pôvodnom STL), indices: Uint16Array }
export function decodeCradle({ P, I }) {
  const n = P.length / 3,
    positions = new Float32Array(n * 3);
  for (let a = 0; a < 3; a++) {
    let q = 0;
    for (let i = 0; i < n; i++) {
      q += P[a * n + i];
      positions[i * 3 + a] = MIN[a] + q * STEP[a];
    }
  }
  const indices = new Uint16Array(I.length);
  let hw = 0;
  for (let i = 0; i < I.length; i++) indices[i] = I[i] === 0 ? hw++ : hw - I[i];
  return { positions, indices };
}

let pending = null;
export const loadCradle = () => (pending ||= import('./hermleCradleData.js').then(decodeCradle));
