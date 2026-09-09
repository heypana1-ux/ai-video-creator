import { staticFile } from "remotion";

/** Path prefix of the authenticated media route in the Next.js app. */
export const MEDIA_ROUTE_PREFIX = "/api/media/";

/**
 * Resolves a media reference from a `VideoSpec`.
 *
 * The same spec is consumed by two very different runtimes:
 *
 * - In the browser `<Player>` the app is running, so `/api/media/<key>` URLs
 *   work directly. `assetBaseUrl` is non-empty there.
 * - During rendering there is no Next.js server. The media directory is passed
 *   to the bundler as `publicDir`, so keys resolve through `staticFile`.
 *   `assetBaseUrl` is empty in that case.
 *
 * Absolute URLs (real providers, Supabase signed URLs) are always used as-is.
 */
export function resolveAsset(reference: string | null, assetBaseUrl: string): string | null {
  if (!reference) return null;
  if (/^(https?:|data:|blob:)/i.test(reference)) return reference;

  if (reference.startsWith(MEDIA_ROUTE_PREFIX)) {
    if (assetBaseUrl) return reference;
    const key = reference
      .slice(MEDIA_ROUTE_PREFIX.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    return staticFile(key);
  }

  const key = reference.replace(/^\/+/, "");
  return assetBaseUrl ? `${assetBaseUrl.replace(/\/$/, "")}/${key}` : staticFile(key);
}
