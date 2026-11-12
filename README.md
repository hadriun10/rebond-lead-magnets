# Lead magnets Rebond : estimation de salaire et test RIASEC

Deux outils gratuits, utilisables sans compte, sur le même modèle que l'analyse de CV et
l'analyse LinkedIn : le visiteur obtient tout de suite un premier résultat, et la connexion
(LinkedIn ou e-mail) débloque le détail puis le garde dans son espace Rebond.

| Outil | Adresse | Ce que le visiteur obtient |
|---|---|---|
| Estimation de salaire | `/estimation-salaire` | Sa fourchette de salaire brut à partir de son CV ou de son profil LinkedIn, ce que chaque atout lui rapporte, une note par pilier et les leviers pour être mieux payé au prochain poste |
| Test RIASEC | `/test-riasec` | Son code à 3 lettres après 48 questions, ses six scores, une fiche par type et des métiers qui lui ressemblent |

Tout le code tient dans **un seul commit** construit sur `main` (commit `e46ea026`, 04/11/2026).

---

## Installer en une commande

Depuis la racine du dépôt Rebond, avec un arbre de travail propre :

```sh
curl -fsSL https://raw.githubusercontent.com/hadriun10/rebond-lead-magnets/main/install.sh | bash
```

Le script :
1. vérifie qu'il tourne bien dans le dépôt Rebond et que rien n'est en cours ;
2. crée la branche `lead-magnets-salaire-riasec` ;
3. applique le commit avec `git am -3`, qui fusionne à 3 voies si `main` a bougé entre-temps ;
4. lance `npm run check`.

Il ne pousse rien et ne touche pas à la base. Pour appliquer directement sur la branche
courante : `... | bash -s -- --branche-courante`.

**Sans le script :** téléchargez `lead-magnets-salaire-riasec.patch`, puis `git am -3 lead-magnets-salaire-riasec.patch`.
**Depuis l'Agent Replit :** donnez-lui l'URL brute du patch et demandez-lui de l'appliquer avec `git am -3`.

Le dossier `code/` contient les mêmes fichiers dans leur version finale, pour les lire sur GitHub.
Le patch fait foi.

---

## Mise en ligne : la check-list

