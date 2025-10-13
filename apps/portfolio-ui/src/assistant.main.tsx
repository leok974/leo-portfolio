/** @jsxImportSource preact */
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { currentLayout, loadLayout, type LayoutRecipe } from "./layout";
import { isAdmin } from "./admin";

const LAYOUT_EVENT = "layout:update";

// ---- Chat types ----
interface ChatMsg {
  role: "system" | "assistant" | "user" | "event";
  text: string;
  ts: number;
}

// ---- Helpers ----
function now() { return Date.now(); }
function fmt(ts: number) { return new Date(ts).toLocaleTimeString(); }
function uuid() {
  // prefer crypto.randomUUID if available; otherwise a tiny fallback
  const g = (crypto as any)?.randomUUID?.();
  if (g) return g as string;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; const v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16);
  });
}

/**
 * Generic SSE with auto-reconnect (jittered backoff)
 * Pass an explicit key so the hook resets when url changes.
 */
function useSSE(url: string, onEvent: (data: string) => void, onOpen?: () => void, key?: string) {
  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(1000);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        const es = new EventSource(url, { withCredentials: true });
        esRef.current = es;
        es.onopen = () => {
          backoffRef.current = 1000;
          onOpen?.();
        };
        es.onmessage = (e) => onEvent(e.data);
        es.onerror = () => {
          es.close();
          esRef.current = null;
          const delay = Math.min(backoffRef.current, 15000) + Math.floor(Math.random() * 500);
          backoffRef.current = Math.min(backoffRef.current * 2, 15000);
          setTimeout(connect, delay);
        };
      } catch {
        const delay = Math.min(backoffRef.current, 15000) + Math.floor(Math.random() * 500);
        backoffRef.current = Math.min(backoffRef.current * 2, 15000);
        setTimeout(connect, delay);
      }
    };

    connect();
    return () => { cancelled = true; esRef.current?.close(); esRef.current = null; };
  }, [url, key]);
}

/**
 * Assistant panel:
 *  - streams site/agent events from /agent/events
 *  - streams chat tokens from /chat/stream?channel=…
 *  - POSTs user text to /chat with channel id
 */
function AssistantPanel() {
  const [layout, setLayout] = useState<LayoutRecipe | null>(currentLayout());
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "system", text: "Assistant ready. Type below and press Enter.", ts: now() },
  ]);
  const [input, setInput] = useState("");
  const [channel] = useState(() => uuid());
  const [streaming, setStreaming] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(true);

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

  // ---- Site/agent events (global) ----
  const onAgentEvent = useMemo(() => (text: string) => {
    // try parse role/text JSON; else plain text
    try {
      const data = JSON.parse(text);
      const role: ChatMsg["role"] = data.role ?? "assistant";
      const body = typeof data.text === "string" ? data.text : JSON.stringify(data);
      setMsgs((p) => [...p, { role, text: body, ts: now() }]);
    } catch {
      setMsgs((p) => [...p, { role: "assistant", text, ts: now() }]);
    }
  }, []);
  useSSE("/agent/events", onAgentEvent, () => {
    setMsgs((p) => [...p, { role: "event", text: "[events] connected", ts: now() }]);
  }, "agent");

  // ---- Chat stream (per channel) ----
  // Accumulates partial tokens into the last assistant message.
  const streamKey = `chat:${channel}`;
  const lastAssistantIdxRef = useRef<number | null>(null);

  const onChatOpen = () => {
    setMsgs((p) => [...p, { role: "event", text: `[chat] stream connected (${channel})`, ts: now() }]);
  };

  const onChatEvent = (text: string) => {
    // conventions accepted:
    //  - "[DONE]" => finalize
    //  - JSON {type:"meta", ...} ignored or displayed as event
    //  - raw token strings appended to assistant message
    if (text === "[DONE]") {
      setStreaming(false);
      setMsgs((p) => [...p, { role: "event", text: "[chat] done", ts: now() }]);
      lastAssistantIdxRef.current = null;
      return;
    }
    try {
      const data = JSON.parse(text);
      if (typeof data?.text === "string") {
        appendAssistant(data.text);
        return;
      }
      // non-text JSON → show as event
      setMsgs((p) => [...p, { role: "event", text, ts: now() }]);
    } catch {
      // treat as raw token
      appendAssistant(text);
    }
  };

  function appendAssistant(token: string) {
    setMsgs((prev) => {
      // find or create the "streaming" assistant message
      let idx = lastAssistantIdxRef.current;
      let next = [...prev];
      if (idx == null) {
        idx = next.length;
        lastAssistantIdxRef.current = idx;
        next.push({ role: "assistant", text: token, ts: now() });
      } else {
        next[idx] = { ...next[idx], text: next[idx].text + token, ts: next[idx].ts };
      }
      return next;
    });
  }

  useSSE(`/chat/stream?channel=${encodeURIComponent(channel)}`, onChatEvent, onChatOpen, streamKey);

  // ---- Send a user message to /chat with channel id ----
  async function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setMsgs((p) => [...p, { role: "user", text: clean, ts: now() }]);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch("/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, channel }), // <— pass channel to bind the stream
      });
      if (!res.ok) {
        setStreaming(false);
        setMsgs((p) => [...p, { role: "event", text: `[chat] ${res.status} ${res.statusText}`, ts: now() }]);
        return;
      }
      // If server doesn't stream, fall back to non-stream JSON/text reply:
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        const reply = typeof (data.reply ?? data.text) === "string"
          ? (data.reply ?? data.text)
          : JSON.stringify(data);
        appendAssistant(reply);
        setStreaming(false);
      } else if (ct.startsWith("text/")) {
        const reply = await res.text();
        appendAssistant(reply);
        setStreaming(false);
      }
      // If server *does* stream, tokens will be delivered via SSE; we'll get [DONE] to stop.
    } catch (err: any) {
      setStreaming(false);
      setMsgs((p) => [...p, { role: "event", text: `[chat] error: ${String(err)}`, ts: now() }]);
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
    <div class={`assistant-panel${open ? "" : " hidden"}`} data-testid="assistant-panel">
      <div class="hdr" style="display:flex; align-items:center; gap:.5rem; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:.5rem;">
          <div style="font-weight:600;">Portfolio Assistant</div>
          {admin && <span class="asst-badge-admin">admin</span>}
        </div>
        <div class="asst-controls" style="display:flex; gap:.25rem;">
          {admin && (
            <>
              <button
                class="btn-sm"
                onClick={autotuneLayout}
                title="Autotune layout"
                data-testid="btn-autotune"
              >
                Autotune
              </button>
              <button
                class="btn-sm"
                onClick={resetLayout}
                title="Reset layout"
                data-testid="btn-reset"
              >
                Reset
              </button>
            </>
          )}
          <button class="btn-sm" onClick={() => setOpen(false)} title="Hide panel">
            Hide
          </button>
        </div>
      </div>

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
          placeholder="Type a message…"
          value={input}
          onInput={(e: any) => setInput(e.currentTarget.value)}
          onKeyDown={(e: any) => onKey(e as KeyboardEvent)}
          rows={1}
        />
        <button class="btn" onClick={() => void send(input)} disabled={streaming} data-testid="assistant-send">
          {streaming ? "Sending…" : "Send"}
        </button>
      </div>

      <details class="asst-debug">
        <summary>Layout</summary>
        <pre>{JSON.stringify(layout, null, 2)}</pre>
      </details>
    </div>
  );
}

const mount = document.getElementById("assistant-root");
if (mount) render(<AssistantPanel />, mount);
