var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express3 from "express";

// server/routes.ts
import express from "express";
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  aiChatRelations: () => aiChatRelations,
  aiChats: () => aiChats,
  attachmentRelations: () => attachmentRelations,
  attachments: () => attachments,
  insertAiChatSchema: () => insertAiChatSchema,
  insertAttachmentSchema: () => insertAttachmentSchema,
  insertNoteSchema: () => insertNoteSchema,
  noteRelations: () => noteRelations,
  notes: () => notes,
  updateAiChatSchema: () => updateAiChatSchema,
  updateNoteSchema: () => updateNoteSchema
});
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
var notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  is_pinned: integer("is_pinned", { mode: "boolean" }).default(false),
  tags: text("tags", { mode: "json" }).$type(),
  // Storing array as JSON string
  color: text("color").default("#ffffff"),
  device_id: text("device_id").notNull(),
  // Changed from user_id, made text
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  is_deleted: integer("is_deleted", { mode: "boolean" }).default(false).notNull()
});
var aiChats = sqliteTable("ai_chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note_id: integer("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  // Added reference
  device_id: text("device_id").notNull(),
  // Added device_id for consistency, tied to note's device
  messages: text("messages", { mode: "json" }).notNull().$type(),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull()
});
var attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note_id: integer("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  // Added reference
  device_id: text("device_id").notNull(),
  // Added device_id for consistency, tied to note's device
  file_path: text("file_path").notNull(),
  file_type: text("file_type").notNull(),
  file_name: text("file_name").notNull(),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull()
});
var noteRelations = relations(notes, ({ many }) => ({
  aiChats: many(aiChats),
  attachments: many(attachments)
}));
var aiChatRelations = relations(aiChats, ({ one }) => ({
  note: one(notes, {
    fields: [aiChats.note_id],
    references: [notes.id]
  })
}));
var attachmentRelations = relations(attachments, ({ one }) => ({
  note: one(notes, {
    fields: [attachments.note_id],
    references: [notes.id]
  })
}));
var insertNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  is_pinned: true,
  tags: true,
  color: true,
  device_id: true
  // device_id will be added by server from header usually, or client if needed for optimistic updates
});
var updateNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  is_pinned: true,
  tags: true,
  color: true
  // device_id is not updatable and used for where clause
});
var insertAiChatSchema = createInsertSchema(aiChats).pick({
  note_id: true,
  device_id: true,
  messages: true
});
var updateAiChatSchema = createInsertSchema(aiChats).pick({
  messages: true
  // device_id is not updatable
});
var insertAttachmentSchema = createInsertSchema(attachments).pick({
  note_id: true,
  device_id: true,
  file_path: true,
  file_type: true,
  file_name: true
});

// server/db.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to create a .env file or define the variable?"
  );
}
var sqlitePath = process.env.DATABASE_URL.startsWith("sqlite:") ? process.env.DATABASE_URL.substring(7) : process.env.DATABASE_URL;
var sqlite = new Database(sqlitePath);
var db = drizzle(sqlite, { schema: schema_exports });

