import { useRef, useState } from "react";
import { 
  Bold, 
  Italic, 
  Underline, 
  Link as LinkIcon, 
  Image, 
  List,
  Heading1,
  Trash2,
  Mic,
  AlignLeft,
  MessageSquareText,
  Share
} from "lucide-react";
import { ShareService } from "@/services/ShareService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EditorToolbarProps {
  onDelete: () => void;
  isSaving: boolean;
  quillRef: React.RefObject<any>;
  onAiAssistantToggle?: () => void;
  activeNoteTitle?: string;
}

export default function EditorToolbar({ onDelete, isSaving, quillRef, onAiAssistantToggle, activeNoteTitle }: EditorToolbarProps) {
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  
  const handleFormat = (format: string) => {
    const quill = quillRef.current?.getEditor();
    quill?.format(format, !quill.getFormat()[format]);
  };
  
  const handleLink = (url: string) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    let normalizedUrl = url.trim();
    if (!normalizedUrl) {
      // If URL is empty, attempt to unlink any existing link at the selection
      const currentRange = quill.getSelection();
      if (currentRange) {
        quill.formatText(currentRange.index, currentRange.length, 'link', false);
      }
      return;
    }

    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    quill.focus(); // Ensure the editor has focus before attempting to get selection or insert
    const range = quill.getSelection();

    if (range) {
      if (range.length > 0) {
        // Text is selected, format it as a link
        quill.formatText(range.index, range.length, 'link', normalizedUrl);
      } else {
        // No text is selected, insert the URL as the link text
        quill.insertText(range.index, normalizedUrl, 'link', normalizedUrl);
        quill.setSelection(range.index + normalizedUrl.length, 0);
      }
    } else {
      // Fallback if range is still null after focusing (should be rare)
      const currentLength = quill.getLength();
      quill.insertText(currentLength, normalizedUrl, 'link', normalizedUrl);
      quill.setSelection(currentLength + normalizedUrl.length, 0);
    }
  };
  
  const handleListFormat = (format: 'bullet') => {
    const quill = quillRef.current?.getEditor();
    const formats = quill?.getFormat();
    
    if (formats && formats.list === format) {
      quill?.format('list', false);
    } else {
      quill?.format('list', format);
    }
  };
  
  const handleHeader = () => {
    const quill = quillRef.current?.getEditor();
    const formats = quill?.getFormat();
    
    if (formats && formats.header === 1) {
      quill?.format('header', false);
    } else {
      quill?.format('header', 1);
    }
  };

  const handleImageInsert = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    
    input.onchange = async () => {
      if (input.files && input.files[0]) {
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection();
          const file = input.files[0];
          
          // Create form data for upload
          const formData = new FormData();
          formData.append('image', file);
          
          try {
            const response = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });
            
            if (!response.ok) {
              throw new Error('Upload failed');
            }
            
            const data = await response.json();
            if (range) {
              quill.insertEmbed(range.index, 'image', data.url);
            }
          } catch (error) {
            console.error('Image upload error:', error);
          }
        }
      }
    };
  };
  
  const startSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }
    
    // @ts-ignore - This is a browser API
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onresult = (event: any) => {
      const quill = quillRef.current?.getEditor();
      if (quill) {
        const range = quill.getSelection();
        if (range) {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              const transcript = event.results[i][0].transcript;
              quill.insertText(range.index, transcript + ' ');
              quill.setSelection(range.index + transcript.length + 1);
            }
          }
        }
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      recognition.stop();
    };
    
    recognition.start();
    setTimeout(() => {
      recognition.stop();
    }, 10000); // Stop after 10 seconds
  };
  
  // Handle sharing note content using the ShareService
  const handleShareNote = async () => {
    try {
      if (!quillRef.current) return;
      
      const quill = quillRef.current.getEditor();
      const content = quill.getText(); // Get plain text content
      const title = activeNoteTitle || 'My Note';
      
      await ShareService.share({
        title: title,
        text: content,
        dialogTitle: 'Share note from Mina'
      });
      
    } catch (error) {
      console.error('Error sharing note:', error);
    }
  };

  return (
    <TooltipProvider>
      <div className="editor-toolbar bg-background/80 backdrop-blur-md border-b border-border py-1 px-4 flex items-center justify-between gap-2 sticky top-0 z-10">
        {/* Only essential formatting options */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleHeader()}
                className="h-8 w-8 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
              >
                <Heading1 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Heading</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleFormat('bold')}
                className="h-8 w-8 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Bold</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleFormat('italic')}
                className="h-8 w-8 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Italic</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleListFormat('bullet')}
                className="h-8 w-8 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Bullet List</TooltipContent>
          </Tooltip>
        </div>
        
        {/* Insert options group */}
        <div className="flex items-center space-x-1.5">
          <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
                    onClick={() => setIsLinkDialogOpen(true)}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Insert Link</TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Insert Link</DialogTitle>
              </DialogHeader>
              <div className="flex items-center space-x-2 py-4">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="link-url" className="sr-only">
                    Link URL
                  </Label>
                  <Input
                    id="link-url"
                    ref={linkInputRef}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <Button 
                type="button"
                className="w-full"
                onClick={() => {
                  if (linkInputRef.current && linkInputRef.current.value) {
                    handleLink(linkInputRef.current.value);
                    setIsLinkDialogOpen(false);
                  }
                }}
              >
                Add Link
              </Button>
            </DialogContent>
          </Dialog>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
                onClick={handleImageInsert}
              >
                <Image className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Add Image</TooltipContent>
          </Tooltip>
        </div>
        
        {/* AI, Voice & Share section */}
        <div className="flex items-center space-x-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
                onClick={startSpeechRecognition}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Voice to Text</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
                onClick={handleShareNote}
              >
                <Share className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Share Note</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-11 w-11 rounded-full text-primary hover:bg-primary/10 flex items-center justify-center p-2"
                onClick={onAiAssistantToggle}
                aria-label="AI Assistant"
              >
                <img 
                  src="/MinaIcon.svg" 
                  alt="Mina" 
                  className="h-9 w-9 object-contain aspect-square" 
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">AI Assistant</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
