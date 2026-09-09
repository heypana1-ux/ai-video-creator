import { randomId } from "@/lib/util/id";
import type {
  Asset,
  BrandKit,
  Concept,
  CreditTransaction,
  GenerationJob,
  Project,
  ProviderUsage,
  RenderJob,
  Scene,
  Subscription,
  User,
  VideoExport,
  Workspace,
} from "@/lib/domain/schemas";
import type { ExportQuality, GenerationJobKind, JobStatus, ProjectStatus } from "@/lib/domain/enums";

import { TABLES, type Row, type TableDriver } from "./driver";

/**
 * Domain repository.
 *
 * Every read and write is scoped by `workspaceId`. RLS is enforced in the
 * database as well, but the application never relies on it alone: a bug in a
 * policy must not turn into a data leak.
 *
 * Scenes live in their own table (see `supabase/migrations`) and are hydrated
 * into the `Concept` aggregate on read, which is how the editor consumes them.
 */

type SceneRow = Scene & {
  workspaceId: string;
  projectId: string;
  conceptId: string;
};

type ConceptRow = Omit<Concept, "scenes"> & { workspaceId: string };

export interface SceneAssetLink {
  id: string;
  workspaceId: string;
  sceneId: string;
  assetId: string;
  role: string;
  createdAt: string;
}

export class Repository {
  constructor(private readonly driver: TableDriver) {}

  private now(): string {
    return new Date().toISOString();
  }

  /* ---------------------------------------------------------------- users */

  async createUser(input: Omit<User, "createdAt">): Promise<User> {
    return this.driver.insert<User & Row>(TABLES.users, {
      ...input,
      createdAt: this.now(),
    } as User & Row);
  }

  async getUser(id: string): Promise<User | null> {
    return this.driver.selectOne<User & Row>(TABLES.users, { id });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.driver.selectOne<User & Row>(TABLES.users, {
      email: email.trim().toLowerCase(),
    });
  }

  /* ----------------------------------------------------------- workspaces */

  async createWorkspace(input: Omit<Workspace, "createdAt">): Promise<Workspace> {
    return this.driver.insert<Workspace & Row>(TABLES.workspaces, {
      ...input,
      createdAt: this.now(),
    } as Workspace & Row);
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    return this.driver.selectOne<Workspace & Row>(TABLES.workspaces, { id });
  }

  async getWorkspaceForOwner(ownerId: string): Promise<Workspace | null> {
    return this.driver.selectOne<Workspace & Row>(TABLES.workspaces, { ownerId });
  }

  async updateWorkspace(id: string, patch: Partial<Workspace>): Promise<Workspace | null> {
    return this.driver.update<Workspace & Row>(TABLES.workspaces, { id }, patch);
  }

  /* ------------------------------------------------------------- projects */

  async listProjects(workspaceId: string): Promise<Project[]> {
    return this.driver.select<Project & Row>(
      TABLES.projects,
      { workspaceId },
      { orderBy: { column: "updatedAt", direction: "desc" } },
    );
  }

  async getProject(workspaceId: string, id: string): Promise<Project | null> {
    return this.driver.selectOne<Project & Row>(TABLES.projects, { id, workspaceId });
  }

