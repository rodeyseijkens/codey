#!/usr/bin/env bash
# Build step for the codey herdr plugin. Emits the plugin binary into
# $HERDR_PLUGIN_ROOT/bin (the checkout's bin/ when linked): `codey` serves as
# both the TUI pane and the headless action runner (`codey herdr <action>`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_BIN="${HERDR_PLUGIN_ROOT:-$ROOT}/bin"

if [ ! -f "$ROOT/scripts/build-bin.ts" ]; then
  echo "codey: scripts/build-bin.ts is missing - the build pipeline is not implemented yet." >&2
  echo "codey: it must emit an executable binary at bin/codey (TUI + herdr actions)." >&2
  exit 1
fi

bun run build

mkdir -p "$PLUGIN_BIN"
cp -f "$ROOT/bin/codey" "$PLUGIN_BIN/"
