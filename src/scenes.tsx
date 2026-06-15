import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontStyleCss } from "./theme";
import { Background, CaptionBar, Center, Chip, Cursor, Window, useEnter, useFade, useTheme, typed } from "./components";
import type { DiffLineJSON, PreparedScene, TokenJSON } from "./model";
import { customScenes } from "./scenes/custom";

type P = { scene: PreparedScene };

const Eyebrow: React.FC<{ text?: string; op: number }> = ({ text, op }) => {
  const t = useTheme();
  if (!text) return null;
  return <div style={{ color: t.fgDim, fontFamily: t.mono, fontSize: 26, letterSpacing: 2, textTransform: "uppercase", opacity: op }}>{text}</div>;
};

// ── title ─────────────────────────────────────────────────────────────────
const Title: React.FC<P> = ({ scene }) => {
  const t = useTheme();
  const e = useEnter(4);
  const e2 = useEnter(16);
  return (
    <Center>
      <Eyebrow text={scene.eyebrow} op={e} />
      <div style={{ color: t.fg, fontFamily: t.sans, fontWeight: 800, fontSize: 86, lineHeight: 1.08, maxWidth: "85%", opacity: e, transform: `translateY(${interpolate(e, [0, 1], [24, 0])}px)` }}>
        {scene.heading}
      </div>
      {scene.sub ? <div style={{ color: t.accent, fontFamily: t.mono, fontSize: 34, opacity: e2 }}>{scene.sub}</div> : null}
    </Center>
  );
};

// ── bullets ───────────────────────────────────────────────────────────────
const Bullets: React.FC<P> = ({ scene }) => {
  const t = useTheme();
  const items = scene.items ?? [];
  return (
    <AbsoluteFill style={{ flexDirection: "column", justifyContent: "center", gap: 30, padding: "0 12%" }}>
      {scene.heading ? <div style={{ color: t.fg, fontFamily: t.sans, fontWeight: 800, fontSize: 64, marginBottom: 18, opacity: useEnter(2) }}>{scene.heading}</div> : null}
      {items.map((it, i) => {
        const e = useEnter(10 + i * 8);
        return (
          <div key={i} style={{ display: "flex", gap: 22, alignItems: "baseline", opacity: e, transform: `translateX(${interpolate(e, [0, 1], [-24, 0])}px)` }}>
            <span style={{ color: t.accent, fontFamily: t.mono, fontSize: 40 }}>▸</span>
            <span style={{ color: t.fg, fontFamily: t.sans, fontSize: 46, lineHeight: 1.3 }}>{it}</span>
          </div>
        );
      })}
      <CaptionBar text={scene.caption} />
    </AbsoluteFill>
  );
};

// ── code / diff shared ──────────────────────────────────────────────────────
const Tok: React.FC<{ t: TokenJSON; fg: string }> = ({ t, fg }) => <span style={{ color: t.color ?? fg, ...fontStyleCss(t.fontStyle) }}>{t.content}</span>;

const Code: React.FC<P> = ({ scene }) => {
  const t = useTheme();
  const lines = scene.codeTokens ?? [];
  const MAX = 22;
  const shown = lines.slice(0, MAX);
  return (
    <Window title={scene.file ?? (scene.lang ? `${scene.lang}` : "code")} pad={28}>
      <div style={{ height: "100%", overflow: "hidden", background: t.bg, borderRadius: 12, border: `1px solid ${t.border}`, padding: "18px 22px", fontFamily: t.mono, fontSize: 26, lineHeight: "38px" }}>
        {shown.map((line, i) => {
          const op = interpolate(useCurrentFrame(), [16 + i * 2, 16 + i * 2 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ whiteSpace: "pre", opacity: op }}>
              {line.length ? line.map((tk, j) => <Tok key={j} t={tk} fg={t.fg} />) : " "}
            </div>
          );
        })}
        {lines.length > MAX ? <div style={{ color: t.fgFaint }}>… {lines.length - MAX} more lines</div> : null}
      </div>
      <CaptionBar text={scene.caption} />
    </Window>
  );
};

