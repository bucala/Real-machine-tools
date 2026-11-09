// Výkresy úloh nových klasických strojov (FGU, FNK, karusel, BN 102, bezhrotová brúska, OHA, buchar, píla, ohýbačka
// rúr). Rovnaký štýl ako sketch.jsx: viewBox 300 × h, kóty DimH / DimV / DimAng.
import { L } from '../core/i18n';
import { Axis, DimAng, DimH, DimV, T } from './sketch';
import { Cap, Ln, Svg, body, r2 } from './sketch';

// frézka: hranol 180 × 100 × 60 s drážkou šírky b a hĺbky h pod uhlom a (pohľad zhora a rez)
export function SlotDrawing({ b = 10, h = 5, a = 0, tol = '±0,15' }) {
  const k = 0.55,
    x0 = 14,
    y0 = 26,
    w = 180 * k,
    hh = 100 * k,
    ex = 176,
    ey = 34;
  const cx = x0 + w / 2,
    cy = y0 + hh / 2,
    rad = (a * Math.PI) / 180,
    dx = Math.cos(rad) * (w / 2 + 20),
    dz = Math.sin(rad) * (w / 2 + 20),
    nx = (-Math.sin(rad) * b * k) / 2,
    nz = (Math.cos(rad) * b * k) / 2;
  const sl = ex + 50 - (b * 0.7) / 2,
    sr = ex + 50 + (b * 0.7) / 2;
  return (
    <Svg h={118} label={`${L('drážka', 'slot')} ${b} × ${h}${a ? ` / ${a}°` : ''}`}>
      <Cap x={x0} y={12}>
        {L('pohľad zhora', 'top view')}
      </Cap>
      <Cap x={ex} y={12}>
        {L('rez', 'section')}
      </Cap>
      <defs>
        <clipPath id={`clip-${a}`}>
          <rect x={x0} y={y0} width={r2(w)} height={r2(hh)} />
        </clipPath>
      </defs>
      <rect x={x0} y={y0} width={r2(w)} height={r2(hh)} {...body} />
      <path
        clipPath={`url(#clip-${a})`}
        d={`M${r2(cx - dx + nx)} ${r2(cy + dz + nz)}L${r2(cx + dx + nx)} ${r2(cy - dz + nz)}L${r2(cx + dx - nx)} ${r2(cy - dz - nz)}L${r2(cx - dx - nx)} ${r2(cy + dz - nz)}Z`}
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeDasharray="4 2"
      />
      <DimH x1={x0} x2={x0 + w} y={y0 + hh + 13} f1={y0 + hh} text="180" />
      <DimV y1={y0} y2={y0 + hh} x={x0 + w + 9} f1={x0 + w} text="100" />
      {a ? <DimAng cx={cx} cy={cy} r={34} a1={0} a2={-a} text={`${a}°`} tr={44} /> : null}
      <path d={`M${ex} ${ey}H${r2(sl)}V${ey + h * 1.6}H${r2(sr)}V${ey}H${ex + 100}V${ey + 60}H${ex}Z`} {...body} />
      <DimH x1={ex} x2={ex + 100} y={ey + 73} f1={ey + 60} text="100" />
      <DimV y1={ey} y2={ey + 60} x={ex + 109} f1={ex + 100} text="60" />
      <DimH x1={sl} x2={sr} y={ey - 9} f1={ey} text={String(b)} />
      <DimV y1={ey} y2={ey + h * 1.6} x={sl - 7} f2={sl} text={`${h} ${tol}`} side="l" ty={ey - 6} />
    </Svg>
  );
}

