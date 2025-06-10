import { registerPlugin } from '@capacitor/core';

import type { SharingHelperPlugin } from './definitions';

const SharingHelper = registerPlugin<SharingHelperPlugin>('SharingHelper', {
  web: () => import('./web').then((m) => new m.SharingHelperWeb()),
});

export * from './definitions';
export { SharingHelper };
