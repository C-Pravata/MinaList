import { useState, useRef, useEffect } from 'react';
import { Trash2, Star, Calendar, Clock } from 'lucide-react';
import { Note } from '@shared/schema';
import { formatDistanceToNow, formatFullDate } from '@/lib/formatDate';
import { Button } from '@/components/ui/button';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SwipeableNoteProps {
  note: Note;
  isActive: boolean;
  onSelect: (note: Note) => void;
  onDelete: (id: number) => void;
}

export default function SwipeableNote({ note, isActive, onSelect, onDelete }: SwipeableNoteProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const controls = useAnimation();
  const deleteThreshold = -80;
  
  const getPreviewText = (content: string) => {
    // Remove HTML tags for the preview
    const textOnly = content.replace(/<\/?[^>]+(>|$)/g, "");
    return textOnly.substring(0, 60) + (textOnly.length > 60 ? "..." : "");
  };
  
  // Reset position when active note changes
  useEffect(() => {
    controls.start({ x: 0 });
  }, [isActive, controls]);
  
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < deleteThreshold) {
      controls.start({ x: deleteThreshold });
      setIsDeleting(true);
    } else {
      controls.start({ x: 0 });
      setIsDeleting(false);
    }
  };
  
  const handleClick = () => {
    if (!isDeleting) {
      onSelect(note);
    }
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Animate the note out before actually deleting it
    controls.start({ 
      x: -500, 
      opacity: 0,
      transition: { duration: 0.3 }
    }).then(() => {
      onDelete(note.id);
    });
  };
  
  // Format the date for the tooltip
  const formattedDate = formatFullDate(new Date(note.updated_at));
  
  return (
    <div className="relative overflow-hidden">
      {/* Delete button area in background */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-white w-20">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: isDeleting ? 1 : 0.8,
            opacity: isDeleting ? 1 : 0
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-white hover:bg-red-600/30 transition-colors"
            onClick={handleDelete}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
      
      {/* The note content with drag capability */}
      <motion.div
        drag="x"
        dragConstraints={{ left: deleteThreshold, right: 0 }}
        dragElastic={0.1}
        dragDirectionLock
        onDragEnd={handleDragEnd}
        animate={controls}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={`note-item p-4 cursor-pointer relative ${isActive ? "active" : ""}`}
      >
        {/* Active indicator */}
        <motion.div 
          className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: isActive ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ originY: 0 }}
        />
        
        {/* Note pinned indicator - show only if note is pinned */}
        {note.is_pinned && (
          <motion.div 
            className="absolute right-2 top-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          </motion.div>
        )}
        
        {/* Note content */}
        <div className={`${note.is_pinned ? 'pr-6' : ''}`}>
          <h3 className="font-medium text-base truncate">{note.title || "Untitled"}</h3>
          <p className="text-sm text-muted-foreground truncate pr-4 mt-1">
            {getPreviewText(note.content)}
          </p>
        </div>
        
        {/* Footer with metadata */}
        <div className="flex items-center justify-between mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(new Date(note.updated_at))}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Last updated: {formattedDate}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Word/character count */}
          <span className="text-xs text-muted-foreground">
            {getPreviewText(note.content).split(' ').length} words
          </span>
        </div>
      </motion.div>
    </div>
  );
}