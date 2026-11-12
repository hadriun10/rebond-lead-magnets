/**
 * Estimation salariale déterministe — aucun montant ne vient de l'IA.
 *
 * Moteur porté du pipeline salaire d'Alteris TT (poste_level.py, salary_features.py,
 * salary_modifiers.py, salary_pipeline.py). L'IA lit le CV ou le profil et renvoie
 * un `SalaryProfile` ; tout le reste se calcule ici :
 *   1. années d'expérience (union des périodes, stages exclus) ;
 *   2. niveau de poste prouvé par les intitulés, corroboré par l'ancienneté et
 *      l'encadrement — garde-fou contre la surestimation ;
 *   3. fourchette marché métier × niveau × région ;
 *   4. position du candidat DANS cette fourchette (bonus et malus), puis
 *      sous-fourchette affichée, toujours contenue dans la bande marché.
 */
import {
  SALARY_FALLBACK,
  SALARY_GRID_VERSION,
  SALARY_LEVEL_LABELS,
  SALARY_METIERS,
  SALARY_REGIONS,
  SALARY_TIER_LABELS,
  salaryRegionOf,
  type SalaryBand,
  type SalaryLevel,
  type SalaryRegionKey,
  type SalaryTier,
} from "./salaryGrid";

export type CompanySize = "grand_groupe" | "eti" | "pme" | "startup" | "inconnu";
export type ExperienceKind = "emploi" | "stage" | "alternance" | "freelance" | "associatif";

/** Atout coché « Je l'ai » par la personne : il compte dans le calcul mais n'a pas de nom à afficher. */
export const DECLARED = "Déclaré par vous";
const named = (items: string[]) => items.filter((item) => item !== DECLARED);

/** Ce qui ne compte jamais comme expérience professionnelle. */
const NOT_A_JOB: ExperienceKind[] = ["stage", "associatif"];

/** Période des études supérieures principales (« AAAA-MM », « AAAA » ou mois en lettres). */
export interface SalaryStudies { start: string | null; end: string | null }

export interface SalaryExperience {
  title: string;
  company: string;
  /** "AAAA-MM" ou "AAAA". */
  start: string | null;
  /** "AAAA-MM", "AAAA" ou "present". */
  end: string | null;
  months: number | null;
  kind: ExperienceKind;
  /** Clé de grille du métier exercé dans CE poste (peut différer du métier actuel). */
  metierKey?: string | null;
}

export const SALARY_PILLARS = [
  { key: "role", label: "Votre métier" },
  { key: "seniority", label: "Votre séniorité" },
  { key: "scope", label: "Vos responsabilités" },
  { key: "skills", label: "Vos compétences différenciantes" },
  { key: "employers", label: "Vos employeurs" },
  { key: "proof", label: "Vos résultats chiffrés" },
] as const;
export type SalaryPillarKey = typeof SALARY_PILLARS[number]["key"];
export interface SalaryPillar { key: SalaryPillarKey; score: number; finding: string; advice: string }

/** Ce qui, dans le CV, prouve chaque atout : une phrase courte, citée ou résumée. */
export interface SalaryEvidence {
  management: string;
  international: string;
  degree: string;
  bigEmployers: string[];
}

/** Ce que l'IA extrait du CV ou du profil. Validé avant d'arriver ici. */
export interface SalaryProfile {
  firstName: string;
  headline: string;
  location: string;
  metierKey: string | null;
  metierLabel: string;
  metierConfidence: "forte" | "moyenne" | "faible";
  experiences: SalaryExperience[];
  yearsInRole: number | null;
  management: boolean;
  teamSize: number | null;
  international: boolean;
  selectiveDegree: boolean;
  certifications: string[];
  scarceSkills: string[];
  companySize: CompanySize;
  levers: Array<{ title: string; detail: string }>;
  /** Compétences clés du profil (8 au plus), dont les `scarceSkills`. */
  skills: string[];
  evidence: SalaryEvidence;
  /** Études supérieures principales : ce qui a commencé pendant ne compte qu'après. */
  studies: SalaryStudies | null;
  /** Lecture par pilier écrite par l'IA ; vide si elle n'a pas répondu (le moteur prend le relais). */
  pillars: SalaryPillar[];
}

export interface SalaryFactor {
  label: string;
  detail: string;
  /** Effet sur le salaire, en pourcentage du salaire de référence (8 = +8 %). */
  points: number;
}

export interface SalaryReport {
  source: "cv" | "linkedin";
  firstName: string;
  role: { key: string | null; label: string; detectedLabel: string; family: string | null };
  level: { key: SalaryLevel; label: string; yearsXp: number };
  tier: { key: SalaryTier; label: string; downgraded: boolean; downgradeReason: string | null };
  region: { key: SalaryRegionKey; label: string; inLabel: string; location: string };
  /** Fourchette personnelle, en € brut annuel. */
  range: { min: number; max: number };
  /** Fourchette du marché pour ce métier × niveau × région, en € brut annuel. */
  market: { min: number; max: number };
  monthly: { grossMin: number; grossMax: number; netMin: number; netMax: number };
  position: number;
  positionLabel: string;
  factors: SalaryFactor[];
  explanation: string[];
  levers: SalaryLever[];
  /** De la base du métier à la fourchette personnelle, en euros (milieux de fourchette). */
  build: Array<{ label: string; detail: string; amount: number; kind: "base" | "up" | "down" | "total" }>;
  /** Chaque atout salarial : présent (avec sa preuve) ou absent (avec ce qu'il rapporterait). */
  drivers: Array<{ key: string; label: string; present: boolean; proof: string; gain: number; gainPct: number }>;
  /** Le profil lu, pour recalculer dans le navigateur quand la personne déclare un atout. */
  profile: SalaryProfile;
  /** Six piliers notés sur 20, avec ce qu'on voit et comment progresser. */
  pillars: Array<SalaryPillar & { label: string }>;
  /** Les postes du parcours, du plus ancien au plus récent, avec leur valeur de marché aujourd'hui. */
  timeline: Array<{ title: string; company: string; period: string; yearsAtEnd: number; levelLabel: string; value: number; roleLabel: string }>;
  skills: { paying: string[]; others: string[] };
  confidence: "haute" | "moyenne" | "faible";
  frequentBonuses: boolean;
  gridVersion: string;
}

