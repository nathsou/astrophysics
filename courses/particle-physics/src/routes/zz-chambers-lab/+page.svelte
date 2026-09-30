<script lang="ts">
  import { page } from '$app/state';
  import { CloudChamber, BubbleChamber, ScanTable } from '$lib/widgets/chambers';
  import ScanExercise from '$lib/components/exercise/ScanExercise.svelte';
  import IdentifyExercise from '$lib/components/exercise/IdentifyExercise.svelte';
  const q = page.url.searchParams;
  const canvas = q.get('canvas') === '1';
  const w = q.get('w') ?? 'cloud';
  const pre = q.get('preset') ?? '';
</script>

<div style="max-width: 980px; margin: 0 auto; padding: 1rem;">
  {#if w === 'cloud'}
    <CloudChamber n="5.1" caption="Test" field={Number(q.get('field') ?? 0)} source={q.get('source') ?? 'mixed'} forceCanvas={canvas} scan={q.get('scan') === '1'} plate={q.get('plate') === '1'} />
  {:else if w === 'anderson'}
    <CloudChamber n="5.3" preset="anderson" caption="Test" forceCanvas={canvas} />
  {:else if w === 'bubble'}
    <BubbleChamber n="12.4" preset={pre || 'omega'} caption="Test" forceCanvas={canvas} />
  {:else if w === 'scan'}
    <ScanTable n="5.4" preset={pre || 'cloud:alpha,mu-,e+'} seed={Number(q.get('seed') ?? 3)} field={q.get('field') ? Number(q.get('field')) : 1} forceCanvas={canvas} />
  {:else if w === 'scanex'}
    <ScanExercise
      spec={{ id: 'lab/scan', title: 'Momentum of a track', prompt: '<p>Measure the momentum of track C and say which sign of charge it has.</p>', config: { preset: 'cloud:alpha,mu-,e+', seed: 3, field: 1 }, answers: { momentum: { track: 'C', tolerance: 0.12 }, charge: { track: 'C' } }, tolerance: 0.1 }}
    />
  {:else if w === 'identify'}
    <IdentifyExercise
      spec={{ id: 'lab/identify', title: 'Who is who?', prompt: '<p>Identify the particles that made the labelled tracks.</p>', event: { preset: 'cloud', seed: 4 }, config: { field: 1 }, answers: ['alpha', 'mu-', 'e+', 'pi+'] }}
    />
  {/if}
</div>
