import { Award, Briefcase, Building2, Check, Layers, Lock, Plus, Target, TrendingUp } from "lucide-react";
import { formatEuros, type SalaryLeadReport } from "@/lib/salaryLeadJourney";

/**
 * Les lectures du profil sur la page de résultat salaire : comment le salaire se
 * construit, les atouts prouvés par le CV, le parcours en valeur de marché, les
 * compétences qui paient. Tout vient du rapport calculé par le serveur.
 */

/** Chiffre réservé aux membres : un faux montant flouté, le vrai n'est pas dans la page. */
function Masked({ children = "+0 000 €" }: { children?: string }) {
  return <span className="sli-masked" aria-label="Chiffre réservé aux membres">{children}</span>;
}

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatEuros(Math.abs(value))}`;

const SEGMENT_COLORS = ["#c6dbbb", "#93c47f", "#5fae4c", "#2d9326", "#1d7517", "#125a10", "#0b430b"];

/**
 * Le salaire en une barre : chaque morceau est ce qu'un élément du parcours y apporte.
 * Les freins rognent la fin de la barre ; les atouts manquants la prolongent en pointillés.
 */
export function SalaryComposition({ build, drivers, masked = false }: { build: SalaryLeadReport["build"]; drivers: SalaryLeadReport["drivers"]; masked?: boolean }) {
  const total = build.find((step) => step.kind === "total")?.amount ?? 0;
  const parts = build.filter((step) => step.kind === "base" || step.kind === "up");
  const cuts = build.filter((step) => step.kind === "down");
  const positive = parts.reduce((sum, part) => sum + part.amount, 0);
  const cut = cuts.reduce((sum, part) => sum - part.amount, 0);
  // Aperçu : les gains des atouts ne sont pas envoyés, la part « manquante » garde une largeur indicative.
  const potential = masked
    ? (drivers.some((driver) => !driver.present) ? Math.round(total * 0.12) : 0)
    : drivers.filter((driver) => !driver.present).reduce((sum, driver) => sum + driver.gain, 0);
  // La base pèse souvent les trois quarts du salaire : on la tasse à un tiers de la barre (coupure visible)
  // pour que ce que le parcours ajoute reste lisible. Le reste garde ses proportions.
  const base = parts[0]?.amount ?? 0;
  const rest = Math.max(positive - base + potential, 1);
  const squeezed = base / Math.max(positive + potential, 1) > 0.4;
  const BASE_SHARE = 34;
  const width = (value: number, isBase = false) => squeezed
    ? (isBase ? BASE_SHARE : (value / rest) * (100 - BASE_SHARE))
    : (value / Math.max(positive + potential, 1)) * 100;
  const pct = (value: number, isBase = false) => `${width(value, isBase)}%`;
  return (
    <div className="sli-compo">
      <div className="sli-compo-head">
        <div><span>Votre salaire</span><strong>{masked ? <Masked>00 000 €</Masked> : formatEuros(total)}</strong></div>
        {potential > 0 && <div className="sli-compo-pot"><span>Avec vos atouts manquants</span><strong>jusqu'à {masked ? <Masked>00 000 €</Masked> : formatEuros(total + potential)}</strong></div>}
      </div>
      <div className="sli-compo-bar" role="img" aria-label={parts.map((part) => `${part.label} ${formatEuros(part.amount)}`).join(", ")}>
        {parts.map((part, index) => (
          <div key={part.label} className={`sli-seg ${index === 0 && squeezed ? "sli-seg-base" : ""}`} style={{ width: pct(part.amount, index === 0), background: SEGMENT_COLORS[Math.min(index, SEGMENT_COLORS.length - 1)] }}>
            {width(part.amount, index === 0) > 11 && (masked
              ? <Masked>{index === 0 ? "00 000 €" : "+0 000 €"}</Masked>
              : <span className={index < 2 ? "dark" : ""}>{index === 0 ? formatEuros(part.amount) : signed(part.amount)}</span>)}
          </div>
        ))}
        {potential > 0 && <div className="sli-seg sli-seg-pot" style={{ width: pct(potential) }}>{masked ? <Masked>+00 000 €</Masked> : <span className="dark">+{formatEuros(potential)}</span>}</div>}
        {cut > 0 && <div className="sli-seg-cut" style={{ right: pct(potential), width: pct(cut) }} title="Retiré par vos freins" />}
      </div>
      <ul className="sli-legend">
        {parts.map((part, index) => (
          <li key={part.label}>
            <i style={{ background: SEGMENT_COLORS[Math.min(index, SEGMENT_COLORS.length - 1)] }} aria-hidden="true" />
            <span><b>{part.label}</b>{part.kind === "base" ? part.detail.replace(/, en début de carrière, en région$/, " débutant, en région") : part.detail}</span>
            <strong>{masked ? <Masked>{part.kind === "base" ? "00 000 €" : "+0 000 €"}</Masked> : part.kind === "base" ? formatEuros(part.amount) : signed(part.amount)}</strong>
          </li>
        ))}
        {cuts.map((part) => (
          <li key={part.label} className="cut">
            <i aria-hidden="true" />
            <span><b>{part.label}</b>{part.detail}</span>
            <strong>{masked ? <Masked>−00 000 €</Masked> : signed(part.amount)}</strong>
          </li>
        ))}
        {potential > 0 && (
          <li className="pot">
            <i aria-hidden="true" />
            <span><b>Vos atouts manquants</b>Ce que vous ajouteriez en les rendant visibles</span>
            <strong>{masked ? <Masked>+00 000 €</Masked> : `+${formatEuros(potential)}`}</strong>
          </li>
        )}
      </ul>
    </div>
  );
}

type Driver = SalaryLeadReport["drivers"][number];

function DriverAmount({ driver, note, masked }: { driver: Driver; note: string; masked?: boolean }) {
  if (masked) return <strong><Masked>+00 000 €</Masked><small>{note.replace(/, soit \+\d+ %$/, "")}</small></strong>;
  if (driver.gain <= 0) return null;
  return <strong>{signed(driver.gain)}<small>{note}</small></strong>;
}

/**
 * Les atouts en trois groupes : trouvés dans le parcours, ajoutés par la personne, et ceux
 * que nous ne retrouvons pas. Ces derniers se cliquent : « je l'ai » recalcule l'estimation.
 */
export function SalaryDrivers({ drivers, claimed = [], onToggle, masked = false }: { drivers: Driver[]; claimed?: string[]; onToggle?: (key: string) => void; masked?: boolean }) {
  const found = drivers.filter((driver) => driver.present && !claimed.includes(driver.key));
  const declared = drivers.filter((driver) => claimed.includes(driver.key));
  const missing = drivers.filter((driver) => !driver.present && !claimed.includes(driver.key)).sort((a, b) => b.gain - a.gain);
  const counted = [...found, ...declared];
  return (
    <div className="sli-drivers-groups">
      {counted.length > 0 && (
        <>
          <div className="sli-group-head">
            <h3>Déjà comptés dans votre estimation <span>{counted.length}</span></h3>
            <p>Ce qui fait déjà monter votre fourchette, et ce que chacun vous rapporte.</p>
          </div>
          <ul className="sli-tiles">
            {found.map((driver) => (
              <li key={driver.key} className="on">
                <span className="sli-tile-mark" aria-hidden="true"><Check size={16} /></span>
                <b>{driver.label}</b>
                {driver.proof ? <q>{driver.proof}</q> : <span className="sli-tile-note">Repéré dans votre parcours</span>}
                <DriverAmount driver={driver} note="inclus dans votre fourchette" masked={masked} />
              </li>
            ))}
            {declared.map((driver) => (
              <li key={driver.key} className="mine">
                <span className="sli-tile-mark" aria-hidden="true"><Check size={16} /></span>
                <b>{driver.label}</b>
                <span className="sli-tile-note">Ajouté par vous</span>
                <DriverAmount driver={driver} note="inclus dans votre fourchette" masked={masked} />
                {onToggle && <button type="button" className="sli-tile-undo" onClick={() => onToggle(driver.key)}>Retirer</button>}
              </li>
            ))}
          </ul>
        </>
      )}
      {missing.length > 0 && (
        <>
          <div className="sli-group-head">
            <h3>Absents de votre parcours <span>{missing.length}</span></h3>
            <p>{onToggle
              ? "Vous en avez un que votre CV ou votre LinkedIn ne montre pas ? Cliquez sur « Je l'ai » : votre fourchette se recalcule."
              : "Ce que chacun vous rapporterait s'il apparaissait dans votre parcours."}</p>
          </div>
          <ul className="sli-tiles">
            {missing.map((driver) => {
              const body = (
                <>
                  <span className="sli-tile-mark" aria-hidden="true"><Plus size={16} /></span>
                  <b>{driver.label}</b>
                  <DriverAmount driver={driver} note={`possibles, soit +${driver.gainPct} %`} masked={masked} />
                  {onToggle && <em className="sli-tile-cta">Je l'ai</em>}
                </>
              );
              return (
                <li key={driver.key} className={`off ${onToggle ? "clickable" : ""}`}>
                  {onToggle
                    ? <button type="button" className="sli-tile-btn" onClick={() => onToggle(driver.key)} aria-label={`${driver.label} : je l'ai, l'ajouter à mon estimation`} data-testid={`salary-claim-${driver.key}`}>{body}</button>
                    : body}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

const PILLAR_ICONS: Record<string, typeof Target> = {
  role: Target, seniority: Award, scope: Layers, skills: TrendingUp, employers: Building2, proof: Briefcase,
};

function scoreTone(score: number) {
  return score >= 15 ? "good" : score >= 10 ? "mid" : "low";
}

/** Bloc de déblocage posé sur ce qui est flouté. */
export function SalaryUnlock({ onLinkedin, onEmail, title, detail = "Gratuit. Votre estimation est gardée dans votre espace Rebond." }: { onLinkedin: () => void; onEmail?: () => void; title: string; detail?: string }) {
  return (
    <div className="sli-unlock" role="group" aria-label="Débloquer l'analyse complète">
      <span className="sli-unlock-icon" aria-hidden="true"><Lock size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      <button type="button" className="sli-unlock-main" onClick={onLinkedin} data-testid="salary-unlock-linkedin">Débloquer gratuitement avec LinkedIn</button>
      {onEmail && <button type="button" className="sli-unlock-alt" onClick={onEmail}>Ou créer un compte avec mon e-mail</button>}
    </div>
  );
}

export function SalaryPillars({ pillars, masked = false }: { pillars: SalaryLeadReport["pillars"]; masked?: boolean }) {
  return (
    <div className="sli-pillars">
      {pillars.map((pillar) => {
        const Icon = PILLAR_ICONS[pillar.key] ?? Target;
        const tone = masked ? "mid" : scoreTone(pillar.score);
        return (
          <article key={pillar.key} className={`sli-pillar ${tone}`}>
            <header>
              <span className="sli-pillar-icon" aria-hidden="true"><Icon size={18} /></span>
              <h3>{pillar.label}</h3>
              {masked
                ? <span className="sli-pillar-score"><Masked>00</Masked><small>/20</small></span>
                : <span className="sli-pillar-score" aria-label={`${pillar.score} sur 20`}>{pillar.score}<small>/20</small></span>}
            </header>
            <div className={`sli-pillar-bar ${masked ? "sli-masked-bar" : ""}`} aria-hidden="true"><div style={{ width: masked ? "55%" : `${pillar.score * 5}%` }} /></div>
            <p>{pillar.finding}</p>
            <p className="sli-pillar-advice"><b>Pour progresser</b>{pillar.advice}</p>
          </article>
        );
      })}
    </div>
  );
}

export function SalaryTimeline({ timeline }: { timeline: SalaryLeadReport["timeline"] }) {
  if (timeline.length < 2) return null;
  const max = Math.max(...timeline.map((step) => step.value));
  const min = Math.min(...timeline.map((step) => step.value));
  const floor = Math.max(0, Math.floor(min * 0.75 / 1000) * 1000);
  return (
    <ol className="sli-timeline">
      {timeline.map((step, index) => {
        const delta = index ? step.value - timeline[index - 1].value : 0;
        return (
          <li key={`${step.title}-${step.period}`}>
            <div className="sli-time-head">
              <span className="sli-time-period">{step.period}</span>
              <b>{step.title}</b>
              {step.company && <span className="sli-time-company">{step.company}</span>}
            </div>
            <div className="sli-time-bar">
              <div style={{ width: `${((step.value - floor) / Math.max(max - floor, 1)) * 100}%` }} />
            </div>
            <div className="sli-time-value">
              <strong>{formatEuros(step.value)}</strong>
              {index > 0 && delta !== 0 && <small className={delta > 0 ? "up" : "down"}>{signed(delta)}</small>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function SalarySkills({ skills: raw }: { skills: SalaryLeadReport["skills"] }) {
  const skills = raw;
  if (!skills.paying.length && !skills.others.length) return null;
  return (
    <div className="sli-skills">
      {skills.paying.length > 0 && (
        <div>
          <p>Elles font monter votre salaire</p>
          <div className="sli-chips">{skills.paying.map((skill) => <span className="pay" key={skill}>{skill}</span>)}</div>
        </div>
      )}
      {skills.others.length > 0 && (
        <div>
          <p>Attendues dans votre métier, sans effet sur la fourchette</p>
          <div className="sli-chips">{skills.others.map((skill) => <span key={skill}>{skill}</span>)}</div>
        </div>
      )}
    </div>
  );
}

export const SALARY_INSIGHTS_CSS = `
  .sli-compo{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px}
  .sli-compo-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
  .sli-compo-head span{display:block;font-size:13px;color:var(--muted)}
  .sli-compo-head strong{font-size:30px;font-weight:800;letter-spacing:-.04em;color:var(--deep);font-variant-numeric:tabular-nums}
  .sli-compo-pot{text-align:right}.sli-compo-pot strong{font-size:20px;color:var(--green)}
  .sli-compo-bar{position:relative;display:flex;height:46px;border-radius:12px;overflow:hidden;background:#f1f4ee}
  .sli-seg{display:flex;align-items:center;justify-content:center;min-width:3px}
  .sli-seg span{font-size:12px;font-weight:700;color:#fff;white-space:nowrap;font-variant-numeric:tabular-nums}
  .sli-seg span.dark{color:var(--deep)}
  .sli-seg-pot{background:repeating-linear-gradient(135deg,#eef6e8 0 6px,#ffffff 6px 12px);outline:2px dashed #9fc792;outline-offset:-2px;border-radius:0 12px 12px 0}
  .sli-seg-cut{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(135deg,rgba(217,105,61,.85) 0 5px,rgba(217,105,61,.45) 5px 10px)}
  .sli-legend{list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px}
  .sli-legend li{display:grid;grid-template-columns:14px minmax(0,1fr) auto;gap:10px;align-items:start}
  .sli-legend i{width:14px;height:14px;border-radius:4px;margin-top:3px}
  .sli-legend li.cut i{background:#d9693d}
  .sli-legend li.pot i{background:repeating-linear-gradient(135deg,#d6e9cb 0 3px,#fff 3px 6px);outline:1.5px dashed #9fc792}
  .sli-legend b{display:block;font-size:14px;color:var(--deep)}
  .sli-legend span{font-size:13px;color:var(--muted);line-height:1.4}
  .sli-legend strong{font-size:14px;font-variant-numeric:tabular-nums;color:var(--deep);white-space:nowrap}
  .sli-legend li.cut strong{color:#c0562f}.sli-legend li.pot strong{color:var(--green)}

  .sli-tiles-count{margin:0 0 14px;font-size:15px;color:var(--muted)}
  .sli-group-head{margin:0 0 12px}
  .sli-group-head:not(:first-child){margin-top:30px}
  .sli-group-head h3{margin:0;font-size:18px;color:var(--deep);display:flex;align-items:center;gap:8px}
  .sli-group-head h3 span{font-size:13px;font-weight:700;background:#e9f4e1;color:var(--green);border-radius:999px;padding:1px 9px}
  .sli-group-head p{margin:4px 0 0;font-size:14px;color:var(--muted)}
  .sli-tile-note{font-size:13px;color:var(--muted)}
  .sli-tiles li.mine{background:#fff;border:1.5px solid var(--green)}
  .sli-tiles li.off.clickable{padding:0}
  .sli-tile-btn{display:flex;flex-direction:column;gap:6px;width:100%;height:100%;padding:16px;border:0;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer;border-radius:16px;transition:background-color .15s}
  .sli-tile-btn:hover{background:#f4faef}
  .sli-tile-btn:focus-visible{outline:3px solid #9fc792;outline-offset:2px}
  .sli-tile-btn > span:not(.sli-tile-mark){font-size:13px;color:var(--muted)}
  .sli-tile-cta{align-self:flex-start;margin-top:8px;font-style:normal;font-size:13px;font-weight:700;color:var(--green);border:1.5px solid var(--green);border-radius:999px;padding:4px 12px}
  .sli-tile-btn:hover .sli-tile-cta{background:var(--green);color:#fff}
  .sli-tile-undo{align-self:flex-start;margin-top:6px;background:none;border:0;padding:0;font:inherit;font-size:13px;color:var(--muted);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
  .sli-tiles-count strong{font-size:22px;color:var(--deep);margin-right:4px}
  .sli-tiles{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .sli-tiles li{display:flex;flex-direction:column;gap:6px;padding:16px;border-radius:16px;min-width:0}
  .sli-tiles li.on{background:#eaf6e2;border:1px solid #bfdcae}
  .sli-tiles li.off{background:transparent;border:1.5px dashed #c3d3bb}
  .sli-tile-mark{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--green);color:#fff;margin-bottom:4px}
  .sli-tiles li.off .sli-tile-mark{background:#fff;border:1.5px dashed #9fb49f;color:#7b8c7e}
  .sli-tiles b{font-size:15px;color:var(--deep)}
  .sli-tiles q{font-size:13px;color:#405b47;font-style:italic;line-height:1.4;quotes:"« " " »";display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .sli-tiles li > span:not(.sli-tile-mark){font-size:13px;color:var(--muted)}
  .sli-tiles strong{margin-top:auto;padding-top:8px;font-size:20px;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--green)}
  .sli-tiles li.off strong{color:var(--deep)}
  .sli-tiles small{display:block;font-size:12px;font-weight:500;letter-spacing:0;color:var(--muted)}

  .sli-timeline{list-style:none;margin:0;padding:0;display:grid;gap:0;border-left:2px solid var(--line);margin-left:6px}
  .sli-timeline li{position:relative;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) 112px;gap:16px;align-items:center;padding:14px 0 14px 22px}
  .sli-timeline li::before{content:"";position:absolute;left:-7px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:var(--paper);border:2px solid var(--green)}
  .sli-timeline li:last-child::before{background:var(--green)}
  .sli-time-period{display:block;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
  .sli-time-head b{display:block;font-size:15px;color:var(--deep)}
  .sli-time-company{display:block;font-size:13px;color:var(--muted)}
  .sli-time-bar{height:10px;border-radius:999px;background:#e4ebdf;overflow:hidden}
  .sli-time-bar div{height:100%;border-radius:inherit;background:#9fc792}
  .sli-timeline li:last-child .sli-time-bar div{background:var(--green)}
  .sli-time-value{text-align:right;font-variant-numeric:tabular-nums}
  .sli-time-value strong{display:block;color:var(--deep)}
  .sli-time-value small{font-size:12px;font-weight:600}
  .sli-time-value small.up{color:var(--green)}.sli-time-value small.down{color:#c0562f}

  .sli-pillars{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  .sli-pillar{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px}
  .sli-pillar header{display:flex;align-items:center;gap:10px}
  .sli-pillar h3{margin:0;flex:1;font-size:16px;color:var(--deep)}
  .sli-pillar-icon{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:#e9f4e1;color:var(--green);flex:0 0 auto}
  .sli-pillar-score{font-size:22px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--deep)}
  .sli-pillar-score small{font-size:13px;font-weight:600;color:var(--muted);margin-left:1px}
  .sli-pillar-bar{height:6px;border-radius:999px;background:#e8eee5;overflow:hidden}
  .sli-pillar-bar div{height:100%;border-radius:inherit;background:var(--green)}
  .sli-pillar.mid .sli-pillar-bar div{background:#d9a02b}.sli-pillar.mid .sli-pillar-icon{background:#fbf0d9;color:#a5730f}
  .sli-pillar.low .sli-pillar-bar div{background:#d9693d}.sli-pillar.low .sli-pillar-icon{background:#fbe6dc;color:#b04f27}
  .sli-pillar p{margin:0;font-size:14px;line-height:1.55;color:#405b47}
  .sli-pillar-advice{padding-top:10px;border-top:1px dashed var(--line)}
  .sli-pillar-advice b{display:block;font-size:12px;font-weight:700;color:var(--green);margin-bottom:2px}

  .sli-masked{display:inline-block;filter:blur(8px);user-select:none;pointer-events:none}
  .sli-compo-head .sli-masked{filter:blur(14px)}
  .sli-tiles strong .sli-masked{filter:blur(11px)}
  .sli-pillar-score .sli-masked{filter:blur(10px)}
  .sli-masked-bar{filter:blur(3px)}
  .sli-unlock{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 24px));display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px 22px;box-shadow:0 22px 50px rgba(8,43,27,.18)}
  .sli-unlock-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#e9f4e1;color:var(--green)}
  .sli-unlock strong{font-size:18px;color:var(--deep);line-height:1.3}
  .sli-unlock p{margin:0;font-size:13px;color:var(--muted)}
  .sli-unlock-main{margin-top:6px;width:100%;height:48px;border:0;border-radius:12px;background:var(--green);color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 7px 16px rgba(45,147,38,.2)}
  .sli-unlock-alt{background:none;border:0;padding:4px;font:inherit;font-size:13px;color:var(--ink);text-decoration:underline;text-underline-offset:3px;cursor:pointer}

  .sli-skills{display:grid;gap:18px}
  .sli-skills p{margin:0 0 8px;font-size:14px;color:var(--muted)}
  .sli-chips{display:flex;flex-wrap:wrap;gap:8px}
  .sli-chips span{border:1px solid #cfdcc6;border-radius:999px;padding:6px 12px;font-size:14px;color:#405b47;background:#fff}
  .sli-chips span.pay{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}

  @media(max-width:820px){.sli-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:640px){
    .sli-pillars{grid-template-columns:1fr}
    .sli-legend{grid-template-columns:1fr}
    .sli-compo{padding:16px}.sli-compo-pot{text-align:left}
    .sli-timeline li{grid-template-columns:minmax(0,1fr) 96px;gap:6px 12px}
    .sli-time-bar{grid-column:1 / -1;grid-row:2}
  }
`;
