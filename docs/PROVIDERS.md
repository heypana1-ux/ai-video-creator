# Provider-Dokumentation

AdReel AI bindet keinen KI-Anbieter fest in die Business-Logik ein. Für jede
Fähigkeit gibt es ein Interface, mindestens einen Mock und mindestens einen
vorbereiteten Adapter für einen echten Dienst. Der Wechsel ist eine
Environment-Variable.

---

## 1. Überblick

| Fähigkeit | Interface | Adapter | Env-Variable |
| --- | --- | --- | --- |
| Texte, Konzepte, Hooks | `TextGenerationProvider` | `mock` · `openai` · `anthropic` | `ADREEL_TEXT_PROVIDER` |
| Bilder | `ImageGenerationProvider` | `mock` · `openai` · `replicate` | `ADREEL_IMAGE_PROVIDER` |
| Videoclips | `VideoGenerationProvider` | `mock` · `replicate` | `ADREEL_VIDEO_PROVIDER` |
| Voice-over | `VoiceGenerationProvider` | `mock` · `elevenlabs` | `ADREEL_VOICE_PROVIDER` |
| Musik | `MusicProvider` | `mock` · `library` | `ADREEL_MUSIC_PROVIDER` |
| Rendering | `VideoRenderProvider` | `remotion` · `mock` | `ADREEL_RENDER_PROVIDER` |
| Speicher | `StorageProvider` | `local` · `supabase` | `ADREEL_STORAGE_PROVIDER` |

Die aktive Auswahl und ihre Erreichbarkeit sind in der App unter
**Einstellungen → KI-Anbieter** sichtbar.

> **Wichtig:** Im Demo-Modus (kein Supabase konfiguriert oder
> `ADREEL_FORCE_DEMO=1`) werden **immer** die Mocks verwendet, unabhängig von
> diesen Variablen. So kann eine Demo-Installation keine Kosten verursachen.

---

## 2. Was jeder Adapter automatisch bekommt

Alle Adapter laufen durch `executeProviderCall()`
(`src/lib/ai/execute.ts`) und erhalten dadurch ohne Zusatzcode:

- **Timeout** (`ADREEL_PROVIDER_TIMEOUT_MS`, Standard 120 s), erzwungen über ein
  Abbruchsignal – ein Adapter, der sein `signal` ignoriert, kann den Job nicht
  blockieren.
- **Retry mit Full-Jitter-Backoff** (`ADREEL_PROVIDER_MAX_RETRIES`, Standard 2),
  nur bei wiederholbaren Fehlern (429, 5xx, Timeout, „nicht erreichbar“).
- **Abbruch** über ein von außen gereichtes `AbortSignal`; der Replicate-Adapter
  storniert zusätzlich die entfernte Prediction, damit nichts weiterläuft.
- **Kostenmetadaten** (`estimatedUsd`, `credits`) und die **Provider-Job-ID**,
  beides landet in `provider_usage`.
- **Strukturiertes Logging** ohne Secrets: API-Keys und Bearer-Tokens werden
  redigiert, Prompts nur als Länge plus kurzer Anfang protokolliert.
- **Typisierte Fehler** (`ProviderError`) mit verständlicher deutscher Meldung
  für die Oberfläche.

---

## 3. Text

### Vertrag

Der Konzeptgenerator schickt einen Prompt, der das Briefing als
`<BRIEF>…</BRIEF>`-JSON-Block enthält, und erwartet:

```jsonc
{
  "concepts": [{
    "title": "…", "bigIdea": "…", "audience": "…", "hook": "…",
    "callToAction": "…", "caption": "…", "hashtags": ["#…"],
    "rationale": "…", "musicNote": "…", "styleId": "viral_ugc",
    "beats": [{
      "role": "hook|problem|context|proof|feature|showcase|transformation|offer|cta",
      "priority": 1,          // 1 = unverzichtbar, 5 = zuerst streichen
      "weight": 1.2,          // nur relative Szenenlänge
      "title": "…",
      "text": "Text im Bild", // maximal ca. 6 Wörter
      "subline": "…",
      "voiceover": "Gesprochener Satz",
      "visual": "…",
      "mediaPrompt": "Prompt für das Bild-/Videomodell",
      "sourceKind": "ai_image_motion",
      "assetHint": "cover",
      "soundNote": "…"
    }]
  }]
}
```

**Absolute Sekunden liefert das Modell nicht.** `layoutConcept()` rechnet die
Gewichte in Millisekunden um, sodass die Szenen sich immer exakt auf die
gewünschte Videolänge summieren.

Antwortet ein Modell mit ungültigem JSON oder verletzt es das Schema, fällt die
Generierung auf den deterministischen Composer zurück; der Job schlägt nicht
fehl, und der Nutzer sieht einen Hinweis.

### OpenAI

```bash
ADREEL_TEXT_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=gpt-4.1-mini      # optional
OPENAI_BASE_URL=https://api.openai.com/v1  # optional, z. B. für Azure/Proxy
```

