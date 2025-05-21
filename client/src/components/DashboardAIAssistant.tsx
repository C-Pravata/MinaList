import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, SendHorizontal, Bot, XCircle, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useNotes } from "@/hooks/useNotes";
import { Note } from "@shared/schema";

interface DashboardAIAssistantProps {
  open: boolean;
  onClose: () => void;
  onNavigateToNote?: (noteId: number) => void;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface NoteReference {
  id: number;
  title: string;
  createdAt: number;
  excerpt: string;
  confidence: number;
}

export default function DashboardAIAssistant({ open, onClose, onNavigateToNote }: DashboardAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "You are Mina, your helpful AI assistant. You have access to all your notes and can help you find information, summarize content, or answer questions based on your notes. How can I assist you with your notes today?"
    }
  ]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [foundNotes, setFoundNotes] = useState<NoteReference[]>([]);
  const { notes } = useNotes();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  // When the component opens, reset state
  useEffect(() => {
    if (open) {
      setFoundNotes([]);
    }
  }, [open]);

  const handleSendPrompt = async () => {
    if (!prompt.trim() || isLoading) return;
    
    const userMessage: Message = { role: "user", content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);
    setFoundNotes([]);

    try {
      // Send request with notes context
      const aiChatData = { 
        messages: [...messages, userMessage],
        notes: notes.map(note => ({
          id: note.id,
          title: note.title || "Untitled",
          content: note.content,
          created_at: note.created_at,
          updated_at: note.updated_at
        }))
      };
      
      const response = await apiRequest("POST", "/api/ai/dashboard-chat", aiChatData);
      const data = await response.json();
      
      // Add the AI response to our messages
      setMessages(prev => [...prev, data.message]);
      
      // If there are referenced notes, show them
      if (data.referencedNotes && data.referencedNotes.length > 0) {
        setFoundNotes(data.referencedNotes);
      }
      
      setIsLoading(false);
      
      // Scroll to bottom
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast({
        title: "AI Assistant Error",
        description: "Failed to get a response from the AI assistant",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  const clearConversation = () => {
    setMessages([{
      role: "system",
      content: "You are Mina, your helpful AI assistant. You have access to all your notes and can help you find information, summarize content, or answer questions based on your notes. How can I assist you with your notes today?"
    }]);
    setFoundNotes([]);
  };

  const handleNoteClick = (noteId: number) => {
    if (onNavigateToNote) {
      onNavigateToNote(noteId);
      onClose();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>Mina AI Assistant</span>
          </DialogTitle>
          <DialogDescription>
            Ask anything about your notes
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4 border rounded-md bg-muted/20 mb-4 min-h-[300px] max-h-[400px]">
          {messages.slice(1).map((message, index) => (
            <div 
              key={index}
              className={`mb-4 ai-message ${
                message.role === "user" 
                  ? "bg-primary/10 ml-8 rounded-2xl p-4"
                  : "bg-secondary/30 mr-8 rounded-2xl p-4 shadow-sm"
              }`}
            >
              <div className="text-sm font-medium mb-1 flex items-center gap-2">
                {message.role === "user" ? (
                  <>
                    <span className="bg-primary/20 p-1 rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      Y
                    </span>
                    <span>You</span>
                  </>
                ) : (
                  <>
                    <span className="bg-primary text-white p-1 rounded-full w-5 h-5 flex items-center justify-center text-xs">
                      M
                    </span>
                    <span>Mina</span>
                  </>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap prose dark:prose-invert max-w-none">
                {message.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          
          {/* Display found notes */}
          {foundNotes.length > 0 && (
            <div className="mb-4 mr-8 rounded-2xl p-4 shadow-sm bg-secondary/10 border border-secondary/20">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <span>Found Notes</span>
              </div>
              <div className="space-y-2">
                {foundNotes.map((note) => (
                  <div 
                    key={note.id}
                    onClick={() => handleNoteClick(note.id)}
                    className="text-sm p-2 rounded-md bg-background/50 cursor-pointer hover:bg-primary/5 transition-colors border border-border"
                  >
                    <div className="font-medium">{note.title || "Untitled"}</div>
                    <div className="text-xs opacity-70 mt-1">{note.excerpt}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(note.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="bg-secondary/30 mr-8 rounded-2xl p-4 mb-4 shadow-sm ai-message">
              <div className="text-sm font-medium mb-1 flex items-center gap-2">
                <span className="bg-primary text-white p-1 rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  M
                </span>
                <span>Mina</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>
        
        <div className="flex items-start gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={clearConversation}
            className="mt-1 rounded-full hover:bg-destructive/10 hover:text-destructive"
            title="Clear conversation"
          >
            <XCircle className="h-4 w-4" />
          </Button>
          
          <Textarea
            placeholder="Ask about your notes (e.g., 'Find my note about chicken soup')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] rounded-xl focus:ring-1 focus:ring-primary/30 resize-none"
          />
          
          <Button 
            onClick={handleSendPrompt} 
            disabled={prompt.trim() === "" || isLoading}
            size="icon"
            className="mt-1 rounded-full bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 