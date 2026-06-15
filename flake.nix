{
  description = "padam — Claude Code session transcripts → narrated demo videos";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (s: f nixpkgs.legacyPackages.${s});
    in
    {
      devShells = forAll (pkgs:
        let
          # Stage 3 (render) drives a headless Chromium. Remotion would otherwise
          # *download* one, which breaks under a sandboxed/CI Nix build — so we pin
          # it from nixpkgs and export the path for `browserExecutable`.
          chromium = pkgs.chromium;
          fonts = pkgs.dejavu_fonts;
          isLinux = pkgs.stdenv.isLinux;
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.python3 # stage 2: drives interactive `claude` in a pty
              fonts
            ] ++ pkgs.lib.optionals isLinux [ chromium ];

            # No secrets here — stage 2 uses the `claude` CLI's existing Max login.
            shellHook = ''
              ${pkgs.lib.optionalString isLinux ''export CHROMIUM_PATH="${chromium}/bin/chromium"''}
              export FONT_MONO="${fonts}/share/fonts/truetype/DejaVuSansMono.ttf"
              export FONT_SANS="${fonts}/share/fonts/truetype/DejaVuSans.ttf"
              echo "padam devshell: node $(node --version)${pkgs.lib.optionalString isLinux '' · chromium=$CHROMIUM_PATH''}"
              echo "  stages:  npm run extract|direct|render|narrate|all"
            '';
          };
        });
    };
}
