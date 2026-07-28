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
}
// Run schema init on every cold start so column-add migrations apply to existing DBs.
initSchema(sqlite);

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      accepted_terms_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    -- id = SHA-256 hex del token de reseteo (nunca el token en claro).
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      kind_detail TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      audience TEXT,
      tone TEXT,
      goal TEXT,
      language TEXT NOT NULL DEFAULT 'es',
      format TEXT,
      target_pages INTEGER,
      perspective TEXT,
      formality TEXT,
      style_notes TEXT,
      glossary TEXT,
      avoid_terms TEXT,
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
      closing_content TEXT NOT NULL DEFAULT '',
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
    -- Huella de costo de CADA llamada a la IA (tokens + USD). Ver
    -- src/lib/ai-usage.ts. project_id usa SET NULL y NO cascade: si el autor
    -- borra un proyecto, el renglón de costo sobrevive desligado — el gasto ya
    -- ocurrió y borrarlo falsearía el margen del negocio.
    CREATE TABLE IF NOT EXISTS ai_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      accion TEXT NOT NULL,
      modelo TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      costo_usd REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_usage_user_time ON ai_usage(user_id, created_at);
    CREATE TABLE IF NOT EXISTS writing_days (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      words_added INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS writing_days_user_day ON writing_days(user_id, day);
    CREATE TABLE IF NOT EXISTS change_log (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      actor TEXT NOT NULL,
      kind TEXT NOT NULL,
      node_id TEXT,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS change_log_project_time ON change_log(project_id, created_at);
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      applied_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS suggestions_node_status ON suggestions(node_id, status);
    CREATE INDEX IF NOT EXISTS suggestions_project ON suggestions(project_id);
    -- Contadores de cuota. Una fila por (usuario, periodo, acción).
    CREATE TABLE IF NOT EXISTS usage_counters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      periodo TEXT NOT NULL,
      accion TEXT NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    -- Este UNIQUE no es decorativo: es el destino del ON CONFLICT del upsert
    -- atómico de consumirCuota(). Sin él, dos llamadas concurrentes podrían
    -- crear dos filas y rebasar la cuota.
    CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_user_periodo_accion
      ON usage_counters(user_id, periodo, accion);
    -- Espejo local de la suscripción de Stripe (verdad del ACCESO).
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan TEXT NOT NULL DEFAULT 'gratis',
      ciclo TEXT,
      estado TEXT NOT NULL DEFAULT 'ninguna',
      periodo_fin INTEGER,
      cancela_al_fin INTEGER NOT NULL DEFAULT 0,
      -- event.created del último evento de Stripe aplicado a esta fila: la marca
      -- de agua que permite descartar entregas viejas o fuera de orden.
      ultimo_evento_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id);
    -- UNIQUE para que el webhook de Stripe sea idempotente (un mismo
    -- subscription.id no puede duplicar filas). En SQLite un índice UNIQUE
    -- admite varios NULL, así que las filas sin suscripción no chocan.
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_unq
      ON subscriptions(stripe_subscription_id);
  `);

  // Idempotent column adds for existing DBs created before these fields existed.
  const migrations: Array<{ table: string; column: string; ddl: string }> = [
    // Nullable a propósito: los usuarios que ya existían nunca vieron la
    // casilla de términos, así que quedan en NULL en lugar de inventar fecha.
    { table: "users", column: "accepted_terms_at", ddl: "INTEGER" },
    // Rol: 'user' | 'superadmin'. SQLite SÍ acepta ADD COLUMN con NOT NULL
    // DEFAULT mientras el default sea una constante (verificado en 3.53, la
    // versión que trae better-sqlite3 12.x), así que las filas viejas quedan
    // en 'user' sin escritura extra. Aun así, esSuperAdmin() trata NULL como
    // 'user' por si alguna DB quedó con la columna nullable.
    { table: "users", column: "role", ddl: "TEXT NOT NULL DEFAULT 'user'" },
    { table: "projects", column: "kind_detail", ddl: "TEXT" },
    { table: "projects", column: "format", ddl: "TEXT" },
    { table: "projects", column: "target_pages", ddl: "INTEGER" },
    { table: "projects", column: "perspective", ddl: "TEXT" },
    { table: "projects", column: "formality", ddl: "TEXT" },
    { table: "projects", column: "style_notes", ddl: "TEXT" },
    { table: "projects", column: "glossary", ddl: "TEXT" },
    { table: "projects", column: "avoid_terms", ddl: "TEXT" },
    {
      table: "outline_nodes",
      column: "closing_content",
      ddl: "TEXT NOT NULL DEFAULT ''",
    },
    // Olvidada antes: DBs viejas no tenían script_content y crasheaban con
    // 'no such column' al tocar el teleprompter/generar guión.
    {
      table: "outline_nodes",
      column: "script_content",
      ddl: "TEXT NOT NULL DEFAULT ''",
    },
    // Marca de agua del webhook de Stripe. Nullable: las filas que ya existían
    // quedan en NULL = "nunca se aplicó un evento", así que aceptan el primero
    // que llegue en lugar de bloquearse.
    { table: "subscriptions", column: "ultimo_evento_at", ddl: "INTEGER" },
  ];
  for (const m of migrations) {
    try {
      db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.ddl}`);
    } catch (e) {
      // Solo ignorar el caso esperado (columna ya existe). Cualquier otro
      // error de DDL debe propagarse para no dejar el esquema corrupto en
      // silencio y luego manifestarse como un 'no such column' difícil de
      // diagnosticar.
      const msg = String((e as Error)?.message ?? e);
      if (!/duplicate column name/i.test(msg)) throw e;
    }
  }
}

export const db = drizzle(sqlite, { schema });
export { schema };
