#!/usr/bin/env bash
# Quick redeploy helper for Contabo VPS — run from repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> git pull"
git pull --ff-only

echo "==> docker compose build bot"
docker compose build bot

echo "==> docker compose up -d"
docker compose up -d

echo "==> status"
docker compose ps

echo "==> recent logs"
docker compose logs --tail=50 bot

echo "Done. Follow logs: docker compose logs -f bot"
