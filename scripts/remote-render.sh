#!/usr/bin/env bash
# Render a video on a pre-created pu box — NEVER locally. Rendering (headless
# Chromium + encode) is expensive and NixOS-fiddly; we offload it to a pu box
# (default: `padam`), reached via `pu connect <box>`. Syncs the source + the one
# video folder, renders inside the box's `nix develop`, copies the MP4 back.
#
#   scripts/remote-render.sh <video-name> [pu-box]
set -euo pipefail
NAME="${1:?usage: remote-render.sh <video-name> [pu-box]}"
HOST="${2:-padam}"
REMOTE_DIR="padam"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

[ -f "videos/$NAME/storyboard.json" ] || { echo "no videos/$NAME/storyboard.json"; exit 1; }

pu_sh() { pu connect "$HOST" -- "$@"; }

if ! pu_sh true >/dev/null 2>&1; then
  echo "can't reach pu box '$HOST' (pu connect). Create it first: \`pu create $HOST\`. We never render locally." >&2
  exit 1
fi

echo "[padam] rendering '$NAME' on pu box '$HOST'…"
pu_sh "rm -rf ~/$REMOTE_DIR && mkdir -p ~/$REMOTE_DIR"
# Ship the zero-inputs flake (flake.nix + nix/ + npins/ + default.nix + shell.nix),
# the lockfile + pnpm-workspace.yaml (build/arch settings), sources, and the one video
# folder. node_modules/fonts/out.mp4 excluded.
tar czf - --exclude='node_modules' --exclude='.git' \
  --exclude='videos/*/fonts' --exclude='videos/*/out.mp4' \
  package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json \
  flake.nix default.nix shell.nix nix npins \
  src scripts "videos/$NAME" \
  | pu_sh "tar xzf - -C ~/$REMOTE_DIR"

pu_sh "cd ~/$REMOTE_DIR && nix develop --accept-flake-config -c bash scripts/remote-build.sh '$NAME'"

pu_sh "cat ~/$REMOTE_DIR/videos/$NAME/out.mp4" > "videos/$NAME/out.mp4"
echo "[padam] ✓ videos/$NAME/out.mp4 ($(wc -c < "videos/$NAME/out.mp4") bytes)"
