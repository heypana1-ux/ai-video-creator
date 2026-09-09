/**
 * A very small table abstraction.
 *
 * The repository is written once against this interface and works unchanged on
 * top of the local JSON store (demo mode) and Supabase/Postgres. It only needs
 * equality filters, ordering and limits - anything more complex belongs in a
 * database view, not here.
 */

export type Row = Record<string, unknown>;

export interface Filter {
  [column: string]: string | number | boolean | null;
}

export interface QueryOptions {
  orderBy?: { column: string; direction: "asc" | "desc" };
  limit?: number;
}

export interface TableDriver {
  select<T extends Row>(table: string, filter: Filter, options?: QueryOptions): Promise<T[]>;
  selectOne<T extends Row>(table: string, filter: Filter): Promise<T | null>;
  insert<T extends Row>(table: string, row: T): Promise<T>;
  insertMany<T extends Row>(table: string, rows: T[]): Promise<T[]>;
  update<T extends Row>(table: string, filter: Filter, patch: Partial<T>): Promise<T | null>;
  delete(table: string, filter: Filter): Promise<number>;
  /** Removes every row - used by tests and the seed script. */
  truncate(table: string): Promise<void>;
}

export const TABLES = {
  users: "users",
  workspaces: "workspaces",
  projects: "projects",
  projectAssets: "project_assets",
  concepts: "concepts",
  scenes: "scenes",
  sceneAssets: "scene_assets",
  brandKits: "brand_kits",
  generationJobs: "generation_jobs",
  renderJobs: "render_jobs",
  exports: "exports",
  providerUsage: "provider_usage",
  subscriptions: "subscriptions",
  creditTransactions: "credit_transactions",
} as const;

export const ALL_TABLES = Object.values(TABLES);
