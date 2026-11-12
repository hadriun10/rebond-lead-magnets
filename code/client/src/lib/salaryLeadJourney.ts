import type { SalaryPreview, SalaryReport } from "@shared/salaryLeadEngine";
export const SALARY_LEAD_PATH = "/estimation-salaire";
export const SALARY_LEAD_LOADING_PATH = "/estimation-salaire/chargement";
export const SALARY_LEAD_RESULT_ROUTE = "/estimation-salaire/resultat/:id";
export const SALARY_LEAD_LOADING_KEY = "salaryLeadLoading";
export const SALARY_LEAD_ERROR_KEY = "salaryLeadError";

export function salaryResultPath(id: string): string {
  return `/estimation-salaire/resultat/${encodeURIComponent(id)}`;
}

/** Le rapport est celui du moteur partagé : le navigateur peut le recalculer à l'identique. */
export type SalaryLeadReport = SalaryReport | SalaryPreview;
export type SalaryLeadResult = { id: string; expiresAt: string; report: SalaryLeadReport; unlocked?: boolean };

/** Seul l'identifiant de l'estimation traverse la connexion. */
export const SALARY_LEAD_PENDING_KEY = "pendingSalaryLeadId";

/** Connexion LinkedIn qui revient sur l'estimation (même mécanique que l'analyse LinkedIn). */
export function salaryUnlockUrl(id: string): string {
  const path = salaryResultPath(id);
  return `/api/auth/linkedin?${new URLSearchParams({ returnTo: path, signupPath: path }).toString()}`;
}

export function isLockedReport(report: SalaryLeadReport): report is SalaryPreview {
  return "locked" in report && report.locked === true;
}

/*
 * Le résultat reste en mémoire entre l'écran de chargement et la page de résultat.
 * Après un rechargement, la page le relit depuis l'API avec son identifiant.
 */
let latest: SalaryLeadResult | null = null;

export function setSalaryLeadResult(result: SalaryLeadResult) {
  latest = result;
}

export function getSalaryLeadResult(id?: string): SalaryLeadResult | null {
  if (!latest) return null;
  if (new Date(latest.expiresAt).getTime() <= Date.now()) {
    latest = null;
    return null;
  }
  return !id || latest.id === id ? latest : null;
}

export function clearSalaryLeadResult() {
  latest = null;
}

export const formatEuros = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} €`;

export const formatK = (value: number) => `${Math.round(value / 1000)} k€`;

export function rangeBand(min: number) {
  return min < 30_000 ? "lt30" : min < 40_000 ? "30_40" : min < 55_000 ? "40_55" : min < 75_000 ? "55_75" : "gte75";
}
