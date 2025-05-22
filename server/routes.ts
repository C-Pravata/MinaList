import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
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

// Middleware to extract and validate device ID
const deviceIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const deviceId = req.headers['x-device-id'] as string;
  if (!deviceId) {
    return res.status(400).json({ message: 'Device ID (x-device-id header) is required' });
  }
  (req as any).deviceId = deviceId; // Attach deviceId to request object for easier access in route handlers
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
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Apply deviceIdMiddleware to all /api routes that need it
  app.use("/api", deviceIdMiddleware);

  // Get all notes
  app.get('/api/notes', async (req: Request, res: Response) => {
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
  app.get('/api/notes/:id', async (req: Request, res: Response) => {
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
  app.post('/api/notes', async (req: Request, res: Response) => {
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
  app.put('/api/notes/:id', async (req: Request, res: Response) => {
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
  app.delete('/api/notes/:id', async (req: Request, res: Response) => {
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

  // Upload image for a note
  app.post('/api/upload', async (req: Request, res: Response) => {
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
  app.post('/api/notes/:noteId/attachments', upload.single('file'), async (req: Request, res: Response) => {
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

  // Get all attachments for a note
  app.get('/api/notes/:noteId/attachments', async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
      const noteId = parseInt(req.params.noteId);
    console.log(`[GET /api/notes/:noteId/attachments] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) return res.status(400).json({ message: 'Invalid note ID' });
      const note = await storage.getNote(noteId, deviceId); // Verify note ownership
      if (!note) return res.status(404).json({ message: 'Note not found or not authorized' });

      const attachmentsResult: Attachment[] = await storage.getAttachments(noteId, deviceId);
      res.json(attachmentsResult);
    } catch (error) {
      console.error("Failed to retrieve attachments:", error);
      res.status(500).json({ message: 'Failed to retrieve attachments' });
    }
  });

  // Delete an attachment
  app.delete('/api/attachments/:attachmentId', async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const attachmentId = parseInt(req.params.attachmentId);
    console.log(`[DELETE /api/attachments/:attachmentId] Device ID: ${deviceId}, Attachment ID: ${attachmentId}`);
    try {
      if (isNaN(attachmentId)) return res.status(400).json({ message: 'Invalid attachment ID' });
      
      // Before deleting from DB, get attachment to find file_path for fs.unlink
      const attachmentToDelete = await storage.getAttachment(attachmentId, deviceId);
      if (!attachmentToDelete) {
        return res.status(404).json({ message: 'Attachment not found or not authorized' });
      }

      const success = await storage.deleteAttachment(attachmentId, deviceId);
      if (success) {
        // Try to delete the file from the filesystem
        fs.unlink(attachmentToDelete.file_path, (err) => {
          if (err) {
            console.error(`Failed to delete attachment file ${attachmentToDelete.file_path}:`, err);
            // Optionally, you could decide if this failure should alter the response.
            // For now, we'll assume DB deletion success is primary.
          } else {
            console.log(`Successfully deleted attachment file: ${attachmentToDelete.file_path}`);
          }
        });
      res.status(204).send();
      } else {
        res.status(404).json({ message: 'Attachment not found or not authorized, or DB deletion failed' });
      }
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      res.status(500).json({ message: 'Failed to delete attachment' });
    }
  });

  // Get AI chat history for a note
  app.get('/api/notes/:noteId/ai-chats', async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const noteId = parseInt(req.params.noteId);
    console.log(`[GET /api/notes/:noteId/ai-chats] Device ID: ${deviceId}, Note ID: ${noteId}`);
    try {
      if (isNaN(noteId)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }

      const chats: AiChat[] = await storage.getAiChats(noteId, deviceId);
      res.json(chats);
    } catch (error) {
      console.error("Failed to retrieve AI chats:", error);
      res.status(500).json({ message: 'Failed to retrieve AI chats' });
    }
  });

  // Create a new AI chat for a note
  app.post('/api/notes/:noteId/ai-chats', async (req: Request, res: Response) => {
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

  // Update an AI chat
  app.put('/api/ai-chats/:id', async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
      const id = parseInt(req.params.id);
    console.log(`[PUT /api/ai-chats/:id] Device ID: ${deviceId}, Chat ID: ${id}`);
    try {
      if (isNaN(id)) return res.status(400).json({ message: 'Invalid chat ID' });

      const result = updateAiChatSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      // Storage method getAiChat and updateAiChat handle deviceId check via joins/note ownership
      const updatedChat: AiChat | undefined = await storage.updateAiChat(id, deviceId, result.data);
      if (!updatedChat) return res.status(404).json({ message: 'Chat not found or not authorized' });
      res.json(updatedChat);
    } catch (error) {
      console.error("Failed to update AI chat:", error);
      res.status(500).json({ message: 'Failed to update AI chat' });
    }
  });

  // Get a specific AI chat
  app.get('/api/ai-chats/:id', async (req: Request, res: Response) => {
    const deviceId = (req as any).deviceId as string;
    const id = parseInt(req.params.id);
    console.log(`[GET /api/ai-chats/:id] Device ID: ${deviceId}, Chat ID: ${id}`);
    try {
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
      }

      const chat = await storage.getAiChat(id, deviceId);
      if (!chat) {
        return res.status(404).json({ message: 'AI chat not found or not authorized' });
      }

      res.json(chat);
    } catch (error) {
      console.error("Failed to retrieve AI chat:", error);
      res.status(500).json({ message: 'Failed to retrieve AI chat' });
    }
  });

  // Gemini AI chat generation endpoint
  app.post('/api/notes/:noteId/ai/generate', async (req: Request, res: Response) => {
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

  // Dashboard AI chat with notes context endpoint
  app.post('/api/ai/dashboard-chat', async (req: Request, res: Response) => {
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

  const httpServer = createServer(app);

  return httpServer;
}
