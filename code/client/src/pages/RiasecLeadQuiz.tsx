import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import rebondLogo from "@assets/rebond-logo-h96.webp";
import SEO from "@/components/SEO";
import { RiasecHexagon } from "@/components/RiasecHexagon";
import { JobsDemo, ProfileDemo, QuestionDemo, RIASEC_INTRO_CSS } from "@/components/RiasecLeadIntro";
import { capture } from "@/lib/posthog";
import { RIASEC_OPTIONS, RIASEC_QUESTIONS, scoreRiasec, shuffledQuestions, type RiasecAnswers } from "@shared/riasec";
import {
  clearRiasecProgress,
  readRiasecProgress,
  RIASEC_LEAD_PATH,
  riasecResultPath,
  setRiasecLeadResult,
  writeRiasecProgress,
  type RiasecLeadResult,
} from "@/lib/riasecLeadJourney";

const TOTAL = RIASEC_QUESTIONS.length;
const ADVANCE_MS = 260;

/** Le tutoriel avant la première question : un écran par étape, chacun avec sa démo animée. */
const TUTORIAL = [
  { title: "Vous répondez à 48 questions", text: "Dites si chaque activité vous plaît. Aucune bonne réponse : suivez votre instinct.", Demo: QuestionDemo },
  { title: "Nous établissons votre profil", text: "Vos réponses dessinent vos six scores et votre code à 3 lettres.", Demo: ProfileDemo },
  { title: "Vous découvrez les métiers qui vous correspondent et pouvez y postuler en 1 clic", text: "Votre profil s'affiche dès la dernière question. Votre compte débloque ensuite vos métiers et les offres qui recrutent.", Demo: JobsDemo },
] as const;

