// Výkresy k úlohám: spoločné kótovacie prvky (kótovacia a pomocná čiara so šípkami, odkazová čiara, uhol, os)
// a náčrty pre všetky stroje. Súradnice v jednotkách viewBoxu (šírka 300), text kóty nad kótovacou čiarou
// alebo vedľa nej – nikdy cez čiaru výkresu. Kontrolu prekrytí robí skript v prehliadači (getBBox / getPointAtLength).
import { L } from '../core/i18n';
import { TAU } from '../core/util';

const FS = 9,
  CW = FS * 0.6; // veľkosť písma a šírka znaku (mono)
const r2 = (v) => Math.round(v * 100) / 100;
export const tw = (s) => String(s).length * CW;
const thin = { stroke: 'currentColor', strokeWidth: 0.6, fill: 'none' };
const body = { stroke: 'currentColor', strokeWidth: 1.4, fill: 'currentColor', fillOpacity: 0.14 };
const bodyN = { stroke: 'currentColor', strokeWidth: 1.4, fill: 'none' };

export const T = ({ x, y, a = 'middle', s = FS, o, children }) => (
  <text
    x={r2(x)}
    y={r2(y)}
    fontSize={s}
    fill="currentColor"
    stroke="none"
    opacity={o}
    fontFamily="var(--f-mono)"
    textAnchor={a}
  >
    {children}
  </text>
);
// šípka s hrotom v (x, y) smerujúca v smere (dx, dy)
const Ar = ({ x, y, dx, dy }) => {
  const l = 5,
    w = 1.5,
    bx = x - dx * l,
    by = y - dy * l;
  return (
    <path
      d={`M${r2(x)} ${r2(y)}L${r2(bx - dy * w)} ${r2(by + dx * w)}L${r2(bx + dy * w)} ${r2(by - dx * w)}z`}
      fill="currentColor"
      stroke="none"
    />
  );
};
const Ln = ({ a, b, dash, w = 0.6, o }) => (
  <line
    x1={r2(a[0])}
    y1={r2(a[1])}
    x2={r2(b[0])}
    y2={r2(b[1])}
    stroke="currentColor"
    strokeWidth={w}
    strokeDasharray={dash}
    opacity={o}
  />
);
export const Axis = ({ a, b }) => <Ln a={a} b={b} dash="9 2 2 2" w={0.5} o={0.75} />;

// vodorovná kóta x1 … x2 vo výške y; f1, f2 = výška prvku, odkiaľ idú pomocné čiary (null = bez pomocnej čiary)
export function DimH({ x1, x2, y, f1, f2 = f1, text, side = 'r' }) {
  const len = x2 - x1,
    out = len < 14,
    e = out ? 9 : 0,
    fits = len >= tw(text) + 4;
  const ext = (x, f) =>
    f == null || Math.abs(f - y) < 1 ? null : (
      <Ln a={[x, f + Math.sign(y - f) * 1.5]} b={[x, y + Math.sign(y - f) * 2.5]} />
    );
  const tx = fits ? (x1 + x2) / 2 : side === 'l' ? x1 - e - 2 : x2 + e + 2,
    ta = fits ? 'middle' : side === 'l' ? 'end' : 'start';
  return (
    <g>
      {ext(x1, f1)}
      {ext(x2, f2)}
      <Ln a={[x1 - e, y]} b={[x2 + e, y]} />
      <Ar x={x1} y={y} dx={out ? 1 : -1} dy={0} />
      <Ar x={x2} y={y} dx={out ? -1 : 1} dy={0} />
      <T x={tx} y={fits ? y - 2.5 : y + 3} a={ta}>
        {text}
      </T>
    </g>
  );
}
// zvislá kóta y1 … y2 vo vzdialenosti x; f1, f2 = x prvku; text vodorovne vedľa čiary (side) vo výške ty
export function DimV({ y1, y2, x, f1, f2 = f1, text, side = 'r', ty }) {
  const len = y2 - y1,
    out = len < 14,
    e = out ? 9 : 0;
  const ext = (y, f) =>
    f == null || Math.abs(f - x) < 1 ? null : (
      <Ln a={[f + Math.sign(x - f) * 1.5, y]} b={[x + Math.sign(x - f) * 2.5, y]} />
    );
  return (
    <g>
      {ext(y1, f1)}
      {ext(y2, f2)}
      <Ln a={[x, y1 - e]} b={[x, y2 + e]} />
      <Ar x={x} y={y1} dx={0} dy={out ? 1 : -1} />
      <Ar x={x} y={y2} dx={0} dy={out ? -1 : 1} />
      <T x={side === 'l' ? x - 3 : x + 3} y={ty != null ? ty : (y1 + y2) / 2 + 3} a={side === 'l' ? 'end' : 'start'}>
        {text}
      </T>
    </g>
  );
}
// šikmá kóta medzi bodmi p1, p2 odsadená o off v smere jednotkovej normály n
export function DimA({ p1, p2, n, off, text }) {
  const dx = p2[0] - p1[0],
    dy = p2[1] - p1[1],
    len = Math.hypot(dx, dy),
    ux = dx / len,
    uy = dy / len;
  const q1 = [p1[0] + n[0] * off, p1[1] + n[1] * off],
    q2 = [p2[0] + n[0] * off, p2[1] + n[1] * off];
  const m = [(q1[0] + q2[0]) / 2 + n[0] * 5, (q1[1] + q2[1]) / 2 + n[1] * 5 + 3];
  return (
    <g>
      <Ln a={[p1[0] + n[0] * 1.5, p1[1] + n[1] * 1.5]} b={[q1[0] + n[0] * 2.5, q1[1] + n[1] * 2.5]} />
      <Ln a={[p2[0] + n[0] * 1.5, p2[1] + n[1] * 1.5]} b={[q2[0] + n[0] * 2.5, q2[1] + n[1] * 2.5]} />
      <Ln a={q1} b={q2} />
      <Ar x={q1[0]} y={q1[1]} dx={-ux} dy={-uy} />
      <Ar x={q2[0]} y={q2[1]} dx={ux} dy={uy} />
      <T x={m[0]} y={m[1]} a={n[0] > 0.3 ? 'start' : n[0] < -0.3 ? 'end' : 'middle'}>
        {text}
      </T>
    </g>
  );
}
// odkazová čiara: šípka (alebo bodka) v (x, y), lom v (x2, y2), polička s textom doprava alebo doľava
export function Lead({ x, y, x2, y2, text, a: aIn, dot }) {
  const a = aIn || (x <= x2 ? 'r' : 'l');
  const d = Math.hypot(x - x2, y - y2) || 1,
    w = tw(text) + 3,
    sx = a === 'r' ? x2 + w : x2 - w;
  return (
    <g>
      <Ln a={[x2, y2]} b={[x, y]} />
      <Ln a={[x2, y2]} b={[sx, y2]} />
      {dot ? (
        <circle cx={r2(x)} cy={r2(y)} r="1.4" fill="currentColor" stroke="none" />
      ) : (
        <Ar x={x} y={y} dx={(x - x2) / d} dy={(y - y2) / d} />
      )}
      <T x={a === 'r' ? x2 + 1.5 : x2 - 1.5} y={y2 - 2.5} a={a === 'r' ? 'start' : 'end'}>
        {text}
      </T>
    </g>
  );
}
// uhlová kóta: oblúk s polomerom r medzi uhlami a1 a a2 (stupne, matematicky – proti smeru hodín, os y hore)
const circ = (cx, cy, r) =>
  `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0z`;
