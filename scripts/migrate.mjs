/**
 * Lightweight migration runner for production.
 * Uses the postgres driver directly (no drizzle-kit dependency).
 * Reads SQL files from drizzle/ and applies them in order.
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(__dirname, "..", "drizzle");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function migrate() {
  console.log("Running migrations...");

  // Create migrations tracking table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `;
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `;

  // Get already-applied migrations
  const applied = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const appliedHashes = new Set(applied.map((r) => r.hash));

  // Read journal
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf-8"));

  let count = 0;
  for (const entry of journal.entries) {
    if (appliedHashes.has(entry.tag)) {
      continue;
    }

    const sqlFile = readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf-8");
    // Split on statement breakpoints
    const statements = sqlFile
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`  Applying: ${entry.tag} (${statements.length} statements)`);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${entry.tag}, ${Date.now()})`;
    count++;
  }

  if (count === 0) {
    console.log("  No pending migrations.");
  } else {
    console.log(`  Applied ${count} migration(s).`);
  }

  await sql.end();
  console.log("Migrations complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
