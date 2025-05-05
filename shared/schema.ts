import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  avatar_url: text("avatar_url"),
  firebase_uid: text("firebase_uid").unique(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  is_pinned: boolean("is_pinned").default(false),
  tags: text("tags").array(),
  color: text("color").default("#ffffff"),
  user_id: integer("user_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  is_deleted: boolean("is_deleted").default(false).notNull(),
});

// Forward declarations - will be set after table definitions
export const userRelations = relations(users, ({ many }) => ({
  notes: many(notes)
}));

export const noteRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.user_id],
    references: [users.id]
  }),
  aiChats: many(aiChats),
  attachments: many(attachments)
}));

export const aiChats = pgTable("ai_chats", {
  id: serial("id").primaryKey(),
  note_id: integer("note_id").notNull(),
  messages: jsonb("messages").notNull().$type<{role: string, content: string}[]>(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const aiChatRelations = relations(aiChats, ({ one }) => ({
  note: one(notes, {
    fields: [aiChats.note_id],
    references: [notes.id],
  }),
}));

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  note_id: integer("note_id").notNull(),
  file_path: text("file_path").notNull(),
  file_type: text("file_type").notNull(),
  file_name: text("file_name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const attachmentRelations = relations(attachments, ({ one }) => ({
  note: one(notes, {
    fields: [attachments.note_id],
    references: [notes.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  avatar_url: true,
  firebase_uid: true,
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

// We've already set up the relations above, no need to redefine them
