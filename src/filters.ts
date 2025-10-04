// filters.ts - pure helpers for project filtering (testable)

export function computeVisibility(categoriesAttr: string | undefined, filter: string): boolean {
  const cats = (categoriesAttr || '').split(' ').filter(Boolean);
  return filter === 'all' || cats.includes(filter);
}

export function applyProjectFilter(cards: HTMLElement[], filter: string) {
  cards.forEach(card => {
    const show = computeVisibility(card.dataset.cats, filter);
    if (show) card.classList.remove('is-hidden'); else card.classList.add('is-hidden');
  });
}

export function announcementText(filterName: string): string {
  return `Showing ${filterName === 'all' ? 'all' : filterName} projects`;
}
