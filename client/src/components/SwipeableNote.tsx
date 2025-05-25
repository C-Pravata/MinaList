import { useState, useRef, useEffect } from 'react';
import { Trash2, Pin } from 'lucide-react';
import { Note } from '@shared/schema';
import { formatDistanceToNow } from '@/lib/formatDate';
import { Button } from '@/components/ui/button';
import { useNotes } from '@/hooks/useNotes';

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
  const { togglePin } = useNotes();
  
  const BUTTON_SIZE = 44; // px, for both pin and delete
  const BUTTON_GAP = 8; // px, gap between buttons
  const MAX_SWIPE = -(BUTTON_SIZE * 2 + BUTTON_GAP); // -96px
  const THRESHOLD = MAX_SWIPE; // Snap to this value
  
  useEffect(() => {
    setTranslateX(0);
    setShowDeleteButton(false);
  }, [isActive]);
  
  // Original plain text preview functions (used as fallbacks)
  const getPlainTextLines = (htmlContent: string): string[] => {
    if (!htmlContent) return [];
    const tempDiv = document.createElement('div');
    
    // Pre-process HTML: ensure block elements are followed by a newline character
    // before stripping tags. This helps in preserving line breaks.
    let processedHtml = htmlContent;
    const blockElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'hr', 'ul', 'ol', 'table', 'tr', 'td', 'th', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'address', 'article', 'aside', 'fieldset', 'footer', 'form', 'header', 'main', 'nav', 'section', 'pre'];
    
    blockElements.forEach(tag => {
      // Add newline after closing tags
      processedHtml = processedHtml.replace(new RegExp(`</${tag}>`, 'gi'), `</${tag}>\n`);
      // For self-closing or tags that imply a break before (like <br>), ensure newline.
      // More complex: For opening tags, if we want a break *before* them,
      // it's often better to ensure the *previous* block element had its newline.
      // Or, one could add \n before <tag>, but this might double newlines.
      // Simpler for now: focus on newlines *after* blocks.
    });
    // Ensure <br> tags also contribute a newline
    processedHtml = processedHtml.replace(/<br\s*\/?>/gi, '\n');

    tempDiv.innerHTML = processedHtml;
    
    // Get text content, which now should have newlines where block elements ended
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    
    // Split by newline, trim, and filter empty lines
    // Also, normalize multiple newlines (e.g., from <p></p>\n) into single effective breaks
    return plainText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== "");
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
    const newTranslateX = Math.max(MAX_SWIPE, Math.min(0, diff)); // Limit swipe
    setTranslateX(newTranslateX);
    setShowDeleteButton(newTranslateX <= THRESHOLD + 10); // Show when close to max
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - startX;
    const newTranslateX = Math.max(MAX_SWIPE, Math.min(0, diff)); // Limit swipe
    setTranslateX(newTranslateX);
    setShowDeleteButton(newTranslateX <= THRESHOLD + 10);
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
    <div className="relative overflow-hidden group">
      {/* Two-tone background for swipe actions */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: `${-MAX_SWIPE}px`, zIndex: 0 }}>
        <div className="flex items-center justify-center" style={{ width: BUTTON_SIZE, background: 'var(--swipe-pin-bg)' }}>
          <Button
            variant="ghost"
            size="icon"
            className={`h-10 w-10 rounded-full text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-200 ${note.is_pinned ? 'opacity-100' : 'opacity-80'} ${showDeleteButton ? 'opacity-100' : 'opacity-70'}`}
            style={{ color: '#fff' }}
            onClick={(e) => { e.stopPropagation(); togglePin(note.id, !note.is_pinned); }}
            aria-label={note.is_pinned ? "Unpin note" : "Pin note"}
          >
            <Pin className="h-5 w-5" fill={note.is_pinned ? '#fff' : 'none'} />
          </Button>
        </div>
        <div style={{ width: BUTTON_GAP, background: 'transparent' }} />
        <div className="flex items-center justify-center" style={{ width: BUTTON_SIZE, background: 'var(--swipe-delete-bg)' }}>
        <Button
          variant="ghost"
          size="icon"
            className={`h-10 w-10 rounded-full text-white transition-all duration-200 ${showDeleteButton ? 'opacity-100' : 'opacity-70'}`}
          onClick={handleDelete}
          aria-label="Delete note"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        </div>
      </div>
      
      <div
        ref={noteRef}
        className={`note-item p-4 cursor-pointer relative ${isActive ? "active" : ""} bg-background`}
        style={{ 
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(.4,2,.6,1)',
          zIndex: 2
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEndDrag}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEndDrag}
        onMouseLeave={() => { if(isDragging) handleEndDrag();}}
        onClick={handleClick}
      >
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
        )}
        <h3 className="text-md font-semibold truncate text-foreground pr-8" dangerouslySetInnerHTML={{ __html: titleHtml }} />
        {note.is_pinned && (
          <Pin className="absolute top-3 right-6 h-5 w-5" style={{ color: '#a855f7' }} />
        )}
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