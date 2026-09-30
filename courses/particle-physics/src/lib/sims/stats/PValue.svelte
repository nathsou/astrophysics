<!--
  The p-value of a counting experiment. A background of b events is expected; N were observed. The p-value is the probability, if there is
  only background, of seeing N or more: the shaded tail of the Poisson distribution. The widget converts it to a significance Z (the number of
  standard deviations of a normal distribution with the same one-sided tail) and marks the smallest counts that would reach the
  conventional thresholds: 3σ ("evidence", p = 1.35 × 10⁻³) and 5σ ("discovery", p = 2.87 × 10⁻⁷).

    ::p-value{n="28.2" b=3.5 observed=9 caption="…"}

  Props: `b` expected background, `observed` observed count, `uncertainty` relative uncertainty on b (0–0.5), `n`, `caption`.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { poissonPmf, poissonTail, pToZ, zToP, pValueWithUncertainty } from '$lib/hep/analysis';
  import { fmtP, fmtZ, sig } from './common';

  let {
    b: b0 = 3.5,
    observed: n0 = 9,
    uncertainty: u0 = 0,
    n,
    caption,
    title = 'p-value of a counting experiment',
  }: { b?: number; observed?: number; uncertainty?: number; n?: string | number; caption?: string; title?: string } = $props();

  let b = $state(untrack(() => b0));
  let obs = $state(untrack(() => n0));
  let relUnc = $state(untrack(() => u0));
  let logY = $state(false);

  const p = $derived(poissonTail(obs, b));
  const z = $derived(obs > b && p < 1 ? pToZ(p) : 0);
  const pUnc = $derived(relUnc > 0 ? pValueWithUncertainty(obs, b, relUnc * b) : p);
  const zUnc = $derived(obs > b && pUnc < 1 ? pToZ(pUnc) : 0);
  const naive = $derived(b > 0 ? (obs - b) / Math.sqrt(b) : 0);

  /** The smallest count whose p-value is at most the one-sided threshold of Z σ. */
  function thresholdCount(zTarget: number): number {
    const pt = zToP(zTarget);
    let k = Math.max(0, Math.floor(b));
    while (poissonTail(k, b) > pt) k++;
    return k;
  }
  const n3 = $derived(thresholdCount(3));
  const n5 = $derived(thresholdCount(5));

  const sd = $derived(Math.sqrt(b));
  const xlo = $derived(0);
  const xhi = $derived(Math.max(obs, n5) + Math.max(4, 2 * sd) + 2);
  const ks = $derived(Array.from({ length: Math.floor(xhi) + 1 }, (_, k) => k));
  const pmf = $derived(ks.map((k) => poissonPmf(k, b)));
  const pmax = $derived(Math.max(...pmf));
  const yDomain = $derived<[number, number]>(logY ? [1e-9, 1] : [0, pmax * 1.15]);
  const xDomain = $derived<[number, number]>([xlo - 0.5, xhi + 0.5]);
  const verdict = $derived(z >= 5 ? 'discovery threshold (5σ) reached' : z >= 3 ? 'evidence (3σ) but not discovery' : z > 0 ? 'consistent with a background fluctuation' : 'no excess');
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={b} min={0.1} max={200} log label="Expected background b" format={(v) => sig(v, 3)} />
    <Slider bind:value={obs} min={0} max={250} step={1} label="Observed events N" format={(v) => v.toFixed(0)} />
    <Slider bind:value={relUnc} min={0} max={0.5} step={0.01} label="Uncertainty on b" format={(v) => `${(100 * v).toFixed(0)} %`} />
    <Toggle bind:checked={logY} label="Log scale" />
  {/snippet}

  <Plot x={{ domain: xDomain, label: 'Number of events' }} y={{ type: logY ? 'log' : 'linear', domain: yDomain, label: 'Probability if there is only background' }} height={300} label="Poisson distribution of the background-only count with the tail at or above the observed count shaded">
    {#snippet marks({ sx, sy, height })}
      {@const floor = logY ? yDomain[0] : 0}
      {#each ks as k}
        {@const v = Math.max(pmf[k]!, floor)}
        {@const x0 = sx(k - 0.42)}
        {@const x1 = sx(k + 0.42)}
        <rect x={x0} y={sy(v)} width={Math.max(1, x1 - x0)} height={Math.max(0, sy(floor) - sy(v))} fill={k >= obs ? 'var(--sig-high)' : 'var(--series-8)'} fill-opacity={k >= obs ? 0.9 : 0.55} />
      {/each}
      <line x1={sx(n3 - 0.5)} x2={sx(n3 - 0.5)} y1="0" y2={height} stroke="var(--series-1)" stroke-dasharray="4 3" />
      <text x={sx(n3 - 0.5) + 4} y="14" class="lbl" fill="var(--series-1)">3σ: N ≥ {n3}</text>
      <line x1={sx(n5 - 0.5)} x2={sx(n5 - 0.5)} y1="0" y2={height} stroke="var(--bad)" stroke-dasharray="4 3" />
      <text x={sx(n5 - 0.5) + 4} y="30" class="lbl" fill="var(--bad)">5σ: N ≥ {n5}</text>
      <line x1={sx(obs)} x2={sx(obs)} y1="0" y2={height} stroke="var(--fg)" stroke-width="1.5" />
      <text x={sx(obs) - 4} y="14" class="lbl" text-anchor="end" fill="var(--fg)">observed {obs}</text>
    {/snippet}
  </Plot>

  <div class="readout ui" aria-live="polite">
    <div class="card hot">
      <span class="k">p-value, P(N ≥ {obs} | b = {sig(b, 3)})</span>
      <strong class="v">{fmtP(p)}</strong>
      <span class="s">one-sided tail area (the shaded bars)</span>
    </div>
    <div class="card">
      <span class="k">Significance Z</span>
      <strong class="v">{fmtZ(z)}</strong>
      <span class="s">{verdict}. The naive (N − b)/√b gives {fmtZ(naive)}{#if b < 30}, which misleads at small b{/if}.</span>
    </div>
    {#if relUnc > 0}
      <div class="card">
        <span class="k">With a {(100 * relUnc).toFixed(0)} % uncertainty on b</span>
        <strong class="v">{fmtP(pUnc)} = {fmtZ(zUnc)}</strong>
        <span class="s">the p-value grows because b could really be larger</span>
      </div>
    {/if}
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
