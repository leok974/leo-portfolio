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
          Dev Admin
        </h3>
      </div>
      <div id="admin-tabs" style="
        display: flex;
        gap: 4px;
        padding: 8px 12px;
        border-bottom: 1px solid #334155;
        background: #0a0f1a;
      ">
        <button class="admin-tab active" data-tab="projects" style="
          padding: 6px 12px;
          border-radius: 4px;
          background: #1e40af;
          color: #fff;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        ">Projects</button>
        <button class="admin-tab" data-tab="brand" style="
          padding: 6px 12px;
          border-radius: 4px;
          background: transparent;
          color: #94a3b8;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        ">Brand</button>
      </div>
      <div id="tab-content" style="
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      ">
        <div id="projects-tab" class="tab-panel" style="
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        ">
          <div style="color: #94a3b8; text-align: center; padding: 20px;">
            Loading projects...
          </div>
        </div>
        <div id="brand-tab" class="tab-panel" style="
          display: none;
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        ">
          <div id="brand-tab-content"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);
    this.setupTabs();
    this.loadProjects();
    this.renderBrandTab();
  }

  private setupTabs() {
    const tabs = this.panel?.querySelectorAll('.admin-tab');
    const panels = this.panel?.querySelectorAll('.tab-panel');

    tabs?.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = (tab as HTMLElement).dataset.tab;

        // Update active tab styling
        tabs.forEach(t => {
          const isActive = (t as HTMLElement).dataset.tab === targetTab;
          (t as HTMLElement).style.background = isActive ? '#1e40af' : 'transparent';
          (t as HTMLElement).style.color = isActive ? '#fff' : '#94a3b8';
          if (isActive) {
            t.classList.add('active');
          } else {
            t.classList.remove('active');
          }
        });

        // Show/hide panels
        panels?.forEach(panel => {
          const panelId = (panel as HTMLElement).id.replace('-tab', '');
          (panel as HTMLElement).style.display = panelId === targetTab ? 'block' : 'none';
        });
      });
    });
  }

  private renderBrandTab() {
    const brandContent = document.getElementById('brand-tab-content');
    if (!brandContent) return;

    brandContent.innerHTML = `
      <div style="space-y: 16px;">
        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; color: #fff; font-size: 14px; font-weight: 600;">
            Brand Assets
          </h4>
          <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
            Generate branded business cards from your site metadata and design tokens.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
          <button id="brand-generate-btn" style="
            padding: 8px 16px;
            background: #1e40af;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
          ">
            Generate Business Card
          </button>
          <a href="/agent/artifacts/cards/" target="_blank" style="
            padding: 8px 16px;
            background: #334155;
            color: #fff;
            border: none;
            border-radius: 6px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            display: inline-block;
            transition: all 0.2s;
          ">
            View Artifacts
          </a>
        </div>

        <div id="brand-status" style="display: none; margin-bottom: 12px;"></div>
        <div id="brand-preview" style="display: none;"></div>
      </div>
    `;

    // Add event listener for generate button
    const generateBtn = document.getElementById('brand-generate-btn');
    generateBtn?.addEventListener('click', () => this.generateBrandCard());
  }

  private async generateBrandCard() {
    const statusDiv = document.getElementById('brand-status');
    const previewDiv = document.getElementById('brand-preview');
    const generateBtn = document.getElementById('brand-generate-btn') as HTMLButtonElement;

    if (!statusDiv || !previewDiv) return;

    // Show loading state
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 12px;">
        <div style="
          width: 16px;
          height: 16px;
          border: 2px solid #1e40af;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        "></div>
        <span>Duplicating template and injecting metadata...</span>
      </div>
    `;

    try {
      // TODO: Replace with actual metadata endpoint
      const meta = {
        name: 'Leo Klemet',
        role: 'Full Stack Developer',
        email: 'leo@leoklemet.com',
        domain: 'leoklemet.com',
        qr_url: 'https://leoklemet.com'
      };

      const response = await fetch('/api/agent/brand/card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add admin auth header if needed
        },
        body: JSON.stringify(meta),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || 'Card generation failed');
      }

      const data = await response.json();

      // Show success
      statusDiv.innerHTML = `
        <div style="padding: 8px 12px; background: #065f46; border: 1px solid #059669; border-radius: 6px; color: #d1fae5; font-size: 12px;">
          ✓ Card generated successfully
        </div>
      `;

      // Show preview
      if (data.export?.png?.[0]) {
        previewDiv.style.display = 'block';
        previewDiv.innerHTML = `
          <div style="margin-top: 12px;">
            <h5 style="margin: 0 0 8px 0; color: #fff; font-size: 13px; font-weight: 600;">Preview</h5>
            <div style="border: 1px solid #334155; border-radius: 8px; overflow: hidden;">
              <img src="${data.export.png[0]}" alt="Business card preview" style="width: 100%; height: auto; display: block;" />
            </div>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <a href="${data.export.png[0]}" download="business-card.png" style="
                padding: 6px 12px;
                background: #059669;
                color: #fff;
                border-radius: 4px;
                text-decoration: none;
                font-size: 11px;
                font-weight: 500;
              ">Download PNG</a>
              ${data.file_key ? `
                <a href="https://www.figma.com/file/${data.file_key}" target="_blank" style="
                  padding: 6px 12px;
                  background: #334155;
                  color: #fff;
                  border-radius: 4px;
                  text-decoration: none;
                  font-size: 11px;
                  font-weight: 500;
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                ">
                  <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.332 8.668a3.333 3.333 0 0 0 0-6.663H8.668a3.333 3.333 0 0 0 0 6.663 3.333 3.333 0 0 0 0 6.665 3.333 3.333 0 0 0 0 6.664A3.334 3.334 0 0 0 12 18.664V8.668h3.332z"/>
                    <circle cx="15.332" cy="12" r="3.332"/>
                  </svg>
                  Open in Figma
                </a>
              ` : ''}
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('[Brand] Card generation failed:', error);
      statusDiv.innerHTML = `
        <div style="padding: 8px 12px; background: #7f1d1d; border: 1px solid #dc2626; border-radius: 6px; color: #fecaca; font-size: 12px;">
          <strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Business Card';
    }
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
      const list = document.getElementById('projects-tab');
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
    const list = document.getElementById('projects-tab');
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
