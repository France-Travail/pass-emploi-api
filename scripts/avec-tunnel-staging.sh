#!/usr/bin/env bash
# Usage : scripts/avec-tunnel-staging.sh <commande...>
# Ouvre le tunnel vers la DB staging si rien n'écoute déjà sur le port, attend qu'il soit prêt,
# lance la commande, puis ferme le tunnel qu'il a lui-même ouvert.

set -euo pipefail

PORT=10000
APP=pass-emploi-api-staging
REGION=osc-fr1

port_ouvert() { nc -z 127.0.0.1 "$PORT" &>/dev/null; }

if port_ouvert; then
  echo "Tunnel déjà ouvert sur 127.0.0.1:$PORT, on le réutilise"
else
  # -p force le port : sans lui, le CLI en alloue un autre si 10000 est pris et l'app taperait à côté
  scalingo -a "$APP" --region "$REGION" db-tunnel -p "$PORT" SCALINGO_POSTGRESQL_URL &
  TUNNEL_PID=$!
  trap 'kill "$TUNNEL_PID" 2>/dev/null || true' EXIT

  for _ in $(seq 1 30); do
    port_ouvert && break
    kill -0 "$TUNNEL_PID" 2>/dev/null || { echo "Le tunnel Scalingo s'est arrêté" >&2; exit 1; }
    sleep 1
  done
  port_ouvert || { echo "Tunnel non prêt après 30 s" >&2; exit 1; }
fi

"$@"
