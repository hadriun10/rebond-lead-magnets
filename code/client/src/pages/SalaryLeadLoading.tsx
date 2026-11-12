import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Lightbulb } from "lucide-react";
import SEO from "@/components/SEO";
import {
  getSalaryLeadResult,
  SALARY_LEAD_ERROR_KEY,
  SALARY_LEAD_LOADING_KEY,
  SALARY_LEAD_PATH,
  salaryResultPath,
} from "@/lib/salaryLeadJourney";

/** Ce que fait l'estimation, dans l'ordre où elle le fait. */
const PHASES = [
  "Nous lisons votre parcours.",
  "Nous repérons votre métier et vos années d'expérience.",
  "Nous cherchons ce que le marché paie dans votre ville.",
  "Nous relevons ce qui fait monter votre salaire.",
  "Nous préparons votre fourchette.",
];

const TIPS = [
  "Annoncez une fourchette plutôt qu'un chiffre : le bas de la fourchette doit déjà vous convenir.",
  "Parlez en brut annuel : c'est l'unité des recruteurs et des offres d'emploi.",
  "Le fixe n'est qu'une partie du package : variable, télétravail, RTT et mutuelle se négocient aussi.",
  "Rien ne vous oblige à donner votre salaire actuel : vous pouvez répondre par votre prétention.",
  "Le meilleur moment pour négocier, c'est après l'offre et avant la signature.",
];

export default function SalaryLeadLoading() {
  const [, setLocation] = useLocation();
  const [elapsed, setElapsed] = useState(0);
  const [doneId, setDoneId] = useState("");
  const [done, setDone] = useState<{ at: number; from: number } | null>(null);
  const startedAt = useMemo(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(SALARY_LEAD_LOADING_KEY) || "{}");
      return typeof value.startedAt === "number" ? value.startedAt : 0;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    if (!startedAt) {
      setLocation(SALARY_LEAD_PATH, { replace: true });
      return;
    }
    const tick = () => {
      if (sessionStorage.getItem(SALARY_LEAD_ERROR_KEY)) {
        setLocation(SALARY_LEAD_PATH, { replace: true });
        return;
      }
      const result = getSalaryLeadResult();
      if (result) setDoneId(result.id);
      const next = Date.now() - startedAt;
      setElapsed(Math.max(0, next));
      if (next > 120_000) {
        sessionStorage.removeItem(SALARY_LEAD_LOADING_KEY);
        sessionStorage.setItem(SALARY_LEAD_ERROR_KEY, "L’estimation prend plus de temps que prévu. Réessayez dans quelques instants.");
        setLocation(SALARY_LEAD_PATH, { replace: true });
      }
    };
    tick();
    const timer = window.setInterval(tick, 80);
    return () => window.clearInterval(timer);
  }, [startedAt, setLocation]);

  useEffect(() => {
    if (!doneId) return;
    setDone((current) => current ?? { at: Date.now(), from: Math.min(97, Math.round(97 * (1 - Math.exp(-(Date.now() - startedAt) / 6000)))) });
    const timer = window.setTimeout(() => setLocation(salaryResultPath(doneId), { replace: true }), 950);
    return () => window.clearTimeout(timer);
  }, [doneId, setLocation, startedAt]);

  // Progression qui ralentit avec le temps (≈ 55 % à 5 s, 80 % à 10 s, 95 % à 20 s) :
  // elle colle à la durée réelle d'une estimation sans jamais se figer. Seul un vrai
  // résultat mène à 100 %, en moins d'une seconde, au lieu d'un saut brutal.
  const waiting = Math.min(97, Math.round(97 * (1 - Math.exp(-elapsed / 6000))));
  const progress = done ? Math.round(done.from + (100 - done.from) * Math.min(1, (Date.now() - done.at) / 800)) : waiting;
  const phase = PHASES[Math.min(PHASES.length - 1, Math.floor((waiting / 97) * PHASES.length))];
  const tip = TIPS[Math.floor(elapsed / 9000) % TIPS.length];

  return (
    <main className="min-h-[100dvh] bg-white text-[#123d28] flex items-center justify-center px-6 py-12">
      <SEO title="Estimation de votre salaire en cours" noindex />
      <div className="w-full max-w-xl text-center" aria-live="polite">
        <div
          className="relative mx-auto mb-9 grid h-44 w-44 place-items-center rounded-full"
          style={{ background: `conic-gradient(#2d9326 ${progress * 3.6}deg, #e8eee5 0deg)` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={`Estimation du salaire : ${progress}%`}
        >
          <div className="absolute inset-[10px] rounded-full bg-white" />
          <strong className="relative text-4xl tracking-[-0.06em]">{progress}%</strong>
        </div>

        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#082b1b]">Estimation de votre salaire en cours</h1>
        <p className="mt-4 min-h-14 text-lg leading-relaxed text-[#526a59]">{doneId ? "Votre estimation est prête." : phase}</p>

        <aside className="mt-10 rounded-2xl bg-[#f1f6ec] px-6 py-5 text-left">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#2d9326]">
            <Lightbulb size={18} aria-hidden="true" />
            Conseil pour négocier
          </div>
          <p className="mt-3 leading-relaxed text-[#405b47]">{tip}</p>
        </aside>

        <p className="mt-6 text-xs text-[#7b8c7e]">Gardez cette page ouverte : votre estimation s’affiche dès qu’elle est prête.</p>
      </div>
    </main>
  );
}
