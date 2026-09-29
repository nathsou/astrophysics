import { defineConfig } from 'vitest/config';
import { modernMeta } from './scripts/modern-meta.ts';

export default defineConfig({
  plugins: [modernMeta(import.meta.dirname)],
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 120000 },
});
