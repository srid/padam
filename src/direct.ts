/**
 * Stage 2 — direct: the editorial brain. session.json → storyboard.json
 *
 *   tsx src/direct.ts [session.json] [storyboard.json]
 *
 * Uses the already-authenticated `claude` CLI — but NOT `claude -p` (print mode
 * bills SDK/API credits). Instead it drives the *interactive* TUI inside a
 * pseudo-terminal (scripts/pty_claude.py) so the call authenticates via the
 * Max-plan login and is subscription-billed.
 *
 * Getting strict JSON out of a TUI is the hard part. We sidestep TUI scraping
 * entirely: we write the full editorial brief + session digest to
 * `artifacts/direct-prompt.md`, then send Claude a single one-line instruction —
 * "read that file, Write the storyboard JSON to artifacts/storyboard.raw.json".
 * The pty driver auto-accepts the Write (`--permission-mode acceptEdits`) and
 * polls the filesystem for valid JSON. The model writes a *file*, not a screen,
 * so there is nothing fragile to parse. We then zod-validate and finalize.
 *
 * Re-runnable headlessly: `tsx src/direct.ts` regenerates the storyboard any time.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  SessionModel,
  SessionModelSchema,
  Storyboard,
  StoryboardSchema,
  DEFAULT_FPS,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
} from "./types";

const PTY_DRIVER = resolve("scripts/pty_claude.py");
const PROMPT_FILE = resolve("artifacts/direct-prompt.md");
const RAW_FILE = resolve("artifacts/storyboard.raw.json");

// ── Distill the session into an editorial brief for the model ────────────────
function digest(s: SessionModel): string {
  const lines: string[] = [];
  const trunc = (t: string, n: number) =>
    (t.length > n ? t.slice(0, n) + " …" : t).replace(/\s+/g, " ").trim();

  lines.push(`# Session: ${s.project} (branch ${s.gitBranch ?? "?"})`);
  if (s.stats) {
    const min = (s.stats.durationMs / 60000).toFixed(0);
    lines.push(
      `Duration ~${min} min · ${s.stats.prompts} human prompts · ${s.stats.toolCalls} tool calls · ${s.stats.edits} file edits.`,
    );
  }
  if (s.prUrl) lines.push(`Pull request opened: ${s.prUrl}`);
  lines.push("");

  lines.push("## Human prompts (in order) — reference by id");
  for (const e of s.events) {
    if (e.kind === "user_prompt") lines.push(`- [${e.id}] ${e.command ? e.command + " " : ""}${trunc(e.text, 400)}`);
  }
  lines.push("");

  const says = s.events.filter((e) => e.kind === "assistant_text") as Extract<
    SessionModel["events"][number],
    { kind: "assistant_text" }
  >[];
  if (says.length) {
    lines.push("## What the agent said (sampled) — reference by id");
    const step = Math.max(1, Math.floor(says.length / 12));
    for (let i = 0; i < says.length; i += step) lines.push(`- [${says[i].id}] ${trunc(says[i].text, 240)}`);
    lines.push("");
  }

  const edits = s.events.filter((e) => e.kind === "tool_call" && (e as any).edit) as Extract<
    SessionModel["events"][number],
    { kind: "tool_call" }
  >[];
  lines.push(`## Diff candidates (${edits.length}) — pick ONE strong one; reference the tool_call id`);
  for (const e of edits.slice(0, 30)) {
    const ed = (e as any).edit;
    const file = ed.path.split("/").slice(-1)[0];
    lines.push(`- [${e.id}] ${file} (${ed.lang}) | before: ${trunc(ed.before, 70)} | after: ${trunc(ed.after, 70)}`);
  }
  lines.push("");

  const bash = s.events.filter((e) => e.kind === "tool_call" && (e as any).tool === "Bash") as Extract<
    SessionModel["events"][number],
    { kind: "tool_call" }
  >[];
  if (bash.length) {
    lines.push("## Notable shell commands — reference by id");
    for (const e of bash.slice(0, 10)) {
      const cmd = (e.input as any)?.command ?? "";
      if (cmd) lines.push(`- [${e.id}] ${trunc(cmd, 120)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

const EXAMPLE: Storyboard = {
  title: "Refactor, delegated",
  summary: "A one-line ask becomes a sweeping, careful refactor across the codebase, ending in a shipped PR.",
  fps: DEFAULT_FPS,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  scenes: [
    { id: "s1", kind: "intro", durationInFrames: 100, caption: "One ask. A whole refactor.", narration: "Watch an agent take a single instruction and run with it." },
    { id: "s2", kind: "prompt", durationInFrames: 120, caption: "“Rename the project, update everything, open a PR.”", narration: "It starts with one sentence.", eventRefs: ["<a user_prompt id>"] },
    { id: "s3", kind: "diff", durationInFrames: 150, caption: "ci → justci, everywhere it matters", narration: "The agent edits file after file, keeping every reference in sync.", eventRefs: ["<a diff-candidate tool_call id>"] },
    { id: "s4", kind: "outro", durationInFrames: 100, caption: "Shipped: PR #25", narration: "Minutes later, the pull request is open." },
  ],
};

function brief(s: SessionModel): string {
  const schema = JSON.stringify(zodToJsonSchema(StoryboardSchema, { $refStrategy: "none", target: "jsonSchema7" }), null, 2);
  return `You are the EDITOR of a short, narrated demo video that shows how a developer works with AI coding agents. Below is a digest of one real Claude Code session. Produce a STORYBOARD and WRITE IT to \`artifacts/storyboard.raw.json\`.

OUTPUT CONTRACT (critical):
- Use the Write tool to create \`artifacts/storyboard.raw.json\` containing ONLY raw JSON — no markdown, no \`\`\` fences, no commentary.
- Use ONLY the Read and Write tools. Do NOT run Bash or any other tool. Do not ask questions.
- The JSON MUST validate against this JSON Schema:
${schema}

CREATIVE BRIEF:
- The video is a 1:1 SQUARE canvas, ${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}, dark terminal/IDE aesthetic, ${DEFAULT_FPS} fps. Set fps=${DEFAULT_FPS}, width=${DEFAULT_WIDTH}, height=${DEFAULT_HEIGHT}.
- Compose a TIGHT 4–6 scene arc:
  1. exactly one "intro" first (title card: what the developer set out to do).
  2. one "prompt" scene quoting the key human request (eventRefs = that user_prompt id; put the quoted ask in caption).
  3. one or two middle scenes: "diff" (feature ONE legible before/after — eventRefs = ONE diff-candidate tool_call id; DO NOT put code in the scene, the renderer pulls the real code from that id) and/or "agent_work"/"tool_run".
  4. exactly one "outro" last (the payoff — e.g. the PR opened).
- Every scene: a short on-screen "caption" (≤ ~90 chars, punchy) AND a one-sentence "narration" (spoken voiceover, natural, present tense).
- durationInFrames pacing (at ${DEFAULT_FPS} fps): intro/outro ~90–120, prompt ~120, diff ~150, others ~90–120.
- eventRefs MUST be ids that appear in the digest. For the diff scene, reference a tool_call id from "Diff candidates". Never invent code or ids.
- "summary" = one paragraph describing the arc. "title" = a crisp video title.

EXAMPLE shape (structure only — write YOUR storyboard for the real session below):
${JSON.stringify(EXAMPLE, null, 2)}

=================== SESSION DIGEST ===================
${digest(s)}`;
}

function runPty(timeoutSec: number): Promise<boolean> {
  const oneLine =
    `Read the file ${PROMPT_FILE} and follow its instructions exactly. ` +
    `Write your JSON result to ${RAW_FILE}. Use only the Read and Write tools; do not run any other tool.`;
  return new Promise((res) => {
    const child = spawn(
      "python3",
      [PTY_DRIVER, oneLine, RAW_FILE, String(timeoutSec), "--",
       "--model", "sonnet", "--effort", "medium", "--permission-mode", "acceptEdits"],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    child.on("close", (code) => res(code === 0));
    child.on("error", () => res(false));
  });
}

function parseRaw(): unknown {
  let raw = readFileSync(RAW_FILE, "utf8").replace(/^﻿/, "").replace(/^```(?:json)?\s*|\s*```\s*$/g, "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    // The model occasionally wraps a quoted value in unescaped double quotes, e.g.
    //   "caption": ""Rename 'ci' to 'justci'…""   → invalid JSON.
    // Collapse that wrapper and curl the inner quotes so it parses.
    raw = raw.replace(
      /"(caption|title|summary|narration|promptText)":\s*""([\s\S]*?)"",/g,
      (_m, k, inner) => `"${k}": "“${String(inner).replace(/"/g, "”")}”",`,
    );
    return JSON.parse(raw);
  }
}

function finalize(sb: Storyboard): Storyboard {
  return { ...sb, fps: sb.fps || DEFAULT_FPS, width: sb.width ?? DEFAULT_WIDTH, height: sb.height ?? DEFAULT_HEIGHT };
}

async function main() {
  const [, , inPath = "artifacts/session.json", outPath = "artifacts/storyboard.json"] = process.argv;
  const session = SessionModelSchema.parse(JSON.parse(readFileSync(inPath, "utf8")));

  mkdirSync(dirname(PROMPT_FILE), { recursive: true });
  writeFileSync(PROMPT_FILE, brief(session));

  const ids = new Set(session.events.map((e) => e.id));
  let sb: Storyboard | undefined;

  for (let attempt = 1; attempt <= 2 && !sb; attempt++) {
    console.error(`direct: driving interactive claude (sonnet, pty, subscription-billed) — attempt ${attempt}…`);
    const ok = await runPty(300);
    if (!ok || !existsSync(RAW_FILE)) {
      console.error("direct: no valid output file this attempt.");
      continue;
    }
    let raw: unknown;
    try {
      raw = parseRaw();
    } catch (e) {
      console.error("direct: raw file is not parseable JSON:", (e as Error).message);
      continue;
    }
    const parsed = StoryboardSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("direct: storyboard failed schema validation:", parsed.error.issues.slice(0, 4));
      continue;
    }
    sb = finalize(parsed.data);
  }

  if (!sb) throw new Error("direct: could not obtain a valid storyboard from claude after 2 attempts.");

  for (const sc of sb.scenes)
    for (const ref of sc.eventRefs ?? [])
      if (!ids.has(ref)) console.error(`  ⚠ scene ${sc.id} references unknown event id ${ref}`);

  writeFileSync(outPath, JSON.stringify(sb, null, 2));
  console.error(
    `direct: "${sb.title}" → ${outPath}\n` +
      `  ${sb.scenes.length} scenes [${sb.scenes.map((s) => s.kind).join(", ")}] · ${sb.fps}fps ${sb.width}x${sb.height}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
