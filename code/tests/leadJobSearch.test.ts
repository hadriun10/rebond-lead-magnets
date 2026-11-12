import { describe, expect, it } from "vitest";
import { jobSearchUrl } from "../client/src/components/LeadJobSearch";
import { restoreSearchOptions } from "../shared/jobSearchOptions";

// « Voir les offres » des lead magnets salaire et RIASEC : l'adresse ouverte dans
// un nouvel onglet doit être lue telle quelle par JobRecommendations.
describe("jobSearchUrl", () => {
  it("ouvre la recherche membre avec le métier, la ville et le lancement automatique", () => {
    const url = new URL(jobSearchUrl("Front-End Developer", { kind: "city", code: "69123", label: "Lyon" }), "https://rebond.pro");
    expect(url.pathname).toBe("/app/job-recommendations");
    expect(url.searchParams.get("query")).toBe("Front-End Developer");
    expect(url.searchParams.get("run")).toBe("1");
    const locations = restoreSearchOptions({ locations: JSON.parse(url.searchParams.get("locations")!) }).locations;
    expect(locations).toEqual([{ kind: "city", code: "69123", label: "Lyon" }]);
  });

  it("cherche partout en France sans ville", () => {
    const url = new URL(jobSearchUrl("Data analyst", null), "https://rebond.pro");
    expect(url.searchParams.has("locations")).toBe(false);
    expect(url.searchParams.get("query")).toBe("Data analyst");
  });

  it("écarte un lieu libre, refusé par le serveur", () => {
    const locations = restoreSearchOptions({ locations: [{ kind: "free", code: "x", label: "chez moi" }] }).locations;
    expect(locations).toEqual([]);
  });
});
