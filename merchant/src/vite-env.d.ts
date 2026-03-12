/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_ROUTER_BASENAME?: string;
  readonly VITE_TINODE_HOST?: string;
  readonly VITE_TINODE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
