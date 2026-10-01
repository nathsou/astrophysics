<!--
  Super-Kamiokande's discovery, as a toy: atmospheric muon neutrinos arrive from every direction; those from below have crossed the Earth.
  The path length depends on the zenith angle; the survival probability averages over a power-law energy spectrum; Poisson counts are drawn from
  a fixed seed. The unoscillated flux is taken as the same in every direction, which is approximately true at multi-GeV energies (an assumption).

    ::zenith-angle{n="31.3" caption="…"}    Props: `n`, `caption`, `title`, `seed`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import LinePlot from './LinePlot.svelte';
  import { paramsFromSin2, probabilities3, GLOBAL_FIT_APPROX } from '$lib/hep/oscillations';
  import { poisson, rng as makeRng } from '$lib/hep/random';
  import { linspace, sig, sci } from './format';

  let { n, caption, title = 'Muon neutrinos from above and from below', seed: seed0 = 11 }: { n?: string | number; caption?: string; title?: string; seed?: number } = $props();

  const R_EARTH = 6371;
  const H_PROD = 15;
  /** Distance from the production point (at altitude 15 km) to a detector at the surface, for a neutrino arriving at zenith angle z (cos z = c; c = −1 is straight up through the Earth). */
  function pathLength(c: number): number {
    const s2 = 1 - c * c;
    return Math.sqrt((R_EARTH + H_PROD) ** 2 - R_EARTH ** 2 * s2) - R_EARTH * c;
  }

  let dm3l = $state<number>(GLOBAL_FIT_APPROX.dm3l);
  let s23 = $state<number>(GLOBAL_FIT_APPROX.sin2theta23);
  let Elo = $state(1);
  let perBin = $state(300);
  let seed = $state(seed0);
  let oscillate = $state(true);

  const NB = 20;
  const edges = linspace(-1, 1, NB + 1);
  const centres = edges.slice(0, NB).map((e, i) => 0.5 * (e + edges[i + 1]!));
  // Energy spectrum dN/dE ∝ E⁻² from Elo to 10 Elo: uniform in ln E weighted by 1/E, sampled on a grid.
  const params = $derived(paramsFromSin2(GLOBAL_FIT_APPROX.sin2theta12, GLOBAL_FIT_APPROX.sin2theta13, s23, GLOBAL_FIT_APPROX.deltaCPDeg, GLOBAL_FIT_APPROX.dm21, dm3l));
  const NE = 150;
  function survival(c: number, E0: number): number {
    const L = pathLength(c);
    let num = 0, den = 0;
    for (let k = 0; k < NE; k++) {
      const u = (k + 0.5) / NE;
      const E = E0 * Math.pow(10, u);
      const w = 1 / E; // dN/dlnE for E⁻²
      num += w * probabilities3(params, L, E)[1]![1]!;
      den += w;
    }
    return num / den;
  }
  const fine = linspace(-1, 1, 61);
  const curve = $derived(fine.map((c) => (oscillate ? survival(c, Elo) : 1)));
  const expected = $derived(centres.map((c) => perBin * (oscillate ? survival(c, Elo) : 1)));
  const counts = $derived.by(() => {
    const r = makeRng(seed);
    return expected.map((e) => poisson(r, e));
  });
  const up = $derived(counts.filter((_, i) => centres[i]! < -0.2).reduce((a, b) => a + b, 0));
  const down = $derived(counts.filter((_, i) => centres[i]! > 0.2).reduce((a, b) => a + b, 0));
  const nUp = centres.filter((c) => c < -0.2).length;
  const nDown = centres.filter((c) => c > 0.2).length;
  const ratio = $derived(up / nUp / (down / nDown));
  const ratioErr = $derived(ratio * Math.sqrt(1 / Math.max(up, 1) + 1 / Math.max(down, 1)));
  const points = $derived(centres.map((c, i) => ({ x: c, y: counts[i]! / perBin, yerr: Math.sqrt(counts[i]!) / perBin, color: 'var(--series-1)' })));
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={Elo} min={0.3} max={10} log label="Lowest energy [GeV] (spectrum to ten times this)" format={(v) => sig(v, 2)} />
    <Slider bind:value={dm3l} min={1e-3} max={5e-3} step={1e-5} label="Δm² [eV²]" format={(v) => sci(v, 3)} />
    <Slider bind:value={s23} min={0.3} max={0.7} step={0.005} label="sin²θ₂₃" format={(v) => v.toFixed(3)} />
    <Slider bind:value={perBin} min={30} max={3000} log label="Expected events per bin, no oscillation" format={(v) => sig(v, 3)} />
    <div class="row ui">
      <Toggle bind:checked={oscillate} label="Neutrinos oscillate" />
      <Button onclick={() => (seed = seed + 1)}>Re-roll the events <span class="seed">seed {seed}</span></Button>
    </div>
  {/snippet}
  <LinePlot
    lines={[{ x: fine, y: curve, label: 'expected ν_μ survival (averaged over the spectrum)', color: 'var(--series-5)' }]}
    {points}
    x={{ domain: [-1, 1], label: 'cos of the zenith angle: −1 arrives from straight below (through the Earth, 12,700 km), +1 from straight above (15 km)' }}
    y={{ domain: [0, 1.25], label: 'observed / expected without oscillation' }}
    hmarks={[{ value: 1, label: 'no oscillation', color: 'var(--mute)' }]}
    height={290}
    label="Simulated muon-neutrino counts against the cosine of the zenith angle, relative to no oscillation, with the expected curve"
    format={(v) => sig(v, 3)}
  />
  <p class="ui out" aria-live="polite">
    Up-going (cos z &lt; −0.2) over down-going (cos z &gt; 0.2): <strong>{ratio.toFixed(2)} ± {ratioErr.toFixed(2)}</strong>.
    Without oscillation it would be 1. Toy: one flavour channel, a flat unoscillated flux, no detector response, no matter effects.
  </p>
</Widget>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: center;
  }
  .seed {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    margin-left: 0.3rem;
  }
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
</style>
