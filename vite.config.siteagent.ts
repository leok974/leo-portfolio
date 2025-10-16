import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

export default defineConfig({
  plugins: [preact()],
  root: 'apps/siteagent-ui',
  base: '/',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/siteagent-ui'),
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/agent': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: false,
        secure: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-siteagent'),
    emptyOutDir: true,
    sourcemap: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'apps/siteagent-ui/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
