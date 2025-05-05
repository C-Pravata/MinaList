import { useState } from "react";
import Header from "@/components/Header";
import NoteList from "@/components/NoteList";
import NoteEditor from "@/components/NoteEditor";
import { Button } from "@/components/ui/button";
import { Plus, X, Check } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { useToast } from "@/hooks/use-toast";
import { Note } from "@shared/schema";
import { motion } from "framer-motion";

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
        title: "New note created",
        description: "Start writing your thoughts...",
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
    
    toast({
      title: "Note saved",
      description: "Your changes have been saved",
      variant: "default",
    });
  };
  
  const handleCancel = async () => {
    // If it's a new note with no content, delete it
    if (activeNote && activeNote.content === "<p>Start writing...</p>") {
      try {
        await deleteNote(activeNote.id);
        toast({
          title: "Empty note deleted",
          description: "The empty note has been removed",
        });
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
        <motion.div 
          className="w-full h-[calc(100vh-64px)] absolute inset-0 overflow-y-auto"
          initial={false}
          animate={{
            x: isEditing ? '-100%' : '0%',
            opacity: isEditing ? 0 : 1,
            scale: isEditing ? 0.95 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            mass: 1
          }}
        >
          <NoteList 
            notes={notes}
            activeNoteId={activeNote?.id}
            onNoteSelect={handleNoteSelect}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Editor View */}
        <motion.div 
          className="w-full h-[calc(100vh-64px)] absolute inset-0 flex flex-col"
          initial={false}
          animate={{
            x: isEditing ? '0%' : '100%',
            opacity: isEditing ? 1 : 0,
            scale: isEditing ? 1 : 0.98,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            mass: 1
          }}
        >
          <NoteEditor />
        </motion.div>
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
