#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$REPO_ROOT/.github/assets/screenshots"

for tool in vhs ttyd ffmpeg bun; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: '$tool' not found on PATH." >&2
    echo "on NixOS: nix shell nixpkgs/nixos-25.05#vhs nixpkgs/nixos-25.05#ttyd -c pnpm screenshots" >&2
    exit 1
  fi
done

for candidate in chromium chromium-browser google-chrome-stable google-chrome; do
  if command -v "$candidate" >/dev/null 2>&1; then
    export ROD_BROWSER_BIN="$(command -v "$candidate")"
    break
  fi
done

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

DEMO_DIR="$WORK_DIR/demo"
HOME_DIR="$WORK_DIR/home"
mkdir -p "$HOME_DIR/.config/codey" "$WORK_DIR/bin" "$ASSETS_DIR"
ln -s "$ASSETS_DIR" "$WORK_DIR/shots"

cat > "$WORK_DIR/bin/codey" <<EOF
#!/usr/bin/env bash
cd "$DEMO_DIR"
exec bun "$REPO_ROOT/src/main.tsx" "\$@"
EOF
chmod +x "$WORK_DIR/bin/codey"

"$SCRIPT_DIR/screenshots/demo-repo.sh" "$DEMO_DIR"

for tape in "$SCRIPT_DIR"/screenshots/*.tape; do
  name="$(basename "$tape")"
  theme="$(sed -n 's/^# theme: //p' "$tape")"
  mode="$(sed -n 's/^# mode: //p' "$tape")"
  if [ -z "$theme" ]; then
    echo "error: missing '# theme:' header in $tape" >&2
    exit 1
  fi

  printf 'theme = "%s"\n' "$theme" > "$HOME_DIR/.config/codey/config.toml"
  if [ -n "$mode" ]; then
    printf 'mode = "%s"\n' "$mode" >> "$HOME_DIR/.config/codey/config.toml"
  fi
  echo "rendering $name (theme: $theme${mode:+, mode: $mode})"
  (
    cd "$WORK_DIR"
    HOME="$HOME_DIR" PATH="$WORK_DIR/bin:$PATH" vhs "$tape"
  )
done

echo "screenshots written to $ASSETS_DIR"
