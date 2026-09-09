/**
 * Minimal in-memory stand-in for `next/headers`.
 *
 * Route handlers read and write session cookies through `cookies()`. In a unit
 * test there is no request scope, so this jar plays that role and lets a test
 * follow a real login -> authenticated request flow.
 */

interface CookieRecord {
  name: string;
  value: string;
}

const jar = new Map<string, string>();

export function resetCookieJar(): void {
  jar.clear();
}

export function readCookie(name: string): string | undefined {
  return jar.get(name);
}

export async function cookies() {
  return {
    get(name: string): CookieRecord | undefined {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll(): CookieRecord[] {
      return [...jar.entries()].map(([name, value]) => ({ name, value }));
    },
    set(name: string, value: string) {
      jar.set(name, value);
    },
    delete(name: string) {
      jar.delete(name);
    },
    has(name: string) {
      return jar.has(name);
    },
  };
}

export async function headers() {
  return new Headers();
}

export async function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} };
}
