import { Route, Switch, Redirect } from "wouter";
import NotesPage from "./pages/notes-page";
import NotePage from "./pages/note-page";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { NotesProvider } from "@/lib/notesContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <NotesProvider>
          <TooltipProvider>
            <Layout>
              <Switch>
                <Route path="/" component={NotesPage} />
                <Route path="/notes/:id" component={NotePage} />
                <Route>
                  <Redirect to="/" />
                </Route>
              </Switch>
            </Layout>
            <Toaster />
          </TooltipProvider>
        </NotesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
