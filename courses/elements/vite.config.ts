import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { modernMeta } from './scripts/modern-meta.ts';

export default defineConfig({
  base: './',
  plugins: [react(), modernMeta(import.meta.dirname)],
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
});
