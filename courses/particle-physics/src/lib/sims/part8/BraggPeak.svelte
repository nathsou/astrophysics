<!--
  Proton therapy: the depth–dose curve of protons in water, from the course's Bethe–Bloch (hep/detector), against an idealised photon beam. The proton curve is the stopping
  power at the residual energy, with a Gaussian range straggling; a spread-out Bragg peak adds beams of different energies to cover a target of chosen depth. A TOY, not a treatment plan
  (see ./medical.ts for what is left out).

    ::bragg-peak{n="33.2" caption="…"}    Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import LinePlot from './LinePlot.svelte';
  import { protonRange, protonDoseSmeared, photonDose, spreadOutPeak, energyForRange } from './medical';
  import { linspace, sig } from './format';

  let { n, caption, title = 'A proton beam stops where you tell it to' }: { n?: string | number; caption?: string; title?: string } = $props();

  let T = $state(150);
  let spread = $state(false);
  let depthA = $state(10);
  let width = $state(4);
  let photons = $state(true);

  const R = $derived(protonRange(T));
  const zs = $derived(linspace(0, Math.max(30, R + 4), 160));
  const single = $derived(zs.map((z) => protonDoseSmeared(T, z)));
  const sobp = $derived(spread ? spreadOutPeak(depthA, depthA + width) : null);
  const spreadDose = $derived(sobp ? zs.map((z) => sobp.dose(z)) : []);
  const peakOfSpread = $derived(sobp ? Math.max(...spreadDose) : 1);
  const photon = $derived(zs.map((z) => photonDose(z)));
  const entrance = $derived(sobp ? sobp.dose(0) / peakOfSpread : 0);
  const lines = $derived([
    ...(photons ? [{ x: zs, y: photon, label: 'photons (idealised exponential)', color: 'var(--series-8)', dash: '6 3' }] : []),
    { x: zs, y: single, label: `protons, ${T} MeV (range ${sig(R, 3)} cm)`, color: 'var(--series-1)', dash: '' },
    ...(sobp ? [{ x: zs, y: spreadDose.map((d) => d / peakOfSpread * Math.max(...single)), label: 'spread-out peak (scaled to the same maximum)', color: 'var(--series-5)', dash: '' }] : []),
  ]);
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={T} min={60} max={230} step={1} label="Proton energy [MeV]" format={(v) => v.toFixed(0)} />
    <Toggle bind:checked={photons} label="Show photons" />
    <Toggle bind:checked={spread} label="Spread-out Bragg peak" />
    {#if spread}
      <Slider bind:value={depthA} min={4} max={22} step={0.5} label="Target starts at depth [cm]" format={(v) => v.toFixed(1)} />
      <Slider bind:value={width} min={1} max={8} step={0.5} label="Target thickness [cm]" format={(v) => v.toFixed(1)} />
    {/if}
  {/snippet}
  <LinePlot
    {lines}
    x={{ domain: [0, zs[zs.length - 1]!], label: 'depth in water [cm]' }}
    y={{ domain: [0, Math.max(6, ...single) * 1.08], label: 'relative dose' }}
    vmarks={spread && sobp ? [{ value: depthA, color: 'var(--series-5)' }, { value: depthA + width, label: 'target', color: 'var(--series-5)' }] : [{ value: R, label: 'range', color: 'var(--series-1)' }]}
    height={290}
    label="Relative dose against depth in water for protons, for an idealised photon beam, and for a spread-out Bragg peak"
    format={(v) => sig(v, 3)}
  />
  <p class="ui out" aria-live="polite">
    Range of a {T} MeV proton in water: {sig(R, 3)} cm. Peak-to-entrance dose ratio: {sig(Math.max(...single), 3)}.
    {#if spread && sobp}To cover {depthA}–{depthA + width} cm the beam uses {sobp.energies.length} energies from {sig(energyForRange(depthA), 3)} to {sig(energyForRange(depthA + width), 3)} MeV; the entrance dose is {(entrance * 100).toFixed(0)} % of the target dose.{/if}
    Toy: no nuclear interactions, no beam energy spread, no lateral spread, so the peak is higher than a real one; the photon curve has no build-up region.
  </p>
</Widget>

<style>
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
</style>
