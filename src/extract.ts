/**
 * Stage 1 — extract: a pure parse, no network.
 *
 *   tsx src/extract.ts <session.jsonl> [out.json]
 *
 * Reads one Claude Code transcript (`~/.claude/projects/**​/<id>.jsonl`) and writes
 * one normalized `SessionModel` JSON. Deterministic; touches nothing but the two files.
 *
 * Transcript shape (locked against real sessions):
 *   - Each line is a JSON object with a top-level `type`
 *     (user | assistant | system | pr-link | file-history-snapshot | mode | …).
 *   - `user` / `assistant` lines carry `message: { role, content }` where `content`
 *     is a string OR an array of blocks: { text | thinking | tool_use | tool_result | image }.
 *   - A `tool_use` block has { id, name, input }.
 *   - The matching tool result rides on a *user* line: a `tool_result` block
 *     ({ tool_use_id, content, is_error }) plus a rich top-level `toolUseResult`
 *     that, for edits, contains { filePath, oldString, newString, structuredPatch }.
 *   - `pr-link` lines carry `prUrl`.
 *   - Each line also has top-level `timestamp`, `cwd`, `gitBranch`, `sessionId`,
 *     and flags `isMeta` / `isSidechain` we use to skip noise.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { SessionEvent, SessionModel, SessionModelSchema, Edit } from "./types";

const LANG_BY_EXT: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js",
  json: "json", md: "markdown", mdx: "markdown", html: "html", css: "css",
  scss: "scss", hs: "haskell", cabal: "haskell", nix: "nix", py: "python",
  rb: "ruby", rs: "rust", go: "go", java: "java", c: "c", h: "c", cpp: "cpp",
  sh: "bash", bash: "bash", zsh: "bash", yaml: "yaml", yml: "yaml",
  toml: "toml", sql: "sql", graphql: "graphql", vue: "vue", svelte: "svelte",
};
function langFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANG_BY_EXT[ext] ?? "text";
}

/** Keep session.json lean: clamp oversized tool outputs / edit bodies. */
const MAX_OUTPUT = 4000;
const MAX_EDIT = 6000;
function clamp(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n… [${s.length - n} more chars]` : s;
}

/** Unwrap slash-command + harness wrappers so a prompt reads like what the human typed. */
function cleanPrompt(raw: string): { text: string; command?: string } {
  const cmd = raw.match(/<command-name>\s*([^<]*?)\s*<\/command-name>/)?.[1]?.trim();
  const text = raw
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .replace(/<command-args>([\s\S]*?)<\/command-args>/g, "$1")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .replace(/<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<[^>]*caveat[^>]*>[\s\S]*?<\/[^>]*caveat[^>]*>/gi, "")
    .replace(/\[Image #\d+\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, command: cmd };
}

/** Coerce a tool_result `content` (string | block[]) into a flat string. */
function resultToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b: any) => {
        if (b == null) return "";
        if (typeof b === "string") return b;
        if (b.type === "text") return b.text ?? "";
        if (b.type === "image") return "[image]";
        if (b.type === "tool_reference") return `→ ${b.tool_name}`;
        return typeof b.text === "string" ? b.text : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") return JSON.stringify(content);
  return "";
}

/** Derive a focused before/after from a transcript's top-level `toolUseResult`. */
function editFrom(tool: string, input: any, tur: any): Edit | undefined {
  const path: string | undefined = tur?.filePath ?? input?.file_path;
  if (!path) return undefined;
  const lang = langFor(path);

  // Edit / single replacement: the cleanest, most legible diff.
  if (typeof tur?.oldString === "string" && typeof tur?.newString === "string") {
    return { path, lang, before: clamp(tur.oldString, MAX_EDIT), after: clamp(tur.newString, MAX_EDIT) };
  }
  // Write / file creation: before is empty (or the prior file), after is the content.
  const content: string | undefined = tur?.content ?? input?.content;
  if (typeof content === "string") {
    const before = typeof tur?.originalFile === "string" ? tur.originalFile : "";
    return { path, lang, before: clamp(before, MAX_EDIT), after: clamp(content, MAX_EDIT) };
  }
  // MultiEdit / fallback: reconstruct from the structured patch.
  if (Array.isArray(tur?.structuredPatch)) {
    const before: string[] = [];
    const after: string[] = [];
    for (const hunk of tur.structuredPatch) {
      for (const line of hunk.lines ?? []) {
        if (line.startsWith("+")) after.push(line.slice(1));
        else if (line.startsWith("-")) before.push(line.slice(1));
        else {
          before.push(line.slice(1));
          after.push(line.slice(1));
        }
      }
    }
    if (before.length || after.length) {
      return { path, lang, before: clamp(before.join("\n"), MAX_EDIT), after: clamp(after.join("\n"), MAX_EDIT) };
    }
  }
  return undefined;
}

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

function extract(jsonlPath: string): SessionModel {
  const objs = readFileSync(jsonlPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as any[];

  const events: SessionEvent[] = [];
  const timestamps: string[] = [];
  let sessionId = "";
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let prUrl: string | undefined;
  // tool_use_id → harvested edit, attached to the tool_call in a second pass.
  const editByCallId = new Map<string, Edit>();
  const toolNameByCallId = new Map<string, string>();

  for (const o of objs) {
    if (o.timestamp) timestamps.push(o.timestamp);
    sessionId ||= o.sessionId ?? "";
    cwd ??= o.cwd;
    gitBranch ??= o.gitBranch;
    if (o.type === "pr-link" && o.prUrl) prUrl = o.prUrl;
    if (o.toolUseResult?.prUrl) prUrl ??= o.toolUseResult.prUrl;

    // Skip harness/meta noise — we want the human↔agent exchange.
    if (o.isMeta || o.isSidechain) continue;
    if (o.type !== "user" && o.type !== "assistant") continue;

    const uuid: string = o.uuid ?? `${o.type}-${events.length}`;
    const ts: string = o.timestamp ?? "";
    const content = o.message?.content;

    // ── user line ──────────────────────────────────────────────────────────
    if (o.type === "user") {
      const blocks = Array.isArray(content)
        ? content
        : typeof content === "string"
          ? [{ type: "text", text: content }]
          : [];
      const isToolResult = blocks.some((b: any) => b?.type === "tool_result");

      if (isToolResult) {
        blocks.forEach((b: any, i: number) => {
          if (b?.type !== "tool_result") return;
          const callId: string = b.tool_use_id ?? "";
          // Harvest a diff from the rich top-level result for the matching call.
          if (o.toolUseResult && callId) {
            const tool = toolNameByCallId.get(callId);
            const edit = editFrom(tool ?? "", undefined, o.toolUseResult);
            if (edit) editByCallId.set(callId, edit);
          }
          events.push({
            kind: "tool_result",
            id: `${uuid}:${i}`,
            ts,
            forCallId: callId,
            output: clamp(resultToString(b.content), MAX_OUTPUT),
            isError: Boolean(b.is_error),
          });
        });
        continue;
      }

      // A real human prompt.
      const rawText = blocks
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("\n");
      const { text, command } = cleanPrompt(rawText);
      if (text) {
        events.push({
          kind: "user_prompt",
          id: uuid,
          ts,
          text,
          ...(command ? { isSlashCommand: true, command } : {}),
        });
      }
      continue;
    }

    // ── assistant line ───────────────────────────────────────────────────────
    const blocks = Array.isArray(content) ? content : [];
    blocks.forEach((b: any, i: number) => {
      if (b?.type === "text" && b.text?.trim()) {
        events.push({ kind: "assistant_text", id: `${uuid}:${i}`, ts, text: b.text });
      } else if (b?.type === "thinking" && b.thinking?.trim()) {
        events.push({ kind: "thinking", id: `${uuid}:${i}`, ts, text: b.thinking });
      } else if (b?.type === "tool_use") {
        const callId: string = b.id ?? `${uuid}:${i}`;
        toolNameByCallId.set(callId, b.name);
        const ev: SessionEvent = { kind: "tool_call", id: callId, ts, tool: b.name, input: b.input };
        // If the result was already seen (out-of-order), attach now; else 2nd pass.
        if (EDIT_TOOLS.has(b.name) && editByCallId.has(callId)) ev.edit = editByCallId.get(callId);
        events.push(ev);
      }
    });
  }

  // Second pass: attach harvested edits to their tool_call events.
  for (const ev of events) {
    if (ev.kind === "tool_call" && !ev.edit && editByCallId.has(ev.id)) {
      ev.edit = editByCallId.get(ev.id);
    }
  }

  timestamps.sort();
  const startedAt = timestamps[0] ?? "";
  const endedAt = timestamps[timestamps.length - 1] ?? "";

  // Friendly project name: the repo, not the worktree. `/a/b/ci/.worktrees/x` → `ci`.
  let project = "session";
  if (cwd) {
    const parts = cwd.split("/").filter(Boolean);
    const wi = parts.indexOf(".worktrees");
    project = wi > 0 ? parts[wi - 1] : basename(cwd);
  }

  const stats = {
    prompts: events.filter((e) => e.kind === "user_prompt").length,
    assistantMessages: events.filter((e) => e.kind === "assistant_text").length,
    toolCalls: events.filter((e) => e.kind === "tool_call").length,
    edits: events.filter((e) => e.kind === "tool_call" && e.edit).length,
    durationMs: startedAt && endedAt ? Date.parse(endedAt) - Date.parse(startedAt) : 0,
  };

  return {
    sessionId,
    project,
    cwd,
    gitBranch,
    startedAt,
    endedAt,
    prUrl,
    stats,
    events,
  };
}

function main() {
  const [, , inPath, outPath = "artifacts/session.json"] = process.argv;
  if (!inPath) {
    console.error("usage: tsx src/extract.ts <session.jsonl> [out.json]");
    process.exit(1);
  }
  const model = extract(inPath);
  // Validate against the contract before writing — fail loudly if the shape drifts.
  const parsed = SessionModelSchema.parse(model);
  writeFileSync(outPath, JSON.stringify(parsed, null, 2));
  const s = parsed.stats!;
  console.error(
    `extract: ${parsed.project} (${parsed.gitBranch ?? "?"}) → ${outPath}\n` +
      `  ${parsed.events.length} events · ${s.prompts} prompts · ${s.toolCalls} tool calls · ` +
      `${s.edits} edits · ${(s.durationMs / 60000).toFixed(1)} min` +
      (parsed.prUrl ? `\n  PR: ${parsed.prUrl}` : ""),
  );
}

main();
