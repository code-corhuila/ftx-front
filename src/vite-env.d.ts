/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_MOCK?: string;
  readonly VITE_API_REAL_DOMAINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
