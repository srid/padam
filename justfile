# padam — prompt your agent to make videos. Run `just` to list.
# Renders run on a pu box (NEVER locally) — see .apm/instructions/rendering.md.
set shell := ["bash", "-uc"]

HOST := "padam"

# `apm-cli` (PyPI) provides the `apm` command; run via uvx, entering the devshell
# (which provides `uv`) only when not already inside it.
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop --accept-flake-config -c' }
apm_cmd := nix_shell + ' uvx --from apm-cli apm'

default:
    @just --list

# Install APM integrations for Claude Code only (.claude/, .agents/skills/)
apm-install:
    {{ apm_cmd }} install --target claude

# Render a video on the pu box → videos/<name>/out.mp4 (never local)
render NAME="tutorial" HOST=HOST:
    bash scripts/remote-render.sh "{{NAME}}" "{{HOST}}"

# Scaffold a new, minimal video folder
new NAME:
    @mkdir -p "videos/{{NAME}}"
    @test -f "videos/{{NAME}}/storyboard.json" || cp videos/tutorial/storyboard.json "videos/{{NAME}}/storyboard.json"
    @echo "created videos/{{NAME}}/storyboard.json — edit it, then: just render {{NAME}}"

# Open a rendered video
open NAME="tutorial":
    xdg-open "videos/{{NAME}}/out.mp4"

# Typecheck (uses the devshell's node/pnpm)
typecheck:
    {{nix_shell}} pnpm run typecheck
