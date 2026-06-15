#!/usr/bin/env bash
# Render a video on a pre-created pu box — NEVER locally. Rendering (headless
# Chromium + encode) is expensive and NixOS-fiddly; we offload it to a pu box
# (default: `padam`). Access is via `pu connect <box>`. Syncs the source + the one
# video folder, renders there, copies the MP4 back to videos/<name>/out.mp4.
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
pu_sh "mkdir -p ~/$REMOTE_DIR"
tar czf - --exclude='node_modules' --exclude='.git' \
  --exclude='videos/*/fonts' --exclude='videos/*/out.mp4' \
  package.json tsconfig.json flake.nix src scripts "videos/$NAME" \
  $([ -f pnpm-lock.yaml ] && echo pnpm-lock.yaml) \
  $([ -f package-lock.json ] && echo package-lock.json) \
  | pu_sh "tar xzf - -C ~/$REMOTE_DIR"

pu_sh "cd ~/$REMOTE_DIR && nix shell nixpkgs#nodejs_22 nixpkgs#chromium --command bash scripts/remote-build.sh '$NAME'"

pu_sh "cat ~/$REMOTE_DIR/videos/$NAME/out.mp4" > "videos/$NAME/out.mp4"
echo "[padam] ✓ videos/$NAME/out.mp4 ($(wc -c < "videos/$NAME/out.mp4") bytes)"
