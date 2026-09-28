import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $content: fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'content/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
