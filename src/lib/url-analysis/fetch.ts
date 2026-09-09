import { UrlGuardError, assertPublicUrl, type Resolver } from "./guard";

/**
 * Fetches a public web page with SSRF-safe redirect handling.
 *
 * Redirects are never followed by `fetch` itself: every hop is re-validated
 * against the guard, which is what stops a public URL from bouncing into the
 * internal network. The body is capped and only HTML is accepted.
 */

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const USER_AGENT = "AdReelBot/1.0 (+https://adreel.local/bot)";

export interface FetchedPage {
  finalUrl: string;
  html: string;
  byteSize: number;
  contentType: string;
}

export interface SafeFetchOptions {
  resolver?: Resolver;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export async function fetchPublicPage(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<FetchedPage> {
  const doFetch = options.fetchImpl ?? fetch;
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current, options.resolver);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const response = await doFetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "de,en;q=0.8",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new UrlGuardError("invalid_url", "Weiterleitung ohne Ziel erhalten.");
        }
        current = new URL(location, url).toString();
        continue;
      }

      if (!response.ok) {
        throw new UrlGuardError(
          "invalid_url",
          `Die Seite antwortete mit Status ${response.status}.`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml/i.test(contentType)) {
        throw new UrlGuardError("not_html", "Die URL liefert keine HTML-Seite.");
      }

      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (declaredLength > MAX_BYTES) {
        throw new UrlGuardError("too_large", "Die Seite ist zu groß für die Analyse.");
      }

      const buffer = await readCapped(response);
      return {
        finalUrl: url.toString(),
        html: new TextDecoder("utf-8").decode(buffer),
        byteSize: buffer.byteLength,
        contentType,
      };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  throw new UrlGuardError("too_many_redirects", "Zu viele Weiterleitungen.");
}

/** Reads at most MAX_BYTES so a huge response cannot exhaust memory. */
async function readCapped(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new UrlGuardError("too_large", "Die Seite ist zu groß für die Analyse.");
      }
      chunks.push(value);
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}
