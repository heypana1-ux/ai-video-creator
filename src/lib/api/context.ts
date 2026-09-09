import type { Session } from "@/lib/auth/session";
import { getRepository, type Repository } from "@/lib/db";
import type { Concept, Project } from "@/lib/domain/schemas";

import { ApiError } from "./errors";

/** Loads a project and asserts it belongs to the caller's workspace. */
export async function loadProject(
  session: Session,
  projectId: string,
): Promise<{ repo: Repository; project: Project }> {
  const repo = await getRepository();
  const project = await repo.getProject(session.workspace.id, projectId);
  if (!project) throw ApiError.notFound("Projekt nicht gefunden.");
  return { repo, project };
}

export async function loadConcept(
  repo: Repository,
  session: Session,
  project: Project,
  conceptId: string,
): Promise<Concept> {
  const concept = await repo.getConcept(session.workspace.id, conceptId);
  if (!concept || concept.projectId !== project.id) {
    throw ApiError.notFound("Konzept nicht gefunden.");
  }
  return concept;
}

/** The selected concept, or the most recent one when nothing is selected yet. */
export async function resolveConcept(
  repo: Repository,
  session: Session,
  project: Project,
  conceptId?: string | null,
): Promise<Concept> {
  if (conceptId) return loadConcept(repo, session, project, conceptId);
  if (project.selectedConceptId) {
    return loadConcept(repo, session, project, project.selectedConceptId);
  }
  const concepts = await repo.listConcepts(session.workspace.id, project.id);
  const concept = concepts.find((candidate) => candidate.selected) ?? concepts[0];
  if (!concept) throw ApiError.badRequest("Für dieses Projekt gibt es noch kein Konzept.");
  return concept;
}
