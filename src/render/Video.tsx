import React from "react";
import { AbsoluteFill, Series, staticFile } from "remotion";
import { RenderModel } from "./model";
import { SceneView } from "./scenes";
import { theme } from "./theme";

/**
 * Embed fonts via @font-face so text never depends on the headless Chromium's
 * (often empty) system font set. The files are copied into public/fonts at render
 * time; if absent, the src 404s harmlessly and the CSS font stack falls back.
 */
const FontStyles: React.FC = () => (
  <style
    // eslint-disable-next-line react/no-danger
    dangerouslySetInnerHTML={{
      __html: `
        @font-face { font-family:'PadamSans'; src:url('${staticFile("fonts/sans.ttf")}') format('truetype'); font-weight:100 900; font-display:block; }
        @font-face { font-family:'PadamMono'; src:url('${staticFile("fonts/mono.ttf")}') format('truetype'); font-weight:100 900; font-display:block; }
      `,
    }}
  />
);

export const Video: React.FC<RenderModel> = (props) => {
  return (
    <AbsoluteFill style={{ background: theme.bg0 }}>
      <FontStyles />
      <Series>
        {props.scenes.map((sc) => (
          <Series.Sequence key={sc.id} durationInFrames={Math.max(1, sc.durationInFrames)}>
            <SceneView scene={sc} model={props} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
