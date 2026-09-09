"use client";

import * as React from "react";
import { Image as ImageIcon, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { Checkbox, Slider } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiSend, errorMessage } from "@/lib/client/api";
import {
  SCENE_EFFECTS,
  SCENE_SOURCE_KINDS,
  TEXT_ANIMATIONS,
  TEXT_POSITIONS,
  TRANSITIONS,
} from "@/lib/domain/enums";
import type { Asset, Scene } from "@/lib/domain/schemas";

const SOURCE_LABELS: Record<(typeof SCENE_SOURCE_KINDS)[number], string> = {
  ai_video: "KI-generiertes Video",
  ai_image_motion: "KI-Bild mit Bewegung",
  user_upload: "Eigener Upload",
  website_screenshot: "Website-Screenshot",
  app_screenshot: "App-Screenshot",
  stock_demo: "Stock-/Demo-Medium",
  color_gradient: "Farbverlauf",
};

const TRANSITION_LABELS: Record<(typeof TRANSITIONS)[number], string> = {
  none: "Ohne",
  cut: "Harter Schnitt",
  fade: "Überblenden",
  slide_up: "Slide nach oben",
  slide_left: "Slide nach links",
  zoom_in: "Zoom hinein",
  zoom_out: "Zoom heraus",
  whip_pan: "Whip-Pan",
  glitch: "Glitch",
  flash: "Blitz",
};

const ANIMATION_LABELS: Record<(typeof TEXT_ANIMATIONS)[number], string> = {
  none: "Ohne",
  fade_in: "Einblenden",
  slide_up: "Von unten",
  pop: "Pop",
  typewriter: "Schreibmaschine",
  word_by_word: "Wort für Wort",
  blur_in: "Unschärfe",
};

const POSITION_LABELS: Record<(typeof TEXT_POSITIONS)[number], string> = {
  top: "Oben",
  upper_third: "Oberes Drittel",
  center: "Mitte",
  lower_third: "Unteres Drittel",
  bottom: "Unten",
};

const EFFECT_LABELS: Record<(typeof SCENE_EFFECTS)[number], string> = {
  none: "Ohne",
  ken_burns: "Ken Burns",
  shake: "Shake",
  pulse: "Puls",
  film_grain: "Filmkorn",
  vignette: "Vignette",
  scanlines: "Scanlines",
};

interface Props {
  scene: Scene;
  assets: Asset[];
  projectId: string;
  conceptId: string;
  onChange: (patch: Partial<Scene>) => void;
}