/** Une question par écran. Les réponses restent dans l'onglet jusqu'au calcul. */
export default function RiasecLeadQuiz() {
  const [, setLocation] = useLocation();
  const initial = useMemo(() => readRiasecProgress() ?? { seed: Math.floor(Math.random() * 2 ** 31) + 1, answers: {}, index: 0 }, []);
  const questions = useMemo(() => shuffledQuestions(initial.seed), [initial.seed]);
  const [answers, setAnswers] = useState<RiasecAnswers>(initial.answers);
  const [index, setIndex] = useState(Math.min(initial.index, TOTAL - 1));
  const [picked, setPicked] = useState<number | null>(null);
  // Un test déjà entamé reprend directement aux questions ; sinon on prépare d'abord la personne.
  const [phase, setPhase] = useState<"time" | "later" | "how" | "quiz" | "computing" | "error">(Object.keys(initial.answers).length ? "quiz" : "time");
  const [error, setError] = useState("");
  const [tutorial, setTutorial] = useState(0);
  const timer = useRef<number | null>(null);
  const halfwaySent = useRef(false);

  useEffect(() => { writeRiasecProgress({ seed: initial.seed, answers, index }); }, [answers, index, initial.seed]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const question = questions[index];
  const answered = Object.keys(answers).length;
  const current = answers[question.order];

  const submit = useCallback(async (final: RiasecAnswers) => {
    setPhase("computing");
    setError("");
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/public/riasec-lead/result", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: final }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "");
      const result = body as RiasecLeadResult;
      // L'animation de calcul dure au moins 2,5 s : le résultat ne tombe pas comme un couperet.
      const wait = Math.max(0, 2500 - (performance.now() - startedAt));
      window.setTimeout(() => {
        setRiasecLeadResult(result);
        clearRiasecProgress();
        capture("riasec_lead_completed", { letters: result.report.letters, flat: result.report.flat, ai_written: result.report.aiWritten });
        setLocation(riasecResultPath(result.id), { replace: true });
      }, wait);
    } catch (cause: any) {
      setPhase("error");
      setError(cause?.message || "Le calcul de votre profil n’a pas abouti. Vos réponses sont gardées : réessayez.");
      capture("riasec_lead_failed");
    }
  }, [setLocation]);

  const choose = (value: number) => {
    if (picked !== null || phase !== "quiz") return;
    const next = { ...answers, [question.order]: value };
    setPicked(value);
    setAnswers(next);
    if (!halfwaySent.current && Object.keys(next).length === TOTAL / 2) {
      halfwaySent.current = true;
      capture("riasec_lead_halfway");
    }
    timer.current = window.setTimeout(() => {
      setPicked(null);
      const firstMissing = questions.findIndex((q) => !next[q.order]);
      if (firstMissing === -1) void submit(next);
      else setIndex(index + 1 < TOTAL && !next[questions[index + 1].order] ? index + 1 : firstMissing);
    }, ADVANCE_MS);
  };

  // Touches 1 à 5 pour répondre, flèche gauche pour revenir.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (phase === "time" && (event.key === "1" || event.key === "2")) return intro(event.key === "1" ? "how" : "later");
      if (phase !== "quiz") return;
      const value = Number(event.key);
      if (value >= 1 && value <= 5) choose(value);
      if (event.key === "ArrowLeft" && index > 0) setIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const intro = (step: "time" | "later" | "how") => {
    capture("riasec_lead_intro", { step });
    setPhase(step);
    window.scrollTo({ top: 0 });
  };

  const progress = Math.round((answered / TOTAL) * 100);
  const liveScores = scoreRiasec(answers);

  return (
    <main className={`rlq-page ${phase === "time" || phase === "later" || phase === "how" ? "rlq-page--intro" : ""}`}>
      <SEO title="Test RIASEC en cours" noindex />
      <style>{`
        .rlq-page{--ink:#123d28;--deep:#082b1b;--green:#2d9326;--line:#dbe3d5;min-height:100dvh;background:#fbf8f1;color:var(--ink);font-family:Figtree,sans-serif;display:flex;flex-direction:column}
        .rlq-page *{box-sizing:border-box}
        .rlq-bar{display:flex;align-items:center;gap:16px;max-width:760px;width:100%;margin:0 auto;padding:20px 24px 0}
        .rlq-track{flex:1;height:8px;border-radius:999px;background:#e4ebdf;overflow:hidden}
        .rlq-fill{height:100%;background:var(--green);border-radius:inherit;transition:width .3s ease}
        .rlq-count{font-size:14px;font-variant-numeric:tabular-nums;color:#526a59;min-width:52px;text-align:right}
        .rlq-icon{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer}
        .rlq-icon:disabled{opacity:.35;cursor:default}
        .rlq-logo{display:block;height:32px;width:auto;margin:22px auto 0}
        .rlq-num{margin:0 0 10px;font-size:15px;font-weight:600;color:var(--green)}
        .rlq-body{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:640px;width:100%;margin:0 auto;padding:40px 24px 60px;text-align:center}
        .rlq-question{margin:0 0 36px;font-size:clamp(26px,4vw,38px);line-height:1.15;letter-spacing:-.035em;color:var(--deep);min-height:2.3em;display:flex;align-items:center;justify-content:center;animation:rlq-in .3s ease both}
        @keyframes rlq-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .rlq-options{display:grid;gap:10px}
        .rlq-option{display:flex;align-items:center;gap:14px;width:100%;padding:16px 18px;border:1.5px solid var(--line);border-radius:14px;background:#fff;font:inherit;font-size:17px;color:var(--ink);text-align:left;cursor:pointer;transition:border-color .12s,background-color .12s,transform .12s}
        @media(hover:hover){.rlq-option:hover{border-color:#9fc792;background:#f6fbf2}}
        .rlq-option.on{border-color:var(--green);background:#eaf6e2;transform:scale(1.01)}
        .rlq-key{width:28px;height:28px;flex:0 0 auto;border-radius:8px;display:grid;place-items:center;background:#eef3ea;font-size:13px;font-weight:700;color:#526a59}
        .rlq-option.on .rlq-key{background:var(--green);color:#fff}
        .rlq-hint{margin-top:22px;font-size:13px;color:#8a998c}
        .rlq-done{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center}
        .rlq-done h1{margin:14px 0 8px;font-size:30px;letter-spacing:-.04em;color:var(--deep)}
        .rlq-done p{margin:0;color:#526a59;font-size:17px}
        .rlq-retry{margin-top:20px;height:50px;padding:0 24px;border:0;border-radius:14px;background:var(--green);color:#fff;font:inherit;font-size:16px;font-weight:600;cursor:pointer}
        .rlq-error{margin-top:14px;color:#a5432a}
        .rlq-intro{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;max-width:620px;width:100%;margin:0 auto;padding:12px 24px 24px;text-align:center;animation:rlq-in .3s ease both}
        .rlq-intro h1{margin:0 0 8px;font-size:clamp(24px,3.4vw,34px);line-height:1.12;letter-spacing:-.04em;color:var(--deep)}
        .rlq-sub{margin:0 auto 20px;max-width:520px;font-size:16px;line-height:1.5;color:#526a59}
        .rlq-cta{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:440px;height:54px;margin-top:20px;border:0;border-radius:16px;background:var(--green);color:#fff;font:inherit;font-size:18px;font-weight:700;cursor:pointer;text-decoration:none;box-shadow:0 10px 24px rgba(45,147,38,.28)}
        .rlq-dots{flex:1;display:flex;justify-content:center;gap:8px}
        .rlq-dots span{width:8px;height:8px;border-radius:999px;background:var(--line);transition:width .3s ease,background-color .3s}
        .rlq-dots span.on{width:26px;background:var(--green)}
        .rlq-intro .rlq-step-num{margin:0 0 6px;font-size:14px;font-weight:600;color:var(--green)}
        .rlq-page--intro{height:100dvh;min-height:0}
        .rlq-page--intro .rlq-logo{height:26px;margin-top:10px}
        .rlq-page--intro .rli-card{margin-bottom:0}
        @media(max-height:700px){.rlq-page--intro .rlq-logo{display:none}.rlq-intro{padding-top:6px}}
        @media(prefers-reduced-motion:reduce){.rlq-intro{animation:none}}
        ${RIASEC_INTRO_CSS}
        @media(max-width:520px){.rlq-intro{padding:8px 16px 16px}.rlq-sub{font-size:15px;margin-bottom:16px}}
        @media(prefers-reduced-motion:reduce){.rlq-question{animation:none}.rlq-fill,.rlq-option{transition:none}}
        @media(max-width:520px){.rlq-body{padding:28px 16px 40px;justify-content:flex-start}.rlq-question{margin-bottom:26px}.rlq-option{padding:14px 14px;font-size:16px}.rlq-hint{display:none}}
      `}</style>

      {(phase === "time" || phase === "later" || phase === "how") && (
        <>
          <div className="rlq-bar">
            <button
              type="button"
              className="rlq-icon"
              disabled={phase === "time"}
              onClick={() => (phase === "how" && tutorial ? setTutorial(tutorial - 1) : setPhase("time"))}
              aria-label="Retour"
            ><ArrowLeft size={18} /></button>
            <div className="rlq-dots" aria-hidden="true">
              {phase === "how" && TUTORIAL.map((step, i) => <span key={step.title} className={i === tutorial ? "on" : ""} />)}
            </div>
            <Link className="rlq-icon" href={RIASEC_LEAD_PATH} aria-label="Quitter le test"><X size={18} /></Link>
          </div>
          <img className="rlq-logo" src={rebondLogo} alt="Rebond" width={132} height={32} />

          {phase === "time" && (
            <section className="rlq-intro" key="time">
              <h1>Avez-vous 10 minutes devant vous ?</h1>
              <p className="rlq-sub">Votre profil sera plus juste si vous répondez d'une traite, au calme.</p>
              <div className="rlq-options" style={{ maxWidth: 520, margin: "0 auto" }}>
                <button type="button" className="rlq-option" onClick={() => { setTutorial(0); intro("how"); }} data-testid="riasec-intro-yes"><span className="rlq-key" aria-hidden="true">1</span>Oui, j'ai 10 minutes</button>
                <button type="button" className="rlq-option" onClick={() => intro("later")} data-testid="riasec-intro-no"><span className="rlq-key" aria-hidden="true">2</span>Non, pas maintenant</button>
              </div>
            </section>
          )}

          {phase === "later" && (
            <section className="rlq-intro" key="later">
              <h1>Pas de souci, revenez quand vous aurez 10 minutes</h1>
              <p className="rlq-sub">Gardez cette page en favori : le test vous attend, toujours gratuit.</p>
              <Link className="rlq-cta" href={RIASEC_LEAD_PATH}>Revenir à la présentation du test</Link>
            </section>
          )}

          {phase === "how" && (() => {
            const { title, text, Demo } = TUTORIAL[tutorial];
            const last = tutorial === TUTORIAL.length - 1;
            return (
              <section className="rlq-intro" key={`how${tutorial}`}>
                <p className="rlq-step-num">Étape {tutorial + 1} sur {TUTORIAL.length}</p>
                <h1>{title}</h1>
                <p className="rlq-sub">{text}</p>
                <Demo />
                <button
                  type="button"
                  className="rlq-cta"
                  onClick={() => {
                    if (!last) { capture("riasec_lead_intro", { step: `tuto${tutorial + 2}` }); setTutorial(tutorial + 1); return; }
                    capture("riasec_lead_questions_started");
                    setPhase("quiz");
                  }}
                  data-testid={last ? "riasec-intro-start" : "riasec-intro-next"}
                >
                  {last ? "Commencer le test" : "Suivant"} <ArrowRight size={20} />
                </button>
              </section>
            );
          })()}
        </>
      )}

      {phase === "quiz" && (
        <>
          <div className="rlq-bar">
            <button type="button" className="rlq-icon" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Question précédente"><ArrowLeft size={18} /></button>
            <div className="rlq-track" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={answered} aria-label={`${answered} réponses sur ${TOTAL}`}>
              <div className="rlq-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="rlq-count">{Math.min(index + 1, TOTAL)} / {TOTAL}</span>
            <Link className="rlq-icon" href={RIASEC_LEAD_PATH} aria-label="Quitter le test (vos réponses sont gardées)"><X size={18} /></Link>
          </div>
          <img className="rlq-logo" src={rebondLogo} alt="Rebond" width={132} height={32} />
          <div className="rlq-body">
            <p className="rlq-num">Question {Math.min(index + 1, TOTAL)} :</p>
            <h1 className="rlq-question" key={question.order} data-testid="riasec-question">{question.text}</h1>
            <div className="rlq-options" role="radiogroup" aria-label="Votre réponse">
              {RIASEC_OPTIONS.map((option) => {
                const on = (picked ?? current) === option.value;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    key={option.value}
                    className={`rlq-option ${on ? "on" : ""}`}
                    onClick={() => choose(option.value)}
                    data-testid={`riasec-option-${option.value}`}
                  >
                    <span className="rlq-key" aria-hidden="true">{option.value}</span>{option.label}
                  </button>
                );
              })}
            </div>
            <p className="rlq-hint">Répondez à l'instinct. Touches 1 à 5 pour aller plus vite.</p>
          </div>
        </>
      )}

      {(phase === "computing" || phase === "error") && (
        <div className="rlq-done" aria-live="polite">
          <RiasecHexagon scores={liveScores} animate size={260} />
          <h1>{phase === "computing" ? "Nous dessinons votre profil" : "Le calcul n’a pas abouti"}</h1>
          <p>{phase === "computing" ? "Vos six scores, votre code à 3 lettres et les métiers qui vont avec." : "Vos 48 réponses sont gardées."}</p>
          {phase === "error" && (
            <>
              <p className="rlq-error" role="alert">{error}</p>
              <button type="button" className="rlq-retry" onClick={() => void submit(answers)}>Réessayer</button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
