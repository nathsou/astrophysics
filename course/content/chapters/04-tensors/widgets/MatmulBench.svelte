<!--
  Same arithmetic, different speed: time n×n matrix multiplication with three loop orders and the
  course library, and report throughput in GFLOP/s (2n³ floating-point operations per product).
-->
<script lang="ts">
  import { Tensor } from '@lm/core/tensor';
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  type Kernel = { name: string; note: string; run: (a: Float32Array, b: Float32Array, n: number) => Float32Array };
  const KERNELS: Kernel[] = [
    {
      name: 'i-j-k (textbook)',
      note: 'Inner loop walks down a column of B: each access jumps n floats, so almost every access misses the cache.',
      run: (a, b, n) => {
        const c = new Float32Array(n * n);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            let s = 0;
            for (let k = 0; k < n; k++) s += a[i * n + k]! * b[k * n + j]!;
            c[i * n + j] = s;
          }
        return c;
      },
    },
    {
      name: 'i-k-j (row-streaming)',
      note: 'Inner loop walks along a row of B and a row of C: consecutive addresses, so cache lines are fully used.',
      run: (a, b, n) => {
        const c = new Float32Array(n * n);
        for (let i = 0; i < n; i++)
          for (let k = 0; k < n; k++) {
            const aik = a[i * n + k]!;
            for (let j = 0; j < n; j++) c[i * n + j]! += aik * b[k * n + j]!;
          }
        return c;
      },
    },
    {
      name: 'transpose B, then dot',
      note: 'Copy Bᵀ once (n² work), then every dot product reads two contiguous rows.',
      run: (a, b, n) => {
        const bt = new Float32Array(n * n);
        for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) bt[j * n + k] = b[k * n + j]!;
        const c = new Float32Array(n * n);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            let s = 0;
            for (let k = 0; k < n; k++) s += a[i * n + k]! * bt[j * n + k]!;
            c[i * n + j] = s;
          }
        return c;
      },
    },
    {
      name: 'course library (Tensor.matmul)',
      note: 'i-k-j order plus tensor bookkeeping. Chapter 8 moves this onto the GPU.',
      run: (a, b, n) => new Tensor(a, [n, n]).matmul(new Tensor(b, [n, n])).toFloat32Array(),
    },
  ];

  let n = $state(1024);
  let results = $state<{ name: string; ms: number; gflops: number }[]>([]);
  let running = $state(false);

  async function run() {
    running = true;
    results = [];
    const rng = mulberry32(1);
    const a = Float32Array.from({ length: n * n }, () => rng() - 0.5);
    const b = Float32Array.from({ length: n * n }, () => rng() - 0.5);
    for (const k of KERNELS) {
      await new Promise((r) => setTimeout(r, 30));
      k.run(a, b, Math.min(n, 64)); // warm up the JIT
      const reps = n <= 256 ? 3 : 1;
      const t0 = performance.now();
      for (let r = 0; r < reps; r++) k.run(a, b, n);
      const ms = (performance.now() - t0) / reps;
      results = [...results, { name: k.name, ms, gflops: (2 * n ** 3) / (ms * 1e6) }];
    }
    running = false;
  }
  const best = $derived(Math.max(...results.map((r) => r.gflops), 1e-9));
</script>

<Widget title="Loop order matters" subtitle="Multiply two random n×n matrices four ways on your CPU. All four do exactly 2n³ floating-point operations; they differ only in the order they touch memory. Small matrices fit in cache and all orders perform alike — the differences appear once they do not.">
  {#snippet controls()}
    <Segmented label="Size" options={[256, 512, 1024].map((v) => ({ value: v, label: `n = ${v}` }))} bind:value={n} />
    <Button variant="primary" onclick={run} disabled={running}>{running ? 'Running…' : 'Run benchmark'}</Button>
  {/snippet}

  <div class="rows">
    {#each KERNELS as k (k.name)}
      {@const r = results.find((x) => x.name === k.name)}
      <div class="row">
        <div class="name">{k.name}</div>
        <div class="track"><span class="bar" style:width="{r ? (r.gflops / best) * 100 : 0}%"></span></div>
        <div class="val num">{r ? `${r.gflops.toFixed(2)} GFLOP/s` : running ? '…' : '—'}</div>
        <div class="ms num">{r ? `${r.ms.toFixed(0)} ms` : ''}</div>
        <div class="why">{k.note}</div>
      </div>
    {/each}
  </div>
  <p class="foot">Results depend on your processor’s cache sizes: on a recent laptop the textbook order falls behind at n = 1024 and is several times slower by n = 2048. For scale, a laptop GPU manages several thousand GFLOP/s on the same problem. Closing that gap is Chapter 8.</p>
</Widget>

<style>
  .rows {
    display: grid;
    gap: 0.7rem;
  }
  .row {
    display: grid;
    grid-template-columns: 13rem 1fr 7rem 4rem;
    align-items: center;
    gap: 0.2rem 0.8rem;
    font-size: 0.82rem;
  }
  @media (max-width: 700px) {
    .row {
      grid-template-columns: 1fr 6rem;
    }
    .track {
      grid-column: 1 / -1;
    }
  }
  .name {
    font-weight: 600;
  }
  .track {
    height: 14px;
    display: flex;
    align-items: center;
  }
  .bar {
    height: 12px;
    background: var(--series-1);
    border-radius: 0 4px 4px 0;
    transition: width 300ms;
  }
  .val {
    text-align: right;
  }
  .ms {
    color: var(--ink-3);
    text-align: right;
  }
  .why {
    grid-column: 1 / -1;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .foot {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.8rem 0 0;
  }
</style>
