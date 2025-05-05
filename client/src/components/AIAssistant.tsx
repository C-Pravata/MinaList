import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, SendHorizontal, Bot, XCircle, Sparkles, Lightbulb, RefreshCw, CopyCheck, PanelLeftClose } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useNotes } from "@/hooks/useNotes";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);
  
  // Suggested prompts for user to try
  const suggestedPrompts = [
    "Summarize this note for me",
    "Generate a to-do list template",
    "Give me some creative writing ideas",
    "Draft a professional email template"
  ];
  
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Copy text to clipboard and show feedback
  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="p-6 pb-0"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </span>
              </motion.div>
              <div className="flex flex-col">
                <span>Mina AI Assistant</span>
                <DialogDescription className="m-0 text-xs">
                  Powered by advanced AI to help with your notes
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>
        </motion.div>
        
        <motion.div 
          className="flex-1 overflow-y-auto p-6 min-h-[300px] max-h-[400px] border-y"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {messages.length <= 1 && (
            <motion.div 
              className="flex flex-col items-center justify-center h-full text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="h-12 w-12 text-primary/20 mb-3" />
              <h3 className="text-lg font-medium mb-2">How can I help you today?</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                I can help draft content, organize your thoughts, generate ideas, or provide information.
              </p>
              
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                {suggestedPrompts.map((prompt, idx) => (
                  <motion.div
                    key={prompt}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    className="relative"
                  >
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left h-auto py-2 pl-3 pr-8 whitespace-normal text-sm"
                      onClick={() => {
                        setPrompt(prompt);
                        // Focus on the textarea
                        document.querySelector('textarea')?.focus();
                      }}
                    >
                      <Lightbulb className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-primary/70" />
                      {prompt}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(prompt, idx)}
                    >
                      {copiedIndex === idx ? (
                        <CopyCheck className="h-3 w-3" />
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16 3H4V16H16V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 7H20V20H8V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          
          <AnimatePresence initial={false}>
            {messages.slice(1).map((message, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  delay: Math.min(index * 0.1, 0.3) 
                }}
                className={cn(
                  "mb-4 ai-message",
                  message.role === "user" 
                    ? "bg-primary/10 ml-12 rounded-2xl rounded-tr-sm p-4" 
                    : "bg-secondary/20 mr-12 rounded-2xl rounded-tl-sm p-4 shadow-sm"
                )}
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
                <div className="text-sm whitespace-pre-wrap">
                  {message.content}
                </div>
                
                {message.role === "assistant" && (
                  <motion.div 
                    className="flex justify-end mt-2 gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(message.content, index + 100)}
                      className="text-xs h-7 rounded-full"
                    >
                      <span className="flex items-center gap-1">
                        {copiedIndex === index + 100 ? (
                          <>
                            <CopyCheck className="h-3 w-3 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M16 3H4V16H16V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M8 7H20V20H8V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Copy
                          </>
                        )}
                      </span>
                    </Button>
                    
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
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          
          <AnimatePresence>
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-secondary/20 mr-12 rounded-2xl rounded-tl-sm p-4 mb-4 shadow-sm ai-message"
              >
                <div className="text-sm font-medium mb-1 flex items-center gap-2">
                  <span className="bg-primary text-white p-1 rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    M
                  </span>
                  <span>Mina</span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ 
                      rotate: [0, 360],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "linear"
                    }}
                  >
                    <Loader2 className="h-4 w-4 text-primary" />
                  </motion.div>
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm"
                  >
                    Thinking...
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div ref={bottomRef} />
        </motion.div>
        
        <motion.div 
          className="p-4 flex items-start gap-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={clearConversation}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
              title="Clear conversation"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={onClose}
              className="rounded-full"
              title="Close assistant"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 flex flex-col">
            <div className="relative">
              <Textarea
                placeholder="Ask Mina something..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[60px] rounded-xl focus:ring-1 focus:ring-primary/30 resize-none pr-12"
              />
              
              <Button 
                onClick={handleSendPrompt} 
                disabled={prompt.trim() === "" || isLoading}
                size="icon"
                className="absolute bottom-3 right-3 rounded-full bg-primary hover:bg-primary/90 h-8 w-8"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2 text-center">
              <Sparkles className="h-3 w-3 inline-block mr-1 text-primary/50" />
              Ask for help, ideas, or content suggestions for your notes
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}