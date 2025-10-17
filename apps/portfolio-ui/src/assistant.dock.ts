/**
 * Assistant Dock Controller
 * Manages visibility state and persistence for the assistant panel
 */

const PANEL_KEY = 'portfolio:assistant:hidden';

function setHidden(hidden: boolean) {
  const panel = document.getElementById('assistant-panel') as HTMLElement | null;
  const btn = document.getElementById('assistant-hide-btn') as HTMLButtonElement | null;
  if (!panel || !btn) return;

  panel.style.display = hidden ? 'none' : 'block';
  panel.dataset.hidden = hidden ? '1' : '0';
  btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');

  try {
    localStorage.setItem(PANEL_KEY, hidden ? '1' : '0');
  } catch (e) {
    // localStorage might be disabled/full
    console.warn('Could not persist assistant visibility:', e);
  }
}

export function initAssistantDock() {
  // Restore saved state
  let hidden = false;
  try {
    hidden = localStorage.getItem(PANEL_KEY) === '1';
  } catch (e) {
    // localStorage might be disabled
  }
  setHidden(hidden);

  // Toggle button click handler
  const btn = document.getElementById('assistant-hide-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.addEventListener('click', () => {
      try {
        const currentState = localStorage.getItem(PANEL_KEY) === '1';
        setHidden(!currentState);
      } catch {
        // Fallback if localStorage fails
        const panel = document.getElementById('assistant-panel');
        const isHidden = panel?.style.display === 'none';
        setHidden(!isHidden);
      }
    });
  }

  // Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setHidden(true);
    }
  });
}
