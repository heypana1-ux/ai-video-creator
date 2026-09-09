import { handleAuthed } from "@/lib/api/route";
import { CREDIT_COSTS, PLANS } from "@/lib/credits/pricing";
import { getRepository } from "@/lib/db";

export async function GET() {
  return handleAuthed(async (session) => {
    const repo = await getRepository();
    const [transactions, usage, subscription, workspace] = await Promise.all([
      repo.listCreditTransactions(session.workspace.id, 50),
      repo.listProviderUsage(session.workspace.id, 50),
      repo.getSubscription(session.workspace.id),
      repo.getWorkspace(session.workspace.id),
    ]);
    return {
      balance: workspace?.credits ?? session.workspace.credits,
      transactions,
      usage,
      subscription,
      costs: CREDIT_COSTS,
      plans: PLANS,
    };
  });
}
