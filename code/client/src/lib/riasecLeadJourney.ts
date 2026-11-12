import type { RiasecAnswers, RiasecDimension } from "@shared/riasec";

export const RIASEC_LEAD_PATH = "/test-riasec";
export const RIASEC_LEAD_QUIZ_PATH = "/test-riasec/questions";
export const RIASEC_LEAD_RESULT_ROUTE = "/test-riasec/resultat/:id";
/** Progression du test : réponses et ordre des questions, rien de personnel. */
const PROGRESS_KEY = "riasecLeadProgress";

export function riasecResultPath(id: string): string {
  return `/test-riasec/resultat/${encodeURIComponent(id)}`;
}

export type RiasecProgress = { seed: number; answers: RiasecAnswers; index: number };

export function readRiasecProgress(): RiasecProgress | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || "null");
    if (!value || typeof value.seed !== "number" || typeof value.answers !== "object" || typeof value.index !== "number") return null;
    return value;
  } catch {
    return null;
  }
}

export function writeRiasecProgress(progress: RiasecProgress) {
  try { sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* navigation privée : on continue sans reprise */ }
}

export function clearRiasecProgress() {
  try { sessionStorage.removeItem(PROGRESS_KEY); } catch { /* ignoré */ }
}

export type RiasecLeadReport = {
  scores: Record<RiasecDimension, number>;
  code: RiasecDimension[];
  letters: string;
  flat: boolean;
  summary: string;
  jobs: Array<{ title: string; why: string }>;
  environments: string[];
  advice: string[];
  aiWritten: boolean;
  /** Aperçu public : noms des métiers absents, scores arrondis à la dizaine. */
  locked?: boolean;
};
export type RiasecLeadResult = { id: string; expiresAt: string; report: RiasecLeadReport; unlocked?: boolean };

/** Seul l'identifiant du résultat traverse la connexion. */
export const RIASEC_LEAD_PENDING_KEY = "pendingRiasecLeadId";

export function riasecUnlockUrl(id: string): string {
  const path = riasecResultPath(id);
  return `/api/auth/linkedin?${new URLSearchParams({ returnTo: path, signupPath: path }).toString()}`;
}

let latest: RiasecLeadResult | null = null;
export function setRiasecLeadResult(result: RiasecLeadResult) { latest = result; }
export function getRiasecLeadResult(id: string): RiasecLeadResult | null {
  return latest && latest.id === id && new Date(latest.expiresAt).getTime() > Date.now() ? latest : null;
}
