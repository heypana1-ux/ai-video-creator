import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config/env";

import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return <AuthForm mode="login" demoMode={isDemoMode()} />;
}
