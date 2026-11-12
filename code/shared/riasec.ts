/**
 * Test RIASEC (Holland) du lead magnet. Questions et calcul identiques au quiz
 * de l'application (`server/data/riasec-48.json`, `quizService.calculateScores`) :
 * un score passé dans l'app et un score passé ici se comparent directement.
 */
import riasecData from "../server/data/riasec-48.json";

export type RiasecDimension = "realistic" | "investigative" | "artistic" | "social" | "enterprising" | "conventional";

export const RIASEC_ORDER: RiasecDimension[] = ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"];

export const RIASEC_DIMENSIONS: Record<RiasecDimension, {
  letter: string;
  label: string;
  /** Ce qui anime la personne, en une phrase à la 2e personne. */
  drive: string;
  /** Exemples de métiers associés à ce type dans le modèle de Holland. */
  jobs: string[];
}> = {
  realistic: {
    letter: "R",
    label: "Réaliste",
    drive: "Vous aimez le concret : manipuler, construire, réparer, voir le résultat de votre travail.",
    jobs: ["Technicien de maintenance", "Électricien", "Conducteur de travaux", "Paysagiste", "Mécanicien", "Agent de production"],
  },
  investigative: {
    letter: "I",
    label: "Investigateur",
    drive: "Vous aimez comprendre : analyser, chercher, résoudre des problèmes complexes.",
    jobs: ["Data analyst", "Ingénieur R&D", "Chercheur", "Pharmacien", "Développeur", "Analyste financier"],
  },
  artistic: {
    letter: "A",
    label: "Artistique",
    drive: "Vous aimez créer : imaginer, exprimer, sortir des sentiers battus.",
    jobs: ["Designer graphique", "Architecte d'intérieur", "Rédacteur", "UX designer", "Photographe", "Chargé de communication"],
  },
  social: {
    letter: "S",
    label: "Social",
    drive: "Vous aimez les autres : aider, transmettre, accompagner.",
    jobs: ["Formateur", "Conseiller en insertion", "Infirmier", "Chargé RH", "Éducateur", "Assistant social"],
  },
  enterprising: {
    letter: "E",
    label: "Entreprenant",
    drive: "Vous aimez entraîner : convaincre, décider, faire avancer un projet.",
    jobs: ["Commercial", "Chef de projet", "Responsable d'agence", "Business developer", "Entrepreneur", "Chargé d'affaires"],
  },
  conventional: {
    letter: "C",
    label: "Conventionnel",
    drive: "Vous aimez l'ordre : organiser, vérifier, fiabiliser les chiffres et les process.",
    jobs: ["Comptable", "Contrôleur de gestion", "Gestionnaire de paie", "Assistant de direction", "Logisticien", "Gestionnaire administratif"],
  },
};

