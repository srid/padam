import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

/** Fade in at the head, fade out at the tail of a scene of the given length. */
export function useFade(durationInFrames: number, fade = 12): number {
  const frame = useCurrentFrame();
  const fin = interpolate(frame, [0, fade], [0, 1], { extrapolateRight: "clamp" });
  const fout = interpolate(frame, [durationInFrames - fade, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(fin, fout);
}

/** A spring that eases 0→1 starting at `delay` frames. */
export function useEnter(delay = 0): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });
}

export const Background: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(120% 120% at 50% 0%, ${theme.bg1} 0%, ${theme.bg0} 70%)`,
    }}
  />
);

/** A rounded terminal/IDE window with a traffic-light title bar. */
export const TerminalWindow: React.FC<{
  title?: string;
  accent?: string;
  children?: React.ReactNode;
  pad?: number;
}> = ({ title, accent = theme.fgFaint, children, pad = 36 }) => {
  const enter = useEnter(2);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 56 }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transform: `scale(${interpolate(enter, [0, 1], [0.97, 1])})`,
          opacity: interpolate(enter, [0, 1], [0.4, 1]),
        }}
      >
        <div
          style={{
            height: 58,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 22px",
            background: theme.panelHi,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          {[theme.red, theme.yellow, theme.green].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, opacity: 0.9 }} />
          ))}
          {title ? (
            <div
              style={{
                marginLeft: 14,
                color: accent,
                fontFamily: theme.mono,
                fontSize: 24,
                letterSpacing: 0.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, position: "relative", padding: pad, minHeight: 0 }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Lower-third caption band. */
export const CaptionBar: React.FC<{ text?: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  if (!text) return null;
  const op = interpolate(frame, [4, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [4, 18], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 40,
        display: "flex",
        justifyContent: "center",
        padding: "0 70px",
        opacity: op,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 880,
          textAlign: "center",
          color: theme.fg,
          fontFamily: theme.sans,
          fontSize: 34,
          lineHeight: 1.3,
          fontWeight: 600,
          textShadow: "0 2px 18px rgba(0,0,0,0.8)",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** A small pill/chip used for stats. */
export const Chip: React.FC<{ label: string; color?: string; delay?: number }> = ({
  label,
  color = theme.accent,
  delay = 0,
}) => {
  const e = useEnter(delay);
  return (
    <div
      style={{
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [12, 0])}px)`,
        padding: "12px 22px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: "rgba(255,255,255,0.03)",
        color,
        fontFamily: theme.mono,
        fontSize: 26,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};
