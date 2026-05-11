#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/ops/ui.sh"

ENV_FILE=".env_supabase"
LOCAL_DB_USER="${USER:-postgres}"
DEFAULT_LOCAL_URL="postgresql://${LOCAL_DB_USER}@localhost:5432/fynd?schema=public"
DEFAULT_REVIEWS_FILE="scripts/reviews/manual-google-reviews.json"
REVIEW_OPTIONS=(
  "scripts/reviews/manual-google-reviews.json"
  "scripts/reviews/manual-google-reviews-stationery-shop.json"
  "scripts/reviews/manual-google-reviews-primary-school.json"
  "scripts/reviews/manual-google-reviews-movie-theater.json"
  "scripts/reviews/manual-google-reviews-btech-institute.json"
)

TARGET=""
OWNER_EMAIL=""
REVIEWS_FILE=""
LOCAL_DB_URL=""

prompt_owner_email() {
  local owner_options=()
  local owner_line=""

  ui_section "Fetching registered owner emails from selected DB"
  while IFS= read -r owner_line; do
    if [[ -n "$owner_line" ]]; then
      owner_options+=("$owner_line")
    fi
  done < <(node scripts/list-owner-emails.mjs --use-current-env)

  if [[ "${#owner_options[@]}" -gt 0 ]]; then
    ui_section "Choose owner email"
    for i in "${!owner_options[@]}"; do
      ui_menu_item "$((i + 1))" "${owner_options[$i]}"
    done
    ui_menu_item "$(( ${#owner_options[@]} + 1 ))" "Enter manually"

    read -r -p "Choose [1]: " OWNER_CHOICE
    local default_choice=1
    local numeric_choice="${OWNER_CHOICE:-$default_choice}"
    local manual_choice=$(( ${#owner_options[@]} + 1 ))

    if [[ "$numeric_choice" =~ ^[0-9]+$ ]] && \
      [[ "$numeric_choice" -ge 1 ]] && \
      [[ "$numeric_choice" -le "${#owner_options[@]}" ]]; then
      OWNER_EMAIL="${owner_options[$((numeric_choice - 1))]}"
      return
    fi

    if [[ "$numeric_choice" == "$manual_choice" ]]; then
      read -r -p "Enter owner Gmail (example: you@gmail.com): " OWNER_EMAIL
      return
    fi

    ui_error "Invalid owner choice: ${OWNER_CHOICE}"
    exit 1
  else
    ui_warn "No registered owner emails found in selected DB."
    read -r -p "Enter owner Gmail (example: you@gmail.com): " OWNER_EMAIL
  fi
}

usage() {
  cat <<'EOF'
Usage: bash scripts/ops/ingest.sh [options]

Unified manual ingest script for local PostgreSQL or Supabase.

Options:
  -t, --target <local|supabase>   Ingest target (skip interactive target prompt)
  -e, --owner-email <gmail>       Owner email (skip email prompt)
  -r, --reviews-file <path>       Reviews JSON file path
  -d, --local-db-url <url>        Local DB URL (local target only)
  -h, --help                      Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      if [[ -z "${2:-}" ]]; then
        ui_error "Missing value for $1"
        usage
        exit 1
      fi
      TARGET="$2"
      shift 2
      ;;
    -e|--owner-email)
      if [[ -z "${2:-}" ]]; then
        ui_error "Missing value for $1"
        usage
        exit 1
      fi
      OWNER_EMAIL="$2"
      shift 2
      ;;
    -r|--reviews-file)
      if [[ -z "${2:-}" ]]; then
        ui_error "Missing value for $1"
        usage
        exit 1
      fi
      REVIEWS_FILE="$2"
      shift 2
      ;;
    -d|--local-db-url)
      if [[ -z "${2:-}" ]]; then
        ui_error "Missing value for $1"
        usage
        exit 1
      fi
      LOCAL_DB_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      ui_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -n "$TARGET" ]]; then
  TARGET="$(printf '%s' "$TARGET" | tr '[:upper:]' '[:lower:]')"
fi

if [[ -z "$TARGET" ]]; then
  ui_title "Manual review ingest"
  ui_section "Choose target"
  ui_menu_item "1" "local"
  ui_menu_item "2" "supabase"
  read -r -p "Target [1]: " TARGET_CHOICE
  case "${TARGET_CHOICE:-1}" in
    1|local|LOCAL) TARGET="local" ;;
    2|supabase|SUPABASE) TARGET="supabase" ;;
    *)
      ui_error "Invalid target choice: ${TARGET_CHOICE}"
      ui_info "Expected 1/local or 2/supabase."
      exit 1
      ;;
  esac
fi

if [[ "$TARGET" != "local" && "$TARGET" != "supabase" ]]; then
  ui_error "Invalid target: $TARGET"
  ui_info "Expected local or supabase."
  exit 1
fi

