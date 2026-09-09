import { z } from "zod";

import { isProviderError } from "@/lib/ai/errors";

/** Application level error with an HTTP status and a user-safe message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(message = "Bitte melde dich an.") {
    return new ApiError(401, "unauthorized", message);
  }
  static forbidden(message = "Kein Zugriff auf diese Ressource.") {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "Nicht gefunden.") {
    return new ApiError(404, "not_found", message);
  }
  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "bad_request", message, details);
  }
  static tooManyRequests(message = "Zu viele Anfragen. Bitte kurz warten.") {
    return new ApiError(429, "rate_limited", message);
  }
  static payment(message: string) {
    return new ApiError(402, "insufficient_credits", message);
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/**
 * Normalises anything thrown inside a route handler into a response body.
 * Unknown errors never leak their message to the client.
 */
export function toErrorBody(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "validation_failed",
          message: "Die Eingaben sind unvollständig oder ungültig.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
    };
  }

  if (isProviderError(error)) {
    const status = error.code === "unauthorized" ? 502 : error.code === "rate_limited" ? 429 : 502;
    return {
      status,
      body: { error: { code: `provider_${error.code}`, message: error.userMessage } },
    };
  }

  console.error("[api] unhandled error", error);
  return {
    status: 500,
    body: {
      error: {
        code: "internal_error",
        message: "Unerwarteter Fehler. Bitte erneut versuchen.",
      },
    },
  };
}
