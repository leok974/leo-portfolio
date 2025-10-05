import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    assetsDir: 'assets',
    rollupOptions: {
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
