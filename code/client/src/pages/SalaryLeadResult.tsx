import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import heroBg from "@assets/hero-bg-banner-1774607937452.jpg";
import SEO from "@/components/SEO";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { SalaryLeadScale } from "@/components/SalaryLeadScale";
import { SALARY_INSIGHTS_CSS, SalaryComposition, SalaryDrivers, SalaryPillars, SalaryUnlock } from "@/components/SalaryLeadInsights";
import { capture } from "@/lib/posthog";
import { useAuth } from "@/hooks/useAuth";
import { LeadJobSearch } from "@/components/LeadJobSearch";
import { apiRequest } from "@/lib/queryClient";
import { estimateSalary, jobSearchTitle, withClaimedDrivers } from "@shared/salaryLeadEngine";
import {
  formatEuros,
  getSalaryLeadResult,
  isLockedReport,
  SALARY_LEAD_PENDING_KEY,
  salaryResultPath,
  salaryUnlockUrl,
  rangeBand,
  SALARY_LEAD_PATH,
  SALARY_LEAD_RESULT_ROUTE,
  setSalaryLeadResult,
  type SalaryLeadResult,
} from "@/lib/salaryLeadJourney";

type Props = { onOpenLogin?: () => void; onOpenRegister?: () => void; isAuthenticated?: boolean };

const CONFIDENCE = {
  haute: "Estimation fiable",
  moyenne: "Estimation à affiner",
  faible: "Estimation approximative",
} as const;

