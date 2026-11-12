import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { RiasecHexagon } from "@/components/RiasecHexagon";
import { RIASEC_OPTIONS, RIASEC_ORDER, type RiasecDimension } from "@shared/riasec";

/**
 * Les trois petites démos animées du tutoriel, avant la première question.
 * Chacune tourne en boucle ; avec « réduire les animations », elle reste figée sur son état final.
 */

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Compteur qui avance toutes les `ms` millisecondes et revient à 0 après `steps`. */
function useTicker(steps: number, ms: number) {
  const [tick, setTick] = useState(() => (reducedMotion() ? steps - 1 : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    const id = window.setInterval(() => setTick((t) => (t + 1) % steps), ms);
    return () => window.clearInterval(id);
  }, [steps, ms]);
  return tick;
}

const DEMO_QUESTIONS = [
  { text: "J'aime résoudre des énigmes ou des problèmes complexes", answer: 4 },
  { text: "J'aime aider les autres à apprendre ou à progresser", answer: 5 },
  { text: "J'aime réparer des objets ou des appareils", answer: 2 },
];

/** Étape 1 : une question se pose, une réponse se coche, la suivante arrive. */
export function QuestionDemo() {
  // 3 temps par question : elle apparaît, la réponse se coche, on passe à la suivante.
  const tick = useTicker(DEMO_QUESTIONS.length * 3, 800);
  const index = Math.floor(tick / 3);
  const question = DEMO_QUESTIONS[index];
  const picked = tick % 3 >= 1 ? question.answer : null;
  return (
    <div className="rli-card rli-quiz" aria-hidden="true">
      <div className="rli-track"><span style={{ width: `${((index + (picked ? 1 : 0)) / 48) * 100 + 4}%` }} /></div>
      <p className="rli-num">Question {index + 1} :</p>
      <p className="rli-q" key={index}>{question.text}</p>
      <div className="rli-opts">
        {RIASEC_OPTIONS.map((option) => (
          <span key={option.value} className={`rli-opt ${picked === option.value ? "on" : ""}`}>
            <b>{option.value}</b>{option.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const DEMO_PROFILES: Array<Record<RiasecDimension, number>> = [
  { realistic: 30, investigative: 30, artistic: 30, social: 30, enterprising: 30, conventional: 30 },
  { realistic: 48, investigative: 66, artistic: 38, social: 58, enterprising: 44, conventional: 40 },
  { realistic: 40, investigative: 50, artistic: 62, social: 74, enterprising: 52, conventional: 58 },
  { realistic: 34, investigative: 52, artistic: 41, social: 86, enterprising: 71, conventional: 64 },
];
const DEMO_CODE: RiasecDimension[] = ["social", "enterprising", "conventional"];

/** Étape 2 : la toile se déforme au fil des réponses, puis le code à 3 lettres sort. */
export function ProfileDemo() {
  const tick = useTicker(DEMO_PROFILES.length + 3, 900);
  const target = DEMO_PROFILES[Math.min(tick, DEMO_PROFILES.length - 1)];
  const settled = tick >= DEMO_PROFILES.length - 1;
  const [scores, setScores] = useState(target);
  const from = useRef(target);

  // Glisse d'une forme à l'autre plutôt que de sauter.
  useEffect(() => {
    if (reducedMotion()) { setScores(target); return; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      const ease = 1 - (1 - t) ** 3;
      const next = Object.fromEntries(RIASEC_ORDER.map((dim) => [dim, origin[dim] + (target[dim] - origin[dim]) * ease])) as Record<RiasecDimension, number>;
      from.current = next;
      setScores(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div className="rli-card rli-profile" aria-hidden="true">
      <RiasecHexagon scores={scores} highlight={settled ? DEMO_CODE : []} size={210} />
      <div className={`rli-code ${settled ? "on" : ""}`}>
        {["S", "E", "C"].map((letter, i) => <span key={letter} style={{ transitionDelay: `${i * 140}ms` }}>{letter}</span>)}
      </div>
    </div>
  );
}

const DEMO_JOBS = [
  { title: "Chargé·e de recrutement", code: "SEC" },
  { title: "Responsable relation client", code: "ESC" },
  { title: "Conseiller·ère en évolution professionnelle", code: "SEI" },
];

/** Étape 3 : les métiers arrivent, on clique sur « Postuler ». */
export function JobsDemo() {
  // 0-2 : les cartes arrivent · 3 : le bouton s'enfonce · 4-6 : candidature envoyée.
  const tick = useTicker(8, 600);
  return (
    <div className="rli-card rli-jobs" aria-hidden="true">
      {DEMO_JOBS.map((job, i) => {
        const shown = tick >= i;
        const pressed = i === 0 && tick === 3;
        const sent = i === 0 && tick >= 4;
        return (
          <div key={job.title} className={`rli-job ${shown ? "on" : ""}`}>
            <div>
              <strong>{job.title}</strong>
              <span className="rli-tags">{job.code.split("").map((letter) => <i key={letter}>{letter}</i>)}</span>
            </div>
            <span className={`rli-apply ${pressed ? "press" : ""} ${sent ? "sent" : ""}`}>
              {sent ? <><Check size={14} /> Envoyée</> : "Postuler"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const RIASEC_INTRO_CSS = `
  .rli-card{width:100%;max-width:420px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:20px;padding:16px 18px;box-shadow:0 18px 44px rgba(8,43,27,.10);text-align:left}
  .rli-track{height:6px;border-radius:999px;background:#e4ebdf;overflow:hidden;margin-bottom:12px}
  .rli-track span{display:block;height:100%;background:var(--green);border-radius:inherit;transition:width .4s ease}
  .rli-num{margin:0 0 6px;font-size:13px;font-weight:600;color:var(--green)}
  .rli-q{margin:0 0 10px;min-height:2.6em;font-size:16px;line-height:1.3;font-weight:600;color:var(--deep);animation:rlq-in .35s ease both}
  .rli-opts{display:grid;gap:5px}
  .rli-opt{display:flex;align-items:center;gap:10px;padding:6px 10px;border:1.5px solid var(--line);border-radius:10px;font-size:13.5px;color:var(--ink);transition:border-color .2s,background-color .2s,transform .2s}
  .rli-opt b{width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:6px;background:#eef3ea;font-size:12px;color:#526a59;transition:background-color .2s,color .2s}
  .rli-opt.on{border-color:var(--green);background:#eaf6e2;transform:scale(1.02)}
  .rli-opt.on b{background:var(--green);color:#fff}
  .rli-profile{display:flex;flex-direction:column;align-items:center;padding:12px 18px 16px}.rli-profile svg{width:min(210px,32vh);height:auto}
  .rli-code{display:flex;gap:8px;margin-top:4px}
  .rli-code span{width:40px;height:44px;display:grid;place-items:center;border-radius:12px;background:var(--deep);color:#fff;font-size:23px;font-weight:700;opacity:0;transform:translateY(10px);transition:opacity .35s ease,transform .35s cubic-bezier(.2,.8,.2,1)}
  .rli-code.on span{opacity:1;transform:none}
  .rli-jobs{display:grid;gap:10px}
  .rli-job{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;opacity:0;transform:translateX(-14px);transition:opacity .4s ease,transform .4s cubic-bezier(.2,.8,.2,1)}
  .rli-job.on{opacity:1;transform:none}
  .rli-job strong{display:block;font-size:15px;line-height:1.3;color:var(--deep)}
  .rli-tags{display:flex;gap:4px;margin-top:6px}
  .rli-tags i{font-style:normal;width:22px;height:22px;display:grid;place-items:center;border-radius:6px;background:#e3f2d8;font-size:12px;font-weight:700;color:var(--deep)}
  .rli-apply{flex:none;display:inline-flex;align-items:center;gap:5px;height:36px;padding:0 14px;border-radius:10px;background:var(--green);color:#fff;font-size:14px;font-weight:700;transition:transform .15s,background-color .25s}
  .rli-apply.press{transform:scale(.9)}
  .rli-apply.sent{background:var(--deep)}
  @media(prefers-reduced-motion:reduce){.rli-q{animation:none}.rli-opt,.rli-code span,.rli-job,.rli-apply,.rli-track span{transition:none}}
  @media(max-width:520px){.rli-card{padding:14px}.rli-q{font-size:15px}.rli-opt{font-size:13px;padding:5px 9px}}
  @media(max-height:700px){.rli-opt{padding:4px 9px}.rli-opt b{width:20px;height:20px}.rli-job{padding:9px 12px}}
`;
