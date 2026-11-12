import { RIASEC_DIMENSIONS, RIASEC_ORDER, type RiasecDimension } from "@shared/riasec";

/**
 * L'hexagone de Holland : les six types dans leur ordre officiel, chaque sommet
 * tiré vers l'extérieur selon le score. Même visuel sur la landing et le résultat.
 */
export function RiasecHexagon({
  scores,
  highlight = [],
  animate = false,
  size = 320,
  dark = false,
}: {
  scores: Record<RiasecDimension, number>;
  highlight?: RiasecDimension[];
  animate?: boolean;
  size?: number;
  dark?: boolean;
}) {
  const center = 150;
  const radius = 104;
  const point = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio] as const;
  };
  const ink = dark ? "#e3eedc" : "#123d28";
  const grid = dark ? "rgba(255,255,255,.18)" : "#dce5d9";
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} className={`rhex ${animate ? "rhex-animate" : ""}`} role="img"
      aria-label={RIASEC_ORDER.map((dim) => `${RIASEC_DIMENSIONS[dim].label} ${scores[dim]} sur 100`).join(", ")}>
      <style>{`
        .rhex{max-width:100%;height:auto;overflow:visible}
        .rhex-animate .rhex-shape{transform-origin:150px 150px;animation:rhex-grow 1.2s cubic-bezier(.2,.8,.2,1) both}
        @keyframes rhex-grow{from{transform:scale(.05);opacity:.2}to{transform:scale(1);opacity:1}}
        @media(prefers-reduced-motion:reduce){.rhex-animate .rhex-shape{animation:none}}
      `}</style>
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon key={level} points={RIASEC_ORDER.map((_, i) => point(i, level).join(",")).join(" ")} fill="none" stroke={grid} strokeWidth={1} />
      ))}
      {RIASEC_ORDER.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke={grid} strokeWidth={1} />;
      })}
      <polygon
        className="rhex-shape"
        points={RIASEC_ORDER.map((dim, i) => point(i, Math.max(0.04, scores[dim] / 100)).join(",")).join(" ")}
        fill="#57c84d"
        fillOpacity={dark ? 0.55 : 0.35}
        stroke="#2d9326"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {RIASEC_ORDER.map((dim, i) => {
        const [x, y] = point(i, 1.24);
        const strong = highlight.includes(dim);
        return (
          <g key={dim}>
            <text x={x} y={y - 6} textAnchor="middle" fontSize={strong ? 22 : 18} fontWeight={700} fill={strong ? (dark ? "#57c84d" : "#2d9326") : ink}>{RIASEC_DIMENSIONS[dim].letter}</text>
            <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill={ink} opacity={0.8}>{RIASEC_DIMENSIONS[dim].label}</text>
          </g>
        );
      })}
    </svg>
  );
}
