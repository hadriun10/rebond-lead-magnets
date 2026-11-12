/** Textes publics partagés : FAQ visible, HTML pour les robots et JSON-LD restent alignés. */
export const RIASEC_TEST_PATH = "/test-riasec";
export const RIASEC_TEST_CANONICAL = "https://rebond.pro/test-riasec";
export const RIASEC_TEST_TITLE = "Test RIASEC gratuit : vos intérêts professionnels et les métiers qui vous vont | Rebond";
export const RIASEC_TEST_DESCRIPTION =
  "Passez le test d'orientation RIASEC gratuitement : 48 questions, votre code à 3 lettres, les métiers et les environnements de travail qui vous correspondent.";

export const RIASEC_TEST_FAQS = [
  {
    question: "Qu'est-ce que le test RIASEC ?",
    answer: "C'est le test d'intérêts professionnels le plus utilisé en orientation. Il mesure votre attirance pour six types d'activités : Réaliste, Investigateur, Artistique, Social, Entreprenant et Conventionnel. Vos trois types dominants forment votre code à 3 lettres.",
  },
  {
    question: "Combien de temps dure le test ?",
    answer: "Une dizaine de minutes : 48 affirmations, une par écran, auxquelles vous répondez de « pas du tout d'accord » à « tout à fait d'accord ». Il n'y a pas de bonne ou de mauvaise réponse.",
  },
  {
    question: "Le test RIASEC est-il gratuit ?",
    answer: "Oui, et sans créer de compte. Votre résultat s'affiche dès la dernière réponse : votre code à 3 lettres, vos scores sur les six types, des métiers et des environnements de travail qui vous correspondent.",
  },
  {
    question: "À quoi sert mon code RIASEC dans ma recherche d'emploi ?",
    answer: "À cibler les postes où vous serez motivé sur la durée, et à expliquer vos choix en entretien. Un code « SEC », par exemple, oriente vers des métiers au contact des personnes, avec de l'organisation et des responsabilités.",
  },
  {
    question: "Mes intérêts peuvent-ils changer ?",
    answer: "Ils sont assez stables à l'âge adulte, mais l'expérience les fait évoluer. Repasser le test après une reconversion ou quelques années dans un poste est utile.",
  },
] as const;

export const RIASEC_TEST_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: RIASEC_TEST_FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export const RIASEC_TEST_WEB_APPLICATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Test RIASEC gratuit Rebond",
  url: RIASEC_TEST_CANONICAL,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  inLanguage: "fr",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};
