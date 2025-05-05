import { Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

interface HeaderProps {
  isEditing: boolean;
  onDone: () => void;
  onCancel: () => void;
}

export default function Header({ isEditing, onDone, onCancel }: HeaderProps) {
  return (
    <header className="border-b border-border p-4 flex justify-between items-center bg-background sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-2 md:gap-4">
        {isEditing ? (
          <Button 
            variant="ghost" 
            onClick={onCancel}
            className="text-red-500 hover:text-red-600"
          >
            Cancel
          </Button>
        ) : (
          <h1 className="text-xl font-semibold text-primary dark:text-primary">Purple Notes</h1>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {isEditing ? (
          <Button 
            variant="ghost" 
            onClick={onDone}
            className="text-primary hover:text-primary/90"
          >
            Done
          </Button>
        ) : (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              aria-label="Search notes"
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