if [[ -z "$REVIEWS_FILE" ]]; then
  ui_section "Which reviews file do you want to ingest?"
  for i in "${!REVIEW_OPTIONS[@]}"; do
    ui_menu_item "$((i + 1))" "${REVIEW_OPTIONS[$i]}"
  done
  ui_menu_item "6" "custom path"
  read -r -p "Choose [1]: " REVIEWS_CHOICE

  case "${REVIEWS_CHOICE:-1}" in
    1) REVIEWS_FILE="${REVIEW_OPTIONS[0]}" ;;
    2) REVIEWS_FILE="${REVIEW_OPTIONS[1]}" ;;
    3) REVIEWS_FILE="${REVIEW_OPTIONS[2]}" ;;
    4) REVIEWS_FILE="${REVIEW_OPTIONS[3]}" ;;
    5) REVIEWS_FILE="${REVIEW_OPTIONS[4]}" ;;
    6|custom|CUSTOM)
      read -r -p "Enter custom reviews file path [${DEFAULT_REVIEWS_FILE}]: " INPUT_REVIEWS_FILE
      REVIEWS_FILE="${INPUT_REVIEWS_FILE:-$DEFAULT_REVIEWS_FILE}"
      ;;
    *)
      ui_error "Invalid reviews file choice: ${REVIEWS_CHOICE}"
      exit 1
      ;;
  esac
fi

if [[ ! -f "$REVIEWS_FILE" ]]; then
  ui_error "Reviews file not found: $REVIEWS_FILE"
  ui_info "Create it from example:"
  ui_info "cp scripts/reviews/manual-google-reviews.example.json scripts/reviews/manual-google-reviews.json"
  exit 1
fi

INGEST_ENV_FILE=""
TARGET_LABEL=""

if [[ "$TARGET" == "local" ]]; then
  TARGET_LABEL="local DB"
  if [[ -z "$LOCAL_DB_URL" ]]; then
    read -r -p "Local DB URL [${DEFAULT_LOCAL_URL}]: " INPUT_URL
    LOCAL_DB_URL="${INPUT_URL:-$DEFAULT_LOCAL_URL}"
  fi

  export DATABASE_URL="$LOCAL_DB_URL"
  export DIRECT_URL="$LOCAL_DB_URL"

  ui_section "Using local DB"
  ui_info "DATABASE_URL=$DATABASE_URL"
  ui_info "DIRECT_URL=$DIRECT_URL"
  echo

  INGEST_ENV_FILE="$(mktemp)"
  trap 'rm -f "$INGEST_ENV_FILE"' EXIT
  {
    printf 'DATABASE_URL="%s"\n' "$DATABASE_URL"
    printf 'DIRECT_URL="%s"\n' "$DIRECT_URL"
  } > "$INGEST_ENV_FILE"
else
  TARGET_LABEL="Supabase DB"
  if [[ ! -f "$ENV_FILE" ]]; then
    ui_error "Missing $ENV_FILE in project root."
    exit 1
  fi

  set -a
  source "$ENV_FILE"
  set +a

  if [[ -z "${DATABASE_URL:-}" || -z "${DIRECT_URL:-}" ]]; then
    ui_error "DATABASE_URL and DIRECT_URL must be set in $ENV_FILE"
    exit 1
  fi

  INGEST_ENV_FILE="$ENV_FILE"
  ui_success "Loaded Supabase env from $ENV_FILE"
  echo
fi

if [[ -z "$OWNER_EMAIL" ]]; then
  prompt_owner_email
fi

if [[ -z "${OWNER_EMAIL}" ]]; then
  ui_error "Email is required."
  exit 1
fi

if node scripts/check-owner-email.mjs --use-current-env --email "$OWNER_EMAIL"; then
  if [[ "$TARGET" == "local" ]]; then
    ui_success "Owner exists in local DB."
  else
    ui_success "Owner exists in Supabase DB."
  fi
  echo
else
  STATUS=$?
  if [[ "$STATUS" -eq 2 ]]; then
    if [[ "$TARGET" == "local" ]]; then
      ui_warn "That Gmail is not present in local DB."
      ui_info "Sign in once in your app using local DB, then rerun scripts/ops/ingest.sh --target local."
    else
      ui_warn "That Gmail is not present in Supabase DB."
      ui_info "Sign in once against Supabase DB, then rerun scripts/ops/ingest.sh --target supabase."
    fi
  fi
  exit "$STATUS"
fi

ui_section "Ingesting reviews into ${TARGET_LABEL}"
npm run ingest:manual-google -- \
  --env-file "$INGEST_ENV_FILE" \
  --reviews "$REVIEWS_FILE" \
  --owner-email "$OWNER_EMAIL"

echo
if [[ "$TARGET" == "local" ]]; then
  ui_success "Done. Local ingest complete for: $OWNER_EMAIL"
else
  ui_success "Done. Manual reviews pushed to Supabase for: $OWNER_EMAIL"
fi
