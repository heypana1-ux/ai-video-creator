import { hashString } from "@/lib/media/artwork";
import type { ProjectBrief } from "@/lib/domain/schemas";
import type { Tone } from "@/lib/domain/enums";

import type { BeatDraft, ConceptDraft } from "./draft-schema";

/**
 * Deterministic concept composer.
 *
 * This is the "creative brain" of the demo mode: it produces the same
 * structured output a real LLM is asked for, but built from templates that are
 * filled with the *user's actual input* (artist, song, features, price, ...) so
 * the concepts read as specific rather than generic marketing filler.
 *
 * It is also the fallback whenever a configured LLM is unreachable or returns
 * something that fails validation.
 */

type Lang = "de" | "en";

interface Ctx {
  brief: ProjectBrief;
  lang: Lang;
  /** `L(de, en)` picks the copy for the active language. */
  L: (de: string, en: string) => string;
  /** The thing being advertised, e.g. the song title or the app name. */
  subject: string;
  cta: string;
  audience: string;
  toneWord: string;
  /** Deterministic pseudo random in 0..1 from a label. */
  rnd: (label: string) => number;
}

const TONE_WORDS_DE: Record<Tone, string> = {
  professional: "sachlich und kompetent",
  emotional: "warm und persönlich",
  luxurious: "hochwertig und zurückhaltend",
  aggressive: "direkt und fordernd",
  humorous: "locker und pointiert",
  futuristic: "technisch und vorwärtsgerichtet",
  minimalistic: "reduziert und klar",
  ugc: "wie von einem echten Creator gefilmt",
};

const TONE_WORDS_EN: Record<Tone, string> = {
  professional: "matter-of-fact and competent",
  emotional: "warm and personal",
  luxurious: "premium and restrained",
  aggressive: "direct and demanding",
  humorous: "light and punchy",
  futuristic: "technical and forward-looking",
  minimalistic: "reduced and clear",
  ugc: "shot like a real creator would",
};

function buildContext(brief: ProjectBrief): Ctx {
  const lang: Lang = brief.language === "de" ? "de" : "en";
  const L = (de: string, en: string) => (lang === "de" ? de : en);
  const seedBase = hashString(`${brief.name}|${brief.category}|${brief.tone}`);
  const rnd = (label: string) => (hashString(`${seedBase}:${label}`) % 10_000) / 10_000;

  return {
    brief,
    lang,
    L,
    subject: subjectOf(brief),
    cta: ctaOf(brief, L),
    audience:
      brief.audience.trim() ||
      L("Menschen, die zu diesem Angebot passen", "people this offer is made for"),
    toneWord: lang === "de" ? TONE_WORDS_DE[brief.tone] : TONE_WORDS_EN[brief.tone],
    rnd,
  };
}

