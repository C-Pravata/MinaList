import { useState, useEffect } from "react";
import Header from "@/components/Header";
import NoteList from "@/components/NoteList";
import NoteEditor from "@/components/NoteEditor";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import { Note } from "@shared/schema";

export default function Home() {
  const { 
    notes, 
    activeNote, 
    setActiveNote, 
    createNote, 
    isLoading
  } = useNotes();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useMobile();
  const { toast } = useToast();

  useEffect(() => {
    // Close sidebar on mobile by default
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote();
      setActiveNote(newNote);
      if (isMobile) {
        setSidebarOpen(false);
      }
      
      toast({
        title: "Note created",
        description: "Your new note has been created",
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
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with note list */}
        <aside 
          className={`w-full md:w-80 border-r border-secondaryLight dark:border-secondaryDark bg-sidebar 
          overflow-y-auto transition-all duration-300 md:translate-x-0 h-[calc(100vh-64px)]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:static absolute inset-y-0 left-0 z-20`}
        >
          <NoteList 
            notes={notes}
            activeNoteId={activeNote?.id}
            onNoteSelect={handleNoteSelect}
            isLoading={isLoading}
          />
          
          {/* Mobile new note button */}
          <div className="p-4 md:hidden">
            <Button 
              onClick={handleCreateNote}
              className="w-full bg-primary hover:bg-primary/90 dark:bg-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Note
            </Button>
          </div>
        </aside>

        {/* Main content area with note editor */}
        <main className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
          <NoteEditor />
        </main>
      </div>

      {/* Desktop floating action button */}
      <Button
        onClick={handleCreateNote}
        className="fixed bottom-6 right-6 bg-primary hover:bg-primary/90 dark:bg-primary shadow-lg rounded-full p-3 h-12 w-12 hidden md:flex items-center justify-center"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
