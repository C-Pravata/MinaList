import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { generateGeminiResponse, type GeminiMessage } from './geminiApi';
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
  if (req.isAuthenticated() && req.user && typeof (req.user as any).id === 'number') {
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
    const userId = (req.user as any)?.id as number;
    console.log(`[GET /api/notes] Authenticated User ID: ${userId}`);
    try {
      const notes = await storage.getNotes(userId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve notes' });
    }
  });

  // Get single note
  app.get('/api/notes/:id', isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id as number;
    const noteId = parseInt(req.params.id);
    console.log(`[GET /api/notes/:id] Authenticated User ID: ${userId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note = await storage.getNote(noteId, userId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found or not authorized' });
      }

      res.json(note);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve note' });
    }
  });

  // Create a new note
  app.post('/api/notes', isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id as number;
    console.log(`[POST /api/notes] Authenticated User ID: ${userId}`);
    try {
      const noteData = { ...req.body, user_id: userId };
      delete noteData.id;

      const result = insertNoteSchema.safeParse(noteData);
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
    const userId = (req.user as any)?.id as number;
    const noteId = parseInt(req.params.id);
    console.log(`[PUT /api/notes/:id] Authenticated User ID: ${userId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const result = updateNoteSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const updatedNote = await storage.updateNote(noteId, userId, result.data);
      if (!updatedNote) {
        return res.status(404).json({ message: 'Note not found or not authorized' });
      }

      res.json(updatedNote);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update note' });
    }
  });

  // Delete a note
  app.delete('/api/notes/:id', isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id as number;
    const noteId = parseInt(req.params.id);
    console.log(`[DELETE /api/notes/:id] Authenticated User ID: ${userId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const success = await storage.deleteNote(noteId, userId);
      if (!success) {
        return res.status(404).json({ message: 'Note not found or not authorized' });
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
      const userId = (req.user as any).id as number;
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note = await storage.getNote(noteId, userId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found or not authorized' });
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
      const userId = (req.user as any).id as number;
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const attachments = await storage.getAttachments(noteId, userId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve attachments' });
    }
  });

  // Delete an attachment
  app.delete('/api/attachments/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id as number;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid attachment ID' });
      }

      const success = await storage.deleteAttachment(id, userId);
      if (!success) {
        return res.status(404).json({ message: 'Attachment not found or not authorized' });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete attachment' });
    }
  });

  // Get AI chat history for a note
  app.get('/api/notes/:noteId/ai-chats', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id as number;
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const chats = await storage.getAiChats(noteId, userId);
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve AI chats' });
    }
  });

  // Create a new AI chat for a note
  app.post('/api/notes/:noteId/ai-chats', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id as number;
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note = await storage.getNote(noteId, userId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found or not authorized' });
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
      const userId = (req.user as any).id as number;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
      }

      const result = updateAiChatSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const updatedChat = await storage.updateAiChat(id, userId, result.data);
      if (!updatedChat) {
        return res.status(404).json({ message: 'AI chat not found or not authorized' });
      }

      res.json(updatedChat);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update AI chat' });
    }
  });

  // Get a specific AI chat
  app.get('/api/ai-chats/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id as number;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
      }

      const chat = await storage.getAiChat(id, userId);
      if (!chat) {
        return res.status(404).json({ message: 'AI chat not found or not authorized' });
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: 'Failed to retrieve AI chat' });
    }
  });

  // Gemini AI chat endpoint
  app.post('/api/ai/chat', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { messages } = req.body;
      
      if (!Array.isArray(messages)) {
        return res.status(400).json({ message: 'Invalid request format: messages must be an array' });
      }
      
      // Convert messages from our app format to Gemini format
      const geminiMessages: GeminiMessage[] = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : (msg.role === 'system' ? 'user' : msg.role),
        parts: [{ text: msg.content }]
      }));
      
      // Get response from Gemini
      const responseText = await generateGeminiResponse(geminiMessages);
      
      // Return the response to the client
      res.json({
        message: {
          role: 'assistant',
          content: responseText
        }
      });
    } catch (error) {
      console.error('Error in AI chat endpoint:', error);
      res.status(500).json({ 
        message: 'Failed to get AI response',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Dashboard AI chat with notes context endpoint
  app.post('/api/ai/dashboard-chat', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { messages, notes } = req.body;
      const userId = (req.user as any)?.id as number;
      
      if (!Array.isArray(messages) || !Array.isArray(notes)) {
        return res.status(400).json({ message: 'Invalid request format: messages and notes must be arrays' });
      }
      
      // Verify these are the user's notes
      const userNotes = await storage.getNotes(userId);
      const userNoteIds = new Set(userNotes.map(note => note.id));
      
      // Filter out any notes that don't belong to this user
      const validNotes = notes.filter(note => userNoteIds.has(note.id));
      
      // Function to convert HTML to plain text (server-side compatible)
      const htmlToPlainText = (html: string): string => {
        // Simple replacements for common HTML tags
        return html
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')  // Replace non-breaking spaces
          .replace(/&amp;/g, '&')   // Replace ampersands
          .replace(/&lt;/g, '<')    // Replace less than
          .replace(/&gt;/g, '>')    // Replace greater than
          .trim();                  // Trim whitespace
      };
      
      // Prepare content for the AI - process the notes into a searchable context
      let notesContext = "USER'S NOTES CONTEXT:\n\n";
      
      validNotes.forEach((note, i) => {
        // Convert HTML content to plain text
        const plainContent = htmlToPlainText(note.content || '');
        
        notesContext += `Note #${i+1} [ID: ${note.id}]\n`;
        notesContext += `Title: ${note.title || "Untitled"}\n`;
        notesContext += `Created: ${new Date(note.created_at).toISOString()}\n`;
        notesContext += `Updated: ${new Date(note.updated_at).toISOString()}\n`;
        notesContext += `Content: ${plainContent.substring(0, 1000)}${plainContent.length > 1000 ? '...' : ''}\n\n`;
      });
      
      // Add system message with notes context
      const systemMessage = {
        role: 'system' as const,
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
      
      // Process conversation messages
      const conversationMessages = messages.filter(msg => msg.role !== 'system');
      
      // Convert all messages to Gemini format
      const geminiMessages: GeminiMessage[] = [
        {
          role: 'user',
          parts: [{ text: systemMessage.content }]
        },
        ...conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : (msg.role === 'system' ? 'user' : msg.role),
          parts: [{ text: msg.content }]
        }))
      ];

      // Get response from Gemini
      const responseText = await generateGeminiResponse(geminiMessages);
      
      // Process the response to extract note references
      const referencedNotes: { id: number, title: string, createdAt: number, excerpt: string, confidence: number }[] = [];
      
      // Parse note IDs from the response
      const noteIdRegex = /\[ID: (\d+)\]/g;
      let match;
      const foundIds: number[] = [];
      while ((match = noteIdRegex.exec(responseText)) !== null) {
        foundIds.push(parseInt(match[1]));
      }
      
      // Find unique IDs and get the corresponding notes
      const uniqueIds = Array.from(new Set(foundIds));
      
      for (let i = 0; i < uniqueIds.length; i++) {
        const id = uniqueIds[i];
        const matchingNote = validNotes.find(note => note.id === id);
        if (matchingNote) {
          // Extract a brief excerpt from the matching note
          const plainContent = htmlToPlainText(matchingNote.content || '');
          const excerpt = plainContent.substring(0, 120) + (plainContent.length > 120 ? '...' : '');
          
          referencedNotes.push({
            id: matchingNote.id,
            title: matchingNote.title || "Untitled",
            createdAt: matchingNote.created_at,
            excerpt,
            confidence: 1.0 // We could implement a more sophisticated confidence scoring
          });
        }
      }
      
      // Clean up the response text to make it more user-friendly
      let cleanedResponse = responseText;
      // Remove the formal note ID references since we're showing them separately
      cleanedResponse = cleanedResponse.replace(/\[ID: \d+\]/g, '');
      
      // Return the response with referenced notes to the client
      res.json({
        message: {
          role: 'assistant',
          content: cleanedResponse
        },
        referencedNotes
      });
      
    } catch (error) {
      console.error('Error in dashboard AI chat endpoint:', error);
      res.status(500).json({ 
        message: 'Failed to get AI response',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
