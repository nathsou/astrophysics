<!--
  Measured: accuracy on three-term sums by operand length, for the direct model, the tool-using model with its
  calculator, and the tool-using model with the calculator taken away. Training used 1 to 6 digits.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA } from '../data';

  const ev = DATA.evaluate;
  const series = [
    { key: 'direct', label: 'Direct answer', color: 'var(--series-1)' },
    { key: 'tool', label: 'Tool calls, calculator attached', color: 'var(--series-2)' },
    { key: 'tool_without', label: 'Tool calls, no calculator', color: 'var(--series-4)' },
  ] as const;
  let hover = $state<string | null>(null);
  function pick(pt: { x: number; y: number } | null) {
    if (!pt || !ev) return (hover = null);
    const i = Math.max(0, Math.min(ev.digits.length - 1, Math.round(pt.x) - ev.digits[0]!));
    hover = `${ev.digits[i]} digits: ` + series.map((s) => `${s.label.toLowerCase()} ${(ev[s.key][i]! * 100).toFixed(0)}%`).join(' · ');
  }
</script>

<Widget
  title="Adding in its head, or with a calculator"
  subtitle="Two 4-layer models trained from scratch for 3,000 steps on sums of three numbers of 1 to 6 digits; accuracy on 300 new problems per length, with every number having exactly that many digits. Lengths 7 to 9 (shaded) were never seen in training."
  kind="Measured"
>
  {#if ev}
    <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    <Plot label="Accuracy by number of digits" height={240} x={{ domain: [1, 9], label: 'digits per number', ticks: 9 }} y={{ domain: [0, 1], label: 'accuracy', ticks: 5 }} onpointer={pick}>
      {#snippet marks({ sx, sy })}
        <rect x={sx(6.5)} y={sy(1)} width={sx(9) - sx(6.5)} height={sy(0) - sy(1)} fill="var(--surface-2)" />
        {#each series as s (s.key)}
          <path class="line" stroke={s.color} stroke-width="2" d={'M' + ev.digits.map((d, i) => `${sx(d)},${sy(ev[s.key][i]!)}`).join('L')} />
          {#each ev.digits as d, i (d)}<circle cx={sx(d)} cy={sy(ev[s.key][i]!)} r="2.5" fill={s.color} />{/each}
        {/each}
      {/snippet}
    </Plot>
    <p class="hover ui">{hover ?? ' '}</p>
    <table class="ui">
      <thead><tr><th>problem</th><th>direct</th><th>with calculator</th><th>without calculator</th></tr></thead>
      <tbody>
        {#each ev.samples as s (s.prompt)}
          <tr><td class="num">{s.prompt}</td><td class="num">{s.direct}</td><td class="num">{s.tool}</td><td class="num">{s.tool_without}</td></tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted">Run <code>uv run lmc ch23 train</code>, <code>evaluate</code> and <code>summary</code>.</p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .hover {
    font-size: 0.78rem;
    color: var(--ink-2);
    min-height: 1.2em;
    margin: 0.3rem 0 0.6rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
  }
  th {
    font-weight: 500;
    color: var(--ink-3);
    text-align: left;
    padding: 0.2rem 0.4rem;
  }
  td {
    padding: 0.3rem 0.4rem;
    border-top: 1px solid var(--rule);
    overflow-wrap: anywhere;
    vertical-align: top;
  }
</style>
