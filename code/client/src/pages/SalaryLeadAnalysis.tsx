import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Check, FileUp, Linkedin, Loader2, Search, UserRound } from "lucide-react";
import SEO from "@/components/SEO";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { MarketingPageHero } from "@/components/MarketingPageHero";
import { Button } from "@/components/ui/button";
import { SalaryLeadScale } from "@/components/SalaryLeadScale";
import { capture } from "@/lib/posthog";
import {
  SALARY_ESTIMATE_CANONICAL,
  SALARY_ESTIMATE_DESCRIPTION,
  SALARY_ESTIMATE_FAQ_SCHEMA,
  SALARY_ESTIMATE_FAQS,
  SALARY_ESTIMATE_TITLE,
  SALARY_ESTIMATE_WEB_APPLICATION_SCHEMA,
} from "@shared/salaryEstimateSeo";
import {
  clearSalaryLeadResult,
  rangeBand,
  SALARY_LEAD_ERROR_KEY,
  SALARY_LEAD_LOADING_KEY,
  SALARY_LEAD_LOADING_PATH,
  SALARY_LEAD_PATH,
  setSalaryLeadResult,
  type SalaryLeadResult,
} from "@/lib/salaryLeadJourney";

/**
 * Lead magnet « Quel salaire puis-je prétendre ? ».
 * CV ou LinkedIn → écran d'attente → résultat complet (pas de floutage pour l'instant).
 */

