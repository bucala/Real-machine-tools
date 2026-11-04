import { holderProfile, toolProfile } from '../machines/cnc/toolModel';
import { L } from '../core/i18n';

const outline = (points) => [...points.map(([r, y]) => [r, -y]), ...points.slice().reverse().map(([r, y]) => [-r, -y])].map((p) => p.join(',')).join(' ');
export function CncToolPreview({ tool }) {
  const t = tool, r = Math.min(t.d, 20) / 2;
  return <svg viewBox="-42 -8 84 330" width="48" height="104" role="img" aria-label={`${t.name}, Ø${t.d}, L${t.l} mm, HSK-A63`}>
    <title>{`${t.name} · HSK-A63 · Ø${t.d} · L${t.l} mm`}</title>
    <polygon points={outline(holderProfile(t))} fill="#bbc2c9" stroke="#5e6974" strokeWidth="1" />
    <path d="M-27 9H27 M-31 17H31" stroke="#52606b" fill="none" />
    <rect x={-r} y={t.l - t.s} width={r * 2} height={Math.max(0, t.s - t.lc)} fill="#8a959f" />
    <defs><clipPath id={`cutter-${t.t}`}><polygon points={outline(toolProfile(t))} /></clipPath></defs>
    <polygon points={outline(toolProfile(t))} fill="#c29a50" stroke="#6b532b" strokeWidth=".8" />
    {Array.from({ length: Math.min(t.z, 5) }, (_, i) => <path key={i} d={`M${-t.d / 2 + (i + .5) * t.d / Math.min(t.z, 5)} ${t.l - t.lc} l${t.d / 5} ${Math.max(0, t.lc - t.d / 2)}`} stroke="#6b532b" fill="none" clipPath={`url(#cutter-${t.t})`} />)}
    <text x="0" y="320" textAnchor="middle" fontSize="9" fill="currentColor">{L('Ø', 'Ø')}{t.d} · L{t.l}</text>
  </svg>;
}
