import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { Video } from "./Video";
import { PLACEHOLDER_MODEL, RenderModel } from "./model";

/** Duration/size derive from the storyboard's scene list — not hardcoded. */
const calc: CalculateMetadataFunction<RenderModel> = ({ props }) => {
  const fps = props.fps || 30;
  const durationInFrames = Math.max(
    1,
    props.scenes.reduce((sum, s) => sum + Math.max(1, s.durationInFrames), 0),
  );
  return { durationInFrames, fps, width: props.width || 1080, height: props.height || 1080 };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Session"
    component={Video}
    durationInFrames={300}
    fps={30}
    width={1080}
    height={1080}
    defaultProps={PLACEHOLDER_MODEL}
    calculateMetadata={calc}
  />
);