// server/storage.ts
import { eq, and, desc } from "drizzle-orm";
var DatabaseStorage = class {
  // Note operations
  async getNotes(deviceId) {
    return await db.select().from(notes).where(and(
      eq(notes.is_deleted, false),
      eq(notes.device_id, deviceId)
    )).orderBy(desc(notes.updated_at));
  }
  async getNote(id, deviceId) {
    const [note] = await db.select().from(notes).where(and(
      eq(notes.id, id),
      eq(notes.device_id, deviceId),
      eq(notes.is_deleted, false)
    ));
    return note;
  }
  async createNote(insertNote) {
    const [note] = await db.insert(notes).values({
      title: insertNote.title,
      content: insertNote.content,
      device_id: insertNote.device_id,
      is_pinned: insertNote.is_pinned,
      tags: insertNote.tags,
      // Ensure correct type or undefined
      color: insertNote.color,
      is_deleted: false
    }).returning();
    return note;
  }
  async updateNote(id, deviceId, noteUpdates) {
    const [note] = await db.update(notes).set({
      title: noteUpdates.title,
      content: noteUpdates.content,
      is_pinned: noteUpdates.is_pinned,
      tags: noteUpdates.tags,
      // Ensure correct type or undefined
      color: noteUpdates.color,
      updated_at: /* @__PURE__ */ new Date()
    }).where(and(
      eq(notes.id, id),
      eq(notes.device_id, deviceId),
      eq(notes.is_deleted, false)
    )).returning();
    return note;
  }
  async deleteNote(id, deviceId) {
    const result = await db.update(notes).set({ is_deleted: true, updated_at: /* @__PURE__ */ new Date() }).where(and(
      eq(notes.id, id),
      eq(notes.device_id, deviceId)
    )).returning();
    return result.length > 0;
  }
  // AI Chat operations
  async getAiChats(noteId, deviceId) {
    return await db.select({
      id: aiChats.id,
      note_id: aiChats.note_id,
      device_id: aiChats.device_id,
      messages: aiChats.messages,
      created_at: aiChats.created_at,
      updated_at: aiChats.updated_at
    }).from(aiChats).innerJoin(notes, eq(aiChats.note_id, notes.id)).where(and(
      eq(aiChats.note_id, noteId),
      eq(notes.device_id, deviceId)
    )).orderBy(desc(aiChats.created_at));
  }
  async getAiChat(id, deviceId) {
    const [chat] = await db.select({
      id: aiChats.id,
      note_id: aiChats.note_id,
      device_id: aiChats.device_id,
      messages: aiChats.messages,
      created_at: aiChats.created_at,
      updated_at: aiChats.updated_at
    }).from(aiChats).innerJoin(notes, eq(aiChats.note_id, notes.id)).where(and(
      eq(aiChats.id, id),
      eq(notes.device_id, deviceId)
    ));
    return chat;
  }
  async createAiChat(insertChat) {
    const [chat] = await db.insert(aiChats).values({
      note_id: insertChat.note_id,
      device_id: insertChat.device_id,
      messages: insertChat.messages
      // Ensure correct type
    }).returning();
    return chat;
  }
  async updateAiChat(id, deviceId, chatUpdates) {
    const chatToUpdate = await this.getAiChat(id, deviceId);
    if (!chatToUpdate) return void 0;
    const [chat] = await db.update(aiChats).set({
      messages: chatUpdates.messages,
      // Ensure correct type or undefined
      updated_at: /* @__PURE__ */ new Date()
    }).where(eq(aiChats.id, id)).returning();
    return chat;
  }
  async deleteAiChat(id, deviceId) {
    const chatToDelete = await this.getAiChat(id, deviceId);
    if (!chatToDelete) return false;
    const result = await db.delete(aiChats).where(eq(aiChats.id, id)).returning();
    return result.length > 0;
  }
  // Attachment operations
  async getAttachments(noteId, deviceId) {
    return await db.select({
      id: attachments.id,
      note_id: attachments.note_id,
      device_id: attachments.device_id,
      file_path: attachments.file_path,
      file_type: attachments.file_type,
      file_name: attachments.file_name,
      created_at: attachments.created_at
    }).from(attachments).innerJoin(notes, eq(attachments.note_id, notes.id)).where(and(
      eq(attachments.note_id, noteId),
      eq(notes.device_id, deviceId)
    )).orderBy(desc(attachments.created_at));
  }
  async getAttachment(id, deviceId) {
    const [attachment] = await db.select({
      id: attachments.id,
      note_id: attachments.note_id,
      device_id: attachments.device_id,
      file_path: attachments.file_path,
      file_type: attachments.file_type,
      file_name: attachments.file_name,
      created_at: attachments.created_at
    }).from(attachments).innerJoin(notes, eq(attachments.note_id, notes.id)).where(and(
      eq(attachments.id, id),
      eq(notes.device_id, deviceId)
    ));
    return attachment;
  }
  async createAttachment(insertAttachment) {
    const [attachment] = await db.insert(attachments).values(insertAttachment).returning();
    return attachment;
  }
  async deleteAttachment(id, deviceId) {
    const attachmentToDelete = await this.getAttachment(id, deviceId);
    if (!attachmentToDelete) return false;
    const result = await db.delete(attachments).where(eq(attachments.id, id)).returning();
    return result.length > 0;
  }
};
var storage = new DatabaseStorage();

