import { describe, expect, it } from "vitest";

import { ALL_TABLES } from "@/lib/db/driver";
import { JsonTableDriver } from "@/lib/db/json-driver";
import { Repository } from "@/lib/db/repository";
import { toCamelCase, toSnakeCase } from "@/lib/db/supabase-driver";
import { composeConcepts } from "@/lib/concepts/composer";
import { layoutConcept } from "@/lib/concepts/layout";
import { defaultBrief } from "@/lib/domain/defaults";
import type { ProjectBrief } from "@/lib/domain/schemas";
import { withTempDataDir } from "../helpers/temp-dir";

const brief = {
  ...defaultBrief("custom"),
  name: "Repo-Test",
  description: "Ein Projekt zum Testen der Repository-Schicht.",
  details: { offerName: "Repo-Test", highlights: ["A"], proofPoints: [] },
} as ProjectBrief;

async function setup(root: string) {
  const repo = new Repository(new JsonTableDriver(root));
  const user = await repo.createUser({
    id: "usr_1",
    email: "a@example.com",
    displayName: "A",
    passwordHash: null,
    isDemo: true,
  });
  const workspace = await repo.createWorkspace({
    id: "ws_1",
    ownerId: user.id,
    name: "WS",
    credits: 100,
    onboardedAt: null,
  });
  const project = await repo.createProject({
    id: "prj_1",
    workspaceId: workspace.id,
    ownerId: user.id,
    name: brief.name,
    category: brief.category,
    status: "draft",
    brief,
    selectedConceptId: null,
    thumbnailUrl: null,
    durationSeconds: 15,
    brandKitId: null,
  });
  return { repo, workspace, project };
}

describe("column name mapping", () => {
  it("round-trips camelCase and snake_case", () => {
    expect(toSnakeCase("selectedConceptId")).toBe("selected_concept_id");
    expect(toCamelCase("selected_concept_id")).toBe("selectedConceptId");
    expect(toCamelCase(toSnakeCase("voiceoverAssetId"))).toBe("voiceoverAssetId");
  });
});

describe("JsonTableDriver", () => {
  it("refuses unknown tables", async () => {
    await withTempDataDir(async (root) => {
      const driver = new JsonTableDriver(root);
      await expect(driver.select("secrets", {})).rejects.toThrow(/Unbekannte Tabelle/);
      expect(ALL_TABLES).toContain("projects");
    });
  });

  it("serialises concurrent writes without losing rows", async () => {
    await withTempDataDir(async (root) => {
      const driver = new JsonTableDriver(root);
      await Promise.all(
        Array.from({ length: 20 }, (_value, index) =>
          driver.insert("provider_usage", { id: `u${index}`, workspaceId: "ws_1" }),
        ),
      );
      expect(await driver.select("provider_usage", { workspaceId: "ws_1" })).toHaveLength(20);
    });
  });

  it("makes writes visible to a second driver on the same directory", async () => {
    // Next.js can instantiate a server module twice (page bundle vs. route
    // handler bundle). A driver must never serve rows another one cannot see.
    await withTempDataDir(async (root) => {
      const writer = new JsonTableDriver(root);
      const reader = new JsonTableDriver(root);

      // The reader observes the empty table first, which is what a stale cache
      // used to freeze in place.
      expect(await reader.select("projects", { workspaceId: "ws" })).toHaveLength(0);

      await writer.insert("projects", { id: "p1", workspaceId: "ws" });
      expect(await reader.select("projects", { workspaceId: "ws" })).toHaveLength(1);

      await writer.update("projects", { id: "p1" }, { name: "neu" });
      const rows = await reader.select<{ name?: string }>("projects", { id: "p1" });
      expect(rows[0].name).toBe("neu");

      await writer.delete("projects", { id: "p1" });
      expect(await reader.select("projects", { id: "p1" })).toHaveLength(0);
    });
  });

  it("orders and limits results", async () => {
    await withTempDataDir(async (root) => {
      const driver = new JsonTableDriver(root);
      await driver.insertMany("projects", [
        { id: "a", workspaceId: "ws", updatedAt: "2026-01-01" },
        { id: "b", workspaceId: "ws", updatedAt: "2026-03-01" },
        { id: "c", workspaceId: "ws", updatedAt: "2026-02-01" },
      ]);
      const rows = await driver.select<{ id: string }>(
        "projects",
        { workspaceId: "ws" },
        { orderBy: { column: "updatedAt", direction: "desc" }, limit: 2 },
      );
      expect(rows.map((row) => row.id)).toEqual(["b", "c"]);
    });
  });
});

