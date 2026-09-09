import type { Concept, Scene } from "@/lib/domain/schemas";
import { estimateSpeechDurationMs, splitWords } from "./captions";

/**
 * Lightweight quality checks shown in the editor.
 *
 * These are deliberately simple heuristics with actionable messages - they
 * catch the mistakes that actually hurt a vertical ad (too much text, a scene
 * that is too short to read, a voice-over that cannot fit).
 */

export type WarningSeverity = "warning" | "info";

export interface QualityWarning {
  id: string;
  sceneId: string | null;
  severity: WarningSeverity;
  message: string;
}

const MAX_HEADLINE_WORDS = 8;
const MIN_READABLE_MS = 1200;

export function checkScene(scene: Scene, index: number): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const label = `Szene ${index + 1}`;

  const headlineWords = splitWords(scene.text.content).length;
  if (headlineWords > MAX_HEADLINE_WORDS) {
    warnings.push({
      id: `${scene.id}:text-length`,
      sceneId: scene.id,
      severity: "warning",
      message: `${label}: Der Bildtext ist mit ${headlineWords} Wörtern zu lang. Maximal ${MAX_HEADLINE_WORDS} Wörter bleiben im Feed lesbar.`,
    });
  }

  if (scene.text.content.trim() && scene.durationMs < MIN_READABLE_MS) {
    warnings.push({
      id: `${scene.id}:too-short`,
      sceneId: scene.id,
      severity: "warning",
      message: `${label}: Mit ${(scene.durationMs / 1000).toFixed(1)} s ist die Szene zu kurz, um den Text zu lesen.`,
    });
  }

  if (scene.voiceoverText.trim()) {
    const needed = estimateSpeechDurationMs(scene.voiceoverText);
    if (needed > scene.durationMs * 1.15) {
      warnings.push({
        id: `${scene.id}:voice-overflow`,
        sceneId: scene.id,
        severity: "warning",
        message: `${label}: Das Voice-over braucht etwa ${(needed / 1000).toFixed(1)} s, die Szene ist aber nur ${(scene.durationMs / 1000).toFixed(1)} s lang.`,
      });
    }
  }

  if (!scene.source.url && scene.source.kind !== "color_gradient") {
    warnings.push({
      id: `${scene.id}:no-media`,
      sceneId: scene.id,
      severity: "info",
      message: `${label}: Noch kein Medium hinterlegt – es wird ein Farbverlauf verwendet.`,
    });
  }

  return warnings;
}

export function checkConcept(concept: Concept, targetDurationSeconds: number): QualityWarning[] {
  const warnings = concept.scenes
    .slice()
    .sort((a, b) => a.index - b.index)
    .flatMap((scene, index) => checkScene(scene, index));

  const totalMs = concept.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
  const targetMs = targetDurationSeconds * 1000;
  if (Math.abs(totalMs - targetMs) > 200) {
    warnings.push({
      id: "duration-mismatch",
      sceneId: null,
      severity: "info",
      message: `Die Szenen ergeben ${(totalMs / 1000).toFixed(1)} s statt der geplanten ${targetDurationSeconds} s.`,
    });
  }

  const firstScene = concept.scenes.find((scene) => scene.index === 0);
  if (firstScene && !firstScene.text.content.trim() && !firstScene.voiceoverText.trim()) {
    warnings.push({
      id: "weak-hook",
      sceneId: firstScene.id,
      severity: "warning",
      message:
        "Die erste Szene hat weder Text noch Voice-over. In den ersten zwei Sekunden entscheidet sich, ob jemand bleibt.",
    });
  }

  if (!concept.scenes.some((scene) => scene.showSubtitles)) {
    warnings.push({
      id: "no-subtitles",
      sceneId: null,
      severity: "info",
      message: "Keine Szene zeigt Untertitel. Ein großer Teil der Zuschauer schaut ohne Ton.",
    });
  }

  return warnings;
}
