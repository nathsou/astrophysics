<!-- Run the chapter's matmul kernels on the reader's GPU and compare with the CPU library. -->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Bars from '$lib/charts/Bars.svelte';
  import { bench, VARIANTS, SIZES } from '../bench.svelte';

  const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const largest = $derived(Math.max(0, ...bench.results.filter((r) => r.variant !== 'cpu').map((r) => r.n)));
  const bars = $derived.by(() => {
    const items: { label: string; value: number; key: string }[] = VARIANTS.flatMap((v) => {
      const r = bench.results.find((x) => x.variant === v.key && x.n === largest);
      return r ? [{ label: v.label, value: r.gflops, key: v.key }] : [];
    });
    const cpu = bench.best('cpu');
    if (cpu) items.push({ label: 'CPU (Chapter 4 library)', value: cpu.gflops, key: 'cpu' });
    return items;
  });
  const cell = (variant: string, n: number) => bench.results.find((r) => r.variant === variant && r.n === n);
  const cpuBest = $derived(bench.best('cpu')?.gflops ?? 0);
</script>

<Widget
  title="Benchmark your GPU"
  subtitle="Runs this chapter’s three matmul kernels on your GPU, at four sizes, and the CPU library for comparison. Takes a few seconds."
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => bench.run()} disabled={bench.status === 'running'}>
      {bench.status === 'running' ? 'Running…' : bench.status === 'done' ? 'Run again' : 'Run benchmark'}
    </Button>
    {#if bench.progress}<span class="progress">{bench.progress}</span>{/if}
  {/snippet}

  {#if bench.status === 'unsupported'}
    <p class="muted">This browser does not expose WebGPU, so there is nothing to measure. The text quotes results from an Apple M4 Pro.</p>
  {:else if bench.results.length === 0}
    <p class="muted">Press <em>Run benchmark</em>. For reference, an Apple M4 Pro reaches about 240, 620 and 1,900 GFLOP/s with the three kernels at 2048 × 2048, against about 2.6 for the CPU library.</p>
  {:else}
    {#if bench.device}<p class="device">GPU: {bench.device}</p>{/if}
    <h5>GFLOP/s at {largest} × {largest}{cpuBest ? ' (CPU: best of 256 and 512)' : ''}</h5>
    <Bars items={bars} label="Matrix multiplication throughput by kernel" format={(v) => fmt(v)} />
    <table class="grid-table num">
      <thead>
        <tr><th>GFLOP/s</th>{#each SIZES as n (n)}<th>{n}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each VARIANTS as v (v.key)}
          <tr><td>{v.label}</td>{#each SIZES as n (n)}<td>{cell(v.key, n) ? fmt(cell(v.key, n)!.gflops) : '…'}</td>{/each}</tr>
        {/each}
        <tr><td>CPU</td>{#each SIZES as n (n)}<td>{cell('cpu', n) ? fmt(cell('cpu', n)!.gflops) : n > 512 ? '—' : '…'}</td>{/each}</tr>
      </tbody>
    </table>
    {#if bench.status === 'done' && cpuBest}
      <p class="note">
        The best kernel is <strong>{Math.round(bench.peak / cpuBest).toLocaleString('en-GB')}×</strong> faster than the CPU library. Memory bandwidth measured at
        <strong>{bench.bandwidth.toFixed(0)} GB/s</strong>; the element-wise kernel <code>2x + y</code> manages only {fmt(bench.saxpy)} GFLOP/s.
      </p>
    {/if}
  {/if}
</Widget>

<style>
  .progress {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .muted {
    color: var(--ink-2);
    font-size: 0.85rem;
  }
  .device {
    font-size: 0.78rem;
    color: var(--ink-3);
    margin: 0 0 0.6rem;
  }
  h5 {
    font-size: 0.8rem;
    margin: 0 0 0.4rem;
    color: var(--ink-2);
    font-weight: 600;
  }
  .grid-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    font-size: 0.78rem;
  }
  .grid-table th,
  .grid-table td {
    text-align: right;
    padding: 0.2rem 0.5rem;
    border-bottom: 1px solid var(--rule);
  }
  .grid-table th:first-child,
  .grid-table td:first-child {
    text-align: left;
  }
  .grid-table th {
    color: var(--ink-2);
    font-weight: 600;
  }
  .note {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.8rem 0 0;
  }
</style>