// server/geminiApi.ts
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });
var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBAl6oys66hGOlifNpm5nSyyiqDgccUVl8";
console.log("API Key status:", GEMINI_API_KEY ? "Found and configured" : "Not found");
var GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
async function generateGeminiResponse(messages) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    const requestBody = {
      contents: messages
    };
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts && data.candidates[0].content.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Unexpected response format from Gemini API");
    }
  } catch (error) {
    console.error("Error generating Gemini response:", error);
    throw error;
  }
}

// server/routes.ts
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import path2 from "path";
import fs from "fs";
var deviceIdMiddleware = (req, res, next) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) {
    return res.status(400).json({ message: "Device ID (x-device-id header) is required" });
  }
  req.deviceId = deviceId;
  next();
};
var upload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      const uploadDir = path2.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path2.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024
    // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed."));
    }
  }
});
async function registerRoutes(app2) {
  app2.use("/uploads", express.static(path2.join(process.cwd(), "uploads")));
  app2.use("/api", deviceIdMiddleware);
  app2.get("/api/notes", async (req, res) => {
    const deviceId = req.deviceId;
    console.log(`[GET /api/notes] Device ID: ${deviceId}`);
    try {
      const notes2 = await storage.getNotes(deviceId);
      res.json(notes2);
    } catch (error) {
      console.error("Failed to retrieve notes:", error);
      res.status(500).json({ message: "Failed to retrieve notes" });
    }
  });
  app2.get("/api/notes/:id", async (req, res) => {
    const deviceId = req.deviceId;
    const noteId = parseInt(req.params.id);
    console.log(`[GET /api/notes/:id] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const note = await storage.getNote(noteId, deviceId);
      if (!note) {
        return res.status(404).json({ message: "Note not found or not authorized for this device" });
      }
      res.json(note);
    } catch (error) {
      console.error("Failed to retrieve note:", error);
      res.status(500).json({ message: "Failed to retrieve note" });
    }
  });
  app2.post("/api/notes", async (req, res) => {
    const deviceId = req.deviceId;
    console.log(`[POST /api/notes] Device ID: ${deviceId}`);
    try {
      const noteData = { ...req.body, device_id: deviceId };
      const result = insertNoteSchema.safeParse(noteData);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const newNote = await storage.createNote(result.data);
      res.status(201).json(newNote);
    } catch (error) {
      console.error("Failed to create note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });
  app2.put("/api/notes/:id", async (req, res) => {
    const deviceId = req.deviceId;
    const noteId = parseInt(req.params.id);
    console.log(`[PUT /api/notes/:id] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const result = updateNoteSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const updatedNote = await storage.updateNote(noteId, deviceId, result.data);
      if (!updatedNote) {
        return res.status(404).json({ message: "Note not found or not authorized for this device" });
      }
      res.json(updatedNote);
    } catch (error) {
      console.error("Failed to update note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });
  app2.delete("/api/notes/:id", async (req, res) => {
    const deviceId = req.deviceId;
    const noteId = parseInt(req.params.id);
    console.log(`[DELETE /api/notes/:id] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const success = await storage.deleteNote(noteId, deviceId);
      if (!success) {
        return res.status(404).json({ message: "Note not found or not authorized for this device" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });
  app2.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      res.json({
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload file" });
    }
  });
  app2.post("/api/notes/:noteId/attachments", upload.single("file"), async (req, res) => {
    const deviceId = req.deviceId;
    const noteId = parseInt(req.params.noteId);
    console.log(`[POST /api/notes/:noteId/attachments] Device ID: ${deviceId}, Note ID: ${noteId}`);
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }
    try {
      if (isNaN(noteId)) return res.status(400).json({ message: "Invalid note ID" });
      const note = await storage.getNote(noteId, deviceId);
      if (!note) return res.status(404).json({ message: "Note not found or not authorized" });
      const attachmentData = {
        note_id: noteId,
        device_id: deviceId,
        file_path: req.file.path,
        // path from multer
        file_type: req.file.mimetype,
        file_name: req.file.originalname
      };
      const result = insertAttachmentSchema.safeParse(attachmentData);
      if (!result.success) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Failed to delete orphaned upload:", err);
        });
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      const newAttachment = await storage.createAttachment(result.data);
      res.status(201).json(newAttachment);
    } catch (error) {
      console.error("Failed to create attachment:", error);
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Failed to delete orphaned upload on error:", err);
        });
      }
      res.status(500).json({ message: "Failed to create attachment" });
    }
  });
  app2.get("/api/notes/:noteId/attachments", async (req, res) => {
    const deviceId = req.deviceId;
    const noteId = parseInt(req.params.noteId);
    console.log(`[GET /api/notes/:noteId/attachments] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) return res.status(400).json({ message: "Invalid note ID" });
      const note = await storage.getNote(noteId, deviceId);
      if (!note) return res.status(404).json({ message: "Note not found or not authorized" });
      const attachmentsResult = await storage.getAttachments(noteId, deviceId);
      res.json(attachmentsResult);
    } catch (error) {
      console.error("Failed to retrieve attachments:", error);
      res.status(500).json({ message: "Failed to retrieve attachments" });
    }
  });
  app2.delete("/api/attachments/:attachmentId", async (req, res) => {
    const deviceId = req.deviceId;
    const attachmentId = parseInt(req.params.attachmentId);
    console.log(`[DELETE /api/attachments/:attachmentId] Device ID: ${deviceId}, Attachment ID: ${attachmentId}`);
    try {
      if (isNaN(attachmentId)) return res.status(400).json({ message: "Invalid attachment ID" });
      const attachmentToDelete = await storage.getAttachment(attachmentId, deviceId);
      if (!attachmentToDelete) {
        return res.status(404).json({ message: "Attachment not found or not authorized" });
      }
      const success = await storage.deleteAttachment(attachmentId, deviceId);
      if (success) {
        fs.unlink(attachmentToDelete.file_path, (err) => {
          if (err) {
            console.error(`Failed to delete attachment file ${attachmentToDelete.file_path}:`, err);
          } else {
            console.log(`Successfully deleted attachment file: ${attachmentToDelete.file_path}`);
          }
        });
        res.status(204).send();
      } else {
        res.status(404).json({ message: "Attachment not found or not authorized, or DB deletion failed" });
      }
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      res.status(500).json({ message: "Failed to delete attachment" });
    }
  });
  app2.get("/api/notes/:noteId/ai-chats", async (req, res) => {
    const deviceId = req.deviceId;
    const noteId = parseInt(req.params.noteId);
    console.log(`[GET /api/notes/:noteId/ai-chats] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const chats = await storage.getAiChats(noteId, deviceId);
      res.json(chats);
    } catch (error) {
      console.error("Failed to retrieve AI chats:", error);
      res.status(500).json({ message: "Failed to retrieve AI chats" });
    }
  });
  app2.post("/api/notes/:noteId/ai-chats", async (req, res) => {
    const deviceId = req.deviceId;
    const noteId = parseInt(req.params.noteId);
    console.log(`[POST /api/notes/:noteId/ai-chats] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const note = await storage.getNote(noteId, deviceId);
      if (!note) {
        return res.status(404).json({ message: "Note not found or not authorized" });
      }
      const result = insertAiChatSchema.safeParse({
        ...req.body,
        note_id: noteId,
        device_id: deviceId
      });
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const chat = await storage.createAiChat(result.data);
      res.status(201).json(chat);
    } catch (error) {
      console.error("Failed to create AI chat:", error);
      res.status(500).json({ message: "Failed to create AI chat" });
    }
  });
  app2.put("/api/ai-chats/:id", async (req, res) => {
    const deviceId = req.deviceId;
    const id = parseInt(req.params.id);
    console.log(`[PUT /api/ai-chats/:id] Device ID: ${deviceId}, Chat ID: ${id}`);
    try {
      if (isNaN(id)) return res.status(400).json({ message: "Invalid chat ID" });
      const result = updateAiChatSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      const updatedChat = await storage.updateAiChat(id, deviceId, result.data);
      if (!updatedChat) return res.status(404).json({ message: "Chat not found or not authorized" });
      res.json(updatedChat);
    } catch (error) {
      console.error("Failed to update AI chat:", error);
      res.status(500).json({ message: "Failed to update AI chat" });
    }
  });
  app2.get("/api/ai-chats/:id", async (req, res) => {
    const deviceId = req.deviceId;
    const id = parseInt(req.params.id);
    console.log(`[GET /api/ai-chats/:id] Device ID: ${deviceId}, Chat ID: ${id}`);
    try {
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid chat ID" });
      }
      const chat = await storage.getAiChat(id, deviceId);
      if (!chat) {
        return res.status(404).json({ message: "AI chat not found or not authorized" });
      }
      res.json(chat);
    } catch (error) {
      console.error("Failed to retrieve AI chat:", error);
      res.status(500).json({ message: "Failed to retrieve AI chat" });
    }
  });
  app2.post("/api/notes/:noteId/ai/generate", async (req, res) => {
    const deviceId = req.deviceId;
    const noteId = parseInt(req.params.noteId);
    const { prompt, history } = req.body;
    console.log(`[POST /api/notes/:noteId/ai/generate] Device ID: ${deviceId}, Note ID: ${noteId}, Prompt: "${prompt}", History items: ${history?.length}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const note = await storage.getNote(noteId, deviceId);
      if (!note) {
        return res.status(404).json({ message: "Note not found or not authorized for this device" });
      }
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }
      const htmlToPlainText = (html) => {
        return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      };
      const plainNoteContent = htmlToPlainText(note.content || "");
      const systemMessage = {
        role: "user",
        // Using 'user' role for system-like instructions with Gemini
        parts: [{
          text: `You are Mina, a helpful AI assistant. Your name is Mina. You are currently assisting within a specific note in a note-taking application.

The content of the current note is provided below for your reference. You can use this context if the user's query seems related to it (e.g., if they ask about "this email", "the text below", or "this note").
However, the user may also ask general questions or questions unrelated to this specific note. In all cases, be helpful and use your broad knowledge to answer as best as you can.

---
CURRENT NOTE CONTEXT:
TITLE: ${note.title || "Untitled"}

CONTENT:
${plainNoteContent}
---
End of Current Note Context.

Your primary goal is to assist the user. If their query is about the note content above, use it. Otherwise, answer their general questions.
You can help review text, check spelling/grammar, provide feedback, summarize, or answer questions.
When referring to yourself, always use the name "Mina". Be concise, friendly, and helpful.`
        }]
      };
      const messagesForGemini = [systemMessage];
      if (history && history.length > 0) {
        history.forEach((clientMsg) => {
          let geminiRole = void 0;
          if (clientMsg.role === "user") {
            geminiRole = "user";
          } else if (clientMsg.role === "assistant") {
            geminiRole = "model";
          }
          if (geminiRole) {
            messagesForGemini.push({
              role: geminiRole,
              parts: [{ text: clientMsg.content }]
            });
          }
        });
      }
      messagesForGemini.push({ role: "user", parts: [{ text: prompt }] });
      console.log("Sending to Gemini:", JSON.stringify({ contents: messagesForGemini.map((m) => ({ role: m.role, text: m.parts[0].text.substring(0, 50) + (m.parts[0].text.length > 50 ? "..." : "") })) }, null, 2));
      const aiResponse = await generateGeminiResponse(messagesForGemini);
      res.json({ response: aiResponse });
    } catch (error) {
      console.error("AI response generation error:", error);
      res.status(500).json({ message: error.message || "Failed to generate AI response" });
    }
  });
  app2.post("/api/ai/dashboard-chat", async (req, res) => {
    try {
      const { messages, notes: notes2 } = req.body;
      const deviceId = req.deviceId;
      if (!Array.isArray(messages) || !Array.isArray(notes2)) {
        return res.status(400).json({ message: "Invalid request format: messages and notes must be arrays" });
      }
      const deviceNotes = await storage.getNotes(deviceId);
      const deviceNoteIds = new Set(deviceNotes.map((note) => note.id));
      const validNotes = notes2.filter((note) => deviceNoteIds.has(note.id));
      const htmlToPlainText = (html) => {
        return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      };
      let notesContext = "DEVICE'S NOTES CONTEXT:\n\n";
      validNotes.forEach((note, i) => {
        const plainContent = htmlToPlainText(note.content || "");
        notesContext += `Note #${i + 1} [ID: ${note.id}]
`;
        notesContext += `Title: ${note.title || "Untitled"}
`;
        notesContext += `Created: ${new Date(note.created_at).toISOString()}
`;
        notesContext += `Updated: ${new Date(note.updated_at).toISOString()}
`;
        notesContext += `Content: ${plainContent.substring(0, 1e3)}${plainContent.length > 1e3 ? "..." : ""}

`;
      });
      const systemMessage = {
        role: "system",
        content: `You are Mina, your helpful AI assistant. Your name is Mina. 
Your job is to help users find and retrieve information from their notes, or answer questions based on the provided note context.
When users ask about their notes, search through the provided context to find relevant information.

IMPORTANT: When you identify specific notes in your response, YOU MUST include their reference using the exact format "[ID: note_id_here]" immediately after mentioning the note. For example, if you find a note with ID 42, you might say "I found a relevant note [ID: 42] titled 'Shopping List'."

Always provide note references with ID, title, and date when answering questions about notes, if applicable based on the query, and ensure the [ID: id] tag is present.
If a user asks about a specific topic, search for those keywords in the notes.
If asked to locate a specific note, scan the provided notes context and return IDs of the most relevant matches, again, ensuring each is tagged with [ID: id].
Format your note references with note ID and brief excerpt from the content if you are providing specific note details.
Do not fabricate notes or content that isn't actually present in the context.
${notesContext}`
      };
      const conversationMessages = messages.filter((msg) => msg.role !== "system");
      const geminiMessages = [
        {
          role: "user",
          parts: [{ text: systemMessage.content }]
        },
        ...conversationMessages.map((msg) => ({
          role: msg.role === "assistant" ? "model" : msg.role === "system" ? "user" : msg.role,
          parts: [{ text: msg.content }]
        }))
      ];
      const responseText = await generateGeminiResponse(geminiMessages);
      const referencedNotes = [];
      const noteIdRegex = /\[ID: (\d+)\]/g;
      let match;
      const foundIds = [];
      while ((match = noteIdRegex.exec(responseText)) !== null) {
        foundIds.push(parseInt(match[1]));
      }
      const uniqueIds = Array.from(new Set(foundIds));
      for (let i = 0; i < uniqueIds.length; i++) {
        const id = uniqueIds[i];
        const matchingNote = validNotes.find((note) => note.id === id);
        if (matchingNote) {
          const plainContent = htmlToPlainText(matchingNote.content || "");
          const excerpt = plainContent.substring(0, 120) + (plainContent.length > 120 ? "..." : "");
          referencedNotes.push({
            id: matchingNote.id,
            title: matchingNote.title || "Untitled",
            createdAt: matchingNote.created_at,
            excerpt,
            confidence: 1
            // We could implement a more sophisticated confidence scoring
          });
        }
      }
      let cleanedResponse = responseText;
      cleanedResponse = cleanedResponse.replace(/\[ID: \d+\]/g, "");
      res.json({
        message: {
          role: "assistant",
          content: cleanedResponse
        },
        referencedNotes
      });
    } catch (error) {
      console.error("Error in dashboard AI chat endpoint:", error);
      res.status(500).json({
        message: "Failed to get AI response",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app2.use((err, req, res, next) => {
    console.error("Global error handler caught:", err);
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Multer error: ${err.message}` });
    } else if (err) {
      if (err.message && err.message.startsWith("Invalid file type")) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
    if (!res.headersSent) {
      res.status(404).json({ message: "Resource not found or error in routing." });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs2 from "fs";
import path4 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path3 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false
      }
    }
  },
  resolve: {
    alias: {
      "@": path3.resolve(import.meta.dirname, "client", "src"),
      "@shared": path3.resolve(import.meta.dirname, "shared"),
      "@assets": path3.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path3.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path3.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path4.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path4.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path4.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express3();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path5 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path5.startsWith("/api")) {
      let logLine = `${req.method} ${path5} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
