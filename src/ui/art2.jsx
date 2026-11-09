// Ilustrácie kariet menu pre nové klasické stroje (rovnaký štýl ako art.jsx: 320 × 180, currentColor).
const Svg = ({ children }) => (
  <svg
    viewBox="0 0 320 180"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
    <path d="M20 160h280" fill="none" />
  </svg>
);

// univerzálna konzolová frézka: stojan, previsnuté rameno s podperou, tŕň s kotúčovou frézou, konzola so stolom
export function FguArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="40" y="40" width="56" height="120" rx="4" />
        <rect x="40" y="26" width="200" height="16" rx="3" />
        <rect x="96" y="104" width="120" height="44" rx="3" />
        <rect x="84" y="94" width="160" height="10" rx="2" />
      </g>
      <rect x="214" y="42" width="14" height="34" fillOpacity=".3" />
      <path d="M96 70h132" fill="none" strokeWidth="4" />
      <circle cx="160" cy="70" r="16" fillOpacity=".35" />
      <rect x="140" y="80" width="40" height="14" fillOpacity=".5" />
      <circle cx="232" cy="99" r="7" fill="none" />
    </Svg>
  );
}

// nástrojárska frézka: stojan s natáčacou zvislou hlavou a uhlovým stolom na čele
export function FnkArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="60" y="48" width="70" height="112" rx="4" />
        <rect x="56" y="30" width="150" height="20" rx="3" />
        <rect x="130" y="96" width="110" height="12" rx="2" />
        <rect x="140" y="108" width="50" height="40" rx="3" />
      </g>
      <g transform="rotate(-20 200 52)">
        <rect x="188" y="50" width="26" height="40" rx="3" fillOpacity=".3" />
        <path d="M201 90v14" fill="none" strokeWidth="4" />
      </g>
      <rect x="150" y="80" width="40" height="16" fillOpacity=".5" />
      <circle cx="200" cy="52" r="10" fill="none" />
    </Svg>
  );
}

// karuselový sústruh: veľká upínacia doska, dva stojany s priečnikom a suportmi
export function KaruselArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="40" y="30" width="26" height="130" rx="3" />
        <rect x="254" y="30" width="26" height="130" rx="3" />
        <rect x="40" y="22" width="240" height="12" rx="2" />
        <rect x="66" y="66" width="188" height="16" rx="2" />
        <rect x="60" y="140" width="200" height="20" rx="3" />
      </g>
      <ellipse cx="160" cy="134" rx="96" ry="12" fillOpacity=".35" />
      <rect x="110" y="110" width="100" height="22" rx="3" fillOpacity=".5" />
      <path d="M120 82v26M200 82v18" fill="none" strokeWidth="5" />
    </Svg>
  );
}

// hrotový sústruh SV 18: vreteník, lôžko, suport, koník
export function SvArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="30" y="56" width="66" height="70" rx="4" />
        <rect x="30" y="126" width="260" height="16" rx="2" />
        <rect x="34" y="142" width="40" height="18" />
        <rect x="246" y="142" width="40" height="18" />
        <rect x="236" y="84" width="40" height="42" rx="3" />
      </g>
      <rect x="96" y="80" width="12" height="28" fillOpacity=".4" />
      <path d="M108 94h120" fill="none" strokeWidth="6" />
      <rect x="150" y="100" width="40" height="26" rx="2" fillOpacity=".4" />
      <path d="M170 100l8-10" fill="none" strokeWidth="3" />
    </Svg>
  );
}

// nástrojárska brúska: kotúčová brúska na stĺpe, stôl s držiakom nástroja
export function ToolGrinderArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="70" y="110" width="180" height="50" rx="4" />
        <rect x="140" y="40" width="40" height="70" rx="3" />
        <rect x="60" y="100" width="200" height="10" rx="2" />
      </g>
      <circle cx="160" cy="64" r="22" fillOpacity=".25" />
      <path d="M200 84l30 14" fill="none" strokeWidth="5" />
      <rect x="226" y="88" width="20" height="12" rx="2" fillOpacity=".5" />
    </Svg>
  );
}

