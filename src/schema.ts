/**
 * The authoring contract — what you (or the agent) write in a `storyboard.json`.
 *
 * Zod is the source of truth; TS types are inferred. This is the *editable* surface:
 * a flat, hand-friendly scene list. Stage `render` validates a storyboard against
 * this, then `prepare` turns it into the plain `RenderModel` the composition draws.
 *
 * Kept permissive on purpose: one `Scene` shape with optional, kind-specific fields,
 * so a human can edit it without fighting a discriminated union. Scene components
 * read the fields they care about; `render` warns about obviously-missing ones.
 */
import { z } from "zod";

export const SceneKindSchema = z.enum([
  "title", // heading + sub — a title/section card
  "bullets", // heading + items[] — a list that reveals
  "code", // lang + code — a syntax-highlighted block
  "diff", // lang + before + after — a red/green diff
  "terminal", // command (+ output) — a typed shell line
  "quote", // text + by — a pull quote
  "image", // src (+ caption) — a static image (from the video's folder)
  "stats", // heading + chips[] — animated stat pills
  "outro", // heading + sub + chips[] — the closing card
  "custom", // component + props — a bespoke .tsx scene (escape hatch)
]);
export type SceneKind = z.infer<typeof SceneKindSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  kind: SceneKindSchema,
  durationInFrames: z.number().int().positive(),
  transition: z.enum(["none", "fade"]).optional(), // entry/exit; default "fade"
  caption: z.string().optional(), // lower-third on-screen text
  narration: z.string().optional(), // spoken line (stage 4 / future TTS)
  // title / outro / section
  heading: z.string().optional(),
  sub: z.string().optional(),
  eyebrow: z.string().optional(), // small label above the heading
  // bullets / stats
  items: z.array(z.string()).optional(),
  chips: z.array(z.string()).optional(),
  // code / diff
  lang: z.string().optional(),
  code: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  file: z.string().optional(), // shown in the window title bar
  // terminal
  command: z.string().optional(),
  output: z.string().optional(),
  // quote
  text: z.string().optional(),
  by: z.string().optional(),
  // image
  src: z.string().optional(), // path relative to the video's folder
  // custom
  component: z.string().optional(), // name registered in src/scenes/custom
  props: z.record(z.unknown()).optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ThemeOverrideSchema = z
  .object({
    bg: z.string(),
    panel: z.string(),
    border: z.string(),
    fg: z.string(),
    fgDim: z.string(),
    accent: z.string(),
    green: z.string(),
    red: z.string(),
    mono: z.string(),
    sans: z.string(),
  })
  .partial();
export type ThemeOverride = z.infer<typeof ThemeOverrideSchema>;

export const StoryboardSchema = z.object({
  title: z.string(),
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  theme: ThemeOverrideSchema.optional(),
  music: z.string().optional(), // path to a bg audio track (muxed if present)
  scenes: z.array(SceneSchema).min(1),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;
