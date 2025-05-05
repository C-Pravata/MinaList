import { useState } from "react";
import Header from "@/components/Header";
import NoteList from "@/components/NoteList";
import NoteEditor from "@/components/NoteEditor";
import { Button } from "@/components/ui/button";
import { Plus, X, Check } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { useToast } from "@/hooks/use-toast";
import { Note } from "@shared/schema";

export default function Home() {
  const { 
    notes, 
    activeNote, 
    setActiveNote, 
    createNote, 
    isLoading,
    deleteNote
  } = useNotes();
  
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote();
      setActiveNote(newNote);
      setIsEditing(true);
      
      toast({
        title: "New note",
        description: "Start writing...",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create new note",
        variant: "destructive",
      });
    }
  };

  const handleNoteSelect = (note: Note) => {
    setActiveNote(note);
    setIsEditing(true);
  };
  
  const handleDone = () => {
    setIsEditing(false);
    setActiveNote(null);
  };
  
  const handleCancel = async () => {
    // If it's a new note with no content, delete it
    if (activeNote && activeNote.content === "<p>Start writing...</p>") {
      try {
        await deleteNote(activeNote.id);
      } catch (error) {
        console.error("Failed to delete empty note", error);
      }
    }
    setIsEditing(false);
    setActiveNote(null);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header 
        isEditing={isEditing} 
        onDone={handleDone} 
        onCancel={handleCancel}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Notes List View */}
        <div 
          className={`w-full h-[calc(100vh-64px)] transition-all duration-300 ease-in-out absolute inset-0 overflow-y-auto ${
            isEditing ? 'translate-x-[-100%]' : 'translate-x-0'
          }`}
        >
          <NoteList 
            notes={notes}
            activeNoteId={activeNote?.id}
            onNoteSelect={handleNoteSelect}
            isLoading={isLoading}
          />
        </div>

        {/* Editor View */}
        <div 
          className={`w-full h-[calc(100vh-64px)] transition-all duration-300 ease-in-out absolute inset-0 flex flex-col ${
            isEditing ? 'translate-x-0' : 'translate-x-[100%]'
          }`}
        >
          <NoteEditor />
        </div>
      </div>

      {/* Floating action button (only visible in notes list view) */}
      {!isEditing && (
        <Button
          onClick={handleCreateNote}
          className="fixed bottom-6 right-6 bg-primary hover:bg-primary/90 dark:bg-primary shadow-lg rounded-full p-3 h-14 w-14 flex items-center justify-center z-10"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
