import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
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

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: express.NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized. Please log in.' });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Get all notes
  app.get('/api/notes', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const notes = await storage.getNotes();
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve notes' });
    }
  });

  // Get single note
  app.get('/api/notes/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note = await storage.getNote(id);
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }

      res.json(note);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve note' });
    }
  });

  // Create a new note
  app.post('/api/notes', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const result = insertNoteSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const newNote = await storage.createNote(result.data);
      res.status(201).json(newNote);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create note' });
    }
  });

  // Update a note
  app.put('/api/notes/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
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

  // Delete a note
  app.delete('/api/notes/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
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
  app.post('/api/upload', isAuthenticated, upload.single('image'), (req: Request, res: Response) => {
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
  app.post('/api/notes/:noteId/attachments', isAuthenticated, async (req: Request, res: Response) => {
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
  app.get('/api/notes/:noteId/attachments', isAuthenticated, async (req: Request, res: Response) => {
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
  app.delete('/api/attachments/:id', isAuthenticated, async (req: Request, res: Response) => {
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
  app.get('/api/notes/:noteId/ai-chats', isAuthenticated, async (req: Request, res: Response) => {
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
  app.post('/api/notes/:noteId/ai-chats', isAuthenticated, async (req: Request, res: Response) => {
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
  app.put('/api/ai-chats/:id', isAuthenticated, async (req: Request, res: Response) => {
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
  app.get('/api/ai-chats/:id', isAuthenticated, async (req: Request, res: Response) => {
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
