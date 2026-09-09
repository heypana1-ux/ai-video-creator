"use client";

/** Tiny typed fetch wrapper that surfaces the API's German error messages. */

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ErrorPayload {
  error?: { code?: string; message?: string; details?: unknown };
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & ErrorPayload) : ({} as T & ErrorPayload);

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload.error?.code ?? "unknown",
      payload.error?.message ?? "Unerwarteter Fehler.",
      payload.error?.details,
    );
  }
  return payload as T;
}

export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  return parse<T>(await fetch(url, { signal, cache: "no-store" }));
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method,
      signal,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function apiUpload<T>(url: string, form: FormData): Promise<T> {
  return parse<T>(await fetch(url, { method: "POST", body: form }));
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unerwarteter Fehler.";
}
