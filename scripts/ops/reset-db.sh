#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/ops/ui.sh"

ui_title "Whole database reset"
ui_warn "This will delete ALL app data (users, business, reviews, google links)."
echo
ui_section "Select target"
ui_menu_item "1" "local"
ui_menu_item "2" "supabase (.env_supabase)"
read -r -p "Choose 1 or 2: " TARGET

if [[ "$TARGET" != "1" && "$TARGET" != "2" ]]; then
  ui_error "Invalid choice."
  exit 1
fi

read -r -p "Type RESET to continue: " CONFIRM
if [[ "$CONFIRM" != "RESET" ]]; then
  ui_info "Cancelled."
  exit 1
fi

if [[ "$TARGET" == "1" ]]; then
  LOCAL_DB_USER="${USER:-postgres}"
  DEFAULT_LOCAL_URL="postgresql://${LOCAL_DB_USER}@localhost:5432/fynd?schema=public"
  read -r -p "Local DB URL [${DEFAULT_LOCAL_URL}]: " INPUT_URL
  LOCAL_DB_URL="${INPUT_URL:-$DEFAULT_LOCAL_URL}"

  TMP_ENV_FILE="$(mktemp)"
  trap 'rm -f "$TMP_ENV_FILE"' EXIT
  {
    printf 'DATABASE_URL="%s"\n' "$LOCAL_DB_URL"
    printf 'DIRECT_URL="%s"\n' "$LOCAL_DB_URL"
  } > "$TMP_ENV_FILE"

  node scripts/reset-whole-db.mjs --env-file "$TMP_ENV_FILE"
else
  if [[ ! -f ".env_supabase" ]]; then
    ui_error "Missing .env_supabase in project root."
    exit 1
  fi
  node scripts/reset-whole-db.mjs --env-file ".env_supabase"
fi
