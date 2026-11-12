/**
 * Lecture du CV ou du profil LinkedIn pour l'estimation salariale.
 *
 * L'IA ne donne AUCUN montant : elle classe le métier dans la grille et relève les
 * faits du parcours. Les chiffres sont calculés par `salaryLeadEngine`.
 */
import { mistralJson } from "../routes/cvLeadRoutes";
import { SALARY_METIERS } from "../../shared/salaryGrid";
import { SALARY_PILLARS, type CompanySize, type ExperienceKind, type SalaryPillar, type SalaryProfile } from "./salaryLeadEngine";

export class SalaryLeadOutputError extends Error {
  constructor(message = "La lecture de votre parcours n’a pas abouti. Aucune estimation n’a été enregistrée. Réessayez dans un instant.") {
    super(message);
    this.name = "SalaryLeadOutputError";
  }
}

const METIER_LIST = Object.entries(SALARY_METIERS)
  .map(([key, metier]) => `- ${key} : ${metier.label} (${metier.family})`)
  .join("\n");

export const SALARY_EXTRACTION_PROMPT = `Tu es un consultant en rémunération qui lit des CV et des profils LinkedIn pour le marché français.
Tu ne donnes JAMAIS de salaire ni de montant : tu relèves des faits, un calcul séparé produit la fourchette.

Réponds uniquement avec un objet JSON de cette forme :
{
  "firstName": "prénom de la personne, ou chaîne vide",
  "headline": "titre du profil ou intitulé du poste actuel / visé, tel qu'écrit",
  "location": "ville et région du poste actuel ou du lieu de recherche, ou chaîne vide",
  "metierKey": "une clé de la liste ci-dessous, ou null si aucune ne correspond",
  "metierLabel": "le métier exercé, en 2 à 5 mots, en français",
  "metierConfidence": "forte | moyenne | faible",
  "experiences": [
    { "title": "intitulé", "company": "entreprise", "start": "AAAA-MM ou AAAA", "end": "AAAA-MM, AAAA ou present", "months": nombre ou null, "kind": "emploi | stage | alternance | freelance | associatif", "metierKey": "clé de la liste pour CE poste, ou null" }
  ],
  "studies": { "start": "début des études supérieures principales (AAAA-MM ou AAAA), ou null", "end": "obtention du diplôme le plus élevé (AAAA-MM ou AAAA), ou null" },
  "yearsInRole": nombre d'années dans le métier actuel (metierLabel), ou null,
  "management": true si le parcours décrit explicitement l'encadrement d'une équipe (management hiérarchique, pas « travail en équipe »),
  "teamSize": taille de la plus grande équipe encadrée si elle est écrite, sinon null,
  "international": true si la personne a travaillé à l'étranger, sur des marchés étrangers ou en contexte international affirmé (parler anglais ne suffit pas),
  "selectiveDegree": true pour une école d'ingénieurs, une école de commerce reconnue, Sciences Po, un master d'une grande université ou un doctorat,
  "certifications": ["certifications professionnelles reconnues dans le métier, 3 au plus"],
  "scarceSkills": ["compétences techniques très demandées et rares dans CE métier, 3 au plus ; liste vide si rien ne sort de l'ordinaire"],
  "companySize": "grand_groupe | eti | pme | startup | inconnu (employeur actuel ou le plus récent)",
  "skills": ["compétences clés du profil, 8 au plus, les plus importantes d'abord"],
  "evidence": {
    "management": "ce qui prouve l'encadrement, repris du document en une phrase courte, ou chaîne vide",
    "international": "ce qui prouve l'expérience internationale, une phrase courte, ou chaîne vide",
    "degree": "le diplôme et l'école retenus pour selectiveDegree, ou chaîne vide",
    "bigEmployers": ["grands groupes du parcours, 3 au plus"]
  },
  "pillars": [
    { "key": "role | seniority | scope | skills | employers | proof", "score": entier de 0 à 20, "finding": "ce que montre CE parcours sur ce pilier, en citant un fait précis du document, une ou deux phrases", "advice": "comment progresser sur ce pilier pour être mieux payé, concret, une ou deux phrases" }
  ],
  "levers": [
    { "title": "ce qu'il faut viser pour le prochain poste, 8 mots au plus", "detail": "pourquoi ce choix paierait plus pour CETTE personne, une phrase, sans chiffre inventé" }
  ]
}

Règles :
- metierKey : choisis le métier réellement exercé (ou visé si le profil l'affirme clairement), pas un métier voisin mieux payé. Un « assistant chef de projet » n'est pas « chef_projet ». En cas de doute entre deux clés, prends la moins payée et mets metierConfidence à « moyenne ».
- experiences : du plus récent au plus ancien, 12 au plus. Garde toujours le premier emploi, il fixe l'ancienneté. Les stages, jobs d'été et jobs étudiants sont « stage ». Les rôles associatifs, bénévoles ou étudiants (BDE, association d'école, conseil d'élèves, club, course étudiante) sont « associatif », même avec un titre de président ou de responsable. « Work Study » ou « apprentissage » = « alternance ».
- Ne déduis rien qui n'est pas écrit. Une donnée absente vaut false, null ou une liste vide.
- pillars : exactement 6, un par clé, dans cet ordre. Barème, du point de vue d'un recruteur qui fixe un salaire :
  · role : intitulé clair et cohérent sur tout le parcours, métier demandé (16-20) ; positionnement flou ou en reconversion (0-10).
  · seniority : années réellement passées dans le métier, hors stages, et progression visible d'un poste à l'autre.
  · scope : équipe encadrée, budget, périmètre, projets menés de bout en bout (16-20 si chiffré) ; rien de tout cela (0-8).
  · skills : compétences rares et payées dans CE métier (16-20) ; seulement les attendues (8-11).
  · employers : grands groupes, ETI reconnues, international (16-20) ; uniquement petites structures inconnues (6-10).
  · proof : résultats chiffrés dans le document (16-20 s'il y en a plusieurs) ; aucun chiffre (0-6).
  Ne notez pas 20 sans preuve écrite. Vouvoyez. Citez le document dans finding.
- levers : 2 leviers au plus pour le PROCHAIN poste de cette personne (type de poste, secteur, employeur, spécialité à viser, argument à faire valoir en entretien). Jamais de conseil pour réécrire le CV ou le profil. Vouvoyez la personne. Pas de tiret cadratin.
- advice des pillars : orienté prochain poste et entretien, jamais « ajoutez sur votre CV ».

Liste des clés métier :
${METIER_LIST}`;

