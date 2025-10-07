/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEATURE_AGENT_UPLOADS?: string
  // Add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Extend Window interface with custom properties used in the application
interface Window {
  __galleryReady?: boolean;
  consent?: {
    get?: () => any;
    set?: (key: string, value: boolean) => void;
  };
}
