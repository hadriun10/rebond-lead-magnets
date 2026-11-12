import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SERVER_PUBLIC_PAGES, PUBLIC_PAGE_META, PUBLIC_SITEMAP_PAGES,
  PUBLIC_IMAGE_SITEMAP_PAGES,
} from "../shared/serverPublicPages";
import {
  MARKETING_FEATURE_SLUGS, MARKETING_SSR_PATHS, isMarketingSsrPath,
} from "../shared/marketingSsrRoutes";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("shared server public pages", () => {
  it("declares each static URL once, with consistent canonical metadata", () => {
    expect(new Set(SERVER_PUBLIC_PAGES.map(page => page.path)).size).toBe(SERVER_PUBLIC_PAGES.length);
    for (const page of PUBLIC_PAGE_META) {
      expect(new URL(page.canonical).pathname, page.path).toBe(page.path);
      expect(page.title.length, page.path).toBeGreaterThan(0);
      expect(page.description.length, page.path).toBeGreaterThan(0);
    }
  });

  it("never advertises a static page without metadata or marked noindex", () => {
    expect(PUBLIC_SITEMAP_PAGES).toHaveLength(19);
    for (const page of PUBLIC_SITEMAP_PAGES) {
      const meta = PUBLIC_PAGE_META.find(entry => entry.path === page.path);
      expect(meta, page.path).toBeDefined();
      expect(meta?.noindex, page.path).not.toBe(true);
    }
    for (const page of PUBLIC_IMAGE_SITEMAP_PAGES) {
      expect(PUBLIC_SITEMAP_PAGES.some(entry => entry.path === page.path), page.path).toBe(true);
    }
  });

  it("preserves all pre-refactor metadata and sitemap values, including ordering", () => {
    // Baselines captured from the original runtime declarations, not generated
    // from this registry. Initial HTML has dedicated CV/LinkedIn renderer tests.
    expect(digest(PUBLIC_PAGE_META.map(({ initialBody, ...meta }) => meta)))
      .toBe("ae0437bf249c819af6772ec553de9d9d4f55c06b26008df807e368a2b9c74015");
    expect(digest(PUBLIC_SITEMAP_PAGES))
      .toBe("c4c338fe01db24b959e2a28ee478e33ecd96b413040f799573dd72bfff743ebe");
  });

  it("preserves the marketing SSR route and feature order", () => {
    expect(MARKETING_SSR_PATHS).toEqual([
      "/", "/pricing", "/faq", "/a-propos", "/fonctionnalites", "/temoignages",
      "/bande-a-rebond", "/presse", "/plan-du-site", "/blog", "/emploi",
      "/legal", "/cgu", "/cgv", "/confidentialite",
    ]);
    expect(MARKETING_FEATURE_SLUGS).toEqual([
      "suivirechercheemploi", "masterclass", "offres-emploi", "CRM",
      "agent-candidature", "profil-professionnel", "coach-ia",
    ]);
    for (const page of SERVER_PUBLIC_PAGES) {
      expect(isMarketingSsrPath(page.path), page.path).toBe(!!page.marketingSsr);
    }
  });

  it("preserves dedicated HTML and noindex exclusions rather than enabling marketing SSR", () => {
    expect(PUBLIC_PAGE_META.filter(page => page.initialBody).map(page => [page.path, page.initialBody]))
      .toEqual([["/analyse-cv", "cv-analysis"], ["/analyse-linkedin", "linkedin-analysis"], ["/estimation-salaire", "salary-estimate"], ["/test-riasec", "riasec-test"]]);
    expect(PUBLIC_PAGE_META.find(page => page.path === "/signin")?.noindex).toBe(true);
    for (const path of ["/signin", "/legal", "/cgu", "/cgv", "/confidentialite", "/plan-du-site", "/emploi/metiers"]) {
      expect(PUBLIC_SITEMAP_PAGES.some(page => page.path === path), path).toBe(false);
    }
  });

  it("does not expand the dynamic crawler route contract", () => {
    for (const path of ["/blog/article", "/auteur/auteur", "/blog/auteur/auteur"]) {
      expect(isMarketingSsrPath(path), path).toBe(true);
    }
    for (const path of [
      "/inconnue", "/app", "/emploi/o/offre", "/blog/article/suite",
      "/blog/", "/auteur/", "/fonctionnalites/crm", "/fonctionnalites/inconnue",
    ]) {
      expect(isMarketingSsrPath(path), path).toBe(false);
    }
  });
});
