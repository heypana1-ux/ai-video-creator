import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";

import { BrandKitManager } from "./brand-kit-manager";

export const metadata: Metadata = { title: "Brand-Kits" };
export const dynamic = "force-dynamic";

export default async function BrandKitsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const repo = await getRepository();
  const kits = await repo.listBrandKits(session.workspace.id);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Brand-Kits</h1>
        <p className="mt-1 text-sm text-chalk-faint">
          Farben, Schrift und Logo für einen konsistenten Look über alle Videos.
        </p>
      </header>
      <BrandKitManager initialKits={kits} />
    </div>
  );
}
