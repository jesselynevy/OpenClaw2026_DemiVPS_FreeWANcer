import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../../freewancer.db");

let db;

function getDb() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

export function initDb() {
    const d = getDb();
    d.exec(`
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

CREATE TABLE IF NOT EXISTS project_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  estimated_hours REAL DEFAULT 1,
  progress INTEGER DEFAULT 0,
  priority_score REAL DEFAULT 0,
  due_date TEXT,
  last_reminder_sent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);
}

export function getClientByDiscordId(discordUserId) {
  return getDb().prepare("SELECT * FROM clients WHERE discord_user_id = ?").get(discordUserId) ?? null;
}

export function getClientByChannelId(channelId) {
  return getDb().prepare("SELECT * FROM clients WHERE private_channel_id = ?").get(channelId) ?? null;
}

export function upsertClient(discordUserId, privateChannelId) {
  return getDb()
    .prepare(
      `INSERT INTO clients (discord_user_id, private_channel_id)
       VALUES (?, ?)
       ON CONFLICT (discord_user_id) DO UPDATE SET private_channel_id = excluded.private_channel_id
       RETURNING *`
    )
    .get(discordUserId, privateChannelId);
}
