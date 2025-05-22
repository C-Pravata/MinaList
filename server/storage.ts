import { 
  notes, type Note, type InsertNote, type UpdateNote,
  aiChats, type AiChat, type InsertAiChat, type UpdateAiChat,
  attachments, type Attachment, type InsertAttachment
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// Keep the same interface but expand with new operations
export interface IStorage {
  // Note operations
  getNotes(deviceId: string): Promise<Note[]>;
  getNote(id: number, deviceId: string): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>; // InsertNote now expects device_id
  updateNote(id: number, deviceId: string, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: number, deviceId: string): Promise<boolean>;

  // AI Chat operations
  getAiChats(noteId: number, deviceId: string): Promise<AiChat[]>;
  getAiChat(id: number, deviceId: string): Promise<AiChat | undefined>;
  createAiChat(chat: InsertAiChat): Promise<AiChat>; // InsertAiChat expects device_id
  updateAiChat(id: number, deviceId: string, chat: UpdateAiChat): Promise<AiChat | undefined>;
  deleteAiChat(id: number, deviceId: string): Promise<boolean>; // Added deleteAiChat for completeness

  // Attachment operations
  getAttachments(noteId: number, deviceId: string): Promise<Attachment[]>;
  getAttachment(id: number, deviceId: string): Promise<Attachment | undefined>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>; // InsertAttachment expects device_id
  deleteAttachment(id: number, deviceId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Note operations
  async getNotes(deviceId: string): Promise<Note[]> {
    return await db.select()
      .from(notes)
      .where(and(
        eq(notes.is_deleted, false),
        eq(notes.device_id, deviceId)
      ))
      .orderBy(desc(notes.updated_at));
  }

  async getNote(id: number, deviceId: string): Promise<Note | undefined> {
    const [note] = await db.select()
      .from(notes)
      .where(and(
        eq(notes.id, id),
        eq(notes.device_id, deviceId),
        eq(notes.is_deleted, false)
      ));
    return note;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes)
      .values({
        title: insertNote.title,
        content: insertNote.content,
        device_id: insertNote.device_id,
        is_pinned: insertNote.is_pinned,
        tags: insertNote.tags as string[] | undefined, // Ensure correct type or undefined
        color: insertNote.color,
        is_deleted: false
      })
      .returning();
    return note;
  }

  async updateNote(id: number, deviceId: string, noteUpdates: UpdateNote): Promise<Note | undefined> {
    const [note] = await db.update(notes)
      .set({
        title: noteUpdates.title,
        content: noteUpdates.content,
        is_pinned: noteUpdates.is_pinned,
        tags: noteUpdates.tags as string[] | undefined, // Ensure correct type or undefined
        color: noteUpdates.color,
        updated_at: new Date(), 
      })
      .where(and(
        eq(notes.id, id),
        eq(notes.device_id, deviceId),
        eq(notes.is_deleted, false)
      ))
      .returning();
    return note;
  }

  async deleteNote(id: number, deviceId: string): Promise<boolean> {
    const result = await db.update(notes)
      .set({ is_deleted: true, updated_at: new Date() })
      .where(and(
        eq(notes.id, id),
        eq(notes.device_id, deviceId)
      ))
      .returning();
    return result.length > 0;
  }

  // AI Chat operations
  async getAiChats(noteId: number, deviceId: string): Promise<AiChat[]> {
    return await db.select({ 
        id: aiChats.id, 
        note_id: aiChats.note_id, 
        device_id: aiChats.device_id, 
        messages: aiChats.messages, 
        created_at: aiChats.created_at, 
        updated_at: aiChats.updated_at 
      })
      .from(aiChats)
      .innerJoin(notes, eq(aiChats.note_id, notes.id))
      .where(and(
        eq(aiChats.note_id, noteId),
        eq(notes.device_id, deviceId) 
      ))
      .orderBy(desc(aiChats.created_at));
  }

  async getAiChat(id: number, deviceId: string): Promise<AiChat | undefined> {
    const [chat] = await db.select({ 
        id: aiChats.id, 
        note_id: aiChats.note_id, 
        device_id: aiChats.device_id, 
        messages: aiChats.messages, 
        created_at: aiChats.created_at, 
        updated_at: aiChats.updated_at 
      })
      .from(aiChats)
      .innerJoin(notes, eq(aiChats.note_id, notes.id))
      .where(and(
        eq(aiChats.id, id),
        eq(notes.device_id, deviceId) 
      ));
    return chat;
  }

  async createAiChat(insertChat: InsertAiChat): Promise<AiChat> {
    const [chat] = await db.insert(aiChats)
      .values({
        note_id: insertChat.note_id,
        device_id: insertChat.device_id,
        messages: insertChat.messages as {role: string, content: string}[], // Ensure correct type
      })
      .returning();
    return chat;
  }

  async updateAiChat(id: number, deviceId: string, chatUpdates: UpdateAiChat): Promise<AiChat | undefined> {
    const chatToUpdate = await this.getAiChat(id, deviceId); 
    if (!chatToUpdate) return undefined;

    const [chat] = await db.update(aiChats)
      .set({ 
        messages: chatUpdates.messages as {role: string, content: string}[] | undefined, // Ensure correct type or undefined
        updated_at: new Date() 
      })
      .where(eq(aiChats.id, id))
      .returning();
    return chat;
  }

  async deleteAiChat(id: number, deviceId: string): Promise<boolean> {
    const chatToDelete = await this.getAiChat(id, deviceId);
    if (!chatToDelete) return false;

    const result = await db.delete(aiChats)
      .where(eq(aiChats.id, id))
      .returning();
    return result.length > 0;
  }

  // Attachment operations
  async getAttachments(noteId: number, deviceId: string): Promise<Attachment[]> {
    return await db.select({ 
        id: attachments.id, 
        note_id: attachments.note_id, 
        device_id: attachments.device_id, 
        file_path: attachments.file_path, 
        file_type: attachments.file_type, 
        file_name: attachments.file_name, 
        created_at: attachments.created_at 
      })
      .from(attachments)
      .innerJoin(notes, eq(attachments.note_id, notes.id))
      .where(and(
        eq(attachments.note_id, noteId),
        eq(notes.device_id, deviceId) 
      ))
      .orderBy(desc(attachments.created_at));
  }

  async getAttachment(id: number, deviceId: string): Promise<Attachment | undefined> {
    const [attachment] = await db.select({ 
        id: attachments.id, 
        note_id: attachments.note_id, 
        device_id: attachments.device_id, 
        file_path: attachments.file_path, 
        file_type: attachments.file_type, 
        file_name: attachments.file_name, 
        created_at: attachments.created_at 
      })
      .from(attachments)
      .innerJoin(notes, eq(attachments.note_id, notes.id))
      .where(and(
        eq(attachments.id, id),
        eq(notes.device_id, deviceId) 
      ));
    return attachment;
  }

  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const [attachment] = await db.insert(attachments)
      .values(insertAttachment) 
      .returning();
    return attachment;
  }

  async deleteAttachment(id: number, deviceId: string): Promise<boolean> {
    const attachmentToDelete = await this.getAttachment(id, deviceId);
    if (!attachmentToDelete) return false;
    
    // Consider deleting the file from disk here if needed
    // import fs from 'fs/promises';
    // try { await fs.unlink(attachmentToDelete.file_path); } catch (err) { console.error('Failed to delete attachment file:', err); }

    const result = await db.delete(attachments)
      .where(eq(attachments.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