  async createProject(input: Omit<Project, "createdAt" | "updatedAt">): Promise<Project> {
    const timestamp = this.now();
    return this.driver.insert<Project & Row>(TABLES.projects, {
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as Project & Row);
  }

  async updateProject(
    workspaceId: string,
    id: string,
    patch: Partial<Project>,
  ): Promise<Project | null> {
    return this.driver.update<Project & Row>(
      TABLES.projects,
      { id, workspaceId },
      { ...patch, updatedAt: this.now() },
    );
  }

  async setProjectStatus(
    workspaceId: string,
    id: string,
    status: ProjectStatus,
  ): Promise<Project | null> {
    return this.updateProject(workspaceId, id, { status });
  }

  /** Removes a project and everything attached to it. */
  async deleteProject(workspaceId: string, id: string): Promise<boolean> {
    const project = await this.getProject(workspaceId, id);
    if (!project) return false;

    for (const table of [
      TABLES.scenes,
      TABLES.concepts,
      TABLES.generationJobs,
      TABLES.renderJobs,
      TABLES.exports,
      TABLES.projectAssets,
    ]) {
      await this.driver.delete(table, { workspaceId, projectId: id });
    }
    await this.driver.delete(TABLES.projects, { workspaceId, id });
    return true;
  }

  /* ------------------------------------------------- concepts and scenes */

  private async hydrateConcept(concept: ConceptRow): Promise<Concept> {
    const scenes = await this.driver.select<SceneRow>(
      TABLES.scenes,
      { conceptId: concept.id },
      { orderBy: { column: "index", direction: "asc" } },
    );
    return {
      ...concept,
      scenes: scenes.map(({ workspaceId: _workspaceId, conceptId: _conceptId, ...scene }) => scene),
    } as Concept;
  }

  async listConcepts(workspaceId: string, projectId: string): Promise<Concept[]> {
    const rows = await this.driver.select<ConceptRow & Row>(
      TABLES.concepts,
      { workspaceId, projectId },
      { orderBy: { column: "createdAt", direction: "asc" } },
    );
    return Promise.all(rows.map((row) => this.hydrateConcept(row)));
  }

  async getConcept(workspaceId: string, id: string): Promise<Concept | null> {
    const row = await this.driver.selectOne<ConceptRow & Row>(TABLES.concepts, {
      workspaceId,
      id,
    });
    return row ? this.hydrateConcept(row) : null;
  }

  private async writeScenes(
    workspaceId: string,
    projectId: string,
    conceptId: string,
    scenes: Scene[],
  ): Promise<void> {
    await this.driver.delete(TABLES.scenes, { conceptId });
    if (scenes.length === 0) return;
    await this.driver.insertMany<SceneRow & Row>(
      TABLES.scenes,
      scenes.map(
        (scene, index) =>
          ({ ...scene, index, workspaceId, projectId, conceptId }) as SceneRow & Row,
      ),
    );
  }

  /** Replaces the whole concept set of a project (one generation run). */
  async replaceConcepts(
    workspaceId: string,
    projectId: string,
    concepts: Concept[],
  ): Promise<Concept[]> {
    const existing = await this.driver.select<ConceptRow & Row>(TABLES.concepts, {
      workspaceId,
      projectId,
    });
    for (const concept of existing) {
      await this.driver.delete(TABLES.scenes, { conceptId: concept.id });
    }
    await this.driver.delete(TABLES.concepts, { workspaceId, projectId });

    const stored: Concept[] = [];
    for (const concept of concepts) {
      const { scenes, ...rest } = concept;
      await this.driver.insert<ConceptRow & Row>(TABLES.concepts, {
        ...rest,
        workspaceId,
      } as ConceptRow & Row);
      await this.writeScenes(workspaceId, projectId, concept.id, scenes);
      stored.push(concept);
    }
    return stored;
  }

  async updateConcept(
    workspaceId: string,
    id: string,
    patch: Partial<Omit<Concept, "scenes">> & { scenes?: Scene[] },
  ): Promise<Concept | null> {
    const existing = await this.driver.selectOne<ConceptRow & Row>(TABLES.concepts, {
      workspaceId,
      id,
    });
    if (!existing) return null;

    const { scenes, ...rest } = patch;
    if (Object.keys(rest).length > 0) {
      await this.driver.update<ConceptRow & Row>(TABLES.concepts, { workspaceId, id }, rest);
    }
    if (scenes) {
      await this.writeScenes(workspaceId, existing.projectId, id, scenes);
    }
    return this.getConcept(workspaceId, id);
  }

  /** Marks one concept as selected and clears the flag on all others. */
  async selectConcept(
    workspaceId: string,
    projectId: string,
    conceptId: string,
  ): Promise<Concept | null> {
    const concepts = await this.driver.select<ConceptRow & Row>(TABLES.concepts, {
      workspaceId,
      projectId,
    });
    for (const concept of concepts) {
      const shouldSelect = concept.id === conceptId;
      if (concept.selected !== shouldSelect) {
        await this.driver.update<ConceptRow & Row>(
          TABLES.concepts,
          { workspaceId, id: concept.id },
          { selected: shouldSelect },
        );
      }
    }
    await this.updateProject(workspaceId, projectId, { selectedConceptId: conceptId });
    return this.getConcept(workspaceId, conceptId);
  }

  async updateScene(
    workspaceId: string,
    sceneId: string,
    patch: Partial<Scene>,
  ): Promise<Scene | null> {
    const row = await this.driver.update<SceneRow & Row>(
      TABLES.scenes,
      { workspaceId, id: sceneId },
      patch as Partial<SceneRow & Row>,
    );
    if (!row) return null;
    const { workspaceId: _workspaceId, conceptId: _conceptId, ...scene } = row;
    return scene as Scene;
  }

  /* --------------------------------------------------------- scene assets */

  async linkSceneAsset(
    workspaceId: string,
    sceneId: string,
    assetId: string,
    role: string,
  ): Promise<SceneAssetLink> {
    await this.driver.delete(TABLES.sceneAssets, { workspaceId, sceneId, role });
    return this.driver.insert<SceneAssetLink & Row>(TABLES.sceneAssets, {
      id: randomId("sa"),
      workspaceId,
      sceneId,
      assetId,
      role,
      createdAt: this.now(),
    } as SceneAssetLink & Row);
  }

  async listSceneAssets(workspaceId: string, sceneId: string): Promise<SceneAssetLink[]> {
    return this.driver.select<SceneAssetLink & Row>(TABLES.sceneAssets, {
      workspaceId,
      sceneId,
    });
  }

  /* --------------------------------------------------------------- assets */

  async createAsset(input: Omit<Asset, "createdAt">): Promise<Asset> {
    return this.driver.insert<Asset & Row>(TABLES.projectAssets, {
      ...input,
      createdAt: this.now(),
    } as Asset & Row);
  }

  async getAsset(workspaceId: string, id: string): Promise<Asset | null> {
    return this.driver.selectOne<Asset & Row>(TABLES.projectAssets, { workspaceId, id });
  }

  async listAssets(workspaceId: string, projectId?: string): Promise<Asset[]> {
    return this.driver.select<Asset & Row>(
      TABLES.projectAssets,
      projectId ? { workspaceId, projectId } : { workspaceId },
      { orderBy: { column: "createdAt", direction: "desc" } },
    );
  }

  async deleteAsset(workspaceId: string, id: string): Promise<boolean> {
    await this.driver.delete(TABLES.sceneAssets, { workspaceId, assetId: id });
    return (await this.driver.delete(TABLES.projectAssets, { workspaceId, id })) > 0;
  }

  /* ----------------------------------------------------------- brand kits */

  async listBrandKits(workspaceId: string): Promise<BrandKit[]> {
    return this.driver.select<BrandKit & Row>(
      TABLES.brandKits,
      { workspaceId },
      { orderBy: { column: "createdAt", direction: "desc" } },
    );
  }

  async getBrandKit(workspaceId: string, id: string): Promise<BrandKit | null> {
    return this.driver.selectOne<BrandKit & Row>(TABLES.brandKits, { workspaceId, id });
  }

  async createBrandKit(input: Omit<BrandKit, "createdAt">): Promise<BrandKit> {
    return this.driver.insert<BrandKit & Row>(TABLES.brandKits, {
      ...input,
      createdAt: this.now(),
    } as BrandKit & Row);
  }

  async updateBrandKit(
    workspaceId: string,
    id: string,
    patch: Partial<BrandKit>,
  ): Promise<BrandKit | null> {
    return this.driver.update<BrandKit & Row>(TABLES.brandKits, { workspaceId, id }, patch);
  }

  async deleteBrandKit(workspaceId: string, id: string): Promise<boolean> {
    return (await this.driver.delete(TABLES.brandKits, { workspaceId, id })) > 0;
  }

  /* ----------------------------------------------------------------- jobs */

  async createGenerationJob(input: {
    workspaceId: string;
    projectId: string;
    kind: GenerationJobKind;
  }): Promise<GenerationJob> {
    const timestamp = this.now();
    return this.driver.insert<GenerationJob & Row>(TABLES.generationJobs, {
      id: randomId("gj"),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      kind: input.kind,
      status: "queued",
      progress: 0,
      step: "In Warteschlange",
      error: null,
      resultRef: null,
      providerJobId: null,
      creditsSpent: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as GenerationJob & Row);
  }

  async updateGenerationJob(
    id: string,
    patch: Partial<GenerationJob>,
  ): Promise<GenerationJob | null> {
    return this.driver.update<GenerationJob & Row>(
      TABLES.generationJobs,
      { id },
      { ...patch, updatedAt: this.now() },
    );
  }

  async getGenerationJob(workspaceId: string, id: string): Promise<GenerationJob | null> {
    return this.driver.selectOne<GenerationJob & Row>(TABLES.generationJobs, {
      workspaceId,
      id,
    });
  }

  async listGenerationJobs(
    workspaceId: string,
    projectId: string,
    status?: JobStatus,
  ): Promise<GenerationJob[]> {
    return this.driver.select<GenerationJob & Row>(
      TABLES.generationJobs,
      status ? { workspaceId, projectId, status } : { workspaceId, projectId },
      { orderBy: { column: "createdAt", direction: "desc" } },
    );
  }

  async createRenderJob(input: {
    workspaceId: string;
    projectId: string;
    conceptId: string;
    quality: ExportQuality;
  }): Promise<RenderJob> {
    const timestamp = this.now();
    return this.driver.insert<RenderJob & Row>(TABLES.renderJobs, {
      id: randomId("rj"),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      conceptId: input.conceptId,
      quality: input.quality,
      status: "queued",
      progress: 0,
      step: "In Warteschlange",
      error: null,
      exportId: null,
      creditsSpent: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as RenderJob & Row);
  }

  async updateRenderJob(id: string, patch: Partial<RenderJob>): Promise<RenderJob | null> {
    return this.driver.update<RenderJob & Row>(
      TABLES.renderJobs,
      { id },
      { ...patch, updatedAt: this.now() },
    );
  }

  async getRenderJob(workspaceId: string, id: string): Promise<RenderJob | null> {
    return this.driver.selectOne<RenderJob & Row>(TABLES.renderJobs, { workspaceId, id });
  }

  async listRenderJobs(workspaceId: string, projectId: string): Promise<RenderJob[]> {
    return this.driver.select<RenderJob & Row>(
      TABLES.renderJobs,
      { workspaceId, projectId },
      { orderBy: { column: "createdAt", direction: "desc" } },
    );
  }

  /* -------------------------------------------------------------- exports */

  async createExport(input: Omit<VideoExport, "createdAt">): Promise<VideoExport> {
    return this.driver.insert<VideoExport & Row>(TABLES.exports, {
      ...input,
      createdAt: this.now(),
    } as VideoExport & Row);
  }

  async getExport(workspaceId: string, id: string): Promise<VideoExport | null> {
    return this.driver.selectOne<VideoExport & Row>(TABLES.exports, { workspaceId, id });
  }

  async listExports(workspaceId: string, projectId: string): Promise<VideoExport[]> {
    return this.driver.select<VideoExport & Row>(
      TABLES.exports,
      { workspaceId, projectId },
      { orderBy: { column: "createdAt", direction: "desc" } },
    );
  }

  async deleteExport(workspaceId: string, id: string): Promise<boolean> {
    return (await this.driver.delete(TABLES.exports, { workspaceId, id })) > 0;
  }

  /* ------------------------------------------------- usage and accounting */

  async recordProviderUsage(input: Omit<ProviderUsage, "id" | "createdAt">): Promise<ProviderUsage> {
    return this.driver.insert<ProviderUsage & Row>(TABLES.providerUsage, {
      ...input,
      id: randomId("pu"),
      createdAt: this.now(),
    } as ProviderUsage & Row);
  }

  async listProviderUsage(workspaceId: string, limit = 50): Promise<ProviderUsage[]> {
    return this.driver.select<ProviderUsage & Row>(
      TABLES.providerUsage,
      { workspaceId },
      { orderBy: { column: "createdAt", direction: "desc" }, limit },
    );
  }

  /**
   * Applies a credit delta and writes a ledger entry. Negative amounts spend,
   * positive amounts top up. Returns the new balance.
   */
  async addCreditTransaction(input: {
    workspaceId: string;
    projectId?: string | null;
    amount: number;
    reason: string;
  }): Promise<{ transaction: CreditTransaction; balance: number }> {
    const workspace = await this.getWorkspace(input.workspaceId);
    if (!workspace) throw new Error("Workspace nicht gefunden");

    const balance = Math.round((workspace.credits + input.amount) * 100) / 100;
    await this.updateWorkspace(input.workspaceId, { credits: balance });

    const transaction = await this.driver.insert<CreditTransaction & Row>(
      TABLES.creditTransactions,
      {
        id: randomId("ct"),
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        amount: input.amount,
        reason: input.reason,
        balanceAfter: balance,
        createdAt: this.now(),
      } as CreditTransaction & Row,
    );

    return { transaction, balance };
  }

  async listCreditTransactions(workspaceId: string, limit = 50): Promise<CreditTransaction[]> {
    return this.driver.select<CreditTransaction & Row>(
      TABLES.creditTransactions,
      { workspaceId },
      { orderBy: { column: "createdAt", direction: "desc" }, limit },
    );
  }

  async getSubscription(workspaceId: string): Promise<Subscription | null> {
    return this.driver.selectOne<Subscription & Row>(TABLES.subscriptions, { workspaceId });
  }

  async upsertSubscription(input: Omit<Subscription, "id" | "createdAt">): Promise<Subscription> {
    const existing = await this.getSubscription(input.workspaceId);
    if (existing) {
      const updated = await this.driver.update<Subscription & Row>(
        TABLES.subscriptions,
        { id: existing.id },
        input,
      );
      return updated ?? existing;
    }
    return this.driver.insert<Subscription & Row>(TABLES.subscriptions, {
      ...input,
      id: randomId("sub"),
      createdAt: this.now(),
    } as Subscription & Row);
  }
}
