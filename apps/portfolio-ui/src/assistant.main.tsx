/** @jsxImportSource preact */
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { currentLayout, loadLayout, type LayoutRecipe } from "./layout";
import { isAdmin } from "./admin";
import { initAssistantDock } from "./assistant.dock";
import { inputValue } from "../../../src/utils/event-helpers";
import { layoutEnabled } from "./utils/featureFlags";

const LAYOUT_EVENT = "layout:update";

// API base URL from environment
const API_BASE = import.meta.env.VITE_AGENT_API_BASE || "";

// ---- Chat types ----
interface ChatMsg {
  role: "system" | "assistant" | "user" | "event";
  text: string;
  ts: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ---- Helpers ----
function now() { return Date.now(); }
function fmt(ts: number) { return new Date(ts).toLocaleTimeString(); }

// ---- Chat API helpers ----
async function chatOnce(messages: ChatMessage[]) {
  const r = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    credentials: 'include',
  });
  if (!r.ok) throw new Error(`chat failed: ${r.status}`);
  const data = await r.json();
  // Extract reply from standard OpenAI-like response
  return data.content || data.choices?.[0]?.message?.content || 'No response';
}

async function chatStream(
  messages: ChatMessage[],
  { onDelta, onDone, onError }: { onDelta: (t: string) => void; onDone: () => void; onError: (e: any) => void }
) {
  const r = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    credentials: 'include',
  });
  if (!r.ok || !r.body) {
    onError(new Error(`stream failed: ${r.status}`));
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // event-stream chunks are separated by double newlines
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        // expect lines like: "data: {...}" or "data: [DONE]"
        const dataLine = chunk.split('\n').find(l => l.startsWith('data:'));
        if (!dataLine) continue;
        const data = dataLine.slice(5).trim();

        if (data === '[DONE]') {
          onDone();
          return;
        }
        try {
          const evt = JSON.parse(data);
          // Handle OpenAI-like delta structure
          const text = evt.delta?.content || evt.choices?.[0]?.delta?.content || '';
          if (text) onDelta(text);
          if (evt.done) { onDone(); return; }
        } catch {
          // Some servers send raw text; treat as delta
          onDelta(data);
        }
      }
    }
    onDone();
  } catch (e) {
    onError(e);
  }
}

/**
 * Assistant panel:
 *  - Uses POST /chat for simple requests
 *  - Uses POST /chat/stream for streaming responses
 *  - Shows offline badge when API is unavailable
 */