const pa = (cx, cy, r, a) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)];
export function DimAng({ cx, cy, r, a1, a2, text, tr = r + 9, ta = 'middle' }) {
  const p1 = pa(cx, cy, r, a1),
    p2 = pa(cx, cy, r, a2),
    s1 = Math.sin((a1 * Math.PI) / 180),
    c1 = Math.cos((a1 * Math.PI) / 180),
    s2 = Math.sin((a2 * Math.PI) / 180),
    c2 = Math.cos((a2 * Math.PI) / 180);
  const tp = pa(cx, cy, tr, (a1 + a2) / 2);
  return (
    <g>
      <path d={`M${r2(p1[0])} ${r2(p1[1])}A${r} ${r} 0 0 0 ${r2(p2[0])} ${r2(p2[1])}`} {...thin} />
      <Ar x={p1[0]} y={p1[1]} dx={s1} dy={c1} />
      <Ar x={p2[0]} y={p2[1]} dx={-s2} dy={-c2} />
      <T x={tp[0]} y={tp[1] + 3} a={ta}>
        {text}
      </T>
    </g>
  );
}
const Svg = ({ h, label, children }) => (
  <svg viewBox={`0 0 300 ${h}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
    {children}
  </svg>
);
const Cap = ({ x, y, children, a = 'start' }) => (
  <T x={x} y={y} s={8} o={0.7} a={a}>
    {children}
  </T>
);
const Mark = ({ x, y, r }) => (
  <g>
    <circle cx={r2(x)} cy={r2(y)} r={r2(r)} {...bodyN} />
    <Ln a={[x - r - 2.5, y]} b={[x + r + 2.5, y]} w={0.5} />
    <Ln a={[x, y - r - 2.5]} b={[x, y + r + 2.5]} w={0.5} />
  </g>
);

// ---------------- sústruh: tyč v skľučovadle ----------------
// parts: [[dĺžka, priemer, závit?], …] od čeľustí; dims: { h: [a, b], text, row, side } · { d: x, text } · { lead: x, text }
export function LatheDrawing({ parts, dims, label }) {
  const total = parts.reduce((s, [l]) => s + l, 0),
    maxD = Math.max(...parts.map(([, d]) => d));
  const k = Math.min(250 / total, 60 / maxD),
    lead = dims.some((d) => d.lead != null);
  const rows = Math.max(0, ...dims.filter((d) => d.h).map((d) => (d.row || 0) + 1));
  const TM = lead ? 26 : 8,
    x0 = 26,
    cy = TM + (maxD * k) / 2,
    bot = cy + (maxD * k) / 2,
    H = bot + 9 + rows * 14;
  const X = (mm) => x0 + mm * k;
  const segs = [];
  parts.reduce((a, p) => {
    segs.push({ a, b: a + p[0], d: p[1], th: p[2] });
    return a + p[0];
  }, 0);
  const Rat = (mm) => (segs.find((s) => mm >= s.a - 1e-9 && mm <= s.b + 1e-9).d * k) / 2;
  const Rmax = (mm) => Math.max(...segs.filter((s) => mm >= s.a - 1e-9 && mm <= s.b + 1e-9).map((s) => (s.d * k) / 2));
  return (
    <Svg h={H} label={label}>
      <rect
        x={x0 - 14}
        y={r2(cy - (maxD * k) / 2 - 6)}
        width="14"
        height={r2(maxD * k + 12)}
        fill="currentColor"
        opacity="0.25"
      />
      {segs.map((s, i) => (
        <g key={i}>
          <rect x={r2(X(s.a))} y={r2(cy - (s.d * k) / 2)} width={r2((s.b - s.a) * k)} height={r2(s.d * k)} {...bodyN} />
          {s.th &&
            Array.from({ length: Math.floor(((s.b - s.a) * k) / 4) }, (_, j) => (
              <Ln
                key={j}
                a={[X(s.a) + 2 + j * 4, cy - (s.d * k) / 2 + 1]}
                b={[X(s.a) + 4 + j * 4, cy + (s.d * k) / 2 - 1]}
                w={0.4}
                o={0.6}
              />
            ))}
        </g>
      ))}
      <Axis a={[x0 - 18, cy]} b={[Math.min(296, X(total) + 16), cy]} />
      {dims.map((d, i) => {
        if (d.h)
          return (
            <DimH
              key={i}
              x1={X(d.h[0])}
              x2={X(d.h[1])}
              y={bot + 13 + (d.row || 0) * 14}
              f1={cy + Rmax(d.h[0])}
              f2={cy + Rmax(d.h[1])}
              text={d.text}
              side={d.side}
            />
          );
        if (d.d != null) {
          const R = Rat(d.d);
          return <DimV key={i} x={X(d.d)} y1={cy - R} y2={cy + R} text={d.text} ty={cy - R / 2 + 3} />;
        }
        const R = Rat(d.lead),
          right = X(d.lead) + 10 + tw(d.text) + 4 < 298;
        return <Lead key={i} x={X(d.lead)} y={cy - R} x2={X(d.lead) + (right ? 10 : -10)} y2={TM - 9} text={d.text} />;
      })}
    </Svg>
  );
}

// ---------------- fréza: pohľad zhora a priečny rez hranolom 180 × 100 × 60 ----------------
export function MillDrawing({ slot }) {
  const k = 0.55,
    x0 = 14,
    y0 = 24,
    w = 180 * k,
    h = 100 * k,
    ex = 176,
    ey = 30;
  const sl = ex + 40,
    sr = ex + 60,
    sd = 5;
  return (
    <Svg h={110} label={slot ? L('drážka 20 × 5', 'slot 20 × 5') : L('rovina −2', 'face −2')}>
      <Cap x={x0} y={12}>
        {L('pohľad zhora', 'top view')}
      </Cap>
      <Cap x={ex} y={12}>
        {L('rez', 'section')}
      </Cap>
      <rect x={x0} y={y0} width={r2(w)} height={r2(h)} {...body} />
      {slot && (
        <rect
          x={x0}
          y={r2(y0 + 40 * k)}
          width={r2(w)}
          height={r2(20 * k)}
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeDasharray="4 2"
        />
      )}
      <DimH x1={x0} x2={x0 + w} y={y0 + h + 13} f1={y0 + h} text="180" />
      <DimV y1={y0} y2={y0 + h} x={x0 + w + 9} f1={x0 + w} text="100" />
      {slot ? (
        <path d={`M${ex} ${ey}H${sl}V${ey + sd}H${sr}V${ey}H${ex + 100}V${ey + 60}H${ex}Z`} {...body} />
      ) : (
        <g>
          <path d={`M${ex} ${ey + 2}H${ex + 100}V${ey + 60}H${ex}Z`} {...body} />
          <Ln a={[ex, ey]} b={[ex + 100, ey]} dash="3 2" />
        </g>
      )}
      <DimH x1={ex} x2={ex + 100} y={ey + 73} f1={ey + 60} text="100" />
      <DimV y1={slot ? ey : ey + 2} y2={ey + 60} x={ex + 109} f1={ex + 100} text={slot ? '60' : '58'} />
      {slot ? (
        <g>
          <DimH x1={sl} x2={sr} y={ey - 9} f1={ey} text="20" />
          <DimV y1={ey} y2={ey + sd} x={sl - 7} f2={sl} text={L('5 ±0,15', '5 ±0.15')} side="l" ty={ey - 6} />
        </g>
      ) : (
        <DimV y1={ey} y2={ey + 2} x={ex - 7} f1={ex} text={L('2 ±0,1', '2 ±0.1')} side="l" ty={ey - 6} />
      )}
    </Svg>
  );
}
// fréza: mnohohran na tyči Ø45 v deliacom prístroji
export function PolyDrawing({ n, s, len = 40, D = 45, bar = 120 }) {
  const cx = 56,
    cy = 56,
    k = 1.4,
    a = (s / 2) * k,
    rc = a / Math.cos(Math.PI / n),
    off = n === 4 ? 45 : 0,
    half = a * Math.tan(Math.PI / n);
  const pts = Array.from({ length: n }, (_, i) => {
    const t = ((off + (i * 360) / n) * Math.PI) / 180;
    return `${r2(cx + rc * Math.cos(t))},${r2(cy - rc * Math.sin(t))}`;
  }).join(' ');
  const k2 = 0.9,
    bx = 186,
    bL = bar * k2,
    bR = (D / 2) * k2,
    fx = bx + bL - len * k2,
    fa = (s / 2) * k2;
  return (
    <Svg h={112} label={`s ${s}`}>
      <Cap x={10} y={12}>
        {L('čelo', 'end view')}
      </Cap>
      <Cap x={bx - 8} y={12}>
        {L('pohľad zboku', 'side view')}
      </Cap>
      <circle
        cx={cx}
        cy={cy}
        r={r2((D / 2) * k)}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeDasharray="3 2"
      />
      <polygon points={pts} {...body} />
      <Axis a={[cx - (D / 2) * k - 5, cy]} b={[cx + (D / 2) * k + 5, cy]} />
      <Axis a={[cx, cy - (D / 2) * k - 5]} b={[cx, cy + (D / 2) * k + 5]} />
      <DimV y1={cy - a} y2={cy + a} x={cx + (D / 2) * k + 9} f1={cx + half} text={L(`${s} ±0,15`, `${s} ±0.15`)} />
      <rect x={bx - 10} y={r2(cy - bR - 6)} width="10" height={r2(2 * bR + 12)} fill="currentColor" opacity="0.25" />
      <path
        d={`M${bx} ${r2(cy - bR)}H${r2(fx)}V${r2(cy - fa)}H${r2(bx + bL)}V${r2(cy + fa)}H${r2(fx)}V${r2(cy + bR)}H${bx}Z`}
        {...body}
      />
      <Ln a={[fx, cy - fa]} b={[fx, cy + fa]} w={1} />
      <Axis a={[bx - 14, cy]} b={[Math.min(297, bx + bL + 8), cy]} />
      <DimV y1={cy - bR} y2={cy + bR} x={bx + 22} text="Ø45" ty={cy - bR / 2 + 3} />
      <DimH x1={fx} x2={bx + bL} y={cy + bR + 13} f1={cy + fa} text={`≥ ${len}`} />
    </Svg>
  );
}

// ---------------- vŕtačka: doska 180 × 120 zhora ----------------
export function DrillDrawing({ holes, callout, dist }) {
  const k = 0.7,
    x0 = 50,
    y0 = 14,
    w = 180 * k,
    h = 120 * k,
    cx = x0 + w / 2,
    cy = y0 + h / 2;
  const P = holes.map(([x, y, d]) => [cx + x * k, cy - y * k, (d / 2) * k]);
  const last = P[P.length - 1];
  return (
    <Svg h={120} label={callout}>
      <rect x={x0} y={y0} width={r2(w)} height={r2(h)} {...body} />
      {P.map(([x, y, r], i) => (
        <Mark key={i} x={x} y={y} r={r} />
      ))}
      {dist && <DimH x1={P[0][0]} x2={P[1][0]} y={cy + 18} f1={cy + P[0][2] + 2.5} text={dist} />}
      <Lead x={last[0] + last[2] * 0.72} y={last[1] - last[2] * 0.72} x2={x0 + w + 12} y2={y0 + 10} text={callout} />
      <DimH x1={x0} x2={x0 + w} y={y0 + h + 13} f1={y0 + h} text="180" />
      <DimV y1={y0} y2={y0 + h} x={x0 - 9} f1={x0} text="120" side="l" />
    </Svg>
  );
}

// ---------------- radiálna vŕtačka: doska s dierami ----------------
export function RadialRectDrawing() {
  const k = 0.33,
    x0 = 72,
    y0 = 26,
    w = 400 * k,
    h = 300 * k,
    cx = x0 + w / 2,
    cy = y0 + h / 2,
    hx = 150 * k,
    hy = 100 * k,
    r = 8 * k + 1;
  const P = [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ];
  return (
    <Svg h={146} label="4 × Ø16">
      <rect x={x0} y={y0} width={r2(w)} height={r2(h)} {...body} />
      {P.map(([x, y], i) => (
        <Mark key={i} x={cx + x} y={cy + y} r={r} />
      ))}
      <DimH x1={cx - hx} x2={cx + hx} y={y0 - 12} f1={cy - hy - r - 2} text={L('300 ±0,5', '300 ±0.5')} />
      <DimV y1={cy - hy} y2={cy + hy} x={x0 + w + 10} f1={cx + hx + r + 2} text={L('200 ±0,5', '200 ±0.5')} />
      <Lead
        x={cx - hx - r * 0.72}
        y={cy + hy + r * 0.72}
        x2={cx - hx + 22}
        y2={y0 + h + 16}
        text={L('4 × Ø16 naskrz', '4 × Ø16 through')}
      />
      <T x={296} y={y0 + h + 13.5} a="end" o={0.75}>
        {L('doska 400 × 300', 'plate 400 × 300')}
      </T>
    </Svg>
  );
}
export function RadialFlangeDrawing() {
  const k = 0.3,
    x0 = 58,
    y0 = 14,
    w = 400 * k,
    cx = x0 + w / 2,
    cy = y0 + w / 2,
    R = 150 * k,
    r = 10 * k + 0.6;
  const P = Array.from({ length: 6 }, (_, i) => pa(cx, cy, R, i * 60));
  const h1 = pa(cx, cy, R, 60),
    c30 = pa(cx, cy, R, 30);
  return (
    <Svg h={150} label="6 × Ø20">
      <rect x={x0} y={y0} width={r2(w)} height={r2(w)} {...body} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="6 2 2 2" />
      <Ln a={[cx, cy]} b={P[0]} w={0.5} o={0.7} />
      <Ln a={[cx, cy]} b={P[5]} w={0.5} o={0.7} />
      {P.map(([x, y], i) => (
        <Mark key={i} x={x} y={y} r={r} />
      ))}
      <DimAng cx={cx} cy={cy} r={24} a1={-60} a2={0} text="60°" tr={33} />
      <Lead
        x={h1[0] + r * 0.72}
        y={h1[1] - r * 0.72}
        x2={x0 + w + 12}
        y2={y0 + 12}
        text={L('6 × Ø20 naskrz', '6 × Ø20 through')}
      />
      <Lead x={c30[0]} y={c30[1]} x2={x0 + w + 12} y2={y0 + 40} text={L('Ø300 ±0,5', 'Ø300 ±0.5')} dot />
      <T x={292} y={y0 + w + 14} a="end" o={0.75}>
        {L('doska 400 × 400', 'plate 400 × 400')}
      </T>
    </Svg>
  );
}

// ---------------- horizontálka: rez skriňou ----------------
export function BoxDrawing({ two }) {
  const x0 = 76,
    x1 = 240,
    y0 = 26,
    y1 = 104,
    t = 9,
    cy = 65,
    hr = 12;
  const wall = (x) => (
    <g>
      <rect x={x} y={y0} width={t} height={cy - hr - y0} {...body} />
      <rect x={x} y={cy + hr} width={t} height={y1 - cy - hr} {...body} />
    </g>
  );
  return (
    <Svg h={116} label="Ø80 H7">
      <rect x={x0 + t} y={y0} width={x1 - x0 - 2 * t} height={t} {...body} />
      <rect x={x0 + t} y={y1 - t} width={x1 - x0 - 2 * t} height={t} {...body} />
      {wall(x0)}
      {two ? wall(x1 - t) : <rect x={x1 - t} y={y0} width={t} height={y1 - y0} {...body} />}
      <Axis a={[x0 - 26, cy]} b={[x1 + 14, cy]} />
      <DimV y1={cy} y2={y1} x={x0 - 14} f1={x0 - 22} f2={x0} text={L('150 ±0,05', '150 ±0.05')} side="l" />
      <Lead x={x0 + t / 2} y={cy - hr} x2={x0 + 22} y2={13} text="Ø80 H7" />
      {two && <Lead x={x1 - t / 2} y={cy - hr} x2={x1 - 22} y2={13} text={L('súosé ≤ 0,02', 'coaxial ≤ 0.02')} a="l" />}
    </Svg>
  );
}

// ---------------- odvalovacia frézka: čelné koleso ----------------
export function GearDrawing({ z, da }) {
  const cx = 150,
    cy = 56,
    r = 40;
  const tip = pa(cx, cy, r + 2.5, 40);
  return (
    <Svg h={108} label={`z ${z}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="5 3" />
      {Array.from({ length: z }, (_, i) => {
        const a = (i / z) * TAU,
          x = cx + Math.cos(a) * r,
          y = cy + Math.sin(a) * r;
        return (
          <rect
            key={i}
            x={r2(x - 2.5)}
            y={r2(y - 2.5)}
            width="5"
            height="5"
            fill="currentColor"
            opacity="0.6"
            transform={`rotate(${r2((a * 180) / Math.PI)} ${r2(x)} ${r2(y)})`}
          />
        );
      })}
      <Axis a={[cx - r - 10, cy]} b={[cx + r + 10, cy]} />
      <Axis a={[cx, cy - r - 10]} b={[cx, cy + r + 10]} />
      <Lead x={tip[0]} y={tip[1]} x2={214} y2={16} text={`da Ø${da}`} />
      <T x={12} y={22} a="start">{`m 2 · z ${z}`}</T>
      <T x={12} y={36} a="start">
        {L('šírka b 20', 'width b 20')}
      </T>
    </Svg>
  );
}

