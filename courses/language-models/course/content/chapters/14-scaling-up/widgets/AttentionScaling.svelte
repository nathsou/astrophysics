<!--
  Measured on the RTX 4060 Ti: forward + backward of one attention layer in bf16, the naive way
  (materialising the T × T scores) against PyTorch's FlashAttention kernel, as context grows.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA } from '../data';

  const A = DATA.attention;
  let what = $state<'ms' | 'mib'>('mib');
  const rows = A?.rows ?? [];
  const vals = $derived(rows.flatMap((r) => [r[`naive_${what}`], r[`flash_${what}`]]).filter((v): v is number => v !== null && v > 0));
  const lo = $derived(vals.length ? 2 ** Math.floor(Math.log2(Math.min(...vals))) : 1);
  const hi = $derived(vals.length ? 2 ** Math.ceil(Math.log2(Math.max(...vals))) : 2);
  const series = [
    { key: 'naive', label: 'naive: scores stored', color: 'var(--series-2)' },
    { key: 'flash', label: 'FlashAttention', color: 'var(--series-1)' },
  ] as const;
  const oom = rows.filter((r) => r.naive_ms === null).map((r) => r.T);
  const fmtT = (v: number) => (v >= 1024 ? `${v / 1024}k` : String(v));
</script>

<Widget
  title="Attention’s cost as the context grows"
  subtitle={A ? `Measured on an RTX 4060 Ti: one attention layer, forward and backward, batch ${A.batch}, ${A.heads} heads of ${A.head_dim}, bfloat16.` : 'Measured on an RTX 4060 Ti.'}
  kind="Measured"
>
  {#snippet controls()}
    <Segmented label="Quantity" size="sm" options={[{ value: 'mib', label: 'Memory' }, { value: 'ms', label: 'Time' }]} bind:value={what} />
  {/snippet}
  {#if !A}
    <p class="muted">Run <code>uv run lmc ch14 attention</code> and <code>uv run lmc ch14 summary</code>.</p>
  {:else}
    <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    <Plot label="Attention time or memory against context length" height={250} x={{ type: 'log', domain: [rows[0]!.T, rows.at(-1)!.T], label: 'context length T', tickValues: rows.map((r) => r.T), format: fmtT }} y={{ type: 'log', domain: [lo, hi], label: what === 'ms' ? 'milliseconds' : 'extra memory (MiB)' }}>
      {#snippet marks({ sx, sy })}
        {#each series as s (s.key)}
          {@const pts = rows.filter((r) => (r[`${s.key}_${what}`] ?? 0) > 0)}
          <path class="line" stroke={s.color} d={'M' + pts.map((r) => `${sx(r.T)},${sy(r[`${s.key}_${what}`]!)}`).join('L')} />
          {#each pts as r (r.T)}<circle cx={sx(r.T)} cy={sy(r[`${s.key}_${what}`]!)} r="3" fill={s.color} />{/each}
        {/each}
      {/snippet}
    </Plot>
    <p class="note ui">
      {#if what === 'mib'}
        On log–log axes a slope of 1 means memory proportional to T, a slope of 2 proportional to T². The naive version stores the scores and probabilities, T² numbers per head{oom.length ? ` and runs out of the card’s 16 GB at T = ${oom.map(fmtT).join(', ')}` : ''}; FlashAttention stores only its inputs, outputs and one number per row.
      {:else}
        FlashAttention does the same arithmetic — slightly more, since the backward pass recomputes the scores — yet it is faster, because it never writes the T × T matrices to the GPU’s main memory and reads them back.
      {/if}
    </p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.85rem;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
