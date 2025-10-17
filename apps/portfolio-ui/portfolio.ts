/**
 * Portfolio UI - Project Grid with Filtering
 */

interface Project {
  title: string;
  slug: string;
  tags: string[];
  thumbnail: string;
  description: string;
  demo?: string;
  problem?: string;
  solution?: string;
}

class PortfolioGrid {
  private projects: Project[] = [];
  private currentFilter = 'all';
  private gridContainer: HTMLElement | null;
  private loadingElement: HTMLElement | null = null;
  private emptyElement: HTMLElement | null;
  private observer!: IntersectionObserver;

  constructor() {
    this.gridContainer = document.getElementById('portfolio-grid');
    this.emptyElement = document.getElementById('portfolio-empty');

    if (!this.gridContainer || !this.emptyElement) {
      console.warn('Portfolio elements not found');
      return;
    }

    this.loadingElement = this.gridContainer.querySelector('.portfolio-loading');

    // Setup lazy loading for images
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              this.observer.unobserve(img);
            }
          }
        });
      },
      { rootMargin: '50px' }
    );

    this.setupFilterListeners();
    this.loadProjects();
  }

  private setupFilterListeners(): void {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const filter = target.dataset.filter || 'all';

        // Update active state
        filterButtons.forEach((b) => b.classList.remove('active'));
        target.classList.add('active');

        this.currentFilter = filter;
        this.renderProjects();
      });
    });
  }

  private async loadProjects(): Promise<void> {
    try {
      const response = await fetch('/projects.json');

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }

      const data = await response.json();

      // Convert object to array
      this.projects = Object.values(data);

      console.log(`Loaded ${this.projects.length} projects`);
      this.renderProjects();
    } catch (error) {
      console.error('Error loading projects:', error);
      this.showEmpty();
    }
  }

  private renderProjects(): void {
    if (!this.gridContainer) return;

    // Clear grid
    this.gridContainer.innerHTML = '';

    // Filter projects
    const filteredProjects =
      this.currentFilter === 'all'
        ? this.projects
        : this.projects.filter((p) =>
            p.tags.some((tag) =>
              tag.toLowerCase().includes(this.currentFilter.toLowerCase())
            )
          );

    console.log(
      `Rendering ${filteredProjects.length} projects (filter: ${this.currentFilter})`
    );

    if (filteredProjects.length === 0) {
      this.showEmpty();
      return;
    }

    // Hide empty state
    if (this.emptyElement) {
      this.emptyElement.style.display = 'none';
    }

    // Create and append cards
    filteredProjects.forEach((project, index) => {
      const card = this.createProjectCard(project, index);
      this.gridContainer!.appendChild(card);
    });

    // Setup lazy loading for newly added images
    const images = this.gridContainer.querySelectorAll('img[data-src]');
    images.forEach((img) => this.observer.observe(img));
  }

  private createProjectCard(project: Project, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.animationDelay = `${index * 0.05}s`;

    // Add data-card attribute for layout system
    card.setAttribute('data-card', project.slug);
    // Add data-testid for E2E testing
    card.setAttribute('data-testid', 'project-card');

    const thumbnail = project.thumbnail || '/placeholder.svg';
    const title = this.escapeHtml(project.title);
    const description = this.escapeHtml(
      project.description || project.problem || 'No description available.'
    );

    // Create tags HTML
    const tagsHtml = project.tags
      .slice(0, 4) // Limit to 4 tags
      .map((tag) => `<span class="project-tag">${this.escapeHtml(tag)}</span>`)
      .join('');

    // Create link HTML
    let linkHtml = '';
    if (project.demo) {
      linkHtml = `
        <a href="${project.demo}" target="_blank" rel="noopener noreferrer" class="project-link">
          View Project →
        </a>
      `;
    }

    card.innerHTML = `
      <div class="project-thumbnail">
        <img data-src="${thumbnail}" alt="${title}" loading="lazy" />
      </div>
      <div class="project-content">
        <h3 class="project-title">${title}</h3>
        ${tagsHtml ? `<div class="project-tags">${tagsHtml}</div>` : ''}
        <p class="project-description">${description}</p>
        ${linkHtml}
      </div>
    `;

    return card;
  }

  private showEmpty(): void {
    if (!this.gridContainer || !this.emptyElement) return;

    this.gridContainer.innerHTML = '';
    this.emptyElement.style.display = 'block';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Portfolio UI initialized');
  new PortfolioGrid();
});

export { PortfolioGrid };
