"use client";

import * as React from "react";

import { cn } from "@/lib/util/cn";

const FRAMES = [
  {
    label: "Hook · 0-2 s",
    headline: "Ton an.",
    subline: "NOVA — Midnight Drive",
    caption: "DIESER PART GEHT",
    gradient: "linear-gradient(150deg,#2E1065,#7E22CE,#DB2777)",
  },
  {
    label: "Szene 2 · 2-6 s",
    headline: "Out now",
    subline: "überall verfügbar",
    caption: "NICHT MEHR AUS DEM KOPF",
    gradient: "linear-gradient(150deg,#1E1B4B,#701A75,#BE185D)",
  },
  {
    label: "Szene 3 · 6-11 s",
    headline: "Für Late-Night-Drives",
    subline: "Synthwave · 2026",
    caption: "LINK IN DER BIO",
    gradient: "linear-gradient(150deg,#04010F,#3B0764,#0891B2)",
  },
  {
    label: "CTA · 11-15 s",
    headline: "Jetzt streamen",
    subline: "nova.link/midnight",
    caption: "JETZT STREAMEN",
    gradient: "linear-gradient(150deg,#4C0519,#581C87,#0A0416)",
  },
];

/**
 * Animated 9:16 mockup for the landing page. Pure CSS/React - no video file to
 * download, and it demonstrates the actual scene structure the editor produces.
 */
export function PhoneMockup({ className }: { className?: string }) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % FRAMES.length), 2600);
    return () => clearInterval(timer);
  }, []);

  const frame = FRAMES[index];

  return (
    <div className={cn("relative mx-auto w-[min(78vw,17rem)]", className)}>
      <div className="absolute -inset-8 -z-10 aurora blur-2xl" aria-hidden />
      <div className="relative aspect-[9/16] overflow-hidden rounded-[2rem] border border-ink-600 bg-ink-900 shadow-panel">
        {FRAMES.map((item, itemIndex) => (
          <div
            key={item.label}
            aria-hidden={itemIndex !== index}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ background: item.gradient, opacity: itemIndex === index ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 animate-drift bg-[radial-gradient(45%_35%_at_30%_25%,rgba(255,255,255,0.25),transparent_70%)]" />
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black/75" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-white/70">
          <span>9:16 · 1080×1920</span>
          <span className="rounded-full border border-white/25 bg-black/35 px-2 py-0.5">Demo</span>
        </div>

        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-5 text-center">
          <p
            key={`${frame.label}-headline`}
            className="animate-rise text-2xl font-black leading-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.6)]"
          >
            {frame.headline}
          </p>
          <p className="mt-2 text-xs font-medium text-white/75">{frame.subline}</p>
        </div>

        <div className="absolute inset-x-0 bottom-24 px-4 text-center">
          <span className="inline-block rounded-lg bg-black/55 px-2 py-1 text-[13px] font-black tracking-wide text-white">
            {frame.caption.split(" ").map((word, wordIndex) => (
              <span key={word} className={wordIndex === 1 ? "text-amber-brand" : undefined}>
                {word}{" "}
              </span>
            ))}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
          <div className="flex gap-1">
            {FRAMES.map((item, itemIndex) => (
              <span
                key={item.label}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  itemIndex === index ? "bg-white" : "bg-white/25",
                )}
              />
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-widest text-white/60">{frame.label}</p>
        </div>
      </div>
    </div>
  );
}
