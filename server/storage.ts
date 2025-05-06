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
  // Demo user for testing
  private demoUser: User = {
    id: 999,
    username: 'demo',
    // This is "password123" - DO NOT use in production
    password: '$2b$10$12tYfLlxdt.6.C4CyD9NuuKtqU0QBHGAHHcQxEPOWAeEG7G1SRk16', 
    email: 'demo@example.com',
    firebase_uid: null,
    avatar_url: null,
    created_at: new Date(),
    updated_at: new Date()
  };

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    // Return demo user for testing
    if (id === 999) {
      return this.demoUser;
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Return demo user for testing
    if (username === 'demo') {
      return this.demoUser;
    }
    
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByFirebaseId(firebaseUid: string): Promise<User | undefined> {
    // Special handling for demo user
    if (firebaseUid.startsWith('demo-')) {
      console.log('Demo user detected with UID:', firebaseUid);
      return this.demoUser;
    }
    
    const [user] = await db.select().from(users).where(eq(users.firebase_uid, firebaseUid));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Demo notes
  private demoNotes: Note[] = [
    {
      id: 1001,
      user_id: 999, // Demo user ID
      title: 'Welcome to Mina Notes!',
      content: '<h1>Welcome to Mina Notes!</h1><p>This is a demo note to get you started. Try:</p><ul><li>Creating a new note</li><li>Editing this note</li><li>Using the AI assistant</li><li>Adding attachments</li></ul><p>Enjoy your note-taking experience!</p>',
      is_deleted: false,
      is_pinned: true,
      tags: ['welcome', 'demo'],
      color: '#FFE0B2',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 1002,
      user_id: 999, // Demo user ID
      title: 'AI Assistant Guide',
      content: '<h2>Using the AI Assistant</h2><p>Mina comes with a built-in AI assistant that can help you with various tasks:</p><ul><li>Summarizing content</li><li>Generating ideas</li><li>Formatting text</li><li>Answering questions</li></ul><p>Try clicking the AI button in the toolbar to start a conversation!</p>',
      is_deleted: false,
      is_pinned: false,
      tags: ['ai', 'help'],
      color: '#E1F5FE',
      created_at: new Date(Date.now() - 86400000), // Yesterday
      updated_at: new Date(Date.now() - 86400000)
    }
  ];

  // Note operations
  async getNotes(): Promise<Note[]> {
    return await db.select()
      .from(notes)
      .where(eq(notes.is_deleted, false))
      .orderBy(desc(notes.updated_at));
  }
  
  async getNotesByUserId(userId: number): Promise<Note[]> {
    // Return demo notes for the demo user
    if (userId === 999) {
      console.log('Returning demo notes for demo user');
      return this.demoNotes;
    }
    
    return await db.select()
      .from(notes)
      .where(and(
        eq(notes.user_id, userId),
        eq(notes.is_deleted, false)
      ))
      .orderBy(desc(notes.updated_at));
  }

  async getNote(id: number): Promise<Note | undefined> {
    // Check for demo notes
    if (id === 1001 || id === 1002) {
      console.log('Returning demo note with ID:', id);
      return this.demoNotes.find(note => note.id === id);
    }
    
    const [note] = await db.select()
      .from(notes)
      .where(and(
        eq(notes.id, id),
        eq(notes.is_deleted, false)
      ));
    return note;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    // Handle demo user
    if (insertNote.user_id === 999) {
      console.log('Creating demo note');
      const newNote: Note = {
        id: Math.floor(1000 + Math.random() * 9000), // Random ID between 1000-9999
        title: insertNote.title || 'New Note',
        content: insertNote.content || '',
        is_pinned: insertNote.is_pinned || false,
        tags: insertNote.tags || [],
        color: insertNote.color || '#ffffff',
        user_id: 999,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Add to demo notes
      this.demoNotes.push(newNote);
      
      return newNote;
    }
    
    // Regular database operation
    const [note] = await db.insert(notes)
      .values({
        ...insertNote,
        is_deleted: false
      })
      .returning();
    return note;
  }

  async updateNote(id: number, updateNote: UpdateNote): Promise<Note | undefined> {
    // Handle demo notes
    if (id >= 1000 && id < 10000) {
      console.log('Updating demo note with ID:', id);
      const index = this.demoNotes.findIndex(note => note.id === id);
      
      if (index === -1) {
        return undefined;
      }
      
      // Update the note
      const oldNote = this.demoNotes[index];
      const updatedNote: Note = {
        ...oldNote,
        ...updateNote,
        updated_at: new Date()
      };
      
      this.demoNotes[index] = updatedNote;
      return updatedNote;
    }
    
    // Regular database operation
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
    // Handle demo notes
    if (id >= 1000 && id < 10000) {
      console.log('Soft-deleting demo note with ID:', id);
      const index = this.demoNotes.findIndex(note => note.id === id);
      
      if (index === -1) {
        return false;
      }
      
      // Soft-delete the note
      this.demoNotes[index] = {
        ...this.demoNotes[index],
        is_deleted: true,
        updated_at: new Date()
      };
      
      return true;
    }
    
    // Regular database operation
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
