/**
 * E2E test detection helper
 * Returns true when running in Playwright test mode
 */
export const isE2E = import.meta.env?.VITE_E2E === '1';
