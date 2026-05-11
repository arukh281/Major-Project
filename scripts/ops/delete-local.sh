#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/ops/ui.sh"

LOCAL_DB_USER="${USER:-postgres}"
DEFAULT_LOCAL_URL="postgresql://${LOCAL_DB_USER}@localhost:5432/fynd?schema=public"

ui_title "Local DB owner reset"
read -r -p "Enter owner Gmail to reset: " OWNER_EMAIL
if [[ -z "${OWNER_EMAIL}" ]]; then
  ui_error "Email is required."
  exit 1
fi

read -r -p "Local DB URL [${DEFAULT_LOCAL_URL}]: " INPUT_URL
LOCAL_DB_URL="${INPUT_URL:-$DEFAULT_LOCAL_URL}"

echo
ui_section "Reset mode"
ui_menu_item "1" "business-only (recommended)"
ui_menu_item "2" "full reset (also deletes User row)"
read -r -p "Choose 1 or 2 [1]: " MODE_INPUT
MODE_INPUT="${MODE_INPUT:-1}"

TMP_ENV_FILE="$(mktemp)"
trap 'rm -f "$TMP_ENV_FILE"' EXIT
{
  printf 'DATABASE_URL="%s"\n' "$LOCAL_DB_URL"
  printf 'DIRECT_URL="%s"\n' "$LOCAL_DB_URL"
} > "$TMP_ENV_FILE"

echo
ui_section "Running reset for: $OWNER_EMAIL"
if [[ "$MODE_INPUT" == "2" ]]; then
  node scripts/reset-owner-data.mjs \
    --env-file "$TMP_ENV_FILE" \
    --email "$OWNER_EMAIL" \
    --full-reset
else
  node scripts/reset-owner-data.mjs \
    --env-file "$TMP_ENV_FILE" \
    --email "$OWNER_EMAIL"
fi