Nutzt `/chat/completions` mit `response_format: json_object`.

### Anthropic

```bash
ADREEL_TEXT_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_TEXT_MODEL=claude-opus-5   # optional, Standard
ANTHROPIC_EFFORT=                    # optional: low|medium|high|xhigh|max
```

Nutzt das offizielle SDK (`@anthropic-ai/sdk`) gegen `/v1/messages`.

Zwei Parameter, die ältere Beispiele häufig mitschicken, werden von **allen
aktuellen Modellen** (Opus 5, Sonnet 5, die 4.6/4.7/4.8-Familie) mit einem 400
abgelehnt und sind hier deshalb bewusst nicht gesetzt:

- **`temperature` / `top_p` / `top_k`** – Sampling-Parameter wurden entfernt.
  `TextGenerationInput.temperature` wird von diesem Adapter ignoriert; der
  OpenAI-Adapter wertet es weiterhin aus.
- **Assistant-Prefill** (die Antwort mit `{` vorbelegen) – nicht mehr erlaubt.
  Die JSON-Form trägt stattdessen der Prompt; `extractJsonObject` und die
  Zod-Validierung im Konzept-Engine fangen überschüssigen Fließtext ab.

Kosten steuerst du über `ANTHROPIC_TEXT_MODEL` (Sonnet 5 kostet rund ein
Drittel von Opus 5) und `ANTHROPIC_EFFORT` (niedrigere Stufe = weniger
Denk-Tokens). Antwortet das Modell mit `stop_reason: "refusal"`, meldet der
Adapter das als verständlichen Fehler statt als leere Antwort.

### Mock

Liest das Briefing aus dem Prompt und beantwortet es mit dem Composer
(`src/lib/concepts/composer.ts`). Pro Kategorie existieren mehrere
Werbe-Archetypen; welche gewählt werden, hängt von Tonalität und einem Hash des
Projekts ab. Ergebnis: für dasselbe Briefing immer dieselben Konzepte, gefüllt
mit den echten Nutzerangaben.

Sprachen: Deutsch und Englisch. Andere Sprachen brauchen einen echten Provider.

---

## 4. Bild

```bash
# OpenAI
ADREEL_IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_IMAGE_MODEL=gpt-image-1

# Replicate
ADREEL_IMAGE_PROVIDER=replicate
REPLICATE_API_TOKEN=r8_...
REPLICATE_IMAGE_MODEL=black-forest-labs/flux-schnell
```

Beide laden das Ergebnis über den Storage-Provider hoch und geben eine URL
zurück. Zielgröße ist 1080 × 1920; OpenAI bekommt die nächstliegende
unterstützte Größe.

**Mock:** erzeugt deterministische SVG-Poster (`src/lib/media/artwork.ts`) mit
sechs Varianten (Mesh, Orbs, Bänder, Ringe, Grid, Partikel), eingefärbt mit der
Palette des gewählten Video-Stils. Gleicher Seed ⇒ gleiches Bild.

---

## 5. Video

```bash
ADREEL_VIDEO_PROVIDER=replicate
REPLICATE_API_TOKEN=r8_...
REPLICATE_VIDEO_MODEL=minimax/video-01
```

Der Adapter legt eine Prediction an, pollt sie, meldet Fortschritt, storniert
bei Abbruch und lädt das Ergebnis in den Speicher. Timeout: 10 Minuten.

**Mock:** liefert ein Standbild plus `motionHint`; der Renderer animiert es
(Ken Burns, Parallax, Puls). Im Export ist echte Bewegung sichtbar, ohne dass
ein Videomodell bezahlt werden muss.

---

## 6. Voice-over

```bash
ADREEL_VOICE_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # optional
ELEVENLABS_MODEL=eleven_multilingual_v2     # optional
```

Verwendet den `with-timestamps`-Endpunkt und rechnet die Zeichen-Alignments in
**Wort-Timings** um – genau das braucht der Untertitel-Renderer für die
Hervorhebung des gerade gesprochenen Wortes.

**Mock:** erzeugt eine stille WAV-Spur exakter Länge plus aus dem Text
abgeleitete Wort-Timings (gewichtet nach Wortlänge, mit Pausen nach
Satzzeichen). Untertitel, Szenenlängen und Audiomischung stimmen dadurch – es
wird nur nicht gesprochen. Die Oberfläche kennzeichnet das.

---

## 7. Musik

```bash
ADREEL_MUSIC_PROVIDER=library
ADREEL_MUSIC_LIBRARY_DIR=music-library   # optional
```

Der Bibliotheks-Provider serviert lizenzierte Tracks aus einem lokalen Ordner
und matcht Dateinamen grob gegen Stimmung und Genre. Lege die Lizenz als
`music-library/LICENSE` daneben.

