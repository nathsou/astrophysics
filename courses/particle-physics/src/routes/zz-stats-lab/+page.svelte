<script lang="ts">
  import BumpHunter from '$lib/sims/stats/BumpHunter.svelte';
  import PValue from '$lib/sims/stats/PValue.svelte';
  import FitExplorer from '$lib/sims/stats/FitExplorer.svelte';
  import LookElsewhere from '$lib/sims/stats/LookElsewhere.svelte';
  import Systematics from '$lib/sims/stats/Systematics.svelte';
  import CutOptimiser from '$lib/sims/stats/CutOptimiser.svelte';
  import CutsExercise from '$lib/components/exercise/CutsExercise.svelte';
  import FitExercise from '$lib/components/exercise/FitExercise.svelte';

  const cuts = {
    id: 'zz-cuts', title: 'Tune the selection', prompt: '<p>Choose cuts on the diphoton mass and the isolation to beat the par significance.</p>', hints: ['Start with the mass window.'], par: 'auto',
    config: {
      seed: 7,
      signal: { events: 3000, yield: 60, vars: { m: { dist: 'normal', mean: 125, sigma: 2.5 }, iso: { dist: 'exponential', mean: 0.1 } } },
      background: { events: 30000, yield: 6000, vars: { m: { dist: 'exponential', mean: 35, offset: 100, max: 160 }, iso: { dist: 'exponential', mean: 0.4 } } },
    },
    variables: [
      { name: 'm', label: 'Diphoton mass', unit: 'GeV', kind: 'window', lo: 100, hi: 160, step: 0.5 },
      { name: 'iso', label: 'Isolation', kind: 'max', lo: 0, hi: 2, step: 0.02 },
    ],
  };
  const fit = {
    id: 'zz-fit', title: 'Fit the peak', prompt: '<p>How many signal events are there? Pick the background shape that describes the data.</p>', model: 'gauss+cheb2',
    data: { seed: 5, range: [100, 160], bins: 60, truth: { 'sig.yield': 400, 'sig.mean': 125, 'sig.sigma': 2, 'bkg.yield': 12000, 'bkg.c1': -0.45, 'bkg.c2': 0.12 }, xLabel: 'm [GeV]', unit: 'GeV' },
    config: { backgrounds: ['flat', 'exp', 'cheb2'], parameter: 'sig.yield', minPValue: 0.01 }, tolerance: 0.15, answer: 400,
  };
</script>

<main style="max-width: 1100px; margin: 0 auto; padding: 1rem;">
  <BumpHunter n="28.1" caption="Test caption." />
  <PValue n="28.2" caption="Another." />
  <FitExplorer mode="diphoton" n="28.3" caption="Fit." />
  <FitExplorer mode="fourlepton" n="28.4" caption="Fit 4l." />
  <LookElsewhere n="28.5" caption="Schematic." />
  <Systematics n="28.6" caption="Sys." />
  <CutOptimiser n="29.2" caption="Cuts." />
  <CutsExercise spec={cuts as never} />
  <FitExercise spec={fit as never} />
</main>
