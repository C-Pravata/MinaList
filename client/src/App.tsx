import { Route, Switch, Redirect, useLocation } from "wouter";
import NotesPage from "./pages/notes-page";
import NotePage from "./pages/note-page";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { NotesProvider, useNotesContext } from "@/lib/notesContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { PluginListenerHandle } from '@capacitor/core';
import { SharingHelper, SharedItem } from '@minanotes/sharing-helper';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <NotesProvider>
          <TooltipProvider>
            <AppContent />
          </TooltipProvider>
        </NotesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const notesContext = useNotesContext();
  const [, navigate] = useLocation();
  const appStateListenerRef = useRef<PluginListenerHandle | null>(null);

  useEffect(() => {
    const initializeListener = async () => {
      if (appStateListenerRef.current) {
        await appStateListenerRef.current.remove();
      }
      appStateListenerRef.current = await CapApp.addListener('appStateChange', handleAppStateChange);
    };

    const handleAppStateChange = async (state: { isActive: boolean }) => {
      if (state.isActive) {
        console.log('App became active, checking for shared item...');
        try {
          const sharedItem: SharedItem = await SharingHelper.checkForSharedItem();
          console.log('Shared item received in app:', JSON.stringify(sharedItem, null, 2));

          if (sharedItem && sharedItem.type && sharedItem.value) {
            const newOrUpdatedNote = await notesContext.handleSharedItem(sharedItem);
            if (newOrUpdatedNote && newOrUpdatedNote.id) {
              console.log(`App.tsx: Shared item processed, new note ID: ${newOrUpdatedNote.id}. Navigating to dashboard.`);
              navigate('/', { replace: true });
            }
          } else {
            console.log('No actionable shared item found or item is empty after checking.');
          }
        } catch (error) {
          console.error('Error checking for shared item:', error);
        }
      }
    };

    initializeListener();

    const initialCheckTimeout = setTimeout(() => {
        handleAppStateChange({ isActive: true });
    }, 1000);

    return () => {
      clearTimeout(initialCheckTimeout);
      const removeListener = async () => {
        if (appStateListenerRef.current) {
          await appStateListenerRef.current.remove();
          appStateListenerRef.current = null;
        }
      };
      removeListener();
    };
  }, [notesContext, navigate]);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={NotesPage} />
        <Route path="/notes/:id" component={NotePage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
      <Toaster />
    </Layout>
  );
}
