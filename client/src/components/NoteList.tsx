import { useState } from "react";
import { formatDistanceToNow } from "@/lib/formatDate";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, PlusCircle } from "lucide-react";
import { Note } from "@shared/schema";
import SwipeableNote from "@/components/SwipeableNote";
import { useToast } from "@/hooks/use-toast";
import { useNotes } from "@/hooks/useNotes";
import { Button } from "@/components/ui/button";
import DashboardAIAssistant from "@/components/DashboardAIAssistant";

interface NoteListProps {
  notes: Note[];
  activeNoteId?: number;
  onNoteSelect: (note: Note) => void;
  isLoading: boolean;
}

export default function NoteList({ notes, activeNoteId, onNoteSelect, isLoading }: NoteListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const { deleteNote } = useNotes();
  const { toast } = useToast();

  const toggleSearch = () => {
    setSearchVisible(!searchVisible);
    if (!searchVisible) {
      setTimeout(() => {
        document.getElementById("search-input")?.focus();
      }, 100);
    }
  };

  const filteredNotes = searchQuery
    ? notes.filter(
        note =>
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  const getPreviewText = (content: string) => {
    // Remove HTML tags for the preview
    const textOnly = content.replace(/<\/?[^>]+(>|$)/g, "");
    return textOnly.substring(0, 60) + (textOnly.length > 60 ? "..." : "");
  };
  
  const handleDeleteNote = async (id: number) => {
    try {
      await deleteNote(id);
      console.log("Note deleted successfully from list.");
      // toast({
      //   title: "Note deleted",
      //   description: "Your note has been permanently deleted",
      // });
    } catch (error) {
      // Error handling for deleteNote is in notesContext, uses console.error
      // console.error("Failed to delete note from list:", error); // Already handled by context
    }
  };

  const handleNavigateToNote = (noteId: number) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      onNoteSelect(note);
    }
  };

  return (
    <div className="notes-list h-full">
      <div className="p-3 border-b border-[hsl(var(--notelist-border))]">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Search 
              className="h-5 w-5 text-primary/80 cursor-pointer" 
              onClick={toggleSearch}
            />
            {searchVisible && (
              <Input
                id="search-input"
                type="text"
                placeholder="Search notes"
                className="bg-background/50 border-0 shadow-none w-60 md:w-80 focus:ring-1 focus:ring-primary/30"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            )}
            {!searchVisible && (
              <span className="text-sm text-muted-foreground">
                {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
              </span>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-primary/80 hover:text-primary hover:bg-primary/10"
            onClick={() => setAiAssistantOpen(true)}
            title="Ask Mina AI about your notes"
          >
            <img src="/MinaIcon.svg" alt="Mina" className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          // Loading skeletons
          <div className="divide-y divide-[hsl(var(--notelist-border))]">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/4 mt-1" />
                </div>
              ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            {searchQuery ? "No matching notes found" : "No notes yet. Tap + to create your first note!"}
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--notelist-border))]">
            {filteredNotes.map((note) => (
              <SwipeableNote
                key={note.id}
                note={note}
                isActive={note.id === activeNoteId}
                onSelect={onNoteSelect}
                onDelete={handleDeleteNote}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Dashboard AI Assistant */}
      <DashboardAIAssistant 
        open={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        onNavigateToNote={handleNavigateToNote}
      />
    </div>
  );
}
