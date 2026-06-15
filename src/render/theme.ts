/** Shared dark terminal/IDE aesthetic. Pure constants — safe in the browser bundle. */
export const theme = {
  // GitHub-dark-ish palette (matches the Shiki 'github-dark' code theme).
  bg0: "#0b0e14",
  bg1: "#0d1117",
  panel: "#161b22",
  panelHi: "#1c2230",
  border: "#30363d",
  fg: "#e6edf3",
  fgDim: "#8b949e",
  fgFaint: "#6e7681",
  accent: "#58a6ff",
  green: "#3fb950",
  red: "#f85149",
  purple: "#bc8cff",
  yellow: "#d29922",
  addBg: "rgba(63,185,80,0.16)",
  removeBg: "rgba(248,81,73,0.16)",
  addGutter: "#3fb950",
  removeGutter: "#f85149",
  mono: "'PadamMono','DejaVu Sans Mono','Liberation Mono','Menlo','Consolas',monospace",
  sans: "'PadamSans','DejaVu Sans','Liberation Sans','Inter','Segoe UI','Arial',sans-serif",
} as const;

/** Map a Shiki fontStyle bitmask to CSS. */
export function fontStyleCss(fs = 0): React.CSSProperties {
  return {
    fontStyle: fs & 1 ? "italic" : undefined,
    fontWeight: fs & 2 ? ("bold" as const) : undefined,
    textDecoration: fs & 4 ? "underline" : undefined,
  };
}
