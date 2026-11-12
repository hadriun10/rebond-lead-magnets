/**
 * Interprétation du test RIASEC du lead magnet.
 *
 * Les scores et le code Holland sont calculés sans IA (`shared/riasec.ts`). L'IA
 * rédige l'interprétation (même consigne que le quiz de l'application, en JSON).
 * Si elle ne répond pas, un texte construit à partir des dimensions prend le relais :
 * la personne a toujours son résultat.
 */
import { mistralJson } from "../routes/cvLeadRoutes";
import {
  hollandCode,
  isFlatProfile,
  RIASEC_DIMENSIONS,
  RIASEC_JOB_WORK,
  RIASEC_ORDER,
  type RiasecDimension,
} from "../../shared/riasec";

export interface RiasecReport {
  scores: Record<RiasecDimension, number>;
  code: RiasecDimension[];
  letters: string;
  flat: boolean;
  summary: string;
  jobs: Array<{ title: string; why: string }>;
  environments: string[];
  advice: string[];
  aiWritten: boolean;
}

const ENVIRONMENTS: Record<RiasecDimension, string> = {
  realistic: "Un terrain, un atelier ou un chantier, où le travail se voit et se touche.",
  investigative: "Une équipe d'experts qui laisse du temps pour analyser avant de décider.",
  artistic: "Une structure qui laisse de la liberté sur la forme et valorise les idées neuves.",
  social: "Une organisation tournée vers les personnes, où l'on travaille en contact direct.",
  enterprising: "Un environnement à objectifs, où l'on peut prendre des initiatives et des responsabilités.",
  conventional: "Une organisation structurée, avec des process clairs et des responsabilités bien définies.",
};

const ADVICE: Record<RiasecDimension, string> = {
  realistic: "Mettez en avant des réalisations concrètes : ce que vous avez construit, réparé ou fait tourner, avec un résultat mesurable.",
  investigative: "Dans vos candidatures, racontez un problème difficile que vous avez résolu et la méthode suivie.",
  artistic: "Montrez vos créations : un portfolio ou deux exemples parlent plus qu'une liste de qualités.",
  social: "Citez les personnes que vous avez aidées ou formées, et ce qui a changé pour elles.",
  enterprising: "Chiffrez ce que vous avez fait avancer : un chiffre d'affaires, un projet livré, une équipe embarquée.",
  conventional: "Soulignez votre fiabilité avec des exemples : délais tenus, erreurs évitées, process améliorés.",
};

export const RIASEC_PROMPT = `Vous êtes un expert en orientation professionnelle. Vous interprétez un test d'intérêts professionnels RIASEC pour aider une personne dans sa recherche d'emploi en France.

Répondez uniquement avec un objet JSON de cette forme :
{
  "summary": "2 à 3 phrases sur son profil d'intérêts, à la 2e personne du pluriel (vous)",
  "jobs": [ { "title": "métier ou secteur", "why": "2 phrases : ce qu'on y fait au quotidien, puis pourquoi ça correspond à ses intérêts dominants" } ],
  "environments": ["type d'environnement de travail, une phrase"],
  "advice": ["conseil concret pour sa recherche d'emploi, une phrase"]
}

Règles :
- jobs : exactement 8, des métiers réels qui recrutent en France, cohérents avec le code à 3 lettres (le premier intérêt compte le plus), du plus proche au moins proche du code.
- environments : 2 ou 3. advice : 1 ou 2.
- Ton bienveillant et encourageant, mais concret. Pas de tiret cadratin. N'inventez aucun chiffre.
- Ne citez jamais l'auteur du modèle : parlez du test RIASEC et du code à 3 lettres.
- Si le profil est plat (intérêts proches), dites-le simplement : c'est une polyvalence, pas un défaut.`;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function fallbackInterpretation(scores: Record<RiasecDimension, number>): Omit<RiasecReport, "scores" | "code" | "letters" | "flat"> {
  const [first, second, third] = hollandCode(scores);
  const a = RIASEC_DIMENSIONS[first];
  const b = RIASEC_DIMENSIONS[second];
  const c = RIASEC_DIMENSIONS[third];
  const summary = isFlatProfile(scores)
    ? `Vos intérêts sont proches les uns des autres : vous pouvez vous épanouir dans des métiers variés. Votre profil penche légèrement vers le ${a.label.toLowerCase()}, le ${b.label.toLowerCase()} et le ${c.label.toLowerCase()}.`
    : `${a.drive} Votre deuxième moteur est ${b.label.toLowerCase()} : ${b.drive.charAt(0).toLowerCase()}${b.drive.slice(1)}`;
  const work = (title: string) => RIASEC_JOB_WORK[title] ?? "";
  const jobs = [
    ...a.jobs.slice(0, 4).map((title) => ({ title, why: `${work(title)} Votre premier moteur, ${a.label.toLowerCase()}, y est sollicité tous les jours.` })),
    ...b.jobs.slice(0, 2).map((title) => ({ title, why: `${work(title)} Une piste pour votre deuxième moteur, ${b.label.toLowerCase()}.` })),
    ...c.jobs.slice(0, 2).map((title) => ({ title, why: `${work(title)} Une piste qui s'appuie sur votre troisième moteur, ${c.label.toLowerCase()}.` })),
  ].map((job) => ({ ...job, why: job.why.trim() }));
  return {
    summary,
    jobs,
    environments: [ENVIRONMENTS[first], ENVIRONMENTS[second]],
    advice: [ADVICE[first]],
    aiWritten: false,
  };
}