**Mock:** synthetisiert ein **hörbares** Musikbett (`src/lib/media/wav.ts`) –
Pad-Akkorde über eine Vier-Akkord-Progression, Sub-Bass, Kick und Hats. Tempo
(78–140 bpm) und Helligkeit hängen von der gewählten Tonalität ab. Dadurch
enthält auch ein Demo-Export eine echte, korrekt gemischte Tonspur.

---

## 8. Rendering

```bash
ADREEL_RENDER_PROVIDER=remotion            # Standard
REMOTION_BROWSER_EXECUTABLE=/pfad/zu/chrome  # optional, spart den Download
REMOTION_CONCURRENCY=4                       # optional
```

Remotion rendert die Komposition `AdReel`:

| Einstellung | Wert |
| --- | --- |
| Container / Codec | MP4 / H.264 |
| Final | 1080 × 1920 (9:16), CRF 20 |
| Vorschau | 720 × 1280, CRF 24 |
| Bildrate | 30 FPS |
| Pixelformat | `yuv420p` |
| Untertitel | eingebrannt, mit hervorgehobenem Sprechwort |

Beim ersten Render lädt Remotion einen Chrome Headless Shell herunter, sofern
`REMOTION_BROWSER_EXECUTABLE` nicht gesetzt ist.

`ADREEL_RENDER_PROVIDER=mock` schreibt nur eine Platzhalterdatei und ist
**ausschließlich für automatisierte Tests** gedacht – kein abspielbares Video.

---

## 9. Speicher

```bash
ADREEL_STORAGE_PROVIDER=supabase
SUPABASE_STORAGE_BUCKET=adreel-media
SUPABASE_SERVICE_ROLE_KEY=...
```

- **`local`** – Dateien unter `<ADREEL_DATA_DIR>/media`, bewusst **außerhalb**
  von `public/`. Ausgeliefert wird nur über `/api/media/[...key]` mit
  Session-Prüfung, Pfadvalidierung, `nosniff` und restriktiver CSP.
- **`supabase`** – privater Bucket, jede URL ist eine kurzlebige Signed URL.
  Objekte liegen unter `<workspaceId>/…`, die Bucket-Policy prüft genau das.

---

## 10. Eigenen Adapter schreiben

1. Interface aus `src/lib/ai/types.ts` implementieren.
2. Die eigentliche Arbeit in `executeProviderCall({ … })` kapseln – damit sind
   Timeout, Retry, Abbruch, Logging und Kostenmetadaten erledigt.
3. Fehler als `ProviderError` mit passendem Code werfen (`providerFetch()` aus
   `providers/http.ts` erledigt das für HTTP-Antworten).
4. `status()` implementieren: eine billige Prüfung ohne bezahlten Aufruf.
5. In `src/lib/ai/registry.ts` einen Zweig ergänzen.
6. Test hinzufügen – `tests/unit/providers.test.ts` zeigt das Muster.

Skelett:

```ts
export class MeinImageProvider implements ImageGenerationProvider {
  readonly id = "mein-image";
  readonly kind = "image" as const;
  readonly isDemo = false;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(process.env.MEIN_API_KEY);
    return {
      id: this.id, kind: this.kind, available: configured, isDemo: false,
      detail: configured ? "bereit" : "MEIN_API_KEY fehlt",
    };
  }

  async generate(input: ImageGenerationInput, options: ProviderCallOptions = {}) {
    return executeProviderCall<GeneratedMedia>({
      providerId: this.id,
      kind: this.kind,
      operation: "generate",
      isDemo: false,
      cost: { estimatedUsd: 0.02, credits: 0 },
      attempt: async ({ signal, onProgress }) => {
        onProgress(0.2, "Bild wird angefragt");
        const bytes = await meineApi(input, signal);
        const stored = await this.storage.put(
          `generated/images/${crypto.randomUUID()}.png`, bytes, "image/png",
        );
        return {
          url: stored.url, mimeType: "image/png",
          width: input.width, height: input.height,
          byteSize: stored.byteSize, isDemo: false,
        };
      },
    }, options);
  }
}
```

---

## 11. Credits

Die Preise stehen in `src/lib/credits/pricing.ts`:

| Aktion | Credits |
| --- | --- |
| Konzeptgenerierung (3 Konzepte) | 4 |
| Szene neu texten | 1 |
| Alternative Hooks | 1 |
| KI-Bild | 6 |
| KI-Videoclip (je angefangene 5 s) | 25 |
| Voice-over (je angefangene 15 s) | 3 |
| Hintergrundmusik | 5 |
| Website-Analyse | 1 |
| Vorschau-Rendering | 8 |
| Finaler Export | 20 |

Vor jeder kostenpflichtigen Generierung zeigt die App eine **aufgeschlüsselte
Schätzung** samt Guthaben. Credits werden vor dem Start reserviert und bei
Fehlschlag oder Abbruch automatisch zurückgebucht. Im Demo-Modus werden sie
zwar gebucht, kosten aber nichts.
