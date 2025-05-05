import { 
  users, type User, type InsertUser,
  notes, type Note, type InsertNote, type UpdateNote,
  aiChats, type AiChat, type InsertAiChat, type UpdateAiChat,
  attachments, type Attachment, type InsertAttachment
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { pool } from "./db";

// Keep the same interface but expand with new operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByFirebaseId(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Note operations
  getNotes(): Promise<Note[]>;
  getNotesByUserId(userId: number): Promise<Note[]>;
  getNote(id: number): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;

  // AI Chat operations
  getAiChats(noteId: number): Promise<AiChat[]>;
  getAiChat(id: number): Promise<AiChat | undefined>;
  createAiChat(chat: InsertAiChat): Promise<AiChat>;
  updateAiChat(id: number, chat: UpdateAiChat): Promise<AiChat | undefined>;

  // Attachment operations
  getAttachments(noteId: number): Promise<Attachment[]>;
  getAttachment(id: number): Promise<Attachment | undefined>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByFirebaseId(firebaseUid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebase_uid, firebaseUid));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Note operations
  async getNotes(): Promise<Note[]> {
    return await db.select()
      .from(notes)
      .where(eq(notes.is_deleted, false))
      .orderBy(desc(notes.updated_at));
  }
  
  async getNotesByUserId(userId: number): Promise<Note[]> {
    return await db.select()
      .from(notes)
      .where(and(
        eq(notes.user_id, userId),
        eq(notes.is_deleted, false)
      ))
      .orderBy(desc(notes.updated_at));
  }

  async getNote(id: number): Promise<Note | undefined> {
    const [note] = await db.select()
      .from(notes)
      .where(and(
        eq(notes.id, id),
        eq(notes.is_deleted, false)
      ));
    return note;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes)
      .values({
        ...insertNote,
        is_deleted: false
      })
      .returning();
    return note;
  }

  async updateNote(id: number, updateNote: UpdateNote): Promise<Note | undefined> {
    const now = new Date();
    const [updatedNote] = await db.update(notes)
      .set({
        ...updateNote,
        updated_at: now
      })
      .where(and(
        eq(notes.id, id),
        eq(notes.is_deleted, false)
      ))
      .returning();
    
    return updatedNote;
  }

  async deleteNote(id: number): Promise<boolean> {
    const now = new Date();
    const [deletedNote] = await db.update(notes)
      .set({
        is_deleted: true,
        updated_at: now
      })
      .where(eq(notes.id, id))
      .returning();
    
    return !!deletedNote;
  }

  // AI Chat operations
  async getAiChats(noteId: number): Promise<AiChat[]> {
    return await db.select()
      .from(aiChats)
      .where(eq(aiChats.note_id, noteId))
      .orderBy(desc(aiChats.updated_at));
  }

  async getAiChat(id: number): Promise<AiChat | undefined> {
    const [chat] = await db.select()
      .from(aiChats)
      .where(eq(aiChats.id, id));
    return chat;
  }

  async createAiChat(chat: InsertAiChat): Promise<AiChat> {
    // Use direct PostgreSQL client for JSON handling
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO ai_chats (note_id, messages) VALUES ($1, $2) RETURNING *',
        [chat.note_id, JSON.stringify(chat.messages)]
      );
      return result.rows[0] as AiChat;
    } finally {
      client.release();
    }
  }

  async updateAiChat(id: number, chat: UpdateAiChat): Promise<AiChat | undefined> {
    // Use direct PostgreSQL client for JSON handling
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE ai_chats SET messages = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [JSON.stringify(chat.messages), id]
      );
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      return result.rows[0] as AiChat;
    } finally {
      client.release();
    }
  }

  // Attachment operations
  async getAttachments(noteId: number): Promise<Attachment[]> {
    return await db.select()
      .from(attachments)
      .where(eq(attachments.note_id, noteId));
  }

  async getAttachment(id: number): Promise<Attachment | undefined> {
    const [attachment] = await db.select()
      .from(attachments)
      .where(eq(attachments.id, id));
    return attachment;
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await db.insert(attachments)
      .values(attachment)
      .returning();
    return newAttachment;
  }

  async deleteAttachment(id: number): Promise<boolean> {
    const [deletedAttachment] = await db.delete(attachments)
      .where(eq(attachments.id, id))
      .returning();
    
    return !!deletedAttachment;
  }
}

export const storage = new DatabaseStorage();
