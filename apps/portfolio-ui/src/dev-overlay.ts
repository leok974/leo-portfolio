/**
 * Dev Overlay Bootstrap
 *
 * Minimal bootstrap that shows a dev badge when sa_dev cookie is present.
 * Call mountDevOverlayIfEnabled() after page hydration to show the overlay.
 */

import { mountProjectAdminPanel } from './overlay/ProjectAdminPanel';

export interface OverlayStatus {
  allowed: boolean;
  mode: 'local' | 'token' | 'access' | 'no-backend' | 'unreachable' | 'denied';
}

let cachedStatus: OverlayStatus | null = null;

/**
 * Fetch overlay status with resilient fallback:
 * 1. Check for ?dev_overlay=dev → set localStorage and force allow
 * 2. Check localStorage['dev:unlock'] → force allow without backend
 * 3. Check VITE_BACKEND_ENABLED → return no-backend if disabled
 * 4. Try backend /api/dev/status → return unreachable if fails
 */
export async function fetchOverlayStatus(): Promise<OverlayStatus> {
  // 1. Local override via URL param
  const url = new URL(location.href);
  if (url.searchParams.get('dev_overlay') === 'dev') {
    localStorage.setItem('dev:unlock', '1');
  }

  // 2. Check localStorage override
  if (localStorage.getItem('dev:unlock') === '1') {
    cachedStatus = { allowed: true, mode: 'local' };
    return cachedStatus;
  }

  // 3. Check if backend is enabled
  if (import.meta.env.VITE_BACKEND_ENABLED !== '1') {
    cachedStatus = { allowed: false, mode: 'no-backend' };
    return cachedStatus;
  }

  // 4. Try backend probe (graceful 404 handling)
  try {
    const devKey = import.meta.env.VITE_DEV_OVERLAY_KEY ?? '';
    const r = await fetch('/api/dev/status', {
      headers: { 'x-dev-key': devKey }
    });

    if (!r.ok) {
      // 404 or other error → treat as unreachable, don't throw
      cachedStatus = { allowed: false, mode: 'unreachable' };
      return cachedStatus;
    }

    const data = await r.json();
    cachedStatus = {
      allowed: data.allowed ?? false,
      mode: data.mode ?? 'denied'
    };
    return cachedStatus;
  } catch (err) {
    // Network error → graceful degradation, no alerts
    console.debug('[Dev Overlay] Backend unreachable:', err);
    cachedStatus = { allowed: false, mode: 'unreachable' };
    return cachedStatus;
  }
}

export function devOverlayEnabled(): boolean {
  const cookies = document.cookie.split(";").map(s => s.trim());
  return cookies.some(c => c.startsWith("sa_dev="));
}

export async function mountDevOverlayIfEnabled() {
  if (!devOverlayEnabled()) {
    console.log('[Dev Overlay] Not enabled (no sa_dev cookie found)');
    return;
  }

  console.log('[Dev Overlay] Enabled - mounting badge');

  // Fetch status early (non-blocking)
  const statusPromise = fetchOverlayStatus();

  // Create badge element
  const badge = document.createElement("div");
  badge.dataset.testid = "dev-overlay";
  badge.textContent = "DEV";
  badge.style.cssText = `
    position: fixed;
    right: 12px;
    bottom: 12px;
    padding: 6px 8px;
    border-radius: 6px;
    background: #111;
    color: #fff;
    font: 600 12px/1 system-ui;
    z-index: 99999;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: transform 0.2s;
  `;

  // Add hover effect
  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.1)';
  });
  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
  });

  // Click to show status (console only, no modal)
  badge.addEventListener('click', async () => {
    try {
      const status = await fetchOverlayStatus();
      console.info('[Dev Overlay] Status:', status);

      // Show toast notification instead of alert
      showToast(`Dev Overlay: ${status.mode} (${status.allowed ? 'allowed' : 'denied'})`);
    } catch (error) {
      console.error('[Dev Overlay] Failed to fetch status:', error);
    }
  });

  // Add to page
  document.body.appendChild(badge);
  console.log('[Dev Overlay] Badge mounted successfully');

  // Wait for status, then mount admin panel
  const status = await statusPromise;
  console.info('[Dev Overlay] Status loaded:', status);

  // Mount project admin panel (it will use status internally)
  mountProjectAdminPanel(status);
}

/**
 * Simple toast notification (non-blocking)
 */
function showToast(message: string) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 12px;
    padding: 12px 16px;
    background: #1e293b;
    color: #fff;
    border-radius: 6px;
    font: 500 14px/1.4 system-ui;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 99999;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Enable dev overlay via API
 * Useful for programmatic enabling (e.g., via URL parameter)
 */
export async function enableDevOverlay(token = 'dev'): Promise<boolean> {
  try {
    const response = await fetch('/agent/dev/enable', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('[Dev Overlay] Enable failed:', response.status);
      return false;
    }

    const data = await response.json();
    console.log('[Dev Overlay] Enabled:', data);

    // Reload to show overlay
    window.location.reload();
    return true;
  } catch (error) {
    console.error('[Dev Overlay] Enable error:', error);
    return false;
  }
}

/**
 * Disable dev overlay via API
 */
export async function disableDevOverlay(): Promise<boolean> {
  try {
    const response = await fetch('/agent/dev/disable');

    if (!response.ok) {
      console.error('[Dev Overlay] Disable failed:', response.status);
      return false;
    }

    const data = await response.json();
    console.log('[Dev Overlay] Disabled:', data);

    // Reload to hide overlay
    window.location.reload();
    return true;
  } catch (error) {
    console.error('[Dev Overlay] Disable error:', error);
    return false;
  }
}

// Auto-enable if ?dev_overlay=<token> is in URL
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const devToken = params.get('dev_overlay');

  if (devToken && !devOverlayEnabled()) {
    console.log('[Dev Overlay] Auto-enabling from URL parameter');
    enableDevOverlay(devToken);
  }
}

/**
 * Add manual local unlock button (for development)
 * Only shows when overlay is not allowed
 */
export function addLocalUnlockButton() {
  // Check if already unlocked
  if (localStorage.getItem('dev:unlock') === '1') {
    console.log('[Dev Overlay] Already unlocked locally');
    return;
  }

  const button = document.createElement('button');
  button.textContent = '🔓 Enable Dev Overlay (Local)';
  button.style.cssText = `
    position: fixed;
    bottom: 12px;
    left: 12px;
    padding: 8px 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font: 600 12px system-ui;
    cursor: pointer;
    z-index: 99999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.2s;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.background = '#2563eb';
    button.style.transform = 'scale(1.05)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = '#3b82f6';
    button.style.transform = 'scale(1)';
  });

  button.addEventListener('click', () => {
    localStorage.setItem('dev:unlock', '1');
    location.reload();
  });

  document.body.appendChild(button);
  console.log('[Dev Overlay] Local unlock button added');
}
