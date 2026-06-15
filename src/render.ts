/**
 * render — storyboard.json → out.mp4
 *
 *   tsx src/render.ts [videos/<name> | path/to/storyboard.json] [out.mp4]
 *
 * Drives Remotion programmatically (bundle → selectComposition → renderMedia), so
 * it's CI/headless-friendly. Deterministic: everything the composition sees comes
 * from inputProps (Shiki tokens precomputed in `prepare`); duration derives from the
 * scenes. Chromium comes from $CHROMIUM_PATH (Nix-pinned) so Remotion never downloads
 * one; the video's own folder is the publicDir (images + fonts resolve there).
 */
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { StoryboardSchema } from "./schema";
import { prepare } from "./prepare";
import type { RenderModel } from "./model";

/** Put real font files where the composition's @font-face expects them (publicDir/fonts). */
function ensureFonts(publicDir: string) {
  const dst = join(publicDir, "fonts");
  mkdirSync(dst, { recursive: true });
  const want: Array<[string, string[]]> = [
    ["mono.ttf", [process.env.FONT_MONO ?? ""]],
    ["sans.ttf", [process.env.FONT_SANS ?? ""]],
  ];
  for (const [name, candidates] of want) {
    if (existsSync(join(dst, name))) continue;
    for (const src of candidates) {
      if (src && existsSync(src)) {
        try {
          copyFileSync(src, join(dst, name));
          break;
        } catch {
          /* fall back to the CSS font stack */
        }
      }
    }
  }
}

function resolvePaths(arg: string) {
  const isJson = arg.endsWith(".json");
  const storyboard = isJson ? arg : join(arg, "storyboard.json");
  const publicDir = isJson ? dirname(arg) : arg;
  return { storyboard, publicDir };
}

async function main() {
  const arg = process.argv[2] ?? "videos/hello-world";
  const { storyboard: sbPath, publicDir } = resolvePaths(arg);
  if (!existsSync(sbPath) || !statSync(sbPath).isFile()) {
    console.error(`render: no storyboard at ${sbPath}`);
    process.exit(1);
  }
  const outPath = process.argv[3] ?? join(publicDir, "out.mp4");

  const sb = StoryboardSchema.parse(JSON.parse(readFileSync(sbPath, "utf8")));
  const model: RenderModel = await prepare(sb);
  ensureFonts(publicDir);

  const browserExecutable = process.env.CHROMIUM_PATH || null;
  if (browserExecutable) console.error(`render: chromium ${browserExecutable}`);
  await ensureBrowser({ browserExecutable });

  console.error(`render: "${sb.title}" — ${model.scenes.length} scenes, bundling…`);
  const serveUrl = await bundle({ entryPoint: resolve("src/index.ts"), publicDir: resolve(publicDir) });

  const composition = await selectComposition({
    serveUrl,
    id: "Video",
    inputProps: model,
    browserExecutable,
    chromiumOptions: { gl: "swiftshader" },
  });
  console.error(`render: ${composition.durationInFrames} frames @ ${composition.fps}fps, ${composition.width}x${composition.height}`);

  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: resolve(outPath),
    inputProps: model,
    browserExecutable,
    chromiumOptions: { gl: "swiftshader" },
    onProgress: ({ progress }) => {
      const p = Math.round(progress * 100);
      if (p !== last && p % 10 === 0) {
        last = p;
        console.error(`render: ${p}%`);
      }
    },
  });

  console.error(`render: ✓ ${resolve(outPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
