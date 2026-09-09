"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AssetUploader } from "@/components/wizard/asset-uploader";
import { ListInput } from "@/components/wizard/list-input";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/switch";
import { apiSend, errorMessage } from "@/lib/client/api";
import type { ProjectBrief } from "@/lib/domain/schemas";

type Details = ProjectBrief["details"];

export interface CategoryFieldsProps {
  brief: ProjectBrief;
  onDetails: (patch: Partial<Details>) => void;
  errors: Record<string, string>;
}

const AUDIO_ACCEPT = "audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac";
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const MEDIA_ACCEPT = `${IMAGE_ACCEPT},video/mp4,video/quicktime,video/webm`;

/**
 * Renders the fields that only exist for one category. Everything is driven by
 * the discriminated union, so adding a category means adding one branch here.
 */
export function CategoryFields({ brief, onDetails, errors }: CategoryFieldsProps) {
  switch (brief.category) {
    case "music":
      return <MusicFields details={brief.details} onDetails={onDetails} errors={errors} />;
    case "website":
      return <WebsiteFields details={brief.details} onDetails={onDetails} errors={errors} />;
    case "app":
      return <AppFields details={brief.details} onDetails={onDetails} errors={errors} />;
    case "mixing_mastering":
      return <MixingFields details={brief.details} onDetails={onDetails} errors={errors} />;
    case "product":
      return <ProductFields details={brief.details} onDetails={onDetails} errors={errors} />;
    case "service":
      return <ServiceFields details={brief.details} onDetails={onDetails} errors={errors} />;
    case "event":
      return <EventFields details={brief.details} onDetails={onDetails} errors={errors} />;
    case "custom":
      return <CustomFields details={brief.details} onDetails={onDetails} errors={errors} />;
  }
}

type Branch<K extends ProjectBrief["category"]> = {
  details: Extract<ProjectBrief, { category: K }>["details"];
  onDetails: (patch: Partial<Details>) => void;
  errors: Record<string, string>;
};

