<!--
  Why an electromagnetic shower stops: an electron loses energy by ionisation at a rate that barely depends on its energy, and by bremsstrahlung at a rate
  proportional to it. Per radiation length, ionisation costs about the same few MeV while radiation costs E. Where the two lines cross is the critical energy.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import LinePlot from '$lib/sims/part2/LinePlot.svelte';
  import { electronLossPerX0, rossiCriticalEnergy } from '$lib/sims/part2/matter';
  import { materials, moliereRadius } from '$lib/hep/detector';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  let mat = $state('Pb');
  const M = $derived(materials[mat]!);
  const E = Array.from({ length: 81 }, (_, i) => 10 ** (-0.3 + (i * 3.3) / 80)); // 0.5 – 1000 MeV
  const ion = $derived(E.map((e) => electronLossPerX0(M, e).ionisation));
  const rad = E;
  const Ec = $derived(rossiCriticalEnergy(M));
</script>

<Widget title="Ionisation against radiation" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented label="Material" options={[{ value: 'Pb', label: 'lead' }, { value: 'Cu', label: 'copper' }, { value: 'Fe', label: 'iron' }, { value: 'Si', label: 'silicon' }, { value: 'H2O', label: 'water' }]} bind:value={mat} />
  {/snippet}
  <LinePlot
    lines={[
      { x: E, y: ion, label: 'lost to ionisation in one X₀', dash: '6 3', color: 'var(--series-1)' },
      { x: E, y: rad, label: 'lost to radiation in one X₀ (= E)', dash: '', color: 'var(--series-2)' },
    ]}
    vmarks={[{ value: Ec, label: `E_c = ${Ec.toFixed(1)} MeV`, color: 'var(--mute)' }]}
    x={{ type: 'log', domain: [0.5, 1000], label: 'electron energy E [MeV]' }}
    y={{ type: 'log', domain: [0.5, 1000], label: 'energy lost in one radiation length [MeV]' }}
    height={300}
    label="Energy lost per radiation length by ionisation and by radiation against electron energy, crossing at the critical energy"
  />
  <p class="ui small">
    In {M.label.toLowerCase()} one radiation length is {M.X0cm.toFixed(M.X0cm < 10 ? 2 : 1)} cm. Above {Ec.toFixed(1)} MeV bremsstrahlung dominates and the shower keeps multiplying; below it the electrons
    are soaked up by ionisation. The Molière radius, {moliereRadius(M).toFixed(1)} cm, is the width of the shower; the library's table value of E<sub>c</sub> is {M.Ec.toFixed(1)} MeV.
  </p>
</Widget>

<style>
  .small {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
