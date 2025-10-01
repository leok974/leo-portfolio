// Ambient assistant global window extensions
// Keeps JS sources simpler (JSDoc inference) while satisfying TypeScript during checkJs.

export {}; // ensure this file is treated as a module

declare global {
  interface Window {
    AGENT_BASE_URL?: string;
    AgentStatus?: { updateServed: (s: string) => void };
    startStream?: (question: string, opts?: { logEl?: HTMLElement }) => void | Promise<void>;
  }
}
