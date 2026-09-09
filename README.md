# AdReel AI

**Aus deiner Idee wird in Minuten ein fertiges Werbevideo.**

AdReel AI erzeugt aus einem kurzen Briefing komplette vertikale Werbevideos für
TikTok, Instagram Reels und YouTube Shorts – inklusive Werbeidee, Hook, Skript,
Storyboard, Visuals, Texteinblendungen, Untertiteln, Voice-over, Musik,
Übergängen und einem fertigen MP4 in 1080 × 1920.

Die App läuft **ohne einen einzigen API-Key** in einem vollwertigen Demo-Modus:
Konzepte, Bilder, Voice-over und Musik kommen aus lokalen Demo-Providern, das
Rendering ist trotzdem echt – am Ende steht eine abspielbare MP4-Datei.

---

## Inhalt

- [Schnellstart](#schnellstart)
- [Der erste Workflow](#der-erste-workflow)
- [Was umgesetzt ist](#was-umgesetzt-ist)
- [Projektkategorien](#projektkategorien)
- [Environment-Variablen](#environment-variablen)
- [Demo-Modus vs. Produktivmodus](#demo-modus-vs-produktivmodus)
- [Echte KI-Provider anschließen](#echte-ki-provider-anschließen)
- [Supabase einrichten](#supabase-einrichten)
- [Skripte](#skripte)
- [Tests](#tests)
- [Projektstruktur](#projektstruktur)
- [Sicherheit und Compliance](#sicherheit-und-compliance)
- [Offene nächste Schritte](#offene-nächste-schritte)

---

## Schnellstart

Voraussetzungen: **Node.js 20.9+** (empfohlen 22), npm.

```bash
git clone <repo-url>
cd ai-video-creator
npm install

# optional: Beispielprojekte anlegen (Demo-Login: demo@adreel.local / adreel-demo-1234)
npm run seed

npm run dev
# http://localhost:3000
```

Eine `.env.local` ist **nicht erforderlich**. Ohne Konfiguration startet die App
im Demo-Modus. Für den Einstieg genügt auf `/login` der Button
**„Ohne Konto im Demo-Modus starten“**.

> **Rendering:** Beim ersten Export lädt Remotion einmalig einen Chrome Headless
> Shell herunter (~150 MB). Ist bereits ein Chrome/Chromium installiert, kann
> der Download vermieden werden:
> `REMOTION_BROWSER_EXECUTABLE=/pfad/zu/chrome`

### Produktionsbuild

```bash
npm run build
npm run start
```

---

## Der erste Workflow

1. App öffnen → `/login` → **Demo-Modus starten**
2. **Neues Video erstellen** → Kategorie **Musik**
3. Künstler, Songtitel, Genre, CTA eingeben, Rechte bestätigen, optional Cover
   und Audio hochladen
4. **Projekt anlegen** → die App generiert automatisch **drei Werbekonzepte**
5. Ein Konzept wählen → die Szenen öffnen sich im **Editor**
6. **Medien generieren** → Visuals, Voice-over-Timing und Musikbett entstehen
7. Vorschau im 9:16-Player abspielen, Szenen anpassen
8. **Export** → Vorschau (720 × 1280) oder final (1080 × 1920) rendern
9. **MP4 herunterladen**

Website-, App- und Mixing-&-Mastering-Projekte laufen über exakt dieselbe
Architektur – nur die Eingabefelder und die Werbe-Archetypen unterscheiden sich.

---

## Was umgesetzt ist

| Bereich | Status |
| --- | --- |
| Landingpage, Login/Registrierung, Onboarding | ✅ |
| Dashboard mit Öffnen, Duplizieren, Umbenennen, Löschen | ✅ |
| Projekt-Wizard mit 8 Kategorien und dynamischen Feldern | ✅ |
| KI-Konzeptgenerator (3 Konzepte, Hook, Skript, Szenen, Caption, Hashtags, Begründung) | ✅ |
| Szenenbasierter Editor (Liste, 9:16-Preview, Eigenschaften, Timeline) | ✅ |
| Undo/Redo, Autosave, Qualitätswarnungen | ✅ |
| 10 Video-Stile mit Farben, Typografie, Übergängen, Szenenstruktur | ✅ |
| Provider-Architektur mit Mock- und echten Adaptern | ✅ |
| Rendering nach MP4/H.264, 1080 × 1920, 30 FPS, eingebrannte Untertitel | ✅ |
| Hintergrundjobs mit Fortschritt, Abbruch, Wiederholung | ✅ |
| Credit-System mit Vorab-Schätzung, Ledger und Rückbuchung | ✅ |
| Brand-Kits, Asset-Bibliothek, Einstellungen, Credits, Rechtsseiten | ✅ |
| SSRF-sicherer Website-Import | ✅ |
| SQL-Migrationen mit Row Level Security | ✅ |
| Unit-, Integrations- und E2E-Tests | ✅ |
| Zahlungsabwicklung | ⛔ Platzhalter (Tarife sind sichtbar, aber nicht buchbar) |
| Echte Website-Screenshots | ⛔ noch nicht (siehe [Offene nächste Schritte](#offene-nächste-schritte)) |

---

## Projektkategorien

| Kategorie | Zusätzliche Felder | Werbe-Archetypen |
| --- | --- | --- |
| **Musik** | Künstler, Songtitel, Genre, Stimmung, Release, Streaming-Link, Audio, Cover, Lyrics, Songabschnitt, Rechtebestätigung | Release-Teaser, Lyric-Video, UGC-Promo, Story-Visualizer, „Out now“-Ad |
| **Website** | URL, Kernbotschaft, Vorteile, Ziel, CTA, importierte Inhalte | Problem→Seite→Ergebnis, 30-Sekunden-Tour, Einwand-Konter |
| **App** | App-Name, Plattformen, Problem, Features, Store-Link, Screenshots, Screenrecordings | Problem/Lösung, Feature-Demo, Mini-Tutorial, UGC-Skriptgerüst |
| **Mixing & Mastering** | Angebot, Genres, Leistungen, Preis, Bearbeitungszeit, Referenzen, Vorher/Nachher-Audio, Buchungslink | Vorher/Nachher, Studio-Showcase, Kundenreise Demo → Master |
| **Produkt / Dienstleistung / Event / Benutzerdefiniert** | jeweils eigene Felder | Problem·Versprechen·Beweis, 3 Gründe, Mini-Story |

---

## Environment-Variablen

Alle Werte sind optional – siehe `.env.example` für die vollständige,
kommentierte Liste. Die wichtigsten:

| Variable | Zweck | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Basis-URL der App | `http://localhost:3000` |
| `AUTH_SECRET` | Signatur der Demo-Session-Cookies | Entwicklungs-Fallback |
| `ADREEL_DATA_DIR` | Verzeichnis des lokalen Demo-Stores | `.adreel` |
| `ADREEL_FORCE_DEMO` | Demo-Modus erzwingen | – |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase-Projekt | – |
| `SUPABASE_SERVICE_ROLE_KEY` | Nur serverseitig, für Hintergrundjobs | – |
| `ADREEL_TEXT_PROVIDER` | `mock` \| `openai` \| `anthropic` | `mock` |
| `ADREEL_IMAGE_PROVIDER` | `mock` \| `openai` \| `replicate` | `mock` |
| `ADREEL_VIDEO_PROVIDER` | `mock` \| `replicate` | `mock` |
| `ADREEL_VOICE_PROVIDER` | `mock` \| `elevenlabs` | `mock` |
| `ADREEL_MUSIC_PROVIDER` | `mock` \| `library` | `mock` |
| `ADREEL_RENDER_PROVIDER` | `remotion` \| `mock` (nur Tests) | `remotion` |
| `ADREEL_STORAGE_PROVIDER` | `local` \| `supabase` | `local` |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`, `ELEVENLABS_API_KEY` | Zugangsdaten der Anbieter | – |
| `REMOTION_BROWSER_EXECUTABLE` | Pfad zu einem vorhandenen Chrome | – |
| `ADREEL_PROVIDER_TIMEOUT_MS` / `ADREEL_PROVIDER_MAX_RETRIES` | Timeout und Retries aller Adapter | `120000` / `2` |

**Keine dieser Variablen mit `NEXT_PUBLIC_` präfixen**, außer den beiden
Supabase-Werten, die dafür vorgesehen sind. API-Keys werden ausschließlich
serverseitig gelesen.

---

## Demo-Modus vs. Produktivmodus

Der Modus wird automatisch bestimmt: **ohne konfiguriertes Supabase-Projekt läuft
die App im Demo-Modus** (oder erzwungen mit `ADREEL_FORCE_DEMO=1`).

| | Demo-Modus | Produktivmodus |
| --- | --- | --- |
| Datenhaltung | JSON-Dateien unter `.adreel/db` | Supabase/PostgreSQL mit RLS |
| Auth | Signiertes Cookie, scrypt-Passwörter | Supabase Auth |
| Speicher | `.adreel/media`, ausgeliefert über `/api/media` | Supabase Storage mit signierten URLs |
| Texte/Konzepte | Deterministischer Composer aus deinen Eingaben | LLM deiner Wahl |
| Bilder/Clips | Prozedural erzeugte SVG-Visuals | Bildmodell deiner Wahl |
| Voice-over | Stille Tonspur mit exaktem Wort-Timing | ElevenLabs (echte Stimme) |
| Musik | Prozedural synthetisiertes, hörbares Musikbett | Eigene Bibliothek |
| Rendering | **echt** (Remotion) | **echt** (Remotion) |
| Kosten | keine | je nach Anbieter |

Was im Demo-Modus läuft, ist in der Oberfläche als „Demo“ gekennzeichnet, und
Exporte tragen ein `DEMO`-Wasserzeichen.

> **Ehrlich gesagt:** Das Demo-Voice-over ist eine *stille* Tonspur mit korrektem
> Timing. Untertitel, Szenenlängen und die Audiomischung stimmen dadurch exakt –
> gesprochen wird aber erst, wenn ein echter Voice-Provider konfiguriert ist.

---

## Echte KI-Provider anschließen

Kurzfassung – Details in [`docs/PROVIDERS.md`](docs/PROVIDERS.md):

```bash
# .env.local
ADREEL_TEXT_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

ADREEL_IMAGE_PROVIDER=replicate
REPLICATE_API_TOKEN=r8_...

ADREEL_VOICE_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=...
```

Damit die echten Provider greifen, muss die App den Produktivmodus verwenden
(Supabase konfiguriert oder `ADREEL_FORCE_DEMO` leer). Unter
**Einstellungen → KI-Anbieter** zeigt die App live, welcher Adapter aktiv und
erreichbar ist.

Jeder Adapter implementiert dasselbe Interface und bekommt Timeout,
Retry-mit-Backoff, Abbruch, Kostenmetadaten und redigiertes Logging
automatisch. Liefert ein Modell unbrauchbares JSON, fällt die
Konzeptgenerierung auf den deterministischen Composer zurück, statt den Job
scheitern zu lassen.

---

## Supabase einrichten

Die Migration ist idempotent – ein zweiter Lauf ist gefahrlos.

**Variante A: einmalig im SQL-Editor** (am schnellsten)

Inhalt von `supabase/migrations/20260101000000_init.sql` in den SQL-Editor des
Projekts einfügen und ausführen. Das legt alle 14 Tabellen, die RLS-Policies
und den privaten Storage-Bucket `adreel-media` an.

**Variante B: per CLI oder GitHub-Integration**

```bash
supabase link --project-ref <dein-project-ref>
supabase db push
```

Für die GitHub-Integration (Supabase → Settings → Integrations → GitHub) als
*Working directory* das Repo-Root eintragen (Feld leer lassen). `supabase/`
liegt dort, und `supabase/config.toml` ist vorhanden.

**Beispieldaten (optional, erst nach der ersten Registrierung)**

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

```bash
# 3. .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADREEL_STORAGE_PROVIDER=supabase
```

Die Migration legt alle Tabellen an, aktiviert Row Level Security auf jeder
davon und erstellt den privaten Storage-Bucket `adreel-media`.

---

## Skripte

| Befehl | Beschreibung |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm run start` | Produktionsbuild und -server |
| `npm run typecheck` | TypeScript ohne Emit |
| `npm run lint` | ESLint (Flat Config) |
| `npm test` | Unit- und Integrationstests (Vitest) |
| `npm run test:e2e` | End-to-End-Test inklusive echtem Render (Playwright) |
| `npm run seed` | Demo-Konto und drei Beispielprojekte anlegen |
| `npm run remotion:studio` | Remotion Studio für die Videokomposition |

---

## Tests

```bash
npm test          # 191 Tests: Unit + API-Integration
npm run test:e2e  # kompletter Demo-Workflow im Browser inkl. MP4-Download
```

- **Unit** – SSRF-Guard, Credit-Berechnung, Untertitel-Timing, Konzept-Composer
  und Szenen-Layout, Provider-Wrapper (Timeout, Retry, Abbruch), Video-Spec,
  Qualitätswarnungen, Upload-Validierung, Repository und JSON-Treiber.
- **Integration** – echte Route-Handler: Registrierung, Login, Projektanlage,
  Konzeptgenerierung, Konzeptauswahl, Medienerzeugung, Rendering, Credits,
  Workspace-Isolation, Pfad-Traversal, SSRF-Blockade, Upload-Ablehnung.
- **E2E** – Landingpage, Demo-Login, Musik-Projekt, drei Konzepte, Editor,
  Medien, Export; prüft, dass die heruntergeladene Datei ein echtes MP4 ist.

Der E2E-Lauf baut die App und rendert am Ende ein echtes Video. Auf Systemen,
auf denen bereits ein Browser installiert ist, lassen sich beide Downloads
vermeiden:

```bash
# Chrome für Remotion (Rendering)
export REMOTION_BROWSER_EXECUTABLE=/pfad/zu/chrome
# Chromium für Playwright (Testbrowser) – sonst genügt `npx playwright install`
export PLAYWRIGHT_CHROMIUM_EXECUTABLE=/pfad/zu/chromium

npm run test:e2e
```

---

## Projektstruktur

```
src/
├─ app/
│  ├─ (auth)/            Login und Registrierung
│  ├─ (app)/             Dashboard, Wizard, Konzepte, Editor, Export, …
│  ├─ api/               28 Route-Handler
│  ├─ legal/             Datenschutz und Nutzungsbedingungen
│  └─ page.tsx           Landingpage
├─ components/
│  ├─ ui/                Design-System (Button, Card, Dialog, …)
│  ├─ app/, editor/, wizard/, marketing/
├─ lib/
│  ├─ ai/                Provider-Interfaces, Adapter, Registry
│  ├─ api/               Fehler, Rate-Limits, Uploads, Route-Helfer
│  ├─ auth/              Session, Passwort-Hashing
│  ├─ concepts/          Composer, Layout, Prompt, Engine
│  ├─ credits/           Preistabelle und Schätzung
│  ├─ db/                Treiber-Abstraktion, JSON-Store, Supabase, Repository
│  ├─ jobs/              Runner, Pipelines, Credit-Reservierung
│  ├─ media/             Artwork- und WAV-Synthese
│  ├─ url-analysis/      SSRF-Guard, sicherer Fetch, HTML-Extraktion
│  └─ video/             Stile, Spec, Untertitel, Qualitätsprüfung
├─ remotion/             Videokomposition (Preview und Export teilen sie sich)
supabase/migrations/     SQL inklusive RLS-Policies
tests/                   unit / integration / e2e
docs/                    ARCHITECTURE.md, PROVIDERS.md
```

Eine ausführliche Beschreibung steht in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Sicherheit und Compliance

- **Serverseitige Authentifizierung** auf jeder Route; jede Repository-Methode
  filtert zusätzlich nach `workspaceId`, RLS ist die zweite Verteidigungslinie.
- **Row Level Security** auf allen 14 Tabellen und auf dem Storage-Bucket.
- **SSRF-Schutz** beim Website-Import: nur http/https, nur Port 80/443, DNS-
  Auflösung gegen eine Blockliste privater Bereiche (IPv4 und IPv6, inklusive
  IPv4-mapped, NAT64 und 6to4), manuelles Verfolgen von Weiterleitungen mit
  erneuter Prüfung jedes Hops, Größen- und Zeitlimit.
- **Upload-Validierung**: Allowlist aus MIME-Typ *und* Dateiendung,
  Größenlimits pro Asset-Art, bereinigte Dateinamen.
- **Uploads liegen außerhalb von `public/`** und werden nur über eine
  authentifizierte Route mit Pfadprüfung und `nosniff` ausgeliefert.
- **Rate Limits** auf Login, Registrierung, Uploads und alle Generierungen.
- **Keine API-Keys im Client**, keine Prompts und keine Secrets im Log – nur
  Länge und ein kurzer, redigierter Anfang.
- **Löschung**: Projekte und Assets entfernen auch die gespeicherten Dateien.
- **Rechtebestätigung** für hochgeladenes Audio ist Pflicht (Kategorie Musik).
- **Kennzeichnung**: KI-/Demo-Inhalte sind in der Oberfläche markiert, Exporte
  tragen ein Wasserzeichen.
- **Keine erfundenen Belege**: Der Prompt untersagt ausdrücklich erfundene
  Kundenstimmen, Bewertungen, Auszeichnungen und Erfolgszahlen. Das
  UGC-Testimonial-Format liefert nur ein Skript-Gerüst mit markierten
  Platzhaltern.

---

## Offene nächste Schritte

1. **Zahlungsanbieter anbinden** – Tarife und Credits sind vorbereitet, Checkout
   und Webhooks fehlen.
2. **Echte Website-Screenshots** – aktuell werden Titel, Beschreibung,
   Überschriften, Vorteile und CTA extrahiert; ein Screenshot-Service
   (Playwright in einer Sandbox) würde die Website-Formate deutlich stärker machen.
3. **Verteilte Job-Queue** – der Runner läuft in-process. Für mehrere Instanzen
   sollte `startJob` gegen Inngest, QStash oder pg-boss getauscht werden; die
   Pipelines bleiben unverändert.
4. **Rendering auslagern** – Remotion Lambda oder ein Render-Worker, damit lange
   Exporte nicht am Web-Prozess hängen.
5. **DNS-Rebinding schließen** – zwischen Prüfung und Verbindungsaufbau bleibt
   ein kleines Zeitfenster; ein Agent, der die geprüfte IP beim Connect
   festnagelt, würde es beseitigen.
6. **Team-Workspaces** – `is_workspace_member()` in der Migration ist die eine
   Stelle, an der Mitgliedschaften ergänzt werden.
7. **Mehrsprachigkeit des Demo-Generators** – der Composer beherrscht Deutsch
   und Englisch; andere Sprachen brauchen aktuell einen echten LLM-Provider.
8. **Rate Limits über Redis** – aktuell in-memory und damit pro Instanz.
