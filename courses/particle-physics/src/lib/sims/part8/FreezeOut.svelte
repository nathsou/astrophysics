<!--
  Freeze-out: the abundance of a heavy relic particle as the universe cools. A toy of the standard calculation (see ./freezeout.ts): s-wave annihilation with a constant
  cross-section, g* = 90. Ω h² is compared with the measured dark-matter density.

    ::freeze-out{n="32.2" caption="…"}    Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinePlot from './LinePlot.svelte';
  import { solveFreezeOut, sigmaVForOmega } from './freezeout';
  import { sig, sci, pow10Label } from './format';

  let { n, caption, title = 'Freeze-out: how much dark matter is left over?' }: { n?: string | number; caption?: string; title?: string } = $props();

  let mass = $state(100);
  let sv = $state(3e-26);
  const r = $derived(solveFreezeOut({ mass, sigmaV: sv, xEnd: 300 }));
  // thin the arrays for plotting
  const idx = $derived(Array.from({ length: 200 }, (_, i) => Math.round((i / 199) * (r.x.length - 1))));
  const xs = $derived(idx.map((i) => r.x[i]!));
  const Y = $derived(idx.map((i) => r.Y[i]!));
  const Yeq = $derived(idx.map((i) => r.Yeq[i]!));
  const OBS = 0.120;
  const ratio = $derived(r.omegaH2 / OBS);
  const svObs = $derived(sigmaVForOmega(OBS, mass));
  function toObserved() {
    sv = Math.min(1e-24, Math.max(1e-28, svObs));
  }
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={mass} min={1} max={10000} log label="Mass m [GeV]" format={(v) => sig(v, 3)} />
    <Slider bind:value={sv} min={1e-28} max={1e-24} log label="Annihilation cross-section ⟨σv⟩ [cm³/s]" format={(v) => sci(v, 2)} />
    <Button onclick={toObserved} title="Set ⟨σv⟩ so that Ω h² equals the measured 0.120">Set ⟨σv⟩ for Ω h² = 0.120</Button>
  {/snippet}
  <LinePlot
    lines={[
      { x: xs, y: Yeq, label: 'equilibrium abundance', color: 'var(--series-8)', dash: '6 3' },
      { x: xs, y: Y, label: 'actual abundance', color: 'var(--series-1)' },
    ]}
    x={{ type: 'log', domain: [1.5, 300], label: 'x = m/T (time runs to the right as the universe cools)', tickValues: [2, 5, 10, 20, 50, 100, 300] }}
    y={{ type: 'log', domain: [1e-18, 0.1], label: 'abundance Y = n/s', tickValues: [1e-18, 1e-15, 1e-12, 1e-9, 1e-6, 1e-3], format: pow10Label }}
    vmarks={Number.isFinite(r.xFreeze) ? [{ value: r.xFreeze, label: `freeze-out x ≈ ${r.xFreeze.toFixed(0)}`, color: 'var(--series-5)' }] : []}
    height={290}
    label="Abundance of a thermal relic against x = m over T, on logarithmic axes, with the equilibrium abundance for comparison"
    format={(v) => sci(v, 2)}
  />
  <p class="ui out" aria-live="polite">
    Relic density: <strong>Ω h² = {sig(r.omegaH2, 3)}</strong> ({sig(ratio, 2)} × the measured 0.120 for cold dark matter). For this mass the measured value needs ⟨σv⟩ ≈ <strong>{sci(svObs, 2)} cm³/s</strong>,
    almost independent of the mass: a cross-section of roughly weak-interaction size.
  </p>
</Widget>

<style>
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
