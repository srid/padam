---
name: video
description: Create, edit, and render videos with padam — a Remotion engine driven by an editable storyboard.json. Use whenever the user wants to make, edit, refine, or render a video, explainer, changelog/release clip, code walkthrough, demo, quote card, or social short.
---

# padam — make videos from a storyboard

A video is a **`storyboard.json`**: an ordered list of scenes. You author/edit that
JSON; `padam` renders it to a deterministic MP4 (Remotion + headless Chromium). The
storyboard is the source of truth — never hand-edit the MP4.

## The loop

1. **Scaffold (once per repo).** If `src/render.ts` + `package.json` aren't present,
   set padam up: `nix develop` then `pnpm install` (deps: remotion, react, shiki, zod,
   tsx). The flake is zero-inputs (npins-pinned nixpkgs) and provides Chromium/ffmpeg/
   fonts; `nix build` produces reproducible node_modules. See `reference/nixos.md`.
2. **Author.** Create `videos/<name>/storyboard.json` from the user's intent. One
   scene = `{ id, kind, durationInFrames, …fields }`. Pace at the storyboard's `fps`
   (30 default): title/outro ~90–120, prompt/bullets ~120–150, code/diff ~150.
   Set `width`/`height` for the target (16:9 `1920×1080`, 9:16 `1080×1920`, 1:1 `1080`).
3. **Render.** `npx tsx src/render.ts videos/<name>` → `videos/<name>/out.mp4`. The
   engine passes `$CHROMIUM_PATH` to Remotion (`browserExecutable`) so it never
   downloads a browser; on NixOS use `nix develop` so Chromium/ffmpeg/fonts resolve
   (see `reference/nixos.md`). Rendering is CPU-heavy — offload to a remote/CI box if
   you have one. (A given repo may wrap this in its own command, e.g. `just render`.)
4. **Look.** Extract a frame per scene and *view them* — this is mandatory; never
   assume it looks right:
   ```bash
   ffprobe -v error -show_entries format=duration -of csv=p=0 videos/<name>/out.mp4
   ffmpeg -y -ss <t> -i videos/<name>/out.mp4 -frames:v 1 /tmp/f.png   # then Read /tmp/f.png
   ```
5. **Refine.** Edit the JSON (text, durations, order, theme), or write a custom scene,
   then re-render and re-check. Iterate until the user is happy.

## Scene kinds (full reference: `reference/scenes.md`)

`title` · `bullets` · `code` · `diff` · `terminal` · `quote` · `image` · `stats` ·
`outro` · `custom`. Common to all: `durationInFrames`, optional `caption`
(on-screen lower-third), `narration` (future TTS), `transition` (`fade`|`none`).

- **code/diff** are syntax-highlighted (Shiki) — set `lang`; for `diff` give `before`+`after`.
- **image** uses `src` relative to the video's own folder; drop assets there.
- **custom**: register a React component in `src/scenes/custom/` and reference it
  `{ "kind":"custom", "component":"MyScene", "props":{…} }`. Use only when the catalog
  can't express the shot.

## Hard rules

- **Determinism.** No `Date.now()`, `Math.random()`, or network inside scene
  components — everything comes from props; animate with `useCurrentFrame()` +
  `interpolate`/`spring`. (Shiki runs at build time in `prepare`, never per frame.)
- **Fonts.** Text uses DejaVu (embedded). It has **no Tamil/CJK or color emoji** —
  keep on-screen glyphs within Latin + common symbols, or add a font. Prefer a CSS
  caret/`✓`/`▸` over emoji.
- **Don't invent data.** If the user gives content (a README, diff, changelog), pull
  real text/code into the scenes rather than paraphrasing into something false.

## Customize

- **Theme**: a `theme` block on the storyboard overrides `{bg,panel,fg,accent,green,red,mono,sans,…}`.
- **Aspect/length**: `width`/`height`/`fps`; total duration = sum of scene durations.
- **Assets/music**: per-video folder; `music` field is reserved (muxing not wired yet).

## Where videos live

`videos/<name>/storyboard.json` (+ assets) is committed source; `out.mp4` is a
reproducible export (commit it or publish to Releases/object storage). One folder per video.
