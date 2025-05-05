import { Share } from '@capacitor/share';

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export class ShareService {
  /**
   * Share content using the device's native share dialog
   * 
   * @param options Share options with title, text, url or dialogTitle
   * @returns Promise that resolves when sharing is completed or rejected
   */
  static async share(options: ShareOptions): Promise<void> {
    try {
      // Check if the Share API is available (mobile or web share API)
      await Share.canShare();
      
      // Share the content
      await Share.share({
        title: options.title || 'Shared from Mina',
        text: options.text || '',
        url: options.url || '',
        dialogTitle: options.dialogTitle || 'Share with friends',
      });
    } catch (error) {
      console.error('Error sharing content:', error);
      
      // Fallback for web environments where Share API isn't supported
      if (navigator.clipboard && options.text) {
        try {
          await navigator.clipboard.writeText(options.text);
          alert('Content copied to clipboard!');
        } catch (clipboardError) {
          console.error('Clipboard fallback failed:', clipboardError);
          throw new Error('Sharing is not supported on this device');
        }
      } else {
        throw new Error('Sharing is not supported on this device');
      }
    }
  }

  /**
   * Receive shared content from other apps (when app is opened via share intent)
   * This needs to be called early in the app lifecycle
   * 
   * @param callback Function that will be called with the shared content
   */
  static setupShareTarget(callback: (data: { title?: string, text?: string, url?: string }) => void): void {
    // This is a placeholder. In a real implementation, we would:
    // 1. Register the app as a share target in the native platform
    // 2. Set up listeners for incoming share intents
    // 3. Call the callback with the shared data
    
    // For Android, this would be handled in the MainActivity.java
    // For iOS, this would be in AppDelegate.swift
    
    // Web implementation could use Web Share Target API
    // https://web.dev/web-share-target/
    
    // Listen for custom events that might be dispatched from platform code
    window.addEventListener('appOpenedViaShareIntent', (event: any) => {
      if (event.detail && typeof callback === 'function') {
        callback(event.detail);
      }
    });
  }
}