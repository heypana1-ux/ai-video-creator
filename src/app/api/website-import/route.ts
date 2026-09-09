import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handleAuthed, readJson } from "@/lib/api/route";
import { serverEnv } from "@/lib/config/env";
import { websiteImportSchema } from "@/lib/domain/schemas";
import { extractPage } from "@/lib/url-analysis/extract";
import { fetchPublicPage } from "@/lib/url-analysis/fetch";
import { UrlGuardError } from "@/lib/url-analysis/guard";

/**
 * Imports a public landing page. Everything extracted is returned for review -
 * nothing is written to the project until the user confirms it in the wizard.
 */
export async function POST(request: Request) {
  return handleAuthed(async (session) => {
    const limit = rateLimit(
      clientKey(request, `import:${session.workspace.id}`),
      serverEnv.rateLimits.generationPerMin,
    );
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const { url } = websiteImportSchema.parse(await readJson(request));

    try {
      const page = await fetchPublicPage(url);
      const extracted = extractPage(page.html, page.finalUrl);
      return {
        finalUrl: page.finalUrl,
        byteSize: page.byteSize,
        extracted,
        notice:
          "Bitte prüfe alle übernommenen Inhalte. Sie stammen automatisch von der Seite und können ungenau sein.",
      };
    } catch (error) {
      if (error instanceof UrlGuardError) throw ApiError.badRequest(error.message);
      throw ApiError.badRequest("Die Seite konnte nicht geladen werden.");
    }
  });
}
