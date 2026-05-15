import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** SQLite: store clients, projects, revision counts */
let db;

export function getDb() {
  if (db) return db;

  const file = process.env.DATABASE_PATH ?? "./data/freewancer.sqlite";
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT NOT NULL UNIQUE,
      private_channel_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'intake',
      revision_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}
