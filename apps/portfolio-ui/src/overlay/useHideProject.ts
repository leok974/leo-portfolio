/**
 * Project Hide/Unhide Controls
 * 
 * Provides functions to hide/unhide projects and trigger portfolio refresh.
 * Used by dev overlay admin controls.
 */

/**
 * Hide a project by slug
 * @param slug - Project slug to hide
 * @returns Promise<boolean> - Success status
 */
export async function hideProject(slug: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/projects/hide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': import.meta.env.VITE_ADMIN_HMAC_KEY || ''
      },
      body: JSON.stringify({ slug })
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hide failed: ${text}`);
    }
    
    const data = await res.json();
    console.log(`[Hide] Project '${slug}' hidden`, data);
    return true;
  } catch (error) {
    console.error(`[Hide] Failed to hide project '${slug}':`, error);
    return false;
  }
}

/**
 * Unhide a project by slug
 * @param slug - Project slug to unhide
 * @returns Promise<boolean> - Success status
 */
export async function unhideProject(slug: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/projects/unhide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': import.meta.env.VITE_ADMIN_HMAC_KEY || ''
      },
      body: JSON.stringify({ slug })
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Unhide failed: ${text}`);
    }
    
    const data = await res.json();
    console.log(`[Unhide] Project '${slug}' unhidden`, data);
    return true;
  } catch (error) {
    console.error(`[Unhide] Failed to unhide project '${slug}':`, error);
    return false;
  }
}

/**
 * Trigger portfolio refresh via agent workflow
 * @returns Promise<boolean> - Success status
 */
export async function refreshPortfolio(): Promise<boolean> {
  try {
    const url = import.meta.env.VITE_AGENT_REFRESH_URL;
    const key = import.meta.env.VITE_AGENT_ALLOW_KEY;
    
    if (!url || !key) {
      console.warn('[Refresh] Missing VITE_AGENT_REFRESH_URL or VITE_AGENT_ALLOW_KEY');
      return false;
    }
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-key': key
      },
      body: JSON.stringify({
        reason: 'refresh-portfolio',
        ref: 'main'
      })
    });
    
    if (!res.ok) {
      throw new Error(`Refresh dispatch failed: ${res.status}`);
    }
    
    console.log('[Refresh] Portfolio refresh triggered');
    return true;
  } catch (error) {
    console.error('[Refresh] Failed to trigger portfolio refresh:', error);
    return false;
  }
}

/**
 * Get list of hidden project slugs
 * @returns Promise<string[]> - Array of hidden slugs
 */
export async function getHiddenProjects(): Promise<string[]> {
  try {
    const res = await fetch('/projects.hidden.json');
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('[Hidden] Failed to load hidden projects:', error);
    return [];
  }
}

/**
 * Check if a project is hidden
 * @param slug - Project slug to check
 * @param hiddenList - Optional pre-loaded hidden list
 * @returns Promise<boolean> - True if hidden
 */
export async function isProjectHidden(slug: string, hiddenList?: string[]): Promise<boolean> {
  const hidden = hiddenList ?? await getHiddenProjects();
  return hidden.some(s => s.toLowerCase() === slug.toLowerCase());
}
