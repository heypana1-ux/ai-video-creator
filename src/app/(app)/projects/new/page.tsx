import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";

import { ProjectWizard } from "./wizard";

export const metadata: Metadata = { title: "Neues Video" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const repo = await getRepository();
  const brandKits = await repo.listBrandKits(session.workspace.id);

  return <ProjectWizard brandKits={brandKits} />;
}
