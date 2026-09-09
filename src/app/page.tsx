import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Captions,
  Clapperboard,
  Download,
  Layers,
  MonitorSmartphone,
  Music4,
  PenLine,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  Wand2,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhoneMockup } from "@/components/marketing/phone-mockup";
import { isDemoMode } from "@/lib/config/env";
import { PLANS } from "@/lib/credits/pricing";
import { VIDEO_STYLES } from "@/lib/video/styles";

const CATEGORIES = [
  { icon: Music4, title: "Musik & Releases", copy: "Release-Teaser, Lyric-Videos, Visualizer und „Out now“-Ads." },
  { icon: MonitorSmartphone, title: "Websites & Landingpages", copy: "Screenshot-Touren, Einwand-Konter und klare Nutzenversprechen." },
  { icon: Layers, title: "Apps & Software", copy: "Problem-Lösung, Feature-Demos und kurze Tutorial-Clips." },
  { icon: AudioLines, title: "Mixing & Mastering", copy: "Vorher-Nachher-Vergleiche, Studio-Showcases und Angebotsvideos." },
  { icon: Store, title: "Produkte & Dienstleistungen", copy: "Direct-Response-Formate mit Preis, Nutzen und CTA." },
  { icon: Ticket, title: "Events & Eigene Angebote", copy: "Line-up, Datum, Tickets - oder komplett frei definiert." },
];

const STEPS = [
  { icon: PenLine, title: "1 · Briefing", copy: "Kategorie wählen und ein paar Felder ausfüllen. Mehr braucht es nicht." },
  { icon: Sparkles, title: "2 · Drei Konzepte", copy: "Hook, Skript, Szenenliste, Caption und Hashtags - konkret auf deinen Inhalt zugeschnitten." },
  { icon: Wand2, title: "3 · Editor", copy: "Szenen anpassen, Medien ersetzen, Texte animieren, Vorschau abspielen." },
  { icon: Download, title: "4 · Export", copy: "9:16-MP4 in 1080×1920 mit eingebrannten Untertiteln herunterladen." },
];

const VALUE_PROPS = [
  { icon: Clapperboard, title: "Vom Briefing zum Schnitt", copy: "Konzept, Storyboard, Visuals, Voice-over und Musik entstehen in einem Durchlauf." },
  { icon: Captions, title: "Untertitel, die sitzen", copy: "Wortgenaues Timing, hervorgehobenes Sprechwort und Safe Zones für TikTok und Reels." },
  { icon: ShieldCheck, title: "Ehrlich statt aufgeblasen", copy: "Keine erfundenen Testimonials, keine Fantasie-Zahlen. KI-Inhalte sind gekennzeichnet." },
];

const FAQ = [
  {
    q: "Brauche ich API-Keys, um AdReel auszuprobieren?",
    a: "Nein. Ohne konfigurierte Keys läuft die App im Demo-Modus: Konzepte, Medien, Voice-over und Musik kommen aus lokalen Demo-Providern. Das Rendering ist trotzdem echt - du bekommst eine abspielbare MP4-Datei.",
  },
  {
    q: "In welchem Format wird exportiert?",
    a: "MP4 mit H.264 in 1080×1920 (9:16) bei 30 FPS. Für schnelle Zwischenstände gibt es zusätzlich einen 720×1280-Vorschau-Export.",
  },
  {
    q: "Kann ich eigene KI-Anbieter anbinden?",
    a: "Ja. Text-, Bild-, Video-, Voice- und Musikgenerierung laufen über austauschbare Provider-Interfaces. Der Wechsel ist eine Environment-Variable - Adapter für OpenAI, Anthropic, Replicate und ElevenLabs sind enthalten.",
  },
  {
    q: "Was passiert mit meinen Uploads?",
    a: "Uploads liegen in deinem Workspace und werden nur signiert ausgeliefert. Du kannst Projekte und Assets jederzeit löschen. Für hochgeladenes Audio bestätigst du, dass du die nötigen Rechte besitzt.",
  },
  {
    q: "Erfindet die KI Kundenstimmen oder Erfolgszahlen?",
    a: "Nein - das ist bewusst ausgeschlossen. Testimonial-Formate liefern nur ein Skript-Gerüst mit markierten Platzhaltern, das du mit echten Aussagen füllst.",
  },
];

