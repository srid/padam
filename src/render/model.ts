/**
 * The render-time input-props model — what the Remotion composition receives.
 *
 * This is a *prepared* projection of the Storyboard: stage 3 resolves each scene's
 * diff/prompt against session.json and runs Shiki at build time, so the composition
 * is pure, deterministic, and needs no Shiki/WASM at frame time. Everything here is
 * plain JSON (no zod, no functions) so it serializes cleanly into `inputProps`.
 */
export type SceneKind = "intro" | "prompt" | "agent_work" | "diff" | "tool_run" | "outro";

/** A Shiki token, flattened to the minimum the renderer needs. */
export interface TokenJSON {
  content: string;
  color?: string;
  fontStyle?: number; // bitmask: italic&1, bold&2, underline&4
}

export type DiffStatus = "add" | "remove" | "context";
export interface DiffLineJSON {
  status: DiffStatus;
  tokens: TokenJSON[];
}

export interface PreparedDiff {
  path: string;
  lang: string;
  lines: DiffLineJSON[];
  added: number;
  removed: number;
}

export interface PreparedScene {
  id: string;
  kind: SceneKind;
  durationInFrames: number;
  caption?: string;
  narration?: string;
  // Resolved, kind-specific payloads:
  promptText?: string; // prompt scenes
  command?: string; // slash-command name, if any
  diff?: PreparedDiff; // diff scenes
  bash?: string; // tool_run scenes
}

export interface RenderStats {
  prompts: number;
  assistantMessages: number;
  toolCalls: number;
  edits: number;
  durationMs: number;
}

// Extends Record so it satisfies Remotion's Composition props constraint.
export interface RenderModel extends Record<string, unknown> {
  title: string;
  summary: string;
  fps: number;
  width: number;
  height: number;
  project: string;
  branch?: string;
  prUrl?: string;
  stats?: RenderStats;
  scenes: PreparedScene[];
}

/** A minimal, valid model so the Composition has sane defaultProps for Studio/preview. */
export const PLACEHOLDER_MODEL: RenderModel = {
  title: "Claude Code session",
  summary: "A demo.",
  fps: 30,
  width: 1080,
  height: 1080,
  project: "session",
  scenes: [{ id: "intro", kind: "intro", durationInFrames: 90, caption: "Claude Code session" }],
};
