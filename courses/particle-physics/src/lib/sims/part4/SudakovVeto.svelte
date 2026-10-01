<!--
  The Sudakov veto algorithm (Chapter 18, under the hood): trial scales from a simple overestimate, each kept or vetoed
  by comparison with the true emission rate, and the resulting distribution of first-emission scales against the analytic
  Sudakov formula. A quark of energy E radiating at fixed coupling; the rate is hep/shower's `emissionRate`.

    ::sudakov-veto{n="18.6" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import { emissionRate, sudakov } from '$lib/hep/shower';
  import { firstEmission, overRate, traceVeto, type Trial } from './veto';

  let { n, caption, title = 'The veto algorithm at work' }: { n?: string | number; caption?: string; title?: string } = $props();

  const E = 45.6; // a quark from Z → qq̄
  const tmax = (E / 2) ** 2;
  const tmin = 1;
  let alpha = $state(0.2);
  let seed = $state(1);
  let count = $state(0);
  let trials = $state<Trial[]>([]);

  function evolve() {
    count += 1;
    trials = traceVeto(E, tmax, tmin, alpha, rng(seed * 1000 + count));
  }
  $effect(() => {
    void alpha;
    void seed;
    untrack(() => {
      count = 0;
      evolve();
    });
  });

  const over = $derived(overRate(E, tmin, alpha));
  const curve = $derived(Array.from({ length: 120 }, (_, i) => {
    const t = tmin * Math.pow(tmax / tmin, i / 119);
    return { t, y: emissionRate(t, { parton: 'q', E, alphaS: alpha }) };
  }));

  // the distribution of first emissions
  const NEV = 6000;
  const NB = 24;
  const stats = $derived.by(() => {
    const g = rng(99);
    const counts = new Array<number>(NB).fill(0);
    let none = 0;
    const l0 = Math.log(tmin), l1 = Math.log(tmax);
    for (let i = 0; i < NEV; i++) {
      const t = firstEmission(E, tmax, tmin, alpha, g);
      if (t === null) {
        none++;
        continue;
      }
      const k = Math.min(NB - 1, Math.floor(((Math.log(t) - l0) / (l1 - l0)) * NB));
      counts[k]!++;
    }
    return { counts, none };
  });
  const dl = Math.log(tmax / tmin) / NB;
  const density = (t: number) => emissionRate(t, { parton: 'q', E, alphaS: alpha }) * sudakov(t, tmax, { parton: 'q', E, alphaS: alpha });
  const histMax = $derived(Math.max(...stats.counts.map((c) => c / (NEV * dl)), ...curve.map((p) => density(p.t))) * 1.15);
  const pNone = $derived(sudakov(tmin, tmax, { parton: 'q', E, alphaS: alpha }));
  const pt = (t: number) => Math.sqrt(t);
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={alpha} min={0.05} max={0.5} step={0.01} label="Coupling α_s (held fixed in this figure)" />
    <Button size="sm" variant="primary" onclick={evolve}>New evolution</Button>
    <Button size="sm" onclick={() => (seed += 1)}>Change seed ({seed})</Button>
  {/snippet}
  <div class="grid">
    <div>
      <p class="cap ui">One evolution of a {E} GeV quark, from p<sub>T</sub> = {pt(tmax).toFixed(1)} GeV down to {pt(tmin)} GeV</p>
      <Plot
        height={270}
        label="Emission rate against transverse momentum: the true rate, the flat overestimate and the trial points; a trial is accepted if it falls below the true rate"
        x={{ type: 'log', domain: [pt(tmin), pt(tmax)], label: 'trial p_T [GeV]', tickValues: [1, 2, 5, 10, 20] }}
        y={{ domain: [0, over * 1.08], label: 'rate per unit ln p_T²', ticks: 5 }}
      >
        {#snippet marks({ sx, sy, width })}
          <line x1="0" x2={width} y1={sy(over)} y2={sy(over)} stroke="var(--series-2)" stroke-width="2" stroke-dasharray="6 4" />
          <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${sx(pt(p.t)).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.2" />
          {#each trials as tr, i}
            {#if tr.accepted}
              <circle cx={sx(pt(tr.t))} cy={sy(tr.height)} r="6" fill="var(--ok)" stroke="var(--surface)" stroke-width="1.5" />
            {:else}
              <g stroke="var(--bad)" stroke-width="2">
                <line x1={sx(pt(tr.t)) - 5} x2={sx(pt(tr.t)) + 5} y1={sy(tr.height) - 5} y2={sy(tr.height) + 5} />
                <line x1={sx(pt(tr.t)) - 5} x2={sx(pt(tr.t)) + 5} y1={sy(tr.height) + 5} y2={sy(tr.height) - 5} />
              </g>
            {/if}
            <text x={sx(pt(tr.t)) + 7} y={sy(tr.height) - 8} class="tn">{i + 1}</text>
          {/each}
        {/snippet}
      </Plot>
      <p class="note ui">
        Dashed: the constant overestimate, for which trial scales are easy to draw (exponentially in ln t). Solid: the true emission rate. A trial at scale t gets a random height up to the dashed line; below the solid curve it is an emission (green dot), above it it is vetoed (red cross) and the search continues from there.
        {#if trials.length === 0}This evolution had no trial above the cutoff: no emission at all.{:else}This evolution took {trials.length} trial{trials.length > 1 ? 's' : ''}{trials[trials.length - 1]!.accepted ? `, and emitted at p_T = ${pt(trials[trials.length - 1]!.t).toFixed(1)} GeV` : ', with no emission'}.{/if}
      </p>
    </div>
    <div>
      <p class="cap ui">{NEV.toLocaleString()} evolutions: where the first emission happens</p>
      <Plot
        height={270}
        label="Histogram of first-emission transverse momentum from the veto algorithm, with the analytic curve"
        x={{ type: 'log', domain: [pt(tmin), pt(tmax)], label: 'first emission p_T [GeV]', tickValues: [1, 2, 5, 10, 20] }}
        y={{ domain: [0, histMax], label: 'probability per unit ln p_T²', ticks: 5 }}
      >
        {#snippet marks({ sx, sy })}
          {#each stats.counts as c, k}
            {@const t0 = tmin * Math.exp(k * dl)}
            {@const t1 = tmin * Math.exp((k + 1) * dl)}
            <rect x={sx(pt(t0)) + 0.5} y={sy(c / (NEV * dl))} width={Math.max(0, sx(pt(t1)) - sx(pt(t0)) - 1)} height={Math.max(0, sy(0) - sy(c / (NEV * dl)))} fill="var(--series-3)" opacity="0.4" />
          {/each}
          <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${sx(pt(p.t)).toFixed(1)},${sy(density(p.t)).toFixed(1)}`).join('')} fill="none" stroke="var(--series-7)" stroke-width="2" />
        {/snippet}
      </Plot>
      <p class="note ui">
        Line: (rate) × Δ, the analytic first-emission density, where Δ(t) = exp(−∫ rate d ln t′) is the Sudakov factor, the probability that nothing has been emitted above t. {((stats.none / NEV) * 100).toFixed(1)} % of evolutions emitted nothing above 1 GeV; the formula says {(pNone * 100).toFixed(1)} %.
      </p>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .cap {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .note {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
  .tn {
    font-size: 10px;
    fill: var(--ink-3);
  }
</style>
