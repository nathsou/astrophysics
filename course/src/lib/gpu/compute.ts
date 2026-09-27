/**
 * The course's shared compute context: a GpuContext around the same device the visualisations
 * use, so model buffers could be drawn without copies.
 */
import { GpuContext } from '@lm/core/gpu';
import { getDevice } from './device';

let ctx: Promise<GpuContext | null> | undefined;

export function getGpu(): Promise<GpuContext | null> {
  ctx ??= getDevice().then((device) => (device ? new GpuContext(device) : null));
  return ctx;
}
