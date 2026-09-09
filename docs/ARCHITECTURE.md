# Architektur

Diese Übersicht beschreibt, wie AdReel AI aufgebaut ist und warum die
Entscheidungen so getroffen wurden.

---

## 1. Überblick

```
Browser
  │  Server Components (Dashboard, Wizard, Editor, Export)
  │  Client Components (Player, Formulare, Job-Polling)
  ▼
Next.js 16 App Router
  ├─ Route-Handler  ──► Repository ──► TableDriver ──► JSON-Datei | Supabase
  │        │
  │        └──────────► Job-Runner ──► Pipelines ──► Provider-Registry
  │                                                     ├─ Text     (mock | OpenAI | Anthropic)
  │                                                     ├─ Bild     (mock | OpenAI | Replicate)
  │                                                     ├─ Video    (mock | Replicate)
  │                                                     ├─ Voice    (mock | ElevenLabs)
  │                                                     ├─ Musik    (mock | Bibliothek)
  │                                                     ├─ Render   (Remotion | mock)
  │                                                     └─ Storage  (lokal | Supabase)
  ▼
Remotion-Komposition  ──► MP4 (H.264, 1080 × 1920, 30 FPS)
```

Zwei Leitgedanken durchziehen den ganzen Code:

1. **Ein Codepfad für Demo und Produktion.** Der Demo-Modus ist kein zweiter
   Ablauf, sondern dieselbe Pipeline mit anderen Adaptern. Deshalb testet der
   Demo-Workflow die Produktionslogik mit.
2. **Die Business-Logik kennt keinen Anbieter.** Sie spricht nur mit
   Interfaces. Ein Anbieterwechsel ist eine Environment-Variable.

---

## 2. Schichten

### 2.1 Domain (`src/lib/domain`)

- `enums.ts` – alle Aufzählungen als `as const`-Tupel plus abgeleitete Typen
  und deutsche Labels. Zod und die UI teilen sich dieselbe Quelle.
- `schemas.ts` – Zod-Schemata für Briefings, Konzepte, Szenen, Jobs, Exporte,
  Credits. Das Briefing ist eine **diskriminierte Union** über `category`:
  jede Kategorie hat eigene, typsichere `details`.
- `defaults.ts` – leere, aber gültige Briefings für den Wizard.

Validierung passiert immer am Rand (Route-Handler), nie tief im Code.

### 2.2 Konzeptgenerierung (`src/lib/concepts`)

Der interessanteste Teil, weil er die Trennung „Kreativität vs. Mechanik“
durchzieht:

| Datei | Aufgabe |
| --- | --- |
| `draft-schema.ts` | Der Vertrag, den **jeder** Textprovider erfüllen muss: Konzepte mit Beats, aber **ohne absolute Zeiten**. |
| `prompt.ts` | Baut System- und User-Prompt und bettet das Briefing als `<BRIEF>`-JSON-Block ein. |
| `composer.ts` | Deterministischer Generator: pro Kategorie mehrere Werbe-Archetypen, gefüllt mit den echten Nutzerangaben. |
| `layout.ts` | Rechnet Beats in Szenen mit exakten Millisekunden um. |
| `engine.ts` | Orchestriert: Prompt bauen → Provider rufen → JSON parsen → validieren → layouten → im Fehlerfall auf den Composer zurückfallen. |

**Warum liefern Provider keine Zeiten?** Sprachmodelle können nicht zuverlässig
rechnen. Indem sie nur relative Gewichte liefern und `distributeDurations()`
die Sekunden verteilt, summieren sich die Szenen *immer* exakt auf die
gewünschte Videolänge – egal welches Modell antwortet.

**Warum steckt das Briefing als JSON im Prompt?** Echte Modelle lesen es als
Kontext, der Mock-Provider parst es zurück und ruft den Composer. Beide
Antworten laufen anschließend durch dieselbe Zod-Validierung und dasselbe
Layout. Der Demo-Modus testet damit auch die Parser- und Fallback-Logik.

### 2.3 Provider (`src/lib/ai`)

```
types.ts       Interfaces: Text | Image | Video | Voice | Music | Render | Storage
execute.ts     executeProviderCall(): Timeout, Retry mit Backoff, Abbruch,
               Kostenmetadaten, Provider-Job-ID, Versuchszähler
errors.ts      ProviderError mit Code, Retry-Fähigkeit und Nutzertext
logging.ts     Redaktion von Keys und Tokens, Prompts nur als Fingerprint
registry.ts    Auswahl per Environment-Variable, memoisiert
providers/     Mock- und echte Adapter
```

Jeder Adapter besteht nur aus dem anbieterspezifischen Teil; alles Gemeinsame
liegt in `executeProviderCall`. Der Timeout wird über `Promise.race` gegen ein
Abbruchsignal erzwungen – ein Adapter, der sein `signal` ignoriert, kann den
Job dadurch nicht blockieren.

