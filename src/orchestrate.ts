/**
 * Top-level orchestrator — chains the four stages. Each stage still runs as its
 * OWN process (and can be run standalone); this just wires them end to end so you
 * can point it at any session and get an MP4.
 *
 *   tsx src/orchestrate.ts <session.jsonl> [--local] [--host kolu-ci-1] [--skip-direct]
 *
 *   --local        render on this machine (needs Chromium; see flake) instead of remote
 *   --host <h>      remote render host (default kolu-ci-1)
 *   --skip-direct   reuse the existing artifacts/storyboard.json (don't call claude)
 */
import { execFileSync } from "node:child_process";

function run(cmd: string, args: string[]) {
  console.error(`\n\x1b[36m$ ${cmd} ${args.join(" ")}\x1b[0m`);
  execFileSync(cmd, args, { stdio: "inherit" });
}

const argv = process.argv.slice(2);
const jsonl = argv.find((a) => !a.startsWith("--"));
const local = argv.includes("--local");
const skipDirect = argv.includes("--skip-direct");
const host = argv.includes("--host") ? argv[argv.indexOf("--host") + 1] : "kolu-ci-1";

if (!jsonl) {
  console.error("usage: tsx src/orchestrate.ts <session.jsonl> [--local] [--host <h>] [--skip-direct]");
  process.exit(1);
}

run("npx", ["tsx", "src/extract.ts", jsonl, "artifacts/session.json"]);
if (!skipDirect) run("npx", ["tsx", "src/direct.ts", "artifacts/session.json", "artifacts/storyboard.json"]);
run("npx", ["tsx", "src/narrate.ts", "artifacts/storyboard.json"]);
if (local) run("npx", ["tsx", "src/render.ts", "artifacts/storyboard.json", "artifacts/session.json", "out.mp4"]);
else run("bash", ["scripts/remote-render.sh", host, "out.mp4"]);

console.error("\norchestrate: done → out.mp4");
try {
  run(process.platform === "darwin" ? "open" : "xdg-open", ["out.mp4"]);
} catch {
  /* headless box — just leave the file */
}
