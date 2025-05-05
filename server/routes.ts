import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertNoteSchema, updateNoteSchema } from "@shared/schema";
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

  // Get all notes
  app.get('/api/notes', async (req: Request, res: Response) => {
    try {
      const notes = await storage.getNotes();
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve notes' });
    }
  });

  // Get single note
  app.get('/api/notes/:id', async (req: Request, res: Response) => {
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
  app.post('/api/notes', async (req: Request, res: Response) => {
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
  app.put('/api/notes/:id', async (req: Request, res: Response) => {
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
  app.delete('/api/notes/:id', async (req: Request, res: Response) => {
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

  const httpServer = createServer(app);

  return httpServer;
}
