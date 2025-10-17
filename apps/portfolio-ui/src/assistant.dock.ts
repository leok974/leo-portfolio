/**
 * Assistant Dock Controller
 * Manages collapse/expand state and persistence for the assistant panel
 */

const COLLAPSED_KEY = 'chatDock:collapsed';

function setCollapsed(collapsed: boolean) {
  const dock = document.getElementById('chat-dock') as HTMLElement | null;
  const toggle = document.getElementById('dock-toggle') as HTMLButtonElement | null;
  const tab = document.getElementById('dock-tab') as HTMLButtonElement | null;

  if (!dock) return;

  dock.classList.toggle('collapsed', collapsed);
  const expanded = !collapsed;

  dock.setAttribute('aria-expanded', String(expanded));
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('title', collapsed ? 'Expand (C)' : 'Collapse (C)');
  }
  if (tab) {
    tab.setAttribute('aria-expanded', String(expanded));
  }

  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch (e) {
    // localStorage might be disabled/full
    console.warn('Could not persist dock state:', e);
  }

  // Optional: focus management
  if (!collapsed && toggle) {
    toggle.focus();
  }
}

function toggleDock() {
  const dock = document.getElementById('chat-dock');
  if (!dock) return;

  const isCollapsed = dock.classList.contains('collapsed');
  setCollapsed(!isCollapsed);
}

export function initAssistantDock() {
  // Restore saved state from localStorage
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch (e) {
    // localStorage might be disabled
  }
  setCollapsed(collapsed);

  // Toggle button click handler
  const toggle = document.getElementById('dock-toggle');
  if (toggle) {
    toggle.addEventListener('click', toggleDock);
  }

  // Tab button click handler
  const tab = document.getElementById('dock-tab');
  if (tab) {
    tab.addEventListener('click', toggleDock);
  }

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Press "C" to collapse/expand when page is focused
    // Don't trigger if user is typing in an input field
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    if (e.key.toLowerCase() === 'c' && !e.altKey && !e.ctrlKey && !e.metaKey && !isInput) {
      e.preventDefault();
      toggleDock();
    }

    // Escape to collapse
    if (e.key === 'Escape' && !isInput) {
      setCollapsed(true);
    }
  });
}
