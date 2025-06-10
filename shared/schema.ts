import {
  pgTable,
  text,
  serial,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";

// SQLite does not have a direct 'serial' equivalent in the same way pg does.
// We use integer with primaryKey and autoIncrement.
// Timestamps are stored as integers (unix epoch seconds or milliseconds) or text (ISO8601 strings).
// Booleans are stored as integers (0 or 1).
// JSON/JSONB becomes text with mode: 'json'.
// Arrays become text with mode: 'json' or need a separate table.

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  is_pinned: boolean("is_pinned").default(false),
  tags: jsonb("tags").$type<string[]>(),
  color: text("color").default("#ffffff"),
  device_id: text("device_id").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
  is_deleted: boolean("is_deleted").default(false).notNull(),
});

export const aiChats = pgTable("ai_chats", {
  id: serial("id").primaryKey(),
  note_id: serial("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  device_id: text("device_id").notNull(),
  messages: jsonb("messages")
    .notNull()
    .$type<{ role: string; content: string }[]>(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  note_id: serial("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  device_id: text("device_id").notNull(),
  file_path: text("file_path").notNull(),
  file_type: text("file_type").notNull(),
  file_name: text("file_name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const noteRelations = relations(notes, ({ many }) => ({
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


// Zod schemas for insert/update

export const insertNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  is_pinned: true,
  tags: true,
  color: true,
  device_id: true, // device_id will be added by server from header usually, or client if needed for optimistic updates
});

export const updateNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  is_pinned: true,
  tags: true,
  color: true,
  // device_id is not updatable and used for where clause
});

export const insertAiChatSchema = createInsertSchema(aiChats).pick({
  note_id: true,
  device_id: true,
  messages: true,
});

export const updateAiChatSchema = createInsertSchema(aiChats).pick({
  messages: true,
  // device_id is not updatable
});

export const insertAttachmentSchema = createInsertSchema(attachments).pick({
  note_id: true,
  device_id: true,
  file_path: true,
  file_type: true,
  file_name: true,
});

// Export types
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type Note = typeof notes.$inferSelect;

export type InsertAiChat = z.infer<typeof insertAiChatSchema>;
export type UpdateAiChat = z.infer<typeof updateAiChatSchema>;
export type AiChat = typeof aiChats.$inferSelect;

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;