/** Ce qu'on fait au quotidien dans chaque métier d'exemple, pour expliquer pourquoi il correspond. */
export const RIASEC_JOB_WORK: Record<string, string> = {
  "Technicien de maintenance": "Vous diagnostiquez les pannes et remettez les machines en route, souvent dans l'urgence et toujours sur le terrain.",
  "Électricien": "Vous installez et dépannez des réseaux électriques : un travail précis, manuel, dont le résultat se voit tout de suite.",
  "Conducteur de travaux": "Vous faites avancer un chantier du premier coup de pelle à la livraison, entre équipes, planning et contrôle sur place.",
  "Paysagiste": "Vous aménagez et entretenez des jardins et espaces verts, dehors, avec vos mains et des outils.",
  "Mécanicien": "Vous démontez, réparez et réglez des véhicules ou des engins : chaque panne est un problème concret à résoudre.",
  "Agent de production": "Vous faites tourner une ligne de fabrication, réglez les machines et contrôlez ce qui en sort.",
  "Data analyst": "Vous fouillez les données d'une entreprise pour répondre à ses questions et l'aider à décider.",
  "Ingénieur R&D": "Vous concevez et testez de nouveaux produits ou procédés, entre hypothèses, essais et mesures.",
  "Chercheur": "Vous menez des études longues pour faire avancer la connaissance sur un sujet précis.",
  "Pharmacien": "Vous vérifiez les traitements, conseillez les patients et garantissez la sécurité des médicaments.",
  "Développeur": "Vous écrivez et corrigez du code : chaque bug est une énigme logique à démêler.",
  "Analyste financier": "Vous étudiez les comptes et les marchés pour évaluer des entreprises et éclairer des décisions d'investissement.",
  "Designer graphique": "Vous créez l'identité visuelle d'une marque : logos, affiches, supports, du croquis au fichier final.",
  "Architecte d'intérieur": "Vous imaginez et aménagez des espaces, en conciliant envie du client, esthétique et contraintes techniques.",
  "Rédacteur": "Vous écrivez des textes qui doivent informer, convaincre ou donner envie : articles, pages web, contenus de marque.",
  "UX designer": "Vous concevez des applications et des sites simples à utiliser, en partant de ce que vivent les utilisateurs.",
  "Photographe": "Vous composez des images pour des clients ou des médias, du cadrage à la retouche.",
  "Chargé de communication": "Vous racontez l'histoire d'une organisation : messages, réseaux sociaux, événements, relations presse.",
  "Formateur": "Vous transmettez un savoir-faire à des groupes d'adultes et les voyez progresser d'une séance à l'autre.",
  "Conseiller en insertion": "Vous accompagnez des personnes vers l'emploi ou la formation, rendez-vous après rendez-vous.",
  "Infirmier": "Vous soignez, rassurez et suivez des patients au quotidien, au cœur d'une équipe de santé.",
  "Chargé RH": "Vous recrutez, intégrez et accompagnez les salariés tout au long de leur parcours dans l'entreprise.",
  "Éducateur": "Vous accompagnez des enfants, des jeunes ou des adultes en difficulté pour les aider à gagner en autonomie.",
  "Assistant social": "Vous aidez des personnes à faire valoir leurs droits et à sortir d'une situation difficile.",
  "Commercial": "Vous trouvez des clients, comprenez leurs besoins et concluez des ventes, avec des objectifs à atteindre.",
  "Chef de projet": "Vous pilotez un projet de bout en bout : planning, budget, équipe et arbitrages.",
  "Responsable d'agence": "Vous dirigez un point de vente ou une agence : équipe, clients, chiffre d'affaires.",
  "Business developer": "Vous ouvrez de nouveaux marchés et signez des partenariats pour faire grandir l'entreprise.",
  "Entrepreneur": "Vous créez et développez votre propre activité, en prenant les décisions et les risques.",
  "Chargé d'affaires": "Vous suivez un portefeuille de clients, montez les offres et défendez les intérêts de l'entreprise en négociation.",
  "Comptable": "Vous tenez les comptes d'une entreprise, vérifiez chaque écriture et préparez les bilans.",
  "Contrôleur de gestion": "Vous suivez les budgets et les indicateurs, repérez les écarts et aidez la direction à piloter.",
  "Gestionnaire de paie": "Vous établissez les bulletins de salaire en appliquant des règles précises : aucune erreur n'est permise.",
  "Assistant de direction": "Vous organisez l'agenda, les dossiers et les échanges d'un dirigeant pour que tout soit prêt à temps.",
  "Logisticien": "Vous organisez les flux de marchandises, des stocks aux livraisons, pour que tout arrive au bon endroit.",
  "Gestionnaire administratif": "Vous traitez les dossiers, tenez les procédures à jour et assurez le suivi administratif d'un service.",
};

