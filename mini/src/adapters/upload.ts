import { uploadFile } from '@/services/uploads';

import type { UploadAdapter } from './types';

const uploadAdapter: UploadAdapter = {
  uploadFile,
};

export const miniUploadAdapter = uploadAdapter;
