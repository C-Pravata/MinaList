import { useState, useEffect } from "react";
import { formatDistanceToNow } from "@/lib/formatDate";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Note } from "@shared/schema";
import SwipeableNote from "@/components/SwipeableNote";
import { useToast } from "@/hooks/use-toast";
import { useNotes } from "@/hooks/useNotes";
import { motion, AnimatePresence } from "framer-motion";
import { useMobile } from "@/hooks/use-mobile";

interface NoteListProps {
  notes: Note[];
  activeNoteId?: number;
  onNoteSelect: (note: Note) => void;
  isLoading: boolean;
}

export default function NoteList({ notes, activeNoteId, onNoteSelect, isLoading }: NoteListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [sortOldestFirst, setSortOldestFirst] = useState(false);
  const { deleteNote } = useNotes();
  const { toast } = useToast();
  const isMobile = useMobile();

  // Clear search when component unmounts
  useEffect(() => {
    return () => {
      setSearchQuery("");
      setSearchVisible(false);
    };
  }, []);

  const toggleSearch = () => {
    setSearchVisible(!searchVisible);
    if (searchVisible) {
      setSearchQuery("");
    } else {
      setTimeout(() => {
        document.getElementById("search-input")?.focus();
      }, 100);
    }
  };

  // Filter notes based on search query
  const filteredNotes = searchQuery
    ? notes.filter(
        note =>
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  // Sort notes based on updatedAt date
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return sortOldestFirst ? dateA - dateB : dateB - dateA;
  });

  const getPreviewText = (content: string) => {
    // Remove HTML tags for the preview
    const textOnly = content.replace(/<\/?[^>]+(>|$)/g, "");
    return textOnly.substring(0, 60) + (textOnly.length > 60 ? "..." : "");
  };
  
  const handleDeleteNote = async (id: number) => {
    try {
      await deleteNote(id);
      toast({
        title: "Note deleted",
        description: "Your note has been permanently deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    }
  };
  
  const toggleSortOrder = () => {
    setSortOldestFirst(!sortOldestFirst);
    toast({
      title: `Sorting ${sortOldestFirst ? 'newest' : 'oldest'} first`,
      description: `Notes are now sorted by ${sortOldestFirst ? 'newest' : 'oldest'} first`,
    });
  };

  return (
    <div className="notes-list h-full">
      <div className="p-3 border-b border-[hsl(var(--notelist-border))]">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {searchVisible ? (
              <X 
                className="h-5 w-5 text-primary cursor-pointer" 
                onClick={toggleSearch}
              />
            ) : (
              <Search 
                className="h-5 w-5 text-primary/80 cursor-pointer" 
                onClick={toggleSearch}
              />
            )}
            
            <AnimatePresence mode="wait">
              {searchVisible ? (
                <motion.div
                  key="search-input"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Input
                    id="search-input"
                    type="text"
                    placeholder="Search notes"
                    className="bg-background/50 border-0 shadow-none w-60 md:w-80 focus:ring-1 focus:ring-primary/30"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </motion.div>
              ) : (
                <motion.span
                  key="note-count"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-muted-foreground"
                >
                  {sortedNotes.length} {sortedNotes.length === 1 ? "note" : "notes"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          
          <motion.div 
            whileTap={{ scale: 0.95 }}
            onClick={toggleSortOrder}
            className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors duration-200"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{sortOldestFirst ? "Oldest first" : "Newest first"}</span>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          // Loading skeletons with staggered animation
          <div className="divide-y divide-[hsl(var(--notelist-border))]">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <motion.div 
                  key={i} 
                  className="p-4 space-y-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/4 mt-1" />
                </motion.div>
              ))}
          </div>
        ) : sortedNotes.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-10 text-center text-muted-foreground flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ 
                repeat: Infinity, 
                repeatType: "reverse", 
                duration: 2 
              }}
              className="mb-4 opacity-50"
            >
              {searchQuery ? 
                <Search className="h-12 w-12" /> : 
                <Plus className="h-12 w-12" />
              }
            </motion.div>
            {searchQuery ? "No matching notes found" : "No notes yet. Tap + to create your first note!"}
          </motion.div>
        ) : (
          <div className="divide-y divide-[hsl(var(--notelist-border))]">
            <AnimatePresence initial={false}>
              {sortedNotes.map((note, index) => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ 
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    mass: 1,
                    delay: index * 0.03 
                  }}
                >
                  <SwipeableNote
                    note={note}
                    isActive={note.id === activeNoteId}
                    onSelect={onNoteSelect}
                    onDelete={handleDeleteNote}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
