#!/usr/bin/env bash
# Installe les lead magnets « estimation de salaire » et « test RIASEC » dans le dépôt Rebond.
#
# À lancer depuis la racine du dépôt Rebond (là où se trouve server/routes.ts) :
#   curl -fsSL https://raw.githubusercontent.com/hadriun10/rebond-lead-magnets/main/install.sh | bash
#
# Le script crée une branche `lead-magnets-salaire-riasec` depuis la branche courante, y applique
# le commit, puis vérifie les types. Il ne pousse rien et ne touche pas à la base.
# Pour appliquer directement sur la branche courante : ... | bash -s -- --branche-courante
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/hadriun10/rebond-lead-magnets/main"
PATCH="lead-magnets-salaire-riasec.patch"
BRANCH="lead-magnets-salaire-riasec"
USE_CURRENT=0
[ "${1:-}" = "--branche-courante" ] && USE_CURRENT=1

fail() { echo "✗ $1" >&2; exit 1; }

[ -f server/routes.ts ] && [ -f shared/schema.ts ] || fail "Lancez ce script depuis la racine du dépôt Rebond."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Ce dossier n'est pas un dépôt Git."
[ -z "$(git status --porcelain --untracked-files=no)" ] || fail "Des modifications ne sont pas commitées : commitez-les ou mettez-les de côté d'abord."
if [ -f server/routes/salaryLeadRoutes.ts ]; then fail "Les lead magnets sont déjà présents (server/routes/salaryLeadRoutes.ts existe)."; fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if [ -f "$(dirname "${BASH_SOURCE[0]:-.}")/$PATCH" ]; then
  cp "$(dirname "${BASH_SOURCE[0]}")/$PATCH" "$TMP/$PATCH"
else
  echo "→ Téléchargement du patch"
  curl -fsSL "$REPO_RAW/$PATCH" -o "$TMP/$PATCH" || fail "Téléchargement impossible : $REPO_RAW/$PATCH"
fi

if [ "$USE_CURRENT" = 0 ]; then
  git show-ref --verify --quiet "refs/heads/$BRANCH" && fail "La branche $BRANCH existe déjà."
  echo "→ Nouvelle branche $BRANCH depuis $(git rev-parse --abbrev-ref HEAD)"
  git checkout -q -b "$BRANCH"
fi

echo "→ Application du commit (fusion à 3 voies si main a bougé)"
if ! git am -3 --keep-cr "$TMP/$PATCH"; then
  echo
  echo "✗ Conflit pendant l'application. Deux options :"
  echo "  • résoudre les fichiers en conflit, puis : git add <fichiers> && git am --continue"
  echo "  • tout annuler : git am --abort"
  exit 1
fi

echo "→ Vérification des types (npm run check)"
if npm run --silent check; then echo "✓ Types OK"; else echo "⚠ La vérification des types signale des erreurs : à regarder avant de fusionner."; fi

cat <<'EOF'

✓ Lead magnets installés.

Avant la mise en ligne :
  1. Replit Secrets : HARVESTAPI_API_KEY (déjà nécessaire pour l'analyse LinkedIn). Mistral est déjà configuré.
  2. Tests : npm test -- --stage=vitest  (ou les 4 fichiers de tests/ cités dans le README)
  3. Fusionner sur main. Les tables salary_lead_analyses et riasec_lead_results se créent
     toutes seules au premier démarrage.
EOF