function subjectOf(brief: ProjectBrief): string {
  switch (brief.category) {
    case "music":
      return brief.details.songTitle || brief.name;
    case "app":
      return brief.details.appName || brief.name;
    case "mixing_mastering":
      return brief.details.offerName || brief.name;
    case "product":
      return brief.details.productName || brief.name;
    case "service":
      return brief.details.serviceName || brief.name;
    case "event":
      return brief.details.eventName || brief.name;
    case "website":
      return brief.details.importedTitle || hostOf(brief.details.url) || brief.name;
    case "custom":
      return brief.details.offerName || brief.name;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function ctaOf(brief: ProjectBrief, L: (de: string, en: string) => string): string {
  if (brief.callToAction.trim()) return brief.callToAction.trim();
  switch (brief.category) {
    case "music":
      return L("Jetzt überall streamen", "Stream it everywhere now");
    case "website":
      return L("Jetzt ansehen", "Take a look");
    case "app":
      return L("Kostenlos ausprobieren", "Try it for free");
    case "mixing_mastering":
      return L("Jetzt Slot sichern", "Book your slot");
    case "product":
      return L("Jetzt sichern", "Get yours");
    case "service":
      return L("Jetzt anfragen", "Get in touch");
    case "event":
      return L("Tickets sichern", "Grab tickets");
    case "custom":
      return L("Mehr erfahren", "Learn more");
  }
}

/** Trims free text to a punchy on-screen line. */
function short(text: string, max = 44): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function firstSentence(text: string, fallback: string): string {
  const match = text.replace(/\s+/g, " ").trim().match(/^(.{10,180}?[.!?])(\s|$)/);
  return (match?.[1] ?? (text.replace(/\s+/g, " ").trim() || fallback)).trim();
}

function listOr(items: string[], fallback: string[]): string[] {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : fallback;
}

function beat(input: Partial<BeatDraft> & Pick<BeatDraft, "role" | "title" | "visual" | "mediaPrompt">): BeatDraft {
  return {
    priority: 2,
    weight: 1,
    text: "",
    subline: "",
    voiceover: "",
    sourceKind: "ai_image_motion",
    assetHint: "none",
    soundNote: "",
    ...input,
    // A blank title would break the draft contract; fields fed from optional
    // user input (an app name, an offer name) can legitimately be empty.
    title: input.title.trim() || input.role,
  };
}

/* -------------------------------------------------------------------------- */
/* Hashtags                                                                   */
/* -------------------------------------------------------------------------- */

function slugTag(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return slug ? `#${slug.slice(0, 28)}` : "";
}

function hashtagsFor(ctx: Ctx, extra: string[]): string[] {
  const { brief } = ctx;
  const base: Record<string, string[]> = {
    music: ["#newmusic", "#newrelease", "#outnow", "#indieartist"],
    website: ["#webdesign", "#landingpage", "#onlinebusiness"],
    app: ["#appdemo", "#productivity", "#newapp", "#techtok"],
    mixing_mastering: ["#mixingengineer", "#mastering", "#homestudio", "#musicproduction"],
    product: ["#produkttest", "#shopping", "#musthave"],
    service: ["#dienstleistung", "#service", "#smallbusiness"],
    event: ["#event", "#tickets", "#nightlife"],
    custom: ["#angebot", "#promo"],
  };
  const platformTag =
    brief.platform === "instagram_reels"
      ? "#reels"
      : brief.platform === "youtube_shorts"
        ? "#shorts"
        : "#fyp";

  return [
    ...new Set(
      [platformTag, ...(base[brief.category] ?? []), ...extra.map(slugTag)].filter(Boolean),
    ),
  ].slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Archetypes                                                                 */
/* -------------------------------------------------------------------------- */

interface Archetype {
  id: string;
  /** Tones this archetype is a natural fit for; used for ranking. */
  favouredTones: Tone[];
  build: (ctx: Ctx) => ConceptDraft;
}

/* ------------------------------- music ----------------------------------- */

function musicArchetypes(): Archetype[] {
  return [
    {
      id: "release_teaser",
      favouredTones: ["aggressive", "futuristic", "professional"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "music" }>).details;
        const when = d.releaseDate.trim();
        const dateLine = when
          ? ctx.L(`${when} überall verfügbar`, `Everywhere ${when}`)
          : ctx.L("Jetzt überall verfügbar", "Out everywhere now");
        return {
          title: ctx.L(`Release-Teaser: „${ctx.subject}“`, `Release teaser: "${ctx.subject}"`),
          bigIdea: ctx.L(
            `Ein harter 2-Sekunden-Einstieg auf den Drop von „${ctx.subject}“, danach Cover, Artist-Name und Release-Datum in schneller Folge. Kein Storytelling, reine Aufmerksamkeit.`,
            `A hard two second open on the drop of "${ctx.subject}", then cover, artist name and release date in quick succession. No storytelling, pure attention.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(
            `Dieser Part von „${ctx.subject}“ geht nicht mehr aus dem Kopf.`,
            `This part of "${ctx.subject}" will not leave your head.`,
          ),
          callToAction: ctx.cta,
          caption: ctx.L(
            `„${ctx.subject}“ von ${d.artistName} – ${dateLine}. ${ctx.cta}`,
            `"${ctx.subject}" by ${d.artistName} – ${dateLine}. ${ctx.cta}`,
          ),
          hashtags: hashtagsFor(ctx, [d.genre, d.artistName, ctx.subject]),
          rationale: ctx.L(
            `Release-Teaser funktionieren, weil sie den stärksten Songabschnitt (${d.songSectionStart}–${d.songSectionEnd} s) sofort spielen. Der Feed-Nutzer entscheidet in unter zwei Sekunden – deshalb steht hier der Sound vor jeder Information.`,
            `Release teasers work because they play the strongest section (${d.songSectionStart}-${d.songSectionEnd}s) immediately. Viewers decide in under two seconds, so sound comes before information.`,
          ),
          musicNote: ctx.L(
            `Ausschnitt ${d.songSectionStart}–${d.songSectionEnd} s des Originaltracks, voll ausgesteuert, Voice-over nur in den Pausen.`,
            `Use ${d.songSectionStart}-${d.songSectionEnd}s of the original track at full level, voice-over only in the gaps.`,
          ),
          styleId: "music_visualizer",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1.1,
              title: ctx.L("Drop-Einstieg", "Drop open"),
              text: short(ctx.L("Ton an.", "Sound on.")),
              subline: `${d.artistName} – ${ctx.subject}`,
              voiceover: "",
              visual: ctx.L(
                "Cover pulsiert im Takt, harter Blitz auf den ersten Beat.",
                "Cover pulses on the beat, hard flash on beat one.",
              ),
              mediaPrompt: `Abstract ${d.genre || "music"} visual, ${d.mood || "moody"} atmosphere, pulsing light, vertical 9:16`,
              assetHint: "cover",
              sourceKind: "user_upload",
              soundNote: ctx.L("Song startet auf Frame 1.", "Song starts on frame 1."),
            }),
            beat({
              role: "showcase",
              priority: 1,
              weight: 1.2,
              title: ctx.L("Hook-Zeile", "Hook line"),
              text: short(d.lyricsExcerpt || ctx.subject, 40),
              subline: d.genre ? `${d.genre}` : "",
              voiceover: "",
              visual: ctx.L(
                "Lyric-Zeile erscheint Wort für Wort über dem Cover.",
                "Lyric line appears word by word over the cover.",
              ),
              mediaPrompt: `${d.mood || "atmospheric"} ${d.genre || "music"} scene, grain, deep contrast, vertical`,
              assetHint: "cover",
            }),
            beat({
              role: "context",
              priority: 3,
              weight: 0.9,
              title: ctx.L("Artist", "Artist"),
              text: d.artistName,
              subline: ctx.L("neue Single", "new single"),
              voiceover: ctx.L(
                `${d.artistName} – „${ctx.subject}“.`,
                `${d.artistName} – "${ctx.subject}".`,
              ),
              visual: ctx.L("Artist-Name groß, Cover fährt nach hinten.", "Artist name large, cover pushes back."),
              mediaPrompt: `Portrait style abstract backdrop for ${d.genre || "music"} artist, vertical`,
            }),
            beat({
              role: "offer",
              priority: 2,
              weight: 1,
              title: ctx.L("Release-Datum", "Release date"),
              text: short(dateLine),
              subline: d.streamingUrl ? ctx.L("Link in der Bio", "Link in bio") : "",
              voiceover: dateLine,
              visual: ctx.L("Datum als Stempel über dem Cover.", "Date stamped over the cover."),
              mediaPrompt: `Cover art frame with light streaks, ${d.mood || "energetic"}, vertical`,
              assetHint: "cover",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 34),
              subline: d.streamingUrl ? hostOf(d.streamingUrl) : "",
              voiceover: ctx.cta,
              visual: ctx.L("CTA-Button pulsiert, Cover bleibt im Hintergrund.", "CTA button pulses, cover stays behind."),
              mediaPrompt: `Bold gradient end card, ${d.mood || "energetic"}, vertical`,
              assetHint: "cover",
            }),
          ],
        };
      },
    },
    {
      id: "lyric_video",
      favouredTones: ["emotional", "minimalistic", "professional"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "music" }>).details;
        const lines = listOr(
          d.lyricsExcerpt.split(/\n|(?<=[.!?])\s+/).map((line) => line.trim()),
          [ctx.subject, d.artistName, ctx.cta],
        ).slice(0, 4);
        return {
          title: ctx.L(`Lyric-Video: „${ctx.subject}“`, `Lyric video: "${ctx.subject}"`),
          bigIdea: ctx.L(
            `Die stärksten Zeilen aus „${ctx.subject}“ erscheinen im Takt. Keine Ablenkung, nur Typografie über einem ruhigen Hintergrund – gebaut zum Mitlesen und Mitsingen.`,
            `The strongest lines from "${ctx.subject}" appear on beat. No distractions, just typography over a calm backdrop - made for reading and singing along.`,
          ),
          audience: ctx.audience,
          hook: short(lines[0] ?? ctx.subject, 60),
          callToAction: ctx.cta,
          caption: ctx.L(
            `Diese Zeile aus „${ctx.subject}“ trifft. 🎧 ${d.artistName} – ${ctx.cta}`,
            `This line from "${ctx.subject}" hits. 🎧 ${d.artistName} – ${ctx.cta}`,
          ),
          hashtags: hashtagsFor(ctx, [d.genre, "lyrics", d.artistName]),
          rationale: ctx.L(
            "Lyric-Videos halten Zuschauer länger, weil Lesen und Hören gleichzeitig passieren. Sie sind außerdem stumm konsumierbar – ein großer Teil der Feed-Nutzer startet ohne Ton.",
            "Lyric videos hold attention because reading and listening happen at once. They also work muted, and a large share of feed users start without sound.",
          ),
          musicNote: ctx.L(
            "Originaltrack durchgehend, Voice-over aus, Untertitel folgen exakt dem Gesang.",
            "Original track throughout, no voice-over, subtitles follow the vocal exactly.",
          ),
          styleId: "minimal_typography",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1,
              title: ctx.L("Zeile 1", "Line 1"),
              text: short(lines[0] ?? ctx.subject, 48),
              voiceover: "",
              visual: ctx.L("Text erscheint Wort für Wort, Hintergrund atmet.", "Text appears word by word, background breathes."),
              mediaPrompt: `Soft ${d.mood || "melancholic"} gradient backdrop, film grain, vertical 9:16`,
            }),
            ...lines.slice(1).map((linePart, index) =>
              beat({
                role: "showcase",
                priority: index === 0 ? 1 : 3,
                weight: 1,
                title: ctx.L(`Zeile ${index + 2}`, `Line ${index + 2}`),
                text: short(linePart, 48),
                voiceover: "",
                visual: ctx.L("Nächste Zeile blendet ein, vorherige verblasst.", "Next line fades in, previous fades out."),
                mediaPrompt: `Minimal ${d.mood || "moody"} texture, slow drift, vertical 9:16`,
              }),
            ),
            beat({
              role: "offer",
              priority: 2,
              weight: 0.9,
              title: ctx.L("Track-Info", "Track info"),
              text: `${d.artistName}`,
              subline: ctx.subject,
              voiceover: "",
              visual: ctx.L("Cover fährt sanft ins Bild.", "Cover eases into frame."),
              mediaPrompt: "Cover art on soft dark background, subtle glow, vertical",
              assetHint: "cover",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.8,
              title: "CTA",
              text: short(ctx.cta, 34),
              subline: d.streamingUrl ? hostOf(d.streamingUrl) : "",
              voiceover: "",
              visual: ctx.L("CTA erscheint zentriert.", "CTA appears centred."),
              mediaPrompt: "Clean end card, minimal typography, vertical",
            }),
          ],
        };
      },
    },
    {
      id: "ugc_promo",
      favouredTones: ["ugc", "humorous", "emotional"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "music" }>).details;
        return {
          title: ctx.L(`UGC-Promo: „${ctx.subject}“ empfehlen`, `UGC promo: recommending "${ctx.subject}"`),
          bigIdea: ctx.L(
            `Aufbau wie eine private Empfehlung: jemand erzählt, wie er auf „${ctx.subject}“ gestoßen ist, statt den Song zu bewerben. Selfie-Perspektive, Sprung mitten in den Satz.`,
            `Built like a private recommendation: someone tells how they came across "${ctx.subject}" instead of advertising it. Selfie framing, jump cut mid sentence.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(
            `Ich hab den Song 4× hintereinander gehört – und dann das gemacht.`,
            `I played this song four times in a row - then I did this.`,
          ),
          callToAction: ctx.cta,
          caption: ctx.L(
            `Ehrlich: „${ctx.subject}“ von ${d.artistName} läuft bei mir seit Tagen. ${ctx.cta}`,
            `Honestly: "${ctx.subject}" by ${d.artistName} has been on repeat for days. ${ctx.cta}`,
          ),
          hashtags: hashtagsFor(ctx, [d.genre, "musicrecommendation"]),
          rationale: ctx.L(
            "UGC-Formate performen, weil sie nicht wie Werbung aussehen. Wichtig: Die Aussage bleibt eine persönliche Meinung – es werden keine erfundenen Bewertungen oder Chart-Erfolge behauptet.",
            "UGC formats perform because they do not look like ads. Important: the statement stays a personal opinion - no invented reviews or chart claims.",
          ),
          musicNote: ctx.L(
            "Song leise unter der Stimme, ab Szene 3 voll aufziehen.",
            "Song low under the voice, push to full from scene 3.",
          ),
          styleId: "viral_ugc",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1,
              title: ctx.L("Selfie-Hook", "Selfie hook"),
              text: ctx.L("4× hintereinander.", "Four times in a row."),
              voiceover: ctx.L(
                `Ich hab „${ctx.subject}“ vier Mal hintereinander gehört, bevor ich weitergescrollt hab.`,
                `I listened to "${ctx.subject}" four times before I scrolled on.`,
              ),
              visual: ctx.L("Handkamera, Person spricht direkt in die Linse.", "Handheld, person talks straight into the lens."),
              mediaPrompt: "Handheld selfie style shot, natural light, casual room, vertical 9:16",
              sourceKind: "user_upload",
              assetHint: "user_media",
            }),
            beat({
              role: "context",
              priority: 2,
              weight: 1,
              title: ctx.L("Was besonders ist", "What stands out"),
              text: short(d.mood ? ctx.L(`${d.mood}. Genau so.`, `${d.mood}. Exactly that.`) : ctx.L("Und dann kam der Part.", "And then that part hits.")),
              voiceover: ctx.L(
                `Es ist dieser eine Part – ${d.genre || "der Sound"} trifft genau die Stimmung.`,
                `It is that one part - ${d.genre || "the sound"} nails the mood.`,
              ),
              visual: ctx.L("Schnitt auf Cover, Ton wird lauter.", "Cut to cover, sound gets louder."),
              mediaPrompt: `${d.genre || "music"} mood shot, ${d.mood || "warm"}, cinematic grain, vertical`,
              assetHint: "cover",
            }),
            beat({
              role: "proof",
              priority: 2,
              weight: 1,
              title: ctx.L("Song spielt", "Song plays"),
              text: short(d.lyricsExcerpt || ctx.subject, 40),
              voiceover: "",
              visual: ctx.L("Nur Song, Text mitlaufend.", "Song only, lyrics running."),
              mediaPrompt: `Abstract ${d.mood || "energetic"} visual with beat-synced light, vertical`,
              assetHint: "cover",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 34),
              subline: `${d.artistName} – ${ctx.subject}`,
              voiceover: ctx.cta,
              visual: ctx.L("Person zeigt auf Text-Overlay.", "Person points at the text overlay."),
              mediaPrompt: "Warm casual end card, vertical",
            }),
          ],
        };
      },
    },
    {
      id: "story_visual",
      favouredTones: ["emotional", "luxurious", "professional"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "music" }>).details;
        return {
          title: ctx.L(`Story-Visualizer: „${ctx.subject}“`, `Story visualizer: "${ctx.subject}"`),
          bigIdea: ctx.L(
            `Eine kleine Bildgeschichte in vier Szenen, die die Stimmung von „${ctx.subject}“ trägt: allein losgehen, ankommen, loslassen. Der Song erzählt, die Bilder illustrieren.`,
            `A four scene picture story carrying the mood of "${ctx.subject}": setting off alone, arriving, letting go. The song narrates, the visuals illustrate.`,
          ),
          audience: ctx.audience,
          hook: ctx.L("Sechs Sekunden, dann verstehst du den Song.", "Six seconds and you will get the song."),
          callToAction: ctx.cta,
          caption: ctx.L(
            `Ein Visual zu „${ctx.subject}“. ${d.artistName} – ${ctx.cta}`,
            `A visual for "${ctx.subject}". ${d.artistName} – ${ctx.cta}`,
          ),
          hashtags: hashtagsFor(ctx, [d.genre, d.mood, "visualizer"]),
          rationale: ctx.L(
            "Story-Visuals halten die Watchtime hoch, weil jede Szene eine kleine Frage offen lässt. Für Releases ohne Musikvideo ist das die günstigste Art, trotzdem Bildwelt aufzubauen.",
            "Story visuals keep watch time high because every scene leaves a small question open. For releases without a music video this is the cheapest way to still build a visual world.",
          ),
          musicNote: ctx.L(
            "Song durchgehend, kein Voice-over, Schnitte auf die Downbeats.",
            "Song throughout, no voice-over, cuts on the downbeats.",
          ),
          styleId: "cinematic",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1.1,
              title: ctx.L("Aufbruch", "Setting off"),
              text: "",
              voiceover: "",
              visual: ctx.L("Weite Einstellung, Bewegung von links nach rechts.", "Wide shot, movement left to right."),
              mediaPrompt: `Cinematic wide shot, ${d.mood || "melancholic"} atmosphere, dusk light, film grain, vertical 9:16`,
            }),
            beat({
              role: "context",
              priority: 2,
              weight: 1,
              title: ctx.L("Nähe", "Closeness"),
              text: short(d.lyricsExcerpt || "", 42),
              voiceover: "",
              visual: ctx.L("Detailaufnahme, langsamer Push-in.", "Close detail, slow push in."),
              mediaPrompt: `Cinematic close up detail, shallow depth of field, ${d.mood || "warm"}, vertical`,
            }),
            beat({
              role: "transformation",
              priority: 2,
              weight: 1.1,
              title: ctx.L("Wendepunkt", "Turning point"),
              text: "",
              voiceover: "",
              visual: ctx.L("Licht kippt, Farbe wechselt.", "Light flips, colour shifts."),
              mediaPrompt: `Cinematic shot with dramatic colour shift, ${d.genre || "music"} mood, vertical`,
            }),
            beat({
              role: "showcase",
              priority: 3,
              weight: 1,
              title: ctx.L("Cover", "Cover"),
              text: `${d.artistName} – ${ctx.subject}`,
              voiceover: "",
              visual: ctx.L("Cover mit weichem Zoom.", "Cover with a soft zoom."),
              mediaPrompt: "Album cover on cinematic dark background, vertical",
              assetHint: "cover",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.8,
              title: "CTA",
              text: short(ctx.cta, 34),
              voiceover: "",
              visual: ctx.L("Ruhige Endkarte.", "Calm end card."),
              mediaPrompt: "Cinematic end card, dark, minimal text, vertical",
            }),
          ],
        };
      },
    },
    {
      id: "out_now",
      favouredTones: ["aggressive", "futuristic", "professional", "minimalistic"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "music" }>).details;
        return {
          title: ctx.L(`„Out now“-Ad: ${ctx.subject}`, `"Out now" ad: ${ctx.subject}`),
          bigIdea: ctx.L(
            `Klassische Release-Anzeige, aber ohne Floskeln: Cover, Songtitel, ein Satz warum man reinhören sollte, Plattform-Logos, fertig. Läuft auch als Paid-Ad.`,
            `A classic release ad without the filler: cover, title, one reason to listen, platform logos, done. Also works as a paid ad.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(`„${ctx.subject}“ ist raus.`, `"${ctx.subject}" is out.`),
          callToAction: ctx.cta,
          caption: ctx.L(
            `${d.artistName} – „${ctx.subject}“ ist jetzt überall verfügbar. ${ctx.cta}`,
            `${d.artistName} – "${ctx.subject}" is available everywhere now. ${ctx.cta}`,
          ),
          hashtags: hashtagsFor(ctx, [d.genre, "outnow", d.artistName]),
          rationale: ctx.L(
            "Diese Variante ist bewusst nüchtern und dadurch als Paid-Ad skalierbar: klare Botschaft, keine Behauptungen, sofort verständlich – auch für Menschen, die den Artist nicht kennen.",
            "This variant is deliberately sober and therefore scalable as a paid ad: clear message, no claims, instantly understandable even for people who do not know the artist.",
          ),
          musicNote: ctx.L(
            "Refrain ab Sekunde 0, Voice-over nur auf der letzten Szene.",
            "Chorus from second 0, voice-over only on the last scene.",
          ),
          styleId: "fast_promo",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1,
              title: "Out now",
              text: ctx.L("OUT NOW", "OUT NOW"),
              subline: `${d.artistName} – ${ctx.subject}`,
              voiceover: "",
              visual: ctx.L("Cover knallt ins Bild, harter Flash.", "Cover slams in, hard flash."),
              mediaPrompt: `Bold release announcement backdrop, ${d.genre || "music"}, high contrast, vertical`,
              assetHint: "cover",
            }),
            beat({
              role: "proof",
              priority: 2,
              weight: 1,
              title: ctx.L("Warum reinhören", "Why listen"),
              text: short(
                d.mood
                  ? ctx.L(`Für ${d.mood}-Momente.`, `For ${d.mood} moments.`)
                  : ctx.L("Wenn dir Sound wichtiger ist als Hype.", "If sound matters more than hype."),
                46,
              ),
              voiceover: "",
              visual: ctx.L("Text über pulsierendem Cover.", "Text over the pulsing cover."),
              mediaPrompt: `${d.genre || "music"} texture, rhythmic light, vertical`,
              assetHint: "cover",
            }),
            beat({
              role: "offer",
              priority: 3,
              weight: 0.9,
              title: ctx.L("Plattformen", "Platforms"),
              text: ctx.L("Überall verfügbar", "Available everywhere"),
              subline: d.streamingUrl ? hostOf(d.streamingUrl) : "",
              voiceover: "",
              visual: ctx.L("Plattform-Zeile, Cover klein.", "Platform row, cover small."),
              mediaPrompt: "Dark gradient card for streaming platforms, vertical",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 30),
              voiceover: ctx.cta,
              visual: ctx.L("CTA groß, Cover als Hintergrund.", "CTA large, cover behind."),
              mediaPrompt: "High contrast end card, vertical",
              assetHint: "cover",
            }),
          ],
        };
      },
    },
  ];
}

/* ------------------------------ website ---------------------------------- */

function websiteArchetypes(): Archetype[] {
  return [
    {
      id: "before_after_site",
      favouredTones: ["professional", "aggressive", "minimalistic"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "website" }>).details;
        const host = hostOf(d.url) || ctx.subject;
        const benefits = listOr(d.benefits, [
          ctx.L("Schneller verstanden", "Understood faster"),
          ctx.L("Mehr Anfragen", "More enquiries"),
        ]);
        return {
          title: ctx.L(`Problem → Seite → Ergebnis (${host})`, `Problem → page → result (${host})`),
          bigIdea: ctx.L(
            `Zuerst das Problem, das ${host} löst, dann ein Scroll über die echte Seite, dann das Ergebnis. Der Screenshot ist der Beweis, nicht die Behauptung.`,
            `First the problem ${host} solves, then a scroll across the real page, then the outcome. The screenshot is the proof, not the claim.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(
            `Deine Besucher springen ab, bevor sie verstehen, was du anbietest.`,
            `Your visitors leave before they understand what you offer.`,
          ),
          callToAction: ctx.cta,
          caption: ctx.L(
            `${d.coreMessage || host} – ${ctx.cta}`,
            `${d.coreMessage || host} – ${ctx.cta}`,
          ),
          hashtags: hashtagsFor(ctx, [host, "website"]),
          rationale: ctx.L(
            "Der Screenshot-Scroll ist der glaubwürdigste Teil: Zuschauer sehen die echte Seite, keine Illustration. Das Problem am Anfang sorgt dafür, dass auch Leute bleiben, die die Marke nicht kennen.",
            "The screenshot scroll is the most credible part: viewers see the real page, not an illustration. The problem up front keeps people watching who do not know the brand.",
          ),
          musicNote: ctx.L("Ruhiger Beat, Voice-over dominiert.", "Calm beat, voice-over leads."),
          styleId: "app_demo",
          beats: [
            beat({
              role: "problem",
              priority: 1,
              weight: 1,
              title: ctx.L("Problem", "Problem"),
              text: ctx.L("3 Sekunden. Dann sind sie weg.", "Three seconds. Then they are gone."),
              voiceover: ctx.L(
                "Die meisten Besucher entscheiden in drei Sekunden, ob sie bleiben.",
                "Most visitors decide within three seconds whether they stay.",
              ),
              visual: ctx.L("Cursor verlässt die Seite, Zähler läuft.", "Cursor leaves the page, counter runs."),
              mediaPrompt: "Abstract visualisation of a bouncing website visitor, dark UI, vertical 9:16",
            }),
            beat({
              role: "showcase",
              priority: 1,
              weight: 1.2,
              title: ctx.L("Seiten-Scroll", "Page scroll"),
              text: short(d.coreMessage || d.importedTitle || host, 42),
              voiceover: ctx.L(
                `${host} sagt in einem Satz, worum es geht.`,
                `${host} says what it is about in one sentence.`,
              ),
              visual: ctx.L("Screenshot scrollt langsam nach oben.", "Screenshot scrolls slowly upward."),
              mediaPrompt: `Screenshot of the landing page ${host} on a dark background, vertical`,
              sourceKind: "website_screenshot",
              assetHint: "website_shot",
            }),
            ...benefits.slice(0, 2).map((benefit, index) =>
              beat({
                role: "feature",
                priority: index === 0 ? 2 : 3,
                weight: 0.9,
                title: ctx.L(`Vorteil ${index + 1}`, `Benefit ${index + 1}`),
                text: short(benefit, 40),
                voiceover: benefit,
                visual: ctx.L("Callout neben dem Screenshot.", "Callout next to the screenshot."),
                mediaPrompt: `UI detail highlighting "${benefit}", dark interface, vertical`,
                sourceKind: "website_screenshot",
                assetHint: "website_shot",
              }),
            ),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(d.desiredCta || ctx.cta, 34),
              subline: host,
              voiceover: d.desiredCta || ctx.cta,
              visual: ctx.L("URL groß, Button pulsiert.", "URL large, button pulses."),
              mediaPrompt: "Clean CTA end card with URL, dark, vertical",
            }),
          ],
        };
      },
    },
    {
      id: "site_tour",
      favouredTones: ["professional", "minimalistic", "futuristic"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "website" }>).details;
        const host = hostOf(d.url) || ctx.subject;
        const benefits = listOr(d.benefits, [
          ctx.L("Klarer Aufbau", "Clear structure"),
          ctx.L("Direkter Kontakt", "Direct contact"),
          ctx.L("Mobil optimiert", "Mobile ready"),
        ]);
        return {
          title: ctx.L(`30-Sekunden-Tour durch ${host}`, `30 second tour of ${host}`),
          bigIdea: ctx.L(
            `Eine geführte Mini-Tour: drei Stationen der Seite, jede mit einem Satz erklärt. Wirkt wie ein Screenrecording, nicht wie Werbung.`,
            `A guided mini tour: three stops on the page, each explained in one sentence. Feels like a screen recording, not an ad.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(`Was ${host} in 30 Sekunden kann:`, `What ${host} does in 30 seconds:`),
          callToAction: ctx.cta,
          caption: ctx.L(`Kurze Tour durch ${host}. ${ctx.cta}`, `Quick tour of ${host}. ${ctx.cta}`),
          hashtags: hashtagsFor(ctx, [host, d.siteGoal]),
          rationale: ctx.L(
            "Tour-Formate funktionieren, weil sie einen klaren Fortschritt haben (1 von 3, 2 von 3 …). Das erzeugt eine offene Schleife und hält Zuschauer bis zum Ende.",
            "Tour formats work because they carry visible progress (1 of 3, 2 of 3 ...). That opens a loop and holds viewers to the end.",
          ),
          musicNote: ctx.L("Dezenter Loop, Voice-over vorne.", "Subtle loop, voice-over up front."),
          styleId: "clean_product",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 0.9,
              title: ctx.L("Ankündigung", "Announcement"),
              text: short(ctx.L(`${host} in 3 Schritten`, `${host} in 3 steps`), 40),
              voiceover: ctx.L(`Drei Dinge, die ${host} für dich erledigt.`, `Three things ${host} does for you.`),
              visual: ctx.L("Seite fährt von unten ins Bild.", "Page slides up into frame."),
              mediaPrompt: `Landing page ${host} on dark gradient, vertical`,
              sourceKind: "website_screenshot",
              assetHint: "website_shot",
            }),
            ...benefits.slice(0, 3).map((benefit, index) =>
              beat({
                role: "feature",
                priority: index === 0 ? 1 : index === 1 ? 2 : 3,
                weight: 1,
                title: `${index + 1}/3 ${short(benefit, 20)}`,
                text: short(benefit, 40),
                subline: `${index + 1}/3`,
                voiceover: benefit,
                visual: ctx.L("Ausschnitt der Seite mit Marker.", "Section of the page with a marker."),
                mediaPrompt: `Website section screenshot highlighting "${benefit}", vertical`,
                sourceKind: "website_screenshot",
                assetHint: "website_shot",
              }),
            ),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(d.desiredCta || ctx.cta, 34),
              subline: host,
              voiceover: d.desiredCta || ctx.cta,
              visual: ctx.L("Endkarte mit URL.", "End card with the URL."),
              mediaPrompt: "Minimal end card with website URL, vertical",
            }),
          ],
        };
      },
    },
    {
      id: "site_objection",
      favouredTones: ["aggressive", "humorous", "ugc"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "website" }>).details;
        const host = hostOf(d.url) || ctx.subject;
        return {
          title: ctx.L(`Einwand-Konter für ${host}`, `Objection breaker for ${host}`),
          bigIdea: ctx.L(
            `Der häufigste Einwand wird direkt ausgesprochen und dann auf der Seite widerlegt. Ehrlicher Ton, keine Superlative.`,
            `The most common objection is said out loud and then answered on the page. Honest tone, no superlatives.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(`„Klingt teuer.“ Kurz, ich zeig dir was.`, `"Sounds expensive." Quick, let me show you something.`),
          callToAction: ctx.cta,
          caption: ctx.L(`Der häufigste Einwand – und die Antwort. ${ctx.cta}`, `The most common objection - and the answer. ${ctx.cta}`),
          hashtags: hashtagsFor(ctx, [host]),
          rationale: ctx.L(
            "Einwand-Formate sprechen genau die Menschen an, die kurz vor dem Klick abbrechen. Weil der Einwand aus dem Video kommt und nicht weggeredet wird, wirkt die Antwort glaubwürdiger.",
            "Objection formats speak to the people who bail right before clicking. Because the objection comes from the video itself instead of being talked away, the answer lands as more credible.",
          ),
          musicNote: ctx.L("Trockener Beat, Stimme im Vordergrund.", "Dry beat, voice in front."),
          styleId: "viral_ugc",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1,
              title: ctx.L("Einwand", "Objection"),
              text: ctx.L("„Klingt teuer.“", `"Sounds expensive."`),
              voiceover: ctx.L("Der Satz kommt fast immer. Zurecht.", "That sentence comes up almost every time. Fair enough."),
              visual: ctx.L("Person spricht direkt in die Kamera.", "Person speaks straight to camera."),
              mediaPrompt: "Handheld talking head, natural light, vertical 9:16",
              sourceKind: "user_upload",
              assetHint: "user_media",
            }),
            beat({
              role: "proof",
              priority: 1,
              weight: 1.2,
              title: ctx.L("Beweis auf der Seite", "Proof on the page"),
              text: short(d.coreMessage || ctx.L("Schau selbst.", "See for yourself."), 40),
              voiceover: ctx.L(
                `Deshalb steht auf ${host} genau, was enthalten ist.`,
                `That is why ${host} spells out exactly what is included.`,
              ),
              visual: ctx.L("Screenshot scrollt zum entscheidenden Abschnitt.", "Screenshot scrolls to the decisive section."),
              mediaPrompt: `Website pricing or details section of ${host}, vertical`,
              sourceKind: "website_screenshot",
              assetHint: "website_shot",
            }),
            beat({
              role: "offer",
              priority: 2,
              weight: 0.9,
              title: ctx.L("Angebot", "Offer"),
              text: short(d.siteGoal || ctx.L("Kein Abo. Keine Überraschung.", "No subscription. No surprises."), 42),
              voiceover: d.siteGoal || ctx.L("Alles transparent auf einer Seite.", "All transparent on one page."),
              visual: ctx.L("Callout mit Häkchen.", "Callout with check marks."),
              mediaPrompt: "Dark UI card with check list, vertical",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.8,
              title: "CTA",
              text: short(d.desiredCta || ctx.cta, 34),
              subline: host,
              voiceover: d.desiredCta || ctx.cta,
              visual: ctx.L("URL bleibt stehen.", "URL holds on screen."),
              mediaPrompt: "Bold CTA card with URL, vertical",
            }),
          ],
        };
      },
    },
  ];
}

