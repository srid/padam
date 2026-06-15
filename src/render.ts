/**
 * Stage 3 — render: storyboard.json (+ session.json) → out.mp4
 *
 *   tsx src/render.ts [storyboard.json] [session.json] [out.mp4]
 *
 * Drives Remotion programmatically (bundle → selectComposition → renderMedia) so
 * it is CI-automatable, not Studio-only. Determinism: everything the composition
 * sees comes from `inputProps` we prepare here (Shiki tokens included) — no
 * Date.now/Math.random/network inside frames; duration derives from the scenes via
 * calculateMetadata.
 *
 * Chromium: Remotion normally downloads a headless Chrome, which breaks in a Nix
 * sandbox. We pass `browserExecutable` from $CHROMIUM_PATH (the flake pins it) so
 * Remotion uses the Nix-provided Chromium and skips the download.
 */
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SessionModelSchema, StoryboardSchema } from "./types";
import { prepare } from "./render/prepare";
import type { RenderModel } from "./render/model";

/** Best-effort: put real font files where the composition's @font-face expects them. */
function ensureFonts() {
  const dst = resolve("public/fonts");
  mkdirSync(dst, { recursive: true });
  const wanted: Array<[string, string[]]> = [
    ["mono.ttf", [process.env.FONT_MONO ?? "", "/run/current-system/sw/share/X11/fonts/DejaVuSansMono.ttf"]],
    ["sans.ttf", [process.env.FONT_SANS ?? "", "/run/current-system/sw/share/X11/fonts/DejaVuSans.ttf"]],
  ];
  for (const [name, candidates] of wanted) {
    if (existsSync(resolve(dst, name))) continue;
    for (const src of candidates) {
      if (src && existsSync(src)) {
        try {
          copyFileSync(src, resolve(dst, name));
          break;
        } catch {
          /* fall back to system fonts via the CSS stack */
        }
      }
    }
  }
}

async function main() {
  const [, , sbPath = "artifacts/storyboard.json", sePath = "artifacts/session.json", outPath = "out.mp4"] =
    process.argv;

  const sb = StoryboardSchema.parse(JSON.parse(readFileSync(sbPath, "utf8")));
  const session = SessionModelSchema.parse(JSON.parse(readFileSync(sePath, "utf8")));

  const model: RenderModel = await prepare(sb, session);
  ensureFonts();

  const browserExecutable = process.env.CHROMIUM_PATH || null; // null ⇒ Remotion downloads (local fallback)
  if (browserExecutable) console.error(`render: using Chromium at ${browserExecutable}`);
  await ensureBrowser({ browserExecutable });

  const entryPoint = resolve("src/render/index.ts");
  console.error("render: bundling…");
  const serveUrl = await bundle({ entryPoint, publicDir: resolve("public") });

  console.error("render: selecting composition…");
  const composition = await selectComposition({
    serveUrl,
    id: "Session",
    inputProps: model,
    browserExecutable,
    chromiumOptions: { gl: "swiftshader" },
  });
  console.error(
    `render: ${composition.durationInFrames} frames @ ${composition.fps}fps, ${composition.width}x${composition.height}`,
  );

  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: resolve(outPath),
    inputProps: model,
    browserExecutable,
    chromiumOptions: { gl: "swiftshader" },
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct !== lastPct && pct % 5 === 0) {
        lastPct = pct;
        console.error(`render: ${pct}%`);
      }
    },
  });

  console.error(`render: wrote ${resolve(outPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
