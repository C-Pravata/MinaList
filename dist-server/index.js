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
  insertUserSchema: () => insertUserSchema,
  noteRelations: () => noteRelations,
  notes: () => notes,
  updateAiChatSchema: () => updateAiChatSchema,
  updateNoteSchema: () => updateNoteSchema,
  userRelations: () => userRelations,
  users: () => users
});
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  avatar_url: text("avatar_url"),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull()
});
var notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  is_pinned: integer("is_pinned", { mode: "boolean" }).default(false),
  tags: text("tags", { mode: "json" }).$type(),
  // Storing array as JSON string
  color: text("color").default("#ffffff"),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Made non-nullable and added foreign key
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  is_deleted: integer("is_deleted", { mode: "boolean" }).default(false).notNull()
});
var aiChats = sqliteTable("ai_chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note_id: integer("note_id").notNull(),
  // Assuming this relates to notes.id
  messages: text("messages", { mode: "json" }).notNull().$type(),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull()
});
var attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  note_id: integer("note_id").notNull(),
  // Assuming this relates to notes.id
  file_path: text("file_path").notNull(),
  file_type: text("file_type").notNull(),
  file_name: text("file_name").notNull(),
  created_at: integer("created_at", { mode: "timestamp_ms" }).default(sql`(strftime('%s', 'now') * 1000)`).notNull()
});
var userRelations = relations(users, ({ many }) => ({
  notes: many(notes)
}));
var noteRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.user_id],
    references: [users.id]
  }),
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
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  avatar_url: true
});
var insertNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  is_pinned: true,
  tags: true,
  color: true,
  user_id: true
});
var updateNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  is_pinned: true,
  tags: true,
  color: true
});
var insertAiChatSchema = createInsertSchema(aiChats).pick({
  note_id: true,
  messages: true
});
var updateAiChatSchema = createInsertSchema(aiChats).pick({
  messages: true
});
var insertAttachmentSchema = createInsertSchema(attachments).pick({
  note_id: true,
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
import session from "express-session";
import MemoryStoreFactory from "memorystore";
var MemoryStore = MemoryStoreFactory(session);
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 864e5
      // prune expired entries every 24h
    });
  }
  // User operations
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  // Note operations
  async getNotes(userId) {
    return await db.select().from(notes).where(and(
      eq(notes.is_deleted, false),
      eq(notes.user_id, userId)
    )).orderBy(desc(notes.updated_at));
  }
  async getNote(id, userId) {
    const [note] = await db.select().from(notes).where(and(
      eq(notes.id, id),
      eq(notes.is_deleted, false),
      eq(notes.user_id, userId)
    ));
    return note;
  }
  async createNote(insertNote) {
    const [note] = await db.insert(notes).values({
      title: insertNote.title,
      content: insertNote.content,
      user_id: insertNote.user_id,
      is_pinned: insertNote.is_pinned,
      tags: insertNote.tags,
      color: insertNote.color,
      is_deleted: false
    }).returning();
    return note;
  }
  async updateNote(id, userId, updateData) {
    const now = /* @__PURE__ */ new Date();
    const dataToSet = {
      updated_at: now
    };
    if (updateData.title !== void 0) dataToSet.title = updateData.title;
    if (updateData.content !== void 0) dataToSet.content = updateData.content;
    if (updateData.is_pinned !== void 0) dataToSet.is_pinned = updateData.is_pinned;
    if (updateData.tags !== void 0) dataToSet.tags = updateData.tags;
    if (updateData.color !== void 0) dataToSet.color = updateData.color;
    const [updatedNote] = await db.update(notes).set(dataToSet).where(and(
      eq(notes.id, id),
      eq(notes.user_id, userId),
      eq(notes.is_deleted, false)
    )).returning();
    return updatedNote;
  }
  async deleteNote(id, userId) {
    const now = /* @__PURE__ */ new Date();
    const [deletedNote] = await db.update(notes).set({
      is_deleted: true,
      updated_at: now
    }).where(and(
      eq(notes.id, id),
      eq(notes.user_id, userId)
    )).returning();
    return !!deletedNote;
  }
  // AI Chat operations
  async getAiChats(noteId, userId) {
    const note = await this.getNote(noteId, userId);
    if (!note) return [];
    return await db.select().from(aiChats).where(eq(aiChats.note_id, noteId)).orderBy(desc(aiChats.updated_at));
  }
  async getAiChat(id, userId) {
    const [chat] = await db.select().from(aiChats).leftJoin(notes, eq(aiChats.note_id, notes.id)).where(and(
      eq(aiChats.id, id),
      eq(notes.user_id, userId)
    )).limit(1);
    return chat ? chat.ai_chats : void 0;
  }
  async createAiChat(chat) {
    const [newChat] = await db.insert(aiChats).values({
      note_id: chat.note_id,
      messages: chat.messages
    }).returning();
    return newChat;
  }
  async updateAiChat(id, userId, chatUpdate) {
    const existingChat = await this.getAiChat(id, userId);
    if (!existingChat) {
      return void 0;
    }
    const now = /* @__PURE__ */ new Date();
    const dataToSet = {
      updated_at: now
    };
    if (chatUpdate.messages !== void 0) dataToSet.messages = chatUpdate.messages;
    const [updatedChatResult] = await db.update(aiChats).set(dataToSet).where(eq(aiChats.id, id)).returning();
    return updatedChatResult;
  }
  // Attachment operations
  async getAttachments(noteId, userId) {
    const note = await this.getNote(noteId, userId);
    if (!note) return [];
    return await db.select().from(attachments).where(eq(attachments.note_id, noteId));
  }
  async getAttachment(id, userId) {
    const [attachmentData] = await db.select().from(attachments).leftJoin(notes, eq(attachments.note_id, notes.id)).where(and(
      eq(attachments.id, id),
      eq(notes.user_id, userId)
    )).limit(1);
    return attachmentData ? attachmentData.attachments : void 0;
  }
  async createAttachment(attachment) {
    const [newAttachment] = await db.insert(attachments).values(attachment).returning();
    return newAttachment;
  }
  async deleteAttachment(id, userId) {
    const attachment = await this.getAttachment(id, userId);
    if (!attachment) {
      return false;
    }
    const [deletedAttachment] = await db.delete(attachments).where(eq(attachments.id, id)).returning();
    return !!deletedAttachment;
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { fromZodError } from "zod-validation-error";
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "mina-notetaking-app-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1e3
      // 30 days
    }
  };
  app2.set("trust proxy", 1);
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !await comparePasswords(password, user.password)) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const hashedPassword = await hashPassword(req.body.password);
      const userData = {
        ...result.data,
        password: hashedPassword
      };
      const user = await storage.createUser(userData);
      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "An error occurred during registration" });
    }
  });
  app2.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.login(user, (err2) => {
        if (err2) return next(err2);
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
}

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
import { fromZodError as fromZodError2 } from "zod-validation-error";
import multer from "multer";
import path2 from "path";
import fs from "fs";
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
var isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user && typeof req.user.id === "number") {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized. Please log in." });
};
async function registerRoutes(app2) {
  setupAuth(app2);
  app2.use("/uploads", express.static(path2.join(process.cwd(), "uploads")));
  app2.get("/api/notes", isAuthenticated, async (req, res) => {
    const userId = req.user?.id;
    console.log(`[GET /api/notes] Authenticated User ID: ${userId}`);
    try {
      const notes2 = await storage.getNotes(userId);
      res.json(notes2);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve notes" });
    }
  });
  app2.get("/api/notes/:id", isAuthenticated, async (req, res) => {
    const userId = req.user?.id;
    const noteId = parseInt(req.params.id);
    console.log(`[GET /api/notes/:id] Authenticated User ID: ${userId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const note = await storage.getNote(noteId, userId);
      if (!note) {
        return res.status(404).json({ message: "Note not found or not authorized" });
      }
      res.json(note);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve note" });
    }
  });
  app2.post("/api/notes", isAuthenticated, async (req, res) => {
    const userId = req.user?.id;
    console.log(`[POST /api/notes] Authenticated User ID: ${userId}`);
    try {
      const noteData = { ...req.body, user_id: userId };
      delete noteData.id;
      const result = insertNoteSchema.safeParse(noteData);
      if (!result.success) {
        const validationError = fromZodError2(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const newNote = await storage.createNote(result.data);
      res.status(201).json(newNote);
    } catch (error) {
      res.status(500).json({ message: "Failed to create note" });
    }
  });
  app2.put("/api/notes/:id", isAuthenticated, async (req, res) => {
    const userId = req.user?.id;
    const noteId = parseInt(req.params.id);
    console.log(`[PUT /api/notes/:id] Authenticated User ID: ${userId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const result = updateNoteSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError2(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const updatedNote = await storage.updateNote(noteId, userId, result.data);
      if (!updatedNote) {
        return res.status(404).json({ message: "Note not found or not authorized" });
      }
      res.json(updatedNote);
    } catch (error) {
      res.status(500).json({ message: "Failed to update note" });
    }
  });
  app2.delete("/api/notes/:id", isAuthenticated, async (req, res) => {
    const userId = req.user?.id;
    const noteId = parseInt(req.params.id);
    console.log(`[DELETE /api/notes/:id] Authenticated User ID: ${userId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const success = await storage.deleteNote(noteId, userId);
      if (!success) {
        return res.status(404).json({ message: "Note not found or not authorized" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });
  app2.post("/api/upload", isAuthenticated, upload.single("image"), (req, res) => {
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
  app2.post("/api/notes/:noteId/attachments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const note = await storage.getNote(noteId, userId);
      if (!note) {
        return res.status(404).json({ message: "Note not found or not authorized" });
      }
      const result = insertAttachmentSchema.safeParse({
        ...req.body,
        note_id: noteId
      });
      if (!result.success) {
        const validationError = fromZodError2(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const attachment = await storage.createAttachment(result.data);
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create attachment" });
    }
  });
  app2.get("/api/notes/:noteId/attachments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const attachments2 = await storage.getAttachments(noteId, userId);
      res.json(attachments2);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve attachments" });
    }
  });
  app2.delete("/api/attachments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid attachment ID" });
      }
      const success = await storage.deleteAttachment(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Attachment not found or not authorized" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete attachment" });
    }
  });
  app2.get("/api/notes/:noteId/ai-chats", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const chats = await storage.getAiChats(noteId, userId);
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve AI chats" });
    }
  });
  app2.post("/api/notes/:noteId/ai-chats", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      const note = await storage.getNote(noteId, userId);
      if (!note) {
        return res.status(404).json({ message: "Note not found or not authorized" });
      }
      const result = insertAiChatSchema.safeParse({
        ...req.body,
        note_id: noteId
      });
      if (!result.success) {
        const validationError = fromZodError2(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const chat = await storage.createAiChat(result.data);
      res.status(201).json(chat);
    } catch (error) {
      res.status(500).json({ message: "Failed to create AI chat" });
    }
  });
  app2.put("/api/ai-chats/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid chat ID" });
      }
      const result = updateAiChatSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError2(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const updatedChat = await storage.updateAiChat(id, userId, result.data);
      if (!updatedChat) {
        return res.status(404).json({ message: "AI chat not found or not authorized" });
      }
      res.json(updatedChat);
    } catch (error) {
      res.status(500).json({ message: "Failed to update AI chat" });
    }
  });
  app2.get("/api/ai-chats/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid chat ID" });
      }
      const chat = await storage.getAiChat(id, userId);
      if (!chat) {
        return res.status(404).json({ message: "AI chat not found or not authorized" });
      }
      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve AI chat" });
    }
  });
  app2.post("/api/ai/chat", isAuthenticated, async (req, res) => {
    try {
      const { messages } = req.body;
      if (!Array.isArray(messages)) {
        return res.status(400).json({ message: "Invalid request format: messages must be an array" });
      }
      const geminiMessages = messages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : msg.role === "system" ? "user" : msg.role,
        parts: [{ text: msg.content }]
      }));
      const responseText = await generateGeminiResponse(geminiMessages);
      res.json({
        message: {
          role: "assistant",
          content: responseText
        }
      });
    } catch (error) {
      console.error("Error in AI chat endpoint:", error);
      res.status(500).json({
        message: "Failed to get AI response",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app2.post("/api/ai/dashboard-chat", isAuthenticated, async (req, res) => {
    try {
      const { messages, notes: notes2 } = req.body;
      const userId = req.user?.id;
      if (!Array.isArray(messages) || !Array.isArray(notes2)) {
        return res.status(400).json({ message: "Invalid request format: messages and notes must be arrays" });
      }
      const userNotes = await storage.getNotes(userId);
      const userNoteIds = new Set(userNotes.map((note) => note.id));
      const validNotes = notes2.filter((note) => userNoteIds.has(note.id));
      const htmlToPlainText = (html) => {
        return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      };
      let notesContext = "USER'S NOTES CONTEXT:\n\n";
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
        content: `You are Mina, a helpful AI assistant for a note-taking app called PurpleNotes. 
Your job is to help users find and retrieve information from their notes.
When users ask about their notes, search through the provided context to find relevant information.
Always provide note references with ID, title, and date when answering questions about notes.
If a user asks about a specific topic (like "chicken soup recipes"), search for those keywords in the notes.
If asked to locate a specific note, scan the provided notes context and return IDs of the most relevant matches.
Format your note references with note ID and brief excerpt from the content.
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
