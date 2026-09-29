import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@kernel': fileURLToPath(new URL('../../packages/kernel/src', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});
