import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { isDemoMode, serverEnv } from "@/lib/config/env";
import { DEMO_STARTING_CREDITS } from "@/lib/credits/pricing";
import { getRepository, type Repository } from "@/lib/db";
import type { User, Workspace } from "@/lib/domain/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { randomId } from "@/lib/util/id";

import { hashPassword, verifyPassword } from "./password";

export const SESSION_COOKIE = "adreel_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface Session {
  user: User;
  workspace: Workspace;
  isDemo: boolean;
}

/* -------------------------------------------------------------------------- */
/* Cookie signing (demo mode)                                                 */
/* -------------------------------------------------------------------------- */

function sign(value: string): string {
  return createHmac("sha256", serverEnv.authSecret).update(value).digest("base64url");
}

export function encodeSessionCookie(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function decodeSessionCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = sign(userId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

/* -------------------------------------------------------------------------- */
/* Workspace bootstrap                                                        */
/* -------------------------------------------------------------------------- */

async function ensureWorkspace(repo: Repository, user: User): Promise<Workspace> {
  const existing = await repo.getWorkspaceForOwner(user.id);
  if (existing) return existing;

  const workspace = await repo.createWorkspace({
    id: randomId("ws"),
    ownerId: user.id,
    name: user.displayName ? `${user.displayName}s Workspace` : "Mein Workspace",
    credits: DEMO_STARTING_CREDITS,
    onboardedAt: null,
  });
  await repo.upsertSubscription({
    workspaceId: workspace.id,
    plan: "demo",
    status: "active",
    creditsPerMonth: DEMO_STARTING_CREDITS,
    renewsAt: null,
  });
  await repo.addCreditTransaction({
    workspaceId: workspace.id,
    amount: 0,
    reason: "Workspace erstellt",
  });
  return workspace;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export async function getSession(): Promise<Session | null> {
  const repo = await getRepository();

  if (!isDemoMode()) {
    const client = await getSupabaseServerClient();
    const { data } = (await client?.auth.getUser()) ?? { data: { user: null } };
    const authUser = data?.user;
    if (!authUser) return null;

    let user = await repo.getUser(authUser.id);
    if (!user) {
      user = await repo.createUser({
        id: authUser.id,
        email: authUser.email ?? "",
        displayName:
          (authUser.user_metadata?.display_name as string | undefined) ??
          authUser.email?.split("@")[0] ??
          "",
        passwordHash: null,
        isDemo: false,
      });
    }
    return { user, workspace: await ensureWorkspace(repo, user), isDemo: false };
  }

  const store = await cookies();
  const userId = decodeSessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;

  const user = await repo.getUser(userId);
  if (!user) return null;
  return { user, workspace: await ensureWorkspace(repo, user), isDemo: true };
}

async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSessionCookie(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  session?: Session;
}

export async function signUp(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  if (!isDemoMode()) {
    const client = await getSupabaseServerClient();
    if (!client) return { ok: false, error: "Supabase ist nicht konfiguriert." };
    const { error } = await client.auth.signUp({
      email,
      password: input.password,
      options: { data: { display_name: input.displayName } },
    });
    if (error) return { ok: false, error: error.message };
    const session = await getSession();
    return session
      ? { ok: true, session }
      : { ok: true, error: "Bitte bestätige deine E-Mail-Adresse und melde dich an." };
  }

  const repo = await getRepository();
  if (await repo.findUserByEmail(email)) {
    return { ok: false, error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  const user = await repo.createUser({
    id: randomId("usr"),
    email,
    displayName: input.displayName.trim(),
    passwordHash: await hashPassword(input.password),
    isDemo: true,
  });
  await ensureWorkspace(repo, user);
  await setSessionCookie(user.id);

  const session = await getSession();
  return session ? { ok: true, session } : { ok: false, error: "Sitzung konnte nicht erstellt werden." };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  if (!isDemoMode()) {
    const client = await getSupabaseServerClient();
    if (!client) return { ok: false, error: "Supabase ist nicht konfiguriert." };
    const { error } = await client.auth.signInWithPassword({ email, password: input.password });
    if (error) return { ok: false, error: "E-Mail oder Passwort ist falsch." };
    const session = await getSession();
    return session ? { ok: true, session } : { ok: false, error: "Anmeldung fehlgeschlagen." };
  }

  const repo = await getRepository();
  const user = await repo.findUserByEmail(email);
  // Same message for unknown user and wrong password - no account enumeration.
  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    return { ok: false, error: "E-Mail oder Passwort ist falsch." };
  }

  await setSessionCookie(user.id);
  const session = await getSession();
  return session ? { ok: true, session } : { ok: false, error: "Anmeldung fehlgeschlagen." };
}

export async function signOut(): Promise<void> {
  if (!isDemoMode()) {
    const client = await getSupabaseServerClient();
    await client?.auth.signOut();
  }
  await clearSessionCookie();
}

export const DEMO_ACCOUNT = {
  email: "demo@adreel.local",
  password: "adreel-demo-1234",
  displayName: "Demo-Nutzer",
} as const;

/**
 * One-click demo login. Creates the shared demo account on first use.
 * Only available while the app runs in demo mode.
 */
export async function signInAsDemoUser(): Promise<AuthResult> {
  if (!isDemoMode()) {
    return { ok: false, error: "Der Demo-Zugang ist nur im Demo-Modus verfügbar." };
  }

  const repo = await getRepository();
  const existing = await repo.findUserByEmail(DEMO_ACCOUNT.email);
  if (!existing) {
    return signUp({ ...DEMO_ACCOUNT });
  }
  await setSessionCookie(existing.id);
  const session = await getSession();
  return session ? { ok: true, session } : { ok: false, error: "Anmeldung fehlgeschlagen." };
}
