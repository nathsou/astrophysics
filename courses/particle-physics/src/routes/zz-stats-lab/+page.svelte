<script lang="ts">
  import BumpHunter from '$lib/sims/stats/BumpHunter.svelte';
  import PValue from '$lib/sims/stats/PValue.svelte';
  import FitExplorer from '$lib/sims/stats/FitExplorer.svelte';
  import LookElsewhere from '$lib/sims/stats/LookElsewhere.svelte';
  import Systematics from '$lib/sims/stats/Systematics.svelte';
</script>

<main style="max-width: 1100px; margin: 0 auto; padding: 1rem;">
  <BumpHunter n="28.1" caption="Test caption." />
  <PValue n="28.2" caption="Another." />
  <FitExplorer mode="diphoton" n="28.3" caption="Fit." />
  <FitExplorer mode="fourlepton" n="28.4" caption="Fit 4l." />
  <LookElsewhere n="28.5" caption="Schematic." />
  <Systematics n="28.6" caption="Sys." />
</main>
