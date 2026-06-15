{
  # Zero flake inputs (nix-for-dev): sources are pinned with npins and imported
  # from nix/. Keeps `nix develop` cold-eval fast. To override nixpkgs:
  #   NPINS_OVERRIDE_nixpkgs=/path/to/nixpkgs nix develop
  description = "padam — prompt your agent to make videos (Remotion + Nix)";

  outputs = { self, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      eachSystem = f: builtins.listToAttrs (map
        (system: { name = system; value = f (import ./nix/nixpkgs.nix { inherit system; }); })
        systems);
    in
    {
      packages = eachSystem (pkgs: {
        default = import ./default.nix { inherit pkgs; };
        site = import ./nix/site.nix { inherit pkgs; };
      });
      devShells = eachSystem (pkgs: { default = import ./shell.nix { inherit pkgs; }; });
    };
}
