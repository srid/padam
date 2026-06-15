import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Video } from "./Video";
import { PLACEHOLDER_MODEL, type RenderModel } from "./model";

/** Duration + canvas derive from the storyboard's scene list — nothing hardcoded. */
const calc: CalculateMetadataFunction<RenderModel> = ({ props }) => ({
  durationInFrames: Math.max(1, props.scenes.reduce((s, sc) => s + Math.max(1, sc.durationInFrames), 0)),
  fps: props.fps || 30,
  width: props.width || 1920,
  height: props.height || 1080,
});

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Video"
    component={Video}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={PLACEHOLDER_MODEL}
    calculateMetadata={calc}
  />
);
