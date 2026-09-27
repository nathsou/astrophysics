import { defineConfig } from 'vitest/config';

import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Exercise tests import their harness from @lm/test; under Vitest that is Vitest itself.
      '@lm/test': fileURLToPath(new URL('./course/src/lib/exercise/vitest-shim.ts', import.meta.url)),
      $lib: fileURLToPath(new URL('./course/src/lib', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'course/src/**/*.test.ts', 'course/content/**/*.test.ts'],
  },
});