function MusicFields({ details, onDetails, errors }: Branch<"music">) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Künstlername" htmlFor="artistName" required error={errors["details.artistName"]}>
          <Input
            id="artistName"
            value={details.artistName}
            onChange={(event) => onDetails({ artistName: event.target.value })}
            placeholder="NOVA"
          />
        </Field>
        <Field label="Songtitel" htmlFor="songTitle" required error={errors["details.songTitle"]}>
          <Input
            id="songTitle"
            value={details.songTitle}
            onChange={(event) => onDetails({ songTitle: event.target.value })}
            placeholder="Midnight Drive"
          />
        </Field>
        <Field label="Genre" htmlFor="genre">
          <Input
            id="genre"
            value={details.genre}
            onChange={(event) => onDetails({ genre: event.target.value })}
            placeholder="Synthwave"
          />
        </Field>
        <Field label="Stimmung" htmlFor="mood">
          <Input
            id="mood"
            value={details.mood}
            onChange={(event) => onDetails({ mood: event.target.value })}
            placeholder="nachdenklich, treibend"
          />
        </Field>
        <Field label="Veröffentlichungsdatum" htmlFor="releaseDate">
          <Input
            id="releaseDate"
            value={details.releaseDate}
            onChange={(event) => onDetails({ releaseDate: event.target.value })}
            placeholder="14. März"
          />
        </Field>
        <Field label="Streaming-Link" htmlFor="streamingUrl" error={errors["details.streamingUrl"]}>
          <Input
            id="streamingUrl"
            type="url"
            value={details.streamingUrl}
            onChange={(event) => onDetails({ streamingUrl: event.target.value })}
            placeholder="https://open.spotify.com/…"
          />
        </Field>
      </div>

      <Field label="Lyrics oder Textausschnitt" htmlFor="lyrics" hint="Die stärksten Zeilen genügen – sie werden für Lyric-Formate verwendet.">
        <Textarea
          id="lyrics"
          value={details.lyricsExcerpt}
          onChange={(event) => onDetails({ lyricsExcerpt: event.target.value })}
          placeholder={"Ich fahr durch die Nacht\nund die Stadt schläft schon"}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <AssetUploader
          label="Cover"
          kind="cover"
          accept={IMAGE_ACCEPT}
          value={details.coverAssetId ? [details.coverAssetId] : []}
          onChange={(ids) => onDetails({ coverAssetId: ids[0] ?? null })}
          hint="PNG, JPG oder WebP. Wird als Szenen-Hintergrund verwendet."
        />
        <AssetUploader
          label="Audio (optional)"
          kind="audio"
          accept={AUDIO_ACCEPT}
          value={details.audioAssetId ? [details.audioAssetId] : []}
          onChange={(ids) => onDetails({ audioAssetId: ids[0] ?? null })}
          hint="MP3, WAV, M4A. Max. 100 MB."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Songabschnitt ab (Sekunde)" htmlFor="sectionStart">
          <Input
            id="sectionStart"
            type="number"
            min={0}
            value={details.songSectionStart}
            onChange={(event) => onDetails({ songSectionStart: Number(event.target.value) })}
          />
        </Field>
        <Field label="Songabschnitt bis (Sekunde)" htmlFor="sectionEnd">
          <Input
            id="sectionEnd"
            type="number"
            min={0}
            value={details.songSectionEnd}
            onChange={(event) => onDetails({ songSectionEnd: Number(event.target.value) })}
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-850 p-3">
        <Checkbox
          checked={details.rightsConfirmed}
          onCheckedChange={(checked) => onDetails({ rightsConfirmed: checked === true })}
          aria-label="Rechte bestätigen"
        />
        <span className="text-sm text-chalk-dim">
          Ich bestätige, dass ich alle erforderlichen Rechte am hochgeladenen Audio und Cover
          besitze und diese für Werbevideos verwenden darf.
          {errors["details.rightsConfirmed"] ? (
            <span className="mt-1 block text-danger">{errors["details.rightsConfirmed"]}</span>
          ) : null}
        </span>
      </label>
    </>
  );
}

