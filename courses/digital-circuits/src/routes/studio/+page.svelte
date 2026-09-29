<!--
  The Device Studio: a full-screen workspace for programmable devices (vPROM, vPLA, GAL22V10, vCPLD-32).
  Everything lives in src/lib/studio. The design travels in the URL hash (#d=gal22v10&e=traffic-light).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { Studio } from '$lib/studio/studio.svelte';
  import StudioApp from '$lib/studio/StudioApp.svelte';
  import { decodeState } from '$lib/studio/state-hash';

  const studio = new Studio({ device: 'gal22v10', example: 'traffic-light' });
  let ready = false;

  onMount(() => {
    const s = decodeState(location.hash);
    if (s) studio.load({ device: s.device, example: s.example, source: s.source });
    ready = true;
    return () => studio.destroy();
  });

  // Keep the URL in step with the design (examples by id, custom sources in full).
  $effect(() => {
    void studio.deviceId;
    void studio.source;
    void studio.exampleId;
    if (!ready) return;
    const h = studio.hash();
    if (h !== location.hash) {
      try {
        replaceState(location.pathname + location.search + h, {});
      } catch {
        /* the router is not ready yet */
      }
    }
  });
</script>

<svelte:head><title>Device Studio</title></svelte:head>

<div class="page"><StudioApp {studio} /></div>

<style>
  .page {
    position: fixed;
    inset: 3.5rem 0 0 0;
    z-index: 30;
    background: var(--bg);
  }
</style>
