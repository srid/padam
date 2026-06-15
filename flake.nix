{
  description = "padam — prompt your agent to make videos (Remotion + Nix)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (s: f nixpkgs.legacyPackages.${s});
    in
    {
      devShells = forAll (pkgs:
        let
          # Remotion would otherwise download a headless Chrome (breaks in Nix sandboxes
          # / on machines without nix-ld). Pin it and pass via $CHROMIUM_PATH.
          chromium = pkgs.chromium;
          fonts = pkgs.dejavu_fonts;
          isLinux = pkgs.stdenv.isLinux;
        in
        {
          default = pkgs.mkShell {
            packages = [ pkgs.nodejs_22 pkgs.ffmpeg pkgs.uv fonts ]
              ++ pkgs.lib.optionals isLinux [ chromium ];
            shellHook = ''
              ${pkgs.lib.optionalString isLinux ''export CHROMIUM_PATH="${chromium}/bin/chromium"''}
              export FONT_MONO="${fonts}/share/fonts/truetype/DejaVuSansMono.ttf"
              export FONT_SANS="${fonts}/share/fonts/truetype/DejaVuSans.ttf"
              echo "padam: node $(node --version)${pkgs.lib.optionalString isLinux '' · chromium pinned''}"
              echo "  just render tutorial   ·   just new <name>"
            '';
          };
        });
    };
}
