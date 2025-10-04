export async function waitRagReady(baseUrl: string, timeoutMs = 30_000, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  let last: any = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(new URL('/api/ready', baseUrl));
      if (res.ok) {
        const data = await res.json();
        last = data;
        if (data?.rag?.ok === true) return data;
      }
    } catch {}
    await new Promise(r => setTimeout(r, intervalMs));
  }

  const err = new Error(`RAG not ready within ${timeoutMs}ms`);
  ;(err as any).last = last;
  throw err;
}
