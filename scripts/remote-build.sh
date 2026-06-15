#!/usr/bin/env bash
#
# Runs ON a kolu-ci remote, inside `nix shell nixpkgs#nodejs_22 nixpkgs#chromium`.
# Installs deps, makes Remotion's prebuilt glibc compositor runnable on this NixOS
# box, then renders.
#
# NixOS has no /lib64/ld-linux-x86-64.so.2 and (on these incus images) no nix-ld,
# so the prebuilt compositor can't exec (spawn ENOENT). We wrap each compositor
# binary in a shim that launches it through the Nix ld-linux loader explicitly —
# works WITHOUT admin/nix-ld and avoids patchelf's PT_NOTE issues on Rust binaries.
# The clean image-wide fix is `programs.nix-ld.enable = true;` (see the gist).
set -euo pipefail

echo "node $(node --version) on $(hostname) ($(nproc) cores)"
npm install --no-audit --no-fund --loglevel=error

# Resolve the Nix glibc loader + lib dirs. Use the explicit `.out` output — a bare
# `nixpkgs#glibc` print-out-paths lists *every* output and would mangle the path.
GLIBC=$(nix build --no-link --print-out-paths nixpkgs#glibc.out)
GCCLIB=$(nix build --no-link --print-out-paths 'nixpkgs#stdenv.cc.cc.lib' 2>/dev/null \
         || nix build --no-link --print-out-paths nixpkgs#gcc-unwrapped.lib)
LD="$GLIBC/lib/ld-linux-x86-64.so.2"
COMP="node_modules/@remotion/compositor-linux-x64-gnu"

if [ -d "$COMP" ]; then
  # The bundled ffmpeg dynamically links a few compression libs (libz, libbz2, liblzma).
  EXTRA=""
  for sel in zlib.out bzip2.out xz.out; do
    d=$(nix build --no-link --print-out-paths "nixpkgs#$sel" 2>/dev/null || true)
    [ -n "$d" ] && EXTRA="$EXTRA:$d/lib"
  done
  LIBPATH="$GLIBC/lib:$GCCLIB/lib${EXTRA}:$(cd "$COMP" && pwd)"
  for b in remotion ffmpeg ffprobe; do
    [ -f "$COMP/$b" ] || continue
    [ -e "$COMP/$b.real" ] || mv "$COMP/$b" "$COMP/$b.real"
    cat > "$COMP/$b" <<EOF
#!/bin/sh
exec "$LD" --library-path "$LIBPATH" "\$(CDPATH= cd -- "\$(dirname -- "\$0")" && pwd)/$b.real" "\$@"
EOF
    chmod +x "$COMP/$b"
  done
  echo "wrapped compositor via $LD"
fi

DJVU=$(nix build --no-link --print-out-paths nixpkgs#dejavu_fonts)
export FONT_MONO="$DJVU/share/fonts/truetype/DejaVuSansMono.ttf"
export FONT_SANS="$DJVU/share/fonts/truetype/DejaVuSans.ttf"
export CHROMIUM_PATH="$(command -v chromium)"
echo "chromium: $CHROMIUM_PATH"

npx tsx src/render.ts artifacts/storyboard.json artifacts/session.json out.mp4
