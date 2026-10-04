<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import MuseumCard from './MuseumCard.svelte';
  import type { Exhibit } from './types';

  let { items }: { items: Exhibit[] } = $props();
  onMount(() => progress.load());
  const sorted = $derived([...items].sort((a, b) => Number(a.year) - Number(b.year)));
  const caught = $derived(items.filter((e) => progress.isCaught(e.id)).length);
</script>

<div class="gallery wide">
  <p class="count ui" aria-live="polite">{caught} of {items.length} exhibits caught with the course’s tools.</p>
  <div class="grid">
    {#each sorted as e (e.id)}<MuseumCard exhibit={e} compact />{/each}
  </div>
</div>

<style>
  .count {
    font-size: 0.9rem;
    color: var(--ink-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
    gap: 1.2rem;
  }
</style>
