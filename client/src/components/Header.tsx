import { Search, X, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-provider";
// import UserProfile from "@/components/UserProfile"; // Removed

interface HeaderProps {
  isEditing: boolean;
  onDone: () => void;
  onBack: () => void;
}

export default function Header({ isEditing, onDone, onBack }: HeaderProps) {
  return (
    <header className="border-b border-border/50 py-1.5 px-3 flex justify-between items-center bg-background/85 backdrop-blur-lg sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-0.5 md:gap-2">
        {isEditing ? (
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="text-primary hover:text-primary/90 hover:bg-primary/5 text-sm font-medium rounded-md transition-colors px-3 py-1.5 flex items-center gap-1.5"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4" /> 
            <span>Notes</span>
          </Button>
        ) : (
          <div className="flex items-center gap-0.5 h-9">
            <img 
              src="/MinaIcon.svg" 
              alt="Mina" 
              className="h-8 w-8 object-contain" 
              style={{ marginBottom: '-1px' }}
            />
            <h1 className="text-lg font-semibold text-primary tracking-tight leading-none flex items-center" style={{ marginTop: '1px' }}>Mina</h1>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 h-9">
        {isEditing ? (
          <Button 
            variant="ghost" 
            onClick={onDone}
            className="text-primary hover:text-primary/90 hover:bg-primary/5 text-sm font-medium rounded-full transition-colors px-4 py-1.5"
            size="sm"
          >
            Done
          </Button>
        ) : (
          <>
            {/* <Button 
              variant=\"ghost\" 
              size=\"icon\" 
              aria-label=\"Search notes\"
              className=\"rounded-full hover:bg-secondary/40 h-8 w-8\"
            >
              <Search className=\"h-[18px] w-[18px] text-foreground/80\" />
            </Button> */}
            <ThemeToggle />
            {/* <UserProfile /> */}{/* Removed */}
          </>
        )}
      </div>
    </header>
  );
}
