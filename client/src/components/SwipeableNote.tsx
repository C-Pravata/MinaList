import { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Note } from '@shared/schema';
import { formatDistanceToNow } from '@/lib/formatDate';
import { Button } from '@/components/ui/button';

interface SwipeableNoteProps {
  note: Note;
  isActive: boolean;
  onSelect: (note: Note) => void;
  onDelete: (id: number) => void;
}

export default function SwipeableNote({ note, isActive, onSelect, onDelete }: SwipeableNoteProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);
  
  // Threshold to show delete button
  const THRESHOLD = -80;
  
  // Reset position when the active note changes
  useEffect(() => {
    setTranslateX(0);
    setShowDeleteButton(false);
  }, [isActive]);
  
  const getTitlePreview = (title: string) => {
    return title || "Untitled";
  };

  const getContentLinePreview = (fullHtmlContent: string, titleText: string) => {
    // 1. Get plain text of the entire note content
    const fullPlainText = fullHtmlContent.replace(/<\/?[^>]+(>|$)/g, "");

    // 2. The provided titleText is already the plain text of the title.
    //    We need to find the content that comes *after* this title text.
    let contentAfterTitle = "";
    if (fullPlainText.startsWith(titleText)) {
      contentAfterTitle = fullPlainText.substring(titleText.length).trim();
    } else {
      // Fallback: If the full plain text doesn't start with the title text
      // (which could happen if title extraction had quirks or content was unusual),
      // we might attempt a simpler split, but this case should be rare if title is reliable.
      // For now, let's assume titleText is a reliable prefix or the content starts fresh.
      // A more aggressive fallback might be to just use lines[1] if lines.length > 1.
      // However, if titleText itself contained newlines, this would be an issue.
      // The current approach of removing the titleText prefix is more robust.
      const lines = fullPlainText.split('\n');
      if (lines.length > 1) {
        // This is a weaker fallback. Prefer the prefix removal.
        contentAfterTitle = lines.slice(1).join('\n').trim();
      }
    }
    
    if (contentAfterTitle) {
      return contentAfterTitle.substring(0, 60) + (contentAfterTitle.length > 60 ? "..." : "");
    }
    
    return "No additional text"; // Return "No additional text" if no content after title
  };
  
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    
    // Only allow swiping left (negative values)
    const newTranslateX = Math.min(0, diff);
    setTranslateX(newTranslateX);
    
    if (newTranslateX <= THRESHOLD) {
      setShowDeleteButton(true);
    } else {
      setShowDeleteButton(false);
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const currentX = e.clientX;
    const diff = currentX - startX;
    
    // Only allow swiping left (negative values)
    const newTranslateX = Math.min(0, diff);
    setTranslateX(newTranslateX);
    
    if (newTranslateX <= THRESHOLD) {
      setShowDeleteButton(true);
    } else {
      setShowDeleteButton(false);
    }
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);
    
    if (translateX <= THRESHOLD) {
      // Snap to delete position
      setTranslateX(THRESHOLD);
    } else {
      // Reset position
      setTranslateX(0);
      setShowDeleteButton(false);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    
    if (translateX <= THRESHOLD) {
      // Snap to delete position
      setTranslateX(THRESHOLD);
    } else {
      // Reset position
      setTranslateX(0);
      setShowDeleteButton(false);
    }
  };
  
  const handleClick = () => {
    // Only select the note if we're not showing delete button
    if (!showDeleteButton) {
      onSelect(note);
    }
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering note selection
    onDelete(note.id);
  };
  
  return (
    <div className="relative overflow-hidden">
      {/* Delete button behind the note */}
      <div 
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-white p-4 w-20"
        style={{ opacity: showDeleteButton ? 1 : 0 }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-white hover:bg-red-600/30 transition-colors"
          onClick={handleDelete}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
      
      {/* The actual note content */}
      <div
        ref={noteRef}
        className={`note-item p-4 cursor-pointer relative ${isActive ? "active" : ""}`}
        style={{ 
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      >
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
        )}
        <h3 className="font-medium text-base truncate">{getTitlePreview(note.title)}</h3>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-1">
          <p className="text-sm text-muted-foreground truncate pr-4">
            {getContentLinePreview(note.content, note.title)}
          </p>
          <span className="text-xs text-muted-foreground mt-1 sm:mt-0 whitespace-nowrap">
            {formatDistanceToNow(new Date(note.updated_at))}
          </span>
        </div>
      </div>
    </div>
  );
}