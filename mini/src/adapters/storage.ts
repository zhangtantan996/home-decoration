import { storage, taroStorage } from '@/utils/storage';

import type { StorageAdapter } from './types';

const storageAdapter: StorageAdapter = {
  get: storage.get,
  set: storage.set,
  remove: storage.remove,
};

export const miniStorageAdapter = storageAdapter;
export { taroStorage as miniPersistStorage };
