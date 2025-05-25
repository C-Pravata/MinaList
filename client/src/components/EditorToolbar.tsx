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
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { ShareService } from "@/services/ShareService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getDeviceId } from "@/lib/deviceId";

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
            const deviceId = getDeviceId();

            const response = await fetch('/api/upload', {
              method: 'POST',
              headers: {
                'x-device-id': deviceId,
                // 'Content-Type' is not needed here; browser sets it for FormData with boundary
              },
              body: formData,
            });
            
            if (!response.ok) {
              let errorDetails = `Upload failed with status: ${response.status}`;
              try {
                const errorData = await response.json(); // Try to parse as JSON
                errorDetails += ` - ${errorData.message || JSON.stringify(errorData)}`;
              } catch (e) {
                // If not JSON, try to get as text
                try {
                  const errorText = await response.text();
                  errorDetails += ` - ${errorText}`;
                } catch (e2) {
                  // If text also fails, just use the status
                }
              }
              console.error(errorDetails);
              alert(`Image upload failed: ${response.statusText || 'Server error'}. Check console for details.`); // Basic user feedback
              throw new Error(errorDetails);
            }
            
            const data = await response.json();
            if (data && data.url) { // Check if data.url exists
            if (range) {
              quill.insertEmbed(range.index, 'image', data.url);
              } else {
                // If no range (editor not focused?), append to the end or handle appropriately
                const currentLength = quill.getLength();
                quill.insertEmbed(currentLength, 'image', data.url);
                console.warn("Quill editor was not focused. Image inserted at the end.");
              }
            } else {
              console.error("Image upload response did not contain a valid URL:", data);
              alert("Image uploaded, but server did not return a valid image URL. Check console.");
              throw new Error("Invalid image URL from server");
            }
          } catch (error) {
            console.error('Image upload error:', error);
            // alert('Failed to upload image. See console for details.'); // Already alerted for response.ok or data.url issues
            if (!(error instanceof Error && error.message.startsWith('Upload failed')) && !(error instanceof Error && error.message.startsWith('Invalid image URL'))) {
                alert('An unexpected error occurred during image upload. Please try again.');
            }
          }
        }
      }
    };
  };
  
  const startSpeechRecognition = async () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    if (Capacitor.isNativePlatform()) {
      // Native platform: Use Capacitor plugin
      try {
        const available = await SpeechRecognition.available();
        if (!available) {
          alert('Speech recognition is not available on this device.');
          return;
        }

        const hasPermission = await SpeechRecognition.checkPermissions();
        if (hasPermission.speechRecognition !== 'granted') {
          const permissionResult = await SpeechRecognition.requestPermissions();
          if (permissionResult.speechRecognition !== 'granted') {
            alert('Microphone and Speech Recognition permission is required for voice input.');
            return;
          }
        }

        // Add listener for partial results
        SpeechRecognition.addListener("partialResults", (data: any) => {
          if (data.matches && data.matches.length > 0) {
            const transcript = data.matches[0]; // Get the most likely transcript
            // This is tricky: Web API inserts as you speak, plugin might give full phrases.
            // For now, let's assume we want to append if there's a selection or insert at cursor.
            const range = quill.getSelection();
            if (range) {
              // Potentially clear previous partial result if an existing one is being built
              // This part needs careful handling based on how partial results are delivered.
              // For simplicity, we'll just insert.
              quill.insertText(range.index, transcript + ' ');
              quill.setSelection(range.index + transcript.length + 1);
            }
          }
        });

        await SpeechRecognition.start({
          language: "en-US",
          maxResults: 1, // We usually want the best single match for dictation
          prompt: "Say something...", // Android only
          partialResults: true,
          popup: false, // Android only, use false for inline experience
        });

        // Consider adding a way to stop listening, e.g., tapping the button again
        // or a timeout like the web version had.
        // For now, it might stop on silence or require a manual stop call if you add one.

      } catch (error) {
        console.error('Capacitor Speech Recognition error:', error);
        alert('Could not start speech recognition.');
      }
    } else {
      // Web platform: Use existing webkitSpeechRecognition
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }
    
    // @ts-ignore - This is a browser API
    const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true; // Keep listening
    recognition.interimResults = true;
      let lastInsertedLength = 0; // To handle overwriting interim results
    
    recognition.onresult = (event: any) => {
        const range = quill.getSelection();
        if (range) {
          let transcript = '';
          let isFinal = false;
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              isFinal = true;
            }
          }

          // Delete the previous interim result
          if (lastInsertedLength > 0) {
            quill.deleteText(range.index - lastInsertedLength, lastInsertedLength);
          }
          
          quill.insertText(range.index - lastInsertedLength, transcript);
          lastInsertedLength = transcript.length;

          if (isFinal) {
            quill.insertText(range.index - lastInsertedLength + transcript.length, ' '); // Add space after final
            quill.setSelection(range.index - lastInsertedLength + transcript.length + 1);
            lastInsertedLength = 0; // Reset for next final phrase
        }
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      recognition.stop();
        lastInsertedLength = 0;
      };

      recognition.onend = () => {
         // You might want to change the button state here
         lastInsertedLength = 0;
    };
    
    recognition.start();
      // Consider a visual cue that it's listening and a way to stop it.
      // The original timeout is removed for continuous mode.
    }
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
        {/* Combined group for all formatting, insert, and action icons */}
        <div className="flex items-center flex-nowrap gap-x-1 overflow-x-auto no-scrollbar flex-grow"> 
          {/* Basic Formatting */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleHeader()}
                className="h-9 w-9 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
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
                className="h-9 w-9 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
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
                className="h-9 w-9 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
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
                className="h-9 w-9 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Bullet List</TooltipContent>
          </Tooltip>
        
        {/* Insert options group */}
          <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 w-9 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
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
                className="h-9 w-9 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
                onClick={handleImageInsert}
              >
                <Image className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Add Image</TooltipContent>
          </Tooltip>
        
        {/* AI, Voice & Share section */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
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
                className="h-9 w-9 rounded-full text-foreground/80 hover:bg-secondary/40 hover:text-foreground flex items-center justify-center"
                onClick={handleShareNote}
              >
                <Share className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Share Note</TooltipContent>
          </Tooltip>
        </div> {/* End of the scrollable icon group */}
          
        {/* AI Assistant button - kept separate to be on the far right and potentially not scroll */}
        <div className="flex-shrink-0"> {/* Prevents this div from shrinking */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" // size="sm" might be overridden by h-X w-X
                className="h-10 w-10 rounded-full text-primary hover:bg-primary/10 flex items-center justify-center p-1.5" // Kept AI button slightly larger
                onClick={onAiAssistantToggle}
                aria-label="AI Assistant"
              >
                <img 
                  src="/MinaIcon.svg" 
                  alt="Mina" 
                  className="h-full w-full object-contain aspect-square" 
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
