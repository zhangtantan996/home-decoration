#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

ensure_npm_install() {
  local dir="$1"
  if [ ! -d "$dir/node_modules" ]; then
    echo "[init] npm install -> $dir"
    (cd "$dir" && npm install)
  fi
}

ensure_go_deps() {
  echo "[init] go mod download -> $ROOT_DIR/server"
  (cd "$ROOT_DIR/server" && go mod download)
}

ensure_npm_install "$ROOT_DIR"
ensure_npm_install "$ROOT_DIR/admin"
ensure_npm_install "$ROOT_DIR/merchant"
ensure_npm_install "$ROOT_DIR/web"
ensure_npm_install "$ROOT_DIR/mini"
ensure_go_deps

echo "[init] environment ready"
