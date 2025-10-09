export interface EventPayload {
  visitor_id: string;
  event: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

const BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";
const SAMPLE = Number(import.meta.env.VITE_METRICS_SAMPLE_RATE ?? "1");

function sampled(): boolean {
  return Math.random() < SAMPLE;
}

export function getVisitorId(): string {
  const k = "visitor_id";
  let v = localStorage.getItem(k);
  if (!v) {
    v = `v-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    localStorage.setItem(k, v);
  }
  return v;
}

export async function sendEvent(evt: EventPayload, signal?: AbortSignal) {
  if (!sampled()) return { ok: true, sampledOut: true } as any;

  const body = {
    visitor_id: evt.visitor_id ?? getVisitorId(),
    event: evt.event,
    timestamp: evt.timestamp ?? new Date().toISOString(),
    metadata: evt.metadata ?? {},
  };
  const res = await fetch(`${BASE}/api/metrics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`metrics event failed: ${res.status}`);
  return res.json();
}

export async function fetchSnapshot(limit = 50, signal?: AbortSignal) {
  const res = await fetch(`${BASE}/api/metrics/behavior?limit=${limit}`, { signal });
  if (!res.ok) throw new Error(`snapshot failed: ${res.status}`);
  return res.json();
}
