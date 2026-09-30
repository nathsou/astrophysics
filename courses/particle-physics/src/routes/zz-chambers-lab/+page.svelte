<script lang="ts">
  import { page } from '$app/state';
  import { CloudChamber } from '$lib/widgets/chambers';
  const q = page.url.searchParams;
  const canvas = q.get('canvas') === '1';
  const w = q.get('w') ?? 'cloud';
</script>

<div style="max-width: 980px; margin: 0 auto; padding: 1rem;">
  {#if w === 'cloud'}
    <CloudChamber n="5.1" caption="Test" field={Number(q.get('field') ?? 0)} source={q.get('source') ?? 'mixed'} forceCanvas={canvas} scan={q.get('scan') === '1'} plate={q.get('plate') === '1'} />
  {:else if w === 'anderson'}
    <CloudChamber n="5.3" preset="anderson" caption="Test" forceCanvas={canvas} />
  {/if}
</div>
