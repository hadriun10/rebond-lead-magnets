import { RIASEC_TEST_FAQS } from "../shared/riasecTestSeo";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Textes publics uniquement. Ne jamais mettre de réponse ni d'identifiant de résultat dans ce HTML. */
export function riasecTestInitialHtml(): string {
  return `<main id="riasec-test-initial">
    <h1>Test RIASEC : trouvez les métiers qui vous ressemblent</h1>
    <p>48 questions, une dizaine de minutes : vous obtenez votre code à 3 lettres, vos scores sur les six types d'intérêts et les métiers qui vous correspondent.</p>
    <h2>Les six types d'intérêts</h2>
    <ul>
      <li>Réaliste : le concret, manipuler, construire, réparer.</li>
      <li>Investigateur : comprendre, analyser, chercher.</li>
      <li>Artistique : créer, imaginer, exprimer.</li>
      <li>Social : aider, transmettre, accompagner.</li>
      <li>Entreprenant : convaincre, décider, entraîner.</li>
      <li>Conventionnel : organiser, vérifier, fiabiliser.</li>
    </ul>
    <p>Activez JavaScript pour passer le test.</p>
    <section aria-labelledby="riasec-faq-title">
      <h2 id="riasec-faq-title">Questions fréquentes sur le test RIASEC</h2>
      ${RIASEC_TEST_FAQS.map(({ question, answer }) => `<article><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></article>`).join("")}
    </section>
    <a href="/estimation-salaire">Estimer aussi mon salaire</a>
  </main>`;
}
