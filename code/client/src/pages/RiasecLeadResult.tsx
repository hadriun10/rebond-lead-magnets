import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, RotateCcw } from "lucide-react";
import heroBg from "@assets/hero-bg-banner-1774607937452.jpg";
import SEO from "@/components/SEO";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { RiasecHexagon } from "@/components/RiasecHexagon";
import { capture } from "@/lib/posthog";
import { useAuth } from "@/hooks/useAuth";
import { LeadJobSearch } from "@/components/LeadJobSearch";
import { apiRequest } from "@/lib/queryClient";
import { LeadUnlockOverlay } from "@/components/LeadUnlockOverlay";
import { alternativeCodes, hexagonDistance, profileClarity, RIASEC_DIMENSIONS, RIASEC_ORDER, RIASEC_PROFILES, type RiasecDimension } from "@shared/riasec";
import {
  getRiasecLeadResult,
  RIASEC_LEAD_PATH,
  RIASEC_LEAD_PENDING_KEY,
  riasecResultPath,
  riasecUnlockUrl,
  RIASEC_LEAD_RESULT_ROUTE,
  setRiasecLeadResult,
  type RiasecLeadResult as Result,
} from "@/lib/riasecLeadJourney";

const CLARITY = {
  net: { title: "Un profil net", text: (first: string) => `Votre premier intérêt se détache clairement. Visez des postes où le ${first} est au cœur du travail, pas un simple bonus.` },
  nuance: { title: "Un profil nuancé", text: (_first: string) => "Votre premier intérêt mène, mais d'autres comptent presque autant. Un poste qui n'en nourrit qu'un risque de vous lasser : cherchez ceux qui en combinent deux." },
  polyvalent: { title: "Un profil polyvalent", text: (_first: string) => "Vos intérêts sont proches les uns des autres : vous pouvez vous plaire dans des métiers très différents. Choisissez plutôt sur l'équipe, l'ambiance et les conditions de travail." },
};

const CONSISTENCY: Record<1 | 2 | 3, { title: string; text: (a: string, b: string, example?: string) => string }> = {
  1: { title: "Deux moteurs qui vont ensemble", text: (a, b) => `Le ${a} et le ${b} sont voisins sur l'hexagone RIASEC : beaucoup de métiers réunissent les deux, votre piste est plus simple à trouver.` },
  2: { title: "Deux moteurs compatibles", text: (a, b) => `Le ${a} et le ${b} ne sont pas voisins, mais ils se combinent bien. Dans chaque fiche de poste, vérifiez qu'il y a de la place pour les deux.` },
  3: { title: "Deux moteurs opposés", text: (a, b, example) => `Le ${a} et le ${b} sont aux deux bouts de l'hexagone. C'est plus rare : cherchez un poste qui combine les deux${example ? `, par exemple ${example}` : ""}, sinon l'un des deux risque de vous manquer.` },
};

/** Exemples de métiers qui réunissent deux types opposés (clé : les deux types triés). */
const OPPOSITE_EXAMPLES: Record<string, string> = {
  "realistic-social": "formateur technique ou ergothérapeute",
  "enterprising-investigative": "consultant ou chef de produit",
  "artistic-conventional": "maquettiste ou documentaliste",
};

type Props = { onOpenLogin?: () => void; onOpenRegister?: () => void };

