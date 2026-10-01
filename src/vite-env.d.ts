/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TARGET?: 'tauri' | 'web' | 'unified';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
