<div align="center">

![padam — a single-screen theatre now showing "hello, world", overlaid with tech glyphs](./assets/padam-marquee.svg)

# padam

**Prompt your agent to make videos.**
*`padam` (படம்) — Tamil for “movie / film / picture.”*

</div>

A video is a **`storyboard.json`** — an ordered list of scenes you (or your coding
agent) write in plain, hand-editable JSON. `padam` renders it to a deterministic MP4
with [Remotion](https://remotion.dev) + headless Chromium, Nix-pinned. You *direct*;
the agent *edits the storyboard and renders*; it can even look at the frames and
refine. Not just for one kind of content — explainers, changelogs, code walkthroughs,
release clips, social shorts, quote cards.

> **The source of truth is the storyboard, not the MP4.** A 5-line diff is a real
> edit, and anyone can re-render. Videos live in [`./videos/`](./videos) — this repo
> is its own library (we dogfood the tool here).

## Watch the tutorial

[`videos/tutorial/out.mp4`](./videos/tutorial/out.mp4) is itself a padam — a
60-second tutorial for padam, built from [its storyboard](./videos/tutorial/storyboard.json).

## Quick start

```bash
nix develop          # node + Nix-pinned chromium + ffmpeg + fonts
npm install
just render tutorial # → videos/tutorial/out.mp4
just open tutorial

just new my-clip     # scaffold videos/my-clip/storyboard.json, then edit + render
```

…or just tell your agent: *“make a 30-second clip announcing v2, dark, square for LinkedIn.”*

## A storyboard

```jsonc
{
  "title": "my first video",
  "width": 1920, "height": 1080, "fps": 30,
  "scenes": [
    { "kind": "title",  "durationInFrames": 90, "heading": "Hello, world!", "sub": "padam" },
    { "kind": "code",   "durationInFrames": 150, "lang": "ts", "code": "const x = 1", "caption": "…" },
    { "kind": "outro",  "durationInFrames": 90, "heading": "Bye", "chips": ["made with padam"] }
  ]
}
```

### Scene kinds

| kind | what it shows | main fields |
|---|---|---|
| `title` | title / section card | `heading`, `sub`, `eyebrow` |
| `bullets` | a list that reveals | `heading`, `items[]` |
| `code` | syntax-highlighted block (Shiki) | `lang`, `code`, `file` |
| `diff` | red/green before→after | `lang`, `before`, `after`, `file` |
| `terminal` | a typed shell line | `command`, `output` |
| `quote` | a pull quote | `text`, `by` |
| `image` | a static image from the video folder | `src`, `caption` |
| `stats` | animated stat pills | `heading`, `chips[]` |
| `outro` | closing card | `heading`, `sub`, `chips[]` |
| `custom` | a bespoke `.tsx` scene (escape hatch) | `component`, `props` |

Every scene also takes `durationInFrames`, optional `caption` (on-screen) and
`narration` (for future TTS). Full reference: [`skills/video/reference/scenes.md`](./skills/video/reference/scenes.md).

## How you direct it

The loop, conversational:

1. **Describe** the video → the agent writes/edits `videos/<name>/storyboard.json`.
2. **Render** → `just render <name>` (or `npx tsx src/render.ts videos/<name>`).
3. **Look** → the agent extracts a frame per scene and *sees* its own output.
4. **Refine** → "scene 3 too fast, use brand blue, swap in the perf chart" → it edits JSON / theme / writes a custom scene → re-render.

Determinism (no `Date.now`/`Math.random`/network in frames; Shiki runs at build time) means *what it previews is what ships*.

## Customize

- **Content** — text, durations, order, captions: edit the JSON.
- **Look** — a `theme` block (colors + font stacks); aspect via `width`/`height`.
- **Assets** — drop images/logos in `videos/<name>/`, reference by filename.
- **Custom motion** — register a React scene in `src/scenes/custom/` and use `{"kind":"custom","component":"MyScene","props":{…}}`. Full Remotion when the catalog isn't enough.

## Reusable components

Two layers of reuse:

- **Built-in scene kinds** (the catalog above) ship with padam — reusable in every
  video and every repo that installs the skill.
- **Custom components** live in [`src/scenes/custom/`](./src/scenes/custom). Register a
  React scene there and any storyboard in the repo can use it:

  ```jsonc
  { "kind": "custom", "component": "ClaudePrompt", "durationInFrames": 175,
    "props": { "cwd": "~/code/site", "prompt": "make a 30s launch clip, dark, square",
               "response": "● writing videos/launch/storyboard.json …" } }
  ```

  The included [`ClaudePrompt`](./src/scenes/custom/ClaudePrompt.tsx) renders a Claude
  Code prompt (you'll see it in the tutorial). Build your own branded pieces the same
  way — they reuse padam's primitives (`Window`, `Cursor`, `typed`, `useTheme`) so they
  match the built-ins. To share across repos, ship the file with the skill or copy it.

## Install as an APM package

`padam`'s video skill is published for [APM](https://microsoft.github.io/apm/) — add it to any repo's `apm.yml`:

```yaml
dependencies:
  apm:
    - srid/padam/skills/video
```

Then prompt your agent to make a video in *that* repo. See [`skills/video/SKILL.md`](./skills/video/SKILL.md).

## Rendering anywhere

`render` passes `$CHROMIUM_PATH` to Remotion as `browserExecutable`, so it never
downloads a browser. `nix develop` (or the launcher) resolves Chromium/ffmpeg/fonts
through Nix. On machines without [`nix-ld`](https://github.com/nix-community/nix-ld),
Remotion's prebuilt compositor needs the loader shim — see
[`skills/video/reference/nixos.md`](./skills/video/reference/nixos.md).

## Layout

```
src/            the engine — schema · model · highlight · scenes · Video · Root · render
videos/<name>/  one folder per video: storyboard.json (+ assets, + out.mp4)
skills/video/   the APM-published skill: SKILL.md + reference docs
assets/         the marquee logo
flake.nix · justfile · apm.yml
```

## License

[AGPL-3.0-or-later](./LICENSE).
