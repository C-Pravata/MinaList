import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";

// SQLite does not have a direct 'serial' equivalent in the same way pg does.
// We use integer with primaryKey and autoIncrement.
// Timestamps are stored as integers (unix epoch seconds or milliseconds) or text (ISO8601 strings).
// Booleans are stored as integers (0 or 1).
// JSON/JSONB becomes text with mode: 'json'.
// Arrays become text with mode: 'json' or need a separate table.

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  avatar_url: text("avatar_url"),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
});

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  is_pinned: integer("is_pinned", { mode: "boolean" }).default(false),
  tags: text("tags", { mode: "json" }).$type<string[]>(), // Storing array as JSON string
  color: text("color").default("#ffffff"),
  user_id: integer("user_id"), // Assuming this might relate to users.id, add foreignKey if needed
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  is_deleted: integer("is_deleted", { mode: "boolean" }).default(false).notNull(),
});

export const aiChats = sqliteTable("ai_chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note_id: integer("note_id").notNull(), // Assuming this relates to notes.id
  messages: text("messages", { mode: "json" }).notNull().$type<{role: string, content: string}[]>(),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
});

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note_id: integer("note_id").notNull(), // Assuming this relates to notes.id
  file_path: text("file_path").notNull(),
  file_type: text("file_type").notNull(),
  file_name: text("file_name").notNull(),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
});

// Relations (should largely remain the same conceptually, but ensure field types match)
export const userRelations = relations(users, ({ many }) => ({
  notes: many(notes)
}));

export const noteRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.user_id],
    references: [users.id],
  }),
  aiChats: many(aiChats),
  attachments: many(attachments)
}));

export const aiChatRelations = relations(aiChats, ({ one }) => ({
  note: one(notes, {
    fields: [aiChats.note_id],
    references: [notes.id],
  }),
}));

export const attachmentRelations = relations(attachments, ({ one }) => ({
  note: one(notes, {
    fields: [attachments.note_id],
    references: [notes.id],
  }),
}));


// Zod schemas for insert/update (these should largely remain compatible if field names don't change)
// createInsertSchema should adapt to the new SQLite types.

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  avatar_url: true,
});

export const insertNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  is_pinned: true,
  tags: true,
  color: true,
  user_id: true,
});

export const updateNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  is_pinned: true,
  tags: true,
  color: true,
});

export const insertAiChatSchema = createInsertSchema(aiChats).pick({
  note_id: true,
  messages: true,
});

export const updateAiChatSchema = createInsertSchema(aiChats).pick({
  messages: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).pick({
  note_id: true,
  file_path: true,
  file_type: true,
  file_name: true,
});

// Export types (these infer from the table schemas, so should update automatically)
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type Note = typeof notes.$inferSelect;

export type InsertAiChat = z.infer<typeof insertAiChatSchema>;
export type UpdateAiChat = z.infer<typeof updateAiChatSchema>;
export type AiChat = typeof aiChats.$inferSelect;

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// Removed forward declarations for userRelations and noteRelations as they are defined after tables.
