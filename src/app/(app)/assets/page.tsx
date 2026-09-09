import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";

import { AssetLibrary } from "./asset-library";

export const metadata: Metadata = { title: "Asset-Bibliothek" };
export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const repo = await getRepository();
  const assets = await repo.listAssets(session.workspace.id);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Asset-Bibliothek</h1>
        <p className="mt-1 text-sm text-chalk-faint">
          Alle Dateien deines Workspace. Uploads werden nur für dich ausgeliefert.
        </p>
      </header>
      <AssetLibrary initialAssets={assets} />
    </div>
  );
}
