import { 
  users, type User, type InsertUser,
  notes, type Note, type InsertNote, type UpdateNote,
  aiChats, type AiChat, type InsertAiChat, type UpdateAiChat,
  attachments, type Attachment, type InsertAttachment
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import session from "express-session";
import MemoryStoreFactory from "memorystore";

const MemoryStore = MemoryStoreFactory(session);

// Keep the same interface but expand with new operations
export interface IStorage {
  // Session store
  sessionStore: session.Store;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Note operations
  getNotes(userId: number): Promise<Note[]>;
  getNote(id: number, userId: number): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, userId: number, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: number, userId: number): Promise<boolean>;

  // AI Chat operations
  getAiChats(noteId: number, userId: number): Promise<AiChat[]>;
  getAiChat(id: number, userId: number): Promise<AiChat | undefined>;
  createAiChat(chat: InsertAiChat): Promise<AiChat>;
  updateAiChat(id: number, userId: number, chat: UpdateAiChat): Promise<AiChat | undefined>;

  // Attachment operations
  getAttachments(noteId: number, userId: number): Promise<Attachment[]>;
  getAttachment(id: number, userId: number): Promise<Attachment | undefined>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number, userId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Note operations
  async getNotes(userId: number): Promise<Note[]> {
    return await db.select()
      .from(notes)
      .where(and(
        eq(notes.is_deleted, false),
        eq(notes.user_id, userId)
      ))
      .orderBy(desc(notes.updated_at));
  }

  async getNote(id: number, userId: number): Promise<Note | undefined> {
    const [note] = await db.select()
      .from(notes)
      .where(and(
        eq(notes.id, id),
        eq(notes.is_deleted, false),
        eq(notes.user_id, userId)
      ));
    return note;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes)
      .values({
        title: insertNote.title,
        content: insertNote.content,
        user_id: insertNote.user_id,
        is_pinned: insertNote.is_pinned,
        tags: insertNote.tags as string[] | null,
        color: insertNote.color,
        is_deleted: false
      })
      .returning();
    return note;
  }

  async updateNote(id: number, userId: number, updateData: UpdateNote): Promise<Note | undefined> {
    const now = new Date();
    const dataToSet: Partial<typeof notes.$inferInsert> = {
      updated_at: now,
    };
    if (updateData.title !== undefined) dataToSet.title = updateData.title;
    if (updateData.content !== undefined) dataToSet.content = updateData.content;
    if (updateData.is_pinned !== undefined) dataToSet.is_pinned = updateData.is_pinned;
    if (updateData.tags !== undefined) dataToSet.tags = updateData.tags as string[] | null;
    if (updateData.color !== undefined) dataToSet.color = updateData.color;

    const [updatedNote] = await db.update(notes)
      .set(dataToSet)
      .where(and(
        eq(notes.id, id),
        eq(notes.user_id, userId),
        eq(notes.is_deleted, false)
      ))
      .returning();
    
    return updatedNote;
  }

  async deleteNote(id: number, userId: number): Promise<boolean> {
    const now = new Date();
    const [deletedNote] = await db.update(notes)
      .set({
        is_deleted: true,
        updated_at: now
      })
      .where(and(
        eq(notes.id, id),
        eq(notes.user_id, userId)
      ))
      .returning();
    
    return !!deletedNote;
  }

  // AI Chat operations
  async getAiChats(noteId: number, userId: number): Promise<AiChat[]> {
    const note = await this.getNote(noteId, userId);
    if (!note) return [];

    return await db.select()
      .from(aiChats)
      .where(eq(aiChats.note_id, noteId))
      .orderBy(desc(aiChats.updated_at));
  }

  async getAiChat(id: number, userId: number): Promise<AiChat | undefined> {
    const [chat] = await db.select()
      .from(aiChats)
      .leftJoin(notes, eq(aiChats.note_id, notes.id))
      .where(and(
        eq(aiChats.id, id),
        eq(notes.user_id, userId)
      ))
      .limit(1);
    return chat ? chat.ai_chats : undefined;
  }

  async createAiChat(chat: InsertAiChat): Promise<AiChat> {
    const [newChat] = await db.insert(aiChats)
      .values({
        note_id: chat.note_id,
        messages: chat.messages as {role: string, content: string}[],
      })
      .returning();
    return newChat;
  }

  async updateAiChat(id: number, userId: number, chatUpdate: UpdateAiChat): Promise<AiChat | undefined> {
    const existingChat = await this.getAiChat(id, userId);
    if (!existingChat) {
      return undefined;
    }

    const now = new Date();
    const dataToSet: Partial<typeof aiChats.$inferInsert> = {
      updated_at: now,
    };
    if (chatUpdate.messages !== undefined) dataToSet.messages = chatUpdate.messages as {role: string, content: string}[];

    const [updatedChatResult] = await db.update(aiChats)
      .set(dataToSet)
      .where(eq(aiChats.id, id))
      .returning();
    
    return updatedChatResult;
  }

  // Attachment operations
  async getAttachments(noteId: number, userId: number): Promise<Attachment[]> {
    const note = await this.getNote(noteId, userId);
    if (!note) return [];

    return await db.select()
      .from(attachments)
      .where(eq(attachments.note_id, noteId));
  }

  async getAttachment(id: number, userId: number): Promise<Attachment | undefined> {
    const [attachmentData] = await db.select()
      .from(attachments)
      .leftJoin(notes, eq(attachments.note_id, notes.id))
      .where(and(
        eq(attachments.id, id),
        eq(notes.user_id, userId)
      ))
      .limit(1);
    return attachmentData ? attachmentData.attachments : undefined;
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await db.insert(attachments)
      .values(attachment)
      .returning();
    return newAttachment;
  }

  async deleteAttachment(id: number, userId: number): Promise<boolean> {
    const attachment = await this.getAttachment(id, userId);
    if (!attachment) {
      return false;
    }
    const [deletedAttachment] = await db.delete(attachments)
      .where(eq(attachments.id, id))
      .returning();
    return !!deletedAttachment;
  }
}

export const storage = new DatabaseStorage();
