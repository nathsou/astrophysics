<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import { getZoom } from './zoom';

  let { title, children }: { title?: string; children?: Snippet } = $props();
  const zoom = getZoom();
  const index = zoom.claim();
</script>

{#if zoom.current === index}
  <div class="level" role="tabpanel" aria-label={title} in:fade={{ duration: 180 }}>
    {@render children?.()}
  </div>
{/if}

<style>
  .level :global(p) {
    margin: 0 0 0.85rem;
  }
</style>
