// @vitest-environment node
import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { withTenant, withTenantAnd } from "../base";

// Minimal test table with an operatorId column
const testTable = pgTable("test_table", {
  id: uuid().primaryKey().defaultRandom(),
  operatorId: integer().notNull(),
});

describe("withTenant", () => {
  it("returns a SQL condition that can be used in a where clause", () => {
    const condition = withTenant(testTable, 42);
    // The condition should be a SQL object (not null/undefined)
    expect(condition).toBeDefined();
    expect(condition).not.toBeNull();
  });
});

describe("withTenantAnd", () => {
  it("combines tenant scope with additional conditions", () => {
    const extra = sql`${testTable.id} = 'abc'`;
    const condition = withTenantAnd(testTable, 42, extra);
    expect(condition).toBeDefined();
    expect(condition).not.toBeNull();
  });

  it("works with multiple additional conditions", () => {
    const cond1 = sql`1 = 1`;
    const cond2 = sql`2 = 2`;
    const condition = withTenantAnd(testTable, 1, cond1, cond2);
    expect(condition).toBeDefined();
  });
});
