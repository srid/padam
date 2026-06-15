// Collect rendered videos from ../videos into the site:
//   - copy each out.mp4 → public/videos/<name>.mp4 (served + embedded)
//   - emit src/data/videos.json (metadata from storyboard.json)
//   - copy the logo for the header
// A video only appears if it has BOTH storyboard.json and a rendered out.mp4.
import { readdirSync, readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(here, "..");
const repoRoot = join(siteRoot, "..");
const videosDir = join(repoRoot, "videos");

const pubVideos = join(siteRoot, "public", "videos");
const dataDir = join(siteRoot, "src", "data");
mkdirSync(pubVideos, { recursive: true });
mkdirSync(dataDir, { recursive: true });
mkdirSync(join(siteRoot, "public"), { recursive: true });

// logo for the header + the Open Graph / Twitter-card banner
const logo = join(repoRoot, "assets", "padam-logo.png");
if (existsSync(logo)) copyFileSync(logo, join(siteRoot, "public", "padam-logo.png"));
const og = join(repoRoot, "assets", "og.png");
if (existsSync(og)) copyFileSync(og, join(siteRoot, "public", "og.png"));

const out = [];
for (const name of existsSync(videosDir) ? readdirSync(videosDir) : []) {
  const sb = join(videosDir, name, "storyboard.json");
  const mp4 = join(videosDir, name, "out.mp4");
  if (!existsSync(sb) || !existsSync(mp4)) continue;
  const board = JSON.parse(readFileSync(sb, "utf8"));
  copyFileSync(mp4, join(pubVideos, `${name}.mp4`));
  const scenes = Array.isArray(board.scenes) ? board.scenes : [];
  out.push({
    name,
    title: board.title ?? name,
    width: board.width ?? 1920,
    height: board.height ?? 1080,
    fps: board.fps ?? 30,
    durationFrames: scenes.reduce((a, s) => a + (s.durationInFrames || 0), 0),
    sizeBytes: statSync(mp4).size,
    scenes: scenes.map((s) => ({ kind: s.kind, caption: s.caption ?? s.heading ?? "" })),
  });
}
out.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(dataDir, "videos.json"), JSON.stringify(out, null, 2));
console.log(`collect: ${out.length} video(s): ${out.map((v) => v.name).join(", ") || "(none)"}`);
