# padam

Turn **Claude Code session transcripts** (the local `~/.claude/projects/**/*.jsonl`)
into short, narrated demo videos that show how you work with agents.

The data is historical and static, so this is **reconstruction from logs**, not
screen-recording: parse logs → model → storyboard → rendered MP4.

```
~/.claude/projects/**/<id>.jsonl
   │
   ├─[1] extract → session.json     (pure parse, no network)
   │
   ├─[2] direct  → storyboard.json  (interactive `claude` via pty: editorial selection)
   │
   ├─[3] render  → out.mp4          (Remotion: reads storyboard.json + session.json)
   │
   └─[4] narrate → audio/*.mp3      (optional TTS; muxed in render — STUBBED for now)
```

**Four file-based stages.** Each is a standalone CLI that reads one file and writes
one file. The intermediate artifacts are plain, inspectable, git-friendly JSON — so
you can **hand-edit `storyboard.json` and re-render** without re-running extraction
or touching the LLM. The orchestrator (`src/orchestrate.ts`) just chains them.

---

## Quick start

```bash
nix develop                 # node + python + chromium + fonts (see flake.nix)
npm install

# One session, all the way to an MP4 (render runs on a remote kolu-ci box):
npm run all -- ~/.claude/projects/<proj>/<id>.jsonl
#  …or with just:
just all JSONL=~/.claude/projects/<proj>/<id>.jsonl
```

