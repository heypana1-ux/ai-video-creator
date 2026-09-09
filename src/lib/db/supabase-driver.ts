import type { SupabaseClient } from "@supabase/supabase-js";

import type { Filter, QueryOptions, Row, TableDriver } from "./driver";

/**
 * Supabase/Postgres table driver.
 *
 * The domain uses camelCase, Postgres uses snake_case, so column names are
 * translated on the way in and out. Every query still carries the workspace
 * filter from the repository - RLS is the backstop, not the only guard.
 */

export function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

function encodeRow(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toSnakeCase(key), value]),
  );
}

function decodeRow<T extends Row>(row: Row): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toCamelCase(key), value]),
  ) as T;
}

function encodeFilter(filter: Filter): Filter {
  return Object.fromEntries(
    Object.entries(filter).map(([key, value]) => [toSnakeCase(key), value]),
  );
}

export class SupabaseTableDriver implements TableDriver {
  constructor(private readonly client: SupabaseClient) {}

  private applyFilter(
    query: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>,
    filter: Filter,
  ) {
    let next = query;
    for (const [column, value] of Object.entries(encodeFilter(filter))) {
      next = value === null ? next.is(column, null) : next.eq(column, value);
    }
    return next;
  }

  async select<T extends Row>(
    table: string,
    filter: Filter,
    options: QueryOptions = {},
  ): Promise<T[]> {
    let query = this.applyFilter(this.client.from(table).select("*"), filter);
    if (options.orderBy) {
      query = query.order(toSnakeCase(options.orderBy.column), {
        ascending: options.orderBy.direction === "asc",
      });
    }
    if (options.limit !== undefined) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw new Error(`select ${table}: ${error.message}`);
    return (data ?? []).map((row) => decodeRow<T>(row as Row));
  }

  async selectOne<T extends Row>(table: string, filter: Filter): Promise<T | null> {
    const rows = await this.select<T>(table, filter, { limit: 1 });
    return rows[0] ?? null;
  }

  async insert<T extends Row>(table: string, row: T): Promise<T> {
    const [inserted] = await this.insertMany(table, [row]);
    return inserted;
  }

  async insertMany<T extends Row>(table: string, rows: T[]): Promise<T[]> {
    if (rows.length === 0) return [];
    const { data, error } = await this.client
      .from(table)
      .insert(rows.map(encodeRow))
      .select("*");
    if (error) throw new Error(`insert ${table}: ${error.message}`);
    return (data ?? []).map((row) => decodeRow<T>(row as Row));
  }

  async update<T extends Row>(
    table: string,
    filter: Filter,
    patch: Partial<T>,
  ): Promise<T | null> {
    const query = this.applyFilter(
      this.client.from(table).update(encodeRow(patch as Row)).select("*") as never,
      filter,
    );
    const { data, error } = await query;
    if (error) throw new Error(`update ${table}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    return rows.length > 0 ? decodeRow<T>(rows[0]) : null;
  }

  async delete(table: string, filter: Filter): Promise<number> {
    const query = this.applyFilter(
      this.client.from(table).delete().select("id") as never,
      filter,
    );
    const { data, error } = await query;
    if (error) throw new Error(`delete ${table}: ${error.message}`);
    return (data ?? []).length;
  }

  async truncate(table: string): Promise<void> {
    const { error } = await this.client.from(table).delete().neq("id", "__never__");
    if (error) throw new Error(`truncate ${table}: ${error.message}`);
  }
}
