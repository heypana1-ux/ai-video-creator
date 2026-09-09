import { ApiError } from "@/lib/api/errors";
import type { Repository } from "@/lib/db";
import { estimateCredits, type CreditEstimate, type GenerationPlan } from "@/lib/credits/pricing";
import { isDemoMode } from "@/lib/config/env";

/**
 * Credit accounting for paid operations.
 *
 * Credits are reserved before the work starts and refunded when it fails or is
 * cancelled, so a crashed job never silently costs the user anything.
 */

export interface Reservation {
  estimate: CreditEstimate;
  balanceAfter: number;
}

export async function reserveCredits(
  repo: Repository,
  input: { workspaceId: string; projectId?: string | null; plan: GenerationPlan; reason: string },
): Promise<Reservation> {
  const estimate = estimateCredits(input.plan);
  if (estimate.total === 0) {
    const workspace = await repo.getWorkspace(input.workspaceId);
    return { estimate, balanceAfter: workspace?.credits ?? 0 };
  }

  const workspace = await repo.getWorkspace(input.workspaceId);
  if (!workspace) throw ApiError.notFound("Workspace nicht gefunden.");

  if (workspace.credits < estimate.total) {
    throw ApiError.payment(
      `Nicht genug Credits: ${estimate.total} benötigt, ${workspace.credits} verfügbar.`,
    );
  }

  const { balance } = await repo.addCreditTransaction({
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    amount: -estimate.total,
    reason: input.reason,
  });

  return { estimate, balanceAfter: balance };
}

export async function refundCredits(
  repo: Repository,
  input: { workspaceId: string; projectId?: string | null; amount: number; reason: string },
): Promise<void> {
  if (input.amount <= 0) return;
  await repo.addCreditTransaction({
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    amount: input.amount,
    reason: input.reason,
  });
}

/**
 * Demo mode still books credits so the UI and the ledger behave realistically,
 * but nothing is ever charged upstream because only mock providers run.
 */
export function costsRealMoney(): boolean {
  return !isDemoMode();
}
