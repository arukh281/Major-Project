#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env_supabase"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE in project root."
  exit 1
fi

echo "=== Supabase DB owner reset ==="
read -r -p "Enter owner Gmail to reset: " OWNER_EMAIL
if [[ -z "${OWNER_EMAIL}" ]]; then
  echo "Email is required."
  exit 1
fi

echo
echo "Reset mode:"
echo "  1) business-only (recommended)"
echo "  2) full reset (also deletes User row)"
read -r -p "Choose 1 or 2 [1]: " MODE_INPUT
MODE_INPUT="${MODE_INPUT:-1}"

echo
echo "Running reset for: $OWNER_EMAIL"
if [[ "$MODE_INPUT" == "2" ]]; then
  node scripts/reset-owner-data.mjs \
    --env-file "$ENV_FILE" \
    --email "$OWNER_EMAIL" \
    --full-reset
else
  node scripts/reset-owner-data.mjs \
    --env-file "$ENV_FILE" \
    --email "$OWNER_EMAIL"
fi
