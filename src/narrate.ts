/**
 * Stage 4 — narrate: storyboard.json → audio/*.mp3  (STUB for the first slice)
 *
 *   tsx src/narrate.ts [storyboard.json] [audioDir]
 *
 * Per the plan, TTS is deferred: this stage is intentionally stubbed. It reads the
 * storyboard, writes a narration *manifest* (artifacts/audio/narration.json) that
 * maps each scene → its spoken line and the .mp3 path the render will later mux,
 * and reports what a real TTS pass would synthesize. No network, no audio yet.
 *
 * To make it real later: for each scene with `narration`, synthesize an mp3 at the
 * manifest's `audio` path (any TTS), then have stage 3 mount a <Html5Audio> per
 * scene (Remotion supports `audioCodec: "aac"` for the muxed MP4).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StoryboardSchema } from "./types";

function main() {
  const [, , sbPath = "artifacts/storyboard.json", audioDir = "artifacts/audio"] = process.argv;
  const sb = StoryboardSchema.parse(JSON.parse(readFileSync(sbPath, "utf8")));
  mkdirSync(audioDir, { recursive: true });

  const lines = sb.scenes
    .filter((s) => s.narration)
    .map((s) => ({ sceneId: s.id, kind: s.kind, narration: s.narration!, audio: join(audioDir, `${s.id}.mp3`) }));

  const manifest = { title: sb.title, fps: sb.fps, generatedTts: false, lines };
  writeFileSync(join(audioDir, "narration.json"), JSON.stringify(manifest, null, 2));

  console.error(`narrate (stub): ${lines.length} narration lines → ${join(audioDir, "narration.json")}`);
  for (const l of lines) console.error(`  ${l.sceneId} [${l.kind}] “${l.narration}”`);
  console.error("narrate: TTS is not wired in this slice — manifest is ready for a future synth pass.");
}

main();
