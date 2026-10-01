<!--
  The Bethe–Bloch curve: mean energy loss by ionisation against momentum, for five particles in five materials, and the range of the chosen one.
  From hep/detector's `bethe` (with Sternheimer's density effect) and, for the range, the integral of 1/S.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import LinePlot from '$lib/sims/part2/LinePlot.svelte';
  import { SPECIES, stoppingPower, minimumIonisation, rangeCm, type Species } from '$lib/sims/part2/matter';
  import { materials } from '$lib/hep/detector';

  let { n, caption, material: m0 = 'Fe' }: { n?: string | number; caption?: string; material?: string } = $props();

  let mat = $state(['Si', 'Fe', 'Cu', 'Pb', 'H2O'].includes(m0) ? m0 : 'Fe');
  let density = $state(true);
  let chosen = $state<Species['id']>('p');

  const M = $derived(materials[mat]!);
  const pGrid = Array.from({ length: 101 }, (_, i) => 10 ** (-2 + (i * 5) / 100)); // 0.01 – 1000 GeV/c
  const lines = $derived(
    SPECIES.filter((s) => s.id !== 'e').map((s) => ({
      x: pGrid,
      y: pGrid.map((p) => (p / s.mass >= 0.1 ? stoppingPower(M, s.mass, p / s.mass, density) : NaN)),
      label: s.label,
      dash: { mu: '', pi: '6 3', K: '2 3', p: '8 3 2 3' }[s.id as 'mu' | 'pi' | 'K' | 'p'],
    })),
  );
  const mins = $derived(SPECIES.filter((s) => s.id !== 'e').map((s) => ({ s, ...minimumIonisation(M, s.mass) })));
  const minValue = $derived(mins[0]!.value);
  const sp = $derived(SPECIES.find((s) => s.id === chosen)!);
  const rGrid = pGrid.filter((p) => p > 0.03);
  const ranges = $derived(rGrid.map((p) => (chosen === 'e' ? NaN : rangeCm(M, sp, p))));
  const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const choices = SPECIES.filter((s) => s.id !== 'e').map((s) => ({ value: s.id, label: s.label }));
</script>

<Widget title="Energy loss and range" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented label="Material" options={[{ value: 'Si', label: 'silicon' }, { value: 'Fe', label: 'iron' }, { value: 'Cu', label: 'copper' }, { value: 'Pb', label: 'lead' }, { value: 'H2O', label: 'water' }]} bind:value={mat} />
    <Toggle bind:checked={density} label="density effect" />
    <Segmented label="Particle for the range" options={choices} bind:value={chosen} />
  {/snippet}
  <div class="grid">
    <div>
      <h5 class="ui">−dE/dx against momentum</h5>
      <LinePlot
        {lines}
        x={{ type: 'log', domain: [0.01, 1000], label: 'momentum p [GeV/c]' }}
        y={{ type: 'log', domain: [1, 1000], label: 'MeV cm²/g' }}
        hmarks={[{ value: minValue, label: 'minimum', color: 'var(--mute)' }]}
        height={290}
        label="Mean energy loss by ionisation in {M.label} against momentum for a muon, pion, kaon and proton"
      />
      <p class="ui small">
        In {M.label.toLowerCase()} the minimum is {minValue.toFixed(3)} MeV cm²/g, {(minValue * M.density).toFixed(2)} MeV per cm, reached at βγ ≈ {mins[0]!.betaGamma.toFixed(1)}.
        It falls at {mins.map((m) => `${m.s.label} ${fmt((m.betaGamma * m.s.mass))}`).join(', ')} GeV/c.
      </p>
    </div>
    <div>
      <h5 class="ui">Range of a {sp.label} in {M.label.toLowerCase()}</h5>
      <LinePlot
        lines={[{ x: rGrid, y: ranges, label: 'range', dash: '' }]}
        x={{ type: 'log', domain: [0.03, 1000], label: 'momentum p [GeV/c]' }}
        y={{ type: 'log', domain: [0.01, 1e5], label: 'range [cm]' }}
        legend={false}
        height={290}
        label="Range of the chosen particle in the chosen material against momentum, in centimetres"
      />
      <p class="ui small">Range at 1 GeV/c: {fmt(rangeCm(M, sp, 1))} cm. A muon's range includes its radiative loss (the library's muon model); the others are the integral of dE/dx, which is a good guide up to a few hundred GeV.</p>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.2rem;
  }
  @media (max-width: 820px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    font-weight: 500;
  }
  .small {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