// nástrojárska frézka: úkos (skosenie) hrany hranola pod uhlom a na šírku s
export function ChamferDrawing({ a = 30, s = 15 }) {
  const ex = 70,
    ey = 24,
    W = 160,
    H = 70,
    cs = s * 2.2,
    ch = cs * Math.tan((a * Math.PI) / 180);
  return (
    <Svg h={120} label={`${L('úkos', 'bevel')} ${a}° × ${s}`}>
      <Cap x={14} y={12}>
        {L('čelný pohľad', 'front view')}
      </Cap>
      <path d={`M${ex} ${ey + ch}L${ex + cs} ${ey}H${ex + W}V${ey + H}H${ex}Z`} {...body} />
      <DimH x1={ex} x2={ex + cs} y={ey - 10} f1={ey + ch} f2={ey} text={String(s)} />
      <DimV y1={ey + ch} y2={ey + H} x={ex - 10} f1={ex} text={L('60 − h', '60 − h')} side="l" />
      <DimH x1={ex} x2={ex + W} y={ey + H + 14} f1={ey + H} text="100" />
      <DimAng cx={ex + cs} cy={ey} r={26} a1={180} a2={180 - a} text={`${a}° ±0,5°`} tr={36} ta="end" />
      <T x={ex + W / 2 + 10} y={ey + H / 2 + 4} s={8} o={0.75}>
        {L('hranol 100 × 60 × 80', 'block 100 × 60 × 80')}
      </T>
    </Svg>
  );
}

// karuselový sústruh: kotúč s osadením (priemer D, výška H, čelo zarovnané) – polovičný rez
export function DiscDrawing({ D = 900, d = 600, H = 180, h = 60, tol = '±0,2' }) {
  const k = 0.13,
    cx = 30,
    y0 = 30,
    R = (D / 2) * k,
    r = (d / 2) * k,
    hh = H * k * 2,
    sh = h * k * 2;
  return (
    <Svg h={140} label={`Ø${D} / Ø${d}`}>
      <Cap x={14} y={14}>
        {L('polovičný rez', 'half section')}
      </Cap>
      <path d={`M${cx} ${y0}H${r2(cx + r)}V${r2(y0 + sh)}H${r2(cx + R)}V${r2(y0 + hh)}H${cx}Z`} {...body} />
      <Axis a={[cx, y0 - 10]} b={[cx, y0 + hh + 10]} />
      <DimH x1={cx} x2={cx + R} y={y0 + hh + 16} f1={y0 + hh} text={`Ø${D} ${tol}`} />
      <DimH x1={cx} x2={cx + r} y={y0 - 10} f1={y0} text={`Ø${d} ${tol}`} />
      <DimV y1={y0} y2={y0 + hh} x={cx + R + 14} f1={cx + R} text={String(H)} />
      <DimV y1={y0} y2={y0 + sh} x={cx + r + 10} f1={cx + r} text={String(h)} side="r" />
    </Svg>
  );
}

// nôž na brúsenie: uhol chrbta α, čela γ a špičky (pohľad zboku)
export function ToolAngleDrawing({ alpha = 8, gamma = 12 }) {
  const x0 = 60,
    y0 = 40,
    W = 170,
    H = 50,
    ta = Math.tan((alpha * Math.PI) / 180) * H,
    tg = Math.tan((gamma * Math.PI) / 180) * 40;
  return (
    <Svg h={120} label={`α ${alpha}° γ ${gamma}°`}>
      <Cap x={14} y={14}>
        {L('nôž – pohľad zboku', 'tool – side view')}
      </Cap>
      <path d={`M${x0 + ta} ${y0 + H}L${x0} ${y0}L${x0 + 40} ${r2(y0 + tg)}H${x0 + W}V${y0 + H}Z`} {...body} />
      <Ln a={[x0, y0]} b={[x0, y0 + H + 12]} dash="3 2" />
      <Ln a={[x0, y0]} b={[x0 + 60, y0]} dash="3 2" />
      <DimAng cx={x0} cy={y0} r={42} a1={90} a2={90 - alpha} text={`α ${alpha}°`} tr={52} ta="start" />
      <DimAng cx={x0} cy={y0} r={30} a1={0} a2={-gamma} text={`γ ${gamma}°`} tr={40} ta="start" />
      <DimH x1={x0} x2={x0 + W} y={y0 + H + 16} f1={y0 + H} text="100" />
    </Svg>
  );
}

