import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import cors from 'cors';
import { storage } from "./storage";
import { generateGeminiResponse, type GeminiMessage } from './geminiApi';
import { 
  insertNoteSchema, 
  updateNoteSchema,
  insertAiChatSchema,
  updateAiChatSchema,
  insertAttachmentSchema,
  Note,
  AiChat,
  Attachment
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { notes } from "@shared/schema";

// Middleware to extract and validate device ID
const deviceIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Allow OPTIONS requests to pass without device ID check for CORS preflight
  if (req.method === 'OPTIONS') {
    return next(); // Skips the rest of the middleware for OPTIONS requests
  }

  const deviceId = req.headers['x-device-id'] as string;
  if (!deviceId) {
    // console.warn(`Blocked request to ${req.path} due to missing x-device-id header`); // Optional: more logging
    return res.status(400).json({ message: 'Device ID (x-device-id header) is required' });
  }
  (req as any).deviceId = deviceId; // Attach deviceId to request object
  next();
};

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

// Define the structure of messages coming from AIAssistant.tsx
interface ClientAiMessage {
  role: 'user' | 'assistant' | 'system'; // Client might send 'system', we filter later
  content: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // 1. CORS Middleware - Placed before any routes or other custom middleware for /api
  const corsOptions = {
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:4173', // Vite preview server
      'https://minalist.onrender.com', // Production domain (web build)
      'capacitor://localhost', // Capacitor default local scheme
      'capacitor://app.mina.io', // Capacitor iOS/Android WebView (configured hostname)
      'https://app.mina.io', // Public HTTPS scheme for WebView
      'http://localhost' // Additional localhost variants
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID']
  };
  app.use('/api', cors(corsOptions));

