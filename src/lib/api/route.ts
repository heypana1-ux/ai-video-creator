import { NextResponse } from "next/server";

import { getSession, type Session } from "@/lib/auth/session";

import { ApiError, toErrorBody } from "./errors";

/** Wraps a route handler with uniform error handling. */
export function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  return fn()
    .then((data) => NextResponse.json(data as object))
    .catch((error: unknown) => {
      const { status, body } = toErrorBody(error);
      return NextResponse.json(body, { status });
    });
}

/** Same as `handle` but resolves the session first and rejects anonymous calls. */
export function handleAuthed<T>(
  fn: (session: Session) => Promise<T>,
): Promise<NextResponse> {
  return handle(async () => {
    const session = await getSession();
    if (!session) throw ApiError.unauthorized();
    return fn(session);
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw ApiError.badRequest("Ungültiger JSON-Body.");
  }
}
