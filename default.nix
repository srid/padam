# Reproducible node_modules via pnpm + fetchPnpmDeps (nix-typescript).
# `nix build` → a node_modules store path. The hash below pins pnpm-lock.yaml's
# closure; when the lockfile changes, `nix build` fails with the new hash — copy it
# in (see skills/video/reference or the nix-typescript skill).
#
# padam runs via tsx (no compile step), so the "package" is just its deps.
{ pkgs ? import ./nix/nixpkgs.nix { } }:
pkgs.stdenv.mkDerivation (finalAttrs: {
  pname = "padam-node-modules";
  version = "0.1.0";

  src = pkgs.lib.fileset.toSource {
    root = ./.;
    fileset = pkgs.lib.fileset.unions [ ./package.json ./pnpm-lock.yaml ];
  };

  nativeBuildInputs = [ pkgs.nodejs_22 pkgs.pnpm pkgs.pnpmConfigHook ];

  pnpmDeps = pkgs.fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 3;
    hash = "sha256-EeLk3MW9eM9j+F0fQ6kU3LepJ19DpjuCHoAY2mtdKPs=";
  };

  dontBuild = true;
  installPhase = ''
    runHook preInstall
    cp -r node_modules $out
    runHook postInstall
  '';
})
