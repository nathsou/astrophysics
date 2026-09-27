/**
 * A GpuContext for Node (tests, scripts), backed by Dawn through the `webgpu` package.
 * Not exported from the package index, so browser bundles never import it.
 */
import { GpuContext } from './context.ts';

let pending: Promise<GpuContext | null> | undefined;

/** The shared Node GPU context, or null when there is no usable adapter (e.g. CI without a GPU). */
export function nodeGpu(): Promise<GpuContext | null> {
  pending ??= (async () => {
    try {
      const { create, globals } = await import('webgpu');
      Object.assign(globalThis, globals);
      return await GpuContext.create(create([]));
    } catch (e) {
      console.warn('WebGPU unavailable in Node:', e);
      return null;
    }
  })();
  return pending;
}
