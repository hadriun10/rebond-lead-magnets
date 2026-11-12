import { CV_ANALYSIS_TITLE, CV_ANALYSIS_DESCRIPTION, CV_ANALYSIS_CANONICAL, CV_ANALYSIS_FAQ_SCHEMA, CV_ANALYSIS_WEB_APPLICATION_SCHEMA } from "./cvAnalysisSeo";
import { LINKEDIN_ANALYSIS_FAQ_SCHEMA, LINKEDIN_ANALYSIS_WEB_APPLICATION_SCHEMA } from "./linkedinAnalysisSeo";
import { SALARY_ESTIMATE_CANONICAL, SALARY_ESTIMATE_DESCRIPTION, SALARY_ESTIMATE_FAQ_SCHEMA, SALARY_ESTIMATE_PATH, SALARY_ESTIMATE_TITLE, SALARY_ESTIMATE_WEB_APPLICATION_SCHEMA } from "./salaryEstimateSeo";
import { RIASEC_TEST_CANONICAL, RIASEC_TEST_DESCRIPTION, RIASEC_TEST_FAQ_SCHEMA, RIASEC_TEST_PATH, RIASEC_TEST_TITLE, RIASEC_TEST_WEB_APPLICATION_SCHEMA } from "./riasecTestSeo";

export type MarketingRenderer = "home" | "pricing" | "faq" | "about" | "features" | "feature" | "testimonials" | "team" | "press" | "sitemap" | "blog" | "jobs" | "legal" | "terms" | "salesTerms" | "privacy";
export interface PublicPageMeta {
  title: string;
  description: string;
  canonical: string;
  h1?: string;
  noindex?: boolean;
  ogImage?: string;
  featureName?: string;
  jsonLd?: Record<string, unknown> | unknown[];
  suppressKeywords?: boolean;
  initialBody?: "cv-analysis" | "linkedin-analysis" | "salary-estimate" | "riasec-test";
}
export interface ServerPublicPage {
  path: string;
  meta?: PublicPageMeta;
  sitemap?: { order: number; changefreq: string; priority: string };
  sitemapFamily?: "metiers";
  marketingSsr?: MarketingRenderer;
  marketingOrder?: number;
  images?: readonly { path: string; title: string; caption?: string }[];
}

/**
 * Single server declaration of static public pages. Missing flags are intentional:
 * legal pages use component SEO, analyses use dedicated HTML, signin is noindex.
 * Dynamic resources retain their data-dependent SEO in their existing handlers.
 * Ordering preserves the existing sitemap and SSR exports.
 */
