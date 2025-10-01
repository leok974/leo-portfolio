// Global type augmentations for runtime JS that attaches properties to window
// Provides minimal surfaces to satisfy TypeScript when checkJs=true

export {}; // ensure this file is a module

declare global {
  interface Window {
    API?: {
      base: string;
      http: (path: string, opts?: any) => Promise<any>;
      status: () => Promise<any>;
      chat: (messages: any[]) => Promise<any>;
      streamChat: (messages: any[], opts?: { signal?: AbortSignal }) => Promise<any>;
    };
    AGENT_BASE_URL?: string;
    __API_BASE__?: string;
    __BUILD_ID__?: string;            // from meta/header, optional
    __STATUS_SOURCE__?: '/status/summary' | '/llm/health' | '/ready';
    AgentStatus?: any; // intentionally any (dynamic augmentation elsewhere)
    __AGENT_STATUS_INIT__?: boolean;
    __assistantDockMounted?: boolean;
  }
}
