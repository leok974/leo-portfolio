export interface SSEHandler {
  onMeta?: (meta: any) => void;
  onData?: (chunk: any) => void;
  onDone?: () => void;
  onError?: (err: unknown) => void;
  // Called when a heartbeat/keepalive is observed (e.g., comment ':' or event: ping)
  onHeartbeat?: () => void;
}

// Minimal parser for "event:" / "data:" Server-Sent Events
export async function readSSE(resp: Response, h: SSEHandler) {
  if (!resp.ok) {
    throw new Error(`SSE ${resp.status}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    // accept anyway; our tests will send event-stream, but some proxies strip it
    console.warn('[sse] unexpected content-type:', contentType);
  }

  if (!resp.body) {
    throw new Error('SSE response has no body');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buf += decoder.decode(value, { stream: true });
      }

      let sep: number;
      while ((sep = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, sep).trim();
        buf = buf.slice(sep + 2);
        if (!frame) continue;

        let evt: string | undefined;
        let dat: string | undefined;
        let sawComment = false;
        for (const line of frame.split('\n')) {
          if (line.startsWith(':')) sawComment = true;
          if (line.startsWith('event:')) evt = line.slice(6).trim();
          if (line.startsWith('data:')) dat = line.slice(5).trim();
        }

        // Heartbeats: comment frames or explicit ping events
        if (sawComment || evt === 'ping') {
          try { h.onHeartbeat?.(); } catch {}
          // Do not treat as data/meta/done; continue to next frame
          continue;
        }

        if (evt === 'meta' && dat) {
          try {
            h.onMeta?.(JSON.parse(dat));
          } catch (e) {
            console.warn('[sse] meta parse error', e);
          }
        } else if (evt === 'data' && dat) {
          try {
            h.onData?.(JSON.parse(dat));
          } catch (e) {
            console.warn('[sse] data parse error', e);
          }
        } else if (evt === 'done') {
          h.onDone?.();
        }
      }
    }
  } catch (e) {
    h.onError?.(e);
    throw e;
  }
}
