"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/states";
import { apiSend, errorMessage } from "@/lib/client/api";

interface Props {
  mode: "login" | "register";
  demoMode: boolean;
}

export function AuthForm({ mode, demoMode }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"form" | "demo" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending("form");

    const data = new FormData(event.currentTarget);
    const payload =
      mode === "register"
        ? {
            email: String(data.get("email") ?? ""),
            password: String(data.get("password") ?? ""),
            displayName: String(data.get("displayName") ?? ""),
          }
        : {
            email: String(data.get("email") ?? ""),
            password: String(data.get("password") ?? ""),
          };

    try {
      const result = await apiSend<{ notice?: string | null }>(
        mode === "register" ? "/api/auth/register" : "/api/auth/login",
        "POST",
        payload,
      );
      if (result.notice) {
        setNotice(result.notice);
        setPending(null);
        return;
      }
      router.replace(mode === "register" ? "/onboarding" : "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(null);
    }
  }

  async function onDemoLogin() {
    setError(null);
    setPending("demo");
    try {
      await apiSend("/api/auth/demo", "POST");
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {mode === "register" ? "Konto erstellen" : "Willkommen zurück"}
        </CardTitle>
        <CardDescription>
          {mode === "register"
            ? "Starte dein erstes Werbevideo in wenigen Minuten."
            : "Melde dich an, um an deinen Projekten weiterzuarbeiten."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? <ErrorState message={error} /> : null}
        {notice ? (
          <p className="rounded-xl border border-electric/35 bg-electric/10 p-3 text-sm text-electric">
            {notice}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "register" ? (
            <Field label="Name" htmlFor="displayName" required>
              <Input
                id="displayName"
                name="displayName"
                autoComplete="name"
                required
                placeholder="Alex Beispiel"
              />
            </Field>
          ) : null}

          <Field label="E-Mail" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="du@example.com"
            />
          </Field>

          <Field
            label="Passwort"
            htmlFor="password"
            required
            hint={mode === "register" ? "Mindestens 8 Zeichen." : undefined}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              minLength={mode === "register" ? 8 : 1}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={pending !== null}>
            {pending === "form" ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "register" ? "Konto erstellen" : "Anmelden"}
          </Button>
        </form>

        {demoMode ? (
          <>
            <div className="flex items-center gap-3 text-xs text-chalk-faint">
              <span className="h-px flex-1 bg-ink-700" />
              oder
              <span className="h-px flex-1 bg-ink-700" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onDemoLogin}
              disabled={pending !== null}
            >
              {pending === "demo" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Ohne Konto im Demo-Modus starten
            </Button>
            <p className="text-center text-xs text-chalk-faint">
              Der Demo-Modus speichert alles lokal und verursacht keine Kosten.
            </p>
          </>
        ) : null}

        <p className="text-center text-sm text-chalk-faint">
          {mode === "register" ? (
            <>
              Schon ein Konto?{" "}
              <Link href="/login" className="text-electric hover:underline">
                Anmelden
              </Link>
            </>
          ) : (
            <>
              Noch kein Konto?{" "}
              <Link href="/register" className="text-electric hover:underline">
                Registrieren
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
