import { SALARY_ESTIMATE_FAQS } from "../shared/salaryEstimateSeo";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Textes publics uniquement. Ne jamais mettre de donnée de profil ni d'identifiant d'estimation dans ce HTML. */
export function salaryEstimateInitialHtml(): string {
  return `<main id="salary-estimate-initial">
    <h1>Quel salaire pouvez-vous demander ?</h1>
    <p>Déposez votre CV ou votre profil LinkedIn : en moins d'une minute, vous savez combien le marché paie un profil comme le vôtre, et pourquoi.</p>
    <h2>Votre fourchette, calculée sur votre parcours</h2>
    <ul>
      <li>Votre métier et votre niveau d'expérience, lus dans votre CV.</li>
      <li>La fourchette du marché pour ce métier, ajustée à votre région.</li>
      <li>Votre place dans cette fourchette, selon vos responsabilités, vos compétences et vos employeurs.</li>
      <li>Les leviers pour viser le haut de la fourchette.</li>
    </ul>
    <p>Activez JavaScript pour déposer votre CV et lancer l'estimation.</p>
    <section aria-labelledby="salary-faq-title">
      <h2 id="salary-faq-title">Questions fréquentes sur l'estimation de salaire</h2>
      ${SALARY_ESTIMATE_FAQS.map(({ question, answer }) => `<article><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></article>`).join("")}
    </section>
    <a href="/analyse-cv">Analyser aussi mon CV</a>
  </main>`;
}
