# devShell — also used on the render box via `nix develop -c bash scripts/remote-build.sh`.
# Works with plain `nix-shell` too (pkgs defaults to the npins-pinned nixpkgs).
{ pkgs ? import ./nix/nixpkgs.nix { } }:
pkgs.mkShell {
  packages = [
    pkgs.nodejs_22
    pkgs.pnpm
    pkgs.uv # stage `apm-install` (uvx --from apm-cli apm)
    pkgs.ffmpeg
    pkgs.dejavu_fonts
    pkgs.npins
  ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.chromium ];

  env = import ./nix/env.nix { inherit pkgs; };

  shellHook = ''
    echo "padam: node $(node --version) · pnpm $(pnpm --version)${pkgs.lib.optionalString pkgs.stdenv.isLinux " · chromium pinned"}"
    echo "  just render <name>  (on pu box, never local)  ·  just new <name>"
  '';
}
