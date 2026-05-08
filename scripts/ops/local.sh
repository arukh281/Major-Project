#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

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
      echo "Unknown option: $arg"
      echo "Usage: bash scripts/ops/local.sh [--with-dev]"
      exit 1
      ;;
  esac
done

if ! command -v psql >/dev/null 2>&1; then
  echo "PostgreSQL client (psql) is not installed."
  echo "Install PostgreSQL first, then rerun this script."
  exit 1
fi

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "Local PostgreSQL is not running on localhost:5432."
  echo "Start PostgreSQL, then rerun this script."
  exit 1
fi

echo "=== Local PostgreSQL bootstrap ==="
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
  echo "Database '${DB_NAME}' already exists."
else
  echo "Creating database '${DB_NAME}'..."
  createdb "$DB_NAME"
fi

export DATABASE_URL="$LOCAL_DB_URL"
export DIRECT_URL="$LOCAL_DB_URL"

echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo
echo "Local database is ready."
echo "  DATABASE_URL=$DATABASE_URL"
echo "  DIRECT_URL=$DIRECT_URL"

if [[ "$RUN_DEV" == true ]]; then
  echo
  echo "Starting app with npm run dev..."
  npm run dev
else
  echo "Run ingest with: bash scripts/ops/ingest.sh --target local"
  echo
  read -r -p "Do you want to start the server now? [y/N]: " START_DEV
  case "${START_DEV:-N}" in
    y|Y|yes|YES)
      echo "Starting app with npm run dev..."
      npm run dev
      ;;
    *)
      echo "Start app later with: npm run dev"
      ;;
  esac
fi