  // Health check endpoint for debugging (before device ID middleware)
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      // Test database connection
      const testQuery = await db.select().from(notes).limit(1);
      res.json({ 
        status: 'ok', 
        database: 'connected',
        timestamp: new Date().toISOString(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          DATABASE_URL_EXISTS: !!process.env.DATABASE_URL
        }
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({ 
        status: 'error', 
        database: 'failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Serve uploaded files (can be before or after CORS for /api, depends on if uploads need CORS)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Get all notes
  app.get('/api/notes', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    console.log(`[GET /api/notes] Device ID: ${deviceId}`);
    try {
      const notes: Note[] = await storage.getNotes(deviceId);
      res.json(notes);
    } catch (error) {
      console.error("Failed to retrieve notes:", error);
      res.status(500).json({ message: 'Failed to retrieve notes' });
    }
  });

  // Get single note
  app.get('/api/notes/:id', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const noteId = parseInt(req.params.id);
    console.log(`[GET /api/notes/:id] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note: Note | undefined = await storage.getNote(noteId, deviceId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found or not authorized for this device' });
      }

      res.json(note);
    } catch (error) {
      console.error("Failed to retrieve note:", error);
      res.status(500).json({ message: 'Failed to retrieve note' });
    }
  });

  // Create a new note
  app.post('/api/notes', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    console.log(`[POST /api/notes] Device ID: ${deviceId}`);
    try {
      const noteData = { ...req.body, device_id: deviceId };
      // delete noteData.id; // id should not be sent from client for create

      const result = insertNoteSchema.safeParse(noteData);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const newNote: Note = await storage.createNote(result.data);
      res.status(201).json(newNote);
    } catch (error) {
      console.error("Failed to create note:", error);
      res.status(500).json({ message: 'Failed to create note' });
    }
  });

  // Update a note
  app.put('/api/notes/:id', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const noteId = parseInt(req.params.id);
    console.log(`[PUT /api/notes/:id] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const result = updateNoteSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const updatedNote: Note | undefined = await storage.updateNote(noteId, deviceId, result.data);
      if (!updatedNote) {
        return res.status(404).json({ message: 'Note not found or not authorized for this device' });
      }

      res.json(updatedNote);
    } catch (error) {
      console.error("Failed to update note:", error);
      res.status(500).json({ message: 'Failed to update note' });
    }
  });

  // Delete a note
  app.delete('/api/notes/:id', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const noteId = parseInt(req.params.id);
    console.log(`[DELETE /api/notes/:id] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const success = await storage.deleteNote(noteId, deviceId);
      if (!success) {
        return res.status(404).json({ message: 'Note not found or not authorized for this device' });
      }

      res.status(204).send(); // No content
    } catch (error) {
      console.error("Failed to delete note:", error);
      res.status(500).json({ message: 'Failed to delete note' });
    }
  });

  // Upload image (now expects Base64 JSON payload)
  app.post('/api/upload', deviceIdMiddleware, async (req: Request, res: Response) => {
    try {
      console.log('[SERVER /api/upload] Request received (Base64).');
      console.log('[SERVER /api/upload] req.headers:', JSON.stringify(req.headers, null, 2));
      console.log('[SERVER /api/upload] req.body (JSON payload):', JSON.stringify(req.body, null, 2));

      const { file_data_url, original_filename, original_filetype } = req.body;

      if (!file_data_url || typeof file_data_url !== 'string') {
        return res.status(400).json({ message: 'No file_data_url provided or invalid format.' });
      }
      if (!original_filename || typeof original_filename !== 'string') {
        return res.status(400).json({ message: 'No original_filename provided.' });
      }

      // Extract base64 data and mime type from data URL
      // Format: data:[<mediatype>][;base64],<data>
      const parts = file_data_url.split(';base64,');
      if (parts.length !== 2) {
        return res.status(400).json({ message: 'Invalid file_data_url format.' });
      }
      // const mimeType = parts[0].split(':')[1]; // e.g., image/png
      const base64Data = parts[1];

      const buffer = Buffer.from(base64Data, 'base64');
      
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Use original_filename's extension or derive from original_filetype if necessary
      const fileExtension = path.extname(original_filename) || (original_filetype ? `.${original_filetype.split('/')[1]}` : '.bin');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const newFilename = uniqueSuffix + fileExtension;
      const filePath = path.join(uploadDir, newFilename);

      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/uploads/${newFilename}`;
      console.log(`[SERVER /api/upload] File saved to: ${filePath}`);
      console.log(`[SERVER /api/upload] File URL: ${fileUrl}`);

      res.json({ url: fileUrl });
    } catch (error) {
      console.error('[SERVER /api/upload] Error:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  // Save attachment for a note
  app.post('/api/notes/:noteId/attachments', deviceIdMiddleware, upload.single('file'), async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
      const noteId = parseInt(req.params.noteId);
    console.log(`[POST /api/notes/:noteId/attachments] Device ID: ${deviceId}, Note ID: ${noteId}`);
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    try {
      if (isNaN(noteId)) return res.status(400).json({ message: 'Invalid note ID' });
      const note = await storage.getNote(noteId, deviceId); // Verify note ownership
      if (!note) return res.status(404).json({ message: 'Note not found or not authorized' });

      const attachmentData = {
        note_id: noteId,
        device_id: deviceId,
        file_path: req.file.path, // path from multer
        file_type: req.file.mimetype,
        file_name: req.file.originalname,
      };
      const result = insertAttachmentSchema.safeParse(attachmentData);
      if (!result.success) {
        // If validation fails, attempt to delete uploaded file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Failed to delete orphaned upload:", err);
        });
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      const newAttachment: Attachment = await storage.createAttachment(result.data);
      res.status(201).json(newAttachment);
    } catch (error) {
      console.error("Failed to create attachment:", error);
      // If error after file upload, attempt to delete uploaded file
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Failed to delete orphaned upload on error:", err);
        });
      }
      res.status(500).json({ message: 'Failed to create attachment' });
    }
  });

