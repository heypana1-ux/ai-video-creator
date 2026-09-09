"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Film, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Field, Input } from "@/components/ui/field";
import { apiSend, errorMessage } from "@/lib/client/api";
import { CATEGORY_LABELS } from "@/lib/domain/enums";
import type { Project } from "@/lib/domain/schemas";
import { formatRelative } from "@/lib/util/format";
import { getVideoStyle } from "@/lib/video/styles";

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const style = getVideoStyle(project.brief.styleId);
  const [renaming, setRenaming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [name, setName] = React.useState(project.name);
  const [busy, setBusy] = React.useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setRenaming(false);
      setDeleting(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const href =
    project.selectedConceptId
      ? `/projects/${project.id}/editor`
      : `/projects/${project.id}/concepts`;

  return (
    <>
      <article className="group surface-card overflow-hidden transition-colors hover:border-violet-brand/45">
        <Link href={href} className="block">
          <div className="relative aspect-[9/16] overflow-hidden bg-ink-800">
            {project.thumbnailUrl ? (
              // Generated demo media is SVG; next/image would add no value here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.thumbnailUrl}
                alt=""
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              // No media generated yet - show the project's own style gradient
              // rather than a flat grey box.
              <div
                className="grid size-full place-items-center text-white/45"
                style={{ background: `linear-gradient(155deg, ${style.gradient.join(", ")})` }}
              >
                <Film className="size-8" />
              </div>
            )}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
              <StatusBadge status={project.status} />
              <Badge tone="neutral">{project.durationSeconds}s</Badge>
            </div>
          </div>
        </Link>

        <div className="flex items-start justify-between gap-2 p-4">
          <div className="min-w-0">
            <Link href={href} className="block truncate font-semibold hover:text-electric">
              {project.name}
            </Link>
            <p className="mt-0.5 truncate text-xs text-chalk-faint">
              {CATEGORY_LABELS[project.category]} · {formatRelative(project.createdAt)}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Aktionen für ${project.name}`}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link href={href}>
                  <Film /> Öffnen
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil /> Umbenennen
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void run(
                    () => apiSend(`/api/projects/${project.id}/duplicate`, "POST"),
                    "Projekt dupliziert.",
                  )
                }
              >
                <Copy /> Duplizieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger" onSelect={() => setDeleting(true)}>
                <Trash2 /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </article>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Projekt umbenennen</DialogTitle>
          </DialogHeader>
          <Field label="Projektname" htmlFor={`rename-${project.id}`}>
            <Input
              id={`rename-${project.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={busy || name.trim().length === 0}
              onClick={() =>
                void run(
                  () => apiSend(`/api/projects/${project.id}`, "POST", { name: name.trim() }),
                  "Projekt umbenannt.",
                )
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Projekt löschen?</DialogTitle>
            <DialogDescription>
              „{project.name}“ wird mit allen Konzepten, Medien und Exporten dauerhaft entfernt.
              Das lässt sich nicht rückgängig machen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run(
                  () => apiSend(`/api/projects/${project.id}`, "DELETE"),
                  "Projekt gelöscht.",
                )
              }
            >
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
