#!/usr/bin/env bash
# Usage : yarn db:restaurer-staging
# Copie complète (schéma, données, contraintes, index, séquences) de la DB staging vers la DB Docker locale.
# Attend DATABASE_URL = staging (via .environment.staging + tunnel) et DATABASE_URL_LOCAL (vault).
# Tables exclues : mêmes que scripts/analytics/0_db_dump_restore.sh (volumineuses ou techniques).

set -euo pipefail

SOURCE="${DATABASE_URL:?DATABASE_URL (staging) manquante : lancer via yarn db:restaurer-staging}"
TARGET="${DATABASE_URL_LOCAL:?DATABASE_URL_LOCAL manquante dans le vault}"

if [[ "$SOURCE" == *"prod"* ]]; then
  echo "Refus : la source ressemble à de la prod ($SOURCE)" >&2
  exit 1
fi
if [[ "$TARGET" != *"localhost"* && "$TARGET" != *"127.0.0.1"* ]]; then
  echo "Refus : la cible n'est pas locale ($TARGET)" >&2
  exit 1
fi

DUMP="$(mktemp --suffix=.pgsql)"
trap 'rm -f "$DUMP"' EXIT

echo "→ pg_dump depuis staging (tunnel)…"
pg_dump --format c --no-owner --no-privileges --no-comments --schema public \
  --exclude-table spatial_ref_sys \
  --exclude-table cache_api_partenaire \
  --exclude-table suivi_job \
  --exclude-table evenement_engagement \
  --exclude-table evenement_engagement_hebdo \
  --dbname "$SOURCE" --file "$DUMP"
echo "  dump OK ($(du -h "$DUMP" | cut -f1))"

echo "→ reset des schémas local (public + sequelize)…"
# sequelize_meta vit dans le schéma sequelize : sans ce reset, une migration locale
# lancée avant restauration (ex: branche testée avant de rebasculer sur develop) reste
# marquée "faite" alors que DROP SCHEMA public a effacé son effet -> le `yarn migration`
# ci-dessous la re-skip au lieu de la rejouer, et la table manque silencieusement.
psql --quiet --dbname "$TARGET" -c "DROP SCHEMA IF EXISTS sequelize CASCADE;"
# Les extensions ne sont pas dans le dump (--schema public les exclut) : on les recrée avant les tables qui en dépendent
psql --quiet --dbname "$TARGET" \
  -c "DROP SCHEMA public CASCADE;" \
  -c "CREATE SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder CASCADE SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis_topology SCHEMA topology;" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;"

echo "→ pg_restore vers la DB locale…"
TOC="$(mktemp --suffix=.toc)"
trap 'rm -f "$DUMP" "$TOC"' EXIT
# Le schéma public existe déjà : on retire son entrée de la liste des objets à restaurer
pg_restore --list "$DUMP" | grep -v ' SCHEMA - public ' > "$TOC"
pg_restore --no-owner --no-privileges --no-comments --jobs 4 --use-list "$TOC" --dbname "$TARGET" "$DUMP"

echo "→ migrations locales (au cas où le code est en avance sur staging)…"
DATABASE_URL="$TARGET" yarn migration

echo "Terminé : DB locale = copie de staging."
