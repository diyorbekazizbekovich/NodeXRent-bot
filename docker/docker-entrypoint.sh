#!/bin/sh
set -eu

echo "[entrypoint] Waiting for PostgreSQL..."
# Prisma-friendly wait: retry migrate until DB accepts connections
ATTEMPTS=0
MAX_ATTEMPTS=60
until node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$connect().then(() => p.\$disconnect()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "[entrypoint] PostgreSQL not ready after ${MAX_ATTEMPTS}s — aborting"
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] PostgreSQL is ready"

echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] RUN_SEED=true — seeding catalog..."
  npx prisma db seed || echo "[entrypoint] Seed failed or already applied — continuing"
else
  echo "[entrypoint] Skipping seed (set RUN_SEED=true for first deploy)"
fi

echo "[entrypoint] Starting NodeXRent bot..."
exec node src/server.js
