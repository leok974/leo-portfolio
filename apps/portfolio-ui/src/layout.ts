// Minimal shared store + events for layout management
// Framework-agnostic - works with vanilla JS and React/Preact islands

export interface CardConfig {
  size?: string;       // sm|md|lg for grid sizing
  order?: number;      // CSS order property value
  hidden?: boolean;    // whether to hide the card
}

export interface LayoutRecipe {
  version: string;
  cards: Record<string, CardConfig>;
}

const LAYOUT_EVENT = "layout:update";
const model = { recipe: null as LayoutRecipe | null };

/**
 * Load layout recipe from backend and apply it
 * Fires layout:update event for reactive components
 */
export async function loadLayout() {
  try {
    // Fetch from backend endpoint (adjust URL if needed)
    const res = await fetch("/api/layout", { credentials: "include" });
    if (!res.ok) {
      console.warn(`Layout API returned ${res.status}, using defaults`);
      return;
    }
    const recipe: LayoutRecipe = await res.json();
    model.recipe = recipe;
    applyRecipe(recipe);
    window.dispatchEvent(new CustomEvent(LAYOUT_EVENT, { detail: recipe }));
  } catch (err) {
    console.warn("Failed to load layout recipe:", err);
  }
}

/**
 * Get current layout recipe
 */
export function currentLayout(): LayoutRecipe | null {
  return model.recipe;
}

/**
 * Apply layout recipe to DOM elements with data-card attributes
 * Updates order, size, and hidden state based on recipe
 */
export function applyRecipe(recipe: LayoutRecipe) {
  Object.entries(recipe.cards).forEach(([id, cfg]) => {
    const el = document.querySelector<HTMLElement>(`[data-card="${id}"]`);
    if (!el) {
      console.debug(`Card not found: ${id}`);
      return;
    }

    // Apply order (CSS order property)
    if (cfg.order !== undefined) {
      el.style.order = String(cfg.order);
    }

    // Apply size attribute (CSS can hook into this)
    if (cfg.size) {
      el.setAttribute("data-size", cfg.size);
    } else {
      el.removeAttribute("data-size");
    }

    // Apply hidden state
    if (cfg.hidden) {
      el.setAttribute("hidden", "");
    } else {
      el.removeAttribute("hidden");
    }
  });
}

/**
 * Subscribe to layout updates
 * Returns unsubscribe function
 */
export function onLayoutUpdate(callback: (recipe: LayoutRecipe) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<LayoutRecipe>;
    callback(customEvent.detail);
  };
  window.addEventListener(LAYOUT_EVENT, handler);
  return () => window.removeEventListener(LAYOUT_EVENT, handler);
}
