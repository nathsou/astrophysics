<!--
  The three gauge couplings of the Standard Model against energy, at one loop, with and without a supersymmetric extension above a chosen superpartner mass.
  A toy (see ./running.ts): one loop, sharp threshold, no GUT-scale thresholds. 1/α is plotted because it runs linearly in ln μ at one loop.

    ::coupling-running{n="32.4" caption="…"}    Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import LinePlot from './LinePlot.svelte';
  import { inverseCouplings, closestApproach } from './running';
  import { logspace, sig, sci, pow10Label } from './format';

  let { n, caption, title = 'Do the three forces meet?' }: { n?: string | number; caption?: string; title?: string } = $props();

  let susy = $state(false);
  let mSusy = $state(1000);
  const mus = logspace(91.19, 1e19, 220);
  const sm = $derived(mus.map((m) => inverseCouplings(m)));
  const ss = $derived(mus.map((m) => inverseCouplings(m, mSusy)));
  const NAMES = ['1/α₁ (hypercharge)', '1/α₂ (weak isospin)', '1/α₃ (colour)'];
  const COLS = ['var(--series-1)', 'var(--series-5)', 'var(--series-7)'];
  const lines = $derived([
    ...[0, 1, 2].map((i) => ({ x: mus, y: sm.map((a) => a[i]!), label: `${NAMES[i]}, Standard Model`, color: COLS[i], dash: '' })),
    ...(susy ? [0, 1, 2].map((i) => ({ x: mus, y: ss.map((a) => a[i]!), label: `${NAMES[i]}, with superpartners`, color: COLS[i], dash: '6 3' })) : []),
  ]);
  const smBest = closestApproach();
  const ssBest = $derived(closestApproach(mSusy));
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Toggle bind:checked={susy} label="Add superpartners (minimal supersymmetry)" />
    {#if susy}<Slider bind:value={mSusy} min={91.2} max={30000} log label="Superpartner mass [GeV]" format={(v) => sig(v, 3)} />{/if}
  {/snippet}
  <LinePlot
    {lines}
    x={{ type: 'log', domain: [91.19, 1e19], label: 'energy scale μ [GeV]', tickValues: [1e2, 1e4, 1e6, 1e8, 1e10, 1e12, 1e14, 1e16, 1e18], format: pow10Label }}
    y={{ domain: [0, 65], label: 'inverse coupling 1/α' }}
    height={320}
    label="Inverse gauge couplings against energy scale for the Standard Model, and with supersymmetric partners above a chosen mass"
    format={(v) => sig(v, 3)}
  />
  <p class="ui out" aria-live="polite">
    Standard Model: the closest the three come to one point is a spread of {sig(smBest.spread, 2)} in 1/α, at about {sci(smBest.mu, 2)} GeV (1/α is about 40 there).
    {#if susy}With superpartners at {sig(mSusy, 3)} GeV: a spread of {sig(ssBest.spread, 2)} at about {sci(ssBest.mu, 2)} GeV.{:else}Switch on the superpartners to see the three lines bend to meet.{/if}
    Toy: one-loop running with a sharp threshold.
  </p>
</Widget>

<style>
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
</style>