The default featured session (override any time) is the one this was built against:
`ci` → `justci`, a real project-rename session that fans a single instruction out
into 59 file edits and opens [`juspay/justci#25`](https://github.com/juspay/justci/pull/25).

## Run a single stage

```bash
# 1. extract: transcript → normalized session model
npm run extract -- ~/.claude/projects/<proj>/<id>.jsonl artifacts/session.json

# 2. direct: session model → storyboard (drives interactive claude in a pty)
npm run direct                       # artifacts/session.json → artifacts/storyboard.json

# 3. render: storyboard → MP4 (heavy; runs on a kolu-ci host)
just render HOST=kolu-ci-1           # → out.mp4
#   local render instead (needs Chromium from `nix develop`):
just render-local

# 4. narrate: storyboard → narration manifest (TTS stubbed)
npm run narrate
```

`just` lists everything: run `just` with no args.

## Pick a different session

Everything keys off the `.jsonl` path you pass to **extract** — nothing is
hard-coded, so featuring another session is just:

```bash
just rank                 # rank your local sessions by file-edit density
just all JSONL=~/.claude/projects/<other>/<id>.jsonl
```

`scripts/rank-sessions.sh` scans `~/.claude/projects`, skips subagent/workflow
side-logs, and ranks by edit/diff density so you can spot a rich, legible session.

---

## How stage 2 talks to the model (no `-p`, subscription-billed)

`claude -p` (print/headless) bills **SDK/API credits**. To stay on the **Max-plan
subscription**, stage 2 drives the *interactive* `claude` TUI inside a
**pseudo-terminal** (`scripts/pty_claude.py`). Getting strict JSON out of a TUI is
the hard part, so we don't scrape the screen at all:

- `direct.ts` writes the full editorial brief + a session *digest* (prompts, the
  agent's own narration, and diff candidates **with their real event ids**) to
  `artifacts/direct-prompt.md`.
- The pty driver sends one line — "read that file, **Write** the storyboard JSON to
  `artifacts/storyboard.raw.json`" — auto-accepts the write
  (`--permission-mode acceptEdits`), and **polls the filesystem** for valid JSON.
- `direct.ts` validates it against the `Storyboard` zod schema (with a small repair
  pass for the model's occasional unescaped-quote slip) and finalizes
  `storyboard.json`.

No API key, anywhere. The model picks the arc and writes captions/narration by
**referencing event ids**; the render then hydrates authentic code from
`session.json` via those ids, so the LLM never invents code.

## How stage 3 renders (Remotion, remote, deterministic)

- Driven programmatically — `bundle` → `selectComposition` → `renderMedia`
  (`@remotion/renderer`) — so it's CI-automatable, not Studio-only.
- **Deterministic:** everything the composition sees comes from `inputProps`. Code is
  highlighted with **Shiki at build time** (in Node) and passed as serialized tokens —
  no WASM, `Date.now`, `Math.random`, or network inside frames. Duration derives from
  the scene list via `calculateMetadata`.
- **Square 1080×1080, dark terminal/IDE aesthetic.**
- **Runs on a remote `kolu-ci-*` host** (32 cores) for the heavy Chromium render +
  encode; `scripts/remote-render.sh` syncs the project, runs `scripts/remote-build.sh`
  there, and copies `out.mp4` back. Pass `--local` to `orchestrate` (or
  `just render-local`) to render here.

### NixOS render gotchas (handled in the remote scripts)

- **Chromium:** Remotion normally *downloads* a headless Chrome (breaks in a Nix
  sandbox). We pin `chromium` from nixpkgs and pass it as `browserExecutable` via
  `$CHROMIUM_PATH` (the flake exports it; the remote script sets it from `nix shell`).
- **Compositor:** Remotion's prebuilt compositor is a glibc-linked binary whose ELF
  interpreter (`/lib64/ld-linux-x86-64.so.2`) doesn't exist on NixOS → `spawn ENOENT`.
  We wrap each compositor binary in a shim that runs it through the Nix `ld-linux`
  loader (`ld-linux --library-path <glibc:gcc:compositor> ./remotion.real`) — no
  binary mutation, no steam-run/FHS.
- **Fonts:** headless Chromium on a minimal box has no fonts, so text would tofu. We
  copy DejaVu (mono + sans) into `public/fonts/` and `@font-face` them; glyphs are
  kept within DejaVu's coverage (no color emoji).

---

## The contract (`src/types.ts`)

Two zod-validated types every stage agrees on (TS types are inferred from the
schemas, so runtime validation and compile-time types can't drift):

- **`SessionModel`** — stage 1 output: `events` of
  `user_prompt | assistant_text | thinking | tool_call | tool_result`, plus
  session `cwd`/`gitBranch`/`prUrl`/`stats`. Locked against real transcripts.
  *Refinement:* `tool_call.edit` carries an authentic before/after (harvested from
  the transcript's top-level `toolUseResult.structuredPatch` / `oldString`/`newString`),
  so the diff scene shows real code.
- **`Storyboard`** — stage 2 output / stage 3 input: `title`, `summary`, `fps`,
  `width`/`height`, and `scenes` of kind
  `intro | prompt | agent_work | diff | tool_run | outro`. Each scene has a
  `caption` (on-screen), `narration` (TTS), `eventRefs` (ids it visualizes), and an
  optional `code` override.

## Layout

```
src/
  types.ts            # the contract (zod → inferred TS types)
  extract.ts          # stage 1
  direct.ts           # stage 2 (pty → interactive claude)
  render.ts           # stage 3 CLI (bundle → select → renderMedia)
  narrate.ts          # stage 4 (stub)
  orchestrate.ts      # chains the stages
  render/
    model.ts          # RenderModel = prepared inputProps (plain JSON, no zod)
    prepare.ts        # Storyboard + Session → RenderModel (resolve diffs, Shiki)
    highlight.ts      # Shiki tokens + LCS line-diff (build-time, Node)
    theme.ts          # dark palette + font stacks
    components.tsx    # terminal window, caption, chips
    scenes.tsx        # intro/prompt/diff/agent_work/tool_run/outro + router
    Video.tsx         # <Series> of scenes + embedded @font-face
    Root.tsx          # <Composition> + calculateMetadata (duration from scenes)
    index.ts          # registerRoot
scripts/
  pty_claude.py       # stage-2 pty driver
  remote-render.sh    # stage-3: sync project → run remote-build → copy MP4 back
  remote-build.sh     # stage-3 (on the remote): install → wrap compositor → render
  rank-sessions.sh    # rank local sessions by edit density
flake.nix · justfile · tsconfig.json
artifacts/            # session.json, storyboard.json (tracked); audio/, *.mp4 (ignored)
```

## Decisions & deviations

- **Auto-picked** `ci/like-reward` as the richest *legible* session (one ask → 59
  edits → a PR). Swap freely (see above).
- **Square 1080×1080**, **dark terminal/IDE** theme (your choices).
- **Stage 2 mechanism changed** from the brief's `claude -p` to a **pty-driven
  interactive** session, because `-p` bills SDK credits (yours is a Max plan).
- **Type refinements** (documented in `types.ts`): `tool_call.edit`,
  `user_prompt.command`, session `cwd`/`gitBranch`/`prUrl`/`stats`, `Storyboard`
  `width`/`height`.
- **Vertical slice, not breadth:** transitions, music, and TTS are deferred.

## Non-goals (for now)

- No GitHub Actions yet (stage 3 is *designed* to run headless in CI).
- No TTS in this slice (stage 4 is stubbed; manifest is ready).
- No cross-project auto-discovery — pass an explicit `.jsonl`.
