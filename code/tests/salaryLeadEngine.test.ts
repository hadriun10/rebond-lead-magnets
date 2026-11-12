import { describe, expect, it, vi } from "vitest";

// La lecture IA importe le client Mistral, qui charge la base : inutile ici.
vi.mock("../server/routes/cvLeadRoutes", () => ({ mistralJson: vi.fn() }));
import {
  applyPosition,
  publicSalaryPreview,
  computeYearsXp,
  estimateSalary,
  jobSearchTitle,
  provenTier,
  tierFromTitle,
  type SalaryProfile,
} from "../server/services/salaryLeadEngine";
import { validateSalaryProfile } from "../server/services/salaryLeadExtraction";
import { SALARY_METIERS, salaryRegionOf } from "../shared/salaryGrid";

const NOW = new Date("2026-10-30T12:00:00Z");

function profile(overrides: Partial<SalaryProfile> = {}): SalaryProfile {
  return {
    firstName: "Camille",
    headline: "Contrôleuse de gestion",
    location: "Lyon, Auvergne-Rhône-Alpes",
    metierKey: "controleur_gestion",
    metierLabel: "Contrôleuse de gestion",
    metierConfidence: "forte",
    experiences: [
      { title: "Contrôleuse de gestion", company: "Groupe SEB", start: "2022-01", end: "present", months: null, kind: "emploi" },
      { title: "Analyste financière", company: "PME Industrie", start: "2020-06", end: "2021-12", months: null, kind: "emploi" },
      { title: "Stagiaire contrôle de gestion", company: "Danone", start: "2019-09", end: "2020-02", months: 6, kind: "stage" },
    ],
    yearsInRole: 4,
    management: false,
    teamSize: null,
    international: false,
    selectiveDegree: false,
    certifications: [],
    scarceSkills: [],
    companySize: "inconnu",
    levers: [],
    skills: ["Power BI", "SAP", "Excel"],
    evidence: { management: "", international: "", degree: "", bigEmployers: [] },
    pillars: [],
    studies: null,
    ...overrides,
  };
}

