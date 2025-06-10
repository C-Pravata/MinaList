export interface SharedItem {
  type?: 'url' | 'image' | string; // Type of shared item (url, image, or other future types)
  value?: string;                   // For URL: the URL string. For Image: original path (optional, for debug).
  text?: string;                    // Optional text content shared by the user
  base64Data?: string;              // For Image: base64 encoded image data.
  filename?: string;                // For Image: original filename.
  errorLoadingImage?: string;       // Optional error message if native side failed to load image
}

export interface SharingHelperPlugin {
  /**
   * Checks for an item shared via the iOS Share Extension.
   * Returns the shared item if found, or an empty object if nothing is pending.
   * The item is cleared from the share queue after being retrieved.
   */
  checkForSharedItem(): Promise<SharedItem>;
}
