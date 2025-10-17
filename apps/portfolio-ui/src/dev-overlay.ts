/**
 * Dev Overlay Bootstrap
 *
 * Minimal bootstrap that shows a dev badge when sa_dev cookie is present.
 * Call mountDevOverlayIfEnabled() after page hydration to show the overlay.
 */

export function devOverlayEnabled(): boolean {
  const cookies = document.cookie.split(";").map(s => s.trim());
  return cookies.some(c => c.startsWith("sa_dev="));
}

export function mountDevOverlayIfEnabled() {
  if (!devOverlayEnabled()) {
    console.log('[Dev Overlay] Not enabled (no sa_dev cookie found)');
    return;
  }

  console.log('[Dev Overlay] Enabled - mounting badge');

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

  // Click to show status
  badge.addEventListener('click', async () => {
    try {
      const response = await fetch('/agent/dev/status');
      const data = await response.json();
      alert(`Dev Overlay Status:\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('[Dev Overlay] Failed to fetch status:', error);
    }
  });

  // Add to page
  document.body.appendChild(badge);
  console.log('[Dev Overlay] Badge mounted successfully');
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
