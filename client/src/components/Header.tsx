import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

interface HeaderProps {
  toggleSidebar: () => void;
  sidebarOpen: boolean;
}

export default function Header({ toggleSidebar, sidebarOpen }: HeaderProps) {
  return (
    <header className="border-b border-border p-4 flex justify-between items-center bg-background sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-2 md:gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold text-primary dark:text-primary">Purple Notes</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Search notes"
        >
          <Search className="h-5 w-5" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