/** Fiche détaillée de chaque type, affichée sur la page de résultat. */
export const RIASEC_PROFILES: Record<RiasecDimension, {
  /** Ce que la personne aime faire, en verbes. */
  activities: string;
  strengths: string[];
  /** Comment les autres la décrivent. */
  seenAs: string;
  /** Ce qui l'use au travail. */
  drains: string;
  cvKeywords: string[];
  /** L'environnement où ce type se sent bien. */
  thrive: string;
  /** Ce qui attend la personne quand ce type est parmi ses plus faibles. */
  struggle: string;
}> = {
  realistic: {
    activities: "Réparer, monter, conduire, installer, fabriquer : travailler avec des outils, des machines, la matière ou le vivant.",
    strengths: ["Habileté manuelle et technique", "Sens pratique : vous allez droit à la solution qui marche", "Endurance et fiabilité sur le terrain"],
    seenAs: "Quelqu'un de concret, direct et débrouillard, qui préfère faire que discuter.",
    drains: "Les réunions sans décision, les tâches abstraites dont on ne voit jamais le résultat, des journées entières devant un écran.",
    cvKeywords: ["maintenance", "installation", "diagnostic de panne", "habilitations", "sécurité", "respect des normes"],
    thrive: "Vous êtes à votre place quand le travail se passe sur le terrain, dans un atelier, sur un chantier ou en extérieur, avec du matériel à manipuler. Les équipes y sont souvent petites et directes : on se dit les choses, on règle le problème, on passe au suivant. Ce qui vous motive, c'est de voir à la fin de la journée ce que vous avez réparé, monté ou livré. Cherchez des postes avec une vraie part d'action et de l'autonomie sur la manière de faire.",
    struggle: "Les postes très physiques ou techniques risquent de vous peser : travail manuel répétitif, chantiers, ateliers, maintenance, horaires postés. Vous y dépenseriez beaucoup d'énergie sur ce qui ne vous intéresse pas, sans en tirer de satisfaction. Si une offre parle surtout de matériel, de machines ou de terrain, vérifiez la part réelle de ce travail avant de postuler.",
  },
  investigative: {
    activities: "Analyser, chercher, comparer, tester des hypothèses : comprendre comment les choses fonctionnent avant d'agir.",
    strengths: ["Esprit d'analyse et rigueur", "Curiosité et goût d'apprendre vite", "Résolution de problèmes complexes"],
    seenAs: "Quelqu'un de réfléchi, précis et indépendant, qui pose les bonnes questions.",
    drains: "Décider vite sans données, répéter les mêmes tâches sans rien apprendre, vendre ou convaincre à tout prix.",
    cvKeywords: ["analyse de données", "résolution de problèmes", "méthodologie", "veille", "esprit critique", "rapports d'analyse"],
    thrive: "Vous êtes à votre place dans un environnement qui laisse le temps de comprendre avant d'agir : un service d'études, un laboratoire, une équipe data ou technique. Vous appréciez les collègues compétents avec qui on peut débattre sur le fond, et les managers qui jugent la qualité du raisonnement plus que la présence en réunion. Les problèmes nouveaux vous stimulent : un poste où l'on apprend en continu vous gardera motivé longtemps. Le calme pour vous concentrer et l'autonomie comptent beaucoup pour vous.",
    struggle: "Les postes d'expertise pure risquent de vous ennuyer : longues analyses, recherche, rapports détaillés, travail seul sur des sujets très techniques. Vous avez besoin de voir vite l'effet concret de ce que vous faites, plutôt que de creuser un problème pendant des semaines. Méfiez-vous des offres où « analyse » et « étude » reviennent à chaque ligne.",
  },
  artistic: {
    activities: "Imaginer, concevoir, écrire, dessiner, mettre en forme : créer quelque chose qui n'existait pas.",
    strengths: ["Créativité et originalité", "Sens esthétique", "Talent pour rendre une idée claire et marquante"],
    seenAs: "Quelqu'un d'imaginatif, sensible et indépendant, qui sort des sentiers battus.",
    drains: "Les procédures rigides, les tâches répétitives, un cadre qui ne laisse aucune marge sur la manière de faire.",
    cvKeywords: ["conception", "créativité", "direction artistique", "rédaction", "storytelling", "portfolio"],
    thrive: "Vous êtes à votre place dans une structure qui laisse de la liberté sur la forme : une agence, un studio, une équipe produit ou communication, ou à votre compte. Vous avez besoin de projets variés, de temps pour chercher des idées et de retours sur votre travail. Les ambiances informelles, où l'on peut proposer sans passer par cinq validations, vous réussissent. Vous donnez le meilleur de vous quand on vous confie un objectif et qu'on vous laisse choisir le chemin.",
    struggle: "Les postes où il faut sans cesse inventer risquent de vous fatiguer : création, conception graphique, écriture, métiers où l'on attend de vous des idées neuves en permanence. Le flou d'un brief créatif et le jugement subjectif porté sur votre travail peuvent devenir pesants. Vous serez plus à l'aise avec des objectifs clairs et des critères de réussite précis.",
  },
  social: {
    activities: "Accompagner, former, conseiller, soigner, écouter : être utile aux personnes, en direct.",
    strengths: ["Écoute et empathie", "Pédagogie", "Sens du service et du collectif"],
    seenAs: "Quelqu'un de chaleureux, patient et disponible, vers qui on vient naturellement.",
    drains: "Travailler seul toute la journée, les relations purement transactionnelles, les postes où l'humain passe après les chiffres.",
    cvKeywords: ["accompagnement", "relation usager", "pédagogie", "écoute active", "travail en équipe", "médiation"],
    thrive: "Vous êtes à votre place là où le travail se fait avec et pour des personnes : formation, santé, accompagnement, ressources humaines, relation client. Une équipe soudée, où l'on s'entraide et où l'ambiance compte, vous porte. Ce qui vous nourrit, c'est de voir quelqu'un avancer grâce à vous. Cherchez des organisations dont les valeurs vous parlent : vous travaillez mieux quand vous croyez à ce que vous faites.",
    struggle: "Les postes centrés sur l'accompagnement risquent de vous vider : accueil du public toute la journée, soin, écoute de situations difficiles, animation de groupes. La charge émotionnelle de ces métiers pèse lourd quand ce n'est pas ce qui vous anime. Si une offre insiste sur la relation, l'écoute ou le contact permanent, demandez-vous combien d'heures par jour cela représente.",
  },
  enterprising: {
    activities: "Convaincre, négocier, décider, lancer des projets : faire bouger les choses et entraîner les autres.",
    strengths: ["Leadership et prise d'initiative", "Aisance à l'oral et force de persuasion", "Goût du défi et des objectifs"],
    seenAs: "Quelqu'un d'énergique, ambitieux et sûr de soi, qui prend les choses en main.",
    drains: "Exécuter sans pouvoir décider, les postes sans objectif ni reconnaissance, les tâches de détail interminables.",
    cvKeywords: ["développement commercial", "négociation", "pilotage de projet", "management", "atteinte d'objectifs", "prise de décision"],
    thrive: "Vous êtes à votre place dans un environnement à objectifs, qui bouge et récompense l'initiative : une entreprise en croissance, un poste commercial, la conduite d'une équipe ou d'un projet. Vous aimez avoir des responsabilités, de la visibilité et une vraie marge de décision. Les défis chiffrés vous stimulent, à condition de voir le lien entre vos efforts et vos résultats. Une rémunération ou une évolution liée à la performance vous motive plus qu'un cadre très stable.",
    struggle: "Les postes de vente, de négociation ou de management risquent de vous mettre sous pression : objectifs chiffrés, prospection, prise de parole pour convaincre, compétition entre collègues. Vous pouvez le faire, mais au prix d'un effort constant qui use. Méfiez-vous des offres où « challenge », « chasse » et « résultats » reviennent souvent, et de celles où les primes pèsent lourd dans le salaire.",
  },
  conventional: {
    activities: "Organiser, classer, vérifier, suivre des chiffres et des process : faire en sorte que tout soit juste et à jour.",
    strengths: ["Rigueur et souci du détail", "Sens de l'organisation", "Fiabilité : on peut compter sur vous"],
    seenAs: "Quelqu'un de méthodique, sérieux et ponctuel, qui ne laisse rien au hasard.",
    drains: "Le flou, les changements de cap permanents, l'improvisation et les consignes contradictoires.",
    cvKeywords: ["rigueur", "gestion administrative", "suivi budgétaire", "conformité", "tableaux de bord", "organisation"],
    thrive: "Vous êtes à votre place dans une organisation structurée, avec des process clairs, des rôles bien définis et des outils fiables : un service comptable, administratif ou logistique, une banque, une grande entreprise. Vous aimez savoir ce qu'on attend de vous et pouvoir le faire bien, du premier coup. Un manager qui donne des consignes précises et tient ses engagements vous met en confiance. La régularité ne vous ennuie pas : elle vous permet d'être efficace et de progresser.",
    struggle: "Les postes très encadrés risquent de vous étouffer : procédures strictes, saisie, contrôles, reporting, tâches administratives répétées chaque jour. Vous risquez de vous sentir enfermé dans un cadre qui ne laisse aucune place à votre manière de faire. Regardez la part de suivi et de contrôle dans chaque offre : si elle domine, c'est un signal d'alerte.",
  },
};

