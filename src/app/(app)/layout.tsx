import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/nav";
import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AppNav
        user={{
          displayName: session.user.displayName,
          email: session.user.email,
          credits: session.workspace.credits,
          workspaceName: session.workspace.name,
          demoMode: isDemoMode(),
        }}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
