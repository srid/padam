import type React from "react";
import type { PreparedScene } from "../../model";
import { ClaudePrompt } from "./ClaudePrompt";

/**
 * Reusable custom scenes — padam's reuse mechanism.
 *
 * Register a component here and reference it from ANY video's storyboard with
 * `{ "kind": "custom", "component": "<key>", "props": { … } }`. Every video in this
 * repo can reuse it; to share across repos, ship the file with the APM skill (or
 * copy it). A custom scene is `React.FC<{ scene: PreparedScene }>` (your fields are
 * on `scene.props`). Keep it deterministic — no Date.now/Math.random.
 */
export const customScenes: Record<string, React.FC<{ scene: PreparedScene }>> = {
  ClaudePrompt,
};