const DiffRow: React.FC<{ line: DiffLineJSON; i: number }> = ({ line, i }) => {
  const t = useTheme();
  const op = interpolate(useCurrentFrame(), [18 + i * 2.2, 18 + i * 2.2 + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bg = line.status === "add" ? t.addBg : line.status === "remove" ? t.removeBg : "transparent";
  const g = line.status === "add" ? "+" : line.status === "remove" ? "-" : " ";
  const gc = line.status === "add" ? t.green : line.status === "remove" ? t.red : t.fgFaint;
  return (
    <div style={{ display: "flex", background: bg, opacity: op, whiteSpace: "pre", padding: "1px 0" }}>
      <span style={{ width: 34, flexShrink: 0, textAlign: "center", color: gc, fontWeight: 700 }}>{g}</span>
      <span style={{ flex: 1 }}>{line.tokens.length ? line.tokens.map((tk, j) => <Tok key={j} t={tk} fg={t.fg} />) : " "}</span>
    </div>
  );
};

const Diff: React.FC<P> = ({ scene }) => {
  const t = useTheme();
  const diff = scene.diff;
  const MAX = 20;
  const lines = diff ? diff.lines.slice(0, MAX) : [];
  return (
    <Window title={scene.file ? `± ${scene.file}` : "± diff"} pad={28}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
          {diff ? (
            <>
              <span style={{ color: t.green, fontFamily: t.mono, fontSize: 24 }}>+{diff.added}</span>
              <span style={{ color: t.red, fontFamily: t.mono, fontSize: 24 }}>-{diff.removed}</span>
              <span style={{ color: t.fgFaint, fontFamily: t.mono, fontSize: 22 }}>{diff.lang}</span>
            </>
          ) : null}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", background: t.bg, borderRadius: 12, border: `1px solid ${t.border}`, padding: "18px 20px", fontFamily: t.mono, fontSize: 25, lineHeight: "37px" }}>
          {lines.map((l, i) => <DiffRow key={i} line={l} i={i} />)}
          {diff && diff.lines.length > MAX ? <div style={{ color: t.fgFaint, paddingLeft: 34 }}>… {diff.lines.length - MAX} more</div> : null}
        </div>
      </div>
      <CaptionBar text={scene.caption} />
    </Window>
  );
};

// ── terminal ──────────────────────────────────────────────────────────────
const Terminal: React.FC<P> = ({ scene }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cmd = scene.command ?? "";
  const shown = typed(cmd, frame, 6, 26, fps);
  const done = shown.length >= cmd.length;
  return (
    <Window title="shell">
      <div style={{ fontFamily: t.mono, fontSize: 30, lineHeight: 1.5 }}>
        <div style={{ color: t.green }}>
          <span style={{ color: t.fgFaint }}>$ </span>
          {shown}
          {!done ? <Cursor /> : null}
        </div>
        {done && scene.output ? (
          <div style={{ color: t.fgDim, marginTop: 16, whiteSpace: "pre-wrap", opacity: interpolate(frame, [0, 20], [0, 1]) }}>{scene.output}</div>
        ) : null}
      </div>
      <CaptionBar text={done ? scene.caption : undefined} />
    </Window>
  );
};

// ── quote ─────────────────────────────────────────────────────────────────
const Quote: React.FC<P> = ({ scene }) => {
  const t = useTheme();
  const e = useEnter(4);
  return (
    <Center gap={32}>
      <div style={{ color: t.fg, fontFamily: t.sans, fontWeight: 700, fontSize: 64, lineHeight: 1.25, maxWidth: "82%", opacity: e, transform: `translateY(${interpolate(e, [0, 1], [20, 0])}px)` }}>
        “{scene.text}”
      </div>
      {scene.by ? <div style={{ color: t.accent, fontFamily: t.mono, fontSize: 32, opacity: useEnter(16) }}>— {scene.by}</div> : null}
    </Center>
  );
};

// ── image ─────────────────────────────────────────────────────────────────
const Image: React.FC<P> = ({ scene }) => {
  const e = useEnter(2);
  return (
    <Center>
      {scene.src ? (
        <Img src={staticFile(scene.src)} style={{ maxWidth: "82%", maxHeight: "72%", objectFit: "contain", borderRadius: 14, opacity: e, transform: `scale(${interpolate(e, [0, 1], [0.96, 1])})` }} />
      ) : null}
      <CaptionBar text={scene.caption} />
    </Center>
  );
};

// ── stats ─────────────────────────────────────────────────────────────────
const Stats: React.FC<P> = ({ scene }) => {
  const t = useTheme();
  return (
    <Center gap={36}>
      {scene.heading ? <div style={{ color: t.fg, fontFamily: t.sans, fontWeight: 800, fontSize: 64, opacity: useEnter(2) }}>{scene.heading}</div> : null}
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
        {(scene.chips ?? []).map((c, i) => <Chip key={i} label={c} delay={8 + i * 6} />)}
      </div>
    </Center>
  );
};

// ── outro ─────────────────────────────────────────────────────────────────
const Outro: React.FC<P> = ({ scene }) => {
  const t = useTheme();
  const e = useEnter(4);
  return (
    <Center gap={28}>
      <div style={{ fontSize: 96, lineHeight: 1, color: t.green, fontWeight: 800, opacity: e, transform: `scale(${interpolate(e, [0, 1], [0.6, 1])})` }}>✓</div>
      {scene.heading ? <div style={{ color: t.fg, fontFamily: t.sans, fontWeight: 800, fontSize: 60, maxWidth: "82%" }}>{scene.heading}</div> : null}
      {scene.sub ? <div style={{ color: t.accent, fontFamily: t.mono, fontSize: 30, opacity: useEnter(12) }}>{scene.sub}</div> : null}
      <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {(scene.chips ?? []).map((c, i) => <Chip key={i} label={c} delay={18 + i * 6} />)}
      </div>
    </Center>
  );
};

// ── router ──────────────────────────────────────────────────────────────────
const BUILTIN: Record<string, React.FC<P>> = { title: Title, bullets: Bullets, code: Code, diff: Diff, terminal: Terminal, quote: Quote, image: Image, stats: Stats, outro: Outro };

export const SceneView: React.FC<P> = ({ scene }) => {
  const fade = useFade(scene.durationInFrames, scene.transition ?? "fade");
  const Comp = scene.kind === "custom" ? customScenes[scene.component ?? ""] : BUILTIN[scene.kind];
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background />
      {Comp ? <Comp scene={scene} /> : <Center><span style={{ color: "#f85149", fontFamily: "monospace", fontSize: 40 }}>unknown scene: {scene.kind} {scene.component ?? ""}</span></Center>}
    </AbsoluteFill>
  );
};
