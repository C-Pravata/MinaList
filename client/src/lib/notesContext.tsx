import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Note, InsertNote as FullInsertNote, UpdateNote } from "@shared/schema";
import { Filesystem, Directory, Encoding, FileReadResult, FileWriteResult, CopyResult, StatResult, GetUriResult } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { SharedItem } from '@minanotes/sharing-helper'; // Assuming SharedItem is exported

// Client-side payload for creating a note does not include device_id
type ClientInsertNote = Omit<FullInsertNote, "device_id">;

interface PendingImageInfo {
  noteId: number;
  imagePath: string;
}

interface NotesContextType {
  notes: Note[];
  activeNote: Note | null;
  setActiveNote: (note: Note | null) => void;
  createNote: () => Promise<Note>;
  updateNote: (id: number, updates: UpdateNote) => Promise<Note>;
  deleteNote: (id: number) => Promise<void>;
  deleteActiveNote: () => Promise<void>;
  isLoading: boolean;
  togglePin: (id: number, pin: boolean) => Promise<void>;
  handleSharedItem: (item: SharedItem) => Promise<Note | null>;
  pendingImageForNewNote: PendingImageInfo | null;
  setPendingImageForNewNote: (info: PendingImageInfo | null) => void;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [pendingImageForNewNote, setPendingImageForNewNote] = useState<PendingImageInfo | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all notes
  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['/api/notes'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notes");
      // apiRequest now throws on non-ok responses, so direct res.json() is fine
      // We might still want to check res.ok if apiRequest behavior changes or for belt-and-suspenders
      return res.json(); 
    },
    staleTime: 1000 * 60, // 1 minute
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async () => {
      // Use ClientInsertNote for the payload - always create with empty content
      const notePayload: ClientInsertNote = {
        title: "", 
        content: "", 
        is_pinned: false,
        tags: null,
        color: "#ffffff"
      };
      
      const res = await apiRequest("POST", "/api/notes", notePayload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    },
    onError: (error) => {
      console.error("Failed to create note:", error);
      // toast({
      //   title: "Error",
      //   description: "Failed to create note",
      //   variant: "destructive",
      // });
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
    onError: (error) => {
      console.error("Failed to update note:", error);
      // toast({
      //   title: "Error",
      //   description: "Failed to update note",
      //   variant: "destructive",
      // });
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
    onError: (error) => {
      console.error("Failed to delete note:", error);
      // toast({
      //   title: "Error",
      //   description: "Failed to delete note",
      //   variant: "destructive",
      // });
    }
  });

  // This useEffect handles cases where the activeNote might become invalid
  // (e.g., deleted) or when notes initially load.
  useEffect(() => {
    if (isLoading) {
      return; // Don't interfere while notes are loading/refetching.
    }

    if (activeNote) {
      const isActiveNotePresent = notes.some(note => note.id === activeNote.id);

      if (!isActiveNotePresent) {
        // Active note is set, but not found in the current 'notes' list.
        // This could be because:
        // 1. It's a brand-new note, and the 'notes' list hasn't updated yet from the server.
        // 2. The note was deleted.

        // Check if the activeNote appears to be a new, blank note.
        const isApparentlyNewBlankNote = activeNote.title === "" && activeNote.content === "";

        if (!isApparentlyNewBlankNote) {
          // It's NOT a new blank note, so it was likely deleted or is genuinely stale.
          // Fallback to the first note in the (updated) list, or null if the list is empty.
          setActiveNote(notes.length > 0 ? notes[0] : null);
        }
        // If it IS an apparentlyNewBlankNote, we do nothing here.
        // This allows the NoteEditor to use this new, blank activeNote
        // while the main 'notes' list catches up.
      }
    }
    // If activeNote is null (e.g., after 'Done' or 'Back'), and notes load, we don't auto-select.
    // The user will either create a new one or select from the list.
  }, [notes, isLoading, activeNote, setActiveNote]);

  // Create a new note - guarantee it starts blank
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

  // Toggle pin status
  const togglePin = async (id: number, pin: boolean) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    await updateNote(id, {
      title: note.title,
      content: note.content,
      is_pinned: pin,
      tags: note.tags,
      color: note.color,
    } as UpdateNote);
  };

