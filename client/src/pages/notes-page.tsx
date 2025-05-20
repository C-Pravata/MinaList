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
      // Create a new blank note
      const newNote = await createNote();
      
      // Set it as the active note and enter editing mode
      setActiveNote(newNote);
      setIsEditing(true);
    } catch (error) {
      console.error("Failed to create new note", error);
      // toast({
      //   title: "Error",
      //   description: "Failed to create new note",
      //   variant: "destructive",
      // });
    }
  };

  const handleNoteSelect = (note: Note) => {
    setActiveNote(note);
    setIsEditing(true);
  };
  
  const handleDone = () => {
    setIsEditing(false);
    setActiveNote(null);
    console.log("Note saved (changes persisted by editor's autosave).");
    // toast({
    //   title: "Note saved",
    //   description: "Your changes have been saved",
    //   variant: "default",
    // });
  };
  
  const handleBack = async () => {
    // --- Overhauled Cancel Logic ---
    // Back should simply exit the editing mode and return to the list view.
    // It should NOT delete any notes.
    // Auto-saving in the editor should handle persistence.
    
    setIsEditing(false); // Exit editing mode
    setActiveNote(null); // Deselect note, effectively returning to the list

    // Optional: Maybe add a different toast message for cancel if needed?
    // toast({ title: "Editing cancelled" }); 
  };

  return (
    <div className="flex flex-col h-screen">
      <Header 
        isEditing={isEditing} 
        onDone={handleDone} 
        onBack={handleBack}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Notes List View */}
        <div 
          className={`w-full h-[calc(100vh-64px)] transition-all duration-300 ease-out absolute inset-0 overflow-y-auto ${
            isEditing ? 'translate-x-[-100%] opacity-0' : 'translate-x-0 opacity-100'
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
          className={`w-full h-[calc(100vh-64px)] transition-all duration-300 ease-out absolute inset-0 flex flex-col ${
            isEditing ? 'translate-x-0 opacity-100' : 'translate-x-[100%] opacity-0'
          }`}
        >
          <NoteEditor />
        </div>
      </div>

      {/* Floating action button with subtle animation */}
      {!isEditing && (
        <Button
          onClick={handleCreateNote}
          className="fixed bottom-6 right-6 bg-primary hover:bg-primary/90 dark:bg-primary shadow-lg rounded-full p-3 h-14 w-14 flex items-center justify-center z-10 hover:scale-105 transition-all duration-200"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
