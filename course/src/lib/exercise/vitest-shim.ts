// Under Vitest, exercise tests import `@lm/test` from here, i.e. Vitest itself.
import { test } from 'vitest';
import type { GpuContext } from '@lm/core/gpu';
import { nodeGpu } from '../../../../packages/core/src/gpu/node.ts';

export { describe, test, it, expect } from 'vitest';

/** GPU tests run on Dawn in Node, and are skipped where no adapter exists. */
export function gpuTest(name: string, fn: (gpu: GpuContext) => void | Promise<void>): void {
  test(name, async (t) => {
    const gpu = await nodeGpu();
    if (!gpu) return t.skip();
    await fn(gpu);
  });
}
