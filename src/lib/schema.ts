import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
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
export type Project = typeof projects.$inferSelect;
export type OutlineNode = typeof outlineNodes.$inferSelect;
export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;
export type AIMessage = typeof aiMessages.$inferSelect;
export type ChangeLog = typeof changeLog.$inferSelect;
