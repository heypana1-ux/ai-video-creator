"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PlayerRef } from "@remotion/player";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  Images,
  Loader2,
  Redo2,
  RefreshCw,
  Save,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { CreditEstimateBox } from "@/components/app/credit-estimate";
import { JobProgress } from "@/components/app/job-progress";
import { SceneList } from "@/components/editor/scene-list";
import { SceneProperties } from "@/components/editor/scene-properties";
import { Timeline } from "@/components/editor/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiSend, errorMessage } from "@/lib/client/api";
import { useJob } from "@/lib/client/use-job";
import type { CreditEstimate } from "@/lib/credits/pricing";
import type { Asset, Concept, Project, Scene } from "@/lib/domain/schemas";
import { randomId } from "@/lib/util/browser-id";
import { buildVideoSpec, framesToMs } from "@/lib/video/spec";
import { checkConcept } from "@/lib/video/quality";
import { getVideoStyle } from "@/lib/video/styles";

// The Remotion player pulls in browser-only APIs, so it must not be server rendered.
const VideoPreview = dynamic(
  () => import("@/components/editor/preview").then((module) => module.VideoPreview),
  {
    ssr: false,
    loading: () => (
      <div className="grid aspect-[9/16] w-full place-items-center rounded-2xl bg-ink-850 text-sm text-chalk-faint">
        Vorschau wird geladen …
      </div>
    ),
  },
);

const AUTOSAVE_DELAY_MS = 1200;
const HISTORY_LIMIT = 50;

interface Props {
  project: Project;
  concept: Concept;
  assets: Asset[];
  balance: number;
  demoMode: boolean;
  hasMedia: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface History {
  past: Concept[];
  present: Concept;
  future: Concept[];
}

export function EditorShell({
  project,
  concept: initialConcept,
  assets,
  balance,
  demoMode,
  hasMedia,
}: Props) {
  // Undo/redo lives in one state object so history stays consistent with the
  // document - React state updaters must stay pure, so no cross-setState calls.
  const [history, setHistory] = React.useState<History>({
    past: [],
    present: initialConcept,
    future: [],
  });
  const concept = history.present;
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialConcept.scenes[0]?.id ?? null,
  );
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [currentMs, setCurrentMs] = React.useState(0);
  const [mediaEstimate, setMediaEstimate] = React.useState<CreditEstimate | null>(null);
  const [confirmMedia, setConfirmMedia] = React.useState(false);
  const [showSafeZones, setShowSafeZones] = React.useState(false);
  const playerRef = React.useRef<PlayerRef>(null);
  const dirty = React.useRef(false);
  const conceptIdRef = React.useRef(initialConcept.id);

  /* ------------------------------- history ------------------------------- */

  const commit = React.useCallback((next: Concept) => {
    setHistory((current) => ({
      past: [...current.past, current.present].slice(-HISTORY_LIMIT),
      present: next,
      future: [],
    }));
    dirty.current = true;
  }, []);

  /** Replaces the document without touching the undo stack (server results). */
  const adopt = React.useCallback((next: Concept, resetHistory = false) => {
    setHistory((current) =>
      resetHistory
        ? { past: [], present: next, future: [] }
        : { ...current, present: next },
    );
  }, []);

