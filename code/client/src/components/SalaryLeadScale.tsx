import { formatK } from "@/lib/salaryLeadJourney";

/**
 * La fourchette du marché, avec la part qui revient à la personne. Même visuel
 * dans l'exemple de la landing et dans le résultat.
 */
export function SalaryLeadScale({
  market,
  range,
  animate = false,
}: {
  market: { min: number; max: number };
  range: { min: number; max: number };
  animate?: boolean;
}) {
  // Un profil rare peut dépasser le haut du marché : l'échelle couvre les deux.
  const low = Math.min(market.min, range.min);
  const high = Math.max(market.max, range.max);
  const span = Math.max(high - low, 1);
  const left = ((range.min - low) / span) * 100;
  const width = ((range.max - range.min) / span) * 100;
  const marketLeft = ((market.min - low) / span) * 100;
  const marketWidth = ((market.max - market.min) / span) * 100;
  return (
    <div className={`sls ${animate ? "sls-animate" : ""}`}>
      <style>{`
        .sls{position:relative;padding:34px 0 26px}
        .sls-track{position:relative;height:14px;border-radius:999px;background:#f1f4ee}
        .sls-market{position:absolute;top:0;bottom:0;border-radius:999px;background:repeating-linear-gradient(90deg,#d9e4d2 0 2px,#e9efe4 2px 10px)}
        .sls-you{position:absolute;top:-6px;height:26px;border-radius:999px;background:#2d9326;box-shadow:0 6px 16px rgba(45,147,38,.28)}
        .sls-animate .sls-you{animation:sls-grow 1.1s cubic-bezier(.2,.8,.2,1) both}
        @keyframes sls-grow{from{transform:scaleX(.08);opacity:.2}to{transform:scaleX(1);opacity:1}}
        .sls-you-label{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap;font-size:12px;font-weight:700;color:#2d9326}
        .sls-ends{display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#6b7d6e}
        @media(prefers-reduced-motion:reduce){.sls-animate .sls-you{animation:none}}
      `}</style>
      <span className="sls-you-label" style={{ left: `${left + width / 2}%` }}>Vous</span>
      <div className="sls-track" role="img" aria-label={`Marché de ${formatK(market.min)} à ${formatK(market.max)} ; votre fourchette de ${formatK(range.min)} à ${formatK(range.max)}`}>
        <div className="sls-market" style={{ left: `${marketLeft}%`, width: `${marketWidth}%` }} />
        <div className="sls-you" style={{ left: `${left}%`, width: `${Math.max(width, 6)}%`, transformOrigin: "center" }} />
      </div>
      <div className="sls-ends" aria-hidden="true">
        <span>{formatK(low)}</span>
        <span>Marché : {formatK(market.min)} – {formatK(market.max)}</span>
        <span>{formatK(high)}</span>
      </div>
    </div>
  );
}
