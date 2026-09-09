import { ApiError } from "@/lib/api/errors";
import { handleAuthed, readJson } from "@/lib/api/route";
import { getRepository } from "@/lib/db";
import { createProjectSchema } from "@/lib/domain/schemas";
import { randomId } from "@/lib/util/id";

export async function GET() {
  return handleAuthed(async (session) => {
    const repo = await getRepository();
    return { projects: await repo.listProjects(session.workspace.id) };
  });
}

export async function POST(request: Request) {
  return handleAuthed(async (session) => {
    const input = createProjectSchema.parse(await readJson(request));
    const repo = await getRepository();

    if (input.brandKitId) {
      const kit = await repo.getBrandKit(session.workspace.id, input.brandKitId);
      if (!kit) throw ApiError.badRequest("Brand-Kit nicht gefunden.");
    }

    const project = await repo.createProject({
      id: randomId("prj"),
      workspaceId: session.workspace.id,
      ownerId: session.user.id,
      name: input.brief.name,
      category: input.brief.category,
      status: "draft",
      brief: input.brief,
      selectedConceptId: null,
      thumbnailUrl: null,
      durationSeconds: input.brief.durationSeconds,
      brandKitId: input.brandKitId,
    });

    return { project };
  });
}