// bezhrotová brúska: dva kotúče (brúsny a podávací) a podpera obrobku medzi nimi
export function CenterlessArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="40" y="110" width="240" height="50" rx="4" />
        <rect x="56" y="40" width="80" height="70" rx="4" />
        <rect x="186" y="56" width="78" height="54" rx="4" />
      </g>
      <circle cx="104" cy="78" r="32" fillOpacity=".3" />
      <circle cx="222" cy="84" r="22" fillOpacity=".3" />
      <rect x="152" y="96" width="16" height="16" fillOpacity=".5" />
      <circle cx="160" cy="88" r="8" />
    </Svg>
  );
}

// obrážačka ozubenia: stojan s vreteníkom nožového kolesa a stôl s obrobkom
export function GearShaperArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="40" y="30" width="90" height="130" rx="4" />
        <rect x="130" y="40" width="70" height="40" rx="3" />
        <rect x="150" y="120" width="110" height="40" rx="3" />
      </g>
      <path d="M170 80v28" fill="none" strokeWidth="6" />
      <ellipse cx="170" cy="112" rx="14" ry="5" fillOpacity=".5" />
      <ellipse cx="210" cy="116" rx="38" ry="8" fill="none" strokeDasharray="4 3" />
    </Svg>
  );
}

// dvojkotúčová stojanová brúska: stojan, motor, dva kotúče s krytmi a štítmi
export function BenchGrinderArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="140" y="90" width="40" height="70" />
        <rect x="120" y="60" width="80" height="34" rx="14" />
      </g>
      <circle cx="90" cy="74" r="28" fillOpacity=".3" />
      <circle cx="230" cy="74" r="28" fillOpacity=".3" />
      <path d="M62 60a30 30 0 0 1 56 0M202 60a30 30 0 0 1 56 0" fill="none" strokeWidth="5" />
      <path d="M70 104h40M210 104h40" fill="none" strokeWidth="4" />
    </Svg>
  );
}

// vodorovná pásová píla: podstavec, zverák, sklopné rameno s pásom
export function HBandSawArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="50" y="110" width="220" height="50" rx="3" />
        <rect x="60" y="56" width="200" height="30" rx="14" />
      </g>
      <path d="M80 86l160 0" fill="none" strokeWidth="2" strokeDasharray="5 3" />
      <rect x="120" y="94" width="18" height="16" fillOpacity=".5" />
      <rect x="182" y="94" width="18" height="16" fillOpacity=".5" />
      <path d="M40 102h240" fill="none" strokeWidth="5" />
      <path d="M260 70l18 30" fill="none" strokeWidth="4" />
    </Svg>
  );
}

// ohýbačka rúr: ohýbací segment, prídržka a ohnutá rúra
export function PipeBenderArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="70" y="120" width="180" height="40" rx="3" />
      </g>
      <circle cx="170" cy="90" r="34" fillOpacity=".25" />
      <path d="M40 56h130a34 34 0 0 1 34 34v60" fill="none" strokeWidth="9" strokeOpacity=".45" />
      <rect x="98" y="48" width="40" height="16" rx="2" fillOpacity=".5" />
      <path d="M170 90l70-46" fill="none" strokeWidth="6" />
    </Svg>
  );
}

// kovací buchar: dva stojany s baranom nad nákovou a výhňa
export function HammerArt() {
  return (
    <Svg>
      <g fillOpacity=".16">
        <rect x="100" y="20" width="120" height="40" rx="4" />
        <rect x="104" y="60" width="22" height="100" />
        <rect x="194" y="60" width="22" height="100" />
        <rect x="132" y="128" width="56" height="32" />
      </g>
      <rect x="138" y="70" width="44" height="30" rx="2" fillOpacity=".45" />
      <rect x="140" y="116" width="40" height="12" fill="#ff8a1f" fillOpacity=".7" stroke="none" />
      <rect x="250" y="120" width="44" height="40" rx="3" fillOpacity=".2" />
      <path d="M258 120c6-14 22-14 28 0" fill="#ff8a1f" fillOpacity=".5" stroke="none" />
    </Svg>
  );
}
