# Rendering on NixOS

`render` passes `$CHROMIUM_PATH` to Remotion as `browserExecutable`, so it never
downloads a browser. `nix develop` exports `CHROMIUM_PATH`, `FONT_MONO`, `FONT_SANS`.
Ad-hoc:

```bash
DJVU=$(nix build --no-link --print-out-paths nixpkgs#dejavu_fonts)
nix shell nixpkgs#chromium --command bash -c '
  export CHROMIUM_PATH="$(command -v chromium)"
  export FONT_MONO="'"$DJVU"'/share/fonts/truetype/DejaVuSansMono.ttf"
  export FONT_SANS="'"$DJVU"'/share/fonts/truetype/DejaVuSans.ttf"
  npx tsx src/render.ts videos/<name>
'
```

## The compositor / `ld-linux` gotcha

Remotion's `@remotion/compositor-linux-x64-gnu` is a **prebuilt glibc binary** whose
ELF interpreter is `/lib64/ld-linux-x86-64.so.2` — which doesn't exist on NixOS. So:

- **Machines with [`nix-ld`](https://github.com/nix-community/nix-ld)** (most NixOS
  desktops): it just works — `nix-ld` provides that path.
- **Machines without nix-ld** (e.g. minimal incus/CI images): rendering fails with
  `spawn … ENOENT`. Either enable `programs.nix-ld.enable = true;` on the image, or
  wrap the compositor to launch through the Nix loader (no binary mutation, avoids
  `patchelf` PT_NOTE errors on Rust binaries):

  ```bash
  GLIBC=$(nix build --no-link --print-out-paths nixpkgs#glibc.out)
  GCC=$(nix build --no-link --print-out-paths nixpkgs#stdenv.cc.cc.lib)
  ZLIB=$(nix build --no-link --print-out-paths nixpkgs#zlib.out)
  COMP=node_modules/@remotion/compositor-linux-x64-gnu
  LIB="$GLIBC/lib:$GCC/lib:$ZLIB/lib:$(cd "$COMP" && pwd)"
  for b in remotion ffmpeg ffprobe; do
    [ -e "$COMP/$b.real" ] || mv "$COMP/$b" "$COMP/$b.real"
    printf '#!/bin/sh\nexec "%s/lib/ld-linux-x86-64.so.2" --library-path "%s" "$(dirname "$0")/%s.real" "$@"\n' "$GLIBC" "$LIB" "$b" > "$COMP/$b"
    chmod +x "$COMP/$b"
  done
  ```

## Fonts

Headless Chromium on a minimal box has no fonts → text tofus. `render` copies the
`$FONT_MONO`/`$FONT_SANS` TTFs into `videos/<name>/fonts/` and the composition
`@font-face`s them. DejaVu has **no Tamil/CJK or color emoji** — add a font (e.g.
`noto-fonts`, `noto-fonts-emoji`) and extend the `@font-face` / theme stacks if you
need those glyphs on screen.

## Offloading heavy renders

For long/high-res renders, run on a beefier host over SSH: sync the repo (minus
`node_modules`), `nix shell nixpkgs#nodejs_22 nixpkgs#chromium`, apply the wrapper
above if the host lacks nix-ld, `npm install`, `render`, copy the MP4 back.
