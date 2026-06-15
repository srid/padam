import React, { createContext, useContext } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedTheme } from "./model";
import { DEFAULT_THEME } from "./theme";

export const ThemeContext = createContext<ResolvedTheme>(DEFAULT_THEME);
export const useTheme = () => useContext(ThemeContext);

/** Fade in at the head, out at the tail (unless transition === "none"). */
export function useFade(durationInFrames: number, transition: "none" | "fade" = "fade", fade = 12): number {
  const frame = useCurrentFrame();
  if (transition === "none") return 1;
  const fin = interpolate(frame, [0, fade], [0, 1], { extrapolateRight: "clamp" });
  const fout = interpolate(frame, [durationInFrames - fade, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(fin, fout);
}

/** Eased 0→1 starting at `delay` frames. */
export function useEnter(delay = 0): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });
}

export const Background: React.FC = () => {
  const t = useTheme();
  return <AbsoluteFill style={{ background: `radial-gradient(130% 130% at 50% 0%, ${t.panel} 0%, ${t.bg} 70%)` }} />;
};

export const Center: React.FC<{ children: React.ReactNode; gap?: number; pad?: number }> = ({ children, gap = 24, pad = 90 }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap, padding: pad, textAlign: "center" }}>
    {children}
  </AbsoluteFill>
);

/** A rounded IDE/terminal window with a traffic-light title bar. */
export const Window: React.FC<{ title?: string; children?: React.ReactNode; pad?: number }> = ({ title, children, pad = 36 }) => {
  const t = useTheme();
  const e = useEnter(2);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 64 }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: t.panel,
          border: `1px solid ${t.border}`,
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transform: `scale(${interpolate(e, [0, 1], [0.975, 1])})`,
          opacity: interpolate(e, [0, 1], [0.4, 1]),
        }}
      >
        <div style={{ height: 58, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", background: t.panelHi, borderBottom: `1px solid ${t.border}` }}>
          {[t.red, t.yellow, t.green].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, opacity: 0.9 }} />
          ))}
          {title ? (
            <div style={{ marginLeft: 14, color: t.fgFaint, fontFamily: t.mono, fontSize: 24, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          ) : null}
        </div>
        <div style={{ flex: 1, position: "relative", padding: pad, minHeight: 0 }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};

export const CaptionBar: React.FC<{ text?: string }> = ({ text }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  if (!text) return null;
  const op = interpolate(frame, [4, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [4, 18], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center", padding: "0 70px", opacity: op, transform: `translateY(${y}px)` }}>
      <div style={{ maxWidth: "85%", textAlign: "center", color: t.fg, fontFamily: t.sans, fontSize: 34, lineHeight: 1.3, fontWeight: 600, textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}>{text}</div>
    </div>
  );
};

export const Chip: React.FC<{ label: string; color?: string; delay?: number }> = ({ label, color, delay = 0 }) => {
  const t = useTheme();
  const c = color ?? t.accent;
  const e = useEnter(delay);
  return (
    <div style={{ opacity: e, transform: `translateY(${interpolate(e, [0, 1], [12, 0])}px)`, padding: "12px 22px", borderRadius: 999, border: `1px solid ${c}`, background: "rgba(255,255,255,0.03)", color: c, fontFamily: t.mono, fontSize: 26, whiteSpace: "nowrap" }}>
      {label}
    </div>
  );
};

/** A blinking CSS caret (no glyph → never tofus). */
export const Cursor: React.FC = () => {
  const t = useTheme();
  const frame = useCurrentFrame();
  return <span style={{ display: "inline-block", width: "0.5em", height: "1.05em", verticalAlign: "-0.18em", marginLeft: 3, background: t.accent, opacity: Math.floor(frame / 15) % 2 ? 0.25 : 1 }} />;
};

/** Reveal the first N chars of `text` over time. */
export function typed(text: string, frame: number, start: number, cps: number, fps: number): string {
  return text.slice(0, Math.max(0, Math.floor(((frame - start) / fps) * cps)));
}
