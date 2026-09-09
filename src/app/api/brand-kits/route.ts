import { handleAuthed, readJson } from "@/lib/api/route";
import { getRepository } from "@/lib/db";
import { brandKitSchema } from "@/lib/domain/schemas";
import { randomId } from "@/lib/util/id";

export async function GET() {
  return handleAuthed(async (session) => {
    const repo = await getRepository();
    return { brandKits: await repo.listBrandKits(session.workspace.id) };
  });
}

export async function POST(request: Request) {
  return handleAuthed(async (session) => {
    const input = brandKitSchema.parse(await readJson(request));
    const repo = await getRepository();
    const brandKit = await repo.createBrandKit({
      id: randomId("bk"),
      workspaceId: session.workspace.id,
      name: input.name,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      accentColor: input.accentColor,
      fontFamily: input.fontFamily,
      logoAssetId: input.logoAssetId ?? null,
    });
    return { brandKit };
  });
}
