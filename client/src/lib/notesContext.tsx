import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Note, InsertNote, UpdateNote } from "@shared/schema";

interface NotesContextType {
  notes: Note[];
  activeNote: Note | null;
  setActiveNote: (note: Note | null) => void;
  createNote: () => Promise<Note>;
  updateNote: (id: number, updates: UpdateNote) => Promise<Note>;
  deleteNote: (id: number) => Promise<void>;
  deleteActiveNote: () => Promise<void>;
  isLoading: boolean;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['/api/notes'],
    staleTime: 1000 * 60, // 1 minute
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const note: InsertNote = {
        title: "New note",
        content: "<p>Start writing...</p>",
      };
      
      const res = await apiRequest("POST", "/api/notes", note);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create note",
        variant: "destructive",
      });
    }
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UpdateNote }) => {
      const res = await apiRequest("PUT", `/api/notes/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
    }
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    }
  });

  // Set first note as active when notes load if there is no active note
  useEffect(() => {
    if (notes.length > 0 && !activeNote) {
      setActiveNote(notes[0]);
    }
    
    // If activeNote is deleted, set to null
    if (activeNote && !notes.some(note => note.id === activeNote.id)) {
      setActiveNote(notes.length > 0 ? notes[0] : null);
    }
  }, [notes, activeNote]);

  // Create a new note
  const createNote = async () => {
    const newNote = await createNoteMutation.mutateAsync();
    return newNote;
  };

  // Update a note
  const updateNote = async (id: number, updates: UpdateNote) => {
    return await updateNoteMutation.mutateAsync({ id, updates });
  };

  // Delete a note
  const deleteNote = async (id: number) => {
    await deleteNoteMutation.mutateAsync(id);
    if (activeNote && activeNote.id === id) {
      setActiveNote(null);
    }
  };

  // Delete the active note
  const deleteActiveNote = async () => {
    if (activeNote) {
      await deleteNote(activeNote.id);
    }
  };

  return (
    <NotesContext.Provider
      value={{
        notes,
        activeNote,
        setActiveNote,
        createNote,
        updateNote,
        deleteNote,
        deleteActiveNote,
        isLoading,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export const useNotesContext = () => {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error("useNotesContext must be used within a NotesProvider");
  }
  return context;
};
