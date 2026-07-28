import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  acceptedTermsAt: integer("accepted_terms_at", { mode: "timestamp" }),
  // 'user' | 'superadmin'. Texto libre a propósito (no enum de drizzle) para
  // que una fila con un valor inesperado no rompa el tipado; el código compara
  // en minúsculas y trata cualquier cosa que no sea 'superadmin' como 'user'.
  // La red de seguridad real es SUPERADMIN_EMAILS (ver src/lib/subscription.ts).
  role: text("role").default("user").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

// El id ES el SHA-256 hex del token de reseteo: nunca se guarda el token en
// claro, así que una filtración de la DB no permite reusar los enlaces.
export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["book", "course"] }).notNull(),
  kindDetail: text("kind_detail"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  audience: text("audience"),
  tone: text("tone"),
  goal: text("goal"),
  language: text("language").default("es").notNull(),
  format: text("format"),
  targetPages: integer("target_pages"),
  perspective: text("perspective"),
  formality: text("formality"),
  styleNotes: text("style_notes"),
  glossary: text("glossary"),
  avoidTerms: text("avoid_terms"),
  status: text("status", { enum: ["draft", "active", "archived"] })
    .default("active")
    .notNull(),
  outlineGenerated: integer("outline_generated", { mode: "boolean" })
    .default(false)
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const outlineNodes = sqliteTable("outline_nodes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  kind: text("kind", {
    enum: [
      "chapter",
      "section",
      "module",
      "lesson",
      "frontmatter",
      "backmatter",
    ],
  }).notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  position: integer("position").notNull().default(0),
  status: text("status", {
    enum: ["empty", "draft", "in_progress", "complete"],
  })
    .default("empty")
    .notNull(),
  content: text("content").default("").notNull(),
  closingContent: text("closing_content").default("").notNull(),
  scriptContent: text("script_content").default("").notNull(),
  wordCount: integer("word_count").default(0).notNull(),
  targetWords: integer("target_words").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const knowledgeFiles = sqliteTable("knowledge_files", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  extractedText: text("extracted_text").notNull(),
  summary: text("summary"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const aiMessages = sqliteTable("ai_messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  nodeId: text("node_id"),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Huella de CADA llamada a la IA: tokens, modelo y costo en dólares.
 * Es la tabla que responde "¿este usuario me está costando más de lo que
 * paga?". Se escribe siempre, nunca se lee en el camino crítico.
 *
 * projectId es nullable y con ON DELETE SET NULL (no CASCADE): si el autor
 * borra un proyecto NO se borra el historial de costo, solo se desliga.
 * El costo ya se pagó; borrarlo falsearía el margen.
 */
export const aiUsage = sqliteTable("ai_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  accion: text("accion", {
    enum: [
      "temario",
      "redistribuir",
      "sugerencia",
      "chat",
      "dictado",
      "guion",
      "decoracion",
      "kb",
    ],
  }).notNull(),
  modelo: text("modelo", { enum: ["opus", "sonnet", "haiku"] }).notNull(),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  cacheReadTokens: integer("cache_read_tokens").default(0).notNull(),
  cacheWriteTokens: integer("cache_write_tokens").default(0).notNull(),
  /** Costo real de la llamada en USD, ya con los multiplicadores de caché. */
  costoUsd: real("costo_usd").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type AIUsage = typeof aiUsage.$inferSelect;

export const suggestions = sqliteTable("suggestions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull(),
  content: text("content").notNull(),
  status: text("status", {
    enum: ["pending", "applied", "dismissed"],
  })
    .default("pending")
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  appliedAt: integer("applied_at", { mode: "timestamp" }),
});

export const changeLog = sqliteTable("change_log", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  actor: text("actor", { enum: ["user", "ai"] }).notNull(),
  kind: text("kind").notNull(),
  nodeId: text("node_id"),
  description: text("description").notNull(),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const writingDays = sqliteTable("writing_days", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  wordsAdded: integer("words_added").default(0).notNull(),
});

/**
 * Contadores de cuota por usuario, periodo y acción.
 *
 * `periodo` es el mes calendario "YYYY-MM" en hora de México (no UTC): ver
 * `periodoActual()` en src/lib/quotas.ts. Una fila por (usuario, periodo,
 * acción); el UNIQUE que lo garantiza se crea en initSchema (src/lib/db.ts)
 * porque es el que hace posible el upsert atómico `ON CONFLICT(...)`.
 *
 * Es tabla de CONTEO, no de auditoría: el detalle con costo real vive en
 * `aiUsage`. Nunca se borra al bajar de plan (el historial de uso sirve para
 * soporte y para el panel).
 */
export const usageCounters = sqliteTable("usage_counters", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Mes calendario "YYYY-MM" en America/Mexico_City. */
  periodo: text("periodo").notNull(),
  /** AccionIA de src/lib/plans.ts (texto libre para no romper con acciones nuevas). */
  accion: text("accion").notNull(),
  cantidad: integer("cantidad").default(0).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Espejo local de la suscripción de Stripe. Stripe es la verdad del cobro;
 * esta tabla es la verdad del ACCESO, para no llamar a su API en cada request.
 * La escribe el webhook; leerla es lo que hace `suscripcionDe()`.
 */
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  /** PlanId de src/lib/plans.ts. */
  plan: text("plan").default("gratis").notNull(),
  /** Ciclo de src/lib/plans.ts: 'mes' | 'anual'. Null si no hay suscripción. */
  ciclo: text("ciclo"),
  /** Estado tal como lo manda Stripe ('active', 'past_due', …) o 'ninguna'. */
  estado: text("estado").default("ninguna").notNull(),
  /** Fin del periodo pagado: hasta cuándo hay acceso aunque falle el cobro. */
  periodoFin: integer("periodo_fin", { mode: "timestamp" }),
  cancelaAlFin: integer("cancela_al_fin", { mode: "boolean" })
    .default(false)
    .notNull(),
  /**
   * `event.created` del ÚLTIMO evento de Stripe que se aplicó a esta fila.
   *
   * Es la marca de agua que hace idempotente y a prueba de desorden al webhook:
   * Stripe reintenta las entregas y NO garantiza el orden, así que un evento con
   * `created` anterior a este valor se descarta sin escribir. Sin esto, un
   * `customer.subscription.updated` viejo reentregado después de un upgrade
   * degradaría al usuario a su plan anterior.
   *
   * Nullable a propósito: las filas creadas antes de existir la columna (y las
   * que crea el checkout antes de que llegue el primer evento) quedan en NULL,
   * que se trata como "nunca se aplicó un evento" y por lo tanto acepta el
   * primero que llegue. Ver src/app/api/stripe/webhook/route.ts.
   */
  ultimoEventoAt: integer("ultimo_evento_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projectsRelations = relations(projects, ({ many, one }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  outline: many(outlineNodes),
  knowledge: many(knowledgeFiles),
  messages: many(aiMessages),
}));

export const outlineRelations = relations(outlineNodes, ({ one, many }) => ({
  project: one(projects, {
    fields: [outlineNodes.projectId],
    references: [projects.id],
  }),
  children: many(outlineNodes),
}));

export type User = typeof users.$inferSelect;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type OutlineNode = typeof outlineNodes.$inferSelect;
export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;
export type AIMessage = typeof aiMessages.$inferSelect;
export type ChangeLog = typeof changeLog.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;
export type UsageCounter = typeof usageCounters.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
