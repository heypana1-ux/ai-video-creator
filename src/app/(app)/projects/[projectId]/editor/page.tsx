import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config/env";
import { getRepository } from "@/lib/db";

import { EditorShell } from "./editor-shell";

export const metadata: Metadata = { title: "Editor" };
export const dynamic = "force-dynamic";

export default async function EditorPage({
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

  // Without a concept there is nothing to edit yet - send the user back.
  if (!concept) redirect(`/projects/${project.id}/concepts`);

  const assets = await repo.listAssets(session.workspace.id);

  return (
    <EditorShell
      project={project}
      concept={concept}
      assets={assets}
      balance={session.workspace.credits}
      demoMode={isDemoMode()}
      hasMedia={concept.scenes.some((scene) => scene.source.url !== null)}
    />
  );
}
