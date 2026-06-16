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
# pnpm-workspace.yaml approves esbuild's build (so this exits 0, not 1) and asks for the
# glibc compositor via supportedArchitectures. (The package.json "pnpm" field is ignored
# by pnpm 10+.)
pnpm install --frozen-lockfile

# Remotion spawns the compositor binary by its REAL path inside the pnpm store (it
# require.resolve()s @remotion/compositor-linux-x64-gnu), not via node_modules/@remotion/.
# That prebuilt glibc binary's ELF interpreter (/lib64/ld-linux-x86-64.so.2) doesn't
# exist on NixOS, so it dies with `spawn … ENOENT`. Locate it in the store and wrap each
# binary to launch through the Nix loader (works without nix-ld; avoids patchelf PT_NOTE
# issues). pnpm-workspace.yaml's supportedArchitectures is what gets it into the store.
COMP=$(ls -d node_modules/.pnpm/@remotion+compositor-linux-x64-gnu@*/node_modules/@remotion/compositor-linux-x64-gnu 2>/dev/null | head -1)
[ -n "$COMP" ] || { echo "FATAL: glibc compositor not in pnpm store — check supportedArchitectures in pnpm-workspace.yaml" >&2; exit 1; }

GLIBC=$(nix build --no-link --print-out-paths nixpkgs#glibc.out)
GCC=$(nix build --no-link --print-out-paths "nixpkgs#stdenv.cc.cc.lib" 2>/dev/null \
      || nix build --no-link --print-out-paths nixpkgs#gcc-unwrapped.lib)
ZLIB=$(nix build --no-link --print-out-paths nixpkgs#zlib.out)
if [ ! -e "$COMP/remotion.real" ]; then
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
