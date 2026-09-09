/** Error classes shared by every provider adapter. */

export type ProviderErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "cancelled"
  | "bad_request"
  | "upstream_error"
  | "unavailable"
  | "invalid_response";

/** Codes where retrying with backoff can plausibly succeed. */
const RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set([
  "rate_limited",
  "timeout",
  "upstream_error",
  "unavailable",
]);

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerId: string;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(
    code: ProviderErrorCode,
    providerId: string,
    message: string,
    options: { statusCode?: number; cause?: unknown; retryable?: boolean } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.code = code;
    this.providerId = providerId;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? RETRYABLE.has(code);
  }

  /** Message shown to end users - never contains keys, prompts or stack data. */
  get userMessage(): string {
    switch (this.code) {
      case "unauthorized":
        return `Der Anbieter „${this.providerId}“ hat die Zugangsdaten abgelehnt. Bitte den API-Key in den Umgebungsvariablen prüfen.`;
      case "rate_limited":
        return `Der Anbieter „${this.providerId}“ ist aktuell ausgelastet (Rate Limit). Bitte in einem Moment erneut versuchen.`;
      case "timeout":
        return `Der Anbieter „${this.providerId}“ hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.`;
      case "cancelled":
        return "Der Vorgang wurde abgebrochen.";
      case "bad_request":
        return `Die Anfrage an „${this.providerId}“ war ungültig: ${this.message}`;
      case "invalid_response":
        return `Der Anbieter „${this.providerId}“ hat eine unerwartete Antwort geliefert. Es wurde auf den Demo-Modus zurückgefallen, sofern möglich.`;
      case "unavailable":
        return `Der Anbieter „${this.providerId}“ ist nicht konfiguriert oder nicht erreichbar.`;
      default:
        return `Beim Anbieter „${this.providerId}“ ist ein Fehler aufgetreten. Bitte erneut versuchen.`;
    }
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

/** Maps an HTTP status to a provider error code. */
export function codeForStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_error";
  return "bad_request";
}