function WebsiteFields({ details, onDetails, errors }: Branch<"website">) {
  const [importing, setImporting] = React.useState(false);

  async function onImport() {
    if (!details.url) {
      toast.error("Bitte zuerst eine URL eingeben.");
      return;
    }
    setImporting(true);
    try {
      const result = await apiSend<{
        extracted: {
          title: string;
          description: string;
          headings: string[];
          benefits: string[];
          ctas: string[];
        };
      }>("/api/website-import", "POST", { url: details.url });

      onDetails({
        importedTitle: result.extracted.title,
        importedDescription: result.extracted.description,
        importedHeadings: result.extracted.headings,
        coreMessage: details.coreMessage || result.extracted.headings[0] || result.extracted.title,
        benefits: details.benefits.length > 0 ? details.benefits : result.extracted.benefits,
        desiredCta: details.desiredCta || result.extracted.ctas[0] || "",
        importReviewed: false,
      });
      toast.success("Inhalte übernommen. Bitte alles prüfen und anpassen.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Field
        label="URL"
        htmlFor="siteUrl"
        required
        error={errors["details.url"]}
        hint="Nur öffentlich erreichbare Seiten. Interne und lokale Adressen werden blockiert."
      >
        <div className="flex gap-2">
          <Input
            id="siteUrl"
            type="url"
            value={details.url}
            onChange={(event) => onDetails({ url: event.target.value })}
            placeholder="https://deine-seite.de"
          />
          <Button type="button" variant="secondary" onClick={onImport} disabled={importing}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Analysieren
          </Button>
        </div>
      </Field>

      {details.importedTitle || details.importedDescription ? (
        <div className="space-y-3 rounded-xl border border-electric/35 bg-electric/5 p-4">
          <p className="text-xs text-electric">
            Automatisch von der Seite übernommen – bitte prüfen und bei Bedarf korrigieren.
          </p>
          <Field label="Erkannter Seitentitel" htmlFor="importedTitle">
            <Input
              id="importedTitle"
              value={details.importedTitle}
              onChange={(event) => onDetails({ importedTitle: event.target.value })}
            />
          </Field>
          <Field label="Erkannte Beschreibung" htmlFor="importedDescription">
            <Textarea
              id="importedDescription"
              value={details.importedDescription}
              onChange={(event) => onDetails({ importedDescription: event.target.value })}
            />
          </Field>
          <label className="flex items-start gap-3">
            <Checkbox
              checked={details.importReviewed}
              onCheckedChange={(checked) => onDetails({ importReviewed: checked === true })}
              aria-label="Übernommene Inhalte geprüft"
            />
            <span className="text-sm text-chalk-dim">
              Ich habe die übernommenen Inhalte geprüft.
            </span>
          </label>
        </div>
      ) : null}

      <Field label="Kernbotschaft" htmlFor="coreMessage">
        <Input
          id="coreMessage"
          value={details.coreMessage}
          onChange={(event) => onDetails({ coreMessage: event.target.value })}
          placeholder="Buchhaltung, die sich selbst sortiert."
        />
      </Field>

      <ListInput
        label="Wichtigste Vorteile"
        placeholder="Spart 4 Stunden pro Woche"
        value={details.benefits}
        onChange={(benefits) => onDetails({ benefits })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ziel der Website" htmlFor="siteGoal">
          <Input
            id="siteGoal"
            value={details.siteGoal}
            onChange={(event) => onDetails({ siteGoal: event.target.value })}
            placeholder="Demo-Termine buchen"
          />
        </Field>
        <Field label="Gewünschter CTA" htmlFor="desiredCta">
          <Input
            id="desiredCta"
            value={details.desiredCta}
            onChange={(event) => onDetails({ desiredCta: event.target.value })}
            placeholder="Kostenlos testen"
          />
        </Field>
      </div>
    </>
  );
}

function AppFields({ details, onDetails, errors }: Branch<"app">) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="App-Name" htmlFor="appName" required error={errors["details.appName"]}>
          <Input
            id="appName"
            value={details.appName}
            onChange={(event) => onDetails({ appName: event.target.value })}
          />
        </Field>
        <Field label="Store- oder Website-Link" htmlFor="storeUrl" error={errors["details.storeUrl"]}>
          <Input
            id="storeUrl"
            type="url"
            value={details.storeUrl}
            onChange={(event) => onDetails({ storeUrl: event.target.value })}
            placeholder="https://apps.apple.com/…"
          />
        </Field>
      </div>

      <Field label="Plattformen" htmlFor="platforms" hint="Mehrere durch Komma trennen.">
        <Input
          id="platforms"
          value={details.platforms.join(", ")}
          onChange={(event) =>
            onDetails({
              platforms: event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean),
            })
          }
          placeholder="iOS, Android, Web"
        />
      </Field>

      <Field label="Welches Problem löst die App?" htmlFor="problemSolved">
        <Textarea
          id="problemSolved"
          value={details.problemSolved}
          onChange={(event) => onDetails({ problemSolved: event.target.value })}
        />
      </Field>

      <ListInput
        label="Wichtigste Features"
        placeholder="Belege automatisch zuordnen"
        value={details.features}
        onChange={(features) => onDetails({ features })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <AssetUploader
          label="Screenshots"
          kind="screenshot"
          accept={IMAGE_ACCEPT}
          multiple
          value={details.screenshotAssetIds}
          onChange={(ids) => onDetails({ screenshotAssetIds: ids })}
        />
        <AssetUploader
          label="Screenrecordings"
          kind="video"
          accept="video/mp4,video/quicktime,video/webm"
          multiple
          value={details.screenRecordingAssetIds}
          onChange={(ids) => onDetails({ screenRecordingAssetIds: ids })}
        />
      </div>
    </>
  );
}

function MixingFields({ details, onDetails, errors }: Branch<"mixing_mastering">) {
  return (
    <>
      <Field label="Angebotsname" htmlFor="offerName" required error={errors["details.offerName"]}>
        <Input
          id="offerName"
          value={details.offerName}
          onChange={(event) => onDetails({ offerName: event.target.value })}
          placeholder="Full Mix & Master"
        />
      </Field>

      <ListInput
        label="Genres"
        placeholder="Hip-Hop"
        value={details.genres}
        onChange={(genres) => onDetails({ genres })}
      />
      <ListInput
        label="Leistungen"
        placeholder="Stem-Mixing inkl. 2 Revisionen"
        value={details.services}
        onChange={(services) => onDetails({ services })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preis" htmlFor="price">
          <Input
            id="price"
            value={details.price}
            onChange={(event) => onDetails({ price: event.target.value })}
            placeholder="ab 149 €"
            disabled={details.priceOnRequest}
          />
        </Field>
        <Field label="Bearbeitungszeit" htmlFor="turnaround">
          <Input
            id="turnaround"
            value={details.turnaround}
            onChange={(event) => onDetails({ turnaround: event.target.value })}
            placeholder="3–5 Werktage"
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm text-chalk-dim">
        <Checkbox
          checked={details.priceOnRequest}
          onCheckedChange={(checked) => onDetails({ priceOnRequest: checked === true })}
          aria-label="Preis auf Anfrage"
        />
        Preis auf Anfrage
      </label>

      <ListInput
        label="Referenzen"
        placeholder="Album „Nachtluft“ – 2025"
        value={details.references}
        onChange={(references) => onDetails({ references })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <AssetUploader
          label="Vorher-Audio"
          kind="audio"
          accept={AUDIO_ACCEPT}
          value={details.beforeAudioAssetId ? [details.beforeAudioAssetId] : []}
          onChange={(ids) => onDetails({ beforeAudioAssetId: ids[0] ?? null })}
        />
        <AssetUploader
          label="Nachher-Audio"
          kind="audio"
          accept={AUDIO_ACCEPT}
          value={details.afterAudioAssetId ? [details.afterAudioAssetId] : []}
          onChange={(ids) => onDetails({ afterAudioAssetId: ids[0] ?? null })}
        />
      </div>

      <Field label="Kontakt- oder Buchungslink" htmlFor="bookingUrl" error={errors["details.bookingUrl"]}>
        <Input
          id="bookingUrl"
          type="url"
          value={details.bookingUrl}
          onChange={(event) => onDetails({ bookingUrl: event.target.value })}
        />
      </Field>
    </>
  );
}

function ProductFields({ details, onDetails, errors }: Branch<"product">) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Produktname" htmlFor="productName" required error={errors["details.productName"]}>
          <Input
            id="productName"
            value={details.productName}
            onChange={(event) => onDetails({ productName: event.target.value })}
          />
        </Field>
        <Field label="Preis" htmlFor="productPrice">
          <Input
            id="productPrice"
            value={details.price}
            onChange={(event) => onDetails({ price: event.target.value })}
            placeholder="79 €"
          />
        </Field>
      </div>
      <ListInput
        label="Wichtigste Vorteile"
        value={details.keyBenefits}
        onChange={(keyBenefits) => onDetails({ keyBenefits })}
      />
      <Field label="Alleinstellungsmerkmal" htmlFor="usp">
        <Input
          id="usp"
          value={details.usp}
          onChange={(event) => onDetails({ usp: event.target.value })}
        />
      </Field>
      <Field label="Shop-Link" htmlFor="shopUrl" error={errors["details.shopUrl"]}>
        <Input
          id="shopUrl"
          type="url"
          value={details.shopUrl}
          onChange={(event) => onDetails({ shopUrl: event.target.value })}
        />
      </Field>
    </>
  );
}

function ServiceFields({ details, onDetails, errors }: Branch<"service">) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name der Dienstleistung" htmlFor="serviceName" required error={errors["details.serviceName"]}>
          <Input
            id="serviceName"
            value={details.serviceName}
            onChange={(event) => onDetails({ serviceName: event.target.value })}
          />
        </Field>
        <Field label="Einsatzgebiet" htmlFor="serviceArea">
          <Input
            id="serviceArea"
            value={details.serviceArea}
            onChange={(event) => onDetails({ serviceArea: event.target.value })}
            placeholder="Berlin und Umgebung"
          />
        </Field>
      </div>
      <Field label="Welches Problem löst du?" htmlFor="serviceProblem">
        <Textarea
          id="serviceProblem"
          value={details.problemSolved}
          onChange={(event) => onDetails({ problemSolved: event.target.value })}
        />
      </Field>
      <ListInput
        label="Was ist enthalten?"
        value={details.deliverables}
        onChange={(deliverables) => onDetails({ deliverables })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preis" htmlFor="servicePrice">
          <Input
            id="servicePrice"
            value={details.price}
            onChange={(event) => onDetails({ price: event.target.value })}
          />
        </Field>
        <Field label="Buchungslink" htmlFor="serviceBookingUrl" error={errors["details.bookingUrl"]}>
          <Input
            id="serviceBookingUrl"
            type="url"
            value={details.bookingUrl}
            onChange={(event) => onDetails({ bookingUrl: event.target.value })}
          />
        </Field>
      </div>
    </>
  );
}

