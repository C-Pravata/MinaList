import React, { useEffect } from 'react';
import { useRoute } from 'wouter';
import NoteEditor from "@/components/NoteEditor";
import { useNotesContext } from "@/lib/notesContext";

const NotePage: React.FC = () => {
  const { notes, setActiveNote, activeNote, isLoading } = useNotesContext();
  const [, params] = useRoute("/notes/:id");
  const noteIdFromRoute = params ? parseInt(params.id, 10) : null;

  useEffect(() => {
    if (isLoading) return;

    if (noteIdFromRoute !== null) {
      if (activeNote && activeNote.id === noteIdFromRoute) {
        return;
      }

      const noteToActivate = notes.find(note => note.id === noteIdFromRoute);
      if (noteToActivate) {
        console.log(`NotePage: Setting active note from route ID: ${noteIdFromRoute}`);
        setActiveNote(noteToActivate);
      } else {
        console.warn(`NotePage: Note with ID ${noteIdFromRoute} not found in notes list.`);
      }
    } else {
    }
  }, [noteIdFromRoute, notes, setActiveNote, activeNote, isLoading]);

  return (
    <div className="flex flex-col h-full w-full">
      <NoteEditor />
    </div>
  );
};

export default NotePage; 