#!/usr/bin/env bash
# Build step for the codey herdr plugin. Emits the plugin binary into
# $HERDR_PLUGIN_ROOT/bin (the checkout's bin/ when linked): `codey` serves as
# both the TUI pane and the headless action runner (`codey herdr <action>`).
#
# Fast path: download the standalone GitHub Release binary for this platform.
# Fallback: pnpm install + bun run build (needs bun, and pnpm for OpenTUI natives).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_BIN="${HERDR_PLUGIN_ROOT:-$ROOT}/bin"
REPO="rodeyseijkens/codey"

VERSION="$(grep -m1 '^version' "$ROOT/herdr-plugin.toml" | sed -E 's/.*"([^"]+)".*/\1/')"
if [ -z "$VERSION" ]; then
  echo "codey: could not read version from herdr-plugin.toml" >&2
  exit 1
fi
TAG="v${VERSION}"

os="$(uname -s)"
arch="$(uname -m)"
target=""
case "$os-$arch" in
  Darwin-arm64 | Darwin-aarch64) target="darwin-arm64" ;;
  Darwin-x86_64)                 target="darwin-x64" ;;
  Linux-aarch64 | Linux-arm64)   target="linux-arm64" ;;
  Linux-x86_64)                  target="linux-x64" ;;
esac

if [ -n "$target" ] && [ "$os" = Linux ]; then
  if [ -f /etc/alpine-release ] || { command -v ldd >/dev/null 2>&1 && ldd /bin/sh 2>&1 | grep -q musl; }; then
    target="${target}-musl"
  fi
fi

archive="codey-${VERSION}-${target}.tar.gz"
base="https://github.com/${REPO}/releases/download/${TAG}"

install_bin() {
  mkdir -p "$PLUGIN_BIN"
  install -m 0755 "$1" "$PLUGIN_BIN/codey"
}

fetch_prebuilt() {
  [ -n "$target" ] || return 1
  command -v curl >/dev/null 2>&1 || return 1
  local tmp
  tmp="$(mktemp -d)"
  if curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --retry-connrefused \
       "$base/$archive" -o "$tmp/$archive" \
     && tar -xzf "$tmp/$archive" -C "$tmp" \
     && [ -f "$tmp/codey" ]; then
    install_bin "$tmp/codey"
    rm -rf "$tmp"
    echo "codey: installed prebuilt $TAG ($target) -> $PLUGIN_BIN/codey"
    return 0
  fi
  rm -rf "$tmp"
  return 1
}

build_from_source() {
  if [ ! -f "$ROOT/scripts/build-bin.ts" ]; then
    echo "codey: scripts/build-bin.ts is missing - cannot build from source." >&2
    exit 1
  fi
  if ! command -v bun >/dev/null 2>&1; then
    echo "codey: bun is required to build from source (https://bun.sh)." >&2
    exit 1
  fi
  cd "$ROOT"
  if command -v pnpm >/dev/null 2>&1; then
    echo "codey: installing deps with pnpm (required for OpenTUI native packages)"
    HUSKY=0 pnpm install --frozen-lockfile
  else
    echo "codey: pnpm not found; falling back to bun install" >&2
    HUSKY=0 bun install
  fi
  bun run build
  if [ ! -f "$ROOT/bin/codey" ]; then
    echo "codey: bun run build did not emit bin/codey" >&2
    exit 1
  fi
  install_bin "$ROOT/bin/codey"
  echo "codey: built from source -> $PLUGIN_BIN/codey"
}

if fetch_prebuilt; then
  exit 0
fi

echo "codey: no prebuilt for ${os}/${arch} $TAG — building from source" >&2
build_from_source
