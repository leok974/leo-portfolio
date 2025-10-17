import { defineConfig, Plugin } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

// Plugin to add nonce placeholder to all script tags in built HTML
function injectNoncePlaceholder(): Plugin {
  return {
    name: 'inject-nonce-placeholder',
    transformIndexHtml(html) {
      // Add nonce to all script tags that don't already have one
      return html.replace(
        /<script(?![^>]*nonce=)([^>]*)>/gi,
        '<script$1 nonce="__CSP_NONCE__">'
      );
    },
  };
}

export default defineConfig({
  root: 'apps/portfolio-ui',
  base: '/',
  publicDir: 'public',
  plugins: [preact(), injectNoncePlaceholder()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/portfolio-ui'),
    }
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // Proxy backend API endpoints to avoid CORS during dev/testing
      '/api': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/chat': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/agent': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/resume': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-portfolio'),
    emptyOutDir: true,
    sourcemap: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'apps/portfolio-ui/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
