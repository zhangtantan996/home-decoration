/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_API_URL: string;
  readonly VITE_ROUTER_BASENAME: string;
  readonly VITE_DEV_WATCH_POLLING: string;
  readonly VITE_SUPERVISOR_PORTAL_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
