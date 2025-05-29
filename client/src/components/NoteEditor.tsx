import { useState, useEffect, useRef } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import MarkdownShortcuts from 'quill-markdown-shortcuts';
import { useNotesContext } from "@/lib/notesContext";
import { useToast } from "@/hooks/use-toast";
import EditorToolbar from "@/components/EditorToolbar";
import AIAssistant from "@/components/AIAssistant";
import { Skeleton } from "@/components/ui/skeleton";

// Register the Markdown shortcuts module with Quill
Quill.register('modules/markdownShortcuts', MarkdownShortcuts);

export default function NoteEditor() {
  const {
    activeNote,
    updateNote,
    isLoading,
    deleteActiveNote,
    pendingImageForNewNote,
    setPendingImageForNewNote
  } = useNotesContext();
  // Use a state for content that is explicitly set from activeNote.content
  // ReactQuill will use this as its `value`.
  const [editorContent, setEditorContent] = useState(""); 
  const [title, setTitle] = useState("");
  const quillRef = useRef<ReactQuill>(null);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  
  useEffect(() => {
    if (activeNote) {
      setEditorContent(activeNote.content || ""); // This will be "" for new shared images
      setTitle(activeNote.title || "");

      if (pendingImageForNewNote && 
          pendingImageForNewNote.noteId === activeNote.id && 
          quillRef.current) {
        
        const editor = quillRef.current.getEditor();
        console.log("NoteEditor: Pending image found. Embedding:", pendingImageForNewNote.imagePath);
        
        // Editor should be blank here because activeNote.content was ""
        // and ReactQuill was re-keyed with value="".
        editor.insertEmbed(0, 'image', pendingImageForNewNote.imagePath);
        
        const newContentFromEmbed = editor.root.innerHTML;
        const newTitleFromEmbed = activeNote.title || "Shared Image"; 
        
        setEditorContent(newContentFromEmbed); // Update state to reflect embedded image
        setTitle(newTitleFromEmbed);

        setPendingImageForNewNote(null);

        setTimeout(() => {
          handleSave(newContentFromEmbed, newTitleFromEmbed);
          console.log("NoteEditor: Save triggered for embedded image.");
        }, 100);
      }
    } else {
      setEditorContent("");
      setTitle("");
    }
  // Ensure all dependencies that could trigger re-evaluation of this logic are included.
  // `handleSave` is not directly called here but is part of the flow initiated here.
  // If `handleSave` itself depends on something not listed, it might use stale closures.
  // However, `handleSave` uses `activeNote` from context, which IS a dependency.
  }, [activeNote, pendingImageForNewNote, setPendingImageForNewNote, isLoading]); 

  const handleContentChange = (newContent: string, delta: any, source: any, editor: any) => {
    setEditorContent(newContent); 
    
    let newTitle = "Untitled";
    const editorFullText = editor.getText(); // Use the editor instance passed by onChange
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
    setTitle(newTitle);

    // Only call handleSave if the change was made by the user
    if (source === 'user') {
      handleSave(newContent, newTitle);
    }
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
        console.log(`NoteEditor: Saving note ${activeNote.id} - Title: ${titleToSave}, Content: ${contentToSave.substring(0,50)}...`);
        await updateNote(activeNote.id, {
          content: contentToSave,
          title: titleToSave,
        });
        setSaving(false);
      } catch (error) {
        setSaving(false);
        console.error("Failed to auto-save note:", error);
      }
    }, 1000);
  };

  const handleDeleteNote = async () => {
    if (!activeNote) return;
    
    try {
      await deleteActiveNote();
      console.log("Note deleted successfully from editor.");
    } catch (error) {
      // Error handling for deleteActiveNote is in notesContext, uses console.error
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
    
    if (position > 0 && !editorContent.endsWith('\n')) {
      quill.insertText(position, '\n\n');
      quill.insertText(position + 2, text);
      quill.setSelection(position + 2 + text.length, 0);
    } else {
      quill.insertText(position, text);
      quill.setSelection(position + text.length, 0);
    }
    
    const updatedContent = quill.root.innerHTML;
    setEditorContent(updatedContent);
    
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
  };

  return (
    <div className="flex flex-col h-full note-editor-container bg-background">
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
            key={activeNote ? activeNote.id : 'no-active-note'} // Ensure key changes even if activeNote becomes null
            ref={quillRef}
            theme="snow"
            value={editorContent} // Bind to the new editorContent state
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
    </div>
  );
}
