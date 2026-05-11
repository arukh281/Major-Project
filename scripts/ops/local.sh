#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/ops/ui.sh"

LOCAL_DB_USER="${USER:-postgres}"
DEFAULT_LOCAL_URL="postgresql://${LOCAL_DB_USER}@localhost:5432/fynd?schema=public"
DEFAULT_DB_NAME="fynd"
RUN_DEV=false

for arg in "$@"; do
  case "$arg" in
    --with-dev)
      RUN_DEV=true
      ;;
    *)
      ui_error "Unknown option: $arg"
      ui_info "Usage: bash scripts/ops/local.sh [--with-dev]"
      exit 1
      ;;
  esac
done

if ! command -v psql >/dev/null 2>&1; then
  ui_error "PostgreSQL client (psql) is not installed."
  ui_info "Install PostgreSQL first, then rerun this script."
  exit 1
fi

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  ui_error "Local PostgreSQL is not running on localhost:5432."
  ui_info "Start PostgreSQL, then rerun this script."
  exit 1
fi

ui_title "Local PostgreSQL bootstrap"
read -r -p "Local DB URL [${DEFAULT_LOCAL_URL}]: " INPUT_URL
LOCAL_DB_URL="${INPUT_URL:-$DEFAULT_LOCAL_URL}"

DB_NAME="$DEFAULT_DB_NAME"
DB_NAME_CANDIDATE="${LOCAL_DB_URL##*/}"
DB_NAME_CANDIDATE="${DB_NAME_CANDIDATE%%\?*}"
if [[ -n "$DB_NAME_CANDIDATE" ]]; then
  DB_NAME="$DB_NAME_CANDIDATE"
fi

if psql -h localhost -U "$LOCAL_DB_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | tr -d '[:space:]' | {
    read -r EXISTS_FLAG
    [[ "$EXISTS_FLAG" == "1" ]]
  }; then
  ui_info "Database '${DB_NAME}' already exists."
else
  ui_section "Creating database '${DB_NAME}'"
  createdb "$DB_NAME"
fi

export DATABASE_URL="$LOCAL_DB_URL"
export DIRECT_URL="$LOCAL_DB_URL"

ui_section "Applying Prisma migrations"
npx prisma migrate deploy

echo
ui_success "Local database is ready."
ui_info "DATABASE_URL=$DATABASE_URL"
ui_info "DIRECT_URL=$DIRECT_URL"

if [[ "$RUN_DEV" == true ]]; then
  echo
  ui_section "Starting app with npm run dev"
  npm run dev
else
  ui_info "Run ingest with: bash scripts/ops/ingest.sh --target local"
  echo
  read -r -p "Do you want to start the server now? [y/N]: " START_DEV
  case "${START_DEV:-N}" in
    y|Y|yes|YES)
      ui_section "Starting app with npm run dev"
      npm run dev
      ;;
    *)
      ui_info "Start app later with: npm run dev"
      ;;
  esac
fi
