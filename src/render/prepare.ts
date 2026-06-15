/**
 * Stage 3 data prep (Node): Storyboard + SessionModel → RenderModel (inputProps).
 *
 * Resolves each scene against the real session — diff scenes hydrate authentic
 * before/after code from the tool_call they reference (so the LLM never invents
 * code), prompt scenes pull the real human text — then runs Shiki to produce
 * serialized token lines. The output is plain JSON ready for Remotion inputProps.
 */
import { SessionModel, Storyboard } from "../types";
import { buildDiff } from "./highlight";
import { PreparedScene, RenderModel } from "./model";

function baseName(p: string): string {
  return p.split("/").filter(Boolean).slice(-1)[0] ?? p;
}

export async function prepare(sb: Storyboard, session: SessionModel): Promise<RenderModel> {
  const byId = new Map(session.events.map((e) => [e.id, e] as const));

  const scenes: PreparedScene[] = [];
  for (const sc of sb.scenes) {
    const out: PreparedScene = {
      id: sc.id,
      kind: sc.kind,
      durationInFrames: sc.durationInFrames,
      caption: sc.caption,
      narration: sc.narration,
    };
    const refEvents = (sc.eventRefs ?? []).map((id) => byId.get(id)).filter(Boolean);

    if (sc.kind === "prompt") {
      const p = refEvents.find((e) => e!.kind === "user_prompt") as any;
      out.promptText = p?.text ?? sc.caption ?? sb.title;
      out.command = p?.command;
    }

    if (sc.kind === "diff") {
      // Prefer explicit, hand-editable code on the scene; else hydrate from the session.
      let before = sc.code?.before;
      let after = sc.code?.after;
      let lang = sc.code?.lang;
      let path = sc.code?.path;
      if (before == null || after == null) {
        const ed = (refEvents.find((e) => e!.kind === "tool_call" && (e as any).edit) as any)?.edit;
        if (ed) {
          before = ed.before;
          after = ed.after;
          lang = ed.lang;
          path = ed.path;
        }
      }
      if (before != null && after != null) {
        const diff = await buildDiff(before, after, lang ?? "text");
        diff.path = path ? baseName(path) : "";
        out.diff = diff;
      }
    }

    if (sc.kind === "tool_run") {
      const b = refEvents.find((e) => e!.kind === "tool_call" && (e as any).tool === "Bash") as any;
      out.bash = b ? (b.input?.command ?? "") : undefined;
    }

    scenes.push(out);
  }

  return {
    title: sb.title,
    summary: sb.summary,
    fps: sb.fps,
    width: sb.width ?? 1080,
    height: sb.height ?? 1080,
    project: session.project,
    branch: session.gitBranch,
    prUrl: session.prUrl,
    stats: session.stats,
    scenes,
  };
}