export type RiasecQuestion = { order: number; text: string; dimension: RiasecDimension };

export const RIASEC_QUESTIONS: RiasecQuestion[] = riasecData.questions.map((question) => ({
  order: question.order,
  text: question.textFr,
  dimension: question.scoringWeights[0].dimensionId as RiasecDimension,
}));

export const RIASEC_OPTIONS = riasecData.likertOptions.map((option) => ({ value: option.value, label: option.textFr }));

/** Réponses indexées par numéro de question (`order`), valeurs de 1 à 5. */
export type RiasecAnswers = Record<number, number>;

export function isCompleteRiasec(answers: unknown): answers is RiasecAnswers {
  if (!answers || typeof answers !== "object") return false;
  const values = answers as Record<string, unknown>;
  return RIASEC_QUESTIONS.every(({ order }) => {
    const value = values[order];
    return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;
  });
}

/** Même formule que l'application : somme des réponses / maximum possible × 100. */
export function scoreRiasec(answers: RiasecAnswers): Record<RiasecDimension, number> {
  const raw = Object.fromEntries(RIASEC_ORDER.map((dim) => [dim, { sum: 0, max: 0 }])) as Record<RiasecDimension, { sum: number; max: number }>;
  for (const question of riasecData.questions) {
    const answer = answers[question.order];
    if (!answer) continue;
    for (const weight of question.scoringWeights) {
      const dim = raw[weight.dimensionId as RiasecDimension];
      if (!dim) continue;
      dim.sum += (weight.reversed ? 6 - answer : answer) * weight.weight;
      dim.max += 5 * weight.weight;
    }
  }
  return Object.fromEntries(RIASEC_ORDER.map((dim) => [dim, raw[dim].max ? Math.round((raw[dim].sum / raw[dim].max) * 100) : 0])) as Record<RiasecDimension, number>;
}