// ── Métier cherché dans les offres ──────────────────────────────────────────

const stemsOf = (value: string) => new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .split(/[^a-z]+/).filter((word) => word.length > 3).map((word) => word.slice(0, 5)));

/**
 * Ce qu'on tape dans la recherche d'offres pour « Voir les offres de … ».
 * L'intitulé de la personne quand il ressemble au métier de la grille (« Front-End
 * Developer » ≈ « Développeur ») ; sinon le métier de la grille, raccourci
 * (« Co-gérante » classée formatrice → « Formateur »). Sans métier de grille :
 * l'intitulé tel quel.
 */
export function jobSearchTitle(role: Pick<SalaryReport["role"], "key" | "label" | "detectedLabel">): string {
  const detected = role.detectedLabel?.trim() ?? "";
  if (!role.key) return detected || role.label;
  const grid = role.label.split(" / ")[0].replace(/\((?:e|ère|ve|ne)\)/g, "").trim();
  const gridStems = stemsOf(role.label);
  const close = [...stemsOf(detected)].some((stem) => gridStems.has(stem));
  return detected && close ? detected : grid;
}

// ── 1. Années d'expérience ──────────────────────────────────────────────────

const MAX_CAREER_YEARS = 50;

function monthIndex(value: string | null, now: Date, isEnd: boolean): number | null {
  if (!value) return null;
  if (/^(present|aujourd|en cours|actuel|now|current)/i.test(value.trim())) {
    return now.getUTCFullYear() * 12 + now.getUTCMonth();
  }
  const match = value.match(/(19[5-9]\d|20[0-4]\d)(?:[-/.](\d{1,2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  // Mois en chiffres (« 2025-06 », « 06/2025 ») ou en lettres (« Jun 2025 », « juin 2025 »).
  const numeric = match[2] ?? value.match(/(?:^|\D)(\d{1,2})[-/.](?:19|20)\d\d/)?.[1];
  const named = monthFromName(value);
  // Sans mois : janvier pour un début, décembre pour une fin.
  const month = numeric ? Math.min(12, Math.max(1, Number(numeric))) - 1 : named ?? (isEnd ? 11 : 0);
  return year * 12 + month;
}

const MONTH_NAMES: Array<[RegExp, number]> = [
  [/\b(jan|janv)/i, 0], [/\b(feb|f[ée]v)/i, 1], [/\b(mar(?!s?\s*\d{1,2}\b)|mars)/i, 2], [/\b(apr|avr)/i, 3],
  [/\b(may|mai)/i, 4], [/\b(jun|juin)/i, 5], [/\b(jul|juil)/i, 6], [/\b(aug|ao[ûu])/i, 7],
  [/\b(sep)/i, 8], [/\b(oct)/i, 9], [/\b(nov)/i, 10], [/\b(dec|d[ée]c)/i, 11],
];

function monthFromName(value: string): number | null {
  for (const [pattern, month] of MONTH_NAMES) if (pattern.test(value)) return month;
  return null;
}

/**
 * Union des périodes travaillées : deux postes simultanés ne comptent pas double.
 * Stages exclus, alternance comptée pour moitié. Sans dates, la durée déclarée sert.
 */
export function computeYearsXp(experiences: SalaryExperience[], now = new Date(), studies: SalaryStudies | null = null): number {
  const nowIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const intervals: Array<{ start: number; end: number; weight: number }> = [];
  let undatedMonths = 0;
  // Ce qui commence pendant les études (freelance d'étudiant, job à temps partiel…) ne compte
  // qu'à partir de la fin des études. L'alternance, elle, compte pour moitié dès le départ.
  // Une carrière commencée AVANT les études (reprise d'études, MBA) garde ses années.
  const studiesEnd = monthIndex(studies?.end ?? null, now, true);
  const studiesStart = studiesEnd === null ? null : monthIndex(studies?.start ?? null, now, false) ?? studiesEnd - 60;
  for (const exp of experiences) {
    if (NOT_A_JOB.includes(exp.kind)) continue;
    const weight = exp.kind === "alternance" ? 0.5 : 1;
    let start = monthIndex(exp.start, now, false);
    let end = monthIndex(exp.end, now, true) ?? (start !== null && exp.months ? start + exp.months : null);
    if (exp.kind !== "alternance" && start !== null && studiesStart !== null && studiesEnd !== null && start >= studiesStart && start <= studiesEnd) {
      if (end === null || end <= studiesEnd) continue;
      start = studiesEnd + 1;
    }
    if (start !== null && end !== null && end >= start && nowIndex - start <= MAX_CAREER_YEARS * 12) {
      intervals.push({ start, end: Math.min(end, nowIndex), weight });
    } else if (exp.months && exp.months > 0) {
      undatedMonths += exp.months * weight;
    }
  }
  // Fusion par tranche de poids : un mois en emploi l'emporte sur un mois en alternance.
  const covered = new Map<number, number>();
  for (const { start, end, weight } of intervals) {
    for (let month = start; month <= end; month++) covered.set(month, Math.max(covered.get(month) ?? 0, weight));
  }
  const months = [...covered.values()].reduce((sum, weight) => sum + weight, 0) + undatedMonths;
  return Math.max(0, Math.min(MAX_CAREER_YEARS, Math.floor(months / 12)));
}

export function levelOf(yearsXp: number): SalaryLevel {
  if (yearsXp <= 3) return "junior";
  if (yearsXp <= 7) return "confirme";
  if (yearsXp <= 15) return "senior";
  return "expert";
}

// ── 2. Niveau de poste prouvé ───────────────────────────────────────────────

const TIERS: SalaryTier[] = ["execution", "technicien", "cadre", "manager", "direction", "c_level"];
const RANK = Object.fromEntries(TIERS.map((tier, index) => [tier, index])) as Record<SalaryTier, number>;

/** `\b` Unicode : le `\b` de JavaScript ignore les lettres accentuées. */
const W = String.raw`(?:(?<![\p{L}\p{N}_])(?=[\p{L}\p{N}_])|(?<=[\p{L}\p{N}_])(?![\p{L}\p{N}_]))`;
const rx = (source: string) => new RegExp(source.replace(/\\b/g, W), "iu");

// Motifs d'intitulés, du plus élevé au plus bas (repris d'Alteris, complétés pour le tertiaire).
const TITLE_PATTERNS: Array<[SalaryTier, RegExp]> = [
  ["c_level", rx(String.raw`\b(directeur|directrice)\s+(général|générale)\b|\bdirection\s+générale\b|\bp-?dg\b|\bceo\b|\bcoo\b|\bpr[ée]sident(e)?\b|\bmanaging\s+director\b|\bdga\b|\bfounder\b|\bfondat(eur|rice)\b`)],
  ["direction", rx(String.raw`\b(directeur|directrice)\b|\bdirector\b|\bg[ée]rant(e)?\b|\bdrh\b|\bdaf\b|\bdsi\b|\braf\b|\bcto\b|\bcfo\b|\bcmo\b|\bchro\b|\bhead\s+of\b|\bvice-?pr[ée]sident\b|\bvp\b|\bplant\s+manager\b`)],
  ["manager", rx(String.raw`\bresponsable\b|\brrh\b|\bchef\s+de\s+service\b|\bchef\s+d[e'’]\s?atelier\b|\bchef\s+d[e'’]\s?[ée]quipe\b|\bchef\s+des\s+ventes\b|\bmanager\b|\bteam\s+lead\b|\btech\s+lead\b|\blead\b|\bsuperviseu(r|se)\b|\bcontrema[îi]tre\b`)],
  ["cadre", rx(String.raw`\bing[ée]nieur(e)?\b|\bengineer\b|\bchef\s+de\s+projet\b|\bproject\s+manager\b|\bproduct\s+(manager|owner)\b|\bconsultant(e)?\b|\bcharg[ée]e?\s+d[e'’\s]\s?affaires?\b|\bcharg[ée]e?\s+de\s+(?:projet|mission|recrutement)\b|\bcharg[ée]e?\s+d[e'’]\s?[ée]tudes?\b|\bacheteu(?:r|se)\b|\bcadre\b|\btechnico-?commercial(e)?\b|\bbusiness\s+developer\b|\bkey\s+account\b|\baccount\s+(manager|executive)\b|\bcontr[ôo]leu(?:r|se)\s+de\s+gestion\b|\barchitecte\b|\bconducteu(?:r|rice)\s+de\s+travaux\b|\bd[ée]veloppeu(?:r|se)\b|\bdeveloper\b|\bdata\s+(scientist|engineer|analyst)\b|\banalyste\b|\bchef\s+de\s+(produit|march[ée])\b|\bjuriste\b|\bavocat(e)?\b|\bauditeu(?:r|rice)\b|\bpharmacien(ne)?\b|\bdesigner\b`)],
  ["technicien", rx(String.raw`\btechnicien(?:ne)?s?\b|\bgestionnaire\b|\bcomptable\b|\bsecr[ée]tai?re\b|\binfirmi(?:er|ère|ere)s?\b|\bconseill(?:er|ère|ere)s?\b|\bagent\s+de\s+ma[îi]trise\b|\bdessinat(?:eur|rice)\b|\bprojeteu(?:r|se)\b|\bautomaticien(?:ne)?\b|\b[ée]lectricien(?:ne)?\b|\bexploitant(e)?\b|\bcoordinat(?:eur|rice)\b|\bcontr[ôo]leu(?:r|se)\b|\bplanificat(?:eur|rice)\b|\bformat(?:eur|rice)\b|\bapprovisionneu(?:r|se)\b|\bcharg[ée]e?\s+de\s+(?:maintenance|client[èe]le|planning|communication|marketing)\b|\bassistant(e)?\b|\b[ée]ducat(?:eur|rice)\b|\bcommercial(e)?\b`)],
  ["execution", rx(String.raw`\bop[ée]rat(?:eur|rice)\b|\bagent\s+de\s+(production|fabrication)\b|\bmanutentionnaire\b|\bcariste\b|\bouvri(?:er|ère|ere)\b|\bpr[ée]parat(?:eur|rice)\s+de\s+commandes\b|\bchauffeu(?:r|se)\b|\bvendeu(?:r|se)\b|\bcaissi(?:er|ère|ere)\b|\bmagasini(?:er|ère|ere)\b|\bsoudeu(?:r|se)\b|\bmonteu(?:r|se)\b|\bt[ée]l[ée]conseill(?:er|ère|ere)s?\b|\busineu(?:r|se)\b|\bserveu(?:r|se)\b|\bcuisini(?:er|ère|ere)\b|\baide-?soignant(e)?\b|\bemploy[ée]e?\b|\bh[ôo]te(sse)?\b`)],
];

/** « Assistante de direction » ne vaut pas « direction ». */
const SUBORDINATE = rx(String.raw`\b(assistant(e)?|adjoint(e)?\s+au|secr[ée]taire|apprenti(e)?|stagiaire|alternant(e)?|stage|alternance|intern)\b`);

// Corroboration minimale pour tenir un niveau élevé (Alteris).
const GATES: Partial<Record<SalaryTier, { years: number; yearsIfTeam: number; team: number }>> = {
  c_level: { years: 12, yearsIfTeam: 10, team: 30 },
  direction: { years: 8, yearsIfTeam: 6, team: 10 },
  manager: { years: 3, yearsIfTeam: 2, team: 2 },
};

export function tierFromTitle(title: string): SalaryTier | null {
  if (!title.trim()) return null;
  for (const [tier, pattern] of TITLE_PATTERNS) {
    if (pattern.test(title)) {
      if (SUBORDINATE.test(title) && RANK[tier] > RANK.technicien) return "technicien";
      return tier;
    }
  }
  return SUBORDINATE.test(title) ? "technicien" : null;
}

export function provenTier(profile: SalaryProfile, yearsXp: number) {
  const titles = [profile.headline, ...profile.experiences.filter((exp) => !NOT_A_JOB.includes(exp.kind)).map((exp) => exp.title)];
  let raw: SalaryTier | null = null;
  for (const title of titles) {
    const tier = tierFromTitle(title || "");
    if (tier && (!raw || RANK[tier] > RANK[raw])) raw = tier;
  }
  const rawTier: SalaryTier = raw ?? (yearsXp >= 3 ? "cadre" : "technicien");
  const teamSize = profile.teamSize ?? 0;
  let tier = rawTier;
  let reason: string | null = null;
  while (GATES[tier]) {
    const gate = GATES[tier]!;
    const required = teamSize >= gate.team ? gate.yearsIfTeam : gate.years;
    const leads = profile.management || teamSize >= gate.team;
    if (yearsXp >= required && leads) break;
    if (!reason) {
      const missing = [
        yearsXp < required ? `${required} ans d'expérience environ` : null,
        !leads ? "un encadrement d'équipe décrit noir sur blanc" : null,
      ].filter(Boolean).join(" et ");
      reason = `Vos intitulés évoquent un niveau « ${SALARY_TIER_LABELS[tier]} », mais ce niveau se paie quand le parcours montre ${missing}.`;
    }
    tier = TIERS[RANK[tier] - 1];
  }
  return { tier, rawTier, downgraded: RANK[tier] < RANK[rawTier], reason };
}

// ── 3 et 4. Position dans la fourchette ─────────────────────────────────────

const MAX_POINTS = 20;
const BAND_SPAN = 0.55;
const NEUTRAL_POSITION = 0.45;
const SPREAD = 80;

export function computeFactors(profile: SalaryProfile, yearsXp: number): SalaryFactor[] {
  const factors: SalaryFactor[] = [];
  if (profile.management) {
    factors.push({
      label: "Encadrement d'équipe",
      detail: profile.teamSize ? `Vous avez encadré jusqu'à ${profile.teamSize} personnes.` : "Votre parcours montre de l'encadrement.",
      points: (profile.teamSize ?? 0) >= 5 ? 10 : 8,
    });
  }
  if (profile.scarceSkills.length) {
    factors.push({
      label: "Compétences recherchées",
      detail: named(profile.scarceSkills).length
        ? `${named(profile.scarceSkills).slice(0, 3).join(", ")} : des compétences pour lesquelles les employeurs paient plus.`
        : "Des compétences pour lesquelles les employeurs paient plus.",
      points: 5,
    });
  }
  if (profile.companySize === "grand_groupe") {
    factors.push({ label: "Expérience en grand groupe", detail: "Les grands groupes paient en moyenne plus que les PME pour le même poste.", points: 5 });
  }
  if (profile.selectiveDegree) {
    factors.push({ label: "Diplôme sélectif", detail: "Votre école ou votre diplôme est un repère reconnu par les recruteurs.", points: 4 });
  }
  if (profile.international) {
    factors.push({ label: "Expérience internationale", detail: "Vous avez travaillé à l'international ou sur des marchés étrangers.", points: 3 });
  }
  if (profile.certifications.length) {
    factors.push({
      label: "Certifications",
      detail: named(profile.certifications).length ? `${named(profile.certifications).slice(0, 3).join(", ")}.` : "Des certifications reconnues dans votre métier.",
      points: 3,
    });
  }
  if (profile.companySize === "pme" || profile.companySize === "startup") {
    factors.push({
      label: profile.companySize === "startup" ? "Parcours en startup" : "Parcours en PME",
      detail: "Les petites structures paient en général moins de fixe sur un intitulé équivalent.",
      points: -4,
    });
  }
  if (profile.yearsInRole !== null && profile.yearsInRole < 2 && yearsXp >= 5) {
    factors.push({
      label: "Reconversion récente",
      detail: `Moins de 2 ans dans ce métier : l'employeur valorise d'abord l'expérience dans le poste.`,
      points: -8,
    });
  }
  return factors;
}

export function positionFrom(factors: SalaryFactor[]): number {
  const boost = Math.min(MAX_POINTS, factors.filter((f) => f.points > 0).reduce((sum, f) => sum + f.points, 0));
  const penalty = Math.min(MAX_POINTS, factors.filter((f) => f.points < 0).reduce((sum, f) => sum - f.points, 0));
  const position = NEUTRAL_POSITION + (boost - penalty) / SPREAD;
  return Math.round(Math.max(0.05, Math.min(0.85, position)) * 1000) / 1000;
}

/** Sous-fourchette centrée sur la position, jamais hors de la bande marché. */
export function applyPosition(band: SalaryBand, position: number, span = BAND_SPAN): SalaryBand {
  const width = Math.max(band.max - band.min, 0) * span;
  const center = band.min + position * (band.max - band.min);
  let low = center - width / 2;
  let high = center + width / 2;
  if (low < band.min) { low = band.min; high = band.min + width; }
  if (high > band.max) { low = band.max - width; high = band.max; }
  return { min: Math.max(low, band.min), max: Math.min(high, band.max) };
}

export function positionLabel(position: number): string {
  if (position >= 0.72) return "dans le haut de la fourchette";
  if (position >= 0.58) return "dans la moitié haute de la fourchette";
  if (position > 0.42) return "au milieu de la fourchette";
  if (position > 0.28) return "dans la moitié basse de la fourchette";
  return "dans le bas de la fourchette";
}

// Atouts et freins en pourcentage du salaire de référence, comme la grille Rheso.Tech :
// plafonds globaux, et une fourchette qui peut dépasser le haut du marché d'au plus 15 %.
const MAX_UP_PCT = 20;
const MAX_DOWN_PCT = 12;
const HALF_WIDTH = 0.045;
const ABOVE_MARKET = 1.15;

export function personalRange(marketK: SalaryBand, factors: SalaryFactor[]) {
  const up = Math.min(MAX_UP_PCT, factors.filter((f) => f.points > 0).reduce((sum, f) => sum + f.points, 0));
  const down = Math.min(MAX_DOWN_PCT, factors.filter((f) => f.points < 0).reduce((sum, f) => sum - f.points, 0));
  const reference = marketK.min + NEUTRAL_POSITION * (marketK.max - marketK.min);
  const raw = reference * (1 + (up - down) / 100);
  const lowest = marketK.min * (1 + HALF_WIDTH);
  const highest = (marketK.max * ABOVE_MARKET) / (1 + HALF_WIDTH);
  const mid = Math.min(highest, Math.max(lowest, raw));
  return { min: mid * (1 - HALF_WIDTH), max: mid * (1 + HALF_WIDTH), mid, reference };
}

const roundK = (k: number) => Math.round(k) * 1000;
const round100 = (euros: number) => Math.round(euros / 100) * 100;
const formatK = (euros: number) => `${Math.round(euros / 1000)} k€`;

export type SalaryLever = { title: string; detail: string; gain?: number };

/**
 * Leviers pour le PROCHAIN poste : quel employeur, quelle ville, quel type de poste viser,
 * Jamais « réécrivez votre CV ». Chiffrés quand le moteur sait le faire.
 */
function nextJobLevers(
  profile: SalaryProfile,
  factors: SalaryFactor[],
  regionKey: SalaryRegionKey,
  reference: number,
): SalaryLever[] {
  const has = (label: string) => factors.some((f) => f.label === label);
  const pct = (points: number) => round100(reference * points / 100);
  const levers: SalaryLever[] = [];
  if (!has("Encadrement d'équipe")) {
    levers.push({ title: "Visez un poste avec une équipe à encadrer", detail: "Même deux ou trois personnes : à métier égal, un poste avec du management se paie nettement plus.", gain: pct(8) });
  }
  if (profile.companySize !== "grand_groupe") {
    levers.push({ title: "Ciblez un grand groupe ou une ETI", detail: "À intitulé égal, ils paient plus de fixe que les PME et les start-up, avec des grilles et des augmentations plus régulières.", gain: pct(5) + (has("Parcours en PME") || has("Parcours en startup") ? pct(4) : 0) });
  }
  if (regionKey !== "idf") {
    const coefficient = regionKey === "metropole" ? 1.15 / 1.05 - 1 : 0.15;
    levers.push({ title: "Élargissez votre recherche à l'Île-de-France", detail: "Le même poste s'y paie environ 15 % de plus qu'en région. Le télétravail partiel rend souvent possible un poste parisien sans déménager.", gain: round100(reference * coefficient) });
  }
  if (named(profile.scarceSkills).length) {
    levers.push({ title: `Choisissez les offres qui exigent ${named(profile.scarceSkills).slice(0, 2).join(" ou ")}`, detail: "Ces compétences sont rares dans votre métier : là où elles sont demandées, c'est vous qui fixez une partie du prix." });
  }
  if (!has("Expérience internationale")) {
    levers.push({ title: "Regardez les postes à dimension internationale", detail: "Filiales, clients ou équipes à l'étranger : ces postes se paient plus et ouvrent la suite de carrière.", gain: pct(3) });
  }
  return levers;
}


/** Piliers écrits par le moteur quand l'IA n'en a pas fourni : sobres, mais jamais vides. */
export function fallbackPillars(profile: SalaryProfile, yearsXp: number, tier: SalaryTier): SalaryPillar[] {
  const clamp = (value: number) => Math.max(0, Math.min(20, Math.round(value)));
  const role = profile.metierLabel || profile.headline || "votre métier";
  const employers = [
    profile.companySize === "grand_groupe" ? `une expérience en grand groupe${named(profile.evidence.bigEmployers).length ? ` (${named(profile.evidence.bigEmployers).join(", ")})` : ""}` : "",
    profile.international ? "une expérience internationale" : "",
  ].filter(Boolean);
  return [
    {
      key: "role",
      score: clamp(profile.metierConfidence === "forte" ? 16 : profile.metierConfidence === "moyenne" ? 12 : 8),
      finding: profile.metierConfidence === "forte"
        ? `Votre parcours dit clairement « ${role} » : un recruteur vous range tout de suite dans la bonne grille de salaire.`
        : `Votre parcours mélange plusieurs métiers : un recruteur hésite sur la grille de salaire où vous ranger.`,
      advice: profile.metierConfidence === "forte"
        ? "Restez sur ce métier pour votre prochain poste : changer d'intitulé maintenant vous ferait repartir plus bas dans la grille."
        : `Visez des postes intitulés « ${role} » : un poste hybride ou flou se négocie sur la grille la plus basse.`,
    },
    {
      key: "seniority",
      score: clamp(6 + yearsXp * 1.5),
      finding: yearsXp
        ? `${yearsXp} an${yearsXp > 1 ? "s" : ""} d'expérience comptés, stages et jobs courts retirés.`
        : "Votre expérience professionnelle comptée reste courte : stages et jobs de quelques mois ne comptent pas.",
      advice: yearsXp < 3
        ? "Pour votre prochain poste, privilégiez celui qui vous donnera le plus d'autonomie : c'est ce qui fait passer de junior à confirmé, et le salaire avec."
        : "Visez un poste plus large que l'actuel : des responsabilités qui grandissent valent plus que des années identiques.",
    },
    {
      key: "scope",
      score: clamp(profile.management ? ((profile.teamSize ?? 0) >= 5 ? 18 : 15) : RANK[tier] >= RANK.cadre ? 9 : 6),
      finding: profile.management
        ? (profile.evidence.management && profile.evidence.management !== DECLARED ? profile.evidence.management : "Votre parcours montre de l'encadrement.")
        : "Aucune équipe encadrée, aucun budget ni périmètre chiffré n'apparaît dans votre parcours.",
      advice: profile.management
        ? "En entretien, chiffrez ce que vous pilotez (personnes, budget, projets) : c'est ce qui justifie le haut de la fourchette."
        : "Visez un poste avec une équipe ou un budget à piloter : c'est le pilier qui pèse le plus sur le salaire.",
    },
    {
      key: "skills",
      score: clamp(8 + profile.scarceSkills.length * 4),
      finding: profile.scarceSkills.length
        ? named(profile.scarceSkills).length
          ? `${named(profile.scarceSkills).join(", ")} : des compétences que les employeurs paient plus dans votre métier.`
          : "Vous avez indiqué des compétences recherchées dans votre métier : elles comptent dans votre estimation."
        : "Vos compétences sont celles attendues dans votre métier : elles ne vous distinguent pas encore.",
      advice: profile.scarceSkills.length
        ? "Ciblez les offres qui exigent ces compétences : c'est là qu'elles se paient."
        : "Choisissez un prochain poste qui vous fait pratiquer un outil ou une spécialité rare dans votre métier : c'est ce qui vous distinguera au poste d'après.",
    },
    {
      key: "employers",
      score: clamp(8 + (profile.companySize === "grand_groupe" ? 6 : profile.companySize === "eti" ? 3 : 0) + (profile.international ? 4 : 0) - (profile.companySize === "pme" || profile.companySize === "startup" ? 2 : 0)),
      finding: employers.length
        ? `Votre parcours montre ${employers.join(" et ")} : des repères qui rassurent un recruteur.`
        : "Votre parcours ne montre ni grand groupe ni expérience à l'étranger.",
      advice: employers.length
        ? "Ces noms rassurent : appuyez-vous dessus en entretien pour demander le haut de la fourchette."
        : "Visez une ETI ou un grand groupe pour votre prochain poste : à intitulé égal, ils paient plus de fixe.",
    },
    {
      key: "proof",
      score: 10,
      finding: "Les résultats chiffrés (gains, délais, volumes, chiffre d'affaires) sont ce qui justifie le haut d'une fourchette.",
      advice: "Arrivez en entretien avec deux résultats chiffrés (« +15 % », « 2 M€ suivis ») : ce sont eux qui font accepter le haut de la fourchette.",
    },
  ];
}

export function estimateSalary(profile: SalaryProfile, source: "cv" | "linkedin", now = new Date()): SalaryReport {
  const yearsXp = computeYearsXp(profile.experiences, now, profile.studies);
  const level = levelOf(yearsXp);
  const proven = provenTier(profile, yearsXp);
  const regionKey = salaryRegionOf(profile.location);
  const region = SALARY_REGIONS[regionKey];

  const metier = profile.metierKey ? SALARY_METIERS[profile.metierKey] : undefined;
  // Un métier payé à un niveau que le parcours ne prouve pas bascule sur la grille de repli.
  const eligible = metier && RANK[metier.tierMin] <= RANK[proven.tier] ? metier : undefined;
  const levels = eligible?.levels;
  const baseBand: SalaryBand = levels
    ? levels[level] ?? levels.confirme ?? levels.senior ?? Object.values(levels)[0]!
    : SALARY_FALLBACK[proven.tier][level];
  const marketK: SalaryBand = { min: baseBand.min * region.coefficient, max: baseBand.max * region.coefficient };

  const factors = computeFactors(profile, yearsXp);
  const personalK = personalRange(marketK, factors);
  const position = Math.round(Math.max(0, Math.min(1, (personalK.mid - marketK.min) / (marketK.max - marketK.min))) * 1000) / 1000;
  const range = { min: roundK(personalK.min), max: Math.max(roundK(personalK.max), roundK(personalK.min) + 1000) };
  const market = { min: roundK(marketK.min), max: roundK(marketK.max) };

  // Net ≈ brut × 0,78 pour un non-cadre, × 0,75 pour un cadre (cotisations salariales).
  const netRatio = RANK[proven.tier] >= RANK.cadre ? 0.75 : 0.78;
  const monthly = {
    grossMin: round100(range.min / 12),
    grossMax: round100(range.max / 12),
    netMin: round100(range.min / 12 * netRatio),
    netMax: round100(range.max / 12 * netRatio),
  };

  const roleLabel = eligible?.label ?? profile.metierLabel ?? "votre métier";
  const levelLabel = SALARY_LEVEL_LABELS[level].toLowerCase();
  const explanation: string[] = [];
  if (eligible) {
    explanation.push(`${region.inLabel[0].toUpperCase()}${region.inLabel.slice(1)}, un poste de ${eligible.label.toLowerCase()} de niveau ${levelLabel} se paie entre ${formatK(market.min)} et ${formatK(market.max)} brut par an. Avec ${yearsXp} an${yearsXp > 1 ? "s" : ""} d'expérience, c'est votre marché.`);
  } else {
    explanation.push(`Votre métier (${profile.metierLabel || "non identifié"}) n'a pas encore sa grille chez nous : nous partons de votre niveau de responsabilité (${SALARY_TIER_LABELS[proven.tier].toLowerCase()}) et de vos ${yearsXp} an${yearsXp > 1 ? "s" : ""} d'expérience. Le marché va de ${formatK(market.min)} à ${formatK(market.max)} brut par an ${region.inLabel}.`);
  }
  const ups = factors.filter((f) => f.points > 0).map((f) => f.label.toLowerCase());
  const downs = factors.filter((f) => f.points < 0).map((f) => f.label.toLowerCase());
  explanation.push(
    ups.length || downs.length
      ? `Votre profil vous place ${positionLabel(position)}${ups.length ? `, porté par : ${ups.join(", ")}` : ""}${downs.length ? `${ups.length ? " ; freiné par" : ", freiné par"} : ${downs.join(", ")}` : ""}.`
      : `Rien dans votre parcours ne vous éloigne du profil type : vous êtes ${positionLabel(position)}.`,
  );
  if (proven.downgraded && proven.reason) explanation.push(`${proven.reason} L'estimation reste donc sur un niveau « ${SALARY_TIER_LABELS[proven.tier]} ».`);
  if (metier && !eligible) explanation.push(`Le métier de ${metier.label.toLowerCase()} se paie à partir d'un niveau « ${SALARY_TIER_LABELS[metier.tierMin]} » : c'est le cap à démontrer pour viser sa grille.`);
  if (eligible?.frequentBonuses) explanation.push("Ces montants sont des salaires de base : dans ce métier, les primes d'équipe, de nuit ou d'astreinte ajoutent souvent 10 à 20 %.");

  let confidence: SalaryReport["confidence"] = !eligible ? "faible" : profile.metierConfidence === "forte" ? "haute" : profile.metierConfidence === "moyenne" ? "moyenne" : "faible";
  if (proven.downgraded && confidence === "haute") confidence = "moyenne";



  // ── Construction du salaire, en euros ─────────────────────────────────────
  // Repère : le centre « neutre » d'une bande (position 0,45), celui d'un profil sans atout ni frein.
  const neutral = (band: SalaryBand) => (band.min + NEUTRAL_POSITION * (band.max - band.min)) * 1000;
  const personalMid = personalK.mid * 1000;
  const juniorBand: SalaryBand = levels ? levels.junior ?? Object.values(levels)[0]! : SALARY_FALLBACK[proven.tier].junior;
  const build: SalaryReport["build"] = [];
  const baseAmount = round100(neutral(juniorBand));
  build.push({ label: "Base du métier", detail: `${roleLabel}, en début de carrière, en région`, amount: baseAmount, kind: "base" });
  const xpAmount = round100(neutral(baseBand) - neutral(juniorBand));
  if (xpAmount) build.push({ label: "Votre expérience", detail: `${yearsXp} an${yearsXp > 1 ? "s" : ""} : niveau ${SALARY_LEVEL_LABELS[level]}`, amount: xpAmount, kind: "up" });
  const regionAmount = round100(neutral(baseBand) * (region.coefficient - 1));
  if (regionAmount) build.push({ label: "Votre ville", detail: `${profile.location || region.label} : +${Math.round((region.coefficient - 1) * 100)} %`, amount: regionAmount, kind: "up" });
  const shift = personalMid - neutral(marketK);
  const rawShift = factors.reduce((sum, f) => sum + neutral(marketK) * f.points / 100, 0);
  for (const factor of factors) {
    const amount = rawShift ? round100(neutral(marketK) * factor.points / 100 * (shift / rawShift)) : 0;
    if (amount) build.push({ label: factor.label, detail: factor.detail, amount, kind: amount > 0 ? "up" : "down" });
  }
  build.push({ label: "Votre salaire", detail: "Milieu de votre fourchette", amount: build.reduce((sum, step) => sum + step.amount, 0), kind: "total" });

  // ── Atouts : présents avec leur preuve, absents avec ce qu'ils rapporteraient ──
  const contribution = (label: string) => build.find((step) => step.label === label)?.amount ?? 0;
  // Potentiel d'un atout absent : ce qu'il vaut sur le marché pour ce poste (son pourcentage du salaire
  // de référence), sans le plafond de la fourchette, sinon un profil déjà haut ne verrait que des miettes.
  const gainIf = (variant: Partial<SalaryProfile>) => {
    const added = computeFactors({ ...profile, ...variant }, yearsXp).reduce((sum, f) => sum + f.points, 0) - factors.reduce((sum, f) => sum + f.points, 0);
    return Math.max(0, round100(neutral(marketK) * added / 100));
  };
  const drivers: Array<Omit<SalaryReport["drivers"][number], "gainPct">> = [
    { key: "management", label: "Encadrement d'équipe", present: profile.management,
      proof: profile.evidence.management || (profile.teamSize ? `Équipe de ${profile.teamSize} personnes` : ""), gain: profile.management ? contribution("Encadrement d'équipe") : gainIf({ management: true }) },
    { key: "skills", label: "Compétences recherchées", present: profile.scarceSkills.length > 0,
      proof: named(profile.scarceSkills).join(", "), gain: profile.scarceSkills.length ? contribution("Compétences recherchées") : gainIf({ scarceSkills: ["x"] }) },
    { key: "employer", label: "Expérience en grand groupe", present: profile.companySize === "grand_groupe",
      proof: profile.evidence.bigEmployers.join(", "), gain: profile.companySize === "grand_groupe" ? contribution("Expérience en grand groupe") : gainIf({ companySize: "grand_groupe" }) },
    { key: "degree", label: "Diplôme sélectif", present: profile.selectiveDegree,
      proof: profile.evidence.degree, gain: profile.selectiveDegree ? contribution("Diplôme sélectif") : gainIf({ selectiveDegree: true }) },
    { key: "international", label: "Expérience internationale", present: profile.international,
      proof: profile.evidence.international, gain: profile.international ? contribution("Expérience internationale") : gainIf({ international: true }) },
    { key: "certifications", label: "Certifications", present: profile.certifications.length > 0,
      proof: named(profile.certifications).join(", "), gain: profile.certifications.length ? contribution("Certifications") : gainIf({ certifications: ["x"] }) },
  ];

  // ── Parcours : chaque poste, à sa valeur de marché d'aujourd'hui ────────────
  const nowIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const jobs = profile.experiences
    .filter((exp) => !NOT_A_JOB.includes(exp.kind))
    .map((exp) => ({ exp, start: monthIndex(exp.start, now, false), end: monthIndex(exp.end, now, true) ?? nowIndex }))
    .filter((job): job is { exp: SalaryExperience; start: number; end: number } => job.start !== null)
    // Un job d'été ou une mission de quelques mois ne dit rien de la valeur d'un parcours.
    .filter((job) => job.end - job.start + 1 >= 6)
    // Ce qui a commencé pendant les études (hors alternance) n'est pas une étape de carrière.
    .filter((job) => {
      const studiesEnd = monthIndex(profile.studies?.end ?? null, now, true);
      if (studiesEnd === null || job.exp.kind === "alternance") return true;
      const studiesStart = monthIndex(profile.studies?.start ?? null, now, false) ?? studiesEnd - 60;
      return !(job.start >= studiesStart && job.start <= studiesEnd);
    })
    .sort((a, b) => a.start - b.start)
    .slice(-6);
  const timeline: SalaryReport["timeline"] = jobs.map(({ exp, start, end }) => {
    const before = profile.experiences
      .filter((other) => { const s = monthIndex(other.start, now, false); return s !== null && s <= start; })
      .map((other) => {
        const otherEnd = monthIndex(other.end, now, true) ?? nowIndex;
        if (otherEnd <= end) return other;
        const clipped = Math.min(end, nowIndex);
        return { ...other, end: `${Math.floor(clipped / 12)}-${String((clipped % 12) + 1).padStart(2, "0")}` };
      });
    const yearsAtEnd = computeYearsXp(before, now, profile.studies);
    const stepLevel = levelOf(yearsAtEnd);
    const stepMetier = (exp.metierKey && SALARY_METIERS[exp.metierKey]) || eligible;
    const stepLevels = stepMetier?.levels;
    const stepBand = stepLevels
      ? stepLevels[stepLevel] ?? stepLevels.confirme ?? stepLevels.senior ?? Object.values(stepLevels)[0]!
      : SALARY_FALLBACK[tierFromTitle(exp.title) ?? proven.tier][stepLevel];
    const year = (index: number) => String(Math.floor(index / 12));
    return {
      title: exp.title,
      company: exp.company,
      period: `${year(start)} – ${end >= nowIndex ? "aujourd'hui" : year(end)}`,
      yearsAtEnd,
      levelLabel: SALARY_LEVEL_LABELS[stepLevel],
      value: round100(neutral(stepBand) * region.coefficient),
      roleLabel: stepMetier?.label ?? exp.title,
    };
  });

  const pillarSource = profile.pillars.length === SALARY_PILLARS.length ? profile.pillars : fallbackPillars(profile, yearsXp, proven.tier);
  const pillars = SALARY_PILLARS.map(({ key, label }) => ({ ...(pillarSource.find((pillar) => pillar.key === key) ?? fallbackPillars(profile, yearsXp, proven.tier).find((pillar) => pillar.key === key)!), label }));
  const withPct = drivers.map((driver) => ({ ...driver, gainPct: neutral(marketK) ? Math.round(driver.gain / neutral(marketK) * 100) : 0 }));

  const engineLevers = nextJobLevers(profile, factors, regionKey, neutral(marketK));
  const levers: SalaryLever[] = [
    ...engineLevers.sort((a, b) => (b.gain ?? 0) - (a.gain ?? 0)).slice(0, 3),
    ...profile.levers,
  ].slice(0, 4);

  const scarce = new Set(profile.scarceSkills.map((skill) => skill.toLowerCase()));
  const skills = {
    paying: named(profile.scarceSkills),
    others: profile.skills.filter((skill) => !scarce.has(skill.toLowerCase())).slice(0, 6),
  };

  return {
    source,
    firstName: profile.firstName,
    role: { key: eligible ? profile.metierKey : null, label: roleLabel, detectedLabel: profile.metierLabel, family: eligible?.family ?? null },
    level: { key: level, label: SALARY_LEVEL_LABELS[level], yearsXp },
    tier: { key: proven.tier, label: SALARY_TIER_LABELS[proven.tier], downgraded: proven.downgraded, downgradeReason: proven.reason },
    region: { key: regionKey, label: region.label, inLabel: region.inLabel, location: profile.location },
    range,
    market,
    monthly,
    position,
    positionLabel: positionLabel(position),
    factors,
    explanation,
    levers,
    build,
    drivers: withPct,
    profile,
    pillars,
    timeline,
    skills,
    confidence,
    frequentBonuses: Boolean(eligible?.frequentBonuses),
    gridVersion: SALARY_GRID_VERSION,
  };
}


export type SalaryDriverKey = "management" | "skills" | "employer" | "degree" | "international" | "certifications";

/** Le profil tel que la personne le corrige : chaque atout déclaré compte comme prouvé. */
export function withClaimedDrivers(profile: SalaryProfile, claimed: Iterable<string>): SalaryProfile {
  const keys = new Set(claimed);
  const declared = DECLARED;
  return {
    ...profile,
    management: profile.management || keys.has("management"),
    scarceSkills: keys.has("skills") && !profile.scarceSkills.length ? [declared] : profile.scarceSkills,
    companySize: keys.has("employer") ? "grand_groupe" : profile.companySize,
    selectiveDegree: profile.selectiveDegree || keys.has("degree"),
    international: profile.international || keys.has("international"),
    certifications: keys.has("certifications") && !profile.certifications.length ? [declared] : profile.certifications,
    evidence: {
      ...profile.evidence,
      management: keys.has("management") && !profile.management ? declared : profile.evidence.management,
      international: keys.has("international") && !profile.international ? declared : profile.evidence.international,
      degree: keys.has("degree") && !profile.selectiveDegree ? declared : profile.evidence.degree,
      bigEmployers: keys.has("employer") && profile.companySize !== "grand_groupe" ? [declared] : profile.evidence.bigEmployers,
    },
  };
}

/** Ce qu'un visiteur sans compte peut lire : tous les textes, aucun chiffre. */
export type SalaryPreview = Omit<SalaryReport, "profile"> & { profile: null; locked: true };

/**
 * Aperçu public : tous les textes, aucun chiffre (fourchette, mensuel, marché, montants, notes,
 * gains). Le flou CSS ne protège rien : ce qui est verrouillé n'est pas dans la réponse.
 */
export function publicSalaryPreview(report: SalaryReport): SalaryPreview {
  // La barre de calcul ne garde que ses proportions, ramenées sur une base fictive de 100 000.
  const total = report.build.find((step) => step.kind === "total")?.amount || 1;
  const scale = (amount: number) => Math.round((amount / total) * 100_000);
  return {
    ...report,
    profile: null,
    locked: true,
    range: { min: 0, max: 0 },
    market: { min: 0, max: 0 },
    monthly: { grossMin: 0, grossMax: 0, netMin: 0, netMax: 0 },
    position: 0.5,
    build: report.build.map((step) => ({ ...step, amount: scale(step.amount) })),
    // Les deux premières phrases d'explication citent les montants du marché.
    explanation: report.explanation.slice(2),
    drivers: report.drivers.map((driver) => ({ ...driver, gain: 0, gainPct: 0 })),
    pillars: report.pillars.map((pillar) => ({ ...pillar, score: 0 })),
    levers: report.levers.map(({ gain, ...lever }) => lever),
  };
}
