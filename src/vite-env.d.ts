/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MANDALA_E2E?: 'true';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
