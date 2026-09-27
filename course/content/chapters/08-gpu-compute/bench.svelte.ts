/**
 * Live GPU benchmarks for Chapter 8: memory bandwidth, an element-wise kernel, and the three
 * matmul kernels against the CPU. Shared by the benchmark and roofline widgets.
 */
import { GpuTensor, matmulInto, kernels, groups1d, type GpuContext, type MatmulVariant } from '@lm/core/gpu';
import { Tensor } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { getGpu } from '$lib/gpu/compute';
import { gpuDescription } from '$lib/gpu/device';

export const VARIANTS: { key: MatmulVariant; label: string; /** FLOPs per byte of global loads issued */ intensity: number }[] = [
  { key: 'naive', label: 'Naïve', intensity: 0.25 },
  { key: 'tiled', label: 'Tiled 16×16', intensity: 4 },
  { key: 'blocked', label: 'Register-blocked 64×64', intensity: 16 },
];
export const SIZES = [256, 512, 1024, 2048];

export interface MatmulResult {
  variant: MatmulVariant | 'cpu';
  n: number;
  gflops: number;
}

/** Time `fn` (which records GPU work) by wall clock around a sync, repeating to fill ~budget ms. */
async function time(gpu: GpuContext, fn: () => void, budgetMs = 150): Promise<number> {
  fn();
  await gpu.sync(); // warm-up: compiles the pipeline
  let t0 = performance.now();
  fn();
  await gpu.sync();
  const once = performance.now() - t0;
  const reps = Math.max(1, Math.min(50, Math.floor(budgetMs / Math.max(once, 0.05))));
  t0 = performance.now();
  for (let r = 0; r < reps; r++) fn();
  await gpu.sync();
  return (performance.now() - t0) / reps / 1000;
}

class Bench {
  status = $state<'idle' | 'running' | 'done' | 'unsupported'>('idle');
  progress = $state('');
  device = $state('');
  /** Achieved memory bandwidth, GB/s (bytes read + written by a streaming kernel). */
  bandwidth = $state(0);
  /** Element-wise a·x + y: GFLOP/s. */
  saxpy = $state(0);
  results = $state.raw<MatmulResult[]>([]);

  get peak(): number {
    return Math.max(0, ...this.results.filter((r) => r.variant !== 'cpu').map((r) => r.gflops));
  }

  best(variant: MatmulResult['variant']): MatmulResult | undefined {
    return this.results.filter((r) => r.variant === variant).sort((a, b) => b.gflops - a.gflops)[0];
  }

  async run(): Promise<void> {
    if (this.status === 'running') return;
    const gpu = await getGpu();
    if (!gpu) {
      this.status = 'unsupported';
      return;
    }
    this.status = 'running';
    this.device = gpuDescription();
    this.results = [];
    const tick = () => new Promise((r) => setTimeout(r, 0));

    // Bandwidth: copy 64 MiB with a kernel (every thread reads and writes one float).
    this.progress = 'Measuring memory bandwidth…';
    await tick();
    const n = 16 << 20;
    const a = gpu.alloc(n * 4), b = gpu.alloc(n * 4), c = gpu.alloc(n * 4);
    const copy = kernels.unaryKernel('x');
    let t = await time(gpu, () => gpu.run({ code: copy, uniforms: { spec: 'uf', values: [n, 0] }, buffers: [a, c], groups: groups1d(n) }));
    this.bandwidth = (8 * n) / t / 1e9;
    const saxpy = kernels.binaryKernel('2.0 * x + y');
    t = await time(gpu, () => gpu.run({ code: saxpy, uniforms: { spec: 'uuu', values: [n, n, n] }, buffers: [a, b, c], groups: groups1d(n) }));
    this.saxpy = (2 * n) / t / 1e9;
    // Whichever kernel streamed more bytes per second sets the bandwidth roof.
    this.bandwidth = Math.max(this.bandwidth, (12 * n) / t / 1e9);
    for (const x of [a, b, c]) gpu.release(x);

    // Matmul: each variant at each size.
    const rng = mulberry32(1);
    const out: MatmulResult[] = [];
    for (const size of SIZES) {
      const A = GpuTensor.from(gpu, Tensor.randn([size, size], { rng }));
      const B = GpuTensor.from(gpu, Tensor.randn([size, size], { rng }));
      const C = GpuTensor.empty(gpu, [size, size]);
      for (const v of VARIANTS) {
        this.progress = `${v.label} matmul, ${size} × ${size}…`;
        await tick();
        const secs = await time(gpu, () => matmulInto(gpu, A.buffer, B.buffer, C.buffer, { M: size, N: size, K: size }, v.key));
        out.push({ variant: v.key, n: size, gflops: (2 * size ** 3) / secs / 1e9 });
        this.results = [...out];
      }
      [A, B, C].forEach((x) => x.dispose());
    }

    // CPU: the Chapter 4 library's matmul.
    for (const size of [256, 512]) {
      this.progress = `CPU matmul, ${size} × ${size}…`;
      await tick();
      const A = Tensor.randn([size, size], { rng }), B = Tensor.randn([size, size], { rng });
      const t0 = performance.now();
      A.matmul(B);
      out.push({ variant: 'cpu', n: size, gflops: (2 * size ** 3) / ((performance.now() - t0) / 1000) / 1e9 });
      this.results = [...out];
    }
    this.progress = '';
    this.status = 'done';
  }
}

export const bench = new Bench();
