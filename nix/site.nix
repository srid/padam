# Builds the Astro gallery (site/) reproducibly with Nix (nix-typescript: pnpm +
# fetchPnpmDeps). `nix build .#site` → a static site dir embedding the committed
# videos/<name>/out.mp4. CI deploys this to Pages — no Node toolchain to set up.
{ pkgs ? import ./nixpkgs.nix { } }:
let
  fs = pkgs.lib.fileset;
in
pkgs.stdenv.mkDerivation (finalAttrs: {
  pname = "padam-site";
  version = "0.1.0";

  # collect.mjs pulls videos/ + the logo into the build; astro builds site/.
  src = fs.toSource {
    root = ../.;
    fileset = fs.unions [
      ../site/package.json
      ../site/pnpm-lock.yaml
      ../site/astro.config.mjs
      ../site/tsconfig.json
      ../site/scripts
      ../site/src
      ../site/public # tracked statics: CNAME (custom domain) + favicon.svg
      ../videos
      ../assets/padam-logo.png
      ../assets/og.png
    ];
  };

  pnpmDeps = pkgs.fetchPnpmDeps {
    inherit (finalAttrs) pname version;
    src = fs.toSource {
      root = ../site;
      fileset = fs.unions [ ../site/package.json ../site/pnpm-lock.yaml ];
    };
    fetcherVersion = 3;
    hash = "sha256-jaj4tYdgRlIeUFnXsZ0lkjd2XJYIwQHTxpcOMckSTmM=";
  };
  pnpmRoot = "site";

  nativeBuildInputs = [ pkgs.nodejs_22 pkgs.pnpm pkgs.pnpmConfigHook ];

  buildPhase = ''
    runHook preBuild
    node site/scripts/collect.mjs
    ( cd site && pnpm exec astro build )
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    cp -r site/dist $out
    runHook postInstall
  '';
})