- [ ] **Secret `HARVESTAPI_API_KEY`** dans les Replit Secrets. Il sert aussi à l'analyse LinkedIn
      (lecture d'un profil, ~0,015 $ par profil). Sans lui, l'option LinkedIn de l'estimation
      échoue proprement, et l'option CV continue de marcher.
- [ ] **Mistral** : rien à faire, les deux outils passent par `mistralJson` de `cvLeadRoutes.ts`,
      comme l'analyse de CV (`mistral-large-latest`).
- [ ] **Base** : aucune migration à lancer. Les tables se créent au démarrage
      (`CREATE TABLE IF NOT EXISTS`), par le même `optionalStartupFeature` que le CV et le LinkedIn.
- [ ] **Tests** : `npm test -- --stage=vitest`, ou les quatre fichiers ajoutés ou modifiés
      (voir plus bas).
- [ ] **Grille de salaire** (`shared/salaryGrid.ts`, version `rebond-1.0-2026`) : à recaler sur
      les salaires des offres de `global_job_pool` avant d'en faire la promotion. Les métiers
      industriels viennent d'Alteris, et les métiers tertiaires et tech sont chiffrés à la main.

---

## Comment ça marche

### Estimation de salaire

```
/estimation-salaire            CV (PDF, Word, image) ou LinkedIn (par nom ou par lien)
  → /estimation-salaire/chargement
  → /estimation-salaire/resultat/:id
```

1. **Lecture** (`server/services/salaryLeadExtraction.ts`) : Mistral lit le parcours et le classe
   dans une **liste fermée** de métiers. **L'IA ne donne aucun montant.**
2. **Calcul** (`shared/salaryLeadEngine.ts`, déterministe) : il compte les années d'expérience
   (stages et associatif exclus, alternance comptée pour moitié, pas de double compte, ce qui
   commence pendant les études compte à partir du diplôme), puis le niveau de poste prouvé
   (un intitulé « Directeur » sans encadrement ni ancienneté redescend d'un cran). Il prend ensuite
   la fourchette de la grille × la région, puis les atouts en pourcentage (encadrement, grand groupe,
   international, diplôme sélectif, certifications…).
3. **Le moteur est partagé** (`shared/`) : quand la personne clique « Je l'ai » sur un atout
   absent, le navigateur recalcule sans rappeler le serveur.

### Test RIASEC

```
/test-riasec → /test-riasec/questions (48 questions, une par écran, reprise après rechargement)
             → /test-riasec/resultat/:id
```

Les questions et le calcul sont ceux du quiz déjà présent dans l'app (`server/data/riasec-48.json`,
même formule que `quizService.calculateScores`), donc les scores se comparent. Le code à 3 lettres
se calcule **sans IA**. Mistral rédige seulement le résumé, les métiers et les conseils, avec un
texte de secours s'il ne répond pas.

### Sans compte, puis avec compte

| | Sans compte | Après connexion |
|---|---|---|
| Salaire | tous les textes lisibles, **tous les chiffres floutés**, fourchette comprise | tout, plus le recalcul « Je l'ai » |
| RIASEC | code, résumé, hexagone et lectures visibles ; noms des métiers, scores et mots-clés CV floutés | tout |

Le flou est appliqué **côté serveur** (`publicSalaryPreview`, aperçu RIASEC) : les chiffres
masqués ne partent jamais au navigateur. Le déblocage passe par
`/api/auth/linkedin?returnTo=…` ou par la création de compte e-mail, puis par
`POST /api/{salary,riasec}-lead/:id/claim`, comme `linkedin-lead`. Encart commun :
`client/src/components/LeadUnlockOverlay.tsx`.

### « Voir les offres »

Sur la page salaire comme sur chaque métier RIASEC, ce bouton est réservé aux membres. Le bloc
s'agrandit : la personne choisit sa ville dans la liste officielle (`/api/public/job-search-locations`,
la même que les filtres), puis la recherche d'offres s'ouvre **dans un nouvel onglet** et se lance seule :

```
/app/job-recommendations?query=Formateur&locations=[{"kind":"city","code":"72181","label":"Le Mans"}]&run=1
```

C'est **la seule modification d'un écran existant** : `JobRecommendations.tsx` lit maintenant
`locations` et `run=1`, à côté de `query` qu'il lisait déjà, puis les retire de l'adresse.

---

## Base de données

| Table | Contenu | Durée de vie sans compte |
|---|---|---|
| `salary_lead_analyses` | `id`, `ip_hash`, `source` (cv / linkedin), `report` (jsonb), `expires_at`, `claimed_user_id`, `claimed_at` | 1 h, supprimée ensuite |
| `riasec_lead_results` | même principe, avec les réponses et le résultat | 24 h, supprimée ensuite |

Un résultat rattaché à un compte (`claimed_user_id`) n'expire plus.
L'IP n'est jamais stockée en clair (`ip_hash`), et le contenu des CV n'est jamais journalisé.

## Routes API

| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/public/salary-lead/search` | public : recherche d'un profil LinkedIn par prénom et nom |
| POST | `/api/public/salary-lead/analyze` | public : CV (multipart) ou `profile` (lien LinkedIn) |
| GET | `/api/public/salary-lead/:id` | public : version floutée si non connecté |
| POST | `/api/salary-lead/:id/claim` | connecté |
| POST | `/api/public/riasec-lead/result` | public : enregistre les réponses, rend le résultat |
| GET | `/api/public/riasec-lead/:id` | public : version floutée si non connecté |
| POST | `/api/riasec-lead/:id/claim` | connecté |

**Limites par défaut** (surchargeables par variable d'environnement, comme les autres lead magnets) :
- salaire : 3 analyses par heure et 5 par jour par IP, 200 par heure et 1 000 par jour au total,
  4 analyses en parallèle (`SALARY_LEAD_*`) ;
- RIASEC : 5 tests par heure par IP, 500 par heure au total (`RIASEC_LEAD_*`).

## Événements PostHog

Même nommage que `cv_lead_*` et `linkedin_lead_*`.

**Salaire** : `salary_lead_viewed`, `salary_lead_search_started`, `salary_lead_search_succeeded`,
`salary_lead_search_failed`, `salary_lead_profile_selected`, `salary_lead_analysis_started`,
`salary_lead_analysis_succeeded`, `salary_lead_analysis_failed`, `salary_lead_result_viewed`,
`salary_lead_unlock_clicked`, `salary_lead_unlocked`, `salary_lead_account_created`,
`salary_lead_claim_failed`, `salary_lead_driver_claimed`, `salary_lead_job_search_clicked`.

**RIASEC** : `riasec_lead_viewed`, `riasec_lead_intro`, `riasec_lead_started`,
`riasec_lead_questions_started`, `riasec_lead_halfway`, `riasec_lead_completed`,
`riasec_lead_failed`, `riasec_lead_result_viewed`, `riasec_lead_unlock_clicked`,
`riasec_lead_unlocked`, `riasec_lead_account_created`, `riasec_lead_claim_failed`,
`riasec_lead_job_clicked`.

Les propriétés ne contiennent jamais de montant exact ni de donnée personnelle : seulement des
tranches (`range_band`), le code RIASEC, la méthode de déblocage, `with_city`, `new_account`.

---

## Fichiers

**29 fichiers ajoutés**, tous propres à ces deux outils :

```
client/src/pages/      SalaryLeadAnalysis · SalaryLeadLoading · SalaryLeadResult
                       RiasecLeadLanding · RiasecLeadQuiz · RiasecLeadResult
client/src/components/ LeadUnlockOverlay · LeadJobSearch · SalaryLeadInsights · SalaryLeadScale
                       RiasecHexagon · RiasecLeadIntro
client/src/lib/        salaryLeadJourney · riasecLeadJourney
server/routes/         salaryLeadRoutes · riasecLeadRoutes
server/services/       salaryLeadExtraction · salaryLeadEngine · riasecLeadInterpretation
server/                salaryEstimateSeoHtml · riasecTestSeoHtml
shared/                salaryGrid · salaryLeadEngine · salaryEstimateSeo · riasec · riasecTestSeo
tests/                 salaryLeadEngine.test · riasecLead.test · leadJobSearch.test
```

**8 fichiers existants modifiés**, par quelques lignes chacun :

| Fichier | Modification |
|---|---|
| `server/routes.ts` | imports, démarrage (`optionalStartupFeature`), garde des routes, enregistrement, HTML initial SEO |
| `client/src/App.tsx`, `client/src/lib/publicRoutes.tsx` | les 6 routes publiques |
| `shared/serverPublicPages.ts` | métadonnées SEO, sitemap |
| `server/lib/publicLeadLimits.ts` | type `Product` : `+ "salary" \| "riasec"` |
| `server/routes/cvLeadRoutes.ts` | `extractText` exporté (lecture des CV réutilisée) |
| `client/src/pages/JobRecommendations.tsx` | lecture de `locations` et `run=1` |
| `tests/serverPublicPages.test.ts` | empreintes des métadonnées mises à jour |

## Tests

```sh
npx vitest run tests/salaryLeadEngine.test.ts tests/riasecLead.test.ts tests/leadJobSearch.test.ts tests/serverPublicPages.test.ts
```

Les 36 tests passent. Ils couvrent le moteur de salaire (années, niveaux, atouts, plafonds,
floutage), le calcul RIASEC, l'adresse de recherche d'offres et les métadonnées publiques.
Ces fichiers ne touchent pas à la base, mais le `globalSetup` de `vitest.config.ts` en exige une :
lancez-les avec la `DATABASE_URL` de test habituelle.
