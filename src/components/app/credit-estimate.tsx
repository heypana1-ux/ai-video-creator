"use client";

import { Coins } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CreditEstimate } from "@/lib/credits/pricing";
import { formatCredits } from "@/lib/util/format";

/**
 * Shows the itemised credit cost before a paid generation is started.
 * Required by design: nothing is charged without this being visible first.
 */
export function CreditEstimateBox({
  estimate,
  balance,
  demoMode,
}: {
  estimate: CreditEstimate;
  balance: number;
  demoMode: boolean;
}) {
  const affordable = balance >= estimate.total;

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Coins className="size-4 text-amber-brand" />
          Geschätzte Kosten
        </span>
        <Badge tone={affordable ? "amber" : "danger"}>
          {formatCredits(estimate.total)} Credits
        </Badge>
      </div>

      {estimate.lines.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-chalk-faint">
          {estimate.lines.map((line) => (
            <li key={line.operation} className="flex justify-between gap-3">
              <span>
                {line.label}
                {line.units > 1 ? ` × ${line.units}` : ""}
              </span>
              <span>{formatCredits(line.credits)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-xs text-chalk-faint">
        Guthaben: {formatCredits(balance)} Credits
        {demoMode ? " · Im Demo-Modus entstehen keine echten Kosten." : ""}
      </p>
      {!affordable ? (
        <p className="mt-1 text-xs text-danger">
          Das Guthaben reicht nicht aus. Unter „Credits“ kannst du es aufladen.
        </p>
      ) : null}
    </div>
  );
}
