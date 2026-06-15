import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, fontStyleCss } from "./theme";
import { Background, CaptionBar, Chip, TerminalWindow, useEnter, useFade } from "./components";
import { DiffLineJSON, PreparedScene, RenderModel, TokenJSON } from "./model";

/** Reveal the first N characters of `text` over time (typewriter). */
function typed(text: string, frame: number, start: number, cps: number, fps: number): string {
  const n = Math.floor(((frame - start) / fps) * cps);
  return text.slice(0, Math.max(0, n));
}

// CSS-drawn caret (no glyph → no missing-font tofu risk).
const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.5em",
        height: "1.05em",
        verticalAlign: "-0.18em",
        marginLeft: 3,
        background: theme.accent,
        opacity: Math.floor(frame / 15) % 2 ? 0.25 : 1,
      }}
    />
  );
};

// ── intro ────────────────────────────────────────────────────────────────────
const Intro: React.FC<{ scene: PreparedScene; model: RenderModel }> = ({ scene, model }) => {
  const e = useEnter(4);
  const e2 = useEnter(16);
  return (
    <TerminalWindow title={`${model.project}${model.branch ? `  ·  ${model.branch}` : ""}`}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
        <div
          style={{
            color: theme.fgDim,
            fontFamily: theme.mono,
            fontSize: 26,
            opacity: e,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          A Claude Code session
        </div>
        <div
          style={{
            color: theme.fg,
            fontFamily: theme.sans,
            fontWeight: 800,
            fontSize: 70,
            lineHeight: 1.1,
            textAlign: "center",
            maxWidth: 820,
            opacity: e,
            transform: `translateY(${interpolate(e, [0, 1], [24, 0])}px)`,
          }}
        >
          {model.title}
        </div>
        <div
          style={{
            color: theme.accent,
            fontFamily: theme.mono,
            fontSize: 28,
            opacity: e2,
            transform: `translateY(${interpolate(e2, [0, 1], [16, 0])}px)`,
          }}
        >
          {scene.caption ?? ""}
        </div>
      </AbsoluteFill>
    </TerminalWindow>
  );
};

// ── prompt ─────────────────────────────────────────────────────────────────
const PromptScene: React.FC<{ scene: PreparedScene; model: RenderModel }> = ({ scene, model }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = scene.promptText ?? scene.caption ?? "";
  const shown = typed(text, frame, 8, 28, fps);
  const done = shown.length >= text.length;
  return (
    <TerminalWindow title={`${model.project} — you`}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", gap: 22 }}>
        <div style={{ color: theme.green, fontFamily: theme.mono, fontSize: 24, opacity: useEnter(2) }}>
          {scene.command ? `> ${scene.command}` : "> human prompt"}
        </div>
        <div
          style={{
            background: theme.bg1,
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            padding: "32px 36px",
            color: theme.fg,
            fontFamily: theme.sans,
            fontSize: 40,
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {shown}
          {!done ? <Cursor /> : null}
        </div>
      </div>
      <CaptionBar text={done ? scene.caption : undefined} />
    </TerminalWindow>
  );
};

// ── diff ─────────────────────────────────────────────────────────────────────
const Token: React.FC<{ t: TokenJSON }> = ({ t }) => (
  <span style={{ color: t.color ?? theme.fg, ...fontStyleCss(t.fontStyle) }}>{t.content}</span>
);

const DiffRow: React.FC<{ line: DiffLineJSON; index: number; revealFrom: number }> = ({ line, index, revealFrom }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [revealFrom + index * 2.2, revealFrom + index * 2.2 + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bg = line.status === "add" ? theme.addBg : line.status === "remove" ? theme.removeBg : "transparent";
  const gutter = line.status === "add" ? "+" : line.status === "remove" ? "-" : " ";
  const gutterColor = line.status === "add" ? theme.addGutter : line.status === "remove" ? theme.removeGutter : theme.fgFaint;
  return (
    <div
      style={{
        display: "flex",
        background: bg,
        opacity: op,
        transform: `translateX(${interpolate(op, [0, 1], [10, 0])}px)`,
        whiteSpace: "pre",
        padding: "1px 0",
      }}
    >
      <span style={{ width: 34, flexShrink: 0, textAlign: "center", color: gutterColor, fontWeight: 700 }}>{gutter}</span>
      <span style={{ flex: 1 }}>
        {line.tokens.length ? line.tokens.map((t, i) => <Token key={i} t={t} />) : " "}
      </span>
    </div>
  );
};

const DiffScene: React.FC<{ scene: PreparedScene; model: RenderModel }> = ({ scene }) => {
  const diff = scene.diff;
  const MAX = 20;
  const lines = diff ? diff.lines.slice(0, MAX) : [];
  const truncated = diff ? diff.lines.length - lines.length : 0;
  return (
    <TerminalWindow title={diff?.path ? `± ${diff.path}` : "± diff"} pad={28}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "center" }}>
          {diff ? (
            <>
              <span style={{ color: theme.addGutter, fontFamily: theme.mono, fontSize: 24 }}>+{diff.added}</span>
              <span style={{ color: theme.removeGutter, fontFamily: theme.mono, fontSize: 24 }}>-{diff.removed}</span>
              <span style={{ color: theme.fgFaint, fontFamily: theme.mono, fontSize: 22 }}>{diff.lang}</span>
            </>
          ) : (
            <span style={{ color: theme.fgFaint, fontFamily: theme.mono, fontSize: 22 }}>(no diff)</span>
          )}
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            background: theme.bg1,
            borderRadius: 12,
            border: `1px solid ${theme.border}`,
            padding: "18px 20px",
            fontFamily: theme.mono,
            fontSize: 25,
            lineHeight: "37px",
          }}
        >
          {lines.map((l, i) => (
            <DiffRow key={i} line={l} index={i} revealFrom={18} />
          ))}
          {truncated > 0 ? (
            <div style={{ color: theme.fgFaint, paddingLeft: 34 }}>… {truncated} more lines</div>
          ) : null}
        </div>
      </div>
      <CaptionBar text={scene.caption} />
    </TerminalWindow>
  );
};

// ── agent_work ────────────────────────────────────────────────────────────────
const AgentWork: React.FC<{ scene: PreparedScene; model: RenderModel }> = ({ scene, model }) => {
  const frame = useCurrentFrame();
  const dots = ".".repeat((Math.floor(frame / 12) % 3) + 1);
  return (
    <TerminalWindow title={`${model.project} — agent`}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
        <div style={{ color: theme.purple, fontFamily: theme.mono, fontSize: 30, opacity: useEnter(2) }}>
          ● working{dots}
        </div>
        <div
          style={{
            color: theme.fg,
            fontFamily: theme.sans,
            fontSize: 46,
            fontWeight: 700,
            textAlign: "center",
            maxWidth: 800,
            opacity: useEnter(8),
          }}
        >
          {scene.caption ?? model.summary}
        </div>
        {model.stats ? (
          <div style={{ display: "flex", gap: 16 }}>
            <Chip label={`${model.stats.toolCalls} tool calls`} color={theme.purple} delay={16} />
            <Chip label={`${model.stats.edits} edits`} color={theme.green} delay={22} />
          </div>
        ) : null}
      </AbsoluteFill>
    </TerminalWindow>
  );
};

// ── tool_run ──────────────────────────────────────────────────────────────────
const ToolRun: React.FC<{ scene: PreparedScene; model: RenderModel }> = ({ scene, model }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cmd = scene.bash ?? scene.caption ?? "";
  const shown = typed(cmd, frame, 6, 24, fps);
  const done = shown.length >= cmd.length;
  return (
    <TerminalWindow title={`${model.project} — shell`}>
      <div style={{ fontFamily: theme.mono, fontSize: 28, lineHeight: 1.5 }}>
        <div style={{ color: theme.green }}>
          <span style={{ color: theme.fgFaint }}>$ </span>
          {shown}
          {!done ? <Cursor /> : null}
        </div>
        {done ? (
          <div style={{ color: theme.fgDim, marginTop: 16, opacity: interpolate(frame, [0, 20], [0, 1]) }}>
            ↳ running…
          </div>
        ) : null}
      </div>
      <CaptionBar text={done ? scene.caption : undefined} />
    </TerminalWindow>
  );
};

// ── outro ──────────────────────────────────────────────────────────────────────
const Outro: React.FC<{ scene: PreparedScene; model: RenderModel }> = ({ scene, model }) => {
  const e = useEnter(4);
  const min = model.stats ? (model.stats.durationMs / 60000).toFixed(0) : undefined;
  return (
    <TerminalWindow title={`${model.project}${model.branch ? `  ·  ${model.branch}` : ""}`}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            fontSize: 96,
            lineHeight: 1,
            color: theme.green,
            fontWeight: 800,
            opacity: e,
            transform: `scale(${interpolate(e, [0, 1], [0.6, 1])})`,
          }}
        >
          ✓
        </div>
        <div style={{ color: theme.fg, fontFamily: theme.sans, fontWeight: 800, fontSize: 56, textAlign: "center", maxWidth: 820 }}>
          {scene.caption ?? "Shipped"}
        </div>
        {model.prUrl ? (
          <div style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 28, opacity: useEnter(14) }}>
            {model.prUrl.replace(/^https?:\/\//, "")}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {model.stats ? <Chip label={`${model.stats.edits} edits`} color={theme.green} delay={20} /> : null}
          {model.stats ? <Chip label={`${model.stats.prompts} prompts`} color={theme.accent} delay={26} /> : null}
          {min ? <Chip label={`~${min} min`} color={theme.yellow} delay={32} /> : null}
        </div>
      </AbsoluteFill>
    </TerminalWindow>
  );
};

// ── router ─────────────────────────────────────────────────────────────────────
export const SceneView: React.FC<{ scene: PreparedScene; model: RenderModel }> = ({ scene, model }) => {
  const fade = useFade(scene.durationInFrames);
  const Comp =
    scene.kind === "intro"
      ? Intro
      : scene.kind === "prompt"
        ? PromptScene
        : scene.kind === "diff"
          ? DiffScene
          : scene.kind === "tool_run"
            ? ToolRun
            : scene.kind === "outro"
              ? Outro
              : AgentWork;
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background />
      <Comp scene={scene} model={model} />
    </AbsoluteFill>
  );
};
