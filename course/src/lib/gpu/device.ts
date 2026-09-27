/**
 * Shared WebGPU device. Every widget and every compute kernel in the course uses this one device,
 * so buffers can be passed between the model and the visualisations without copies.
 */

export type GpuBackend = 'webgpu' | 'webgl2' | 'none';

let devicePromise: Promise<GPUDevice | null> | undefined;
let adapterInfo: GPUAdapterInfo | undefined;

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/** Resolve the shared device, or null if WebGPU is unavailable. Re-creates it after device loss. */
export function getDevice(): Promise<GPUDevice | null> {
  devicePromise ??= (async () => {
    if (!hasWebGPU()) return null;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return null;
      adapterInfo = adapter.info;
      const device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
          maxBufferSize: adapter.limits.maxBufferSize,
          maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
        },
      });
      device.lost.then((info) => {
        console.warn('WebGPU device lost:', info.message);
        devicePromise = undefined;
      });
      return device;
    } catch (e) {
      console.warn('WebGPU unavailable:', e);
      return null;
    }
  })();
  return devicePromise;
}

export function gpuDescription(): string {
  if (!adapterInfo) return '';
  return [adapterInfo.vendor, adapterInfo.architecture, adapterInfo.description].filter(Boolean).join(' · ');
}

/** Best available backend for rendering. */
export async function detectBackend(): Promise<GpuBackend> {
  if (await getDevice()) return 'webgpu';
  if (typeof document !== 'undefined' && document.createElement('canvas').getContext('webgl2')) return 'webgl2';
  return 'none';
}
