import { WebPlugin } from '@capacitor/core';

import type { SharingHelperPlugin, SharedItem } from './definitions';

export class SharingHelperWeb
  extends WebPlugin
  implements SharingHelperPlugin
{
  async checkForSharedItem(): Promise<SharedItem> {
    console.log('SharingHelper.checkForSharedItem called on web - no action taken.');
    return { 
      type: undefined, 
      value: undefined, 
      text: undefined, 
      base64Data: undefined, 
      filename: undefined, 
      errorLoadingImage: undefined 
    };
  }

  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
