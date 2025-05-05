import { 
  users, type User, type InsertUser,
  notes, type Note, type InsertNote, type UpdateNote
} from "@shared/schema";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Note operations
  getNotes(): Promise<Note[]>;
  getNote(id: number): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private notes: Map<number, Note>;
  private userCurrentId: number;
  private noteCurrentId: number;

  constructor() {
    this.users = new Map();
    this.notes = new Map();
    this.userCurrentId = 1;
    this.noteCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getNotes(): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => !note.is_deleted)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  async getNote(id: number): Promise<Note | undefined> {
    const note = this.notes.get(id);
    if (note && !note.is_deleted) {
      return note;
    }
    return undefined;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = this.noteCurrentId++;
    const now = new Date();
    const note: Note = {
      ...insertNote,
      id,
      created_at: now,
      updated_at: now,
      is_deleted: false
    };
    this.notes.set(id, note);
    return note;
  }

  async updateNote(id: number, updateNote: UpdateNote): Promise<Note | undefined> {
    const existingNote = await this.getNote(id);
    if (!existingNote) {
      return undefined;
    }

    const updatedNote: Note = {
      ...existingNote,
      ...updateNote,
      updated_at: new Date()
    };

    this.notes.set(id, updatedNote);
    return updatedNote;
  }

  async deleteNote(id: number): Promise<boolean> {
    const existingNote = await this.getNote(id);
    if (!existingNote) {
      return false;
    }

    const deletedNote: Note = {
      ...existingNote,
      is_deleted: true,
      updated_at: new Date()
    };

    this.notes.set(id, deletedNote);
    return true;
  }
}

export const storage = new MemStorage();
