"use client";

import * as React from "react";
import { Player, type PlayerRef } from "@remotion/player";

import { AdReelVideo } from "@/remotion/AdReelVideo";
import type { VideoSpec } from "@/lib/video/spec";

interface Props {
  spec: VideoSpec;
  playerRef?: React.Ref<PlayerRef>;
  className?: string;
}

/**
 * The 9:16 preview. It renders the very same composition the exporter uses, so
 * the preview is the export - only the resolution differs.
 */
export function VideoPreview({ spec, playerRef, className }: Props) {
  return (
    <div className={className}>
      <Player
        ref={playerRef}
        component={AdReelVideo}
        inputProps={{ spec }}
        durationInFrames={spec.durationInFrames}
        compositionWidth={spec.width}
        compositionHeight={spec.height}
        fps={spec.fps}
        // Park the playhead just past the entrance animations, so a paused
        // preview shows the actual frame instead of an empty one.
        initialFrame={Math.min(12, Math.max(0, spec.durationInFrames - 1))}
        controls
        clickToPlay
        doubleClickToFullscreen
        acknowledgeRemotionLicense
        style={{ width: "100%", height: "100%", borderRadius: 16, overflow: "hidden" }}
        errorFallback={({ error }) => (
          <div className="grid h-full place-items-center bg-ink-900 p-6 text-center text-sm text-danger">
            Vorschau konnte nicht geladen werden: {error.message}
          </div>
        )}
      />
    </div>
  );
}
