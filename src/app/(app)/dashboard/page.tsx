import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";

import { ProjectCard } from "@/components/app/project-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config/env";
import { getRepository } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/domain/enums";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const repo = await getRepository();
  const projects = await repo.listProjects(session.workspace.id);

  const counts = projects.reduce<Record<string, number>>((acc, project) => {
    acc[project.status] = (acc[project.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deine Projekte</h1>
          <p className="mt-1 text-sm text-chalk-faint">
            {projects.length === 0
              ? "Noch keine Projekte – leg direkt los."
              : `${projects.length} Projekt${projects.length === 1 ? "" : "e"} in ${session.workspace.name}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDemoMode() ? (
            <Badge tone="violet">
              <Sparkles className="size-3" /> Demo-Modus
            </Badge>
          ) : null}
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" /> Neues Video erstellen
            </Link>
          </Button>
        </div>
      </header>

      {projects.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(counts).map(([status, count]) => (
            <Badge key={status} tone="neutral">
              {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}: {count}
            </Badge>
          ))}
        </div>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          title="Noch kein Projekt"
          description="Wähle eine Kategorie, beantworte ein paar Fragen und AdReel entwickelt drei Werbekonzepte für dich."
          action={
            <Button asChild>
              <Link href="/projects/new">Erstes Video erstellen</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
