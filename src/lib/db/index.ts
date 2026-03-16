import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
  drizzleDb: PostgresJsDatabase | undefined;
};

function createDb(): PostgresJsDatabase {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = globalForDb.pgClient ?? postgres(connectionString, { max: 10 });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.pgClient = client;
  }

  const database = drizzle(client);

  if (process.env.NODE_ENV !== "production") {
    globalForDb.drizzleDb = database;
  }

  return database;
}

/** Lazy-initialized database client. Safe to import at build time. */
export const db: PostgresJsDatabase = new Proxy({} as PostgresJsDatabase, {
  get(_target, prop) {
    const instance = globalForDb.drizzleDb ?? createDb();
    globalForDb.drizzleDb = instance;
    return (instance as unknown as Record<string | symbol, unknown>)[prop];
  },
});
