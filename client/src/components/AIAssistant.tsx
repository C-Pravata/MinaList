import { useState, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, SendHorizontal, Bot, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useNotes } from "@/hooks/useNotes";

interface AIAssistantProps {
  open: boolean;
  onClose: () => void;
  onInsertText: (text: string) => void;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export default function AIAssistant({ open, onClose, onInsertText }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "You are Mina, a helpful AI assistant for a note-taking app. Be concise and helpful."
    }
  ]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { activeNote } = useNotes();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSendPrompt = async () => {
    if (!prompt.trim() || isLoading) return;
    
    const userMessage: Message = { role: "user", content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setIsLoading(true);

    try {
      // Send request to our backend API, which will forward to Gemini
      const aiChatData = { messages: [...messages, userMessage] };
      const response = await apiRequest("POST", "/api/ai/chat", aiChatData);
      const data = await response.json();
      
      // Add the AI response to our messages
      setMessages(prev => [...prev, data.message]);
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

  const handleInsert = (text: string) => {
    onInsertText(text);
    toast({
      title: "Text inserted",
      description: "AI response has been added to your note",
    });
    onClose();
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
      content: "You are Mina, a helpful AI assistant for a note-taking app. Be concise and helpful."
    }]);
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
            Ask anything to help with your notes
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
              
              {message.role === "assistant" && (
                <div className="flex justify-end mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleInsert(message.content)}
                    className="text-xs h-7 rounded-full"
                  >
                    <span className="flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L19 9M19 9H5M19 9V15M5 9L12 2M5 9V15M12 22L5 15M12 22L19 15" 
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Insert into note
                    </span>
                  </Button>
                </div>
              )}
            </div>
          ))}
          
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
            placeholder="Ask Mina something..."
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