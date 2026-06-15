#!/usr/bin/env bash
# Runs ON the pu box, inside `nix shell nixpkgs#nodejs_22 nixpkgs#chromium`.
# Installs deps, makes Remotion's prebuilt glibc compositor runnable on NixOS
# (loader shim — works even without nix-ld; see skills/video/reference/nixos.md),
# then renders the given video.
#
#   bash scripts/remote-build.sh <video-name>
set -euo pipefail
NAME="${1:?usage: remote-build.sh <video-name>}"

npm install --no-audit --no-fund --loglevel=error

GLIBC=$(nix build --no-link --print-out-paths nixpkgs#glibc.out)
GCC=$(nix build --no-link --print-out-paths "nixpkgs#stdenv.cc.cc.lib" 2>/dev/null \
      || nix build --no-link --print-out-paths nixpkgs#gcc-unwrapped.lib)
ZLIB=$(nix build --no-link --print-out-paths nixpkgs#zlib.out)
COMP=node_modules/@remotion/compositor-linux-x64-gnu
if [ -d "$COMP" ] && [ ! -e "$COMP/remotion.real" ]; then
  LIB="$GLIBC/lib:$GCC/lib:$ZLIB/lib:$(cd "$COMP" && pwd)"
  for b in remotion ffmpeg ffprobe; do
    [ -f "$COMP/$b" ] || continue
    mv "$COMP/$b" "$COMP/$b.real"
    printf '#!/bin/sh\nexec "%s/lib/ld-linux-x86-64.so.2" --library-path "%s" "$(dirname "$0")/%s.real" "$@"\n' \
      "$GLIBC" "$LIB" "$b" > "$COMP/$b"
    chmod +x "$COMP/$b"
  done
  echo "wrapped compositor via $GLIBC/lib/ld-linux-x86-64.so.2"
fi

DJVU=$(nix build --no-link --print-out-paths nixpkgs#dejavu_fonts)
export FONT_MONO="$DJVU/share/fonts/truetype/DejaVuSansMono.ttf"
export FONT_SANS="$DJVU/share/fonts/truetype/DejaVuSans.ttf"
export CHROMIUM_PATH="$(command -v chromium)"
echo "chromium: $CHROMIUM_PATH"

npx tsx src/render.ts "videos/$NAME"
