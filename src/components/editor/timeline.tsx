"use client";

import type { Scene } from "@/lib/domain/schemas";
import { cn } from "@/lib/util/cn";

interface Props {
  scenes: Scene[];
  selectedId: string | null;
  currentMs: number;
  onSelect: (sceneId: string) => void;
  onSeek: (ms: number) => void;
}

/** Simple proportional timeline: scene blocks plus a playhead. */
export function Timeline({ scenes, selectedId, currentMs, onSelect, onSeek }: Props) {
  const totalMs = scenes.reduce((sum, scene) => sum + scene.durationMs, 0) || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-chalk-faint">
        <span>Timeline</span>
        <span className="font-mono">
          {(currentMs / 1000).toFixed(1)} / {(totalMs / 1000).toFixed(1)} s
        </span>
      </div>

      <div
        className="relative h-14 w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-850"
        role="group"
        aria-label="Timeline"
      >
        <div className="flex h-full">
          {scenes.map((scene, index) => {
            const width = (scene.durationMs / totalMs) * 100;
            return (
              <button
                key={scene.id}
                type="button"
                style={{
                  width: `${width}%`,
                  background:
                    scene.source.gradient.length > 0
                      ? `linear-gradient(140deg, ${scene.source.gradient.join(", ")})`
                      : "#2b2b45",
                }}
                onClick={() => {
                  onSelect(scene.id);
                  const start = scenes
                    .slice(0, index)
                    .reduce((sum, item) => sum + item.durationMs, 0);
                  onSeek(start);
                }}
                className={cn(
                  "relative h-full border-r border-ink-950/60 px-2 text-left text-[11px] font-medium text-white/90 transition-opacity last:border-r-0",
                  selectedId === scene.id ? "opacity-100" : "opacity-55 hover:opacity-80",
                )}
              >
                <span className="absolute inset-0 bg-black/35" />
                <span className="relative line-clamp-2">{scene.title || `Szene ${index + 1}`}</span>
              </button>
            );
          })}
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-electric shadow-[0_0_12px_rgba(56,189,248,0.9)]"
          style={{ left: `${Math.min(100, (currentMs / totalMs) * 100)}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
