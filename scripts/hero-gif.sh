#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$REPO_ROOT/.github/assets/screenshots"
SRC="$ASSETS_DIR/5-tour.gif"
OUT="$ASSETS_DIR/hero.gif"

if [ ! -f "$SRC" ]; then
  echo "error: $SRC not found; run pnpm screenshots first" >&2
  exit 1
fi

ffmpeg -y -loglevel error -stats -i "$SRC" -filter_complex \
  "fps=10,scale=1280:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  "$OUT"

duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" | cut -d. -f1)"
size="$(du -h "$OUT" | cut -f1)"
echo "hero gif written to $OUT (${duration}s, ${size})"
