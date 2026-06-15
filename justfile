# padam — Claude Code sessions → narrated demo videos.
# `just` recipes wrapping the four file-based stages. Run `just` to list.

set shell := ["bash", "-uc"]

# The session to feature. Override: `just JSONL=/path/to/session.jsonl all`
JSONL := "/home/srid/.claude/projects/-home-srid-code-ci--worktrees-like-reward/ba6cd3d9-e075-4c1a-bba3-631210a81cb1.jsonl"
HOST  := "kolu-ci-1"

default:
    @just --list

# Stage 1: transcript .jsonl → artifacts/session.json (pure parse)
extract JSONL=JSONL:
    npx tsx src/extract.ts "{{JSONL}}" artifacts/session.json

# Stage 2: session.json → storyboard.json (interactive `claude` via pty; subscription-billed)
direct:
    npx tsx src/direct.ts artifacts/session.json artifacts/storyboard.json

# Stage 3 (remote): storyboard.json → out.mp4 on a kolu-ci box (heavy CPU)
render HOST=HOST:
    bash scripts/remote-render.sh "{{HOST}}" out.mp4

# Stage 3 (local): needs Chromium — use `nix develop` first
render-local:
    npx tsx src/render.ts artifacts/storyboard.json artifacts/session.json out.mp4

# Stage 4: storyboard.json → narration manifest (TTS stubbed)
narrate:
    npx tsx src/narrate.ts artifacts/storyboard.json

# Whole pipeline for a session, rendering on the remote host
all JSONL=JSONL HOST=HOST:
    npx tsx src/orchestrate.ts "{{JSONL}}" --host "{{HOST}}"

# Whole pipeline, rendering locally
all-local JSONL=JSONL:
    npx tsx src/orchestrate.ts "{{JSONL}}" --local

typecheck:
    npm run typecheck

# Open the finished video
open:
    xdg-open out.mp4

# Rank local sessions by file-edit density (helps pick a session to feature)
rank:
    @bash scripts/rank-sessions.sh