// ---------------- ohýbačka: profil s uhlom ohybu ----------------
export function BendDrawing({ angle, flange, th }) {
  const x0 = 176,
    y0 = 92,
    F = Math.min(66, flange * 1.2),
    dir = 180 - angle,
    dr = (dir * Math.PI) / 180;
  const end = [x0 + Math.cos(dr) * F, y0 - Math.sin(dr) * F],
    u = [Math.cos(dr), -Math.sin(dr)],
    n = [-u[1], u[0]];
  const nn = n[0] < 0 ? [-n[0], -n[1]] : n; // normála od základne (doprava)
  const tr = angle >= 80 ? 38 : 50;
  return (
    <Svg h={112} label={`${angle}°`}>
      <path
        d={`M${x0 - 120} ${y0}H${x0}L${r2(end[0])} ${r2(end[1])}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={Math.max(1.4, th * 1.6)}
        strokeLinejoin="round"
      />
      <DimAng cx={x0} cy={y0} r={26} a1={dir} a2={180} text={L(`${angle}° ±1°`, `${angle}° ±1°`)} tr={tr} ta="end" />
      <DimA p1={[x0, y0]} p2={end} n={nn} off={12} text={String(flange)} />
      <T x={14} y={106} a="start">
        {L(`plech t = ${th} mm`, `sheet t = ${th} mm`)}
      </T>
    </Svg>
  );
}

// ---------------- tabuľové nožnice: tabuľa a pásy ----------------
export function SheetDrawing({ w, n, t, L: Ls, D }) {
  const k = Math.min(170 / Ls, 84 / D),
    x0 = 44,
    y0 = 12,
    ww = Ls * k,
    hh = D * k,
    sw = w * k;
  return (
    <Svg h={hh + 48} label={`${n} × ${w}`}>
      <rect x={x0} y={y0} width={r2(ww)} height={r2(hh)} {...body} />
      {Array.from({ length: n }, (_, i) => (
        <Ln key={i} a={[x0, y0 + sw * (i + 1)]} b={[x0 + ww, y0 + sw * (i + 1)]} dash="5 3" w={0.9} />
      ))}
      <DimV y1={y0} y2={y0 + sw} x={x0 + ww + 10} f1={x0 + ww} text={L(`${w} ±0,3`, `${w} ±0.3`)} />
      <DimH x1={x0} x2={x0 + ww} y={y0 + hh + 13} f1={y0 + hh} text={String(Ls)} />
      <DimV y1={y0} y2={y0 + hh} x={x0 - 9} f1={x0} text={String(D)} side="l" />
      <T x={x0 + ww + 10} y={y0 + hh - 2} a="start" o={0.8}>
        {L(`${n} pásy · t ${t}`, `${n} strips · t ${t}`)}
      </T>
    </Svg>
  );
}

// ---------------- lis: pás s dierami ----------------
export function PressDrawing({ L: Ls, W, t, d, xs, first, pitch, web, callout }) {
  const k = Math.min(240 / Ls, 64 / W),
    x0 = 20,
    y0 = 30,
    ww = Ls * k,
    hh = W * k,
    cy = y0 + hh / 2,
    r = (d / 2) * k,
    X = (mm) => x0 + mm * k;
  const lastX = X(xs[xs.length - 1]);
  return (
    <Svg h={y0 + hh + 36} label={callout}>
      <rect x={x0} y={y0} width={r2(ww)} height={r2(hh)} {...body} />
      <Axis a={[x0 - 4, cy]} b={[x0 + ww + 4, cy]} />
      {xs.map((x, i) => (
        <Mark key={i} x={X(x)} y={cy} r={r} />
      ))}
      {first && <DimH x1={x0} x2={X(xs[0])} y={y0 - 11} f1={y0} f2={cy - r - 3} text={first} />}
      {pitch && <DimH x1={X(xs[0])} x2={lastX} y={y0 - 11} f1={cy - r - 3} text={pitch} />}
      {web && <DimH x1={X(xs[0]) + r} x2={X(xs[1]) - r} y={y0 - 11} f1={cy} text={web} />}
      <Lead x={lastX + r * 0.72} y={cy - r * 0.72} x2={lastX + r + 14} y2={14} text={callout} />
      <DimV y1={y0} y2={y0 + hh} x={x0 + ww + 9} f1={x0 + ww} text={String(W)} />
      <DimH x1={x0} x2={x0 + ww} y={y0 + hh + 13} f1={y0 + hh} text={String(Ls)} />
      <T x={x0} y={y0 + hh + 30} a="start" o={0.8}>
        {L(`pás t = ${t} mm`, `strip t = ${t} mm`)}
      </T>
    </Svg>
  );
}

// ---------------- zakružovanie a ohýbanie profilov: oblúk / prstenec ----------------
export function ArcDrawing({ R, text, notes }) {
  const Rv = R * 0.4,
    half = 118,
    cx = 150,
    top = 26,
    cy = top + Rv,
    sy = cy - Math.sqrt(Rv * Rv - half * half);
  return (
    <Svg h={top + 78 + (notes.length - 1) * 13} label={text}>
      <path
        d={`M${r2(cx - half)} ${r2(sy)}A${r2(Rv)} ${r2(Rv)} 0 0 1 ${r2(cx + half)} ${r2(sy)}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <Ln a={[cx, top + 3]} b={[cx, top + 52]} />
      <Ar x={cx} y={top + 3} dx={0} dy={-1} />
      <T x={cx + 4} y={top + 40} a="start">
        {text}
      </T>
      <Cap x={cx + 4} y={top + 52}>
        {L('stred oblúka pod výkresom', 'arc centre below the drawing')}
      </Cap>
      {notes.map((s, i) => (
        <T key={i} x={12} y={top + 72 + i * 13} a="start" o={0.85}>
          {s}
        </T>
      ))}
    </Svg>
  );
}
export function RingDrawing({ text, notes, gap = 0, dia }) {
  const cx = 70,
    cy = 56,
    r = 38,
    g0 = gap / 2,
    p1 = pa(cx, cy, r, g0),
    p2 = pa(cx, cy, r, -g0);
  const ring = gap ? `M${r2(p1[0])} ${r2(p1[1])}A${r} ${r} 0 1 0 ${r2(p2[0])} ${r2(p2[1])}` : circ(cx, cy, r);
  const e = pa(cx, cy, r - 3, 40),
    lb = pa(cx, cy, r + 16, 40),
    opp = pa(cx, cy, r - 3, 220);
  return (
    <Svg h={112} label={text}>
      <path d={ring} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
      <Axis a={[cx - r - 8, cy]} b={[cx + r + 8, cy]} />
      <Axis a={[cx, cy - r - 8]} b={[cx, cy + r + 8]} />
      {dia ? (
        <g>
          <Ln a={opp} b={lb} />
          <Ar x={e[0]} y={e[1]} dx={Math.cos((40 * Math.PI) / 180)} dy={-Math.sin((40 * Math.PI) / 180)} />
          <Ar x={opp[0]} y={opp[1]} dx={-Math.cos((40 * Math.PI) / 180)} dy={Math.sin((40 * Math.PI) / 180)} />
        </g>
      ) : (
        <g>
          <Ln a={[cx, cy]} b={lb} />
          <Ar x={e[0]} y={e[1]} dx={Math.cos((40 * Math.PI) / 180)} dy={-Math.sin((40 * Math.PI) / 180)} />
        </g>
      )}
      <Ln a={lb} b={[lb[0] + tw(text) + 3, lb[1]]} />
      <T x={lb[0] + 1.5} y={lb[1] - 2.5} a="start">
        {text}
      </T>
      {notes.map((s, i) => (
        <T key={i} x={150} y={70 + i * 13} a="start" o={0.85}>
          {s}
        </T>
      ))}
    </Svg>
  );
}

// ---------------- brúska na guľato: hriadeľ medzi hrotmi ----------------
export function ShaftDrawing({ d, tol, len, bL }) {
  const k = 240 / bL,
    x0 = 30,
    cy = 40,
    hd = 20,
    gx = x0 + ((bL - len) / 2) * k,
    gw = len * k;
  return (
    <Svg h={100} label={`Ø${d} ${tol}`}>
      <rect x={x0} y={cy - hd} width={240} height={2 * hd} {...body} />
      <rect x={r2(gx)} y={cy - hd} width={r2(gw)} height={2 * hd} fill="none" stroke="currentColor" strokeWidth="2.6" />
      {[
        [x0, 1],
        [x0 + 240, -1],
      ].map(([x, s], i) => (
        <path
          key={i}
          d={`M${x - s * 12} ${cy - 6}L${x + s * 4} ${cy}L${x - s * 12} ${cy + 6}`}
          fill="currentColor"
          fillOpacity="0.35"
          stroke="currentColor"
          strokeWidth="0.8"
        />
      ))}
      <Axis a={[10, cy]} b={[290, cy]} />
      <DimV y1={cy - hd} y2={cy + hd} x={150} text={`Ø${d} ${tol}`} ty={cy - hd / 2 + 3} />
      <DimH x1={gx} x2={gx + gw} y={cy + hd + 13} f1={cy + hd} text={`≥ ${len}`} />
      <DimH x1={x0} x2={x0 + 240} y={cy + hd + 28} f1={cy + hd} text={String(bL)} />
    </Svg>
  );
}

// ---------------- obrážačka: priečny rez hranolom 80 × 50 ----------------
export function ShaperDrawing({ kind }) {
  const k = 1.4,
    x0 = 76,
    y0 = 28,
    w = 80 * k,
    h = 50 * k,
    X = (mm) => x0 + mm * k,
    Y = (mm) => y0 + mm * k;
  const path =
    kind === 'rovina'
      ? `M${x0} ${Y(2)}H${X(80)}V${Y(50)}H${x0}Z`
      : kind === 'drazka'
        ? `M${x0} ${y0}H${X(35)}V${Y(5)}H${X(45)}V${y0}H${X(80)}V${Y(50)}H${x0}Z`
        : `M${x0} ${Y(10)}H${X(30)}V${y0}H${X(80)}V${Y(50)}H${x0}Z`;
  return (
    <Svg h={y0 + h + 26} label={kind}>
      <Cap x={10} y={12}>
        {L('rez', 'section')}
      </Cap>
      <path d={path} {...body} />
      {kind === 'rovina' && <Ln a={[x0, y0]} b={[X(80), y0]} dash="3 2" />}
      <DimH x1={x0} x2={x0 + w} y={y0 + h + 13} f1={y0 + h} text="80" />
      <DimV
        y1={kind === 'rovina' ? Y(2) : y0}
        y2={y0 + h}
        x={x0 + w + 9}
        f1={x0 + w}
        text={kind === 'rovina' ? '48' : '50'}
      />
      {kind === 'rovina' && (
        <DimV y1={y0} y2={Y(2)} x={x0 - 8} f1={x0} text={L('2 ±0,1', '2 ±0.1')} side="l" ty={y0 - 6} />
      )}
      {kind === 'drazka' && (
        <g>
          <DimH x1={X(35)} x2={X(45)} y={y0 - 10} f1={y0} text="10" />
          <DimV y1={y0} y2={Y(5)} x={X(35) - 8} f2={X(35)} text={L('5 ±0,15', '5 ±0.15')} side="l" ty={y0 - 7} />
        </g>
      )}
      {kind === 'osadenie' && (
        <g>
          <DimH x1={x0} x2={X(30)} y={y0 - 10} f1={Y(10)} f2={y0} text="30" />
          <DimV y1={y0} y2={Y(10)} x={x0 - 8} f1={X(30)} f2={x0} text={L('10 ±0,2', '10 ±0.2')} side="l" />
        </g>
      )}
    </Svg>
  );
}

// ---------------- zvislá obrážačka: náboj zhora ----------------
export function HubDrawing({ kind }) {
  const cx = 110,
    cy = 58,
    k = 0.9,
    R = 50 * k;
  let inner, dims;
  if (kind === 'drazka') {
    const r = 20 * k,
      h = 6 * k,
      d = 23.3 * k,
      s = Math.sqrt(r * r - h * h);
    inner = `M${r2(cx + s)} ${r2(cy - h)}H${r2(cx + d)}V${r2(cy + h)}H${r2(cx + s)}A${r2(r)} ${r2(r)} 0 1 1 ${r2(cx + s)} ${r2(cy - h)}z`;
    const bore = pa(cx, cy, r, 225);
    dims = (
      <g>
        <DimV y1={cy - h} y2={cy + h} x={cx + R + 14} f1={cx + d} text={L('12 ±0,25', '12 ±0.25')} />
        <Lead x={cx + d} y={cy - h + 2} x2={cx + R + 14} y2={22} text={L('t2 = 3,3 ±0,1', 't2 = 3.3 ±0.1')} />
        <Lead x={bore[0]} y={bore[1]} x2={46} y2={104} text="Ø40" a="l" />
      </g>
    );
  } else {
    const a = 12.5 * k;
    inner = `M${r2(cx - a)} ${r2(cy - a)}h${r2(2 * a)}v${r2(2 * a)}h${r2(-2 * a)}z`;
    dims = (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={r2(12 * k)}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeDasharray="2 2"
        />
        <DimV y1={cy - a} y2={cy + a} x={cx + R + 14} f1={cx + a} text={L('25 ±0,2', '25 ±0.2')} />
        <Lead
          x={cx + 12 * k * 0.7}
          y={cy + 12 * k * 0.7}
          x2={cx + R + 14}
          y2={100}
          text={L('predvŕtané Ø24', 'pre-bored Ø24')}
          dot
        />
      </g>
    );
  }
  const out = pa(cx, cy, R, 135);
  return (
    <Svg h={112} label={kind}>
      <path
        d={`${circ(cx, cy, R)} ${inner}`}
        fill="currentColor"
        fillOpacity="0.14"
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <Axis a={[cx - R - 8, cy]} b={[cx + R + 6, cy]} />
      <Axis a={[cx, cy - R - 6]} b={[cx, cy + R + 6]} />
      <Lead x={out[0]} y={out[1]} x2={46} y2={12} text="Ø100" a="l" />
      {dims}
    </Svg>
  );
}

// ---------------- CNC a elektroerózia: kapsa / dutina v strede bloku ----------------
// bx × by × bz = polotovar, px × py × depth = kapsa so stredom v strede hornej plochy (G54);
// kóty kapsy sú mimo bloku, tolerancia v poznámke (malá kapsa by inak nebola čitateľná)
export function PocketDrawing({ bx = 100, by = 80, bz = 40, px, py, depth, tol, label }) {
  const k = 0.8,
    x0 = 34,
    y0 = 34,
    w = bx * k,
    h = by * k,
    pw = px * k,
    ph = py * k;
  const pl = x0 + (w - pw) / 2,
    pt = y0 + (h - ph) / 2;
  const ex = 160,
    ey = 44,
    sh = bz * k,
    sd = Math.max(3, depth * k),
    sl = ex + (w - pw) / 2,
    sr = sl + pw;
  const num = (v) => String(v).replace('.', L(',', '.'));
  return (
    <Svg h={124} label={label || `${px} × ${py} × ${depth}`}>
      <Cap x={x0} y={12}>
        {L('pohľad zhora', 'top view')}
      </Cap>
      <Cap x={ex} y={12}>
        {L('rez', 'section')}
      </Cap>
      <rect x={x0} y={y0} width={r2(w)} height={r2(h)} {...body} />
      <rect
        x={r2(pl)}
        y={r2(pt)}
        width={r2(pw)}
        height={r2(ph)}
        rx={1.5}
        fill="var(--panel, #fff)"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <DimH x1={pl} x2={pl + pw} y={y0 - 8} f1={pt} text={num(px)} />
      <DimV y1={pt} y2={pt + ph} x={x0 - 8} f1={pl} text={num(py)} side="l" />
      <DimH x1={x0} x2={x0 + w} y={y0 + h + 13} f1={y0 + h} text={String(bx)} />
      <DimV y1={y0} y2={y0 + h} x={x0 + w + 9} f1={x0 + w} text={String(by)} />
      <path d={`M${ex} ${ey}H${r2(sl)}V${r2(ey + sd)}H${r2(sr)}V${ey}H${r2(ex + w)}V${r2(ey + sh)}H${ex}Z`} {...body} />
      <DimH x1={ex} x2={ex + w} y={ey + sh + 13} f1={ey + sh} text={String(bx)} />
      <DimV y1={ey} y2={ey + sh} x={ex + w + 9} f1={ex + w} text={String(bz)} />
      <DimV y1={ey} y2={ey + sd} x={sl - 7} f2={sl} text={num(depth)} side="l" ty={ey - 6} />
      {tol && (
        <T x={ex} y={118} a="start">
          {L(`kóty dutiny ±${num(tol)} mm`, `recess dimensions ±${num(tol)} mm`)}
        </T>
      )}
    </Svg>
  );
}

// pomocné prvky pre ďalšie výkresy (sketch2.jsx)
export { Svg, Cap, Ln, r2, body, bodyN, thin };