export function SceneProperties({ scene, assets, projectId, conceptId, onChange }: Props) {
  const [regenerating, setRegenerating] = React.useState(false);

  async function regenerateMedia() {
    setRegenerating(true);
    try {
      const result = await apiSend<{ scene: Scene }>(
        `/api/projects/${projectId}/concepts/${conceptId}/scenes/${scene.id}/regenerate`,
        "POST",
        { prompt: scene.source.prompt },
      );
      onChange({ source: result.scene.source });
      toast.success("Neues Medium erzeugt.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Tabs defaultValue="media" className="flex h-full flex-col">
      <TabsList className="mx-3 mt-3 grid grid-cols-3">
        <TabsTrigger value="media">Medium</TabsTrigger>
        <TabsTrigger value="text">Text</TabsTrigger>
        <TabsTrigger value="audio">Audio</TabsTrigger>
      </TabsList>

      <div className="scrollbar-slim flex-1 overflow-y-auto p-3">
        <TabsContent value="media" className="mt-0 space-y-4">
          <Field label="Dauer (Sekunden)" htmlFor="sceneDuration">
            <Input
              id="sceneDuration"
              type="number"
              min={0.5}
              max={20}
              step={0.1}
              value={(scene.durationMs / 1000).toFixed(1)}
              onChange={(event) =>
                onChange({ durationMs: Math.round(Number(event.target.value) * 1000) })
              }
            />
          </Field>

          <Field label="Quelle" htmlFor="sceneSource">
            <NativeSelect
              id="sceneSource"
              value={scene.source.kind}
              onChange={(event) =>
                onChange({
                  source: {
                    ...scene.source,
                    kind: event.target.value as Scene["source"]["kind"],
                  },
                })
              }
            >
              {SCENE_SOURCE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {SOURCE_LABELS[kind]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="KI-Medienprompt" htmlFor="scenePrompt">
            <Textarea
              id="scenePrompt"
              value={scene.source.prompt}
              onChange={(event) =>
                onChange({ source: { ...scene.source, prompt: event.target.value } })
              }
            />
          </Field>

          <Button
            variant="secondary"
            className="w-full"
            onClick={regenerateMedia}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Medium neu generieren
          </Button>

          {assets.length > 0 ? (
            <Field label="Eigenes Medium verwenden" htmlFor="sceneAsset">
              <NativeSelect
                id="sceneAsset"
                value={scene.source.assetId ?? ""}
                onChange={(event) => {
                  const asset = assets.find((item) => item.id === event.target.value);
                  onChange({
                    source: {
                      ...scene.source,
                      assetId: asset?.id ?? null,
                      url: asset?.url ?? scene.source.url,
                      isDemo: asset ? asset.isDemo : scene.source.isDemo,
                    },
                  });
                }}
              >
                <option value="">Kein eigenes Medium</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.fileName}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}

          {scene.source.url ? (
            <div className="overflow-hidden rounded-xl border border-ink-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={scene.source.url} alt="" className="aspect-[9/16] w-full object-cover" />
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-ink-600 p-3 text-xs text-chalk-faint">
              <ImageIcon className="size-4" /> Noch kein Medium – es wird ein Farbverlauf gerendert.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Übergang" htmlFor="sceneTransition">
              <NativeSelect
                id="sceneTransition"
                value={scene.transition}
                onChange={(event) =>
                  onChange({ transition: event.target.value as Scene["transition"] })
                }
              >
                {TRANSITIONS.map((transition) => (
                  <option key={transition} value={transition}>
                    {TRANSITION_LABELS[transition]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Effekt" htmlFor="sceneEffect">
              <NativeSelect
                id="sceneEffect"
                value={scene.effect}
                onChange={(event) => onChange({ effect: event.target.value as Scene["effect"] })}
              >
                {SCENE_EFFECTS.map((effect) => (
                  <option key={effect} value={effect}>
                    {EFFECT_LABELS[effect]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </TabsContent>

        <TabsContent value="text" className="mt-0 space-y-4">
          <Field label="Titel der Szene" htmlFor="sceneTitle">
            <Input
              id="sceneTitle"
              value={scene.title}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>

          <Field label="Text im Bild" htmlFor="sceneText" hint="Maximal etwa 6 Wörter.">
            <Textarea
              id="sceneText"
              value={scene.text.content}
              onChange={(event) =>
                onChange({ text: { ...scene.text, content: event.target.value } })
              }
            />
          </Field>

          <Field label="Zweite Zeile" htmlFor="sceneSubline">
            <Input
              id="sceneSubline"
              value={scene.text.subline}
              onChange={(event) =>
                onChange({ text: { ...scene.text, subline: event.target.value } })
              }
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Schriftart" htmlFor="sceneFont">
              <Input
                id="sceneFont"
                value={scene.text.fontFamily}
                onChange={(event) =>
                  onChange({ text: { ...scene.text, fontFamily: event.target.value } })
                }
              />
            </Field>
            <Field label="Farbe" htmlFor="sceneColor">
              <Input
                id="sceneColor"
                type="color"
                className="h-10 p-1"
                value={scene.text.color}
                onChange={(event) =>
                  onChange({ text: { ...scene.text, color: event.target.value } })
                }
              />
            </Field>
          </div>

          <Field label={`Schriftgröße: ${scene.text.fontSize} px`}>
            <Slider
              min={16}
              max={160}
              step={2}
              value={[scene.text.fontSize]}
              onValueChange={([value]) =>
                onChange({ text: { ...scene.text, fontSize: value } })
              }
              aria-label="Schriftgröße"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Position" htmlFor="scenePosition">
              <NativeSelect
                id="scenePosition"
                value={scene.text.position}
                onChange={(event) =>
                  onChange({
                    text: { ...scene.text, position: event.target.value as Scene["text"]["position"] },
                  })
                }
              >
                {TEXT_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {POSITION_LABELS[position]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Textanimation" htmlFor="sceneAnimation">
              <NativeSelect
                id="sceneAnimation"
                value={scene.text.animation}
                onChange={(event) =>
                  onChange({
                    text: {
                      ...scene.text,
                      animation: event.target.value as Scene["text"]["animation"],
                    },
                  })
                }
              >
                {TEXT_ANIMATIONS.map((animation) => (
                  <option key={animation} value={animation}>
                    {ANIMATION_LABELS[animation]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </TabsContent>

        <TabsContent value="audio" className="mt-0 space-y-4">
          <Field label="Voice-over-Text" htmlFor="sceneVoiceover">
            <Textarea
              id="sceneVoiceover"
              value={scene.voiceoverText}
              onChange={(event) =>
                onChange({
                  voiceoverText: event.target.value,
                  // Timings from the old text no longer apply.
                  voiceoverWords: [],
                })
              }
            />
          </Field>

          {scene.voiceoverUrl ? (
            <audio controls src={scene.voiceoverUrl} className="w-full">
              <track kind="captions" />
            </audio>
          ) : (
            <p className="text-xs text-chalk-faint">
              Noch keine Tonspur. Sie entsteht beim Generieren der Medien.
            </p>
          )}

          <Field label={`Voice-Lautstärke: ${Math.round(scene.voiceVolume * 100)} %`}>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[Math.round(scene.voiceVolume * 100)]}
              onValueChange={([value]) => onChange({ voiceVolume: value / 100 })}
              aria-label="Voice-Lautstärke"
            />
          </Field>

          <Field label={`Musik-Lautstärke: ${Math.round(scene.musicVolume * 100)} %`}>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[Math.round(scene.musicVolume * 100)]}
              onValueChange={([value]) => onChange({ musicVolume: value / 100 })}
              aria-label="Musik-Lautstärke"
            />
          </Field>

          <label className="flex items-center gap-3 text-sm text-chalk-dim">
            <Checkbox
              checked={scene.showSubtitles}
              onCheckedChange={(checked) => onChange({ showSubtitles: checked === true })}
              aria-label="Untertitel anzeigen"
            />
            Untertitel einbrennen
          </label>

          <Field label="Sound-Hinweis" htmlFor="sceneSoundNote">
            <Input
              id="sceneSoundNote"
              value={scene.soundNote}
              onChange={(event) => onChange({ soundNote: event.target.value })}
            />
          </Field>
        </TabsContent>
      </div>
    </Tabs>
  );
}
