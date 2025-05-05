import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateOptional, authenticateRequired, generateToken } from "./middleware/auth";
import { 
  insertNoteSchema, 
  updateNoteSchema,
  insertAiChatSchema,
  updateAiChatSchema,
  insertAttachmentSchema
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import path from "path";
import fs from "fs";

// Set up multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.') as any);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // Firebase auth verification endpoint
  app.post('/api/auth/verify', async (req: Request, res: Response) => {
    try {
      const { uid, email, displayName } = req.body;
      
      if (!uid || !email) {
        return res.status(400).json({ message: 'Invalid user data' });
      }
      
      // Generate a JWT token for our backend
      const token = generateToken({ uid, email, displayName });
      
      let dbUser = await storage.getUserByFirebaseId(uid);
      
      // Create the user if it doesn't exist
      if (!dbUser) {
        dbUser = await storage.createUser({
          firebase_uid: uid,
          username: displayName || email.split('@')[0],
          email: email,
          password: '', // Not needed with Firebase auth
          avatar_url: null,
        });
      }
      
      res.json({ token, user: { uid, email, displayName, id: dbUser.id } });
    } catch (error) {
      console.error('Auth verification error:', error);
      res.status(500).json({ message: 'Authentication failed' });
    }
  });
  
  // Direct login endpoint with username/password for development
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Check password (basic check for demo user)
      if (username === 'demo' && password === 'password123') {
        // Issue token for demo user
        const token = generateToken({ 
          uid: 'demo-' + user.id, 
          email: user.email || 'demo@example.com',
          displayName: user.username 
        });
        
        return res.json({ 
          token, 
          user: { 
            id: user.id,
            uid: 'demo-' + user.id,
            email: user.email, 
            displayName: user.username 
          } 
        });
      }
      
      // In a real app, you'd verify the hashed password here
      
      return res.status(401).json({ message: 'Invalid username or password' });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });
  
  // Get current user
  app.get('/api/user', authenticateRequired, (req: Request, res: Response) => {
    res.json({
      id: req.userId,
      uid: req.user?.uid,
      email: req.user?.email,
      displayName: req.user?.displayName
    });
  });

  // Get all notes for the current user
  app.get('/api/notes', authenticateRequired, async (req: Request, res: Response) => {
    try {
      // Get all notes for the current user
      const notes = await storage.getNotesByUserId(req.userId!);
      res.json(notes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      res.status(500).json({ message: 'Failed to retrieve notes' });
    }
  });

  // Get single note (verify ownership)
  app.get('/api/notes/:id', authenticateRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note = await storage.getNote(id);
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }
      
      // Verify the user owns this note
      if (note.user_id !== req.userId) {
        return res.status(403).json({ message: 'You do not have permission to access this note' });
      }

      res.json(note);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve note' });
    }
  });

  // Create a new note for the current user
  app.post('/api/notes', authenticateRequired, async (req: Request, res: Response) => {
    try {
      const result = insertNoteSchema.safeParse({
        ...req.body,
        user_id: req.userId
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const newNote = await storage.createNote(result.data);
      res.status(201).json(newNote);
    } catch (error) {
      console.error('Error creating note:', error);
      res.status(500).json({ message: 'Failed to create note' });
    }
  });

  // Update a note (verify ownership)
  app.put('/api/notes/:id', authenticateRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }
      
      // Verify the user owns this note
      const existingNote = await storage.getNote(id);
      if (!existingNote) {
        return res.status(404).json({ message: 'Note not found' });
      }
      
      if (existingNote.user_id !== req.userId) {
        return res.status(403).json({ message: 'You do not have permission to update this note' });
      }

      const result = updateNoteSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const updatedNote = await storage.updateNote(id, result.data);
      if (!updatedNote) {
        return res.status(404).json({ message: 'Note not found' });
      }

      res.json(updatedNote);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update note' });
    }
  });

  // Delete a note (verify ownership)
  app.delete('/api/notes/:id', authenticateRequired, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }
      
      // Verify the user owns this note
      const existingNote = await storage.getNote(id);
      if (!existingNote) {
        return res.status(404).json({ message: 'Note not found' });
      }
      
      if (existingNote.user_id !== req.userId) {
        return res.status(403).json({ message: 'You do not have permission to delete this note' });
      }

      const success = await storage.deleteNote(id);
      if (!success) {
        return res.status(404).json({ message: 'Note not found' });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete note' });
    }
  });

  // Upload image for a note
  app.post('/api/upload', upload.single('image'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Return the file path that can be used in the note content
      res.json({
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  // Save attachment for a note
  app.post('/api/notes/:noteId/attachments', async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note = await storage.getNote(noteId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }

      const result = insertAttachmentSchema.safeParse({
        ...req.body,
        note_id: noteId
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const attachment = await storage.createAttachment(result.data);
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create attachment' });
    }
  });

  // Get all attachments for a note
  app.get('/api/notes/:noteId/attachments', async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const attachments = await storage.getAttachments(noteId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve attachments' });
    }
  });

  // Delete an attachment
  app.delete('/api/attachments/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid attachment ID' });
      }

      const success = await storage.deleteAttachment(id);
      if (!success) {
        return res.status(404).json({ message: 'Attachment not found' });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete attachment' });
    }
  });

  // Get AI chat history for a note
  app.get('/api/notes/:noteId/ai-chats', async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const chats = await storage.getAiChats(noteId);
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve AI chats' });
    }
  });

  // Create a new AI chat for a note
  app.post('/api/notes/:noteId/ai-chats', async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note = await storage.getNote(noteId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }

      const result = insertAiChatSchema.safeParse({
        ...req.body,
        note_id: noteId
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const chat = await storage.createAiChat(result.data);
      res.status(201).json(chat);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create AI chat' });
    }
  });

  // Update an AI chat
  app.put('/api/ai-chats/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
      }

      const result = updateAiChatSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const updatedChat = await storage.updateAiChat(id, result.data);
      if (!updatedChat) {
        return res.status(404).json({ message: 'AI chat not found' });
      }

      res.json(updatedChat);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update AI chat' });
    }
  });

  // Get a specific AI chat
  app.get('/api/ai-chats/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
      }

      const chat = await storage.getAiChat(id);
      if (!chat) {
        return res.status(404).json({ message: 'AI chat not found' });
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve AI chat' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
