/**
 * Build-time syntax highlighting + line diffing (Node only — Shiki/WASM).
 * Runs inside `prepare`, never in a frame: we serialize tokens into props so the
 * composition is deterministic and needs no highlighting at render time.
 */
import { createHighlighter, type Highlighter } from "shiki";
import type { DiffLineJSON, PreparedDiff, TokenJSON } from "./model";

const THEME = "github-dark";

const LANG_ALIAS: Record<string, string> = {
  text: "text", txt: "text", md: "markdown", markdown: "markdown",
  ts: "typescript", typescript: "typescript", tsx: "tsx", js: "javascript",
  javascript: "javascript", jsx: "jsx", json: "json", html: "html", css: "css",
  scss: "scss", sh: "bash", bash: "bash", zsh: "bash", py: "python", python: "python",
  rs: "rust", rust: "rust", go: "go", haskell: "haskell", hs: "haskell", nix: "nix",
  yaml: "yaml", yml: "yaml", toml: "toml", sql: "sql", java: "java", c: "c",
  cpp: "cpp", ruby: "ruby", rb: "ruby", graphql: "graphql", vue: "vue", svelte: "svelte",
};

let hlPromise: Promise<Highlighter> | null = null;
function getHighlighter(): Promise<Highlighter> {
  if (!hlPromise) hlPromise = createHighlighter({ themes: [THEME], langs: [] });
  return hlPromise;
}

async function resolveLang(h: Highlighter, lang: string): Promise<string> {
  const id = LANG_ALIAS[lang.toLowerCase()] ?? lang.toLowerCase();
  if (id === "text") return "text";
  if (h.getLoadedLanguages().includes(id)) return id;
  try {
    await h.loadLanguage(id as any);
    return id;
  } catch {
    return "text";
  }
}

function toTokenLines(h: Highlighter, code: string, lang: string): TokenJSON[][] {
  const { tokens } = h.codeToTokens(code, { lang: lang as any, theme: THEME });
  return tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color, fontStyle: t.fontStyle })));
}

/** Highlight a single code block → per-line token arrays. */
export async function highlightCode(code: string, lang: string): Promise<TokenJSON[][]> {
  const h = await getHighlighter();
  return toTokenLines(h, code.replace(/\n$/, ""), await resolveLang(h, lang));
}

/** Minimal LCS line diff → ordered ops with source-side index. */
type Op = { status: "context" | "add" | "remove"; aIdx?: number; bIdx?: number };
function lineDiff(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) ops.push({ status: "context", aIdx: i++, bIdx: j++ });
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ status: "remove", aIdx: i++ });
    else ops.push({ status: "add", bIdx: j++ });
  }
  while (i < n) ops.push({ status: "remove", aIdx: i++ });
  while (j < m) ops.push({ status: "add", bIdx: j++ });
  return ops;
}

export async function buildDiff(before: string, after: string, lang: string): Promise<PreparedDiff> {
  const h = await getHighlighter();
  const useLang = await resolveLang(h, lang);
  const beforeLines = before.replace(/\n$/, "").split("\n");
  const afterLines = after.replace(/\n$/, "").split("\n");
  const beforeTok = toTokenLines(h, before.replace(/\n$/, ""), useLang);
  const afterTok = toTokenLines(h, after.replace(/\n$/, ""), useLang);
  const ops = lineDiff(beforeLines, afterLines);
  const lines: DiffLineJSON[] = ops.map((op) =>
    op.status === "remove"
      ? { status: "remove", tokens: beforeTok[op.aIdx!] ?? [] }
      : op.status === "add"
        ? { status: "add", tokens: afterTok[op.bIdx!] ?? [] }
        : { status: "context", tokens: afterTok[op.bIdx!] ?? [] },
  );
  return {
    lang: useLang,
    lines,
    added: ops.filter((o) => o.status === "add").length,
    removed: ops.filter((o) => o.status === "remove").length,
  };
}