const KINDS: ExperienceKind[] = ["emploi", "stage", "alternance", "freelance", "associatif"];
const SIZES: CompanySize[] = ["grand_groupe", "eti", "pme", "startup", "inconnu"];

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function positiveInt(value: unknown, max: number): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? Math.min(max, Math.round(number)) : null;
}

function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value) ? value.map((item) => text(item, 60)).filter(Boolean).slice(0, max) : [];
}

/** Les six piliers ou rien : un pilier manquant ou mal noté fait basculer sur le texte du moteur. */
export function validatePillars(raw: unknown): SalaryPillar[] {
  if (!Array.isArray(raw)) return [];
  const pillars = SALARY_PILLARS.map(({ key }) => {
    const item = raw.find((pillar: any) => pillar?.key === key);
    const score = typeof item?.score === "number" ? Math.round(item.score) : NaN;
    const finding = text(item?.finding, 320);
    const advice = text(item?.advice, 320);
    return Number.isFinite(score) && score >= 0 && score <= 20 && finding && advice ? { key, score, finding, advice } : null;
  });
  return pillars.every(Boolean) ? (pillars as SalaryPillar[]) : [];
}

export function validateSalaryProfile(raw: any): SalaryProfile {
  if (!raw || typeof raw !== "object") throw new SalaryLeadOutputError();
  const experiences = Array.isArray(raw.experiences)
    ? raw.experiences.slice(0, 12).filter((exp: any) => exp && typeof exp === "object").map((exp: any) => ({
        title: text(exp.title, 140),
        company: text(exp.company, 120),
        start: text(exp.start, 20) || null,
        end: text(exp.end, 20) || null,
        months: positiveInt(exp.months, 600),
        kind: KINDS.includes(exp.kind) ? exp.kind : "emploi",
        metierKey: typeof exp.metierKey === "string" && exp.metierKey in SALARY_METIERS ? exp.metierKey : null,
      }))
    : [];
  const metierKey = typeof raw.metierKey === "string" && raw.metierKey in SALARY_METIERS ? raw.metierKey : null;
  const metierLabel = text(raw.metierLabel, 80);
  // Sans parcours ni métier, il n'y a rien à estimer : mieux vaut un refus clair qu'une fourchette au hasard.
  if (!experiences.length && !metierLabel && !text(raw.headline, 10)) {
    throw new SalaryLeadOutputError("Nous n’avons trouvé ni poste ni expérience dans ce document. Vérifiez qu’il s’agit bien de votre CV ou de votre profil.");
  }
  return {
    firstName: text(raw.firstName, 40),
    headline: text(raw.headline, 200),
    location: text(raw.location, 120),
    metierKey,
    metierLabel,
    metierConfidence: metierKey ? (["forte", "moyenne", "faible"].includes(raw.metierConfidence) ? raw.metierConfidence : "moyenne") : "faible",
    experiences,
    yearsInRole: positiveInt(raw.yearsInRole, 50),
    management: raw.management === true,
    teamSize: positiveInt(raw.teamSize, 10_000) || null,
    international: raw.international === true,
    selectiveDegree: raw.selectiveDegree === true,
    certifications: stringList(raw.certifications, 3),
    scarceSkills: stringList(raw.scarceSkills, 3),
    companySize: SIZES.includes(raw.companySize) ? raw.companySize : "inconnu",
    skills: stringList(raw.skills, 8),
    studies: raw.studies && typeof raw.studies === "object" && (text(raw.studies.start, 20) || text(raw.studies.end, 20))
      ? { start: text(raw.studies.start, 20) || null, end: text(raw.studies.end, 20) || null }
      : null,
    evidence: {
      management: text(raw.evidence?.management, 160),
      international: text(raw.evidence?.international, 160),
      degree: text(raw.evidence?.degree, 120),
      bigEmployers: stringList(raw.evidence?.bigEmployers, 3),
    },
    pillars: validatePillars(raw.pillars),
    levers: Array.isArray(raw.levers)
      ? raw.levers.slice(0, 2).map((lever: any) => ({ title: text(lever?.title, 90), detail: text(lever?.detail, 260) })).filter((lever: any) => lever.title && lever.detail)
      : [],
  };
}

type Source = { kind: "text"; content: string } | { kind: "image"; dataUrl: string };

export async function extractSalaryProfile(source: Source): Promise<SalaryProfile> {
  const user = source.kind === "text"
    ? `Voici le document à lire :\n\n${source.content.slice(0, 30_000)}`
    : [
        { type: "text", text: "Voici le CV à lire (image)." },
        { type: "image_url", image_url: { url: source.dataUrl } },
      ];
  const messages = [
    { role: "system" as const, content: SALARY_EXTRACTION_PROMPT },
    { role: "user" as const, content: user },
  ];
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await mistralJson(messages, source.kind === "image", { type: "json_object" }, "mistral-large-latest", 42, 45_000);
      return validateSalaryProfile(raw);
    } catch (error) {
      if (error instanceof SalaryLeadOutputError && attempt > 0) throw error;
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }
  if (lastError instanceof SalaryLeadOutputError) throw lastError;
  throw new Error("Salary AI unavailable");
}