const ACCEPTED = [".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_SIZE = 10 * 1024 * 1024;
let analysisInFlight = false;

type Props = { onOpenLogin?: () => void; onOpenRegister?: () => void; isAuthenticated?: boolean };
type Mode = "cv" | "linkedin";
type FindMode = "name" | "link";
type Found = { publicIdentifier: string; name: string; position: string; location: string; photo: string | null };
type SearchState = "idle" | "searching" | "results" | "empty" | "error";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function Avatar({ photo, name }: { photo: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) return <img className="sla-avatar" src={photo} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return <span className="sla-avatar sla-avatar-initials" aria-hidden="true">{initials(name) || <UserRound size={18} />}</span>;
}

const CHECKS = ["Gratuit", "CV non conservé"];

const INPUTS = [
  { title: "Votre métier", text: "Celui que vous exercez vraiment, lu dans vos intitulés et vos missions." },
  { title: "Vos années d'expérience", text: "Comptées poste par poste, chevauchements et stages retirés." },
  { title: "Votre région", text: "Environ 15 % de plus en Île-de-France, 5 % de plus dans les grandes métropoles." },
  { title: "Ce qui vous distingue", text: "Encadrement, compétences rares, grands groupes, international : de quoi viser le haut de la fourchette." },
];

function readError(): string {
  try { return sessionStorage.getItem(SALARY_LEAD_ERROR_KEY) || ""; } catch { return ""; }
}

export default function SalaryLeadAnalysis({ onOpenLogin, onOpenRegister, isAuthenticated = false }: Props) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("cv");
  const [profileUrl, setProfileUrl] = useState("");
  const [findMode, setFindMode] = useState<FindMode>("name");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [results, setResults] = useState<Found[]>([]);
  const [selected, setSelected] = useState<Found | null>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState(readError);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { capture("salary_lead_viewed"); }, []);

  const run = async (body: FormData | { profile: string }, source: Mode) => {
    if (analysisInFlight) return;
    analysisInFlight = true;
    setMessage("");
    clearSalaryLeadResult();
    sessionStorage.removeItem(SALARY_LEAD_ERROR_KEY);
    sessionStorage.setItem(SALARY_LEAD_LOADING_KEY, JSON.stringify({ startedAt: Date.now(), source }));
    capture("salary_lead_analysis_started", { source });
    const startedAt = performance.now();
    setLocation(SALARY_LEAD_LOADING_PATH);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 110_000);
    try {
      const response = await fetch("/api/public/salary-lead/analyze", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        ...(body instanceof FormData
          ? { body }
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(typeof payload.error === "string" ? payload.error : "") as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      const result = payload as SalaryLeadResult;
      setSalaryLeadResult(result);
      sessionStorage.removeItem(SALARY_LEAD_LOADING_KEY);
      const elapsed = performance.now() - startedAt;
      capture("salary_lead_analysis_succeeded", {
        source,
        range_band: result.unlocked ? rangeBand(result.report.range.min) : "locked",
        confidence: result.report.confidence,
        role_found: Boolean(result.report.role.key),
        elapsed_ms_band: elapsed < 20_000 ? "fast" : elapsed < 45_000 ? "normal" : "slow",
      });
      // L'écran d'attente affiche 100 % puis ouvre le résultat lui-même.
    } catch (error: any) {
      const status = typeof error?.status === "number" ? error.status : 0;
      const text = error?.name === "AbortError"
        ? "L’estimation prend plus de temps que prévu. Réessayez dans quelques instants."
        : status === 429 ? "Vous avez atteint la limite d’estimations gratuites pour aujourd’hui. Revenez demain."
        : error?.message || "Le service rencontre un contretemps. Réessayez dans quelques instants.";
      sessionStorage.removeItem(SALARY_LEAD_LOADING_KEY);
      sessionStorage.setItem(SALARY_LEAD_ERROR_KEY, text);
      setMessage(text);
      capture("salary_lead_analysis_failed", { source, http_status: status || undefined, error_type: error?.name === "AbortError" ? "timeout" : status ? "http" : "network" });
      setLocation(SALARY_LEAD_PATH, { replace: true });
    } finally {
      analysisInFlight = false;
      window.clearTimeout(timer);
    }
  };

  const search = async () => {
    if (!firstName.trim() || !lastName.trim() || searchState === "searching") return;
    setSearchState("searching");
    setSelected(null);
    setMessage("");
    capture("salary_lead_search_started");
    try {
      const response = await fetch("/api/public/salary-lead/search", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "");
      const profiles: Found[] = Array.isArray(body.profiles) ? body.profiles : [];
      setResults(profiles);
      setSearchState(profiles.length ? "results" : "empty");
      capture("salary_lead_search_succeeded", { result_count: profiles.length });
    } catch (error: any) {
      setSearchState("error");
      setMessage(error?.message || "La recherche n’a pas abouti. Collez l’adresse de votre profil, onglet « Par lien ».");
      capture("salary_lead_search_failed");
    }
  };

  const sendFile = (file: File) => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    if (!ACCEPTED.includes(extension)) {
      setMessage("Envoyez votre CV en PDF, Word ou photo (JPG, PNG).");
      return;
    }
    if (file.size > MAX_SIZE) {
      setMessage("Ce fichier dépasse 10 Mo. Exportez votre CV en PDF plus léger.");
      return;
    }
    const form = new FormData();
    form.append("cv", file);
    void run(form, "cv");
  };

  const scrollToTool = () => document.getElementById("sla-tool")?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="sla-page">
      <SEO
        title={SALARY_ESTIMATE_TITLE}
        description={SALARY_ESTIMATE_DESCRIPTION}
        canonical={SALARY_ESTIMATE_CANONICAL}
        schema={isAuthenticated ? undefined : [SALARY_ESTIMATE_FAQ_SCHEMA, SALARY_ESTIMATE_WEB_APPLICATION_SCHEMA]}
        suppressKeywords
        languageOverride="fr"
        omitOgLocaleAlternate
      />
      <style>{`
        .sla-page{--ink:#123d28;--deep:#082b1b;--green:#2d9326;--lime:#dff1c9;--paper:#fbf8f1;background:var(--paper);color:var(--ink);min-height:100dvh;font-family:Figtree,sans-serif}
        .sla-page *{box-sizing:border-box}
        .sla-main{position:relative;z-index:2;max-width:1120px;margin:0 auto;padding:0 24px 100px}
        .sla-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px 24px;align-items:stretch;margin-top:-116px}
        /* Le formulaire et l'exemple partagent la même ligne : ils finissent à la même hauteur. Les garanties passent dessous. */
        .sla-left{display:contents}
        .sla-tool{grid-column:1;grid-row:1}
        .sla-checks{grid-column:1;grid-row:2}
        .sla-example{grid-column:2;grid-row:1}
        .sla-tool{background:#fffdf8;border:1px solid #d8e1d0;border-radius:22px;padding:22px;box-shadow:0 20px 50px rgba(18,61,40,.1);display:flex;flex-direction:column;gap:16px}
        .sla-modes{display:flex;gap:8px;padding:4px;background:#eef3ea;border-radius:999px}
        .sla-modes button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;background:transparent;border-radius:999px;padding:10px 12px;font:inherit;font-size:14px;font-weight:600;color:#5d6f60;cursor:pointer}
        .sla-modes button.active{background:var(--green);color:#fff}
        .sla-drop{flex:1;min-height:210px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border:2px dashed #b9cdb0;border-radius:18px;background:#fff;padding:24px;text-align:center;cursor:pointer;transition:border-color .15s,background-color .15s}
        .sla-drop:hover,.sla-drop.drag{border-color:var(--green);background:#f4faef}
        .sla-drop strong{font-size:18px;color:var(--deep)}
        .sla-drop span{font-size:13px;color:#6b7d6e}
        .sla-drop svg{color:var(--green)}
        .sla-input{width:100%;border:1px solid #cfdac8;border-radius:12px;background:#fff;padding:13px 14px;font:inherit;font-size:15px;color:var(--ink)}
        .sla-input:focus{outline:none;border-color:var(--green);box-shadow:0 0 0 3px rgba(45,147,38,.15)}
        .sla-linkedin{flex:1;display:flex;flex-direction:column;gap:14px;min-height:210px}
        .sla-hint{margin:0;font-size:13px;color:#6b7d6e;line-height:1.5}
        .sla-find{display:flex;gap:18px;border-bottom:1px solid #e3e9de}
        .sla-find button{border:0;background:none;padding:6px 0 10px;font:inherit;font-size:14px;font-weight:600;color:#7b8c7e;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
        .sla-find button.active{color:var(--deep);border-bottom-color:var(--green)}
        .sla-search{display:grid;gap:12px;min-width:0}
        .sla-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .sla-results{background:#fff;border:1px solid #d6e0d0;border-radius:16px;overflow:hidden auto;max-height:300px;box-shadow:0 14px 34px rgba(18,61,40,.12)}
        .sla-results-head{margin:0;padding:9px 14px;font-size:12px;color:#6a7d6e;background:#f6f8f3;border-bottom:1px solid #e3e9de}
        .sla-option{display:flex;align-items:center;gap:12px;width:100%;min-width:0;text-align:left;background:#fff;border:0;border-bottom:1px solid #edf1ea;padding:11px 14px;cursor:pointer;font:inherit;color:inherit}
        .sla-option:last-child{border-bottom:0}.sla-option:hover,.sla-option:focus-visible{background:#f1f8eb;outline:none}
        .sla-option-text{display:flex;flex-direction:column;min-width:0;flex:1}
        .sla-option-text strong{font-size:14px;color:#191919;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sla-option-text em{font-size:12px;font-style:normal;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sla-option-text small{font-size:11px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sla-selected{display:flex;align-items:center;gap:12px;min-width:0;background:#f1f8eb;border:1px solid #a9ce9e;border-radius:14px;padding:12px 14px}
        .sla-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:0 0 auto}
        .sla-avatar-initials{display:grid;place-items:center;background:var(--lime);color:var(--green);font-weight:700;font-size:14px}
        .sla-change{background:none;border:0;padding:0;font:inherit;font-size:13px;color:var(--ink);text-decoration:underline;text-underline-offset:3px;cursor:pointer;flex:0 0 auto}
        @media(max-width:520px){.sla-fields{grid-template-columns:1fr}}
        .cvla-primary{background:var(--green)!important;color:#fff!important;border-color:var(--green)!important;box-shadow:0 7px 16px rgba(45,147,38,.2)}
        .sla-submit{width:100%;height:50px;font-size:16px}
        .sla-error{margin:0;color:#a5432a;font-size:14px;line-height:1.45}
        .sla-checks{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 16px;font-size:12px}
        .sla-checks span{display:inline-flex;align-items:center;gap:6px}.sla-checks svg{color:var(--green)}
        .sla-example{background:#fff;border:1px solid #dfe5dc;border-radius:22px;padding:28px;box-shadow:0 8px 24px rgba(18,61,40,.04);display:flex;flex-direction:column}
        .sla-example-who{margin:0;font-size:14px;color:#6b7d6e}
        .sla-example-amount{margin:10px 0 2px;font-size:clamp(34px,4vw,46px);font-weight:700;letter-spacing:-.04em;color:var(--deep);line-height:1}
        .sla-example-unit{margin:0;font-size:14px;color:#526a59}
        .sla-example ul{margin:6px 0 0;padding-left:18px;display:grid;gap:6px;font-size:13px;color:#526a59;line-height:1.45}
        .sla-example-caption{margin:auto 0 0;padding-top:18px;font-size:11px;color:#9aa29b;text-align:center}
        .sla-section{padding-top:90px}
        .sla-section h2{font-size:clamp(28px,3.6vw,40px);line-height:1.08;letter-spacing:-.045em;margin:0 0 26px;color:var(--deep);max-width:720px}
        .sla-inputs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 48px;max-width:900px}
        .sla-inputs b{display:block;font-size:17px;color:var(--deep);margin-bottom:6px}
        .sla-inputs p{margin:0;font-size:15px;line-height:1.55;color:#5d6f60}
        .sla-faq{display:grid;gap:0;max-width:820px;border-top:1px solid #dbe3d5}
        .sla-faq article{padding:20px 0;border-bottom:1px solid #dbe3d5}
        .sla-faq h3{margin:0 0 8px;font-size:17px}
        .sla-faq p{margin:0;line-height:1.65;color:#5d6f60}
        .sla-link{color:var(--ink);text-decoration:underline;text-underline-offset:3px;display:inline-flex;align-items:center;gap:6px;font-size:15px;background:none;border:0;padding:0;cursor:pointer;font-family:inherit}
        @media(max-width:1359px){.sla-hero{margin-top:-72px}}
        @media(max-width:900px){.sla-hero{grid-template-columns:1fr;margin-top:-66px}.sla-tool,.sla-checks,.sla-example{grid-column:1;grid-row:auto}.sla-inputs{grid-template-columns:1fr}.sla-section{padding-top:64px}}
        @media(max-width:520px){.sla-main{padding:0 16px 60px}.sla-hero{margin-top:-72px}.sla-tool,.sla-example{padding:18px}}
      `}</style>

      <MarketingNavbar onOpenRegister={onOpenRegister} onOpenLogin={onOpenLogin} />
      <MarketingPageHero
        maxWidth={1120}
        dense
        title="Quel salaire pouvez-vous demander ?"
        titleTestId="title-salary-estimate"
        subtitle="Déposez votre CV ou votre profil LinkedIn : en moins d'une minute, vous savez combien le marché paie un profil comme le vôtre, et sur quoi négocier."
      />

      <main id="main-content" className="sla-main">
        <section className="sla-hero" id="sla-tool" aria-label="Estimer mon salaire">
          <div className="sla-left">
            <div className="sla-tool">
              <div className="sla-modes" role="tablist" aria-label="Partir de mon CV ou de mon LinkedIn">
                <button type="button" role="tab" aria-selected={mode === "cv"} className={mode === "cv" ? "active" : ""} onClick={() => { setMode("cv"); setMessage(""); }}>
                  <FileUp size={16} aria-hidden="true" /> Mon CV
                </button>
                <button type="button" role="tab" aria-selected={mode === "linkedin"} className={mode === "linkedin" ? "active" : ""} onClick={() => { setMode("linkedin"); setMessage(""); }}>
                  <Linkedin size={16} aria-hidden="true" /> Mon LinkedIn
                </button>
              </div>

              {mode === "cv" ? (
                <div
                  className={`sla-drop ${dragging ? "drag" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) sendFile(file); }}
                  data-testid="salary-lead-drop"
                >
                  <FileUp size={30} aria-hidden="true" />
                  <strong>Déposez votre CV</strong>
                  <span>ou cliquez pour le choisir · PDF, Word ou photo, 10 Mo maximum</span>
                  <input
                    ref={inputRef}
                    type="file"
                    hidden
                    accept={ACCEPTED.join(",")}
                    onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) sendFile(file); }}
                    aria-label="Choisir mon CV"
                    data-testid="salary-lead-file"
                  />
                </div>
              ) : (
                <div className="sla-linkedin">
                  <div className="sla-find" role="tablist" aria-label="Retrouver mon profil">
                    <button type="button" role="tab" aria-selected={findMode === "name"} className={findMode === "name" ? "active" : ""} onClick={() => { setFindMode("name"); setMessage(""); }}>Par nom et prénom</button>
                    <button type="button" role="tab" aria-selected={findMode === "link"} className={findMode === "link" ? "active" : ""} onClick={() => { setFindMode("link"); setMessage(""); }}>Par lien</button>
                  </div>

                  {findMode === "name" && !selected && (
                    <form className="sla-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
                      <div className="sla-fields">
                        <input className="sla-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" aria-label="Prénom" autoComplete="given-name" maxLength={60} data-testid="salary-lead-first-name" />
                        <input className="sla-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" aria-label="Nom" autoComplete="family-name" maxLength={60} data-testid="salary-lead-last-name" />
                      </div>
                      <Button type="submit" className="cvla-primary sla-submit" disabled={!firstName.trim() || !lastName.trim() || searchState === "searching"} data-testid="salary-lead-search">
                        {searchState === "searching" ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
                        {searchState === "searching" ? "Recherche de votre profil…" : "Trouver mon profil"}
                      </Button>
                      {searchState === "results" && (
                        <div className="sla-results" role="listbox" aria-label="Profils trouvés">
                          <p className="sla-results-head">Lequel est le vôtre ? ({results.length} profil{results.length > 1 ? "s" : ""})</p>
                          {results.map((found, index) => (
                            <button
                              type="button"
                              role="option"
                              aria-selected={false}
                              key={found.publicIdentifier}
                              className="sla-option"
                              onClick={() => { setSelected(found); capture("salary_lead_profile_selected", { result_rank: index + 1, result_count: results.length }); }}
                              data-testid={`salary-lead-result-${found.publicIdentifier}`}
                            >
                              <Avatar photo={found.photo} name={found.name} />
                              <span className="sla-option-text">
                                <strong>{found.name}</strong>
                                {found.position && <em>{found.position}</em>}
                                {found.location && <small>{found.location}</small>}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchState === "empty" && <p className="sla-hint">Aucun profil public ne porte ce nom. Essayez avec l’adresse de votre profil, onglet « Par lien ».</p>}
                    </form>
                  )}

                  {findMode === "name" && selected && (
                    <div className="sla-search">
                      <div className="sla-selected" data-testid="salary-lead-selected">
                        <Avatar photo={selected.photo} name={selected.name} />
                        <span className="sla-option-text">
                          <strong>{selected.name}</strong>
                          {selected.position && <em>{selected.position}</em>}
                          {selected.location && <small>{selected.location}</small>}
                        </span>
                        <button type="button" className="sla-change" onClick={() => setSelected(null)}>Changer</button>
                      </div>
                      <Button className="cvla-primary sla-submit" onClick={() => void run({ profile: selected.publicIdentifier }, "linkedin")} data-testid="salary-lead-submit-selected">
                        Estimer le salaire de {selected.name.split(" ")[0]} <ArrowRight size={17} />
                      </Button>
                    </div>
                  )}

                  {findMode === "link" && (
                    <form className="sla-search" onSubmit={(event) => { event.preventDefault(); if (profileUrl.trim()) void run({ profile: profileUrl.trim() }, "linkedin"); }}>
                      <input
                        className="sla-input"
                        value={profileUrl}
                        onChange={(event) => setProfileUrl(event.target.value)}
                        placeholder="https://linkedin.com/in/votre-profil"
                        aria-label="Adresse de votre profil LinkedIn"
                        data-testid="salary-lead-url"
                      />
                      <Button type="submit" className="cvla-primary sla-submit" disabled={!profileUrl.trim()} data-testid="salary-lead-submit">
                        Estimer mon salaire <ArrowRight size={17} />
                      </Button>
                    </form>
                  )}
                  <p className="sla-hint">Nous lisons uniquement ce que votre profil affiche publiquement. Aucun mot de passe demandé.</p>
                </div>
              )}

              {message && <p className="sla-error" role="alert" data-testid="salary-lead-error">{message}</p>}
            </div>
            <div className="sla-checks">
              {CHECKS.map((check) => <span key={check}><Check size={15} aria-hidden="true" />{check}</span>)}
            </div>
          </div>

          <aside className="sla-example" aria-label="Exemple d’estimation">
            <p className="sla-example-who">Contrôleuse de gestion · 6 ans d’expérience · Lyon</p>
            <p className="sla-example-amount">50 – 54 k€</p>
            <p className="sla-example-unit">brut par an, soit environ 3 100 à 3 400 € net par mois</p>
            <SalaryLeadScale market={{ min: 43_000, max: 53_000 }} range={{ min: 50_000, max: 54_000 }} animate />
            <ul>
              <li>Portée par : expérience en grand groupe, Power BI</li>
              <li>Pour viser plus haut : écrire l’équipe que vous avez coordonnée</li>
            </ul>
            <p className="sla-example-caption">Exemple. Votre estimation remplace celle-ci.</p>
          </aside>
        </section>

        <section className="sla-section" aria-labelledby="sla-inputs-title">
          <h2 id="sla-inputs-title">Sur quels critères nous nous basons</h2>
          <div className="sla-inputs">
            {INPUTS.map((input) => <div key={input.title}><b>{input.title}</b><p>{input.text}</p></div>)}
          </div>
        </section>

        <section className="sla-section" aria-labelledby="sla-faq-title">
          <h2 id="sla-faq-title">Questions fréquentes sur l'estimation de salaire</h2>
          <div className="sla-faq">
            {SALARY_ESTIMATE_FAQS.map(({ question, answer }) => (
              <article key={question}><h3>{question}</h3><p>{answer}</p></article>
            ))}
          </div>
          <p style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 28 }}>
            <button type="button" className="sla-link" onClick={scrollToTool}>Estimer mon salaire <ArrowRight size={14} /></button>
            <Link className="sla-link" href="/analyse-cv">Analyser aussi mon CV <ArrowRight size={14} /></Link>
          </p>
        </section>
      </main>
      <MarketingFooter onOpenRegister={onOpenRegister} />
    </div>
  );
}
