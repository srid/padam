/**
 * The render-time props model — plain JSON, no zod (this is imported by the Remotion
 * composition, so it must stay light and serializable). `prepare` turns a validated
 * `Storyboard` into this: same scene fields, plus pre-computed Shiki tokens for
 * code/diff scenes so frames render with no WASM/highlighting at frame time.
 */
export type SceneKind =
  | "title" | "bullets" | "code" | "diff" | "terminal"
  | "quote" | "image" | "stats" | "outro" | "custom";

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
  lang: string;
  lines: DiffLineJSON[];
  added: number;
  removed: number;
}

export interface ResolvedTheme {
  bg: string;
  panel: string;
  panelHi: string;
  border: string;
  fg: string;
  fgDim: string;
  fgFaint: string;
  accent: string;
  green: string;
  red: string;
  yellow: string;
  purple: string;
  addBg: string;
  removeBg: string;
  mono: string;
  sans: string;
}

export interface PreparedScene {
  id: string;
  kind: SceneKind;
  durationInFrames: number;
  transition?: "none" | "fade";
  caption?: string;
  narration?: string;
  heading?: string;
  sub?: string;
  eyebrow?: string;
  items?: string[];
  chips?: string[];
  file?: string;
  command?: string;
  output?: string;
  text?: string;
  by?: string;
  src?: string;
  component?: string;
  props?: Record<string, unknown>;
  // pre-computed at build time:
  codeTokens?: TokenJSON[][]; // for "code"
  lang?: string;
  diff?: PreparedDiff; // for "diff"
}

export interface RenderModel {
  title: string;
  fps: number;
  width: number;
  height: number;
  theme: ResolvedTheme;
  scenes: PreparedScene[];
  [key: string]: unknown; // satisfy Remotion's Composition props constraint
}

export const PLACEHOLDER_MODEL: RenderModel = {
  title: "video",
  fps: 30,
  width: 1920,
  height: 1080,
  theme: {
    bg: "#0b0e14", panel: "#161b22", panelHi: "#1c2230", border: "#30363d",
    fg: "#e6edf3", fgDim: "#8b949e", fgFaint: "#6e7681", accent: "#58a6ff",
    green: "#3fb950", red: "#f85149", yellow: "#d29922", purple: "#bc8cff",
    addBg: "rgba(63,185,80,0.16)", removeBg: "rgba(248,81,73,0.16)",
    mono: "'PadamMono','DejaVu Sans Mono',monospace", sans: "'PadamSans','DejaVu Sans',sans-serif",
  },
  scenes: [{ id: "s1", kind: "title", durationInFrames: 90, heading: "Hello" }],
};
