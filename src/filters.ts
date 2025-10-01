// filters.ts - pure helpers for project filtering (testable)

export function computeVisibility(categoriesAttr: string | undefined, filter: string): boolean {
  const cats = (categoriesAttr || '').split(' ').filter(Boolean);
  return filter === 'all' || cats.includes(filter);
}

export function applyProjectFilter(cards: HTMLElement[], filter: string) {
  cards.forEach(card => {
    const show = computeVisibility(card.dataset.cats, filter);
    card.style.display = show ? '' : 'none';
  });
}

export function announcementText(filterName: string): string {
  return `Showing ${filterName === 'all' ? 'all' : filterName} projects`;
}