export function validateInterpretation(raw: any) {
  const jobs = Array.isArray(raw?.jobs)
    ? raw.jobs.map((job: any) => ({ title: text(job?.title, 80), why: text(job?.why, 360) })).filter((job: any) => job.title && job.why).slice(0, 8)
    : [];
  const environments = Array.isArray(raw?.environments) ? raw.environments.map((item: unknown) => text(item, 220)).filter(Boolean).slice(0, 3) : [];
  const advice = Array.isArray(raw?.advice) ? raw.advice.map((item: unknown) => text(item, 260)).filter(Boolean).slice(0, 2) : [];
  const summary = text(raw?.summary, 600);
  if (!summary || jobs.length < 3 || !environments.length || !advice.length) throw new Error("Invalid RIASEC interpretation");
  return { summary, jobs, environments, advice, aiWritten: true };
}

export async function interpretRiasec(scores: Record<RiasecDimension, number>): Promise<RiasecReport> {
  const code = hollandCode(scores);
  const flat = isFlatProfile(scores);
  const base = { scores, code, letters: code.map((dim) => RIASEC_DIMENSIONS[dim].letter).join(""), flat };
  const scoreLines = RIASEC_ORDER.map((dim) => `- ${RIASEC_DIMENSIONS[dim].label} : ${scores[dim]}/100`).join("\n");
  try {
    const raw = await mistralJson([
      { role: "system", content: RIASEC_PROMPT },
      { role: "user", content: `Scores (0-100) :\n${scoreLines}\n\nCode RIASEC : ${base.letters} (${code.map((dim) => RIASEC_DIMENSIONS[dim].label).join(", ")})\nProfil plat : ${flat ? "oui" : "non"}` },
    ], false, { type: "json_object" }, "mistral-large-latest", 42, 25_000);
    return { ...base, ...validateInterpretation(raw) };
  } catch {
    // Ne jamais journaliser la réponse brute du fournisseur.
    console.warn("[RIASEC Lead] AI interpretation unavailable, using fallback");
    return { ...base, ...fallbackInterpretation(scores) };
  }
}

/**
 * Aperçu public : toutes les lectures restent, les éléments clés non. Les noms des métiers
 * ne sont pas envoyés, et les scores arrivent arrondis à la dizaine (juste de quoi dessiner
 * l'hexagone, affichés floutés). Le flou CSS ne protège rien : ce qui est verrouillé n'est pas envoyé.
 */
export function publicRiasecPreview(report: RiasecReport): RiasecReport & { locked: true } {
  return {
    ...report,
    locked: true,
    scores: Object.fromEntries(Object.entries(report.scores).map(([dim, score]) => [dim, Math.round(score / 10) * 10])) as RiasecReport["scores"],
    jobs: report.jobs.map((job) => ({ title: "", why: job.why })),
  };
}

