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
    // Many suites simulate whole circuits or run the FPGA flow; on a busy machine the default 5 s
    // limit fails them spuriously. Performance tests assert their own (conservative) rates.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
