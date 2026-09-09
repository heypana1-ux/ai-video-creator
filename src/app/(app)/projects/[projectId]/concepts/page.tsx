import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";
import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config/env";
import { getRepository } from "@/lib/db";
import { CATEGORY_LABELS, TONE_LABELS } from "@/lib/domain/enums";

import { ConceptPicker } from "./concept-picker";

export const metadata: Metadata = { title: "Konzepte" };
export const dynamic = "force-dynamic";

export default async function ConceptsPage({
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

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="violet">{CATEGORY_LABELS[project.category]}</Badge>
          <Badge>{TONE_LABELS[project.brief.tone]}</Badge>
          <Badge>{project.durationSeconds} Sekunden</Badge>
        </div>
      </header>

      <Suspense fallback={<LoadingState />}>
        <ConceptPicker
          project={project}
          initialConcepts={concepts}
          balance={session.workspace.credits}
          demoMode={isDemoMode()}
        />
      </Suspense>
    </div>
  );
}