export const SERVER_PUBLIC_PAGES: readonly ServerPublicPage[] = [
  {
    path: "/",
    sitemap: { order: 0, changefreq: "weekly", priority: "1.0" },
    marketingSsr: "home", marketingOrder: 0,
    images: [
      {
        path: "/img/app-screenshot.webp",
        title: "Interface de l&apos;application Rebond — tableau de bord",
        caption: "Tableau de bord Rebond : suivi des candidatures, offres d&apos;emploi personnalisées et coaching IA",
      },
      {
        path: "/img/photo-valerie.webp",
        title: "Valérie, fondatrice de Rebond",
        caption: "Valérie Mas, fondatrice de Rebond, plateforme d&apos;accompagnement à la recherche d&apos;emploi",
      },
    ],
    meta: {
      title: "Rebond — Accélérez votre recherche d'emploi",
      description: "Décrochez votre prochain poste 3 fois plus vite. Rebond identifie les annonces qui vous correspondent, adapte votre CV, écrit vos candidatures et garde une longueur d'avance pour vous.",
      canonical: "https://rebond.pro/",
      h1: "Accélérez votre recherche d'emploi",
    },
  },
  {
    path: "/signin",
    meta: {
      title: "Connexion — Rebond",
      description: "Connectez-vous à votre compte Rebond.",
      canonical: "https://rebond.pro/signin",
      h1: "Bienvenue",
      noindex: true,
    },
  },
  {
    path: "/pricing",
    sitemap: { order: 5, changefreq: "monthly", priority: "0.7" },
    marketingSsr: "pricing", marketingOrder: 1,
    meta: {
      title: "Tarifs Rebond — Gratuit ou Premium",
      description: "Choisissez le plan qui correspond à votre recherche d'emploi. Commencez gratuitement et passez à Premium pour l'IA illimitée, le CV Studio et la candidature automatisée.",
      canonical: "https://rebond.pro/pricing",
    },
  },
  {
    path: "/analyse-cv",
    sitemap: { order: 1, changefreq: "monthly", priority: "0.8" },
    meta: {
      title: CV_ANALYSIS_TITLE,
      description: CV_ANALYSIS_DESCRIPTION,
      canonical: CV_ANALYSIS_CANONICAL,
      ogImage: "https://rebond.pro/og-analyse-cv.jpg",
      jsonLd: [CV_ANALYSIS_FAQ_SCHEMA, CV_ANALYSIS_WEB_APPLICATION_SCHEMA],
      suppressKeywords: true,
      initialBody: "cv-analysis",
    },
  },
  {
    path: "/analyse-linkedin",
    sitemap: { order: 2, changefreq: "monthly", priority: "0.8" },
    meta: {
      title: "Analyse de profil LinkedIn gratuite : score et corrections | Rebond",
      description: "Analysez votre profil LinkedIn gratuitement : score sur 100, titre, À propos, expériences, compétences et plan d'action pour être trouvé par les recruteurs.",
      canonical: "https://rebond.pro/analyse-linkedin",
      ogImage: "https://rebond.pro/og-analyse-linkedin.jpg",
      jsonLd: [LINKEDIN_ANALYSIS_FAQ_SCHEMA, LINKEDIN_ANALYSIS_WEB_APPLICATION_SCHEMA],
      suppressKeywords: true,
      initialBody: "linkedin-analysis",
    },
  },
  {
    path: SALARY_ESTIMATE_PATH,
    sitemap: { order: 2.5, changefreq: "monthly", priority: "0.8" },
    meta: {
      title: SALARY_ESTIMATE_TITLE,
      description: SALARY_ESTIMATE_DESCRIPTION,
      canonical: SALARY_ESTIMATE_CANONICAL,
      jsonLd: [SALARY_ESTIMATE_FAQ_SCHEMA, SALARY_ESTIMATE_WEB_APPLICATION_SCHEMA],
      suppressKeywords: true,
      initialBody: "salary-estimate",
    },
  },
  {
    path: RIASEC_TEST_PATH,
    sitemap: { order: 2.6, changefreq: "monthly", priority: "0.8" },
    meta: {
      title: RIASEC_TEST_TITLE,
      description: RIASEC_TEST_DESCRIPTION,
      canonical: RIASEC_TEST_CANONICAL,
      jsonLd: [RIASEC_TEST_FAQ_SCHEMA, RIASEC_TEST_WEB_APPLICATION_SCHEMA],
      suppressKeywords: true,
      initialBody: "riasec-test",
    },
  },
  {
    path: "/faq",
    sitemap: { order: 16, changefreq: "monthly", priority: "0.5" },
    marketingSsr: "faq", marketingOrder: 2,
    meta: {
      title: "FAQ — Foire aux questions | Rebond",
      description: "Toutes vos questions sur Rebond : fonctionnement, tarifs, fonctionnalités, IA, offres d'emploi, CV Studio et plus encore.",
      canonical: "https://rebond.pro/faq",
    },
  },
  {
    path: "/a-propos",
    sitemap: { order: 14, changefreq: "monthly", priority: "0.6" },
    marketingSsr: "about", marketingOrder: 3,
    meta: {
      title: "À propos de Rebond — La plateforme française de reconversion professionnelle",
      description: "Découvrez Rebond, la plateforme qui combine microlearning, coaching IA et outils de candidature intelligents pour accélérer votre transition professionnelle en France.",
      canonical: "https://rebond.pro/a-propos",
    },
  },
  {
    path: "/fonctionnalites",
    sitemap: { order: 6, changefreq: "monthly", priority: "0.7" },
    marketingSsr: "features", marketingOrder: 4,
    meta: {
      title: "Fonctionnalités Rebond — Organisez votre recherche d'emploi",
      description: "Découvrez les outils Rebond pour trouver des offres, préparer vos candidatures, suivre vos démarches et avancer jusqu'à l'entretien.",
      canonical: "https://rebond.pro/fonctionnalites",
    },
  },
  {
    path: "/fonctionnalites/suivirechercheemploi",
    sitemap: { order: 7, changefreq: "monthly", priority: "0.7" },
    marketingSsr: "feature",
    meta: {
      title: "Suivre sa recherche d'emploi avec méthode | Rebond",
      description: "Rebond aide à organiser sa recherche d'emploi, suivre ses actions et avancer avec plus de clarté.",
      canonical: "https://rebond.pro/fonctionnalites/suivirechercheemploi",
      featureName: "Mon dashboard",
    },
  },
  {
    path: "/fonctionnalites/masterclass",
    sitemap: { order: 8, changefreq: "monthly", priority: "0.7" },
    marketingSsr: "feature",
    meta: {
      title: "Masterclass pour avancer dans sa recherche d'emploi | Rebond",
      description: "Les masterclass Rebond proposent des contenus experts et actionnables pour clarifier son projet et préparer sa recherche d'emploi.",
      canonical: "https://rebond.pro/fonctionnalites/masterclass",
      featureName: "Mes masterclass",
    },
  },
  {
    path: "/fonctionnalites/offres-emploi",
    sitemap: { order: 9, changefreq: "weekly", priority: "0.7" },
    marketingSsr: "feature",
    meta: {
      title: "Offres d'emploi : explorer et organiser sa recherche | Rebond",
      description: "Rebond vous aide à retrouver les offres d'emploi qui vous intéressent et à organiser vos possibilités au même endroit.",
      canonical: "https://rebond.pro/fonctionnalites/offres-emploi",
      featureName: "Mes offres d'emploi",
    },
  },
  {
    path: "/fonctionnalites/CRM",
    sitemap: { order: 10, changefreq: "monthly", priority: "0.7" },
    marketingSsr: "feature",
    meta: {
      title: "CRM de candidature pour organiser sa recherche d'emploi | Rebond",
      description: "Le CRM Rebond aide à suivre ses candidatures, ses relances et les étapes de sa recherche d'emploi.",
      canonical: "https://rebond.pro/fonctionnalites/CRM",
      featureName: "Mon CRM de candidature",
    },
  },
  {
    path: "/fonctionnalites/agent-candidature",
    sitemap: { order: 11, changefreq: "monthly", priority: "0.7" },
    marketingSsr: "feature",
    meta: {
      title: "Agent de candidature pour préparer ses candidatures | Rebond",
      description: "L'agent de candidature Rebond aide à mieux cibler et préparer ses candidatures, étape par étape.",
      canonical: "https://rebond.pro/fonctionnalites/agent-candidature",
      featureName: "Mon agent de candidature",
    },
  },
  {
    path: "/fonctionnalites/profil-professionnel",
    sitemap: { order: 12, changefreq: "monthly", priority: "0.7" },
    marketingSsr: "feature",
    meta: {
      title: "Profil professionnel : clarifier son parcours avec Rebond | Rebond",
      description: "Rebond aide à construire un profil professionnel lisible, fidèle à son parcours et utile pour ses prochaines candidatures.",
      canonical: "https://rebond.pro/fonctionnalites/profil-professionnel",
      featureName: "Mon profil professionnel",
    },
  },
  {
    path: "/fonctionnalites/coach-ia",
    sitemap: { order: 13, changefreq: "monthly", priority: "0.7" },
    marketingSsr: "feature",
    meta: {
      title: "Coach IA pour accompagner sa recherche d'emploi | Rebond",
      description: "Le coach IA Rebond aide à préparer les moments clés de sa recherche d'emploi, sans remplacer son jugement.",
      canonical: "https://rebond.pro/fonctionnalites/coach-ia",
      featureName: "Mon coach IA",
    },
  },
  {
    path: "/temoignages",
    sitemap: { order: 15, changefreq: "monthly", priority: "0.6" },
    marketingSsr: "testimonials", marketingOrder: 5,
    images: [{ path: "/img/og-temoignages.jpg", title: "Témoignages — Rebond" }],
    meta: {
      title: "Avis Google | Rebond",
      description: "Consultez les avis publics publiés sur le profil Google Business de Rebond.",
      canonical: "https://rebond.pro/temoignages",
      ogImage: "https://rebond.pro/img/og-temoignages.jpg",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            "@id": "https://rebond.pro/temoignages/#collectionpage",
            url: "https://rebond.pro/temoignages",
            name: "Avis Google sur Rebond",
            description: "Consultez les avis publics publiés sur le profil Google Business de Rebond.",
            inLanguage: "fr-FR",
            mainEntity: { "@id": "https://rebond.pro/#software" },
          },
          {
            "@type": "SoftwareApplication",
            "@id": "https://rebond.pro/#software",
            name: "Rebond",
            url: "https://rebond.pro/",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            sameAs: "https://www.google.com/maps?cid=15343905438049026521&hl=fr",
          },
        ],
      },
    },
  },
  {
    path: "/emploi",
    sitemap: { order: 3, changefreq: "daily", priority: "0.9" },
    marketingSsr: "jobs", marketingOrder: 10,
    meta: {
      title: "Offres d'emploi cadres en France — Rebond",
      description: "Trouvez les offres d'emploi qui vous correspondent parmi des milliers d'annonces sélectionnées pour cadres et professionnels en France. Recherche intelligente par poste, secteur et localisation.",
      canonical: "https://rebond.pro/emploi",
      h1: "Trouvez le job de vos rêves",
    },
  },
  {
    path: "/blog",
    sitemap: { order: 4, changefreq: "weekly", priority: "0.8" },
    marketingSsr: "blog", marketingOrder: 9,
    meta: {
      title: "Blog Rebond — Conseils carrière et emploi",
      description: "Conseils, guides et actualités pour accélérer votre recherche d'emploi : CV, entretiens, réseautage, reconversion et coaching carrière.",
      canonical: "https://rebond.pro/blog",
    },
  },
  {
    path: "/bande-a-rebond",
    marketingSsr: "team", marketingOrder: 6,
    meta: {
      title: "La Bande à Rebond — Notre équipe",
      description: "Découvrez l'équipe derrière Rebond, la plateforme française dédiée à l'accélération de votre recherche d'emploi et à votre développement de carrière.",
      canonical: "https://rebond.pro/bande-a-rebond",
    },
  },
  {
    path: "/presse",
    marketingSsr: "press", marketingOrder: 7,
    meta: {
      title: "Presse — Rebond dans les médias",
      description: "Retrouvez les mentions presse, les dossiers de presse et les contacts média de Rebond, la plateforme de carrière pour cadres en France.",
      canonical: "https://rebond.pro/presse",
    },
  },
  // Component-owned metadata, not new fallback HTML handlers.
  { path: "/plan-du-site", marketingSsr: "sitemap", marketingOrder: 8 },
  { path: "/legal", marketingSsr: "legal", marketingOrder: 11 },
  { path: "/cgu", marketingSsr: "terms", marketingOrder: 12 },
  { path: "/cgv", marketingSsr: "salesTerms", marketingOrder: 13 },
  { path: "/confidentialite", marketingSsr: "privacy", marketingOrder: 14 },
  { path: "/emploi/metiers", sitemapFamily: "metiers" },
];

export const PUBLIC_PAGE_META = SERVER_PUBLIC_PAGES.flatMap(page =>
  page.meta ? [{ path: page.path, ...page.meta }] : []);

export const PUBLIC_SITEMAP_PAGES = SERVER_PUBLIC_PAGES.flatMap(page =>
  page.sitemap ? [{ path: page.path, ...page.sitemap }] : [])
  .sort((a, b) => a.order - b.order);

// Titles/captions preserve the existing XML entities, rather than being re-escaped.
export const PUBLIC_IMAGE_SITEMAP_PAGES = SERVER_PUBLIC_PAGES.flatMap(page =>
  page.images ? [{ path: page.path, images: page.images }] : []);