// kovanie: hranol pred a po (prierez a × a → výška h, dĺžka sa predĺži)
export function ForgeDrawing({ a = 60, h = 40, L0 = 120 }) {
  const k = 0.7,
    x0 = 20,
    y0 = 30,
    L1 = Math.round((L0 * a) / h);
  return (
    <Svg h={140} label={`${a} → ${h}`}>
      <Cap x={x0} y={14}>
        {L('polotovar', 'blank')}
      </Cap>
      <rect x={x0} y={y0} width={r2(L0 * k * 0.6)} height={r2(a * k)} {...body} />
      <DimV y1={y0} y2={y0 + a * k} x={x0 + L0 * k * 0.6 + 9} f1={x0 + L0 * k * 0.6} text={String(a)} />
      <DimH x1={x0} x2={x0 + L0 * k * 0.6} y={y0 + a * k + 12} f1={y0 + a * k} text={String(L0)} />
      <Cap x={140} y={14}>
        {L('po kovaní', 'forged')}
      </Cap>
      <rect x={140} y={y0} width={r2(L1 * k * 0.6)} height={r2(h * k)} {...body} />
      <DimV y1={y0} y2={y0 + h * k} x={140 + L1 * k * 0.6 + 9} f1={140 + L1 * k * 0.6} text={`${h} ±1`} />
      <DimH x1={140} x2={140 + L1 * k * 0.6} y={y0 + h * k + 12} f1={y0 + h * k} text={`≈ ${L1}`} />
      <T x={150} y={y0 + h * k + 36} s={8} o={0.75}>
        {L('kovať pri 1 200 – 850 °C', 'forge at 1,200 – 850 °C')}
      </T>
    </Svg>
  );
}

// píla: profil delený na kusy dĺžky l pod uhlom a
export function CutDrawing({ l = 250, n = 3, a = 0, prof = 'Ø40' }) {
  const x0 = 20,
    y0 = 40,
    k = 0.22,
    w = l * k,
    off = Math.tan((a * Math.PI) / 180) * 20;
  return (
    <Svg h={110} label={`${n} × ${l} ${prof}`}>
      <Cap x={x0} y={14}>
        {`${n} × ${prof}`}
      </Cap>
      {Array.from({ length: n }, (_, i) => (
        <path
          key={i}
          d={`M${r2(x0 + i * (w + 8))} ${y0 + 20}L${r2(x0 + i * (w + 8) + off)} ${y0}H${r2(x0 + i * (w + 8) + w + off)}L${r2(x0 + i * (w + 8) + w)} ${y0 + 20}Z`}
          {...body}
        />
      ))}
      <DimH x1={x0} x2={x0 + w} y={y0 + 34} f1={y0 + 20} text={`${l} ±1`} />
      {a ? (
        <T x={x0 + w * 1.5} y={y0 + 52} s={9}>
          {`${L('rez pod uhlom', 'mitre')} ${a}°`}
        </T>
      ) : null}
    </Svg>
  );
}

// ohýbačka rúr: oblúk rúry s polomerom R a uhlom a
export function PipeBendDrawing({ D = 28, R = 84, a = 90 }) {
  const cx = 70,
    cy = 100,
    k = 0.75,
    r = R * k,
    rad = (a * Math.PI) / 180;
  const ex = cx + Math.sin(rad) * r,
    ey = cy - Math.cos(rad) * r;
  return (
    <Svg h={130} label={`Ø${D} R${R} ${a}°`}>
      <Cap x={14} y={14}>
        {`${L('rúra', 'tube')} Ø${D} × 2`}
      </Cap>
      <path
        d={`M${cx - 50} ${r2(cy - r)}H${cx}A${r2(r)} ${r2(r)} 0 0 1 ${r2(ex)} ${r2(ey)}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={r2(D * k * 0.5)}
        strokeOpacity="0.25"
      />
      <path
        d={`M${cx - 50} ${r2(cy - r)}H${cx}A${r2(r)} ${r2(r)} 0 0 1 ${r2(ex)} ${r2(ey)}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="9 2 2 2"
      />
      <DimAng cx={cx} cy={cy} r={r * 0.45} a1={-90} a2={-90 + a} text={`${a}° ±1°`} tr={r * 0.45 + 12} />
      <T x={cx + 8} y={cy - r * 0.2} s={9}>{`R${R}`}</T>
    </Svg>
  );
}
