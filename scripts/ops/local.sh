#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

LOCAL_DB_USER="${USER:-postgres}"
DEFAULT_LOCAL_URL="postgresql://${LOCAL_DB_USER}@localhost:5432/fynd?schema=public"

echo "=== Local PostgreSQL owner check ==="
read -r -p "Enter owner Gmail (example: you@gmail.com): " OWNER_EMAIL

if [[ -z "${OWNER_EMAIL}" ]]; then
  echo "Email is required."
  exit 1
fi

read -r -p "Local DB URL [${DEFAULT_LOCAL_URL}]: " INPUT_URL
LOCAL_DB_URL="${INPUT_URL:-$DEFAULT_LOCAL_URL}"

# Exported for this script session and child processes.
export DATABASE_URL="$LOCAL_DB_URL"
export DIRECT_URL="$LOCAL_DB_URL"

echo "Using local DB:"
echo "  DATABASE_URL=$DATABASE_URL"
echo "  DIRECT_URL=$DIRECT_URL"
echo

if node scripts/check-owner-email.mjs --use-current-env --email "$OWNER_EMAIL"; then
  echo "Owner exists in local DB."
  echo

  DEFAULT_REVIEWS_FILE="scripts/manual-google-reviews.json"
  read -r -p "Reviews file [${DEFAULT_REVIEWS_FILE}]: " INPUT_REVIEWS_FILE
  REVIEWS_FILE="${INPUT_REVIEWS_FILE:-$DEFAULT_REVIEWS_FILE}"

  if [[ ! -f "$REVIEWS_FILE" ]]; then
    echo "Reviews file not found: $REVIEWS_FILE"
    echo "Create it from example:"
    echo "  cp scripts/manual-google-reviews.example.json scripts/manual-google-reviews.json"
    exit 1
  fi

  TMP_ENV_FILE="$(mktemp)"
  trap 'rm -f "$TMP_ENV_FILE"' EXIT
  {
    printf 'DATABASE_URL="%s"\n' "$DATABASE_URL"
    printf 'DIRECT_URL="%s"\n' "$DIRECT_URL"
  } > "$TMP_ENV_FILE"

  echo "Ingesting reviews into local DB..."
  npm run ingest:manual-google -- \
    --env-file "$TMP_ENV_FILE" \
    --reviews "$REVIEWS_FILE" \
    --owner-email "$OWNER_EMAIL"

  echo
  echo "Done. Local ingest complete for: $OWNER_EMAIL"
  echo "Note: Running 'bash scripts/ops/local.sh' exports only for this process."
  echo "If you need env vars in your current shell, run: source scripts/ops/local.sh"
else
  STATUS=$?
  if [[ "$STATUS" -eq 2 ]]; then
    echo "That Gmail is not present in local DB."
    echo "Sign in once in your app using local DB, then rerun scripts/ops/local.sh."
  fi
  exit "$STATUS"
fi
