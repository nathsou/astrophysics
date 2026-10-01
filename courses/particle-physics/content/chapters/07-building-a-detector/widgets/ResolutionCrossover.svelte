<!--
  Why a detector has both a tracker and calorimeters: the tracker's relative momentum resolution gets worse as the momentum rises (the track bends less),
  the calorimeter's relative energy resolution gets better (more particles in the shower). Curves from Gluckstern's formula and from the calorimeter's a/√E ⊕ b ⊕ n/E for three
  presets of hep/detector; dots from simulating particles and fitting them.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinePlot from '$lib/sims/part2/LinePlot.svelte';
  import { presets, caloResolution, type DetectorConfig } from '$lib/hep/detector';
  import { glucksternMeasurement, glucksternScattering, K03 } from '$lib/sims/part2/trackMc';
  import { trackerResolution, caloMeasurement } from '$lib/sims/part2/designer';
  import { rng as makeRng } from '$lib/hep/random';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let key = $state<'onion' | 'cms-like' | 'atlas-like'>('onion');
  let withDots = $state(false);
  const cfg = $derived(presets[key] as DetectorConfig);
  const E = Array.from({ length: 41 }, (_, i) => 10 ** (0 + (i * 3) / 40)); // 1 – 1000 GeV

  // the tracker in Gluckstern's terms: lever arm = outermost layer, N layers, the mean position error, the total material
  const setup = $derived.by(() => {
    const L = cfg.trackerLayers.at(-1)!.r / 1000;
    const nL = cfg.trackerLayers.length;
    const sig = cfg.trackerLayers.reduce((a, l) => a + l.sigmaRPhi * l.sigmaRPhi, 0) / nL;
    const x0 = cfg.trackerLayers.reduce((a, l) => a + l.x0, 0);
    return { B: cfg.bField, L, n: nL, sigma: Math.sqrt(sig) * 1e-3, x0 };
  });
  const trk = $derived(E.map((p) => Math.hypot(glucksternMeasurement(p, setup), glucksternScattering(p, setup, 1))));
  const ecal = $derived(E.map((e) => caloResolution('em', e, cfg, 9)));
  const hcal = $derived(E.map((e) => caloResolution('had', e, cfg, 9)));
  const cross = $derived.by(() => {
    for (let i = 0; i < E.length; i++) if (trk[i]! > ecal[i]!) return E[i]!;
    return null;
  });

  let dots = $state<{ x: number; y: number; color: string }[]>([]);
  let busy = $state(false);
  function simulateDots() {
    busy = true;
    setTimeout(() => {
      const c = cfg;
      const r = makeRng(5);
      const out: { x: number; y: number; color: string }[] = [];
      for (const p of [10, 100, 400]) out.push({ x: p, y: trackerResolution(c, p, 100, r.fork('t' + p)), color: 'var(--series-1)' });
      for (const e of [5, 20, 100, 400]) out.push({ x: e, y: caloMeasurement(c, 11, e, 60, r.fork('e' + e)).res, color: 'var(--series-2)' });
      for (const e of [10, 50, 200]) out.push({ x: e, y: caloMeasurement(c, 211, e, 60, r.fork('h' + e)).res, color: 'var(--series-3)' });
      dots = out.filter((d) => Number.isFinite(d.y) && d.y > 0);
      busy = false;
    }, 30);
  }
  $effect(() => {
    void key;
    dots = [];
    if (withDots) simulateDots();
  });
  const pct = (v: number) => `${Number((100 * v).toPrecision(2))} %`;
</script>

<Widget title="Tracker against calorimeter" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented label="Detector" options={[{ value: 'onion', label: 'course detector' }, { value: 'cms-like', label: 'CMS-like' }, { value: 'atlas-like', label: 'ATLAS-like' }]} bind:value={key} />
    <Button onclick={() => (withDots = !withDots)}>{withDots ? 'Hide' : 'Show'} simulated points</Button>
  {/snippet}
  <LinePlot
    lines={[
      { x: E, y: trk, label: 'tracker: σ(pT)/pT', dash: '', color: 'var(--series-1)' },
      { x: E, y: ecal, label: 'ECAL: σ(E)/E, electrons and photons', dash: '6 3', color: 'var(--series-2)' },
      { x: E, y: hcal, label: 'HCAL: σ(E)/E, hadrons', dash: '2 3', color: 'var(--series-3)' },
    ]}
    points={dots}
    vmarks={cross ? [{ value: cross, label: `tracker worse above ${cross.toFixed(0)} GeV`, color: 'var(--mute)' }] : []}
    x={{ type: 'log', domain: [1, 1000], label: 'momentum or energy [GeV]' }}
    y={{ type: 'log', domain: [1e-3, 1], label: 'relative resolution', format: (v) => `${Number((100 * v).toPrecision(2))} %` }}
    height={320}
    label="Relative resolution of the tracker's momentum measurement and of the calorimeters' energy measurement against momentum or energy"
  />
  <p class="ui small">
    {cfg.name === 'onion' ? 'The course detector' : key === 'cms-like' ? 'The CMS-like preset' : 'The ATLAS-like preset'}: {cfg.bField} T, tracker to {(cfg.trackerLayers.at(-1)!.r / 1000).toFixed(2)} m with {cfg.trackerLayers.length} layers.
    ECAL a = {pct(cfg.ecal.stochastic)}/√E ⊕ {pct(cfg.ecal.constant)}; HCAL a = {pct(cfg.hcal.stochastic)}/√E ⊕ {pct(cfg.hcal.constant)}. At 10 GeV the tracker gives {pct(trk[Math.round((40 / 3) * 1)]!)}, the ECAL {pct(ecal[Math.round((40 / 3) * 1)]!)};
    at 500 GeV the tracker {pct(trk[Math.round((40 / 3) * 2.7)]!)}, the ECAL {pct(ecal[Math.round((40 / 3) * 2.7)]!)}. {#if busy}Simulating…{/if}
    These are the presets' own approximate numbers (see the library notes), not the published performance of either experiment.
  </p>
</Widget>

<style>
  .small {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