function AssistantPanel() {
  const [layout, setLayout] = useState<LayoutRecipe | null>(currentLayout());
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "system", text: "Assistant ready. Type below and press Enter.", ts: now() },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(true);
  const [apiOffline, setApiOffline] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  // Check admin status on mount and window focus
  useEffect(() => {
    (async () => setAdmin(await isAdmin()))();
    const onFocus = async () => setAdmin(await isAdmin());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // layout listener
  useEffect(() => {
    const onUpdate = (e: Event) => setLayout((e as CustomEvent<LayoutRecipe>).detail);
    window.addEventListener(LAYOUT_EVENT, onUpdate as EventListener);
    return () => window.removeEventListener(LAYOUT_EVENT, onUpdate as EventListener);
  }, []);

  // autoscroll
  useEffect(() => {
    const n = logRef.current;
    if (n) n.scrollTop = n.scrollHeight;
  }, [msgs]);

  // ---- Send a user message via streaming ----
  async function send(text: string) {
    const clean = text.trim();
    if (!clean) return;

    // Check if API is offline
    if (apiOffline) {
      setMsgs((p) => [...p, {
        role: "event",
        text: "[error] Assistant API is offline. Please try again later.",
        ts: now()
      }]);
      return;
    }

    setMsgs((p) => [...p, { role: "user", text: clean, ts: now() }]);
    setInput("");
    setStreaming(true);

    // Build messages from history (last 5 turns for context)
    const history: ChatMessage[] = msgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-5)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }));

    history.push({ role: 'user', content: clean });

    // Try streaming first
    let streamWorked = false;
    let accumulatedText = '';

    try {
      await chatStream(history, {
        onDelta: (delta) => {
          streamWorked = true;
          accumulatedText += delta;
          // Update last message or add new one
          setMsgs((p) => {
            const last = p[p.length - 1];
            if (last && last.role === 'assistant' && last.ts > now() - 5000) {
              // Update existing assistant message
              return [...p.slice(0, -1), { ...last, text: accumulatedText }];
            } else {
              // Create new assistant message
              return [...p, { role: 'assistant', text: accumulatedText, ts: now() }];
            }
          });
        },
        onDone: () => {
          setStreaming(false);
          setApiOffline(false);
        },
        onError: (err) => {
          console.error('[chat] stream error:', err);
          // Don't throw, will fall back to non-streaming
        }
      });
    } catch (streamErr) {
      console.warn('[chat] streaming failed, trying non-stream:', streamErr);
    }

    // Fallback to non-streaming if stream didn't work
    if (!streamWorked) {
      try {
        const reply = await chatOnce(history);
        setMsgs((p) => [...p, { role: "assistant", text: reply, ts: now() }]);
        setApiOffline(false);
      } catch (err: any) {
        const errorMsg = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')
          ? "[error] Cannot reach assistant API - please check connection"
          : `[error] ${String(err)}`;
        setMsgs((p) => [...p, { role: "event", text: errorMsg, ts: now() }]);

        if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
          setApiOffline(true);
        }
      }
      setStreaming(false);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  // ---- Admin functions ----
  async function autotuneLayout() {
    try {
      const res = await fetch("/api/layout/autotune", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setMsgs((p) => [...p, { role: "event", text: `[autotune] ${res.status} ${res.statusText}`, ts: now() }]);
        return;
      }
      setMsgs((p) => [...p, { role: "event", text: "[autotune] layout optimized", ts: now() }]);
      await loadLayout(); // reload layout
    } catch (err: any) {
      setMsgs((p) => [...p, { role: "event", text: `[autotune] error: ${String(err)}`, ts: now() }]);
    }
  }

  async function resetLayout() {
    try {
      const res = await fetch("/api/layout/reset", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setMsgs((p) => [...p, { role: "event", text: `[reset] ${res.status} ${res.statusText}`, ts: now() }]);
        return;
      }
      setMsgs((p) => [...p, { role: "event", text: "[reset] layout reset to default", ts: now() }]);
      await loadLayout(); // reload layout
    } catch (err: any) {
      setMsgs((p) => [...p, { role: "event", text: `[reset] error: ${String(err)}`, ts: now() }]);
    }
  }

  return (
    <div
      id="chat-dock"
      class={`assistant-panel${open ? "" : " hidden"}`}
      data-testid="chat-dock"
      role="region"
      aria-label="Portfolio Assistant"
      aria-expanded="true"
    >
      <header class="dock-head">
        <div style="display:flex; align-items:center; gap:.5rem;">
          <strong style="font-weight:600;">Chat</strong>
          {admin && <span class="asst-badge-admin">admin</span>}
          {apiOffline && (
            <span
              class="asst-badge-offline"
              title="Assistant API is offline"
              style="background:#ef4444; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;"
            >
              offline
            </span>
          )}
        </div>
        <div class="asst-controls" style="display:flex; gap:.25rem;">
          {admin && (
            <>
              <button
                class="btn-sm"
                onClick={autotuneLayout}
                title="Admin only: Autotune layout"
                data-testid="btn-autotune"
              >
                Autotune
              </button>
              <button
                class="btn-sm"
                onClick={resetLayout}
                title="Admin only: Reset layout"
                data-testid="btn-reset"
              >
                Reset
              </button>
            </>
          )}
          <button
            id="dock-toggle"
            type="button"
            class="dock-btn btn-sm"
            aria-controls="assistant-panel"
            aria-expanded="true"
            title="Collapse (C)"
            data-testid="dock-toggle"
          >
            ▸
          </button>
        </div>
      </header>

      <div class="dock-body">
        <div ref={logRef} class="asst-log" data-testid="assistant-log">
        {msgs.map((m, i) => (
          <div key={i} class={`row ${m.role}`}>
            <span class="ts">{fmt(m.ts)}</span>
            <span class="bubble">{m.text}</span>
          </div>
        ))}
        {streaming && (
          <div class="row event">
            <span class="ts">{fmt(now())}</span>
            <span class="bubble">…streaming</span>
          </div>
        )}
      </div>

      <div class="asst-compose">
        <textarea
          aria-label="Message"
          placeholder={apiOffline ? "Assistant offline - cannot send messages" : "Type a message…"}
          value={input}
          onInput={(e: any) => setInput(inputValue(e))}
          onKeyDown={(e: any) => onKey(e as KeyboardEvent)}
          rows={1}
          disabled={apiOffline}
          style={apiOffline ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        />
        <button
          class="btn"
          onClick={() => void send(input)}
          disabled={streaming || apiOffline}
          data-testid="assistant-send"
          title={apiOffline ? "API is offline" : undefined}
        >
          {streaming ? "Sending…" : apiOffline ? "Offline" : "Send"}
        </button>
      </div>

      {layoutEnabled() && (
        <details class="asst-debug" data-testid="assistant-layout-toggle">
          <summary>Layout</summary>
          <div data-testid="layout-section">
            {!layout ? (
              <div style="padding: 1rem; color: #94a3b8;" data-testid="assistant-layout-empty">
                Loading layout model...
                <button
                  type="button"
                  class="btn-sm"
                  onClick={loadLayout}
                  style="margin-left: 0.5rem;"
                  data-testid="assistant-layout-refresh"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <pre data-testid="assistant-layout-json">{JSON.stringify(layout, null, 2)}</pre>
            )}
          </div>
        </details>
      )}
      </div>

      {/* Slim tab stays visible when collapsed */}
      <button
        id="dock-tab"
        class="dock-tab"
        aria-controls="assistant-panel"
        aria-expanded="false"
        title="Expand (C)"
        data-testid="dock-tab"
      >
        Chat
      </button>
    </div>
  );
}

const mount = document.getElementById("assistant-root");
if (mount) {
  render(<AssistantPanel />, mount);
  // Initialize dock controls after render
  initAssistantDock();
}
