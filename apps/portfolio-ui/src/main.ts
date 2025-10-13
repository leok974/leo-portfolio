/**
 * Portfolio UI - Main Entry Point
 * Vanilla shell with Preact islands
 */

import "../portfolio.css";
import { loadLayout } from "./layout";
import { initAdminFromQuery } from "./admin";

// Import portfolio grid logic
import "../portfolio";

// Capture ?admin=1 from URL and persist (dev override)
initAdminFromQuery();

// Load layout recipe from backend on boot
loadLayout();

// Log when layout is loaded
window.addEventListener("layout:update", (e) => {
  const customEvent = e as CustomEvent;
  console.log("Layout loaded:", customEvent.detail);
});

console.log("Portfolio shell initialized");
