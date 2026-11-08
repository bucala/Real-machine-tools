import { L } from '../../core/i18n';
export const ELECTRODE_KEY = 'rmt-edm-electrodes-v1';
export const defaultElectrodes = () => [
  { id: 'copper-prism-20-15', name: 'Cu · 20 × 15 mm', shape: 'box', w: 20, d: 15, length: 100 },
  { id: 'copper-round-20', name: 'Cu · Ø20 mm', shape: 'round', w: 20, d: 20, length: 100 },
  ...[
    [8, 8],
    [12, 12],
    [20, 15],
    [30, 20],
  ].map(([w, d]) => ({
    id: `graphite-${w}-${d}`,
    name: `Grafit · ${w} × ${d} mm`,
    material: 'graphite',
    shape: 'box',
    w,
    d,
    length: 100,
  })),
];
export function parseElectrodes(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || data.version !== 1 || !Array.isArray(data.electrodes) || data.electrodes.length > 200)
    throw new Error(L('Neplatná knižnica elektród.', 'Invalid electrode library.'));
  const ids = new Set();
  return data.electrodes.map((e) => {
    if (
      !e ||
      typeof e.id !== 'string' ||
      !e.id ||
      ids.has(e.id) ||
      typeof e.name !== 'string' ||
      !e.name.trim() ||
      !['box', 'round'].includes(e.shape) ||
      !Number.isFinite(e.w) ||
      e.w < 2 ||
      e.w > 40 ||
      !Number.isFinite(e.d) ||
      e.d < 2 ||
      e.d > 40 ||
      !Number.isFinite(e.length) ||
      e.length < 80 ||
      e.length > 180
    )
      throw new Error(
        L('Skontroluj názov, rozmery a jedinečné ID elektródy.', 'Check name, dimensions and unique electrode ID.'),
      );
    if (e.material !== undefined && !['copper', 'graphite'].includes(e.material))
      throw new Error(L('Neplatný materiál.', 'Invalid material.'));
    ids.add(e.id);
    return {
      ...(e.material ? { material: e.material } : {}),
      id: e.id,
      name: e.name.trim().slice(0, 80),
      shape: e.shape,
      w: e.w,
      d: e.d,
      length: e.length,
    };
  });
}
export function readElectrodes(storage) {
  const saved = storage.getItem(ELECTRODE_KEY);
  if (!saved) return defaultElectrodes();
  const items = parseElectrodes(saved),
    ids = new Set(items.map((e) => e.id));
  return [...items, ...defaultElectrodes().filter((e) => e.material === 'graphite' && !ids.has(e.id))];
}
export function writeElectrodes(storage, electrodes) {
  const data = { version: 1, electrodes };
  parseElectrodes(data);
  storage.setItem(ELECTRODE_KEY, JSON.stringify(data));
}
