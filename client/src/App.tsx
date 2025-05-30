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
import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { SharingHelper, SharedItem } from '@minanotes/sharing-helper';

export default function App() {
  useEffect(() => {
    const handleAppStateChange = async (state: { isActive: boolean }) => {
      if (state.isActive) {
        console.log('App became active, checking for shared item...');
        try {
          const sharedItem: SharedItem = await SharingHelper.checkForSharedItem();
          console.log('Shared item received in app:', JSON.stringify(sharedItem, null, 2));

          if (sharedItem && sharedItem.type && sharedItem.value) {
            // TODO: Process the shared item!
            // For example:
            // if (sharedItem.type === 'url') {
            //   alert(`Shared URL: ${sharedItem.value}`);
            //   // Here you would navigate to a new note or current note and insert the URL
            // } else if (sharedItem.type === 'image') {
            //   alert(`Shared Image Path: ${sharedItem.value}`);
            //   // Here you would:
            //   // 1. Copy the image from sharedItem.value (app group path) to a web-accessible location
            //   //    using Capacitor Filesystem.
            //   // 2. Then create a new note or add to current note with the image.
            // }
            alert(`Received item from Share Extension: ${sharedItem.type} - Value: ${sharedItem.value?.substring(0, 100)}...`); // Temporary alert
          } else {
            console.log('No actionable shared item found or item is empty after checking.');
          }
        } catch (error) {
          console.error('Error checking for shared item:', error);
          // alert('Error processing shared content.');
        }
      }
    };

    const listener = CapApp.addListener('appStateChange', handleAppStateChange);

    // Also check once on initial app load after a brief delay to ensure plugin is ready
    // and app is fully initialized.
    setTimeout(() => {
        handleAppStateChange({ isActive: true });
    }, 1000); // 1 second delay

    return () => {
      listener.remove();
    };
  }, []);

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
