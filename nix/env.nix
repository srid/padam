# Env vars shared by the devShell (and thus `nix develop -c …` on the render box).
# Render reads CHROMIUM_PATH (browserExecutable) + FONT_* (embedded fonts).
{ pkgs }:
{
  FONT_MONO = "${pkgs.dejavu_fonts}/share/fonts/truetype/DejaVuSansMono.ttf";
  FONT_SANS = "${pkgs.dejavu_fonts}/share/fonts/truetype/DejaVuSans.ttf";
}
// pkgs.lib.optionalAttrs pkgs.stdenv.isLinux {
  CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";
}
