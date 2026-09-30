<!--
  "The rate is proportional to the remaining gap", with no calculus: divide each time constant into N equal
  steps and let every step close 1/N of the gap that is left at its start. With few steps the line is a crude
  polygon; as N grows it becomes the exponential, and the gap left after one τ tends to 1/e = 0.368.

    ::exp-curve{}
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { HALF_LIFE, exact, gapAfterOneTau, steps, type Mode } from './expo';

  let { n: fig }: { n?: string | number } = $props();

  let mode = $state<Mode>('charge');
  let N = $state(4);
  let t = $state(1);

  const T_MAX = 5;
  const W = 460;
  const H = 260;
  const M = { l: 46, r: 14, t: 14, b: 34 };
  const x = (tt: number) => M.l + (tt / T_MAX) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - v * (H - M.t - M.b);

  const curve = $derived(
    Array.from({ length: 201 }, (_, i) => {
      const tt = (i / 200) * T_MAX;
      return `${i ? 'L' : 'M'}${x(tt).toFixed(1)} ${y(exact(mode, tt)).toFixed(1)}`;
    }).join(' '),
  );
  const pts = $derived(steps(mode, N, T_MAX));
  const poly = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' '));

  const level = $derived(mode === 'charge' ? 1 - Math.exp(-1) : Math.exp(-1));
  const now = $derived(exact(mode, t));
  // The value the step-by-step version has after the last whole step before t.
  const stepIndex = $derived(Math.min(pts.length - 1, Math.floor(t * N + 1e-9)));
  const stepNow = $derived(pts[stepIndex]!.v);
  const tauStep = $derived(mode === 'charge' ? 1 - gapAfterOneTau(N) : gapAfterOneTau(N));
  const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
</script>

<Widget title="The exponential, one step at a time" n={fig} kind="Explorer" live={false} caption="Charge or discharge, and change the number of steps per time constant. The polygon uses the rule ‘this step closes 1/N of the gap’; the smooth curve is the exponential. Drag t to read both.">
  {#snippet controls()}
    <Segmented label="Charging or discharging" value={mode} onchange={(v) => (mode = v)} options={[{ value: 'charge', label: 'Charging' }, { value: 'decay', label: 'Discharging' }]} />
    <Segmented label="Steps per time constant" value={N} onchange={(v) => (N = v)} options={[1, 2, 4, 10, 50].map((v) => ({ value: v, label: `N = ${v}` }))} />
  {/snippet}

  <div class="ec">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="{mode === 'charge' ? 'Charging' : 'Discharging'} curve against time in time constants, with a polygon of {N} steps per time constant">
      {#each [0, 0.25, 0.5, 0.75, 1] as g (g)}
        <path class="grid" d="M{M.l} {y(g)} H{W - M.r}" />
        <text class="tick" x={M.l - 6} y={y(g) + 3.5} text-anchor="end">{Math.round(g * 100)} %</text>
      {/each}
      {#each [0, 1, 2, 3, 4, 5] as g (g)}
        <path class="grid v" d="M{x(g)} {M.t} V{H - M.b}" />
        <text class="tick" x={x(g)} y={H - M.b + 15} text-anchor="middle">{g === 0 ? '0' : g === 1 ? 'τ' : `${g}τ`}</text>
      {/each}
      <path class="ref" d="M{M.l} {y(level)} H{x(1)} V{H - M.b}" />
      <text class="reflabel" x={x(1) + 6} y={y(level) + (mode === 'charge' ? 14 : -6)}>{pct(level)} at τ</text>
      <path class="half" d="M{x(HALF_LIFE)} {y(0.5)} V{H - M.b}" />
      <circle class="halfdot" cx={x(HALF_LIFE)} cy={y(0.5)} r="3.5" />
      <text class="reflabel" x={x(HALF_LIFE) + (mode === 'charge' ? 6 : 8)} y={y(0.5) + (mode === 'charge' ? 16 : -8)}>50 % at 0.693 τ</text>

      <path class="poly" d={poly} />
      {#if N <= 10}
        {#each pts as p, i (i)}
          <circle class="stepdot" cx={x(p.t)} cy={y(p.v)} r="3" />
        {/each}
      {/if}
      <path class="exact" d={curve} />

      <path class="cursor" d="M{x(t)} {M.t} V{H - M.b}" />
      <circle class="cursordot" cx={x(t)} cy={y(now)} r="4.5" />
      <text class="axis" x={W - M.r} y={H - 4} text-anchor="end">time, in time constants</text>
    </svg>

    <div class="key" aria-hidden="true">
      <span><i class="sw exact"></i> exact: {mode === 'charge' ? '1 − e^(−t/τ)' : 'e^(−t/τ)'}</span>
      <span><i class="sw poly"></i> {N} step{N === 1 ? '' : 's'} per τ</span>
    </div>

    <Slider label="Time t (in τ)" bind:value={t} min={0} max={T_MAX} step={0.01} format={(v) => `${v.toFixed(2)} τ`} />

    <dl class="read" aria-live="polite">
      <div><dt>Exact at cursor</dt><dd>{pct(now)}</dd></div>
      <div><dt>Steps at cursor</dt><dd>{pct(stepNow)}</dd></div>
      <div><dt>Exact at τ</dt><dd>{pct(level)}</dd></div>
      <div><dt>Steps at τ</dt><dd>{pct(tauStep)}</dd></div>
    </dl>
  </div>
</Widget>

<style>
  .ec {
    display: grid;
    gap: 0.8rem;
    padding: 0.8rem 1.1rem 1.1rem;
  }
  svg {
    width: 100%;
    max-width: 40rem;
    height: auto;
    margin: 0 auto;
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .tick,
  .axis,
  .reflabel {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--mute);
  }
  .reflabel {
    fill: var(--copper-ink);
  }
  .ref,
  .half {
    stroke: var(--copper);
    stroke-width: 1.2;
    stroke-dasharray: 4 3;
    fill: none;
  }
  .half {
    stroke: var(--series-3);
  }
  .halfdot {
    fill: var(--series-3);
  }
  .exact {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 2.6;
    stroke-linejoin: round;
  }
  .poly {
    fill: none;
    stroke: var(--series-2);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .stepdot {
    fill: var(--panel);
    stroke: var(--series-2);
    stroke-width: 2;
  }
  .cursor {
    stroke: var(--fg);
    stroke-width: 1;
    opacity: 0.55;
  }
  .cursordot {
    fill: var(--fg);
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.2rem;
    justify-content: center;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .sw {
    display: inline-block;
    width: 1.6rem;
    height: 0;
    border-top: 3px solid;
    vertical-align: middle;
    margin-right: 0.35rem;
  }
  span .sw.exact {
    border-color: var(--series-1);
  }
  span .sw.poly {
    border-color: var(--series-2);
  }
  .read {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.5rem;
    margin: 0;
  }
  .read div {
    padding: 0.5rem 0.7rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 7px;
  }
  dt {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--fg);
  }
</style>
