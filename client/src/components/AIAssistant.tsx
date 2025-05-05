import { useState, useRef } from "react";
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
      // For now, we'll handle AI responses with a simulated response
      // In a real app, this would connect to the OpenAI API
      setTimeout(() => {
        const assistantMessage: Message = {
          role: "assistant",
          content: getSimulatedResponse(prompt)
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        
        // Scroll to bottom
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }, 1000);
      
      // For future OpenAI integration:
      // const aiChatData = { note_id: activeNote?.id, messages: [...messages, userMessage] };
      // const response = await apiRequest("POST", "/api/ai/chat", aiChatData);
      // const data = await response.json();
      // setMessages(prev => [...prev, data.message]);
    } catch (error) {
      toast({
        title: "AI Assistant Error",
        description: "Failed to get a response from the AI assistant",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const getSimulatedResponse = (prompt: string): string => {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes("hello") || lowerPrompt.includes("hi")) {
      return "Hello! I'm Mina, your note-taking assistant. How can I help you today?";
    } else if (lowerPrompt.includes("help") || lowerPrompt.includes("what can you do")) {
      return "I can help you with your notes by answering questions, drafting content, or organizing information. What would you like assistance with?";
    } else if (lowerPrompt.includes("summarize") || lowerPrompt.includes("summary")) {
      return "I'd be happy to summarize your note. To provide a good summary, I'd need to see the content you want summarized first.";
    } else if (lowerPrompt.includes("idea") || lowerPrompt.includes("suggestion")) {
      return "Here are some ideas for your note:\n- Add a clear heading structure\n- Include bullet points for key ideas\n- Add relevant images\n- Use formatting to highlight important concepts";
    } else {
      return "I understand what you're asking. When the app is connected to an AI service like OpenAI, I'll be able to provide more personalized responses to your specific questions.";
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
              className={`mb-4 ${
                message.role === "user" 
                  ? "bg-primary/10 ml-8 rounded-lg p-3"
                  : "bg-secondary/20 mr-8 rounded-lg p-3"
              }`}
            >
              <div className="text-sm font-medium mb-1">
                {message.role === "user" ? "You" : "Mina"}
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {message.content}
              </div>
              
              {message.role === "assistant" && (
                <div className="flex justify-end mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInsert(message.content)}
                    className="text-xs h-7"
                  >
                    Insert into note
                  </Button>
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="bg-secondary/20 mr-8 rounded-lg p-3 mb-4">
              <div className="text-sm font-medium mb-1">Mina</div>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>
        
        <div className="flex items-start gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={clearConversation}
            className="mt-1"
          >
            <XCircle className="h-4 w-4" />
          </Button>
          
          <Textarea
            placeholder="Ask Mina something..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px]"
          />
          
          <Button 
            onClick={handleSendPrompt} 
            disabled={prompt.trim() === "" || isLoading}
            size="icon"
            className="mt-1"
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