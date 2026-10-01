<!--
  Energy loss in a thin absorber is not Gaussian. Fire minimum-ionising particles through a thin layer of silicon and histogram what each leaves: a peak, a long tail of
  rare hard collisions (delta rays), a most probable value below the mean. Samples from hep/detector's `sampleEnergyLoss` (a Landau distribution with Bichsel's peak).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { materials, mostProbableLoss, sampleEnergyLoss, meanEnergyLoss } from '$lib/hep/detector';
  import { rng } from '$lib/hep/random';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  let logT = $state(Math.log10(0.03)); // cm
  let mat = $state('Si');
  const M = $derived(materials[mat]!);
  const t = $derived(10 ** logT); // cm
  const x = $derived(t * M.density); // g/cm²
  const bg = 3.5;
  const mass = 0.1056583755;
  const p = bg * mass;

  const data = $derived.by(() => {
    const r = rng(11);
    const v: number[] = [];
    for (let i = 0; i < 20000; i++) v.push(sampleEnergyLoss(r, M, x, p, mass) * 1e6); // keV
    return v;
  });
  const mpv = $derived(mostProbableLoss(M, x, bg) * 1e3); // keV
  const bethe = $derived(meanEnergyLoss(M, x, p, mass) * 1e6); // keV
  const sampleMean = $derived(data.reduce((a, b) => a + b, 0) / data.length);
  const hi = $derived(Math.max(4 * bethe, 2.6 * mpv, 10));
  const nb = 60;
  const edges = $derived(Array.from({ length: nb + 1 }, (_, i) => (hi * i) / nb));
  const counts = $derived.by(() => {
    const c = new Array<number>(nb).fill(0);
    for (const v of data) {
      const b = Math.floor((v / hi) * nb);
      if (b >= 0 && b < nb) c[b]!++;
    }
    return c;
  });
  const fmtT = (cm: number) => (cm < 0.1 ? `${(cm * 1e4).toFixed(0)} μm` : `${(cm * 10).toFixed(1)} mm`);
</script>

<Widget title="Energy loss in a thin layer" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented label="Material" options={[{ value: 'Si', label: 'silicon' }, { value: 'Fe', label: 'iron' }, { value: 'H2O', label: 'water' }]} bind:value={mat} />
    <Slider bind:value={logT} min={-3.3} max={0.3} step={0.02} label="Thickness" format={(v) => fmtT(10 ** v)} />
  {/snippet}
  <HepHist
    label="Histogram of the energy lost by 20,000 simulated minimum-ionising muons in a thin layer, in keV, with the most probable value and the mean marked"
    series={[{ edges, counts, label: `${data.length.toLocaleString('en-GB')} muons of βγ = 3.5`, errors: false }]}
    x={{ domain: [0, hi], label: 'energy lost [keV]' }}
    y={{ domain: [0, Math.max(...counts) * 1.15], label: 'particles per bin' }}
    markers={[
      { x: mpv, label: 'most probable', at: 0.92 },
      { x: bethe, label: 'mean (Bethe–Bloch)', at: 0.78, color: 'var(--series-2)' },
    ]}
    height={300}
  />
  <p class="ui small">
    {fmtT(t)} of {M.label.toLowerCase()} is {(x * 1000).toFixed(x < 0.1 ? 1 : 0)} mg/cm². The most probable loss is <strong>{mpv.toFixed(mpv < 10 ? 2 : 1)} keV</strong>; the mean from the Bethe–Bloch formula is
    <strong>{bethe.toFixed(bethe < 10 ? 2 : 1)} keV</strong>, {(bethe / mpv).toFixed(2)} times larger, because of the tail. (The sampled mean is {sampleMean.toFixed(sampleMean < 10 ? 2 : 1)} keV: the simulation cuts the tail at the largest possible single transfer.)
    The thinner the layer, the further the peak sits below the mean; in a thick absorber the loss becomes Gaussian and the two coincide.
  </p>
</Widget>

<style>
  .small {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