describe("estimation salariale", () => {
  it("compte l'expérience sans stage ni chevauchement", () => {
    expect(computeYearsXp(profile().experiences, NOW)).toBe(6);
    const overlapping = [
      { title: "A", company: "X", start: "2018-01", end: "2023-12", months: null, kind: "emploi" as const },
      { title: "B", company: "Y", start: "2020-01", end: "2022-12", months: null, kind: "emploi" as const },
    ];
    expect(computeYearsXp(overlapping, NOW)).toBe(6);
  });

  it("lit les mois écrits en lettres, en anglais comme en français", () => {
    const valeo = [{ title: "Data Analyst", company: "Valeo", start: "Jun 2025", end: "May 2026", months: null, kind: "emploi" as const }];
    expect(computeYearsXp(valeo, NOW)).toBe(1);
    const longer = [{ title: "Data Analyst", company: "Valeo", start: "juin 2023", end: "mai 2026", months: null, kind: "emploi" as const }];
    expect(computeYearsXp(longer, NOW)).toBe(3);
  });

  it("ne compte ni l'associatif ni ce qui a commencé pendant les études", () => {
    // Parcours type : école de commerce 2021-2025, freelance ouvert pendant l'école, alternance, puis CDI.
    const jeuneDiplome = [
      { title: "Analyste - Strategy", company: "Cabinet de conseil", start: "Sep 2025", end: "present", months: null, kind: "emploi" as const },
      { title: "Freelance", company: "Conseil", start: "Nov 2021", end: "present", months: null, kind: "freelance" as const },
      { title: "Junior Consultant", company: "Société de conseil", start: "Oct 2024", end: "Aug 2025", months: null, kind: "alternance" as const },
      { title: "Head of IT section logistics", company: "Course croisière étudiante", start: "Sep 2022", end: "Jun 2023", months: null, kind: "associatif" as const },
      { title: "President of the Student Council", company: "Student council", start: "2019", end: "2021", months: null, kind: "associatif" as const },
    ];
    expect(computeYearsXp(jeuneDiplome, NOW)).toBeGreaterThanOrEqual(4);
    expect(computeYearsXp(jeuneDiplome, NOW, { start: "Aug 2021", end: "Aug 2025" })).toBe(1);
    // Reprise d'études : la carrière d'avant le MBA reste comptée.
    const mba = [
      { title: "Chef de projet", company: "X", start: "2012-01", end: "2022-08", months: null, kind: "emploi" as const },
      { title: "Directeur", company: "Y", start: "2024-01", end: "present", months: null, kind: "emploi" as const },
    ];
    expect(computeYearsXp(mba, NOW, { start: "2022-09", end: "2023-12" })).toBeGreaterThanOrEqual(12);
  });

  it("reconnaît les intitulés accentués malgré le \\b de JavaScript", () => {
    expect(tierFromTitle("Électricien industriel")).toBe("technicien");
    expect(tierFromTitle("Directrice générale")).toBe("c_level");
    expect(tierFromTitle("Assistante de direction")).toBe("technicien");
    expect(tierFromTitle("Ingénieure qualité")).toBe("cadre");
  });

  it("ne paie pas un titre de directeur que le parcours ne prouve pas", () => {
    const junior = profile({
      headline: "Directeur marketing",
      experiences: [{ title: "Directeur marketing", company: "Startup", start: "2024-01", end: "present", months: null, kind: "emploi" }],
    });
    const proven = provenTier(junior, 2);
    expect(proven.rawTier).toBe("direction");
    expect(proven.tier).toBe("cadre");
    expect(proven.downgraded).toBe(true);
  });

  it("calcule une fourchette contenue dans le marché, majorée en métropole", () => {
    const report = estimateSalary(profile(), "cv", NOW);
    const band = SALARY_METIERS.controleur_gestion.levels.confirme!;
    expect(report.level.key).toBe("confirme");
    expect(report.region.key).toBe("metropole");
    expect(report.market).toEqual({ min: Math.round(band.min * 1.05) * 1000, max: Math.round(band.max * 1.05) * 1000 });
    expect(report.range.min).toBeGreaterThanOrEqual(report.market.min);
    expect(report.range.max).toBeLessThanOrEqual(report.market.max);
    expect(report.range.max).toBeGreaterThan(report.range.min);
    expect(report.confidence).toBe("haute");
  });

  it("monte dans la fourchette avec les atouts, descend avec les freins", () => {
    const strong = estimateSalary(profile({ management: true, teamSize: 4, companySize: "grand_groupe", scarceSkills: ["Power BI"] }), "cv", NOW);
    const weak = estimateSalary(profile({ companySize: "startup" }), "cv", NOW);
    expect(strong.range.min).toBeGreaterThan(weak.range.min);
    expect(strong.market).toEqual(weak.market);
  });

  it("bascule sur la grille de repli quand le métier dépasse le niveau prouvé", () => {
    const report = estimateSalary(profile({ metierKey: "daf_raf", metierLabel: "DAF" }), "cv", NOW);
    expect(report.role.key).toBeNull();
    expect(report.confidence).toBe("faible");
    expect(report.explanation.join(" ")).toContain("niveau « Direction »");
  });

  it("explique la fourchette pas à pas : l'escalier retombe sur le milieu de la fourchette", () => {
    const report = estimateSalary(profile({ management: true, companySize: "grand_groupe", scarceSkills: ["Power BI"] }), "cv", NOW);
    const total = report.build.at(-1)!;
    expect(total.kind).toBe("total");
    expect(Math.abs(total.amount - (report.range.min + report.range.max) / 2)).toBeLessThanOrEqual(700);
    expect(report.build.map((step) => step.label)).toEqual(expect.arrayContaining(["Base du métier", "Votre expérience", "Votre ville", "Encadrement d'équipe"]));
  });

  it("chiffre ce que rapporterait chaque atout absent", () => {
    const report = estimateSalary(profile(), "cv", NOW);
    const management = report.drivers.find((driver) => driver.key === "management")!;
    expect(management.present).toBe(false);
    expect(management.gain).toBeGreaterThan(0);
    expect(report.timeline.map((step) => step.title)).toEqual(["Analyste financière", "Contrôleuse de gestion"]);
    expect(report.timeline[1].value).toBeGreaterThan(report.timeline[0].value);
  });

  it("donne toujours six piliers notés sur 20, même sans l'IA", () => {
    const report = estimateSalary(profile(), "cv", NOW);
    expect(report.pillars.map((pillar) => pillar.key)).toEqual(["role", "seniority", "scope", "skills", "employers", "proof"]);
    expect(report.pillars.every((pillar) => pillar.score >= 0 && pillar.score <= 20 && pillar.finding && pillar.advice)).toBe(true);
  });

  it("n'envoie aux visiteurs que les textes, aucun chiffre", () => {
    const full = estimateSalary(profile({ management: true }), "cv", NOW);
    const preview = publicSalaryPreview(full);
    expect(preview.range).toEqual({ min: 0, max: 0 });
    expect(preview.monthly.netMin).toBe(0);
    expect(JSON.stringify(preview)).not.toContain(String(full.range.min));
    expect(preview.profile).toBeNull();
    expect(preview.pillars.map((pillar) => pillar.finding)).toEqual(full.pillars.map((pillar) => pillar.finding));
    expect(preview.pillars.every((pillar) => pillar.score === 0)).toBe(true);
    expect(preview.drivers.every((driver) => driver.gain === 0 && driver.gainPct === 0)).toBe(true);
    expect(preview.levers.every((lever) => lever.gain === undefined)).toBe(true);
  });

  it("garde la sous-fourchette dans la bande marché aux extrêmes", () => {
    expect(applyPosition({ min: 40, max: 50 }, 0.05)).toEqual({ min: 40, max: 45.5 });
    expect(applyPosition({ min: 40, max: 50 }, 0.99)).toEqual({ min: 44.5, max: 50 });
  });

  it("détecte l'Île-de-France", () => {
    expect(salaryRegionOf("Paris, Île-de-France, France")).toBe("idf");
    expect(salaryRegionOf("92100 Boulogne")).toBe("idf");
    expect(salaryRegionOf("Bordeaux")).toBe("metropole");
    expect(salaryRegionOf("Besançon")).toBe("region");
  });
});

