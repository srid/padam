# Pinned nixpkgs import — managed by npins (to update: `npins update nixpkgs`).
let
  sources = import ../npins;
  nixpkgs = import sources.nixpkgs;
in
args: nixpkgs (args // {
  overlays = (args.overlays or [ ]) ++ [ (import ./overlay.nix) ];
  config = (args.config or { });
})
