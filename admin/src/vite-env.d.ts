/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TINODE_HOST?: string;
  readonly VITE_TINODE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
