// Assistant boot logic: mounts minimal UI handlers and status updater.


export function initAgentStatus(){
  const servedSpan = document.querySelector('[data-served-by]') as HTMLElement | null;
  if (!servedSpan) return;
  window.AgentStatus = {
    updateServed(s: string){ if (servedSpan && s) servedSpan.textContent = s; }
  };
}

export function wireChatForm(){
  const form = document.getElementById('assistant-form') as HTMLFormElement | null;
  const input = document.getElementById('assistant-q') as HTMLInputElement | null;
  const logEl = document.getElementById('assistant-log') as HTMLElement | null;
  if (!form || !input || !logEl) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value='';
    window.startStream?.(q, { logEl });
  });
}
