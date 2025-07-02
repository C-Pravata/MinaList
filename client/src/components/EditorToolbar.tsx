import { useRef, useState, useEffect, useCallback } from "react";
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
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { ShareService } from "@/services/ShareService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getDeviceId } from "@/lib/deviceId";
import { Clipboard } from '@capacitor/clipboard';
import { API_BASE_URL } from '@/lib/queryClient';

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
  const [isRecording, setIsRecording] = useState(false);
  
  const uploadAndInsertImage = useCallback(async (file: File, quillInstance: any) => {
    console.log('[uploadAndInsertImage] Function called with Quill instance:', !!quillInstance);
    if (file) {
      console.log('[uploadAndInsertImage] Received file - Name:', file.name, 'Size:', file.size, 'Type:', file.type, 'Is File instance:', file instanceof File);
    } else {
      console.error('[uploadAndInsertImage] Received null or undefined file object.');
      return;
    }

    if (!quillInstance) {
      console.error('[uploadAndInsertImage] Quill instance is null or undefined.');
      return;
    }
    const range = quillInstance.getSelection(true);
    console.log('[uploadAndInsertImage] Current selection range:', range);

    const deviceId = String(getDeviceId());
    console.log('[uploadAndInsertImage] Using deviceId:', deviceId);

    // Determine the correct upload endpoint (production vs dev)
    const uploadEndpoint = API_BASE_URL ? `${API_BASE_URL}/api/upload` : '/api/upload';

    try {
      let imageUrl: string | null = null;

      if (Capacitor.isNativePlatform()) {
        console.log('[uploadAndInsertImage] Native platform detected. Using CapacitorHttp with Base64.');
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64DataUrl = reader.result as string;
            console.log('[uploadAndInsertImage] File converted to Base64. Length:', base64DataUrl.length);

            const options = {
              url: uploadEndpoint,
              method: 'POST',
              headers: {
                'x-device-id': deviceId,
                'Content-Type': 'application/json' // Sending JSON data now
              },
              data: { // Sending file info as JSON
                file_data_url: base64DataUrl,
                original_filename: file.name,
                original_filetype: file.type
              },
            };
            console.log('[uploadAndInsertImage] CapacitorHttp options (Base64):', { 
              url: options.url, 
              method: options.method, 
              headers: options.headers, 
              data: `JSON payload (dataURL length: ${base64DataUrl.length}, filename: ${file.name})` 
            });

            const response: HttpResponse = await CapacitorHttp.request(options);
            console.log('[uploadAndInsertImage] CapacitorHttp response status (Base64):', response.status);
            console.log('[uploadAndInsertImage] CapacitorHttp response data (Base64):', response.data);

            if (response.status >= 200 && response.status < 300) {
              if (response.data && response.data.url) {
                imageUrl = response.data.url;
                // Quill insertion will happen outside this async reader callback
              } else {
                console.error("CapacitorHttp (Base64): Image upload response did not contain a valid URL:", response.data);
                alert("CapacitorHttp (Base64): Image uploaded, but server did not return a valid image URL. Check console.");
                throw new Error("CapacitorHttp (Base64): Invalid image URL from server");
              }
            } else {
              let errorDetails = `CapacitorHttp (Base64): Upload failed with status: ${response.status}`;
              if (response.data) {
                errorDetails += ` - ${response.data.message || JSON.stringify(response.data)}`;
              }
              console.error(errorDetails);
              alert(`CapacitorHttp (Base64): Image upload failed: ${response.status}. Check console for details.`);
              throw new Error(errorDetails);
            }

            // After processing, insert into Quill
            if (imageUrl) {
              // Construct absolute URL for Quill when on native platform
              const absoluteImageUrl = API_BASE_URL
                ? `${API_BASE_URL}${imageUrl}`
                : imageUrl;
              
              console.log('[uploadAndInsertImage] Inserting into Quill with URL:', absoluteImageUrl);
              quillInstance.insertEmbed(range ? range.index : quillInstance.getLength(), 'image', absoluteImageUrl);
              if (range) {
                  quillInstance.setSelection(range.index + 1);
              }
            } else {
              console.error("[uploadAndInsertImage] imageUrl was not set after Base64 upload attempt.");
            }

          } catch (innerError) {
            // Handle errors from within reader.onloadend (e.g., CapacitorHttp.request failure)
            console.error('[uploadAndInsertImage] Error during Base64 upload/processing:', innerError);
            const errorMessage = innerError instanceof Error ? innerError.message : String(innerError);
            if (!errorMessage.includes('Upload failed') && !errorMessage.includes('Invalid image URL')) {
              alert('An unexpected error occurred during image upload (Base64). Please try again.');
            }
          }
        };

        reader.onerror = (error) => {
          console.error('[uploadAndInsertImage] FileReader error:', error);
          alert('Failed to read file for upload. Please try again.');
        };

        reader.readAsDataURL(file); // Start reading the file
        // Note: The actual Quill insertion will now happen asynchronously within reader.onloadend
        // The outer function will return before the upload completes.
        return; // Prevent further execution in the outer function for native path

      } else {
        console.log('[uploadAndInsertImage] Web platform detected. Using fetch with FormData.');
        const webFormData = new FormData(); // Re-define formData for web path
        webFormData.append('image', file);

        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'x-device-id': deviceId,
          },
          body: webFormData, // Use webFormData for fetch
        });

        if (!response.ok) {
          let errorDetails = `Fetch: Upload failed with status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetails += ` - ${errorData.message || JSON.stringify(errorData)}`;
          } catch (e) {
            try {
              const errorText = await response.text();
              errorDetails += ` - ${errorText}`;
            } catch (e2) { /* no-op */ }
          }
          console.error(errorDetails);
          alert(`Fetch: Image upload failed: ${response.statusText || 'Server error'}. Check console for details.`);
          throw new Error(errorDetails);
        }

        const data = await response.json();
        if (data && data.url) {
          imageUrl = data.url;
        } else {
          console.error("Fetch: Image upload response did not contain a valid URL:", data);
          alert("Fetch: Image uploaded, but server did not return a valid image URL. Check console.");
          throw new Error("Fetch: Invalid image URL from server");
        }
      }

      if (imageUrl) {
        quillInstance.insertEmbed(range ? range.index : quillInstance.getLength(), 'image', imageUrl);
        if (range) {
            quillInstance.setSelection(range.index + 1);
        }
      } else {
        console.error("[uploadAndInsertImage] imageUrl was not set after upload attempt.");
        throw new Error("Image URL not obtained after upload.");
      }

    } catch (error) {
      console.error('[uploadAndInsertImage] Full error object:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Image upload error in uploadAndInsertImage:', errorMessage);
      
      if (!errorMessage.includes('Upload failed') && !errorMessage.includes('Invalid image URL')) {
        alert('An unexpected error occurred during image upload. Please try again.');
      }
    }
  }, []);
  
  const handleFormat = (format: string) => {
    const quill = quillRef.current?.getEditor();
    quill?.format(format, !quill.getFormat()[format]);
  };
  
  const handleLink = (url: string) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    let normalizedUrl = url.trim();
    if (!normalizedUrl) {
      const currentRange = quill.getSelection();
      if (currentRange) {
        quill.formatText(currentRange.index, currentRange.length, 'link', false);
      }
      return;
    }

    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    quill.focus();
    const range = quill.getSelection();

    if (range) {
      if (range.length > 0) {
        quill.formatText(range.index, range.length, 'link', normalizedUrl);
      } else {
        quill.insertText(range.index, normalizedUrl, 'link', normalizedUrl);
        quill.setSelection(range.index + normalizedUrl.length, 0);
      }
    } else {
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
    console.log('[handleImageInsert] Add Image button clicked. Creating file input.');
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    
    input.onchange = async () => {
      console.log('[handleImageInsert] file input onchange event triggered.');
      if (input.files && input.files[0]) {
        const selectedFile = input.files[0];
        console.log('[handleImageInsert] Details for selectedFile - Name:', selectedFile.name, 'Size:', selectedFile.size, 'Type:', selectedFile.type, 'Is File instance:', selectedFile instanceof File);
        const quill = quillRef.current?.getEditor();
        if (quill) {
          console.log('[handleImageInsert] Quill instance found. Calling uploadAndInsertImage.');
          await uploadAndInsertImage(selectedFile, quill);
        } else {
          console.error('[handleImageInsert] Quill instance not found after file selection.');
        }
      } else {
        console.warn('[handleImageInsert] No files selected or input.files is null.');
      }
    };
  };
  
  const handleSpeechRecognitionToggle = async () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    if (isRecording) {
      // Currently recording, so stop it
      try {
        if (Capacitor.isNativePlatform()) {
          await SpeechRecognition.stop();
          console.log('[SpeechRecognition] Stopped via button toggle (Native).');
        } else {
          // @ts-ignore
          if (window.webkitSpeechRecognitionInstance) {
            // @ts-ignore
            window.webkitSpeechRecognitionInstance.stop();
            console.log('[SpeechRecognition] Stopped via button toggle (Web).');
          }
        }
      } catch (error) {
        console.error('[SpeechRecognition] Error stopping recognition:', error);
        // Don't alert here, just log, as the main goal is to stop UI-wise
      }
      setIsRecording(false);
      return;
    }

    // Not recording, so start it
    setIsRecording(true); // Optimistically set to true, will revert on error

    if (Capacitor.isNativePlatform()) {
      try {
        const available = await SpeechRecognition.available();
        if (!available) {
          alert('Speech recognition is not available on this device.');
          setIsRecording(false);
          return;
        }

        let hasPermission = (await SpeechRecognition.checkPermissions()).speechRecognition === 'granted';
        if (!hasPermission) {
          const permissionResult = await SpeechRecognition.requestPermissions();
          hasPermission = permissionResult.speechRecognition === 'granted';
        }

        if (!hasPermission) {
          alert('Microphone and Speech Recognition permission is required for voice input.');
          setIsRecording(false);
          return;
        }
        
        SpeechRecognition.removeAllListeners(); 

        // Variables to manage native partial results replacement
        let currentNativePartialText = "";
        let nativePartialTextStartIndex: number | null = null;
        let initialSelectionDone = false;

        SpeechRecognition.addListener("partialResults", (data: any) => {
          if (data.matches && data.matches.length > 0) {
            const newTranscript = data.matches[0]; // This is the full current best guess
            const currentSelection = quill.getSelection(); // Get current selection/cursor

            if (!initialSelectionDone) {
                // On the very first partial result, establish the start index
                nativePartialTextStartIndex = currentSelection ? currentSelection.index : quill.getLength();
                initialSelectionDone = true;
            }
            
            // Ensure nativePartialTextStartIndex is not null (it should be set by now)
            if (nativePartialTextStartIndex === null) {
                nativePartialTextStartIndex = currentSelection ? currentSelection.index : quill.getLength(); // Fallback
            }

            // Delete the old partial text if it exists
            if (currentNativePartialText.length > 0) {
              quill.deleteText(nativePartialTextStartIndex, currentNativePartialText.length);
            }

            // Insert the new, updated partial text
            quill.insertText(nativePartialTextStartIndex, newTranscript);
            currentNativePartialText = newTranscript; // Update stored transcript

            // Set selection to the end of the inserted text
            quill.setSelection(nativePartialTextStartIndex + newTranscript.length);
          }
        });
        
        // Add listener for listening state changes (optional, but can be useful)
        SpeechRecognition.addListener("listeningState", (data: any) => {
          console.log('[SpeechRecognition] Listening state changed:', data.status);
          if (data.status === "stopped" && isRecording) {
            // If the OS/plugin stops it for some reason (e.g. silence timeout not handled by this plugin version)
            // and we are still in recording state, reset it.
            console.log('[SpeechRecognition] Recording stopped by OS/plugin, resetting state.');
            setIsRecording(false);
          }
        });

        await SpeechRecognition.start({
          language: "en-US",
          maxResults: 1, 
          prompt: "Say something...",
          partialResults: true,
          popup: false, 
        });
        console.log('[SpeechRecognition] Started (Native).');
        // setIsRecording(true) already set optimistically

      } catch (error: any) {
        console.error('Capacitor Speech Recognition error on start:', error);
        // Check for the specific retry error, otherwise show generic
        if (error && error.message && error.message.toLowerCase().includes('retry')) {
          alert('Speech recognition service is busy. Please try again in a moment.');
        } else {
          alert('Could not start speech recognition. Please ensure microphone access is allowed.');
        }
        setIsRecording(false);
      }
    } else {
      // Web platform: Use existing webkitSpeechRecognition
      if (!('webkitSpeechRecognition' in window)) {
        alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
        setIsRecording(false);
        return;
      }
      
      // @ts-ignore
      const recognition = new window.webkitSpeechRecognition();
      // @ts-ignore 
      window.webkitSpeechRecognitionInstance = recognition; // Store instance to stop it

      recognition.continuous = true; 
      recognition.interimResults = true;
      let lastInsertedLength = 0; 
    
      recognition.onresult = (event: any) => {
        const range = quill.getSelection();
        if (range && isRecording) { // Check isRecording state here too
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              if (lastInsertedLength > 0) {
                quill.deleteText(range.index - lastInsertedLength, lastInsertedLength);
              }
              quill.insertText(range.index - lastInsertedLength, transcript + ' ');
              quill.setSelection(range.index - lastInsertedLength + transcript.length + 1);
              lastInsertedLength = 0; 
              // For continuous web, it might keep going. We rely on user to stop.
              return; // Process final and wait for next
            }
          }
          // Interim results handling
          if (lastInsertedLength > 0) {
            quill.deleteText(range.index - lastInsertedLength, lastInsertedLength);
          }
          quill.insertText(range.index - lastInsertedLength, transcript);
          lastInsertedLength = transcript.length;
        }
      };
    
      recognition.onerror = (event: any) => {
        console.error('Web Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('Microphone access denied or speech service not allowed. Please check browser permissions.');
        }
        setIsRecording(false);
        // @ts-ignore
        window.webkitSpeechRecognitionInstance = null;
      };

      recognition.onend = () => {
         console.log('[SpeechRecognition] Ended (Web).');
         // If it ends unexpectedly and wasn't stopped by user, reset state.
         if (isRecording) { // Only set if it wasn't an intentional stop
            setIsRecording(false);
         }
         // @ts-ignore
         window.webkitSpeechRecognitionInstance = null;
      };
      
      try {
        recognition.start();
        console.log('[SpeechRecognition] Started (Web).');
        // setIsRecording(true) already set
      } catch (e) {
        console.error('Error starting Web Speech API:', e);
        alert('Failed to start speech recognition in browser.');
        setIsRecording(false);
      }
    }
  };
  
  const handleShareNote = async () => {
    try {
      if (!quillRef.current) return;
      
      const quill = quillRef.current.getEditor();
      const content = quill.getText();
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

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (quill && Capacitor.isNativePlatform()) {
      const handleNativePaste = async (event: ClipboardEvent) => {
        console.log('[Native Paste] Event triggered');
        try {
          console.log('[Native Paste] Attempting Clipboard.read()');
          const clipboardRead = await Clipboard.read();
          console.log('[Native Paste] Clipboard.read() result:', JSON.stringify(clipboardRead, null, 2));

          if (clipboardRead.type.startsWith('image/') && clipboardRead.value) {
            console.log('[Native Paste] Image type detected on clipboard:', clipboardRead.type);
            event.preventDefault(); 
            event.stopPropagation(); 

            let file: File | null = null;
            if (clipboardRead.value.startsWith('data:image')) {
              console.log('[Native Paste] Image is a data URL. Converting to File.');
              const fetchRes = await fetch(clipboardRead.value);
              const blob = await fetchRes.blob();
              const extension = clipboardRead.type.split('/')[1] || 'png';
              const fileName = `pasted_image_${Date.now()}.${extension}`;
              file = new File([blob], fileName, { type: blob.type });
              console.log('[Native Paste] File object created from data URL:', file);
            } else if (clipboardRead.value.startsWith('file://')) {
              console.warn("[Native Paste] Pasted image is a file URI. This path is not fully implemented for direct upload yet. URI:", clipboardRead.value);
            } else {
               console.warn('[Native Paste] Clipboard image value is not a data URL or recognized file URI:', clipboardRead.value.substring(0, 100) + '...');
            }

            if (file) {
              console.log('[Native Paste] Attempting to upload and insert image file.');
              await uploadAndInsertImage(file, quill);
              console.log('[Native Paste] Image upload and insert process completed.');
            } else {
                console.warn("[Native Paste] No file object was created for upload.");
            }
          } else {
            console.log('[Native Paste] Clipboard content is not an image or value is missing. Type:', clipboardRead.type, 'Value exists:', !!clipboardRead.value);
          }
        } catch (err) {
          console.error('[Native Paste] Error during Clipboard.read() or processing:', err);
        }
      };

      quill.root.addEventListener('paste', handleNativePaste, true); 
      console.log('[Native Paste] Listener attached to Quill root.');

      return () => {
        quill.root.removeEventListener('paste', handleNativePaste, true);
        console.log('[Native Paste] Listener removed from Quill root.');
      };
    } else {
      if (Capacitor.isNativePlatform()) {
        console.log('[Native Paste] Quill instance not available. Listener not attached.');
      }
    }
  }, [quillRef, uploadAndInsertImage]);
  
  // Cleanup speech recognition listeners when component unmounts
  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform()) {
        SpeechRecognition.removeAllListeners();
      }
      // For web, if recognition instance exists, stop it
      // @ts-ignore
      if (window.webkitSpeechRecognitionInstance) {
        // @ts-ignore
        window.webkitSpeechRecognitionInstance.stop();
        // @ts-ignore
        window.webkitSpeechRecognitionInstance = null;
      }
    };
  }, []); // Empty dependency array means this runs once on mount and unmount

  return (
    <TooltipProvider>
      <div className="editor-toolbar bg-background/80 backdrop-blur-md border-b border-border py-1 px-4 flex items-center justify-between gap-2 sticky top-0 z-10">
        <div className="flex items-center flex-nowrap gap-x-1 overflow-x-auto no-scrollbar flex-grow"> 
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
        
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-9 w-9 rounded-full hover:bg-secondary/40 flex items-center justify-center ${isRecording ? 'text-primary bg-primary/10' : 'text-foreground/80 hover:text-foreground'}`}
                onClick={handleSpeechRecognitionToggle}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isRecording ? "Stop Listening" : "Voice to Text"}
            </TooltipContent>
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
        </div>
          
        <div className="flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-10 w-10 rounded-full text-primary hover:bg-primary/10 flex items-center justify-center p-1.5"
                onClick={onAiAssistantToggle}
                aria-label="AI Assistant"
              >
                <img 
                  src="/assets/MinaIcon.svg" 
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
