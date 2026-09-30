<!--
  Measured: linear probes for a name's gender (from the pronouns used with it in TinyStories) at every layer of
  CourseGPT, at the name itself and at a later word, with shuffled-label controls.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA } from '../data';

  const P = DATA.probe;
  const series = P
    ? [
        { label: `at the name: “${P.templates.name.replace('{}', 'Lily')}”`, color: 'var(--series-1)', v: P.name.accuracy },
        { label: `later: “${P.templates.later.replace('{}', 'Lily')}”`, color: 'var(--series-2)', v: P.later.accuracy },
        { label: 'shuffled labels (control)', color: 'var(--ink-3)', v: P.later.control, dashed: true },
      ]
    : [];
</script>

<Widget
  title="Probing for a name’s gender"
  subtitle={P ? `A logistic regression reads CourseGPT’s residual stream at the last token, at every layer. Trained on ${P.names - P.test} names whose stories use “she” or “he” consistently, tested on ${P.test} others (${P.examples.slice(0, 6).join(', ')}, …).` : ''}
  kind="Measured"
>
  {#if P}
    <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
    <Plot label="Probe accuracy by layer" height={220} x={{ domain: [0, P.name.accuracy.length - 1], label: 'layer (0 = embeddings)', ticks: 9 }} y={{ domain: [0.3, 1], label: 'test accuracy', ticks: 4 }}>
      {#snippet marks({ sx, sy })}
        <line x1={sx(0)} x2={sx(P.name.accuracy.length - 1)} y1={sy(P.majority)} y2={sy(P.majority)} stroke="var(--ink-3)" stroke-width="0.8" />
        {#each series as s (s.label)}
          <path class="line" stroke={s.color} stroke-width="2" stroke-dasharray={s.dashed ? '4 3' : undefined} d={'M' + s.v.map((a, i) => `${sx(i)},${sy(a)}`).join('L')} />
          {#each s.v as a, i (i)}<circle cx={sx(i)} cy={sy(a)} r="2.5" fill={s.color} />{/each}
        {/each}
      {/snippet}
    </Plot>
    <p class="note ui">The thin line is the majority-class baseline ({(P.majority * 100).toFixed(0)}%).</p>
  {:else}
    <p class="muted">Run <code>uv run lmc ch26 probe</code> and <code>uv run lmc ch26 summary</code>.</p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .note {
    font-size: 0.76rem;
    color: var(--ink-3);
    margin: 0.3rem 0 0;
  }
</style>
