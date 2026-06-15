# padam — prompt your agent to make videos. Run `just` to list.
set shell := ["bash", "-uc"]

default:
    @just --list

# Render a video folder → videos/<name>/out.mp4
render NAME="tutorial":
    npx tsx src/render.ts "videos/{{NAME}}"

# Render an arbitrary storyboard.json → out.mp4 beside it
render-file STORYBOARD:
    npx tsx src/render.ts "{{STORYBOARD}}"

# Scaffold a new, minimal video folder
new NAME:
    @mkdir -p "videos/{{NAME}}"
    @test -f "videos/{{NAME}}/storyboard.json" || cp videos/tutorial/storyboard.json "videos/{{NAME}}/storyboard.json"
    @echo "created videos/{{NAME}}/storyboard.json — edit it, then: just render {{NAME}}"

# Open a rendered video
open NAME="tutorial":
    xdg-open "videos/{{NAME}}/out.mp4"

typecheck:
    npm run typecheck
