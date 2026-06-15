# Scene catalog

Every scene: `id` (string), `kind`, `durationInFrames` (int > 0). Optional on all:
`caption` (on-screen lower-third), `narration` (future TTS), `transition`
(`"fade"` default | `"none"`). Storyboard root: `title`, `fps` (30), `width` (1920),
`height` (1080), `theme?`, `scenes[]`.

| kind | fields | notes |
|---|---|---|
| `title` | `heading`, `sub?`, `eyebrow?` | big centered title card; `eyebrow` = small uppercase label |
| `bullets` | `heading?`, `items[]` | items reveal one by one |
| `code` | `code`, `lang?`, `file?` | Shiki-highlighted; `file` shows in the window title; clipped ~22 lines |
| `diff` | `before`, `after`, `lang?`, `file?` | LCS line diff, red/remove + green/add; clipped ~20 lines |
| `terminal` | `command`, `output?` | `$ command` typed out, then `output` (pre-wrapped) |
| `quote` | `text`, `by?` | large pull quote + attribution |
| `image` | `src`, `caption?` | `src` is relative to the video's folder (`videos/<name>/`) |
| `stats` | `heading?`, `chips[]` | animated pill row |
| `outro` | `heading?`, `sub?`, `chips[]` | closing card with a ✓ |
| `custom` | `component`, `props?` | React scene registered in `src/scenes/custom/index.ts` |

## Theme override (all optional)

```jsonc
"theme": {
  "bg": "#0b0e14", "panel": "#161b22", "border": "#30363d",
  "fg": "#e6edf3", "fgDim": "#8b949e", "accent": "#58a6ff",
  "green": "#3fb950", "red": "#f85149",
  "mono": "'PadamMono','DejaVu Sans Mono',monospace",
  "sans": "'PadamSans','DejaVu Sans',sans-serif"
}
```

## Example

```jsonc
{
  "title": "release v2", "width": 1080, "height": 1080, "fps": 30,
  "theme": { "accent": "#1E6AFF" },
  "scenes": [
    { "id": "a", "kind": "title", "durationInFrames": 100, "eyebrow": "shipping", "heading": "v2 is out", "sub": "what changed" },
    { "id": "b", "kind": "diff", "durationInFrames": 150, "lang": "ts", "file": "api.ts",
      "before": "fetch(url)", "after": "fetch(url, { cache: 'force-cache' })", "caption": "now cached by default" },
    { "id": "c", "kind": "stats", "durationInFrames": 110, "heading": "by the numbers", "chips": ["3× faster", "0 breaking changes"] },
    { "id": "d", "kind": "outro", "durationInFrames": 100, "heading": "upgrade today", "chips": ["npm i pkg@2"] }
  ]
}
```

## Custom scene

```tsx
// src/scenes/custom/Counter.tsx
import React from "react";
import { useCurrentFrame } from "remotion";
import type { PreparedScene } from "../../model";
export const Counter: React.FC<{ scene: PreparedScene }> = ({ scene }) => {
  const to = Number(scene.props?.to ?? 100);
  const n = Math.min(to, Math.round((useCurrentFrame() / 30) * to)); // deterministic
  return <div style={{ fontSize: 200, color: "#58a6ff" }}>{n}</div>;
};
```
```ts
// src/scenes/custom/index.ts
import { Counter } from "./Counter";
export const customScenes = { Counter };
```
```jsonc
{ "id": "x", "kind": "custom", "component": "Counter", "durationInFrames": 90, "props": { "to": 953 } }
```