/* -------------------------------- app ------------------------------------ */

function appArchetypes(): Archetype[] {
  return [
    {
      id: "problem_solution",
      favouredTones: ["professional", "aggressive", "futuristic"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "app" }>).details;
        const features = listOr(d.features, [ctx.L("Schnell einrichten", "Fast setup")]);
        const problem =
          d.problemSolved.trim() ||
          ctx.L("Zu viele Tools für eine einfache Aufgabe.", "Too many tools for one simple task.");
        return {
          title: ctx.L(`Problem → Lösung: ${d.appName}`, `Problem → solution: ${d.appName}`),
          bigIdea: ctx.L(
            `Sekunde 0 zeigt den nervigen Ist-Zustand, Sekunde 3 zeigt ${d.appName} als Abkürzung. Danach nur noch Beweis im Screenrecording.`,
            `Second 0 shows the annoying status quo, second 3 shows ${d.appName} as the shortcut. After that it is only proof in the screen recording.`,
          ),
          audience: ctx.audience,
          hook: short(ctx.L(`Falls du das noch von Hand machst:`, `If you are still doing this by hand:`), 60),
          callToAction: ctx.cta,
          caption: ctx.L(`${problem} ${d.appName} löst das. ${ctx.cta}`, `${problem} ${d.appName} fixes it. ${ctx.cta}`),
          hashtags: hashtagsFor(ctx, [d.appName, ...d.platforms]),
          rationale: ctx.L(
            "Problem-Lösung ist das zuverlässigste App-Format, weil der Zuschauer sich im Problem wiedererkennt, bevor die App überhaupt auftaucht. Das Screenrecording liefert danach den Beweis statt eines Versprechens.",
            "Problem-solution is the most reliable app format because viewers recognise themselves in the problem before the app even appears. The screen recording then delivers proof instead of a promise.",
          ),
          musicNote: ctx.L("Treibender, aber unauffälliger Loop.", "Driving but unobtrusive loop."),
          styleId: "app_demo",
          beats: [
            beat({
              role: "problem",
              priority: 1,
              weight: 1,
              title: ctx.L("Ist-Zustand", "Status quo"),
              text: short(problem, 44),
              voiceover: problem,
              visual: ctx.L("Chaotischer Desktop, Fenster stapeln sich.", "Cluttered desktop, windows stacking up."),
              mediaPrompt: "Frustrating cluttered workflow, many windows, dark UI, vertical 9:16",
            }),
            beat({
              role: "showcase",
              priority: 1,
              weight: 1.1,
              title: ctx.subject,
              text: short(ctx.subject, 30),
              subline: ctx.L("in einem Screen", "in one screen"),
              voiceover: ctx.L(`${d.appName} macht daraus einen Schritt.`, `${d.appName} turns that into one step.`),
              visual: ctx.L("Screenrecording im Telefonrahmen.", "Screen recording inside a phone frame."),
              mediaPrompt: `App interface of ${d.appName} inside a phone mockup, dark theme, vertical`,
              sourceKind: "app_screenshot",
              assetHint: "screenshot",
            }),
            ...features.slice(0, 3).map((feature, index) =>
              beat({
                role: "feature",
                priority: index === 0 ? 2 : index === 1 ? 3 : 4,
                weight: 0.9,
                title: short(feature, 24),
                text: short(feature, 40),
                voiceover: feature,
                visual: ctx.L("Feature-Callout über dem Screen.", "Feature callout over the screen."),
                mediaPrompt: `App screen highlighting "${feature}", vertical`,
                sourceKind: "app_screenshot",
                assetHint: "screenshot",
              }),
            ),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 34),
              subline: d.storeUrl ? hostOf(d.storeUrl) : d.platforms.join(" · "),
              voiceover: ctx.cta,
              visual: ctx.L("App-Icon und Store-Badges.", "App icon and store badges."),
              mediaPrompt: "App store style end card, dark, vertical",
              assetHint: "logo",
            }),
          ],
        };
      },
    },
    {
      id: "feature_demo",
      favouredTones: ["professional", "futuristic", "minimalistic"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "app" }>).details;
        const features = listOr(d.features, [
          ctx.L("Feature 1", "Feature 1"),
          ctx.L("Feature 2", "Feature 2"),
          ctx.L("Feature 3", "Feature 3"),
        ]);
        return {
          title: ctx.L(`${features.length} Features in ${ctx.brief.durationSeconds} Sekunden`, `${features.length} features in ${ctx.brief.durationSeconds} seconds`),
          bigIdea: ctx.L(
            `Reine Feature-Demo ohne Umweg: jedes Feature bekommt ein Screenrecording und einen Satz. Für Zuschauer, die ${d.appName} schon kennen und den Grund zum Wechseln suchen.`,
            `A pure feature demo with no detour: every feature gets a screen recording and one sentence. For viewers who already know ${d.appName} and are looking for a reason to switch.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(`${features.length} Dinge, die ${d.appName} kann und deine App nicht.`, `${features.length} things ${d.appName} does that your app does not.`),
          callToAction: ctx.cta,
          caption: ctx.L(`${d.appName}: ${features.slice(0, 3).join(" · ")}. ${ctx.cta}`, `${d.appName}: ${features.slice(0, 3).join(" · ")}. ${ctx.cta}`),
          hashtags: hashtagsFor(ctx, [d.appName, ...features.slice(0, 2)]),
          rationale: ctx.L(
            "Listenformate sind hoch teilbar und leicht zu scannen. Jeder Schnitt setzt den Timer neu, das hält die Abbruchrate niedrig.",
            "List formats are highly shareable and easy to scan. Every cut resets the timer, which keeps drop-off low.",
          ),
          musicNote: ctx.L("Klarer Beat, Schnitte auf den Takt.", "Clear beat, cuts on the beat."),
          styleId: "clean_product",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 0.9,
              title: ctx.L("Listen-Hook", "List hook"),
              text: short(ctx.L(`${features.length} Features`, `${features.length} features`), 30),
              subline: d.appName,
              voiceover: ctx.L(`${features.length} Features in ${ctx.brief.durationSeconds} Sekunden.`, `${features.length} features in ${ctx.brief.durationSeconds} seconds.`),
              visual: ctx.L("Titelkarte mit Zähler.", "Title card with a counter."),
              mediaPrompt: `Bold title card for ${d.appName}, dark UI, vertical`,
              assetHint: "logo",
            }),
            ...features.slice(0, 4).map((feature, index) =>
              beat({
                role: "feature",
                priority: index < 2 ? 1 : index === 2 ? 3 : 4,
                weight: 1,
                title: `${index + 1}. ${short(feature, 22)}`,
                text: short(feature, 38),
                subline: `${index + 1}/${Math.min(4, features.length)}`,
                voiceover: feature,
                visual: ctx.L("Screenrecording des Features.", "Screen recording of the feature."),
                mediaPrompt: `${d.appName} interface demonstrating "${feature}", vertical`,
                sourceKind: "app_screenshot",
                assetHint: "screenshot",
              }),
            ),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 34),
              subline: d.platforms.join(" · "),
              voiceover: ctx.cta,
              visual: ctx.L("Endkarte mit Store-Badges.", "End card with store badges."),
              mediaPrompt: "Clean app end card, vertical",
              assetHint: "logo",
            }),
          ],
        };
      },
    },
    {
      id: "tutorial_clip",
      favouredTones: ["professional", "ugc", "minimalistic", "humorous"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "app" }>).details;
        const task = listOr(d.features, [ctx.L("die erste Aufgabe", "the first task")])[0];
        return {
          title: ctx.L(`Mini-Tutorial: ${short(task, 30)} mit ${d.appName}`, `Mini tutorial: ${short(task, 30)} with ${d.appName}`),
          bigIdea: ctx.L(
            `Ein einziger nützlicher Handgriff, Schritt für Schritt gezeigt. Der Zuschauer lernt etwas, auch wenn er die App nie installiert – genau deshalb wird es gespeichert.`,
            `A single useful action, shown step by step. Viewers learn something even if they never install the app - which is exactly why it gets saved.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(`So machst du ${short(task, 28)} in unter 20 Sekunden.`, `Here is how to ${short(task, 28)} in under 20 seconds.`),
          callToAction: ctx.cta,
          caption: ctx.L(`Kleines Tutorial für ${d.appName}. Speichern lohnt sich. ${ctx.cta}`, `Small tutorial for ${d.appName}. Worth saving. ${ctx.cta}`),
          hashtags: hashtagsFor(ctx, [d.appName, "tutorial"]),
          rationale: ctx.L(
            "Tutorials werden überdurchschnittlich oft gespeichert und geteilt – beides sind starke Verteilungssignale. Der Nutzen steht vor dem Produkt, das senkt die Werbewahrnehmung.",
            "Tutorials are saved and shared above average - both are strong distribution signals. Utility comes before the product, which lowers the perception of advertising.",
          ),
          musicNote: ctx.L("Leiser Loop, Stimme klar vorne.", "Quiet loop, voice clearly in front."),
          styleId: "app_demo",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 0.9,
              title: ctx.L("Versprechen", "Promise"),
              text: short(ctx.L(`${short(task, 26)} – in 20 Sek.`, `${short(task, 26)} - in 20s`), 40),
              voiceover: ctx.L(`So erledigst du ${short(task, 30)} in unter zwanzig Sekunden.`, `Here is how to handle ${short(task, 30)} in under twenty seconds.`),
              visual: ctx.L("Titelkarte, Timer läuft an.", "Title card, timer starts."),
              mediaPrompt: "Tutorial title card, dark UI, vertical",
            }),
            beat({
              role: "feature",
              priority: 1,
              weight: 1.1,
              title: ctx.L("Schritt 1", "Step 1"),
              text: ctx.L("Schritt 1", "Step 1"),
              subline: short(task, 36),
              voiceover: ctx.L("Erst öffnest du den Bereich und wählst deine Vorlage.", "First open the section and pick your template."),
              visual: ctx.L("Screenrecording mit Tap-Indikator.", "Screen recording with a tap indicator."),
              mediaPrompt: `${d.appName} step one screen, vertical`,
              sourceKind: "app_screenshot",
              assetHint: "screenshot",
            }),
            beat({
              role: "feature",
              priority: 2,
              weight: 1.1,
              title: ctx.L("Schritt 2", "Step 2"),
              text: ctx.L("Schritt 2", "Step 2"),
              subline: ctx.L("anpassen", "adjust"),
              voiceover: ctx.L("Dann passt du an, was dir wichtig ist.", "Then adjust what matters to you."),
              visual: ctx.L("Einstellung wird verändert.", "A setting is being changed."),
              mediaPrompt: `${d.appName} settings screen, vertical`,
              sourceKind: "app_screenshot",
              assetHint: "screenshot",
            }),
            beat({
              role: "proof",
              priority: 2,
              weight: 1,
              title: ctx.L("Ergebnis", "Result"),
              text: ctx.L("Fertig.", "Done."),
              voiceover: ctx.L("Fertig – ohne Umweg über andere Tools.", "Done - without a detour through other tools."),
              visual: ctx.L("Ergebnis-Screen, kurzer Zoom.", "Result screen, short zoom."),
              mediaPrompt: `${d.appName} success screen, vertical`,
              sourceKind: "app_screenshot",
              assetHint: "screenshot",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.8,
              title: "CTA",
              text: short(ctx.cta, 34),
              voiceover: ctx.cta,
              visual: ctx.L("Endkarte mit App-Icon.", "End card with app icon."),
              mediaPrompt: "App end card, vertical",
              assetHint: "logo",
            }),
          ],
        };
      },
    },
    {
      id: "ugc_testimonial_concept",
      favouredTones: ["ugc", "emotional", "humorous"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "app" }>).details;
        return {
          title: ctx.L(`UGC-Konzept (Sprechertext-Vorlage): ${d.appName}`, `UGC concept (script template): ${d.appName}`),
          bigIdea: ctx.L(
            `Ein Skript-Gerüst für ein echtes Testimonial. AdReel schreibt die Struktur – gefilmt und gesprochen wird es von einer echten Person, die ${d.appName} wirklich nutzt.`,
            `A script scaffold for a genuine testimonial. AdReel writes the structure - it is filmed and spoken by a real person who actually uses ${d.appName}.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(`Ich hab drei Wochen gebraucht, um das zu kapieren:`, `It took me three weeks to figure this out:`),
          callToAction: ctx.cta,
          caption: ctx.L(`Skript-Vorlage für dein eigenes Testimonial zu ${d.appName}. ${ctx.cta}`, `Script template for your own ${d.appName} testimonial. ${ctx.cta}`),
          hashtags: hashtagsFor(ctx, [d.appName, "ugc"]),
          rationale: ctx.L(
            "Wichtig: Dieses Konzept liefert bewusst nur ein Gerüst. Erfundene Kundenaussagen sind rechtlich riskant und schaden dem Vertrauen – der Text muss von einer echten Nutzerin oder einem echten Nutzer stammen und bestätigt werden.",
            "Important: this concept deliberately provides only a scaffold. Invented customer quotes are legally risky and damage trust - the wording must come from and be confirmed by a real user.",
          ),
          musicNote: ctx.L("Kein Musikbett unter der Stimme, erst ab CTA.", "No music bed under the voice, only from the CTA onwards."),
          styleId: "viral_ugc",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1,
              title: ctx.L("Persönlicher Einstieg", "Personal open"),
              text: ctx.L("[Deine echte Erfahrung]", "[Your real experience]"),
              voiceover: ctx.L(
                "Platzhalter: Beschreibe hier in einem Satz deine echte Ausgangssituation.",
                "Placeholder: describe your real starting situation in one sentence.",
              ),
              visual: ctx.L("Selfie-Perspektive, ungeschnitten.", "Selfie framing, uncut."),
              mediaPrompt: "Authentic handheld talking head, natural light, vertical",
              sourceKind: "user_upload",
              assetHint: "user_media",
            }),
            beat({
              role: "problem",
              priority: 2,
              weight: 1,
              title: ctx.L("Vorher", "Before"),
              text: short(d.problemSolved || ctx.L("[Was vorher nervte]", "[What used to be annoying]"), 42),
              voiceover: d.problemSolved || ctx.L("Platzhalter: Was hat dich vorher aufgehalten?", "Placeholder: what used to hold you up?"),
              visual: ctx.L("B-Roll des alten Ablaufs.", "B-roll of the old workflow."),
              mediaPrompt: "Everyday frustrating workflow b-roll, vertical",
            }),
            beat({
              role: "transformation",
              priority: 1,
              weight: 1.1,
              title: ctx.L("Nachher", "After"),
              text: short(listOr(d.features, [d.appName])[0], 40),
              voiceover: ctx.L(`Platzhalter: Was hat sich mit ${d.appName} konkret geändert?`, `Placeholder: what concretely changed with ${d.appName}?`),
              visual: ctx.L("Screenrecording, Person kommentiert.", "Screen recording with commentary."),
              mediaPrompt: `${d.appName} interface in use, vertical`,
              sourceKind: "app_screenshot",
              assetHint: "screenshot",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 34),
              voiceover: ctx.cta,
              visual: ctx.L("Person zeigt auf den CTA.", "Person points at the CTA."),
              mediaPrompt: "Warm end card, vertical",
              assetHint: "logo",
            }),
          ],
        };
      },
    },
  ];
}

/* -------------------------- mixing & mastering --------------------------- */

function mixingArchetypes(): Archetype[] {
  return [
    {
      id: "before_after_audio",
      favouredTones: ["professional", "aggressive", "luxurious"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "mixing_mastering" }>).details;
        const price = d.priceOnRequest ? ctx.L("Preis auf Anfrage", "Price on request") : d.price;
        return {
          title: ctx.L(`Vorher / Nachher: ${d.offerName}`, `Before / after: ${d.offerName}`),
          bigIdea: ctx.L(
            `Der Ton macht die Arbeit: erst der Rohmix, dann der Master, direkt hintereinander. Auf dem Bild nur ein Wellenform-Vergleich und ein Label.`,
            `The audio does the work: raw mix first, master second, back to back. On screen only a waveform comparison and a label.`,
          ),
          audience: ctx.audience,
          hook: ctx.L("Gleicher Song. Zweite Hälfte ist gemastert.", "Same song. Second half is mastered."),
          callToAction: ctx.cta,
          caption: ctx.L(
            `Vorher/Nachher aus einer echten Session. ${price ? `${price}. ` : ""}${ctx.cta}`,
            `Before/after from a real session. ${price ? `${price}. ` : ""}${ctx.cta}`,
          ),
          hashtags: hashtagsFor(ctx, [...d.genres, "mixing", "mastering"]),
          rationale: ctx.L(
            "Vorher/Nachher ist im Audiobereich das stärkste Format, weil der Beweis hörbar ist und keine Behauptung braucht. Wichtig ist der harte Schnitt auf derselben Stelle – sonst wirkt der Vergleich manipuliert.",
            "Before/after is the strongest format in audio because the proof is audible and needs no claim. The hard cut at the same spot matters - otherwise the comparison feels manipulated.",
          ),
          musicNote: ctx.L(
            "Vorher-Audio bis Sekunde 5, dann harter Schnitt auf das Master. Kein zusätzliches Musikbett.",
            "Before audio until second 5, then a hard cut to the master. No additional music bed.",
          ),
          styleId: "before_after",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1,
              title: ctx.L("Vorher", "Before"),
              text: ctx.L("VORHER", "BEFORE"),
              subline: ctx.L("Rohmix", "Raw mix"),
              voiceover: "",
              visual: ctx.L("Flache Wellenform, gedämpfte Farben.", "Flat waveform, muted colours."),
              mediaPrompt: "Dull waveform on dark studio background, desaturated, vertical 9:16",
              assetHint: "before_after",
              soundNote: ctx.L("Unbearbeitetes Audio.", "Unprocessed audio."),
            }),
            beat({
              role: "transformation",
              priority: 1,
              weight: 1.2,
              title: ctx.L("Nachher", "After"),
              text: ctx.L("NACHHER", "AFTER"),
              subline: ctx.L("gemastert", "mastered"),
              voiceover: "",
              visual: ctx.L("Volle Wellenform, Farbe kippt ins Warme.", "Full waveform, colour shifts warm."),
              mediaPrompt: "Rich loud waveform, warm colour, studio lighting, vertical",
              assetHint: "before_after",
              soundNote: ctx.L("Gemastertes Audio, gleicher Songabschnitt.", "Mastered audio, same section."),
            }),
            beat({
              role: "proof",
              priority: 2,
              weight: 0.9,
              title: ctx.L("Was gemacht wurde", "What was done"),
              text: short(listOr(d.services, [ctx.L("Mix & Master", "Mix & master")]).join(" · "), 44),
              voiceover: listOr(d.services, [ctx.L("Mix und Master", "Mix and master")]).join(", "),
              visual: ctx.L("Leistungsliste über Studiobild.", "Service list over a studio shot."),
              mediaPrompt: "Studio desk with monitors, moody light, vertical",
            }),
            beat({
              role: "offer",
              priority: 2,
              weight: 0.9,
              title: ctx.L("Konditionen", "Terms"),
              text: short(price || ctx.L("Preis auf Anfrage", "Price on request"), 34),
              subline: d.turnaround ? ctx.L(`Bearbeitungszeit: ${d.turnaround}`, `Turnaround: ${d.turnaround}`) : "",
              voiceover: d.turnaround
                ? ctx.L(`${price || "Preis auf Anfrage"}, Bearbeitungszeit ${d.turnaround}.`, `${price || "Price on request"}, turnaround ${d.turnaround}.`)
                : price,
              visual: ctx.L("Preis- und Zeitangabe als Karte.", "Price and turnaround as a card."),
              mediaPrompt: "Premium dark pricing card, gold accents, vertical",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 32),
              subline: d.bookingUrl ? hostOf(d.bookingUrl) : "",
              voiceover: ctx.cta,
              visual: ctx.L("Buchungs-Link groß.", "Booking link large."),
              mediaPrompt: "Dark luxury end card with booking link, vertical",
            }),
          ],
        };
      },
    },
    {
      id: "studio_showcase",
      favouredTones: ["luxurious", "professional", "emotional"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "mixing_mastering" }>).details;
        return {
          title: ctx.L(`Studio-Showcase: ${d.offerName}`, `Studio showcase: ${d.offerName}`),
          bigIdea: ctx.L(
            `Ruhige Bilder aus dem Studio, dazu die Leistungen als Text. Verkauft Vertrauen statt Lautstärke – passt zu Kunden, die Qualität über Preis stellen.`,
            `Calm studio imagery with the services as text. Sells trust instead of volume - fits clients who value quality over price.`,
          ),
          audience: ctx.audience,
          hook: ctx.L("So klingt es, wenn jemand Zeit investiert.", "This is what it sounds like when someone takes the time."),
          callToAction: ctx.cta,
          caption: ctx.L(`${d.offerName} – ${listOr(d.genres, ["alle Genres"]).join(", ")}. ${ctx.cta}`, `${d.offerName} - ${listOr(d.genres, ["all genres"]).join(", ")}. ${ctx.cta}`),
          hashtags: hashtagsFor(ctx, [...d.genres, "studio"]),
          rationale: ctx.L(
            "Im Premium-Segment entscheidet der erste Eindruck über den Preis, den man verlangen kann. Ruhige Bildsprache und wenig Text signalisieren Auslastung statt Akquise-Druck.",
            "In the premium segment the first impression decides the price you can charge. Calm imagery and little text signal a full calendar rather than sales pressure.",
          ),
          musicNote: ctx.L("Master des eigenen Referenztracks leise unterlegen.", "Master of your own reference track quietly underneath."),
          styleId: "dark_luxury",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1.1,
              title: ctx.L("Studio", "Studio"),
              text: short(d.offerName, 32),
              voiceover: ctx.L("So klingt es, wenn jemand Zeit investiert.", "This is what it sounds like when someone takes the time."),
              visual: ctx.L("Langsame Fahrt über den Mischpultbereich.", "Slow move across the console."),
              mediaPrompt: "Cinematic studio console close up, warm rim light, vertical 9:16",
            }),
            beat({
              role: "proof",
              priority: 2,
              weight: 1,
              title: ctx.L("Leistungen", "Services"),
              text: short(listOr(d.services, [ctx.L("Mixing", "Mixing"), ctx.L("Mastering", "Mastering")]).join(" · "), 44),
              voiceover: listOr(d.services, [ctx.L("Mixing und Mastering", "Mixing and mastering")]).join(", "),
              visual: ctx.L("Leistungen als Liste über Detailaufnahmen.", "Services as a list over detail shots."),
              mediaPrompt: "Studio outboard gear detail, gold accents, vertical",
            }),
            beat({
              role: "context",
              priority: 3,
              weight: 0.9,
              title: ctx.L("Referenzen", "References"),
              text: short(listOr(d.references, [ctx.L("Referenzen auf Anfrage", "References on request")])[0], 42),
              voiceover: listOr(d.references, [ctx.L("Referenzen auf Anfrage.", "References on request.")])[0],
              visual: ctx.L("Referenz-Cover in Reihe.", "Reference covers in a row."),
              mediaPrompt: "Row of album covers on dark surface, vertical",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 30),
              subline: d.bookingUrl ? hostOf(d.bookingUrl) : "",
              voiceover: ctx.cta,
              visual: ctx.L("Endkarte in Gold auf Schwarz.", "Gold on black end card."),
              mediaPrompt: "Dark luxury end card, vertical",
            }),
          ],
        };
      },
    },
    {
      id: "demo_to_master",
      favouredTones: ["emotional", "professional", "ugc"],
      build: (ctx) => {
        const d = (ctx.brief as Extract<ProjectBrief, { category: "mixing_mastering" }>).details;
        return {
          title: ctx.L("Kundenreise: vom Demo zum fertigen Master", "Client journey: from demo to finished master"),
          bigIdea: ctx.L(
            `Vier Stationen: Demo im Handy aufgenommen, Session, Revision, fertiges Master. Zeigt den Prozess statt des Ergebnisses – nimmt Unsicherheit vor der ersten Anfrage.`,
            `Four stations: demo recorded on a phone, session, revision, finished master. Shows the process instead of the result - removes the uncertainty before a first enquiry.`,
          ),
          audience: ctx.audience,
          hook: ctx.L("Dein Demo klingt noch nach Handy? Genau da fangen wir an.", "Demo still sounds like a phone recording? That is exactly where we start."),
          callToAction: ctx.cta,
          caption: ctx.L(`So läuft eine Session bei ${d.offerName} ab. ${ctx.cta}`, `This is how a session at ${d.offerName} works. ${ctx.cta}`),
          hashtags: hashtagsFor(ctx, [...d.genres, "musicproduction"]),
          rationale: ctx.L(
            "Prozess-Videos senken die Hemmschwelle, weil sie zeigen, was passiert, nachdem man geschrieben hat. Das ist bei Dienstleistungen oft die eigentliche Kaufbarriere.",
            "Process videos lower the barrier because they show what happens after someone reaches out. With services that is often the real purchase blocker.",
          ),
          musicNote: ctx.L("Von dumpf zu offen: Filter öffnet über die Szenen.", "From dull to open: filter opens across the scenes."),
          styleId: "before_after",
          beats: [
            beat({
              role: "problem",
              priority: 1,
              weight: 1,
              title: ctx.L("Demo", "Demo"),
              text: ctx.L("Demo vom Handy", "Phone demo"),
              voiceover: ctx.L("Fast jeder Track startet als Sprachmemo.", "Almost every track starts as a voice memo."),
              visual: ctx.L("Handy auf Notenblatt, gedämpftes Licht.", "Phone on a lyric sheet, dim light."),
              mediaPrompt: "Phone voice memo on a desk, dim room, vertical 9:16",
            }),
            beat({
              role: "context",
              priority: 2,
              weight: 1,
              title: ctx.L("Session", "Session"),
              text: ctx.L("Session", "Session"),
              subline: d.turnaround ? d.turnaround : "",
              voiceover: ctx.L("Dann gehen wir gemeinsam durch Arrangement und Sound.", "Then we go through arrangement and sound together."),
              visual: ctx.L("Hände am Fader, Bildschirm mit Spuren.", "Hands on faders, screen full of tracks."),
              mediaPrompt: "Mixing session, hands on console, screens with tracks, vertical",
            }),
            beat({
              role: "transformation",
              priority: 1,
              weight: 1.1,
              title: ctx.L("Master", "Master"),
              text: ctx.L("Fertiges Master", "Finished master"),
              voiceover: ctx.L("Und am Ende steht ein Master, das auf jeder Anlage funktioniert.", "And at the end there is a master that works on every system."),
              visual: ctx.L("Wellenform füllt sich, Farbe wird warm.", "Waveform fills out, colour turns warm."),
              mediaPrompt: "Full loud mastered waveform, warm light, vertical",
              assetHint: "before_after",
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 32),
              subline: d.priceOnRequest ? ctx.L("Preis auf Anfrage", "Price on request") : d.price,
              voiceover: ctx.cta,
              visual: ctx.L("Kontakt-Karte.", "Contact card."),
              mediaPrompt: "Contact end card, dark, vertical",
            }),
          ],
        };
      },
    },
  ];
}

/* ------------------- product / service / event / custom ------------------ */

function genericArchetypes(): Archetype[] {
  return [
    {
      id: "problem_promise_proof",
      favouredTones: ["professional", "aggressive", "futuristic", "minimalistic"],
      build: (ctx) => {
        const highlights = genericHighlights(ctx);
        return {
          title: ctx.L(`Problem · Versprechen · Beweis: ${ctx.subject}`, `Problem · promise · proof: ${ctx.subject}`),
          bigIdea: ctx.L(
            `Klassisches Direct-Response-Gerüst, zugeschnitten auf ${ctx.subject}: Problem benennen, Lösung zeigen, mit einem konkreten Detail belegen, CTA.`,
            `A classic direct response scaffold tailored to ${ctx.subject}: name the problem, show the solution, back it with one concrete detail, CTA.`,
          ),
          audience: ctx.audience,
          hook: short(firstSentence(ctx.brief.description, ctx.L("Das kostet dich jede Woche Zeit.", "This costs you time every week.")), 70),
          callToAction: ctx.cta,
          caption: `${short(ctx.brief.description, 120)} ${ctx.cta}`,
          hashtags: hashtagsFor(ctx, [ctx.subject]),
          rationale: ctx.L(
            `Das Gerüst funktioniert, weil jeder Schritt eine Frage beantwortet, die der Zuschauer ohnehin stellt. Ton: ${ctx.toneWord}.`,
            `The scaffold works because every step answers a question the viewer already has. Tone: ${ctx.toneWord}.`,
          ),
          musicNote: ctx.L("Unauffälliger Beat, Voice-over dominiert.", "Unobtrusive beat, voice-over leads."),
          styleId: ctx.brief.tone === "luxurious" ? "dark_luxury" : "clean_product",
          beats: [
            beat({
              role: "problem",
              priority: 1,
              weight: 1,
              title: ctx.L("Problem", "Problem"),
              text: short(ctx.L("Kennst du das?", "Sound familiar?"), 34),
              subline: short(firstSentence(ctx.brief.description, ""), 60),
              voiceover: firstSentence(ctx.brief.description, ctx.L("Es gibt ein Problem, das immer wieder auftaucht.", "There is a problem that keeps coming back.")),
              visual: ctx.L("Alltagsszene, in der das Problem sichtbar wird.", "Everyday scene where the problem shows."),
              mediaPrompt: `Everyday scene illustrating the problem "${short(ctx.brief.description, 60)}", vertical 9:16`,
            }),
            beat({
              role: "offer",
              priority: 1,
              weight: 1.1,
              title: ctx.subject,
              text: short(ctx.subject, 34),
              subline: short(highlights[0] ?? "", 46),
              voiceover: ctx.L(`Genau dafür gibt es ${ctx.subject}.`, `That is exactly what ${ctx.subject} is for.`),
              visual: ctx.L("Produkt/Angebot zentriert, Licht zieht an.", "Product/offer centred, light lifts."),
              mediaPrompt: `Hero shot of ${ctx.subject}, studio light, vertical`,
              assetHint: "user_media",
              sourceKind: "user_upload",
            }),
            ...highlights.slice(0, 3).map((highlight, index) =>
              beat({
                role: "feature",
                priority: index === 0 ? 2 : index === 1 ? 3 : 4,
                weight: 0.9,
                title: short(highlight, 24),
                text: short(highlight, 40),
                voiceover: highlight,
                visual: ctx.L("Detail, das den Punkt belegt.", "Detail that backs the point."),
                mediaPrompt: `Detail shot supporting "${highlight}", vertical`,
              }),
            ),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 34),
              subline: ctx.brief.targetUrl ? hostOf(ctx.brief.targetUrl) : "",
              voiceover: ctx.cta,
              visual: ctx.L("Endkarte mit Logo.", "End card with logo."),
              mediaPrompt: "Clean end card, vertical",
              assetHint: "logo",
            }),
          ],
        };
      },
    },
    {
      id: "three_reasons",
      favouredTones: ["professional", "minimalistic", "humorous", "futuristic"],
      build: (ctx) => {
        const highlights = genericHighlights(ctx);
        return {
          title: ctx.L(`3 Gründe für ${ctx.subject}`, `3 reasons for ${ctx.subject}`),
          bigIdea: ctx.L(
            `Ein Listenvideo mit sichtbarem Fortschritt. Jeder Grund bekommt ein eigenes Bild und einen Satz – schnell konsumierbar, gut teilbar.`,
            `A list video with visible progress. Every reason gets its own visual and one sentence - quick to consume, easy to share.`,
          ),
          audience: ctx.audience,
          hook: ctx.L(`3 Gründe, warum ${ctx.subject} funktioniert:`, `3 reasons why ${ctx.subject} works:`),
          callToAction: ctx.cta,
          caption: `${ctx.subject}: ${highlights.slice(0, 3).join(" · ")}. ${ctx.cta}`,
          hashtags: hashtagsFor(ctx, [ctx.subject, ...highlights.slice(0, 2)]),
          rationale: ctx.L(
            "Zahlen im Hook setzen eine Erwartung und der Zähler hält sie offen. Für Zuschauer, die das Angebot schon kennen, ist das die schnellste Entscheidungshilfe.",
            "A number in the hook sets an expectation and the counter keeps it open. For viewers who already know the offer this is the fastest decision aid.",
          ),
          musicNote: ctx.L("Schnitte auf den Beat.", "Cuts on the beat."),
          styleId: "fast_promo",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 0.9,
              title: ctx.L("Listen-Hook", "List hook"),
              text: ctx.L("3 Gründe", "3 reasons"),
              subline: short(ctx.subject, 40),
              voiceover: ctx.L(`Drei Gründe für ${ctx.subject}.`, `Three reasons for ${ctx.subject}.`),
              visual: ctx.L("Titelkarte mit großer Zahl.", "Title card with a large number."),
              mediaPrompt: `Bold numeric title card for ${ctx.subject}, vertical`,
            }),
            ...highlights.slice(0, 3).map((highlight, index) =>
              beat({
                role: "feature",
                priority: index === 0 ? 1 : index === 1 ? 2 : 3,
                weight: 1,
                title: `${index + 1}. ${short(highlight, 22)}`,
                text: short(highlight, 38),
                subline: `${index + 1}/3`,
                voiceover: highlight,
                visual: ctx.L("Bild, das den Grund zeigt.", "Visual showing the reason."),
                mediaPrompt: `Vertical visual for "${highlight}", vibrant, vertical`,
              }),
            ),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 34),
              subline: ctx.brief.targetUrl ? hostOf(ctx.brief.targetUrl) : "",
              voiceover: ctx.cta,
              visual: ctx.L("Endkarte, Farbe zieht an.", "End card, colour lifts."),
              mediaPrompt: "Bold end card, vertical",
              assetHint: "logo",
            }),
          ],
        };
      },
    },
    {
      id: "day_in_life",
      favouredTones: ["ugc", "emotional", "humorous", "luxurious"],
      build: (ctx) => {
        const highlights = genericHighlights(ctx);
        return {
          title: ctx.L(`Mini-Story rund um ${ctx.subject}`, `Mini story around ${ctx.subject}`),
          bigIdea: ctx.L(
            `Statt Features zu erklären, wird ein kurzer Moment gezeigt, in dem ${ctx.subject} den Unterschied macht. Erzählt in Bildern, der CTA kommt erst am Ende.`,
            `Instead of explaining features, it shows a short moment where ${ctx.subject} makes the difference. Told in images, the CTA only lands at the end.`,
          ),
          audience: ctx.audience,
          hook: ctx.L("Der Moment, in dem es klick macht:", "The moment it clicks:"),
          callToAction: ctx.cta,
          caption: `${short(ctx.brief.goal || ctx.brief.description, 110)} ${ctx.cta}`,
          hashtags: hashtagsFor(ctx, [ctx.subject]),
          rationale: ctx.L(
            "Story-Formate erzeugen mehr Weiterleitungen als Feature-Listen, weil sie ein Gefühl transportieren. Der späte CTA senkt den Werbe-Eindruck in den ersten Sekunden.",
            "Story formats get shared more than feature lists because they carry a feeling. The late CTA lowers the ad perception in the first seconds.",
          ),
          musicNote: ctx.L("Warmer, langsamer Loop, steigert sich zum CTA.", "Warm slow loop that lifts towards the CTA."),
          styleId: ctx.brief.tone === "luxurious" ? "dark_luxury" : "cinematic",
          beats: [
            beat({
              role: "hook",
              priority: 1,
              weight: 1.1,
              title: ctx.L("Szene", "Scene"),
              text: "",
              voiceover: ctx.L("Es ist der Moment kurz bevor alles zu viel wird.", "It is the moment right before it all gets too much."),
              visual: ctx.L("Ruhige Beobachtung, natürliches Licht.", "Calm observation, natural light."),
              mediaPrompt: `Cinematic everyday moment related to ${ctx.subject}, natural light, vertical 9:16`,
            }),
            beat({
              role: "transformation",
              priority: 1,
              weight: 1.1,
              title: ctx.L("Wende", "Shift"),
              text: short(highlights[0] ?? ctx.subject, 40),
              voiceover: ctx.L(`Und dann kommt ${ctx.subject} ins Spiel.`, `And then ${ctx.subject} comes in.`),
              visual: ctx.L("Handlung ändert sich, Licht wird wärmer.", "The action shifts, light warms up."),
              mediaPrompt: `Cinematic shot of ${ctx.subject} in use, warm light, vertical`,
              assetHint: "user_media",
              sourceKind: "user_upload",
            }),
            beat({
              role: "proof",
              priority: 2,
              weight: 1,
              title: short(highlights[1] ?? ctx.L("Detail", "Detail"), 24),
              text: short(highlights[1] ?? "", 40),
              voiceover: highlights[1] ?? "",
              visual: ctx.L("Detail, das den Unterschied zeigt.", "Detail showing the difference."),
              mediaPrompt: `Close detail supporting "${highlights[1] ?? ctx.subject}", vertical`,
            }),
            beat({
              role: "cta",
              priority: 1,
              weight: 0.9,
              title: "CTA",
              text: short(ctx.cta, 34),
              subline: ctx.brief.targetUrl ? hostOf(ctx.brief.targetUrl) : "",
              voiceover: ctx.cta,
              visual: ctx.L("Ruhige Endkarte.", "Calm end card."),
              mediaPrompt: "Cinematic end card, vertical",
              assetHint: "logo",
            }),
          ],
        };
      },
    },
  ];
}

function genericHighlights(ctx: Ctx): string[] {
  const { brief } = ctx;
  const fallback = [
    ctx.L("Spart Zeit", "Saves time"),
    ctx.L("Klarer Preis", "Clear pricing"),
    ctx.L("Sofort startklar", "Ready right away"),
  ];
  switch (brief.category) {
    case "product":
      return listOr([...brief.details.keyBenefits, brief.details.usp], fallback);
    case "service":
      return listOr([...brief.details.deliverables, brief.details.problemSolved], fallback);
    case "event":
      return listOr(
        [
          brief.details.eventDate ? ctx.L(`Am ${brief.details.eventDate}`, `On ${brief.details.eventDate}`) : "",
          brief.details.venue,
          ...brief.details.lineup,
          brief.details.ticketPrice,
        ],
        fallback,
      );
    case "custom":
      return listOr([...brief.details.highlights, ...brief.details.proofPoints], fallback);
    default:
      return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                  */
/* -------------------------------------------------------------------------- */

function archetypesFor(brief: ProjectBrief): Archetype[] {
  switch (brief.category) {
    case "music":
      return musicArchetypes();
    case "website":
      return websiteArchetypes();
    case "app":
      return appArchetypes();
    case "mixing_mastering":
      return mixingArchetypes();
    default:
      return genericArchetypes();
  }
}

/**
 * Picks `count` archetypes: those matching the requested tone rank first, the
 * rest fill up. A per-project hash rotates the pool so two projects with the
 * same tone do not always get an identical set.
 */
export function selectArchetypeIds(brief: ProjectBrief, count = 3): string[] {
  const pool = archetypesFor(brief);
  const rotation = hashString(`${brief.name}|${brief.description}`) % Math.max(1, pool.length);
  const rotated = [...pool.slice(rotation), ...pool.slice(0, rotation)];
  const favoured = rotated.filter((archetype) => archetype.favouredTones.includes(brief.tone));
  const others = rotated.filter((archetype) => !archetype.favouredTones.includes(brief.tone));
  return [...favoured, ...others].slice(0, count).map((archetype) => archetype.id);
}

/**
 * Builds `count` distinct concept drafts for a brief. Deterministic: the same
 * brief always yields the same concepts, which keeps tests and the demo
 * workflow reproducible.
 */
export function composeConcepts(brief: ProjectBrief, count = 3): ConceptDraft[] {
  const ctx = buildContext(brief);
  const pool = archetypesFor(brief);
  const byId = new Map(pool.map((archetype) => [archetype.id, archetype]));
  return selectArchetypeIds(brief, count)
    .map((id) => byId.get(id))
    .filter((archetype): archetype is Archetype => Boolean(archetype))
    .map((archetype) => archetype.build(ctx));
}

/** Alternative hooks for the currently selected concept. */
export function composeHooks(brief: ProjectBrief, count = 5): string[] {
  const ctx = buildContext(brief);
  const s = ctx.subject;
  const candidates = ctx.lang === "de"
    ? [
        `Stopp – das musst du bei ${s} wissen.`,
        `Niemand redet darüber, aber ${s} macht genau das.`,
        `Ich hätte ${s} fast übersehen.`,
        `Wenn du ${short(ctx.audience, 30)} bist, bleib kurz hier.`,
        `In ${ctx.brief.durationSeconds} Sekunden verstehst du ${s}.`,
        `Der häufigste Fehler bei ${s}:`,
        `Das hier hätte ich früher wissen sollen.`,
        `${s} – in einem Satz erklärt.`,
      ]
    : [
        `Stop - here is what you need to know about ${s}.`,
        `Nobody talks about it, but ${s} does exactly this.`,
        `I almost scrolled past ${s}.`,
        `If you are ${short(ctx.audience, 30)}, stay for a second.`,
        `You will get ${s} in ${ctx.brief.durationSeconds} seconds.`,
        `The most common mistake with ${s}:`,
        `I wish I had known this earlier.`,
        `${s} - explained in one sentence.`,
      ];

  const offset = Math.floor(ctx.rnd("hooks") * candidates.length);
  return Array.from({ length: Math.min(count, candidates.length) }, (_, index) =>
    candidates[(offset + index) % candidates.length],
  );
}
