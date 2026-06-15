#!/usr/bin/env bash
#
# Stage 3 on a beefy remote: offload the heavy Chromium-render + encode to a
# kolu-ci-* host (32 cores), then copy the MP4 back.
#
#   scripts/remote-render.sh [host] [out.mp4]
#
# The remote is NixOS (binary cache, no node/chromium installed), so we run inside
# an ad-hoc `nix shell` (node + chromium) and let scripts/remote-build.sh handle the
# install + the NixOS compositor shim + the render. See scripts/remote-build.sh and
# the nix-ld gist for the two NixOS gotchas (downloaded Chrome; missing ELF loader).
set -euo pipefail

HOST="${1:-kolu-ci-1}"
OUT="${2:-out.mp4}"
REMOTE_DIR="padam-render"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

echo "[remote-render] → $HOST:~/$REMOTE_DIR"
ssh -o BatchMode=yes "$HOST" "rm -rf ~/$REMOTE_DIR && mkdir -p ~/$REMOTE_DIR"

# Ship source + the two JSON artifacts. Exclude node_modules / git / outputs.
tar czf - \
  package.json tsconfig.json flake.nix \
  src scripts \
  artifacts/session.json artifacts/storyboard.json \
  $([ -f package-lock.json ] && echo package-lock.json) \
  | ssh -o BatchMode=yes "$HOST" "tar xzf - -C ~/$REMOTE_DIR"

echo "[remote-render] installing + rendering on $HOST …"
ssh -o BatchMode=yes "$HOST" \
  "cd ~/$REMOTE_DIR && nix shell nixpkgs#nodejs_22 nixpkgs#chromium --command bash scripts/remote-build.sh"

echo "[remote-render] copying MP4 back → $OUT"
ssh -o BatchMode=yes "$HOST" "cat ~/$REMOTE_DIR/out.mp4" > "$OUT"
echo "[remote-render] done: $OUT ($(wc -c < "$OUT") bytes)"
