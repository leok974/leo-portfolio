import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  include: ['tests/**/*.{test,spec}.ts','tests/**/*.{test,spec}.mjs'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json-summary', 'lcov']
    }
  }
});
