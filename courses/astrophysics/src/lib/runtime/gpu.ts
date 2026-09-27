// One shared GPUDevice for the whole page. Sims must not call requestDevice themselves.

let devicePromise: Promise<GPUDevice | null> | null = null;

export const hasWebGPU = () => typeof navigator !== 'undefined' && 'gpu' in navigator;

export function getDevice(): Promise<GPUDevice | null> {
  if (devicePromise) return devicePromise;
  devicePromise = (async () => {
    if (!hasWebGPU()) return null;
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    const wanted: (keyof GPUSupportedLimits)[] = [
      'maxStorageBufferBindingSize',
      'maxBufferSize',
      'maxComputeWorkgroupStorageSize',
      'maxComputeInvocationsPerWorkgroup',
      'maxComputeWorkgroupSizeX',
    ];
    const requiredLimits: Record<string, number> = {};
    for (const k of wanted) requiredLimits[k] = adapter.limits[k] as number;
    const features: GPUFeatureName[] = [];
    if (adapter.features.has('float32-filterable')) features.push('float32-filterable');
    if (adapter.features.has('timestamp-query')) features.push('timestamp-query');
    const device = await adapter.requestDevice({ requiredLimits, requiredFeatures: features });
    device.lost.then((info) => {
      console.warn('WebGPU device lost:', info.message);
      devicePromise = null;
    });
    device.onuncapturederror = (e) => console.error('WebGPU error:', e.error.message);
    return device;
  })();
  return devicePromise;
}

export const preferredFormat = () => navigator.gpu.getPreferredCanvasFormat();

/** Configure a canvas for WebGPU rendering with the shared device. */
export function configureCanvas(canvas: HTMLCanvasElement, device: GPUDevice, alphaMode: GPUCanvasAlphaMode = 'premultiplied') {
  const ctx = canvas.getContext('webgpu');
  if (!ctx) throw new Error('Could not get a WebGPU canvas context');
  const format = preferredFormat();
  ctx.configure({ device, format, alphaMode });
  return { ctx, format };
}

/** Error thrown by sims that need WebGPU when it is unavailable; the island loader shows a friendly message. */
export class NoWebGPUError extends Error {
  constructor() {
    super('This simulation needs WebGPU. Try a recent Chrome, Edge or Safari (26+).');
  }
}

export async function requireDevice(): Promise<GPUDevice> {
  const d = await getDevice();
  if (!d) throw new NoWebGPUError();
  return d;
}
