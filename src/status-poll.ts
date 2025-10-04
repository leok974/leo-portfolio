export interface Summary {
  backendHealthy?: boolean;
  ollama?: { primary_model_present?: boolean; status?: string };
  llm?: { path?: string; primary_model_present?: boolean; model?: string };
  primary?: { model_present?: boolean };
  openai_configured?: boolean;
  ready?: boolean;
  _ui?: { provider?: string; modelPresent?: boolean };
}

const STATUS_URL = '/api/status/summary';

export function startStatusPoll(onUpdate: (s: Summary) => void) {
  let timer: number | undefined;
  const poll = async () => {
    try {
      const r = await fetch(STATUS_URL, { cache: 'no-store' });
      if (r.ok) {
        const s: Summary = await r.json();
        // Derive provider + presence heuristics for UI convenience
        const provider = s?.llm?.path === 'primary'
          ? 'primary'
          : (s?.llm?.path === 'warming' ? 'warming' : (s?.llm?.path || 'unknown'));
        const modelPresent = Boolean(
          s?.llm?.primary_model_present ||
          s?.ollama?.primary_model_present ||
          s?.primary?.model_present
        );
        s._ui = { provider, modelPresent };
        onUpdate(s);
      }
    } catch {
      // swallow errors; transient network/backend warmup
    } finally {
      timer = window.setTimeout(poll, 4000);
    }
  };
  poll();
  return () => { if (timer) window.clearTimeout(timer); };
}
