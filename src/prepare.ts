/**
 * Storyboard (authoring) → RenderModel (render props). Node-only: runs Shiki for
 * code/diff scenes so the composition stays deterministic & WASM-free.
 */
import { buildDiff, highlightCode } from "./highlight";
import type { PreparedScene, RenderModel } from "./model";
import type { Storyboard } from "./schema";
import { resolveTheme } from "./theme";

export async function prepare(sb: Storyboard): Promise<RenderModel> {
  const scenes: PreparedScene[] = [];
  for (const sc of sb.scenes) {
    const out: PreparedScene = { ...sc };
    if (sc.kind === "code" && sc.code != null) {
      out.codeTokens = await highlightCode(sc.code, sc.lang ?? "text");
      out.lang = sc.lang ?? "text";
    }
    if (sc.kind === "diff" && sc.before != null && sc.after != null) {
      out.diff = await buildDiff(sc.before, sc.after, sc.lang ?? "text");
    }
    scenes.push(out);
  }
  return {
    title: sb.title,
    fps: sb.fps,
    width: sb.width,
    height: sb.height,
    theme: resolveTheme(sb.theme),
    scenes,
  };
}
