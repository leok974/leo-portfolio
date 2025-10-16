import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

export default defineConfig({
  plugins: [preact()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Forward all /agent/* requests to FastAPI backend
      // This fixes 404s in E2E tests when dev server runs on :5173
      '/agent': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: false,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        tools: path.resolve(__dirname, 'tools.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (info) => {
          // Keep existing hashed asset pattern; ensure leading directory
            return 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
});