  const handleSharedItem = async (item: SharedItem): Promise<Note | null> => {
    if (!item || !item.type || !item.value) {
      console.warn("handleSharedItem: Invalid item received", item);
      return null;
    }

    try {
      const newNote = await createNote();
      if (!newNote || !newNote.id) {
        console.error("handleSharedItem: Failed to create a new note shell.");
        toast({ title: "Error Sharing", description: "Could not create new note.", variant: "destructive" });
        return null;
      }

      let titleToSave = "Shared Content";
      let contentToSave = ""; // Default to empty, will be updated if not an image requiring special handling
      let updatedNote = newNote; // Initialize with the newly created note structure

      if (item.type === 'url') {
        titleToSave = "Shared Link";
        contentToSave = `<p>Shared URL: <a href="${item.value}" target="_blank">${item.value}</a></p>`;
        updatedNote = await updateNote(newNote.id, { title: titleToSave, content: contentToSave, is_pinned: newNote.is_pinned, tags: newNote.tags, color: newNote.color });
      } else if (item.type === 'image') {
        titleToSave = "Shared Image";
        let originalPath = item.value!;
        if (!originalPath.startsWith('file://')) {
          originalPath = `file://${originalPath}`;
        }
        const originalFileName = originalPath.substring(originalPath.lastIndexOf('/') + 1);
        const safeOriginalFileName = originalFileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const fileName = `shared_image_${Date.now()}_${safeOriginalFileName}`;
        console.log(`handleSharedItem: Processing image. Original: ${originalPath}, Target: ${fileName}`);

        try {
          await Filesystem.copy({ from: originalPath, to: fileName, toDirectory: Directory.Data });
          const newFileUriResult = await Filesystem.getUri({ directory: Directory.Data, path: fileName });
          const webPath = Capacitor.convertFileSrc(newFileUriResult.uri);
          console.log("handleSharedItem: Image copied. Web path for Quill: ", webPath);

          // For images, initially save note with title and blank content.
          // Store the webPath to be inserted by NoteEditor.
          updatedNote = await updateNote(newNote.id, { title: titleToSave, content: "", is_pinned: newNote.is_pinned, tags: newNote.tags, color: newNote.color });
          setPendingImageForNewNote({ noteId: updatedNote.id, imagePath: webPath });
          contentToSave = ""; // Content will be set by Quill embedding

        } catch (copyError: any) {
          console.error("handleSharedItem: Error in image processing block:", JSON.stringify(copyError, Object.getOwnPropertyNames(copyError), 2));
          contentToSave = `<p>Error processing shared image. Details: ${copyError.message || 'Unknown error'}</p>`;
          updatedNote = await updateNote(newNote.id, { title: titleToSave, content: contentToSave, is_pinned: newNote.is_pinned, tags: newNote.tags, color: newNote.color });
          toast({ title: "Error Sharing Image", description: `Could not save: ${copyError.message || 'Unknown'}` , variant: "destructive" });
        }
      } else {
        console.warn("handleSharedItem: Unknown shared item type:", item.type);
        contentToSave = `<p>Shared content (unknown type): ${item.value}</p>`;
        updatedNote = await updateNote(newNote.id, { title: titleToSave, content: contentToSave, is_pinned: newNote.is_pinned, tags: newNote.tags, color: newNote.color });
      }
      
      // This toast might be premature if image embedding is pending
      if (item.type !== 'image') { 
        toast({ title: "Content Shared", description: `${titleToSave} added to new note.` });
      }
      return updatedNote; // Return the note (meta-data updated, content might be pending for image)

    } catch (error) {
      console.error("handleSharedItem: Error processing shared item:", error);
      toast({ title: "Error Sharing", description: "Unexpected error sharing content.", variant: "destructive" });
      return null;
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
        togglePin,
        handleSharedItem,
        pendingImageForNewNote,
        setPendingImageForNewNote
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
