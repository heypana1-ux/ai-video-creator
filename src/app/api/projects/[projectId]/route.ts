import { loadProject } from "@/lib/api/context";
import { handleAuthed, readJson } from "@/lib/api/route";
import { getProviders } from "@/lib/ai/registry";
import { getRepository } from "@/lib/db";
import { updateProjectSchema } from "@/lib/domain/schemas";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    const [concepts, renderJobs, exports, generationJobs] = await Promise.all([
      repo.listConcepts(session.workspace.id, project.id),
      repo.listRenderJobs(session.workspace.id, project.id),
      repo.listExports(session.workspace.id, project.id),
      repo.listGenerationJobs(session.workspace.id, project.id),
    ]);
    return { project, concepts, renderJobs, exports, generationJobs };
  });
}

export async function PATCH(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    const patch = updateProjectSchema.parse(await readJson(request));

    const updated = await repo.updateProject(session.workspace.id, project.id, {
      ...patch,
      ...(patch.brief
        ? {
            name: patch.name ?? patch.brief.name,
            category: patch.brief.category,
            durationSeconds: patch.brief.durationSeconds,
          }
        : {}),
    });
    return { project: updated };
  });
}

export async function DELETE(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);

    // Remove stored media before the rows that point at it disappear.
    const providers = getProviders();
    const [assets, exports] = await Promise.all([
      repo.listAssets(session.workspace.id, project.id),
      repo.listExports(session.workspace.id, project.id),
    ]);
    for (const item of [...assets, ...exports]) {
      await providers.storage.remove(item.storageKey).catch(() => undefined);
    }

    await repo.deleteProject(session.workspace.id, project.id);
    return { ok: true };
  });
}

export async function POST(request: Request, context: Context) {
  // Rename shortcut used by the dashboard's inline editor.
  return handleAuthed(async (session) => {
    const { projectId } = await context.params;
    const body = await readJson<{ name?: string }>(request);
    const repo = await getRepository();
    const updated = await repo.updateProject(session.workspace.id, projectId, {
      name: (body.name ?? "").trim().slice(0, 120) || undefined,
    });
    return { project: updated };
  });
}
