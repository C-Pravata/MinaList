import { useState, useEffect, useRef } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import MarkdownShortcuts from 'quill-markdown-shortcuts';
import { useNotes } from "@/hooks/useNotes";
import { useToast } from "@/hooks/use-toast";
import EditorToolbar from "@/components/EditorToolbar";
import AIAssistant from "@/components/AIAssistant";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/lib/queryClient";

// Register the Markdown shortcuts module with Quill
Quill.register('modules/markdownShortcuts', MarkdownShortcuts);

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
      const isNewBlankNote = activeNote.title === "" && activeNote.content === "";

      if (isNewBlankNote) {
        setContent("");
        setTitle("");
        if (quillRef.current) {
          const editor = quillRef.current.getEditor();
          editor.root.innerHTML = ""; // Directly set innerHTML to blank
        }
      } else {
        setContent(activeNote.content || "");
        setTitle(activeNote.title || "");
        // If existing content is blank, ensure editor visually reflects this too
        if (quillRef.current && !activeNote.content) {
            quillRef.current.getEditor().root.innerHTML = "";
        }
      }
    } else {
      setContent("");
      setTitle("");
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        editor.root.innerHTML = ""; // Directly set innerHTML to blank
      }
    }
  }, [activeNote]);

  const handleContentChange = (value: string) => {
    setContent(value);
    
    let newTitle = "Untitled";
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const editorFullText = editor.getText();
      const lines = editorFullText.split('\n');
      
      let firstNonEmptyLine = "";
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine !== "") {
          firstNonEmptyLine = trimmedLine;
          break;
        }
      }

      if (firstNonEmptyLine) {
        newTitle = firstNonEmptyLine.length > 100 // Increased max title length a bit
          ? firstNonEmptyLine.substring(0, 100) + "..." 
          : firstNonEmptyLine;
      } else {
        newTitle = "Untitled"; // Default if all lines are empty or only whitespace
      }
    }
    setTitle(newTitle);
    handleSave(value, newTitle);
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
        // console.log("Note auto-saved successfully."); // Optional: log success if needed
      } catch (error) {
        setSaving(false);
        console.error("Failed to auto-save note:", error);
        // toast({
        //   title: "Failed to save note",
        //   description: "Your changes could not be saved",
        //   variant: "destructive",
        // });
      }
    }, 1000);
  };

  const handleDeleteNote = async () => {
    if (!activeNote) return;
    
    try {
      await deleteActiveNote();
      console.log("Note deleted successfully from editor.");
      // toast({
      //   title: "Note deleted",
      //   description: "Your note has been deleted",
      // });
    } catch (error) {
      // Error handling for deleteActiveNote is in notesContext, uses console.error
      // console.error("Failed to delete note from editor:", error); // Already handled by context
    }
  };
  
  const uploadImage = (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    const uploadUrl = API_BASE_URL ? `${API_BASE_URL}/api/upload` : '/api/upload';

    return fetch(uploadUrl, {
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
      ['link', 'image', 'blockquote', 'code-block'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false,
    },
    keyboard: {
      bindings: {
        tab: false,
      }
    },
    markdownShortcuts: {},
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'image', 'blockquote', 'code-block'
  ];

  // Define placeholder text
  const placeholderText = "Start writing...";

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
    
    if (position > 0 && !content.endsWith('\n')) {
      quill.insertText(position, '\n\n');
      quill.insertText(position + 2, text);
      quill.setSelection(position + 2 + text.length, 0);
    } else {
      quill.insertText(position, text);
      quill.setSelection(position + text.length, 0);
    }
    
    const updatedContent = quill.root.innerHTML;
    setContent(updatedContent);
    
    // Consistent title extraction after AI text insertion
    let newTitleFromAI = "Untitled";
    const editorFullTextAfterAI = quill.getText();
    const linesAfterAI = editorFullTextAfterAI.split('\n');
    
    let firstNonEmptyLineAfterAI = "";
    for (const line of linesAfterAI) {
      const trimmedLine = line.trim();
      if (trimmedLine !== "") {
        firstNonEmptyLineAfterAI = trimmedLine;
        break;
      }
    }

    if (firstNonEmptyLineAfterAI) {
      newTitleFromAI = firstNonEmptyLineAfterAI.length > 100
        ? firstNonEmptyLineAfterAI.substring(0, 100) + "..."
        : firstNonEmptyLineAfterAI;
    } else {
      newTitleFromAI = "Untitled";
    }
    setTitle(newTitleFromAI);
    handleSave(updatedContent, newTitleFromAI);
    
    console.log("AI text added to note.");
    // toast({
    //   title: "AI text added",
    //   description: "The AI-generated text has been added to your note",
    // });
  };

  return (
    <>
      <EditorToolbar 
        onDelete={handleDeleteNote} 
        isSaving={saving}
        quillRef={quillRef}
        onAiAssistantToggle={handleAiAssistantToggle}
        activeNoteTitle={title}
      />
      
      <div className="flex-1 overflow-y-auto note-editor bg-background">
        <div className="max-w-2xl mx-auto px-6 pt-4 pb-32">
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
