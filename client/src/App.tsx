import { Route, Switch, Redirect, useLocation } from "wouter";
import NotesPage from "./pages/notes-page";
import NotePage from "./pages/note-page";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, API_BASE_URL } from "./lib/queryClient";
import { NotesProvider, useNotesContext } from "@/lib/notesContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { CapacitorHttp, HttpResponse, PluginListenerHandle } from '@capacitor/core';
import { SharingHelper, SharedItem } from '@minanotes/sharing-helper';
import { getDeviceId } from '@/lib/deviceId';

// Helper to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(blob);
  });
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <NotesProvider>
          <TooltipProvider>
            <AppMain />
          </TooltipProvider>
        </NotesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppMain() {
  const notesContext = useNotesContext();
  const [, navigate] = useLocation();
  const [appStateListenerHandle, setAppStateListenerHandle] = useState<PluginListenerHandle | null>(null);

  useEffect(() => {
    const processSharedItem = async (sharedItem: SharedItem) => {
      if (!notesContext) {
        console.error("NotesContext not available for processing shared item in AppMain.");
        return;
      }
      console.log('Processing shared item in app (AppMain):', JSON.stringify(sharedItem, null, 2));
      const { createNote, updateNote, setActiveNote } = notesContext;

      const noteTitle = sharedItem.text?.trim() || (sharedItem.type === 'url' && sharedItem.value ? sharedItem.value : "Shared Content");
      let noteContent = "";

      if (sharedItem.type === 'image') {
        if (sharedItem.errorLoadingImage) {
          console.error("Native plugin failed to load image:", sharedItem.errorLoadingImage);
          noteContent = sharedItem.text?.trim() ? `<p>${sharedItem.text.trim()}</p>` : "<p>(Error: Could not load shared image data natively)</p>";
          alert("Error: Could not load shared image data. Note will contain text if provided, or an error message.");
        } else if (sharedItem.base64Data && sharedItem.filename) {
          try {
            console.log("Shared item is an image. Filename:", sharedItem.filename);
            // Prepend the necessary data URI scheme if not already present (it should be from native)
            const fullBase64ImageData = sharedItem.base64Data.startsWith('data:image') 
                                          ? sharedItem.base64Data 
                                          : `data:image/png;base64,${sharedItem.base64Data}`; // Default to png if scheme missing

            console.log("Uploading shared image (from base64Data) to backend...");
            const deviceId = getDeviceId();
            if (!deviceId) {
              console.error("Device ID not found for image upload.");
              alert("Error: Device ID missing. Cannot upload shared image.");
              // Skip image upload, proceed with text if any
              noteContent = sharedItem.text?.trim() ? `<p>${sharedItem.text.trim()}</p>` : "<p>(Failed to upload image: Missing Device ID)</p>";
            } else {
                const uploadResponse: HttpResponse = await CapacitorHttp.request({
                  method: 'POST',
                  url: `${API_BASE_URL}/api/upload`,
                  headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
                  data: {
                    file_data_url: fullBase64ImageData,
                    original_filename: sharedItem.filename,
                    original_filetype: fullBase64ImageData.substring(fullBase64ImageData.indexOf(':') + 1, fullBase64ImageData.indexOf(';')), // Extract type from data URI
                  },
                });

                if (uploadResponse.status === 200 && uploadResponse.data && uploadResponse.data.url) {
                  const imageUrl = `${API_BASE_URL}${uploadResponse.data.url}`;
                  noteContent = `<p><img src=\"${imageUrl}\" alt=\"Shared Image\"></p>`;
                  if (sharedItem.text?.trim()) {
                    noteContent = `<p>${sharedItem.text.trim()}</p>${noteContent}`;
                  }
                } else {
                  console.error("Failed to upload shared image (from base64Data):", uploadResponse);
                  noteContent = sharedItem.text?.trim() ? `<p>${sharedItem.text.trim()}</p>` : "<p>(Failed to upload shared image)</p>";
                  alert("Failed to upload shared image. Note will contain text if provided, or an error message.");
                }
            }
          } catch (e) {
            console.error("Error processing shared image (from base64Data):", e);
            noteContent = sharedItem.text?.trim() ? `<p>${sharedItem.text.trim()}</p>` : "<p>(Error processing shared image)</p>";
            alert("Error handling shared image. Note will contain text if provided, or an error message.");
          }
        } else {
            // Image type, but no base64Data or filename
            console.error("Image type shared, but missing base64Data or filename.");
            noteContent = sharedItem.text?.trim() ? `<p>${sharedItem.text.trim()}</p>` : "<p>(Error: Incomplete image data received)</p>";
            alert("Error: Incomplete image data received. Note will contain text if provided, or an error message.");
        }
      } else if (sharedItem.type === 'url' && sharedItem.value) {
        noteContent = `<p><a href=\"${sharedItem.value}\" target=\"_blank\">${sharedItem.value}</a></p>`;
        if (sharedItem.text?.trim()) {
          noteContent = `<p>${sharedItem.text.trim()}</p>${noteContent}`;
        }
      } else if (sharedItem.text?.trim()) {
        noteContent = `<p>${sharedItem.text.trim()}</p>`;
      }

      if (!noteTitle && !noteContent.trim()) {
        console.log("No title or content to save from shared item. Aborting note creation.");
        return;
      }

      try {
        console.log(`Creating new note. Title: "${noteTitle}", Content (snippet): "${noteContent.substring(0, 100)}..."`);
        const newNote = await createNote();
        if (newNote && newNote.id) {
          await updateNote(newNote.id, { title: noteTitle, content: noteContent });
          console.log("New note created and updated from shared item:", newNote.id);
          console.log("Shared content processed. Navigating to dashboard.");
          navigate("/", { replace: true });
        } else {
          console.error("Failed to create a new note for shared item.");
          alert("Error: Could not create a new note from shared content.");
        }
      } catch (e) {
        console.error("Error creating/updating note from shared item:", e);
        alert("Error saving shared content as a new note.");
      }
    };

    const handleAppStateChange = async (state: { isActive: boolean }) => {
      if (state.isActive) {
        console.log('App became active, checking for shared item (AppMain)...');
        try {
          const sharedItemResult: SharedItem = await SharingHelper.checkForSharedItem();
          if (sharedItemResult && (sharedItemResult.type || sharedItemResult.value || sharedItemResult.text?.trim())) {
            await processSharedItem(sharedItemResult);
          } else {
            console.log('No actionable shared item data returned from plugin or item is empty (AppMain).');
          }
        } catch (error) {
          console.error('Error checking for shared item via plugin (AppMain):', error);
        }
      }
    };

    CapApp.addListener('appStateChange', handleAppStateChange).then((handle: PluginListenerHandle) => {
        setAppStateListenerHandle(handle);
    });

    const checkInitialShare = async () => {
      if (Capacitor.isNativePlatform()) {
        console.log('Initial app load, checking for shared item (AppMain)...');
        try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const sharedItemResult: SharedItem = await SharingHelper.checkForSharedItem();
          if (sharedItemResult && (sharedItemResult.type || sharedItemResult.value || sharedItemResult.text?.trim())) {
            await processSharedItem(sharedItemResult);
          } else {
            console.log('No actionable shared item data on initial check or item is empty (AppMain).');
          }
        } catch (error) {
          console.error('Error checking for shared item on initial load (AppMain):', error);
        }
      }
    };
    checkInitialShare();

    return () => {
      appStateListenerHandle?.remove();
    };
  }, [notesContext, navigate]);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={NotesPage} />
        <Route path="/notes/:id" component={NotePage} />
        <Route><Redirect to="/" /></Route>
      </Switch>
      <Toaster />
    </Layout>
  );
}