/** Les trois dimensions dominantes ; à égalité, l'ordre R-I-A-S-E-C départage. */
export function hollandCode(scores: Record<RiasecDimension, number>): RiasecDimension[] {
  return [...RIASEC_ORDER].sort((a, b) => scores[b] - scores[a] || RIASEC_ORDER.indexOf(a) - RIASEC_ORDER.indexOf(b)).slice(0, 3);
}

/** Profil plat : peu d'écart entre le premier et le troisième intérêt. */
export function isFlatProfile(scores: Record<RiasecDimension, number>): boolean {
  const sorted = RIASEC_ORDER.map((dim) => scores[dim]).sort((a, b) => b - a);
  return sorted[0] - sorted[5] < 15;
}

/** Ordre aléatoire stable pour une graine donnée (le test garde son ordre après un rechargement). */
export function shuffledQuestions(seed: number): RiasecQuestion[] {
  const list = [...RIASEC_QUESTIONS];
  let state = seed >>> 0 || 1;
  const next = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Écart sous lequel deux scores sont considérés comme à égalité (règle des 8 points du SDS, ramenée à notre échelle). */
export const RIASEC_TIE_GAP = 8;

/** Lisibilité du profil : écart entre le 1er et le 3e score (différenciation de Spokane et Walsh). */
export function profileClarity(scores: Record<RiasecDimension, number>): "net" | "nuance" | "polyvalent" {
  if (isFlatProfile(scores)) return "polyvalent";
  const sorted = RIASEC_ORDER.map((dim) => scores[dim]).sort((a, b) => b - a);
  return sorted[0] - sorted[2] >= 15 ? "net" : "nuance";
}

/** Distance entre deux types sur l'hexagone R-I-A-S-E-C : 1 voisins, 2 alternés, 3 opposés. */
export function hexagonDistance(a: RiasecDimension, b: RiasecDimension): 1 | 2 | 3 {
  const gap = Math.abs(RIASEC_ORDER.indexOf(a) - RIASEC_ORDER.indexOf(b));
  return Math.min(gap, 6 - gap) as 1 | 2 | 3;
}

/** Codes voisins à explorer quand deux lettres du code sont presque à égalité. */
export function alternativeCodes(scores: Record<RiasecDimension, number>): string[] {
  const ranked = [...RIASEC_ORDER].sort((a, b) => scores[b] - scores[a] || RIASEC_ORDER.indexOf(a) - RIASEC_ORDER.indexOf(b));
  const letters = (dims: RiasecDimension[]) => dims.slice(0, 3).map((dim) => RIASEC_DIMENSIONS[dim].letter).join("");
  const main = letters(ranked);
  const codes: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (scores[ranked[i]] - scores[ranked[i + 1]] >= RIASEC_TIE_GAP) continue;
    const swapped = [...ranked];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    const code = letters(swapped);
    if (code !== main && !codes.includes(code)) codes.push(code);
  }
  return codes;
}
