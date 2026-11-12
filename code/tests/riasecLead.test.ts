import { describe, expect, it, vi } from "vitest";

// L'interprétation importe le client Mistral, qui charge la base : inutile ici.
vi.mock("../server/routes/cvLeadRoutes", () => ({ mistralJson: vi.fn(async () => { throw new Error("offline"); }) }));

import { alternativeCodes, hexagonDistance, hollandCode, isCompleteRiasec, profileClarity, isFlatProfile, RIASEC_QUESTIONS, scoreRiasec, shuffledQuestions } from "../shared/riasec";
import { interpretRiasec, publicRiasecPreview, validateInterpretation } from "../server/services/riasecLeadInterpretation";

const all = (value: number) => Object.fromEntries(RIASEC_QUESTIONS.map(({ order }) => [order, value]));

describe("test RIASEC", () => {
  it("calcule comme le quiz de l'application : somme / maximum × 100", () => {
    expect(scoreRiasec(all(5)).social).toBe(100);
    expect(scoreRiasec(all(1)).realistic).toBe(20);
    const answers = all(3);
    for (const q of RIASEC_QUESTIONS) if (q.dimension === "social") answers[q.order] = 5;
    expect(scoreRiasec(answers)).toMatchObject({ social: 100, realistic: 60 });
  });

  it("donne le code Holland des trois dominantes, R-I-A-S-E-C départage les égalités", () => {
    expect(hollandCode({ realistic: 40, investigative: 90, artistic: 70, social: 70, enterprising: 30, conventional: 20 }))
      .toEqual(["investigative", "artistic", "social"]);
    expect(isFlatProfile(scoreRiasec(all(3)))).toBe(true);
  });

  it("refuse un test incomplet ou des valeurs hors échelle", () => {
    expect(isCompleteRiasec(all(4))).toBe(true);
    const missing = all(4); delete missing[12];
    expect(isCompleteRiasec(missing)).toBe(false);
    expect(isCompleteRiasec({ ...all(4), 3: 6 })).toBe(false);
  });

  it("mélange toujours les 48 questions de la même façon pour une graine donnée", () => {
    const a = shuffledQuestions(42).map((q) => q.order);
    expect(a).toEqual(shuffledQuestions(42).map((q) => q.order));
    expect([...a].sort((x, y) => x - y)).toEqual(RIASEC_QUESTIONS.map((q) => q.order).sort((x, y) => x - y));
  });

  it("garde un résultat complet quand l'IA ne répond pas", async () => {
    const answers = all(2);
    for (const q of RIASEC_QUESTIONS) if (q.dimension === "enterprising") answers[q.order] = 5;
    const report = await interpretRiasec(scoreRiasec(answers));
    expect(report.letters[0]).toBe("E");
    expect(report.aiWritten).toBe(false);
    expect(report.jobs).toHaveLength(8);
    expect(report.summary.length).toBeGreaterThan(20);
  });

  it("lit la netteté du profil, la distance sur l'hexagone et les codes presque à égalité", () => {
    expect(profileClarity({ realistic: 20, investigative: 30, artistic: 30, social: 95, enterprising: 40, conventional: 30 })).toBe("net");
    expect(profileClarity({ realistic: 20, investigative: 30, artistic: 30, social: 80, enterprising: 75, conventional: 70 })).toBe("nuance");
    expect(profileClarity(scoreRiasec(all(3)))).toBe("polyvalent");
    expect(hexagonDistance("realistic", "investigative")).toBe(1);
    expect(hexagonDistance("realistic", "conventional")).toBe(1);
    expect(hexagonDistance("realistic", "artistic")).toBe(2);
    expect(hexagonDistance("realistic", "social")).toBe(3);
    expect(alternativeCodes({ realistic: 20, investigative: 30, artistic: 30, social: 90, enterprising: 70, conventional: 66 })).toEqual(["SCE"]);
    expect(alternativeCodes({ realistic: 20, investigative: 30, artistic: 30, social: 90, enterprising: 70, conventional: 50 })).toEqual([]);
  });

  it("rejette une interprétation IA incomplète", () => {
    expect(() => validateInterpretation({ summary: "ok", jobs: [], environments: [], advice: [] })).toThrow();
  });

  it("n'envoie pas aux visiteurs les noms des métiers ni les scores exacts", async () => {
    const answers = all(2);
    for (const q of RIASEC_QUESTIONS) if (q.dimension === "social") answers[q.order] = 5;
    const report = await interpretRiasec(scoreRiasec(answers));
    const preview = publicRiasecPreview(report);
    expect(preview.locked).toBe(true);
    expect(preview.letters).toBe(report.letters);
    expect(preview.jobs.every((job) => job.title === "" && job.why)).toBe(true);
    expect(Object.values(preview.scores).every((score) => score % 10 === 0)).toBe(true);
    expect(JSON.stringify(preview)).not.toContain(report.jobs[0].title);
  });
});
