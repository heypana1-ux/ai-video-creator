import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config/env";
import { getRepository } from "@/lib/db";

import { ExportPanel } from "./export-panel";

export const metadata: Metadata = { title: "Export" };
export const dynamic = "force-dynamic";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { projectId } = await params;
  const repo = await getRepository();
  const project = await repo.getProject(session.workspace.id, projectId);
  if (!project) notFound();

  const concepts = await repo.listConcepts(session.workspace.id, project.id);
  const concept =
    concepts.find((entry) => entry.id === project.selectedConceptId) ??
    concepts.find((entry) => entry.selected) ??
    concepts[0];
  if (!concept) redirect(`/projects/${project.id}/concepts`);

  const exports = await repo.listExports(session.workspace.id, project.id);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
          <Link href={`/projects/${project.id}/editor`}>
            <ArrowLeft className="size-4" /> Editor
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Export</h1>
        <p className="mt-1 text-sm text-chalk-faint">
          {project.name} · {concept.title}
        </p>
      </header>

      <ExportPanel
        project={project}
        concept={concept}
        initialExports={exports}
        balance={session.workspace.credits}
        demoMode={isDemoMode()}
      />
    </div>
  );
}
