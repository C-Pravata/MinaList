import { useState } from "react";
import { formatDistanceToNow } from "@/lib/formatDate";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { Note } from "@shared/schema";

interface NoteListProps {
  notes: Note[];
  activeNoteId?: number;
  onNoteSelect: (note: Note) => void;
  isLoading: boolean;
}

export default function NoteList({ notes, activeNoteId, onNoteSelect, isLoading }: NoteListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);

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

  return (
    <>
      <div className="flex justify-between items-center p-4 border-b border-secondaryLight dark:border-secondaryDark">
        <h2 className="font-medium">Notes</h2>
        <div className="flex items-center space-x-2">
          <button onClick={toggleSearch} className="text-foreground opacity-70 hover:opacity-100">
            <Search className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
          </span>
        </div>
      </div>

      {searchVisible && (
        <div className="p-4 border-b border-secondaryLight dark:border-secondaryDark">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-input"
              type="text"
              placeholder="Search notes"
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {isLoading ? (
          // Loading skeletons
          Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="p-4 bg-background dark:bg-secondary space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/4 mt-1" />
              </div>
            ))
        ) : filteredNotes.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchQuery ? "No matching notes found" : "No notes yet"}
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => onNoteSelect(note)}
              className={`p-4 cursor-pointer hover:bg-white dark:hover:bg-secondaryDark bg-white dark:bg-secondaryDark ${
                note.id === activeNoteId
                  ? "border-l-4 border-primary dark:border-primary"
                  : ""
              }`}
            >
              <h3 className="font-medium text-base truncate">{note.title || "Untitled"}</h3>
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {getPreviewText(note.content)}
                </p>
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatDistanceToNow(new Date(note.updated_at))}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