  // Get attachments for a note
  app.get('/api/notes/:noteId/attachments', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const noteId = parseInt(req.params.noteId);
    console.log(`[GET /api/notes/:noteId/attachments] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const attachments = await storage.getAttachments(noteId, deviceId);
      res.json(attachments);
    } catch (error) {
      console.error("Failed to retrieve attachments:", error);
      res.status(500).json({ message: 'Failed to retrieve attachments' });
    }
  });

  // Delete attachment
  app.delete('/api/attachments/:attachmentId', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const attachmentId = parseInt(req.params.attachmentId);
    console.log(`[DELETE /api/attachments/:attachmentId] Device ID: ${deviceId}, Attachment ID: ${attachmentId}`);
    try {
      if (isNaN(attachmentId)) {
        return res.status(400).json({ message: 'Invalid attachment ID' });
      }

      const success = await storage.deleteAttachment(attachmentId, deviceId);
      if (!success) {
        return res.status(404).json({ message: 'Attachment not found or not authorized for this device' });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      res.status(500).json({ message: 'Failed to delete attachment' });
    }
  });

  // Get AI chats for a note
  app.get('/api/notes/:noteId/ai-chats', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const noteId = parseInt(req.params.noteId);
    console.log(`[GET /api/notes/:noteId/ai-chats] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const chats = await storage.getAiChats(noteId, deviceId);
      res.json(chats);
    } catch (error) {
      console.error("Failed to retrieve AI chats:", error);
      res.status(500).json({ message: 'Failed to retrieve AI chats' });
    }
  });

  // Create AI chat for a note
  app.post('/api/notes/:noteId/ai-chats', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const noteId = parseInt(req.params.noteId);
    console.log(`[POST /api/notes/:noteId/ai-chats] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const note = await storage.getNote(noteId, deviceId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found or not authorized' });
      }

      const result = insertAiChatSchema.safeParse({
        ...req.body,
        note_id: noteId,
        device_id: deviceId
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const chat = await storage.createAiChat(result.data);
      res.status(201).json(chat);
    } catch (error) {
      console.error("Failed to create AI chat:", error);
      res.status(500).json({ message: 'Failed to create AI chat' });
    }
  });

  // Update AI chat
  app.put('/api/ai-chats/:id', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const chatId = parseInt(req.params.id);
    console.log(`[PUT /api/ai-chats/:id] Device ID: ${deviceId}, Chat ID: ${chatId}`);
    try {
      if (isNaN(chatId)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
      }

      const result = updateAiChatSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const updatedChat = await storage.updateAiChat(chatId, deviceId, result.data);
      if (!updatedChat) {
        return res.status(404).json({ message: 'AI chat not found or not authorized for this device' });
      }

      res.json(updatedChat);
    } catch (error) {
      console.error("Failed to update AI chat:", error);
      res.status(500).json({ message: 'Failed to update AI chat' });
    }
  });

  // Get single AI chat
  app.get('/api/ai-chats/:id', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const chatId = parseInt(req.params.id);
    console.log(`[GET /api/ai-chats/:id] Device ID: ${deviceId}, Chat ID: ${chatId}`);
    try {
      if (isNaN(chatId)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
      }

      const chat = await storage.getAiChat(chatId, deviceId);
      if (!chat) {
        return res.status(404).json({ message: 'AI chat not found or not authorized for this device' });
      }

      res.json(chat);
    } catch (error) {
      console.error("Failed to retrieve AI chat:", error);
      res.status(500).json({ message: 'Failed to retrieve AI chat' });
    }
  });

  // Generate AI content for a note
  app.post('/api/notes/:noteId/ai/generate', deviceIdMiddleware, async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const noteId = parseInt(req.params.noteId);
    const { prompt, history } = req.body as { prompt: string; history?: ClientAiMessage[] };
      
    console.log(`[POST /api/notes/:noteId/ai/generate] Device ID: ${deviceId}, Note ID: ${noteId}, Prompt: "${prompt}", History items: ${history?.length}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }
      const note = await storage.getNote(noteId, deviceId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found or not authorized for this device' });
      }
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required' });
      }
      
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

      // Create a system message with the note content as context
      const plainNoteContent = htmlToPlainText(note.content || '');
      const systemMessage: GeminiMessage = {
        role: 'user', // Using 'user' role for system-like instructions with Gemini
        parts: [{ 
          text: `You are Mina, a helpful AI assistant. Your name is Mina. You are currently assisting within a specific note in a note-taking application.

The content of the current note is provided below for your reference. You can use this context if the user's query seems related to it (e.g., if they ask about "this email", "the text below", or "this note").
However, the user may also ask general questions or questions unrelated to this specific note. In all cases, be helpful and use your broad knowledge to answer as best as you can.

---
CURRENT NOTE CONTEXT:
TITLE: ${note.title || 'Untitled'}

CONTENT:
${plainNoteContent}
---
End of Current Note Context.

Your primary goal is to assist the user. If their query is about the note content above, use it. Otherwise, answer their general questions.
You can help review text, check spelling/grammar, provide feedback, summarize, or answer questions.
When referring to yourself, always use the name "Mina". Be concise, friendly, and helpful.`
        }]
      };

      const messagesForGemini: GeminiMessage[] = [systemMessage];
      if (history && history.length > 0) {
        history.forEach(clientMsg => {
          let geminiRole: 'user' | 'model' | undefined = undefined; 
          if (clientMsg.role === 'user') {
            geminiRole = 'user';
          } else if (clientMsg.role === 'assistant') { // Client uses 'assistant'
            geminiRole = 'model'; // Gemini API uses 'model' for assistant's messages
          }
          // 'system' roles from client history are skipped for this endpoint.
          // 'model' role directly from client history is unexpected; client should send 'assistant'.

          if (geminiRole) { 
            messagesForGemini.push({
              role: geminiRole,
              parts: [{ text: clientMsg.content }]
            });
          }
        });
      }
      messagesForGemini.push({ role: 'user', parts: [{ text: prompt }] });

      console.log('Sending to Gemini:', JSON.stringify({ contents: messagesForGemini.map(m => ({ role: m.role, text: m.parts[0].text.substring(0, 50) + (m.parts[0].text.length > 50 ? '...' : '') })) }, null, 2));
      const aiResponse = await generateGeminiResponse(messagesForGemini);
      res.json({ response: aiResponse });

    } catch (error) {
      console.error("AI response generation error:", error);
      res.status(500).json({ message: (error as Error).message || 'Failed to generate AI response' });
    }
  });

  // Dashboard AI chat endpoint
  app.post('/api/ai/dashboard-chat', deviceIdMiddleware, async (req: Request, res: Response) => {
    try {
      const { messages, notes } = req.body;
      const deviceId = (req as any).deviceId as string;
      
      if (!Array.isArray(messages) || !Array.isArray(notes)) {
        return res.status(400).json({ message: 'Invalid request format: messages and notes must be arrays' });
      }
      
      // Verify these are the device's notes
      const deviceNotes = await storage.getNotes(deviceId);
      const deviceNoteIds = new Set(deviceNotes.map(note => note.id));
      
      // Filter out any notes that don't belong to this device
      const validNotes = notes.filter(note => deviceNoteIds.has(note.id));
      
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
      let notesContext = "DEVICE'S NOTES CONTEXT:\n\n";
      
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
        content: `You are Mina, your helpful AI assistant. Your name is Mina. 
Your job is to help users find and retrieve information from their notes, or answer questions based on the provided note context.
When users ask about their notes, search through the provided context to find relevant information.

IMPORTANT: When you identify specific notes in your response, YOU MUST include their reference using the exact format "[ID: note_id_here]" immediately after mentioning the note. For example, if you find a note with ID 42, you might say "I found a relevant note [ID: 42] titled 'Shopping List'."

Always provide note references with ID, title, and date when answering questions about notes, if applicable based on the query, and ensure the [ID: id] tag is present.
If a user asks about a specific topic, search for those keywords in the notes.
If asked to locate a specific note, scan the provided notes context and return IDs of the most relevant matches, again, ensuring each is tagged with [ID: id].
Format your note references with note ID and brief excerpt from the content if you are providing specific note details.
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

  // Global error handler (should be last middleware before starting the server)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Global error handler caught:", err);
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      return res.status(400).json({ message: `Multer error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred.
      if (err.message && err.message.startsWith('Invalid file type')) {
        return res.status(400).json({ message: err.message });
      }
      // For other errors, send a generic message
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
    // If no error but this middleware is reached, it means something went wrong with routing
    // or this was called via next() without an error. Ensure prior routes handle responses or call next properly.
    if (!res.headersSent) {
      res.status(404).json({ message: "Resource not found or error in routing." });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
