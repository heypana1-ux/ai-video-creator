import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config/env";
import { CREDIT_COSTS, PLANS } from "@/lib/credits/pricing";
import { getRepository } from "@/lib/db";
import { formatCredits, formatDateTime } from "@/lib/util/format";

export const metadata: Metadata = { title: "Credits" };
export const dynamic = "force-dynamic";

const COST_LABELS: Record<keyof typeof CREDIT_COSTS, string> = {
  concepts: "Konzeptgenerierung (3 Konzepte)",
  sceneRewrite: "Szene neu texten",
  hooks: "Alternative Hooks",
  image: "KI-Bild",
  videoClipPer5s: "KI-Videoclip (je 5 s)",
  voicePer15s: "Voice-over (je 15 s)",
  music: "Hintergrundmusik",
  websiteImport: "Website-Analyse",
  renderPreview: "Vorschau-Rendering",
  renderFinal: "Finaler Export",
};

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const repo = await getRepository();
  const [transactions, usage, subscription, workspace] = await Promise.all([
    repo.listCreditTransactions(session.workspace.id, 30),
    repo.listProviderUsage(session.workspace.id, 20),
    repo.getSubscription(session.workspace.id),
    repo.getWorkspace(session.workspace.id),
  ]);

  const balance = workspace?.credits ?? session.workspace.credits;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credits & Abrechnung</h1>
          <p className="mt-1 text-sm text-chalk-faint">
            Guthaben, Verbrauch und Preise pro Aktion.
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black">{formatCredits(balance)}</p>
          <p className="text-xs text-chalk-faint">Credits verfügbar</p>
        </div>
      </header>

      {isDemoMode() ? (
        <p className="mb-6 rounded-xl border border-violet-brand/35 bg-violet-brand/10 p-4 text-sm text-chalk-dim">
          <Badge tone="violet" className="mr-2">Demo-Modus</Badge>
          Credits werden vollständig simuliert. Es entstehen keine Kosten und es wird kein
          Zahlungsanbieter kontaktiert.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-chalk-faint">
              Preise pro Aktion
            </h2>
            <ul className="space-y-1.5 text-sm">
              {(Object.keys(CREDIT_COSTS) as Array<keyof typeof CREDIT_COSTS>).map((key) => (
                <li key={key} className="flex justify-between gap-4 border-b border-ink-800 py-1.5">
                  <span className="text-chalk-dim">{COST_LABELS[key]}</span>
                  <span className="font-medium">{CREDIT_COSTS[key]} Credits</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-chalk-faint">
                Tarif
              </h2>
              <Badge tone="amber">Platzhalter</Badge>
            </div>
            <p className="text-sm text-chalk-dim">
              Aktueller Tarif: <strong>{subscription?.plan ?? "demo"}</strong> ·{" "}
              {subscription?.creditsPerMonth ?? 500} Credits pro Monat
            </p>
            <ul className="mt-4 space-y-2">
              {PLANS.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-850 p-3 text-sm"
                >
                  <span>
                    <span className="font-medium">{plan.name}</span>
                    <span className="ml-2 text-xs text-chalk-faint">
                      {plan.creditsPerMonth} Credits
                    </span>
                  </span>
                  <span className="font-semibold">
                    {plan.priceEur === 0 ? "0 €" : `${plan.priceEur} €`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-chalk-faint">
              Die Zahlungsabwicklung ist noch nicht angebunden – die Tarife sind Platzhalter.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-chalk-faint">
              Credit-Bewegungen
            </h2>
            {transactions.length === 0 ? (
              <EmptyState
                title="Noch keine Buchungen"
                description="Sobald du Konzepte, Medien oder Exporte erzeugst, erscheinen sie hier."
              />
            ) : (
              <ul className="space-y-1">
                {transactions.map((transaction) => (
                  <li
                    key={transaction.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{transaction.reason}</span>
                      <span className="text-xs text-chalk-faint">
                        {formatDateTime(transaction.createdAt)}
                      </span>
                    </span>
                    <span
                      className={
                        transaction.amount < 0 ? "font-mono text-danger" : "font-mono text-mint"
                      }
                    >
                      {transaction.amount > 0 ? "+" : ""}
                      {formatCredits(transaction.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {usage.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardContent className="pt-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-chalk-faint">
                Provider-Nutzung
              </h2>
              <ul className="space-y-1 text-sm">
                {usage.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {entry.providerId} · {entry.operation}
                      </span>
                      <span className="text-xs text-chalk-faint">
                        {formatDateTime(entry.createdAt)} · {entry.durationMs} ms
                      </span>
                    </span>
                    <Badge tone={entry.success ? "mint" : "danger"}>
                      {entry.estimatedCostUsd > 0
                        ? `~$${entry.estimatedCostUsd.toFixed(3)}`
                        : "kostenfrei"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