  const undo = React.useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) return current;
      dirty.current = true;
      return {
        past: current.past.slice(0, -1),
        present: current.past[current.past.length - 1],
        future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = React.useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) return current;
      dirty.current = true;
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: current.future[0],
        future: current.future.slice(1),
      };
    });
  }, []);

  const mediaJob = useJob(async (finished) => {
    if (finished.job.status === "succeeded") {
      const result = await apiGet<{ concept: Concept }>(
        `/api/projects/${project.id}/concepts/${conceptIdRef.current}`,
      );
      adopt(result.concept, true);
      dirty.current = false;
      toast.success("Medien, Voice-over und Musik sind fertig.");
    } else if (finished.job.status === "failed") {
      toast.error(finished.job.error ?? "Die Medienerzeugung ist fehlgeschlagen.");
    }
  });

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  /* ------------------------------- autosave ------------------------------ */

  const save = React.useCallback(
    async (payload: Concept) => {
      setSaveState("saving");
      try {
        const result = await apiSend<{ concept: Concept }>(
          `/api/projects/${project.id}/concepts/${payload.id}`,
          "PATCH",
          { scenes: payload.scenes, styleId: payload.styleId },
        );
        // The server re-times the scenes; adopt that without adding history.
        adopt({ ...payload, scenes: result.concept.scenes });
        setSaveState("saved");
        dirty.current = false;
      } catch (error) {
        setSaveState("error");
        toast.error(errorMessage(error));
      }
    },
    [adopt, project.id],
  );

  React.useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => void save(concept), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [concept, save]);

  /* -------------------------------- scenes ------------------------------- */

  const scenes = React.useMemo(
    () => [...concept.scenes].sort((a, b) => a.index - b.index),
    [concept.scenes],
  );
  const selectedScene = scenes.find((scene) => scene.id === selectedId) ?? scenes[0] ?? null;

  function updateScenes(next: Scene[]) {
    commit({ ...concept, scenes: next.map((scene, index) => ({ ...scene, index })) });
  }

  function patchScene(sceneId: string, patch: Partial<Scene>) {
    updateScenes(scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene)));
  }

  function moveScene(sceneId: string, direction: -1 | 1) {
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= scenes.length) return;
    const next = [...scenes];
    [next[index], next[target]] = [next[target], next[index]];
    updateScenes(next);
  }

  function duplicateScene(sceneId: string) {
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    if (index < 0) return;
    const copy: Scene = { ...scenes[index], id: randomId(), voiceoverWords: [] };
    const next = [...scenes];
    next.splice(index + 1, 0, copy);
    updateScenes(next);
    setSelectedId(copy.id);
  }

  function deleteScene(sceneId: string) {
    if (scenes.length <= 1) return;
    const next = scenes.filter((scene) => scene.id !== sceneId);
    updateScenes(next);
    if (selectedId === sceneId) setSelectedId(next[0]?.id ?? null);
  }

  function addScene() {
    const style = getVideoStyle(concept.styleId);
    const blueprint = style.sceneStructure[scenes.length % style.sceneStructure.length];
    const created: Scene = {
      id: randomId(),
      index: scenes.length,
      durationMs: 3000,
      title: `Szene ${scenes.length + 1}`,
      visualDescription: "",
      source: {
        kind: "ai_image_motion",
        assetId: null,
        url: null,
        prompt: "",
        gradient: style.gradient.slice(0, 3),
        isDemo: false,
      },
      text: {
        content: "",
        subline: "",
        fontFamily: style.typography.headline,
        fontSize: style.typography.headlineSizePx,
        color: style.palette.text,
        position: blueprint.textPosition,
        animation: blueprint.textAnimation,
      },
      transition: blueprint.transition,
      effect: blueprint.effect,
      voiceoverText: "",
      voiceoverAssetId: null,
      voiceoverUrl: null,
      voiceoverWords: [],
      voiceVolume: style.audioMix.voiceVolume,
      musicVolume: style.audioMix.musicVolume,
      showSubtitles: false,
      soundNote: "",
    };
    updateScenes([...scenes, created]);
    setSelectedId(created.id);
  }

  /* -------------------------------- preview ------------------------------ */

  const spec = React.useMemo(
    () =>
      buildVideoSpec(project, { ...concept, scenes }, {
        quality: "preview",
        // Non-empty base URL: the browser fetches media through the app.
        assetBaseUrl: "/api/media",
        music: concept.musicUrl
          ? {
              src: concept.musicUrl,
              volume: getVideoStyle(concept.styleId).audioMix.musicVolume,
            }
          : null,
        showSafeZones,
      }),
    [concept, project, scenes, showSafeZones],
  );

  React.useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = () => setCurrentMs(framesToMs(player.getCurrentFrame(), spec.fps));
    const timer = setInterval(onFrame, 120);
    return () => clearInterval(timer);
  }, [spec.fps]);

  const warnings = React.useMemo(
    () => checkConcept({ ...concept, scenes }, project.durationSeconds),
    [concept, project.durationSeconds, scenes],
  );
  const warningSceneIds = new Set(
    warnings.filter((entry) => entry.sceneId).map((entry) => entry.sceneId as string),
  );

  /* --------------------------------- media ------------------------------- */

  React.useEffect(() => {
    apiGet<{ estimate: CreditEstimate }>(
      `/api/projects/${project.id}/estimate?operation=media&conceptId=${concept.id}`,
    )
      .then((result) => setMediaEstimate(result.estimate))
      .catch(() => undefined);
  }, [concept.id, project.id]);

  async function startMedia() {
    setConfirmMedia(false);
    try {
      if (dirty.current) await save(concept);
      const result = await apiSend<{ job: { id: string } }>(
        `/api/projects/${project.id}/media`,
        "POST",
        { conceptId: concept.id },
      );
      mediaJob.track(result.job.id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Zurück zum Dashboard">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{project.name}</h1>
            <p className="truncate text-xs text-chalk-faint">{concept.title}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-chalk-faint" aria-live="polite">
            {saveState === "saving" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Speichert …
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="size-3.5 text-mint" /> Gespeichert
              </>
            ) : saveState === "error" ? (
              <>
                <AlertTriangle className="size-3.5 text-danger" /> Nicht gespeichert
              </>
            ) : (
              <>
                <Save className="size-3.5" /> Automatisch gespeichert
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rückgängig"
            onClick={undo}
            disabled={history.past.length === 0}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Wiederherstellen"
            onClick={redo}
            disabled={history.future.length === 0}
          >
            <Redo2 className="size-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${project.id}/concepts`}>
              <RefreshCw className="size-4" /> Konzepte
            </Link>
          </Button>
          <Button
            variant={hasMedia ? "secondary" : "primary"}
            size="sm"
            onClick={() => setConfirmMedia(true)}
            disabled={mediaJob.isActive}
          >
            {mediaJob.isActive ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Images className="size-4" />
            )}
            Medien generieren
          </Button>
          <Button size="sm" asChild>
            <Link href={`/projects/${project.id}/export`}>
              <Download className="size-4" /> Export
            </Link>
          </Button>
        </div>
      </header>

      {mediaJob.job && mediaJob.isActive ? (
        <div className="border-b border-ink-800 p-4">
          <JobProgress
            job={mediaJob.job}
            title="Medien werden generiert"
            onCancel={() => void mediaJob.cancel()}
          />
        </div>
      ) : null}

      <div className="grid flex-1 gap-0 lg:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        <section
          aria-label="Szenenliste"
          className="order-2 border-t border-ink-800 lg:order-1 lg:border-r lg:border-t-0"
        >
          <SceneList
            scenes={scenes}
            selectedId={selectedScene?.id ?? null}
            warningSceneIds={warningSceneIds}
            onSelect={setSelectedId}
            onMove={moveScene}
            onDuplicate={duplicateScene}
            onDelete={deleteScene}
            onAdd={addScene}
          />
        </section>

        <section aria-label="Vorschau" className="order-1 space-y-4 p-4 lg:order-2">
          <div className="mx-auto w-full max-w-[19rem] space-y-3">
            <VideoPreview spec={spec} playerRef={playerRef} className="aspect-[9/16] w-full" />
            <label className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-chalk-dim">
              <span>
                Safe Zones einblenden
                <span className="mt-0.5 block text-[11px] text-chalk-faint">
                  Zeigt, was die TikTok- und Reels-Oberfläche überdeckt. Nur in der Vorschau.
                </span>
              </span>
              <Switch
                checked={showSafeZones}
                onCheckedChange={(checked) => setShowSafeZones(checked === true)}
                aria-label="Safe Zones einblenden"
              />
            </label>
          </div>

          <Timeline
            scenes={scenes}
            selectedId={selectedScene?.id ?? null}
            currentMs={currentMs}
            onSelect={setSelectedId}
            onSeek={(ms) => playerRef.current?.seekTo(Math.round((ms / 1000) * spec.fps))}
          />

          {warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-brand/35 bg-amber-brand/10 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-brand">
                <AlertTriangle className="size-3.5" /> Qualitätshinweise
              </p>
              <ul className="mt-2 space-y-1 text-xs text-chalk-dim">
                {warnings.map((warning) => (
                  <li key={warning.id}>· {warning.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border border-mint/30 bg-mint/10 p-3 text-xs text-mint">
              Keine Qualitätshinweise – das Video ist bereit für den Export.
            </p>
          )}
        </section>

        <section
          aria-label="Szeneneigenschaften"
          className="order-3 border-t border-ink-800 lg:border-l lg:border-t-0"
        >
          {selectedScene ? (
            <SceneProperties
              scene={selectedScene}
              assets={assets}
              projectId={project.id}
              conceptId={concept.id}
              onChange={(patch) => patchScene(selectedScene.id, patch)}
            />
          ) : null}
        </section>
      </div>

      <Dialog open={confirmMedia} onOpenChange={setConfirmMedia}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Medien generieren</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-chalk-dim">
            Für jede Szene werden Visuals erzeugt, Voice-over gesprochen und ein Musikbett
            gebaut. Bereits vorhandene Uploads werden bevorzugt verwendet.
          </p>
          {mediaEstimate ? (
            <div className="mt-4">
              <CreditEstimateBox
                estimate={mediaEstimate}
                balance={balance}
                demoMode={demoMode}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmMedia(false)}>
              Abbrechen
            </Button>
            <Button onClick={startMedia}>Jetzt generieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {demoMode ? (
        <p className="border-t border-ink-800 px-4 py-2 text-center text-xs text-chalk-faint">
          <Badge tone="violet" className="mr-2">
            Demo
          </Badge>
          Visuals und Voice-over stammen aus Demo-Providern und sind als KI-/Demo-Inhalte
          gekennzeichnet.
        </p>
      ) : null}
    </div>
  );
}
