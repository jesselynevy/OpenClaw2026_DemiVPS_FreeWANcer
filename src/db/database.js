import pg from "pg";

const { Pool } = pg;

/** PostgreSQL: store clients, projects, revision counts */
let pool;
let schemaReady;

function connectionString() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;

  const host = process.env.PGHOST ?? "localhost";
  const port = Number(process.env.PGPORT ?? 5432);
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD ?? "";
  const database = process.env.PGDATABASE;
  if (!user || !database) {
    throw new Error("Set DATABASE_URL or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE for PostgreSQL");
  }
  const enc = encodeURIComponent(password);
  return `postgresql://${encodeURIComponent(user)}:${enc}@${host}:${port}/${encodeURIComponent(database)}`;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: connectionString() });
  }
  return pool;
}

/** Run once; safe to call multiple times (deduped). */
export async function initDb() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const p = getPool();
      const client = await p.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS clients (
            id BIGSERIAL PRIMARY KEY,
            discord_user_id TEXT NOT NULL UNIQUE,
            private_channel_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS projects (
            id BIGSERIAL PRIMARY KEY,
            client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            phase TEXT NOT NULL DEFAULT 'intake',
            revision_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
      } finally {
        client.release();
      }
    })();
  }
  await schemaReady;
}
