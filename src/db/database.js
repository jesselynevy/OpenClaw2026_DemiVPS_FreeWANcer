import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

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
      channel_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT 'Proyek',
      phase TEXT NOT NULL DEFAULT 'intake',
      allowed_revisions INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS prd_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      freelancer_approved INTEGER NOT NULL DEFAULT 0,
      client_approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS prd_revision_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prd_id INTEGER NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,
      author_discord_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      prd_id INTEGER NOT NULL REFERENCES prd_documents(id),
      content_json TEXT NOT NULL,
      draft_pdf_path TEXT NOT NULL,
      signed_pdf_path TEXT,
      freelancer_signed INTEGER NOT NULL DEFAULT 0,
      client_signed INTEGER NOT NULL DEFAULT 0,
      freelancer_signature_path TEXT,
      client_signature_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrate(db);
  return db;
}

function migrate(d) {
  const alters = [
    "ALTER TABLE projects ADD COLUMN channel_id TEXT",
    "ALTER TABLE projects ADD COLUMN phase TEXT NOT NULL DEFAULT 'intake'",
    "ALTER TABLE projects ADD COLUMN allowed_revisions INTEGER NOT NULL DEFAULT 2",
  ];
  for (const sql of alters) {
    try {
      d.exec(sql);
    } catch {
      /* column exists */
    }
  }
  
  // Add performance indexes (non-blocking, only if missing)
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_projects_channel ON projects(channel_id)",
    "CREATE INDEX IF NOT EXISTS idx_prd_project_version ON prd_documents(project_id, version DESC)",
    "CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id)",
    "CREATE INDEX IF NOT EXISTS idx_clients_discord ON clients(discord_user_id)",
  ];
  for (const sql of indexes) {
    try {
      d.exec(sql);
    } catch {
      /* index exists */
    }
  }
}

export function getClientByDiscordId(discordUserId) {
  return getDb().prepare("SELECT * FROM clients WHERE discord_user_id = ?").get(discordUserId) ?? null;
}

export function getClientByChannelId(channelId) {
  return (
    getDb()
      .prepare(
        `SELECT c.* FROM clients c
         JOIN projects p ON p.client_id = c.id
         WHERE p.channel_id = ?`
      )
      .get(channelId) ?? null
  );
}

export function getProjectsByClientId(clientId) {
  return getDb()
    .prepare("SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC")
    .all(clientId);
}

export function upsertClient(discordUserId, privateChannelId) {
  return getDb()
    .prepare(
      `INSERT INTO clients (discord_user_id, private_channel_id)
       VALUES (?, ?)
       ON CONFLICT (discord_user_id) DO UPDATE SET private_channel_id = excluded.private_channel_id
       RETURNING *`,
    )
    .get(discordUserId, privateChannelId);
}

export function getProjectByChannelId(channelId) {
  return getDb().prepare("SELECT * FROM projects WHERE channel_id = ?").get(channelId) ?? null;
}

export function ensureProject(clientId, channelId, name = "Proyek") {
  const existing = getDb().prepare("SELECT * FROM projects WHERE channel_id = ?").get(channelId);
  if (existing) return existing;
  return getDb()
    .prepare(
      `INSERT INTO projects (client_id, channel_id, name, phase)
       VALUES (?, ?, ?, 'intake')
       RETURNING *`,
    )
    .get(clientId, channelId, name);
}

export function setProjectPhase(projectId, phase) {
  getDb().prepare("UPDATE projects SET phase = ? WHERE id = ?").run(phase, projectId);
}

export function getLatestPrd(projectId) {
  return (
    getDb()
      .prepare("SELECT * FROM prd_documents WHERE project_id = ? ORDER BY version DESC LIMIT 1")
      .get(projectId) ?? null
  );
}

export function insertPrd(projectId, version, content) {
  return getDb()
    .prepare(
      `INSERT INTO prd_documents (project_id, version, content, freelancer_approved, client_approved)
       VALUES (?, ?, ?, 0, 0)
       RETURNING *`,
    )
    .get(projectId, version, content);
}

export function setPrdApproval(prdId, role) {
  const col = role === "freelancer" ? "freelancer_approved" : "client_approved";
  getDb().prepare(`UPDATE prd_documents SET ${col} = 1 WHERE id = ?`).run(prdId);
  return getDb().prepare("SELECT * FROM prd_documents WHERE id = ?").get(prdId);
}

export function resetPrdApprovals(prdId) {
  getDb()
    .prepare("UPDATE prd_documents SET freelancer_approved = 0, client_approved = 0 WHERE id = ?")
    .run(prdId);
}

export function addPrdRevisionNote(prdId, authorDiscordId, note) {
  getDb()
    .prepare("INSERT INTO prd_revision_notes (prd_id, author_discord_id, note) VALUES (?, ?, ?)")
    .run(prdId, authorDiscordId, note);
}

export function getPrdRevisionNotes(prdId) {
  return getDb()
    .prepare("SELECT * FROM prd_revision_notes WHERE prd_id = ? ORDER BY created_at ASC")
    .all(prdId);
}

export function getContractByProjectId(projectId) {
  return getDb().prepare("SELECT * FROM contracts WHERE project_id = ?").get(projectId) ?? null;
}

export function insertContract(projectId, prdId, contentJson, draftPdfPath) {
  return getDb()
    .prepare(
      `INSERT INTO contracts (project_id, prd_id, content_json, draft_pdf_path)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
    .get(projectId, prdId, contentJson, draftPdfPath);
}

export function setContractSignature(contractId, role, signaturePath) {
  const signedCol = role === "freelancer" ? "freelancer_signed" : "client_signed";
  const pathCol = role === "freelancer" ? "freelancer_signature_path" : "client_signature_path";
  getDb()
    .prepare(`UPDATE contracts SET ${signedCol} = 1, ${pathCol} = ? WHERE id = ?`)
    .run(signaturePath, contractId);
  return getDb().prepare("SELECT * FROM contracts WHERE id = ?").get(contractId);
}

export function setContractSignedPdf(contractId, signedPdfPath) {
  getDb().prepare("UPDATE contracts SET signed_pdf_path = ? WHERE id = ?").run(signedPdfPath, contractId);
  return getDb().prepare("SELECT * FROM contracts WHERE id = ?").get(contractId);
}
