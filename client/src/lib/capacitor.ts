import { Capacitor } from '@capacitor/core';
import { ShareService } from '@/services/ShareService';
import { queryClient } from './queryClient';
import { toast } from '@/hooks/use-toast';

/**
 * Initialize Capacitor platform-specific features
 * Call this once at app startup
 */
export function initializeCapacitor() {
  // Setup web visibility change events to refresh data
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    }
  });
  
  // Log platform information
  if (Capacitor.isNativePlatform()) {
    console.log('Running on native platform:', Capacitor.getPlatform());
  } else {
    console.log('Running on web platform');
  }
  
  // Set up share target to receive content from other apps
  ShareService.setupShareTarget((sharedData) => {
    console.log('App opened via share intent:', sharedData);
    
    if (sharedData.text) {
      // If the app receives shared text, we can create a new note with it
      createNewNoteFromSharedContent(sharedData);
    }
  });
  
  console.log('Capacitor initialized');
}

/**
 * Creates a new note from shared content
 */
async function createNewNoteFromSharedContent(content: { title?: string, text?: string, url?: string }) {
  try {
    // Prepare note content - combine text and URL if available
    let noteContent = '';
    
    if (content.text) {
      noteContent += content.text;
    }
    
    if (content.url) {
      if (noteContent) noteContent += '\n\n';
      noteContent += `<a href="${content.url}" target="_blank">${content.url}</a>`;
    }
    
    // Can be expanded to create a note via the API
    // This is just a placeholder. The actual implementation would depend on 
    // how notes are created in the application.
    const title = content.title || 'Shared Content';
    
    console.log("Content shared and saved as a new note (placeholder).");
    // Show a toast to let the user know a note was created
    // toast({
    //   title: 'Content shared',
    //   description: 'The shared content has been saved as a new note.',
    // });
    
  } catch (error) {
    console.error('Error creating note from shared content:', error);
    // toast({
    //   title: 'Error',
    //   description: 'Failed to create note from shared content.',
    //   variant: 'destructive',
    // });
  }
}