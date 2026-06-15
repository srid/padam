import React from "react";
import { AbsoluteFill, Series, staticFile } from "remotion";
import { ThemeContext } from "./components";
import { SceneView } from "./scenes";
import type { RenderModel } from "./model";

/**
 * Fonts via @font-face so headless Chromium text never tofus. `render` copies
 * DejaVu into the video folder's `fonts/` (the publicDir); if absent the src 404s
 * and the CSS stack falls back.
 */
const FontStyles: React.FC = () => (
  <style
    dangerouslySetInnerHTML={{
      __html: `
        @font-face { font-family:'PadamSans'; src:url('${staticFile("fonts/sans.ttf")}') format('truetype'); font-weight:100 900; font-display:block; }
        @font-face { font-family:'PadamMono'; src:url('${staticFile("fonts/mono.ttf")}') format('truetype'); font-weight:100 900; font-display:block; }
      `,
    }}
  />
);

export const Video: React.FC<RenderModel> = (props) => (
  <ThemeContext.Provider value={props.theme}>
    <AbsoluteFill style={{ background: props.theme.bg }}>
      <FontStyles />
      <Series>
        {props.scenes.map((sc) => (
          <Series.Sequence key={sc.id} durationInFrames={Math.max(1, sc.durationInFrames)}>
            <SceneView scene={sc} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  </ThemeContext.Provider>
);
