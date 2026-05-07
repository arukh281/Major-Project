#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env_supabase"
DEFAULT_REVIEWS_FILE="scripts/manual-google-reviews.json"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE in project root."
  exit 1
fi

echo "=== Supabase manual ingest ==="
read -r -p "Enter owner Gmail (example: you@gmail.com): " OWNER_EMAIL

if [[ -z "${OWNER_EMAIL}" ]]; then
  echo "Email is required."
  exit 1
fi

read -r -p "Reviews file [${DEFAULT_REVIEWS_FILE}]: " INPUT_REVIEWS_FILE
REVIEWS_FILE="${INPUT_REVIEWS_FILE:-$DEFAULT_REVIEWS_FILE}"

if [[ ! -f "$REVIEWS_FILE" ]]; then
  echo "Reviews file not found: $REVIEWS_FILE"
  echo "Create it from example:"
  echo "  cp scripts/manual-google-reviews.example.json scripts/manual-google-reviews.json"
  exit 1
fi

# Export values from .env_supabase for this script and child processes.
set -a
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" || -z "${DIRECT_URL:-}" ]]; then
  echo "DATABASE_URL and DIRECT_URL must be set in $ENV_FILE"
  exit 1
fi

echo "Loaded Supabase env from $ENV_FILE"
echo

if ! node scripts/check-owner-email.mjs --use-current-env --email "$OWNER_EMAIL"; then
  STATUS=$?
  if [[ "$STATUS" -eq 2 ]]; then
    echo "That Gmail is not present in Supabase DB."
    echo "Sign in once against Supabase DB, then rerun scripts/ops/supabase.sh."
  fi
  exit "$STATUS"
fi

echo
echo "Owner exists. Ingesting reviews into Supabase..."

npm run ingest:manual-google -- \
  --env-file "$ENV_FILE" \
  --reviews "$REVIEWS_FILE" \
  --owner-email "$OWNER_EMAIL"

echo
echo "Done. Manual reviews pushed to Supabase for: $OWNER_EMAIL"
