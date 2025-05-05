import { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useNotes } from "@/hooks/useNotes";
import { useToast } from "@/hooks/use-toast";
import EditorToolbar from "@/components/EditorToolbar";
import AIAssistant from "@/components/AIAssistant";
import { Skeleton } from "@/components/ui/skeleton";

export default function NoteEditor() {
  const { activeNote, updateNote, isLoading, deleteActiveNote } = useNotes();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const quillRef = useRef<ReactQuill>(null);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  
  // Initialize editor with active note content when it changes
  useEffect(() => {
    if (activeNote) {
      setContent(activeNote.content);
      setTitle(activeNote.title);
    } else {
      setContent("");
      setTitle("");
    }
  }, [activeNote]);

  const extractTitle = (htmlContent: string) => {
    // Extract first line as title (remove HTML tags)
    const textContent = htmlContent.replace(/<\/?[^>]+(>|$)/g, "");
    const firstLine = textContent.split('\n')[0].trim();
    
    // Return first 50 chars of first line, or "Untitled" if empty
    return firstLine 
      ? (firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine)
      : "Untitled";
  };

  const handleContentChange = (value: string) => {
    // Update local state
    setContent(value);
    
    // Extract first line as title
    const newTitle = extractTitle(value);
    setTitle(newTitle);
    
    // Save changes with debounce
    handleSave(value, newTitle);

    // Log for debugging
    console.log("Content updated:", value.substring(0, 100));
  };

  // Debounced save logic
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleSave = (contentToSave: string, titleToSave: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    if (!activeNote) return;
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await updateNote(activeNote.id, {
          content: contentToSave,
          title: titleToSave,
        });
        setSaving(false);
      } catch (error) {
        setSaving(false);
        toast({
          title: "Failed to save note",
          description: "Your changes could not be saved",
          variant: "destructive",
        });
      }
    }, 1000);
  };

  const handleDeleteNote = async () => {
    if (!activeNote) return;
    
    try {
      await deleteActiveNote();
      toast({
        title: "Note deleted",
        description: "Your note has been deleted",
      });
    } catch (error) {
      toast({
        title: "Failed to delete note",
        description: "Your note could not be deleted",
        variant: "destructive",
      });
    }
  };
  
  const uploadImage = (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    return fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to upload image');
        }
        return response.json();
      })
      .then(data => {
        // Return the URL to be inserted into the editor
        return data.url;
      });
  };

  // Configure Quill modules
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false,
    },
    keyboard: {
      bindings: {
        tab: false,
      }
    }
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'image'
  ];

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!activeNote) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
        <div>
          <p className="mb-2">Select a note or create a new one</p>
          <p className="text-sm">Click the + button to create a new note</p>
        </div>
      </div>
    );
  }

  const handleAiAssistantToggle = () => {
    setAiAssistantOpen(!aiAssistantOpen);
  };
  
  const handleInsertAiText = (text: string) => {
    if (!quillRef.current) return;
    
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection();
    const position = range ? range.index : quill.getLength();
    
    // Insert with proper line break if needed
    if (position > 0 && !content.endsWith('\n')) {
      quill.insertText(position, '\n\n');
      quill.insertText(position + 2, text);
      quill.setSelection(position + 2 + text.length, 0);
    } else {
      quill.insertText(position, text);
      quill.setSelection(position + text.length, 0);
    }
    
    // Update content state to trigger save
    const updatedContent = quill.root.innerHTML;
    setContent(updatedContent);
    
    // Save changes with the updated content
    const newTitle = extractTitle(updatedContent);
    setTitle(newTitle);
    
    // Trigger save
    handleSave(updatedContent, newTitle);
    
    // Show a toast notification to confirm the AI text was added
    toast({
      title: "AI text added",
      description: "The AI-generated text has been added to your note",
    });
  };

  return (
    <>
      <EditorToolbar 
        onDelete={handleDeleteNote} 
        isSaving={saving}
        quillRef={quillRef}
        onAiAssistantToggle={handleAiAssistantToggle}
      />
      
      <div className="flex-1 overflow-y-auto note-editor bg-background">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={handleContentChange}
            modules={modules}
            formats={formats}
            placeholder="Start writing..."
            className="editor-container"
          />
        </div>
      </div>
      
      {saving && (
        <div className="p-1.5 text-xs font-medium text-center text-primary/80 bg-background/95 backdrop-blur-md fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 rounded-full shadow-sm border border-primary/10 transition-opacity duration-300">
          Saving...
        </div>
      )}
      
      <AIAssistant 
        open={aiAssistantOpen} 
        onClose={() => setAiAssistantOpen(false)}
        onInsertText={handleInsertAiText}
      />
    </>
  );
}
