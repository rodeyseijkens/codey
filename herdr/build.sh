#!/usr/bin/env bash
# Build step for the codey herdr plugin. Emits the plugin binary into
# $HERDR_PLUGIN_ROOT/bin (the checkout's bin/ when linked): `codey` serves as
# both the TUI pane and the headless action runner (`codey herdr <action>`).
#
# Fast path: download the standalone GitHub Release binary for this platform.
# Fallback: install deps, then compile a standalone binary from source
# (needs bun, and pnpm for OpenTUI native packages).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_BIN="${HERDR_PLUGIN_ROOT:-$ROOT}/bin"
REPO="rodeyseijkens/codey"

VERSION="$(grep -m1 '^version' "$ROOT/herdr-plugin.toml" 2>/dev/null | sed -E 's/.*"([^"]+)".*/\1/' || true)"
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
  mkdir -p "$PLUGIN_BIN" &&
    install -m 0755 "$1" "$PLUGIN_BIN/.codey.tmp" &&
    mv -f "$PLUGIN_BIN/.codey.tmp" "$PLUGIN_BIN/codey"
}

fetch_prebuilt() {
  [ -n "$target" ] || return 1
  command -v curl >/dev/null 2>&1 || return 1
  local tmp
  tmp="$(mktemp -d)"
  if curl -fsSL --retry 5 --retry-delay 3 \
       "$base/$archive" -o "$tmp/$archive" \
     && tar -xzf "$tmp/$archive" -C "$tmp" \
     && [ -f "$tmp/codey" ]; then
    if install_bin "$tmp/codey"; then
      rm -rf "$tmp"
      echo "codey: installed prebuilt $TAG ($target) -> $PLUGIN_BIN/codey"
      return 0
    fi
  fi
  rm -rf "$tmp"
  return 1
}

build_from_source() {
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
  mkdir -p "$ROOT/dist/release"
  local binary
  if [ -n "$target" ]; then
    if [ ! -f "$ROOT/scripts/release/build-binaries.ts" ]; then
      echo "codey: scripts/release/build-binaries.ts is missing - cannot compile a standalone binary." >&2
      exit 1
    fi
    bun run scripts/release/build-binaries.ts --target="$target" --version="$VERSION"
    binary="$ROOT/dist/release/codey-${target}"
  else
    if [ ! -f "$ROOT/src/main.tsx" ]; then
      echo "codey: src/main.tsx is missing - cannot compile a standalone binary." >&2
      exit 1
    fi
    bun build --compile --minify --sourcemap=none --target=bun src/main.tsx \
      --outfile "$ROOT/dist/release/codey-host"
    binary="$ROOT/dist/release/codey-host"
  fi
  if [ ! -f "$binary" ]; then
    echo "codey: build did not emit $binary" >&2
    exit 1
  fi
  install_bin "$binary"
  echo "codey: built from source -> $PLUGIN_BIN/codey"
}

if fetch_prebuilt; then
  exit 0
fi

echo "codey: no prebuilt downloaded for ${os}/${arch} $TAG — building from source" >&2
build_from_source