export default function LandingPage() {
  const demo = isDemoMode();

  return (
    <div className="min-h-dvh bg-ink-950">
      <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-violet-brand to-magenta-brand text-white">
              <Clapperboard className="size-4" />
            </span>
            AdReel<span className="text-violet-brand">AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-chalk-dim md:flex">
            <a href="#kategorien" className="transition-colors hover:text-chalk">Kategorien</a>
            <a href="#so-gehts" className="transition-colors hover:text-chalk">So funktioniert es</a>
            <a href="#vorlagen" className="transition-colors hover:text-chalk">Vorlagen</a>
            <a href="#preise" className="transition-colors hover:text-chalk">Preise</a>
            <a href="#faq" className="transition-colors hover:text-chalk">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Anmelden</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Kostenlos starten</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 aurora" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="animate-rise">
              {demo ? (
                <Badge tone="violet" className="mb-5">
                  <Sparkles className="size-3" />
                  Demo-Modus aktiv - komplett ohne API-Keys testbar
                </Badge>
              ) : null}
              <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Aus deiner Idee wird in Minuten ein{" "}
                <span className="text-gradient">fertiges Werbevideo.</span>
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-chalk-dim sm:text-lg">
                Erstelle automatisch TikToks, Reels und Shorts für deine Musik, Website, App
                oder Dienstleistung – inklusive Skript, Visuals, Voice-over und Untertiteln.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Jetzt Video erstellen <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Demo ansehen</Link>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 text-sm">
                {[
                  ["9:16", "1080 × 1920"],
                  ["3", "Konzepte pro Briefing"],
                  ["8", "Projektkategorien"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
                    <dt className="text-xl font-bold text-chalk">{value}</dt>
                    <dd className="text-xs text-chalk-faint">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <PhoneMockup />
          </div>
        </section>

        {/* Value props */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-4 md:grid-cols-3">
            {VALUE_PROPS.map((item) => (
              <Card key={item.title}>
                <CardContent className="pt-5">
                  <item.icon className="size-5 text-electric" />
                  <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-chalk-faint">{item.copy}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section id="kategorien" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-14">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Werbung für alles, was du anbietest
          </h2>
          <p className="mt-2 max-w-2xl text-chalk-faint">
            Jede Kategorie hat eigene Eingabefelder und eigene Werbe-Archetypen – kein
            Einheitsbrei, sondern Formate, die zum Inhalt passen.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((item) => (
              <Card key={item.title} className="transition-colors hover:border-violet-brand/45">
                <CardContent className="pt-5">
                  <item.icon className="size-5 text-violet-brand" />
                  <h3 className="mt-3 font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-chalk-faint">{item.copy}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="so-gehts" className="scroll-mt-20 border-y border-ink-800 bg-ink-900/40 py-16">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">So funktioniert es</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.title} className="surface-card p-5">
                  <step.icon className="size-5 text-magenta-brand" />
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-chalk-faint">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Template gallery */}
        <section id="vorlagen" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Video-Stile</h2>
          <p className="mt-2 max-w-2xl text-chalk-faint">
            Jede Vorlage bringt Farben, Typografie, Übergänge, Textanimationen, eine
            Standard-Szenenstruktur und eine eigene Audio-Mischung mit.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {VIDEO_STYLES.map((style) => (
              <article
                key={style.id}
                className="group overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"
              >
                <div
                  className="relative aspect-[9/16]"
                  style={{ background: `linear-gradient(155deg, ${style.gradient.join(", ")})` }}
                >
                  <div className="absolute inset-0 bg-linear-to-b from-black/25 to-black/70" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p
                      className="text-sm font-black uppercase leading-tight"
                      style={{ color: style.palette.text }}
                    >
                      {style.name}
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: style.palette.accent }}>
                      {style.sceneStructure.length} Szenen · {style.transitions[0]}
                    </p>
                  </div>
                </div>
                <p className="p-3 text-xs leading-relaxed text-chalk-faint">{style.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="preise" className="scroll-mt-20 border-y border-ink-800 bg-ink-900/40 py-16">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Preise</h2>
              <Badge tone="amber">Platzhalter – Abrechnung noch nicht angebunden</Badge>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {PLANS.map((plan) => (
                <Card
                  key={plan.id}
                  className={plan.id === "creator" ? "border-violet-brand/50 shadow-glow" : ""}
                >
                  <CardContent className="pt-5">
                    <p className="text-sm font-semibold text-chalk-dim">{plan.name}</p>
                    <p className="mt-2 text-3xl font-black">
                      {plan.priceEur === 0 ? "0 €" : `${plan.priceEur} €`}
                      <span className="ml-1 text-sm font-medium text-chalk-faint">/ Monat</span>
                    </p>
                    <p className="mt-1 text-xs text-chalk-faint">
                      {plan.creditsPerMonth} Credits pro Monat
                    </p>
                    <ul className="mt-4 space-y-1.5 text-sm text-chalk-dim">
                      {plan.highlights.map((highlight) => (
                        <li key={highlight}>· {highlight}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Häufige Fragen</h2>
          <Accordion type="single" collapsible className="mt-6">
            {FAQ.map((entry) => (
              <AccordionItem key={entry.q} value={entry.q}>
                <AccordionTrigger>{entry.q}</AccordionTrigger>
                <AccordionContent>{entry.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="relative overflow-hidden rounded-3xl border border-ink-700 p-10 text-center">
            <div className="absolute inset-0 aurora" aria-hidden />
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Dein nächstes Reel ist ein Briefing entfernt.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-chalk-dim">
                Starte im Demo-Modus, teste den kompletten Workflow und schalte echte
                KI-Provider frei, wenn du bereit bist.
              </p>
              <Button size="lg" className="mt-7" asChild>
                <Link href="/register">
                  Kostenlos starten <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-800 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 text-sm text-chalk-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AdReel AI</p>
          <nav className="flex gap-5">
            <Link href="/legal/privacy" className="hover:text-chalk">Datenschutz</Link>
            <Link href="/legal/terms" className="hover:text-chalk">Nutzungsbedingungen</Link>
            <Link href="/login" className="hover:text-chalk">Anmelden</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
