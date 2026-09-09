import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getProviderStatuses } from "@/lib/ai/registry";
import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config/env";
import { formatDateTime } from "@/lib/util/format";

export const metadata: Metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  text: "Texte & Konzepte",
  image: "Bildgenerierung",
  video: "Videogenerierung",
  voice: "Voice-over",
  music: "Musik",
  render: "Rendering",
  storage: "Speicher",
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const providers = await getProviderStatuses();
  const demo = isDemoMode();

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-sm text-chalk-faint">
          Konto, Workspace und angebundene KI-Anbieter.
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-chalk-faint">
              Konto
            </h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ["Name", session.user.displayName || "–"],
                ["E-Mail", session.user.email],
                ["Workspace", session.workspace.name],
                ["Registriert", formatDateTime(session.user.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-ink-800 py-1.5">
                  <dt className="text-chalk-faint">{label}</dt>
                  <dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-chalk-faint">
                KI-Anbieter
              </h2>
              <Badge tone={demo ? "violet" : "mint"}>
                {demo ? "Demo-Modus" : "Produktivmodus"}
              </Badge>
            </div>

            <ul className="space-y-2">
              {providers.map((provider) => (
                <li
                  key={`${provider.kind}-${provider.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-850 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {KIND_LABELS[provider.kind] ?? provider.kind}
                      <span className="font-mono text-xs text-chalk-faint">{provider.id}</span>
                      {provider.isDemo ? <Badge tone="violet">Demo</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-chalk-faint">{provider.detail}</p>
                  </div>
                  {provider.available ? (
                    <CheckCircle2 className="size-4 shrink-0 text-mint" aria-label="verfügbar" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-danger" aria-label="nicht verfügbar" />
                  )}
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs text-chalk-faint">
              Anbieter werden über Environment-Variablen umgestellt. Details stehen in{" "}
              <code className="rounded bg-ink-800 px-1">docs/PROVIDERS.md</code>. API-Keys
              bleiben ausschließlich auf dem Server.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-5 text-sm text-chalk-dim">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-chalk-faint">
              Daten und Rechte
            </h2>
            <p>
              Projekte und Assets kannst du jederzeit löschen – dabei werden auch die
              gespeicherten Dateien entfernt.
            </p>
            <p>
              KI-generierte Inhalte sind im Editor und im Export gekennzeichnet. AdReel
              erzeugt keine erfundenen Bewertungen, Testimonials oder Leistungsversprechen.
            </p>
            <p className="flex gap-4 pt-2">
              <Link href="/legal/privacy" className="text-electric hover:underline">
                Datenschutz
              </Link>
              <Link href="/legal/terms" className="text-electric hover:underline">
                Nutzungsbedingungen
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
