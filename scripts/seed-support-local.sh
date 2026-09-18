#!/usr/bin/env bash
# Usage : yarn seed:support  (ou ./scripts/seed-support-local.sh)
# Peuple une population "phase pilote" sur l'API locale (localhost:5000, IS_WEB) via
# les routes /support/* (branche feat/communications), pour tester population/communication en local.
# Requiert l'API lancée en local (yarn watch/start) et API_KEY_SUPPORT dans .environment.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
# API_KEY_SUPPORT dans .environment est un tableau JSON de clés valides : en passer une via API_KEY.
API_KEY="${API_KEY:?API_KEY manquante : une des valeurs de API_KEY_SUPPORT du .environment}"
ID_POPULATION="${ID_POPULATION:-PHASE_PILOTE}"

# Emails de conseillers présents en base locale, à passer via EMAILS (séparés par des espaces).
read -r -a EMAILS <<< "${EMAILS:?EMAILS manquante : emails de conseillers locaux, séparés par des espaces}"

curl_support() {
  local method="$1" path="$2" body="${3:-}"
  curl --silent --show-error --fail-with-body \
    --request "$method" \
    --header "X-API-KEY: $API_KEY" \
    --header "Content-Type: application/json" \
    ${body:+--data "$body"} \
    "$BASE_URL/support$path"
}

echo "→ population $ID_POPULATION"
curl_support POST "/populations" "$(cat <<EOF
{"id": "$ID_POPULATION", "description": "Phase pilote (données de test locales)"}
EOF
)"

echo "→ ajout des conseillers"
EMAILS_JSON=$(printf '"%s",' "${EMAILS[@]}")
EMAILS_JSON="[${EMAILS_JSON%,}]"
curl_support POST "/populations/conseillers" "$(cat <<EOF
{"idPopulation": "$ID_POPULATION", "emailConseillers": $EMAILS_JSON}
EOF
)"

echo "→ communication IN_APP pour les conseillers de la population"
DATE_DEBUT=$(date -u +%Y-%m-%dT00:00:00.000Z)
DATE_FIN=$(date -u -d '+30 days' +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u -v+30d +%Y-%m-%dT00:00:00.000Z)
curl_support POST "/communications" "$(cat <<EOF
{
  "idPopulation": "$ID_POPULATION",
  "destinataire": "CONSEILLER",
  "type": "IN_APP",
  "dateDebut": "$DATE_DEBUT",
  "dateFin": "$DATE_FIN",
  "titre": "Bienvenue dans la phase pilote",
  "contenu": "Vous faites partie des testeurs de la phase pilote. Merci pour votre retour !"
}
EOF
)"

echo "→ vérification"
curl_support GET "/populations/$ID_POPULATION"
echo
echo "Terminé : population $ID_POPULATION créée avec ${#EMAILS[@]} conseiller(s) et une communication."
