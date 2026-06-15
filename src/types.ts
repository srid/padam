/**
 * The central contract. Every stage agrees on these two shapes.
 *
 * `SessionModel`  — stage 1 (`extract`) output: a faithful, normalized session.
 * `Storyboard`    — stage 2 (`direct`) output / stage 3 (`render`) input: the editorial plan.
 *
 * Zod schemas are the source of truth; the TS types are inferred from them so the
 * runtime validation and the compile-time types can never drift apart. We also
 * emit the Storyboard schema as JSON Schema (see `storyboard-schema.ts`) to drive
 * the `claude --json-schema` structured-output call in stage 2.
 *
 * This is a *refinement* of the starting proposal in the brief, locked against a
 * real on-disk session (`~/.claude/projects/.../<id>.jsonl`). Notable additions:
 *   - `tool_call.edit`     — before/after snippet for file-editing tools, harvested
 *                            from the transcript's top-level `toolUseResult`
 *                            (`oldString`/`newString`/`structuredPatch`). This lets
 *                            the render hydrate a real diff from `session.json`
 *                            without the LLM ever inventing code.
 *   - `user_prompt.command`— the slash-command name when a prompt was one (`/do` …).
 *   - session-level `cwd` / `gitBranch` / `prUrl` / `stats` — context for captions
 *                            and the outro (the PR the agent opened).
 *   - `Storyboard.width/height` — explicit canvas (defaults to 1080×1080 square).
 */
import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────
// Stage 1 output: the normalized session
// ──────────────────────────────────────────────────────────────────────────

/** A focused before/after for a file-editing tool call, ready to render as a diff. */
export const EditSchema = z.object({
  path: z.string(),
  lang: z.string(),
  before: z.string(),
  after: z.string(),
});
export type Edit = z.infer<typeof EditSchema>;

export const SessionEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("user_prompt"),
    id: z.string(),
    ts: z.string(),
    text: z.string(),
    isSlashCommand: z.boolean().optional(),
    command: z.string().optional(),
  }),
  z.object({ kind: z.literal("assistant_text"), id: z.string(), ts: z.string(), text: z.string() }),
  z.object({ kind: z.literal("thinking"), id: z.string(), ts: z.string(), text: z.string() }),
  z.object({
    kind: z.literal("tool_call"),
    id: z.string(),
    ts: z.string(),
    tool: z.string(),
    input: z.unknown(),
    edit: EditSchema.optional(),
  }),
  z.object({
    kind: z.literal("tool_result"),
    id: z.string(),
    ts: z.string(),
    forCallId: z.string(),
    output: z.string(),
    isError: z.boolean(),
  }),
]);
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const SessionModelSchema = z.object({
  sessionId: z.string(),
  project: z.string(), // friendly name derived from cwd (repo, not worktree)
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  prUrl: z.string().optional(),
  stats: z
    .object({
      prompts: z.number(),
      assistantMessages: z.number(),
      toolCalls: z.number(),
      edits: z.number(),
      durationMs: z.number(),
    })
    .optional(),
  events: z.array(SessionEventSchema),
});
export type SessionModel = z.infer<typeof SessionModelSchema>;

// ──────────────────────────────────────────────────────────────────────────
// Stage 2 output / Stage 3 input: the editorial plan
// ──────────────────────────────────────────────────────────────────────────

export const SceneKindSchema = z.enum([
  "intro",
  "prompt",
  "agent_work",
  "diff",
  "tool_run",
  "outro",
]);
export type SceneKind = z.infer<typeof SceneKindSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  kind: SceneKindSchema,
  durationInFrames: z.number().int().positive(),
  caption: z.string().optional(), // on-screen text
  narration: z.string().optional(), // TTS line for this scene (stage 4)
  eventRefs: z.array(z.string()).optional(), // SessionEvent ids this scene visualizes
  /**
   * Code to show. If omitted on a `diff`/`tool_run` scene, the renderer hydrates
   * it from `session.json` using `eventRefs` (preferred — keeps code authentic).
   */
  code: z
    .object({
      path: z.string(),
      before: z.string().optional(),
      after: z.string().optional(),
      lang: z.string(),
    })
    .optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const StoryboardSchema = z.object({
  title: z.string(),
  summary: z.string(), // the narrative arc, one paragraph
  fps: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  scenes: z.array(SceneSchema).min(1),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

// Default canvas: a 1080×1080 square at 30fps.
export const DEFAULT_FPS = 30;
export const DEFAULT_WIDTH = 1080;
export const DEFAULT_HEIGHT = 1080;
