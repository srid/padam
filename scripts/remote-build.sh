#!/usr/bin/env bash
# Runs ON the pu box INSIDE `nix develop` — node, pnpm, chromium, $CHROMIUM_PATH and
# $FONT_* all come from the devShell (shell.nix + nix/env.nix). Installs deps with
# pnpm, loader-shims the prebuilt Remotion compositor for NixOS (no nix-ld needed),
# then renders.
#
#   nix develop -c bash scripts/remote-build.sh <video-name>
set -euo pipefail
NAME="${1:?usage: remote-build.sh <video-name>}"

echo "node $(node --version) · pnpm $(pnpm --version) on $(hostname) ($(nproc) cores)"
pnpm install --frozen-lockfile

# The prebuilt glibc compositor can't exec on NixOS (no /lib64/ld-linux). Wrap it to
# launch through the Nix loader — works without nix-ld; avoids patchelf PT_NOTE issues.
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

npx tsx src/render.ts "videos/$NAME"
