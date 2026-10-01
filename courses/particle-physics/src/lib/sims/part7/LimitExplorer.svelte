<!--
  Upper limits by the CLs method (Chapter 28), for a counting experiment: b events expected from background, N observed, and a signal of s events
  that may or may not be there. For each s the figure shows CLs+b = P(N' ≤ N | s + b) (the probability of seeing so few events if the signal is there) and
  CLb = P(N' ≤ N | b) (the same if it is not). CLs = CLs+b / CLb is what the experiments quote: a signal is excluded at 95 % confidence when CLs < 0.05.
  Using CLs+b alone would exclude signals the experiment has no sensitivity to whenever the data fluctuate down; dividing by CLb is the protection.

    ::limit-explorer{n="28.6" caption="…"}

  Props: `b` (initial background), `observed` (initial count), `n`, `caption`. The numbers are the library's (`clsCounting`, `upperLimitCounting`, `expectedLimitsCounting`).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { clsCounting, expectedLimitsCounting, poissonCdf, upperLimitCounting } from '$lib/hep/analysis';
  import { sig } from '$lib/sims/stats/common';

  let { b: b0 = 6, observed: n0 = 3, n, caption, title = 'A limit, when nothing is found' }: { b?: number; observed?: number; n?: string | number; caption?: string; title?: string } = $props();

  let b = $state(untrack(() => b0));
  let nObs = $state(untrack(() => n0));
  let showNaive = $state(true);

  const limit = $derived(upperLimitCounting(nObs, b, 0.95));
  const expected = $derived(expectedLimitsCounting(b, 0.95));
  /** The limit from CLs+b alone: the s at which P(N' ≤ N | s + b) = 0.05. */
  const naive = $derived.by(() => {
    if (poissonCdf(nObs, b) < 0.05) return 0; // even s = 0 is "excluded": the pathology
    let lo = 0, hi = 200;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (poissonCdf(nObs, mid + b) > 0.05) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  });
  const sMax = $derived(Math.max(6, 2.2 * limit, expected.p2 * 1.2));
  const S = 160;
  const grid = $derived(Array.from({ length: S + 1 }, (_, i) => (sMax * i) / S));
  const rows = $derived(grid.map((s) => clsCounting(nObs, s, b)));
  const clbVal = $derived(poissonCdf(nObs, b));
  const path = (sx: (v: number) => number, sy: (v: number) => number, f: (i: number) => number) => grid.map((s, i) => `${i ? 'L' : 'M'}${sx(s).toFixed(1)},${sy(f(i)).toFixed(1)}`).join('');
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={b} min={0.1} max={50} log label="Expected background b" format={(v) => sig(v, 3)} />
    <Slider bind:value={nObs} min={0} max={60} step={1} label="Observed events N" format={(v) => v.toFixed(0)} />
    <Toggle bind:checked={showNaive} label="Show CLs+b alone (what not to quote)" />
  {/snippet}

  <Plot x={{ domain: [0, sMax], label: 'Signal s hypothesised (expected events)' }} y={{ domain: [0, 1.02], label: 'Probability' }} height={300} label="CLs, CLs+b and CLb as functions of the signal size, with the 5 percent line">
    {#snippet marks({ sx, sy, height })}
      <line x1={sx(0)} x2={sx(sMax)} y1={sy(0.05)} y2={sy(0.05)} stroke="var(--bad)" stroke-dasharray="5 3" />
      <text x={sx(sMax) - 4} y={sy(0.05) - 5} class="lbl" text-anchor="end" fill="var(--bad)">0.05</text>
      <rect x={sx(expected.m1)} y="0" width={Math.max(0, sx(expected.p1) - sx(expected.m1))} height={height} fill="var(--series-1)" opacity="0.12" />
      <line x1={sx(expected.median)} x2={sx(expected.median)} y1="0" y2={height} stroke="var(--series-1)" stroke-dasharray="2 4" />
      <text x={sx(expected.median) + 4} y="12" class="lbl" fill="var(--series-1)">expected limit (median, ±1σ)</text>
      {#if showNaive}
        <path d={path(sx, sy, (i) => rows[i]!.clsb)} fill="none" stroke="var(--series-4)" stroke-width="1.6" stroke-dasharray="6 3" />
      {/if}
      <line x1={sx(0)} x2={sx(sMax)} y1={sy(clbVal)} y2={sy(clbVal)} stroke="var(--series-2)" stroke-width="1.4" />
      <text x={sx(sMax) - 4} y={sy(clbVal) - 5} class="lbl" text-anchor="end" fill="var(--series-2)">CLb = {sig(clbVal, 2)}</text>
      <path d={path(sx, sy, (i) => rows[i]!.cls)} fill="none" stroke="var(--p-higgs)" stroke-width="2.4" />
      <line x1={sx(limit)} x2={sx(limit)} y1={sy(0.05)} y2={sy(0)} stroke="var(--p-higgs)" stroke-width="1.6" />
      <circle cx={sx(limit)} cy={sy(0.05)} r="4.5" fill="var(--sig-high)" />
    {/snippet}
  </Plot>

  <div class="readout ui" aria-live="polite">
    <div class="card hot"><span class="k">95 % CL upper limit on s (CLs)</span><strong class="v">s &lt; {sig(limit, 3)} events</strong><span class="s">The signal size at which CLs falls to 0.05. The median limit with no signal and this background is {sig(expected.median, 3)} ({sig(expected.m1, 2)} to {sig(expected.p1, 2)} at ±1σ).</span></div>
    <div class="card"><span class="k">CLs+b alone would say</span><strong class="v">{naive <= 0 ? 'every s excluded' : `s < ${sig(naive, 3)} events`}</strong><span class="s">{naive < limit ? `Stricter than the CLs limit by ${sig(limit - naive, 2)} events. With a downward fluctuation it claims sensitivity the experiment does not have.` : 'Close to the CLs limit: the data did not fluctuate low.'}</span></div>
    {#if nObs === 0}<div class="card"><span class="k">N = 0</span><strong class="v">s &lt; −ln 0.05 = 2.996</strong><span class="s">With nothing observed the limit is 3.0 events whatever the background.</span></div>{/if}
  </div>
</Widget>

<style>
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.6rem;
    margin-top: 0.8rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    background: var(--pn);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .card.hot {
    border-color: var(--sig-high);
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  .v {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 600;
  }
  .s {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
</style>
