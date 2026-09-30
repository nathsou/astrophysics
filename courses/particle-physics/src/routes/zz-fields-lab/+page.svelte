<script lang="ts">
  import { page } from '$app/state';
  import FieldLattice from '$lib/sims/fields/FieldLattice.svelte';
  import Propagator from '$lib/sims/fields/Propagator.svelte';
  import PhaseDial from '$lib/sims/fields/PhaseDial.svelte';
  import MexicanHat from '$lib/sims/fields/MexicanHat.svelte';
  import MassSpectrum from '$lib/sims/fields/MassSpectrum.svelte';
  import StringBreaking from '$lib/sims/fields/StringBreaking.svelte';
  import LatticeGauge from '$lib/sims/fields/LatticeGauge.svelte';
  const w = $derived(page.url.searchParams.get('w') ?? 'all');
  const show = (k: string) => w === 'all' || w === k;
</script>

<svelte:head><title>fields lab</title></svelte:head>
<div class="page">
  {#if show('fl')}<FieldLattice n="14.1" caption="Test caption for the field lattice." />{/if}
  {#if show('pr')}<Propagator n="14.3" caption="Test caption propagator." />{/if}
  {#if show('pd')}<PhaseDial n="17.1" caption="Test caption phase dial." />{/if}
  {#if show('mh')}<MexicanHat n="26.1" caption="Test caption hat." />{/if}
  {#if show('lg')}<LatticeGauge n="17.3" caption="Test caption lattice gauge." />{/if}
  {#if show('sb')}<StringBreaking n="18.1" />{/if}
  {#if show('ms')}<MassSpectrum n="26.3" caption="Test caption spectrum." />{/if}
</div>
<style>.page { max-width: 52rem; margin: 1rem auto; padding: 0 1rem; }</style>