export default function RiasecLeadResult({ onOpenLogin, onOpenRegister }: Props) {
  const [, params] = useRoute<{ id: string }>(RIASEC_LEAD_RESULT_ROUTE);
  const id = params?.id ?? "";
  const [result, setResult] = useState<Result | null>(() => getRiasecLeadResult(id));
  const [error, setError] = useState("");

  useEffect(() => {
    if (result?.id === id) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/public/riasec-lead/${encodeURIComponent(id)}`, { credentials: "include", signal: controller.signal });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "");
        setRiasecLeadResult(body as Result);
        setResult(body as Result);
      } catch (cause: any) {
        if (!controller.signal.aborted) setError(cause?.message || "Ce résultat est momentanément indisponible. Rechargez la page dans quelques instants.");
      }
    })();
    return () => controller.abort();
  }, [id, result?.id]);

  useEffect(() => {
    if (result) capture("riasec_lead_result_viewed", { letters: result.report.letters, locked: Boolean(result.report.locked) });
  }, [result?.id]);

  // Déblocage : au retour de la connexion, le résultat est rattaché au compte puis affiché en entier.
  const { isAuthenticated: signedIn } = useAuth();
  useEffect(() => {
    if (!signedIn || !result?.report.locked) return;
    let pending = "";
    try { pending = sessionStorage.getItem(RIASEC_LEAD_PENDING_KEY) || ""; } catch { /* stockage indisponible */ }
    if (pending !== id) return;
    void (async () => {
      try {
        const response = await apiRequest(`/api/riasec-lead/${encodeURIComponent(id)}/claim`, { method: "POST" });
        const full = await response.json();
        setRiasecLeadResult(full);
        setResult(full);
        capture("riasec_lead_unlocked", { letters: full.report.letters });
        // Même événement que les analyses CV et LinkedIn : le compte est rattaché au résultat.
        capture("riasec_lead_account_created", { letters: full.report.letters, new_account: sessionStorage.getItem("signupPersonaPending") === "true" || new URLSearchParams(window.location.search).get("signupPersona") === "1" });
      } catch {
        capture("riasec_lead_claim_failed");
      } finally {
        try { sessionStorage.removeItem(RIASEC_LEAD_PENDING_KEY); } catch { /* ignoré */ }
      }
    })();
  }, [signedIn, result, id]);
  const startUnlock = (method: "linkedin" | "email") => {
    try { sessionStorage.setItem(RIASEC_LEAD_PENDING_KEY, id); } catch { /* ignoré */ }
    capture("riasec_lead_unlock_clicked", { method });
    if (method === "linkedin") window.location.href = riasecUnlockUrl(id);
    else onOpenRegister?.();
  };
  const scrollToUnlock = () => document.getElementById("lead-unlock")?.scrollIntoView({ behavior: "smooth", block: "center" });
  // Boutons de test (croix, « remettre le flou ») : uniquement dans l'aperçu local, jamais en ligne.
  const previewTools = import.meta.env.VITE_SALARY_PREVIEW_TOOLS === "1";

  const report = result?.report;
  const gated = Boolean(report?.locked);
  /** Chiffre ou mot clé réservé aux membres : remplacé par un faux contenu flouté. */
  const masked = (fake: string) => <span className="rlr-masked" aria-label="Réservé aux membres">{fake}</span>;
  const score = (dim: RiasecDimension) => gated ? masked("00") : String(report!.scores[dim]);
  const ranked = report ? [...RIASEC_ORDER].sort((a, b) => report.scores[b] - report.scores[a]) : [];
  const weakest = ranked.slice(-2).reverse() as RiasecDimension[];
  const clarity = report ? profileClarity(report.scores) : "nuance";
  const distance = report ? hexagonDistance(report.code[0], report.code[1]) : 1;
  const alternatives = report ? alternativeCodes(report.scores) : [];


  return (
    <div className="rlr-page">
      <SEO title="Votre profil RIASEC | Rebond" noindex languageOverride="fr" omitOgLocaleAlternate />
      <style>{`
        .rlr-page{--ink:#123d28;--deep:#082b1b;--green:#2d9326;--muted:#5d6f60;--line:#dbe3d5;--paper:#fbf8f1;background:var(--paper);color:var(--ink);min-height:100dvh;font-family:Figtree,sans-serif}
        .rlr-page *{box-sizing:border-box}
        .rlr-top{background:#0b3a13 center/cover no-repeat;margin-top:-85px;padding:140px 24px 60px;color:#fff}
        .rlr-top-inner{max-width:960px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:32px;align-items:center}
        .rlr-kicker{margin:0;font-size:18px;color:#cfe3c6}
        .rlr-letters{display:flex;gap:12px;margin:16px 0 0}
        .rlr-letters span{width:76px;height:88px;border-radius:18px;background:#fff;color:var(--deep);display:grid;place-items:center;font-size:46px;font-weight:700;animation:rlr-pop .5s cubic-bezier(.2,.8,.2,1) both}
        .rlr-letters span:nth-child(2){animation-delay:.25s}.rlr-letters span:nth-child(3){animation-delay:.5s}
        @keyframes rlr-pop{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
        .rlr-names{margin:14px 0 0;font-size:19px;font-weight:600;color:#fff}
        .rlr-summary{margin:16px 0 0;font-size:17px;line-height:1.6;color:#e3eedc;max-width:520px}
        .rlr-hex{display:flex;justify-content:center}
        .rlr-main{max-width:860px;margin:0 auto;padding:0 24px 100px}
        .rlr-block{margin-top:64px}
        .rlr-block h2{margin:0 0 18px;font-size:28px;letter-spacing:-.035em;color:var(--deep)}
        .rlr-drives{display:grid;gap:0;border-top:1px solid var(--line)}
        .rlr-drives div{display:grid;grid-template-columns:48px 1fr;gap:14px;padding:16px 0;border-bottom:1px solid var(--line)}
        .rlr-drives b{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--deep);color:#fff;font-size:22px}
        .rlr-drives strong{display:block;font-size:17px;color:var(--deep)}
        .rlr-drives p{margin:4px 0 0;color:var(--muted);line-height:1.55}
        .rlr-jobs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .rlr-jobs li{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column}
        .rlr-jobs strong{display:block;font-size:17px;color:var(--deep)}
        .rlr-jobs p{margin:8px 0 14px;font-size:15px;line-height:1.55;color:#405b47}
        .rlr-jobs .ljs{margin-top:auto;max-width:none}
        .rlr-jobs a{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;padding:11px 16px;border-radius:12px;background:var(--green);color:#fff;font-size:15px;font-weight:600;text-decoration:none;text-align:center;transition:background-color .15s}
        .rlr-jobs a:hover,.rlr-jobs>li>button:hover{background:#247a1f}
        .rlr-jobs>li>button{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;padding:11px 16px;border:0;border-radius:12px;background:var(--green);color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer}
        .rlr-main{position:relative}
        .rlr-masked{display:inline-block;filter:blur(7px);user-select:none;pointer-events:none}
        .rlr-jobs strong .rlr-masked{filter:blur(9px)}
        .rlr-test-tools{margin:28px 0 0;font-size:13px}.rlr-test-tools a{color:#a5432a;text-decoration:underline;text-underline-offset:3px}
        .rlr-jobs a:focus-visible{outline:2px solid var(--deep);outline-offset:2px}
        .rlr-reading{display:grid;gap:0;border-top:1px solid var(--line)}
        .rlr-reading div{padding:16px 0;border-bottom:1px solid var(--line)}
        .rlr-reading strong{display:block;font-size:17px;color:var(--deep)}
        .rlr-reading p{margin:4px 0 0;color:var(--muted);line-height:1.6}
        .rlr-profiles{display:grid;gap:18px}
        .rlr-profile{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px}
        .rlr-profile header,.rlr-env div{display:grid;grid-template-columns:48px 1fr;gap:14px;align-items:start}
        .rlr-profile header b,.rlr-env b{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--deep);color:#fff;font-size:22px}
        .rlr-env{display:grid;gap:22px}.rlr-env--low b{background:#e4ebdf;color:var(--deep)}.rlr-aside{margin:18px 0 0;font-size:14px;line-height:1.6;color:var(--muted)}
        .rlr-profile header strong,.rlr-env strong{display:block;font-size:17px;color:var(--deep)}
        .rlr-profile header p{margin:4px 0 0;color:var(--muted);line-height:1.55}.rlr-env p{margin:6px 0 0;font-size:16px;line-height:1.7;color:#405b47}
        .rlr-profile dl{display:grid;grid-template-columns:200px 1fr;gap:12px 20px;margin:20px 0 0;padding-top:18px;border-top:1px solid #edf1ea}
        .rlr-profile dt{font-size:14px;font-weight:600;color:var(--deep)}
        .rlr-profile dd{margin:0;font-size:15px;line-height:1.55;color:#405b47}
        .rlr-profile dd ul{margin:0;padding-left:18px;list-style:disc}
        .rlr-chips{display:flex;flex-wrap:wrap;gap:6px}
        .rlr-chips span{background:#eef4ea;border-radius:999px;padding:3px 10px;font-size:13px;color:var(--deep)}
        .rlr-list{margin:0;padding-left:20px;list-style:disc;display:grid;gap:10px}
        .rlr-list li{font-size:16px;line-height:1.6;color:#405b47}
        .rlr-bars{display:grid;gap:12px}
        .rlr-bar{display:grid;grid-template-columns:150px 1fr 44px;gap:12px;align-items:center;font-size:15px}
        .rlr-bar-track{height:10px;border-radius:999px;background:#e4ebdf;overflow:hidden}
        .rlr-bar-fill{height:100%;border-radius:inherit;background:#9fc792}
        .rlr-bar.top .rlr-bar-fill{background:var(--green)}
        .rlr-bar span:last-child{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
        .rlr-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 28px;margin-top:28px}
        .rlr-primary{background:var(--green);color:#fff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:600;display:inline-flex;align-items:center;gap:8px}
        .rlr-link{color:var(--ink);text-decoration:underline;text-underline-offset:3px;display:inline-flex;align-items:center;gap:6px;font-size:15px}
        .rlr-note{margin-top:24px;font-size:12px;line-height:1.6;color:#7b8c7e}
        @media(max-width:800px){.rlr-top-inner{grid-template-columns:1fr}.rlr-jobs{grid-template-columns:1fr}.rlr-profile dl{grid-template-columns:1fr;gap:4px}.rlr-profile dd{margin-bottom:10px}}
        @media(max-width:520px){.rlr-top{padding:110px 16px 40px}.rlr-main{padding:0 16px 60px}.rlr-letters span{width:62px;height:72px;font-size:38px}.rlr-bar{grid-template-columns:110px 1fr 36px;font-size:14px}}
        @media(prefers-reduced-motion:reduce){.rlr-letters span{animation:none}}
      `}</style>

      <MarketingNavbar onOpenRegister={onOpenRegister} onOpenLogin={onOpenLogin} />

      <header className="rlr-top" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="rlr-top-inner">
          {!report && !error && <p className="rlr-kicker" aria-live="polite">Ouverture de votre profil…</p>}
          {error && (
            <div role="alert">
              <p className="rlr-kicker">{error}</p>
              <p style={{ marginTop: 14 }}><Link className="rlr-link" href={RIASEC_LEAD_PATH} style={{ color: "#fff" }}><RotateCcw size={14} /> Repasser le test</Link></p>
            </div>
          )}
          {report && (
            <>
              <div>
                <p className="rlr-kicker">Votre code RIASEC</p>
                <div className="rlr-letters" data-testid="riasec-letters" aria-label={`Code ${report.letters}`}>
                  {report.code.map((dim) => <span key={dim}>{RIASEC_DIMENSIONS[dim].letter}</span>)}
                </div>
                <p className="rlr-names">{report.code.map((dim) => RIASEC_DIMENSIONS[dim].label).join(" · ")}</p>
                <p className="rlr-summary">{report.summary}</p>
              </div>
              <div className="rlr-hex"><RiasecHexagon scores={report.scores} highlight={report.code} animate dark size={340} /></div>
            </>
          )}
        </div>
      </header>

      {report && (
        <main id="main-content" className="rlr-main">
          {gated && (
            <LeadUnlockOverlay
              title="Débloquez votre résultat complet"
              detail="Les métiers qui vous ressemblent, vos scores et les mots-clés à mettre dans votre CV. Gratuit, et gardé dans votre espace Rebond."
              onLinkedin={() => startUnlock("linkedin")}
              onEmail={onOpenRegister ? () => startUnlock("email") : undefined}
              onTestUnblur={previewTools ? () => startUnlock("linkedin") : undefined}
            />
          )}
          <section className="rlr-block" aria-labelledby="rlr-scores">
            <h2 id="rlr-scores">Vos six scores</h2>
            <div className="rlr-bars">
              {ranked.map((dim) => (
                <div key={dim} className={`rlr-bar ${report.code.includes(dim) ? "top" : ""}`}>
                  <span>{RIASEC_DIMENSIONS[dim].label}</span>
                  <div className="rlr-bar-track"><div className="rlr-bar-fill" style={{ width: `${report.scores[dim]}%` }} /></div>
                  <span>{score(dim)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rlr-block" aria-labelledby="rlr-read">
            <h2 id="rlr-read">Ce que dit votre code</h2>
            <div className="rlr-reading">
              <div>
                <strong>{CLARITY[clarity].title}</strong>
                <p>{CLARITY[clarity].text(RIASEC_DIMENSIONS[report.code[0]].label.toLowerCase())}</p>
              </div>
              <div>
                <strong>{CONSISTENCY[distance].title}</strong>
                <p>{CONSISTENCY[distance].text(RIASEC_DIMENSIONS[report.code[0]].label.toLowerCase(), RIASEC_DIMENSIONS[report.code[1]].label.toLowerCase(), OPPOSITE_EXAMPLES[[report.code[0], report.code[1]].sort().join("-")])}</p>
              </div>
              {alternatives.length > 0 && (
                <div>
                  <strong>Codes à explorer aussi : {gated ? masked("ABC, DEF") : alternatives.join(", ")}</strong>
                  <p>Certaines de vos lettres sont presque à égalité : l'ordre pourrait s'inverser d'un jour à l'autre. Regardez aussi les métiers de ces codes voisins.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rlr-block" aria-labelledby="rlr-drives">
            <h2 id="rlr-drives">Vos trois moteurs, en détail</h2>
            <div className="rlr-profiles">
              {report.code.map((dim) => {
                const profile = RIASEC_PROFILES[dim];
                return (
                  <article key={dim} className="rlr-profile">
                    <header>
                      <b aria-hidden="true">{RIASEC_DIMENSIONS[dim].letter}</b>
                      <span><strong>{RIASEC_DIMENSIONS[dim].label} · {score(dim)}/100</strong><p>{RIASEC_DIMENSIONS[dim].drive}</p></span>
                    </header>
                    <dl>
                      <dt>Ce que vous aimez faire</dt><dd>{profile.activities}</dd>
                      <dt>Vos points forts</dt><dd><ul>{profile.strengths.map((item) => <li key={item}>{item}</li>)}</ul></dd>
                      <dt>Comment les autres vous voient</dt><dd>{profile.seenAs}</dd>
                      <dt>Ce qui vous épuise</dt><dd>{profile.drains}</dd>
                      <dt>Mots-clés pour votre CV</dt><dd className="rlr-chips">{profile.cvKeywords.map((word) => <span key={word} className={gated ? "rlr-masked" : undefined}>{gated ? "mot-clé métier" : word}</span>)}</dd>
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rlr-block" aria-labelledby="rlr-jobs">
            <h2 id="rlr-jobs">Des métiers qui vous ressemblent</h2>
            <ul className="rlr-jobs">
              {report.jobs.map((job) => (
                <li key={job.title || job.why}>
                  <strong>{gated ? masked("Métier à découvrir") : job.title}</strong>
                  <p>{job.why}</p>
                  {gated ? (
                    <button type="button" onClick={scrollToUnlock}>Découvrir ce métier <ArrowRight size={16} /></button>
                  ) : (
                    <LeadJobSearch
                      jobTitle={job.title}
                      label="Voir les offres de ce métier"
                      signedIn={signedIn || (previewTools && !gated)}
                      onLocked={scrollToUnlock}
                      onSearch={(withCity) => capture("riasec_lead_job_clicked", { letters: report.letters, with_city: withCity })}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rlr-block" aria-labelledby="rlr-env">
            <h2 id="rlr-env">Où vous vous sentirez bien</h2>
            <div className="rlr-env">
              {report.code.slice(0, 2).map((dim) => (
                <div key={dim}>
                  <b aria-hidden="true">{RIASEC_DIMENSIONS[dim].letter}</b>
                  <span><strong>{RIASEC_DIMENSIONS[dim].label} · {score(dim)}/100</strong><p>{RIASEC_PROFILES[dim].thrive}</p></span>
                </div>
              ))}
            </div>
          </section>

          <section className="rlr-block" aria-labelledby="rlr-least">
            <h2 id="rlr-least">Où vous risquez de ne pas vous sentir bien</h2>
            <div className="rlr-env rlr-env--low">
              {weakest.map((dim) => (
                <div key={dim}>
                  <b aria-hidden="true">{RIASEC_DIMENSIONS[dim].letter}</b>
                  <span><strong>{RIASEC_DIMENSIONS[dim].label} · {score(dim)}/100</strong><p>{RIASEC_PROFILES[dim].struggle}</p></span>
                </div>
              ))}
            </div>
            {report.flat && <p className="rlr-aside">Vos scores étant proches, ces écarts restent faibles : prenez ces mises en garde comme des points à vérifier, pas comme des interdits.</p>}
          </section>

          <section className="rlr-block" aria-label="Pour aller plus loin">
            <div className="rlr-actions">
              <Link className="rlr-primary" href="/analyse-cv">Vérifier mon CV avec ces mots-clés <ArrowRight size={16} /></Link>
              <Link className="rlr-link" href="/estimation-salaire">Savoir quel salaire demander <ArrowRight size={14} /></Link>
              <Link className="rlr-link" href={RIASEC_LEAD_PATH}><RotateCcw size={14} /> Repasser le test</Link>
            </div>
          </section>

          {previewTools && !gated && (
            <p className="rlr-test-tools"><a href={`/apercu/deconnexion?returnTo=${encodeURIComponent(riasecResultPath(id))}`}>Mode test : remettre le flou</a></p>
          )}
          <p className="rlr-note">
            Test d'intérêts professionnels RIASEC. Il décrit ce qui vous attire, pas vos compétences :
            utilisez-le comme une boussole, à croiser avec votre expérience.
          </p>
        </main>
      )}

      <MarketingFooter onOpenRegister={onOpenRegister} />
    </div>
  );
}
