#!/usr/bin/env bash

# Shared terminal UI helpers for ops scripts.
# Compatible with default macOS Bash 3.2.

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  UI_BOLD="$(printf '\033[1m')"
  UI_DIM="$(printf '\033[2m')"
  UI_RED="$(printf '\033[31m')"
  UI_GREEN="$(printf '\033[32m')"
  UI_YELLOW="$(printf '\033[33m')"
  UI_BLUE="$(printf '\033[34m')"
  UI_CYAN="$(printf '\033[36m')"
  UI_RESET="$(printf '\033[0m')"
else
  UI_BOLD=""
  UI_DIM=""
  UI_RED=""
  UI_GREEN=""
  UI_YELLOW=""
  UI_BLUE=""
  UI_CYAN=""
  UI_RESET=""
fi

ui_hr() {
  printf "%s\n" "${UI_DIM}------------------------------------------------------------${UI_RESET}"
}

ui_title() {
  ui_hr
  printf "%s%s%s\n" "$UI_BOLD" "$1" "$UI_RESET"
  ui_hr
}

ui_section() {
  printf "%s> %s%s\n" "$UI_CYAN" "$1" "$UI_RESET"
}

ui_info() {
  printf "%s•%s %s\n" "$UI_BLUE" "$UI_RESET" "$1"
}

ui_success() {
  printf "%s[ok]%s %s\n" "$UI_GREEN" "$UI_RESET" "$1"
}

ui_warn() {
  printf "%s[warn]%s %s\n" "$UI_YELLOW" "$UI_RESET" "$1"
}

ui_error() {
  printf "%s[error]%s %s\n" "$UI_RED" "$UI_RESET" "$1" >&2
}

ui_menu_item() {
  printf "  %s) %s\n" "$1" "$2"
}
