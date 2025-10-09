/**
 * API configuration for E2E tests
 * Use API_URL environment variable to override default backend URL
 */
export const API_URL = process.env.API_URL || 'http://127.0.0.1:8001';
