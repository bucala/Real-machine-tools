// Výkresy úloh nových klasických strojov (FGU, FNK, karusel, BN 102, bezhrotová brúska, HOV 25, buchar, píla, ohýbačka
// rúr). Rovnaký štýl ako sketch.jsx: viewBox 300 × h, kóty DimH / DimV / DimAng.
import { L } from '../core/i18n';
import { Axis, DimAng, DimH, DimV, Lead, T } from './sketch';
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
export function ForgeDrawing({ a = 60, h = 40, w = a, L0 = 120, tw = '±3' }) {
  const k = 0.7,
    x0 = 20,
    y0 = 30,
    L1 = Math.round((L0 * a * a) / (h * w));
  return (
    <Svg h={140} label={`${a} × ${a} → ${h} × ${w}`}>
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
        {`${L('šírka', 'width')} ${w} ${tw} · ${L('kovať pri 1 200 – 850 °C', 'forge at 1,200 – 850 °C')}`}
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

// zvislá obrážačka HOV 25: náboj Ø120 / Ø40 – 4 drážky 10 × 3 po 90° alebo vonkajší oblúk R55 na 120°
export function HovDrawing({ kind = 'drazky' }) {
  const cx = 96,
    cy = 66,
    k = 0.42,
    R = 60 * k,
    r = 20 * k;
  const P = (rr, a) => [cx + rr * Math.cos((a * Math.PI) / 180), cy - rr * Math.sin((a * Math.PI) / 180)];
  let outer = `M${r2(cx + R)} ${cy}A${r2(R)} ${r2(R)} 0 1 0 ${r2(cx - R)} ${cy}A${r2(R)} ${r2(R)} 0 1 0 ${r2(cx + R)} ${cy}Z`,
    inner = `M${r2(cx + r)} ${cy}A${r2(r)} ${r2(r)} 0 1 0 ${r2(cx - r)} ${cy}A${r2(r)} ${r2(r)} 0 1 0 ${r2(cx + r)} ${cy}Z`,
    dims;
  if (kind === 'drazky') {
    const h = 5 * k,
      d = 23 * k,
      s = Math.sqrt(r * r - h * h);
    const pts = [];
    for (let q = 0; q < 4; q++) {
      const rot = (p) => {
        const a = (q * Math.PI) / 2,
          x = p[0],
          y = p[1];
        return [cx + x * Math.cos(a) - y * Math.sin(a), cy - (x * Math.sin(a) + y * Math.cos(a))];
      };
      const seq = [
        [s, -h],
        [d, -h],
        [d, h],
        [s, h],
      ].map(rot);
      pts.push(seq);
    }
    // otvor so štyrmi drážkami: oblúky otvoru medzi drážkami
    inner =
      pts
        .map((seq, q) => {
          const next = pts[(q + 1) % 4][0];
          return `${q ? 'L' : 'M'}${seq.map((p) => `${r2(p[0])} ${r2(p[1])}`).join('L')}A${r2(r)} ${r2(r)} 0 0 0 ${r2(next[0])} ${r2(next[1])}`;
        })
        .join('') + 'Z';
    dims = (
      <g>
        <DimV y1={cy - h} y2={cy + h} x={cx + R + 16} f1={cx + d} text={L('10 ±0,2', '10 ±0.2')} />
        <Lead x={cx + d} y={cy - h + 1} x2={cx + R + 30} y2={24} text={L('t2 = 3 ±0,1', 't2 = 3 ±0.1')} />
        <T x={cx + R + 52} y={cy + 30} s={9}>
          {L('4 × 90° ±0,5°', '4 × 90° ±0.5°')}
        </T>
        <Lead x={P(r, 225)[0]} y={P(r, 225)[1]} x2={34} y2={118} text="Ø40" a="l" />
      </g>
    );
  } else {
    const R5 = 55 * k,
      a0 = -60,
      a1 = 60,
      A = P(R, a0 - 8),
      B = P(R5, a0),
      C = P(R5, a1),
      D = P(R, a1 + 8);
    outer = `M${r2(D[0])} ${r2(D[1])}A${r2(R)} ${r2(R)} 0 1 1 ${r2(A[0])} ${r2(A[1])}L${r2(B[0])} ${r2(B[1])}A${r2(R5)} ${r2(R5)} 0 0 0 ${r2(C[0])} ${r2(C[1])}Z`;
    dims = (
      <g>
        <DimAng cx={cx} cy={cy} r={R + 10} a1={-a1} a2={-a0} text={L('120° ±5°', '120° ±5°')} tr={R + 22} />
        <Lead x={P(R5, 20)[0]} y={P(R5, 20)[1]} x2={cx + R + 40} y2={20} text={L('R55 ±0,2', 'R55 ±0.2')} />
        <Lead x={P(r, 225)[0]} y={P(r, 225)[1]} x2={34} y2={118} text="Ø40" a="l" />
      </g>
    );
  }
  const o = P(R, 135);
  return (
    <Svg h={130} label={kind}>
      <path
        d={`${outer} ${inner}`}
        fill="currentColor"
        fillOpacity="0.14"
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <Axis a={[cx - R - 8, cy]} b={[cx + R + 6, cy]} />
      <Axis a={[cx, cy - R - 6]} b={[cx, cy + R + 6]} />
      <Lead x={o[0]} y={o[1]} x2={30} y2={14} text={L('Ø120 × 60', 'Ø120 × 60')} a="l" />
      {dims}
    </Svg>
  );
}
