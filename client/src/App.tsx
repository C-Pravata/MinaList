import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import { NotesProvider } from "@/lib/notesContext";
import { ThemeProvider } from "@/components/ThemeToggle";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="theme">
        <NotesProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </NotesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