export default function SalaryLeadResult({ onOpenLogin, onOpenRegister, isAuthenticated = false }: Props) {
  const [, params] = useRoute<{ id: string }>(SALARY_LEAD_RESULT_ROUTE);
  const id = params?.id ?? "";
  const [result, setResult] = useState<SalaryLeadResult | null>(() => getSalaryLeadResult(id));
  const [error, setError] = useState("");

  useEffect(() => {
    if (result?.id === id) return;
    const controller = new AbortController();
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/public/salary-lead/${encodeURIComponent(id)}`, { credentials: "include", signal: controller.signal });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "");
        setSalaryLeadResult(body as SalaryLeadResult);
        setResult(body as SalaryLeadResult);
      } catch (cause: any) {
        if (!controller.signal.aborted) setError(cause?.message || "Cette estimation est momentanément indisponible. Rechargez la page dans quelques instants.");
      }
    })();
    return () => controller.abort();
  }, [id, result?.id]);

  useEffect(() => {
    if (result) capture("salary_lead_result_viewed", { range_band: isLockedReport(result.report) ? "locked" : rangeBand(result.report.range.min), locked: isLockedReport(result.report), confidence: result.report.confidence, source: result.report.source });
  }, [result?.id]);

  // Déblocage : au retour de la connexion, l'estimation est rattachée au compte puis affichée en entier.
  const { isAuthenticated: signedIn } = useAuth();
  const [unlocking, setUnlocking] = useState(false);
  useEffect(() => {
    if (!signedIn || !result || !isLockedReport(result.report)) return;
    let pending = "";
    try { pending = sessionStorage.getItem(SALARY_LEAD_PENDING_KEY) || ""; } catch { /* stockage indisponible */ }
    if (pending !== id) return;
    setUnlocking(true);
    void (async () => {
      try {
        const response = await apiRequest(`/api/salary-lead/${encodeURIComponent(id)}/claim`, { method: "POST" });
        const full = await response.json();
        setSalaryLeadResult(full);
        setResult(full);
        capture("salary_lead_unlocked", { range_band: rangeBand(full.report.range.min) });
        // Même événement que les analyses CV et LinkedIn : le compte est rattaché au résultat.
        capture("salary_lead_account_created", { range_band: rangeBand(full.report.range.min), new_account: sessionStorage.getItem("signupPersonaPending") === "true" || new URLSearchParams(window.location.search).get("signupPersona") === "1" });
      } catch {
        capture("salary_lead_claim_failed");
      } finally {
        try { sessionStorage.removeItem(SALARY_LEAD_PENDING_KEY); } catch { /* ignoré */ }
        setUnlocking(false);
      }
    })();
  }, [signedIn, result, id]);
  const gated = Boolean(result && isLockedReport(result.report));
  // Boutons de test (croix, « remettre le flou ») : uniquement dans l'aperçu local, jamais en ligne.
  const previewTools = import.meta.env.VITE_SALARY_PREVIEW_TOOLS === "1";
  const startUnlock = (method: "linkedin" | "email") => {
    try { sessionStorage.setItem(SALARY_LEAD_PENDING_KEY, id); } catch { /* ignoré */ }
    capture("salary_lead_unlock_clicked", { method });
    if (method === "linkedin") window.location.href = salaryUnlockUrl(id);
    else onOpenRegister?.();
  };

  // Atouts que la personne déclare avoir : l'estimation se recalcule dans le navigateur.
  const [claimed, setClaimed] = useState<string[]>([]);
  useEffect(() => setClaimed([]), [id]);
  const original = result?.report;
  const report = useMemo(() => {
    if (!original || !claimed.length || isLockedReport(original) || !original.profile) return original;
    return estimateSalary(withClaimedDrivers(original.profile, claimed), original.source);
  }, [original, claimed]);
  const toggleClaim = (key: string) => {
    setClaimed((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      capture("salary_lead_driver_claimed", { driver: key, added: !current.includes(key), claimed_count: next.length });
      return next;
    });
  };

  return (
    <div className="slr-page">
      <SEO title="Votre estimation de salaire | Rebond" noindex languageOverride="fr" omitOgLocaleAlternate />
      <style>{`
        .slr-page{--ink:#123d28;--deep:#082b1b;--green:#2d9326;--muted:#5d6f60;--line:#dbe3d5;--paper:#fbf8f1;background:var(--paper);color:var(--ink);min-height:100dvh;font-family:Figtree,sans-serif}
        .slr-page *{box-sizing:border-box}
        .slr-top{background:#0b3a13 center/cover no-repeat;margin-top:-85px;padding:140px 24px 0}
        .slr-top-inner{max-width:860px;margin:0 auto}
        .slr-main{max-width:860px;margin:0 auto;padding:0 24px 100px}
        .slr-hello{margin:0;font-size:18px;color:var(--muted)}
        .slr-top .slr-hello{color:#cfe3c6}
        .slr-amount{margin:8px 0 0;font-size:clamp(38px,7vw,76px);line-height:1.05;font-weight:700;letter-spacing:-.05em;color:#fff}
        .slr-amount span{white-space:nowrap}
        .slr-unit{margin:12px 0 0;font-size:17px;color:#e3eedc;line-height:1.5}
        .slr-claimed{margin:12px 0 0;display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:14px;color:#0b3a13;background:#dff1d6;border-radius:12px;padding:8px 14px}
        .slr-claimed button{background:none;border:0;padding:0;font:inherit;font-size:13px;color:#0b3a13;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
        .slr-caveat{margin:8px 0 0;max-width:640px;font-size:13px;line-height:1.5;color:#b9d2b1}
        .slr-detail{position:relative}
        /* Au chargement, l'encart se pose sous la barre « Vous / Marché » ; dès qu'on fait défiler,
           il se cale vers le milieu de l'écran et y reste jusqu'à la fin de l'analyse. */
        .slr-overlay{position:sticky;top:calc(50vh - 200px);height:0;z-index:40;display:flex;justify-content:center}
        .slr-overlay-card{position:relative;top:40px;width:min(460px,100%)}
        @media(max-width:520px){.slr-overlay{top:calc(50vh - 220px)}}
        .slr-overlay-card .sli-unlock{position:relative;left:auto;top:auto;transform:none;width:100%}
        .slr-scale-masked .sls-ends span,.slr-scale-masked .sls-you-label{filter:blur(7px)}
        /* Le flou se règle sur la taille du texte : 6 px laissent lire un chiffre de 70 px. */
        .slr-amount .sli-masked{filter:blur(24px)}
        .slr-unit .sli-masked{filter:blur(9px)}
        .slr-gate-close{position:absolute;z-index:4;top:-14px;right:-14px;width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--deep);display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 14px rgba(8,43,27,.15)}
        .slr-test-tools{margin:28px 0 0;font-size:13px}.slr-test-tools a{color:#a5432a;text-decoration:underline;text-underline-offset:3px}
        .slr-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
        .slr-chips span{border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:6px 12px;font-size:13px;color:#e3eedc}
        .slr-chips .slr-confidence{border-color:transparent;background:#57c84d;color:#082b1b;font-weight:600}
        .slr-scale{position:relative;top:44px;margin-top:-16px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:4px 24px 14px;box-shadow:0 18px 40px rgba(8,43,27,.14)}
        .slr-after{padding-top:44px}
        .slr-block{margin-top:56px}
        .slr-block h2{margin:0 0 16px;font-size:26px;letter-spacing:-.035em;color:var(--deep)}
        .slr-block p{margin:0 0 12px;font-size:16px;line-height:1.65;color:#405b47}
        .slr-factors{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
        .slr-factors li{display:grid;grid-template-columns:28px 1fr;gap:10px;padding:14px 0;border-bottom:1px solid var(--line)}
        .slr-factors b{display:block;font-size:16px;color:var(--deep)}
        .slr-factors span{font-size:14px;color:var(--muted);line-height:1.5}
        .slr-up{color:var(--green)}.slr-down{color:#c0562f}
        .slr-levers{margin:0;padding:0;list-style:none;display:grid;gap:18px;counter-reset:lever}
        .slr-levers li{position:relative;padding-left:44px;counter-increment:lever}
        .slr-levers li::before{content:counter(lever);position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;background:var(--deep);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:700}
        .slr-levers b{display:block;font-size:16px;color:var(--deep);margin-bottom:4px}
        .slr-lever-gain{margin-left:10px;font-style:normal;font-size:14px;font-weight:700;color:var(--green);background:#e9f4e1;border-radius:999px;padding:2px 9px;white-space:nowrap;font-variant-numeric:tabular-nums}
        .slr-levers span{font-size:15px;color:var(--muted);line-height:1.55}
        .slr-actions{display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:56px;padding-top:24px;border-top:1px solid var(--line)}
        .slr-link{color:var(--ink);text-decoration:underline;text-underline-offset:3px;display:inline-flex;align-items:center;gap:6px;font-size:15px}
        .slr-actions .ljs{margin:0 auto}
        .slr-primary{background:var(--green);color:#fff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:600;display:inline-flex;align-items:center;gap:8px}
        .slr-method{margin-top:28px;font-size:12px;line-height:1.6;color:#7b8c7e}
        .slr-empty{background:#fff;border:1px solid var(--line);border-radius:20px;padding:28px}
        .slr-block .slr-sub{margin:-8px 0 18px;color:var(--muted);font-size:15px;max-width:62ch}
        ${SALARY_INSIGHTS_CSS}
        @media(max-width:520px){.slr-top{padding:110px 16px 0}.slr-main{padding:0 16px 60px}.slr-scale{padding:2px 14px 10px}}
      `}</style>

      {!isAuthenticated && <MarketingNavbar onOpenRegister={onOpenRegister} onOpenLogin={onOpenLogin} />}

      <header className="slr-top" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="slr-top-inner">
          {!report && !error && <p className="slr-hello" aria-live="polite" style={{ paddingBottom: 60 }}>Ouverture de votre estimation…</p>}
          {report && (
            <section aria-labelledby="slr-title">
              <p className="slr-hello" id="slr-title">Selon nos estimations, vous valez environ</p>
              {gated ? (
                <>
                  <p className="slr-amount" data-testid="salary-lead-range" aria-label="Fourchette réservée aux membres"><span className="sli-masked">00 000 €</span> – <span className="sli-masked">00 000 €</span></p>
                  <p className="slr-unit">
                    brut par an, soit environ <strong><span className="sli-masked">0 000 €</span> à <span className="sli-masked">0 000 €</span> net par mois</strong>
                    {" "}(<span className="sli-masked">0 000 €</span> à <span className="sli-masked">0 000 €</span> brut).
                  </p>
                </>
              ) : (
                <>
                  <p className="slr-amount" data-testid="salary-lead-range"><span>{formatEuros(report.range.min)}</span> – <span>{formatEuros(report.range.max)}</span></p>
                  <p className="slr-unit">
                    brut par an, soit environ <strong>{formatEuros(report.monthly.netMin)} à {formatEuros(report.monthly.netMax)} net par mois</strong>
                    {" "}({formatEuros(report.monthly.grossMin)} à {formatEuros(report.monthly.grossMax)} brut).
                  </p>
                </>
              )}
              <p className="slr-caveat">
                C'est une estimation, et elle peut se tromper : elle part de ce que montre votre parcours et des moyennes du marché.
                Le salaire réel dépend aussi de l'entreprise, du poste exact et de votre négociation.
              </p>
              {claimed.length > 0 && original && (
                <p className="slr-claimed">
                  Avec {claimed.length === 1 ? "l'atout" : `les ${claimed.length} atouts`} que vous avez ajouté{claimed.length > 1 ? "s" : ""} · estimation de départ : {formatEuros(original.range.min)} – {formatEuros(original.range.max)}
                  <button type="button" onClick={() => setClaimed([])}>Revenir à l'estimation de départ</button>
                </p>
              )}
              <div className="slr-chips">
                <span>{report.role.label}</span>
                <span>{report.level.label} · {report.level.yearsXp} an{report.level.yearsXp > 1 ? "s" : ""} d’expérience</span>
                <span>{report.region.location || report.region.label}</span>
                <span className="slr-confidence">{CONFIDENCE[report.confidence]}</span>
              </div>
              <div className={`slr-scale ${gated ? "slr-scale-masked" : ""}`}>
                {gated
                  ? <SalaryLeadScale market={{ min: 44_000, max: 56_000 }} range={{ min: 50_000, max: 55_000 }} />
                  : <SalaryLeadScale market={report.market} range={report.range} animate />}
              </div>
            </section>
          )}
        </div>
      </header>

      <main id="main-content" className="slr-main slr-after">

        {error && (
          <section className="slr-empty" role="alert" style={{ marginTop: 40 }}>
            <p style={{ margin: 0 }}>{error}</p>
            <p style={{ margin: "14px 0 0" }}><Link className="slr-link" href={SALARY_LEAD_PATH}><RotateCcw size={14} /> Refaire mon estimation</Link></p>
          </section>
        )}

        {report && (
          <>
            <div className="slr-detail">
            {gated && (
              <div className="slr-overlay" id="slr-unlock">
                <div className="slr-overlay-card">
                  {previewTools && (
                    <button type="button" className="slr-gate-close" onClick={() => startUnlock("linkedin")} aria-label="Retirer le flou (mode test)" title="Retirer le flou (mode test)">
                      <X size={18} />
                    </button>
                  )}
                  <SalaryUnlock
                    title={unlocking ? "Ouverture de votre analyse complète…" : "Débloquez tous les chiffres de votre estimation"}
                    detail="Votre fourchette, ce que vous rapporte chaque atout, vos notes et vos gains possibles. Gratuit, et gardé dans votre espace Rebond."
                    onLinkedin={() => startUnlock("linkedin")}
                    onEmail={onOpenRegister ? () => startUnlock("email") : undefined}
                  />
                </div>
              </div>
            )}

            <section className="slr-block" aria-labelledby="slr-build">
              <h2 id="slr-build">Comment calculons-nous ce salaire ?</h2>
              <p className="slr-sub">Chaque morceau de la barre, c'est ce qu'un élément de votre parcours vous rapporte.</p>
              <SalaryComposition build={report.build} drivers={report.drivers} masked={gated} />
              {report.explanation.slice(2).map((line) => <p key={line} style={{ marginTop: 14 }}>{line}</p>)}
            </section>

            <section className="slr-block" aria-labelledby="slr-drivers">
              <h2 id="slr-drivers">Vos atouts</h2>
              <SalaryDrivers drivers={report.drivers} claimed={claimed} masked={gated} onToggle={original && !isLockedReport(original) && original.profile ? toggleClaim : () => document.getElementById("slr-unlock")?.scrollIntoView({ behavior: "smooth", block: "center" })} />
            </section>

            {report.pillars?.length > 0 && (
              <section className="slr-block" aria-labelledby="slr-pillars">
                <h2 id="slr-pillars">Analyse détaillée pilier par pilier</h2>
                <p className="slr-sub">Ce qu'un recruteur regarde pour fixer votre salaire, noté sur 20, avec quoi faire pour progresser.</p>
                <SalaryPillars pillars={report.pillars} masked={gated} />
              </section>
            )}

            {report.levers.length > 0 && (
              <section className="slr-block" aria-labelledby="slr-levers">
                <h2 id="slr-levers">Pour être mieux payé au prochain poste</h2>
                <ol className="slr-levers">
                  {report.levers.map((lever) => (
                    <li key={lever.title}>
                      <b>
                        {lever.title}
                        {gated
                          ? <em className="slr-lever-gain sli-masked" aria-label="Montant réservé aux membres">+0 000 €</em>
                          : lever.gain ? <em className="slr-lever-gain">+{formatEuros(lever.gain)}</em> : null}
                      </b>
                      <span>{lever.detail}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            </div>

            {previewTools && !gated && (
              <p className="slr-test-tools"><a href={`/apercu/deconnexion?returnTo=${encodeURIComponent(salaryResultPath(id))}`}>Mode test : remettre le flou</a></p>
            )}
            <div className="slr-actions">
              <LeadJobSearch
                jobTitle={jobSearchTitle(report.role)}
                signedIn={signedIn || (previewTools && !gated)}
                onLocked={() => document.getElementById("slr-unlock")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                onSearch={(withCity) => capture("salary_lead_job_search_clicked", { range_band: gated ? "locked" : rangeBand(report.range.min), with_city: withCity })}
              />
              <Link className="slr-link" href={SALARY_LEAD_PATH}><RotateCcw size={14} /> Refaire une estimation</Link>
            </div>

            <p className="slr-method">
              Salaire fixe brut annuel en CDI, hors primes, variable et intéressement. Fourchette calculée à partir de notre grille par métier,
              niveau d’expérience et région ; votre parcours vous place ensuite dans cette fourchette. Le net est une approximation.
              {report.frequentBonuses ? " Dans votre métier, les primes s’ajoutent souvent à ce fixe." : ""}
            </p>
          </>
        )}
      </main>

      {!isAuthenticated && <MarketingFooter onOpenRegister={onOpenRegister} />}
    </div>
  );
}
