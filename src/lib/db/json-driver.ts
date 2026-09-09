import { promises as fs } from "node:fs";
import path from "node:path";

import { ALL_TABLES, type Filter, type QueryOptions, type Row, type TableDriver } from "./driver";

/**
 * File backed table driver used in demo mode.
 *
 * One JSON file per table under `<dataDir>/db`. Writes are serialised through a
 * per-process promise chain and go via a temp file + rename, so a crash mid
 * write cannot leave a half written table behind.
 *
 * Reads always hit the disk. An in-memory row cache looks tempting for a store
 * this small, but Next.js can instantiate a server module more than once (a
 * page bundle and a route-handler bundle), and a cache populated by one of them
 * then hides rows written by the other. The files are tiny; correctness wins.
 */
export class JsonTableDriver implements TableDriver {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly root: string) {}

  private file(table: string): string {
    if (!ALL_TABLES.includes(table as (typeof ALL_TABLES)[number])) {
      throw new Error(`Unbekannte Tabelle: ${table}`);
    }
    return path.join(this.root, `${table}.json`);
  }

  private async load(table: string): Promise<Row[]> {
    // Resolve (and therefore validate) the table name outside the try, so the
    // allowlist is not swallowed by the "file does not exist yet" fallback.
    const file = this.file(table);
    try {
      const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Row[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async persist(table: string, rows: Row[]): Promise<void> {
    const target = this.file(table);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(rows, null, 2));
    await fs.rename(temporary, target);
  }

  /** Serialises every mutation so concurrent requests cannot interleave. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private static matches(row: Row, filter: Filter): boolean {
    return Object.entries(filter).every(([column, value]) => row[column] === value);
  }

  async select<T extends Row>(
    table: string,
    filter: Filter,
    options: QueryOptions = {},
  ): Promise<T[]> {
    const rows = await this.load(table);
    let result = rows.filter((row) => JsonTableDriver.matches(row, filter));

    if (options.orderBy) {
      const { column, direction } = options.orderBy;
      // Timestamps only have millisecond resolution, so two rows written in the
      // same tick would otherwise come back in an arbitrary order. Ties fall
      // back to insertion order, which follows the requested direction.
      const position = new Map(result.map((row, index) => [row, index]));
      result = [...result].sort((a, b) => {
        const left = a[column];
        const right = b[column];
        const comparison =
          left === right
            ? (position.get(a) ?? 0) - (position.get(b) ?? 0)
            : (left as never) > (right as never)
              ? 1
              : -1;
        return direction === "desc" ? -comparison : comparison;
      });
    }
    if (options.limit !== undefined) result = result.slice(0, options.limit);

    return result as T[];
  }

  async selectOne<T extends Row>(table: string, filter: Filter): Promise<T | null> {
    const rows = await this.select<T>(table, filter, { limit: 1 });
    return rows[0] ?? null;
  }

  async insert<T extends Row>(table: string, row: T): Promise<T> {
    const [inserted] = await this.insertMany(table, [row]);
    return inserted;
  }

  async insertMany<T extends Row>(table: string, newRows: T[]): Promise<T[]> {
    if (newRows.length === 0) return [];
    return this.enqueue(async () => {
      const rows = await this.load(table);
      await this.persist(table, [...rows, ...newRows]);
      return newRows;
    });
  }

  async update<T extends Row>(
    table: string,
    filter: Filter,
    patch: Partial<T>,
  ): Promise<T | null> {
    return this.enqueue(async () => {
      const rows = await this.load(table);
      let updated: Row | null = null;
      const next = rows.map((row) => {
        if (updated || !JsonTableDriver.matches(row, filter)) return row;
        updated = { ...row, ...(patch as Row) };
        return updated;
      });
      if (!updated) return null;
      await this.persist(table, next);
      return updated as T;
    });
  }

  async delete(table: string, filter: Filter): Promise<number> {
    return this.enqueue(async () => {
      const rows = await this.load(table);
      const next = rows.filter((row) => !JsonTableDriver.matches(row, filter));
      const removed = rows.length - next.length;
      if (removed > 0) await this.persist(table, next);
      return removed;
    });
  }

  async truncate(table: string): Promise<void> {
    await this.enqueue(() => this.persist(table, []));
  }
}
