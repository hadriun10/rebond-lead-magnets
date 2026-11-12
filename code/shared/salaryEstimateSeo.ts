/** Textes publics partagés : FAQ visible, HTML pour les robots et JSON-LD restent alignés. */
export const SALARY_ESTIMATE_PATH = "/estimation-salaire";
export const SALARY_ESTIMATE_CANONICAL = "https://rebond.pro/estimation-salaire";
export const SALARY_ESTIMATE_TITLE = "Quel salaire demander ? Estimation gratuite depuis votre CV | Rebond";
export const SALARY_ESTIMATE_DESCRIPTION =
  "Découvrez le salaire auquel vous pouvez prétendre : fourchette brute annuelle selon votre métier, votre expérience et votre région, calculée depuis votre CV ou votre profil LinkedIn.";

export const SALARY_ESTIMATE_FAQS = [
  {
    question: "L'estimation de salaire est-elle gratuite ?",
    answer: "Oui, et sans créer de compte. Déposez votre CV ou collez l'adresse de votre profil LinkedIn : votre fourchette s'affiche en moins d'une minute.",
  },
  {
    question: "Comment la fourchette est-elle calculée ?",
    answer: "L'IA lit votre parcours : métier, années d'expérience, responsabilités, type d'employeur. Le montant, lui, vient de nos grilles de salaire par métier, niveau d'expérience et région, pas de l'IA. Votre profil vous place ensuite plus ou moins haut dans la fourchette du marché.",
  },
  {
    question: "Le montant est-il brut ou net ?",
    answer: "La fourchette est en salaire fixe brut annuel, hors primes et variable, comme dans une offre d'emploi. Nous indiquons aussi l'équivalent net mensuel approximatif.",
  },
  {
    question: "Le salaire change-t-il selon la ville ?",
    answer: "Oui. À poste égal, les salaires sont environ 15 % plus élevés en Île-de-France et 5 % plus élevés dans les grandes métropoles régionales. L'estimation tient compte de votre localisation.",
  },
  {
    question: "Comment négocier avec cette estimation ?",
    answer: "Annoncez une prétention dans le haut de votre fourchette personnelle et appuyez-la sur les points forts relevés dans votre parcours. Les leviers proposés vous disent quoi mettre en avant pour viser plus haut.",
  },
  {
    question: "Mon CV est-il conservé ?",
    answer: "Non. Votre CV sert uniquement à calculer l'estimation et n'est pas stocké. L'estimation elle-même expire au bout d'une heure.",
  },
] as const;

export const SALARY_ESTIMATE_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: SALARY_ESTIMATE_FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export const SALARY_ESTIMATE_WEB_APPLICATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Estimation de salaire gratuite Rebond",
  url: SALARY_ESTIMATE_CANONICAL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "fr",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};