describe("lecture IA", () => {
  it("refuse une clé métier inventée et nettoie la sortie", () => {
    const parsed = validateSalaryProfile({
      headline: "Data scientist", metierKey: "astronaute", metierLabel: "Data scientist",
      experiences: [{ title: "Data scientist", start: "2021", end: "present", kind: "bizarre" }],
      management: "oui", levers: [{ title: "Publier", detail: "" }],
    });
    expect(parsed.metierKey).toBeNull();
    expect(parsed.metierConfidence).toBe("faible");
    expect(parsed.management).toBe(false);
    expect(parsed.experiences[0].kind).toBe("emploi");
    expect(parsed.levers).toEqual([]);
  });

  it("refuse un document sans parcours", () => {
    expect(() => validateSalaryProfile({ experiences: [] })).toThrow();
  });
});

describe("jobSearchTitle", () => {
  it("garde l'intitulé de la personne quand il ressemble au métier de la grille", () => {
    expect(jobSearchTitle({ key: "developpeur", label: "Développeur / Ingénieur logiciel", detectedLabel: "Front-End Developer" })).toBe("Front-End Developer");
  });
  it("prend le métier de la grille quand l'intitulé n'y ressemble pas", () => {
    expect(jobSearchTitle({ key: "formateur", label: "Formateur / Conseiller formation", detectedLabel: "Co-gérante" })).toBe("Formateur");
    expect(jobSearchTitle({ key: "aide_soignant", label: "Aide-soignant(e) / Auxiliaire", detectedLabel: "ASH" })).toBe("Aide-soignant");
  });
  it("garde l'intitulé quand aucun métier de la grille ne s'applique", () => {
    expect(jobSearchTitle({ key: null, label: "Co-gérante", detectedLabel: "Co-gérante" })).toBe("Co-gérante");
  });
});
