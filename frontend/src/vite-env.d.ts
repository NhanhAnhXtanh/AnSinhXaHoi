/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. See `src/shared/api/constants.ts`. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
