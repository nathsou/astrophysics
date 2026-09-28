<!--
  Every run's training loss against the compute spent so far, on log–log axes: the lower envelope is
  the compute frontier. CourseGPT's own run (Chapter 14), 30 times more compute than the largest
  sweep budget, is drawn beside the scaling law's prediction for it.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA, lawLoss, pow10, si } from '../data';
  import { DATA as CH14 } from '../../14-scaling-up/data';

  const runs = DATA.runs;
  const fit = DATA.fit;
  const shapes = [...new Set(runs.map((r) => `${r.layers}×${r.width}`))];
  const colour = (r: { layers: number; width: number }) => `var(--series-${shapes.indexOf(`${r.layers}×${r.width}`) + 1})`;
  let showCourse = $state(true);

  // CourseGPT: 131,072 tokens per step, 188.8 M FLOPs per token (Chapter 14).
  const cg = CH14.coursegpt;
  const cgTokensPerStep = cg ? Number(cg.config.batch) * Number(cg.config.accum) * Number(cg.config.context) : 0;
  const cgCurve = cg ? cg.train.map(([step, bits]) => [step * cgTokensPerStep * cg.flops_per_token, bits] as const) : [];
  const cgPred = $derived(
    fit && cg ? cgCurve.filter((_, i) => i % 4 === 0).map(([c]) => [c, lawLoss(fit.law, fit.coursegpt.params, c / cg.flops_per_token)] as const) : [],
  );
  const xMax = $derived(showCourse && cgCurve.length ? 3e17 : 1e16);
  const sci = (v: number) => {
    const e = Math.floor(Math.log10(v));
    return `${+(v / 10 ** e).toFixed(2)} × ${pow10(10 ** e)}`;
  };
  const skip = (c: number) => c < 3e13; // the first records are dominated by warm-up
</script>

<Widget
  title="Loss against compute"
  subtitle="Training loss of every sweep run against the FLOPs it has spent so far. Small models learn fastest at first, then flatten; at every budget one size is best, and the lower envelope of all the curves is the compute frontier."
  kind="Measured"
>
  {#snippet controls()}
    <Toggle bind:checked={showCourse} label="Show CourseGPT and the law’s prediction" />
  {/snippet}
  {#if !runs.length}
    <p class="muted">Run <code>uv run lmc ch17 sweep</code> and <code>uv run lmc ch17 summary</code>.</p>
  {:else}
    <Legend items={[...shapes.map((s) => ({ label: s, color: `var(--series-${shapes.indexOf(s) + 1})` })), ...(showCourse ? [{ label: 'CourseGPT (8×512, Chapter 14)', color: 'var(--ink)' }, { label: 'law’s prediction', color: 'var(--ink)', dashed: true }] : [])]} />
    <Plot label="Training loss against training compute" height={300} x={{ type: 'log', domain: [3e13, xMax], label: 'training compute (FLOPs)', tickValues: [1e14, 1e15, 1e16, 1e17].filter((v) => v <= xMax), format: pow10 }} y={{ type: 'log', domain: [1.5, 5], label: 'training bits / token', tickValues: [1.5, 2, 3, 4, 5] }}>
      {#snippet marks({ sx, sy })}
        {#each runs as r (r.name)}
          <path class="line" stroke={colour(r)} stroke-width="1.3" opacity="0.8" d={'M' + r.curve.filter(([c]) => !skip(c)).map(([c, b]) => `${sx(c)},${sy(Math.min(5, b))}`).join('L')} />
        {/each}
        {#if showCourse && cgCurve.length}
          <path class="line" stroke="var(--ink)" stroke-width="2" d={'M' + cgCurve.filter(([c]) => !skip(c)).map(([c, b]) => `${sx(c)},${sy(Math.min(5, b))}`).join('L')} />
          {#if cgPred.length}<path class="line" stroke="var(--ink)" stroke-dasharray="5 4" d={'M' + cgPred.map(([c, b]) => `${sx(c)},${sy(Math.min(5, b))}`).join('L')} />{/if}
        {/if}
      {/snippet}
    </Plot>
    {#if fit && showCourse}
      <p class="note ui">
        The law was fitted on the sweep’s final losses, all at ≤ {sci(Math.max(...runs.map((r) => r.budget)))} FLOPs. Extrapolated 30-fold to CourseGPT’s {si(fit.coursegpt.params)} parameters and {si(fit.coursegpt.tokens)} tokens, it predicts <strong class="num">{fit.coursegpt.predicted.toFixed(3)}</strong> bits per token{#if fit.coursegpt.measured}{' '}— CourseGPT measured <strong class="num">{fit.coursegpt.measured.toFixed(3)}</strong>{/if}. The dashed line applies the law at every point of CourseGPT’s run, as if each were the end of a run that long; the real curve lies above it until its learning rate has decayed.
      </p>
    {/if}
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
