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
  searchQuery?: string;
}

// Helper function to escape HTML special characters
function escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export default function SwipeableNote({ note, isActive, onSelect, onDelete, searchQuery }: SwipeableNoteProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);
  
  const THRESHOLD = -80;
  
  useEffect(() => {
    setTranslateX(0);
    setShowDeleteButton(false);
  }, [isActive]);
  
  // Original plain text preview functions (used as fallbacks)
  const getPlainTextLines = (htmlContent: string): string[] => {
    if (!htmlContent) return [];
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const html = tempDiv.innerHTML;
    const processedHtml = html.replace(/<\/(p|div)>/g, '\n').replace(/<br\s*\/?>/g, '\n');
    tempDiv.innerHTML = processedHtml;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    return plainText.split('\n').map(line => line.trim()).filter(line => line !== "");
  };

  const getContentLinePreview = (fullHtmlContent: string, noteTitle: string): string => {
    const nonEmptyLines = getPlainTextLines(fullHtmlContent);
    if (!nonEmptyLines.length) return "No additional text";
    const effectiveTitle = (noteTitle || "").trim();
    if (effectiveTitle === "" || effectiveTitle === "Untitled") {
      return nonEmptyLines.length > 1 
        ? nonEmptyLines[1].substring(0, 60) + (nonEmptyLines[1].length > 60 ? "..." : "")
        : "No additional text";
    }
    const titleIndex = nonEmptyLines.findIndex(line => line === effectiveTitle);
    if (titleIndex !== -1 && titleIndex + 1 < nonEmptyLines.length) {
      return nonEmptyLines[titleIndex + 1].substring(0, 60) + (nonEmptyLines[titleIndex + 1].length > 60 ? "..." : "");
    }
    const firstNonTitleLine = nonEmptyLines.find(line => line !== effectiveTitle);
    return firstNonTitleLine
      ? firstNonTitleLine.substring(0, 60) + (firstNonTitleLine.length > 60 ? "..." : "")
      : "No additional text";
  };

  const getEnhancedPreview = (currentNote: Note, query?: string): { titleHtml: string, previewHtml: string | null, isContentMatch: boolean } => {
    let noteTitle = currentNote.title || "Untitled";
    let titleHtml = escapeHtml(noteTitle);
    let contentPreviewHtml: string | null = null;
    let isContentMatchForPreview = false;
    let isTitleMatch = false;

    // Get plain content, excluding the title
    const plainContent = (() => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currentNote.content || "";
      const html = tempDiv.innerHTML;
      const processedHtml = html.replace(/<\/(p|div)>/g, '\n').replace(/<br\s*\/?>/g, '\n');
      tempDiv.innerHTML = processedHtml;
      const lines = (tempDiv.textContent || tempDiv.innerText || "")
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== "" && line !== noteTitle); // Exclude empty lines and title
      return lines.join('\n');
    })();

    if (query && query.trim() !== "") {
      const queryLower = query.toLowerCase();

      // Check title match first
      if (noteTitle.toLowerCase().includes(queryLower)) {
        isTitleMatch = true;
        const titleMatchIndex = noteTitle.toLowerCase().indexOf(queryLower);
        const actualTitleMatch = noteTitle.substring(titleMatchIndex, titleMatchIndex + query.length);
        titleHtml = escapeHtml(noteTitle.substring(0, titleMatchIndex)) +
                    `<span class="search-highlight">${escapeHtml(actualTitleMatch)}</span>` +
                    escapeHtml(noteTitle.substring(titleMatchIndex + query.length));
      }

      // Only check content if there's no title match
      if (!isTitleMatch && plainContent) {
        const contentMatchIndex = plainContent.toLowerCase().indexOf(queryLower);
        if (contentMatchIndex !== -1) {
          isContentMatchForPreview = true;
          const snippetPadding = 30;
          let startIndex = Math.max(0, contentMatchIndex - snippetPadding);
          let endIndex = Math.min(plainContent.length, contentMatchIndex + query.length + snippetPadding);
          let snippet = plainContent.substring(startIndex, endIndex);
          
          let prefix = startIndex > 0 ? "... " : "";
          let suffix = endIndex < plainContent.length ? " ..." : "";

          const matchInSnippetIndex = snippet.toLowerCase().indexOf(queryLower);
          if (matchInSnippetIndex !== -1) {
            const beforeMatchInSnippet = snippet.substring(0, matchInSnippetIndex);
            const actualMatchInSnippet = snippet.substring(matchInSnippetIndex, matchInSnippetIndex + query.length);
            const afterMatchInSnippet = snippet.substring(matchInSnippetIndex + query.length);
            contentPreviewHtml = prefix + 
                               escapeHtml(beforeMatchInSnippet) + 
                               `<span class="search-highlight">${escapeHtml(actualMatchInSnippet)}</span>` + 
                               escapeHtml(afterMatchInSnippet) + 
                               suffix;
          } else {
            // Fallback if somehow match isn't in snippet (should be rare)
            contentPreviewHtml = prefix + escapeHtml(snippet) + suffix;
          }
        }
      }
    }

    return { titleHtml: titleHtml, previewHtml: contentPreviewHtml, isContentMatch: isContentMatchForPreview };
  };
  
  const { titleHtml, previewHtml, isContentMatch } = getEnhancedPreview(note, searchQuery);
  
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
    const newTranslateX = Math.min(0, diff);
    setTranslateX(newTranslateX);
    setShowDeleteButton(newTranslateX <= THRESHOLD);
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - startX;
    const newTranslateX = Math.min(0, diff);
    setTranslateX(newTranslateX);
    setShowDeleteButton(newTranslateX <= THRESHOLD);
  };
  
  const handleEndDrag = () => {
    setIsDragging(false);
    if (translateX <= THRESHOLD) {
      setTranslateX(THRESHOLD); // Snap to delete
    } else {
      setTranslateX(0); // Reset position
      setShowDeleteButton(false);
    }
  };
  
  const handleClick = () => {
    if (translateX === 0) { // Only select if not swiped/swiping
      onSelect(note);
    } else if (translateX > THRESHOLD) { // If partially swiped but not enough to show delete, reset
        setTranslateX(0);
        setShowDeleteButton(false);
    }
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(note.id);
  };
  
  return (
    <div className="relative overflow-hidden group"> {/* Added group for potential future styling */}
      <div 
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-white p-4 w-20 transition-opacity duration-300"
        style={{ opacity: showDeleteButton ? 1 : 0, zIndex: 1 }} // Ensure delete button is interactable
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-white hover:bg-red-600/30"
          onClick={handleDelete}
          aria-label="Delete note"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
      
      <div
        ref={noteRef}
        className={`note-item p-4 cursor-pointer relative ${isActive ? "active" : ""} bg-background`} // Ensure bg for swipe
        style={{ 
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          zIndex: 2 // Note content should be above delete button initially
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEndDrag}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEndDrag}
        onMouseLeave={() => { if(isDragging) handleEndDrag();}} // Handle mouse leaving while dragging
        onClick={handleClick}
      >
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
        )}
        <h3 className="text-md font-semibold truncate text-foreground pr-8" dangerouslySetInnerHTML={{ __html: titleHtml }} />
        {isContentMatch && previewHtml ? (
          <p className="text-sm text-muted-foreground mt-1 search-snippet" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : (
          <p className="text-sm text-muted-foreground truncate mt-1">{getContentLinePreview(note.content, note.title)}</p>
        )}
        <p className="text-xs text-muted-foreground/80 mt-2">{formatDistanceToNow(new Date(note.updated_at))}</p>
      </div>
    </div>
  );
}