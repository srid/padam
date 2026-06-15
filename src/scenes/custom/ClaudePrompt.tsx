/**
 * ClaudePrompt — a reusable custom scene: a Claude Code prompt being typed.
 *
 * This is the worked example of padam's reuse mechanism: drop a component in
 * src/scenes/custom/, register it (./index.ts), and reference it from ANY video's
 * storyboard with:
 *
 *   { "kind": "custom", "component": "ClaudePrompt", "durationInFrames": 160,
 *     "props": { "cwd": "~/code/site",
 *                "prompt": "make a 30s launch clip, dark, square",
 *                "response": "● writing videos/launch/storyboard.json …" } }
 *
 * It reuses padam's own primitives (Window, Cursor, typed, useTheme) — so branded
 * pieces stay consistent with the built-in scenes.
 */
import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionBar, Cursor, Window, typed, useTheme } from "../../components";
import type { PreparedScene } from "../../model";

export const ClaudePrompt: React.FC<{ scene: PreparedScene }> = ({ scene }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.props ?? {};
  const cwd = String(p.cwd ?? "~/project");
  const prompt = String(p.prompt ?? "");
  const response = p.response != null ? String(p.response) : "";

  const shownPrompt = typed(prompt, frame, 12, 24, fps);
  const promptDone = shownPrompt.length >= prompt.length;
  const respStart = 12 + Math.ceil((prompt.length / 24) * fps) + 10;
  const shownResp = response ? typed(response, frame, respStart, 42, fps) : "";

  return (
    <Window title={`claude — ${cwd}`}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", gap: 26 }}>
        {/* brand header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: 0.9 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: t.accent, transform: "rotate(45deg)" }} />
          <span style={{ color: t.fgDim, fontFamily: t.mono, fontSize: 26 }}>Claude Code</span>
        </div>

        {/* the prompt box */}
        <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.accent}`, borderRadius: 14, padding: "30px 34px", display: "flex", gap: 16 }}>
          <span style={{ color: t.accent, fontFamily: t.mono, fontSize: 40, lineHeight: 1.25 }}>&gt;</span>
          <span style={{ color: t.fg, fontFamily: t.sans, fontSize: 40, lineHeight: 1.25, fontWeight: 500 }}>
            {shownPrompt}
            {!promptDone ? <Cursor /> : null}
          </span>
        </div>

        {/* agent response */}
        {promptDone && response ? (
          <div style={{ color: t.green, fontFamily: t.mono, fontSize: 30, paddingLeft: 6, opacity: interpolate(frame, [respStart, respStart + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            {shownResp}
          </div>
        ) : null}

        {/* footer hint */}
        <div style={{ color: t.fgFaint, fontFamily: t.mono, fontSize: 22, marginTop: 8 }}>? for shortcuts · ⏎ to send</div>
      </div>
      <CaptionBar text={promptDone ? scene.caption : undefined} />
    </Window>
  );
};
