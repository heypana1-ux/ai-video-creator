import { getProviders } from "@/lib/ai/registry";
import { loadConcept, loadProject } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handleAuthed } from "@/lib/api/route";
import { serverEnv } from "@/lib/config/env";
import { generateHooks } from "@/lib/concepts/engine";
import { estimateCredits } from "@/lib/credits/pricing";
import { reserveCredits } from "@/lib/jobs/credits";

type Context = { params: Promise<{ projectId: string; conceptId: string }> };

/** Generates alternative hooks. Fast enough to run inline, no job needed. */
export async function POST(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const limit = rateLimit(
      clientKey(request, `hooks:${session.workspace.id}`),
      serverEnv.rateLimits.generationPerMin,
    );
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const { projectId, conceptId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    await loadConcept(repo, session, project, conceptId);

    await reserveCredits(repo, {
      workspaceId: session.workspace.id,
      projectId: project.id,
      plan: { hooks: 1 },
      reason: "Alternative Hooks",
    });

    const result = await generateHooks(getProviders().text, project.brief, 5);
    return {
      hooks: result.hooks,
      usedFallback: result.usedFallback,
      estimate: estimateCredits({ hooks: 1 }),
    };
  });
}
