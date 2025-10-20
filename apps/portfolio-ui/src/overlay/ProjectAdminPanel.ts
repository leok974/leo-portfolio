/**
 * Dev Overlay - Project Admin Panel
 *
 * Enhanced dev overlay with project hide/unhide controls
 */

import { hideProject, unhideProject, refreshPortfolio, getHiddenProjects } from './useHideProject';
import type { OverlayStatus } from '../dev-overlay';

interface Project {
  title: string;
  slug: string;
  tags?: string[];
  [key: string]: any;
}

export class ProjectAdminPanel {
  private panel: HTMLElement | null = null;
  private isOpen = false;
  private hiddenProjects = new Set<string>();
  private status: OverlayStatus;

  constructor(status: OverlayStatus) {
    this.status = status;
    this.loadHiddenProjects();
  }

  private async loadHiddenProjects() {
    const hidden = await getHiddenProjects();
    this.hiddenProjects = new Set(hidden.map(s => s.toLowerCase()));
  }

  public mount() {
    // Create toggle button
    const button = document.createElement('button');
    button.id = 'dev-admin-toggle';
    button.textContent = '⚙️';
    button.style.cssText = `
      position: fixed;
      right: 60px;
      bottom: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #1e293b;
      color: #fff;
      font-size: 16px;
      border: 1px solid #334155;
      cursor: pointer;
      z-index: 99998;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.background = '#334155';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.background = '#1e293b';
    });

    button.addEventListener('click', () => this.toggle());

    document.body.appendChild(button);
    this.createPanel();
  }

  private createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'dev-admin-panel';
    this.panel.style.cssText = `
      position: fixed;
      right: 12px;
      bottom: 60px;
      width: 400px;
      max-height: 600px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      z-index: 99997;
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;

    this.panel.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid #334155;">
        <h3 style="margin: 0; color: #fff; font-size: 16px; font-weight: 600;">
          Project Admin
        </h3>
      </div>
      <div id="project-admin-list" style="
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      ">
        <div style="color: #94a3b8; text-align: center; padding: 20px;">
          Loading projects...
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);
    this.loadProjects();
  }

  private async loadProjects() {
    try {
      const response = await fetch('/projects.json');
      const data = await response.json();
      const projects: Project[] = Object.values(data);

      await this.loadHiddenProjects();
      this.renderProjects(projects);
    } catch (error) {
      console.error('[Dev Admin] Failed to load projects:', error);
      const list = document.getElementById('project-admin-list');
      if (list) {
        list.innerHTML = `
          <div style="color: #ef4444; text-align: center; padding: 20px;">
            Failed to load projects
          </div>
        `;
      }
    }
  }

  private renderProjects(projects: Project[]) {
    const list = document.getElementById('project-admin-list');
    if (!list) return;

    // Show message if overlay not allowed
    if (!this.status.allowed) {
      list.innerHTML = `
        <div style="color: #94a3b8; text-align: center; padding: 20px;">
          <div style="margin-bottom: 12px;">🔒 Dev Overlay: ${this.status.mode}</div>
          <div style="font-size: 12px; line-height: 1.5;">
            ${this.status.mode === 'no-backend'
              ? 'Backend is disabled. Set <code>VITE_BACKEND_ENABLED=1</code> to enable admin features.'
              : this.status.mode === 'unreachable'
              ? 'Backend is unreachable. Check if the API server is running.'
              : this.status.mode === 'denied'
              ? 'Access denied. Check <code>DEV_OVERLAY_KEY</code> configuration.'
              : 'Use <code>?dev_overlay=dev</code> to unlock locally.'}
          </div>
        </div>
      `;
      return;
    }

    list.innerHTML = projects
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(project => {
        const isHidden = this.hiddenProjects.has(project.slug.toLowerCase());
        return `
          <div style="
            padding: 12px;
            margin-bottom: 8px;
            background: ${isHidden ? '#1e293b' : '#1e40af15'};
            border: 1px solid ${isHidden ? '#475569' : '#3b82f6'};
            border-radius: 6px;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 8px;
            ">
              <div style="flex: 1; min-width: 0;">
                <div style="
                  color: ${isHidden ? '#94a3b8' : '#e2e8f0'};
                  font-weight: 500;
                  font-size: 14px;
                  text-decoration: ${isHidden ? 'line-through' : 'none'};
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                ">
                  ${this.escapeHtml(project.title)}
                </div>
                <div style="
                  color: #64748b;
                  font-size: 12px;
                  margin-top: 2px;
                ">
                  ${project.slug}
                </div>
              </div>
              <div style="display: flex; gap: 4px;">
                <button
                  class="project-toggle-btn"
                  data-slug="${project.slug}"
                  data-action="${isHidden ? 'unhide' : 'hide'}"
                  style="
                    padding: 6px 12px;
                    border-radius: 4px;
                    border: none;
                    background: ${isHidden ? '#10b981' : '#ef4444'};
                    color: white;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: opacity 0.2s;
                  "
                  onmouseover="this.style.opacity='0.8'"
                  onmouseout="this.style.opacity='1'"
                >
                  ${isHidden ? '👁️ Show' : '🚫 Hide'}
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach event listeners
    const buttons = list.querySelectorAll('.project-toggle-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleToggle(e));
    });
  }

  private async handleToggle(e: Event) {
    const button = e.target as HTMLButtonElement;
    const slug = button.dataset.slug;
    const action = button.dataset.action;

    if (!slug || !action) return;

    button.disabled = true;
    button.textContent = '⏳';

    try {
      let success = false;
      if (action === 'hide') {
        success = await hideProject(slug);
      } else {
        success = await unhideProject(slug);
      }

      if (success) {
        // Trigger refresh
        const refreshSuccess = await refreshPortfolio();

        if (refreshSuccess) {
          alert(`Project "${slug}" ${action === 'hide' ? 'hidden' : 'shown'}!\n\nPortfolio refresh triggered. Changes will be live in ~2 minutes.`);
        } else {
          alert(`Project "${slug}" ${action === 'hide' ? 'hidden' : 'shown'}!\n\nNote: Auto-refresh failed. You may need to manually rebuild.`);
        }

        // Reload the panel
        await this.loadProjects();
      } else {
        alert(`Failed to ${action} project "${slug}". Check console for details.`);
        button.disabled = false;
        button.textContent = action === 'hide' ? '🚫 Hide' : '👁️ Show';
      }
    } catch (error) {
      console.error(`[Dev Admin] Toggle error:`, error);
      alert(`Error: ${error}`);
      button.disabled = false;
      button.textContent = action === 'hide' ? '🚫 Hide' : '👁️ Show';
    }
  }

  private toggle() {
    if (!this.panel) return;

    this.isOpen = !this.isOpen;
    this.panel.style.display = this.isOpen ? 'flex' : 'none';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Mount project admin panel if dev overlay is enabled
 */
export function mountProjectAdminPanel(status: OverlayStatus) {
  const panel = new ProjectAdminPanel(status);
  panel.mount();
  console.log('[Dev Overlay] Project admin panel mounted with status:', status);
}
