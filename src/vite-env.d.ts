/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEATURE_AGENT_UPLOADS?: string
  // Add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
