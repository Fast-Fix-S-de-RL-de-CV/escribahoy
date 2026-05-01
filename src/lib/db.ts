import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "escribahoy.db");

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
};

const sqlite = globalForDb.sqlite ?? new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (!globalForDb.sqlite) {
  globalForDb.sqlite = sqlite;
  initSchema(sqlite);
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      audience TEXT,
      tone TEXT,
      goal TEXT,
      language TEXT NOT NULL DEFAULT 'es',
      status TEXT NOT NULL DEFAULT 'active',
      outline_generated INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS projects_user_idx ON projects(user_id);
    CREATE TABLE IF NOT EXISTS outline_nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id TEXT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'empty',
      content TEXT NOT NULL DEFAULT '',
      script_content TEXT NOT NULL DEFAULT '',
      word_count INTEGER NOT NULL DEFAULT 0,
      target_words INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS outline_project_idx ON outline_nodes(project_id);
    CREATE INDEX IF NOT EXISTS outline_parent_idx ON outline_nodes(parent_id);
    CREATE TABLE IF NOT EXISTS knowledge_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      extracted_text TEXT NOT NULL,
      summary TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS knowledge_project_idx ON knowledge_files(project_id);
    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      node_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_project_idx ON ai_messages(project_id);
    CREATE TABLE IF NOT EXISTS writing_days (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      words_added INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS writing_days_user_day ON writing_days(user_id, day);
  `);
}

export const db = drizzle(sqlite, { schema });
export { schema };
