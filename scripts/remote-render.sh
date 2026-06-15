#!/usr/bin/env bash
# Render a video on a pre-created pu box — NEVER locally. Rendering (headless
# Chromium + encode) is expensive and NixOS-fiddly; we offload it to a pu host
# (default: `padam`). Syncs the source + the one video folder, renders there, copies
# the MP4 back to videos/<name>/out.mp4.
#
#   scripts/remote-render.sh <video-name> [host]
set -euo pipefail
NAME="${1:?usage: remote-render.sh <video-name> [host]}"
HOST="${2:-padam}"
REMOTE_DIR="padam"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

if [ ! -f "videos/$NAME/storyboard.json" ]; then
  echo "no videos/$NAME/storyboard.json"; exit 1
fi
if ! ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" true 2>/dev/null; then
  echo "can't reach pu box '$HOST'. Create it first (e.g. \`pu create $HOST\`) — we never render locally." >&2
  exit 1
fi

echo "[padam] rendering '$NAME' on pu box '$HOST'…"
ssh -o BatchMode=yes "$HOST" "mkdir -p ~/$REMOTE_DIR"
tar czf - --exclude='node_modules' --exclude='.git' \
  --exclude='videos/*/fonts' --exclude='videos/*/out.mp4' \
  package.json tsconfig.json flake.nix src scripts "videos/$NAME" \
  $([ -f package-lock.json ] && echo package-lock.json) \
  | ssh -o BatchMode=yes "$HOST" "tar xzf - -C ~/$REMOTE_DIR"

ssh -o BatchMode=yes "$HOST" \
  "cd ~/$REMOTE_DIR && nix shell nixpkgs#nodejs_22 nixpkgs#chromium --command bash scripts/remote-build.sh '$NAME'"

ssh -o BatchMode=yes "$HOST" "cat ~/$REMOTE_DIR/videos/$NAME/out.mp4" > "videos/$NAME/out.mp4"
echo "[padam] ✓ videos/$NAME/out.mp4 ($(wc -c < "videos/$NAME/out.mp4") bytes)"