Die Mocks sind bewusst keine Attrappen:

- **Bild/Video** erzeugen deterministische, prozedurale SVG-Grafiken
  (`lib/media/artwork.ts`) – echte, renderbare Medien.
- **Musik** synthetisiert ein hörbares WAV (`lib/media/wav.ts`): Pad-Akkorde,
  Sub-Bass, Kick und Hats, Tempo und Helligkeit abhängig von der Tonalität.
- **Voice** erzeugt eine stille Tonspur exakter Länge *plus* Wort-Timings, damit
  Untertitel und Mischung real geprüft werden. Das ist im UI gekennzeichnet.
- **Latenz und Fortschritt** werden simuliert, damit Fortschrittsbalken,
  Abbrechen und Fehlerzustände im Demo-Modus echt durchlaufen.

### 2.4 Daten (`src/lib/db`)

```
driver.ts          TableDriver: select, insert, update, delete, truncate
json-driver.ts     Demo-Modus: eine JSON-Datei pro Tabelle, serialisierte Writes
supabase-driver.ts Produktiv: PostgREST, camelCase ⇄ snake_case
repository.ts      Domänenmethoden, immer nach workspaceId gefiltert
```

Die Domänenlogik existiert **einmal**. Der Treiber darunter ist austauschbar,
und beide Backends verhalten sich identisch – der JSON-Treiber sortiert bei
gleichen Zeitstempeln stabil nach Einfügereihenfolge, damit „neueste zuerst“
auch bei Millisekunden-Gleichstand stimmt.

Szenen liegen in einer eigenen Tabelle und werden beim Lesen ins
`Concept`-Aggregat hydriert – so, wie der Editor sie braucht.

### 2.5 Jobs (`src/lib/jobs`)

```
runner.ts     startJob(), cancelJob(), Fortschritts-Drosselung
credits.ts    Reservierung vor der Arbeit, Rückbuchung bei Fehler/Abbruch
media-plan.ts Entscheidet je Szene: vorhandenes Asset, KI-Bild, KI-Clip, Verlauf
pipelines.ts  Konzepte · Medien · Rendering
```

Jobs schreiben ihren Fortschritt in die Datenbank; die UI pollt
`/api/jobs/[jobId]`. Kein Socket, kein Serverzustand – ein Reload verliert
keinen laufenden Job.

Der Runner läuft in-process. Für mehrere Instanzen wird nur `startJob`
ausgetauscht; Pipelines und API bleiben unverändert.

**Credits** werden vor dem Start reserviert und bei Fehlschlag oder Abbruch
automatisch zurückgebucht – ein abgestürzter Job kostet nie etwas.

### 2.6 Video (`src/lib/video` + `src/remotion`)

`VideoSpec` ist die einzige serialisierbare Beschreibung eines Videos. Sowohl
der `<Player>` im Editor als auch der Renderer konsumieren **dieselbe**
Komposition mit **derselben** Spec – die Vorschau kann daher nicht vom Export
abweichen.

```
styles.ts     10 Vorlagen: Palette, Typografie, Übergänge, Textanimationen,
              Szenenstruktur, Caption-Stil, Audiomischung
captions.ts   Wort-Timings aus echten Providerdaten oder aus dem Skript
              abgeleitet, gruppiert zu kurzen Cues
spec.ts       Concept + Project → VideoSpec (Frames, Cues, Safe Zones)
quality.ts    Heuristiken für die Warnungen im Editor
```

**Medienauflösung.** Ein Medienverweis ist entweder eine absolute URL oder ein
Storage-Key. `remotion/resolve.ts` löst ihn je Laufzeit auf:

| Laufzeit | `assetBaseUrl` | Auflösung |
| --- | --- | --- |
| Browser-Preview | `/api/media` | Die authentifizierte Route liefert die Datei |
| Renderer | `""` | `staticFile()` gegen das als `publicDir` übergebene Medienverzeichnis |

Deshalb müssen Uploads nicht in `public/` liegen und werden nie anonym
ausgeliefert.

**Rendering.** `@remotion/bundler` baut die Komposition einmal pro Prozess
(memoisiert), `renderMedia` schreibt H.264 mit `yuv420p`. Bei entfernter
Speicherung schreibt der Renderer zuerst lokal und lädt danach hoch – er
braucht einen echten Dateipfad.

### 2.7 Sicherheit (`src/lib/api`, `src/lib/url-analysis`)

- **Autorisierung**: `handleAuthed()` bricht ohne Session ab; jede
  Repository-Methode filtert zusätzlich nach `workspaceId`. RLS ist die zweite
  Verteidigungslinie, nicht die einzige.
