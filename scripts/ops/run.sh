#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/ops/ui.sh"

print_menu() {
  echo
  ui_title "Fynd Ops Menu"
  ui_menu_item "1" "Bootstrap local database"
  ui_menu_item "2" "Ingest reviews (local or supabase)"
  ui_menu_item "3" "Reset one owner (local or supabase)"
  ui_menu_item "4" "Reset whole database (local or supabase)"
  ui_menu_item "5" "Start dev server"
  ui_menu_item "6" "Exit"
}

run_reset_owner() {
  echo
  ui_section "Reset one owner target"
  ui_menu_item "1" "local"
  ui_menu_item "2" "supabase"
  read -r -p "Choose [1]: " RESET_TARGET
  case "${RESET_TARGET:-1}" in
    1|local|LOCAL)
      bash scripts/ops/delete-local.sh
      ;;
    2|supabase|SUPABASE)
      bash scripts/ops/delete-supabase.sh
      ;;
    *)
      ui_error "Invalid target choice: ${RESET_TARGET}"
      return 1
      ;;
  esac
}

while true; do
  print_menu
  read -r -p "What do you want to do? [6]: " ACTION

  case "${ACTION:-6}" in
    1)
      bash scripts/ops/local.sh
      ;;
    2)
      bash scripts/ops/ingest.sh
      ;;
    3)
      run_reset_owner
      ;;
    4)
      bash scripts/ops/reset-db.sh
      ;;
    5)
      npm run dev
      ;;
    6|exit|EXIT|q|quit|QUIT)
      ui_info "Exiting ops menu."
      break
      ;;
    *)
      ui_error "Invalid choice: ${ACTION}"
      continue
      ;;
  esac

  echo
  read -r -p "Do you want to run another ops action? [y/N]: " CONTINUE_CHOICE
  case "${CONTINUE_CHOICE:-N}" in
    y|Y|yes|YES)
      ;;
    *)
      ui_info "Exiting ops menu."
      break
      ;;
  esac
done
