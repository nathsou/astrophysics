<!--
  Vacuum stability, as a ONE-LOOP TOY (Chapter 30): the Higgs self-coupling λ run up in energy with the renormalisation-group equations (see rge.ts for the
  equations, the rounded inputs and the caveats). The top quark's Yukawa coupling pushes λ down as the scale rises and the gauge couplings push it up.
  If λ turns negative the potential, at that scale, no longer has its minimum at the origin of the field: the vacuum we live in is then not the lowest.
  Drag the top mass: the crossing scale moves by orders of magnitude. The careful two-loop and higher calculations put the crossing near 10¹⁰ GeV for the
  measured masses, with the top mass the largest uncertainty; this toy gets about 10⁹ and is NOT a prediction.

    ::vacuum-running{n="30.4" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { M_PLANCK_GEV, runCouplings } from './rge';

  let { n, caption, title = 'The Higgs self-coupling at high energy (a one-loop toy)' }: { n?: string | number; caption?: string; title?: string } = $props();

  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (e: number) => String(e).replace(/\d/g, (d) => SUP[+d]!);
  let mt = $state(172.57);
  let mH = $state(125.2);
  const run = $derived(runCouplings(mt, mH, 12));
  const xs = $derived(run.mu.map((m) => Math.log10(m)));
  const fmtScale = (x: number) => {
    if (x === Infinity) return 'never, before the Planck mass';
    const e = Math.floor(Math.log10(x));
    return `${(x / 10 ** e).toFixed(1)} × 10${sup(e)} GeV`;
  };
  const path = (sx: (v: number) => number, sy: (v: number) => number) => run.lambda.map((l, i) => `${i ? 'L' : 'M'}${sx(xs[i]!).toFixed(1)},${sy(l).toFixed(1)}`).join('');
  const lamMin = $derived(Math.min(-0.05, ...run.lambda) - 0.01);
</script>

<Widget {title} {n} {caption} kind="Toy model">
  {#snippet controls()}
    <Slider bind:value={mt} min={165} max={180} step={0.05} label="Top quark mass (GeV)" format={(v) => v.toFixed(2)} />
    <Slider bind:value={mH} min={115} max={135} step={0.1} label="Higgs boson mass (GeV)" format={(v) => v.toFixed(1)} />
  {/snippet}
  <Plot x={{ domain: [Math.log10(mt), Math.log10(M_PLANCK_GEV)], label: 'energy scale μ [GeV]', tickValues: [3, 6, 9, 12, 15, 18], format: (v) => `10${sup(v)}` }} y={{ domain: [lamMin, 0.15], label: 'λ(μ)' }} height={280} label="The Higgs self-coupling lambda as a function of the energy scale, falling through zero at a high scale">
    {#snippet marks({ sx, sy, width, height })}
      <rect x="0" y={sy(0)} width={width} height={Math.max(0, height - sy(0))} fill="var(--bad)" opacity="0.1" />
      <line x1="0" x2={width} y1={sy(0)} y2={sy(0)} stroke="var(--bad)" stroke-dasharray="4 3" />
      <text x="6" y={sy(0) + 14} class="lbl" fill="var(--bad)">λ &lt; 0: the potential is unbounded below at this scale</text>
      <path d={path(sx, sy)} fill="none" stroke="var(--p-higgs)" stroke-width="2.4" />
      {#if run.zeroAt !== Infinity}
        <circle cx={sx(Math.log10(run.zeroAt))} cy={sy(0)} r="4.5" fill="var(--sig-high)" />
      {/if}
    {/snippet}
  </Plot>
  <div class="readout ui" aria-live="polite">
    <div class="card hot"><span class="k">λ crosses zero at</span><strong class="v">{fmtScale(run.zeroAt)}</strong><span class="s">One-loop toy. Careful calculations give a value of the order of 10¹⁰ GeV for the measured masses.</span></div>
    <div class="card"><span class="k">λ at the Planck mass (1.2 × 10¹⁹ GeV)</span><strong class="v">{run.lambda.at(-1)!.toFixed(3)}</strong><span class="s">Negative means the Standard Model vacuum is not the lowest state if the theory held up to there: metastable, with a lifetime that the careful calculations find to be enormously longer than the age of the universe.</span></div>
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
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
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