- **SSRF**: Protokoll-, Port- und Hostname-Prüfung, DNS-Auflösung gegen eine
  Blockliste privater Bereiche (IPv4 und IPv6 werden geparst, nicht per Regex
  gematcht – `[::ffff:a9fe:a9fe]` ist die Form, in der `new URL()` die
  Cloud-Metadaten-Adresse hinterlässt), manuelles Verfolgen jeder Weiterleitung
  mit erneuter Prüfung, Größen- und Zeitlimit.
- **Uploads**: Allowlist aus MIME-Typ *und* Endung, Größenlimit pro Asset-Art,
  bereinigter Dateiname, erneute Prüfung nach dem Lesen der echten Bytegröße.
- **Auslieferung**: `/api/media/[...key]` prüft Session und Pfad, setzt
  `nosniff` und eine restriktive CSP – hochgeladene SVGs können nichts ausführen.
- **Logging**: Keys und Bearer-Tokens werden redigiert, Prompts nur als
  `len=… head="…"` protokolliert.

### 2.8 UI (`src/app`, `src/components`)

Server Components laden Daten direkt über das Repository; Client Components
übernehmen nur Interaktion (Formulare, Player, Job-Polling). Das Design-System
liegt in `components/ui` (shadcn-Stil auf Radix-Primitiven), die Tokens in
`app/globals.css` als Tailwind-v4-`@theme`.

Der Editor hält Undo/Redo in **einem** State-Objekt (`past`, `present`,
`future`), damit Historie und Dokument nicht auseinanderlaufen können, und
speichert entprellt automatisch.

---

## 3. Datenmodell

| Tabelle | Zweck |
| --- | --- |
| `users` | Spiegelt `auth.users`, plus Anzeigename und Demo-Flag |
| `workspaces` | Besitzer, Credit-Guthaben, Onboarding-Zeitpunkt |
| `projects` | Briefing (jsonb), Kategorie, Status, gewähltes Konzept |
| `project_assets` | Uploads und generierte Medien |
| `concepts` | Titel, Idee, Hook, Skript, Caption, Hashtags, Begründung |
| `scenes` | Dauer, Quelle, Text, Übergang, Effekt, Voice-over, Wort-Timings |
| `scene_assets` | Verknüpfung Szene ↔ Asset je Rolle |
| `brand_kits` | Farben, Schrift, Logo |
| `generation_jobs` | Konzepte, Medien, Voice-over, Musik, Website-Import |
| `render_jobs` | Vorschau- und finale Renderings |
| `exports` | Fertige Dateien mit Auflösung, Länge, Größe |
| `provider_usage` | Anbieter, Operation, Dauer, geschätzte Kosten |
| `subscriptions` | Tarif und monatliche Credits |
| `credit_transactions` | Ledger mit Saldo nach jeder Buchung |

Alle Tabellen sind workspace-bezogen und über
`public.is_workspace_member(workspace_id)` durch RLS geschützt. Diese eine
Funktion ist auch der Ort, an dem später echte Team-Mitgliedschaften ergänzt
werden.

---

## 4. Ablauf einer Generierung

```
POST /api/projects/:id/concepts
  ├─ Session prüfen, Projekt laden, Rate-Limit
  ├─ Credits reservieren  ────────────────► credit_transactions
  ├─ generation_jobs anlegen (queued)
  ├─ startJob(...)  ── antwortet sofort ──► { job, estimate }
  └─ Hintergrund:
       ├─ Prompt bauen, Textprovider rufen (Fortschritt → DB)
       ├─ JSON extrahieren, mit Zod validieren
       ├─ bei ungültiger Antwort: Composer-Fallback
       ├─ layoutConcept() → exakte Szenenzeiten
       ├─ replaceConcepts()
       ├─ provider_usage schreiben
       └─ Job auf succeeded setzen
```

Fehler und Abbrüche laufen durch denselben `onError`-Pfad: Credits zurück,
Job-Status setzen, Projektstatus korrigieren.

---

## 5. Bewusste Vereinfachungen

| Entscheidung | Grund | Ablösung |
| --- | --- | --- |
| In-Process-Job-Runner | Ein Knoten reicht für den MVP und den Demo-Modus | `startJob` gegen eine Queue tauschen |
| In-Memory-Rate-Limits | Kein externer Dienst nötig | Redis oder Supabase |
| JSON-Store im Demo-Modus | Läuft ohne Datenbank | Supabase-Treiber ist bereits da |
| HTML-Extraktion per Regex | Nur wenige Signale nötig, alles wird vom Nutzer geprüft | Echter Parser, wenn mehr gebraucht wird |
| Website-Screenshots fehlen | Braucht eine Browser-Sandbox | Screenshot-Service als eigener Provider |
| Composer nur de/en | Deckt die Zielgruppe ab | Echter LLM-Provider für weitere Sprachen |
