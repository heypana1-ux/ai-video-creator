"use client";

import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Scene } from "@/lib/domain/schemas";
import { cn } from "@/lib/util/cn";
import { formatDuration } from "@/lib/util/format";

interface Props {
  scenes: Scene[];
  selectedId: string | null;
  warningSceneIds: Set<string>;
  onSelect: (sceneId: string) => void;
  onMove: (sceneId: string, direction: -1 | 1) => void;
  onDuplicate: (sceneId: string) => void;
  onDelete: (sceneId: string) => void;
  onAdd: () => void;
}

export function SceneList({
  scenes,
  selectedId,
  warningSceneIds,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onAdd,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-chalk-faint">
          Szenen ({scenes.length})
        </h2>
        <Button variant="ghost" size="icon" aria-label="Szene hinzufügen" onClick={onAdd}>
          <Plus className="size-4" />
        </Button>
      </div>

      <ul className="scrollbar-slim flex-1 space-y-1.5 overflow-y-auto px-2 pb-3">
        {scenes.map((scene, index) => (
          <li key={scene.id}>
            <div
              className={cn(
                "group rounded-xl border p-2.5 transition-colors",
                selectedId === scene.id
                  ? "border-violet-brand bg-violet-brand/10"
                  : "border-ink-700 bg-ink-850 hover:border-ink-500",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(scene.id)}
                className="flex w-full items-start gap-2.5 text-left"
              >
                <span
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
                  style={{
                    background:
                      scene.source.gradient.length > 0
                        ? `linear-gradient(140deg, ${scene.source.gradient.join(", ")})`
                        : "#1f1f33",
                  }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {scene.title || `Szene ${index + 1}`}
                    </span>
                    {warningSceneIds.has(scene.id) ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-amber-brand"
                        aria-label="Hinweis vorhanden"
                      />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-chalk-faint">
                    {formatDuration(scene.durationMs)} · {scene.text.content || "kein Text"}
                  </span>
                </span>
              </button>

              <div className="mt-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Nach oben"
                  disabled={index === 0}
                  onClick={() => onMove(scene.id, -1)}
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Nach unten"
                  disabled={index === scenes.length - 1}
                  onClick={() => onMove(scene.id, 1)}
                >
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Szene duplizieren"
                  onClick={() => onDuplicate(scene.id)}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-danger"
                  aria-label="Szene löschen"
                  disabled={scenes.length <= 1}
                  onClick={() => onDelete(scene.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
