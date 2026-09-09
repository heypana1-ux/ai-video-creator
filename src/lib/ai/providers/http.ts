import { ProviderError, codeForStatus } from "../errors";

/**
 * Thin fetch wrapper shared by the real adapters. It converts non-2xx
 * responses into typed `ProviderError`s and never puts response bodies that
 * might echo the prompt into the message beyond a short excerpt.
 */
export async function providerFetch(
  providerId: string,
  url: string,
  init: RequestInit & { signal: AbortSignal },
): Promise<Response> {
  const response = await fetch(url, init);
  if (response.ok) return response;

  let excerpt = "";
  try {
    excerpt = (await response.text()).slice(0, 300);
  } catch {
    excerpt = "";
  }
  throw new ProviderError(
    codeForStatus(response.status),
    providerId,
    `HTTP ${response.status}${excerpt ? `: ${excerpt}` : ""}`,
    { statusCode: response.status },
  );
}

export async function providerJson<T>(
  providerId: string,
  url: string,
  init: RequestInit & { signal: AbortSignal },
): Promise<T> {
  const response = await providerFetch(providerId, url, init);
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ProviderError(providerId ? "invalid_response" : "invalid_response", providerId, "Antwort war kein gültiges JSON", {
      cause: error,
    });
  }
}
