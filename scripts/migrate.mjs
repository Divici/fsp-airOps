/**
 * Lightweight migration runner for production.
 * Compatible with drizzle-kit's migration tracking format.
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
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

  // Create drizzle schema and migrations table (matches drizzle-kit format)
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `;

  // Get already-applied migration hashes
  const applied = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const appliedHashes = new Set(applied.map((r) => r.hash));

  // Read journal
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf-8"));

  let count = 0;
  for (const entry of journal.entries) {
    const sqlContent = readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf-8");

    // Compute SHA-256 hash of SQL content (same as drizzle-kit)
    const hash = createHash("sha256").update(sqlContent).digest("hex");

    if (appliedHashes.has(hash)) {
      continue;
    }

    // Split on statement breakpoints
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`  Applying: ${entry.tag} (${statements.length} statements)`);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${Date.now()})`;
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
