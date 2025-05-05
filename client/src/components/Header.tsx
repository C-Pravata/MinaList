import { Search, X, Check, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

interface HeaderProps {
  isEditing: boolean;
  onDone: () => void;
  onCancel: () => void;
}

export default function Header({ isEditing, onDone, onCancel }: HeaderProps) {
  return (
    <header className="border-b border-border p-3 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-2 md:gap-4">
        {isEditing ? (
          <Button 
            variant="ghost" 
            onClick={onCancel}
            className="text-red-500 hover:text-red-600/90 hover:bg-red-500/5 text-sm font-medium rounded-full transition-colors"
            size="sm"
          >
            Cancel
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold text-primary dark:text-primary">Mina</h1>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {isEditing ? (
          <Button 
            variant="ghost" 
            onClick={onDone}
            className="text-primary hover:text-primary/90 hover:bg-primary/5 text-sm font-medium rounded-full transition-colors"
            size="sm"
          >
            Done
          </Button>
        ) : (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              aria-label="Search notes"
              className="rounded-full hover:bg-secondary/40"
            >
              <Search className="h-5 w-5" />
            </Button>
            <ThemeToggle />
          </>
        )}
      </div>
    </header>
  );
}
