<!--
  Measured: validation loss at each position of long windows for models trained on 512-token contexts.
  Learned position embeddings stop at 512; RoPE models keep going, but past 512 they see offsets they
  never trained on.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA } from '../data';

  const C = DATA.context;
  const SERIES = [
    { key: 'gpt2', label: 'learned positions', color: 'var(--series-1)' },
    { key: 'rope', label: 'RoPE', color: 'var(--series-2)' },
    { key: 'llama', label: 'Llama-style (RoPE and all)', color: 'var(--series-3)' },
  ];
  const maxPos = C ? Math.max(...Object.values(C).flatMap((c) => c.map((p) => p[0] + 64))) : 2048;
  const vals = C ? Object.values(C).flatMap((c) => c.map((p) => p[1])) : [2, 3];
  const yMax = Math.min(6, Math.max(...vals) * 1.05);
</script>

<Widget
  title="Beyond the training context"
  subtitle="Mean loss by position over long validation windows (bins of 64 tokens), for models trained on 512-token windows. Early positions are hard for every model: there is little context to go on."
  kind="Measured"
>
  {#if !C}
    <p class="muted">Run <code>uv run lmc ch18 context</code> and <code>uv run lmc ch18 summary</code>.</p>
  {:else}
    <Legend items={SERIES.filter((s) => C[s.key]).map((s) => ({ label: s.label, color: s.color }))} />
    <Plot label="Loss by position" height={260} x={{ domain: [0, maxPos], label: 'position in the window', tickValues: [0, 512, 1024, 1536, 2048].filter((v) => v <= maxPos) }} y={{ domain: [Math.min(...vals) - 0.1, yMax], label: 'bits / token', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        <rect x={sx(512)} y={0} width={sx(maxPos) - sx(512)} height={sy(Math.min(...vals) - 0.1)} fill="var(--warn)" opacity="0.08" />
        {#each SERIES as s (s.key)}
          {#if C[s.key]}<path class="line" stroke={s.color} d={'M' + C[s.key]!.map(([p, b]) => `${sx(p + 32)},${sy(Math.min(yMax, b))}`).join('L')} />{/if}
        {/each}
      {/snippet}
    </Plot>
    <p class="note ui">Shaded: positions the models never saw in training. The learned-position model has no embedding for them at all.</p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