describe("Repository", () => {
  it("scopes reads by workspace", async () => {
    await withTempDataDir(async (root) => {
      const { repo, project } = await setup(root);
      expect(await repo.getProject("ws_1", project.id)).not.toBeNull();
      expect(await repo.getProject("ws_other", project.id)).toBeNull();
      expect(await repo.listProjects("ws_other")).toHaveLength(0);
    });
  });

  it("stores and hydrates concepts with their scenes", async () => {
    await withTempDataDir(async (root) => {
      const { repo, project } = await setup(root);
      const concepts = composeConcepts(brief, 3).map((draft) =>
        layoutConcept(draft, { brief, projectId: project.id }),
      );
      await repo.replaceConcepts("ws_1", project.id, concepts);

      const stored = await repo.listConcepts("ws_1", project.id);
      expect(stored).toHaveLength(3);
      expect(stored[0].scenes.length).toBe(concepts[0].scenes.length);
      expect(stored[0].scenes.map((scene) => scene.index)).toEqual(
        stored[0].scenes.map((_scene, index) => index),
      );
    });
  });

  it("replaces the whole concept set on regeneration", async () => {
    await withTempDataDir(async (root) => {
      const { repo, project } = await setup(root);
      const first = composeConcepts(brief, 3).map((draft) =>
        layoutConcept(draft, { brief, projectId: project.id }),
      );
      await repo.replaceConcepts("ws_1", project.id, first);
      await repo.replaceConcepts("ws_1", project.id, first.slice(0, 1));

      expect(await repo.listConcepts("ws_1", project.id)).toHaveLength(1);
      // The orphaned scenes of the dropped concepts must be gone too.
      const orphan = await repo.getConcept("ws_1", first[1].id);
      expect(orphan).toBeNull();
    });
  });

  it("selects exactly one concept at a time", async () => {
    await withTempDataDir(async (root) => {
      const { repo, project } = await setup(root);
      const concepts = composeConcepts(brief, 3).map((draft) =>
        layoutConcept(draft, { brief, projectId: project.id }),
      );
      await repo.replaceConcepts("ws_1", project.id, concepts);

      await repo.selectConcept("ws_1", project.id, concepts[0].id);
      await repo.selectConcept("ws_1", project.id, concepts[2].id);

      const stored = await repo.listConcepts("ws_1", project.id);
      expect(stored.filter((concept) => concept.selected)).toHaveLength(1);
      expect(stored.find((concept) => concept.selected)?.id).toBe(concepts[2].id);
      expect((await repo.getProject("ws_1", project.id))?.selectedConceptId).toBe(concepts[2].id);
    });
  });

  it("deletes a project with all of its children", async () => {
    await withTempDataDir(async (root) => {
      const { repo, project } = await setup(root);
      const concepts = composeConcepts(brief, 1).map((draft) =>
        layoutConcept(draft, { brief, projectId: project.id }),
      );
      await repo.replaceConcepts("ws_1", project.id, concepts);
      await repo.createGenerationJob({ workspaceId: "ws_1", projectId: project.id, kind: "concepts" });

      expect(await repo.deleteProject("ws_1", project.id)).toBe(true);
      expect(await repo.getProject("ws_1", project.id)).toBeNull();
      expect(await repo.listConcepts("ws_1", project.id)).toHaveLength(0);
      expect(await repo.listGenerationJobs("ws_1", project.id)).toHaveLength(0);
    });
  });

  it("keeps the credit ledger and the balance in sync", async () => {
    await withTempDataDir(async (root) => {
      const { repo } = await setup(root);
      const spend = await repo.addCreditTransaction({
        workspaceId: "ws_1",
        amount: -30,
        reason: "Konzepte",
      });
      expect(spend.balance).toBe(70);

      const refund = await repo.addCreditTransaction({
        workspaceId: "ws_1",
        amount: 30,
        reason: "Rückbuchung",
      });
      expect(refund.balance).toBe(100);
      expect((await repo.getWorkspace("ws_1"))?.credits).toBe(100);

      // Newest first, even when both rows carry the same millisecond timestamp.
      const ledger = await repo.listCreditTransactions("ws_1");
      expect(ledger).toHaveLength(2);
      expect(ledger[0].balanceAfter).toBe(100);
      expect(ledger[1].balanceAfter).toBe(70);
    });
  });

  it("keeps at most one scene asset per role", async () => {
    await withTempDataDir(async (root) => {
      const { repo } = await setup(root);
      await repo.linkSceneAsset("ws_1", "scn_1", "ast_1", "background");
      await repo.linkSceneAsset("ws_1", "scn_1", "ast_2", "background");

      const links = await repo.listSceneAssets("ws_1", "scn_1");
      expect(links).toHaveLength(1);
      expect(links[0].assetId).toBe("ast_2");
    });
  });
});