function EventFields({ details, onDetails, errors }: Branch<"event">) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eventname" htmlFor="eventName" required error={errors["details.eventName"]}>
          <Input
            id="eventName"
            value={details.eventName}
            onChange={(event) => onDetails({ eventName: event.target.value })}
          />
        </Field>
        <Field label="Datum" htmlFor="eventDate">
          <Input
            id="eventDate"
            value={details.eventDate}
            onChange={(event) => onDetails({ eventDate: event.target.value })}
            placeholder="27. Juni 2026"
          />
        </Field>
        <Field label="Location" htmlFor="venue">
          <Input
            id="venue"
            value={details.venue}
            onChange={(event) => onDetails({ venue: event.target.value })}
          />
        </Field>
        <Field label="Ticketpreis" htmlFor="ticketPrice">
          <Input
            id="ticketPrice"
            value={details.ticketPrice}
            onChange={(event) => onDetails({ ticketPrice: event.target.value })}
          />
        </Field>
      </div>
      <ListInput
        label="Line-up"
        value={details.lineup}
        onChange={(lineup) => onDetails({ lineup })}
      />
      <Field label="Ticket-Link" htmlFor="ticketUrl" error={errors["details.ticketUrl"]}>
        <Input
          id="ticketUrl"
          type="url"
          value={details.ticketUrl}
          onChange={(event) => onDetails({ ticketUrl: event.target.value })}
        />
      </Field>
    </>
  );
}

function CustomFields({ details, onDetails, errors }: Branch<"custom">) {
  return (
    <>
      <Field label="Wie heißt dein Angebot?" htmlFor="customOfferName" required error={errors["details.offerName"]}>
        <Input
          id="customOfferName"
          value={details.offerName}
          onChange={(event) => onDetails({ offerName: event.target.value })}
        />
      </Field>
      <ListInput
        label="Highlights"
        value={details.highlights}
        onChange={(highlights) => onDetails({ highlights })}
      />
      <ListInput
        label="Belegbare Fakten"
        hint="Nur Dinge, die du belegen kannst – AdReel erfindet keine Zahlen."
        value={details.proofPoints}
        onChange={(proofPoints) => onDetails({ proofPoints })}
      />
    </>
  );
}

export { MEDIA_ACCEPT, IMAGE_ACCEPT };
