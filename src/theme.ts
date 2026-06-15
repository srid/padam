import type { CSSProperties } from "react";
import type { ResolvedTheme } from "./model";
import type { ThemeOverride } from "./schema";

/** The built-in dark terminal/IDE palette (GitHub-dark-ish). */
export const DEFAULT_THEME: ResolvedTheme = {
  bg: "#0b0e14",
  panel: "#161b22",
  panelHi: "#1c2230",
  border: "#30363d",
  fg: "#e6edf3",
  fgDim: "#8b949e",
  fgFaint: "#6e7681",
  accent: "#58a6ff",
  green: "#3fb950",
  red: "#f85149",
  yellow: "#d29922",
  purple: "#bc8cff",
  addBg: "rgba(63,185,80,0.16)",
  removeBg: "rgba(248,81,73,0.16)",
  mono: "'PadamMono','DejaVu Sans Mono','Liberation Mono','Menlo','Consolas',monospace",
  sans: "'PadamSans','DejaVu Sans','Liberation Sans','Inter','Segoe UI','Arial',sans-serif",
};

/** Merge a storyboard's theme override onto the defaults. */
export function resolveTheme(override?: ThemeOverride): ResolvedTheme {
  return { ...DEFAULT_THEME, ...(override ?? {}) };
}

/** Map a Shiki fontStyle bitmask to CSS. */
export function fontStyleCss(fs = 0): CSSProperties {
  return {
    fontStyle: fs & 1 ? "italic" : undefined,
    fontWeight: fs & 2 ? "bold" : undefined,
    textDecoration: fs & 4 ? "underline" : undefined,
  };
}
